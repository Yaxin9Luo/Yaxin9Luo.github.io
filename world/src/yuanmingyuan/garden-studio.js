import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {gardenLayout} from './garden-layout.js';
import {createGardenTerrain} from './garden-terrain.js';
import {createGardenEnvironment} from './garden-environment.js';
import {createGardenWater} from './garden-water.js';
import {createExhibitionCoast} from './exhibition-coast.js';

const $=id=>document.getElementById(id),canvas=document.querySelector('canvas'),query=new URLSearchParams(location.search);
const sourceTag=(query.get('source')||'unfrozen-study').replace(/[^a-z0-9-]/gi,'').slice(0,64),controller=new AbortController();
const views={all:{label:'圆明三园 · Three gardens',target:[30,0,0],camera:[1880,2050,2740],span:1600},western:{label:'西洋楼地块 · Western Palace terrain',target:[690,4,-620],camera:[920,180,-360],span:350},fuhai:{label:'福海三岛 · Fuhai islands',target:[107,2,-282],camera:[540,475,330],span:480},jiuzhou:{label:'九洲 · Nine islands',target:[-610,3,0],camera:[-120,460,520],span:460},changchun:{label:'长春园大湖 · Changchun Lake',target:[800,3,-210],camera:[1190,485,320],span:460},qichun:{label:'绮春园 · Qichunyuan',target:[420,3,520],camera:[1040,720,1300],span:720}};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.2,22000),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(devicePixelRatio||1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=8;controls.maxDistance=9000;
let terrain=null,water=null,environment=null,view=Object.hasOwn(views,query.get('view'))?query.get('view'):'all',disposed=false,contextLost=false,ready=false,capturing=false,playing=false,raf=0,last=0,time=0,serial=0;
const active=()=>!disposed&&!contextLost&&!document.hidden;
function status(message){$('status').textContent=message;}
function sync(){document.body.dataset.ready=disposed?'disposed':contextLost?'context-lost':ready?'true':'loading';for(const button of document.querySelectorAll('button,select'))button.disabled=!ready||capturing||!active();$('play').setAttribute('aria-pressed',String(playing));$('play').textContent=playing?'暂停水面与天空':'播放水面与天空';}
function evidence(){return {sourceTag,view,timeSeconds:time,playing,timeMode:environment?.clock.mode,timePhase:environment?.clock.phase,canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,pixelRatio:renderer.getPixelRatio()},camera:camera.position.toArray(),target:controls.target.toArray(),render:{...renderer.info.render},memory:{...renderer.info.memory},terrain:terrain?.diagnostics,water:{sheets:water?.sheets.length,reflectionPixels:2048},scope:'terrain, water, sky only; architecture and vegetation not represented as completed'};}
function render(dt=0){if(!ready||!active())return;const sample=environment.update(dt,{paused:!playing,focus:controls.target,shadowSpan:views[view].span});water.update(time,sample,camera);renderer.render(scene,camera);$('readout').textContent=JSON.stringify(evidence(),null,2);}
function tick(now){raf=0;if(!active()||!ready||!playing||capturing)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;time+=dt;render(dt);raf=requestAnimationFrame(tick);}
function start(){last=0;if(!raf&&playing&&active()&&ready&&!capturing)raf=requestAnimationFrame(tick);}
function setView(id){view=id;controls.target.fromArray(views[id].target);camera.position.fromArray(views[id].camera);controls.update();$('view-caption').textContent=views[id].label+' · 实际三维模型';for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===id));render();}
function resize(){if(!active())return;renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();render();}
const observer=new ResizeObserver(resize);observer.observe(canvas);controls.addEventListener('change',()=>render());
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
$('light').addEventListener('change',()=>{environment?.clock.setMode($('light').value,true);render();});
$('play').addEventListener('click',()=>{playing=!playing;sync();if(playing)start();else{cancelAnimationFrame(raf);raf=0;}});
$('save-frame').addEventListener('click',async()=>{
  if(!ready||capturing||!active())return;capturing=true;cancelAnimationFrame(raf);raf=0;sync();
  try{render();const data=evidence(),png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png||disposed)throw new Error('No rendered frame');const name=`yuanmingyuan-terrain-${sourceTag}-${view}-${environment.clock.mode}-${Date.now()}-${++serial}`;
    for(const [ext,body]of [['png',png],['json',new Blob([JSON.stringify(data,null,2)],{type:'application/json'})]]){const response=await fetch(`/__review_capture/${name}.${ext}`,{method:'POST',body,signal:controller.signal});if(!response.ok)throw new Error(`Capture HTTP ${response.status}`);}status(`已保存 ${name}.png 与同名 JSON。`);
  }catch(error){if(!disposed)status(error.message);}finally{capturing=false;sync();start();}
});
function dispose(){if(disposed)return;disposed=true;controller.abort();cancelAnimationFrame(raf);observer.disconnect();controls.dispose();water?.dispose();terrain?.dispose();environment?.dispose();renderer.dispose();sync();}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden){render();start();}sync();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;cancelAnimationFrame(raf);raf=0;status('图形上下文中断，请重新载入。');sync();});
sync();resize();
try{
  await new Promise(resolve=>requestAnimationFrame(resolve));if(disposed)throw new DOMException('Page closed','AbortError');
  terrain=createGardenTerrain({coastline:createExhibitionCoast(gardenLayout)});scene.add(terrain.group);water=createGardenWater({terrain,layout:gardenLayout});scene.add(water.group);
  const requestedLight=['day','dawn','dusk','night','auto'].includes(query.get('light'))?query.get('light'):'day';$('light').value=requestedLight;
  environment=await createGardenEnvironment({renderer,scene,signal:controller.signal,timeMode:requestedLight});
  if(!disposed){ready=true;setView(view);resize();sync();status('山水模型已显示；建筑与植物另行审查。');}
}catch(error){if(!disposed){status(error.message);document.body.dataset.ready='failed';}}
