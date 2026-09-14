import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as THREE from 'three';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createArchitectureEnsemble} from '../src/yuanmingyuan/architecture-ensemble.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';
import {createMuseumTerrainAssets} from '../src/yuanmingyuan/museum-terrain-assets.js';
import {placeMuseumStaticAsset} from '../src/yuanmingyuan/museum-static-batch.js';
import {sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {prepareMuseumGroundSources} from '../src/yuanmingyuan/museum-prepared-sources.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

// Execute the page's actual bootstrap, load/mount/release closures and visit /
// render / page-exit functions. Only asset decoding, GPU batching/submission,
// character models and browser services are replaced. Source support, grouped
// queries, resident ownership, terrain binding and the site controller are real.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const sourceSHA256=createHash('sha256').update(source).digest('hex');
function section(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`Actual page section exists: ${start}`);
  return source.slice(from,to);
}
const functions=[
  source.match(/^const paused=.*;$/m)?.[0],
  section('async function prepareMuseumRendering(','\nfunction busy('),
  section('function busy(','\nfunction setLanguage('),
  section('function createGuideRegion(','\nasync function visit('),
  section('async function visit(','\nfunction advance('),
  section('function render(dt)','\nfunction tick('),
  section('function start(','\nfunction resize('),
  section('function dispose(','\naddEventListener(\'pagehide\''),
].join('\n');
const bootstrap=section('  sites=createMuseumSiteController(','\n}catch(error){if(!disposed)');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const fixtureSHA='a'.repeat(64);
const siteList=[
  {id:'court-a',assetId:'court-a',position:[0,4,0]},
  {id:'court-b',assetId:'court-b',position:[12,4,0]},
  {id:'independent',assetId:'independent',position:[6,5,0]},
].map(s=>({...s,entryId:s.id,rotationY:0,scale:1,arrival:[0,8,4],focus:[0,1,0],guide:[0,.04,0]}));
const catalog=siteList.slice(0,2).map(s=>({id:s.id,assetId:s.assetId,representation:'full',approvedFullSHA256:fixtureSHA,
  source:{manifestURL:`/fixture/${s.id}.json`,approvedManifestSHA256:fixtureSHA}}));

function tinyOwner(id,events){
  const collisionGroup=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometries=[];
  const addBox=(x,y,z,w,h,d)=>{const geometry=new THREE.BoxGeometry(w,h,d),mesh=new THREE.Mesh(geometry,material);geometries.push(geometry);mesh.position.set(x,y,z);collisionGroup.add(mesh);};
  addBox(0,-.125,0,10,.25,6);addBox(2,1.5,1,.25,3,.25);
  if(id==='independent'){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-2,0,-3,2,1,-3,2,1,-1,-2,0,-1],3));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();geometries.push(geometry);collisionGroup.add(new THREE.Mesh(geometry,material));
    addBox(0,-3.125,8,4,.25,4);
  }
  collisionGroup.name=id+'-source';collisionGroup.userData.fixtureId=id;
  const group=collisionGroup.clone(true);group.name=id+'-render';group.userData.fixtureId=id;
  let disposed=false;
  const owner={group,collisionGroup,archive:{id,manifestSHA256:fixtureSHA},updates:[],disposeCalls:0,geometryDisposals:0,
    diagnostics:{multiDrawBatch:{applied:false}},get disposed(){return disposed;},
    update(time){assert.equal(disposed,false);owner.updates.push(time);events.push(`update:${id}`);},
    dispose(){owner.disposeCalls++;if(disposed)return;disposed=true;events.push(`owner:${id}`);for(const geometry of geometries)geometry.dispose();material.dispose();}};
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>owner.geometryDisposals++);
  return owner;
}

