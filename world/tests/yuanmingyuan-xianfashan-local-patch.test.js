import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {gardenLayout} from '../src/yuanmingyuan/garden-layout.js';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createMuseumLandscape} from '../src/yuanmingyuan/museum-landscape.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {moundGeometry,spiralDeckGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {spiralOffset} from '../src/yuanmingyuan/xianfa-landscape-layout.js';
import {stripPolygon} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const close=(a,b,eps=1e-5)=>assert(Math.abs(a-b)<eps,`${a} differs from ${b}`);
const hill={id:'xianfashan',assetId:'xianfashan',position:[925,4,-640],rotationY:0,scale:1};
const fanghe={id:'xianfahua',assetId:'fanghe-xianfahua',position:[1140,4,-640],rotationY:0,scale:1};
const layout={id:'small-live-hill-fixture',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(845,-720,1020,-560)}},gardens:[],waterBodies:[],ornamentalWaters:[],channels:[],islands:[],landforms:[gardenLayout.landforms.find(h=>h.id==='xianfa-hill')],bridges:[]};
const plan=createMuseumLandscape({layout,sites:[hill,fanghe]}),id=plan.replacements[0].id;
const create=()=>createGardenTerrain({layout:plan.layout,assetPads:plan.pads,assetCourts:plan.courts,assetPaths:plan.paths,replacements:plan.replacements});
const digest=geometry=>{const hash=createHash('sha256');for(const attribute of [geometry.index,...Object.values(geometry.attributes)])if(attribute)hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));return hash.digest('hex');};
const visibleHit=(group,x,z,maxY=30,direction=-1)=>{const objects=[];group.updateMatrixWorld(true);group.traverseVisible(node=>{if(node.isMesh)objects.push(node);});return new THREE.Raycaster(new THREE.Vector3(x,maxY,z),new THREE.Vector3(0,direction,0)).intersectObjects(objects,false)[0];};

let terrain,guide,owner,support,material,baseState,staticGeometry,geometryHashes,sourceDisposed=0;
const metrics={scope:'small local terrain and original low-resolution components only; no complete model factory, production archive or GPU'};
test.before(()=>{
  const started=performance.now();terrain=create();metrics.localTerrainBuildMs=performance.now()-started;guide=terrain.createGuideSupport({minX:870,maxX:990,minZ:-690,maxZ:-590});baseState=terrain.surfaceAt(925,-640);metrics.coarse=terrain.replacementStates[0];
  material=new THREE.MeshBasicMaterial();const group=new THREE.Group();group.position.set(...hill.position);
  const add=(geometry,name)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;group.add(mesh);};
  // These are low-memory original component fixtures, never the full factory.
  add(moundGeometry(24),'mound');add(spiralDeckGeometry(96),'ramp');
  add(extrudedPolygon(stripPolygon([[-44,0],[-24,0]],1.74),-.17,.04),'west-paving');
  const bypass=Array.from({length:49},(_,i)=>{const a=Math.PI-i/48*Math.PI;return[26.8*Math.cos(a),26.8*Math.sin(a)];});
  add(extrudedPolygon(stripPolygon([[-29,0],...bypass,[36,0]],1.22),-.17,.04),'east-bypass');
  group.visible=false;group.updateMatrixWorld(true);support=createArchitectureSurface(group);
  owner={group,dispose(){sourceDisposed++;group.traverse(node=>node.geometry?.dispose());material.dispose();},get disposed(){return sourceDisposed>0;}};
  staticGeometry=[];for(const node of terrain.group.children)if(node.isMesh)staticGeometry.push(node.geometry);
  staticGeometry.push(...terrain.waterSurfaces.map(w=>w.geometry));geometryHashes=staticGeometry.map(digest);
});
test.after(()=>{guide?.dispose();terrain?.dispose();support?.dispose();owner?.dispose();metrics.allOwnersDisposed=terrain?.disposed&&support?.disposed&&sourceDisposed===1;metrics.peakRSSBytes=process.resourceUsage().maxRSS*1024;if(process.env.TERRAIN_PATCH_REPORT)writeFileSync(process.env.TERRAIN_PATCH_REPORT,JSON.stringify(metrics,null,2)+'\n');});

