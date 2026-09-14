import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMuseumPlantingColliders} from '../src/yuanmingyuan/museum-planting-colliders.js';
import {stepMuseumFlightAroundPlants} from '../src/yuanmingyuan/planting-flight.js';
import {stepMuseumFlight,museumVisitorCollider,MUSEUM_FLIGHT} from '../src/yuanmingyuan/visitor-motion.js';

function trunk(){
  const group=new THREE.Group(),part=new THREE.Group(),geometry=new THREE.BoxGeometry(.8,18,.8).translate(0,9,0),material=new THREE.MeshStandardMaterial();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='willow-trunk-and-roots';part.userData={species:'willow',placementId:'flight-trunk'};part.position.y=4;part.add(mesh);group.add(part);
  const planting=createMuseumPlantingColliders({group,parts:[part]},{terrain:{paths:[]}});
  return {planting,dispose(){planting.dispose();geometry.dispose();material.dispose();group.clear();}};
}
const surfaceAt=()=>({height:4,waterY:2});

test('without planting the original flight, height and water rules remain exact',()=>{
  for(const input of [{x:1,z:.4,boost:true},{x:-.3,z:.1,vertical:-1},{vertical:1},{}])for(const dt of [0,.02,.1,1]){
    const p={x:5,y:12,z:6};assert.deepEqual(stepMuseumFlightAroundPlants(p,input,dt,{surfaceAt}),stepMuseumFlight(p,input,dt,{surfaceAt}));
  }
});

test('a boosted frame cannot tunnel through a real named tree body and tangent motion remains possible',t=>{
  const h=trunk();t.after(h.dispose);const start={x:-4,y:10,z:0};
  const hit=stepMuseumFlightAroundPlants(start,{x:1,z:0,boost:true},.1,{surfaceAt,planting:h.planting});
  assert.ok(hit.x<-1.5&&hit.x>-1.6);assert.equal(hit.y,10);assert.equal(hit.z,0);assert.ok(h.planting.diagnostics.flightBlocked>0);
  const tangent=stepMuseumFlightAroundPlants(hit,{x:0,z:1},.1,{surfaceAt,planting:h.planting});
  assert.ok(tangent.z>2.7);assert.ok(Math.abs(tangent.x-hit.x)<1e-8);
});

test('the floor is resampled at the post-collision XZ, preserving terrain clearance on the near side of a drop',t=>{
  const h=trunk();t.after(h.dispose);const ground=(x)=>({height:x<-1?6:2,waterY:2}),start={x:-4,y:12,z:0};
  const baseline=stepMuseumFlight(start,{x:1,boost:true,vertical:-1},.1,{surfaceAt:ground});
  assert.ok(baseline.x>0&&baseline.y<12);
  const hit=stepMuseumFlightAroundPlants(start,{x:1,boost:true,vertical:-1},.1,{surfaceAt:ground,planting:h.planting});
  assert.ok(hit.x<-1.5);assert.ok(hit.y>=ground(hit.x).height+MUSEUM_FLIGHT.minAltitude);assert.equal(hit.y,12);
});

test('invalid activation inside a trunk is recorded without moving farther through it',t=>{
  const h=trunk();t.after(h.dispose);const start={x:0,y:10,z:0};
  assert.deepEqual(stepMuseumFlightAroundPlants(start,{x:1,boost:true},.1,{surfaceAt,planting:h.planting}),start);
  assert.equal(h.planting.diagnostics.initialOverlaps,1);
});

test('flight body dimensions come from the same collider used by NPC avoidance',()=>{
  const p={x:7,y:10,z:-2},body=museumVisitorCollider({mode:'flying',position:p});
  assert.equal(body.radius,1.1);assert.equal(body.height,body.top-body.bottom);assert.ok(Math.abs(body.height-3.2)<1e-10);
  const calls=[],planting={constrainFlight(from,to,options){calls.push(options);return {position:to,initialOverlap:false};}};
  stepMuseumFlightAroundPlants(p,{x:1},.1,{surfaceAt,planting});
  assert.equal(calls.length,1);assert.equal(calls[0].radius,body.radius);assert.equal(calls[0].height,body.height);assert.equal(calls[0].centerOffsetY,(body.top+body.bottom)/2-p.y);
});
