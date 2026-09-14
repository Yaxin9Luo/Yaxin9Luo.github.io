import {Matrix4,Vector3} from 'three';
import {jiuzhouStudyShoreline} from './jiuzhou-courtyards.js';
import {jiuzhouEarthMeshName,jiuzhouLandscapeDesign,collectJiuzhouGroundFootprints,createJiuzhouGroundField} from './jiuzhou-landscape-field.js';
import {loadJiuzhouGravelTextures,loadJiuzhouMeadowTextures,createJiuzhouLandscapeMaterial} from './jiuzhou-landscape-material.js';

const activeSources=new WeakSet();
const equal=(a,b,tolerance=1e-7)=>a.length===b.length&&a.every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[i])<=tolerance);
const identity=new Matrix4().elements;
function assertUnitWorld(root){
  root.updateWorldMatrix(true,false);const e=root.matrixWorld.elements,a=new Vector3(e[0],e[1],e[2]),b=new Vector3(e[4],e[5],e[6]),c=new Vector3(e[8],e[9],e[10]);
  if(!e.every(Number.isFinite)||!equal([a.length(),b.length(),c.length(),a.dot(b),a.dot(c),b.dot(c),e[1],e[4],e[6],e[9],e[5],e[15]],[1,1,1,0,0,0,0,0,0,0,1,1])||root.matrixWorld.determinant()<0)throw new Error('Jiuzhou landscape requires the original metre scale and Y-up frame; only translation/yaw are allowed.');
}
function findEarth(source){
  if(source?.disposed||!source?.group?.isGroup||typeof source.dispose!=='function')throw new Error('Jiuzhou landscape needs a live original owner.');
  const found=[];source.group.traverse(node=>{if(node.name===jiuzhouEarthMeshName)found.push(node);});
  if(found.length!==1)throw new Error('Jiuzhou landscape requires exactly one original island earth mesh.');
  const mesh=found[0],g=mesh.geometry;
  if(!mesh.isMesh||mesh.isInstancedMesh||!g?.isBufferGeometry||!g.index||!g.attributes.position||!g.attributes.normal||!g.attributes.uv||mesh.material?.name!=='jiuzhou-garden-earth'||mesh.parent?.userData.body!=='local-island-foundation-and-layered-quay')throw new Error('Jiuzhou earth source contract changed.');
  g.computeBoundingBox();const b=g.boundingBox,x=jiuzhouStudyShoreline.map(p=>p[0]),z=jiuzhouStudyShoreline.map(p=>p[1]);
  if(!equal([...b.min.toArray(),...b.max.toArray()],[Math.min(...x),-.08,Math.min(...z),Math.max(...x),.025,Math.max(...z)],1e-5))throw new Error('Jiuzhou earth is not the original fine island surface.');
  return mesh;
}
async function prepareOriginal({signal}){
  signal.throwIfAborted();const {createJiuzhouStudy}=await import('./jiuzhou-study.js');signal.throwIfAborted();return createJiuzhouStudy();
}
// Passing sourceOwner borrows its source resources. Without it, exactly one
// original source is created and released after this private material lease.
export async function prepareJiuzhouLandscapeSource({signal,sourceOwner,prepareSource=prepareOriginal,loadGravel=loadJiuzhouGravelTextures,loadMeadow=loadJiuzhouMeadowTextures}={}){
  signal?.throwIfAborted();
  const lifetime=new AbortController(),owned=!sourceOwner,errors=[];
  let source=sourceOwner,earth=null,originalMaterial=null,gravel=null,meadow=null,field=null,material=null,disposed=false,registered=false,baseline=null;
  const run=fn=>{try{fn();}catch(error){errors.push(error);}};
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);
    // Restore the borrowed source before disposing any sampler it used.
    if(earth&&material&&earth.material===material)earth.material=originalMaterial;
    if(material)run(()=>material.dispose());
    if(field)run(()=>field.texture.dispose());
    if(meadow)run(()=>meadow.dispose());
    if(gravel)run(()=>gravel.dispose());
    if(registered){activeSources.delete(source);registered=false;}
    if(owned&&source)run(()=>source.dispose());
    run(()=>lifetime.abort(signal?.reason));
    if(errors.length)throw new AggregateError([...errors],'Jiuzhou landscape cleanup failed.');
  }
  const abort=()=>{try{dispose();}catch{/* exposed in cleanupErrors */}};
  signal?.addEventListener('abort',abort,{once:true});
  function adopt(value){
    if(disposed){run(()=>value?.dispose?.());throw signal?.reason??new DOMException('Jiuzhou landscape disposed','AbortError');}
    return value;
  }
  function assertBinding(){
    if(disposed||source.disposed)throw new Error('Jiuzhou landscape source was disposed.');
    assertUnitWorld(source.group);earth.updateWorldMatrix(true,false);
    const relative=new Matrix4().multiplyMatrices(new Matrix4().copy(source.group.matrixWorld).invert(),earth.matrixWorld);
    if(!equal(relative.elements,identity)||earth.parent!==baseline.parent||earth.parent.parent!==source.group||earth.geometry!==baseline.geometry||earth.material!==(material??originalMaterial)||earth.geometry.drawRange.start!==baseline.start||earth.geometry.drawRange.count!==baseline.count)throw new Error('Jiuzhou ground binding or placement changed.');
    for(const [key,record] of Object.entries(baseline.buffers)){
      const attribute=key==='index'?earth.geometry.index:earth.geometry.attributes[key];
      if(attribute!==record.attribute||!equal(attribute.array,record.values,0))throw new Error('Jiuzhou original ground buffer changed.');
    }
    if(gravel?.disposed||meadow?.disposed)throw new Error('Jiuzhou private landscape maps were released early.');
  }
  try{
    if(!source)source=adopt(await prepareSource({signal:lifetime.signal}));
    earth=findEarth(source);assertUnitWorld(source.group);
    if(activeSources.has(source))throw new Error('Jiuzhou source already has a landscape lease.');
    activeSources.add(source);registered=true;originalMaterial=earth.material;
    const buffers=Object.fromEntries([...Object.entries(earth.geometry.attributes),['index',earth.geometry.index]].map(([key,attribute])=>[key,{attribute,values:attribute.array.slice()}]));
    baseline={geometry:earth.geometry,parent:earth.parent,start:earth.geometry.drawRange.start,count:earth.geometry.drawRange.count,buffers};
    assertBinding();
    gravel=adopt(await loadGravel({signal:lifetime.signal}));meadow=adopt(await loadMeadow({signal:lifetime.signal}));assertBinding();
    const footprints=collectJiuzhouGroundFootprints(source.group),b=earth.geometry.boundingBox;
    field=createJiuzhouGroundField({footprints,outline:jiuzhouStudyShoreline,min:[b.min.x,b.min.z],max:[b.max.x,b.max.z]});
    material=createJiuzhouLandscapeMaterial({gravel,meadow,field});earth.material=material;assertBinding();
    const diagnostics={...source.diagnostics,landscape:{...jiuzhouLandscapeDesign,ownedSource:owned,sourceMesh:earth.name,sourceEarthTriangles:earth.geometry.index.count/3,field:field.diagnostics,gravel:gravel.manifest,meadow:meadow.files??null,materialLeaseCount:1,originalOtherMaterialsRetained:true,nativeReviewed:false}};
    return {group:source.group,collisionGroup:source.collisionGroup??source.group,sourceOwner:source,diagnostics,material,field,
      update(time){assertBinding();source.update?.(time);},
      assertBinding,dispose,get disposed(){return disposed;},get cleanupErrors(){return [...errors];}};
  }catch(error){
    try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Jiuzhou landscape preparation and cleanup failed.',{cause:error});}
    if(errors.length)throw new AggregateError([error,...errors],'Jiuzhou landscape preparation failed.',{cause:error});
    throw error;
  }
}
