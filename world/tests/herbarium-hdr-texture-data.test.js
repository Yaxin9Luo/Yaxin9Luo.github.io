import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HalfFloatType,RGBA_ASTC_4x4_Format} from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {read,write} from 'three/addons/libs/ktx-parse.module.js';
import {decodeHerbariumHDRTextureData} from '../src/herbarium-hdr-texture-data.js';

// Exact 890-byte official q4/no-RDO HDR result, retained inline so these tiny
// tests do not depend on ignored work directories or decode any full-size map.
// Provenance: work/living-v8/normal-ktx-trial/tiny-hdr/normal-16-hdr4x4-q4-nordo.ktx2
const fixture=Buffer.from('q0tUWCAyMLsNChoK0MubOwEAAAAQAAAAEAAAAAAAAAAAAAAAAQAAAAUAAAACAAAAyAAAACwAAAD0AAAA6AAAAAAAAAAAAAAAAAAAAAAAAABwAgAAAAAAAAoBAAAAAAAAAAEAAAAAAAAnAgAAAAAAAEkAAAAAAAAAQAAAAAAAAAAOAgAAAAAAABkAAAAAAAAAEAAAAAAAAAD1AQAAAAAAABkAAAAAAAAAEAAAAAAAAADcAQAAAAAAABkAAAAAAAAAEAAAAAAAAAAsAAAAAAAAAAIAKACnAAEAAwMAABAAAAAAAAAAAAB/gAAAAAAAAAAAAACAPxIAAABLVFhvcmllbnRhdGlvbgByZAAAADgAAABLVFh3cml0ZXIAa3R4IGNyZWF0ZSB2NS4wLjAtcmMyfjMgLyBsaWJrdHggdjUuMC4wLXJjMn4yAI4AAABLVFh3cml0ZXJTY1BhcmFtcwAtLXVhc3RjLXF1YWxpdHkgNCAtLXVhc3RjLWhkci11YmVyLW1vZGUgdHJ1ZSAtLXVhc3RjLWhkci11bHRyYS1xdWFudCB0cnVlIC0tdWFzdGMtaGRyLWZhdm9yLWFzdGMgdHJ1ZSAtLXRocmVhZHMgMSAtLXpzdGQgMTgAAAAotS/9IBCBAAD8/////////yc4ZTdBOwA8KLUv/SAQgQAAUcgJ1oZSRchtqFSAHMACRii1L/0gEIEAAEKIA3ZgVxJxYB9TCfZVqsAotS/9IEABAgBRKALWhlMEIHHZZI5VV0FWUYgD1obRwnhtGB2MV/urAUIoAnYdFwSvXb4AByUpJydCiAK2HabFJbMf1BPeVqkBKLUv/WAAAAEIAPz/////////ADYAOSs8ADxCCAk2BxADaSFdRRHaYGhKUSgC1pWy1BFZCEA5UXo3wlEIPtaGVoLoWYgrl5D8pclCKAI2AxBDfyddQBeXJacJUSgB1oZRZWht6EyGnu0DgVHICdaNspQRbQg1hJ7ruDNRqAPWhlBi6G3oHAif+7ypUUgG1oZP51lbSJmVURdiplFIDpaL7FxZbahUBF7pq4ZRKALWhZrUEVsIQplRVyjqUYg71oU5k2hdaDGXkH0ZKENgu4UfUwwkAQCAR/f5qWFRiA7WhTM3IG94XAJWdewNUQg+9oUvd1g7yMYZlcOFwFGIA/aL/d8QaYgNAAAMhQA=','base64');
const expected={width:16,height:16,levels:5};
const bytes=()=>Uint8Array.from(fixture).buffer;
const edit=change=>{const buffer=bytes();change(new DataView(buffer),new Uint8Array(buffer));return buffer;};
const rewrite=change=>{const container=read(new Uint8Array(bytes()));change(container);return Uint8Array.from(write(container,{keepWriter:true})).buffer;};

