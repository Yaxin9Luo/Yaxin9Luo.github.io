import {resourceError} from './resource-loader.js';

/** Availability and optional detail are independent; one core attempt has one deadline. */
export function createLoadingCoordinator({createCore,onChange=()=>{},now=()=>performance.now(),setTimeoutImpl=setTimeout,clearTimeoutImpl=clearTimeout,timeoutMs=20000}={}){
  let current=null,nextId=0,game=null;
  let state={attemptId:0,availability:'shell-ready',enhancements:'idle',phase:'shell',activeResource:null,receivedBytes:0};
  const update=patch=>{state={...state,...patch};onChange({...state});};
  function start(){
    if(game)return Promise.resolve(game);
    if(current)return current.promise;
    const attempt={id:++nextId,controller:new AbortController(),started:now()};current=attempt;
    const deadline=attempt.started+timeoutMs;
    update({attemptId:attempt.id,availability:'loading-core-3d',enhancements:'idle',phase:'engine',activeResource:null,receivedBytes:0,totalBytes:undefined,error:undefined,slow:false});
    const progress=event=>{
      if(attempt.controller.signal.aborted||state.attemptId!==attempt.id)return;
      if(state.availability==='interactive'){if(event.enhancements)update({enhancements:state.enhancements==='degraded'?'degraded':event.enhancements});return;}
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
    enhancement(event){if(state.availability!=='interactive')return;const failed=event.phase==='failed'||event.enhancements==='degraded';update({enhancements:failed?'degraded':state.enhancements==='degraded'?'degraded':event.enhancements||'loading-enhancements'});},
    dispose(){current?.controller.abort(resourceError('cancelled','Page closed'));game?.dispose?.();game=null;},
  };
}
