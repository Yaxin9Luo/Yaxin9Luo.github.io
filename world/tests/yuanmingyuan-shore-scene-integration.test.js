import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {createXianfaShoreCommunity,createXianfaShoreCommunityLayout} from '../src/yuanmingyuan/xianfa-shore-community.js';
import {createMuseumPlantingColliders} from '../src/yuanmingyuan/museum-planting-colliders.js';
import {createMuseumLandscape} from '../src/yuanmingyuan/museum-landscape.js';

// Execute the page's actual planting branch, error handler, review controls,
// telemetry slice and page-exit function. Replace only source factories with
// small actual Three surfaces, browser services and dynamic import resolution.
// No source factory, terrain factory, renderer or archive is invoked.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const sceneSHA256=createHash('sha256').update(source).digest('hex');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Actual scene section exists: '+start);return source.slice(a,b);}
const branch=section("  if(!composition&&query.get('planting')==='pilot'){",'\n  busy(false);await visit(').replaceAll(/\bimport\(/g,'injectedImport(');
const lastCatch=source.slice(source.lastIndexOf('}catch(error){if(!disposed){'));
const plantingCollision=section('function currentPlantingCollision(){','\nasync function prepareSceneShoreBank(');
const exitFunction=section('function releaseSceneGuides(){','\nfunction releaseCompositionScene(')+'\n'+section('function dispose(){',"\naddEventListener('pagehide'");
const telemetry=section('  const planting=plantingPilot?.diagnostics;','\n  data.terrainAssets=');
assert.ok(lastCatch.startsWith('}catch(error)'));
const square=(x,z,r)=>[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

function harness({shore=true,planting=true,failAt=null,throwDuringCleanup=false,lateShore=false}={}){
  const events=[],errors=[],messages=[],buttons=[],sourceResources=[],owners=[],snapshots=[],gate=deferred(),entered=deferred();
  const scene=new THREE.Scene(),marker=new THREE.Group();marker.name='unrelated-world-context';scene.add(marker);
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,insertBefore(button){if(failAt==='review-ui')throw new Error('fixture-review-ui-failure');buttons.push(button);}});return nodes.get(id);};
  const controller=new AbortController(),soil=new THREE.BufferGeometry();soil.name='small-real-world-soil';soil.setAttribute('position',new THREE.Float32BufferAttribute([800,4,-720,980,4,-720,980,4,-530,800,4,-530],3));soil.setIndex([0,2,1,0,3,2]);soil.computeVertexNormals();
  const sampler=createTriangleSampler([soil],32);let soilDisposed=false;
  const terrain={paths:[],courtFootprints:[],waterSurfaces:[],replacementStates:[],surfaceAt(x,z,{maxY=Infinity}={}){const hit=sampler.sample(x,z,maxY);return hit?{...hit,kind:'land',walkable:true,supportSource:'terrain-triangle'}:null;},dispose(){if(soilDisposed)return;soilDisposed=true;sampler.dispose();soil.dispose();}};
  function resource(resource){const row={resource,disposeEvents:0};resource.addEventListener('dispose',()=>row.disposeEvents++);sourceResources.push(row);return resource;}
  function own(tag,group,parts,resources,extra={}){
    let disposed=false;const owner={group,parts,...extra,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;events.push(tag);group.removeFromParent();group.clear();for(const item of resources)item.dispose();if(tag==='understory'&&throwDuringCleanup)throw new Error('fixture-understory-cleanup-failure');}};
    owners.push(owner);return owner;
  }
  function tinyPilot(){
    const group=new THREE.Group();group.name='museum-planting-pilot';const parts=[];
    const material=resource(new THREE.MeshStandardMaterial({color:'#698058'}));
    const wood=resource(new THREE.CylinderGeometry(.08,.15,.8,8));wood.translate(0,.3,0);
    const stone=resource(new THREE.BoxGeometry(1.8,3,.8,1,2,1));stone.translate(-.2,1.5,0);
    const leaf=resource(new THREE.PlaneGeometry(.06,.15));const owned=[wood,stone,leaf,material];
    const ids=createXianfaShoreCommunityLayout().contextIds,records=[
      [ids[0],'willow',841.6069187802522,-565.4681750094967],
      [ids[1],'willow',858.0291117243318,-570.9160713441667],
      ['juniper-a','juniper',909,-684],['juniper-b','juniper',909,-596],['juniper-c','juniper',939,-684],['juniper-d','juniper',939,-596],
      ['old-stone-a','lake-rock',884,-582],['old-stone-b','lake-rock',900,-580],
    ];
    for(const [i,[id,species,x,z]] of records.entries()){
      const part=new THREE.Group();part.name='museum-planting-'+id;part.userData={placementId:id,species};part.position.set(x,3.94,z);part.rotation.y=i*.37;part.scale.setScalar(.82+i*.017);
      const mesh=new THREE.Mesh(species==='lake-rock'?stone:wood,material);mesh.name=species==='lake-rock'?'lake-rock-main':species==='willow'?'willow-trunk-and-roots':'juniper-visible-trunk';part.add(mesh);
      if(species!=='lake-rock'){
        const crown=new THREE.InstancedMesh(leaf,material,2);crown.name=id+'-foliage';crown.setMatrixAt(0,new THREE.Matrix4().makeTranslation(.1,1,0));crown.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-.2,1.3,.1));part.add(crown);resource(crown);owned.push(crown);
      }
      group.add(part);parts.push(part);
    }
    group.updateMatrixWorld(true);
    const plan={placements:records.map(([id])=>({id}))},diagnostics={id:'tiny-pilot-integration-fixture',plan,rootContacts:[],trianglesPerPass:0,geometryAndInstanceBytes:0};
    const owner=own('pilot',group,parts,owned,{diagnostics,views:[{id:'pilot-whole',label:'tiny pilot',groups:[group.name],direction:[0,.3,1],padding:1.1}]});
    snapshots.push(...parts.map(part=>({part,parent:part.parent,matrix:part.matrixWorld.toArray()})));return owner;
  }
  function tinyUnderstory(options){
    assert.equal(options.arrangement,'specimens');options.signal.throwIfAborted();
    const group=new THREE.Group();group.name='garden-understory-study';const parts=[],owned=[];
    const stem=resource(new THREE.MeshStandardMaterial());stem.name='understory-fine-stems';const leaf=resource(new THREE.MeshStandardMaterial({side:THREE.DoubleSide,color:'#557333'}));leaf.name='understory-physical-leaf';owned.push(stem,leaf);
    for(const [i,id] of ['sedge','fern','flower-shrub'].entries()){
      const part=new THREE.Group();part.name='understory-'+id;part.userData.id=id;part.position.set([-1.25,0,1.28][i],0,0);
      const root=resource(new THREE.CylinderGeometry(.02,.035,.16,8));root.translate(0,.06,0);const blade=resource(new THREE.PlaneGeometry(.20,.25,2,2));blade.translate(0,.25,0);owned.push(root,blade);
      const rootMesh=new THREE.Mesh(root,stem);rootMesh.name=id+'-root';const bladeMesh=new THREE.Mesh(blade,leaf);bladeMesh.name=id+'-leaf';rootMesh.castShadow=bladeMesh.castShadow=true;part.add(rootMesh,bladeMesh);group.add(part);parts.push(part);
    }
    group.updateMatrixWorld(true);return own('understory',group,parts,owned,{diagnostics:{id:'tiny-understory-integration-fixture'}});
  }
  let actualCommunity=null,actualCollider=null;
  const ctx={composition:null,westernPlanting:null,westernPlantingLifetime:null,THREE,controller,terrain,scene,gardenLayout:createMuseumLandscape().layout,query:new URLSearchParams([planting?'planting=pilot':'',shore?'shore=1':'','review=still'].filter(Boolean).join('&')),lang:'zh',disposed:false,ready:false,loading:false,capturing:false,contextLost:false,
    plantingPilot:null,plantingCollisions:null,plantingReview:null,shoreCommunity:null,shoreUnderstory:null,shoreBank:null,sceneFailure:null,
    $:node,document:{body:{dataset:{}},removeEventListener(){},createElement(){return {handlers:{},addEventListener(type,callback){this.handlers[type]=callback;}};}},console:{error:error=>errors.push(error)},copy:{zh:{failed:'Fixture loading failed'}},busy(value,text){ctx.loading=value;if(text)messages.push(text);},message:(text)=>messages.push(text),showGraphicsRecovery(){},setReviewPaused(){},
    camera:new THREE.PerspectiveCamera(45,1.5,.08,22000),controls:{target:new THREE.Vector3(),update(){ctx.camera.updateMatrixWorld();}},redraw:{request(){},dispose(){}},keys:new Set(),raf:0,observer:{disconnect(){}},cancelAnimationFrame(){},removeEventListener(){},keydown(){},keyup(){},clearKeys(){},reader:{dispose(){}},directory:{dispose(){}},guides:null,guideSurface:null,audio:{dispose(){}},sites:null,residentArchitecture:null,residents:null,preparedGroundSources:null,terrainAssets:null,architecture:null,pool:null,visitor:null,water:null,groundTextures:null,environment:null,rendering:null,renderer:null,
    async injectedImport(id){
      if(id==='./museum-planting-pilot.js')return {prepareMuseumPlantingPilotAssets:async()=>({fixture:true}),createMuseumPlantingPilot:async()=>tinyPilot()};
      if(id==='./garden-understory-study.js')return {createGardenUnderstoryStudy:tinyUnderstory};
      if(id==='./xianfa-shore-community.js')return {createXianfaShoreCommunity:async options=>{
        if(failAt==='shore'){const error=new Error('fixture-shore-constraint-rejection');error.diagnostics={rejected:[{id:'shore-rock-2',message:'fixture constraint'}]};throw error;}
        actualCommunity=await createXianfaShoreCommunity({...options,yieldControl:async()=>{}});const release=actualCommunity.dispose;let released=false;actualCommunity.dispose=()=>{if(released)return;released=true;events.push('community');release();};
        if(lateShore){entered.resolve();await gate.promise;}return actualCommunity;
      }};
      if(id==='./museum-planting-colliders.js')return {createMuseumPlantingColliders:(source,options)=>{
        const extra=failAt==='collision'?{reservedPolygons:[{id:'fixture-real-road-conflict',polygon:square(source.parts[0].position.x,source.parts[0].position.z,.5)}]}:{};
        actualCollider=createMuseumPlantingColliders(source,{...options,...extra});const release=actualCollider.dispose;let released=false;actualCollider.dispose=()=>{if(released)return;released=true;events.push('collision');release();};return actualCollider;
      }};
      throw new Error('Unexpected injected import '+id);
    },
  };
  vm.createContext(ctx);vm.runInContext(`this.bootstrap=async()=>{try{\n${branch}\n${lastCatch}\n};\n${plantingCollision}\n${exitFunction}\nthis.pageDispose=dispose;this.evidence=({full=false}={})=>{const data={};${telemetry}\nreturn data;};`,ctx,{filename:'actual-shore-scene-integration-'+sceneSHA256.slice(0,12)+'.js'});
  return {ctx,buttons,events,errors,messages,sourceResources,owners,snapshots,marker,gate,entered,get actualCommunity(){return actualCommunity;},get actualCollider(){return actualCollider;},cleanup(){ctx.pageDispose();actualCommunity?.dispose();actualCollider?.dispose();owners.forEach(owner=>{try{owner.dispose();}catch{}});terrain.dispose();}};
}

