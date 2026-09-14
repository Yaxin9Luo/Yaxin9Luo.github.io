import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createRendering} from '../rendering.js';
import {loadYuanmingyuanArchive,archiveSHA256} from './asset-archive.js';
import {loadBuildingDistanceArchive} from './zhengjuesi-distance-runtime.js';
import {fitStudyShadow} from './shadow-framing.js';
import {impostorStudioLighting} from './impostor-studio-state.js';
import {createDistanceApproachTrace} from './zhengjuesi-distance-studio-state.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas'),stage=$('distance-stage'),query=new URLSearchParams(location.search),controller=new AbortController(),errors=[];
const defaultManifest='/assets/yuanmingyuan-distance/zhengjuesi-distance/202a091fca7d4eac-gzip-bin-v1/manifest.json',defaultManifestSHA256='d6a10022cb36b35d139b65aa0af3ca4565f70926f19afd351fc203ac6077b6aa';
const manifestPath=query.get('manifest')||defaultManifest,expectedManifestSHA256=query.get('sha256')||(query.has('manifest')?undefined:defaultManifestSHA256);
const approachTrace=createDistanceApproachTrace();
let full=null,distance=null,renderer=null,post=null,scene=null,camera=null,controls=null,environment=null,ground=null,sun=null,moon=null,hemi=null,observer=null,bounds=null,centre=null,disposed=false,loading=true,frame=0,approach=null,renderSerial=0,lastRenderMilliseconds=0,shadowSetup=null,selected='full',previewMode='full',capturing=false,fullManifestSHA256=null,evaluation=null;
const status=text=>$('distance-status').textContent=text;
const onError=event=>errors.push({message:event.message||String(event.reason)});window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);

async function loadFull(url){
  const base=new URL(url,location.href),response=await fetch(base,{signal:controller.signal});if(!response.ok)throw new Error(`Full manifest HTTP ${response.status}`);const bytes=await response.arrayBuffer(),manifest=JSON.parse(new TextDecoder().decode(bytes));fullManifestSHA256=await archiveSHA256(bytes);
  if(manifest.sourceDigest!==distance.distance.report.sourceArchiveDigest||manifest.id!==distance.distance.report.id||manifest.transport?.sourceManifestSHA256!==distance.distance.report.provenance.sourceManifestSHA256)throw new Error('Full source and distance source manifests differ.');
  return loadYuanmingyuanArchive({...manifest,glb:{...manifest.glb,url:new URL(manifest.glb.url,base).href},runtime:{...manifest.runtime,url:new URL(manifest.runtime.url,base).href}},{signal:controller.signal,onProgress:p=>status(`完整源：${p.phase}`)});
}

function setView(){
  if(!camera)return;const d=Number($('distance-range').value),height=Number($('distance-height').value),direction={south:[0,0,1],north:[0,0,-1],oblique:[.55,0,.84]}[$('distance-view').value];
  controls.target.set(centre.x,bounds.min.y+5,centre.z);camera.position.copy(centre).addScaledVector(new THREE.Vector3(...direction).normalize(),d);camera.position.y=bounds.min.y+height;camera.lookAt(controls.target);camera.updateMatrixWorld(true);controls.update();
  $('distance-range-label').value=d.toFixed(0)+' m';$('distance-height-label').value=height.toFixed(1)+' m';syncPresets();invalidate();
}

function setLight(){
  if(!sun)return;const value=Number($('distance-hour').value),light=impostorStudioLighting(value),direction=new THREE.Vector3(...light.direction),extent=bounds.getSize(new THREE.Vector3()).length();
  sun.position.copy(centre).addScaledVector(direction,extent*2);sun.target.position.copy(centre);sun.intensity=light.sunIntensity;sun.color.fromArray(light.sunColor);sun.castShadow=sun.intensity>.001;
  moon.position.copy(centre).addScaledVector(direction,-extent*2);moon.target.position.copy(centre);moon.intensity=light.moonIntensity;moon.castShadow=moon.intensity>.001;hemi.intensity=light.hemisphereIntensity;
  scene.background=new THREE.Color().fromArray(light.background);scene.environmentIntensity=.14+.04*Math.min(1,light.sunIntensity/3.6);shadowSetup={sun:fitStudyShadow(sun,bounds,bounds),moon:fitStudyShadow(moon,bounds,bounds)};renderer.shadowMap.needsUpdate=true;
  const minutes=Math.round(value*60)%1440;$('distance-hour-label').value=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;syncPresets();invalidate();
}

