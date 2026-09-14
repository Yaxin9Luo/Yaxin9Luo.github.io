import * as THREE from 'three';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createXieqiquCopperSheepStudy} from '../src/yuanmingyuan/xieqiqu-study.js';
import {copperSheepStudyViews} from '../src/yuanmingyuan/xieqiqu-copper-sheep.js';

// A bounded CPU shape diagnostic, not a renderer or a substitute for native PBR
// review. It projects the actual triangles/normals without silhouette smoothing.
export async function inspectCopperSheepGeometry(owner,destination,{constructionSeconds=null,viewSpecs=null}={}) {
  await mkdir(destination,{recursive:true});
  const started=performance.now(),resources=new Set();
  owner.group.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [].concat(node.material??[])){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  owner.group.updateMatrixWorld(true);
  const size=768,light=new THREE.Vector3(.25,.85,.45).normalize(),files=[];
  for(const view of Object.keys(viewSpecs??Object.fromEntries(['threequarter','side','head-join'].map(id=>[id,copperSheepStudyViews[id]])))){
    const spec=viewSpecs?.[view]??copperSheepStudyViews[view],box=new THREE.Box3().setFromObject(owner.group),extent=box.getSize(new THREE.Vector3()),minimum=box.min.clone();
    if(spec.crop)box.set(new THREE.Vector3(...spec.crop.min).multiply(extent).add(minimum),new THREE.Vector3(...spec.crop.max).multiply(extent).add(minimum));
    const center=box.getCenter(new THREE.Vector3()),back=new THREE.Vector3(...spec.direction).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),back).normalize(),up=new THREE.Vector3().crossVectors(back,right);
    let half=0;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center);half=Math.max(half,Math.abs(p.dot(right)),Math.abs(p.dot(up)));}
    const scale=size/(2*half*1.10),pixels=new Uint8Array(size*size*3).fill(239),depth=new Float64Array(size*size).fill(Infinity),world=new THREE.Vector3(),normal=new THREE.Vector3();
    owner.group.traverse(mesh=>{
      if(!mesh.isMesh)return;const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),projected=new Float64Array(p.count*4);
      for(let i=0;i<p.count;i++){world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).sub(center);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();projected[i*4]=size/2+world.dot(right)*scale;projected[i*4+1]=size/2-world.dot(up)*scale;projected[i*4+2]=-world.dot(back);projected[i*4+3]=.27+.73*Math.max(0,normal.dot(light));}
      const indices=geometry.index?.array,count=indices?.length??p.count;
      for(let i=0;i<count;i+=3){const a=(indices?indices[i]:i)*4,b=(indices?indices[i+1]:i+1)*4,c=(indices?indices[i+2]:i+2)*4,ax=projected[a],ay=projected[a+1],bx=projected[b],by=projected[b+1],cx=projected[c],cy=projected[c+1],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(den===0)continue;
        const minX=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),maxX=Math.min(size-1,Math.floor(Math.max(ax,bx,cx)-.5)),minY=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),maxY=Math.min(size-1,Math.floor(Math.max(ay,by,cy)-.5));
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const w0=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/den,w1=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/den,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;const z=w0*projected[a+2]+w1*projected[b+2]+w2*projected[c+2],at=y*size+x;if(z>=depth[at])continue;depth[at]=z;const value=(w0*projected[a+3]+w1*projected[b+3]+w2*projected[c+3])*(mesh.material.name.includes('recess')?.55:1);for(let channel=0;channel<3;channel++)pixels[at*3+channel]=Math.round(220*value);}
      }
    });
    const filename=view+'.png';await sharp(pixels,{raw:{width:size,height:size,channels:3}}).png().toFile(path.join(destination,filename));files.push(filename);
  }
  const sha=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex'),geometry=[],materials=[],textures=[];
  owner.group.traverse(mesh=>{if(mesh.isMesh)geometry.push({name:mesh.parent.name,triangles:(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,attribute])=>[name,{count:attribute.count,itemSize:attribute.itemSize,bytes:attribute.array.byteLength,sha256:sha(attribute.array)}])),index:mesh.geometry.index?{bytes:mesh.geometry.index.array.byteLength,sha256:sha(mesh.geometry.index.array)}:null,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow});});
  for(const resource of resources){if(resource.isMaterial)materials.push({name:resource.name,type:resource.type,color:resource.color.toArray(),roughness:resource.roughness,metalness:resource.metalness,normalScale:resource.normalScale?.toArray(),side:resource.side});if(resource.isTexture)textures.push({name:resource.name,width:resource.image.width,height:resource.image.height,bytes:resource.image.data.byteLength,pixelSHA256:sha(resource.image.data),colorSpace:resource.colorSpace});}
  const report={diagnosticOnly:true,native:false,texturesRendered:false,shadowsRendered:false,kind:'CPU depth-tested actual mesh triangles with interpolated actual normals',files,constructionSeconds,diagnostics:owner.diagnostics,geometry,materials,textures,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024,resources:resources.size,ownership:'borrowed for CPU inspection; caller disposes'};
  await writeFile(path.join(destination,'diagnostics.json'),JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const destination=path.resolve(process.argv[2]??fileURLToPath(new URL('../../work/yuanmingyuan/xieqiqu-copper-sheep-r4/cpu-review-first/',import.meta.url))),started=performance.now(),owner=createXieqiquCopperSheepStudy(),constructionSeconds=(performance.now()-started)/1000,resources=new Set(),disposed=new Map();
  owner.group.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of [].concat(node.material??[])){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  for(const resource of resources){disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}
  try {
    const report=await inspectCopperSheepGeometry(owner,destination,{constructionSeconds});owner.dispose();owner.dispose();
    if([...disposed.values()].some(count=>count!==1))throw new Error('Single sheep review leaked or repeated disposal');
    report.eachDisposedExactlyOnce=true;await writeFile(path.join(destination,'diagnostics.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({destination,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024,diagnostics:owner.diagnostics}));
  } finally {owner.dispose();}
}
