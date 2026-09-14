import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {inspectWillowContextPrototype,inspectFullWillowContext,willowAttributeDifference} from '../src/yuanmingyuan/shore-willow-context-diagnostic.js';

function fixture(){const root=new THREE.Group();root.name='tiny-prototype';const geometry=new THREE.PlaneGeometry(.12,.04),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material),leaves=new THREE.InstancedMesh(geometry,material,2);mesh.name='leaf';leaves.name='leaves';leaves.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1,2,3));leaves.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-1,2,1));root.add(mesh,leaves);root.updateMatrixWorld(true);return {root,geometry,mesh,leaves,dispose(){leaves.dispose();geometry.dispose();material.dispose();}};}

test('actual tiny shared prototype records route/topology/attributes/instances without changing or disposing source',async()=>{
  const f=fixture(),chunks=[];let offset=0,disposals=0;f.geometry.addEventListener('dispose',()=>disposals++);
  try{const reference=await inspectWillowContextPrototype(f.root,{onAttribute:row=>{chunks.push(new Uint8Array(row.bytes));const result={byteOffset:offset};offset+=row.byteLength;return result;}}),referenceBytes=new Uint8Array(offset);let at=0;for(const chunk of chunks){referenceBytes.set(chunk,at);at+=chunk.length;}
    assert.equal(reference.statistics.uniqueGeometries,1);assert.equal(reference.statistics.meshes,2);assert.equal(reference.statistics.instances,2);
    const result=await inspectWillowContextPrototype(f.root,{reference,referenceBytes});assert.equal(result.legacyMatches,true);assert.equal(result.metadataMatches,true);assert.ok(result.streams.every(s=>s.matches));assert.equal(disposals,0);
    const normal=f.geometry.attributes.normal.array,bits=new Uint32Array(normal.buffer);bits[2]-=1;const changed=await inspectWillowContextPrototype(f.root,{reference,referenceBytes}),diff=changed.streams.find(s=>s.id==='geometry/0/normal').difference;
    assert.equal(changed.legacyMatches,false);assert.equal(diff.changed,1);assert.equal(diff.maximumULPDistance,1);assert.deepEqual(diff.axisCounts,[0,0,1]);assert.equal(bits[2],1065353215);assert.equal(disposals,0);
  }finally{f.dispose();}assert.equal(disposals,1);
});

test('negative zero, opposite residuals and large edits remain separate measured differences',()=>{
  const expected=new Float32Array([0,1e-19,1,3]),actual=new Float32Array([-0,-1e-19,1.5,3]),diff=willowAttributeDifference(actual,expected,{itemSize:2});
  assert.equal(diff.changed,3);assert.equal(diff.signedZeroDifferences,1);assert.equal(diff.signCrossings,1);assert.equal(diff.maximumAbsoluteDifference,.5);assert.equal(diff.completeChanges,true);assert.deepEqual(diff.axisCounts,[2,1]);
});

test('abort or unknown source identity fails before full source construction; borrowed read failure never disposes owner',async()=>{
  const c=new AbortController();c.abort();await assert.rejects(inspectFullWillowContext({signal:c.signal}),{name:'AbortError'});
  let progress=0;await assert.rejects(inspectFullWillowContext({manifest:{threeRevision:THREE.REVISION,sourceFiles:[{path:'changed.js',sha256:'not-the-hash'}]},readSource:()=>'',onProgress:()=>progress++}),/source closure changed/);assert.equal(progress,0);
  const f=fixture();let disposed=0;f.geometry.addEventListener('dispose',()=>disposed++);try{await assert.rejects(inspectWillowContextPrototype(f.root,{onAttribute:()=>{throw new Error('save failed');}}),/save failed/);assert.equal(disposed,0);}finally{f.dispose();}
});