function syncPresets(){for(const button of document.querySelectorAll('[data-distance-preset]'))button.setAttribute('aria-pressed',String(Number(button.dataset.value)===Number($('distance-'+button.dataset.distancePreset).value)));}
function updateApproachReadout(){
  const trace=approachTrace.snapshot();if(!trace)return;
  const last=trace.lastFrame;$('distance-transition').textContent=`接近${trace.status==='running'?'进行中':trace.status==='completed'?'完成':'已停止'} · 实际渲染 ${trace.renderedFrames} 帧 · 切档 ${trace.totalSwitches} 次${last?` · 最近 ${last.horizontalDistanceMetres.toFixed(1)} m / ${last.representation==='full'?'完整源':'距离模型'}`:''}。记录随 PNG 保存。`;
}
function stopApproach(reason){approach=null;approachTrace.stop(reason,performance.now());$('distance-approach').textContent='播放 600→200 m 接近';updateApproachReadout();}
function changeView(){stopApproach('view-change');setView();}
function changeLight(){stopApproach('light-change');setLight();}

function selectRepresentation(){
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());camera.updateMatrixWorld(true);evaluation=distance.evaluate({camera,physicalWidth:size.x,physicalHeight:size.y});const previous=selected;
  if(previewMode==='full'||previewMode==='distance')selected=previewMode;
  else{
    // Explicitly isolated, unapproved transition experiment. No native token
    // is invented or passed into the runtime evaluation above.
    selected=selected==='distance'?evaluation.geometricEligible?'distance':'full':evaluation.geometricEligible&&evaluation.projectedErrorPhysicalPixels<=evaluation.pixelBudget*.8?'distance':'full';
  }
  full.group.visible=selected==='full';distance.group.visible=selected==='distance';if(previous!==selected)renderer.shadowMap.needsUpdate=true;
  $('distance-caption').textContent=`${selected==='full'?'完整无损源':'距离试点'} · ${previewMode==='transition'?'未审核过渡实验':'同镜头强制对照'} · 尚未准入世界`;
}

function metadata(){
  const r=distance?.distance.report,size=renderer?.getDrawingBufferSize(new THREE.Vector2());
  return {status:disposed?'disposed':loading?'loading':'unreviewed-distance-pilot',nativeAdmissionAllowed:false,asset:'zhengjuesi',mode:previewMode,selected,fullManifestSHA256,distanceManifestSHA256:distance?.distance.manifestSHA256,distanceReportSHA256:distance?.distance.reportSHA256,fullSourceNativeReview:distance?.distance.fullSourceNativeReview,counts:r?{sourceTriangles:r.originalTriangles,distanceTriangles:r.distanceTriangles,sourceDraws:r.originalDraws,distanceDraws:r.distanceDraws,placements:r.representedInstances}:null,camera:camera?{position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,near:camera.near,far:camera.far,projection:camera.projectionMatrix.toArray()}:null,reviewControls:{view:$('distance-view').value,horizontalRangeMetres:Number($('distance-range').value),heightMetres:Number($('distance-height').value)},physical:size?{width:size.x,height:size.y,dpr:renderer.getPixelRatio()}:null,hour:Number($('distance-hour').value),lighting:sun?{sun:sun.intensity,moon:moon.intensity,hemisphere:hemi.intensity,environment:scene.environmentIntensity,sunPosition:sun.position.toArray(),moonPosition:moon.position.toArray(),sunColor:sun.color.toArray()}:null,shadowSetup,evaluation,approach:approachTrace.snapshot(),render:renderer?{pipeline:'existing museum HDR/GTAO/MSAA high',samples:post.samples,renderSerial,cpuMilliseconds:lastRenderMilliseconds,info:{...renderer.info.render},memory:{...renderer.info.memory}}:null,errors:[...errors]};
}

