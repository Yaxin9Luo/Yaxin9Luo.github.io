import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {createExhibitionStage} from './exhibits.js';
import {getProject,getProjectMedia,selectedProjects} from './exhibition-content.js';

const query=new URLSearchParams(location.search),canvas=document.querySelector('canvas'),scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,.03,200),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.485;controls.target.set(62,6.8,57);
const stage=createExhibitionStage(scene,()=>0,{lang:query.get('lang')==='zh'?'zh':'en'});
const hemi=new THREE.HemisphereLight('#d8e3e5','#605444',2.1);scene.add(hemi);
const key=new THREE.DirectionalLight('#fff0d9',3.2);key.position.set(47,25,74);key.target.position.set(62,5,57);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-19,right:19,top:21,bottom:-12,near:1,far:70});key.shadow.normalBias=.017;key.shadow.bias=-.00015;scene.add(key,key.target);
const rim=new THREE.DirectionalLight('#c0d6ed',1.2);rim.position.set(78,16,41);rim.target.position.set(62,5,57);scene.add(rim,rim.target);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#555b54',roughness:.97}));floor.rotation.x=-Math.PI/2;floor.position.set(62,-.015,57);floor.receiveShadow=true;scene.add(floor);
const reduced=document.querySelector('#reduced');reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches||query.get('reduced')==='1';
let opened=query.get('open')!=='0',focused=query.get('focus')!=='0',view=query.get('view')||'wide',last=performance.now(),lastSource=Symbol('unloaded');
const el=id=>document.getElementById(id);
function syncStates(){el('open').setAttribute('aria-pressed',String(opened));el('focus').setAttribute('aria-pressed',String(focused));stage.setOpen(opened,{reducedMotion:reduced.checked});stage.setFocused(focused,{reducedMotion:reduced.checked});}
function setView(next){
  view=next;const origin=stage.group.position;
  const positions={desk:[1.4,8.7,13.4],folio:[5.8,9.2,10.5],instrument:[-3.4,6.0,7.0],role:[0,4.75,8.2],media:[0,8.1,10.5]};
  const targets={desk:[0,3.82,3.66],folio:[3.05,4.12,3.8],instrument:[-3.83,4.7,3.53],role:[0,4.32,2.6],media:[0,8.1,-3.9]};
  if(positions[next]){camera.position.copy(origin).add(new THREE.Vector3(...positions[next]));controls.target.copy(origin).add(new THREE.Vector3(...targets[next]));}
  else{
    const size=stage.camera.bounds.getSize(new THREE.Vector3()),center=stage.camera.bounds.getCenter(new THREE.Vector3());
    const distance=Math.max(size.y,size.x/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.23+size.z*.42;
    controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,.20,1).normalize().multiplyScalar(distance));
  }
  controls.update();document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===next)));
}
function setLight(mode){
  const night=mode==='night',day=mode==='day';scene.background=new THREE.Color(night?'#152331':day?'#b9c3c3':'#555f61');
  hemi.intensity=night?.72:day?2.7:2.1;hemi.color.set(night?'#9bbdde':'#d8e3e5');key.intensity=night?1.5:day?4:3.2;key.color.set(night?'#abc2e4':day?'#fff3d8':'#fff0d9');rim.intensity=night?1.7:1.2;
  scene.environmentIntensity=night?.12:.24;floor.material.color.set(night?'#313b40':'#62675e');el('light').value=mode;document.body.dataset.light=mode;
}
function updateMediaControls(){
  const p=getProject(stage.projectId),l=stage.lang;el('media').replaceChildren(...p.media.map((media,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${index+1}. ${media.title[l]}`;return option;}));el('media').value=String(stage.mediaIndex);el('media').disabled=!p.media.length;
  el('reader-link').href=`/#project/${encodeURIComponent(p.id)}${stage.mediaIndex?`?media=${stage.mediaIndex}`:''}`;
}
function setProject(id){if(stage.setProject(id)){el('project').value=id;updateMediaControls();}}
for(const project of selectedProjects){const option=document.createElement('option');option.value=project.id;option.textContent=project.shortTitle[stage.lang];el('project').append(option);}
el('project').onchange=event=>setProject(event.target.value);el('media').onchange=event=>{stage.setMedia(Number(event.target.value));updateMediaControls();};
el('language').value=stage.lang;el('language').onchange=event=>{stage.setLanguage(event.target.value);document.documentElement.lang=stage.lang==='zh'?'zh-CN':'en';updateMediaControls();};
el('light').onchange=event=>setLight(event.target.value);el('open').onclick=()=>{opened=!opened;syncStates();};el('focus').onclick=()=>{focused=!focused;syncStates();};reduced.onchange=syncStates;
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
const dialog=el('detail'),detail=el('detail-body');el('close-detail').onclick=()=>dialog.close();
function showDetail(section){
  const p=getProject(stage.projectId),l=stage.lang;detail.replaceChildren();
  const title=document.createElement('h2');title.textContent=p.shortTitle[l];detail.append(title);
  if(section==='media'){
    const media=getProjectMedia(p.id,stage.mediaIndex);if(!media){showDetail('method');return;}
    const img=document.createElement('img');img.src=media.src;img.alt=media.title[l];detail.append(img);
    const caption=document.createElement('p');caption.textContent=media.caption[l];detail.append(caption);
    const link=document.createElement('a');link.href=media.source;link.textContent=media.sourceLabel[l];link.target='_blank';link.rel='noopener';detail.append(link);
  }else{
    detail.className='reader-copy';
    for(const [heading,text]of section==='role'?[[l==='zh'?'研究团队':'Research team',p.authors],[l==='zh'?'作者贡献标记':'Authorship role',`Yaxin Luo · ${p.role[l]}`]]:[[l==='zh'?'研究问题':'Research question',p.question[l]],[l==='zh'?'方法':'Method',p.approach[l]]]){const h=document.createElement('h2'),body=document.createElement('p');h.textContent=heading;body.textContent=text;detail.append(h,body);}
    const link=document.createElement('a');link.href=el('reader-link').href;link.textContent=l==='zh'?'阅读完整项目与来源':'Read the full project and sources';detail.append(link);
  }
  if(section==='media')detail.className='';if(!dialog.open)dialog.showModal();
}
const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let down=null;
canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointerup',event=>{
  if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;down=null;
  const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(stage.interactiveTargets,false)[0],blocker=raycaster.intersectObject(stage.group,true)[0];if(!hit||(blocker&&blocker.distance<hit.distance-.05))return;
  const target=hit.object.userData.exhibition;
  if(target.action==='open')showDetail('media');
  else if(target.action==='detail'){opened=true;syncStates();showDetail(target.section||'method');}
  else if(target.action.endsWith('Media')){stage.setMedia(stage.mediaIndex+(target.action==='nextMedia'?1:-1));updateMediaControls();}
  else if(target.action.endsWith('Project')){const index=selectedProjects.findIndex(p=>p.id===stage.projectId),offset=target.action==='nextProject'?1:-1;setProject(selectedProjects[(index+offset+selectedProjects.length)%selectedProjects.length].id);}
});
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio||1,2.5));renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();setView(view);}).observe(canvas);
document.addEventListener('visibilitychange',()=>{last=performance.now();});
setProject(getProject(query.get('project'))?.id||'autodesign');stage.setMedia(Number(query.get('media'))||0);updateMediaControls();setLight(['neutral','day','night'].includes(query.get('light'))?query.get('light'):'neutral');
stage.setOpen(opened,{reducedMotion:true});stage.setFocused(focused,{reducedMotion:true});syncStates();setView(view);
let meshes=0,triangles=0;stage.group.traverse(mesh=>{if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;}});
await stage.materialsReady;el('loading').hidden=true;document.body.dataset.ready='true';
new HDRLoader().loadAsync('/textures/environment/sky.hdr').then(texture=>{texture.mapping=THREE.EquirectangularReflectionMapping;scene.environment=texture;}).catch(()=>{});
window.__exhibitStudio={stage,scene,camera,renderer,controls,setView,setLight,showDetail};
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;stage.update(now/1000,dialog.open?0:dt,reduced.checked);controls.update();renderer.render(scene,camera);if(stage.loadedSource!==lastSource){lastSource=stage.loadedSource;el('status').textContent=`${meshes} meshes · ${Math.round(triangles).toLocaleString()} triangles · ${stage.materialErrors.length?`${stage.materialErrors.length} material errors`:'local PBR loaded'} · ${stage.loadedSource?'image ready':'paper record'}`;}}
requestAnimationFrame(frame);
