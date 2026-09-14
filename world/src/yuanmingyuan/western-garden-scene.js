import * as THREE from 'three';
import {createWesternGardenPlantingLayout,createWesternGardenPlantingPlan,createWesternGardenPlantingRegion} from './western-garden-planting.js';
import {createWesternGardenPlantingSourceLoader} from './western-garden-planting-sources.js';
import {createMuseumPlantingColliders} from './museum-planting-colliders.js';

// A scene-owned transaction for explicitly selected, fully retained regions.
// Sources are never bound directly to pagehide: their borrowed views and
// colliders must be released first, including during a late asynchronous build.
export async function createWesternGardenScenePlanting({
  root,terrain,architecture,regionIds,plantingLayout=createWesternGardenPlantingLayout(),signal,onProgress=()=>{},
  createSources=createWesternGardenPlantingSourceLoader,createRegion=createWesternGardenPlantingRegion,
  createColliders=createMuseumPlantingColliders,
}={}){
  signal?.throwIfAborted();
  if(!root?.isObject3D||typeof architecture!=='function'||!Array.isArray(regionIds)||!regionIds.length||new Set(regionIds).size!==regionIds.length)throw new Error('Scene planting needs a root, live architecture dispatcher and unique explicit regions.');
  const support={
    get disposed(){return !architecture()||architecture().disposed;},
    intersectsGuideVolume(volume){const current=architecture();if(!current||current.disposed||typeof current.intersectsGuideVolume!=='function')throw new Error('The retained planting architecture is unavailable.');return current.intersectsGuideVolume(volume);},
  };
  // Reject bad positions before constructing even the first full source.
  for(const regionId of regionIds){
    const plan=createWesternGardenPlantingPlan({regionId,terrain,architecture:support,plantingLayout});
    if(!plan.valid){const error=new Error('Scene planting preflight rejected '+regionId);error.plan=plan;throw error;}
  }
  const lifetime=new AbortController(),group=new THREE.Group(),regions=[],cleanupErrors=[];
  group.name='western-garden-scene-planting';group.visible=false;
  let sourceOwner=null,collision=null,disposed=false,preparing=true,sourceReleased=false;
  const run=release=>{try{release();}catch(error){cleanupErrors.push(error);}};
  function releaseSources(){if(!sourceOwner||sourceReleased)return;sourceReleased=true;run(()=>sourceOwner.dispose());}
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',onAbort);
    lifetime.abort(signal?.reason??new DOMException('Scene planting disposed.','AbortError'));
    run(()=>group.removeFromParent());
    run(()=>collision?.dispose());
    for(const region of [...regions].reverse())run(()=>region.dispose());
    run(()=>group.clear());if(!preparing)releaseSources();
    if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Scene planting cleanup failed.');
  }
  const onAbort=()=>{try{dispose();}catch{/* Preparation/whenIdle expose cleanup failures; do not throw from abort dispatch. */}};
  const whenIdle=async()=>{
    await sourceOwner?.whenIdle();
    if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Scene planting asynchronous cleanup failed.');
  };
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();
  try{
    lifetime.signal.throwIfAborted();
    // Intentionally no lifetime signal; this transaction owns release order.
    sourceOwner=createSources({plantingLayout});
    for(const [index,regionId]of regionIds.entries()){
      onProgress({regionId,completed:index,total:regionIds.length});
      const prepared=await sourceOwner.prepareRegion(regionId,{signal:lifetime.signal});
      lifetime.signal.throwIfAborted();
      const region=await createRegion({regionId,terrain,architecture:support,sources:prepared.sources,plantingLayout,signal:lifetime.signal});
      if(disposed||lifetime.signal.aborted){region.dispose();lifetime.signal.throwIfAborted();}
      regions.push(region);group.add(region.group);
    }
    group.updateMatrixWorld(true);
    const parts=regions.flatMap(region=>region.collisionSources.parts);
    collision=createColliders({group,parts},{terrain,signal:lifetime.signal});
    lifetime.signal.throwIfAborted();
    for(const region of regions)region.assertCurrent();
    root.add(group);group.visible=true;
    onProgress({regionId:regionIds.at(-1),completed:regionIds.length,total:regionIds.length});
    lifetime.signal.throwIfAborted();preparing=false;
    return {
      group,regions,
      get collision(){return disposed?null:collision;},
      get disposed(){return disposed;},
      assertCurrent(){if(disposed)throw new Error('Scene planting disposed.');try{for(const region of regions)region.assertCurrent();return true;}catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Invalid scene planting cleanup failed.',{cause:error});}throw error;}},
      update(time){if(disposed)return false;return sourceOwner.update(time);},
      snapshot({full=false}={}){
        return {id:group.name,disposed,visible:group.visible&&!disposed,regionIds:[...regionIds],
          historicallySurveyed:false,nativeCompositionReviewed:false,
          sources:sourceOwner.snapshot(),collision:full?collision.diagnostics:{solidCount:collision.diagnostics.solidCount},
          regions:regions.map(region=>full?region.diagnostics:{id:region.plan.id,placements:region.parts.length,
            trianglesPerPass:region.diagnostics.trianglesPerPass,rootsChecked:region.diagnostics.rootsChecked,
            maximumRootGap:region.diagnostics.maximumRootGap,borrowedSourceInvalidated:region.diagnostics.borrowedSourceInvalidated}),
        };
      },
      whenIdle,dispose,
    };
  }catch(error){
    preparing=false;
    try{dispose();}catch{/* Every resource has been attempted; report the aggregate below. */}
    releaseSources();
    try{await sourceOwner?.whenIdle();}catch(cleanup){cleanupErrors.push(cleanup);}
    if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Scene planting preparation and cleanup failed.',{cause:error});
    throw error;
  }
}
