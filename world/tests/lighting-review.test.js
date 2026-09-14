import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleEnvironment,EnvironmentClock,TIME_PHASES,DAY_DURATION_SECONDS,blendWesternKeyDirections} from '../src/environment-time.js';
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
  assert.equal(clock.setLightingReviewVariant('pearl-fill'),true);assert.equal(clock.update(0).lightingVariant,'pearl-fill');assert.equal(other.update(0).lightingVariant,'solar-120-cloud70');assert.equal(clock.phase,phase);
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
  try{for(const lightingVariant of ['solar-120','solar-120-stable'])for(const phase of [0,.19,.225,.265,.36,.46,.62,.70,.735,.79,.815,.9999]){
    const e=sampleEnvironment(phase,{lightingVariant});atmosphere.setEnvironment(e);
    assert.ok(sun.position.clone().normalize().distanceTo(e.sunDirection)<1e-12);assert.ok(sky.material.uniforms.sunDirection.value.equals(e.sunDirection));
  }}finally{atmosphere.dispose();}
});

test('stable solar handoff changes only the blended key and derived shadow, preserving exact celestial paths and light energy',()=>{
  for(let i=0;i<=10000;i++){
    const phase=i/10000,old=sampleEnvironment(phase,{lightingVariant:'solar-120'}),trial=sampleEnvironment(phase,{lightingVariant:'solar-120-stable'});
    assert.equal(trial.lightingVariant,'solar-120-stable');assert.equal(trial.keyHandoff,'western-azimuth-elevation');
    for(const key of Object.keys(old))if(!['lightDirection','shadowIntensity','lightingVariant','keyHandoff'].includes(key))assert.deepEqual(trial[key],old[key],`${key} at ${phase}`);
    assert.ok(trial.lightDirection.toArray().every(Number.isFinite));assert.ok(Math.abs(trial.lightDirection.length()-1)<1e-12);assert.ok(trial.lightDirection.y>=.05);
    if(old.night===0||old.night===1){assert.ok(trial.lightDirection.distanceTo(old.lightDirection)<1e-12);assert.ok(Math.abs(trial.shadowIntensity-old.shadowIntensity)<1e-12);}
    // The authored western arc stays away from its positive-Z branch cut;
    // interpolation must not choose the eastern half of a near-opposite pair.
    if(old.night>0&&old.night<1)assert.ok(trial.lightDirection.x<0);
  }
});

test('stable handoff bounds actual angular speed across a complete 240-second cycle at 8, 30 and 60 fps',()=>{
  for(const fps of [8,30,60]){
    const dt=1/fps,step=dt/DAY_DURATION_SECONDS;let previous=sampleEnvironment(0,{lightingVariant:'solar-120-stable'}).lightDirection,previousRate=null;
    for(let i=1;i<=fps*DAY_DURATION_SECONDS;i++){
      const current=sampleEnvironment(i*step,{lightingVariant:'solar-120-stable'}).lightDirection;
      const rate=previous.angleTo(current)/dt;
      assert.ok(rate<.25,`rapid key at phase ${i*step}, ${fps} fps`);
      if(previousRate!==null)assert.ok(Math.abs(rate-previousRate)/dt<.06,`abrupt key speed at phase ${i*step}, ${fps} fps`);
      previous=current;previousRate=rate;
    }
  }
  const phase=.231,dt=1/60;
  const before=sampleEnvironment(phase,{lightingVariant:'solar-120'}),after=sampleEnvironment(phase+dt/DAY_DURATION_SECONDS,{lightingVariant:'solar-120'});
  assert.ok(before.lightDirection.angleTo(after.lightDirection)/dt>1.5,'original native-failing cancellation must remain reproducible in the old review variant');
});

