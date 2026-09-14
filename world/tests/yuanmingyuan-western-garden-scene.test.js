import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWesternGardenScenePlanting} from '../src/yuanmingyuan/western-garden-scene.js';
import {createWesternGardenPlantingRegion} from '../src/yuanmingyuan/western-garden-planting.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
  const events=[],root=new THREE.Scene(),controller=new AbortController();
  const terrain={paths:[],courtFootprints:[],waterSurfaces:[],surfaceAt:()=>({supportSource:'terrain-triangle',kind:'land',walkable:true,height:0,normal:[0,1,0]})};
  let current={intersectsGuideVolume:()=>false};
  const plantingLayout={id:'scene-fixture',clearings:[],buildingReserves:[],regions:['west','east'].map((id,i)=>({id,estimatedFullSourceTriangles:12,placements:[{
    id:id+'-tree',species:'juniper',position:[i*10,null,0],scale:1,yaw:0,burial:.004,envelope:{radius:2.4,height:5.7},evidence:{status:'fixture'},
  }]}))};
  const geometry=new THREE.BoxGeometry(.2,.2,.2).translate(0,.05,0),material=new THREE.MeshStandardMaterial(),part=new THREE.Group();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='juniper-visible-trunk';part.add(mesh);
  let owner=null;
  function createSources(options){
    assert.equal(options.signal,undefined);events.push('source-created');
    let disposed=false;
    owner={get disposed(){return disposed;},async prepareRegion(id,{signal}){signal.throwIfAborted();events.push('source:'+id);return {sources:{juniper:{part,owner,review:'fixture'}}};},
      update(time){events.push('update:'+time);return !disposed;},snapshot:()=>({disposed}),whenIdle:async()=>{events.push('source-idle');},
      dispose(){if(disposed)return;disposed=true;events.push('source-dispose');geometry.dispose();material.dispose();}};
    return owner;
  }
  async function createRegion(options){
    const region=await createWesternGardenPlantingRegion(options),release=region.dispose;
    region.dispose=()=>{if(!region.disposed)events.push('region-dispose:'+options.regionId);return release();};
    return region;
  }
  return {root,terrain,plantingLayout,controller,events,geometry,material,part,createSources,createRegion,
    architecture:()=>current,setArchitecture:next=>{current=next;},get owner(){return owner;},
    options(){return {root,terrain,architecture:this.architecture,plantingLayout,regionIds:['west','east'],signal:controller.signal,createSources,createRegion};}};
}

test('mounts both actual borrowed regions atomically, shares original mesh/PBR and updates source once',async t=>{
  const f=fixture(),stages=[];
  const result=await createWesternGardenScenePlanting({...f.options(),onProgress:progress=>stages.push({completed:progress.completed,attached:f.root.children.length})});
  t.after(()=>result.dispose());
  assert.deepEqual(stages,[{completed:0,attached:0},{completed:1,attached:0},{completed:2,attached:1}]);
  assert.equal(result.regions.length,2);
  for(const region of result.regions){const mesh=region.group.getObjectByName('juniper-visible-trunk');assert.equal(mesh.geometry,f.geometry);assert.equal(mesh.material,f.material);}
  assert(result.collision.dynamicColliders().length>0);result.update(12);assert.equal(f.events.filter(e=>e==='update:12').length,1);
  assert.equal(result.snapshot().regions.reduce((n,r)=>n+r.placements,0),2);
  assert.equal(result.snapshot().sources.disposed,false);
});

test('page abort disposes colliders and every borrowed region before the source; repeated cleanup is safe',async()=>{
  const f=fixture(),result=await createWesternGardenScenePlanting(f.options());
  const collision=result.collision,release=collision.dispose;collision.dispose=()=>{f.events.push('collision-dispose');release();};
  f.controller.abort();await result.whenIdle();result.dispose();
  assert.equal(f.root.children.length,0);assert.equal(result.collision,null);assert.equal(collision.dynamicColliders().length,0);
  assert.equal(f.events.filter(e=>e==='source-dispose').length,1);
  assert(f.events.indexOf('collision-dispose')<f.events.indexOf('region-dispose:west'));
  assert(f.events.indexOf('region-dispose:west')<f.events.indexOf('source-dispose'));
  assert(f.events.indexOf('region-dispose:east')<f.events.indexOf('source-dispose'));
});

test('a current path conflict rejects before any full source is built',async()=>{
  const f=fixture();f.terrain.paths.push({id:'path',polygon:[[-2,-2],[2,-2],[2,2],[-2,2]]});
  await assert.rejects(createWesternGardenScenePlanting(f.options()),error=>error.plan?.rejected.some(p=>p.id==='west-tree'));
  assert.deepEqual(f.events,[]);assert.equal(f.root.children.length,0);
  f.geometry.dispose();f.material.dispose();
});

test('a second region failure rolls back the first without showing a partial garden',async()=>{
  const f=fixture();
  await assert.rejects(createWesternGardenScenePlanting({...f.options(),createRegion:options=>{
    if(options.regionId==='east')throw new Error('second-region failure');
    return f.createRegion(options);
  }}),/second-region failure/);
  assert.equal(f.root.children.length,0);assert.equal(f.owner.disposed,true);
  assert(f.events.indexOf('region-dispose:west')<f.events.indexOf('source-dispose'));
});

test('cancellation during a late region result disposes that result and leaves no mounted scene',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred();let late;
  const operation=createWesternGardenScenePlanting({...f.options(),regionIds:['west'],createRegion:async options=>{
    late=await f.createRegion(options);entered.resolve();await gate.promise;return late;
  }});
  await entered.promise;f.controller.abort();assert.equal(f.owner.disposed,false,'a pending borrowed region keeps its source alive until cleanup');gate.resolve();await assert.rejects(operation,{name:'AbortError'});
  assert(late.disposed);assert.equal(f.root.children.length,0);assert.equal(f.owner.disposed,true);
  assert(f.events.indexOf('region-dispose:west')<f.events.indexOf('source-dispose'));
  assert.equal(f.events.filter(e=>e==='source-dispose').length,1);
});

test('replacing retained architecture invalidates the region and removes invisible collision bodies',async t=>{
  const f=fixture(),result=await createWesternGardenScenePlanting(f.options());t.after(()=>result.dispose());
  const collision=result.collision;assert(collision.dynamicColliders().length>0);
  f.setArchitecture({intersectsGuideVolume:()=>true});
  assert.throws(()=>result.assertCurrent(),/architecture changed/);
  assert.equal(result.disposed,true);assert.equal(result.group.parent,null);assert.equal(result.collision,null);
  assert.equal(collision.dynamicColliders().length,0);assert.equal(f.owner.disposed,true);
});

test('collider construction failure releases every region and the source without mounting anything',async()=>{
  const f=fixture();
  await assert.rejects(createWesternGardenScenePlanting({...f.options(),createColliders:()=>{throw new Error('collision failure');}}),/collision failure/);
  assert.equal(f.root.children.length,0);assert.equal(f.owner.disposed,true);
  assert(f.events.includes('region-dispose:east'));assert(f.events.includes('region-dispose:west'));
});


test('abort from the final progress callback cannot publish a disposed garden or leave its source alive',async()=>{
  const f=fixture();
  await assert.rejects(createWesternGardenScenePlanting({...f.options(),onProgress:({completed,total})=>{if(completed===total)f.controller.abort();}}),{name:'AbortError'});
  assert.equal(f.root.children.length,0);assert.equal(f.owner.disposed,true);
  assert(f.events.indexOf('region-dispose:west')<f.events.indexOf('source-dispose'));
});
