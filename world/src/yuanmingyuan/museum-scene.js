import '../published-three-assets.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMuseumLandscape,configureMuseumLandscapeAsset} from './museum-landscape.js';
import {createGardenTerrain} from './garden-terrain.js';
import {createExhibitionCoast} from './exhibition-coast.js';
import {createGardenWater} from './garden-water.js';
import {createGardenEnvironment} from './garden-environment.js';
import {createArchitectureSurface} from './architecture-surface.js';
import {createArchitectureEnsemble} from './architecture-ensemble.js';
import {createMuseumNavigation,museumTravelHeading,museumVisitorCollider} from './visitor-motion.js';
import {stepMuseumFlightAroundPlants} from './planting-flight.js';
import {createMuseumVisitor} from './visitor-asset.js';
import {createMuseumGuidePool} from './guide-pool.js';
import {createMuseumGuides} from './museum-guides.js';
import {createMuseumGuideEnsemble} from './museum-guide-ensemble.js';
import {createMuseumGuideWorld} from './museum-guide-world.js';
import {selectMuseumGuidePlacements} from './museum-guide-placement.js';
import {createMuseumSiteController} from './site-controller.js';
import {museumSites,museumSite,sitePoint,museumCourts} from './museum-sites.js';
import {loadMuseumModel,loadMuseumArchive} from './asset-source.js';
import {createMuseumStaticBatch,placeMuseumStaticAsset} from './museum-static-batch.js';
import {createMuseumMultiDrawBatch} from './museum-multidraw-batch.js';
import {attachMuseumMultiDrawCulling} from './museum-multidraw-culling.js';
import {createMuseumResidentBuildings} from './museum-resident-buildings.js';
import {createMuseumTerrainAssets} from './museum-terrain-assets.js';
import {museumResidentCatalog} from './museum-resident-catalog.js';
import {prepareMuseumGroundSources} from './museum-prepared-sources.js';
import {museumEntry,museumRegions} from './museum-content.js';
import {MuseumReader,mountMuseumDirectory} from './museum-reader.js';
import {updateCharacter,resetCharacterMotion,CHARACTER_GROUND_MOTION as MOTION} from '../characters.js';
import {createRendering} from '../rendering.js';
import {advanceMuseumTime} from './museum-timing.js';
import {createMuseumTouchControls} from './touch-controls.js';
import {createMuseumAudio} from './museum-audio.js';
import {loadGardenGroundTextures,applyGardenGroundTextures} from './ground-textures.js';
import {readNativeFrame,encodeNativeFrame} from './native-frame-capture.js';
import {createMoundGroundMaterialBinding} from './mound-ground-material-binding.js';
import {createMuseumPausedRedraw} from './museum-paused-redraw.js';
import {setWillowSampling,willowSamplingProgramAudit} from './willow-distance-sampling.js';
import {createXianfaqiaoComposition,xianfaqiaoRouteLanding} from './xianfaqiao-composition.js';
import {createJiuzhouComposition,jiuzhouViewLanding} from './jiuzhou-composition.js';
import {createXianfaqiaoGardenPlantingLayout} from './xianfaqiao-garden-planting.js';
import {extendFuhaiNortheastBankContext,fuhaiNortheastBankContextRegionId} from './fuhai-ne-bank-context-r1.js';
import {gardenReviewCameraSightline} from './garden-review-camera.js';
import {createWesternGardenScenePlanting} from './western-garden-scene.js';
import {createJiuzhouShoreGrove} from './jiuzhou-shore-grove.js';
import {createXieqiquCourtGardenOwner} from './xieqiqu-court-garden-owner.js';
import {createXieqiquCourtGardenR2Layout} from './xieqiqu-court-garden-r2-layout.js';
import {createXieqiquCourtGardenR3Study} from './xieqiqu-court-garden-r3-study.js';
import {createXieqiquCourtGardenR4Study} from './xieqiqu-court-garden-r4-study.js';

