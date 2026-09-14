// Cadence belongs to Game's outer frame. Water can be drawn again by
// transmission or AO; those callbacks neither advance nor own this cadence.
export function createWaterReflectionController(water){
  const reflect=water.onBeforeRender;
  let active=null,lastSignature=null,canvas=null,disposed=false,refreshing=false;
  let outerFrames=0,elapsedFrames=0,refreshCalls=0,invalidation=0,consumedInvalidation=-1,lastReason=null;
  const invalidate=()=>{if(!disposed)invalidation++;};
  function bindCanvas(next){
    if(next===canvas)return;
    for(const event of ['webglcontextlost','webglcontextrestored'])canvas?.removeEventListener?.(event,invalidate);
    canvas=next;
    for(const event of ['webglcontextlost','webglcontextrestored'])canvas?.addEventListener?.(event,invalidate);
    invalidate();
  }
  water.onBeforeRender=function(renderer,scene,camera,...args){
    const frame=active;
    if(disposed||refreshing||!frame||renderer!==frame.renderer||scene!==frame.scene||camera!==frame.camera||scene.overrideMaterial)return;
    // Render wrappers can change the main camera after beginFrame. Read its
    // actual draw pose here, including when the reflection itself is reused.
    camera.updateWorldMatrix(true,false);
    water.material.uniforms.eye.value.setFromMatrixPosition(camera.matrixWorld);
    if(frame.refreshed)return;
    water.updateWorldMatrix(true,false);
    const environment=typeof frame.environment==='function'?frame.environment():frame.environment,texture=scene.environment;
    // Samples may be replaced every tick. Compare their exact generating state,
    // not sample identity or a movement threshold, at the eligible draw boundary.
    const signature=[renderer,scene,camera,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,...water.matrixWorld.elements,
      environment?.phase,environment?.lightingVariant,texture,texture?.version,scene.environmentIntensity,frame.revision];
    const changed=!lastSignature||signature.some((value,index)=>value!==lastSignature[index]);
    const reason=frame.force?'forced':!lastSignature?'initial':changed?'state':invalidation!==consumedInvalidation?'invalidated':elapsedFrames>=5?'cadence':null;
    if(!reason)return;
    const renderedInvalidation=invalidation;
    refreshing=true;
    try{
      // Retain stock Water's target, projection, clipping, HDR and state restore.
      // The first eligible transmission/main draw runs after the renderer's
      // shadow update, and later draws in this outer frame reuse the result.
      reflect.call(this,renderer,scene,camera,...args);
      if(disposed||active!==frame)return;
      lastSignature=signature;consumedInvalidation=renderedInvalidation;
      elapsedFrames=0;frame.refreshed=true;refreshCalls++;lastReason=reason;
    }finally{refreshing=false;}
  };
  return {
    beginFrame(renderer,scene,camera,environment,{revision=null,force=false}={}){
      if(disposed)return;
      bindCanvas(renderer.domElement);outerFrames++;elapsedFrames++;
      // A getter follows replacement daylight samples until the actual draw.
      active={renderer,scene,camera,environment,revision,force,refreshed:false};
    },
    endFrame(){active=null;},
    invalidate,
    snapshot(){return {outerFrames,refreshCalls,lastReason,invalidated:invalidation!==consumedInvalidation,active:Boolean(active),disposed};},
    dispose(){
      if(disposed)return;
      disposed=true;active=null;lastSignature=null;
      for(const event of ['webglcontextlost','webglcontextrestored'])canvas?.removeEventListener?.(event,invalidate);
      canvas=null;
    },
  };
}
