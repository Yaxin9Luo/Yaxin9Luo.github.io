import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial,Raycaster,Vector3} from 'three';
import {createXieqiquCourtGround,bindXieqiquFountainWater} from '../src/yuanmingyuan/xieqiqu-court-ground.js';
import {flowerOutline} from '../src/yuanmingyuan/xieqiqu-geometry.js';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {triangulateSurface} from '../src/yuanmingyuan/terrain-geometry.js';
import {createGardenWater} from '../src/yuanmingyuan/garden-water.js';
import {sitePoint} from '../src/yuanmingyuan/museum-sites.js';

const site={id:'xieqiqu',assetId:'xieqiqu',position:[395,4,-565],rotationY:0,scale:1};
const pools=[['xieqiqu-south-haitang-pool','haitang',0,26,13,8.5],['xieqiqu-north-chrysanthemum-pool','chrysanthemum',0,-27,4.8,4.8]];
const rings=()=>pools.map(([,kind,x,z,rx,rz])=>{const outer=flowerOutline(kind,x,z,rx,rz);return {outer,inner:outer.map(([px,pz])=>[x+(px-x)*.957,z+(pz-z)*.957])};});
const mapPoint=(site,[x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};

function fixture(t,{placement=site,waterPoolCount=2}={}){
  const plan=createXieqiquCourtGround(placement),group=new Group(),terrainGroup=new Group(),owned=new Set(),materials=new Set(),sheets=[],beds=[],rims=[],jets=[],bowls=[];let disposed=false,resourceDisposals=0;
  const own=geometry=>{owned.add(geometry);geometry.addEventListener('dispose',()=>resourceDisposals++);return geometry;};
  const material=(category,role)=>{const value=new MeshStandardMaterial();value.userData={category,...(role?{role}:{})};materials.add(value);return value;};
  const stone=material('stone'),surface=material('water','surface'),flow=material('water','flow');
  const add=(parent,geometry,material)=>{const mesh=new Mesh(own(geometry),material);parent.add(mesh);return mesh;};
  const profiles=rings();
  const paving=add(group,extrudedPolygon([[-52,-51],[52,-51],[52,40.75],[-52,40.75]],-.65,0,profiles.map(p=>p.outer)),stone);
  pools.forEach(([name,,,z],i)=>{
    const basin=new Group();basin.name=name;group.add(basin);const {outer,inner}=profiles[i];
    rims.push(add(basin,extrudedPolygon(outer,-.60,.43,[inner]),stone));
    beds.push(add(basin,extrudedPolygon(inner,-.61,-.45),stone));
    sheets.push(add(basin,extrudedPolygon(inner,.114,.13),surface));
    const jet=add(basin,new BoxGeometry(.025,1,.025),flow);jet.position.set(1,1,z);jets.push(jet);
    // The real elevated bowl water is a sibling of the broad basin group.
    const bowl=add(group,new BoxGeometry(.4,.014,.4),surface);bowl.position.set(0,3,z);bowls.push(bowl);
  });
  group.position.fromArray(placement.position);group.rotation.y=placement.rotationY;group.scale.setScalar(placement.scale);group.updateMatrixWorld(true);
  const waterSurfaces=plan.courts.map(court=>{
    add(terrainGroup,extrudedPolygon(court.polygon,court.floorY-.05,court.floorY),stone);
    const geometry=own(triangulateSurface([{outer:court.water.surfacePolygon,holes:[]}],{heightAt:()=>0,edgeLength:Infinity}));
    return {id:`${court.id}-water`,worldY:court.water.surfaceY,polygon:court.water.surfacePolygon,geometry};
  });
  const coast=[[250,-720],[560,-720],[560,-430],[250,-430]],terrain={group:terrainGroup,disposed:false,waterSurfaces,courtFootprints:plan.courts};
  const water=createGardenWater({terrain:{waterSurfaces:waterSurfaces.slice(0,waterPoolCount),coastPolygon:coast},layout:{exhibition:{seaY:0,coast:{polygon:coast}}},resolution:8});
  const owner={group,get disposed(){return disposed;},dispose(){disposed=true;}};
  t.after(()=>{water.dispose();for(const geometry of owned)geometry.dispose();for(const material of materials)material.dispose();owner.dispose();});
  const flags=()=>sheets.map(mesh=>({visible:mesh.visible,own:Object.hasOwn(mesh.userData,'navigation'),navigation:mesh.userData.navigation}));
  return {plan,owner,terrain,water,paving,sheets,beds,rims,jets,bowls,owned,flags,get resourceDisposals(){return resourceDisposals;}};
}

test('authored profiles, .957 inner scale, .13 water and -.68 support transform consistently without survey claims',()=>{
  const placed={...site,position:[10,8,20],rotationY:Math.PI/2,scale:2},plan=createXieqiquCourtGround(placed),profiles=rings();
  assert.equal(plan.courts.length,2);assert.equal(plan.alignment.metresCalibrated,false);
  for(let i=0;i<2;i++){const court=plan.courts[i];assert.deepEqual(court.polygon,profiles[i].outer.map(p=>mapPoint(placed,p)));assert.deepEqual(court.water.surfacePolygon,profiles[i].inner.map(p=>mapPoint(placed,p)));assert.equal(court.water.polygon.length,160);assert.deepEqual(court.water.polygon,court.water.surfacePolygon);assert.equal(court.floorY,6.64);assert.equal(court.rimY,6.7);assert.equal(court.water.surfaceY,8.26);}
  assert.deepEqual(plan.pads[0].polygon,[[-52,-51],[52,-51],[52,40.75],[-52,40.75]].map(p=>mapPoint(placed,p)));
  assert.equal(plan.pads[0].heightY,6.64);assert.equal(plan.pads[0].blend,4);assert.equal(plan.site,placed);
});

test('non-finite or overflowing placement cannot generate invalid terrain polygons',()=>{
  for(const scale of [Infinity,-Infinity,NaN,0,-1,Number.MAX_VALUE])assert.throws(()=>createXieqiquCourtGround({...site,scale}));
  for(const position of [[0,NaN,0],[0,0],[Infinity,0,0]])assert.throws(()=>createXieqiquCourtGround({...site,position}));
  assert.throws(()=>createXieqiquCourtGround({...site,rotationY:Infinity}));
});

test('real small paving has both flower holes and the terrain floor lies beneath the retained stone bed',t=>{
  const f=fixture(t),ray=new Raycaster();f.terrain.group.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
    const [, ,x,z]=pools[i],p=sitePoint(site,[x,2,z]);ray.set(new Vector3(p.x,p.y,p.z),new Vector3(0,-1,0));
    assert.equal(ray.intersectObject(f.paving).length,0);const stone=ray.intersectObject(f.beds[i])[0],soil=ray.intersectObject(f.terrain.group,true)[0];
    assert(Math.abs(stone.point.y-3.55)<1e-6);assert(Math.abs(soil.point.y-3.32)<1e-6);assert(stone.point.y>soil.point.y+.22);
  }
  assert(Math.abs(new Box3().setFromObject(f.paving).min.y-f.plan.pads[0].heightY-.03)<1e-6);
});

