import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {
  stoneFishMaterialSpec,decodeStoneFishMaterialMap,prepareXieqiquStoneFishMaterialPixels,
  createStoneFishTriplanarMaterial,updateStoneFishMaterialFrame,createStoneFishMaterialView,
  createXieqiquStoneFishMaterialStudy,
} from '../src/yuanmingyuan/xieqiqu-stone-fish-material-study.js';
import {createBorrowedMaterialSculpture} from '../src/yuanmingyuan/xieqiqu-sculpture-skin.js';

const hash=a=>createHash('sha256').update(a).digest('hex');
const matrixEquals=(a,b,tol=2e-12)=>a.elements.forEach((n,i)=>assert(Math.abs(n-b.elements[i])<tol,`${i}: ${n} / ${b.elements[i]}`));
const proof=g=>Object.fromEntries([['index',g.index],...Object.entries(g.attributes)].map(([k,a])=>[k,hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))]));
function shaderFor(m){const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader);return shader;}
function tinyMaterialOwner(){
  const maps=Object.fromEntries(['color','normal','roughness'].map(c=>{const t=new THREE.DataTexture(new Uint8Array(16).fill(c==='normal'?128:220),2,2,THREE.RGBAFormat);t.colorSpace=c==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;return [c,t];}));
  const materials={carving:createStoneFishTriplanarMaterial({maps}),oldStone:createStoneFishTriplanarMaterial({maps,color:0xe3dfd3})};
  let disposed=false;const events=[];for(const [k,r] of [...Object.entries(materials),...Object.entries(maps)])r.addEventListener('dispose',()=>events.push(k));
  return {materials,textures:Object.values(maps),events,dispose(){if(disposed)return;disposed=true;Object.values(materials).forEach(m=>m.dispose());Object.values(maps).forEach(t=>t.dispose());},get disposed(){return disposed;}};
}
function tinySource(){
  const materials={carving:new THREE.MeshStandardMaterial({color:0xffffff}),oldStone:new THREE.MeshStandardMaterial({color:0xdddddd})};
  const owner=createBorrowedMaterialSculpture({id:'tiny-common-frame-fish-fixture',materials,roles:Object.keys(materials),mouthAnchor:[0,0,0],parts:[
    {id:'continuous-body',role:'carving',create:()=>new THREE.SphereGeometry(.7,32,20)},
    {id:'eye-1',role:'oldStone',create:()=>new THREE.SphereGeometry(.07,16,10).translate(.45,.25,.42)},
  ]});return {owner,materials,dispose(){owner.dispose();Object.values(materials).forEach(m=>m.dispose());}};
}

test('only the existing marble role is named; its manifest and three full-resolution encoded maps match real bytes',async()=>{
  const raw=await readFile(new URL('../public'+stoneFishMaterialSpec.manifestPath,import.meta.url));assert.equal(hash(raw),stoneFishMaterialSpec.manifestSHA256);const manifest=JSON.parse(raw),source=manifest.sources.marble;
  assert.equal(source.asset,'Marble021');assert.equal(source.width,4096);assert.equal(source.height,4096);assert.equal(source.tileMetres,1.5);
  for(const f of Object.values(source.files)){const bytes=await readFile(new URL('../public'+f.path,import.meta.url));assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes),f.sha256);}
  assert.equal(stoneFishMaterialSpec.archiveCompatible,false);assert.equal(stoneFishMaterialSpec.historicalColourVerified,false);
});

