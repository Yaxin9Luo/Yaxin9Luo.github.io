// Exact botanical derivatives: no simplification, leaf removal, material bake or texture replacement.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {reorder,quantize} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import {createGroveTreeSource} from '../src/grove-foliage.js';

export const BOTANICAL_FAMILIES=[
  {kind:'pine',seed:168,region:'landscape',levels:['near','mid','far']},
  {kind:'silver',seed:499,region:'landscape',levels:['near','mid','far']},
  {kind:'cherry',seed:830,region:'landscape',levels:['near','mid','far'],defaultLoad:false},
  {kind:'cherry',seed:881,region:'cherry-walk',levels:['near','mid','far']},
  {kind:'lilac',seed:910,region:'lilac-walk',levels:['near','mid','far']},
  {kind:'silver',seed:154,region:'gardens',levels:['near']},
  {kind:'cherry',seed:154,region:'gardens',levels:['near']},
  {kind:'cherry',seed:221,region:'studio',levels:['near'],defaultLoad:false},
  {kind:'lilac',seed:221,region:'studio',levels:['near'],defaultLoad:false},
];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const semantics={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',color:'COLOR_0'};
const sha=data=>createHash('sha256').update(data).digest('hex');
const bytesOf=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
const bounds=geometry=>{geometry.computeBoundingBox();return {min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()};};
function topologyHash(indices){
  // Triangle cyclic rotations introduced by index compression preserve winding and topology.
  const canonical=new Uint32Array(indices.length);
  for(let i=0;i<indices.length;i+=3){let offset=0;if(indices[i+1]<indices[i])offset=1;if(indices[i+2]<indices[i+offset])offset=2;for(let j=0;j<3;j++)canonical[i+j]=indices[i+(j+offset)%3];}
  return sha(bytesOf(canonical));
}
function snapshotPrimitive(primitive){
  return {indices:primitive.getIndices().getArray().slice(),attributes:Object.fromEntries(Object.values(semantics).map(name=>[name,primitive.getAttribute(name).getArray().slice()]))};
}
function comparePrimitive(primitive,node,reference,source){
  const indices=primitive.getIndices().getArray();
  if(indices.length!==reference.indices.length||topologyHash(indices)!==topologyHash(reference.indices))throw new Error('Botanical triangle topology changed');
  const transform=new THREE.Matrix4().fromArray(node.getWorldMatrix()),normalTransform=new THREE.Matrix3().getNormalMatrix(transform),vertex=new THREE.Vector3(),components=[];
  const errors={},actualBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const semantic of Object.values(semantics)){
    const accessor=primitive.getAttribute(semantic),expected=reference.attributes[semantic],size=accessor.getElementSize();
    if(accessor.getCount()*size!==expected.length)throw new Error(`Botanical vertex/attribute count changed: ${semantic}`);
    let max=0,sum=0;
    for(let i=0;i<accessor.getCount();i++){
      accessor.getElement(i,components);
      if(semantic==='POSITION'){vertex.fromArray(components).applyMatrix4(transform).toArray(components);for(let j=0;j<3;j++){actualBounds.min[j]=Math.min(actualBounds.min[j],components[j]);actualBounds.max[j]=Math.max(actualBounds.max[j],components[j]);}}
      if(semantic==='NORMAL')vertex.fromArray(components).applyNormalMatrix(normalTransform).toArray(components);
      for(let j=0;j<size;j++){const error=Math.abs(components[j]-expected[i*size+j]);max=Math.max(max,error);sum+=error*error;}
    }
    errors[semantic]={maxAbs:max,rms:Math.sqrt(sum/expected.length)};
  }
  const sourceBounds=bounds(source),boundsMaxAbs=Math.max(...['min','max'].flatMap(side=>actualBounds[side].map((value,i)=>Math.abs(value-sourceBounds[side][i]))));
  if(errors.POSITION.maxAbs>.0003||errors.NORMAL.maxAbs>.0002||errors.COLOR_0.maxAbs>.000016||errors.TEXCOORD_0.maxAbs>.000016)throw new Error(`Botanical quantization exceeded budget: ${JSON.stringify(errors)}`);
  return {triangles:indices.length/3,vertices:primitive.getAttribute('POSITION').getCount(),topologySHA256:topologyHash(indices),bounds:actualBounds,sourceBounds,boundsMaxAbs,errors};
}

