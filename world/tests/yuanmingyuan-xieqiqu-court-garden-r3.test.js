import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {flowerOutline} from '../src/yuanmingyuan/xieqiqu-geometry.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {prepareXieqiquCourtGardenR1} from '../src/yuanmingyuan/xieqiqu-court-garden-r3.js';

const yieldControl=async()=>{};
function fixture({missingPatch=false,obstacle=false}={}){
  const root=new THREE.Group();root.position.set(395,4,-565);
  const stone=new THREE.MeshStandardMaterial({color:0xd1c8b5,roughness:.92}),sourceMaterials=[],sourceGeometries=[];
  const floorGeometry=extrudedPolygon([[-52,-51],[52,-51],[52,40.75],[-52,40.75]],-.65,0,
    [flowerOutline('haitang',0,26,13,8.5),flowerOutline('chrysanthemum',0,-27,4.8,4.8),...(missingPatch?[[[19.11,-36.18],[19.28,-36.18],[19.28,-36.01],[19.11,-36.01]]]:[])]);
  const group=new THREE.Group();group.name='xieqiqu-court-paving';root.add(group);
  const floor=new THREE.Mesh(floorGeometry,stone);group.add(floor);
  for(const name of ['xieqiqu-main-hall','xieqiqu-northwest-reservoir','xieqiqu-south-haitang-pool','xieqiqu-north-chrysanthemum-pool','xieqiqu-west-octagonal-music-pavilion','xieqiqu-east-octagonal-music-pavilion','north-pool-concentric-paving','south-lake-balustrade-and-viewing-landing']){
    const g=new THREE.Group();g.name=name;root.add(g);
  }
  // A second actual surface shares the original paving material at roof height.
  const roof=new THREE.Mesh(new THREE.BoxGeometry(4,.2,4),stone);roof.position.set(0,11,0);root.getObjectByName('xieqiqu-main-hall').add(roof);
  if(obstacle){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,.5,.4),stone);mesh.position.set(21.9,.25,-37.45);root.add(mesh);}
  const sourceOwner={disposed:false},sources={};
  for(const species of ['sedge','flower-shrub']){
    const part=new THREE.Group();part.userData.id=species;
    const g=new THREE.BufferGeometry(),rootY=species==='sedge'?-0.004:-.012;
    // Small source fixture with real below-grade roots and an opaque leaf above.
    g.setAttribute('position',new THREE.Float32BufferAttribute([-.02,rootY,0,.02,rootY,0,0,.32,.18,-.18,.22,-.1,.18,.22,-.1,0,.42,0],3));g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({color:0x64834d,side:THREE.DoubleSide}),node=new THREE.Mesh(g,m);node.name=species+'-original';part.add(node);
    sources[species]={part,owner:sourceOwner,review:'work/yuanmingyuan/garden-understory-native-r2/review.json'};sourceMaterials.push(m);sourceGeometries.push(g);
  }
  root.updateMatrixWorld(true);
  const owner={group:root,disposed:false},architecture=createArchitectureSurface(root);
  const cleanup=()=>{architecture.dispose();root.traverse(node=>{if(node.isMesh)node.geometry.dispose();});stone.dispose();for(const g of sourceGeometries)g.dispose();for(const m of sourceMaterials)m.dispose();root.clear();};
  return {owner,root,floor,roof,stone,architecture,sources,sourceOwner,sourceMaterials,sourceGeometries,cleanup};
}

