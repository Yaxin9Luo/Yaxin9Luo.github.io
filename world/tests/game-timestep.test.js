import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/game.js';
import { GROUND_MOTION, queryGroundSupport } from '../src/ground-motion.js';
import { CHARACTER_GROUND_MOTION } from '../src/characters.js';
import { EnvironmentClock } from '../src/environment-time.js';
import {createAtmosphere} from '../src/atmosphere.js';
import {createReviewLoading} from '../src/review-loading.js';

// Real frame dispatch, movement, ground collision, cooldowns, projectiles and
// effect lifetimes; only browser/GPU presentation and portfolio UI are omitted.
function fixture(t, { run = false, mode = 'grounded' } = {}) {
  for (const [name, value] of Object.entries({ document: { hidden: false }, requestAnimationFrame: () => 1 })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    started: true, paused: false, _suspended: false, _contextLost: false, _disposed: false, _combat: false,
    options: { quality: 'high', reducedMotion: false, gameplay: true },
    mana: 50, health: 100, shield: 3, cooldown: 3, _invulnerable: 0, _hitShake: 0,
    _time: 0, _simulationTime: 0, _lastFrame: 1000, _lastSnapshot: 0, _frameCount: 0, fps: 60,
    scene: new THREE.Scene(), position: new THREE.Vector3(0, mode === 'grounded' ? -CHARACTER_GROUND_MOTION.soleY : 80, 0),
    velocity: new THREE.Vector3(), _previous: new THREE.Vector3(), heading: 0,
    _scratch: new THREE.Vector3(), _scratch2: new THREE.Vector3(), _forward: new THREE.Vector3(),
    _projected: new THREE.Vector3(), _castOrigin: new THREE.Vector3(),
    _keys: new Set(['KeyD']), _touch: { x: 0, z: 0 },
    _controls: { up: false, down: false, fire: false, boost: run }, cameraYaw: 0, _bank: 0, _trailTime: 0,
    _destination: null, race: null, buildingColliders: [], callbacks: {},
    world: { heightAt: () => 0, wisps: [], update() {} },
    exhibitionStage: { update() {} }, canvas: { width: 1280, height: 720 },
    audio: { play() {}, unlock() {}, setSuspended() {}, update() {} },
    renderer: { shadowMap: {}, info: { reset() {} } }, rendering: { render() {} },
    environmentClock: new EnvironmentClock('auto'),
    _updateEnvironment(dt) { this.environmentClock.update(dt, { paused: this._isPaused() }); },
    _updateCamera() {}, _updateInteractions() {}, _emitFrame() {}, _message() {},
  });
  game.camera = new THREE.PerspectiveCamera();
  game.wizard = new THREE.Group();
  game.scene.add(game.wizard);
  game.locomotion = { mode, progress: 0, gaitPhase: 0, groundSpeed: 0, support: mode === 'grounded' ? { valid: true, y: 0, normal: { x: 0, y: 1, z: 0 } } : null };
  game._createEffects();
  t.after(() => {
    const geometries = new Set(), materials = new Set();
    game.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    game.scene.clear();
  });
  return game;
}

function advance(game, seconds, fps) {
  const start = game._lastFrame;
  for (let i = 1; i <= Math.round(seconds * fps); i++) game._tick(start + i * 1000 / fps);
}

function staticReview(t) {
  const game=fixture(t);game._keys.clear();game.shield=0;game.options.gameplay=false;game.options.reducedMotion=true;
  game._reviewRendering={pending:true,staticComparison:false,continuous:false,lastView:null,idle:false};
  game.setReviewRendering({staticComparison:true});let draws=0;game.rendering.render=()=>{draws++;};
  return {game,draws:()=>draws};
}

