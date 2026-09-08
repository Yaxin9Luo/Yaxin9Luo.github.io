import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../src/world.js';
import {createBuildingColliders,createBridgeColliders} from '../src/collision.js';
import {bridges} from '../src/locations.js';
import {findSafeLanding,stepGroundMotion,queryGroundSupport,GROUND_MOTION} from '../src/ground-motion.js';

// Production world assembly: no substitute terrain or collision proxies.
const rendered=createWorld(new THREE.Scene());
const world={heightAt:rendered.heightAt,colliders:[...createBuildingColliders(),...createBridgeColliders(bridges),...rendered.environmentColliders]};

test('the recorded cherry-grove landing can walk and run continuously across both path edges',()=>{
  const landing=findSafeLanding({x:-66,y:9,z:65},world);assert.equal(landing.valid,true);
  let state={position:{x:-66,y:landing.y,z:65},heading:0},blocked=0;
  for(let i=0;i<330;i++){
    const moved=stepGroundMotion(state,{x:0,z:-1,run:i>=150},1/60,world);
    blocked+=Number(moved.blocked);state=moved;
  }
  assert.equal(blocked,0,`stopped at ${JSON.stringify(state.position)}: ${state.reason}`);
  assert.ok(Math.abs(state.position.z-(65-1.6*2.5-3.8*3))<1e-6);
});

test('actual terrain and blossom triangle normals stay walkable across the previously blocked footprint',()=>{
  for(const z of [65,64.893,64.573,64.3,63.2,62.3,61.5]){
    const feetY=world.heightAt(-66,z),support=queryGroundSupport({x:-66,z,feetY,allowSteps:true},world);
    assert.equal(support.valid,true,`z=${z}: ${support.reason}`);
    assert.ok(support.normal.y>Math.cos(35*Math.PI/180));
  }
});

test('the lilac overlook and path edges remain continuously traversable in both directions',()=>{
  let state={position:{x:48,y:world.heightAt(48,82.5),z:82.5},heading:0};
  for(const direction of [-1,1])for(let i=0;i<150;i++){
    const moved=stepGroundMotion(state,{x:0,z:direction},1/60,world);
    assert.equal(moved.blocked,false,`${JSON.stringify(state.position)}: ${moved.reason}`);state=moved;
  }
  assert.ok(Math.abs(state.position.z-82.5)<1e-6);
});

const takeoff=(x,z,feetY,scene=world)=>queryGroundSupport({x,z,feetY,radius:1,height:5.14,allowSteps:true,maxRise:GROUND_MOTION.stepUp,maxDrop:GROUND_MOTION.stepDown},scene);
test('takeoff accepts open grove paths using the standing footprint datum and still rejects water, edges and roofs',()=>{
  for(const z of [65,64.667,64.3,63.2,60,57,53,49.6]){
    const standing=queryGroundSupport({x:-66,z,feetY:world.heightAt(-66,z),allowSteps:true},world);
    assert.equal(standing.valid,true);
    const clearance=takeoff(-66,z,standing.y);assert.equal(clearance.valid,true,`z=${z}: ${clearance.reason}`);
  }
  assert.equal(takeoff(0,150,world.heightAt(0,150)).valid,false,'actual lake water remains unsupported');
  const [[ax,az],[bx,bz]]=bridges.research,length=Math.hypot(bx-ax,bz-az);
  const edgeX=(ax+bx)/2+(bz-az)/length*2.85,edgeZ=(az+bz)/2-(bx-ax)/length*2.85;
  assert.equal(takeoff(edgeX,edgeZ,7.17).valid,false,'actual bridge edge over water remains unsafe');
  const feetY=queryGroundSupport({x:-66,z:65,feetY:world.heightAt(-66,65),allowSteps:true},world).y;
  const roof={id:'test/late-roof',bottom:feetY+3.4,top:feetY+3.6,planes:[[1,0,0,-64],[-1,0,0,68],[0,0,1,67],[0,0,-1,-63],[0,1,0,feetY+3.6],[0,-1,0,-feetY-3.4]]};
  assert.equal(takeoff(-66,65,feetY,{...world,colliders:[...world.colliders,roof]}).reason,'blocked');
});