function harness({archiveLoad,initial='court-a',resident='1',prepared=[],restoreWater=false,failConfigure=null,failSupport=null}={}){
  const scene=new THREE.Scene(),events=[],owners=[],supports=[],locals=[],guideWorlds=[],aggregates=[],renders=[],messages=[],errors=[],elements=new Map();
  const counts={archive:0,model:0,place:0,batch:0,configure:0,attach:0,source:0};
  const services=new Map(),service=name=>{
    let disposed=false;const object={disposeCalls:0,get disposed(){return disposed;},dispose(){object.disposeCalls++;if(disposed)return;disposed=true;events.push(`service:${name}`);}};
    services.set(name,object);return object;
  };
  function instrumentSupport(group,options){
    if(group.userData.fixtureId===failSupport)throw new Error('Fixture source support failed');
    const support=createArchitectureSurface(group,options),id=group.userData.fixtureId,create=support.createGuideSupport,dispose=support.dispose;
    const entry={id,support,disposeCalls:0};supports.push(entry);counts.source++;events.push(`support-ready:${id}`);
    support.createGuideSupport=(...args)=>{
      const local=create(...args),release=local.dispose,entry={id,local,closes:0};locals.push(entry);
      local.dispose=()=>{const was=local.snapshot().disposed;try{return release();}finally{if(!was){entry.closes++;events.push(`query:${id}`);}}};return local;
    };
    support.dispose=()=>{entry.disposeCalls++;const was=support.disposed;try{return dispose();}finally{if(!was)events.push(`support:${id}`);}};
    return support;
  }
  const groundOwner=tinyOwner('ground',events);groundOwner.group.position.y=1;groundOwner.collisionGroup.position.y=1;groundOwner.collisionGroup.updateMatrixWorld(true);
  const groundSource=createArchitectureSurface(groundOwner.collisionGroup),groundDispose=service('terrain');
  const terrain={colliders:[],surfaceAt:(...args)=>groundSource.surfaceAt(...args),createGuideSupport:(...args)=>groundSource.createGuideSupport(...args),
    activateReplacement(){throw new Error('This fixture has no terrain replacement');},revertReplacement(){throw new Error('This fixture has no terrain replacement');},
    dispose(){if(groundDispose.disposed)return;groundDispose.dispose();groundSource.dispose();groundOwner.dispose();},get disposed(){return groundDispose.disposed;}};
  const terrainAssets=createMuseumTerrainAssets({terrain,replacements:[]}),attach=terrainAssets.attach;
  terrainAssets.attach=options=>{counts.attach++;events.push(`attach:${options.role}:${options.site.id}`);const unbind=attach(options);let released=false;return ()=>{if(!released){released=true;events.push(`unbind:${options.role}:${options.site.id}`);}return unbind();};};
  const camera=new THREE.PerspectiveCamera(45,1,.08,1000);camera.position.set(6,12,24);camera.lookAt(6,4,0);camera.updateMatrixWorld(true);
  const makeOwner=id=>{const resource=tinyOwner(id,events);owners.push(resource);return resource;};
  const ctx={composition:null,westernPlanting:null,westernPlantingLifetime:null,
    THREE,scene,camera,controller:new AbortController(),query:new URLSearchParams(`resident=${resident}&batch=2&site=${initial}`),cullingMode:'stock',
    terrain,terrainAssets,sites:null,residents:null,preparedGroundSources:null,architecture:null,residentArchitecture:null,currentSite:null,residentBindings:new Map(),borrowedOwners:new WeakSet(),
    museumSites:siteList,museumResidentCatalog:catalog.map(entry=>({...entry,requiresPreparedGround:prepared.includes(entry.id)})),museumSite:id=>siteList.find(s=>s.id===id)??null,sitePoint,
    prepareMuseumGroundSources,gardenLayout:null,terrainPads:[],terrainCourts:[],terrainPaths:[],terrainReplacements:[],
    createMuseumLandscape:({readyAssetIds})=>{events.push(`ground-plan:${readyAssetIds.join(',')}`);return {layout:{readyAssetIds},pads:[],courts:[],paths:[],replacements:[]};},
    createMuseumSiteController(options){const result=createMuseumSiteController(options),select=result.select;result.select=(...args)=>{events.push(`select:${args[0]}`);return select(...args);};return result;},
    createMuseumResidentBuildings:options=>createMuseumResidentBuildings({...options,baseURL:'http://fixture.test/',fetchImpl(){throw new Error('Production network forbidden');}}),
    createArchitectureSurface:instrumentSupport,
    createArchitectureEnsemble(records){const result=createArchitectureEnsemble(records);aggregates.push(result);return result;},
    createMuseumGuideWorld(options){const world=createMuseumGuideWorld(options),release=world.dispose;guideWorlds.push(world);world.dispose=()=>{const was=world.snapshot().disposed;try{return release();}finally{if(!was)events.push(`guide-world:${options.site.id}`);}};return world;},
    selectMuseumGuidePlacements:({site,centre})=>({placements:[{id:site.id,position:{...centre},heading:0,waypoints:[{...centre}]}],rejected:[]}),
    createMuseumGuides:({placements})=>({dispose(){events.push(`guides:${placements[0].id}`);}}),
    museumEntry:id=>({id,related:[]}),museumVisitorCollider:()=>null,
    loadMuseumArchive:async(id,url,options)=>{counts.archive++;events.push(`archive:${id}`);assert.equal(options.expectedManifestSHA256,fixtureSHA);return archiveLoad?archiveLoad(id,{...options,makeOwner}):makeOwner(id);},
    loadMuseumModel:async id=>{counts.model++;events.push(`model:${id}`);return makeOwner(id);},
    configureMuseumLandscapeAsset(resource,site,{terrain:boundTerrain,water:boundWater}){
      counts.configure++;assert.deepEqual(resource.group.position.toArray(),site.position,'Water handoff runs after actual source placement');
      assert.equal(boundTerrain,terrain);assert.equal(boundWater,ctx.water);
      if(site.id===failConfigure)throw new Error('Fixture water handoff failed');
      return restoreWater?()=>{assert.equal(resource.disposed,false);assert.equal(terrain.disposed,false);events.push(`water-restored:${site.id}`);}:undefined;
    },
    placeMuseumStaticAsset(resource,site){counts.place++;events.push(`place:${site.id}`);return placeMuseumStaticAsset(resource,site);},
    createMuseumMultiDrawBatch:async resource=>{counts.batch++;events.push(`batch:${resource.archive.id}`);return resource;},
    createMuseumStaticBatch:async resource=>{counts.batch++;return resource;},
    attachMuseumMultiDrawCulling(){throw new Error('GPU culling is excluded');},
    ready:false,disposed:false,loading:false,contextLost:false,capturing:false,reviewPaused:false,lang:'en',copy:{en:{building:'loading',failed:'failed',ready:'ready'}},
    document:{hidden:false,body:{dataset:{}},removeEventListener(){}},removeEventListener(){},console:{error:error=>errors.push(error)},dialogs:[],keys:new Set(),touch:{clear(){}},
    $:id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',open:false});return elements.get(id);},
    state:{position:{x:0,y:12,z:4},speed:0},raf:0,last:0,time:17,reviewMotion:null,reviewMotionResult:null,
    locationCaption(){},syncControls(){},message:text=>messages.push(text),advance(){},frameVisitor(){},resetCharacterMotion(){},museumTravelHeading:(x,z)=>Math.atan2(-x,-z),
    reader:{...service('reader'),isOpen:false},directory:service('directory'),audio:{...service('audio'),update(){},setEmitter(){},companion(){},silence(){}},
    visitor:{...service('visitor'),group:new THREE.Group()},pool:service('pool'),guides:null,guideSurface:null,plantingPilot:null,plantingCollisions:null,shoreCommunity:null,shoreUnderstory:null,shoreBank:null,
    environment:{...service('environment'),update:()=>({night:0})},water:{...service('water'),update(){},reflectionViews:()=>[]},
    controls:{...service('controls'),target:new THREE.Vector3()},groundTextures:service('groundTextures'),
    renderer:{...service('renderer'),getDrawingBufferSize:o=>o.set(1000,1000),shadowMap:{needsUpdate:false},info:{reset(){}}},
    rendering:{...service('rendering'),render(){const visible=[];scene.traverseVisible(node=>{if(node.isMesh)visible.push(node.parent.name);});renders.push(visible);}},
    observer:{disconnect(){}},keydown(){},keyup(){},clearKeys(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},tick(){},
    evidence:()=>({sites:ctx.sites?.snapshot,residents:ctx.residents?.snapshot}),
  };
  vm.createContext(ctx);
  vm.runInContext(functions+`\nthis.bootstrap=async()=>{${bootstrap}\n};this.prepareMuseumGround=prepareMuseumGround;this.visit=visit;this.render=render;this.dispose=dispose;`,ctx,{filename:'actual-museum-scene-lifecycle.js'});
  const drawing=installSceneRedraw(ctx,source);
  async function cleanup(){
    try{ctx.dispose();}catch{/* Tests inspect the first error; still release their fixture. */}
    try{ctx.sites?.dispose();}catch{}await ctx.residents?.dispose();
    for(const world of guideWorlds)try{world.dispose();}catch{}
    for(const aggregate of aggregates)try{aggregate.dispose();}catch{}
    for(const {support}of supports)try{support.dispose();}catch{}
    for(const owner of owners)if(!owner.disposed){owner.group.removeFromParent();owner.dispose();}
    if(!terrainAssets.disposed)terrainAssets.dispose();terrain.dispose();drawing.dispose();
  }
  return {ctx,events,owners,supports,locals,guideWorlds,aggregates,counts,renders,messages,errors,elements,services,drawing,cleanup};
}

