import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three';
import {loadShrubAssets,loadHerbariumCommunityAssets,createShrubSpecimen,createHerbariumCommunity,disposeCommunityAsset,getShrubMaterialMode} from '../src/herbarium-community.js';
import {HerbariumWorker} from './helpers/herbarium-worker.js';

const requests=[];let loaded,loadFailure;
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
before(async()=>{
  const previous={fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap,self:globalThis.self,Worker:globalThis.Worker};let rejectAlpha=true;
  globalThis.Worker=HerbariumWorker;
  globalThis.self=globalThis;
  globalThis.fetch=async(url,options)=>{if(String(url).startsWith('blob:'))return previous.fetch(url,options);requests.push(url);if(url.includes('didelta_spinosa_alpha')&&rejectAlpha)return new Response(null,{status:404});return new Response(await readFile(new URL('../public'+url,import.meta.url)));};
  globalThis.createImageBitmap=async(blob,options={})=>{let pipe=sharp(Buffer.from(await blob.arrayBuffer()));if(options.imageOrientation==='flipY')pipe=pipe.flip();const {data,info}=await pipe.ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8Array(data),width:info.width,height:info.height,close(){}};};
  try{
    try{await loadShrubAssets({deadline:performance.now()+120000});}catch(error){loadFailure=error;}
    rejectAlpha=false;await loadHerbariumCommunityAssets({deadline:performance.now()+120000});loaded=await loadShrubAssets();
  }finally{Object.assign(globalThis,previous);}
});

test('complete 8K material preload retries one missing map and retains original HALF precision and UV orientation',async()=>{
  assert.match(loadFailure.message,/preload failed/);assert.equal(requests.filter(p=>p.includes('didelta_spinosa_alpha')).length,2);
  for(const suffix of ['diff_8k.jpg','nor_gl_8k.exr','rough_8k.exr','translucency_8k.r8.zlib'])assert.equal(requests.filter(p=>p.endsWith(suffix)).length,1,'successful channel decodes are shared across retry');
  const m=loaded.material;for(const key of ['map','normalMap','roughnessMap','alphaMap']){assert.equal(m[key].image.width,8192);assert.equal(m[key].image.height,8192);assert.equal(m[key].flipY,false);}
  assert.equal(m.normalMap.type,THREE.HalfFloatType);assert.ok(m.normalMap.image.data instanceof Uint16Array);assert.equal(m.normalMap.format,THREE.RGBAFormat);assert.equal(m.roughnessMap.type,THREE.HalfFloatType);assert.equal(m.roughnessMap.format,THREE.RedFormat);assert.equal(m.roughnessMap.image.data.length,8192*8192);
  assert.equal(m.alphaMap.format,THREE.RedFormat);assert.equal(m.alphaMap.type,THREE.UnsignedByteType);assert.equal(m.alphaMap.image.data.length,8192*8192);assert.equal(m.alphaMap.anisotropy,8);assert.equal(m.alphaMap.generateMipmaps,true);assert.equal(m.alphaMap.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(m.alphaMap.magFilter,THREE.LinearFilter);
  assert.deepEqual(m.normalScale.toArray(),[1,-1],'same derivative-tangent normal convention as GLTFLoader');assert.equal(m.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(m.map.colorSpace,THREE.SRGBColorSpace);assert.equal(m.alphaTest,.5);assert.equal(m.alphaToCoverage,true);assert.equal(m.displacementMap,null);assert.equal(m.aoMap,null,'unconnected source channels cannot change the source appearance');assert.equal(m.emissive.getHex(),0);
  const controller=new AbortController();controller.abort();await assert.rejects(loadShrubAssets({signal:controller.signal}),/cancelled/);
  const provenance=JSON.parse(await readFile(new URL('../public/models/herbarium/didelta-spinosa/source.json',import.meta.url),'utf8'));
  for(const file of provenance.files){const bytes=await readFile(new URL('../public/models/herbarium/didelta-spinosa/'+file.relative,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.equal(bytes.length,file.bytes);}
  const geometry=await readFile(new URL('../public/models/herbarium/didelta-spinosa/didelta-spinosa-lod0.glb',import.meta.url));assert.equal(createHash('sha256').update(geometry).digest('hex'),provenance.geometry.sha256);
});

test('all original LOD0 triangles and split normals stay immutable under actual basal root centering',()=>{
  const before=loaded.variants.map(v=>Object.fromEntries([...Object.entries(v.geometry.attributes),['index',v.geometry.index]].map(([k,a])=>[k,hash(a.array)])));
  for(let variant=0;variant<3;variant++){
    const group=createShrubSpecimen({variant}),mesh=group.children[0],record=loaded.variants[variant].record,box=new THREE.Box3().setFromObject(group);assert.equal(mesh.geometry.index.count/3,record.triangles);assert.equal(mesh.geometry,loaded.variants[variant].geometry);assert.ok(Math.abs(box.min.y)<1e-7);assert.ok(box.max.y>.9);
    const root=new THREE.Vector3(...record.rootGLTF).applyMatrix4(mesh.matrixWorld);assert.ok(root.length()<1e-7,'remove baked source layout at the basal stem, not the canopy-box center');
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;assert.ok(!mesh.geometry.attributes.tangent);for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.0001);}
    disposeCommunityAsset(group);
  }
  assert.deepEqual(loaded.variants.map(v=>Object.fromEntries([...Object.entries(v.geometry.attributes),['index',v.geometry.index]].map(([k,a])=>[k,hash(a.array)]))),before);
});

test('community has an irregular full-width woody middle above real-scale low plants and every root touches actual loam',()=>{
  const group=createHerbariumCommunity(),soil=group.getObjectByName('Continuous supported specimen loam'),ray=new THREE.Raycaster(),roots=group.userData.plantRoots;
  assert.ok(group.userData.dimensions.width>=8&&group.userData.dimensions.width<=12);assert.ok(group.userData.dimensions.depth>4);assert.ok(group.userData.dimensions.height>2);assert.equal(group.userData.maxWindDisplacement,0);assert.equal(roots.length,48);
  for(const root of roots){ray.set(new THREE.Vector3(...root.root).add(new THREE.Vector3(0,.04,0)),new THREE.Vector3(0,-1,0));ray.far=.045;const hits=ray.intersectObject(soil);assert.ok(hits.length,`${root.species} root ${root.root} is outside actual supported specimen soil`);assert.ok(Math.abs(hits[0].point.y-root.root[1])<1e-6);}
  for(const plant of group.children.slice(16))plant.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.material.map.image.width,4096);assert.equal(mesh.material.normalMap.image.width,4096);assert.equal(mesh.material.roughnessMap.image.width,4096);}});
  const middle=group.children.slice(1,16).map(p=>new THREE.Box3().setFromObject(p).max.y),low=group.children.slice(16).map(p=>new THREE.Box3().setFromObject(p).max.y);assert.ok(Math.max(...middle)>Math.max(...low)+.8,'actual woody crowns form a distinct layer above original-size ground plants');assert.ok(Math.max(...middle)-Math.min(...middle)>.9,'source growth stages preserve a varied upper silhouette');
  for(const root of roots.filter(r=>r.species==='fern_02'))assert.ok(root.variant===0?root.scale>=2&&root.scale<=2.45:root.scale>=2.75&&root.scale<=3.35);
  const same=loaded.variants[0].geometry;let sourceDisposals=0,soilDisposals=0;same.addEventListener('dispose',()=>sourceDisposals++);soil.geometry.addEventListener('dispose',()=>soilDisposals++);disposeCommunityAsset(group);disposeCommunityAsset(group);assert.equal(sourceDisposals,0,'shared source geometry stays in the resource cache');assert.equal(soilDisposals,1);
});