test('actual shore branch mounts one world draw group, borrows context and merges exact 10-body collision sources without foliage',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.equal(h.ctx.sceneFailure,null);
  const {plantingPilot:pilot,shoreCommunity:shore,shoreUnderstory:understory,plantingCollisions:collision}=h.ctx;
  assert.ok(pilot&&shore&&understory&&collision);assert.equal(pilot.group.parent,h.ctx.scene);assert.equal(shore.group.parent,h.ctx.scene);assert.equal(understory.group.parent,null);assert.equal(shore.collisionSources.group.parent,null);
  assert.equal(h.ctx.scene.children.length,3);assert.equal(shore.contextGroups[0],pilot.parts[0]);assert.equal(shore.contextGroups[1],pilot.parts[1]);
  for(const previous of h.snapshots){assert.equal(previous.part.parent,previous.parent);assert.deepEqual(previous.part.matrixWorld.toArray(),previous.matrix);}
  assert.equal(collision.diagnostics.sourceMeshCount,10);assert.equal(collision.diagnostics.solidCount,44);assert.equal(collision.diagnostics.planeCount,616);assert.equal(collision.diagnostics.leavesRead,false);assert.equal(collision.diagnostics.bvhConstructed,false);
  const seen=new Set();for(const row of collision.diagnostics.sources){assert.ok(!seen.has(row.placementId));seen.add(row.placementId);const part=[...pilot.parts,...shore.collisionSources.parts].find(p=>p.userData.placementId===row.placementId);assert.deepEqual(row.worldMatrix,part.getObjectByName(row.mesh).matrixWorld.toArray());}
  for(const part of shore.collisionSources.parts){const binding=shore.bindings.find(b=>b.placementId===part.userData.placementId),source=part.getObjectByName('lake-rock-main');assert.equal(source.geometry,binding.drawMesh.geometry);assert.equal(source.material,binding.drawMesh.material);assert.deepEqual(source.matrixWorld.toArray(),new THREE.Matrix4().multiplyMatrices(binding.drawMesh.matrixWorld,binding.matrix).toArray());}
  assert.ok(h.sourceResources.every(r=>r.disposeEvents===0));assert.equal(h.events.length,0);
  const summary=h.ctx.evidence();assert.equal(summary.shoreCommunity.placements,62);assert.equal(summary.shoreCommunity.nativeCompositionReviewed,false);assert.equal(summary.plantingCollisions.solidCount,44);
});

