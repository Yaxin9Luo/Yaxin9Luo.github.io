import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createMuseumNavigation} from '../src/yuanmingyuan/visitor-motion.js';
import {applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {shoreBankStudyViews} from '../src/yuanmingyuan/shore-bank-study-views.js';
import {setWillowSampling} from '../src/yuanmingyuan/willow-distance-sampling.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

// Execute current page functions, handlers and the complete planting-to-visit
// tail. Replace browser IO and asset factories with tiny real Three owners.
// This tests page integration, not native pixels or a full shore factory.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const sceneSHA256=createHash('sha256').update(source).digest('hex');
const unimport=text=>text.replaceAll(/\bimport\(/g,'injectedImport(');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Actual scene section: '+start);return source.slice(a,b);}
const plantingCollision=section('function currentPlantingCollision(){','\nasync function prepareSceneShoreBank(');
const prepare=unimport(section('async function prepareSceneShoreBank(){','\nfunction placeMuseumLandscapeAsset'));
const visit=section('function createGuideRegion(','\nfunction advance(dt)');
const frame=section('function frameVisitor(){','\nfunction inspect()');
const pause=section('function setReviewPaused(value){',"\n$('review-pause').addEventListener");
const evidence=section('function evidence({full=false}={}){','\nfunction render(dt)');
const dispose=section('function releaseSceneGuides(){','\nfunction releaseCompositionScene(')+'\n'+section('function dispose(){',"\naddEventListener('pagehide'");
const branchStart=source.indexOf("  if(!composition&&query.get('planting')==='pilot'){");
const bootstrapTail=unimport(source.slice(branchStart));
const controlsBlock=section("  const select=document.createElement('select');select.setAttribute('aria-label','草地材质对照 / Ground material');","\n}\nfor(const button of document.querySelectorAll('[data-review-drive]'))");
const exportBlock=unimport(section("  const exportGround=document.createElement('button');","\n  const reflectionSelect="));
const captureBlock=section("$('capture').addEventListener('click',async()=>{",'\nfunction dispose()');
const initialGround=section("  groundTextures=await loadGardenGroundTextures({resolution:'4k'",'\n  water=createGardenWater(');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

function harness({bank=true,late=null,failPrepared=false,failBank=false,failWaterCleanup=false,walkableBank=false}={}){
  const events=[],errors=[],messages=[],uploads=[],buttons=[],selects=new Map(),nodes=new Map(),owners=[],resources=[];
  const gate=deferred(),entered=deferred(),scene=new THREE.Scene(),controller=new AbortController();
  const marker=new THREE.Group();marker.name='unrelated-world';scene.add(marker);
  function node(id){if(!nodes.has(id))nodes.set(id,{disabled:false,handlers:{},textContent:'',setAttribute(){},addEventListener(type,handler){this.handlers[type]=handler;},insertBefore(button){buttons.push(button);}});return nodes.get(id);}
  function track(resource){const row={resource,releases:0};resource.addEventListener('dispose',()=>row.releases++);resources.push(row);return resource;}
  function plane(y,name){const geometry=track(new THREE.BufferGeometry());geometry.name=name;geometry.setAttribute('position',new THREE.Float32BufferAttribute([830,y,-583,870,y,-583,870,y,-543,830,y,-543],3));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();return geometry;}
  const material=track(new THREE.MeshStandardMaterial({vertexColors:true})),maps=Object.fromEntries(['map','normalMap','roughnessMap'].map(key=>[key,track(new THREE.Texture())]));
  let textureReleases=0,terrainDisposed=false;
  const textures={...maps,resolution:'4k',source:{assetId:'fixture-meadow-4k'},files:{color:{sha256:'fixture-color-identity'}},dispose(){if(textureReleases)return;textureReleases++;events.push('textures');for(const map of Object.values(maps))map.dispose();}};
  applyGardenGroundTextures(material,textures);
  const geometry=plane(0,'fixture-original-bed'),originalSampler=createTriangleSampler([geometry],32),terrainGroup=new THREE.Group();
  terrainGroup.name='fixture-terrain';terrainGroup.add(new THREE.Mesh(geometry,material));scene.add(terrainGroup);
  const originalSurface=(x,z,{maxY=Infinity}={})=>{const hit=originalSampler.sample(x,z,maxY);return hit?{...hit,kind:'lake-bed',walkable:false,waterY:2,supportSource:'terrain-triangle'}:null;};
  const terrain={group:terrainGroup,earthMaterial:material,colliders:[],replacementStates:[],diagnostics:{fixture:true},surfaceAt:originalSurface,
    createGuideSupport(){const sample=(x,z)=>terrain.surfaceAt(x,z);let disposed=false;return {sample,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;events.push('local-query');}};},
    get disposed(){return terrainDisposed;},dispose(){if(terrainDisposed)return;terrainDisposed=true;events.push('terrain');originalSampler.dispose();geometry.dispose();material.dispose();terrainGroup.removeFromParent();},
  };
  const nav=createMuseumNavigation({terrain});
  function smallOwner(id){
    const group=new THREE.Group();group.name=id;const geo=track(new THREE.BoxGeometry(.1,.1,.1)),mesh=new THREE.Mesh(geo,material);if(id==='pilot')mesh.userData.species='lake-rock';group.add(mesh);let disposed=false;
    const owner={group,parts:[mesh],views:[],get disposed(){return disposed;},diagnostics:{id,fixture:true,plan:{placements:[]},rootContacts:[],placements:[],counts:{},trianglesPerPass:12,drawMeshes:1,ownedInstanceBufferBytes:0},dispose(){if(disposed)return;disposed=true;events.push(id);group.removeFromParent();geo.dispose();}};owners.push(owner);return owner;
  }
  let bankOwner=null,bankAllocations=0,loads=0,renders=0,reads=0,exportImports=0,encoder=async()=>new Blob(['fixture pixels'],{type:'image/png'});
  function tinyBank(signal){
    bankAllocations++;events.push('bank-activate');assert.equal(terrain.disposed,false);
    const group=new THREE.Group();group.name='fixture-new-bank';const geo=plane(walkableBank?2.2:1.4,'fixture-new-bed'),sampler=createTriangleSampler([geo],32);
    const fineMaterial=bank==='r4'?track(material.clone()):material,mesh=new THREE.Mesh(geo,fineMaterial);if(bank==='r4')mesh.name='shore-bank-r4-fine-ground';group.add(mesh);terrainGroup.add(group);
    let disposed=false;const snapshot={active:true,fixture:true,state:'active',verifiedOriginalFaces:2};
    terrain.surfaceAt=(x,z,{maxY=Infinity}={})=>{const hit=sampler.sample(x,z,maxY);return hit?{...hit,kind:walkableBank?'land':'lake-bed',walkable:walkableBank,waterY:2,supportSource:'shore-bank-triangle'}:null;};
    const owner={group,views:shoreBankStudyViews,adapter:{get active(){return snapshot.active;},get snapshot(){return snapshot;}},
      get diagnostics(){return {id:'shore-bank-r1',fixture:true,sourceSHA:'fixture-snapshot-sha',sourceIdentity:'fixture-original-three-window-identity',sourceProbeCount:3,adapter:snapshot,nativeReviewed:false,productionApproved:false};},
      get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;signal.removeEventListener('abort',owner.dispose);events.push('bank-adapter');snapshot.active=false;snapshot.state='disposed';terrain.surfaceAt=originalSurface;group.removeFromParent();sampler.dispose();events.push('bank-study');geo.dispose();if(fineMaterial!==material)fineMaterial.dispose();},
    };signal.addEventListener('abort',owner.dispose,{once:true});bankOwner=owner;return owner;
  }
  const site={id:'fixture-site',entryId:'fixture-entry',position:[925,4,-640],arrival:[-46,8,0],focus:[0,8,0],guide:[-42,.04,0],viewYaw:-Math.PI/2};
  const ctx={composition:null,westernPlanting:null,westernPlantingLifetime:null,THREE,Blob,Date,controller,scene,terrain,nav,sourceTag:'fixture-scene',query:new URLSearchParams('review=still&planting=pilot&shore=r2&site=fixture-site'+(bank?'&bank='+(typeof bank==='string'?bank:'r1'):'')),
    lang:'zh',ready:false,loading:true,capturing:false,disposed:false,contextLost:false,reviewPaused:true,reviewFramesRemaining:0,reviewMotion:null,reviewMotionResult:null,raf:0,last:0,serial:0,frameSamples:[],
    gardenLayout:{fixture:true},plantingPilot:null,plantingCollisions:null,plantingReview:null,shoreCommunity:null,shoreUnderstory:null,shoreBank:null,sceneFailure:null,architecture:null,guides:null,guideSurface:null,
    residentArchitecture:null,residents:null,preparedGroundSources:null,terrainAssets:null,pool:{dispose(){}},visitor:{group:new THREE.Group(),dispose(){}},currentSite:null,
    groundTextures:textures,groundReview:'dry-scale15',environment:{clock:{mode:'auto',phase:.46},dispose(){}},rendering:{samples:4,dispose(){}},renderer:{getPixelRatio:()=>1,info:{render:{},memory:{}},extensions:{has:()=>false},dispose(){}},
    water:{snapshot:()=>({worldY:2}),dispose(){events.push('water');if(failWaterCleanup)throw new Error('fixture water cleanup failure');}},
    state:{mode:'flying',position:{x:0,y:12,z:0},heading:0,speed:0,gaitPhase:0},cameraMode:0,
    camera:new THREE.PerspectiveCamera(45,1.5,.08,22000),canvas:{width:3,height:2,clientWidth:3,clientHeight:2},
    controls:{target:new THREE.Vector3(),minDistance:4,update(){ctx.camera.updateMatrixWorld();if(ctx.paused())ctx.redraw.request();},dispose(){}},
    document:{hidden:false,body:{dataset:{ready:'loading'}},removeEventListener(){},createElement(){return {type:'',handlers:{},options:[],disabled:false,setAttribute(key,value){if(key==='aria-label')selects.set(value,this);},append(option){this.options.push(option);},addEventListener(type,handler){this.handlers[type]=handler;}};}},
    $:node,keys:new Set(),touch:{clear(){}},observer:{disconnect(){}},keydown(){},keyup(){},clearKeys(){},removeEventListener(){},
    reader:{isOpen:false,dispose(){}},directory:{dispose(){}},audio:{snapshot:()=>({}),setEmitter(){},dispose(){}},copy:{zh:{building:'building',failed:'failed',ready:'ready'}},
    message:(text)=>messages.push(text),console:{error:error=>errors.push(error)},busy(value){ctx.loading=value;},locationCaption(){},syncControls(){},showGraphicsRecovery(){},timingSummary:()=>({}),advance(){},resetCharacterMotion(){},museumTravelHeading:(x,z)=>Math.atan2(-x,-z),
    museumSite:id=>id===site.id?site:null,museumEntry:()=>({related:[]}),sitePoint:(s,p)=>({x:s.position[0]+p[0],y:s.position[1]+p[1],z:s.position[2]+p[2]}),
    createMuseumGuideWorld({terrain:actual}){events.push('guide-world');assert.equal(actual,terrain);const support=actual.createGuideSupport();return {support,placementReview:null,snapshot:()=>({fixture:true}),dispose:()=>support.dispose()};},
    selectMuseumGuidePlacements({world}){const hit=world.support.sample(850,-555);events.push('guide-hit-'+hit.supportSource);return {placements:[],rejected:[]};},
    createMuseumGuides(){throw new Error('No large guide factory is allowed');},museumVisitorCollider:()=>null,
    sites:{resource:{diagnostics:{fixture:true}},async select(){events.push('visit-select');return this.resource;},dispose(){}},
    render(){if(!ctx.ready||ctx.loading||ctx.disposed||ctx.contextLost||ctx.document.hidden)return false;renders++;return true;},
    applyGardenGroundTextures,setWillowSampling,willowSamplingProgramAudit:()=>[],async loadGardenGroundTextures(options){loads++;assert.equal(options.resolution,'4k');assert.equal(options.signal,controller.signal);return textures;},
    readNativeFrame(){reads++;return {readback:'fixture-CPU-no-GPU',width:3,height:2};},encodeNativeFrame:frame=>encoder(frame),fetch:async(url,options)=>{uploads.push({url,...options});return {ok:true};},
    async injectedImport(id){
      if(id==='./museum-planting-pilot.js')return {prepareMuseumPlantingPilotAssets:async()=>{events.push('planting-input');return {};},createMuseumPlantingPilot:async()=>{events.push('pilot-create');return smallOwner('pilot');}};
      if(id==='./garden-understory-study.js')return {createGardenUnderstoryStudy:()=>{events.push('understory-create');return smallOwner('understory');}};
      if(id==='./xianfa-shore-community-prepared.js')return {createXianfaShoreCommunityPrepared:async options=>{events.push('prepared-validate');assert.equal(options.terrain.surfaceAt,originalSurface);assert.equal(nav.flightSurfaceAt(850,-555).height,0);if(failPrepared)throw new Error('fixture original terrain signature mismatch');const owner=smallOwner('community');owner.collisionSources={group:new THREE.Group(),parts:[]};owner.contextGroups=[];events.push('prepared-mounted');return owner;}};
      if(id==='./museum-planting-colliders.js')return {createMuseumPlantingColliders:()=>{events.push('colliders-create');return {diagnostics:{solidCount:0,flightQueries:0,flightBlocked:0,initialOverlaps:[]},dispose(){events.push('colliders');}};}};
      if(id==='./shore-bank-integration.js'){
        events.push('bank-import');if(late==='import'){entered.resolve();await gate.promise;}
        return {loadShoreBankStudyR1:async options=>{options.signal.throwIfAborted();assert.equal(options.terrain,terrain);ctx.requestedBankOptions=options;if(failBank)throw new Error('fixture snapshot identity mismatch');const owner=tinyBank(options.signal);if(late==='owner'){entered.resolve();await gate.promise;}return owner;}};
      }
      exportImports++;throw new Error('Unexpected dynamic import '+id);
    },
  };
  vm.createContext(ctx);
  vm.runInContext([plantingCollision,prepare,frame,visit,pause,evidence,dispose,
    'function start(){redraw.sync();last=0;}',
    'this.bootstrap=async()=>{try{'+bootstrapTail+'};',
    'this.pageDispose=dispose;',
    'this.initializeGround=async()=>{'+initialGround+'};',
  ].join('\n'),ctx,{filename:'actual-shore-bank-scene-'+sceneSHA256.slice(0,12)+'.js'});
  const drawing=installSceneRedraw(ctx,source);
  vm.runInContext(captureBlock,ctx);
  return {ctx,terrain,nav,originalSurface,marker,buttons,selects,nodes,events,errors,messages,uploads,resources,owners,drawing,gate,entered,
    installGroundControls:()=>vm.runInContext(controlsBlock,ctx),installExport:()=>vm.runInContext(exportBlock,ctx),
    setEncoder:fn=>encoder=fn,save:()=>node('capture').handlers.click(),
    get bankOwner(){return bankOwner;},get bankAllocations(){return bankAllocations;},get loads(){return loads;},get renders(){return renders;},get reads(){return reads;},get exportImports(){return exportImports;},get textureReleases(){return textureReleases;},
    cleanup(){ctx.pageDispose();bankOwner?.dispose();drawing.dispose();},
  };
}

