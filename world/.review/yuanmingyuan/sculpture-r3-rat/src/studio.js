import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),canvas=document.querySelector('canvas');
const sourceTag=(query.get('source')||'unfrozen-study').replace(/[^a-z0-9-]/gi,'').slice(0,64);
const names={front:'西正面 · West elevation',threequarter:'斜向全貌 · Three-quarter',north:'北侧 · North',south:'南侧 · South',back:'东侧水工楼 · East waterworks',aerial:'俯瞰 · Aerial',fountain:'生肖水法 · Zodiac fountain',stone:'石雕与窗 · Stone and windows',roof:'屋顶瓦作 · Glazed roof',stairs:'阶梯与栏杆 · Stairs and balustrades'};
const sculptures={rat:'鼠 · Rat',ox:'牛 · Ox',tiger:'虎 · Tiger',rabbit:'兔 · Rabbit',dragon:'龙 · Dragon',snake:'蛇 · Snake',horse:'马 · Horse',goat:'羊 · Goat',monkey:'猴 · Monkey',rooster:'鸡 · Rooster',dog:'狗 · Dog',pig:'猪 · Pig',clam:'中央石蚌 · Clam'};
let asset=null,renderer=null,controls=null,environment=null,floor=null,key=null,fill=null,hemi=null,observer=null;
let scene=null,camera=null,view=Object.hasOwn(names,query.get('view'))?query.get('view'):'threequarter',light=['day','night','neutral'].includes(query.get('light'))?query.get('light'):'day',viewMode='preset',sculpture=null;
let disposed=false,failed=false,suspended=document.hidden,contextLost=false,frame=0,startupFrame=0,restoreFrame=0,settling=0,rendering=false,renderSerial=0,saveSerial=0,capturing=false;
let frameReady=false,environmentDirty=true,environmentGeneration=0,createFactory=null;
const uploads=new Set(),downloads=new Set();
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function active(){return !disposed&&!suspended&&!document.hidden&&!contextLost;}
function sync(){
  const available=!!asset&&frameReady&&!environmentDirty&&active();
  document.body.dataset.ready=available?'true':failed?'failed':disposed?'disposed':contextLost?'context-lost':suspended||document.hidden?'suspended':asset?'preparing':'loading';
  document.querySelector('aside').setAttribute('aria-busy',String(!available&&!disposed));
  if(controls)controls.enabled=available;
  for(const el of document.querySelectorAll('fieldset,select,input,button'))el.disabled=!available||(capturing&&el.id==='save-frame');
}
function markShadowsDirty(){if(renderer)renderer.shadowMap.needsUpdate=true;}
function boxFor(groupNames){const box=new THREE.Box3();for(const name of groupNames){const object=asset.group.getObjectByName(name);if(object)box.union(new THREE.Box3().setFromObject(object));}return box.isEmpty()?new THREE.Box3().setFromObject(asset.group):box;}
function frameBox(box,direction,margin=1.14){
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const back=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(camera.up,back).normalize(),up=new THREE.Vector3().crossVectors(back,right);
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV())/2),tanX=tanY*camera.aspect;
  let distance=0;
  // Every corner must fit both projected axes at its own depth, not just at the box centre.
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(center),depth=offset.dot(back);
    distance=Math.max(distance,depth+Math.abs(offset.dot(right))*margin/tanX,depth+Math.abs(offset.dot(up))*margin/tanY,depth+camera.near*2);
  }
  camera.position.copy(center).addScaledVector(back,distance);camera.far=Math.max(1200,distance+size.length()*2);camera.updateProjectionMatrix();
  controls.maxDistance=Math.max(400,distance*3);controls.target.copy(center);controls.update();
}
function viewCaption(){$('view-caption').textContent=(view==='sculpture'?sculptures[sculpture]:names[view])+(viewMode==='orbit'?' · 自由视角 / Orbit':'')+' · 实际模型 / Rendered geometry';}
function setView(next){
  if(!asset||!Object.hasOwn(names,next))return;view=next;viewMode='preset';sculpture=null;$('sculpture').value='';
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  const west=boxFor(['west-hall','west-stairs','zodiac-fountain']),whole=boxFor(['west-hall','waterworks','west-stairs','zodiac-fountain']);
  if(next==='front')frameBox(west,new THREE.Vector3(0,.20,1));
  else if(next==='threequarter')frameBox(whole,new THREE.Vector3(.82,.56,1));
  else if(next==='north')frameBox(whole,new THREE.Vector3(-1,.18,0));
  else if(next==='south')frameBox(whole,new THREE.Vector3(1,.18,0));
  else if(next==='back')frameBox(boxFor(['waterworks']),new THREE.Vector3(.15,.22,-1));
  else if(next==='aerial')frameBox(whole,new THREE.Vector3(.22,1,.24));
  else if(next==='fountain')frameBox(boxFor(['zodiac-fountain']),new THREE.Vector3(.05,.3,1),1.05);
  else if(next==='stairs')frameBox(boxFor(['west-stairs']),new THREE.Vector3(-.4,.2,1),1.02);
  else{
    const hall=boxFor(['west-hall']),s=hall.getSize(new THREE.Vector3()),c=hall.getCenter(new THREE.Vector3());
    if(next==='roof'){hall.min.y=hall.max.y-s.y*.32;frameBox(hall,new THREE.Vector3(.35,.52,1),1.08);}
    else{c.x-=s.x*.24;const detail=new THREE.Box3(new THREE.Vector3(c.x-s.x*.14,hall.min.y+s.y*.22,hall.max.z-s.z*.14),new THREE.Vector3(c.x+s.x*.14,hall.min.y+s.y*.68,hall.max.z));frameBox(detail,new THREE.Vector3(.12,.05,1),1.1);}
  }
  controls.enableDamping=damping;
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
  frameReady=false;viewCaption();sync();invalidate();
}
function setSculpture(id){
  if(!id){setView('fountain');return;}
  if(!asset||!Object.hasOwn(sculptures,id))return;
  const name=id==='clam'?'giant-clam':`zodiac-${id}`,object=asset.group.getObjectByName(name);
  if(!object){$('sculpture').value=sculpture||'';status(`模型中未找到 ${name}，保留当前视角。`,true);return;}
  view='sculpture';sculpture=id;viewMode='preset';$('sculpture').value=id;
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  const facing=new THREE.Vector3(id==='clam'?.06:.16,.22,1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
  frameBox(new THREE.Box3().setFromObject(object),facing,1.14);controls.enableDamping=damping;
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed','false');
  frameReady=false;viewCaption();sync();invalidate();
}
function setLight(next){
  light=next;const night=next==='night',neutral=next==='neutral';
  scene.background=new THREE.Color(night?'#273b52':neutral?'#c6cbc6':'#c9dce1');
  // Unshadowed fill must leave room for the key's relief shadows on pale stone.
  hemi.color.set(night?'#b7c6dd':neutral?'#e5e5e3':'#dfdfe3');hemi.groundColor.set(night?'#90847a':'#afa395');hemi.intensity=night?.26:neutral?.42:.38;
  key.color.set(night?'#ccdef8':neutral?'#ffffff':'#fff1d7');key.intensity=night?1.8:neutral?2.65:3.2;
  fill.color.set(night?'#b0bfd5':'#dbdfe4');fill.intensity=night?.07:.10;scene.environmentIntensity=night?.14:neutral?.16:.18;
  floor.material.color.set(night?'#747f83':neutral?'#a6ada4':'#b9bbad');renderer.toneMappingExposure=1;
  $('lighting').value=next;frameReady=false;markShadowsDirty();sync();invalidate();
}
function resize(){
  if(!renderer||disposed||suspended||document.hidden||contextLost)return;
  const width=canvas.clientWidth,height=canvas.clientHeight,ratio=devicePixelRatio||1;if(width<=0||height<=0)return;
  if(canvas.width===Math.floor(width*ratio)&&canvas.height===Math.floor(height*ratio)&&camera.aspect===width/height&&renderer.getPixelRatio()===ratio)return;
  frameReady=false;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  if(asset&&viewMode==='preset'){if(view==='sculpture')setSculpture(sculpture);else setView(view);}sync();invalidate();
}
function diagnostics(){return {asset:'haiyantang-proportional-study',sourceTag,view,viewMode,sculpture,assetPart:sculpture?(sculpture==='clam'?'giant-clam':`zodiac-${sculpture}`):null,lighting:light,lightingSetup:{key:key.intensity,fill:fill.intensity,hemisphere:hemi.intensity,environment:scene.environmentIntensity,keyColor:key.color.getHexString(),skyColor:hemi.color.getHexString(),groundColor:hemi.groundColor.getHexString(),exposure:renderer.toneMappingExposure},renderSerial,environmentGeneration,wireframe:$('wireframe').checked,camera:camera.position.toArray(),target:controls.target.toArray(),projection:{fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,zoom:camera.zoom},native:{cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,width:canvas.width,height:canvas.height,pixelRatio:renderer.getPixelRatio()},render:{...renderer.info.render},memory:{...renderer.info.memory},assetData:asset?.diagnostics||null,historicalMetricAccuracy:'not-established'};}
function render(){
  if(!active()||!asset||environmentDirty)return false;
  if(renderer.getContext().isContextLost()){contextInterrupted();return false;}
  controls.update();renderer.render(scene,camera);
  if(renderer.getContext().isContextLost()){contextInterrupted();return false;}
  renderSerial++;const firstFrame=!frameReady;frameReady=true;
  const d=diagnostics();$('readout').textContent=`原生画布 ${d.native.width} × ${d.native.height}\nDPR ${d.native.pixelRatio}\n本次绘制 ${d.render.triangles.toLocaleString()} triangles\n${d.render.calls} draw calls\n${d.memory.geometries} geometries · ${d.memory.textures} textures\nSource ${sourceTag}\n${JSON.stringify(d.assetData?.provisionalScale||'待测绘标定',null,2)}`;
  if(firstFrame){sync();status('模型已显示。此为比例与材料研究，尚未通过历史尺寸与雕塑形态验收。');}
  return true;
}
function stopFrames(){cancelAnimationFrame(frame);cancelAnimationFrame(startupFrame);cancelAnimationFrame(restoreFrame);frame=0;startupFrame=0;restoreFrame=0;settling=0;}
function tick(){frame=0;if(!active())return;rendering=true;try{render();}catch(error){fail(error);}finally{rendering=false;}if(active()&&--settling>0&&!frame)frame=requestAnimationFrame(tick);}
function invalidate(){if(!active()||!asset||environmentDirty)return;settling=20;if(!frame&&!rendering)frame=requestAnimationFrame(tick);}
function checkCapture(controller){
  if(!active()&&!controller.signal.aborted)controller.abort();
  if(controller.signal.aborted)throw controller.signal.reason;
}
function encodeFrame(controller){
  return new Promise((resolve,reject)=>{
    const signal=controller.signal,onAbort=()=>reject(signal.reason);checkCapture(controller);
    signal.addEventListener('abort',onAbort,{once:true});
    try{canvas.toBlob(value=>{signal.removeEventListener('abort',onAbort);if(signal.aborted)return;value?resolve(value):reject(new Error('Frame encoding failed'));},'image/png');}
    catch(error){signal.removeEventListener('abort',onAbort);reject(error);}
  });
}
async function postCaptureFile(file,controller){
  checkCapture(controller);const timer=setTimeout(()=>controller.abort(new Error('保存超时，未确认整组证据。')),20000);
  try{
    let response;
    try{response=await fetch(`/__review_capture/${file.name}`,{method:'POST',body:file.blob,signal:controller.signal});}
    catch(error){if(!controller.signal.aborted){error.captureFallback=true;error.serverMayHaveCopy=true;}throw error;}
    checkCapture(controller);if(response.ok)return;
    const error=new Error(response.status===409?'已有同名证据，未覆盖。':`Capture HTTP ${response.status}`);
    error.captureFallback=response.status===404||response.status===405;throw error;
  }finally{clearTimeout(timer);}
}
async function savePair(files,controller){
  let saved=0;
  try{for(const file of files){await postCaptureFile(file,controller);saved++;}return {destination:'server',partial:false};}
  catch(error){
    if(controller.signal.aborted||!error.captureFallback){error.serverPartial=saved>0;throw error;}
    checkCapture(controller);
    // A failed second upload may leave one server file; always offer the entire pair locally.
    for(const file of files){
      const url=URL.createObjectURL(file.blob);downloads.add(url);const a=document.createElement('a');
      a.href=url;a.download=file.name;a.textContent=file.name.endsWith('.png')?'下载 PNG 原生画面':'下载 JSON 诊断记录';$('capture-files').append(a);a.click();
    }
    return {destination:'download',partial:saved>0||!!error.serverMayHaveCopy};
  }
}
async function saveFrame(){
  if(!asset||capturing||!frameReady||!active())return;
  const controller=new AbortController();uploads.add(controller);capturing=true;$('capture-files').replaceChildren();sync();
  try{
    if(!render())throw new Error('尚未显示可保存的原生帧。');
    const metadata=diagnostics(),captureView=view==='sculpture'?`sculpture-${sculpture}`:view,name=`yuanmingyuan-haiyantang-${sourceTag}-${captureView}-${light}-${Date.now()}-${++saveSerial}`;
    const blob=await encodeFrame(controller);checkCapture(controller);
    const result=await savePair([{name:name+'.png',blob},{name:name+'.json',blob:new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'})}],controller);
    status(result.destination==='server'?`已保存 ${name}.png 与同名 JSON。`:`已发起 PNG 与 JSON 整组下载；若浏览器拦截，请使用下方两个链接。${result.partial?'服务器可能保留了部分副本。':''}`);
  }catch(error){
    const message=controller.signal.aborted?(controller.signal.reason?.name==='AbortError'?'离开页面或图形中断，已取消画面保存。':controller.signal.reason.message):error.message;
    status(message+(error.serverPartial?'服务器已保留部分文件；本次未确认成对证据。':''),true);
  }finally{uploads.delete(controller);capturing=false;sync();}
}
function dispose(){
  if(disposed)return;disposed=true;frameReady=false;stopFrames();for(const c of uploads)c.abort();uploads.clear();observer?.disconnect();controls?.dispose();
  canvas.removeEventListener('webglcontextrestored',contextRestored);
  asset?.dispose();floor?.geometry.dispose();floor?.material.dispose();environment?.dispose();key?.shadow.map?.dispose();key?.shadow.mapPass?.dispose();renderer?.dispose();
  for(const url of downloads)URL.revokeObjectURL(url);downloads.clear();sync();
}
function fail(error){failed=true;status(`模型研究无法继续：${error.message}`,true);dispose();}
function rebuildEnvironment(){
  if(!active())return false;
  let room=null,pmrem=null,target=null;
  try{
    room=new RoomEnvironment();pmrem=new THREE.PMREMGenerator(renderer);target=pmrem.fromScene(room,.04);
  }finally{room?.dispose();pmrem?.dispose();}
  if(!active()){target.dispose();sync();return false;}
  if(renderer.getContext().isContextLost()){target.dispose();contextInterrupted();return false;}
  environment?.dispose();environment=target;scene.environment=target.texture;environmentDirty=false;environmentGeneration++;markShadowsDirty();return true;
}
function createRenderer(){
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.04,1200);renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  // Register after Three's listener: GL recovery and renderer-private recovery are distinct.
  canvas.addEventListener('webglcontextrestored',contextRestored);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.7;controls.maxDistance=400;controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>{viewMode='orbit';viewCaption();});
  sync();
}
function createAsset(){
  asset=createFactory();scene.add(asset.group);asset.group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(asset.group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),extent=Math.max(size.x,size.z)*.8;
  floor=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({color:'#b9bbad',roughness:.98}));floor.rotation.x=-Math.PI/2;floor.position.y=bounds.min.y-.015;floor.receiveShadow=true;scene.add(floor);
  hemi=new THREE.HemisphereLight('#e8f0ee','#9c9684',1.65);scene.add(hemi);
  key=new THREE.DirectionalLight('#fff0d8',3.05);key.position.set(center.x-extent*.8,center.y+extent*1.5,center.z+extent);key.target.position.copy(center);key.castShadow=true;key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:extent*5});key.shadow.normalBias=.018;key.shadow.bias=-.00005;scene.add(key,key.target);
  fill=new THREE.DirectionalLight('#dcecf7',.45);fill.position.set(center.x+extent,center.y+extent*.8,center.z-extent);scene.add(fill);
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
  $('sculpture').addEventListener('change',()=>setSculpture($('sculpture').value));
  $('lighting').addEventListener('change',()=>setLight($('lighting').value));
  $('wireframe').addEventListener('change',()=>{asset.group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=$('wireframe').checked;});frameReady=false;markShadowsDirty();sync();invalidate();});
  $('save-frame').addEventListener('click',saveFrame);observer=new ResizeObserver(resize);observer.observe(canvas);
}
function prepare(){
  if(!active()||!createFactory){sync();return;}
  if(restoreFrame){cancelAnimationFrame(restoreFrame);restoreFrame=0;}
  try{
    if(!renderer)createRenderer();
    if(!asset){
      if(startupFrame)return;
      status('正在生成可编辑体量、石雕与瓦作…');
      startupFrame=requestAnimationFrame(()=>{
        startupFrame=0;if(!active())return;
        try{createAsset();resize();setLight(light);setView(view);if(!rebuildEnvironment())return;sync();invalidate();}catch(error){fail(error);}
      });
    }else{
      if(environmentDirty&&!rebuildEnvironment())return;
      resize();sync();invalidate();
    }
  }catch(error){fail(error);}
}
async function start(){
  try{const {createHaiyantangStudy}=await import('./haiyantang-study.js');if(disposed)return;createFactory=createHaiyantangStudy;prepare();}catch(error){fail(error);}
}
function contextInterrupted(){
  if(disposed)return;contextLost=true;frameReady=false;environmentDirty=true;stopFrames();for(const c of uploads)c.abort();sync();status('图形上下文中断。保留原画质，恢复后重新生成环境照明。',true);
}
function contextRestored(){
  if(disposed)return;contextLost=false;frameReady=false;environmentDirty=true;status('正在以原画质恢复环境照明…');sync();
  if(!active())return;
  // A tracked later frame also avoids native between-listener microtask checkpoints.
  cancelAnimationFrame(restoreFrame);restoreFrame=requestAnimationFrame(()=>{restoreFrame=0;if(active())prepare();});
}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextInterrupted();});
document.addEventListener('visibilitychange',()=>{
  if(disposed)return;suspended=document.hidden;frameReady=false;
  if(suspended){stopFrames();for(const c of uploads)c.abort();sync();}else prepare();
});
window.addEventListener('pagehide',dispose);
window.addEventListener('resize',resize);
window.addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
await start();
