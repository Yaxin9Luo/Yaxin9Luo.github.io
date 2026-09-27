import * as THREE from 'three';

export const JIUZHOU_COURTYARD_SURFACE_ID='jiuzhou-courtyard-mineral-r2';
const active=new WeakSet();
export const jiuzhouCourtyardProfiles=Object.freeze({
 'jiuzhou-grey-court-paving':Object.freeze({family:'mineral',period:1.5,normal:8,roughness:.87,roughnessSpan:.32,contrast:.28}),
 'jiuzhou-warm-white-stone':Object.freeze({family:'mineral',color:0xd3d0c4,period:1.5,normal:5,roughness:.81,roughnessSpan:.30,contrast:.22}),
 'jiuzhou-carved-stone':Object.freeze({family:'mineral',color:0xdbd7cb,period:1.5,normal:4,roughness:.79,roughnessSpan:.28,contrast:.18}),
 'jiuzhou-vermilion-timber':Object.freeze({family:'lacquer',period:.34,relief:.00012,roughness:.54,roughnessSpan:.12,contrast:.10})
});
const once=(source,anchor,replacement)=>{
 if(source.split(anchor).length!==2)throw new Error('Jiuzhou courtyard shader anchor changed: '+anchor);
 return source.replace(anchor,replacement);
};
const inheritedBlock=[
 'vec3 jzSurfaceSample = jzMicrofinish(vJzFinishWorld, normal);',
 '  diffuseColor.rgb *= 1.0 + jzFinish.w * (jzSurfaceSample.b - 0.5);',
 '  roughnessFactor = clamp(roughnessFactor + jzFinish.z * (jzSurfaceSample.g - 0.5), 0.04, 1.0);',
 '  normal = jzPhysicalRelief(-vViewPosition, normal, jzFinish.y * (jzSurfaceSample.r - 0.5), faceDirection);'
].join('\n');
const declaration=[
 'varying vec3 vJzCourtWorld;',
 'uniform sampler2D jzCourtColor;',
 'uniform sampler2D jzCourtNormal;',
 'uniform sampler2D jzCourtRoughness;',
 'uniform vec4 jzCourtFinish;',
 'uniform float jzCourtContrast;',
 'uniform float jzCourtMeanLinear;',
 'uniform float jzCourtMeanRoughness;',
 'vec4 jzCourtRead(sampler2D tex,vec2 uv){return textureGrad(tex,uv,dFdx(uv),dFdy(uv));}',
 'vec2 jzCourtSlope(vec3 sampledNormal){',
 ' vec3 n=sampledNormal*2.0-1.0;',
 ' return -n.xy/max(n.z,0.25);',
 '}',
 'void jzCourtSample(vec3 worldPosition,vec3 worldNormal,out float luminance,out float roughness,out vec3 gradient){',
 ' vec3 w=pow(abs(worldNormal),vec3(4.0));w/=max(dot(w,vec3(1.0)),1e-8);',
 ' vec3 face=vec3(worldNormal.x<0.0?-1.0:1.0,worldNormal.y<0.0?-1.0:1.0,worldNormal.z<0.0?-1.0:1.0);',
 ' vec3 p=worldPosition/jzCourtFinish.x;',
 ' vec2 ux=vec2(-face.x*p.z,p.y),uy=vec2(p.x,-face.y*p.z),uz=vec2(face.z*p.x,p.y);',
 ' vec3 c=jzCourtRead(jzCourtColor,ux).rgb*w.x+jzCourtRead(jzCourtColor,uy).rgb*w.y+jzCourtRead(jzCourtColor,uz).rgb*w.z;',
 ' luminance=dot(c,vec3(0.2126,0.7152,0.0722));',
 ' roughness=jzCourtRead(jzCourtRoughness,ux).g*w.x+jzCourtRead(jzCourtRoughness,uy).g*w.y+jzCourtRead(jzCourtRoughness,uz).g*w.z;',
 ' vec2 sx=jzCourtSlope(jzCourtRead(jzCourtNormal,ux).rgb);',
 ' vec2 sy=jzCourtSlope(jzCourtRead(jzCourtNormal,uy).rgb);',
 ' vec2 sz=jzCourtSlope(jzCourtRead(jzCourtNormal,uz).rgb);',
 ' gradient=vec3(0.0,sx.y,-face.x*sx.x)*w.x+vec3(sy.x,0.0,-face.y*sy.y)*w.y+vec3(face.z*sz.x,sz.y,0.0)*w.z;',
 '}'
].join('\n');
const mineralBlock=[
 'vec3 jzCourtWorldNormal=inverseTransformDirection(normal,viewMatrix);',
 'float jzCourtLuma,jzCourtRough;vec3 jzCourtGradient;',
 'jzCourtSample(vJzCourtWorld,jzCourtWorldNormal,jzCourtLuma,jzCourtRough,jzCourtGradient);',
 // The original warm-grey / white material keeps its hue and nominal value.
 // No new tile layout, dirt mask or joints are painted into this surface.
 'diffuseColor.rgb*=mix(1.0,clamp(jzCourtLuma/jzCourtMeanLinear,0.55,1.35),jzCourtContrast);',
 'roughnessFactor=clamp(jzCourtFinish.z+jzCourtFinish.w*(jzCourtRough-jzCourtMeanRoughness),0.55,0.97);',
 'jzCourtGradient-=jzCourtWorldNormal*dot(jzCourtGradient,jzCourtWorldNormal);',
 'normal=transformDirection(normalize(jzCourtWorldNormal-jzCourtFinish.y*jzCourtGradient),viewMatrix);'
].join('\n');

