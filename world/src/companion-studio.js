import './published-three-assets.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadCompanionAssets,createCompanionActor,companionAssetDiagnostics} from './companion-assets.js';
import {companionManifest} from './companion-manifest.js';

const el=id=>document.getElementById(id),query=new URLSearchParams(location.search),canvas=document.querySelector('canvas');
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,2,-2,.01,200);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minZoom=.3;controls.maxZoom=7;
const hemi=new THREE.HemisphereLight('#e4edf1','#6a655c',2);scene.add(hemi);
const key=new THREE.DirectionalLight('#fff4e5',3);key.position.set(-3.8,6,4.5);key.target.position.set(0,1.5,0);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:25});key.shadow.normalBias=.005;key.shadow.bias=-.00008;scene.add(key,key.target);
const fill=new THREE.DirectionalLight('#c3d9ef',1.2);fill.position.set(4,3.4,2.5);scene.add(fill);
const rim=new THREE.DirectionalLight('#ffffff',1.4);rim.position.set(1,5,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#757f86',roughness:.98}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(12,24,'#5b6467','#70797b');grid.position.y=.002;grid.material.transparent=true;grid.material.opacity=.34;scene.add(grid);
let actor=null,view=query.get('view')||'threequarter',light=query.get('light')||'neutral',paused=query.get('paused')==='1',last=performance.now(),recording=null,rafId=0,disposed=false,suspended=false;
const downloadURLs=new Map();
const assetControls=['kind','action','pause','time','language','reduced','fur-visible','fur-receive-shadow','save-frame','record-clip'].map(el);
el('kind').value=query.get('kind')==='sadaharu'?'sadaharu':'elizabeth';el('language').value=query.get('lang')==='en'?'en':'zh';
el('reduced').checked=query.get('reduced')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches;
function status(text,error=false){el('status').textContent=text;el('status').dataset.error=String(error);}
function setPaused(value){paused=value;el('pause').textContent=paused?'Play':'Pause';el('pause').setAttribute('aria-pressed',String(paused));}
function setView(next){
  view=next;const dog=actor?.kind==='sadaharu';
  const height=next==='face'?(dog?1.8:1.55):(dog?4.4:4.4),aspect=canvas.clientWidth/canvas.clientHeight;
  camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.zoom=1;camera.updateProjectionMatrix();
  const target=new THREE.Vector3(next==='face'?0:dog?0:.45,next==='face'?(dog?2.38:2.46):1.60,dog?-.25:0);
  const offsets={front:[0,0,8],profile:[-8,.55,0],back:[0,0,-8],threequarter:[4.8,1.8,6.8],face:[0,0,8]};
  camera.position.copy(target).add(new THREE.Vector3(...(offsets[next]||offsets.threequarter)));controls.target.copy(target);controls.update();
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===next)));
}
function setLight(mode){
  light=mode;const night=mode==='night',day=mode==='day';
  scene.background=new THREE.Color(mode==='bright'?'#f1f0ea':mode==='dark'?'#17222d':night?'#172839':day?'#b9c7ce':'#89949b');
  key.color.set(night?'#abc8e9':day?'#fff0d6':'#fff5e9');key.intensity=night?1.05:day?3.5:2.8;
  hemi.intensity=night?.8:2;fill.intensity=night?.55:1.2;rim.intensity=night?1.1:1.4;
  floor.material.color.set(mode==='bright'?'#d8dad7':mode==='dark'?'#26313a':night?'#304254':'#788187');el('light').value=mode;
}
function setAction(name){
  if(recording)throw new Error('Stop the current recording before changing actions.');
  actor.setAction(name);el('action').value=name;actor.update(0,{reducedMotion:el('reduced').checked,speed:actor.asset.walk?actor.asset.walk.stride/actor.asset.walk.duration:0});
  el('time').max=String(actor.duration||3);el('time').value='0';
}
function setKind(kind){
  if(recording)throw new Error('Stop the current recording before changing characters.');
  actor?.dispose();actor=createCompanionActor(kind,{lang:el('language').value});scene.add(actor.group);
  const fur=actor.model.getObjectByName('FineDirectionalFurCards');el('fur-diagnostics').hidden=!fur;
  if(fur){el('fur-visible').checked=fur.visible;el('fur-receive-shadow').checked=fur.receiveShadow;}
  const actions=actor.supportedActions.length?actor.supportedActions:['idle'];
  el('action').replaceChildren(...actions.map(name=>{const option=document.createElement('option');option.value=name;option.textContent=name.replaceAll('_',' ');return option;}));
  setAction(actions.includes(query.get('action'))?query.get('action'):'idle');setView(view);
  status(`${actor.asset.name} decoded · ${actor.asset.phase}`);
}
function evidence(){const fur=actor.model.getObjectByName('FineDirectionalFurCards');return {kind:actor.kind,assetSHA256:actor.asset.sha256,action:actor.action,clip:actor.clip,time:actor.time,view,light,language:actor.language,paused,reducedMotion:el('reduced').checked,coatDiagnostics:actor.kind==='sadaharu'?{furLayerPresent:Boolean(fur),furVisible:fur?.visible??false,furReceivesShadows:fur?.receiveShadow??false}:null,camera:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,viewport:{cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,pixelWidth:canvas.width,pixelHeight:canvas.height,devicePixelRatio:devicePixelRatio||1,renderPixelRatio:renderer.getPixelRatio()}};}
async function saveBlob(name,blob){
  try{
    const response=await fetch(`/__review_capture/${name}`,{method:'POST',body:blob});
    if(response.ok)return 'server';
  }catch{/* Static deployments have no local capture endpoint. */}
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  downloadURLs.set(url,setTimeout(()=>{URL.revokeObjectURL(url);downloadURLs.delete(url);},60000));
  return 'download';
}
function captureName(extension){return `companion-${actor.kind}-${actor.asset.sha256.slice(0,8)}-${actor.clip||'static'}-${view}-${Date.now()}.${extension}`;}
async function saveFrame(){
  renderer.render(scene,camera);const metadata=evidence(),name=captureName('png');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('The renderer could not capture a PNG.');
  const destination=await saveBlob(name,blob);await saveBlob(name.replace(/\.png$/,'.json'),new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'}));
  status(`${destination==='server'?'Saved':'Downloaded'} ${name}`);return name;
}
function releaseRecording(session){
  if(session.released)return false;
  session.released=true;clearTimeout(session.timer);session.timer=null;
  if(session.recorder){
    session.recorder.ondataavailable=session.recorder.onstop=session.recorder.onerror=null;
    try{if(session.recorder.state!=='inactive')session.recorder.stop();}catch{/* Stopping tracks still releases a failed recorder. */}
  }
  session.stream.getTracks().forEach(track=>track.stop());
  if(recording===session){
    recording=null;
    for(const [node,disabled] of session.locked)node.disabled=disabled;
    controls.enabled=session.controlsEnabled;el('record-clip').textContent=session.buttonLabel;
  }
  return true;
}
function stopRecording(session=recording){
  if(!session||session.released)return;
  try{if(session.recorder.state==='recording')session.recorder.stop();}
  catch(error){releaseRecording(session);status(error.message,true);}
}
async function recordClip(){
  if(recording){stopRecording();return;}
  if(typeof MediaRecorder!=='function'||!canvas.captureStream)throw new Error('Clip recording is unavailable in this browser.');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw new Error('This browser cannot record a WebM clip.');
  const duration=actor.action==='sign'?3.55:(actor.duration||3);actor.setAction(actor.action);actor.seek(0);setPaused(false);
  last=performance.now();renderer.render(scene,camera);
  const requestedFrameRate=30,videoBitsPerSecond=Math.max(12000000,Math.ceil(canvas.width*canvas.height*requestedFrameRate*.2));
  const parts=[],name=captureName('webm');
  const locked=new Map([...document.querySelectorAll('select,input,button')].filter(node=>node.id!=='record-clip').map(node=>[node,node.disabled]));
  const session={stream:canvas.captureStream(requestedFrameRate),recorder:null,locked,controlsEnabled:controls.enabled,buttonLabel:el('record-clip').textContent,timer:null,startedAt:0,metadata:null,released:false};
  recording=session;
  try{
    const recorder=new MediaRecorder(session.stream,{mimeType:mime,videoBitsPerSecond});session.recorder=recorder;
    for(const node of locked.keys())node.disabled=true;
    controls.enabled=false;el('record-clip').textContent='Stop recording';
    recorder.ondataavailable=event=>{if(!session.released&&event.data.size)parts.push(event.data);};
    recorder.onerror=event=>{if(releaseRecording(session))status(event.error?.message||'Clip recording failed.',true);};
    recorder.onstop=async()=>{
      if(!releaseRecording(session)||disposed||suspended)return;
      try{
        const elapsed=(performance.now()-session.startedAt)/1000,end=evidence();
        const destination=await saveBlob(name,new Blob(parts,{type:mime}));
        await saveBlob(name.replace(/\.webm$/,'.json'),new Blob([JSON.stringify({...session.metadata,requestedDurationSeconds:duration,actualDurationSeconds:elapsed,end,requestedFrameRate,encoding:{mimeType:recorder.mimeType,requestedVideoBitsPerSecond:videoBitsPerSecond,recorderVideoBitsPerSecond:recorder.videoBitsPerSecond}},null,2)],{type:'application/json'}));
        status(`${destination==='server'?'Saved':'Downloaded'} ${name}`);
      }catch(error){status(error.message,true);}
    };
    recorder.start();session.startedAt=performance.now();session.metadata=evidence();
    session.timer=setTimeout(()=>stopRecording(session),(duration+.2)*1000);
  }catch(error){releaseRecording(session);throw error;}
  return name;
}
const safely=fn=>async()=>{try{await fn();}catch(error){status(error.message,true);}};
el('kind').onchange=event=>setKind(event.target.value);el('action').onchange=event=>setAction(event.target.value);
el('pause').onclick=()=>setPaused(!paused);el('time').oninput=event=>{setPaused(true);actor.seek(Number(event.target.value));};
el('light').onchange=event=>setLight(event.target.value);el('language').onchange=event=>actor.setLanguage(event.target.value);
el('reduced').onchange=()=>actor.update(0,{reducedMotion:el('reduced').checked});
el('fur-visible').onchange=event=>{const fur=actor?.model.getObjectByName('FineDirectionalFurCards');if(fur)fur.visible=event.target.checked;};
el('fur-receive-shadow').onchange=event=>{const fur=actor?.model.getObjectByName('FineDirectionalFurCards');if(fur)fur.receiveShadow=event.target.checked;};
el('save-frame').onclick=safely(saveFrame);el('record-clip').onclick=safely(recordClip);
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
const resizeObserver=new ResizeObserver(()=>{if(disposed||suspended)return;renderer.setPixelRatio(devicePixelRatio||1);renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);setView(view);});resizeObserver.observe(canvas);
setLight(light);setPaused(paused);setView(view);
try{
  await loadCompanionAssets({deadline:performance.now()+30000});setKind(el('kind').value);
  for(const control of assetControls)control.disabled=false;
  document.body.dataset.ready='true';document.querySelector('aside').setAttribute('aria-busy','false');last=performance.now();
}catch(error){status(`Companion load failed: ${error.message}`,true);document.body.dataset.ready='failed';document.querySelector('aside').setAttribute('aria-busy','false');for(const button of document.querySelectorAll('button'))button.disabled=true;}
window.__companionStudio={get actor(){return actor;},scene,camera,renderer,controls,setKind,setAction,setView,setLight,setPaused,saveFrame,recordClip,evidence,diagnostics:companionAssetDiagnostics};
function frame(now){
  if(disposed||suspended)return;
  rafId=requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;if(document.hidden)return;
  if(actor){
    actor.update(dt,{paused,reducedMotion:el('reduced').checked,speed:actor.asset.walk?actor.asset.walk.stride/actor.asset.walk.duration:0});
    el('time').max=String(actor.duration||3);el('time').value=String(actor.time);el('time-value').textContent=`${actor.time.toFixed(2)} s`;
    el('readout').textContent=`${actor.asset.name} · ${actor.clip||'static'}\nSHA ${actor.asset.sha256.slice(0,12)}\n${actor.asset.walk?`Stride ${actor.asset.walk.stride.toFixed(2)} m · ${(actor.asset.walk.stride/actor.asset.walk.duration).toFixed(2)} m/s`:'Static art review'}\n${renderer.info.render.triangles.toLocaleString()} rendered triangles`;
  }
  controls.update();renderer.render(scene,camera);
}
rafId=requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)stopRecording();});
window.addEventListener('pagehide',event=>{
  if(disposed)return;
  suspended=true;cancelAnimationFrame(rafId);rafId=0;resizeObserver.disconnect();
  // Navigation cancels a partial capture immediately; queued recorder events must
  // neither download it after returning nor unlock a newer recording session.
  if(recording){releaseRecording(recording);status('Recording cancelled when leaving the studio.');}
  if(event.persisted)return;
  disposed=true;
  for(const [url,timer] of downloadURLs){clearTimeout(timer);URL.revokeObjectURL(url);}downloadURLs.clear();
  actor?.dispose();controls.dispose();floor.geometry.dispose();floor.material.dispose();grid.geometry.dispose();
  for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.dispose();
  key.shadow.map?.dispose();key.shadow.mapPass?.dispose();renderer.dispose();
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted||disposed||!suspended)return;
  suspended=false;last=performance.now();resizeObserver.observe(canvas);rafId=requestAnimationFrame(frame);
});
