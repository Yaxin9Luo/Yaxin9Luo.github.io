import * as THREE from 'three';
import {loadBotanicalAssets} from './botanical-cache.js';
import {Game} from './game.js';
import {loadLandscapeAssets} from './landscape.js';
import {loadArchitectureAssets} from './models.js';
import {loadCharacterAssets} from './characters.js';
import {ReviewMetrics,evidenceFilename} from './review-metrics.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas');
const warmupMs=3500,files=[],controlIds=['measure','record','audition','view','light','quality','foliage','sampling','reduced-motion','reset','frame','sound','json'];
let game,metrics,session=null,run=0,lastReport=null,pose=null,saveFrame=null,audition=-1,stage=-1,disposed=false;
const poses={cherry:{eye:[-45,17,85],target:[-73,9,66]},lilac:{eye:[69,17,97],target:[48,10,77]},highlands:{eye:[130,94,184],target:[-2,44,-40]},court:{eye:[30,27,79],target:[0,10,28]},overview:{eye:[130,162,180],target:[-2,12,-4]},bridge:{eye:[-27,26,-23],target:[-65,5,-53]},shore:{eye:[93,4,115],target:[45,2,73]},
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
function conditions(){return {build:document.documentElement.dataset.build||'current',view:$('view').value,timeOfDay:$('light').value,quality:$('quality').value,foliage:$('foliage').value,sampling:$('sampling').value,reducedMotion:Boolean($('reduced-motion').checked),sound:Boolean(game.options.sound)};}
function setLocked(locked){for(const id of controlIds)$(id).disabled=locked||(id==='json'&&!lastReport)||(id==='foliage'&&!game.world.vegetation?.lodController);}
function clearInput(){game.setTouch(0,0);for(const key of ['boost','up','down','fire'])game.setControl(key,false);}
function resetScene(config=conditions()){
  lastReport=null;$('json').disabled=true;
  clearInput();game.leaveExhibit();game.returnHome();game.start();
  game.setOption('reducedMotion',config.reducedMotion);game.setOption('timeOfDay',config.timeOfDay);game.setOption('quality',config.quality);
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
function frameState(){return {canvas:{width:canvas.width,height:canvas.height,backingWidth:canvas.width,backingHeight:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:game.renderer.getPixelRatio(),nativeDpr:globalThis.devicePixelRatio||1,msaaSamples:game.rendering.samples},camera:{eye:game.camera.position.toArray(),target:pose?.target||null,fov:game.camera.fov},rider:{position:game.position?.toArray(),mode:game.locomotion?.mode,speed:game.locomotion?.groundSpeed}};}
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
  if(session||disposed)return null;
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
      workload:current.metadata.view==='ground'?'scripted-ground':current.metadata.view==='flight'?'scripted-flight':current.metadata.timeOfDay==='auto'?'daylight-cycle':'fixed-view',motionSamples:current.motionSamples,captureErrors:current.captureErrors,...result};
    $('metrics').textContent=JSON.stringify(lastReport,null,2);
    if(session===current){session=null;setLocked(disposed);status(current.completed?'完成；测量记录可下载。':`已中断：${current.reason}；导出标记为 invalid。`);}
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
    current.releaseRecorder=()=>{if(released)return;released=true;try{if(audioOutput)audioTap.disconnect(audioOutput);}finally{for(const track of stream.getTracks())track.stop();resolveRecorder();}};
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
          const error=await download(blob,evidenceFilename(current.metadata,`${kind}${current.completed?'':'-invalid'}`,blob.type.includes('mp4')?'mp4':'webm'));
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
  for(const [value,text] of [['castle-footing','Castle footing / 城堡落脚'],['contact-bridge','Bridge contact / 桥头接地'],['shore-detail','Shore detail / 岸线细节']]){const option=document.createElement('option');option.value=value;option.textContent=text;$('view').append(option);}
  const label=document.createElement('label');label.append('像素采样 ');const select=document.createElement('select');select.id='sampling';
  for(const [value,text] of [['native','Native'],['2x','2x'],['2.5x','2.5x']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value='native';select.title='2x / 2.5x 是每 CSS 像素的采样密度。为隔离采样影响，请固定“完整几何”。';select.onchange=reset;
  label.append(select);$('reset').parentElement.insertBefore(label,$('reset'));
  const motionLabel=document.createElement('label'),motion=document.createElement('input');motion.id='reduced-motion';motion.type='checkbox';motion.checked=false;motion.onchange=reset;
  motionLabel.append(motion,'静态对照 / reduced motion');$('reset').parentElement.insertBefore(motionLabel,$('reset'));
  const readout=document.createElement('span');readout.id='sampling-size';$('reset').parentElement.append(readout);
}
try{
  await Promise.all([loadLandscapeAssets(),loadArchitectureAssets(),loadCharacterAssets(),loadBotanicalAssets({deadline:performance.now()+180000})]);
  game=new Game(canvas,{onMessage:()=>{},onFrame:s=>{if(!session&&!lastReport&&game&&$('sampling'))$('metrics').textContent=JSON.stringify({fps:s.fps,locomotion:s.locomotion,illumination:s.illumination,sampling:$('sampling').value,reducedMotion:Boolean(game.options.reducedMotion),...frameState(),drawCalls:s.drawCalls,submittedTriangles:s.triangles,lod:game.world.vegetation?.lod,audio:s.audio},null,2);}}, {quality:'high',timeOfDay:'night',gameplay:false,lang:'zh'});
  metrics=new ReviewMetrics(game.renderer);addFoliageControl();addDiagnosticControls();
  const resize=game._resize.bind(game);
  game._resize=(...args)=>{resize(...args);applySampling();};
  const cameraUpdate=game._updateCamera.bind(game);
  game._updateCamera=(...args)=>{if(!pose)return cameraUpdate(...args);game.camera.position.fromArray(pose.eye);game.camera.fov=43;game.camera.lookAt(new THREE.Vector3(...pose.target));game.camera.updateProjectionMatrix();game.camera.updateMatrixWorld();};
  const render=game.rendering.render.bind(game.rendering);
  game.rendering.render=dt=>{
    updateSequence();const now=performance.now(),query=metrics.before(now);render(dt);
    metrics.after(query,performance.now()-now,{near:game.world.vegetation?.lod?.nearCount,mid:game.world.vegetation?.lod?.midCount,far:game.world.vegetation?.lod?.farCount});
    if(saveFrame){const name=evidenceFilename(conditions(),'frame','png');saveFrame=null;canvas.toBlob(blob=>{if(blob)void download(blob,name);});}
  };
  $('reset').onclick=reset;$('view').onchange=reset;$('light').onchange=reset;$('quality').onchange=reset;
  $('measure').onclick=()=>begin('measure');$('record').onclick=()=>record('record');$('audition').onclick=()=>record('audition');
  $('frame').onclick=()=>{if(!session&&!disposed)saveFrame=true;};
  $('sound').onclick=()=>{if(session||disposed)return;game.setOption('sound',!game.options.sound);$('sound').textContent=game.options.sound?'关闭试听':'开启试听';};
  $('json').onclick=()=>{if(!session&&lastReport)void download(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),evidenceFilename(lastReport,'metrics','json'));};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&session)void stop('page-hidden');});
  reset();setLocked(false);status('真实资产已就绪；测量包含 3.5 秒预热。');document.body.dataset.ready='true';
}catch(error){status(`载入失败：${error.message}`);console.error(error);}
window.addEventListener('pagehide',()=>{
  disposed=true;
  void stop('page-hidden').finally(()=>{metrics?.dispose();game?.dispose();for(const url of files)URL.revokeObjectURL(url);});
});
