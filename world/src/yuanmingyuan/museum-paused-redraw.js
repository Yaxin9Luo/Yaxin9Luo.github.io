/** Coalesces paused UI invalidations; the scene retains its animation loop.
 * render(0) must be synchronous and return whether it produced a fresh frame.
 * Call sync() when animation/visibility/availability changes, and flush()
 * immediately before a native readback. A native still capture may defer its
 * initial requests until flush(). This owner borrows all scene resources. */
export function createMuseumPausedRedraw({render,isPaused,canRender,deferUntilFlush=false,
  requestFrame=callback=>globalThis.requestAnimationFrame(callback),
  cancelFrame=id=>globalThis.cancelAnimationFrame(id),
}={}){
  for(const [name,callback] of Object.entries({render,isPaused,canRender,requestFrame,cancelFrame})){
    if(typeof callback!=='function')throw new TypeError(`Paused redraw requires ${name}()`);
  }
  let queued=null,disposed=false,drawing=false,deferred=deferUntilFlush;
  const available=()=>!disposed&&canRender();
  function cancel(){
    const previous=queued;queued=null;
    if(previous!==null)cancelFrame(previous.handle);
    return previous!==null;
  }
  function sync(){
    const usable=available(),paused=usable&&isPaused();
    if(usable&&!paused)deferred=false; // Resuming returns control to the existing animation loop.
    const eligible=paused&&!deferred;
    if(!eligible)cancel();
    return eligible;
  }
  function draw(releaseDeferred=false){
    if(!available()||drawing)return false;
    if(releaseDeferred)deferred=false;
    drawing=true;
    try{return render(0);}finally{drawing=false;}
  }
  function request(){
    if(!sync())return false;
    if(queued!==null)return true;
    // Identity, rather than only the RAF number, rejects a callback already
    // dequeued by the browser when cancellation or owner teardown occurred.
    const job={handle:null};queued=job;
    try{
      job.handle=requestFrame(()=>{
        if(queued!==job)return;
        queued=null;
        if(sync())draw();
      });
    }catch(error){if(queued===job)queued=null;throw error;}
    return true;
  }
  function flush(){cancel();return draw(true);}
  function dispose(){if(disposed)return;disposed=true;cancel();}
  return {request,flush,sync,cancel,dispose,get deferred(){return deferred;},get pending(){return queued!==null;},get disposed(){return disposed;}};
}
