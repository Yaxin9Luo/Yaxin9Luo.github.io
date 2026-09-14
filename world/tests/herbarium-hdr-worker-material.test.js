import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three';
import {loadShrubAssets,loadShrubTexture,createShrubSpecimen,disposeCommunityAsset,getShrubNormalSourceState} from '../src/herbarium-community.js';
import {shrubNormalDescriptor} from '../src/herbarium-normal-policy.js';
import {HerbariumWorker} from './helpers/herbarium-worker.js';

// Full-resolution integration: run only in the separately scheduled asset window.
// Uses the accepted public artifact and descriptor, retaining historical audit binding.
// It never substitutes a test descriptor or runs the EXR normal decoder/control.
const root=new URL('../../',import.meta.url),sourceRoot='/models/herbarium/didelta-spinosa/';
const acceptedArtifact={bytes:27297259,sha256:'fb49f83f6955641d070ff7e352926dbb19568f5b961a0817e78f202203b12564'};
const sourceManifest={path:'world/public/models/herbarium/didelta-spinosa/source.json',bytes:5594,sha256:'c914fc780c08909842055ae76c5e03b3cca094c4f4eb696b607570db08e51890'};
const scalarManifest={path:'world/public/models/herbarium/didelta-spinosa/scalar-source.json',bytes:2097,sha256:'c71f392021b7d3f96914a89aac56c6ea9a0da9cb93ef8bca674c9abea94c2ccf'};
const geometryMetadata={path:'world/public/models/herbarium/didelta-spinosa/geometry-source.json',bytes:11288,sha256:'42d8794b67d524fb6a339173683ad6793707d8173bdd923b031a42cfb5eef9dc'};
const originalMaterialSource={path:'world/tests/helpers/fixtures/herbarium-community-before-hdr.js.txt',bytes:17513,sha256:'c4ae9c90c2589d21fe5ffb05d738762c7b7ad9d00c186d8610a9864f4544b291'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function verified(record){
  const bytes=await readFile(new URL(record.path,root));
  assert.equal(bytes.length,record.bytes,`${record.path}: byte identity`);
  assert.equal(sha(bytes),record.sha256,`${record.path}: SHA identity`);
  return bytes;
}
const materialSource=source=>{
  const start=source.indexOf('function scalarAlpha('),end=source.indexOf('/** The same binding boundary');
  assert.ok(start>=0&&end>start,'locate the complete main/depth/distance material implementation');
  return source.slice(start,end);
};
function geometryIdentity(geometry){
  const attribute=a=>a?{arrayType:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,bytes:a.array.byteLength,sha256:sha(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))}:null;
  return {attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([key,a])=>[key,attribute(a)])),index:attribute(geometry.index),groups:structuredClone(geometry.groups),drawRange:{...geometry.drawRange}};
}
function sampler(texture,{colorSpace=THREE.NoColorSpace,magFilter=THREE.NearestFilter,generateMipmaps=true}={}){
  assert.deepEqual([texture.image.width,texture.image.height],[8192,8192]);
  assert.equal(texture.flipY,false);assert.equal(texture.colorSpace,colorSpace);
  assert.equal(texture.wrapS,THREE.RepeatWrapping);assert.equal(texture.wrapT,THREE.RepeatWrapping);
  assert.equal(texture.anisotropy,8);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);
  assert.equal(texture.magFilter,magFilter);assert.equal(texture.generateMipmaps,generateMipmaps);
}

