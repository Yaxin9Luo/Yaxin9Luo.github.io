import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/game.js';
import { terrainHeight } from '../src/world.js';
import { locations, ringPositions, crystalPositions, spellDefinitions } from '../src/locations.js';
import { SAVE_KEY, freshProgress } from '../src/logic.js';

// Exercise the actual simulation methods without constructing a WebGL renderer.
// These tests do not establish browser, GPU, rendering, or audible-output quality.
function simulation(t) {
  // The save boundary is the only browser-global stub needed by these methods.
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const saved = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem: (key, value) => saved.set(key, String(value)), getItem: (key) => saved.get(key) ?? null },
  });
  t.after(() => {
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  });
  const game = Object.create(Game.prototype);
  const messages = [];
  const progressEvents = [];
  Object.assign(game, {
    started: true, paused: false, _suspended: false, _contextLost: false, _disposed: false, _combat: false,
    options: { quality: 'balanced', reducedMotion: false, sound: false },
    mana: 100, health: 100, spell: 0, shield: 0, cooldown: 0, race: null,
    _invulnerable: 0, _hitShake: 0, _time: 0, _simulationTime: 0,
    _messageTimes: new Map(), progress: freshProgress(),
    callbacks: { onMessage: (message) => messages.push(message), onProgress: (progress) => progressEvents.push(progress) },
    audio: { play() {}, unlock() {}, setSuspended() {} },
    scene: new THREE.Scene(), position: new THREE.Vector3(0, 8, 15), velocity: new THREE.Vector3(),
    _previous: new THREE.Vector3(), heading: 0,
    _scratch: new THREE.Vector3(), _scratch2: new THREE.Vector3(), _forward: new THREE.Vector3(),
    _projected: new THREE.Vector3(), _castOrigin: new THREE.Vector3(),
    _keys: new Set(), _touch: { x: 0, z: 0 },
    _controls: { up: false, down: false, fire: false, boost: false },
    cameraYaw: .35, _bank: 0, _trailTime: 0, _destination: null,
    // A renderer-backed HUD is outside this simulation harness.
    _emitFrame() {},
  });
  game.camera = new THREE.PerspectiveCamera(43, 1, .15, 1000);
  game.camera.position.set(0, 25, 45);
  game.camera.lookAt(0, 8, 0);
  game.camera.updateMatrixWorld();
  game.wizard = new THREE.Group();
  game.wizard.position.copy(game.position);
  const wandTip = new THREE.Object3D();
  wandTip.position.set(.4, .5, -1.6);
  game.wizard.add(wandTip);
  game.wizard.userData.wandTip = wandTip;
  game.scene.add(game.wizard);
  game.world = {
    wisps: [], crystals: [], portals: [],
    ringMeshes: ringPositions.map((point) => ({ group: { position: new THREE.Vector3(...point) } })),
    setRingState() {},
  };
  game._createEffects();

  t.after(() => {
    const geometries = new Set();
    const materials = new Set();
    game.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    game.scene.clear();
  });
  return { game, messages, progressEvents, saved };
}

test('casting consumes magic only for an allowed, unpaused shot', (t) => {
  const { game } = simulation(t);
  const cost = spellDefinitions[0].cost;
  game.mana = cost - 1;
  assert.equal(game.cast(), false);
  assert.equal(game.mana, cost - 1);
  game.mana = cost;
  assert.equal(game.cast(), true);
  assert.equal(game.mana, 0);
  assert.equal(game._projectiles.filter((projectile) => projectile.active).length, 1);

  game.mana = 100;
  assert.equal(game.cast(), false, 'cooldown prevents a second shot even with enough mana');
  assert.equal(game.mana, 100);
  game.cooldown = 0;
  game.setPaused(true);
  assert.equal(game.cast(), false, 'reading a chapter cannot fire a spell');
  assert.equal(game.mana, 100);
});

test('Protego costs 25 mana and provides four seconds without free refreshes', (t) => {
  const { game } = simulation(t);
  game.mana = 24;
  assert.equal(game.activateShield(), false);
  assert.equal(game.shield, 0);
  game.mana = 25;
  assert.equal(game.activateShield(), true);
  assert.equal(game.mana, 0);
  assert.equal(game.shield, 4);
  assert.equal(game.activateShield(), false);
  assert.equal(game.shield, 4);
  assert.equal(game.mana, 0);
});

test('a fast spell crossing a wisp banishes it and records the victory exactly once', (t) => {
  const { game, progressEvents, saved } = simulation(t);
  const group = new THREE.Group();
  group.position.set(0, 8, 0);
  const wisp = { id: 0, hp: 3, group, home: group.position.clone(), attack: 3, respawn: 0 };
  game.world.wisps = [wisp];
  const projectile = game._projectiles[0];
  // Both endpoints are outside the target: a point-only collision test would miss.
  game._launch(projectile, new THREE.Vector3(0, 8, 6), new THREE.Vector3(0, 0, -1), 100, '#99ff99', 4, 2, false);
  game._updateProjectiles(.12);
  assert.equal(wisp.group.visible, false);
  assert.ok(wisp.respawn > 0, 'a banished enemy can return for another attempt');
  assert.equal(game.progress.banished, 1);
  assert.equal(projectile.active, false);
  game._updateProjectiles(.12);
  assert.equal(game.progress.banished, 1);
  assert.equal(progressEvents.length, 1);
  assert.equal(JSON.parse(saved.get(SAVE_KEY)).banished, 1);
});

