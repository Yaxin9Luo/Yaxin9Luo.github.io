import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

// Execute the actual page functions against real Three scene owners and the
// actual site/resident controllers. Only browser services and GPU submission
// are substituted; importing the page would construct the complete museum.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
function section(start,end){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert.ok(from>=0&&to>from,`actual page section ${start}`);return source.slice(from,to);}
const pageFunctions=[
  source.match(/^const paused=.*;$/m)?.[0],
  section('function isJiuzhouComposition()', '\nfunction renderMap('),
  section('function busy(','\nfunction setLanguage('),
  section('async function visit(','\nfunction advance('),
  section('function render(dt)','\nfunction tick('),
  section('function start(','\nfunction resize('),
].join('\n');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const sha='a'.repeat(64),site={id:'aviary',assetId:'aviary',position:[0,0,0],rotationY:0,scale:1},other={...site,id:'other',assetId:'other'};
const descriptor={id:site.id,assetId:site.assetId,representation:'full',approvedFullSHA256:sha,source:{manifestURL:'/source.json',approvedManifestSHA256:sha},site};

function owner(name){
  const group=new THREE.Group();group.name=name;const geometry=new THREE.BoxGeometry(2,2,2),material=new THREE.MeshStandardMaterial();group.add(new THREE.Mesh(geometry,material));
  let disposed=0;return {group,update(){},dispose(){disposed++;geometry.dispose();material.dispose();},get disposed(){return disposed;}};
}

