import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../../../world/package.json',import.meta.url));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression,EXTTextureWebP}=require('@gltf-transform/extensions'),{MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer'),sharp=require('sharp');
const hash=data=>createHash('sha256').update(data).digest('hex');
const arrayHash=array=>hash(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
async function pixels(bytes){const {data,info}=await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {sha256:hash(data),width:info.width,height:info.height};}
function geometryIdentity(document){return document.getRoot().listMeshes().map(mesh=>({name:mesh.getName(),primitives:mesh.listPrimitives().map(primitive=>{
  const attributes=Object.fromEntries(primitive.listSemantics().map(name=>{const a=primitive.getAttribute(name);return [name,{type:a.getComponentType(),normalized:a.getNormalized(),count:a.getCount(),sha256:arrayHash(a.getArray())}];}));
  const array=primitive.getIndices()?.getArray();let triangles=null;if(array){const canonical=new Uint32Array(array.length);for(let i=0;i<array.length;i+=3){const t=[array[i],array[i+1],array[i+2]],start=t.indexOf(Math.min(...t));for(let j=0;j<3;j++)canonical[i+j]=t[(start+j)%3];}triangles={count:array.length/3,cyclicWindingSHA256:arrayHash(canonical)};}
  return {attributes,triangles};
})}));}
/** Meshopt entropy coding with no quantize/filter/reorder/simplify transform. Every decoded attribute byte and ordered triangle is checked. */
export async function createLosslessPacker(sourcePaths){
  await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder}),sourcePixels=new Map(),encodedPixels=new Map();
  for(const path of sourcePaths){const document=await io.read(path);for(const texture of document.getRoot().listTextures()){const bytes=texture.getImage(),identity=await pixels(bytes);sourcePixels.set(identity.sha256,{bytes,mimeType:texture.getMimeType(),...identity});}}
  return async raw=>{
    const document=await io.readBinary(new Uint8Array(raw)),before=geometryIdentity(document),imageBefore=[],reused=[];
    for(const texture of document.getRoot().listTextures()){const identity=await pixels(texture.getImage());imageBefore.push(identity);const source=sourcePixels.get(identity.sha256);if(source&&source.bytes.length<texture.getImage().length){texture.setImage(source.bytes).setMimeType(source.mimeType);reused.push({name:texture.getName(),sha256:source.sha256,mimeType:source.mimeType});}if(!encodedPixels.has(identity.sha256)){const webp=await sharp(Buffer.from(texture.getImage())).webp({lossless:true,exact:true,effort:6}).toBuffer();const decoded=await pixels(webp);if(decoded.sha256!==identity.sha256)throw new Error('Lossless WebP changed RGBA pixels');encodedPixels.set(identity.sha256,webp);}const webp=encodedPixels.get(identity.sha256);if(webp.length<texture.getImage().length){texture.setImage(webp).setMimeType('image/webp');document.createExtension(EXTTextureWebP).setRequired(true);}}
    const authoringBytes=await io.writeBinary(document);
    // The extension's QUANTIZE mode means filter NONE; quantization itself is a separate transform and is deliberately never invoked.
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
    const bytes=await io.writeBinary(document),decoded=await io.readBinary(bytes),after=geometryIdentity(decoded),imageAfter=await Promise.all(decoded.getRoot().listTextures().map(t=>pixels(t.getImage())));
    if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Lossless packing changed geometry attribute bytes or ordered triangle winding.');
    if(JSON.stringify(imageBefore)!==JSON.stringify(imageAfter))throw new Error('Lossless packing changed decoded texture pixels or dimensions.');
    return {bytes,authoringBytes,verification:{method:'Meshopt entropy coding, filter NONE; no quantization, reordering, simplification or resizing. Original source bytes or lossless WebP exact=true reused only after exact decoded RGBA SHA match, including transparent pixels.',rawBytes:raw.length,packedBytes:bytes.length,geometry:before,textures:imageBefore,originalImageBytesReused:reused}};
  };
}
