import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {refineSheepShoulderSkin,sheepShoulderDetailWeight,resolveSheepShoulderCreases} from '../src/yuanmingyuan/xieqiqu-sheep-detail.js';
import {createSheepFleeceField} from '../src/yuanmingyuan/xieqiqu-sheep-fleece.js';
import {createCopperSheepEarGeometry,copperSheepEarSides} from '../src/yuanmingyuan/xieqiqu-copper-sheep.js';

test('local refinement keeps original positions, closes mixed-resolution edges and borrows ownership',()=>{
  const raw=new THREE.IcosahedronGeometry(.09,2);raw.translate(.28,1.1,.32);raw.deleteAttribute('uv');const source=mergeVertices(raw);raw.dispose();let disposed=0;source.addEventListener('dispose',()=>disposed++);
  const original=source.attributes.position.array.slice(),originalNormals=source.attributes.normal.array.slice(),oldIds=source.index.array.slice(),geometry=refineSheepShoulderSkin(source,{maximumEdge:.006});
  try{
    assert.equal(disposed,0);assert.deepEqual(source.attributes.position.array,original);assert.deepEqual(source.index.array,oldIds);assert.deepEqual(geometry.attributes.position.array.slice(0,original.length),original);assert.deepEqual(geometry.attributes.normal.array.slice(0,originalNormals.length),originalNormals);assert.ok(geometry.index.count>oldIds.length);
    const ids=geometry.index.array,edges=new Map(),triangles=new Set();
    for(let i=0;i<ids.length;i+=3){triangles.add(ids.slice(i,i+3).join(','));for(let k=0;k<3;k++){const a=ids[i+k],b=ids[i+(k+1)%3],key=Math.min(a,b)+','+Math.max(a,b),value=edges.get(key)??[0,0];value[0]++;value[1]+=a<b?1:-1;edges.set(key,value);}}
    assert.ok([...edges.values()].every(([count,winding])=>count===2&&winding===0),'transition edges are neither T junctions nor holes');
    let untouched=0;const p=source.attributes.position;for(let i=0;i<oldIds.length;i+=3){const tri=oldIds.slice(i,i+3);if(tri.every(id=>sheepShoulderDetailWeight(p.getX(id),p.getY(id),p.getZ(id))===0)){assert.ok(triangles.has(tri.join(',')));untouched++;}}assert.ok(untouched>20,'accepted region keeps its actual triangles');
  }finally{geometry.dispose();source.dispose();assert.equal(disposed,1);}
});

test('shoulder lock intersections are rounded without a raised empty cell or altered flank height',()=>{
  const make=z=>[-1,1].map(side=>({points:[[.15+side*.008,.90,z],[.15+side*.008,1.10,z]],height:.023,width:.03}));
  const field=createSheepFleeceField(make(.59)),eps=1e-6,h=field.heightAt(.15,1,.59),left=(h-field.heightAt(.15-eps,1,.59))/eps,right=(field.heightAt(.15+eps,1,.59)-h)/eps;
  const unjoined=createSheepFleeceField([make(.59)[0]]).heightAt(.15,1,.59);assert.ok(h>unjoined&&h<unjoined+.001);assert.ok(field.heightAt(.142,1,.59)>.0229,'keep the 23 mm crest');assert.ok(Math.abs(left-right)<.03,'symmetric crossing has no hard max derivative jump');assert.equal(field.heightAt(.15,1,.72),0);
  const locks=make(-.4),outside=createSheepFleeceField(locks),single=locks.map(l=>createSheepFleeceField([l]));for(let i=0;i<50;i++){const x=.10+i*.002;assert.equal(outside.heightAt(x,1,-.4),Math.max(...single.map(f=>f.heightAt(x,1,-.4))));}
});

test('ear rolled edges have a measured round radius rather than the R3 sharp paper-like rim',async()=>{
  const old=JSON.parse(await readFile(new URL('./fixtures/xieqiqu-sheep-r3-ear-rings.json',import.meta.url),'utf8'));
  const radius=ps=>{const [a,b,c]=ps.map(p=>new THREE.Vector3(...p)),ab=a.distanceTo(b),bc=b.distanceTo(c),ca=c.distanceTo(a),twiceArea=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).length();return ab*bc*ca/(2*twiceArea);};
  for(const side of [-1,1]){
    const geometry=createCopperSheepEarGeometry(side),p=geometry.attributes.position,ring=Array.from({length:copperSheepEarSides},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,32*copperSheepEarSides+i).toArray());
    try{const prior=old.rows.find(r=>r.side===side).midRing,oldRadius=radius([prior.at(-1),prior[0],prior[1]]),newRadius=radius([ring.at(-1),ring[0],ring[1]]);assert.ok(newRadius>.005&&newRadius<.020);assert.ok(newRadius>oldRadius*4,'the rolled edge is real geometry, not only a smooth material');geometry.computeBoundingBox();assert.ok(geometry.boundingBox.getSize(new THREE.Vector3()).x<.27);}finally{geometry.dispose();}
  }
});

test('exact crease sectors preserve each triangle while distinguishing sharp relief from smooth skin',()=>{
  const raw=new THREE.BoxGeometry(.08,.08,.08);raw.translate(.14,1.10,.58);raw.deleteAttribute('normal');raw.deleteAttribute('uv');const source=mergeVertices(raw,1e-7);raw.dispose();source.computeVertexNormals();
  const geometry=source.clone(),before=geometry.toNonIndexed(),sourceIds=source.index.array.slice(),sourcePositions=source.attributes.position.array.slice();let disposed=0;source.addEventListener('dispose',()=>disposed++);
  try{
    const result=resolveSheepShoulderCreases(geometry),after=geometry.toNonIndexed();
    try{
      assert.equal(result.splitCorners,source.index.count);assert.equal(geometry.index.count,source.index.count);assert.deepEqual(after.attributes.position.array,before.attributes.position.array,'no triangle, winding or position is edited to repair shading');
      const p=after.attributes.position,n=after.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
      for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);normal.copy(b).cross(c).normalize();for(let j=0;j<3;j++)assert.ok(normal.dot(a.fromBufferAttribute(n,i+j))>.999999,'each sharp sector follows its actual face');}
      for(let i=0;i<geometry.attributes.position.count;i++){const original=result.originalVertex[i];assert.deepEqual(Array.from(geometry.attributes.position.array.slice(i*3,i*3+3)),Array.from(sourcePositions.slice(original*3,original*3+3)));}
      assert.deepEqual(source.index.array,sourceIds);assert.deepEqual(source.attributes.position.array,sourcePositions);assert.equal(disposed,0);
    }finally{after.dispose();}
    const outside=source.clone();outside.translate(1,0,0);const outsideNormals=outside.attributes.normal.array.slice(),outsideIndex=outside.index.array.slice();try{assert.equal(resolveSheepShoulderCreases(outside).splitCorners,0);assert.deepEqual(outside.attributes.normal.array,outsideNormals);assert.deepEqual(outside.index.array,outsideIndex);}finally{outside.dispose();}
    const sphere=new THREE.IcosahedronGeometry(.06,3);sphere.translate(.14,1.10,.58);sphere.deleteAttribute('uv');const smooth=mergeVertices(sphere,1e-7);sphere.dispose();try{const normals=smooth.attributes.normal.array.slice();assert.equal(resolveSheepShoulderCreases(smooth).splitCorners,0);assert.deepEqual(smooth.attributes.normal.array,normals,'smooth neighbourhoods retain the R3 continuous normals');}finally{smooth.dispose();}
  }finally{before.dispose();geometry.dispose();source.dispose();assert.equal(disposed,1);}
});
