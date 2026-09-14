import '../published-three-assets.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {studioAssets,getStudioAsset,studioAssetUrl} from './studio-assets.js';
import {createRendering} from '../rendering.js';
import {loadMuseumArchive,museumArchiveCatalog} from './asset-source.js';
import {fitStudyShadow} from './shadow-framing.js';
import {visibleStudyBounds,fitStudyCameraClipping,STUDY_MINIMUM_NEAR} from './study-clipping.js';
import {readNativeFrame,encodeNativeFrame} from './native-frame-capture.js';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),canvas=document.querySelector('canvas');
const sourceTag=(query.get('source')||'unfrozen-study').replace(/[^a-z0-9-]/gi,'').slice(0,64);
const assetConfig=getStudioAsset(query.get('asset'));
let asset=null,renderer=null,controls=null,environment=null,floor=null,key=null,fill=null,hemi=null,observer=null,post=null;
const worldRendering=query.get('render')==='world';
const stillReview=query.get('review')==='still';
const displayedCapture=query.get('capture')==='displayed';
const environmentOverrideRequest=query.get('env');
let environmentOverride=null;
let scene=null,camera=null,view=Object.hasOwn(assetConfig.views,query.get('view'))?query.get('view'):assetConfig.defaultView,light=['day','night','neutral'].includes(query.get('light'))?query.get('light'):'day',viewMode='preset',sculpture=null;
let disposed=false,failed=false,suspended=document.hidden,contextLost=false,frame=0,startupFrame=0,restoreFrame=0,settling=0,rendering=false,renderSerial=0,saveSerial=0,capturing=false;
let frameReady=false,environmentDirty=true,environmentGeneration=0,createFactory=null;
const uploads=new Set(),downloads=new Set();
const assetLoadController=new AbortController();
let preparedAsset=null;
let fullAssetBounds=null,shadowSetup=null,shadowReceiverBounds=null;
let visibleAssetBounds=null,clipSetup=null;
const originalVisibility=new Map();
let isolatedParts=[];
let animationPlaying=false,animationTime=0,lastAnimationFrame=null;
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function active(){return !disposed&&!suspended&&!document.hidden&&!contextLost;}
function sync(){
  const available=!!asset&&frameReady&&!environmentDirty&&active();
  document.body.dataset.ready=available?'true':failed?'failed':disposed?'disposed':contextLost?'context-lost':suspended||document.hidden?'suspended':asset?'preparing':'loading';
  document.querySelector('aside').setAttribute('aria-busy',String(!available&&!disposed));
  if(controls)controls.enabled=available;
  for(const el of document.querySelectorAll('#views,select,input,button'))el.disabled=!available||(capturing&&el.id==='save-frame');
  $('sculpture').disabled=!available||Object.keys(assetConfig.sculptures).length===0;
  $('animate-water').disabled=!available||typeof asset?.update!=='function';
  $('studio-asset').disabled=disposed;
}
function markShadowsDirty(){if(renderer)renderer.shadowMap.needsUpdate=true;}
function boxFor(groupNames){
  if(!groupNames.length)return new THREE.Box3().setFromObject(asset.group);
  const box=new THREE.Box3();
  for(const name of groupNames){const object=asset.group.getObjectByName(name);if(!object)throw new Error(`模型中未找到 ${name}`);box.union(new THREE.Box3().setFromObject(object));}
  return box;
}
function frameBox(box,direction,margin=1.14){
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const back=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(camera.up,back).normalize(),up=new THREE.Vector3().crossVectors(back,right);
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV())/2),tanX=tanY*camera.aspect;
  let distance=0;
  // Every corner must fit both projected axes at its own depth, not just at the box centre.
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(center),depth=offset.dot(back);
    distance=Math.max(distance,depth+Math.abs(offset.dot(right))*margin/tanX,depth+Math.abs(offset.dot(up))*margin/tanY,depth+STUDY_MINIMUM_NEAR*2);
  }
  camera.position.copy(center).addScaledVector(back,distance);camera.far=Math.max(1200,distance+size.length()*2);camera.updateProjectionMatrix();
  controls.maxDistance=Math.max(400,distance*3);controls.target.copy(center);controls.update();
  if(key&&(!shadowReceiverBounds||!shadowReceiverBounds.equals(box))){shadowSetup=fitStudyShadow(key,box,fullAssetBounds||box);shadowReceiverBounds=box.clone();markShadowsDirty();}
}
function frameSelection(spec){
  let box,direction,isolatedObjects;
  try{
    box=boxFor(spec.groups);direction=new THREE.Vector3(...spec.direction);
    isolatedObjects=(spec.isolate||[]).map(name=>{const object=asset.group.getObjectByName(name);if(!object)throw new Error(`模型中未找到 ${name}`);return object;});
    if(spec.crop){const min=box.min.clone(),size=box.getSize(new THREE.Vector3());box.set(new THREE.Vector3(...spec.crop.min).multiply(size).add(min),new THREE.Vector3(...spec.crop.max).multiply(size).add(min));}
    if(spec.orientationGroup){const object=asset.group.getObjectByName(spec.orientationGroup);if(!object)throw new Error(`模型中未找到 ${spec.orientationGroup}`);direction.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));}
  }catch(error){status(`${error.message}，保留当前视角。`,true);return false;}
  // Close-up cameras may sit inside neighbouring buildings. Isolate explicitly,
  // preserving authored visibility and every ancestor needed by a nested mesh.
  const retained=new Set();
  for(const object of isolatedObjects){object.traverse(child=>retained.add(child));for(let parent=object.parent;parent;parent=parent.parent){retained.add(parent);if(parent===asset.group)break;}}
  let visibilityChanged=false;
  for(const [object,original] of originalVisibility){const visible=original&&(!isolatedObjects.length||retained.has(object));if(object.visible!==visible){object.visible=visible;visibilityChanged=true;}}
  isolatedParts=[...(spec.isolate||[])];if(visibilityChanged)markShadowsDirty();
  visibleAssetBounds=visibleStudyBounds(asset.group);
  const damping=controls.enableDamping;controls.enableDamping=false;try{controls.update();frameBox(box,direction,spec.margin);assetConfig.frameView?.({group:asset.group,camera,controls,spec});}finally{controls.enableDamping=damping;}return true;
}
function viewCaption(){$('view-caption').textContent=(view==='sculpture'?assetConfig.sculptures[sculpture]:assetConfig.views[view]).label+(viewMode==='orbit'?' · 自由视角 / Orbit':'')+(isolatedParts.length?' · 分件隔离 / Isolated parts':'')+' · 实际模型 / Rendered geometry';}
function readEnvironmentOverride(params){
  const values=params.getAll('env');if(!values.length)return null;
  const value=Number(values[0]);
  if(values.length!==1||values[0].trim()===''||!Number.isFinite(value)||value<0||value>2)throw new Error('env 必须是 0–2 之间的有限数，且只能出现一次。');
  return value;
}
function setView(next){
  if(!asset||!Object.hasOwn(assetConfig.views,next)||!frameSelection(assetConfig.views[next]))return;
  view=next;viewMode='preset';sculpture=null;$('sculpture').value='';
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
  frameReady=false;viewCaption();sync();invalidate();
}
function setSculpture(id){
  if(!id){setView(assetConfig.sculptureDefaultView);return;}
  if(!asset||!Object.hasOwn(assetConfig.sculptures,id))return;
  if(!frameSelection(assetConfig.sculptures[id])){$('sculpture').value=sculpture||'';return;}
  view='sculpture';sculpture=id;viewMode='preset';$('sculpture').value=id;
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed','false');
  frameReady=false;viewCaption();sync();invalidate();
}
function setLight(next){
  light=next;const night=next==='night',neutral=next==='neutral';
  scene.background=new THREE.Color(night?'#273b52':neutral?'#c6cbc6':'#c9dce1');
  // Unshadowed fill must leave room for the key's relief shadows on pale stone.
  hemi.color.set(night?'#b7c6dd':neutral?'#e5e5e3':'#dfdfe3');hemi.groundColor.set(night?'#90847a':'#afa395');hemi.intensity=night?.26:neutral?.42:.38;
  key.color.set(night?'#ccdef8':neutral?'#ffffff':'#fff1d7');key.intensity=night?1.8:neutral?2.65:3.2;
  fill.color.set(night?'#b0bfd5':'#dbdfe4');fill.intensity=night?.07:.10;scene.environmentIntensity=environmentOverride??(night?.14:neutral?.16:.18);
  floor.material.color.set(night?'#747f83':neutral?'#a6ada4':'#b9bbad');renderer.toneMappingExposure=1;
  $('lighting').value=next;frameReady=false;markShadowsDirty();sync();invalidate();
}
function resize(){
  if(!renderer||disposed||suspended||document.hidden||contextLost)return;
  const width=canvas.clientWidth,height=canvas.clientHeight,ratio=devicePixelRatio||1;if(width<=0||height<=0)return;
  if(canvas.width===Math.floor(width*ratio)&&canvas.height===Math.floor(height*ratio)&&camera.aspect===width/height&&renderer.getPixelRatio()===ratio)return;
  frameReady=false;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);post?.resize(width,height,ratio);camera.aspect=width/height;camera.updateProjectionMatrix();
  if(asset&&viewMode==='preset'){if(view==='sculpture')setSculpture(sculpture);else setView(view);}sync();invalidate();
}
function diagnostics(){const selection=view==='sculpture'?assetConfig.sculptures[sculpture]:assetConfig.views[view];return {asset:assetConfig.studyId,assetId:assetConfig.id,sourceTag,assetSource:asset?.archive?'archive':'factory',archive:asset?.archive||null,view,viewMode,sculpture,assetPart:sculpture?selection.orientationGroup:null,assetParts:selection.groups,isolatedParts:[...isolatedParts],animation:{playing:animationPlaying,timeSeconds:animationTime},coordinates:assetConfig.coordinates,lighting:light,shadowSetup,clipSetup,renderPipeline:post?'museum-GTAO-HDR-MSAA':'direct-PBR',lightingSetup:{key:key.intensity,fill:fill.intensity,hemisphere:hemi.intensity,environment:scene.environmentIntensity,keyColor:key.color.getHexString(),skyColor:hemi.color.getHexString(),groundColor:hemi.groundColor.getHexString(),exposure:renderer.toneMappingExposure},renderSerial,environmentGeneration,environmentOverride:environmentOverrideRequest===null?null:{requested:environmentOverrideRequest,value:environmentOverride},wireframe:$('wireframe').checked,camera:camera.position.toArray(),target:controls.target.toArray(),projection:{fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,zoom:camera.zoom},native:{cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,width:canvas.width,height:canvas.height,pixelRatio:renderer.getPixelRatio()},render:{...renderer.info.render},memory:{...renderer.info.memory},assetData:asset?.diagnostics||null,historicalMetricAccuracy:'not-established'};}


