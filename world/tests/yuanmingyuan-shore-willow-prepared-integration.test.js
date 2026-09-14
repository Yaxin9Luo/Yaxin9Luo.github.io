import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {inspectWillowContextPrototype} from '../src/yuanmingyuan/shore-willow-context-diagnostic.js';
import {verifyWillowContextPair} from '../src/yuanmingyuan/shore-willow-context.js';
import {retainedShoreWillowContext} from '../src/yuanmingyuan/shore-willow-context-data.js';
import {stableShoreJSON} from '../src/yuanmingyuan/xianfa-shore-community-prepared-signature.js';

const hash=b=>createHash('sha256').update(b).digest('hex'),equal=(a,b)=>stableShoreJSON(a)===stableShoreJSON(b),expect=(ok,message)=>{if(!ok)throw new Error(message);},AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const wrapperSource=readFileSync(new URL('../src/yuanmingyuan/shore-willow-context.js',import.meta.url),'utf8'),wrapperStart=wrapperSource.indexOf('export async function verifyRetainedShoreWillows(');assert.ok(wrapperStart>=0);
// Execute the actual production wrapper; the only replaced data is the known
// tiny fixture contract. The actual pair verifier and real Three remain intact.
const invokeWrapper=new AsyncFunction('input','retainedShoreWillowContext','THREE','verifyWillowContextPair','expect','equal',wrapperSource.slice(wrapperStart).replace('export async function','async function')+'\nreturn verifyRetainedShoreWillows(input);');
const preparedSource=readFileSync(new URL('../src/yuanmingyuan/xianfa-shore-community-prepared.js',import.meta.url),'utf8'),start=preparedSource.indexOf('    let willowContextVerification=null;'),end=preparedSource.indexOf("    notify('verify-live-terrain');",start);assert.ok(start>=0&&end>start);
const actualPreparedBlock=new AsyncFunction('ctx',`const {m,plantingPilot,contextGroups,prepared,verifiedSourceFiles,signal,resources,listeners,invalidate,verifyRetainedShoreWillows}=ctx;\n${preparedSource.slice(start,end)}\nreturn willowContextVerification;`);

async function fixture(){
  const source=new THREE.Group();source.name='tiny-retained-willow';const geometry=new THREE.PlaneGeometry(.012,.135),material=new THREE.MeshStandardMaterial(),leaf=new THREE.InstancedMesh(geometry,material,2);leaf.name='full-source-leaves';
  leaf.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1,2,0));leaf.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-1,2,0));leaf.setColorAt(0,new THREE.Color(.8,.7,.6));leaf.setColorAt(1,new THREE.Color(.7,.8,.6));source.add(leaf);source.updateMatrixWorld(true);
  const other=source.clone(true);other.children[0].instanceMatrix=leaf.instanceMatrix;other.children[0].instanceColor=leaf.instanceColor;
  const group=new THREE.Group(),parts=[source,other].map((child,i)=>{const part=new THREE.Group();part.userData={placementId:'actual-retained-'+i,species:'willow'};part.position.set(i*5,4,2);part.add(child);group.add(part);return part;});group.updateMatrixWorld(true);
  const inputSource='actual tiny source code identity',sourceFiles=[{path:'fixture-source.js',sha256:hash(inputSource)}],sourceFreeze='fixture-frozen-source',pilot={group,parts,dispose(){throw new Error('Prepared must not dispose the pilot');},diagnostics:{sourceFactory:'fixture-real-Three',plan:{sourceFreeze}}};group.userData.sourceFreeze=sourceFreeze;
  const diagnostic=await inspectWillowContextPrototype(source),cols=[0,1,2,4,5,6,8,9,10,12,13,14],reference=new Float32Array(24);for(let i=0;i<2;i++)cols.forEach((c,j)=>reference[i*12+j]=leaf.instanceMatrix.array[i*16+c]);const bytes=new Uint8Array(reference.buffer);
  const localBounds=new THREE.Box3();leaf.computeBoundingBox();localBounds.copy(leaf.boundingBox);
  const contract={...diagnostic,id:'fixture-context',legacyExpectedSHA256:diagnostic.legacySHA256,manifestSHA256:hash('fixture manifest'),threeRevision:THREE.REVISION,sourceFiles,sourceFreeze,sourceFactory:pilot.diagnostics.sourceFactory,contexts:parts.map(p=>({placementId:p.userData.placementId,species:'willow',matrix:p.matrixWorld.toArray()})),bounds:{min:localBounds.min.toArray(),max:localBounds.max.toArray()},tolerance:{...retainedShoreWillowContext.tolerance},poseReference:{url:'/fixture-context.bin',sha256:hash(bytes),bytes:bytes.length,arrayType:'Float32Array',byteOrder:'LE',columns:cols,streams:[{id:'mesh/0/instanceMatrix',count:2,componentOffset:0}]}};
  const resources=new Set(),listeners=[];let invalidated=false,disposals=0;for(const r of [geometry,material,leaf,other.children[0]])r.addEventListener('dispose',()=>disposals++);
  const fetchImpl=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer});
  const context={m:{willowSourceSignature:contract.legacyExpectedSHA256},prepared:{manifestSHA256:contract.manifestSHA256},plantingPilot:pilot,contextGroups:parts,verifiedSourceFiles:sourceFiles,resources,listeners,invalidate:()=>invalidated=true,
    verifyRetainedShoreWillows:input=>invokeWrapper({...input,fetchImpl},contract,THREE,verifyWillowContextPair,expect,equal)};
  return {context,contract,geometry,material,leaf,other,parts,pilot,fetchImpl,get invalidated(){return invalidated;},get disposals(){return disposals;},cleanListeners(){for(const [r,fn] of listeners)r.removeEventListener('dispose',fn);listeners.length=0;},dispose(){this.cleanListeners();leaf.dispose();other.children[0].dispose();geometry.dispose();material.dispose();}};
}

