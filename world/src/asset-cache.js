import * as THREE from 'three';
import {resourceLoader} from './resource-loader.js';

/** Shared fetch, decode and GPU texture; failed entries remain retryable. */
export function loadPBRTexture(name,channel,options={}){
  const key=`${name}/${channel}`;
  return resourceLoader.load({id:`pbr:${key}`,url:`/textures/${key}.webp`,phase:2},{...options,
    parse:async buffer=>{
      const blob=new Blob([buffer],{type:'image/webp'});
      let image;
      if(typeof createImageBitmap==='function')image=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none'});
      else{
        const url=URL.createObjectURL(blob);
        try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
      }
      const texture=new THREE.Texture(image);texture.flipY=typeof createImageBitmap!=='function';
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
      texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.name=key;texture.needsUpdate=true;return texture;
    },
    dispose:texture=>{texture.image?.close?.();texture.dispose();},
  });
}
