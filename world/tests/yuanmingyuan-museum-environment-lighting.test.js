import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {EnvironmentClock} from '../src/environment-time.js';

// Exercise the real sky/light update path on CPU; only HDR decoding and GPU
// PMREM generation are fixtures. Native comparisons verify actual rendering.
const environmentURL=new URL('../src/yuanmingyuan/garden-environment.js',import.meta.url).href;
const threeURL=import.meta.resolve('three');
const clockURL=import.meta.resolve('../src/environment-time.js');
const encoded=source=>'data:text/javascript,'+encodeURIComponent(source);
const gpuFixture=encoded(`export * from '${threeURL}';import {Texture} from '${threeURL}';export class PMREMGenerator{fromEquirectangular(){return {texture:new Texture(),dispose(){this.texture.dispose();}};}dispose(){}}`);
const hdrFixture=encoded(`import {DataTexture} from '${threeURL}';export class HDRLoader{createDataTexture(){return new DataTexture(new Uint8Array(16),2,2);}}`);
const hooks=registerHooks({resolve(specifier,context,next){
  if(context.parentURL===environmentURL){
    if(specifier==='three')return {url:gpuFixture,shortCircuit:true};
    if(specifier==='three/addons/loaders/HDRLoader.js')return {url:hdrFixture,shortCircuit:true};
    if(specifier==='../environment-time.js')return {url:clockURL,shortCircuit:true};
  }
  return next(specifier,context);
}});
const {createGardenEnvironment}=await import(environmentURL);
hooks.deregister();
const directionNames=['sunDirection','moonDirection','lightDirection'];
const otherFields=sample=>Object.fromEntries(Object.entries(sample).filter(([key])=>!directionNames.includes(key)));
const close=(a,b)=>assert(a.distanceTo(b)<1e-12,`${a.toArray()} != ${b.toArray()}`);
const originalFetch=globalThis.fetch;
async function create(options={}){
  const scene=new THREE.Scene(),renderer={toneMappingExposure:0};
  globalThis.fetch=async url=>{assert.equal(url,'/textures/environment/sky.hdr');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(16)};};
  try{return {environment:await createGardenEnvironment({scene,renderer,...options}),scene,renderer};}
  finally{globalThis.fetch=originalFetch;}
}
function inspect(view,mode){
  const {environment,scene,renderer}=view;environment.clock.setMode(mode,true);
  const focus=new THREE.Vector3(395,12,-582),sample=environment.update(0,{paused:true,focus,shadowSpan:85});
  const key=environment.group.children.find(object=>object.isDirectionalLight&&object.castShadow);
  const sky=environment.group.children.find(object=>object.isMesh);
  close(key.position.clone().sub(key.target.position).normalize(),sample.lightDirection);
  close(sky.material.uniforms.sunDirection.value,sample.sunDirection);
  close(sky.material.uniforms.moonDirection.value,sample.moonDirection);
  assert.equal(key.intensity,sample.keyIntensity);assert.equal(renderer.toneMappingExposure,1.05);
  assert.equal(scene.environmentIntensity,.30-.12*sample.night);
  assert.deepEqual(key.shadow.mapSize.toArray(),[4096,4096]);assert.equal(key.shadow.bias,-.00004);
  assert.equal(key.shadow.normalBias,.035);assert.equal(key.shadow.camera.left,-85);
  return sample;
}

test('default museum uses the unchanged shared day clock and actual sky/key settings',async()=>{
  const view=await create();
  try{
    const sample=inspect(view,'day'),original=new EnvironmentClock('day').update(0);
    for(const name of directionNames)close(sample[name],original[name]);
    assert.deepEqual(otherFields(sample),otherFields(original));
  }finally{view.environment.dispose();assert.equal(view.scene.children.length,0);assert.equal(view.scene.environment,null);}
});
test('opted-in museum day and night drive sky, key and returned water sample together',async()=>{
  const baseline=await create(),candidate=await create({lightYaw:-120});
  try{
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-120*Math.PI/180);
    for(const mode of ['day','night']){
      const old=inspect(baseline,mode),current=inspect(candidate,mode);
      assert.deepEqual(otherFields(current),otherFields(old));
      for(const name of directionNames)close(current[name],old[name].clone().applyQuaternion(q));
      assert.equal(candidate.environment.sample,current);
    }
  }finally{baseline.environment.dispose();candidate.environment.dispose();}
});
test('non-finite scene yaw rejects before sky, light or HDR resources are created',async()=>{
  const scene=new THREE.Scene();await assert.rejects(createGardenEnvironment({scene,renderer:{},lightYaw:NaN}),TypeError);
  assert.equal(scene.children.length,0);
});
