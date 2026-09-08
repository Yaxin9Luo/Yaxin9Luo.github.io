import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {QUALITY,renderPixelRatio} from './render-quality.js';
import {createGardenSpecimen} from './gardens.js';
import {loadBotanicalAssets} from './botanical-cache.js';
import * as models from './models.js';
import {CHARACTER_GROUND_MOTION,loadCharacterAssets,createWizard,createWisp,updateCharacter,requestCharacterCast} from './characters.js';
import {loadLandscapeAssets,createTreeSpecimen,surface,planarUV} from './landscape.js';
import {createSkyLantern} from './atmosphere.js';
import {createPortal,createShield} from './effects.js';
import {createViaduct,createGardenLamp,createResearchBook} from './site-details.js';
import {createTerrainSpecimen} from './world.js';
import {createScannedRockSpecimen} from './rock-scans.js';
import {createFootingSpecimen} from './environment-composition.js';
const assets=[
 ['scan-face','Rock Face / 扫描岩壁',()=>createScannedRockSpecimen('face'),'Photogrammetry geometry and 4K surfaces from Poly Haven; intact mesh, local CC0 textures.'],
 ['scan-moss','Mossy Stones / 扫描苔石',()=>createScannedRockSpecimen('moss'),'Seven distinct scanned stones with their original contours and 4K surfaces.'],
 ['castle-footing','Castle Footing / 城堡岩基',createFootingSpecimen,'Layered scanned rock supports, bedding stones and a fitted architectural foundation.'],
 ['courtyard','Academy Court / 学院庭院',()=>createGardenSpecimen('courtyard'),'Carved fountain, working astronomical clock, planted borders and fitted stone paving.'],
 ['reading','Reading Garden / 阅读花园',()=>createGardenSpecimen('reading'),'Bound research volumes, bronze reading lamps and a sheltered outdoor library.'],
 ['atelier','Atelier / 作品展台',()=>createGardenSpecimen('atelier'),'A crafted exhibition desk, tool shelves and project presentation space.'],
 ['journey','Journey Court / 经历庭院',()=>createGardenSpecimen('journey'),'An architectural timeline, archive plinths and flowering garden beds.'],
 ['post','Post Garden / 邮递庭院',()=>createGardenSpecimen('post'),'A bronze postbox, letter desk and physical CV station.'],
 ['astral','Astral Garden / 星象花园',()=>createGardenSpecimen('astral'),'Open brass instruments, engraved stone and moonlit research displays.'],
 ['sky-lantern','Sky Lantern / 孔明灯',createSkyLantern,'Translucent rice paper, bamboo seams, an open rim and a sheltered flame.'],
 ['lilac','Lilac / 紫花树',()=>createTreeSpecimen('lilac'),'Arching branches and layered, softly lit flower clusters.'],
 ['cherry','Cherry / 樱花树',()=>createTreeSpecimen('cherry'),'Warm pink blossoms on a low, spreading silhouette.'],
 ['silver','Silver Tree / 银蓝树',()=>createTreeSpecimen('silver'),'Cool foliage and open branching that leaves room for the architecture.'],
 ['bridge','Viaduct / 拱券桥',()=>createViaduct(26),'Cut-through stone arches, balustrades and supporting piers.'],
 ['book','Research Book / 研究书页',()=>createResearchBook('autodesign'),'Curved paper, bound covers and gilt corners. Click a book in the world to read its paper.'],
 ['garden-lamp','Garden Lantern / 庭院灯',createGardenLamp,'Worked bronze ribs and warm glass, instanced along the paths.'],
 ['terrain','Terrain / 地形',createTerrainSpecimen,'Continuous island mesh, eroded cliff strata, real rock and meadow PBR surfaces.'],
 ['castle','Grand Academy / 主城堡',models.createCastle,'Weathered ashlar, recessed Gothic tracery, flying buttresses and layered slate roofs.'],
 ['library','Library / 图书馆',models.createLibrary,'Tall reading hall, stone mullions and carved masonry.'],
 ['workshop','Workshop / 工坊',models.createWorkshop,'Aged timber, fitted stone foundations and worked metal details.'],
 ['observatory','Observatory / 天文台',models.createObservatory,'A domed research tower with a brass astronomical instrument.'],
 ['ruins','Cloister / 回廊遗迹',models.createRuins,'Broken archways, exposed stone joints and time-worn fragments.'],
 ['owlery','Owl Tower / 猫头鹰塔',models.createOwlery,'A vertical landmark with nesting apertures and a steep roof.'],
 ['rider','Broom Rider / 飞行人物',createWizard,'A bent felt hat, full silver mask and tailored riding coat, with eight authored flight and casting actions. 弯尖毡帽、全脸银色面具与分片骑乘外套，配有八组飞行及施法动作。'],
 ['wraith','Guardian / 守护灵',createWisp,'A porcelain mask, crescent crown and layered animated gown. 瓷质面具、月牙冠与分层动态长袍。'],
 ['pine','Pine / 松树',()=>createTreeSpecimen('pine'),'Layered woody boughs and individually modeled needles, with textured bark and gentle wind.'],
 ['ash','Ash Tree / 白蜡树',()=>createTreeSpecimen('ash'),'Irregular branching, individually shaped leaves and textured bark.'],
 ['shield','Protego / 护盾',createShield,'Fresnel rim, flowing light and a translucent protective membrane.'],
 ['portal','Portal / 传送门',()=>createPortal(),'Animated runic membrane, orbiting glyphs and individual sparks.'],
 ['rock','Rock Material / 苔石',()=>{const g=new THREE.IcosahedronGeometry(3,4);planarUV(g,.3);return new THREE.Mesh(g,surface('mossy-rock'));},'Real scanned base color, OpenGL normal and roughness maps.'],
];
const canvas=document.querySelector('canvas'),scene=new THREE.Scene();scene.background=new THREE.Color('#262c30');
const camera=new THREE.PerspectiveCamera(38,1,.05,2000);const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(renderPixelRatio('high',innerWidth,innerHeight,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.autoRotateSpeed=.35;
const hemi=new THREE.HemisphereLight('#c8d5e8','#5b4b3d',1.8);scene.add(hemi);
const key=new THREE.DirectionalLight('#ffe0b7',3.2);key.position.set(-50,80,60);key.castShadow=true;key.shadow.mapSize.set(QUALITY.high.mapSize,QUALITY.high.mapSize);Object.assign(key.shadow.camera,{left:-55,right:55,top:75,bottom:-45,far:240});key.shadow.normalBias=.02;scene.add(key,key.target);
const rim=new THREE.DirectionalLight('#b2cadc',1.8);rim.position.set(40,35,-60);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:'#353b39',roughness:.96}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const environmentReady=new HDRLoader().loadAsync('/textures/environment/sky.hdr').then(texture=>{texture.mapping=THREE.EquirectangularReflectionMapping;scene.environment=texture;scene.environmentIntensity=.35;}).catch(error=>console.warn('Studio environment unavailable',error));
const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples||0)});
const composer=new EffectComposer(renderer,sceneTarget);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.3,.4,1.5);composer.addPass(bloom);const smaa=new SMAAPass();smaa.enabled=sceneTarget.samples===0;composer.addPass(smaa);composer.addPass(new OutputPass());
let current=null,wire=false,last=performance.now();
let studioLight='neutral',studioView='overview',studioFrame=false,recording=null,captureSequence=0,capturePageHidden=false;
const captureURLs=new Set(),captureStatus=document.createElement('p'),captureResults=document.createElement('p');
captureStatus.id='capture-status';captureStatus.setAttribute('role','status');captureStatus.setAttribute('aria-live','polite');captureResults.id='capture-results';
document.querySelector('.caption').append(captureStatus,captureResults);
controls.addEventListener('start',()=>{studioView='orbit';});
let actorAction='idle',actorPlaying=true,actorGroundTime=0,actorGaitPhase=0;
const groundActions=new Set(['ground_idle','walk','run','mount','dismount']);
const actorTools=document.createElement('div');actorTools.className='actor-tools';actorTools.hidden=true;
actorTools.innerHTML='<label>Action / 动作 <select aria-label="Character action"><option value="idle">Hover / 悬停</option><option value="cruise">Cruise / 飞行</option><option value="turn-left">Turn left / 左转</option><option value="turn-right">Turn right / 右转</option><option value="boost">Boost / 加速</option><option value="ground_idle">Stand / 站立</option><option value="walk">Walk / 行走</option><option value="run">Run / 跑动</option><option value="mount">Mount broom / 上扫帚</option><option value="dismount">Dismount / 下扫帚</option><option value="channel">Channel / 施法</option></select></label><button data-actor-play aria-pressed="true">Animate / 动画</button><button data-actor-cast>Cast / 施法</button><button data-actor-record>Record 16s / 录制</button><div class="actor-views"><button data-actor-view="front">Front / 正面</button><button data-actor-view="side">Side / 侧面</button><button data-actor-view="back">Back / 背面</button><button data-actor-view="garment">Coat / 服装</button><button data-actor-view="mask">Mask / 面具</button></div>';
document.querySelector('.stage').append(actorTools);
actorTools.querySelector('[data-actor-cast]').onclick=()=>{if(current)requestCharacterCast(current);};
actorTools.querySelector('[data-actor-record]').onclick=recordActor;
actorTools.querySelector('select').onchange=e=>{actorAction=e.target.value;actorGroundTime=0;actorGaitPhase=0;if(groundActions.has(actorAction))floor.position.y=-1.30;};
actorTools.querySelector('[data-actor-play]').onclick=e=>{actorPlaying=!actorPlaying;e.currentTarget.setAttribute('aria-pressed',String(actorPlaying));};
actorTools.querySelectorAll('[data-actor-view]').forEach(button=>button.onclick=()=>{
  if(!current)return;controls.autoRotate=false;document.querySelector('#rotate').setAttribute('aria-pressed','false');
  current.updateMatrixWorld(true);current.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*1.55;
  const view=button.dataset.actorView,directions={front:[0,.18,-1],side:[1,.18,0],back:[0,.18,1],garment:[.25,.12,-1],mask:[.16,.04,-1]};
  studioView=view;
  if(view==='garment')center.y=box.min.y+size.y*.57;
  if(view==='mask')center.y=box.min.y+size.y*.78;
  const distance=view==='garment'?size.y*1.08:view==='mask'?size.y*.63:radius;
  camera.position.copy(center).add(new THREE.Vector3(...directions[view]).multiplyScalar(distance));controls.target.copy(center);controls.update();
});
const specimens=new Map();
document.querySelector('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));
document.querySelector('aside').append(document.querySelector('.caption'));
const buttons=document.querySelector('#assets');assets.forEach(([id,name])=>{const b=document.createElement('button');b.textContent=name;b.dataset.asset=id;b.addEventListener('click',()=>show(id));buttons.insertBefore(b,document.querySelector('.caption'));});
async function show(id){
  const kind=['cherry','lilac'].includes(id)?id:null;
  if(kind)await loadBotanicalAssets({families:[{kind,seed:221}],levels:['near'],deadline:performance.now()+90000});
  const selected=assets.find(a=>a[0]===id)||assets[0];if(current)scene.remove(current);if(!specimens.has(selected[0]))specimens.set(selected[0],selected[2]());current=specimens.get(selected[0]);scene.add(current);current.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.72;
  studioView='overview';
  floor.position.y=box.min.y-.035;
  const lightSpan=Math.max(size.x,size.y,size.z,1)*1.1,front=['rider','wraith'].includes(selected[0])?-1:1;key.position.copy(center).add(new THREE.Vector3(-.8,1.5,front).multiplyScalar(lightSpan));key.target.position.copy(center);rim.position.copy(center).add(new THREE.Vector3(1,.8,-front).multiplyScalar(lightSpan));rim.target.position.copy(center);Object.assign(key.shadow.camera,{left:-lightSpan,right:lightSpan,top:lightSpan,bottom:-lightSpan,near:.1,far:lightSpan*5});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=Math.min(.04,lightSpan*.002);
  camera.position.copy(center).add(new THREE.Vector3(radius*1.5,radius*.7,radius*1.85*(['rider','wraith'].includes(selected[0])?-1:1)));controls.target.copy(center);controls.minDistance=radius*.18;controls.maxDistance=radius*8;camera.near=Math.max(.02,radius/200);camera.updateProjectionMatrix();controls.update();
  current.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.wireframe=wire;});}});
  document.querySelector('#name').textContent=selected[1];document.querySelector('#description').textContent=selected[3];buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.asset===selected[0])));
  let triangles=0,meshes=0;current.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  document.querySelector('#stats').textContent=`${meshes} meshes · ${Math.round(triangles).toLocaleString()} triangles · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`;
  const model=selected[0]==='rider'?'wizard':selected[0],architecture=['castle','library','workshop','observatory','ruins','owlery'].includes(model);
  document.querySelector('#downloads').innerHTML=architecture?`<a href="/models/architecture/${model}.glb" download>GLB 模型 ↓</a> · <a href="/models/architecture/${model}-studio.blend" download>Blender 源文件 ↓</a><br><small>GLB uses shared textures; Blender includes packed textures.<br>GLB 需保留共用贴图；Blender 文件已内嵌贴图。</small>`:['wizard','wraith'].includes(model)?`<a href="/models/characters/${model}.glb" download>GLB 模型 ↓</a>`:'';
  document.body.dataset.asset=selected[0];history.replaceState(null,'',`?asset=${selected[0]}`);
  actorTools.hidden=!['rider','wraith'].includes(selected[0]);
  actorTools.querySelector('[data-actor-cast]').hidden=selected[0]!=='rider';
  actorTools.querySelector('[value=channel]').hidden=selected[0]!=='wraith';
  for(const action of groundActions)actorTools.querySelector(`[value=${action}]`).hidden=selected[0]!=='rider';
  if(groundActions.has(actorAction)&&selected[0]!=='rider'){actorAction='idle';actorTools.querySelector('select').value='idle';}
  if(actorAction==='channel'&&selected[0]!=='wraith'){actorAction='idle';actorTools.querySelector('select').value='idle';}
}
document.querySelector('#rotate').onclick=e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));};
document.querySelector('#wire').onclick=e=>{wire=!wire;current?.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.wireframe=wire);});e.currentTarget.setAttribute('aria-pressed',String(wire));};
function setLight(value){
  studioLight=value;
  const preset={neutral:{sky:'#262c30',hemi:1.8,key:'#ffe0b7',power:3.2,rim:'#b2cadc',edge:1.8},day:{sky:'#aeb8bc',hemi:2.3,key:'#fff0d4',power:3.5,rim:'#bacde4',edge:1.4},night:{sky:'#142333',hemi:1.5,key:'#bbd6ff',power:2.2,rim:'#edc189',edge:2}}[value];
  scene.background.set(preset.sky);hemi.intensity=preset.hemi;key.color.set(preset.key);key.intensity=preset.power;rim.color.set(preset.rim);rim.intensity=preset.edge;
}
document.querySelector('#light').onchange=e=>setLight(e.target.value);
document.querySelector('#frame').onclick=()=>{studioFrame=true;};
document.querySelector('#shadows').onclick=e=>{renderer.shadowMap.enabled=!renderer.shadowMap.enabled;key.castShadow=renderer.shadowMap.enabled;renderer.shadowMap.needsUpdate=true;scene.traverse(object=>{if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])material.needsUpdate=true;});e.currentTarget.setAttribute('aria-pressed',String(renderer.shadowMap.enabled));};
function captureMetadata(kind){
  return {kind,asset:document.body.dataset.asset,light:studioLight,shadows:renderer.shadowMap.enabled,view:controls.autoRotate?'orbit':studioView,
    action:kind==='record'?(groundActions.has(actorAction)?'ground-sequence':'sequence'):current?.userData.characterAnimation?.cast?.active?'cast':actorAction,
    playing:actorPlaying,wire,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
    camera:{eye:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov},
    canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:renderer.getPixelRatio()},
    createdAt:new Date().toISOString(),sequence:++captureSequence};
}
function saveCapture(blob,suffix,metadata){
  const clean=value=>String(value).replace(/[^a-z0-9_-]+/gi,'-').slice(0,36);
  const name=['studio',metadata.asset,metadata.light,metadata.shadows?'shadows-on':'shadows-off',metadata.view,metadata.action,metadata.wire?'wire':'solid',metadata.reducedMotion?'reduced':metadata.playing?'animated':'paused',
    metadata.kind,metadata.invalid?`invalid-${clean(metadata.reason)}`:'complete',metadata.createdAt.replace(/[-:.]/g,''),metadata.sequence].map(clean).join('-')+'.'+suffix;
  let link=null;
  try{
    if(!capturePageHidden){
      link=document.createElement('a');link.href=URL.createObjectURL(blob);captureURLs.add(link.href);link.download=name;link.textContent=`${name} ↓`;link.style.overflowWrap='anywhere';
      link.dataset.capture=JSON.stringify(metadata);captureResults.append(document.createElement('br'),link);
      captureStatus.textContent=metadata.invalid?`Interrupted take / 中断录制：${metadata.reason} · invalid`:'Capture ready / 文件已生成';
    }
  }catch(error){captureStatus.textContent=`Capture failed / 生成失败：${error.message}`;}
  if(import.meta.env.DEV)fetch(`/__review_capture/${name}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(20000)})
    .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);link?.append(' · saved locally / 已保存');})
    .catch(error=>{link?.append(` · local save failed / 本地保存失败：${error.message}`);if(!capturePageHidden)captureStatus.textContent=`Local save failed / 本地保存失败：${error.message} · use the download link / 可用上方下载链接`;});
}
function releaseRecording(capture){
  if(capture.released)return;capture.released=true;
  for(const track of capture.stream?.getTracks()||[])try{track.stop();}catch{ /* The device may already have ended this track. */ }
}
function finishRecording(capture){
  if(capture.finished)return;capture.finished=true;
  if(!capture.stopping){capture.invalid=true;capture.reason='recorder-stopped-early';capture.elapsedMs=performance.now()-capture.started;}
  try{
    if(capture.chunks.length){
      const blob=new Blob(capture.chunks,{type:capture.recorder.mimeType});
      saveCapture(blob,blob.type.includes('mp4')?'mp4':'webm',{...capture.metadata,invalid:capture.invalid,reason:capture.reason,elapsedMs:capture.elapsedMs});
    }else if(!capturePageHidden)captureStatus.textContent=capture.error?`Recording failed / 录制失败：${capture.error}`:'Recording produced no data / 录制没有生成数据';
  }finally{
    releaseRecording(capture);
    if(capture.recorder)capture.recorder.ondataavailable=capture.recorder.onstop=capture.recorder.onerror=null;
    if(recording===capture){
      recording=null;actorAction=capture.previous.action;actorPlaying=capture.previous.playing;controls.autoRotate=capture.previous.rotate;controls.enabled=capture.previous.controlsEnabled;
      document.querySelector('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));actorTools.querySelector('select').value=actorAction;
      actorTools.querySelector('[data-actor-play]').setAttribute('aria-pressed',String(actorPlaying));
      for(const [element,disabled] of capture.disabled)element.disabled=disabled;
      actorTools.querySelector('[data-actor-record]').textContent='Record 16s / 录制';
    }
  }
}
function stopRecording(reason,completed=false){
  const capture=recording;if(!capture)return;
  if(!completed){capture.invalid=true;capture.reason=reason;}else if(!capture.invalid)capture.reason='completed';
  if(capture.stopping){releaseRecording(capture);return;}
  capture.stopping=true;capture.elapsedMs=Math.max(0,performance.now()-(capture.started??performance.now()));
  try{if(capture.recorder?.state==='recording'||capture.recorder?.state==='paused')capture.recorder.stop();}
  catch(error){capture.invalid=true;capture.error=error.message;capture.reason='recorder-stop-failed';finishRecording(capture);}
  finally{releaseRecording(capture);}
}
function recordActor(){
  if(recording||document.hidden||capturePageHidden)return;
  if(!window.MediaRecorder||!canvas.captureStream){captureStatus.textContent='Recording is unavailable in this browser / 此浏览器不支持录制';return;}
  const capture={groundSequence:groundActions.has(actorAction),metadata:{...captureMetadata('record'),playing:true},previous:{action:actorAction,playing:actorPlaying,rotate:controls.autoRotate,controlsEnabled:controls.enabled},
    disabled:[...document.querySelectorAll('button,select')].map(element=>[element,element.disabled]),stream:null,recorder:null,chunks:[],started:null,stage:-1,invalid:false,stopping:false};
  recording=capture;
  try{
    capture.stream=canvas.captureStream(30);
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(value=>MediaRecorder.isTypeSupported(value));
    const recorder=capture.recorder=new MediaRecorder(capture.stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:9000000});
    for(const [element] of capture.disabled)element.disabled=true;
    actorPlaying=true;actorAction='idle';controls.autoRotate=false;controls.enabled=false;document.querySelector('#rotate').setAttribute('aria-pressed','false');
    actorTools.querySelector('[data-actor-play]').setAttribute('aria-pressed','true');actorTools.querySelector('select').value=actorAction;
    recorder.ondataavailable=event=>{if(event.data.size)capture.chunks.push(event.data);};
    recorder.onstop=()=>finishRecording(capture);
    recorder.onerror=event=>{capture.error=event.error?.message||'device error';stopRecording('recorder-error');};
    recorder.start(1000);capture.started=performance.now();captureStatus.textContent='Recording 16 seconds / 正在录制 16 秒';
  }catch(error){capture.invalid=true;capture.stopping=true;capture.reason='recording-start-failed';capture.error=error.message;finishRecording(capture);}
}
function updateRecording(now){
  if(!recording||recording.recorder.state!=='recording')return;
  const t=(now-recording.started)/1000,next=recording.groundSequence?(t<2?0:t<4?1:t<8?2:t<10?3:t<11.2?4:t<12?5:t<13.2?6:t<14?7:8):(t<2?0:t<4?1:t<8?2:t<10?3:t<12?4:5);
  actorTools.querySelector('[data-actor-record]').textContent=`${t.toFixed(1)} / 16 s`;
  if(next!==recording.stage){
    recording.stage=next;
    actorGroundTime=0;
    actorAction=recording.groundSequence?['ground_idle','walk','run','ground_idle','mount','idle','dismount','ground_idle','ground_idle'][next]:recording.metadata.asset==='wraith'?['idle','cruise','cruise','idle','channel','cruise'][next]:['idle','cruise','boost','cruise','idle','turn-left'][next];
    actorTools.querySelector('select').value=actorAction;if((recording.groundSequence?next===8:next===4)&&recording.metadata.asset==='rider')requestCharacterCast(current);
  }
  if(t>=16)stopRecording('completed',true);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){studioFrame=false;stopRecording('page-hidden');}});
window.addEventListener('pagehide',()=>{
  capturePageHidden=true;studioFrame=false;stopRecording('page-hidden');
  for(const url of captureURLs)URL.revokeObjectURL(url);captureURLs.clear();captureResults.textContent='';
});
window.addEventListener('pageshow',()=>{capturePageHidden=false;last=performance.now();});

new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),dpr=renderPixelRatio('high',r.width,r.height,devicePixelRatio);renderer.setPixelRatio(dpr);renderer.setSize(r.width,r.height,false);composer.setPixelRatio(dpr);composer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe(canvas);
try{await Promise.all([loadLandscapeAssets(),models.loadArchitectureAssets?.(),loadCharacterAssets(),environmentReady]);await show(new URLSearchParams(location.search).get('asset')); document.querySelector('#loading').hidden=true;document.body.dataset.ready='true';}catch(error){document.querySelector('#loading').innerHTML='<div class="studio-error">Asset loading failed. The portfolio remains available from the link above.</div>';console.error(error);}
function frame(now){
  requestAnimationFrame(frame);
  const elapsed=Math.max(0,Math.min((now-last)/1000,.25));last=now;
  if(document.hidden||capturePageHidden)return;
  updateRecording(now);controls.update(elapsed);current?.userData.update?.(now/1000,false);
  const ground=groundActions.has(actorAction),mode=actorAction==='mount'?'mounting':actorAction==='dismount'?'dismounting':ground?'grounded':'flying';
  const cycle=actorAction==='run'?CHARACTER_GROUND_MOTION.runCycle:CHARACTER_GROUND_MOTION.walkCycle;
  const duration=actorAction==='dismount'?CHARACTER_GROUND_MOTION.dismountDuration:CHARACTER_GROUND_MOTION.mountDuration;
  const steps=actorPlaying?Math.max(1,Math.ceil(elapsed/(1/60))):1,dt=actorPlaying?elapsed/steps:0;
  // Match runtime cadence, including on machines rendering below 20 FPS.
  // Substeps keep the cloth solver stable while consuming the visible interval.
  for(let step=0;step<steps;step++){
    if(actorPlaying){actorGroundTime+=dt;actorGaitPhase=(actorGaitPhase+dt/cycle)%1;}
    updateCharacter(current,{dt,paused:!actorPlaying,mode,
      groundSpeed:actorAction==='run'?CHARACTER_GROUND_MOTION.runSpeed:actorAction==='walk'?CHARACTER_GROUND_MOTION.walkSpeed:0,
      gaitPhase:actorGaitPhase,transitionProgress:Math.min(1,actorGroundTime/duration),
      boost:actorAction==='boost',speed:actorAction==='boost'?1:actorAction==='idle'?0:.55,
      turn:actorAction==='turn-left'?-1:actorAction==='turn-right'?1:0,state:actorAction==='channel'?'channel':undefined,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  }
  composer.render();
  if(studioFrame){studioFrame=false;const metadata=captureMetadata('frame');canvas.toBlob(blob=>{if(blob)saveCapture(blob,'png',metadata);else captureStatus.textContent='Frame encoding failed / 截图编码失败';});}
}
last=performance.now();requestAnimationFrame(frame);
