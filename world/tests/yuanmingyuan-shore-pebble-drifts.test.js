import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shorePebbleDriftRecords,createShoreDriftPebbleGeometry,createShoreDriftMaterial} from '../src/yuanmingyuan/shore-pebble-drifts.js';
import {shoreBankSpec} from '../src/yuanmingyuan/shore-bank-geometry.js';

test('three reproducible stone fans retain open viewing gaps and graduated sizes',()=>{
  const records=shorePebbleDriftRecords(shoreBankSpec);assert.deepEqual(records,shorePebbleDriftRecords(shoreBankSpec));assert.equal(records.length,111);
  for(const r of records){assert(r.n<0);assert(Math.abs(r.s)+Math.max(...r.scale)<shoreBankSpec.halfLength);assert(r.burial>0&&r.burial<r.scale[1]);for(const [lo,hi]of [[-4.65,-2.95],[2.85,4.8]])assert(r.s+Math.max(...r.scale)<lo||r.s-Math.max(...r.scale)>hi);}
  for(let drift=0;drift<3;drift++){const group=records.filter(r=>r.drift===drift);assert(group.filter(r=>r.radius>.2).length===2);assert(group.some(r=>r.radius<.05));assert(Math.max(...group.map(r=>r.radius))>6*Math.min(...group.map(r=>r.radius)));}
});

test('relieved stone surfaces keep finite UVs, outward geometric faces and unit normals',()=>{
  for(let seed=1;seed<=3;seed++){
    const g=createShoreDriftPebbleGeometry(seed),p=g.attributes.position,n=g.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),face=new THREE.Vector3(),normal=new THREE.Vector3();
    try{
      assert(g.index.count/3>4000);for(const attr of Object.values(g.attributes))assert([...attr.array].every(Number.isFinite));
      for(let i=0;i<n.count;i++){normal.fromBufferAttribute(n,i);assert(Math.abs(normal.length()-1)<1e-6);}
      for(let i=0;i<g.index.count;i+=3){a.fromBufferAttribute(p,g.index.getX(i));b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));face.subVectors(b,a).cross(c.clone().sub(a));assert(face.length()>1e-8);assert(face.dot(a.clone().add(b).add(c))>0);}
    }finally{g.dispose();}
  }
});

test('stone PBR copies only its material and never disposes or edits borrowed map resources',()=>{
  const maps={map:new THREE.Texture(),normalMap:new THREE.Texture(),roughnessMap:new THREE.Texture()},source=new THREE.MeshStandardMaterial({...maps,roughness:1,normalScale:new THREE.Vector2(1,1)});let released=0;
  for(const t of Object.values(maps))t.addEventListener('dispose',()=>released++);
  const result=createShoreDriftMaterial(source);assert.notEqual(result,source);for(const [name,t]of Object.entries(maps))assert.equal(result[name],t);assert.equal(source.roughness,1);assert.deepEqual(source.normalScale.toArray(),[1,1]);result.dispose();assert.equal(released,0);source.dispose();for(const t of Object.values(maps))t.dispose();assert.equal(released,3);
  assert.throws(()=>createShoreDriftMaterial(new THREE.MeshStandardMaterial()),/photographic rock PBR/);
});