test('actual tiny HDR yields exact installed direct-loader blocks with independent transferable ownership',async()=>{
  assert.equal(fixture.length,890);assert.equal(createHash('sha256').update(fixture).digest('hex'),'8b1d6479fb016d60462d78747a50ffb39e55c96c9d7a80c3b4391aeb8ae253a2');
  const input=bytes(),original=Buffer.from(input).toString('hex');
  const loader=new KTX2Loader().detectSupport({extensions:{has:name=>name==='WEBGL_compressed_texture_astc',get:()=>({getSupportedProfiles:()=>['hdr']})}});
  loader.init=()=>{throw new Error('The direct HDR comparison must not initialize a Basis transcoder');};
  const reference=await new Promise((resolve,reject)=>loader.parse(bytes(),resolve,reject));
  const result=await decodeHerbariumHDRTextureData(input,expected);
  try{
    assert.equal(result.width,16);assert.equal(result.height,16);assert.equal(result.type,HalfFloatType);assert.equal(result.format,RGBA_ASTC_4x4_Format);assert.equal(result.mipmaps.length,5);
    const buffers=new Set();
    for(const [i,mip] of result.mipmaps.entries()){
      const oracle=reference.mipmaps[i];assert.equal(mip.width,oracle.width);assert.equal(mip.height,oracle.height);
      assert.ok(mip.data instanceof Uint8Array);assert.equal(mip.data.byteOffset,0);assert.equal(mip.data.buffer.byteLength,mip.data.byteLength);assert.notEqual(mip.data.buffer,input);
      assert.deepEqual(mip.data,new Uint8Array(oracle.data.buffer,oracle.data.byteOffset,oracle.data.byteLength));buffers.add(mip.data.buffer);
    }
    assert.deepEqual(result.mipmaps.map(m=>m.data.byteLength),[256,64,16,16,16]);assert.equal(buffers.size,5);assert.equal(Buffer.from(input).toString('hex'),original);
    const transferred=structuredClone(result,{transfer:[...buffers]});assert.ok(result.mipmaps.every(m=>m.data.byteLength===0));assert.equal(transferred.mipmaps[0].data.byteLength,256);assert.equal(input.byteLength,890);
  }finally{reference.dispose();}
});

test('parallel tiny calls own distinct output buffers and a rejected file does not poison later calls',async()=>{
  const [a,b]=await Promise.all([decodeHerbariumHDRTextureData(bytes(),expected),decodeHerbariumHDRTextureData(bytes(),expected)]);
  assert.equal(new Set([...a.mipmaps,...b.mipmaps].map(m=>m.data.buffer)).size,10);
  a.mipmaps[0].data[0]^=255;assert.notEqual(a.mipmaps[0].data[0],b.mipmaps[0].data[0]);
  await assert.rejects(decodeHerbariumHDRTextureData(edit((v,u)=>u.fill(0,Number(v.getBigUint64(80,true)))),expected),/HDR KTX2/);
  const c=await decodeHerbariumHDRTextureData(bytes(),expected);assert.deepEqual(c.mipmaps[0].data,b.mipmaps[0].data);
});

test('rejects a valid Zstd frame whose actual output disagrees with the declared mip size',async()=>{
  const wrongPayload=rewrite(c=>c.levels[0].levelData=c.levels[4].levelData);
  await assert.rejects(decodeHerbariumHDRTextureData(wrongPayload,expected),/mip 0 decompression/);
});

test('rejects an internally truncated compressed mip despite an in-range container index',async()=>{
  const truncated=edit(v=>v.setBigUint64(88,v.getBigUint64(88,true)-1n,true));
  await assert.rejects(decodeHerbariumHDRTextureData(truncated,expected),/HDR KTX2/);
});

