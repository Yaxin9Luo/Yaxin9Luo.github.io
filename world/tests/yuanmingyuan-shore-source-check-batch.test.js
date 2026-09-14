import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {inspectShoreSourceGeometry,inspectAllShoreSources} from '../src/yuanmingyuan/shore-source-check-batch.js';

const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function fixture(){
  const geometry=new THREE.SphereGeometry(.2,12,8);geometry.name='actual-small-sphere';
  const attributes=Object.fromEntries([['index',geometry.index],...Object.entries(geometry.attributes)].map(([key,a])=>[key,{arrayType:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,byteLength:a.array.byteLength,sha256:hash(a.array)}]));
  const expected={name:geometry.name,type:geometry.type,groups:[],drawRange:{start:0,count:'Infinity'},attributes};
  return {geometry,expected,sourceIndex:0,geometryIndex:0,name:'sphere'};
}

test('all real borrowed sphere attributes hash unchanged, with exact streaming persistence before owner release',async()=>{
  const input=fixture(),retained=[];let disposed=0;input.geometry.addEventListener('dispose',()=>disposed++);
  try{
    const result=await inspectShoreSourceGeometry({...input,onAttribute:row=>{retained.push({key:row.attribute,hash:hash(row.bytes)});return {bytes:row.byteLength};}});
    assert.equal(result.allAttributesMatch,true);assert.equal(result.metadataMatches,true);assert.equal(result.attributeSetMatches,true);assert.equal(retained.length,4);assert.equal(disposed,0);
    for(const row of retained)assert.equal(row.hash,input.expected.attributes[row.key].sha256);
  }finally{input.geometry.dispose();}assert.equal(disposed,1);
});

test('an actual one-bit normal difference retains every original Uint32 word without rewriting the source',async()=>{
  const input=fixture(),normal=input.geometry.attributes.normal.array,bits=new Uint32Array(normal.buffer);bits[4]^=1;
  const before=new Uint32Array(bits);
  try{
    const result=await inspectShoreSourceGeometry(input);assert.equal(result.allAttributesMatch,false);assert.equal(result.normalMismatches.length,1);
    assert.deepEqual(new Uint32Array(result.attributes.normal.exactBits.values),before);assert.deepEqual(bits,before);assert.equal(result.attributes.position.match,true);assert.equal(result.attributes.index.match,true);assert.equal(result.attributes.uv.match,true);
  }finally{input.geometry.dispose();}
});

test('metadata, extra attributes, callback failures and cancellation cannot become a successful byte-only comparison',async()=>{
  const input=fixture();
  try{
    input.geometry.name='changed';input.geometry.setAttribute('extra',new THREE.Float32BufferAttribute([1,2,3],3));
    const result=await inspectShoreSourceGeometry(input);assert.equal(result.metadataMatches,false);assert.equal(result.attributeSetMatches,false);assert.equal(result.allAttributesMatch,false);
    await assert.rejects(inspectShoreSourceGeometry({...input,onAttribute:()=>{throw new Error('storage failed');}}),/storage failed/);
    const controller=new AbortController();controller.abort();await assert.rejects(inspectShoreSourceGeometry({...input,signal:controller.signal}),{name:'AbortError'});
  }finally{input.geometry.dispose();}
});

test('full mode rejects changed raw source proof before constructing any full source owner',async()=>{
  const manifest={threeRevision:THREE.REVISION,sources:Array(92),geometries:Array(92),sourceFiles:[{path:'frozen.js',sha256:'not-the-actual-SHA'}]},progress=[];
  await assert.rejects(inspectAllShoreSources({manifest,readSource:async()=> 'changed source',onProgress:row=>progress.push(row)}),/source closure differs/);assert.deepEqual(progress,[]);
});
