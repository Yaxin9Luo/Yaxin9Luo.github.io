import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {visibleStudyBounds,fitStudyCameraClipping,STUDY_MINIMUM_NEAR} from '../src/yuanmingyuan/study-clipping.js';

test('visible bounds include translated instances and exclude hidden foreground parts',()=>{
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(2,2,2),material=new THREE.MeshStandardMaterial();
  const instances=new THREE.InstancedMesh(geometry,material,2);
  instances.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-5,2,1));
  instances.setMatrixAt(1,new THREE.Matrix4().makeTranslation(5,2,1));
  root.position.set(10,0,-20);root.add(instances);
  const hidden=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);mesh.position.set(900,900,900);hidden.add(mesh);hidden.visible=false;root.add(hidden);
  const bounds=visibleStudyBounds(root);
  assert.deepEqual(bounds.min.toArray(),[4,1,-20]);assert.deepEqual(bounds.max.toArray(),[16,3,-18]);
  instances.dispose();geometry.dispose();material.dispose();
});

test('a distant compound gains enough depth precision for 3 mm paving without changing framing',()=>{
  const camera=new THREE.PerspectiveCamera(40,2435/2200,.04,1200);
  camera.position.set(142,168,249);camera.lookAt(0,8,0);camera.updateMatrixWorld();
  const box=new THREE.Box3(new THREE.Vector3(-33,-.15,-75),new THREE.Vector3(51,20,96));
  const point=new THREE.Vector3(0,.96,0),paver=point.clone().add(new THREE.Vector3(0,.003,0));
  const depthGap=()=>Math.abs(point.clone().project(camera).z-paver.clone().project(camera).z)*.5*(2**24-1);
  const old=depthGap(),position=camera.position.clone(),quaternion=camera.quaternion.clone(),fov=camera.fov;
  const result=fitStudyCameraClipping(camera,box);
  assert.ok(old<1);assert.ok(depthGap()>16,'the 3 mm layers must retain at least sixteen depth cells of separation');
  assert.ok(result.near>10);assert.ok(result.near<result.closestVisibleDepth);
  assert.deepEqual(camera.position.toArray(),position.toArray());assert.deepEqual(camera.quaternion.toArray(),quaternion.toArray());assert.equal(camera.fov,fov);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const projected=new THREE.Vector3(x,y,z).project(camera);assert.ok(projected.z>=-1&&projected.z<=1,'every visible bound corner remains between the clip planes');
  }
});

test('orbiting into the subject restores the close near plane and an empty model remains safe',()=>{
  const camera=new THREE.PerspectiveCamera(40,1,.04,1200),box=new THREE.Box3(new THREE.Vector3(-10,-2,-10),new THREE.Vector3(10,15,10));
  camera.position.set(0,6,100);camera.lookAt(0,6,0);fitStudyCameraClipping(camera,box);assert.ok(camera.near>1);
  camera.position.set(0,6,0);camera.lookAt(0,6,-1);fitStudyCameraClipping(camera,box);assert.equal(camera.near,STUDY_MINIMUM_NEAR);
  const empty=fitStudyCameraClipping(camera,new THREE.Box3());assert.equal(empty.closestVisibleDepth,null);assert.ok(Number.isFinite(camera.far));
});
