import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createXieqiquCopperSwallowPoseStudy,createXieqiquCopperSwallowPoseReviewStudy,copperSwallowPoseComponentSpecs,copperSwallowPoseStudyViews,copperSwallowPoseStudyId} from '../src/yuanmingyuan/xieqiqu-swallow-pose-study.js';
import {copperSwallowComponentSpecs} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';
import {createBorrowedMaterialSculpture} from '../src/yuanmingyuan/xieqiqu-sculpture-skin.js';

test('the new standalone entry keeps all original component IDs/roles and does not replace the frozen factories',async()=>{
  assert.equal(copperSwallowPoseComponentSpecs.length,79);
  assert.deepEqual(copperSwallowPoseComponentSpecs.map(p=>[p.id,p.role]),copperSwallowComponentSpecs.map(p=>[p.id,p.role]));
  const freeze=JSON.parse(await readFile(new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/local-after-third-freeze.json',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex');
  for(const [file,hash]of Object.entries(freeze.files))assert.equal(sha(await readFile(new URL('../../'+file,import.meta.url))),hash,file);
  assert.equal(copperSwallowPoseStudyId,'xieqiqu-copper-swallow-pose-r1');
  for(const name of ['threequarter','profile','front','top','head','wingfold','feet'])assert.ok(copperSwallowPoseStudyViews[name]?.direction.every(Number.isFinite));
});

test('both complete factory boundaries reject cancellation and missing PBR before constructing a body',()=>{
  for(const create of [createXieqiquCopperSwallowPoseStudy,createXieqiquCopperSwallowPoseReviewStudy])assert.throws(()=>create({signal:AbortSignal.abort()}),{name:'AbortError'});
  assert.throws(()=>createXieqiquCopperSwallowPoseStudy(),/original source materials/);
});

test('the real posed wing/leg/foot component closures retain the borrowed material lifetime and dispose once',()=>{
  const materialOwner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']),parts=copperSwallowPoseComponentSpecs.filter(p=>['wing-1','leg-1','toe-1-0','primary-1-1'].includes(p.id)),events=new Map();
  for(const material of Object.values(materialOwner.materials)){events.set(material,0);material.addEventListener('dispose',()=>events.set(material,events.get(material)+1));}
  let owner;try{
    owner=createBorrowedMaterialSculpture({id:'explicit-local-pose-fixture',materials:materialOwner.materials,roles:['copper','copperRecess'],mouthAnchor:[0,.587,.579],parts});
    assert.equal(owner.group.children.length,4);const geometries=owner.group.children.map(m=>m.geometry);for(const geometry of geometries){events.set(geometry,0);geometry.addEventListener('dispose',()=>events.set(geometry,events.get(geometry)+1));}
    for(const mesh of owner.group.children){assert.equal(mesh.material,materialOwner.materials.copper);assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);}
    owner.dispose();owner.dispose();assert.equal(owner.group.children.length,0);assert.ok(geometries.every(g=>events.get(g)===1));assert.ok(Object.values(materialOwner.materials).every(m=>events.get(m)===0));
  }finally{owner?.dispose();materialOwner.dispose();}
  assert.ok([...events.values()].every(n=>n===1));
});
