import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {flowerOutline} from '../src/yuanmingyuan/xieqiqu-geometry.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {prepareXieqiquCourtGardenR1} from '../src/yuanmingyuan/xieqiqu-court-garden-r1.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {prepareGardenReflectionViews} from '../src/yuanmingyuan/garden-reflection-views.js';
import {createXieqiquCourtGardenR1Layout} from '../src/yuanmingyuan/xieqiqu-court-garden-r1-layout.js';
import {createXieqiquCourtGardenR2Layout} from '../src/yuanmingyuan/xieqiqu-court-garden-r2-layout.js';

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
const prepare=(f,extra={})=>prepareXieqiquCourtGardenR1({owner:f.owner,sources:f.sources,architecture:f.architecture,yieldControl,...extra});

test('keeps source floor, holes and shared roofing material while rendering full borrowed plants on actual bed triangles',async()=>{
  const f=fixture(),position=f.floor.geometry.attributes.position,index=f.floor.geometry.index,oldMaterial=f.floor.material,sourceDisposals=[];
  for(const r of [f.floor.geometry,oldMaterial,...f.sourceGeometries,...f.sourceMaterials])r.addEventListener('dispose',()=>sourceDisposals.push(r));
  const binding=await prepare(f),support=binding.support,own=[],instances=[];
  try{
    assert.notEqual(f.floor.material,oldMaterial);assert.equal(f.roof.material,oldMaterial);assert.equal(f.floor.geometry.attributes.position,position);assert.equal(f.floor.geometry.index,index);
    assert.equal(binding.assertCurrent(),true);assert.equal(binding.diagnostics.bedCount,4);
    assert.equal(binding.diagnostics.plantCount,124);assert.ok(binding.diagnostics.rootContactChecks>200);
    assert.ok(binding.diagnostics.floorCoverage.every(r=>r.missing<2e-4));
    assert.ok(binding.diagnostics.maximumRootGap<=.004);assert.ok(binding.diagnostics.maximumRootBurial<=.035);
    assert.equal(f.architecture.surfaceAt(395,-592,{maxY:4.2}),null);
    const p=binding.plan.beds[0],hit=support.surfaceAt(395+p.cx,-565+p.cz,{maxY:5});
    assert.ok(hit);assert.ok(Math.abs(hit.height-4.112)<1e-5);
    binding.group.traverse(node=>{
      if(node.isInstancedMesh){
        instances.push(node);assert.equal(node.userData.navigation,false);assert.ok(f.sourceGeometries.includes(node.geometry));assert.ok(f.sourceMaterials.includes(node.material));
        assert.equal(node.count,binding.plan.placements.filter(p=>p.species===node.userData.sourceSpecies&&p.bedId===node.userData.sourceBedId).length);
      }else if(node.isMesh)own.push(node.geometry);
    });
    assert.equal(instances.length,6);assert.equal(sourceDisposals.length,0);
    // The real default navigation filter must also exclude decorative instances.
    const combined=createArchitectureSurface(f.root);
    try{const h=combined.surfaceAt(395+p.cx,-565+p.cz,{maxY:5});assert.ok(Math.abs(h.height-4.112)<1e-5);assert.equal(combined.diagnostics.instanceCount,0);}finally{combined.dispose();}
    const ownedEvents=new Map([...own, f.floor.material].map(r=>[r,0]));for(const r of ownedEvents.keys())r.addEventListener('dispose',()=>ownedEvents.set(r,ownedEvents.get(r)+1));
    let instanceEvents=0;for(const r of instances)r.addEventListener('dispose',()=>instanceEvents++);
    binding.dispose();binding.dispose();
    assert.equal(binding.support,null);assert.equal(support.disposed,true);assert.equal(f.floor.material,oldMaterial);assert.equal(binding.group.parent,null);
    assert.equal(sourceDisposals.length,0);assert.ok([...ownedEvents.values()].every(v=>v===1));assert.equal(instanceEvents,6);
  }finally{binding.dispose();f.cleanup();}
});

test('rejects even a small actual floor gap inside a proposed apron',async()=>{
  const f=fixture({missingPatch:true});
  try{await assert.rejects(prepare(f),/triangles do not cover/);assert.equal(f.floor.material,f.stone);assert.equal(f.root.getObjectByName('xieqiqu-court-garden-r1'),undefined);}
  finally{f.cleanup();}
});

