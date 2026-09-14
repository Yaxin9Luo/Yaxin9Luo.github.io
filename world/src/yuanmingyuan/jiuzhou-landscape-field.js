import {Box3,DataTexture,RGBAFormat,UnsignedByteType,LinearFilter,ClampToEdgeWrapping,NoColorSpace,Matrix4,Vector3} from 'three';

export const jiuzhouEarthMeshName='jiuzhou-shore-and-island-support/jiuzhou-garden-earth';
export const jiuzhouLandscapeDesign=Object.freeze({
  id:'jiuzhou-mineral-ground-r1',evidence:'contemporary-museum-landscape-treatment',
  historicalPlantingRecovered:false,geometryAdded:0,heightDisplacement:0,
  maskPitchMetres:.125,gravelTileMetres:2.5,meadowTileMetres:15,
  mineralRimMetres:.18,footFringeMetres:[.35,2.35],
});
const bodies=new Set(['stone-edged-platform-with-individual-paving','continuous-polygon-platform-with-separate-stone-pavers','supported-stone-steps','curved-outline-cloud-steps','open-gallery-bay','courtyard-lime-wall-with-solid-grey-brick-coping']);
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
function random(x,z){return fract(Math.sin(x*127.1+z*311.7)*43758.5453123);}
function noise(x,z){
  const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,fract(x)),v=smooth(0,1,fract(z));
  return (random(a,b)*(1-u)+random(a+1,b)*u)*(1-v)+(random(a,b+1)*(1-u)+random(a+1,b+1)*u)*v;
}
function rectangleDistance(x,z,r){
  const dx=Math.max(r.min[0]-x,0,x-r.max[0]),dz=Math.max(r.min[1]-z,0,z-r.max[1]);
  return dx||dz?Math.hypot(dx,dz):-Math.min(x-r.min[0],r.max[0]-x,z-r.min[1],r.max[1]-z);
}
function segmentDistance(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
// Bounds use the real low masonry/floor groups. They are deliberately
// conservative for nonrectangular platforms; they never change navigation.
export function collectJiuzhouGroundFootprints(root){
  root.updateWorldMatrix(true,true);
  const inverse=new Matrix4().copy(root.matrixWorld).invert(),result=[];
  root.traverse(node=>{
    if(!bodies.has(node.userData.body))return;
    const box=new Box3(),p=new Vector3();
    node.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh)return;
      if(!['jiuzhou-warm-white-stone','jiuzhou-grey-court-paving','jiuzhou-weathered-foundation','jiuzhou-fine-grey-gable-brick'].includes(mesh.geometry?.name?.split('/').at(-1)??mesh.material?.name))return;
      const geometry=mesh.geometry;geometry.computeBoundingBox();
      const b=geometry.boundingBox,matrix=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])box.expandByPoint(p.set(x,y,z).applyMatrix4(matrix));
    });
    if(box.isEmpty())return;
    const step=node.userData.body.includes('steps'),margin=step ? .70 : 0;
    result.push({id:node.name,body:node.userData.body,min:[box.min.x-margin,box.min.z-margin],max:[box.max.x+margin,box.max.z+margin],stepApproachMargin:margin});
  });
  if(!result.length)throw new Error('Jiuzhou ground needs actual retained stone/platform footprints.');
  return result;
}
export function createJiuzhouGroundField({footprints,outline,min,max}){
  if(!Array.isArray(footprints)||!footprints.length||!Array.isArray(outline)||outline.length<3)throw new Error('Jiuzhou ground field needs real footprint and island data.');
  const bins=new Map(),cell=8,reach=12;
  for(const r of footprints){
    if(![...r.min,...r.max].every(Number.isFinite)||r.max[0]<=r.min[0]||r.max[1]<=r.min[1])throw new Error('Invalid Jiuzhou ground footprint.');
    for(let z=Math.floor((r.min[1]-reach)/cell);z<=Math.floor((r.max[1]+reach)/cell);z++)for(let x=Math.floor((r.min[0]-reach)/cell);x<=Math.floor((r.max[0]+reach)/cell);x++){
      const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(r);
    }
  }
  function sample(x,z){
    if(![x,z].every(Number.isFinite))throw new Error('Invalid Jiuzhou ground sample.');
    let distance=12,shore=Infinity;
    for(const r of bins.get(Math.floor(x/cell)+','+Math.floor(z/cell))??[])distance=Math.min(distance,rectangleDistance(x,z,r));
    for(let i=0;i<outline.length;i++)shore=Math.min(shore,segmentDistance(x,z,outline[i],outline[(i+1)%outline.length]));
    const broad=noise(x*.23+8.1,z*.23-3.7),fine=noise(x*1.14-5.3,z*1.14+12.8),field=.68*broad+.32*fine;
    const clear=smooth(.18,.40,distance),fringe=clear*(1-smooth(1.05,2.35,distance))*smooth(.35,.66,field)*.86;
    const outer=smooth(5,10,distance)*smooth(.58,.77,field)*.52;
    const bank=(1-smooth(.6,2.7,shore))*smooth(.32,.63,field)*.62;
    const grass=distance<=.18?0:Math.max(fringe,outer,bank)*clear;
    return {grass,footShade:(1-smooth(.0,.72,distance))*.075*(.5+.5*fine),mineralVariation:.93+.10*broad+.025*fine,distance,shore};
  }
  const pitch=jiuzhouLandscapeDesign.maskPitchMetres,width=Math.ceil((max[0]-min[0])/pitch)+1,height=Math.ceil((max[1]-min[1])/pitch)+1;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>4096||height>4096)throw new Error('Jiuzhou ground field dimensions exceed the original island contract.');
  const data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const value=sample(min[0]+x*(max[0]-min[0])/(width-1),min[1]+y*(max[1]-min[1])/(height-1)),i=(y*width+x)*4;
    data[i]=Math.round(clamp(value.grass)*255);data[i+1]=Math.round(clamp(value.footShade/.1)*255);data[i+2]=Math.round(clamp((value.mineralVariation-.9)/.2)*255);data[i+3]=255;
  }
  const texture=new DataTexture(data,width,height,RGBAFormat,UnsignedByteType);
  texture.name='jiuzhou-actual-platform-ground-field';texture.colorSpace=NoColorSpace;texture.flipY=false;
  texture.magFilter=texture.minFilter=LinearFilter;texture.wrapS=texture.wrapT=ClampToEdgeWrapping;texture.generateMipmaps=false;texture.needsUpdate=true;
  return {texture,sample,diagnostics:{width,height,pitchUpperBoundMetres:pitch,bytes:data.byteLength,min:[...min],max:[...max],footprints,fieldOnly:true,providerPixelsChanged:false}};
}
