import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mutableGeometry} from '../src/gltf-resource.js';

// Exact pre-optimization conversion from the archived 6abddbdd source. This
// reference retains the old allocation so output equivalence is independent.
function previousMutableGeometry(source){
  const geometry=source.clone();
  for(const name of ['position','normal','tangent']){
    const attribute=geometry.getAttribute(name);if(!attribute)continue;
    if(attribute.normalized||!(attribute.array instanceof Float32Array)){
      const values=[];for(let i=0;i<attribute.count;i++)for(let j=0;j<attribute.itemSize;j++)values.push(attribute.getComponent(i,j));
      geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));
    }
  }
  return geometry;
}
function attributeRecord(attribute){
  return {
    type:attribute.array.constructor.name,bytes:Buffer.from(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength)),
    name:attribute.name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,
    usage:attribute.usage??attribute.data?.usage,gpuType:attribute.gpuType,
    interleaved:attribute.isInterleavedBufferAttribute===true,stride:attribute.data?.stride,offset:attribute.offset,
  };
}
function geometryRecord(geometry){
  return {
    name:geometry.name,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,attributeRecord(a)])),
    index:geometry.index&&attributeRecord(geometry.index),
    morphAttributes:Object.fromEntries(Object.entries(geometry.morphAttributes).map(([name,list])=>[name,list.map(attributeRecord)])),
    morphTargetsRelative:geometry.morphTargetsRelative,groups:structuredClone(geometry.groups),drawRange:{...geometry.drawRange},
    userData:structuredClone(geometry.userData),bounds:geometry.boundingBox&&{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},
    sphere:geometry.boundingSphere&&{center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius},
  };
}
function geometry(attributes){
  const result=new THREE.BufferGeometry();result.name='tiny immutable source';result.userData={seed:71};
  for(const [name,attribute]of Object.entries(attributes)){attribute.name=`source-${name}`;result.setAttribute(name,attribute);}
  result.setIndex(new THREE.Uint16BufferAttribute([0,1,2],1));result.addGroup(0,3,2);result.setDrawRange(0,3);return result;
}
function compare(source,{transform=true}={}){
  const original=geometryRecord(source),expected=previousMutableGeometry(source),actual=mutableGeometry(source);
  try{
    assert.notEqual(actual,source);assert.deepEqual(geometryRecord(actual),geometryRecord(expected));
    for(const [name,attribute]of Object.entries(actual.attributes))assert.notEqual(attribute.array.buffer,source.attributes[name].array.buffer,`${name}: clone owns its buffer`);
    if(transform){
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3(12.37,-.812,9.05),new THREE.Quaternion().setFromEuler(new THREE.Euler(.31,-.58,.12)),new THREE.Vector3(1.3,.77,2.05));
      for(const output of [expected,actual]){output.applyMatrix4(matrix);output.computeBoundingBox();output.computeBoundingSphere();}
      assert.deepEqual(geometryRecord(actual),geometryRecord(expected),'all transformed bytes and bounds match the former implementation');
    }
    actual.getAttribute('position')?.setX(0,123.25);
    assert.deepEqual(geometryRecord(source),original,'conversion and later caller mutations leave every source byte/metadata unchanged');
  }finally{expected.dispose();actual.dispose();source.dispose();}
}

test('mutable geometry preserves signed/unsigned normalized accessors and every unchanged attribute byte',()=>{
  compare(geometry({
    position:new THREE.Int16BufferAttribute([-32768,0,32767,1,-1,12345,32766,-16384,8192],3,true).setUsage(THREE.DynamicDrawUsage),
    normal:new THREE.Int8BufferAttribute([-128,0,127,127,1,-1,0,127,0],3,true),
    tangent:new THREE.Uint16BufferAttribute([65535,0,32768,65535,1,32767,65534,0,16384,49152,0,65535],4,true),
    uv:new THREE.Uint16BufferAttribute([0,65535,1,32768,65534,7],2,true).setUsage(THREE.StreamDrawUsage),
    color:new THREE.Uint8BufferAttribute([0,255,128,1,2,3,4,5,6,7,8,9],4,true),
    custom:new THREE.Float32BufferAttribute([1/3,-0,2**-149],1),
  }));
});

