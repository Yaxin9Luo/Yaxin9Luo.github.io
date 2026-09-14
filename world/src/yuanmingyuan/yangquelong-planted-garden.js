import * as THREE from 'three';
import {createYangquelongUnderstorey} from './yangquelong-understorey.js';
import {yangquelongGardenViews} from './yangquelong-garden-layout.js';

const defaultGarden=async options=>(await import('./yangquelong-garden-composition.js')).prepareYangquelongGardenComposition(options);
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong planted garden: '+message);};

/** Opt-in adapter. A supplied gardenOwner is borrowed in place; its parent,
 * transforms, resources and original diagnostics are never replaced.
 * prepareGarden can inject the private paving surface before ground binding.
 */
export async function prepareYangquelongPlantedGarden({
 signal,gardenOwner,prepareGarden=defaultGarden,
 createUnderstorey=createYangquelongUnderstorey,
}={}){
 signal?.throwIfAborted();const borrowed=Boolean(gardenOwner),controller=new AbortController(),errors=[],released=new Set();
 let garden=gardenOwner,understorey,disposed=false;
 const remember=e=>{if(!errors.includes(e))errors.push(e);};
 const release=owner=>{if(!owner||released.has(owner))return;released.add(owner);try{owner.dispose();}catch(e){remember(e);}};
 const releaseAll=()=>{release(understorey);if(!borrowed)release(garden);};
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);releaseAll();controller.abort(signal?.reason);
  if(errors.length)throw new AggregateError([...errors],'Planted garden cleanup failed');
 }
 function cancel(){try{dispose();}catch{/* whenIdle and preparation expose cleanup errors. */}}
 function guard(){signal?.throwIfAborted();controller.signal.throwIfAborted();fail(!disposed,'owner disposed');}
 async function whenIdle(){
  for(const owner of [understorey,...(borrowed?[]:[garden])])try{await owner?.whenIdle?.();}catch(e){remember(e);}
  if(errors.length)throw new AggregateError([...errors],'Planted garden cleanup failed');
 }
 function failed(error){try{dispose();}catch{/* combined below */}if(errors.length)throw new AggregateError([error,...errors],'Planted garden operation and cleanup failed',{cause:error});throw error;}
 function assertCurrent(){
  try{
   guard();fail(garden?.group?.isGroup&&garden.group.children.length&&!garden.disposed,'original garden must remain live');
   garden.assertCurrent();understorey.assertCurrent();fail(understorey.group.parent===garden.group,'planting attachment changed');return true;
  }catch(error){return failed(error);}
 }
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  if(!garden)garden=await prepareGarden({signal:controller.signal});guard();
  fail(garden?.group?.isGroup&&typeof garden.update==='function'&&typeof garden.assertCurrent==='function'&&typeof garden.dispose==='function','a complete prepared garden owner is required');
  garden.assertCurrent();
  fail(garden.group.position.lengthSq()===0&&garden.group.quaternion.equals(new THREE.Quaternion())&&garden.group.scale.equals(new THREE.Vector3(1,1,1)),'original garden coordinates must remain unchanged');
  understorey=createUnderstorey({signal:controller.signal});guard();garden.group.add(understorey.group);assertCurrent();
  let waterCount=0;garden.group.traverse(n=>{if(n.isMesh&&(Array.isArray(n.material)?n.material:[n.material]).some(m=>m?.userData?.category==='water'))waterCount++;});
  const diagnostics={
   id:'yangquelong-planted-garden-r1',assetId:'yangquelong-planted-garden-r1',evidence:'contemporary-museum-garden-design',historicallySurveyed:false,nativeReviewed:false,
   originalGarden:garden.diagnostics,understorey:understorey.diagnostics,
   meshCount:garden.diagnostics.meshCount+understorey.diagnostics.meshes,
   triangleCount:garden.diagnostics.triangleCount+understorey.diagnostics.triangleCount,
   waterCount,
   sourcePreservation:'The existing garden owner, four scale-1 pines, original architecture, all nine water surfaces and accepted maps are retained; only an independent low-planting group is attached.',
   ownership:{gardenBorrowed:borrowed,understoreyOwned:true,releaseOrder:['low planting instances','low planting source','owned garden only'],update:'one original garden.update(time) call'},
   limitations:['New low planting requires native bed and whole composition art review.','This is contemporary exhibition design, not a reconstruction of historical species or planting.'],
  };
  diagnostics.triangles=diagnostics.triangleCount;
  return {group:garden.group,gardenOwner:garden,understoreyOwner:understorey,diagnostics,views:yangquelongGardenViews,
   assertCurrent,update(time){assertCurrent();try{garden.update(time);}catch(error){failed(error);}},
   dispose,whenIdle,get disposed(){return disposed;},
  };
 }catch(error){
  try{dispose();}catch{/* Combined after a possible late owner releases. */}releaseAll();
  try{await whenIdle();}catch{/* Retained above. */}
  if(errors.length)throw new AggregateError([error,...errors],'Planted garden preparation and cleanup failed',{cause:error});
  throw error;
 }
}
export async function prepareYangquelongPlantedGardenFactory(options={}){
 const owner=await prepareYangquelongPlantedGarden(options);let consumed=false,discarded=false;
 const factory=()=>{options.signal?.throwIfAborted();fail(!consumed&&!discarded,'prepared factory is consumed or discarded');owner.assertCurrent();consumed=true;return owner;};
 factory.dispose=()=>{if(consumed||discarded)return;discarded=true;owner.dispose();};factory.whenIdle=()=>owner.whenIdle();return factory;
}
