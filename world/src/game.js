import * as THREE from 'three';
import { createWorld, createNavigationWorld, registerWorldLighting, terrainHeight } from './world.js';
import { createWizard, createWisp, loadWizardAsset, loadWraithAsset, upgradeWizardMaterials, updateCharacter, requestCharacterCast, cancelCharacterCast, resetCharacterMotion, CHARACTER_GROUND_MOTION } from './characters.js';
import { GROUND_MOTION, findSafeLanding, stepGroundMotion, queryGroundSupport } from './ground-motion.js';
import {loadGLTF,mutableGeometry} from './gltf-resource.js';
import {loadLandscapeSurfaces,loadMountainArt,loadNightEnvironment} from './landscape.js';
import {loadArchitectureAssets} from './architecture.js';
import {loadAtmosphereAssets} from './atmosphere.js';
import {loadEnvironmentSignage} from './environment-signage.js';
import {loadBotanicalAssets} from './botanical-cache.js';
import {loadScannedRockAssets,hydrateScannedRocks} from './rock-scans.js';
import { EnvironmentClock, TIME_MODES, TIME_PERIODS, TIME_PHASES } from './environment-time.js';
import {createWandIllumination} from './illumination.js';
import { createExhibitionStage } from './exhibits.js';
import { getProject, projectIds } from './exhibition-content.js';
import { locations, ringPositions, wispPositions, spellDefinitions, spawn, worldBounds, bridges } from './locations.js';
import { SAVE_KEY, clamp, damp, parseProgress, freshProgress, progressEvent, movementVector, segmentDistance, canCast } from './logic.js';
import { WorldAudio } from './audio.js';
import { createRendering } from './rendering.js';
import { QUALITY, renderPixelRatio } from './render-quality.js';
import {createShield,createActionEffects} from './effects.js';
import {cameraViews,tourStops} from './navigation.js';
import {createBuildingColliders,createBridgeColliders,resolveRiderCollision,shortenCameraBoom} from './collision.js';

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyR', 'KeyF', 'Space']);
const ACTION_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'KeyQ', 'KeyE', 'KeyV', 'KeyB', 'KeyL']);
const PARTICLE_COUNT = 280;
const PROJECTILE_COUNT = 36;
const MAX_FRAME_DELTA = .25;
const MAX_SIMULATION_STEP = 1 / 60;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const WATER_LEVEL = -15;
const MIN_FLIGHT_ALTITUDE = WATER_LEVEL + 3.2; // Keep the rider above the lake, including under bridges.
const BUILDING_COLLIDERS=createBuildingColliders(locations).concat(createBridgeColliders(bridges));
const HIGHLANDS = { night: ['#315a67','#506f85','#758c9f'].map(color => new THREE.Color(color)), day: ['#597f77','#75989b','#9aaeb8'].map(color => new THREE.Color(color)) };
const turnDelta = (from, to) => THREE.MathUtils.euclideanModulo(to - from + Math.PI, TAU) - Math.PI;
const copyProgress = (p) => ({ ...p, visited: [...p.visited], crystals: [...p.crystals] });

