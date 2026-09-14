import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {captureTerrainRegions} from '../src/yuanmingyuan/terrain-region-export.js';
import {triangulateSurface,createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createTerrainPatchOwner} from '../src/yuanmingyuan/terrain-patch-owner.js';
import {pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const region=(id,minX,maxX,minZ,maxZ)=>({id,minX,maxX,minZ,maxZ});
const whole=region('whole',-7,7,-7,7);
const face=(polygon,y,name,holes=[])=>triangulateSurface([{outer:polygon,holes}],{heightAt:()=>y,edgeLength:Infinity,name});
function bytes(geometry){const h=createHash('sha256');for(const a of [...Object.values(geometry.attributes),geometry.index].filter(Boolean))h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));return h.digest('hex');}
function sameSource(record,geometry){
  assert.equal(record.geometryUUID,geometry.uuid);assert.equal(record.geometryName,geometry.name);
  for(const [name,attribute] of Object.entries(record.attributes)){
    const values=[...attribute.values];for(const i of attribute.negativeZeroIndices)values[i]=-0;
    const actual=new Uint32Array(new Float32Array(values).buffer),source=new Uint32Array(geometry.attributes[name].array.buffer,geometry.attributes[name].array.byteOffset,geometry.attributes[name].array.length);
    for(let i=0;i<record.sourceVertexIndices.length;i++)for(let c=0;c<attribute.itemSize;c++)assert.equal(actual[i*attribute.itemSize+c],source[record.sourceVertexIndices[i]*attribute.itemSize+c],`${name} Float32 bits`);
  }
  for(let i=0;i<record.sourceTriangleIndices.length;i++)for(let c=0;c<3;c++)assert.equal(record.sourceVertexIndices[record.indices[i*3+c]],geometry.index?.getX(record.sourceTriangleIndices[i]*3+c)??record.sourceTriangleIndices[i]*3+c);
}
function fixture(){
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometries=[],meshes=[];let disposed=false,geometryDisposals=0;
  const add=(geometry,body)=>{geometry.addEventListener('dispose',()=>geometryDisposals++);geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=geometry.name;mesh.userData.body=body;group.add(mesh);meshes.push(mesh);return mesh;};
  const coast=rect(-6,-6,6,6),pool=rect(-1,-1,1,1),island=rect(.2,-.2,.4,.2),court=rect(4,-4,5,-3);
  const land=face(coast,4,'actual-land',[pool,court]),islandGeometry=face(island,4,'actual-island'),bed=face(pool,2,'actual-bed',[island]),floor=face(court,2.5,'actual-court');
  add(land,'land');add(islandGeometry,'land');add(bed,'lake-bed');add(floor,'asset-excavation');
  const bridge=new THREE.BoxGeometry(.5,.2,4);bridge.translate(0,4.9,0);bridge.name='actual-bridge';add(bridge,'open-arch-bridge');
  const path=new THREE.BoxGeometry(1,.2,2);path.translate(3,4.9,0);path.name='actual-path';add(path,'exhibition-ground-path');
  const wall=new THREE.BoxGeometry(.2,3,5);wall.translate(-3,5.5,0);wall.name='non-support-wall';add(wall,'garden-wall');
  const water=face(pool,0,'logical-water',[island]);geometries.push(water);
  const soil=createTriangleSampler([land,islandGeometry,bed,floor]),detail=createTriangleSampler([bridge,path]);
  function surfaceAt(x,z,{includeBridges=true,maxY=Infinity}={}){
    if(disposed)return null;if(!pointInPolygon([x,z],coast))return {kind:'sea',height:0,waterY:0,walkable:false};
    const a=soil.sample(x,z,maxY),b=includeBridges?detail.sample(x,z,maxY):null,hit=b&&(!a||b.height>=a.height)?b:a;if(!hit)return null;
    const wet=pointInPolygon([x,z],pool)&&!pointInPolygon([x,z],island),cut=pointInPolygon([x,z],court),kind=hit.geometry===bridge?'bridge':hit.geometry===path?'exhibition-ground-path':cut?'court-excavation':wet?'lake-bed':'land';
    return {...hit,kind,id:kind==='land'?null:kind,waterY:wet?3:undefined,walkable:kind!=='lake-bed'&&kind!=='court-excavation',supportSource:'terrain-triangle'};
  }
  const terrain={group,coastPolygon:coast,surfaceAt,heightAt:(...args)=>surfaceAt(...args)?.height,courtFootprints:[{id:'cut',polygon:court,floorY:2.5,rimY:3.8}],paths:[{id:'path',polygon:rect(2.5,-1,3.5,1),from:[3,5,-1],to:[3,5,1],width:1,thickness:.2,geometry:path}],bridges:[{id:'bridge',geometry:bridge,footprint:rect(-.25,-2,.25,2),deckY:5}],waterSurfaces:[{id:'pool',geometry:water,worldY:3,type:'lake',polygon:pool,holes:[island]}],replacementStates:[],colliders:[{id:'wall',type:'segment',from:[-3,-2.5],to:[-3,2.5],radius:.1,minY:4,maxY:7}],diagnostics:{layoutId:'small-actual-triangle-fixture',registration:'unregistered'},get disposed(){return disposed;}};
  group.updateMatrixWorld(true);
  return {terrain,group,material,geometries,meshes,add,land,bridge,water,get geometryDisposals(){return geometryDisposals;},dispose(){if(disposed)return;disposed=true;soil.dispose();detail.dispose();for(const geometry of geometries)geometry.dispose();material.dispose();group.clear();}};
}

