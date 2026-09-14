import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';
import {evaluateCompanionSweep} from '../src/companion-system.js';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial} from 'three';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createMuseumNavigation} from '../src/yuanmingyuan/visitor-motion.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {museumVisitorCollider} from '../src/yuanmingyuan/visitor-motion.js';

const site={position:[0,4,0]},flat=()=>({height:4,normal:{x:0,y:1,z:0},walkable:true,surfaceId:'ground'});
const segment=(id,from,to,radius=.08)=>({id,from,to,radius,minY:3.8,maxY:8});
test('raised terrace guides sample their actual floor without jumping to an upper storey',()=>{
  const group=new Group(),geometry=new BoxGeometry(20,.2,20),material=new MeshBasicMaterial();
  const terrace=new Mesh(geometry,material),upper=terrace.clone();terrace.position.y=4.75;upper.position.y=9.25;group.add(terrace,upper);
  const architecture=createArchitectureSurface(group),raised={position:[0,2.65,0],guide:[0,2.2,0],scale:1};
  const world=createMuseumGuideWorld({site:raised,terrain:{colliders:[],surfaceAt:()=>({height:2.99,normal:[0,1,0],walkable:true})},architecture});
  try{
    assert(Math.abs(world.heightAt(0,0)-4.85)<1e-6);
    assert.equal(world.snapshot().localArchitectureSupport.primitiveCount,1);
    assert(world.heightAt(0,0)<9,'the upper storey is excluded by the guide floor datum');
  }finally{world.dispose();architecture.dispose();geometry.dispose();material.dispose();}
});
test('the moving visitor is refreshed for guide sweeps without changing cached ground support',()=>{
  const visitor={mode:'grounded',position:{x:0,y:4,z:1}},world=createMuseumGuideWorld({site,terrain:{surfaceAt:flat,colliders:[]},visitorCollider:()=>museumVisitorCollider(visitor)});
  const pose={x:0,y:4,z:0,heading:0},check=()=>{const live=world.getWorld();return evaluateCompanionSweep({kind:'elizabeth',from:pose,interaction:true,...live,colliders:live.colliders.concat(live.visitorCollider)});};
  try{
    assert.equal(check().valid,false,'the full raised board/body envelope must not intersect the visitor');
    const support=world.heightAt(0,0);visitor.position.z=6;
    assert.equal(check().valid,true);assert.equal(world.heightAt(0,0),support);
    assert.equal(world.getWorld().visitorCollider.planes[4][3],6.65);
  }finally{world.dispose();}
});
test('nearby collision selection agrees with the full-world sweep, including a turning raised board',()=>{
  const walls=[segment('west',[-4,-4],[-4,4]),segment('short',[3.05,-1],[3.05,1]),segment('north',[-2,4],[2,4]),segment('negative-cell',[-33,-35],[-33,-27])];
  for(let i=0;i<1000;i++)walls.push(segment(`far-${i}`,[1000+i*3,1000],[1000+i*3,1005]));
  const world=createMuseumGuideWorld({site,terrain:{surfaceAt:flat,colliders:walls}});
  const cases=[
    [{x:0,z:0,heading:0},{x:0,z:0,heading:Math.PI/2},true],
    [{x:0,z:0,heading:0},{x:0,z:0,heading:0},false],
    [{x:-1,z:0,heading:0},{x:-6,z:0,heading:0},false],
    [{x:-30,z:-30,heading:0},{x:-35,z:-30,heading:.3},false],
    [{x:-35,z:16,heading:0},{x:35,z:16,heading:0},false],
  ];
  for(const [from,to,interaction] of cases){
    const input={kind:'elizabeth',from,to,interaction,heightAt:world.heightAt,waterLevel:2};
    const complete=evaluateCompanionSweep({...input,colliders:world.colliders}),near=world.collidersFor(from,to,'elizabeth',interaction),indexed=evaluateCompanionSweep({...input,colliders:near});
    assert.deepEqual(indexed,complete);assert(near.length<10);
  }
  assert.equal(world.snapshot().totalStaticColliders,1004);world.dispose();
});

test('static support cache preserves full coordinates, raised water and actual bridge surfaces',()=>{
  let calls=0;
  const terrain={colliders:[],surfaceAt:(x)=>{calls++;return x<0?{height:2.9,waterY:3.7,walkable:false}:flat();}};
  const architecture={surfaceAt:x=>x===-2?{height:4.2,normal:{x:0,y:1,z:0},walkable:true}:x===-1?{height:2.9,walkable:true}:x>0?{height:4+x*.01,normal:{x:0,y:1,z:0},walkable:true}:null};
  const world=createMuseumGuideWorld({site,terrain,architecture});
  assert.equal(world.heightAt(-1,0),undefined);assert.equal(world.heightAt(-2,0),4.2);
  const a=world.heightAt(1,0),b=world.heightAt(1.000001,0);assert.notEqual(a,b,'no rounded height-grid approximation');
  const before=calls;assert.equal(world.heightAt(1,0),a);assert.equal(world.heightAt.surfaceAt(1,0).height,a);assert.equal(calls,before);
  assert.equal(world.snapshot().cacheHits,2);world.dispose();assert.equal(world.heightAt(1,0),undefined);
});

