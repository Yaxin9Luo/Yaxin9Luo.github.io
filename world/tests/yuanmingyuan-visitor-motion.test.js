import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumNavigation,stepMuseumFlight,MUSEUM_FLIGHT,museumTravelHeading,museumVisitorCollider} from '../src/yuanmingyuan/visitor-motion.js';
const terrain={colliders:[],surfaceAt:(x,z)=>({kind:x>5?'lake-bed':'land',height:x>5?0:4,normal:{x:0,y:1,z:0}})};
test('broom and walking agree on the authored rider forward direction',()=>{
  const nav=createMuseumNavigation({terrain});
  for(const [x,z]of [[1,0],[-1,0],[0,1],[0,-1],[.5,-.5]]){
    const walk=nav.walk({position:{x:0,y:4,z:0},heading:0},{x,z},.03),heading=museumTravelHeading(x,z);
    assert(Math.abs(Math.sin(walk.heading-heading))<1e-8);assert(Math.cos(walk.heading-heading)>.999999);
  }
});
test('walking/running travel at the established gait speeds and stop at water',()=>{
  const nav=createMuseumNavigation({terrain});let state={position:{x:0,y:4,z:0},heading:0};
  for(let i=0;i<10;i++)state=nav.walk(state,{z:1,run:true},.1);
  assert.ok(Math.abs(state.position.z-7.2)<1e-6);
  for(let i=0;i<15;i++)state=nav.walk(state,{x:1,run:true},.1);
  assert.ok(state.position.x<5);assert.equal(state.position.y,4);
});
test('landing observes actual lower-level support and architecture capsule clearance',()=>{
  const nav=createMuseumNavigation({terrain,architecture:()=>({surfaceAt:()=>null,capsuleBlocked:p=>p.z>1})});
  assert.equal(nav.landing({x:0,y:20,z:0}).valid,true);
  assert.equal(nav.landing({x:0,y:20,z:2}).reason,'blocked');
  assert.equal(nav.landing({x:6,y:20,z:0}).valid,false);
});
test('substeps prevent running through a thin mesh wall',()=>{
  const nav=createMuseumNavigation({terrain,architecture:()=>({surfaceAt:()=>null,capsuleBlocked:p=>p.z>.4&&p.z<.6})});
  const next=nav.walk({position:{x:0,y:4,z:0}},{z:1,run:true},.1);
  assert.ok(next.position.z<.4);assert.equal(next.blocked,true);
});
test('walking and landing respect a moving guide and release its former position',()=>{
  let actor={id:'companion:guide',bottom:4,top:7.1,planes:[[1,0,0,1],[-1,0,0,1],[0,0,1,4],[0,0,-1,-2],[0,1,0,7.1],[0,-1,0,-4]]};
  const nav=createMuseumNavigation({terrain,dynamicColliders:()=>actor?[actor]:[]});
  assert.equal(nav.landing({x:0,y:15,z:3}).valid,false);
  let state={position:{x:0,y:4,z:0},heading:0};for(let i=0;i<10;i++)state=nav.walk(state,{z:1,run:true},.1);
  assert(state.position.z<1.7,'the visitor capsule must stop before the guide body');
  actor=null;assert.equal(nav.landing({x:0,y:15,z:3}).valid,true);
  for(let i=0;i<5;i++)state=nav.walk(state,{z:1,run:true},.1);assert(state.position.z>4);
});
test('visitor guide-clearance uses the sole plane on foot and the rider seat in flight',()=>{
  const ground=museumVisitorCollider({mode:'grounded',position:{x:3,y:4,z:-2}}),air=museumVisitorCollider({mode:'flying',position:{x:3,y:14,z:-2}});
  assert.equal(ground.bottom,4);assert(Math.abs(ground.top-7.28)<1e-12);assert.equal(ground.walkable,false);assert.equal(ground.planes.length,10);
  assert.equal(air.bottom,12.4);assert(Math.abs(air.top-15.6)<1e-12);assert.equal(museumVisitorCollider(null),null);
});
test('flight supports climb/descent, diagonal normalization and actual land clearance',()=>{
  const p={x:0,y:40,z:0},straight=stepMuseumFlight(p,{x:1},.1),diagonal=stepMuseumFlight(p,{x:1,z:1},.1);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-straight.x)<1e-8);
  assert.ok(stepMuseumFlight(p,{vertical:1},.1).y>p.y);
  assert.ok(stepMuseumFlight(p,{vertical:-1},.1).y<p.y);
  assert.equal(stepMuseumFlight(p,{vertical:-1},.1,{surfaceAt:()=>({height:45})}).y,45+MUSEUM_FLIGHT.minAltitude);
});
