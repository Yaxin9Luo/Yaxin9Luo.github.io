import * as THREE from 'three';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const arraySHA=array=>sha(Buffer.from(array.buffer,array.byteOffset,array.byteLength));

/** An orthographic shape inspection of the caller's actual triangles, winding
 * and normals. Native-size CPU pixels are never resized or blurred. This does
 * not simulate PBR, textures, shadows, environment reflections or WebGL. */
export async function inspectSculptureCPU(owner,destination,{constructionSeconds=null,viewSpecs,size=2048}={}){
  if(!owner?.group?.isObject3D||!viewSpecs||!Object.keys(viewSpecs).length||!Number.isInteger(size)||size<256||size>4096)throw new Error('A sculpture owner, view specs and an integer 256..4096 output size are required');
  const started=performance.now(),resources=new Set(),files=[],images=[],light=new THREE.Vector3(.25,.85,.45).normalize();
  owner.group.updateMatrixWorld(true);owner.group.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [].concat(node.material??[])){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  await mkdir(destination,{recursive:true});
  for(const [view,spec]of Object.entries(viewSpecs)){
    if(!/^[a-z0-9-]+$/.test(view))throw new Error('CPU view names must be plain filename stems');
    const box=new THREE.Box3().setFromObject(owner.group),extent=box.getSize(new THREE.Vector3()),minimum=box.min.clone();
    if(spec.crop)box.set(new THREE.Vector3(...spec.crop.min).multiply(extent).add(minimum),new THREE.Vector3(...spec.crop.max).multiply(extent).add(minimum));
    const center=box.getCenter(new THREE.Vector3()),back=new THREE.Vector3(...spec.direction).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),back).normalize(),up=new THREE.Vector3().crossVectors(back,right);
    if(![...center.toArray(),...back.toArray()].every(Number.isFinite)||right.lengthSq()===0)throw new Error('CPU view needs finite bounds and a direction not parallel to world up');
    let half=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center);half=Math.max(half,Math.abs(p.dot(right)),Math.abs(p.dot(up)));}
    if(!(half>0&&Number.isFinite(half)))throw new Error('CPU view has empty projection extent');
    const scale=size/(2*half*1.10),pixels=new Uint8Array(size*size*3).fill(239),depth=new Float64Array(size*size).fill(Infinity),world=new THREE.Vector3(),normal=new THREE.Vector3();let triangles=0,sideCulledTriangles=0,degenerateProjectedTriangles=0,coveredPixels=0;
    owner.group.traverse(mesh=>{
      if(!mesh.isMesh)return;if(Array.isArray(mesh.material))throw new Error('CPU sculpture review currently requires one material per actual mesh');
      const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),projected=new Float64Array(p.count*4);
      for(let i=0;i<p.count;i++){world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).sub(center);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();projected[i*4]=size/2+world.dot(right)*scale;projected[i*4+1]=size/2-world.dot(up)*scale;projected[i*4+2]=-world.dot(back);projected[i*4+3]=normal.dot(light);}
      const index=g.index?.array,count=index?.length??p.count;
      for(let i=0;i<count;i+=3){triangles++;const a=(index?.[i]??i)*4,b=(index?.[i+1]??i+1)*4,c=(index?.[i+2]??i+2)*4,ax=projected[a],ay=projected[a+1],bx=projected[b],by=projected[b+1],cx=projected[c],cy=projected[c+1],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
        if(den===0){degenerateProjectedTriangles++;continue;}
        const front=den<0;if((mesh.material.side===THREE.FrontSide&&!front)||(mesh.material.side===THREE.BackSide&&front)){sideCulledTriangles++;continue;}
        const minX=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),maxX=Math.min(size-1,Math.floor(Math.max(ax,bx,cx)-.5)),minY=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),maxY=Math.min(size-1,Math.floor(Math.max(ay,by,cy)-.5)),faceSign=front?1:-1;
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const w0=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/den,w1=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/den,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;const z=w0*projected[a+2]+w1*projected[b+2]+w2*projected[c+2],at=y*size+x;if(z>=depth[at])continue;if(depth[at]===Infinity)coveredPixels++;depth[at]=z;
          const dot=(w0*projected[a+3]+w1*projected[b+3]+w2*projected[c+3])*faceSign,intensity=(.27+.73*Math.max(0,dot))*(mesh.material.name.includes('recess')?.55:1),value=Math.round(220*intensity);pixels[at*3]=value;pixels[at*3+1]=value;pixels[at*3+2]=value;
        }
      }
    });
    const filename=view+'.png',encoded=await sharp(pixels,{raw:{width:size,height:size,channels:3}}).png().toBuffer();await writeFile(path.join(destination,filename),encoded);files.push(filename);
    images.push({file:filename,width:size,height:size,pixelFormat:'RGB8',pixelSHA256:sha(pixels),pngSHA256:sha(encoded),pngBytes:encoded.length,coveredPixels,trianglesVisited:triangles,sideCulledTriangles,degenerateProjectedTriangles,direction:spec.direction,worldCenter:center.toArray(),worldPixelsPerUnit:scale,crop:spec.crop??null,projection:'orthographic',sampleLocation:'native pixel centers; no resize, blur, smoothing or image postprocess'});
  }
  const materials=[],textures=[];for(const resource of resources){if(resource.isMaterial)materials.push({name:resource.name,type:resource.type,color:resource.color?.toArray(),roughness:resource.roughness,metalness:resource.metalness,normalScale:resource.normalScale?.toArray(),side:resource.side});if(resource.isTexture)textures.push({name:resource.name,width:resource.image.width,height:resource.image.height,bytes:resource.image.data.byteLength,pixelSHA256:arraySHA(resource.image.data),colorSpace:resource.colorSpace});}
  const report={diagnosticOnly:true,native:false,texturesRendered:false,shadowsRendered:false,environmentRendered:false,materialResponseRendered:false,kind:'original-resolution CPU depth test of actual triangles, material side flags and interpolated actual normals',size,files,images,constructionSeconds,diagnostics:owner.diagnostics,materials,textures,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024,resources:resources.size,ownership:'borrowed for CPU inspection; caller disposes'};
  await writeFile(path.join(destination,'diagnostics.json'),JSON.stringify(report,null,2)+'\n');return report;
}
