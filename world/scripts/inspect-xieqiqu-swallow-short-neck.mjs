import * as THREE from 'three';
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createContinuousSwallowBody,sampleSwallowSurface,swallowBodyProfile} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {applySwallowPose,poseSwallowBodyPoint,swallowPoseLegSections} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {poseShortNeckBodyPoint,createSwallowShortNeckLocalGeometry,swallowShortNeckFountainContract,swallowShortNeckParameters} from '../src/yuanmingyuan/xieqiqu-swallow-neck-pose.js';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

if(!process.argv[2])throw new Error('Supply a new local short-neck review directory');
const destination=path.resolve(process.argv[2]);await mkdir(destination,{recursive:false});
const started=performance.now(),sha=b=>createHash('sha256').update(b).digest('hex'),files=['src/yuanmingyuan/xieqiqu-swallow-neck-pose.js','src/yuanmingyuan/xieqiqu-swallow-pose.js','src/yuanmingyuan/xieqiqu-swallow-surface.js','src/yuanmingyuan/xieqiqu-study.js','scripts/inspect-xieqiqu-swallow-short-neck.mjs','scripts/xieqiqu-sculpture-cpu-review.mjs'],source={};
for(const file of files){const bytes=await readFile(new URL('../'+file,import.meta.url));source[file]=sha(bytes);const target=path.join(destination,'source/world',file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
const materialOwner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']),events=new Map(),results=[],curves={previous:[],candidate:[]};
const track=r=>{events.set(r,0);r.addEventListener('dispose',()=>events.set(r,events.get(r)+1));};
for(const material of Object.values(materialOwner.materials)){if(!events.has(material))track(material);for(const value of Object.values(material))if(value?.isTexture&&!events.has(value))track(value);}
try{
  for(const kind of ['previous','candidate']){
    const transform=kind==='previous'?poseSwallowBodyPoint:poseShortNeckBodyPoint,geometry=kind==='previous'?applySwallowPose(createContinuousSwallowBody({endZ:.10}),'body'):createSwallowShortNeckLocalGeometry({endZ:.10}),group=new THREE.Group();track(geometry);
    try{
      const mesh=new THREE.Mesh(geometry,materialOwner.materials.copper);mesh.name=kind+'-local-neck-with-artificial-rear-cut';group.add(mesh);
      const cpu=await inspectSculptureCPU({group},path.join(destination,kind),{size:2048,viewSpecs:{side:{direction:[1,.025,.03]},threequarter:{direction:[.8,.30,1]},front:{direction:[.025,.12,1]}}});
      results.push({kind,triangles:geometry.index.count/3,wholeBodyConstructed:false,actualLocalEndZ:.10,artificialRearCap:true,cpu});
      // Whole-body diagrams use analytic contours only. The complete beak
      // outline comes from the retained real local mesh rings, not a sketch.
      const p=geometry.attributes.position,sides=geometry.userData.sides;
      for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        const ringColumn=Math.round(angle/(2*Math.PI)*sides),beak=Array.from({length:113},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,1+(51+i)*sides+ringColumn).toArray()),body=Array.from({length:240},(_,i)=>transform(sampleSwallowSurface(.455-(.455+.366)*i/239,angle,{detail:false}).position).toArray());
        curves[kind].push([...beak,...body]);
      }
    }finally{geometry.dispose();group.clear();}
  }
}finally{materialOwner.dispose();}
const center=new THREE.Vector3(0,.35,.10),project=point=>{const p=new THREE.Vector3(...point).sub(center);return [p.z*880,-p.y*880];};
function panel(kind,x,y){
  const w=984,h=680,colour=kind==='previous'?'#8a7b72':'#567667',lines=curves[kind].map(points=>'<path d="'+points.map((p,i)=>{const v=project(p);return (i?'L':'M')+(x+w/2+v[0]).toFixed(2)+' '+(y+h/2+v[1]).toFixed(2);}).join(' ')+'" fill="none" stroke="'+colour+'" stroke-width="3"/>'),mouth=project(kind==='previous'?swallowShortNeckFountainContract.previousAnchor:swallowShortNeckFountainContract.mouthAnchor);
  for(const sign of [-1,1]){const points=swallowPoseLegSections(sign).map(p=>p.slice(0,3));lines.push('<path d="'+points.map((p,i)=>{const v=project(p);return (i?'L':'M')+(x+w/2+v[0]).toFixed(2)+' '+(y+h/2+v[1]).toFixed(2);}).join(' ')+'" fill="none" stroke="'+colour+'" stroke-width="5"/>');}
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#fffdf8" stroke="#d9d2c8"/><text x="${x+24}" y="${y+44}" fill="#322e28" font-size="25">${kind==='previous'?'Previous complete candidate':'Short-neck authoring proposal'} · side</text>${lines.join('')}<circle cx="${x+w/2+mouth[0]}" cy="${y+h/2+mouth[1]}" r="7" fill="${kind==='previous'?'#b36249':'#2377a2'}"/><text x="${x+24}" y="${y+h-26}" fill="#70695e" font-size="19">Same metre scale; wings omitted; circle = actual local outlet</text></g>`;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="860" viewBox="0 0 2048 860"><rect width="2048" height="860" fill="#ede7db"/><g font-family="sans-serif"><text x="40" y="54" fill="#302c25" font-size="32">Copper bird · neck and shoulder proportion study</text><text x="40" y="91" fill="#6a6255" font-size="21">Head and beak move as one region. Authored proportions; no historical pose or species claim.</text>${panel('previous',30,116)}${panel('candidate',1034,116)}</g></svg>`;
await writeFile(path.join(destination,'proportions.svg'),svg);const png=await sharp(Buffer.from(svg)).png().toBuffer();await writeFile(path.join(destination,'proportions.png'),png);
const measure=transform=>{const point=z=>{const p=swallowBodyProfile(z);return transform(new THREE.Vector3(0,p.centerY,z));},torso=point(.015),head=point(.362);return {authorTorsoCenter:torso.toArray(),authorHeadCenter:head.toArray(),verticalDifference:head.y-torso.y,centerDistance:head.distanceTo(torso)};};
const after={};for(const file of files)after[file]=sha(await readFile(new URL('../'+file,import.meta.url)));
const report={native:false,wholeOwnerConstructed:false,wholeBodyConstructed:false,parameters:swallowShortNeckParameters,fountainContract:swallowShortNeckFountainContract,source,sourceAfter:after,sourceUnchanged:JSON.stringify(source)===JSON.stringify(after),measurements:{previous:measure(poseSwallowBodyPoint),candidate:measure(poseShortNeckBodyPoint),meaning:'author-defined cross-section centres; not measured anatomical landmarks'},resources:{tracked:events.size,geometry:[...events.keys()].filter(r=>r.isBufferGeometry).length,disposedExactlyOnce:[...events.values()].every(n=>n===1)},diagram:{file:'proportions.png',width:2048,height:860,pngSHA256:sha(png),analyticBodyContours:true,realLocalBeakContours:true,notNative:true},results,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024};
await writeFile(path.join(destination,'summary.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({destination,seconds:report.seconds,maxRSSBytes:report.maxRSSBytes,resources:report.resources,sourceUnchanged:report.sourceUnchanged,measurements:report.measurements}));
