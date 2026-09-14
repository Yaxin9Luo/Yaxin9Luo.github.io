import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import {courtLowBroadleafSourceManifest as manifest} from './court-low-broadleaf-manifest.js';
import {decodeSprayGeometries,createLowBroadleaf} from './court-low-broadleaf-geometry.js';

const slots=['map','normalMap','arm','alphaMap'];
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');

/** Load one complete unplaced source, then borrow its three ordinary Meshes.
 * The caller (R3 source bridge) caches this result once per scene. There is no
 * module-global GPU/bitmap cache and no load per placement.
 *
 * The signal cancels preparation only. Success removes its listener and
 * transfers exclusive ownership to the returned owner. Dispose all borrowing
 * instances/colliders before owner.dispose(). No asynchronous work remains
 * after resolve/reject, including an ImageBitmap decode that settles late.
 *
 * fetcher/decode are narrow test seams. Production loads the self-hosted,
 * hash-verified original bytes, retaining the reviewed UV/bitmap orientation.
 */
export async function loadCourtLowBroadleafSource({
  signal,baseUrl=manifest.baseUrl,fetcher=fetchPublicAsset,decode=globalThis.createImageBitmap,
}={}){
  signal?.throwIfAborted();
  if(typeof fetcher!=='function'||typeof decode!=='function')throw new Error('Broadleaf fetch and bitmap decoder are required');
  if(typeof baseUrl!=='string'||!baseUrl.endsWith('/'))throw new Error('Broadleaf baseUrl must end with /');
  const controller=new AbortController(),geometries=[],textures={},bitmaps=new Set(),cleanupErrors=[];
  let preparedDisposed=false,claimed=false,source=null,disposed=false;
  const run=fn=>{try{fn();}catch(error){cleanupErrors.push(error);}};
  const releasePrepared=()=>{
    if(preparedDisposed)return;preparedDisposed=true;
    for(const geometry of geometries.splice(0))run(()=>geometry.dispose());
    for(const texture of Object.values(textures))run(()=>texture.dispose());
    for(const key of Object.keys(textures))delete textures[key];
    for(const bitmap of bitmaps)run(()=>bitmap.close());bitmaps.clear();
  };
  const release=()=>{
    if(disposed)return;disposed=true;
    if(source)run(()=>source.dispose());
    releasePrepared();
  };
  const cancel=()=>{controller.abort(signal.reason);release();};
  const guard=()=>{controller.signal.throwIfAborted();signal?.throwIfAborted();};
  signal?.addEventListener('abort',cancel,{once:true});
  const read=async slot=>{
    guard();const record=manifest.files[slot],url=baseUrl+record.file;
    const response=await fetcher(url,{signal:controller.signal});guard();
    if(!response.ok)throw new Error('Broadleaf '+slot+' HTTP '+response.status);
    const bytes=await response.arrayBuffer();guard();
    if(bytes.byteLength!==record.bytes)throw new Error('Broadleaf '+slot+' byte length mismatch');
    const sha256=await digest(bytes);guard();
    if(sha256!==record.sha256)throw new Error('Broadleaf '+slot+' SHA256 mismatch');
    return {bytes,record,url};
  };
  try{
    const spec=JSON.parse(new TextDecoder().decode((await read('spec')).bytes));
    const buffer=(await read('geometry')).bytes;guard();
    geometries.push(...decodeSprayGeometries(THREE,spec,buffer));
    const files={};
    for(const slot of slots){
      const {bytes,record,url}=await read(slot);
      const bitmap=await decode(new Blob([bytes],{type:record.mimeType}),{
        imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none',
      });
      // The non-cancellable decode must settle before a cancelled load rejects.
      if(controller.signal.aborted||signal?.aborted){
        if(typeof bitmap?.close==='function')run(()=>bitmap.close());
        guard();
      }
      if(typeof bitmap?.close==='function')bitmaps.add(bitmap);
      if(!bitmap||typeof bitmap.close!=='function'||bitmap.width!==4096||bitmap.height!==4096)
        throw new Error('Broadleaf '+slot+' must retain original 4096x4096 pixels');
      const texture=new THREE.Texture(bitmap);textures[slot]=texture;
      texture.name=record.file.split('/').at(-1);texture.flipY=false;
      texture.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
      texture.generateMipmaps=true;texture.needsUpdate=true;
      texture.userData={source:manifest.sourceURL,license:manifest.license,encodedSha256:record.sha256,sharedGpuTexture:false,originalPixels:true};
      files[slot]=Object.freeze({url,sha256:record.sha256,bytes:record.bytes,width:4096,height:4096});
    }
    guard();
    const prepared={spec,geometries,textures,fullResolutionVerified:true,
      get disposed(){return preparedDisposed;},
      claim(){if(preparedDisposed||claimed)throw new Error('Broadleaf prepared source already claimed');claimed=true;},
      dispose:releasePrepared,
    };
    source=createLowBroadleaf({THREE,prepared});
    guard();
    const meshes=source.part.children;
    const triangles=meshes.reduce((sum,m)=>sum+(m.geometry?.index?.count??0)/3,0);
    if(meshes.length!==manifest.meshes||meshes.some(m=>!m.isMesh||m.isInstancedMesh||m.geometry.drawRange.start!==0||m.geometry.drawRange.count!==Infinity)||
      triangles!==manifest.triangles||source.placements.length!==manifest.scanCopies||source.group.parent||
      source.part.userData.id!=='low-broadleaf'||!source.diagnostics.fullResolutionVerified)
      throw new Error('Broadleaf complete source contract failed');
    source.diagnostics={...source.diagnostics,
      admission:'Individual source reviewed for midlayer use; complete composition acceptance pending',
      sourceReview:manifest.review,sourceNativeWholePngSha256:manifest.nativeWholePngSha256,
      nativeCompositionReviewed:false,files:Object.freeze(files),
    };
    const owner={
      id:source.id,group:source.group,part:source.part,parts:source.parts,
      diagnostics:source.diagnostics,rootBand:source.rootBand,
      update:source.update,
      get disposed(){return disposed;},
      get cleanupErrors(){return [...cleanupErrors];},
      dispose(){release();if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Broadleaf source cleanup failed');},
    };
    signal?.removeEventListener('abort',cancel);
    return Object.freeze({part:source.part,owner,review:manifest.review});
  }catch(error){
    controller.abort(error);release();
    if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Broadleaf loading and cleanup failed',{cause:error});
    throw error;
  }finally{
    signal?.removeEventListener('abort',cancel);
  }
}
