import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {inspectWillowContextPrototype} from '../src/yuanmingyuan/shore-willow-context-diagnostic.js';
import {verifyWillowContextPair,compareWillowContextPoses,verifyRetainedShoreWillows} from '../src/yuanmingyuan/shore-willow-context.js';
import {retainedShoreWillowContext} from '../src/yuanmingyuan/shore-willow-context-data.js';
import {shoreSHA256,stableShoreJSON} from '../src/yuanmingyuan/xianfa-shore-community-prepared-signature.js';

const bytesOf=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength),hash=a=>createHash('sha256').update(ArrayBuffer.isView(a)?bytesOf(a):a).digest('hex'),columns=[0,1,2,4,5,6,8,9,10,12,13,14],tolerance={...retainedShoreWillowContext.tolerance};
const repo=new URL('../../',import.meta.url),file=p=>new URL(p,repo);
async function fixture(){
  const first=new THREE.Group();first.name='tiny-willow-source';const geometry=new THREE.PlaneGeometry(.012,.135),material=new THREE.MeshStandardMaterial({vertexColors:true});
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(geometry.attributes.position.count*3).fill(.7),3));
  const twig=new THREE.Mesh(geometry,material);twig.name='twig';const leaves=new THREE.InstancedMesh(geometry,material,3);leaves.name='leaves';
  const transforms=[[0,2,0],[1,2,1],[-1,2,-1]].map(position=>new THREE.Matrix4().makeTranslation(...position));transforms.forEach((m,i)=>{leaves.setMatrixAt(i,m);leaves.setColorAt(i,new THREE.Color(.8,.7,.6));});first.add(twig,leaves);first.updateMatrixWorld(true);
  const second=first.clone(true),otherLeaves=second.children[1];otherLeaves.instanceMatrix=leaves.instanceMatrix;otherLeaves.instanceColor=leaves.instanceColor;
  const evidence=await inspectWillowContextPrototype(first),poses=new Float32Array(leaves.count*12);for(let i=0;i<leaves.count;i++)for(let c=0;c<12;c++)poses[i*12+c]=leaves.instanceMatrix.array[i*16+columns[c]];
  const referenceBytes=bytesOf(poses),bounds=new THREE.Box3().setFromObject(first),contract={...evidence,id:'actual-tiny-context',bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},tolerance,poseReference:{url:'/fixture.bin',sha256:hash(referenceBytes),bytes:referenceBytes.length,arrayType:'Float32Array',byteOrder:'LE',columns,streams:[{id:'mesh/1/instanceMatrix',count:leaves.count,componentOffset:0}]}};
  let releases=0;for(const r of [geometry,material,leaves,otherLeaves])r.addEventListener('dispose',()=>releases++);
  return {first,second,geometry,material,leaves,otherLeaves,contract,referenceBytes,get releases(){return releases;},dispose(){leaves.dispose();otherLeaves.dispose();geometry.dispose();material.dispose();}};
}

test('real shared geometry/colour/leaf anchors and every pose pass read-only; the old aggregate rejects harmless basis rounding',async()=>{
  const f=await fixture();
  try{
    const normal=f.geometry.attributes.normal,array=f.leaves.instanceMatrix.array,normalHash=hash(normal.array),matrixVersion=f.leaves.instanceMatrix.version;
    const bits=new Uint32Array(array.buffer,array.byteOffset,array.length);bits[0]-=1;const before=hash(array);
    const oldSource=readFileSync(file('work/yuanmingyuan/shore-willow-context-r1/prepared-before-context.js'),'utf8'),start=oldSource.indexOf('    if(m.willowSourceSignature)'),end=oldSource.indexOf("    notify('verify-live-terrain')",start);assert.ok(start>=0&&end>start);
    const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor,oldCheck=new AsyncFunction('m','contextGroups','expect','equal','bytesOf','shoreSHA256',oldSource.slice(start,end));
    await assert.rejects(oldCheck({willowSourceSignature:f.contract.legacySHA256},[f.first,f.second],(ok,message)=>{if(!ok)throw new Error(message);},(a,b)=>stableShoreJSON(a)===stableShoreJSON(b),bytesOf,shoreSHA256),/retained willow source changed/);
    const result=await verifyWillowContextPair(f);assert.equal(result.verified,true);assert.equal(result.poseComparisons[0].changedComponents,1);assert.equal(result.poseComparisons[0].maximumBasisDifference,2**-24);assert.equal(result.perLeafAnchorsExact,true);assert.equal(result.sourceGeometryAndNormalsExact,true);assert.equal(result.fullSourceFactories,0);
    assert.equal(f.geometry.attributes.normal,normal);assert.equal(hash(normal.array),normalHash);assert.equal(hash(array),before);assert.equal(f.leaves.instanceMatrix.version,matrixVersion);assert.equal(f.releases,0);assert.equal(f.leaves.instanceMatrix,f.otherLeaves.instanceMatrix);
  }finally{f.dispose();}assert.equal(f.releases,4);
});