test('actual scene preloads serial resident owners/support before first borrow, without a second preparation',async t=>{
  t.diagnostic(`museum-scene SHA256 ${sourceSHA256}`);
  const entered=deferred(),gate=deferred(),h=harness({archiveLoad:async(id,{makeOwner})=>{if(id==='court-b'){entered.resolve();await gate.promise;}return makeOwner(id);}});t.after(()=>h.cleanup());
  const loading=h.ctx.bootstrap();await entered.promise;
  assert.equal(h.ctx.sites.snapshot.status,'idle');assert.equal(h.ctx.sites.resource,null);assert.equal(h.counts.model,0);
  assert.deepEqual(h.events.filter(e=>e.startsWith('archive:')),['archive:court-a','archive:court-b']);
  assert.ok(h.events.indexOf('support-ready:court-a')<h.events.indexOf('archive:court-b'));
  gate.resolve();await loading;
  const owner=h.ctx.residents.get('court-a').owner;
  assert.equal(h.ctx.sites.resource,owner);assert.equal(h.ctx.residents.snapshot.borrowers,1);assert.equal(h.ctx.architecture,h.ctx.residentArchitecture);
  assert.deepEqual(h.counts,{archive:2,model:0,place:2,batch:2,configure:2,attach:2,source:2});
  assert.ok(h.events.indexOf('support-ready:court-b')<h.events.indexOf('select:court-a'));
  assert.deepEqual(h.events.filter(e=>e.startsWith('attach:')),['attach:resident:court-a','attach:resident:court-b']);
  for(const {id,support}of h.supports){const site=siteList.find(s=>s.id===id);assert.equal(support.surfaceAt(site.position[0],0,{maxY:5}).height,4);assert.equal(support.disposed,false);}
  assert.equal(h.ctx.ready,true);
});

