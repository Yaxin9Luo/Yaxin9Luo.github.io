import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/game.js';
import { terrainHeight } from '../src/world.js';
import { locations, ringPositions, crystalPositions, spellDefinitions, worldBounds, bridges } from '../src/locations.js';
import { SAVE_KEY, freshProgress } from '../src/logic.js';
import { EnvironmentClock } from '../src/environment-time.js';
import { createExhibitionStage } from '../src/exhibits.js';

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

function exhibitionSimulation(t, started = true) {
  const { game } = simulation(t);
  Object.assign(game, { started, paused: false, cameraElevation: .35, cameraDistance: 17, cameraView: 'custom', zoom: 1.3, zoomTarget: 1.4, tour: { index: 2 }, _cameraGoal: new THREE.Vector3(), _lookGoal: new THREE.Vector3(), _lookAt: new THREE.Vector3(0, 5, 0) });
  game.exhibitionStage = { projectId: 'autodesign', mediaIndex: 0, group: new THREE.Group(), camera: { position: new THREE.Vector3(62, 20, 82), mobilePosition: new THREE.Vector3(62, 23, 96), target: new THREE.Vector3(62, 14, 55) }, setProject(id) { this.projectId = id; this.mediaIndex = 0; }, setMedia(index) { this.mediaIndex = index; } };
  return game;
}

function exhibitionViewport(t, width, height, headerHeight, toolbarHeight, toolbarBottom) {
  const game=exhibitionSimulation(t), layout={width,height,headerHeight,toolbarHeight,toolbarBottom};
  game.exhibitionStage=createExhibitionStage(game.scene,()=>6);
  t.after(()=>game.exhibitionStage.dispose());
  // CSS pixels, deliberately offset from the window origin. DPR and framebuffer
  // dimensions must not change the space left by these visible DOM rectangles.
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  const header={getBoundingClientRect:()=>rect(31,19,layout.width,layout.headerHeight)};
  const toolbar={getBoundingClientRect:()=>rect(43,19+layout.height-layout.toolbarBottom-layout.toolbarHeight,layout.width-24,layout.toolbarHeight)};
  game.canvas={getBoundingClientRect:()=>rect(31,19,layout.width,layout.height),closest:()=>({querySelector:selector=>selector==='.topbar'?header:selector==='.exhibition-toolbar'?toolbar:null})};
  game.camera.aspect=width/height;game.camera.updateProjectionMatrix();
  return {game,layout,header,toolbar};
}

function assertExhibitionInView(game,layout,header={},toolbar={}) {
  const safe={left:12,right:layout.width-12,top:(header.hidden?0:layout.headerHeight)+12,bottom:layout.height-(toolbar.hidden?0:layout.toolbarHeight+layout.toolbarBottom)-12};
  for(const [part,bounds]of game.exhibitionStage.camera.framingBounds.entries())for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new THREE.Vector3(x,y,z).project(game.camera),px=(p.x+1)*layout.width/2,py=(1-p.y)*layout.height/2;
    assert.ok(p.z>-1&&p.z<1,`part ${part} is inside the camera depth range`);
    assert.ok(px>=safe.left-1e-5&&px<=safe.right+1e-5,`part ${part}: x=${px} must be in [${safe.left}, ${safe.right}]`);
    assert.ok(py>=safe.top-1e-5&&py<=safe.bottom+1e-5,`part ${part}: y=${py} must be in [${safe.top}, ${safe.bottom}]`);
  }
}

for(const [width,height,headerHeight,toolbarHeight,toolbarBottom]of [[1024,576,68,108,16],[756,771,110,158,12],[390,844,110,158,12],[844,390,68,108,16]]){
  test(`the real exhibition title, screen and whole workbench fit below the header and above controls at ${width}×${height}`,t=>{
    const {game,layout}=exhibitionViewport(t,width,height,headerHeight,toolbarHeight,toolbarBottom);
    game.enterExhibit('autodesign');game._updateCamera(1,true);
    assert.equal(game.camera.isPerspectiveCamera,true);
    const stage=game.exhibitionStage.camera,position=width/height<.8?stage.mobilePosition:stage.position;
    assert.ok(game.camera.getWorldDirection(new THREE.Vector3()).distanceTo(stage.target.clone().sub(position).normalize())<1e-8,'the authored viewing direction remains unchanged');
    assertExhibitionInView(game,layout);
  });
}

