import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadGLTF} from '../src/gltf-resource.js';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const bytes=(()=>{const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{}]})),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const out=Buffer.alloc(20+padded.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);return out;})();
function fixture(animated=false){
  const texture=new THREE.Texture({close(){}}),material=new THREE.MeshStandardMaterial({map:texture}),geometry=new THREE.BoxGeometry(),scene=new THREE.Group();scene.add(new THREE.Mesh(geometry,material));
  return {scene,scenes:[scene],cameras:[new THREE.PerspectiveCamera()],asset:{version:'2.0'},userData:{shore:{points:[1,2]}},animations:animated?[new THREE.AnimationClip('walk',1,[])]:[],parser:{cache:new Map(),binary:new ArrayBuffer(32)},extensionResult:{retained:true}};
}

test('static results drop only parser after real loader afterRoot plugins finish',async t=>{
  const original=GLTFLoader.prototype.parseAsync;let before,pluginsDone=false;
  t.mock.method(globalThis,'fetch',async()=>new Response(bytes));
  t.mock.method(GLTFLoader.prototype,'parseAsync',async function(...args){
    this.register(()=>({name:'ownership-proof',async afterRoot(gltf){await turn();gltf.userData.pluginComplete=true;pluginsDone=true;}}));
    const result=await original.apply(this,args);before={...result};return result;
  });
  const result=await loadGLTF('/residency-real-static.glb');
  assert.ok(pluginsDone&&result.userData.pluginComplete);assert.ok(before.parser);
  assert.equal(Object.hasOwn(result,'parser'),false);
  assert.deepEqual(Object.keys(result),Object.keys(before).filter(key=>key!=='parser'));
  for(const key of Object.keys(result))assert.equal(result[key],before[key],key);
});

test('static/animated envelopes preserve identities, shared assets and cached concurrent results',async t=>{
  let fetches=0,parses=0;const gate=deferred(),source=fixture(),before={...source};
  t.mock.method(globalThis,'fetch',async()=>{fetches++;return new Response(bytes);});
  t.mock.method(GLTFLoader.prototype,'parseAsync',async()=>{parses++;await gate.promise;return source;});
  const a=loadGLTF('/residency-shared.glb'),b=loadGLTF('/residency-shared.glb');gate.resolve();
  assert.equal(await a,source);assert.equal(await b,source);assert.equal(await loadGLTF('/residency-shared.glb'),source);assert.equal(fetches,1);assert.equal(parses,1);
  assert.equal(Object.hasOwn(source,'parser'),false);for(const key of Object.keys(before).filter(key=>key!=='parser'))assert.equal(source[key],before[key],key);
  const mesh=source.scene.children[0];for(const value of [mesh.geometry,mesh.material,mesh.material.map])assert.equal(value.userData.sharedAsset,true);
  const animated=fixture(true),animatedBefore={...animated};t.mock.method(GLTFLoader.prototype,'parseAsync',async()=>animated);
  assert.equal(await loadGLTF('/residency-animated.glb'),animated);assert.deepEqual(Object.keys(animated),Object.keys(animatedBefore));
  for(const key of Object.keys(animatedBefore))assert.equal(animated[key],animatedBefore[key],key);
});

test('cancelled borrower cannot poison another borrower or its completed cache',async t=>{
  const started=deferred(),gate=deferred(),controller=new AbortController(),source=fixture();let transport,parses=0;
  t.mock.method(globalThis,'fetch',async(url,{signal})=>{transport=signal;return new Response(bytes);});
  t.mock.method(GLTFLoader.prototype,'parseAsync',async()=>{parses++;started.resolve();await gate.promise;return source;});
  const a=loadGLTF('/residency-borrowers.glb',{signal:controller.signal}),b=loadGLTF('/residency-borrowers.glb');
  await started.promise;controller.abort();await assert.rejects(a,e=>e.type==='cancelled');assert.equal(transport.aborted,false);
  gate.resolve();assert.equal(await b,source);assert.equal(await loadGLTF('/residency-borrowers.glb'),source);assert.equal(parses,1);
});

test('last borrower cancellation disposes late static resources once without replacing a successful retry',async t=>{
  const started=deferred(),gate=deferred(),controller=new AbortController(),late=fixture(),fresh=fixture();let transport,parses=0;
  const mesh=late.scene.children[0],disposed={geometry:0,material:0,texture:0,bitmap:0};
  mesh.geometry.addEventListener('dispose',()=>disposed.geometry++);mesh.material.addEventListener('dispose',()=>disposed.material++);mesh.material.map.addEventListener('dispose',()=>disposed.texture++);mesh.material.map.image.close=()=>disposed.bitmap++;
  t.mock.method(globalThis,'fetch',async(url,{signal})=>{transport=signal;return new Response(bytes);});
  t.mock.method(GLTFLoader.prototype,'parseAsync',async()=>{if(++parses===1){started.resolve();await gate.promise;return late;}return fresh;});
  const pending=loadGLTF('/residency-late.glb',{signal:controller.signal});await started.promise;controller.abort();await assert.rejects(pending,e=>e.type==='cancelled');assert.equal(transport.aborted,true);
  assert.equal(await loadGLTF('/residency-late.glb'),fresh);gate.resolve();await turn();await turn();
  assert.deepEqual(disposed,{geometry:1,material:1,texture:1,bitmap:1});assert.equal(await loadGLTF('/residency-late.glb'),fresh);assert.equal(parses,2);
});

test('parse failure remains uncached and a manual retry preserves the complete scene',async t=>{
  let calls=0;const source=fixture();t.mock.method(globalThis,'fetch',async()=>new Response(bytes));
  t.mock.method(GLTFLoader.prototype,'parseAsync',async()=>{if(++calls===1)throw new Error('bad GLB');return source;});
  await assert.rejects(loadGLTF('/residency-retry.glb'),e=>e.type==='parse');assert.equal(calls,1);
  assert.equal(await loadGLTF('/residency-retry.glb'),source);assert.equal(calls,2);assert.equal(source.scene.children.length,1);
});
