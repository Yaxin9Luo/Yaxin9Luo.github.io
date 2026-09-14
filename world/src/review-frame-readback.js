/** Review-only guard: Game commits drawnRevision after the composer wrapper returns. */
export function reviewFrameGuard({revision,snapshot,strict=true,assertLive}){
  return phase=>{
    assertLive();const state=snapshot();
    if(!Number.isSafeInteger(revision)||revision<0||!state)throw new Error('Capture revision is unavailable');
    if(phase==='submit'){
      if(state.requestedRevision!==revision||state.drawingRevision!==revision)throw new Error('Capture does not match the actual drawing revision');
    }else if(!Number.isSafeInteger(state.drawnRevision)||state.drawnRevision<revision){
      throw new Error('Captured drawing revision has not committed');
    }else if(strict&&(state.requestedRevision!==revision||state.drawnRevision!==revision)){
      throw new Error('Visual state was invalidated while capturing');
    }
  };
}

/** Submit the final default framebuffer copy in the current composer call stack.
 * No await precedes readPixels. Only the private PBO is read after yielding.
 * Pixels remain bottom-up raw RGBA; presentation/PNG encoding belongs elsewhere.
 * Infinity preserves the existing manual still's absence of an overall timeout.
 */
export function submitReviewFramebufferReadback({gl,canvas,width,height,guard,signal,deadline=Infinity,now=()=>performance.now(),schedule=setTimeout,cancelSchedule=clearTimeout}){
  let buffer=null,sync=null,timer=null,finished=false,resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const contextLost=()=>finish(new Error('Graphics context lost during readback'));
  const abort=()=>finish(signal.reason||new DOMException('Capture cancelled','AbortError'));
  function finish(error,result){
    if(finished)return;finished=true;
    if(timer!==null){cancelSchedule(timer);timer=null;}
    signal?.removeEventListener('abort',abort);canvas?.removeEventListener('webglcontextlost',contextLost);
    // A lost context may already have retired these objects; deletion is harmless.
    // Never reset the renderer or delete/rebind another owner's buffer here.
    try{if(sync)gl.deleteSync(sync);}catch(cause){error ||= cause;}finally{sync=null;}
    try{if(buffer)gl.deleteBuffer(buffer);}catch(cause){error ||= cause;}finally{buffer=null;}
    if(error)reject(error);else resolve(result);
  }
  function check(phase){
    signal?.throwIfAborted();
    if(gl.isContextLost())throw new Error('Graphics context lost during readback');
    if(now()>=deadline)throw new Error('Capture readback deadline exceeded');
    if(canvas.width!==width||canvas.height!==height||gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height)throw new Error('Native capture extent changed');
    guard(phase);
  }
  function checkError(stage){const code=gl.getError();if(code!==gl.NO_ERROR)throw new Error(`Capture ${stage} GL error 0x${code.toString(16)}`);}
  function next(){timer=schedule(poll,Math.min(4,Math.max(0,deadline-now())));}
  let attributes;
  function poll(){
    timer=null;if(finished)return;
    try{
      check('poll');const state=gl.clientWaitSync(sync,0,0);
      if(state===gl.TIMEOUT_EXPIRED){next();return;}
      if(state!==gl.ALREADY_SIGNALED&&state!==gl.CONDITION_SATISFIED)throw new Error('Capture fence wait failed');
      check('retrieve');const pixels=new Uint8Array(width*height*4),previous=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
      try{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,pixels);checkError('retrieval');}
      finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,previous);}
      check('complete');finish(null,{pixels,width,height,readback:{method:'default-framebuffer-PBO-fence',submittedBeforeYield:true,framebuffer:'default',readBuffer:'BACK',format:'RGBA',type:'UNSIGNED_BYTE',rowOrder:'bottom-up',bytes:pixels.byteLength,contextAttributes:attributes}});
    }catch(error){finish(error);}
  }
  try{
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(width*height*4)||!(Number.isFinite(deadline)||deadline===Infinity))throw new Error('Invalid native capture extent or deadline');
    if(gl.canvas!==canvas)throw new Error('Capture canvas does not own this graphics context');
    check('submit');checkError('preexisting');
    if(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)!==null||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null||gl.getParameter(gl.READ_BUFFER)!==gl.BACK)throw new Error('Capture requires the completed default framebuffer and BACK buffer');
    attributes={...gl.getContextAttributes()};
    const previous=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),pack=[gl.PACK_ALIGNMENT,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_PIXELS,gl.PACK_SKIP_ROWS].map(key=>[key,gl.getParameter(key)]);
    buffer=gl.createBuffer();if(!buffer)throw new Error('Capture pixel-pack allocation failed');
    try{
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);
      for(const [key]of pack)gl.pixelStorei(key,key===gl.PACK_ALIGNMENT?1:0);
      gl.bufferData(gl.PIXEL_PACK_BUFFER,width*height*4,gl.STREAM_READ);checkError('allocation');
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,0);checkError('submission');
    }finally{
      for(const [key,value]of pack)gl.pixelStorei(key,value);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,previous);
    }
    sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw new Error('Capture fence allocation failed');
    gl.flush();checkError('fence');
    // Always defer even an already-signaled fence until Game commits the frame.
    signal?.addEventListener('abort',abort,{once:true});canvas.addEventListener('webglcontextlost',contextLost,{once:true});
    if(signal?.aborted)abort();else next();
  }catch(error){finish(error);}
  return promise;
}
