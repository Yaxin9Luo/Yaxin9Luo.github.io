import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import * as THREE from 'three';
import {loadShrubTexture} from '../src/herbarium-community.js';
import {createShrubTextureDecoder} from '../src/herbarium-texture-loader.js';
import {createResourceLoader} from '../src/resource-loader.js';
import {HerbariumWorker} from './helpers/herbarium-worker.js';

const root=new URL('../public/models/herbarium/didelta-spinosa/',import.meta.url),workerURL=new URL('../src/herbarium-texture-worker.js',import.meta.url);
const bytes=async name=>{const b=await readFile(new URL('textures/didelta_spinosa_'+name,root));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const hash=data=>createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
const workerDecoder=workers=>createShrubTextureDecoder({createWorker:()=>{const w=new HerbariumWorker(workerURL);workers.push(w);return w;}});

test('actual scalar uploads equal all 134217728 original G/R samples and never expand a runtime bitmap',async()=>{
  const previous={fetch:globalThis.fetch,Worker:globalThis.Worker,createImageBitmap:globalThis.createImageBitmap},requests=[];
  globalThis.Worker=HerbariumWorker;globalThis.createImageBitmap=()=>{throw new Error('Scalar uploads must not expand RGBA bitmaps');};
  globalThis.fetch=async url=>{requests.push(url);return new Response(await readFile(new URL('../public'+url,import.meta.url)));};
  try{
    const provenance=JSON.parse(await readFile(new URL('scalar-source.json',root),'utf8'));
    for(const [key,name,channel]of [['alphaMap','alpha',1],['translucencyMap','translucency',0]]){
      const texture=await loadShrubTexture(key,{deadline:performance.now()+120000}),version=texture.version;
      assert.equal(texture,await loadShrubTexture(key));assert.equal(texture.version,version,'cache reuse never reuploads');
      assert.equal(texture.format,THREE.RedFormat);assert.equal(texture.type,THREE.UnsignedByteType);assert.equal(texture.image.data.length,67108864);assert.equal(texture.magFilter,THREE.LinearFilter);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.generateMipmaps,true);assert.equal(texture.anisotropy,8);assert.equal(texture.flipY,false);assert.equal(texture.colorSpace,THREE.NoColorSpace);
      const original=await readFile(new URL(`textures/didelta_spinosa_${name}_8k.png`,root)),{data,info}=await sharp(original).raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,8192);assert.equal(info.height,8192);let mismatches=0;
      for(let i=0;i<texture.image.data.length;i++)if(texture.image.data[i]!==data[i*info.channels+channel])mismatches++;
      assert.equal(mismatches,0,`every original ${name} sample must survive packing, worker transfer and texture construction`);
      const record=provenance.files.find(f=>f.sourceChannel===(channel===1?'G':'R'));assert.equal(hash(texture.image.data),record.decodedSha256);assert.equal(hash(original),record.originalSha256);
      console.log(`${name}: all ${texture.image.data.length} samples equal; SHA256 ${hash(texture.image.data)}`);
    }
    assert.equal(requests.length,2);assert.ok(requests.every(url=>url.endsWith('.r8.zlib')));
  }finally{Object.assign(globalThis,previous);}
});

test('worker EXR results preserve every HALF bit and row against the independent complete R1 decode',async()=>{
  for(const [key,file,expectedBytes,format]of [['normalMap','nor_gl',536870912,THREE.RGBAFormat],['roughnessMap','rough',134217728,THREE.RedFormat]]){
    const {stdout}=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('./helpers/herbarium-half-reference.mjs',import.meta.url)),key],{maxBuffer:2048});
    const reference=JSON.parse(stdout),workers=[],decode=workerDecoder(workers),input=await bytes(`${file}_8k.exr`),result=await decode(input,{key});
    assert.equal(input.byteLength,0,'compressed input transfers, without a second retained copy');assert.equal(result.data.byteLength,expectedBytes);assert.ok(result.data instanceof Uint16Array);assert.equal(result.type,THREE.HalfFloatType);assert.equal(result.format,format);assert.equal(hash(result.data),reference.sha256);assert.ok(workers.every(w=>w.terminated));
    console.log(`${key}: all ${expectedBytes} HALF bytes equal; SHA256 ${reference.sha256}`);
  }
});

test('queued cancellation preserves its input, active cancellation terminates DWAA, and the next real decode succeeds',async()=>{
  const workers=[],decode=workerDecoder(workers),activeAbort=new AbortController(),queuedAbort=new AbortController(),input=await bytes('nor_gl_8k.exr'),queued=await bytes('alpha_8k.r8.zlib');
  const active=decode(input,{key:'normalMap',signal:activeAbort.signal}),activeRejected=assert.rejects(active,{name:'AbortError'});
  const waiting=decode(queued,{key:'alphaMap',signal:queuedAbort.signal}),queuedRejected=assert.rejects(waiting,{name:'AbortError'});
  queuedAbort.abort();await queuedRejected;assert.ok(queued.byteLength>0,'never transfer a cancelled queued source');assert.equal(workers.length,1);
  await workers[0].started;activeAbort.abort();await activeRejected;assert.equal(input.byteLength,0);assert.equal(workers[0].terminated,true);
  const retry=await decode(queued,{key:'alphaMap'});assert.equal(retry.data.length,67108864);assert.equal(workers.length,2);assert.ok(workers.every(w=>w.terminated));
});

