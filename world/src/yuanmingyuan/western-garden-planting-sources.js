import {createWesternGardenPlantingLayout,westernGardenPlantingSourceReview} from './western-garden-planting.js';
import {setWillowSampling} from './willow-distance-sampling.js';

const vegetation=new Set(['juniper','willow','lake-rock']);
const understory=new Set(['sedge','fern','flower-shrub']);
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
const loadVegetationModule=()=>import('./garden-vegetation.js');
const loadUnderstoryModule=()=>import('./garden-understory-study.js');
const prepareStonePixels=async options=>(await import('./vegetation-textures.js')).prepareLakeStoneTexturePixels(options);
// R4 reviewed only the lake rock. The R2 report retained willow/juniper
// crowns while requiring further work on unrelated pine bark and rock.
const sourceReview=westernGardenPlantingSourceReview;
const abortError=()=>new DOMException('Western planting source owner disposed.','AbortError');
const identity=node=>node.position.x===0&&node.position.y===0&&node.position.z===0&&
  node.quaternion.x===0&&node.quaternion.y===0&&node.quaternion.z===0&&node.quaternion.w===1&&
  node.scale.x===1&&node.scale.y===1&&node.scale.z===1&&
  (node.matrixAutoUpdate||node.matrix.elements.every((v,i)=>v===(i%5===0?1:0)));

/** One scene-owned, lazy set of original full-resolution prototypes.
 * No source is built at construction. Requests are serialized, including after
 * cancellation, so a late asynchronous factory cannot overlap the next one.
 * A failed request disposes its newly built sources and retains previous ones.
 * The optional dependencies allow small actual-Three ownership fixtures;
 * production defaults call the existing source and verified pixel APIs.
 *
 * prepareRegion(id) returns {regionId,sources,owner}. Borrow sources in
 * createWesternGardenPlantingRegion; dispose all regional views/colliders
 * before this owner. update() belongs here, once per scene frame, not per
 * borrowing region. Original sources are currently static.
 *
 * The lifetime signal disposes the owner, whereas each request signal cancels
 * only that request. Synchronous source construction cannot be preempted; an
 * abort is checked before/after each source and a task yield between sources.
 * await whenIdle() after disposal if an import/decode/factory was pending.
 * The existing texture API retains decoded CPU pixels; GPU resources belong
 * exclusively to the individual source studies disposed by this owner.
 */
