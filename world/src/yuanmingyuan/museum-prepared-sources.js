// Decode source-owned courts before cutting their ground. The caller transfers
// each exact owner into the resident loader; an untaken owner stays ours.
export async function prepareMuseumGroundSources(descriptors,{load,signal}={}){
  if(!Array.isArray(descriptors)||typeof load!=='function')throw new Error('Ground preparation needs descriptors and a source loader');
  const ids=new Set();
  for(const descriptor of descriptors){
    if(typeof descriptor?.id!=='string'||!descriptor.id||ids.has(descriptor.id)||typeof descriptor.assetId!=='string'||!descriptor.assetId)throw new Error('Prepared source IDs must be unique');
    ids.add(descriptor.id);
  }
  const records=new Map(),seen=new WeakSet();let disposed=false;
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);
    const resources=[...records.values()];records.clear();const errors=[];
    for(const {owner} of resources)try{owner.dispose();}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Prepared museum source cleanup failed');
  }
  // Event callbacks cannot throw into an in-flight decoder. Preserve their
  // failures for that pending rejection and for an already returned pool.
  const cleanupErrors=[],abortCleanupErrors=[];
  function abort(){try{dispose();}catch(error){abortCleanupErrors.push(error);cleanupErrors.push(error.message??String(error));}}
  try{
    signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true});
    for(const descriptor of descriptors){
      signal?.throwIfAborted();const owner=await load(descriptor,{signal});
      if(owner&&typeof owner==='object'&&seen.has(owner))throw new Error('Prepared descriptors must own distinct source resources');
      if(disposed){
        // Abort already cleared earlier records. This late resource never
        // enters the closed pool, whose idempotent dispose cannot release it.
        try{if(owner?.disposed!==true)owner?.dispose?.();}catch(error){abortCleanupErrors.push(error);cleanupErrors.push(error.message??String(error));}
        signal?.throwIfAborted();throw new Error('Prepared museum sources are disposed');
      }
      if(!owner?.group?.isObject3D||typeof owner.dispose!=='function'||owner.disposed===true||owner.group.parent){
        try{if(owner?.disposed!==true)owner?.dispose?.();}catch(error){cleanupErrors.push(error.message??String(error));}
        throw new Error(`Prepared museum source is not a detached live owner: ${descriptor.id}`);
      }
      seen.add(owner);records.set(descriptor.id,{descriptor,owner});signal?.throwIfAborted();
    }
    signal?.throwIfAborted();
  }catch(error){
    const errors=[error,...abortCleanupErrors];
    try{dispose();}catch(cleanup){errors.push(cleanup);}
    if(errors.length>1)throw new AggregateError(errors,'Museum ground preparation and cleanup failed');
    throw error;
  }
  return {
    has(id){return !disposed&&records.has(id);},
    take(id){
      signal?.throwIfAborted();if(disposed)throw new Error('Prepared museum sources are disposed');
      const record=records.get(id);if(!record)throw new Error(`No prepared museum source: ${id}`);
      if(record.owner.disposed===true)throw new Error(`Prepared museum owner was disposed: ${id}`);
      records.delete(id);return record.owner;
    },
    get readyAssetIds(){return disposed?[]:[...records.values()].map(record=>record.descriptor.assetId);},
    get snapshot(){return {disposed,pending:[...records.values()].map(({descriptor})=>({id:descriptor.id,assetId:descriptor.assetId,manifestSHA256:descriptor.source?.approvedManifestSHA256??null})),cleanupErrors:[...cleanupErrors]};},
    dispose,
  };
}
