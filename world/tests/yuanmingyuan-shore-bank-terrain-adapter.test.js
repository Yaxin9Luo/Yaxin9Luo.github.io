import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createShoreBankTerrainAdapter} from '../src/yuanmingyuan/shore-bank-terrain-adapter.js';

function grid(name,xs,zs,height){
  const p=[],c=[],uv=[],index=[];
  for(const z of zs)for(const x of xs){p.push(x,height(x,z),z);c.push(.4,.5,.2);uv.push(x*.08,z*.08);}
  for(let z=0;z<zs.length-1;z++)for(let x=0;x<xs.length-1;x++){const a=z*xs.length+x,b=a+1,c=a+xs.length,d=c+1;index.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.name=name;g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function capture(source,faces,body){
  const g=new THREE.BufferGeometry(),vertices=[],map=new Map(),index=[];g.name=source.name;
  for(const face of faces)for(let n=0;n<3;n++){const id=source.index.getX(face*3+n);if(!map.has(id)){map.set(id,vertices.length);vertices.push(id);}index.push(map.get(id));}
  for(const [name,a] of Object.entries(source.attributes))g.setAttribute(name,new THREE.Float32BufferAttribute(vertices.flatMap(id=>Array.from({length:a.itemSize},(_,c)=>a.getComponent(id,c))),a.itemSize));
  g.setIndex(index);g.userData={sourceGeometryUUID:source.uuid,sourceGeometryName:source.name,sourceTriangleIndices:faces,sourceVertexIndices:vertices,body};g.computeBoundingBox();g.computeBoundingSphere();return g;
}
const allFaces=g=>Array.from({length:g.index.count/3},(_,i)=>i);
const arrayBytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('hex');
const methods=terrain=>Object.fromEntries(['surfaceAt','heightAt','createGuideSupport'].map(n=>[n,terrain[n]]));

/** 64 actual source triangles, of which exactly 58 are replaced. Only this
 * small fixture is constructed: no garden, study refinement or asset factory. */
function fixture(){
  const geometries=new Set(),materials=new Set(),textures=new Set(),counts={terrain:0,study:0,texture:0,sourceGeometry:0,studyGeometry:0,material:0,locals:0};
  const own=(g,isStudy=false)=>{geometries.add(g);g.addEventListener('dispose',()=>counts[isStudy?'studyGeometry':'sourceGeometry']++);return g;};
  const sourceMaterial=new THREE.MeshStandardMaterial({vertexColors:true});materials.add(sourceMaterial);
  for(const name of ['map','normalMap','roughnessMap']){const texture=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);texture.addEventListener('dispose',()=>counts.texture++);textures.add(texture);sourceMaterial[name]=texture;}
  const fineMaterial=sourceMaterial.clone();materials.add(fineMaterial);for(const m of materials)m.addEventListener('dispose',()=>counts.material++);
  const xs=Array.from({length:33},(_,i)=>i),bed=own(grid('live-lake-bed',xs,[0,2],x=>x*.005)),dry=own(grid('live-dry-land',[0,32],[2,5],(x,z)=>x*.005+(z-2)*.45)),water=own(grid('live-water',[0,32],[0,2],()=>0));
  const group=new THREE.Group(),bedMesh=new THREE.Mesh(bed,sourceMaterial),dryMesh=new THREE.Mesh(dry,sourceMaterial);bedMesh.userData.body='lake-bed';dryMesh.userData.body='land';group.add(bedMesh,dryMesh);group.updateMatrixWorld(true);
  const sourceSampler=createTriangleSampler([dry,bed]),liveWater={id:'lake',geometry:water,worldY:.7},localOwners=[];let terrainDisposed=false;
  const classify=hit=>hit?{...hit,kind:hit.geometry===dry?'land':'lake-bed',walkable:hit.geometry===dry,waterY:hit.geometry===bed?.7:undefined,supportSource:'terrain-triangle'}:null;
  const rawSurface=(x,z,{maxY=Infinity}={})=>terrainDisposed?null:classify(sourceSampler.sample(x,z,maxY));
  const terrain={group,earthMaterial:sourceMaterial,surfaceAt:rawSurface,heightAt:(x,z,o)=>rawSurface(x,z,o)?.height,waterSurfaces:[liveWater],paths:[],courtFootprints:[],replacementStates:[],get disposed(){return terrainDisposed;},createGuideSupport(bounds){
    const sampler=sourceSampler.local(bounds),owner={released:false,throws:false,triangleCount:sampler.triangleCount,surfaceAt(x,z,{maxY=Infinity}={}){return this.released?null:classify(sampler.sample(x,z,maxY));},dispose(){if(this.released)return;this.released=true;counts.locals++;sampler.dispose();if(this.throws)throw new Error('local query cleanup failed');}};localOwners.push(owner);return owner;
  },dispose(){if(terrainDisposed)return;terrainDisposed=true;counts.terrain++;sourceSampler.dispose();}};
  const faces=Array.from({length:58},(_,i)=>i+2),capturedBed=own(capture(bed,faces,'lake-bed'),true),capturedDry=own(capture(dry,allFaces(dry),'land'),true),capturedWater=own(capture(water,allFaces(water),'water'),true);
  const fine=own(grid('actual-fine-bed',xs.slice(1,31),[0,1,2],(x,z)=>x*.005+(z===1?1.2*Math.sin(Math.PI*(x-1)/29):0)),true),fineSampler=createTriangleSampler([fine],1);
  const studyGroup=new THREE.Group(),before=new THREE.Group(),candidate=new THREE.Group();studyGroup.add(before,candidate);before.add(new THREE.Mesh(capturedDry,sourceMaterial),new THREE.Mesh(capturedBed,sourceMaterial));const fineMesh=new THREE.Mesh(fine,fineMaterial);fineMesh.name='actual-fine-bed';candidate.add(fineMesh);
  const gravel=new THREE.Group();gravel.name='shore-bank-gravel-clusters';const stoneGeometry=own(new THREE.BoxGeometry(.09,.05,.08),true),stones=new THREE.InstancedMesh(stoneGeometry,fineMaterial,1);stones.setMatrixAt(0,new THREE.Matrix4().makeTranslation(3,.65,1));gravel.add(stones);candidate.add(gravel);studyGroup.updateMatrixWorld(true);
  const matrix=new THREE.Matrix4();stones.getMatrixAt(0,matrix);const stoneContact=own(stoneGeometry.clone().applyMatrix4(matrix),true),stoneSampler=createTriangleSampler([stoneContact],.5);
  const edits=[{sourceVertexIndex:capturedDry.userData.sourceVertexIndices[0],color:[Math.fround(.2),Math.fround(.22),Math.fround(.19)]}];let studyDisposed=false,mode='candidate',sampleError=false;
  const study={group:studyGroup,before,candidate,patches:[{sourceGeometryUUID:bed.uuid,sourceGeometryName:bed.name,sourceTriangleIndices:faces,sourceGeometry:capturedBed,geometry:fine}],colorEdits:[{sourceGeometryUUID:dry.uuid,sourceGeometryName:dry.name,edits}],waterSurfaces:[{id:'lake',geometry:capturedWater,worldY:.7}],spec:{waterY:.7},diagnostics:{sourceIdentity:'real-small-three-fixture'},containsPatchPoint:(x,z)=>!!fineSampler.sample(x,z),samplePatch(x,z,{maxY=Infinity,includePebbles=true}={}){if(sampleError)throw new Error('fine sample failed');let hit=fineSampler.sample(x,z,maxY);const stone=includePebbles?stoneSampler.sample(x,z,maxY):null;if(stone&&(!hit||stone.height>hit.height))hit=stone;return hit?{...hit,kind:hit.height>.73?'land':'lake-bed',walkable:hit.height>.73,waterY:.7,supportSource:'terrain-triangle'}:null;},setMode(value){mode=value;},get mode(){return mode;},get disposed(){return studyDisposed;},dispose(){if(studyDisposed)return;studyDisposed=true;counts.study++;fineSampler.dispose();stoneSampler.dispose();},failSamples(){sampleError=true;}};
  function dispose(){terrain.dispose();study.dispose();for(const o of localOwners)o.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
  return {terrain,study,counts,bed,dry,water,bedMesh,dryMesh,sourceMaterial,fineMaterial,fine,liveWater,localOwners,dispose};
}

test('58 source faces are replaced by real geometry; dry attributes, water and borrowed owners are retained',()=>{
  const f=fixture(),saved=methods(f.terrain),originalBytes=Object.fromEntries(Object.entries(f.dry.attributes).map(([name,a])=>[name,arrayBytes(a.array)]));let adapter;
  try{
    const source=f.terrain.surfaceAt(16.25,1),dry=f.terrain.surfaceAt(16,4),waterList=f.terrain.waterSurfaces;
    adapter=createShoreBankTerrainAdapter(f);assert.equal(adapter.active,false);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.terrain.surfaceAt(16.25,1).height,source.height);
    adapter.activate();assert.equal(adapter.snapshot.replacedBedFaces,58);assert.equal(f.bedMesh.geometry.index.count/3,6);assert.notEqual(f.bedMesh.geometry,f.bed);assert.equal(f.bed.index.count/3,64);assert.deepEqual(f.bedMesh.geometry.userData.sourceTriangleIndices,[0,1,60,61,62,63]);
    for(const key of ['position','normal','uv'])assert.equal(f.dryMesh.geometry.attributes[key],f.dry.attributes[key]);assert.equal(f.dryMesh.geometry.index,f.dry.index);assert.notEqual(f.dryMesh.geometry.attributes.color,f.dry.attributes.color);
    for(const [key,a] of Object.entries(f.dry.attributes))assert.equal(arrayBytes(a.array),originalBytes[key]);
    assert.equal(f.bedMesh.material,f.sourceMaterial);assert.equal(f.dryMesh.material,f.sourceMaterial);assert.equal(f.terrain.waterSurfaces,waterList);assert.equal(f.terrain.waterSurfaces[0],f.liveWater);assert.equal(f.liveWater.geometry,f.water);assert.equal(f.liveWater.worldY,.7);
    const actual=f.terrain.surfaceAt(16.25,1);assert(actual.height>source.height+1);assert.equal(actual.geometry,f.fine);assert.equal(f.terrain.heightAt(16.25,1),actual.height);assert.equal(adapter.samplePatch(16.25,1).height,actual.height);assert.deepEqual(f.terrain.surfaceAt(16,4),dry);
    f.terrain.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(16.25,5,1),new THREE.Vector3(0,-1,0));const visible=ray.intersectObject(f.terrain.group,true).filter(h=>h.object.visible&&h.object.parent.visible);assert(visible.length);assert(Math.abs(visible[0].point.y-actual.height)<1e-8);assert(!visible.some(hit=>hit.object===f.bedMesh),'removed old bed is not drawn beneath the candidate');
    ray.ray.origin.set(3,5,1);const stoneHit=ray.intersectObject(adapter.group,true)[0];assert(stoneHit.object.isInstancedMesh);assert(Math.abs(stoneHit.point.y-f.terrain.surfaceAt(3,1).height)<1e-7,'actual cloned stone instances and their support agree');
    adapter.revert();assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);assert.equal(adapter.group.visible,false);assert.equal(f.terrain.surfaceAt(16.25,1).height,source.height);adapter.activate();adapter.dispose();
    for(const [name,value] of Object.entries(saved))assert.equal(f.terrain[name],value);assert.equal(adapter.group.parent,null);assert.equal(f.counts.terrain,0);assert.equal(f.counts.study,0);assert.equal(f.counts.material,0);assert.equal(f.counts.texture,0);assert.equal(f.counts.sourceGeometry,0);assert.equal(f.counts.studyGeometry,0);
  }finally{adapter?.dispose();f.dispose();}
});

