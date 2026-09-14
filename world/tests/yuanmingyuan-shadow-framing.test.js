import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitStudyShadow} from '../src/yuanmingyuan/shadow-framing.js';

test('doorway closeup concentrates native shadow resolution while preserving sun direction and caster depth',()=>{
  const light=new THREE.DirectionalLight();light.position.set(-90,170,130);light.target.position.set(0,4,0);light.shadow.mapSize.set(4096,4096);
  const original=light.position.clone().sub(light.target.position).normalize(),whole=new THREE.Box3(new THREE.Vector3(-160,-2,-20),new THREE.Vector3(60,14,20)),detail=new THREE.Box3(new THREE.Vector3(-4,0,-3),new THREE.Vector3(4,12,3));
  const full=fitStudyShadow(light,whole),near=fitStudyShadow(light,detail,whole);assert(near.worldUnitsPerTexel<full.worldUnitsPerTexel/5);assert.equal(light.shadow.mapSize.x,4096);
  assert(light.position.clone().sub(light.target.position).normalize().distanceTo(original)<1e-12);
  light.shadow.updateMatrices(light);
  for(const x of [detail.min.x,detail.max.x])for(const y of [detail.min.y,detail.max.y])for(const z of [detail.min.z,detail.max.z]){const p=new THREE.Vector3(x,y,z).project(light.shadow.camera);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1);}
  for(const x of [whole.min.x,whole.max.x])for(const y of [whole.min.y,whole.max.y])for(const z of [whole.min.z,whole.max.z])assert(Math.abs(new THREE.Vector3(x,y,z).project(light.shadow.camera).z)<1);
});

test('negative world coordinates and a small carving retain nonzero depth and a physical shadow offset',()=>{
  const light=new THREE.DirectionalLight();light.position.set(2,3,1);light.shadow.mapSize.set(4096,4096);
  const box=new THREE.Box3(new THREE.Vector3(-80,3,-30),new THREE.Vector3(-79.8,3.6,-29.7)),result=fitStudyShadow(light,box);
  assert(result.worldUnitsPerTexel>0);assert(result.bounds[5]>result.bounds[4]);assert(result.normalBias<.002);assert(Number.isFinite(result.bias));
});