import fs from 'node:fs';
const basePlanFixture=JSON.parse(fs.readFileSync(new URL('./fixtures/xieqiqu-court-garden-r3-spatial-fixture.json',import.meta.url)));
const createPairedCourtBandsR3=()=>structuredClone(basePlanFixture);
function withJuniper(){
  const f=fixture(),part=new THREE.Group();part.userData.id='juniper';
  const g=new THREE.CylinderGeometry(.045,.28,5.6,12,4);g.translate(0,2.7,0);
  const m=new THREE.MeshStandardMaterial({name:'original-juniper-bark',color:0x625e4a,roughness:.96});
  const trunk=new THREE.Mesh(g,m);trunk.name='juniper-visible-trunk';trunk.castShadow=true;part.add(trunk);
  const leafGeometry=new THREE.BoxGeometry(.80,.12,.45),leafMaterial=new THREE.MeshStandardMaterial({name:'original-juniper-sprays',color:0x365b3a,side:THREE.DoubleSide});
  const leaves=new THREE.InstancedMesh(leafGeometry,leafMaterial,3);leaves.name='juniper-tier-1-scale-foliage-1';
  for(let i=0;i<3;i++){leaves.setMatrixAt(i,new THREE.Matrix4().makeTranslation(-1.15+i*1.15,3.6+i*.7,0));leaves.setColorAt(i,new THREE.Color(.5+i*.1,.7,.4));}
  leaves.computeBoundingBox();leaves.computeBoundingSphere();leaves.castShadow=true;leaves.receiveShadow=true;
  const callback=function(){};leaves.onBeforeRender=callback;part.add(leaves);
  f.sources.juniper={part,owner:f.sourceOwner,review:'work/yuanmingyuan/vegetation-native-review-r2.json'};
  f.sourceGeometries.push(g,leafGeometry);f.sourceMaterials.push(m,leafMaterial);
  return {...f,trunk,leaves};
}
const prepareR3=(f,extra={})=>prepareXieqiquCourtGardenR1({owner:f.owner,sources:f.sources,layout:createPairedCourtBandsR3(),yieldControl,...extra});
function volume(x,y,z,rx=.4,ry=.5,rz=.4){
  return {bounds:{minX:x-rx,maxX:x+rx,minY:y-ry,maxY:y+ry,minZ:z-rz,maxZ:z+rz},
    planes:[[1,0,0,x+rx],[-1,0,0,-x+rx],[0,1,0,y+ry],[0,-1,0,-y+ry],[0,0,1,z+rz],[0,0,-1,-z+rz]],interiorPoint:{x,y,z}};
}
test('R3 borrows complete instanced crowns and admits only actual trunk mesh into architecture',async()=>{
  const f=withJuniper(),sourceEvents=[];
  for(const resource of [...f.sourceGeometries,...f.sourceMaterials,f.leaves])resource.addEventListener('dispose',()=>sourceEvents.push(resource));
  const binding=await prepareR3(f,{buildSupport:false}),views=[],trunks=[];
  try{
    binding.group.traverse(n=>{
      if(n.geometry===f.leaves.geometry){views.push(n);assert.equal(n.count,3);assert.equal(n.instanceMatrix,f.leaves.instanceMatrix);assert.equal(n.instanceColor,f.leaves.instanceColor);assert.equal(n.geometry,f.leaves.geometry);assert.equal(n.material,f.leaves.material);assert.equal(n.onBeforeRender,f.leaves.onBeforeRender);assert.equal(n.userData.navigation,false);}
      if(n.geometry===f.trunk.geometry){trunks.push(n);assert.equal(n.userData.navigation,true);assert.equal(n.userData.courtGardenTrunk,true);assert.equal(n.material,f.trunk.material);}
    });
    assert.equal(views.length,4);assert.equal(trunks.length,4);assert.equal(binding.diagnostics.plantCount,208);
    assert.equal(binding.diagnostics.actualAuditLocalBounds.max[1]>5,true);
    const support=binding.createSupport(),combined=createArchitectureSurface(f.root);
    try{
      assert.equal(support.diagnostics.instanceCount,0);assert.equal(combined.diagnostics.instanceCount,0);
      const p=binding.plan.placements.find(p=>p.species==='juniper');
      assert.equal(support.intersectsGuideVolume(volume(395+p.x,5.7,-565+p.z)),true);
      assert.equal(combined.intersectsGuideVolume(volume(395+p.x,5.7,-565+p.z)),true);
      assert.equal(support.intersectsGuideVolume(volume(395+p.x+1.3,8.0,-565+p.z,.15,.12,.15)),false);
      for(const bed of binding.plan.beds)for(const pattern of bed.mineralPatches){
        const x=pattern.ring.reduce((s,p)=>s+p[0],0)/pattern.ring.length,z=pattern.ring.reduce((s,p)=>s+p[1],0)/pattern.ring.length;
        const h=support.surfaceAt(395+x,-565+z,{maxY:5});assert.ok(h&&Math.abs(h.height-4.085)<1e-5,'Mineral pattern retains the same real soil support');
      }
    }finally{combined.dispose();}
    let viewEvents=0;for(const copy of views)copy.addEventListener('dispose',()=>{
      viewEvents++;assert.notEqual(copy.instanceMatrix,f.leaves.instanceMatrix);assert.equal(copy.instanceMatrix.count,0);assert.equal(copy.instanceColor,null);
    });
    binding.dispose();binding.dispose();assert.equal(viewEvents,4);assert.equal(sourceEvents.length,0);assert.equal(f.floor.material,f.stone);
  }finally{binding.dispose();f.cleanup();}
});
test('R3 derived audit rejects a retained obstacle above the old 3m audit ceiling',async()=>{
  const f=withJuniper(),p=createPairedCourtBandsR3().placements.find(p=>p.species==='juniper');
  const obstacle=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),f.stone);obstacle.position.set(p.x,4.7,p.z);f.root.add(obstacle);f.root.updateMatrixWorld(true);
  try{await assert.rejects(prepareR3(f),/architecture conflicts/);assert.equal(f.floor.material,f.stone);}finally{f.cleanup();}
});
test('R3 source instance disposal cancels borrowed views without disposing other source resources',async()=>{
  const f=withJuniper(),binding=await prepareR3(f);let events=0;
  for(const resource of [...f.sourceGeometries,...f.sourceMaterials])resource.addEventListener('dispose',()=>events++);
  try{f.leaves.dispose();assert.equal(binding.disposed,true);assert.equal(binding.support,null);assert.equal(events,0);assert.equal(f.floor.material,f.stone);}
  finally{binding.dispose();f.cleanup();}
});
test('R3 cancellation after complete juniper borrowing restores baseline and source attributes',async()=>{
  const f=withJuniper(),controller=new AbortController(),matrix=f.leaves.instanceMatrix,color=f.leaves.instanceColor;let sourceDisposes=0;
  f.leaves.addEventListener('dispose',()=>sourceDisposes++);
  try{
    await assert.rejects(prepareR3(f,{signal:controller.signal,onProgress:e=>{if(e.stage==='plant-instances'&&e.id==='juniper')controller.abort(new Error('cancel juniper transaction'));}}),/cancel juniper|invalidated/);
    assert.equal(sourceDisposes,0);assert.equal(f.leaves.instanceMatrix,matrix);assert.equal(f.leaves.instanceColor,color);assert.equal(f.floor.material,f.stone);
    assert.equal(f.root.getObjectByName('xieqiqu-court-garden-r3-bands'),undefined);
  }finally{f.cleanup();}
});
test('R3 tree admission rejects understory-only provenance',async()=>{
  const f=withJuniper();f.sources.juniper.review='work/yuanmingyuan/garden-understory-native-r2/review.json';
  try{await assert.rejects(prepareR3(f),/full reviewed/);assert.equal(f.floor.material,f.stone);}finally{f.cleanup();}
});