test('exhibition framing responds smoothly to real overlay changes and restores the original camera after project switches',t=>{
  const {game,layout,header,toolbar}=exhibitionViewport(t,756,771,68,108,12),originalCamera=game.camera.position.clone(),originalProjection=game.camera.projectionMatrix.clone();
  game.enterExhibit('autodesign');game._updateCamera(1,true);
  const before=game.camera.position.clone();
  layout.headerHeight=110;layout.toolbarHeight=190;
  game._updateCamera(1/60);
  assert.ok(game.camera.position.distanceTo(before)>0,'content wrapping changes the goal even without a canvas resize');
  assert.ok(game.camera.position.distanceTo(game._cameraGoal)>0,'the camera retains smooth travel');
  for(let i=0;i<300;i++)game._updateCamera(1/30);
  assertExhibitionInView(game,layout);
  const coveredDistance=game.camera.position.distanceTo(game._lookAt);
  header.hidden=true;toolbar.hidden=true;game._updateCamera(1,true);
  assert.ok(game.camera.position.distanceTo(game._lookAt)<coveredDistance,'hidden overlays do not reserve canvas space');
  assertExhibitionInView(game,layout,header,toolbar);
  header.hidden=false;toolbar.hidden=false;
  game.enterExhibit('dvin');game.setExhibitMedia(0);game._updateCamera(1,true);
  assertExhibitionInView(game,layout);
  game.leaveExhibit();
  assert.deepEqual(game.camera.position,originalCamera);
  assert.deepEqual(game.camera.projectionMatrix,originalProjection,'framing must not leave a projection offset on the flight camera');
});

test('an exhibition restores its original flight pose, camera, tour and cleared controls after reading several projects', t => {
  const game = exhibitionSimulation(t), position = game.position.clone(), camera = game.camera.position.clone(), yaw = game.cameraYaw;
  game._keys.add('KeyW'); game.velocity.set(10, 0, 0);
  assert.equal(game.enterExhibit('autodesign', { mediaIndex: 2 }), true);
  assert.equal(game._isPaused(), true);
  assert.equal(game.paused, false, 'stage rendering remains live while flight is frozen');
  assert.equal(game.exhibition.mediaIndex, 2);
  assert.equal(game.wizard.visible, false);
  game._updateCamera(.5);
  assert.notDeepEqual(game.camera.position.toArray(), camera.toArray());
  game.setPaused(true);
  game.enterExhibit('gamma-mod');
  assert.equal(game.paused, false, 'returning from long-form reading resumes the stage');
  assert.equal(game.leaveExhibit(), true);
  assert.deepEqual(game.position.toArray(), position.toArray());
  assert.deepEqual(game.camera.position.toArray(), camera.toArray());
  assert.equal(game.cameraYaw, yaw);
  assert.equal(game.cameraView, 'custom');
  assert.equal(game.camera.fov, 43);
  assert.deepEqual(game.tour, { index: 2 });
  assert.equal(game.started, true);
  assert.equal(game._keys.size, 0);
  assert.equal(game.velocity.length(), 0);
  assert.equal(game.wizard.visible, true);
});

test('a direct exhibition from the landing page returns to the landing state and handles absent media safely', t => {
  const game = exhibitionSimulation(t, false);
  assert.equal(game.enterExhibit('invalid-project'), false);
  assert.equal(game.started, false);
  game.enterExhibit('llmsurgeon', { mediaIndex: 999 });
  assert.equal(game.exhibition.mediaIndex, 0);
  assert.equal(game.setExhibitMedia(NaN), false);
  game.setExhibitMedia(5); assert.equal(game.exhibition.mediaIndex, 0);
  game.leaveExhibit(); assert.equal(game.started, false);
  assert.equal(game.leaveExhibit(), false);
});

test('ordinary portfolio visits do not activate combat and the real clock control selects a valid next light', t => {
  const game = exhibitionSimulation(t);
  game.options.gameplay = false;
  assert.equal(game.cast(), false); assert.equal(game.activateShield(), false);
  assert.equal(game.mana, 100); assert.equal(game._combat, false);
  game.environmentClock = new EnvironmentClock('night'); game.environment = { label: 'night' };
  const modes = []; game.callbacks.onTimeChange = mode => modes.push(mode);
  game.cycleTime(); assert.equal(game.environmentClock.mode, 'dawn'); assert.deepEqual(modes, ['dawn']);
  game.setOption('timeOfDay', 'noonish'); assert.equal(game.environmentClock.mode, 'dawn');
  const opened = []; game.callbacks.onExhibition = id => opened.push(id);
  game.nearestExhibition = 'autodesign'; game.nearest = 'projects';
  game.interact(); assert.deepEqual(opened, ['autodesign']);
});

