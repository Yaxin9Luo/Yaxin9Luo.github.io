// Reproducible transmission derivatives. Authoring meshes and full-resolution maps remain intact.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt,textureCompress,resample,dedup} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
import {islandGeometry} from '../src/world.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public');
const output=path.join(publicRoot,'runtime');await fs.mkdir(output,{recursive:true});
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const manifest={},report=[];
async function publish(id,bytes,{phase=2,region='shared',variant='full',dependencies=[],source=id,extension='.glb'}={}){
  const sha=createHash('sha256').update(bytes).digest('hex'),slug=id.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'');
  const name=`${slug}.${sha.slice(0,16)}${extension}`;await fs.writeFile(path.join(output,name),bytes);
  manifest[id]={id,url:`/runtime/${name}`,bytes:bytes.byteLength,sha256:sha,phase,region,variant,dependencies,source};
  return manifest[id];
}
const packing=()=>meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:14,quantizeTexcoord:16,quantizeWeight:16,quantizeColor:12});
for(const [id,source,phase,variant]of[
  ['wizard-core','/models/characters/wizard.glb',1,'core'],
  ['/models/characters/wizard.glb','/models/characters/wizard.glb',2,'full'],
  ['wraith','/models/characters/wraith.glb',3,'full'],
  ...['rock_face_02','rock_moss_set_02'].map(name=>[`${name}-preview`,`/models/environment/scans/${name}.glb`,2,'preview']),
  ...['rock_face_02','rock_moss_set_02'].map(name=>[`/models/environment/scans/${name}.glb`,`/models/environment/scans/${name}.glb`,2,'full']),
]){
  const before=await fs.readFile(path.join(publicRoot,source));const doc=await io.readBinary(before);
  const names=doc.getRoot().listNodes().map(node=>node.getName()).filter(Boolean),clips=doc.getRoot().listAnimations().map(clip=>clip.getName());
  // Do not prune named rig attachments, flatten transforms, simplify geometry or replace normals.
  await doc.transform(dedup({propertyTypes:['Accessor','Texture']}),resample({tolerance:1e-6}));
  if(variant==='core')await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:94,effort:6}));
  if(variant==='preview')await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:96,effort:6}));
  await doc.transform(packing());const binary=await io.writeBinary(doc),asset=await publish(id,binary,{phase,variant,source});
  const check=await io.readBinary(binary);
  for(const name of names)if(!check.getRoot().listNodes().some(node=>node.getName()===name))throw new Error(`Lost node: ${name}`);
  for(const name of clips)if(!check.getRoot().listAnimations().some(clip=>clip.getName()===name))throw new Error(`Lost clip: ${name}`);
  report.push({id,sourceBytes:before.byteLength,bytes:asset.bytes,ratio:asset.bytes/before.byteLength,nodes:names.length,clips,meshSimplification:false,textureResize:variant==='core'?[1024,1024]:variant==='preview'?[2048,2048]:null});console.log(JSON.stringify(report.at(-1)));
}
const terrainStart=performance.now(),terrain=islandGeometry(),doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('Navigation terrain');
for(const key of ['ground','cliffs']){
  const geometry=terrain[key],primitive=doc.createPrimitive();
  for(const [name,attribute]of Object.entries(geometry.attributes)){
    const semantic={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',color:'COLOR_0'}[name];if(!semantic)continue;
    primitive.setAttribute(semantic,doc.createAccessor().setType(`VEC${attribute.itemSize}`).setArray(attribute.array).setBuffer(buffer));
  }
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
  scene.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(primitive)));
}
scene.setExtras({shore:terrain.shore});await doc.transform(packing());
await publish('navigation-terrain',await io.writeBinary(doc),{phase:1,region:'navigation',source:'world/src/world.js'});
report.push({id:'navigation-terrain',bytes:manifest['navigation-terrain'].bytes,offlineGeometryMs:performance.now()-terrainStart,gridSpacing:.5,meshSimplification:false});
async function visit(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await visit(full);else if(/\.(webp|png|jpg|hdr)$/.test(entry.name)){const id='/'+path.relative(publicRoot,full).split(path.sep).join('/');await publish(id,await fs.readFile(full),{phase:id.endsWith('.hdr')?3:2,source:id,extension:path.extname(id)});}}}
await visit(path.join(publicRoot,'textures'));
for(const id of ['/art/academy/cloud-panorama.webp','/art/night-garden/moon-lroc-2k.jpg','/art/night-garden/blossom-atlas.webp'])await publish(id,await fs.readFile(path.join(publicRoot,id)),{source:id,extension:path.extname(id)});
await fs.writeFile(path.join(root,'src/asset-manifest.js'),`// Generated from actual bytes by scripts/prepare-runtime-assets.mjs.\nexport const assetManifest = ${JSON.stringify(manifest,null,2)};\n`);
await fs.writeFile(path.join(root,'../docs/art/experience-v4/transmission-report.json'),JSON.stringify({meshopt:'1.2.0',gltfTransform:'4.5.0',normalBits:14,positionBits:16,assets:report},null,2)+'\n');
console.log(JSON.stringify({assets:Object.keys(manifest).length,coreBytes:manifest['wizard-core'].bytes+manifest['navigation-terrain'].bytes}));
