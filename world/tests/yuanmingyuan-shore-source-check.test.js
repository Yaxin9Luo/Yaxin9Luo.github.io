import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectShoreSourceTarget,createShoreSourceCheckFixture,shoreSourceCheckPaths,shoreSourceCheckTarget} from '../src/yuanmingyuan/shore-source-check-fixture.js';

const repo=new URL('../../',import.meta.url),manifestBytes=readFileSync(new URL('../public/assets/yuanmingyuan/xianfa-shore-community-r2/manifest.json',import.meta.url));
const manifest=JSON.parse(manifestBytes),sourceTexts=Object.fromEntries(shoreSourceCheckPaths.map(path=>[path,readFileSync(new URL(path,repo),'utf8')]));

test('the bounded actual private function reproduces all five production attribute hashes without constructing a whole shrub',async()=>{
  const result=await inspectShoreSourceTarget({sourceTexts,manifest,runtime:{node:process.version,v8:process.versions.v8}});
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),'bae066f8f178854fb094df44dd8d47d39e4c56912b439300215ab5163bad18e2');
  assert.equal(result.target,shoreSourceCheckTarget);assert.equal(result.sourceIndex,25);assert.equal(result.geometryIndex,25);assert.equal(result.allAttributesMatch,true);assert.equal(Object.keys(result.attributes).length,5);assert.ok(result.sourceIdentities.every(row=>row.match));assert.equal(result.attributes.normal.sha256,'92eebcb1912ff49c1684e7eb8c336220b0efd740ba937b89e578ebb128f5c28f');
  const normal=new Uint32Array(result.normalUint32);assert.equal(normal.length,13871*3);assert.equal(createHash('sha256').update(new Uint8Array(normal.buffer)).digest('hex'),result.attributes.normal.sha256);
  assert.deepEqual(result.diagnostics.groups,['understory-shrub-flowering-spray-01','understory-shrub-flowering-spray-02']);assert.equal(result.diagnostics.draws.length,4);assert.equal(result.diagnostics.alreadyDisposed.length,3);assert.equal(result.diagnostics.completeShrubConstructed,false);assert.equal(result.diagnostics.rendererConstructed,false);assert.equal(result.diagnostics.GPUUsed,false);assert.equal(result.batchInputs.length,13);assert.equal(result.batchInputs.reduce((sum,row)=>sum+row.vertexCount,0),13871);
});

test('the target geometry is caller-owned and disposes exactly once; earlier completed mesh geometry is already released',()=>{
  const fixture=createShoreSourceCheckFixture({studySource:sourceTexts[shoreSourceCheckPaths[0]]});let released=0;fixture.geometry.addEventListener('dispose',()=>released++);assert.equal(fixture.disposed,false);assert.equal(fixture.diagnostics.alreadyDisposed.length,3);fixture.dispose();fixture.dispose();assert.equal(released,1);assert.equal(fixture.disposed,true);
});

test('a changed source file is rejected rather than compared under the old production identity',async()=>{
  const changed={...sourceTexts,[shoreSourceCheckPaths[0]]:sourceTexts[shoreSourceCheckPaths[0]]+'\n// diagnostic source mutation\n'};
  await assert.rejects(inspectShoreSourceTarget({sourceTexts:changed,manifest}),/source closure differs from production/);
});