async function harness({initialized=true,load,unmount}={}){
  const root=new THREE.Group(),primary=owner('initial-primary'),resident=owner('warm-resident'),returned=[];
  let first=initialized;
  const sites=createMuseumSiteController({sites:[site,other],load:async(s,context)=>{if(first){first=false;return primary;}const resource=await load(s,context);returned.push(resource);return resource;},mount:resource=>{root.add(resource.group);return unmount?()=>unmount(resource):undefined;}});
  const residents=createMuseumResidentBuildings({root,descriptors:[descriptor],siteController:sites,loadFull:async()=>resident,baseURL:'http://fixture.test/',fetchImpl(){throw new Error('No archive request is allowed in this fixture');}});
  const camera=new THREE.PerspectiveCamera(40,1,.1,1000);camera.position.set(0,5,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const elements=new Map(),renders=[],messages=[],captions=[];
  const ctx={query:new URLSearchParams(),composition:null,westernPlanting:null,
    THREE,camera,residents,sites,ready:initialized,currentSite:initialized?site:null,disposed:false,loading:false,contextLost:false,capturing:false,reviewPaused:false,
    document:{hidden:false,body:{dataset:{}}},reader:{isOpen:false},dialogs:[],controls:{target:new THREE.Vector3()},raf:0,last:0,time:23,
    state:{position:{x:1,y:4,z:2},speed:0},keys:new Set(),touch:{clear(){}},lang:'en',copy:{en:{building:'loading',failed:'failed'}},
    museumSite:id=>[site,other].find(s=>s.id===id)??null,
    $:id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',open:false});return elements.get(id);},
    locationCaption(){captions.push(ctx.currentSite?.id??null);},message(text){messages.push(text);},syncControls(){},placeGuides(){},advance(){},
    environment:{update:()=>({night:0})},audio:{update(){},setEmitter(){}},water:{update(){},reflectionViews:()=>[]},
    renderer:{getDrawingBufferSize:o=>o.set(1000,1000),shadowMap:{needsUpdate:false},info:{reset(){}}},
    rendering:{render(){const visible=[];root.traverseVisible(node=>{if(node.isMesh)visible.push(node.parent.name);});renders.push(visible.sort());}},
    evidence:()=>({status:sites.snapshot,residents:residents.snapshot}),
    tick(){},
  };
  vm.createContext(ctx);vm.runInContext(pageFunctions+'\nthis.visit=visit;this.render=render;this.start=start;',ctx);
  const drawing=installSceneRedraw(ctx,source);
  // A controlled browser animation step invokes the actual scene render. The
  // visit itself must no longer render synchronously, nor lose resident fallback.
  ctx.tick=()=>{ctx.raf=0;if(drawing.isPaused())return;ctx.render(0);ctx.$('telemetry').textContent=JSON.stringify(ctx.evidence());ctx.raf=ctx.requestAnimationFrame(ctx.tick);};
  if(initialized){await sites.select(site.id);await residents.load();ctx.render(0);assert.equal(resident.group.visible,false);}
  const originalPosition={...ctx.state.position};
  return {ctx,root,primary,resident,sites,residents,drawing,get frames(){return drawing.frames.pending;},frame:()=>drawing.frames.step(),renders,messages,captions,elements,originalPosition,async dispose(){drawing.dispose();sites.dispose();await residents.dispose();for(const resource of [primary,resident,...returned])if(resource&&!resource.disposed)resource.dispose();}};
}

test('actual visit failure restores the initialized world and resident; the same destination can be retried and handed back',async t=>{
  let fail=true,attempts=0;const loaded=[];
  const h=await harness({load:async s=>{attempts++;if(fail)throw new Error('archive transfer rejected');const resource=owner('primary-'+s.id);loaded.push(resource);return resource;}});t.after(()=>h.dispose());
  await h.ctx.visit(other.id);
  assert.equal(h.renders.length,1,'The failed visit schedules recovery instead of synchronously submitting a second frame');h.frame();
  assert.equal(h.sites.snapshot.status,'failed');assert.equal(h.ctx.ready,true);assert.equal(h.ctx.loading,false);assert.equal(h.ctx.document.body.dataset.ready,'true');
  assert.equal(h.ctx.currentSite,site,'failed destination cannot replace the last successful site');
  assert.deepEqual(h.ctx.state.position,h.originalPosition,'a failed teleport never moves the visitor');
  assert.equal(h.primary.disposed,1);assert.equal(h.primary.group.parent,null);assert.equal(h.resident.group.visible,true);
  assert.deepEqual(h.renders.at(-1),['warm-resident']);assert.equal(h.frames.length,1,'the actual start() schedules animation again');
  assert.equal(h.captions.at(-1),site.id);assert.deepEqual(h.messages,['failed']);
  const telemetry=JSON.parse(h.elements.get('telemetry').textContent);assert.equal(telemetry.status.status,'failed');assert.equal(telemetry.residents.full[0].visible,true);
  fail=false;await h.ctx.visit(other.id,{teleport:false});h.frame();assert.equal(attempts,2);assert.equal(h.sites.snapshot.status,'ready');assert.equal(h.ctx.currentSite,other);
  assert.deepEqual(h.renders.at(-1),['primary-other','warm-resident']);
  await h.ctx.visit(site.id,{teleport:false});h.frame();assert.equal(attempts,3);assert.equal(h.resident.group.visible,false);assert.deepEqual(h.renders.at(-1),['primary-aviary']);
  assert.equal(loaded[0].disposed,1);assert.equal(h.resident.disposed,0);
});

test('returning to a retired full-only site can fail and retry without leaving both owners visible',async t=>{
  let fail=true;const replacement=owner('replacement');
  const h=await harness({load:async()=>{if(fail)throw new Error('decode failed');return replacement;}});t.after(()=>h.dispose());
  await h.ctx.visit(other.id,{teleport:false});
  await h.ctx.visit(site.id,{teleport:false});h.frame();assert.equal(h.ctx.ready,true);assert.deepEqual(h.renders.at(-1),['warm-resident']);
  fail=false;await h.ctx.visit(site.id,{teleport:false});h.frame();assert.equal(h.ctx.ready,true);assert.deepEqual(h.renders.at(-1),['replacement']);assert.equal(h.resident.group.visible,false);
});

test('a failed first visit stays unready and can later succeed without falsely rendering an initialized world',async t=>{
  let fail=true;const replacement=owner('first-success');
  const h=await harness({initialized:false,load:async()=>{if(fail)throw new Error('first archive unavailable');return replacement;}});t.after(()=>h.dispose());
  await h.ctx.visit(site.id,{teleport:false});assert.equal(h.ctx.ready,false);assert.equal(h.ctx.loading,false);assert.equal(h.ctx.document.body.dataset.ready,'failed');
  assert.equal(h.ctx.currentSite,null);assert.equal(h.frames.length,0);assert.equal(h.renders.length,0);assert.deepEqual(h.messages,['failed']);
  fail=false;await h.ctx.visit(site.id,{teleport:false});assert.equal(h.ctx.ready,true);assert.equal(h.frames.length,1);assert.equal(h.renders.length,0);h.frame();assert.deepEqual(h.renders.at(-1),['first-success']);
});

test('recovering a failed visit redraws the resident while retaining an explicit review pause',async t=>{
  const h=await harness({load:async()=>{throw new Error('archive unavailable');}});t.after(()=>h.dispose());h.ctx.reviewPaused=true;
  await h.ctx.visit(other.id,{teleport:false});assert.equal(h.ctx.ready,true);assert.equal(h.ctx.reviewPaused,true);assert.equal(h.frames.length,1);assert.deepEqual(h.renders.at(-1),['initial-primary']);h.frame();assert.deepEqual(h.renders.at(-1),['warm-resident']);assert.equal(h.frames.length,0);
});

test('a synchronous outgoing cleanup failure clears the loading gate, restores the resident and permits a retry',async t=>{
  let fail=true,loads=0;const replacement=owner('after-cleanup-failure');
  const h=await harness({load:async()=>{loads++;return replacement;},unmount:()=>{if(fail){fail=false;throw new Error('guide cleanup failed');}}});t.after(()=>h.dispose());
  await h.ctx.visit(other.id,{teleport:false});
  h.frame();
  assert.equal(loads,0,'retirement failed before the destination loader ran');
  assert.equal(h.ctx.ready,true);assert.equal(h.ctx.loading,false);assert.equal(h.ctx.currentSite,site);
  assert.deepEqual(h.ctx.state.position,h.originalPosition);assert.equal(h.primary.disposed,1);assert.equal(h.primary.group.parent,null);
  assert.deepEqual(h.renders.at(-1),['warm-resident']);assert.deepEqual(h.messages,['failed guide cleanup failed']);
  await h.ctx.visit(other.id,{teleport:false});h.frame();assert.equal(loads,1);assert.equal(h.ctx.currentSite,other);assert.equal(h.ctx.loading,false);
  assert.deepEqual(h.renders.at(-1),['after-cleanup-failure','warm-resident']);
});

test('a late visit after page disposal cannot restart the world or mount an owner',async()=>{
  const gate=deferred(),started=deferred(),late=owner('late-primary');
  const h=await harness({load:async()=>{started.resolve();return gate.promise;}});
  try{
    const pending=h.ctx.visit(other.id,{teleport:false});await started.promise;const renders=h.renders.length;
    h.ctx.disposed=true;h.sites.dispose();await h.residents.dispose();gate.resolve(late);await pending;
    assert.equal(late.disposed,1);assert.equal(late.group.parent,null);assert.equal(h.resident.disposed,1);assert.equal(h.frames.length,0);assert.equal(h.renders.length,renders);
  }finally{gate.resolve(late);await h.dispose();}
});

test('a context-lost scene refuses new travel and cannot be relabelled ready by a late loading update',async t=>{
  let loads=0;const h=await harness({load:async()=>{loads++;throw new Error('No load is allowed after graphics loss');}});t.after(()=>h.dispose());
  h.ctx.contextLost=true;h.ctx.copy.en.graphicsLost='Reload scene';h.ctx.busy(false);await h.ctx.visit(other.id);h.ctx.start();
  assert.equal(loads,0);assert.equal(h.ctx.currentSite,site);assert.deepEqual(h.ctx.state.position,h.originalPosition);assert.equal(h.ctx.document.body.dataset.ready,'context-lost');assert.equal(h.elements.get('loading').hidden,false);assert.equal(h.frames.length,0);
});

test('a successful teleport clears the previous site motion result before recording the new arrival',async t=>{
  const next=owner('next-arrival'),h=await harness({load:async()=>next});t.after(()=>h.dispose());
  const destination={...other,arrival:[20,8,0],focus:[24,5,0]};
  Object.assign(h.ctx,{museumSite:id=>id===other.id?destination:site,reviewMotion:{name:'walk'},reviewMotionResult:{name:'walk',site:site.id},
    sitePoint:(_site,p)=>({x:p[0],y:p[1],z:p[2]}),museumTravelHeading:(x,z)=>Math.atan2(-x,-z),visitor:{group:new THREE.Group()},resetCharacterMotion(){},frameVisitor(){}});
  await h.ctx.visit(other.id);
  assert.equal(h.ctx.ready,true);assert.equal(h.ctx.currentSite,destination);assert.equal(h.ctx.state.mode,'flying');
  assert.equal(h.ctx.reviewMotion,null);assert.equal(h.ctx.reviewMotionResult,null);
  assert.deepEqual({...h.ctx.state.position},{x:20,y:8,z:0});
});
