import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {loadCourtSoilMaterial} from '../src/yuanmingyuan/court-soil-material-r1.js';

const slots=['map','normalMap','roughnessMap','aoMap'];
function fixture(){
  const payloads=slots.map((_,i)=>new Uint8Array([137,80,78,71,i,0,3,2]));
  const files=Object.fromEntries(slots.map((slot,i)=>[slot,{file:slot+'.png',bytes:payloads[i].length,sha256:createHash('sha256').update(payloads[i]).digest('hex'),width:4096,height:4096}]));
  const state={fetches:[],bitmaps:[]};
  const manifest={id:'soil-fixture',tileMetres:1.3,sourceURL:'https://polyhaven.com/a/brown_mud',license:'CC0-1.0',files};
  const fetcher=async url=>{const i=slots.findIndex(slot=>url.endsWith(slot+'.png'));state.fetches.push(url);return new Response(payloads[i]);};
  const bitmap=()=>{const value={width:4096,height:4096,closed:0,close(){this.closed++;}};state.bitmaps.push(value);return value;};
  const decode=async (blob,options)=>{assert.equal(blob.type,'image/png');assert.deepEqual(options,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});return bitmap();};
  return {manifest,fetcher,decode,state,bitmap,payloads};
}

test('verified full-size maps create one owned lease with correct physical UV and channel interpretation',async()=>{
  const f=fixture(),lease=await loadCourtSoilMaterial(f),m=lease.material;
  assert.ok(m.isMeshStandardMaterial);assert.equal(m.map.colorSpace,THREE.SRGBColorSpace);
  for(const slot of slots){assert.equal(m[slot].image.width,4096);assert.equal(m[slot].image.height,4096);assert.equal(m[slot].flipY,false);assert.equal(m[slot].repeat.x,1/1.3);assert.equal(m[slot].wrapS,THREE.RepeatWrapping);if(slot!=='map')assert.equal(m[slot].colorSpace,THREE.NoColorSpace);}
  assert.equal(m.displacementMap,null);assert.equal(m.color.getHex(),0xffffff);assert.equal(lease.diagnostics.sourcePixelsChanged,false);
  let materialsDisposed=0;const counts=slots.map(()=>0);m.addEventListener('dispose',()=>materialsDisposed++);slots.forEach((slot,i)=>m[slot].addEventListener('dispose',()=>counts[i]++));
  lease.dispose();lease.dispose();assert.equal(lease.disposed,true);assert.equal(materialsDisposed,1);assert.deepEqual(counts,[1,1,1,1]);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1,1,1,1]);
});

test('real extruded court bed top UVs preserve one metre per UV unit',()=>{
  const g=extrudedPolygon([[10,-20],[14,-20],[14,-17],[10,-17]],-.002,.112),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;let checked=0;
  for(let i=0;i<p.count;i++)if(n.getY(i)>.99){assert.ok(Math.abs(p.getY(i)-.112)<1e-6);assert.ok(Math.abs(uv.getX(i)-p.getX(i))<1e-6);assert.ok(Math.abs(uv.getY(i)+p.getZ(i))<1e-6);checked++;}
  assert.ok(checked>=6);g.dispose();
});

test('a later hash failure rejects the material and closes earlier decoded maps',async()=>{
  const f=fixture(),fetcher=async url=>url.endsWith('roughnessMap.png')?new Response(new Uint8Array([137,80,78,71,255,0,3,2])):f.fetcher(url);
  await assert.rejects(loadCourtSoilMaterial({...f,fetcher}),/SHA256 mismatch/);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1,1]);
});

test('a truncated response fails before decoding and releases existing resources',async()=>{
  const f=fixture(),fetcher=async url=>url.endsWith('normalMap.png')?new Response(new Uint8Array([1,2])):f.fetcher(url);
  await assert.rejects(loadCourtSoilMaterial({...f,fetcher}),/byte length mismatch/);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1]);
});

test('an abort during bitmap decode closes both already loaded and late bitmap exactly once',async()=>{
  const f=fixture(),controller=new AbortController();let calls=0;
  const decode=async()=>{const value=f.bitmap();if(++calls===2)controller.abort(new Error('stop-review'));return value;};
  await assert.rejects(loadCourtSoilMaterial({...f,decode,signal:controller.signal}),/stop-review/);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1,1]);assert.equal(f.state.fetches.length,2);
});

test('wrong decoded dimensions release the unexpected bitmap',async()=>{
  const f=fixture(),decode=async()=>Object.assign(f.bitmap(),{width:1024});
  await assert.rejects(loadCourtSoilMaterial({...f,decode}),/decoded dimensions mismatch/);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1]);
});

test('abort after successful loading invalidates the lease and all four maps',async()=>{
  const f=fixture(),controller=new AbortController(),lease=await loadCourtSoilMaterial({...f,signal:controller.signal});let materialDisposals=0;lease.material.addEventListener('dispose',()=>materialDisposals++);
  controller.abort();assert.equal(lease.disposed,true);lease.dispose();assert.equal(materialDisposals,1);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1,1,1,1]);
});

test('failed decoder releases previous maps and reports the original error',async()=>{
  const f=fixture();let calls=0;
  const decode=async()=>{if(++calls===3)throw new Error('image decode failure');return f.bitmap();};
  await assert.rejects(loadCourtSoilMaterial({...f,decode}),/image decode failure/);assert.deepEqual(f.state.bitmaps.map(b=>b.closed),[1,1]);
});

test('a pre-aborted request makes no network or decoder calls',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort(new Error('cancelled-before-load'));
  await assert.rejects(loadCourtSoilMaterial({...f,signal:controller.signal}),/cancelled-before-load/);assert.equal(f.state.fetches.length,0);assert.equal(f.state.bitmaps.length,0);
});