test('cache capacity and owner replacement cannot leak prior-site support',()=>{
  let reads=0;
  const world=createMuseumGuideWorld({site,cacheLimit:2,terrain:{colliders:[],surfaceAt:()=>{reads++;return flat();}}});
  world.heightAt(0,0);world.heightAt(1,0);world.heightAt(2,0);assert(world.snapshot().cacheEntries<=2);
  world.heightAt(0,0);assert.equal(reads,4);world.dispose();world.dispose();assert.equal(world.snapshot().cacheEntries,0);
  const next=createMuseumGuideWorld({site,terrain:{colliders:[],surfaceAt:()=>({...flat(),height:4.5})}});assert.equal(next.heightAt(0,0),4.5);next.dispose();
});

test('capacity evicts one least-recent exact coordinate while retaining hot and missing support',()=>{
  const reads=[];
  const world=createMuseumGuideWorld({site,cacheLimit:3,terrain:{colliders:[],surfaceAt:(x,z)=>{reads.push([x,z]);return x<0?null:{...flat(),height:4+x*.01+z*.001};}}});
  world.heightAt(-1,0);world.heightAt(0,0);world.heightAt(1,0);
  assert.equal(world.heightAt(-1,0),undefined,'cached absence still participates in recency');
  world.heightAt(1.000001,0);const before=reads.length;
  assert.equal(world.heightAt(-1,0),undefined);assert.equal(world.heightAt(1,0),4.01);
  assert.equal(reads.length,before,'one overflow must not clear the other exact coordinates');
  world.heightAt(0,0);assert.equal(reads.length,before+1,'the cold coordinate was evicted');
  assert.equal(world.snapshot().cacheEntries,3);assert.equal(world.snapshot().cacheEvictions,2);
  assert.equal(world.snapshot().cacheMisses,reads.length);world.dispose();
});

test('guide owner uses exact local architecture and retains water rejection, fallback and independent disposal',()=>{
  const group=new Group(),geometry=new BoxGeometry(100,.128,100),material=new MeshBasicMaterial(),floor=new Mesh(geometry,material),roof=floor.clone();
  floor.position.y=4;roof.position.y=8;group.add(floor,roof);
  const architecture=createArchitectureSurface(group),terrain={colliders:[],surfaceAt:x=>({height:3.5,normal:[0,1,0],walkable:true,...(x<0?{waterY:4.2}:{})})};
  const world=createMuseumGuideWorld({site,terrain,architecture});
  assert.equal(world.heightAt(-1,0),undefined,'the actual floor remains underwater despite local architectural support');
  const expected=architecture.surfaceAt(1,0,{maxY:4.85});assert.deepEqual(world.heightAt.surfaceAt(1,0),expected);
  assert.equal(world.heightAt(27,0),expected.height,'leaving the local guide rectangle uses the full source');
  let state=world.snapshot();assert.equal(state.localArchitectureSupport.primitiveCount,1);assert.equal(state.localArchitectureSupport.fallbackQueries,1);
  assert.equal(state.localArchitectureSupport.queries,state.architectureQueries);
  world.heightAt(-1,0);world.heightAt(27,0);assert.equal(world.snapshot().architectureQueries,3);
  let disposals=0;geometry.addEventListener('dispose',()=>disposals++);world.dispose();state=world.snapshot();
  assert.equal(state.localArchitectureSupport.disposed,true);assert.equal(state.localArchitectureSupport.indexReferences,0);assert.equal(architecture.diagnostics.localGuideSupports,0);
  assert.equal(disposals,0);assert(architecture.surfaceAt(0,0,{maxY:5}));architecture.dispose();geometry.dispose();material.dispose();
});

test('failed local architecture preparation releases the already-created ground index',()=>{
  let disposals=0;
  const terrain={colliders:[],surfaceAt:flat,createGuideSupport:()=>({surfaceAt:flat,dispose(){disposals++;}})};
  const architecture={createGuideSupport(){throw new Error('source disposed');}};
  assert.throws(()=>createMuseumGuideWorld({site,terrain,architecture}),/source disposed/);assert.equal(disposals,1);
});

test('local spatial acceleration samples identical real triangles at edges and overlapping elevations',()=>{
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([
    -1000,4,-1000, -1000,4,1000, 1000,4,-1000,
    1000,4,-1000, -1000,4,1000, 1000,4,1000,
    -.3,4.3,-1, -.3,4.4,1, .3,4.4,1,
    -.3,4.3,-1, .3,4.4,1, .3,4.3,-1,
  ],3));
  const full=createTriangleSampler([geometry]),local=full.local({minX:-2,maxX:2,minZ:-2,maxZ:2},.25);
  for(const ceiling of [4.1,4.8,Infinity])for(const x of [-2,-.300001,-.3,-.299999,0,.3,.300001,2])for(const z of [-1.1,-1,0,1,1.1])assert.deepEqual(local.sample(x,z,ceiling),full.sample(x,z,ceiling));
  full.dispose();assert.equal(local.sample(0,0),null);local.dispose();geometry.dispose();
});

test('museum navigation reads actual array-form triangle normals and rejects a steep landing',()=>{
  const terrain={colliders:[],surfaceAt:()=>({height:4,normal:[.98,.2,0],walkable:true})};
  const nav=createMuseumNavigation({terrain});assert.equal(nav.landing({x:0,y:8,z:0}).valid,false);
  terrain.surfaceAt=()=>({height:4,normal:[0,1,0],walkable:true});assert.equal(nav.landing({x:0,y:8,z:0}).valid,true);
});
