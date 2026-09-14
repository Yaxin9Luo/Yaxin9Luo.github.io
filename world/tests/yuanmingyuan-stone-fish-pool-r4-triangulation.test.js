import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {repairWarpTriangulation} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r4-triangulation.js';

const captured=JSON.parse(readFileSync(new URL('./fixtures/xieqiqu-stone-fish-pool-r4-warp-patch.json',import.meta.url)));
function normalAgreement(positions,indices){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  try{const p=g.attributes.position,n=g.attributes.normal,faces=[];let minimum=1;
    for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),v=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id)),face=new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).normalize(),average=ids.reduce((sum,id)=>sum.add(new THREE.Vector3().fromBufferAttribute(n,id)),new THREE.Vector3()).normalize(),dot=face.dot(average);faces.push(dot);minimum=Math.min(minimum,dot);}return {minimum,faces};
  }finally{g.dispose();}
}
function boundary(indices){
  const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b),e=edges.get(key)??{count:0,balance:0};e.count++;e.balance+=a<b?1:-1;edges.set(key,e);}
  return [...edges].filter(([,e])=>e.count===1).sort(([a],[b])=>a.localeCompare(b));
}

test('R4 repairs the captured warped sliver by one interior diagonal, without moving a Float32 point or changing the boundary',()=>{
  const positions=Float32Array.from(captured.positions),before=positions.slice(),indices=[...captured.indices],oldBoundary=boundary(indices),oldCount=indices.length;
  assert(normalAgreement(positions,indices).minimum<-.1,'fixture must reproduce the real local fold');
  const repairs=repairWarpTriangulation(indices,positions);assert.equal(repairs.length,1);assert.deepEqual(positions,before);assert.equal(indices.length,oldCount);assert.deepEqual(boundary(indices),oldBoundary);
  assert(repairs[0].quality>repairs[0].oldQuality);const normals=normalAgreement(positions,indices);assert(normals.minimum>0,'no actual field face may point against its vertex normals');for(const offset of [repairs[0].first,repairs[0].second])assert(normals.faces[offset/3]>.9,'the two repaired faces must follow the local smooth surface');
});

test('R4 leaves the repaired local surface unchanged on a second check and rejects a degenerate face',()=>{
  const positions=Float32Array.from(captured.positions),indices=[...captured.indices];repairWarpTriangulation(indices,positions);const before=[...indices];assert.deepEqual(repairWarpTriangulation(indices,positions),[]);assert.deepEqual(indices,before);
  assert.throws(()=>repairWarpTriangulation([0,0,0],positions),/degenerate warped field face/);
});