test('one optional soil lease supplies all beds and owns each material/map release exactly once',async()=>{
  const f=withJuniper(),texture=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1),material=new THREE.MeshStandardMaterial({map:texture});
  let calls=0,leaseDisposals=0,materialDisposals=0,textureDisposals=0,disposed=false;
  material.addEventListener('dispose',()=>materialDisposals++);texture.addEventListener('dispose',()=>textureDisposals++);
  const lease={material,diagnostics:{id:'exclusive-soil-fixture'},get disposed(){return disposed;},dispose(){leaseDisposals++;disposed=true;material.dispose();texture.dispose();}};
  const layout=createPairedCourtBandsR3(),controller=new AbortController();
  const binding=await prepareR3(f,{layout,signal:controller.signal,createSoilMaterial:async args=>{calls++;assert.equal(args.layout,layout);assert.equal(args.signal,controller.signal);return lease;}});
  try{
    const soils=[];binding.group.traverse(n=>{if(n.isMesh&&n.name.endsWith('-soil'))soils.push(n);});
    assert.equal(calls,1);assert.equal(soils.length,4);assert.ok(soils.every(n=>n.material===material));
    assert.deepEqual(binding.diagnostics.soilMaterialLease,{id:'exclusive-soil-fixture'});
    binding.dispose();binding.dispose();assert.equal(leaseDisposals,1);assert.equal(materialDisposals,1);assert.equal(textureDisposals,1);
  }finally{binding.dispose();f.cleanup();}
});
test('late soil lease is released after an in-flight cancellation without mounting or touching borrowed sources',async()=>{
  const f=withJuniper(),controller=new AbortController();let resolveLease,entered,disposed=false,calls=0;
  const started=new Promise(r=>entered=r),waiting=new Promise(r=>resolveLease=r),material=new THREE.MeshStandardMaterial();
  let materialDisposals=0;material.addEventListener('dispose',()=>materialDisposals++);
  const lease={material,diagnostics:{id:'late-soil'},get disposed(){return disposed;},dispose(){calls++;disposed=true;material.dispose();}};
  const preparing=prepareR3(f,{signal:controller.signal,createSoilMaterial:()=>{entered();return waiting;}});
  try{
    await started;controller.abort(new Error('cancel pending soil'));assert.equal(f.floor.material,f.stone);
    resolveLease(lease);await assert.rejects(preparing,/cancel pending soil|invalidated/);
    assert.equal(calls,1);assert.equal(materialDisposals,1);assert.equal(f.sourceOwner.disposed,false);assert.equal(f.root.getObjectByName('xieqiqu-court-garden-r3-bands'),undefined);
  }finally{f.cleanup();}
});
test('failed optional soil material factory leaves the original source owner and display material intact',async()=>{
  const f=withJuniper();
  try{await assert.rejects(prepareR3(f,{createSoilMaterial:async()=>{throw new Error('soil decode fixture');}}),/soil decode fixture/);assert.equal(f.floor.material,f.stone);assert.equal(f.sourceOwner.disposed,false);}
  finally{f.cleanup();}
});

