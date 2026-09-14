// This query owns only its memberships and local query indexes. The original
// architecture surfaces and their model owners remain with the ensemble owner.
export function createArchitectureEnsemble(records){
  if(!Array.isArray(records)||!records.length)throw new Error('Architecture ensemble requires explicit source records.');
  const entries=records.map(record=>({id:record.descriptor?.id??record.id,support:record.support})),locals=new Set();let disposed=false;
  if(new Set(entries.map(entry=>entry.id)).size!==entries.length||entries.some(entry=>typeof entry.id!=='string'||!entry.id||!entry.support||['surfaceAt','capsuleBlocked','intersectsGuideVolume','createGuideSupport'].some(key=>typeof entry.support[key]!=='function')))
    throw new Error('Architecture ensemble requires unique IDs and complete source surfaces.');
  const invalid=()=>{if(disposed)return true;for(const entry of entries)if(entry.support.disposed)return true;return false;};
  const highest=(sources,x,z,options)=>{let best=null;for(const source of sources){const hit=source.support.surfaceAt(x,z,options);if(hit&&(!best||hit.height>best.height))best=hit;}return best;};
  const releaseAll=(items,label)=>{const errors=[];for(const item of items)try{item.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,label);};
  function createGuideSupport(bounds,options={}){
    if(invalid())throw new Error('Architecture ensemble support is unavailable.');
    const queries=[];let released=false;
    try{for(const entry of entries)queries.push({id:entry.id,support:entry.support.createGuideSupport(bounds,options)});}
    catch(error){const errors=[error];try{releaseAll(queries.map(entry=>entry.support),'Partial ensemble guide cleanup failed');}catch(cleanup){errors.push(cleanup);}throw errors.length===1?error:new AggregateError(errors,'Ensemble guide preparation failed');}
    const local={
      surfaceAt(x,z,queryOptions){if(released||invalid())return null;return highest(queries,x,z,queryOptions);},
      snapshot:()=>({source:'grouped-source-architecture-queries',disposed:released,parentDisposed:invalid(),groups:queries.map(entry=>({id:entry.id,...entry.support.snapshot()}))}),
      dispose(){if(released)return;released=true;locals.delete(local);const owned=queries.splice(0).map(entry=>entry.support);releaseAll(owned,'Ensemble local guide cleanup failed');},
    };locals.add(local);return local;
  }
  return {
    surfaceAt(x,z,options){return invalid()?null:highest(entries,x,z,options);},
    capsuleBlocked(query){return invalid()||entries.some(entry=>entry.support.capsuleBlocked(query));},
    intersectsGuideVolume(volume){return invalid()||entries.some(entry=>entry.support.intersectsGuideVolume(volume));},
    createGuideSupport,
    dispose(){if(disposed)return;disposed=true;const owned=[...locals];locals.clear();try{releaseAll(owned,'Architecture ensemble query cleanup failed');}finally{entries.length=0;}},
    get disposed(){return disposed;},
    get diagnostics(){return {source:'actual-source-architecture-ensemble',disposed,sourceUnavailable:invalid(),localGuideSupports:locals.size,groups:entries.map(entry=>({id:entry.id,diagnostics:entry.support.diagnostics}))};},
  };
}