test('both actual shore review buttons find retained world groups and frame them without hiding other scenery',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();h.ctx.ready=true;h.ctx.loading=false;
  for(const id of ['shore-whole','shore-low']){
    const button=h.buttons.find(b=>b.textContent==='植被 / '+id);assert.ok(button);button.handlers.click();assert.equal(h.ctx.plantingReview.id,id);assert.ok(h.ctx.camera.position.toArray().every(Number.isFinite));assert.equal(h.marker.visible,true);
    const bounds=new THREE.Box3();for(const name of h.ctx.plantingReview.groups){const object=h.ctx.plantingPilot.group.getObjectByName(name)??h.ctx.shoreCommunity.group.getObjectByName(name);assert.ok(object);bounds.expandByObject(object);}
    assert.ok(h.ctx.controls.target.distanceTo(bounds.getCenter(new THREE.Vector3()))<1e-10);assert.equal(h.ctx.shoreUnderstory.group.parent,null);
  }
});

test('page exit releases collision then community then borrowed owners exactly once after both draw groups detach',async t=>{
  const h=harness();t.after(()=>h.cleanup());await h.ctx.bootstrap();h.ctx.pageDispose();h.ctx.pageDispose();
  assert.deepEqual(h.events,['collision','community','understory','pilot']);assert.ok(h.sourceResources.every(r=>r.disposeEvents===1));assert.equal(h.ctx.scene.children.length,1);assert.equal(h.ctx.scene.children[0],h.marker);
});

