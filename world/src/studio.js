import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import * as models from './models.js';
import {loadCharacterAssets,createWizard,createWisp} from './characters.js';
import {loadLandscapeAssets,createTreeSpecimen,surface,planarUV} from './landscape.js';
import {createSkyLantern} from './atmosphere.js';
import {createPortal,createShield} from './effects.js';
import {createViaduct,createGardenLamp,createResearchBook} from './site-details.js';
import {createTerrainSpecimen} from './world.js';
const assets=[
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
 ['rider','Broom Rider / 飞行人物',createWizard,'An original adult character, tailored coat, scarf and handmade broom.'],
 ['wraith','Wraith / 幽影',createWisp,'An original hooded spirit with layered cloth and a torn silhouette.'],
 ['pine','Pine / 松树',()=>createTreeSpecimen('pine'),'Procedural branching and cutout foliage from the MIT-licensed EZ-Tree library.'],
 ['ash','Ash Tree / 白蜡树',()=>createTreeSpecimen('ash'),'Irregular branching, individually shaped leaves and textured bark.'],
 ['shield','Protego / 护盾',createShield,'Fresnel rim, flowing light and a translucent protective membrane.'],
 ['portal','Portal / 传送门',()=>createPortal(),'Animated runic membrane, orbiting glyphs and individual sparks.'],
 ['rock','Rock Material / 苔石',()=>{const g=new THREE.IcosahedronGeometry(3,4);planarUV(g,.3);return new THREE.Mesh(g,surface('mossy-rock'));},'Real scanned base color, OpenGL normal and roughness maps.'],
];
const canvas=document.querySelector('canvas'),scene=new THREE.Scene();scene.background=new THREE.Color('#262c30');
const camera=new THREE.PerspectiveCamera(38,1,.05,2000);const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.autoRotateSpeed=.35;
const hemi=new THREE.HemisphereLight('#c8d5e8','#5b4b3d',1.8);scene.add(hemi);
const key=new THREE.DirectionalLight('#ffe0b7',3.2);key.position.set(-50,80,60);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-55,right:55,top:75,bottom:-45,far:240});key.shadow.normalBias=.08;scene.add(key);
const rim=new THREE.DirectionalLight('#b2cadc',1.8);rim.position.set(40,35,-60);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:'#353b39',roughness:.96}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.3,.4,1.5);composer.addPass(bloom);composer.addPass(new OutputPass());
let current=null,wire=false,day=false,last=performance.now();
const specimens=new Map();
document.querySelector('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));
document.querySelector('aside').append(document.querySelector('.caption'));
const buttons=document.querySelector('#assets');assets.forEach(([id,name])=>{const b=document.createElement('button');b.textContent=name;b.dataset.asset=id;b.addEventListener('click',()=>show(id));buttons.insertBefore(b,document.querySelector('.caption'));});
function show(id){const selected=assets.find(a=>a[0]===id)||assets[0];if(current)scene.remove(current);if(!specimens.has(selected[0]))specimens.set(selected[0],selected[2]());current=specimens.get(selected[0]);scene.add(current);current.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.72;
  floor.position.y=box.min.y-.035;camera.position.copy(center).add(new THREE.Vector3(radius*1.5,radius*.7,radius*1.85*(['rider','wraith'].includes(selected[0])?-1:1)));controls.target.copy(center);controls.minDistance=radius*.18;controls.maxDistance=radius*8;camera.near=Math.max(.02,radius/200);camera.updateProjectionMatrix();controls.update();
  current.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.wireframe=wire;});}});
  document.querySelector('#name').textContent=selected[1];document.querySelector('#description').textContent=selected[3];buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.asset===selected[0])));
  let triangles=0,meshes=0;current.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  document.querySelector('#stats').textContent=`${meshes} meshes · ${Math.round(triangles).toLocaleString()} triangles · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`;
  const model=selected[0]==='rider'?'wizard':selected[0],architecture=['castle','library','workshop','observatory','ruins','owlery'].includes(model);
  document.querySelector('#downloads').innerHTML=architecture?`<a href="/models/architecture/${model}.glb" download>GLB 模型 ↓</a> · <a href="/models/architecture/${model}-studio.blend" download>Blender 源文件 ↓</a><br><small>GLB uses shared textures; Blender includes packed textures.<br>GLB 需保留共用贴图；Blender 文件已内嵌贴图。</small>`:['wizard','wraith'].includes(model)?`<a href="/models/characters/${model}.glb" download>GLB 模型 ↓</a>`:'';
  document.body.dataset.asset=selected[0];history.replaceState(null,'',`?asset=${selected[0]}`);
}
document.querySelector('#rotate').onclick=e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));};
document.querySelector('#wire').onclick=e=>{wire=!wire;current?.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.wireframe=wire);});e.currentTarget.setAttribute('aria-pressed',String(wire));};
document.querySelector('#light').onclick=e=>{day=!day;e.currentTarget.setAttribute('aria-pressed',String(day));scene.background.set(day?'#afb8bc':'#262c30');hemi.intensity=day?2.7:1.8;key.color.set(day?'#fff3e0':'#ffe0b7');key.intensity=day?3.8:3.2;};
new ResizeObserver(()=>{const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);composer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe(canvas.parentElement);
try{await Promise.all([loadLandscapeAssets(),models.loadArchitectureAssets?.(),loadCharacterAssets()]);show(new URLSearchParams(location.search).get('asset'));document.querySelector('#loading').hidden=true;document.body.dataset.ready='true';}catch(error){document.querySelector('#loading').innerHTML='<div class="studio-error">Asset loading failed. The portfolio remains available from the link above.</div>';console.error(error);}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;controls.update(dt);current?.userData.update?.(now/1000,false);composer.render();}requestAnimationFrame(frame);
