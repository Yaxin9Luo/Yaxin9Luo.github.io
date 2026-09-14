import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {flowerOutline} from '../src/yuanmingyuan/xieqiqu-geometry.js';
import {createXieqiquCourtGardenR1Layout} from '../src/yuanmingyuan/xieqiqu-court-garden-r1-layout.js';
import {createXieqiquCourtGardenOwner} from '../src/yuanmingyuan/xieqiqu-court-garden-owner.js';
import {prepareXieqiquCourtGardenR1} from '../src/yuanmingyuan/xieqiqu-court-garden-r3.js';
import {createCourtBandsR3Sources} from '../src/yuanmingyuan/court-planting-sources-r3.js';
import {
 courtBroadleafContract,courtBroadleafProfile,courtBroadleafReview,
 assertCourtBroadleafRecord,assertCourtBroadleafGeometry,assertCourtBroadleafContract,
} from '../src/yuanmingyuan/court-broadleaf-profile.js';

const yieldControl=async()=>{};
const identity=node=>node.position.equals(new THREE.Vector3())&&node.quaternion.equals(new THREE.Quaternion())&&node.scale.equals(new THREE.Vector3(1,1,1));
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,String(a)+' != '+String(b));

function fixture(rootDepth=.065){
 const events=[],root=new THREE.Group(),stone=new THREE.MeshStandardMaterial();
 const paving=new THREE.Group();paving.name='xieqiqu-court-paving';root.add(paving);
 const floor=new THREE.Mesh(extrudedPolygon([[-52,-51],[52,-51],[52,40.75],[-52,40.75]],-.65,0,
  [flowerOutline('haitang',0,26,13,8.5),flowerOutline('chrysanthemum',0,-27,4.8,4.8)]),stone);paving.add(floor);
 for(const name of ['xieqiqu-main-hall','xieqiqu-northwest-reservoir','xieqiqu-south-haitang-pool','xieqiqu-north-chrysanthemum-pool','xieqiqu-west-octagonal-music-pavilion','xieqiqu-east-octagonal-music-pavilion','north-pool-concentric-paving','south-lake-balustrade-and-viewing-landing']){
  const group=new THREE.Group();group.name=name;root.add(group);
 }
 let baseDisposed=false,sourceDisposed=false,loads=0;
 const base={group:root,diagnostics:{id:'bounded-building-fixture'},get disposed(){return baseDisposed;},
  update(t){events.push(['base-update',t]);},
  dispose(){if(baseDisposed)return;baseDisposed=true;events.push('base-dispose');root.traverse(n=>{if(n.isMesh)n.geometry.dispose();});stone.dispose();root.clear();}};
 const sourceGroup=new THREE.Group(),part=new THREE.Group(),detail=new THREE.Group();
 part.userData={id:'low-broadleaf',windAmplitude:0};sourceGroup.add(part);
 const rootGeometry=new THREE.BoxGeometry(.10,rootDepth+.012,.08);rootGeometry.translate(0,(.012-rootDepth)/2,0);
 const leafGeometry=new THREE.BufferGeometry();
 leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.16,0,0,.18,0,0,.02,.18,.06,-.11,.11,-.04],3));
 leafGeometry.setIndex([0,1,2,0,2,3]);leafGeometry.computeVertexNormals();
 const sourceMaterials=[0x4d713d,0x594b37].map(color=>new THREE.MeshStandardMaterial({color,vertexColors:true,side:THREE.DoubleSide}));
 for(const g of [leafGeometry,rootGeometry]){
  const c=new Float32Array(g.attributes.position.count*3).fill(1);g.setAttribute('color',new THREE.BufferAttribute(c,3));g.computeBoundingBox();
 }
 const leaf=new THREE.Mesh(leafGeometry,sourceMaterials[0]),stem=new THREE.Mesh(rootGeometry,sourceMaterials[1]);
 leaf.name='fixture-real-leaf';stem.name='fixture-short-root';leaf.castShadow=stem.castShadow=true;
 detail.name='fixture-detail-shoot';detail.position.set(.015,.19,-.01);detail.rotation.y=.27;detail.add(leaf);part.add(detail,stem);
 sourceGroup.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(part),minRoot=rootGeometry.boundingBox.min.y,triangles=rootGeometry.index.count/3+leafGeometry.index.count/3;
 const sourceOwner={id:'fixture-opaque-broadleaf',group:sourceGroup,part,
  diagnostics:{id:'fixture-opaque-broadleaf',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},root:{min:minRoot}},
  get disposed(){return sourceDisposed;},update(t){events.push(['source-update',t]);},
  dispose(){if(sourceDisposed)return;sourceDisposed=true;events.push('source-dispose');leafGeometry.dispose();rootGeometry.dispose();for(const m of sourceMaterials)m.dispose();sourceGroup.clear();}};
 const review='fixture:independent-opaque-source-not-old-scan-proof',record={part,owner:sourceOwner,review};
 const profile=Object.freeze({id:sourceOwner.id,triangles,meshes:2,rootMinY:minRoot,min:Object.freeze(bounds.min.toArray()),max:Object.freeze(bounds.max.toArray())});
 const receivers=[];
 const contract=Object.freeze({profile,review,
  assertRecord(value){
   receivers.push({kind:'record',contract:this});
   if(value?.review!==this.review||value.owner?.diagnostics.id!==this.profile.id||value.owner?.diagnostics.triangles!==this.profile.triangles||
    value.owner.disposed||typeof value.owner.dispose!=='function'||value.owner.group.parent||value.owner.group.children.length!==1||
    value.part.parent!==value.owner.group||value.part.userData.id!=='low-broadleaf'||!identity(value.owner.group)||!identity(value.part))
    throw new Error('Independent fixture broadleaf record identity changed');
   return true;
  },
  assertGeometry(actualPart,actual){
   receivers.push({kind:'geometry',contract:this});
   if(actualPart!==part||actual.triangles!==this.profile.triangles||actual.records.length!==2||
    !actual.bounds.min.equals(bounds.min)||!actual.bounds.max.equals(bounds.max))
    throw new Error('Independent fixture broadleaf geometry changed');
   near(Math.min(...actual.roots.map(p=>p.y)),minRoot);
   for(const {node}of actual.records)if(node.isInstancedMesh||node.material.transparent||node.material.alphaTest!==0||
    !node.material.vertexColors||['map','alphaMap','normalMap','roughnessMap'].some(slot=>node.material[slot]))
    throw new Error('Independent fixture requires complete opaque unmapped leaves and wood');
   return true;
  },
 });
 const layout=structuredClone(createXieqiquCourtGardenR1Layout()),bed=layout.beds[0];
 layout.id='explicit-broadleaf-contract-fixture';layout.beds=[bed];
 layout.placements=[{id:'fixture-plant',bedId:bed.id,species:'low-broadleaf',x:bed.cx,z:bed.cz,scale:1.25,yaw:.24}];
 layout.sourceLayout={regions:[{id:layout.id,placements:layout.placements}]};
 let bridge=null,binding=null;
 const createSources=options=>bridge=createCourtBandsR3Sources({...options,broadleafContract:contract,loadBroadleaf:async()=>{loads++;return record;}});
 const prepareGarden=async options=>binding=await prepareXieqiquCourtGardenR1({...options,broadleafContract:contract,yieldControl});
 const build=extra=>createXieqiquCourtGardenOwner({loadBase:async()=>base,layout,createSources,prepareGarden,...extra});
 return {events,base,root,floor,stone,record,profile,contract,receivers,layout,leaf,stem,detail,sourceMaterials,
  createSources,prepareGarden,build,get bridge(){return bridge;},get binding(){return binding;},get loads(){return loads;},
  cleanup(){binding?.dispose();bridge?.dispose();sourceOwner.dispose();base.dispose();}};
}

