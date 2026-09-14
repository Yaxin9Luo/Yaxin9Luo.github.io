import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EnvironmentClock,sampleEnvironment} from '../src/environment-time.js';
import {rotateMuseumLightingSample} from '../src/yuanmingyuan/museum-lighting-sample.js';

const names=['sunDirection','moonDirection','lightDirection'];
test('real day clock: rigid rotation of all three directions, untouched original and all other fields',()=>{
  const clock=new EnvironmentClock('day'),sample=clock.update(0),before=JSON.stringify(sample);
  const actual=rotateMuseumLightingSample(sample,-120);
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-120*Math.PI/180);
  for(const key of Object.keys(sample)){
    if(names.includes(key)){
      assert.notEqual(actual[key],sample[key]);
      assert(actual[key].distanceTo(sample[key].clone().applyQuaternion(q))<1e-14);
      assert.equal(actual[key].y,sample[key].y);
    }else assert.equal(actual[key],sample[key]);
  }
  assert.equal(JSON.stringify(sample),before);
  assert(actual.lightDirection.distanceTo(new THREE.Vector3(-.17649505236939167,.816290877423564,-.5500169996683683))<1e-14);
  assert(actual.moonDirection.distanceTo(sample.moonDirection)>.1);
});
test('full-day sample path retains lengths, pairwise angles, elevations and neighboring displacement norms',()=>{
  let previous=null;
  for(let n=0;n<=1440;n++){
    const sample=sampleEnvironment(n/1440,{lightingVariant:'solar-120-sunlit'});
    const rotated=rotateMuseumLightingSample(sample,-120);
    for(const name of names){
      assert.equal(rotated[name].y,sample[name].y);
      assert(Math.abs(rotated[name].length()-sample[name].length())<1e-14);
      if(previous)assert(Math.abs(rotated[name].distanceTo(previous.rotated[name])-sample[name].distanceTo(previous.sample[name]))<1e-14);
    }
    for(const a of names)for(const b of names)assert(Math.abs(rotated[a].dot(rotated[b])-sample[a].dot(sample[b]))<1e-14);
    for(const key of Object.keys(sample))if(!names.includes(key))assert.equal(rotated[key],sample[key]);
    previous={sample,rotated};
  }
});
test('rotation is reversible without resources or replacing palette identities',()=>{
  const sample=sampleEnvironment(.735,{lightingVariant:'solar-120-sunlit'});
  const result=rotateMuseumLightingSample(rotateMuseumLightingSample(sample,-120),120);
  for(const name of names)assert(result[name].distanceTo(sample[name])<1e-14);
  assert.equal(result.key,sample.key);assert.equal(result.shadowIntensity,sample.shadowIntensity);
});
test('bad input fails explicitly without partially changing a sample',()=>{
  const sample=sampleEnvironment(.46,{lightingVariant:'solar-120-sunlit'}),before=JSON.stringify(sample);
  assert.throws(()=>rotateMuseumLightingSample(sample,NaN),TypeError);
  assert.throws(()=>rotateMuseumLightingSample({...sample,moonDirection:null}),TypeError);
  assert.equal(JSON.stringify(sample),before);
});
