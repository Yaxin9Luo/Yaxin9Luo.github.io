import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTriangleSampler } from '../src/yuanmingyuan/terrain-geometry.js';
import { createXianfaShoreCommunity, createXianfaShoreCommunityLayout, xianfaShoreCommunitySpec } from '../src/yuanmingyuan/xianfa-shore-community.js';
import { createMuseumPlantingColliders } from '../src/yuanmingyuan/museum-planting-colliders.js';

const v=(...p)=>new THREE.Vector3(...p),square=(x,z,r)=>[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];
const garden={id:'small-triangle-fixture',groups:[],waterBodies:[],channels:[],ornamentalWaters:[],gardens:[],landforms:[],bridges:[],exhibition:{groundY:4,coast:{polygon:square(100,-200,50)}}};
const placements=()=>[
  ['sedge',100,-200,.92,.3],['sedge',100.7,-201,.85,1.2],['fern',101.4,-200,.9,2.1],['flower-shrub',102.5,-200,1.05,4.2],['lake-rock',105,-202,.6,.2],['lake-rock',108,-203,.46,1.1],
].map(([species,x,z,scale,yaw],i)=>({id:`fixture-${i}`,species,position:[x,null,z],scale,yaw,burial:species==='lake-rock'?.14:.004,...(species==='lake-rock'?{pitchX:Math.PI/2}:{})}));
function layout(){return {id:'fixture-layout',originXZ:[100,-200],footprint:[[95,-207],[111,-207],[111,-190],[95,-190]],clearings:[],contextIds:['willow-a','willow-b'],placements:placements()};}
function fixtures({slopeX=.04,slopeZ=-.025}={}) {
  const geoms=new Set(),mats=new Set(),textures=new Set(),events={geometry:0,material:0,texture:0,owner:0},ownGeometry=g=>{geoms.add(g);g.addEventListener('dispose',()=>events.geometry++);return g;};
  const soil=new THREE.BufferGeometry(),height=(x,z)=>4+(x-100)*slopeX+(z+200)*slopeZ;
  soil.name='actual-fixture-ground-triangles';soil.setAttribute('position',new THREE.Float32BufferAttribute([[50,-250],[150,-250],[150,-150],[50,-150]].flatMap(([x,z])=>[x,height(x,z),z]),3));soil.setIndex([0,2,1,0,3,2]);soil.computeVertexNormals();
  const sampler=createTriangleSampler([soil],8),terrain={paths:[],courtFootprints:[],waterSurfaces:[],revision:1,queries:[],surfaceAt(x,z,options){this.queries.push([x,z]);const hit=sampler.sample(x,z);return hit?{...hit,kind:'land',walkable:true,supportSource:'terrain-triangle'}:null;}};
  function material(name){const m=new THREE.MeshStandardMaterial({color:0xffffff,side:THREE.DoubleSide});m.name=name;mats.add(m);m.addEventListener('dispose',()=>events.material++);return m;}
  const leaf=material('understory-physical-leaf'),wood=material('understory-fine-stems'),stoneMat=material('reviewed-Rock01-material');
  const texture=new THREE.DataTexture(new Uint8Array([170,160,140,255]),1,1);textures.add(texture);texture.addEventListener('dispose',()=>events.texture++);stoneMat.map=texture;
  function mesh(g,m,name){const node=new THREE.Mesh(ownGeometry(g),m);node.name=name;node.castShadow=node.receiveShadow=true;return node;}
  const sourceGroup=new THREE.Group(),parts=[];
  for(const [index,id] of ['sedge','fern','flower-shrub'].entries()){
    const part=new THREE.Group();part.userData.id=id;part.position.set(index*3+7,2,-4);part.rotation.y=.23;sourceGroup.add(part);parts.push(part);
    const stem=new THREE.CylinderGeometry(.025,.04,.2,8);stem.translate(0,.075,0);part.add(mesh(stem,wood,id+'-root'));
    const child=new THREE.Group();child.rotation.y=index*.6;part.add(child);
    const blade=new THREE.PlaneGeometry(.25,.45,3,4);blade.translate(0,.30,0);child.add(mesh(blade,leaf,id+'-actual-leaf'));
  }
  let ownerDisposed=false;
  const sourceOwner={group:sourceGroup,parts,diagnostics:{id:'fixture-understory'},dispose(){if(ownerDisposed)return;ownerDisposed=true;events.owner++;for(const p of parts)p.traverse(n=>{if(n.isMesh)n.geometry.dispose();});leaf.dispose();wood.dispose();sourceGroup.clear();}};
  const pilotGroup=new THREE.Group(),pilotParts=[];
  for(const [id,x,z] of [['willow-a',98,-194],['willow-b',108,-194]]){
    const part=new THREE.Group();part.userData={placementId:id,species:'willow'};part.position.set(x,height(x,z)-.03,z);const g=new THREE.CylinderGeometry(.12,.2,.35,8);g.translate(0,-.08,0);part.add(mesh(g,wood,'willow-trunk-and-roots'));pilotGroup.add(part);pilotParts.push(part);
  }
  const rockPart=new THREE.Group();rockPart.userData={placementId:'existing-stone',species:'lake-rock'};rockPart.position.set(140,9,-230);rockPart.rotation.set(.13,.7,0);rockPart.scale.setScalar(1.7);const rock=new THREE.BoxGeometry(1.8,3,.8,2,3,2);rock.translate(-.2,1.5,0);rockPart.add(mesh(rock,stoneMat,'lake-rock-main'));pilotGroup.add(rockPart);pilotParts.push(rockPart);
  sourceGroup.updateMatrixWorld(true);pilotGroup.updateMatrixWorld(true);
  let pilotDisposed=false;const pilot={group:pilotGroup,parts:pilotParts,dispose(){if(pilotDisposed)return;pilotDisposed=true;events.owner++;for(const p of pilotParts)p.traverse(n=>{if(n.isMesh)n.geometry.dispose();});stoneMat.dispose();texture.dispose();pilotGroup.clear();}};
  return {terrain,sourceOwner,pilot,events,texture,geoms,mats,cleanup(){sourceOwner.dispose();pilot.dispose();sampler.dispose();soil.dispose();}};
}
async function build(f,extra={}){return createXianfaShoreCommunity({terrain:f.terrain,plantingPilot:f.pilot,understoryOwner:f.sourceOwner,layout:layout(),garden,yieldControl:async()=>{},...extra});}

