import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createBuildingDistanceAsset,createZhengjuesiDistanceAsset} from '../src/yuanmingyuan/zhengjuesi-distance-builder.js';
import {captureYuanmingyuanState,serializeYuanmingyuanArchive} from '../scripts/export-yuanmingyuan-assets.mjs';
import {restoreYuanmingyuanArchive} from '../src/yuanmingyuan/asset-archive.js';

const digest='a'.repeat(64),noCandidates=()=>[],noError=()=>0;
const options={id:'fixture',sourceArchiveDigest:digest,maximumErrorWorld:.05,candidateProvider:noCandidates,candidateError:noError,sparseInstanceLimit:2,yieldControl:async()=>{}};

function fixture(){
  const group=new THREE.Group();group.name='actual-small-building';group.position.set(.1,.2,.3);group.rotation.y=.13;group.renderOrder=7;
  const map=new THREE.DataTexture(new Uint8Array([250,0,30,255, 12,230,30,127, 14,0,240,0, 2,0,5,255]),2,2);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,3);map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;
  const material=new THREE.MeshPhysicalMaterial({map,roughness:.63,metalness:.2,clearcoat:.23,side:THREE.DoubleSide}),box=new THREE.BoxGeometry();material.name='real-pbr-material';box.name='unchanged-box';
  const owned=[box,material,map],normal=new THREE.Matrix4();
  for(let i=0;i<3;i++){
    const parent=new THREE.Group();parent.name='roof-'+i;parent.position.set(i*2,.25,-4);parent.rotation.y=i*.17;parent.renderOrder=7;group.add(parent);
    const mesh=new THREE.InstancedMesh(box,material,4);mesh.name='shared-boxes-'+i;mesh.castShadow=true;mesh.receiveShadow=false;mesh.layers.set(1);owned.push(mesh);
    for(let j=0;j<4;j++){normal.compose(new THREE.Vector3(j*.13,1,0),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.11),new THREE.Vector3(.08,.2,.15));mesh.setMatrixAt(j,normal);mesh.setColorAt(j,new THREE.Color(.4+j*.1,.7,.9));}parent.add(mesh);
  }
  const shape=new THREE.Shape([new THREE.Vector2(-1,-1),new THREE.Vector2(1,-1),new THREE.Vector2(1,1),new THREE.Vector2(-1,1)]),hole=new THREE.Path([new THREE.Vector2(-.3,-.3),new THREE.Vector2(-.3,.3),new THREE.Vector2(.3,.3),new THREE.Vector2(.3,-.3)]);shape.holes.push(hole);
  for(let i=0;i<2;i++){
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false}),mesh=new THREE.InstancedMesh(geometry,material,1);geometry.name='actual-pierced-wall-'+i;mesh.name='pierced-'+i;mesh.castShadow=true;mesh.receiveShadow=false;mesh.layers.set(1);mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(i*4,0,5));mesh.setColorAt(0,new THREE.Color(.8,.6,.7));group.add(mesh);owned.push(geometry,mesh);
  }
  group.updateMatrixWorld(true);let disposed=false;return {group,owned,material,map,dispose(){if(disposed)return;disposed=true;for(const object of owned)object.dispose();group.clear();}};
}

