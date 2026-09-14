import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WebGLObjects} from 'three/src/renderers/webgl/WebGLObjects.js';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {gardenLayout} from '../src/yuanmingyuan/garden-layout.js';
import {museumSites} from '../src/yuanmingyuan/museum-sites.js';
import {
  westernGardenPlantingSpec,createWesternGardenPlantingLayout,
  createWesternGardenPlantingPlan,createWesternGardenPlantingSources,
  createWesternGardenPlantingRegion,
} from '../src/yuanmingyuan/western-garden-planting.js';

const rectangle=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const close=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,a+' != '+b);
const layout=createWesternGardenPlantingLayout();
function groundGeometry(x0,z0,x1,z1,height,name){
  const g=new THREE.BufferGeometry();g.name=name;
  g.setAttribute('position',new THREE.Float32BufferAttribute(rectangle(x0,z0,x1,z1).flatMap(([x,z])=>[x,height(x,z),z]),3));
  g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();return g;
}
function terrainFixture({slope=.004,kind='land',supportSource='terrain-triangle',waterY,rootPatch}={}){
  const geometry=groundGeometry(330,-710,610,-480,x=>7.25+(x-330)*slope,'western-fixture-float32-ground');
  const sampler=createTriangleSampler([geometry]),patch=rootPatch&&groundGeometry(...rootPatch.bounds,()=>rootPatch.height,'western-fixture-real-root-corner-patch');
  const patchSampler=patch&&createTriangleSampler([patch]);let disposed=false,queries=0;
  return {geometry,patch,paths:[],courtFootprints:[],waterSurfaces:structuredClone(gardenLayout.waterBodies),revision:0,
    surfaceAt(x,z){queries++;const hit=patchSampler?.sample(x,z)??sampler.sample(x,z);return hit?{...hit,kind,walkable:true,supportSource,...(waterY===undefined?{}:{waterY})}:null;},
    get disposed(){return disposed;},get queries(){return queries;},
    dispose(){if(disposed)return;disposed=true;sampler.dispose();geometry.dispose();patchSampler?.dispose();patch?.dispose();}};
}
function architectureFixture(block){
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(.08,2,.08),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(...(block??[300,9,-720]));group.add(mesh);group.updateMatrixWorld(true);
  const owner=createArchitectureSurface(group),dispose=owner.dispose;
  owner.dispose=()=>{dispose();geometry.dispose();material.dispose();group.clear();};return owner;
}
function fixtureSources(){
  const rootNames={juniper:'juniper-visible-trunk',willow:'willow-trunk-and-roots','lake-rock':'lake-rock-main'};
  const ids=['juniper','willow','lake-rock','sedge','fern','flower-shrub'],counts=new Map(),resources=[];
  const track=r=>{resources.push(r);counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));return r;};
  const pilotGroup=new THREE.Group(),underGroup=new THREE.Group(),pilotParts=[],underParts=[];
  const texture=track(new THREE.DataTexture(new Uint8Array([92,139,71,255]),1,1,THREE.RGBAFormat));
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=track(new THREE.MeshStandardMaterial({color:'#ffffff',map:texture,roughness:.76,vertexColors:true,side:THREE.DoubleSide}));
  for(const id of ids){
    const part=new THREE.Group();part.name='source-'+id;part.userData.id=id;
    const geometry=track(new THREE.BoxGeometry(.20,.30,.18));geometry.translate(0,.10,0);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:geometry.attributes.position.count},()=>[.55,.73,.31]).flat(),3));
    const root=new THREE.Mesh(geometry,material);root.name=rootNames[id]??id+'-root';root.castShadow=root.receiveShadow=true;part.add(root);
    const leafGeometry=track(new THREE.SphereGeometry(.025,6,4)),leaf=track(new THREE.InstancedMesh(leafGeometry,material,3));leaf.name=id+'-unchanged-instances';leaf.castShadow=leaf.receiveShadow=true;
    for(let i=0;i<3;i++){leaf.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3((i-1)*.05,.34,.03*i),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),i*.3),new THREE.Vector3(1,.8,1.1)));leaf.setColorAt(i,new THREE.Color().setRGB(.4+i*.1,.7,.3));}
    leaf.computeBoundingBox();leaf.computeBoundingSphere();part.add(leaf);
    if(rootNames[id]){
      const placed=new THREE.Group();placed.userData={species:id,placementId:'existing-'+id};placed.position.set(40,5,-20);placed.rotation.y=.72;placed.scale.setScalar(1.7);placed.add(part);pilotParts.push(placed);pilotGroup.add(placed);
    }else{part.position.set(.6,0,.2);underParts.push(part);underGroup.add(part);}
  }
  let disposed=false;
  // Fixture owners share this material owner; the test disposes them together.
  const owner={dispose(){if(disposed)return;disposed=true;for(const r of resources)r.dispose();pilotGroup.clear();underGroup.clear();},get disposed(){return disposed;}};
  const plantingPilot={group:pilotGroup,parts:pilotParts,dispose:owner.dispose,get disposed(){return disposed;}},understoryOwner={group:underGroup,parts:underParts,dispose:owner.dispose,get disposed(){return disposed;}};
  pilotGroup.updateMatrixWorld(true);underGroup.updateMatrixWorld(true);
  return {sources:createWesternGardenPlantingSources({plantingPilot,understoryOwner}),plantingPilot,understoryOwner,counts,resources,dispose:owner.dispose};
}

