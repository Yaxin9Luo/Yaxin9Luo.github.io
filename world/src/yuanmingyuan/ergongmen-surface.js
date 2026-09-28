import * as THREE from 'three';
import {applyJiuzhouBuildingSurface} from './jiuzhou-building-surface.js';

export const ERGONGMEN_SURFACE_ID='ergongmen-clean-mineral-surface-r2';
// Appearance choices for a clean restored exhibit, not recovered pigment recipes.
// Period and relief use metres; none of these controls move a vertex.
const profiles=Object.freeze({
 'jiuzhou-warm-white-stone':{family:'dressed-stone',color:0xd1d0c6,roughness:.85,period:.64,relief:.00070,roughnessSpan:.18,albedoSpan:.16},
 'jiuzhou-carved-stone':{family:'dressed-stone',color:0xd8d7cb,roughness:.81,period:.56,relief:.00055,roughnessSpan:.15,albedoSpan:.12},
 'jiuzhou-vermilion-timber':{family:'painted-timber',roughness:.55,period:.32,relief:.00010,roughnessSpan:.11,albedoSpan:.075},
 'jiuzhou-deep-red-recessed-wood':{family:'painted-timber',roughness:.62,period:.32,relief:.00012,roughnessSpan:.10,albedoSpan:.060},
 'ergongmen-red-lime-plaster':{family:'mineral-plaster',roughness:.94,period:.80,relief:.00065,roughnessSpan:.09,albedoSpan:.10},
 'jiuzhou-fine-grey-gable-brick':{family:'fine-grey-masonry',roughness:.94,period:.64,relief:.00048,roughnessSpan:.10,albedoSpan:.08}
});
export const ergongmenSurfaceProfiles=Object.freeze(Object.fromEntries(Object.entries(profiles).map(([k,v])=>[k,Object.freeze(v)])));