test('maxY miss never exposes a removed source triangle; unrelated original support remains queryable',()=>{
  const f=fixture();let adapter,bridgeSampler,bridge;
  try{
    const native=f.terrain.surfaceAt;bridge=new THREE.BoxGeometry(.8,.12,.8).translate(16.25,2.44,1);bridgeSampler=createTriangleSampler([bridge],1);let bridgeEnabled=false;
    f.terrain.surfaceAt=(x,z,options={})=>{const base=native(x,z,options),hit=bridgeEnabled&&options.includeBridges!==false?bridgeSampler.sample(x,z,options.maxY??Infinity):null;return hit&&(!base||hit.height>base.height)?{...hit,kind:'bridge',walkable:true}:base;};
    adapter=createShoreBankTerrainAdapter(f);adapter.activate();const top=f.terrain.surfaceAt(16.25,1).height;
    assert.equal(f.terrain.surfaceAt(16.25,1,{maxY:top-.1}),null);assert.equal(f.terrain.heightAt(16.25,1,{maxY:top-.1}),undefined);assert.equal(adapter.samplePatch(16.25,1,{maxY:top-.1}),null);
    assert.equal(f.terrain.surfaceAt(.5,1,{maxY:.5}).geometry,f.bed,'outside original bed is retained');assert.equal(f.terrain.surfaceAt(16,4).geometry,f.dry);
    bridgeEnabled=true;assert.equal(f.terrain.surfaceAt(16.25,1).kind,'bridge');assert.equal(f.terrain.surfaceAt(16.25,1,{maxY:2}).geometry,f.fine);assert.equal(f.terrain.surfaceAt(16.25,1,{includeBridges:false}).geometry,f.fine);
  }finally{adapter?.dispose();bridgeSampler?.dispose();bridge?.dispose();f.dispose();}
});

