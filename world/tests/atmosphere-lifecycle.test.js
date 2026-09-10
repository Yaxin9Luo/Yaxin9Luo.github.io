import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAtmosphere,loadAtmosphereAssets} from '../src/atmosphere.js';

const resources=root=>{
  const geometry=new Set(),material=new Set(),instances=[];
  root.traverse(object=>{if(object.geometry)geometry.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>material.add(m));if(object.isInstancedMesh)instances.push(object);});
  return{geometry,material,instances};
};
const disposals=objects=>{const counts=new Map();for(const object of objects){counts.set(object,0);object.addEventListener('dispose',()=>counts.set(object,counts.get(object)+1));}return counts;};

test('instance and morph resources release once while the scene remains the single geometry/material owner',()=>{
  const scene=new THREE.Scene(),atmosphere=createAtmosphere(scene,{heightAt:()=>7,lanternCount:3,fireflyCount:3,birdCount:3});
  atmosphere.update(99,.2,false,{started:true});const r=resources(atmosphere.root),morphs=r.instances.map(i=>i.morphTexture).filter(Boolean);
  assert.ok(morphs.length>0,'actual instanced bird poses own morph textures');
  const counts=disposals([...r.geometry,...r.material,...r.instances,...morphs]);
  atmosphere.releaseResources();atmosphere.releaseResources();
  for(const object of [...r.instances,...morphs])assert.equal(counts.get(object),1);
  for(const object of [...r.geometry,...r.material])assert.equal(counts.get(object),0,'the release hook must not race generic scene disposal');
  r.geometry.forEach(g=>g.dispose());r.material.forEach(m=>m.dispose());
  for(const count of counts.values())assert.equal(count,1);
});

test('standalone disposal finds owned nested shader textures and keeps shared assets valid',()=>{
  const scene=new THREE.Scene(),atmosphere=createAtmosphere(scene,{lanternCount:0,fireflyCount:0,birdCount:0});
  const sky=atmosphere.root.getObjectByName('Authored day and night cloud sky'),owned=new THREE.Texture(),shared=new THREE.Texture();shared.userData.sharedAsset=true;
  sky.material.uniforms.testOwned={value:[{texture:owned},owned]};sky.material.uniforms.testShared={value:shared};
  const r=resources(atmosphere.root),counts=disposals([...r.geometry,...r.material,...r.instances,owned,shared]);
  atmosphere.dispose();atmosphere.dispose();
  for(const [object,count]of counts)assert.equal(count,object===shared?0:1);
  assert.equal(atmosphere.root.parent,null);shared.dispose();
});

test('late real texture decoding binds only living atmospheres and a disposed world does not destroy the shared cache',async t=>{
  const previous=Object.fromEntries(['document','fetch','createImageBitmap'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const gates=[];let imageCloses=0;
  for(const [key,value]of Object.entries({document:{},fetch:async()=>new Response(new Uint8Array([1,2,3])),createImageBitmap:()=>new Promise(resolve=>gates.push(()=>resolve({width:2,height:2,close(){imageCloses++;}})))}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  t.after(()=>{for(const [key,descriptor]of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  const dead=createAtmosphere(new THREE.Scene(),{lanternCount:0,fireflyCount:0,birdCount:0}),live=createAtmosphere(new THREE.Scene(),{lanternCount:0,fireflyCount:0,birdCount:0});
  const deadSky=dead.root.getObjectByName('Authored day and night cloud sky').material.uniforms,liveSky=live.root.getObjectByName('Authored day and night cloud sky').material.uniforms;
  const pending=loadAtmosphereAssets();
  for(let i=0;i<20&&gates.length<3;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(gates.length,3);dead.dispose();gates.forEach(resolve=>resolve());assert.equal(await pending,true);
  assert.equal(deadSky.skyMap.value,null);assert.equal(deadSky.hasMap.value,0);assert.ok(liveSky.skyMap.value?.isTexture);assert.equal(liveSky.hasMap.value,1);
  const shared=liveSky.skyMap.value,count=disposals([shared]);live.dispose();assert.equal(count.get(shared),0);assert.equal(imageCloses,0);
  const next=createAtmosphere(new THREE.Scene(),{lanternCount:0,fireflyCount:0,birdCount:0});assert.equal(next.root.getObjectByName('Authored day and night cloud sky').material.uniforms.skyMap.value,shared);next.dispose();assert.equal(count.get(shared),0);
});
