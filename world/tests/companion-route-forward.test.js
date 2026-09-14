import test from 'node:test';
import assert from 'node:assert/strict';
import {companionRoutes} from '../src/companion-route.js';

test('actual Xian guide coordinates take the three-metre forward route without an accidental full circle',()=>{
  for(const z of [-647,-633]){
    const from={x:883,z,heading:0},goal={x:883,z:z+3},route=companionRoutes(from,goal,.95)[0];
    assert.equal(route.length,3);assert.equal(route.points.length,31);
    assert(route.points.every(point=>point.x===883&&point.heading===0));
    for(let i=1;i<route.points.length;i++)assert(route.points[i].z>route.points[i-1].z);
  }
});

test('forward collinearity handles translated world coordinates and heading roundoff, retaining exact endpoints',()=>{
  for(const origin of [[883,-647],[-883,647],[1048576,-1048576]])for(const heading of [0,Math.PI/4,-Math.PI/2,2*Math.PI]){
    const from={x:origin[0],z:origin[1],heading},goal={x:from.x+3*Math.sin(heading),z:from.z+3*Math.cos(heading)},route=companionRoutes(from,goal,.95)[0];
    assert(Math.abs(route.length-Math.hypot(goal.x-from.x,goal.z-from.z))<1e-12);
    assert(route.points.every(point=>point.heading===heading));
    assert.equal(route.points.at(-1).x,goal.x);assert.equal(route.points.at(-1).z,goal.z);
    for(let i=1;i<route.points.length;i++)assert(Math.hypot(route.points[i].x-route.points[i-1].x,route.points[i].z-route.points[i-1].z)<=.100000001);
  }
});

test('a representable lateral displacement or a goal behind the actor still requires real turning',()=>{
  const from={x:883,z:-647,heading:0};
  for(const goal of [{x:883.0000001,z:-644},{x:883,z:-650},{x:886,z:-647}]){
    const route=companionRoutes(from,goal,.95)[0];
    assert(route.points.some(point=>Math.abs(point.heading)>1e-9));
    assert(Math.hypot(route.points.at(-1).x-goal.x,route.points.at(-1).z-goal.z)<1e-10);
  }
});
