import {resourceError} from './resource-loader.js';

/** Availability and optional detail are independent; one core attempt has one deadline. */
export function createLoadingCoordinator({createCore,onChange=()=>{},now=()=>performance.now(),setTimeoutImpl=setTimeout,clearTimeoutImpl=clearTimeout,timeoutMs=20000}={}){
  let current=null,nextId=0,game=null;
  let baseEnhancementsComplete=false,enhancementsFailed=false;
  const pendingResources=new Set();
  let state={attemptId:0,availability:'shell-ready',enhancements:'idle',phase:'shell',activeResource:null,receivedBytes:0};
  const update=patch=>{state={...state,...patch};onChange({...state});};
  const updateEnhancements=(event,batch=false)=>{
    if(event.attemptId!==undefined&&event.attemptId!==state.attemptId)return;
    // Resource completion cannot replace Game's initial assembly completion signal.
    if(batch&&['ready','degraded'].includes(event.enhancements))baseEnhancementsComplete=true;
    if(['failed','cancelled'].includes(event.phase)||event.enhancements==='degraded')enhancementsFailed=true;
    const id=event.id||event.url;
    if(!batch&&id){
      if(['queued','fetching','parsing','retrying'].includes(event.phase))pendingResources.add(id);
      else if(['ready','failed','cancelled'].includes(event.phase))pendingResources.delete(id);
    }
    const enhancements=enhancementsFailed?'degraded':baseEnhancementsComplete&&pendingResources.size===0?'ready':'loading-enhancements';
    if(enhancements!==state.enhancements)update({enhancements});
  };
  function start(){
    if(game)return Promise.resolve(game);
    if(current)return current.promise;
    const attempt={id:++nextId,controller:new AbortController(),started:now()};current=attempt;
    baseEnhancementsComplete=false;enhancementsFailed=false;pendingResources.clear();
    const deadline=attempt.started+timeoutMs;
    update({attemptId:attempt.id,availability:'loading-core-3d',enhancements:'idle',phase:'engine',activeResource:null,receivedBytes:0,totalBytes:undefined,error:undefined,slow:false});
    const progress=event=>{
      if(attempt.controller.signal.aborted||state.attemptId!==attempt.id)return;
      if(state.availability==='interactive'){if(event.enhancements)updateEnhancements(event,true);return;}
      if(current===attempt)update({...event,attemptId:attempt.id,availability:'loading-core-3d'});
    };
    const aborted=new Promise(resolve=>attempt.controller.signal.addEventListener('abort',()=>resolve({cancelled:true}),{once:true}));
    const timer=setTimeoutImpl(()=>attempt.controller.abort(resourceError('timeout','Core deadline exceeded')),timeoutMs);
    const slowTimer=setTimeoutImpl(()=>{if(current===attempt)update({slow:true});},6000);
    const work=Promise.resolve().then(()=>{
      if(attempt.controller.signal.aborted)return null;
      return createCore({signal:attempt.controller.signal,onProgress:progress,deadline,attemptId:attempt.id});
    }).then(value=>{
      if(now()>=deadline&&!attempt.controller.signal.aborted)attempt.controller.abort(resourceError('timeout','Core deadline exceeded'));
      if(current!==attempt||attempt.controller.signal.aborted){value?.dispose?.();return null;}
      return {value};
    },error=>({error}));
    attempt.promise=Promise.race([work,aborted]).then(result=>{
      if(current!==attempt)return null;
      if(result?.value){game=result.value;update({availability:'interactive',phase:'interactive',activeResource:null,slow:false,error:undefined});return game;}
      const error=result?.error||attempt.controller.signal.reason||resourceError('cancelled','Core cancelled');
      attempt.controller.abort(error);
      update({availability:'static-only',phase:'static',activeResource:null,slow:false,error:{type:error.type||'initialization',status:error.status,elapsedMs:now()-attempt.started}});return null;
    }).finally(()=>{clearTimeoutImpl(timer);clearTimeoutImpl(slowTimer);if(current===attempt)current=null;});
    return attempt.promise;
  }
  return {
    start,get snapshot(){return {...state};},
    cancel(){current?.controller.abort(resourceError('cancelled','Core cancelled'));},
    enhancement(event){if(state.availability==='interactive')updateEnhancements(event);},
    dispose(){current?.controller.abort(resourceError('cancelled','Page closed'));game?.dispose?.();game=null;},
  };
}
