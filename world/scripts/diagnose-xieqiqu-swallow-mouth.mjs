import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectClosedSculptureGeometry} from './inspect-xieqiqu-fish-swallow.mjs';

// Diagnostic only: evaluate the preserved body's scalar field in a 48^3 mouth
// window at the ORIGINAL full-grid sample spacing. No sculpture/material owner
// or full field is constructed. Window-cut boundary faces are not source faces.
const base=fileURLToPath(new URL('../../work/yuanmingyuan/xieqiqu-fish-swallow-r3/full-second/',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const bird=await readFile(path.join(base,'source/world/src/yuanmingyuan/xieqiqu-copper-swallow.js'),'utf8'),shared=await readFile(path.join(base,'source/world/src/yuanmingyuan/yuanyingguan-geometry.js'),'utf8'),summary=JSON.parse(await readFile(path.join(base,'summary.json'),'utf8'));
if(hash(bird)!==summary.sourceFiles['xieqiqu-copper-swallow.js']||hash(shared)!==summary.sourceFiles['yuanyingguan-geometry.js'])throw new Error('Preserved failure sources no longer match their recorded SHA');
const body=bird.slice(bird.indexOf('export function createCopperSwallowBodyGeometry()'),bird.indexOf('export function createCopperSwallowLegGeometry')).replace(/^export /,''),configuration=Function('blendedEllipsoids',body+'; return createCopperSwallowBodyGeometry();')((shapes,options)=>({shapes,options}));
const frames=shared.slice(shared.indexOf('function transportedFrames('),shared.indexOf('export function organicLoft(')),segments=shared.slice(shared.indexOf('function continuousSweepSegments('),shared.indexOf('export function sculptureNeckSections('));
const prepareSweep=Function('THREE','V',frames+'\n'+segments+'\nreturn continuousSweepSegments;')(THREE,(...a)=>new THREE.Vector3(...a));
const {resolution:fullResolution,blend,cutouts,sweeps}=configuration.options,pad=blend+.065;
const prepare=part=>{const e=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(part.rotation??[0,0,0]))).elements,axes=[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]],extent=[0,1,2].map(i=>Math.sqrt(axes.reduce((sum,axis,j)=>sum+(axis[i]*part.radii[j])**2,0)));return {...part,axes,extent};};
const shapes=configuration.shapes.map(prepare),holes=cutouts.map(prepare),sweepParts=sweeps.map(prepareSweep),all=[...shapes,...sweepParts.flat()],minimum=[0,1,2].map(i=>Math.min(...all.map(p=>p.center[i]-p.extent[i]))-pad),maximum=[0,1,2].map(i=>Math.max(...all.map(p=>p.center[i]+p.extent[i]))+pad),fullSize=maximum.map((v,i)=>v-minimum[i]),step=fullSize.map(v=>v/fullResolution),size=48,focus=[0,.587,.55],offset=focus.map((v,i)=>Math.floor((v-minimum[i])/step[i])-24),windowMinimum=minimum.map((v,i)=>v+offset[i]*step[i]),material=new THREE.MeshBasicMaterial(),marching=new MarchingCubes(size,material,false,false,40000);
marching.isolation=0;marching.field.fill(-.25);const started=performance.now();
const distance=(p,x,y,z)=>{const d=[x-p.center[0],y-p.center[1],z-p.center[2]],q=p.axes.map((a,i)=>(d[0]*a[0]+d[1]*a[1]+d[2]*a[2])/p.radii[i]),k0=Math.hypot(...q),k1=Math.hypot(...q.map((v,i)=>v/p.radii[i]));return k1>1e-9?k0*(k0-1)/k1:-Math.min(...p.radii);};
const visit=(p,fn)=>{const lo=[0,1,2].map(i=>Math.max(1,Math.max(1,Math.floor((p.center[i]-p.extent[i]-pad-minimum[i])/step[i]))-offset[i])),hi=[0,1,2].map(i=>Math.min(size-2,Math.min(fullResolution-2,Math.ceil((p.center[i]+p.extent[i]+pad-minimum[i])/step[i]))-offset[i]));for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)fn(x+size*(y+size*z),minimum[0]+(x+offset[0])*step[0],minimum[1]+(y+offset[1])*step[1],minimum[2]+(z+offset[2])*step[2]);};
const unite=(previous,d)=>{const h=Math.max(blend-Math.abs(previous-d),0)/blend;return Math.min(previous,d)-h*h*blend*.25;};let g;
try{
  for(const p of shapes)visit(p,(at,x,y,z)=>{marching.field[at]=-unite(-marching.field[at],distance(p,x,y,z));});
  for(const parts of sweepParts){const field=new Float32Array(marching.field.length).fill(.25);for(const p of parts)visit(p,(at,x,y,z)=>{const d=p.distance(x,y,z);if(d<field[at])field[at]=d;});for(let i=0;i<field.length;i++)if(field[i]<.25)marching.field[i]=-unite(-marching.field[i],field[i]);}
  for(const p of holes)visit(p,(at,x,y,z)=>{marching.field[at]=-Math.max(-marching.field[at],-distance(p,x,y,z));});
  marching.update();if(marching.count>=40000*3)throw new Error('Bounded mouth diagnostic output unexpectedly exceeds allocated buffer');
  g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(marching.geometry.attributes.position.array.slice(0,marching.count*3),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(marching.geometry.attributes.normal.array.slice(0,marching.count*3),3));g.scale(...step.map(v=>v*size/2));g.translate(...windowMinimum.map((v,i)=>v+step[i]*size/2));
  const inspection=inspectClosedSculptureGeometry(g),p=g.attributes.position,n=g.attributes.normal,fp=[],fn=[];
  for(let i=0;i<p.count;i+=3){const selected=[i,i+1,i+2].every(j=>Math.abs(p.getX(j))<.05&&p.getY(j)>.55&&p.getY(j)<.62&&p.getZ(j)>.49&&p.getZ(j)<.61);if(selected)for(let j=i;j<i+3;j++){fp.push(p.getX(j),p.getY(j),p.getZ(j));fn.push(n.getX(j),n.getY(j),n.getZ(j));}}
  const focusGeometry=new THREE.BufferGeometry();focusGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));focusGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(fn,3));let focusInspection;try{focusInspection=inspectClosedSculptureGeometry(focusGeometry);}finally{focusGeometry.dispose();}
  const focusFailures=focusInspection.badFaceExamples,report={sourceVerified:true,sourceFiles:summary.sourceFiles,fullResolution,windowResolution:size,fieldCellsConstructed:size**3,fullFieldCellsNotConstructed:fullResolution**3,originalGridSpacing:step,windowGlobalCellOffset:offset,windowMinimum,windowMaximum:windowMinimum.map((v,i)=>v+size*step[i]),sameOriginalFieldLattice:true,positionNote:'Window coordinates undergo a separate Float32 transform; not a byte-identical full geometry extraction.',boundaryNote:'Closed window edges are diagnostic clipping artifacts; only interior focus failures are attributed to the original mouth field.',inspection,focusInspection,focusFailures,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024,fullOwnerConstructed:false,native:false};
  await writeFile(path.join(base,'../swallow-mouth-window-diagnostic-r2.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({windowCells:report.fieldCellsConstructed,originalGridSpacing:step,focusTriangles:focusInspection.triangles,focusFailures,seconds:report.seconds,maxRSSBytes:report.maxRSSBytes}));
}finally{g?.dispose();marching.geometry.dispose();material.dispose();}