test('checks the real retained architecture above floor grade before binding',async()=>{
  const f=fixture({obstacle:true});
  try{await assert.rejects(prepare(f),/architecture conflicts/);assert.equal(f.floor.material,f.stone);assert.equal(f.root.getObjectByName('xieqiqu-court-garden-r1'),undefined);}
  finally{f.cleanup();}
});

for(const stage of ['bed-surfaces','plant-instances','ready'])test('cancellation at '+stage+' rolls back the base owner without disposing borrowed sources',async()=>{
  const f=fixture(),controller=new AbortController();let n=0;
  for(const resource of [f.floor.geometry,...f.sourceGeometries,...f.sourceMaterials])resource.addEventListener('dispose',()=>n++);
  try{
    await assert.rejects(prepare(f,{signal:controller.signal,onProgress:event=>{if(event.stage===stage)controller.abort(new Error('requested abort'));}}),/requested abort|invalidated/);
    assert.equal(f.floor.material,f.stone);assert.equal(n,0);assert.equal(f.root.getObjectByName('xieqiqu-court-garden-r1'),undefined);
    const retry=await prepare(f);retry.dispose();assert.equal(n,0);
  }finally{f.cleanup();}
});

test('borrowed source invalidation detaches instances and restores the original floor immediately',async()=>{
  const f=fixture(),binding=await prepare(f),support=binding.support;
  try{
    f.sourceGeometries[0].dispose();
    assert.equal(binding.disposed,true);assert.equal(binding.support,null);assert.equal(support.disposed,true);
    assert.equal(f.floor.material,f.stone);assert.equal(binding.group.parent,null);assert.equal(binding.diagnostics.sourceInvalidated,true);
  }finally{binding.dispose();f.cleanup();}
});

test('does not overwrite an external material replacement while invalidating',async()=>{
  const f=fixture(),binding=await prepare(f),external=new THREE.MeshStandardMaterial();
  try{f.floor.material=external;assert.throws(()=>binding.assertCurrent(),/material changed/);assert.equal(binding.disposed,true);assert.equal(f.floor.material,external);}
  finally{binding.dispose();f.cleanup();external.dispose();}
});

test('rejects a hidden source floor and missing actual source roots',async()=>{
  const f=fixture();
  try{
    f.floor.parent.visible=false;await assert.rejects(prepare(f),/visible and opaque/);f.floor.parent.visible=true;
    for(const g of f.sourceGeometries)g.translate(0,1,0);
    await assert.rejects(prepare(f),/rooted source geometry/);assert.equal(f.floor.material,f.stone);
  }finally{f.cleanup();}
});

test('concurrent preparation cannot borrow the same floor twice',async()=>{
  const f=fixture();let resume,entered;
  const waiting=new Promise(r=>{entered=r;});let first=true;
  const operation=prepare(f,{yieldControl:async()=>{if(first){first=false;entered();await new Promise(r=>{resume=r;});}}});
  try{await waiting;await assert.rejects(prepare(f),/unused placed Xieqiqu/);resume();const binding=await operation;binding.dispose();}
  finally{resume?.();f.cleanup();}
});

test('transformed source floor and new bed support use the same actual world frame',async()=>{
  const f=fixture();f.architecture.dispose();f.root.rotation.y=.43;f.root.scale.setScalar(1.3);f.root.updateMatrixWorld(true);f.architecture=createArchitectureSurface(f.root);
  const binding=await prepare(f);
  try{
    const bed=binding.plan.beds[0],point=new THREE.Vector3(bed.cx,.112,bed.cz).applyMatrix4(f.root.matrixWorld),hit=binding.support.surfaceAt(point.x,point.z,{maxY:point.y+1});
    assert.ok(hit);assert.ok(Math.abs(hit.height-point.y)<1e-5);
    f.root.position.x++;assert.throws(()=>binding.assertCurrent(),/placement\/material changed/);assert.equal(binding.disposed,true);assert.equal(f.floor.material,f.stone);
  }finally{binding.dispose();f.cleanup();}
});

