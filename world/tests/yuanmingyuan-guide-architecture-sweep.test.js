import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanionSystem,evaluateCompanionSweep} from '../src/companion-system.js';
import {Box3,BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createGuideSweepVolume,intersectsGuideVolume} from '../src/yuanmingyuan/guide-architecture-sweep.js';
import {createArchitectureSurface,segmentSolid} from '../src/yuanmingyuan/architecture-surface.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const terrain={colliders:[],surfaceAt:()=>({height:4,normal:{x:0,y:1,z:0},walkable:true,surfaceId:'court'})};
const site={id:'yangquelong',position:[0,4,0],scale:1,guide:[0,0,0]};
function actorStub(onDispose=()=>{}){const group=new Group();return {group,model:group,asset:{durations:{sign_raise:.5,sign_lower:.5}},footStates:new Map(),setSign(){},setAction(){},setLanguage(){},update(){},dispose(){onDispose();group.removeFromParent();}};}

function collisionFixture(geometry,matrix=new Matrix4()){
  const bounds=new Box3().setFromBufferAttribute(geometry.attributes.position).applyMatrix4(matrix);
  const record={tree:new MeshBVH(geometry,{indirect:true}),matrix,inverse:matrix.clone().invert(),bounds},counters={};
  const sweepBlocked=segment=>intersectsGuideVolume({...createGuideSweepVolume(segment),counters},{records:[record],candidateIds:[0]});
  const evaluate=(from,to=from,interaction=false)=>evaluateCompanionSweep({kind:'elizabeth',from,to,interaction,heightAt:()=>4,waterLevel:2,sweepBlocked});
  return {sweepBlocked,evaluate,counters};
}

test('the continuous volume extension observes intermediate translation and rotation, not only endpoints',()=>{
  const calls=[],from={x:-3,z:0,heading:0},to={x:3,z:0,heading:Math.PI/2};
  const result=evaluateCompanionSweep({kind:'elizabeth',from,to,heightAt:()=>4,waterLevel:2,sweepBlocked:segment=>{
    calls.push(segment);return segment.from.x<0&&segment.to.x>=0;
  }});
  assert.equal(result.valid,false);
  assert.equal(result.reason,'architecture-obstacle');
  assert(calls.length>1);
  const hit=calls.at(-1);assert(hit.from.x<0&&hit.to.x>=0);
  assert(hit.from.heading>0&&hit.to.heading<Math.PI/2);
  assert.equal(hit.vertices.length,16);
  assert(hit.vertices.every(point=>[point.x,point.y,point.z].every(Number.isFinite)));
});

test('a real thin wall blocks translation between two individually clear endpoints',()=>{
  const geometry=new BoxGeometry(.004,4,8),c=collisionFixture(geometry,new Matrix4().makeTranslation(0,6,0));
  try{
    const a={x:-3,z:0,heading:0},b={x:3,z:0,heading:0};
    assert(c.evaluate(a).valid);assert(c.evaluate(b).valid);
    assert.equal(c.evaluate(a,b).reason,'architecture-obstacle');assert(c.counters.triangleTests>0);
  }finally{geometry.dispose();}
});

test('a real small pillar intersects the intervening body rotation while both endpoint poses fit',()=>{
  const geometry=new BoxGeometry(.02,2,.02),c=collisionFixture(geometry,new Matrix4().makeTranslation(-1.4,5.5,-1.4));
  try{
    const a={x:0,z:0,heading:0},b={...a,heading:Math.PI/2};
    assert(c.evaluate(a).valid);assert(c.evaluate(b).valid);
    assert.equal(c.evaluate(a,b).reason,'architecture-obstacle');
  }finally{geometry.dispose();}
});

test('a body fitting cannot excuse its raised board or a low overhead beam',()=>{
  const geometry=new BoxGeometry(.05,.05,.05),c=collisionFixture(geometry,new Matrix4().makeTranslation(2,6.8,0));
  const overhead=new BoxGeometry(3,.05,3),roof=collisionFixture(overhead,new Matrix4().makeTranslation(0,7.23,0));
  try{
    const pose={x:0,z:0,heading:0};assert(c.evaluate(pose).valid);assert.equal(c.evaluate(pose,pose,true).reason,'architecture-obstacle');
    assert(roof.evaluate(pose).valid);assert.equal(roof.evaluate(pose,pose,true).reason,'architecture-obstacle');
  }finally{geometry.dispose();overhead.dispose();}
});

test('triangle clipping preserves a genuine hole and actual transformed indexed/nonindexed geometry',()=>{
  const geometry=new BoxGeometry(.08,4,.08),shift=new Matrix4().makeTranslation(500,6,-200).multiply(new Matrix4().makeRotationY(.7)).scale(new Vector3(1.7,1,.6));
  const indexed=collisionFixture(geometry,shift),plainGeometry=geometry.toNonIndexed(),plain=collisionFixture(plainGeometry,shift);
  try{
    const from={x:497,z:-200,heading:0},to={x:503,z:-200,heading:0};
    assert.deepEqual(indexed.evaluate(from,to),plain.evaluate(from,to));assert.equal(indexed.evaluate(from,to).valid,false);
    // Two thin side walls leave a genuinely open triangle-free centre. Their
    // AABB overlaps the swept footprint but must never become a filled box.
    const aperture=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([
      -8,4,-3,-8,8,-3,-8,8,3, -8,4,-3,-8,8,3,-8,4,3,
      8,4,-3,8,8,3,8,8,-3, 8,4,-3,8,4,3,8,8,3,
    ],3));
    try{const hole=collisionFixture(aperture);assert(hole.evaluate({x:-3,z:0,heading:0},{x:3,z:0,heading:0}).valid);}finally{aperture.dispose();}
  }finally{geometry.dispose();plainGeometry.dispose();}
});

