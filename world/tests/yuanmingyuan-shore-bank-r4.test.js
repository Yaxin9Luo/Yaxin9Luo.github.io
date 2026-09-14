import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {shoreBankSpec,shoreBankCoordinates,shoreBankWorldXZ,shoreGeometryBoundary} from '../src/yuanmingyuan/shore-bank-geometry.js';
import {shoreBankR4SourceN,shoreBankR4Shift,createShoreBankR4Waterline} from '../src/yuanmingyuan/shore-bank-r4-geometry.js';
import {createShoreBankStudy} from '../src/yuanmingyuan/shore-bank-study.js';
import {createShoreBankTerrainAdapter} from '../src/yuanmingyuan/shore-bank-terrain-adapter.js';
import {shorePebbleDriftRecords} from '../src/yuanmingyuan/shore-pebble-drifts.js';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('hex');
function grid(name,xs,zs,height){
  const positions=[],color=[],uv=[],indices=[];
  for(const z of zs)for(const x of xs){positions.push(x,height(x,z),z);color.push(.3,.4,.2);uv.push(x*.08,z*.08);}
  for(let z=0;z<zs.length-1;z++)for(let x=0;x<xs.length-1;x++){const a=z*xs.length+x,b=a+1,c=a+xs.length,d=c+1;indices.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.name=name;g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function record(g,body,meshOrder){return {geometryUUID:g.uuid,geometryName:g.name,meshOrder,body,phase:body==='water'?'water':'soil',worldMatrix:body==='water'?identity.map((v,i)=>i===13?2:v):identity,worldY:body==='water'?2:undefined,waterId:body==='water'?'test-lake':undefined,sourceTriangleCount:g.index.count/3,sourceVertexCount:g.attributes.position.count,sourceTriangleIndices:Array.from({length:g.index.count/3},(_,i)=>i),sourceVertexIndices:Array.from({length:g.attributes.position.count},(_,i)=>i),indices:[...g.index.array],attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{arrayType:'Float32Array',itemSize:a.itemSize,values:[...a.array]}]))};}
// Deliberately small CPU geometry: no original shoreline or plant factory.
function fixture({world=false}={}){
  const xs=[-4,-2,0,2,4],land=grid('r4-fixture-land',xs,[0,.4,.8,1.5,3],(x,n)=>2+.1*n),bed=grid('r4-fixture-bed',xs,[-4.5,-3.5,-2,0],(x,n)=>2+.15*n),water=grid('r4-fixture-water',[-4,4],[-4.5,0],()=>0);
  const spec={...shoreBankSpec,...(world?{}:{originXZ:[0,0],tangentXZ:[1,0],inlandXZ:[0,1]}),halfLength:3,colourDepth:2,edgeLength:.15};
  if(world)for(const g of [land,bed,water]){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++){const [x,z]=shoreBankWorldXZ(p.getX(i),p.getZ(i),spec);p.setXYZ(i,x,p.getY(i),z);uv.setXY(i,x*.08,z*.08);}for(let i=0;i<g.index.count;i+=3){const b=g.index.getX(i+1);g.index.setX(i+1,g.index.getX(i+2));g.index.setX(i+2,b);}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
  const earth=new THREE.MeshStandardMaterial({vertexColors:true}),textures=['map','normalMap','roughnessMap'].map(key=>earth[key]=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1));
  const counts={source:0,texture:0,local:0};for(const g of [land,bed,water])g.addEventListener('dispose',()=>counts.source++);for(const t of textures)t.addEventListener('dispose',()=>counts.texture++);
  const group=new THREE.Group(),landMesh=new THREE.Mesh(land,earth),bedMesh=new THREE.Mesh(bed,earth);landMesh.userData.body='land';bedMesh.userData.body='lake-bed';group.add(landMesh,bedMesh);group.updateMatrixWorld(true);
  const snapshot={schema:'yuanmingyuan-live-terrain-regions-v1',sourceIdentity:'small-r4-actual-triangle-fixture',regions:[{id:'local',minX:spec.originXZ[0]-8,maxX:spec.originXZ[0]+8,minZ:spec.originXZ[1]-8,maxZ:spec.originXZ[1]+8}],geometries:[record(land,'land',0),record(bed,'lake-bed',1),record(water,'water',2)],facts:{waterSurfaces:[{id:'test-lake',worldY:2,polygon:[[-4,-4.5],[4,-4.5],[4,0],[-4,0]].map(v=>shoreBankWorldXZ(...v,spec)),holes:[]}]}};
  const sampler=createTriangleSampler([land,bed]),classify=(hit,x,z)=>{const n=shoreBankCoordinates(x,z,spec)[1];return hit?{...hit,kind:n<0?'lake-bed':'land',walkable:n>=0,waterY:n<0?2:undefined,supportSource:'terrain-triangle'}:null;},locals=[];
  let disposed=false;
  const terrain={group,earthMaterial:earth,waterSurfaces:[{id:'test-lake',geometry:water,worldY:2}],paths:[],courtFootprints:[],replacementStates:[],surfaceAt:(x,z,{maxY=Infinity}={})=>classify(sampler.sample(x,z,maxY),x,z),heightAt(x,z,o){return this.surfaceAt(x,z,o)?.height;},createGuideSupport(bounds){const local=sampler.local(bounds),owner={surfaceAt:(x,z,{maxY=Infinity}={})=>classify(local.sample(x,z,maxY),x,z),dispose(){if(this.disposed)return;this.disposed=true;counts.local++;local.dispose();}};locals.push(owner);return owner;},get disposed(){return disposed;}};
  return {land,bed,water,landMesh,bedMesh,earth,snapshot,terrain,spec,counts,dispose(){disposed=true;for(const local of locals)local.dispose();sampler.dispose();for(const g of [land,bed,water])g.dispose();earth.dispose();for(const t of textures)t.dispose();}};
}

