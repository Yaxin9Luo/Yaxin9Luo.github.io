import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game} from '../src/game.js';
import {queryGroundSupport} from '../src/ground-motion.js';
import {resolveRiderCollision} from '../src/collision.js';
import {spawn} from '../src/locations.js';

const bench=(width=.9,depth=2.2)=>({id:'garden/late-bench',walkable:false,bottom:0,top:1.35,
  planes:[[1,0,0,width/2],[-1,0,0,width/2],[0,0,1,depth/2],[0,0,-1,depth/2],[0,1,0,1.35],[0,-1,0,0]]});
function fixture(mode='grounded'){
  const game=Object.create(Game.prototype);
  Object.assign(game,{locomotion:{mode,progress:.95,originY:1.3,support:{valid:true,y:0,normal:{x:0,y:1,z:0}},groundSpeed:1.6,gaitPhase:.2},
    position:new THREE.Vector3(0,1.3,0),_previous:new THREE.Vector3(),velocity:new THREE.Vector3(1,0,0),wizard:new THREE.Group(),
    heading:0,cameraYaw:0,world:{heightAt:()=>0},buildingColliders:[bench()],_touch:{x:1,z:0},_keys:new Set(['KeyW']),_controls:{boost:true},
    _destination:new THREE.Vector3(2,0,0),_destinationMesh:{visible:true},_pendingCast:{cost:7},mana:93,_characterCastActive:true,
    _projectiles:[],renderer:{shadowMap:{}},_message(){},_updateCamera(){},_emitFrame(){}});
  return game;
}

for(const mode of ['grounded','dismounting'])test(`late scenery recovers ${mode} onto nearby valid support and cancels input/cast once`,()=>{
  const game=fixture(mode);game._moveOnGround(.05);
  assert.equal(game.locomotion.mode,'grounded');
  assert.ok(game.position.length()>1.3,'must leave the newly occupied point');
  assert.ok(Math.hypot(game.position.x,game.position.z)<=1.01,'use nearest clear ring beside the bench');
  assert.equal(queryGroundSupport({x:game.position.x,z:game.position.z,feetY:game.position.y-1.3},game._groundWorld()).valid,true);
  assert.equal(game.mana,100);assert.equal(game._pendingCast,null);assert.equal(game._characterCastActive,false);
  assert.equal(game._keys.size,0);assert.deepEqual(game._touch,{x:0,z:0});assert.equal(game._destination,null);assert.equal(game.velocity.length(),0);
  const position=game.position.clone();game._moveOnGround(.05);assert.equal(game.mana,100);assert.ok(game.position.distanceTo(position)<1e-8);
});

test('recovery falls back to the existing spawn if every nearby ground sample is obstructed',()=>{
  const game=fixture();game.buildingColliders=[bench(12,12)];game._moveOnGround(.05);
  assert.equal(game.locomotion.mode,'flying');assert.equal(game.position.x,spawn.x);assert.equal(game.position.z,spawn.z);
  assert.equal(resolveRiderCollision(game.position,{x:0,y:0,z:0},game.buildingColliders,{radius:1,halfHeight:2}).collided,false);
  assert.equal(game._pendingCast,null);assert.equal(game.mana,100);
});

test('fallback also validates flight clearance when late scenery occupies the spawn',()=>{
  const game=fixture(),occupiedSpawn={...bench(8,8),id:'late/spawn-roof',top:23,
    planes:[[1,0,0,spawn.x+4],[-1,0,0,-spawn.x+4],[0,0,1,spawn.z+4],[0,0,-1,-spawn.z+4],[0,1,0,23],[0,-1,0,0]]};
  game.buildingColliders=[bench(12,12),occupiedSpawn];game._moveOnGround(.05);
  assert.equal(game.locomotion.mode,'flying');assert.ok(game.position.y>25);
  assert.equal(resolveRiderCollision(game.position,{x:0,y:0,z:0},game.buildingColliders,{radius:1,halfHeight:2}).collided,false);
});

test('a mounting rollback also recovers when its original standing point became occupied',()=>{
  const game=fixture('mounting');game.position.y=2;game._moveOnGround(.05);
  assert.equal(game.locomotion.mode,'grounded');assert.equal(game.locomotion.support.valid,true);
  assert.ok(Math.hypot(game.position.x,game.position.z)>.7);
});

test('world collider registration recovers a paused grounded rider before another movement tick',()=>{
  const game=fixture();game.paused=true;game._landscapeLighting=[];
  Object.assign(game.world,{root:new THREE.Group(),environmentColliders:[bench()],environmentLighting:{lights:[],emissiveMaterials:[],nightMaterials:[],nightObjects:[]}});
  game.exhibitionStage={group:new THREE.Group(),colliders:[]};game._updateEnvironment=()=>{};game._syncDiscoveries=()=>{};
  game._refreshWorldBindings();assert.equal(game.locomotion.support.valid,true);
  assert.ok(Math.hypot(game.position.x,game.position.z)>.7);assert.equal(game.paused,true);
});

test('a valid support check leaves an in-progress dismount and pending cast state untouched',()=>{
  const game=fixture('dismounting');game.buildingColliders=[];game.locomotion.progress=.2;
  game._moveOnGround(.05);assert.equal(game.locomotion.mode,'dismounting');assert.ok(game.locomotion.progress>.2);
  assert.equal(game.mana,93);assert.ok(game._pendingCast);
});