test('physical media arrows enter at the requested image and preserve in-stage navigation', t => {
  const game = exhibitionSimulation(t), opened = [];
  game.callbacks.onExhibition = (id, options) => opened.push({ id, ...options });
  game.exhibitionStage.mediaIndex = 2;
  game._stageAction({ action: 'nextMedia' });
  assert.deepEqual(opened.pop(), { id: 'autodesign', mediaIndex: 3 });
  game.exhibitionStage.mediaIndex = 0;
  game._stageAction({ action: 'previousMedia' });
  assert.deepEqual(opened.pop(), { id: 'autodesign', mediaIndex: 0 });
  game.enterExhibit('autodesign', { mediaIndex: 2 });
  game._stageAction({ action: 'nextMedia' });
  assert.equal(game.exhibition.mediaIndex, 3);
  assert.equal(opened.length, 0, 'an existing stage changes its image without another route transition');
  game._stageAction({ action: 'previousMedia' });
  assert.equal(game.exhibition.mediaIndex, 2);
});

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

  const research=locations.find(l=>l.id==='research');
  game.position.set(research.x,research.y+3.1,research.z+research.radius+3);
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
  game.position.y = worldBounds.ceiling;
  game.setControl('up', true);
  game._move(.05);
  assert.equal(game.position.y, worldBounds.ceiling);
  game._clearControls();
  game.position.y = 0;
  game._move(.05);
  assert.ok(game.position.y >= terrainHeight(game.position.x, game.position.z) + 3.2);

  const academy = locations.find((location) => location.id === 'about');
  game.position.set(academy.x, academy.y + 6, academy.z - 15);
  game._move(.05);
  assert.ok(Math.hypot(game.position.x - academy.x, game.position.z - (academy.z-15)) > 3, 'the rider is pushed outside the central building volume');
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

test('clickable altitude targets converge, stack and yield to manual controls', (t) => {
  const {game}=simulation(t);game.position.set(18,30,74);
  assert.equal(game.changeAltitude(12),true);
  assert.equal(game._altitudeTarget,42);
  game.changeAltitude(12);assert.equal(game._altitudeTarget,54);
  for(let i=0;i<300;i++)game._move(1/60);
  assert.ok(Math.abs(game.position.y-54)<.25,'click rise reaches its requested height');
  game.changeAltitude(1000);
  assert.equal(game._altitudeTarget,worldBounds.ceiling);
  game.setControl('down',true);game._move(.05);
  assert.equal(game._altitudeTarget,null,'manual descent takes control immediately');
  game.setPaused(true);assert.equal(game.changeAltitude(12),false);
});

test('view presets support below-rider and overhead cameras without losing terrain clearance', (t) => {
  const {game}=simulation(t);
  Object.assign(game,{zoom:1,zoomTarget:1,_cameraGoal:new THREE.Vector3(),_lookGoal:new THREE.Vector3(),_lookAt:new THREE.Vector3()});
  game.position.set(18,65,74);
  game.setCameraView('low');game._updateCamera(.1,true);
  assert.ok(game.camera.position.y<game.position.y,'low view looks upward from below the rider');
  game.setCameraView('overlook');game._updateCamera(.1,true);
  assert.ok(game.camera.position.y>game.position.y+35,'bird view has meaningful height');
  assert.equal(game.setCameraView('invalid'),false);
  game.position.set(18,10,74);game.setCameraView('low');game._updateCamera(.1,true);
  assert.ok(game.camera.position.y>=terrainHeight(game.camera.position.x,game.camera.position.z)+2.2);
});

test('research book interaction points to the real paper without unlocking gates', (t) => {
  const {game}=simulation(t),group=new THREE.Group();group.position.set(45,6,54);
  game.world.exhibits=[{id:'autodesign',group}];
  game.position.set(45,11,55);game._previous.copy(game.position);game._updateInteractions();
  assert.equal(game.nearestPaper,'autodesign');
  let paper=null;game.callbacks.onExhibit=id=>paper=id;
  game._keyDown({code:'KeyE',preventDefault(){}});assert.equal(paper,'autodesign');
  game.position.set(10,60,70);game._updateInteractions();assert.equal(game.nearestPaper,null);
});

