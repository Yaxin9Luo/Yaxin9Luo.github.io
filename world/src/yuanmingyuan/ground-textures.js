import * as THREE from 'three';
import {assetManifest} from '../asset-manifest.js';
import {gardenGround4kMaterial} from './ground-material-4k.js';

// Explicit review baseline only: native R1/R2 showed streaks in this blended
// sampler. It shares one triangular offset field across all material channels;
// the production stock-lookup shader omits this unaccepted function entirely.
const nonRepeatingGround=`
vec2 gardenOffset(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
vec4 gardenSample(sampler2D map,vec2 uv){
  vec2 grid=uv*.25,base=floor(grid),f=fract(grid),a,b,c;
  vec3 w;
  if(f.x+f.y<1.){a=base;b=base+vec2(1,0);c=base+vec2(0,1);w=vec3(1.-f.x-f.y,f.x,f.y);}
  else{a=base+vec2(1,1);b=base+vec2(0,1);c=base+vec2(1,0);w=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);}
  w=w*w*w;w/=w.x+w.y+w.z;
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  return textureGrad(map,uv+gardenOffset(a),dx,dy)*w.x+
    textureGrad(map,uv+gardenOffset(b),dx,dy)*w.y+
    textureGrad(map,uv+gardenOffset(c),dx,dy)*w.z;
}`;