test('supporting floors keep the existing contact allowance, and invalid callback contracts fail closed',()=>{
  const geometry=new BoxGeometry(20,.1,20),c=collisionFixture(geometry,new Matrix4().makeTranslation(0,3.95,0));
  try{
    const from={x:0,z:0,heading:0};assert(c.evaluate(from,{x:3,z:0,heading:.5}).valid);
    assert.equal(evaluateCompanionSweep({kind:'elizabeth',from,heightAt:()=>4,sweepBlocked:()=>undefined}).reason,'invalid-world');
    assert.equal(evaluateCompanionSweep({kind:'elizabeth',from,heightAt:()=>4,sweepBlocked:true}).reason,'invalid-world');
  }finally{geometry.dispose();}
});

test('an unrelated low object cannot pass through a downhill corrected foot',()=>{
  const geometry=new BoxGeometry(.25,.019,1),c=collisionFixture(geometry,new Matrix4().makeTranslation(-.5,3.9995,.3));
  try{
    const from={x:0,z:0,heading:0},base={kind:'elizabeth',from,heightAt:x=>4+x*.01,waterLevel:2};
    assert(evaluateCompanionSweep(base).valid);
    assert.equal(evaluateCompanionSweep({...base,sweepBlocked:c.sweepBlocked}).reason,'architecture-obstacle');
  }finally{geometry.dispose();}
});

test('real shallow paving joints remain actual supporting contact rather than new architectural obstacles',()=>{
  const group=new Group(),geometry=new BoxGeometry(10,.2,20),material=new MeshBasicMaterial();
  for(const x of [-5.03,5.03]){const floor=new Mesh(geometry,material);floor.position.set(x,3.93,0);group.add(floor);}
  const architecture=createArchitectureSurface(group),world=createMuseumGuideWorld({site,terrain,architecture});
  try{
    const input={kind:'elizabeth',from:{x:-1,z:0,heading:0},to:{x:1,z:2,heading:.8},...world};
    const original=evaluateCompanionSweep({...input,sweepBlocked:undefined}),actual=evaluateCompanionSweep(input);
    assert.equal(original.valid,true);assert.deepEqual(actual,original);
  }finally{world.dispose();architecture.dispose();geometry.dispose();material.dispose();}
});

test('an initially enclosed solid is blocked while an actual hollow double shell keeps its interior open',()=>{
  const outer=new BoxGeometry(20,20,20),inner=new BoxGeometry(18,18,18);
  for(let i=0;i<inner.index.count;i+=3){const b=inner.index.getX(i+1);inner.index.setX(i+1,inner.index.getX(i+2));inner.index.setX(i+2,b);}
  const shell=mergeGeometries([outer,inner]),matrix=new Matrix4().makeTranslation(0,10,0),solid=collisionFixture(outer,matrix),hollow=collisionFixture(shell,matrix);
  try{
    const pose={x:0,z:0,heading:0};assert.equal(solid.evaluate(pose).reason,'architecture-obstacle');assert(solid.counters.enclosureHits>0);
    assert(hollow.evaluate(pose).valid);assert(hollow.counters.enclosureRaycasts>0);assert.equal(hollow.counters.enclosureHits??0,0);
  }finally{outer.dispose();inner.dispose();shell.dispose();}
});

test('the reproduced guide-2 patrol keeps moving without entering the actual small pillar',t=>{
  const building=new Group(),geometry=new BoxGeometry(.12,4,.12),material=new MeshBasicMaterial(),pillar=new Mesh(geometry,material);pillar.position.set(5.5,6,-7.7);building.add(pillar);
  const architecture=createArchitectureSurface(building),world=createMuseumGuideWorld({site,terrain,architecture}),root=new Group();let releases=0;
  // Keep the original failing patrol independent of improved placement and
  // route preflight, so this remains a live collision-controller regression.
  const placements=[{id:'yangquelong-guide-2',entryId:'yangquelong',position:{x:0,y:4,z:-7},heading:0,waypoints:[{x:3,z:-7},{x:3,z:-4},{x:0,z:-4}]}];
  const system=createCompanionSystem({root,...world,placements:placements.map(p=>({...p,kind:'elizabeth'})),createActor:()=>actorStub(()=>releases++)});
  const solid=segmentSolid({id:'actual-pillar',from:[5.5,-7.76],to:[5.5,-7.64],radius:.06,minY:4,maxY:8});
  try{
    for(let i=0;i<1800;i++){
      system.update(1/60);const actor=system.snapshot().actors[0];assert.equal(actor.valid,true);
      const probe=evaluateCompanionSweep({kind:'elizabeth',from:{...actor.position,heading:actor.heading},heightAt:world.heightAt,waterLevel:2,colliders:[solid]});
      assert.equal(probe.valid,true,`guide overlaps the real pillar at ${(i+1)/60} seconds`);
    }
    assert(system.snapshot().actors[0].distance>6,'the correction must preserve the real local patrol');
    const counts=world.snapshot().architectureSweeps;
    assert(counts.hits>0);assert(counts.cacheHits>0);assert(counts.cacheEntries<=128);
    t.diagnostic(JSON.stringify({simulatedSeconds:30,distance:system.snapshot().actors[0].distance,architectureSweeps:counts}));
  }finally{system.dispose();system.dispose();world.dispose();architecture.dispose();geometry.dispose();material.dispose();}
  assert.equal(releases,1);assert.equal(root.children.length,0);assert.equal(world.snapshot().architectureSweeps.cacheEntries,0);
});