test('the default contract retains the exact original scan profile, review and validators',()=>{
 assert(Object.isFrozen(courtBroadleafContract));assert.equal(courtBroadleafContract.profile,courtBroadleafProfile);
 assert.equal(courtBroadleafContract.review,courtBroadleafReview);
 assert.equal(courtBroadleafContract.assertRecord,assertCourtBroadleafRecord);
 assert.equal(courtBroadleafContract.assertGeometry,assertCourtBroadleafGeometry);
 assert.equal(assertCourtBroadleafContract(courtBroadleafContract),courtBroadleafContract);
});

test('explicit independent contract reaches the real court owner, nested Mesh borrowing, source review and root datum',async()=>{
 const f=fixture(),owner=await f.build();const sourceEvents=[];
 try{
  assert.equal(f.loads,1);assert.equal(f.record.owner.diagnostics.fullResolutionVerified,undefined);
  assert.notEqual(f.contract.profile.triangles,courtBroadleafProfile.triangles);
  const summary=owner.diagnostics.courtGardenSources.sources.find(s=>s.species==='low-broadleaf');
  assert.equal(summary.sourceReview,f.contract.review);assert.equal(summary.sourceStudyId,f.profile.id);assert.equal(summary.triangles,f.profile.triangles);
  assert.equal(owner.diagnostics.courtGarden.nativeReviewed,false);assert.equal(owner.diagnostics.courtGardenSources.nativeCompositionReviewed,false);
  assert.equal(f.binding.diagnostics.actualSourceTriangles,f.profile.triangles);
  const placement=f.layout.placements[0],views=[];f.binding.group.traverse(n=>{if(n.isInstancedMesh)views.push(n);});
  assert.equal(views.length,2);
  f.record.part.updateWorldMatrix(true,true);
  for(const node of [f.leaf,f.stem]){
   const view=views.find(n=>n.geometry===node.geometry);assert(view);assert.equal(view.material,node.material);assert.equal(view.userData.navigation,false);
   const matrix=new THREE.Matrix4().compose(new THREE.Vector3(placement.x,f.layout.levels.soilTop-f.layout.levels.rootBurial,placement.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),placement.yaw),new THREE.Vector3().setScalar(placement.scale)).multiply(node.matrixWorld);
   const actual=new THREE.Matrix4();view.getMatrixAt(0,actual);
   assert.deepEqual(actual.elements,Array.from(new Float32Array(matrix.elements)));
   node.geometry.addEventListener('dispose',()=>sourceEvents.push(node));view.addEventListener('dispose',()=>f.events.push('view-dispose'));
  }
  near(f.binding.diagnostics.maximumRootBurial,-f.profile.rootMinY*placement.scale+f.layout.levels.rootBurial);
  assert(f.binding.diagnostics.maximumRootBurial>-.03000451624393463*placement.scale+f.layout.levels.rootBurial);
  owner.update(2);assert(f.receivers.some(r=>r.kind==='geometry'));assert(f.receivers.every(r=>r.contract===f.contract));
  assert.deepEqual(f.events.slice(-2),[['base-update',2],['source-update',2]]);
  f.binding.dispose();assert.equal(sourceEvents.length,0);assert.equal(f.floor.material,f.stone);
  owner.dispose();owner.dispose();await owner.whenIdle();assert.equal(sourceEvents.length,2);
  assert(f.events.indexOf('view-dispose')<f.events.indexOf('source-dispose'));assert(f.events.indexOf('source-dispose')<f.events.indexOf('base-dispose'));
 }finally{owner.dispose();await owner.whenIdle();f.cleanup();}
});