function draw(){
  if(disposed||loading||document.hidden)return false;selectRepresentation();renderer.info.reset();const start=performance.now();post.render(0);const renderedAt=performance.now();lastRenderMilliseconds=renderedAt-start;renderSerial++;
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());approachTrace.rendered({nowMilliseconds:renderedAt,renderSerial,representation:selected,horizontalDistanceMetres:Math.hypot(camera.position.x-centre.x,camera.position.z-centre.z),cameraTargetDistanceMetres:camera.position.distanceTo(controls.target),cameraPosition:camera.position.toArray(),nearestSourceDepth:evaluation.nearestSourceDepth,projectedErrorPhysicalPixels:evaluation.projectedErrorPhysicalPixels,pixelBudget:evaluation.pixelBudget,geometricEligible:evaluation.geometricEligible,physicalWidth:size.x,physicalHeight:size.y});updateApproachReadout();
  const r=distance.distance.report;$('distance-metrics').textContent=`${r.originalTriangles.toLocaleString()} → ${r.distanceTriangles.toLocaleString()} tris；${r.originalDraws} → ${r.distanceDraws} draws。投影上界 ${evaluation.projectedErrorPhysicalPixels.toFixed(3)} physical px。`;$('distance-readout').textContent=JSON.stringify(metadata(),null,2);
  return true;
}

function tick(time){
  frame=0;if(disposed||loading||document.hidden||capturing)return;
  let completed=false;if(approach){approach.start??=time;const progress=Math.min(1,(time-approach.start)/approach.duration),smooth=progress*progress*(3-2*progress);$('distance-range').value=approach.from+(approach.to-approach.from)*smooth;setView();completed=progress===1;}
  controls.update();const rendered=draw();if(completed&&rendered){stopApproach('completed');$('distance-readout').textContent=JSON.stringify(metadata(),null,2);}if(approach&&!frame)frame=requestAnimationFrame(tick);
}
function invalidate(){if(!disposed&&!loading&&!document.hidden&&!frame&&!capturing)frame=requestAnimationFrame(tick);}
function resize(){if(!renderer||disposed)return;const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight),dpr=devicePixelRatio;renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);post.resize(width,height,dpr);camera.aspect=width/height;camera.updateProjectionMatrix();invalidate();}

async function save(){
  if(disposed||loading||capturing)return;stopApproach('capture');capturing=true;if(frame){cancelAnimationFrame(frame);frame=0;}
  try{draw();const record=metadata(),prefix=`yuanmingyuan-zhengjuesi-distance-${distance.distance.manifestSHA256.slice(0,16)}-${selected}-${$('distance-view').value}-${Date.now()}`,blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png')),files=[{name:prefix+'.png',body:blob},{name:prefix+'.json',body:new Blob([JSON.stringify(record,null,2)],{type:'application/json'})}];
    for(const file of files){const response=await fetch('/__review_capture/'+file.name,{method:'POST',body:file.body,signal:controller.signal});if(!response.ok)throw new Error(`Capture HTTP ${response.status}; any earlier file is retained.`);}status('已保存 '+prefix+'.png 与同帧 JSON。');return {files:files.map(f=>f.name),metadata:record};
  }catch(error){errors.push({message:error.message});status(error.message);throw error;}finally{capturing=false;}
}

function dispose(){
  if(disposed)return;stopApproach('disposed');disposed=true;controller.abort();if(frame)cancelAnimationFrame(frame);frame=0;observer?.disconnect();controls?.dispose();full?.dispose();distance?.dispose();ground?.geometry.dispose();ground?.material.dispose();environment?.dispose();for(const light of [sun,moon]){light?.shadow.map?.dispose();light?.shadow.mapPass?.dispose();}post?.dispose();scene?.clear();renderer?.dispose();renderer?.forceContextLoss();window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);document.body.dataset.ready='disposed';status('归档、后处理、阴影与 WebGL 资源已释放。');
}