test('western angular interpolation stays stable on either side of antipodal lunar directions',()=>{
  const sun=new THREE.Vector3(-.000001,-.1,1).normalize();
  const moonA=new THREE.Vector3(-.000001,.1,-1).normalize(),moonB=new THREE.Vector3(.000001,.1,-1).normalize();
  let previous=blendWesternKeyDirections(sun,moonA,0);
  for(let i=0;i<=10000;i++){
    const amount=i/10000,a=blendWesternKeyDirections(sun,moonA,amount),b=blendWesternKeyDirections(sun,moonB,amount);
    assert.ok(a.toArray().every(Number.isFinite)&&Math.abs(a.length()-1)<1e-12);
    assert.ok(a.distanceTo(b)<.000003,'small input perturbations must not flip the selected arc');
    assert.ok(a.angleTo(previous)<.0004,'no cancellation or sudden turn at the midpoint');previous=a;
    if(i>0&&i<10000)assert.ok(a.x<0);
  }
  assert.deepEqual(blendWesternKeyDirections(sun,moonA,0),sun);assert.deepEqual(blendWesternKeyDirections(sun,moonA,1),moonA);
});

test('phase wrap, fixed modes and baseline directions retain their existing clock and endpoint behavior',()=>{
  for(const variant of ['baseline','pearl-fill','solar-120','solar-120-stable']){
    const clock=new EnvironmentClock('auto',{phase:.9999});clock.setLightingReviewVariant(variant);
    const before=clock.update(0),after=clock.update(.048);
    assert.ok(Math.abs(after.phase-.0001)<1e-12);assert.ok(before.lightDirection.angleTo(after.lightDirection)<.001);
    assert.deepEqual(sampleEnvironment(0,{lightingVariant:variant}),sampleEnvironment(1,{lightingVariant:variant}));
    for(const mode of ['day','night']){clock.setMode(mode,true);const start=clock.update(0);assert.deepEqual(clock.update(1000),start);assert.ok(Math.abs(start.phase-TIME_PHASES[mode])<1e-12);}
  }
  for(let i=0;i<=10000;i++){
    const e=sampleEnvironment(i/10000),expected=e.sunDirection.clone().lerp(e.moonDirection,e.night).normalize();
    if(expected.y<.1){const y=.05+Math.max(0,expected.y)**2/.2,s=Math.sqrt(1-y*y)/Math.hypot(expected.x,expected.z);expected.set(expected.x*s,y,expected.z*s);}
    assert.ok(e.lightDirection.distanceTo(expected)<1e-12,'baseline keeps its original vector blend');
    assert.equal(e.keyHandoff,'normalized-vector');
  }
});

test('cloud-70 compares only sky blending on the accepted stable solar base and restores the original sky state',()=>{
  for(let i=0;i<=1000;i++){
    const phase=i/1000,base=sampleEnvironment(phase,{lightingVariant:'solar-120-stable'}),trial=sampleEnvironment(phase,{lightingVariant:'solar-120-cloud70'});
    assert.equal(trial.lightingVariant,'solar-120-cloud70');assert.equal(base.cloudBlend,.83);assert.equal(trial.cloudBlend,.70);
    for(const key of Object.keys(base))if(!['lightingVariant','cloudBlend'].includes(key))assert.deepEqual(trial[key],base[key],`${key} at ${phase} must stay fixed`);
  }
  const atmosphere=createAtmosphere(new THREE.Scene(),{lanternCount:0,fireflyCount:0}),sky=atmosphere.root.getObjectByName('Authored day and night cloud sky');
  try{
    atmosphere.update(0,0,true);atmosphere.setEnvironment(sampleEnvironment(TIME_PHASES.day,{lightingVariant:'solar-120-stable'}));
    const geometry=sky.geometry,shader=sky.material.fragmentShader,uniforms=THREE.UniformsUtils.clone(sky.material.uniforms);
    atmosphere.setEnvironment(sampleEnvironment(TIME_PHASES.day,{lightingVariant:'solar-120-cloud70'}));assert.equal(sky.material.uniforms.cloudBlend.value,.70);
    assert.equal(sky.geometry,geometry);assert.equal(sky.material.fragmentShader,shader);
    for(const key of Object.keys(uniforms))if(key!=='cloudBlend')assert.deepEqual(sky.material.uniforms[key],uniforms[key]);
    atmosphere.setEnvironment(sampleEnvironment(TIME_PHASES.day,{lightingVariant:'solar-120-stable'}));assert.deepEqual(sky.material.uniforms,uniforms);
  }finally{atmosphere.dispose();}
});