test('R4 warp is monotone and fixes the root/deep collars and taper ends',()=>{
  for(let s=-12;s<=12;s+=.25){let before=-Infinity;for(let n=-3.5;n<=.7;n+=.01){const v=shoreBankR4SourceN(s,n);assert(Number.isFinite(v));assert(v>before);before=v;}for(const n of [-4,-3.5,.7,1,2])assert.equal(shoreBankR4SourceN(s,n),n);assert(shoreBankR4Shift(s)>=0&&shoreBankR4Shift(s)<=1.3);}
  for(const s of [-13,-12,12,13])for(const n of [-3,-1,0,.5])assert.equal(shoreBankR4SourceN(s,n),n);
  assert.equal(shoreBankR4SourceN(-8,-1.3),0);
});

test('one small connected mother changes its actual water intersection while every external seam stays exact',()=>{
  const f=fixture();let study;try{
    const original=JSON.stringify(f.snapshot);study=createShoreBankStudy({snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile:'curved-r4',pebbles:false});
    const patch=study.patches[0],fine=patch.geometry,mother=patch.sourceGeometry;assert.equal(patch.sources.length,2);assert(study.diagnostics.replacedDryFaces>0);assert(study.diagnostics.weldedSeamVertices>0);assert.equal(study.diagnostics.sourceDryPositionsAndIndicesPreserved,false);assert.equal(study.diagnostics.protectedDryFacesUnchanged,true);
    for(const {fine:i,coarse:j}of fine.userData.boundaryCopies)for(const name of ['position','normal','uv'])for(let c=0;c<mother.attributes[name].itemSize;c++)assert(Object.is(fine.attributes[name].getComponent(i,c),mother.attributes[name].getComponent(j,c)),name+' exact boundary');
    assert.equal(shoreGeometryBoundary(fine).length,shoreGeometryBoundary(mother).length);assert(Math.abs(fine.userData.sourceArea-fine.userData.meshArea)<.0001);
    assert(study.shorelineN(-2)<-.5);assert(study.shorelineN(-.925)>study.shorelineN(-2)+.4,'unequal cape and shallow return');
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
    for(const [x,z]of [[-2,-1],[-2,-.5],[-2,.15],[0,.25],[.95,-.15]]){const hit=study.surfaceAt(x,z,{includePebbles:false});assert(hit);ray.ray.origin.set(x,6,z);const actual=ray.intersectObject(study.candidate,true)[0];assert(actual);assert(Math.abs(hit.height-actual.point.y)<1e-7);}
    for(const x of [-2.7,-1,0,1,2.7]){const before=f.terrain.surfaceAt(x,1.2),after=study.surfaceAt(x,1.2);assert.equal(after.height,before.height);assert.deepEqual(after.normal,before.normal);assert.equal(after.originalTriangleIndex,before.triangleIndex);}
    assert.equal(study.surfaceAt(-2,.15,{maxY:null}).height,study.surfaceAt(-2,.15).height);assert.equal(study.surfaceAt(-2,-3).walkable,false);assert.equal(study.surfaceAt(-2,1.2).walkable,true);assert.equal(JSON.stringify(f.snapshot),original);
  }finally{study?.dispose();assert.equal(f.counts.source,0);assert.equal(f.counts.texture,0);f.dispose();}
});

