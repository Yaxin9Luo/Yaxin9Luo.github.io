import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gardenLayout,pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {createMuseumLandscape} from '../src/yuanmingyuan/museum-landscape.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {museumSupport} from '../src/yuanmingyuan/museum-support.js';
import {sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {HILL,spiralOffset} from '../src/yuanmingyuan/xianfa-landscape-layout.js';
import {moundGeometry,spiralDeckGeometry,gateWallGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {stripPolygon} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const close=(a,b,eps=1e-5)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
const hill={id:'xianfashan',assetId:'xianfashan',position:[925,4,-640],rotationY:0,scale:1};
const fanghe={id:'xianfahua',assetId:'fanghe-xianfahua',position:[1140,4,-640],rotationY:0,scale:1};
const sites=[hill,fanghe],coarse=gardenLayout.landforms.find(item=>item.id==='xianfa-hill');
const fixture={id:'small-xianfashan-replacement',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(845,-720,1020,-560)}},gardens:[],waterBodies:[],ornamentalWaters:[],channels:[],islands:[],landforms:[coarse],bridges:[]};
const adapt=ready=>createMuseumLandscape({layout:fixture,sites,readyAssetIds:ready?['xianfashan']:[]});
const construct=landscape=>createGardenTerrain({layout:landscape.layout,assetPads:landscape.pads,assetCourts:landscape.courts,assetPaths:landscape.paths});

test('an unready, failed or absent hill owner keeps the coarse hill and no active hole; readiness is explicit',()=>{
  const before=JSON.stringify(gardenLayout),pending=createMuseumLandscape({sites}),ready=createMuseumLandscape({sites,readyAssetIds:new Set(['xianfashan'])});
  assert.equal(pending.layout.landforms,gardenLayout.landforms);assert.equal(pending.courts.length,0);assert.equal(pending.paths.length,0);assert.equal(pending.replacements[0].ready,false);
  assert(pending.replacements[0].prepared.courts.length===1,'precise replacement may be prepared before the full owner is ready');
  assert(!ready.layout.landforms.some(item=>item.id==='xianfa-hill'));assert.equal(ready.layout.landforms.length,gardenLayout.landforms.length-1);
  for(const item of ready.layout.landforms)assert.equal(item,gardenLayout.landforms.find(old=>old.id===item.id));
  const retry=createMuseumLandscape({sites,readyAssetIds:[]});assert.equal(retry.layout.landforms,gardenLayout.landforms);assert.equal(retry.courts.length,0);
  assert.equal(createMuseumLandscape({sites:[fanghe],readyAssetIds:['xianfashan']}).layout.landforms,gardenLayout.landforms);
  assert.equal(JSON.stringify(gardenLayout),before);
});

test('square mound excavation, source approach bottoms and both author paths use the admitted frame',()=>{
  const {courts,pads,paths,replacements}=adapt(true),court=courts[0];
  assert.deepEqual(court.polygon,rect(899.2,-665.8,950.8,-614.2));close(court.floorY,3.67);close(court.rimY,3.82);
  const pad=pads.find(item=>item.id==='xianfashan-ground-approaches');assert.deepEqual(pad.polygon,rect(881,-668.27,961,-611.73));close(pad.heightY,3.82);
  const west=paths.find(path=>path.id.includes('west')),east=paths.find(path=>path.id.includes('fanghe'));
  assert.deepEqual(west.from,[877,4,-640]);assert.deepEqual(west.to,[881,4.04,-640]);close(west.width,3.48);
  assert.deepEqual(east.from,[961,4.04,-640]);assert.deepEqual(east.to,[975.3,4,-640]);close(east.to[0]-east.from[0],14.3);close(east.width,2.44);
  assert(east.polygon.every(([x])=>x<981),'the path stops on the western bank, before Fanghe water');
  for(const path of paths){assert.equal(path.evidence,'exhibition-design');assert.equal(path.coordinatesSurveyed,false);assert.equal(path.kind,'exhibition-ground-path');}
  assert.equal(replacements[0].sourceSupport.height,8);assert.equal(replacements[0].sourceSupport.clearPathWidth,1.5);
  for(const part of [...replacements[0].prepared.courts,...replacements[0].prepared.pads,...replacements[0].prepared.paths])assert(part.polygon.every(point=>pointInPolygon(point,replacements[0].polygon)));
});

