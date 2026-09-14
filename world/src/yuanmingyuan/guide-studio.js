import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMuseumGuidePool} from './guide-pool.js';
import {createMuseumGuides} from './museum-guides.js';
import {MuseumReader} from './museum-reader.js';
import {companionManifest} from '../companion-manifest.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas'),query=new URLSearchParams(location.search),sourceTag=(query.get('source')||'unfrozen-guides').replace(/[^a-z0-9-]/gi,'').slice(0,64);
const controller=new AbortController(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.05,150),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
scene.background=new THREE.Color('#c5ceca');const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxDistance=60;controls.minDistance=2;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:'#b6b5a5',roughness:.94}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const hemi=new THREE.HemisphereLight('#dfe9e9','#a0a089',.65),key=new THREE.DirectionalLight('#fff1d5',3.1),fill=new THREE.DirectionalLight('#cde0ed',.4);
key.position.set(-9,15,12);key.target.position.set(0,1,2);key.castShadow=true;key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-18,right:18,top:16,bottom:-12,near:.1,far:65});key.shadow.normalBias=.008;fill.position.set(12,6,-8);scene.add(hemi,key,key.target,fill);
let pool=null,guides=null,disposed=false,raf=0,last=performance.now(),selected='haiyan',inspection=false,freezeSign=false,contextLost=false;
let visitor={x:-5,y:0,z:5},lastReadout=0;
const reader=new MuseumReader({lang:query.get('lang')==='en'?'en':'zh',onOpen:()=>{guides?.setPaused(true);cancelAnimationFrame(raf);raf=0;renderer.render(scene,camera);},onClose:()=>{guides?.setPaused(freezeSign);start();},onLanguage:lang=>guides?.setLanguage(lang)});
function active(){return !disposed&&!document.hidden&&!contextLost&&!reader.isOpen;}
function status(text){$('status').textContent=text;}
function select(id){
  const record=guides?.snapshot().actors.find(actor=>actor.id===id);if(!record)return;
  selected=id;visitor={x:record.position.x,y:record.position.y,z:record.position.z+5};camera.position.set(record.position.x+3.8,record.position.y+3.4,record.position.z+8.8);controls.target.set(record.position.x+.3,record.position.y+1.6,record.position.z);controls.update();
  $('view-caption').textContent=(id==='haiyan'?'海晏堂 · Haiyantang':'远瀛观 · Yuanyingguan')+' · 实际模型';for(const button of document.querySelectorAll('[data-guide]'))button.setAttribute('aria-pressed',String(button.dataset.guide===id));renderer.render(scene,camera);
}
function interact({inspect=false}={}){
  if(!active()||!guides)return;freezeSign=false;inspection=inspect;guides.setPaused(false);
  const record=guides.snapshot().actors.find(actor=>actor.id===selected);visitor={x:record.position.x,y:record.position.y,z:record.position.z+5};
  status(guides.interact(selected,{playerPosition:visitor})?'导游正在举牌…':'导游正在完成动作，请稍后再试。');start();
}
function evidence(){return {sourceTag,assetSHA256:companionManifest.elizabeth.sha256,selected,visitor,inspection,freezeSign,contextLost,canvas:{cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,width:canvas.width,height:canvas.height,pixelRatio:renderer.getPixelRatio()},camera:camera.position.toArray(),target:controls.target.toArray(),render:{...renderer.info.render},guides:guides?.snapshot()};}
function resize(){if(disposed||contextLost)return;renderer.setPixelRatio(devicePixelRatio||1);renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);}
const observer=new ResizeObserver(resize);observer.observe(canvas);controls.addEventListener('change',()=>{if(!disposed&&!contextLost)renderer.render(scene,camera);});
function tick(now){
  raf=0;if(!active()||!guides)return;const dt=Math.min(.1,(now-last)/1000);last=now;
  guides.update(dt,{playerPosition:visitor,reducedMotion:$('reduced').checked});renderer.render(scene,camera);
  if(now-lastReadout>400||freezeSign||reader.isOpen){lastReadout=now;$('readout').textContent=JSON.stringify(evidence(),null,2);}
  if(active()&&!freezeSign)raf=requestAnimationFrame(tick);
}
function start(){last=performance.now();if(active()&&guides&&!raf&&!freezeSign)raf=requestAnimationFrame(tick);}
function onKey(event){if(event.code!=='KeyE'||event.repeat||event.target.closest('input,select,textarea,dialog'))return;event.preventDefault();interact();}
document.addEventListener('keydown',onKey);
for(const button of document.querySelectorAll('[data-guide]'))button.addEventListener('click',()=>select(button.dataset.guide));
$('interact').addEventListener('click',interact);
$('inspect-sign').addEventListener('click',()=>interact({inspect:true}));
$('resume').addEventListener('click',()=>{freezeSign=false;inspection=false;guides?.setPaused(false);start();status('继续巡逻。');});
$('save-frame').addEventListener('click',async()=>{
  if(disposed||contextLost)return;const button=$('save-frame');button.disabled=true;
  try{
    renderer.render(scene,camera);const metadata=evidence(),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||disposed)throw new Error('没有可保存的实机画面。');
    const name=`museum-guides-${sourceTag}-${selected}-${Date.now()}`;
    for(const [extension,body] of [['png',blob],['json',new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'})]]){const response=await fetch(`/__review_capture/${name}.${extension}`,{method:'POST',body,signal:controller.signal});if(!response.ok)throw new Error(`保存未完成：HTTP ${response.status}`);}
    status(`已保存 ${name}.png 与同名 JSON。`);
  }catch(error){if(!disposed)status(error.message);}finally{if(!disposed)button.disabled=false;}
});
function dispose(){if(disposed)return;disposed=true;controller.abort();cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('keydown',onKey);reader.dispose();guides?.dispose();pool?.dispose();controls.dispose();ground.geometry.dispose();ground.material.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();renderer.dispose();document.body.dataset.ready='disposed';}
window.addEventListener('pagehide',dispose);window.addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else start();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;cancelAnimationFrame(raf);raf=0;document.body.dataset.ready='context-lost';status('图形上下文已中断，请重新载入检查页。');});
try{
  pool=await createMuseumGuidePool({signal:controller.signal});if(disposed){pool.dispose();}else{
    guides=createMuseumGuides({pool,root:scene,heightAt:()=>0,waterLevel:-2,language:reader.lang,placements:[
      {id:'haiyan',entryId:'haiyantang',position:{x:-5,z:0},heading:0,waypoints:[{x:-5,z:4},{x:-1,z:4},{x:-1,z:0}]},
      {id:'yuanying',entryId:'yuanyingguan',position:{x:6,z:0},heading:0,waypoints:[{x:6,z:4},{x:10,z:4},{x:10,z:0}]},
    ],onInspect:({entryId})=>{if(inspection){freezeSign=true;guides.setPaused(true);status('举牌已定格，可拖动近看；点击继续巡逻恢复。');}else reader.open(entryId,{trigger:$('interact')});}});
    $('guide-controls').disabled=false;document.body.dataset.ready='true';resize();select(selected);status('模型已加载。按 E 或按钮互动。');start();
  }
}catch(error){if(!disposed){document.body.dataset.ready='failed';status(error.message);}}
