import {prepareFrontCourtGroundSurface} from './front-court-ground-surface.js';
import {prepareFrontCourtPlanting} from './front-court-planting.js';

// Scene creates this synchronous handle before awaiting either dependency.
// Its composition.beforeDispose releases guides, then this handle, then the
// original support and building sources. It never owns terrain or buildings.
export function createFrontCourtMuseumLandscape({root,prepareGround=prepareFrontCourtGroundSurface,preparePlanting=prepareFrontCourtPlanting}={}){
 if(!root?.isObject3D||typeof prepareGround!=='function'||typeof preparePlanting!=='function')throw new Error('Front-court landscape needs the existing scene root and preparers.');
 const lifetime=new AbortController();let operation=null,ground=null,planting=null,terrain=null,composition=null,disposed=false,status='idle',cleanupError=null;
 const cleanupErrors=[];
 const cleanup=f=>{try{f();}catch(error){if(!cleanupErrors.includes(error))cleanupErrors.push(error);cleanupError=new AggregateError([...cleanupErrors],'Front-court museum landscape cleanup failed');}};
 function dispose(){
  if(disposed){if(cleanupError)throw cleanupError;return;}disposed=true;status='disposed';
  cleanup(()=>planting?.dispose());cleanup(()=>ground?.dispose());
  cleanup(()=>lifetime.abort(new DOMException('Front-court landscape released','AbortError')));
  if(cleanupError)throw cleanupError;
 }
 function take(owner){
  if(disposed||lifetime.signal.aborted){cleanup(()=>owner?.dispose());if(cleanupError)throw cleanupError;lifetime.signal.throwIfAborted();}
  return owner;
 }
 function assertCurrent(){
  if(disposed||status!=='ready'||terrain?.disposed||composition?.disposed||!composition?.support)throw new Error('Front-court landscape dependency is not live.');
  ground.assertCurrent();planting.assertCurrent();return true;
 }
 function prepare({terrain:existingTerrain,composition:existingComposition}={}){
  if(disposed)return Promise.reject(cleanupError??lifetime.signal.reason);
  if(operation){if(terrain!==existingTerrain||composition!==existingComposition)return Promise.reject(new Error('Front-court landscape cannot rebind its shared source.'));return operation;}
  terrain=existingTerrain;composition=existingComposition;status='preparing';
  operation=(async()=>{
   try{
    if(!terrain?.group||terrain.disposed||!composition?.support||composition.disposed)throw new Error('Prepare the original composition and terrain before its landscape.');
    ground=take(await prepareGround({terrain,composition,signal:lifetime.signal}));
    planting=take(await preparePlanting({root,terrain,architecture:composition.support,signal:lifetime.signal}));
    status='ready';assertCurrent();return api;
   }catch(error){
    try{dispose();}catch(cleanup){if(cleanup!==error)throw new AggregateError([error,cleanup],'Front-court museum landscape preparation failed');}
    throw error;
   }
  })();
  operation.catch(()=>{});return operation;
 }
 const api={prepare,dispose,assertCurrent,
  update(time){assertCurrent();planting.update(time);},
  get collision(){return disposed?null:planting?.collision??null;},
  get disposed(){return disposed;},get cleanupError(){return cleanupError;},
  async whenIdle(){try{await operation;}catch{}await planting?.whenIdle?.();if(cleanupError)throw cleanupError;},
  snapshot(){return {status,disposed,ground:ground?.diagnostics??null,planting:planting?.diagnostics??null,
   roadSeams:composition?.get('front-court-dag')?.owner.groundSeams??null,
   sharedTerrain:true,additionalBuildingOwners:0,additionalWaterOwners:0,contemporaryExhibition:true,fullCompositionArtAccepted:false};},
 };
 return api;
}