for(const failure of ['shore','collision','review-ui'])test('actual '+failure+' failure removes partial planting and clears owned references before reporting failed UI',async t=>{
  const h=harness({failAt:failure});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.ok(h.ctx.sceneFailure);assert.equal(h.ctx.document.body.dataset.ready,'failed');assert.equal(h.ctx.plantingPilot,null);assert.equal(h.ctx.shoreCommunity,null);assert.equal(h.ctx.shoreUnderstory,null);assert.equal(h.ctx.plantingCollisions,null);assert.equal(h.ctx.scene.children.length,1);
  assert.ok(h.sourceResources.every(r=>r.disposeEvents===1));assert.deepEqual(h.events,failure==='shore'?['understory','pilot']:failure==='collision'?['community','understory','pilot']:['collision','community','understory','pilot']);
  if(failure==='shore')assert.equal(h.ctx.sceneFailure.shorePlacement.rejected[0].id,'shore-rock-2');
});

test('cleanup exception preserves the original shore diagnostic and continues releasing the pilot',async t=>{
  const h=harness({failAt:'shore',throwDuringCleanup:true});t.after(()=>h.cleanup());await h.ctx.bootstrap();
  assert.equal(h.errors[0].name,'AggregateError');assert.equal(h.errors[0].cause.message,'fixture-shore-constraint-rejection');assert.equal(h.ctx.sceneFailure.shorePlacement.rejected[0].id,'shore-rock-2');assert.deepEqual(h.events,['understory','pilot']);assert.ok(h.sourceResources.every(r=>r.disposeEvents===1));
});

test('late returned community after page exit is disposed rather than mounted or retaining already released source owners',async t=>{
  const h=harness({lateShore:true});t.after(()=>h.cleanup());const pending=h.ctx.bootstrap();await h.entered.promise;h.ctx.pageDispose();h.gate.resolve();await pending;
  assert.equal(h.ctx.disposed,true);assert.equal(h.ctx.shoreCommunity,null);assert.equal(h.ctx.shoreUnderstory,null);assert.equal(h.ctx.plantingPilot,null);assert.equal(h.ctx.plantingCollisions,null);assert.equal(h.ctx.scene.children.length,1);assert.equal(h.actualCommunity.disposed,true);assert.ok(h.sourceResources.every(r=>r.disposeEvents===1));assert.equal(h.events.filter(e=>e==='community').length,1);
});

test('feature gates keep the pilot-only path at eight collision bodies and omit all shoreline ownership',async t=>{
  const h=harness({shore:false});t.after(()=>h.cleanup());await h.ctx.bootstrap();assert.equal(h.ctx.shoreCommunity,null);assert.equal(h.ctx.shoreUnderstory,null);assert.equal(h.ctx.plantingCollisions.diagnostics.sourceMeshCount,8);assert.equal(h.ctx.plantingCollisions.diagnostics.solidCount,34);assert.equal(h.owners.length,1);assert.ok(h.buttons.every(b=>!b.textContent.includes('shore-')));
});

console.log(JSON.stringify({fixture:'actual scene planting branch with tiny real Three source surfaces',sceneSHA256,fullSourceFactories:0,rendererConstructed:false,GPUUsed:false}));
