import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gardenReviewCameraSightline} from '../src/yuanmingyuan/garden-review-camera.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';

const terrain={colliders:[{id:'visible-wall',from:[-5,0],to:[5,0],radius:.4,minY:0,maxY:3}]};
test('a low detail view cannot be accepted through an existing garden wall; moving inside or above it clears the ray',()=>{
  const architecture={intersectsGuideVolume:()=>false};
  assert.equal(gardenReviewCameraSightline({position:[0,1,-3],target:[0,1,3],terrain,architecture}).obstacleId,'visible-wall');
  assert.equal(gardenReviewCameraSightline({position:[0,1,1],target:[0,1,3],terrain,architecture}).clear,true);
  assert.equal(gardenReviewCameraSightline({position:[0,5,-3],target:[0,4,3],terrain,architecture}).clear,true);
});
test('detail preflight checks true transformed architectural triangles, including a thin occluder away from both endpoints',()=>{
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(.2,3,3),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(geometry,material);mesh.position.set(3,1.5,0);group.add(mesh);group.updateMatrixWorld(true);
  const architecture=createArchitectureSurface(group),terrain={colliders:[]};
  try{
    assert.equal(gardenReviewCameraSightline({position:[0,1,0],target:[6,2,0],terrain,architecture}).clear,false);
    assert.equal(gardenReviewCameraSightline({position:[0,4,0],target:[6,4,0],terrain,architecture}).clear,true);
  }finally{architecture.dispose();geometry.dispose();material.dispose();}
});
