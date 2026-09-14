import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCompanionSweep} from '../src/companion-system.js';
import {selectMuseumGuidePlacements} from '../src/yuanmingyuan/museum-guide-placement.js';

function world(height){
  const heightAt=(x,z)=>height(x,z);heightAt.surfaceAt=(x,z)=>({height:height(x,z),normal:{x:0,y:1,z:0},walkable:true,surfaceId:'court'});
  return {heightAt,waterLevel:2,colliders:[],collidersFor:()=>[]};
}
const options={site:{id:'aviary'},centre:{x:0,z:0},visitorPosition:{x:100,z:100},entryIds:['aviary','history','water']};
test('a court edge within an ordinary 10 cm step allowance cannot admit an unsupported guide',()=>{
  const w=world(x=>x>.3?4.08:4),result=selectMuseumGuidePlacements({...options,world:w});
  assert(result.rejected.some(p=>p.x===0&&p.z===0&&p.reason==='grade'));
  assert.equal(result.placements.length,3);
  for(const p of result.placements)assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:{...p.position,heading:p.heading},...w}).valid,true);
});
test('the standing body fitting is insufficient when the raised board spans a height edge',()=>{
  const w=world(x=>x>1.5?4.12:4),pose={x:0,z:0,heading:0};
  assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,...w}).valid,true);
  assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose,interaction:true,...w}).valid,false);
  const result=selectMuseumGuidePlacements({...options,world:w});
  assert(result.rejected.some(p=>p.x===0&&p.z===0&&p.reason==='grade'));
  for(const p of result.placements)assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:{...p.position,heading:0},interaction:true,...w}).valid,true);
});
test('safe placements keep exhibit order, visitor clearance and separation while respecting architecture',()=>{
  const result=selectMuseumGuidePlacements({...options,visitorPosition:{x:0,z:0},world:world(()=>4),architecture:{capsuleBlocked:({x})=>x>0}});
  assert.equal(result.placements.length,3);
  assert.deepEqual(result.placements.map(p=>p.entryId),options.entryIds);
  assert.equal(new Set(result.placements.map(p=>p.id)).size,3);
  for(const [i,p]of result.placements.entries()){
    assert(p.position.x<=0);assert(Math.hypot(p.position.x,p.position.z)>=4.8);
    assert.equal(p.waypoints.length,0,'a capsule-only architecture binding retains safe stationary exhibits without certifying a patrol sweep');
    for(const q of result.placements.slice(i+1))assert(Math.hypot(p.position.x-q.position.x,p.position.z-q.position.z)>=7);
  }
});
test('a safe stationary exhibit guide is retained when no proposed patrol point fits',()=>{
  const w=world((x,z)=>Math.hypot(x,z)<3.2?4:NaN),result=selectMuseumGuidePlacements({...options,world:w,maximum:1});
  assert.equal(result.placements.length,1);assert.equal(result.placements[0].waypoints.length,0);
});
