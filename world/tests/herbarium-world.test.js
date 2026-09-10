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

function checkAtmosphere(world){
  const atmosphere=world.atmosphere;assert.equal(atmosphere.root.parent.getObjectsByProperty('name','Authored garden and sky fauna').length,1);
  assert.equal(atmosphere.lanternCount,26);assert.equal(atmosphere.fauna.motion.insects.length,90);assert.equal(atmosphere.fauna.snapshot().counts.birds,12);
  assert.equal(world.root.getObjectByName('Nocturnal academy motes'),undefined);
  world.root.traverse(o=>{assert.ok(!(o.parent===world.root&&o.isLine&&o.geometry.attributes.position.count===3),'legacy three-vertex V-line birds must be gone');});
  world.update(100,.125,false,null,null,{started:true,paused:false});
  for(const insect of atmosphere.fauna.motion.insects){const p=insect.position,clearance=p.y-world.heightAt(p.x,p.z);assert.ok(clearance>=.85-1e-8&&clearance<=1.93+1e-8,`actual rendered ground clearance ${clearance}`);}
  const held=atmosphere.activityTime;world.update(900,.125,false,null,null,{started:true,paused:true});assert.equal(atmosphere.activityTime,held);
}

test('cold construction rejects an omitted source preload and removes partial owned instances',()=>{
  const root=new THREE.Group();assert.throws(()=>createHerbariumDistrict(root,{heightAt:()=>7}),/await loadHerbariumAssets/);assert.equal(root.children.length,0);
});

test('actual loaded full and progressive worlds install the same district once and dispose its owners',async()=>{
  await prepareHerbariumGeometry();await loadBotanicalAssets({loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)))});
  let full=createWorld(new THREE.Scene());assert.ok(full.herbarium);assert.equal(full.herbarium.instances.length,12);assert.deepEqual([...new Set(full.herbarium.plantings.map(p=>p.userData.soilBed).filter(Boolean))].sort(),['court-east','court-near','court-west']);assert.ok(full.environmentColliders.some(c=>c.buildingId==='herbarium'));assert.ok(Math.abs(full.heightAt(55,22)-6.7)<.005);
  const expected=full.herbarium.instances.map(g=>({site:g.userData.site,triangles:g.children.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)}));
  checkAtmosphere(full);
  full.dispose();assert.equal(full.root.getObjectByName('Living v8 connected herbarium'),undefined);full=null;
  const gltf=await decodeGeometryGLB(await readFile(new URL(`../public${assetManifest['navigation-terrain'].url}`,import.meta.url)));gltf.scene.updateMatrixWorld(true);const terrain={shore:gltf.scene.userData.shore};
  for(const key of ['ground','cliffs']){const mesh=gltf.scene.getObjectByName(key);terrain[key]=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);}
  const scene=new THREE.Scene(),world=createNavigationWorld(scene,terrain),regions=[];
  const initialAtmosphere=world.atmosphere,initialAnchors=world.atmosphere.fauna.motion.insects.map(i=>i.base.toArray());checkAtmosphere(world);
  const first=world.enhance({prepareRegion:async()=>true,onRegion:r=>regions.push(r.region)}),second=world.enhance();assert.equal(first,second,'one in-flight assembly owner');await first;await world.enhance();
  assert.equal(world.complete,true);assert.deepEqual([...new Set(world.herbarium.plantings.map(p=>p.userData.soilBed).filter(Boolean))].sort(),['court-east','court-near','court-west']);assert.equal(regions.filter(r=>r==='herbarium').length,1);assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,1);
  assert.deepEqual(world.herbarium.instances.map(g=>({site:g.userData.site,triangles:g.children.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)})),expected);
  assert.equal(world.atmosphere,initialAtmosphere);assert.deepEqual(world.atmosphere.fauna.motion.insects.map(i=>i.base.toArray()),initialAnchors);checkAtmosphere(world);
  const instances=[],counts=new Map();world.atmosphere.root.traverse(o=>{if(o.isInstancedMesh){instances.push(o);if(o.morphTexture)instances.push(o.morphTexture);}});for(const object of instances){counts.set(object,0);object.addEventListener('dispose',()=>counts.set(object,counts.get(object)+1));}
  for(const [x,z,y]of[[-20,2,7.2],[20,2,7.2],[55,22,6.7],[-37.4,47,7.1]])assert.ok(Math.abs(world.heightAt(x,z)-y)<.005,`${x},${z}: actual support installed`);
  world.dispose();world.dispose();assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,0);await assert.rejects(world.enhance(),/disposed/);
  assert.ok([...counts.values()].every(n=>n===1),'full/progressive world owner must release each instance/morph once');
});
