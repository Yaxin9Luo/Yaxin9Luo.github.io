import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import * as THREE from 'three';
import {Game} from '../src/game.js';

// Actual Game methods with two tiny opaque meshes; no Game constructor, model
// loading, texture decoding, WebGL renderer or complete world is involved.
function fixture(t){
  const scene=new THREE.Scene(),group=new THREE.Group(),geometry=new THREE.BoxGeometry(1,4,.2),material=new THREE.MeshStandardMaterial();
  const sources=[.2,1.5].map(x=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,1,.2);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;});
  scene.add(group);
  const target=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());target.position.set(.2,1.4,-3);target.userData.paper='fixture-paper';scene.add(target);
  const lifetime=new AbortController(),events=[];let draws=0;
  const heightAt=()=>0,colliders=[{id:'herbarium/fixture',bottom:-1,top:3,planes:[[1,0,0,.7],[-1,0,0,.3]]}];
  const world={complete:false,root:scene,herbarium:{group},heightAt,environmentColliders:colliders,occluders:[group],exhibits:[{group:target}],dispose(){assert.ok(sources.every(mesh=>mesh.visible),'source visibility restored before its world owner disposes');events.push('world');}};
  const game=Object.assign(Object.create(Game.prototype),{
    scene,world,started:true,paused:false,_contextLost:false,_disposed:false,_suspended:false,_lifetimeSignal:lifetime.signal,_listeners:[],_frameCount:0,
    position:new THREE.Vector3(.2,0,3),camera:new THREE.PerspectiveCamera(),_raycaster:new THREE.Raycaster(new THREE.Vector3(.2,1.2,3),new THREE.Vector3(0,0,-1)),
    renderer:{info:{reset(){}},dispose(){events.push('renderer');}},
    rendering:{render(){draws++;},dispose(){events.push('rendering');}},audio:{dispose(){}},
    companions:{snapshot:()=>({actors:[{id:'elizabeth',valid:true,position:{x:.2,y:0,z:-3}}]})},
  });
  const previous=Object.getOwnPropertyDescriptor(globalThis,'cancelAnimationFrame');Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value(){}});
  t.after(()=>{try{game.dispose();}finally{if(previous)Object.defineProperty(globalThis,'cancelAnimationFrame',previous);else delete globalThis.cancelAnimationFrame;}});
  scene.updateMatrixWorld(true);
  return {game,group,sources,target,geometry,material,lifetime,events,colliders,heightAt,draws:()=>draws};
}

test('Game batches only the completed world, once, and restores before source-owner disposal',t=>{
  const f=fixture(t),{game,sources,lifetime,geometry}=f;let geometryDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);
  assert.equal(game._renderFrame(0),true);assert.equal(game._herbariumRenderBatches,undefined);assert.ok(sources.every(mesh=>mesh.visible));
  game.world.complete=true;game._contextLost=true;assert.equal(game._renderFrame(0),false);assert.equal(game._herbariumRenderBatches,undefined);
  game._contextLost=false;assert.equal(game._renderFrame(0),true);const handle=game._herbariumRenderBatches;
  assert.equal(handle.metrics.batchCount,1);assert.equal(handle.metrics.batchedMeshCount,2);assert.equal(getEventListeners(lifetime.signal,'abort').length,1);
  assert.equal(game._renderFrame(0),true);assert.equal(game._herbariumRenderBatches,handle);assert.equal(f.draws(),3);
  assert.equal(game.world.heightAt,f.heightAt);assert.equal(game.world.environmentColliders,f.colliders);assert.equal(game.world.heightAt(.2,.2),0);
  game.dispose();assert.ok(f.events.indexOf('world')<f.events.indexOf('renderer'));assert.equal(handle.metrics.active,false);assert.equal(handle.batches.length,0);assert.equal(getEventListeners(lifetime.signal,'abort').length,0);assert.equal(geometryDisposals,1);
  assert.equal(game._renderFrame(0),false);game.dispose();assert.equal(geometryDisposals,1);
});

test('Game retains portfolio and paper occlusion when a visible herbarium source becomes a render instance',t=>{
  const {game,target}=fixture(t);
  assert.equal(game._pickWorldTarget([target],20),null);assert.equal(game._pickExhibit(),null);
  game.world.complete=true;game._renderFrame(0);game.scene.updateMatrixWorld(true);
  assert.equal(game._herbariumRenderBatches.metrics.batchCount,1);
  assert.ok(game._pickWorldTarget([target],20)===null,'the rendered herbarium must still block the portfolio target');
  assert.ok(game._pickExhibit()===null,'the same visible source must still block the paper path');
});

test('Game retains companion reachability occlusion after installing herbarium render batches',t=>{
  const {game}=fixture(t);
  assert.equal(game._companionReachable('elizabeth'),false);
  game.world.complete=true;game._renderFrame(0);game.scene.updateMatrixWorld(true);
  assert.equal(game._herbariumRenderBatches.metrics.batchCount,1);
  assert.equal(game._companionReachable('elizabeth'),false,'an actor behind the rendered herbarium remains unreachable');
});

test('Game still ignores a genuinely hidden ancestor and restores original occlusion after batching ends',t=>{
  const {game,group,target,lifetime}=fixture(t);
  game.world.complete=true;game._renderFrame(0);game.scene.updateMatrixWorld(true);
  group.visible=false;
  assert.equal(game._pickWorldTarget([target],20)?.object,target);
  assert.equal(game._pickExhibit()?.object,target);
  assert.equal(game._companionReachable('elizabeth'),true,'runtime suppression must not override an authored hidden ancestor');
  group.visible=true;
  lifetime.abort();
  assert.equal(game._herbariumRenderBatches.metrics.active,false);
  assert.equal(game._pickWorldTarget([target],20),null);
  assert.equal(game._pickExhibit(),null);
  assert.equal(game._companionReachable('elizabeth'),false);
});
