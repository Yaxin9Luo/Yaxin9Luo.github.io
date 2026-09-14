import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {createArchitectureSurface,segmentSolid} from '../src/yuanmingyuan/architecture-surface.js';
import {queryGroundSupport} from '../src/ground-motion.js';

function room(){
  const group=new Group(),material=new MeshBasicMaterial();
  const box=(x,y,z,w,h,d)=>{const mesh=new Mesh(new BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  box(0,-.1,0,10,.2,10);box(-2,2,0,2,4,.4);box(2,2,0,2,4,.4);box(0,3.7,0,2,.6,.4);box(0,5,0,10,.3,10);
  return {group,box,dispose(){group.traverse(mesh=>mesh.geometry?.dispose());material.dispose();}};
}

test('actual doorway is clear, jamb/lintel are solid and a roof is not selected through a ceiling cap',()=>{
  const fixture=room(),surface=createArchitectureSurface(fixture.group);
  assert.ok(Math.abs(surface.surfaceAt(0,0,{maxY:.3}).height)<1e-7);
  assert.ok(surface.surfaceAt(0,0,{maxY:10}).height>5);
  assert.equal(surface.capsuleBlocked({x:0,y:0,z:0}),false);
  assert.equal(surface.capsuleBlocked({x:1.1,y:0,z:0}),true);
  assert.equal(surface.capsuleBlocked({x:0,y:1,z:0}),true);
  surface.dispose();fixture.dispose();
});

test('source indexed/nonindexed meshes and shared geometry are unchanged; placement transforms apply',()=>{
  const fixture=room(),nonindexed=new Mesh(new BoxGeometry(1,1,1).toNonIndexed(),new MeshBasicMaterial());fixture.group.add(nonindexed);nonindexed.position.set(4,.5,4);
  const shared=nonindexed.clone();shared.position.x=-4;fixture.group.add(shared);
  fixture.group.rotation.y=Math.PI/2;fixture.group.position.set(600,4,-700);
  const before=fixture.group.children.map(mesh=>({index:mesh.geometry.index,positions:mesh.geometry.attributes.position.array.slice(),indices:mesh.geometry.index?.array.slice()}));
  const surface=createArchitectureSurface(fixture.group);
  assert.equal(surface.diagnostics.geometryCount,fixture.group.children.length-1);
  assert.ok(Math.abs(surface.surfaceAt(600,-700,{maxY:4.3}).height-4)<1e-7);
  assert.ok(Math.abs(surface.surfaceAt(604,-704,{maxY:7}).height-5)<1e-6);
  assert.equal(surface.capsuleBlocked({x:600,y:4,z:-700}),false);
  fixture.group.children.forEach((mesh,i)=>{assert.equal(mesh.geometry.index,before[i].index);assert.deepEqual(mesh.geometry.attributes.position.array,before[i].positions);assert.deepEqual(mesh.geometry.index?.array,before[i].indices);});
  surface.dispose();assert.equal(surface.surfaceAt(600,-700,{maxY:10}),null);assert.equal(surface.diagnostics.geometryCount,0);fixture.dispose();nonindexed.material.dispose();
});

test('wall-segment adapter preserves an open gateway for existing ground support',()=>{
  const solid=(from,to)=>segmentSolid({id:'wall',from,to,radius:.3,minY:0,maxY:4});
  const world={heightAt:()=>0,waterLevel:-2,colliders:[solid([-4,0],[-1,0]),solid([1,0],[4,0])]};
  assert.equal(queryGroundSupport({x:0,z:0,feetY:0},world).valid,true);
  assert.equal(queryGroundSupport({x:2,z:0,feetY:0},world).reason,'blocked');
  assert.equal(queryGroundSupport({x:2,z:2,feetY:0},world).valid,true);
});

test('cancellation releases indexes without disposing the render owner geometry',()=>{
  const fixture=room(),controller=new AbortController();let disposals=0;
  fixture.group.children[0].geometry.addEventListener('dispose',()=>disposals++);
  const surface=createArchitectureSurface(fixture.group,{signal:controller.signal});controller.abort();surface.dispose();
  assert.equal(surface.diagnostics.disposed,true);assert.equal(disposals,0);fixture.dispose();assert.equal(disposals,1);
});

test('instanced floors and columns retain real placement, clear gaps and shared geometry',()=>{
  const group=new Group(),geometry=new BoxGeometry(1,1,1),material=new MeshBasicMaterial();
  const meshes=new InstancedMesh(geometry,material,3),matrix=new Matrix4();
  meshes.setMatrixAt(0,matrix.makeScale(8,.2,8).setPosition(0,-.1,0));
  meshes.setMatrixAt(1,matrix.makeScale(.8,4,.8).setPosition(-2,2,0));
  meshes.setMatrixAt(2,matrix.makeScale(.8,4,.8).setPosition(2,2,0));
  group.add(meshes);group.position.set(600,4,-700);group.rotation.y=.63;group.scale.setScalar(1.5);group.updateMatrixWorld(true);
  const before=meshes.instanceMatrix.array.slice(),positions=geometry.attributes.position.array.slice(),indices=geometry.index.array.slice();
  const surface=createArchitectureSurface(group),world=(x,y,z)=>new Vector3(x,y,z).applyMatrix4(group.matrixWorld);
  const gap=world(0,0,0),column=world(2,0,0),columnApproach=world(1.55,0,0),off=world(5,0,0);
  assert.ok(Math.abs(surface.surfaceAt(gap.x,gap.z,{maxY:4.4})?.height-4)<1e-6);
  assert.equal(surface.capsuleBlocked({x:gap.x,y:gap.y,z:gap.z}),false);
  assert.equal(surface.capsuleBlocked({x:columnApproach.x,y:columnApproach.y,z:columnApproach.z}),true);
  assert.equal(surface.surfaceAt(off.x,off.z,{maxY:10}),null);
  const roof=surface.surfaceAt(column.x,column.z,{maxY:12});
  assert.ok(Math.abs(roof.height-10)<1e-6);assert.ok(roof.normal.y>.999);
  assert.equal(surface.diagnostics.geometryCount,1);assert.equal(surface.diagnostics.instanceCount,3);
  assert.deepEqual(meshes.instanceMatrix.array,before);assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.index.array,indices);
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);surface.dispose();surface.dispose();assert.equal(disposed,0);
  assert.equal(surface.diagnostics.primitiveCount,0);geometry.dispose();material.dispose();
});

