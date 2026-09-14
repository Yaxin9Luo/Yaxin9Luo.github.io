import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';
import {createMuseumGuideEnsemble} from '../src/yuanmingyuan/museum-guide-ensemble.js';
import {createMuseumGuides} from '../src/yuanmingyuan/museum-guides.js';
import * as THREE from 'three';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {createPersistentEnsemble} from '../src/yuanmingyuan/persistent-ensemble.js';
import {createXianfaqiaoSitePatch,activateXianfaqiaoSitePatch,bindXianfaqiaoSourceWater} from '../src/yuanmingyuan/xianfaqiao-site-patch.js';
import {createMuseumLandscape} from '../src/yuanmingyuan/museum-landscape.js';
import {bindXieqiquFountainWater} from '../src/yuanmingyuan/xieqiqu-court-ground.js';
import {museumSite} from '../src/yuanmingyuan/museum-sites.js';
import {placeMuseumStaticAsset} from '../src/yuanmingyuan/museum-static-batch.js';
import {xianfaqiaoArchive} from '../src/yuanmingyuan/xianfaqiao-integration.js';
import {compositionOwner,compositionGround} from './helpers/xianfaqiao-composition-fixture.js';

const source=await readFile(process.env.MUSEUM_SCENE_UNDER_TEST?pathToFileURL(process.env.MUSEUM_SCENE_UNDER_TEST):new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
function between(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert(a>=0&&b>a,'Missing actual scene boundary: '+start);
  return source.slice(a,b);
}
const wiring=[
  between('function isJiuzhouComposition()', 'function renderMap('),
  between('function releaseSceneShoreGrove()', 'function currentPlantingCollision('),
  between('function failComposedScene(', 'function render(dt)'),
  between('function placeGuides(','async function visit('),
  between('async function visit(','function advance('),
  between('// A failed composition bootstrap','function busy('),
  between('async function prepareMuseumGround()','// Regional planting'),
  between('function render(dt)','function tick('),
  between('function dispose(){','setLanguage(lang);'),
  between('function showGraphicsRecovery()','function setReviewPaused('),
  between('function inspect(){','function toggleFlight(){'),
  between('function keydown(event){',"document.addEventListener('keydown'"),
  between('sites=createMuseumSiteController({','  const sceneResidentDescriptors='),
].join('\n');
const ids=['xieqiqu','xianfaqiao'];

// Only heavyweight mesh/asset/DOM boundaries are small fixtures. Selection,
// load/release/mount cleanup, visit/reset, scene dispose, ensemble and real NPC
// controllers all execute their actual source. No WebGL/native/art/FPS claim.
function fixture({composed=true,resident=false,throwPool=false,perSite=1}={}){
  const root=new Group(),events=[],records=[],owners=[],logged=[],lifetime=new AbortController(),page=new EventTarget(),canvas=new EventTarget(),elements=new Map();
  const sites=ids.map((id,i)=>({id,assetId:id,entryId:id,arrival:[i*10,8,0],focus:[i*10,4,0],guide:[i*10,0,0]}));
  const support=()=>({disposed:false,dispose(){if(this.disposed)return;this.disposed=true;events.push('support');}});
  const shared=support(),retainedRecords=new Map(),residentBindings=new Map();
  let compositionDisposed=false,failBorrow=null,cleanupError=null;
  function ownerFor(site){
    const owner={id:site.id,group:new Group(),disposed:false,disposeCount:0,dispose(){if(this.disposed)return;this.disposed=true;this.disposeCount++;events.push(site.id+':source');this.group.removeFromParent();}};
    owners.push(owner);return owner;
  }
  if(composed||resident)for(const site of sites){
    const owner=ownerFor(site),record={owner,support:support(),descriptor:{id:site.id}};root.add(owner.group);
    retainedRecords.set(site.id,record);residentBindings.set(owner,record);
  }
  const retained={
    get:id=>retainedRecords.get(id),
    async borrow(id){events.push(id+':borrow');if(failBorrow===id){failBorrow=null;throw new Error('simulated asset borrow failure');}assert(!compositionDisposed);return retainedRecords.get(id).owner;},
    release(owner){assert(owners.includes(owner));events.push(owner.id+':return');},
    dispose(){for(const record of retainedRecords.values()){record.support.dispose();record.owner.dispose();}shared.dispose();},
  };
  const composition=composed?{
    sites,support:shared,...retained,
    get disposed(){return compositionDisposed;},get cleanupError(){return cleanupError;},
    dispose(){
      if(compositionDisposed)return;compositionDisposed=true;events.push('composition');
      const errors=[];try{assert(records.every(record=>record.worldDisposed&&record.poolDisposed),'all guide worlds and actors must retire before persistent source supports');}catch(error){errors.push(error);}
      shared.dispose();
      for(const record of retainedRecords.values()){record.support.dispose();record.owner.dispose();}
      if(errors.length){cleanupError=new AggregateError(errors,'composition cleanup failure');throw cleanupError;}
    },
  }:null;
  if(composition)lifetime.signal.addEventListener('abort',()=>{try{composition.dispose();}catch{}},{once:true});
  function createGuideRegion(site){
    const record={siteId:site.id,poolDisposed:false,worldDisposed:false,actorDisposeCount:0,worldDisposeCount:0,actor:null,actors:[]};
    const borrowedSupport=context.architecture,point={x:site.id===ids[0]?0:10,y:4,z:0};
    const pool={create(){
      const actor=new Group(),model=new Group();model.add(new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial()));actor.add(model);record.actors.push(actor);record.actor??=actor;
      return {group:actor,model,asset:{sha256:'fixture-only',durations:{sign_raise:1,sign_lower:1}},footStates:new Map(),
        setAction(){},setSign(){},setLanguage(){},update(){},dispose(){record.actorDisposeCount++;actor.removeFromParent();model.children[0].geometry.dispose();model.children[0].material.dispose();events.push(site.id+':actor');}};
    }};
    const world={heightAt:()=>{assert(!borrowedSupport.disposed);return 4;},waterLevel:2,colliders:[],
      placementReview:{accepted:1},snapshot:()=>({disposed:record.worldDisposed}),
      dispose(){if(record.worldDisposed)throw new Error('guide world disposed twice');record.worldDisposed=true;record.worldDisposeCount++;events.push(site.id+':world');assert(!borrowedSupport.disposed,'guide support closes before its borrowed building support');}};
    const guides=createMuseumGuides({pool,root,...world,onInspect:({entryId})=>context.reader.open(entryId),placements:Array.from({length:perSite},(_,i)=>({id:site.id+'-guide'+(perSite>1?'-'+i:''),entryId:site.id,position:{...point,z:i*3},heading:0,waypoints:[]}))});
    const original=guides.dispose;guides.dispose=()=>{assert(!record.poolDisposed,'guide pool disposed once');record.poolDisposed=true;original();events.push(site.id+':pool');if(throwPool)throw new Error('actor callback cleanup failure');};
    Object.assign(record,{guides,world,borrowedSupport});records.push(record);return {guides,world};
  }
  const context={
    query:new URLSearchParams(composed?'composition=xianfaqiao':''),
    shoreGrove:null,shoreGroveLifetime:null,shoreGroveStatus:'idle',
    AbortController,AggregateError,console:{error:error=>logged.push(error)},composition,residents:resident?retained:null,residentBindings,borrowedOwners:new WeakSet(),residentArchitecture:resident?shared:null,
    createMuseumSiteController,createMuseumGuideEnsemble,createGuideRegion,
    museumSites:sites,museumSite:id=>sites.find(site=>site.id===id),guides:null,guideSurface:null,pool:{dispose(){events.push('asset-pool');}},lang:'en',
    disposed:false,loading:false,contextLost:false,sites:null,currentSite:null,ready:true,controller:lifetime,architecture:null,
    scene:root,createArchitectureSurface:()=>support(),createArchitectureEnsemble:()=>support(),
    loadSceneBuilding:async id=>ownerFor(sites.find(site=>site.id===id)),placeMuseumLandscapeAsset(){},prepareMuseumRendering:async owner=>owner,
    createMoundGroundMaterialBinding(){throw new Error('not a mound site');},terrain:{dispose(){events.push('terrain');}},
    terrainAssets:{attach:()=>()=>events.push('terrain-unbind'),dispose(){events.push('terrain-assets');}},
    copy:{en:{building:'building',failed:'failed'}},locationCaption(){},syncControls(){},message(){},westernPlanting:null,westernPlantingLifetime:null,
    reviewMotion:null,reviewMotionResult:null,state:{position:{x:0,y:8,z:0}},visitor:{group:new Group(),dispose(){events.push('visitor');}},
    sitePoint:(_site,p)=>({x:p[0],y:p[1],z:p[2]}),museumTravelHeading:()=>0,resetCharacterMotion(){},frameVisitor(){},
    audio:{setEmitter(){},setSuspended(value){events.push('audio-suspended:'+value);},dispose(){events.push('audio');}},advance(){},redraw:{request(){},cancel(){},dispose(){}},
    $:id=>{if(!elements.has(id)){const element=new EventTarget();Object.assign(element,{textContent:'',hidden:true});elements.set(id,element);}return elements.get(id);},evidence:()=>({}),start(){},
    touch:{clear(){}},canvas,location:{reload(){events.push('reload');}},addEventListener:(...args)=>page.addEventListener(...args),
    keys:new Set(),movementCodes:new Set(['KeyW']),raf:0,cancelAnimationFrame(){},observer:{disconnect(){}},document:{body:{dataset:{}},removeEventListener(){}},removeEventListener:(...args)=>page.removeEventListener(...args),keyup(){},clearKeys(){},
    reader:{open(entryId){events.push('read:'+entryId);},dispose(){}},directory:{dispose(){}},plantingCollisions:null,shoreCommunity:null,shoreBank:null,shoreUnderstory:null,plantingPilot:null,
    preparedGroundSources:null,water:null,groundTextures:null,environment:null,controls:null,rendering:null,renderer:null,nav:null,
  };
  context.copy.en.graphicsLost='Reload scene or read historical exhibits.';context.copy.en.guide='The guide is raising its sign.';
  context.paused=()=>context.disposed||context.contextLost||!context.ready||context.loading;
  context.busy=value=>{context.loading=value;};vm.createContext(context);vm.runInContext(wiring,context);
  return {context,root,page,canvas,events,records,owners,logged,failNextBorrow(id){failBorrow=id;},cleanup(){
    context.dispose();if(resident){for(const record of retainedRecords.values()){record.support.dispose();record.owner.dispose();}shared.dispose();}
  }};
}
test('real select and mount cleanup preserve NPC identity and interaction across repeated automatic focus changes',async()=>{
  const f=fixture();try{
    await f.context.visit(ids[0]);const first=f.records[0],group=first.actor,owner=first.guides.snapshot().owner,ensemble=f.context.guides;
    assert(ensemble.interact('xieqiqu-guide',{playerPosition:{x:0,y:4,z:4.8}}));const pose=first.guides.snapshot().actors[0].position;
    await f.context.visit(ids[1],{teleport:false});
    assert.equal(first.poolDisposed,false);assert.equal(first.worldDisposed,false);assert.equal(f.context.guides,ensemble);assert.equal(first.actor,group);assert.equal(group.parent,f.root);
    assert.equal(first.guides.snapshot().owner,owner);assert.deepEqual(first.guides.snapshot().actors[0].position,pose);assert.equal(first.guides.snapshot().actors[0].interactionCount,1);
    assert.equal(first.guides.snapshot().actors[0].busy,true);assert.equal(f.context.sites.snapshot.siteId,ids[1]);assert.equal(f.context.sites.resource.id,ids[1]);
    for(const id of [ids[0],ids[1],ids[0]])await f.context.visit(id,{teleport:false});
    assert.equal(f.records.length,2);assert.equal(f.context.guides.colliders.length,2);assert.equal(f.context.guides.pickMeshes.length,2);
    assert.equal(f.events.filter(e=>e.endsWith(':return')).length,4);assert(f.owners.every(owner=>!owner.disposed));
  }finally{f.cleanup();}
});
test('real selection keeps nearest and E candidates from a previously focused site',async()=>{
  const f=fixture();try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});const player={x:0,y:4,z:4.8};
    const nearest=f.context.guides.nearest(player);assert.equal(nearest?.id,'xieqiqu-guide');assert.equal(nearest?.entryId,'xieqiqu');
    f.context.state.position=player;let prevented=false;
    f.context.keydown({target:{closest:()=>null},code:'KeyE',preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(f.records[0].guides.snapshot().actors[0].interactionCount,1);assert(!f.events.some(event=>event.startsWith('read:')));
    for(let i=0;i<20;i++)f.context.guides.update(.1,{playerPosition:player});assert(f.events.includes('read:xieqiqu'),'the retained NPC raises its sign before opening its own exhibit');
    assert.equal(f.context.guides.nearest({x:0,y:12,z:4.8}),null);
  }finally{f.cleanup();}
});
test('actual map travel resets generated NPCs both at the same site and at another destination',async()=>{
  const f=fixture();try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});const old=f.records.slice(),previousOwner=old[1].guides.snapshot().owner;
    await f.context.visit(ids[1]);assert(old.every(record=>record.poolDisposed&&record.worldDisposed));assert.equal(f.context.guides.snapshot().actors.length,1);
    assert.notEqual(f.records.at(-1).guides.snapshot().owner,previousOwner);assert.equal(f.context.state.position.x,10);assert.equal(f.context.state.mode,'flying');
    const previous=f.records.at(-1);await f.context.visit(ids[0]);assert(previous.poolDisposed&&previous.worldDisposed);assert.equal(f.context.guides.snapshot().actors[0].id,'xieqiqu-guide');
    assert(f.owners.every(owner=>!owner.disposed));
  }finally{f.cleanup();}
});
test('actual pagehide disposal retires every guide and its world before abort releases persistent architecture',async()=>{
  const f=fixture();await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});
  f.page.dispatchEvent(new Event('pagehide'));assert.equal(f.logged.length,0);assert.equal(f.context.document.body.dataset.ready,'disposed');assert.equal(f.context.sites.snapshot.status,'disposed');
  assert(f.records.every(record=>record.poolDisposed&&record.worldDisposed&&record.actorDisposeCount===1&&record.worldDisposeCount===1));
  assert(f.owners.every(owner=>owner.disposed&&owner.disposeCount===1));assert.equal(f.root.children.length,0);
  const compositionAt=f.events.indexOf('composition'),lastWorld=Math.max(...f.events.map((e,i)=>e.endsWith(':world')?i:-1));assert(lastWorld<compositionAt);
  const length=f.events.length;f.cleanup();assert.equal(f.events.length,length);
});
test('failed automatic borrow leaves existing NPCs alive and retry can mount the next site',async()=>{
  const f=fixture();try{
    await f.context.visit(ids[0]);const first=f.records[0];f.failNextBorrow(ids[1]);await f.context.visit(ids[1],{teleport:false});
    assert.equal(f.context.sites.snapshot.status,'failed');assert.equal(f.context.currentSite.id,ids[0]);assert.equal(first.poolDisposed,false);
    assert.equal(first.actor.parent,f.root);assert.equal(f.context.guides.nearest({x:0,y:4,z:4.8}).id,'xieqiqu-guide');
    await f.context.visit(ids[1],{teleport:false});assert.equal(f.context.sites.snapshot.status,'ready');assert.equal(first.poolDisposed,false);assert.equal(f.records.length,2);
  }finally{f.cleanup();}
});
test('scene failure cleanup releases retained guides, borrowed site and all sources in dependency order',async()=>{
  const f=fixture();await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});
  const errors=f.context.releaseCompositionScene();assert.equal(errors.length,0);assert.equal(f.context.guides,null);assert.equal(f.context.guideSurface,null);assert.equal(f.context.sites,null);
  assert(f.records.every(record=>record.poolDisposed&&record.worldDisposed));assert(f.owners.every(owner=>owner.disposed));
  assert(Math.max(...f.events.map((e,i)=>e.endsWith(':world')?i:-1))<f.events.indexOf('composition'));
  f.cleanup();assert.equal(f.logged.length,0);
});
for(const resident of [false,true])test('actual non-composition selection still rebuilds its single guide pool ('+(resident?'retained resident':'transient source')+')',async()=>{
  const f=fixture({composed:false,resident});try{
    await f.context.visit(ids[0]);const first=f.records[0];await f.context.visit(ids[1],{teleport:false});
    assert(first.poolDisposed&&first.worldDisposed);assert.equal(f.context.guides.snapshot().actors.length,1);assert.equal(f.context.guides.snapshot().actors[0].id,'xianfaqiao-guide');
    if(resident)assert(f.owners.every(owner=>!owner.disposed));else assert(f.owners[0].disposed);
  }finally{f.cleanup();}assert.equal(f.logged.length,0);
});
test('throwing NPC cleanup cannot skip another pool, its support, source owners or later idempotent exit',async()=>{
  const f=fixture({throwPool:true});await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});f.cleanup();
  assert(f.records.every(record=>record.poolDisposed&&record.worldDisposed));assert(f.owners.every(owner=>owner.disposed));
  assert.equal(f.logged.length,1);assert.match(f.logged[0].message,/cleanup failed/);assert.equal(f.root.children.length,0);
  const length=f.events.length;f.cleanup();assert.equal(f.events.length,length);
});

