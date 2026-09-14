import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createContinuousSwallowBody,sampleSwallowSurface} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {createCopperSwallowLegGeometry,createCopperSwallowToeGeometry,createCopperSwallowWingGeometry,copperSwallowComponentSpecs} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {swallowWingFeatherSpecs} from '../src/yuanmingyuan/xieqiqu-swallow-feathers.js';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';
import {inspectClosedSculptureGeometry} from './inspect-xieqiqu-fish-swallow.mjs';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

const destination=path.resolve(process.argv[2]??'');if(!process.argv[2])throw new Error('Supply a new local inspection directory');await mkdir(destination,{recursive:false});
const started=performance.now(),materialOwner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']),results=[];
function chestPatch(){const sides=256,fullSteps=Math.ceil((.455+.366)/.0015),positions=[],uv=[],indices=[];for(let i=110;i<=300;i++)for(let j=-64;j<=64;j++){const p=sampleSwallowSurface(.455-(.455+.366)*i/fullSteps,j/sides*Math.PI*2).position;positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);}for(let i=0;i<190;i++)for(let j=0;j<128;j++){const a=i*129+j,b=a+1,c=b+129,d=a+129;indices.push(a,d,b,b,d,c);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData={openLocalDiagnosticPatch:true,actualProductionLattice:true,fullBodyConstructed:false};return g;}
const parts=[
  {id:'head',make:()=>[{name:'partial-head-and-neck',geometry:createContinuousSwallowBody({endZ:.28}),role:'copper'},...[-1,1].map(side=>({name:'eye-'+side,geometry:copperSwallowComponentSpecs.find(s=>s.id==='eye-'+side).create(),role:'copperRecess'}))],views:{front:{direction:[.24,.13,1]},side:{direction:[1,.12,.28]}}},
  {id:'chest-patch',make:()=>[{name:'open-right-chest-patch',geometry:chestPatch(),role:'copper'}],views:{oblique:{direction:[1,.32,.25]}}},
  {id:'ankle',make:()=>[{name:'right-leg',geometry:createCopperSwallowLegGeometry(1),role:'copper'},...[-1,0,1,2].map(toe=>({name:'toe-'+toe,geometry:createCopperSwallowToeGeometry(1,toe),role:'copper'}))],views:{oblique:{direction:[.55,.32,1],crop:{min:[0,0,0],max:[1,.30,1]}}}},
  {id:'wing-root',make:()=>[{name:'right-wing',geometry:createCopperSwallowWingGeometry(1),role:'copper'},...swallowWingFeatherSpecs(1).filter(s=>s.id.startsWith('secondary-1-')||s.id.startsWith('covert-1-0-')).slice(0,9).map(s=>({name:s.id,geometry:s.create(),role:s.role}))],views:{oblique:{direction:[.35,.45,1],crop:{min:[0,0,.30],max:[.53,1,1]}}}},
];
try{for(const part of parts){const group=new THREE.Group(),created=[],events=new Map(),entry={id:part.id,localOnly:true,checks:[]};try{for(const meshPart of part.make()){const geometry=meshPart.geometry;created.push(geometry);events.set(geometry,0);geometry.addEventListener('dispose',()=>events.set(geometry,events.get(geometry)+1));const mesh=new THREE.Mesh(geometry,materialOwner.materials[meshPart.role]);mesh.name=meshPart.name;group.add(mesh);entry.checks.push({name:mesh.name,...inspectClosedSculptureGeometry(geometry)});}entry.cpu=await inspectSculptureCPU({group},path.join(destination,part.id),{viewSpecs:part.views,size:2048});}finally{for(const geometry of created)geometry.dispose();group.clear();entry.geometryResources={count:created.length,eachDisposedOnce:[...events.values()].every(n=>n===1)};}results.push(entry);}}
finally{materialOwner.dispose();}
const summary={localOnly:true,fullOwnerConstructed:false,sourceMaterialBorrowed:true,native:false,results,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024};await writeFile(path.join(destination,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({directory:destination,seconds:summary.seconds,maxRSSBytes:summary.maxRSSBytes,parts:results.map(r=>({id:r.id,triangles:r.checks.reduce((n,c)=>n+c.triangles,0),bad:r.checks.filter(c=>c.degenerateFaces||c.inwardShadingFaces),resources:r.geometryResources}))}));
