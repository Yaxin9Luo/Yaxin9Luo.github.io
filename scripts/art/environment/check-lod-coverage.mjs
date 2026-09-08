import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../../world/node_modules/three/build/three.module.js';
import {createGroveTree} from '../../../world/src/grove-foliage.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),records=[];
for(const kind of ['silver','pine','cherry']){
  const trees=['near','mid','far'].map(t=>createGroveTree(kind,168,t)),meshes=trees.map(t=>t.leavesMesh),box=new THREE.Box3().setFromObject(meshes[0]),ray=new THREE.Raycaster();meshes.forEach(m=>m.updateMatrixWorld(true));
  for(const axis of ['x','z']){
    const hits=meshes.map(()=>new Set());
    for(let i=0;i<20;i++)for(let j=0;j<24;j++){
      const lateral=THREE.MathUtils.lerp(axis==='z'?box.min.x:box.min.z,axis==='z'?box.max.x:box.max.z,(i+.5)/20),y=THREE.MathUtils.lerp(box.min.y,box.max.y,(j+.5)/24);
      ray.set(axis==='z'?new THREE.Vector3(lateral,y,20):new THREE.Vector3(20,y,lateral),axis==='z'?new THREE.Vector3(0,0,-1):new THREE.Vector3(-1,0,0));
      for(let k=0;k<3;k++)if(ray.intersectObject(meshes[k]).length)hits[k].add(i*24+j);
    }
    const overlap=hits.slice(1).map(h=>{const union=new Set([...hits[0],...h]),intersection=[...h].filter(x=>hits[0].has(x)).length;return {coverage:h.size/hits[0].size,jaccard:intersection/union.size};});
    records.push({kind,axis,samples:480,hits:hits.map(h=>h.size),mid:overlap[0],far:overlap[1],triangles:trees.map(t=>t.children.reduce((s,m)=>s+m.geometry.index.count/3,0))});
    if(overlap.some(o=>o.coverage<.93||o.jaccard<.91))throw new Error(`${kind} ${axis} loses too much opaque canopy: ${JSON.stringify(overlap)}`);
    console.log(JSON.stringify(records.at(-1)));
  }
}
await fs.writeFile(path.join(root,'work/production-v3/foliage-lod-coverage.json'),JSON.stringify({method:'20 x 24 orthographic rays across the same near bounds, two principal axes, seed 168. Real opaque leaf/needle/petal intersections; no screenshots, no camera-facing cards.',records},null,2)+'\n');
