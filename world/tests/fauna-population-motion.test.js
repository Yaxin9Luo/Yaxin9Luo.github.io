import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFaunaMotion,clearOfLandmarks,clearInsectHabitat} from '../src/fauna-population-motion.js';

const heightAt=(x,z)=>7+.012*x+.03*Math.sin(z*.27);
const snapshot=motion=>({
  time:motion.time,
  lanterns:motion.lanterns.map(l=>[...l.position.toArray(),...l.rotation.toArray().slice(0,3)]),
  insects:motion.insects.map(i=>[...i.position.toArray(),i.glow,i.wingAngle]),
  birds:motion.flocks.flatMap(f=>f.birds.map(b=>[...b.position.toArray(),...b.direction.toArray(),b.bank,b.poseTime])),
  released:motion.released.map(l=>[l.active,l.age,l.fade,...l.position.toArray()]),
});
function nearlyEqual(a,b,tolerance=1e-7){
  if(typeof a==='number'){assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);return;}
  if(Array.isArray(a)){assert.equal(a.length,b.length);a.forEach((value,i)=>nearlyEqual(value,b[i],tolerance));return;}
  if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(a))nearlyEqual(a[key],b[key],tolerance);return;}
  assert.equal(a,b);
}

test('accepted elapsed time gives equivalent paths and release lifetimes at 8, 30 and 60 fps',()=>{
  const outcomes=[];
  for(const fps of [8,30,60]){
    const motion=createFaunaMotion({heightAt});motion.release(new THREE.Vector3(18,18,74));
    for(let i=0;i<30*fps;i++)motion.update(1/fps);
    assert.ok(Math.abs(motion.released[0].position.y-45.7)<1e-8,'the old .1 cap must not slow an 8 fps ascent');outcomes.push(snapshot(motion));
  }
  nearlyEqual(outcomes[0],outcomes[1]);nearlyEqual(outcomes[1],outcomes[2]);
});

test('reading, intro and reduced motion hold activity without catch-up or resets',()=>{
  const motion=createFaunaMotion({heightAt});motion.release(new THREE.Vector3(18,18,74));motion.update(3.75);const held=snapshot(motion);
  for(let i=0;i<80;i++)motion.update(.125,false,{paused:true});assert.deepEqual(snapshot(motion),held);
  motion.update(10,false,{started:false});motion.update(NaN);motion.update(Infinity);motion.update(-4);assert.deepEqual(snapshot(motion),held);
  motion.update(.125,true);const quiet=snapshot(motion);assert.equal(quiet.time,held.time);nearlyEqual(quiet.birds,held.birds);
  for(let i=0;i<80;i++)motion.update(.125,true);assert.deepEqual(snapshot(motion),quiet);
  const reference=createFaunaMotion({heightAt});reference.release(new THREE.Vector3(18,18,74));reference.update(3.875);motion.update(.125);nearlyEqual(snapshot(motion),snapshot(reference));
});

test('the release pool stays bounded and fades before both terminal age and ceiling',()=>{
  const motion=createFaunaMotion({heightAt}),ambient=motion.lanterns.map(l=>l.base.clone());
  for(let i=0;i<21;i++)assert.equal(motion.release(new THREE.Vector3(18,18,74)),true);
  assert.equal(motion.released.length,8);assert.equal(motion.released.filter(l=>l.active).length,8);motion.lanterns.forEach((l,i)=>assert.ok(l.base.equals(ambient[i])));
  assert.equal(motion.release({x:Infinity,y:4,z:6}),false);motion.update(94);assert.ok(motion.released.every(l=>l.active&&l.fade>0&&l.fade<1));motion.update(6);assert.ok(motion.released.every(l=>!l.active&&l.fade===0));
  motion.release(new THREE.Vector3(18,180,74));motion.update(5);const high=motion.released.find(l=>l.active);assert.ok(high.fade>0&&high.fade<1);motion.update(20);assert.ok(motion.released.every(l=>!l.active));
});

test('authored complete paths stay beside their habitats and outside landmark volumes',()=>{
  const motion=createFaunaMotion({heightAt});assert.equal(motion.lanterns.length,26);assert.equal(motion.insects.length,90);assert.deepEqual(motion.flocks.map(f=>f.birds.length),[5,4,3]);
  for(let i=0;i<2400;i++){
    motion.update(.25);
    for(const insect of motion.insects){const p=insect.position,clearance=p.y-heightAt(p.x,p.z);assert.ok(clearance>=.8&&clearance<=2.2);assert.ok(clearOfLandmarks(p,2));assert.ok(clearInsectHabitat(p.x,p.z,heightAt));}
    for(const lantern of motion.lanterns)assert.ok(clearOfLandmarks(lantern.position,10));
    for(const flock of motion.flocks)for(const bird of flock.birds){assert.ok(clearOfLandmarks(bird.position,12));assert.ok(Math.abs(bird.direction.length()-1)<1e-10);assert.ok(Math.abs(bird.bank)<=.35);}
    for(const flock of motion.flocks)for(let j=1;j<flock.birds.length;j++){const distance=flock.birds[j].position.distanceTo(flock.birds[j-1].position);assert.ok(distance>2&&distance<5);}
    assert.ok(motion.insects.filter(insect=>insect.glow>.5).length<30,'only a minority pulse strongly together');
  }
});

test('a live actual-height resolver tracks progressive surface changes without moving habitat anchors',()=>{
  let level=0;const motion=createFaunaMotion({heightAt:(x,z)=>heightAt(x,z)+level});const before=motion.insects.map(i=>i.position.clone());level=1.25;motion.update(0);
  motion.insects.forEach((insect,i)=>{assert.equal(insect.position.x,before[i].x);assert.equal(insect.position.z,before[i].z);assert.ok(Math.abs(insect.position.y-before[i].y-1.25)<1e-9);});
});
