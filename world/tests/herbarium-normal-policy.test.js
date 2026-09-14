import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {selectShrubNormalEncoding,canRestoreShrubNormal,shrubNormalCapabilities,shrubNormalDescriptor,createShrubEncodingGate,validateShrubHDRResult} from '../src/herbarium-normal-policy.js';
import {createShrubTextureDecoder} from '../src/herbarium-texture-loader.js';

const renderer=(profiles=null,maxTextureSize=16384)=>({extensions:{has:name=>{assert.equal(name,'WEBGL_compressed_texture_astc');return profiles!==null;},get:name=>{assert.equal(name,'WEBGL_compressed_texture_astc');assert.notEqual(profiles,null,'unsupported extension must not use warning-producing get');return {getSupportedProfiles:()=>profiles};}},capabilities:{maxTextureSize}});
const accepted={url:'/models/herbarium/didelta-spinosa/test-only.ktx2',bytes:890,sha256:'a'.repeat(64),sourceSHA256:'67d8f96aba14560667ff6ad7058fb75b8f452a0dfd4792dff2f0961d8c632261',recipeURL:'/models/herbarium/didelta-spinosa/test-only-recipe.json',recipeSHA256:'b'.repeat(64),acceptanceURL:'/models/herbarium/didelta-spinosa/test-only-acceptance.json',acceptanceSHA256:'c'.repeat(64)};
const tiny=()=>({width:16,height:16,format:THREE.RGBA_ASTC_4x4_Format,type:THREE.HalfFloatType,mipmaps:Array.from({length:5},(_,i)=>{const w=Math.max(1,16>>i);return {width:w,height:w,data:new Uint8Array(Math.ceil(w/4)**2*16)};})});

test('actual HDR profile and full texture extent select encoding; no extension or LDR retains EXR',()=>{
  for(const profiles of [null,[],['ldr']])assert.equal(selectShrubNormalEncoding(renderer(profiles)).encoding,'exr');
  assert.equal(selectShrubNormalEncoding(renderer(['ldr','hdr'])).encoding,'astc-hdr');
  assert.equal(selectShrubNormalEncoding(renderer(['hdr'],4096)).encoding,'exr');
  assert.equal(canRestoreShrubNormal(renderer(['ldr']),'astc-hdr'),false);
  assert.equal(canRestoreShrubNormal(renderer(['hdr']),'astc-hdr'),true);
  assert.equal(canRestoreShrubNormal(renderer(null),'exr'),true);
  assert.equal(canRestoreShrubNormal(renderer(['hdr'],4096),'exr'),false,'no lower-resolution replacement');
});

test('unresolved or malformed derivative cannot become a successful HDR source; EXR descriptor stays exact',()=>{
  assert.deepEqual(shrubNormalDescriptor('exr'),{id:'herbarium-didelta-normalMap',url:'/models/herbarium/didelta-spinosa/textures/didelta_spinosa_nor_gl_8k.exr',phase:2,sourceSHA256:accepted.sourceSHA256});
  assert.throws(()=>shrubNormalDescriptor('astc-hdr',null),/unresolved/,'unresolved inputs are never accepted');
  const descriptor=shrubNormalDescriptor('astc-hdr',accepted);assert.ok(descriptor.id.endsWith(accepted.sha256));assert.equal(descriptor.url,accepted.url);
  for(const delta of [{url:'https://external.test/map.ktx2'},{url:'/models/herbarium/didelta-spinosa/../map.ktx2'},{sourceSHA256:'d'.repeat(64)},{acceptanceSHA256:null},{recipeURL:null},{bytes:0}])assert.throws(()=>shrubNormalDescriptor('astc-hdr',{...accepted,...delta}),/unresolved/);
});

test('same-encoding pending leases cancel independently and bound encoding cannot silently change',()=>{
  const gate=createShrubEncodingGate(),a=new AbortController(),b=new AbortController(),first=gate.acquire('astc-hdr',{signal:a.signal}),second=gate.acquire('astc-hdr',{signal:b.signal});
  assert.equal(gate.snapshot().pendingConsumers,2);assert.throws(()=>gate.acquire('exr'),/cannot bind or load/);
  a.abort();assert.equal(gate.snapshot().pendingConsumers,1);assert.throws(()=>gate.acquire('exr'),/cannot bind or load/);
  gate.commit('astc-hdr');second.release();first.release();assert.equal(gate.snapshot().status,'bound');assert.throws(()=>gate.acquire('exr'),/Reload/);
  const already=new AbortController();already.abort();assert.throws(()=>gate.acquire('astc-hdr',{signal:already.signal}),/cancelled/);assert.equal(gate.snapshot().pendingConsumers,0);
});

test('all-aborted or failed unbound attempts release selection for a later clean retry',()=>{
  const gate=createShrubEncodingGate(),a=new AbortController();gate.acquire('astc-hdr',{signal:a.signal});a.abort();assert.equal(gate.snapshot().status,'unselected');
  const retry=gate.acquire('exr');retry.release();assert.equal(gate.snapshot().status,'unselected');const last=gate.acquire('astc-hdr');gate.commit('astc-hdr');last.release();assert.equal(gate.snapshot().encoding,'astc-hdr');
});

