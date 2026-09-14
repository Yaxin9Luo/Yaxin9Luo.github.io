import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publishedAssets} from '../src/published-asset-map.js';
import {prepareXieqiquStoneFishMaterialPixels} from '../src/yuanmingyuan/xieqiqu-stone-fish-material-study.js';
import {prepareCourtPavingPixels} from '../src/yuanmingyuan/court-paving-material-r2.js';
import {prepareFangwaiguanMaterialPixels} from '../src/yuanmingyuan/fangwaiguan-materials.js';
import {loadCourtSoilMaterial} from '../src/yuanmingyuan/court-soil-material-r1.js';
import {loadJiuzhouGravelTextures} from '../src/yuanmingyuan/jiuzhou-landscape-material.js';
import {loadCourtLowBroadleafSource} from '../src/yuanmingyuan/court-low-broadleaf-source.js';

// Model the deployed storage boundary: moved files do not exist on Pages.
// Decode is the only browser-only seam; real manifests, bytes and hashes remain.
function publishedTransport(t){
 const reverse=new Map(Object.entries(publishedAssets).map(([local,remote])=>[remote,local]));
 t.mock.method(globalThis,'fetch',async(input,{signal}={})=>{
  signal?.throwIfAborted();
  const value=input instanceof URL?input.href:input;
  const local=reverse.get(value);
  if(!local&&publishedAssets[value])return new Response(null,{status:404});
  const file=local??value;
  if(typeof file!=='string'||!file.startsWith('/'))throw new Error('Unexpected asset request: '+file);
  return new Response(await readFile(new URL('../public'+file,import.meta.url)));
 });
}
test('stone fish prepares all full-resolution channels when large maps are absent from Pages',async t=>{
 publishedTransport(t);
 let closed=0;
 const handle=await prepareXieqiquStoneFishMaterialPixels({decodeOptions:{
  createBitmap:async()=>({width:4096,height:4096,close(){closed++;}}),
  readPixels:()=>new Uint8Array(4096*4096*4),
 }});
 try{
  assert.deepEqual(Object.keys(handle.maps),['color','normal','roughness']);
  assert.equal(handle.diagnostics.decodedBytes,201326592);
  assert.equal(handle.maps.color.encodedSha256,'1f2d31717ab6d2825d5716f5ab0beba83b6f4ddc4c298980a62d180e29f7b88f');
  assert.equal(handle.maps.normal.encodedSha256,'8a5b84722bbe719c315d9ef77709c93c3d2eea49638e2b3cfea3660bb952adcb');
  assert.equal(closed,3);
 }finally{handle.dispose();}
 assert.equal(handle.maps,null);
});
for(const [name,prepare] of [
 ['court paving',prepareCourtPavingPixels],['Fangwaiguan',prepareFangwaiguanMaterialPixels],
 ['court soil',loadCourtSoilMaterial],['Jiuzhou gravel',loadJiuzhouGravelTextures],
]){
 test(name+' default transport delivers verified published bytes to the image decoder',async t=>{
  publishedTransport(t);
  const reachedDecoder=new Error('Stop at the browser image decoder');
  const previous=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:async()=>{throw reachedDecoder;}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'createImageBitmap',previous);else delete globalThis.createImageBitmap;});
  await assert.rejects(prepare(),error=>error===reachedDecoder);
 });
}

test('court broadleaf retains the whole shrub when only its normal map is externalized',async t=>{
 publishedTransport(t);
 const result=await loadCourtLowBroadleafSource({decode:async()=>({width:4096,height:4096,close(){}})});
 try{
  assert.equal(result.owner.disposed,false);
  assert.equal(result.part.children.length,3);
  assert.equal(result.owner.diagnostics.fullResolutionVerified,true);
  assert.equal(result.owner.diagnostics.files.normalMap.bytes,4500988);
 }finally{result.owner.dispose();}
 assert.equal(result.owner.disposed,true);
});
