import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProgress,freshProgress,progressEvent,achievements,movementVector,damp,segmentDistance,canCast} from '../src/logic.js';
import {locations,spellDefinitions} from '../src/locations.js';

test('corrupt, unavailable and incompatible saves recover safely',()=>{
  for(const s of [null,'{broken','null','[]','{"version":99}']) assert.deepEqual(parseProgress(s),freshProgress());
  const p=parseProgress(JSON.stringify({version:1,visited:['about','about','unknown'],crystals:[0,0,8,-1,'2'],banished:-3,bestTime:'fast'}));
  assert.deepEqual(p,{version:1,visited:['about'],crystals:[0],banished:0,bestTime:null});
});
test('progress events are bounded, idempotent and do not mutate old saves',()=>{
  const p=freshProgress();
  const q=progressEvent(progressEvent(p,{type:'collect',id:2}),{type:'collect',id:2});
  assert.deepEqual(q.crystals,[2]); assert.deepEqual(p.crystals,[]);
  assert.deepEqual(progressEvent(q,{type:'visit',id:'fake'}),q);
  let r=progressEvent(q,{type:'race',time:62});
  r=progressEvent(r,{type:'race',time:75});assert.equal(r.bestTime,62);
  r=progressEvent(r,{type:'race',time:55});assert.equal(r.bestTime,55);
});
test('achievements reflect the four actual game contracts',()=>{
  assert.deepEqual(achievements(freshProgress()),[false,false,false,false]);
  assert.deepEqual(achievements({visited:locations.map(l=>l.id),crystals:[0,1,2,3,4,5,6,7],banished:5,bestTime:70}),[true,true,true,true]);
});
test('diagonal inputs cannot outrun straight flight and camera rotation is respected',()=>{
  assert.ok(Math.abs(Math.hypot(...Object.values(movementVector(1,1,.7)))-1)<1e-12);
  const v=movementVector(0,-1,Math.PI/2);assert.ok(Math.abs(v.x+1)<1e-12);assert.ok(Math.abs(v.z)<1e-12);
});
test('damping is stable across different frame rates',()=>{
  const simulate=(hz)=>{let n=0;for(let i=0;i<hz;i++)n=damp(n,20,4,1/hz);return n;};
  assert.ok(Math.abs(simulate(30)-simulate(144))<1e-10);
});
test('fast movement uses swept collision rather than missing a crossed ring',()=>{
  assert.equal(segmentDistance({x:0,y:0,z:0},{x:-10,y:0,z:0},{x:10,y:0,z:0}),0);
  assert.equal(segmentDistance({x:0,y:4,z:0},{x:-10,y:0,z:0},{x:10,y:0,z:0}),4);
});
test('spell energy and cooldown both gate attacks',()=>{
  const s=spellDefinitions[2];assert.equal(canCast(100,1,s),false);assert.equal(canCast(37,0,s),false);assert.equal(canCast(38,0,s),true);
});