test('pure regional layout keeps three actual frames, unequal shore groups and reserved axes',()=>{
  const before=JSON.stringify({gardenLayout,museumSites}),a=createWesternGardenPlantingLayout(),b=createWesternGardenPlantingLayout();
  assert.deepEqual(a,b);assert.equal(JSON.stringify({gardenLayout,museumSites}),before);
  assert.equal(a.regions.length,5);assert.equal(a.regions.reduce((n,r)=>n+r.placements.length,0),47);
  const placements=a.regions.flatMap(r=>r.placements),counts={};
  for(const p of placements){counts[p.species]=(counts[p.species]??0)+1;assert.equal(p.position[1],null);assert.equal(p.evidence.surveyed,false);}
  assert.deepEqual(counts,{juniper:6,'lake-rock':3,fern:2,'flower-shrub':3,sedge:30,willow:3});
  assert.equal(new Set(placements.map(p=>p.id)).size,placements.length);
  assert.equal(a.regions.find(r=>r.id==='lake-west-pair').placements.filter(p=>p.species==='willow').length,2);
  assert.equal(a.regions.find(r=>r.id==='lake-east-single').placements.filter(p=>p.species==='willow').length,1);
  for(const id of ['xieqiqu-north','yangquelong-west','fangwaiguan-front']){
    const pair=a.regions.find(r=>r.id===id).placements.filter(p=>p.species==='juniper');assert.equal(pair.length,2);assert.equal(pair[0].scale,pair[1].scale);
  }
  assert.equal(a.historicallySurveyed,false);assert.equal(a.nativeCompositionReviewed,false);
  assert.equal(westernGardenPlantingSpec.sourceTriangles.willow,7925316);
});

test('all five region plans use actual Float32 triangle heights and preserve current water/axes',()=>{
  const terrain=terrainFixture(),architecture=architectureFixture(),material=new THREE.MeshBasicMaterial(),ground=new THREE.Mesh(terrain.geometry,material);ground.updateMatrixWorld(true);
  try{
    for(const region of layout.regions){
      const plan=createWesternGardenPlantingPlan({regionId:region.id,terrain,architecture,plantingLayout:layout});
      assert.deepEqual(plan.rejected,[]);assert.equal(plan.valid,true);assert.equal(plan.placements.length,region.placements.length);
      for(const p of plan.placements){assert.ok(p.position[1]>7);assert.equal(p.grounding.samples.length,17);
        for(const sample of p.grounding.samples){const hit=new THREE.Raycaster(new THREE.Vector3(sample.x,30,sample.z),new THREE.Vector3(0,-1,0)).intersectObject(ground)[0];assert.ok(hit);close(hit.point.y,sample.height);assert.equal(sample.geometry,terrain.geometry.name);}
      }
    }
  }finally{terrain.dispose();architecture.dispose();material.dispose();}
});

test('a thin path, water edge or court crossing only the crown rejects before borrowing a source',async()=>{
  const region=layout.regions[0],p=region.placements[0],[x,,z]=p.position;
  for(const kind of ['paths','waterSurfaces','courtFootprints']){
    const terrain=terrainFixture(),architecture=architectureFixture();terrain[kind].push({id:'thin-real-'+kind,polygon:rectangle(x+2.1,z-3,x+2.13,z+3)});
    const sources=new Proxy({},{get(){throw new Error('source must not be touched');}});
    try{await assert.rejects(createWesternGardenPlantingRegion({regionId:region.id,terrain,architecture,sources}),e=>e.plan.rejected.some(r=>r.id===p.id&&r.reasons.some(r=>r.kind==='reserved-footprint')));}
    finally{terrain.dispose();architecture.dispose();}
  }
});