test('approved full HDR flows through the real worker, shared source and unchanged main/shadow materials', {timeout:240000},async t=>{
  // Resolve acceptance before any large file is read or any worker is created.
  // An unresolved draft is an explicit failure, never a skip or EXR fallback.
  const descriptor=shrubNormalDescriptor('astc-hdr');
  const records=[];
  for(const [url,hash]of [[descriptor.derivative.recipeURL,descriptor.derivative.recipeSHA256],[descriptor.derivative.acceptanceURL,descriptor.derivative.acceptanceSHA256]]){
    const bytes=await readFile(new URL('world/public'+url,root));assert.equal(sha(bytes),hash);records.push(JSON.parse(bytes));
  }
  const [recipe,acceptance]=records;
  assert.equal(recipe.schema,'didelta-normal-hdr-recipe-v1');assert.equal(acceptance.decision,'ACCEPT_FOR_RUNTIME_INTEGRATION');
  assert.equal(acceptance.runId,'plant-4cda36b7-f9bb-4e7a-b0c2-5bf365d37aa6');
  assert.deepEqual(acceptance.derivative,recipe.derivative);assert.deepEqual(acceptance.source,recipe.source);
  assert.equal(recipe.derivative.url,descriptor.url);assert.equal(recipe.derivative.bytes,acceptedArtifact.bytes);assert.equal(recipe.derivative.sha256,acceptedArtifact.sha256);
  const artifacts={width:recipe.input.width,height:recipe.input.height,levels:recipe.input.levels,encoded:{...recipe.derivative,path:'world/public'+recipe.derivative.url},source:{...recipe.source,path:'world/public'+recipe.source.url}};
  assert.deepEqual([artifacts.width,artifacts.height,artifacts.levels],[8192,8192,14]);
  assert.equal(descriptor.derivative.bytes,artifacts.encoded.bytes);
  assert.equal(descriptor.derivative.sha256,artifacts.encoded.sha256);
  assert.equal(descriptor.sourceSHA256,artifacts.source.sha256);
  const provenance=JSON.parse(await verified(sourceManifest)),scalars=JSON.parse(await verified(scalarManifest));
  const materialOrigin=JSON.parse(await readFile(new URL('./helpers/fixtures/herbarium-community-before-hdr.origin.json',import.meta.url)));
  assert.deepEqual(materialOrigin.fixture,originalMaterialSource);
  const originalSource=(await verified(originalMaterialSource)).toString('utf8');
  const currentSource=await readFile(new URL('../src/herbarium-community.js',import.meta.url),'utf8');
  assert.equal(materialSource(currentSource),materialSource(originalSource),'entire original main/depth/distance shader/material recipe remains unchanged');
  assert.equal(getShrubNormalSourceState().status,'unselected','isolated source lifetime');

  const allowed=new Map([[sourceRoot+'didelta-spinosa-lod0.glb',provenance.geometry],[sourceRoot+'geometry-source.json',geometryMetadata],[descriptor.url,{...artifacts.encoded,path:'world/public'+descriptor.url}]]);
  for(const suffix of ['diff_8k.jpg','rough_8k.exr']){
    const entry=provenance.files.find(f=>f.relative.endsWith(suffix));assert.ok(entry);
    allowed.set(sourceRoot+entry.relative,{...entry,path:'world/public'+sourceRoot+entry.relative});
  }
  for(const entry of scalars.files)allowed.set(sourceRoot+entry.output,{path:'world/public'+sourceRoot+entry.output,bytes:entry.compressedBytes,sha256:entry.outputSha256});
  assert.equal(allowed.size,7,'exactly five active maps, geometry and metadata');
  assert.ok(!allowed.has(sourceRoot+'textures/didelta_spinosa_nor_gl_8k.exr'));
  const previous={fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap,self:globalThis.self,Worker:globalThis.Worker};
  const requests=[],workers=[],jobs=[],forbidden=[];let live=0,maxLive=0,imageCloses=0;
  const survivor=new AbortController(),departing=new AbortController();
  const abortSurvivor=()=>survivor.abort(t.signal.reason);t.signal.addEventListener('abort',abortSurvivor,{once:true});
  t.after(async()=>{
    survivor.abort();departing.abort();t.signal.removeEventListener('abort',abortSurvivor);
    await Promise.all(workers.map(worker=>worker.terminate()));Object.assign(globalThis,previous);
  });
  globalThis.self=globalThis;
  globalThis.Worker=class extends HerbariumWorker{
    constructor(url){
      assert.match(url.pathname,/\/src\/herbarium-texture-worker\.js$/,'actual source worker only; no Basis worker');
      super(url);workers.push(this);maxLive=Math.max(maxLive,++live);
    }
    postMessage(data,transfer){
      const record={key:data.key,encoding:data.normalEncoding,inputBytes:data.buffer.byteLength,detached:false,returned:false};jobs.push(record);this.record=record;
      this.addEventListener('message',({data:reply})=>{if(reply.result){record.returned=true;if(data.key==='normalMap')this.hdrResult=reply.result;}});
      assert.deepEqual(transfer,[data.buffer]);super.postMessage(data,transfer);
      record.detached=data.buffer.byteLength===0;assert.ok(record.detached,'encoded input transfers to worker without a retained main-thread buffer');
      if(data.key==='normalMap')departing.abort(new Error('one shared HDR caller leaves'));
    }
    terminate(){
      if(!this.termination)this.termination=super.terminate().then(()=>{live--;if(this.record)this.record.terminated=true;});
      return this.termination;
    }
  };
  globalThis.fetch=async(url,{signal}={})=>{
    const path=String(url);requests.push(path);signal?.throwIfAborted();
    if(!allowed.has(path)){forbidden.push(path);throw Object.assign(new Error(`Unexpected resource: ${path}`),{type:'fixture'});}
    const bytes=await verified(allowed.get(path));signal?.throwIfAborted();
    return new Response(bytes,{headers:{'content-length':String(bytes.length)}});
  };
  globalThis.createImageBitmap=async(blob,options)=>{
    assert.deepEqual(options,{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    return {data:new Uint8Array(data.buffer,data.byteOffset,data.byteLength),width:info.width,height:info.height,close(){imageCloses++;}};
  };
  const deadline=performance.now()+180000,options={normalEncoding:'astc-hdr',signal:survivor.signal,deadline};
  const unchanged={};
  // Four unchanged channels are prepared serially, not a second scene/full normal audit.
  for(const key of ['map','roughnessMap','alphaMap','translucencyMap'])unchanged[key]=await loadShrubTexture(key,options);
  const versions=Object.fromEntries(Object.entries(unchanged).map(([key,texture])=>[key,texture.version]));
  const departingPromise=loadShrubAssets({...options,signal:departing.signal});
  const departingRejected=assert.rejects(departingPromise,/request cancelled/);
  const retainedPromise=loadShrubAssets(options);
  await assert.rejects(loadShrubAssets({...options,normalEncoding:'exr'}),/cannot bind or load exr/,'pending encoding is fixed');
  const loaded=await retainedPromise;await departingRejected;
  const m=loaded.material,normal=m.normalMap;
  assert.equal(loaded.normalEncoding,'astc-hdr');assert.equal(getShrubNormalSourceState().status,'bound');
  assert.equal(getShrubNormalSourceState().pendingConsumers,0);
  assert.equal(normal.isCompressedTexture,true);assert.equal(normal.format,THREE.RGBA_ASTC_4x4_Format);assert.equal(normal.type,THREE.HalfFloatType);
  assert.equal(normal.image.data,undefined,'no full HALF expansion');assert.equal(normal.mipmaps.length,14);
  const hdrReply=workers.find(worker=>worker.record?.key==='normalMap').hdrResult;
  assert.equal(hdrReply.data,undefined);assert.equal(normal.mipmaps,hdrReply.mipmaps,'all transferred worker mip objects bind directly to the material texture');
  sampler(normal,{generateMipmaps:false});
  const mipBuffers=new Set(),mips=normal.mipmaps.map((mip,level)=>{
    const width=Math.max(1,8192/2**level),bytes=Math.ceil(width/4)**2*16;
    assert.deepEqual([mip.width,mip.height],[width,width]);assert.ok(mip.data instanceof Uint8Array);
    assert.equal(mip.data.byteOffset,0);assert.equal(mip.data.byteLength,bytes);assert.equal(mip.data.buffer.byteLength,bytes);
    assert.ok(!mipBuffers.has(mip.data.buffer));mipBuffers.add(mip.data.buffer);
    return {level,width,height:width,bytes,sha256:sha(mip.data)};
  });
  assert.equal(normal.userData.source,'/'+artifacts.source.path.replace(/^world\/public\//,''));
  assert.equal(normal.userData.uploadSource,descriptor.url);assert.equal(normal.userData.sourceSHA256,artifacts.source.sha256);
  assert.deepEqual(normal.userData.derivative,descriptor.derivative);assert.equal(normal.userData.lossless,false);
  assert.equal(normal.userData.mipOrigin,'supplied-14-levels');
  for(const key of ['map','roughnessMap','alphaMap'])assert.equal(m[key],unchanged[key]);
  sampler(m.map,{colorSpace:THREE.SRGBColorSpace,magFilter:THREE.LinearFilter});sampler(m.roughnessMap);
  sampler(m.alphaMap,{magFilter:THREE.LinearFilter});sampler(unchanged.translucencyMap,{magFilter:THREE.LinearFilter});
  assert.equal(m.roughnessMap.type,THREE.HalfFloatType);assert.equal(m.roughnessMap.format,THREE.RedFormat);assert.equal(m.roughnessMap.image.data.constructor,Uint16Array);assert.equal(m.roughnessMap.image.data.length,8192**2);
  for(const key of ['alphaMap','translucencyMap']){
    const texture=unchanged[key],entry=scalars.files.find(f=>f.sourceChannel===(key==='alphaMap'?'G':'R'));
    assert.equal(texture.format,THREE.RedFormat);assert.equal(texture.type,THREE.UnsignedByteType);assert.equal(texture.image.data.constructor,Uint8Array);
    assert.equal(texture.image.data.length,8192**2);assert.equal(sha(texture.image.data),entry.decodedSha256,'original scalar plane remains exact');
  }
  assert.deepEqual(m.normalScale.toArray(),[1,-1]);assert.equal(m.alphaTest,.5);assert.equal(m.alphaToCoverage,true);
  assert.equal(m.side,THREE.DoubleSide);assert.equal(m.depthWrite,true);assert.equal(m.transparent,false);
  assert.equal(m.emissive.getHex(),0);assert.equal(m.aoMap,null);assert.equal(m.displacementMap,null);
  const shader={uniforms:{},fragmentShader:THREE.ShaderLib.physical.fragmentShader};m.onBeforeCompile(shader);
  assert.equal(shader.uniforms.shrubTranslucencyMap.value,unchanged.translucencyMap);
  assert.equal(shader.uniforms.shrubDirectTranslucency.value,1);assert.equal(shader.uniforms.shrubIndirectTranslucency.value,0);
  assert.match(shader.fragmentShader,/texelRoughness\.r/);assert.match(shader.fragmentShader,/texture2D\(shrubTranslucencyMap,vMapUv\)\.r\*1\.7/);
  const alphaChunk=THREE.ShaderChunk.alphamap_fragment.replace(').g;',').r;');assert.ok(shader.fragmentShader.includes(alphaChunk));
  for(const [material,kind]of [[loaded.depthMaterial,'depth'],[loaded.distanceMaterial,'distance']]){
    assert.equal(material.map,unchanged.map);assert.equal(material.alphaMap,unchanged.alphaMap);assert.equal(material.alphaTest,.5);
    const shadow={uniforms:{},fragmentShader:THREE.ShaderLib[kind].fragmentShader};material.onBeforeCompile(shadow);
    assert.equal(shadow.fragmentShader,THREE.ShaderLib[kind].fragmentShader.replace('#include <alphamap_fragment>',alphaChunk),'same actual alpha sampling in each shadow shader');
  }
  assert.equal(loaded.variants.length,3);
  const geometryBefore=loaded.variants.map(v=>geometryIdentity(v.geometry));let sharedDisposals=0;
  const shared=[...loaded.variants.map(v=>v.geometry),m,loaded.depthMaterial,loaded.distanceMaterial,normal,...Object.values(unchanged)];
  for(const object of shared)object.addEventListener('dispose',()=>sharedDisposals++);
  const specimen=createShrubSpecimen({variant:0}),mesh=specimen.children[0],variant=loaded.variants[0];
  assert.equal(mesh.geometry,variant.geometry);assert.equal(mesh.material,m);assert.equal(mesh.customDepthMaterial,loaded.depthMaterial);assert.equal(mesh.customDistanceMaterial,loaded.distanceMaterial);
  assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);assert.deepEqual(mesh.matrix.elements,variant.matrix.elements);
  for(const item of loaded.variants)assert.equal((item.geometry.index?.count||item.geometry.attributes.position.count)/3,item.record.triangles);
  const basal=new THREE.Vector3(...variant.record.rootGLTF).applyMatrix4(mesh.matrixWorld);assert.ok(basal.length()<1e-7);
  disposeCommunityAsset(specimen);disposeCommunityAsset(specimen);
  assert.equal(sharedDisposals,0);assert.equal(imageCloses,0);assert.deepEqual(loaded.variants.map(v=>geometryIdentity(v.geometry)),geometryBefore);
  assert.deepEqual(Object.fromEntries(Object.entries(unchanged).map(([key,texture])=>[key,texture.version])),versions);
  const count=requests.length;assert.equal(await loadShrubAssets(options),loaded);assert.equal(await loadShrubTexture('normalMap',options),normal);
  await assert.rejects(loadShrubAssets({...options,normalEncoding:'exr'}),/cannot bind or load exr/);
  assert.equal(requests.length,count);assert.deepEqual(forbidden,[]);assert.equal(requests.length,7);
  for(const url of allowed.keys())assert.equal(requests.filter(p=>p===url).length,1,`one shared request: ${url}`);
  assert.deepEqual(jobs.map(j=>[j.key,j.encoding]),[['roughnessMap','exr'],['alphaMap','exr'],['translucencyMap','exr'],['normalMap','astc-hdr']]);
  assert.equal(jobs.at(-1).inputBytes,artifacts.encoded.bytes);assert.ok(jobs.every(j=>j.detached&&j.returned&&j.terminated));
  assert.equal(maxLive,1);assert.equal(live,0);assert.equal(normal.mipmaps.length,14);assert.ok(normal.mipmaps.every(mip=>mip.data.byteLength>0));
  t.diagnostic(JSON.stringify({artifact:artifacts.encoded,sourceSHA256:artifacts.source.sha256,requests,jobs,maxLiveWorkers:maxLive,mips,compressedBlockBytes:mips.reduce((sum,mip)=>sum+mip.bytes,0),geometryTriangles:loaded.variants.map(v=>v.record.triangles),scope:'CPU worker/material/shadow-binding integration only; no GPU, pixel, codec-equivalence or physical-memory claim'}));
});
