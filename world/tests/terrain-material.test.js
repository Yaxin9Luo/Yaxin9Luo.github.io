import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groundMaterial,loadLandscapeSurfaces} from '../src/landscape.js';

const compile=material=>{
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);return shader;
};
const checkFallbacks=shader=>{
  for(const name of['mossNormal','humusNormal']){
    const texture=shader.uniforms[name].value,pixel=texture.image.data;
    assert.deepEqual([...pixel],[128,128,255,255]);assert.equal(texture.colorSpace,THREE.NoColorSpace);
    const tangentNormal=new THREE.Vector3(...[...pixel].slice(0,3).map(v=>v/255*2-1)).normalize();
    assert.ok(tangentNormal.z>.9999,'missing normal must not tilt terrain lighting');assert.equal(texture.userData.sharedAsset,true);
  }
  for(const name of['mossRoughness','humusRoughness']){
    const texture=shader.uniforms[name].value;assert.deepEqual([...texture.image.data],[255,255,255,255]);assert.equal(texture.colorSpace,THREE.NoColorSpace);
  }
  assert.equal(shader.uniforms.rockMap.value.colorSpace,THREE.SRGBColorSpace);
};

test('unloaded and failed terrain channels use shared neutral normals and matte roughness',async()=>{
  const first=groundMaterial(),before=compile(first);checkFallbacks(before);
  const fetch=globalThis.fetch;
  try{globalThis.fetch=async()=>new Response('missing fixture',{status:404});assert.equal(await loadLandscapeSurfaces(),false);}finally{globalThis.fetch=fetch;}
  const second=groundMaterial(),after=compile(second);checkFallbacks(after);
  assert.equal(before.uniforms.mossNormal.value,after.uniforms.humusNormal.value,'fallbacks are shared instead of allocated for every material');
  first.dispose();second.dispose();
});

test('grass pigment preserves texture luminance before independent soil layers',()=>{
  const material=groundMaterial(),shader=compile(material),source=shader.fragmentShader;
  assert.match(source,/meadowLuminance=dot\(diffuseColor.rgb,meadowLuminanceWeights\)/);
  assert.match(source,/meadowPigment\/=dot\(meadowPigment,meadowLuminanceWeights\)/,'target pigment is normalized to conserve luminance');
  assert.ok(source.indexOf('meadowLuminance*meadowPigment')<source.indexOf('vec3 soilBase='),'humus and moss keep their independent pigments');
  assert.equal(material.vertexColors,false);material.dispose();
});