/** Playable flight, discoveries, dueling, and an ordered broom race. */
export class Game {
  static async createAsync(canvas,callbacks={},options={},context={}){
    const {signal,onProgress=()=>{},deadline=performance.now()+20000}=context;
    signal?.throwIfAborted();
    // Capability detection and all decoding use the one renderer that will display the world.
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    let game;
    try{
      const [,gltf]=await Promise.all([
        loadWizardAsset({...context,variant:'core'}),
        loadGLTF({id:'navigation-terrain',url:'/runtime/navigation-terrain.glb',phase:1},context),
      ]);
      signal?.throwIfAborted();onProgress({phase:'assembling',activeResource:'navigation'});
      gltf.scene.updateMatrixWorld(true);
      const terrain={shore:gltf.scene.userData.shore||[]};
      for(const name of ['ground','cliffs']){
        const mesh=gltf.scene.getObjectByName(name);if(!mesh)throw new Error(`Navigation mesh missing: ${name}`);
        // Meshopt's quantization transform is baked once, retaining original world-space UVs.
        if(!mesh.userData.worldGeometry){mesh.userData.worldGeometry=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);mesh.userData.worldGeometry.userData.sharedAsset=true;}
        terrain[name]=mesh.userData.worldGeometry;
      }
      await new Promise(resolve=>setTimeout(resolve,0));signal?.throwIfAborted();
      game=new Game(canvas,callbacks,options,{renderer,terrain,progressive:true});
      await new Promise((resolve,reject)=>{
        const cancel=()=>{game.dispose();reject(signal.reason);};signal?.addEventListener('abort',cancel,{once:true});
        game._firstFrame=()=>{signal?.removeEventListener('abort',cancel);if(performance.now()>=deadline){game.dispose();const error=new Error('Core render deadline exceeded');error.type='timeout';reject(error);}else resolve();};
      });
      signal?.throwIfAborted();
      onProgress({phase:'first-frame'});
      // Schedule after the readiness promise. Enhancement failures cannot revoke interactivity.
      game._enhancementTimer=setTimeout(()=>game._beginEnhancements(context),0);
      return game;
    }catch(error){if(game)game.dispose();else renderer.dispose();throw error;}
  }

  constructor(canvas, callbacks = {}, options = {}, bootstrap={}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('The world needs a canvas.');
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.options = { quality: Object.hasOwn(QUALITY, options.quality) ? options.quality : 'high', reducedMotion: Boolean(options.reducedMotion), sound: Boolean(options.sound), gameplay: options.gameplay === true, lang: options.lang === 'zh' ? 'zh' : 'en', timeOfDay: TIME_MODES.includes(options.timeOfDay) ? options.timeOfDay : 'auto', musicVolume: options.musicVolume ?? .5, effectsVolume: options.effectsVolume ?? .65 };
    this.environmentClock = new EnvironmentClock(this.options.timeOfDay);
    this.exhibition = null;
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
    this.locomotion = { mode:'flying', progress:0, gaitPhase:0, groundSpeed:0, support:null };
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
    this._pendingCast = null;
    this._boostIntent = false;
    this._raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();
    this._flightPlane = new THREE.Plane(Y_AXIS, -spawn.y);
    this.audio = new WorldAudio(this.options.sound);
    this.audio.setVolumes({ music: this.options.musicVolume, effects: this.options.effectsVolume });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#243f5c');
    this.scene.fog = new THREE.FogExp2('#233f63', .0012);
    this.camera = new THREE.PerspectiveCamera(43, 1, .15, 3600);
    this.camera.position.set(105,58,150);
    this.camera.lookAt(this._lookAt);

    try {
      this.renderer = bootstrap.renderer||new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.23;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.shadowMap.autoUpdate = false;
      this._lights();
      this.world = bootstrap.progressive?createNavigationWorld(this.scene,bootstrap.terrain):createWorld(this.scene);
      this._landscapeLighting = [];
      this.world.root.traverse(object => { if (Number.isInteger(object.material?.userData.backgroundLayer)) this._landscapeLighting.push(object.material); });
      this.buildingColliders = BUILDING_COLLIDERS.concat(this.world.environmentColliders || []);
      this.exhibitionStage = createExhibitionStage(this.scene, terrainHeight, { lang: this.options.lang });
      this.buildingColliders.push(...(this.exhibitionStage.colliders || []));
      // The workshop display occupies the old generic project gateway footprint.
      const projectPortal = this.world.portals.find(portal => portal.id === 'projects');
      if (projectPortal) projectPortal.group.visible = false;
      this.world.occluders.push(this.exhibitionStage.group);
      this.exhibitionStage.group.traverse(object => {
        for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
          const entries = this.world.environmentLighting.emissiveMaterials;
          if (material.emissiveIntensity > 0 && material.emissive?.getHex() > 0 && !entries.some(entry => entry.material === material)) entries.push({ material, baseIntensity: material.emissiveIntensity });
        }
      });
      this.wizard = createWizard();
      this.wizard.position.copy(this.position);
      this.wizard.rotation.y = this.heading;
      this.scene.add(this.wizard);
      this._createEffects();
      this._updateEnvironment(0);
      this._syncDiscoveries();
      this.rendering=createRendering(this.renderer,this.scene,this.camera);
      this.renderer.info.autoReset=false;
      this.world.setRingState(0, false);
      this._applyQuality();
      this._bindEvents();
      this._tick = this._tick.bind(this);
      this._animation = requestAnimationFrame(this._tick);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async _beginEnhancements(context){
    if(this._disposed)return;
    this._enhancementController=new AbortController();const signal=this._enhancementController.signal;
    const options={signal,deadline:performance.now()+90000,attemptId:context.attemptId};
    this._enhancementContext=context;let degraded=false;
    const observe=promise=>promise.then(value=>{if(value===false)degraded=true;return value;},error=>{degraded=true;return null;});
    const tasks=[
      observe(loadLandscapeSurfaces(options)),observe(loadMountainArt(options)),observe(loadArchitectureAssets(options)),
      observe(loadAtmosphereAssets(options)),observe(loadEnvironmentSignage(options)),
      observe(loadWizardAsset(options).then(template=>{if(!signal.aborted)upgradeWizardMaterials(this.wizard,template);})),
      observe((async()=>{
        await loadScannedRockAssets({...options,variant:'preview'});if(signal.aborted)return;
        hydrateScannedRocks(this.world.root);
        const ready=await loadScannedRockAssets({...options,deadline:performance.now()+90000});if(!signal.aborted)hydrateScannedRocks(this.world.root);return ready;
      })()),
    ];
    if(this.environment.night>.05)tasks.push(observe(this._loadNightEnvironment(options)));
    if(this.options.gameplay)tasks.push(observe(this._loadEncounters(options)));
    this.world.priority=id=>{
      if(this._requestedRegion===id)return -10000;
      const location=locations.find(item=>item.id===id);return location?Math.hypot(location.x-this.position.x,location.z-this.position.z):10000;
    };
    tasks.push(observe(this.world.enhance({signal,prepareRegion:async region=>{
      const families=region==='gardens'?[{kind:'silver',seed:154},{kind:'cherry',seed:154}]:region==='vegetation'?[{kind:'pine',seed:168},{kind:'silver',seed:499}]:[{kind:'cherry',seed:881},{kind:'lilac',seed:910}];
      try{
        await loadBotanicalAssets({...options,deadline:performance.now()+90000,families,levels:region==='gardens'?['near']:['near','mid','far']});
        return true;
      }catch(error){signal.throwIfAborted();degraded=true;return false;}
    },onRegion:region=>{
      if(this._disposed)return;
      this._refreshWorldBindings();hydrateScannedRocks(this.world.root);
      context.onProgress?.({phase:'assembly',region:region.region,assemblyMs:region.assemblyMs});
    }})));
    await Promise.all(tasks);
    if(signal.aborted||this._disposed)return;
    this._refreshWorldBindings();
    context.onProgress?.({phase:'enhancements',enhancements:degraded?'degraded':'ready'});
  }

  _refreshWorldBindings(){
    this._landscapeLighting.length=0;
    this.world.root.traverse(object=>{if(Number.isInteger(object.material?.userData.backgroundLayer))this._landscapeLighting.push(object.material);});
    registerWorldLighting(this.world);registerWorldLighting(this.world,this.exhibitionStage.group);
    this.buildingColliders=BUILDING_COLLIDERS.concat(this.world.environmentColliders||[],this.exhibitionStage.colliders||[]);
    this._recoverGroundSupport();
    this._updateEnvironment(0);this._syncDiscoveries();this.renderer.shadowMap.needsUpdate=true;
  }

  _loadNightEnvironment(options={}){
    this._nightAttempted=true;
    if(!this._nightRequest)this._nightRequest=loadNightEnvironment(this.scene,options).catch(error=>{this._nightRequest=null;throw error;});
    return this._nightRequest;
  }

  _loadEncounters(options={}){
    if(this._encountersRequest)return this._encountersRequest;
    this._encountersRequest=loadWraithAsset(options).then(()=>{
      if(this._disposed||options.signal?.aborted)return;
      if(!this.world.wisps.length)wispPositions.forEach((position,id)=>{const group=createWisp();group.position.fromArray(position);this.world.root.add(group);this.world.wisps.push({id,group,home:new THREE.Vector3(...position),hp:3,respawn:0,attack:2+id*.4});});
      this._syncDiscoveries();
    }).catch(error=>{this._encountersRequest=null;throw error;});return this._encountersRequest;
  }

  _lights() {
    this.ambientLight = new THREE.HemisphereLight('#8cbfe7', '#45516d', 2.5);
    this.scene.add(this.ambientLight);
    this.keyLight = new THREE.DirectionalLight('#b8d8ff', 2.7);
    this.keyLight.position.set(-45, 150, -115);
    this.keyLight.target.position.set(0, 3, -17);
    this.keyLight.castShadow = true;
    Object.assign(this.keyLight.shadow.camera, { left: -145, right: 145, top: 150, bottom: -150, near: 1, far: 400 });
    this.keyLight.shadow.bias = -.00015;
    this.keyLight.shadow.normalBias = .055;
    this.keyLight.shadow.radius = 4.5;
    this.scene.add(this.keyLight, this.keyLight.target);
    this.fillLight = new THREE.DirectionalLight('#ffe2be', 1.8);
    this.fillLight.position.set(60, 80, 100);
    this.scene.add(this.fillLight);
    // Castle gate is at world z=-16 and the hall door at z=-35.
    // Place warm washes in front of those facades, beneath the cool roof light.
    this.accentLights = [];
    for(const [x,y,z,power] of [[0,17,-10,320],[0,21,-29,240],[-70,13,18,75],[64,13,48,75]]){
      const light=new THREE.PointLight('#ffb965',power,55,2);light.position.set(x,y,z);this.scene.add(light);
      this.accentLights.push({ light, baseIntensity: power });
    }
  }

  _updateEnvironment(dt) {
    const environment = this.environmentClock.update(dt, { paused: !this.started||this._isPaused(), reducedMotion: this.options.reducedMotion });
    this.environment = environment;
    if(environment.night>.05&&this._enhancementController&&!this._nightAttempted)this._loadNightEnvironment({signal:this._enhancementController.signal,deadline:performance.now()+90000}).catch(()=>{});
    this.scene.background.copy(environment.horizon);
    this.scene.fog.color.copy(environment.fog);
    this.scene.fog.density = environment.fogDensity;
    this.renderer.toneMappingExposure = environment.exposure;
    this.scene.environmentIntensity = .14 + (1 - environment.night) * .08;
    this.ambientLight.color.copy(environment.sky);
    this.ambientLight.groundColor.copy(environment.ground);
    this.ambientLight.intensity = environment.ambientIntensity;
    this.keyLight.color.copy(environment.key);
    this.keyLight.intensity = environment.keyIntensity;
    this.keyLight.shadow.intensity = environment.shadowIntensity;
    this.keyLight.position.copy(this.keyLight.target.position).addScaledVector(environment.lightDirection, 240);
    this.fillLight.color.copy(environment.fill);
    this.fillLight.intensity = environment.fillIntensity;
    this.fillLight.position.set(THREE.MathUtils.lerp(60,-45,environment.night),80,100);
    this.world.atmosphere.setEnvironment(environment);
    for (const material of this._landscapeLighting) {
      const layer = material.userData.backgroundLayer;
      material.uniforms.baseColor.value.copy(HIGHLANDS.day[layer]).lerp(HIGHLANDS.night[layer], environment.night);
      material.uniforms.hazeColor.value.copy(environment.fog);
      material.uniforms.lightDirection.value.copy(environment.lightDirection);
      if(material.uniforms.nightFactor)material.uniforms.nightFactor.value=environment.night;
    }
    const lighting = this.world.environmentLighting;
    for (const { material, baseIntensity } of lighting.emissiveMaterials) material.emissiveIntensity = baseIntensity * (.08 + .92 * environment.night);
    for (const { light, baseIntensity } of [...lighting.lights, ...this.accentLights]) light.intensity = baseIntensity * environment.night;
    for (const { material, uniform, baseValue } of lighting.nightMaterials) material.uniforms[uniform].value = baseValue * environment.night;
    for (const { object, baseOpacity } of lighting.nightObjects) {
      object.visible = environment.night > .02;
      if (object.material?.transparent) object.material.opacity = baseOpacity * environment.night;
    }
    const water = this.world.lake.water.material.uniforms;
    water.sunDirection.value.copy(environment.lightDirection);
    water.sunColor.value.copy(environment.key);
    water.waterColor.value.copy(environment.water);
    if (this._time - (this._lastEnvironmentShadow ?? -1) > .3) {
      this.renderer.shadowMap.needsUpdate = true;
      this._lastEnvironmentShadow = this._time;
    }
    this.audio.setEnvironment({ night: environment.night, reading: Boolean(this.paused || this.exhibition), position: this.position });
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
    this.actionEffects=createActionEffects();this.effects.add(this.actionEffects.group);
    this.illumination=createWandIllumination();this.effects.add(this.illumination.group);
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
    this._watchPixelRatio();
  }

  _watchPixelRatio() {
    this._removeDprListener?.();
    this._removeDprListener = null;
    if (this._disposed || typeof window.matchMedia !== 'function') return;
    // A display move can change native DPR without changing the CSS canvas size.
    // Watch the native ratio, even when the chosen quality caps render sampling.
    const native = globalThis.devicePixelRatio;
    const ratio = Number.isFinite(native) && native > 0 ? native : 1;
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const change = () => {
      if (this._disposed) return;
      this._resize();
      this._watchPixelRatio();
    };
    query.addEventListener('change', change);
    this._removeDprListener = () => query.removeEventListener('change', change);
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
    else if (event.code === 'KeyE') this.interact();
    else if (event.code === 'KeyB') this.toggleBroom();
    else if (event.code === 'KeyL') this.toggleIllumination();
  }

  _pointerDown(event) {
    if (this.paused || this._suspended || this._contextLost || (event.button !== 0 && event.button !== 2)) return;
    this.audio.unlock();
    this.canvas.focus({ preventScroll: true });
    this._pointer = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* A canceled pointer needs no capture. */ }
    if (event.button === 2) event.preventDefault();
  }

  _pointerMove(event) {
    const pointer = this._pointer;
    if (!pointer || pointer.id !== event.pointerId || this.paused || this._suspended || this._contextLost) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.moved ||= Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointer.button === 2 && !this.exhibition) {
      this.cameraYaw -= dx * .005;
      this.cameraElevation = clamp(this.cameraElevation + dy * .004, -.38, 1.43);
      this.cameraView = 'custom';
    }
  }

  _pointerUp(event) {
    const pointer = this._pointer;
    this._pointer = null;
    if (!pointer || pointer.id !== event.pointerId || pointer.button !== 0 || pointer.moved || !this.started || this.paused || this._suspended || this._contextLost) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pointerNDC.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this._raycaster.setFromCamera(this._pointerNDC, this.camera);
    const stageHit = this._pickWorldTarget(this.exhibitionStage?.interactiveTargets || [], 130);
    if (stageHit) { this._stageAction(stageHit.object.userData.exhibition); return; }
    if (this.exhibition) return;
    if (this._pickWorldTarget(this.world.clockTargets || [], 90)) { this.cycleTime(); return; }
    const artifactHit = this._pickWorldTarget(this.world.gardens?.contentTargets || [], 90);
    if (artifactHit) { this._activateArtifact(artifactHit.object.userData.portfolioAction); return; }
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

  _isPaused() { return this.paused || this._suspended || this._contextLost || Boolean(this.exhibition); }

  _pickWorldTarget(targets, range) {
    const hit = this._raycaster.intersectObjects(targets, false).find(item => item.distance < range);
    if (!hit) return null;
    const blocker = this._raycaster.intersectObjects(this.world.occluders || [], true)[0];
    return blocker && blocker.object !== hit.object && blocker.distance < hit.distance - .05 ? null : hit;
  }

  interact() {
    if (!this.started || this._isPaused()) return false;
    if (this.nearestExhibition) this.callbacks.onExhibition?.(this.nearestExhibition);
    else if (this.nearestClock) this.cycleTime();
    else if (this.nearestArtifact) this._activateArtifact(this.nearestArtifact.action);
    else if (this.nearestPaper) this.callbacks.onExhibit?.(this.nearestPaper);
    else if (this.nearest === 'projects') this.callbacks.onExhibition?.('autodesign');
    else if (this.nearest) this.callbacks.onInteract?.(this.nearest);
    else { this._message('Approach an exhibition, a gateway, or the courtyard clock.', '靠近作品展台、传送门或庭院中的星仪时钟。', 'interact', 2); return false; }
    return true;
  }

  _activateArtifact(action) {
    if (!action || (action.kind !== 'cv' && !(action.kind === 'section' && locations.some(location => location.id === action.id)))) return false;
    this.audio.unlock();
    this.audio.play('page');
    this.callbacks.onArtifact?.(action);
    return true;
  }

  cycleTime() {
    const modes = TIME_PERIODS;
    const current = this.environmentClock.mode === 'auto' ? this.environment?.period : this.environmentClock.mode;
    const next = this.environmentClock.mode==='auto'
      ? [...modes].sort((a,b)=>TIME_PHASES[a]-TIME_PHASES[b]).find(mode=>TIME_PHASES[mode]>this.environmentClock.phase+1e-6)||'midnight'
      : modes[(modes.indexOf(current) + 1) % modes.length];
    this.audio.unlock();
    this.jumpToTime(next);
  }

  jumpToTime(period) {
    if(!this.environmentClock.jumpTo(period,this._isPaused()||!this.started||this.options.reducedMotion))return false;
    if(!this._nightRequest)this._nightAttempted=false;
    this.options.timeOfDay='auto';this.audio.play('clock');this._updateEnvironment(0);
    this.callbacks.onTimeChange?.('auto');this._emitFrame();return true;
  }

  toggleIllumination() {
    if(!this.started||this._isPaused()||!this.illumination)return false;
    this.illumination.setEnabled(!this.illumination.getState().enabled,{immediate:this.options.reducedMotion});
    this._emitFrame();return true;
  }

  _stageAction(target) {
    if (!target) return;
    const id = this.exhibition?.projectId || this.exhibitionStage.projectId;
    if (target.action === 'open') {
      if(this.exhibition&&this.callbacks.onExhibitionMedia)this.callbacks.onExhibitionMedia(id);
      else this.callbacks.onExhibition?.(id);
    }
    else if (target.action === 'detail') this.callbacks.onExhibitionDetail?.(id,{section:target.section});
    else if (target.action.endsWith('Project')) {
      const step = target.action === 'nextProject' ? 1 : -1;
      this.callbacks.onExhibition?.(projectIds[(projectIds.indexOf(id) + step + projectIds.length) % projectIds.length]);
    } else if (target.action.endsWith('Media')) {
      const mediaIndex = (this.exhibition?.mediaIndex ?? this.exhibitionStage.mediaIndex) + (target.action === 'nextMedia' ? 1 : -1);
      if (this.exhibition) this.setExhibitMedia(mediaIndex);
      else this.callbacks.onExhibition?.(id, { mediaIndex: clamp(mediaIndex, 0, Math.max(0, getProject(id).media.length - 1)) });
    }
  }

  enterExhibit(projectId, { mediaIndex = 0, source = 'ui' } = {}) {
    const project = getProject(projectId);
    if (!project || this._disposed || !this.exhibitionStage) return false;
    if (!this.exhibition) {
      this._exhibitionReturn = {
        position: this.position.clone(), heading: this.heading, started: this.started, paused: this.paused,
        cameraPosition: this.camera.position.clone(), lookAt: this._lookAt.clone(), fov: this.camera.fov,
        cameraYaw: this.cameraYaw, cameraElevation: this.cameraElevation, cameraDistance: this.cameraDistance,
        cameraView: this.cameraView, zoom: this.zoom, zoomTarget: this.zoomTarget,
        tour: this.tour ? { ...this.tour } : null, source,
      };
    }
    this._clearControls();
    this.started = true;
    this.paused = false;
    this.tour = null;
    this._lastFrame=0;
    this.exhibition = { projectId, mediaIndex: clamp(Number.isInteger(mediaIndex) ? mediaIndex : 0, 0, Math.max(0, project.media.length - 1)) };
    this.exhibitionStage.setProject(projectId);
    this.exhibitionStage.setMedia(this.exhibition.mediaIndex);
    this.exhibitionStage.setOpen?.(true,{reducedMotion:this.options.reducedMotion});
    this.wizard.visible = false;
    this.effects.visible = false;
    this._syncDiscoveries();
    this.audio.unlock();
    this.audio.play('page');
    this._updateCamera(0, this.options.reducedMotion);
    this._emitFrame();
    return true;
  }

  leaveExhibit() {
    if (!this.exhibition) return false;
    const saved = this._exhibitionReturn;
    this.exhibition = null;
    this.exhibitionStage.setOpen?.(false,{reducedMotion:this.options.reducedMotion});
    this._exhibitionReturn = null;
    this._clearControls();
    if (saved) {
      this.position.copy(saved.position);
      this._previous.copy(saved.position);
      for (const key of ['heading', 'started', 'paused', 'cameraYaw', 'cameraElevation', 'cameraDistance', 'cameraView', 'zoom', 'zoomTarget', 'tour']) this[key] = saved[key];
      this.camera.position.copy(saved.cameraPosition);
      this._lookAt.copy(saved.lookAt);
      this.camera.fov = saved.fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this._lookAt);
    }
    this.wizard.visible = true;
    this.effects.visible = true;
    this._syncDiscoveries();
    this._lastFrame = 0;
    this._emitFrame();
    return true;
  }

  setExhibitMedia(index) {
    if (!this.exhibition || !Number.isInteger(index)) return false;
    const project = getProject(this.exhibition.projectId);
    const next = clamp(index, 0, Math.max(0, project.media.length - 1));
    this.exhibition.mediaIndex = next;
    this.exhibitionStage.setMedia(next);
    this.audio.play('page');
    this._emitFrame();
    return true;
  }

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
    this.world.crystals.forEach((crystal) => { crystal.group.visible = this.options.gameplay !== false && !this.exhibition && !this.progress.crystals.includes(crystal.id); });
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
    if (this.exhibition) this.leaveExhibit();
    const first = !this.started;
    this.started = true;
    this.paused = false;
    this._lastFrame=0;
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
    this._requestedRegion = id;
    if (this.exhibition) this.leaveExhibit();
    this.started = true;
    this.paused = false;
    this._lastFrame=0;
    this._suspended = Boolean(document.hidden);
    this.audio.setSuspended(this._suspended);
    this.audio.unlock();
    this._clearControls();
    this.tour = null;
    this._endRace();
    this._combat = false;
    this.actionEffects?.burst(this.position,'#d4c493',2.1,.3);
    this.audio.play('travel-start');
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

  returnHome() {
    if (this._disposed) return false;
    if (this.exhibition) this.leaveExhibit();
    this._clearControls();
    this._endRace();
    this.started = false;
    this.paused = false;
    this._lastFrame=0;
    this.tour = null;
    this._combat = false;
    this._cancelPendingCast();
    this._resetLocomotion();
    this.position.set(spawn.x, spawn.y, spawn.z);
    this._previous.copy(this.position);
    this.heading = .35;
    this.cameraYaw = .35;
    this.cameraView = 'follow';
    this.cameraElevation = cameraViews.follow.elevation;
    this.cameraDistance = cameraViews.follow.distance;
    this.zoom = this.zoomTarget = 1;
    for (const projectile of this._projectiles) this._retireProjectile(projectile);
    this._updateCamera(0, this.options.reducedMotion);
    this._emitFrame();
    return true;
  }

  _teleport(x, y, z) {
    this._cancelPendingCast();
    this._resetLocomotion();
    this.position.set(x, Math.max(y, terrainHeight(x, z) + 3.2), z);
    this._previous.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.wizard.position.copy(this.position);
    this.actionEffects?.burst(this.position,'#e7d2a0',2.4,.8,true);
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
    if(this.locomotion.mode !== 'flying') return false;
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
    if (!this.started || this._isPaused() || this.options.gameplay === false || this._pendingCast) return false;
    if(this.locomotion && !['flying','grounded'].includes(this.locomotion.mode)) return false;
    const spell = spellDefinitions[this.spell];
    if (!canCast(this.mana, this.cooldown, spell)) {
      if (this.mana < spell.cost) this._message('Let your magic recover, or collect a crystal to replenish it.', '等待魔力恢复，或收集水晶补充魔力。', 'mana', 3);
      return false;
    }
    const projectile = this._projectiles.find((item) => !item.active);
    if (!projectile) return false;
    this.audio.unlock();
    const action=requestCharacterCast(this.wizard);
    this.mana-=spell.cost;this.cooldown=spell.cooldown;this._combat=true;
    if(action.accepted){
      this._pendingCast={spell:this.spell,sequence:action.sequence,cost:spell.cost};
      this.actionEffects?.charge(spell.color);this.audio.play('cast-start');this._emitFrame();return true;
    }
    this._releaseSpell(this.spell,projectile);return true;
  }

  _cancelPendingCast(){
    if(this._pendingCast)this.mana=Math.min(100,this.mana+this._pendingCast.cost);
    this._pendingCast=null;cancelCharacterCast(this.wizard);this.actionEffects?.cancel();
  }

  _releaseSpell(index,projectile=this._projectiles.find(item=>!item.active)){
    const spell=spellDefinitions[index];
    if(!projectile){this.mana=Math.min(100,this.mana+spell.cost);this.actionEffects?.cancel();this._emitFrame();return false;}
    this.wizard.updateWorldMatrix(true, true);
    if (this.wizard.userData.wandTip) this.wizard.userData.wandTip.getWorldPosition(this._castOrigin);
    else this._castOrigin.copy(this.position).add(this._forward.set(-Math.sin(this.heading), .5, -Math.cos(this.heading)));
    const target = this._findTarget();
    if (target) this._scratch.copy(target.group.position).addScaledVector(Y_AXIS, .35).sub(this._castOrigin).normalize();
    else this._scratch.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this._launch(projectile, this._castOrigin, this._scratch, spell.speed, spell.color, spell.damage, index, false, spell.radius || 0);
    this.actionEffects?.release();
    this.audio.play(spell.id);
    this._particlesAt(this._castOrigin, spell.color, 7, 2, .3);
    this._emitFrame();
    return true;
  }

  activateShield() {
    if (!this.started || this._isPaused() || this.shield > 0 || this.options.gameplay === false) return false;
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
    if (this.exhibition) this.leaveExhibit();
    this.options.gameplay = true;
    this._syncDiscoveries();
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
    else if (key === 'reducedMotion') {this.options.reducedMotion = Boolean(value);this._lastFrame=0;}
    else if (key === 'sound') { this.options.sound = Boolean(value); this.audio.setEnabled(value); if (value) this.audio.unlock(); }
    else if (key === 'timeOfDay' && this.environmentClock.setMode(value, this._isPaused()||!this.started||this.options.reducedMotion)) {
      this.options.timeOfDay = value;
      // A deliberate time selection retries a failed HDR; ordinary clock ticks
      // keep the previous attempt guard so an outage cannot cause a retry loop.
      if(!this._nightRequest)this._nightAttempted=false;
      this.audio.play('clock');this._updateEnvironment(0);
    }
    else if (['musicVolume', 'effectsVolume'].includes(key) && Number.isFinite(value)) { this.options[key] = clamp(value, 0, 1); this.audio.setVolumes({ music: this.options.musicVolume, effects: this.options.effectsVolume }); }
    else if (key === 'lang' && ['en', 'zh'].includes(value)) { this.options.lang = value; this.exhibitionStage?.setLanguage(value); }
    else if (key === 'gameplay') {
      this.options.gameplay = Boolean(value);
      if(value && this._enhancementController) this._loadEncounters({signal:this._enhancementController.signal,deadline:performance.now()+90000}).catch(()=>{});
      if (!value) { this._cancelPendingCast();this._combat = false; this._endRace(); this.shield = 0; for (const projectile of this._projectiles) this._retireProjectile(projectile); }
      this._syncDiscoveries();
    }
    this._emitFrame();
  }

  _applyQuality() {
    const quality = QUALITY[this.options.quality];
    this.rendering?.setQuality(this.options.quality);
    this.renderer.shadowMap.enabled = quality.shadows;
    this.keyLight.castShadow = quality.shadows;
    if (this.keyLight.shadow.mapSize.x !== quality.mapSize) {
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      this.keyLight.shadow.mapSize.set(quality.mapSize, quality.mapSize);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this._resize();
  }

  _resize() {
    if (this._disposed || !this.renderer) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.parentElement?.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || this.canvas.parentElement?.clientHeight || 1));
    this._width = width;
    this._height = height;
    this._dpr = renderPixelRatio(this.options.quality, width, height, globalThis.devicePixelRatio);
    this.renderer.setPixelRatio(this._dpr);
    this.renderer.setSize(width, height, false);
    this.rendering?.resize(width,height,this._dpr);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  _tick(timestamp) {
    if (this._disposed) return;
    this._animation = requestAnimationFrame(this._tick);
    const rawDt = this._lastFrame ? Math.max(0, (timestamp - this._lastFrame) / 1000) : 0;
    this._lastFrame = timestamp;
    if (this._contextLost || document.hidden) return;
    // Consume ordinary slow frames in full. A small movement delta must not
    // become slow motion; only long stalls are capped, with no catch-up debt.
    const dt = clamp(rawDt, 0, MAX_FRAME_DELTA);
    this.fps = damp(this.fps, 1 / Math.max(rawDt, .001), 2, dt);
    let playing = this.started && !this._isPaused();
    this._updateEnvironment(rawDt);
    const steps = Math.max(1, Math.ceil(dt / MAX_SIMULATION_STEP - 1e-8));
    const stepDt = dt / steps;
    for (let step = 0; step < steps; step++) {
      playing = this.started && !this._isPaused();
      this._time += stepDt;
      if (playing) {
        this._simulationTime += stepDt;
        this.cooldown = Math.max(0, this.cooldown - stepDt);
        this.shield = Math.max(0, this.shield - stepDt);
        this._invulnerable = Math.max(0, this._invulnerable - stepDt);
        this._hitShake = Math.max(0, this._hitShake - stepDt);
        this.mana = Math.min(100, this.mana + stepDt * 9);
        this._move(stepDt);
        this._updateEnemies(stepDt);
        this._updateProjectiles(stepDt);
        this._updateInteractions();
        this._updateRace(stepDt);
        if (this._controls.fire || this._keys.has('Space')) this.cast();
        this._updateParticles(stepDt);
      }
      // Pose events share the movement clock: a charged spell releases at a
      // simulated wand pose and advances only for the remaining substeps.
      this._updateWizard(stepDt, playing);
      for (const wisp of this.world.wisps) updateCharacter(wisp.group, { dt:stepDt, paused:this._isPaused(),speed: playing ? .22 : 0, reducedMotion: this.options.reducedMotion, state: this._combat && wisp.attack < .6 ? 'channel' : 'idle' });
    }
    playing = this.started && !this._isPaused();
    if (!this.started) this._idleWisps();
    this.world.update(this._time, dt, this.options.reducedMotion,this.camera,{width:this.canvas.width,height:this.canvas.height});
    this.exhibitionStage.setFocused?.(Boolean(this.exhibition||this.nearestExhibition),{reducedMotion:this.options.reducedMotion});
    this.exhibitionStage.update(this._time,this._suspended?0:dt,this.options.reducedMotion);
    if(this.exhibitionStage.consumeShadowUpdate?.())this.renderer.shadowMap.needsUpdate=true;
    this._updateCamera(dt);
    this.world.updateVegetation?.(this.camera,{width:this.canvas.width,height:this.canvas.height});
    this.audio.setListener?.(this.camera.position,this.camera.getWorldDirection(this._forward));
    this._target = playing && this.options.gameplay !== false ? this._findTarget() : null;
    this._updateTarget();
    this.audio.update(this._time, playing ? this.velocity.length() : 0);
    if (playing && this._frameCount % 4 === 0) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.reset();
    this.rendering.render(dt);
    this._frameCount++;
    if(this._firstFrame){const ready=this._firstFrame;this._firstFrame=null;ready();}
    if (this._time - this._lastSnapshot >= .1) this._emitFrame();
  }

  _move(dt) {
    if(this.locomotion.mode !== 'flying') { this._moveOnGround(dt); return; }
    this._previous.copy(this.position);
    let x = this._touch.x + Number(this._keys.has('KeyD') || this._keys.has('ArrowRight')) - Number(this._keys.has('KeyA') || this._keys.has('ArrowLeft'));
    let z = this._touch.z + Number(this._keys.has('KeyS') || this._keys.has('ArrowDown')) - Number(this._keys.has('KeyW') || this._keys.has('ArrowUp'));
    const manual = Math.hypot(x, z) > .03;
    if (manual && this.tour) this.tour = null;
    const boost = this._controls.boost || this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    if(boost&&!this._boostIntent)this.audio.play('boost');
    this._boostIntent=boost;
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

  _groundWorld() {
    return {heightAt:this.world.heightAt||terrainHeight,colliders:this.buildingColliders||BUILDING_COLLIDERS,waterLevel:WATER_LEVEL};
  }

  _resetLocomotion() {
    this.locomotion={mode:'flying',progress:0,gaitPhase:0,groundSpeed:0,support:null};
    this._characterCastActive=false;
    resetCharacterMotion(this.wizard,{mode:'flying'});
  }

  toggleBroom() {
    if(!this.started||this._isPaused()||this._pendingCast||this._characterCastActive) return false;
    const state=this.locomotion;
    if(!['flying','grounded'].includes(state.mode))return false;
    if(state.mode==='grounded') {
      if(!this._takeoffClear()){this._message('There is not enough room above you to take off.','上方空间不足，请先走到开阔处。','takeoff',2);return false;}
      state.mode='mounting';state.progress=0;state.originY=this.position.y;
      this.actionEffects?.burst(this.position,'#d0e6cf',1.3,.7);
    } else {
      const support=findSafeLanding(this.position,this._groundWorld());
      if(!support.valid){
        this._message('Find open, level ground before landing.','请先飞到平坦、开阔的地面上方。','landing',2);
        return false;
      }
      state.mode='landing';state.progress=0;state.support=support;
    }
    this._clearControls();this._destination=null;this._destinationMesh.visible=false;
    this._altitudeTarget=null;this.tour=null;this._endRace();this.velocity.set(0,0,0);
    this._emitFrame();return true;
  }

  _moveOnGround(dt) {
    if(this._recoverGroundSupport())return;
    const state=this.locomotion,world=this._groundWorld();
    this._previous.copy(this.position);
    if(state.mode==='landing'){
      const support=findSafeLanding(this.position,world);
      if(!support.valid){this._resetLocomotion();return;}
      state.support=support;
      const target=support.y-CHARACTER_GROUND_MOTION.soleY;
      const nextY=Math.max(target,this.position.y-dt*7);
      const next={x:this.position.x,y:nextY,z:this.position.z};
      const hit=resolveRiderCollision(next,{x:0,y:-7,z:0},world.colliders);
      if(Math.hypot(hit.position.x-next.x,hit.position.y-next.y,hit.position.z-next.z)>.15){
        this._resetLocomotion();this._message('This landing path is obstructed. Move to an open area.','降落路线有遮挡，请移到开阔地面。','landing-path',2);return;
      }
      this.position.y=nextY;this.velocity.set(0,0,0);
      if(Math.abs(nextY-target)<.005){state.mode='dismounting';state.progress=0;state.originY=target;}
      return;
    }
    if(state.mode==='mounting'||state.mode==='dismounting'){
      const mounting=state.mode==='mounting';
      if(mounting&&!this._takeoffClear()){
        this.position.y=state.originY;state.mode='grounded';state.progress=0;state.groundSpeed=0;
        resetCharacterMotion(this.wizard,{mode:'grounded'});this.velocity.set(0,0,0);this._recoverGroundSupport();return;
      }
      state.progress=clamp(state.progress+dt/(mounting?CHARACTER_GROUND_MOTION.mountDuration:CHARACTER_GROUND_MOTION.dismountDuration),0,1);
      if(state.progress>1-1e-8)state.progress=1;
      if(mounting){
        const lift=THREE.MathUtils.smoothstep(state.progress,.42,1);
        this.position.y=THREE.MathUtils.lerp(state.originY,state.support.y+3.2,lift);
      }
      this.velocity.set(0,0,0);
      if(state.progress>=1){
        if(mounting)this._resetLocomotion();
        else{state.mode='grounded';state.groundSpeed=0;state.gaitPhase=0;resetCharacterMotion(this.wizard,{mode:'grounded'});this._message('WASD to walk · Shift to run · B to fly','WASD 行走 · Shift 跑步 · B 召唤扫把','landed',2);}
      }
      return;
    }
    let x=this._touch.x+Number(this._keys.has('KeyD')||this._keys.has('ArrowRight'))-Number(this._keys.has('KeyA')||this._keys.has('ArrowLeft'));
    let z=this._touch.z+Number(this._keys.has('KeyS')||this._keys.has('ArrowDown'))-Number(this._keys.has('KeyW')||this._keys.has('ArrowUp'));
    const manual=Math.hypot(x,z)>.03;
    let direction=movementVector(x,z,this.cameraYaw);
    if(manual){this._destination=null;this._destinationMesh.visible=false;}
    else if(this._destination){
      const distance=Math.hypot(this._destination.x-this.position.x,this._destination.z-this.position.z);
      if(distance<.18){this._destination=null;this._destinationMesh.visible=false;}
      else direction={x:(this._destination.x-this.position.x)/distance,z:(this._destination.z-this.position.z)/distance};
    }
    if(this._characterCastActive||this._pendingCast)direction={x:0,z:0};
    const run=Boolean(this._controls.boost||this._keys.has('ShiftLeft')||this._keys.has('ShiftRight'));
    const step=stepGroundMotion({position:{x:this.position.x,y:this.position.y+CHARACTER_GROUND_MOTION.soleY,z:this.position.z},heading:this.heading}, {...direction,run},dt,world);
    this.position.set(step.position.x,step.position.y-CHARACTER_GROUND_MOTION.soleY,step.position.z);
    this.velocity.set(step.velocity.x,step.velocity.y,step.velocity.z);
    const speed=dt>0?step.distance/dt:0;
    if(speed>.01){
      const running=speed>(GROUND_MOTION.walkSpeed+GROUND_MOTION.runSpeed)/2;
      if(state.groundSpeed<.01)state.gaitPhase=running?CHARACTER_GROUND_MOTION.runContact/2:CHARACTER_GROUND_MOTION.walkContact/2;
      const stride=(running?GROUND_MOTION.runSpeed:GROUND_MOTION.walkSpeed)*(running?CHARACTER_GROUND_MOTION.runCycle:CHARACTER_GROUND_MOTION.walkCycle);
      state.gaitPhase=(state.gaitPhase+step.distance/stride)%1;
      this.heading+=turnDelta(this.heading,step.heading)*(1-Math.exp(-12*dt));
    }
    state.groundSpeed=speed;state.support=step.support;this._bank=0;
    if(step.blocked&&step.distance<.001){this._destination=null;this._destinationMesh.visible=false;}
  }

  _takeoffClear() {
    const support=this.locomotion.support;
    return !!support?.valid&&queryGroundSupport({x:this.position.x,z:this.position.z,feetY:support.y,maxRise:GROUND_MOTION.stepUp,maxDrop:GROUND_MOTION.stepDown,allowSteps:true,radius:1,height:GROUND_MOTION.height+3.2+CHARACTER_GROUND_MOTION.soleY},this._groundWorld()).valid;
  }

  _recoverGroundSupport() {
    const state=this.locomotion;
    if(!state||!['grounded','dismounting'].includes(state.mode))return false;
    const world=this._groundWorld(),feetY=this.position.y+CHARACTER_GROUND_MOTION.soleY;
    const sample=(x,z)=>queryGroundSupport({x,z,feetY,allowSteps:true},world);
    const current=sample(this.position.x,this.position.z);
    if(current.valid){
      state.support=current;
      this.position.y=current.y-CHARACTER_GROUND_MOTION.soleY;
      if(state.mode==='dismounting')state.originY=this.position.y;
      return false;
    }
    // Scenery is installed between frames. Recover the occupied point before
    // movement can settle inside its newly registered collision geometry.
    let destination=null;
    for(let radius=.25;radius<=3&&!destination;radius+=.25){
      const count=Math.max(12,Math.ceil(TAU*radius/.25));
      for(let i=0;i<count;i++){
        const angle=TAU*i/count,x=this.position.x+Math.cos(angle)*radius,z=this.position.z+Math.sin(angle)*radius;
        if(Math.abs(x)>worldBounds.x||Math.abs(z)>worldBounds.z)continue;
        const support=sample(x,z);
        if(support.valid){destination={x,z,support};break;}
      }
    }
    this._clearControls();this._cancelPendingCast();this._characterCastActive=false;this._bank=0;
    if(destination){
      const {x,z,support}=destination;
      this.position.set(x,support.y-CHARACTER_GROUND_MOTION.soleY,z);this._previous.copy(this.position);
      this.locomotion={mode:'grounded',progress:0,gaitPhase:0,groundSpeed:0,support};
      resetCharacterMotion(this.wizard,{mode:'grounded'});this.wizard.position.copy(this.position);
    }else{
      // The normal spawn is the last resort. Raise its flight envelope if an
      // enhancement has also occupied that location; never return embedded.
      const position={x:spawn.x,y:Math.max(spawn.y,terrainHeight(spawn.x,spawn.z)+3.2),z:spawn.z};
      const ceiling=Math.max(position.y,...world.colliders.map(solid=>solid.top+2.01));
      while(position.y<=ceiling&&resolveRiderCollision(position,{x:0,y:0,z:0},world.colliders,{radius:1,halfHeight:2}).collided)position.y+=2;
      this._teleport(position.x,position.y,position.z);
    }
    this._message('Moved to a clear position as the scenery arrived.','场景加载完成，已移到安全位置。','ground-recovery',2);
    this._emitFrame();return true;
  }

  _avoidBuildings() {
    const hit=resolveRiderCollision(this.position,this.velocity,this.buildingColliders || BUILDING_COLLIDERS);
    this.position.copy(hit.position);this.velocity.copy(hit.velocity);
  }

  _updateWizard(dt, playing) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = playing && !this.options.reducedMotion;
    const locomotion=this.locomotion;
    const flying=locomotion.mode==='flying'||locomotion.mode==='landing';
    this.wizard.position.copy(this.position);
    if (flying&&!this.options.reducedMotion&&!this._isPaused()) this.wizard.position.y += Math.sin(this._time * 2) * .09;
    this.wizard.rotation.set(flying&&moving ? -speed * .0015 : 0, this.heading, flying&&moving ? this._bank * .5 : 0);
    const support=locomotion.support;
    const groundSupport=support?.valid?{...support,x:this.position.x,z:this.position.z,heightAt:(x,z)=>{
      const hit=queryGroundSupport({x,z,feetY:support.y,maxRise:.4,maxDrop:.5,radius:.03,allowSteps:true},this._groundWorld());return hit.valid?hit.y:support.y;
    }}:undefined;
    const action=updateCharacter(this.wizard, { dt,paused:this._isPaused(),mode:flying?'flying':locomotion.mode,groundSpeed:playing?locomotion.groundSpeed:0,gaitPhase:locomotion.gaitPhase,transitionProgress:locomotion.progress,groundSupport,boost:playing&&Boolean(this._controls.boost||this._keys.has('ShiftLeft')||this._keys.has('ShiftRight')),speed: playing ? speed / 42 : 0, turn: this._bank / .27, vertical: this.velocity.y / 23, reducedMotion: this.options.reducedMotion });
    this._characterCastActive=Boolean(action?.castActive);
    if(action?.castReleased&&this._pendingCast?.sequence===action.castSequence){const index=this._pendingCast.spell;this._pendingCast=null;this._releaseSpell(index);}
    this.wizard.updateWorldMatrix(true,true);
    this.wizard.userData.wandTip?.getWorldPosition(this._castOrigin);
    this.illumination?.update(dt,this._castOrigin,{paused:this._isPaused(),reducedMotion:this.options.reducedMotion,visible:this.started&&!this.exhibition});
    this.actionEffects?.update(this._isPaused()?0:dt,this._time,this._castOrigin,this.camera,this.options.reducedMotion);
    this._shieldMesh.visible = this.shield > 0 && this.started && !this.exhibition && this.options.gameplay !== false;
    this._shieldMesh.position.copy(this.position).addScaledVector(Y_AXIS, .5);
    this._shieldMesh.rotation.y = this.options.reducedMotion ? 0 : this._time * .45;
    this._shieldMesh.userData.update(this._time,this.options.reducedMotion,this.shield<1?this.shield*.7:.7);
    if (this._destinationMesh.visible && !this.options.reducedMotion) this._destinationMesh.scale.setScalar(1 + Math.sin(this._time * 4) * .1);
  }

  _frameExhibition(stage) {
    const viewport=this.canvas?.getBoundingClientRect?.();
    if (!stage.bounds || stage.bounds.isEmpty() || !viewport?.width || !viewport.height) return;
    const scope=this.canvas.closest?.('.experience') || this.canvas.ownerDocument;
    let top=viewport.top, bottom=viewport.top+viewport.height;
    for (const selector of ['.topbar','.exhibition-toolbar']) {
      const element=scope?.querySelector(selector);
      if (!element || element.hidden) continue;
      const cover=element.getBoundingClientRect(), style=element.ownerDocument?.defaultView?.getComputedStyle(element);
      if (!cover.width || !cover.height || style?.visibility==='hidden' || style?.display==='none') continue;
      if (cover.right<=viewport.left || cover.left>=viewport.left+viewport.width || cover.bottom<=viewport.top || cover.top>=viewport.top+viewport.height) continue;
      if (selector==='.topbar') top=Math.max(top,cover.bottom);
      else bottom=Math.min(bottom,cover.top);
    }
    // CSS pixels reserve the real two-row header and whichever toolbar is
    // currently visible. Neither DPR nor an aspect-ratio breakpoint describes it.
    const padding=12, halfX=1-padding*2/viewport.width;
    const upper=1-2*(top+padding-viewport.top)/viewport.height;
    const lower=1-2*(bottom-padding-viewport.top)/viewport.height;
    const centerY=(upper+lower)/2, halfY=(upper-lower)/2;
    if (halfX<=0 || halfY<=0) return;
    let distance=this._cameraGoal.distanceTo(this._lookGoal);
    const back=this._scratch2.subVectors(this._cameraGoal,this._lookGoal).normalize();
    const right=this._forward.crossVectors(Y_AXIS,back).normalize();
    const up=this._projected.crossVectors(back,right);
    stage.bounds.getCenter(this._lookGoal);
    const tanY=Math.tan(THREE.MathUtils.degToRad(this.camera.getEffectiveFOV())/2), tanX=tanY*this.camera.aspect;
    for (const bounds of stage.framingBounds || [stage.bounds]) {
      for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
        this._scratch.set(x,y,z).sub(this._lookGoal);
        const px=this._scratch.dot(right), py=this._scratch.dot(up), depth=this._scratch.dot(back);
        // Each corner has its own perspective depth: the desk is nearer than
        // the title. This solves the safe-rectangle inequalities for distance.
        distance=Math.max(distance,depth+this.camera.near+1,
          depth+Math.abs(px)/(halfX*tanX),
          depth+Math.abs(py+centerY*depth*tanY)/(halfY*tanY));
      }
    }
    this._lookGoal.addScaledVector(up,-centerY*distance*tanY);
    this._cameraGoal.copy(this._lookGoal).addScaledVector(back,distance);
  }

  _updateCamera(dt, immediate = false) {
    this.zoom = damp(this.zoom, this.zoomTarget, 7, dt);
    const mode=this.locomotion?.mode, progress=this.locomotion?.progress || 0;
    const groundFollow=!this.tour&&(this.cameraView==='follow'||this.cameraView==='custom');
    const groundTarget=groundFollow?(mode==='grounded'?1:mode==='dismounting'?progress:mode==='mounting'?1-progress:0):0;
    this._groundCameraBlend=immediate?groundTarget:damp(this._groundCameraBlend || 0,groundTarget,6,dt);
    if (this.exhibition) {
      const stage = this.exhibitionStage.camera, mobile = this.camera.aspect < .8;
      this._cameraGoal.copy(mobile ? stage.mobilePosition : stage.position);
      this._lookGoal.copy(stage.target);
      const fov = mobile ? (stage.mobileFov || 50) : (stage.fov || 40);
      this.camera.fov = immediate ? fov : damp(this.camera.fov, fov, 5, dt);
      this.camera.updateProjectionMatrix();
      this._frameExhibition(stage);
    } else if (!this.started) {
      const radius = Math.hypot(105,150) * this.zoom;
      const yaw = Math.atan2(105,150) + this.cameraYaw - .35;
      this._cameraGoal.set(Math.sin(yaw) * radius, 58 * this.zoom, Math.cos(yaw) * radius);
      this._lookGoal.set(-18,34,-25);
    } else if(this.cameraView==='overlook'&&!this.tour){
      this._cameraGoal.set(140*this.zoom,175*this.zoom,195*this.zoom);
      this._lookGoal.set(0,16,0);
    } else {
      const portraitTourOffset = this.tour && this.camera.aspect < .8 ? 35 : 0;
      // Walking needs a shoulder-height boom below the blossom canopy. Blend
      // through landing and mounting; a manually orbited elevation stays yours.
      const requestedDistance=(this.cameraDistance || 17)+portraitTourOffset;
      const distance=THREE.MathUtils.lerp(requestedDistance,Math.min(requestedDistance,7.8),this._groundCameraBlend)*this.zoom;
      const elevation=this.cameraView==='follow'?THREE.MathUtils.lerp(this.cameraElevation,.16,this._groundCameraBlend):this.cameraElevation;
      const horizontal = Math.cos(elevation) * distance;
      this._cameraGoal.set(this.position.x + Math.sin(this.cameraYaw) * horizontal, this.position.y + Math.sin(elevation) * distance, this.position.z + Math.cos(this.cameraYaw) * horizontal);
      this._cameraGoal.y = Math.max(this._cameraGoal.y, terrainHeight(this._cameraGoal.x, this._cameraGoal.z) + 2.3, WATER_LEVEL + .8);
      this._lookGoal.copy(this.position).addScaledVector(this.velocity, .23);
      this._lookGoal.y += THREE.MathUtils.lerp(1.3,1.05,this._groundCameraBlend);
      if(this.tour){const stop=locations[this.tour.index];this._lookGoal.set(stop.x,stop.y+stop.height*.52,stop.z);}
      if (this._hitShake > 0 && !this.options.reducedMotion) this._cameraGoal.x += Math.sin(this._time * 70) * this._hitShake * .45;
      this._scratch.copy(this.position).addScaledVector(Y_AXIS,1.3);
      this._cameraGoal.copy(shortenCameraBoom(this._scratch,this._cameraGoal,this.buildingColliders || BUILDING_COLLIDERS).position);
    }
    const follow = immediate ? 1 : 1 - Math.exp(-4.5 * dt);
    this.camera.position.lerp(this._cameraGoal, follow);
    // Contract the boom immediately at an obstruction; recovering outward still
    // uses the normal smooth follow. The rider is the stable ray origin.
    if(this.started&&!this.exhibition&&(this.cameraView!=='overlook'||this.tour)){
      this._scratch.copy(this.position).addScaledVector(Y_AXIS,1.3);
      this.camera.position.copy(shortenCameraBoom(this._scratch,this.camera.position,this.buildingColliders || BUILDING_COLLIDERS).position);
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
    this.actionEffects?.burst(wisp.group.position,color,1.5,.45);
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
    this.nearestExhibition = this.exhibitionStage && this.position.distanceTo(this._scratch.copy(this.exhibitionStage.group.position).add(new THREE.Vector3(0, 5, 8))) < 16 ? this.exhibitionStage.projectId : null;
    this.nearestClock = Boolean(this.world.gardens?.clockPosition && this.position.distanceTo(this.world.gardens.clockPosition) < 12);
    this.nearestArtifact = null;
    let artifactDistance = 10;
    for (const anchor of this.world.gardens?.contentAnchors || []) {
      const distance = this.position.distanceTo(anchor.position);
      if (distance < artifactDistance) { artifactDistance = distance; this.nearestArtifact = { action: anchor.action, label: anchor.label }; }
    }
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

  _emitFrame() {
    if (this._disposed || !this.renderer || !this.callbacks.onFrame) return;
    this._lastSnapshot = this._time;
    const landmarks = locations.map((location, index) => {
      this._projected.set(location.x, location.y + location.height, location.z).project(this.camera);
      return { id: location.id, x: (this._projected.x + 1) / 2, y: (1 - this._projected.y) / 2, visible: this._projected.z > -1 && this._projected.z < 1 && Math.abs(this._projected.x) < 1 && Math.abs(this._projected.y) < 1 };
    });
    this.callbacks.onFrame({
      locomotion:{mode:this.locomotion.mode,progress:this.locomotion.progress},
      cameraView: this.cameraView, altitudeTarget:this._altitudeTarget, tour:this.tour ? {...this.tour} : null,
      exhibition: this.exhibition ? { ...this.exhibition } : null,
      environment:this.environmentClock.getSnapshot({started:this.started,paused:this._isPaused(),reducedMotion:this.options.reducedMotion,pauseReason:this._contextLost?'graphics':this._suspended?'hidden':this.exhibition?'exhibition':this.paused?'reading':null}),
      illumination:{...this.illumination.getState(),available:this.started&&!this._isPaused()},
      audio: { enabled: this.options.sound, status: this.audio.musicStatus, contextState: this.audio.context?.state || 'idle' },
      nearestExhibition: this.started ? this.nearestExhibition : null, nearestClock: this.started && this.nearestClock,
      nearestArtifact: this.started ? this.nearestArtifact : null,
      started: this.started, paused: this._isPaused(), mana: this.mana, health: this.health,
      spell: this.spell, shield: this.shield, cooldown: this.cooldown,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      nearest: this.started ? this.nearest : null, nearestPaper:this.started?this.nearestPaper:null, progress: copyProgress(this.progress),
      race: this.race ? { ...this.race } : null, speed: Math.hypot(this.velocity.x, this.velocity.z),
      fps: Math.round(this.fps), drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      target: this._target ? `wisp-${this._target.id}` : null, quality: this.options.quality, landmarks,
      renderSize: { width: this.canvas.width, height: this.canvas.height, samples: this.rendering.samples },
    });
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    clearTimeout(this._enhancementTimer);this._enhancementController?.abort();
    cancelAnimationFrame(this._animation);
    this._removeDprListener?.();
    this._removeDprListener = null;
    this._resizeObserver?.disconnect();
    this._listeners.forEach((remove) => remove());
    this._listeners.length = 0;
    if (this._previousTouchAction !== undefined) this.canvas.style.touchAction = this._previousTouchAction;
    if (this._addedTabIndex) this.canvas.removeAttribute('tabindex');
    this.audio.dispose();
    this.illumination?.dispose();
    this.exhibitionStage?.dispose();
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
    geometries.forEach((geometry) => {if(!geometry.userData.sharedAsset)geometry.dispose();});
    textures.forEach((texture) => {if(!texture.userData.sharedAsset)texture.dispose();});
    materials.forEach((material) => {if(!material.userData.sharedAsset)material.dispose();});
    this.renderer?.renderLists?.dispose();
    this.renderer?.dispose();
    this.scene?.clear();
    this._projectiles?.splice(0);
    this._particles?.splice(0);
  }
}