test('all 21 actually captured Chromium basis differences satisfy the same general bound without any accepted hash list',()=>{
  const browser=JSON.parse(readFileSync(file('work/production-v3/captures/shore-willow-context-check-f2c87521a23c7a4f-1789206014770-1.json'))),node=JSON.parse(readFileSync(file('work/yuanmingyuan/shore-willow-context-r1/node-willow-context.json'))),stream=browser.streams.find(s=>s.id==='mesh/5/instanceMatrix'),original=node.streams.find(s=>s.id===stream.id),changed=stream.difference.changes,ids=[...new Set(changed.map(c=>Math.floor(c.component/16)))],actual=new Float32Array(ids.length*16),reference=new Float32Array(ids.length*12),fd=openSync(file('world/public'+node.binary.url),'r');
  try{for(let i=0;i<ids.length;i++){const buffer=Buffer.alloc(64);assert.equal(readSync(fd,buffer,0,64,original.retained.byteOffset+ids[i]*64),64);const matrix=new Float32Array(buffer.buffer,buffer.byteOffset,16);actual.set(matrix,i*16);for(let c=0;c<12;c++)reference[i*12+c]=matrix[columns[c]];}}
  finally{closeSync(fd);}
  const bits=new Uint32Array(actual.buffer);for(const change of changed)bits[ids.indexOf(Math.floor(change.component/16))*16+change.component%16]=change.actual;
  const before=hash(actual),result=compareWillowContextPoses(actual,reference,{count:ids.length,tolerance});assert.equal(result.changedComponents,21);assert.equal(result.changedPoses,21);assert.equal(result.maximumBasisDifference,5.960464477539063e-8);assert.equal(result.translationBitsExact,true);assert.equal(hash(actual),before);
  actual[0]+=.001;assert.throws(()=>compareWillowContextPoses(actual,reference,{count:ids.length,tolerance}),/basis outside numerical bound/);
});

test('the complete compact reference maps all 304297 original leaf poses, and the saved Chromium values pass without constructing a model',()=>{
  const node=JSON.parse(readFileSync(file('work/yuanmingyuan/shore-willow-context-r1/node-willow-context.json'))),browser=JSON.parse(readFileSync(file('work/production-v3/captures/shore-willow-context-check-f2c87521a23c7a4f-1789206014770-1.json'))),descriptor=retainedShoreWillowContext.poseReference,referenceBytes=readFileSync(file('world/public'+descriptor.url));
  assert.equal(hash(referenceBytes),descriptor.sha256);const reference=new Float32Array(referenceBytes.buffer,referenceBytes.byteOffset,referenceBytes.byteLength/4),fd=openSync(file('world/public'+node.binary.url),'r');let poses=0,changes=0;
  try{for(const record of descriptor.streams){const original=node.streams.find(row=>row.id===record.id),actual=browser.streams.find(row=>row.id===record.id),bytes=Buffer.alloc(original.byteLength);assert.equal(readSync(fd,bytes,0,bytes.length,original.retained.byteOffset),bytes.length);assert.equal(hash(bytes),original.sha256);
    const matrices=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);assert.equal(compareWillowContextPoses(matrices,reference,{...record,tolerance}).changedComponents,0);
    const bits=new Uint32Array(bytes.buffer,bytes.byteOffset,matrices.length);for(const patch of actual.difference?.changes??[])bits[patch.component]=patch.actual;assert.equal(hash(bytes),actual.sha256);
    const result=compareWillowContextPoses(matrices,reference,{...record,tolerance});poses+=result.poses;changes+=result.changedComponents;
  }}finally{closeSync(fd);}assert.equal(poses,304297);assert.equal(changes,21);assert.equal(hash(referenceBytes),descriptor.sha256);
});