test('transforms apply to the mound and both endpoints; missing Fanghe never invents a global bank position',()=>{
  const other={...hill,position:[-18,7,32],rotationY:.6,scale:1.4},peer={...fanghe,position:[240,8,22],rotationY:.12,scale:.9};
  const result=createMuseumLandscape({layout:fixture,sites:[other,peer],readyAssetIds:['xianfashan']}),court=result.courts[0],p=sitePoint(other,[-25.8,0,-25.8]);
  close(court.polygon[0][0],p.x);close(court.polygon[0][1],p.z);close(court.floorY,7-.33*1.4);close(court.rimY,7-.18*1.4);
  const east=result.paths.find(path=>path.id.includes('fanghe')),from=sitePoint(other,[36,.04,0]),to=sitePoint(peer,[-164.7,0,0]);
  for(const [actual,expected] of [[east.from,[from.x,from.y,from.z]],[east.to,[to.x,to.y,to.z]]])actual.forEach((value,i)=>close(value,expected[i]));
  close(east.width,2.44*1.4);
  assert.equal(createMuseumLandscape({layout:fixture,sites:[hill],readyAssetIds:['xianfashan']}).paths.length,1);
});

let ready,pending,source,material;
test.before(()=>{
  ready=construct(adapt(true));pending=construct(adapt(false));
  material=new THREE.MeshBasicMaterial();source=new THREE.Group();source.position.set(...hill.position);
  const add=(geometry,name)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;source.add(mesh);return mesh;};
  // These are original component functions at small fixture resolutions, not
  // the complete hill/gate/pavilion factory and not a production archive.
  add(moundGeometry(36),'mound');add(spiralDeckGeometry(120),'ramp');
  add(extrudedPolygon(stripPolygon([[-44,0],[-24,0]],1.74),-.17,.04),'west-paving');
  const bypass=Array.from({length:97},(_,i)=>{const a=Math.PI-i/96*Math.PI;return[26.8*Math.cos(a),26.8*Math.sin(a)];});
  add(extrudedPolygon(stripPolygon([[-29,0],...bypass,[36,0]],1.22),-.17,.04),'bypass');
  for(const east of [false,true]){const mesh=add(gateWallGeometry(east),east?'east-gate':'west-gate');mesh.position.x=east?HILL.eastGateX:HILL.westGateX;mesh.rotation.y=east?Math.PI/2:-Math.PI/2;}
  add(extrudedPolygon(rect(50.3,-2,56,2),-.24,0),'peer-bank');
  source.updateMatrixWorld(true);ready.group.updateMatrixWorld(true);pending.group.updateMatrixWorld(true);
});
test.after(()=>{ready?.dispose();pending?.dispose();source?.traverse(mesh=>mesh.geometry?.dispose());material?.dispose();});

const top=(x,z,object,maxY=30)=>new THREE.Raycaster(new THREE.Vector3(x,maxY,z),new THREE.Vector3(0,-1,0)).intersectObject(object,true)[0];
test('pending state still has an 8 m coarse hill; ready terrain has a real hole below the complete mound bottom',()=>{
  assert(pending.heightAt(925,-640)>11.5);const land=ready.group.getObjectByName('yuanming-continuous-land');
  for(const [x,z] of [[925,-640],[901,-640],[947,-623],[900,-665]]){assert.equal(top(x,z,land),undefined);close(ready.heightAt(x,z),3.67);assert.equal(ready.surfaceAt(x,z).walkable,false);}
  const geometry=source.getObjectByName('mound').geometry;geometry.computeBoundingBox();close(geometry.boundingBox.min.y+4,3.70);assert(geometry.boundingBox.min.y+4>ready.heightAt(925,-640)+.029);
});

test('actual component ramp and all original ground approaches remain above landscape with open gate passages from either side',()=>{
  for(const t of [0,.035,.15,.4,.72,1]){
    const p=spiralOffset(t,0),ground=ready.surfaceAt(p[0]+925,p[2]-640),hit=top(p[0]+925,p[2]-640,source.getObjectByName('ramp'));
    assert(hit);assert(hit.point.y>ground.height+.30);assert.equal(museumSupport(ground,{height:hit.point.y,normal:[0,1,0],walkable:true}).walkable,true);
  }
  for(const [x,z] of [[882,0],[886,0],[896,0],[956,0],[960,0],[925,26.8]]){
    const ground=ready.surfaceAt(x,z-640),hit=top(x,z-640,source,4.5);assert(hit);close(hit.point.y,4.04,.002);
    // The admitted edge contact may embed the paving's underside, while its
    // actual walkable top retains at least the intended 4 cm raised edge.
    assert(ground.height<=4.00001);assert(hit.point.y-ground.height>=.0399);
  }
  for(const [name,x] of [['west-gate',887],['east-gate',956]])for(const direction of [-1,1]){
    const ray=new THREE.Raycaster(new THREE.Vector3(x-direction*2,5.65,-640),new THREE.Vector3(direction,0,0),0,4);assert.equal(ray.intersectObject(source.getObjectByName(name)).length,0);
  }
});

