// Export the exact runtime geometry as individually inspectable GLB assets.
// Run: node scripts/art/architecture/export-assets.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../world/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../../world/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import * as factories from '../../../world/src/models.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const destination = path.join(repo, 'world/public/models/architecture');
await fs.mkdir(destination, { recursive: true });
const assets = [];
const modelNames = { castle:'createCastle', library:'createLibrary', observatory:'createObservatory', workshop:'createWorkshop', owlery:'createOwlery', ruins:'createRuins' };

for (const [name, factory] of Object.entries(modelNames)) {
  const group = factories[factory]();
  const materialByName = new Map();
  group.traverse(object => { if (object.isMesh) materialByName.set(object.material.name, object.material); });
  const gltf = await new GLTFExporter().parseAsync(group, { binary: false, onlyVisible: true });
  gltf.images = []; gltf.textures = []; gltf.samplers = [{ magFilter:9729, minFilter:9987, wrapS:10497, wrapT:10497 }];
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed || []), 'EXT_texture_webp'])];
  gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired || []), 'EXT_texture_webp'])];
  const textureIndices = new Map();
  function texture(surface, channel) {
    const key = `${surface}/${channel}`;
    if (textureIndices.has(key)) return textureIndices.get(key);
    const image = gltf.images.length;
    gltf.images.push({ uri:`../../textures/${key}.webp`, mimeType:'image/webp', name:key });
    const index = gltf.textures.length;
    gltf.textures.push({ sampler:0, extensions:{ EXT_texture_webp:{ source:image } }, name:key });
    textureIndices.set(key, index);
    return index;
  }
  for (const material of gltf.materials) {
    const source = materialByName.get(material.name), surface = source?.userData.surface;
    if (!surface) continue;
    material.pbrMetallicRoughness.baseColorTexture = { index:texture(surface,'color') };
    material.normalTexture = { index:texture(surface,'normal'), scale:surface==='oxidized-copper'?.65:surface==='mossy-rock'?.9:surface==='aged-wood'?.55:surface==='slate-roof'?.8:.75 };
    // Roughness images are monochrome: their green channel is glTF-compatible.
    // Copper retains a constant metal/roughness pair in this portable export;
    // the runtime additionally samples its independent metalness map.
    if (surface !== 'oxidized-copper') material.pbrMetallicRoughness.metallicRoughnessTexture = { index:texture(surface,'roughness') };
    material.extras = { ...source.userData, license:'CC0-1.0; see textures/manifest.json' };
  }
  const uri = gltf.buffers[0].uri;
  const binary = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  delete gltf.buffers[0].uri;
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonChunk = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(jsonChunk);
  const binaryChunk = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(binaryChunk);
  const header = Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonChunk.length+8+binaryChunk.length,8);
  const jsonHeader=Buffer.alloc(8);jsonHeader.writeUInt32LE(jsonChunk.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binaryChunk.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const output=Buffer.concat([header,jsonHeader,jsonChunk,binHeader,binaryChunk]);
  await fs.writeFile(path.join(destination, `${name}.glb`),output);
  const bounds=new THREE.Box3().setFromObject(group);
  const triangles=group.children.reduce((sum,mesh)=>sum+mesh.geometry.attributes.position.count/3,0);
  const item={id:name,factory,file:`${name}.glb`,triangles,meshes:group.children.length,bytes:output.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},front:'+Z',units:'metres'};
  assets.push(item);console.log(JSON.stringify(item));
}
await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify({version:3,provenance:'Original procedural architecture; CC0 source surfaces listed in ../../textures/manifest.json',runtime:'world/src/models.js',textures:'External shared WebP PBR images using EXT_texture_webp',assets},null,2)+'\n');
