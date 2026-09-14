import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMuseumTime} from '../src/yuanmingyuan/museum-timing.js';
import {createMuseumNavigation,stepMuseumFlight} from '../src/yuanmingyuan/visitor-motion.js';
import {EnvironmentClock} from '../src/environment-time.js';

for(const fps of [60,15,9,4])test(`museum walking, running, flight and daylight consume actual time at ${fps} FPS`,()=>{
  const terrain={colliders:[],surfaceAt:()=>({height:4,normal:{x:0,y:1,z:0}})},nav=createMuseumNavigation({terrain});
  let walker={position:{x:0,y:4,z:0}},runner={position:{x:0,y:4,z:0}},flight={x:0,y:40,z:0};
  const clock=new EnvironmentClock('auto',{phase:.4,duration:720});
  for(let i=0;i<fps*2;i++){
    const frame=advanceMuseumTime(1/fps,dt=>{walker=nav.walk(walker,{z:1},dt);runner=nav.walk(runner,{z:1,run:true},dt);flight=stepMuseumFlight(flight,{z:1,boost:true},dt);});
    clock.update(frame.activeDt);
  }
  assert(Math.abs(walker.position.z-6.4)<1e-8);assert(Math.abs(runner.position.z-14.4)<1e-8);
  assert(Math.abs(flight.z-128)<1e-8);assert(Math.abs(clock.phase-(.4+2/720))<1e-10);
});
test('a long stall is bounded for collisions without slowing the daylight clock',()=>{
  const chunks=[],result=advanceMuseumTime(5,dt=>chunks.push(dt));
  assert.equal(result.activeDt,5);assert.equal(result.simulationDt,.5);
  assert(chunks.every(dt=>dt<=1/30));assert(Math.abs(chunks.reduce((sum,dt)=>sum+dt,0)-.5)<1e-8);
  assert.equal(advanceMuseumTime(Infinity,()=>{}).activeDt,0);
});
