import {leaseDagRoadFoundationCaps} from './front-court-ground-seams.js';
import {Group} from 'three';
import {createPersistentEnsemble} from './persistent-ensemble.js';
import {placeMuseumStaticAsset} from './museum-static-batch.js';
import {createArchitectureSurface} from './architecture-surface.js';
import {createArchitectureEnsemble} from './architecture-ensemble.js';
import {createMuseumNavigation} from './visitor-motion.js';
import {gardenLayout} from './garden-layout.js';
import {frontCourtLayout as F,frontCourtSites,frontCourtMuseumViews} from './front-court-layout.js';
import {createFrontCourtLandscapePlan} from './front-court-landscape.js';
import {createFrontCourtPaving} from './front-court-paving.js';
const identity=n=>n&&n.position.lengthSq()===0&&n.quaternion.x===0&&n.quaternion.y===0&&n.quaternion.z===0&&n.quaternion.w===1&&n.scale.toArray().every(v=>v===1);
const count=d=>d.counts??{meshes:d.meshCount,triangles:d.triangleCount};
async function loadOriginal(site,{signal}){
 signal.throwIfAborted();let source;
 if(site.key==='dag'){const {createDagongmenStudy}=await import('./dagongmen-study.js');signal.throwIfAborted();source=createDagongmenStudy({signal,component:'entrance'});}
 else if(site.key==='erg'){const {createErgongmenStudy}=await import('./ergongmen-study.js');signal.throwIfAborted();source=createErgongmenStudy({signal});}
 else if(site.key==='hall'){const {createZhengdaGuangmingStudy}=await import('./zhengda-guangming-study.js');signal.throwIfAborted();source=createZhengdaGuangmingStudy({signal,component:'complete'});}
 else throw new Error('Unknown front-court source.');
 return source;
}
function wrapSource(source,site){
 const d=source?.diagnostics,counts=d&&count(d);
 if(!source?.group?.isGroup||source.group.parent||!identity(source.group)||source.group.name!==site.sourceId||d?.id!==site.sourceId||source.disposed||d.resources?.disposed||typeof source.dispose!=='function')throw new Error('Require original complete identity source for '+site.id);
 if(counts.meshes!==site.counts.meshes||counts.triangles!==site.counts.triangles)throw new Error('Full source counts changed for '+site.id);
 const road=site.key==='dag'?leaseDagRoadFoundationCaps(source):null;
 const group=new Group();group.name=site.id+' placement';group.add(source.group);let disposed=false;
 const assertCurrent=()=>{road?.assertCurrent();if(disposed||source.disposed||d.resources?.disposed||source.group.parent!==group||!identity(source.group))throw new Error('Source placement or lifetime changed: '+site.id);};
 return {group,source,diagnostics:d,groundSeams:road?.diagnostics??null,namedGroupRoot:source.group,assertCurrent,get disposed(){return disposed;},
  update(time){assertCurrent();source.update?.(time);},
  dispose(){if(disposed)return;disposed=true;const errors=[];for(const release of [()=>road?.dispose(),()=>source.dispose(),()=>group.removeFromParent(),()=>group.clear()])try{release();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Placed source cleanup failed');}
 };
}
export function createFrontCourtComposition({root,signal,layout=gardenLayout,load=loadOriginal,beforeDispose}={}){
 if(!root?.isObject3D||typeof load!=='function'||beforeDispose!==undefined&&typeof beforeDispose!=='function')throw new Error('Front court requires a root, loader and optional dependent release callback.');
 const group=new Group();group.name=F.id;const lifetime=new AbortController();
 let disposed=false,status='idle',operation=null,plan=null,paving=null,pavingSupport=null,aggregate=null,terrain=null,water=null,nav=null,lastError=null,cleanupError=null,updates=0;
 const ensemble=createPersistentEnsemble({root:group,descriptors:frontCourtSites,signal:lifetime.signal,place:placeMuseumStaticAsset,load:async(site,options)=>{
  const source=await load(site,options);
  try{options.signal.throwIfAborted();return wrapSource(source,site);}
  catch(error){try{source?.dispose?.();}catch(cleanup){throw new AggregateError([error,cleanup],'Front-court source rejection and release failed',{cause:error});}throw error;}
 }});
 ensemble.group.name='Front-court source buildings';
 function dispose(){
  if(disposed){if(cleanupError)throw cleanupError;return;}disposed=true;if(status!=='failed')status='disposed';signal?.removeEventListener('abort',onAbort);nav=null;terrain=null;water=null;
  const errors=[];
  for(const release of [()=>beforeDispose?.(),()=>aggregate?.dispose(),()=>pavingSupport?.dispose(),()=>paving?.dispose(),()=>ensemble.dispose(),()=>lifetime.abort(signal?.reason),()=>group.removeFromParent()])try{release();}catch(error){errors.push(error);}
  aggregate=null;pavingSupport=null;group.clear();
  if(errors.length){cleanupError=new AggregateError(errors,'Front-court cleanup failed');throw cleanupError;}
 }
 function fail(error){status='failed';lastError=String(error);try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Front-court operation and cleanup failed',{cause:error});}throw error;}
 const onAbort=()=>{try{dispose();}catch{/* retained in cleanupError */}};
 if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
 function assertCurrent(){
  if(disposed||!identity(group)||group.parent!==root)throw new Error('Front-court composition root is unavailable or moved.');
  group.updateWorldMatrix(true,true);
  const matrix=group.matrixWorld.elements;
  if(matrix.some((v,i)=>!Number.isFinite(v)||Math.abs(v-([0,5,10,15].includes(i)?1:0))>1e-7))throw new Error('Front-court world frame must remain at identity.');
  for(const site of frontCourtSites){
   const r=ensemble.get(site.id);if(!r||r.support.disposed)throw new Error('Missing real source support for '+site.id);
   r.owner.assertCurrent();const expected=[1,0,0,0,0,1,0,0,0,0,1,0,...site.position,1];
   if(r.owner.group.matrixWorld.elements.some((v,i)=>Math.abs(v-expected[i])>1e-7))throw new Error('Placed source world transform changed: '+site.id);
  }
  paving?.assertCurrent();
 }
 function prepare(){
  if(disposed)return Promise.reject(signal?.reason??new DOMException('Front court disposed','AbortError'));
  if(operation)return operation;status='loading';
  operation=(async()=>{try{
   plan=createFrontCourtLandscapePlan({layout});root.add(group);await ensemble.prepare();lifetime.signal.throwIfAborted();assertCurrent();
   paving=createFrontCourtPaving(ensemble.get(frontCourtSites[0].id).owner.source);group.add(paving.group);group.updateWorldMatrix(true,true);
   pavingSupport=createArchitectureSurface(paving.group,{signal:lifetime.signal});
   aggregate=createArchitectureEnsemble([{id:'complete-buildings',support:ensemble.support},{id:'contemporary-paving',support:pavingSupport}]);
   group.visible=false;status='prepared';return plan;
  }catch(error){return fail(error);}})();operation.catch(()=>{});return operation;
 }
 function bindScene({terrain:ground,water:sceneWater,dynamicColliders=()=>[]}={}){
  if(disposed||status!=='prepared'||terrain)throw new Error('Prepare front-court sources before binding its one scene terrain.');
  try{
   assertCurrent();
   if(!ground||ground.disposed||ground.diagnostics?.layoutId!==plan.layout.id||typeof ground.surfaceAt!=='function'||!sceneWater?.group?.isObject3D||sceneWater.snapshot?.().disposed)throw new Error('Terrain and water must belong to the returned front-court plan.');
   const candidateNavigation=createMuseumNavigation({terrain:ground,architecture:()=>aggregate,dynamicColliders});
   for(const view of Object.values(frontCourtMuseumViews)){
    const [x,y,z]=view.entry,landing=candidateNavigation.landing({x,y:y+2.4,z});
    if(!landing.valid||Math.abs(landing.y-y)>.04)throw new Error('Front-court entry lacks its actual retained stone support.');
   }
   terrain=ground;water=sceneWater;nav=candidateNavigation;status='ready';group.visible=true;
   return {sceneWaterUnmodified:true,sourceWaterSheets:0,sourceOwners:3};
  }catch(error){return fail(error);}
 }
 const navigation={
  landing(point){if(disposed||status!=='ready')return {valid:false,reason:'front-court-not-ready'};assertCurrent();return nav.landing(point);},
  walk(state,input,dt){if(disposed||status!=='ready')throw new Error('Front-court navigation is unavailable.');assertCurrent();return nav.walk(state,input,dt);}
 };
 return {group,sites:frontCourtSites,views:frontCourtMuseumViews,prepare,bindScene,bindWater:bindScene,dispose,navigation,
  get:id=>ensemble.get(id),getView(id){const v=frontCourtMuseumViews[id];if(!v)throw new Error('Unknown front-court view '+id);return v;},
  borrow(id,options){if(status!=='ready'||disposed)return Promise.reject(new Error('Front-court scene is not ready.'));return ensemble.borrow(id,options);},release:owner=>ensemble.release(owner),
  update(time){if(disposed||status!=='ready')return;try{assertCurrent();for(const site of frontCourtSites)ensemble.get(site.id).owner.update(time);updates++;}catch(error){return fail(error);}},
  async whenIdle(){try{await operation;}catch{}if(cleanupError)throw cleanupError;},
  get plan(){return plan;},get support(){return aggregate;},get paving(){return paving;},get disposed(){return disposed;},get cleanupError(){return cleanupError;},
  get snapshot(){return {id:F.id,status,disposed,sourceOwners:frontCourtSites.filter(s=>ensemble.get(s.id)).length,expectedSourceOwners:3,sourceGeometryUnchanged:false,sourceArchitecturalFormUnchanged:true,buriedRoadCapsReplacedByVisibleJoints:true,sourceWaterSheets:0,viewIds:Object.keys(frontCourtMuseumViews),ensemble:ensemble.snapshot,paving:paving?.diagnostics??null,updates,lastError,finalArtAccepted:false,centralErgRearDoorPassageForCurrentAvatar:false,centralDagDoorPassageForCurrentAvatar:false,contemporarySideLanes:true};}
 };
}
export function frontCourtViewLanding(composition,viewId){
 const view=composition.getView(viewId),[x,y,z]=view.entry,support=composition.navigation.landing({x,y:y+2.4,z});
 return support.valid?{valid:true,viewId,siteId:view.siteId,position:{x,y:support.y,z},support}:{valid:false,viewId,support,reason:support.reason};
}
