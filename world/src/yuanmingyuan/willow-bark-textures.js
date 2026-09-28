import {Texture,DataTexture,RedFormat,FloatType,RepeatWrapping,LinearFilter,LinearMipmapLinearFilter,SRGBColorSpace,NoColorSpace} from 'three';
import {assertWillowHeight} from './willow-bark-geometry.js';
import {fetchPublicAsset} from '../public-asset-url.js';

const prefix='/assets/yuanmingyuan/materials/willow-bark-r1/';
export const willowBarkFiles=Object.freeze({
 diffuse:Object.freeze({url:prefix+'bark_willow_diff_4k.png',bytes:88364007,sha256:'007e810e496e1b9d23510f198a7bb448cc5548feb7a997d0c80ec585a361e4f9'}),
 roughness:Object.freeze({url:prefix+'bark_willow_rough_4k.png',bytes:37306459,sha256:'828b177867dedb7507e9d33c5777056fd2e25bee1f730b4d45e2bd9899629d33'}),
 height:Object.freeze({url:prefix+'bark-willow-height-4096.u16le',bytes:33554432,sha256:'2b11ab4032871882435c09f354ee57efeaf785b6dbc103b19d2e6e9fcc3f9cff'}),
});
export function decodeWillowHeight(bytes,width=4096,height=4096){
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength!==width*height*2)throw new Error('Incomplete willow height bytes.');
 const view=new DataView(bytes),data=new Uint16Array(width*height);
 for(let i=0;i<data.length;i++)data[i]=view.getUint16(i*2,true);
 return {data,width,height,rowOrigin:'top-left',normalization:'raw/65535'};
}
export function createWillowBarkMaps({diffuseImage,roughnessImage,height}){
 assertWillowHeight(height);
 if([diffuseImage,roughnessImage].some(image=>image?.width!==height.width||image?.height!==height.height))throw new Error('All willow channels require matching complete image dimensions.');
 const textures=[],images=new Set([diffuseImage,roughnessImage]);let storedHeight=height,disposed=false;
 function configure(texture,name,colorSpace){texture.name=name;texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(1,1);texture.flipY=false;
  texture.colorSpace=colorSpace;texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=16;texture.needsUpdate=true;textures.push(texture);return texture;}
 // Decoded ImageBitmaps are already vertically flipped. Float storage is also
 // bottom-row first; all channels therefore use v=0 at the source image bottom.
 const floatHeight=new Float32Array(height.data.length);
 for(let y=0;y<height.height;y++)for(let x=0;x<height.width;x++)floatHeight[y*height.width+x]=height.data[(height.height-1-y)*height.width+x]/65535;
 const map=configure(new Texture(diffuseImage),'polyhaven-bark-willow-4k-diffuse',SRGBColorSpace);
 const roughnessMap=configure(new Texture(roughnessImage),'polyhaven-bark-willow-4k-roughness',NoColorSpace);
 const bumpMap=configure(new DataTexture(floatHeight,height.width,height.height,RedFormat,FloatType),'polyhaven-bark-willow-4k-height16-as-float',NoColorSpace);
 const owner={map,roughnessMap,bumpMap,get height(){return storedHeight;},get disposed(){return disposed;},
  diagnostics:{source:'https://polyhaven.com/a/bark_willow',license:'CC0-1.0',authors:['Dario Barresi','Dimitrios Savva'],tileMetres:1,
   files:willowBarkFiles,width:height.width,height:height.height,sourcePixelEdits:false,heightGPU:'R32F, original u16/65535; no percentile remap; bottom-row first',normalMapUsed:false},
  dispose(){if(disposed)return;disposed=true;storedHeight=null;const errors=[];
   for(const texture of textures)try{texture.dispose();}catch(e){errors.push(e);}
   for(const image of images)try{image.close?.();}catch(e){errors.push(e);}
   if(errors.length)throw new AggregateError(errors,'Willow bark texture release failed.');
  }};
 return owner;
}
/** Cancellation belongs to loading only. After success the returned owner is
 * explicitly disposed after material borrowers; no retained signal can release
 * its textures ahead of the source's materials. */
export async function loadWillowBarkMaps({signal,fetchImpl=fetchPublicAsset,decodeImage=globalThis.createImageBitmap}={}){
 signal?.throwIfAborted();const controller=new AbortController(),images=[];
 const cancel=()=>controller.abort(signal.reason);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 async function bytes(file){
  const response=await fetchImpl(file.url,{signal:controller.signal});if(!response.ok)throw new Error('Willow bark source HTTP '+response.status);
  const data=await response.arrayBuffer();controller.signal.throwIfAborted();
  if(data.byteLength!==file.bytes)throw new Error('Willow bark source length changed.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==file.sha256)throw new Error('Willow bark source SHA changed.');return data;
 }
 async function image(file){
  const data=await bytes(file);controller.signal.throwIfAborted();
  const decoded=await decodeImage(new Blob([data],{type:'image/png'}),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  images.push(decoded);controller.signal.throwIfAborted();
  if(decoded.width!==4096||decoded.height!==4096)throw new Error('Willow bark original 4K dimensions changed.');
  return decoded;
 }
 const jobs=[()=>image(willowBarkFiles.diffuse),()=>image(willowBarkFiles.roughness),()=>bytes(willowBarkFiles.height)];
 try{
  const settled=await Promise.allSettled(jobs.map(async job=>{try{return await job();}catch(e){controller.abort(e);throw e;}}));
  const failed=settled.find(x=>x.status==='rejected');if(failed)throw failed.reason;controller.signal.throwIfAborted();
  return createWillowBarkMaps({diffuseImage:settled[0].value,roughnessImage:settled[1].value,height:decodeWillowHeight(settled[2].value)});
 }catch(error){
  controller.abort(error);const errors=[];for(const bitmap of images)try{bitmap.close?.();}catch(e){errors.push(e);}
  if(errors.length)throw new AggregateError([error,...errors],'Willow bark load and cleanup failed.',{cause:error});throw error;
 }finally{signal?.removeEventListener('abort',cancel);}
}