test('two-source adapter removes both old surfaces, agrees with displayed triangles, and restores held local samplers',()=>{
  const f=fixture();let study,adapter,local;try{
    const oldMethods=Object.fromEntries(['surfaceAt','heightAt','createGuideSupport'].map(k=>[k,f.terrain[k]])),dryBytes=bytes(f.land.attributes.position.array),indices=bytes(f.land.index.array),original=f.terrain.surfaceAt(-2,.15),root=f.terrain.surfaceAt(-2,1.2),waterOwner=f.terrain.waterSurfaces[0];
    study=createShoreBankStudy({snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile:'curved-r4',pebbles:false});adapter=createShoreBankTerrainAdapter({terrain:f.terrain,study});local=f.terrain.createGuideSupport({minX:-3,maxX:3,minZ:-3,maxZ:2});
    assert.equal(f.terrain.surfaceAt(-2,.15).height,original.height);adapter.activate();const hit=f.terrain.surfaceAt(-2,.15);assert(hit.height>original.height+.01);assert.equal(local.surfaceAt(-2,.15).height,hit.height);assert.equal(f.terrain.heightAt(-2,.15),hit.height);assert.equal(adapter.samplePatch(-2,.15).height,hit.height);assert.equal(f.terrain.surfaceAt(-2,.15,{maxY:original.height+.005}),null,'removed dry source cannot reappear below new surface');assert.equal(f.terrain.surfaceAt(-2,-.5,{maxY:1.95}),null,'removed bed source cannot reappear');assert.equal(f.terrain.surfaceAt(-2,.15,{maxY:null}).height,hit.height);
    assert.deepEqual(f.terrain.surfaceAt(-2,1.2),root);assert.equal(bytes(f.land.attributes.position.array),dryBytes);assert.equal(bytes(f.land.index.array),indices);assert.equal(f.terrain.waterSurfaces[0],waterOwner);assert.equal(waterOwner.geometry,f.water);assert(adapter.snapshot.replacedDryFaces>0&&adapter.snapshot.replacedBedFaces>0);
    const ray=new THREE.Raycaster(new THREE.Vector3(-2,6,.15),new THREE.Vector3(0,-1,0)),visible=ray.intersectObject(f.terrain.group,true).filter(v=>v.object.parent.visible);assert(Math.abs(visible[0].point.y-hit.height)<1e-7);assert(!visible.some(v=>v.object===f.landMesh),'old selected dry face is removed from draw');
    adapter.revert();assert.equal(local.surfaceAt(-2,.15).height,original.height);assert.equal(f.landMesh.geometry,f.land);assert.equal(f.bedMesh.geometry,f.bed);adapter.activate();adapter.dispose();for(const [name,method]of Object.entries(oldMethods))assert.equal(f.terrain[name],method);assert.equal(local.surfaceAt(-2,.15),null);assert.equal(f.counts.local,1);assert.equal(f.counts.source,0);assert.equal(f.counts.texture,0);
  }finally{adapter?.dispose();study?.dispose();f.dispose();}
});

