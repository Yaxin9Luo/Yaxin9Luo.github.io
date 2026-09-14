import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createStoneFishPectoralGeometry} from '../src/yuanmingyuan/xieqiqu-stone-fish.js';
import {stoneFishFlankAt} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {createCopperSwallowWingGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {sampleSwallowSurface,swallowBodyProfile} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

const full=new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/full-third/',import.meta.url),summary=JSON.parse(await readFile(new URL('summary.json',full))),sha=b=>createHash('sha256').update(b).digest('hex');
async function unchanged(file){assert.equal(sha(await readFile(new URL('../src/yuanmingyuan/'+file,import.meta.url))),summary.sourceFiles[file],`The local reproduction must still use the measured ${file}`);}

test('the preserved real fin rim fails and a round edge fixes it while retaining every front/back skin vertex',async()=>{
  const file='xieqiqu-stone-fish.js',original=await readFile(new URL('source/world/src/yuanmingyuan/'+file,full),'utf8');assert.equal(sha(original),summary.sourceFiles[file]);
  await unchanged('xieqiqu-sculpture-skin.js');await unchanged('xieqiqu-fish-surface.js');
  // Only module addresses change so the preserved old function can resolve
  // Three and its byte-identical dependencies outside world/node_modules.
  const source=original.replace("from 'three'",`from '${new URL('../node_modules/three/build/three.module.js',import.meta.url)}'`).replace(/from '\.\/(xieqiqu-(?:sculpture-skin|fish-surface)\.js)'/g,(_,name)=>`from '${new URL('../src/yuanmingyuan/'+name,import.meta.url)}'`),old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(const side of [-1,1]){const before=old.createStoneFishPectoralGeometry(side),after=createStoneFishPectoralGeometry(side);try{const a=inspectClosedSculptureGeometry(before),b=inspectClosedSculptureGeometry(after);assert.equal(a.inwardShadingFaces,side<0?5:8);assert.equal(b.inwardShadingFaces,0);assert.equal(b.degenerateFaces,0);assert.equal(b.boundaryEdges,0);assert.equal(b.nonManifoldEdges,0);assert.equal(b.inconsistentWindingEdges,0);assert.equal(b.euler,2);assert.ok(b.signedVolume>0);for(const name of ['position','uv'])assert.deepEqual(after.attributes[name].array.subarray(0,before.attributes[name].array.length),before.attributes[name].array);const retained=before.index.count-before.userData.outlineSamples*6;assert.deepEqual(after.index.array.subarray(0,retained),before.index.array.subarray(0,retained));let roots=0;for(let i=0;i<after.attributes.position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(after.attributes.position,i);if(p.z<.573)continue;roots++;assert.ok(Math.abs(p.x)<stoneFishFlankAt(p.y,p.z).position.x,'rounded root stays beneath the true smooth flank');}assert.ok(roots>20);console.log('FISH_ROUNDED_RIM '+JSON.stringify({side,oldBad:a.inwardShadingFaces,newBad:b.inwardShadingFaces,minDot:b.minimumFaceNormalDot,triangles:b.triangles,roots}));}finally{before.dispose();after.dispose();}}
});

test('both measured posterior wing failures are repaired against a local patch on the real body lattice',async()=>{
  await unchanged('xieqiqu-swallow-surface.js');const measured=JSON.parse(await readFile(new URL('swallow/results.json',full))),positions=[],indices=[],steps=Math.ceil((.455+.366)/.0015),start=Math.floor((.455-.075)/(.455+.366)*steps),end=Math.ceil((.455+.135)/(.455+.366)*steps),columns=129;
  for(let i=start;i<=end;i++)for(let j=0;j<columns;j++)positions.push(...sampleSwallowSurface(.455-(.455+.366)*i/steps,j/256*Math.PI*2).position.toArray());for(let i=0;i<end-start;i++)for(let j=0;j<columns-1;j++){const a=i*columns+j,b=a+1,c=b+columns,d=a+columns;indices.push(a,d,b,b,d,c);}const patch=new THREE.BufferGeometry();patch.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));patch.setIndex(indices);const tree=new MeshBVH(patch,{indirect:true}),ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,1,0));
  try{let measuredOutside=0;for(const record of measured.rootContact)for(const failure of record.failed){ray.origin.fromArray(failure.point);if(tree.raycastFirst(ray,THREE.DoubleSide)===null)measuredOutside++;}assert.equal(measuredOutside,4,'exact points from both previous full wings remain outside the unchanged body');for(const side of [-1,1]){const wing=createCopperSwallowWingGeometry(side);try{let roots=0;for(let i=0;i<wing.attributes.position.count;i++){ray.origin.fromBufferAttribute(wing.attributes.position,i);const p=ray.origin;if(Math.abs(p.x)>.085||p.z<-.10||p.z>.04)continue;roots++;assert.ok(p.y>swallowBodyProfile(p.z).centerY);const hit=tree.raycastFirst(ray,THREE.DoubleSide);assert.ok(hit&&hit.face.normal.y>0,JSON.stringify({side,point:p.toArray()}));}assert.equal(roots,14);console.log('SWALLOW_ROOT '+JSON.stringify({side,roots,buried:true}));}finally{wing.dispose();}}}finally{patch.dispose();}
});
