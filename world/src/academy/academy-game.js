import * as THREE from 'three';
import './academy.css';
import terrainURL from './terrain.bin?url';
import {createHeightfield,WATER_LEVEL} from './heightfield.js';
import {TIERS,guessTier,startingTier,createGovernor} from './quality.js';
import {FLIGHT,createFlightState,resetFlight,stepFlight,forwardOf,resolveColliders,clamp,damp,angleDelta,headingTowards} from './flight.js';
import {TRIALS,createRun,stepRun,crossRing,ringPassed,stardustCollected,wispBanished,playerHit,courseStardust,courseRings,
  SAVE_KEY,parseSave,freshSave,recordResult,unlockedTrials,SHARD_COUNT} from './trials.js';
import {createMaterials,buildTerrain,buildPaths,lampSites,scatterTrees,createTrees,addWindSway,createLamps,createGlowPoints,createSky,createRidges,createWater,createShade,COLORS,MOON_DIRECTION} from './scene.js';
import {buildLandmarks,createAnimatedParts,PALETTE} from './landmarks.js';
import {createRider} from './rider.js';
import {createParticles,createWindStreaks,createShake} from './fx.js';
import {createSfx} from './sfx.js';
import {createHud} from './hud.js';
import {locations,crystalPositions,wispPositions,spawn,court} from '../locations.js';
import {tourStops} from '../navigation.js';

const FOG_DENSITY=.0034;
const STEP=1/120;
const MOVEMENT_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space']);
const ACTION_KEYS=new Set(['KeyQ','KeyE','KeyF','KeyT','KeyR','KeyN','KeyX','Enter']);
const SPAWN={x:22,y:21,z:104,heading:.42};
const CAST_COOLDOWN=.3,BOLT_SPEED=88,WISP_BOLT_SPEED=27;
const MAX_PIXELS={low:1.3e6,medium:2.6e6,high:4.4e6};
const say=(lang,en,zh)=>lang==='zh'?zh:en;

function readGPU(){
  try{
    const probe=document.createElement('canvas'),gl=probe.getContext('webgl2')||probe.getContext('webgl');if(!gl)return {renderer:'',webgl:false};
    const info=gl.getExtension('WEBGL_debug_renderer_info'),renderer=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();return {renderer:String(renderer||''),webgl:true};
  }catch{return {renderer:'',webgl:false};}
}

/** Lean Academy: arcade broom flight with timed trials on the original map. */
export class AcademyGame{
  static async createAsync(canvas,callbacks={},options={},context={}){
    const {signal,onProgress=()=>{}}=context;
    signal?.throwIfAborted();
    onProgress({phase:'fetching',activeResource:'academy terrain'});
    const response=await fetch(terrainURL,{signal});
    if(!response.ok){const error=new Error(`Academy terrain ${response.status}`);error.type='http';error.status=response.status;throw error;}
    const raw=new Uint16Array(await response.arrayBuffer());
    signal?.throwIfAborted();
    onProgress({phase:'assembling',activeResource:'academy',receivedBytes:raw.byteLength});
    const game=new AcademyGame(canvas,callbacks,options,{heights:raw});
    try{
      await game._build(signal);
      signal?.throwIfAborted();
      await game._firstFrame();
      signal?.throwIfAborted();
    }catch(error){game.dispose();throw error;}
    onProgress({phase:'first-frame'});
    // The lean scene has no deferred enhancements: report it complete once interactive.
    setTimeout(()=>{if(!game._disposed)onProgress({phase:'enhancements',enhancements:'ready',errors:[]});},0);
    return game;
  }

  constructor(canvas,callbacks={},options={},{heights}){
    if(!canvas?.getContext)throw new Error('The Academy needs a canvas.');
    this.canvas=canvas;this.callbacks=callbacks;
    this.options={quality:options.quality||'auto',reducedMotion:Boolean(options.reducedMotion),sound:Boolean(options.sound),lang:options.lang==='zh'?'zh':'en',
      musicVolume:options.musicVolume??.5,effectsVolume:options.effectsVolume??.65};
    this.hf=createHeightfield(heights);
    this.started=false;this.paused=false;this._suspended=Boolean(document.hidden);this._disposed=false;this._contextLost=false;
    this.mode='intro';this.run=null;this.trial=null;
    this.save=this._loadSave();this._unlocked=unlockedTrials(this.save);
    this.flight=createFlightState(SPAWN);this.hover=true;
    this.keys=new Set();this.touch={x:0,z:0};this.controls={boost:false,fire:false,up:false,down:false};
    this._rollQueued=0;this._castQueued=false;this._castCooldown=0;this._hitStop=0;this._time=0;this._lastFrame=0;
    this._orbit={yaw:0,pitch:0,drag:null,zoom:1};this._listeners=[];this._fps=60;this._frameCount=0;this._lastSnapshot=-1;
    this._prev={x:0,y:0,z:0};this.nearestLocation=null;this.target=null;this._yAxis=new THREE.Vector3(0,1,0);
    this.sfx=createSfx({enabled:this.options.sound,music:this.options.musicVolume,effects:this.options.effectsVolume});
    // Opt-in handle for automated review and benchmarks only.
    if(new URLSearchParams(globalThis.location?.search||'').has('academy-debug'))globalThis.__academy=this;
  }