test('review demand rendering coalesces identical passes while preserving actual simulation dispatch',t=>{
  const {game,draws}=staticReview(t);advance(game,1,20);
  assert.equal(draws(),1);assert.ok(Math.abs(game._simulationTime-1)<1e-8,'render idling does not alter the simulation clock');
  game.requestRender();game.requestRender();advance(game,.2,20);assert.equal(draws(),2);
  let requests=0;game.rendering.render=()=>{requests++;if(requests===1)game.requestRender();};
  game.requestRender();advance(game,.2,20);assert.equal(requests,2,'a request made inside render survives for the next real pass');
});

test('review demand rendering keeps first/full callbacks behind a successful actual pass',t=>{
  const {game,draws}=staticReview(t);advance(game,.1,20);let core=0,full=0;
  game._firstFrame=()=>{core++;};game._fullFrame=()=>{full++;};
  game.rendering.render=()=>{throw new Error('real pass failed');};
  assert.throws(()=>game._tick(1150),/real pass failed/);assert.equal(core,0);assert.equal(full,0);
  game.rendering.render=()=>{};game._tick(1200);assert.equal(core,1);assert.equal(full,1);
  assert.equal(game._frameCount,2);assert.equal(draws(),1);
});

test('review demand rendering resumes for measurement, real input and camera movement then returns idle',t=>{
  const {game,draws}=staticReview(t);advance(game,.1,20);
  game.setReviewRendering({continuous:true});advance(game,.2,20);assert.equal(draws(),5);
  game.setReviewRendering({continuous:false});advance(game,.2,20);assert.equal(draws(),6);
  game._keys.add('KeyD');const x=game.position.x;advance(game,.2,20);assert.equal(draws(),10);assert.ok(game.position.x>x);
  game._keys.clear();advance(game,.2,20);const stopped=draws();advance(game,.2,20);assert.equal(draws(),stopped);
  game.camera.position.x+=2;advance(game,.2,20);assert.equal(draws(),stopped+1);
  game.setPaused(true);advance(game,.2,20);assert.equal(draws(),stopped+2,'pause changes request their own real frame');
  game.setOption('reducedMotion',false);advance(game,.2,20);assert.equal(draws(),stopped+6,'live motion always renders continuously');
});

test('review demand rendering cannot opt in normal Game and retains invalidation across hidden/context gates',t=>{
  const normal=fixture(t);normal._keys.clear();normal.options.reducedMotion=true;let normalDraws=0;normal.rendering.render=()=>normalDraws++;
  assert.equal(normal.setReviewRendering({staticComparison:true}),false);advance(normal,.2,20);assert.equal(normalDraws,4);
  const {game,draws}=staticReview(t);advance(game,.1,20);game.requestRender();document.hidden=true;advance(game,.2,20);assert.equal(draws(),1);
  document.hidden=false;game._contextLost=true;advance(game,.2,20);assert.equal(draws(),1);
  game._contextLost=false;advance(game,.2,20);assert.equal(draws(),2);
  game._disposed=true;assert.equal(game.requestRender(),false);advance(game,.2,20);assert.equal(draws(),2);
});

test('staged review holds after the actual core render, resumes one real full frame and consumes no inactive time',async t=>{
  const game=fixture(t),frames=new Map();let next=1,now=1000,draws=0,core=0,full=0,ready=false;
  const schedule=callback=>{const id=next++;frames.set(id,callback);return id;},cancel=id=>frames.delete(id);
  globalThis.requestAnimationFrame=schedule;game._tick=game._tick.bind(game);game.rendering.render=()=>{draws++;};
  const loading=createReviewLoading({mode:'staged',now:()=>now,schedule,cancel,setTimer:()=>1,clearTimer(){}});t.after(()=>loading.dispose());
  game._firstFrame=()=>{core++;loading.progress({phase:'first-frame'});};game._animation=schedule(game._tick);
  const frame=()=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(now);};frame();assert.equal(draws,1);assert.equal(core,1);
  loading.attach(game);loading.progress({phase:'enhancements-begin',deadline:901000});assert.equal(frames.size,0);
  const position=game.position.clone(),time=game._simulationTime;now=601000;
  await Promise.resolve().then(()=>{game.world.complete=true;loading.progress({phase:'enhancements',enhancements:'ready'});game._fullFrame=()=>{full++;ready=loading.completeFrame(true);};});
  assert.equal(draws,1);assert.equal(full,0);assert.equal(ready,false);assert.equal(frames.size,1);frame();assert.equal(draws,2);assert.equal(full,1);assert.equal(ready,true);assert.equal(frames.size,1);assert.equal(game._simulationTime,time);assert.deepEqual(game.position,position);
  loading.progress({phase:'enhancements',enhancements:'ready'});assert.equal(frames.size,1);
});