test('repeated actual selection retains at most six original guide actors across the two-site exhibition',async()=>{
  const f=fixture({perSite:3});try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});
    const actors=f.records.flatMap(record=>record.actors),owners=f.context.guides.snapshot().retainedSites.map(site=>site.owner);
    for(const id of [ids[0],ids[1],ids[0],ids[1]])await f.context.visit(id,{teleport:false});
    assert.equal(f.records.length,2);assert.equal(f.context.guides.snapshot().actors.length,6);
    assert.equal(f.context.guides.colliders.length,6);assert.equal(f.context.guides.pickMeshes.length,6);
    assert.deepEqual(f.context.guides.snapshot().retainedSites.map(site=>site.owner),owners);assert(actors.every(actor=>actor.parent===f.root));
  }finally{f.cleanup();}
  assert(f.records.every(record=>record.actorDisposeCount===3&&record.worldDisposeCount===1));assert.equal(f.logged.length,0);
});
test('context loss retains an unavailable reader state, then actual pagehide releases NPCs before architecture',async()=>{
  const f=fixture();try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});
    const lost=new Event('webglcontextlost',{cancelable:true});f.canvas.dispatchEvent(lost);
    assert.equal(lost.defaultPrevented,true);assert.equal(f.context.contextLost,true);assert.equal(f.context.document.body.dataset.ready,'context-lost');
    assert(f.records.every(record=>!record.poolDisposed&&!record.worldDisposed));assert(f.owners.every(owner=>!owner.disposed));
    const count=f.records.length;await f.context.visit(ids[0]);assert.equal(f.records.length,count);assert.equal(f.context.currentSite.id,ids[1]);
    f.canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(f.context.document.body.dataset.ready,'context-lost');
    f.page.dispatchEvent(new Event('pagehide'));assert(f.records.every(record=>record.poolDisposed&&record.worldDisposed));assert.equal(f.logged.length,0);
    assert(Math.max(...f.events.map((e,i)=>e.endsWith(':world')?i:-1))<f.events.indexOf('composition'));
  }finally{f.cleanup();}
});