test('the real prepared call and real production wrapper verify the retained pair, report context evidence, and register borrowed invalidation',async()=>{
  const f=await fixture();try{
    const result=await actualPreparedBlock(f.context);assert.equal(result.verified,true);assert.equal(result.placementMatricesExact,true);assert.equal(result.sourceFilesVerified,1);assert.equal(result.sourceArraysWritten,false);assert.equal(result.fullSourceFactories,0);assert.equal(f.context.resources.size,4);assert.equal(f.context.listeners.length,4);assert.equal(f.disposals,0);
    f.geometry.dispatchEvent({type:'dispose'});assert.equal(f.invalidated,true);f.cleanListeners();assert.equal(f.geometry._listeners.dispose.length,1,'temporary and prepared listeners both removed');
  }finally{f.dispose();}
});

test('actual world-placement drift, wrong source proof, and a moved borrowed context during reference fetch reject before admission',async()=>{
  const f=await fixture();try{
    const input={plantingPilot:f.pilot,contextGroups:f.parts,manifestSHA256:f.contract.manifestSHA256,legacyExpectedSHA256:f.contract.legacyExpectedSHA256,verifiedSourceFiles:f.contract.sourceFiles,fetchImpl:f.fetchImpl};
    f.parts[0].position.x+=.00001;await assert.rejects(invokeWrapper(input,f.contract,THREE,verifyWillowContextPair,expect,equal),/placement changed/);f.parts[0].position.x-=.00001;
    await assert.rejects(invokeWrapper({...input,verifiedSourceFiles:[{path:'fixture-source.js',sha256:hash('changed')}]},f.contract,THREE,verifyWillowContextPair,expect,equal),/source-file proof/);
    await assert.rejects(invokeWrapper({...input,fetchImpl:async()=>{f.parts[1].position.z+=.001;return f.fetchImpl();}},f.contract,THREE,verifyWillowContextPair,expect,equal),/placement changed/);assert.equal(f.disposals,0);
  }finally{f.dispose();}
});

test('a context reference fetch error propagates through the real prepared call and its listeners remain explicitly releasable',async()=>{
  const f=await fixture();try{
    f.context.verifyRetainedShoreWillows=input=>invokeWrapper({...input,fetchImpl:async()=>{throw new Error('reference transport failed');}},f.contract,THREE,verifyWillowContextPair,expect,equal);
    await assert.rejects(actualPreparedBlock(f.context),/reference transport failed/);assert.equal(f.disposals,0);assert.equal(f.context.listeners.length,4);f.cleanListeners();assert.equal(f.geometry._listeners.dispose.length,1);
  }finally{f.dispose();}
});