test('actual primary and resident render paths update a borrowed owner only once and draw it once',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();
  for(const owner of h.owners)owner.updates.length=0;
  for(let frame=0;frame<3;frame++){h.ctx.time++;h.ctx.render(1/60);}
  for(const owner of h.owners){assert.equal(owner.updates.length,3);assert.equal(owner.group.visible,true);assert.equal(h.renders.at(-1).filter(name=>name===owner.group.name).length,owner.group.children.length);}
  await h.ctx.visit('independent',{teleport:false});
  for(const owner of h.owners)owner.updates.length=0;h.ctx.render(1/60);
  assert(h.owners.every(owner=>owner.updates.length===1));
});

test('actual visits return the same resident owner and close local guides without destroying shared support',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();const original=h.ctx.sites.resource,firstWorld=h.ctx.guideSurface,firstLocals=[...h.locals];
  await h.ctx.visit('court-b',{teleport:false});
  assert.equal(firstWorld.snapshot().disposed,true);assert(firstLocals.every(entry=>entry.local.snapshot().disposed&&entry.closes===1));
  assert(h.supports.every(entry=>!entry.support.disposed));assert.equal(original.disposeCalls,0);assert.equal(original.geometryDisposals,0);
  await h.ctx.visit('court-a',{teleport:false});assert.equal(h.ctx.sites.resource,original);
  assert.equal(h.ctx.residents.snapshot.borrowers,1);assert.equal(h.ctx.residents.snapshot.full.find(r=>r.id==='court-b').borrowers,0);
  assert.deepEqual(h.counts,{archive:2,model:0,place:2,batch:2,configure:2,attach:2,source:2});
  assert.equal(h.ctx.guideSurface.heightAt(0,0),4);assert.equal(h.ctx.architecture.surfaceAt(12,0,{maxY:4.5}).height,4);
  assert.equal(original.group.parent,h.ctx.scene);
});

