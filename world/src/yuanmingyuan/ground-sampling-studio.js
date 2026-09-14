import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EnvironmentClock} from '../environment-time.js';
import {loadGardenGroundTextures,applyGardenGroundTextures} from './ground-textures.js';
import {readNativeFrame,encodeNativeFrame} from './native-frame-capture.js';

export const groundSamplingReference=Object.freeze({
  sourceTag:'47647a284d0aa5ef',capture:'museum-world-47647a284d0aa5ef-xianfashan-1789180161464-5',
  jsonSHA256:'555c13e8659d676130a0dd1442c69e878dd50fa5c116a44d82762e08def51e6c',
  camera:Object.freeze([873.0715731075196,9.039999991655343,-638.0238577025059]),
  target:Object.freeze([885.0715731075196,5.039999991655346,-642.0238577025059]),
  canvas:Object.freeze([3200,2200]),crop:Object.freeze([70,1610,800,520]),fov:45,near:.08,far:22000,phase:.46,
  planeY:4,planeSize:64,uvScale:.08,repeat:5/6,tileMetres:15,cellMetres:60,
});
const slots=['map','normalMap','roughnessMap'];
const shaderSlots=[['map','vMapUv'],['normalMap','vNormalMapUv'],['roughnessMap','vRoughnessMapUv']];

