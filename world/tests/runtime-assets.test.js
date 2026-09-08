import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {assetManifest} from '../src/asset-manifest.js';
import {mutableGeometry} from '../src/gltf-resource.js';
import {islandGeometry} from '../src/world.js';

test('content-addressed manifest matches deployed bytes',async()=>{
  for(const asset of Object.values(assetManifest)){
    const data=await readFile(new URL(`../public${asset.url}`,import.meta.url));
    assert.equal(data.byteLength,asset.bytes,asset.id);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256,asset.id);
  }
});
test('compressed navigation terrain retains metre bounds and all triangles after CPU baking',async()=>{
  const asset=assetManifest['navigation-terrain'],bytes=await readFile(new URL(`../public${asset.url}`,import.meta.url));
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);const source=islandGeometry();
  for(const name of ['ground','cliffs']){
    const mesh=gltf.scene.getObjectByName(name),actual=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);
    actual.computeBoundingBox();source[name].computeBoundingBox();assert.equal(actual.index.count,source[name].index.count);
    assert.ok(actual.boundingBox.min.distanceTo(source[name].boundingBox.min)<.012,`${name}: min bounds changed`);
    assert.ok(actual.boundingBox.max.distanceTo(source[name].boundingBox.max)<.012,`${name}: max bounds changed`);
    assert.ok(actual.boundingBox.max.x>100,'normalized integer geometry collapsed to unit space');
  }
});