function createMineralField(){
 const size=1024,data=new Uint8Array(size*size*4);
 const hash=(x,y,seed)=>{let h=Math.imul(x+seed,374761393)^Math.imul(y+seed*3,668265263);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967295;};
 const noise=(u,v,cells,seed)=>{
  const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);
  const wrap=n=>(n%cells+cells)%cells,h=(dx,dy)=>hash(wrap(ix+dx),wrap(iy+dy),seed),mix=(a,b,t)=>a+(b-a)*t;
  return mix(mix(h(0,0),h(1,0),a),mix(h(0,1),h(1,1),a),b);
 };
 const encode=v=>Math.round(255*THREE.MathUtils.clamp(v,0,1));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size,i=4*(y*size+x);
  const fine=noise(u,v,256,31),grain=noise(u,v,64,89);
  const warpU=.10*(noise(u,v,8,431)-.5),warpV=.10*(noise(u,v,8,577)-.5);
  const mineral=noise(u+warpU,v+warpV,8,173),mid=noise(u+warpV,v-warpU,24,227);
  data[i]=encode(.5+.64*(fine-.5)+.36*(grain-.5));
  data[i+1]=encode(.5+.65*(mineral-.5)+.25*(grain-.5));
  data[i+2]=encode(.5+1.10*(mineral-.5)+.30*(mid-.5));
  data[i+3]=255;
 }
 const map=new THREE.DataTexture(data,size,size);
 map.name='ergongmen-clean-mineral-field-r2';map.colorSpace=THREE.NoColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.generateMipmaps=true;map.anisotropy=8;map.needsUpdate=true;
 map.userData={provenance:'original authored scalar field; metric surface-gradient method reused from Jiuzhou R3',historicalImage:false,channels:'R fine height / G roughness / B restrained mineral colour',sourceImagePixelsChanged:false};
 return map;
}
const once=(text,anchor,replacement)=>{
 if(text.split(anchor).length!==2)throw new Error('Ergongmen surface shader anchor changed: '+anchor);
 return text.replace(anchor,replacement);
};
// This is the same metric surface-gradient construction as the accepted base
// finish. Plaster/brick did not receive that finish and need their own insertion.
const metricDeclaration=[
 'varying vec3 vJzFinishWorld;',
 'uniform sampler2D jzFinishMap;',
 'uniform vec4 jzFinish;',
 'vec3 jzMicrofinish(vec3 worldPosition, vec3 viewNormal){',
 ' vec3 w=pow(abs(inverseTransformDirection(viewNormal,viewMatrix)),vec3(4.0));',
 ' w/=max(dot(w,vec3(1.0)),1e-8);',
 ' vec3 uvw=worldPosition/jzFinish.x,dx=dFdx(uvw),dy=dFdy(uvw);',
 ' return textureGrad(jzFinishMap,uvw.yz,dx.yz,dy.yz).rgb*w.x',
 '  +textureGrad(jzFinishMap,uvw.zx,dx.zx,dy.zx).rgb*w.y',
 '  +textureGrad(jzFinishMap,uvw.xy,dx.xy,dy.xy).rgb*w.z;',
 '}',
 'vec3 jzPhysicalRelief(vec3 viewPosition,vec3 baseNormal,float heightMetres,float faceSign){',
 ' vec3 sx=dFdx(viewPosition),sy=dFdy(viewPosition);',
 ' vec3 r1=cross(sy,baseNormal),r2=cross(baseNormal,sx);',
 ' float determinant=dot(sx,r1)*faceSign;',
 ' if(abs(determinant)<1e-16)return baseNormal;',
 ' vec3 gradient=sign(determinant)*(dFdx(heightMetres)*r1+dFdy(heightMetres)*r2);',
 ' return normalize(abs(determinant)*baseNormal-gradient);',
 '}'
].join('\n');
function compileRefinement(shader,map,spec,inherited){
 if(!inherited){
  shader.vertexShader=once(shader.vertexShader,'#include <common>','#include <common>\nvarying vec3 vJzFinishWorld;');
  shader.vertexShader=once(shader.vertexShader,'#include <project_vertex>',[
   '#include <project_vertex>',
   'vec4 jzFinishPosition=vec4(transformed,1.0);',
   '#ifdef USE_INSTANCING',
   'jzFinishPosition=instanceMatrix*jzFinishPosition;',
   '#endif',
   'vJzFinishWorld=(modelMatrix*jzFinishPosition).xyz;'
  ].join('\n'));
  shader.fragmentShader=once(shader.fragmentShader,'#include <common>','#include <common>\n'+metricDeclaration);
  shader.fragmentShader=once(shader.fragmentShader,'#include <normal_fragment_maps>',[
   '#include <normal_fragment_maps>',
   'vec3 jzSurfaceSample=jzMicrofinish(vJzFinishWorld,normal);',
   'diffuseColor.rgb*=1.0+jzFinish.w*(jzSurfaceSample.b-0.5);',
   'roughnessFactor=clamp(roughnessFactor+jzFinish.z*(jzSurfaceSample.g-0.5),0.04,1.0);',
   'normal=jzPhysicalRelief(-vViewPosition,normal,jzFinish.y*(jzSurfaceSample.r-0.5),faceDirection);'
  ].join('\n'));
 }else if(!shader.uniforms.jzFinishMap||!shader.uniforms.jzFinish){
  throw new Error('Inherited Jiuzhou metric finish not present');
 }
 shader.uniforms.jzFinishMap={value:map};
 shader.uniforms.jzFinish={value:new THREE.Vector4(spec.period,spec.relief,spec.roughnessSpan,spec.albedoSpan)};
}