export function groundSamplingOrigin(centre=groundSamplingReference.target){
  const cells=[Math.floor(centre[0]/60),Math.floor(centre[2]/60)];return {cells,world:[cells[0]*60,cells[1]*60]};
}
// The interior dry-ground colour expression is transcribed from garden-terrain
// for this flat fixture only. No coastline/shore classification is invented.
export function groundSamplingTint(x,z,target=new THREE.Color()){
  const wave=Math.sin(x*.029+Math.sin(z*.018)*1.9)*.46+Math.cos(z*.024-x*.011)*.30+Math.sin(x*.091+z*.072)*.12;
  const chroma=THREE.MathUtils.clamp(.5+wave*.45,0,1);
  return target.set('#809b77').lerp(new THREE.Color('#608b7c'),chroma*.43).lerp(new THREE.Color('#a5ae84'),THREE.MathUtils.clamp(.30+Math.sin(x*.008-z*.015)*.25,0,1));
}
export function createGroundSamplingPlane(){
  const ref=groundSamplingReference,cx=ref.target[0],cz=ref.target[2],r=ref.planeSize/2,points=[[cx-r,ref.planeY,cz-r],[cx+r,ref.planeY,cz-r],[cx+r,ref.planeY,cz+r],[cx-r,ref.planeY,cz+r]];
  const geometry=new THREE.BufferGeometry(),colors=[],color=new THREE.Color();
  for(const [x,,z] of points)colors.push(...groundSamplingTint(x,z,color).toArray());
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0,0,1,0],3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(8),2));geometry.setIndex([0,2,1,0,3,2]);
  geometry.userData.sourceWorldPoints=points;setGroundSamplingUV(geometry,'world');geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function setGroundSamplingUV(geometry,mode){
  if(!['world','local'].includes(mode)||geometry.userData.sourceWorldPoints?.length!==4)throw new Error('Expected the single review plane and world/local UV mode');
  const origin=groundSamplingOrigin(),offset=mode==='local'?origin.world:[0,0];
  for(const [i,[x,,z]] of geometry.userData.sourceWorldPoints.entries())geometry.attributes.uv.setXY(i,(x-offset[0])*.08,(z-offset[1])*.08);
  geometry.attributes.uv.needsUpdate=true;geometry.userData.samplingUV={mode,originWorld:offset,cellOrigin:mode==='local'?origin.cells:[0,0]};return geometry.userData.samplingUV;
}
export function configureGroundSampling(material,maps,{sampling='main',uv='world',normal=true}={}){
  if(!['main','caller-gradients','implicit-blend','stock-grad','stock-lookup','stock-material'].includes(sampling)||!['world','local'].includes(uv))throw new Error('Unknown sampling control');
  // Retain the R1 stock-lookup shader byte-for-byte (including its unused
  // gardenSample definition); the three new modes use the actual opt-in API.
  applyGardenGroundTextures(material,maps,{sampling:['caller-gradients','implicit-blend','stock-grad'].includes(sampling)?sampling:'main'});material.normalScale.setScalar(normal?.42:0);
  for(const slot of slots)maps[slot].repeat.setScalar(5/6);
  if(sampling==='stock-material'){
    material.onBeforeCompile=THREE.Material.prototype.onBeforeCompile;material.customProgramCacheKey=()=>`ground-review-stock-material-${uv}`;
  }else{
    const originalCompile=material.onBeforeCompile;
    material.onBeforeCompile=shader=>{
      originalCompile(shader);
      if(sampling==='stock-lookup')for(const [slot,varying] of shaderSlots){
        const call=`gardenSample( ${slot}, ${varying} )`;if(!shader.fragmentShader.includes(call))throw new Error(`Original ground shader no longer exposes ${call}`);
        // These are the real Three ShaderChunk texture calls. Keep the original
        // albedo/roughness remapping so only the sampling expression changes.
        shader.fragmentShader=shader.fragmentShader.replaceAll(call,`texture2D( ${slot}, ${varying} )`);
      }
      if(uv==='local'&&['main','caller-gradients','implicit-blend'].includes(sampling)){
        shader.uniforms.gardenCellOrigin={value:new THREE.Vector2(...groundSamplingOrigin().cells)};
        shader.fragmentShader='uniform vec2 gardenCellOrigin;\n'+shader.fragmentShader;
        for(const corner of ['a','b','c']){
          const call=`gardenOffset(${corner})`;if(!shader.fragmentShader.includes(call))throw new Error('Original ground cell hash changed; local phase preservation needs review');
          shader.fragmentShader=shader.fragmentShader.replaceAll(call,`gardenOffset(${corner}+gardenCellOrigin)`);
        }
      }
    };
    material.customProgramCacheKey=()=>`ground-review-${sampling}-${uv}-same-main-remapping`;
  }
  material.userData.groundSampling={sampling,uv,normal,lookup:'stock-material'===sampling?'complete-stock-material':sampling,remapPreserved:sampling!=='stock-material',offsetsAndWeightsPreserved:['main','caller-gradients','implicit-blend'].includes(sampling),implicitCellBoundaryRisk:sampling==='implicit-blend',cellOrigin:uv==='local'?groundSamplingOrigin().cells:[0,0]};material.needsUpdate=true;
}
export function groundSamplingCropCentre(){
  const ref=groundSamplingReference,camera=new THREE.PerspectiveCamera(ref.fov,ref.canvas[0]/ref.canvas[1],ref.near,ref.far);camera.position.fromArray(ref.camera);camera.lookAt(new THREE.Vector3(...ref.target));camera.updateMatrixWorld(true);
  const [x,y,w,h]=ref.crop,ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x+w/2)/ref.canvas[0]*2-1,1-(y+h/2)/ref.canvas[1]*2),camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-ref.planeY),new THREE.Vector3());
}
export function groundSamplingLightState(mode='day'){
  const clock=new EnvironmentClock(mode),sample=clock.update(0,{paused:true}),focus=new THREE.Vector3(...groundSamplingReference.target);
  return {mode,phase:clock.phase,lightingVariant:clock.lightingReviewVariant,exposure:1.05,
    key:{color:sample.key.toArray(),intensity:sample.keyIntensity,position:focus.clone().addScaledVector(sample.lightDirection,400).toArray(),target:focus.toArray()},
    hemisphere:{sky:sample.sky.toArray(),ground:sample.ground.toArray(),intensity:sample.ambientIntensity*.56},
    // garden-environment positions its bounce relative to focus, but retains
    // DirectionalLight's default target at the world origin. Preserve it here.
    bounce:{color:sample.fill.toArray(),intensity:sample.fillIntensity*.5,position:focus.clone().add(new THREE.Vector3(-200,130,200)).toArray(),target:[0,0,0]},background:sample.horizon.toArray(),
    omitted:['HDR environment','sky mesh','occluder shadows','GTAO','bloom']};
}

export async function saveGroundSamplingFrame({renderer,canvas,draw,metadata,upload,signal,encode=encodeNativeFrame,read=readNativeFrame,now=Date.now}){
  signal?.throwIfAborted();if(!draw())throw new Error('A fresh ground frame is unavailable');
  const frame=read(renderer,canvas),record=metadata();record.capture={readback:frame.readback,width:frame.width,height:frame.height};
  const prefix=`yuanmingyuan-ground-sampling-${record.sourceIdentity.digest.slice(0,16)}-${record.sampling}-${record.resolution}-${record.uv}-${record.view}-${now()}-${record.sequence}`;
  // Nested camera/material/evidence objects may still belong to the page.
  // Capture their JSON bytes now, before PNG encoding yields to other events.
  const serialized=JSON.stringify(record,null,2),json=new Blob([serialized],{type:'application/json'});
  const png=await encode(frame);signal?.throwIfAborted();const saved=[];
  try{for(const [name,body] of [[prefix+'.png',png],[prefix+'.json',json]]){signal?.throwIfAborted();await upload(name,body,signal);saved.push(name);}}catch(error){error.retainedFiles=saved;throw error;}
  return {files:saved,png,json,metadata:JSON.parse(serialized)};
}

