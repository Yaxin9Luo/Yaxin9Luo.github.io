import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FAUNA_VERSION,createSwallow,setSwallowPose,createPaperLantern,setLanternEnvironment,createFirefly,setFireflyGlow,disposeFaunaSpecimen} from './sky-fauna.js';
import {sampleEnvironment,TIME_PHASES} from './environment-time.js';

const query=new URLSearchParams(location.search),el=id=>document.getElementById(id),canvas=document.querySelector('canvas');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.0005,100);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples||0)}),composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.28,.45,1.35));composer.addPass(new OutputPass());
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
const hemi=new THREE.HemisphereLight(),key=new THREE.DirectionalLight(),fill=new THREE.DirectionalLight();scene.add(hemi,key,key.target,fill,fill.target);key.castShadow=true;key.shadow.mapSize.set(4096,4096);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#697169',roughness:.96}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
let asset,kind=query.get('kind')||'swallow',light=query.get('light')||'neutral',view=query.get('view')||'threequarter',pose=query.get('pose')||'glide',activity=Number(query.get('time'))||0,playing=false,clay=false,wire=false,disposed=false,suspended=false,raf=0,last=performance.now(),recording=null,sequence=0,framePending=false;
const clayMaterial=new THREE.MeshStandardMaterial({color:'#c4c8be',roughness:.84}),urls=new Set(),controllers=new Set(),originalMaterials=new Map();
function status(message,error=false){el('status').textContent=message;el('status').dataset.error=String(error);}
function specimens(){return kind==='lantern-pair'?asset.children:[asset];}
function applyPose(){
  if(kind==='swallow')setSwallowPose(asset,pose,activity);
  if(kind==='firefly'){const pulse=.12+.88*Math.pow(Math.max(0,Math.sin(activity*1.3+1.25)),8);setFireflyGlow(asset,light==='day'?0:pulse);}
  if(kind==='paper-lantern'||kind==='lantern-pair')for(const [i,item]of specimens().entries()){
    item.rotation.z=Math.sin(activity*.72+i)*.04;item.rotation.x=Math.sin(activity*.61+i)*.025;
    setLanternEnvironment(item,light==='night'?1:light==='dusk'?.45:light==='neutral'?.10:0);
  }
}
function appearance(){asset.traverse(object=>{if(!object.isMesh)return;if(!originalMaterials.has(object))originalMaterials.set(object,object.material);const source=originalMaterials.get(object);object.visible=!(clay&&object.userData.excludeFromGLB);object.material=clay&&!object.userData.excludeFromGLB?clayMaterial:source;for(const m of Array.isArray(object.material)?object.material:[object.material])m.wireframe=wire;});}
function setKind(next){
  if(!['swallow','paper-lantern','lantern-pair','firefly'].includes(next))throw new RangeError(`Unknown specimen ${next}`);
  if(asset){asset.traverse(o=>{if(originalMaterials.has(o))o.material=originalMaterials.get(o);});disposeFaunaSpecimen(asset);}originalMaterials.clear();kind=next;
  if(kind==='swallow')asset=createSwallow();else if(kind==='firefly')asset=createFirefly();else if(kind==='paper-lantern')asset=createPaperLantern();else{asset=new THREE.Group();asset.name='Two independently sorted translucent paper shells';const a=createPaperLantern(),b=createPaperLantern();a.position.set(-.34,0,.38);b.position.set(.34,.18,-.38);asset.add(a,b);}
  scene.add(asset);asset.traverse(o=>{if(o.isMesh&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});applyPose();appearance();setView(view);setLight(light);el('kind').value=kind;el('pose').disabled=kind!=='swallow';el('downloads').innerHTML=`<a href="/models/fauna/${kind==='lantern-pair'?'paper-lantern':kind}.glb" download>GLB ↓</a> · <a href="/models/fauna/README.md">Recipe & provenance</a>`;document.body.dataset.ready='true';status(`${FAUNA_VERSION} · ${kind} · actual geometry`);
}
function specimenBounds(){const box=new THREE.Box3();asset.traverse(o=>{if(!o.isMesh||o.userData.excludeFromGLB)return;o.updateWorldMatrix(true,false);box.union(new THREE.Box3().setFromObject(o));});return box;}
function setView(next){
  view=next;asset.updateMatrixWorld(true);const box=specimenBounds(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),span=Math.max(...size.toArray());
  const direction={threequarter:[1,.57,-1.35],front:[0,.08,-1.7],side:[1.75,.08,0],back:[0,.08,1.7],above:[.001,1.7,.10],below:[.04,-1.3,-.65],close:[.9,.3,-1.1],distance:[.2,.14,-1.5]}[view]||[1,.57,-1.35];
  const distance=view==='close'?span*1.15:view==='distance'?(kind==='firefly'?1.6:4.5):span*1.65;
  camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));controls.target.copy(center);controls.minDistance=Math.max(.015,span*.18);controls.maxDistance=Math.max(12,span*12);controls.update();
  floor.position.y=box.min.y-(kind==='firefly'?.03:span*.40);floor.visible=view!=='below';
  const s=Math.max(span,.05);key.position.copy(center).add(new THREE.Vector3(-1,1.8,-1.8).multiplyScalar(s));key.target.position.copy(center);fill.position.copy(center).add(new THREE.Vector3(1,.8,1).multiplyScalar(s));fill.target.position.copy(center);Object.assign(key.shadow.camera,{left:-s,right:s,top:s,bottom:-s,near:.0001,far:s*8});key.shadow.normalBias=s*.0005;key.shadow.bias=-.00005;key.shadow.camera.updateProjectionMatrix();
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
function setLight(next){
  light=next;const e=sampleEnvironment(TIME_PHASES[next]??TIME_PHASES.day);renderer.toneMappingExposure=next==='neutral'?1:e.exposure;
  hemi.color.copy(next==='neutral'?new THREE.Color('#d9e1e0'):e.sky);hemi.groundColor.copy(next==='neutral'?new THREE.Color('#776f5c'):e.ground);hemi.intensity=next==='neutral'?1.2:e.ambientIntensity;key.color.copy(next==='neutral'?new THREE.Color('#fff0dd'):e.key);key.intensity=next==='neutral'?2.8:e.keyIntensity;fill.color.copy(next==='neutral'?new THREE.Color('#c9d8df'):e.fill);fill.intensity=next==='neutral'?.7:e.fillIntensity;
  scene.background=new THREE.Color(next==='night'?'#142436':next==='dusk'?'#7b747d':next==='day'?'#acbec6':'#737e85');setBackdrop(el('backdrop').value);el('light').value=light;applyPose();
}
function setBackdrop(value){const c={neutral:'#697169',leaf:'#243d2c',stone:'#c6bead',water:'#102c42'}[value]||'#697169';floor.material.color.set(c);if(value!=='neutral')scene.background=new THREE.Color(c);}
function evidence(){return {candidate:query.get('candidate')||FAUNA_VERSION,assetVersion:FAUNA_VERSION,kind,light,pose,view,activityTime:activity,playing,clay,wire,backdrop:el('backdrop').value,camera:camera.position.toArray(),target:controls.target.toArray(),bounds:specimenBounds(),morph:asset.morphTargetInfluences?[...asset.morphTargetInfluences]:null,nativePixels:[canvas.width,canvas.height],dpr:renderer.getPixelRatio(),msaa:target.samples,exposure:renderer.toneMappingExposure,render:{...renderer.info.render}};}
const safe=value=>String(value).replace(/[^a-z0-9_-]/gi,'-').slice(0,60);
function filename(meta,type){return ['fauna',meta.candidate,meta.kind,meta.light,meta.view,meta.pose,meta.clay?'clay':'material',`t${meta.activityTime.toFixed(3)}`,type,Date.now(),++sequence].map(safe).join('-');}
async function save(name,blob){
  if(disposed||suspended)throw new Error('Capture cancelled: studio unavailable');const controller=new AbortController();controllers.add(controller);let response;
  try{response=await fetch(`/__review_capture/${name}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});}catch(error){if(controller.signal.aborted)throw error;}finally{controllers.delete(controller);}
  if(response?.ok)return;if(disposed||suspended)throw new Error('Capture cancelled');const url=URL.createObjectURL(blob),a=document.createElement('a');urls.add(url);a.href=url;a.download=name;a.textContent=name;el('downloads').append(document.createElement('br'),a);status('Local save unavailable; use the download link.',true);
}
async function saveFrame(){
  if(framePending||recording||disposed||suspended)return;framePending=true;el('frame').disabled=true;
  try{composer.render();const meta=evidence(),name=filename(meta,'actualframe'),blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG encode failed')),'image/png'));await save(name+'.png',blob);await save(name+'.json',new Blob([JSON.stringify(meta,null,2)],{type:'application/json'}));status(`Saved ${name}.png`);return name;}finally{framePending=false;el('frame').disabled=false;}
}
function finishRecording(reason='completed'){
  const r=recording;if(!r||r.stopping)return;r.stopping=true;r.reason=reason;r.end=evidence();r.wallSeconds=(performance.now()-r.start)/1000;
  try{if(r.recorder.state!=='inactive')r.recorder.stop();}finally{r.stream.getTracks().forEach(t=>t.stop());}
}
function record(){
  if(recording||disposed||suspended||document.hidden)return;if(!canvas.captureStream||!window.MediaRecorder)throw new Error('Recording unavailable');
  const r={previous:{playing,pose,activity},chunks:[],metadata:evidence(),start:performance.now(),stream:canvas.captureStream(30),disabled:[...document.querySelectorAll('button,select,input')].map(e=>[e,e.disabled])};recording=r;
  try{
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));r.recorder=new MediaRecorder(r.stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:16000000});
    r.recorder.ondataavailable=e=>{if(e.data.size)r.chunks.push(e.data);};
    r.recorder.onstop=async()=>{
      const meta={...r.metadata,pose:kind==='swallow'?'flight':pose,startActivity:r.previous.activity,end:r.end,wallSeconds:r.wallSeconds,reason:r.reason||'unexpected-stop',valid:r.reason==='completed'},name=filename(meta,meta.valid?'movie':'invalidmovie');
      try{if(!disposed&&!suspended&&r.chunks.length){await save(name+'.'+(r.recorder.mimeType.includes('mp4')?'mp4':'webm'),new Blob(r.chunks,{type:r.recorder.mimeType}));await save(name+'.json',new Blob([JSON.stringify(meta,null,2)],{type:'application/json'}));status(`${meta.valid?'Saved':'Interrupted'} ${name}`);}}
      catch(error){status(error.message,true);}finally{r.stream.getTracks().forEach(t=>t.stop());if(recording===r){recording=null;playing=r.previous.playing;pose=r.previous.pose;activity=r.previous.activity;el('pose').value=pose;for(const[e,d]of r.disabled)e.disabled=d;controls.enabled=true;applyPose();}}
    };
    r.recorder.onerror=()=>finishRecording('recorder-error');for(const[e]of r.disabled)e.disabled=true;controls.enabled=false;playing=true;if(kind==='swallow')pose='flight';r.recorder.start(1000);status('Recording 10 seconds of actual specimen motion…');
  }catch(error){r.stream.getTracks().forEach(t=>t.stop());recording=null;for(const[e,d]of r.disabled)e.disabled=d;controls.enabled=true;playing=r.previous.playing;pose=r.previous.pose;throw error;}
}
function safely(fn){return async()=>{try{await fn();}catch(error){status(error.message,true);}};}
el('kind').onchange=safely(()=>setKind(el('kind').value));el('light').onchange=()=>setLight(el('light').value);el('backdrop').onchange=()=>setLight(light);el('pose').onchange=()=>{pose=el('pose').value;applyPose();};el('time').onchange=()=>{const next=Number(el('time').value);if(Number.isFinite(next)&&next>=0){activity=next;applyPose();}};
el('play').onclick=()=>{playing=!playing;el('play').setAttribute('aria-pressed',String(playing));};el('frame').onclick=safely(saveFrame);el('record').onclick=safely(record);el('clay').onclick=()=>{clay=!clay;appearance();el('clay').setAttribute('aria-pressed',String(clay));};el('wire').onclick=()=>{wire=!wire;appearance();el('wire').setAttribute('aria-pressed',String(wire));};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function resize(){if(disposed||suspended)return;const dpr=devicePixelRatio||1;renderer.setPixelRatio(dpr);renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);composer.setPixelRatio(dpr);composer.setSize(canvas.clientWidth,canvas.clientHeight);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();}
const observer=new ResizeObserver(resize);observer.observe(canvas);resize();el('pose').value=pose;setKind(kind);
function frame(now){if(disposed||suspended)return;raf=requestAnimationFrame(frame);const raw=Math.max(0,(now-last)/1000);last=now;if(document.hidden)return;const accepted=Math.min(raw,.25);if(recording&&raw>.25+1e-8)finishRecording('frame-stall');if(playing)activity+=accepted;applyPose();controls.update();composer.render();if(recording&&!recording.stopping&&(now-recording.start)>=10000)finishRecording();el('time').value=activity.toFixed(3);const m=evidence();el('readout').textContent=`${FAUNA_VERSION}\n${kind} / ${view} / ${light}\n${pose} · t = ${activity.toFixed(3)} s\n${m.nativePixels.join(' × ')} · DPR ${m.dpr}\n${m.msaa}× MSAA · exposure ${m.exposure}\n${m.render.triangles.toLocaleString()} triangles · ${m.render.calls} draws`;}
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)finishRecording('page-hidden');});
window.addEventListener('pagehide',event=>{suspended=true;cancelAnimationFrame(raf);observer.disconnect();finishRecording('page-hidden');for(const controller of controllers)controller.abort();if(event.persisted)return;disposed=true;asset.traverse(o=>{if(originalMaterials.has(o))o.material=originalMaterials.get(o);});disposeFaunaSpecimen(asset);floor.geometry.dispose();floor.material.dispose();clayMaterial.dispose();controls.dispose();for(const pass of composer.passes)pass.dispose?.();composer.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();renderer.dispose();for(const url of urls)URL.revokeObjectURL(url);urls.clear();});
window.addEventListener('pageshow',event=>{if(event.persisted&&!disposed){suspended=false;last=performance.now();observer.observe(canvas);resize();raf=requestAnimationFrame(frame);}});
window.__faunaStudio={scene,camera,renderer,composer,controls,get asset(){return asset;},setKind,setView,setLight,setPose(next,time=activity){pose=next;activity=time;el('pose').value=pose;applyPose();},saveFrame,record,evidence};
raf=requestAnimationFrame(frame);
