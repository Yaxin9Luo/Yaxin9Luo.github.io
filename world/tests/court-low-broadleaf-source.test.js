import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {loadCourtLowBroadleafSource} from '../src/yuanmingyuan/court-low-broadleaf-source.js';
import {courtLowBroadleafSourceManifest as manifest} from '../src/yuanmingyuan/court-low-broadleaf-manifest.js';
import {createLowBroadleaf,decodeSprayGeometries} from '../src/yuanmingyuan/court-low-broadleaf-geometry.js';

const assetRoot=new URL('../public/models/yuanmingyuan/court-low-broadleaf-r1/',import.meta.url);
const proof=JSON.parse(fs.readFileSync(new URL('./fixtures/court-low-broadleaf-r1-geometry.json',import.meta.url)));
const buffers=new Map(Object.values(manifest.files).map(r=>[r.file,fs.readFileSync(new URL(r.file,assetRoot))]));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytesOf=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture({fetchTransform,decodeAt,width=4096,height=4096,closeThrowsAt=-1}={}){
  const calls=[],bitmaps=[],decodes=[];
  return {
    calls,bitmaps,decodes,
    fetcher:async(url,{signal})=>{
      const prefix='https://fixture.invalid/shrub/';
      assert.ok(url.startsWith(prefix));
      const file=url.slice(prefix.length),raw=buffers.get(file);
      assert.ok(raw,'Only the frozen six runtime files may be fetched: '+file);
      const record={url,file,signal};calls.push(record);
      const response={ok:true,status:200,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)};
      return fetchTransform?await fetchTransform({file,response,raw,record,index:calls.length-1}):response;
    },
    decode:async(blob,options)=>{
      const index=decodes.length;decodes.push({blob,options});
      assert.deepEqual(options,{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      const bitmap={width,height,closes:0,close(){this.closes++;if(index===closeThrowsAt)throw new Error('close failed '+index);}};
      bitmaps.push(bitmap);
      return decodeAt?await decodeAt({index,bitmap,blob}):bitmap;
    },
  };
}
const load=(f,options={})=>loadCourtLowBroadleafSource({baseUrl:'https://fixture.invalid/shrub/',fetcher:f.fetcher,decode:f.decode,...options});
async function tracking(fn){
  const maps={geometry:new Map(),material:new Map(),texture:new Map()},saved=[];
  for(const [kind,Type]of [['geometry',THREE.BufferGeometry],['material',THREE.Material],['texture',THREE.Texture]]){
    const original=Type.prototype.dispose;saved.push(()=>{Type.prototype.dispose=original;});
    Type.prototype.dispose=function(...args){const map=maps[kind];map.set(this,(map.get(this)??0)+1);return original.apply(this,args);};
  }
  try{return await fn(maps);}finally{for(const restore of saved)restore();}
}
function trackingSignal(){
  const controller=new AbortController(),listeners=new Set(),real=controller.signal;
  const signal={
    get aborted(){return real.aborted;},get reason(){return real.reason;},
    throwIfAborted(){real.throwIfAborted();},
    addEventListener(type,fn,options){if(type==='abort')listeners.add(fn);real.addEventListener(type,fn,options);},
    removeEventListener(type,fn){if(type==='abort')listeners.delete(fn);real.removeEventListener(type,fn);},
  };
  return {controller,signal,listeners};
}
function allOnce(maps){for(const map of Object.values(maps))assert.ok([...map.values()].every(n=>n===1));}

test('Self-hosted roster retains all original files, full 4K maps and source license',()=>{
  const publicManifest=JSON.parse(fs.readFileSync(new URL('source-manifest.json',assetRoot)));
  const original=JSON.parse(fs.readFileSync(new URL('source-package/manifest.json',assetRoot)));
  assert.equal(original.license,'CC0-1.0');assert.equal(original.closedDependencyRoster.length,6);
  for(const record of publicManifest.packageFiles){
    const bytes=fs.readFileSync(new URL(record.file,assetRoot));
    assert.equal(bytes.length,record.bytes);assert.equal(sha(bytes),record.sha256);
  }
  for(const record of original.closedDependencyRoster)assert.equal(sha(fs.readFileSync(new URL(record.file,assetRoot))),record.sha256);
  assert.deepEqual(publicManifest.files,manifest.files);
  assert.equal(Object.keys(manifest.files).length,6);
  for(const slot of ['map','normalMap','arm','alphaMap'])assert.deepEqual([manifest.files[slot].width,manifest.files[slot].height],[4096,4096]);
  assert.match(fs.readFileSync(new URL('LICENSE-SOURCE.txt',assetRoot),'utf8'),/Rico Cilliers/);
  assert.equal(manifest.nativeCompositionReviewed,false);
});

test('Successful load preserves every native-reviewed geometry byte and exact materials; one owner, explicit disposal',async()=>tracking(async counts=>{
  const f=fixture(),{controller,signal,listeners}=trackingSignal();
  const binding=await load(f,{signal}),{owner,part}=binding;
  assert.equal(listeners.size,0);
  assert.equal(binding.review,manifest.review);
  assert.equal(part,owner.part);assert.equal(part.parent,owner.group);assert.equal(owner.group.parent,null);
  assert.equal(part.userData.id,'low-broadleaf');
  for(const node of [part,owner.group]){
    assert.deepEqual(node.position.toArray(),[0,0,0]);assert.deepEqual(node.quaternion.toArray(),[0,0,0,1]);assert.deepEqual(node.scale.toArray(),[1,1,1]);
  }
  assert.deepEqual(f.calls.map(x=>x.file),Object.values(manifest.files).map(r=>r.file));
  assert.equal(f.decodes.length,4);
  assert.equal(part.children.length,3);
  for(let i=0;i<3;i++){
    const mesh=part.children[i],g=mesh.geometry,expected=proof.meshes[i];
    assert.ok(mesh.isMesh&&!mesh.isInstancedMesh);
    assert.equal(g.drawRange.start,0);assert.equal(g.drawRange.count,Infinity);
    for(const [name,record]of Object.entries(expected.attributes)){
      assert.equal(g.attributes[name].count,record.count);assert.equal(g.attributes[name].itemSize,record.itemSize);
      assert.equal(sha(bytesOf(g.attributes[name].array)),record.sha256,name+' is unchanged for mesh '+i);
    }
    assert.equal(g.index.count,expected.index.count);assert.equal(sha(bytesOf(g.index.array)),expected.index.sha256);
    assert.ok(mesh.castShadow&&mesh.receiveShadow&&mesh.frustumCulled);
  }
  assert.deepEqual(owner.diagnostics.bounds,manifest.bounds);
  assert.deepEqual(owner.diagnostics.root,manifest.root);
  assert.equal(owner.rootBand.length,1089);assert.equal(owner.diagnostics.windAmplitude,0);
  assert.equal(owner.diagnostics.triangles,1020245);assert.equal(owner.diagnostics.fullResolutionVerified,true);
  assert.equal(owner.diagnostics.nativeCompositionReviewed,false);
  const leaf=part.children[0].material,wood=part.children[1].material;
  assert.equal(leaf.alphaTest,.5);assert.equal(leaf.transparent,false);assert.equal(leaf.side,THREE.DoubleSide);
  assert.equal(leaf.roughness,1);assert.equal(leaf.metalness,0);assert.equal(leaf.vertexColors,true);
  assert.deepEqual(leaf.normalScale.toArray(),[1,1]);assert.equal(leaf.aoMap,null);assert.equal(leaf.bumpMap,null);
  assert.equal(wood,part.children[2].material);assert.equal(wood.roughness,.89);assert.equal(wood.map,null);
  assert.equal(leaf.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);
  for(const [i,slot]of ['map','normalMap','roughnessMap','alphaMap'].entries()){
    const texture=leaf[slot];assert.equal(texture.image,f.bitmaps[i]);assert.equal(texture.flipY,false);
    assert.equal(texture.wrapS,THREE.RepeatWrapping);assert.equal(texture.wrapT,THREE.RepeatWrapping);
    assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.magFilter,THREE.LinearFilter);
    assert.equal(texture.anisotropy,1);assert.equal(texture.generateMipmaps,true);
    assert.equal(texture.colorSpace,i===0?THREE.SRGBColorSpace:THREE.NoColorSpace);
  }
  // Borrowing creates placements, never a second parsed source or GPU asset.
  const borrowed=part.children.map(m=>new THREE.InstancedMesh(m.geometry,m.material,2));
  assert.equal(f.calls.length,6);
  for(let i=0;i<3;i++){assert.equal(borrowed[i].geometry,part.children[i].geometry);assert.equal(borrowed[i].material,part.children[i].material);borrowed[i].dispose();}
  const intermediateCount=counts.geometry.size;
  assert.ok(intermediateCount>100);
  controller.abort(new Error('Request ended after handoff'));
  assert.equal(owner.disposed,false);assert.ok(f.bitmaps.every(b=>b.closes===0));
  owner.dispose();owner.dispose();
  assert.equal(owner.disposed,true);assert.equal(owner.group.children.length,0);
  assert.equal(counts.geometry.size,intermediateCount+7);
  assert.equal(counts.material.size,2);assert.equal(counts.texture.size,4);
  assert.ok(f.bitmaps.every(b=>b.closes===1));allOnce(counts);
}));