// This owner uses the existing self-hosted CC0 material. It never borrows the
// portfolio's cached GPU textures, so leaving the museum can release everything.
export async function loadGardenGroundTextures({resolution='1k',signal,fetcher=fetch,decode=globalThis.createImageBitmap}={}){
  if(resolution!=='1k'&&resolution!=='4k')throw new Error('Garden earth resolution must be 1k or 4k');
  signal?.throwIfAborted();
  if(typeof decode!=='function')throw new Error('Garden earth bitmap decoder is unavailable');
  const textures=[],bitmaps=new Set(),cleanupErrors=[],controller=new AbortController();let disposed=false;
  const release=()=>{
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);controller.abort(signal?.reason);
    for(const texture of textures.splice(0))try{texture.dispose();}catch(error){cleanupErrors.push(error);}
    for(const bitmap of bitmaps)try{bitmap.close();}catch(error){cleanupErrors.push(error);}bitmaps.clear();
  };
  // Abort listeners must not throw an unhandled event error. Pending loads
  // report cleanup errors with their original failure; returned owners also
  // expose them and throw them from explicit dispose().
  const cancel=()=>release();
  const dispose=()=>{release();if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Garden earth resource cleanup failed');};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const result={},files={};
    for(const [channel,slot] of [['color','map'],['normal','normalMap'],['roughness','roughnessMap']]){
      controller.signal.throwIfAborted();
      const path=resolution==='4k'?gardenGround4kMaterial.files[channel].path:`/textures/meadow/${channel}.webp`;
      const record=resolution==='4k'?gardenGround4kMaterial.files[channel]:{...assetManifest[path],width:1024,height:1024};
      if(!/^[a-f0-9]{64}$/.test(record.sha256??'')||!Number.isInteger(record.bytes)||record.bytes<=0)throw new Error(`Garden earth ${resolution} ${channel} has no verified source identity`);
      const url=record.url||path,response=await fetcher(url,{signal:controller.signal});controller.signal.throwIfAborted();
      if(!response.ok)throw new Error(`Garden earth ${resolution} ${channel} HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();controller.signal.throwIfAborted();
      if(bytes.byteLength!==record.bytes)throw new Error(`Garden earth ${resolution} ${channel} byte length mismatch: ${bytes.byteLength} != ${record.bytes}`);
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      controller.signal.throwIfAborted();
      if(digest!==record.sha256)throw new Error(`Garden earth ${resolution} ${channel} hash mismatch`);
      const bitmap=await decode(new Blob([bytes],{type:'image/webp'}),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      if(controller.signal.aborted){try{bitmap?.close?.();}catch(error){cleanupErrors.push(error);}controller.signal.throwIfAborted();}
      if(bitmap&&typeof bitmap.close==='function')bitmaps.add(bitmap);
      if(!bitmap||typeof bitmap.close!=='function'||bitmap.width!==record.width||bitmap.height!==record.height)
        throw new Error(`Garden earth ${resolution} ${channel} decoded dimensions mismatch: ${bitmap?.width}x${bitmap?.height} != ${record.width}x${record.height}`);
      const texture=new THREE.Texture(bitmap);texture.name=`Museum earth ${channel}`;texture.flipY=false;
      textures.push(texture);
      texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=16;
      // Terrain UVs are world XZ * .08. Respect the source's 15 m coverage;
      // the former 2.5 m repeat produced dense diagonal grain in native views.
      texture.repeat.setScalar(5/6);texture.needsUpdate=true;result[slot]=texture;
      files[channel]=Object.freeze({path,url,sha256:digest,bytes:bytes.byteLength,width:bitmap.width,height:bitmap.height});
    }
    return {...result,dispose,resolution,tileMetres:15,files:Object.freeze(files),
      source:resolution==='4k'?gardenGround4kMaterial.manifestPath:'/textures/manifest.json#materials.meadow',
      get disposed(){return disposed;},get cleanupErrors(){return [...cleanupErrors];}};
  }catch(error){release();if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Garden earth loading and resource cleanup failed',{cause:error});throw error;}
}

// Stock lookup was selected by the five-mode native comparison. Keep the old
// main function and candidates explicit for review; this is not a conclusion
// about derivative-specification compliance or the graphics driver.
export function applyGardenGroundTextures(material,maps,{sampling='stock-lookup'}={}){
  if(!['main','caller-gradients','implicit-blend','stock-lookup','stock-grad'].includes(sampling))throw new Error('Unknown garden earth sampling mode');
  let sampleSource=nonRepeatingGround;
  if(sampling==='caller-gradients')sampleSource=sampleSource
    .replace('gardenSample(sampler2D map,vec2 uv)','gardenSample(sampler2D map,vec2 uv,vec2 dx,vec2 dy)')
    .replace('  vec2 dx=dFdx(uv),dy=dFdy(uv);\n','');
  if(sampling==='implicit-blend')for(const corner of ['a','b','c'])sampleSource=sampleSource
    .replace(`textureGrad(map,uv+gardenOffset(${corner}),dx,dy)`,`texture2D(map,uv+gardenOffset(${corner}))`);
  if(sampling==='stock-lookup'||sampling==='stock-grad')sampleSource='';
  material.map=maps.map;material.normalMap=maps.normalMap;material.roughnessMap=maps.roughnessMap;material.bumpMap=null;
  material.normalScale.set(.42,.42);material.roughness=.98;material.userData.gardenDryRoughness=true;
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=sampleSource+'\n'+shader.fragmentShader;
    for(const [chunk,slot,uv]of [['map_fragment','map','vMapUv'],['normal_fragment_maps','normalMap','vNormalMapUv'],['roughnessmap_fragment','roughnessMap','vRoughnessMapUv']]){
      const lookup=sampling==='stock-lookup'?`texture2D( ${slot}, ${uv} )`:sampling==='stock-grad'?`textureGrad( ${slot}, ${uv}, dFdx(${uv}), dFdy(${uv}) )`:sampling==='caller-gradients'?`gardenSample( ${slot}, ${uv}, dFdx(${uv}), dFdy(${uv}) )`:`gardenSample( ${slot}, ${uv} )`;
      let code=THREE.ShaderChunk[chunk].replaceAll(`texture2D( ${slot}, ${uv} )`,lookup);
      if(chunk==='map_fragment')code=`vec3 gardenBase=diffuseColor.rgb;\n${code}\ndiffuseColor.rgb=mix(gardenBase,diffuseColor.rgb*1.8,.52);`;
      if(chunk==='roughnessmap_fragment'&&material.userData.gardenDryRoughness)code=code.replace('roughnessFactor *= texelRoughness.g;','roughnessFactor *= mix(.9,1.,texelRoughness.g);');
      shader.fragmentShader=shader.fragmentShader.replace(`#include <${chunk}>`,code);
    }
  };
  material.customProgramCacheKey=()=> `yuanming-ground-meadow-r3-${material.userData.gardenDryRoughness?'dry':'source'}-${sampling==='main'?'continuous-offsets':sampling}`;
  material.userData.earthTextureSource=maps.source;material.userData.earthSampling=sampling;material.needsUpdate=true;
}
