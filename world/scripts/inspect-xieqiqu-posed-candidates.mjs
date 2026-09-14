import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createXieqiquCopperSwallowPoseReviewStudy,copperSwallowPoseStudyViews} from '../src/yuanmingyuan/xieqiqu-swallow-pose-study.js';
import {createXieqiquStoneFishReviewStudy,stoneFishStudyViews} from '../src/yuanmingyuan/xieqiqu-sculpture-studies.js';
import {inspectClosedSculptureGeometry} from './inspect-xieqiqu-fish-swallow.mjs';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

const world=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex'),arraySHA=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const runtime=['xieqiqu-sculpture-studies.js','xieqiqu-study.js','xieqiqu-sculpture-skin.js','xieqiqu-stone-fish.js','xieqiqu-fish-surface.js','xieqiqu-copper-swallow.js','xieqiqu-swallow-feathers.js','xieqiqu-swallow-surface.js','xieqiqu-swallow-pose.js','xieqiqu-swallow-pose-study.js','xieqiqu-swallow-pose-views.js','study-geometry.js','xieqiqu-geometry.js','yuanyingguan-geometry.js','xieqiqu-copper-sheep.js','xieqiqu-sheep-detail.js','xieqiqu-sheep-fleece.js','xieqiqu-sheep-anatomy.js'];
const scripts=['inspect-xieqiqu-posed-candidates.mjs','inspect-xieqiqu-fish-swallow.mjs','xieqiqu-sculpture-cpu-review.mjs'];
const sources=[...runtime.map(n=>'src/yuanmingyuan/'+n),...scripts.map(n=>'scripts/'+n)];
async function sourceHashes(directory){
  const rows={};for(const file of sources){const bytes=await readFile(path.join(world,file));rows[file]=sha(bytes);if(directory){const target=path.join(directory,'source/world',file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}}
  return rows;
}

async function inspectOne(kind,directory){
  const isBird=kind==='swallow',create=isBird?createXieqiquCopperSwallowPoseReviewStudy:createXieqiquStoneFishReviewStudy,views=isBird?copperSwallowPoseStudyViews:stoneFishStudyViews,started=performance.now(),resources=new Set(),events=new Map(),report={kind,native:false,artAccepted:false,checks:[],failures:[]};let owner,bodyClone;
  const check=(name,passed,detail=null)=>{report.checks.push({name,passed:!!passed,detail});if(!passed)report.failures.push(name);};
  const track=resource=>{if(resources.has(resource))return;resources.add(resource);events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));};
  await mkdir(directory,{recursive:true});
  try{
    owner=create();report.constructionSeconds=(performance.now()-started)/1000;report.diagnostics=owner.diagnostics;report.parts=[];
    for(const mesh of owner.group.children){track(mesh.geometry);for(const material of [].concat(mesh.material)){track(material);for(const value of Object.values(material))if(value?.isTexture)track(value);}}
    for(const mesh of owner.group.children){
      const g=mesh.geometry;
      const attributes=Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{count:a.count,itemSize:a.itemSize,bytes:a.array.byteLength,sha256:arraySHA(a.array)}]));let invalid=0;const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
      for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv.getX(i),uv.getY(i)].every(Number.isFinite)||Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>2e-5)invalid++;
      const topology=inspectClosedSculptureGeometry(g);report.parts.push({name:mesh.name,triangles:g.index.count/3,attributes,index:{count:g.index.count,bytes:g.index.array.byteLength,sha256:arraySHA(g.index.array)},invalidVertices:invalid,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,topology});
    }
    check('complete finite attributes and source shadow flags',report.parts.every(p=>p.invalidVertices===0&&p.attributes.position.count===p.attributes.normal.count&&p.attributes.position.count===p.attributes.uv.count&&p.castShadow&&p.receiveShadow));
    check('every real part is closed, consistently wound and nondegenerate',report.parts.every(p=>{const t=p.topology;return t.connectedComponents===1&&t.euler===2&&t.boundaryEdges===0&&t.nonManifoldEdges===0&&t.inconsistentWindingEdges===0&&t.degenerateFaces===0&&t.signedVolume>0;}),report.parts.filter(p=>p.topology.euler!==2||p.topology.boundaryEdges||p.topology.nonManifoldEdges||p.topology.inconsistentWindingEdges||p.topology.degenerateFaces).map(p=>p.name));
    check('every actual shading normal faces its own triangle',report.parts.every(p=>p.topology.inwardShadingFaces===0),report.parts.filter(p=>p.topology.inwardShadingFaces).map(p=>({name:p.name,bad:p.topology.inwardShadingFaces,minDot:p.topology.minimumFaceNormalDot,faces:p.topology.badFaceExamples})));
    check('all declared component triangles are counted',report.parts.reduce((n,p)=>n+p.triangles,0)===owner.diagnostics.triangles&&report.parts.length===(isBird?79:6));
    const body=owner.group.children.find(m=>m.name.includes('continuous-body'));bodyClone=body.geometry.clone();const tree=new MeshBVH(bodyClone,{indirect:true}),mouth=new THREE.Vector3(...owner.diagnostics.mouthAnchor),axis=isBird?new THREE.Vector3(0,0,1):new THREE.Vector3(...body.geometry.userData.mouthNormal),out=tree.raycastFirst(new THREE.Ray(mouth,axis),THREE.DoubleSide),back=tree.raycastFirst(new THREE.Ray(mouth,axis.clone().negate()),THREE.DoubleSide);
    check('original fountain outlet opens into a recessed actual mouth',out===null&&back&&back.distance>(isBird?.045:.20),{anchor:mouth.toArray(),axis:axis.toArray(),outwardHit:out?.point.toArray()??null,depth:back?.distance??null});
    report.rootContact=[];
    for(const mesh of owner.group.children.filter(m=>isBird?/-(wing|leg)-[-1]+$/.test(m.name):m.name.includes('pectoral-'))){
      const p=mesh.geometry.attributes.position,isLeg=mesh.name.includes('-leg-'),failed=[];let sampled=0;
      for(let i=0;i<p.count;i++){
        const point=new THREE.Vector3().fromBufferAttribute(p,i);if(isLeg?i>=mesh.geometry.userData.sides:isBird?Math.abs(point.x)>.085||point.z<-.10||point.z>.04:point.z<.573)continue;sampled++;
        for(const d of [[1,.173,.071],[-.213,1,.131],[.113,-.173,1]]){const ray=new THREE.Ray(point,new THREE.Vector3(...d).normalize()),hit=tree.raycastFirst(ray,THREE.DoubleSide);if(!hit||hit.face.normal.dot(ray.direction)<=0){if(failed.length<32)failed.push({point:point.toArray(),direction:d,hit:hit?.point.toArray()??null});break;}}
      }
      report.rootContact.push({name:mesh.name,sampled,failed});
    }
    check('actual fin/wing/leg root vertices remain inside the actual full skin',report.rootContact.length===(isBird?4:2)&&report.rootContact.every(r=>r.sampled>0&&r.failed.length===0),report.rootContact);
    if(isBird){const feet=owner.group.children.filter(m=>m.name.includes('-toe-')).map(mesh=>{mesh.geometry.computeBoundingBox();return {name:mesh.name,minY:mesh.geometry.boundingBox.min.y};});check('all eight original toes retain the foot datum',feet.length===8&&feet.every(p=>Math.abs(p.minY)<1e-6),feet);}
    else{const point=new THREE.Vector3(0,1.15,-.48),hits=[-1,1].map(x=>tree.raycastFirst(new THREE.Ray(point,new THREE.Vector3(x,0,0)),THREE.DoubleSide));check('rolled stone tail has a real open centre',hits.every(h=>h===null),{origin:point.toArray(),hits:hits.map(h=>h?.point.toArray()??null)});}
    const box=new THREE.Box3().setFromObject(owner.group),extent=box.getSize(new THREE.Vector3()),spec=views[isBird?'head':'mouth'],crop=new THREE.Box3(new THREE.Vector3(...spec.crop.min).multiply(extent).add(box.min),new THREE.Vector3(...spec.crop.max).multiply(extent).add(box.min));check('head review crop contains the unchanged outlet',crop.containsPoint(mouth),{min:crop.min.toArray(),max:crop.max.toArray()});
    report.materials=[...resources].filter(r=>r.isMaterial).map(m=>({name:m.name,type:m.type,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale?.toArray(),side:m.side,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,depthTest:m.depthTest}));
    report.textures=[...resources].filter(r=>r.isTexture).map(t=>({name:t.name,width:t.image.width,height:t.image.height,bytes:t.image.data.byteLength,pixelSHA256:arraySHA(t.image.data),colorSpace:t.colorSpace}));
    report.cpu=await inspectSculptureCPU(owner,path.join(directory,'cpu'),{constructionSeconds:report.constructionSeconds,viewSpecs:views,size:2048});
  }catch(error){report.failures.push(error.message);report.error={name:error.name,message:error.message,stack:error.stack};}
  finally{
    bodyClone?.dispose();owner?.dispose();owner?.dispose();report.resources={total:resources.size,geometry:[...resources].filter(r=>r.isBufferGeometry).length,materials:[...resources].filter(r=>r.isMaterial).length,textures:[...resources].filter(r=>r.isTexture).length,disposedExactlyOnce:[...events.values()].every(n=>n===1),groupEmpty:owner?owner.group.children.length===0:null};check('owner is emptied and every owned resource disposed exactly once',report.resources.disposedExactlyOnce&&report.resources.groupEmpty,report.resources);
  }
  report.seconds=(performance.now()-started)/1000;report.maxRSSBytes=process.resourceUsage().maxRSS*1024;await writeFile(path.join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [kind,destination]=process.argv.slice(2);if(!['swallow','fish','both'].includes(kind)||!destination)throw new Error('Usage: inspect-xieqiqu-posed-candidates.mjs swallow|fish|both NEW_DIRECTORY');
  const directory=path.resolve(destination);await mkdir(directory,{recursive:false});const started=performance.now(),before=await sourceHashes(directory),results=[];
  for(const entry of kind==='both'?['swallow','fish']:[kind]){console.log('BEGIN '+entry);const r=await inspectOne(entry,path.join(directory,entry));results.push({kind:entry,triangles:r.diagnostics?.triangles,constructionSeconds:r.constructionSeconds,seconds:r.seconds,maxRSSBytes:r.maxRSSBytes,failures:r.failures,resources:r.resources});console.log('END '+JSON.stringify(results.at(-1)));global.gc?.();}
  const after=await sourceHashes(),summary={directory,sourceFiles:before,sourceFilesAfter:after,sourceUnchanged:JSON.stringify(before)===JSON.stringify(after),oneProcessSequentialOwners:true,results,seconds:(performance.now()-started)/1000,maxRSSBytes:process.resourceUsage().maxRSS*1024,native:false};await writeFile(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');if(!summary.sourceUnchanged||results.some(r=>r.failures.length))process.exitCode=1;console.log('RELEASE '+JSON.stringify({directory,seconds:summary.seconds,maxRSSBytes:summary.maxRSSBytes,sourceUnchanged:summary.sourceUnchanged,failures:results.map(r=>({kind:r.kind,failures:r.failures}))}));
}