async function sourceIdentity(){
  // Vite intentionally excludes the importing file from import.meta.glob.
  // Explicit raw self-import keeps the page implementation in its identity.
  const modules={...import.meta.glob(['../../ground-sampling-studio.html','./ground-textures.js','./ground-material-4k.js','../asset-manifest.js','../environment-time.js','../time-contract.js','./native-frame-capture.js'],{query:'?raw',import:'default'}),
    './ground-sampling-studio.js':()=>import('./ground-sampling-studio.js?raw').then(module=>module.default)},files=[];
  const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  for(const [path,load] of Object.entries(modules).sort(([a],[b])=>a<b?-1:a>b?1:0))files.push({path,sha256:await hash(new TextEncoder().encode(await load()))});
  return {digest:await hash(new TextEncoder().encode(JSON.stringify(files))),files};
}
export async function startGroundSamplingStudio(){
  const $=id=>document.getElementById(id),canvas=$('ground-canvas'),controller=new AbortController(),errors=[],listeners=[],downloadURLs=[];
  const controlsIds=['ground-resolution','ground-sampling','ground-uv','ground-normal','ground-view','ground-light','ground-retry','ground-save'];
  const scene=new THREE.Scene(),ref=groundSamplingReference,camera=new THREE.PerspectiveCamera(ref.fov,1,ref.near,ref.far),geometry=createGroundSamplingPlane(),material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.98}),plane=new THREE.Mesh(geometry,material);
  plane.name='Single ground sampling plane';plane.visible=false;scene.add(plane);
  let renderer=null,controls=null,observer=null,maps=null,identity=null,disposed=false,loading=true,capturing=false,pendingResize=false,raf=0,sequence=0,renderSerial=0,lighting=null,activeView='main';
  const key=new THREE.DirectionalLight(),hemi=new THREE.HemisphereLight(),bounce=new THREE.DirectionalLight();scene.add(key,key.target,hemi,bounce,bounce.target);
  const status=text=>{$('ground-status').textContent=text;};
  const note=(error,kind='runtime')=>{errors.push({kind,message:error?.message??String(error)});};
  const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
  function enable(){for(const id of controlsIds)$(id).disabled=disposed||loading||capturing||(!maps&&!['ground-resolution','ground-retry'].includes(id));$('ground-dispose').disabled=disposed;if(controls)controls.enabled=!disposed&&!loading&&!capturing;}
  function programEvidence(){
    if(!renderer||disposed)return null;const gl=renderer.getContext(),precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
    const currentProgram=gl.getParameter(gl.CURRENT_PROGRAM);
    return {requested:renderer.capabilities.precision,fragmentHighFloat:precision?{precision:precision.precision,rangeMin:precision.rangeMin,rangeMax:precision.rangeMax}:null,
      currentProgramId:renderer.info.programs.find(program=>program.program===currentProgram)?.id??null,
      programs:renderer.info.programs.map(program=>({id:program.id,current:program.program===currentProgram,linked:!!gl.getProgramParameter(program.program,gl.LINK_STATUS),log:gl.getProgramInfoLog(program.program),vertexShader:gl.getShaderSource(program.vertexShader),fragmentShader:gl.getShaderSource(program.fragmentShader)}))};
  }
  function metadata({programs=false}={}){return {asset:'ground-sampling-isolation',nativeAdmissionAllowed:false,status:disposed?'disposed':loading?'loading':errors.length?'review-has-errors':'unreviewed',createdAt:new Date().toISOString(),sourceIdentity:identity,reference:ref,
    sequence,renderSerial,resolution:maps?.resolution??null,source:maps?.source??null,files:maps?.files??null,sampling:$('ground-sampling').value,uv:$('ground-uv').value,normal:$('ground-normal').checked,view:activeView,lighting,
    camera:{position:camera.position.toArray(),target:controls?.target.toArray(),up:camera.up.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect,projection:camera.projectionMatrix.toArray()},
    canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,dpr:renderer?.getPixelRatio(),matchesReference:canvas.width===ref.canvas[0]&&canvas.height===ref.canvas[1]},
    geometry:{meshes:1,triangles:2,height:ref.planeY,size:ref.planeSize,positions:Array.from(geometry.attributes.position.array),uv:Array.from(geometry.attributes.uv.array),mapping:geometry.userData.samplingUV,vertexColor:'same dry interior expression, sampled at the four plane corners; no shore or terrain shape'},
    material:{type:material.type,color:material.color.toArray(),vertexColors:material.vertexColors,roughness:material.roughness,metalness:material.metalness,normalScale:material.normalScale.toArray(),repeat:maps?.map.repeat.toArray(),colorSpace:maps?.map.colorSpace,normalColorSpace:maps?.normalMap.colorSpace,roughnessColorSpace:maps?.roughnessMap.colorSpace,sampling:material.userData.groundSampling},
    renderer:renderer?{threeRevision:THREE.REVISION,pipeline:'direct WebGL MeshStandard / ACES / sRGB; no postprocessing',exposure:renderer.toneMappingExposure,shadowMapEnabled:renderer.shadowMap.enabled,maxAnisotropy:renderer.capabilities.getMaxAnisotropy(),render:{...renderer.info.render},memory:{...renderer.info.memory},...(programs?{compiled:programEvidence()}:{} )}:null,
    ownership:{singlePlane:true,terrainTextureOwners:maps?1:0,terrainTextures:maps?3:0,resolutionSwitch:'release prior owner before acquiring next; empty plane remains hidden during loading'},errors:[...errors]};}
  function draw(){if(disposed||loading||!maps||document.hidden)return false;renderer.info.reset();renderer.render(scene,camera);renderSerial++;$('ground-metrics').textContent=`${canvas.width} × ${canvas.height} · ${renderer.info.render.triangles} triangles · ${renderer.info.memory.textures} GPU textures`;$('ground-readout').textContent=JSON.stringify(metadata(),null,2);return true;}
  function invalidate(){if(disposed||loading||capturing||raf||document.hidden)return;raf=requestAnimationFrame(()=>{raf=0;try{draw();}catch(error){note(error);status(error.message);}});}
  function configure(){if(!maps)return;setGroundSamplingUV(geometry,$('ground-uv').value);configureGroundSampling(material,maps,{sampling:$('ground-sampling').value,uv:$('ground-uv').value,normal:$('ground-normal').checked});invalidate();}
  function setView(){
    activeView=$('ground-view').value;camera.up.set(0,1,0);
    if(activeView==='main'){camera.position.fromArray(ref.camera);controls.target.fromArray(ref.target);}
    else{const centre=groundSamplingCropCentre();controls.target.copy(centre);if(activeView==='top')camera.position.copy(centre).add(new THREE.Vector3(0,18,.001));else camera.position.copy(centre).add(new THREE.Vector3(-4,2,1.4));}
    camera.lookAt(controls.target);camera.updateMatrixWorld(true);controls.update();invalidate();
  }
  function setLight(){lighting=groundSamplingLightState($('ground-light').value);key.color.fromArray(lighting.key.color);key.intensity=lighting.key.intensity;key.position.fromArray(lighting.key.position);key.target.position.fromArray(lighting.key.target);
    hemi.color.fromArray(lighting.hemisphere.sky);hemi.groundColor.fromArray(lighting.hemisphere.ground);hemi.intensity=lighting.hemisphere.intensity;bounce.color.fromArray(lighting.bounce.color);bounce.intensity=lighting.bounce.intensity;bounce.position.fromArray(lighting.bounce.position);bounce.target.position.fromArray(lighting.bounce.target);scene.background=new THREE.Color().fromArray(lighting.background);renderer.toneMappingExposure=lighting.exposure;invalidate();}
  function resize(){if(!renderer||disposed)return;if(capturing){pendingResize=true;return;}const width=canvas.clientWidth,height=canvas.clientHeight,dpr=devicePixelRatio||1;
    if(!width||!height||Math.max(width*dpr,height*dpr)>renderer.capabilities.maxTextureSize)throw new Error('Native canvas dimensions exceed this renderer; resize the window');
    renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();invalidate();}
  function clearMaps(){plane.visible=false;for(const slot of slots)material[slot]=null;material.needsUpdate=true;const previous=maps;maps=null;previous?.dispose();}
  async function loadResolution(){
    if(disposed||capturing||loading)return;loading=true;enable();status('顺序载入三张纹理；机位与光照保留。');
    try{clearMaps();const next=await loadGardenGroundTextures({resolution:$('ground-resolution').value,signal:controller.signal});if(disposed){next.dispose();return;}maps=next;configure();plane.visible=true;document.body.dataset.ready='true';status('可切换采样、法线与UV，保存原生对照。尚未完成GPU验收。');}
    catch(error){try{clearMaps();}catch(cleanup){note(cleanup,'cleanup');}if(!disposed){note(error,'load');document.body.dataset.ready='failed';status(`载入失败，可重试：${error.message}`);}}
    finally{loading=false;enable();if(!disposed)invalidate();}
  }
  async function save(){
    if(disposed||loading||capturing||!maps)return;capturing=true;sequence++;enable();if(raf){cancelAnimationFrame(raf);raf=0;}
    try{
      const result=await saveGroundSamplingFrame({renderer,canvas,draw,metadata:()=>metadata({programs:true}),signal:controller.signal,upload:async(name,body,signal)=>{const response=await fetch('/__review_capture/'+name,{method:'POST',body,signal});if(!response.ok)throw new Error(`Capture HTTP ${response.status}: ${await response.text()}`);}});
      if(disposed)return;downloadURLs.splice(0).forEach(URL.revokeObjectURL);$('ground-results').replaceChildren();
      for(const [i,blob] of [result.png,result.json].entries()){const url=URL.createObjectURL(blob),link=document.createElement('a');downloadURLs.push(url);link.href=url;link.download=result.files[i];link.textContent=result.files[i];$('ground-results').append(link);}status('已保存同帧原生 PNG + JSON；包含实际链接的 GLSL。');
    }catch(error){if(!disposed){note(error,'capture');status(`保存失败：${error.message}${error.retainedFiles?.length?'；已保存文件保留。':''}`);}}
    finally{capturing=false;enable();if(pendingResize&&!disposed){pendingResize=false;resize();}}
  }
  function dispose(){
    if(disposed)return;disposed=true;controller.abort();if(raf)cancelAnimationFrame(raf);raf=0;
    for(const release of [()=>observer?.disconnect(),()=>controls?.dispose(),clearMaps,()=>geometry.dispose(),()=>material.dispose(),()=>scene.clear(),()=>renderer?.dispose(),()=>renderer?.forceContextLoss(),()=>downloadURLs.splice(0).forEach(URL.revokeObjectURL),()=>listeners.splice(0).forEach(remove=>remove())])try{release();}catch(error){note(error,'cleanup');}
    document.body.dataset.ready='disposed';enable();status('平面、材质、纹理与WebGL资源已释放。');$('ground-readout').textContent=JSON.stringify(metadata(),null,2);
  }
  listen(window,'pagehide',dispose,{once:true});
  // This small global handler must survive pagehide cleanup for BFCache return.
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  listen(window,'error',event=>note(event.error??event.message));listen(window,'unhandledrejection',event=>note(event.reason));
  listen($('ground-dispose'),'click',dispose);listen($('ground-resolution'),'change',loadResolution);listen($('ground-retry'),'click',loadResolution);listen($('ground-save'),'click',save);
  for(const id of ['ground-sampling','ground-uv','ground-normal'])listen($(id),'change',configure);listen($('ground-view'),'change',setView);listen($('ground-light'),'change',setLight);
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();note(new Error('WebGL context lost'),'context');dispose();});
  listen(document,'visibilitychange',()=>{if(!document.hidden)invalidate();});
  try{
    identity=await sourceIdentity();controller.signal.throwIfAborted();renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=false;
    renderer.debug.onShaderError=(gl,program,vertexShader,fragmentShader)=>{note(new Error([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertexShader),gl.getShaderInfoLog(fragmentShader)].filter(Boolean).join('\n')),'shader');};
    controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=.5;controls.maxDistance=100;listen(controls,'change',invalidate);observer=new ResizeObserver(()=>{try{resize();}catch(error){note(error,'resize');status(error.message);}});observer.observe(canvas);
    resize();setView();setLight();loading=false;await loadResolution();
  }catch(error){if(!disposed){note(error,'initialization');dispose();document.body.dataset.ready='failed';status(`初始化失败：${error.message}`);}}
  return {dispose};
}
if(typeof document!=='undefined'&&document.getElementById('ground-canvas'))startGroundSamplingStudio();
