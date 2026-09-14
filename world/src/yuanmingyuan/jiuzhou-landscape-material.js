import {fetchPublicAsset} from '../public-asset-url.js';
import {MeshStandardMaterial,Vector2,Vector4,Texture,SRGBColorSpace,NoColorSpace,RepeatWrapping,LinearFilter,LinearMipmapLinearFilter,ShaderChunk} from 'three';
import {loadGardenGroundTextures} from './ground-textures.js';
import {jiuzhouGravelManifest} from './jiuzhou-landscape-manifest.js';

export async function loadJiuzhouGravelTextures({signal,fetcher=fetchPublicAsset,decode=globalThis.createImageBitmap,manifest=jiuzhouGravelManifest}={}){
  signal?.throwIfAborted();
  if(typeof fetcher!=='function'||typeof decode!=='function')throw new Error('Jiuzhou gravel needs a real fetch and image decoder.');
  const textures=[],bitmaps=new Set(),errors=[],lifetime=new AbortController();let disposed=false;
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);lifetime.abort(signal?.reason);
    for(const texture of textures)try{texture.dispose();}catch(error){errors.push(error);}
    for(const bitmap of bitmaps)try{bitmap.close();}catch(error){errors.push(error);}bitmaps.clear();
    if(errors.length)throw new AggregateError(errors,'Jiuzhou gravel cleanup failed.');
  }
  const abort=()=>{try{dispose();}catch{/* retained in errors */}};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    const result={};
    for(const slot of ['map','normalMap','roughnessMap']){
      const r=manifest.files[slot];
      if(!r||!r.url||!Number.isInteger(r.bytes)||r.bytes<=0||r.width!==4096||r.height!==4096||!/^[0-9a-f]{64}$/.test(r.sha256))throw new Error('Jiuzhou gravel manifest is not frozen 4K: '+slot);
      const response=await fetcher(r.url,{signal:lifetime.signal});lifetime.signal.throwIfAborted();
      if(!response.ok)throw new Error('Jiuzhou gravel HTTP '+response.status);
      const bytes=await response.arrayBuffer();lifetime.signal.throwIfAborted();
      if(bytes.byteLength!==r.bytes)throw new Error('Jiuzhou gravel byte length mismatch.');
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');lifetime.signal.throwIfAborted();
      if(hash!==r.sha256)throw new Error('Jiuzhou gravel SHA256 mismatch.');
      const bitmap=await decode(new Blob([bytes],{type:'image/png'}),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      if(bitmap&&typeof bitmap.close==='function')bitmaps.add(bitmap);
      if(lifetime.signal.aborted){
        if(bitmaps.delete(bitmap))try{bitmap.close();}catch(error){errors.push(error);}
        lifetime.signal.throwIfAborted();
      }
      if(!bitmap||typeof bitmap.close!=='function'||bitmap.width!==4096||bitmap.height!==4096)throw new Error('Jiuzhou gravel decoded dimensions mismatch.');
      const texture=new Texture(bitmap);textures.push(texture);texture.name='jiuzhou-gravel-'+slot;texture.flipY=false;texture.colorSpace=slot==='map'?SRGBColorSpace:NoColorSpace;
      texture.wrapS=texture.wrapT=RepeatWrapping;texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;texture.anisotropy=16;texture.needsUpdate=true;result[slot]=texture;
    }
    return {...result,manifest,dispose,get disposed(){return disposed;}};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Jiuzhou gravel preparation and cleanup failed.');}if(errors.length)throw new AggregateError([error,...errors],'Jiuzhou gravel preparation failed.');throw error;}
}
export const loadJiuzhouMeadowTextures=options=>loadGardenGroundTextures({...options,resolution:'4k'});