test('surface mineral patterns share soil height, preserve support and isolate their private display material',async()=>{
  const f=withJuniper(),binding=await prepareR3(f),patterns=[];
  try{
    binding.group.traverse(n=>{if(n.userData.courtMineralPattern)patterns.push(n);});
    assert.equal(patterns.length,4);assert.equal(binding.diagnostics.mineralPatternCount,4);
    assert.ok(binding.diagnostics.mineralPatternArea<21);
    const material=patterns[0].material;assert.notEqual(material,f.stone);assert.notEqual(material,f.floor.material);
    assert.equal(material.map,f.stone.map);assert.equal(material.depthWrite,false);assert.equal(material.polygonOffset,true);
    for(const view of patterns){
      assert.equal(view.material,material);assert.equal(view.userData.navigation,false);assert.equal(view.userData.courtGardenSurface,false);
      assert.equal(view.castShadow,false);
      const positions=view.geometry.attributes.position;
      for(let i=0;i<positions.count;i++)assert.ok(Math.abs(positions.getY(i)-binding.plan.levels.soilTop)<1e-7);
      const box=new THREE.Box3().setFromBufferAttribute(positions),centre=box.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(binding.support.surfaceAt(395+centre.x,-565+centre.z,{maxY:5}).height-4.085)<1e-5);
    }
    let releases=0;material.addEventListener('dispose',()=>releases++);
    binding.dispose();binding.dispose();assert.equal(releases,1);assert.equal(f.floor.material,f.stone);assert.equal(f.roof.material,f.stone);
  }finally{binding.dispose();f.cleanup();}
});
test('a plant rooted inside a mineral surface pattern is rejected even though its real soil support remains',async()=>{
  const f=withJuniper(),layout=JSON.parse(JSON.stringify(createPairedCourtBandsR3()));
  const p=layout.placements.find(p=>p.species==='flower-shrub'&&p.bedId==='east-main-garden-band');
  p.x=18.7;p.z=-38.75;
  try{await assert.rejects(prepareR3(f,{layout}),/reserved surface mineral pattern/);assert.equal(f.floor.material,f.stone);}
  finally{f.cleanup();}
});

