import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {QUALITY,renderPixelRatio} from './render-quality.js';
import {createGardenSpecimen} from './gardens.js';
import * as models from './models.js';
import {loadCharacterAssets,createWizard,createWisp,updateCharacter} from './characters.js';
import {loadLandscapeAssets,createTreeSpecimen,surface,planarUV} from './landscape.js';
import {createSkyLantern} from './atmosphere.js';
import {createPortal,createShield} from './effects.js';
import {createViaduct,createGardenLamp,createResearchBook} from './site-details.js';
import {createTerrainSpecimen} from './world.js';
const assets=[
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
 ['rider','Broom Rider / 飞行人物',createWizard,'A bent felt hat, full silver mask and tailored riding coat, with five blended flight actions. 弯尖毡帽、全脸银色面具与骑乘外套，配有五组飞行动作。'],
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
const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples||0)});
const composer=new EffectComposer(renderer,sceneTarget);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.3,.4,1.5);composer.addPass(bloom);const smaa=new SMAAPass();smaa.enabled=sceneTarget.samples===0;composer.addPass(smaa);composer.addPass(new OutputPass());
let current=null,wire=false,day=false,last=performance.now();
let actorAction='idle',actorPlaying=true;
const actorTools=document.createElement('div');actorTools.className='actor-tools';actorTools.hidden=true;
actorTools.innerHTML='<label>Action / 动作 <select aria-label="Character action"><option value="idle">Hover / 悬停</option><option value="cruise">Cruise / 飞行</option><option value="turn-left">Turn left / 左转</option><option value="turn-right">Turn right / 右转</option><option value="boost">Boost / 加速</option><option value="channel">Channel / 施法</option></select></label><button data-actor-play aria-pressed="true">Animate / 动画</button><div class="actor-views"><button data-actor-view="front">Front / 正面</button><button data-actor-view="side">Side / 侧面</button><button data-actor-view="back">Back / 背面</button></div>';
document.querySelector('.stage').append(actorTools);
actorTools.querySelector('select').onchange=e=>{actorAction=e.target.value;};
actorTools.querySelector('[data-actor-play]').onclick=e=>{actorPlaying=!actorPlaying;e.currentTarget.setAttribute('aria-pressed',String(actorPlaying));};
actorTools.querySelectorAll('[data-actor-view]').forEach(button=>button.onclick=()=>{
  if(!current)return;controls.autoRotate=false;document.querySelector('#rotate').setAttribute('aria-pressed','false');
  current.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*1.55;
  const directions={front:[0,.18,-1],side:[1,.18,0],back:[0,.18,1]};camera.position.copy(center).add(new THREE.Vector3(...directions[button.dataset.actorView]).multiplyScalar(radius));controls.target.copy(center);controls.update();
});
const specimens=new Map();
document.querySelector('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));
document.querySelector('aside').append(document.querySelector('.caption'));
const buttons=document.querySelector('#assets');assets.forEach(([id,name])=>{const b=document.createElement('button');b.textContent=name;b.dataset.asset=id;b.addEventListener('click',()=>show(id));buttons.insertBefore(b,document.querySelector('.caption'));});
function show(id){const selected=assets.find(a=>a[0]===id)||assets[0];if(current)scene.remove(current);if(!specimens.has(selected[0]))specimens.set(selected[0],selected[2]());current=specimens.get(selected[0]);scene.add(current);current.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.72;
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
}
document.querySelector('#rotate').onclick=e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));};
document.querySelector('#wire').onclick=e=>{wire=!wire;current?.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.wireframe=wire);});e.currentTarget.setAttribute('aria-pressed',String(wire));};
document.querySelector('#light').onclick=e=>{day=!day;e.currentTarget.setAttribute('aria-pressed',String(day));scene.background.set(day?'#afb8bc':'#262c30');hemi.intensity=day?2.7:1.8;key.color.set(day?'#fff3e0':'#ffe0b7');key.intensity=day?3.8:3.2;};
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),dpr=renderPixelRatio('high',r.width,r.height,devicePixelRatio);renderer.setPixelRatio(dpr);renderer.setSize(r.width,r.height,false);composer.setPixelRatio(dpr);composer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe(canvas);
try{await Promise.all([loadLandscapeAssets(),models.loadArchitectureAssets?.(),loadCharacterAssets()]);show(new URLSearchParams(location.search).get('asset'));document.querySelector('#loading').hidden=true;document.body.dataset.ready='true';}catch(error){document.querySelector('#loading').innerHTML='<div class="studio-error">Asset loading failed. The portfolio remains available from the link above.</div>';console.error(error);}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;controls.update(dt);current?.userData.update?.(now/1000,false);updateCharacter(current,{dt:actorPlaying?dt:0,speed:actorAction==='boost'?1:actorAction==='idle'?0:.55,turn:actorAction==='turn-left'?-1:actorAction==='turn-right'?1:0,state:actorAction==='channel'?'channel':undefined,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});composer.render();}requestAnimationFrame(frame);
