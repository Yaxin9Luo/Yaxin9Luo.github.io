import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {verifyKnownShoreNormalDifference} from '../src/yuanmingyuan/xianfa-shore-normal-compatibility.js';
import {shoreNormalCompatibilityRecords} from '../src/yuanmingyuan/xianfa-shore-normal-compatibility-data.js';
import {shoreSHA256,stableShoreJSON} from '../src/yuanmingyuan/xianfa-shore-community-prepared-signature.js';

const repo=new URL('../../',import.meta.url),path=p=>new URL(p,repo),json=p=>JSON.parse(readFileSync(path(p))),hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=json('world/public/assets/yuanmingyuan/xianfa-shore-community-r2/manifest.json'),nodeEvidence=json('work/yuanmingyuan/shore-source-normal-diagnosis-r1/full92-first/node-full92.json'),browserEvidence=json('work/production-v3/captures/shore-source-check-639d320864daa8b5-1789203967386-1.json');
const verifiedSourceFiles=manifest.sourceFiles.map(row=>({path:row.path,sha256:hash(readFileSync(path(row.path)))}));
const productionSource=readFileSync(new URL('../src/yuanmingyuan/xianfa-shore-community-prepared.js',import.meta.url),'utf8');
const start=productionSource.indexOf('        const attributes=Object.fromEntries(',productionSource.indexOf("notify('verify-source-surfaces')")),end=productionSource.indexOf('        geometryChecks.set(g,record.geometry);',start);
assert.ok(start>=0&&end>start,'The real production source-attribute block is required');
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const executeActualAttributeBlock=new AsyncFunction('context',`const {node,g,expected,i,record,prepared,verifiedSourceFiles,signal,expect,equal,bytesOf,shoreSHA256,verifyKnownShoreNormalDifference}=context;let verifiedSourceBytes=0;const normalComparisons=[];\n${productionSource.slice(start,end)}\nreturn {verifiedSourceBytes,normalComparisons};`);
const bytesOf=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);

function geometryFromRetainedBytes(sourceIndex,useBrowser=true){
  // One saved source mesh at a time; no procedural factory, whole owner, PBR,
  // community, terrain, renderer or GPU is constructed by these tests.
  const record=manifest.sources[sourceIndex],expected=manifest.geometries[record.geometry],evidence=nodeEvidence.geometries[sourceIndex],geometry=new THREE.BufferGeometry();geometry.name=expected.name;
  const fd=openSync(path('work/yuanmingyuan/shore-source-normal-diagnosis-r1/full92-first/node-source-attributes-le.bin'),'r');
  try{for(const [name,want] of Object.entries(expected.attributes)){
    const entry=evidence.attributes[name],buffer=Buffer.alloc(want.byteLength);assert.equal(readSync(fd,buffer,0,buffer.length,entry.retained.byteOffset),buffer.length);assert.equal(hash(buffer),want.sha256);
    const ArrayType=globalThis[want.arrayType],array=new ArrayType(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)),attribute=new THREE.BufferAttribute(array,want.itemSize,want.normalized);
    if(name==='normal'&&useBrowser){const actual=browserEvidence.geometries[sourceIndex].attributes.normal;new Uint32Array(array.buffer).set(actual.exactBits.values);assert.equal(hash(bytesOf(array)),actual.sha256);}
    if(name==='index')geometry.setIndex(attribute);else geometry.setAttribute(name,attribute);
  }}finally{closeSync(fd);}
  geometry.groups=structuredClone(expected.groups);geometry.setDrawRange(expected.drawRange.start,expected.drawRange.count==='Infinity'?Infinity:expected.drawRange.count);
  const material=new THREE.MeshBasicMaterial(),node=new THREE.Mesh(geometry,material);node.name=record.name;let disposals=0;geometry.addEventListener('dispose',()=>disposals++);material.addEventListener('dispose',()=>disposals++);
  return {node,g:geometry,expected,i:sourceIndex,record,prepared:{manifestSHA256:nodeEvidence.manifest.sha256},verifiedSourceFiles,
    expect:(ok,message)=>{if(!ok)throw new Error(message);},equal:(a,b)=>stableShoreJSON(a)===stableShoreJSON(b),bytesOf,shoreSHA256,verifyKnownShoreNormalDifference,
    get disposals(){return disposals;},dispose(){geometry.dispose();material.dispose();}};
}

test('all 17 actually captured browser normal streams pass the real prepared attribute branch with no source writes',async t=>{
  let components=0;
  for(const registration of shoreNormalCompatibilityRecords)await t.test(registration.meshName,async()=>{
    const context=geometryFromRetainedBytes(registration.sourceIndex),attribute=context.g.attributes.normal,array=attribute.array,version=attribute.version,before=hash(bytesOf(array));
    try{
      const result=await executeActualAttributeBlock(context);assert.equal(result.normalComparisons.length,1);const comparison=result.normalComparisons[0];
      assert.equal(comparison.actualSHA256,registration.actualSHA256);assert.equal(comparison.canonicalSHA256,registration.canonicalSHA256);assert.equal(comparison.changedComponents,registration.patches.length);assert.equal(comparison.comparisonOnly,true);
      assert.equal(result.verifiedSourceBytes,Object.values(registration.attributes).reduce((n,a)=>n+a.byteLength,0));assert.equal(context.g.attributes.normal,attribute);assert.equal(attribute.array,array);assert.equal(attribute.version,version);assert.equal(hash(bytesOf(array)),before);assert.equal(context.disposals,0);components+=comparison.changedComponents;
    }finally{context.dispose();}assert.equal(context.disposals,2);
  });
  assert.equal(components,1244);
});

test('canonical Node stream stays on the original exact branch without invoking compatibility',async()=>{
  const context=geometryFromRetainedBytes(25,false);
  try{const result=await executeActualAttributeBlock({...context,verifyKnownShoreNormalDifference:()=>{throw new Error('Canonical stream must not call compatibility');}});assert.equal(result.normalComparisons.length,0);}finally{context.dispose();}
});

test('the actual prepared branch rejects an unknown normal, later UV drift and any alternate manifest identity',async()=>{
  const context=geometryFromRetainedBytes(25);
  try{
    const bits=new Uint32Array(context.g.attributes.normal.array.buffer);bits[0]^=1;await assert.rejects(executeActualAttributeBlock(context),/unregistered complete normal byte stream/);bits[0]^=1;
    context.g.attributes.uv.array[0]+=.001;await assert.rejects(executeActualAttributeBlock(context),/non-normal attribute changed: uv/);
    await assert.rejects(executeActualAttributeBlock({...context,prepared:{manifestSHA256:'0'.repeat(64)}}),/no registered normal comparison/);assert.equal(context.disposals,0);
  }finally{context.dispose();}
});