test('Independent scene owners do not share disposable maps or geometry',async()=>{
  const a=fixture(),b=fixture(),one=await load(a),two=await load(b);
  try{
    for(let i=0;i<3;i++){
      assert.notEqual(one.part.children[i].geometry,two.part.children[i].geometry);
      assert.notEqual(one.part.children[i].material,two.part.children[i].material);
    }
    assert.notEqual(one.part.children[0].material.map,two.part.children[0].material.map);
    one.owner.dispose();
    assert.equal(two.owner.disposed,false);assert.ok(b.bitmaps.every(x=>x.closes===0));
    assert.equal(a.calls.length,6);assert.equal(b.calls.length,6);
  }finally{one.owner.dispose();two.owner.dispose();}
});

test('Already aborted or invalid inputs never start a transfer',async()=>{
  const f=fixture(),controller=new AbortController(),reason=new Error('pre-aborted');
  controller.abort(reason);await assert.rejects(load(f,{signal:controller.signal}),e=>e===reason);
  await assert.rejects(load(f,{baseUrl:'/missing-trailing-slash'}),/baseUrl/);
  assert.equal(f.calls.length,0);assert.equal(f.decodes.length,0);
});

test('Abort waits for a late fetch and starts no decoding',async()=>{
  const gate=deferred(),entered=deferred(),f=fixture({fetchTransform:async({response})=>{entered.resolve();await gate.promise;return response;}});
  const {controller,signal,listeners}=trackingSignal(),reason=new Error('cancel fetch');
  let settled=false;const pending=load(f,{signal});const handled=pending.catch(e=>{settled=true;throw e;});
  const assertion=assert.rejects(handled,e=>e===reason);
  await entered.promise;controller.abort(reason);await turn();
  assert.equal(settled,false);gate.resolve();await assertion;
  assert.equal(f.calls.length,1);assert.equal(f.decodes.length,0);assert.equal(listeners.size,0);
});

