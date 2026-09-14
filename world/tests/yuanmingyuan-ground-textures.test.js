import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import {loadGardenGroundTextures,applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {assetManifest} from '../src/asset-manifest.js';
import {gardenGround4kMaterial} from '../src/yuanmingyuan/ground-material-4k.js';

const fetcher=async path=>new Response(await readFile(new URL('../public'+path,import.meta.url)));
test('default and explicit 1k textures keep independent Texture/bitmap owners and geometry material settings',async()=>{
  const bitmaps=[];const decode=async(blob,options)=>{assert.equal(options.imageOrientation,'flipY');assert(blob.size>300000);const image={width:1024,height:1024,closed:0,close(){this.closed++;}};bitmaps.push(image);return image;};
  const a=await loadGardenGroundTextures({fetcher,decode}),b=await loadGardenGroundTextures({resolution:'1k',fetcher,decode});
  assert.equal(a.resolution,'1k');assert.equal(a.source,'/textures/manifest.json#materials.meadow');assert.equal(a.tileMetres,15);
  for(const channel of ['color','normal','roughness']){
    const path=`/textures/meadow/${channel}.webp`,record=assetManifest[path];
    assert.deepEqual(a.files[channel],{path,url:record.url,sha256:record.sha256,bytes:record.bytes,width:1024,height:1024});
  }
  assert.notEqual(a.map,b.map);assert.notEqual(a.map.image,b.map.image);assert.equal(a.map.colorSpace,THREE.SRGBColorSpace);assert.equal(a.normalMap.colorSpace,THREE.NoColorSpace);
  const material=new THREE.MeshStandardMaterial({vertexColors:true});applyGardenGroundTextures(material,a);assert.equal(material.vertexColors,true);assert.equal(material.normalMap,a.normalMap);assert.equal(material.bumpMap,null);
  const events=[];for(const slot of ['map','normalMap','roughnessMap'])a[slot].addEventListener('dispose',()=>events.push(slot));a.dispose();a.dispose();assert.equal(a.disposed,true);assert.equal(events.length,3);assert(bitmaps.slice(0,3).every(image=>image.closed===1));assert.equal(b.map.image.closed,0);b.dispose();material.dispose();
});
test('leaving during bitmap decode closes its late image and does not return a texture',async()=>{
  const controller=new AbortController();let closed=0;
  await assert.rejects(loadGardenGroundTextures({signal:controller.signal,fetcher,decode:async()=>{controller.abort();return {close(){closed++;}};}}),{name:'AbortError'});
  assert.equal(closed,1);
});
test('a broken local material cannot silently become an untextured success',async()=>{
  await assert.rejects(loadGardenGroundTextures({fetcher:async()=>new Response(new Uint8Array([1,2,3])),decode:async()=>{throw new Error('Must not decode corrupted bytes');}}),/byte length mismatch/);
});

const slots=['map','normalMap','roughnessMap'],channels=['color','normal','roughness'];
const bitmap=(width=1024,height=1024)=>({width,height,closed:0,close(){this.closed++;}});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
async function trackDisposal(run){
  const original=THREE.Texture.prototype.dispose,released=[];
  THREE.Texture.prototype.dispose=function(){released.push(this.image);return original.call(this);};
  try{await run(released);}finally{THREE.Texture.prototype.dispose=original;}
}
const channelOf=path=>path.includes('roughness')?'roughness':path.includes('normal')?'normal':'color';

test('the actual frozen 4k files use their own paths, SHA/byte identity and actual encoded dimensions',async()=>{
  // Read/hash the real 60 MB package once. Only WebP headers are needed here:
  // bitmap ownership is controlled below; there is no encoding or GPU decode.
  sharp.cache(false);sharp.concurrency(1);
  const requested=[],images=[],signals=[];
  const resource=await loadGardenGroundTextures({resolution:'4k',fetcher:async(path,{signal})=>{
    requested.push(path);signals.push(signal);return fetcher(path);
  },decode:async(blob,options)=>{
    assert.deepEqual(options,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const metadata=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.hasAlpha,false);
    const image=bitmap(metadata.width,metadata.height);images.push(image);return image;
  }});
  try{
    assert.equal(resource.resolution,'4k');assert.equal(resource.source,gardenGround4kMaterial.manifestPath);assert.equal(resource.tileMetres,15);
    assert.deepEqual(requested,channels.map(channel=>gardenGround4kMaterial.files[channel].path));assert(signals.every(s=>s===signals[0]));
    for(let i=0;i<channels.length;i++){
      const channel=channels[i],record=gardenGround4kMaterial.files[channel],texture=resource[slots[i]];
      assert.deepEqual(resource.files[channel],{...record,url:record.path});assert(Object.isFrozen(resource.files[channel]));
      assert.equal(texture.image.width,4096);assert.equal(texture.image.height,4096);assert.deepEqual(texture.repeat.toArray(),[5/6,5/6]);
      assert.equal(texture.colorSpace,i===0?THREE.SRGBColorSpace:THREE.NoColorSpace);
      assert.equal(texture.wrapS,THREE.RepeatWrapping);assert.equal(texture.wrapT,THREE.RepeatWrapping);assert.equal(texture.anisotropy,16);assert.equal(texture.flipY,false);
    }
    const material=new THREE.MeshStandardMaterial({vertexColors:true});try{
      applyGardenGroundTextures(material,resource);assert.equal(material.roughness,.98);assert.deepEqual(material.normalScale.toArray(),[.42,.42]);assert.equal(material.bumpMap,null);
      assert.equal(material.vertexColors,true);assert.equal(material.userData.earthTextureSource,resource.source);
    }finally{material.dispose();}
  }finally{resource.dispose();}
  assert(images.every(image=>image.closed===1));assert(signals[0].aborted);assert.equal(resource.disposed,true);
});

test('invalid resolution and already-aborted callers never start fetching or decoding',async()=>{
  let calls=0;const unused=async()=>{calls++;throw new Error('Must not run');};
  for(const resolution of ['2k','4K',null,0])await assert.rejects(loadGardenGroundTextures({resolution,fetcher:unused,decode:unused}),/resolution must be/);
  const controller=new AbortController(),reason=new Error('left before request');controller.abort(reason);
  await assert.rejects(loadGardenGroundTextures({signal:controller.signal,fetcher:unused,decode:unused}),error=>error===reason);assert.equal(calls,0);
});

test('HTTP, body, byte-count and same-size hash failures release previously acquired bitmap and texture owners',async()=>{
  for(const failure of ['http','body','bytes','hash'])await trackDisposal(async released=>{
    const images=[];let decodes=0;
    await assert.rejects(loadGardenGroundTextures({fetcher:async(path)=>{
      if(channelOf(path)!=='normal')return fetcher(path);
      if(failure==='http')return new Response('',{status:503});
      if(failure==='body')return{ok:true,arrayBuffer:async()=>{throw new Error('body interrupted');}};
      const bytes=await readFile(new URL('../public'+path,import.meta.url));
      if(failure==='bytes')return new Response(bytes.subarray(1));
      const corrupted=Buffer.from(bytes);corrupted[corrupted.length-1]^=1;return new Response(corrupted);
    },decode:async()=>{decodes++;const image=bitmap();images.push(image);return image;}}),
    failure==='http'?/normal HTTP 503/:failure==='body'?/body interrupted/:failure==='bytes'?/normal byte length mismatch/:/normal hash mismatch/);
    assert.equal(decodes,1);assert.equal(released.length,1);assert.equal(images.length,1);assert.equal(images[0].closed,1);assert.equal(released[0],images[0]);
  });
});

test('decoder rejection and wrong bitmap dimensions cannot leak either earlier textures or the rejected bitmap',async()=>{
  for(const failure of ['decode','width','height','missing'])await trackDisposal(async released=>{
    const images=[];let calls=0;
    await assert.rejects(loadGardenGroundTextures({fetcher,decode:async()=>{
      calls++;if(calls===2&&failure==='decode')throw new Error('bitmap decode failed');
      if(calls===2&&failure==='missing')return null;
      const image=bitmap(calls===2&&failure==='width'?4096:1024,calls===2&&failure==='height'?512:1024);images.push(image);return image;
    }}),failure==='decode'?/bitmap decode failed/:/decoded dimensions mismatch/);
    assert.equal(calls,2);assert.equal(released.length,1,'the rejected bitmap never becomes a Texture');
    assert(images.every(image=>image.closed===1));assert.equal(images.length,['decode','missing'].includes(failure)?1:2);
  });
});

test('abort during a pending fetch immediately disposes earlier resources and does not read the late response body',async()=>trackDisposal(async released=>{
  const controller=new AbortController(),entered=deferred(),resume=deferred(),images=[];let bodyReads=0;
  const pending=loadGardenGroundTextures({signal:controller.signal,fetcher:async(path)=>{
    if(channelOf(path)!=='normal')return fetcher(path);
    entered.resolve();await resume.promise;return{ok:true,arrayBuffer:async()=>{bodyReads++;return new ArrayBuffer(0);}};
  },decode:async()=>{const image=bitmap();images.push(image);return image;}});
  await entered.promise;controller.abort();assert.equal(images[0].closed,1);assert.equal(released.length,1);
  resume.resolve();await assert.rejects(pending,{name:'AbortError'});assert.equal(bodyReads,0);assert.equal(images[0].closed,1);
}));

test('abort during a pending decode closes earlier owners now and the late bitmap once it arrives',async()=>trackDisposal(async released=>{
  const controller=new AbortController(),entered=deferred(),resume=deferred(),images=[];let calls=0;
  const pending=loadGardenGroundTextures({signal:controller.signal,fetcher,decode:async()=>{
    calls++;if(calls===2){entered.resolve();await resume.promise;}
    const image=bitmap();images.push(image);return image;
  }});
  await entered.promise;controller.abort();assert.equal(images[0].closed,1);assert.equal(released.length,1);
  resume.resolve();await assert.rejects(pending,{name:'AbortError'});assert.equal(images.length,2);assert(images.every(image=>image.closed===1));assert.equal(released.length,1);
}));

test('abort during body delivery retains the original reason and prevents the next decoder call',async()=>{
  const controller=new AbortController(),entered=deferred(),resume=deferred(),reason=new Error('left during body');let decodes=0;
  const pending=loadGardenGroundTextures({signal:controller.signal,fetcher:async()=>({ok:true,arrayBuffer:async()=>{entered.resolve();await resume.promise;return new ArrayBuffer(0);}}),decode:async()=>{decodes++;return bitmap();}});
  await entered.promise;controller.abort(reason);resume.resolve();await assert.rejects(pending,error=>error===reason);assert.equal(decodes,0);
});

test('an external abort after success releases the independent returned owner and manual disposal stays idempotent',async()=>{
  const controller=new AbortController(),images=[],resource=await loadGardenGroundTextures({signal:controller.signal,fetcher,decode:async()=>{const image=bitmap();images.push(image);return image;}});
  const released=[];for(const slot of slots)resource[slot].addEventListener('dispose',()=>released.push(slot));
  controller.abort();assert.equal(resource.disposed,true);assert.equal(released.length,3);assert(images.every(image=>image.closed===1));
  resource.dispose();resource.dispose();assert.equal(released.length,3);assert(images.every(image=>image.closed===1));
});

test('a throwing disposal listener and bitmap close cannot prevent releasing the remaining resources',async()=>{
  const images=[],resource=await loadGardenGroundTextures({fetcher,decode:async()=>{const image=bitmap();images.push(image);return image;}}),released=[];
  resource.map.addEventListener('dispose',()=>{released.push('map');throw new Error('texture listener failed');});
  for(const slot of ['normalMap','roughnessMap'])resource[slot].addEventListener('dispose',()=>released.push(slot));
  images[0].close=function(){this.closed++;throw new Error('bitmap close failed');};
  assert.throws(()=>resource.dispose(),error=>error instanceof AggregateError&&error.errors.length===2);
  assert.equal(resource.disposed,true);assert.equal(resource.cleanupErrors.length,2);assert.equal(released.length,3);assert(images.every(image=>image.closed===1));
  assert.throws(()=>resource.dispose(),AggregateError);assert(images.every(image=>image.closed===1));
});

test('decode failure stays visible when cleanup also throws, with later resources still closed',async()=>{
  const images=[],failure=new Error('late decoder failure');let calls=0;
  await assert.rejects(loadGardenGroundTextures({fetcher,decode:async()=>{
    if(++calls===3)throw failure;
    const image=bitmap();if(calls===1)image.close=function(){this.closed++;throw new Error('first close failed');};images.push(image);return image;
  }}),error=>error instanceof AggregateError&&error.cause===failure&&error.errors.includes(failure)&&error.errors.some(e=>e.message==='first close failed'));
  assert.equal(images.length,2);assert(images.every(image=>image.closed===1));
});

test('actual Three shader chunks default to stock lookup while retaining explicit main for comparison',()=>{
  const material=new THREE.MeshStandardMaterial(),map=new THREE.Texture();
  try{
    applyGardenGroundTextures(material,{map,normalMap:map,roughnessMap:map,source:'fixture'});
    const shader={fragmentShader:['map_fragment','normal_fragment_maps','roughnessmap_fragment'].map(chunk=>`#include <${chunk}>`).join('\n')};
    material.onBeforeCompile(shader);
    for(const slot of ['map','normalMap','roughnessMap'])assert(shader.fragmentShader.includes(`texture2D( ${slot},`));
    assert(!shader.fragmentShader.includes('gardenSample'));assert(!shader.fragmentShader.includes('textureGrad'));
    applyGardenGroundTextures(material,{map,normalMap:map,roughnessMap:map,source:'fixture'},{sampling:'main'});
    const legacy={fragmentShader:['map_fragment','normal_fragment_maps','roughnessmap_fragment'].map(chunk=>`#include <${chunk}>`).join('\n')};material.onBeforeCompile(legacy);
    for(const slot of ['map','normalMap','roughnessMap'])assert(legacy.fragmentShader.includes(`gardenSample( ${slot},`));
    assert(legacy.fragmentShader.includes('textureGrad'));assert(legacy.fragmentShader.includes('dFdx(uv)'));
  }finally{material.dispose();map.dispose();}
});