test('actual prepared planting finishes before shore activation, visit and guide queries; pre-existing navigation sees the new real plane',async t=>{
  const h=harness();t.after(()=>h.cleanup());const nav=h.nav,oldSample=h.terrain.createGuideSupport();t.after(()=>oldSample.dispose());
  assert.equal(nav.flightSurfaceAt(850,-555).height,0);await h.ctx.bootstrap();assert.equal(h.ctx.sceneFailure,null);assert.equal(h.ctx.ready,true);
  assert.deepEqual(h.events.slice(0,11),['planting-input','pilot-create','understory-create','prepared-validate','prepared-mounted','colliders-create','bank-import','bank-activate','visit-select','guide-world','guide-hit-shore-bank-triangle']);
  assert.equal(h.ctx.nav,nav);assert.equal(nav.flightSurfaceAt(850,-555).height,Math.fround(1.4));assert.equal(nav.surfaceAt(850,-555),null,'The new submerged bed stays non-walkable');
  assert.equal(oldSample.sample(850,-555).height,Math.fround(1.4));assert.equal(h.bankOwner.group.parent,h.terrain.group);assert.equal(h.marker.visible,true);assert.equal(h.textureReleases,0);
});

test('actual prepared validation failure prevents bank allocation and the first visit',async t=>{
  const h=harness({failPrepared:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.match(h.ctx.sceneFailure.message,/original terrain signature/);assert.equal(h.bankAllocations,0);assert(!h.events.includes('bank-import'));assert(!h.events.includes('visit-select'));assert.equal(h.ctx.shoreCommunity,null);assert.ok(h.owners.every(owner=>owner.disposed));assert.equal(h.terrain.surfaceAt,h.originalSurface);
});

test('actual bank identity failure cannot reach guides or report a ready page',async t=>{
  const h=harness({failBank:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.match(h.ctx.sceneFailure.message,/snapshot identity mismatch/);assert.equal(h.ctx.ready,false);assert.equal(h.ctx.document.body.dataset.ready,'failed');assert.equal(h.bankAllocations,0);assert(!h.events.includes('visit-select'));assert.equal(h.terrain.surfaceAt,h.originalSurface);
});

test('all five actual bank controls use frozen world cameras and coalesce controls-change plus explicit requests',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();h.drawing.frames.step();
  for(const [id,view] of Object.entries(shoreBankStudyViews)){
    const button=h.buttons.find(item=>item.textContent==='湖岸 / '+id);assert.ok(button);const renders=h.renders;button.handlers.click();
    assert.deepEqual(h.ctx.camera.position.toArray(),view.camera);assert.deepEqual(h.ctx.controls.target.toArray(),view.target);assert.equal(h.ctx.controls.minDistance,.05);assert.equal(h.ctx.plantingReview.id,'bank-'+id);assert.equal(h.ctx.plantingReview.worldContextRetained,true);assert.equal(h.marker.visible,true);
    assert.equal(h.renders,renders);assert.equal(h.drawing.frames.pending.length,1);h.drawing.frames.step();assert.equal(h.renders,renders+1);
    const telemetry=JSON.parse(h.nodes.get('telemetry').textContent);assert.deepEqual(telemetry.camera,view.camera);assert.equal(telemetry.shoreBank.adapter.active,true);
  }
});

test('actual initial ground load requests 4K, and both visible and programmatic bank review changes preserve borrowed maps',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.initializeGround();assert.equal(h.loads,1);await h.ctx.bootstrap();h.installGroundControls();
  const variant=h.selects.get('草地材质对照 / Ground material'),resolution=h.selects.get('草地贴图分辨率 / Ground texture resolution'),material=h.terrain.earthMaterial;
  assert.equal(variant.disabled,true);assert.equal(resolution.disabled,true);assert.equal(resolution.value,'4k');const before={map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,normalScale:material.normalScale.toArray(),repeat:material.map.repeat.toArray()};
  variant.value='dry-scale15-flat';variant.handlers.change();resolution.value='1k';await resolution.handlers.change();
  assert.equal(variant.value,'dry-scale15');assert.equal(resolution.value,'4k');assert.equal(h.loads,1);assert.equal(h.textureReleases,0);assert.equal(material.map,before.map);assert.equal(material.normalMap,before.normalMap);assert.equal(material.roughnessMap,before.roughnessMap);assert.deepEqual(material.normalScale.toArray(),before.normalScale);assert.deepEqual(material.map.repeat.toArray(),before.repeat);
});

test('actual active-bank old-terrain export is refused before import, redraw, readback or upload',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();h.installExport();const renders=h.renders;
  const button=h.buttons.find(item=>item.textContent==='导出岸边实际地形 / Export shore terrain');await button.handlers.click();
  assert.match(h.messages.at(-1),/不能导出为旧原面快照/);assert.equal(h.exportImports,0);assert.equal(h.renders,renders);assert.equal(h.reads,0);assert.equal(h.uploads.length,0);assert.equal(h.ctx.capturing,false);assert.equal(button.disabled,false);
});

test('actual native capture flushes the chosen world camera and freezes new support diagnostics before PNG encoding awaits',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();h.drawing.frames.step();const gate=deferred();h.setEncoder(()=>gate.promise);
  h.buttons.find(item=>item.textContent==='湖岸 / lip').handlers.click();const renders=h.renders,pending=h.save();assert.equal(h.renders,renders+1);assert.equal(h.drawing.frames.pending.length,0);assert.equal(h.reads,1);
  h.bankOwner.adapter.snapshot.state='later-state';h.ctx.camera.position.set(1,2,3);gate.resolve(new Blob(['CPU fixture PNG marker'],{type:'image/png'}));await pending;
  assert.equal(h.uploads.length,2);const data=JSON.parse(await h.uploads.find(item=>item.url.endsWith('.json')).body.text());assert.deepEqual(data.camera,shoreBankStudyViews.lip.camera);assert.deepEqual(data.target,shoreBankStudyViews.lip.target);assert.equal(data.shoreBank.adapter.state,'active');assert.equal(data.shoreBank.sourceIdentity,'fixture-original-three-window-identity');assert.equal(data.shoreBank.nativeReviewed,false);assert.equal(data.shoreBank.productionApproved,false);assert.equal(data.plantingReview.id,'bank-lip');assert.equal(data.groundReview.resolution,'4k');assert.equal(data.groundReview.sampling,'stock-lookup');assert.equal(data.capture.readback,'fixture-CPU-no-GPU');
});

