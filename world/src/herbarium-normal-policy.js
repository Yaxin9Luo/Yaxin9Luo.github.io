import {HalfFloatType,RGBA_ASTC_4x4_Format} from 'three';
import {acceptedShrubNormalDerivative} from './herbarium-normal-derivative.js';

export function shrubNormalEncoding(encoding='exr'){
  if(!['exr','astc-hdr'].includes(encoding))throw new RangeError('Unknown shrub normal encoding');
  return encoding;
}
export function throwIfShrubRequestCancelled(signal){
  if(signal?.aborted)throw Object.assign(new Error('Shrub source request cancelled',{cause:signal.reason}),{type:'cancelled'});
}

/** Inspect the renderer which owns the scene, never browser/model heuristics. */
export function shrubNormalCapabilities(renderer){
  const extension=renderer.extensions.has('WEBGL_compressed_texture_astc')?renderer.extensions.get('WEBGL_compressed_texture_astc'):null;
  return {astcProfiles:extension?Array.from(extension.getSupportedProfiles()):[],maxTextureSize:renderer.capabilities.maxTextureSize};
}
export function selectShrubNormalEncoding(renderer){
  const capabilities=shrubNormalCapabilities(renderer);
  return {...capabilities,encoding:capabilities.astcProfiles.includes('hdr')&&capabilities.maxTextureSize>=8192?'astc-hdr':'exr'};
}
export function canRestoreShrubNormal(renderer,encoding){
  shrubNormalEncoding(encoding);const capabilities=shrubNormalCapabilities(renderer);
  return capabilities.maxTextureSize>=8192&&(encoding==='exr'||capabilities.astcProfiles.includes('hdr'));
}

/** A separate id AND URL bind the completed resource cache to this derivative.
 * Missing/corrupt selected HDR must fail through the existing loader, not EXR. */
export function shrubNormalDescriptor(encoding,derivative=acceptedShrubNormalDerivative){
  shrubNormalEncoding(encoding);
  if(encoding==='exr')return {id:'herbarium-didelta-normalMap',url:'/models/herbarium/didelta-spinosa/textures/didelta_spinosa_nor_gl_8k.exr',phase:2,sourceSHA256:'67d8f96aba14560667ff6ad7058fb75b8f452a0dfd4792dff2f0961d8c632261'};
  const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),path=value=>typeof value==='string'&&/^\/models\/herbarium\/didelta-spinosa\/[-a-zA-Z0-9_./]+$/.test(value)&&!value.includes('..');
  if(!derivative||!path(derivative.url)||!derivative.url.endsWith('.ktx2')||!Number.isSafeInteger(derivative.bytes)||derivative.bytes<=0||!sha(derivative.sha256)||derivative.sourceSHA256!=='67d8f96aba14560667ff6ad7058fb75b8f452a0dfd4792dff2f0961d8c632261'||!path(derivative.recipeURL)||!sha(derivative.recipeSHA256)||!path(derivative.acceptanceURL)||!sha(derivative.acceptanceSHA256))throw new Error('Accepted HDR derivative URL, bytes, SHA and portable recipe/art evidence are unresolved');
  return {id:`herbarium-didelta-normalMap-astc-hdr-${derivative.sha256}`,url:derivative.url,phase:2,sourceSHA256:derivative.sourceSHA256,derivative:{...derivative}};
}

/** Leases cover pending aggregate requests; resourceLoader still owns each
 * caller's independently abortable resource promises and shared cache entries. */
export function createShrubEncodingGate(){
  let bound=null;const pending=new Set();
  const assert=encoding=>{
    shrubNormalEncoding(encoding);const existing=bound||pending.values().next().value?.encoding;
    if(existing&&existing!==encoding)throw new Error(`Shrub source is ${existing}; cannot bind or load ${encoding} in this source lifetime. Reload for a new renderer choice.`);
  };
  return {
    assert,
    commit(encoding){assert(encoding);bound=encoding;},
    acquire(encoding,{signal}={}){
      throwIfShrubRequestCancelled(signal);assert(encoding);
      const lease={encoding};let released=false;
      const release=()=>{if(released)return;released=true;pending.delete(lease);signal?.removeEventListener('abort',release);};
      pending.add(lease);signal?.addEventListener('abort',release,{once:true});
      return {release};
    },
    snapshot(){return {encoding:bound||pending.values().next().value?.encoding||null,status:bound?'bound':pending.size?'pending':'unselected',pendingConsumers:pending.size};},
  };
}

/** Main-thread check after transfer. Production calls the fixed 8192/14
 * contract; explicit small extents are only useful to test the same validator. */
export function validateShrubHDRResult(result,{width=8192,height=8192,levels=14}={}){
  if(![width,height,levels].every(Number.isSafeInteger)||width<1||height<1||levels!==Math.floor(Math.log2(Math.max(width,height)))+1)throw new Error('Invalid complete HDR result extent contract');
  if(!result||result.width!==width||result.height!==height||result.format!==RGBA_ASTC_4x4_Format||result.type!==HalfFloatType||!Array.isArray(result.mipmaps)||result.mipmaps.length!==levels||result.data!==undefined)throw new Error('Invalid full-resolution shrub HDR worker result');
  const buffers=new Set();
  for(let i=0;i<levels;i++){
    const mip=result.mipmaps[i],w=Math.max(1,Math.floor(width/2**i)),h=Math.max(1,Math.floor(height/2**i)),bytes=Math.ceil(w/4)*Math.ceil(h/4)*16;
    if(!mip||mip.width!==w||mip.height!==h||!(mip.data instanceof Uint8Array)||!(mip.data.buffer instanceof ArrayBuffer)||mip.data.byteOffset!==0||mip.data.byteLength!==bytes||mip.data.buffer.byteLength!==bytes||buffers.has(mip.data.buffer))throw new Error(`Invalid shrub HDR transferred mip ${i}`);
    buffers.add(mip.data.buffer);
  }
  return result;
}
