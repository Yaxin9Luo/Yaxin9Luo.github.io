import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createFineTerrainLand} from '../src/yuanmingyuan/terrain-patch-owner.js';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {shoreBankSpec,interpolateShoreAttribute} from '../src/yuanmingyuan/shore-bank-geometry.js';
import {createShoreBankR4ColourCollar,shoreBankR4ColourCollarWidth,createShoreBankR4Ground} from '../src/yuanmingyuan/shore-bank-r4-geometry.js';

const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const maximumDifference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
function grid(xs,zs,height,colour){
  const p=[],c=[],uv=[],index=[];
  for(const z of zs)for(const x of xs){p.push(x,height(x,z),z);c.push(...colour(x,z));uv.push(x*.08,z*.08);}
  for(let z=0;z<zs.length-1;z++)for(let x=0;x<xs.length-1;x++){const a=z*xs.length+x,b=a+1,d=a+xs.length,e=d+1;index.push(a,d,b,b,d,e);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={sourceTriangleIndices:Array.from({length:index.length/3},(_,i)=>i),sourceVertexIndices:Array.from({length:p.length/3},(_,i)=>i)};return g;
}

test('all fixed edges continue their actual piecewise triangle RGB while the interior keeps the target',()=>{
  const source=grid([-2,0,2],[-1,0,1],(x,z)=>2+.04*x+.1*z,(x,z)=>[.3+.07*x,.24+.03*z,.12+.02*x*z]),sampler=createTriangleSampler([source]),collar=createShoreBankR4ColourCollar(source);
  const expected=(x,z)=>{const hit=sampler.sample(x,z);return interpolateShoreAttribute(source,hit.triangleIndex,x,z,'color');};
  try{
    for(const [x,z]of [[-2,-1],[-2,0],[-2,.5],[2,-1],[2,.5],[2,1],[-1,-1],[.5,-1],[0,1],[1.5,1]])assert(maximumDifference(collar.blend(x,z,new THREE.Color(.01,.02,.03)).toArray(),expected(x,z))<1e-12);
    for(const x of [-.9,0,.9]){const target=new THREE.Color(.09+.01*x,.05,.025),before=target.toArray();assert.equal(collar.blend(x,0,target),target);assert.deepEqual(target.toArray(),before);}
    // At the far edge of the collar both its value and slope approach the
    // unmodified target. The whole shore colour field is not flattened.
    for(const delta of [.001,.0001]){const target=[.08,.05,.03],value=collar.blend(0,1-shoreBankR4ColourCollarWidth+delta,new THREE.Color(...target));assert(maximumDifference(value.toArray(),target)<delta*delta);}
  }finally{collar.dispose();sampler.dispose();source.dispose();}
});

test('actual refiner no longer squeezes a nonlinear colour jump into a sub-millimetre fixed-edge fan',()=>{
  const source=grid([8,12],[.72,.8],()=>2,(x,z)=>[.13+.1*(x-8),.10+.11*(x-8),.06+.075*(x-8)]),collar=createShoreBankR4ColourCollar(source),fine=[];
  const target=(x,z)=>new THREE.Color(.13+.1*(x-8),.10+.11*(x-8),.06+.075*(x-8)).multiplyScalar(1-.67*Math.sin((x-8)/4*Math.PI));
  try{
    for(const useCollar of [false,true])fine.push(createFineTerrainLand(source,{edgeLength:.15,heightAt:()=>2,colorAt:(x,y,z)=>useCollar?collar.blend(x,z,target(x,z)):target(x,z)}));
    const [before,after]=fine;assert.deepEqual(bytes(after.index.array),bytes(before.index.array));for(const name of ['position','normal','uv'])assert.deepEqual(bytes(after.attributes[name].array),bytes(before.attributes[name].array));
    assert.notDeepEqual(bytes(after.attributes.color.array),bytes(before.attributes.color.array));
    for(const {fine:i,coarse:j}of after.userData.boundaryCopies)assert.deepEqual(new THREE.Color().fromBufferAttribute(after.attributes.color,i).toArray(),new THREE.Color().fromBufferAttribute(source.attributes.color,j).toArray());
    const ids=[2,3].map(j=>after.userData.boundaryCopies.find(v=>v.coarse===j).fine);let third;
    for(let i=0;i<after.index.count;i+=3){const face=[0,1,2].map(j=>after.index.getX(i+j));if(ids.every(id=>face.includes(id))){third=face.find(id=>!ids.includes(id));break;}}
    assert(Number.isInteger(third));const p=after.attributes.position,x=p.getX(third),z=p.getZ(third),distance=.8-z,expected=[.13+.1*(x-8),.10+.11*(x-8),.06+.075*(x-8)];
    const oldDifference=maximumDifference(new THREE.Color().fromBufferAttribute(before.attributes.color,third).toArray(),expected),nextDifference=maximumDifference(new THREE.Color().fromBufferAttribute(after.attributes.color,third).toArray(),expected);
    assert(distance>0&&distance<.001);assert(oldDifference>.03);assert(nextDifference<1e-6);assert(nextDifference/distance<.01);
  }finally{for(const g of fine)g.dispose();collar.dispose();source.dispose();}
});

test('R4 small full geometry retains index, position, normals, UV and exact support against the frozen pre-fix factory',async()=>{
  const url=new URL('../../work/yuanmingyuan/shore-bank-r4/colour-seam-fix/source-before/shore-bank-r4-geometry.js',import.meta.url),source=readFileSync(url,'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),'7406644a8da90617f6e66b438c0c66af6db2dd5bcabdde4c026e3dbb2aa85871');
  const rewritten=source.replace("from 'three'",`from '${import.meta.resolve('three')}'`).replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL('../src/yuanmingyuan/'+p.slice(2),import.meta.url).href}'`),beforeFactory=(await import('data:text/javascript;base64,'+Buffer.from(rewritten).toString('base64'))).createShoreBankR4Ground;
  const land=grid([-4,-2,0,2,4],[0,.4,.8,1.5],(x,n)=>2+.1*n,()=>[.3,.4,.2]),bed=grid([-4,-2,0,2,4],[-4.5,-3.5,-2,0],(x,n)=>2+.15*n,()=>[.3,.4,.2]);land.userData.body='land';bed.userData.body='lake-bed';
  const spec={...shoreBankSpec,originXZ:[0,0],tangentXZ:[1,0],inlandXZ:[0,1],halfLength:3,edgeLength:.5},created=[],samplers=[];
  try{
    const a=beforeFactory({land,bed,spec});created.push(a);const b=createShoreBankR4Ground({land,bed,spec});created.push(b);
    assert.deepEqual(bytes(a.geometry.index.array),bytes(b.geometry.index.array));for(const name of ['position','normal','uv'])assert.deepEqual(bytes(a.geometry.attributes[name].array),bytes(b.geometry.attributes[name].array));assert.notDeepEqual(bytes(a.geometry.attributes.color.array),bytes(b.geometry.attributes.color.array));
    for(const [i,part]of a.sources.entries()){assert.deepEqual(bytes(part.retainedGeometry.index.array),bytes(b.sources[i].retainedGeometry.index.array));for(const name of Object.keys(part.retainedGeometry.attributes))assert.deepEqual(bytes(part.retainedGeometry.attributes[name].array),bytes(b.sources[i].retainedGeometry.attributes[name].array));}
    for(const r of created)samplers.push(createTriangleSampler([r.geometry]));
    for(let x=-2.75;x<=2.75;x+=.25)for(let z=-3.25;z<=.75;z+=.25){const hits=samplers.map(s=>s.sample(x,z));assert.equal(hits[0]?.height,hits[1]?.height);assert.deepEqual(hits[0]?.normal,hits[1]?.normal);assert.equal(hits[0]?.triangleIndex,hits[1]?.triangleIndex);}
    assert.equal(b.diagnostics.colourCollar.width,.45);assert.deepEqual(b.diagnostics.colourCollar.changedAttributes,['color']);
  }finally{for(const s of samplers)s.dispose();for(const owner of created)for(const g of owner.geometries)g.dispose();land.dispose();bed.dispose();}
});

test('colour sampler disposal owns no borrowed geometry, rejects subsequent use and validates its narrow boundary',()=>{
  const source=grid([-1,1],[-1,1],()=>2,()=>[.3,.4,.2]),before=bytes(source.attributes.color.array).toString('hex');let disposed=0;source.addEventListener('dispose',()=>disposed++);
  try{assert.throws(()=>createShoreBankR4ColourCollar(source,NaN),/invalid/);const collar=createShoreBankR4ColourCollar(source);assert.throws(()=>collar.blend(1.01,0,new THREE.Color()),/leaves the source/);collar.blend(0,.99,new THREE.Color());collar.dispose();collar.dispose();assert.equal(disposed,0);assert.equal(bytes(source.attributes.color.array).toString('hex'),before);assert.throws(()=>collar.blend(0,.99,new THREE.Color()),/disposed/);}finally{source.dispose();}assert.equal(disposed,1);
});
