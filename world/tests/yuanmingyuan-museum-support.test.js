import test from 'node:test';
import assert from 'node:assert/strict';
import {museumSupport} from '../src/yuanmingyuan/museum-support.js';
import {createMuseumNavigation,stepMuseumFlight} from '../src/yuanmingyuan/visitor-motion.js';

test('an elevated basin excludes submerged model paving for visitors and guide placement',()=>{
  const ground={height:2.75,waterY:3.7,walkable:false},building={height:2.9,walkable:true};
  const support=museumSupport(ground,building);
  assert.equal(support.height,2.9);assert.equal(support.waterY,3.7);assert.equal(support.walkable,false);
  assert.equal(building.walkable,true);
  const nav=createMuseumNavigation({terrain:{colliders:[],surfaceAt:()=>ground},architecture:()=>({surfaceAt:()=>building,capsuleBlocked:()=>false})});
  assert.equal(nav.surfaceAt(0,0),null);assert.equal(nav.world.heightAt(0,0),undefined);
  assert.equal(nav.landing({x:0,y:12,z:0}).valid,false);
});

test('a real bridge above water remains walkable while a shallowly submerged slab does not',()=>{
  const wet={height:2.75,waterY:3.7,walkable:false};
  assert.equal(museumSupport(wet,{height:4,walkable:true}).walkable,true);
  assert.equal(museumSupport(wet,{height:3.71,walkable:true}).walkable,false);
  assert.equal(museumSupport(null,null),null);
  assert.equal(museumSupport({height:5,walkable:true},{height:4,walkable:true}).height,5);
});

test('broom minimum clearance uses the actual raised water surface, not the global lake level',()=>{
  const position=stepMuseumFlight({x:0,y:8,z:0},{x:0,z:0,vertical:-1},.1,{surfaceAt:()=>({height:2.9,waterY:3.7,walkable:false})});
  assert.equal(position.y,9.7);
});
