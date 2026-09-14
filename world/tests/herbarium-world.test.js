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
function checkHerbariumLights(world){
  const lamps=world.herbarium.lighting.lights;assert.equal(lamps.length,4);
  for(const lamp of lamps){assert.ok(lamp.light.isPointLight);assert.equal(world.environmentLighting.lights.filter(e=>e.light===lamp.light).length,1,'each physical lamp is registered once');assert.ok(lamp.baseIntensity>0);}
  const emission=world.herbarium.lighting.emissiveMaterials;assert.equal(emission.length,1);assert.equal(world.environmentLighting.emissiveMaterials.filter(e=>e.material===emission[0].material).length,1);
}

test('cold construction rejects an omitted source preload and removes partial owned instances',()=>{
  const root=new THREE.Group();assert.throws(()=>createHerbariumDistrict(root,{heightAt:()=>7}),/await loadHerbariumAssets|await loadHerbariumIvyAssets/);assert.equal(root.children.length,0);
});

test('pending and failed phase-two source readiness retain the initial navigation world without partial gardens',async()=>{
  const gltf=await decodeGeometryGLB(await readFile(new URL(`../public${assetManifest['navigation-terrain'].url}`,import.meta.url)));gltf.scene.updateMatrixWorld(true);const terrain={shore:gltf.scene.userData.shore};
  for(const key of ['ground','cliffs']){const mesh=gltf.scene.getObjectByName(key);terrain[key]=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);}
  for(const mode of ['missing-map','cancelled']){
    const scene=new THREE.Scene(),world=createNavigationWorld(scene,terrain),controller=new AbortController();let rejectSource,reached;const requested=new Promise(resolve=>{reached=resolve;}),sourceReady=new Promise((resolve,reject)=>{rejectSource=reject;});
    const pending=world.enhance({signal:controller.signal,prepareRegion:async region=>{if(region==='herbarium'){reached();return sourceReady;}return true;}});pending.catch(()=>{});await requested;
    assert.equal(world.complete,false);assert.ok(world.portals.length>=5,'initial portfolio navigation remains present');assert.ok(Number.isFinite(world.heightAt(0,31)));assert.equal(world.herbarium,undefined);assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,0);
    if(mode==='cancelled')controller.abort();rejectSource(new Error(mode==='missing-map'?'Shrub source preload failed: alpha unavailable':'Source request cancelled'));
    await assert.rejects(pending,/preload failed|cancelled/);assert.equal(world.complete,false);assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,0);world.dispose();
  }
  terrain.ground.dispose();terrain.cliffs.dispose();
});

test('actual loaded full and progressive worlds install the same district once and dispose its owners',async()=>{
  await prepareHerbariumGeometry();await loadBotanicalAssets({loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)))});
  let full=createWorld(new THREE.Scene());assert.ok(full.herbarium);assert.equal(full.herbarium.instances.length,10);assert.deepEqual([...new Set(full.herbarium.plantings.map(p=>p.userData.soilBed).filter(Boolean))].sort(),['court-east','court-near','court-west']);assert.ok(full.environmentColliders.some(c=>c.buildingId==='herbarium'));assert.ok(Math.abs(full.heightAt(48,29)-6.7)<.005);
  const expected=full.herbarium.instances.map(g=>({site:g.userData.site,triangles:g.children.filter(m=>m.isMesh).reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)}));checkHerbariumLights(full);
  checkAtmosphere(full);
  full.dispose();assert.equal(full.root.getObjectByName('Living v8 connected herbarium'),undefined);full=null;
  const gltf=await decodeGeometryGLB(await readFile(new URL(`../public${assetManifest['navigation-terrain'].url}`,import.meta.url)));gltf.scene.updateMatrixWorld(true);const terrain={shore:gltf.scene.userData.shore};
  for(const key of ['ground','cliffs']){const mesh=gltf.scene.getObjectByName(key);terrain[key]=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);}
  const scene=new THREE.Scene(),world=createNavigationWorld(scene,terrain),regions=[];
  const initialAtmosphere=world.atmosphere,initialAnchors=world.atmosphere.fauna.motion.insects.map(i=>i.base.toArray());checkAtmosphere(world);
  const first=world.enhance({prepareRegion:async()=>true,onRegion:r=>regions.push(r.region)}),second=world.enhance();assert.equal(first,second,'one in-flight assembly owner');await first;await world.enhance();
  assert.equal(world.complete,true);assert.deepEqual([...new Set(world.herbarium.plantings.map(p=>p.userData.soilBed).filter(Boolean))].sort(),['court-east','court-near','court-west']);assert.equal(regions.filter(r=>r==='herbarium').length,1);assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,1);
  assert.deepEqual(world.herbarium.instances.map(g=>({site:g.userData.site,triangles:g.children.filter(m=>m.isMesh).reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)})),expected);checkHerbariumLights(world);
  assert.equal(world.atmosphere,initialAtmosphere);assert.deepEqual(world.atmosphere.fauna.motion.insects.map(i=>i.base.toArray()),initialAnchors);checkAtmosphere(world);
  const instances=[],counts=new Map();world.atmosphere.root.traverse(o=>{if(o.isInstancedMesh){instances.push(o);if(o.morphTexture)instances.push(o.morphTexture);}});for(const object of instances){counts.set(object,0);object.addEventListener('dispose',()=>counts.set(object,counts.get(object)+1));}
  for(const [x,z,y]of[[-20,2,7.2],[20,2,7.2],[48,29,6.7],[-35.2,47,7.1]])assert.ok(Math.abs(world.heightAt(x,z)-y)<.005,`${x},${z}: actual support installed`);
  world.dispose();world.dispose();assert.equal(scene.getObjectsByProperty('name','Living v8 connected herbarium').length,0);await assert.rejects(world.enhance(),/disposed/);
  assert.ok([...counts.values()].every(n=>n===1),'full/progressive world owner must release each instance/morph once');
});
