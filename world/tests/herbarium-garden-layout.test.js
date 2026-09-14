import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {communityShrubs,communityFerns,communityFlowers} from '../src/herbarium-community-layout.js';
import {authoredRegionalCommunities,authoredLowGardenBeds} from '../src/herbarium-regional-layout.js';
import {herbariumArrivalReserved,herbariumCommunitySoilAt,registerHerbariumCommunityFootprints,subscribeHerbariumCommunitySoil} from '../src/herbarium-layout.js';
import {herbariumPlantGroundSupport} from '../src/herbarium-district.js';

test('integrated recipes retain the canonical specimen and natural growth stages',()=>{
  for(const region of authoredRegionalCommunities){
    const canonical=region.plants.filter(p=>p.canonical);
    assert.deepEqual(canonical.filter(p=>p.species==='didelta_spinosa').map(p=>[p.variant,p.x,p.z,p.scale,p.yaw]),communityShrubs);
    assert.deepEqual(canonical.filter(p=>p.species==='fern_02').map(p=>[p.x,p.z,p.variant,p.scale,p.yaw]),communityFerns);
    assert.deepEqual(canonical.filter(p=>p.species==='periwinkle_plant').map(p=>[p.x,p.z]),communityFlowers);
    const additions=region.plants.filter(p=>!p.canonical&&p.species==='didelta_spinosa');assert.deepEqual([...new Set(additions.map(p=>p.variant))].sort(),[0,1,2]);
    for(const plant of additions)assert.ok(plant.scale>=.9&&plant.scale<=1.1,'source growth stage supplies size without enlarging the whole plant');
    assert.ok(new Set(additions.map(p=>p.patch)).size>1,'separately authored lobes extend the source group');
  }
  for(const bed of [...authoredRegionalCommunities,...authoredLowGardenBeds]){
    const c=Math.cos(bed.rotation),s=Math.sin(bed.rotation);
    for(const p of bed.plants){
      const x=bed.x+p.x*c+p.z*s,z=bed.z-p.x*s+p.z*c;
      assert.ok([x,z,p.yaw,p.scale].every(Number.isFinite));assert.equal(herbariumArrivalReserved(x,z),false,`${bed.id}/${p.patch}: root inside retained reservation`);
      if(p.species==='fern_02')assert.ok(p.variant===0?p.scale>=2&&p.scale<=2.45:p.scale>=2.75&&p.scale<=3.35);
    }
  }
});

test('accepted soil registrations refresh listeners and release only their own world',()=>{
  const square=(x,z)=>({loop:[[x-1,z-1],[x+1,z-1],[x+1,z+1],[x-1,z+1]]});
  const read=()=>[herbariumCommunitySoilAt(-10,60),herbariumCommunitySoilAt(65,10)],updates=[];
  assert.deepEqual(read(),[0,0]);const unsubscribe=subscribeHerbariumCommunitySoil(()=>updates.push(read()));
  const releaseA=registerHerbariumCommunityFootprints([square(-10,60)]),releaseB=registerHerbariumCommunityFootprints([square(65,10)]);
  assert.deepEqual(updates,[[1,0],[1,1]]);releaseA();assert.deepEqual(read(),[0,1]);assert.deepEqual(updates.at(-1),[0,1]);
  releaseA();assert.equal(updates.length,3,'idempotent owner release cannot invalidate another owner');unsubscribe();releaseB();assert.deepEqual(read(),[0,0]);assert.equal(updates.length,3,'disposed listener receives no later texture refresh');
});

test('soil uses the installed crown outline and retains holes and arrival/actor reservations',()=>{
  const release=registerHerbariumCommunityFootprints([
    {loop:[[-13,59],[-9,59],[-10,61]],strength:.82},
    {loop:[[4,54],[8,54],[8,58],[4,58]]},
    {loop:[[-20,39],[-16,39],[-16,42],[-20,42]]},
  ]);
  try{
    assert.ok(herbariumCommunitySoilAt(-10.8,59.5)>.8);assert.equal(herbariumCommunitySoilAt(-12.8,60.9),0,'empty corner of the source crown box does not become soil');
    assert.equal(herbariumCommunitySoilAt(6,56),0);assert.equal(herbariumCommunitySoilAt(-17,41),0);
  }finally{release();}
});

test('source support and soil footprint follow the complete turned plant without editing geometry',()=>{
  const geometry=new THREE.BoxGeometry(.2,.8,2),mesh=new THREE.Mesh(geometry),plant=new THREE.Group();geometry.translate(0,.4,0);plant.add(mesh);
  const original=geometry.attributes.position.array.slice(),flat=herbariumPlantGroundSupport(plant,()=>0);
  assert.equal(flat.valid,true);assert.ok(Math.max(...flat.footprint.loop.map(p=>p[1]))>.99);
  const slope=herbariumPlantGroundSupport(plant,(x,z)=>z*.3);assert.equal(slope.valid,false,'root centre alone would miss the unsupported wide base');
  plant.rotation.y=Math.PI/2;plant.position.set(10,2,20);const turned=herbariumPlantGroundSupport(plant,()=>2);
  assert.equal(turned.valid,true);assert.ok(Math.max(...turned.footprint.loop.map(p=>p[0]))>10.99);assert.ok(Math.max(...turned.footprint.loop.map(p=>p[1]))<20.11);
  assert.deepEqual(geometry.attributes.position.array,original);geometry.dispose();mesh.material.dispose();
});