const $=id=>document.getElementById(id),canvas=$('museum-canvas'),query=new URLSearchParams(location.search),controller=new AbortController();
let {layout:gardenLayout,pads:terrainPads,courts:terrainCourts=[],paths:terrainPaths=[],replacements:terrainReplacements=[]}=createMuseumLandscape();
const sourceTag=(query.get('source')||'integration-study').replace(/[^a-z0-9-]/gi,'').slice(0,64);
const copy={
  zh:{map:'园图',mapTitle:'圆明三园',mapIntro:'选择景点传送。园图采用比例研究布局；海岛为本站的展示设计。',directory:'展览目录',close:'关闭',light:'光照',camera:'跟随视角',bird:'鸟瞰视角',low:'低角度视角',land:'降落 · B',fly:'召唤扫把 · B',read:'阅读展签',help:'操作说明',study:'建模研究预览 · 尚未公开',readInstead:'先阅读历史展签',historyNote:'海岛和导游角色是当代展示设计。历史圆明园位于北京，图档中的推定会在展签中说明。',controls:'WASD 移动 · Shift 加速 · 空格 / C 升降 · B 起降 · 拖动视角',helpText:'WASD / 方向键：移动，Shift：加速或跑步。\n飞行时按空格上升、C 下降，B 在安全地面降落或召唤扫把。\n拖动旋转视角、滚轮缩放，V 切换跟随 / 鸟瞰 / 低角度。\n按 E 阅读当前展签；靠近导游时可与导游互动。展览目录也可直接阅读。\n按 M 打开园图，可直接传送至景点。',loading:'正在准备园林…',terrain:'正在构建湖岸、桥梁与园墙…',visitor:'正在载入人物与导游…',building:'正在载入建筑细部…',failed:'载入未完成，可先阅读历史展签。',unsafe:'这里没有足够平整的安全落脚点，请移到庭院或道路。',ready:'按 E 阅读当前展签，或打开园图前往景点。',guide:'导游正在举牌…',auto:'时间流逝',day:'白天',dawn:'晨光',dusk:'暮色',night:'月夜'},
  en:{map:'Map',mapTitle:'The three gardens',mapIntro:'Choose a site to travel. This is a proportional study; the offshore setting is an exhibition device.',directory:'Exhibits',close:'Close',light:'Light',camera:'Follow view',bird:'Bird’s-eye view',low:'Low-angle view',land:'Land · B',fly:'Summon broom · B',read:'Read exhibit',help:'Controls',study:'Reconstruction study · Not published',readInstead:'Read the historical exhibits',historyNote:'The offshore island and guides are contemporary exhibition devices. Historical Yuanmingyuan stood in Beijing. Inferences are identified in the exhibit notes.',controls:'WASD move · Shift faster · Space / C ascend / descend · B land / fly · Drag to look',helpText:'WASD / arrow keys: move. Shift: boost or run.\nIn flight, Space ascends and C descends. B lands on safe ground or summons the broom.\nDrag to look, scroll to zoom; V changes follow / bird’s-eye / low-angle view.\nPress E to read the current exhibit; near a guide, E starts its interaction. The directory also opens exhibits directly.\nM opens the map for immediate travel.',loading:'Preparing the gardens…',terrain:'Building lake shores, bridges and garden walls…',visitor:'Loading the visitor and guides…',building:'Loading architectural details…',failed:'Loading did not finish. The historical exhibits remain available.',unsafe:'There is no safe, level landing here. Move toward a court or path.',ready:'Press E to read this exhibit, or choose a site on the map.',guide:'The guide is raising its sign…',auto:'Time passes',day:'Day',dawn:'Dawn',dusk:'Dusk',night:'Moonlight'},
};
if(query.get('composition')==='xianfaqiao'){
  Object.assign(copy.zh,{mapTitle:'谐奇趣与线法桥',study:'谐奇趣—线法桥 · 其余园区制作中',mapIntro:'当前可游览谐奇趣与线法桥，选择景点即可传送。其余园区仍在制作；展览目录可先阅读三园历史。海岛为当代展示设计。'});
  Object.assign(copy.en,{mapTitle:'Xieqiqu & Xianfaqiao',study:'Xieqiqu–Xianfaqiao · Other areas in progress',mapIntro:'Explore Xieqiqu and Xianfaqiao; choose a site to travel. Other areas are still in production. The exhibit directory covers the history of all three gardens. The offshore setting is a contemporary exhibition design.'});
  if(query.get('yangquelong')==='refined-r1'){
    Object.assign(copy.zh,{mapTitle:'谐奇趣、线法桥与养雀笼',study:'西洋楼三站游线 · 当代庭园演绎',mapIntro:'选择谐奇趣、线法桥或养雀笼即可传送。养雀笼植栽、种植土与铺地属于当代馆景演绎；历史依据见展签。其余园区可进入三园研究总览。'});
    Object.assign(copy.en,{mapTitle:'Xieqiqu, Xianfaqiao & Yangquelong',study:'Three-site Western Buildings route · Contemporary garden design',mapIntro:'Travel to Xieqiqu, Xianfaqiao or Yangquelong. Yangquelong planting, soil and paving are contemporary museum-garden design; the exhibits explain historical evidence. Other areas remain available in the three-garden study overview.'});
  }
}
if(query.get('composition')==='jiuzhou'){
  Object.assign(copy.zh,{mapTitle:'九州清晏：三路院落与水岸',study:'完整原建筑组合 · 比例研究布局',mapIntro:'四个查看点共用一座完整建筑组合。可飞往庭院并在安全入口落地；原如意桥南侧仍隔水约12.47米，不能步行到外大陆。展签说明历史依据与待考部分。'});
  Object.assign(copy.en,{mapTitle:'Jiuzhou Qingyan: courts and waterfront',study:'One complete architectural assembly · Proportional study',mapIntro:'Four views share one complete assembly. Fly to a court or land at its safe entry. About 12.47 m of open water still separates the original Ruyi south landing from the mainland. Exhibits identify historical evidence and unresolved parts.'});
  copy.zh.mapIntro+=' 外围岸林为当代展园设计。';copy.en.mapIntro+=' The peripheral shore groves are contemporary exhibition planting.';
}
let lang=query.get('lang')==='en'?'en':'zh',disposed=false,ready=false,loading=false,capturing=false,contextLost=false,reviewPaused=query.get('review')==='still';
copy.zh.boost='加速';copy.en.boost='Faster';
copy.zh.reloadScene='重新载入场景';copy.en.reloadScene='Reload scene';
copy.zh.graphicsLost='场景显示已中断。请重新载入场景；历史展签仍可单独阅读。';copy.en.graphicsLost='The scene display was interrupted. Reload the scene, or continue reading the historical exhibits.';
copy.zh.soundOn='声音：开';copy.zh.soundOff='声音：关';copy.en.soundOn='Sound on';copy.en.soundOff='Sound off';
let renderer=null,rendering=null,controls=null,terrain=null,terrainAssets=null,groundTextures=null,water=null,environment=null,visitor=null,pool=null,guides=null,guideSurface=null,architecture=null,sites=null,nav=null,currentSite=null,residents=null;
let residentArchitecture=null,preparedGroundSources=null,plantingPilot=null,plantingCollisions=null,plantingReview=null,shoreCommunity=null,shoreUnderstory=null,shoreBank=null,sceneFailure=null,composition=null,westernPlanting=null,westernPlantingLifetime=null;
let shoreGrove=null,shoreGroveLifetime=null,shoreGroveTask=null,shoreGroveCleanup=Promise.resolve(),shoreGroveStatus='inactive',shoreGroveError=null;
const residentBindings=new Map(),borrowedOwners=new WeakSet();
let raf=0,last=0,time=0,lastTelemetry=0,lastProximity=0,serial=0,messageUntil=0,cameraMode=0;
const frameSamples=[];
let frameTiming=null,reviewFramesRemaining=0;
let groundReview='dry-scale15';
let cullingMode=query.get('cull')==='1'?(query.get('viewcache')==='8'?'8':'3'):'stock';
let reviewMotion=null,reviewMotionResult=null;
$('review-tools').hidden=!query.has('review');
function timingSummary(){
  if(!frameSamples.length)return null;
  const summary={frames:frameSamples.length,measurement:'CPU submission time; not GPU time'},keys=['intervalMs','navigationMs','poseMs','guidesMs','renderCpuMs','cpuMs'];
  for(const key of keys){const values=frameSamples.map(frame=>frame[key]||0).sort((a,b)=>a-b);summary[key]={mean:values.reduce((a,b)=>a+b,0)/values.length,p95:values[Math.min(values.length-1,Math.floor(values.length*.95))],max:values.at(-1)};}
  summary.observedFPS=summary.intervalMs.mean>0?1000/summary.intervalMs.mean:null;
  summary.cappedFrames=frameSamples.filter(frame=>frame.intervalMs>500).length;
  return summary;
}
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.08,22000),keys=new Set(),forward=new THREE.Vector3(),right=new THREE.Vector3();
const audio=createMuseumAudio();
const state={mode:'flying',position:{x:770,y:22,z:-595},heading:0,gaitPhase:0,speed:0,support:null,transition:null};
const dialogs=['map-dialog','directory-dialog','help-dialog'];
const paused=()=>disposed||contextLost||document.hidden||!ready||loading||capturing||reviewPaused||reader.isOpen||dialogs.some(id=>$(id).open);
const redraw=createMuseumPausedRedraw({
  deferUntilFlush:query.get('review')==='still'&&query.get('nativeFirstFrame')==='capture',
  render:dt=>{const drawn=render(dt);if(drawn&&query.has('review'))$('telemetry').textContent=JSON.stringify(evidence(),null,2);return drawn;},
  isPaused:paused,canRender:()=>ready&&!loading&&!disposed&&!contextLost&&!document.hidden,
});
const touch=createMuseumTouchControls({pad:$('touch-pad'),knob:$('touch-knob'),buttons:[...document.querySelectorAll('[data-action]')],isActive:()=>!paused(),signal:controller.signal});
if(query.get('controls')==='touch')document.body.dataset.touch='true';
const reader=new MuseumReader({lang,onOpen:()=>{keys.clear();touch.clear();guides?.setPaused(true);audio.play('page');redraw.request();},onClose:()=>{guides?.setPaused(false);start();},onLanguage:next=>setLanguage(next)});
const directory=mountMuseumDirectory($('directory'),{lang,onEntry:(id,button)=>reader.open(id,{trigger:button})});
function message(text,duration=4){$('message').textContent=text;messageUntil=performance.now()+duration*1000;}
async function prepareMuseumRendering(resource,id,signal){
  if(query.get('batch')==='2'){
    const result=await createMuseumMultiDrawBatch(resource,{id,renderer,signal});
    const release=result.dispose;result.dispose=()=>{try{result.culling?.dispose();}finally{release();}};
    if(cullingMode!=='stock'&&result.diagnostics.multiDrawBatch?.applied){
      try{result.culling=await attachMuseumMultiDrawCulling(result.group,{signal,viewCacheSize:Number(cullingMode)});}
      catch(error){result.dispose();throw error;}
    }
    return result;
  }
  return query.get('batch')==='1'?createMuseumStaticBatch(resource,{id,signal}):resource;
}
async function loadSceneBuilding(id,{signal,manifestURL,expectedManifestSHA256,beforeDispose}={}){
  if(id==='yangquelong'&&query.get('composition')==='xianfaqiao'&&query.get('yangquelong')==='refined-r1'){
    const {prepareYangquelongMuseumGarden}=await import('./yangquelong-museum-garden.js');signal?.throwIfAborted();
    return prepareYangquelongMuseumGarden({signal,beforeDispose});
  }
  if(id==='xieqiqu'&&query.has('court')){
    const variant=query.get('court');
    if(!['garden-r1','garden-r2','garden-r3','garden-r4'].includes(variant)||query.get('composition')!=='xianfaqiao'||(variant!=='garden-r4'&&!query.has('review')))throw new Error('The court garden requires the explicit Xieqiqu composition; R1, R2 and R3 also require review.');
    const options={signal,loadBase:options=>loadMuseumModel(id,options),
      onProgress:({stage})=>busy(true,lang==='zh'?(stage==='original-building'?'正在载入谐奇趣完整建筑…':'正在构建北院花园…'):(stage==='original-building'?'Loading the complete Xieqiqu building…':'Building the north court gardens…')),
    };
    if(variant==='garden-r4')return createXieqiquCourtGardenR4Study(options);
    if(variant==='garden-r3')return createXieqiquCourtGardenR3Study(options);
    return createXieqiquCourtGardenOwner({...options,layout:variant==='garden-r2'?createXieqiquCourtGardenR2Layout():undefined});
  }
  if(id==='fangwaiguan'&&query.has('review')&&query.has('materials')){
    const {getStudioAsset}=await import('./studio-assets.js');
    const materialVariant=query.get('materials');
    if(materialVariant!=='stone-r4')throw new Error(`Unknown Fangwaiguan material study: ${materialVariant}`);
    const factory=await getStudioAsset(id).loadFactory({signal,materialVariant});signal?.throwIfAborted();
    return factory();
  }
  return manifestURL?loadMuseumArchive(id,manifestURL,{signal,expectedManifestSHA256}):loadMuseumModel(id,{signal});
}
async function prepareMuseumGround(){
  if(query.get('composition')==='jiuzhou'){
    composition=createJiuzhouComposition({root:scene,signal:controller.signal,beforeDispose:releaseSceneJiuzhouDependents});
    const plan=await composition.prepare();controller.signal.throwIfAborted();
    ({layout:gardenLayout,pads:terrainPads,courts:terrainCourts=[],paths:terrainPaths=[],replacements:terrainReplacements=[]}=plan);
    architecture=composition.support;renderDestinations();return;
  }
  if(query.get('composition')==='xianfaqiao'){
    composition=createXianfaqiaoComposition({root:scene,signal:controller.signal,load:loadSceneBuilding,court:query.get('court'),yangquelong:query.get('yangquelong'),beforeDispose:releaseSceneGuides});
    const plan=await composition.prepare();controller.signal.throwIfAborted();
    ({layout:gardenLayout,pads:terrainPads,courts:terrainCourts=[],paths:terrainPaths=[],replacements:terrainReplacements=[]}=plan);
    architecture=composition.support;renderDestinations();return;
  }
  preparedGroundSources=await prepareMuseumGroundSources(museumResidentCatalog.filter(entry=>entry.requiresPreparedGround),{
    signal:controller.signal,
    load:(descriptor,{signal})=>loadSceneBuilding(descriptor.assetId,{signal,manifestURL:descriptor.source.manifestURL,expectedManifestSHA256:descriptor.source.approvedManifestSHA256}),
  });
  ({layout:gardenLayout,pads:terrainPads,courts:terrainCourts=[],paths:terrainPaths=[],replacements:terrainReplacements=[]}=createMuseumLandscape({readyAssetIds:preparedGroundSources.readyAssetIds}));
}
// Regional planting shares the retained architecture dispatcher and actual
// terrain. North court edge, outer forelake bank and bridge approaches are
// reviewed with this full pair; other gardens await their retained buildings.
async function prepareSceneWesternPlanting(){
  const mergedSites=new Map(museumSites.map(site=>[site.id,site]));
  for(const site of composition.sites)mergedSites.set(site.id,site);
  const basePlantingLayout=createXianfaqiaoGardenPlantingLayout({sites:[...mergedSites.values()],layout:gardenLayout});
  const hasFuhaiContext=query.get('court')==='garden-r4';
  const plantingLayout=hasFuhaiContext?extendFuhaiNortheastBankContext(basePlantingLayout):basePlantingLayout;
  const regionIds=['xieqiqu-north-garden','xieqiqu-forelake-garden','xianfaqiao-approach-garden'];
  if(hasFuhaiContext)regionIds.push(fuhaiNortheastBankContextRegionId);
  westernPlantingLifetime=new AbortController();
  westernPlanting=await createWesternGardenScenePlanting({root:scene,terrain,architecture:()=>architecture,
    plantingLayout,regionIds,signal:westernPlantingLifetime.signal,
    onProgress:({completed,total})=>busy(true,lang==='zh'?`正在安置谐奇趣与线法桥园林… ${completed} / ${total}`:`Placing the Xieqiqu and bridge gardens… ${completed} / ${total}`),
  });
  controller.signal.throwIfAborted();
  if(!query.has('review'))return;
  const site=mergedSites.get('xieqiqu'),world=point=>{const p=sitePoint(site,point);return[p.x,p.y,p.z];};
  const views=[
    {id:'north-garden-wide',label:'北园与建筑 / North garden and architecture',position:[-84,54,-111],target:[-5,6,-35]},
    {id:'north-garden-axis',label:'入口轴线 / Entrance axis',position:[0,9,-111],target:[0,5,-52]},
    {id:'north-garden-ground',label:'湖石花草近景 / Stone and planting detail',position:[-23,1.8,-56],target:[-31,.6,-58],requireClearSightline:true},
    {id:'south-garden-wide',label:'前湖与桥头园林 / Forelake and bridge gardens',position:[-82,51,119],target:[-1,8,18]},
    {id:'forelake-garden-ground',label:'前湖岸边近景 / Forelake planting detail',position:[31,2.1,68],target:[37,.65,61],requireClearSightline:true},
  ];
  if(['garden-r1','garden-r2','garden-r3','garden-r4'].includes(query.get('court')))views.push(
    {id:'north-court-garden-wide',label:'北院全景 / North court gardens',position:[58,33,-94],target:[0,8,-17]},
    {id:'north-court-garden-detail',label:'花床与石边近景 / Parterre and stone detail',position:[14,2,-48],target:[21,.6,-37],requireClearSightline:true},
  );
  state.gardenViewPreflight=[];
  for(const view of views){
    const sightline=view.requireClearSightline?gardenReviewCameraSightline({position:world(view.position),target:world(view.target),terrain,architecture}):null;
    state.gardenViewPreflight.push({id:view.id,sightline});
    const button=document.createElement('button');button.type='button';button.dataset.plantingAction=view.id;button.textContent=view.label;
    if(sightline&&!sightline.clear){button.disabled=true;button.title=`视线受阻 / Obstructed: ${sightline.obstacleId??sightline.reason}`;}
    button.addEventListener('click',()=>{
      if(!ready||loading||capturing||disposed||westernPlanting.disposed)return;
      try{westernPlanting.assertCurrent();}catch(error){message(error.message,12);redraw.request();return;}
      setReviewPaused(true);controls.minDistance=.05;
      camera.position.fromArray(world(view.position));controls.target.fromArray(world(view.target));controls.update();
      delete state.compositionView;
      plantingReview={id:view.id,label:view.label,space:'world',regionIds:[...regionIds],sightline,scope:'Full world retained; only the camera changes. Contemporary planting composition, not surveyed historical planting.'};
      redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
    },{signal:controller.signal});$('review-tools').insertBefore(button,$('capture'));
  }
}
// Four view arrivals share this one scene-owned grove and the same live
// terrain/architecture. Its original source loader owns all regional sharing.
function prepareSceneJiuzhouShoreGrove(){
  controller.signal.throwIfAborted();
  if(disposed||contextLost)throw new DOMException('Jiuzhou grove scene unavailable','AbortError');
  if(shoreGroveTask)return shoreGroveTask;
  const lifetime=shoreGroveLifetime=new AbortController();
  shoreGroveStatus='preparing';
  shoreGroveTask=(async()=>{
    let owner=null;
    try{
      owner=await createJiuzhouShoreGrove({root:scene,terrain,architecture:()=>architecture,layout:gardenLayout,signal:lifetime.signal,
        onProgress:({completed,total})=>{if(shoreGroveLifetime===lifetime&&!disposed&&!contextLost)busy(true,(lang==='zh'?'正在安置当代湖岸树丛… ':'Placing contemporary shore groves… ')+completed+' / '+total);}});
      controller.signal.throwIfAborted();lifetime.signal.throwIfAborted();
      if(disposed||contextLost||shoreGroveLifetime!==lifetime)throw new DOMException('Jiuzhou grove preparation retired','AbortError');
      shoreGrove=owner;shoreGroveStatus='ready';return owner;
    }catch(error){
      const errors=[error];
      if(owner){try{owner.dispose();}catch(cleanup){errors.push(cleanup);}try{await owner.whenIdle();}catch(cleanup){errors.push(cleanup);}}
      shoreGroveError=error.message;if(!lifetime.signal.aborted)shoreGroveStatus='failed';
      if(errors.length>1)throw new AggregateError(errors,'Jiuzhou grove preparation and cleanup failed',{cause:error});
      throw error;
    }
  })();
  // The bootstrap awaits this promise. Keep a rejected late result handled
  // even when pagehide has already retired the whole scene.
  shoreGroveTask.catch(()=>{});return shoreGroveTask;
}
function releaseSceneShoreGrove(){
  const owner=shoreGrove,lifetime=shoreGroveLifetime,wasPreparing=shoreGroveStatus==='preparing',errors=[];
  if(!owner&&!lifetime)return;
  // Navigation drops the old collision reference before any resource callback.
  shoreGrove=null;shoreGroveLifetime=null;shoreGroveStatus='disposed';
  try{owner?.dispose();}catch(error){errors.push(error);}
  try{lifetime?.abort(new DOMException('Jiuzhou grove scene retired','AbortError'));}catch(error){errors.push(error);}
  const pending=owner?owner.whenIdle():wasPreparing?shoreGroveTask:Promise.resolve();
  shoreGroveCleanup=Promise.resolve(pending).catch(error=>{
    if(!owner&&error.name==='AbortError')return;
    shoreGroveError=error.message;console.error(new AggregateError([error],'Museum scene cleanup failed'));
  });
  if(errors.length)throw new AggregateError(errors,'Jiuzhou grove cleanup failed');
}
function releaseSceneJiuzhouDependents(){
  const errors=[];
  for(const release of [releaseSceneGuides,releaseSceneShoreGrove])try{release();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Jiuzhou dependent cleanup failed');
}
function ensureSceneShoreGroveCurrent(){
  if(!isJiuzhouComposition())return true;
  try{
    if(!shoreGrove||shoreGrove.disposed)throw new Error('Jiuzhou shore grove is unavailable.');
    shoreGrove.assertCurrent();return true;
  }catch(error){return failComposedScene(error);}
}
function currentPlantingCollision(){
  // These owners are route-exclusive: western requires Xianfaqiao; pilot
  // requires no composition. A retired Jiuzhou grove never revives either.
  return isJiuzhouComposition()?shoreGrove?.collision??null:westernPlanting?westernPlanting.collision:plantingCollisions;
}
async function prepareSceneShoreBank(){
  const {loadShoreBankStudyR1}=await import('./shore-bank-integration.js');
  const drifts=['r3','r4'].includes(query.get('bank'));let stoneMaterial;
  if(drifts)plantingPilot?.parts.find(part=>part.userData.species==='lake-rock')?.traverse(node=>{if(!stoneMaterial&&node.isMesh&&node.material?.map&&node.material.normalMap&&node.material.roughnessMap)stoneMaterial=node.material;});
  const bedProfile=query.get('bank')==='r4'?'curved-r4':['r2','r3'].includes(query.get('bank'))?'submerged-r2':'r1';
  const owner=await loadShoreBankStudyR1({terrain,signal:controller.signal,bedProfile,pebbleLayout:drifts?'drifts-r3':'r1',stoneMaterial});
  if(disposed){owner.dispose();return;}shoreBank=owner;
  if(query.has('review'))for(const [id,view] of Object.entries(owner.views)){
    const button=document.createElement('button');button.type='button';button.textContent=`湖岸 / ${id}`;button.title=view.label;
    button.addEventListener('click',()=>{
      if(!ready||loading||capturing)return;
      setReviewPaused(true);controls.minDistance=.05;
      camera.position.fromArray(view.camera);controls.target.fromArray(view.target);controls.update();
      plantingReview={id:`bank-${id}`,label:view.label,worldContextRetained:true};
      redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
    });$('review-tools').insertBefore(button,$('capture'));
  }
  if(query.get('bank')==='r4'){
    const fine=owner.group.getObjectByName('shore-bank-r4-fine-ground');
    if(fine?.isMesh){
      const materials=[terrain.earthMaterial,fine.material];
      const apply=mode=>{for(const material of materials)setWillowSampling(material,mode);state.shoreSamplingReview={mode,materials:materials.map(m=>m.name),scope:'MSAA colour and normal interpolation only; same geometry, maps, water, lights and sample count.'};};
      // Native same-view comparisons remove bright/dark edge outliers with
      // covered interpolation; keep the original mesh and all 4K PBR maps.
      apply('centroid');
      if(query.has('review')){
        const select=document.createElement('select');select.setAttribute('aria-label','岸坡边缘插值 / Shore edge sampling');
        for(const [value,label]of [['pixel','像素中心 / Pixel centre'],['centroid','覆盖内插值 / Centroid']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
        select.value='centroid';
        select.addEventListener('change',()=>{
          if(!ready||loading||capturing||disposed){select.value=state.shoreSamplingReview.mode;return;}
          setReviewPaused(true);apply(select.value);redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
        });$('review-tools').insertBefore(select,$('capture'));
      }
    }
  }
  if(query.has('review')&&query.get('bank')==='r4'){
    const button=document.createElement('button');button.type='button';button.textContent='岸边步行起点 / Shore walk start';
    button.addEventListener('click',()=>{
      if(!ready||loading||capturing||disposed||state.transition)return;
      const approach={x:848.9361587563676,y:8,z:-555.2271266580581},support=nav.landing(approach);
      if(!support.valid){message(`${lang==='zh'?'岸边起点不能安全落地':'The shore start is not safe'}: ${support.reason}`);return;}
      setReviewPaused(true);keys.clear();touch.clear();reviewMotion=null;reviewMotionResult=null;frameSamples.length=0;
      state.position={x:approach.x,y:support.y,z:approach.z};state.mode='grounded';state.support=support;state.transition=null;state.speed=0;state.gaitPhase=0;
      const direction={x:.9701425001453318,z:-.24253562503633427};state.heading=museumTravelHeading(direction.x,direction.z);
      state.shoreWalkReview={entry:'visible shore start; live navigation landing',approach,landing:{y:support.y,normal:{...support.normal},surfaceId:support.surfaceId},direction,scope:'Dry shore beside the replacement; this route does not enter the submerged bed.'};
      resetCharacterMotion(visitor.group,{mode:'grounded'});plantingReview=null;controls.minDistance=4;
      camera.position.set(approach.x-direction.x*7,support.y+4,approach.z-direction.z*7);controls.target.set(approach.x+direction.x*4,support.y+1.2,approach.z+direction.z*4);controls.update();
      advance(0);syncControls();redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
      message(lang==='zh'?'已在实际岸坡安全落地，可用步行按钮检查脚底与地面。':'Landed on the actual shore. Use Walk to review foot contact.');
    });$('review-tools').insertBefore(button,$('capture'));
  }
}
function placeMuseumLandscapeAsset(resource,site){
  try{
    placeMuseumStaticAsset(resource,site);
    const restore=configureMuseumLandscapeAsset(resource,site,{terrain,water});
    if(restore){
      const release=resource.dispose;let released=false;
      resource.dispose=()=>{if(released)return;released=true;try{restore();}finally{release.call(resource);}};
    }
    return resource;
  }catch(error){resource.dispose();throw error;}
}
function prepareCompositionReview(){
  const blocked=()=>!ready||loading||capturing||disposed||state.transition;
  const button=(id,label,action)=>{const node=document.createElement('button');node.type='button';node.dataset.compositionAction=id;node.textContent=label;node.addEventListener('click',action,{signal:controller.signal});$('review-tools').insertBefore(node,$('capture'));return node;};
  const labels=['前湖与线法桥 / Lake and bridge','北接道 / North approach','南接道 / South approach','两水面衔接 / Connected waters'];
  composition.candidate.compositionReview.views.forEach((view,i)=>button(view.id,labels[i],()=>{
    if(blocked())return;setReviewPaused(true);plantingReview=null;controls.minDistance=.05;
    camera.position.fromArray(view.position);controls.target.fromArray(view.target);controls.update();
    state.compositionView={id:view.id,space:'world',nativeReviewed:false};redraw.request();
  }));
  for(const site of composition.sites){
    const entry=museumEntry(site.entryId);
    button(`visit-${site.id}`,'前往'+entry.title.zh+' / Visit '+entry.title.en,()=>{if(!blocked())visit(site.id);});
    const read=button(`read-${site.id}`,entry.title.zh+'展签 / '+entry.title.en+' exhibit',()=>reader.open(site.entryId,{trigger:read}));
  }
  const land=()=>{
    if(blocked())return false;
    const result=xianfaqiaoRouteLanding(composition,nav);
    if(!result.valid){message(`${copy[lang].unsafe} ${result.reason}`);return false;}
    const {approach,support,position,direction}=result;
    setReviewPaused(true);keys.clear();touch.clear();reviewMotionResult=null;frameSamples.length=0;
    state.position=position;state.mode='grounded';state.support=support;state.transition=null;state.speed=0;state.gaitPhase=0;state.heading=museumTravelHeading(direction.x,direction.z);
    state.compositionWalkReview={entry:'visible north approach start; live navigation landing',approach,landing:{y:support.y,normal:{...support.normal},surfaceId:support.surfaceId},direction,routeId:composition.candidate.compositionReview.route.id,scope:'Two seconds along the north approach; a complete bridge crossing and gate passage still require actual movement review.'};
    resetCharacterMotion(visitor.group,{mode:'grounded'});plantingReview=null;delete state.compositionView;controls.minDistance=4;
    camera.position.set(position.x-direction.x*7,position.y+4,position.z-direction.z*7);controls.target.set(position.x+direction.x*4,position.y+1.2,position.z+direction.z*4);controls.update();
    advance(0);syncControls();redraw.request();return true;
  };
  button('route-start','北岸步行起点 / Walk start',land);
  button('route-walk-2s','沿北接道步行 2 秒 / Walk approach 2 s',()=>{
    if(!land())return;reviewMotion={name:'walk',duration:2,from:{...state.position},elapsed:0,pathDistance:0};reviewMotionResult=null;reviewFramesRemaining=0;frameSamples.length=0;setReviewPaused(false);
  });
  $('review-tools').open=true;
}
// A failed composition bootstrap keeps the exhibit reader available, but no
// source owner, sheet handoff or scene resource may survive as a half-ready site.
function releaseSceneGuides(){
  const owned=[guides,guideSurface],errors=[];guides=null;guideSurface=null;
  for(const resource of owned)try{resource?.dispose();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Museum guide cleanup failed');
}
function releaseCompositionScene(){
  const errors=[];try{releaseSceneJiuzhouDependents();}catch(error){errors.push(error);}
  const owned=[sites,westernPlanting,composition,terrainAssets,pool,visitor,water,terrain,groundTextures,environment,controls,rendering,renderer];
  guides=null;guideSurface=null;sites=null;westernPlanting=null;architecture=null;terrainAssets=null;pool=null;visitor=null;water=null;terrain=null;groundTextures=null;environment=null;controls=null;rendering=null;renderer=null;nav=null;
  for(const resource of owned)if(resource){
    try{resource.group?.removeFromParent();}catch(error){errors.push(error);}
    try{resource.dispose();}catch(error){errors.push(error);}
  }
  return errors;
}
function busy(value,text){loading=value;$('loading').hidden=contextLost?false:!value;if(contextLost)$('loading-copy').textContent=copy[lang].graphicsLost;else if(text)$('loading-copy').textContent=text;keys.clear();touch.clear();last=0;document.body.dataset.ready=contextLost?'context-lost':value?'loading':ready?'true':'failed';}
function setLanguage(next){
  lang=next==='en'?'en':'zh';document.documentElement.lang=lang;
  for(const el of document.querySelectorAll('[data-copy]'))el.textContent=copy[lang][el.dataset.copy];
  $('language').textContent=lang==='zh'?'EN':'中';$('controls-copy').textContent=copy[lang].controls;$('help-copy').textContent=copy[lang].helpText;
  for(const option of $('time-mode').options)option.textContent=copy[lang][option.value];
  if(reader.lang!==lang)reader.setLanguage(lang);directory.setLanguage(lang);guides?.setLanguage(lang);renderDestinations();locationCaption();syncControls();
}
function locationCaption(){renderTourLink();renderJiuzhouViews();if(!currentSite)return;const entry=museumEntry(currentSite.entryId);$('site-title').textContent=entry.title[lang];$('region-name').textContent=museumRegions.find(region=>region.id===currentSite.region).title[lang];}
function syncControls(){
  const sound=audio.snapshot().enabled;$('sound-toggle').textContent=copy[lang][sound?'soundOn':'soundOff'];$('sound-toggle').setAttribute('aria-pressed',String(sound));
  $('flight-toggle').textContent=copy[lang][state.mode==='grounded'?'fly':'land'];$('flight-toggle').disabled=!!state.transition||!ready||capturing||loading||contextLost;
  $('camera-mode').textContent=copy[lang][['camera','bird','low'][cameraMode]];
  const near=guides?.nearest(state.position);$('inspect').disabled=!ready||loading||capturing||contextLost;$('inspect').querySelector('span').textContent=near?near.label[lang]:copy[lang].read;
}
function svgNode(tag,attrs){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
function isJiuzhouComposition(){return query.get('composition')==='jiuzhou'&&Boolean(composition?.views);}
function renderMap(){
  const jiuzhou=isJiuzhouComposition();
  const threeSites=composition?.sites.some(site=>site.id==='yangquelong');
  const mapLabel=jiuzhou?(lang==='zh'?'九州清晏三路院落与水岸位置图':'Jiuzhou courts and waterfront map'):composition?(threeSites?(lang==='zh'?'谐奇趣、线法桥与养雀笼位置图':'Map of Xieqiqu, Xianfaqiao and Yangquelong'):(lang==='zh'?'谐奇趣与线法桥位置图':'Map of Xieqiqu and Xianfaqiao')):(lang==='zh'?'圆明三园位置图':'Map of the three gardens');
  let jiuzhouBox;
  if(jiuzhou){
    const site=composition.sites[0],points=[...(composition.plan?.jiuzhou.worldOutline??[]),...Object.values(composition.views).map(view=>{const p=sitePoint(site,view.arrival);return [p.x,p.z];})];
    const minX=Math.min(...points.map(p=>p[0]))-12,minZ=Math.min(...points.map(p=>p[1]))-12,maxX=Math.max(...points.map(p=>p[0]))+12,maxZ=Math.max(...points.map(p=>p[1]))+12;
    jiuzhouBox=[minX,minZ,maxX-minX,maxZ-minZ].join(' ');
  }
  const svg=svgNode('svg',{viewBox:jiuzhou?jiuzhouBox:composition?(threeSites?'292 -680 190 226':'292 -632 172 178'):'-1320 -1000 2700 2020','aria-label':mapLabel,role:'img'}),polygon=(ring,fill,stroke='none')=>svgNode('polygon',{points:ring.map(p=>p.join(',')).join(' '),fill,stroke,'stroke-width':composition ? .6 : 3});
  svg.append(polygon(createExhibitionCoast(gardenLayout),'#d8ddc6'));
  for(const lake of [...gardenLayout.waterBodies,...gardenLayout.ornamentalWaters,...gardenLayout.channels])svg.append(polygon(lake.polygon,'#89b3ad'));
  for(const island of gardenLayout.islands)svg.append(polygon(island.polygon,'#d8ddc6'));
  for(const garden of gardenLayout.gardens)svg.append(polygon(garden.boundary,'none','#768c70'));
  if(composition){for(const court of terrainCourts)if(court.water)svg.append(polygon(court.water.surfacePolygon,'#89b3ad'));for(const path of terrainPaths)svg.append(polygon(path.polygon,'#eee3c9'));}
  for(const site of composition?.sites??museumSites){const dot=svgNode('circle',{cx:site.position[0],cy:site.position[2],r:composition?2.2:14,fill:site.id===currentSite?.id?'#9c6939':'#345e4b',stroke:'#fcf7de','stroke-width':composition ? .7 : 5});const title=svgNode('title',{});title.textContent=museumEntry(site.entryId).title[lang];dot.append(title);svg.append(dot);}
  $('garden-map').replaceChildren(svg);
}
function renderTourLink(){
  const link=$('tour-route-link');if(!link)return;
  const western=query.get('composition')==='xianfaqiao',jiuzhou=query.get('composition')==='jiuzhou';
  const previous=western?query:new URLSearchParams(query.get('returnTour')??'composition=xianfaqiao&planting=western&court=garden-r4&yangquelong=refined-r1');
  const route=new URLSearchParams({composition:'xianfaqiao'});
  if(previous.get('planting')==='western')route.set('planting','western');
  if(previous.get('court')==='garden-r4')route.set('court','garden-r4');
  if(previous.get('yangquelong')==='refined-r1')route.set('yangquelong','refined-r1');
  const requested=western?(currentSite?.id??query.get('site')):(previous.get('site')??currentSite?.id??query.get('site'));
  const ids=route.has('yangquelong')?['xieqiqu','xianfaqiao','yangquelong']:['xieqiqu','xianfaqiao'];
  route.set('site',ids.includes(requested)?requested:'xieqiqu');
  const view=jiuzhou?(currentSite?.viewId??query.get('view')):query.get('returnJiuzhouView');
  const retainedView=['central','western','eastern','waterfront'].includes(view)?view:'central';
  const current=currentSite?.id??query.get('site');
  const overview=new URLSearchParams({site:museumSite(current)?current:'xieqiqu',lang,returnTour:route.toString(),returnJiuzhouView:retainedView});
  if(western){
    link.href='/yuanmingyuan.html?'+overview;link.textContent=lang==='zh'?'三园研究总览（其余园区制作中）':'Three-garden study overview (other areas in progress)';
  }else{
    route.set('lang',lang);route.set('returnJiuzhouView',retainedView);
    link.href='/yuanmingyuan.html?'+route;link.textContent=lang==='zh'?'返回西洋楼游线':'Return to the Western Buildings route';
  }
  const jiuzhouLink=$('jiuzhou-tour-link');
  if(jiuzhouLink){
    jiuzhouLink.hidden=jiuzhou;
    const returnRoute=new URLSearchParams(route);returnRoute.delete('lang');returnRoute.delete('returnJiuzhouView');
    jiuzhouLink.href='/yuanmingyuan.html?'+new URLSearchParams({composition:'jiuzhou',view:retainedView,lang,returnTour:returnRoute.toString()});
    jiuzhouLink.textContent=lang==='zh'?'进入九州清晏：三路院落与水岸':'Enter Jiuzhou Qingyan: courts and waterfront';
  }
  const overviewLink=$('overview-route-link');
  if(overviewLink){overviewLink.hidden=!jiuzhou;overviewLink.href='/yuanmingyuan.html?'+overview;overviewLink.textContent=lang==='zh'?'返回三园研究总览':'Return to the three-garden study overview';}
}
function renderJiuzhouViews(){
  const list=$('jiuzhou-viewpoints');if(!list)return;
  list.replaceChildren();list.hidden=!isJiuzhouComposition();if(list.hidden)return;
  for(const view of Object.values(composition.views)){
    const button=document.createElement('button');button.type='button';button.dataset.jiuzhouView=view.id;
    button.textContent=museumEntry(view.entryId).title[lang];button.setAttribute('aria-pressed',String((currentSite?.viewId??'central')===view.id));
    button.addEventListener('click',()=>{closeDialog('map-dialog');visit(view.siteId,{viewId:view.id});});list.append(button);
  }
  const land=document.createElement('button');land.type='button';land.dataset.jiuzhouAction='land';
  land.textContent=lang==='zh'?'在当前院落安全入口落地':'Land at this court’s safe entry';
  land.addEventListener('click',()=>{closeDialog('map-dialog');landJiuzhouView();});list.append(land);
}
function landJiuzhouView(){
  if(!isJiuzhouComposition()||!ready||loading||disposed||contextLost||capturing||state.transition||!visitor||!nav||!ensureSceneShoreGroveCurrent())return false;
  const result=jiuzhouViewLanding(composition,nav,currentSite?.viewId??'central');
  if(!result.valid){message(copy[lang].unsafe);return false;}
  keys.clear();touch.clear();reviewMotion=null;reviewMotionResult=null;
  state.position=result.position;state.support=result.support;state.mode='grounded';state.transition=null;state.speed=0;state.gaitPhase=0;
  const focus=sitePoint(currentSite,currentSite.focus);state.heading=museumTravelHeading(focus.x-state.position.x,focus.z-state.position.z);
  resetCharacterMotion(visitor.group,{mode:'grounded'});frameVisitor();advance(0);syncControls();redraw.request();return true;
}
function renderDestinations(){
  renderTourLink();renderJiuzhouViews();$('destinations').replaceChildren();for(const site of composition?.sites??museumSites){const entry=museumEntry(site.entryId),button=document.createElement('button'),small=document.createElement('small');button.type='button';button.dataset.site=site.id;button.textContent=entry.title[lang];small.textContent=entry.title[lang==='zh'?'en':'zh'];button.append(small);button.addEventListener('click',()=>{closeDialog('map-dialog');visit(site.id);});$('destinations').append(button);}renderMap();
}
function openDialog(id,trigger){keys.clear();touch.clear();$(id).returnFocus=trigger;$(id).showModal();guides?.setPaused(true);audio.update({reading:true});}
function closeDialog(id){$(id).close();}
for(const id of dialogs){$(id).addEventListener('close',()=>{$(id).returnFocus?.focus();guides?.setPaused(false);audio.update({reading:reader.isOpen});start();});}
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>closeDialog(button.dataset.close));
$('map-toggle').addEventListener('click',()=>{renderMap();openDialog('map-dialog',$('map-toggle'));});
$('directory-toggle').addEventListener('click',()=>openDialog('directory-dialog',$('directory-toggle')));
$('help-toggle').addEventListener('click',()=>openDialog('help-dialog',$('help-toggle')));
$('language').addEventListener('click',()=>setLanguage(lang==='zh'?'en':'zh'));
$('sound-toggle').addEventListener('click',()=>{audio.setEnabled(!audio.snapshot().enabled);syncControls();redraw.request();});
document.addEventListener('pointerdown',()=>audio.unlock(),{signal:controller.signal});
$('time-mode').addEventListener('change',()=>{environment?.clock.setMode($('time-mode').value,true);redraw.request();});
$('camera-mode').addEventListener('click',()=>changeCamera());
$('flight-toggle').addEventListener('click',toggleFlight);$('inspect').addEventListener('click',inspect);
function changeCamera(){cameraMode=(cameraMode+1)%3;frameVisitor();syncControls();redraw.request();}
function frameVisitor(){if(!controls)return;controls.minDistance=4;plantingReview=null;const p=state.position,offset=[[4,5,12],[7,75,14],[8,2,12]][cameraMode],yaw=currentSite?.viewYaw??currentSite?.rotationY??0,c=Math.cos(yaw),s=Math.sin(yaw);controls.target.set(p.x,p.y+1,p.z);camera.position.set(p.x+offset[0]*c+offset[2]*s,p.y+offset[1],p.z-offset[0]*s+offset[2]*c);controls.update();}
function inspect(){if(paused()||!currentSite)return;const nearest=guides?.nearest(state.position);if(nearest&&guides.interact(nearest.id,{playerPosition:state.position})){message(copy[lang].guide);return;}reader.open(nearest?.entryId??currentSite.entryId,{trigger:$('inspect')});}
function toggleFlight(){
  if(paused()||state.transition||!visitor)return;
  if(!ensureSceneShoreGroveCurrent())return;
  if(state.mode==='grounded'){
    state.transition={mode:'mounting',elapsed:0,from:{...state.position},to:{...state.position,y:state.position.y+8}};state.mode='mounting';
  }else{
    const support=nav.landing(state.position);if(!support.valid){message(copy[lang].unsafe);return;}
    state.transition={mode:'dismounting',elapsed:0,from:{...state.position},to:{x:state.position.x,y:support.y,z:state.position.z},support};state.mode='dismounting';
  }
  keys.clear();touch.clear();syncControls();
}
const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','ShiftLeft','ShiftRight']);
function keydown(event){
  if(event.target.closest('input,select,textarea,dialog')||event.ctrlKey||event.metaKey||event.altKey)return;
  if(movementCodes.has(event.code)){if(!paused()){event.preventDefault();audio.unlock();keys.add(event.code);}return;}
  if(event.repeat)return;
  if(event.code==='KeyE'){event.preventDefault();inspect();}else if(event.code==='KeyB'){event.preventDefault();toggleFlight();}else if(event.code==='KeyV'){event.preventDefault();changeCamera();}else if(event.code==='KeyM'){event.preventDefault();if($('map-dialog').open)closeDialog('map-dialog');else{renderMap();openDialog('map-dialog',canvas);}}
}
document.addEventListener('keydown',keydown);const keyup=event=>keys.delete(event.code);document.addEventListener('keyup',keyup);const clearKeys=()=>{keys.clear();touch.clear();};addEventListener('blur',clearKeys);
function createGuideRegion(site){
  const world=createMuseumGuideWorld({site,terrain,architecture,centre:sitePoint(site,site.guide),visitorCollider:()=>museumVisitorCollider(state)});
  try{
    const centre=sitePoint(site,site.guide),exhibitIds=[site.entryId,...museumEntry(site.entryId).related.filter(id=>museumEntry(id))];
    // The Jiuzhou visitor arrives in flight. Reserve its authored ground entry
    // when choosing initial guide positions; landing still checks live colliders.
    const entryClearance=isJiuzhouComposition()?sitePoint(site,composition.getView(site.viewId??'central').entry):state.position;
    const {placements,rejected}=selectMuseumGuidePlacements({site,centre,world,architecture,visitorPosition:entryClearance,entryIds:exhibitIds});
    world.placementReview={accepted:placements.length,placements:placements.map(p=>({id:p.id,position:{...p.position},heading:p.heading,waypoints:p.waypoints.map(w=>({...w}))})),rejected};
    const regionGuides=placements.length?createMuseumGuides({pool,root:scene,...world,placements,language:lang,isActive:()=>!paused(),onSound:event=>audio.companion(event,{isActive:()=>!paused(),distanceFrom:state.position}),onSilence:({owner})=>audio.silence(owner),onInspect:({entryId})=>reader.open(entryId,{trigger:$('inspect')})}):null;
    return {guides:regionGuides,world};
  }catch(error){try{world.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Guide region initialization and support cleanup failed',{cause:error});}throw error;}
}
function placeGuides(site,{reset=false}={}){
  if(composition){
    if(!pool)return;
    if(!guides?.isMuseumGuideEnsemble){
      guides?.dispose();guideSurface?.dispose();
      guides=createMuseumGuideEnsemble({siteIds:composition.sites.map(site=>site.id),create:createGuideRegion,language:lang});guideSurface=guides.worlds;
    }
    if(reset)guides.reset(site);else guides.ensure(site);
    return;
  }
  guides?.dispose();guides=null;guideSurface?.dispose();guideSurface=null;if(!pool)return;
  const region=createGuideRegion(site);guides=region.guides;guideSurface=region.world;
}
async function visit(id,{teleport=true,viewId}={}){
  const base=composition?composition.sites.find(site=>site.id===id):museumSite(id);if(!base||disposed||loading||contextLost||!sites)return;
  let site=base;
  if(isJiuzhouComposition()){
    const requestedView=viewId??currentSite?.viewId??query.get('view');
    const view=composition.getView(Object.hasOwn(composition.views,requestedView)?requestedView:'central');
    // A temporary visit caption/arrival is not another persistent descriptor.
    site={...base,...view,id:base.id,viewId:view.id};
  }
  const previousSite=currentSite,wasReady=ready;
  busy(true,copy[lang].building);currentSite=site;locationCaption();
  let asset=null,loadFailure=null;
  try{asset=await sites.select(id);}catch(error){loadFailure=error;}
  if(disposed)return;
  if(!asset){
    currentSite=previousSite;ready=wasReady;busy(false);locationCaption();syncControls();message(loadFailure?`${copy[lang].failed} ${loadFailure.message||String(loadFailure)}`:copy[lang].failed,15);
    // select() retired the primary owner; render restores any warm resident
    // before restarting an already initialized world. A first load stays failed.
    redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);start();return;
  }
  if(!ensureSceneShoreGroveCurrent())return;
  if(westernPlanting&&!westernPlanting.disposed)try{westernPlanting.assertCurrent();}catch(error){message(error.message,12);}
  if(teleport){reviewMotion=null;reviewMotionResult=null;delete state.shoreWalkReview;delete state.compositionWalkReview;state.position=sitePoint(site,site.arrival);state.mode='flying';state.transition=null;state.speed=0;const focus=sitePoint(site,site.focus);state.heading=museumTravelHeading(focus.x-state.position.x,focus.z-state.position.z);state.gaitPhase=0;resetCharacterMotion(visitor.group,{mode:'flying'});frameVisitor();}
  audio.setEmitter(['yuanyingguan','haiyantang','xieqiqu','yangquelong'].includes(site.id)?sitePoint(site,[site.guide[0],2,site.guide[2]]):null);
  placeGuides(site,{reset:teleport});ready=true;advance(0);busy(false);locationCaption();syncControls();redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);start();
}
function advance(dt){
  if(!ensureSceneShoreGroveCurrent())return;
  const navigationStart=performance.now();
  const before={...state.position};
  camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();right.crossVectors(forward,THREE.Object3D.DEFAULT_UP).normalize();
  const tactile=touch.snapshot(),z=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))+tactile.z,x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+tactile.x;
  const input={x:forward.x*z+right.x*x,z:forward.z*z+right.z*x,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||tactile.boost,vertical:Math.max(-1,Math.min(1,Number(keys.has('Space'))-Number(keys.has('KeyC'))+tactile.vertical))};
  // Visible review controls drive the same navigation and animation path as
  // ordinary input. They neither teleport the visitor nor skip collision tests.
  if(reviewMotion){const lateral=['left','right'].includes(reviewMotion.name),direction=['back','left'].includes(reviewMotion.name)?-1:1,basis=lateral?right:forward;input.x=basis.x*direction;input.z=basis.z*direction;input.boost=reviewMotion.name==='run';input.vertical=0;}
  let progress=0;
  if(state.transition){
    const t=state.transition;t.elapsed+=dt;progress=Math.min(1,t.elapsed/1.2);const smooth=progress*progress*(3-2*progress);
    for(const axis of ['x','y','z'])state.position[axis]=THREE.MathUtils.lerp(t.from[axis],t.to[axis],smooth);
    if(progress>=1){state.mode=t.mode==='mounting'?'flying':'grounded';state.support=t.support||null;state.transition=null;resetCharacterMotion(visitor.group,{mode:state.mode});syncControls();}
    state.speed=0;
  }else if(state.mode==='grounded'){
    const step=nav.walk(state,{...input,run:input.boost},dt);state.position=step.position;state.support=step.support;state.speed=dt?step.distance/dt:0;
    if(state.speed>.01){const running=state.speed>(MOTION.walkSpeed+MOTION.runSpeed)/2;state.gaitPhase=(state.gaitPhase+step.distance/((running?MOTION.runSpeed:MOTION.walkSpeed)*(running?MOTION.runCycle:MOTION.walkCycle)))%1;state.heading+=Math.atan2(Math.sin(step.heading-state.heading),Math.cos(step.heading-state.heading))*(1-Math.exp(-12*dt));}
  }else{
    nav.setCeiling(Infinity);state.position=stepMuseumFlightAroundPlants(state.position,input,dt,{surfaceAt:nav.flightSurfaceAt,planting:currentPlantingCollision()});state.speed=dt?Math.hypot(state.position.x-before.x,state.position.z-before.z)/dt:0;
    if(Math.hypot(input.x,input.z)>.01){const heading=museumTravelHeading(input.x,input.z);state.heading+=Math.atan2(Math.sin(heading-state.heading),Math.cos(heading-state.heading))*(1-Math.exp(-7*dt));}
  }
  const grounded=state.mode==='grounded'||state.mode==='mounting';
  if(frameTiming)frameTiming.navigationMs+=performance.now()-navigationStart;
  const poseStart=performance.now();
  const modelY=state.position.y-(grounded?MOTION.soleY:state.mode==='dismounting'?MOTION.soleY*progress:0);
  visitor.group.position.set(state.position.x,modelY,state.position.z);visitor.group.rotation.set(0,state.heading,0);
  const support=state.support?.valid?{...state.support,x:state.position.x,z:state.position.z,heightAt:(a,b)=>nav.surfaceAt(a,b)?.height??state.position.y}:undefined;
  updateCharacter(visitor.group,{dt,mode:state.mode,groundSpeed:state.speed,gaitPhase:state.gaitPhase,transitionProgress:progress,groundSupport:support,speed:state.speed/64,boost:input.boost,vertical:input.vertical});
  if(frameTiming)frameTiming.poseMs+=performance.now()-poseStart;
  const delta=new THREE.Vector3(state.position.x-before.x,state.position.y-before.y,state.position.z-before.z);controls.target.add(delta);camera.position.add(delta);controls.update();
  if(reviewMotion){reviewMotion.elapsed+=dt;reviewMotion.pathDistance+=delta.length();}
}
function evidence({full=false}={}){
  const data={sourceTag,status:document.body.dataset.ready,graphicsContextLost:contextLost,site:currentSite?.id,reviewPaused,visitor:{mode:state.mode,position:{...state.position},speed:state.speed,heading:state.heading,gaitPhase:state.gaitPhase,transition:state.transition?.mode||null},timeMode:environment?.clock.mode,timePhase:environment?.clock.phase,camera:camera.position.toArray(),target:controls?.target.toArray(),canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight,pixelRatio:renderer?.getPixelRatio()},render:renderer?{...renderer.info.render}:null,memory:renderer?{...renderer.info.memory}:null,architecture:architecture?.diagnostics,guides:null};
  const guideState=guides?.snapshot();data.guides=full?guideState:guideState?{activeTime:guideState.activeTime,actors:guideState.actors.map(({id,valid,reason,clip,position,speed,interactionCount,sign})=>({id,valid,reason,clip,position,speed,interactionCount,sign}))}:null;
  data.audio=audio.snapshot();
  data.frameTiming=timingSummary();
  data.guideQueries=guideSurface?.snapshot();
  data.guidePlacement=guideSurface?.placementReview??null;
  data.waterReflections=water?.snapshot?.();
  data.residentBuildings=residents?.snapshot??null;
  data.composition=composition?.snapshot??null;data.compositionView=state.compositionView??null;data.compositionWalkReview=state.compositionWalkReview??null;
  data.westernPlanting=westernPlanting?.snapshot({full})??null;data.gardenViewPreflight=state.gardenViewPreflight??null;
  data.shoreGrove={status:shoreGroveStatus,error:shoreGroveError,owner:shoreGrove?.snapshot({full})??null,contemporaryExhibition:true,nativeCompositionReviewed:false};
  const planting=plantingPilot?.diagnostics;
  data.plantingPilot=full?planting??null:planting?{id:planting.id,placements:planting.plan.placements.length,trianglesPerPass:planting.trianglesPerPass,geometryAndInstanceBytes:planting.geometryAndInstanceBytes,rootContacts:planting.rootContacts.map(({id,sourceVerticesAtOrBelowDatum,belowCurrentTerrain,maximumGap})=>({id,sourceVerticesAtOrBelowDatum,belowCurrentTerrain,maximumGap}))}:null;
  const shore=shoreCommunity?.diagnostics;
  data.shoreBank=shoreBank?.diagnostics??null;
  data.materialReview=query.has('review')&&query.has('materials')?{asset:'fangwaiguan',variant:query.get('materials'),requestedSource:'full-procedural-material-candidate',loadedStudy:residents?.get('fangwaiguan')?.owner.diagnostics?.materialStudy??null,archiveAdmission:false,catalogManifestIsBaselineOnly:true}:null;
  data.shoreCommunity=full?shore??null:shore?{id:shore.id,placements:shore.placements.length,counts:shore.counts,trianglesPerPass:shore.trianglesPerPass,drawMeshes:shore.drawMeshes,ownedInstanceBufferBytes:shore.ownedInstanceBufferBytes,borrowedSourceInvalidated:shore.borrowedSourceInvalidated,nativeCompositionReviewed:shore.nativeCompositionReviewed}:null;
  data.plantingReview=plantingReview;data.failure=sceneFailure;
  const collision=currentPlantingCollision();
  data.plantingCollisions=full?collision?.diagnostics??null:collision?{solidCount:collision.diagnostics.solidCount,flightQueries:collision.diagnostics.flightQueries,flightBlocked:collision.diagnostics.flightBlocked,initialOverlaps:collision.diagnostics.initialOverlaps}:null;
  data.terrainAssets=terrainAssets?.snapshot??null;data.terrainReplacements=terrain?.replacementStates??[];
  data.motionReview=reviewMotionResult;
  data.shoreWalkReview=state.shoreWalkReview??null;
  data.shoreSamplingReview=state.shoreSamplingReview??null;
  if(full&&state.shoreSamplingReview)data.shoreSamplingPrograms=willowSamplingProgramAudit(renderer);
  data.fullGeometryBatch={requested:query.get('batch')||'0',extensionAvailable:renderer?.extensions.has('WEBGL_multi_draw')??false,diagnostics:sites?.resource?.diagnostics?.multiDrawBatch??sites?.resource?.diagnostics?.staticBatch??null};
  data.multiDrawCulling=sites?.resource?.culling?.snapshot()??null;
  if(query.has('review')&&terrain?.earthMaterial){const material=terrain.earthMaterial;data.groundReview={variant:groundReview,resolution:groundTextures?.resolution,sampling:material.userData.earthSampling,source:groundTextures?.source,files:groundTextures?.files,colorMap:!!material.map,normalScale:material.normalScale.toArray(),roughness:material.roughness,roughnessMap:!!material.roughnessMap,dryRoughnessRemap:!!material.userData.gardenDryRoughness,repeat:material.map?.repeat.toArray()};}
  if(full)Object.assign(data,{scope:'integration review; remaining architecture and vegetation are not represented as completed',siteAsset:sites?.resource?.diagnostics,terrain:terrain?.diagnostics,rendering:{sceneMSAA:rendering?.samples,postprocessing:'GTAO / bloom / HDR output'}});
  if(query.get('review')==='still'&&query.get('nativeFirstFrame')==='capture')data.nativeInitialFrame={deferred:redraw.deferred};
  return data;
}
function failComposedScene(error){const cleanupErrors=releaseCompositionScene();sceneFailure={message:error.message,cleanupErrors:cleanupErrors.map(error=>error.message)};ready=false;busy(false);redraw.cancel();audio.silence();document.body.dataset.ready='failed';$('loading').hidden=false;$('loading-copy').textContent=copy[lang].failed+' '+error.message;$('telemetry').textContent=JSON.stringify(evidence(),null,2);console.error(error);return false;}
function render(dt){if(!ready||disposed||contextLost||document.hidden)return false;if(!ensureSceneShoreGroveCurrent())return false;const sample=environment.update(dt,{paused:paused(),focus:controls.target,shadowSpan:85});document.body.dataset.night=String(sample.night>.5);audio.update({night:sample.night,reading:reader.isOpen||dialogs.some(id=>$(id).open),position:state.position,camera:camera.position,forward:camera.getWorldDirection(new THREE.Vector3()),speed:state.speed,time});water.update(time,sample,camera);const active=sites.resource;if(composition){try{composition.update(time);shoreGrove?.update(time);}catch(error){return failComposedScene(error);}}else{if(active&&residents?.get(sites.snapshot.siteId)?.owner!==active)active.update?.(time);residents?.update(time);residents?.evaluate({camera,renderer,additionalViews:water.reflectionViews?.(camera)??[]});}westernPlanting?.update(time);renderer.shadowMap.needsUpdate=true;renderer.info.reset();rendering.render(dt);return true;}
function tick(now){
  raf=0;if(paused())return;const rawDt=last?Math.max(0,(now-last)/1000):0;last=now;
  const frameStart=performance.now();frameTiming={intervalMs:rawDt*1000,navigationMs:0,poseMs:0,guidesMs:0,renderCpuMs:0,cpuMs:0};
  const {activeDt,simulationDt}=advanceMuseumTime(reviewMotion?Math.min(rawDt,Math.max(0,reviewMotion.duration-reviewMotion.elapsed)):rawDt,advance);time+=activeDt;
  const guideStart=performance.now();guides?.update(simulationDt,{playerPosition:state.position,night:environment.sample?.night||0});frameTiming.guidesMs=performance.now()-guideStart;
  const renderStart=performance.now();if(!render(activeDt)){frameTiming=null;return;}frameTiming.renderCpuMs=performance.now()-renderStart;frameTiming.cpuMs=performance.now()-frameStart;
  if(rawDt>0){frameSamples.push(frameTiming);if(frameSamples.length>90)frameSamples.shift();}frameTiming=null;
  if(now-messageUntil>0)$('message').textContent='';
  if(now-lastTelemetry>500){lastTelemetry=now;syncControls();$('telemetry').textContent=JSON.stringify(evidence(),null,2);}
  if(now-lastProximity>1200&&!state.transition){lastProximity=now;let nearest=(composition?.sites??museumSites).reduce((best,site)=>{const d=Math.hypot(site.position[0]-state.position.x,site.position[2]-state.position.z);return d<best.distance?{site,distance:d}:best;},{site:null,distance:75});const resident=residents?.nearest(state.position);if(resident&&resident.distance<nearest.distance)nearest=resident;if(nearest.site&&nearest.site.id!==currentSite?.id)visit(nearest.site.id,{teleport:false});}
  if(reviewMotion&&reviewMotion.elapsed+1e-9>=reviewMotion.duration){reviewMotionResult={...reviewMotion,to:{...state.position},mode:state.mode,gaitPhase:state.gaitPhase};setReviewPaused(true);return;}
  if(reviewFramesRemaining>0&&--reviewFramesRemaining===0){setReviewPaused(true);return;}
  if(!paused())raf=requestAnimationFrame(tick);
}
function start(){redraw.sync();last=0;if(!raf&&!paused())raf=requestAnimationFrame(tick);}
function resize(){if(!renderer||disposed||contextLost)return;const dpr=devicePixelRatio||1;renderer.setPixelRatio(dpr);renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);rendering?.resize(canvas.clientWidth,canvas.clientHeight,dpr);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();redraw.request();}
const observer=new ResizeObserver(resize);observer.observe(canvas);
document.addEventListener('visibilitychange',()=>{redraw.cancel();clearKeys();audio.setSuspended(document.hidden);cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden){redraw.request();start();}});
function showGraphicsRecovery(){document.body.dataset.ready='context-lost';$('loading').hidden=false;$('loading-copy').textContent=copy[lang].graphicsLost;$('reload-scene').hidden=false;syncControls();$('telemetry').textContent=JSON.stringify(evidence(),null,2);}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;redraw.cancel();cancelAnimationFrame(raf);raf=0;keys.clear();touch.clear();audio.setSuspended(true);if(isJiuzhouComposition())try{releaseSceneJiuzhouDependents();}catch(error){console.error(new AggregateError([error],'Museum scene cleanup failed'));}showGraphicsRecovery();});
// GPU-only environment maps and postprocess targets need a fresh scene owner.
// A restored WebGL context alone must not re-label stale resources as ready.
canvas.addEventListener('webglcontextrestored',()=>{if(!disposed&&contextLost)showGraphicsRecovery();});
$('reload-scene').addEventListener('click',()=>location.reload());
function setReviewPaused(value){reviewPaused=value;if(value){reviewFramesRemaining=0;reviewMotion=null;}keys.clear();touch.clear();cancelAnimationFrame(raf);raf=0;guides?.setPaused(reviewPaused);$('review-pause').textContent=reviewPaused?'继续动画 / Resume':'定格动画 / Freeze';$('review-pause').setAttribute('aria-pressed',String(reviewPaused));$('telemetry').textContent=JSON.stringify(evidence(),null,2);redraw.request();start();}
$('review-pause').addEventListener('click',()=>setReviewPaused(!reviewPaused));
$('review-sample').addEventListener('click',()=>{reviewMotion=null;frameSamples.length=0;reviewFramesRemaining=30;setReviewPaused(false);});
// Visible review controls exercise the real scene, its water and resident
// ownership without changing the visitor or the currently selected site.
if(query.has('review')&&query.get('composition')!=='xianfaqiao')for(const [label,distance,height]of [['正觉寺远景 / Resident far',600,90],['正觉寺近景 / Resident near',200,45]]){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.addEventListener('click',()=>{
    const record=residents?.snapshot.full.find(entry=>entry.id==='zhengjuesi'&&entry.ready);
    if(!record?.bounds){message('尚未载入常驻建筑 / Resident building is not loaded.');return;}
    setReviewPaused(true);const {min,max}=record.bounds,x=(min[0]+max[0])*.5,z=(min[2]+max[2])*.5,y=(min[1]+max[1])*.5;
    controls.target.set(x,y,z);camera.position.set(x,y+height,z+distance);controls.update();redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
  });
  $('review-tools').insertBefore(button,$('capture'));
}
if(query.has('review')&&query.get('composition')!=='xianfaqiao')for(const [label,position,target]of [
  ['方外观庭院 / Fangwaiguan court',[-33,25,53],[0,5,16]],
  ['方外观桥渠 / Fangwaiguan bridge',[-7,3.5,11],[0,.1,17]],
  ['方外观圆池 / Fangwaiguan basin',[3.7,1.9,22.6],[0,-.2,25]],
  ['方外观池壁 / Fangwaiguan inner wall',[.3,.1,24.4],[1.96,-.5,25]],
]){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.addEventListener('click',()=>{
    if(!ready||loading||capturing)return;
    const site=museumSite('fangwaiguan');
    if(!residents?.get(site.id)&&currentSite?.id!==site.id){message('尚未载入方外观 / Fangwaiguan is not loaded.');return;}
    setReviewPaused(true);plantingReview=null;
    const p=sitePoint(site,position),t=sitePoint(site,target);controls.minDistance=.35;camera.position.set(p.x,p.y,p.z);controls.target.set(t.x,t.y,t.z);
    controls.update();redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
  });
  $('review-tools').insertBefore(button,$('capture'));
}
if(query.has('review')){
  const exportGround=document.createElement('button');exportGround.type='button';exportGround.hidden=query.get('composition')==='xianfaqiao';exportGround.textContent='导出岸边实际地形 / Export shore terrain';
  exportGround.addEventListener('click',async()=>{
    if(shoreBank?.adapter.active){message('当前含独立新岸线；其原面、替换面与支撑身份记录在岸线诊断中，不能导出为旧原面快照。',10);return;}
    if(!ready||loading||capturing||disposed)return;
    setReviewPaused(true);capturing=true;exportGround.disabled=true;syncControls();
    try{
      const {captureTerrainRegions}=await import('./terrain-region-export.js');
      const {default:request}=await import('./xianfa-terrain-capture-request.json');controller.signal.throwIfAborted();
      if(!redraw.flush())throw new Error('A live rendered terrain is required.');
      const data=captureTerrainRegions(terrain,{...request,sourceIdentity:sourceTag});
      data.requestLimits=request.limits;
      data.livePilot={diagnostics:plantingPilot?.diagnostics??null,parts:(plantingPilot?.parts??[]).map(part=>({name:part.name,placementId:part.userData.placementId,species:part.userData.species,worldMatrix:part.matrixWorld.toArray()}))};
      data.scene={site:currentSite?.id,sourceTag,residentBuildings:residents?.snapshot??null,preparedGround:preparedGroundSources?.snapshot??null};
      const name=`terrain-regions-${sourceTag}-${Date.now()}.json`,response=await fetch(`/__review_capture/${name}`,{method:'POST',body:JSON.stringify(data),signal:controller.signal});
      if(!response.ok)throw new Error(`Terrain capture HTTP ${response.status}`);
      message(`已保存实际地形 / Saved ${name}`,15);
    }catch(error){if(!disposed)message(error.message,15);}
    finally{capturing=false;exportGround.disabled=false;syncControls();}
  });
  $('review-tools').insertBefore(exportGround,$('capture'));
  const reflectionSelect=document.createElement('select');reflectionSelect.setAttribute('aria-label','水面反射范围 / Reflection region');
  for(const [value,label]of [['full','完整反射视野 / Full view'],['crop','水面实际取样区域 / Sampled water region']]){const option=document.createElement('option');option.value=value;option.textContent=label;reflectionSelect.append(option);}
  reflectionSelect.value=query.get('reflectioncrop')==='1'?'crop':'full';
  reflectionSelect.addEventListener('change',()=>{if(!water)return;setReviewPaused(true);water.setReflectionCropEnabled(reflectionSelect.value==='crop');redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);});
  $('review-tools').insertBefore(reflectionSelect,$('capture'));
  if(query.get('batch')==='2'){
    const cullingSelect=document.createElement('select');cullingSelect.setAttribute('aria-label','完整几何裁剪 / Full geometry culling');
    for(const [value,label]of [['stock','Three 原始裁剪 / Stock'],['3','分层裁剪 · 3 视图 / Hierarchy 3'],['8','分层裁剪 · 8 视图 / Hierarchy 8']]){const option=document.createElement('option');option.value=value;option.textContent=label;cullingSelect.append(option);}
    cullingSelect.value=cullingMode;
    cullingSelect.addEventListener('change',async()=>{
      if(loading){cullingSelect.value=cullingMode;return;}
      cullingMode=cullingSelect.value;
      const resource=sites?.resource;if(!resource?.diagnostics.multiDrawBatch?.applied)return;
      setReviewPaused(true);cullingSelect.disabled=true;
      try{
        resource.culling?.dispose();resource.culling=null;
        if(cullingMode!=='stock'){
          const next=await attachMuseumMultiDrawCulling(resource.group,{signal:controller.signal,viewCacheSize:Number(cullingMode)});
          if(disposed||sites.resource!==resource){next.dispose();return;}resource.culling=next;
        }
        redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
      }catch(error){if(!disposed){if(sites.resource===resource){cullingMode='stock';cullingSelect.value=cullingMode;redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);}message(error.message,10);}}
      finally{cullingSelect.disabled=false;}
    });
    $('review-tools').insertBefore(cullingSelect,$('capture'));
  }
  const select=document.createElement('select');select.setAttribute('aria-label','草地材质对照 / Ground material');
  for(const [value,label]of [['baseline','原材质 / Baseline'],['normal-off','只取消法线 / Normal off'],['matte','只改粗糙度 / Matte'],['scale15','只改为 15 米尺度 / Scale 15 m'],['matte-scale15','粗糙度与 15 米尺度 / Matte + scale'],['dry-scale15','干草贴图与合理尺度 / Dry meadow'],['dry-scale15-normal-off','当前草地取消法线 / Dry without normals'],['dry-scale15-no-shadows','当前草地取消接收阴影 / Dry without shadows'],['dry-scale15-color-off','当前草地取消颜色贴图 / Dry without color map'],['dry-scale15-flat','草地仅保留顶点颜色 / Ground vertex color only']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  select.value=groundReview;
  if(['r1','r2','r3','r4'].includes(query.get('bank'))){select.disabled=true;select.title='新岸线审查固定使用完整 4K 地面材质';}
  const applyGroundReview=()=>{
    if(!groundTextures||!terrain)return;const material=terrain.earthMaterial;
    const dry=groundReview.startsWith('dry-'),flat=groundReview==='dry-scale15-flat';
    material.map=flat||groundReview.endsWith('color-off')?null:groundTextures.map;
    material.normalScale.setScalar(flat||groundReview.endsWith('normal-off')?0:.42);material.roughness=dry?.98:.96;material.roughnessMap=flat||groundReview.startsWith('matte')?null:groundTextures.roughnessMap;material.userData.gardenDryRoughness=dry;
    scene.traverse(mesh=>{if(mesh.isMesh&&mesh.material===material)mesh.receiveShadow=!groundReview.endsWith('no-shadows');});
    for(const key of ['map','normalMap','roughnessMap'])groundTextures[key].repeat.setScalar(groundReview.includes('scale15')?5/6:5);
    material.needsUpdate=true;redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
  };
  select.addEventListener('change',()=>{if(['r1','r2','r3','r4'].includes(query.get('bank'))){select.value=groundReview;return;}groundReview=select.value;applyGroundReview();});$('review-tools').insertBefore(select,$('capture'));
  const resolutionSelect=document.createElement('select');resolutionSelect.setAttribute('aria-label','草地贴图分辨率 / Ground texture resolution');
  for(const [value,label]of [['1k','原 1K 贴图 / Original 1K'],['4k','4K 无损贴图 / Lossless 4K']]){const option=document.createElement('option');option.value=value;option.textContent=label;resolutionSelect.append(option);}
  resolutionSelect.value=groundTextures?.resolution||'4k';
  if(['r1','r2','r3','r4'].includes(query.get('bank'))){resolutionSelect.disabled=true;resolutionSelect.title='新岸线借用这组完整 4K 贴图';}
  resolutionSelect.addEventListener('change',async()=>{
    if(['r1','r2','r3','r4'].includes(query.get('bank'))){resolutionSelect.value=groundTextures?.resolution||'4k';return;}
    if(!groundTextures||!terrain||!ready||loading||capturing){resolutionSelect.value=groundTextures?.resolution||'1k';return;}
    if(resolutionSelect.value===groundTextures.resolution)return;
    setReviewPaused(true);resolutionSelect.disabled=true;select.disabled=true;$('capture').disabled=true;
    const previous=groundTextures;let next=null,committed=false;
    try{
      next=await loadGardenGroundTextures({resolution:resolutionSelect.value,signal:controller.signal});
      if(disposed){next.dispose();return;}
      groundTextures=next;applyGardenGroundTextures(terrain.earthMaterial,next);applyGroundReview();
      if(!redraw.flush())throw new Error('The new ground material could not produce a fresh frame.');
      committed=true;
      message(lang==='zh'?'草地贴图已切换，机位与光照保持不变。':'Ground textures changed; camera and light remain fixed.');
    }catch(error){
      if(!disposed){groundTextures=previous;applyGardenGroundTextures(terrain.earthMaterial,previous);applyGroundReview();message(error.message,10);}
    }finally{
      try{if(committed)previous.dispose();else next?.dispose();}
      catch(error){if(!disposed)message(error.message,10);}
      finally{if(!disposed){resolutionSelect.value=groundTextures.resolution;resolutionSelect.disabled=false;select.disabled=false;$('capture').disabled=false;}}
    }
  });$('review-tools').insertBefore(resolutionSelect,$('capture'));
}
for(const button of document.querySelectorAll('[data-review-drive]'))button.addEventListener('click',()=>{
  if(!ready||loading||capturing||state.mode!=='grounded'||state.transition){message(lang==='zh'?'先在安全地面降落，再检查步行。':'Land on safe ground before reviewing locomotion.');return;}
  reviewMotion={name:button.dataset.reviewDrive,duration:Number(button.dataset.duration)||2,from:{...state.position},elapsed:0,pathDistance:0};reviewMotionResult=null;reviewFramesRemaining=0;frameSamples.length=0;setReviewPaused(false);
});
if(reviewPaused){$('review-tools').open=true;$('review-pause').textContent='继续动画 / Resume';$('review-pause').setAttribute('aria-pressed','true');}
$('capture').addEventListener('click',async()=>{
  if(!ready||capturing||disposed)return;capturing=true;$('capture').disabled=true;document.body.dataset.capturing='true';syncControls();cancelAnimationFrame(raf);raf=0;keys.clear();touch.clear();
  try{if(!redraw.flush())throw new Error('The scene is not available for a fresh native frame.');const frame=readNativeFrame(renderer,canvas),data=evidence({full:true});data.capture={readback:frame.readback,width:frame.width,height:frame.height};const name=`museum-world-${sourceTag}-${currentSite.id}-${Date.now()}-${++serial}`,json=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const blob=await encodeNativeFrame(frame);if(disposed)throw new Error('No native frame');
    for(const [ext,body]of [['png',blob],['json',json]]){const response=await fetch(`/__review_capture/${name}.${ext}`,{method:'POST',body,signal:controller.signal});if(!response.ok)throw new Error(`Capture HTTP ${response.status}`);}message(`已保存 / Saved ${name}.png + JSON`,10);
  }catch(error){if(!disposed)message(error.message,10);}finally{capturing=false;$('capture').disabled=false;document.body.dataset.capturing='false';syncControls();start();}
});
function dispose(){
  if(disposed)return;disposed=true;
  const errors=[],previousCompositionCleanup=composition?.cleanupError;
  for(const release of [()=>redraw.dispose(),releaseSceneJiuzhouDependents,()=>westernPlantingLifetime?.abort(),()=>westernPlanting?.dispose(),()=>controller.abort(),()=>keys.clear(),()=>cancelAnimationFrame(raf),()=>observer.disconnect(),
    ()=>document.removeEventListener('keydown',keydown),()=>document.removeEventListener('keyup',keyup),()=>removeEventListener('blur',clearKeys),
    ()=>reader.dispose(),()=>directory.dispose(),()=>audio.dispose(),()=>sites?.dispose(),()=>westernPlanting?.dispose(),()=>composition?.dispose(),
    ()=>plantingCollisions?.dispose(),()=>shoreCommunity?.dispose(),()=>shoreBank?.dispose(),()=>shoreUnderstory?.dispose(),()=>plantingPilot?.dispose(),()=>residentArchitecture?.dispose(),()=>residents?.dispose(),()=>preparedGroundSources?.dispose(),()=>terrainAssets?.dispose(),()=>{if(!composition)architecture?.dispose();},
    ()=>pool?.dispose(),()=>visitor?.dispose(),()=>water?.dispose(),()=>terrain?.dispose(),()=>groundTextures?.dispose(),()=>environment?.dispose(),
    ()=>controls?.dispose(),()=>rendering?.dispose(),()=>renderer?.dispose()])try{release();}catch(error){errors.push(error);}
  // Abort listeners contain their exceptions; collect a failure from this
  // disposal before the subsequent idempotent composition.dispose() hides it.
  const compositionCleanup=composition?.cleanupError;
  if(compositionCleanup&&compositionCleanup!==previousCompositionCleanup&&!errors.includes(compositionCleanup))errors.push(compositionCleanup);
  document.body.dataset.ready='disposed';if(errors.length)console.error(new AggregateError(errors,'Museum scene cleanup failed'));
}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
setLanguage(lang);
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.info.autoReset=false;rendering=createRendering(renderer,scene,camera,{clipBox:new THREE.Box3(new THREE.Vector3(-1800,-40,-1500),new THREE.Vector3(1800,450,1500))});rendering.setQuality('high');
  controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=4;controls.maxDistance=3200;controls.minPolarAngle=.04;controls.maxPolarAngle=Math.PI*.87;controls.addEventListener('change',()=>{if(paused())redraw.request();});
  resize();busy(true,copy[lang].terrain);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));controller.signal.throwIfAborted();
  await prepareMuseumGround();controller.signal.throwIfAborted();
  terrain=createGardenTerrain({layout:gardenLayout,coastline:createExhibitionCoast(gardenLayout),assetCourts:composition?terrainCourts:[...museumCourts(),...terrainCourts],assetPads:terrainPads,assetPaths:terrainPaths,replacements:terrainReplacements});scene.add(terrain.group);nav=createMuseumNavigation({terrain,architecture:()=>architecture,dynamicColliders:()=>[...(guides?.colliders||[]),...(currentPlantingCollision()?.dynamicColliders()||[])]});
  terrainAssets=createMuseumTerrainAssets({terrain,replacements:terrainReplacements});
  groundTextures=await loadGardenGroundTextures({resolution:'4k',signal:controller.signal});applyGardenGroundTextures(terrain.earthMaterial,groundTextures);
  water=createGardenWater({terrain,layout:gardenLayout});water.setReflectionCropEnabled(query.get('reflectioncrop')==='1');scene.add(water.group);composition?.bindWater({terrain,water});environment=await createGardenEnvironment({renderer,scene,signal:controller.signal,timeMode:'auto',lightYaw:query.get('composition')==='xianfaqiao'&&query.get('court')==='garden-r4'?-120:0});
  busy(true,copy[lang].visitor);visitor=await createMuseumVisitor({signal:controller.signal});scene.add(visitor.group);pool=await createMuseumGuidePool({signal:controller.signal});
  sites=createMuseumSiteController({sites:composition?.sites??museumSites,signal:controller.signal,load:async(site,{signal})=>{
    if(composition){const resource=await composition.borrow(site.id,{signal});borrowedOwners.add(resource);return resource;}
    if(residents?.get(site.id)){
      const resource=await residents.borrow(site.id,{signal});borrowedOwners.add(resource);return resource;
    }
    const resource=await loadSceneBuilding(site.assetId,{signal});
    placeMuseumLandscapeAsset(resource,site);
    return prepareMuseumRendering(resource,site.assetId,signal);
  },release:resource=>{
    if(borrowedOwners.delete(resource)){(composition??residents).release(resource);return;}
    try{resource.group.removeFromParent();}finally{resource.dispose();}
  },mount:(resource,site)=>{
    const retained=borrowedOwners.has(resource),resident=retained?(composition?composition.get(site.id):residentBindings.get(resource)):null;
    let surface=null,moundBinding=null,combined=null,unbind=()=>{};
    try{
      if(retained){
        if(!resident||resident.support.disposed)throw new Error('The retained building has no live source navigation support.');
        surface=resident.support;combined=composition?.support??residentArchitecture;
      }else{
        if(site.assetId==='xianfashan'){moundBinding=createMoundGroundMaterialBinding({resource,terrain,assetId:site.assetId,signal:controller.signal});resource.diagnostics={...resource.diagnostics,moundGroundBinding:moundBinding.snapshot};}
        scene.add(resource.group);surface=createArchitectureSurface(resource.collisionGroup??resource.group,{signal:controller.signal});
        unbind=terrainAssets.attach({site,owner:resource,support:surface,role:'primary'});
        const neighbours=[...residentBindings.values()].filter(record=>record.descriptor.id!==site.id);
        combined=neighbours.length?createArchitectureEnsemble([...neighbours,{id:site.id,support:surface}]):surface;
      }
      architecture=combined;
      return ()=>{
        const retainGuides=retained&&composition&&guides?.isMuseumGuideEnsemble;
        const previousGuides=retainGuides?null:guides,previousGuideSurface=retainGuides?null:guideSurface;
        if(!retainGuides){guides=null;guideSurface=null;}if(architecture===combined)architecture=composition?.support??residentArchitecture;
        const errors=[];for(const release of [()=>previousGuides?.dispose(),()=>previousGuideSurface?.dispose(),unbind,
          ()=>{if(!retained&&combined!==surface)combined?.dispose();},()=>{if(!retained)surface.dispose();},()=>moundBinding?.dispose()])try{release();}catch(error){errors.push(error);}
        if(errors.length)throw new AggregateError(errors,'Museum site cleanup failed');
      };
    }catch(error){
      try{unbind();}finally{try{if(!retained){if(combined!==surface)combined?.dispose();surface?.dispose();}}finally{moundBinding?.dispose();if(!retained)resource.group.removeFromParent();}}
      throw error;
    }
  }});
  const sceneResidentDescriptors=composition?[]:museumResidentCatalog.filter(entry=>query.get('resident')!=='0'||entry.requiresPreparedGround);
  if(sceneResidentDescriptors.length&&!disposed){
    busy(true,copy[lang].building);
    residents=createMuseumResidentBuildings({root:scene,descriptors:sceneResidentDescriptors.map(entry=>({...entry,site:museumSite(entry.id)})),siteController:sites,signal:controller.signal,loadFull:async(descriptor,{signal})=>{
      const resource=preparedGroundSources?.has(descriptor.id)?preparedGroundSources.take(descriptor.id):await loadSceneBuilding(descriptor.assetId,{signal,manifestURL:descriptor.source.manifestURL,expectedManifestSHA256:descriptor.source.approvedManifestSHA256});
      placeMuseumLandscapeAsset(resource,descriptor.site);
      return query.get('batch')==='2'?prepareMuseumRendering(resource,descriptor.assetId,signal):createMuseumStaticBatch(resource,{id:descriptor.assetId,signal});
    },mountFull:(resource,descriptor)=>{
      let moundBinding=null,surface=null,unbind=()=>{};
      try{
        if(descriptor.assetId==='xianfashan'){moundBinding=createMoundGroundMaterialBinding({resource,terrain,assetId:descriptor.assetId,signal:controller.signal});resource.diagnostics={...resource.diagnostics,moundGroundBinding:moundBinding.snapshot};}
        surface=createArchitectureSurface(resource.collisionGroup??resource.group,{signal:controller.signal});
        unbind=terrainAssets.attach({site:descriptor.site,owner:resource,support:surface,role:'resident'});
        residentBindings.set(resource,{descriptor,owner:resource,support:surface});
        return ()=>{residentBindings.delete(resource);try{unbind();}finally{try{surface.dispose();}finally{moundBinding?.dispose();}}};
      }catch(error){try{unbind();}finally{try{surface?.dispose();}finally{moundBinding?.dispose();}}throw error;}
    }});
    await residents.load();controller.signal.throwIfAborted();
    for(const descriptor of sceneResidentDescriptors.filter(entry=>entry.requiresPreparedGround)){
      const retained=residents.get(descriptor.id),binding=retained&&residentBindings.get(retained.owner);
      if(!retained||retained.owner.disposed||retained.owner.group.parent!==scene||!binding||binding.support.disposed){
        const failure=residents.snapshot.full.find(record=>record.id===descriptor.id)?.error;
        throw new Error(`The prepared courtyard has no retained building and live support: ${descriptor.id}${failure?` (${failure})`:''}`);
      }
    }
    if(residentBindings.size){residentArchitecture=createArchitectureEnsemble([...residentBindings.values()]);architecture=residentArchitecture;}
  }
  if(isJiuzhouComposition()){await prepareSceneJiuzhouShoreGrove();controller.signal.throwIfAborted();}
  if(composition&&query.get('composition')==='xianfaqiao'&&query.get('planting')==='western'){await prepareSceneWesternPlanting();controller.signal.throwIfAborted();}
  if(!composition&&query.get('planting')==='pilot'){
    try{
    busy(true,lang==='zh'?'正在准备柳树、圆柏与湖石…':'Preparing willows, clipped junipers and garden stones…');
    const planting=await import('./museum-planting-pilot.js');controller.signal.throwIfAborted();
    const stonePixels=await planting.prepareMuseumPlantingPilotAssets({signal:controller.signal});
    plantingPilot=await planting.createMuseumPlantingPilot({terrain,layout:gardenLayout,stonePixels,signal:controller.signal});
    if(['1','r2'].includes(query.get('shore'))){
      const {createGardenUnderstoryStudy}=await import('./garden-understory-study.js');controller.signal.throwIfAborted();
      shoreUnderstory=createGardenUnderstoryStudy({arrangement:'specimens',signal:controller.signal});
      const createCommunity=query.get('shore')==='r2'?(await import('./xianfa-shore-community-prepared.js')).createXianfaShoreCommunityPrepared:(await import('./xianfa-shore-community.js')).createXianfaShoreCommunity;
      shoreCommunity=await createCommunity({terrain,plantingPilot,understoryOwner:shoreUnderstory,stonePixels,garden:gardenLayout,signal:controller.signal,
        onProgress:({completed,total})=>busy(true,lang==='zh'?`正在安置湖岸植物与卧石… ${completed} / ${total}`:`Placing lakeside plants and stones… ${completed} / ${total}`),
      });
      controller.signal.throwIfAborted();scene.add(shoreCommunity.group);shoreCommunity.collisionSources.group.updateWorldMatrix(true,true);
    }
    const {createMuseumPlantingColliders}=await import('./museum-planting-colliders.js');controller.signal.throwIfAborted();
    const collisionSource=shoreCommunity?{group:plantingPilot.group,parts:[...plantingPilot.parts,...shoreCommunity.collisionSources.parts]}:plantingPilot;
    plantingCollisions=createMuseumPlantingColliders(collisionSource,{terrain,signal:controller.signal});
    scene.add(plantingPilot.group);
    const plantingViews=[...plantingPilot.views,...(shoreCommunity?[
      {id:'shore-whole',label:'两柳与湖岸伴生群落',groups:[shoreCommunity.group.name,...shoreCommunity.contextGroups.map(group=>group.name)],direction:[-.32,.34,1],padding:1.05},
      {id:'shore-low',label:'湖岸植物近地视角',groups:[shoreCommunity.group.name],direction:[-.25,.16,1],padding:1.10},
    ]:[])];
    if(query.has('review'))for(const view of plantingViews){
      const button=document.createElement('button');button.type='button';button.textContent=`植被 / ${view.id}`;button.title=view.label;
      button.addEventListener('click',()=>{
        if(!ready||loading||capturing)return;
        const box=new THREE.Box3();
        for(const name of view.groups){const object=plantingPilot.group.getObjectByName(name)??shoreCommunity?.group.getObjectByName(name);if(!object){message(`Missing planting view object: ${name}`);return;}box.expandByObject(object);}
        if(box.isEmpty())return;
        setReviewPaused(true);
        const sphere=box.getBoundingSphere(new THREE.Sphere()),halfFov=Math.min(THREE.MathUtils.degToRad(camera.getEffectiveFOV())*.5,Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV())*.5)*camera.aspect));
        controls.target.copy(sphere.center);camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3().fromArray(view.direction).normalize(),sphere.radius/Math.sin(halfFov)*(view.padding||1.1));controls.update();
        plantingReview={id:view.id,label:view.label,groups:view.groups,bounds:{min:box.min.toArray(),max:box.max.toArray()},scope:'full world; no surrounding objects hidden'};
        redraw.request();$('telemetry').textContent=JSON.stringify(evidence(),null,2);
      });
      $('review-tools').insertBefore(button,$('capture'));
    }
    }catch(error){
      const owned=[plantingCollisions,shoreCommunity,shoreUnderstory,plantingPilot],errors=[error];
      plantingCollisions=null;shoreCommunity=null;shoreUnderstory=null;plantingPilot=null;
      for(const resource of owned)try{resource?.dispose();}catch(cleanup){errors.push(cleanup);}
      if(errors.length>1)throw new AggregateError(errors,'Museum planting preparation and cleanup failed',{cause:error});
      throw error;
    }
  }
  if(!composition&&['r1','r2','r3','r4'].includes(query.get('bank'))){await prepareSceneShoreBank();controller.signal.throwIfAborted();}
  if(composition&&query.get('composition')==='xianfaqiao'&&query.has('review'))prepareCompositionReview();
  busy(false);await visit(composition?(composition.sites.find(site=>site.id===query.get('site'))?.id??composition.sites[0].id):(museumSite(query.get('site'))?.id||'yuanyingguan'));
  if(composition&&!ready&&!disposed)throw new Error('The composed site could not mount its retained source and guides.');
  if(!disposed&&ready)message(copy[lang].ready,6);
}catch(error){if(!disposed){const cleanupErrors=composition?releaseCompositionScene():[];sceneFailure={message:error.message,...(cleanupErrors.length?{cleanupErrors:cleanupErrors.map(error=>error.message)}:{}),plantingPlan:error.plan??null,shorePlacement:error.diagnostics??error.cause?.diagnostics??null};ready=false;busy(false);if(contextLost)showGraphicsRecovery();else{document.body.dataset.ready='failed';$('loading').hidden=false;$('loading-copy').textContent=`${copy[lang].failed} ${error.message}`;}$('telemetry').textContent=JSON.stringify(evidence(),null,2);console.error(error);}}