test('actual independent mount unions all retained source triangles and releases only its own support on departure',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();await h.ctx.visit('independent',{teleport:false});
  const independent=h.ctx.sites.resource,combined=h.ctx.architecture,sources=h.supports.map(entry=>entry.support),local=h.ctx.guideSurface;
  assert.notEqual(combined,h.ctx.residentArchitecture);assert.deepEqual(Array.from(combined.diagnostics.groups,e=>e.id),siteList.map(s=>s.id));
  for(const [x,z]of [[0,0],[4,0],[8,0],[6,-2],[6,8],[12,0],[30,0]])for(const maxY of [3.8,4.5,5.75,10]){
    const expected=sources.map(s=>s.surfaceAt(x,z,{maxY})).filter(Boolean).reduce((best,hit)=>!best||hit.height>best.height?hit:best,null);
    assert.deepEqual(combined.surfaceAt(x,z,{maxY}),expected);
  }
  assert.equal(combined.surfaceAt(4,0,{maxY:10}).height,5);assert.equal(combined.surfaceAt(4,0,{maxY:4.5}).height,4);
  assert.equal(combined.surfaceAt(6,-2,{maxY:10}).height,5.5);assert.equal(combined.surfaceAt(6,8,{maxY:3.8}).height,2);
  for(const q of [{x:2,y:4,z:1,height:2},{x:8,y:5,z:1,height:2},{x:0,y:4,z:0,height:2}])assert.equal(combined.capsuleBlocked(q),sources.some(s=>s.capsuleBlocked(q)));
  for(const [x,y,z]of [[2,5,1],[8,6,1],[0,5,0]]){
    const r=.2,volume={bounds:{minX:x-r,maxX:x+r,minY:y-r,maxY:y+r,minZ:z-r,maxZ:z+r},planes:[[1,0,0,x+r],[-1,0,0,-x+r],[0,1,0,y+r],[0,-1,0,-y+r],[0,0,1,z+r],[0,0,-1,-z+r]]};
    assert.equal(combined.intersectsGuideVolume(volume),sources.some(s=>s.intersectsGuideVolume(volume)));
  }
  await h.ctx.visit('court-a',{teleport:false});
  assert.equal(local.snapshot().disposed,true);assert.equal(combined.disposed,true);assert.equal(h.supports[2].support.disposed,true);assert.equal(independent.disposeCalls,1);assert.equal(independent.group.parent,null);
  assert(h.supports.slice(0,2).every(entry=>!entry.support.disposed));assert.equal(h.ctx.architecture,h.ctx.residentArchitecture);
  const tail=h.events.slice(h.events.indexOf('select:court-a',h.events.indexOf('select:independent')+1));
  assert.ok(tail.indexOf('query:independent')<tail.indexOf('support:independent'));assert.ok(tail.indexOf('support:independent')<tail.indexOf('owner:independent'));
});

test('actual page exit returns the borrow, closes queries before supports and destroys each real owner once',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();const world=h.ctx.guideSurface,owners=[...h.owners],locals=[...h.locals];
  h.ctx.reviewPaused=true;h.ctx.redraw.request();const pendingRedraw=h.drawing.frames.ids.at(-1),renderCount=h.renders.length;
  h.events.length=0;h.ctx.dispose();await h.ctx.residents.dispose();
  assert.equal(h.ctx.redraw.disposed,true);assert.equal(h.drawing.frames.pending.length,0);h.drawing.frames.late(pendingRedraw);assert.equal(h.renders.length,renderCount,'A late paused frame cannot touch released support/owners');
  assert.equal(h.ctx.residents.get('court-a'),null);assert.equal(h.ctx.sites.resource,null);assert.equal(h.ctx.residents.snapshot.borrowers,0);
  assert.equal(world.snapshot().disposed,true);assert(locals.every(entry=>entry.local.snapshot().disposed&&entry.closes===1));
  for(const {id,support,disposeCalls}of h.supports){assert.equal(support.disposed,true);assert.equal(disposeCalls,1);assert.ok(h.events.indexOf(`query:${id}`)<h.events.indexOf(`support:${id}`));assert.ok(h.events.indexOf(`support:${id}`)<h.events.indexOf(`owner:${id}`));}
  assert(owners.every(owner=>owner.disposeCalls===1&&owner.geometryDisposals===owner.group.children.length));
  assert.equal(h.ctx.sites.snapshot.cleanupErrors.length,0);assert.equal(h.ctx.residents.snapshot.disposalErrors.length,0);
  assert.equal(h.ctx.residentBindings.size,0);assert.equal(h.ctx.document.body.dataset.ready,'disposed');
  h.ctx.dispose();assert(owners.every(owner=>owner.disposeCalls===1));
});