test('all guided tour stops remain independent of race progress and reading pauses cleanly', (t) => {
  const {game}=simulation(t),previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false}});
  t.after(()=>{if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else delete globalThis.document;});
  Object.assign(game,{canvas:{focus(){}},renderer:{shadowMap:{needsUpdate:false}},zoom:1,zoomTarget:1,_cameraGoal:new THREE.Vector3(),_lookGoal:new THREE.Vector3(),_lookAt:new THREE.Vector3()});
  for(let index=0;index<locations.length;index++){
    game._combat=true;game.race={active:true,index:1,elapsed:3,timeLeft:117};
    assert.equal(game.tourStop(index),true);
    assert.equal(game.tour.index,index);assert.equal(game._combat,false);assert.equal(game.race,null);
    assert.ok(game.position.y<worldBounds.ceiling);
    assert.ok(game.progress.visited.includes(locations[index].id));
    game.setPaused(true);assert.equal(game.tour.index,index,'reading retains the current tour stop');
    game.setPaused(false);
  }
  assert.equal(game.tourStop(100),false);assert.equal(game.tour.index,5);
  game.endTour();assert.equal(game.tour,null);assert.equal(game.cameraView,'follow');
});

test('research books cannot be clicked through an intervening wall', t=>{
  const {game}=simulation(t),book=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial()),wall=new THREE.Mesh(new THREE.BoxGeometry(8,8,1),new THREE.MeshBasicMaterial());
  book.position.set(0,4,-12);wall.position.set(0,4,-4);game.scene.add(book,wall);game.scene.updateMatrixWorld(true);
  game.world.exhibits=[{id:'autodesign',group:book}];game.world.occluders=[wall];
  game._raycaster=new THREE.Raycaster(new THREE.Vector3(0,4,0),new THREE.Vector3(0,0,-1));
  assert.equal(game._pickExhibit(),null,'the nearer wall blocks paper interaction');
  wall.position.x=20;wall.updateMatrixWorld();assert.equal(game._pickExhibit()?.object,book,'the unobstructed book remains clickable');
});

