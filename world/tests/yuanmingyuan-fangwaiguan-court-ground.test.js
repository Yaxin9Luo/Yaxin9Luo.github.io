import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createFangwaiguanCourtGround,bindFangwaiguanCourtWater} from '../src/yuanmingyuan/fangwaiguan-court-ground.js';
import {namedGroup,extrudedPolygon,TAU} from '../src/yuanmingyuan/study-geometry.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {createGardenWater} from '../src/yuanmingyuan/garden-water.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {museumSupport} from '../src/yuanmingyuan/museum-support.js';
import {sitePoint,museumSite} from '../src/yuanmingyuan/museum-sites.js';
import {pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {distanceToRing,smoothstep} from '../src/yuanmingyuan/terrain-geometry.js';
import {prepareTerrainPads,applyTerrainPads} from '../src/yuanmingyuan/terrain-pads.js';

const source=readFileSync(new URL('../src/yuanmingyuan/fangwaiguan-study.js',import.meta.url),'utf8');
const start=source.indexOf('function court(b, root) {'),end=source.indexOf('\nfunction diagnostics(',start);
assert.ok(start>=0&&end>start);
const courtSource=source.slice(start,end),circleSource=source.match(/^function circle\(.*$/m)?.[0];
assert.ok(circleSource);
const court=vm.runInNewContext(`${circleSource}\n${courtSource}\ncourt`,{THREE,TAU,namedGroup,INFERRED:'fixture-authored',stoneRail(){}});
const site=museumSite('fangwaiguan');
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const point=(site,[x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};
const close=(actual,expected,epsilon=1e-5)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} differs from ${expected}`);
const channel='fangwaiguan-water-channel',basin='wuzhuting-front-fountain-basin';
function tinyTerrain(placement){
  const plan=createFangwaiguanCourtGround(placement);
  const layout={id:'fangwaiguan-local-court-fixture',exhibition:{seaY:0,groundY:placement.position[1],coast:{polygon:rect(-65,-52,65,84).map(p=>point(placement,p))}},waterBodies:[],ornamentalWaters:[],channels:[],islands:[],gardens:[],landforms:[],bridges:[]};
  return {plan,layout,terrain:createGardenTerrain({layout,assetCourts:plan.courts,assetPads:plan.pads,gates:[]})};
}
let shared;
const evidence={scope:'real court primitives and a local empty landscape only; no full asset, archive decoding or GPU',sourceSHA256:createHash('sha256').update(source).digest('hex')};
test.before(()=>{const before=performance.now();shared=tinyTerrain(site);evidence.terrainBuildMilliseconds=performance.now()-before;evidence.terrainDiagnostics=shared.terrain.diagnostics;});
test.after(()=>{
  if(shared){
    evidence.padProbes=[[-18.4,10],[18.4,10],[0,35],[18.79,16.85],[18.81,16.85],[24,16.85]].map(local=>{const p=sitePoint(site,[local[0],0,local[1]]),hit=shared.terrain.surfaceAt(p.x,p.z);return{local,world:[p.x,p.z],height:hit.height};});
    shared.terrain.dispose();evidence.terrainDisposed=shared.terrain.disposed;
  }
  if(process.env.FANGWAIGUAN_GROUND_REPORT)writeFileSync(process.env.FANGWAIGUAN_GROUND_REPORT,JSON.stringify(evidence,null,2)+'\n');
});

// Execute only the real court() body with its source primitives. The building,
// pavilions and decorative rail/leaf factories are never constructed. Keep the
// actual bridge deck/steps, rounded banks, pools and stone fountain for rays.
function fixture(t,{placement=site,waterCount=2}={}){
  const local=placement===site?shared:tinyTerrain(placement),{plan,terrain,layout}=local,group=new THREE.Group(),owned=new Set(),materials=new Set(),calls=[];
  let disposed=false,resourceDisposals=0;
  const material=category=>{const m=new THREE.MeshStandardMaterial();m.userData={category};materials.add(m);return m;};
  const stone=material('stone'),waterMaterial=material('water');
  waterMaterial.transparent=true;waterMaterial.depthWrite=false;
  const add=(parent,geometry,material)=>{owned.add(geometry);geometry.addEventListener('dispose',()=>resourceDisposals++);const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);return mesh;};
  const builder={m:{paving:stone,recess:stone,stone,water:waterMaterial,carving:stone,soil:material('soil'),foliage:material('foliage')},
    polygon(parent,points,bottom,top,material,holes=[]){const mesh=add(parent,extrudedPolygon(points,bottom,top,holes),material);calls.push({kind:'polygon',parent:parent.name,points,bottom,top,holes,mesh});},
    box(parent,material,position,size,bevel=0){const geometry=bevel?new RoundedBoxGeometry(...size,1,Math.min(bevel,...size.map(v=>v/6))):new THREE.BoxGeometry(...size);geometry.translate(...position);const mesh=add(parent,geometry,material);calls.push({kind:'box',parent:parent.name,position,size,bevel,mesh});},
    lathe(parent,profile,position){const geometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(Math.max(.003,r),y)),24);geometry.translate(...position);add(parent,geometry,stone);},
    leaf(){},flush(){},
  };
  court(builder,group);
  evidence.sourceFixture??={meshCount:owned.size,triangles:[...owned].reduce((sum,g)=>sum+(g.index?.count??g.attributes.position.count)/3,0),bytes:[...owned].reduce((sum,g)=>sum+[...Object.values(g.attributes),g.index].filter(Boolean).reduce((bytes,a)=>bytes+a.array.byteLength,0),0)};
  group.position.fromArray(placement.position);group.rotation.y=placement.rotationY;group.scale.setScalar(placement.scale);group.updateMatrixWorld(true);
  const sheets=[channel,basin].map(name=>group.getObjectByName(name).children.find(node=>node.isMesh&&node.material===waterMaterial));
  const water=createGardenWater({terrain:{waterSurfaces:terrain.waterSurfaces.slice(0,waterCount),coastPolygon:terrain.coastPolygon},layout,resolution:8});
  const owner={group,get disposed(){return disposed;},dispose(){disposed=true;}};
  t.after(()=>{water.dispose();for(const g of owned)g.dispose();for(const m of materials)m.dispose();owner.dispose();if(placement!==site)terrain.dispose();});
  const flags=()=>sheets.map(mesh=>({visible:mesh.visible,own:Object.hasOwn(mesh.userData,'navigation'),navigation:mesh.userData.navigation}));
  return {plan,owner,terrain,water,calls,sheets,owned,flags,get resourceDisposals(){return resourceDisposals;}};
}
function down(mesh,site,x,z,maxY=5){
  mesh.updateWorldMatrix(true,true);const p=sitePoint(site,[x,maxY,z]);
  return new THREE.Raycaster(new THREE.Vector3(p.x,p.y,p.z),new THREE.Vector3(0,-1,0)).intersectObject(mesh,true)[0]??null;
}
function geometryDigest(geometries){
  const hash=createHash('sha256');
  for(const geometry of geometries)for(const attribute of [...Object.values(geometry.attributes),geometry.index].filter(Boolean)){
    const array=attribute.array;hash.update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
  }
  return hash.digest('hex');
}

test('the actual landHeight function keeps buried court rims out of the lawn and preserves the old default',()=>{
  const code=readFileSync(new URL('../src/yuanmingyuan/garden-terrain.js',import.meta.url),'utf8');
  const from=code.indexOf('  function landHeight('),to=code.indexOf('\n  function bedHeight(',from);assert(from>=0&&to>from);
  const plan=createFangwaiguanCourtGround(site),pads=prepareTerrainPads(plan.pads),empty={at:()=>[]},far={distance:()=>100};
  const run=courts=>vm.runInNewContext(code.slice(from,to)+'\nlandHeight',{
    shore:far,oceanShore:far,groundY:4,seaY:0,wave:()=>0,lerp:THREE.MathUtils.lerp,smoothstep,
    hillIndex:empty,hillCentres:new Map(),courtNearIndex:{at:()=>courts},padNearIndex:{at:()=>pads},
    waterIndex:empty,waters:[],pointInPolygon,distanceToRing,applyTerrainPads,
  });
  const current=run(plan.courts),explicitLegacy=run(plan.courts.map(c=>({...c,rimBlend:14})));
  const legacy=run(plan.courts.map(({rimBlend,...c})=>c)),p=sitePoint(site,[24,0,16.85]);
  close(current(p.x,p.z),4);close(legacy(p.x,p.z),3.36);assert.equal(legacy(p.x,p.z),explicitLegacy(p.x,p.z));
  evidence.rimBlendNegativeControl={local:[24,16.85],flatGround:4,legacyDefault:legacy(p.x,p.z),explicit14:explicitLegacy(p.x,p.z),rimBlend0:current(p.x,p.z)};
  // The live replacement branch must respect the identical optional property.
  close(run([])(p.x,p.z,{removedHillIds:new Set(),courts:plan.courts,pads:[]}),4);
  const atPad=sitePoint(site,[18.8,0,16.85]),inBlend=sitePoint(site,[19.8,0,16.85]),outside=sitePoint(site,[20.8,0,16.85]);
  close(current(atPad.x,atPad.z),3.97);close(current(inBlend.x,inBlend.z),3.985);close(current(outside.x,outside.z),4);
});

test('plan follows the actual rectangular paving, 64-sided hole, inner water profiles and two levels',t=>{
  const f=fixture(t),paving=f.calls.find(c=>c.parent==='fangwaiguan-court-paving'),plan=f.plan;
  assert.equal(plan.assetId,'fangwaiguan');assert.equal(plan.alignment.metresCalibrated,false);assert.equal(plan.courts.length,2);assert.equal(plan.pads.length,1);
  assert.deepEqual(plan.pads[0].polygon,Array.from(paving.points,p=>point(site,p)));close(plan.pads[0].heightY,site.position[1]-.03);
  assert.equal(plan.pads[0].blend,2);assert.equal(paving.bottom,-1.25);assert.equal(paving.top,0);
  for(let i=0;i<2;i++){
    const c=plan.courts[i],profile=f.calls.find(call=>call.parent===c.sourceGroup&&call.mesh===f.sheets[i]);
    assert.deepEqual(c.polygon,Array.from(paving.holes[i],p=>point(site,p)));
    assert.deepEqual(c.water.surfacePolygon,Array.from(profile.points,p=>point(site,p)));assert.deepEqual(c.water.polygon,c.water.surfacePolygon);
    close(c.floorY,site.position[1]-1.35);close(c.rimY,site.position[1]-1.28);assert.equal(c.rimBlend,0);
    close(c.water.surfaceY,site.position[1]+profile.top);close(profile.top-profile.bottom,.005);
  }
  assert.equal(plan.courts[1].polygon.length,64);assert.equal(plan.courts[1].water.polygon.length,64);
});

test('finite positive placement transforms the pure profiles; invalid or overflowing coordinates fail',()=>{
  const placed={...site,position:[10,8,20],rotationY:Math.PI/2,scale:2},plan=createFangwaiguanCourtGround(placed);
  assert.deepEqual(plan.pads[0].polygon,rect(-18.8,-6.2,18.8,37.6).map(p=>point(placed,p)));
  close(plan.courts[0].floorY,5.3);close(plan.courts[0].rimY,5.44);close(plan.courts[0].water.surfaceY,7.56);close(plan.courts[1].water.surfaceY,7.74);assert.equal(plan.pads[0].blend,4);
  for(const scale of [Infinity,-Infinity,NaN,0,-1,Number.MAX_VALUE])assert.throws(()=>createFangwaiguanCourtGround({...site,scale}));
  for(const position of [[0,NaN,0],[0,0],[Infinity,0,0]])assert.throws(()=>createFangwaiguanCourtGround({...site,position}));
  assert.throws(()=>createFangwaiguanCourtGround({...site,rotationY:Infinity}));
});

test('actual terrain and source rays retain both openings, lower stone beds, dry rim and the bridge underpass',t=>{
  const f=fixture(t),paving=f.owner.group.getObjectByName('fangwaiguan-court-paving'),land=f.terrain.group.getObjectByName('yuanming-continuous-land');
  for(const [x,z,bedY] of [[5,16.85,-.93],[.8,25,-.72]]){
    assert.equal(down(paving,site,x,z),null);assert.equal(down(land,site,x,z),null);
    const p=sitePoint(site,[x,0,z]),soil=f.terrain.surfaceAt(p.x,p.z);
    close(soil.height,site.position[1]-1.35);assert.equal(soil.walkable,false);
    const sourceHit=down(f.owner.group,site,x,z,-.25);close(sourceHit.point.y,site.position[1]+bedY);
    assert(sourceHit.point.y>soil.height+.4);assert(soil.waterY>sourceHit.point.y);
  }
  for(const [x,z] of [[-18.4,10],[18.4,10],[0,35]]){
    close(down(paving,site,x,z).point.y,site.position[1]);
    const actual=down(land,site,x,z).point.y,p=sitePoint(site,[x,0,z]);
    close(actual,f.terrain.heightAt(p.x,p.z));assert(actual<site.position[1]&&actual>site.position[1]-1.25);
  }
  const bridge=f.owner.group.getObjectByName('fangwaiguan-central-stone-bridge');close(down(bridge,site,0,16.85).point.y,site.position[1]+.42);
  const a=sitePoint(site,[-5,0,16.85]),direction=new THREE.Vector3(Math.cos(site.rotationY),0,-Math.sin(site.rotationY));
  const ray=new THREE.Raycaster(new THREE.Vector3(a.x,a.y,a.z),direction,0,10*site.scale);
  assert.equal(ray.intersectObject(bridge,true).length,0);assert.equal(ray.intersectObject(f.terrain.group,true).length,0);
});

test('buried soil walls share no vertical area with paving or source stone facades and do not occlude inner banks',t=>{
  const f=fixture(t),wall=f.terrain.group.getObjectByName('yuanming-asset-court-excavation-walls'),wallBounds=new THREE.Box3().setFromObject(wall);
  const sourceWalls=f.calls.filter(c=>c.parent===channel&&c.kind==='box'&&c.position[1]===-.36||c.parent===basin&&c.kind==='polygon'&&c.holes.length);
  const paving=f.calls.find(c=>c.parent==='fangwaiguan-court-paving').mesh,pavingBox=new THREE.Box3().setFromObject(paving);
  assert(wallBounds.max.y<pavingBox.min.y-.029);
  for(const c of sourceWalls){const box=new THREE.Box3().setFromObject(c.mesh);assert.equal(Math.max(0,Math.min(wallBounds.max.y,box.max.y)-Math.max(wallBounds.min.y,box.min.y)),0);}
  for(const [origin,dir] of [[[5,-.5,16.85],[0,0,-1]],[[2.8,-.4,25],[-1,0,0]]]){
    const p=sitePoint(site,origin),d=new THREE.Vector3(...dir).applyAxisAngle(new THREE.Vector3(0,1,0),site.rotationY);
    const ray=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,p.z),d,0,3);
    assert(ray.intersectObject(f.owner.group,true).length>0);assert.equal(ray.intersectObject(wall,true).length,0);
  }
});

test('the corrected actual circular stone wall is FrontSide-visible from both inner and outer free space',t=>{
  const f=fixture(t),call=f.calls.find(c=>c.parent===basin&&c.kind==='polygon'&&c.holes.length),mesh=call.mesh,inner=[],outer=[];
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,dx=Math.cos(angle),dz=Math.sin(angle);
    for(const [kind,r,y,direction,results] of [['inner',.8,-.4,1,inner],['outer',2.8,.12,-1,outer]]){
      const p=sitePoint(site,[r*dx,y,25+r*dz]),d=new THREE.Vector3(direction*dx,0,direction*dz).applyAxisAngle(new THREE.Vector3(0,1,0),site.rotationY);
      const hits=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,p.z),d,0,3).intersectObject(mesh);
      assert(hits.length,`${kind} stone face at ${angle}`);const hit=hits[0],normal=hit.face.normal.clone().transformDirection(mesh.matrixWorld);
      assert(normal.dot(d)<-.99);results.push({angle,distance:hit.distance,normal:normal.toArray()});
    }
  }
  // Reproduce the old caller's inner-loop winding on the same 512-triangle
  // primitive. No shared extrusion code, source position or radius is changed.
  const wrongGeometry=extrudedPolygon(call.points,call.bottom,call.top,[Array.from(call.holes[0]).reverse()]);
  const wrong=new THREE.Mesh(wrongGeometry,mesh.material);wrong.position.fromArray(site.position);wrong.rotation.y=site.rotationY;wrong.scale.setScalar(site.scale);wrong.updateMatrixWorld(true);
  t.after(()=>wrongGeometry.dispose());
  const p=sitePoint(site,[.8,-.4,25]),direction=new THREE.Vector3(Math.cos(site.rotationY),0,-Math.sin(site.rotationY));
  const priorHits=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,p.z),direction,0,3).intersectObject(wrong);
  assert.equal(priorHits.length,0);assert.equal(wrongGeometry.attributes.position.count,mesh.geometry.attributes.position.count);
  evidence.poolWallNormals={triangles:mesh.geometry.attributes.position.count/3,side:'FrontSide',oldWindingInnerHits:priorHits.length,inner,outer};
});

test('actual architecture support plus terrain water rejects pool beds and keeps the real bridge and bank dry',t=>{
  const f=fixture(t),support=createArchitectureSurface(f.owner.group);t.after(()=>support.dispose());
  for(const [x,z,maxY,expectedHeight,wet] of [[5,16.85,8,3.07,true],[.8,25,8,3.28,true],[5,16.85,3.7,3.07,true],[0,16.85,8,4.42,false],[18.4,10,8,4,false]]){
    const p=sitePoint(site,[x,0,z]),ground=f.terrain.surfaceAt(p.x,p.z,{maxY}),building=support.surfaceAt(p.x,p.z,{maxY});
    const hit=museumSupport(ground,building);close(hit.height,expectedHeight);assert.equal(hit.walkable,!wet);
  }
});

test('matching actual composed water hides exactly two verified slabs without needing a material role',t=>{
  const f=fixture(t);f.sheets[0].userData.navigation='authored-wet';f.sheets[1].visible=false;const before=f.flags();
  const beforeGeometry=geometryDigest(f.owned),preserved=f.calls.filter(c=>!f.sheets.includes(c.mesh)).map(c=>c.mesh);
  assert(f.sheets.every(mesh=>!Object.hasOwn(mesh.material.userData,'role')));
  const restore=bindFangwaiguanCourtWater(f.plan,f);
  assert(f.sheets.every(mesh=>!mesh.visible&&mesh.userData.navigation===false));assert(preserved.every(mesh=>mesh.visible));assert.equal(f.resourceDisposals,0);
  restore();restore();assert.deepEqual(f.flags(),before);assert.equal(f.owner.disposed,false);assert.equal(f.water.snapshot().disposed,false);
  assert.equal(geometryDigest(f.owned),beforeGeometry);assert.equal(f.resourceDisposals,0);
});

test('rotated scaled source and actual transformed terrain/composed sheets agree',t=>{
  const f=fixture(t,{placement:{...site,position:[385,7,-550],rotationY:.43,scale:1.23}}),before=f.flags();
  const restore=bindFangwaiguanCourtWater(f.plan,f);assert(f.sheets.every(s=>!s.visible));restore();assert.deepEqual(f.flags(),before);
});

test('missing or mismatched court/wet mask, terrain surface or real support fails before either source changes',t=>{
  const f=fixture(t),before=f.flags(),original=f.terrain.courtFootprints;
  const badTerrains=[
    {...f.terrain,courtFootprints:original.slice(0,1)},
    {...f.terrain,courtFootprints:[original[0],{...original[1],rimBlend:14}]},
    {...f.terrain,courtFootprints:[original[0],{...original[1],water:{...original[1].water,polygon:original[1].polygon}}]},
    {...f.terrain,waterSurfaces:f.terrain.waterSurfaces.slice(0,1)},
    {...f.terrain,waterSurfaces:f.terrain.waterSurfaces.map((s,i)=>i?{...s,worldY:3.8}:s)},
    {...f.terrain,surfaceAt:()=>({height:4,walkable:true})},
  ];
  for(const terrain of badTerrains){assert.throws(()=>bindFangwaiguanCourtWater(f.plan,{...f,terrain}));assert.deepEqual(f.flags(),before);}
});

test('matching snapshot heights alone cannot replace missing, moved, hidden or truncated drawn water triangles',t=>{
  const f=fixture(t,{waterCount:1}),before=f.flags();assert.throws(()=>bindFangwaiguanCourtWater(f.plan,f));assert.deepEqual(f.flags(),before);
  const complete=fixture(t),sheet=complete.water.sheets[1],beforeComplete=complete.flags();
  for(const mutate of [
    ()=>{sheet.position.x+=.5;return()=>{sheet.position.x-=.5;};},
    ()=>{sheet.visible=false;return()=>{sheet.visible=true;};},
    ()=>{sheet.geometry.setDrawRange(0,3);return()=>{sheet.geometry.setDrawRange(0,Infinity);};},
  ]){
    const reset=mutate();try{assert.throws(()=>bindFangwaiguanCourtWater(complete.plan,complete));assert.deepEqual(complete.flags(),beforeComplete);}finally{reset();}
  }
});

test('named source groups must be unique and their actual water slab complete, at the right position and extent',t=>{
  const f=fixture(t),sheet=f.sheets[1],parent=sheet.parent,before=f.flags();
  const mutations=[
    ()=>{parent.remove(sheet);return()=>parent.add(sheet);},
    ()=>{const clone=parent.clone(true);f.owner.group.add(clone);return()=>clone.removeFromParent();},
    ()=>{const clone=sheet.clone();parent.add(clone);return()=>clone.removeFromParent();},
    ()=>{sheet.geometry.setDrawRange(0,3);return()=>sheet.geometry.setDrawRange(0,Infinity);},
    ()=>{sheet.position.x=.1;return()=>{sheet.position.x=0;};},
    ()=>{sheet.position.y=.03;return()=>{sheet.position.y=0;};},
    ()=>{sheet.scale.x=.5;return()=>{sheet.scale.x=1;};},
  ];
  for(const mutate of mutations){const reset=mutate();try{assert.throws(()=>bindFangwaiguanCourtWater(f.plan,f));assert.deepEqual(f.flags(),before);}finally{reset();}}
});

test('unrelated water and nested fountain water remain untouched even with the same category',t=>{
  const f=fixture(t),geometry=new THREE.BoxGeometry(.1,.8,.1),material=new THREE.MeshStandardMaterial();material.userData.category='water';
  const jet=new THREE.Mesh(geometry,material),bowl=jet.clone();jet.position.set(0,.6,25);bowl.position.set(3,2,25);
  f.owner.group.getObjectByName('wuzhuting-provisional-small-fountain').add(jet);f.owner.group.add(bowl);
  t.after(()=>{geometry.dispose();material.dispose();});
  const restore=bindFangwaiguanCourtWater(f.plan,f);assert(jet.visible&&bowl.visible);restore();assert(jet.visible&&bowl.visible);
});

test('owner placement and altered plan cannot silently replace the retained model contract',t=>{
  const f=fixture(t),before=f.flags();f.owner.group.position.x+=.25;
  assert.throws(()=>bindFangwaiguanCourtWater(f.plan,f));assert.deepEqual(f.flags(),before);f.owner.group.position.x-=.25;
  for(const plan of [{...f.plan,pads:[]},{...f.plan,courts:f.plan.courts.map((c,i)=>i?{...c,rimY:4}:c)}]){
    assert.throws(()=>bindFangwaiguanCourtWater(plan,f));assert.deepEqual(f.flags(),before);
  }
});

test('overlapping bindings restore only after the final release; another water/terrain owner is refused',t=>{
  const f=fixture(t),before=f.flags(),first=bindFangwaiguanCourtWater(f.plan,f),second=bindFangwaiguanCourtWater(f.plan,f);
  assert.throws(()=>bindFangwaiguanCourtWater(f.plan,{...f,terrain:{...f.terrain}}));first();first();assert(f.sheets.every(s=>!s.visible));second();second();assert.deepEqual(f.flags(),before);
});

test('a second-sheet write failure restores all earlier flags and keeps every source resource alive',t=>{
  const f=fixture(t),before=f.flags();Object.freeze(f.sheets[1].userData);
  assert.throws(()=>bindFangwaiguanCourtWater(f.plan,f));assert.deepEqual(f.flags(),before);assert.equal(f.resourceDisposals,0);
});

test('one restoration failure remains visible while all other flags are restored; repeated release is inert',t=>{
  const f=fixture(t),restore=bindFangwaiguanCourtWater(f.plan,f);let calls=0;
  Object.defineProperty(f.sheets[0],'visible',{configurable:true,get:()=>false,set:()=>{calls++;throw new Error('fixture visibility restoration');}});
  assert.throws(()=>restore(),error=>error instanceof AggregateError&&error.errors[0].message==='fixture visibility restoration');
  assert.equal(calls,1);assert.equal(f.sheets[1].visible,true);assert(f.sheets.every(sheet=>!Object.hasOwn(sheet.userData,'navigation')));
  restore();assert.equal(calls,1);assert.equal(f.resourceDisposals,0);
});

test('disposed owners or water and invalid terrain cannot hide source sheets',t=>{
  const f=fixture(t),before=f.flags();
  for(const options of [{...f,owner:{...f.owner,disposed:true}},{...f,terrain:{...f.terrain,disposed:true}},{...f,water:{...f.water,snapshot:()=>({disposed:true,sheets:[]})}}]){
    assert.throws(()=>bindFangwaiguanCourtWater(f.plan,options));assert.deepEqual(f.flags(),before);
  }
});