test('rotated world Float32 source at the real shore origin keeps a connected measured waterline',()=>{
  const f=fixture({world:true});let study;try{
    study=createShoreBankStudy({snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile:'curved-r4',pebbles:false});const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
    assert.equal(study.diagnostics.waterlineTopology.components,1);assert.equal(study.diagnostics.waterlineTopology.endpoints.length,2);assert(study.diagnostics.waterlineTopology.maximumTransverseBacktrack>.001,'real connected centimetre-scale return is measured, not classified as a detached island');
    for(const s of [-2.3,-2,-1.5,-.9,0,.95,1.65,2.3]){const n=study.shorelineN(s),[x,z]=shoreBankWorldXZ(s,n,f.spec),hit=study.surfaceAt(x,z,{includePebbles:false});assert(hit);assert(n<=0);if(n<-.001)assert(Math.abs(hit.height-2.006)<2e-7);ray.ray.origin.set(x,6,z);const actual=ray.intersectObject(study.candidate,true)[0];assert(actual);assert(Math.abs(hit.height-actual.point.y)<2e-7);}
    for(const s of [-2,0,2]){const [x,z]=shoreBankWorldXZ(s,1.2,f.spec),before=f.terrain.surfaceAt(x,z),after=study.surfaceAt(x,z);assert.equal(after.height,before.height);assert.deepEqual(after.normal,before.normal);}
    for(const p of study.patches[0].sources.filter(p=>p.sourceGeometry.userData.body==='land')){const g=p.sourceGeometry,a=g.attributes.position;for(let i=0;i<a.count;i++)assert(shoreBankCoordinates(a.getX(i),a.getZ(i),f.spec)[1]<1);}
  }finally{study?.dispose();f.dispose();}
});

test('R4 rejects altered original dry attributes before touching live display or query functions',()=>{
  const f=fixture();let study;try{study=createShoreBankStudy({snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile:'curved-r4',pebbles:false});const old=f.terrain.surfaceAt,selected=study.patches[0].sources.find(p=>p.sourceGeometry.userData.body==='land'),id=selected.sourceGeometry.userData.sourceVertexIndices[0];f.land.attributes.position.setY(id,f.land.attributes.position.getY(id)+.01);assert.throws(()=>createShoreBankTerrainAdapter({terrain:f.terrain,study}),/original position differs/);assert.equal(f.terrain.surfaceAt,old);assert.equal(f.landMesh.geometry,f.land);assert.equal(f.terrain.group.children.length,2);assert.equal(f.counts.source,0);}finally{study?.dispose();f.dispose();}
});

test('compact replay must remap captured water identity as well as dry and bed identity',()=>{
  const f=fixture();let study,adapter;try{
    study=createShoreBankStudy({snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile:'curved-r4',pebbles:false});const water=study.waterSurfaces[0].geometry,original=water.userData,oldMethod=f.terrain.surfaceAt;
    water.userData={...original,sourceTriangleIndices:original.sourceTriangleIndices.map(i=>i+100)};
    assert.throws(()=>createShoreBankTerrainAdapter({terrain:f.terrain,study}),/captured original face\/vertex mapping is out of range/);assert.equal(f.terrain.surfaceAt,oldMethod);assert.equal(f.terrain.group.children.length,2);
    water.userData={...water.userData,sourceTriangleIndices:Array.from({length:water.index.count/3},(_,i)=>i),sourceVertexIndices:Array.from({length:water.attributes.position.count},(_,i)=>i)};
    adapter=createShoreBankTerrainAdapter({terrain:f.terrain,study});adapter.activate();assert.equal(adapter.snapshot.originalWaterOwnerRetained,true);assert.equal(f.terrain.waterSurfaces[0].geometry,f.water);
  }finally{adapter?.dispose();study?.dispose();f.dispose();}
});

test('old gravel records are exact by default; optional actual shoreline only translates n',async()=>{
  const baseline=readFileSync(new URL('../../work/yuanmingyuan/shore-bank-r4/baseline/shore-pebble-drifts.js',import.meta.url),'utf8');assert.equal(createHash('sha256').update(baseline).digest('hex'),'ba61b9f77428ff0a4bc93bf89a3029a56142f321e55b2175725ce3b2494211c6');const old=await import('data:text/javascript;base64,'+Buffer.from(baseline.replace("from 'three'",`from '${import.meta.resolve('three')}'`)).toString('base64'));assert.deepEqual(shorePebbleDriftRecords(shoreBankSpec),old.shorePebbleDriftRecords(shoreBankSpec));
  const original=shorePebbleDriftRecords(shoreBankSpec),zero=shorePebbleDriftRecords(shoreBankSpec,{shorelineN:()=>0}),shifted=shorePebbleDriftRecords(shoreBankSpec,{shorelineN:s=>-.4-.02*s});assert.deepEqual(zero,original);assert.equal(original.length,111);for(let i=0;i<original.length;i++){const {n,...rest}=original[i],{n:next,...nextRest}=shifted[i];assert.deepEqual(nextRest,rest);assert(Math.abs(next-(n-.4-.02*rest.s))<1e-14);}for(const value of [Infinity,null,undefined,.1])assert.throws(()=>shorePebbleDriftRecords(shoreBankSpec,{shorelineN:()=>value}),/existing lake/);
});