test('space on a focused interface button activates the button instead of casting',t=>{
  const {game}=simulation(t);let prevented=false;
  game._keyDown({code:'Space',target:{closest:selector=>selector.includes('button')?{}:null},preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.equal(game.mana,100);assert.equal(game._keys.has('Space'),false);
});

test('choosing a camera exits the tour and applies the same preset used in free flight',t=>{
  const {game}=simulation(t);
  Object.assign(game,{zoom:1,zoomTarget:1,_cameraGoal:new THREE.Vector3(),_lookGoal:new THREE.Vector3(),_lookAt:new THREE.Vector3()});
  game.position.set(54,52,62);game.tour={index:0};
  assert.equal(game.setCameraView('invalid'),false);
  assert.deepEqual(game.tour,{index:0},'an invalid request does not end the tour');
  for(const view of ['overlook','low','follow']) {
    game.tour={index:0};
    assert.equal(game.setCameraView(view),true);
    assert.equal(game.tour,null);
    game._updateCamera(1,true);
    if(view==='overlook')assert.deepEqual(game.camera.position.toArray(),[140,175,195],'the whole-world camera must not become a tour-relative boom');
    else assert.ok(game._lookGoal.distanceTo(game.position)<2,'free-flight views look back at the rider');
  }
});

test('portrait tours widen the landmark framing without changing ordinary follow or desktop views',t=>{
  const {game}=simulation(t);
  Object.assign(game,{zoom:1,zoomTarget:1,cameraDistance:17,cameraElevation:.18,cameraView:'follow',
    _cameraGoal:new THREE.Vector3(),_lookGoal:new THREE.Vector3(),_lookAt:new THREE.Vector3()});
  game.position.set(54,52,62);game.cameraYaw=Math.atan2(54,100);game.tour={index:0};
  game.camera.aspect=16/9;game._updateCamera(1,true);
  assert.ok(Math.abs(game.camera.position.distanceTo(game.position)-17)<1e-8);
  game.camera.aspect=390/844;game._updateCamera(1,true);
  assert.ok(Math.abs(game.camera.position.distanceTo(game.position)-52)<1e-8,'portrait tours add 35m to the boom');
  game.tour=null;game._updateCamera(1,true);
  assert.ok(Math.abs(game.camera.position.distanceTo(game.position)-17)<1e-8,'portrait free flight retains its normal follow distance');
});

test('a valid click-to-fly destination exits the tour, while clicking empty sky retains it',t=>{
  const {game}=simulation(t);
  Object.assign(game,{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},
    _raycaster:new THREE.Raycaster(),_pointerNDC:new THREE.Vector2(),_flightPlane:new THREE.Plane(new THREE.Vector3(0,1,0),0)});
  game.position.set(18,20,74);game.camera.position.set(18,32,89);
  game.camera.lookAt(18,20,64);game.camera.updateMatrixWorld();game.tour={index:0};
  game._pointer={id:1,button:0,moved:false};
  game._pointerUp({pointerId:1,clientX:400,clientY:300});
  assert.ok(game._destination,'the actual camera ray creates a flight destination');
  assert.equal(game.tour,null);assert.equal(game.cameraView,'follow');
  const start=game.position.clone();for(let i=0;i<30;i++)game._move(1/60);
  assert.ok(game.position.distanceTo(start)>1,'click travel still moves the rider');
  game._clearControls();game.tour={index:0};
  game.camera.position.set(18,32,89);game.camera.lookAt(18,60,64);game.camera.updateMatrixWorld();
  game._pointer={id:2,button:0,moved:false};game._pointerUp({pointerId:2,clientX:400,clientY:300});
  assert.equal(game._destination,null);assert.deepEqual(game.tour,{index:0});
});

test('buttons and F descend toward the lake surface, and real movement can cross the contact arch',t=>{
  const {game}=simulation(t);game.position.set(150,2,140);
  game.changeAltitude(-1000);assert.equal(game._altitudeTarget,-11.8);
  for(let i=0;i<360;i++)game._move(1/60);
  assert.ok(Math.abs(game.position.y+11.8)<.1);
  game._keys.add('KeyF');for(let i=0;i<120;i++)game._move(1/60);
  assert.equal(game.position.y,-11.8,'held descent stops 3.2m above the lake');
  game._clearControls();
  const [a,b]=bridges.contact,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const sin=(b[0]-a[0])/length,cos=(b[1]-a[1])/length,cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2;
  game.position.set(cx-cos*6,1.8,cz+sin*6);game.cameraYaw=Math.atan2(sin,cos);game._keys.add('KeyD');
  let crossed=false;
  for(let i=0;i<80;i++) {
    game._move(1/60);
    assert.ok(Math.abs(game.position.y-1.8)<1e-8,'the flight floor must not lift the rider into the arch');
    if((game.position.x-cx)*cos-(game.position.z-cz)*sin>6){crossed=true;break;}
  }
  assert.equal(crossed,true,'both sides of the contact viaduct can be traversed during real movement');
});

test('the low camera remains above water at the new minimum flight altitude',t=>{
  const {game}=simulation(t);
  Object.assign(game,{zoom:1,zoomTarget:1,_cameraGoal:new THREE.Vector3(),_lookGoal:new THREE.Vector3(),_lookAt:new THREE.Vector3()});
  game.position.set(150,-11.8,140);game.setCameraView('low');game._updateCamera(1,true);
  assert.ok(game.camera.position.y>=-14.2-1e-8,'look-up view must not put the camera beneath the lake shader');
  assert.ok(game.camera.position.y<game.position.y,'it still looks upward from below the rider');
});

test('space keyup on focused controls retains native activation but canvas space prevents scrolling',t=>{
  const {game}=simulation(t),listeners=new Map();
  for(const name of ['window','document']) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,value:{}});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});
  }
  game.canvas={style:{},hasAttribute:()=>true};
  game._listen=(target,event,callback)=>listeners.set(event,callback);
  game._bindEvents();
  for(const tag of ['button','a','summary','[role="button"]']) {
    let prevented=false;
    const event={code:'Space',target:{closest:selector=>selector.split(',').includes(tag)?{}:null},preventDefault(){prevented=true;}};
    game._keyDown(event);game._keys.add('Space');listeners.get('keyup')(event);
    assert.equal(prevented,false,`${tag} native keyup default action remains available`);
    assert.equal(game._keys.has('Space'),false,'stale cast state is still released');
  }
  let canvasPrevented=false;
  listeners.get('keyup')({code:'Space',target:{closest:()=>null},preventDefault(){canvasPrevented=true;}});
  assert.equal(canvasPrevented,true);
});