test('actual narrow architectural triangles inside the crown volume block a clear centre/root footprint',()=>{
  const p=layout.regions[0].placements[0],[x,,z]=p.position,terrain=terrainFixture(),architecture=architectureFixture([x+1.8,8.25,z]);
  try{
    const plan=createWesternGardenPlantingPlan({regionId:layout.regions[0].id,terrain,architecture});
    const failed=plan.rejected.find(r=>r.id===p.id);assert.ok(failed.reasons.some(r=>r.kind==='actual-architecture-volume'));assert.equal(failed.reasons.some(r=>r.kind==='support-query'),false);
  }finally{terrain.dispose();architecture.dispose();}
});

test('capture diagnostics never retain terrain geometry or source-owner buffers through reservations',()=>{
  const terrain=terrainFixture(),architecture=architectureFixture();
  terrain.waterSurfaces[0].geometry={toJSON(){throw new Error('Do not serialize the original water mesh.');}};
  try{
    const plan=createWesternGardenPlantingPlan({regionId:'xieqiqu-north',terrain,architecture});
    assert.ok(plan.reservations.every(r=>!('geometry' in r)));
    assert.ok(JSON.stringify(plan).length<100000);
  }finally{terrain.dispose();architecture.dispose();}
});

test('unknown regions, missing live queries, duplicate IDs, wet/steep/estimated support fail explicitly',()=>{
  const architecture=architectureFixture(),terrain=terrainFixture();
  try{
    assert.throws(()=>createWesternGardenPlantingPlan({regionId:'missing',terrain,architecture}),/Unknown/);
    assert.throws(()=>createWesternGardenPlantingPlan({regionId:layout.regions[0].id,terrain}),/architecture/);
    assert.throws(()=>createWesternGardenPlantingPlan({regionId:layout.regions[0].id,terrain:{surfaceAt:()=>null},architecture}),/live terrain/);
    const altered=structuredClone(layout);altered.regions[0].placements[1].id=altered.regions[0].placements[0].id;
    assert.throws(()=>createWesternGardenPlantingPlan({regionId:altered.regions[0].id,terrain,architecture,plantingLayout:altered}),/unique/);
    assert.throws(()=>createWesternGardenPlantingPlan({regionId:layout.regions[0].id,terrain,architecture,reservedPolygons:[{polygon:[[0,0],[1,1],[2,2]]}]}),/Degenerate/);
    for(const options of [{kind:'exhibition-ground-path'},{supportSource:'layout-estimate'},{waterY:10},{slope:1}]){
      const invalid=terrainFixture(options);try{assert.equal(createWesternGardenPlantingPlan({regionId:layout.regions[0].id,terrain:invalid,architecture}).valid,false);}finally{invalid.dispose();}
    }
  }finally{terrain.dispose();architecture.dispose();}
});