export function createWesternGardenPlantingSourceLoader({
  plantingLayout=createWesternGardenPlantingLayout(),signal,
  loadVegetation=loadVegetationModule,loadUnderstory=loadUnderstoryModule,
  prepareStone=prepareStonePixels,yieldControl=yieldFrame,
}={}){
  signal?.throwIfAborted();
  if(!Array.isArray(plantingLayout?.regions)||![loadVegetation,loadUnderstory,prepareStone,yieldControl].every(f=>typeof f==='function'))throw new Error('Invalid western planting source loader inputs.');
  const lifetime=new AbortController(),cache=new Map(),released=new WeakSet(),cleanupErrors=[];
  const stats={requests:0,completed:0,failed:0,built:0,disposedSources:0,updateCalls:0};
  let disposed=false,queue=Promise.resolve(),pending=0,activeRegion=null,staging=null;
  let vegetationFactory,understoryFactory;
  function release(studies){
    const errors=[];
    for(const study of studies)if(study&&typeof study.dispose==='function'&&!released.has(study)){
      released.add(study);stats.disposedSources++;
      try{study.dispose();}catch(error){errors.push(error);cleanupErrors.push(String(error?.message??error));}
    }
    return errors;
  }
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancelLifetime);
    lifetime.abort(signal?.aborted?signal.reason:abortError());
    const studies=[...cache.values()].map(record=>record.study);
    if(staging)studies.push(...staging.values());
    cache.clear();staging?.clear();vegetationFactory=understoryFactory=undefined;
    const errors=release(studies);
    if(errors.length)throw new AggregateError(errors,'Western planting source cleanup failed.');
  }
  function cancelLifetime(){try{dispose();}catch{/* Every cleanup was attempted; snapshot retains the errors. */}}
  function requiredSpecies(regionId){
    const matches=plantingLayout.regions.filter(region=>region.id===regionId);
    if(matches.length!==1||!Array.isArray(matches[0].placements)||!matches[0].placements.length)throw new Error('Unknown or invalid western planting region '+regionId);
    const required=[...new Set(matches[0].placements.map(p=>p.species))];
    if(required.some(id=>!vegetation.has(id)&&!understory.has(id)))throw new Error('Western planting region requests an unsupported source.');
    return required;
  }
  async function createSource(id,requestSignal){
    requestSignal.throwIfAborted();
    if(vegetation.has(id)){
      if(!vegetationFactory){
        const module=await loadVegetation();requestSignal.throwIfAborted();
        if(typeof module?.createGardenVegetationStudy!=='function')throw new Error('Missing original vegetation factory.');
        vegetationFactory=module.createGardenVegetationStudy;
      }
      const stone=id==='lake-rock'?await prepareStone({signal:requestSignal}):undefined;
      requestSignal.throwIfAborted();
      return vegetationFactory({specimens:[id],arrange:false,...(id==='lake-rock'?{texturePixels:{stone}}:{})});
    }
    if(!understoryFactory){
      const module=await loadUnderstory();requestSignal.throwIfAborted();
      if(typeof module?.createGardenUnderstoryStudy!=='function')throw new Error('Missing original understory factory.');
      understoryFactory=module.createGardenUnderstoryStudy;
    }
    return understoryFactory({specimens:[id],arrangement:'specimens',signal:requestSignal});
  }
  function validate(study,id){
    const parts=vegetation.has(id)?study?.specimens:study?.parts,part=parts?.[0];
    if(!study?.group?.isObject3D||typeof study.dispose!=='function'||study.disposed||study.group.parent||
      !Array.isArray(parts)||parts.length!==1||!part?.isObject3D||part.userData.id!==id||
      part.parent!==study.group||study.group.children.length!==1||!identity(study.group)||!identity(part))
      throw new Error('Expected one unplaced, independently owned original source: '+id);
    return part;
  }
  async function prepareRegion(regionId,{signal:requestSignal}={}){
    lifetime.signal.throwIfAborted();requestSignal?.throwIfAborted();
    const required=requiredSpecies(regionId),controller=new AbortController();
    const cancelRequest=()=>controller.abort(requestSignal.reason),cancelOwner=()=>controller.abort(lifetime.signal.reason);
    requestSignal?.addEventListener('abort',cancelRequest,{once:true});lifetime.signal.addEventListener('abort',cancelOwner,{once:true});
    // Recheck after subscribing, including non-native/test signal dispatch.
    if(requestSignal?.aborted)cancelRequest();if(lifetime.signal.aborted)cancelOwner();
    stats.requests++;pending++;
    const task=queue.then(async()=>{
      const staged=new Map();staging=staged;activeRegion=regionId;
      try{
        controller.signal.throwIfAborted();
        for(const id of required){
          controller.signal.throwIfAborted();
          if(cache.has(id))continue;
          const study=await createSource(id,controller.signal);
          // Never take ownership of a factory accidentally returning a cached
          // owner: rollback must not destroy another live region's source.
          if([...cache.values()].some(record=>record.study===study))throw new Error('Original factory reused a live source owner for '+id);
          staged.set(id,study);
          if(study&&typeof study.dispose==='function')stats.built++;
          controller.signal.throwIfAborted();const part=validate(study,id);
          // Fine colored leaves can cover an MSAA sample while the pixel centre
          // lies outside their triangle. Bound color/normal interpolation to
          // covered samples; preserve source geometry, texture and light values.
          if(id!=='lake-rock'){
            const materials=new Set();part.traverse(node=>{if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material?.isMeshStandardMaterial&&material.vertexColors)materials.add(material);});
            for(const material of materials)setWillowSampling(material,'centroid');
          }
          await yieldControl();controller.signal.throwIfAborted();
        }
        const sources={},prepared=new Map();
        for(const [id,study]of staged)prepared.set(id,{study,binding:Object.freeze({part:validate(study,id),owner,
          review:sourceReview(id)})});
        // Validate the whole transaction before publishing even its first ID.
        for(const [id,record]of prepared)cache.set(id,record);
        for(const id of required){
          sources[id]=cache.get(id).binding;
        }
        stats.completed++;return {regionId,sources:Object.freeze(sources),owner};
      }catch(error){
        // prepareLakeStoneTexturePixels loads three channels concurrently.
        // A rejected channel must also cancel this request's remaining ones.
        controller.abort(error);
        stats.failed++;const errors=release(staged.values());
        if(errors.length)throw new AggregateError([error,...errors],'Western planting source request and rollback failed.');
        throw error;
      }finally{
        staged.clear();staging=null;activeRegion=null;pending--;
        requestSignal?.removeEventListener('abort',cancelRequest);lifetime.signal.removeEventListener('abort',cancelOwner);
      }
    });
    queue=task.then(()=>{},()=>{});
    return task;
  }
  const owner={
    prepareRegion,
    update(timeSeconds){
      if(disposed)return false;
      if(!Number.isFinite(timeSeconds))throw new Error('Planting source time must be finite.');
      for(const {study}of cache.values())if(typeof study.update==='function'){study.update(timeSeconds);stats.updateCalls++;}
      return true;
    },
    snapshot:()=>({
      id:'western-garden-planting-sources-r1',disposed,pending,activeRegion,...stats,cleanupErrors:[...cleanupErrors],
      historicallySurveyed:false,nativeCompositionReviewed:false,
      sources:[...cache].map(([id,{study,binding}])=>({
        species:id,sourceStudyId:study.diagnostics?.id??null,sourceReview:binding.review,
        triangles:study.diagnostics?.subassemblies?.find(p=>p.id===id)?.triangles??study.diagnostics?.triangles??study.diagnostics?.triangleCount??null,
      })),
    }),
    get disposed(){return disposed;},
    whenIdle:()=>queue,
    dispose,
  };
  signal?.addEventListener('abort',cancelLifetime,{once:true});
  if(signal?.aborted)cancelLifetime();
  return owner;
}
