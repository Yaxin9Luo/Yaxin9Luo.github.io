import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {botanicalManifest,botanicalFamilies} from '../src/botanical-manifest.js';
import {loadBotanicalVariant} from '../src/botanical-cache.js';
import {createGroveTree,createGroveTreeSource} from '../src/grove-foliage.js';

const triangles=geometry=>geometry.index.count/3;
const colorMean=geometry=>{
  const attribute=geometry.getAttribute('color'),sum=[0,0,0];
  for(let i=0;i<attribute.count;i++)for(let c=0;c<3;c++)sum[c]+=attribute.getComponent(i,c);
  return sum.map(value=>value/attribute.count);
};
test('all botanical descriptors match actual geometry-only compressed bytes and content hashes',async()=>{
  assert.equal(Object.keys(botanicalManifest).length,19);
  for(const asset of Object.values(botanicalManifest)){
    const data=await readFile(new URL(`../public${asset.url}`,import.meta.url));
    assert.equal(data.byteLength,asset.bytes,asset.id);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256,asset.id);
    const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
    assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'));assert.equal(json.images?.length||0,0);assert.equal(json.textures?.length||0,0);assert.equal(json.materials?.length||0,0);
    assert.deepEqual(json.meshes.map(mesh=>mesh.name).sort(),['branches','leaves']);
    for(const mesh of json.meshes)assert.deepEqual(Object.keys(mesh.primitives[0].attributes).sort(),['COLOR_0','NORMAL','POSITION','TEXCOORD_0']);
  }
  assert.equal(botanicalFamilies.find(f=>f.kind==='cherry'&&f.seed===830).defaultLoad,false);
  assert.ok(botanicalManifest['botanical/cherry/154/near']);assert.ok(botanicalManifest['botanical/silver/154/near']);
});

test('real fetch/GLTF/Meshopt path retains mature cherry triangles, metre bounds, UVs and pigment',async()=>{
  const previous=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,{signal})=>{requests.push(url);assert.equal(signal.aborted,false);return new Response(await readFile(new URL(`../public${url}`,import.meta.url)));};
  try{await loadBotanicalVariant('cherry',881,'near');}finally{globalThis.fetch=previous;}
  assert.deepEqual(requests,[botanicalManifest['botanical/cherry/881/near'].url]);
  const cached=createGroveTree('cherry',881,'near'),source=createGroveTreeSource('cherry',881,'near');
  assert.equal(triangles(cached.branchesMesh.geometry)+triangles(cached.leavesMesh.geometry),351654);
  assert.deepEqual(cached.userData.botanicalDetail,source.userData.botanicalDetail);
  for(const part of['branchesMesh','leavesMesh']){
    const actual=cached[part].geometry,expected=source[part].geometry;
    assert.equal(triangles(actual),triangles(expected));assert.equal(actual.attributes.position.count,expected.attributes.position.count);assert.ok(actual.attributes.position.array instanceof Float32Array);
    actual.computeBoundingBox();expected.computeBoundingBox();assert.ok(actual.boundingBox.min.distanceTo(expected.boundingBox.min)<.0002);assert.ok(actual.boundingBox.max.distanceTo(expected.boundingBox.max)<.0002);
    const color=colorMean(actual),reference=colorMean(expected);for(let c=0;c<3;c++)assert.ok(Math.abs(color[c]-reference[c])<.000008);
    assert.equal(actual.attributes.uv.count,expected.attributes.uv.count);assert.equal(actual.userData.sharedAsset,true);assert.equal(cached[part].material.vertexColors,true);
  }
  const bounds=new THREE.Box3().setFromObject(cached);assert.ok(bounds.max.y>7,'quantization transform must be baked back into tree-local metres');
});

test('packing report audits every variant against the unquantized source without simplification',async()=>{
  const report=JSON.parse(await readFile(new URL('../../docs/art/experience-v4/botanical-transmission-report.json',import.meta.url)));
  assert.equal(report.meshSimplification,false);assert.equal(report.textureReplacement,false);assert.equal(report.colorBits,16);
  assert.equal(report.assets.length,Object.keys(botanicalManifest).length);
  for(const asset of report.assets){
    assert.equal(asset.bytes,botanicalManifest[asset.id].bytes);assert.ok(asset.bytes<asset.uncompressedGLBBytes);
    for(const part of Object.values(asset.parts)){
      assert.match(part.topologySHA256,/^[a-f0-9]{64}$/);assert.ok(part.errors.POSITION.maxAbs<.0003);assert.ok(part.errors.COLOR_0.maxAbs<.000016);assert.ok(part.errors.TEXCOORD_0.maxAbs<.000016);assert.ok(part.boundsMaxAbs<.0002);
    }
  }
});