test('actual byte/SHA decode boundary retains every small-fixture pixel and always closes the bitmap',async()=>{
  const bytes=new Uint8Array([11,29,47]),file={path:'/small-test.webp',bytes:3,sha256:hash(bytes),width:2,height:2},data=new Uint8Array(Array.from({length:16},(_,i)=>i*13));let closed=0;
  const entry=await decodeStoneFishMaterialMap(bytes,file,{createBitmap:async()=>({width:2,height:2,close(){closed++;}}),readPixels:()=>data});
  assert.equal(closed,1);assert.equal(entry.data,data);assert.equal(entry.decodedSha256,hash(data));assert.equal(entry.encodedSha256,file.sha256);assert.equal(entry.origin,'lower-left');
  await assert.rejects(decodeStoneFishMaterialMap(bytes,{...file,bytes:4}),/truncated/);
  await assert.rejects(decodeStoneFishMaterialMap(new Uint8Array([11,29,48]),file),/SHA mismatch/);
  await assert.rejects(decodeStoneFishMaterialMap(bytes,file,{createBitmap:async()=>({width:1,height:2,close(){closed++;}})}),/dimensions mismatch/);assert.equal(closed,2);
  await assert.rejects(decodeStoneFishMaterialMap(bytes,file,{createBitmap:async()=>({width:2,height:2,close(){closed++;}}),readPixels:()=>new Uint8Array(4)}),/retain all RGBA/);assert.equal(closed,3);
});

test('prepare rejects bad identity before maps; an abort after real manifest or during decode cannot leave an open bitmap',async()=>{
  let fetches=0;await assert.rejects(prepareXieqiquStoneFishMaterialPixels({fetchFile:async()=>{fetches++;return new Response('{}');}}),/manifest SHA mismatch/);assert.equal(fetches,1);
  const manifest=await readFile(new URL('../public'+stoneFishMaterialSpec.manifestPath,import.meta.url)),controller=new AbortController();
  await assert.rejects(prepareXieqiquStoneFishMaterialPixels({signal:controller.signal,fetchFile:async()=>{controller.abort();return new Response(manifest);}}),{name:'AbortError'});
  const c=new AbortController(),bytes=new Uint8Array([1,2,3]);let closed=0;
  await assert.rejects(decodeStoneFishMaterialMap(bytes,{path:'/small',bytes:3,sha256:hash(bytes),width:2,height:2},{signal:c.signal,createBitmap:async()=>({width:2,height:2,close(){closed++;}}),readPixels:()=>{c.abort();return new Uint8Array(16);}}),{name:'AbortError'});assert.equal(closed,1);
  assert.throws(()=>createXieqiquStoneFishMaterialStudy({pixels:{}}),/full 4K marble prepare/);
});

test('the real Three standard shader chunks receive only the three continuous samples and one surface-gradient resolve',()=>{
  const owner=tinyMaterialOwner();try{
    const m=owner.materials.carving,s=shaderFor(m);assert(m.isMeshStandardMaterial);assert.equal(m.transparent,false);assert.equal(m.alphaTest,0);assert.equal(m.depthWrite,true);assert.equal(m.displacementMap,null);
    for(const marker of ['map_fragment','roughnessmap_fragment','normal_fragment_maps'])assert(!s.fragmentShader.includes('#include <'+marker+'>'));
    assert(s.fragmentShader.includes('gradient - n * dot( n, gradient )'));assert(s.fragmentShader.includes('fishMetricNormalToView * fishPerturbedNormal'));
    assert.deepEqual(s.uniforms.fishCutRoughness.value.toArray(),[.66,.88]);assert.equal(m.roughness,.98);assert(s.fragmentShader.includes('mix( fishCutRoughness.x, fishCutRoughness.y,'));
    assert(s.vertexShader.includes('fishAssetToMetric * vec4( transformed, 1.0 )'));assert(s.vertexShader.includes('fishNormalToMetric * objectNormal'));
    assert.equal((s.fragmentShader.match(/uniform float fishTileMetres;/g)??[]).length,1);assert.equal(s.uniforms.fishTileMetres.value,1.5);
    const changed=createStoneFishTriplanarMaterial({maps:{color:m.map,normal:m.normalMap,roughness:m.roughnessMap},normalStrength:.25});try{const other=shaderFor(changed);assert.equal(changed.customProgramCacheKey(),m.customProgramCacheKey());assert.notEqual(s.uniforms.fishNormalStrength,other.uniforms.fishNormalStrength);assert.equal(other.uniforms.fishNormalStrength.value,.25);}finally{changed.dispose();}
    const missing={uniforms:{},vertexShader:'void main(){}',fragmentShader:'void main(){}'};assert.throws(()=>m.onBeforeCompile(missing),/unexpected Three shader chunk/);
  }finally{owner.dispose();}
});

