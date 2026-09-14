export const REVIEW_ENHANCEMENT_BUDGET_MS=900000;

/** Internal review scheduling only. It never replaces or synthesizes a render. */
export function createReviewLoading({mode='progressive',canvas,signal,onFailure=()=>{},now=()=>performance.now(),schedule=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id),setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const staged=mode==='staged';let game=null,core=false,phase='core',deadline=null,timer=null,disposed=false,error=null;
  const clear=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
  const hold=()=>{if(game){cancel(game._animation);game._animation=null;}};
  const halt=()=>{hold();if(game){clearTimer(game._enhancementTimer);game._enhancementController?.abort(error);}};
  function fail(reason){
    if(!staged||disposed||error)return;error=reason instanceof Error?reason:new Error(String(reason));phase='failed';clear();halt();onFailure(error);
  }
  const contextLost=()=>fail(new Error('Graphics context lost during staged review'));
  function dispose(){if(disposed)return;disposed=true;clear();if(staged)halt();canvas?.removeEventListener?.('webglcontextlost',contextLost);signal?.removeEventListener('abort',dispose);game=null;}
  if(staged){canvas?.addEventListener?.('webglcontextlost',contextLost);signal?.addEventListener('abort',dispose,{once:true});if(signal?.aborted)dispose();}
  return {
    mode:staged?'staged':'progressive',
    get failed(){return Boolean(error);},
    metadata:()=>({mode:staged?'staged':'progressive',coreBudgetMs:180000,enhancementBudgetMs:staged?REVIEW_ENHANCEMENT_BUDGET_MS:null,continuousRenderingDuringEnhancement:!staged}),
    attach(value){
      if(!staged)return;
      if(disposed){value.dispose();return;}game=value;
      if(error){halt();return;}
      if(!core){fail(new Error('Staged loading requires a real core frame'));return;}
      hold();phase='enhancing';
    },
    progress(event){
      if(!staged||disposed||error)return;
      if(event.phase==='first-frame'){core=true;return;}
      if(event.phase==='enhancements-begin'){
        if(phase!=='enhancing'||!Number.isFinite(event.deadline)||event.deadline<=now()||event.deadline>now()+REVIEW_ENHANCEMENT_BUDGET_MS){fail(new Error('Invalid staged enhancement deadline'));return;}
        deadline=event.deadline;clear();timer=setTimer(()=>fail(new Error('Staged review enhancement/full-frame deadline exceeded')),Math.max(0,deadline-now()));
      }
      if(event.phase==='enhancements'){
        if(phase==='frame'||phase==='complete')return;
        if(event.enhancements!=='ready'||!game?.world.complete){fail(new Error(event.errors?.join('; ')||'Staged review enhancements failed'));return;}
        if(deadline===null||now()>=deadline){fail(new Error('Staged review enhancement/full-frame deadline exceeded'));return;}
        phase='frame';game._lastFrame=0;game._animation=schedule(game._tick);
      }
    },
    completeFrame(ready){
      if(!staged)return ready;
      if(disposed||error)return false;
      if(phase!=='frame'&&phase!=='complete')return false;
      if(!ready||deadline===null||now()>=deadline){fail(new Error(ready?'Staged review full-frame deadline exceeded':'Staged review full frame is degraded'));return false;}
      phase='complete';clear();return true;
    },
    fail,dispose,
  };
}
