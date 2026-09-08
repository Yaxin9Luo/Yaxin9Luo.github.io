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
