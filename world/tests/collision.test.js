import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBuildingColliders, resolveRiderCollision, shortenCameraBoom } from '../src/collision.js';
import { locations } from '../src/locations.js';
import { createCastle } from '../src/models.js';

const colliders = createBuildingColliders(locations);
const zero = { x:0, y:0, z:0 };
const local = (id,x,y,z) => { const l = locations.find(l => l.id === id); return { x:l.x+x, y:l.y+y, z:l.z+z }; };
const safe = p => !resolveRiderCollision(p,zero,colliders).collided;

test('the reported east wing position is pushed outside the actual castle wall', () => {
  const position = { x:13.5925, y:12, z:-21.1 }, velocity = { x:-8, y:2, z:3 };
  const result = resolveRiderCollision(position,velocity,colliders);
  assert.equal(result.collided,true);
  assert.ok(result.position.x > 14.7, 'the 13.9m wing plus rider radius must be cleared');
  assert.equal(result.position.y,12);
  assert.equal(result.velocity.x,0);
  assert.equal(result.velocity.z,3, 'wall sliding preserves tangential movement');
  assert.equal(result.velocity.y,2);
  assert.ok(safe(result.position));
  assert.deepEqual(position,{x:13.5925,y:12,z:-21.1});
  assert.deepEqual(velocity,{x:-8,y:2,z:3});
});

test('overlapping castle hall, wing and tower bodies do not oscillate or leave an embedded rider', () => {
  for (const point of [[8.4,7,-1.1],[-8.4,7,-1.1],[-2,20,-6.8],[10.8,18,-5.9],[0,3,6.8]]) {
    const result = resolveRiderCollision(local('about',...point),zero,colliders);
    assert.equal(result.collided,true);
    assert.ok(safe(result.position),`embedded after resolving ${point}`);
    assert.equal(result.position.y,local('about',...point).y);
  }
});

test('per-component heights allow flight above side wings and beside a tapering spire', () => {
  assert.ok(safe(local('about',13.6,20,-1.1)), 'low wing must not inherit keep height');
  assert.ok(safe(local('about',1.8,47,-6.8)), 'spire radius narrows toward the top');
  assert.ok(safe(local('about',-2,51,-6.8)), 'flying above the tallest ornament is possible');
  assert.equal(resolveRiderCollision(local('about',-2,44,-6.8),zero,colliders).collided,true);
});

test('every landmark has structural collision but portal approaches remain accessible', () => {
  for (const id of ['about','publications','projects','research','contact']) {
    const result = resolveRiderCollision(local(id,0,4,0),zero,colliders);
    assert.equal(result.collided,true,id);
    assert.ok(safe(result.position),id);
  }
  assert.equal(resolveRiderCollision(local('journey',3.3,3,-1.2),zero,colliders).collided,true);
  for (const l of locations) assert.ok(safe({x:l.x,y:l.y+6,z:l.z+l.radius+5}),l.id);
});

test('ruin arch openings remain traversable instead of blocking the whole circular footprint', () => {
  assert.ok(safe(local('journey',0,2,-4.65)), 'low central cloister opening');
  assert.ok(safe(local('journey',1.3,2,-1.2)), 'low space below and beside the suspended crystal');
  const camera = shortenCameraBoom(local('journey',0,2,1),local('journey',0,2,-7),colliders);
  assert.equal(camera.blocked,false,'camera can see through two aligned open archways below the crystal');
});

test('reported yaw PI / elevation .39 / 16m boom stops before the castle facade', () => {
  const rider = {x:0,y:11,z:-3}, yaw = Math.PI, elevation = .39, distance = 16;
  const origin = {...rider,y:rider.y+1.3};
  const desired = {x:rider.x+Math.sin(yaw)*Math.cos(elevation)*distance,
    y:rider.y+Math.sin(elevation)*distance,z:rider.z+Math.cos(yaw)*Math.cos(elevation)*distance};
  const camera = shortenCameraBoom(origin,desired,colliders);
  assert.equal(camera.blocked,true);
  assert.ok(camera.colliderId.startsWith('about/'));
  assert.ok(camera.position.z > -14.5,'camera sphere must remain in front of the hall wall');
  assert.ok(camera.distance > 5 && camera.distance < distance);
  assert.equal(shortenCameraBoom(origin,camera.position,colliders).blocked,false,'entire shortened segment is clear');
  assert.deepEqual(origin,{x:0,y:12.3,z:-3});
});

test('camera rays clip intervening walls even when their endpoint is beyond the building', () => {
  const origin = local('publications',0,5,12), desired = local('publications',0,5,-20);
  const result = shortenCameraBoom(origin,desired,colliders);
  assert.equal(result.blocked,true);
  assert.ok(result.position.z > 6.7);
  assert.equal(shortenCameraBoom(origin,result.position,colliders).blocked,false);
});

test('the reported camera correction clears the actual castle mesh, not just its collision proxies', () => {
  const model = createCastle();
  model.position.set(0,5,-20);model.updateMatrixWorld(true);
  const origin = new THREE.Vector3(0,12.3,-3);
  const desired = new THREE.Vector3(0,11+Math.sin(.39)*16,-3-Math.cos(.39)*16);
  const direction = desired.clone().sub(origin).normalize();
  const ray = new THREE.Raycaster(origin,direction,0,origin.distanceTo(desired));
  assert.ok(ray.intersectObject(model,true).length > 0, 'the original boom demonstrably intersects rendered masonry');
  ray.far = shortenCameraBoom(origin,desired,colliders).distance;
  assert.equal(ray.intersectObject(model,true).length,0, 'the corrected segment ends before actual rendered surfaces');
  model.traverse(object => { if(object.geometry)object.geometry.dispose(); });
});

test('camera clearance cannot be overridden by a minimum boom and handles zero-length/embedded origins', () => {
  const origin = local('projects',-1,4,5.55);
  const close = shortenCameraBoom(origin,local('projects',-1,4,-10),colliders);
  assert.equal(close.blocked,true);
  assert.ok(close.distance < .2);
  assert.equal(shortenCameraBoom(local('projects',0,4,0),origin,colliders).distance,0);
  assert.deepEqual(shortenCameraBoom(origin,origin,colliders),{position:origin,distance:0,blocked:false,colliderId:null});
});

test('world offsets use location data and do not depend on location order or gameplay radius', () => {
  const relocated = [{id:'projects',x:500,y:30,z:-200,radius:999}];
  const custom = createBuildingColliders(relocated);
  const a = resolveRiderCollision({x:500,y:34,z:-200},zero,custom);
  assert.equal(a.collided,true);
  assert.equal(resolveRiderCollision(a.position,zero,custom).collided,false);
  assert.equal(resolveRiderCollision({x:40,y:7,z:24},zero,custom).collided,false);
});

test('repeated normal flight steps slide along the wall without accumulating penetration', () => {
  // This stretch is between the two real flying buttresses.
  let p = {x:16,y:12,z:-21.1}, velocity = {x:-5,y:0,z:1};
  for (let i=0;i<90;i++) {
    const proposed = {x:p.x-5/60,y:p.y,z:p.z+1/60};
    const result = resolveRiderCollision(proposed,velocity,colliders);
    p=result.position;
    assert.ok(safe(p),`step ${i}`);
    if(result.collided) assert.ok(result.velocity.x*result.normal.x+result.velocity.z*result.normal.z>=-1e-8);
  }
  assert.ok(p.z > -19.7,'tangent motion continues');
});
