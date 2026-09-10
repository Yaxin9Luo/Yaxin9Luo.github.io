import * as THREE from 'three';
import {Game} from './game.js';
import {resourceLoader} from './resource-loader.js';
import {ReviewMetrics,evidenceFilename} from './review-metrics.js';
import {LIGHTING_REVIEW_VARIANTS} from './environment-time.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas');
const warmupMs=3500,files=[],controlIds=['measure','record','audition','view','light','quality','foliage','sampling','reduced-motion','lighting-variant','phase-start','reset','frame','sound','json'];
let game,metrics,session=null,run=0,lastReport=null,pose=null,saveFrame=null,audition=-1,stage=-1,disposed=false,fullReady=false,renderFailed=false,lightingStudyRequested=false;
const lifetime=new AbortController(),loadStart=performance.now(),milestones=[],resourceFailures=new Map(),frameMilestones={};
function milestone(label){milestones.push(`${((performance.now()-loadStart)/1000).toFixed(1)}s · ${label}`);if(milestones.length>28)milestones.shift();$('loading').textContent=milestones.join('\n');$('latest-load').textContent=label;$('load-times').textContent=Object.entries(frameMilestones).map(([name,seconds])=>`${name}: ${seconds}s`).join(' · ');$('loading').scrollTop=$('loading').scrollHeight;}
function loadProgress(event){
  if(disposed)return;
  if(event.phase==='render-error'){
    renderFailed=true;fullReady=false;saveFrame=null;document.body.dataset.ready='degraded';milestone(`Render failed · ${event.activeResource}`);if(game)setLocked(true);
    const current=session;if(current){
      const reason=`render-error: ${event.activeResource}`;current.completed=false;current.reason=reason;
      // Shader callbacks occur inside render(). Let its GPU query close before
      // finalizing the invalid run and releasing the recorder's final chunks.
      void Promise.resolve().then(()=>{if(session===current)return stop(reason);});
    }
    return;
  }
  if(event.phase==='first-frame'){frameMilestones.core=((performance.now()-loadStart)/1000).toFixed(1);document.body.dataset.ready='core';milestone('Core first frame rendered; full scene assembling');}
  else if(event.phase==='full-frame'){
    frameMilestones.full=((performance.now()-loadStart)/1000).toFixed(1);
    fullReady=!renderFailed&&event.enhancements==='ready'&&game?.world.complete===true&&resourceFailures.size===0;document.body.dataset.ready=fullReady?'true':'degraded';
    milestone(`Full frame rendered · ${fullReady?'ready':'degraded'} · ${resourceFailures.size} failed resources`);
    if(game){$('foliage').value=!lightingStudyRequested&&game.world.vegetation?.lodController?'lod':'full';resetScene();setLocked(!fullReady);}
    status(fullReady?'完整场景首帧已就绪；测量包含 3.5 秒预热。':`Full scene degraded; measurement disabled. ${event.errors?.join('; ')||[...resourceFailures.values()].join('; ')}`);
  }else{milestone(`${event.phase}${event.region?' · '+event.region:''}${event.activeResource?' · '+event.activeResource:''}${event.enhancements?' · '+event.enhancements:''}${event.assemblyMs?' · '+event.assemblyMs.toFixed(0)+'ms':''}`);}
}
const unsubscribeResources=resourceLoader.subscribe(event=>{
  if(disposed)return;
  if(event.phase==='failed')resourceFailures.set(event.id,`${event.id}: ${event.type}`);
  if(event.phase==='ready')resourceFailures.delete(event.id);
  if(['queued','parsing','ready','failed','retrying'].includes(event.phase))milestone(`${event.phase} · ${event.id}${event.type?' · '+event.type:''}`);
});
// Diagnostic eyes stay inside playable bounds x ±170, z ±158, ceiling 130.
const poses={arrival:{eye:[38,25,92],target:[8,9,38]},'castle-forecourt':{eye:[34,19,23],target:[0,9,0]},conservatory:{eye:[42,13,36],target:[55,9,22]},'conservatory-interior':{eye:[55,8.4,25],target:[55,8.8,18.5]},'arcade-passage':{eye:[21.44,0,10.5],eyeHeight:1.7,target:[21.44,9.4,1.2]},'water-garden':{eye:[-27,13,56],target:[-44,7.6,47]},'west-edge':{eye:[-150,95,70],target:[0,14,-40]},'east-edge':{eye:[150,95,70],target:[0,14,-40]},'high-flight':{eye:[0,125,110],target:[0,24,-60]},cherry:{eye:[-45,17,85],target:[-73,9,66]},lilac:{eye:[69,17,97],target:[48,10,77]},highlands:{eye:[130,94,184],target:[-2,44,-40]},court:{eye:[30,27,79],target:[0,10,28]},overview:{eye:[130,162,180],target:[-2,12,-4]},bridge:{eye:[-27,26,-23],target:[-65,5,-53]},shore:{eye:[93,4,115],target:[45,2,73]},
  'castle-footing':{eye:[39,16,-8],target:[27,9,-24]},'contact-bridge':{eye:[59,15,-23],target:[52,3,-42]},'shore-detail':{eye:[111,6,16],target:[99,-2,2]}};
