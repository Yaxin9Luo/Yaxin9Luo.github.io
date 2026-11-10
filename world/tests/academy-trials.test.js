import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIALS,courseRings,courseStardust,crossRing,createRun,stepRun,ringPassed,stardustCollected,playerHit,wispBanished,medalFor,
  freshSave,parseSave,recordResult,unlockedTrials,COMBO_WINDOW,HIT_PENALTY} from '../src/academy/trials.js';
import {loadAcademyWorld,courseProblems,autopilot} from './helpers/academy-course.js';

const world=loadAcademyWorld();

test('every ring and every leg of every course clears terrain and buildings',()=>{
  for(const trial of TRIALS)assert.deepEqual(courseProblems(trial,world),[],trial.id);
});

test('a cruising autopilot finishes every trial in time, and gold needs more than the bare racing line',()=>{
  for(const trial of TRIALS){
    const r=autopilot(trial,world.world);
    assert.ok(r.finished,`${trial.id}: ${r.rings}/${r.total} rings`);
    assert.ok(r.timeLeft>4,`${trial.id} leaves ${r.timeLeft}s`);
    assert.ok(r.result.score<trial.medals.gold,`${trial.id} cruise score ${r.result.score} must not reach gold`);
    assert.ok(trial.medals.bronze<trial.medals.silver&&trial.medals.silver<trial.medals.gold);
  }
});

test('stardust trails stay clear of ring openings',()=>{
  for(const trial of TRIALS){
    const rings=courseRings(trial),dust=courseStardust(trial);
    assert.ok(dust.length>25,trial.id);
    for(const d of dust)for(const r of rings)assert.ok(Math.hypot(d.x-r.x,d.y-r.y,d.z-r.z)>r.radius,`${trial.id} dust inside ring ${r.index}`);
  }
});

test('ring crossing is swept, works in either direction and rejects misses',()=>{
  const ring={x:0,y:10,z:0,radius:5,normal:{x:0,y:0,z:-1}};
  // A 40 m step (very fast frame) through the centre still counts.
  const hit=crossRing(ring,{x:0,y:10,z:20},{x:0,y:10,z:-20});
  assert.ok(hit&&hit.perfect&&hit.forward);
  assert.ok(crossRing(ring,{x:1,y:10,z:-1},{x:1,y:10,z:1}),'backward crossing counts');
  assert.equal(crossRing(ring,{x:6,y:10,z:1},{x:6,y:10,z:-1}),null,'outside the rim');
  assert.equal(crossRing(ring,{x:0,y:10,z:3},{x:0,y:10,z:1}),null,'no crossing');
});

test('a run counts down, then rings add time, chain points and finish with a time bonus',()=>{
  const trial={...TRIALS[0],rings:TRIALS[0].rings.slice(0,3)};
  const run=createRun(trial);
  const ticks=stepRun(run,1.2);assert.equal(run.phase,'countdown');assert.ok(ticks.some(e=>e.type==='tick'));
  assert.equal(ringPassed(run),null,'rings do not count during the countdown');
  assert.ok(stepRun(run,2).some(e=>e.type==='go'));assert.equal(run.phase,'running');
  const t0=run.time,first=ringPassed(run,{perfect:true});
  assert.equal(run.time,t0+trial.ringTime);assert.equal(first.chain,1);
  const second=ringPassed(run);assert.ok(second.points>first.points-60,'chain adds points');
  const last=ringPassed(run);assert.ok(last.finished);
  assert.equal(run.phase,'finished');assert.ok(run.result.timeBonus>0);assert.equal(run.result.score,run.score+run.result.timeBonus);
});

test('stardust combos grow inside the window and lapse after it; a hit costs time, combo and chain',()=>{
  const run=createRun(TRIALS[0]);stepRun(run,4);
  stardustCollected(run);stardustCollected(run);const third=stardustCollected(run);
  assert.equal(third.combo,3);
  stepRun(run,COMBO_WINDOW+.1);assert.equal(run.combo,1);
  ringPassed(run);stardustCollected(run);stardustCollected(run);
  const time=run.time;playerHit(run);
  assert.equal(run.combo,1);assert.equal(run.chain,0);assert.ok(Math.abs(run.time-(time-HIT_PENALTY))<1e-9);
  assert.equal(wispBanished(run).points,250);
});

test('running out of time ends the run without a medal',()=>{
  const run=createRun(TRIALS[1]);stepRun(run,4);
  const events=stepRun(run,run.time+1);
  assert.ok(events.some(e=>e.type==='timeout'));assert.equal(run.result.finished,false);assert.equal(run.result.medal,null);
});

test('medals follow the thresholds',()=>{
  const t=TRIALS[0];
  assert.equal(medalFor(t,0),'bronze');assert.equal(medalFor(t,t.medals.silver),'silver');assert.equal(medalFor(t,t.medals.gold+1),'gold');
});

test('saves survive malformed storage, keep the best score and never downgrade a medal',()=>{
  for(const raw of [null,'','{','[]','{"version":1}','{"version":2,"trials":{"lantern-loop":{"best":"9","medal":"platinum"}}}'])assert.deepEqual(parseSave(raw),freshSave());
  let save=freshSave();
  save=recordResult(save,{trialId:'lantern-loop',finished:true,score:5000,medal:'silver',elapsed:30}).save;
  const worse=recordResult(save,{trialId:'lantern-loop',finished:true,score:3000,medal:'bronze',elapsed:40});
  assert.equal(worse.newBest,false);assert.equal(worse.save.trials['lantern-loop'].best,5000);assert.equal(worse.save.trials['lantern-loop'].medal,'silver');
  const failed=recordResult(worse.save,{trialId:'lantern-loop',finished:false,score:9000,medal:null,elapsed:10});
  assert.equal(failed.save.trials['lantern-loop'].best,5000,'an unfinished run never sets a best');
  assert.equal(failed.save.trials['lantern-loop'].runs,3);
  assert.deepEqual(parseSave(JSON.stringify(failed.save)),failed.save,'round trip');
});

test('trials unlock in order after a medal on the previous one',()=>{
  let save=freshSave();assert.deepEqual(unlockedTrials(save),['lantern-loop']);
  save=recordResult(save,{trialId:'lantern-loop',finished:true,score:10,medal:'bronze',elapsed:50}).save;
  assert.deepEqual(unlockedTrials(save),['lantern-loop','lake-run']);
  save=recordResult(save,{trialId:'lake-run',finished:true,score:10,medal:'bronze',elapsed:50}).save;
  assert.equal(unlockedTrials(save).length,3);
});