test('one requested region reuses source PBR/buffers/matrices and ignores unrequested willow sources',async()=>{
  const terrain=terrainFixture(),architecture=architectureFixture(),source=fixtureSources();let region;
  try{
    Object.defineProperty(source.sources,'willow',{get(){throw new Error('Unrequested willow was accessed.');}});
    const originalMatrices=source.plantingPilot.parts.map(p=>p.matrixWorld.toArray()),before=source.resources.filter(r=>r.isBufferGeometry).map(g=>Buffer.from(g.attributes.position.array.buffer).toString('base64'));
    region=await createWesternGardenPlantingRegion({regionId:'xieqiqu-north',terrain,architecture,sources:source.sources,yieldControl:async()=>{}});
    assert.equal(region.parts.length,11);assert.equal(region.collisionSources.parts.length,3);assert.equal(region.diagnostics.ownedGeometries,0);assert.equal(region.diagnostics.ownedTextures,0);assert.equal(region.diagnostics.borrowedSpecies.includes('willow'),false);
    for(const part of region.parts){
      const original=source.sources[part.userData.species].part,actual=part.children[0],aNodes=[],bNodes=[];original.traverse(n=>{if(n.isMesh)aNodes.push(n);});actual.traverse(n=>{if(n.isMesh)bNodes.push(n);});
      assert.equal(aNodes.length,bNodes.length);assert.deepEqual(actual.position.toArray(),[0,0,0]);
      for(let i=0;i<aNodes.length;i++){
        const a=aNodes[i],b=bNodes[i];assert.equal(a.geometry,b.geometry);assert.equal(a.material,b.material);assert.equal(a.castShadow,b.castShadow);assert.equal(a.receiveShadow,b.receiveShadow);assert.equal(a.frustumCulled,b.frustumCulled);
        if(a.isInstancedMesh){assert.equal(a.instanceMatrix,b.instanceMatrix);assert.equal(a.instanceColor,b.instanceColor);assert.equal(a.count,b.count);
          const m=new THREE.Matrix4(),expected=new THREE.Matrix4(),actualMatrix=new THREE.Matrix4();
          for(let k=0;k<a.count;k++){a.getMatrixAt(k,m);expected.multiplyMatrices(part.matrixWorld,m);b.getMatrixAt(k,actualMatrix);actualMatrix.premultiply(b.matrixWorld);for(let c=0;c<16;c++)close(actualMatrix.elements[c],expected.elements[c],1e-10);}
        }
      }
      assert.ok(region.plan.placements.find(p=>p.id===part.userData.placementId).grounding.maximumRootGap<=0);
    }
    assert.deepEqual(source.plantingPilot.parts.map(p=>p.matrixWorld.toArray()),originalMatrices);
    assert.deepEqual(source.resources.filter(r=>r.isBufferGeometry).map(g=>Buffer.from(g.attributes.position.array.buffer).toString('base64')),before);
    region.dispose();region.dispose();assert.ok(source.resources.every(r=>source.counts.get(r)===0));
  }finally{region?.dispose();source.dispose();architecture.dispose();terrain.dispose();}
  assert.ok(source.resources.every(r=>source.counts.get(r)===1));
});

test('an actual below-datum root corner missed by the 17-point preflight is grounded with a real replacement triangle',async()=>{
  const p=layout.regions[0].placements[0],[x,,z]=p.position;
  // The fixture source rotates .14 radians. Its +X/+Z bottom corner falls
  // away from both the centre and the 0.68 m sampling ring.
  const corner=new THREE.Vector3(.1,-.05,.09).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw);
  const terrain=terrainFixture({slope:0,rootPatch:{bounds:[x+corner.x-.006,z+corner.z-.006,x+corner.x+.006,z+corner.z+.006],height:7.13}}),architecture=architectureFixture(),sources=fixtureSources();let region;
  try{
    const pre=createWesternGardenPlantingPlan({regionId:'xieqiqu-north',terrain,architecture});
    assert.equal(pre.valid,true);for(const sample of pre.placements[0].grounding.samples){close(sample.height,7.25);assert.equal(sample.geometry,terrain.geometry.name);}
    region=await createWesternGardenPlantingRegion({regionId:'xieqiqu-north',terrain,architecture,sources:sources.sources,yieldControl:async()=>{}});
    assert.ok(region.parts[0].position.y<pre.placements[0].position[1]-.05);
    assert.ok(region.plan.placements[0].grounding.actualRootVertices>0);assert.ok(region.plan.placements[0].grounding.maximumRootGap<=-.0039);
  }finally{region?.dispose();sources.dispose();architecture.dispose();terrain.dispose();}
});

test('r185 per-view disposal releases VAOs without deleting shared live instance buffers',async()=>{
  const terrain=terrainFixture(),architecture=architectureFixture(),sources=fixtureSources(),live=new Set(),removed=new Set(),released=new Set();
  const objects=WebGLObjects({}, {get(_o,g){return g;},update(){}},{update(a){live.add(a);},remove(a){if(live.delete(a))removed.add(a);}},{releaseStatesOfObject(o){released.add(o);}},{render:{frame:1}});
  const regions=[],originalInstances=[];
  try{
    for(const source of Object.values(sources.sources))source.part.traverse(n=>{if(n.isInstancedMesh){originalInstances.push(n);objects.update(n);}});
    for(const regionId of ['xieqiqu-north','yangquelong-west']){
      const region=await createWesternGardenPlantingRegion({regionId,terrain,architecture,sources:sources.sources,yieldControl:async()=>{}});regions.push(region);region.group.traverse(n=>{if(n.isInstancedMesh)objects.update(n);});
    }
    const shared=originalInstances.flatMap(n=>[n.instanceMatrix,n.instanceColor]),aViews=[];regions[0].group.traverse(n=>{if(n.isInstancedMesh)aViews.push(n);});
    regions[0].dispose();assert.equal(released.size,aViews.length);assert.ok(shared.every(a=>live.has(a)));assert.equal(removed.size,0);
    regions[1].dispose();assert.ok(shared.every(a=>live.has(a)));assert.equal(removed.size,0);
    sources.dispose();assert.equal(live.size,0);assert.equal(removed.size,shared.length);
  }finally{regions.forEach(r=>r.dispose());sources.dispose();objects.dispose();architecture.dispose();terrain.dispose();}
});