test('transferred HDR block contract rejects missing levels, wrong type/shape and aliased or oversized buffers',()=>{
  const contract={width:16,height:16,levels:5},result=tiny();assert.equal(validateShrubHDRResult(result,contract),result);
  const moved=structuredClone(result,{transfer:result.mipmaps.map(m=>m.data.buffer)});assert.equal(validateShrubHDRResult(moved,contract),moved);assert.throws(()=>validateShrubHDRResult(result,contract));
  const mutate=[r=>r.mipmaps.pop(),r=>r.type=THREE.FloatType,r=>r.format=THREE.RGBAFormat,r=>r.width=8,r=>r.data=new Uint16Array(1),r=>r.mipmaps[0].data=new Uint16Array(128),r=>r.mipmaps[3].data=r.mipmaps[2].data,r=>r.mipmaps[0].data=new Uint8Array(new ArrayBuffer(260),0,256),r=>r.mipmaps[4].width=2];
  for(const edit of mutate){const r=tiny();edit(r);assert.throws(()=>validateShrubHDRResult(r,contract));}
  assert.throws(()=>validateShrubHDRResult(tiny()),/full-resolution/,'runtime always requires 8192 and 14 levels');
});

test('queued HDR cancellation does not transfer its input; active abort discards late replies before retry',async()=>{
  const workers=[];
  class FakeWorker{
    constructor(){this.listeners=new Map();workers.push(this);}
    addEventListener(name,fn){this.listeners.set(name,fn);if(name==='message')this.reply=fn;}
    removeEventListener(name){this.listeners.delete(name);}
    postMessage(data,transfer){this.message=structuredClone(data,{transfer});}
    terminate(){this.terminated=true;}
  }
  const decode=createShrubTextureDecoder({createWorker:()=>new FakeWorker()}),a=new AbortController(),b=new AbortController(),input=new ArrayBuffer(8),queued=new ArrayBuffer(8);
  const first=decode(input,{key:'normalMap',normalEncoding:'astc-hdr',signal:a.signal}),firstRejected=assert.rejects(first,{name:'AbortError'});
  const second=decode(queued,{key:'normalMap',normalEncoding:'astc-hdr',signal:b.signal}),secondRejected=assert.rejects(second,{name:'AbortError'});
  b.abort();await secondRejected;assert.equal(queued.byteLength,8);assert.equal(workers.length,1);assert.equal(workers[0].message.normalEncoding,'astc-hdr');assert.equal(input.byteLength,0);
  a.abort();await firstRejected;assert.equal(workers[0].terminated,true);
  const retry=decode(queued,{key:'normalMap',normalEncoding:'astc-hdr'}),bad=assert.rejects(retry,/Invalid full-resolution/);workers[0].reply({data:{error:'late former reply'}});workers[1].reply({data:{result:tiny()}});await bad;assert.equal(workers[1].terminated,true);
});

test('actual Game restore guards selected and preloaded HDR while retaining supported legacy EXR',async()=>{
  const source=await readFile(new URL('../src/game.js',import.meta.url),'utf8'),body=source.match(/this\._listen\(this\.canvas, 'webglcontextrestored', \(\) => \{([\s\S]+?)\n    \}\);/)[1];
  const restore=new Function('canRestoreShrubNormal','shrubNormalCapabilities','getShrubNormalSourceState',body);
  const snapshot=new Function('getShrubNormalSourceState','shrubNormalCapabilities',source.match(/  herbariumNormalSnapshot\(\)\{(.+)\}\n/)[1]);
  for(const encoding of ['exr','astc-hdr'])for(const origin of ['selection','bound','pending'])for(const hdr of [false,true]){
    const messages=[],game={renderer:renderer(hdr?['hdr']:null),_herbariumNormalSelection:origin==='selection'?{encoding}:undefined,_contextLost:true,_lastFrame:10,_suspended:false,_enhancementController:new AbortController(),audio:{setSuspended(value){this.suspended=value;}},_updateCompanions(){},requestRender(){this.requested=true;},_message(...text){messages.push(text);}};game.renderer.shadowMap={};
    const getSource=()=>({encoding,status:origin==='pending'?'pending':'bound'});
    restore.call(game,canRestoreShrubNormal,shrubNormalCapabilities,getSource);
    const supported=hdr||encoding==='exr';
    assert.equal(game._contextLost,!supported,`${origin} ${encoding}`);assert.equal(Boolean(game.requested),supported);assert.equal(game._enhancementController.signal.aborted,!supported);
    const evidence=snapshot.call(game,getSource,shrubNormalCapabilities);assert.equal(evidence.restoreEncoding,encoding);assert.equal(evidence.restoreEncodingOrigin,origin==='selection'?'game-selection':`${origin}-source`);
    if(supported){assert.equal(game._lastFrame,0);assert.equal(game.renderer.shadowMap.needsUpdate,true);}else{assert.equal(game.audio.suspended,true);assert.match(messages[0][0],/Reload/);}
  }
});