test('actual world callback rejects a rotating raised sign and is retained by direct bindings/rebind',()=>{
  const geometry=new BoxGeometry(.02,2,.02),collision=collisionFixture(geometry,new Matrix4().makeTranslation(-1.4,5.5,-1.4)),root=new Group();
  const system=createCompanionSystem({root,heightAt:()=>4,waterLevel:2,sweepBlocked:collision.sweepBlocked,placements:[{id:'turner',kind:'elizabeth',position:{x:0,z:0},heading:0,waypoints:[]}],createActor:()=>actorStub()});
  try{
    const before=system.snapshot().actors[0];assert(before.valid);
    assert.equal(system.interact('turner',{playerPosition:{x:5,y:4,z:0}}),false,'interaction must reserve the intermediate turn as well as the final board');
    assert.equal(system.snapshot().actors[0].interactionCount,0);
    system.rebind({sweepBlocked:()=>false});assert.equal(system.interact('turner',{playerPosition:{x:5,y:4,z:0}}),true);
  }finally{system.dispose();geometry.dispose();}
});

test('the architecture owner bridge uses original instance matrices and disposal never transfers ownership',()=>{
  const group=new Group(),geometry=new BoxGeometry(.03,4,.03),material=new MeshBasicMaterial(),instances=new InstancedMesh(geometry,material,2);
  instances.setMatrixAt(0,new Matrix4().makeTranslation(2.2,6,0));instances.setMatrixAt(1,new Matrix4().makeTranslation(50,6,0));group.add(instances);
  const architecture=createArchitectureSurface(group),world=createMuseumGuideWorld({site,terrain,architecture});let disposals=0;geometry.addEventListener('dispose',()=>disposals++);
  const pose={x:0,z:0,heading:0};
  try{
    assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,...world}).valid,true);
    assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,interaction:true,...world}).reason,'architecture-obstacle');
    const first=world.snapshot().architectureSweeps;assert(first.candidateScans<5,'the far instance must not become a local triangle scan');
    for(let i=0;i<10;i++)assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,interaction:true,...world}).valid,false);
    assert.equal(world.snapshot().architectureSweeps.triangleTests,first.triangleTests,'exact repeats must reuse the immutable owner result');
  }finally{world.dispose();world.dispose();}
  assert.equal(disposals,0);assert.equal(world.snapshot().architectureSweeps.cacheEntries,0);
  architecture.dispose();assert.equal(disposals,0);geometry.dispose();material.dispose();assert.equal(disposals,1);
});

test('terrain-only worlds preserve support while missing architectural sweep APIs fail closed',()=>{
  const pose={x:0,z:0,heading:0},plain=createMuseumGuideWorld({site,terrain}),incomplete=createMuseumGuideWorld({site,terrain,architecture:{surfaceAt:()=>null}});
  try{
    assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,...plain}).valid,true);
    assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,...incomplete}).reason,'architecture-obstacle');
    assert.equal(incomplete.snapshot().architectureSweeps.unavailable,1);
    const height=()=>2.05;assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,...plain,heightAt:height}).reason,'shore');
    const grade=x=>4+x*.1;assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,...plain,heightAt:grade}).reason,'grade');
  }finally{plain.dispose();incomplete.dispose();}
});

test('an architecture owner released before its guide cannot leave a cached clearance authorized',()=>{
  const group=new Group(),geometry=new BoxGeometry(.1,3,.1),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material);mesh.position.set(20,5.5,0);group.add(mesh);
  const architecture=createArchitectureSurface(group),world=createMuseumGuideWorld({site,terrain,architecture}),input={kind:'elizabeth',from:{x:0,z:0,heading:0},...world};
  try{
    assert(evaluateCompanionSweep(input).valid);assert(evaluateCompanionSweep(input).valid);assert(world.snapshot().architectureSweeps.cacheHits>0);
    architecture.dispose();assert.equal(evaluateCompanionSweep(input).reason,'architecture-obstacle');assert.equal(world.snapshot().architectureSweeps.cacheEntries,0);
  }finally{world.dispose();architecture.dispose();geometry.dispose();material.dispose();}
});