test('a cancelled late real borrow is returned by identity even after get(id) is null on page exit',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();h.ctx.sites.cancel();
  const gate=deferred(),entered=deferred(),borrow=h.ctx.residents.borrow;let acquired;
  h.ctx.residents.borrow=async(...args)=>{acquired=await borrow(...args);entered.resolve();await gate.promise;return acquired;};
  const pending=h.ctx.sites.select('court-b');await entered.promise;assert.equal(h.ctx.residents.snapshot.borrowers,1);
  h.ctx.dispose();await h.ctx.residents.dispose();assert.equal(h.ctx.residents.get('court-b'),null);assert.equal(acquired.disposeCalls,1);
  gate.resolve();assert.equal(await pending,null);assert.equal(h.ctx.residents.snapshot.borrowers,0);assert.equal(acquired.disposeCalls,1);
  assert.equal(h.ctx.borrowedOwners.has(acquired),false);assert.equal(h.ctx.sites.snapshot.cleanupErrors.length,0);assert.equal(h.counts.source,2);
});

test('actual bootstrap cancellation disposes a cancellation-ignoring late resident without visiting or building stale support',async t=>{
  const gate=deferred(),entered=deferred(),h=harness({archiveLoad:async(id,{makeOwner})=>{if(id==='court-b'){entered.resolve();await gate.promise;}return makeOwner(id);}});t.after(()=>h.cleanup());
  const pending=h.ctx.bootstrap();await entered.promise;h.ctx.dispose();gate.resolve();await assert.rejects(pending,{name:'AbortError'});await h.ctx.residents.dispose();
  assert.equal(h.ctx.sites.snapshot.status,'disposed');assert.equal(h.ctx.residents.snapshot.borrowers,0);assert.equal(h.counts.model,0);assert.equal(h.counts.source,1);
  assert.equal(h.events.some(e=>e.startsWith('select:')),false);assert(h.owners.every(owner=>owner.disposeCalls===1));
});

test('actual site unmount cleanup errors still release every local query and return the resident borrow',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();const current=h.ctx.guideSurface,oldGuides=h.ctx.guides.dispose;
  h.ctx.guides.dispose=()=>{oldGuides();throw new Error('guide release failed');};
  await h.ctx.visit('court-b',{teleport:false});
  assert.equal(current.snapshot().disposed,true);assert.equal(h.ctx.residents.snapshot.borrowers,0);assert.equal(h.ctx.sites.resource,null);
  assert(h.supports.every(entry=>!entry.support.disposed));assert(h.owners.every(owner=>owner.disposeCalls===0));assert.equal(h.ctx.loading,false);assert.equal(h.ctx.ready,true);
  assert.equal(h.ctx.sites.snapshot.cleanupErrors.length,1);
  await h.ctx.visit('court-b',{teleport:false});assert.equal(h.ctx.sites.resource,h.ctx.residents.get('court-b').owner);assert.equal(h.counts.source,2);
});

test('actual page exit attempts all owned cleanup after one UI owner throws',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();
  const release=h.ctx.reader.dispose;h.ctx.reader.dispose=()=>{release();throw new Error('Reader cleanup failed');};
  assert.doesNotThrow(()=>h.ctx.dispose(),'pagehide records cleanup failures without throwing from its callback');
  await h.ctx.residents.dispose();
  assert.equal(h.errors.length,1,'A cleanup error remains observable');assert.equal(h.errors[0].name,'AggregateError');
  assert.ok(h.errors[0].errors.some(error=>error.message==='Reader cleanup failed'));
  assert(h.owners.every(owner=>owner.disposeCalls===1),'Abort still retires the actual buildings');
  const unreleased=[...h.services.entries()].filter(([,service])=>!service.disposed).map(([name])=>name);
  assert.deepEqual(unreleased,[],'One page owner must not leak the remaining UI / terrain / texture / renderer owners');
  assert.equal(h.ctx.document.body.dataset.ready,'disposed');
  for(const {id,support,disposeCalls}of h.supports){assert.equal(support.disposed,true);assert.equal(disposeCalls,1);assert.ok(h.events.indexOf(`query:${id}`)<h.events.indexOf(`support:${id}`));assert.ok(h.events.indexOf(`support:${id}`)<h.events.indexOf(`owner:${id}`));}
  assert(h.locals.every(entry=>entry.closes===1));h.ctx.dispose();assert.equal(h.errors.length,1);
});

