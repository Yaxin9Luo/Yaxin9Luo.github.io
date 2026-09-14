import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluateCompanionSweep} from '../src/companion-system.js';

const box=(x0,x1,z0,z1,bottom=0,top=6)=>({id:'test solid',bottom,top,planes:[
  [1,0,0,x1],[-1,0,0,-x0],[0,0,1,z1],[0,0,-1,-z0],[0,1,0,top],[0,-1,0,-bottom],
]});
const pose=(x=0,z=0,heading=0)=>({x,z,heading});
const flat={heightAt:()=>1,waterLevel:0,colliders:[]};
const check=(kind,from,to=from,extra={})=>evaluateCompanionSweep({kind,from,to,...flat,...extra});

test('whole swept bodies reject a thin wall even when both endpoints are clear',()=>{
  assert.equal(check('elizabeth',pose(-5),pose(5)).valid,true);
  const result=check('elizabeth',pose(-5),pose(5),{colliders:[box(-.01,.01,-8,8)]});
  assert.equal(result.valid,false);assert.equal(result.reason,'obstacle');
});

test('asymmetric tail and board clearance are wider than the visitor collider',()=>{
  assert.equal(check('sadaharu',pose(),pose(),{colliders:[box(-.2,.2,-2.05,-1.95)]}).valid,false);
  const wall=[box(2.35,2.5,-2,2)];
  assert.equal(check('elizabeth',pose(),pose(),{colliders:wall}).valid,true);
  assert.equal(check('elizabeth',pose(),pose(),{interaction:true,colliders:wall}).valid,false);
  // The same board stop has spare space to its left; a centered 3 m radius
  // would reject this deliberately asymmetric, actually usable opening.
  assert.equal(check('elizabeth',pose(),pose(),{interaction:true,colliders:[box(-2.5,-1.6,-2,2)]}).valid,true);
});

test('rotation sweeps catch the long dog tail between two clear headings',()=>{
  const colliders=[box(-1.62,-1.45,-1.62,-1.45)];
  assert.equal(check('sadaharu',pose(),pose(),{colliders}).valid,true);
  assert.equal(check('sadaharu',pose(0,0,Math.PI/2),undefined,{colliders}).valid,true);
  assert.equal(check('sadaharu',pose(),pose(0,0,Math.PI/2),{colliders}).valid,false);
});

test('swept support rejects interior shore, missing terrain and steep grades',()=>{
  for(const heightAt of [
    (x,z)=>Math.abs(x)<.12&&Math.abs(z)<3?-1:1,
    x=>Math.abs(x)<.12?undefined:1,
    x=>1+x*.2,
  ])assert.equal(check('elizabeth',pose(-5),pose(5),{heightAt}).valid,false);
  assert.equal(check('sadaharu',pose(),pose(0,3),{heightAt:(_x,z)=>1+z*.01}).valid,true);
});

test('the actual support top is allowed while low overhangs block full height',()=>{
  assert.equal(check('elizabeth',pose(),pose(0,2),{colliders:[box(-10,10,-10,10,0,1)]}).valid,true);
  assert.equal(check('elizabeth',pose(),pose(0,2),{colliders:[box(-10,10,-10,10,3.9,4.1)]}).valid,false);
  assert.equal(check('elizabeth',pose(),pose(0,2),{colliders:[box(-10,10,-10,10,5,6)]}).valid,true);
});

test('a low obstacle cannot pass beneath the body prism but through a downhill corrected foot',()=>{
  const heightAt=x=>1+x*.01;
  assert.equal(check('elizabeth',pose(),pose(),{heightAt}).valid,true);
  assert.equal(check('elizabeth',pose(),pose(),{heightAt,colliders:[box(-.60,-.35,-.2,.8,.99,1.009)]}).valid,false);
});

test('malformed terrain and collider input fail closed rather than certifying a route',()=>{
  for(const extra of [{heightAt:()=>NaN},{colliders:[{}]},{colliders:[{planes:[],bottom:0,top:4}]}]){
    assert.equal(check('elizabeth',pose(),pose(),extra).valid,false);
  }
  assert.equal(check('elizabeth',pose(NaN),pose()).valid,false);
});