test('the proposed beds retain the stated central, transverse, stair and urn reservations',()=>{
  const plan=createXieqiquCourtGardenR1Layout();
  assert.deepEqual(plan.beds.map(b=>b.id),['west-north-parterre','west-south-ribbon','east-north-parterre','east-south-ribbon']);
  assert.ok(plan.beds.every(b=>b.apron.every(([x,z])=>Math.abs(x)>8&&z<-16)));
  assert.ok(plan.beds.every(b=>b.apron.every(([,z])=>z<-30.25||z>-25.75)));
  assert.equal(plan.historicallySurveyed,undefined);assert.equal(plan.evidence.historicallySurveyed,false);
});

test('pre-composition mode follows the base placement and lets the real source support exclude every leaf',async()=>{
  const f=fixture(),binding=await prepareXieqiquCourtGardenR1({owner:f.owner,sources:f.sources,buildSupport:false,yieldControl});
  try{
    assert.equal(binding.support,null);assert.equal(binding.diagnostics.architectureAudit.boundedNorthCourt,true);
    f.root.position.set(208,7,-95);f.root.rotation.y=-.51;f.root.scale.setScalar(.9);f.root.updateMatrixWorld(true);
    assert.equal(binding.assertCurrent(),true);
    const support=createArchitectureSurface(f.root),bed=binding.plan.beds[0],point=new THREE.Vector3(bed.cx,.112,bed.cz).applyMatrix4(f.root.matrixWorld);
    try{const hit=support.surfaceAt(point.x,point.z,{maxY:point.y+1});assert.ok(Math.abs(hit.height-point.y)<1e-5);assert.equal(support.diagnostics.instanceCount,0);}
    finally{support.dispose();}
    const own=binding.createSupport();assert.equal(own,binding.support);assert.equal(binding.createSupport(),own);
    assert.ok(Math.abs(own.surfaceAt(point.x,point.z,{maxY:point.y+1}).height-point.y)<1e-5);
  }finally{binding.dispose();f.cleanup();}
});

test('bounded original-geometry audit still rejects actual obstacles inside the candidate',async()=>{
  const f=fixture({obstacle:true});
  try{await assert.rejects(prepareXieqiquCourtGardenR1({owner:f.owner,sources:f.sources,buildSupport:false,yieldControl}),/architecture conflicts/);assert.equal(f.floor.material,f.stone);}
  finally{f.cleanup();}
});

const instanceKey=matrix=>Array.from(new Float32Array(matrix.elements)).join(',');
const instancesOf=group=>{const result=[];group.traverse(node=>{if(node.isInstancedMesh)result.push(node);});return result;};

test('bed batches borrow every complete source part exactly once per placement with unchanged render bindings',async()=>{
  const f=fixture(),callbacks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'],textures=[],depthMaterials=[];
  for(const source of Object.values(f.sources)){
    const node=source.part.children[0];node.position.set(.006,0,-.007);node.rotation.y=.31;node.scale.set(.9,1,.9);
    node.castShadow=node.receiveShadow=true;node.renderOrder=7;
    for(const key of callbacks)node[key]=()=>{};
    node.customDepthMaterial=new THREE.MeshDepthMaterial();node.customDistanceMaterial=new THREE.MeshDistanceMaterial();depthMaterials.push(node.customDepthMaterial,node.customDistanceMaterial);
    const texture=new THREE.DataTexture(new Uint8Array([90,130,70,255]),1,1);node.material.map=texture;textures.push(texture);
    node.geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1],2));
    // Two original meshes with different local transforms exercise a full part,
    // rather than treating one mesh as the entire borrowed botanical source.
    const second=node.clone();second.name+='-second';second.position.set(-.006,.018,.008);source.part.add(second);
  }
  const binding=await prepare(f);
  try{
    const batches=instancesOf(binding.group);assert.equal(batches.length,12);
    let total=0;
    for(const [species,source]of Object.entries(f.sources))for(const node of source.part.children){
      source.part.updateWorldMatrix(true,true);
      const sourceMatrix=source.part.matrixWorld.clone().invert().multiply(node.matrixWorld),expected=new Map();
      for(const p of binding.plan.placements.filter(p=>p.species===species)){
        const matrix=new THREE.Matrix4().compose(new THREE.Vector3(p.x,binding.plan.levels.soilTop-binding.plan.levels.rootBurial,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(p.scale,p.scale,p.scale)).multiply(sourceMatrix);
        const key=instanceKey(matrix);assert.ok(!expected.has(key));expected.set(key,p.bedId);
      }
      for(const batch of batches.filter(batch=>batch.userData.sourceSpecies===species&&batch.name.endsWith('-'+node.name))){
        assert.equal(batch.geometry,node.geometry);assert.equal(batch.material,node.material);assert.equal(batch.geometry.attributes.uv,node.geometry.attributes.uv);
        for(const key of [...callbacks,'castShadow','receiveShadow','renderOrder','customDepthMaterial','customDistanceMaterial'])assert.equal(batch[key],node[key]);
        assert.ok(batch.boundingBox&&batch.boundingSphere);assert.equal(batch.frustumCulled,true);assert.equal(batch.userData.navigation,false);
        for(let i=0;i<batch.count;i++){
          const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);const key=instanceKey(matrix);
          assert.equal(expected.get(key),batch.userData.sourceBedId);assert.ok(expected.delete(key));total++;
          const box=node.geometry.boundingBox.clone().applyMatrix4(matrix);
          assert.ok(batch.boundingBox.clone().expandByScalar(1e-6).containsBox(box));
        }
      }
      assert.equal(expected.size,0);
    }
    assert.equal(total,248);assert.equal(binding.diagnostics.drawnPlantTriangles,496);
  }finally{binding.dispose();f.cleanup();textures.forEach(t=>t.dispose());depthMaterials.forEach(m=>m.dispose());}
});

