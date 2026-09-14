import * as THREE from 'three';
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createCopperSwallowWingGeometry,createCopperSwallowTailGeometry,createCopperSwallowToeGeometry} from '../src/yuanmingyuan/xieqiqu-copper-swallow.js';
import {swallowWingFeatherSpecs} from '../src/yuanmingyuan/xieqiqu-swallow-feathers.js';
import {sampleSwallowSurface} from '../src/yuanmingyuan/xieqiqu-swallow-surface.js';
import {applySwallowPose,poseSwallowBodyPoint,createBentSwallowLegGeometry,swallowPoseLegSections,swallowPoseMouth,swallowPoseStatus} from '../src/yuanmingyuan/xieqiqu-swallow-pose.js';
import {createXieqiquSculptureMaterialOwner} from '../src/yuanmingyuan/xieqiqu-study.js';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

const destination=path.resolve(process.argv[2]??'');if(!process.argv[2])throw new Error('Supply a new local pose inspection directory');await mkdir(destination,{recursive:false});
const started=performance.now(),sha=b=>createHash('sha256').update(b).digest('hex'),files=['xieqiqu-swallow-pose.js','xieqiqu-copper-swallow.js','xieqiqu-swallow-surface.js','xieqiqu-swallow-feathers.js','xieqiqu-copper-sheep.js','xieqiqu-stone-fish.js'],source=Object.fromEntries(await Promise.all(files.map(async name=>[name,sha(await readFile(new URL('../src/yuanmingyuan/'+name,import.meta.url)))])));
const materialOwner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']),results=[],oldCurves=[],newCurves=[];let owned=0,released=0;
const mirror=points=>points.map(p=>[-p[0],p[1],p[2]]),outline=g=>{const {rings,outlineSamples:sides}=g.userData;return Array.from({length:sides+1},(_,i)=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,1+(rings-1)*sides+i%sides).toArray());};
function bodyPatch({upper=true}={}){
  const fullSteps=Math.ceil((.455+.366)/.0015),first=Math.floor((.455-.20)/(.455+.366)*fullSteps),last=Math.ceil((.455+.15)/(.455+.366)*fullSteps),positions=[],uv=[],ids=[],columns=129;
  for(let i=first;i<=last;i++)for(let j=0;j<columns;j++){const angle=(j+(upper?0:128))/256*Math.PI*2,p=poseSwallowBodyPoint(sampleSwallowSurface(.455-(.455+.366)*i/fullSteps,angle).position);positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);}
  for(let i=0;i<last-first;i++)for(let j=0;j<columns-1;j++){const a=i*columns+j,b=a+1,c=b+columns,d=a+columns;ids.push(a,d,b,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();g.userData={openLocalPatch:true,actualProductionLattice:true,wholeBodyConstructed:false};return g;
}
async function renderPart(id,make,views){
  const group=new THREE.Group(),geometries=[],counts=new Map();try{for(const [name,geometry]of make()){geometries.push(geometry);owned++;counts.set(geometry,0);geometry.addEventListener('dispose',()=>counts.set(geometry,counts.get(geometry)+1));const mesh=new THREE.Mesh(geometry,materialOwner.materials.copper);mesh.name=name;group.add(mesh);}const triangles=geometries.reduce((n,g)=>n+g.index.count/3,0),cpu=await inspectSculptureCPU({group},path.join(destination,id),{viewSpecs:views,size:2048});results.push({id,triangles,cpu});}finally{for(const g of geometries){g.dispose();if(counts.get(g)===1)released++;}group.clear();}
}

try{
  // Only analytically sampled body contours are drawn; no full body factory.
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const row=Array.from({length:180},(_,i)=>sampleSwallowSurface(.455-(.455+.366)*i/179,angle,{detail:false}).position.toArray());oldCurves.push({kind:'body',points:row});newCurves.push({kind:'body',points:row.map(p=>poseSwallowBodyPoint(new THREE.Vector3(...p)).toArray())});}
  oldCurves.push({kind:'leg',points:[[.055,.44,.045],[.047,.265,.02],[.060,.10,.078],[.059,.05,.092],[.060,.031,.105]]});newCurves.push({kind:'leg',points:swallowPoseLegSections(1).map(p=>p.slice(0,3))});
  for(const curves of [oldCurves,newCurves]){const leg=curves.find(c=>c.kind==='leg');curves.push({kind:'leg',points:mirror(leg.points)});}
  const tail=createCopperSwallowTailGeometry(1);try{const line=outline(tail);oldCurves.push({kind:'tail',points:line},{kind:'tail',points:mirror(line)});const mapped=line.map(p=>poseSwallowBodyPoint(new THREE.Vector3(...p)).toArray());newCurves.push({kind:'tail',points:mapped},{kind:'tail',points:mirror(mapped)});}finally{tail.dispose();}
  await renderPart('one-wing',()=>{
    const wing=createCopperSwallowWingGeometry(1),before=outline(wing);oldCurves.push({kind:'wing',points:before},{kind:'wing',points:mirror(before)});applySwallowPose(wing,'wing');const after=outline(wing);newCurves.push({kind:'wing',points:after},{kind:'wing',points:mirror(after)});
    const parts=[['one-cambered-wing',wing],['open-shoulder-patch',bodyPatch()]];
    for(const spec of swallowWingFeatherSpecs(1)){const g=spec.create(),{steps,sides}=g.userData,curve=()=>Array.from({length:12},(_,i)=>{const row=Math.round(i/11*steps),p=new THREE.Vector3();for(let j=0;j<sides;j++)p.add(new THREE.Vector3().fromBufferAttribute(g.attributes.position,row*sides+j));return p.divideScalar(sides).toArray();}),line=curve();oldCurves.push({kind:'feather',points:line},{kind:'feather',points:mirror(line)});applySwallowPose(g,'feather',{primaryIndex:spec.id.startsWith('primary-')?+spec.id.split('-').at(-1):null});const posed=curve();newCurves.push({kind:'feather',points:posed},{kind:'feather',points:mirror(posed)});parts.push([spec.id,g]);}return parts;
  },{threequarter:{direction:[.60,.5,1]},edge:{direction:[1,.10,.12]},top:{direction:[.02,1,.04]}});
  await renderPart('short-leg',()=>[['open-belly-patch',bodyPatch({upper:false})],['one-bent-leg',createBentSwallowLegGeometry(1)],...[-1,0,1,2].map(toe=>['toe-'+toe,createCopperSwallowToeGeometry(1,toe)])],{side:{direction:[1,.025,.12]},front:{direction:[.12,.10,1]}});
}finally{materialOwner.dispose();}