test('a disconnected height graph is rejected rather than guessed as a new waterline',()=>{
  const geometry=grid('folded-bank',[-1,1],[-3,-2,-1,0,1],(x,z)=>[1.8,2.1,1.8,2.1,2.2][z+3]);try{assert.throws(()=>createShoreBankR4Waterline(geometry,{...shoreBankSpec,originXZ:[0,0],tangentXZ:[1,0],inlandXZ:[0,1]}),/disconnected strips/);}finally{geometry.dispose();}
});

test('R1 and submerged R2 small source bytes stay identical to the saved pre-R4 factory',async()=>{
  const code=readFileSync(new URL('../../work/yuanmingyuan/shore-bank-r4/baseline/shore-bank-study.js',import.meta.url),'utf8');assert.equal(createHash('sha256').update(code).digest('hex'),'d69c051688633b0e7cf28dacb6cf78787f545756b9604e4579e0518ace7a41d2');
  const baseline=await import('data:text/javascript;base64,'+Buffer.from(code.replace(/from '([^']+)'/g,(all,path)=>`from '${path==='three'?import.meta.resolve('three'):new URL('../src/yuanmingyuan/'+path.slice(2),import.meta.url).href}'`)).toString('base64'));
  const meshBytes=group=>{const meshes=[];group.traverse(node=>{if(node.isMesh)meshes.push({name:node.name,body:node.userData.body,indices:bytes(node.geometry.index.array),attributes:Object.fromEntries(Object.entries(node.geometry.attributes).map(([key,a])=>[key,{size:a.itemSize,bytes:bytes(a.array)}]))});});return meshes;};
  for(const bedProfile of ['r1','submerged-r2']){const f=fixture();f.spec.edgeLength=.5;let before,after;try{const args={snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile,pebbles:false};before=baseline.createShoreBankStudy(args);after=createShoreBankStudy(args);assert.deepEqual(meshBytes(after.group),meshBytes(before.group));for(const [x,z]of [[-2,-1],[-1,-.3],[0,.2],[1,1.2]]){const a=before.surfaceAt(x,z),b=after.surfaceAt(x,z);assert.equal(b.height,a.height);assert.deepEqual(b.normal,a.normal);assert.equal(b.kind,a.kind);assert.equal(b.walkable,a.walkable);}}finally{after?.dispose();before?.dispose();f.dispose();}}
});

test('R4 release restores both displays and all public methods even when one local cleanup throws',()=>{
  const f=fixture();let study,adapter;try{
    study=createShoreBankStudy({snapshot:f.snapshot,earthMaterial:f.earth,spec:f.spec,bedProfile:'curved-r4',pebbles:false});const oldLocal=f.terrain.createGuideSupport;
    f.terrain.createGuideSupport=function(bounds){const local=oldLocal.call(this,bounds),dispose=local.dispose;local.dispose=function(){if(this.disposed)return;dispose.call(this);throw new Error('fixture local release');};return local;};
    const methods=Object.fromEntries(['surfaceAt','heightAt','createGuideSupport'].map(k=>[k,f.terrain[k]]));adapter=createShoreBankTerrainAdapter({terrain:f.terrain,study});const a=f.terrain.createGuideSupport({minX:-3,maxX:0,minZ:-3,maxZ:2}),b=f.terrain.createGuideSupport({minX:0,maxX:3,minZ:-3,maxZ:2});adapter.activate();
    assert.throws(()=>adapter.dispose(),error=>error instanceof AggregateError&&error.errors.length===2);assert.equal(f.counts.local,2);assert.equal(a.surfaceAt(-1,0),null);assert.equal(b.surfaceAt(1,0),null);assert.equal(f.landMesh.geometry,f.land);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(adapter.group.parent,null);for(const [name,method]of Object.entries(methods))assert.equal(f.terrain[name],method);assert.equal(f.counts.source,0);assert.equal(f.counts.texture,0);assert.equal(study.disposed,false);
    assert.doesNotThrow(()=>adapter.dispose());
  }finally{adapter?.dispose();study?.dispose();f.dispose();}
});