test('mutable geometry reads normalized interleaved offsets and strides without changing shared source storage',()=>{
  const buffer=new THREE.InterleavedBuffer(new Int16Array([
    -32768,0,32767,0,32767,0,101,201,
    1200,-12345,16384,32767,0,0,102,202,
    2,3,4,0,0,32767,103,203,
  ]),8).setUsage(THREE.DynamicDrawUsage);
  compare(geometry({
    position:new THREE.InterleavedBufferAttribute(buffer,3,0,true),
    normal:new THREE.InterleavedBufferAttribute(buffer,3,3,true),
    untouched:new THREE.InterleavedBufferAttribute(buffer,2,6,false),
  }));
});

test('mutable geometry keeps Float32 interleaving, usage, attribute keys and morph data on the existing clone path',()=>{
  const buffer=new THREE.InterleavedBuffer(new Float32Array([1,2,3,0,1,0,-0,-2,4,1,0,0,5,6,7,0,0,1]),6).setUsage(THREE.StreamDrawUsage);
  const source=geometry({position:new THREE.InterleavedBufferAttribute(buffer,3,0),normal:new THREE.InterleavedBufferAttribute(buffer,3,3),tangent:new THREE.Float32BufferAttribute([1,0,0,1,1,0,0,-1,1,0,0,1],4).setUsage(THREE.DynamicDrawUsage)});
  source.morphAttributes.position=[new THREE.Float32BufferAttribute([.1,.2,.3,.4,.5,.6,.7,.8,.9],3)];source.morphTargetsRelative=true;
  compare(source);
});

test('mutable geometry preserves exact Float32 ties, subnormals and signed zero from wider finite attributes',()=>{
  compare(geometry({
    position:new THREE.BufferAttribute(new Float64Array([1+2**-24,1+3*2**-24,-0,2**-149,2**-150,-(2**-150),-1-2**-24,1/3,16777217]),3),
    normal:new THREE.BufferAttribute(new Float64Array([1/3,2/3,2/3,-1/3,2/3,2/3,0,1,0]),3),
  }));
});

test('mutable geometry retains empty/missing attributes and integer values without normalization',()=>{
  compare(geometry({position:new THREE.Int32BufferAttribute([-2147483648,2147483647,16777217,0,1,-1,17,23,41],3),tangent:new THREE.Int16BufferAttribute([],4)}),{transform:false});
  const source=new THREE.BufferGeometry();source.setAttribute('uv',new THREE.Float32BufferAttribute([.2,.3],2));compare(source,{transform:false});
});

test('mutable geometry allocates each converted Float32 attribute once directly as its final storage',()=>{
  const source=geometry({position:new THREE.Int16BufferAttribute([-32768,0,32767,1,2,3,4,5,6],3,true),normal:new THREE.Int8BufferAttribute([0,127,0,127,0,0,0,0,127],3,true),tangent:new THREE.Uint16BufferAttribute([1,2,3,4,5,6,7,8,9,10,11,12],4,true)});
  const Original=globalThis.Float32Array,allocations=[];let output;
  globalThis.Float32Array=new Proxy(Original,{construct(Type,args){const array=Reflect.construct(Type,args);allocations.push({input:args[0],array});return array;}});
  try{output=mutableGeometry(source);}finally{globalThis.Float32Array=Original;}
  try{
    assert.equal(allocations.length,3,'one final allocation per converted attribute');
    assert.deepEqual(allocations.map(({input})=>typeof input),['number','number','number'],'no temporary JS array or typed-array copy constructor');
    for(const [i,name]of ['position','normal','tangent'].entries()){
      assert.equal(allocations[i].input,source.getAttribute(name).count*source.getAttribute(name).itemSize);
      assert.equal(output.getAttribute(name).array,allocations[i].array,`${name}: allocated array is the final attribute storage`);
    }
  }finally{output?.dispose();source.dispose();}
});