test('the pure 24 metre plan preserves two windows, distinct drifts, null heights and positive poses',()=>{
  const a=createXianfaShoreCommunityLayout(),b=createXianfaShoreCommunityLayout();assert.deepEqual(a,b);assert.equal(a.placements.length,62);assert.equal(a.contextIds.length,2);assert.equal(a.clearings.length,2);
  assert.equal(new Set(a.placements.map(p=>p.id)).size,62);assert.ok(new Set(a.placements.map(p=>p.drift)).size>=9);
  for(const p of a.placements){assert.equal(p.position[1],null);assert.ok(p.scale>0);assert.ok(Number.isFinite(p.yaw));}
  assert.equal(a.placements.reduce((n,p)=>n+xianfaShoreCommunitySpec.triangleCounts[p.species],0),17866744);
  a.placements[0].position[0]=0;assert.notDeepEqual(a,b);
});

test('actual sloping triangles ground every root and preserve exact borrowed geometry, UV, materials and context identity',async()=>{
  const f=fixtures(),oldWillows=f.pilot.parts.slice(0,2).map(p=>[p.parent,[...p.matrixWorld.elements]]);let result;
  try{
    result=await build(f);assert.equal(result.diagnostics.rejected.length,0);assert.equal(result.contextGroups[0],f.pilot.parts[0]);assert.equal(result.contextGroups[1],f.pilot.parts[1]);assert.equal(result.diagnostics.sourceFactoriesConstructed,0);
    assert.ok(f.terrain.queries.length>100);assert.ok(result.diagnostics.placements.every(p=>p.grounding.maximumRootGap<=0));
    for(const p of result.diagnostics.placements){assert.ok(p.grounding.rootVertices>0);if(p.species!=='lake-rock'){assert.ok(p.grounding.minimumFoliageGap>0);assert.equal(p.grounding.centre.geometry,'actual-fixture-ground-triangles');}else assert.ok(p.grounding.rootWitnesses.length>=3);}
    let expected=0;for(const binding of result.bindings){assert.equal(binding.drawMesh.geometry,binding.sourceMesh.geometry);assert.equal(binding.drawMesh.geometry.attributes.uv,binding.sourceMesh.geometry.attributes.uv);assert.equal(binding.drawMesh.material,binding.sourceMesh.material);assert.equal(binding.drawMesh.castShadow,true);assert.equal(binding.drawMesh.receiveShadow,true);assert.ok(binding.matrix.determinant()>0);expected+=(binding.sourceMesh.geometry.index.count)/3;}
    assert.equal(result.diagnostics.trianglesPerPass,expected);assert.ok(result.diagnostics.drawMeshes<result.bindings.length);assert.equal(result.diagnostics.ownedInstanceBufferBytes,result.bindings.length*64);
    for(let i=0;i<2;i++){assert.equal(f.pilot.parts[i].parent,oldWillows[i][0]);assert.deepEqual(f.pilot.parts[i].matrixWorld.elements,oldWillows[i][1]);}
    const instanceEvents=new Map();result.group.traverse(n=>{if(n.isInstancedMesh){instanceEvents.set(n,0);n.addEventListener('dispose',()=>instanceEvents.set(n,instanceEvents.get(n)+1));}});
    result.dispose();result.dispose();assert.ok([...instanceEvents.values()].every(n=>n===1));assert.equal(result.contextGroups.length,0);assert.deepEqual(f.events,{geometry:0,material:0,texture:0,owner:0});
  }finally{result?.dispose();f.cleanup();}
});

