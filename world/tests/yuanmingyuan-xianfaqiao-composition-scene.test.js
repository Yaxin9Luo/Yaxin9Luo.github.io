import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as THREE from 'three';
import {createXianfaqiaoComposition,xianfaqiaoRouteLanding} from '../src/yuanmingyuan/xianfaqiao-composition.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';
import {createMuseumTerrainAssets} from '../src/yuanmingyuan/museum-terrain-assets.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';
import {createMuseumGuideEnsemble} from '../src/yuanmingyuan/museum-guide-ensemble.js';
import {createMuseumNavigation,museumTravelHeading,museumVisitorCollider} from '../src/yuanmingyuan/visitor-motion.js';
import {museumSites,museumSite,sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {museumEntry,museumRegions} from '../src/yuanmingyuan/museum-content.js';
import {museumResidentCatalog} from '../src/yuanmingyuan/museum-resident-catalog.js';
import {EnvironmentClock} from '../src/environment-time.js';
import {stepMuseumFlightAroundPlants} from '../src/yuanmingyuan/planting-flight.js';
import {MuseumReader} from '../src/yuanmingyuan/museum-reader.js';
import {GROUND_MOTION} from '../src/ground-motion.js';
import {applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {createXianfaqiaoGardenPlantingLayout} from '../src/yuanmingyuan/xianfaqiao-garden-planting.js';
import {extendFuhaiNortheastBankContext,fuhaiNortheastBankContextRegionId} from '../src/yuanmingyuan/fuhai-ne-bank-context-r1.js';
import {rotateMuseumLightingSample} from '../src/yuanmingyuan/museum-lighting-sample.js';
import {gardenReviewCameraSightline} from '../src/yuanmingyuan/garden-review-camera.js';
import {createXieqiquCourtGardenOwner} from '../src/yuanmingyuan/xieqiqu-court-garden-owner.js';
import {createXieqiquCourtCompositionR3} from '../src/yuanmingyuan/xieqiqu-court-composition-r3.js';
import {createXieqiquCourtGardenR2Layout} from '../src/yuanmingyuan/xieqiqu-court-garden-r2-layout.js';
import {createXieqiquCourtGardenR4Study} from '../src/yuanmingyuan/xieqiqu-court-garden-r4-study.js';
import {compositionOwner,compositionGround} from './helpers/xianfaqiao-composition-fixture.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

// Run the real page bootstrap and its real load/mount/release/visit/UI/render/
// cleanup functions. Only full factories, texture/character IO and GPU work are
// substituted. These tests use the same owners, source BVHs, actual local terrain,
// water mergers, navigation and DOM handlers all the way through the page.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const sourceSHA=createHash('sha256').update(source).digest('hex');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert(start>=0&&end>start,a);return source.slice(start,end);};
const definitions=[source.match(/^const paused=.*;$/m)[0],source.split('\n').find(line=>line.startsWith("$('review-tools').hidden=")),
  section('async function prepareMuseumRendering(','\nfunction busy('),section('function busy(','\nfunction setLanguage('),
  section('function svgNode(','\nfunction openDialog('),section('function frameVisitor(','\nfunction inspect('),source.match(/^function inspect.*$/m)[0],
  section('function createGuideRegion(','\nfunction evidence('),section('function evidence(','\nfunction tick('),
  section('function start(','\nfunction resize('),section('function setReviewPaused(','\n$(\'review-pause\').addEventListener'),
  section('function dispose(','\naddEventListener(\'pagehide\''),
].join('\n');
const bootstrap=source.slice(source.indexOf('  await prepareMuseumGround();controller.signal.throwIfAborted();'));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const forbidden=label=>()=>{throw new Error(`Composition must not invoke ${label}`);};
function node(){return {dataset:{},children:[],listeners:{},hidden:false,textContent:'',disabled:false,open:false,setAttribute(key,value){this[key]=String(value);},addEventListener(type,fn){this.listeners[type]=fn;},insertBefore(child){this.children.push(child);},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}};}
function harness({failDecoder=false,failSecondBinder=false,failEnvironment=false,lateDecoder=false,throwCleanup=false,western=false,failPlanting=false,latePlanting=false,court=false,failCourtCleanup=false,review='still',queryComposition='xianfaqiao',nativeFirstFrame=false,realFlight=false,aspect=1,terrainNorth=court==='garden-r4'?-650:-615}={}){
  const events=[],owners=new Map(),supports=[],guideWorlds=[],errors=[],messages=[],renders=[],reads=[],nodes=new Map(),gate=deferred(),entered=deferred();
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,aspect,.08,22000),controller=new AbortController(),services=new Map();
  camera.position.set(350,14,-560);camera.lookAt(350,4,-565);camera.updateMatrixWorld();
  const service=name=>{let disposed=false;const result={group:new THREE.Group(),disposeCalls:0,get disposed(){return disposed;},dispose(){result.disposeCalls++;if(disposed)return;disposed=true;events.push(`service:${name}`);result.group.removeFromParent();if(throwCleanup&&name==='water')throw new Error('Water cleanup sentinel');}};services.set(name,result);return result;};
  let ground=null,waterRange=null,plantingArguments=null,navigationOptions=null;
  const ctx={performance,THREE,URLSearchParams,AbortController,controller,scene,camera,composition:null,query:new URLSearchParams('composition=xianfaqiao&review=still&planting='+(western?'western':'pilot')+'&shore=r2&bank=r4&batch=2&site=xieqiqu'),sourceTag:'component-scene-test',
    terrain:null,terrainAssets:null,terrainPads:[],terrainCourts:[],terrainPaths:[],terrainReplacements:[],gardenLayout:null,groundTextures:null,water:null,environment:null,visitor:null,pool:null,sites:null,residents:null,preparedGroundSources:null,residentArchitecture:null,architecture:null,currentSite:null,nav:null,guides:null,guideSurface:null,
    residentBindings:new Map(),borrowedOwners:new WeakSet(),plantingPilot:null,plantingCollisions:null,plantingReview:null,westernPlanting:null,westernPlantingLifetime:null,shoreCommunity:null,shoreUnderstory:null,shoreBank:null,sceneFailure:null,
    museumSites,museumSite,museumEntry,museumRegions,museumResidentCatalog,sitePoint,museumTravelHeading,museumVisitorCollider,xianfaqiaoRouteLanding,
    createXianfaqiaoComposition(options){return createXianfaqiaoComposition(options);},
    async createXieqiquCourtGardenOwner(options){
      events.push('court-wrapper');assert(court);ctx.lastCourtLayout=options.layout;
      const wrapped=await createXieqiquCourtGardenOwner({...options,
        createSources:()=>({prepareRegion:async()=>({sources:{}}),snapshot:()=>({fixture:true}),update(){},whenIdle:async()=>{},dispose:()=>events.push('court-sources')}),
        prepareGarden:async({owner,buildSupport,signal})=>{
          assert.equal(owner.group.parent,null);assert.equal(buildSupport,false);
          const group=new THREE.Group(),soil=new THREE.Mesh(new THREE.BoxGeometry(6,.112,3),new THREE.MeshStandardMaterial());
          soil.position.set(21.9,.056,-37.45);group.add(soil);
          const leaf=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),soil.material);leaf.position.set(21.9,1.2,-37.45);leaf.userData.navigation=false;group.add(leaf);owner.group.add(group);
          let disposed=false;const binding={diagnostics:{fixture:true,ownedSurfaceTriangles:12},assertCurrent(){assert(!disposed);assert.equal(group.parent,owner.group);return true;},dispose(){
            if(disposed)return;disposed=true;events.push('court-binding');signal.removeEventListener('abort',binding.dispose);
            group.removeFromParent();soil.geometry.dispose();leaf.geometry.dispose();soil.material.dispose();
          }};
          signal.addEventListener('abort',binding.dispose,{once:true});return binding;
        },
      });
      owners.set('xieqiqu',wrapped);return wrapped;
    },
    createXieqiquCourtGardenR2Layout,
    async createXieqiquCourtGardenR4Study(options){
      events.push('court-r4-wrapper');assert.equal(court,'garden-r4');
      const owner=await createXieqiquCourtGardenR4Study({
        ...options,preparePixels:async()=>({maps:{},dispose(){events.push('r4-pixels');}}),
        assemble:async options=>{
          assert.equal(options.layout.id,'xieqiqu-court-garden-r4-bilberry-leaf-r3');
          assert.equal(options.layout.sourceProfileEvidence.sourceAssetId,'court-low-broadleaf-r3');
          assert.equal(options.layout.sourceProfileEvidence.sourceTextures,3);
          assert.deepEqual(options.layout.sourceProfileEvidence.textureDimensions,[1024,2048]);
          assert.deepEqual(options.layout.sourceProfileEvidence.normalScale,[1,-1]);
          return createXieqiquCourtCompositionR3({
            ...options,createCourt:options=>ctx.createXieqiquCourtGardenOwner(options),
            createPool:()=>({dispose(){events.push('r4-pool');}}),
            combineFish:({buildingOwner,poolOwner})=>({
              group:buildingOwner.group,diagnostics:{...buildingOwner.diagnostics,assetId:'xieqiqu-r9-fish-integration-r1'},
              validate:()=>buildingOwner.assertCurrent(),update:time=>buildingOwner.update(time),
              dispose(){events.push('r4-fish');poolOwner.dispose();buildingOwner.dispose();},
            }),
            decoratePaving:()=>({assertCurrent(){},dispose(){events.push('r4-paving');if(failCourtCleanup)throw new Error('R4 paving release sentinel');}}),
          });
        },
      });
      owners.set('xieqiqu',owner);return owner;
    },
    async createXieqiquCourtGardenR3Study(options){
      events.push('court-r3-wrapper');assert.equal(court,'garden-r3');
      const owner=await createXieqiquCourtCompositionR3({
        ...options,layout:{id:'r3-page-routing-component-fixture'},createSources(){},prepareGarden(){},
        createCourt:options=>ctx.createXieqiquCourtGardenOwner(options),
        createPool:()=>({dispose(){events.push('r3-pool');}}),
        combineFish:({buildingOwner,poolOwner})=>({
          group:buildingOwner.group,diagnostics:{...buildingOwner.diagnostics,assetId:'xieqiqu-r9-fish-integration-r1'},
          validate:()=>buildingOwner.assertCurrent(),update:time=>buildingOwner.update(time),
          dispose(){events.push('r3-fish');poolOwner.dispose();buildingOwner.dispose();},
        }),
        decoratePaving:()=>({assertCurrent(){},dispose(){events.push('r3-paving');if(failCourtCleanup)throw new Error('R3 paving release sentinel');}}),
      });
      owners.set('xieqiqu',owner);return owner;
    },
    async loadMuseumModel(id){events.push(`load:${id}`);assert.equal(id,'xieqiqu');const owner=compositionOwner(id,events);owners.set(id,owner);return owner;},
    async loadMuseumArchive(id,url,options){events.push(`load:${id}`);assert.equal(id,'xianfaqiao');if(lateDecoder){entered.resolve();await gate.promise;}if(failDecoder)throw new Error('Full archive decoder sentinel');const owner=compositionOwner(id,events);owners.set(id,owner);return owner;},
    prepareMuseumGroundSources:forbidden('default source pool'),createMuseumLandscape:forbidden('a second landscape plan'),
    createMuseumMultiDrawBatch:forbidden('a second full batch'),createMuseumStaticBatch:forbidden('a second static batch'),placeMuseumStaticAsset:forbidden('a second placement'),configureMuseumLandscapeAsset:forbidden('a second court binding'),createArchitectureSurface:forbidden('a second source BVH'),createMuseumResidentBuildings:forbidden('unrelated residents'),
    createExhibitionCoast(layout){assert.equal(layout,ctx.composition.plan.layout);return layout.exhibition.coast.polygon;},
    createGardenTerrain(options){
      events.push('terrain-create');assert.equal(ctx.composition.snapshot.status,'prepared');assert.deepEqual(options.assetCourts,ctx.composition.plan.courts);assert.equal(options.assetCourts.length,3);assert.equal(options.replacements.length,0);
      for(const site of ctx.composition.sites){const record=ctx.composition.get(site.id);assert.equal(record.owner,owners.get(site.id));const release=record.support.dispose;record.support.dispose=()=>{if(!record.support.disposed)events.push(`support:${site.id}`);return release();};supports.push(record.support);}
      const aggregate=ctx.composition.support,makeQuery=aggregate.createGuideSupport;
      aggregate.createGuideSupport=(...args)=>{const local=makeQuery(...args),release=local.dispose;local.dispose=()=>{if(!local.snapshot().disposed)events.push('architecture-local-close');return release();};return local;};
      ground=compositionGround(ctx.composition.plan,{north:terrainNorth});const makeGroundQuery=ground.terrain.createGuideSupport,releaseTerrain=ground.terrain.dispose;
      ground.terrain.createGuideSupport=(...args)=>{const local=makeGroundQuery(...args),release=local.dispose;let closed=false;local.dispose=()=>{if(!closed){closed=true;events.push('terrain-local-close');}return release();};return local;};
      ground.terrain.dispose=()=>{if(!ground.terrain.disposed)events.push('terrain-dispose');return releaseTerrain();};return ground.terrain;
    },createMuseumNavigation(options){navigationOptions=options;return createMuseumNavigation(options);},createMuseumTerrainAssets,
    createXianfaqiaoGardenPlantingLayout,extendFuhaiNortheastBankContext,fuhaiNortheastBankContextRegionId,gardenReviewCameraSightline,
    async createWesternGardenScenePlanting(options){
      plantingArguments=options;events.push('western-planting-create');
      assert.equal(options.root,scene);assert.equal(options.terrain,ground.terrain);assert.equal(options.architecture(),ctx.composition.support);
      const expectedRegions=['xieqiqu-north-garden','xieqiqu-forelake-garden','xianfaqiao-approach-garden'];
      if(court==='garden-r4')expectedRegions.push(fuhaiNortheastBankContextRegionId);
      assert.deepEqual(Array.from(options.regionIds),expectedRegions);
      assert.equal(options.plantingLayout.regions.length,court==='garden-r4'?9:8,'The page retains the complete original plan and appends the Fuhai context only for R4.');
      if(court==='garden-r4'){
        const lake=options.plantingLayout.regions.find(r=>r.id===fuhaiNortheastBankContextRegionId);
        assert.equal(lake.placements.length,134);
        assert.deepEqual(Object.fromEntries(['willow','sedge','flower-shrub'].map(id=>[id,lake.placements.filter(p=>p.species===id).length])),{willow:2,sedge:122,'flower-shrub':10});
        assert.equal(lake.historicallySurveyed,false);
      }
      options.onProgress({completed:0,total:1});if(failPlanting)throw new Error('Regional planting placement sentinel');
      const owner=service('western-planting'),part=new THREE.Group();part.name='western-native-factory-substitute';owner.group.add(part);scene.add(owner.group);
      const collision={diagnostics:{solidCount:8},dynamicColliders:()=>owner.disposed?[]:[{id:'test-plant-body'}]};
      Object.assign(owner,{updates:[],checks:0,assertCurrent(){owner.checks++;if(owner.disposed)throw new Error('Planting already disposed');return true;},update(time){if(!owner.disposed)owner.updates.push(time);},snapshot:()=>({disposed:owner.disposed,regionIds:Array.from(options.regionIds),nativeCompositionReviewed:false})});
      Object.defineProperty(owner,'collision',{get:()=>owner.disposed?null:collision});
      options.signal.addEventListener('abort',()=>owner.dispose(),{once:true});
      if(latePlanting){entered.resolve();await gate.promise;options.signal.throwIfAborted();}
      return owner;
    },
    async loadGardenGroundTextures(options){events.push('ground-4k');assert.equal(options.resolution,'4k');const owner=service('textures');Object.assign(owner,{resolution:'4k',map:new THREE.Texture(),normalMap:new THREE.Texture(),roughnessMap:new THREE.Texture()});const release=owner.dispose;owner.dispose=()=>{if(owner.disposed)return;for(const name of ['map','normalMap','roughnessMap'])owner[name].dispose();release();};return owner;},applyGardenGroundTextures,
    createGardenWater(){events.push('water-create');const water=ground.water,release=water.dispose;const tracked=service('water');water.dispose=()=>{try{release();}finally{if(!tracked.disposed)tracked.dispose();}};
      if(failSecondBinder){const i=water.snapshot().sheets.findIndex(sheet=>sheet.height===4.13),geometry=water.sheets[i].geometry;waterRange={geometry,range:{...geometry.drawRange}};geometry.setDrawRange(0,0);}return water;},
    async createGardenEnvironment(options){events.push('environment-create');assert.equal(ctx.composition.snapshot.status,'water-ready');assert.equal(options.lightYaw,court==='garden-r4'?-120:0);if(failEnvironment)throw new Error('Environment load sentinel');const clock=new EnvironmentClock('day',{phase:.46});return Object.assign(service('environment'),{clock,update:(dt,sampleOptions)=>{const sample=clock.update(dt,sampleOptions);return options.lightYaw?rotateMuseumLightingSample(sample,options.lightYaw):sample;}});},
    async createMuseumVisitor(){events.push('visitor-create');return service('visitor');},async createMuseumGuidePool(){events.push('guides-create');return service('pool');},
    createMuseumGuideEnsemble,
    createMuseumSiteController(options){assert.deepEqual(options.sites.map(site=>site.id),['xieqiqu','xianfaqiao']);return createMuseumSiteController(options);},
    createMuseumGuideWorld(options){const world=createMuseumGuideWorld(options),release=world.dispose;guideWorlds.push(world);events.push(`guide-query:${options.site.id}`);world.dispose=()=>{if(!world.snapshot().disposed)events.push(`guide-close:${options.site.id}`);return release();};return world;},
    selectMuseumGuidePlacements:()=>({placements:[],rejected:[]}),createMuseumGuides:forbidden('full guide factory'),
    ready:false,disposed:false,loading:true,contextLost:false,capturing:false,reviewPaused:review==='still',lang:'en',copy:{en:{terrain:'terrain',building:'building',visitor:'visitor',failed:'failed',ready:'ready',unsafe:'unsafe'}},
    document:{hidden:false,body:{dataset:{}},removeEventListener(){},createElement:node,createElementNS:node},removeEventListener(){},console:{error:error=>errors.push(error)},dialogs:[],
    $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},keys:new Set(),touch:{clear(){},snapshot:()=>({x:0,z:0,vertical:0,boost:false})},
    state:{position:{x:770,y:22,z:-595},mode:'flying',speed:0,heading:0,gaitPhase:0},forward:new THREE.Vector3(),right:new THREE.Vector3(),MOTION:GROUND_MOTION,
    time:17,last:0,raf:0,cameraMode:0,reviewMotion:null,reviewMotionResult:null,reviewFramesRemaining:0,frameSamples:[],frameTiming:null,groundReview:'dry-scale15',
    message:text=>messages.push(text),locationCaption(){},syncControls(){},closeDialog(){},updateCharacter(){},resetCharacterMotion(){},
    stepMuseumFlightAroundPlants:(position,input,dt,options)=>{ctx.lastFlightPlanting=options.planting;return realFlight?stepMuseumFlightAroundPlants(position,input,dt,options):{...position};},
    reader:{...service('reader'),isOpen:false,open:(id)=>reads.push(id)},directory:service('directory'),audio:{...service('audio'),snapshot:()=>({}),update(){},setEmitter(){},companion(){},silence(){}},
    controls:{...service('controls'),target:new THREE.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld();ctx.redraw.request();}},
    rendering:{...service('rendering'),samples:4,render(){const groups=[];scene.traverseVisible(object=>{if(object.isMesh)groups.push(object.parent.name);});renders.push(groups);}},
    renderer:{...service('renderer'),getPixelRatio:()=>1,shadowMap:{},info:{reset(){},render:{},memory:{}},extensions:{has:()=>false}},
    canvas:{width:320,height:200,clientWidth:320,clientHeight:200},timingSummary:()=>null,observer:{disconnect(){}},keydown(){},keyup(){},clearKeys(){},tick(){},
  };
  if(court)ctx.query.set('court',typeof court==='string'?court:'garden-r1');
  if(review===null)ctx.query.delete('review');else ctx.query.set('review',review);
  if(queryComposition===null)ctx.query.delete('composition');else ctx.query.set('composition',queryComposition);
  if(nativeFirstFrame)ctx.query.set('nativeFirstFrame','capture');
  vm.createContext(ctx);vm.runInContext(definitions+`\nthis.bootstrap=async()=>{try{\n${bootstrap}\n};this.dispose=dispose;this.visit=visit;this.render=render;this.evidence=evidence;this.advance=advance;this.loadSceneBuilding=loadSceneBuilding;this.inspect=inspect;`,ctx,{filename:'actual-composition-scene-'+sourceSHA.slice(0,12)});
  const drawing=installSceneRedraw(ctx,source);
  return {ctx,events,owners,supports,guideWorlds,errors,messages,renders,reads,nodes,services,gate,entered,drawing,
    get plantingArguments(){return plantingArguments;},get navigationOptions(){return navigationOptions;},
    plantingButton:id=>ctx.$('review-tools').children.find(node=>node.dataset.plantingAction===id),
    button:id=>ctx.$('review-tools').children.find(node=>node.dataset.compositionAction===id),
    cleanup(){ctx.dispose();if(waterRange){waterRange.geometry.setDrawRange(waterRange.range.start,waterRange.range.count);}ground?.dispose();for(const owner of owners.values())if(!owner.disposed)owner.dispose();drawing.dispose();},
  };
}

