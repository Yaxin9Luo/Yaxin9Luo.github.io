import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBuildingColliders, createBridgeColliders, resolveRiderCollision, shortenCameraBoom } from '../src/collision.js';
import { locations, bridges } from '../src/locations.js';
import { createCastle } from '../src/models.js';
import { createViaduct } from '../src/site-details.js';

const colliders = createBuildingColliders(locations);
const zero = { x:0, y:0, z:0 };
const local = (id,x,y,z) => { const l = locations.find(l => l.id === id); return { x:l.x+x, y:l.y+y, z:l.z+z }; };
const safe = p => !resolveRiderCollision(p,zero,colliders).collided;

test('the enlarged east wing pushes a rider outside its wall and preserves tangent velocity', () => {
  const position=local('about',25.5925,7,0),velocity={x:-8,y:2,z:3};
  const snapshot={...position};
  const result=resolveRiderCollision(position,velocity,colliders);
  assert.equal(result.collided,true);
  assert.ok(result.position.x > local('about',26.6,0,0).x);
  assert.equal(result.position.y,position.y);
  assert.deepEqual(result.velocity,{x:0,y:2,z:3});
  assert.ok(safe(result.position));
  assert.deepEqual(position,snapshot);
  assert.deepEqual(velocity,{x:-8,y:2,z:3});
});

test('overlapping castle wings, tall keep and frontispiece do not leave an embedded rider', () => {
  for(const point of [[-12,10,-12],[20,6,0],[-4,32,-13],[21,35,-14],[0,4,1]]) {
    const result=resolveRiderCollision(local('about',...point),zero,colliders);
    assert.equal(result.collided,true);
    assert.ok(safe(result.position),`embedded after resolving ${point}`);
    assert.equal(result.position.y,local('about',...point).y);
  }
});

test('individual heights permit low-wing overflight and clear space beside the keep pyramid', () => {
  assert.ok(safe(local('about',20,25,4)),'low wing must not inherit the 74m keep height');
  assert.ok(safe(local('about',2,70,-13)),'pyramid narrows toward the top');
  assert.ok(safe(local('about',-4,75,-13)),'above the tallest finial');
  assert.equal(resolveRiderCollision(local('about',-4,68,-13),zero,colliders).collided,true);
});

test('the enlarged forecourt, gate and side cloister remain open for a broom rider', () => {
  for(const z of [9,12,17,20,25]) assert.ok(safe(local('about',0,6,z)),`court/gate z=${z}`);
  assert.ok(safe(local('about',-13.3,4,6)),'inside the west cloister arcade');
  const boom=shortenCameraBoom(local('about',0,6,28),local('about',0,6,8),colliders);
  assert.equal(boom.blocked,false,'the gate must not become an invisible bounding-box wall');
});

