import * as THREE from 'three';
import {Game} from './game.js';
import {createGroundChromaStudy} from './ground-chroma-review.js';
import {setRootedLoamStrength,getRootedLoamState} from './rooted-loam.js';
import {submitReviewFramebufferReadback,reviewFrameGuard} from './review-frame-readback.js';
import {snapshotReviewPresentation,encodeReviewFramePixels} from './review-frame-presentation.js';
import {resourceLoader} from './resource-loader.js';
import {ReviewMetrics,evidenceFilename} from './review-metrics.js';
import {LIGHTING_REVIEW_VARIANTS} from './environment-time.js';
import {createReviewLoading,REVIEW_ENHANCEMENT_BUDGET_MS} from './review-loading.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas');
const warmupMs=3500,files=[],controlIds=['measure','record','audition','companion-record','companion-action','companion-pause','companion-language','view','light','quality','foliage','sampling','reduced-motion','lighting-variant','phase-start','activity-start','release-lantern','ground-study','rooted-loam','reset','frame','sound','json'];
const companionDuration={clock:'wall',mode:'minimum-then-companion-complete',minimumMs:48000,maximumMs:180000};
let captureEpoch=0;
let game,metrics,groundStudy,session=null,captureSequence=null,run=0,lastReport=null,pose=null,saveFrame=null,audition=-1,stage=-1,disposed=false,fullReady=false,renderFailed=false,lightingStudyRequested=false;
const lifetime=new AbortController(),loadStart=performance.now(),milestones=[],resourceFailures=new Map(),frameMilestones={},assemblyTimings=new Map();
const loadingMode=new URLSearchParams(globalThis.location?.search||'').get('loading')==='staged'?'staged':'progressive';
const reviewLoading=createReviewLoading({mode:loadingMode,canvas,signal:lifetime.signal,onFailure:error=>{
  fullReady=false;saveFrame=null;document.body.dataset.ready='degraded';for(const id of controlIds)if($(id))$(id).disabled=true;
  milestone(`Staged loading failed · ${error.message}`);status(`Staged review degraded; capture disabled. ${error.message}`);
  abortCaptureSequence(error.message);
  lifetime.abort(error);
}});
function milestone(label){milestones.push(`${((performance.now()-loadStart)/1000).toFixed(1)}s · ${label}`);if(milestones.length>28)milestones.shift();$('loading').textContent=milestones.join('\n');$('latest-load').textContent=label;$('load-times').textContent=Object.entries(frameMilestones).map(([name,seconds])=>`${name}: ${seconds}s`).join(' · ');$('loading').scrollTop=$('loading').scrollHeight;if(captureBusy()&&!captureSequence.started&&performance.now()-captureSequence.progressAt>=2000)captureProgress();}
function loadProgress(event){
  if(disposed)return;
  if(event.phase==='enhancements'&&event.enhancements==='ready'&&resourceFailures.size)reviewLoading.fail(new Error(`${resourceFailures.size} resources failed`));
  reviewLoading.progress(event);
  if(event.phase==='assembly'&&Number.isFinite(event.assemblyMs)){
    const steps=(event.assemblySteps||[]).filter(step=>Number.isFinite(step.assemblyMs)).map(step=>({region:step.region,assemblyMs:step.assemblyMs}));
    assemblyTimings.set(event.region,{region:event.region,assemblyMs:event.assemblyMs,steps});
    for(const step of steps)milestone(`assembly detail · ${step.region} · ${step.assemblyMs.toFixed(0)}ms`);
  }
  if(event.phase==='render-error'){
    reviewLoading.fail(new Error(event.activeResource||'Renderer failure'));
    renderFailed=true;fullReady=false;saveFrame=null;document.body.dataset.ready='degraded';milestone(`Render failed · ${event.activeResource}`);if(game)setLocked(true);
    abortCaptureSequence(`render-error: ${event.activeResource}`);
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
    fullReady=reviewLoading.completeFrame(!renderFailed&&event.enhancements==='ready'&&game?.world.complete===true&&game?.companionSnapshot().installation.status==='ready'&&resourceFailures.size===0);document.body.dataset.ready=fullReady?'true':'degraded';
    milestone(`Full frame rendered · ${fullReady?'ready':'degraded'} · ${resourceFailures.size} failed resources`);
    if(game){$('foliage').value=!lightingStudyRequested&&foliageControllers().length?'lod':'full';resetScene();setLocked(!fullReady);}
    status(fullReady?'完整场景首帧已就绪；测量包含 3.5 秒预热。':`Full scene degraded; measurement disabled. ${event.errors?.join('; ')||[...resourceFailures.values()].join('; ')}`);
    if(fullReady)void startCaptureSequence();else abortCaptureSequence('Full frame is degraded');
  }else{milestone(`${event.phase}${event.region?' · '+event.region:''}${event.activeResource?' · '+event.activeResource:''}${event.enhancements?' · '+event.enhancements:''}${event.assemblyMs?' · '+event.assemblyMs.toFixed(0)+'ms':''}`);}
}
const unsubscribeResources=resourceLoader.subscribe(event=>{
  if(disposed)return;
  if(event.phase==='failed')resourceFailures.set(event.id,`${event.id}: ${event.type}`);
  if(event.phase==='ready')resourceFailures.delete(event.id);
  if(['queued','parsing','ready','failed','retrying'].includes(event.phase))milestone(`${event.phase} · ${event.id}${event.type?' · '+event.type:''}`);
});
window.addEventListener('pagehide',()=>{
  if(disposed)return;disposed=true;captureEpoch++;reviewLoading.dispose();lifetime.abort();unsubscribeResources();
  abortCaptureSequence('page-hidden');
  void stop('page-hidden').finally(()=>{metrics?.dispose();groundStudy?.dispose();game?.dispose();for(const url of files)URL.revokeObjectURL(url);});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){captureEpoch++;abortCaptureSequence('page-hidden');if(session)void stop('page-hidden');}},{signal:lifetime.signal});
canvas.addEventListener('webglcontextlost',()=>{captureEpoch++;abortCaptureSequence('Graphics context lost');},{signal:lifetime.signal});
// Travel checks stay inside playable bounds; overview and water studies may use external camera-only views.
const poses={arrival:{eye:[38,25,92],target:[8,9,38]},'castle-forecourt':{eye:[34,19,23],target:[0,9,0]},conservatory:{eye:[66,15,23],target:[48,10.4,29]},'conservatory-interior':{eye:[51.98,9.48,29],target:[45.5,9.1,30.65],fov:70},'arcade-passage':{eye:[21.44,0,10.5],eyeHeight:1.7,target:[21.44,9.4,1.2]},'water-garden':{eye:[-27,13,56],target:[-44,7.6,47]},'water-entry':{eye:[-32.3,0,47],eyeHeight:1.7,target:[-44,7.6,47]},'west-community':{eye:[-7,0,61],eyeHeight:1.7,target:[-17,6.5,67]},'east-community':{eye:[48,0,18],eyeHeight:1.7,target:[61,8.5,17]},'west-edge':{eye:[-150,95,70],target:[0,14,-40]},'east-edge':{eye:[150,95,70],target:[0,14,-40]},'high-flight':{eye:[0,125,110],target:[0,24,-60]},cherry:{eye:[-45,17,85],target:[-73,9,66]},lilac:{eye:[69,17,97],target:[48,10,77]},highlands:{eye:[130,94,184],target:[-2,44,-40]},court:{eye:[30,27,79],target:[0,10,28]},overview:{eye:[130,162,180],target:[-2,12,-4]},bridge:{eye:[-27,26,-23],target:[-65,5,-53]},shore:{eye:[93,4,115],target:[45,2,73]},
  'castle-footing':{eye:[39,16,-8],target:[27,9,-24]},'contact-bridge':{eye:[59,15,-23],target:[52,3,-42]},'shore-detail':{eye:[111,6,16],target:[99,-2,2]},'fauna-birds':{eye:[0,0,0],target:[0,0,0],fauna:'bird'},'fauna-lanterns':{eye:[0,0,0],target:[0,0,0],fauna:'lantern'},'fauna-fireflies':{eye:[0,0,0],target:[0,0,0],fauna:'firefly'},'fauna-reflection':{eye:[-155,4,176],target:[-135,4,-2]},'fauna-reflection-pair':{eye:[-155,4,176],target:[-135,4,-2],reflection:true},'fauna-release':{eye:[22,20,78],target:[19.5,18.7,73.5],fauna:'release'},'full-moon':{eye:[130,94,150],target:[0,80,-40],moon:true}};
