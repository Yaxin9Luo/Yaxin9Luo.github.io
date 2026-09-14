import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game} from '../src/game.js';
import {createExhibitionStage} from '../src/exhibits.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));

// Actual stage geometry, media selection/material callbacks and Game frame
// dispatch. Only local texture I/O, lettering canvas and GPU submission are
// controlled here; this does not claim a native image or rendering speed.
async function fixture(t,{delayedSurfaces=false}={}){
  const pendingMedia=[],pendingSurfaces=[],textures=new Set(),frames=[];let timestamp=1000;
  const document={hidden:false,createElement(){const canvas={texts:[],width:0,height:0};canvas.getContext=()=>({fillRect(){},strokeRect(){},measureText:text=>({width:text.length*8}),fillText:text=>canvas.texts.push(text)});return canvas;}};
  for(const [name,value]of Object.entries({document,requestAnimationFrame:()=>1,cancelAnimationFrame(){}})){
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);
  }
  const texture=()=>{const value=new THREE.Texture({width:1200,height:800});textures.add(value);value.addEventListener('dispose',()=>textures.delete(value));return value;};
  const game=Object.create(Game.prototype);
  Object.assign(game,{started:true,paused:false,_suspended:false,_contextLost:false,_disposed:false,options:{reducedMotion:true,gameplay:false},_reviewRendering:{pending:true,staticComparison:true,continuous:false,lastView:null,idle:false},
    _time:0,_simulationTime:0,_lastFrame:1000,_lastSnapshot:0,_frameCount:0,fps:60,mana:100,shield:0,cooldown:0,_invulnerable:0,_hitShake:0,_keys:new Set(),_controls:{},_touch:{x:0,z:0},
    scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(43,16/9,.1,1000),position:new THREE.Vector3(38,25,92),velocity:new THREE.Vector3(),heading:0,_forward:new THREE.Vector3(),
    canvas:{width:800,height:450},world:{wisps:[],update(){}},audio:{update(){}},renderer:{shadowMap:{},info:{reset(){}}},
    _updateEnvironment(){},_move(){},_updateEnemies(){},_updateProjectiles(){},_updateInteractions(){},_updateRace(){},_updateParticles(){},_updateWizard(){},_updateCamera(){},_updateTarget(){},_emitFrame(){},callbacks:{}});
  game.camera.position.set(38,25,92);game.camera.lookAt(62,7,57);
  const stage=createExhibitionStage(game.scene,()=>6,{
    onVisualChange:()=>game.requestRender(),
    loadMedia:src=>new Promise((resolve,reject)=>pendingMedia.push({src,resolve,reject})),
    loadSurface:(set,channel)=>delayedSurfaces?new Promise((resolve,reject)=>pendingSurfaces.push({set,channel,resolve,reject})):texture(),
  });
  game.exhibitionStage=stage;
  const screen=stage.group.getObjectByName('exhibition-current-media'),print=stage.group.getObjectByName('exhibition-output-print');
  const status=stage.group.children.find(mesh=>mesh.name==='exhibition-lettered-surface'&&Math.abs(mesh.position.y-3.76)<1e-8);
  game.rendering={render(){frames.push({source:stage.loadedSource,map:screen.material.map,print:print.material.map,status:[...(status.material.map?.image.texts||[])]});}};
  const tick=()=>game._tick(timestamp+=20);
  await flush();if(!delayedSurfaces)await stage.materialsReady;
  tick();tick();assert.equal(frames.length,1);assert.equal(game.reviewRenderingSnapshot().idle,true);
  t.after(()=>{stage.dispose();for(const value of textures)value.dispose();});
  return {game,stage,screen,print,status,pendingMedia,pendingSurfaces,texture,frames,tick};
}

test('a real late atelier image wakes one static Game pass after applying both image surfaces and status',async t=>{
  const qa=await fixture(t),{game,stage,frames,screen,print}=qa,initial=frames.length,clock=game._simulationTime,lastFrame=game._lastFrame,view=game.camera.position.clone(),pose=stage.motionState;
  assert.match(frames.at(-1).status.join(' '),/Loading image/);const image=qa.texture();qa.pendingMedia[0].resolve(image);await flush();
  assert.equal(stage.loadedSource,qa.pendingMedia[0].src);assert.equal(screen.material.map,image);assert.equal(print.material.map,image);assert.equal(screen.visible,true);assert.equal(print.visible,true);
  assert.equal(game._simulationTime,clock);assert.equal(game._lastFrame,lastFrame);assert.deepEqual(game.camera.position,view);assert.deepEqual(stage.motionState,pose);
  assert.equal(game.reviewRenderingSnapshot().pending,true);qa.tick();qa.tick();assert.equal(frames.length,initial+1);assert.equal(frames.at(-1).map,image);assert.doesNotMatch(frames.at(-1).status.join(' '),/Loading image/);assert.equal(game.reviewRenderingSnapshot().idle,true);
  assert.ok(Math.abs(game._simulationTime-clock-.04)<1e-9,'normal ticks retain actual accepted time');
});