for (const fps of [60, 15, 9, 8]) for (const run of [false, true]) {
  test(`${run ? 'running' : 'walking'} covers the same wall-clock distance through real frame dispatch at ${fps} FPS`, t => {
    const game = fixture(t, { run });
    advance(game, 4, fps);
    const expected = (run ? GROUND_MOTION.runSpeed : GROUND_MOTION.walkSpeed) * 4;
    t.diagnostic(`${fps} FPS ${run ? 'run' : 'walk'}: ${game.position.x.toFixed(4)} m / 4 s`);
    assert.ok(Math.abs(game.position.x - expected) < 1e-8, `${game.position.x} m must equal ${expected} m`);
    assert.ok(Math.abs(game._simulationTime - 4) < 1e-8, 'collision safety must not slow active time');
    assert.equal(game.cooldown, 0);
    assert.equal(game.shield, 0);
    assert.ok(Math.abs(game.mana - 86) < 1e-8);
  });
}

test('partial analog input and diagonal movement remain distance-normalized at low frame rates', t => {
  const game = fixture(t, { run: true });
  game._keys.clear(); game._touch = { x: .3, z: .4 };
  advance(game, 2, 9);
  assert.ok(Math.abs(game.position.length() ** 2 - (GROUND_MOTION.runSpeed ** 2 + CHARACTER_GROUND_MOTION.soleY ** 2)) < 1e-7);
  assert.ok(Math.abs(game.position.x / game.position.z - .75) < 1e-8);
});

test('a low-frame-rate run stops before a thin wall and its blocked gait does not keep advancing', t => {
  const game = fixture(t, { run: true });
  game.buildingColliders = [{ id: 'test/thin-wall', bottom: 0, top: 5, planes: [[1, 0, 0, .81], [-1, 0, 0, -.79], [0, 0, 1, 10], [0, 0, -1, 10], [0, 1, 0, 5], [0, -1, 0, 0]] }];
  advance(game, 1, 9);
  assert.ok(game.position.x > .3 && game.position.x < .48);
  assert.equal(queryGroundSupport({ x: game.position.x, z: game.position.z, feetY: 0 }, game._groundWorld()).valid, true);
  const phase = game.locomotion.gaitPhase, position = game.position.clone();
  advance(game, 1, 9);
  assert.deepEqual(game.position, position);
  assert.equal(game.locomotion.gaitPhase, phase);
  assert.equal(game.locomotion.groundSpeed, 0);
});

for (const fps of [60, 15, 9]) test(`boosted flight and projectile lifetimes advance in real time at ${fps} FPS`, t => {
  const game = fixture(t, { mode: 'flying', run: true });
  game.velocity.x = 42;
  const projectile = game._projectiles[0];
  game._launch(projectile, new THREE.Vector3(0, 80, 0), new THREE.Vector3(0, 0, -1), 30, '#ffffff', 1, 0, false);
  advance(game, 1, fps);
  assert.ok(Math.abs(game.position.x - 42) < 1e-8);
  assert.ok(Math.abs(projectile.mesh.position.z + 30) < 1e-8);
  assert.ok(Math.abs(game.cooldown - 2) < 1e-8);
});

