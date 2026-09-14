import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {sampleStoneFishSurface} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {createStoneFishTailGeometry} from '../src/yuanmingyuan/xieqiqu-stone-fish.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

function actualLocalTailPatch(sample){
  // Actual production parameter coordinates on both sides of the known fold.
  // Only 13 rows are constructed, not the full fish or material owner.
  const start=288,end=300,sides=128,positions=[],indices=[];
  for(let i=start;i<=end;i++)for(let j=0;j<sides;j++)positions.push(...sample(i/320,j/sides*Math.PI*2).position.toArray());
  for(let i=0;i<end-start;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,d,b,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

test('the preserved first-full fold fails locally and the revised terminal curve has outward real face shading',async()=>{
  const base=new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/full-first/',import.meta.url),summary=JSON.parse(await readFile(new URL('summary.json',base),'utf8')),source=await readFile(new URL('source/world/src/yuanmingyuan/xieqiqu-fish-surface.js',base),'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'),summary.sourceFiles['xieqiqu-fish-surface.js']);
  // Import the exact preserved model; only its bare Three import is resolved for
  // a data module. The original text and SHA remain in the failure directory.
  const resolved=source.replace("from 'three'",`from '${import.meta.resolve('three')}'`),old=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
  const before=actualLocalTailPatch(old.sampleStoneFishSurface),after=actualLocalTailPatch(sampleStoneFishSurface);
  try{const b=inspectClosedSculptureGeometry(before),a=inspectClosedSculptureGeometry(after);assert.equal(b.inwardShadingFaces,14);assert.ok(b.minimumFaceNormalDot<-.9);assert.equal(a.inwardShadingFaces,0);assert.equal(a.degenerateFaces,0);assert.ok(a.minimumFaceNormalDot>.3);console.log('FISH_TERMINAL_PATCH '+JSON.stringify({before:b,after:a}));}finally{before.dispose();after.dispose();}
});

test('the actual terminal body cap lies within the curved caudal fin rather than hovering above it',()=>{
  const fin=createStoneFishTailGeometry(),tree=new MeshBVH(fin,{indirect:true}),directions=[new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)];
  try{for(let i=0;i<128;i++){const point=sampleStoneFishSurface(1,i/128*Math.PI*2).position;
    for(const direction of directions){const hit=tree.raycastFirst(new THREE.Ray(point,direction),THREE.DoubleSide);assert.ok(hit&&hit.face.normal.dot(direction)>0,'actual cap perimeter '+i+' must be buried in the fin');}
  }}finally{fin.dispose();}
});
