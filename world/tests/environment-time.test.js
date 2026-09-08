import test from 'node:test';
import assert from 'node:assert/strict';
import { EnvironmentClock, sampleEnvironment, TIME_PHASES } from '../src/environment-time.js';

const cycleSteps = 20000, phaseStep = 1 / cycleSteps;
const cycle = Array.from({length: cycleSteps}, (_, i) => sampleEnvironment(i * phaseStep));

test('the environment clock wraps continuously and explicitly paused time does not advance', () => {
  const clock = new EnvironmentClock('auto', { duration: 10, phase: .999 });
  clock.update(.05);
  assert.ok(clock.phase < .01);
  const before = clock.phase;
  clock.update(300, { paused: true });
  assert.equal(clock.phase, before);
  const left = sampleEnvironment(1 - 1e-6), right = sampleEnvironment(1e-6);
  assert.ok(Math.abs(left.zenith.r - right.zenith.r) < .001);
  assert.ok(left.lightDirection.distanceTo(right.lightDirection) < .001);
  assert.equal(left.night, right.night);
});

test('manual time transitions finish, invalid inputs preserve state and reading freezes automatic time', () => {
  const clock = new EnvironmentClock('auto');
  const initial = clock.phase;
  clock.update(.1, { paused: true });
  assert.equal(clock.phase, initial);
  clock.update(.1, { reducedMotion: true });
  assert.equal(clock.phase, initial);
  assert.equal(clock.setMode('invalid'), false);
  clock.setMode('day');
  for (let i = 0; i < 30; i++) clock.update(.1, { paused: true });
  assert.equal(clock.phase, initial, 'manual transitions also freeze while paused');
  clock.setMode('day', true);
  const day = clock.update(.1);
  assert.equal(day.label, 'day');
  assert.equal(day.night, 0);
  const manual = clock.phase;
  clock.update(.1);
  assert.equal(clock.phase, manual);
  clock.setMode('night', true);
  assert.equal(clock.update(.01, { reducedMotion: true }).night, 1);
});

test('every sampled time retains finite lighting and unit directions, with readable night illumination', () => {
  for (let i = 0; i <= 1000; i++) {
    const value = sampleEnvironment(i / 1000);
    assert.ok(value.night >= 0 && value.night <= 1);
    assert.ok(value.ambientIntensity >= 1.5);
    assert.ok(value.exposure >= .9 && value.exposure <= 1.2);
    assert.ok(Math.abs(value.lightDirection.length() - 1) < 1e-10);
    for (const color of ['zenith', 'horizon', 'fog', 'key', 'cloud']) for (const channel of ['r','g','b']) assert.ok(Number.isFinite(value[color][channel]));
  }
});

test('the automatic key stays above the horizon throughout the cycle while sky bodies keep their true crossings', () => {
  let lowest = cycle[0];
  for (const value of cycle) {
    assert.ok(value.keyIntensity > 3, 'horizon protection must not remove the authored illumination');
    assert.ok(Math.abs(value.lightDirection.length() - 1) < 1e-10);
    if (value.lightDirection.y < lowest.lightDirection.y) lowest = value;
  }
  assert.ok(lowest.lightDirection.y >= Math.sin(Math.PI / 90), `strong key below the safe horizon at phase ${lowest.phase}: ${lowest.lightDirection.y}`);
  for (const phase of [.23, .77]) {
    const value = sampleEnvironment(phase);
    assert.ok(value.sunDirection.y < 0, 'the sun remains below the real sky horizon');
    assert.ok(value.moonDirection.y > 0);
  }
  for (const phase of [.27, .73]) {
    const value = sampleEnvironment(phase);
    assert.ok(value.sunDirection.y > 0);
    assert.ok(value.moonDirection.y < 0, 'the moon path must not inherit the lighting horizon floor');
  }
});

test('solar and lunar handoffs have continuous key direction and velocity, including the cycle seam', () => {
  let maxStep = 0, maxVelocityChange = 0;
  for (let i = 0; i < cycleSteps; i++) {
    const previous = cycle[(i + cycleSteps - 1) % cycleSteps].lightDirection;
    const current = cycle[i].lightDirection, next = cycle[(i + 1) % cycleSteps].lightDirection;
    maxStep = Math.max(maxStep, current.distanceTo(next));
    // A hard clamp remains position-continuous but creates an abrupt velocity
    // change at its edge. This catches that kink as well as direction jumps.
    const change = previous.clone().add(next).addScaledVector(current, -2).length() / phaseStep;
    maxVelocityChange = Math.max(maxVelocityChange, change);
  }
  assert.ok(maxStep < .0013, `key direction jumps between adjacent phases: ${maxStep}`);
  assert.ok(maxVelocityChange < .075, `key direction velocity has a hard transition: ${maxVelocityChange}`);
});

