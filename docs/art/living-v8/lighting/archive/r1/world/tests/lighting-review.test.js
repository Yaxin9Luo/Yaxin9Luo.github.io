import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleEnvironment,EnvironmentClock,TIME_PHASES} from '../src/environment-time.js';

const luminance=c=>c.r*.2126+c.g*.7152+c.b*.0722;
test('pearl-fill comparison changes only fill chromaticity, preserving its linear luminance and intensity',()=>{
  for(let i=0;i<=1000;i++){
    const phase=i/1000,baseline=sampleEnvironment(phase),trial=sampleEnvironment(phase,{lightingVariant:'pearl-fill'});
    assert.equal(trial.lightingVariant,'pearl-fill');assert.ok(Math.abs(luminance(baseline.fill)-luminance(trial.fill))<1e-10);
    for(const key of Object.keys(baseline))if(!['fill','lightingVariant'].includes(key))assert.deepEqual(trial[key],baseline[key],`${key} at ${phase} must stay fixed`);
  }
  const base=sampleEnvironment(TIME_PHASES.day),trial=sampleEnvironment(TIME_PHASES.day,{lightingVariant:'pearl-fill'});assert.ok(trial.fill.r>base.fill.r&&trial.fill.b<base.fill.b);assert.equal(trial.fillIntensity,.6);
  assert.deepEqual(sampleEnvironment(TIME_PHASES.night,{lightingVariant:'pearl-fill'}).fill,sampleEnvironment(TIME_PHASES.night).fill);
});

test('explicit review selection restores baseline without changing the environment clock or another instance',()=>{
  const clock=new EnvironmentClock('day'),other=new EnvironmentClock('day'),phase=clock.phase;
  assert.equal(clock.setLightingReviewVariant('pearl-fill'),true);assert.equal(clock.update(0).lightingVariant,'pearl-fill');assert.equal(other.update(0).lightingVariant,'baseline');assert.equal(clock.phase,phase);
  assert.equal(clock.setLightingReviewVariant('invented'),false);assert.equal(clock.update(0).lightingVariant,'pearl-fill');assert.equal(clock.setLightingReviewVariant('baseline'),true);assert.deepEqual(clock.update(0),sampleEnvironment(phase));
  clock.setLightingReviewVariant('pearl-fill');clock.setMode('night',true);assert.deepEqual(clock.update(0).fill,sampleEnvironment(TIME_PHASES.night).fill);
});
