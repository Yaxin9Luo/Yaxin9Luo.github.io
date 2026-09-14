import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createContinuousSwallowBody,swallowSurfaceMouth,swallowBodyProfile,sampleSwallowSurface} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {createCopperSwallowLegGeometry,createCopperSwallowToeGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

test('actual local beak skin has outward smooth normals and a deep opening at the original fountain outlet',()=>{
  const g=createContinuousSwallowBody({endZ:.40});
  try{const r=inspectClosedSculptureGeometry(g);assert.equal(g.userData.partialAuthoringFixture,true);assert.equal(r.boundaryEdges,0);assert.equal(r.inwardShadingFaces,0,JSON.stringify(r.badFaceExamples));assert.equal(r.degenerateFaces,0);assert.equal(r.euler,2);assert.equal(r.connectedComponents,1);assert.ok(r.signedVolume>0);
    const tree=new MeshBVH(g,{indirect:true}),mouth=new THREE.Vector3(...swallowSurfaceMouth),outward=new THREE.Vector3(0,.533,.421).normalize();assert.equal(tree.raycastFirst(new THREE.Ray(mouth,outward),THREE.DoubleSide),null,'original plume direction exits through real air');assert.equal(tree.raycastFirst(new THREE.Ray(mouth,new THREE.Vector3(0,0,1)),THREE.DoubleSide),null);const inner=tree.raycastFirst(new THREE.Ray(mouth,new THREE.Vector3(0,0,-1)),THREE.DoubleSide);assert.ok(inner&&inner.distance>.16&&inner.distance<.18);for(const side of [-1,1])assert.equal(tree.raycastFirst(new THREE.Ray(new THREE.Vector3(0,.587,.51),new THREE.Vector3(side,0,0)),THREE.DoubleSide),null,'gape is open sideways between both mandibles, not a round pipe');console.log('SWALLOW_LOCAL_MOUTH '+JSON.stringify({triangles:r.triangles,minDot:r.minimumFaceNormalDot,depth:inner.distance}));
  }finally{g.dispose();}
});

test('the uncarved chest profile has no alternating transverse segment shoulders and plumage remains local',()=>{
  let previous=swallowBodyProfile(.10).width,raised=0;
  for(let i=1;i<=600;i++){const z=.10+i/600*.23,p=swallowBodyProfile(z);assert.ok(p.width<=previous+1e-12,'neck-to-chest width is continuous and monotonic here');previous=p.width;const sample=sampleSwallowSurface(z,i*.071),plain=sampleSwallowSurface(z,i*.071,{detail:false}),height=sample.position.distanceTo(plain.position);assert.ok(height<.0019);if(height>.0006)raised++;const near=sampleSwallowSurface(z+1e-7,i*.071);assert.ok(near.position.distanceTo(sample.position)<.000002);}
  assert.ok(raised>60);
});

test('all curved toe caps are buried in the actual ankle and every sole remains at the source floor datum',()=>{
  for(const side of [-1,1]){const leg=createCopperSwallowLegGeometry(side),tree=new MeshBVH(leg,{indirect:true});try{
    for(const toe of [-1,0,1,2]){const g=createCopperSwallowToeGeometry(side,toe),p=g.attributes.position;try{g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.min.y)<1e-8);const topology=inspectClosedSculptureGeometry(g);assert.equal(topology.inwardShadingFaces,0,JSON.stringify(topology.badFaceExamples));assert.equal(topology.degenerateFaces,0);assert.equal(topology.boundaryEdges,0);for(let corner=0;corner<g.userData.sides;corner++)for(const direction of [[1,.173,.071],[-.213,1,.131],[.113,-.173,1]]){const ray=new THREE.Ray(new THREE.Vector3().fromBufferAttribute(p,corner),new THREE.Vector3(...direction).normalize()),hit=tree.raycastFirst(ray,THREE.DoubleSide);assert.ok(hit&&hit.face.normal.dot(ray.direction)>0,`side ${side} toe ${toe} corner ${corner} exposed root cap`);}}finally{g.dispose();}}
  }finally{leg.dispose();}}
});