test('actual composition bootstrap is full pair → patch/terrain → 4K/water handoff → visitor/guides/borrow, with no default owners',async t=>{
  t.diagnostic('museum-scene SHA256 '+sourceSHA);const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);assert.equal(h.ctx.sceneFailure,null);
  assert.deepEqual(h.events.slice(0,8),['load:xieqiqu','load:xianfaqiao','terrain-create','ground-4k','water-create','environment-create','visitor-create','guides-create']);
  assert.equal(h.ctx.sites.resource,h.owners.get('xieqiqu'));assert.equal(h.ctx.architecture,h.ctx.composition.support);assert.equal(h.ctx.residents,null);assert.equal(h.ctx.shoreBank,null);assert.equal(h.ctx.plantingPilot,null);
  const stats=h.ctx.evidence({full:true});assert.equal(stats.composition.nativeApproved,false);assert.equal(stats.composition.composedWorldApproved,false);assert.equal(stats.composition.owners.length,2);assert.equal(stats.groundReview.resolution,'4k');assert.equal(stats.rendering.sceneMSAA,4);
  assert.deepEqual(h.ctx.$('destinations').children.map(node=>node.dataset.site),['xieqiqu','xianfaqiao']);
});

test('actual site visits borrow the same owners and preserve union support; each render updates both once',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();const original=h.ctx.sites.resource,union=h.ctx.architecture,guide=h.guideWorlds[0],facade=h.ctx.guideSurface;
  await h.ctx.visit('xianfaqiao',{teleport:false});assert.equal(h.ctx.sites.resource,h.owners.get('xianfaqiao'));assert.equal(guide.snapshot().disposed,false);assert.equal(h.ctx.guideSurface,facade);assert.equal(h.guideWorlds.length,2);assert.equal(h.ctx.architecture,union);
  assert(h.supports.every(s=>!s.disposed));assert([...h.owners.values()].every(o=>o.disposeCalls===0));
  await h.ctx.visit('xieqiqu',{teleport:false});assert.equal(h.ctx.sites.resource,original);assert.equal(h.guideWorlds.length,2);assert(h.guideWorlds.every(world=>!world.snapshot().disposed));assert.equal(h.events.filter(e=>e.startsWith('load:')).length,2);
  for(const owner of h.owners.values())owner.updates.length=0;h.ctx.render(1/60);for(const owner of h.owners.values())assert.deepEqual(owner.updates,[17]);
  assert.equal(h.ctx.composition.snapshot.ensemble.records.reduce((n,r)=>n+r.borrowers,0),1);assert.equal(h.ctx.composition.snapshot.owners.every(o=>o.visible),true);
  const before=h.ctx.currentSite;await h.ctx.visit('fangwaiguan');assert.equal(h.ctx.currentSite,before);
});