export async function prepareBotanicalAssets({families=BOTANICAL_FAMILIES}={}){
  const output=path.join(root,'public/runtime/botanical');await fs.mkdir(output,{recursive:true});
  await MeshoptEncoder.ready;await MeshoptDecoder.ready;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const manifest={},assets=[],sourceSHA256=sha(await fs.readFile(path.join(root,'src/grove-foliage.js')));
  for(const family of families)for(const level of family.levels){
    const id=`botanical/${family.kind}/${family.seed}/${level}`,started=performance.now(),tree=createGroveTreeSource(family.kind,family.seed,level),sourceBuildMs=performance.now()-started;
    const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(tree.name),sourceParts={branches:tree.branchesMesh.geometry,leaves:tree.leavesMesh.geometry};
    scene.setExtras({name:tree.name,botanicalDetail:tree.userData.botanicalDetail,detailLevel:level,kind:family.kind,seed:family.seed});
    let sourceGeometryBytes=0;
    for(const [name,geometry]of Object.entries(sourceParts)){
      const primitive=doc.createPrimitive();
      for(const [attributeName,semantic]of Object.entries(semantics)){
        const attribute=geometry.getAttribute(attributeName);sourceGeometryBytes+=attribute.array.byteLength;
        primitive.setAttribute(semantic,doc.createAccessor(`${name}/${attributeName}`).setType(`VEC${attribute.itemSize}`).setArray(attribute.array).setBuffer(buffer));
      }
      sourceGeometryBytes+=geometry.index.array.byteLength;
      primitive.setIndices(doc.createAccessor(`${name}/indices`).setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
      scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
    }
    const unpacked=await io.writeBinary(doc);
    // Match Meshopt medium mode explicitly so measurements capture the lossless reorder
    // before any quantization; no custom identifier attributes are shipped.
    await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));
    const reference=Object.fromEntries(doc.getRoot().listMeshes().map(mesh=>[mesh.getName(),snapshotPrimitive(mesh.listPrimitives()[0])]));
    await doc.transform(quantize({quantizePosition:16,quantizeNormal:14,quantizeTexcoord:16,quantizeColor:16}));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
    const binary=await io.writeBinary(doc),decoded=await io.readBinary(binary),parts={};
    for(const node of decoded.getRoot().listNodes())if(node.getMesh()){
      const name=node.getName();parts[name]=comparePrimitive(node.getMesh().listPrimitives()[0],node,reference[name],sourceParts[name]);
      if(parts[name].triangles!==sourceParts[name].index.count/3)throw new Error(`Removed source triangles: ${id}/${name}`);
    }
    const hash=sha(binary),name=`${family.kind}-${family.seed}-${level}.${hash.slice(0,16)}.glb`;
    await fs.writeFile(path.join(output,name),binary);
    manifest[id]={id,url:`/runtime/botanical/${name}`,bytes:binary.byteLength,sha256:hash,phase:2,region:family.region,kind:family.kind,seed:family.seed,level,variant:level,dependencies:[],source:'world/src/grove-foliage.js'};
    assets.push({id,bytes:binary.byteLength,uncompressedGLBBytes:unpacked.byteLength,sourceGeometryBytes,ratio:binary.byteLength/unpacked.byteLength,sourceBuildMs,totalBuildAndValidationMs:performance.now()-started,botanicalDetail:tree.userData.botanicalDetail,triangles:parts.branches.triangles+parts.leaves.triangles,parts});
    console.log(JSON.stringify({id,bytes:binary.byteLength,triangles:assets.at(-1).triangles,sourceBuildMs:Math.round(sourceBuildMs),boundsMaxAbs:Math.max(...Object.values(parts).map(p=>p.boundsMaxAbs)),pigmentMaxAbs:Math.max(...Object.values(parts).map(p=>p.errors.COLOR_0.maxAbs))}));
    for(const mesh of tree.children){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial?.dispose();mesh.customDistanceMaterial?.dispose();}
  }
  const report={sourceSHA256,meshopt:'1.2.0',gltfTransform:'4.5.0',positionBits:16,normalBits:14,uvBits:16,colorBits:16,meshSimplification:false,triangleTopologyPreserved:true,materialReplacement:false,textureReplacement:false,assets,totalBytes:assets.reduce((sum,asset)=>sum+asset.bytes,0)};
  await fs.writeFile(path.join(root,'src/botanical-manifest.js'),`// Generated from actual bytes by scripts/prepare-botanical-assets.mjs.\nexport const botanicalFamilies = ${JSON.stringify(families,null,2)};\nexport const botanicalManifest = ${JSON.stringify(manifest,null,2)};\n`);
  await fs.writeFile(path.join(root,'../docs/art/experience-v4/botanical-transmission-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({assets:assets.length,totalBytes:report.totalBytes}));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareBotanicalAssets();
