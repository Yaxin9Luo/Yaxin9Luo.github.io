import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {flowerOutline} from '../src/yuanmingyuan/xieqiqu-geometry.js';
import {auditCourtPavingUV,bindCourtPavingMaterialCandidate,courtPavingSource} from '../src/yuanmingyuan/court-paving-material-r2.js';
function fixture(){
 const courtRoot=new THREE.Group(),paving=new THREE.Group(),joints=new THREE.Group(),material=new THREE.MeshStandardMaterial();paving.name='xieqiqu-court-paving';joints.name='xieqiqu-court-stone-joints';courtRoot.add(paving,joints);
 const floor=new THREE.Mesh(extrudedPolygon([[-52,-51],[52,-51],[52,40.75],[-52,40.75]],-.65,0,[flowerOutline('haitang',0,26,13,8.5),flowerOutline('chrysanthemum',0,-27,4.8,4.8)]),material);paving.add(floor);
 for(let z=-50.1;z<40.2;z+=1.47){const mesh=new THREE.Mesh(new THREE.BoxGeometry(103,.010,.016),material);mesh.position.set(0,.003,z);joints.add(mesh);}
 for(let x=-51.2;x<51.7;x+=1.47){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.016,.010,90.75),material);mesh.position.set(x,.003,-.125);joints.add(mesh);}
 return{floor,courtRoot,joints,dispose(){courtRoot.traverse(node=>{if(node.isMesh)node.geometry.dispose();});material.dispose();}};
}
test('top metric UVs and real joint phase stay aligned as the complete court moves',()=>{
 const f=fixture();try{const before=auditCourtPavingUV(f);f.courtRoot.position.set(395,4,-565);f.courtRoot.rotation.y=.62;const after=auditCourtPavingUV(f);assert.ok(after.maxUVError<1e-10);assert.ok(Math.abs(after.grid.x.origin+51.2)<1e-6);assert.ok(Math.abs(after.grid.z.origin+50.1)<1e-6);assert.deepEqual(after.holes,[[0,-27],[0,26]]);for(let i=0;i<9;i++)assert.ok(Math.abs(before.uvToXZ.elements[i]-after.uvToXZ.elements[i])<1e-10);assert.equal(after.grid.x.lineCount,before.grid.x.lineCount);assert.equal(after.grid.z.lineCount,before.grid.z.lineCount);}finally{f.dispose();}
});
test('a single altered top UV fails instead of silently introducing a second paving phase',()=>{
 const f=fixture();try{const g=f.floor.geometry;let i=0;while(g.attributes.normal.getY(i)<.999)i++;g.attributes.uv.setX(i,g.attributes.uv.getX(i)+.2);assert.throws(()=>auditCourtPavingUV(f),/UVs or floor height changed/);}finally{f.dispose();}
});
test('a changed source joint width is rejected before any material is touched',()=>{
 const f=fixture();try{f.joints.children[0].geometry.scale(1,1,1.1);assert.throws(()=>auditCourtPavingUV(f),/16 mm/);assert.equal(f.floor.material.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);}finally{f.dispose();}
});
test('the original shared building material cannot be decorated as a private display clone',()=>{
 const f=fixture();try{const original=f.floor.material;assert.throws(()=>bindCourtPavingMaterialCandidate(f),/private court display/);assert.equal(f.floor.material,original);assert.equal(original.map,null);}finally{f.dispose();}
});

test('candidate switching and abort restore the private floor and release owned decoded texture leases once',()=>{
 const f=fixture(),oldFloorMaterial=f.floor.material;
 const material=new THREE.MeshStandardMaterial({roughness:.94});
 material.name='fixture-court-paving';material.userData.body='contemporary-court-garden-material';
 material.normalScale.set(.16,.16);
 const originalRoughness=new THREE.DataTexture(new Uint8Array([210,210,210,255]),1,1,THREE.RGBAFormat);
 material.roughnessMap=originalRoughness;f.floor.material=material;
 // The lifecycle fixture represents already-decoded full-size channels.
 // Real encoded and decoded source hashes are checked in the asset/native audit.
 const pixels=Object.fromEntries(Object.entries(courtPavingSource.files).map(([key,file])=>[key,{
   width:4096,height:4096,channels:4,origin:'lower-left',
   encodedSha256:file.sha256,decodedSha256:'0'.repeat(64),
   data:new Uint8Array(4096*4096*4).fill(key==='normal'?128:255),
 }]));
 const geometry=f.floor.geometry,originalNormal=material.normalScale.clone(),controller=new AbortController();
 let lease;
 try{
  lease=bindCourtPavingMaterialCandidate({...f,pixels,signal:controller.signal});
  assert.notDeepEqual(material.normalScale.toArray(),originalNormal.toArray());
  assert.equal(f.floor.geometry,geometry);assert.equal(f.floor.material,material);
  const retired={};for(const [name,texture]of Object.entries(lease.textures)){retired[name]=0;texture.addEventListener('dispose',()=>retired[name]++);}
  controller.abort();lease.dispose();
  assert.deepEqual(material.normalScale.toArray(),originalNormal.toArray());
  assert.equal(material.map,null);assert.equal(material.normalMap,null);assert.equal(material.roughnessMap,originalRoughness);
  assert.equal(material.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);
  assert.deepEqual(retired,{color:1,normal:1,roughness:1});
 }finally{lease?.dispose();material.dispose();originalRoughness.dispose();f.floor.material=oldFloorMaterial;f.dispose();}
});
