import {createXieqiquCourtGardenOwner} from './xieqiqu-court-garden-owner.js';
import {createXieqiquStudy} from './xieqiqu-study.js';
import {createXieqiquStoneFishPoolR9Study} from './xieqiqu-stone-fish-pool-r9-study.js';
import {createXieqiquR9FishIntegrationFromOwners} from './xieqiqu-r9-fish-integration-r1.js';

// Explicit R3 composition. The courtyard finishes first so the fish adapter
// records the final private paving material, not the old shared source material.
// A full layout and its loaders are required; no historical admission is inferred.
export async function createXieqiquCourtCompositionR3({
  layout,createSources,prepareGarden,fishPixels,signal,onProgress=()=>{},
  createCourt=createXieqiquCourtGardenOwner,loadBase=()=>createXieqiquStudy(),
  createPool=()=>createXieqiquStoneFishPoolR9Study({pixels:fishPixels}),
  combineFish=createXieqiquR9FishIntegrationFromOwners,decoratePaving,
}={}){
  signal?.throwIfAborted();
  if(!layout||typeof createSources!=='function'||typeof prepareGarden!=='function')
    throw new Error('A frozen courtyard plan and its complete source/material preparers are required');
  const work=new AbortController(),cleanupErrors=[];
  let court=null,pool=null,combined=null,paving=null,disposed=false;
  let courtReleased=false,poolReleased=false,combinedReleased=false,pavingReleased=false;
  const attempt=fn=>{try{fn();}catch(error){cleanupErrors.push(error);}};
  function releaseReady(){
    if(paving&&!pavingReleased){pavingReleased=true;attempt(()=>paving.dispose());}
    if(combined&&!combinedReleased){
      combinedReleased=true;courtReleased=true;poolReleased=true;
      attempt(()=>combined.dispose());
    }else if(!combined){
      if(pool&&!poolReleased){poolReleased=true;attempt(()=>pool.dispose());}
      if(court&&!courtReleased){courtReleased=true;attempt(()=>court.dispose());}
    }
  }
  function dispose(){
    if(!disposed){disposed=true;signal?.removeEventListener('abort',cancel);}
    releaseReady();
    work.abort(signal?.reason??new DOMException('Court composition released','AbortError'));
    if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Court composition cleanup failed');
  }
  function cancel(){try{dispose();}catch{/* Explicit disposal / whenIdle retain cleanup failures. */}}
  function retire(error,message){
    try{dispose();}catch{/* Cleanup failures are already recorded. */}
    const failures=cleanupErrors.filter(failure=>failure!==error);
    return failures.length?new AggregateError([error,...failures],message,{cause:error}):error;
  }
  function check(){work.signal.throwIfAborted();if(disposed)throw new DOMException('Court composition released','AbortError');}
  async function whenIdle(){
    const failures=[...cleanupErrors];
    try{await court?.whenIdle?.();}catch(error){failures.push(error);}
    if(failures.length)throw new AggregateError(failures,'Court composition cleanup failed');
  }
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    check();
    court=await createCourt({loadBase,layout,createSources,prepareGarden,signal:work.signal,onProgress});
    check();
    // No independent abort listener may destroy the court before its borrowed
    // fish mounts and private material decoration have been released.
    pool=await createPool({signal:work.signal});check();
    combined=combineFish({buildingOwner:court,poolOwner:pool});check();
    if(decoratePaving){paving=await decoratePaving({group:combined.group,signal:work.signal});check();if(!paving||typeof paving.dispose!=='function'||typeof paving.assertCurrent!=='function')throw new Error('Paving decoration must return a live guarded material lease');}
    court.assertCurrent();combined.validate();paving?.assertCurrent?.();
    const diagnostics={...combined.diagnostics,
      assemblyId:'xieqiqu-court-garden-composition-r3-candidate',
      publicAdmission:false,historicalLayoutVerified:false,
      courtGarden:court.diagnostics?.courtGarden??null,
      paving:paving?.diagnostics??null,
      releaseOrder:['private paving decoration','R9 mounts and source pool','court binding and soil','plant sources','original building'],
    };
    function assertCurrent(){
      try{check();court.assertCurrent();combined.validate();paving?.assertCurrent();return true;}
      catch(error){throw retire(error,'Court validation and cleanup failed');}
    }
    return {
      group:combined.group,collisionGroup:court.collisionGroup??combined.group,diagnostics,assertCurrent,
      get reviewSourceOwner(){return court;},
      update(time){
        if(disposed)return;
        assertCurrent();
        try{combined.update(time);}
        catch(error){throw retire(error,'Court update and cleanup failed');}
      },
      dispose,whenIdle,get disposed(){return disposed;},
      get invalidated(){return !!combined.invalidated;},
    };
  }catch(error){
    try{dispose();}catch{/* whenIdle reports every collected failure. */}
    try{await whenIdle();}catch(cleanup){throw new AggregateError([error,cleanup],'Court composition preparation failed',{cause:error});}
    throw error;
  }
}
