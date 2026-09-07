import * as THREE from 'three';
import { createWorld, terrainHeight } from './world.js';
import { createWizard } from './characters.js';
import { locations, ringPositions, spellDefinitions, spawn, worldBounds, bridges } from './locations.js';
import { SAVE_KEY, clamp, damp, parseProgress, freshProgress, progressEvent, movementVector, segmentDistance, canCast } from './logic.js';
import { WorldAudio } from './audio.js';
import { createRendering } from './rendering.js';
import {createShield} from './effects.js';
import {cameraViews,tourStops} from './navigation.js';
import {createBuildingColliders,createBridgeColliders,resolveRiderCollision,shortenCameraBoom} from './collision.js';

const QUALITY = {
  high: { dpr: 1.6, minDpr: .85, shadows: true, mapSize: 2048 },
  balanced: { dpr: 1.25, minDpr: .75, shadows: true, mapSize: 1024 },
  low: { dpr: 1, minDpr: .7, shadows: false, mapSize: 1024 },
};
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyR', 'KeyF', 'Space']);
const ACTION_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'KeyQ', 'KeyE', 'KeyV']);
const PARTICLE_COUNT = 280;
const PROJECTILE_COUNT = 36;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const WATER_LEVEL = -15;
const MIN_FLIGHT_ALTITUDE = WATER_LEVEL + 3.2; // Keep the rider above the lake, including under bridges.
const BUILDING_COLLIDERS=createBuildingColliders(locations).concat(createBridgeColliders(bridges));
const turnDelta = (from, to) => THREE.MathUtils.euclideanModulo(to - from + Math.PI, TAU) - Math.PI;
const copyProgress = (p) => ({ ...p, visited: [...p.visited], crystals: [...p.crystals] });

