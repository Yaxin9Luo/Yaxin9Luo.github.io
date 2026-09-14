import * as THREE from 'three';
import {yangquelongGardenLayout,yangquelongGardenViews} from './yangquelong-garden-layout.js';
export {yangquelongGardenLayout,yangquelongGardenViews};
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong garden: '+message);};
const meshes=group=>{const out=[];group.traverse(n=>{if(n.isMesh)out.push(n);});return out;};
const triangles=nodes=>nodes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0);
const defaultSurface=async options=>(await import('./yangquelong-surface.js')).prepareYangquelongSurface(options);
const defaultPine=async options=>(await import('./spreading-pine-loader.js')).prepareSpreadingPineFactory(options);

export function assertReviewedGardenSources(surface,pine){
 const source=yangquelongGardenLayout.source,sm=meshes(surface.group),pm=meshes(pine.group);
 fail(surface.diagnostics?.surfaceId==='yangquelong-surface-r1'&&sm.length===source.surfaceMeshes&&triangles(sm)===source.surfaceTriangles,'complete reviewed surface required');
 fail(sm.filter(m=>m.material.userData?.category==='water').length===source.waters,'all nine original waters required');
 fail(pine.diagnostics?.id===source.pineId&&pm.length===source.pineMeshes&&triangles(pm)===source.pineTriangles,'complete reviewed pine source required');
 fail(pm.filter(m=>m.isInstancedMesh).length===8,'all eight original pine instance meshes required');
 fail(pm.every(m=>!m.isSkinnedMesh)&&pm.filter(m=>m.isInstancedMesh).every(m=>m.morphTexture===null),'reviewed rigid pine source required');
 fail(pine.diagnostics.bounds.min.every((x,i)=>Math.abs(x-source.pineBounds.min[i])<1e-9)&&pine.diagnostics.bounds.max.every((x,i)=>Math.abs(x-source.pineBounds.max[i])<1e-9),'reviewed full-size pine bounds required');
 return {surfaceMeshes:sm.length,surfaceTriangles:triangles(sm),pineMeshes:pm.length,pineTriangles:triangles(pm)};
}

/** Borrow immutable mesh geometry/materials and preserve every original
 * matrix, instance matrix and instance colour. Each cloned InstancedMesh owns
 * its copied per-instance buffers; release those before the prototype owner.
 */
