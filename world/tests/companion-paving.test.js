import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCompanionSupport} from '../src/companion-support.js';
import {evaluateCompanionSweep} from '../src/companion-system.js';
import {companionRoutes} from '../src/companion-route.js';
const fixture=JSON.parse(await readFile(new URL('./helpers/companion-court-paving.json',import.meta.url),'utf8'));
test('real courtyard brick corners separate from the rotated actor, and real upward bevels support its swept footprint',async()=>{
  assert.equal(createHash('sha256').update(await readFile(new URL('../src/gardens.js',import.meta.url))).digest('hex'),fixture.gardensSourceSha256,'refresh the exact collider fixture if original source changes');
  const support=createCompanionSupport(()=>({heightAt:()=>6,colliders:fixture.colliders})),route=companionRoutes({x:-13.95,z:46.5,heading:0},{x:-12.05,z:46.5},.95)[0];
  try{for(let i=1;i<route.points.length;i++){const from=route.points[i-1],to=route.points[i],result=evaluateCompanionSweep({kind:'elizabeth',from,to,heightAt:support.heightAt,colliders:fixture.colliders,waterLevel:-15});assert.equal(result.valid,true,`${i}: ${JSON.stringify(result)}`);assert.ok(result.supportSpread<=.030001);}}finally{support.dispose();}
});
