import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Texture} from 'three';
import {bindShrubSource} from '../../src/herbarium-community.js';
import {bindHerbariumIvyTextureSet,bindHerbariumBotanicalSource} from '../../src/herbarium-assets.js';
// CPU geometry verification only: exact source accessor bytes/node transforms;
// image decoding is separately tested in herbarium-assets and native review.
export async function decodeGeometryGLB(bytes){
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  delete json.images;delete json.textures;
  for(const m of json.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
  const encoded=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
  const rest=bytes.subarray(20+jsonLength),out=Buffer.alloc(20+padded.length+rest.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);rest.copy(out,20+padded.length);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
export async function prepareHerbariumGeometry(){
  const sourceRoot=new URL('../../public/models/herbarium/didelta-spinosa/',import.meta.url),metadata=JSON.parse(await readFile(new URL('geometry-source.json',sourceRoot),'utf8'));
  bindShrubSource(await decodeGeometryGLB(await readFile(new URL('didelta-spinosa-lod0.glb',sourceRoot))),metadata,Object.fromEntries(['map','normalMap','roughnessMap','alphaMap','translucencyMap'].map(key=>[key,new Texture({width:8192,height:8192})])));
  bindHerbariumIvyTextureSet(Object.fromEntries(['map','normalMap','roughnessMap','alphaMap'].map(key=>[key,new Texture({width:4096,height:4096})])));
  for(const id of ['fern_02','periwinkle_plant','potted_plant_01']){
    const bytes=await readFile(new URL(`../../public/models/herbarium/botanical/${id}.glb`,import.meta.url));bindHerbariumBotanicalSource(id,(await decodeGeometryGLB(bytes)).scene);
  }
}
