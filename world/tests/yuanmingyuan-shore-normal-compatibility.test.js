import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createShoreSourceCheckFixture,shoreSourceCheckTarget} from '../src/yuanmingyuan/shore-source-check-fixture.js';
import {verifyKnownShoreNormalDifference} from '../src/yuanmingyuan/xianfa-shore-normal-compatibility.js';
import {shoreNormalCompatibilityRecords} from '../src/yuanmingyuan/xianfa-shore-normal-compatibility-data.js';

const repo=new URL('../../',import.meta.url),record=shoreNormalCompatibilityRecords[0];
const browser=JSON.parse(readFileSync(new URL('work/production-v3/captures/shore-source-check-c6d9b42261e6e6f2-1789203023469-1.json',repo)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytesOf=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const sourceProof=record.sourceFiles.map(row=>({path:row.path,sha256:hash(readFileSync(new URL(row.path,repo)))}));
let target;
before(()=>{target=createShoreSourceCheckFixture({studySource:readFileSync(new URL('world/src/yuanmingyuan/garden-understory-study.js',repo),'utf8')});});
after(()=>target.dispose());
function fixture(useBrowser=true){
  const geometry=target.geometry.clone(),material=new THREE.MeshBasicMaterial(),node=new THREE.Mesh(geometry,material);node.name=shoreSourceCheckTarget;
  if(useBrowser)new Uint32Array(geometry.attributes.normal.array.buffer).set(browser.normalUint32);
  let disposals=0;geometry.addEventListener('dispose',()=>disposals++);material.addEventListener('dispose',()=>disposals++);
  return {node,sourceIndex:25,geometryIndex:25,manifestSHA256:record.manifestSHA256,verifiedSourceFiles:sourceProof,
    get disposals(){return disposals;},dispose(){geometry.dispose();material.dispose();}};
}

test('actual Chromium byte stream canonicalizes only the comparison copy; original source identity and bytes stay unchanged',async()=>{
  const input=fixture(),attribute=input.node.geometry.attributes.normal,array=attribute.array,before=new Uint8Array(bytesOf(array)),version=attribute.version;
  try{
    assert.equal(hash(before),record.actualSHA256);const result=await verifyKnownShoreNormalDifference(input);
    assert.equal(result.verified,true);assert.equal(result.applied,true);assert.equal(result.changedComponents,30);assert.equal(result.actualSHA256,browser.attributes.normal.sha256);assert.equal(result.canonicalSHA256,record.canonicalSHA256);
    assert.equal(result.maximumAbsoluteDifference,5.468656465710577e-20);assert.equal(result.comparisonOnly,true);assert.equal(result.borrowedNormalWritten,false);
    assert.equal(input.node.geometry.attributes.normal,attribute);assert.equal(attribute.array,array);assert.equal(attribute.version,version);assert.deepEqual(bytesOf(array),before);assert.equal(input.disposals,0);
    assert.equal(result.verifiedSourceFiles,33);assert.equal(Object.keys(result.otherAttributeSHA256).length,4);
  }finally{input.dispose();}assert.equal(input.disposals,2);
});

test('the canonical actual Node target takes the exact path with zero patched components',async()=>{
  const input=fixture(false);
  try{const result=await verifyKnownShoreNormalDifference(input);assert.equal(result.applied,false);assert.equal(result.changedComponents,0);assert.equal(result.maximumAbsoluteDifference,0);assert.equal(result.actualSHA256,record.canonicalSHA256);assert.equal(input.disposals,0);}finally{input.dispose();}
});

test('one unregistered least-significant bit is rejected even at an already tiny component',async()=>{
  const input=fixture();
  try{const bits=new Uint32Array(input.node.geometry.attributes.normal.array.buffer);bits[record.patches[0].component]^=1;await assert.rejects(verifyKnownShoreNormalDifference(input),/unregistered complete normal byte stream/);assert.equal(input.disposals,0);}finally{input.dispose();}
});

test('each actual non-normal source attribute remains independently exact, including checks after normal in the old loader',async()=>{
  const input=fixture();
  try{
    for(const key of ['index','position','uv','color']){
      const a=key==='index'?input.node.geometry.index:input.node.geometry.attributes[key],bytes=bytesOf(a.array);bytes[0]^=1;
      await assert.rejects(verifyKnownShoreNormalDifference(input),new RegExp('non-normal attribute changed: '+key));bytes[0]^=1;
    }
    assert.equal(input.disposals,0);
  }finally{input.dispose();}
});

test('wrong manifest/source-file closure/geometry or incomplete source proof cannot use the registered numerical record',async()=>{
  const input=fixture();
  try{
    await assert.rejects(verifyKnownShoreNormalDifference({...input,manifestSHA256:'0'.repeat(64)}),/no registered/);
    await assert.rejects(verifyKnownShoreNormalDifference({...input,sourceIndex:24}),/no registered/);
    await assert.rejects(verifyKnownShoreNormalDifference({...input,verifiedSourceFiles:sourceProof.slice(1)}),/complete verified/);
    await assert.rejects(verifyKnownShoreNormalDifference({...input,verifiedSourceFiles:sourceProof.map((row,i)=>i?row:{...row,sha256:'0'.repeat(64)})}),/verified source identity changed/);
    input.node.geometry.name='other-geometry';await assert.rejects(verifyKnownShoreNormalDifference(input),/geometry metadata changed/);
    assert.equal(input.disposals,0);
  }finally{input.dispose();}
});

test('a source mutation while SHA awaits cannot be admitted from the earlier copied byte stream',async()=>{
  const input=fixture();
  try{const pending=verifyKnownShoreNormalDifference(input);queueMicrotask(()=>{input.node.geometry.attributes.position.array[0]+=.01;});await assert.rejects(pending,/borrowed source changed during comparison: position/);assert.equal(input.disposals,0);}finally{input.dispose();}
});

test('a same-byte replacement of the borrowed normal object is rejected, and abort never disposes the owner',async()=>{
  const input=fixture();
  try{
    const pending=verifyKnownShoreNormalDifference(input);queueMicrotask(()=>input.node.geometry.setAttribute('normal',input.node.geometry.attributes.normal.clone()));
    await assert.rejects(pending,/borrowed attribute was replaced/);
    const controller=new AbortController(),aborting=verifyKnownShoreNormalDifference({...input,signal:controller.signal});controller.abort();await assert.rejects(aborting,{name:'AbortError'});assert.equal(input.disposals,0);
  }finally{input.dispose();}
});