  // ------------------------------------------------------------ build
  async _build(signal){
    const gpu=readGPU();
    const guess=guessTier({renderer:gpu.renderer,cores:navigator.hardwareConcurrency||8,memory:navigator.deviceMemory||8,mobile:matchMedia?.('(pointer:coarse)').matches});
    this.gpu=gpu.renderer;this.tierId=startingTier(this.options.quality,guess);this.tier=TIERS[this.tierId];
    const timings=this.buildTimings=[];let mark=performance.now();
    const yieldFrame=label=>{const now=performance.now();timings.push([label,+(now-mark).toFixed(1)]);return new Promise(resolve=>setTimeout(()=>{mark=performance.now();resolve();},0));};
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:this.tier.antialias,alpha:false,stencil:false,powerPreference:'high-performance'});
    const r=this.renderer;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;
    r.info.autoReset=true;
    const gl=r.getContext();this._timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');this._gl=gl;this._queries=[];
    this.governor=createGovernor({usesInterval:!this._timer});

    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(COLORS.fog,FOG_DENSITY);this.scene.background=COLORS.fog.clone();
    this.camera=new THREE.PerspectiveCamera(62,1,.3,2400);
    this.scene.add(new THREE.HemisphereLight(COLORS.hemiSky,COLORS.hemiGround,1.35));
    const moon=new THREE.DirectionalLight(COLORS.moonLight,1.55);moon.position.copy(MOON_DIRECTION).multiplyScalar(300);this.scene.add(moon);
    const warm=new THREE.DirectionalLight('#ffb978',.18);warm.position.set(60,30,90);this.scene.add(warm);
    this.materials=createMaterials();
    this.materials.tree=this.materials.solid.clone();this.materials.tree.onBeforeCompile=this.materials.solid.onBeforeCompile;
    this.materials.scarf=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
    this.materials.ridge=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide,fog:true});
    this.uniforms={uTime:{value:0}};
    if(this.tier.windSway)addWindSway(this.materials.tree,this.uniforms);
    signal?.throwIfAborted();await yieldFrame('renderer+materials');

    const sky=createSky({stars:this.tier.stars});this.sky=sky;this.scene.add(sky.mesh);
    this.scene.add(createRidges(this.materials.ridge));
    const water=createWater(this.hf,{fogDensity:FOG_DENSITY});this.water=water;this.scene.add(water.mesh);
    signal?.throwIfAborted();await yieldFrame('sky+water');

    // Keep race lines clear of trees.
    const keepClear=[];
    for(const trial of TRIALS){
      const pts=[trial.start,...courseRings(trial)];
      for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/6);
        for(let k=0;k<=n;k++){const u=k/n,x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u,z=a.z+(b.z-a.z)*u;if(y<this.hf.heightAt(x,z)+16)keepClear.push({x,z,r:k===0||k===n?9:6});}}
    }
    for(const s of crystalPositions)keepClear.push({x:s[0],z:s[2],r:6});
    keepClear.push({x:SPAWN.x,z:SPAWN.z,r:14});
    const trees=scatterTrees(this.hf,{density:this.tier.treeDensity,keepClear});
    this.treeCount=trees.length;
    signal?.throwIfAborted();await yieldFrame('trees');
    const terrain=new THREE.Mesh(buildTerrain(this.hf,{step:this.tier.terrainStep,shade:createShade(trees)}),this.materials.terrain);terrain.name='Terrain';this.scene.add(terrain);
    signal?.throwIfAborted();await yieldFrame('terrain');
    this.scene.add(new THREE.Mesh(buildPaths(this.hf),this.materials.path));
    signal?.throwIfAborted();await yieldFrame('paths');
    this.scene.add(createTrees(trees,this.materials.tree));
    const lamps=lampSites(this.hf);this.lampSites=lamps;this.scene.add(createLamps(lamps,this.materials.solid));
    signal?.throwIfAborted();await yieldFrame('tree meshes+lamps');

    const landmarks=buildLandmarks({heightAt:this.hf.heightAt,trials:TRIALS});
    this.scene.add(new THREE.Mesh(landmarks.solid,this.materials.solid),new THREE.Mesh(landmarks.glow,this.materials.glow));
    this.colliders=landmarks.colliders;
    this.animated=createAnimatedParts(landmarks.anchors,this.materials);this.scene.add(this.animated.group);
    this.chimney=landmarks.anchors.chimney;
    this.world={heightAt:this.hf.heightAt,waterLevel:WATER_LEVEL,colliders:this.colliders};
    signal?.throwIfAborted();await yieldFrame('landmarks');

    // Glow sprites: static (lamps) and dynamic (gameplay) sets, plus particles.
    this.staticGlow=createGlowPoints(lamps.length+16,{fogDensity:FOG_DENSITY,dynamic:false});
    for(const s of lamps)this.staticGlow.push(s.x,s.y+3.35,s.z,'#ffc070',5.5,1);
    this.staticGlow.push(court.x,court.y+8.6,court.z,'#fff0c0',16,1.1);
    this.staticGlow.commit();this.scene.add(this.staticGlow.points);
    this.glow=createGlowPoints(900,{fogDensity:FOG_DENSITY});this.scene.add(this.glow.points);
    this.particles=createParticles(this.tier.particles,{fogDensity:FOG_DENSITY});this.scene.add(this.particles.points);
    this.streaks=createWindStreaks(this.tier.id==='low'?36:70);this.scene.add(this.streaks.lines);
    this.shake=createShake();this._shakeOut={x:0,y:0,roll:0};
    this.fireflies=Array.from({length:this.tier.fireflies},(_,i)=>{const a=i*2.399,R=20+((i*37)%120);const x=Math.cos(a)*R*.9,z=Math.sin(a)*R*.8+10;return {x,z,y:this.hf.heightAt(x,z)+1+((i*13)%5)*.5,p:i*.71};}).filter(f=>f.y>WATER_LEVEL+4);

    this.rider=createRider(this.materials);this.scene.add(this.rider.group,this.rider.scarf);
    this.blob=new THREE.Mesh(new THREE.CircleGeometry(1.5,16).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#000814',transparent:true,opacity:.35,depthWrite:false,fog:false}));
    this.blob.renderOrder=2;this.scene.add(this.blob);

    // Gameplay objects.
    this.ringMesh=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.075,6,48),new THREE.MeshBasicMaterial({toneMapped:false,fog:true}),24);
    this.ringMesh.setColorAt(0,new THREE.Color('#ffffff'));this.ringMesh.count=0;this.ringMesh.frustumCulled=false;this.scene.add(this.ringMesh);
    this.dustMesh=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.42,0),new THREE.MeshBasicMaterial({color:'#bff6ff',toneMapped:false}),220);
    this.dustMesh.count=0;this.dustMesh.frustumCulled=false;this.scene.add(this.dustMesh);
    this.shardMesh=new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.1,0),new THREE.MeshBasicMaterial({color:'#d6fbff',toneMapped:false}),SHARD_COUNT);
    this.shardMesh.frustumCulled=false;this.scene.add(this.shardMesh);
    this.wispMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.75,1),new THREE.MeshBasicMaterial({color:'#e6c8ff',toneMapped:false}),8);
    this.wispMesh.count=0;this.wispMesh.frustumCulled=false;this.scene.add(this.wispMesh);
    this.shards=crystalPositions.map(([x,y,z],id)=>({id,x,y:Math.max(y,this.hf.heightAt(x,z)+4),z,taken:this.save.shards.includes(id)}));
    this.bolts=Array.from({length:24},()=>({active:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,enemy:false,target:null}));
    this.wisps=[];this._spawnFreeWisps();
    this.ringFx=[];
    this.gates=TRIALS.map(trial=>({trial,ring:{x:trial.start.x,y:trial.start.y,z:trial.start.z,radius:6.6,normal:forwardOf(trial.start.heading)}}));

    this.hud=createHud(this.canvas.parentElement||document.body,{lang:this.options.lang,onAction:(action,id,meta)=>this._hudAction(action,id,meta)});
    this.hud.root.hidden=true;
    this.canvas.closest('.experience')?.setAttribute('data-academy','lean');
    timings.push(['fx+hud',+(performance.now()-mark).toFixed(1)]);
    this._bindEvents();
    this._resize();
    this._placeCamera(true);
  }

  async _firstFrame(){
    // Compile every program up front so the first flight has no shader hitches.
    let t=performance.now();
    try{if(this.renderer.compileAsync)await this.renderer.compileAsync(this.scene,this.camera);}catch{/* fall back to lazy compilation */}
    this.buildTimings?.push(['compile (async)',+(performance.now()-t).toFixed(1)]);t=performance.now();
    this._render();this.buildTimings?.push(['first render',+(performance.now()-t).toFixed(1)]);
    this._tick=this._tick.bind(this);this._animation=requestAnimationFrame(this._tick);
  }

  // ------------------------------------------------------------ persistence
  _loadSave(){try{return parseSave(localStorage.getItem(SAVE_KEY));}catch{return freshSave();}}
  _persist(){this._unlocked=unlockedTrials(this.save);try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.save));}catch{/* progress stays in memory */}}

  // ------------------------------------------------------------ input
  _listen(target,event,fn,opts){target.addEventListener(event,fn,opts);this._listeners.push(()=>target.removeEventListener(event,fn,opts));}
  _typing(e){return Boolean(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'));}
  _bindEvents(){
    this._listen(window,'keydown',e=>this._keyDown(e));
    this._listen(window,'keyup',e=>{this.keys.delete(e.code);});
    this._listen(window,'blur',()=>{this.keys.clear();this._suspended=true;this.sfx.setSuspended(true);});
    this._listen(window,'focus',()=>{this._suspended=Boolean(document.hidden);this.sfx.setSuspended(this._suspended||this._isPaused());this._lastFrame=0;});
    this._listen(document,'visibilitychange',()=>{this._suspended=Boolean(document.hidden);this.keys.clear();this.sfx.setSuspended(this._suspended||this._isPaused());this._lastFrame=0;});
    this._listen(this.canvas,'contextmenu',e=>e.preventDefault());
    this._listen(this.canvas,'pointerdown',e=>{
      if(!this.started||this._isPaused())return;
      this.sfx.unlock();this.canvas.focus({preventScroll:true});
      if(e.button===2||e.pointerType==='mouse'&&e.button===1){this._orbit.drag={id:e.pointerId,x:e.clientX,y:e.clientY};try{this.canvas.setPointerCapture(e.pointerId);}catch{/* no capture */}return;}
      if(e.button===0&&e.pointerType==='mouse'){this._wake();this._castQueued=true;}
    });
    this._listen(this.canvas,'pointermove',e=>{const d=this._orbit.drag;if(!d||d.id!==e.pointerId)return;this._orbit.yaw-=(e.clientX-d.x)*.006;this._orbit.pitch=clamp(this._orbit.pitch+(e.clientY-d.y)*.004,-.5,.9);d.x=e.clientX;d.y=e.clientY;});
    const end=e=>{if(this._orbit.drag?.id===e.pointerId)this._orbit.drag=null;};
    this._listen(this.canvas,'pointerup',end);this._listen(this.canvas,'pointercancel',end);
    this._listen(this.canvas,'wheel',e=>{if(!this.started||this._isPaused())return;e.preventDefault();this._orbit.zoom=clamp(this._orbit.zoom*Math.exp(e.deltaY*.0008),.7,1.8);},{passive:false});
    this._listen(this.canvas,'webglcontextlost',e=>{e.preventDefault();this._contextLost=true;this.keys.clear();});
    this._listen(this.canvas,'webglcontextrestored',()=>{this._contextLost=false;this._lastFrame=0;});
    if(typeof ResizeObserver!=='undefined'){this._resizeObserver=new ResizeObserver(()=>this._resize());this._resizeObserver.observe(this.canvas);}
    else this._listen(window,'resize',()=>this._resize());
  }
  _keyDown(e){
    if(['Space','Enter'].includes(e.code)&&e.target?.closest?.('button,a,summary,select,[role="button"]'))return;
    if(!this.started||this._isPaused()||this._typing(e)||e.metaKey||e.ctrlKey||e.altKey||e.defaultPrevented)return;
    if(!MOVEMENT_KEYS.has(e.code)&&!ACTION_KEYS.has(e.code))return;
    e.preventDefault();this.sfx.unlock();
    if(MOVEMENT_KEYS.has(e.code)){
      this.keys.add(e.code);
      if(e.code==='Space'){this._castQueued=true;}
      if(!this.hud.panelOpen)this._wake();
      return;
    }
    if(e.repeat)return;
    if(e.code==='KeyQ'){this._wake();this._rollQueued=-1;}
    else if(e.code==='KeyE'){this._wake();this._rollQueued=1;}
    else if(e.code==='KeyF'||e.code==='Enter')this.interact();
    else if(e.code==='KeyT')this._openPicker();
    else if(e.code==='KeyR'&&this.trial)this.startTrial(this.trial.id);
    else if(e.code==='KeyN'&&this.mode==='results'){const next=this._nextUnlocked();if(next)this.startTrial(next);}
    else if(e.code==='KeyX'&&(this.mode==='results'||this.mode==='running'||this.mode==='countdown'))this.freeFlight();
  }
  /** Leave hover: any steering input launches the broom. */
  _wake(){
    if(!this.hover||this.mode==='countdown'||this.mode==='results'||this.hud.panelOpen)return;
    this.hover=false;this.flight.speed=FLIGHT.cruise*.55;this.sfx.play('boost');
  }
  _gamepad(){
    const pads=navigator.getGamepads?.();if(!pads)return null;
    for(const pad of pads){if(!pad||!pad.connected)continue;
      const dead=v=>Math.abs(v)<.15?0:v;const b=i=>Boolean(pad.buttons[i]?.pressed);
      const state={turn:dead(pad.axes[0]||0),climb:-dead(pad.axes[1]||0),boost:b(7)||b(1),cast:b(0)||b(2),rollL:b(4),rollR:b(5),start:b(9)};
      const prev=this._padPrev||{};this._padPrev=state;
      if(state.rollL&&!prev.rollL)this._rollQueued=-1;if(state.rollR&&!prev.rollR)this._rollQueued=1;
      if(state.start&&!prev.start)this._openPicker();
      if(state.cast&&!prev.cast&&this.mode==='results')this.startTrial(this.trial.id);
      if(Math.abs(state.turn)+Math.abs(state.climb)>.2||state.boost||state.rollL||state.rollR)this._wake();
      return state;
    }
    return null;
  }
  _readInput(){
    const k=this.keys,pad=this._gamepad();
    let turn=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+this.touch.x;
    let climb=(k.has('KeyW')||k.has('ArrowUp')||this.controls.up?1:0)-(k.has('KeyS')||k.has('ArrowDown')||this.controls.down?1:0)-this.touch.z;
    let boost=k.has('ShiftLeft')||k.has('ShiftRight')||this.controls.boost;
    if(pad){turn+=pad.turn;climb+=pad.climb;boost||=pad.boost;if(pad.cast)this._castQueued=true;}
    if(k.has('Space')||this.controls.fire)this._castQueued=true;
    const roll=this._rollQueued;this._rollQueued=0;
    if(Math.abs(this.touch.x)+Math.abs(this.touch.z)>.25)this._wake();
    return {turn:clamp(turn,-1,1),climb:clamp(climb,-1,1),boost,roll};
  }

  // ------------------------------------------------------------ public API used by the site UI
  start(){
    if(this._disposed)return;
    const first=!this.started;this.started=true;this.paused=false;this._lastFrame=0;
    this.hud.root.hidden=false;this.sfx.unlock();this.sfx.setSuspended(this._suspended);
    this.canvas.focus({preventScroll:true});
    if(first){this.save.flights++;this._persist();this._showIntro();}
    this._emitFrame(true);
  }
  setPaused(paused){
    this.paused=Boolean(paused);this.keys.clear();this.touch.x=this.touch.z=0;this._lastFrame=0;
    this.sfx.setSuspended(this.paused||this._suspended);this._emitFrame(true);
  }
  setTouch(x,z){this.touch.x=clamp(Number(x)||0,-1,1);this.touch.z=clamp(Number(z)||0,-1,1);}
  setControl(name,pressed){if(name in this.controls){this.controls[name]=Boolean(pressed);if(pressed){this.sfx.unlock();this._wake();if(name==='fire')this._castQueued=true;}}}
  setOption(key,value){
    if(key==='quality'){this.options.quality=value;this.hud?.toast(say(this.options.lang,'Graphics tier applies the next time the Academy loads; resolution adapts now.','画质档位将在下次进入学院时生效；分辨率会即时自适应。'));}
    else if(key==='reducedMotion'){this.options.reducedMotion=Boolean(value);}
    else if(key==='sound'){this.options.sound=Boolean(value);this.sfx.setEnabled(this.options.sound);}
    else if(key==='musicVolume'||key==='effectsVolume'){this.options[key]=clamp(Number(value)||0,0,1);this.sfx.setVolumes({music:this.options.musicVolume,effects:this.options.effectsVolume});}
    else if(key==='lang'&&['en','zh'].includes(value)){this.options.lang=value;this.hud.setLanguage(value);if(this.hud.panelOpen&&this.mode==='intro')this._showIntro();}
    this._emitFrame(true);
  }
  travel(id){
    const l=locations.find(item=>item.id===id);if(!l)return false;
    if(!this.started){this.started=true;this.paused=false;this.hud.root.hidden=false;this.sfx.unlock();}
    this._endRun();this.mode='free';this.hud.hidePanels();this.hud.setMode('free');
    const x=l.x,z=l.z+l.radius+26,heading=0;
    this._teleport({x,y:Math.max(l.y+l.height*.45,this.hf.heightAt(x,z)+10),z,heading});
    this.hover=true;this._emitFrame(true);return true;
  }
  tourStop(index=0){const stop=tourStops[Math.max(0,Math.min(tourStops.length-1,Number(index)||0))];return this.travel(stop?.id||'about');}
  endTour(){}
  returnHome(){this._endRun();this.mode='free';this.hud.hidePanels();this.started=false;this.hud.root.hidden=true;this.sfx.setSuspended(true);this._emitFrame(true);}
  interact(){
    if(!this.started||this._isPaused())return false;
    if(this.mode==='results'){this.startTrial(this.trial.id);return true;}
    if(this.nearestLocation){this.sfx.play('ui');this.callbacks.onInteract?.(this.nearestLocation.id);return true;}
    return false;
  }
  startRace(){return this.startTrial(unlockedTrials(this.save).at(-1));}
  cancelRace(){this.freeFlight();}
  resetProgress(){this.save=freshSave();this._persist();for(const s of this.shards)s.taken=false;this.callbacks.onProgress?.(this._legacyProgress());this._emitFrame(true);}
  /** The intro card already teaches the controls; no extra toast. */
  startHint(){return null;}
  controlRows(lang=this.options.lang){
    const zh=lang==='zh';
    return [['W / S · ↑ / ↓',zh?'爬升 / 俯冲':'Climb / dive'],['A / D · ← / →',zh?'转向':'Turn'],['SHIFT',zh?'加速（消耗能量）':'Boost (uses the meter)'],['SPACE / CLICK',zh?'施法，自动瞄准游魂':'Cast, auto-aims at wisps'],
      ['Q / E',zh?'左右翻滚闪避':'Barrel roll to dodge'],['F',zh?'阅读附近的地点':'Read the nearby place'],['T',zh?'选择试炼':'Choose a trial'],['R',zh?'重新开始试炼':'Restart the trial'],['RIGHT DRAG',zh?'环视':'Look around'],['ESC',zh?'个人资料':'Portfolio'],['M',zh?'地图':'Map']];
  }
  // The old world's actions have no counterpart here.
  releaseLantern(){return false;}selectSpell(){return false;}activateShield(){this._rollQueued=1;return true;}changeAltitude(){return false;}setCameraView(){return false;}jumpToTime(){return false;}

  // ------------------------------------------------------------ modes
  _showIntro(){this.mode='intro';this.hover=true;this.hud.setMode('free');this.hud.showIntro(this.save,unlockedTrials(this.save));}
  _openPicker(){if(!this.started||this._isPaused())return;if(this.mode==='running'||this.mode==='countdown')this._endRun();this.mode='picker';this.hover=true;this.hud.setMode('free');this.hud.showPicker(this.save,unlockedTrials(this.save));}
  _nextUnlocked(){const open=unlockedTrials(this.save),i=TRIALS.findIndex(t=>t.id===this.trial?.id);const next=TRIALS[i+1];return next&&open.includes(next.id)?next.id:null;}
  _hudAction(action,id){
    this.sfx.unlock();
    if(action==='trial'){if(unlockedTrials(this.save).includes(id))this.startTrial(id);}
    else if(action==='free')this.freeFlight();
    else if(action==='retry'&&this.trial)this.startTrial(this.trial.id);
    else if(action==='roll-left'){this._wake();this._rollQueued=-1;}
    else if(action==='roll-right'){this._wake();this._rollQueued=1;}
    else if(action==='cast'){this._wake();this._castQueued=true;}
    else if(action==='interact')this.interact();
    this.canvas.focus({preventScroll:true});
  }
  freeFlight(){
    this._endRun();this.mode='free';this.hud.hidePanels();this.hud.setMode('free');this.hud.trial(null,null);
    if(this.hover){this.hover=false;this.flight.speed=FLIGHT.cruise*.6;}
    this._spawnFreeWisps();this._emitFrame(true);
  }
  startTrial(id){
    const trial=TRIALS.find(t=>t.id===id);if(!trial||!unlockedTrials(this.save).includes(id))return false;
    this._endRun();this.trial=trial;this.run=createRun(trial);this.mode='countdown';
    this.hud.hidePanels();this.hud.setMode('countdown');this.hud.trial(trial,this.run);
    this._teleport(trial.start);this.hover=true;
    // Course objects.
    this.dust=courseStardust(trial).map(p=>({...p,taken:false,pull:0}));
    this.wisps=trial.wisps.map(([x,y,z],i)=>this._makeWisp(x,y,z,i,true));
    this._lastTick=Math.ceil(this.run.countdown);this.hud.countdown(String(this._lastTick));this.sfx.play('tick');
    this._emitFrame(true);return true;
  }
  _endRun(){
    this.run=null;this.dust=[];this.ringFx.length=0;for(const b of this.bolts)b.active=false;
    this.hud.countdown('');
  }
  _finishRun(){
    const result=this.run.result,trial=this.trial;
    const before=unlockedTrials(this.save);
    const {save,newBest,newMedal}=recordResult(this.save,result);this.save=save;this._persist();
    const after=unlockedTrials(this.save);const nextUnlocked=this._nextUnlocked();
    this.mode='results';this.hover=true;this.hud.setMode('results');
    this.sfx.play(result.finished?'finish':'fail',{medal:result.medal});
    if(result.finished&&!this.options.reducedMotion)this.particles.emit(this.flight.x,this.flight.y+1,this.flight.z,{count:60,speed:14,life:1.2,size:2,color:result.medal==='gold'?'#ffe08a':'#cfe9ff'});
    this.hud.showResults(result,{newBest,newMedal,trial,nextUnlocked});
    this.lastResult=result;this._endRun();
    if(after.length>before.length)this.hud.toast(say(this.options.lang,`Unlocked: ${TRIALS.find(t=>t.id===after.at(-1)).name.en}`,`已解锁：${TRIALS.find(t=>t.id===after.at(-1)).name.zh}`),3600);
    this.callbacks.onProgress?.(this._legacyProgress());
  }
  _teleport({x,y,z,heading}){
    resetFlight(this.flight,{x,y,z,heading});this.flight.speed=0;this.rider.reset();
    this._orbit.yaw=0;this._orbit.pitch=0;this._placeCamera(true);
  }

  // ------------------------------------------------------------ wisps & bolts
  _makeWisp(x,y,z,i,aggressive){return {i,home:{x,y,z},x,y,z,hp:2,alive:true,aggressive,cool:1.5+i*.4,tele:0,flash:0,phase:i*1.7,respawn:0};}
  _spawnFreeWisps(){this.wisps=wispPositions.map(([x,y,z],i)=>this._makeWisp(x,Math.max(y,this.hf.heightAt(x,z)+6),z,i,false));}
  _updateWisps(dt){
    const f=this.flight,playing=this.mode==='running';
    for(const w of this.wisps){
      if(!w.alive){if(!w.aggressive&&this.mode==='free'&&(w.respawn-=dt)<=0){Object.assign(w,this._makeWisp(w.home.x,w.home.y,w.home.z,w.i,false));}continue;}
      w.phase+=dt;w.flash=Math.max(0,w.flash-dt*3);
      const dx=f.x-w.x,dy=f.y-w.y,dz=f.z-w.z,dist=Math.hypot(dx,dy,dz);
      const hunting=(w.aggressive&&playing&&dist<60)||(w.provoked>0&&this.mode==='free');
      if(w.provoked>0)w.provoked-=dt;
      let tx=w.home.x+Math.sin(w.phase*.6)*5,ty=w.home.y+Math.sin(w.phase*1.3)*1.4,tz=w.home.z+Math.cos(w.phase*.5)*5;
      if(hunting){const ahead=forwardOf(f.heading);tx=f.x+ahead.x*22+Math.sin(w.phase)*9;ty=f.y+3+Math.sin(w.phase*1.7)*3;tz=f.z+ahead.z*22+Math.cos(w.phase)*9;}
      const k=hunting?1.4:.8;w.x=damp(w.x,tx,k,dt);w.y=damp(w.y,ty,k,dt);w.z=damp(w.z,tz,k,dt);
      w.y=Math.max(w.y,Math.max(this.hf.heightAt(w.x,w.z),WATER_LEVEL)+2.5);
      if(hunting&&dist<48){
        if(w.tele>0){w.tele-=dt;if(w.tele<=0){this._fireBolt(w.x,w.y,w.z,true,null);w.cool=2.3+Math.random()*.8;}}
        else if((w.cool-=dt)<=0){w.tele=.55;this.sfx.play('hitWisp');}
      }
    }
  }
  _fireBolt(x,y,z,enemy,target){
    const b=this.bolts.find(item=>!item.active);if(!b)return;
    const f=this.flight;b.active=true;b.enemy=enemy;b.target=target;b.x=x;b.y=y;b.z=z;b.life=enemy?3.2:1.4;
    let dir;
    if(enemy){const lead=.45,px=f.x+f.vx*lead,py=f.y+f.vy*lead,pz=f.z+f.vz*lead,dx=px-x,dy=py-y,dz=pz-z,l=Math.hypot(dx,dy,dz)||1;dir={x:dx/l,y:dy/l,z:dz/l};}
    else if(target){const dx=target.x-x,dy=target.y-y,dz=target.z-z,l=Math.hypot(dx,dy,dz)||1;dir={x:dx/l,y:dy/l,z:dz/l};}
    else dir=forwardOf(f.heading,f.pitch);
    const speed=enemy?WISP_BOLT_SPEED:BOLT_SPEED+f.speed;b.vx=dir.x*speed;b.vy=dir.y*speed;b.vz=dir.z*speed;
  }
  _updateBolts(dt){
    const f=this.flight;
    for(const b of this.bolts){
      if(!b.active)continue;
      b.life-=dt;if(b.life<=0){b.active=false;continue;}
      // Gentle homing: player bolts toward their lock, wisp bolts toward the rider.
      const tgt=b.enemy?f:(b.target?.alive?b.target:null);
      if(tgt){const speed=Math.hypot(b.vx,b.vy,b.vz),dx=tgt.x-b.x,dy=tgt.y-b.y,dz=tgt.z-b.z,l=Math.hypot(dx,dy,dz)||1,turn=(b.enemy?1.1:9)*dt;
        b.vx+=(dx/l*speed-b.vx)*Math.min(1,turn);b.vy+=(dy/l*speed-b.vy)*Math.min(1,turn);b.vz+=(dz/l*speed-b.vz)*Math.min(1,turn);}
      const px=b.x,py=b.y,pz=b.z;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
      if(b.y<Math.max(this.hf.heightAt(b.x,b.z),WATER_LEVEL)){b.active=false;this.particles.emit(b.x,b.y+.3,b.z,{count:6,speed:4,life:.4,color:b.enemy?'#d9a6ff':'#bdf3ff'});continue;}
      if(b.enemy){
        if(segmentPointDistance(px,py,pz,b.x,b.y,b.z,f.x,f.y+.5,f.z)<1.6){
          b.active=false;
          if(f.iframes>0){this.hud.callout(say(this.options.lang,'Dodged','闪避'),'cool');this.particles.emit(b.x,b.y,b.z,{count:12,speed:8,life:.5,color:'#d9a6ff'});continue;}
          this._playerHurt();
        }
      }else{
        for(const w of this.wisps){if(!w.alive)continue;if(segmentPointDistance(px,py,pz,b.x,b.y,b.z,w.x,w.y,w.z)<2.3){b.active=false;this._hitWisp(w);break;}}
      }
    }
  }
  _hitWisp(w){
    w.hp--;w.flash=1;this.particles.emit(w.x,w.y,w.z,{count:14,speed:9,life:.5,color:'#e6c8ff'});this.sfx.play('hitWisp');
    if(!w.aggressive)w.provoked=18;
    if(w.hp<=0){
      w.alive=false;w.respawn=30;this._hitStop=Math.max(this._hitStop,this.options.reducedMotion?0:.07);this.shake.add(.25);
      this.particles.emit(w.x,w.y,w.z,{count:46,speed:16,life:1,size:1.8,color:'#f0dcff'});this.sfx.play('banish');
      const event=this.run?wispBanished(this.run):null;
      this.hud.callout(event?`${say(this.options.lang,'Wisp banished','驱散游魂')} +${event.points}`:say(this.options.lang,'Wisp banished','驱散游魂'),'cool');
    }
  }
  _playerHurt(){
    this.shake.add(.6);this._hitStop=Math.max(this._hitStop,this.options.reducedMotion?0:.09);this.sfx.play('hurt');
    this.particles.emit(this.flight.x,this.flight.y+.6,this.flight.z,{count:24,speed:10,life:.6,color:'#ff9a7a'});
    const event=this.run?playerHit(this.run):null;
    if(event){this.hud.timePop(`−${event.penalty.toFixed(1)}s`);this.hud.root.querySelector('.ac-time-pop')?.classList.add('neg');this.hud.callout(say(this.options.lang,'Hit','被击中'),'bad');}
  }
  _cast(){
    if(this._castCooldown>0||this.hover)return;
    this._castCooldown=CAST_COOLDOWN;
    const tip=this.rider.wandTip.getWorldPosition(this._v1||=new THREE.Vector3());
    this._fireBolt(tip.x,tip.y,tip.z,false,this.target);this.sfx.play('cast');
    this.particles.emit(tip.x,tip.y,tip.z,{count:5,speed:3,life:.25,color:'#bdf3ff'});
  }
  _findTarget(){
    const f=this.flight,fwd=forwardOf(f.heading,f.pitch);let best=null,score=Infinity;
    for(const w of this.wisps){if(!w.alive)continue;const dx=w.x-f.x,dy=w.y-f.y,dz=w.z-f.z,d=Math.hypot(dx,dy,dz);if(d>80||d<2)continue;
      const cos=(dx*fwd.x+dy*fwd.y+dz*fwd.z)/d;if(cos<.86)continue;const s=d*(2-cos);if(s<score){score=s;best=w;}}
    return best;
  }

  // ------------------------------------------------------------ simulation
  _isPaused(){return this.paused||this._suspended||this._contextLost||!this.started;}
  _simulate(dt){
    const f=this.flight;this._prev.x=f.x;this._prev.y=f.y;this._prev.z=f.z;
    const input=this._readInput();
    this._castCooldown=Math.max(0,this._castCooldown-dt);
    if(this.hover){
      f.speed=0;f.vx=f.vy=f.vz=0;f.bank=damp(f.bank,0,4,dt);f.pitch=damp(f.pitch,0,4,dt);f.turnVel=0;f.roll=0;f.rollAngle=0;f.lateral=0;
      f.boost=Math.min(1,f.boost+FLIGHT.boostRegen*dt);
    }else{
      const events=stepFlight(f,input,dt,this.world);
      for(const e of events)this._flightEvent(e);
    }
    if(this._castQueued&&!this.hud.panelOpen){this._castQueued=false;this._cast();}else this._castQueued=false;

    if(this.run){
      for(const e of stepRun(this.run,dt))this._runEvent(e);
      if(this.run?.phase==='running'){
        const ring=this.run.rings[this.run.ring];
        const hit=ring&&crossRing(ring,this._prev,f);
        if(hit)this._ringPassed(ring,hit);
      }
      if(this.run&&this.run.phase!=='countdown'&&this.run.phase!=='running')this._finishRun();
    }else if(this.mode==='free'||this.mode==='intro'){
      for(const gate of this.gates){const hit=!this.hover&&crossRing(gate.ring,this._prev,f);if(hit&&hit.forward){
        if(this._unlocked.includes(gate.trial.id)){this.sfx.play('gate');this.startTrial(gate.trial.id);}
        else this.hud.toast(say(this.options.lang,'Locked: win a medal in the previous trial first.','未解锁：先在上一个试炼中获得奖牌。'));
        break;}}
      this._updateFreeFlight();
    }
    this._updateCollectibles(dt);
    this._updateWisps(dt);
    this._updateBolts(dt);
  }
  _flightEvent(e){
    if(e.type==='roll'){this.sfx.play('roll');this.particles.emit(this.flight.x,this.flight.y+.4,this.flight.z,{count:10,speed:5,life:.4,color:'#cfe9ff'});}
    else if(e.type==='boost-start'){this.sfx.play('boost');}
    else if(e.type==='scrape'){this.shake.add(.3);this.sfx.play('scrape');this.particles.emit(this.flight.x,this.flight.y-.6,this.flight.z,{count:14,speed:6,life:.5,color:this.flight.overWater?'#cfe9ff':'#9aa07a',gravity:6});}
    else if(e.type==='bump'){this.shake.add(.55);this._hitStop=Math.max(this._hitStop,this.options.reducedMotion?0:.06);this.sfx.play('bump');
      this.particles.emit(this.flight.x,this.flight.y+.4,this.flight.z,{count:18,speed:7,life:.5,color:'#ffd9a0'});
      if(this.run?.phase==='running'){this.run.chain=0;this.run.combo=1;this.run.comboTimer=0;}}
    else if(e.type==='boundary'){this.hud.toast(say(this.options.lang,'Turning back toward the islands','正在掉头返回岛屿'),1800);}
  }
  _runEvent(e){
    if(e.type==='tick'){this.hud.countdown(String(e.value));this.sfx.play('tick');}
    else if(e.type==='go'){this.mode='running';if(this.trial.id==='lantern-loop'&&!this.save.trials['lantern-loop'])setTimeout(()=>this.hud?.callout(say(this.options.lang,'Fly through the gold rings · follow the stardust','穿过金色光环 · 沿着星尘飞行'),'gold'),900);this.hud.countdown(say(this.options.lang,'Go!','出发！'));this.sfx.play('go');this.hover=false;this.flight.speed=FLIGHT.cruise*1.15;this.hud.setMode('running');this.shake.add(.15);}
    else if(e.type==='low-time'){this.sfx.play('lowTime');this.hud.callout(say(this.options.lang,'Hurry!','快一点！'),'bad');}
    else if(e.type==='combo-lost'){/* the bar already shows it */}
  }
  _ringPassed(ring,hit){
    const event=ringPassed(this.run,{perfect:hit.perfect});if(!event)return;
    this.flight.boost=Math.min(1,this.flight.boost+.22);
    this.sfx.play('ring',{chain:event.chain,perfect:event.perfect});
    this.hud.timePop(`+${event.timeBonus.toFixed(1)}s`);this.hud.root.querySelector('.ac-time-pop')?.classList.remove('neg');
    if(event.perfect)this.hud.callout(`${say(this.options.lang,'Perfect','完美')} +${event.points}`,'gold');
    else if(event.chain>=3)this.hud.callout(`${say(this.options.lang,'Chain','连环')} ×${event.chain}`,'good');
    this.ringFx.push({x:ring.x,y:ring.y,z:ring.z,normal:ring.normal,radius:ring.radius,t:0});
    if(!this.options.reducedMotion){this._hitStop=Math.max(this._hitStop,event.perfect?.05:0);this.shake.add(event.perfect?.18:.08);}
    this._ringBurst(ring,event.perfect?'#fff1b8':'#ffd98a');
  }
  _ringBurst(ring,color){
    const n=ring.normal,u=new THREE.Vector3(n.y,-n.x,0);if(u.lengthSq()<.01)u.set(0,n.z,-n.y);u.normalize();const v=new THREE.Vector3(n.x,n.y,n.z).cross(u);
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=ring.x+(u.x*Math.cos(a)+v.x*Math.sin(a))*ring.radius,y=ring.y+(u.y*Math.cos(a)+v.y*Math.sin(a))*ring.radius,z=ring.z+(u.z*Math.cos(a)+v.z*Math.sin(a))*ring.radius;
      this.particles.emit(x,y,z,{count:1,speed:5,life:.7,size:1.6,color});}
  }
  _updateCollectibles(dt){
    const f=this.flight;
    if(this.run&&this.run.phase==='running'&&this.dust)for(const d of this.dust){
      if(d.taken)continue;const dx=f.x-d.x,dy=f.y-d.y,dz=f.z-d.z,dist=Math.hypot(dx,dy,dz);
      if(dist<7){const pull=Math.min(1,dt*(10-dist));d.x+=dx*pull;d.y+=dy*pull;d.z+=dz*pull;}
      if(dist<2.4){d.taken=true;const e=stardustCollected(this.run);this.sfx.play('stardust',{combo:e.combo});f.boost=Math.min(1,f.boost+.03);
        this.particles.emit(d.x,d.y,d.z,{count:5,speed:4,life:.35,color:'#bff6ff'});
        if(e.combo>=4&&e.combo%2===0&&e.combo!==this._lastComboCallout){this._lastComboCallout=e.combo;this.hud.callout(`${say(this.options.lang,'Combo','连击')} ×${e.combo}`,'cool');}if(e.combo<4)this._lastComboCallout=0;}
    }
    if(this.mode==='free'||this.mode==='intro')for(const s of this.shards){
      if(s.taken)continue;if(Math.hypot(f.x-s.x,f.y-s.y,f.z-s.z)<3.4){
        s.taken=true;if(!this.save.shards.includes(s.id))this.save.shards.push(s.id);this._persist();this.sfx.play('shard');
        this.particles.emit(s.x,s.y,s.z,{count:40,speed:12,life:1,size:1.8,color:'#d6fbff'});
        this.hud.toast(`${say(this.options.lang,'Star shard','星辰碎片')} ${this.save.shards.length} / ${SHARD_COUNT}`);this.callbacks.onProgress?.(this._legacyProgress());}
    }
  }
  _updateFreeFlight(){
    const f=this.flight;let nearest=null,best=Infinity;
    for(const l of locations){const d=Math.hypot(f.x-l.x,f.z-l.z);
      if(d<l.radius+18&&f.y<l.y+l.height+45&&!this.save.discovered.includes(l.id)){
        this.save.discovered.push(l.id);this._persist();this.sfx.play('discover');
        this.hud.toast(`${say(this.options.lang,'Discovered','发现')}: ${l.name[this.options.lang]}`,3000);this.callbacks.onProgress?.(this._legacyProgress());}
      if(d<l.radius+30&&d<best){best=d;nearest=l;}}
    this.nearestLocation=nearest;
  }

  // ------------------------------------------------------------ camera
  _placeCamera(immediate=false,dt=0){
    const f=this.flight,fwd=forwardOf(f.heading+this._orbit.yaw,0),reduced=this.options.reducedMotion;
    const speedT=clamp((f.speed-FLIGHT.cruise)/(FLIGHT.maxSpeed-FLIGHT.cruise),0,1);
    const portrait=this._height>this._width;
    const dist=(8.6+speedT*3.2+(this.hover?1.5:0))*this._orbit.zoom*(portrait?1.25:1);
    const lift=2.4+this._orbit.pitch*dist*.8-f.pitch*2.2;
    const goal=this._camGoal||=new THREE.Vector3(),look=this._lookGoal||=new THREE.Vector3();
    goal.set(f.x-fwd.x*dist,f.y+lift,f.z-fwd.z*dist);
    const ahead=forwardOf(f.heading,f.pitch*.6);
    look.set(f.x+ahead.x*7,f.y+1.2+ahead.y*5,f.z+ahead.z*7);
    // Clearance: shorten the boom where terrain rises between rider and camera
    // (cliff walls in the channels), then keep above ground and out of buildings.
    {const fx=f.x,fy=f.y+1,fz=f.z;let keep=1;
      for(let i=1;i<=6;i++){const u=i/6,x=fx+(goal.x-fx)*u,z=fz+(goal.z-fz)*u,y=fy+(goal.y-fy)*u;if(Math.max(this.hf.heightAt(x,z),WATER_LEVEL)+1.1>y&&this.hf.heightAt(x,z)>f.y+1){keep=Math.max(.18,(i-1)/6);break;}}
      if(keep<1){goal.set(fx+(goal.x-fx)*keep,fy+(goal.y-fy)*keep+(1-keep)*1.5,fz+(goal.z-fz)*keep);}}
    const ground=Math.max(this.hf.heightAt(goal.x,goal.z),WATER_LEVEL)+1.4;if(goal.y<ground)goal.y=ground;
    resolveColliders(goal,this.colliders,.8);
    if(!this._camPos){this._camPos=goal.clone();this._camLook=look.clone();}
    if(immediate){this._camPos.copy(goal);this._camLook.copy(look);}
    else{const k=this.hover?3:7.5;this._camPos.x=damp(this._camPos.x,goal.x,k,dt);this._camPos.y=damp(this._camPos.y,goal.y,k*.8,dt);this._camPos.z=damp(this._camPos.z,goal.z,k,dt);
      this._camLook.x=damp(this._camLook.x,look.x,12,dt);this._camLook.y=damp(this._camLook.y,look.y,10,dt);this._camLook.z=damp(this._camLook.z,look.z,12,dt);}
    if(!this._orbit.drag){this._orbit.yaw=damp(this._orbit.yaw,0,1.6,dt);this._orbit.pitch=damp(this._orbit.pitch,0,1.2,dt);}
    const shake=this.shake.update(dt,this._shakeOut,!reduced);
    this.camera.position.copy(this._camPos);
    const camGround=Math.max(this.hf.heightAt(this.camera.position.x,this.camera.position.z),WATER_LEVEL)+1.1;if(this.camera.position.y<camGround)this.camera.position.y=camGround;
    const roll=f.bank*.2+shake.roll;this.camera.up.set(Math.cos(f.heading)*roll,1,-Math.sin(f.heading)*roll).normalize();
    this.camera.lookAt(this._camLook);
    this.camera.position.x+=shake.x;this.camera.position.y+=shake.y;
    const baseFov=portrait?72:62,targetFov=baseFov+(reduced?0:speedT*13+(f.boosting?4:0));
    this.camera.fov=immediate?targetFov:damp(this.camera.fov,targetFov,4,dt);this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ per-frame visuals
  _updateVisuals(dt){
    const t=this._time,f=this.flight,reduced=this.options.reducedMotion;
    this.uniforms.uTime.value=t;this.sky.material.uniforms.uTime.value=t;this.water.material.uniforms.uTime.value=reduced?0:t;
    f.hover=this.hover;this.rider.update(f,dt,t,{reducedMotion:reduced});
    if(!reduced)this.animated.update(t);
    // Blob shadow on whatever is below.
    const ground=Math.max(this.hf.heightAt(f.x,f.z),WATER_LEVEL),gap=f.y-ground;
    this.blob.position.set(f.x,ground+.08,f.z);this.blob.visible=gap<40;this.blob.material.opacity=.42*(1-clamp(gap/40,0,1));this.blob.scale.setScalar(1+gap*.02);

    const glow=this.glow;glow.clear();
    const tip=this.rider.wandTip.getWorldPosition(this._v2||=new THREE.Vector3());
    glow.push(tip.x,tip.y,tip.z,'#cfefff',this._castCooldown>.15?3.2:1.8,1);
    // Broom trail sparkles.
    if(!this.hover&&f.speed>20&&Math.random()<(f.boosting?.9:.35)*(this.governor.effects>0?.5:1)){const tail=forwardOf(f.heading,f.pitch);this.particles.emit(f.x-tail.x*2.6,f.y+.05-tail.y*2.6,f.z-tail.z*2.6,{count:1,speed:.6,life:f.boosting?.8:.55,size:f.boosting?1.3:.9,color:f.boosting?'#bff0dc':'#ffd99a'});}
    if(!this.hover&&f.overWater&&f.groundGap<2.2&&f.speed>18&&Math.random()<.8)this.particles.emit(f.x,WATER_LEVEL+.2,f.z,{count:2,speed:5,life:.6,size:1.2,color:'#d6ecff',gravity:9,vy:3});

    // Rings.
    let n=0;const m=this._m1||=new THREE.Matrix4(),q=this._q1||=new THREE.Quaternion(),s=this._s1||=new THREE.Vector3(),p=this._p1||=new THREE.Vector3(),zAxis=this._z1||=new THREE.Vector3(0,0,1),nrm=this._n1||=new THREE.Vector3(),c=this._c1||=new THREE.Color();
    if(this.run){
      const pulse=1+Math.sin(t*6)*.05;
      for(let i=this.run.ring;i<Math.min(this.run.rings.length,this.run.ring+4);i++){
        const r=this.run.rings[i],isTarget=i===this.run.ring;
        q.setFromUnitVectors(zAxis,nrm.set(r.normal.x,r.normal.y,r.normal.z));s.setScalar(r.radius*(isTarget?pulse:1));m.compose(p.set(r.x,r.y,r.z),q,s);
        this.ringMesh.setMatrixAt(n,m);this.ringMesh.setColorAt(n,c.set(isTarget?'#ffd36e':i===this.run.ring+1?'#8fa7d8':'#4b5a86').multiplyScalar(isTarget?1.6:.9));n++;
        if(isTarget){const u=(this._u1||=new THREE.Vector3()).set(r.normal.y,-r.normal.x,0);if(u.lengthSq()<.01)u.set(0,r.normal.z,-r.normal.y);u.normalize();const v=(this._w1||=new THREE.Vector3()).copy(nrm).cross(u);
          const count=reduced?8:14;for(let k=0;k<count;k++){const a=k/count*Math.PI*2+t*.8;glow.push(r.x+(u.x*Math.cos(a)+v.x*Math.sin(a))*r.radius,r.y+(u.y*Math.cos(a)+v.y*Math.sin(a))*r.radius,r.z+(u.z*Math.cos(a)+v.z*Math.sin(a))*r.radius,'#ffcf6a',3.2,.8);}}
      }
      for(const fx of this.ringFx){fx.t+=dt;if(fx.t>.6)continue;q.setFromUnitVectors(zAxis,nrm.set(fx.normal.x,fx.normal.y,fx.normal.z));s.setScalar(fx.radius*(1+fx.t*1.6));m.compose(p.set(fx.x,fx.y,fx.z),q,s);
        this.ringMesh.setMatrixAt(n,m);this.ringMesh.setColorAt(n,c.set('#fff2c4').multiplyScalar(1.8*(1-fx.t/.6)));n++;}
      this.ringFx=this.ringFx.filter(fx=>fx.t<=.6);
    }
    this.ringMesh.count=n;this.ringMesh.instanceMatrix.needsUpdate=true;if(this.ringMesh.instanceColor)this.ringMesh.instanceColor.needsUpdate=true;
    // Stardust.
    let d=0;
    if(this.run&&this.dust){for(const item of this.dust){if(item.taken||d>=220)continue;const dist=Math.hypot(item.x-f.x,item.z-f.z);if(dist>170)continue;
      q.setFromAxisAngle(this._yAxis,t*2+item.x);s.setScalar(1);m.compose(p.set(item.x,item.y+Math.sin(t*2.4+item.z)*.15,item.z),q,s);this.dustMesh.setMatrixAt(d++,m);
      if(dist<120)glow.push(item.x,item.y,item.z,'#8fe8ff',2.6,.7);}}
    this.dustMesh.count=d;this.dustMesh.instanceMatrix.needsUpdate=true;
    // Shards.
    let sh=0;for(const shard of this.shards){if(shard.taken||this.run){continue;}q.setFromAxisAngle(this._yAxis,t*.9+shard.id);s.set(1,1.6,1);m.compose(p.set(shard.x,shard.y+Math.sin(t*1.4+shard.id)*.4,shard.z),q,s);this.shardMesh.setMatrixAt(sh++,m);glow.push(shard.x,shard.y,shard.z,'#9feeff',9,.9);}
    this.shardMesh.count=sh;this.shardMesh.instanceMatrix.needsUpdate=true;
    // Trial gates shimmer when not racing.
    if(!this.run)for(const gate of this.gates){const g=gate.ring,open=this._unlocked.includes(gate.trial.id),ux=Math.cos(gate.trial.start.heading),uz=-Math.sin(gate.trial.start.heading);
      for(let k=0;k<12;k++){const a=k/12*Math.PI*2+t*.5;glow.push(g.x+ux*Math.cos(a)*6.6,g.y+Math.sin(a)*6.6,g.z+uz*Math.cos(a)*6.6,open?'#ffd27a':'#7b86a8',4,open?.9:.4);}}
    // Wisps.
    let wi=0;for(const w of this.wisps){if(!w.alive)continue;const sc=1+(w.tele>0?.5:0)+w.flash*.6+Math.sin(t*5+w.i)*.08;s.setScalar(sc);q.identity();m.compose(p.set(w.x,w.y,w.z),q,s);this.wispMesh.setMatrixAt(wi++,m);
      glow.push(w.x,w.y,w.z,w.tele>0?'#ff9ce8':'#b98cff',w.tele>0?14:9,1);
      for(let k=0;k<3;k++){const a=t*3+k*2.1+w.i;glow.push(w.x+Math.cos(a)*1.6,w.y+Math.sin(a*1.3)*.8,w.z+Math.sin(a)*1.6,'#e6c8ff',1.6,.8);}}
    this.wispMesh.count=wi;this.wispMesh.instanceMatrix.needsUpdate=true;
    // Bolts.
    for(const b of this.bolts)if(b.active){glow.push(b.x,b.y,b.z,b.enemy?'#ff8ad8':'#bff3ff',b.enemy?5.5:4,1.2);if(Math.random()<.6)this.particles.emit(b.x,b.y,b.z,{count:1,speed:.5,life:.25,size:1,color:b.enemy?'#ff8ad8':'#bff3ff'});}
    // Fireflies and chimney embers (ambient, skipped when the governor trims effects).
    if(this.governor.effects<1){for(const ff of this.fireflies){const a=t*.4+ff.p;glow.push(ff.x+Math.sin(a)*2.2,ff.y+Math.sin(a*1.7)*.8,ff.z+Math.cos(a*.8)*2.2,'#d9ff9a',1.3,.5+.5*Math.sin(t*3+ff.p*5));}
      if(Math.random()<dt*6)this.particles.emit(this.chimney.x,this.chimney.y,this.chimney.z,{count:1,speed:1.2,life:2.2,size:1.1,color:'#ff9a4a',vy:3,drag:.4});}
    glow.commit();
    this.particles.update(dt);
    this.streaks.update(this.camera,this.hover?0:f.speed,f.boosting,dt);
    if(reduced||this.governor.effects>0)this.streaks.lines.visible=false;
    this.target=this.mode==='running'||this.wisps.some(w=>w.alive&&w.provoked>0)?this._findTarget():null;
  }

  _updateHud(){
    const hud=this.hud,f=this.flight;
    hud.trial(this.trial&&this.run?this.trial:null,this.run);
    hud.meters(f.boost,1-this.flight.rollCooldown/FLIGHT.rollCooldown,f.boosting);
    const w=this._width,h=this._height,v=this._v3||=new THREE.Vector3();
    // Next ring / gate marker.
    let goal=null,label='';
    if(this.run&&this.run.phase!=='finished'){const r=this.run.rings[this.run.ring];if(r){goal=r;label=`${Math.round(Math.hypot(r.x-f.x,r.y-f.y,r.z-f.z))} m`;}}
    else if(this.mode==='free'&&!this.hud.panelOpen&&!this.hover){
      const open=this._unlocked;let best=Infinity;
      for(const g of this.gates){if(!open.includes(g.trial.id))continue;const d=Math.hypot(g.ring.x-f.x,g.ring.z-f.z);if(d<best&&d<160){best=d;goal=g.ring;label=g.trial.name[this.options.lang];}}
    }
    if(goal){
      v.set(goal.x,goal.y,goal.z).project(this.camera);const behind=v.z>1;let x=(v.x*.5+.5)*w,y=(-v.y*.5+.5)*h;
      const margin=46,onScreen=!behind&&x>margin&&x<w-margin&&y>margin+60&&y<h-margin;
      let angle=0;
      if(!onScreen){let dx=x-w/2,dy=y-h/2;if(behind){dx=-dx;dy=-dy;if(Math.abs(dx)<1&&Math.abs(dy)<1)dy=1;}
        const s=Math.min((w/2-margin)/Math.abs(dx||1e-6),(h/2-margin-30)/Math.abs(dy||1e-6));x=w/2+dx*s;y=h/2+dy*s;angle=Math.atan2(dy,dx)+Math.PI/2;}
      else y-=4;
      hud.marker(true,x,y,angle,label,onScreen);
    }else hud.marker(false);
    if(this.target){v.set(this.target.x,this.target.y,this.target.z).project(this.camera);if(v.z<1)hud.reticle(true,(v.x*.5+.5)*w,(-v.y*.5+.5)*h);else hud.reticle(false);}else hud.reticle(false);
    // Prompts.
    if(this.mode==='free'&&this.nearestLocation&&!this.hud.panelOpen)hud.prompt(`F · ${say(this.options.lang,'Read','阅读')}: ${this.nearestLocation.name[this.options.lang]}`,'interact');
    else if(this.mode==='free'&&this.hover&&!this.hud.panelOpen)hud.prompt(say(this.options.lang,'Steer to fly · T for trials','操纵方向即可起飞 · 按 T 选择试炼'),'');
    else hud.prompt('');
  }

  // ------------------------------------------------------------ frame loop
  _tick(timestamp){
    if(this._disposed)return;
    this._animation=requestAnimationFrame(this._tick);
    const rawDt=this._lastFrame?Math.max(0,(timestamp-this._lastFrame)/1000):0;this._lastFrame=timestamp;
    if(this._contextLost||document.hidden)return;
    const active=this.started&&!this._isPaused();
    // Idle while the landing page or a reading panel covers the world.
    if(!active){if(this._needsRender){this._needsRender=false;this._render();}return;}
    const cpu0=performance.now();
    const frameDt=Math.min(rawDt,.1);this._fps=damp(this._fps,1/Math.max(rawDt,1e-3),3,frameDt);
    let simDt=frameDt;if(this._hitStop>0){const stop=Math.min(this._hitStop,frameDt);this._hitStop-=stop;simDt=frameDt-stop+stop*.06;}
    const panelHold=this.hud.panelOpen&&this.mode!=='results';
    if(!panelHold){
      const steps=Math.max(1,Math.ceil(simDt/STEP-1e-6)),h=simDt/steps;
      for(let i=0;i<steps;i++){this._time+=h;this._simulate(h);}
    }else this._time+=frameDt*.25;
    this._placeCamera(false,frameDt);
    this._updateVisuals(frameDt);
    this.sfx.update(this.hover?0:this.flight.speed,this.flight.boosting,frameDt);
    this._updateHud();
    this._render();
    const cpu=performance.now()-cpu0;
    this._sampleCost(cpu,rawDt*1000,timestamp);
    if(this._time-this._lastSnapshot>=.1)this._emitFrame();
  }
  _render(){
    const timer=this._timer,gl=this._gl;let query=null;
    if(timer&&this._queries.length<4){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
    this.renderer.render(this.scene,this.camera);this._frameCount++;
    if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);this._queries.push(query);}
  }
  _sampleCost(cpuMs,intervalMs,now){
    let cost=intervalMs;
    if(this._timer){
      const gl=this._gl,disjoint=gl.getParameter(this._timer.GPU_DISJOINT_EXT);
      while(this._queries.length&&gl.getQueryParameter(this._queries[0],gl.QUERY_RESULT_AVAILABLE)){const q=this._queries.shift();if(!disjoint)this._gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}
      cost=Math.max(cpuMs,this._gpuMs??cpuMs);
    }
    this._cpuMs=cpuMs;
    const change=this.governor.sample(cost,now);
    if(change){this._resize();this.particles.setLimit(change.effects>0?Math.floor(this.tier.particles*.5):this.tier.particles);}
  }
  _resize(){
    if(this._disposed||!this.renderer)return;
    const rect=this.canvas.getBoundingClientRect();
    const width=Math.max(1,Math.round(rect.width||this.canvas.parentElement?.clientWidth||1)),height=Math.max(1,Math.round(rect.height||this.canvas.parentElement?.clientHeight||1));
    this._width=width;this._height=height;
    const native=globalThis.devicePixelRatio||1,base=Math.min(native,this.tier.pixelRatio,Math.sqrt(MAX_PIXELS[this.tier.id]/(width*height)));
    this._dpr=Math.max(.5,base*this.governor.scale);
    this.renderer.setPixelRatio(this._dpr);this.renderer.setSize(width,height,false);
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    const scale=height*this._dpr*.5/Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5));
    for(const set of [this.staticGlow,this.glow])set.material.uniforms.uScale.value=scale;
    this.particles.material.uniforms.uScale.value=scale;
    this._needsRender=true;
  }

  // ------------------------------------------------------------ snapshot for the site UI
  _legacyProgress(){return {version:1,raceCourse:'academy-trials',visited:[...this.save.discovered].filter(id=>locations.some(l=>l.id===id)),crystals:[...this.save.shards],banished:0,bestTime:null};}
  _emitFrame(force=false){
    if(!force&&this._time-this._lastSnapshot<.1)return;this._lastSnapshot=this._time;
    const f=this.flight,info=this.renderer?.info.render;
    const landmarks=this.mode==='free'&&this.started&&!this._isPaused()?locations.map(l=>{
      const v=(this._v4||=new THREE.Vector3()).set(l.x,l.y+l.height+4,l.z).project(this.camera);const dist=Math.hypot(l.x-f.x,l.z-f.z);
      return {id:l.id,x:v.x*.5+.5,y:-v.y*.5+.5,visible:v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1&&dist>l.radius+20&&dist<240};}):[];
    this.callbacks.onFrame?.({
      started:this.started,paused:this._isPaused()&&this.started,position:{x:f.x,y:f.y,z:f.z},heading:f.heading,
      progress:this._legacyProgress(),health:100,mana:100,spell:0,shield:0,cooldown:0,
      nearest:null,nearestPaper:null,nearestExhibition:null,nearestClock:null,nearestArtifact:null,nearestCompanion:null,
      cameraView:'follow',tour:null,race:null,locomotion:'flying',illumination:{available:false,enabled:false},environment:null,
      fps:this._fps,quality:this.tierId==='medium'?'balanced':this.tierId,drawCalls:info?.calls??0,triangles:info?.triangles??0,
      renderSize:{width:Math.round(this._width*this._dpr),height:Math.round(this._height*this._dpr),samples:this.tier.antialias?4:0},
      audio:{enabled:this.sfx.enabled,status:this.sfx.status},landmarks,
      academy:{mode:this.mode,tier:this.tierId,scale:this.governor.scale,effects:this.governor.effects,gpu:this.gpu,cpuMs:this._cpuMs,gpuMs:this._gpuMs,trees:this.treeCount},
      exhibition:null,
    });
  }

  dispose(){
    if(this._disposed)return;this._disposed=true;
    cancelAnimationFrame(this._animation);
    for(const off of this._listeners.splice(0))off();
    this._resizeObserver?.disconnect();
    this.sfx?.dispose();this.hud?.dispose();
    this.canvas.closest?.('.experience')?.removeAttribute('data-academy');
    this.scene?.traverse(o=>{o.geometry?.dispose();const list=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of list)m.dispose();});
    this.water?.depth.dispose();
    this.renderer?.dispose();
  }
}

function segmentPointDistance(ax,ay,az,bx,by,bz,px,py,pz){
  const dx=bx-ax,dy=by-ay,dz=bz-az,l=dx*dx+dy*dy+dz*dz,t=l?clamp(((px-ax)*dx+(py-ay)*dy+(pz-az)*dz)/l,0,1):0;
  return Math.hypot(px-ax-dx*t,py-ay-dy*t,pz-az-dz*t);
}