test('local guide support keeps exact transformed instance rays, doorway edges and vertical fallback',()=>{
  const group=new Group(),geometry=new BoxGeometry(1,1,1),material=new MeshBasicMaterial(),instances=new InstancedMesh(geometry,material,5),matrix=new Matrix4();
  instances.setMatrixAt(0,matrix.makeScale(20,.2,20).setPosition(0,-.1,0));
  instances.setMatrixAt(1,matrix.makeScale(1,.3,2).setPosition(-1,.15,0));
  instances.setMatrixAt(2,matrix.makeScale(1,.5,2).setPosition(1,.25,0));
  instances.setMatrixAt(3,matrix.makeScale(3,.2,3).setPosition(0,4,0));
  instances.setMatrixAt(4,matrix.makeScale(1,.4,1).setPosition(5,.2,0));
  group.add(instances);group.position.set(600,4,-700);group.rotation.y=.63;group.scale.set(1.25,1.5,.9);group.updateMatrixWorld(true);
  const before={matrices:instances.instanceMatrix.array.slice(),positions:geometry.attributes.position.array.slice(),indices:geometry.index.array.slice()};
  const surface=createArchitectureSurface(group),local=surface.createGuideSupport({minX:597,maxX:603,minZ:-703,maxZ:-697},{maxY:5,cellSize:.5});
  const world=(x,y,z)=>new Vector3(x,y,z).applyMatrix4(group.matrixWorld);
  for(const x of [-5,-1.500001,-1.5,-1.499999,-.5,0,.5,1.5,5])for(const z of [-1.000001,-1,0,1,1.000001]){
    const p=world(x,0,z);
    for(const maxY of [4.1,5,12,Infinity])assert.deepEqual(local.surfaceAt(p.x,p.z,{maxY}),surface.surfaceAt(p.x,p.z,{maxY}));
  }
  assert(local.snapshot().fallbackQueries>0,'out-of-bounds and broader vertical queries use the complete source');
  const aboveFloor=surface.createGuideSupport({minX:599,maxX:601,minZ:-701,maxZ:-699},{minY:4.2,maxY:5});
  assert.deepEqual(aboveFloor.surfaceAt(600,-700,{minY:3}),surface.surfaceAt(600,-700,{minY:3,maxY:5}));
  assert.equal(aboveFloor.snapshot().fallbackQueries,1,'a broader lower height bound also falls back');aboveFloor.dispose();
  assert.deepEqual(instances.instanceMatrix.array,before.matrices);assert.deepEqual(geometry.attributes.position.array,before.positions);assert.deepEqual(geometry.index.array,before.indices);
  let disposals=0;geometry.addEventListener('dispose',()=>disposals++);local.dispose();local.dispose();assert.equal(local.surfaceAt(600,-700),null);assert.equal(disposals,0);
  assert(surface.surfaceAt(600,-700,{maxY:5}));surface.dispose();geometry.dispose();material.dispose();
});

test('local guide index prunes real instance candidates without changing hits or BVH ownership',()=>{
  const group=new Group(),geometry=new BoxGeometry(1,1,1),material=new MeshBasicMaterial(),instances=new InstancedMesh(geometry,material,401),matrix=new Matrix4();
  instances.setMatrixAt(0,matrix.makeScale(100,.2,100).setPosition(0,-.1,0));
  for(let i=0;i<400;i++)instances.setMatrixAt(i+1,matrix.makeScale(.35,1,.35).setPosition((i%20)*.7-6.8,i<200?8:.5,Math.floor(i/20)*.7-6.8));
  group.add(instances);const controller=new AbortController(),surface=createArchitectureSurface(group,{signal:controller.signal});
  const local=surface.createGuideSupport({minX:-3,maxX:3,minZ:-3,maxZ:3},{maxY:.4,cellSize:.5});
  for(let i=0;i<100;i++){
    const x=(i%10)*.59-2.7,z=Math.floor(i/10)*.59-2.7;
    assert.deepEqual(local.surfaceAt(x,z),surface.surfaceAt(x,z,{maxY:.4}));
  }
  const direct=surface.diagnostics.support,near=local.snapshot();
  assert.equal(direct.queries,100);assert.equal(near.queries,100);
  const fullRecordScans=surface.diagnostics.primitiveCount*direct.queries;
  assert(direct.candidateScans<fullRecordScans/20,'the global exact index also avoids the old broad cell scan');
  assert(near.candidateScans<fullRecordScans/20,'local support remains substantially narrower than all records');
  assert.equal(near.preciseTriangleTests,100,'each interior query retains one exact original-triangle intersection');
  assert(near.raycasts<direct.raycasts,'the local triangle index avoids repeated BVH traversal without changing hits');
  assert.equal(surface.diagnostics.geometryCount,1);controller.abort();assert.equal(local.snapshot().disposed,true);assert.equal(local.surfaceAt(0,0),null);
  assert.equal(local.snapshot().primitiveCount,0);local.dispose();surface.dispose();geometry.dispose();material.dispose();
});