test('metric frame preserves real metre lengths and unperturbed normals through rotation/nonuniform scale and current main/reflection cameras',()=>{
  const materialOwner=tinyMaterialOwner(),fixture=tinySource(),view=createStoneFishMaterialView({sourceOwner:fixture.owner,materialOwner});
  try{
    view.group.position.set(884,4.1,-580);view.group.rotation.set(.3,-.6,.12);view.group.scale.set(1.4,.8,2.1);view.group.updateMatrixWorld(true);
    const mesh=view.group.children[0],shader=shaderFor(mesh.material),localA=new THREE.Vector3(.1,.2,.3),localB=new THREE.Vector3(-.3,.5,.1);
    for(const cameraPosition of [[4,3,8],[8,1,-3],[4,-3,8]]){
      const camera=new THREE.PerspectiveCamera(40,1,.04,1200);camera.position.set(...cameraPosition).add(view.group.position);camera.lookAt(view.group.position);camera.updateMatrixWorld(true);
      mesh.onBeforeRender(null,null,camera,mesh.geometry,mesh.material);
      const frame=shader.uniforms.fishAssetToMetric.value;
      const metricDistance=localA.clone().applyMatrix4(frame).distanceTo(localB.clone().applyMatrix4(frame));
      const worldDistance=localA.clone().applyMatrix4(view.group.matrixWorld).distanceTo(localB.clone().applyMatrix4(view.group.matrixWorld));assert(Math.abs(metricDistance-worldDistance)<2e-13);
      const expected=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,view.group.matrixWorld));
      const actual=shader.uniforms.fishMetricNormalToView.value.clone().multiply(shader.uniforms.fishNormalToMetric.value);matrixEquals(actual,expected);
      const normals=mesh.geometry.attributes.normal;for(let i=0;i<normals.count;i+=23){const n=new THREE.Vector3().fromBufferAttribute(normals,i),a=n.clone().applyMatrix3(actual).normalize(),b=n.applyMatrix3(expected).normalize();assert(a.distanceTo(b)<3e-15);}
      const before=frame.clone(),override=new THREE.MeshNormalMaterial();try{mesh.onBeforeRender(null,null,new THREE.PerspectiveCamera(),mesh.geometry,override);matrixEquals(frame,before);}finally{override.dispose();}
    }
    view.group.scale.x=-1;assert.throws(()=>updateStoneFishMaterialFrame(mesh.material,view.group,new THREE.PerspectiveCamera()),/reflected root/);
  }finally{view.dispose();fixture.dispose();}
});

