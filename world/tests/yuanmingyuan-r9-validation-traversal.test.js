import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createXieqiquR9FishIntegrationFromOwners} from '../src/yuanmingyuan/xieqiqu-r9-fish-integration-r1.js';
import {r9IntegrationFixture} from './helpers/r9-integration-fixture.js';

function fixture(t){const f=r9IntegrationFixture(createXieqiquR9FishIntegrationFromOwners);t.after(()=>f.cleanup());return f;}
function attached(t){const f=fixture(t),owner=f.install();return {...f,owner};}
function unchangedGraph(f){assert.deepEqual(f.animals.children,f.originalChildren);assert.deepEqual(f.sourceParent.children,f.sourceChildren);assert.deepEqual(f.events,[]);assert(f.resources.every(r=>r.disposals===0));}

test('validate traverses the complete root once on every call without caching between calls',t=>{
  const f=attached(t),original=f.root.traverse;let traversals=0,visits=0;
  f.root.traverse=function(callback){traversals++;return original.call(this,node=>{visits++;callback(node);});};
  const first=f.owner.validate(),once=visits;assert.equal(traversals,1);assert(once>4);
  assert.deepEqual(f.owner.validate(),first);assert.equal(traversals,2);assert.equal(visits,2*once);
  const added=new THREE.Group();added.name=f.owner.records[0].name;f.root.add(added);
  assert.throws(()=>f.owner.validate(),/replacement slot count or ownership changed/);assert.equal(traversals,3);
  added.removeFromParent();assert.equal(f.owner.validate().installedFish,4);assert.equal(traversals,4);
});

