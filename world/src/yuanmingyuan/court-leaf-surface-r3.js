import * as THREE from 'three';

export const courtLeafSurfaceBaseUrl='/models/yuanmingyuan/court-low-broadleaf-r3/';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const courtLeafSurfaceSource=freeze({
  id:'cgbookcase-bilberry-leaf-01-front-original',
  sourcePage:'https://www.cgbookcase.com/textures/bilberry-leaf-01',
  license:'CC0-1.0',creator:'Dorian Zgraggen / cgbookcase',
  manifestURL:courtLeafSurfaceBaseUrl+'bilberry-original-manifest.json',
  manifestSHA256:'4b481f68a7c8adf249da9900043cd08eee9ecf4a690b85e87d41c71d29555784',
  normalConvention:'directx',
  files:{
  "map": {
    "file": "BilberryLeaf01_2K_front_BaseColor.png",
    "bytes": 2594594,
    "sha256": "bd6fee1075f66214c3b65a913a371107689984d37097db8b01863df0a31e0932",
    "width": 1024,
    "height": 2048,
    "bitDepth": 8,
    "pngColorType": 6
  },
  "normalMap": {
    "file": "BilberryLeaf01_2K_front_Normal.png",
    "bytes": 4179392,
    "sha256": "52350c490f57a82d519259ab6e05422581c8e02ce77920744045dff05ec1f96c",
    "width": 1024,
    "height": 2048,
    "bitDepth": 8,
    "pngColorType": 6
  },
  "roughnessMap": {
    "file": "BilberryLeaf01_2K_front_Roughness.png",
    "bytes": 1751683,
    "sha256": "8e90979a27ee159bd60ffeb903f663b328006938274066dc756052e73b304f42",
    "width": 1024,
    "height": 2048,
    "bitDepth": 8,
    "pngColorType": 6
  }
},
});
const slots=['map','normalMap','roughnessMap'];
const decodeOptions=Object.freeze({imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
const digest=async bytes=>[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');

/** Exclusive front-leaf surface lease. The signal cancels preparation only.
 * Success transfers all three Texture/ImageBitmap owners to the caller; release
 * borrowers/materials before dispose(). No work remains after resolve/reject,
 * including a non-cancellable bitmap decode that settles after cancellation.
 *
 * Bitmap rows are flipped once at decode, so original image top maps to v=1.
 * Texture.flipY stays false. DirectX normal channels remain unchanged; the
 * borrowing R3 material applies normalScale.y=-1. Standard generated mips are
 * intentional baseline sampling, including the original transparent background.
 */
export async function loadCourtLeafSurface({
  signal,baseUrl=courtLeafSurfaceBaseUrl,fetcher=globalThis.fetch,decode=globalThis.createImageBitmap,
}={}){
  signal?.throwIfAborted();
  if(typeof fetcher!=='function'||typeof decode!=='function')throw new Error('Leaf surface fetch and bitmap decoder are required');
  if(typeof baseUrl!=='string'||!baseUrl.endsWith('/'))throw new Error('Leaf surface baseUrl must end with /');
  const controller=new AbortController(),textures={},bitmaps=new Set(),cleanupErrors=[];
  let disposed=false,cleanupError=null;
  const releaseOne=fn=>{try{fn();}catch(error){cleanupErrors.push(error);}};
  function release(){
    if(disposed)return;disposed=true;
    signal?.removeEventListener('abort',cancel);controller.abort();
    for(const texture of Object.values(textures))releaseOne(()=>texture.dispose());
    for(const slot of Object.keys(textures))delete textures[slot];
    for(const bitmap of bitmaps)releaseOne(()=>bitmap.close());bitmaps.clear();
    if(cleanupErrors.length)cleanupError=new AggregateError([...cleanupErrors],'Leaf surface cleanup failed');
  }
  const cancel=()=>{controller.abort(signal.reason);release();};
  const guard=()=>{controller.signal.throwIfAborted();signal?.throwIfAborted();};
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
  try{
    const files={};
    for(const slot of slots){
      guard();const record=courtLeafSurfaceSource.files[slot];
      const url=baseUrl+record.file;
      const response=await fetcher(url,{signal:controller.signal});guard();
      if(!response.ok)throw new Error('Leaf surface '+slot+' HTTP '+response.status);
      const bytes=await response.arrayBuffer();guard();
      if(bytes.byteLength!==record.bytes)throw new Error('Leaf surface '+slot+' byte length mismatch');
      const sha256=await digest(bytes);guard();
      if(sha256!==record.sha256)throw new Error('Leaf surface '+slot+' SHA256 mismatch');
      const bitmap=await decode(new Blob([bytes],{type:'image/png'}),decodeOptions);
      // Cancellation already released earlier owners; retain no late bitmap.
      if(controller.signal.aborted||signal?.aborted){
        if(typeof bitmap?.close==='function')releaseOne(()=>bitmap.close());
        guard();
      }
      if(typeof bitmap?.close==='function')bitmaps.add(bitmap);
      if(!bitmap||typeof bitmap.close!=='function'||bitmap.width!==record.width||bitmap.height!==record.height)
        throw new Error('Leaf surface '+slot+' must retain original '+record.width+'x'+record.height+' pixels');
      const texture=new THREE.Texture(bitmap);textures[slot]=texture;
      texture.name=record.file;texture.flipY=false;texture.premultiplyAlpha=false;
      texture.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
      texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
      texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
      texture.generateMipmaps=true;texture.anisotropy=16;
      texture.userData={sourcePage:courtLeafSurfaceSource.sourcePage,license:courtLeafSurfaceSource.license,
        encodedSHA256:sha256,encodedBytes:bytes.byteLength,normalConvention:'directx',
        effectiveImageTopV:1,encodedFileUnmodified:true,exclusiveSurfaceLease:true};
      texture.needsUpdate=true;
      files[slot]={url,sha256,bytes:bytes.byteLength,width:bitmap.width,height:bitmap.height,bitDepth:8,pngColorType:6};
    }
    guard();
    const diagnostics=freeze({
      id:courtLeafSurfaceSource.id,sourcePage:courtLeafSurfaceSource.sourcePage,license:courtLeafSurfaceSource.license,
      manifestURL:baseUrl+'bilberry-original-manifest.json',manifestSHA256:courtLeafSurfaceSource.manifestSHA256,files,
      normalConvention:'directx',requiredMaterialNormalScaleYSign:-1,
      decodeOptions,textureFlipY:false,effectiveImageTopV:1,sourcePixelFormat:'RGBA8',
      encodedFilesUnmodified:true,decodedOriginalDimensionsVerified:true,
      colorSpaces:{map:THREE.SRGBColorSpace,normalMap:THREE.NoColorSpace,roughnessMap:THREE.NoColorSpace},
      minFilter:'LinearMipmapLinearFilter',magFilter:'LinearFilter',generateMipmaps:true,anisotropy:16,
      wrapS:'ClampToEdgeWrapping',wrapT:'ClampToEdgeWrapping',
      mipPolicy:'standard-generated-from-original-pixels',customMips:false,sourceColorEdits:false,
      nativeVerified:false,historicallySurveyed:false,
    });
    const lease={...textures,normalConvention:'directx',diagnostics,
      get disposed(){return disposed;},get cleanupErrors(){return [...cleanupErrors];},
      dispose(){release();if(cleanupError)throw cleanupError;}};
    signal?.removeEventListener('abort',cancel);
    return Object.freeze(lease);
  }catch(error){
    controller.abort(error);release();
    if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Leaf surface loading and cleanup failed',{cause:error});
    throw error;
  }finally{
    signal?.removeEventListener('abort',cancel);
  }
}