for(const [name,contract] of [['missing',undefined],['zero width',{...expected,width:0}],['fractional height',{...expected,height:1.5}],['incomplete chain',{...expected,levels:4}],['wrong extent',{width:8192,height:8192,levels:14}]]){
  test(`rejects ${name} expected extent contract before decoding`,async()=>{await assert.rejects(decodeHerbariumHDRTextureData(bytes(),contract),/HDR KTX2/);});
}

const mutations=[
  ['identifier',(v,u)=>u[0]=0],['format',v=>v.setUint32(12,0,true)],['type size',v=>v.setUint32(16,2,true)],
  ['width',v=>v.setUint32(20,8,true)],['height',v=>v.setUint32(24,8,true)],['depth',v=>v.setUint32(28,1,true)],
  ['array layer',v=>v.setUint32(32,1,true)],['cube faces',v=>v.setUint32(36,6,true)],['mip count',v=>v.setUint32(40,4,true)],['supercompression',v=>v.setUint32(44,0,true)],
  ['global data',v=>v.setBigUint64(64,1n,true)],['header overlap',v=>v.setBigUint64(80,80n,true)],['mip overlap',v=>v.setBigUint64(104,v.getBigUint64(80,true),true)],
  ['DFD overlap',v=>v.setUint32(56,v.getUint32(48,true),true)],['truncated metadata extent',v=>v.setUint32(60,1000,true)],
  ['unsafe 64-bit offset',v=>v.setBigUint64(80,2n**60n,true)],['zero compressed mip',v=>v.setBigUint64(88,0n,true)],['wrong uncompressed mip',v=>v.setBigUint64(96,128n,true)],
  ['DFD total size',v=>v.setUint32(v.getUint32(48,true),40,true)],['DFD model',v=>v.setUint8(v.getUint32(48,true)+12,166)],
  ['primaries',v=>v.setUint8(v.getUint32(48,true)+13,1)],['sRGB transfer',v=>v.setUint8(v.getUint32(48,true)+14,2)],
  ['premultiplied flag',v=>v.setUint8(v.getUint32(48,true)+15,1)],['block dimensions',v=>v.setUint8(v.getUint32(48,true)+16,5)],
  ['block byte count',v=>v.setUint8(v.getUint32(48,true)+20,8)],['sample channel',v=>v.setUint8(v.getUint32(48,true)+31,0)],
  ['KVD entry length',v=>v.setUint32(v.getUint32(56,true),0xffffffff,true)],
  ['duplicate orientation',(v,u)=>{const at=Buffer.from(u).indexOf('KTXwriterScParams');u.set(new TextEncoder().encode('KTXorientation\0'),at);}],
];
for(const [name,change] of mutations)test(`rejects malformed ${name}`,async()=>{await assert.rejects(decodeHerbariumHDRTextureData(edit(change),expected),/HDR KTX2/);});
for(const length of [0,79,199,500,889])test(`rejects truncated ${length}-byte input`,async()=>{await assert.rejects(decodeHerbariumHDRTextureData(bytes().slice(0,length),expected),/HDR KTX2/);});
for(const [name,change] of [
  ['missing orientation',c=>delete c.keyValue.KTXorientation],['wrong orientation',c=>c.keyValue.KTXorientation='ru'],
  ['swizzle',c=>c.keyValue.KTXswizzle='rgba'],['range mapping',c=>c.keyValue.KTXmapRange='0 1'],
])test(`rejects ${name} metadata`,async()=>{await assert.rejects(decodeHerbariumHDRTextureData(rewrite(change),expected),/HDR KTX2/);});

test('writer settings remain provenance rather than changing block interpretation',async()=>{
  const result=await decodeHerbariumHDRTextureData(rewrite(c=>c.keyValue.KTXwriterScParams=c.keyValue.KTXwriterScParams.replace('--threads 1','--threads 6')),expected);
  assert.deepEqual(result.mipmaps.map(m=>m.data.byteLength),[256,64,16,16,16]);
});