test('actual ground preparation transfers its exact owner and retains its court even with optional residents disabled',async t=>{
  const h=harness({resident:'0',prepared:['court-a']});t.after(()=>h.cleanup());
  await h.ctx.prepareMuseumGround();const original=h.owners[0];
  assert.equal(h.counts.archive,1);assert.equal(h.ctx.preparedGroundSources.has('court-a'),true);
  assert.deepEqual(Array.from(h.ctx.gardenLayout.readyAssetIds),['court-a']);
  assert.ok(h.events.indexOf('archive:court-a')<h.events.indexOf('ground-plan:court-a'));
  await h.ctx.bootstrap();
  assert.equal(h.counts.archive,1,'A ground-bearing owner must not be decoded twice');
  assert.equal(h.ctx.sites.resource,original);assert.equal(h.ctx.residents.get('court-a').owner,original);
  assert.equal(h.ctx.preparedGroundSources.has('court-a'),false);
  await h.ctx.visit('independent',{teleport:false});
  assert.equal(original.disposed,false);assert.equal(original.group.parent,h.ctx.scene);
  assert.equal(h.ctx.architecture.surfaceAt(0,0,{maxY:4.5}).height,4);
  await h.ctx.visit('court-a',{teleport:false});assert.equal(h.ctx.sites.resource,original);assert.equal(h.counts.archive,1);
});

test('actual failed ground preparation never creates an excavated plan and cleans earlier decoded owners',async t=>{
  const h=harness({prepared:['court-a','court-b'],archiveLoad:async(id,{makeOwner})=>{if(id==='court-b')throw new Error('Source unavailable');return makeOwner(id);}});t.after(()=>h.cleanup());
  await assert.rejects(h.ctx.prepareMuseumGround(),/Source unavailable/);
  assert.equal(h.ctx.gardenLayout,null);assert.equal(h.events.some(e=>e.startsWith('ground-plan:')),false);
  assert.equal(h.owners[0].disposeCalls,1);assert.equal(h.counts.source,0);
});

test('actual default scene retains reviewed neighbours without requiring a resident query flag',async t=>{
  const h=harness({resident:''});t.after(()=>h.cleanup());h.ctx.query.delete('resident');await h.ctx.bootstrap();
  assert.equal(h.counts.archive,2);assert.equal(h.ctx.residents.snapshot.full.filter(r=>r.ready).length,2);
  await h.ctx.visit('court-b',{teleport:false});assert.equal(h.owners[0].group.parent,h.ctx.scene);assert.equal(h.counts.archive,2);
});

test('actual water handoff restores before source disposal, and borrowed site transitions do not restore it early',async t=>{
  const h=harness({prepared:['court-a'],restoreWater:true});t.after(()=>h.cleanup());await h.ctx.prepareMuseumGround();await h.ctx.bootstrap();
  await h.ctx.visit('court-b',{teleport:false});assert.equal(h.events.some(e=>e.startsWith('water-restored:')),false);
  h.ctx.dispose();await h.ctx.residents.dispose();
  for(const owner of h.owners){
    const id=owner.archive.id;assert.equal(h.events.filter(e=>e===`water-restored:${id}`).length,1);
    assert.ok(h.events.indexOf(`water-restored:${id}`)<h.events.indexOf(`owner:${id}`));assert.equal(owner.disposeCalls,1);
  }
  assert.equal(h.ctx.preparedGroundSources.snapshot.disposed,true);assert.equal(h.errors.length,0);
});

for(const failure of ['failConfigure','failSupport'])test(`actual prepared courtyard ${failure} blocks the first visit instead of opening an uncovered hole`,async t=>{
  const h=harness({prepared:['court-a'],initial:'court-b',[failure]:'court-a'});t.after(()=>h.cleanup());
  await h.ctx.prepareMuseumGround();const owner=h.owners[0];
  await assert.rejects(h.ctx.bootstrap(),/prepared courtyard has no retained building and live support: court-a/);
  assert.equal(h.ctx.ready,false);assert.equal(h.ctx.sites.resource,null);assert.equal(h.events.some(e=>e.startsWith('select:')),false);
  assert.equal(h.ctx.preparedGroundSources.has('court-a'),false);assert.equal(owner.disposed,true);assert.equal(owner.disposeCalls,1);
  assert.equal(h.ctx.residents.get('court-a'),null);assert.equal(h.counts.model,0);
});