function compileMineral(shader,maps,spec,inherited){
 shader.uniforms.jzCourtColor={value:maps.color};
 shader.uniforms.jzCourtNormal={value:maps.normal};
 shader.uniforms.jzCourtRoughness={value:maps.roughness};
 shader.uniforms.jzCourtFinish={value:new THREE.Vector4(spec.period,spec.normal,spec.roughness,spec.roughnessSpan)};
 shader.uniforms.jzCourtContrast={value:spec.contrast};
 // Calibrated from all pixels of the pinned 4096 maps; RGB is linearized.
 shader.uniforms.jzCourtMeanLinear={value:.8926694220605648};
 shader.uniforms.jzCourtMeanRoughness={value:.11569262717624704};
 shader.vertexShader=once(shader.vertexShader,'#include <common>','#include <common>\nvarying vec3 vJzCourtWorld;');
 shader.vertexShader=once(shader.vertexShader,'#include <project_vertex>',[
  '#include <project_vertex>',
  'vec4 jzCourtPosition=vec4(transformed,1.0);',
  '#ifdef USE_INSTANCING','jzCourtPosition=instanceMatrix*jzCourtPosition;','#endif',
  'vJzCourtWorld=(modelMatrix*jzCourtPosition).xyz;'
 ].join('\n'));
 shader.fragmentShader=once(shader.fragmentShader,'#include <common>','#include <common>\n'+declaration);
 shader.fragmentShader=inherited?once(shader.fragmentShader,inheritedBlock,mineralBlock):
  once(shader.fragmentShader,'#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+mineralBlock);
}
function rigid(matrix){
 const e=matrix.elements,axes=[new THREE.Vector3(e[0],e[1],e[2]),new THREE.Vector3(e[4],e[5],e[6]),new THREE.Vector3(e[8],e[9],e[10])];
 return e.every(Number.isFinite)&&axes.every(v=>Math.abs(v.lengthSq()-1)<1e-7)&&Math.abs(axes[0].dot(axes[1]))<1e-7&&Math.abs(axes[1].dot(axes[2]))<1e-7&&Math.abs(axes[2].dot(axes[0]))<1e-7&&matrix.determinant()>0;
}

/** Borrow the current Jiuzhou R3 finish and three maps; restore before either owner. */
export function applyJiuzhouCourtyardSurface({group,mapOwner,signal}={}){
 signal?.throwIfAborted();
 if(!group?.isGroup||!['late-xianfeng-jiuzhou-qingyan-core-study','jiuzhou-original-courtyard-material-component'].includes(group.userData.body)||active.has(group))
  throw new Error('An unleased actual Jiuzhou source group is required');
 const maps=mapOwner?.maps;
 if(!maps||mapOwner.disposed)throw new Error('Live Jiuzhou courtyard maps are required');
 for(const role of ['color','normal','roughness']){
  const m=maps[role];
  if(!m?.isTexture||m.image?.width!==4096||m.image?.height!==4096||m.repeat.x!==1||m.repeat.y!==1||m.offset.x!==0||m.offset.y!==0||m.rotation!==0||m.colorSpace!==(role==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace))
   throw new Error('Unexpected 4K courtyard map: '+role);
 }
 const mapBindings=Object.fromEntries(['color','normal','roughness'].map(role=>[role,{texture:maps[role],image:maps[role].image}]));
 const assertMaps=()=>{
  if(mapOwner.disposed)throw new Error('Jiuzhou courtyard maps disposed');
  for(const [role,b]of Object.entries(mapBindings)){
   const m=maps[role];
   if(m!==b.texture||m.image!==b.image||m.repeat.x!==1||m.repeat.y!==1||m.offset.x!==0||m.offset.y!==0||m.rotation!==0||
    m.colorSpace!==(role==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace)||m.wrapS!==THREE.RepeatWrapping||m.wrapT!==THREE.RepeatWrapping)
    throw new Error('Jiuzhou courtyard map binding changed: '+role);
  }
 };
 assertMaps();
 group.updateWorldMatrix(true,true);
 if(!rigid(group.matrixWorld))throw new Error('Jiuzhou courtyard metres require rigid unit world placement');
 active.add(group);
 const inverse=group.matrixWorld.clone().invert(),bindings=[],materials=new Map(),extras=new Map(),extraCache=new Map(),errors=[];
 let disposed=false,released=false,applying=true;
 const diagnostics={id:JIUZHOU_COURTYARD_SURFACE_ID,geometryChanged:false,historicalColourFamiliesPreserved:true,sourcePaintPixelsChanged:false,sourceMapsBorrowed:true,newJointLines:0,textureResolution:4096,privateMaterials:0,decoratedBaseMaterials:0,shaderPreparations:0,preparedMaterials:[],materials:[],disposed:false,nativeArtPassed:false};
 function release(){
  if(released||applying)return;released=true;
  for(const b of bindings)try{
   if(Array.isArray(b.mesh.material)){for(let i=0;i<b.mesh.material.length;i++)b.mesh.material[i]=extras.get(b.mesh.material[i])??b.mesh.material[i];}
   else b.mesh.material=extras.get(b.mesh.material)??b.mesh.material;
  }catch(error){errors.push(error);}
  for(const [material,before]of materials)if(before.inherited)try{
   material.color.copy(before.color);material.roughness=before.roughness;material.onBeforeCompile=before.compile;material.customProgramCacheKey=before.cacheKey;material.userData=before.userData;material.needsUpdate=true;
  }catch(error){errors.push(error);}
  for(const material of extras.keys())try{material.dispose();}catch(error){errors.push(error);}
  active.delete(group);signal?.removeEventListener('abort',abort);diagnostics.disposed=true;
 }
 function dispose(){
  disposed=true;release();
  if(errors.length)throw new AggregateError([...errors],'Jiuzhou courtyard finish cleanup failed');
 }
 const abort=()=>{try{dispose();}catch{/* Explicit dispose exposes the retained error. */}};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  group.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const container=mesh.material,list=Array.isArray(container)?container:[container];
   if(!list.some(m=>jiuzhouCourtyardProfiles[m?.name]))return;
   if(mesh.isSkinnedMesh||mesh.isBatchedMesh||mesh.morphTargetInfluences?.length)throw new Error('Static source surfaces required');
   const binding={mesh,geometry:mesh.geometry,container,slots:[...list],assigned:null,assignedSlots:null,frame:new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),instanceMatrix:mesh.instanceMatrix,instanceVersion:mesh.instanceMatrix?.version,count:mesh.count};
   bindings.push(binding);
   for(let i=0;i<list.length;i++){
    const original=list[i],spec=jiuzhouCourtyardProfiles[original?.name];if(!spec)continue;
    // Another mesh may share the same base-owned copy already decorated here.
    if(materials.has(original))continue;
    const inherited=original.userData?.jiuzhouSurface?.id==='jiuzhou-building-surface-r3';
    if(!original.isMeshStandardMaterial||original.isMeshPhysicalMaterial||original.userData?.jiuzhouCourtyardSurface||original.map||
      (original.name==='jiuzhou-grey-court-paving'?(inherited||original.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile):!inherited))
     throw new Error('Unexpected actual Jiuzhou material: '+original.name);
    let material=original;
    if(!inherited){
     material=extraCache.get(original);
     if(!material){material=original.clone();extras.set(material,original);extraCache.set(original,material);material.normalMap=null;material.roughnessMap=null;material.bumpMap=null;}
     list[i]=material;
    }
    if(materials.has(material))continue;
    const before={inherited,color:material.color.clone(),roughness:material.roughness,compile:material.onBeforeCompile,cacheKey:material.customProgramCacheKey,userData:material.userData};
    materials.set(material,before);
    if(spec.color!==undefined)material.color.setHex(spec.color);
    material.roughness=spec.roughness;
    const baseKey=inherited?before.cacheKey.call(material):'stock-jiuzhou-paving';
    material.userData={...material.userData,jiuzhouCourtyardSurface:{id:JIUZHOU_COURTYARD_SURFACE_ID,family:spec.family}};
    material.onBeforeCompile=(shader,renderer)=>{
     if(disposed)throw new Error('Jiuzhou courtyard finish unavailable during shader preparation');
     assertMaps();
     if(inherited)before.compile.call(material,shader,renderer);
     if(spec.family==='lacquer'){
      if(!shader.uniforms.jzFinish||!shader.uniforms.jzFinishMap)throw new Error('Actual inherited Jiuzhou lacquer shader missing');
      shader.uniforms.jzFinish={value:new THREE.Vector4(spec.period,spec.relief,spec.roughnessSpan,spec.contrast)};
     }else compileMineral(shader,maps,spec,inherited);
     diagnostics.shaderPreparations++;diagnostics.preparedMaterials=[...new Set([...diagnostics.preparedMaterials,material.name])].sort();
    };
    material.customProgramCacheKey=()=>baseKey+':'+JIUZHOU_COURTYARD_SURFACE_ID+':'+material.name;
    material.needsUpdate=true;
    diagnostics.materials.push({name:original.name,inheritedPrivateMaterial:inherited,before:{color:before.color.getHexString(),roughness:before.roughness},after:{color:material.color.getHexString(),roughness:material.roughness},...spec});
   }
   if(!Array.isArray(container))mesh.material=list[0];
   binding.assigned=mesh.material;binding.assignedSlots=[...(Array.isArray(mesh.material)?mesh.material:[mesh.material])];
   signal?.throwIfAborted();
  });
  if(!materials.size)throw new Error('No original Jiuzhou courtyard material found');
  applying=false;signal?.throwIfAborted();if(disposed)throw new Error('Jiuzhou courtyard finish aborted during installation');
  active.add(group);diagnostics.privateMaterials=extras.size;diagnostics.decoratedBaseMaterials=[...materials.values()].filter(x=>x.inherited).length;
  const owner={diagnostics,dispose,get disposed(){return disposed;},get cleanupErrors(){return [...errors];},assertCurrent(){
   if(disposed)throw new Error('Jiuzhou courtyard surface source disposed');
   assertMaps();
   group.updateWorldMatrix(true,true);if(!rigid(group.matrixWorld))throw new Error('Jiuzhou courtyard unit placement changed');
   const inv=group.matrixWorld.clone().invert();
   for(const b of bindings){
    const slots=Array.isArray(b.mesh.material)?b.mesh.material:[b.mesh.material],frame=new THREE.Matrix4().multiplyMatrices(inv,b.mesh.matrixWorld);
    if(b.mesh.geometry!==b.geometry||b.mesh.material!==b.assigned||slots.length!==b.assignedSlots.length||slots.some((m,i)=>m!==b.assignedSlots[i])||frame.elements.some((v,i)=>Math.abs(v-b.frame.elements[i])>1e-7)||b.mesh.instanceMatrix!==b.instanceMatrix||b.mesh.instanceMatrix?.version!==b.instanceVersion||b.mesh.count!==b.count)
     throw new Error('Jiuzhou courtyard source binding or internal placement changed');
   }
  }};
  owner.assertCurrent();return owner;
 }catch(error){
  applying=false;try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Jiuzhou courtyard finish preparation failed',{cause:error});}throw error;
 }
}
