import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadHerbariumBuilder} from './helpers/herbarium-builder-module.js';

const api=await loadHerbariumBuilder();
function triangle(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute([.2,.3,.91,.2,.3,.91,.2,.3,.91],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));g.setIndex([0,1,2]);return g;
}
function bytes(g){return Object.fromEntries([...Object.entries(g.attributes),['index',g.index]].map(([name,a])=>[name,Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString('hex')]));}
function source(){
  const geometry=triangle(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(geometry,material),scene=new THREE.Group();
  mesh.name='fern';mesh.rotation.set(.17,-.3,.12);mesh.scale.set(1.2,.8,1.1);scene.add(mesh);
  api.bindHerbariumBotanicalSource('fern_02',scene);return {geometry,material,mesh};
}

test('embedded and isolated source pieces allocate one private clone and preserve borrowed source',()=>{
  for(const isolated of [false,true]){
    const {geometry,mesh}=source(),before=bytes(geometry),expected=geometry.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(),mesh.quaternion,mesh.scale));
    if(isolated){expected.computeBoundingBox();const center=expected.boundingBox.getCenter(new THREE.Vector3());expected.translate(-center.x,-expected.boundingBox.min.y,-center.z);}
    else expected.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(2,3,4),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.4),new THREE.Vector3(1.7,1.7,1.7)));
    expected.applyMatrix4(new THREE.Matrix4());
    const original=THREE.BufferGeometry.prototype.clone;let clones=0,group;
    THREE.BufferGeometry.prototype.clone=function(...args){clones++;return original.apply(this,args);};
    try{if(isolated)group=api.createHerbariumBotanicalSpecimen('fern_02');else{const b=new api.Builder('test',[1,1,1]);api.sourcePlant(b,'fern_02',0,2,3,4,1.7,.4);group=b.finish();}}
    finally{THREE.BufferGeometry.prototype.clone=original;}
    try{
      assert.equal(clones,1,'one private source clone; no second Builder copy');
      for(const name of ['position','normal','uv'])assert.deepEqual(group.children[0].geometry.attributes[name].array,expected.attributes[name].array,`unchanged ${name} transform/normalization passes`);
      assert.deepEqual(bytes(geometry),before);assert.notEqual(group.children[0].geometry.attributes.position.array.buffer,geometry.attributes.position.array.buffer);
    }finally{api.disposeHerbariumAsset(group);expected.dispose();geometry.dispose();}
  }
});

test('copied bucket inputs are released before welding while parts and support remain valid',()=>{
  const b=new api.Builder('test',[1,1,1]),borrowed=triangle(),before=bytes(borrowed);let sourceDisposals=0;
  borrowed.addEventListener('dispose',()=>sourceDisposals++);
  b.add(borrowed,'floor','supported triangle',new THREE.Vector3(2,0,3),null,{keepUV:true,support:true,collider:true});
  const bucket=[...b.buckets.values()][0],inputs=bucket.geometries,parts=bucket.parts;let inputDisposals=0,welds=0;
  inputs[0].addEventListener('dispose',()=>inputDisposals++);
  api.hooks.beforeWeld=()=>{welds++;assert.equal(inputs.length,0,'processed input array must stop retaining CPU buffers before weld');assert.equal(inputDisposals,1);};
  let group;
  try{group=b.finish();}finally{delete api.hooks.beforeWeld;}
  try{assert.equal(welds,1);assert.equal(sourceDisposals,0);assert.deepEqual(bytes(borrowed),before);assert.equal(group.children[0].userData.parts,parts);assert.equal(parts[0].firstIndex,0);assert.equal(parts[0].indexCount,3);assert.deepEqual(group.userData.supportMeshes,['floor:support']);assert.equal(group.userData.colliders.length,1);}
  finally{if(group)api.disposeHerbariumAsset(group);borrowed.dispose();}
});

test('failed later merge cleans remaining private inputs and completed output once',()=>{
  const b=new api.Builder('test',[1,1,1]),borrowed=triangle();let borrowedDisposals=0,materialDisposals=0;
  borrowed.addEventListener('dispose',()=>borrowedDisposals++);
  for(const key of ['floor','stone'])b.add(borrowed,key,key,new THREE.Vector3(),null,{keepUV:true});
  const inputs=[...b.buckets.values()].flatMap(bucket=>bucket.geometries),counts=new Map(inputs.map(g=>[g,0]));
  for(const g of inputs)g.addEventListener('dispose',()=>counts.set(g,counts.get(g)+1));
  api.getHerbariumMaterials().floor.addEventListener('dispose',()=>materialDisposals++);
  let merges=0,output,outputDisposals=0;
  api.hooks.beforeMerge=()=>{if(++merges===2){output=b.group.children[0].geometry;output.addEventListener('dispose',()=>outputDisposals++);throw new Error('later merge failure');}};
  try{assert.throws(()=>b.finish(),/later merge failure/);}finally{delete api.hooks.beforeMerge;}
  assert.ok(output);assert.equal(outputDisposals,1);assert.deepEqual([...counts.values()],[1,1]);assert.ok([...b.buckets.values()].every(bucket=>bucket.geometries.length===0));assert.equal(b.group.children.length,0);assert.equal(borrowedDisposals,0);assert.equal(materialDisposals,0);borrowed.dispose();
});