test('hybrid batching retains real apertures, PBR pixels, instance colors and shadow flags',async()=>{
  const source=fixture(),before=captureYuanmingyuanState(source).state;let result;
  try{
    result=await createBuildingDistanceAsset(source,options);assert.equal(result.report.originalDraws,5);assert.equal(result.report.distanceDraws,2);assert.equal(result.report.originalInstances,14);assert.equal(result.report.representedInstances,14);assert.equal(result.report.originalTriangles,result.report.distanceTriangles);
    const nodes=[];result.group.traverse(n=>{if(n.isMesh)nodes.push(n);});const dense=nodes.find(n=>n.isInstancedMesh),merged=nodes.find(n=>!n.isInstancedMesh);assert.equal(dense.count,12);assert.equal(dense.material,source.material);assert.equal(merged.material.map,source.map);assert.equal(merged.material.roughness,.63);assert.equal(merged.material.clearcoat,.23);assert.equal(merged.material.side,THREE.DoubleSide);assert.equal(merged.material.vertexColors,true);assert.equal(source.material.vertexColors,false);
    for(const n of nodes){assert.equal(n.castShadow,true);assert.equal(n.receiveShadow,false);assert.equal(n.layers.mask,2);assert.equal(n.parent.renderOrder,7);}
    assert(Math.abs(merged.geometry.attributes.color.getX(0)-.8)<1e-7);assert(Math.abs(merged.geometry.attributes.color.getY(0)-.6)<1e-7);assert.equal(dense.userData.sourceBindings.reduce((sum,r)=>sum+r.count,0),12);
    const matrix=new THREE.Matrix4(),point=new THREE.Vector3(.1,.2,.3),a=new THREE.Vector3(),b=new THREE.Vector3();let offset=0;
    source.group.traverse(node=>{if(!node.isInstancedMesh||node.count!==4)return;for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);a.copy(point).applyMatrix4(matrix).applyMatrix4(node.matrixWorld);dense.getMatrixAt(offset++,matrix);b.copy(point).applyMatrix4(matrix).applyMatrix4(dense.matrixWorld);assert(a.distanceTo(b)<=result.report.maximumErrorArchiveWorld+1e-12);}});
    const origin=new THREE.Vector3(0,0,10).applyMatrix4(source.group.matrixWorld),direction=new THREE.Vector3(0,0,-1).transformDirection(source.group.matrixWorld),ray=new THREE.Raycaster(origin,direction,0,6);ray.layers.set(1);assert.equal(ray.intersectObject(merged,false).length,0,'the actual rectangular aperture remains empty');
    ray.ray.origin.copy(new THREE.Vector3(.7,0,10).applyMatrix4(source.group.matrixWorld));assert(ray.intersectObject(merged,false).length>0,'wall next to the aperture remains solid');
    assert.deepEqual(captureYuanmingyuanState(source).state,before);assert.equal(result.report.nativeDistanceVisualReview,false);
  }finally{result?.dispose();source.dispose();}
});

test('one small paving instance reduces while a large platform retains the same full prototype',async()=>{
  const geometry=new RoundedBoxGeometry(1,1,1,2,.022);geometry.name='zhengjuesi-prototype-dressed-stone';const material=new THREE.MeshStandardMaterial(),group=new THREE.Group(),mesh=new THREE.InstancedMesh(geometry,material,2);group.add(mesh);mesh.setMatrixAt(0,new THREE.Matrix4().makeScale(.4,.04,.35));mesh.setMatrixAt(1,new THREE.Matrix4().makeScale(30,.19,20));let result;
  try{result=await createZhengjuesiDistanceAsset({group},{sourceArchiveDigest:digest,maximumErrorWorld:.04,yieldControl:async()=>{}});assert.equal(result.report.originalTriangles,600);assert.equal(result.report.distanceTriangles,312);assert.equal(result.report.geometries[0].retainedInstances,1);assert.equal(result.report.geometries[0].variants[0].instances,1);assert(result.report.maximumErrorArchiveWorld<.04);assert.equal(mesh.geometry,geometry);}
  finally{result?.dispose();mesh.dispose();geometry.dispose();material.dispose();}
});

test('transparent material retains its own mesh and exact geometry instead of entering opaque merge order',async()=>{
  const source=fixture();source.material.transparent=true;let result;
  try{result=await createBuildingDistanceAsset(source,options);assert.equal(result.report.retainedIndividualDraws,5);assert.equal(result.report.distanceDraws,5);assert.equal(result.report.distanceTriangles,result.report.originalTriangles);const output=[];result.group.traverse(n=>{if(n.isMesh)output.push(n);});assert(output.every(n=>n.material===source.material));}
  finally{result?.dispose();source.dispose();}
});