export function createGardenPinePlacements(sourceGroup,placements){
 fail(sourceGroup?.isGroup&&sourceGroup.children.length,'live pine group required');
 const group=new THREE.Group();group.name='yangquelong-contemporary-pines';
 const roots=[],instanceMeshes=[];let disposed=false;
 function dispose(){
  if(disposed)return;disposed=true;const errors=[];
  for(const instance of instanceMeshes)try{instance.dispose();}catch(error){errors.push(error);}
  try{group.removeFromParent();group.clear();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Garden pine borrowers cleanup failed');
 }
 function clone(source,parent){
  const node=source.clone(false);
  if(node.isInstancedMesh)instanceMeshes.push(node);
  // Object3D.copy does not copy these hooks; preserve any original draw logic.
  for(const name of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'])if(source[name])node[name]=source[name];
  parent.add(node);
  for(const child of source.children)clone(child,node);
  return node;
 }
 try{
  const ids=new Set();
  for(const placement of placements){
   fail(!ids.has(placement.id)&&placement.scale===1&&placement.position.length===3&&placement.position.every(Number.isFinite)&&Number.isFinite(placement.yaw),'unique finite unscaled pine placement required');ids.add(placement.id);
   const root=new THREE.Group();root.name=placement.id;root.userData={...placement,evidence:yangquelongGardenLayout.evidence,historicalIndividual:false};
   root.position.fromArray(placement.position);root.rotation.y=placement.yaw;root.scale.setScalar(1);group.add(root);roots.push(root);clone(sourceGroup,root);
  }
  group.updateMatrixWorld(true);
  return {group,roots,instanceMeshes,dispose,get disposed(){return disposed;}};
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Garden pine clone and cleanup failed',{cause:error});}throw error;}
}

/** Only one complete surface and one complete pine factory are prepared.
 * External cancellation is owned here; dependencies receive a private signal
 * so borrowers release before the prototype and normal scene exit releases
 * trees before architecture. Dependency seams support bounded CPU fixtures.
 */
export async function prepareYangquelongGardenComposition({
 signal,prepareSurface=defaultSurface,preparePineFactory=defaultPine,
 validateSources=assertReviewedGardenSources,createPlacements=createGardenPinePlacements,
}={}){
 signal?.throwIfAborted();
 const controller=new AbortController(),group=new THREE.Group(),released=new Set(),errors=[];
 group.name='yangquelong-small-garden-composition-r1';
 group.userData={assetId:'yangquelong-garden-r1',evidence:yangquelongGardenLayout.evidence,historicallySurveyed:false,visualAcceptance:false,integrationAcceptance:false};
 let surface,pineFactory,pine,planting,disposed=false;
 const remember=e=>{if(!errors.includes(e))errors.push(e);};
 const release=owner=>{if(!owner||released.has(owner))return;released.add(owner);try{owner.dispose?.();}catch(e){remember(e);}};
 const releaseAll=()=>{release(planting);release(pine);release(pineFactory);release(surface);group.removeFromParent();group.clear();};
 const cleanupError=()=>errors.length?new AggregateError([...errors],'Yangquelong garden cleanup failed'):null;
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);
  try{releaseAll();}catch(e){remember(e);}
  controller.abort(signal?.reason);
  const error=cleanupError();if(error)throw error;
 }
 function cancel(){try{dispose();}catch{/* Preparation/whenIdle retain each cleanup error. */}}
 function guard(){signal?.throwIfAborted();controller.signal.throwIfAborted();fail(!disposed,'composition disposed');}
 async function whenIdle(){for(const owner of [pine,pineFactory,surface])try{await owner?.whenIdle?.();}catch(e){remember(e);}const error=cleanupError();if(error)throw error;}
 function failed(error){try{dispose();}catch{/* Combined below. */}if(errors.length)throw new AggregateError([error,...errors],'Garden operation and cleanup failed',{cause:error});throw error;}
 function assertCurrent(){
  try{guard();fail(pine?.group.children.length&&!planting?.disposed,'pine source and borrowers must remain live');surface.assertCurrent();return true;}
  catch(error){return failed(error);}
 }
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  surface=await prepareSurface({signal:controller.signal});guard();
  pineFactory=await preparePineFactory({signal:controller.signal});guard();
  pine=pineFactory();guard();
  const quality=validateSources(surface,pine);
  planting=createPlacements(pine.group,yangquelongGardenLayout.placements);guard();
  group.add(surface.group,planting.group);group.updateMatrixWorld(true);
  const diagnostics={
   assetId:'yangquelong-garden-r1',id:yangquelongGardenLayout.id,
   evidence:yangquelongGardenLayout.evidence,historicalPlantingVerified:false,
   visualAcceptance:false,integrationAcceptance:false,
   sourceSurface:surface.diagnostics,sourcePine:pine.diagnostics,
   placements:yangquelongGardenLayout.placements,sourceQuality:quality,
   meshCount:quality.surfaceMeshes+quality.pineMeshes*planting.roots.length,
   triangleCount:quality.surfaceTriangles+quality.pineTriangles*planting.roots.length,
   resourceOwnership:{surfaceFactories:1,pineFactories:1,geometryAndMaterials:'complete immutable source resources shared',instanceMeshes:planting.instanceMeshes.length,releaseOrder:['pine borrowers','pine source','surface'],externalAbort:'composition owns cancellation; private signal reaches dependencies after its owned release'},
   limitations:['Contemporary authored planting, not historically surveyed species, count or placement.','Complete combined native art acceptance remains pending.','Surface update may invalidate its own independent resources before this owner receives an error; pine borrowers always release before pine source.'],
  };
  diagnostics.triangles=diagnostics.triangleCount;
  return {group,diagnostics,views:yangquelongGardenViews,surfaceOwner:surface,pineSourceOwner:pine,plantingOwner:planting,
   assertCurrent,update(time){assertCurrent();try{surface.update(time);}catch(error){failed(error);}},
   dispose,whenIdle,get disposed(){return disposed;},get cleanupError(){return cleanupError();}};
 }catch(error){
  try{dispose();}catch{/* Combined after late handles also release. */}
  try{releaseAll();}catch(e){remember(e);}
  try{await whenIdle();}catch{/* Errors retained. */}
  if(errors.length)throw new AggregateError([error,...errors],'Garden preparation and cleanup failed',{cause:error});
  throw error;
 }
}

export async function prepareYangquelongGardenCompositionFactory(options={}){
 const owner=await prepareYangquelongGardenComposition(options);let consumed=false,discarded=false;
 const factory=()=>{options.signal?.throwIfAborted();fail(!consumed&&!discarded,'prepared factory already consumed or disposed');owner.assertCurrent();consumed=true;return owner;};
 factory.dispose=()=>{if(consumed||discarded)return;discarded=true;owner.dispose();};
 factory.whenIdle=()=>owner.whenIdle();
 return factory;
}