test('individual late atelier material channels and errors request a pass before the slowest channel settles',async t=>{
  const qa=await fixture(t,{delayedSurfaces:true}),{game,stage,frames}=qa;assert.equal(qa.pendingSurfaces.length,24);
  let settled=false;stage.materialsReady.then(()=>{settled=true;});const wood=stage.group.getObjectsByProperty('isMesh',true).find(mesh=>mesh.material?.name==='Atelier wood').material,image=qa.texture();
  qa.pendingSurfaces[0].resolve(image);await flush();assert.ok(wood.map===image,'the real first wood channel is assigned');assert.equal(settled,false);assert.equal(game.reviewRenderingSnapshot().pending,true);
  qa.tick();qa.tick();assert.equal(frames.length,2);
  qa.pendingSurfaces[1].reject(new Error('delayed normal unavailable'));await flush();assert.equal(stage.materialErrors.length,1);qa.tick();qa.tick();assert.equal(frames.length,3);assert.equal(settled,false);
  for(const job of qa.pendingSurfaces.slice(2))job.resolve(qa.texture());await stage.materialsReady;qa.tick();qa.tick();assert.equal(frames.length,4,'many channel completions coalesce into one actual pass');
});

test('late atelier media failure refreshes retained-image status while obsolete and disposed results stay silent',async t=>{
  const qa=await fixture(t),{game,stage,frames}=qa;
  stage.setMedia(1);const image=qa.texture();qa.pendingMedia[1].resolve(image);await flush();qa.tick();qa.tick();const accepted=frames.length,revision=game.reviewRenderingSnapshot().requestedRevision;
  qa.pendingMedia[0].resolve(qa.texture());await flush();qa.tick();qa.tick();assert.equal(frames.length,accepted);assert.equal(game.reviewRenderingSnapshot().requestedRevision,revision);assert.equal(stage.loadedSource,qa.pendingMedia[1].src);
  stage.setMedia(2);qa.tick();qa.tick();const loading=frames.length;qa.pendingMedia[2].reject(new Error('offline'));await flush();qa.tick();qa.tick();assert.equal(frames.length,loading+1);assert.equal(frames.at(-1).map,image);assert.match(frames.at(-1).status.join(' '),/Previous image retained/);
  stage.setMedia(3);qa.tick();qa.tick();stage.dispose();const disposedRevision=game.reviewRenderingSnapshot().requestedRevision;const late=qa.texture();let releases=0;late.addEventListener('dispose',()=>releases++);qa.pendingMedia[3].resolve(late);await flush();
  assert.equal(releases,1);assert.equal(game.reviewRenderingSnapshot().requestedRevision,disposedRevision);assert.equal(game.reviewRenderingSnapshot().pending,false);
});

for(const outcome of ['success','failure'])test(`obsolete atelier media ${outcome} stays silent after the current selection error was drawn`,async t=>{
  const qa=await fixture(t),{game,stage,frames,screen,print,status}=qa;
  stage.setMedia(1);qa.tick();qa.tick();qa.pendingMedia[1].reject(new Error('current image unavailable'));await flush();qa.tick();qa.tick();
  assert.match(frames.at(-1).status.join(' '),/Previous image retained/);assert.equal(game.reviewRenderingSnapshot().idle,true);
  const revision=game.reviewRenderingSnapshot().requestedRevision,draws=frames.length,statusMap=status.material.map,screenMap=screen.material.map,printMap=print.material.map,source=stage.loadedSource;
  if(outcome==='success')qa.pendingMedia[0].resolve(qa.texture());else qa.pendingMedia[0].reject(new Error('obsolete image unavailable'));
  await flush();assert.equal(game.reviewRenderingSnapshot().requestedRevision,revision,'obsolete completion must not request a frame using the current error');assert.equal(game.reviewRenderingSnapshot().pending,false);
  assert.ok(status.material.map===statusMap,'obsolete completion must not replace the current status texture');assert.ok(screen.material.map===screenMap);assert.ok(print.material.map===printMap);assert.equal(stage.loadedSource,source);
  qa.tick();qa.tick();assert.equal(frames.length,draws,'obsolete completion must not render another full frame');assert.equal(game.reviewRenderingSnapshot().idle,true);
});

test('atelier surface completion and failure after disposal never request another frame',async t=>{
  const qa=await fixture(t,{delayedSurfaces:true}),{game,stage}=qa;stage.dispose();const revision=game.reviewRenderingSnapshot().requestedRevision;
  qa.pendingSurfaces.forEach((job,index)=>index===0?job.reject(new Error('closed')):job.resolve(qa.texture()));await stage.materialsReady;
  assert.equal(game.reviewRenderingSnapshot().requestedRevision,revision);assert.equal(game.reviewRenderingSnapshot().pending,false);assert.equal(stage.group.parent,null);
});