test('abort immediately after candidate production disposes the new candidate and never borrowed input',async()=>{
  const source=fixture(),controller=new AbortController(),geometry=new THREE.BoxGeometry();let candidateDisposals=0,sourceDisposals=0;geometry.addEventListener('dispose',()=>candidateDisposals++);source.material.addEventListener('dispose',()=>sourceDisposals++);
  try{await assert.rejects(createBuildingDistanceAsset(source,{...options,signal:controller.signal,candidateProvider:async()=>{controller.abort(new Error('fixture cancellation'));return [{geometry,proof:{certified:true}}];}}),/fixture cancellation/);assert.equal(candidateDisposals,1);assert.equal(sourceDisposals,0);}
  finally{source.dispose();}
});

test('sheared or reflected instance transforms are refused rather than changing Three normal semantics',async()=>{
  for(const matrix of [new THREE.Matrix4().makeScale(-1,1,1),new THREE.Matrix4().set(1,.3,0,0,0,1,0,0,0,0,1,0,0,0,0,1)]){
    const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.InstancedMesh(geometry,material,1);mesh.setMatrixAt(0,matrix);group.add(mesh);
    try{await assert.rejects(createBuildingDistanceAsset({group},options),/positive|Sheared/);}finally{mesh.dispose();geometry.dispose();material.dispose();}
  }
});

test('small real batched result survives the existing exact archive and owns resources independently',async()=>{
  const source=fixture();let result,restored,sourceDisposed=0;for(const r of source.owned)r.addEventListener('dispose',()=>sourceDisposed++);
  try{
    result=await createBuildingDistanceAsset(source,options);const archive=await serializeYuanmingyuanArchive(result,{id:'distance-fixture'});assert.equal(archive.metadata.verification.exactRoundtripPassed,true);restored=await restoreYuanmingyuanArchive(archive.glb,archive.metadata);assert.deepEqual(captureYuanmingyuanState(restored).state,captureYuanmingyuanState(result).state);
    const restoredNodes=[];restored.group.traverse(n=>{if(n.isMesh)restoredNodes.push(n);});for(const node of restoredNodes){assert.notEqual(node.material.map,source.map);assert.deepEqual(node.material.map.image.data,source.map.image.data);assert.equal(node.material.map.colorSpace,THREE.SRGBColorSpace);}
    const disposal=result.dispose();assert.deepEqual(result.dispose(),disposal);assert.equal(disposal.borrowedSourceResourcesDisposed,0);assert.equal(sourceDisposed,0);restored.dispose();restored=null;assert.equal(sourceDisposed,0);
  }finally{restored?.dispose();result?.dispose();source.dispose();}
});

test('empty candidate provider and sparse limit zero preserve every original shared geometry buffer',async()=>{
  const source=fixture(),original=new Set();source.group.traverse(n=>{if(n.isMesh)original.add(n.geometry);});let result;
  try{result=await createBuildingDistanceAsset(source,{...options,sparseInstanceLimit:0});assert.equal(result.report.distanceTriangles,result.report.originalTriangles);assert.equal(result.report.mergedDraws,0);assert.equal(result.report.distanceDraws,3);result.group.traverse(n=>{if(n.isMesh){assert(n.isInstancedMesh);assert(original.has(n.geometry));assert.equal(n.material,source.material);}});assert.equal(result.report.representedInstances,14);}
  finally{result?.dispose();source.dispose();}
});

test('PBR identity and different shadow flags cannot collapse into a shared draw',async()=>{
  const source=fixture(),extra=source.group.children[0].children[0].clone(false),material=source.material.clone();material.roughness=.19;extra.material=material;extra.castShadow=false;extra.name='distinct-glazed-unshadowed';source.group.add(extra);let result;
  try{result=await createBuildingDistanceAsset(source,{...options,sparseInstanceLimit:0});assert.equal(result.report.distanceDraws,4);const special=[];result.group.traverse(n=>{if(n.isMesh&&n.material===material)special.push(n);});assert.equal(special.length,1);assert.equal(special[0].castShadow,false);assert.equal(special[0].material.roughness,.19);}
  finally{result?.dispose();extra.dispose();material.dispose();source.dispose();}
});
