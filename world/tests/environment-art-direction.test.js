import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleEnvironment,EnvironmentClock,TIME_PHASES} from '../src/environment-time.js';

const baseline=phase=>sampleEnvironment(phase,{lightingVariant:'solar-120-cloud70'});
const trial=phase=>sampleEnvironment(phase,{lightingVariant:'solar-120-sunlit'});
const changing=new Set(['lightingVariant','keyIntensity','ambientIntensity','fillIntensity']);

test('sunlit garden trial changes only direct and fill intensity while retaining sky, exposure, orbit and shadows',()=>{
  for(let i=0;i<=200;i++){
    const phase=i/200,a=baseline(phase),b=trial(phase);
    for(const key of Object.keys(a))if(!changing.has(key))assert.deepEqual(b[key],a[key],`${phase}: ${key}`);
    for(const key of ['keyIntensity','ambientIntensity','fillIntensity'])assert.ok(Number.isFinite(b[key])&&b[key]>0);
    if(a.night===1)for(const key of ['keyIntensity','ambientIntensity','fillIntensity'])assert.equal(b[key],a[key],'night remains unchanged');
  }
  const a=baseline(TIME_PHASES.day),b=trial(TIME_PHASES.day);
  assert.ok(b.keyIntensity>a.keyIntensity);assert.ok(b.ambientIntensity<a.ambientIntensity);assert.ok(b.fillIntensity<a.fillIntensity);
});

test('accepted sunlit garden interpolates across daylight boundaries and is the homepage default',()=>{
  for(const phase of [.08,.19,.265,.36,.46,.50,.54,.62,.735,.815,.92,0]){
    const a=trial(phase-1e-6),b=trial(phase+1e-6);
    for(const key of ['keyIntensity','ambientIntensity','fillIntensity'])assert.ok(Math.abs(a[key]-b[key])<.0001,`${phase}: ${key}`);
  }
  const clock=new EnvironmentClock('day');assert.equal(clock.lightingReviewVariant,'solar-120-sunlit');
  assert.equal(clock.update(0).lightingVariant,'solar-120-sunlit');
  assert.equal(clock.setLightingReviewVariant('solar-120-cloud70'),true);assert.equal(clock.update(0).lightingVariant,'solar-120-cloud70');
});
