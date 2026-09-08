import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAtmosphere} from '../src/atmosphere.js';

test('the sky keeps its angular horizon at the active main or reflected camera',()=>{
  const scene=new THREE.Scene(),atmosphere=createAtmosphere(scene,{lanternCount:0,fireflyCount:0});
  const sky=atmosphere.root.getObjectByName('Authored day and night cloud sky'),camera=new THREE.PerspectiveCamera();
  atmosphere.root.position.set(6,12,-8);scene.updateMatrixWorld(true);
  for(const point of [[140,175,195],[140,-205,195],[-91,9,66]]){
    camera.position.fromArray(point);camera.updateMatrixWorld(true);sky.onBeforeRender(null,scene,camera);
    assert.ok(sky.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position)<1e-8,'camera height must not move the cloud horizon above the water horizon');
  }
  const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
});

test('celestial transparencies draw behind mountain mattes while retaining terrain depth tests',async()=>{
  const {createMineralHighlands}=await import('../src/mineral-highlands.js');
  const {sampleEnvironment,TIME_PHASES}=await import('../src/environment-time.js');
  const scene=new THREE.Scene(),atmosphere=createAtmosphere(scene,{lanternCount:0,fireflyCount:0});
  const mountains=createMineralHighlands(scene),firstMountain=Math.min(...mountains.group.children.map(object=>object.renderOrder));
  for(const name of ['LROC detailed full moon','Moving sun','Soft lunar corona','Soft sunlight','Sparse silver stars']){
    const object=atmosphere.root.getObjectByName(name);assert.ok(object.renderOrder<firstMountain,`${name} must not paint over a solid mountain`);assert.equal(object.material.transparent,true,'celestial objects must share the transparent ordering pipeline');assert.equal(object.material.depthTest,true);assert.equal(object.material.depthWrite,false);
  }
  const dusk=sampleEnvironment(TIME_PHASES.dusk);atmosphere.setEnvironment(dusk);
  const sky=atmosphere.root.getObjectByName('Authored day and night cloud sky');
  assert.ok(sky.material.uniforms.waterTint.value.equals(dusk.water),'low sky air follows the live water palette');
  const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
});