test('local query handles track activate/revert, dispose returns null, and pre-existing native query is never released',()=>{
  const f=fixture(),bounds={minX:0,maxX:32,minZ:0,maxZ:5},native=f.terrain.createGuideSupport(bounds),nativeHeight=native.surfaceAt(16.25,1).height;let adapter;
  try{
    const saved=methods(f.terrain);adapter=createShoreBankTerrainAdapter(f);const local=f.terrain.createGuideSupport(bounds),heldGlobal=f.terrain.surfaceAt;
    assert.equal(local.surfaceAt(16.25,1).height,nativeHeight);adapter.activate();const newHeight=local.surfaceAt(16.25,1).height;assert(newHeight>nativeHeight+1);assert.equal(local.surfaceAt(16.25,1,{maxY:newHeight-.1}),null);
    adapter.revert();assert.equal(local.surfaceAt(16.25,1).height,nativeHeight);adapter.activate();assert.equal(local.surfaceAt(16.25,1).height,newHeight);adapter.dispose();
    assert.equal(local.surfaceAt(16.25,1),null);assert.equal(heldGlobal(16.25,1),null);assert.equal(local.disposed,true);assert.equal(native.released,false);assert.equal(native.surfaceAt(16.25,1).height,nativeHeight);assert.equal(f.counts.locals,1);local.dispose();adapter.dispose();assert.equal(f.counts.locals,1);
    for(const [name,value] of Object.entries(saved))assert.equal(f.terrain[name],value);const fresh=f.terrain.createGuideSupport(bounds);assert.equal(fresh.surfaceAt(16.25,1).height,nativeHeight);fresh.dispose();
  }finally{adapter?.dispose();f.dispose();}
});