test('instance projection, normals and conservative culling bounds keep the actual source placement',async()=>{
  const f=fixtures();let result;
  try{
    // A legal positive nonuniform source basis must preserve its normals too.
    f.sourceOwner.parts[1].children[1].scale.set(1.13,.88,1.21);
    result=await build(f);const point=v(),expected=v(),normal=v(),actualNormal=v(),world=new THREE.Matrix4(),cam=new THREE.PerspectiveCamera(45,1.5,.05,300);cam.position.set(102,8,-187);cam.lookAt(103,4,-201);cam.updateMatrixWorld();
    for(const binding of result.bindings){
      const placed=result.diagnostics.placements.find(p=>p.id===binding.placementId),part=binding.sourceMesh.parent;let ancestor=part;while(ancestor&&!ancestor.userData.id&&!ancestor.userData.species)ancestor=ancestor.parent;
      const local=new THREE.Matrix4().multiplyMatrices(ancestor.matrixWorld.clone().invert(),binding.sourceMesh.matrixWorld),reference=new THREE.Matrix4().fromArray(placed.worldMatrix).multiply(local);world.multiplyMatrices(binding.drawMesh.matrixWorld,binding.matrix);
      const p=binding.sourceMesh.geometry.attributes.position,n=binding.sourceMesh.geometry.attributes.normal,box=binding.drawMesh.boundingBox.clone().applyMatrix4(binding.drawMesh.matrixWorld).expandByScalar(1e-6),sphere=binding.drawMesh.boundingSphere.clone().applyMatrix4(binding.drawMesh.matrixWorld);
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(world);expected.fromBufferAttribute(p,i).applyMatrix4(reference);assert.ok(point.distanceTo(expected)<2e-6);assert.ok(box.containsPoint(point));assert.ok(point.distanceTo(sphere.center)<=sphere.radius+1e-6);
        const a=point.clone().project(cam),b=expected.clone().project(cam);assert.ok(a.distanceTo(b)<1e-6);
        normal.fromBufferAttribute(n,i).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(reference));actualNormal.fromBufferAttribute(n,i).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(world));assert.ok(normal.dot(actualNormal)>.999999999);
      }
    }
  }finally{result?.dispose();f.cleanup();}
});

test('two detached collision sources exactly match drawn stone transforms and feed the existing convex-band interface',async()=>{
  const f=fixtures();let result,colliders;
  try{
    result=await build(f);assert.equal(result.collisionSources.parts.length,2);assert.equal(result.collisionSources.group.parent,null);
    for(const part of result.collisionSources.parts){const mesh=part.getObjectByName('lake-rock-main'),binding=result.bindings.find(b=>b.placementId===part.userData.placementId);assert.equal(mesh.geometry,binding.drawMesh.geometry);assert.equal(mesh.material,binding.drawMesh.material);assert.equal(mesh.material.map,f.texture);assert.deepEqual(mesh.matrixWorld.elements,new THREE.Matrix4().multiplyMatrices(binding.drawMesh.matrixWorld,binding.matrix).elements);}
    colliders=createMuseumPlantingColliders(result.collisionSources,{terrain:f.terrain});assert.equal(colliders.diagnostics.sourceMeshCount,2);assert.equal(colliders.diagnostics.leavesRead,false);assert.equal(colliders.diagnostics.bvhConstructed,false);assert.ok(colliders.solids.length>2);assert.ok(colliders.solids.every(s=>s.walkable===false));
  }finally{colliders?.dispose();result?.dispose();f.cleanup();}
});

test('whole foliage reservations reject a road or water even when the root centre is dry',async()=>{
  for(const kind of ['path','water']){
    const f=fixtures({slopeX:0,slopeZ:0});try{
      const ring=[[100.08,-200.1],[100.18,-200.1],[100.18,-199.9],[100.08,-199.9]];
      if(kind==='path')f.terrain.paths.push({id:'current-road',polygon:ring});else f.terrain.waterSurfaces.push({id:'current-pond',polygon:ring,holes:[]});
      await assert.rejects(build(f),error=>error.diagnostics?.rejected.some(r=>r.id==='fixture-0'&&/road|pond/.test(r.message)));
      assert.deepEqual(f.events,{geometry:0,material:0,texture:0,owner:0});
    }finally{f.cleanup();}
  }
});