test('optional patch starts with an actual coarse hill while the scene has not loaded any full source',()=>{
  assert(baseState.height>11.5);assert.equal(terrain.replacementStates[0].state,'coarse');assert.equal(owner.group.visible,false);
  const coarse=terrain.group.getObjectByName(`${id}-coarse-land`);assert.equal(coarse.visible,true);close(visibleHit(terrain.group,925,-640).point.y,baseState.height);
  assert.deepEqual(guide.surfaceAt(925,-640),terrain.surfaceAt(925,-640));
  for(const binding of [{},{owner},{owner,support:{surfaceAt:()=>null}},{owner:{...owner,ready:false},support}])assert.throws(()=>terrain.activateReplacement(id,binding),/requires|does not cover/);
  assert.equal(terrain.replacementStates[0].state,'coarse');assert.equal(terrain.heightAt(925,-640),baseState.height);assert.equal(coarse.visible,true);
  assert.equal(terrain.paths.length,0);assert.equal(terrain.courtFootprints.length,0);
});

test('fine preparation leaves coarse geometry and existing local support live; activation commits all three owners',()=>{
  const started=performance.now();terrain.prepareReplacement(id);metrics.prepareMs=performance.now()-started;assert.equal(terrain.replacementStates[0].state,'prepared');assert.equal(terrain.heightAt(925,-640),baseState.height);assert.equal(terrain.group.getObjectByName(`${id}-fine`).visible,false);
  assert.equal(guide.surfaceAt(925,-640).height,baseState.height);assert.equal(owner.group.visible,false);
  const activation=performance.now(),state=terrain.activateReplacement(id,{owner,support});metrics.activateMs=performance.now()-activation;metrics.active=state;assert.equal(state.state,'active');assert.equal(terrain.group.getObjectByName(`${id}-coarse-land`).visible,false);assert.equal(terrain.group.getObjectByName(`${id}-fine`).visible,true);assert.equal(owner.group.visible,true);
  assert.equal(terrain.paths.length,2);assert.equal(terrain.courtFootprints.length,1);
  for(const t of [.003,.047,.19,.47,.81,.996]){
    const p=spiralOffset(t,0),x=p[0]+925,z=p[2]-640,maxY=p[1]+4.3,expected=support.surfaceAt(x,z,{maxY}),hit=terrain.surfaceAt(x,z,{maxY});
    assert(expected);assert.equal(hit.height,expected.height);assert.deepEqual(hit.normal,expected.normal);assert.equal(hit.walkable,expected.walkable);assert.equal(hit.supportSource,'asset-triangle');assert.deepEqual(guide.surfaceAt(x,z,{maxY}),hit);
  }
});

test('fine ground has the actual mound footprint hole, a nonwalkable low floor and no land through the ramp',()=>{
  const fine=terrain.group.getObjectByName(`${id}-fine-land`);fine.updateWorldMatrix(true,false);
  for(const [x,z] of [[925,-640],[900,-640],[946,-625],[905,-660]]){
    assert.equal(new THREE.Raycaster(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0)).intersectObject(fine).length,0);
    const floor=terrain.surfaceAt(x,z,{maxY:3.69});assert(floor);close(floor.height,3.67);assert.equal(floor.walkable,false);assert.equal(floor.kind,'court-excavation');assert.equal(terrain.surfaceAt(x,z,{maxY:3.6}),null);
    assert.deepEqual(guide.surfaceAt(x,z,{maxY:3.69}),floor);
  }
  for(const [x,z] of [[882,-640],[894,-640],[959,-640],[925,-613.2]]){const actual=support.surfaceAt(x,z,{maxY:4.3});assert(actual);const hit=terrain.surfaceAt(x,z,{maxY:4.3});assert.equal(hit.height,actual.height);close(hit.height,4.04);}
});

test('visible mound perimeter meets the fine land without an exposed square slab side',()=>{
  terrain.activateReplacement(id,{owner,support});
  const fine=terrain.group.getObjectByName(`${id}-fine-land`),p=fine.geometry.attributes.position;
  let checked=0;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),localX=x-925,localZ=z+640;
    if(Math.abs(Math.max(Math.abs(localX),Math.abs(localZ))-25.8)>5e-5)continue;
    // The source's only low edge vertices lie under its west stone approach.
    if(localX<0&&Math.abs(localZ)<=1.74)continue;
    close(p.getY(i),4,1e-6);checked++;
    const inset=.0001,source=visibleHit(owner.group.getObjectByName('mound'),925+localX*(1-inset/25.8),-640+localZ*(1-inset/25.8),4.3);
    assert(source);close(p.getY(i),source.point.y,2e-4);
  }
  assert(checked>32);metrics.moundContact={checkedBoundaryVertices:checked,maximumExposedStepMetres:0,collarWidthMetres:4};
  // The raised ground is outside the source footprint, never a cap over it.
  for(const [x,z] of [[925,-640],[900,-640],[947,-621]])assert.equal(new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0)).intersectObject(fine).length,0);
});