// This witness only belongs to this studio's completed, preserved direct frame.
// It records small state/revision values, never copies source geometry buffers.
const captureRefs=new WeakMap();let captureRefSerial=0,displayedFrame=null;
function captureRef(value){if(value===null||value===undefined)return null;if(!captureRefs.has(value))captureRefs.set(value,++captureRefSerial);return captureRefs.get(value);}
function captureValue(value,ancestors=new Set()){
  if(value===null||value===undefined||['string','number','boolean'].includes(typeof value))return value;
  if(typeof value==='function')return ['function',captureRef(value)];
  if(value.isTexture){
    const images=Array.isArray(value.image)?value.image:[value.image];
    if(images.some(image=>!image||image.complete===false||!(image.width>0&&image.height>0)))throw new Error('A displayed-frame texture is not fully available.');
    return ['texture',captureRef(value),value.version,captureRef(value.source),value.source?.version,images.map(image=>[captureRef(image),image.width,image.height,image.depth??null]),
      value.mapping,value.channel,value.wrapS,value.wrapT,value.magFilter,value.minFilter,value.anisotropy,value.format,value.internalFormat,value.type,value.colorSpace,value.flipY,value.premultiplyAlpha,value.unpackAlignment,value.generateMipmaps,value.matrixAutoUpdate,value.matrix.toArray(),value.offset.toArray(),value.repeat.toArray(),value.center.toArray(),value.rotation];
  }
  if(value.toArray&&(value.isColor||value.isVector2||value.isVector3||value.isVector4||value.isQuaternion||value.isEuler||value.isMatrix3||value.isMatrix4))return value.toArray();
  if(ArrayBuffer.isView(value)){if(value.length>4096)throw new Error('Unsupported large displayed-frame uniform.');return [captureRef(value),...value];}
  if(ancestors.has(value)||ancestors.size>12)throw new Error('Unsupported cyclic displayed-frame material state.');
  const next=new Set(ancestors);next.add(value);
  if(Array.isArray(value))return value.map(v=>captureValue(v,next));
  if(Object.getPrototypeOf(value)!==null&&Object.getPrototypeOf(value)?.constructor?.name!=='Object')throw new Error('Unsupported displayed-frame material value.');
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,captureValue(value[k],next)]));
}
function displayedFrameState(metadata){
  const attributes=attribute=>attribute?[captureRef(attribute),attribute.version,captureRef(attribute.array),attribute.array?.byteLength,attribute.count,attribute.itemSize,attribute.normalized,attribute.usage,
    attribute.data?[captureRef(attribute.data),attribute.data.version,captureRef(attribute.data.array),attribute.data.array?.byteLength,attribute.data.stride]:null]:null;
  const nodes=[],materials=new Map();
  scene.traverse(object=>{
    const geometry=object.geometry;
    for(const material of [].concat(object.material??[]))if(!materials.has(material)){
      const values={};for(const key of Object.keys(material).sort())if(key!=='_listeners')values[key]=captureValue(material[key]);
      materials.set(material,[captureRef(material),values]);
    }
    nodes.push([captureRef(object),captureRef(object.parent),object.visible,object.layers.mask,object.position.toArray(),object.quaternion.toArray(),object.scale.toArray(),object.matrix.toArray(),object.matrixWorld.toArray(),object.matrixAutoUpdate,object.matrixWorldAutoUpdate,
      object.renderOrder,object.frustumCulled,object.castShadow,object.receiveShadow,captureRef(object.onBeforeRender),captureRef(object.onAfterRender),
      geometry?[captureRef(geometry),attributes(geometry.index),Object.keys(geometry.attributes).sort().map(k=>[k,attributes(geometry.attributes[k])]),Object.entries(geometry.morphAttributes).map(([key,values])=>[key,values.map(attributes)]),geometry.drawRange,geometry.groups]:null,
      [].concat(object.material??[]).map(captureRef),object.isInstancedMesh?[object.count,attributes(object.instanceMatrix),attributes(object.instanceColor)]:null,object.morphTargetInfluences??null,
      object.isLight?[object.intensity,object.color?.toArray(),object.groundColor?.toArray(),object.distance,object.decay,object.angle,object.penumbra,
        object.target?[object.target.position.toArray(),object.target.matrixWorld.toArray()]:null,object.shadow?[object.shadow.bias,object.shadow.normalBias,object.shadow.radius,object.shadow.mapSize.toArray(),[object.shadow.camera.left,object.shadow.camera.right,object.shadow.camera.top,object.shadow.camera.bottom,object.shadow.camera.near,object.shadow.camera.far],object.shadow.camera.projectionMatrix.toArray(),object.shadow.camera.matrixWorld.toArray()]:null]:null]);
  });
  return JSON.stringify({metadata,nodes,materials:[...materials.values()],camera:[camera.position.toArray(),camera.quaternion.toArray(),camera.scale.toArray(),camera.up.toArray(),camera.matrix.toArray(),camera.matrixWorld.toArray(),camera.matrixWorldInverse.toArray(),camera.projectionMatrix.toArray(),camera.projectionMatrixInverse.toArray(),camera.layers.mask,camera.coordinateSystem,camera.filmGauge,camera.filmOffset,camera.view],
    target:controls.target.toArray(),environment:captureValue(scene.environment),background:captureValue(scene.background),environmentIntensity:scene.environmentIntensity,environmentRotation:scene.environmentRotation?.toArray(),backgroundIntensity:scene.backgroundIntensity,backgroundBlurriness:scene.backgroundBlurriness,
    renderer:[renderer.getPixelRatio(),renderer.outputColorSpace,renderer.toneMapping,renderer.toneMappingExposure,renderer.autoClear,renderer.autoClearColor,renderer.autoClearDepth,renderer.autoClearStencil,renderer.getViewport?.(new THREE.Vector4())?.toArray(),renderer.getScissor?.(new THREE.Vector4())?.toArray(),renderer.getScissorTest?.(),renderer.getClearColor?.(new THREE.Color())?.toArray(),renderer.getClearAlpha?.(),renderer.shadowMap.enabled,renderer.shadowMap.type,renderer.shadowMap.autoUpdate,renderer.shadowMap.needsUpdate]});
}
function displayedFrameEligibility(){
  const gl=renderer?.getContext();
  if(!stillReview||worldRendering||post||animationPlaying||animationTime!==0||controls?.enableDamping!==false)throw new Error('Displayed-frame capture requires an unanimated direct-PBR review=still frame.');
  if(!active()||failed||!frameReady||environmentDirty||rendering||frame||startupFrame||restoreFrame||settling>0||renderer.shadowMap.needsUpdate)throw new Error('Displayed-frame capture has pending or invalidated rendering.');
  if(gl?.isContextLost()||gl?.getContextAttributes?.()?.preserveDrawingBuffer!==true||renderer.getRenderTarget()!==null||gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)!==null||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null||
    gl.drawingBufferWidth!==canvas.width||gl.drawingBufferHeight!==canvas.height)throw new Error('A preserved default framebuffer is unavailable.');
}
function captureDisplayedMetadata(){
  displayedFrameEligibility();
  if(!displayedFrame||displayedFrame.serial!==renderSerial)throw new Error('No completed displayed-frame witness.');
  if(displayedFrame.error)throw new Error('Displayed-frame witness unavailable: '+displayedFrame.error);
  const metadata=diagnostics();
  if(displayedFrameState(metadata)!==displayedFrame.state)throw new Error('Displayed-frame state changed; render a new still frame before saving.');
  return JSON.parse(displayedFrame.metadata);
}

