import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {projectFangwaiguanSurfaceUVs,configureFangwaiguanMaterials,cutSurfaceRoughness,whitewashedPlasterColor,courtyardPavingColor} from '../src/yuanmingyuan/fangwaiguan-materials.js';

test('pale limewash keeps photographed variation without importing the brown base colour',()=>{
  const source=Uint8Array.from([120,75,25,255,160,115,65,255]),copy=source.slice();
  const output=whitewashedPlasterColor(source);
  assert.deepEqual(source,copy);assert.ok(output[0]>200&&output[2]>180);
  assert.ok(output[4]>output[0]);assert.equal(output[3],255);assert.equal(output[7],255);
});

test('outdoor cut-stone calibration keeps the source variation and alpha without changing source pixels',()=>{
  const source=Uint8Array.from([0,0,0,255,128,128,128,123,255,255,255,255]),copy=source.slice();
  const cut=cutSurfaceRoughness(source,[.56,.84]);
  assert.deepEqual(source,copy);assert.equal(cut[0],143);assert.equal(cut[8],214);
  assert.ok(cut[4]>cut[0]&&cut[4]<cut[8]);assert.equal(cut[7],123);
});

test('courtyard stones retain joints and tile variation in a neutral outdoor palette',()=>{
  const source=Uint8Array.from([40,35,20,255,200,175,95,255]),copy=source.slice();
  const output=courtyardPavingColor(source);
  assert.deepEqual(source,copy);assert.ok(output[4]-output[0]>50,'grout must remain visibly darker than a tile');
  assert.ok(Math.abs(output[4]-output[6])<5,'the warm slab source must not make the court orange');
  assert.equal(output[3],255);assert.equal(output[7],255);
});

test('mineral grain uses metres through parent transforms without moving stone surfaces',()=>{
  const geometry=new THREE.PlaneGeometry(2,3).toNonIndexed();
  const positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice();
  const frame=new THREE.Matrix4().makeRotationY(Math.PI/2);frame.setPosition(7,5,11);
  projectFangwaiguanSurfaceUVs(geometry,frame);
  assert.deepEqual(geometry.attributes.position.array,positions);
  assert.deepEqual(geometry.attributes.normal.array,normals);
  const uv=geometry.attributes.uv,point=new THREE.Vector3();
  for(let i=0;i<uv.count;i++){
    point.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(frame);
    assert.ok(Math.abs(uv.getX(i)+point.z)<1e-6);
    assert.ok(Math.abs(uv.getY(i)-point.y)<1e-6);
  }
  geometry.dispose();
});

test('opposite stone faces retain right-handed tangent orientation',()=>{
  const source=new THREE.BoxGeometry(2,3,4),geometry=source.toNonIndexed();source.dispose();
  projectFangwaiguanSurfaceUVs(geometry);
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    const u1=uv.getX(i+1)-uv.getX(i),u2=uv.getX(i+2)-uv.getX(i),v1=uv.getY(i+1)-uv.getY(i),v2=uv.getY(i+2)-uv.getY(i);
    const determinant=u1*v2-u2*v1;assert.ok(determinant>0,'front-facing winding must not mirror the normal map');
    assert.ok(new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)).dot(new THREE.Vector3().fromBufferAttribute(n,i))>0);
  }
  geometry.dispose();
});

function smallPackage(){
  const manifest={id:'fangwaiguan-material-r4-candidate',sources:{}},maps={};
  for(const [role,tileMetres] of [['marble',1.5],['plaster',3],['paving',1.5]]){
    manifest.sources[role]={width:2,height:2,tileMetres,files:{},provider:'fixture',asset:role,sourceURL:'fixture://'+role,license:'CC0-1.0'};maps[role]={};
    for(const channel of ['color','normal','roughness']){
      const sha=role+'-'+channel;manifest.sources[role].files[channel]={sha256:sha};
      maps[role][channel]={width:2,height:2,channels:4,origin:'lower-left',data:new Uint8Array(16),encodedSha256:sha,decodedSha256:'fixture'};
    }
  }
  return {manifest,maps};
}
function builder(){return {textures:new Set(),m:Object.fromEntries(['stone','carving','warmBlock','coolBlock','recess','paving','plaster','tile','variedTile','blueTile','variedBlueTile','copper'].map(name=>[name,new THREE.MeshPhysicalMaterial()]))};}
function release(b){for(const texture of b.textures)texture.dispose();for(const material of Object.values(b.m))material.dispose();}

test('paving joints never become the carved facade texture, and mineral normal maps remain linear',()=>{
  const b=builder();try{
    configureFangwaiguanMaterials(b,smallPackage());
    assert.notEqual(b.m.paving.map,b.m.carving.map);
    assert.equal(b.m.carving.map,b.m.stone.map);
    assert.equal(b.m.plaster.map.repeat.x,1/3);
    assert.equal(b.m.carving.map.repeat.x,1/1.5);
    assert.equal(b.m.carving.map.colorSpace,THREE.SRGBColorSpace);
    assert.equal(b.m.carving.normalMap.colorSpace,THREE.NoColorSpace);
    assert.equal(b.m.carving.roughnessMap.colorSpace,THREE.NoColorSpace);
    assert.equal(b.m.tile.map,null,'mineral maps must not leak onto glazed roofing');
    assert.equal(b.materialStudy.artApproved,false);
  }finally{release(b);}
});

test('incomplete decoded packages cannot leave partially created GPU textures',()=>{
  const b=builder(),pixels=smallPackage();delete pixels.maps.paving.roughness;
  try{assert.throws(()=>configureFangwaiguanMaterials(b,pixels),/Invalid decoded/);assert.equal(b.textures.size,0);}
  finally{release(b);}
});
