import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {prepareHerbariumGeometry,decodeGeometryGLB} from './helpers/herbarium-source.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {loadBotanicalAssets} from '../src/botanical-cache.js';
import {createWorld,createNavigationWorld} from '../src/world.js';
import {assetManifest} from '../src/asset-manifest.js';
import {mutableGeometry} from '../src/gltf-resource.js';

test('cold construction rejects an omitted source preload and removes partial owned instances',()=>{
  const root=new THREE.Group();assert.throws(()=>createHerbariumDistrict(root,{heightAt:()=>7}),/await loadHerbariumAssets/);assert.equal(root.children.length,0);
});

test('actual loaded full and progressive worlds install the same district once and dispose its owners',async()=>{
  await prepareHerbariumGeometry();await loadBotanicalAssets({loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)))});
  let full=createWorld(new THREE.Scene());assert.ok(full.herbarium);assert.equal(full.herbarium.instances.length,12);assert.deepEqual([...new Set(full.herbarium.plantings.map(p=>p.userData.soilBed).filter(Boolean))].sort(),['court-east','court-near','court-west']);assert.ok(full.environmentColliders.some(c=>c.buildingId==='herbarium'));assert.ok(Math.abs(full.heightAt(55,22)-6.7)<.005);
  const expected=full.herbarium.instances.map(g=>({site:g.userData.site,triangles:g.children.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)}));
  full.dispose();assert.equal(full.root.getObjectByName('Living v8 connected herbarium'),undefined);full=null;
  const gltf=await decodeGeometryGLB(await readFile(new URL(`../public${assetManifest['navigation-terrain'].url}`,import.meta.url)));gltf.scene.updateMatrixWorld(true);const terrain={shore:gltf.scene.userData.shore};
  for(const key of ['ground','cliffs']){const mesh=gltf.scene.getObjectByName(key);terrain[key]=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);}
  const scene=new THREE.Scene(),world=createNavigationWorld(scene,terrain),regions=[];
  const first=world.enhance({prepareRegion:async()=>true,onRegion:r=>regions.push(r.region)}),second=world.enhance();assert.equal(first,second,'one in-flight assembly owner');await first;await world.enhance();
  assert.equal(world.complete,true);assert.deepEqual([...new Set(world.herbarium.plantings.map(p=>p.userData.soilBed).filter(Boolean))].sort(),['court-east','court-near','court-west']);assert.equal(regions.filter(r=>r==='herbarium').length,1);assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,1);
  assert.deepEqual(world.herbarium.instances.map(g=>({site:g.userData.site,triangles:g.children.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)})),expected);
  for(const [x,z,y]of[[-20,2,7.2],[20,2,7.2],[55,22,6.7],[-37.4,47,7.1]])assert.ok(Math.abs(world.heightAt(x,z)-y)<.005,`${x},${z}: actual support installed`);
  world.dispose();world.dispose();assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,0);await assert.rejects(world.enhance(),/disposed/);
});
