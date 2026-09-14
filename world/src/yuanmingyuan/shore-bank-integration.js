import {createShoreBankStudy} from './shore-bank-study.js';
import {createShoreBankTerrainAdapter} from './shore-bank-terrain-adapter.js';
import {shoreBankStudyViews} from './shore-bank-study-views.js';

export const shoreBankR1Source=Object.freeze({
  path:'/assets/yuanmingyuan/shore-bank-r1/terrain-regions-000aa4437ef678361b282ba2f55b9e533f90295ae5c6f3f83dcbd841623225f1.json',
  sha256:'000aa4437ef678361b282ba2f55b9e533f90295ae5c6f3f83dcbd841623225f1',
  bytes:726905,sourceIdentity:'5deaa85c62d11679',schema:'yuanmingyuan-live-terrain-regions-v1',regions:3,probes:743,
});

/** Load only after the prepared planting owner has verified the original live
 * terrain. The adapter installs a new, explicit shore support state. This
 * wrapper owns study + adapter, while terrain and its textures stay borrowed. */
export async function loadShoreBankStudyR1({terrain,signal,fetcher=fetch,bedProfile='r1',pebbleLayout='r1',stoneMaterial}={}){
  signal?.throwIfAborted();
  if(!['r1','submerged-r2','curved-r4'].includes(bedProfile))throw new Error('Shore bank: unknown bed profile');
  if(!['r1','drifts-r3'].includes(pebbleLayout))throw new Error('Shore bank: unknown pebble layout');
  if(!terrain?.group?.isObject3D||terrain.disposed||!terrain.earthMaterial)throw new Error('Shore bank R1 needs a live terrain and its ground material');
  if(typeof fetcher!=='function')throw new Error('Shore bank R1 fetcher is unavailable');
  const controller=new AbortController(),cleanupErrors=[];let study=null,adapter=null,disposed=false,constructing=false,sourceSHA=null,snapshot=null;
  function release(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);controller.abort(signal?.reason);
    // Restore public terrain entry points before releasing their borrowed fine
    // geometry. Every cleanup is attempted, even if the previous owner throws.
    for(const resource of [adapter,study])if(resource)try{resource.dispose();}catch(error){cleanupErrors.push(error);}
  }
  function cancel(){
    controller.abort(signal?.reason);
    // A re-entrant abort inside a synchronous factory/activate callback must
    // wait for that call to return its owner before disposing study underneath
    // an as-yet-unreturned adapter. No new stage starts after this cancellation.
    if(!constructing)release();
  }
  function check(){controller.signal.throwIfAborted();if(terrain.disposed)throw new Error('Shore bank R1 terrain was disposed during loading');}
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const response=await fetcher(shoreBankR1Source.path,{signal:controller.signal});check();
    if(!response?.ok)throw new Error(`Shore bank R1 snapshot HTTP ${response?.status??'unavailable'}`);
    const bytes=await response.arrayBuffer();check();
    if(bytes.byteLength!==shoreBankR1Source.bytes)throw new Error(`Shore bank R1 snapshot byte length mismatch: ${bytes.byteLength} != ${shoreBankR1Source.bytes}`);
    sourceSHA=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');check();
    if(sourceSHA!==shoreBankR1Source.sha256)throw new Error('Shore bank R1 snapshot SHA-256 mismatch');
    snapshot=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(snapshot.schema!==shoreBankR1Source.schema||snapshot.sourceIdentity!==shoreBankR1Source.sourceIdentity||snapshot.regions?.length!==shoreBankR1Source.regions||snapshot.probes?.length!==shoreBankR1Source.probes)throw new Error('Shore bank R1 verified snapshot identity/schema does not match its descriptor');
    check();constructing=true;
    try{
      study=createShoreBankStudy({snapshot,earthMaterial:terrain.earthMaterial,bedProfile,pebbleLayout,stoneMaterial});check();
      adapter=createShoreBankTerrainAdapter({terrain,study});check();
      adapter.activate();check();
    }finally{constructing=false;}
    return {group:adapter.group,study,adapter,views:shoreBankStudyViews,
      dispose(){if(disposed)return;release();if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Shore bank R1 resource cleanup failed');},
      get diagnostics(){return {id:bedProfile==='curved-r4'?'shore-bank-curved-r4':pebbleLayout==='drifts-r3'?'shore-bank-drifts-r3':bedProfile==='r1'?'shore-bank-r1':'shore-bank-submerged-r2',bedProfile,pebbleLayout,disposed,sourcePath:shoreBankR1Source.path,sourceSHA,sourceBytes:shoreBankR1Source.bytes,sourceIdentity:snapshot.sourceIdentity,sourceRegions:snapshot.regions.map(r=>({...r})),sourceProbeCount:snapshot.probes.length,adapter:adapter.snapshot,study:{...study.diagnostics},cleanupErrors:cleanupErrors.map(error=>error.message??String(error)),supportIdentity:'explicit shore replacement; original complete-window terrain signature no longer applies',nativeReviewed:false,productionApproved:false};},
    };
  }catch(error){
    release();if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Shore bank R1 loading and cleanup failed',{cause:error});throw error;
  }
}
