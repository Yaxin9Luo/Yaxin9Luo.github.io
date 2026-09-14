import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanionSupport} from '../src/companion-support.js';
import {sampleGroundSurface} from '../src/ground-motion.js';
import {evaluateCompanionSweep} from '../src/companion-system.js';

function box(id,x,z,width,depth,bottom,top,heading=0,walkable=false){
  const c=Math.cos(heading),s=Math.sin(heading),u=c*x-s*z,v=s*x+c*z;
  return {id,bottom,top,walkable,planes:[[c,0,-s,u+width/2],[-c,0,s,-u+width/2],[s,0,c,v+depth/2],[-s,0,-c,-v+depth/2],[0,1,0,top],[0,-1,0,-bottom]]};
}
const pose=(x,z,heading=0)=>({x,z,heading});

test('local actual-plane support matches full scans, including tile seams and binding replacement',()=>{
  let world={heightAt:(x,z)=>1+.0001*x+.0002*z,colliders:[box('floor',0,0,24,24,.9,1.141,0,true),box('left',-3.03,0,5.94,12,1.12,1.171,0,true),box('right',3.03,0,5.94,12,1.12,1.171,0,true),box('overhead',0,0,24,24,4,4.2,0,true)]};
  const support=createCompanionSupport(()=>world);
  const compare=()=>{for(let x=-8;x<=8;x+=.23)for(let z=-6;z<=6;z+=.41){const expected=sampleGroundSurface(x,z,world.heightAt(x,z)+.3,world),actual=support.heightAt.surfaceAt(x,z);assert.equal(actual.height,expected.y);assert.equal(actual.surfaceId,expected.surfaceId);assert.deepEqual(actual.normal,expected.normal);}};
  compare();assert.equal(support.heightAt(0,0),1.141);
  world={heightAt:()=>1,colliders:[box('cell-one edge',4.5,0,1,2,1,1.18,0,true)]};
  const edge=4-5e-6;assert.equal(sampleGroundSurface(edge,0,1.3,world).surfaceId,'cell-one edge');assert.equal(support.heightAt.surfaceAt(edge,0).surfaceId,'cell-one edge');
  world={heightAt:()=>1,colliders:[box('rotated cell edge',5+1.2e-5,0,Math.SQRT2,Math.SQRT2,1,1.18,Math.PI/4,true)]};
  assert.equal(sampleGroundSurface(4-1e-6,0,1.3,world).surfaceId,'rotated cell edge');assert.equal(support.heightAt.surfaceAt(4-1e-6,0).surfaceId,'rotated cell edge');
  const fallback=box('equal-height fallback',0,0,4,4,1,1.18,0,true);fallback.planes=fallback.planes.map(([a,b,c,d])=>[a,b===0?.02:b,c,d]);
  world={heightAt:()=>1,colliders:[fallback,box('equal-height indexed',0,0,2,2,1,1.18,0,true)]};assert.equal(sampleGroundSurface(0,0,1.3,world).surfaceId,'equal-height indexed');assert.equal(support.heightAt.surfaceAt(0,0).surfaceId,'equal-height indexed');
  world={heightAt:()=>2,colliders:[box('replacement',0,0,10,10,1.9,2.18,0,true)]};compare();assert.equal(support.heightAt(0,0),2.18);
  world.colliders.push(box('in-place',0,0,2,2,1.9,2.24,0,true));support.invalidate();assert.equal(support.heightAt(0,0),2.24);
  support.dispose();assert.equal(support.heightAt(0,0),undefined);assert.equal(support.collidersFor(pose(0,0),pose(1,1)),null);
});

test('indexed full-body and active-board sweeps match unfiltered scans for rails, tall solids, support and fallback geometry',()=>{
  const solids=[box('floor',0,0,40,40,0,1.141,0,true),box('brick',0,0,2,2,1.12,1.171,0,true),box('thin rail',3,0,.025,9,1.15,2.4,.43),box('tall prop',-3,4,.7,.7,1,12),box('overhead',0,-4,4,4,3.3,3.5,0,true),box('far prop',70,80,3,3,1,10)];
  const fallback={id:'sloped sides',bottom:0,top:8,walkable:false,planes:[[1,.1,0,12],[-1,.1,0,12],[0,.1,1,12],[0,.1,-1,12],[0,1,0,8],[0,-1,0,0]]};
  // A sloped convex shape cannot be reduced to vertical-plane bounds and must
  // remain a candidate. Its far location is expressed by translated planes.
  fallback.planes=fallback.planes.map(([a,b,c,d])=>[a,b,c,d+a*50+c*50]);solids.push(fallback);
  let world={heightAt:()=>1,colliders:solids,waterLevel:0};const support=createCompanionSupport(()=>world);
  let comparisons=0,blocked=0,clear=0;
  for(const kind of ['elizabeth','sadaharu'])for(const interaction of [false,true])for(const [from,to] of [[pose(-6,-4),pose(-2,2,.8)],[pose(0,0),pose(0,0,Math.PI)],[pose(7,6),pose(7,10,1.2)],[pose(-1,3),pose(5,3,2)],[pose(0,-8),pose(0,-5)],[pose(-7,2),pose(-3,4)]]){
    const input={kind,interaction,from,to,heightAt:support.heightAt,waterLevel:0};
    const expected=evaluateCompanionSweep({...input,colliders:world.colliders}),actual=evaluateCompanionSweep({...input,colliders:support.collidersFor(from,to,kind,interaction)});
    assert.equal(actual.valid,expected.valid);assert.equal(actual.reason,expected.reason);comparisons++;actual.valid?clear++:blocked++;
  }
  assert.equal(comparisons,24);assert.ok(clear>0&&blocked>0);assert.ok(support.collidersFor(pose(0,0),pose(1,1)).includes(fallback));assert.ok(!support.collidersFor(pose(0,0),pose(1,1)).includes(solids[5]));
  const unbounded={id:'three-vertex unbounded vertical subset',bottom:0,top:1,planes:[[-1,0,0,0],[0,0,-1,0],[-1,0,-1,-1],[-2,0,-1,-1.5],[0,1,0,1],[0,-1,0,0],[1,1,0,10],[0,1,1,10]]};
  world={...world,colliders:[unbounded]};assert.ok(support.collidersFor(pose(8,8),pose(9,8)).includes(unbounded),'three finite corners do not bound the vertical-plane subset');
  const replacement=box('new very thin rail',0,0,.01,10,1,6);world={...world,colliders:[replacement]};assert.ok(support.collidersFor(pose(-5,0),pose(5,0)).includes(replacement));
  world={...world,colliders:[{}]};assert.equal(evaluateCompanionSweep({kind:'elizabeth',from:pose(0,0),heightAt:support.heightAt,colliders:support.collidersFor(pose(0,0),pose(0,0))}).reason,'invalid-world');support.dispose();
});
