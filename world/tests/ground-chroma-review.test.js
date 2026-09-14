import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groundMaterial} from '../src/landscape.js';
import {createGroundChromaStudy} from '../src/ground-chroma-review.js';

function fixture({transition=false}={}){
  const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(40,30),material=groundMaterial({transition});
  geometry.rotateX(-Math.PI/2);geometry.translate(-17,6,67);
  if(transition)geometry.setAttribute('soilInterior',new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill(.4),1));
  const mesh=new THREE.Mesh(geometry,material);mesh.name='actual-ground-material';scene.add(mesh);
  const study=createGroundChromaStudy(scene);
  return {scene,mesh,material,geometry,study,dispose(){study.dispose();material.dispose();geometry.dispose();}};
}
function compile(material){
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);return shader;
}

test('production uses accepted local colour once and the opt-in study only replaces its uniform',()=>{
  for(const transition of [false,true]){
    const f=fixture({transition}),before=compile(f.material),key=f.material.customProgramCacheKey(),version=f.material.version;
    assert.equal(f.study.snapshot().installed,false);assert.equal(f.study.snapshot().sceneId,f.scene.uuid);
    assert.equal(f.material.version,version);assert.equal(f.material.customProgramCacheKey(),key);
    f.study.set(0);const after=compile(f.material);
    assert.equal(after.vertexShader,before.vertexShader,'positions, normals and shoulder blend coordinates do not change');
    assert.equal(after.uniforms.groundStudyStrength.value,0);
    assert.equal(before.uniforms.groundStudyStrength.value,.5,'the homepage uses the accepted local colour without the review wrapper');
    assert.equal(after.fragmentShader,before.fragmentShader,'comparison changes only strength, never inserts a second colour operation');
    for(const name of Object.keys(before.uniforms))if(name!=='groundStudyStrength')assert.equal(after.uniforms[name].value,before.uniforms[name].value,name);
    assert.match(after.fragmentShader,/if\(groundStudyStrength>0\.\)\{[\s\S]*continuousSoil\(map,soilUv\)/);
    assert.match(after.fragmentShader,/if\(sourceLuminance>1e-6\)/);
    assert.match(after.fragmentShader,/continuousSoil\(humusMap,soilUv\)\.rgb\*diffuse\*\.79/);
    assert.match(after.fragmentShader,/max\(west,east\)/);
    f.dispose();
  }
});

test('baseline and candidate reuse the same compiled program, textures and uniform',()=>{
  const f=fixture();f.study.set(0);const shader=compile(f.material),uniform=shader.uniforms.groundStudyStrength,key=f.material.customProgramCacheKey(),version=f.material.version;
  const texture=shader.uniforms.humusMap.value,positions=f.geometry.attributes.position.array;
  assert.equal(f.study.set(.5),2);assert.equal(uniform.value,.5);assert.equal(f.study.set(.5),2);assert.equal(f.study.set(0),3);
  assert.equal(uniform.value,0);assert.equal(f.material.version,version);assert.equal(f.material.customProgramCacheKey(),key);
  assert.equal(shader.uniforms.humusMap.value,texture);assert.equal(f.geometry.attributes.position.array,positions);
  assert.throws(()=>f.study.set(.7),RangeError);assert.equal(f.study.snapshot().strength,0);
  const snapshot=f.study.snapshot();assert.equal(snapshot.materials[0].boundStrength,0);assert.equal(snapshot.materials[0].maps.humus.bound,true);
  assert.equal(snapshot.materials[0].maps.humus.width,1);assert.equal(snapshot.materials[0].maps.humus.sourceMatches,false,'a neutral source is disclosed, not certified as loaded');
  f.dispose();
});

test('an unexpected transform rejects all users of its shared ground material',()=>{
  const f=fixture(),other=new THREE.Mesh(f.geometry,f.material);other.position.x=3;other.name='moved-ground';f.scene.add(other);
  const key=f.material.customProgramCacheKey(),compileHook=f.material.onBeforeCompile;f.study.set(.5);
  assert.equal(f.study.snapshot().materials.length,0);assert.equal(f.study.snapshot().rejected.length,1);
  assert.deepEqual(f.study.snapshot().rejected[0].objects,['actual-ground-material','moved-ground']);
  assert.equal(f.material.customProgramCacheKey(),key);assert.equal(f.material.onBeforeCompile,compileHook);f.dispose();
});

test('the material wrapper fails clearly on a changed terrain shader and restores hooks without disposing borrowed assets',()=>{
  const f=fixture(),originalCompile=f.material.onBeforeCompile,originalKey=f.material.customProgramCacheKey;
  let geometryDisposals=0,materialDisposals=0;f.geometry.addEventListener('dispose',()=>geometryDisposals++);f.material.addEventListener('dispose',()=>materialDisposals++);
  f.study.set(0);compile(f.material);f.study.dispose();f.study.dispose();
  assert.equal(f.material.onBeforeCompile,originalCompile);assert.equal(f.material.customProgramCacheKey,originalKey);
  assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);assert.throws(()=>f.study.set(0),/disposed/);f.dispose();
  const changed=fixture();changed.material.onBeforeCompile=shader=>{shader.fragmentShader='unknown terrain';};changed.study.set(0);
  assert.throws(()=>compile(changed.material),/does not match the current terrain shader/);changed.dispose();
});

test('material disposal removes its shader references and never invalidates another ground material',()=>{
  const f=fixture(),other=groundMaterial();f.scene.add(new THREE.Mesh(f.geometry,other));
  f.study.set(.5);compile(f.material);compile(other);assert.equal(f.study.snapshot().materials.length,2);
  f.material.dispose();assert.equal(f.study.snapshot().materials.length,1);assert.equal(f.study.snapshot().materials[0].boundStrength,.5);
  other.dispose();assert.equal(f.study.snapshot().materials.length,0);f.study.dispose();f.geometry.dispose();
});