test('Abort during late second bitmap closes old and late resources before rejection',async()=>tracking(async counts=>{
  const gate=deferred(),entered=deferred(),f=fixture({decodeAt:async({index,bitmap})=>{if(index===1){entered.resolve();await gate.promise;}return bitmap;}});
  const {controller,signal,listeners}=trackingSignal(),reason=new Error('cancel bitmap');
  let settled=false;const pending=load(f,{signal}).catch(e=>{settled=true;throw e;});
  const assertion=assert.rejects(pending,e=>e===reason);
  await entered.promise;controller.abort(reason);await turn();
  assert.equal(settled,false);assert.equal(f.bitmaps[0].closes,1);assert.equal(f.bitmaps[1].closes,0);
  gate.resolve();await assertion;
  assert.equal(f.calls.length,4);assert.equal(f.decodes.length,2);
  assert.ok(f.bitmaps.every(x=>x.closes===1));assert.equal(counts.geometry.size,4);assert.equal(counts.texture.size,1);
  assert.equal(listeners.size,0);allOnce(counts);
}));

test('Hash mismatch is rejected before bitmap decode with all allocated source geometry released',async()=>tracking(async counts=>{
  const f=fixture({fetchTransform:async({file,response,raw})=>file.includes('_diff_')?{...response,arrayBuffer:async()=>{const bytes=Uint8Array.from(raw);bytes[0]^=1;return bytes.buffer;}}:response});
  await assert.rejects(load(f),/map SHA256 mismatch/);
  assert.equal(f.decodes.length,0);assert.equal(counts.geometry.size,4);allOnce(counts);
}));