test('whole original Float32/index bytes, holes, logical water, paths and exact live probe semantics survive detached JSON',t=>{
  const f=fixture();t.after(()=>f.dispose());const before=f.geometries.map(bytes),matrices=f.meshes.map(m=>m.matrixWorld.toArray());
  // A signed zero must survive JSON too, rather than being silently changed to +0.
  f.land.attributes.normal.array[0]=-0;before[0]=bytes(f.land);
  const probes=[['land',-2,0],['island',.3,0],['wet',.7,.7],['bridge',0,0],['path',3,0],['court',4.5,-3.5],['sea',6.5,0]].map(([id,x,z])=>({id,x,z}));
  probes.push({id:'under-bridge',x:0,z:0,maxY:3.5},{id:'no-detail',x:0,z:0,includeBridges:false},{id:'nothing-below',x:-2,z:0,maxY:1});
  const snapshot=captureTerrainRegions(f.terrain,{regions:[whole],probes,sourceIdentity:'fixture'}),json=JSON.parse(JSON.stringify(snapshot));
  assert.equal(snapshot.schema,'yuanmingyuan-live-terrain-regions-v1');assert.equal(snapshot.sourceIdentity,'fixture');assert.equal(f.geometryDisposals,0);assert.deepEqual(f.geometries.map(bytes),before);assert.deepEqual(f.meshes.map(m=>m.matrixWorld.toArray()),matrices);
  for(const record of json.geometries)sameSource(record,f.geometries.find(g=>g.uuid===record.geometryUUID));
  const byId=new Map(json.probes.map(p=>[p.id,p]));
  assert.equal(byId.get('land').surface.height,4);assert.equal(byId.get('land').surface.kind,'land');assert.equal(byId.get('wet').surface.height,2);assert.equal(byId.get('wet').surface.waterY,3);assert.equal(byId.get('wet').surface.walkable,false);
  assert.equal(byId.get('bridge').surface.height,5);assert.equal(byId.get('under-bridge').surface.height,2);assert.equal(byId.get('no-detail').surface.kind,'lake-bed');assert.equal(byId.get('path').surface.kind,'exhibition-ground-path');assert.equal(byId.get('court').surface.kind,'court-excavation');assert.equal(byId.get('island').surface.kind,'land');assert.equal(byId.get('sea').surface.kind,'sea');
  assert.equal(byId.get('nothing-below').surface,null);assert.equal(byId.get('nothing-below').heightAt,null);assert.equal(byId.get('nothing-below').heightAtDefined,false);
  for(const p of snapshot.probes){const hit=f.terrain.surfaceAt(p.x,p.z,{maxY:p.maxY??Infinity,includeBridges:p.includeBridges});if(hit?.geometry){assert.equal(p.surface.geometryUUID,hit.geometry.uuid);assert.equal(p.surface.triangleIndex,hit.triangleIndex);assert.deepEqual(p.surface.normal,hit.normal);}assert.equal(p.heightAt,hit?.height??null);}
  assert.deepEqual(json.facts.waterSurfaces[0].holes,f.terrain.waterSurfaces[0].holes);assert.equal(json.geometries.find(g=>g.phase==='water').worldMatrix[13],3);assert.equal(json.geometries.find(g=>g.body==='garden-wall').phase,'context');assert.equal(json.facts.paths.length,1);assert.equal(json.facts.bridges.length,1);assert.equal(json.facts.courts.length,1);assert.equal(json.facts.colliders.length,1);
  snapshot.facts.coastPolygon[0][0]=900;assert.equal(f.terrain.coastPolygon[0][0],-6);snapshot.geometries[0].attributes.position.values[0]=900;assert.equal(bytes(f.land),before[0]);
});

