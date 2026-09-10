import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleEnvironment,EnvironmentClock,TIME_PHASES} from '../src/environment-time.js';
import {createAtmosphere} from '../src/atmosphere.js';

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

test('solar-120 rotates only the solar azimuth and derives a continuous normalized key with the existing elevation handoff',()=>{
  const turn=new THREE.Matrix4().makeRotationY(Math.PI*2/3);
  for(let i=0;i<=10000;i++){
    const phase=i/10000,baseline=sampleEnvironment(phase),trial=sampleEnvironment(phase,{lightingVariant:'solar-120'});
    assert.equal(trial.lightingVariant,'solar-120');assert.equal(trial.solarAzimuthDegrees,120);
    assert.ok(trial.sunDirection.distanceTo(baseline.sunDirection.clone().applyMatrix4(turn))<1e-12);
    assert.equal(trial.sunDirection.y,baseline.sunDirection.y);
    for(const key of Object.keys(baseline))if(!['sunDirection','lightDirection','shadowIntensity','lightingVariant','solarAzimuthDegrees'].includes(key))assert.deepEqual(trial[key],baseline[key],`${key} at ${phase} must stay fixed`);
    for(const direction of [trial.sunDirection,trial.moonDirection,trial.lightDirection])assert.ok(direction.toArray().every(Number.isFinite)&&Math.abs(direction.length()-1)<1e-12);
    assert.ok(trial.lightDirection.y>=.05&&trial.shadowIntensity>=0&&trial.shadowIntensity<=.72);
    const nearby=sampleEnvironment(phase+1e-7,{lightingVariant:'solar-120'});
    assert.ok(trial.lightDirection.distanceTo(nearby.lightDirection)<.0001,`key discontinuity at ${phase}`);assert.ok(Math.abs(trial.shadowIntensity-nearby.shadowIntensity)<.0001,`shadow discontinuity at ${phase}`);
    if(trial.night===1){assert.ok(trial.lightDirection.distanceTo(baseline.lightDirection)<1e-12);assert.ok(Math.abs(trial.shadowIntensity-baseline.shadowIntensity)<1e-12);}
  }
  const day=sampleEnvironment(TIME_PHASES.day,{lightingVariant:'solar-120'});assert.ok(day.sunDirection.z>0,'trial must illuminate the positive-Z front');assert.ok(day.lightDirection.distanceTo(day.sunDirection)<1e-12);
  const clock=new EnvironmentClock('day');assert.equal(clock.setLightingReviewVariant('solar-120'),true);clock.setLightingReviewVariant('baseline');assert.deepEqual(clock.update(0),sampleEnvironment(TIME_PHASES.day));
});

test('solar comparison drives the actual sun mesh and cloud direction from the same transformed source',()=>{
  const atmosphere=createAtmosphere(new THREE.Scene(),{lanternCount:0,fireflyCount:0}),sun=atmosphere.root.getObjectByName('Moving sun'),sky=atmosphere.root.getObjectByName('Authored day and night cloud sky');
  try{for(const phase of [.19,.225,.265,.36,.46,.62,.70,.735,.79,.815]){
    const e=sampleEnvironment(phase,{lightingVariant:'solar-120'});atmosphere.setEnvironment(e);
    assert.ok(sun.position.clone().normalize().distanceTo(e.sunDirection)<1e-12);assert.ok(sky.material.uniforms.sunDirection.value.equals(e.sunDirection));
  }}finally{atmosphere.dispose();}
});
