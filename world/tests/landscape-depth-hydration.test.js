import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {assetManifest} from '../src/asset-manifest.js';
import {readRuntimeScanGeometry} from './helpers/scan-geometry.js';
import {loadScannedRockAssets,hydrateScannedRocks,scannedRockSource,addScannedRocks} from '../src/rock-scans.js';
import {createLandscapeDepth} from '../src/landscape-depth.js';
import {createLake,cliffMaterial} from '../src/landscape.js';
import {registerWorldLighting} from '../src/world.js';
import {Game} from '../src/game.js';
import {EnvironmentClock} from '../src/environment-time.js';

const materials=group=>new Set(group.children.map(mesh=>mesh.material));
test('coastal scan hydration preserves cold intent and preview upgrades with live lighting and resource ownership',async t=>{
  // This file has its own Node test process; no earlier full-source preload can
  // hide the actual empty -> full or preview -> full startup paths.
  assert.equal(scannedRockSource('moss'),null);
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.FogExp2();
  const root=new THREE.Group();scene.add(root);const cold=createLandscapeDepth(root,{rockMaterial:cliffMaterial}),coldBatch=cold.scanAccents;
  const coldIntent=coldBatch.userData.sourcePlacements,coldInitial={sites:coldIntent.length,instances:coldBatch.userData.instanceCount};
  const world={root,lake:createLake(root,scene),atmosphere:{setEnvironment(){}},environmentLighting:{lights:[],emissiveMaterials:[],nightMaterials:[],nightObjects:[]}};
  const game=Object.create(Game.prototype);Object.assign(game,{scene,world,renderer:{shadowMap:{}},started:true,options:{reducedMotion:false},_isPaused:()=>false,_landscapeLighting:[],accentLights:[],ambientLight:new THREE.HemisphereLight(),keyLight:new THREE.DirectionalLight(),fillLight:new THREE.DirectionalLight(),audio:{setEnvironment(){}},position:new THREE.Vector3(),_time:0});
  registerWorldLighting(world);
  const protectedResources=new Set();let sharedDisposals=0;
  const loadGLTFImpl=async asset=>{
    const result=await readRuntimeScanGeometry(assetManifest[asset.id].url);
    result.scene.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material.userData.sharedAsset=true;
      // Image decoding is outside this Node check; actual source geometry and
      // transforms are decoded, while maps are explicit ownership sentinels.
      for(const key of ['map','normalMap','roughnessMap']){const map=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);map.userData.sharedAsset=true;mesh.material[key]=map;protectedResources.add(map);}
      protectedResources.add(mesh.material);
    });return result;
  };
  const protectGeometry=()=>{for(let i=0;i<7;i++)protectedResources.add(scannedRockSource('moss',i).geometry);};
  assert.equal(await loadScannedRockAssets({variant:'preview',loadGLTFImpl}),true);protectGeometry();
  const preview=createLandscapeDepth(root,{rockMaterial:cliffMaterial}),previewBatch=preview.scanAccents;
  const ordinary=addScannedRocks(root,[{x:500,y:-15,z:500,s:1,kind:'moss',piece:0}],'Ordinary source-material scan');
  ordinary.position.set(3,2,1);ordinary.rotation.y=.4;ordinary.updateMatrix();const ordinaryTransform=ordinary.matrix.clone();ordinary.userData.authoredTag='retained';
  registerWorldLighting(world);game.environmentClock=new EnvironmentClock('night');game._updateEnvironment(0);
  const night=game.environment.night,oldMaterials=materials(previewBatch),oldInstances=[...previewBatch.children];
  const disposedMaterials=new Map([...oldMaterials].map(m=>[m,0])),disposedInstances=new Map(oldInstances.map(m=>[m,0]));
  for(const m of oldMaterials)m.addEventListener('dispose',()=>disposedMaterials.set(m,disposedMaterials.get(m)+1));
  for(const m of oldInstances)m.addEventListener('dispose',()=>disposedInstances.set(m,disposedInstances.get(m)+1));
  assert.equal(await loadScannedRockAssets({loadGLTFImpl}),true);protectGeometry();
  for(const resource of protectedResources)resource.addEventListener('dispose',()=>sharedDisposals++);
  hydrateScannedRocks(root);

  function verifyActive(batch){
    assert.ok(batch.parent,'batch identity remains attached');assert.equal(batch.userData.sourcePlacements.length,96);assert.equal(batch.userData.instanceCount,96);assert.equal(batch.userData.triangles,789232);
    const registered=world.environmentLighting.nightMaterials.map(entry=>entry.material);
    for(const m of materials(batch)){
      assert.equal(m.userData.localDepthFog,true);assert.equal(m.uniforms.nightFactor.value,night,'current night value is present immediately, before another frame');assert.ok(registered.includes(m));
      const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);
      assert.ok(shader.fragmentShader.includes('coastalScanMineral'));assert.ok(shader.fragmentShader.includes('coastalFogDepth=vFogDepth*coastalFogScale'));assert.equal(shader.uniforms.depthNightFactor,m.uniforms.nightFactor);
    }
    for(const placement of batch.userData.placements){
      const source=scannedRockSource('moss',placement.piece),size=source.geometry.boundingBox.getSize(new THREE.Vector3());
      for(const [axis,scale,index]of [['x','sx',0],['y','sy',1],['z','sz',2]])assert.ok(Math.abs(size[axis]*placement[scale]-placement.scanSize[index])<1e-9,'world dimensions are resolved against the arriving source');
    }
    for(const mesh of batch.children){const source=[...Array(7)].map((_,i)=>scannedRockSource('moss',i)).find(s=>s.geometry===mesh.geometry);assert.ok(source);for(const key of ['map','normalMap','roughnessMap'])assert.equal(mesh.material[key],source.material[key]);}
  }
  await t.test('empty construction retains all 96 authored sites and installs full scans with current night state',()=>{
    assert.deepEqual(coldInitial,{sites:96,instances:0});assert.equal(coldBatch.userData.sourcePlacements,coldIntent);verifyActive(coldBatch);
  });
  await t.test('preview upgrades retain customization, release old owned resources and keep ordinary scans compatible',()=>{
    verifyActive(previewBatch);assert.ok(previewBatch.children.every(mesh=>!oldInstances.some(old=>old.geometry===mesh.geometry)),'actual preview geometry is replaced by the full source revision');
    assert.ok([...disposedMaterials.values()].every(count=>count===1));assert.ok([...disposedInstances.values()].every(count=>count===1));assert.equal(sharedDisposals,0);
    const registered=world.environmentLighting.nightMaterials.map(entry=>entry.material);assert.ok([...oldMaterials].every(m=>!registered.includes(m)),'disposed materials must leave the live lighting registry');
    assert.equal(ordinary.children[0].material,scannedRockSource('moss',0).material);assert.ok(!ordinary.children[0].material.userData.localDepthFog);
    assert.ok(ordinary.parent);assert.ok(ordinary.matrix.equals(ordinaryTransform));assert.equal(ordinary.userData.authoredTag,'retained');
    const active=[...coldBatch.children,...previewBatch.children],lightingCount=registered.length;hydrateScannedRocks(root);registerWorldLighting(world);hydrateScannedRocks(root);
    assert.deepEqual([...coldBatch.children,...previewBatch.children],active);assert.equal(world.environmentLighting.nightMaterials.length,lightingCount);assert.ok([...disposedMaterials.values()].every(count=>count===1));assert.equal(sharedDisposals,0);
    game.environmentClock=new EnvironmentClock('day');game._updateEnvironment(0);for(const mesh of active)assert.equal(mesh.material.uniforms.nightFactor.value,game.environment.night);
  });
  const geometries=new Set(),owned=new Set();root.traverse(mesh=>{if(mesh.geometry&&!mesh.geometry.userData.sharedAsset)geometries.add(mesh.geometry);if(mesh.material&&!mesh.material.userData.sharedAsset)owned.add(mesh.material);});geometries.forEach(g=>g.dispose());owned.forEach(m=>m.dispose());
  assert.equal(sharedDisposals,0,'final disposal also leaves cached source maps/materials/geometry alive');
});