test('disjoint region union retains crossing and exact-touch triangles whole, excluding AABB-only false contacts',t=>{
  const f=fixture();t.after(()=>f.dispose());f.group.clear();
  const geometry=new THREE.BufferGeometry();geometry.name='crossing-and-touching';geometry.setAttribute('position',new THREE.Float32BufferAttribute([-10,4,0,10,4,0,0,4,10,4,4,4,6,4,4,4,4,6,20,4,20,22,4,20,20,4,22],3));geometry.setIndex([0,2,1,3,5,4,6,8,7]);f.add(geometry,'land');f.group.updateMatrixWorld(true);
  const regions=[region('cross',-1,1,1,2),region('false-bounds',5.8,6,5.8,6),region('touch',22,23,20,21)];
  const out=captureTerrainRegions(f.terrain,{regions}),record=out.geometries.find(g=>g.geometryUUID===geometry.uuid);
  assert.deepEqual(record.sourceTriangleIndices,[0,2]);assert.deepEqual(record.regionTriangleOrdinals.cross,[0]);assert.deepEqual(record.regionTriangleOrdinals['false-bounds'],[]);assert.deepEqual(record.regionTriangleOrdinals.touch,[1]);assert.equal(record.sourceVertexIndices.length,6);sameSource(record,geometry);
});

test('non-indexed transformed real meshes retain local Float32 positions and actual parent/world matrices without updating them',t=>{
  const f=fixture();t.after(()=>f.dispose());f.group.clear();f.terrain.waterSurfaces=[];f.terrain.paths=[];f.terrain.bridges=[];f.terrain.courtFootprints=[];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-2,0,-2,0,1,2,2,0,-2],3));geometry.computeVertexNormals();const mesh=f.add(geometry,'land');
  const parent=new THREE.Group();parent.position.set(20,3,-8);parent.rotation.y=.37;parent.scale.set(1.5,.8,1.2);parent.add(f.group);f.group.position.set(2,.5,1);mesh.rotation.x=.13;parent.updateMatrixWorld(true);
  const target=new THREE.Vector3(0,1/3,-2/3).applyMatrix4(mesh.matrixWorld),ray=new THREE.Raycaster(),normalMatrix=new THREE.Matrix3();
  f.terrain.surfaceAt=(x,z)=>{ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];return hit?{height:hit.point.y,normal:hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(mesh.matrixWorld)).toArray(),geometry,triangleIndex:hit.faceIndex,kind:'land',walkable:true,supportSource:'terrain-triangle'}:null;};f.terrain.heightAt=(...args)=>f.terrain.surfaceAt(...args)?.height;
  const options={regions:[region('world',15,30,-15,0)],probes:[{id:'ray',x:target.x,z:target.z}]},hash=bytes(geometry),before=mesh.matrixWorld.toArray(),out=captureTerrainRegions(f.terrain,options),record=out.geometries[0];
  assert.equal(record.sourceIndexType,null);assert.deepEqual(record.worldMatrix,before);sameSource(record,geometry);assert(Math.abs(out.probes[0].heightAt-target.y)<1e-12);assert.equal(bytes(geometry),hash);assert.deepEqual(mesh.matrixWorld.toArray(),before);
  parent.position.x+=1;assert.throws(()=>captureTerrainRegions(f.terrain,options),/update live matrices/);assert.deepEqual(mesh.matrixWorld.toArray(),before,'The reader must not update stale input matrices itself');
});