test('different live UUID is accepted only with exact original face, vertex and all Float32 attribute identity',()=>{
  for(const mutation of ['uuid','position','normal','uv','color','index','signed-zero','transform','water-height','water-index','duplicate-name']){
    const f=fixture(),saved=methods(f.terrain);let adapter;
    try{
      if(mutation==='uuid')f.bed.uuid=THREE.MathUtils.generateUUID();
      else if(['position','normal','uv','color'].includes(mutation)){const a=f.bed.attributes[mutation],i=f.study.patches[0].sourceGeometry.userData.sourceVertexIndices[0]*a.itemSize;a.array[i]=Math.fround(a.array[i]+.0001);}
      else if(mutation==='index')f.bed.index.array[6]=0;
      else if(mutation==='signed-zero'){const a=f.bed.attributes.position,i=f.study.patches[0].sourceGeometry.userData.sourceVertexIndices[0]*3+2;assert.equal(a.array[i],0);a.array[i]=-0;}
      else if(mutation==='transform')f.bedMesh.position.x=.01;
      else if(mutation==='water-height')f.liveWater.worldY=.71;
      else if(mutation==='water-index')f.water.index.array[0]=3;
      else if(mutation==='duplicate-name')f.terrain.group.add(new THREE.Mesh(f.bed,f.sourceMaterial));
      const children=f.terrain.group.children.slice();
      if(mutation==='uuid'){adapter=createShoreBankTerrainAdapter(f);assert.notEqual(adapter.snapshot.liveGeometryUUID,adapter.snapshot.sourceGeometryUUID);assert(adapter.snapshot.verifiedFloat32Components>100);}
      else{assert.throws(()=>createShoreBankTerrainAdapter(f),/Shore bank terrain adapter/);assert.deepEqual(f.terrain.group.children,children);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);for(const [name,value] of Object.entries(saved))assert.equal(f.terrain[name],value);assert.equal(f.counts.sourceGeometry,0);assert.equal(f.counts.studyGeometry,0);}
    }finally{adapter?.dispose();f.dispose();}
  }
});

