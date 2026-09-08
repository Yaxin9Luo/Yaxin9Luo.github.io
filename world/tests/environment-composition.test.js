import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createEnvironmentComposition,createFootingSpecimen} from '../src/environment-composition.js';
import {environmentSignLabels} from '../src/environment-signage.js';
import {terrainHeight,renderedTerrainHeight} from '../src/world.js';

const scanFolder=new URL('../public/models/environment/scans/',import.meta.url);
test('runtime scans preserve the publisher geometry buffer, native 4K PBR and provenance',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',scanFolder),'utf8'));
  assert.equal(manifest.assets.length,2);
  for(const asset of manifest.assets){
    const bytes=fs.readFileSync(new URL(asset.file,scanFolder));assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(bytes.length,asset.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(asset.license,'CC0-1.0');
    assert.ok(Object.keys(asset.authors).length);assert.ok(asset.source.startsWith('https://polyhaven.com/a/'));
    const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),binaryStart=20+jsonLength+8;
    const original=asset.sourceBuffer;
    assert.equal(original.byteOffset,0);assert.ok(original.byteLength>100_000);assert.match(original.sha256,/^[a-f0-9]{64}$/);
    assert.ok(original.byteLength<=gltf.buffers[0].byteLength);
    const geometryBytes=bytes.subarray(binaryStart+original.byteOffset,binaryStart+original.byteOffset+original.byteLength);
    assert.equal(geometryBytes.length,original.byteLength);
    assert.equal(crypto.createHash('sha256').update(geometryBytes).digest('hex'),original.sha256,'original scan vertex/index/normal/UV bytes match the committed publisher-buffer digest');
    const triangles=gltf.meshes.reduce((sum,m)=>sum+m.primitives.reduce((s,p)=>s+gltf.accessors[p.indices].count/3,0),0);
    assert.equal(triangles,asset.triangles);assert.ok(triangles>=29000);
    for(const image of gltf.images){const view=gltf.bufferViews[image.bufferView],start=binaryStart+view.byteOffset;assert.equal(bytes.toString('ascii',start,start+4),'RIFF');assert.equal(image.mimeType,'image/webp');}
    assert.ok(asset.textures.every(t=>t.width===4096&&t.height===4096));
    assert.ok(gltf.materials.every(m=>m.normalTexture&&m.pbrMetallicRoughness.baseColorTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture&&m.occlusionTexture));
  }
});

test('physical wayfinding names portfolio functions and region motifs in both languages',()=>{
  const composition=createEnvironmentComposition(new THREE.Group(),renderedTerrainHeight);
  assert.equal(composition.signs.length,6);assert.equal(environmentSignLabels.length,6);
  const words=environmentSignLabels.map(l=>`${l.en} ${l.zh}`).join(' ');
  for(const text of ['PAPERS','论文','PROJECTS','作品','EXPERIENCE','经历','CONTACT','CV','联系','简历'])assert.ok(words.includes(text));
  for(const sign of composition.signs){
    const label=sign.userData.label;assert.ok(label.motif&&label.motifZh);
    assert.ok(sign.children.some(m=>m.userData.wayfindingLabel?.id===label.id));
    const png=fs.readFileSync(new URL(`../public/textures/wayfinding/${label.id}.png`,import.meta.url));assert.equal(png.toString('ascii',1,4),'PNG');assert.ok(png.length>4000);
  }
});

test('authored banks use low botanical placements outside garden boundaries and above land',()=>{
  const composition=createEnvironmentComposition(new THREE.Group(),renderedTerrainHeight);
  assert.equal(composition.stats.patches,8);assert.ok(composition.stats.rockCount>=40);
  for(const mesh of composition.group.children.filter(m=>m.name.includes('soil and moss ribbon'))){
    const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).y>=-1e-6,'ground-cover triangles face upward');}
  }
  for(const p of composition.stats.placements.filter(p=>p.type==='shrub')){
    assert.ok(terrainHeight(p.x,p.z)>.2);assert.ok(Math.abs(p.y-renderedTerrainHeight(p.x,p.z))<.08);
    assert.ok(p.s<1.1,'low near planting preserves the castle scale hierarchy');
    assert.ok(Math.abs(p.x)>19,'main castle/courtyard axis remains free');
  }
  const sample=createFootingSpecimen(),box=new THREE.Box3().setFromObject(sample);
  assert.ok(box.max.y>1.2);assert.ok(box.max.y<3,'footing sample remains human-scale');
  assert.ok(sample.children.some(m=>m.name==='Jointed mossy masonry footings'));
});