test('a one-bit anchor change, wrong orientation/scale, NaN and a bad affine row all fail',async()=>{
  const f=await fixture();try{const a=f.leaves.instanceMatrix.array,initial=a.slice(),bits=new Uint32Array(a.buffer);for(const [change,error] of [
    [()=>{bits[16+12]++;},/anchor changed/],
    [()=>{a[0]+=.0001;},/basis outside numerical bound/],
    [()=>{a[5]=NaN;},/nonfinite/],
    [()=>{a[15]=.999;},/non-affine/],
  ]){a.set(initial);change();await assert.rejects(verifyWillowContextPair(f),error);}assert.equal(f.releases,0);}finally{f.dispose();}
});

test('unknown geometry/normal/UV/color, missing leaf, split shared prototype and hierarchy drift are not admitted by pose tolerance',async()=>{
  for(const [change,error] of [
    [f=>{f.geometry.attributes.normal.array[0]=.01;},/source attribute changed/],
    [f=>{f.geometry.attributes.position.array[0]+=.001;},/source attribute changed/],
    [f=>{f.geometry.attributes.uv.array[0]+=.001;},/source attribute changed/],
    [f=>{f.leaves.instanceColor.array[0]+=.001;},/source attribute changed/],
    [f=>{f.leaves.count--;f.otherLeaves.count--;},/count or draw state changed/],
    [f=>{f.otherLeaves.instanceMatrix=f.otherLeaves.instanceMatrix.clone();},/no longer share/],
    [f=>{f.second.add(new THREE.Group());},/hierarchy count changed/],
    [f=>{f.first.children[0].position.x=.01;f.first.updateMatrixWorld(true);},/local transform changed/],
  ]){const f=await fixture();try{change(f);await assert.rejects(verifyWillowContextPair(f),error);assert.equal(f.releases,0);}finally{f.dispose();}}
});

test('reference hash errors, abort and source disposal during the async reference load release listeners, never borrowed resources',async()=>{
  const f=await fixture();try{
    const bad=f.referenceBytes.slice();bad[0]^=1;await assert.rejects(verifyWillowContextPair({...f,referenceBytes:bad}),/reference hash changed/);assert.equal(f.releases,0);
    const controller=new AbortController();let finish;const pending=verifyWillowContextPair({...f,referenceBytes:undefined,signal:controller.signal,fetchImpl:()=>new Promise(resolve=>finish=()=>resolve({ok:true,arrayBuffer:async()=>f.referenceBytes.buffer}))});
    controller.abort();finish();await assert.rejects(pending,{name:'AbortError'});assert.equal(f.releases,0);assert.equal(f.geometry._listeners.dispose.length,1,'only fixture owner observer remains');
    let complete;const disposing=verifyWillowContextPair({...f,referenceBytes:undefined,fetchImpl:()=>new Promise(resolve=>complete=()=>resolve({ok:true,arrayBuffer:async()=>f.referenceBytes.buffer}))});f.geometry.dispose();complete();await assert.rejects(disposing,/source was disposed/);assert.equal(f.releases,1);assert.equal(f.geometry._listeners.dispose.length,1);
  }finally{f.dispose();}
});

test('replacing both borrowed geometries during verification cannot validate stale captured source arrays',async()=>{
  const f=await fixture(),replacement=f.geometry.clone();try{
    await assert.rejects(verifyWillowContextPair({...f,referenceBytes:undefined,fetchImpl:async()=>{f.first.children[0].geometry=f.second.children[0].geometry=replacement;return {ok:true,arrayBuffer:async()=>f.referenceBytes.buffer};}}),/geometry\/count\/draw state changed/);assert.equal(f.releases,0);
  }finally{replacement.dispose();f.dispose();}
});

test('the production wrapper rejects alternate revision and caller-supplied factory before fetching any context reference',async()=>{
  let fetches=0;await assert.rejects(verifyRetainedShoreWillows({manifestSHA256:'wrong',fetchImpl:()=>fetches++}),/another source revision/);
  await assert.rejects(verifyRetainedShoreWillows({manifestSHA256:retainedShoreWillowContext.manifestSHA256,legacyExpectedSHA256:retainedShoreWillowContext.legacyExpectedSHA256,plantingPilot:{diagnostics:{sourceFactory:'caller-supplied-fixture'}},fetchImpl:()=>fetches++}),/full-source pilot identity/);assert.equal(fetches,0);
});