test('one cancelled resource consumer cannot cancel another or poison its shared successful cache',async()=>{
  const workers=[],source=await bytes('alpha_8k.r8.zlib');let requests=0,parses=0,created;
  const workerCreated=new Promise(resolve=>{created=resolve;}),loadDecode=createShrubTextureDecoder({createWorker:()=>{const w=new HerbariumWorker(workerURL);workers.push(w);created(w);return w;}});
  const loader=createResourceLoader({fetchImpl:async()=>{requests++;return new Response(source.slice(0));}}),controller=new AbortController(),resource={id:'shared-alpha',url:'/full-alpha'},options={deadline:performance.now()+120000,parse:(buffer,{signal})=>{parses++;return loadDecode(buffer,{key:'alphaMap',signal});}};
  const first=loader.load(resource,{...options,signal:controller.signal}),rejected=assert.rejects(first,error=>error.type==='cancelled'),second=loader.load(resource,options);
  const worker=await workerCreated;await worker.started;controller.abort();await rejected;const result=await second;
  assert.equal(result.data.length,67108864);assert.equal(await loader.load(resource,options),result);assert.equal(requests,1);assert.equal(parses,1);assert.equal(workers.length,1);assert.equal(worker.terminated,true);
});

test('bad source data fails without fallback and retry uses a fresh worker',async()=>{
  const workers=[],decode=workerDecoder(workers);
  await assert.rejects(decode(new ArrayBuffer(8),{key:'normalMap'}));assert.equal(workers[0].terminated,true);
  const result=await decode(await bytes('translucency_8k.r8.zlib'),{key:'translucencyMap'});assert.equal(result.data.length,67108864);assert.equal(workers.length,2);assert.equal(workers[1].terminated,true);
});

test('actual texture loader cancels its last consumer, releases that worker, and retries into one cached map',async()=>{
  const previous={fetch:globalThis.fetch,Worker:globalThis.Worker},workers=[];let requests=0,created;
  const workerCreated=new Promise(resolve=>{created=resolve;});
  globalThis.Worker=class extends HerbariumWorker{constructor(url){super(url);workers.push(this);created(this);}};
  globalThis.fetch=async url=>{requests++;return new Response(await readFile(new URL('../public'+url,import.meta.url)));};
  try{
    const controller=new AbortController(),pending=loadShrubTexture('roughnessMap',{signal:controller.signal,deadline:performance.now()+120000}),rejected=assert.rejects(pending,error=>error.type==='cancelled');
    const worker=await workerCreated;await worker.started;controller.abort();await rejected;
    const texture=await loadShrubTexture('roughnessMap',{deadline:performance.now()+120000}),version=texture.version;
    assert.equal(texture.type,THREE.HalfFloatType);assert.equal(texture.image.data.byteLength,134217728);assert.equal(await loadShrubTexture('roughnessMap'),texture);assert.equal(texture.version,version);
    assert.equal(requests,2);assert.equal(workers.length,2);assert.ok(workers.every(w=>w.terminated));
  }finally{Object.assign(globalThis,previous);}
});

test('late transferred replies cannot settle an aborted job or interfere with the following job',async()=>{
  const workers=[];
  class ControlledWorker{
    constructor(){this.listeners=new Map();workers.push(this);}
    addEventListener(name,fn){this.listeners.set(name,fn);if(name==='message')this.reply=fn;}
    removeEventListener(name){this.listeners.delete(name);}
    postMessage(data,transfer){structuredClone(data,{transfer});}
    terminate(){this.terminated=true;}
  }
  const decode=createShrubTextureDecoder({createWorker:()=>new ControlledWorker()}),controller=new AbortController(),first=decode(new ArrayBuffer(8),{key:'alphaMap',signal:controller.signal}),rejected=assert.rejects(first,{name:'AbortError'});
  controller.abort();await rejected;let settled=false;const next=decode(new ArrayBuffer(8),{key:'alphaMap'});next.then(()=>{settled=true;});
  const result={width:8192,height:8192,format:THREE.RedFormat,type:THREE.UnsignedByteType,data:new Uint8Array(67108864)};
  workers[0].reply({data:{result}});await Promise.resolve();assert.equal(settled,false);assert.equal(workers[0].listeners.size,0);
  workers[1].reply({data:{result}});assert.equal(await next,result);assert.ok(workers.every(w=>w.terminated));
});
