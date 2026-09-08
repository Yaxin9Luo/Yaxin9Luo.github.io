import test from 'node:test';
import assert from 'node:assert/strict';
import {createLampGroundGlow} from '../src/site-details.js';

test('varied lamp pools retain deterministic terrain-conforming geometry',()=>{
  const sites=[[1,0,3],[-8,0,12],[20,0,-14]],heightAt=(x,z)=>x*.12+z*.03;
  const first=createLampGroundGlow(sites,heightAt),second=createLampGroundGlow(sites,heightAt);
  const positions=first.geometry.attributes.position,strength=first.geometry.attributes.strength;
  assert.deepEqual(positions.array,second.geometry.attributes.position.array);
  assert.deepEqual(strength.array,second.geometry.attributes.strength.array);
  assert.ok(new Set(strength.array).size>1);
  for(let i=0;i<positions.count;i++){
    assert.ok(Math.abs(positions.getY(i)-heightAt(positions.getX(i),positions.getZ(i))-.105)<1e-5);
    assert.ok(strength.getX(i)>0&&strength.getX(i)<=1);
  }
  assert.equal(first.material.depthWrite,false);
  for(const mesh of [first,second]){mesh.geometry.dispose();mesh.material.dispose();}
});