test('a sky gallery collides with its deck but preserves the space below and between its walls', () => {
  assert.ok(safe(local('about',-16.5,26.1,-12.8)),'fly below the west bridge');
  assert.ok(safe(local('about',-16.5,30,-13.3)),'fly inside the roofed gallery');
  assert.equal(resolveRiderCollision(local('about',-16.5,28.3,-13.3),zero,colliders).collided,true);
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

test('yaw PI / elevation .39 / 16m boom stops before the new castle frontispiece', () => {
  const rider=local('about',0,6,17),yaw=Math.PI,elevation=.39,distance=16;
  const origin={...rider,y:rider.y+1.3};
  const desired={x:rider.x+Math.sin(yaw)*Math.cos(elevation)*distance,
    y:rider.y+Math.sin(elevation)*distance,z:rider.z+Math.cos(yaw)*Math.cos(elevation)*distance};
  const camera=shortenCameraBoom(origin,desired,colliders);
  assert.equal(camera.blocked,true);
  assert.ok(camera.colliderId.startsWith('about/'));
  assert.ok(camera.position.z > local('about',0,0,3.5).z);
  assert.ok(camera.distance>5&&camera.distance<distance);
  assert.equal(shortenCameraBoom(origin,camera.position,colliders).blocked,false);
});

test('camera rays clip intervening walls even when their endpoint is beyond the building', () => {
  const origin = local('publications',0,5,12), desired = local('publications',0,5,-20);
  const result = shortenCameraBoom(origin,desired,colliders);
  assert.equal(result.blocked,true);
  assert.ok(result.position.z > local('publications',0,0,6.7).z);
  assert.equal(shortenCameraBoom(origin,result.position,colliders).blocked,false);
});

test('the reported camera correction clears the actual castle mesh, not just its collision proxies', () => {
  const model = createCastle();
  const l=locations.find(l=>l.id==='about');
  model.position.set(l.x,l.y,l.z);model.updateMatrixWorld(true);
  const origin=new THREE.Vector3().copy(local('about',0,7.3,17));
  const desired=new THREE.Vector3().copy(local('about',0,6+Math.sin(.39)*16,17-Math.cos(.39)*16));
  const direction = desired.clone().sub(origin).normalize();
  const ray = new THREE.Raycaster(origin,direction,0,origin.distanceTo(desired));
  assert.ok(ray.intersectObject(model,true).length > 0, 'the original boom demonstrably intersects rendered masonry');
  ray.far = shortenCameraBoom(origin,desired,colliders).distance;
  assert.equal(ray.intersectObject(model,true).length,0, 'the corrected segment ends before actual rendered surfaces');
  const gateStart=new THREE.Vector3().copy(local('about',0,6,28));
  const gateEnd=new THREE.Vector3().copy(local('about',0,6,8));
  ray.set(gateStart,gateEnd.clone().sub(gateStart).normalize());ray.far=gateStart.distanceTo(gateEnd);
  assert.equal(ray.intersectObject(model,true).length,0,'the collision passage agrees with the real open gate mesh');
  const galleryStart=new THREE.Vector3().copy(local('about',-16.5,26.1,-10));
  const galleryEnd=new THREE.Vector3().copy(local('about',-16.5,26.1,-17));
  ray.set(galleryStart,galleryEnd.clone().sub(galleryStart).normalize());ray.far=galleryStart.distanceTo(galleryEnd);
  assert.equal(ray.intersectObject(model,true).length,0,'the rendered gallery also leaves the fly-under route open');
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
  let p=local('about',27.3,7,-1.8),velocity={x:-5,y:0,z:1};
  for (let i=0;i<90;i++) {
    const proposed = {x:p.x-5/60,y:p.y,z:p.z+1/60};
    const result = resolveRiderCollision(proposed,velocity,colliders);
    p=result.position;
    assert.ok(safe(p),`step ${i}`);
    if(result.collided) assert.ok(result.velocity.x*result.normal.x+result.velocity.z*result.normal.z>=-1e-8);
  }
  assert.ok(p.z > local('about',0,0,-.4).z,'tangent motion continues');
});

const bridgePoint = (ends, x, y, z, elevation = 6.82) => {
  const [a,b] = ends, length = Math.hypot(b[0]-a[0],b[1]-a[1]);
  const sin = (b[0]-a[0])/length, cos = (b[1]-a[1])/length;
  return {x:(a[0]+b[0])/2+cos*x+sin*z,y:y+elevation,z:(a[1]+b[1])/2-sin*x+cos*z};
};

test('both rotated viaducts stop riders at the deck, rails, piers and arch shoulders', () => {
  const bridgeColliders = createBridgeColliders(bridges);
  for (const [id,ends] of Object.entries(bridges)) {
    const length = Math.hypot(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]);
    const span = length/Math.max(2,Math.round(length/8));
    for(const [part,point] of [
      ['deck',[0,0,0]],['rail',[2.86,1.45,0]],
      ['pier',[2.45,-10,-length/2+span]],['arch shoulder',[2.45,-1,0]],
    ]) {
      const position = bridgePoint(ends,...point), velocity={x:1,y:-2,z:3};
      const result = resolveRiderCollision(position,velocity,bridgeColliders);
      assert.equal(result.collided,true,`${id} ${part}`);
      assert.ok(result.colliderId.startsWith(`bridge/${id}/`));
      assert.equal(result.position.y,position.y,'bridge uses the same X/Z recovery contract');
      assert.equal(resolveRiderCollision(result.position,zero,bridgeColliders).collided,false,`${id} ${part} fully cleared`);
      assert.ok(result.velocity.x*result.normal.x+result.velocity.z*result.normal.z>=-1e-8);
    }
    assert.equal(resolveRiderCollision(bridgePoint(ends,0,3.5,0),zero,bridgeColliders).collided,false,'overflight remains clear');
  }
});

test('all six viaduct archways remain open to riders and cameras in the actual bridge mesh', () => {
  const bridgeColliders = createBridgeColliders(bridges);
  for (const [id,ends] of Object.entries(bridges)) {
    const length = Math.hypot(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]);
    const count = Math.max(2,Math.round(length/8)), span = length/count;
    const model = createViaduct(length), center=bridgePoint(ends,0,0,0);
    model.position.copy(center);model.rotation.y=Math.atan2(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]);model.updateMatrixWorld(true);
    for(let i=0;i<count;i++) {
      const z=-length/2+(i+.5)*span;
      for(let x=-6;x<=6;x+=.2) assert.equal(
        resolveRiderCollision(bridgePoint(ends,x,-5.5,z),zero,bridgeColliders).collided,false,`${id} arch ${i}, x=${x}`);
      const origin=new THREE.Vector3().copy(bridgePoint(ends,-7,-4.5,z));
      const desired=new THREE.Vector3().copy(bridgePoint(ends,7,-4.5,z));
      assert.equal(shortenCameraBoom(origin,desired,bridgeColliders).blocked,false,`${id} arch ${i} camera`);
      const ray=new THREE.Raycaster(origin,desired.clone().sub(origin).normalize(),0,origin.distanceTo(desired));
      assert.equal(ray.intersectObject(model,true).length,0,`${id} arch ${i} real opening`);
    }
    // These routes actually cross masonry; a ray must stop before the mesh.
    for(const [from,to] of [[[0,4,0],[0,-4,0]],[[-7,-1,0],[7,-1,0]],[[-7,-10,-length/2+span],[7,-10,-length/2+span]]]) {
      const origin=new THREE.Vector3().copy(bridgePoint(ends,...from));
      const desired=new THREE.Vector3().copy(bridgePoint(ends,...to));
      const ray=new THREE.Raycaster(origin,desired.clone().sub(origin).normalize(),0,origin.distanceTo(desired));
      assert.ok(ray.intersectObject(model,true).length>0,`${id} route demonstrably crosses bridge mesh`);
      const result=shortenCameraBoom(origin,desired,bridgeColliders);
      assert.equal(result.blocked,true,`${id} solid camera route`);
      ray.far=result.distance;
      assert.equal(ray.intersectObject(model,true).length,0,`${id} corrected boom clears actual mesh`);
    }
    model.traverse(o=>o.geometry?.dispose());
  }
});

test('bridge proxies follow translated/reversed endpoints and explicit deck elevation', () => {
  const ends=[[500,-250],[516,-230]], moved=createBridgeColliders({test:ends},{elevation:30});
  assert.equal(resolveRiderCollision(bridgePoint(ends,0,0,0,30),zero,moved).collided,true);
  assert.equal(resolveRiderCollision(bridgePoint(ends,0,0,0),zero,moved).collided,false);
  const reversed=createBridgeColliders({test:[ends[1],ends[0]]},{elevation:30});
  for(const p of [[0,0,0],[2.45,-10,0],[0,-5.5,0],[0,4,0]]) {
    const world=bridgePoint(ends,...p,30);
    assert.equal(resolveRiderCollision(world,zero,moved).collided,resolveRiderCollision(world,zero,reversed).collided);
  }
  assert.deepEqual(createBridgeColliders({}),[]);
  assert.deepEqual(createBridgeColliders({empty:[[1,2],[1,2]]}),[]);
});