function frameLanternReflection(fauna,water){
  if(!fauna||!water)return null;
  // Keep the lowest authored western lantern, then read its actual live shell.
  // Selection is stable while the camera follows its small accepted-time sway.
  const index=fauna.motion.lanterns.reduce((chosen,item,i)=>item.group===0&&(chosen<0||item.base.y<fauna.motion.lanterns[chosen].base.y)?i:chosen,-1);
  const paper=fauna.root.children.filter(object=>object.name==='Continuous folded translucent paper shell')[index];if(!paper)return null;
  paper.updateWorldMatrix(true,false);water.updateWorldMatrix(true,false);if(!paper.geometry.boundingBox)paper.geometry.computeBoundingBox();
  const box=paper.geometry.boundingBox.clone().applyMatrix4(paper.matrixWorld),center=box.getCenter(new THREE.Vector3());
  const normal=new THREE.Vector3(0,0,1).transformDirection(water.matrixWorld),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,water.getWorldPosition(new THREE.Vector3()));
  const height=plane.distanceToPoint(center),foot=plane.projectPoint(center,new THREE.Vector3()),reflected=center.clone().addScaledVector(normal,-2*height);
  const radius=box.getSize(new THREE.Vector3()).length()*.5,distance=(Math.abs(height)+radius+2)/(Math.tan(43*Math.PI/360)*.70);
  const west=new THREE.Vector3(-1,0,0).addScaledVector(normal,normal.x).normalize(),eye=foot.clone().addScaledVector(west,distance).addScaledVector(normal,4);
  return{eye:eye.toArray(),target:foot.toArray(),reflectionPair:{lanternIndex:index,lanternPosition:fauna.motion.lanterns[index].position.toArray(),center:center.toArray(),mirroredCenter:reflected.toArray(),waterPoint:foot.toArray(),planeNormal:normal.toArray(),planeConstant:plane.constant}};
}
const status=text=>{$('status').textContent=text;};
for(const kind of ['elizabeth','sadaharu'])for(const close of [false,true])poses[`companion-${kind}${close?'-close':''}`]={eye:[0,0,0],target:[0,0,0],companion:kind,close};
function selectedCompanion(){return (session?.metadata.view||$('view').value).includes('sadaharu')?'sadaharu':'elizabeth';}
function approachCompanion(id=selectedCompanion()){
  if(game.paused||game._isPaused?.())return false;
  const actor=game.companionSnapshot().actors.find(a=>a.id===id);if(!actor?.valid)return false;
  // Move the review visitor, never the actor. Normal Game collision and content
  // priority remain in force for this westward courtyard approach.
  game._teleport(actor.position.x-4.8,actor.position.y+3.2,actor.position.z);
  game._avoidBuildings();game._updateInteractions();return true;
}
function greetCompanion(){
  if(!fullReady||disposed||session||captureBusy())return false;
  if(!approachCompanion())return false;
  const accepted=game.interact({companionId:selectedCompanion()});
  requestReviewFrame();
  if(!accepted)status('No greeting started · approach is busy, obstructed or a portfolio entry has priority. / 此处交互正忙、受阻，或内容入口优先。');
  return accepted;
}
function evidenceLink(blob,name,click=true){
  const url=URL.createObjectURL(blob);files.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.textContent=name;$('media').append(a);if(click)a.click();return a;
}
async function postEvidence(blob,name,signal=lifetime.signal){
  const response=await fetch(`/__review_capture/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});if(!response.ok)throw new Error(`HTTP ${response.status}`);
}
async function download(blob,name){
  const a=evidenceLink(blob,name);
  if(import.meta.env.DEV){
    try{await postEvidence(blob,name);a.append(' · saved to local evidence');}
    catch(error){a.append(` · local save failed: ${error.message}`);return error.message;}
  }
  return null;
}
const captureSteps=['overview','west-community','east-community'].flatMap(view=>['day','night'].flatMap(timeOfDay=>(view==='overview'?[0]:[0,.5]).map(strength=>({view,timeOfDay,strength,group:`${view}-${timeOfDay}`,paired:view!=='overview'}))));
const copy=value=>JSON.parse(JSON.stringify(value));
function captureBusy(){return Boolean(captureSequence&&!captureSequence.finished);}
function captureProgress(phase=captureSequence?.phase){
  const current=captureSequence;if(!current)return;current.phase=phase;current.progressAt=performance.now();
  const draw=game?.reviewRenderingSnapshot(),step=current.step;
  const record={type:'review-capture-progress',preset:'ground-pairs-v1',build:document.documentElement.dataset.build||'current',coldStartMeasurement:false,runId:current.id,sceneId:current.sceneId??null,phase,index:step?current.index+1:0,total:10,completed:current.completed,view:step?.view??null,light:step?.timeOfDay??null,strength:step?.strength??null,reason:current.reason?.slice(0,350)??null,fullReady,requestedRevision:draw?.requestedRevision??null,drawnRevision:draw?.drawnRevision??null,renderedFrames:draw?.renderedFrames??0,latestLoad:($('latest-load').textContent||'').slice(0,240),coreSeconds:frameMilestones.core===undefined?null:Number(frameMilestones.core),fullSeconds:frameMilestones.full===undefined?null:Number(frameMilestones.full),elapsedSeconds:(performance.now()-loadStart)/1000};
  $('capture-progress').textContent=`Capture / 画帧 ${record.index}/10 · ${phase} · ${record.view||'full scene'} ${record.light||''} · ${current.completed} saved pairs of files${record.reason?` · ${record.reason}`:''}`;
  $('capture-cancel').disabled=current.finished;document.body.dataset.capturePhase=phase;document.body.dataset.captureRun=current.id;
  if(disposed||document.hidden||lifetime.signal.aborted)return;
  // At most one small progress POST is in flight. Loading bursts replace the
  // pending record; no scene object, media link or download click is produced.
  current.progressRecord=record;
  if(current.postingProgress)return;
  current.postingProgress=(async()=>{
    while(current.progressRecord&&!disposed&&!document.hidden&&!lifetime.signal.aborted){
      const next=current.progressRecord;current.progressRecord=null;
      const name=`graphics-${current.id}-progress-${String(++current.progressSequence).padStart(3,'0')}.json`;
      try{await postEvidence(new Blob([JSON.stringify(next)],{type:'application/json'}),name);}
      catch(error){current.progressRecord=null;abortCaptureSequence(`progress-save-failed: ${error.message}`,false);break;}
    }
  })().finally(()=>{current.postingProgress=null;if(current.progressRecord&&!disposed&&!document.hidden&&!lifetime.signal.aborted)captureProgress();});
}
function abortCaptureSequence(reason,publish=true){
  const current=captureSequence;if(!current||current.finished)return;
  current.finished=true;current.reason=String(reason);current.controller.abort(new DOMException(current.reason,'AbortError'));clearTimeout(current.timer);
  if(saveFrame?.owner===current)saveFrame=null;
  current.pending?.reject(new Error(current.reason));current.pending=null;
  if(publish)captureProgress('aborted');else{current.phase='aborted';$('capture-progress').textContent=`Capture aborted / 已中止 · ${current.reason}`;$('capture-cancel').disabled=true;document.body.dataset.capturePhase='aborted';}
  if(game)setLocked(disposed||!fullReady);status(`Capture aborted / 画帧序列已中止：${current.reason}`);
}
function captureSignature(metadata){
  const ground=copy(metadata.groundStudy);delete ground.strength;delete ground.revision;for(const material of ground.materials)delete material.boundStrength;
  return JSON.stringify({build:metadata.build,view:metadata.view,timeOfDay:metadata.timeOfDay,quality:metadata.quality,foliage:metadata.foliage,sampling:metadata.sampling,reducedMotion:metadata.reducedMotion,language:metadata.language,lightingVariant:metadata.lightingVariant,startPhase:metadata.startPhase,activityStart:metadata.activityStart,sound:metadata.sound,camera:metadata.camera,lighting:metadata.lighting,pipeline:metadata.pipeline,canvas:metadata.canvas,rider:metadata.rider,fauna:metadata.fauna,companions:metadata.companions,rootedLoam:metadata.rootedLoam,ground});
}
function assertCaptureLive(current){
  if(current!==captureSequence||current.finished||current.controller.signal.aborted||disposed||document.hidden||game?._disposed)throw new Error('Capture is no longer active');
  if(!fullReady||renderFailed||resourceFailures.size||game._contextLost||game.renderer.getContext().isContextLost?.())throw new Error('Full scene or graphics is unavailable');
  if(session||game.paused||game._suspended||game.scene.uuid!==current.sceneId||game.options.quality!=='high'||!game.options.reducedMotion||game.reviewRenderingSnapshot()?.policy!=='on-demand'||game.reviewRenderingSnapshot()?.activeMotion)throw new Error('Capture conditions changed');
  if(current.deadline!==null&&performance.now()>=current.deadline)throw new Error('Capture step exceeded 120 seconds');
}
function assertCaptureFrame(current,metadata){
  assertCaptureLive(current);
  const step=current.step,ground=metadata.groundStudy;
  if(metadata.view!==step.view||metadata.timeOfDay!==step.timeOfDay||metadata.quality!=='high'||metadata.foliage!=='full'||metadata.sampling!=='native'||!metadata.reducedMotion||metadata.lightingVariant!==current.lightingVariant)throw new Error('Capture controls drifted');
  const compiled=ground?.materials?.filter(material=>material.compiled)||[];
  if(!ground?.installed||ground.disposed||ground.sceneId!==current.sceneId||ground.strength!==step.strength||ground.rejected.length||!compiled.length||compiled.some(material=>material.boundStrength!==step.strength))throw new Error('Ground uniform is not exactly bound for this frame');
  const signature=captureSignature(metadata);
  if(step.paired&&step.strength===.5&&signature!==current.baselineSignature)throw new Error('A/B conditions do not match');
  return signature;
}
function captureScaleSnapshot(){
  const gl=game.renderer.getContext(),native=globalThis.devicePixelRatio;
  return [canvas.width,canvas.height,gl.drawingBufferWidth,gl.drawingBufferHeight,canvas.clientWidth,canvas.clientHeight,game.renderer.getPixelRatio(),Number.isFinite(native)&&native>0?native:1];
}
function submitStillFrame(entry,metadata){
  if(!Number.isFinite(metadata.renderRequest.drawnRevision)||metadata.renderRequest.drawnRevision!==entry.revision)throw new Error('Capture request changed before its actual pass');
  const epoch=captureEpoch,scale=captureScaleSnapshot(),strict=Boolean(entry.owner),width=metadata.canvas.width,height=metadata.canvas.height;
  const signature=strict?assertCaptureFrame(entry.owner,metadata):null;
  const signal=strict?AbortSignal.any([lifetime.signal,entry.owner.controller.signal]):lifetime.signal;
  const guard=reviewFrameGuard({revision:entry.revision,snapshot:()=>game.reviewRenderingSnapshot(),strict,assertLive:()=>{
    if(disposed||document.hidden||lifetime.signal.aborted||epoch!==captureEpoch||game?._disposed||game?._contextLost||game.renderer.getContext().isContextLost()||!fullReady||renderFailed)throw new Error('Captured frame lifecycle was invalidated');
    if(canvas.width!==width||canvas.height!==height)throw new Error('Captured native extent changed');
    if(captureScaleSnapshot().some((value,index)=>value!==scale[index]))throw new Error('Captured native extent or scale changed');
    if(strict&&assertCaptureFrame(entry.owner,{...conditions(),...frameState()})!==signature)throw new Error('Rendered frame conditions changed while saving');
    if(strict&&JSON.stringify(snapshotReviewPresentation(canvas,game.renderer.getContext()))!==presentationSignature)throw new Error('Rendered presentation conditions changed while saving');
  }});
  // This must be synchronous: pin the actual CSS presentation independently of
  // later manual control changes.
  const presentation=snapshotReviewPresentation(canvas,game.renderer.getContext());
  if(!presentation||typeof presentation.then==='function')throw new Error('Presentation snapshot must be synchronous');
  const presentationSignature=JSON.stringify(presentation);
  if(strict&&entry.owner.step.paired&&entry.owner.step.strength===.5&&presentationSignature!==entry.owner.baselinePresentationSignature)throw new Error('A/B presentation conditions do not match');
  const readback=submitReviewFramebufferReadback({gl:game.renderer.getContext(),canvas,width,height,guard,signal,deadline:strict?entry.owner.deadline:Infinity});
  return {readback,guard,signal,presentation,signature,presentationSignature};
}
async function saveManualFrame(metadata,pending){
  try{
    const pixels=await pending.readback,check=()=>pending.guard('complete');check();
    const encoded=await encodeReviewFramePixels(pixels,{signal:pending.signal,guard:check,presentation:pending.presentation});check();
    if(!encoded.blob?.size)throw new Error('PNG encoding returned no image');
    metadata.pixelEvidence={readback:encoded.readback,presentation:encoded.presentation};
    const name=reviewFilename(metadata,'frame','png'),saveError=await download(encoded.blob,name);check();
    await download(new Blob([JSON.stringify({...metadata,saveError},null,2)],{type:'application/json'}),name.replace(/\.png$/,'.json'));
  }catch(error){if(!disposed)status(`Frame capture failed / 画帧失败：${error.message}`);}
}
async function saveAutomaticFrame(entry,metadata,pending){
  const current=entry.owner;
  try{
    const signature=pending.signature,step=current.step;
    metadata.captureSequence={preset:'ground-pairs-v1',workload:'static-review-graphics-sequence',coldStartMeasurement:false,runId:current.id,index:current.index+1,total:10,pairId:step.paired?`${current.id}-${step.group}`:null,member:step.paired?(step.strength===0?'A':'B'):'overview',stepBudgetMs:120000};
    const name=`graphics-${current.id}-${String(current.index+1).padStart(2,'0')}-${step.group}-c${step.strength===0?'0':'05'}.png`;
    const check=()=>pending.guard('complete');
    captureProgress('readback');const pixels=await pending.readback;check();
    captureProgress('encoding');const encoded=await encodeReviewFramePixels(pixels,{signal:pending.signal,guard:check,presentation:pending.presentation});check();
    const blob=encoded.blob;if(!blob?.size)throw new Error('PNG encoding returned no image');
    metadata.pixelEvidence={readback:encoded.readback,presentation:encoded.presentation};
    captureProgress('saving-png');await postEvidence(blob,name,current.controller.signal);check();
    const sidecar=new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'}),sidecarName=name.replace(/\.png$/,'.json');
    captureProgress('saving-sidecar');await postEvidence(sidecar,sidecarName,current.controller.signal);check();
    for(const [file,fileName]of[[blob,name],[sidecar,sidecarName]])evidenceLink(file,fileName,false).append(' · saved to local evidence');
    if(step.paired&&step.strength===0){current.baselineSignature=signature;current.baselineRenderRevision=entry.revision;current.baselinePresentationSignature=pending.presentationSignature;}
    current.pending=null;entry.resolve({png:name,json:sidecarName});
  }catch(error){entry.reject(error);abortCaptureSequence(error.message);}
}
async function startCaptureSequence(){
  const current=captureSequence;if(!current||current.started||current.finished||!fullReady)return;
  current.started=true;current.sceneId=game.scene.uuid;current.lightingVariant=$('lighting-variant').value;setLocked(true);
  try{
    for(let index=0;index<captureSteps.length;index++){
      current.index=index;current.step=captureSteps[index];current.deadline=performance.now()+120000;current.timer=setTimeout(()=>abortCaptureSequence('Capture step exceeded 120 seconds'),120000);
      const step=current.step;
      if(index===0||step.group!==captureSteps[index-1].group){
        $('view').value=step.view;$('light').value=step.timeOfDay;$('quality').value='high';$('foliage').value='full';$('sampling').value='native';$('reduced-motion').checked=true;
        resetScene();current.baselineSignature=null;current.baselinePresentationSignature=null;
      }
      if(step.paired&&step.strength===.5&&game.reviewRenderingSnapshot().requestedRevision!==current.baselineRenderRevision)throw new Error('Visual state changed between A and B');
      $('ground-study').value=String(step.strength);groundStudy.set(step.strength);assertCaptureLive(current);
      const result=await new Promise((resolve,reject)=>{saveFrame={owner:current,revision:requestReviewFrame(),resolve,reject};current.pending=saveFrame;captureProgress('waiting-draw');});
      assertCaptureLive(current);clearTimeout(current.timer);current.timer=null;current.deadline=null;current.files.push(result);current.completed++;captureProgress('saved');
    }
    captureProgress('complete');while(current.postingProgress)await current.postingProgress;assertCaptureLive(current);
    current.finished=true;$('capture-cancel').disabled=true;setLocked(false);status('10 actual frames and sidecars saved / 十张实际画帧及元数据已保存。');
  }catch(error){abortCaptureSequence(error.message);}
}
function initializeCaptureSequence(query){
  if(query.get('capture')!=='ground-pairs-v1')return;
  $('capture-progress').hidden=false;
  if(!import.meta.env.DEV){$('capture-progress').textContent='Automatic evidence capture requires the local development server.';return;}
  captureSequence={id:crypto.randomUUID(),phase:'waiting-full',finished:false,started:false,index:0,step:null,completed:0,files:[],reason:null,controller:new AbortController(),timer:null,deadline:null,progressSequence:0,progressAt:performance.now(),progressRecord:null,postingProgress:null};
  $('capture-cancel').hidden=false;$('capture-cancel').onclick=()=>abortCaptureSequence('cancelled');captureProgress();if(document.hidden)abortCaptureSequence('page-hidden');
}
function reviewStartPhase(){const value=$('phase-start').value;if($('light').value!=='auto'||value.trim()==='')return null;const phase=Number(value);return Number.isFinite(phase)&&phase>=0&&phase<1?phase:null;}
function conditions(){return {build:document.documentElement.dataset.build||'current',view:$('view').value,timeOfDay:$('light').value,quality:$('quality').value,foliage:$('foliage').value,sampling:$('sampling').value,reducedMotion:Boolean($('reduced-motion').checked),language:game.options.lang||'zh',rootedLoamStrength:Number($('rooted-loam').value),lightingVariant:$('lighting-variant').value,startPhase:reviewStartPhase(),activityStart:Math.max(0,Number($('activity-start').value)||0),sound:Boolean(game.options.sound),loading:reviewLoading.metadata(),assemblyTimings:[...assemblyTimings.values()].map(timing=>({...timing,steps:timing.steps.map(step=>({...step}))}))};}
function reviewFilename(metadata,kind,extension){const phase=Number.isFinite(metadata.startPhase)?`-p${metadata.startPhase.toFixed(4).replace('.','p')}`:'';return `lighting-${metadata.lightingVariant||'baseline'}${phase}-a${(metadata.activityStart??0).toFixed(3).replace('.','p')}-${evidenceFilename(metadata,kind,extension)}`;}
function lightingSnapshot(){
  const e=game.environment;if(!e)return{available:false};
  const sky=game.world.atmosphere?.root.getObjectByName('Authored day and night cloud sky');
  return{variant:e.lightingVariant,solarAzimuthDegrees:e.solarAzimuthDegrees,keyHandoff:e.keyHandoff,cloudBlend:sky?.material.uniforms.cloudBlend?.value??e.cloudBlend,phase:e.phase,night:e.night,skyTime:sky?.material.uniforms.skyTime.value??null,
    fill:{colorLinear:(game.fillLight?.color??e.fill).toArray(),intensity:game.fillLight?.intensity??e.fillIntensity,position:game.fillLight?.position.toArray()??null},
    key:{colorLinear:(game.keyLight?.color??e.key).toArray(),intensity:game.keyLight?.intensity??e.keyIntensity,direction:e.lightDirection.toArray(),sunDirection:e.sunDirection.toArray(),position:game.keyLight?.position.toArray()??null,target:game.keyLight?.target.position.toArray()??null,shadowIntensity:game.keyLight?.shadow.intensity??e.shadowIntensity},
    ambient:{skyLinear:(game.ambientLight?.color??e.sky).toArray(),groundLinear:(game.ambientLight?.groundColor??e.ground).toArray(),intensity:game.ambientLight?.intensity??e.ambientIntensity},exposure:game.renderer.toneMappingExposure??e.exposure,
    environmentMap:{bound:Boolean(game.scene?.environment),intensity:game.scene?.environmentIntensity??null}};
}
function foliageControllers(){return [game.world.vegetation?.lodController,game.world.blossomGroves?.foliage].filter(controller=>typeof controller?.setEnabled==='function');}
function setLocked(locked){for(const id of controlIds)$(id).disabled=locked||captureBusy()||(id==='json'&&!lastReport)||(id==='foliage'&&!foliageControllers().length);}
function renderReadout(){
  const state=game?.reviewRenderingSnapshot();if(!state||!$('render-policy'))return;
  $('render-policy').textContent=`${state.policy} · ${state.pending?'frame requested':state.idle?'cached frame · asleep':'active'} · request ${state.requestedRevision} / last draw ${state.drawnRevision??'none'} · ${state.renderedFrames} actual frames`;
  document.body.dataset.renderPolicy=state.policy;document.body.dataset.renderIdle=String(state.idle);document.body.dataset.drawnRevision=String(state.drawnRevision??'none');
}
// Review-local visual controls may call this without resetting poses or clocks.
// A request only invalidates; the revision is acknowledged after the real pass.
function requestReviewFrame(){const revision=game.requestRender();renderReadout();return revision;}
function syncReviewRendering(){game.setReviewRendering({staticComparison:Boolean(game.options.reducedMotion),continuous:Boolean(session)||!pose});renderReadout();}
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
  setRootedLoamStrength(game.scene,config.rootedLoamStrength??1);
  game.world.atmosphere?.resetActivityForReview?.(config.activityStart??0,config.reducedMotion);
  for(const controller of foliageControllers())controller.setEnabled(config.foliage==='lod');
  game._teleport(18,18,74);game.heading=.35;game.cameraYaw=.35;game.setCameraView('follow');game.setOption('gameplay',false);
  pose=poses[config.view]||null;
  if(pose?.companion)approachCompanion(pose.companion);
  if(config.view==='fauna-release')game.releaseLantern();
  if(config.view==='exhibit')game.enterExhibit('autodesign');
  if(config.view==='flight'){game._teleport(18,27,74);game.setOption('gameplay',true);}
  if(config.view==='ground'){game._teleport(-66,9,65);game.heading=0;game.cameraYaw=0;game.setOption('gameplay',true);game.toggleBroom();}
  game.world.updateVegetation?.(game.camera,{width:canvas.width,height:canvas.height});
  game.renderer.shadowMap.needsUpdate=true;stage=-1;
  syncReviewRendering();
}
function reset(){if(session||disposed||captureBusy())return;resetScene();}
function frameState(){return {rootedLoam:getRootedLoamState(game.scene),herbariumBatches:game._herbariumRenderBatches?.metrics??null,grassDistribution:game.world.vegetation?.grassDistribution??null,waterReflection:game.world.lake?.reflection?.snapshot()??null,herbariumNormal:game.herbariumNormalSnapshot(),groundStudy:groundStudy?.snapshot()??null,pipeline:{outputColorSpace:game.renderer.outputColorSpace??null,toneMapping:game.renderer.toneMapping??null,exposure:game.renderer.toneMappingExposure??null,fog:game.scene?.fog?{type:game.scene.fog.constructor.name,colorLinear:game.scene.fog.color.toArray(),density:game.scene.fog.density??null,near:game.scene.fog.near??null,far:game.scene.fog.far??null}:null},canvas:{width:canvas.width,height:canvas.height,backingWidth:canvas.width,backingHeight:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:game.renderer.getPixelRatio(),nativeDpr:globalThis.devicePixelRatio||1,msaaSamples:game.rendering.samples},camera:{eye:game.camera.position.toArray(),target:pose?.target||null,fov:game.camera.fov,reflectionPair:pose?.reflectionPair?{...pose.reflectionPair,lanternNdc:new THREE.Vector3().fromArray(pose.reflectionPair.center).project(game.camera).toArray(),mirrorNdc:new THREE.Vector3().fromArray(pose.reflectionPair.mirroredCenter).project(game.camera).toArray()}:null},rider:{position:game.position?.toArray(),mode:game.locomotion?.mode,speed:game.locomotion?.groundSpeed},lighting:lightingSnapshot(),fauna:game.world.atmosphere?.fauna?.snapshot()??null,companions:game.companionSnapshot()};}
function applySampling(){
  const sampling=session?.metadata.sampling||$('sampling').value,dpr=sampling==='2x'?2:sampling==='2.5x'?2.5:null;
  if(dpr!==null){
    const width=game._width||canvas.clientWidth,height=game._height||canvas.clientHeight;
    game._dpr=dpr;game.renderer.setPixelRatio(dpr);game.renderer.setSize(width,height,false);game.rendering.resize(width,height,dpr);
  }
  const size=frameState().canvas;
  $('sampling-size').textContent=`${size.cssWidth} × ${size.cssHeight} CSS → ${size.width} × ${size.height} px · DPR ${size.dpr}`;
}
function acquire(kind,{enableMotion=false}={}){
  if(session||disposed||!fullReady||captureBusy())return null;
  // Companion expectedDurationMs remains the legacy minimum. Its explicit wall
  // policy lets slow frames finish the same greeting/audio/real-distance gates.
  const current={id:++run,kind,phase:'preparing',metadata:conditions(),createdAt:new Date().toISOString(),requestedAt:performance.now(),startedAt:null,stoppedAt:null,expectedDurationMs:kind==='measure'?20000:kind==='companion'?companionDuration.minimumMs:24000,...(kind==='companion'?{durationPolicy:{...companionDuration},completionFrame:null}:{}),captureErrors:[],motionSamples:[]};
  // Start from the quiet static view so the trusted recording click also arms
  // motion. Its real recorded conditions remain separate from UI restoration.
  if(enableMotion&&current.metadata.reducedMotion){current.restoreReducedMotion=true;current.metadata.reducedMotion=false;$('reduced-motion').checked=false;}
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
  clearTimeout(current.durationTimer);current.durationTimer=null;
  current.phase='finalizing';current.stoppedAt=performance.now();current.reason=reason;current.completed=completed;current.finalState=frameState();
  if(current.kind==='companion'&&completed){
    const snapshot=current.finalState.companions,interrupted=companionInterruption(current,snapshot);
    observeCompanion(current,snapshot);
    if(interrupted||!companionCompleted(current,snapshot)){current.completed=false;current.reason=interrupted||'companion-encounter-incomplete';}
    else if(!companionRenderedCompleted(current)){current.completed=false;current.reason='companion-completion-not-rendered';}
  }
  metrics.active=false;clearInput();status('收尾 GPU 查询与录制文件…');
  current.stopPromise=(async()=>{
    const gpuResult=metrics.finalize();
    if(current.recorder?.state==='recording'||current.recorder?.state==='paused'){
      try{current.recorder.stop();}catch(error){current.completed=false;current.reason=`recorder-stop-failed: ${error.message}`;current.releaseRecorder?.();}
    }else if(!current.recorder)current.releaseRecorder?.();
    const [result]=await Promise.all([gpuResult,current.recorderDone]);
    const elapsedDurationMs=current.startedAt===null?0:current.stoppedAt-current.startedAt;
    lastReport={createdAt:current.createdAt,finishedAt:new Date().toISOString(),run:current.id,kind:current.kind,...current.metadata,...current.finalState,
      completed:current.completed,invalid:!current.completed,reason:current.reason,expectedDurationMs:current.expectedDurationMs,...(current.durationPolicy?{durationPolicy:current.durationPolicy}:{}),elapsedDurationMs,
      warmup:{requiredMs:current.kind==='measure'?warmupMs:0,elapsedMs:current.warmupStartedAt===undefined?0:(current.startedAt??current.stoppedAt)-current.warmupStartedAt,completed:current.startedAt!==null},
      workload:current.kind==='companion'?'actual-companion-encounter':current.metadata.view==='ground'?'scripted-ground':current.metadata.view==='flight'?'scripted-flight':current.metadata.timeOfDay==='auto'?'daylight-cycle':'fixed-view',encounter:current.encounter??null,audioCapture:current.audioCapture??null,renderedCompanionCompletion:current.completionFrame??null,renderedLighting:{first:current.firstRenderedLighting??null,last:current.lastRenderedLighting??null},renderedFauna:{first:current.firstRenderedFauna??null,last:current.lastRenderedFauna??null},motionSamples:current.motionSamples,captureErrors:current.captureErrors,...result};
    if(current.mediaName&&!disposed){const error=await download(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),current.mediaName.replace(/\.(webm|mp4)$/,'.json'));if(error)lastReport.captureErrors.push(error);}
    $('metrics').textContent=JSON.stringify(lastReport,null,2);
    if(session===current){
      session=null;
      if(current.restoreReducedMotion&&!disposed){$('reduced-motion').checked=true;game.setOption('reducedMotion',true);}
      syncReviewRendering();setLocked(disposed||!fullReady);$('json').disabled=disposed||!lastReport;
      status(`${current.kind==='companion'?`${companionRecordingStatus(current,elapsedDurationMs)}；`:''}${current.completed?'完成；测量记录可下载。':`已中断：${current.reason}；导出标记为 invalid。`}`);
    }
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
function companionInterruption(current,snapshot,checkInteraction=true){
  if(game._isPaused?.()||game.paused||snapshot.paused)return 'companion-paused';
  if(game.options.reducedMotion||snapshot.reducedMotion)return 'companion-reduced-motion';
  const encounter=current.encounter,actor=snapshot.actors.find(a=>a.id===encounter?.actorId);
  if(snapshot.disposed||!actor?.valid||snapshot.owner!==encounter?.owner)return 'companion-invalid';
  const expected=encounter.accepted?encounter.interactionCount:encounter.initialInteractions;
  if(checkInteraction&&actor.interactionCount!==expected)return 'companion-interaction-changed';
  return null;
}
function observeCompanion(current,snapshot){
  const encounter=current.encounter;if(!encounter?.accepted)return;
  for(const event of snapshot.audio.recentEvents||[])if(event.sequence>encounter.acceptedAudioSequence&&event.actorId===encounter.actorId&&event.acceptedTime>=encounter.acceptedAt&&event.acceptedTime<=snapshot.activeTime&&!encounter.audioEvents.some(previous=>previous.sequence===event.sequence))encounter.audioEvents.push({...event});
  const actor=snapshot.actors.find(a=>a.id===encounter.actorId),receipt=actor?.completedInteraction;
  encounter.completion=receipt?.interactionCount===encounter.interactionCount&&receipt.startedAt===encounter.acceptedAt?{...receipt}:null;
}
function companionCompleted(current,snapshot){
  const encounter=current.encounter,actor=snapshot.actors.find(a=>a.id===encounter?.actorId),receipt=encounter?.completion;
  return Boolean(encounter?.accepted&&actor?.valid&&!actor.busy&&['rest','walk'].includes(actor.state)&&actor.interactionCount===encounter.interactionCount&&receipt&&
    receipt.completedAt>receipt.startedAt&&receipt.resumedAt>receipt.completedAt&&receipt.resumedAt<=snapshot.activeTime&&receipt.resumedDistance>receipt.distance+.05&&actor.distance>=receipt.resumedDistance&&
    actor.distance-encounter.initialDistance>=1&&encounter.audioEvents.some(event=>event.kind===(actor.kind==='elizabeth'?'sign-tap':'dog-breath')&&event.acceptedTime<=receipt.completedAt));
}
function companionRecordingStatus(current,elapsedMs){
  const {minimumMs,maximumMs}=current.durationPolicy;
  return `录制 ${(elapsedMs/1000).toFixed(1)} s · 最少 ${minimumMs/1000} s / 最长 ${maximumMs/1000} s`;
}
function companionRenderedCompleted(current){
  const frame=current.completionFrame;
  return Boolean(frame?.run===current.id&&companionCompleted({encounter:frame.encounter},frame.companions));
}
function updateCompanionRecording(current,allowRenderedCompletion=false){
  if(session!==current||current.phase!=='running')return;
  const snapshot=game.companionSnapshot(),interrupted=companionInterruption(current,snapshot);
  if(interrupted){void stop(interrupted);return;}
  observeCompanion(current,snapshot);
  const elapsedMs=performance.now()-current.startedAt,{minimumMs,maximumMs}=current.durationPolicy;
  // Consume the copied proof on a later tick, after its successful canvas draw.
  // The independent watchdog never upgrades CPU state into rendered evidence.
  if(allowRenderedCompletion&&elapsedMs>=minimumMs&&elapsedMs<=maximumMs&&companionRenderedCompleted(current)&&companionCompleted(current,snapshot)){void stop('completed',true);return;}
  if(elapsedMs>=maximumMs){void stop('companion-encounter-timeout-180s');return;}
  status(`${companionRecordingStatus(current,elapsedMs)}${elapsedMs>=minimumMs?'；等待真实互动、声音与恢复巡游证据':''}`);
}
function companionSequence(current){
  const snapshot=game.companionSnapshot(),encounter=current.encounter;
  if(!encounter)return;
  const interrupted=companionInterruption(current,snapshot);if(interrupted){void stop(interrupted);return;}
  observeCompanion(current,snapshot);
  const elapsed=snapshot.activeTime-encounter.initialActiveTime;
  if(!encounter.accepted&&elapsed>=encounter.nextAttempt&&encounter.attempts.length<6){
    if(!approachCompanion(encounter.actorId))return;
    const beforeCount=snapshot.actors.find(a=>a.id===encounter.actorId).interactionCount,dispatched=game.interact({companionId:encounter.actorId});
    if(session!==current||current.phase!=='running')return;
    const after=game.companionSnapshot(),actor=after.actors.find(a=>a.id===encounter.actorId);
    const accepted=dispatched&&actor?.valid&&actor.busy&&actor.interactionCount===beforeCount+1;
    encounter.attempts.push({acceptedTime:after.activeTime,accepted});encounter.accepted=accepted;encounter.nextAttempt=elapsed+1;
    if(accepted){encounter.acceptedAt=after.activeTime;encounter.interactionCount=actor.interactionCount;encounter.acceptedAudioSequence=after.audio.played;}
  }
}
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
  if(current.kind==='companion'){companionSequence(current);updateCompanionRecording(current,true);return;}
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
  const current=acquire(kind,{enableMotion:kind==='companion'});if(!current)return null;
  try{
    if(kind==='companion'&&!pose?.companion)throw new Error('Select a companion view / 请选择角色机位');
    if(kind==='audition'||kind==='companion'){game.setOption('sound',true);current.metadata.sound=true;await game.audio.unlock();await game.audio._musicPromise;}
    if(session!==current||current.phase!=='preparing'||disposed)return null;
    const stream=canvas.captureStream(30),recorded=[];let audioOutput=null,audioTap=null,released=false,resolveRecorder;
    current.recorderDone=new Promise(resolve=>{resolveRecorder=resolve;});
    current.releaseRecorder=()=>{if(released)return;released=true;try{if(audioOutput)audioTap.disconnect(audioOutput);}catch(error){current.captureErrors.push(`audio-tap-release: ${error.message}`);}finally{for(const track of new Set([...stream.getTracks(),...(audioOutput?.stream.getAudioTracks()||[])]))try{track.stop();}catch(error){current.captureErrors.push(`track-release: ${error.message}`);}if(current.recorder)current.recorder.ondataavailable=current.recorder.onerror=current.recorder.onstop=null;resolveRecorder();}};
    if(kind==='audition'||kind==='companion'){
      if(!game.audio.enabled||!game.audio.unlocked||game.audio.suspended||game.audio.context?.state!=='running')throw new Error('Audio output is not running / 声音输出尚未运行');
      audioOutput=game.audio.context.createMediaStreamDestination();audioTap=game.audio.limiter||game.audio.master;audioTap.connect(audioOutput);
      const tracks=audioOutput.stream.getAudioTracks();if(!tracks.length||tracks.some(track=>track.readyState==='ended'))throw new Error('No live audio track / 没有可录制的音轨');for(const track of tracks)stream.addTrack(track);
      current.audioCapture={enabled:true,contextState:game.audio.context.state,trackCount:tracks.length,tap:game.audio.limiter?'limiter':'master'};
    }
    if(kind==='companion'){
      const snapshot=game.companionSnapshot(),actor=snapshot.actors.find(a=>a.id===selectedCompanion());if(!actor?.valid||actor.busy)throw new Error('Companion is unavailable or already greeting / 角色尚未就绪或正在互动');
      current.encounter={owner:snapshot.owner,actorId:actor.id,initialActiveTime:snapshot.activeTime,initialDistance:actor.distance,initialInteractions:actor.interactionCount,initialAudioSequence:snapshot.audio.played,accepted:false,acceptedAt:null,interactionCount:null,acceptedAudioSequence:null,completion:null,nextAttempt:4,attempts:[],audioEvents:[]};
    }
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
    if(kind==='companion'){
      current.durationTimer=setTimeout(()=>updateCompanionRecording(current),current.durationPolicy.maximumMs);
      updateCompanionRecording(current);return current;
    }
    status(`录制 0.0 / ${current.expectedDurationMs/1000} s`);return current;
  }catch(error){current.releaseRecorder?.();await stop(`recording-start-failed: ${error.message}`);return null;}
}
function addFoliageControl(){
  const label=document.createElement('label');label.append('植被 ');const select=document.createElement('select');select.id='foliage';
  for(const [value,text] of [['lod','空间 LOD'],['full','完整几何']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value=foliageControllers().length?'lod':'full';label.append(select);$('reset').parentElement.insertBefore(label,$('reset'));
  if(!foliageControllers().length)select.title='此历史版本没有 LOD 控制器，使用完整几何。';
  select.onchange=reset;
}
function addDiagnosticControls(){
  const groundLabel=document.createElement('label'),ground=document.createElement('select');ground.id='ground-study';
  for(const [value,text]of [['0','Original / 原地表'],['0.5','Source chroma 50% / 原材质色彩 50%']]){const option=document.createElement('option');option.value=value;option.textContent=text;ground.append(option);}
  ground.value=String(groundStudy.snapshot().strength);ground.title='Review only: same loaded scene, light, camera and material detail. Local source chroma comparison preserves linear albedo luminance.';
  ground.onchange=()=>{if(!fullReady||session||disposed||captureBusy())return;groundStudy.set(Number(ground.value));lastReport=null;$('json').disabled=true;requestReviewFrame();};
  groundLabel.append('Ground study / 地表对照 ',ground);$('reset').parentElement.insertBefore(groundLabel,$('reset'));
  const loamLabel=document.createElement('label'),loam=document.createElement('select');loam.id='rooted-loam';
  for(const [value,text]of [['0','Original ground / 原地表'],['1','Rooted loam / 花境土色']]){const option=document.createElement('option');option.value=value;option.textContent=text;loam.append(option);}
  loam.value='1';loam.onchange=()=>{if(!fullReady||session||disposed||captureBusy())return;lastReport=null;$('json').disabled=true;setRootedLoamStrength(game.scene,Number(loam.value));requestReviewFrame();};
  loamLabel.append('Planting soil / 花境地表 ',loam);$('reset').parentElement.insertBefore(loamLabel,$('reset'));
  for(const [value,text] of [['companion-elizabeth','Elizabeth · full body / 伊丽莎白全身'],['companion-elizabeth-close','Elizabeth · sign and face / 伊丽莎白脸与牌'],['companion-sadaharu','Sadaharu · walk and greeting / 定春行走与招呼'],['companion-sadaharu-close','Sadaharu · face and paws / 定春脸与脚掌']]){const option=document.createElement('option');option.value=value;option.textContent=text;$('view').append(option);}
  const language=document.createElement('select');language.id='companion-language';for(const [value,text] of [['zh','中文牌面'],['en','English signs']]){const option=document.createElement('option');option.value=value;option.textContent=text;language.append(option);}language.value=game.options.lang||'zh';language.onchange=()=>{if(!session&&!disposed&&!captureBusy()){game.setOption('lang',language.value);requestReviewFrame();}};$('reset').parentElement.insertBefore(language,$('reset'));
  const greet=document.createElement('button');greet.id='companion-action';greet.textContent='Approach & greet / 靠近打招呼';greet.onclick=greetCompanion;$('reset').parentElement.insertBefore(greet,$('reset'));
  const pause=document.createElement('button');pause.id='companion-pause';pause.textContent='Pause / 暂停';pause.onclick=()=>{if(session||disposed||captureBusy())return;game.setPaused(!game.paused);requestReviewFrame();pause.textContent=game.paused?'Resume / 继续':'Pause / 暂停';};$('reset').parentElement.insertBefore(pause,$('reset'));
  const capture=document.createElement('button');capture.id='companion-record';capture.textContent='Record real encounter + audio / 录制真实互动与声音';capture.title='Record at least 48 seconds, until walking, greeting, audio and resumed roaming pass; 180-second wall limit / 最少 48 秒，真实行走、互动、声音与恢复巡游通过后结束，最长 180 秒';capture.onclick=()=>record('companion');$('reset').parentElement.insertBefore(capture,$('reset'));
  const feedback=document.createElement('output');feedback.id='companion-feedback';feedback.setAttribute?.('role','status');$('reset').parentElement.append(feedback);
  for(const [value,text] of [['arrival','Arrival lawn / 到达草坪'],['castle-forecourt','Castle forecourt / 城堡前庭'],['conservatory','Conservatory / 温室'],['conservatory-interior','Conservatory interior / 温室内廊'],['arcade-passage','Arcade passage · 1.7 m eye / 拱廊步行视角'],['water-garden','Water garden / 水庭'],['water-entry','Water garden entry / 水庭入口'],['west-community','Southwest community / 西南群落'],['east-community','Conservatory grove / 温室林缘'],['castle-footing','Castle footing / 城堡落脚'],['contact-bridge','Bridge contact / 桥头接地'],['shore-detail','Shore detail / 岸线细节'],['fauna-birds','Live swallow follow / 燕群跟随'],['fauna-lanterns','Live paper lanterns / 纸灯近景'],['fauna-fireflies','Live firefly habitat / 萤火栖地'],['full-moon','Complete moon / 完整月面'],['fauna-release','Released lantern follow / 放飞纸灯跟随'],['fauna-reflection','Water mirror context / 水面倒影全景'],['fauna-reflection-pair','Paired lantern reflection / 单灯与倒影']]){const option=document.createElement('option');option.value=value;option.textContent=text;$('view').append(option);}
  const label=document.createElement('label');label.append('像素采样 ');const select=document.createElement('select');select.id='sampling';
  for(const [value,text] of [['native','Native'],['2x','2x'],['2.5x','2.5x']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value='native';select.title='2x / 2.5x 是每 CSS 像素的采样密度。为隔离采样影响，请固定“完整几何”。';select.onchange=reset;
  label.append(select);$('reset').parentElement.insertBefore(label,$('reset'));
  const motionLabel=document.createElement('label'),motion=document.createElement('input');motion.id='reduced-motion';motion.type='checkbox';motion.checked=false;motion.onchange=reset;
  motionLabel.append(motion,'静态对照 / reduced motion');$('reset').parentElement.insertBefore(motionLabel,$('reset'));
  const lightingLabel=document.createElement('label'),lighting=document.createElement('select');lighting.id='lighting-variant';
  for(const variant of LIGHTING_REVIEW_VARIANTS){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.label;lighting.append(option);}
  lighting.value='solar-120-sunlit';lighting.onchange=reset;lighting.title='One variable per trial. Pearl preserves fill luminance/intensity; solar rotates the real sun/key with baseline fill. Match view, time, full geometry, native pixels and static motion.';
  lightingLabel.append('光照对照 ',lighting);$('reset').parentElement.insertBefore(lightingLabel,$('reset'));
  const phaseLabel=document.createElement('label'),phase=document.createElement('input');phase.id='phase-start';phase.type='number';phase.min='0';phase.max='.9999';phase.step='.001';phase.value='';phase.placeholder='0–1';phase.onchange=reset;
  phase.title='Optional exact starting phase when Auto is selected. Static captures freeze here; uncheck reduced motion to record the unchanged 240 s cycle.';
  phaseLabel.append('Auto start phase / 自动起始时刻 ',phase);$('reset').parentElement.insertBefore(phaseLabel,$('reset'));
  const activityLabel=document.createElement('label'),activity=document.createElement('input');activity.id='activity-start';activity.type='number';activity.min='0';activity.step='.1';activity.value='0';activity.onchange=reset;activity.title='Review-only accepted activity seconds. Reset clears only the bounded manual lantern pool. Gameplay pause/reduced motion never reset activity.';activityLabel.append('Activity start / 活动秒数 ',activity);$('reset').parentElement.insertBefore(activityLabel,$('reset'));
  const release=document.createElement('button');release.id='release-lantern';release.textContent='Release lantern / 放飞纸灯';release.onclick=()=>{if(!session&&!disposed&&!captureBusy()){game.releaseLantern();requestReviewFrame();}};$('reset').parentElement.insertBefore(release,$('reset'));
  const readout=document.createElement('span');readout.id='sampling-size';$('reset').parentElement.append(readout);
  const renderPolicy=document.createElement('output');renderPolicy.id='render-policy';renderPolicy.setAttribute?.('role','status');$('reset').parentElement.append(renderPolicy);
}
try{
  $('loading-policy').textContent=loadingMode==='staged'?'Staged review loading · 15-minute enhancement/full-frame budget. The real core frame is held during loading; final rendering quality is unchanged. This is not a normal startup measurement.':'Progressive review loading · continuous rendering; existing core/enhancement time limits.';
  milestone('living-v8 · accepted lighting and live fauna; full frame required');
  const query=new URLSearchParams(globalThis.location?.search||'');
  initializeCaptureSequence(query);
  const requestedView=query.get('view'),requestedLight=query.get('light'),requestedLighting=query.get('lighting');
  lightingStudyRequested=LIGHTING_REVIEW_VARIANTS.some(v=>v.id===requestedLighting);
  if(requestedLight&&['day','night','dawn','dusk','auto'].includes(requestedLight))$('light').value=requestedLight;
  game=await Game.createAsync(canvas,{onMessage:text=>{if($('companion-feedback'))$('companion-feedback').textContent=text[game?.options.lang||'zh'];},onFrame:s=>{if(game)renderReadout();if(session?.kind==='companion'&&session.phase==='running'){const reason=companionInterruption(session,s.companions||game.companionSnapshot(),false);if(reason)void stop(reason);}if(!session&&!lastReport&&game&&$('sampling'))$('metrics').textContent=JSON.stringify({updateFps:s.fps,renderedFrames:s.renderedFrames,reviewRendering:s.reviewRendering,locomotion:s.locomotion,illumination:s.illumination,sampling:$('sampling').value,reducedMotion:Boolean(game.options.reducedMotion),...frameState(),drawCalls:s.drawCalls,submittedTriangles:s.triangles,lod:game.world.vegetation?.lod,audio:s.audio},null,2);}}, {quality:$('quality').value,timeOfDay:$('light').value,gameplay:false,lang:'zh'},{signal:lifetime.signal,reviewDemandRendering:true,deadline:performance.now()+180000,...(loadingMode==='staged'?{reviewEnhancementBudgetMs:REVIEW_ENHANCEMENT_BUDGET_MS}:{}),onProgress:loadProgress,preloadNightEnvironment:true,onRenderer:renderer=>{renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{const message=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join(' · ');loadProgress({phase:'render-error',activeResource:message});console.error(message);};}});
  if(disposed){game.dispose();throw new DOMException('Review closed','AbortError');}
  reviewLoading.attach(game);if(reviewLoading.failed)throw new Error('Staged review loading failed');
  groundStudy=createGroundChromaStudy(game.scene);metrics=new ReviewMetrics(game.renderer);addFoliageControl();addDiagnosticControls();
  const requestedPhase=query.get('phase');if(requestedPhase!==null&&requestedPhase.trim()!==''&&Number(requestedPhase)>=0&&Number(requestedPhase)<1)$('phase-start').value=String(Number(requestedPhase));
  const requestedActivity=query.get('activity');if(requestedActivity!==null&&Number.isFinite(Number(requestedActivity))&&Number(requestedActivity)>=0)$('activity-start').value=String(Number(requestedActivity));
  if(lightingStudyRequested){$('lighting-variant').value=requestedLighting;$('reduced-motion').checked=true;$('foliage').value='full';}
  if(captureBusy()){$('quality').value='high';$('sampling').value='native';$('reduced-motion').checked=true;$('foliage').value='full';}
  if(requestedView&&[...Object.keys(poses),'flight','ground','exhibit'].includes(requestedView))$('view').value=requestedView;
  const resize=game._resize.bind(game);
  let captureScale=captureScaleSnapshot();
  game._resize=(...args)=>{
    resize(...args);applySampling();
    // Same-quality view/light resets may transiently change sampling. Compare
    // only the final tuple against the last completed resize, not new DOM size.
    const next=captureScaleSnapshot();if(next.some((value,index)=>value!==captureScale[index]))captureEpoch++;
    captureScale=next;requestReviewFrame();
  };
  const cameraUpdate=game._updateCamera.bind(game);
  game._updateCamera=(...args)=>{if(!pose)return cameraUpdate(...args);if(pose.companion){const actor=game.companionSnapshot().actors.find(a=>a.id===pose.companion);if(actor){const p=actor.position,h=actor.heading,offset=pose.close?[.6,2.0,5.3]:[5.8,3.4,7.4];pose.target=[p.x,p.y+(pose.close?1.9:1.45),p.z];pose.eye=[p.x+Math.cos(h)*offset[0]+Math.sin(h)*offset[2],p.y+offset[1],p.z-Math.sin(h)*offset[0]+Math.cos(h)*offset[2]];}}const motion=game.world.atmosphere?.fauna.motion;if(pose.reflection){const framing=frameLanternReflection(game.world.atmosphere?.fauna,game.world.lake?.water);if(framing)Object.assign(pose,framing);}if(pose.fauna&&motion){const item=pose.fauna==='bird'?motion.flocks[0]?.birds[0]:pose.fauna==='lantern'?motion.lanterns[0]:pose.fauna==='release'?motion.released.find(item=>item.active):motion.insects[0];if(item){const center=(pose.fauna==='lantern'?item.base:item.position).toArray(),offset=pose.fauna==='bird'?[2,1.1,-3]:['lantern','release'].includes(pose.fauna)?[2,-.9,3.8]:[.3,.3,1.6];if(['lantern','release'].includes(pose.fauna))center[1]+=.65;pose.target=center;pose.eye=center.map((v,i)=>v+offset[i]);}}if(pose.moon&&game.environment){pose.target=game.environment.moonDirection.toArray().map((v,i)=>pose.eye[i]+v*120);}const eye=[...pose.eye];if(pose.eyeHeight)eye[1]=game.world.heightAt(eye[0],eye[2])+pose.eyeHeight;game.camera.position.fromArray(eye);game.camera.fov=pose.fov??43;game.camera.lookAt(new THREE.Vector3(...pose.target));game.camera.updateProjectionMatrix();game.camera.updateMatrixWorld();};
  const render=game.rendering.render.bind(game.rendering);
  game.rendering.render=dt=>{
    const capture=saveFrame,renderRevision=game.reviewRenderingSnapshot()?.drawingRevision;
    updateSequence();const current=session,now=performance.now(),query=metrics.before(now);try{render(dt);}catch(error){loadProgress({phase:'render-error',activeResource:error.message});throw error;}
    metrics.after(query,performance.now()-now,{near:game.world.vegetation?.lod?.nearCount,mid:game.world.vegetation?.lod?.midCount,far:game.world.vegetation?.lod?.farCount});
    if(session===current&&current?.phase==='running'&&!renderFailed&&!disposed){
      const lighting=lightingSnapshot();current.firstRenderedLighting??=lighting;current.lastRenderedLighting=lighting;
      const fauna=game.world.atmosphere?.fauna?.snapshot()??null;current.firstRenderedFauna??=fauna;current.lastRenderedFauna=fauna;
      const elapsedDurationMs=performance.now()-current.startedAt,seconds=elapsedDurationMs/1000,companions=current.kind==='companion'?copy(game.companionSnapshot()):game.companionSnapshot(),previousCompletion=current.completionFrame;
      if(current.kind==='companion'){
        observeCompanion(current,companions);
        if(!current.completionFrame&&elapsedDurationMs<=current.durationPolicy.maximumMs&&!companionInterruption(current,companions)&&companionCompleted(current,companions))current.completionFrame={run:current.id,elapsedDurationMs,renderRevision:renderRevision??null,companions,encounter:copy(current.encounter)};
      }
      // The first rendered complete pose is evidence even inside the normal
      // 0.5-second sample interval. Stopping waits for the following tick.
      if(current.completionFrame!==previousCompletion||!current.motionSamples.length||seconds-current.motionSamples.at(-1).seconds>=.5)current.motionSamples.push({seconds,fauna,camera:frameState().camera,companions});
    }
    if(capture&&saveFrame===capture&&fullReady&&!renderFailed&&!session&&!disposed){
      const metadata=copy({...conditions(),...frameState(),capturedAt:new Date().toISOString(),evidenceType:'actual-frame',renderRequest:{requestedRevision:capture.revision,drawnRevision:renderRevision}});saveFrame=null;
      try{
        // Copies this completed default framebuffer BEFORE any async save work.
        const pending=submitStillFrame(capture,metadata);
        if(capture.owner)void saveAutomaticFrame(capture,metadata,pending);else void saveManualFrame(metadata,pending);
      }catch(error){if(capture.owner){capture.reject(error);abortCaptureSequence(error.message);}else status(`Frame capture failed / 画帧失败：${error.message}`);}
    }
  };
  $('reset').onclick=reset;$('view').onchange=reset;$('light').onchange=reset;$('quality').onchange=reset;
  $('measure').onclick=()=>begin('measure');$('record').onclick=()=>record('record');$('audition').onclick=()=>record('audition');
  $('frame').onclick=()=>{if(fullReady&&!renderFailed&&!session&&!disposed&&!captureBusy())saveFrame={revision:requestReviewFrame()};};
  $('sound').onclick=()=>{if(session||disposed||captureBusy())return;game.setOption('sound',!game.options.sound);$('sound').textContent=game.options.sound?'关闭试听':'开启试听';};
  $('json').onclick=()=>{if(!session&&!captureBusy()&&lastReport)void download(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),reviewFilename(lastReport,'metrics','json'));};
  window.addEventListener('blur',()=>{if(session?.kind==='companion'&&session.phase!=='finalizing')void stop('window-blurred');},{signal:lifetime.signal});
  if(captureBusy())resetScene();else reset();setLocked(true);status('核心场景已显示；等待全部增强与完整场景首帧。');
}catch(error){if(!disposed){reviewLoading.fail(error);abortCaptureSequence(error.message);status(`载入失败：${error.message}`);console.error(error);}}