test('final scanned shrub keeps all original source geometry, maps and actual root datum through binding and rollback',async()=>{
  const {loadCourtLowBroadleafSource}=await import('../src/yuanmingyuan/court-low-broadleaf-source.js');
  const {createCourtBandsR3Drifts}=await import('../src/yuanmingyuan/xieqiqu-court-garden-r3-layout.js');
  const baseUrl=new URL('../public/models/yuanmingyuan/court-low-broadleaf-r1/',import.meta.url);
  let bitmapCloses=0;
  // Encoded source bytes are real and hash checked by the actual loader.
  // ImageBitmap is a CPU lifecycle seam; native original texture decode has its separate proof.
  const record=await loadCourtLowBroadleafSource({
    baseUrl:'/cpu-broadleaf-test/',
    fetcher:async url=>new Response(fs.readFileSync(new URL(url.slice('/cpu-broadleaf-test/'.length),baseUrl))),
    decode:async()=>({width:4096,height:4096,close(){bitmapCloses++;}}),
  });
  const f=fixture(),actual=createCourtBandsR3Drifts(),layout={...actual,placements:actual.placements.filter(p=>p.species==='low-broadleaf')};
  const sources={'low-broadleaf':record},leaf=record.part.children[0],originalAlpha=leaf.material.alphaTest;
  const nodes=record.part.children,geometryEvents=[],materialEvents=[],textureEvents=[];
  const materials=new Set(nodes.map(n=>n.material)),maps=new Set([...materials].flatMap(m=>Object.values(m).filter(t=>t?.isTexture)));
  for(const n of nodes)n.geometry.addEventListener('dispose',()=>geometryEvents.push(n.geometry));
  for(const m of materials)m.addEventListener('dispose',()=>materialEvents.push(m));
  for(const t of maps)t.addEventListener('dispose',()=>textureEvents.push(t));
  let binding;
  try{
    leaf.material.alphaTest=.25;
    await assert.rejects(prepareXieqiquCourtGardenR1({owner:f.owner,sources,layout,yieldControl,buildSupport:false}),/four-channel 4K material/);
    assert.equal(f.floor.material,f.stone);assert.equal(record.owner.disposed,false);assert.equal(bitmapCloses,0);
    leaf.material.alphaTest=originalAlpha;
    binding=await prepareXieqiquCourtGardenR1({owner:f.owner,sources,layout,yieldControl,buildSupport:false});
    assert.equal(binding.diagnostics.actualSourceTriangles,1020245);
    assert.equal(binding.diagnostics.drawnPlantTriangles,1020245*layout.placements.length);
    assert.equal(binding.diagnostics.rootContactChecks,219744);
    assert(binding.diagnostics.maximumRootGap<.0014);
    assert(binding.diagnostics.maximumRootBurial>.050&&binding.diagnostics.maximumRootBurial<.051);
    let borrowed=0;
    binding.group.traverse(n=>{
      if(n.userData.sourceSpecies!=='low-broadleaf')return;
      borrowed+=n.count;assert.equal(n.userData.navigation,false);
      const source=nodes.find(s=>s.geometry===n.geometry);assert(source);assert.equal(n.material,source.material);
      for(const slot of ['map','normalMap','roughnessMap','alphaMap'])assert.equal(n.material[slot],source.material[slot]);
    });
    assert.equal(borrowed,3*layout.placements.length);
    const support=createArchitectureSurface(binding.group);
    assert.equal(support.diagnostics.instanceCount,0);support.dispose();
    binding.dispose();binding.dispose();
    assert.equal(f.floor.material,f.stone);assert.equal(f.roof.material,f.stone);
    assert.equal(record.owner.disposed,false);assert.deepEqual(geometryEvents,[]);assert.deepEqual(materialEvents,[]);assert.deepEqual(textureEvents,[]);
    record.owner.dispose();record.owner.dispose();
    assert.equal(geometryEvents.length,3);assert.equal(materialEvents.length,2);assert.equal(textureEvents.length,4);assert.equal(bitmapCloses,4);
  }finally{
    leaf.material.alphaTest=originalAlpha;binding?.dispose();record.owner.dispose();f.cleanup();
  }
});