test('abort or changed terrain during a regional prepare rolls back views and leaves borrowed owners untouched',async()=>{
  for(const mode of ['abort','revision','road']){
    const terrain=terrainFixture(),architecture=architectureFixture(),sources=fixtureSources(),controller=new AbortController();let calls=0;
    try{
      await assert.rejects(createWesternGardenPlantingRegion({regionId:'xieqiqu-north',terrain,architecture,sources:sources.sources,signal:controller.signal,yieldControl:async()=>{
        if(++calls!==1)return;if(mode==='abort')controller.abort(new Error('cancel regional preparation'));else if(mode==='revision')terrain.revision++;else terrain.paths.push({id:'new-road',polygon:rectangle(370,-626,380,-622)});
      }}),mode==='abort'?/cancel regional/:/support\/owner changed/);
      assert.ok(sources.resources.every(r=>sources.counts.get(r)===0));
    }finally{sources.dispose();architecture.dispose();terrain.dispose();}
  }
});

test('late missing or oversized source rejects instead of reducing it or leaving partial views',async()=>{
  for(const mode of ['missing','oversized']){
    const terrain=terrainFixture(),architecture=architectureFixture(),sources=fixtureSources();
    try{
      if(mode==='missing')delete sources.sources.fern;
      else sources.sources.fern.part.children[0].scale.setScalar(100);
      await assert.rejects(createWesternGardenPlantingRegion({regionId:'xieqiqu-north',terrain,architecture,sources:sources.sources,yieldControl:async()=>{}}),mode==='missing'?/Missing live reviewed/:/outgrew/);
      assert.ok(sources.resources.every(r=>sources.counts.get(r)===0));
    }finally{sources.dispose();architecture.dispose();terrain.dispose();}
  }
});

test('borrowed resource disposal detaches the region; stale terrain is never silently shown',async()=>{
  const terrain=terrainFixture(),architecture=architectureFixture(),sources=fixtureSources(),scene=new THREE.Scene();
  const region=await createWesternGardenPlantingRegion({regionId:'xieqiqu-north',terrain,architecture,sources:sources.sources,yieldControl:async()=>{}});
  try{
    scene.add(region.group);assert.equal(region.assertCurrent(),true);
    terrain.revision++;assert.throws(()=>region.assertCurrent(),/changed/);assert.equal(region.group.visible,false);
    sources.dispose();assert.equal(region.disposed,true);assert.equal(region.diagnostics.borrowedSourceInvalidated,true);assert.equal(region.group.parent,null);
    assert.ok(sources.resources.every(r=>sources.counts.get(r)===1));region.dispose();
  }finally{region.dispose();sources.dispose();architecture.dispose();terrain.dispose();}
});

test('a changed architecture dispatcher is queried again before displaying an already prepared region',async()=>{
  const terrain=terrainFixture(),architecture=architectureFixture(),sources=fixtureSources();let blocked=false,throws=false,calls=0;
  const dispatcher={intersectsGuideVolume(v){calls++;if(throws)throw new Error('expired architecture query');return blocked||architecture.intersectsGuideVolume(v);}};
  const region=await createWesternGardenPlantingRegion({regionId:'yangquelong-west',terrain,architecture:dispatcher,sources:sources.sources,yieldControl:async()=>{}});
  try{
    const before=calls;assert.equal(region.assertCurrent(),true);assert.ok(calls>before);
    blocked=true;assert.throws(()=>region.assertCurrent(),/architecture changed/);assert.equal(region.group.visible,false);
    blocked=false;throws=true;region.group.visible=true;assert.throws(()=>region.assertCurrent(),/expired architecture query/);assert.equal(region.group.visible,false);
  }finally{region.dispose();sources.dispose();architecture.dispose();terrain.dispose();}
});
