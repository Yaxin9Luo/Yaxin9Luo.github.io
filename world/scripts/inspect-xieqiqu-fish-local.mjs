import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createStoneFishPectoralGeometry} from '../src/yuanmingyuan/xieqiqu-stone-fish.js';
import {sampleStoneFishSurface} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

const directory=path.resolve(process.argv[2]??'');if(!process.argv[2])throw new Error('Supply a new local inspection directory');await mkdir(directory,{recursive:false});const start=performance.now(),group=new THREE.Group(),materialOwner=createXieqiquSculptureMaterialOwner(['carving']),geometries=[],events=new Map(),images=[];
try{
  const positions=[],indices=[],uv=[],from=Math.floor(.18*1280),to=Math.ceil(.43*1280);for(let i=from;i<=to;i++)for(let j=-64;j<=64;j++){const p=sampleStoneFishSurface(i/1280,j/512*Math.PI*2).position;positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);}for(let i=0;i<to-from;i++)for(let j=0;j<128;j++){const a=i*129+j,b=a+1,c=b+129,d=a+129;indices.push(a,d,b,b,d,c);}const patch=new THREE.BufferGeometry();patch.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));patch.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));patch.setIndex(indices);patch.computeVertexNormals();patch.userData={openLocalDiagnosticPatch:true,actualProductionLattice:true,fullBodyConstructed:false};const fin=createStoneFishPectoralGeometry(1);
  for(const geometry of [patch,fin]){geometries.push(geometry);events.set(geometry,0);geometry.addEventListener('dispose',()=>events.set(geometry,events.get(geometry)+1));const mesh=new THREE.Mesh(geometry,materialOwner.materials.carving);mesh.name=geometry===patch?'open-flank-patch':'round-pectoral-fin';group.add(mesh);}
  images.push(await inspectSculptureCPU({group},path.join(directory,'join'),{viewSpecs:{oblique:{direction:[1,.25,.30]}},size:2048}));group.remove(group.children.find(m=>m.geometry===patch));images.push(await inspectSculptureCPU({group},path.join(directory,'isolated-fin'),{viewSpecs:{back:{direction:[-1,.25,-.15]}},size:2048}));
}finally{group.clear();for(const geometry of geometries)geometry.dispose();materialOwner.dispose();}
const result={localOnly:true,fullOwnerConstructed:false,native:false,images,geometries:{count:geometries.length,eachDisposedOnce:[...events.values()].every(n=>n===1)},seconds:(performance.now()-start)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024};await writeFile(path.join(directory,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({directory,seconds:result.seconds,maxRSSBytes:result.maxRSSBytes,geometries:result.geometries}));
