// The terrain and full assets retain their own resource ownership. This small
// registry only chooses the complete source currently supporting each patch.
export function createMuseumTerrainAssets({terrain,replacements=[]}){
  if(!terrain||typeof terrain.activateReplacement!=='function'||typeof terrain.revertReplacement!=='function'||!Array.isArray(replacements))throw new Error('Terrain assets require a terrain owner and replacement descriptors');
  const records=new Map(),ids=new Set();
  for(const descriptor of replacements){
    if(typeof descriptor?.id!=='string'||!descriptor.id||typeof descriptor.assetId!=='string'||!descriptor.assetId||ids.has(descriptor.id)||records.has(descriptor.assetId))throw new Error('Terrain replacement IDs and asset IDs must be unique');
    ids.add(descriptor.id);records.set(descriptor.assetId,{descriptor,bindings:[],active:null,error:null});
  }
  let disposed=false,sequence=0;
  const alive=b=>b&&!b.released&&b.owner?.group?.isObject3D&&b.owner.disposed!==true&&b.owner.ready!==false&&b.support?.disposed!==true&&b.support?.ready!==false&&typeof b.support?.surfaceAt==='function';
  const ranked=bindings=>bindings.filter(alive).sort((a,b)=>(b.role==='primary')-(a.role==='primary')||b.sequence-a.sequence);
  function forget(binding){binding.released=true;if(binding.owner?.group)binding.owner.group.visible=false;binding.owner=null;binding.support=null;}
  function prune(record){record.bindings=record.bindings.filter(binding=>{if(alive(binding))return true;forget(binding);return false;});}
  function show(record){for(const binding of record.bindings)binding.owner.group.visible=binding===record.active;}
  function select(record,binding){
    if(binding){terrain.activateReplacement(record.descriptor.id,{owner:binding.owner,support:binding.support});record.active=binding;}
    else{terrain.revertReplacement(record.descriptor.id);record.active=null;}
  }
  function fail(record,error,candidates){
    const errors=[error];let restored=false;
    // A released binding is never a rollback target: its caller may dispose
    // the source immediately after unbind returns or throws.
    for(const binding of ranked(candidates))try{select(record,binding);restored=true;break;}catch(reason){errors.push(reason);}
    if(!restored){try{select(record,null);}catch(reason){errors.push(reason);record.active=null;}}
    record.error=errors.map(reason=>reason.message??String(reason)).join('; ');show(record);
    throw errors.length===1?error:new AggregateError(errors,`Terrain asset binding failed: ${record.error}`);
  }
  function attach({site,owner,support,role}={}){
    const record=records.get(site?.assetId);if(!record)return ()=>{};
    if(disposed||terrain.disposed)throw new Error('Terrain asset bindings have been disposed');
    const binding={siteId:site.id,owner,support,role,sequence:++sequence,released:false};
    prune(record);
    let attempted=null;
    try{
      if(!['primary','resident'].includes(role)||!alive(binding)||typeof owner.dispose!=='function')throw new Error('Terrain binding requires a ready full owner, source support and primary/resident role');
      if(record.bindings.some(other=>other.owner===owner))throw new Error('This full owner is already bound to the terrain replacement');
      const next=ranked([...record.bindings,binding])[0];if(next!==record.active){attempted=next;select(record,next);}
    }catch(error){if(owner?.group?.isObject3D&&!record.bindings.some(other=>other.owner===owner))owner.group.visible=false;return fail(record,error,record.bindings.filter(binding=>binding!==attempted));}
    record.bindings.push(binding);record.error=null;show(record);
    return function unbind(){
      if(binding.released)return;
      binding.released=true;record.bindings=record.bindings.filter(other=>other!==binding);prune(record);
      let attempted=null;
      try{
        const next=ranked(record.bindings)[0]??null;
        if(record.active!==next){attempted=next;select(record,next);}
        record.error=null;show(record);
      }catch(error){fail(record,error,record.bindings.filter(binding=>binding!==attempted));}
      finally{forget(binding);}
    };
  }
  function dispose(){
    if(disposed)return;disposed=true;const errors=[];
    for(const record of records.values()){
      try{if(record.active)select(record,null);}catch(error){record.error=error.message??String(error);record.active=null;errors.push(error);}
      finally{for(const binding of record.bindings)forget(binding);record.bindings=[];}
    }
    if(errors.length)throw new AggregateError(errors,'Terrain asset binding disposal failed');
  }
  return {attach,dispose,get disposed(){return disposed;},get snapshot(){return {disposed,replacements:[...records.values()].map(record=>({id:record.descriptor.id,assetId:record.descriptor.assetId,activeRole:record.active?.role??null,activeSiteId:record.active?.siteId??null,bindingCount:record.bindings.length,bindings:record.bindings.map(binding=>({siteId:binding.siteId,role:binding.role,active:binding===record.active})),error:record.error}))};}};
}