for(const point of ['source bridge','garden binding'])test('omitting the explicit contract at '+point+' rejects the new source and closes every owner',async()=>{
 const f=fixture();
 try{
  const extra=point==='source bridge'?{createSources:options=>createCourtBandsR3Sources({...options,loadBroadleaf:async()=>f.record})}:
   {prepareGarden:options=>prepareXieqiquCourtGardenR1({...options,yieldControl})};
  await assert.rejects(f.build(extra),point==='source bridge'?/independently owned/:/full reviewed/);
  assert.equal(f.record.owner.disposed,true);assert.equal(f.base.disposed,true);
  assert.equal(f.events.filter(e=>e==='source-dispose').length,1);assert.equal(f.events.filter(e=>e==='base-dispose').length,1);
 }finally{f.cleanup();}
});

test('new review, source identity and unplaced owner frame are checked without borrowing the old 4K claim',async()=>{
 for(const mutate of [f=>{f.record.review=courtBroadleafReview;},f=>{f.record.owner.diagnostics.id=courtBroadleafProfile.id;},f=>{f.record.part.position.x=.2;}]){
  const f=fixture();mutate(f);
  try{await assert.rejects(f.build(),/record identity/);assert.equal(f.record.owner.disposed,true);assert.equal(f.base.disposed,true);assert.equal(f.binding,null);}
  finally{f.cleanup();}
 }
});

