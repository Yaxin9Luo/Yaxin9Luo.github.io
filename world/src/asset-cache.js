import * as THREE from 'three';
const textures=new Map();
/** One decoded texture and one GPU allocation per shared local PBR channel. */
export function loadPBRTexture(name,channel){
  const key=`${name}/${channel}`;
  if(!textures.has(key)){
    const pending=new THREE.TextureLoader().loadAsync(`/textures/${key}.webp`).then(texture=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
      texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.name=key;return texture;
    }).catch(error=>{textures.delete(key);throw error;});textures.set(key,pending);
  }
  return textures.get(key);
}