// SVG diagrams use the same metres and projection scale in old/new panels.
// They are geometry design drawings, not rendered photographs or native proof.
const esc=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;'),fmt=n=>n.toFixed(2);
function panel({x,y,w,h,title,curves,view,colour}){
  const back=new THREE.Vector3(...view).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),back).normalize(),up=new THREE.Vector3().crossVectors(back,right),center=new THREE.Vector3(0,.385,-.20),scale=view[1]>.8?315:480;
  const project=p=>{const d=new THREE.Vector3(...p).sub(center);return [x+w/2+d.dot(right)*scale,y+h/2-d.dot(up)*scale];},pathFor=points=>points.map((p,i)=>(i?'L':'M')+project(p).map(fmt).join(' ')).join(' '),marks=[];
  for(const c of curves){const stroke=c.kind==='leg'?5:c.kind==='body'?3:c.kind==='feather'?1.2:2.2;marks.push(`<path d="${pathFor(c.points)}" fill="none" stroke="${colour}" stroke-width="${stroke}" opacity="${c.kind==='feather'?.60:1}" stroke-linejoin="round"/>`);}
  const mouth=project(swallowPoseMouth),ground=[[-1.2,0,-1.05],[1.2,0,-1.05],[1.2,0,.7],[-1.2,0,.7],[-1.2,0,-1.05]];
  const clip='panel-'+x+'-'+y;return `<g><defs><clipPath id="${clip}"><rect x="${x+15}" y="${y+65}" width="${w-30}" height="${h-115}"/></clipPath></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fffdf8" stroke="#e1d8c8"/><text x="${x+24}" y="${y+40}" font-size="25" fill="#322b23">${esc(title)}</text><g clip-path="url(#${clip})"><path d="${pathFor(ground)}" stroke="#b7c4b1" fill="none" stroke-dasharray="5 5"/>${marks.join('')}<circle cx="${fmt(mouth[0])}" cy="${fmt(mouth[1])}" r="6" fill="#207ca6"/></g><text x="${x+24}" y="${y+h-20}" fill="#746956" font-size="19">Same metre scale · blue point = unchanged fountain outlet</text></g>`;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1536" viewBox="0 0 2048 1536"><rect width="2048" height="1536" fill="#f1ebdf"/><text x="45" y="55" font-family="sans-serif" font-size="33" fill="#302a22">Copper bird · proportion and joint study</text><text x="45" y="92" font-family="sans-serif" font-size="21" fill="#6c604f">Authored pose; historical species and joint angles remain unresolved. Analytic contours, not a full model.</text><g font-family="sans-serif">${panel({x:30,y:120,w:984,h:670,title:'Pre-pose candidate · side contours',curves:oldCurves,view:[1,0,0],colour:'#85827c'})}${panel({x:1034,y:120,w:984,h:670,title:'Short bent stance candidate · side contours',curves:newCurves,view:[1,0,0],colour:'#806044'})}${panel({x:30,y:810,w:984,h:690,title:'Pre-pose candidate · wing plan',curves:oldCurves,view:[0,1,.001],colour:'#85827c'})}${panel({x:1034,y:810,w:984,h:690,title:'Elbow / wrist / graduated fan candidate',curves:newCurves,view:[0,1,.001],colour:'#806044'})}</g></svg>`;
await writeFile(path.join(destination,'proportions.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(destination,'proportions.png'));
const after=Object.fromEntries(await Promise.all(files.map(async name=>[name,sha(await readFile(new URL('../src/yuanmingyuan/'+name,import.meta.url)))]))),summary={kind:'lightweight pose diagrams and one-sided actual components',status:swallowPoseStatus,wholeBodyConstructed:false,wholeOwnerConstructed:false,native:false,materialResponseRendered:false,mouthAnchor:swallowPoseMouth,bodyDropMetres:.185,source,sourceAfter:after,sourceUnchanged:JSON.stringify(source)===JSON.stringify(after),geometryResources:{tracked:owned,disposedExactlyOnce:released,allReleased:owned===released},results,diagram:{file:'proportions.png',width:2048,height:1536,kind:'SVG analytic contour projection rasterized directly; not CPU mesh shading'},seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024};await writeFile(path.join(destination,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({directory:destination,seconds:summary.seconds,maxRSSBytes:summary.maxRSSBytes,resources:summary.geometryResources,parts:results.map(r=>({id:r.id,triangles:r.triangles}))}));