for(const [label,mutate] of [
  ['nested duplicate slot',f=>{const duplicate=new THREE.Group();duplicate.name=f.owner.records[0].name;f.basin.add(duplicate);}],
  ['renamed installed slot',f=>{f.owner.records[0].next.name='renamed-slot';}],
  ['different object taking the original slot name',f=>{const r=f.owner.records[0];r.next.name='renamed-slot';const replacement=new THREE.Group();replacement.name=r.name;f.basin.add(replacement);}],
  ['missing installed mount',f=>f.owner.records[0].next.removeFromParent()],
]){
  test('runtime identity rejects '+label,t=>{const f=attached(t);f.owner.validate();mutate(f);assert.throws(()=>f.owner.validate(),/replacement slot count or ownership changed/);});
}
for(const [label,mutate,pattern] of [
  ['duplicate basin name',f=>{const duplicate=new THREE.Group();duplicate.name=f.basin.name;f.root.add(duplicate);},/duplicated review basin or cropped court/],
  ['renamed original basin',f=>{f.basin.name='renamed-basin';},/duplicated review basin or cropped court/],
  ['forbidden cropped-court node',f=>{const cropped=new THREE.Group();cropped.name='xieqiqu-south-pool-cropped-court';f.root.add(cropped);},/duplicated review basin or cropped court/],
  ['missing original nonfish node',f=>f.floor.removeFromParent(),/original nonfish node left/],
]){
  test('runtime preservation rejects '+label,t=>{const f=attached(t);mutate(f);assert.throws(()=>f.owner.validate(),pattern);});
}
test('original nonfish geometry, material, parent and local matrix checks remain active',t=>{
  const f=attached(t);
  for(const change of [
    ()=>{f.floor.geometry=f.poolOwner.supports[0].core.geometry;},
    ()=>{f.floor.material=f.poolOwner.supports[0].coreMesh.material;},
    ()=>f.root.add(f.floor),
    ()=>{f.floor.position.x+=.01;},
  ]){
    const geometry=f.floor.geometry,material=f.floor.material;
    // Captured originals are restored directly below because each mutation is independent.
    change();assert.throws(()=>f.owner.validate(),/original nonfish geometry\/material\/parent\/local matrix changed/);
    f.floor.geometry=geometry;f.floor.material=material;f.basin.add(f.floor);f.floor.position.x=0;f.floor.updateMatrix();
    assert.equal(f.owner.validate().installedFish,4);
  }
});
test('preflight rejects original and replacement matrix drift before any ownership transfer',t=>{
  for(const kind of ['original','replacement']){
    const f=fixture(t),mount=kind==='original'?f.oldMounts[0]:f.mounts[0].group;mount.position.x+=.001;
    assert.throws(()=>f.install(),kind==='original'?/original slot matrix drift/:/replacement local matrix drift/);unchangedGraph(f);
  }
});
test('duplicate original slot names fail before mutation',t=>{
  const f=fixture(t),duplicate=new THREE.Group();duplicate.name=f.oldMounts[0].name;f.animals.add(duplicate);
  assert.throws(()=>f.install(),/expected one direct|ambiguous/);duplicate.removeFromParent();unchangedGraph(f);
});
test('third mount added-event failure rolls back both actual Three graphs without disposing source owners',t=>{
  const f=fixture(t),mount=f.mounts[2].group,failure=new Error('third mount commit sentinel');
  const fail=()=>{mount.removeEventListener('added',fail);throw failure;};mount.addEventListener('added',fail);
  assert.throws(()=>f.install(),error=>error===failure);unchangedGraph(f);assert.equal(f.root.userData.r9FishReplacement,undefined);
});
test('canonical names preserve 1/3/2/4 sibling order, whole mount membership, shared resources and callback identities',t=>{
  const f=fixture(t),before=f.mounts.map(m=>[...m.body.children,f.poolOwner.supports.find(s=>s.mount===m).coreMesh].map(n=>[n,n.geometry,n.material,n.onBeforeRender]));
  const owner=f.install();assert.deepEqual(owner.records.map(r=>r.index),[1,2,3,4]);
  assert.deepEqual(f.animals.children.map(n=>Number(n.name.at(-1))),[1,3,2,4]);
  for(const r of owner.records){assert.equal(r.next,f.animals.children[r.oldSiblingIndex]);assert.equal(r.old.parent,null);assert.deepEqual(r.next.children,[r.mount.body,r.mount.plinth,r.mount.flow]);}
  for(const entries of before)for(const [mesh,geometry,material,callback]of entries){assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(mesh.onBeforeRender,callback);}
  for(const r of owner.records)r.fishView.group.children.forEach((mesh,i)=>assert.equal(mesh.geometry,f.sourceGroup.children[i].geometry));
  assert.equal(owner.diagnostics.stage,'pending-native-art');assert.equal(owner.diagnostics.visualAcceptance,false);assert.equal(owner.diagnostics.integrationAcceptance,false);
});
test('translated tilted scaled parent retains real canonical contact and waterline checks',t=>{
  const f=attached(t),region=new THREE.Group();region.position.set(18,2.3,-26);region.rotation.set(.04,.31,-.025);region.scale.setScalar(.83);region.add(f.root);region.updateMatrixWorld(true);
  const result=f.owner.validate();assert(result.bindings.some(b=>Math.abs(b.worldLanding[1]-.13)>.1));
  for(const b of result.bindings){assert(Math.abs(b.poolLocalLanding[1]-.13)<1e-9);assert(Math.abs(b.poolLocalFloorY+.45)<2e-7);assert(b.sourceGeometryRetained);}
  const r=f.owner.records[0],before=r.next.position.x;r.next.position.x+=.0001;assert.throws(()=>f.owner.validate(),/canonical local matrix changed/);r.next.position.x=before;assert.equal(f.owner.validate().installedFish,4);
  const start=f.poolOwner.baseOwner.context.diagnostics.waterEndpoints[0].start;start[0]+=.001;assert.throws(()=>f.owner.validate(),/fish mouth and actual source jet separated/);start[0]-=.001;
  const end=f.poolOwner.baseOwner.context.diagnostics.waterEndpoints[0].end;end[1]+=.001;assert.throws(()=>f.owner.validate(),/landing left the original pool-local waterline/);
});
test('update keeps exact per-owner dispatch and static buffer contents',t=>{
  const f=attached(t),arrays=f.resources.filter(r=>r.value.isBufferGeometry).flatMap(r=>[r.value.index?.array,...Object.values(r.value.attributes).map(a=>a.array)]).filter(Boolean),before=arrays.map(a=>Array.from(a));
  assert.throws(()=>f.owner.update(NaN),/finite animation time/);
  for(const time of [0,.21,.62,1.2])f.owner.update(time);
  assert.deepEqual(f.events,[0,.21,.62,1.2].flatMap(time=>[['building-update',time],['pool-update',time]]));
  assert.deepEqual(arrays.map(a=>Array.from(a)),before);
});
test('abort and repeated disposal release pool before building exactly once',t=>{
  const f=fixture(t),controller=new AbortController(),owner=f.install({signal:controller.signal});
  controller.abort();owner.dispose();owner.dispose();owner.update(2);
  assert.deepEqual(f.events,['pool-dispose','building-dispose']);assert(f.resources.every(r=>r.disposals===1));assert.equal(f.root.children.length,0);assert.equal(f.poolOwner.group.children.length,0);assert.equal(owner.records.length,0);
  assert.throws(()=>owner.validate(),/disposed adapter/);
});
