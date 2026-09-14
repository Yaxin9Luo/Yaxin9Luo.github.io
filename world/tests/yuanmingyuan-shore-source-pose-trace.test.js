import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {traceShoreTargetNormalizations} from '../src/yuanmingyuan/shore-source-pose-trace.js';
import {inspectShoreSourceTarget,shoreSourceCheckPaths} from '../src/yuanmingyuan/shore-source-check-fixture.js';

test('synchronous observation restores the exact original prototype after a source exception',()=>{
  const before=THREE.Vector3.prototype.normalize;
  assert.throws(()=>traceShoreTargetNormalizations(()=>{new THREE.Vector3(1,2,3).normalize();throw new Error('source stopped');}),/source stopped/);
  assert.equal(THREE.Vector3.prototype.normalize,before);
});

test('observing the real target retains all five production attribute hashes and captures the first outward normalization',async()=>{
  const repo=new URL('../../',import.meta.url),sourceTexts=Object.fromEntries(shoreSourceCheckPaths.map(path=>[path,readFileSync(new URL(path,repo),'utf8')])),manifest=JSON.parse(readFileSync(new URL('world/public/assets/yuanmingyuan/xianfa-shore-community-r2/manifest.json',repo))),before=THREE.Vector3.prototype.normalize;
  const result=await inspectShoreSourceTarget({sourceTexts,manifest,traceNormalizations:true});assert.equal(result.allAttributesMatch,true);assert.equal(THREE.Vector3.prototype.normalize,before);
  assert.ok(result.normalizationTrace.observations.length>=2);const initial=result.normalizationTrace.observations[0];assert.deepEqual(initial.output,result.batchInputs[6].poseInput.direction);assert.notEqual(initial.diagnosticLengthSquared,1);assert.ok(initial.callStack.includes('spray'));
  for(const later of result.normalizationTrace.observations.slice(1)){assert.deepEqual(later.input,initial.output);assert.deepEqual(later.output,initial.output);}
});
