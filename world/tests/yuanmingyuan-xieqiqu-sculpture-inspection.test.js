import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {inspectClosedSculptureGeometry} from '../scripts/inspect-xieqiqu-fish-swallow.mjs';

test('inspection measures real indexed and non-indexed closed solids and detects a removed face',()=>{
  const g=new THREE.BoxGeometry(1,2,3),expanded=g.toNonIndexed();
  try{for(const geometry of [g,expanded]){const r=inspectClosedSculptureGeometry(geometry);assert.equal(r.uniqueExactPositions,8);assert.equal(r.signedVolume,6);assert.equal(r.euler,2);assert.equal(r.boundaryEdges,0);assert.equal(r.inwardShadingFaces,0);}
    const original=g.index.array;g.setIndex(Array.from(original.slice(3)));const open=inspectClosedSculptureGeometry(g);assert.equal(open.boundaryEdges,3);assert.equal(open.euler,1);
  }finally{g.dispose();expanded.dispose();}
});

test('inspection retains degenerate triangles and detects normals opposite actual winding',()=>{
  const g=new THREE.BoxGeometry(1,1,1),normal=g.attributes.normal;
  try{for(let i=0;i<normal.array.length;i++)normal.array[i]*=-1;const r=inspectClosedSculptureGeometry(g);assert.equal(r.inwardShadingFaces,12);assert.equal(r.signedVolume,1);g.setIndex([...g.index.array,0,0,1]);const bad=inspectClosedSculptureGeometry(g);assert.equal(bad.degenerateFaces,1);assert.equal(bad.triangles,13);assert.ok(bad.nonManifoldEdges>0);}finally{g.dispose();}
});
