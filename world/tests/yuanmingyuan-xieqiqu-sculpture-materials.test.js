import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';
import {createXieqiquStoneFishReviewStudy,createXieqiquCopperSwallowReviewStudy} from '../src/yuanmingyuan/xieqiqu-sculpture-studies.js';

test('independent copper material owner matches frozen sheep pixels and disposes once without a model',()=>{
  const owner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']),resources=new Set(Object.values(owner.materials)),counts=new Map(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  for(const material of resources)for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
  for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  assert.deepEqual(owner.diagnostics,{geometryConstructed:false,materials:2,textures:2});assert.equal(owner.materials.copper.roughness,.70);assert.equal(owner.materials.copper.metalness,.81);
  assert.equal(sha(owner.materials.copper.normalMap.image.data),'2de22974058efe96acb591622929adea58312bdab19bab04e4a7c7e315c02a14');assert.equal(sha(owner.materials.copper.roughnessMap.image.data),'77e33232dbf9cc3038552ea5edf707cf1ccf65645f091ab58f0cc3ecfb39123d');
  owner.dispose();owner.dispose();assert.ok([...counts.values()].every(n=>n===1));assert.equal(owner.disposed,true);
});

test('review entry cancellation and invalid material roles cannot start any complete sculpture',()=>{
  const signal=AbortSignal.abort();for(const create of [createXieqiquStoneFishReviewStudy,createXieqiquCopperSwallowReviewStudy])assert.throws(()=>create({signal}),{name:'AbortError'});
  for(const roles of [[],['water'],['copper','copper']])assert.throws(()=>createXieqiquSculptureMaterialOwner(roles),/declared source/);
});

test('the frozen R4 sheep functions and all original study code survive the new material-only entry exactly',async()=>{
  const current=await readFile(new URL('../src/yuanmingyuan/xieqiqu-study.js',import.meta.url),'utf8'),old=await readFile(new URL('../../work/yuanmingyuan/xieqiqu-copper-sheep-r4/pre-full-freeze/world/src/yuanmingyuan/xieqiqu-study.js',import.meta.url),'utf8');
  const marker='// Independent sculpture reviews obtain these exact source PBR objects',at=current.indexOf(marker),after=current.indexOf('function archPoints(',at);assert.ok(at>0&&after>at);assert.equal(current.slice(0,at)+current.slice(after),old);
});