function render(){
  if(displayedCapture)displayedFrame=null;
  if(!active()||!asset||environmentDirty)return false;
  if(renderer.getContext().isContextLost()){contextInterrupted();return false;}
  asset.update?.(animationTime);controls.update();
  if(visibleAssetBounds)clipSetup=fitStudyCameraClipping(camera,visibleAssetBounds);
  if(post){renderer.info.reset();post.render(0);}else renderer.render(scene,camera);
  if(renderer.getContext().isContextLost()){contextInterrupted();return false;}
  renderSerial++;const firstFrame=!frameReady;frameReady=true;
  const d=diagnostics();$('readout').textContent=`Asset ${d.assetId}\n原生画布 ${d.native.width} × ${d.native.height}\nDPR ${d.native.pixelRatio}\n本次绘制 ${d.render.triangles.toLocaleString()} triangles\n${d.render.calls} draw calls\n${d.memory.geometries} geometries · ${d.memory.textures} textures\nEnvironment IBL ${d.lightingSetup.environment}${d.environmentOverride===null?' · default':` · URL env=${d.environmentOverride.requested}`}\nSource ${sourceTag}\n${JSON.stringify(d.assetData?.provisionalScale||'待测绘标定',null,2)}`;
  if(firstFrame){sync();status('模型已显示。此为比例与材料研究，尚未通过历史尺寸与雕塑形态验收。');}
  if(displayedCapture&&stillReview&&!post&&!animationPlaying&&animationTime===0){
    // The render has returned; synchronous readPixels later waits for its GL work.
    // Unsupported state refuses reuse without invalidating the ordinary display.
    try{displayedFrame={serial:renderSerial,metadata:JSON.stringify(d),state:displayedFrameState(d)};}catch(error){displayedFrame={serial:renderSerial,error:error.message};}
  }
  return true;
}
function stopFrames(){cancelAnimationFrame(frame);cancelAnimationFrame(startupFrame);cancelAnimationFrame(restoreFrame);frame=0;startupFrame=0;restoreFrame=0;settling=0;lastAnimationFrame=null;}
function tick(now){frame=0;if(!active())return;if(animationPlaying&&!capturing&&lastAnimationFrame!==null)animationTime+=Math.max(0,Math.min(.1,(now-lastAnimationFrame)/1000));lastAnimationFrame=now;rendering=true;try{render();}catch(error){fail(error);}finally{rendering=false;}if(active()&&(--settling>0||animationPlaying)&&!frame)frame=requestAnimationFrame(tick);}
function invalidate(){if(displayedCapture)displayedFrame=null;if(!active()||!asset||environmentDirty)return;settling=stillReview?1:20;if(!frame&&!rendering)frame=requestAnimationFrame(tick);}
function checkCapture(controller){
  if(!active()&&!controller.signal.aborted)controller.abort();
  if(controller.signal.aborted)throw controller.signal.reason;
}
function encodeFrame(nativeFrame,controller){
  return new Promise((resolve,reject)=>{
    const signal=controller.signal,onAbort=()=>reject(signal.reason);checkCapture(controller);
    signal.addEventListener('abort',onAbort,{once:true});
    try{encodeNativeFrame(nativeFrame).then(value=>{signal.removeEventListener('abort',onAbort);if(!signal.aborted)resolve(value);},error=>{signal.removeEventListener('abort',onAbort);reject(error);});}
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
    let metadata;
    if(displayedCapture){
      if(query.getAll('capture').length!==1)throw new Error('Displayed-frame capture must be requested once.');
      metadata=captureDisplayedMetadata();
    }else{
      if(!render())throw new Error('尚未显示可保存的原生帧。');
    }
    const nativeFrame=readNativeFrame(renderer,canvas);metadata??=diagnostics();
    const captureView=view==='sculpture'?`sculpture-${sculpture}`:view,name=`yuanmingyuan-${assetConfig.id}-${sourceTag}-${captureView}-${light}-${Date.now()}-${++saveSerial}`;
    metadata.capture={readback:nativeFrame.readback,width:nativeFrame.width,height:nativeFrame.height,renderSerial:metadata.renderSerial};
    if(displayedCapture)metadata.capture.mode='displayed-preserved-frame';
    // Freeze all evidence before encoding yields, including any nested archive
    // or asset diagnostics that later controls or frames might mutate.
    const sidecar=new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'});
    const blob=await encodeFrame(nativeFrame,controller);checkCapture(controller);
    const result=await savePair([{name:name+'.png',blob},{name:name+'.json',blob:sidecar}],controller);
    status(result.destination==='server'?`已保存 ${name}.png 与同名 JSON。`:`已发起 PNG 与 JSON 整组下载；若浏览器拦截，请使用下方两个链接。${result.partial?'服务器可能保留了部分副本。':''}`);
  }catch(error){
    const message=controller.signal.aborted?(controller.signal.reason?.name==='AbortError'?'离开页面或图形中断，已取消画面保存。':controller.signal.reason.message):error.message;
    status(message+(error.serverPartial?'服务器已保留部分文件；本次未确认成对证据。':''),true);
  }finally{uploads.delete(controller);capturing=false;sync();}
}
function dispose(){
  if(disposed)return;disposed=true;assetLoadController.abort();preparedAsset?.dispose();preparedAsset=null;frameReady=false;stopFrames();for(const c of uploads)c.abort();uploads.clear();observer?.disconnect();controls?.dispose();
  canvas.removeEventListener('webglcontextrestored',contextRestored);
  asset?.dispose();floor?.geometry.dispose();floor?.material.dispose();environment?.dispose();key?.shadow.map?.dispose();key?.shadow.mapPass?.dispose();post?.dispose();renderer?.dispose();
  originalVisibility.clear();isolatedParts=[];
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
  controls=new OrbitControls(camera,canvas);controls.enableDamping=!stillReview;controls.minDistance=.7;controls.maxDistance=400;controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>{viewMode='orbit';viewCaption();});
  sync();
}
function createAsset(){
  asset=preparedAsset||createFactory();preparedAsset=null;scene.add(asset.group);asset.group.updateMatrixWorld(true);
  asset.group.traverse(object=>originalVisibility.set(object,object.visible));
  const bounds=new THREE.Box3().setFromObject(asset.group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),extent=Math.max(size.x,size.z)*.8;
  fullAssetBounds=bounds.clone();
  floor=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({color:'#b9bbad',roughness:.98}));floor.rotation.x=-Math.PI/2;floor.position.y=assetConfig.groundY??bounds.min.y-.015;floor.receiveShadow=true;scene.add(floor);
  if(worldRendering){renderer.info.autoReset=false;post=createRendering(renderer,scene,camera,{clipBox:bounds.clone().expandByScalar(30)});post.setQuality('high');}
  hemi=new THREE.HemisphereLight('#e8f0ee','#9c9684',1.65);scene.add(hemi);
  key=new THREE.DirectionalLight('#fff0d8',3.05);key.position.set(center.x-extent*.8,center.y+extent*1.5,center.z+extent);key.target.position.copy(center);key.castShadow=true;key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:extent*5});key.shadow.normalBias=.018;key.shadow.bias=-.00005;scene.add(key,key.target);
  fill=new THREE.DirectionalLight('#dcecf7',.45);fill.position.set(center.x+extent,center.y+extent*.8,center.z-extent);scene.add(fill);
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
  $('sculpture').addEventListener('change',()=>setSculpture($('sculpture').value));
  $('lighting').addEventListener('change',()=>setLight($('lighting').value));
  $('wireframe').addEventListener('change',()=>{asset.group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=$('wireframe').checked;});frameReady=false;markShadowsDirty();sync();invalidate();});
  $('save-frame').addEventListener('click',saveFrame);observer=new ResizeObserver(resize);observer.observe(canvas);
  $('animate-water').addEventListener('click',()=>{animationPlaying=!animationPlaying;lastAnimationFrame=null;$('animate-water').setAttribute('aria-pressed',String(animationPlaying));$('animate-water').textContent=animationPlaying?'暂停水景 · Pause water':'播放水景 · Play water';invalidate();});
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
  try{
    environmentOverride=readEnvironmentOverride(query);
    if(query.has('archive')&&query.has('materials'))throw new Error('离线归档使用已保存的材质。请移除 archive 参数后审查新材质。');
    if(query.has('archive')){
      const manifest=query.get('archive')==='1'?museumArchiveCatalog[assetConfig.id]:query.get('archive');
      if(!manifest)throw new Error('此模型尚未登记通过审查的离线归档。');
      status('正在载入完整离线模型与材质…');
      const resource=await loadMuseumArchive(assetConfig.id,manifest,{signal:assetLoadController.signal});
      if(disposed){resource.dispose();return;}
      preparedAsset=resource;createFactory=()=>{throw new Error('The prepared archive has already been consumed.');};
    }else{
      const factory=await assetConfig.loadFactory({signal:assetLoadController.signal,specimen:assetConfig.id==='vegetation'?query.get('specimen'):null,materialVariant:['fangwaiguan','xieqiqu-stone-fish'].includes(assetConfig.id)?query.get('materials'):null});if(disposed)return;createFactory=factory;
    }
    prepare();
  }catch(error){if(!disposed)fail(error);}
}
function configureInterface(){
  document.title=`${assetConfig.label} · 模型研究 | ${assetConfig.english} studio`;document.body.dataset.asset=assetConfig.id;$('asset-title').textContent=assetConfig.label;
  $('model-viewport').setAttribute('aria-label',`${assetConfig.menuLabel}模型审查`);canvas.setAttribute('aria-label',`${assetConfig.menuLabel}实际三维模型；拖动旋转，滚动缩放`);
  const assetOptions=Object.values(studioAssets).map(config=>{const option=document.createElement('option');option.value=config.id;option.textContent=config.menuLabel;return option;});
  $('studio-asset').replaceChildren(...assetOptions);$('studio-asset').value=assetConfig.id;
  $('studio-asset').addEventListener('change',()=>{
    const next=getStudioAsset($('studio-asset').value);if(disposed||next.id===assetConfig.id)return;
    const destination=new URL(studioAssetUrl(location.href,next.id));destination.searchParams.set('light',light);
    dispose();location.assign(destination.href);
  });
  $('view-buttons').replaceChildren(...Object.entries(assetConfig.views).filter(([id])=>assetConfig.id!=='vegetation'||query.get('specimen')!=='lake-rock'||id==='overview'||id.startsWith('rock-')).map(([id,spec])=>{const button=document.createElement('button');button.type='button';button.dataset.view=id;button.textContent=spec.label.split(' · ')[0];button.title=spec.label;button.setAttribute('aria-label',spec.label);button.setAttribute('aria-pressed','false');return button;}));
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=assetConfig.sculpturePlaceholder;
  $('sculpture').replaceChildren(placeholder,...Object.entries(assetConfig.sculptures).map(([id,spec])=>{const option=document.createElement('option');option.value=id;option.textContent=spec.label;return option;}));
  sync();
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
configureInterface();
await start();