test('late source changes, crossing paths/private patches and stale texture ownership reject activation safely',()=>{
  for(const mutation of ['position','path','court','private-patch','texture']){
    const f=fixture();let adapter;
    try{
      adapter=createShoreBankTerrainAdapter(f);
      if(mutation==='position')f.bed.attributes.position.array[3]+=.01;
      if(mutation==='path')f.terrain.paths=[{polygon:[[5,.5],[6,.5],[6,1.5],[5,1.5]]}];
      if(mutation==='court')f.terrain.courtFootprints=[{polygon:[[5,.5],[6,.5],[6,1.5],[5,1.5]]}];
      if(mutation==='private-patch')f.terrain.replacementStates=[{active:true,bounds:{minX:5,maxX:6,minZ:.5,maxZ:1.5}}];
      if(mutation==='texture')f.fineMaterial.map=null;
      assert.throws(()=>adapter.activate(),/Shore bank terrain adapter/);assert.equal(adapter.active,false);assert.equal(adapter.group.visible,false);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);assert(adapter.snapshot.error);assert.equal(f.counts.texture,0);assert.equal(f.counts.study,0);
    }finally{adapter?.dispose();f.dispose();}
  }
});

test('partial display activation rolls back; a later support error also restores the original geometry',()=>{
  const f=fixture();let adapter;
  try{
    adapter=createShoreBankTerrainAdapter(f);let visible=false,failOnce=true;
    Object.defineProperty(adapter.group,'visible',{configurable:true,get:()=>visible,set(value){if(value&&failOnce){failOnce=false;throw new Error('display commit failed');}visible=value;}});
    assert.throws(()=>adapter.activate(),/display commit failed/);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);assert.equal(adapter.active,false);assert.equal(visible,false);
    adapter.activate();assert.equal(adapter.active,true);f.study.failSamples();assert.throws(()=>f.terrain.surfaceAt(16.25,1),/fine sample failed/);assert.equal(adapter.active,false);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);assert.equal(visible,false);assert.equal(f.terrain.surfaceAt(16.25,1).geometry,f.bed);
  }finally{adapter?.dispose();f.dispose();}
});

test('initial attach failure disposes only new display resources and changes no live query/geometry owners',()=>{
  const f=fixture(),saved=methods(f.terrain),dispose=THREE.BufferGeometry.prototype.dispose;let viewDisposes=0;
  const listener=e=>{if(e.child?.name==='shore-bank-terrain-adapter')throw new Error('scene attach failed');};
  THREE.BufferGeometry.prototype.dispose=function(){if(this.userData.shoreBankDisplayView)viewDisposes++;return dispose.call(this);};
  try{
    f.terrain.group.addEventListener('childadded',listener);assert.throws(()=>createShoreBankTerrainAdapter(f),/scene attach failed/);assert.equal(viewDisposes,2);assert.equal(f.terrain.group.children.length,2);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);for(const [name,value] of Object.entries(saved))assert.equal(f.terrain[name],value);assert.equal(f.counts.sourceGeometry,0);assert.equal(f.counts.studyGeometry,0);assert.equal(f.counts.material,0);assert.equal(f.counts.texture,0);
  }finally{f.terrain.group.removeEventListener('childadded',listener);THREE.BufferGeometry.prototype.dispose=dispose;f.dispose();}
});

test('a partial public-method install is rolled back without leaving the first wrapper installed',()=>{
  const f=fixture(),saved=methods(f.terrain);let installFailed=false;
  const proxy=new Proxy(f.terrain,{defineProperty(target,name,descriptor){if(name==='heightAt'&&descriptor.value!==saved.heightAt&&!installFailed){installFailed=true;throw new Error('method install failed');}return Reflect.defineProperty(target,name,descriptor);}});
  try{
    assert.throws(()=>createShoreBankTerrainAdapter({terrain:proxy,study:f.study}),/method install failed/);assert.equal(installFailed,true);assert.equal(f.terrain.group.children.length,2);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);for(const [name,value] of Object.entries(saved))assert.equal(f.terrain[name],value);assert.equal(f.counts.sourceGeometry,0);assert.equal(f.counts.studyGeometry,0);assert.equal(f.counts.texture,0);
  }finally{f.dispose();}
});