test('owned input transfers on entry even when attribute preparation fails',()=>{
  const b=new api.Builder('test',[1,1,1]),first=triangle(),second=triangle();let a=0,c=0;
  first.addEventListener('dispose',()=>a++);second.addEventListener('dispose',()=>c++);
  b.add(first,'source-test','first',new THREE.Vector3(),null,{owned:true,keepUV:true});
  second.computeBoundingBox=()=>{throw new Error('bounds failure');};
  assert.throws(()=>b.add(second,'source-test','second',new THREE.Vector3(),null,{owned:true,keepUV:true}),/bounds failure/);
  assert.equal(a,1,'earlier transferred input cleaned');assert.equal(c,1,'current transferred input cleaned');assert.ok([...b.buckets.values()].every(bucket=>bucket.geometries.length===0));
});

test('a failed weld releases the combined geometry and pending inputs without touching materials',()=>{
  const b=new api.Builder('test',[1,1,1]),borrowed=triangle();let merged,disposals=0;
  b.add(borrowed,'floor','first',new THREE.Vector3(),null,{keepUV:true});
  api.hooks.afterMerge=geometry=>{merged=geometry;geometry.addEventListener('dispose',()=>disposals++);};
  api.hooks.beforeWeld=()=>{throw new Error('weld failure');};
  try{assert.throws(()=>b.finish(),/weld failure/);}finally{delete api.hooks.afterMerge;delete api.hooks.beforeWeld;}
  assert.ok(merged);assert.equal(disposals,1);assert.equal(b.group.children.length,0);assert.ok([...b.buckets.values()].every(bucket=>bucket.geometries.length===0));borrowed.dispose();
});

test('source transform failure before transfer releases its private clone and earlier Builder inputs',()=>{
  const {geometry}=source(),before=bytes(geometry),b=new api.Builder('test',[1,1,1]),first=triangle();let firstDisposals=0,tempDisposals=0,borrowedDisposals=0;
  first.addEventListener('dispose',()=>firstDisposals++);geometry.addEventListener('dispose',()=>borrowedDisposals++);
  b.add(first,'source-test','first',new THREE.Vector3(),null,{owned:true,keepUV:true});
  geometry.clone=function(){const g=THREE.BufferGeometry.prototype.clone.call(this);g.addEventListener('dispose',()=>tempDisposals++);g.applyMatrix4=()=>{throw new Error('source transform failure');};return g;};
  assert.throws(()=>api.sourcePlant(b,'fern_02',0,0,0,0,1),/source transform failure/);
  assert.equal(firstDisposals,1);assert.equal(tempDisposals,1);assert.equal(borrowedDisposals,0);assert.deepEqual(bytes(geometry),before);geometry.dispose();
});

test('finished geometry remains alive until the last registered clone is disposed',()=>{
  source();const group=api.createHerbariumBotanicalSpecimen('fern_02'),clone=api.cloneHerbariumAsset(group),geometry=group.children[0].geometry,material=group.children[0].material;let geometries=0,materials=0;
  geometry.addEventListener('dispose',()=>geometries++);material.addEventListener('dispose',()=>materials++);
  assert.equal(clone.children[0].geometry,geometry);assert.equal(clone.children[0].material,material);
  api.disposeHerbariumAsset(group);api.disposeHerbariumAsset(group);assert.equal(geometries,0);
  api.disposeHerbariumAsset(clone);api.disposeHerbariumAsset(clone);assert.equal(geometries,1);assert.equal(materials,0);
});

test('multi-piece specimen failure releases untransferred copies and transferred inputs exactly once',()=>{
  for(const failDuringAdd of [false,true]){
    const scene=new THREE.Group(),originals=[triangle(),triangle()],counts=[];let borrowedDisposals=0;
    originals.forEach((g,i)=>{const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial());mesh.name=`pot piece ${i}`;scene.add(mesh);g.addEventListener('dispose',()=>borrowedDisposals++);});
    api.bindHerbariumBotanicalSource('potted_plant_01',scene);
    originals.forEach((g,i)=>{g.clone=function(){const copy=THREE.BufferGeometry.prototype.clone.call(this),record={disposals:0};counts.push(record);copy.addEventListener('dispose',()=>record.disposals++);if(i===1){if(failDuringAdd){const bounds=copy.computeBoundingBox;let calls=0;copy.computeBoundingBox=function(){if(++calls===3)throw new Error('specimen transfer failure');return bounds.call(this);};}else copy.applyMatrix4=()=>{throw new Error('specimen preparation failure');};}return copy;};});
    assert.throws(()=>api.createHerbariumBotanicalSpecimen('potted_plant_01'),failDuringAdd?/specimen transfer failure/:/specimen preparation failure/);
    assert.equal(counts.length,2);assert.deepEqual(counts.map(c=>c.disposals),[1,1]);assert.equal(borrowedDisposals,0);originals.forEach(g=>g.dispose());
  }
});
