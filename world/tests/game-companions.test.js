import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game} from '../src/game.js';
import {WorldAudio} from '../src/audio.js';
import {stepGroundMotion} from '../src/ground-motion.js';
import {loadAcceptedCompanions} from './helpers/companion-runtime.js';
import {companionAssetDiagnostics} from '../src/companion-assets.js';
before(loadAcceptedCompanions);

function fixture(t){
  const restoreGlobals=[];
  for(const [key,value] of Object.entries({document:{hidden:false},requestAnimationFrame:()=>1,cancelAnimationFrame(){}})){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});restoreGlobals.push(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
  }
  const game=Object.create(Game.prototype),root=new THREE.Group(),scene=new THREE.Scene();scene.add(root);
  Object.assign(game,{scene,world:{root,heightAt:()=>6,occluders:[],portals:[],exhibits:[],crystals:[],wisps:[],update(){}},buildingColliders:[],options:{lang:'en',reducedMotion:false,gameplay:false},audio:new WorldAudio(false),position:new THREE.Vector3(-25,7.3,45),velocity:new THREE.Vector3(),locomotion:{mode:'grounded'},started:true,paused:false,_suspended:false,_contextLost:false,_disposed:false,_listeners:[],callbacks:{},environment:{night:0},
    _time:0,_simulationTime:0,_lastFrame:1000,_lastSnapshot:0,_frameCount:0,fps:60,mana:100,cooldown:0,shield:0,_invulnerable:0,_hitShake:0,_keys:new Set(),_controls:{},_touch:{x:0,z:0},_messageTimes:new Map(),_previous:new THREE.Vector3(),_scratch:new THREE.Vector3(),_forward:new THREE.Vector3(),_projected:new THREE.Vector3(),_pointerNDC:new THREE.Vector2(),_raycaster:new THREE.Raycaster(),_flightPlane:new THREE.Plane(new THREE.Vector3(0,1,0),-7.3),_destinationMesh:new THREE.Group(),
    canvas:{width:800,height:600,style:{},focus(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},renderer:{shadowMap:{},info:{reset(){}},dispose(){}},rendering:{render(){},dispose(){}},camera:new THREE.PerspectiveCamera(43,4/3,.1,500),exhibitionStage:{group:{position:new THREE.Vector3(100,6,100)},update(){},dispose(){},setLanguage(){}},
    _move(){},_updateEnvironment(){},_updateEnemies(){},_updateProjectiles(){},_updateRace(){},_updateParticles(){},_updateWizard(){},_updateCamera(){},_updateTarget(){},_idleWisps(){},_commit(){return false;},_message(){}});
  t.after(()=>{try{game.dispose();}finally{for(const restore of restoreGlobals)restore();}});return game;
}
const actor=(game,id='elizabeth')=>game.companions.snapshot().actors.find(a=>a.id===id);
function approach(game,id='elizabeth'){
  const a=actor(game,id);game.position.set(a.position.x,a.position.y+1.3,a.position.z+4.5);game._updateCompanions(0);game._updateInteractions();return a;
}

test('Game joins one actual actor installation after world readiness and disposes only its instance resources',async t=>{
  const game=fixture(t),before=companionAssetDiagnostics().liveActors;let release;const worldReady=new Promise(resolve=>{release=resolve;});
  const first=game._loadCompanions({},worldReady);assert.equal(first,game._loadCompanions());assert.equal(game.companionSnapshot().installation.status,'loading');await Promise.resolve();assert.equal(game.companions,undefined);
  release();await first;assert.equal(game.companionRoot.children.length,2);assert.equal(game.companionSnapshot().installation.status,'ready');assert.equal(companionAssetDiagnostics().liveActors,before+2);assert.equal(game.audio.context,null);
  game.dispose();game.dispose();assert.equal(companionAssetDiagnostics().liveActors,before);assert.equal(game.world.root.children.length,0);assert.equal(game.world.occluders.length,0);
});

test('Game disposal during deferred world readiness prevents a late actual install',async t=>{
  const game=fixture(t);let release;const request=game._loadCompanions({},new Promise(resolve=>{release=resolve;})),rejected=assert.rejects(request,{name:'AbortError'});game.dispose();release();await rejected;assert.equal(game.companions,undefined);assert.equal(game.world.root.children.length,0);
});

test('actual frame substeps drive companions once and recheck synchronous pause before advancing them',async t=>{
  const game=fixture(t);await game._loadCompanions();game._tick(1125);assert.ok(Math.abs(game.companions.snapshot().activeTime-7/60)<1e-9,'one 125ms frame accepts seven complete controller substeps');
  const before=game.companions.snapshot().activeTime;game.callbacks.onFrame=undefined;game._updateInteractions=()=>game.setPaused(true);game._tick(1250);assert.equal(game.companions.snapshot().activeTime,before);assert.equal(game.companions.snapshot().paused,true);
  game.setPaused(false);game._lastFrame=1250;game._updateInteractions=()=>{};game._tick(1500);assert.ok(game.companions.snapshot().activeTime>before);
  const snapshot=game.companions.snapshot();game.rendering.render(1);game.companionSnapshot();assert.deepEqual(game.companions.snapshot(),snapshot);
});