test('rounded sphere UV seams do not affect metric projection inputs; all original attributes and index buffers stay identical',()=>{
  const materialOwner=tinyMaterialOwner(),fixture=tinySource(),before=fixture.owner.group.children.map(m=>proof(m.geometry)),oldMaterials=fixture.owner.group.children.map(m=>m.material),oldParents=fixture.owner.group.children.map(m=>m.parent),oldCallbacks=fixture.owner.group.children.map(m=>m.onBeforeRender),view=createStoneFishMaterialView({sourceOwner:fixture.owner,materialOwner});
  try{
    const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const mesh=view.group.children[0],g=mesh.geometry,s=shaderFor(mesh.material);mesh.onBeforeRender(null,null,camera,g,mesh.material);
    // SphereGeometry has separate vertices at u=0 and u=1. Their old UVs differ
    // while the candidate consumes the continuous position and smooth normal.
    let checked=0;for(let row=1;row<20;row++){const a=row*33,b=a+32,pa=new THREE.Vector3().fromBufferAttribute(g.attributes.position,a).applyMatrix4(s.uniforms.fishAssetToMetric.value),pb=new THREE.Vector3().fromBufferAttribute(g.attributes.position,b).applyMatrix4(s.uniforms.fishAssetToMetric.value);assert(pa.distanceTo(pb)<1e-14);assert.equal(Math.abs(g.attributes.uv.getX(a)-g.attributes.uv.getX(b)),1);checked++;}assert.equal(checked,19);
    view.group.children.forEach((m,i)=>{assert.equal(m.geometry,fixture.owner.group.children[i].geometry);assert.deepEqual(proof(m.geometry),before[i]);assert.equal(fixture.owner.group.children[i].material,oldMaterials[i]);assert.equal(fixture.owner.group.children[i].parent,oldParents[i]);assert.equal(fixture.owner.group.children[i].onBeforeRender,oldCallbacks[i]);assert.equal(m.castShadow,true);assert.equal(m.receiveShadow,true);});
    assert.equal(view.diagnostics.materialStudy.textureResolution,2);assert.equal(view.diagnostics.materialStudy.fullResolutionVerified,false);
  }finally{view.dispose();fixture.dispose();}
});

test('separate owners have independent shader state and texture lifetimes; borrowed sources are never disposed',()=>{
  const fixture=tinySource(),m1=tinyMaterialOwner(),m2=tinyMaterialOwner(),v1=createStoneFishMaterialView({sourceOwner:fixture.owner,materialOwner:m1}),v2=createStoneFishMaterialView({sourceOwner:fixture.owner,materialOwner:m2});let geometryDisposals=0;fixture.owner.group.children.forEach(m=>m.geometry.addEventListener('dispose',()=>geometryDisposals++));
  try{
    const s1=shaderFor(v1.group.children[0].material),s2=shaderFor(v2.group.children[0].material);assert.notEqual(s1.uniforms.fishAssetToMetric,s2.uniforms.fishAssetToMetric);assert.notEqual(v1.group.children[0].material.map,v2.group.children[0].material.map);
    v1.dispose();v1.dispose();assert.equal(geometryDisposals,0);assert.equal(fixture.owner.disposed,false);assert.equal(m1.events.length,5);assert.equal(m2.events.length,0);
    fixture.owner.group.children[0].geometry.dispose();assert.equal(v2.invalidated,true);assert.equal(v2.group.visible,false);
  }finally{v1.dispose();v2.dispose();fixture.dispose();}
});

test('owned sources release geometry once; abort and unsupported source poses release only the resources taken over',()=>{
  const fixture=tinySource(),materials=tinyMaterialOwner();let count=0;fixture.owner.group.children.forEach(m=>m.geometry.addEventListener('dispose',()=>count++));
  const owned=createStoneFishMaterialView({sourceOwner:fixture.owner,materialOwner:materials,ownsSource:true});owned.dispose();owned.dispose();assert.equal(count,2);assert.equal(materials.events.length,5);Object.values(fixture.materials).forEach(m=>m.dispose());
  for(const mode of ['abort','pose','hook']){const f=tinySource(),m=tinyMaterialOwner(),controller=new AbortController();if(mode==='abort')controller.abort();else if(mode==='pose')f.owner.group.children[1].position.x=.01;else f.owner.group.children[1].onBeforeShadow=()=>{};
    assert.throws(()=>createStoneFishMaterialView({sourceOwner:f.owner,materialOwner:m,signal:controller.signal}),mode==='abort'?{name:'AbortError'}:mode==='pose'?/common fish frame/:/source rendering callback/);assert.equal(m.events.length,5);assert.equal(f.owner.disposed,false);assert.equal(f.owner.group.children.length,2);f.dispose();}
});
