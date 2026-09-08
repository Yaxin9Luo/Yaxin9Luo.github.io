import test from 'node:test';
import assert from 'node:assert/strict';
import { queryGroundSupport, stepGroundMotion, findSafeLanding, GROUND_MOTION } from '../src/ground-motion.js';
const box=(id,x,z,w,d,bottom,top)=>({id,bottom,top,planes:[[1,0,0,x+w/2],[-1,0,0,-x+w/2],[0,0,1,z+d/2],[0,0,-1,-z+d/2],[0,1,0,top],[0,-1,0,-bottom]]});
const flat={heightAt:()=>0,colliders:[]};
test('ground support follows the supplied rendered surface and rejects steep slopes and water',()=>{
 assert.equal(queryGroundSupport({x:2,z:3,feetY:0},flat).y,0);
 assert.equal(queryGroundSupport({x:0,z:0,feetY:0},{heightAt:x=>x*1.4}).reason,'slope');
 assert.equal(queryGroundSupport({x:0,z:0,feetY:-22},{heightAt:()=>-22}).reason,'water');
});
test('bridge support selects its real deck over water and rejects an unsupported edge',()=>{
 const world={heightAt:()=>-22,colliders:[box('bridge/test/deck',0,0,6,20,6.47,7.17)]};
 const centre=queryGroundSupport({x:0,z:0,feetY:7.17},world);
 assert.equal(centre.valid,true);assert.equal(centre.y,7.17);assert.equal(centre.surfaceId,'bridge/test/deck');
 assert.equal(queryGroundSupport({x:2.95,z:0,feetY:7.17},world).reason,'edge');
});
test('platform steps are walkable while narrow roofs and overhead obstructions are not landing sites',()=>{
 const foundation=box('about/foundation',0,0,10,10,0,.25);
 assert.equal(queryGroundSupport({x:0,z:0,feetY:0},{...flat,colliders:[foundation]}).y,.25);
 const roof=box('about/spire',0,0,10,10,0,5);
 assert.equal(findSafeLanding({x:0,y:8,z:0},{...flat,colliders:[roof]}).valid,false);
 const ceiling=box('hall/ceiling',0,0,3,3,1.8,2.2);
 assert.equal(queryGroundSupport({x:0,z:0,feetY:0},{...flat,colliders:[ceiling]}).reason,'blocked');
});
test('motion clips against a wall, stops before water and advances gait by actual distance',()=>{
 const wall=box('wall',0,-1,8,.2,0,5);
 const start={position:{x:0,y:0,z:0},velocity:{x:0,z:0},heading:0};
 const moved=stepGroundMotion(start,{x:0,z:-1,run:true},1,{...flat,colliders:[wall]});
 assert.ok(moved.position.z>-.61);assert.ok(moved.distance<1);assert.ok(moved.blocked);
 const coast={heightAt:(x,z)=>z<-.6?-22:0};
 const edge=stepGroundMotion(start,{x:0,z:-1},1,coast);
 assert.ok(edge.position.z>-.4);assert.ok(edge.blocked);
 const free=stepGroundMotion(start,{x:0,z:-1},.1,flat);
 assert.ok(Math.abs(free.distance-GROUND_MOTION.walkSpeed*.1)<1e-8);
 assert.equal(free.position.y,0);
});
test('landing queries below the aircraft and respects headroom and water',()=>{
 assert.equal(findSafeLanding({x:0,y:10,z:0},flat).y,0);
 assert.equal(findSafeLanding({x:0,y:10,z:0},{heightAt:()=>-22}).reason,'water');
});

test('walking climbs and descends a low foundation step without horizontal ejection',()=>{
 const world={...flat,colliders:[box('about/foundation',0,-1.8,8,2,0,.25)]};
 let state={position:{x:0,y:0,z:0},heading:0};
 for(let i=0;i<15;i++)state=stepGroundMotion(state,{x:0,z:-1},.1,world);
 assert.ok(state.position.z<-2.2);assert.equal(state.position.y,.25);
 for(let i=0;i<15;i++)state=stepGroundMotion(state,{x:0,z:1},.1,world);
 assert.ok(state.position.z>-.1);assert.equal(state.position.y,0);
});

test('a shallow walkable strip under the footprint is a step while a floating shelf remains an obstruction',()=>{
 const strip={...box('paving/strip',.2,0,.035,2,-.1,.025),walkable:true};
 const supported=queryGroundSupport({x:0,z:0,feetY:0,allowSteps:true},{...flat,colliders:[strip]});
 assert.equal(supported.valid,true);assert.equal(supported.y,.025);
 const shelf={...strip,bottom:.012,planes:strip.planes.map(p=>p[1]===-1?[0,-1,0,-.012]:p)};
 assert.equal(queryGroundSupport({x:0,z:0,feetY:0,allowSteps:true},{...flat,colliders:[shelf]}).reason,'blocked');
});

test('a millimeter bevel on a shallow walkable step does not count as a steep hillside',()=>{
 const tile={...box('paving/tile',0,0,2,2,-.1,.03),walkable:true};
 tile.planes.push([Math.SQRT1_2,Math.SQRT1_2,0,1.025*Math.SQRT1_2]);
 const support=queryGroundSupport({x:.998,z:0,feetY:.03,allowSteps:true},{...flat,colliders:[tile]});
 assert.equal(support.valid,true);assert.equal(support.y,.03);
});