test('E, repeated input, language and pause use the real guarded companion path',async t=>{
  const game=fixture(t);await game._loadCompanions();approach(game);let prevented=0;
  const event={code:'KeyE',target:{closest:()=>null},preventDefault(){prevented++;},repeat:false};game._keyDown(event);assert.equal(actor(game).interactionCount,1);game._keyDown(event);game._keyDown({...event,repeat:true});assert.equal(actor(game).interactionCount,1);assert.equal(prevented,3);
  const clipTime=actor(game).clipTime;game.setOption('lang','zh');assert.equal(game.companions.snapshot().language,'zh');assert.equal(actor(game).clipTime,clipTime);
  game.setPaused(true);const before=game.companions.snapshot();assert.equal(game.interact({companionId:'sadaharu'}),false);game._updateCompanions(.25);assert.deepEqual(game.companions.snapshot(),before);
});

test('review demand rendering refreshes real reduced actor signs, language and pause without advancing their pose',async t=>{
  const game=fixture(t);game.options.reducedMotion=true;game._reviewRendering={pending:true,staticComparison:false,continuous:false,lastView:null,idle:false};game.setReviewRendering({staticComparison:true});
  await game._loadCompanions();approach(game);let draws=0;game.rendering.render=()=>draws++;
  game._tick(1017);game._tick(1034);assert.equal(draws,1);assert.equal(game.interact({companionId:'elizabeth'}),true);const receipt=actor(game),time=receipt.clipTime;
  game._tick(1051);game._tick(1068);assert.equal(draws,2);assert.equal(actor(game).interactionCount,1);assert.equal(actor(game).clipTime,time);
  game.setOption('lang','zh');game._tick(1085);game._tick(1102);assert.equal(draws,3);assert.equal(game.companions.snapshot().language,'zh');assert.equal(actor(game).clipTime,time);
  game.setPaused(true);game._tick(1119);game._tick(1136);assert.equal(draws,4);assert.equal(actor(game).clipTime,time);assert.equal(game.reviewRenderingSnapshot().idle,true);
});

test('portfolio candidates retain priority over the nearest friendly actor',async t=>{
  const game=fixture(t);await game._loadCompanions();approach(game);const calls=[];game.callbacks={onExhibition:id=>calls.push('exhibition:'+id),onExhibit:id=>calls.push('paper:'+id),onInteract:id=>calls.push('portal:'+id)};game.cycleTime=()=>calls.push('clock');game._activateArtifact=()=>calls.push('artifact');
  for(const [key,value,expected] of [['nearestExhibition','autodesign','exhibition:autodesign'],['nearestClock',true,'clock'],['nearestArtifact',{action:{kind:'cv'}},'artifact'],['nearestPaper','dvin','paper:dvin'],['nearest','projects','exhibition:autodesign'],['nearest','about','portal:about']]){for(const name of ['nearestExhibition','nearestClock','nearestArtifact','nearestPaper','nearest'])game[name]=null;game[key]=value;assert.equal(game.interact({companionId:'elizabeth'}),true);assert.equal(calls.at(-1),expected);assert.equal(actor(game).interactionCount,0);}
});

test('actual descendant mesh clicking rejects drags, occlusion and distant visitors',async t=>{
  const game=fixture(t);await game._loadCompanions();const a=approach(game);game.camera.position.set(a.position.x,a.position.y+1.5,a.position.z+7);game.camera.lookAt(a.position.x,a.position.y+1.5,a.position.z);game.camera.updateMatrixWorld();
  const click=moved=>{game._pointer={id:1,button:0,moved};game._pointerUp({pointerId:1,clientX:400,clientY:300});};
  click(true);assert.equal(actor(game).interactionCount,0);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(8,8,.25),new THREE.MeshBasicMaterial());wall.position.set(a.position.x,a.position.y+2,a.position.z+2.5);wall.updateMatrixWorld();game.world.occluders.push(wall);click(false);assert.equal(actor(game).interactionCount,0);game.world.occluders.pop();wall.geometry.dispose();wall.material.dispose();
  game.position.x-=40;click(false);assert.equal(actor(game).interactionCount,0);approach(game);game._raycaster.setFromCamera(new THREE.Vector2(),game.camera);assert.ok(game._pickWorldTarget(game.companions.pickMeshes,130),'the camera ray hits an actual accepted descendant');assert.equal(game._companionReachable('elizabeth'),true);click(false);assert.equal(actor(game).interactionCount,1);
});

