import * as THREE from 'three';
import {courtSoilManifestR1} from './court-soil-manifest-r1.js';

const slots=['map','normalMap','roughnessMap','aoMap'];
export const courtSoilMaterialSettings=Object.freeze({normalScale:.5,roughness:1,aoMapIntensity:.3,anisotropy:16});

/** An exclusive material lease for the optional court-garden soil factory.
 * Original full-size provider pixels are loaded from the self-hosted package.
 * Court top UVs are metres in (x,-z), so repeat follows the measured source tile.
 * This does not displace the validated floor or plant roots.
 */
export async function loadCourtSoilMaterial({signal,manifest=courtSoilManifestR1,baseUrl='/textures/yuanmingyuan/court-soil-r1/',fetcher=globalThis.fetch,decode=globalThis.createImageBitmap,anisotropy=16}={}){
  signal?.throwIfAborted();
  if(typeof fetcher!=='function'||typeof decode!=='function')throw new Error('Court soil fetch and bitmap decoder are required');
  if(typeof baseUrl!=='string'||!baseUrl.endsWith('/')||!Number.isFinite(anisotropy)||anisotropy<1||!Number.isFinite(manifest?.tileMetres)||manifest.tileMetres<=0)throw new Error('Invalid court soil texture configuration');
  for(const slot of slots){
    const r=manifest.files?.[slot];
    if(!r||!/^[-a-zA-Z0-9_.]+\.png$/.test(r.file)||!Number.isInteger(r.bytes)||r.bytes<1||!Number.isInteger(r.width)||!Number.isInteger(r.height)||r.width<1||r.height<1||!(/^[a-f0-9]{64}$/.test(r.sha256)))throw new Error('Invalid frozen court soil file: '+slot);
  }
  const controller=new AbortController(),textures=[],bitmaps=new Set(),cleanupErrors=[];
  let disposed=false,material=null;
  const release=()=>{
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);controller.abort(signal?.reason);
    const run=fn=>{try{fn();}catch(error){cleanupErrors.push(error);}};
    if(material)run(()=>material.dispose());
    for(const texture of textures.splice(0))run(()=>texture.dispose());
    for(const bitmap of bitmaps)run(()=>bitmap.close());bitmaps.clear();
  };
  const cancel=()=>release();
  const dispose=()=>{release();if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Court soil resource cleanup failed');};
  const guard=()=>{controller.signal.throwIfAborted();signal?.throwIfAborted();};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const maps={},files={};
    for(const slot of slots){
      guard();const record=manifest.files[slot],url=baseUrl+record.file;
      const response=await fetcher(url,{signal:controller.signal});guard();
      if(!response.ok)throw new Error('Court soil '+slot+' HTTP '+response.status);
      const bytes=await response.arrayBuffer();guard();
      if(bytes.byteLength!==record.bytes)throw new Error('Court soil '+slot+' byte length mismatch');
      const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');guard();
      if(sha256!==record.sha256)throw new Error('Court soil '+slot+' SHA256 mismatch');
      const bitmap=await decode(new Blob([bytes],{type:'image/png'}),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      if(bitmap&&typeof bitmap.close==='function')bitmaps.add(bitmap);
      // A decode can resolve after abort already released prior resources.
      if(controller.signal.aborted||signal?.aborted){
        if(bitmaps.delete(bitmap))try{bitmap.close();}catch(error){cleanupErrors.push(error);}
        guard();
      }
      if(!bitmap||typeof bitmap.close!=='function'||bitmap.width!==record.width||bitmap.height!==record.height)throw new Error('Court soil '+slot+' decoded dimensions mismatch');
      const texture=new THREE.Texture(bitmap);textures.push(texture);texture.name=manifest.id+'-'+slot;
      texture.flipY=false;texture.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.setScalar(1/manifest.tileMetres);
      texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=anisotropy;texture.needsUpdate=true;
      maps[slot]=texture;files[slot]=Object.freeze({url,sha256,bytes:bytes.byteLength,width:bitmap.width,height:bitmap.height});
    }
    guard();
    material=new THREE.MeshStandardMaterial({name:manifest.id,color:0xffffff,metalness:0,roughness:courtSoilMaterialSettings.roughness,normalScale:new THREE.Vector2(courtSoilMaterialSettings.normalScale,courtSoilMaterialSettings.normalScale),aoMapIntensity:courtSoilMaterialSettings.aoMapIntensity,...maps});
    material.userData={body:'court-soil-surface',source:manifest.sourceURL,license:manifest.license,evidence:'contemporary-exhibition-design',historicallySurveyed:false};
    const diagnostics=Object.freeze({id:manifest.id,files:Object.freeze(files),tileMetres:manifest.tileMetres,normalConvention:'OpenGL +Y',uvMetres:true,heightDisplacement:0,sourcePixelsChanged:false,settings:{...courtSoilMaterialSettings,anisotropy},nativeReviewed:false});
    return {material,diagnostics,dispose,get disposed(){return disposed;},get cleanupErrors(){return [...cleanupErrors];}};
  }catch(error){release();if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Court soil loading and cleanup failed',{cause:error});throw error;}
}