test('the 14.3 m ground link has exact first/last support, continuous low grade and two physical slab faces',()=>{
  const path=ready.paths.find(path=>path.id.includes('fanghe')),mesh=ready.group.getObjectByName(`${path.id}-stone-path`);assert(path);close(path.length,14.3);
  close(mesh.geometry.boundingBox.max.x,975.3,1.3e-5);close(ready.heightAt(975.3,-640),4);
  // Query the stored endpoint for a strict ray; the source-space decimal is
  // 12.2 micrometres beyond that Float32 edge, already covered by the sampler's
  // existing barycentric boundary tolerance. No terrain boundary is enlarged.
  for(let i=0;i<=40;i++)for(const dz of [-.9,0,.9]){
    const x=i===40?mesh.geometry.boundingBox.max.x:961+14.3*i/40,t=(x-961)/14.3,z=-640+dz,hit=ready.surfaceAt(x,z),ray=top(x,z,mesh);assert(ray);close(hit.height,4.04-.04*t);close(hit.height,ray.point.y);assert.equal(hit.walkable,true);assert.equal(hit.kind,'exhibition-ground-path');
  }
  assert.equal(ready.bridges.length,0);assert(ready.colliders.every(collider=>!collider.id.startsWith('xianfashan')),'no invented bridge rails');
  const below=new THREE.Raycaster(new THREE.Vector3(968,2,-640),new THREE.Vector3(0,1,0)).intersectObject(mesh)[0];assert(below);assert(below.face.normal.y<0);close(below.point.y,4.04-.04*(968-961)/14.3-.32);
  for(const x of [960.999,961.001,975.299,975.301]){const ground=ready.surfaceAt(x,-640),building=top(x,-640,source),support=museumSupport(ground,building?{height:building.point.y,normal:[0,1,0],walkable:true}:null);assert.equal(support.walkable,true);close(support.height,x<970?4.04:4,.001);}
});

test('local guide index and source paths agree without treating their downward slab face as a new floor',()=>{
  const local=ready.createGuideSupport({minX:875,maxX:979,minZ:-645,maxZ:-635});
  try{for(const x of [877.1,879,880.9,890,901,941,962,968,975.2])for(const maxY of [3.6,3.8,4.1,Infinity]){
    const a=ready.surfaceAt(x,-640,{maxY}),b=local.surfaceAt(x,-640,{maxY});assert.equal(b?.height,a?.height);assert.deepEqual(b?.normal,a?.normal);assert.equal(b?.walkable,a?.walkable);assert.equal(b?.waterY,a?.waterY);
  }}finally{local.dispose();}
});

test('a purported ground connector cannot cross water, a court hole or the sea',()=>{
  const path={id:'dry-link',from:[0,4,0],to:[10,4,0],width:2,thickness:.32},layout={...fixture,exhibition:{seaY:0,groundY:4,coast:{polygon:rect(-20,-20,20,20)}},landforms:[]};
  const lake={id:'crossed-water',polygon:rect(4,-5,6,5),surfaceY:2,bedY:0};
  for(const args of [{layout:{...layout,waterBodies:[lake]}},{layout,assetCourts:[{id:'hole',polygon:lake.polygon,floorY:0,rimY:4}]},{layout,assetPaths:[{...path,to:[30,4,0]}]}])assert.throws(()=>createGardenTerrain({assetPaths:[path],...args}),/cannot substitute for a bridge/);
  assert.throws(()=>createGardenTerrain({layout,assetPaths:[{...path,to:path.from}]}),/distinct XZ/);
  assert.throws(()=>createGardenTerrain({layout,assetPaths:[{...path,width:0}]}),/positive width/);
});

test('replacement context bounds include all height blends and ready state leaves external terrain unchanged',()=>{
  const replacement=adapt(true).replacements[0],b=replacement.bounds;
  for(const [x,z] of [[b.minX,-640],[b.maxX,-640],[925,b.minZ],[925,b.maxZ],[b.minX,b.minZ],[b.maxX,b.maxZ]])close(ready.heightAt(x,z),pending.heightAt(x,z),.03);
  assert(b.maxX<981,'the bounded hill patch stops before the water basin');
});