test('passive exploration is peaceful until the rider successfully casts a spell', (t) => {
  const { game } = simulation(t);
  const group = new THREE.Group();
  group.position.set(0, 8, 14);
  game.world.wisps = [{ id: 0, hp: 3, group, home: group.position.clone(), attack: 0, respawn: 0 }];
  for (let i = 0; i < 10; i++) game._updateEnemies(.05);
  assert.equal(game.health, 100, 'even a nearby wisp cannot harm a passive visitor');
  assert.equal(game._projectiles.some((projectile) => projectile.active && projectile.enemy), false);
  game.mana = 0;
  assert.equal(game.cast(), false);
  game._updateEnemies(.05);
  assert.equal(game.health, 100, 'an unsuccessful cast does not start a duel');
  assert.equal(game._projectiles.some((projectile) => projectile.active && projectile.enemy), false);
  game.mana = 100;
  assert.equal(game.cast(), true);
  game._updateEnemies(.05);
  assert.equal(game._projectiles.some((projectile) => projectile.active && projectile.enemy), true, 'an explicit cast allows nearby wisps to fight back');
});

test('enemy spells are blocked by Protego and damage an unshielded rider', (t) => {
  const { game } = simulation(t);
  const projectile = game._projectiles[0];
  const shoot = () => {
    game._launch(projectile, new THREE.Vector3(0, 8, 21), new THREE.Vector3(0, 0, -1), 100, '#bca0e8', 12, -1, true);
    game._updateProjectiles(.12);
  };
  game.shield = 4;
  shoot();
  assert.equal(game.health, 100);
  assert.equal(projectile.active, false);
  game.shield = 0;
  shoot();
  assert.equal(game.health, 88);
  shoot();
  assert.equal(game.health, 88, 'the brief recovery interval prevents stacked hits in one instant');
});

test('the broom trial requires ring order and records only completed personal bests', (t) => {
  const { game } = simulation(t);
  game.race = { active: true, index: 0, elapsed: 0, timeLeft: 120 };
  game._previous.set(5, 10, 28);
  game.position.set(5, 10, 24);
  game._updateRace(.1);
  assert.equal(game.race.index, 0, 'crossing the second ring cannot skip the first');
  assert.equal(game.progress.bestTime, null);

  const crossCourse = () => {
    for (const [x, y, z] of ringPositions) {
      game._previous.set(x, y, z + 4);
      game.position.set(x, y, z - 4);
      game._updateRace(.1);
    }
  };
  crossCourse();
  assert.equal(game.race, null);
  assert.ok(game.progress.bestTime > 1 && game.progress.bestTime < 1.2);
  const best = game.progress.bestTime;
  game.race = { active: true, index: 0, elapsed: 20, timeLeft: 100 };
  crossCourse();
  assert.equal(game.progress.bestTime, best, 'a slower completed run preserves the personal best');
});

test('only actual proximity discovers places and swept crystal collection rewards once', (t) => {
  const { game } = simulation(t);
  game.world.portals = locations.map((location) => ({ id: location.id, group: { position: new THREE.Vector3(location.x, location.y + 3.1, location.z + location.radius + 3) } }));
  game.position.set(100, 40, 100);
  game._previous.copy(game.position);
  game._updateInteractions();
  assert.deepEqual(game.progress.visited, []);
  assert.equal(game.nearest, null);

  game.position.set(-48, 7.1, -34);
  game._previous.copy(game.position);
  game._updateInteractions();
  assert.equal(game.nearest, 'research');
  assert.deepEqual(game.progress.visited, ['research']);
  game._updateInteractions();
  assert.deepEqual(game.progress.visited, ['research']);

  const [x, y, z] = crystalPositions[0];
  const crystal = { id: 0, group: new THREE.Group() };
  crystal.group.position.set(x, y, z);
  game.world.crystals = [crystal];
  game.mana = 20;
  game.health = 70;
  game._previous.set(x, y, z + 5);
  game.position.set(x, y, z - 5);
  game._updateInteractions();
  assert.deepEqual(game.progress.crystals, [0]);
  assert.equal(crystal.group.visible, false);
  assert.equal(game.mana, 45);
  assert.equal(game.health, 78);
  game._updateInteractions();
  assert.deepEqual(game.progress.crystals, [0]);
  assert.equal(game.mana, 45);
  assert.equal(game.health, 78);
});

