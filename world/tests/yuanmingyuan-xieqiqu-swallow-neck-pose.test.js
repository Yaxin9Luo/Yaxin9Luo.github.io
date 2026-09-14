import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {poseShortNeckBodyPoint,swallowShortNeckMouth,swallowShortNeckFountainContract,createSwallowShortNeckLocalGeometry} from '../src/yuanmingyuan/xieqiqu-swallow-neck-pose.js';
import {poseSwallowBodyPoint} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

test('short-neck proposal rigidly moves the full beak and outlet while retaining wing/leg attachment coordinates',()=>{
  const mapped=poseShortNeckBodyPoint(new THREE.Vector3(0,.587,.579));assert.ok(mapped.distanceTo(new THREE.Vector3(...swallowShortNeckMouth))<1e-14);
  for(const z of [.376,.40,.410,.470,.579])for(const x of [-.09,0,.09]){
    const source=new THREE.Vector3(x,.622,z),expected=source.clone().add(new THREE.Vector3(0,-.170,-.10));assert.ok(poseShortNeckBodyPoint(source).distanceTo(expected)<1e-14,'head and mouth cannot be stretched to retain the old outlet');
  }
  for(const x of [-.085,-.065,0,.065,.085])for(const z of [-.10,-.013,.02,.04,.06]){
    const point=new THREE.Vector3(x,.5,z);assert.deepEqual(poseShortNeckBodyPoint(point).toArray(),poseSwallowBodyPoint(point).toArray());
  }
  assert.deepEqual(swallowShortNeckFountainContract.mouthAnchor,swallowShortNeckMouth);assert.equal(swallowShortNeckFountainContract.worldIntegrated,false);
});

test('neck shortening preserves positive orientation, mirror symmetry and finite thickness',()=>{
  let minimum=Infinity;
  for(let z=-.05;z<=.6;z+=.005)for(const x of [-.1,0,.1]){
    const p=new THREE.Vector3(x,.54,z),h=1e-6,columns=[0,1,2].map(i=>{const a=p.clone(),b=p.clone();a.setComponent(i,a.getComponent(i)+h);b.setComponent(i,b.getComponent(i)-h);return poseShortNeckBodyPoint(a).sub(poseShortNeckBodyPoint(b)).multiplyScalar(.5/h);});
    const determinant=columns[0].dot(columns[1].clone().cross(columns[2]));minimum=Math.min(minimum,determinant);assert.ok(determinant>.42);
    const a=poseShortNeckBodyPoint(p),b=poseShortNeckBodyPoint(new THREE.Vector3(-x,p.y,z));assert.ok(a.distanceTo(new THREE.Vector3(-b.x,b.y,b.z))<1e-14);
  }
  console.log('SHORT_NECK_JACOBIAN '+minimum);
});

test('the actual local neck and complete mouth keep a closed surface and open water outlet',()=>{
  assert.throws(()=>createSwallowShortNeckLocalGeometry({endZ:-.366}),/local shoulder/);
  const geometry=createSwallowShortNeckLocalGeometry({endZ:.18}),tree=new MeshBVH(geometry,{indirect:true});let events=0;geometry.addEventListener('dispose',()=>events++);
  try{
    const result=inspectClosedSculptureGeometry(geometry);assert.equal(result.connectedComponents,1);assert.equal(result.euler,2);assert.equal(result.boundaryEdges,0);assert.equal(result.nonManifoldEdges,0);assert.equal(result.inconsistentWindingEdges,0);assert.equal(result.degenerateFaces,0);assert.equal(result.inwardShadingFaces,0,JSON.stringify(result.badFaceExamples));assert.ok(result.signedVolume>0);
    const point=new THREE.Vector3(...swallowShortNeckMouth),out=tree.raycastFirst(new THREE.Ray(point,new THREE.Vector3(0,0,1)),THREE.DoubleSide),back=tree.raycastFirst(new THREE.Ray(point,new THREE.Vector3(0,0,-1)),THREE.DoubleSide);assert.equal(out,null);assert.ok(Math.abs(back.distance-.169)<1e-6);
    assert.equal(geometry.userData.wholeBodyConstructed,false);assert.equal(geometry.userData.artificialRearCap,true);
    console.log('SHORT_NECK_LOCAL '+JSON.stringify({triangles:result.triangles,inward:result.inwardShadingFaces,minimumNormalDot:result.minimumFaceNormalDot,mouthDepth:back.distance}));
  }finally{geometry.dispose();}assert.equal(events,1);
});
