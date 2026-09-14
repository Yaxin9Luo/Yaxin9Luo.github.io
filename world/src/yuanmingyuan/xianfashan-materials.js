import * as THREE from 'three';
import {createResourceLoader} from '../resource-loader.js';
import {assetManifest} from '../asset-manifest.js';

export const xianfashanTextureSources=Object.freeze({
  meadow:{provider:'Poly Haven',asset:'aerial_grass_rock',author:'Rob Tuytel',license:'CC0-1.0',source:'https://polyhaven.com/a/aerial_grass_rock',width:1024,height:1024,tileMetres:15,files:{
    color:{path:'/textures/meadow/color.webp',sha256:'4142f57cd397bf7ee1553797d93220ac7f40c2c41d0468f4713a3eedc53f0e4b'},
    normal:{path:'/textures/meadow/normal.webp',sha256:'b390b29f47a873fc7c1915835732f94018cef39f5fd51d551cab578f12bd3a5e'},
    roughness:{path:'/textures/meadow/roughness.webp',sha256:'91eaa64d91cc2dc13417758fc23789c7d9b4577fe47785113e1bc2e9d9a6ce63'},
  }},
  stone:{provider:'Poly Haven',asset:'rock_01',author:'Rob Tuytel',license:'CC0-1.0',source:'https://polyhaven.com/a/rock_01',width:2048,height:2048,tileMetres:.75,interpretation:'Photographed mineral micro-relief used at an authored .75 m repeat; not evidence of the historic stone species. White albedo is an authored restrained mineral colour, not the rock photograph.',files:{
    normal:{path:'/textures/yuanmingyuan-lake-stone/normal.webp',sha256:'1fd3e0ad8e6fdb245fa34e98068e38045db93f6472212b51c6f73cea72474237'},
    roughness:{path:'/textures/yuanmingyuan-lake-stone/roughness.webp',sha256:'5e103cdf05e5611303be895dbd1ea5dd45d9e3aaa5aeefd9d140a80b2859372c'},
  }},
});
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const pixelLoader=createResourceLoader({manifest:assetManifest});
function readBitmap(bitmap){
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(bitmap.width,bitmap.height):document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});if(!context)throw new Error('Xianfashan pixel decoding needs a 2D canvas');
  context.setTransform(1,0,0,-1,0,bitmap.height);context.drawImage(bitmap,0,0);return new Uint8Array(context.getImageData(0,0,bitmap.width,bitmap.height).data);
}
export async function decodeXianfashanTexturePixels(bytes,source,{signal,createBitmap=globalThis.createImageBitmap,readPixels=readBitmap}={}){
  signal?.throwIfAborted();if(await sha(bytes)!==source.sha256)throw new Error(`Xianfashan texture SHA mismatch: ${source.path}`);signal?.throwIfAborted();
  const bitmap=await createBitmap(new Blob([bytes],{type:'image/webp'}),{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  try{
    signal?.throwIfAborted();if(bitmap.width!==source.width||bitmap.height!==source.height)throw new Error(`Xianfashan texture dimensions mismatch: ${source.path}`);
    const data=await readPixels(bitmap);signal?.throwIfAborted();if(!(data instanceof Uint8Array)||data.length!==source.width*source.height*4)throw new Error('Xianfashan decoder must retain all RGBA pixels');
    const decodedSha256=await sha(data);signal?.throwIfAborted();
    return Object.freeze({data,width:source.width,height:source.height,channels:4,origin:'lower-left',encodedSha256:source.sha256,decodedSha256});
  }finally{bitmap.close();}
}
export async function prepareXianfashanTexturePixels({signal}={}){
  const result={};
  // Cache decoded CPU pixels, never a GPU Texture or an open ImageBitmap.
  for(const [name,source] of Object.entries(xianfashanTextureSources)){
    result[name]={};for(const [channel,file] of Object.entries(source.files)){
      signal?.throwIfAborted();result[name][channel]=await pixelLoader.load(file.path,{signal,parse:(bytes,{signal:requestSignal})=>decodeXianfashanTexturePixels(bytes,{...file,width:source.width,height:source.height},{signal:requestSignal})});
    }
    Object.freeze(result[name]);
  }
  signal?.throwIfAborted();return Object.freeze(result);
}
export function validateXianfashanTexturePixels(pixels){
  for(const [name,source] of Object.entries(xianfashanTextureSources))for(const [channel,file] of Object.entries(source.files)){
    const entry=pixels?.[name]?.[channel];
    if(!entry||entry.width!==source.width||entry.height!==source.height||entry.channels!==4||entry.origin!=='lower-left'||!(entry.data instanceof Uint8Array)||entry.data.length!==source.width*source.height*4||entry.encodedSha256!==file.sha256||!/^([a-f0-9]{64})$/.test(entry.decodedSha256))throw new Error(`Xianfashan needs verified full-resolution ${name}/${channel} pixels; await prepareXianfashanTexturePixels()`);
  }
}
export function configureXianfashanMaterials(b,pixels){
  validateXianfashanTexturePixels(pixels);
  const maps={};for(const [name,source] of Object.entries(xianfashanTextureSources)){
    maps[name]={};for(const [channel,entry] of Object.entries(pixels[name])){
      const texture=new THREE.DataTexture(entry.data,entry.width,entry.height,THREE.RGBAFormat);texture.name=`xianfashan-${name}-${channel}`;texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;texture.repeat.setScalar(1/source.tileMetres);texture.needsUpdate=true;
      texture.userData={source:source.source,license:source.license,physicalTileMetres:source.tileMetres,encodedSha256:entry.encodedSha256,decodedSha256:entry.decodedSha256,sharedCPUPixels:true,sharedGPUTexture:false,...(source.interpretation?{interpretation:source.interpretation}:{})};
      b.textures.add(texture);maps[name][channel]=texture;
    }
  }
  Object.assign(b.m.earth,{map:maps.meadow.color,normalMap:maps.meadow.normal,roughnessMap:maps.meadow.roughness,vertexColors:false,roughness:1});b.m.earth.color.set(0xffffff);b.m.earth.normalScale.set(.34,.34);b.m.earth.userData.textureSource=maps.meadow.color.userData;
  for(const [name,colour,strength] of [['stone',0xd9d5ca,.12],['carving',0xe4e0d5,.09],['plaster',0xd5cec0,.045],['paving',0xc3bcad,.17],['recess',0xbeb8aa,.075]]){
    const material=b.m[name];material.color.set(colour);material.normalMap=maps.stone.normal;material.roughnessMap=maps.stone.roughness;material.roughness=1;material.normalScale.set(strength,strength);material.userData.surfaceUV='local-metre dominant-plane projection; .75m mineral-detail repeat';
  }
  b.m.door=new THREE.MeshStandardMaterial({color:0x706456,roughness:.85});b.m.door.name='xianfashan-neutral-panelled-timber';b.m.door.userData={category:'timber',evidence:'engraved-door-panel-structure; colour-authored'};b.materials.add(b.m.door);
  return b;
}

// Only the new hill study calls this. The shared builder and other assets retain
// their geometry/UVs. Each triangle uses a stable dominant plane in local metres.
export function projectXianfashanStoneUVs(b){
  const selected=new Set(['stone','carving','plaster','paving','recess'].map(name=>b.m[name]));
  for(const {material,parts} of b.pending.values())if(selected.has(material))for(const geometry of parts){
    const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i+=3){
      const nx=Math.abs(n.getX(i)+n.getX(i+1)+n.getX(i+2)),ny=Math.abs(n.getY(i)+n.getY(i+1)+n.getY(i+2)),nz=Math.abs(n.getZ(i)+n.getZ(i+1)+n.getZ(i+2));
      for(let j=0;j<3;j++){const at=i+j;if(ny>=nx&&ny>=nz)uv.setXY(at,p.getX(at),-p.getZ(at));else if(nx>=nz)uv.setXY(at,p.getZ(at),p.getY(at));else uv.setXY(at,p.getX(at),p.getY(at));}
    }
  }
}