test('source translucency binds real mask and lighting hooks without changing geometry or emitting light',()=>{
  const shader={uniforms:{},fragmentShader:THREE.ShaderLib.physical.fragmentShader};loaded.material.onBeforeCompile(shader);
  assert.equal(getShrubMaterialMode(),'direct');assert.equal(shader.uniforms.shrubDirectTranslucency.value,1);assert.equal(shader.uniforms.shrubIndirectTranslucency.value,0,'matched native review excludes broad unoccluded additive indirect light from the candidate');
  assert.equal(shader.uniforms.shrubTranslucencyMap.value.image.width,8192);assert.equal(shader.uniforms.shrubTranslucencyMap.value.flipY,false);assert.match(shader.fragmentShader,/texelRoughness\.r/);assert.match(shader.fragmentShader,/RE_Direct_Shrub/);assert.match(shader.fragmentShader,/getIBLIrradiance\(-geometryNormal\)/);assert.match(shader.fragmentShader,/texture2D\(shrubTranslucencyMap,vMapUv\)\.r\*1\.7/);assert.equal(loaded.material.emissive.getHex(),0);
});


test('roots study has clear actual triangle sight lines to representative woody and low-plant bases',()=>{
  const group=createHerbariumCommunity(),view=group.userData.studyViews.roots,eye=new THREE.Vector3(...view.eye),ray=new THREE.Raycaster();
  const camera=new THREE.PerspectiveCamera(39,530/519,.01,200);camera.position.copy(eye);camera.lookAt(new THREE.Vector3(...view.target));camera.updateMatrixWorld();
  for(const [x,z]of [[-4.38,.05],[-3.25,-.70],[-4.85,-.73]]){
    const target=new THREE.Vector3(x,.08,z),distance=eye.distanceTo(target);ray.set(eye,target.clone().sub(eye).normalize());ray.far=distance-.16;
    const ndc=target.clone().project(camera);assert.ok(Math.abs(ndc.x)<.95&&Math.abs(ndc.y)<.95,`representative base ${x}, ${z} stays inside the actual roots camera field: ${ndc.toArray()}`);
    const hits=ray.intersectObjects(group.children.slice(1),true);
    assert.equal(hits.length,0,`foreground triangles obscure representative basal line ${x}, ${z}: ${hits.slice(0,3).map(h=>h.object.name+' at '+h.distance.toFixed(3)).join('; ')}`);
  }
  disposeCommunityAsset(group);
});