test('a failed footprint query is visible and restores the source for both public query entry points',()=>{
  for(const endpoint of ['surfaceAt','samplePatch']){
    const f=fixture();let adapter;try{adapter=createShoreBankTerrainAdapter(f);adapter.activate();f.study.containsPatchPoint=()=>{throw new Error('footprint query failed');};assert.throws(()=>adapter[endpoint](16,1),/footprint query failed/);assert.equal(adapter.active,false);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(adapter.group.visible,false);assert.match(adapter.snapshot.error,/footprint query failed/);}finally{adapter?.dispose();f.dispose();}
  }
});

test('even a fine-footprint miss cannot resurrect an excluded original triangle',()=>{
  const f=fixture();let adapter;try{adapter=createShoreBankTerrainAdapter(f);adapter.activate();f.study.containsPatchPoint=()=>false;assert.equal(f.terrain.surfaceAt(16.25,1),null);assert.equal(adapter.samplePatch(16.25,1),null);assert.equal(f.terrain.surfaceAt(.5,1).geometry,f.bed);assert.equal(f.terrain.surfaceAt(16,4).geometry,f.dry);}finally{adapter?.dispose();f.dispose();}
});

test('cleanup errors do not leak remaining queries/views or prevent exact original function restoration',()=>{
  const f=fixture(),saved=methods(f.terrain);let adapter;
  try{
    adapter=createShoreBankTerrainAdapter(f);adapter.activate();const bounds={minX:0,maxX:32,minZ:0,maxZ:5},a=f.terrain.createGuideSupport(bounds),b=f.terrain.createGuideSupport(bounds);f.localOwners[0].throws=true;
    let views=0,instances=0;f.bedMesh.geometry.addEventListener('dispose',()=>{views++;throw new Error('bed view cleanup failed');});f.dryMesh.geometry.addEventListener('dispose',()=>views++);adapter.group.traverse(node=>{if(node.isInstancedMesh)node.addEventListener('dispose',()=>instances++);});
    assert.throws(()=>adapter.dispose(),AggregateError);assert.equal(adapter.disposed,true);assert.equal(adapter.active,false);assert.equal(adapter.group.parent,null);assert.equal(f.bedMesh.geometry,f.bed);assert.equal(f.dryMesh.geometry,f.dry);assert.equal(views,2);assert.equal(instances,1);assert.equal(f.counts.locals,2);assert.equal(a.surfaceAt(16,1),null);assert.equal(b.surfaceAt(16,1),null);assert.equal(f.counts.sourceGeometry,0);assert.equal(f.counts.studyGeometry,0);assert.equal(f.counts.material,0);assert.equal(f.counts.texture,0);for(const [name,value] of Object.entries(saved))assert.equal(f.terrain[name],value);adapter.dispose();assert.equal(views,2);
  }finally{adapter?.dispose();f.dispose();}
});

test('duplicate adapters, disposed owners and an invalid acquired local query have explicit ownership outcomes',()=>{
  const f=fixture();let adapter;
  try{
    adapter=createShoreBankTerrainAdapter(f);assert.throws(()=>createShoreBankTerrainAdapter(f),/already has/);adapter.activate();f.study.dispose();assert.equal(f.terrain.surfaceAt(16,1).geometry,f.bed);assert.equal(adapter.active,false);adapter.dispose();assert.throws(()=>createShoreBankTerrainAdapter(f),/live shore bank study/);
  }finally{adapter?.dispose();f.dispose();}
  const g=fixture();let other;try{let released=0;g.terrain.createGuideSupport=()=>({dispose(){released++;}});other=createShoreBankTerrainAdapter(g);assert.throws(()=>g.terrain.createGuideSupport({}),/invalid local query/);assert.equal(released,1);assert.equal(other.snapshot.localQueries,0);}finally{other?.dispose();g.dispose();}
});