test('mound contact remains below the real entry paving and returns to the original substrate outside its band',()=>{
  const fine=terrain.group.getObjectByName(`${id}-fine-land`);
  for(let n=0;n<=36;n++)for(const localZ of [-1.5,0,1.5]){
    const x=895.5+n*.125,z=-640+localZ,stone=support.surfaceAt(x,z,{maxY:4.08}),hit=terrain.surfaceAt(x,z,{maxY:4.08});
    assert(stone);close(stone.height,4.04);assert.equal(hit.height,stone.height);assert.deepEqual(guide.surfaceAt(x,z,{maxY:4.08}),hit);
    const ground=visibleHit(fine,x,z,4.08);if(ground)assert(ground.point.y<=4.000001);
  }
  for(const d of [.05,.5,1,2,3,4.5]){
    const x=950.8+d,z=-654,ground=visibleHit(fine,x,z,4.2);assert(ground);assert(ground.face.normal.y>.98);
    assert(ground.point.y<=4.000001&&ground.point.y>=3.81999);if(d>=4.5)close(ground.point.y,3.82,1e-5);
    assert.deepEqual(guide.surfaceAt(x,z,{maxY:4.2}),terrain.surfaceAt(x,z,{maxY:4.2}));
  }
});

test('east 14.3 m and west 4 m links have their actual top and underside, and old guide matches every sampled footfall',()=>{
  assert.equal(terrain.paths.length,2);
  for(const path of terrain.paths){const mesh=terrain.group.getObjectByName(`${path.id}-stone-path`);for(let i=1;i<40;i++){
    const t=i/40,x=path.from[0]+(path.to[0]-path.from[0])*t,z=path.from[2]+(path.to[2]-path.from[2])*t,hit=terrain.surfaceAt(x,z,{maxY:4.3}),ray=visibleHit(mesh,x,z,4.3);
    assert(ray);close(hit.height,ray.point.y);assert.equal(hit.walkable,true);assert.deepEqual(guide.surfaceAt(x,z,{maxY:4.3}),hit);
    const below=visibleHit(mesh,x,z,2,1);assert(below);close(below.point.y,ray.point.y-path.thickness);assert(below.face.normal.y<0);
  }}
  for(const maxY of [3.6,3.8,4.1,Infinity])assert.deepEqual(guide.surfaceAt(968,-640,{maxY,includeBridges:false}),terrain.surfaceAt(968,-640,{maxY,includeBridges:false}));
  assert.equal(terrain.bridges.length,0);assert(terrain.colliders.every(c=>!c.id.startsWith('xianfashan')));
});

test('shared seam has bit-identical positions and lighting attributes and no new coastal or water context',()=>{
  const coarse=terrain.group.getObjectByName(`${id}-coarse-land`).geometry,fine=terrain.group.getObjectByName(`${id}-fine-land`).geometry;
  assert(fine.userData.boundaryVertexCount>12);
  for(const {fine:i,coarse:j} of fine.userData.boundaryCopies)for(const name of ['position','normal','uv','color'])for(let c=0;c<fine.attributes[name].itemSize;c++)assert.equal(fine.attributes[name].getComponent(i,c),coarse.attributes[name].getComponent(j,c));
  assert.deepEqual(staticGeometry.map(digest),geometryHashes,'every exterior land/bed/shore/wall/water geometry remains the same object with the same bytes');
  const fineGroup=terrain.group.getObjectByName(`${id}-fine`);assert(fineGroup.children.every(node=>!/(coast|foundation|lake|water)/.test(node.name)));
  assert.equal(terrain.waterSurfaces.length,1);assert.equal(terrain.waterSurfaces[0].worldY,3.7);const wet=terrain.surfaceAt(1000,-640);assert.equal(wet.kind,'lake-bed');assert.equal(wet.walkable,false);assert.equal(wet.waterY,3.7);
  assert.equal(terrain.surfaceAt(1040,-640).kind,'sea');
});

