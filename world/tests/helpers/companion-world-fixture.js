import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {prepareHerbariumGeometry,decodeGeometryGLB} from './herbarium-source.js';
import {loadBotanicalAssets} from '../../src/botanical-cache.js';
import {createNavigationWorld} from '../../src/world.js';
import {createExhibitionStage} from '../../src/exhibits.js';
import {createBuildingColliders,createBridgeColliders} from '../../src/collision.js';
import {locations,bridges} from '../../src/locations.js';
import {assetManifest} from '../../src/asset-manifest.js';
import {mutableGeometry} from '../../src/gltf-resource.js';

export async function createCompanionWorldFixture(phase=()=>{}){
  await prepareHerbariumGeometry();phase('accepted actors and actual herbarium geometry decoded');
  let botanicalBytes=0;
  await loadBotanicalAssets({loadGLTFImpl:async asset=>{const bytes=await readFile(new URL(`../../public${asset.url}`,import.meta.url));botanicalBytes+=bytes.length;return decodeGeometryGLB(bytes);}});
  phase('actual botanical geometry decoded');const navigation=await decodeGeometryGLB(await readFile(new URL(`../../public${assetManifest['navigation-terrain'].url}`,import.meta.url)));
  navigation.scene.updateMatrixWorld(true);const terrain={shore:navigation.scene.userData.shore};
  for(const name of ['ground','cliffs']){const mesh=navigation.scene.getObjectByName(name);terrain[name]=mutableGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld);}
  const scene=new THREE.Scene(),world=createNavigationWorld(scene,terrain);
  const assemblyTimings=[];await world.enhance({prepareRegion:async()=>true,onRegion:r=>{assemblyTimings.push({region:r.region,assemblyMs:r.assemblyMs,...(r.assemblySteps?{assemblySteps:r.assemblySteps.map(step=>({...step}))}:{})});phase(r.region);}});if(!world.complete)throw new Error('World assembly incomplete');
  const stage=createExhibitionStage(scene,world.heightAt),root=new THREE.Group();scene.add(root);
  const bindings={heightAt:world.heightAt,colliders:createBuildingColliders(locations).concat(createBridgeColliders(bridges),world.environmentColliders,stage.colliders),waterLevel:-15};
  return {scene,world,stage,root,bindings,botanicalBytes,assemblyTimings,dispose(){stage.dispose();world.dispose();terrain.ground.dispose();terrain.cliffs.dispose();}};
}