test('actual pagehide abort restores bank queries before releasing borrowed terrain and textures; later owner cleanup is idempotent',async t=>{
  const h=harness({failWaterCleanup:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();const support=h.ctx.guideSurface.support;
  h.ctx.pageDispose();h.ctx.pageDispose();assert.equal(h.ctx.document.body.dataset.ready,'disposed');assert.equal(h.bankOwner.disposed,true);assert.equal(h.terrain.surfaceAt,h.originalSurface);assert.equal(support.disposed,true);assert.equal(h.textureReleases,1);
  for(const name of ['bank-adapter','bank-study','local-query','terrain','textures'])assert.equal(h.events.filter(event=>event===name).length,1,name);
  assert(h.events.indexOf('bank-adapter')<h.events.indexOf('bank-study'));assert(h.events.indexOf('bank-study')<h.events.indexOf('terrain'));assert(h.events.indexOf('local-query')<h.events.indexOf('terrain'));assert(h.events.indexOf('terrain')<h.events.indexOf('textures'));
  assert.ok(h.resources.every(row=>row.releases===1));assert.equal(h.errors.length,1);assert.equal(h.errors[0].name,'AggregateError');assert.match(h.errors[0].errors[0].message,/water cleanup/);assert.equal(h.drawing.frames.pending.length,0);
});

for(const late of ['import','owner'])test('actual pagehide during late bank '+late+' cannot mount controls, visit, or retain resources',async t=>{
  const h=harness({late});t.after(()=>h.cleanup());const pending=h.ctx.bootstrap();await h.entered.promise;h.ctx.pageDispose();h.gate.resolve();await pending;
  assert.equal(h.ctx.disposed,true);assert.equal(h.ctx.shoreBank,null);assert(!h.events.includes('visit-select'));assert(!h.events.includes('guide-world'));assert.ok(h.buttons.every(button=>!button.textContent.startsWith('湖岸 /')));assert.equal(h.errors.length,0);assert.equal(h.textureReleases,1);assert.equal(h.bankAllocations,late==='owner'?1:0);if(h.bankOwner)assert.equal(h.bankOwner.disposed,true);assert.ok(h.resources.every(row=>row.releases===1));
});

test('actual bank-absent tail retains old terrain and creates no bank controls or source owner',async t=>{
  const h=harness({bank:false});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.equal(h.ctx.ready,true);assert.equal(h.ctx.sceneFailure,null);assert.equal(h.bankAllocations,0);assert.equal(h.terrain.surfaceAt,h.originalSurface);assert.equal(h.nav.flightSurfaceAt(850,-555).height,0);assert(h.events.includes('guide-hit-terrain-triangle'));assert.ok(h.buttons.every(button=>!button.textContent.startsWith('湖岸 /')));assert.equal(h.ctx.evidence().shoreBank,null);
});

console.log(JSON.stringify({fixture:'actual scene shore integration; tiny real Three owners and original Float32 samplers',sceneSHA256,fullSourceFactories:0,rendererConstructed:false,GPUUsed:false}));


test('R4 page route waits for prepared planting and forwards continuous ground with the live photographic stone material',async t=>{
  const h=harness({bank:'r4'});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.equal(h.ctx.sceneFailure,null);assert.equal(h.ctx.ready,true);
  const request=h.ctx.requestedBankOptions,source=h.ctx.plantingPilot.parts.find(p=>p.userData.species==='lake-rock').material;
  assert.equal(request.bedProfile,'curved-r4');assert.equal(request.pebbleLayout,'drifts-r3');assert.equal(request.stoneMaterial,source);assert(request.stoneMaterial.map?.isTexture);
  assert(h.events.indexOf('prepared-mounted')<h.events.indexOf('bank-activate'));h.installGroundControls();assert(h.selects.get('草地材质对照 / Ground material').disabled);assert(h.selects.get('草地贴图分辨率 / Ground texture resolution').disabled);
});

test('shore sampling control preserves geometry and PBR while switching the actual shader qualifier, then reverses',async t=>{
  const h=harness({bank:'r4'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  const select=h.selects.get('岸坡边缘插值 / Shore edge sampling'),fine=h.bankOwner.group.getObjectByName('shore-bank-r4-fine-ground');
  assert.ok(select);assert.equal(select.value,'centroid');assert.equal(h.ctx.evidence().shoreSamplingReview.mode,'centroid');
  const materials=[h.terrain.earthMaterial,fine.material],before=materials.map(m=>({map:m.map,normalMap:m.normalMap,roughnessMap:m.roughnessMap,roughness:m.roughness,normal:m.normalScale.toArray()})),geometry=fine.geometry;
  select.value='pixel';select.handlers.change();assert.equal(h.ctx.evidence().shoreSamplingReview.mode,'pixel');
  select.value='centroid';select.handlers.change();assert.equal(h.ctx.evidence().shoreSamplingReview.mode,'centroid');
  for(const [i,m]of materials.entries()){
    const shader={vertexShader:'#include <color_pars_vertex>\n#include <normal_pars_vertex>',fragmentShader:'#include <color_pars_fragment>\n#include <normal_pars_fragment>'};m.onBeforeCompile(shader,{});assert.match(shader.vertexShader,/centroid varying vec3 vNormal/);assert.match(shader.fragmentShader,/centroid varying vec3 vNormal/);
    assert.equal(m.map,before[i].map);assert.equal(m.normalMap,before[i].normalMap);assert.equal(m.roughnessMap,before[i].roughnessMap);assert.equal(m.roughness,before[i].roughness);assert.deepEqual(m.normalScale.toArray(),before[i].normal);
  }
  assert.equal(fine.geometry,geometry);select.value='pixel';select.handlers.change();assert.equal(h.ctx.evidence().shoreSamplingReview.mode,'pixel');
  const original={vertexShader:'#include <normal_pars_vertex>',fragmentShader:'#include <normal_pars_fragment>'};materials[0].onBeforeCompile(original,{});assert.doesNotMatch(original.vertexShader,/centroid/);
});

test('R4 uses covered interpolation on first render without requiring review controls',async t=>{
  const h=harness({bank:'r4'});t.after(()=>h.cleanup());h.ctx.query.delete('review');await h.ctx.bootstrap();
  assert.equal(h.ctx.ready,true);assert.equal(h.ctx.evidence().shoreSamplingReview.mode,'centroid');
  assert.equal(h.selects.has('岸坡边缘插值 / Shore edge sampling'),false);
  assert.equal(h.buttons.some(button=>button.textContent==='岸边步行起点 / Shore walk start'),false);
  const fine=h.bankOwner.group.getObjectByName('shore-bank-r4-fine-ground');
  for(const material of [h.terrain.earthMaterial,fine.material]){
    const shader={vertexShader:'#include <normal_pars_vertex>',fragmentShader:'#include <normal_pars_fragment>'};
    material.onBeforeCompile(shader,{});assert.match(shader.vertexShader,/centroid varying vec3 vNormal/);assert.match(shader.fragmentShader,/centroid varying vec3 vNormal/);
    assert.equal(material.map,h.ctx.groundTextures.map);assert.equal(material.normalMap,h.ctx.groundTextures.normalMap);
  }
});

test('visible shore start refuses unsupported water and does not relocate the visitor',async t=>{
  const h=harness({bank:'r4'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  const button=h.buttons.find(item=>item.textContent==='岸边步行起点 / Shore walk start'),before=structuredClone(h.ctx.state);
  assert.ok(button);button.handlers.click();assert.deepEqual(structuredClone(h.ctx.state),before);assert.match(h.messages.at(-1),/不能安全落地/);assert.equal(h.ctx.evidence().shoreWalkReview,null);
});

test('visible shore start uses live landing, preserves the world, and exposes a grounded 6.4m route through real navigation',async t=>{
  const h=harness({bank:'r4',walkableBank:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  const button=h.buttons.find(item=>item.textContent==='岸边步行起点 / Shore walk start');let calls=0;
  const landing=h.nav.landing;h.nav.landing=position=>{calls++;return landing(position);};
  h.ctx.capturing=true;button.handlers.click();assert.equal(calls,0);h.ctx.capturing=false;
  button.handlers.click();assert.equal(calls,1);assert.equal(h.ctx.state.mode,'grounded');assert.equal(h.ctx.state.support.valid,true);assert.equal(h.ctx.state.position.y,Math.fround(2.2));assert.equal(h.ctx.reviewPaused,true);
  assert.equal(h.marker.visible,true);assert.equal(h.bankOwner.adapter.active,true);assert.equal(h.textureReleases,0);
  const data=h.ctx.evidence().shoreWalkReview;assert.match(data.entry,/live navigation/);assert.match(data.scope,/does not enter the submerged bed/);
  let state=h.ctx.state,distance=0;for(let i=0;i<20;i++){const step=h.nav.walk(state,{...data.direction,run:false},.1);assert.equal(step.blocked,false);assert.equal(step.support.valid,true);distance+=step.distance;state={...state,...step};}
  assert.ok(Math.abs(distance-6.4)<1e-9);assert.equal(state.position.y,Math.fround(2.2));
});