test('water holes retain real dry islands while their boundary still excludes the full footprint',async()=>{
  const f=fixtures({slopeX:0,slopeZ:0});let result;
  try{
    f.terrain.waterSurfaces.push({id:'wet-ring',polygon:square(103,-201,30),holes:[square(103,-201,14)]});result=await build(f);assert.equal(result.diagnostics.rejected.length,0);result.dispose();
    f.terrain.waterSurfaces[0].holes=[square(103,-201,.5)];await assert.rejects(build(f),/rejected placements/);
  }finally{result?.dispose();f.cleanup();}
});

test('actual root overlap and wrong supports fail explicitly without moving an anchor or disposing sources',async()=>{
  const f=fixtures();try{
    const close=layout();close.placements[1].position=[...close.placements[0].position];await assert.rejects(build(f,{layout:close}),e=>e.diagnostics?.rejected.some(r=>/Root collar overlaps/.test(r.message)));
    const original=f.terrain.surfaceAt.bind(f.terrain);f.terrain.surfaceAt=(x,z,options)=>({...original(x,z,options),supportSource:'layout-height-estimate'});await assert.rejects(build(f),/No current dry terrain triangle/);assert.equal(f.events.owner,0);
  }finally{f.cleanup();}
});

test('abort and terrain revision change after a yield preserve all borrowed owners',async()=>{
  for(const mode of ['abort','revision']){
    const f=fixtures(),controller=new AbortController();let calls=0;try{
      await assert.rejects(build(f,{signal:controller.signal,yieldControl:async()=>{if(++calls===1){if(mode==='abort')controller.abort();else f.terrain.revision++;}}}),mode==='abort'?/abort/i:/Terrain revision changed/);
      assert.deepEqual(f.events,{geometry:0,material:0,texture:0,owner:0});
    }finally{f.cleanup();}
  }
});

test('a disposed borrowed source invalidates drawing but the community never destroys the other owner',async()=>{
  const f=fixtures();let result;
  try{result=await build(f);f.sourceOwner.dispose();assert.equal(result.group.visible,false);assert.equal(result.diagnostics.borrowedSourceInvalidated,true);assert.equal(f.events.owner,1);result.dispose();assert.equal(f.events.owner,1);assert.equal(f.events.texture,0);}finally{result?.dispose();f.cleanup();}
});

test('negative scales and sheared source bases are rejected instead of changing normals',async()=>{
  const f=fixtures();try{
    const mirrored=layout();mirrored.placements[0].scale=-1;await assert.rejects(build(f,{layout:mirrored}),/Invalid shoreline placement/);
    const child=f.sourceOwner.parts[0].children[1];child.matrixAutoUpdate=false;child.matrix.makeShear(.2,0,0,0,0,0);await assert.rejects(build(f),/Sheared source transform/);assert.equal(f.events.owner,0);
  }finally{f.cleanup();}
});

test('independent borrowed texture disposal also invalidates drawing without destroying its owner',async()=>{
  const f=fixtures();let result;
  try{result=await build(f);f.texture.dispose();assert.equal(result.group.visible,false);assert.equal(result.diagnostics.borrowedSourceInvalidated,true);result.dispose();assert.equal(f.events.owner,0);assert.equal(f.events.geometry,0);assert.equal(f.events.material,0);}finally{result?.dispose();f.cleanup();}
});

test('an actual soil triangle rising under a leaf rejects the plant even when its root collar is clear',async()=>{
  const f=fixtures({slopeX:0,slopeZ:0}),raised=new THREE.BufferGeometry();raised.name='real-small-soil-rise';raised.setAttribute('position',new THREE.Float32BufferAttribute([100.07,4.8,-200.12,100.18,4.8,-200.12,100.18,4.8,-199.88,100.07,4.8,-199.88],3));raised.setIndex([0,2,1,0,3,2]);
  const sampler=createTriangleSampler([raised],1),base=f.terrain.surfaceAt.bind(f.terrain);
  f.terrain.surfaceAt=(x,z,options)=>{const a=base(x,z,options),b=sampler.sample(x,z);return b&&b.height>a.height?{...b,kind:'land',walkable:true,supportSource:'terrain-triangle'}:a;};
  try{await assert.rejects(build(f),e=>e.diagnostics?.rejected.some(r=>r.id==='fixture-0'&&/foliage enters actual soil/.test(r.message)));assert.equal(f.events.owner,0);}finally{sampler.dispose();raised.dispose();f.cleanup();}
});