test('four actual DOM world cameras preserve owners; real exhibits and live route controls operate without injected page state',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();
  for(const view of h.ctx.composition.candidate.compositionReview.views){h.button(view.id).listeners.click();assert.deepEqual(h.ctx.camera.position.toArray(),view.position);assert.deepEqual(h.ctx.controls.target.toArray(),view.target);assert.equal(h.ctx.composition.snapshot.owners.every(o=>o.visible),true);}
  for(const id of ['xieqiqu','xianfaqiao']){h.button('read-'+id).listeners.click();assert.equal(h.reads.at(-1),id);assert.equal(typeof museumEntry(id).title.en,'string');}
  const landing=h.ctx.nav.landing;h.ctx.nav.landing=()=>({valid:false,reason:'blocked'});const before={...h.ctx.state.position};h.button('route-start').listeners.click();assert.deepEqual({...h.ctx.state.position},before);assert.equal(h.ctx.reviewMotion,null);
  h.ctx.nav.landing=landing;h.button('route-walk-2s').listeners.click();assert.equal(h.ctx.state.mode,'grounded');assert.equal(h.ctx.reviewMotion.duration,2);assert.equal(h.ctx.reviewPaused,false);
  const start={...h.ctx.state.position};for(let i=0;i<120;i++)h.ctx.advance(1/60);
  assert(h.ctx.reviewMotion.pathDistance>6.3&&h.ctx.reviewMotion.pathDistance<6.6);assert(h.ctx.state.position.y>start.y+.15);assert.equal(h.ctx.state.support.valid,true);
  const witness=h.ctx.evidence().compositionWalkReview;assert.equal(witness.landing.y,h.ctx.nav.landing(witness.approach).y);assert(Math.abs(witness.landing.y-start.y)<.03,'initial foot-envelope fit may rise above the centre triangle, with no prescribed height override');
});