/** Own only private finishes. Restore them before releasing the unique builder. */
export function applyErgongmenSurface({group,signal}={}){
 signal?.throwIfAborted();
 if(!group?.isObject3D)throw new TypeError('Ergongmen source group required');
 // Validate the two newly selected source classes before leasing any resources.
 group.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(!profiles[m?.name])continue;
   if(!m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.userData?.ergongmenSurface||m.userData?.jiuzhouSurface||m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)throw new Error('Unexpected or already leased Ergongmen material: '+m.name);
   if(mesh.isSkinnedMesh||mesh.isBatchedMesh||mesh.morphTargetInfluences?.length)throw new Error('Static Ergongmen source required');
  }
 });
 const extras=new Map(),extraCache=new Map(),bindings=[],decorated=new Set();
 const diagnostics={id:ERGONGMEN_SURFACE_ID,baseFinish:null,geometryChanged:false,sourcePaintPixelsChanged:false,extraPrivateMaterials:0,extraPrivateTextures:0,field:{size:[1024,1024],colorSpace:'linear scalar data',channels:'R height / G roughness / B albedo',sampling:'mipmapped world metres, triplanar, explicit gradients'},refinedMaterials:[],shaderPreparations:0,preparedMaterials:[],disposed:false,nativeArtPassed:false};
 let base=null,map=null,disposed=false;
 const dispose=()=>{
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  const errors=[];
  // Undo our slots in the base-owned arrays without replacing those arrays:
  // base.assertCurrent() retains its exact material-identity contract.
  for(const b of bindings){
   try{
    if(Array.isArray(b.mesh.material)){
     for(let i=0;i<b.mesh.material.length;i++)b.mesh.material[i]=extras.get(b.mesh.material[i])??b.mesh.material[i];
    }else b.mesh.material=extras.get(b.mesh.material)??b.mesh.material;
   }catch(e){errors.push(e);}
  }
  for(const m of extras.keys())try{m.dispose();}catch(e){errors.push(e);}
  try{base?.dispose();}catch(e){errors.push(e);}
  try{map?.dispose();}catch(e){errors.push(e);}
  diagnostics.disposed=true;
  if(errors.length)throw new AggregateError(errors,'Ergongmen private surface release failed');
 };
 try{
  // The outer owner controls abort, so its refinement always releases before
  // the inherited finish. The borrowed source is never released by this lease.
  base=applyJiuzhouBuildingSurface({group});diagnostics.baseFinish=base.diagnostics;
  map=createMineralField();signal?.throwIfAborted();
  group.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const original=mesh.material,list=Array.isArray(original)?original:[original];
   if(!list.some(m=>profiles[m?.name]))return;
   const binding={mesh,geometry:mesh.geometry,assigned:null,slots:null};bindings.push(binding);
   for(let i=0;i<list.length;i++){
    const source=list[i],spec=profiles[source?.name];if(!spec)continue;
    let copy=source,inherited=Boolean(source.userData?.jiuzhouSurface);
    if(!inherited){
     copy=extraCache.get(source);
     if(!copy){copy=source.clone();extras.set(copy,source);extraCache.set(source,copy);}
     list[i]=copy;
    }
    if(decorated.has(copy))continue;decorated.add(copy);
    const before={color:copy.color.getHexString(),roughness:copy.roughness};
    // Keep the authored six rubble colours instead of flattening the platform
    // masonry into the pale stone used on the treads and column bases.
    if(spec.color!==undefined&&copy.userData.category!=='tiger-skin-rubble')copy.color.setHex(spec.color);
    copy.roughness=spec.roughness;
    // The original scalar bitmap is retained by its source owner. Its normalized
    // box UV bump is replaced here by an equally resolved 1K metric field.
    if(!inherited){copy.bumpMap=null;copy.normalMap=null;copy.roughnessMap=null;}
    copy.userData={...copy.userData,ergongmenSurface:{id:ERGONGMEN_SURFACE_ID,family:spec.family,originalMaterialName:source.name}};
    const baseCompile=inherited?copy.onBeforeCompile:null;
    const baseKey=inherited?copy.customProgramCacheKey():THREE.Material.prototype.customProgramCacheKey.call(copy);
    copy.onBeforeCompile=(shader,renderer)=>{
     if(disposed)throw new Error('Ergongmen surface lease disposed');
     baseCompile?.call(copy,shader,renderer);compileRefinement(shader,map,spec,inherited);
     diagnostics.shaderPreparations++;diagnostics.preparedMaterials=[...new Set([...diagnostics.preparedMaterials,copy.name])].sort();
    };
    copy.customProgramCacheKey=()=>baseKey+':'+ERGONGMEN_SURFACE_ID+':'+source.name;
    copy.needsUpdate=true;
    diagnostics.refinedMaterials.push({name:source.name,family:spec.family,rubbleColourPreserved:copy.userData.category==='tiger-skin-rubble',before,after:{color:copy.color.getHexString(),roughness:copy.roughness},periodMetres:spec.period,reliefMetres:spec.relief,albedoSpan:spec.albedoSpan,paintMapBorrowed:source.map===copy.map,inheritedPrivateMaterial:inherited});
   }
   if(!Array.isArray(original))mesh.material=list[0];
   binding.assigned=mesh.material;binding.slots=Array.isArray(mesh.material)?[...mesh.material]:null;
   signal?.throwIfAborted();
  });
  if(!decorated.size)throw new Error('No Ergongmen refinement target found');
  diagnostics.extraPrivateMaterials=extras.size;diagnostics.extraPrivateTextures=1;
  const owner={diagnostics,dispose,get disposed(){return disposed;},assertCurrent(){
   if(disposed)throw new Error('Ergongmen surface lease disposed');
   base.assertCurrent();
   for(const b of bindings)if(b.mesh.geometry!==b.geometry||b.mesh.material!==b.assigned||(b.slots&&b.slots.some((m,i)=>b.mesh.material[i]!==m))||(b.slots&&b.mesh.material.length!==b.slots.length))throw new Error('Ergongmen source binding changed during surface lease');
  }};
  signal?.addEventListener('abort',dispose,{once:true});signal?.throwIfAborted();owner.assertCurrent();return owner;
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Ergongmen surface preparation and cleanup failed',{cause:error});}throw error;}
}
