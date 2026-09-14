import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createLosslessPacker} from '../../docs/art/living-v8/herbarium/lossless-pack.mjs';

const require=createRequire(import.meta.url);
const {Document,NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer');
const hash=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const legacyCanonical=array=>{
  const result=new Uint32Array(array.length);
  for(let i=0;i<array.length;i+=3){const triangle=Array.from(array.slice(i,i+3)),start=triangle.indexOf(Math.min(...triangle));for(let j=0;j<3;j++)result[i+j]=triangle[(start+j)%3];}
  return result;
};
async function fixture(indices){
  await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const document=new Document(),buffer=document.createBuffer();
  const accessor=(type,array)=>document.createAccessor().setBuffer(buffer).setType(type).setArray(array);
  const primitive=document.createPrimitive()
    .setAttribute('POSITION',accessor('VEC3',new Float32Array([0,0,0,1,0,0,0,1,0,1,1,0])))
    .setAttribute('NORMAL',accessor('VEC3',new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1])))
    .setAttribute('TEXCOORD_0',accessor('VEC2',new Float32Array([0,0,1,0,0,1,1,1])))
    .setIndices(accessor('SCALAR',new Uint16Array(indices)));
  const mesh=document.createMesh('tiny indexed triangles').addPrimitive(primitive);
  document.createScene().addChild(document.createNode().setMesh(mesh));
  const raw=await io.writeBinary(document);
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const bytes=await io.writeBinary(document),decoded=await io.readBinary(bytes),after=decoded.getRoot().listMeshes()[0].listPrimitives()[0];
  return {io,raw,primitive,after};
}

test('real Meshopt cyclic rotation of repeated-minimum triangles preserves the ordered geometry contract',async()=>{
  const cases=[[0,1,0],[0,0,1],[1,0,0],[0,0,0],[0,1,0,2,0,1],[2,2,3,1,0,2],[0,1,2,2,3,0]];
  const pack=await createLosslessPacker([]),differences=[];
  for(const indices of cases){
    const {raw,primitive,after}=await fixture(indices),beforeIndices=primitive.getIndices().getArray(),afterIndices=after.getIndices().getArray();
    const legacyBefore=hash(legacyCanonical(beforeIndices)),legacyAfter=hash(legacyCanonical(afterIndices));
    const attributes=primitive.listSemantics().map(name=>({name,before:hash(primitive.getAttribute(name).getArray()),after:hash(after.getAttribute(name).getArray())}));
    assert.ok(attributes.every(entry=>entry.before===entry.after),'Meshopt retained every source attribute byte');
    assert.equal(afterIndices.length,beforeIndices.length);
    for(let i=0;i<beforeIndices.length;i+=3)assert.ok([0,1,2].some(start=>[0,1,2].every(j=>afterIndices[i+j]===beforeIndices[i+(start+j)%3])),'same triangle at the same offset, allowing only cyclic rotation');
    if(legacyBefore!==legacyAfter)differences.push({before:Array.from(beforeIndices),after:Array.from(afterIndices),legacyCanonicalBefore:Array.from(legacyCanonical(beforeIndices)),legacyCanonicalAfter:Array.from(legacyCanonical(afterIndices)),attributes});
    await assert.doesNotReject(pack(raw),`lossless triangle ${JSON.stringify(indices)}`);
  }
  assert.ok(differences.length>0,'the real codec exercises the legacy repeated-minimum bug');
  console.log('ACTUAL_MESHOPT_REPEATED_MINIMUM_EVIDENCE',JSON.stringify(differences));
});

test('real packer still rejects changed attribute bytes, reversed winding, reordered and removed triangles',async()=>{
  const {raw}=await fixture([0,1,2,0,2,3,0,1,0]),write=NodeIO.prototype.writeBinary;
  const mutations=[
    primitive=>{primitive.getAttribute('POSITION').getArray()[0]=.125;},
    primitive=>{primitive.getAttribute('TEXCOORD_0').getArray()[0]=.125;},
    primitive=>{primitive.getAttribute('NORMAL').getArray()[0]=.125;},
    primitive=>{primitive.getIndices().getArray().set([0,2,1,0,2,3]);},
    primitive=>{primitive.getIndices().getArray().set([0,2,3,0,1,2]);},
    primitive=>{primitive.getIndices().setArray(new Uint16Array([0,1,2,0,2,3]));},
    primitive=>{primitive.getIndices().getArray().set([0,1,2,0,2,3,0,0,0]);},
  ];
  for(const mutate of mutations){
    let writes=0;
    NodeIO.prototype.writeBinary=async function(document){if(++writes===2)mutate(document.getRoot().listMeshes()[0].listPrimitives()[0]);return write.call(this,document);};
    try{const pack=await createLosslessPacker([]);await assert.rejects(pack(raw),/geometry attribute bytes or ordered triangle winding/);}
    finally{NodeIO.prototype.writeBinary=write;}
  }
});
