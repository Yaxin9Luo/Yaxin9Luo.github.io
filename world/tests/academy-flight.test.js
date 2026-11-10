import test from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT,createFlightState,stepFlight,resolveColliders,forwardOf} from '../src/academy/flight.js';
import {loadAcademyWorld} from './helpers/academy-course.js';
import {locations} from '../src/locations.js';

// Pure flight model: no renderer. These tests cover feel contracts (speeds,
// dodge, walls) and stability, not how the game looks.
const flat={heightAt:()=>0,waterLevel:-15,colliders:[]};
const fly=(s,input,seconds,world=flat,dt=1/120)=>{const events=[];for(let t=0;t<seconds;t+=dt)events.push(...stepFlight(s,input,dt,world));return events;};

test('with no input the broom settles at cruise speed and keeps its altitude',()=>{
  const s=createFlightState({x:0,y:30,z:0,heading:0});s.speed=FLIGHT.minSpeed;
  fly(s,{},4);
  assert.ok(Math.abs(s.speed-FLIGHT.cruise)<.6,`speed ${s.speed}`);
  assert.ok(Math.abs(s.y-30)<.5);
  assert.ok(s.z<-60,'heading 0 flies toward -z');
});

test('boost is faster, drains the meter, and the meter refills after release',()=>{
  const s=createFlightState({x:0,y:40,z:0,heading:0});
  const events=fly(s,{boost:true},2);
  assert.ok(s.speed>FLIGHT.cruise+10,`boost speed ${s.speed}`);
  assert.ok(s.boost<.4,`meter ${s.boost}`);
  assert.equal(events.filter(e=>e.type==='boost-start').length,1);
  fly(s,{boost:true},3);
  assert.equal(s.boosting,false,'an empty meter stops the boost');
  const empty=s.boost;fly(s,{},2);
  assert.ok(s.boost>empty+.2);
});

test('diving gains speed beyond cruise; climbing slows but never stalls',()=>{
  const dive=createFlightState({x:0,y:120,z:0});fly(dive,{climb:-1},2.5);
  assert.ok(dive.speed>FLIGHT.cruise+6,`dive ${dive.speed}`);
  const climb=createFlightState({x:0,y:20,z:0});fly(climb,{climb:1},4);
  assert.ok(climb.speed>=FLIGHT.minSpeed&&climb.speed<FLIGHT.cruise-4,`climb ${climb.speed}`);
  assert.ok(climb.y>40);
});

test('a barrel roll dashes sideways with brief invulnerability and a cooldown',()=>{
  const s=createFlightState({x:0,y:30,z:0,heading:0});
  const events=stepFlight(s,{roll:1},1/120,flat);
  assert.equal(events[0].type,'roll');assert.ok(s.iframes>.4);
  fly(s,{},FLIGHT.rollTime);
  assert.ok(s.x>3,`dash moved right: ${s.x}`);
  assert.equal(stepFlight(s,{roll:1},1/120,flat).some(e=>e.type==='roll'),false,'cooldown blocks a second roll');
  fly(s,{},FLIGHT.rollCooldown);
  assert.equal(stepFlight(s,{roll:-1},1/120,flat).some(e=>e.type==='roll'),true);
});

test('turning right heads east from north, and banks into the turn',()=>{
  const s=createFlightState({x:0,y:30,z:0,heading:0});
  fly(s,{turn:1},.4);assert.ok(s.bank>.2);
  fly(s,{turn:1},.6);
  const f=forwardOf(s.heading);assert.ok(f.x>.5,`forward ${JSON.stringify(f)}`);
});

test('the ground is a floor and a hard dive into it scrapes',()=>{
  const s=createFlightState({x:0,y:30,z:0});
  const events=fly(s,{climb:-1},4);
  assert.ok(s.y>=FLIGHT.floorClearance-1e-6);
  assert.ok(events.some(e=>e.type==='scrape'));
});

test('real island cliffs block like walls instead of lifting the rider over them',()=>{
  const {world,hf}=loadAcademyWorld();
  // Low over the lake, flying north into the south cliffs below their top.
  const s=createFlightState({x:0,y:-9,z:150,heading:0});
  const events=fly(s,{},6,world);
  const top=hf.heightAt(s.x,s.z-6);
  assert.ok(events.some(e=>e.type==='bump'),'the cliff bumps');
  assert.ok(s.y<top-4,`rider stayed below the cliff top (${s.y.toFixed(1)} vs ${top.toFixed(1)})`);
});

test('flying into the Grand Academy bumps and leaves the rider outside every collider',()=>{
  const {world}=loadAcademyWorld();
  const castle=locations.find(l=>l.id==='about');
  const s=createFlightState({x:castle.x,y:25,z:castle.z+70,heading:0});
  const events=fly(s,{},5,world);
  assert.ok(events.some(e=>e.type==='bump'));
  const probe={x:s.x,y:s.y,z:s.z};
  assert.equal(resolveColliders(probe,world.colliders,FLIGHT.radius-.05),null,'no remaining penetration');
});

test('past the map edge the broom is turned back toward the islands',()=>{
  const s=createFlightState({x:0,y:30,z:150,heading:Math.PI});
  const events=fly(s,{},8);
  assert.ok(events.some(e=>e.type==='boundary'));
  assert.ok(s.z<FLIGHT.bounds.z*1.12+1);
  assert.ok(forwardOf(s.heading).z<0,'now heading back north');
});

test('trajectories agree across step sizes, so slow frames do not change the game',()=>{
  const runs=[1/60,1/120,1/240].map(dt=>{const s=createFlightState({x:0,y:40,z:0});fly(s,{turn:.6,climb:.3,boost:true},2,flat,dt);return s;});
  for(const s of runs.slice(1)){assert.ok(Math.hypot(s.x-runs[0].x,s.y-runs[0].y,s.z-runs[0].z)<1.2,'positions within 1.2 m');}
});