test('live visitor volume makes actual companions yield, and their full bodies also block player walking',async t=>{
  const game=fixture(t);await game._loadCompanions();const a=actor(game);game.position.set(a.position.x,a.position.y+1.3,a.position.z+1.8);for(let i=0;i<300;i++)game._updateCompanions(1/60);assert.equal(actor(game).distance,0);assert.equal(actor(game).valid,true,'yielding does not hide the actor');
  const start={position:{x:a.position.x,y:a.position.y,z:a.position.z+3.5},heading:0},walk=stepGroundMotion(start,{x:0,z:-1,run:true},1,game._groundWorld());assert.equal(walk.blocked,true);assert.ok(walk.position.z>a.position.z+1.5);
  game.position.set(-25,7.3,45);for(let i=0;i<600;i++)game._updateCompanions(1/60);assert.ok(actor(game).distance>1,'clearing the visitor resumes actual travel');
});

test('blur, hidden-document and context loss synchronously pause the owner and cancel its voice tails',async t=>{
  const game=fixture(t);await game._loadCompanions();const owners=[],handlers=new Map(),previous=globalThis.window;
  const events=target=>{target.addEventListener=(name,fn)=>handlers.set(target===game.canvas?'canvas:'+name:target===document?'document:'+name:'window:'+name,fn);target.removeEventListener=()=>{};return target;};
  globalThis.window=events({});t.after(()=>previous===undefined?delete globalThis.window:globalThis.window=previous);events(document);events(game.canvas);game.canvas.hasAttribute=()=>true;game._watchPixelRatio=()=>{};
  game.audio.cancelCompanionVoices=owner=>owners.push(owner);game._bindEvents();
  for(const [pause,resume] of [['window:blur','window:focus'],['document:visibilitychange','document:visibilitychange'],['canvas:webglcontextlost','canvas:webglcontextrestored']]){
    game._updateCompanions(.1);const time=game.companions.snapshot().activeTime;if(pause.startsWith('document:'))document.hidden=true;
    handlers.get(pause)({preventDefault(){}});assert.equal(game.companions.snapshot().paused,true);assert.ok(owners.includes(game.companions.snapshot().owner));game._updateCompanions(.25);assert.equal(game.companions.snapshot().activeTime,time);
    document.hidden=false;handlers.get(resume)({});assert.equal(game.companions.snapshot().paused,false);assert.equal(game._lastFrame,0);
  }
});


test('invisible ancestors cannot occlude portfolio or friendly targets while visible accepted peers still block',async t=>{
  const game=fixture(t);await game._loadCompanions();const e=actor(game),s=actor(game,'sadaharu');
  const target=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));target.position.set(e.position.x,e.position.y+1.5,e.position.z-3);target.userData.paper='dvin';game.scene.add(target);target.updateMatrixWorld();game.world.exhibits=[{group:target}];
  game._raycaster.set(new THREE.Vector3(e.position.x,e.position.y+1.5,e.position.z+7),new THREE.Vector3(0,0,-1));
  assert.equal(game._pickWorldTarget([target],130),null);assert.equal(game._pickExhibit(),null);
  game.world.heightAt=(_x,z)=>z>42?undefined:6;game.companionSupport.invalidate();game.companions.rebind({});
  assert.equal(actor(game).valid,false);assert.equal(actor(game,'sadaharu').valid,true);assert.ok(game.companions.pickMeshes.every(mesh=>mesh.userData.companionId!=='elizabeth'));
  const raw=game._raycaster.intersectObjects(game.world.occluders,true);assert.equal(raw[0].object.userData.companionId,'elizabeth','Three still intersects the hidden actual mesh');
  assert.ok(game._pickWorldTarget([target],130)?.object===target,'hidden Elizabeth no longer blocks the portfolio target');assert.ok(game._pickExhibit()?.object===target,'the paper path uses the same visible blocker rule');
  target.position.z=s.position.z-4;target.updateMatrixWorld();assert.equal(game._pickWorldTarget([target],130),null,'the visible dog behind the hidden actor still blocks the farther target');
  approach(game,'sadaharu');const wallParent=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(5,5,.3),new THREE.MeshBasicMaterial());wall.position.set(s.position.x,s.position.y+1.5,s.position.z+2);wallParent.add(wall);game.scene.add(wallParent);wallParent.updateMatrixWorld(true);game.world.occluders.push(wallParent);
  assert.equal(game._companionReachable('sadaharu'),false);wallParent.visible=false;assert.equal(wall.visible,true);assert.equal(game._companionReachable('sadaharu'),true,'all ancestors, not only the intersected child, determine visible occlusion');
});