// Clip complete fixture triangles against all six actual camera planes. This
// checks preserved visible geometry; it does not estimate fragment occlusion.
function visiblePlantTriangles(batches,frustum){
  const visible=[],world=new THREE.Matrix4(),instance=new THREE.Matrix4();let submitted=0;
  for(const batch of batches){
    if(batch.frustumCulled&&!frustum.intersectsObject(batch))continue;
    const geometry=batch.geometry,position=geometry.attributes.position,index=geometry.index,vertices=index?.count??position.count;
    submitted+=vertices/3*batch.count;
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,instance);world.multiplyMatrices(batch.matrixWorld,instance);
      for(let tri=0;tri<vertices;tri+=3){
        let polygon=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(tri+j):tri+j).applyMatrix4(world));
        for(const plane of frustum.planes){
          const input=polygon;polygon=[];
          for(let j=0;j<input.length;j++){
            const a=input[j],b=input[(j+1)%input.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
            if(da>=0)polygon.push(a);
            if((da>=0)!==(db>=0))polygon.push(a.clone().lerp(b,da/(da-db)));
          }
        }
        if(polygon.length)visible.push(batch.geometry.uuid+'|'+instanceKey(world)+'|'+tri);
      }
    }
  }
  return {visible:visible.sort(),submitted};
}

test('separate bed bounds avoid opposite-court submission and preserve visible triangles in main, reflection and shadow views',async()=>{
  const f=fixture(),binding=await prepare(f),batches=instancesOf(binding.group),global=[];
  const plane=new THREE.PlaneGeometry(2,2),sheet=new Reflector(plane,{textureWidth:2048,textureHeight:2048,clipBias:.0002});sheet.rotation.x=-Math.PI/2;sheet.position.y=4.13;sheet.updateMatrixWorld(true);
  try{
    for(const species of ['sedge','flower-shrub']){
      const parts=batches.filter(batch=>batch.userData.sourceSpecies===species),mesh=new THREE.InstancedMesh(parts[0].geometry,parts[0].material,parts.reduce((sum,b)=>sum+b.count,0));
      let next=0;for(const batch of parts)for(let i=0;i<batch.count;i++){const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);mesh.setMatrixAt(next++,matrix);}
      mesh.matrixWorld.copy(binding.group.matrixWorld);mesh.computeBoundingBox();mesh.computeBoundingSphere();global.push(mesh);
    }
    const views=[];
    for(const [id,position,target]of [['detail',[409,6,-613],[416,4.6,-602]],['wide',[453,37,-659],[395,12,-582]]]){
      const camera=new THREE.PerspectiveCamera(45,1.6,.08,22000);camera.position.fromArray(position);camera.lookAt(new THREE.Vector3().fromArray(target));camera.updateMatrixWorld(true);
      views.push({id,camera},...prepareGardenReflectionViews([sheet],camera).map(view=>({...view,id:id+'-reflection'})));
    }
    const shadow=new THREE.OrthographicCamera(-85,85,85,-85,1,900),focus=new THREE.Vector3(409,6,-613);
    shadow.position.copy(focus).addScaledVector(new THREE.Vector3(-.388081168,.816290877,.427857699),400);shadow.lookAt(focus);shadow.updateMatrixWorld(true);views.push({id:'day-shadow',camera:shadow});
    for(const {id,camera}of views){
      const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      const before=visiblePlantTriangles(global,frustum),after=visiblePlantTriangles(batches,frustum);
      assert.deepEqual(after.visible,before.visible,id);assert.ok(after.submitted<=before.submitted,id);
      if(id==='detail'){assert.equal(before.submitted,248);assert.equal(after.submitted,124);assert.ok(after.visible.length>0);}
      if(id==='wide')assert.equal(after.submitted,before.submitted);
    }
  }finally{global.forEach(mesh=>mesh.dispose());sheet.dispose();plane.dispose();binding.dispose();f.cleanup();}
});