test('Truncated geometry and failed HTTP are rejected before source construction',async()=>{
  const short=fixture({fetchTransform:async({file,response,raw})=>file.endsWith('.bin')?{...response,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength-4)}:response});
  await assert.rejects(load(short),/geometry byte length mismatch/);assert.equal(short.decodes.length,0);
  const http=fixture({fetchTransform:async()=>({ok:false,status:404})});
  await assert.rejects(load(http),/spec HTTP 404/);assert.equal(http.calls.length,1);
});

test('Decode failure releases earlier maps and removes the pending signal listener',async()=>tracking(async counts=>{
  const f=fixture({decodeAt:async({index,bitmap})=>{if(index===2){f.bitmaps.pop();throw new Error('image decoder failed');}return bitmap;}});
  const {signal,listeners}=trackingSignal();
  await assert.rejects(load(f,{signal}),/image decoder failed/);
  assert.ok(f.bitmaps.every(x=>x.closes===1));assert.equal(counts.texture.size,2);assert.equal(counts.geometry.size,4);
  assert.equal(listeners.size,0);allOnce(counts);
}));

test('A resized map is closed and rejected, without a fallback or lower-quality source',async()=>tracking(async counts=>{
  const f=fixture({width:2048});
  await assert.rejects(load(f),/original 4096x4096/);
  assert.equal(f.bitmaps.length,1);assert.equal(f.bitmaps[0].closes,1);assert.equal(counts.geometry.size,4);assert.equal(counts.texture.size,0);
  allOnce(counts);
}));

test('Cleanup errors never skip the remaining resources or replace the original abort cause',async()=>tracking(async counts=>{
  const gate=deferred(),entered=deferred(),f=fixture({closeThrowsAt:0,decodeAt:async({index,bitmap})=>{if(index===1){entered.resolve();await gate.promise;}return bitmap;}});
  const controller=new AbortController(),reason=new Error('cancel with failing close');
  const assertion=assert.rejects(load(f,{signal:controller.signal}),e=>e instanceof AggregateError&&e.cause===reason&&e.errors.includes(reason));
  await entered.promise;controller.abort(reason);gate.resolve();await assertion;
  assert.ok(f.bitmaps.every(x=>x.closes===1));assert.equal(counts.geometry.size,4);assert.equal(counts.texture.size,1);allOnce(counts);
}));

test('A dispose listener failure still releases every mesh/material/map/bitmap exactly once',async()=>tracking(async counts=>{
  const f=fixture(),{owner,part}=await load(f),before=counts.geometry.size;
  part.children[0].geometry.addEventListener('dispose',()=>{throw new Error('consumer dispose listener');});
  assert.throws(()=>owner.dispose(),AggregateError);assert.equal(owner.disposed,true);
  assert.throws(()=>owner.dispose(),AggregateError);
  assert.equal(counts.geometry.size,before+7);assert.equal(counts.material.size,2);assert.equal(counts.texture.size,4);
  assert.ok(f.bitmaps.every(x=>x.closes===1));allOnce(counts);
}));

test('Geometry-construction rollback releases partial materials, branches and prepared source',async()=>tracking(async counts=>{
  const spec=JSON.parse(buffers.get(manifest.files.spec.file)),raw=buffers.get(manifest.files.geometry.file);
  const geometries=decodeSprayGeometries(THREE,spec,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  let released=0,materials=0;
  const prepared={spec,geometries,fullResolutionVerified:false,dispose(){if(released++)return;for(const g of geometries)g.dispose();}};
  class RejectWoodMaterial extends THREE.MeshStandardMaterial{
    constructor(options){if(materials++===1)throw new Error('material creation failed');super(options);}
  }
  await assert.rejects(async()=>createLowBroadleaf({THREE:{...THREE,MeshStandardMaterial:RejectWoodMaterial},prepared,cpuOnly:true}),/material creation failed/);
  assert.equal(released,1);assert.equal(counts.material.size,1);assert.ok(counts.geometry.size>100);allOnce(counts);
}));
