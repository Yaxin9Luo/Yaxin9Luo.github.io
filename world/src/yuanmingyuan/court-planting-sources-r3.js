import {createWesternGardenPlantingSourceLoader} from './western-garden-planting-sources.js';
import {courtBroadleafContract,assertCourtBroadleafContract} from './court-broadleaf-profile.js';
const abortError=()=>new DOMException('Court drift source owner disposed','AbortError');

// One source owner for the explicit R3 plan. The provided broadleaf API owns its
// download/decode/geometry resources; this bridge only owns that returned lease.
// Dispose garden views/colliders before this owner, as the real court owner does.
export function createCourtBandsR3Sources({plantingLayout,loadBroadleaf,createWestern=createWesternGardenPlantingSourceLoader,broadleafContract=courtBroadleafContract}={}){
 const contract=assertCourtBroadleafContract(broadleafContract),sourceReview=contract.review;
 const regions=plantingLayout?.regions;
 if(regions?.length!==1||!regions[0]?.id||!Array.isArray(regions[0].placements)||typeof loadBroadleaf!=='function'||typeof createWestern!=='function')throw new Error('One explicit court plan and full broadleaf loader are required');
 const regionId=regions[0].id,required=[...new Set(regions[0].placements.map(p=>p.species))];
 if(!required.includes('low-broadleaf')||required.some(id=>!['low-broadleaf','juniper','sedge','flower-shrub'].includes(id)))throw new Error('Unsupported court drift source plan');
 const oldSpecies=required.filter(id=>id!=='low-broadleaf');
 const western=oldSpecies.length?createWestern({plantingLayout:{regions:[{id:regionId,placements:oldSpecies.map(species=>({species}))}]}}):null;
 const lifetime=new AbortController(),released=new WeakSet(),cleanupErrors=[];
 let broadleaf=null,disposed=false,queue=Promise.resolve(),pending=0,built=0,requests=0,completed=0;
 function release(record){
  const source=record?.owner;if(!source||typeof source.dispose!=='function'||released.has(source))return;
  released.add(source);try{source.dispose();}catch(error){cleanupErrors.push(error);}
 }
 function dispose(){
  if(disposed)return;disposed=true;lifetime.abort(abortError());
  release(broadleaf);broadleaf=null;
  try{western?.dispose();}catch(error){cleanupErrors.push(error);}
  if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Court source cleanup failed');
 }
 function prepareRegion(id,{signal}={}){
  lifetime.signal.throwIfAborted();signal?.throwIfAborted();
  if(id!==regionId)throw new Error('Court source region does not match the frozen plan');
  const controller=new AbortController(),cancelRequest=()=>controller.abort(signal.reason),cancelOwner=()=>controller.abort(lifetime.signal.reason);
  signal?.addEventListener('abort',cancelRequest,{once:true});lifetime.signal.addEventListener('abort',cancelOwner,{once:true});
  if(signal?.aborted)cancelRequest();if(lifetime.signal.aborted)cancelOwner();
  pending++;requests++;
  const task=queue.then(async()=>{
   let candidate=null;
   try{
    controller.signal.throwIfAborted();
    const old=western?await western.prepareRegion(id,{signal:controller.signal}):{sources:{}};
    controller.signal.throwIfAborted();
    if(!broadleaf){
     candidate=await loadBroadleaf({signal:controller.signal});
     controller.signal.throwIfAborted();contract.assertRecord(candidate);
     broadleaf=Object.freeze(candidate);candidate=null;built++;
    }
    contract.assertRecord(broadleaf);controller.signal.throwIfAborted();
    const sources=Object.freeze({...old.sources,'low-broadleaf':broadleaf});completed++;
    return {regionId:id,sources,owner};
   }catch(error){
    controller.abort(error);release(candidate);
    if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Court source request and cleanup failed',{cause:error});
    throw error;
   }finally{
    pending--;signal?.removeEventListener('abort',cancelRequest);lifetime.signal.removeEventListener('abort',cancelOwner);
   }
  });
  queue=task.then(()=>{},()=>{});return task;
 }
 const owner={
  prepareRegion,dispose,get disposed(){return disposed;},
  update(time){
   if(disposed)return false;if(!Number.isFinite(time))throw new Error('Finite court source time required');
   if(broadleaf)contract.assertRecord(broadleaf);
   western?.update(time);broadleaf?.owner.update?.(time);return true;
  },
  async whenIdle(){await queue;await western?.whenIdle?.();if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Court source asynchronous cleanup failed');},
  snapshot(){
   const old=western?.snapshot?.();
   return {id:'court-bands-r3-source-bridge',regionId,disposed,pending,requests,completed,builtBroadleaf:built,historicallySurveyed:false,nativeCompositionReviewed:false,cleanupErrors:cleanupErrors.map(e=>String(e.message??e)),
    sources:[...(old?.sources??[]),...(broadleaf?[{species:'low-broadleaf',sourceStudyId:broadleaf.owner.diagnostics.id,sourceReview,triangles:broadleaf.owner.diagnostics.triangles}]:[])],western:old??null};
  },
 };
 return owner;
}