/** Playable flight, discoveries, dueling, and an ordered broom race. */
export class Game {
  constructor(canvas, callbacks = {}, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('The world needs a canvas.');
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.options = { quality: Object.hasOwn(QUALITY, options.quality) ? options.quality : 'balanced', reducedMotion: Boolean(options.reducedMotion), sound: Boolean(options.sound) };
    this.started = false;
    this.paused = false;
    this.progress = this._loadProgress();
    this.mana = 100;
    this.health = 100;
    this.spell = 0;
    this.shield = 0;
    this.cooldown = 0;
    this.race = null;
    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.velocity = new THREE.Vector3();
    this.heading = .35;
    this.cameraYaw = .35;
    this.cameraElevation = cameraViews.follow.elevation;
    this.cameraDistance = cameraViews.follow.distance;
    this.cameraView = 'follow';
    this._altitudeTarget = null;
    this.tour = null;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.nearest = null;
    this.fps = 60;
    this._time = 0;
    this._simulationTime = 0;
    this._lastFrame = 0;
    this._lastSnapshot = -1;
    this._frameCount = 0;
    this._listeners = [];
    this._disposed = false;
    this._suspended = Boolean(document.hidden);
    this._contextLost = false;
    this._keys = new Set();
    this._controls = { boost: false, up: false, down: false, fire: false };
    this._touch = { x: 0, z: 0 };
    this._pointer = null;
    this._destination = null;
    this._target = null;
    this._invulnerable = 0;
    this._hitShake = 0;
    this._trailTime = 0;
    this._messageTimes = new Map();
    this._performanceTime = 0;
    this._performanceFrames = 0;
    this._bank = 0;
    this._combat = false;
    this._previous = this.position.clone();
    this._forward = new THREE.Vector3();
    this._scratch = new THREE.Vector3();
    this._scratch2 = new THREE.Vector3();
    this._projected = new THREE.Vector3();
    this._cameraGoal = new THREE.Vector3();
    this._lookGoal = new THREE.Vector3();
    this._lookAt = new THREE.Vector3(-18,34,-25);
    this._castOrigin = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();
    this._flightPlane = new THREE.Plane(Y_AXIS, -spawn.y);
    this.audio = new WorldAudio(this.options.sound);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#243f5c');
    this.scene.fog = new THREE.FogExp2('#233f63', .0012);
    this.camera = new THREE.PerspectiveCamera(43, 1, .15, 1250);
    this.camera.position.set(105,58,150);
    this.camera.lookAt(this._lookAt);

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.23;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.shadowMap.autoUpdate = false;
      this._lights();
      this.world = createWorld(this.scene);
      this.wizard = createWizard();
      this.wizard.position.copy(this.position);
      this.wizard.rotation.y = this.heading;
      this.scene.add(this.wizard);
      this._createEffects();
      this._syncDiscoveries();
      this.rendering=createRendering(this.renderer,this.scene,this.camera);
      this.renderer.info.autoReset=false;
      this.world.setRingState(0, false);
      this._applyQuality();
      this._resize();
      this._bindEvents();
      this._tick = this._tick.bind(this);
      this._animation = requestAnimationFrame(this._tick);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight('#8cbfe7', '#45516d', 2.5));
    this.keyLight = new THREE.DirectionalLight('#b8d8ff', 2.7);
    this.keyLight.position.set(-45, 150, -115);
    this.keyLight.target.position.set(0, 3, -17);
    this.keyLight.castShadow = true;
    Object.assign(this.keyLight.shadow.camera, { left: -145, right: 145, top: 150, bottom: -150, near: 1, far: 400 });
    this.keyLight.shadow.bias = -.00015;
    this.keyLight.shadow.normalBias = .24;
    this.keyLight.shadow.radius = 2;
    this.scene.add(this.keyLight, this.keyLight.target);
    const moonlight = new THREE.DirectionalLight('#ffe2be', 1.8);
    moonlight.position.set(60, 80, 100);
    this.scene.add(moonlight);
    // Warm reflected light at the inhabited facades, without lighting every lamp.
    for(const [x,y,z,power] of [[0,20,0,220],[-70,13,18,75],[64,13,48,75]]){
      const light=new THREE.PointLight('#ffb965',power,55,2);light.position.set(x,y,z);this.scene.add(light);
    }
  }

  _createEffects() {
    this.effects = new THREE.Group();
    this.scene.add(this.effects);
    const projectileGeometry = new THREE.SphereGeometry(1, 7, 5);
    this._projectiles = Array.from({ length: PROJECTILE_COUNT }, () => {
      const material = new THREE.MeshBasicMaterial({ color: '#ffe3a6', transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const mesh = new THREE.Mesh(projectileGeometry, material);
      mesh.visible = false;
      mesh.scale.set(.19, .19, .75);
      this.effects.add(mesh);
      return { mesh, active: false, previous: new THREE.Vector3(), direction: new THREE.Vector3(), life: 0, speed: 0, damage: 0, radius: 0, spell: 0, enemy: false, trail: 0 };
    });
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    positions.fill(-10000);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    this._particleMesh = new THREE.Points(geometry, new THREE.ShaderMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,vertexShader:'varying vec3 tint;void main(){tint=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(85./-p.z,1.,10.);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 tint;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(tint*1.7,pow(1.-d*2.,1.6));}'}));
    this._particleMesh.frustumCulled = false;
    this.effects.add(this._particleMesh);
    this._particles = Array.from({ length: PARTICLE_COUNT }, () => ({ life: 0, duration: 1, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }));
    this._particleCursor = 0;
    this._particleColor = new THREE.Color();
    this._shieldMesh = createShield();
    this._shieldMesh.visible = false;
    this.effects.add(this._shieldMesh);
    this._destinationMesh = new THREE.Mesh(new THREE.TorusGeometry(1.4, .06, 5, 32), new THREE.MeshBasicMaterial({ color: '#eed4a0', transparent: true, opacity: .7, toneMapped: false, depthWrite: false }));
    this._destinationMesh.rotation.x = Math.PI / 2;
    this._destinationMesh.visible = false;
    this.effects.add(this._destinationMesh);
    this._targetMesh = new THREE.Mesh(new THREE.TorusGeometry(1.65, .035, 4, 40), new THREE.MeshBasicMaterial({ color: '#f5d4a0', transparent: true, opacity: .75, depthWrite: false, toneMapped: false }));
    this._targetMesh.visible = false;
    this.effects.add(this._targetMesh);
  }

  _listen(target, event, callback, options) {
    target.addEventListener(event, callback, options);
    this._listeners.push(() => target.removeEventListener(event, callback, options));
  }

  _bindEvents() {
    this._previousTouchAction = this.canvas.style.touchAction;
    this.canvas.style.touchAction = 'none';
    this._addedTabIndex = !this.canvas.hasAttribute('tabindex');
    if (this._addedTabIndex) this.canvas.tabIndex = 0;
    this._listen(window, 'keydown', (event) => this._keyDown(event));
    this._listen(window, 'keyup', (event) => {
      this._keys.delete(event.code);
      if (['Space','Enter'].includes(event.code) && event.target?.closest?.('button,a,summary,[role="button"]')) return;
      if (this.started && !this._isPaused() && MOVEMENT_KEYS.has(event.code) && !this._typing(event)) event.preventDefault();
    });
    this._listen(window, 'blur', () => { this._suspended = true; this._clearControls(); this.audio.setSuspended(true); });
    this._listen(window, 'focus', () => { this._suspended = Boolean(document.hidden); this.audio.setSuspended(this._suspended); this._lastFrame = 0; });
    this._listen(document, 'visibilitychange', () => {
      this._suspended = Boolean(document.hidden);
      this._clearControls();
      this.audio.setSuspended(this._suspended);
      this._lastFrame = 0;
    });
    this._listen(this.canvas, 'contextmenu', (event) => event.preventDefault());
    this._listen(this.canvas, 'pointerdown', (event) => this._pointerDown(event));
    this._listen(this.canvas, 'pointermove', (event) => this._pointerMove(event));
    this._listen(this.canvas, 'pointerup', (event) => this._pointerUp(event));
    this._listen(this.canvas, 'pointercancel', () => { this._pointer = null; });
    this._listen(this.canvas, 'wheel', (event) => {
      if (this._isPaused()) return;
      event.preventDefault();
      this.zoomTarget = clamp(this.zoomTarget * Math.exp(event.deltaY * .00065), .6, 2.2);
    }, { passive: false });
    this._listen(this.canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      this._contextLost = true;
      this._clearControls();
      this.audio.setSuspended(true);
      this._message('Graphics paused. Reload to return to the world; your discoveries are saved.', '画面已暂停。刷新页面即可重新进入世界；探索进度已保存。');
    });
    this._listen(this.canvas, 'webglcontextrestored', () => {
      this._contextLost = false;
      this.renderer.shadowMap.needsUpdate = true;
      this.audio.setSuspended(this._suspended);
      this._lastFrame = 0;
    });
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.canvas);
    } else this._listen(window, 'resize', () => this._resize());
  }

  _typing(event) {
    return Boolean(event.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
  }

  _keyDown(event) {
    if (['Space','Enter'].includes(event.code) && event.target?.closest?.('button,a,summary,[role="button"]')) return;
    if (!this.started || this._isPaused() || this._typing(event) || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (!MOVEMENT_KEYS.has(event.code) && !ACTION_KEYS.has(event.code)) return;
    event.preventDefault();
    this.audio.unlock();
    if (MOVEMENT_KEYS.has(event.code)) {
      this._keys.add(event.code);
      if (event.code === 'Space' && !event.repeat) this.cast();
      return;
    }
    if (event.repeat) return;
    if (event.code.startsWith('Digit')) this.selectSpell(Number(event.code.slice(-1)) - 1);
    else if (event.code === 'KeyQ') this.activateShield();
    else if (event.code === 'KeyV') this.setCameraView(Object.keys(cameraViews)[(Object.keys(cameraViews).indexOf(this.cameraView)+1)%3]);
    else if (event.code === 'KeyE') {
      if (this.nearestPaper) this.callbacks.onExhibit?.(this.nearestPaper);
      else if (this.nearest) this.callbacks.onInteract?.(this.nearest);
      else this._message('Approach a glowing gateway to open its research notebook.', '靠近发光的传送门，即可打开对应的研究笔记。', 'interact', 2);
    }
  }

  _pointerDown(event) {
    if (this._isPaused() || (event.button !== 0 && event.button !== 2)) return;
    this.audio.unlock();
    this.canvas.focus({ preventScroll: true });
    this._pointer = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* A canceled pointer needs no capture. */ }
    if (event.button === 2) event.preventDefault();
  }

  _pointerMove(event) {
    const pointer = this._pointer;
    if (!pointer || pointer.id !== event.pointerId || this._isPaused()) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.moved ||= Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointer.button === 2) {
      this.cameraYaw -= dx * .005;
      this.cameraElevation = clamp(this.cameraElevation + dy * .004, -.38, 1.43);
      this.cameraView = 'custom';
    }
  }

  _pointerUp(event) {
    const pointer = this._pointer;
    this._pointer = null;
    if (!pointer || pointer.id !== event.pointerId || pointer.button !== 0 || pointer.moved || !this.started || this._isPaused()) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pointerNDC.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this._raycaster.setFromCamera(this._pointerNDC, this.camera);
    const exhibitHit=this._pickExhibit();
    if(exhibitHit?.object.userData.paper){this.callbacks.onExhibit?.(exhibitHit.object.userData.paper);return;}
    this._flightPlane.constant = -this.position.y;
    if (this._raycaster.ray.intersectPlane(this._flightPlane, this._scratch)) {
      if (this.tour) this.endTour();
      this._destination = new THREE.Vector3(clamp(this._scratch.x, -worldBounds.x+3, worldBounds.x-3), this.position.y, clamp(this._scratch.z, -worldBounds.z+3, worldBounds.z-3));
      this._destinationMesh.position.copy(this._destination);
      this._destinationMesh.position.y = Math.max(terrainHeight(this._destination.x, this._destination.z) + .3, 0);
      this._destinationMesh.visible = true;
    }
  }

  _isPaused() { return this.paused || this._suspended || this._contextLost; }

  _pickExhibit() {
    const hit=this._raycaster.intersectObjects((this.world.exhibits||[]).map(e=>e.group),true).find(h=>h.distance<80);
    if(!hit)return null;
    const blocker=this._raycaster.intersectObjects(this.world.occluders||[],true)[0];
    return blocker&&blocker.distance<hit.distance-.05?null:hit;
  }

  _clearControls() {
    this._keys.clear();
    this._touch.x = 0;
    this._touch.z = 0;
    for (const key of Object.keys(this._controls)) this._controls[key] = false;
    this._pointer = null;
    this._destination = null;
    this._altitudeTarget = null;
    if (this._destinationMesh) this._destinationMesh.visible = false;
    this.velocity.set(0, 0, 0);
  }

  _loadProgress() {
    try { return parseProgress(localStorage.getItem(SAVE_KEY)); } catch { return freshProgress(); }
  }

  _commit(event) {
    const next = progressEvent(this.progress, event);
    if (next.visited.length === this.progress.visited.length && next.crystals.length === this.progress.crystals.length && next.banished === this.progress.banished && next.bestTime === this.progress.bestTime) return false;
    this.progress = next;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { /* In-memory play still works when storage is unavailable. */ }
    this.callbacks.onProgress?.(copyProgress(next));
    return true;
  }

  _syncDiscoveries() {
    this.world.crystals.forEach((crystal) => { crystal.group.visible = !this.progress.crystals.includes(crystal.id); });
  }

  _message(en, zh, key = en, interval = 0) {
    const previous = this._messageTimes.get(key) ?? -Infinity;
    if (this._time - previous < interval) return;
    this._messageTimes.set(key, this._time);
    if (this._messageTimes.size > 64) this._messageTimes.delete(this._messageTimes.keys().next().value);
    this.callbacks.onMessage?.({ en, zh });
  }

  start() {
    if (this._disposed) return;
    const first = !this.started;
    this.started = true;
    this.paused = false;
    this._suspended = Boolean(document.hidden);
    this.audio.setSuspended(this._suspended);
    this.audio.unlock();
    this.canvas.focus({ preventScroll: true });
    if (first) {
      this._message('Your broom is ready. WASD to fly, R/F for height, E at gateways. Your research notebook is always open.', '扫帚已就绪。WASD 飞行，R/F 升降，靠近传送门按 E。研究笔记随时可以阅读。');
      this.callbacks.onProgress?.(copyProgress(this.progress));
    }
    this._emitFrame();
  }

  travel(id) {
    const location = locations.find((item) => item.id === id);
    if (!location || this._disposed) return false;
    this.started = true;
    this.paused = false;
    this._suspended = Boolean(document.hidden);
    this.audio.setSuspended(this._suspended);
    this.audio.unlock();
    this._clearControls();
    this.tour = null;
    this._endRace();
    this._combat = false;
    this._teleport(location.x, location.y + 6, location.z + location.radius + 5);
    this.shield = Math.max(this.shield, 2);
    this.heading = 0;
    this._updateInteractions();
    this.audio.play('travel');
    this._particlesAt(this.position, '#e7ce91', 30, 6, 1);
    this.callbacks.onTravel?.(id);
    this._message(`Portkey: ${location.name.en}`, `门钥匙：${location.name.zh}`);
    this.canvas.focus({ preventScroll: true });
    this._emitFrame();
    return true;
  }

  _teleport(x, y, z) {
    this.position.set(x, Math.max(y, terrainHeight(x, z) + 3.2), z);
    this._previous.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.wizard.position.copy(this.position);
    for (const projectile of this._projectiles) this._retireProjectile(projectile);
    this._updateCamera(1, true);
    this.renderer.shadowMap.needsUpdate = true;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this._clearControls();
    this._lastFrame = 0;
    this._emitFrame();
  }

  setTouch(x, z) {
    if (!this.started || this._isPaused()) return;
    this._touch.x = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
    this._touch.z = Number.isFinite(z) ? clamp(z, -1, 1) : 0;
    if (x || z) this.audio.unlock();
  }

  setControl(name, pressed) {
    if (!Object.hasOwn(this._controls, name)) return;
    if (!pressed) { this._controls[name] = false; return; }
    if (!this.started || this._isPaused()) return;
    this._controls[name] = true;
    this.audio.unlock();
    if (name === 'fire') this.cast();
  }

  changeAltitude(delta) {
    if (!this.started || this._isPaused() || !Number.isFinite(delta)) return false;
    this.tour = null;
    const floor=Math.max(terrainHeight(this.position.x,this.position.z)+3.2,MIN_FLIGHT_ALTITUDE);
    this._altitudeTarget=clamp((this._altitudeTarget??this.position.y)+delta,floor,worldBounds.ceiling);
    this._emitFrame();
    return true;
  }

  setCameraView(view) {
    const preset=cameraViews[view];
    if (!preset) return false;
    this.tour=null;
    this.cameraView=view;
    if(view==='overlook')this.cameraYaw=Math.atan2(140,195);
    this.cameraElevation=preset.elevation;
    this.cameraDistance=preset.distance;
    this.zoomTarget=1;
    this._emitFrame();
    return true;
  }

  tourStop(index=0) {
    if (!Number.isInteger(index) || !tourStops[index] || this._disposed) return false;
    this.start();
    this._clearControls();
    this._endRace();
    this._combat=false;
    const stop=tourStops[index],landmark=locations[index];
    this.cameraYaw=Math.atan2(stop.position[0]-landmark.x,stop.position[2]-landmark.z);
    this.heading=this.cameraYaw;
    this.setCameraView('follow');
    this.tour={index};
    this.cameraElevation=.18;
    this._teleport(...stop.position);
    this._commit({type:'visit',id:stop.id});
    this._emitFrame();
    return true;
  }

  endTour() {this.tour=null;this.setCameraView('follow');}

  releaseLantern() {
    if(!this.started||this._isPaused())return false;
    if(this.world.releaseLantern?.(this.position)){
      this.audio.unlock();this.audio.play('ring');
      this._message('A little light, on its way.', '一盏灯，慢慢飞向夜空。','lantern',3);
      return true;
    }
    return false;
  }

  selectSpell(index) {
    if (!Number.isInteger(index) || index < 0 || index >= spellDefinitions.length) return false;
    this.spell = index;
    this._emitFrame();
    return true;
  }

  cast(index) {
    if (Number.isInteger(index) && !this.selectSpell(index)) return false;
    if (!this.started || this._isPaused()) return false;
    const spell = spellDefinitions[this.spell];
    if (!canCast(this.mana, this.cooldown, spell)) {
      if (this.mana < spell.cost) this._message('Let your magic recover, or collect a crystal to replenish it.', '等待魔力恢复，或收集水晶补充魔力。', 'mana', 3);
      return false;
    }
    const projectile = this._projectiles.find((item) => !item.active);
    if (!projectile) return false;
    this.audio.unlock();
    this.wizard.updateWorldMatrix(true, true);
    if (this.wizard.userData.wandTip) this.wizard.userData.wandTip.getWorldPosition(this._castOrigin);
    else this._castOrigin.copy(this.position).add(this._forward.set(-Math.sin(this.heading), .5, -Math.cos(this.heading)));
    const target = this._findTarget();
    if (target) this._scratch.copy(target.group.position).addScaledVector(Y_AXIS, .35).sub(this._castOrigin).normalize();
    else this._scratch.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this._launch(projectile, this._castOrigin, this._scratch, spell.speed, spell.color, spell.damage, this.spell, false, spell.radius || 0);
    this._combat = true;
    this.mana -= spell.cost;
    this.cooldown = spell.cooldown;
    this.audio.play(spell.id);
    this._particlesAt(this._castOrigin, spell.color, 7, 2, .3);
    this._emitFrame();
    return true;
  }

  activateShield() {
    if (!this.started || this._isPaused() || this.shield > 0) return false;
    if (this.mana < 25) { this._message('Protego needs 25 mana.', '盔甲护身需要 25 点魔力。', 'shield-mana', 3); return false; }
    this.audio.unlock();
    this.mana -= 25;
    this.shield = 4;
    this.audio.play('shield');
    this._particlesAt(this.position, '#b9e7dd', 24, 4, .7);
    this._message('Protego! Four seconds of protection.', '盔甲护身！护盾将持续四秒。', 'shield', 1);
    this._emitFrame();
    return true;
  }

  startRace() {
    if (this._disposed) return;
    this.started = true;
    this.paused = false;
    this._suspended = Boolean(document.hidden);
    this.audio.setSuspended(this._suspended);
    this.audio.unlock();
    this._clearControls();
    this.tour = null;
    this.setCameraView('follow');
    this._combat = false;
    const first = ringPositions[0];
    const next = ringPositions[1];
    this._scratch.set(next[0] - first[0], 0, next[2] - first[2]).normalize();
    this.heading = Math.atan2(-this._scratch.x, -this._scratch.z);
    this.cameraYaw = this.heading;
    this._teleport(first[0] - this._scratch.x * 8, first[1], first[2] - this._scratch.z * 8);
    this.race = { active: true, index: 0, elapsed: 0, timeLeft: 120 };
    this.world.setRingState(0, true);
    this.shield = Math.max(this.shield, 3);
    this._message('Broom trial: pass through all 10 rings in order. Follow the bright ring; R/F overrides height assist.', '扫帚试炼：依次穿过全部 10 个光环。跟随明亮的光环；R/F 可以手动控制高度。');
    this.audio.play('ring');
    this.canvas.focus({ preventScroll: true });
    this._emitFrame();
  }

  cancelRace() {
    if (!this.race) return;
    this._endRace();
    this._message('Trial ended. Start another whenever you like.', '试炼已结束，随时可以再试一次。');
    this._emitFrame();
  }

  _endRace() { this.race = null; this.world.setRingState(0, false); }

  resetProgress() {
    this.progress = freshProgress();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.progress)); } catch { /* Storage is optional. */ }
    this._syncDiscoveries();
    this.world.wisps.forEach((wisp) => { wisp.hp = 3; wisp.respawn = 0; wisp.attack = 3 + wisp.id * .3; wisp.group.visible = true; wisp.group.position.copy(wisp.home); });
    this._endRace();
    this.callbacks.onProgress?.(copyProgress(this.progress));
    this._message('A fresh page. All discoveries and trials are ready again.', '翻开新的一页。所有探索与试炼都已重置。');
    this._emitFrame();
  }

  setOption(key, value) {
    if (key === 'quality' && Object.hasOwn(QUALITY, value)) { this.options.quality = value; this._applyQuality(); }
    else if (key === 'reducedMotion') this.options.reducedMotion = Boolean(value);
    else if (key === 'sound') { this.options.sound = Boolean(value); this.audio.setEnabled(value); if (value) this.audio.unlock(); }
    this._emitFrame();
  }

  _applyQuality() {
    const quality = QUALITY[this.options.quality];
    this._dpr = Math.min(globalThis.devicePixelRatio || 1, quality.dpr);
    this.renderer.setPixelRatio(this._dpr);
    this.rendering?.setQuality(this.options.quality);
    this.rendering?.resize(this._width||1,this._height||1,this._dpr);
    this.renderer.shadowMap.enabled = quality.shadows;
    this.keyLight.castShadow = quality.shadows;
    if (this.keyLight.shadow.mapSize.x !== quality.mapSize) {
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      this.keyLight.shadow.mapSize.set(quality.mapSize, quality.mapSize);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this._performanceFrames = 0;
    this._performanceTime = 0;
  }

  _resize() {
    if (this._disposed || !this.renderer) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.parentElement?.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || this.canvas.parentElement?.clientHeight || 1));
    this._width = width;
    this._height = height;
    this.renderer.setSize(width, height, false);
    this.rendering?.resize(width,height,this._dpr);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  _tick(timestamp) {
    if (this._disposed) return;
    this._animation = requestAnimationFrame(this._tick);
    const rawDt = this._lastFrame ? Math.max(0, (timestamp - this._lastFrame) / 1000) : 1 / 60;
    this._lastFrame = timestamp;
    if (this._contextLost || document.hidden) return;
    const dt = clamp(rawDt, 0, .05);
    this._time += dt;
    this.fps = damp(this.fps, 1 / Math.max(rawDt, .001), 2, dt);
    const playing = this.started && !this._isPaused();
    this.world.update(this._time, dt, this.options.reducedMotion);
    if (playing) {
      this._simulationTime += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.shield = Math.max(0, this.shield - dt);
      this._invulnerable = Math.max(0, this._invulnerable - dt);
      this._hitShake = Math.max(0, this._hitShake - dt);
      this.mana = Math.min(100, this.mana + dt * 9);
      this._move(dt);
      this._updateEnemies(dt);
      this._updateProjectiles(dt);
      this._updateInteractions();
      this._updateRace(dt);
      if (this._controls.fire || this._keys.has('Space')) this.cast();
      this._updateParticles(dt);
    } else if (!this.started) this._idleWisps();
    this._updateWizard(dt, playing);
    this._updateCamera(dt);
    this._target = playing ? this._findTarget() : null;
    this._updateTarget();
    this.audio.update(this._time, playing ? this.velocity.length() : 0);
    if (playing && this._frameCount % 4 === 0) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.reset();
    this.rendering.render(dt);
    this._frameCount++;
    this._adaptPerformance(rawDt, playing);
    if (this._time - this._lastSnapshot >= .1) this._emitFrame();
  }

  _move(dt) {
    this._previous.copy(this.position);
    let x = this._touch.x + Number(this._keys.has('KeyD') || this._keys.has('ArrowRight')) - Number(this._keys.has('KeyA') || this._keys.has('ArrowLeft'));
    let z = this._touch.z + Number(this._keys.has('KeyS') || this._keys.has('ArrowDown')) - Number(this._keys.has('KeyW') || this._keys.has('ArrowUp'));
    const manual = Math.hypot(x, z) > .03;
    if (manual && this.tour) this.tour = null;
    const boost = this._controls.boost || this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    let speed = boost ? 42 : 23;
    let direction = movementVector(x, z, this.cameraYaw);
    if (manual) { this._destination = null; this._destinationMesh.visible = false; }
    else if (this._destination) {
      const distance = Math.hypot(this._destination.x - this.position.x, this._destination.z - this.position.z);
      if (distance < 1.2) { this._destination = null; this._destinationMesh.visible = false; }
      else {
        direction = { x: (this._destination.x - this.position.x) / distance, z: (this._destination.z - this.position.z) / distance };
        speed *= Math.min(1, distance / 6);
      }
    }
    const up = this._controls.up || this._keys.has('KeyR');
    const down = this._controls.down || this._keys.has('KeyF');
    if (up || down) { this._altitudeTarget = null; this.tour = null; }
    let vertical = (Number(up) - Number(down)) * (boost ? 23 : 16);
    if (!up && !down && Number.isFinite(this._altitudeTarget)) {
      vertical = clamp((this._altitudeTarget-this.position.y)*2.1,-16,16);
      if(Math.abs(this._altitudeTarget-this.position.y)<.08){this.position.y=this._altitudeTarget;this.velocity.y=0;vertical=0;this._altitudeTarget=null;}
    }
    if (!up && !down && this._altitudeTarget == null && this.race) {
      const ring = ringPositions[this.race.index];
      if (ring && Math.hypot(ring[0] - this.position.x, ring[2] - this.position.z) < 55) vertical = clamp((ring[1] - this.position.y) * 1.5, -18, 18);
    }
    this.velocity.x = damp(this.velocity.x, direction.x * speed, 4.2, dt);
    this.velocity.z = damp(this.velocity.z, direction.z * speed, 4.2, dt);
    this.velocity.y = damp(this.velocity.y, vertical, 5, dt);
    this.position.addScaledVector(this.velocity, dt);
    this.position.x = clamp(this.position.x, -worldBounds.x, worldBounds.x);
    this.position.z = clamp(this.position.z, -worldBounds.z, worldBounds.z);
    const floor = Math.max(terrainHeight(this.position.x, this.position.z) + 3.2, MIN_FLIGHT_ALTITUDE);
    this.position.y = clamp(this.position.y, floor, worldBounds.ceiling);
    if ((this.position.y <= floor && this.velocity.y < 0) || (this.position.y >= worldBounds.ceiling && this.velocity.y > 0)) this.velocity.y = 0;
    this._avoidBuildings();
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > .35) {
      const angle = Math.atan2(-this.velocity.x, -this.velocity.z);
      const delta = turnDelta(this.heading, angle);
      this.heading += delta * (1 - Math.exp(-7 * dt));
      this._bank = damp(this._bank, clamp(delta * .5, -.27, .27), 6, dt);
    } else this._bank = damp(this._bank, 0, 6, dt);
    this._trailTime += dt;
    if (horizontalSpeed > 4 && this._trailTime > (this.options.quality === 'low' ? .075 : .035)) {
      this._trailTime = 0;
      if (this.wizard.userData.broomTail) this.wizard.userData.broomTail.getWorldPosition(this._scratch);
      else this._scratch.copy(this.position);
      this._particlesAt(this._scratch, boost ? '#c9e8db' : '#e7c886', boost ? 3 : 1, .6, boost ? .8 : .55);
    }
  }

  _avoidBuildings() {
    const hit=resolveRiderCollision(this.position,this.velocity,BUILDING_COLLIDERS);
    this.position.copy(hit.position);this.velocity.copy(hit.velocity);
  }

  _updateWizard(dt, playing) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = playing && !this.options.reducedMotion;
    this.wizard.position.copy(this.position);
    if (!this.options.reducedMotion) this.wizard.position.y += Math.sin(this._time * 2) * .09;
    this.wizard.rotation.set(moving ? -speed * .003 : 0, this.heading, moving ? this._bank : 0);
    const { cape, scarf } = this.wizard.userData;
    if (cape) cape.rotation.x = (cape.userData.restRotationX ?? -.8) + (moving ? Math.sin(this._time * (4 + speed * .1)) * .07 + speed * .003 : 0);
    if (scarf) scarf.rotation.z = moving ? Math.sin(this._time * 4.5) * .12 : 0;
    this._shieldMesh.visible = this.shield > 0 && this.started;
    this._shieldMesh.position.copy(this.position).addScaledVector(Y_AXIS, .5);
    this._shieldMesh.rotation.y = this.options.reducedMotion ? 0 : this._time * .45;
    this._shieldMesh.userData.update(this._time,this.options.reducedMotion,this.shield<1?this.shield*.7:.7);
    if (this._destinationMesh.visible && !this.options.reducedMotion) this._destinationMesh.scale.setScalar(1 + Math.sin(this._time * 4) * .1);
  }

  _updateCamera(dt, immediate = false) {
    this.zoom = damp(this.zoom, this.zoomTarget, 7, dt);
    if (!this.started) {
      const radius = Math.hypot(105,150) * this.zoom;
      const yaw = Math.atan2(105,150) + this.cameraYaw - .35;
      this._cameraGoal.set(Math.sin(yaw) * radius, 58 * this.zoom, Math.cos(yaw) * radius);
      this._lookGoal.set(-18,34,-25);
    } else if(this.cameraView==='overlook'&&!this.tour){
      this._cameraGoal.set(140*this.zoom,175*this.zoom,195*this.zoom);
      this._lookGoal.set(0,16,0);
    } else {
      const portraitTourOffset = this.tour && this.camera.aspect < .8 ? 35 : 0;
      const distance = ((this.cameraDistance || 17) + portraitTourOffset) * this.zoom;
      const horizontal = Math.cos(this.cameraElevation) * distance;
      this._cameraGoal.set(this.position.x + Math.sin(this.cameraYaw) * horizontal, this.position.y + Math.sin(this.cameraElevation) * distance, this.position.z + Math.cos(this.cameraYaw) * horizontal);
      this._cameraGoal.y = Math.max(this._cameraGoal.y, terrainHeight(this._cameraGoal.x, this._cameraGoal.z) + 2.3, WATER_LEVEL + .8);
      this._lookGoal.copy(this.position).addScaledVector(this.velocity, .23);
      this._lookGoal.y += 1.3;
      if(this.tour){const stop=locations[this.tour.index];this._lookGoal.set(stop.x,stop.y+stop.height*.52,stop.z);}
      if (this._hitShake > 0 && !this.options.reducedMotion) this._cameraGoal.x += Math.sin(this._time * 70) * this._hitShake * .45;
      this._scratch.copy(this.position).addScaledVector(Y_AXIS,1.3);
      this._cameraGoal.copy(shortenCameraBoom(this._scratch,this._cameraGoal,BUILDING_COLLIDERS).position);
    }
    const follow = immediate ? 1 : 1 - Math.exp(-4.5 * dt);
    this.camera.position.lerp(this._cameraGoal, follow);
    // Contract the boom immediately at an obstruction; recovering outward still
    // uses the normal smooth follow. The rider is the stable ray origin.
    if(this.started&&(this.cameraView!=='overlook'||this.tour)){
      this._scratch.copy(this.position).addScaledVector(Y_AXIS,1.3);
      this.camera.position.copy(shortenCameraBoom(this._scratch,this.camera.position,BUILDING_COLLIDERS).position);
    }
    this._lookAt.lerp(this._lookGoal, immediate ? 1 : 1 - Math.exp(-7 * dt));
    this.camera.lookAt(this._lookAt);
    this.camera.updateMatrixWorld();
  }

  _idleWisps() {
    this.world.wisps.forEach((wisp) => {
      if (wisp.hp <= 0) return;
      wisp.group.position.copy(wisp.home);
      if (!this.options.reducedMotion) wisp.group.position.y += Math.sin(this._time * 1.8 + wisp.id) * .35;
    });
  }

  _updateEnemies(dt) {
    for (const wisp of this.world.wisps) {
      if (wisp.hp <= 0) {
        wisp.respawn -= dt;
        if (wisp.respawn <= 0) { wisp.hp = 3; wisp.group.visible = true; wisp.group.position.copy(wisp.home); wisp.attack = 3; }
        continue;
      }
      const distance = wisp.group.position.distanceTo(this.position);
      const nearby = distance < 23;
      const angle = nearby ? Math.atan2(this.position.x - wisp.home.x, this.position.z - wisp.home.z) : this._simulationTime * .22 + wisp.id;
      const drift = nearby ? Math.min(3.5, distance * .2) : 1.5;
      wisp.group.position.x = damp(wisp.group.position.x, wisp.home.x + Math.sin(angle) * drift, 1.3, dt);
      wisp.group.position.z = damp(wisp.group.position.z, wisp.home.z + Math.cos(angle) * drift, 1.3, dt);
      wisp.group.position.y = wisp.home.y + (this.options.reducedMotion ? 0 : Math.sin(this._simulationTime * 1.8 + wisp.id) * .4);
      if (nearby) wisp.group.rotation.y = Math.atan2(wisp.group.position.x - this.position.x, wisp.group.position.z - this.position.z);
      wisp.attack -= dt;
      if (this._combat && nearby && distance < 19 && wisp.attack <= 0) {
        wisp.attack = 3.1 + wisp.id * .13;
        const projectile = this._projectiles.find((item) => !item.active);
        if (projectile) {
          this._scratch.copy(this.position).addScaledVector(Y_AXIS, .3).sub(wisp.group.position).normalize();
          this._launch(projectile, wisp.group.position, this._scratch, 15, '#c2a0e9', 12, -1, true);
        }
      }
      if (this._combat && distance < 2.1) this._damagePlayer(8);
    }
  }

  _findTarget() {
    this._forward.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    let result = null;
    let score = Infinity;
    for (const wisp of this.world.wisps) {
      if (wisp.hp <= 0 || !wisp.group.visible) continue;
      this._scratch2.copy(wisp.group.position).sub(this.position);
      const distance = this._scratch2.length();
      if (distance > 36 || distance < .01) continue;
      const alignment = this._scratch2.multiplyScalar(1 / distance).dot(this._forward);
      if (alignment < (distance < 9 ? -.1 : .42)) continue;
      this._projected.copy(wisp.group.position).project(this.camera);
      if (Math.abs(this._projected.x) > 1 || Math.abs(this._projected.y) > 1 || this._projected.z < -1 || this._projected.z > 1) continue;
      const candidate = distance + (1 - alignment) * 12;
      if (candidate < score) { score = candidate; result = wisp; }
    }
    return result;
  }

  _updateTarget() {
    this._targetMesh.visible = Boolean(this._target);
    if (!this._target) return;
    this._targetMesh.position.copy(this._target.group.position).addScaledVector(Y_AXIS, .5);
    this._targetMesh.quaternion.copy(this.camera.quaternion);
    this._targetMesh.scale.setScalar(this.options.reducedMotion ? 1 : 1 + Math.sin(this._time * 3) * .04);
  }

  _launch(projectile, position, direction, speed, color, damage, spell, enemy, radius = 0) {
    projectile.active = true;
    projectile.enemy = enemy;
    projectile.mesh.visible = true;
    projectile.mesh.position.copy(position);
    projectile.previous.copy(position);
    projectile.direction.copy(direction).normalize();
    projectile.mesh.quaternion.setFromUnitVectors(Z_AXIS, projectile.direction);
    projectile.mesh.material.color.set(color);
    projectile.mesh.scale.set(enemy ? .28 : .2, enemy ? .28 : .2, enemy ? .45 : .85);
    projectile.speed = speed;
    projectile.damage = damage;
    projectile.spell = spell;
    projectile.radius = radius;
    projectile.life = enemy ? 2.9 : 1.7;
    projectile.trail = 0;
  }

  _retireProjectile(projectile) { projectile.active = false; projectile.mesh.visible = false; }

  _updateProjectiles(dt) {
    for (const projectile of this._projectiles) {
      if (!projectile.active) continue;
      projectile.previous.copy(projectile.mesh.position);
      projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * dt);
      projectile.life -= dt;
      projectile.trail += dt;
      if (projectile.trail > .055) { projectile.trail = 0; this._particlesAt(projectile.mesh.position, projectile.mesh.material.color, 1, .35, .3); }
      let hit = false;
      if (projectile.enemy) {
        if (segmentDistance(this.position, projectile.previous, projectile.mesh.position) < (this.shield > 0 ? 2.6 : 1.45)) {
          if (this.shield > 0) { this.audio.play('block'); this._particlesAt(projectile.mesh.position, '#b7eee0', 12, 3, .4); }
          else this._damagePlayer(projectile.damage);
          hit = true;
        }
      } else {
        for (const wisp of this.world.wisps) {
          if (wisp.hp <= 0) continue;
          if (segmentDistance(wisp.group.position, projectile.previous, projectile.mesh.position) < 1.65) {
            if (projectile.radius) this._explode(projectile);
            else this._hitWisp(wisp, projectile.damage, projectile.mesh.material.color);
            hit = true;
            break;
          }
        }
      }
      if (!hit && projectile.mesh.position.y < terrainHeight(projectile.mesh.position.x, projectile.mesh.position.z) + .2) hit = true;
      if (projectile.life <= 0 || hit) {
        if (!hit && projectile.radius && !projectile.enemy) this._explode(projectile);
        this._retireProjectile(projectile);
      }
    }
  }

  _explode(projectile) {
    this._particlesAt(projectile.mesh.position, projectile.mesh.material.color, 32, 9, .65);
    for (const wisp of this.world.wisps) if (wisp.hp > 0 && wisp.group.position.distanceTo(projectile.mesh.position) <= projectile.radius) this._hitWisp(wisp, projectile.damage, projectile.mesh.material.color);
  }

  _hitWisp(wisp, damage, color) {
    if (wisp.hp <= 0) return;
    wisp.hp -= damage;
    this._particlesAt(wisp.group.position, color, 13, 4, .55);
    if (wisp.hp > 0) { this.audio.play('hit'); return; }
    wisp.group.visible = false;
    wisp.respawn = 16 + wisp.id;
    this.audio.play('banish');
    this._particlesAt(wisp.group.position, '#e9d2a2', 25, 5, 1.05);
    this._commit({ type: 'banish' });
    if (this.progress.banished === 5) this._message('Five shadows banished. The wards are restored!', '已驱散五只幽影，守护结界恢复了！');
    else this._message(`Shadow banished · ${Math.min(5, this.progress.banished)}/5 for the warding trial.`, `幽影已驱散 · 守护试炼 ${Math.min(5, this.progress.banished)}/5。`, 'banish', .5);
  }

  _damagePlayer(damage) {
    if (this.shield > 0 || this._invulnerable > 0 || !this.started || this._isPaused()) return;
    this.health = Math.max(0, this.health - damage);
    this._invulnerable = 1.2;
    this._hitShake = .28;
    this.audio.play('hurt');
    this._particlesAt(this.position, '#d9b48e', 10, 2, .4);
    if (this.health > 0) { this._message('A shadow found you. Q casts Protego; keep moving!', '幽影击中了你。按 Q 施放护盾，保持移动！', 'hurt', 6); return; }
    this._clearControls();
    this._endRace();
    this._teleport(spawn.x, spawn.y, spawn.z);
    this.health = 100;
    this.mana = 100;
    this.shield = 4;
    this.audio.play('travel');
    this._message('The academy brought you safely home. Health restored; your discoveries are safe.', '学院已将你安全带回。生命恢复，探索进度保留。');
    this.callbacks.onTravel?.('about');
  }

  _updateInteractions() {
    this.nearestPaper=null;
    for(const exhibit of this.world.exhibits||[]){
      if(this.position.distanceTo(this._scratch.copy(exhibit.group.position).addScaledVector(Y_AXIS,4.25))<10){this.nearestPaper=exhibit.id;break;}
    }
    this.nearest = null;
    let nearestDistance = 12;
    for (const portal of this.world.portals) {
      const distance = portal.group.position.distanceTo(this.position);
      if (distance < nearestDistance) { this.nearest = portal.id; nearestDistance = distance; }
    }
    for (const location of locations) {
      const distance = Math.hypot(this.position.x - location.x, this.position.z - location.z);
      if (distance < location.radius + 8 && this.position.y < location.y + 24 && this._commit({ type: 'visit', id: location.id })) {
        this._message(`Discovered: ${location.name.en} · ${this.progress.visited.length}/${locations.length}`, `发现：${location.name.zh} · ${this.progress.visited.length}/${locations.length}`);
        this.audio.play('collect');
      }
    }
    for (const crystal of this.world.crystals) {
      if (!crystal.group.visible || this.progress.crystals.includes(crystal.id)) continue;
      if (segmentDistance(crystal.group.position, this._previous, this.position) < 2.65) {
        crystal.group.visible = false;
        this.mana = Math.min(100, this.mana + 25);
        this.health = Math.min(100, this.health + 8);
        this._particlesAt(crystal.group.position, '#b5eff0', 22, 5, .8);
        this.audio.play('collect');
        this._commit({ type: 'collect', id: crystal.id });
        const count = this.progress.crystals.length;
        this._message(count === 8 ? 'All eight memory crystals found. The constellation is complete!' : `Memory crystal found · ${count}/8. Magic restored.`, count === 8 ? '八枚记忆水晶已集齐，星图完整了！' : `找到记忆水晶 · ${count}/8。魔力已补充。`);
      }
    }
  }

  _updateRace(dt) {
    if (!this.race) return;
    this.race.elapsed += dt;
    this.race.timeLeft = Math.max(0, 120 - this.race.elapsed);
    const ring = this.world.ringMeshes[this.race.index];
    if (ring && segmentDistance(ring.group.position, this._previous, this.position) <= 3.15) {
      this._particlesAt(ring.group.position, '#f6d28b', 20, 5, .7);
      this.audio.play('ring');
      this.race.index++;
      if (this.race.index === ringPositions.length) {
        const time = Math.max(.01, this.race.elapsed);
        const record = this.progress.bestTime === null || time < this.progress.bestTime;
        this._commit({ type: 'race', time });
        this._endRace();
        this.audio.play('race');
        this._message(`Broom trial complete: ${time.toFixed(1)} seconds.${record ? ' A new personal best!' : ''}`, `扫帚试炼完成：${time.toFixed(1)} 秒。${record ? '刷新个人最佳！' : ''}`);
        return;
      }
      this.world.setRingState(this.race.index, true);
      this._message(`Ring ${this.race.index}/${ringPositions.length}. Follow the next golden ring.`, `光环 ${this.race.index}/${ringPositions.length}。继续追寻下一个金色光环。`, 'race-ring', .3);
    }
    if (this.race && this.race.timeLeft <= 0) { this._endRace(); this._message('Time is up. The sky is ready for another attempt.', '时间到了。天空随时等待你的下一次挑战。'); }
  }

  _particlesAt(position, color, count, speed = 3, duration = .7) {
    if (!this._particles) return;
    if (this.options.reducedMotion) count = Math.min(count, 4);
    if (this.options.quality === 'low') count = Math.ceil(count * .6);
    this._particleColor.set(color);
    const positions = this._particleMesh.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const index = this._particleCursor++ % PARTICLE_COUNT;
      const particle = this._particles[index];
      const azimuth = Math.random() * TAU;
      const elevation = Math.random() * 2 - 1;
      const radius = Math.sqrt(1 - elevation * elevation) * speed * (.2 + Math.random() * .8);
      particle.vx = Math.cos(azimuth) * radius;
      particle.vy = elevation * speed + .5;
      particle.vz = Math.sin(azimuth) * radius;
      particle.life = duration;
      particle.duration = duration;
      particle.r = this._particleColor.r;
      particle.g = this._particleColor.g;
      particle.b = this._particleColor.b;
      positions[index * 3] = position.x;
      positions[index * 3 + 1] = position.y;
      positions[index * 3 + 2] = position.z;
    }
  }

  _updateParticles(dt) {
    const positions = this._particleMesh.geometry.attributes.position.array;
    const colors = this._particleMesh.geometry.attributes.color.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = this._particles[i];
      if (particle.life <= 0) continue;
      particle.life -= dt;
      if (particle.life <= 0) { positions[i * 3 + 1] = -10000; colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0; continue; }
      positions[i * 3] += particle.vx * dt;
      positions[i * 3 + 1] += particle.vy * dt;
      positions[i * 3 + 2] += particle.vz * dt;
      particle.vy -= dt * .7;
      const fade = Math.min(1, particle.life / particle.duration * 1.5);
      colors[i * 3] = particle.r * fade;
      colors[i * 3 + 1] = particle.g * fade;
      colors[i * 3 + 2] = particle.b * fade;
    }
    this._particleMesh.geometry.attributes.position.needsUpdate = true;
    this._particleMesh.geometry.attributes.color.needsUpdate = true;
  }

  _adaptPerformance(dt, playing) {
    if (!playing || dt > .15 || dt < .001) return;
    this._performanceTime += dt;
    this._performanceFrames++;
    if (this._performanceTime < 5) return;
    const fps = this._performanceFrames / this._performanceTime;
    const quality = QUALITY[this.options.quality];
    if (fps < 39 && this._dpr > quality.minDpr) {
      this._dpr = Math.max(quality.minDpr, this._dpr - .15);
      this.renderer.setPixelRatio(this._dpr);
      this.rendering?.reduceCost();
      this.rendering?.resize(this._width,this._height,this._dpr);
    }
    this._performanceFrames = 0;
    this._performanceTime = 0;
  }

  _emitFrame() {
    if (this._disposed || !this.renderer || !this.callbacks.onFrame) return;
    this._lastSnapshot = this._time;
    const landmarks = locations.map((location, index) => {
      this._projected.set(location.x, location.y + location.height, location.z).project(this.camera);
      return { id: location.id, x: (this._projected.x + 1) / 2, y: (1 - this._projected.y) / 2, visible: this._projected.z > -1 && this._projected.z < 1 && Math.abs(this._projected.x) < 1 && Math.abs(this._projected.y) < 1 };
    });
    this.callbacks.onFrame({
      cameraView: this.cameraView, altitudeTarget:this._altitudeTarget, tour:this.tour ? {...this.tour} : null,
      started: this.started, paused: this._isPaused(), mana: this.mana, health: this.health,
      spell: this.spell, shield: this.shield, cooldown: this.cooldown,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      nearest: this.started ? this.nearest : null, nearestPaper:this.started?this.nearestPaper:null, progress: copyProgress(this.progress),
      race: this.race ? { ...this.race } : null, speed: Math.hypot(this.velocity.x, this.velocity.z),
      fps: Math.round(this.fps), drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      target: this._target ? `wisp-${this._target.id}` : null, quality: this.options.quality, landmarks,
    });
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    cancelAnimationFrame(this._animation);
    this._resizeObserver?.disconnect();
    this._listeners.forEach((remove) => remove());
    this._listeners.length = 0;
    if (this._previousTouchAction !== undefined) this.canvas.style.touchAction = this._previousTouchAction;
    if (this._addedTabIndex) this.canvas.removeAttribute('tabindex');
    this.audio.dispose();
    this.rendering?.dispose();
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    this.scene?.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const list = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      list.forEach((material) => {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      });
      object.shadow?.dispose?.();
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    this.renderer?.renderLists?.dispose();
    this.renderer?.dispose();
    this.scene?.clear();
    this._projectiles?.splice(0);
    this._particles?.splice(0);
  }
}