const compositionSource=await readFile(process.env.MUSEUM_COMPOSITION_UNDER_TEST?pathToFileURL(process.env.MUSEUM_COMPOSITION_UNDER_TEST):new URL('../src/yuanmingyuan/xianfaqiao-composition.js',import.meta.url),'utf8');
function actualComposition(options){
  // Keep every composition, persistent-owner, triangle-support, water handoff
  // and failure/disposal operation real; only the complete factory is replaced
  // by the existing small real-geometry source fixture.
  const scope={AbortController,DOMException,AggregateError,createPersistentEnsemble,createXianfaqiaoSitePatch,activateXianfaqiaoSitePatch,bindXianfaqiaoSourceWater,
    createMuseumLandscape,bindXieqiquFountainWater,museumSite,placeMuseumStaticAsset,xianfaqiaoArchive};
  vm.createContext(scope);vm.runInContext(compositionSource.replace(/^import .*;\n/gm,'').replaceAll('export function ','function '),scope);
  return scope.createXianfaqiaoComposition(options);
}
async function actualCompositionFixture(options={}){
  const f=fixture({composed:false,...options}),owners=new Map(ids.map(id=>[id,compositionOwner(id,f.events)]));
  Object.assign(f.context,{THREE,query:new URLSearchParams('composition=xianfaqiao'),createXianfaqiaoComposition:actualComposition,
    loadSceneBuilding:async id=>owners.get(id),renderDestinations(){},gardenLayout:null,terrainPads:[],terrainCourts:[],terrainPaths:[],terrainReplacements:[],
    camera:new THREE.PerspectiveCamera(),dialogs:[],time:0,sceneFailure:null});
  // The actual prepareMuseumGround() call must supply its own disposal hook.
  await f.context.prepareMuseumGround();const composition=f.context.composition,ground=compositionGround(composition.plan);composition.bindWater(ground);
  const supports=[composition.support,...ids.map(id=>composition.get(id).support)];
  for(const support of supports){const release=support.dispose;support.dispose=()=>{f.events.push('architecture');return release.call(support);};}
  Object.assign(f.context,{terrain:ground.terrain,water:ground.water,environment:{update:()=>({night:0,lightDirection:new THREE.Vector3(1,1,1),key:new THREE.Color(0xffffff),keyIntensity:1,water:new THREE.Color(0x75a48c)}),dispose(){}},controls:{target:new THREE.Vector3(),dispose(){}},
    renderer:{shadowMap:{needsUpdate:false},info:{reset(){}},dispose(){}},rendering:{render(){},dispose(){}}});
  Object.assign(f.context.audio,{update(){},silence(){}});
  return {...f,sourceOwners:owners,composition,supports,ground};
}
function assertDependencyOrder(f){
  assert.equal(f.records.length,2);assert(f.records.every(record=>record.actorDisposeCount===1&&record.worldDisposeCount===1));
  assert(f.supports.every(support=>support.disposed));assert([...f.sourceOwners.values()].every(owner=>owner.disposed&&owner.disposeCalls===1));
  const lastActor=Math.max(...f.events.map((event,i)=>event.endsWith(':actor')?i:-1)),firstWorld=f.events.findIndex(event=>event.endsWith(':world'));
  const lastWorld=Math.max(...f.events.map((event,i)=>event.endsWith(':world')?i:-1)),firstSupport=f.events.indexOf('architecture');
  assert(lastActor>=0&&firstWorld>lastActor,'every actor must retire before the first guide world');
  assert(lastWorld>=0&&firstSupport>lastWorld,'every guide world must retire before any real architecture support');
  for(const owner of f.sourceOwners.values())assert(owner.disposedSheets.every(sheet=>sheet.visible&&sheet.navigation===undefined),'water handoff restores original sheets before source release');
}
test('actual owner update failure reaches the scene hook before real composition supports and sources retire',async()=>{
  const f=await actualCompositionFixture();try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});
    f.sourceOwners.get(ids[0]).update=()=>{throw new Error('actual owner update failure');};
    assert.equal(f.context.render(0),false);assertDependencyOrder(f);
    assert.equal(f.context.ready,false);assert.equal(f.context.document.body.dataset.ready,'failed');assert.equal(f.context.guides,null);assert.equal(f.context.guideSurface,null);
    assert.equal(f.logged.length,1);assert.equal(f.logged[0].message,'actual owner update failure');assert.equal(f.context.sceneFailure.cleanupErrors.length,0);
    assert.equal(f.composition.cleanupError,null);assert.equal(f.root.children.length,0);
  }finally{f.cleanup();f.ground.dispose();}
});
test('throwing guide cleanup during actual composition update failure preserves both errors and releases every source',async()=>{
  const f=await actualCompositionFixture({throwPool:true});try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});const original=new Error('original owner failure');
    f.sourceOwners.get(ids[1]).update=()=>{throw original;};
    assert.equal(f.context.render(0),false);assertDependencyOrder(f);
    assert.equal(f.logged.length,1);assert.equal(f.logged[0].cause,original);assert.equal(f.logged[0].errors[0],original);
    assert.equal(f.logged[0].errors[1],f.composition.cleanupError);assert.match(f.composition.cleanupError.errors[0].message,/guide.*cleanup failed/i);
    assert.equal(f.context.guides,null);assert.equal(f.context.guideSurface,null);assert.equal(f.root.children.length,0);
    const length=f.events.length;f.context.releaseCompositionScene();assert.equal(f.events.length,length);
  }finally{f.cleanup();f.ground.dispose();}
});
test('actual registered pagehide closes all dependents before the real composition abort listener',async()=>{
  const f=await actualCompositionFixture();try{
    await f.context.visit(ids[0]);await f.context.visit(ids[1],{teleport:false});f.page.dispatchEvent(new Event('pagehide'));assertDependencyOrder(f);
    assert.equal(f.context.controller.signal.aborted,true);assert.equal(f.logged.length,0);assert.equal(f.context.document.body.dataset.ready,'disposed');
  }finally{f.cleanup();f.ground.dispose();}
});
