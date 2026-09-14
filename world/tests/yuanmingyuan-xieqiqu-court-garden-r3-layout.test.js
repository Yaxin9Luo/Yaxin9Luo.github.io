import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createCourtBandsR3Drifts} from '../src/yuanmingyuan/xieqiqu-court-garden-r3-layout.js';
test('the standalone R3 layout retains every reviewed CPU placement and reservation',()=>{
 const plan=createCourtBandsR3Drifts(),bytes=JSON.stringify(plan,null,2)+'\n';
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'18d335e72d1053f57cbefc0d2311a9ef4f5012fe42632a0443f840e10a1ece9a');
 assert(Object.isFrozen(plan)&&Object.isFrozen(plan.placements)&&Object.isFrozen(plan.beds));
 assert.equal(plan.historicallySurveyed,false);assert.equal(plan.nativeReviewed,false);
 assert.deepEqual(plan.sourceLayout.regions[0].placements.map(p=>p.species),plan.placements.map(p=>p.species));
});
