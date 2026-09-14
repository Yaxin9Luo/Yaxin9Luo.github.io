import {createPersistentEnsemble} from './persistent-ensemble.js';
import {createXianfaqiaoSitePatch,activateXianfaqiaoSitePatch,bindXianfaqiaoSourceWater} from './xianfaqiao-site-patch.js';
import {createMuseumLandscape} from './museum-landscape.js';
import {bindXieqiquFountainWater} from './xieqiqu-court-ground.js';
import {museumSite} from './museum-sites.js';
import {placeMuseumStaticAsset} from './museum-static-batch.js';
import {xianfaqiaoArchive} from './xianfaqiao-integration.js';

// The original two-site route optionally includes one complete Yangquelong
// garden. All sites retain the same owner/support ensemble and existing visit
// lifecycle; terrain, reflection water, renderer and scene remain borrowed.
export function createXianfaqiaoComposition({root,signal,load,court,yangquelong=null,beforeDispose}={}){
  if(typeof load!=='function')throw new Error('Xianfaqiao composition requires the actual full model loader');
  if(yangquelong!==null&&yangquelong!=='refined-r1')throw new Error('Unknown Yangquelong composition variant');
  const candidate=createXianfaqiaoSitePatch(),lifetime=new AbortController();
  // Align the existing [4,5,12] follow offset with the north court axis.
  const peerArrival=court==='garden-r4'?{arrival:[0,13,-55],viewYaw:Math.PI-Math.atan2(4,12)}:{arrival:[-48,10,-1.77]};
  const sites=[
    {...museumSite('xieqiqu'),...candidate.peerSite,...peerArrival,focus:[-26,5,17],guide:[-45,.04,-5]},
    {...candidate.site,arrival:[18.15,9.25,1.75],focus:[0,4,0],guide:[-43,-.48,6],viewYaw:Math.PI},
  ];
  if(yangquelong==='refined-r1')sites.push({...museumSite('yangquelong')});
  const ensemble=createPersistentEnsemble({root,descriptors:sites,signal:lifetime.signal,
    load:(site,{signal})=>load(site.assetId,{signal,...(site.id==='yangquelong'&&yangquelong==='refined-r1'?{beforeDispose:dispose}:{}),...(site.id==='xianfaqiao'?{manifestURL:xianfaqiaoArchive.manifestURL,expectedManifestSHA256:xianfaqiaoArchive.manifestSHA256}:{})}),
    place:placeMuseumStaticAsset,
  });
  let disposed=false,status='idle',active=null,plan=null,operation=null,waterBound=false,lastError=null,cleanupError=null;
  const restorers=[],identities=[];
  function restoreWater(){
    const errors=[];for(const restore of restorers.splice(0).reverse())try{restore();}catch(error){errors.push(error);}
    waterBound=false;if(errors.length)throw new AggregateError(errors,'Xianfaqiao composition water restoration failed');
  }
  function dispose(){
    if(disposed)return;disposed=true;if(status!=='failed')status='disposed';signal?.removeEventListener('abort',onAbort);
    const errors=[];
    // The scene releases borrowed dependents before any source support closes.
    // Restore source sheets before the source owner is removed. Ensemble closes
    // its aggregate/local queries before disposing the source supports/owners.
    for(const release of [()=>beforeDispose?.(),restoreWater,()=>ensemble.dispose(),()=>lifetime.abort(signal?.reason)])try{release();}catch(error){errors.push(error);}
    if(errors.length){lastError=errors.map(error=>error.message).join('; ');cleanupError=new AggregateError(errors,'Xianfaqiao composition cleanup failed');throw cleanupError;}
  }
  const onAbort=()=>{try{dispose();}catch{/* The cleanup error remains in diagnostics; abort dispatch must not throw. */}};
  if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
  function prepare(){
    if(disposed)return Promise.reject(signal?.reason??new DOMException('Composition disposed','AbortError'));
    if(operation)return operation;status='loading';
    operation=(async()=>{
      try{
        await ensemble.prepare();lifetime.signal.throwIfAborted();ensemble.group.visible=false;
        active=activateXianfaqiaoSitePatch(candidate,{admission:candidate.compositionReview.admission,bridge:ensemble.get('xianfaqiao'),peer:ensemble.get('xieqiqu')});
        plan=createMuseumLandscape({sites,readyAssetIds:['xieqiqu'],xianfaqiaoPatch:active});
        for(const site of sites){const {owner}=ensemble.get(site.id);identities.push({id:site.id,kind:owner.archive?'full-archive':'full-source-factory',archive:owner.archive?{id:owner.archive.id,glbSHA256:owner.archive.glbSHA256}:null,sourceAssetId:owner.diagnostics?.assetId??null});}
        status='prepared';return plan;
      }catch(error){lastError=error.message;status='failed';try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Xianfaqiao preparation and cleanup failed',{cause:error});}throw error;}
    })();return operation;
  }
  function bindWater({terrain,water}){
    if(disposed||status!=='prepared'||waterBound)throw new Error('Prepare the complete Xianfaqiao pair before its water handoff');
    try{
      restorers.push(bindXianfaqiaoSourceWater(active,{terrain,water}));
      restorers.push(bindXieqiquFountainWater(candidate.peerGround,{owner:ensemble.get('xieqiqu').owner,terrain,water}));
      if(yangquelong==='refined-r1'){
        const site=sites.find(site=>site.id==='yangquelong'),owner=ensemble.get(site.id).owner;
        if(typeof owner.bindWater!=='function')throw new Error('The complete Yangquelong museum owner must provide a reversible water lease');
        restorers.push(owner.bindWater({site,terrain,water}));
      }
      lifetime.signal.throwIfAborted();waterBound=true;status='water-ready';ensemble.group.visible=true;
    }catch(error){lastError=error.message;status='failed';try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Xianfaqiao water handoff and cleanup failed',{cause:error});}throw error;}
  }
  return {sites,candidate,prepare,bindWater,dispose,group:ensemble.group,
    get:id=>ensemble.get(id),get support(){return ensemble.support;},get plan(){return plan;},get disposed(){return disposed;},get cleanupError(){return cleanupError;},
    borrow(id,options){if(disposed||!waterBound)return Promise.reject(new Error('Xianfaqiao composition has no complete terrain/water handoff'));return ensemble.borrow(id,options);},
    release:owner=>ensemble.release(owner),
    update(time){
      if(disposed||!waterBound)return;
      try{for(const site of sites)ensemble.get(site.id)?.owner.update?.(time);}
      catch(error){
        lastError=error.message;status='failed';
        try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Xianfaqiao update and cleanup failed',{cause:error});}
        throw error;
      }
    },
    get snapshot(){return {id:yangquelong==='refined-r1'?'western-three-site-composition-r1':'xianfaqiao-xieqiqu-composition-r1',yangquelong,status,disposed,waterBound,nativeApproved:false,composedWorldApproved:false,
      placement:'modern exhibition design fitted to existing authored model edges',archiveManifestSHA256:xianfaqiaoArchive.manifestSHA256,
      identities:identities.map(identity=>({...identity})),ensemble:ensemble.snapshot,sitePatch:active?{id:active.id,admission:active.admission,metrics:active.metrics}:null,
      owners:sites.map(site=>{const record=ensemble.get(site.id);return {id:site.id,ready:!!record,visible:!!record&&record.owner.group.parent===ensemble.group&&record.owner.group.visible&&ensemble.group.visible,supportDisposed:record?.support.disposed??null,diagnostics:record?.owner.diagnostics??null};}),lastError};},
  };
}

// Only the approach's XZ is prescribed. The returned height/normal comes from
// the same live navigation landing routine as the ordinary B action.
export function xianfaqiaoRouteLanding(composition,nav){
  const [from,to]=composition.candidate.compositionReview.route.points;
  const approach={x:from[0],y:from[1]+4,z:from[2]},support=nav.landing(approach);
  if(!support.valid)return {valid:false,reason:support.reason,approach,support};
  const length=Math.hypot(to[0]-from[0],to[2]-from[2]);
  return {valid:true,approach,support,position:{x:approach.x,y:support.y,z:approach.z},direction:{x:(to[0]-from[0])/length,z:(to[2]-from[2])/length}};
}