test('flight follows the camera while respecting terrain, ceiling, and buildings', (t) => {
  const { game } = simulation(t);
  game.position.set(9, 8, 48);
  game.cameraYaw = Math.PI / 2;
  game._keys.add('KeyW');
  game._move(.05);
  assert.ok(game.position.x < 9);
  assert.ok(Math.abs(game.position.z - 48) < 1e-9);

  game._clearControls();
  game.position.y = 58;
  game.setControl('up', true);
  game._move(.05);
  assert.equal(game.position.y, 58);
  game._clearControls();
  game.position.y = 0;
  game._move(.05);
  assert.ok(game.position.y >= terrainHeight(game.position.x, game.position.z) + 3.2);

  const academy = locations.find((location) => location.id === 'about');
  game.position.set(academy.x, academy.y + 6, academy.z);
  game._move(.05);
  assert.ok(Math.hypot(game.position.x - academy.x, game.position.z - academy.z) > 5, 'the rider is pushed outside the central building volume');
  assert.ok(Number.isFinite(game.position.x) && Number.isFinite(game.position.z));
});

test('every portfolio destination is immediately reachable and portkeys restore peaceful exploration', (t) => {
  const { game } = simulation(t);
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
  });
  Object.assign(game, {
    canvas: { focus() {} }, renderer: { shadowMap: { needsUpdate: false } },
    zoom: 1, zoomTarget: 1, cameraElevation: .39,
    _cameraGoal: new THREE.Vector3(), _lookGoal: new THREE.Vector3(), _lookAt: new THREE.Vector3(),
  });
  game.world.portals = locations.map((location) => ({
    id: location.id,
    group: { position: new THREE.Vector3(location.x, location.y + 3.1, location.z + location.radius + 3) },
  }));
  const visited = [];
  game.callbacks.onTravel = (id) => visited.push(id);
  game.progress.crystals = [2];
  game.progress.banished = 3;
  game.progress.bestTime = 42;
  game.started = false;
  game.paused = true;
  for (const location of locations) {
    game._combat = true;
    game.race = { active: true, index: 2, elapsed: 12, timeLeft: 108 };
    game._launch(game._projectiles[0], game.position, new THREE.Vector3(1, 0, 0), 15, '#ffffff', 12, -1, true);
    assert.equal(game.travel(location.id), true);
    assert.equal(game.started, true);
    assert.equal(game._isPaused(), false);
    assert.equal(game._combat, false, 'reading destinations must not require an ongoing duel');
    assert.equal(game.race, null);
    assert.equal(game._projectiles.some((projectile) => projectile.active), false, 'old attacks cannot follow through a portkey');
    assert.equal(game.nearest, location.id, 'the selected chapter is interactable immediately after arrival');
    assert.ok(game.progress.visited.includes(location.id));
    assert.ok(game.position.y >= terrainHeight(game.position.x, game.position.z) + 3.2);
    assert.equal(game.velocity.length(), 0);
  }
  assert.deepEqual(visited, locations.map((location) => location.id));
  assert.deepEqual(game.progress.crystals, [2]);
  assert.equal(game.progress.banished, 3);
  assert.equal(game.progress.bestTime, 42);
  const before = game.position.clone();
  assert.equal(game.travel('missing-place'), false);
  assert.deepEqual(game.position, before);
  // Starting a flight trial after dueling must not carry an active fight into
  // the timed course. This occurred during the actual browser playthrough.
  game._combat = true;
  game._launch(game._projectiles[0], game.position, new THREE.Vector3(1, 0, 0), 15, '#ffffff', 12, -1, true);
  game.startRace();
  assert.equal(game._combat, false);
  assert.equal(game._projectiles.some(p=>p.active), false);
  assert.equal(game.race.index, 0);
  assert.equal(game.race.timeLeft, 120);
});

test('closing a paused chapter does not resume stale keyboard, touch, altitude, or click travel input', (t) => {
  const { game } = simulation(t);
  game.position.set(9, 12, 48);
  game._keys.add('KeyW');
  game.setTouch(1, -1);
  game.setControl('up', true);
  game.setControl('boost', true);
  game._move(.05);
  game._destination = new THREE.Vector3(80, 12, 80);
  game.setPaused(true);
  const stopped = game.position.clone();
  game.setTouch(-1, 1);
  game.setControl('up', true);
  assert.equal(game.cast(), false);
  game.setPaused(false);
  game._move(.05);
  assert.deepEqual(game.position, stopped);
  assert.equal(game.velocity.length(), 0);
});

test('unavailable storage preserves playable discoveries and isolates progress callback snapshots', (t) => {
  const { game, progressEvents } = simulation(t);
  globalThis.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
  globalThis.localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  assert.deepEqual(game._loadProgress(), freshProgress());
  assert.equal(game._commit({ type: 'visit', id: 'research' }), true);
  assert.deepEqual(game.progress.visited, ['research']);
  assert.equal(progressEvents.length, 1);
  progressEvents[0].visited.push('contact');
  assert.deepEqual(game.progress.visited, ['research'], 'a UI consumer cannot change the live save by mutating its snapshot');
  assert.equal(game._commit({ type: 'visit', id: 'research' }), false);
});