test('soil cut-wall top remains at the real paving underside and below all of the stone outer-wall area',t=>{
  const f=fixture(t),pavingBottom=new Box3().setFromObject(f.paving).min.y;
  for(let i=0;i<2;i++){
    const court=f.plan.courts[i],stone=new Box3().setFromObject(f.rims[i]);
    assert(court.rimY>court.floorY);assert(court.rimY<=pavingBottom+1e-6);
    const sharedVerticalLength=Math.max(0,Math.min(court.rimY,stone.max.y)-Math.max(court.floorY,stone.min.y));
    assert.equal(sharedVerticalLength,0,'the old -.03 rim overlapped .57 m of the source outer stone wall');
  }
});

test('matching actual merged water hides only two broad sheets and restores original flags without owning resources',t=>{
  const f=fixture(t);f.sheets[0].userData.navigation='authored-wet';f.sheets[1].visible=false;const before=f.flags(),vertices=[...f.owned].map(g=>g.attributes.position.array.slice());
  const restore=bindXieqiquFountainWater(f.plan,f);
  assert(f.sheets.every(mesh=>!mesh.visible&&mesh.userData.navigation===false));assert([...f.beds,...f.jets,...f.bowls].every(mesh=>mesh.visible));assert.equal(f.resourceDisposals,0);
  restore();restore();assert.deepEqual(f.flags(),before);assert.equal(f.owner.disposed,false);assert.equal(f.water.snapshot().disposed,false);assert.equal(f.resourceDisposals,0);
  [...f.owned].forEach((g,i)=>assert.deepEqual(g.attributes.position.array,vertices[i]));
});

