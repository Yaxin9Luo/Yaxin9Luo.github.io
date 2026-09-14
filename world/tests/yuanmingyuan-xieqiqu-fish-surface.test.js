import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createRolledStoneFishBody,sampleStoneFishSurface,stoneFishMouth,stoneFishFlankAt} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

test('the actual bounded fish head closes with a deep mouth cup at the unchanged jet datum',()=>{
  const g=createRolledStoneFishBody({sampleEnd:.24});
  try{
    assert.equal(g.userData.partialAuthoringFixture,true);const topology=inspectClosedSculptureGeometry(g);assert.ok(topology.signedVolume>0);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);assert.equal(topology.inconsistentWindingEdges,0);assert.equal(topology.euler,2);
    const tree=new MeshBVH(g,{indirect:true}),mouth=new THREE.Vector3(...stoneFishMouth),axis=new THREE.Vector3(...g.userData.mouthNormal);
    assert.equal(tree.raycastFirst(new THREE.Ray(mouth,axis),THREE.DoubleSide),null,'the plume leaves an actual opening');
    const inner=tree.raycastFirst(new THREE.Ray(mouth,axis.clone().negate()),THREE.DoubleSide);assert.ok(inner);assert.ok(inner.distance>.22&&inner.distance<.27,'the back wall is recessed, not a ring in front of a cap');
    for(const side of [-1,1]){const start=mouth.clone().addScaledVector(axis,.10);start.x=side*.19;const lip=tree.raycastFirst(new THREE.Ray(start,axis.clone().negate()),THREE.DoubleSide);assert.ok(lip&&lip.distance<.15,'the integrated lip surrounds the opening');}
  }finally{g.dispose();}
});

test('fin contact inversion recovers the actual smooth flank rather than a bounding ellipsoid',()=>{
  for(let i=0;i<=20;i++)for(let j=-4;j<=4;j++){const t=.22+i/20*.22,angle=j*.14,source=sampleStoneFishSurface(t,angle,{relief:false}).position,found=stoneFishFlankAt(source.y,source.z);assert.ok(found.position.distanceTo(source)<2e-7);assert.ok(Math.abs(t-found.t)<2e-7);}
});

test('roll-tail scales are bounded relief on a continuous surface rather than detached studs',()=>{
  let raised=0;for(let i=0;i<=250;i++){const t=.23+i/250*.70,angle=i*.21,a=sampleStoneFishSurface(t,angle),b=sampleStoneFishSurface(t,angle,{relief:false}),height=a.position.distanceTo(b.position);assert.ok(height<.009);if(height>.002)raised++;const nearby=sampleStoneFishSurface(t+1e-7,angle+1e-7);assert.ok(nearby.position.distanceTo(a.position)<.00005);}
  assert.ok(raised>30);assert.deepEqual(stoneFishMouth,[0,.96,1.25]);assert.throws(()=>createRolledStoneFishBody({sampleEnd:0}),/sampling end/);
});