test('a real prepared patch exports only its coarse support; active private source overlap fails before any query',t=>{
  const f=fixture();t.after(()=>f.dispose());const polygon=rect(20,20,24,24),coarse=face(polygon,4,'patch-coarse');let fineDisposals=0,queries=0;
  const descriptor={id:'local-patch',assetId:'source',prepared:{courts:[]}},patch=createTerrainPatchOwner({descriptor,coarseGeometry:coarse,material:f.material,buildFine(){
    const geometry=face(polygon,5,'patch-fine-land'),group=new THREE.Group(),mesh=new THREE.Mesh(geometry,f.material);group.name='local-patch-fine';mesh.userData.body='land';group.add(mesh);const sampler=createTriangleSampler([geometry]);
    return {group,land:geometry,triangleCount:2,courts:[],paths:[],surfaceAt:(...args)=>sampler.sample(...args),dispose(){sampler.dispose();geometry.dispose();fineDisposals++;}};
  }});t.after(()=>patch.dispose());f.group.add(patch.group);Object.defineProperty(f.terrain,'replacementStates',{get:()=>[patch.snapshot]});patch.prepare();f.group.updateMatrixWorld(true);
  const patchRegion=region('patch',20,24,20,24),out=captureTerrainRegions(f.terrain,{regions:[patchRegion]});assert(out.geometries.some(g=>g.geometryName==='patch-coarse'&&g.phase==='patch'));assert(out.geometries.every(g=>g.geometryName!=='patch-fine-land'));assert.equal(fineDisposals,0);
  const owner={group:new THREE.Group(),dispose(){}},sourceGeometry=new THREE.BoxGeometry(1,1,1);owner.group.add(new THREE.Mesh(sourceGeometry,f.material));t.after(()=>sourceGeometry.dispose());patch.activate({owner,support:{surfaceAt(){return {height:5};}}});f.group.updateMatrixWorld(true);
  f.terrain.surfaceAt=()=>{queries++;throw new Error('must not query active private source');};
  assert.throws(()=>captureTerrainRegions(f.terrain,{regions:[patchRegion],probes:[{id:'not-called',x:22,z:22}]}),/unsupported active replacement/);assert.equal(queries,0);assert.equal(patch.snapshot.active,true);
  assert.doesNotThrow(()=>captureTerrainRegions(f.terrain,{regions:[region('elsewhere',-4,-2,-1,1)]}));assert.equal(patch.snapshot.active,true);
});

test('asset sampler overlap is explicitly unsupported, while an outside sampler is neither called nor exported',t=>{
  const f=fixture();t.after(()=>f.dispose());let calls=0;f.terrain.courtFootprints[0].sampleHeight=()=>{calls++;return 4;};
  assert.throws(()=>captureTerrainRegions(f.terrain,{regions:[whole]}),/unsupported asset court sampler/);assert.equal(calls,0);
  const out=captureTerrainRegions(f.terrain,{regions:[region('away',-5,-2,-1,1)]});assert.equal(out.facts.courts.length,0);assert.equal(calls,0);
});

