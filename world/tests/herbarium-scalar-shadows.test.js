import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {createShrubSpecimen,disposeCommunityAsset} from '../src/herbarium-community.js';

test('scalar alpha uses identical R samples for physical, directional and point shadow passes',async()=>{
  await prepareHerbariumGeometry();
  const group=createShrubSpecimen(),other=createShrubSpecimen({variant:1}),mesh=group.children[0],copy=other.children[0];
  assert.ok(mesh.customDepthMaterial,'directional shadows must read the packed alpha channel');
  assert.ok(mesh.customDistanceMaterial,'point shadows must read the packed alpha channel');
  for(const [material,kind]of [[mesh.material,'physical'],[mesh.customDepthMaterial,'depth'],[mesh.customDistanceMaterial,'distance']]){
    const shader={uniforms:{},fragmentShader:THREE.ShaderLib[kind].fragmentShader};material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader,/texture2D\( alphaMap, vAlphaMapUv \)\.r/);
    assert.doesNotMatch(shader.fragmentShader,/#include <alphamap_fragment>/);
    assert.equal(material.alphaMap,mesh.material.alphaMap);assert.equal(material.map,mesh.material.map);assert.equal(material.alphaTest,.5);
    if(kind!=='physical')assert.equal(material.alphaToCoverage,false,'retain Three shadow fixed alpha-test behavior');
  }
  assert.equal(mesh.customDepthMaterial.depthPacking,new THREE.MeshDepthMaterial().depthPacking);
  assert.equal(mesh.material.alphaToCoverage,true);assert.equal(mesh.customDepthMaterial,copy.customDepthMaterial);assert.equal(mesh.customDistanceMaterial,copy.customDistanceMaterial);
  disposeCommunityAsset(group);disposeCommunityAsset(other);
});
