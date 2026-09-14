import {decodeShrubTextureData} from './herbarium-texture-data.js';

self.onmessage=async({data:{key,buffer,normalEncoding='exr'}})=>{
  try{
    let result,transfers;
    if(normalEncoding==='astc-hdr'){
      if(key!=='normalMap')throw new Error('HDR encoding is only valid for the normal map');
      const {decodeHerbariumHDRTextureData}=await import('./herbarium-hdr-texture-data.js');
      result=await decodeHerbariumHDRTextureData(buffer,{width:8192,height:8192,levels:14});
      transfers=result.mipmaps.map(mip=>mip.data.buffer);
      if(new Set(transfers).size!==14)throw new Error('HDR mip transfer buffers are not unique');
    }else{
      if(normalEncoding!=='exr')throw new Error('Unknown shrub normal encoding');
      result=decodeShrubTextureData(key,buffer);transfers=[result.data.buffer];
    }
    self.postMessage({result},transfers);
  }catch(error){self.postMessage({error:error.message||'Shrub texture decode failed'});}
};