test('sampler tolerance retains original faces outside strict contacts for later window queries, without depending on probes',t=>{
  const f=fixture();t.after(()=>f.dispose());f.group.clear();f.terrain.waterSurfaces=[];
  const geometry=face(rect(10,10,11,11),4,'edge-tolerance'),sampler=createTriangleSampler([geometry]);t.after(()=>sampler.dispose());f.add(geometry,'land');f.group.updateMatrixWorld(true);
  f.terrain.surfaceAt=(x,z,options)=>{const hit=sampler.sample(x,z,options?.maxY);return hit?{...hit,kind:'land',walkable:true,supportSource:'terrain-triangle'}:null;};f.terrain.heightAt=(...args)=>f.terrain.surfaceAt(...args)?.height;
  const options={regions:[region('edge',9.9999995,9.9999998,10.2,10.4)]},withoutProbes=captureTerrainRegions(f.terrain,options),out=captureTerrainRegions(f.terrain,{...options,probes:[{id:'tolerated',x:9.9999996,z:10.3}]}),record=out.geometries[0];
  assert.equal(out.probes[0].surface.height,4);assert.equal(record.toleranceRetainedTriangleIndices.length,1);assert.deepEqual(record.sourceTriangleIndices,record.toleranceRetainedTriangleIndices);sameSource(record,geometry);
  assert.deepEqual(record.sourceTriangleIndices,withoutProbes.geometries[0].sourceTriangleIndices);
  for(let i=0;i<=20;i++)for(let j=0;j<=20;j++){const hit=f.terrain.surfaceAt(9.9999995+i*.0000003/20,10.2+j*.2/20);assert(hit);assert(record.sourceTriangleIndices.includes(hit.triangleIndex));}
});

test('ordinary hidden support is not silently removed from the actual terrain sampler',t=>{
  const f=fixture();t.after(()=>f.dispose());f.meshes[0].visible=false;
  const out=captureTerrainRegions(f.terrain,{regions:[region('land',-2.5,-1.5,-.5,.5)],probes:[{id:'live',x:-2,z:0}]});
  assert.equal(out.geometries.find(g=>g.geometryUUID===f.land.uuid).visible,false);assert.equal(out.probes[0].surface.geometryUUID,f.land.uuid);
});

test('invalid owners, original buffers, query identity and changed replacement state fail without disposing borrowed resources',t=>{
  const f=fixture();t.after(()=>f.dispose());const opts={regions:[whole]};
  assert.throws(()=>captureTerrainRegions({...f.terrain,disposed:true},opts),/live terrain/);assert.throws(()=>captureTerrainRegions(f.terrain,{regions:[whole,whole]}),/unique/);assert.throws(()=>captureTerrainRegions(f.terrain,{...opts,probes:[null]}),/probe/);
  const original=f.land.attributes.position;f.land.setAttribute('position',new THREE.BufferAttribute(new Float64Array(original.array),3));assert.throws(()=>captureTerrainRegions(f.terrain,opts),/Float32/);f.land.setAttribute('position',original);
  const at=f.land.index.array[0];f.land.index.array[0]=original.count+1;assert.throws(()=>captureTerrainRegions(f.terrain,opts),/vertex index/);f.land.index.array[0]=at;
  const surfaceAt=f.terrain.surfaceAt;f.terrain.surfaceAt=()=>({height:4,kind:'land',supportSource:'asset-triangle'});f.terrain.heightAt=()=>4;
  assert.throws(()=>captureTerrainRegions(f.terrain,{...opts,probes:[{id:'private',x:0,z:0}]}),/unsupported live probe/);
  f.terrain.surfaceAt=(...args)=>{f.terrain.replacementStates=[{id:'changed',bounds:whole,active:false,revision:1}];return surfaceAt(...args);};
  assert.throws(()=>captureTerrainRegions(f.terrain,{...opts,probes:[{id:'change',x:-2,z:0}]}),/changed during capture/);assert.equal(f.geometryDisposals,0);
});
