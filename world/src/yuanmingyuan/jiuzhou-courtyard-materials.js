import * as THREE from 'three';
import {fetchPublicAsset} from '../public-asset-url.js';

export const jiuzhouCourtyardMapSource = Object.freeze({"asset":"Marble021","provider":"ambientCG","sourceURL":"https://ambientcg.com/view?id=Marble021","license":"CC0-1.0","licenseURL":"https://docs.ambientcg.com/license/","tileMetres":1.5,"scaleEvidence":"Authored 1.5m repeat; provider physical size unavailable","width":4096,"height":4096,"files":{"color":{"path":"/textures/yuanmingyuan/fangwaiguan-material-r4/marble-color.1f2d31717ab6.webp","bytes":12268426,"sha256":"1f2d31717ab6d2825d5716f5ab0beba83b6f4ddc4c298980a62d180e29f7b88f","sourceSHA256":"d4821c594ee289b2d30ca81016d99c67cd75153584d0948079322c6f9b4ec48b","sourceBitDepth":"uchar","uploadBitDepth":8,"sourceDimensionsPreserved":true,"rgba8RoundTripExact":true},"normal":{"path":"/textures/yuanmingyuan/fangwaiguan-material-r4/marble-normal.8a5b84722bbe.webp","bytes":4240454,"sha256":"8a5b84722bbe719c315d9ef77709c93c3d2eea49638e2b3cfea3660bb952adcb","sourceSHA256":"01d481a8e5f6557107958e80972a88cc81f9f345559ff158f29fdf1c316c9ba9","sourceBitDepth":"ushort","uploadBitDepth":8,"sourceDimensionsPreserved":true,"rgba8RoundTripExact":true},"roughness":{"path":"/textures/yuanmingyuan/fangwaiguan-material-r4/marble-roughness.f73bbbfbc58e.webp","bytes":3756210,"sha256":"f73bbbfbc58ea9f0d21317025445351776c7522d557ff55080bd546ad489c4d6","sourceSHA256":"92a0cf43e991ccc02eb7a7c29b9461f6b6f34e8f92478593cbe6952663703d94","sourceBitDepth":"uchar","uploadBitDepth":8,"sourceDimensionsPreserved":true,"rgba8RoundTripExact":true}}});

/** Own three original 4K decoded maps; no global GPU cache is borrowed. */
export async function loadJiuzhouCourtyardMaps({signal,fetcher=fetchPublicAsset,decode=globalThis.createImageBitmap}={}){
  signal?.throwIfAborted();
  if(typeof decode!=='function')throw new Error('A real image decoder is required');
  const lifetime=new AbortController(),textures=[],bitmaps=new Set(),errors=[];
  let disposed=false;
  const release=()=>{
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);lifetime.abort(signal?.reason);
    for(const texture of textures)try{texture.dispose();}catch(error){errors.push(error);}
    for(const bitmap of bitmaps)try{bitmap.close();}catch(error){errors.push(error);}
    bitmaps.clear();
  };
  const abort=()=>release();
  const dispose=()=>{release();if(errors.length)throw new AggregateError([...errors],'Jiuzhou courtyard maps cleanup failed');};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    const maps={},files={};
    for(const role of ['color','normal','roughness']){
      lifetime.signal.throwIfAborted();
      const record=jiuzhouCourtyardMapSource.files[role];
      const response=await fetcher(record.path,{signal:lifetime.signal});lifetime.signal.throwIfAborted();
      if(!response.ok)throw new Error('Jiuzhou courtyard '+role+' HTTP '+response.status);
      const bytes=await response.arrayBuffer();lifetime.signal.throwIfAborted();
      if(bytes.byteLength!==record.bytes)throw new Error('Jiuzhou courtyard '+role+' byte length mismatch');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
      lifetime.signal.throwIfAborted();
      if(digest!==record.sha256)throw new Error('Jiuzhou courtyard '+role+' digest mismatch');
      const bitmap=await decode(new Blob([bytes],{type:'image/webp'}),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      if(disposed){try{bitmap?.close?.();}catch(error){errors.push(error);}lifetime.signal.throwIfAborted();}
      if(bitmap?.close)bitmaps.add(bitmap);
      if(!bitmap||typeof bitmap.close!=='function'||bitmap.width!==4096||bitmap.height!==4096)throw new Error('Jiuzhou courtyard '+role+' is not 4096 square');
      const texture=new THREE.Texture(bitmap);textures.push(texture);
      texture.name='jiuzhou-courtyard-r2-'+role;texture.flipY=false;
      texture.colorSpace=role==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=16;
      // Shader positions are metres; identity repeat prevents a second scale.
      texture.repeat.set(1,1);texture.needsUpdate=true;
      texture.userData={source:jiuzhouCourtyardMapSource.sourceURL,license:jiuzhouCourtyardMapSource.license,role,sha256:digest,resolution:[4096,4096],authoredTileMetres:1.5,normalConvention:'OpenGL +Y'};
      maps[role]=texture;files[role]={path:record.path,sha256:digest,bytes:bytes.byteLength,width:bitmap.width,height:bitmap.height};
    }
    signal?.throwIfAborted();
    return {maps:Object.freeze(maps),files:Object.freeze(files),dispose,get disposed(){return disposed;},get cleanupErrors(){return [...errors];}};
  }catch(error){
    release();
    if(errors.length)throw new AggregateError([error,...errors],'Jiuzhou courtyard map preparation failed',{cause:error});
    throw error;
  }
}