for(const cause of ['decoder','second-binder','environment'])test(`actual ${cause} bootstrap failure releases all held scene owners and restores original water`,async t=>{
  const h=harness({failDecoder:cause==='decoder',failSecondBinder:cause==='second-binder',failEnvironment:cause==='environment'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.equal(h.ctx.ready,false);assert.equal(h.ctx.document.body.dataset.ready,'failed');assert.equal(h.errors.length,1);assert.match(h.ctx.sceneFailure.message,cause==='decoder'?/Full archive decoder sentinel/:cause==='second-binder'?/both complete Xieqiqu pools/:/Environment load sentinel/);
  assert.equal(h.ctx.composition.disposed,true);assert.equal(h.ctx.sites,null);assert.equal(h.ctx.terrain,null);assert.equal(h.ctx.water,null);assert.equal(h.ctx.renderer,null);
  for(const owner of h.owners.values()){assert.equal(owner.disposeCalls,1);assert(owner.disposedSheets.every(sheet=>sheet.visible&&sheet.navigation===undefined));}
  assert(h.supports.every(s=>s.disposed));assert.equal(h.services.get('renderer').disposeCalls,1);assert.equal(h.services.get('reader').disposeCalls,0);
});

test('actual pagehide during late archive load releases early and late owners once and cannot construct terrain',async t=>{
  const h=harness({lateDecoder:true});t.after(()=>h.cleanup());const operation=h.ctx.bootstrap();await h.entered.promise;h.ctx.dispose();assert.equal(h.owners.get('xieqiqu').disposeCalls,1);h.gate.resolve();await operation;
  assert.equal(h.owners.get('xianfaqiao').disposeCalls,1);assert.equal(h.events.includes('terrain-create'),false);assert.equal(h.ctx.document.body.dataset.ready,'disposed');assert.equal(h.errors.length,0);
});

test('actual pagehide closes local queries before supports/owners, returns the borrow, and continues after water cleanup throws',async t=>{
  const h=harness({throwCleanup:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();h.ctx.dispose();
  const e=h.events;assert(e.indexOf('architecture-local-close')>=0);assert(e.indexOf('terrain-local-close')<e.indexOf('terrain-dispose'));for(const id of ['xieqiqu','xianfaqiao']){assert(e.indexOf('architecture-local-close')<e.indexOf('support:'+id));assert(e.indexOf('support:'+id)<e.indexOf('dispose:'+id));assert.equal(h.owners.get(id).disposeCalls,1);assert(h.owners.get(id).disposedSheets.every(sheet=>sheet.visible));}
  assert(h.guideWorlds.every(world=>world.snapshot().disposed));assert.equal(h.ctx.composition.snapshot.ensemble.records.reduce((n,r)=>n+r.borrowers,0),0);
  assert.equal(h.services.get('renderer').disposeCalls,1);assert.equal(h.services.get('textures').disposeCalls,1);assert.equal(h.ctx.document.body.dataset.ready,'disposed');assert.equal(h.errors.length,1);assert.match(h.errors[0].message,/cleanup failed/);
});


test('actual western route loads only the adjacent regions, uses its live collisions and updates its sources once per render',async t=>{
  const h=harness({western:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);
  const owner=h.ctx.westernPlanting;assert(owner);assert.equal(h.ctx.plantingPilot,null);assert.equal(h.ctx.shoreCommunity,null);
  assert(h.events.indexOf('western-planting-create')>h.events.indexOf('water-create'));assert.equal(h.plantingArguments.architecture(),h.ctx.composition.support);
  assert(h.navigationOptions.dynamicColliders().some(body=>body.id==='test-plant-body'));h.ctx.advance(0);assert.equal(h.ctx.lastFlightPlanting,owner.collision);
  owner.updates.length=0;h.ctx.render(1/60);assert.deepEqual(owner.updates,[17]);
  await h.ctx.visit('xianfaqiao',{teleport:false});assert.equal(h.ctx.westernPlanting,owner);assert.equal(owner.disposed,false);assert(owner.checks>=2);
  for(const id of ['north-garden-wide','north-garden-axis','north-garden-ground']){h.plantingButton(id).listeners.click();assert.equal(h.ctx.plantingReview.id,id);assert.equal(h.ctx.reviewPaused,true);assert.equal(h.ctx.composition.snapshot.owners.every(o=>o.visible),true);assert.equal(owner.group.visible,true);}
  assert.deepEqual(Array.from(h.ctx.evidence().westernPlanting.regionIds),['xieqiqu-north-garden','xieqiqu-forelake-garden','xianfaqiao-approach-garden']);
  owner.dispose();assert.equal(h.navigationOptions.dynamicColliders().length,0);h.ctx.advance(0);assert.equal(h.ctx.lastFlightPlanting,null);
});

test('actual western planting failure releases the retained composition and leaves the historical reader available',async t=>{
  const h=harness({western:true,failPlanting:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.equal(h.ctx.ready,false);assert.equal(h.ctx.document.body.dataset.ready,'failed');
  assert.match(h.ctx.sceneFailure.message,/Regional planting placement sentinel/);assert.equal(h.ctx.westernPlanting,null);assert.equal(h.ctx.terrain,null);assert.equal(h.ctx.composition.disposed,true);
  for(const owner of h.owners.values())assert.equal(owner.disposeCalls,1);assert.equal(h.services.get('reader').disposeCalls,0);
});

test('actual page cleanup retires western planting before terrain and retained building support',async t=>{
  const h=harness({western:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();h.ctx.dispose();
  const at=h.events.indexOf('service:western-planting');assert(at>=0);assert(at<h.events.indexOf('support:xieqiqu'));assert(at<h.events.indexOf('terrain-dispose'));
  assert.equal(h.ctx.westernPlanting.disposed,true);assert.equal(h.ctx.evidence().plantingCollisions,null);
});


test('actual pagehide during western preparation cancels regional work before closing its retained architecture',async t=>{
  const h=harness({western:true,latePlanting:true});t.after(()=>h.cleanup());const operation=h.ctx.bootstrap();await h.entered.promise;
  assert.equal(h.ctx.westernPlanting,null,'the asynchronous factory has not returned');h.ctx.dispose();
  assert(h.plantingArguments.signal.aborted);const at=h.events.indexOf('service:western-planting');assert(at>=0);assert(at<h.events.indexOf('support:xieqiqu'));
  h.gate.resolve();await operation;assert.equal(h.ctx.document.body.dataset.ready,'disposed');assert.equal(h.ctx.westernPlanting,null);assert.equal(h.errors.length,0);
});


test('actual court query wraps before placement, includes the soil surface and excludes the leaf mesh from navigation',async t=>{
  const h=harness({western:true,court:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);assert.equal(h.events.filter(e=>e==='court-wrapper').length,1);
  const record=h.ctx.composition.get('xieqiqu'),support=record.support.surfaceAt(416.9,-602.45,{maxY:8});
  assert(Math.abs(support.height-4.112)<1e-5,'the genuine box top, not leaf geometry or a height override, supports the visitor');
  assert.equal(record.owner.diagnostics.courtGarden.fixture,true);
  for(const id of ['north-court-garden-wide','north-court-garden-detail']){
    const button=h.plantingButton(id);assert(button);assert.equal(button.disabled,false);button.listeners.click();assert.equal(h.ctx.plantingReview.id,id);
  }
  h.ctx.dispose();const e=h.events;
  assert(e.indexOf('support:xieqiqu')<e.indexOf('court-binding'));assert(e.indexOf('court-binding')<e.indexOf('court-sources'));assert(e.indexOf('court-sources')<e.indexOf('dispose:xieqiqu'));
});

test('actual live composition update failure closes navigation and graphics while preserving the exhibit reader',async t=>{
  const h=harness({western:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.equal(h.ctx.ready,true);
  h.owners.get('xieqiqu').update=()=>{throw new Error('Court source invalidation sentinel');};
  const oldSupports=[...h.supports],oldTerrain=h.ctx.terrain,renderCount=h.renders.length;
  assert.equal(h.ctx.render(1/60),false);assert.equal(h.ctx.ready,false);assert.equal(h.ctx.document.body.dataset.ready,'failed');
  assert(h.ctx.composition.disposed);assert(oldSupports.every(s=>s.disposed));assert(oldTerrain.disposed);
  assert.equal(h.ctx.architecture,null);assert.equal(h.ctx.nav,null);assert.equal(h.ctx.renderer,null);assert.equal(h.renders.length,renderCount);
  assert.equal(h.services.get('reader').disposed,false);assert.equal(h.services.get('reader').disposeCalls,0);
  assert.match(h.ctx.sceneFailure.message,/Court source invalidation/);assert.equal(h.errors.length,1);
});


test('actual R3 page route retains the full decorated owner across placement, water, visits and cleanup',async t=>{
  const h=harness({western:true,court:'garden-r3'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);assert.equal(h.events.filter(e=>e==='court-r3-wrapper').length,1);
  for(const id of ['north-court-garden-wide','north-court-garden-detail']){const button=h.plantingButton(id);assert(button);assert.equal(button.disabled,false);}
  const owner=h.ctx.composition.get('xieqiqu').owner;
  assert.equal(owner.diagnostics.assetId,'xieqiqu-r9-fish-integration-r1');
  assert.equal(owner.reviewSourceOwner.diagnostics.assetId,'xieqiqu-complete-group');
  assert.equal(owner.group,owner.reviewSourceOwner.group);assert.equal(owner.archive,undefined);
  const support=h.ctx.composition.support.surfaceAt(416.9,-602.45,{maxY:8});assert(Math.abs(support.height-4.112)<1e-5);
  await h.ctx.visit('xianfaqiao',{teleport:false});await h.ctx.visit('xieqiqu',{teleport:false});
  assert.equal(h.ctx.sites.resource,owner);assert.equal(owner.disposed,false);h.ctx.render(1/60);
  h.ctx.dispose();assert.equal(owner.disposed,true);assert.equal(owner.reviewSourceOwner.disposed,true);
  const e=h.events;assert(e.indexOf('support:xieqiqu')<e.indexOf('r3-paving'));
  assert(e.indexOf('r3-paving')<e.indexOf('r3-fish'));assert(e.indexOf('r3-fish')<e.indexOf('court-binding'));
  assert.equal(e.filter(x=>x==='r3-paving').length,1);assert.equal(e.filter(x=>x==='court-binding').length,1);
  assert(h.supports.every(value=>value.disposed));
});

test('actual page cleanup surfaces a decorated-owner release fault while still closing all scene services',async t=>{
  const h=harness({western:true,court:'garden-r3',failCourtCleanup:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);h.ctx.dispose();
  assert.equal(h.ctx.document.body.dataset.ready,'disposed');assert.equal(h.errors.length,1);
  assert.match(h.errors[0].message,/cleanup failed/);assert(h.ctx.composition.disposed);
  assert(h.ctx.composition.snapshot.ensemble.errors.length>0);
  assert(h.supports.every(value=>value.disposed));assert.equal(h.services.get('renderer').disposeCalls,1);
  assert.equal(h.events.filter(e=>e==='court-binding').length,1);
});

// R4 uses the real new study facade above; heavy source IO/geometry and GPU remain
// substituted by the existing tiny complete-composition fixture.
test('actual R4 review route retains its decorated owner, source contract, water and world cameras',async t=>{
  const h=harness({western:true,court:'garden-r4'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);
  assert.equal(h.events.filter(e=>e==='court-r4-wrapper').length,1);assert(!h.events.includes('court-r3-wrapper'));
  const owner=h.ctx.composition.get('xieqiqu').owner;
  assert.equal(owner.group,owner.reviewSourceOwner.group);assert.equal(owner.diagnostics.assetId,'xieqiqu-r9-fish-integration-r1');
  assert.equal(h.ctx.lastCourtLayout.id,'xieqiqu-court-garden-r4-bilberry-leaf-r3');
  assert.equal(h.ctx.lastCourtLayout.sourceProfileEvidence.alphaMap,false);
  assert.equal(h.ctx.composition.snapshot.status,'water-ready');
  assert.equal(h.ctx.composition.snapshot.nativeApproved,false);assert.equal(h.ctx.composition.snapshot.composedWorldApproved,false);
  for(const [id,position,target]of [
    ['north-court-garden-wide',[453,37,-659],[395,12,-582]],
    ['north-court-garden-detail',[409,6,-613],[416,4.6,-602]],
  ]){
    const button=h.plantingButton(id);assert(button);assert.equal(button.disabled,false);button.listeners.click();
    assert.deepEqual(h.ctx.camera.position.toArray(),position);assert.deepEqual(h.ctx.controls.target.toArray(),target);
    assert.equal(h.ctx.composition.snapshot.owners.every(o=>o.visible),true);
  }
  const surface=h.ctx.composition.support.surfaceAt(416.9,-602.45,{maxY:8});assert(Math.abs(surface.height-4.112)<1e-5);
  await h.ctx.visit('xianfaqiao',{teleport:false});await h.ctx.visit('xieqiqu',{teleport:false});assert.equal(h.ctx.sites.resource,owner);
  h.ctx.dispose();assert(owner.disposed);assert(owner.reviewSourceOwner.disposed);
  const e=h.events;assert(e.indexOf('support:xieqiqu')<e.indexOf('r4-paving'));assert(e.indexOf('r4-paving')<e.indexOf('r4-fish'));assert(e.indexOf('r4-fish')<e.indexOf('court-binding'));
  for(const name of ['r4-pixels','r4-paving','r4-fish','r4-pool','court-binding'])assert.equal(e.filter(v=>v===name).length,1);
});

test('actual R4 native first-frame opt-in defers all initial invalidations until one flush',async t=>{
  const h=harness({western:true,court:'garden-r4',nativeFirstFrame:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);assert.equal(h.renders.length,0);
  assert.equal(h.ctx.evidence().nativeInitialFrame.deferred,true);
  for(const id of ['north-court-garden-detail','north-court-garden-wide'])h.plantingButton(id).listeners.click();
  h.ctx.redraw.request();h.ctx.redraw.request();h.drawing.frames.step();assert.equal(h.renders.length,0);
  assert.equal(h.ctx.redraw.flush(),true);assert.equal(h.renders.length,1);assert.equal(h.ctx.evidence().nativeInitialFrame.deferred,false);
  assert.deepEqual(h.ctx.camera.position.toArray(),[453,37,-659]);
  h.ctx.redraw.request();h.ctx.redraw.request();assert.equal(h.drawing.frames.pending.length,1);
  assert.equal(h.ctx.redraw.flush(),true);assert.equal(h.renders.length,2);h.drawing.frames.step();assert.equal(h.renders.length,2);
  h.ctx.dispose();assert.equal(h.ctx.redraw.flush(),false);assert.equal(h.renders.length,2);
});

test('actual R4 still route without initial-frame opt-in keeps ordinary paused redraw scheduling',async t=>{
  const h=harness({western:true,court:'garden-r4'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.redraw.deferred,false);assert.equal(h.ctx.evidence().nativeInitialFrame,undefined);
  h.drawing.frames.step();assert(h.renders.length>0);
});

test('actual R2 review replay still selects its original layout and owner',async t=>{
  const h=harness({western:true,court:'garden-r2'});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);assert.equal(h.ctx.lastCourtLayout.id,'xieqiqu-court-garden-r2');
  assert.equal(h.events.filter(e=>e==='court-wrapper').length,1);assert(!h.events.includes('court-r3-wrapper'));assert(!h.events.includes('court-r4-wrapper'));
  assert(h.plantingButton('north-court-garden-wide'));assert(h.plantingButton('north-court-garden-detail'));
});

for(const court of ['garden-r1','garden-r2','garden-r3'])test('actual '+court+' remains review-only and rejects an ordinary visitor request',async t=>{
  const h=harness({court,review:null});t.after(()=>h.cleanup());
  await assert.rejects(h.ctx.loadSceneBuilding('xieqiqu',{signal:h.ctx.controller.signal}),/explicit Xieqiqu composition/);
  assert.equal(h.events.filter(e=>e.startsWith('load:')||e.includes('wrapper')).length,0);
});

test('actual R4 rejects other composition names and unknown court variants before loading',async t=>{
  for(const settings of [{court:'garden-r4',queryComposition:null},{court:'garden-r4',queryComposition:'other'},{court:'garden-r5'}]){
    const h=harness(settings);try{await assert.rejects(h.ctx.loadSceneBuilding('xieqiqu'),/explicit Xieqiqu composition/);assert.equal(h.events.filter(e=>e.startsWith('load:')||e.includes('wrapper')).length,0);}finally{h.cleanup();}
  }
});

test('ordinary and composed visitors without a court query retain the original model loader',async t=>{
  for(const queryComposition of [null,'xianfaqiao']){
    const h=harness({review:null,queryComposition});try{const owner=await h.ctx.loadSceneBuilding('xieqiqu');assert.equal(owner,h.owners.get('xieqiqu'));assert.deepEqual(h.events.filter(e=>e.startsWith('load:')||e.includes('wrapper')),['load:xieqiqu']);}finally{h.cleanup();}
  }
});

test('actual R4 cleanup failure stays visible while all page services close',async t=>{
  const h=harness({western:true,court:'garden-r4',failCourtCleanup:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.deepEqual(h.errors,[]);h.ctx.dispose();assert.equal(h.errors.length,1);assert.match(h.errors[0].message,/cleanup failed/);
  assert(h.ctx.composition.disposed);assert(h.supports.every(value=>value.disposed));assert.equal(h.services.get('renderer').disposeCalls,1);
  assert.equal(h.events.filter(e=>e==='court-binding').length,1);
});

test('actual visitor R4 URL without review retains the full pair, water and source quality',async t=>{
  const h=harness({western:true,court:'garden-r4',review:null});t.after(()=>h.cleanup());h.ctx.query.delete('site');
  assert.equal(h.ctx.query.has('review'),false);assert.equal(h.ctx.reviewPaused,false);
  await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);
  assert.equal(h.events.filter(event=>event==='court-r4-wrapper').length,1);
  const owner=h.ctx.composition.get('xieqiqu').owner,snapshot=h.ctx.composition.snapshot;
  assert.equal(owner.group,owner.reviewSourceOwner.group);assert.equal(owner.diagnostics.assetId,'xieqiqu-r9-fish-integration-r1');
  assert.equal(owner.diagnostics.publicAdmission,false);assert.equal(owner.diagnostics.historicalLayoutVerified,false);
  assert.equal(snapshot.nativeApproved,false);assert.equal(snapshot.composedWorldApproved,false);
  assert.equal(snapshot.waterBound,true);assert(snapshot.owners.every(value=>value.visible));
  assert.equal(h.ctx.groundTextures.resolution,'4k');assert.equal(h.ctx.rendering.samples,4);assert.equal(h.ctx.reviewPaused,false);
  await h.ctx.visit('xianfaqiao',{teleport:false});await h.ctx.visit('xieqiqu',{teleport:false});
  assert.equal(h.ctx.sites.resource,owner);assert.equal(owner.disposed,false);
  h.ctx.dispose();assert.equal(owner.disposed,true);assert(h.supports.every(value=>value.disposed));
  assert.equal(h.events.filter(event=>event==='r4-paving').length,1);assert.equal(h.services.get('renderer').disposeCalls,1);
});

for(const aspect of [1.6,9/16])test('R4 north retreat uses actual follow, navigation and E fallback at aspect '+aspect,async t=>{
  // This bounded fixture needs land north of the retreated visitor; it does not extend the source paving.
  const h=harness({court:'garden-r4',review:null,realFlight:true,aspect,terrainNorth:-650});t.after(()=>h.cleanup());h.ctx.query.delete('site');
  await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);
  const {ctx}=h,near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
  const vectorNear=(a,b)=>a.forEach((value,index)=>near(value,b[index]));
  vectorNear(Object.values(ctx.state.position),[395,17,-620]);
  vectorNear(ctx.camera.position.toArray(),[395,22,-632.6491106406736]);
  vectorNear(ctx.controls.target.toArray(),[395,18,-620]);
  assert.deepEqual(ctx.currentSite.guide,[-45,.04,-5]);assert.deepEqual(ctx.currentSite.focus,[-26,5,17]);
  assert.equal(ctx.state.mode,'flying');assert.equal(ctx.composition.snapshot.nativeApproved,false);
  assert.equal(ctx.composition.snapshot.composedWorldApproved,false);
  assert.equal(ctx.camera.fov,45);assert.equal(ctx.camera.near,.08);assert.equal(ctx.camera.far,22000);assert.equal(ctx.camera.zoom,1);
  const terrainHit=ctx.terrain.surfaceAt(ctx.state.position.x,ctx.state.position.z);
  assert.equal(terrainHit.kind,'land');assert.equal(terrainHit.supportSource,'terrain-triangle');
  assert.equal(ctx.architecture.surfaceAt(ctx.state.position.x,ctx.state.position.z),null,'retreated arrival is outside the source paving');
  const floor=ctx.nav.landing(ctx.state.position);assert.equal(floor.valid,true);near(floor.y,terrainHit.height);
  assert(ctx.state.position.y>=terrainHit.height+6,'normal flight clearance still uses the actual fixture triangles');
  t.diagnostic(JSON.stringify({fixtureOnly:true,aspect,arrival:ctx.state.position,terrainY:terrainHit.height,landingY:floor.y,supportSource:terrainHit.supportSource}));
  const look=ctx.camera.getWorldDirection(new THREE.Vector3());near(look.x,0);assert(look.z>.95);
  const avatarForward=new THREE.Vector3(-Math.sin(ctx.state.heading),0,-Math.cos(ctx.state.heading));
  near(ctx.visitor.group.rotation.y,ctx.state.heading);
  near(avatarForward.dot(look.clone().setY(0).normalize()),0.9405538996916956);
  // Authored north openings are projected by the actual current page camera.
  const screen=local=>{const p=sitePoint(ctx.currentSite,local),v=new THREE.Vector3(p.x,p.y,p.z).project(ctx.camera);return [(v.x+1)/2,(1-v.y)/2];};
  vectorNear(screen([0,8.06,-8]),[.5,.3284719933446635]);
  vectorNear(screen([0,2.2,-16]),[.5,.48864435082271473]);
  assert.equal(ctx.guides.snapshot().actors.length,0);assert.equal(ctx.guides.nearest(ctx.state.position),null);ctx.inspect();assert.deepEqual(h.reads,[ctx.currentSite.entryId]);
  const before={...ctx.state.position},cameraBefore=ctx.camera.position.clone(),targetBefore=ctx.controls.target.clone();
  ctx.keys.add('KeyW');ctx.advance(.1);ctx.keys.clear();
  near(ctx.state.position.x,before.x);near(ctx.state.position.z-before.z,2.8);
  const delta=new THREE.Vector3(ctx.state.position.x-before.x,ctx.state.position.y-before.y,ctx.state.position.z-before.z);
  vectorNear(ctx.camera.position.clone().sub(cameraBefore).toArray(),delta.toArray());
  vectorNear(ctx.controls.target.clone().sub(targetBefore).toArray(),delta.toArray());
  assert.equal(ctx.lastFlightPlanting,null);
});

test('actual default, R1, R2 and R3 composition visitors keep the established arrival and follow camera',async()=>{
  for(const court of [false,'garden-r1','garden-r2','garden-r3']){
    const h=harness({court,realFlight:true});h.ctx.query.delete('site');
    try{
      await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);
      const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
      Object.values(h.ctx.state.position).forEach((value,index)=>near(value,[347,14,-566.77][index]));
      h.ctx.camera.position.toArray().forEach((value,index)=>near(value,[351,19,-554.77][index]));
      h.ctx.controls.target.toArray().forEach((value,index)=>near(value,[347,15,-566.77][index]));
      assert.deepEqual(h.ctx.currentSite.guide,[-45,.04,-5]);assert.deepEqual(h.ctx.currentSite.focus,[-26,5,17]);
      assert.equal(h.ctx.currentSite.viewYaw,undefined);assert.equal(h.events.includes('court-r4-wrapper'),false);
      assert.equal(h.ctx.composition.snapshot.nativeApproved,false);assert.equal(h.ctx.composition.snapshot.composedWorldApproved,false);
    }finally{h.cleanup();}
  }
});


test('ordinary visitors keep review tools hidden and unbuilt while explicit review retains them',async()=>{
  for(const review of [null,'still']){
    const h=harness({western:true,court:'garden-r4',review});
    try{
      assert.equal(h.ctx.$('review-tools').hidden,!review);
      await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.ready,true);
      const panel=h.ctx.$('review-tools');assert.equal(panel.hidden,!review);assert.equal(panel.open,Boolean(review));
      const pair=h.ctx.composition;
      for(const language of ['zh','en']){
        h.ctx.lang=language;h.ctx.renderMap();
        assert.equal(h.ctx.$('garden-map').children[0]['aria-label'],language==='zh'?'谐奇趣与线法桥位置图':'Map of Xieqiqu and Xianfaqiao');
        // This small composition fixture's coast helper reads its owner;
        // retain that polygon while exercising the actual noncomposition map.
        const coast=h.ctx.createExhibitionCoast(h.ctx.gardenLayout),coastFactory=h.ctx.createExhibitionCoast;
        try{
          h.ctx.createExhibitionCoast=()=>coast;h.ctx.composition=null;h.ctx.renderMap();
          assert.equal(h.ctx.$('garden-map').children[0]['aria-label'],language==='zh'?'圆明三园位置图':'Map of the three gardens');
        }finally{h.ctx.composition=pair;h.ctx.createExhibitionCoast=coastFactory;}
      }
      h.ctx.lang='en';h.ctx.renderMap();
      if(review){assert(h.button('route-start'));assert(h.button('visit-xieqiqu'));}
      else{assert.equal(panel.children.length,0);assert.equal(h.ctx.reviewPaused,false);h.ctx.inspect();assert.deepEqual(h.reads,['xieqiqu']);}
      assert.deepEqual(h.ctx.$('destinations').children.map(node=>node.dataset.site),['xieqiqu','xianfaqiao']);
    }finally{h.cleanup();}
  }
});

// Execute the actual bilingual copy block and setLanguage function. The DOM
// substitutes text targets only; this is not a browser focus-order simulation.
test('actual R4 and generic copy updates both languages, E help and two-site scope',()=>{
  for(const search of ['composition=xianfaqiao&court=garden-r4','','composition=other']){
    const nodes=new Map(),labels=['mapTitle','mapIntro','study'].map(key=>({dataset:{copy:key},textContent:''}));
    const get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',options:[]});return nodes.get(id);};
    get('time-mode').options=['auto','day','night'].map(value=>({value,textContent:''}));
    const ctx={query:new URLSearchParams(search),document:{documentElement:{},querySelectorAll:()=>labels},$:get,
      reader:{lang:'en',setLanguage(value){this.lang=value;}},directory:{setLanguage(){}},guides:null,
      renderDestinations(){},locationCaption(){},syncControls(){}};
    vm.createContext(ctx);
    vm.runInContext(section('const copy={','\nlet lang=')+'\nlet lang;\n'+section('function setLanguage(','\nfunction locationCaption(')+'\nthis.applyLanguage=setLanguage;this.actualCopy=copy;',ctx);
    for(const language of ['en','zh']){
      ctx.applyLanguage(language);assert.equal(ctx.document.documentElement.lang,language);
      const two=search.startsWith('composition=xianfaqiao'),text=Object.fromEntries(labels.map(n=>[n.dataset.copy,n.textContent]));
      assert.equal(text.mapTitle,two?(language==='zh'?'谐奇趣与线法桥':'Xieqiqu & Xianfaqiao'):(language==='zh'?'圆明三园':'The three gardens'));
      assert.equal(text.mapIntro,ctx.actualCopy[language].mapIntro);assert.equal(text.study,ctx.actualCopy[language].study);
      assert.match(get('help-copy').textContent,language==='zh'?/按 E 阅读当前展签/:/Press E to read the current exhibit/);
      assert.doesNotMatch(text.study+text.mapIntro,/nativeApproved|fullResolutionVerified|garden-r4|Bilberry/);
      if(two)assert.match(text.mapIntro,language==='zh'?/其余园区仍在制作/:/Other areas are still in production/);
      assert.equal(get('language').textContent,language==='zh'?'EN':'中');
    }
  }
});

function readerFixtureDocument(){
  const doc={activeElement:null};
  const match=(node,selector)=>{
    if(selector==='[hidden],[inert]')return !!node.hidden||!!node.inert;
    const attr=selector.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);
    if(attr){const key=attr[1].replace(/-([a-z])/g,(_m,l)=>l.toUpperCase());return node.dataset[key]===attr[2];}
    return node.tagName===selector.toUpperCase();
  };
  const make=tag=>{
    const node={ownerDocument:doc,tagName:tag.toUpperCase(),children:[],parentElement:null,dataset:{},listeners:new Map(),hidden:false,inert:false,open:false,textContent:'',focusCalls:0,
      classList:{toggle(){}},setAttribute(k,v){this[k]=String(v);},
      append(...children){for(const child of children){child.remove();child.parentElement=this;this.children.push(child);}},
      remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}},
      replaceChildren(...children){for(const child of [...this.children])child.remove();this.append(...children);},
      contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;},
      closest(selector){for(let n=this;n;n=n.parentElement)if(match(n,selector))return n;return null;},
      querySelector(selector){for(const child of this.children){if(match(child,selector))return child;const found=child.querySelector(selector);if(found)return found;}return null;},
      addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);},
      focus(){this.focusCalls++;doc.activeElement=this;},
      showModal(){this.open=true;},close(){this.open=false;this.listeners.get('close')?.();},
    };
    Object.defineProperty(node,'isConnected',{get(){for(let n=this;n;n=n.parentElement)if(n===doc.body)return true;return false;}});
    return node;
  };
  doc.createElement=make;doc.body=make('body');doc.getElementById=id=>{
    const visit=node=>{if(node.id===id)return node;for(const child of node.children){const found=visit(child);if(found)return found;}return null;};return visit(doc.body);
  };
  return doc;
}

test('ordinary R4 E uses the real reader, closes back to visible Inspect and never restores hidden review focus',async t=>{
  const h=harness({court:'garden-r4',review:null});t.after(()=>h.cleanup());h.ctx.query.delete('site');
  await h.ctx.bootstrap();assert.deepEqual(h.errors,[]);assert.equal(h.ctx.$('review-tools').hidden,true);assert.equal(h.ctx.$('review-tools').children.length,0);
  const doc=readerFixtureDocument(),inspect=doc.createElement('button'),tools=doc.createElement('details'),engineer=doc.createElement('button');
  inspect.id='inspect';tools.hidden=true;tools.id='review-tools';engineer.id='review-hidden-camera';tools.append(engineer);doc.body.append(inspect,tools);h.nodes.set('inspect',inspect);
  const stub=h.ctx.reader;stub.dispose();
  h.ctx.MuseumReader=class extends MuseumReader{constructor(options){super({...options,parent:doc.body});}};
  h.ctx.audio.play=()=>{};h.ctx.setLanguage=value=>{h.ctx.lang=value;};
  const creation=source.split('\n').find(line=>line.startsWith('const reader=new MuseumReader('));assert(creation);
  vm.runInContext(creation.replace('const reader=','this.reader='),h.ctx);
  const reader=h.ctx.reader;inspect.focus();h.ctx.inspect();
  assert.equal(reader.isOpen,true);assert.equal(reader.current.id,'xieqiqu');assert.equal(reader.returnFocus,inspect);assert(reader.dialog.contains(doc.activeElement));
  reader.setLanguage('zh');assert.equal(reader.dialog.querySelector('h2').textContent,'谐奇趣');
  assert.match(reader.dialog.querySelector('article').children.find(n=>n.className==='museum-evidence-note').children[1].textContent,/当代展陈设计/);
  let prevented=false;reader.dialog.listeners.get('cancel')({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(reader.isOpen,false);assert.equal(doc.activeElement,inspect);assert.equal(h.ctx.reviewPaused,false);
  // An obsolete or hidden control must never regain focus on reader exit.
  reader.open('xieqiqu',{trigger:engineer});reader.close();assert.equal(engineer.focusCalls,0);
  assert.equal(h.ctx.$('review-tools').hidden,true);assert.equal(h.ctx.$('review-tools').children.length,0);
  h.ctx.dispose();assert.equal(reader.disposed,true);assert.equal(reader.dialog.isConnected,false);
});