test('horizon protection preserves all four manual palettes and their authored intensities', () => {
  const colors = ['zenith', 'horizon', 'cloud', 'fog', 'key', 'sky', 'ground', 'fill', 'water'];
  const numbers = ['keyIntensity', 'ambientIntensity', 'fillIntensity', 'fogDensity', 'exposure', 'night'];
  const presets = {
    dawn: {colors: ['7195c4', 'edbdb0', 'f0d1c0', 'a8a9bc', 'ffd4b8', 'cad6f0', '9f9694', '9aafdf', '537481'], numbers: [3.3, 1.8, .65, .0011, 1.02, .12]},
    day: {colors: ['397bb1', 'c9e4e9', 'fff3dd', 'abc6d5', 'fff0d5', 'b3d6f2', '9d9d83', 'bed8ef', '236775'], numbers: [3.4, 2.0, 1.15, .00095, 1.02, 0]},
    dusk: {colors: ['6979ad', 'efac87', 'f4bc96', 'b49da6', 'ffd2a5', 'c2b9e0', 'a39390', 'a6bbe9', '53697f'], numbers: [3.35, 1.8, .7, .0012, 1.0, .28]},
    night: {colors: ['152d59', '6382a0', '6386a4', '46617c', 'c3deff', 'b6d1eb', '596d88', 'b7ccec', '173d50'], numbers: [3.35, 1.75, .90, .00135, 1.16, 1]},
  };
  for (const [mode, expected] of Object.entries(presets)) {
    const actual = sampleEnvironment(TIME_PHASES[mode]);
    assert.deepEqual(colors.map(key => actual[key].getHexString()), expected.colors, `${mode} colours`);
    numbers.forEach((key, i) => assert.ok(Math.abs(actual[key] - expected.numbers[i]) < 1e-12, `${mode} ${key}`));
  }
});

test('240 active seconds make one day at high, low and uneven frame rates',()=>{
  for(const fps of [60,17,5]){
    const clock=new EnvironmentClock('auto',{phase:0});
    for(let i=0;i<37*fps;i++)clock.update(1/fps);
    assert.ok(Math.abs(clock.phase-37/240)<1e-9,`${fps} FPS must count actual elapsed seconds`);
    for(let i=37*fps;i<240*fps;i++)clock.update(1/fps);
    assert.ok(Math.min(clock.phase,1-clock.phase)<1e-9);
  }
  const uneven=new EnvironmentClock('auto',{phase:0});
  for(const dt of [.003,.2,4,17,100,118.797])uneven.update(dt);
  assert.ok(Math.min(uneven.phase,1-uneven.phase)<1e-9);
  const before=uneven.phase;for(const dt of [-1,NaN,Infinity])uneven.update(dt);assert.equal(uneven.phase,before);
  assert.equal(new EnvironmentClock('auto',{duration:0}).duration,240);
});

test('jumping continues automatic time throughout the transition and fixed presets hold',()=>{
  const clock=new EnvironmentClock('night');
  assert.equal(clock.jumpTo('dawn'),true);assert.equal(clock.mode,'auto');
  clock.update(.6);const phase=clock.phase;
  clock.update(300,{paused:true});clock.update(300,{reducedMotion:true});assert.equal(clock.phase,phase);
  clock.update(1.8);clock.update(10);
  assert.ok(Math.abs(clock.phase-(TIME_PHASES.dawn+12.4/240))<1e-9);
  assert.equal(clock.transition,null);
  const current=clock.phase;assert.equal(clock.jumpTo('noonish'),false);assert.equal(clock.phase,current);
  clock.setMode('noon',true);clock.update(1000);assert.equal(clock.phase,TIME_PHASES.noon);
  clock.jumpTo('midnight',true);clock.update(60);assert.ok(Math.abs(clock.phase-.25)<1e-9);
});

test('the clock snapshot distinguishes fixed presets, auto time and pause reasons',()=>{
  const clock=new EnvironmentClock('auto',{phase:.5});
  assert.deepEqual({...clock.getSnapshot(),label:undefined,night:undefined},{mode:'auto',phase:.5,label:undefined,night:undefined,period:'noon',clockText:'12:00',durationSeconds:240,clockState:'auto',pauseReason:null,transitioning:false});
  assert.equal(clock.getSnapshot({paused:true,pauseReason:'reading'}).clockState,'paused');
  assert.equal(clock.getSnapshot({reducedMotion:true}).pauseReason,'reduced-motion');
  assert.equal(clock.getSnapshot({started:false}).pauseReason,'intro');
  clock.setMode('night',true);const fixed=clock.getSnapshot({paused:true,pauseReason:'reading'});
  assert.equal(fixed.clockState,'fixed');assert.equal(fixed.mode,'night');assert.equal(fixed.pauseReason,'reading');
});

test('noon and midnight have distinct continuous light while retaining readable surfaces',()=>{
  assert.ok(sampleEnvironment(TIME_PHASES.noon).keyIntensity>sampleEnvironment(TIME_PHASES.day).keyIntensity);
  assert.ok(sampleEnvironment(TIME_PHASES.midnight).ambientIntensity<sampleEnvironment(TIME_PHASES.night).ambientIntensity);
  assert.ok(sampleEnvironment(0).ambientIntensity>=1.5);
});
