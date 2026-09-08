import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGroveTree} from '../src/grove-foliage.js';
import {createFoliageLOD,selectFoliageDetail,placementMatrix,FOLIAGE_LOD} from '../src/foliage-lod.js';
import {environmentWind,updateEnvironmentWind} from '../src/environment-wind.js';

test('near/mid/far boundaries have distinct exit and reentry thresholds',()=>{
  assert.equal(selectFoliageDetail(0,230,80),0);
  assert.equal(selectFoliageDetail(0,219,80),1);
  assert.equal(selectFoliageDetail(1,230,80),1);
  assert.equal(selectFoliageDetail(1,261,80),0);
  assert.equal(selectFoliageDetail(1,75,126),2);
  assert.equal(selectFoliageDetail(2,90,126),2);
  assert.equal(selectFoliageDetail(2,97,126),1);
  assert.equal(selectFoliageDetail(2,60,107),1);
  assert.equal(selectFoliageDetail(2,3,30),0,'returning close restores full geometry in one update');
  assert.equal(selectFoliageDetail(1,NaN,30),0,'invalid projection conservatively retains near detail');
});

test('tiers retain every botanical piece and the exact approved near mesh',()=>{
  const counts={silver:74016,pine:78280,cherry:351654};
  for(const kind of Object.keys(counts)){
    const tiers=['near','mid','far'].map(t=>createGroveTree(kind,168,t)),nearBounds=new THREE.Box3().setFromObject(tiers[0]);
    const count=t=>t.children.reduce((sum,m)=>sum+m.geometry.index.count/3,0);
    assert.equal(count(tiers[0]),counts[kind]);
    assert.ok(count(tiers[1])<count(tiers[0])*(kind==='cherry'?.75:.60));assert.ok(count(tiers[2])<=count(tiers[1]));
    for(const tier of tiers){
      assert.deepEqual(tier.userData.botanicalDetail,tiers[0].userData.botanicalDetail);
      assert.equal(tier.leavesMesh.material.transparent,false);assert.equal(tier.leavesMesh.material.alphaTest,0);
      const bounds=new THREE.Box3().setFromObject(tier);
      assert.ok(bounds.min.distanceTo(nearBounds.min)<.065);assert.ok(bounds.max.distanceTo(nearBounds.max)<.065);
    }
  }
});

test('chunk rebuilds preserve full instance transforms, reentry, density and shadow casting outside camera view',()=>{
  const root=new THREE.Group();root.position.set(12,3,-9);root.rotation.y=.26;
  const placements=[{x:1,y:4,z:2,r:.53,sx:.8,sy:1.1,sz:.9},{x:55,y:6,z:14,rx:.06,r:1.8,rz:-.04,s:1.2}];
  const lod=createFoliageLOD(root,[{kind:'silver',seed:168,placements}]),camera=new THREE.PerspectiveCamera(50,1,.1,3000);
  assert.equal(lod.chunks.length,2);assert.equal(lod.stats.nearCount,2);
  const matrix=new THREE.Matrix4();
  const verify=()=>{
    for(const chunk of lod.chunks)for(const entry of chunk.entries){
      const list=chunk.entries.filter(e=>e.tier===entry.tier),index=list.indexOf(entry);
      for(const mesh of chunk.levels[entry.tier]){
        mesh.getMatrixAt(index,matrix);const expected=placementMatrix(entry.placement);
        assert.ok(matrix.elements.every((v,i)=>Math.abs(v-expected.elements[i])<1e-5));
        assert.equal(mesh.castShadow,true);assert.equal(mesh.frustumCulled,true);assert.equal(mesh.visible,true);
      }
    }
    assert.equal(lod.stats.nearCount+lod.stats.midCount+lod.stats.farCount,2);
  };
  camera.position.set(800,200,700);camera.lookAt(1200,600,900);
  lod.update(camera,{width:1440,height:900});assert.equal(lod.stats.farCount,2);verify();
  assert.ok(lod.stats.submittedTriangles<lod.stats.fullDetailTriangles*.44);
  root.updateMatrixWorld(true);camera.position.copy(new THREE.Vector3(1,10,8).applyMatrix4(root.matrixWorld));
  lod.update(camera,new THREE.Vector2(1440,900));assert.ok(lod.stats.nearCount>=1);verify();
  const changes=lod.stats.transitions;lod.update(camera,{height:900});assert.equal(lod.stats.transitions,changes);
  lod.setEnabled(false);assert.equal(lod.stats.nearCount,2);assert.equal(lod.stats.submittedTriangles,lod.stats.fullDetailTriangles);
  camera.position.set(800,200,700);lod.update(camera,{height:900});assert.equal(lod.stats.nearCount,2,'explicit baseline remains full detail');
  lod.setEnabled(true);lod.update(camera,{height:900});assert.equal(lod.stats.farCount,2);
  assert.ok(FOLIAGE_LOD.nearExitPixels<FOLIAGE_LOD.nearEnterPixels);
});

test('surface, depth and point-shadow shaders use the same world-space wind clock and direction',()=>{
  const tree=createGroveTree('silver',168,'far'),leaf=tree.leavesMesh;
  for(const material of [leaf.material,leaf.customDepthMaterial,leaf.customDistanceMaterial]){
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:''};material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.environmentWindTime,environmentWind.time);
    assert.equal(shader.uniforms.environmentWindDirection.value,environmentWind.direction);
    assert.ok(shader.vertexShader.includes('modelMatrix * instanceMatrix'));
    assert.ok(shader.vertexShader.includes('transformed += vec3'));
  }
  updateEnvironmentWind(9);assert.equal(environmentWind.time.value,9);updateEnvironmentWind(9,true);assert.equal(environmentWind.time.value,0);
});
