import test from 'node:test';
import assert from 'node:assert/strict';
import {companionRoutes} from '../src/companion-route.js';
test('a forward path handles exact circular endpoints and continues across a straight/arc loop',()=>{
  const radius=1.25,goals=[{x:-radius,z:3},{x:radius,z:3},{x:radius,z:0},{x:-radius,z:0}];let from={x:-radius,z:0,heading:0},travelled=0;
  for(const goal of goals){const route=companionRoutes(from,goal,radius)[0];assert.ok(route);const end=route.points.at(-1);assert.ok(Math.hypot(end.x-goal.x,end.z-goal.z)<1e-7);for(let i=1;i<route.points.length;i++){const p=route.points[i-1],q=route.points[i],distance=Math.hypot(q.x-p.x,q.z-p.z);assert.ok(distance>1e-8);assert.ok(Math.abs(q.heading-p.heading)<=distance/radius+1e-3);}travelled+=route.length;from=end;}
  assert.ok(Math.abs(travelled-(6+2*Math.PI*radius))<1e-6);assert.ok(Math.abs(Math.sin(from.heading))<1e-6);
});