test('root burial uses each explicit contract minimum and a stricter contract still rejects the same actual roots',async()=>{
 for(const depth of [.044,.078]){
  const f=fixture(depth);let binding;
  try{
   binding=await f.prepareGarden({owner:f.base,sources:{'low-broadleaf':f.record},layout:f.layout,buildSupport:false});
   near(binding.diagnostics.maximumRootBurial,-f.profile.rootMinY*1.25+f.layout.levels.rootBurial);binding.dispose();
   const stricter=Object.freeze({...f.contract,profile:Object.freeze({...f.profile,rootMinY:f.profile.rootMinY+.015})});
   await assert.rejects(prepareXieqiquCourtGardenR1({owner:f.base,sources:{'low-broadleaf':f.record},layout:f.layout,broadleafContract:stricter,buildSupport:false,yieldControl}),/root does not meet/);
   assert.equal(f.floor.material,f.stone);assert.equal(f.record.owner.disposed,false);
  }finally{binding?.dispose();f.cleanup();}
 }
});

test('new geometry-contract failure rolls back bindings before the source and building are released',async()=>{
 const f=fixture();f.leaf.material.alphaTest=.5;
 try{
  await assert.rejects(f.build(),/opaque unmapped/);assert.equal(f.record.owner.disposed,true);assert.equal(f.base.disposed,true);
  assert.equal(f.events.filter(e=>e==='source-dispose').length,1);assert.equal(f.events.filter(e=>e==='base-dispose').length,1);
 }finally{f.cleanup();}
});

test('invalid contract metadata cannot bypass the actual root check or start a provider',async()=>{
 const f=fixture();let westernCalls=0,leafCalls=0;
 const invalid=[null,{...f.contract,assertGeometry:null},...[-Infinity,NaN,.006].map(rootMinY=>({...f.contract,profile:{...f.profile,rootMinY}})),{...f.contract,review:''}];
 try{
  for(const broadleafContract of invalid){
   assert.throws(()=>createCourtBandsR3Sources({plantingLayout:f.layout.sourceLayout,broadleafContract,
    createWestern(){westernCalls++;},loadBroadleaf(){leafCalls++;}}),/explicit broadleaf contract/);
   await assert.rejects(prepareXieqiquCourtGardenR1({owner:f.base,sources:{'low-broadleaf':f.record},layout:f.layout,broadleafContract,yieldControl}),/explicit broadleaf contract/);
  }
  assert.equal(westernCalls,0);assert.equal(leafCalls,0);assert.equal(f.floor.material,f.stone);assert.equal(f.record.owner.disposed,false);
 }finally{f.cleanup();}
});

test('late abort of an alternative source retains original release and whenIdle semantics',async()=>{
 const f=fixture(),controller=new AbortController();let resolve,entered;
 const started=new Promise(r=>entered=r),bridge=createCourtBandsR3Sources({plantingLayout:f.layout.sourceLayout,broadleafContract:f.contract,
  loadBroadleaf:()=>{entered();return new Promise(r=>resolve=r);}});
 try{
  const pending=bridge.prepareRegion(f.layout.id,{signal:controller.signal});await started;
  controller.abort();resolve(f.record);await assert.rejects(pending,{name:'AbortError'});
  assert.equal(f.record.owner.disposed,true);assert.equal(bridge.snapshot().completed,0);
  bridge.dispose();await bridge.whenIdle();assert.equal(f.events.filter(e=>e==='source-dispose').length,1);
 }finally{bridge.dispose();await bridge.whenIdle();f.cleanup();}
});
