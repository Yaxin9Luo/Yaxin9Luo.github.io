// Exact scene snippets; source SHA256 84a50bb8613ba9154ed3d3f5a173e3d303359fa2aac128bcbf1eb5a1baeb593f.
// Executed in VM by the focused redraw fixture; no full scene or GPU.
const paused=()=>disposed||contextLost||document.hidden||!ready||loading||capturing||reviewPaused||reader.isOpen||dialogs.some(id=>$(id).open);

function changeCamera(){cameraMode=(cameraMode+1)%3;frameVisitor();syncControls();render(0);}

function frameVisitor(){if(!controls)return;controls.minDistance=4;plantingReview=null;const p=state.position,offset=[[4,5,12],[7,75,14],[8,2,12]][cameraMode],yaw=currentSite?.viewYaw??currentSite?.rotationY??0,c=Math.cos(yaw),s=Math.sin(yaw);controls.target.set(p.x,p.y+1,p.z);camera.position.set(p.x+offset[0]*c+offset[2]*s,p.y+offset[1],p.z-offset[0]*s+offset[2]*c);controls.update();}

function render(dt){if(!ready||disposed||contextLost||document.hidden)return false;const sample=environment.update(dt,{paused:paused(),focus:controls.target,shadowSpan:85});document.body.dataset.night=String(sample.night>.5);audio.update({night:sample.night,reading:reader.isOpen||dialogs.some(id=>$(id).open),position:state.position,camera:camera.position,forward:camera.getWorldDirection(new THREE.Vector3()),speed:state.speed,time});water.update(time,sample,camera);const active=sites.resource;if(active&&residents?.get(sites.snapshot.siteId)?.owner!==active)active.update?.(time);residents?.update(time);residents?.evaluate({camera,renderer,additionalViews:water.reflectionViews?.(camera)??[]});renderer.shadowMap.needsUpdate=true;renderer.info.reset();rendering.render(dt);return true;}

function start(){last=0;if(!raf&&!paused())raf=requestAnimationFrame(tick);}

function setReviewPaused(value){reviewPaused=value;if(value){reviewFramesRemaining=0;reviewMotion=null;}keys.clear();touch.clear();cancelAnimationFrame(raf);raf=0;guides?.setPaused(reviewPaused);$('review-pause').textContent=reviewPaused?'继续动画 / Resume':'定格动画 / Freeze';$('review-pause').setAttribute('aria-pressed',String(reviewPaused));$('telemetry').textContent=JSON.stringify(evidence(),null,2);render(0);start();}

  controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=4;controls.maxDistance=3200;controls.minPolarAngle=.04;controls.maxPolarAngle=Math.PI*.87;controls.addEventListener('change',()=>{if(paused())render(0);});

if(query.has('review'))for(const [label,distance,height]of [['正觉寺远景 / Resident far',600,90],['正觉寺近景 / Resident near',200,45]]){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.addEventListener('click',()=>{
    const record=residents?.snapshot.full.find(entry=>entry.id==='zhengjuesi'&&entry.ready);
    if(!record?.bounds){message('尚未载入常驻建筑 / Resident building is not loaded.');return;}
    setReviewPaused(true);const {min,max}=record.bounds,x=(min[0]+max[0])*.5,z=(min[2]+max[2])*.5,y=(min[1]+max[1])*.5;
    controls.target.set(x,y,z);camera.position.set(x,y+height,z+distance);controls.update();render(0);$('telemetry').textContent=JSON.stringify(evidence(),null,2);
  });
  $('review-tools').insertBefore(button,$('capture'));
}

$('capture').addEventListener('click',async()=>{
  if(!ready||capturing||disposed)return;capturing=true;$('capture').disabled=true;document.body.dataset.capturing='true';syncControls();cancelAnimationFrame(raf);raf=0;keys.clear();touch.clear();
  try{if(!render(0))throw new Error('The scene is not available for a fresh native frame.');const frame=readNativeFrame(renderer,canvas),data=evidence({full:true});data.capture={readback:frame.readback,width:frame.width,height:frame.height};const name=`museum-world-${sourceTag}-${currentSite.id}-${Date.now()}-${++serial}`,json=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const blob=await encodeNativeFrame(frame);if(disposed)throw new Error('No native frame');
    for(const [ext,body]of [['png',blob],['json',json]]){const response=await fetch(`/__review_capture/${name}.${ext}`,{method:'POST',body,signal:controller.signal});if(!response.ok)throw new Error(`Capture HTTP ${response.status}`);}message(`已保存 / Saved ${name}.png + JSON`,10);
  }catch(error){if(!disposed)message(error.message,10);}finally{capturing=false;$('capture').disabled=false;document.body.dataset.capturing='false';syncControls();start();}
});
