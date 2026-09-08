import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWandIllumination,ILLUMINATION} from '../src/illumination.js';

test('persistent illumination uses one bounded real light and reuses it across toggles',()=>{
  const effect=createWandIllumination(),light=effect.light,tip=new THREE.Vector3(4,8,-2);
  assert.ok(light instanceof THREE.PointLight);assert.equal(light.castShadow,false);assert.equal(light.distance,14);
  assert.equal(effect.group.children.filter(child=>child.isLight).length,1);
  for(let i=0;i<100;i++){effect.setEnabled(true,{immediate:true});effect.setEnabled(false,{immediate:true});}
  assert.equal(effect.light,light);assert.equal(effect.group.visible,false);assert.equal(light.intensity,0);
  effect.setEnabled(true);effect.update(ILLUMINATION.fadeSeconds/2,tip);
  assert.equal(light.intensity,ILLUMINATION.intensity/2);assert.equal(effect.group.visible,true);assert.deepEqual(effect.group.position.toArray(),tip.toArray());
  effect.update(ILLUMINATION.fadeSeconds/2,tip);assert.equal(light.intensity,ILLUMINATION.intensity);
  effect.setEnabled(false);effect.update(ILLUMINATION.fadeSeconds,tip);assert.equal(light.intensity,0);
  assert.equal(effect.group.visible,true,'the zero-intensity light slot avoids a new shader variant on each toggle');assert.equal(effect.group.children.find(child=>child.isMesh).visible,false);effect.dispose();
});

test('the real emitter follows a posed wand tip, freezes fades while paused and keeps intent while hidden',()=>{
  const scene=new THREE.Scene(),wand=new THREE.Object3D(),effect=createWandIllumination(),worldTip=new THREE.Vector3();
  scene.add(wand,effect.group);wand.position.set(3,2,9);wand.rotation.y=.7;
  const tip=new THREE.Object3D();tip.position.set(.4,1.1,-2);wand.add(tip);tip.getWorldPosition(worldTip);
  effect.setEnabled(true);effect.update(.1,worldTip);const intensity=effect.light.intensity;
  effect.update(10,worldTip,{paused:true});assert.equal(effect.light.intensity,intensity);
  effect.update(0,worldTip,{paused:true,visible:false});assert.equal(effect.light.intensity,0);assert.equal(effect.getState().enabled,true);
  wand.position.set(-2,40,3);tip.getWorldPosition(worldTip);effect.update(0,worldTip,{reducedMotion:true});
  assert.deepEqual(effect.group.getWorldPosition(new THREE.Vector3()).toArray(),worldTip.toArray());assert.equal(effect.light.intensity,ILLUMINATION.intensity);
  effect.setEnabled(false);effect.update(0,worldTip,{reducedMotion:true});assert.equal(effect.light.intensity,0);effect.dispose();
});

test('illumination disposes its own resources once and never emits from an invalid anchor',()=>{
  const scene=new THREE.Scene(),effect=createWandIllumination();scene.add(effect.group);
  let geometryDisposed=0,materialDisposed=0;const mesh=effect.group.children.find(child=>child.isMesh);
  mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);mesh.material.addEventListener('dispose',()=>materialDisposed++);
  effect.setEnabled(true,{immediate:true});effect.update(0,{x:NaN,y:0,z:0});assert.equal(effect.light.intensity,0);
  effect.dispose();effect.dispose();assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(effect.group.parent,null);
  assert.equal(effect.setEnabled(true),false);assert.deepEqual(effect.getState(),{enabled:false,available:false,intensity:0});
});
