import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {registerBotanicalParts,getBotanicalParts,botanicalReady,loadBotanicalVariant,loadBotanicalAssets} from '../src/botanical-cache.js';
import {createGroveTree} from '../src/grove-foliage.js';
import {createFoliageLOD} from '../src/foliage-lod.js';
import {environmentWind} from '../src/environment-wind.js';
const parts=()=>({branches:new THREE.BoxGeometry(1,4,1),leaves:new THREE.SphereGeometry(2,6,4),botanicalDetail:{branches:7,leaves:31,flowers:19},name:'Cached exact source'});

test('registered exact parts build independent groups with shared geometry and original material/wind contract',()=>{
  const source=parts();registerBotanicalParts('cherry',99101,'near',source);
  assert.equal(botanicalReady('cherry',99101,'near'),true);
  const a=createGroveTree('cherry',99101,'near'),b=createGroveTree('cherry',99101,'near');
  assert.notEqual(a,b);assert.notEqual(a.leavesMesh,b.leavesMesh);
  assert.equal(a.leavesMesh.geometry,source.leaves);assert.equal(b.leavesMesh.geometry,source.leaves);
  assert.equal(a.leavesMesh.material,b.leavesMesh.material);assert.equal(a.branchesMesh.material,b.branchesMesh.material);
  assert.equal(a.leavesMesh.geometry.userData.sharedAsset,true);assert.equal(a.leavesMesh.material.userData.sharedAsset,true);
  assert.deepEqual(a.userData.botanicalDetail,source.botanicalDetail);assert.equal(a.userData.detailLevel,'near');
  assert.equal(a.leavesMesh.material.transparent,false);assert.equal(a.leavesMesh.material.vertexColors,true);assert.equal(a.leavesMesh.material.side,THREE.DoubleSide);
  assert.ok(a.leavesMesh.material.map&&a.leavesMesh.material.normalMap);assert.ok(a.leavesMesh.material.normalScale.x>.4);
  for(const material of[a.leavesMesh.material,a.leavesMesh.customDepthMaterial,a.leavesMesh.customDistanceMaterial]){
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:''};material.onBeforeCompile(shader);assert.equal(shader.uniforms.environmentWindTime,environmentWind.time);
  }
  a.position.x=9;assert.equal(b.position.x,0);
});

test('an empty placement family is skipped without building its variants',()=>{
  // Unknown botanical kinds would throw if the procedural factory ran.
  const lod=createFoliageLOD(new THREE.Group(),[{kind:'must-not-build',seed:7,placements:[]}]);
  assert.equal(lod.families.size,0);assert.equal(lod.chunks.length,0);assert.equal(lod.stats.treeCount,0);
});

test('cached LOD variants preserve shared surfaces without disposing them at assembly',()=>{
  for(const level of['near','mid','far'])registerBotanicalParts('silver',99102,level,parts());
  const specimen=createGroveTree('silver',99102),disposed=[];
  specimen.leavesMesh.material.addEventListener('dispose',()=>disposed.push('leaf'));
  specimen.branchesMesh.material.addEventListener('dispose',()=>disposed.push('branch'));
  const lod=createFoliageLOD(new THREE.Group(),[{kind:'silver',seed:99102,placements:[{x:1,y:2,z:3,s:1}]}]);
  assert.deepEqual(disposed,[]);assert.equal(lod.chunks.length,1);assert.equal(lod.chunks[0].levels[0][1].geometry,specimen.leavesMesh.geometry);
});

test('variant load uses hashed descriptor, bakes quantization transforms once, and passes cancellation context',async()=>{
  const signal=new AbortController().signal,seen=[];
  const loadGLTFImpl=async(asset,context)=>{
    seen.push({asset,context});const scene=new THREE.Group();
    for(const name of['branches','leaves']){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));mesh.name=name;mesh.position.set(2,3,4);mesh.scale.setScalar(5);scene.add(mesh);}
    scene.userData={botanicalDetail:{branches:2,leaves:3,flowers:0},name:'fixture'};return {scene};
  };
  const manifest={'botanical/pine/99103/near':{id:'botanical/pine/99103/near',url:'/runtime/botanical.test-hash.glb',kind:'pine',seed:99103,level:'near',bytes:123}};
  await loadBotanicalVariant('pine',99103,'near',{signal,deadline:98765,attemptId:9,manifest,loadGLTFImpl});
  assert.equal(seen[0].asset.url,'/runtime/botanical.test-hash.glb');assert.equal(seen[0].context.signal,signal);assert.equal(seen[0].context.deadline,98765);
  const cached=getBotanicalParts('pine',99103,'near');cached.branches.computeBoundingBox();assert.equal(cached.branches.boundingBox.min.x,-.5);assert.equal(cached.branches.boundingBox.max.y,5.5);
  await loadBotanicalVariant('pine',99103,'near',{manifest,loadGLTFImpl});assert.equal(seen.length,1);
});

test('failed or cancelled variant loads do not register a fallback and can retry',async()=>{
  const manifest={'botanical/lilac/99104/near':{id:'botanical/lilac/99104/near',url:'/missing.glb'}},controller=new AbortController();
  await assert.rejects(loadBotanicalVariant('lilac',99104,'near',{manifest,loadGLTFImpl:async()=>{throw new Error('HTTP 404');}}));assert.equal(botanicalReady('lilac',99104),false);
  controller.abort();await assert.rejects(loadBotanicalVariant('lilac',99104,'near',{manifest,signal:controller.signal,loadGLTFImpl:async()=>{throw new Error('should not fetch');}}));
  assert.equal(getBotanicalParts('lilac',99104),null);
  await loadBotanicalVariant('lilac',99104,'near',{manifest,loadGLTFImpl:async()=>{const scene=new THREE.Group();for(const name of['branches','leaves']){const mesh=new THREE.Mesh(new THREE.BoxGeometry());mesh.name=name;scene.add(mesh);}return {scene};}});assert.equal(botanicalReady('lilac',99104),true);
  await assert.rejects(loadBotanicalAssets({families:[{kind:'unknown',seed:9}],levels:['near']}),/manifest/i);
});