async function prepare(){
  try{
    distance=await loadBuildingDistanceArchive({manifestURL:new URL(manifestPath,location.href).href,...(expectedManifestSHA256?{expectedManifestSHA256}:{})},{signal:controller.signal,onProgress:p=>status(`距离归档：${p.phase}`)});if(disposed){distance.dispose();return;}
    const r=distance.distance.report,sourcePath=query.get('full')||`/assets/yuanmingyuan/${r.id}/${r.sourceArchiveDigest.slice(0,16)}-gzip-bin-v1/manifest.json`;full=await loadFull(sourcePath);if(disposed){full.dispose();return;}
    bounds=new THREE.Box3(new THREE.Vector3(...r.boundsArchiveWorld.min),new THREE.Vector3(...r.boundsArchiveWorld.max));centre=bounds.getCenter(new THREE.Vector3());scene=new THREE.Scene();scene.add(full.group,distance.group);camera=new THREE.PerspectiveCamera(40,1,5,2000);
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;
    post=createRendering(renderer,scene,camera,{clipBox:bounds.clone().expandByScalar(35)});post.setQuality('high');controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=20;controls.maxDistance=1400;controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>stopApproach('orbit-controls'));
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);try{environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;}finally{room.dispose();pmrem.dispose();}
    ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshStandardMaterial({color:'#9da58d',roughness:.98}));ground.rotation.x=-Math.PI/2;ground.position.y=bounds.min.y-.01;ground.receiveShadow=true;scene.add(ground);
    sun=new THREE.DirectionalLight('#fff2df',3.6);moon=new THREE.DirectionalLight('#9eb9db',.05);hemi=new THREE.HemisphereLight('#c0d9f0','#4c593b',.6);for(const light of [sun,moon]){light.shadow.mapSize.set(4096,4096);scene.add(light,light.target);}scene.add(hemi);
    loading=false;document.body.dataset.ready='true';observer=new ResizeObserver(resize);observer.observe(stage);resize();setView();setLight();status(distance.distance.fullSourceNativeReview?.status==='native-comparison-passed-for-museum-loading'?'完整源已通过原生归档对照；距离表示与过渡仍待独立审核。':'完整源与距离表示已恢复；请先静态对照，再审查过渡。此源版本的原生问题仍保留。');draw();
  }catch(error){if(!disposed){errors.push({message:error.message,stack:error.stack});dispose();document.body.dataset.ready='failed';status('加载失败：'+error.message);$('distance-readout').textContent=JSON.stringify(metadata(),null,2);}}
}

$('distance-mode').addEventListener('change',()=>{stopApproach('mode-change');previewMode=$('distance-mode').value;invalidate();});$('distance-view').addEventListener('change',changeView);$('distance-range').addEventListener('input',changeView);$('distance-height').addEventListener('input',changeView);$('distance-hour').addEventListener('input',changeLight);$('distance-save').addEventListener('click',()=>void save().catch(()=>{}));$('distance-dispose').addEventListener('click',dispose);
for(const button of document.querySelectorAll('[data-distance-preset]'))button.addEventListener('click',()=>{const kind=button.dataset.distancePreset;$('distance-'+kind).value=button.dataset.value;kind==='hour'?changeLight():changeView();});
$('distance-approach').addEventListener('click',()=>{if(disposed||loading)return;if(approach){stopApproach('paused');invalidate();return;}previewMode='transition';$('distance-mode').value=previewMode;approach={from:600,to:200,start:null,duration:8000};approachTrace.begin({nowMilliseconds:performance.now(),fromMetres:approach.from,toMetres:approach.to,durationMilliseconds:approach.duration});$('distance-range').value=approach.from;setView();$('distance-approach').textContent='暂停接近';updateApproachReadout();invalidate();});
window.addEventListener('pagehide',dispose,{once:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate();});
window.__ZHENGJUESI_DISTANCE_STUDY__={metadata,save,dispose,setMode(mode){if(!['full','distance','transition'].includes(mode))throw new Error('Unknown review mode');stopApproach('mode-change');previewMode=mode;$('distance-mode').value=mode;invalidate();},setDistance(value){$('distance-range').value=value;changeView();},setHeight(value){$('distance-height').value=value;changeView();},setHour(value){$('distance-hour').value=value;changeLight();},setView(value){$('distance-view').value=value;changeView();},setProjection({near=camera.near,far=camera.far,fov=camera.fov}={}){if(!(near>0&&far>near&&fov>0&&fov<180))throw new Error('Invalid review projection');stopApproach('projection-change');camera.near=near;camera.far=far;camera.fov=fov;camera.updateProjectionMatrix();invalidate();},render:draw};
void prepare();