test('the shared binding uses the supplied R2 matrices, original sources and unchanged court surfaces',async()=>{
  const f=fixture(),layout=createXieqiquCourtGardenR2Layout(),r1=createXieqiquCourtGardenR1Layout(),borrowed=[];
  for(const resource of [f.floor.geometry,f.stone,...f.sourceGeometries,...f.sourceMaterials])resource.addEventListener('dispose',()=>borrowed.push(resource));
  const binding=await prepare(f,{layout,buildSupport:false}),instances=binding.group.children.filter(node=>node.isInstancedMesh);
  let combined;
  try{
    assert.equal(binding.plan,layout);assert.equal(binding.group.name,layout.id);assert.equal(binding.diagnostics.id,layout.id);
    assert.deepEqual(layout.beds,r1.beds);assert.deepEqual(layout.reservations,r1.reservations);
    assert.deepEqual(layout.placements.map(p=>[p.id,p.bedId,p.species]),r1.placements.map(p=>[p.id,p.bedId,p.species]));
    assert.equal(binding.diagnostics.plantCount,layout.placements.length);assert.equal(binding.support,null);
    assert.equal(instances.length,6);let checked=0;
    for(const copy of instances){
      const source=f.sources[copy.userData.sourceSpecies].part.children[0];
      assert.equal(copy.geometry,source.geometry);assert.equal(copy.material,source.material);assert.equal(copy.userData.navigation,false);
      const placements=layout.placements.filter(p=>p.bedId===copy.userData.sourceBedId&&p.species===copy.userData.sourceSpecies);
      assert.equal(copy.count,placements.length);
      for(const [i,p]of placements.entries()){
        const expected=new THREE.Matrix4().compose(new THREE.Vector3(p.x,layout.levels.soilTop-layout.levels.rootBurial,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(p.scale,p.scale,p.scale)),actual=new THREE.Matrix4();copy.getMatrixAt(i,actual);
        assert.deepEqual(actual.elements,Array.from(new Float32Array(expected.elements)));checked++;
      }
    }
    assert.equal(checked,layout.placements.length);
    assert.ok(binding.diagnostics.maximumRootGap<=.004);assert.ok(binding.diagnostics.maximumRootBurial<=.035);
    assert.ok(binding.diagnostics.floorCoverage.every(row=>row.missing<2e-4));
    combined=createArchitectureSurface(f.root);assert.equal(combined.diagnostics.instanceCount,0);
    for(const bed of layout.beds){const hit=combined.surfaceAt(395+bed.cx,-565+bed.cz,{maxY:5});assert.ok(hit&&Math.abs(hit.height-4.112)<1e-5);}
    const disposed=instances.map(()=>0);instances.forEach((node,i)=>node.addEventListener('dispose',()=>disposed[i]++));
    combined.dispose();combined=null;binding.dispose();binding.dispose();
    assert.deepEqual(disposed,instances.map(()=>1));assert.deepEqual(borrowed,[]);assert.equal(f.floor.material,f.stone);
  }finally{combined?.dispose();binding.dispose();f.cleanup();}
});