const status=text=>{$('status').textContent=text;};
async function download(blob,name){
  const url=URL.createObjectURL(blob);files.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.textContent=name;$('media').append(a);a.click();
  if(import.meta.env.DEV){
    try{const response=await fetch(`/__review_capture/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);a.append(' · saved to local evidence');}
    catch(error){a.append(` · local save failed: ${error.message}`);return error.message;}
  }
  return null;
}
function reviewStartPhase(){const value=$('phase-start').value;if($('light').value!=='auto'||value.trim()==='')return null;const phase=Number(value);return Number.isFinite(phase)&&phase>=0&&phase<1?phase:null;}
function conditions(){return {build:document.documentElement.dataset.build||'current',view:$('view').value,timeOfDay:$('light').value,quality:$('quality').value,foliage:$('foliage').value,sampling:$('sampling').value,reducedMotion:Boolean($('reduced-motion').checked),lightingVariant:$('lighting-variant').value,startPhase:reviewStartPhase(),sound:Boolean(game.options.sound)};}
function reviewFilename(metadata,kind,extension){const phase=Number.isFinite(metadata.startPhase)?`-p${metadata.startPhase.toFixed(4).replace('.','p')}`:'';return `lighting-${metadata.lightingVariant||'baseline'}${phase}-${evidenceFilename(metadata,kind,extension)}`;}
function lightingSnapshot(){
  const e=game.environment;if(!e)return{available:false};
  const sky=game.world.atmosphere?.root.getObjectByName('Authored day and night cloud sky');
  return{variant:e.lightingVariant,solarAzimuthDegrees:e.solarAzimuthDegrees,keyHandoff:e.keyHandoff,phase:e.phase,night:e.night,skyTime:sky?.material.uniforms.skyTime.value??null,
    fill:{colorLinear:(game.fillLight?.color??e.fill).toArray(),intensity:game.fillLight?.intensity??e.fillIntensity,position:game.fillLight?.position.toArray()??null},
    key:{colorLinear:(game.keyLight?.color??e.key).toArray(),intensity:game.keyLight?.intensity??e.keyIntensity,direction:e.lightDirection.toArray(),sunDirection:e.sunDirection.toArray(),position:game.keyLight?.position.toArray()??null,target:game.keyLight?.target.position.toArray()??null,shadowIntensity:game.keyLight?.shadow.intensity??e.shadowIntensity},
    ambient:{skyLinear:(game.ambientLight?.color??e.sky).toArray(),groundLinear:(game.ambientLight?.groundColor??e.ground).toArray(),intensity:game.ambientLight?.intensity??e.ambientIntensity},exposure:game.renderer.toneMappingExposure??e.exposure,
    environmentMap:{bound:Boolean(game.scene?.environment),intensity:game.scene?.environmentIntensity??null}};
}
function setLocked(locked){for(const id of controlIds)$(id).disabled=locked||(id==='json'&&!lastReport)||(id==='foliage'&&!game.world.vegetation?.lodController);}
function clearInput(){game.setTouch(0,0);for(const key of ['boost','up','down','fire'])game.setControl(key,false);}
function resetScene(config=conditions()){
  lastReport=null;$('json').disabled=true;
  clearInput();game.leaveExhibit();game.returnHome();game.start();
  game.setOption('reducedMotion',config.reducedMotion);game.setOption('timeOfDay',config.timeOfDay);game.setOption('quality',config.quality);
  // Review captures must match their selected label on the very next frame.
  // Gameplay retains its normal 2.4-second clock transition.
  game.environmentClock.setLightingReviewVariant(config.lightingVariant||'baseline');game.environmentClock.setMode(config.timeOfDay,true);
  if(config.timeOfDay==='auto'&&Number.isFinite(config.startPhase))game.environmentClock.phase=config.startPhase;
  game._updateEnvironment(0);
  game.world.vegetation?.lodController?.setEnabled(config.foliage==='lod');
  game._teleport(18,18,74);game.heading=.35;game.cameraYaw=.35;game.setCameraView('follow');game.setOption('gameplay',false);
  pose=poses[config.view]||null;
  if(config.view==='exhibit')game.enterExhibit('autodesign');
  if(config.view==='flight'){game._teleport(18,27,74);game.setOption('gameplay',true);}
  if(config.view==='ground'){game._teleport(-66,9,65);game.heading=0;game.cameraYaw=0;game.setOption('gameplay',true);game.toggleBroom();}
  game.world.updateVegetation?.(game.camera,{width:canvas.width,height:canvas.height});
  game.renderer.shadowMap.needsUpdate=true;stage=-1;
}
function reset(){if(session||disposed)return;resetScene();}
function frameState(){return {canvas:{width:canvas.width,height:canvas.height,backingWidth:canvas.width,backingHeight:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:game.renderer.getPixelRatio(),nativeDpr:globalThis.devicePixelRatio||1,msaaSamples:game.rendering.samples},camera:{eye:game.camera.position.toArray(),target:pose?.target||null,fov:game.camera.fov},rider:{position:game.position?.toArray(),mode:game.locomotion?.mode,speed:game.locomotion?.groundSpeed},lighting:lightingSnapshot()};}
function applySampling(){
  const sampling=session?.metadata.sampling||$('sampling').value,dpr=sampling==='2x'?2:sampling==='2.5x'?2.5:null;
  if(dpr!==null){
    const width=game._width||canvas.clientWidth,height=game._height||canvas.clientHeight;
    game._dpr=dpr;game.renderer.setPixelRatio(dpr);game.renderer.setSize(width,height,false);game.rendering.resize(width,height,dpr);
  }
  const size=frameState().canvas;
  $('sampling-size').textContent=`${size.cssWidth} × ${size.cssHeight} CSS → ${size.width} × ${size.height} px · DPR ${size.dpr}`;
}
function acquire(kind){
  if(session||disposed||!fullReady)return null;
  const current={id:++run,kind,phase:'preparing',metadata:conditions(),createdAt:new Date().toISOString(),requestedAt:performance.now(),startedAt:null,stoppedAt:null,expectedDurationMs:kind==='measure'?20000:24000,captureErrors:[],motionSamples:[]};
  session=current;setLocked(true);saveFrame=null;metrics.reset();resetScene(current.metadata);audition=-1;
  status(kind==='audition'?'准备声音资产…':'准备验收…');return current;
}
function begin(kind){
  const current=acquire(kind);if(!current)return null;
  current.phase='warming';current.warmupStartedAt=performance.now();
  status('预热 0.0 / 3.5 s；随后测量 20 s');return current;
}
function stop(reason='interrupted',completed=false){
  const current=session;if(!current)return Promise.resolve(null);
  if(current.stopPromise){if(!completed){current.completed=false;current.reason=reason;}return current.stopPromise;}
  current.phase='finalizing';current.stoppedAt=performance.now();current.reason=reason;current.completed=completed;current.finalState=frameState();
  metrics.active=false;clearInput();status('收尾 GPU 查询与录制文件…');
  current.stopPromise=(async()=>{
    const gpuResult=metrics.finalize();
    if(current.recorder?.state==='recording'||current.recorder?.state==='paused'){
      try{current.recorder.stop();}catch(error){current.completed=false;current.reason=`recorder-stop-failed: ${error.message}`;current.releaseRecorder?.();}
    }else if(!current.recorder)current.releaseRecorder?.();
    const [result]=await Promise.all([gpuResult,current.recorderDone]);
    const elapsedDurationMs=current.startedAt===null?0:current.stoppedAt-current.startedAt;
    lastReport={createdAt:current.createdAt,finishedAt:new Date().toISOString(),run:current.id,kind:current.kind,...current.metadata,...current.finalState,
      completed:current.completed,invalid:!current.completed,reason:current.reason,expectedDurationMs:current.expectedDurationMs,elapsedDurationMs,
      warmup:{requiredMs:current.kind==='measure'?warmupMs:0,elapsedMs:current.warmupStartedAt===undefined?0:(current.startedAt??current.stoppedAt)-current.warmupStartedAt,completed:current.startedAt!==null},
      workload:current.metadata.view==='ground'?'scripted-ground':current.metadata.view==='flight'?'scripted-flight':current.metadata.timeOfDay==='auto'?'daylight-cycle':'fixed-view',renderedLighting:{first:current.firstRenderedLighting??null,last:current.lastRenderedLighting??null},motionSamples:current.motionSamples,captureErrors:current.captureErrors,...result};
    if(current.mediaName&&!disposed){const error=await download(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),current.mediaName.replace(/\.(webm|mp4)$/,'.json'));if(error)lastReport.captureErrors.push(error);}
    $('metrics').textContent=JSON.stringify(lastReport,null,2);
    if(session===current){session=null;setLocked(disposed||!fullReady);$('json').disabled=disposed||!lastReport;status(current.completed?'完成；测量记录可下载。':`已中断：${current.reason}；导出标记为 invalid。`);}
    return lastReport;
  })();
  return current.stopPromise;
}
function flight(t){
  const phases=[0,2,5,8,11,14,17,20,22],next=phases.filter(n=>t>=n).length-1;
  if(next===stage)return;stage=next;clearInput();
  if(next===1)game.setTouch(0,-1);
  if(next===2){game.setTouch(0,-1);game.setControl('boost',true);}
  if(next===3){game.setTouch(1,0);game.setControl('up',true);}
  if(next===4){game.setTouch(-1,0);game.cast(0);}
  if(next===5){game.setTouch(0,1);game.setControl('boost',true);}
  if(next===6){game.setTouch(0,1);game.setControl('down',true);game.cast(1);}
  if(next===7)game.travel('research');
  if(next===8)game.setCameraView('low');
}
function groundSequence(t){
  const marks=[0,2.5,5,8,10,12,14,17,20,22],next=marks.filter(n=>t>=n).length-1;
  if(next===stage)return;stage=next;clearInput();
  if(next===1)game.setTouch(0,-1);
  if(next===2){game.setTouch(0,-1);game.setControl('boost',true);}
  if(next===3)game.setTouch(1,0);
  if(next===4){game.toggleIllumination();game.cast(0);}
  if(next===5)game.toggleBroom();
  if(next===6){game.setTouch(1,0);game.setControl('up',true);}
  if(next===7)game.travel('publications');
  if(next===8)game.toggleBroom();
  if(next===9)game.toggleIllumination();
}
const soundSequence=[[0,'page'],[2,'clock'],[5,'boost'],[7,'cast-start'],[7.2,'lumos'],[10,'travel-start'],[10.2,'travel'],[13,'incendio'],[16,'shield'],[19,'collect'],[21,'page']];
function updateSequence(){
  const current=session;if(!current||current.phase==='preparing'||current.phase==='finalizing')return;
  const now=performance.now();
  if(current.phase==='warming'){
    const elapsed=now-current.warmupStartedAt;
    status(`预热 ${(Math.min(warmupMs,elapsed)/1000).toFixed(1)} / 3.5 s；随后测量 20 s`);
    if(elapsed<warmupMs)return;
    if(current.metadata.view==='exhibit'&&(!game.exhibitionStage?.loadedSource||game.exhibitionStage.materialErrors?.length)){void stop('exhibition-assets-not-ready');return;}
    current.phase='running';current.startedAt=now;metrics.start();
  }
  const t=(now-current.startedAt)/1000;
  if(current.metadata.view==='flight')flight(t);
  if(current.metadata.view==='ground')groundSequence(t);
  if(['ground','flight'].includes(current.metadata.view)&&(!current.motionSamples.length||t-current.motionSamples.at(-1).seconds>=.5)){
    current.motionSamples.push({seconds:t,stage,...frameState().rider,transition:game.locomotion?.progress,illumination:game.illumination?.getState()?.enabled});
  }
  if(current.kind==='audition'){
    while(audition+1<soundSequence.length&&t>=soundSequence[audition+1][0]){audition++;game.audio.play(soundSequence[audition][1]);}
    game.audio.setEnvironment({night:Math.min(1,t/18),reading:t>18,position:game.position});
    game.audio.update(t,0);
  }
  const duration=current.expectedDurationMs/1000;
  status(`${current.kind==='measure'?'测量':'录制'} ${Math.min(duration,t).toFixed(1)} / ${duration} s`);
  if(t>=duration)void stop('completed',true);
}
async function record(kind){
  if(!window.MediaRecorder||!canvas.captureStream){status('此浏览器不支持录制；实际画面仍可检查。');return null;}
  const current=acquire(kind);if(!current)return null;
  try{
    if(kind==='audition'){game.setOption('sound',true);current.metadata.sound=true;game.audio.unlock();await game.audio._musicPromise;}
    if(session!==current||current.phase!=='preparing'||disposed)return null;
    const stream=canvas.captureStream(30),recorded=[];let audioOutput=null,audioTap=null,released=false,resolveRecorder;
    current.recorderDone=new Promise(resolve=>{resolveRecorder=resolve;});
    current.releaseRecorder=()=>{if(released)return;released=true;try{if(audioOutput)audioTap.disconnect(audioOutput);}finally{for(const track of stream.getTracks())track.stop();if(current.recorder)current.recorder.ondataavailable=current.recorder.onerror=current.recorder.onstop=null;resolveRecorder();}};
    if(kind==='audition'&&game.audio.context){audioOutput=game.audio.context.createMediaStreamDestination();audioTap=game.audio.limiter||game.audio.master;audioTap.connect(audioOutput);for(const track of audioOutput.stream.getAudioTracks())stream.addTrack(track);}
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(value=>MediaRecorder.isTypeSupported(value));
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:10000000}:undefined);current.recorder=recorder;
    recorder.ondataavailable=event=>{if(event.data.size)recorded.push(event.data);};
    recorder.onerror=event=>{void stop(`recorder-error: ${event.error?.message||'unknown'}`);};
    recorder.onstop=async()=>{
      if(session===current&&current.phase!=='finalizing')void stop('recorder-stopped-early');
      try{
        if(recorded.length){
          const blob=new Blob(recorded,{type:recorder.mimeType}),url=URL.createObjectURL(blob);files.push(url);const video=document.createElement('video');video.controls=true;video.src=url;$('media').append(video);
          current.mediaName=reviewFilename(current.metadata,`${kind}${current.completed?'':'-invalid'}`,blob.type.includes('mp4')?'mp4':'webm');
          const error=await download(blob,current.mediaName);
          if(error)current.captureErrors.push(error);
        }else{current.completed=false;current.reason='recording-empty';}
      }catch(error){current.completed=false;current.reason=`recording-export-failed: ${error.message}`;}finally{current.releaseRecorder();}
    };
    recorder.start(1000);current.startedAt=performance.now();current.phase='running';
    status('录制 0.0 / 24 s');return current;
  }catch(error){current.releaseRecorder?.();await stop(`recording-start-failed: ${error.message}`);return null;}
}
function addFoliageControl(){
  const label=document.createElement('label');label.append('植被 ');const select=document.createElement('select');select.id='foliage';
  for(const [value,text] of [['lod','空间 LOD'],['full','完整几何']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value=game.world.vegetation?.lodController?'lod':'full';label.append(select);$('reset').parentElement.insertBefore(label,$('reset'));
  if(!game.world.vegetation?.lodController)select.title='此历史版本没有 LOD 控制器，使用完整几何。';
  select.onchange=reset;
}
function addDiagnosticControls(){
  for(const [value,text] of [['arrival','Arrival lawn / 到达草坪'],['castle-forecourt','Castle forecourt / 城堡前庭'],['conservatory','Conservatory / 温室'],['conservatory-interior','Conservatory interior / 温室内廊'],['arcade-passage','Arcade passage · 1.7 m eye / 拱廊步行视角'],['water-garden','Water garden / 水庭'],['castle-footing','Castle footing / 城堡落脚'],['contact-bridge','Bridge contact / 桥头接地'],['shore-detail','Shore detail / 岸线细节']]){const option=document.createElement('option');option.value=value;option.textContent=text;$('view').append(option);}
  const label=document.createElement('label');label.append('像素采样 ');const select=document.createElement('select');select.id='sampling';
  for(const [value,text] of [['native','Native'],['2x','2x'],['2.5x','2.5x']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value='native';select.title='2x / 2.5x 是每 CSS 像素的采样密度。为隔离采样影响，请固定“完整几何”。';select.onchange=reset;
  label.append(select);$('reset').parentElement.insertBefore(label,$('reset'));
  const motionLabel=document.createElement('label'),motion=document.createElement('input');motion.id='reduced-motion';motion.type='checkbox';motion.checked=false;motion.onchange=reset;
  motionLabel.append(motion,'静态对照 / reduced motion');$('reset').parentElement.insertBefore(motionLabel,$('reset'));
  const lightingLabel=document.createElement('label'),lighting=document.createElement('select');lighting.id='lighting-variant';
  for(const variant of LIGHTING_REVIEW_VARIANTS){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.label;lighting.append(option);}
  lighting.value='baseline';lighting.onchange=reset;lighting.title='One variable per trial. Pearl preserves fill luminance/intensity; solar rotates the real sun/key with baseline fill. Match view, time, full geometry, native pixels and static motion.';
  lightingLabel.append('光照对照 ',lighting);$('reset').parentElement.insertBefore(lightingLabel,$('reset'));
  const phaseLabel=document.createElement('label'),phase=document.createElement('input');phase.id='phase-start';phase.type='number';phase.min='0';phase.max='.9999';phase.step='.001';phase.value='';phase.placeholder='0–1';phase.onchange=reset;
  phase.title='Optional exact starting phase when Auto is selected. Static captures freeze here; uncheck reduced motion to record the unchanged 240 s cycle.';
  phaseLabel.append('Auto start phase / 自动起始时刻 ',phase);$('reset').parentElement.insertBefore(phaseLabel,$('reset'));
  const readout=document.createElement('span');readout.id='sampling-size';$('reset').parentElement.append(readout);
}
try{
  milestone('living-v8 · isolated lighting study; full frame required');
  const query=new URLSearchParams(globalThis.location?.search||'');
  const requestedView=query.get('view'),requestedLight=query.get('light'),requestedLighting=query.get('lighting');
  lightingStudyRequested=LIGHTING_REVIEW_VARIANTS.some(v=>v.id===requestedLighting);
  if(requestedLight&&['day','night','dawn','dusk','auto'].includes(requestedLight))$('light').value=requestedLight;
  game=await Game.createAsync(canvas,{onMessage:()=>{},onFrame:s=>{if(!session&&!lastReport&&game&&$('sampling'))$('metrics').textContent=JSON.stringify({fps:s.fps,locomotion:s.locomotion,illumination:s.illumination,sampling:$('sampling').value,reducedMotion:Boolean(game.options.reducedMotion),...frameState(),drawCalls:s.drawCalls,submittedTriangles:s.triangles,lod:game.world.vegetation?.lod,audio:s.audio},null,2);}}, {quality:$('quality').value,timeOfDay:$('light').value,gameplay:false,lang:'zh'},{signal:lifetime.signal,deadline:performance.now()+180000,onProgress:loadProgress,preloadNightEnvironment:true,onRenderer:renderer=>{renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{const message=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join(' · ');loadProgress({phase:'render-error',activeResource:message});console.error(message);};}});
  metrics=new ReviewMetrics(game.renderer);addFoliageControl();addDiagnosticControls();
  const requestedPhase=query.get('phase');if(requestedPhase!==null&&requestedPhase.trim()!==''&&Number(requestedPhase)>=0&&Number(requestedPhase)<1)$('phase-start').value=String(Number(requestedPhase));
  if(lightingStudyRequested){$('lighting-variant').value=requestedLighting;$('reduced-motion').checked=true;$('foliage').value='full';}
  if(requestedView&&[...Object.keys(poses),'flight','ground','exhibit'].includes(requestedView))$('view').value=requestedView;
  const resize=game._resize.bind(game);
  game._resize=(...args)=>{resize(...args);applySampling();};
  const cameraUpdate=game._updateCamera.bind(game);
  game._updateCamera=(...args)=>{if(!pose)return cameraUpdate(...args);const eye=[...pose.eye];if(pose.eyeHeight)eye[1]=game.world.heightAt(eye[0],eye[2])+pose.eyeHeight;game.camera.position.fromArray(eye);game.camera.fov=43;game.camera.lookAt(new THREE.Vector3(...pose.target));game.camera.updateProjectionMatrix();game.camera.updateMatrixWorld();};
  const render=game.rendering.render.bind(game.rendering);
  game.rendering.render=dt=>{
    updateSequence();const now=performance.now(),query=metrics.before(now);render(dt);
    metrics.after(query,performance.now()-now,{near:game.world.vegetation?.lod?.nearCount,mid:game.world.vegetation?.lod?.midCount,far:game.world.vegetation?.lod?.farCount});
    if(session?.phase==='running'){const lighting=lightingSnapshot();session.firstRenderedLighting??=lighting;session.lastRenderedLighting=lighting;}
    if(saveFrame){
      const metadata={...conditions(),...frameState(),capturedAt:new Date().toISOString(),evidenceType:'actual-frame'},name=reviewFilename(metadata,'frame','png');saveFrame=null;
      canvas.toBlob(async blob=>{if(!blob||disposed)return;const saveError=await download(blob,name);if(disposed)return;await download(new Blob([JSON.stringify({...metadata,saveError},null,2)],{type:'application/json'}),name.replace(/\.png$/,'.json'));});
    }
  };
  $('reset').onclick=reset;$('view').onchange=reset;$('light').onchange=reset;$('quality').onchange=reset;
  $('measure').onclick=()=>begin('measure');$('record').onclick=()=>record('record');$('audition').onclick=()=>record('audition');
  $('frame').onclick=()=>{if(!session&&!disposed)saveFrame=true;};
  $('sound').onclick=()=>{if(session||disposed)return;game.setOption('sound',!game.options.sound);$('sound').textContent=game.options.sound?'关闭试听':'开启试听';};
  $('json').onclick=()=>{if(!session&&lastReport)void download(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),reviewFilename(lastReport,'metrics','json'));};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&session)void stop('page-hidden');});
  reset();setLocked(true);status('核心场景已显示；等待全部增强与完整场景首帧。');
}catch(error){status(`载入失败：${error.message}`);console.error(error);}
window.addEventListener('pagehide',()=>{
  disposed=true;lifetime.abort();unsubscribeResources();
  void stop('page-hidden').finally(()=>{metrics?.dispose();game?.dispose();for(const url of files)URL.revokeObjectURL(url);});
});