function replaceOnce(text,from,to){
  if(text.split(from).length!==2)throw new Error('Jiuzhou material shader boundary changed: '+from);
  return text.replace(from,to);
}
export function createJiuzhouLandscapeMaterial({gravel,meadow,field}){
  if(gravel.disposed||meadow.disposed||!field.texture?.isDataTexture)throw new Error('Jiuzhou landscape textures are unavailable.');
  for(const owner of [gravel,meadow])for(const slot of ['map','normalMap','roughnessMap'])if(!owner[slot]?.isTexture||owner[slot].image?.width!==4096||owner[slot].image?.height!==4096)throw new Error('Jiuzhou landscape retains all six actual 4K maps.');
  const material=new MeshStandardMaterial({name:'jiuzhou-mineral-ground-r1',color:0xffffff,metalness:0,roughness:1,normalScale:new Vector2(.40,.40),map:gravel.map,normalMap:gravel.normalMap,roughnessMap:gravel.roughnessMap});
  material.userData={body:'jiuzhou-contemporary-ground-treatment',historicallySurveyed:false,sourcePixelsChanged:false,heightDisplacement:0,shaderId:'jiuzhou-mineral-ground-r1',mapSizes:[4096,4096],sampling:'stock-lookup-in-local-metres',provider:gravel.manifest};
  material.onBeforeCompile=shader=>{
    shader.uniforms.jyGrassMap={value:meadow.map};shader.uniforms.jyGrassNormal={value:meadow.normalMap};shader.uniforms.jyGrassRoughness={value:meadow.roughnessMap};shader.uniforms.jyField={value:field.texture};
    const d=field.diagnostics;
    shader.uniforms.jyFieldRect={value:new Vector4(d.min[0],d.min[1],d.max[0]-d.min[0],d.max[1]-d.min[1])};
    shader.vertexShader='varying vec2 jyLocalXZ;\nvarying float jyLocalUp;\n'+shader.vertexShader;
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\njyLocalXZ=position.xz;\njyLocalUp=normal.y;');
    shader.fragmentShader='varying vec2 jyLocalXZ;\nvarying float jyLocalUp;\nuniform sampler2D jyGrassMap;\nuniform sampler2D jyGrassNormal;\nuniform sampler2D jyGrassRoughness;\nuniform sampler2D jyField;\nuniform vec4 jyFieldRect;\n'+shader.fragmentShader;
    const mapCode=[
      // Original cap UV is exactly (x,-z); extrusion walls retain their own
      // nondegenerate UV. Use the same basis as Three's normal-map TBN.
      'vec2 jyGravelUV=vNormalMapUv/2.5;',
      'vec2 jyGrassUV=vNormalMapUv/15.;',
      'vec3 jyFieldSample=texture2D(jyField,(jyLocalXZ-jyFieldRect.xy)/jyFieldRect.zw).rgb;',
      'float jyGrass=jyFieldSample.r*smoothstep(.8,.99,jyLocalUp);',
      'vec3 jyStoneColour=texture2D(map,jyGravelUV).rgb;',
      'vec3 jyGrassColour=texture2D(jyGrassMap,jyGrassUV).rgb;',
      'float jyGrassLuma=dot(jyGrassColour,vec3(.2126,.7152,.0722));',
      'jyGrassColour=mix(vec3(jyGrassLuma),jyGrassColour,.82);',
      'diffuseColor.rgb*=mix(jyStoneColour,jyGrassColour,jyGrass)*(.9+.2*jyFieldSample.b)*(1.-.1*jyFieldSample.g);',
    ].join('\n');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>',mapCode);
    let normal=replaceOnce(ShaderChunk.normal_fragment_maps,'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0','vec3 mapN = mix(texture2D(normalMap,jyGravelUV).xyz,texture2D(jyGrassNormal,jyGrassUV).xyz,jyGrass)*2.0-1.0');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <normal_fragment_maps>',normal);
    const rough='float roughnessFactor=roughness*mix(.88,1.,mix(texture2D(roughnessMap,jyGravelUV).g,texture2D(jyGrassRoughness,jyGrassUV).g,jyGrass));';
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>',rough);
  };
  material.customProgramCacheKey=()=> 'jiuzhou-mineral-ground-r2-six-4k-maps-source-uv-metres';
  return material;
}
