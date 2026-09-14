import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {assetManifest} from '../src/asset-manifest.js';
import {mutableGeometry} from '../src/gltf-resource.js';
import {islandGeometry} from '../src/world.js';
import {createSurfaceSupport} from '../src/surface-support.js';
import {bridgeBankClearance} from './helpers/bridge-bank-clearance.js';
import {authoredGradeSamples} from './helpers/authored-grades.js';

test('content-addressed manifest matches deployed bytes',async()=>{
  for(const asset of Object.values(assetManifest)){
    const data=await readFile(new URL(`../public${asset.url}`,import.meta.url));
    assert.equal(data.byteLength,asset.bytes,asset.id);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256,asset.id);
  }
});
test('compressed navigation terrain retains metre bounds and all triangles after CPU baking',async()=>{
  const asset=assetManifest['navigation-terrain'],bytes=await readFile(new URL(`../public${asset.url}`,import.meta.url));
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);const source=islandGeometry(),loaded=[];
  for(const name of ['ground','cliffs']){
    const mesh=gltf.scene.getObjectByName(name),actual=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);
    loaded.push(actual);actual.computeBoundingBox();source[name].computeBoundingBox();assert.equal(actual.index.count,source[name].index.count);
    assert.ok(actual.boundingBox.min.distanceTo(source[name].boundingBox.min)<.012,`${name}: min bounds changed`);
    assert.ok(actual.boundingBox.max.distanceTo(source[name].boundingBox.max)<.012,`${name}: max bounds changed`);
    assert.ok(actual.boundingBox.max.x>100,'normalized integer geometry collapsed to unit space');
    if(name==='ground'){
      const support=createSurfaceSupport(()=>-22);support.addGeometry(actual);
      for(const p of authoredGradeSamples())assert.ok(Math.abs(support.heightAt(p.x,p.z)-p.y)<.03,`${p.id} loaded grade at ${p.x},${p.z}`);
      for(const [x,z]of [[96,36],[0,94]])assert.equal(support.heightAt(x,z),-22,'loaded coves have real open water');
      for(const [x,z]of [[91,32],[-22,94]])assert.ok(support.heightAt(x,z)<0&&support.heightAt(x,z)>-13,'loaded low banks retain their relief');
      // Stay 5 cm inside the shore: mesh quantization can move the exact edge a few millimetres.
      assert.ok(support.heightAt(-10,86.95)>-15&&support.heightAt(-10,86.95)<-14,'loaded south bay has a low-bank break at the lake');
      for(const [x,z,y]of [[0,-75,10.900687258195479],[-29,-61,9],[29,-15,9],[-54,-39,7],[-70,-57,7],[48,-37,7],[65,-51,7],[0,-1,9]])assert.ok(Math.abs(support.heightAt(x,z)-y)<.015,'runtime geometry preserves shoulders, foundations and approaches');
    }
  }
  for(const result of bridgeBankClearance(loaded))assert.ok(result.maximum<=result.ceiling,`${result.name} loaded bank intrudes into the viaduct trim footprint: ${result.maximum}`);
  for(const geometry of [...loaded,source.ground,source.cliffs])geometry.dispose();
});