test('actual water coverage remains valid after rotated and scaled source placement',t=>{
  const f=fixture(t,{placement:{...site,position:[385,7,-550],rotationY:.43,scale:1.23}}),restore=bindXieqiquFountainWater(f.plan,f);
  assert(f.sheets.every(mesh=>!mesh.visible));restore();assert(f.sheets.every(mesh=>mesh.visible));assert.equal(f.resourceDisposals,0);
});

test('a missing second terrain opening or mismatched level/polygon fails before either source sheet changes',t=>{
  const f=fixture(t),original=f.terrain.waterSurfaces[1],before=f.flags();
  for(const bad of [null,{...original,worldY:3.8},{...original,polygon:[[0,0],[1,0],[0,1]]}]){
    f.terrain.waterSurfaces=bad?[f.terrain.waterSurfaces[0],bad]:[f.terrain.waterSurfaces[0]];
    assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
  }
});

test('terrain water triangles alone do not substitute for the matching excavated court and wet navigation mask',t=>{
  const f=fixture(t),original=f.terrain.courtFootprints,before=f.flags();
  f.terrain.courtFootprints=original.slice(0,1);assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
  f.terrain.courtFootprints=[original[0],{...original[1],water:{...original[1].water,polygon:original[1].polygon}}];
  assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
});

test('a composed sheet at the correct height but containing only the first pool is insufficient',t=>{
  const f=fixture(t,{waterPoolCount:1}),before=f.flags();assert.equal(f.water.snapshot().sheets[0].height,f.plan.courts[1].water.surfaceY);
  assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
});

test('draw-range holes and a moved composed sheet cannot pass on snapshot height alone',t=>{
  const f=fixture(t),sheet=f.water.sheets[0],before=f.flags(),count=f.terrain.waterSurfaces[0].geometry.index.count;
  sheet.geometry.setDrawRange(0,count);assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
  sheet.geometry.setDrawRange(0,Infinity);sheet.position.x+=.5;assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
});

test('owner placement must agree with the authored ground input before its water is handed off',t=>{
  const f=fixture(t),before=f.flags();f.owner.group.position.x+=.25;
  assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);
});

test('a missing or ambiguous second named source sheet leaves the first sheet untouched',t=>{
  const f=fixture(t),before=f.flags(),second=f.sheets[1],basin=second.parent;basin.remove(second);
  assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);basin.add(second);
  const duplicate=second.clone();basin.add(duplicate);assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);basin.remove(duplicate);
});

test('overlapping borrows restore only after the last matching water binding is released',t=>{
  const f=fixture(t),before=f.flags(),first=bindXieqiquFountainWater(f.plan,f),second=bindXieqiquFountainWater(f.plan,f);
  first();first();assert(f.sheets.every(mesh=>!mesh.visible));second();second();assert.deepEqual(f.flags(),before);
});

test('an active owner cannot silently switch its terrain/water binding before the prior release',t=>{
  const f=fixture(t),restore=bindXieqiquFountainWater(f.plan,f);
  assert.throws(()=>bindXieqiquFountainWater(f.plan,{...f,terrain:{...f.terrain}}));assert(f.sheets.every(mesh=>!mesh.visible));restore();assert(f.sheets.every(mesh=>mesh.visible));
});

test('a write failure on the second source sheet rolls back all earlier visibility/navigation changes',t=>{
  const f=fixture(t),before=f.flags();Object.freeze(f.sheets[1].userData);
  assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);assert.equal(f.resourceDisposals,0);
});

test('disposed source, terrain and water owners are refused without claiming ownership of siblings',t=>{
  for(const kind of ['terrain','owner','water']){
    const f=fixture(t),before=f.flags();if(kind==='terrain')f.terrain.disposed=true;else f[kind].dispose();
    assert.throws(()=>bindXieqiquFountainWater(f.plan,f));assert.deepEqual(f.flags(),before);assert.equal(f.resourceDisposals,0);
  }
});
