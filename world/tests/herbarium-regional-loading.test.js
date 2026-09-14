import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import {loadHerbariumAssets} from '../src/herbarium-assets.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {herbariumRegionalCommunities,herbariumLowGardenBeds} from '../src/herbarium-layout.js';
import {HerbariumWorker} from './helpers/herbarium-worker.js';

// Exercise the real phase-two aggregate with an actual missing source map.
// Full image decoders and source GLB are used; no reduced source can satisfy it.
test('regional preload remains pending for alpha, fails visibly, and retries without reduced assembly',async()=>{
  const previous={fetch:globalThis.fetch,self:globalThis.self,createImageBitmap:globalThis.createImageBitmap,Worker:globalThis.Worker};
  globalThis.Worker=HerbariumWorker;
  let releaseAlpha,alphaRequested,district,failAlpha=true,settled=false;const pendingAlpha=new Promise(resolve=>{releaseAlpha=resolve;}),requested=new Promise(resolve=>{alphaRequested=resolve;}),requests=[];
  globalThis.self=globalThis;
  globalThis.createImageBitmap=async(blob,options={})=>{let pipeline=sharp(Buffer.from(await blob.arrayBuffer()));if(options.imageOrientation==='flipY')pipeline=pipeline.flip();const {data,info}=await pipeline.ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8Array(data),width:info.width,height:info.height,close(){}};};
  globalThis.fetch=async(url,options)=>{if(String(url).startsWith('blob:'))return previous.fetch(url,options);requests.push(url);if(url.includes('didelta_spinosa_alpha')&&failAlpha){alphaRequested();await pendingAlpha;return new Response(null,{status:404});}return new Response(await readFile(new URL('../public'+url,import.meta.url)));};
  try{
    const readiness=loadHerbariumAssets({deadline:performance.now()+180000});readiness.then(()=>{settled=true;},()=>{settled=true;});await requested;
    assert.equal(settled,false,'new source alpha is part of awaited aggregate readiness');
    const root=new THREE.Group();assert.throws(()=>createHerbariumDistrict(root,{heightAt:()=>7}),/await loadShrubAssets|await loadHerbariumCommunityAssets|await loadHerbariumIvyAssets/);assert.equal(root.children.length,0,'pending source leaves no partial reduced candidate');
    releaseAlpha();await assert.rejects(readiness,/Shrub source preload failed/);
    assert.throws(()=>createHerbariumDistrict(root,{heightAt:()=>7}),/await loadShrubAssets|await loadHerbariumCommunityAssets|await loadHerbariumIvyAssets/);assert.equal(root.children.length,0);
    failAlpha=false;await loadHerbariumAssets({deadline:performance.now()+180000});
    district=createHerbariumDistrict(root,{heightAt:()=>7});
    const communities=new Map(district.communities.map(group=>{
      assert.ok(group.children.length,'a loaded regional bed cannot be empty');
      const ids=new Set(group.children.map(p=>p.userData.regionalCommunity));assert.equal(ids.size,1,'every installed plant belongs to its authored bed');return [[...ids][0],group];
    }));
    assert.equal(communities.size,district.communities.length,'each authored bed installs exactly once');
    assert.deepEqual([...communities.keys()].sort(),['arrival-east','conservatory-grove-woody','pond-near','southwest-woody']);
    const recipes=new Map([...herbariumRegionalCommunities,...herbariumLowGardenBeds].map(region=>[region.id,region]));
    for(const [id,group]of communities){
      const woody=id==='southwest-woody'||id==='conservatory-grove-woody',species=[...new Set(group.children.map(p=>p.userData.botanicalSource.id))].sort();
      assert.deepEqual(species,woody?['didelta_spinosa','fern_02','periwinkle_plant']:['fern_02','periwinkle_plant'],`${id} retains its woody or low garden composition`);
      assert.equal(group.children.length,recipes.get(id).plants.length,`${id} cannot pass preload with a reduced source assembly`);
      assert.equal(group.userData.plantRoots.length,group.children.length);
      if(woody)assert.deepEqual([...new Set(group.children.filter(p=>p.userData.botanicalSource.id==='didelta_spinosa').map(p=>p.userData.botanicalSource.variantIndex))].sort(),[0,1,2],'all three original woody growth stages are present');
    }
    const plants=district.communities.flatMap(g=>g.children),shrubs=plants.filter(p=>p.userData.botanicalSource.id==='didelta_spinosa'),lowPlants=plants.filter(p=>p.userData.botanicalSource.id!=='didelta_spinosa');
    const sourceGeometry=JSON.parse(await readFile(new URL('../public/models/herbarium/didelta-spinosa/geometry-source.json',import.meta.url),'utf8'));
    for(const plant of shrubs){
      const mesh=plant.children[0],variant=plant.userData.botanicalSource.variantIndex;assert.equal(mesh.geometry.index.count/3,sourceGeometry.meshes[variant].triangles,'full original woody LOD0 geometry is installed');
      for(const key of ['map','normalMap','roughnessMap','alphaMap'])assert.deepEqual([mesh.material[key].image.width,mesh.material[key].image.height],[8192,8192],`complete shrub ${key}`);
    }
    for(const plant of lowPlants)plant.traverse(mesh=>{
      if(!mesh.isMesh)return;assert.ok(mesh.geometry.index.count>0&&mesh.geometry.attributes.normal&&mesh.geometry.attributes.uv,'complete textured low-source mesh is installed');
      for(const key of ['map','normalMap','roughnessMap'])assert.deepEqual([mesh.material[key].image.width,mesh.material[key].image.height],[4096,4096],`${plant.userData.botanicalSource.id} ${key}`);
    });
    let sharedGeometryDisposals=0;for(const geometry of new Set(shrubs.map(p=>p.children[0].geometry)))geometry.addEventListener('dispose',()=>sharedGeometryDisposals++);
    const controller=new AbortController();controller.abort();await assert.rejects(loadHerbariumAssets({signal:controller.signal}),/cancel|abort/i);
    assert.equal(district.group.parent,root);assert.ok(district.communities.every(group=>!group.userData.disposed),'a cancelled later consumer cannot dispose the four installed beds');
    assert.equal(requests.filter(p=>p.includes('didelta_spinosa_alpha')).length,2);assert.equal(requests.filter(p=>p.includes('didelta_spinosa_diff')).length,1,'successful full source channel retained for retry');
    for(const id of ['fern_02','periwinkle_plant'])assert.equal(requests.filter(url=>url.endsWith(`/botanical/${id}.glb`)).length,1,`${id} source transfer is shared by all four beds and retained for retry`);
    for(const geometry of district.supportSurfaces)geometry.dispose();district.supportSurfaces.length=0;district.dispose();district.dispose();assert.equal(root.children.length,0);
    assert.ok(district.communities.every(group=>group.userData.disposed&&group.parent===null),'all four community owners release');assert.ok(lowPlants.every(plant=>plant.userData.disposed),'low-source clones release in woody and low-only beds');assert.equal(sharedGeometryDisposals,0,'district disposal preserves resource-cache-owned original woody geometry');district=null;
  }finally{if(district){for(const geometry of district.supportSurfaces)geometry.dispose();district.dispose();}releaseAlpha();Object.assign(globalThis,previous);}
});
