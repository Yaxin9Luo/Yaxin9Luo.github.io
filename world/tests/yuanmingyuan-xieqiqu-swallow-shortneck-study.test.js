import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createContinuousSwallowBody} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {copperSwallowComponentSpecs} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {copperSwallowPoseComponentSpecs} from '../src/yuanmingyuan/xieqiqu-swallow-pose-study.js';
import {applyShortNeckBodyGeometry,copperSwallowShortNeckComponentSpecs,createXieqiquCopperSwallowShortNeckStudy,createXieqiquCopperSwallowShortNeckReviewStudy} from '../src/yuanmingyuan/xieqiqu-swallow-shortneck-study.js';
import {poseShortNeckBodyPoint,swallowShortNeckMouth} from '../src/yuanmingyuan/xieqiqu-swallow-neck-pose.js';
import {stoneFishStudyViews as pureFishViews} from '../src/yuanmingyuan/xieqiqu-stone-fish-views.js';
import {stoneFishStudyViews as originalFishViews} from '../src/yuanmingyuan/xieqiqu-stone-fish.js';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';

test('standalone short-neck entry retains all 79 IDs and exactly reuses the 76 unchanged component producers',()=>{
  assert.deepEqual(copperSwallowShortNeckComponentSpecs.map(p=>[p.id,p.role]),copperSwallowPoseComponentSpecs.map(p=>[p.id,p.role]));let unchanged=0;
  for(let i=0;i<79;i++){const old=copperSwallowPoseComponentSpecs[i],next=copperSwallowShortNeckComponentSpecs[i];if(old.posePart!=='body'&&old.posePart!=='eye'){assert.equal(next,old);unchanged++;}}
  assert.equal(unchanged,76);
  for(const create of [createXieqiquCopperSwallowShortNeckStudy,createXieqiquCopperSwallowShortNeckReviewStudy])assert.throws(()=>create({signal:AbortSignal.abort()}),{name:'AbortError'});
  assert.throws(()=>createXieqiquCopperSwallowShortNeckStudy(),/original source materials/);
});

test('the complete-entry deformation applies the reviewed field to a real local neck while preserving indices and UVs',()=>{
  const geometry=createContinuousSwallowBody({endZ:.20}),ids=geometry.index.array.slice(),uv=geometry.attributes.uv.array.slice(),position=geometry.attributes.position,original=position.array.slice(),p=new THREE.Vector3();
  try{applyShortNeckBodyGeometry(geometry);assert.deepEqual(geometry.index.array,ids);assert.deepEqual(geometry.attributes.uv.array,uv);assert.deepEqual(geometry.userData.mouthAnchor,swallowShortNeckMouth);
    for(let i=0;i<position.count;i++){p.fromArray(original,i*3);poseShortNeckBodyPoint(p,p);assert.ok(p.distanceTo(new THREE.Vector3().fromBufferAttribute(position,i))<1e-7);}
    assert.throws(()=>applyShortNeckBodyGeometry(geometry),/fresh unposed/);
  }finally{geometry.dispose();}
});

test('both actual eyes receive the rigid head translation and preserve every original normal, index and UV',()=>{
  for(const spec of copperSwallowShortNeckComponentSpecs.filter(p=>p.posePart==='eye')){
    const geometry=spec.create(),old=copperSwallowComponentSpecs.find(p=>p.id===spec.id).create(),p=new THREE.Vector3();
    try{assert.deepEqual(geometry.index.array,old.index.array);assert.deepEqual(geometry.attributes.uv.array,old.attributes.uv.array);assert.deepEqual(geometry.attributes.normal.array,old.attributes.normal.array);
      for(let i=0;i<geometry.attributes.position.count;i++){p.fromBufferAttribute(old.attributes.position,i);poseShortNeckBodyPoint(p,p);assert.ok(p.distanceTo(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i))<1e-7);const n=new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal,i);assert.ok(Math.abs(n.length()-1)<2e-5);}
    }finally{geometry.dispose();old.dispose();}
  }
});

test('pure registry views and bird sources stay exact; shared material provider retains actual copper output',async()=>{
  for(const name of ['xieqiqu-stone-fish-views.js','xieqiqu-swallow-shortneck-views.js']){const text=await readFile(new URL('../src/yuanmingyuan/'+name,import.meta.url),'utf8');assert.doesNotMatch(text,/\bimport\b|\bexport\s+[^;]*\bfrom\b/);}
  assert.deepEqual(pureFishViews,originalFishViews);
  const base=new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
  for(const freezeFile of ['pose-full-first-after-eye-freeze.json','short-neck-local-freeze.json']){const freeze=JSON.parse(await readFile(new URL(freezeFile,base)));for(const [file,hash]of Object.entries(freeze.files)){
    // The shared study now also exports an authorized south-pool context. Its
    // original complete-file SHA remains in the historical snapshot; compare
    // the actual copper output below instead of rejecting unrelated additions.
    if(file==='world/src/yuanmingyuan/xieqiqu-study.js')continue;
    assert.equal(sha(await readFile(new URL('../../'+file,import.meta.url))),hash,file);
  }}
  const old=JSON.parse(await readFile(new URL('shortneck-full-first/results.json',base))),owner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']),materials=Object.values(owner.materials),textures=[...new Set(materials.flatMap(m=>Object.values(m).filter(t=>t?.isTexture)))],resources=[...materials,...textures];let released=0;
  for(const resource of resources)resource.addEventListener('dispose',()=>released++);
  try{
    assert.equal(owner.diagnostics.geometryConstructed,false);
    assert.deepEqual(materials.map(m=>({name:m.name,type:m.type,color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),side:m.side,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,depthTest:m.depthTest})),old.materials);
    assert.deepEqual(textures.map(t=>({name:t.name,width:t.image.width,height:t.image.height,bytes:t.image.data.byteLength,pixelSHA256:sha(Buffer.from(t.image.data.buffer,t.image.data.byteOffset,t.image.data.byteLength)),colorSpace:t.colorSpace})),old.textures);
  }finally{owner.dispose();owner.dispose();}
  assert.equal(released,resources.length);
});