test('a delayed frame has a bounded catch-up budget and no debt on later frames', t => {
  const game = fixture(t, { run: true });
  game._tick(21000);
  const caughtUp = game.position.x;
  assert.ok(caughtUp <= GROUND_MOTION.runSpeed * .25 + 1e-8);
  game._tick(21000 + 1000 / 60);
  assert.ok(Math.abs(game.position.x - caughtUp - GROUND_MOTION.runSpeed / 60) < 1e-8);
});

test('reading pauses preserve active state and resumed frames cannot consume the reading interval', t => {
  const game = fixture(t, { run: true });
  advance(game, 1, 9);
  game.setPaused(true);
  const position = game.position.clone(), time = game._simulationTime, mana = game.mana, cooldown = game.cooldown;
  game._tick(15000); game._tick(17000);
  assert.deepEqual(game.position, position);
  assert.equal(game._simulationTime, time); assert.equal(game.mana, mana); assert.equal(game.cooldown, cooldown);
  game.setPaused(false); game.setTouch(1, 0); game.setControl('boost', true);
  game._tick(22000);
  assert.deepEqual(game.position, position, 'the first resumed frame establishes its timestamp');
  game._tick(22000 + 1000 / 9);
  assert.ok(Math.abs(game.position.x - position.x - GROUND_MOTION.runSpeed / 9) < 1e-8);
});

test('a synchronous UI pause during a slow frame stops its remaining simulation steps', t => {
  const game = fixture(t, { run: true });
  let position, time;
  game._updateInteractions = () => {
    if (position) return;
    position = game.position.clone(); time = game._simulationTime;
    game.setPaused(true);
  };
  game._tick(1000 + 1000 / 9);
  assert.deepEqual(game.position, position);
  assert.equal(game._simulationTime, time);
});

for (const suspension of ['hidden', 'context']) test(`${suspension} frames do not advance the active simulation`, t => {
  const game = fixture(t);
  if (suspension === 'hidden') document.hidden = true; else game._contextLost = true;
  game._tick(11000); game._tick(21000);
  assert.equal(game.position.x, 0); assert.equal(game._simulationTime, 0); assert.equal(game.cooldown, 3);
});

for(const fps of [8,30,60])test(`real Game dispatch advances atmosphere by accepted seconds at ${fps} fps and respects all pause gates`,t=>{
  const game=fixture(t),atmosphere=createAtmosphere(game.scene,{heightAt:()=>7,lanternCount:3,fireflyCount:3,birdCount:3});
  game.world.atmosphere=atmosphere;game.world.update=(time,dt,reduced,camera,viewport,context)=>atmosphere.update(time,dt,reduced,context);game.world.releaseLantern=p=>atmosphere.releaseLantern(p);
  t.after(()=>atmosphere.releaseResources());assert.equal(game.releaseLantern(),true);advance(game,2,fps);
  assert.ok(Math.abs(atmosphere.activityTime-2)<1e-8);assert.ok(Math.abs(atmosphere.fauna.motion.released[0].age-2)<1e-8);
  game.setPaused(true);advance(game,5,fps);assert.ok(Math.abs(atmosphere.activityTime-2)<1e-8);assert.equal(game.releaseLantern(),false);
  game.setPaused(false);game._tick(15000);assert.ok(Math.abs(atmosphere.activityTime-2)<1e-8);advance(game,1,fps);assert.ok(Math.abs(atmosphere.activityTime-3)<1e-8);
  game.options.reducedMotion=true;advance(game,2,fps);const held=atmosphere.fauna.snapshot();advance(game,2,fps);assert.deepEqual(atmosphere.fauna.snapshot(),held);
  game.options.reducedMotion=false;game.started=false;advance(game,2,fps);assert.ok(Math.abs(atmosphere.activityTime-3)<1e-8);assert.equal(game.releaseLantern(),false);
  game.started=true;document.hidden=true;advance(game,2,fps);assert.ok(Math.abs(atmosphere.activityTime-3)<1e-8);document.hidden=false;game._contextLost=true;advance(game,2,fps);assert.ok(Math.abs(atmosphere.activityTime-3)<1e-8);
});