test('verified walkable tile contact permits a full-body sweep across shallow joints without hiding other obstacles',()=>{
  const floor={...box(-10,10,-10,10,0,1.141),id:'floor',walkable:true};
  const left={...box(-10,-.06,-10,10,0,1.171),id:'tile-left',walkable:true};
  const right={...box(.06,10,-10,10,0,1.171),id:'tile-right',walkable:true};
  const heightAt=x=>Math.abs(x)<.06?1.141:1.171;
  heightAt.surfaceAt=(x,z)=>({height:heightAt(x,z),surfaceId:Math.abs(x)<.06?'floor':x<0?'tile-left':'tile-right',normal:{x:0,y:1,z:0}});
  for(const kind of ['elizabeth','sadaharu']){
    const from=pose(-1,0),to=pose(1,2,.8),colliders=[floor,left,right];
    assert.equal(check(kind,from,to,{heightAt,colliders}).valid,true,'known support is not a body obstacle at a mortar seam');
    assert.equal(check(kind,from,to,{heightAt,colliders:[...colliders,box(-.08,.08,-5,5,1.15,1.20)]}).valid,false,'a low obstacle remains blocking');
    assert.equal(check(kind,from,to,{heightAt,colliders:[...colliders,{...box(-.08,.08,-5,5,1.15,1.18),id:'unqueried walkable',walkable:true}]}).valid,false,'walkable alone is not proof of supporting contact');
    assert.equal(check(kind,from,to,{heightAt,colliders:[...colliders,{...box(-5,5,-5,5,3,3.2),id:'overhead',walkable:true}]}).valid,false);
  }
});

test('a truly stationary sweep samples its support grid once, including rotated poses',()=>{
  for(const [kind,samples] of [['elizabeth',182],['sadaharu',209]])for(const heading of [0,Math.PI/3]){
    const from=pose(4,-3,heading);let calls=0;
    const result=check(kind,from,{...from},{heightAt:()=>{calls++;return 1;}});
    assert.deepEqual(result,{valid:true,reason:null,position:{...from,y:1,floor:1},supportSpread:0});
    assert.equal(calls,samples,'identical endpoints must share this sweep\'s support result');
  }
});

test('even small genuine translation and rotation retain both endpoint support grids',()=>{
  for(const [kind,samples] of [['elizabeth',364],['sadaharu',418]])for(const to of [pose(.008),pose(1e-9),pose(0,0,.001)]){
    let calls=0;const result=check(kind,pose(),to,{heightAt:()=>{calls++;return 1;}});
    assert.equal(result.valid,true);assert.equal(calls,samples);
    assert.equal(result.position.x,to.x);assert.equal(result.position.z,to.z);
    assert.ok(Math.abs(result.position.heading-to.heading)<1e-14);
  }
});

test('stationary support reuse retains each obstacle check and its exact supporting-face witness',()=>{
  // This narrow supporting face lies between grid columns. Only the clipped
  // overlap witness can establish contact, on each existing obstacle check.
  const tile={...box(.91,.92,.10,.11,.9,1.002),id:'tiny supporting tile',walkable:true};
  const heightAt=()=>1,witnesses=[];let samples=0;
  heightAt.surfaceAt=(x,z)=>{
    if(x>=.91&&x<=.92&&z>=.10&&z<=.11){witnesses.push({x,z});return {height:1.002,surfaceId:tile.id,normal:{x:0,y:1,z:0}};}
    samples++;return {height:1,surfaceId:'terrain',normal:{x:0,y:1,z:0}};
  };
  assert.deepEqual(check('elizabeth',pose(),undefined,{heightAt,colliders:[tile]}),{
    valid:true,reason:null,position:{x:0,z:0,heading:0,y:1,floor:1},supportSpread:0,
  });
  assert.equal(witnesses.length,2,'sharing support must not remove a conservative obstacle/witness check');
  for(const point of witnesses){assert.ok(Math.abs(point.x-.915)<1e-12);assert.ok(Math.abs(point.z-.105)<1e-12);}
  assert.equal(samples,182,'the complete interior/edge grid remains present once');
});

test('stationary reuse stays local to one query and preserves grade and dynamic-obstacle results',()=>{
  const from=pose(),heightAt=x=>1+.01*x;
  const grade=check('elizabeth',from,undefined,{heightAt});
  assert.equal(grade.valid,true);assert.ok(Math.abs(grade.position.y-1.0120702)<1e-12);
  assert.ok(Math.abs(grade.position.floor-.9878257)<1e-12);assert.ok(Math.abs(grade.supportSpread-.0242445)<1e-12);
  let height=1;const liveHeight=()=>height,colliders=[];
  assert.equal(check('sadaharu',from,undefined,{heightAt:liveHeight,colliders}).valid,true);
  height=-1;assert.equal(check('sadaharu',from,undefined,{heightAt:liveHeight,colliders}).reason,'shore');
  height=1;colliders.push({...box(-.1,.1,-.1,.1),id:'visitor'});
  assert.deepEqual(check('sadaharu',from,undefined,{heightAt:liveHeight,colliders}),{valid:false,reason:'obstacle',obstacle:'visitor'});
  colliders[0]={...box(-.1,.1,-.1,.1),id:'companion:other'};
  assert.equal(check('sadaharu',from,undefined,{heightAt:liveHeight,colliders}).obstacle,'companion:other');
  colliders.length=0;assert.equal(check('sadaharu',from,undefined,{heightAt:liveHeight,colliders}).valid,true);
});