test('the real Float32 narrow border remains manifold and every fine triangle is a positive-area support primitive',()=>{
  const fine=terrain.group.getObjectByName(`${id}-fine-land`).geometry,p=fine.attributes.position,edges=new Map(),sampler=createTriangleSampler([fine]);
  try{
    metrics.fineLand={vertices:p.count,triangles:fine.index.count/3,bytes:[fine.index,...Object.values(fine.attributes)].reduce((sum,attribute)=>sum+attribute.array.byteLength,0),...fine.userData,boundaryCopies:undefined,boundaryEdges:undefined};
    assert(fine.userData.quantizedSplitsRejected>0,'the actual almost-collinear stored border exercises midpoint collision protection');
    assert.equal(sampler.triangleCount,fine.index.count/3);
    for(let n=0;n<fine.index.count;n+=3){const ids=[0,1,2].map(i=>fine.index.getX(n+i));assert.equal(new Set(ids).size,3);for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}}
    assert([...edges.values()].every(count=>count<=2));
    for(const edge of fine.userData.boundaryEdges){const ids=edge.map(coarse=>fine.userData.boundaryCopies.find(pair=>pair.coarse===coarse).fine).sort((a,b)=>a-b);assert.equal(edges.get(ids.join(':')),1);}
    for(const attribute of Object.values(fine.attributes))assert([...attribute.array].every(Number.isFinite));
    assert(p.count<50000,'a narrow fixed seam cannot drive unbounded refinement');
  }finally{sampler.dispose();}
});

test('leaving retains the full hill; explicit revert and retry reuse geometry and update the same old local query',()=>{
  const fine=terrain.group.getObjectByName(`${id}-fine-land`).geometry,digestBefore=digest(fine),active=terrain.heightAt(921,-640);
  for(let i=0;i<90;i++)terrain.surfaceAt(1200+i,-400);assert.equal(terrain.heightAt(921,-640),active);assert.equal(owner.group.visible,true);assert.equal(terrain.replacementStates[0].state,'active');
  terrain.revertReplacement(id);assert.equal(terrain.heightAt(925,-640),baseState.height);assert.deepEqual(guide.surfaceAt(925,-640),terrain.surfaceAt(925,-640));assert.equal(owner.group.visible,false);assert.equal(terrain.paths.length,0);
  terrain.activateReplacement(id,{owner,support});assert.equal(terrain.group.getObjectByName(`${id}-fine-land`).geometry,fine);assert.equal(digest(fine),digestBefore);assert.equal(terrain.heightAt(921,-640),active);assert.deepEqual(staticGeometry.map(digest),geometryHashes);
});

test('five thousand local foot positions keep old guide and active terrain height/normal/footprint exactly aligned',()=>{
  const points=Array.from({length:5000},(_,i)=>[875+104*((i*619)%5003)/5003,-682+85*((i*947)%5003)/5003]);
  const expected=points.map(([x,z])=>terrain.surfaceAt(x,z,{maxY:12.3})),started=performance.now();
  const actual=points.map(([x,z])=>guide.surfaceAt(x,z,{maxY:12.3}));metrics.guideQueries={count:points.length,elapsedMs:performance.now()-started};
  for(let i=0;i<points.length;i++){assert.equal(actual[i]?.height,expected[i]?.height);assert.deepEqual(actual[i]?.normal,expected[i]?.normal);assert.equal(actual[i]?.walkable,expected[i]?.walkable);assert.equal(actual[i]?.waterY,expected[i]?.waterY);}
});

test('releasing one local guide does not release the shared patch and cannot continue querying its source owner',()=>{
  const another=terrain.createGuideSupport({minX:880,maxX:970,minZ:-670,maxZ:-610}),expected=terrain.surfaceAt(925,-640);
  assert.deepEqual(another.surfaceAt(925,-640),expected);another.dispose();another.dispose();assert.equal(another.surfaceAt(925,-640),null);assert.equal(another.surfaceAt(980,-640),null);assert.deepEqual(guide.surfaceAt(925,-640),expected);assert.equal(terrain.replacementStates[0].state,'active');assert.equal(owner.group.visible,true);assert.equal(support.disposed,false);
});

test('terrain disposal releases both local states once while leaving the borrowed full model/support alive',()=>{
  const geos=new Set();terrain.group.traverse(node=>{if(node.geometry)geos.add(node.geometry);});for(const water of terrain.waterSurfaces)geos.add(water.geometry);
  const counts=new Map();for(const geometry of geos)geometry.addEventListener('dispose',()=>counts.set(geometry,(counts.get(geometry)??0)+1));
  terrain.dispose();terrain.dispose();assert.equal(counts.size,geos.size);assert([...counts.values()].every(n=>n===1));metrics.terrainGeometryDisposalCount=counts.size;metrics.terrainGeometriesDisposedExactlyOnce=[...counts.values()].every(n=>n===1);assert.equal(sourceDisposed,0);assert.equal(support.disposed,false);assert(support.surfaceAt(925,-640));assert.equal(terrain.surfaceAt(925,-640),null);assert.equal(guide.surfaceAt(925,-640),null);assert.throws(()=>terrain.activateReplacement(id,{owner,support}),/disposed/);
});
