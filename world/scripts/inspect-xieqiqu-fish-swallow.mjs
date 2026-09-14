import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createXieqiquStoneFishReviewStudy,createXieqiquCopperSwallowReviewStudy,stoneFishStudyViews,copperSwallowStudyViews} from '../src/yuanmingyuan/xieqiqu-sculpture-studies.js';
import {inspectSculptureCPU} from './xieqiqu-sculpture-cpu-review.mjs';

const world=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const runtimeFiles=['xieqiqu-sculpture-studies.js','xieqiqu-study.js','xieqiqu-sculpture-skin.js','xieqiqu-stone-fish.js','xieqiqu-fish-surface.js','xieqiqu-copper-swallow.js','xieqiqu-swallow-feathers.js','xieqiqu-swallow-surface.js','study-geometry.js','xieqiqu-geometry.js','yuanyingguan-geometry.js','xieqiqu-copper-sheep.js','xieqiqu-sheep-detail.js','xieqiqu-sheep-fleece.js','xieqiqu-sheep-anatomy.js'];
async function sourceHashes(){return Object.fromEntries(await Promise.all(runtimeFiles.map(async file=>[file,sha(await readFile(path.join(world,'src/yuanmingyuan',file)))])));}

/** Examines the actual Float32 coordinates and triangles. No epsilon welding,
 * removed faces or replacement normals can make the result pass. */
export function inspectClosedSculptureGeometry(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index?.array,count=index?.length??p.count,order=Uint32Array.from({length:p.count},(_,i)=>i),ids=new Uint32Array(p.count);
  order.sort((a,b)=>p.getX(a)-p.getX(b)||p.getY(a)-p.getY(b)||p.getZ(a)-p.getZ(b));let unique=0,previous=-1;
  for(const at of order){if(previous<0||p.getX(at)!==p.getX(previous)||p.getY(at)!==p.getY(previous)||p.getZ(at)!==p.getZ(previous))unique++;ids[at]=unique-1;previous=at;}
  if(2*unique*unique>Number.MAX_SAFE_INTEGER)throw new Error('Exact numeric edge codes exceed safe integer range');
  const parents=Uint32Array.from({length:unique},(_,i)=>i),find=id=>{while(parents[id]!==id){parents[id]=parents[parents[id]];id=parents[id];}return id;},edges=new Float64Array(count),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),average=new THREE.Vector3(),badFaceExamples=[];let volume=0,degenerate=0,minimumDot=1,inwardShadingFaces=0;
  for(let i=0;i<count;i+=3){const vi=[index?.[i]??i,index?.[i+1]??i+1,index?.[i+2]??i+2],w=vi.map(j=>ids[j]);a.fromBufferAttribute(p,vi[0]);b.fromBufferAttribute(p,vi[1]);c.fromBufferAttribute(p,vi[2]);volume+=a.dot(ab.copy(b).cross(c))/6;ab.copy(b).sub(a).cross(ac.copy(c).sub(a));
    if(ab.lengthSq()===0){degenerate++;if(badFaceExamples.length<64)badFaceExamples.push({face:i/3,kind:'degenerate',positions:[a.toArray(),b.toArray(),c.toArray()]});}else{average.set(n.getX(vi[0])+n.getX(vi[1])+n.getX(vi[2]),n.getY(vi[0])+n.getY(vi[1])+n.getY(vi[2]),n.getZ(vi[0])+n.getZ(vi[1])+n.getZ(vi[2])).normalize();const dot=ab.normalize().dot(average);minimumDot=Math.min(minimumDot,dot);if(dot<=0){inwardShadingFaces++;if(badFaceExamples.length<64)badFaceExamples.push({face:i/3,kind:'shading-opposes-face',dot,positions:[a.toArray(),b.toArray(),c.toArray()],normals:vi.map(j=>[n.getX(j),n.getY(j),n.getZ(j)])});}}
    parents[find(w[1])]=find(w[0]);parents[find(w[2])]=find(w[0]);for(let j=0;j<3;j++){const x=w[j],y=w[(j+1)%3];edges[i+j]=2*(Math.min(x,y)*unique+Math.max(x,y))+(x<y?0:1);}
  }
  edges.sort();let edgeCount=0,boundaryEdges=0,nonManifoldEdges=0,inconsistentWindingEdges=0;
  for(let i=0;i<edges.length;){let end=i+1;while(end<edges.length&&Math.floor(edges[end]/2)===Math.floor(edges[i]/2))end++;const uses=end-i;edgeCount++;if(uses===1)boundaryEdges++;else if(uses!==2)nonManifoldEdges++;else if(edges[i]%2===edges[i+1]%2)inconsistentWindingEdges++;i=end;}
  const components=new Set();for(let i=0;i<unique;i++)components.add(find(i));
  return {triangles:count/3,uniqueExactPositions:unique,edges:edgeCount,connectedComponents:components.size,euler:unique-edgeCount+count/3,boundaryEdges,nonManifoldEdges,inconsistentWindingEdges,signedVolume:volume,degenerateFaces:degenerate,minimumFaceNormalDot:minimumDot,inwardShadingFaces,badFaceExamples,method:'actual float32 coordinate sort, exact directed-edge counts; every rendered triangle retained'};
}

async function inspectOne(kind,directory){
  const create=kind==='fish'?createXieqiquStoneFishReviewStudy:createXieqiquCopperSwallowReviewStudy,views=kind==='fish'?stoneFishStudyViews:copperSwallowStudyViews,started=performance.now(),report={kind,native:false,visualAcceptance:false,checks:[],failures:[]},resources=new Set(),events=new Map();let owner,collisionGeometry;
  const check=(name,condition,detail)=>{report.checks.push({name,passed:!!condition,detail});if(!condition)report.failures.push(name);};
  await mkdir(directory,{recursive:true});
  try{
    owner=create();report.constructionSeconds=(performance.now()-started)/1000;report.diagnostics=owner.diagnostics;report.parts=[];
    owner.group.traverse(mesh=>{if(!mesh.isMesh)return;resources.add(mesh.geometry);for(const material of [].concat(mesh.material)){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;let invalid=0;
      for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)||Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>2e-5)invalid++;
      const attributes=Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{count:a.count,itemSize:a.itemSize,bytes:a.array.byteLength,sha256:sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))}]));report.parts.push({name:mesh.name,triangles:(g.index?.count??p.count)/3,attributes,index:g.index?{count:g.index.count,bytes:g.index.array.byteLength,sha256:sha(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength))}:null,invalidVertices:invalid,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow});
    });
    for(const r of resources){events.set(r,0);r.addEventListener('dispose',()=>events.set(r,events.get(r)+1));}
    check('finite complete attributes and unit normals',report.parts.every(p=>p.invalidVertices===0&&p.attributes.normal.count===p.attributes.position.count&&p.attributes.uv.count===p.attributes.position.count));
    check('all authored triangles and both shadow flags retained',report.parts.reduce((s,p)=>s+p.triangles,0)===owner.diagnostics.triangles&&report.parts.every(p=>p.castShadow&&p.receiveShadow));
    const core=owner.group.children.find(mesh=>mesh.name.includes('continuous-body'));report.topology=inspectClosedSculptureGeometry(core.geometry);const t=report.topology;
    check('core is one exact closed consistently wound skin',t.connectedComponents===1&&t.euler===2&&t.boundaryEdges===0&&t.nonManifoldEdges===0&&t.inconsistentWindingEdges===0&&t.signedVolume>0,t);
    check('core has no degenerate or inverted shading faces',t.degenerateFaces===0&&t.inwardShadingFaces===0,{minimumDot:t.minimumFaceNormalDot,degenerate:t.degenerateFaces,inward:t.inwardShadingFaces});
    report.detailFaceChecks=[];for(const mesh of owner.group.children)if(mesh!==core){const detail=inspectClosedSculptureGeometry(mesh.geometry);report.detailFaceChecks.push({name:mesh.name,...detail});}check('every detail keeps nondegenerate outward shading faces',report.detailFaceChecks.every(d=>d.degenerateFaces===0&&d.inwardShadingFaces===0),report.detailFaceChecks.filter(d=>d.degenerateFaces||d.inwardShadingFaces));
    collisionGeometry=core.geometry.clone();const tree=new MeshBVH(collisionGeometry,{indirect:true}),mouth=new THREE.Vector3(...owner.diagnostics.mouthAnchor),outward=kind==='fish'?new THREE.Vector3(...core.geometry.userData.mouthNormal):new THREE.Vector3(0,0,1),out=tree.raycastFirst(new THREE.Ray(mouth,outward),THREE.DoubleSide),inner=tree.raycastFirst(new THREE.Ray(mouth,outward.clone().negate()),THREE.DoubleSide);
    check('unchanged mouth datum opens outward and has recessed inner wall',out===null&&inner&&inner.distance>(kind==='fish'?.20:.045),{mouth:mouth.toArray(),axis:outward.toArray(),outwardHit:out?.point.toArray()??null,innerDepth:inner?.distance??null});
    if(kind==='fish'){const origin=new THREE.Vector3(0,1.15,-.48),hits=[1,-1].map(side=>tree.raycastFirst(new THREE.Ray(origin,new THREE.Vector3(side,0,0)),THREE.DoubleSide));check('rolled tail encloses a real open centre',hits.every(hit=>hit===null),{origin:origin.toArray(),hits:hits.map(hit=>hit?.point.toArray()??null)});}
    report.rootContact=[];for(const mesh of owner.group.children.filter(m=>kind==='fish'?m.name.includes('pectoral-'):/-wing-[-1]+$/.test(m.name))){const p=mesh.geometry.attributes.position,failed=[];let sampled=0;for(let i=0;i<p.count;i++){const point=new THREE.Vector3().fromBufferAttribute(p,i);if(kind==='fish'?point.z<.573:Math.abs(point.x)>.085||point.z<-.10||point.z>.04)continue;sampled++;for(const direction of [[1,.173,.071],[-.213,1,.131],[.113,-.173,1]]){const ray=new THREE.Ray(point,new THREE.Vector3(...direction).normalize()),hit=tree.raycastFirst(ray,THREE.DoubleSide);if(!hit||hit.face.normal.dot(ray.direction)<=0){if(failed.length<32)failed.push({point:point.toArray(),direction,hit:hit?.point.toArray()??null});break;}}}report.rootContact.push({name:mesh.name,sampled,failed});}check('actual fin or wing root vertices are buried in the actual body mesh',report.rootContact.length===2&&report.rootContact.every(r=>r.sampled>0&&r.failed.length===0),report.rootContact);
    const view=views[kind==='fish'?'mouth':'head'],box=new THREE.Box3().setFromObject(owner.group),extent=box.getSize(new THREE.Vector3()),min=box.min.clone(),crop=new THREE.Box3(new THREE.Vector3(...view.crop.min).multiply(extent).add(min),new THREE.Vector3(...view.crop.max).multiply(extent).add(min));check('head review crop contains the fixed fountain mouth',crop.containsPoint(mouth),{crop:{min:crop.min.toArray(),max:crop.max.toArray()}});
    report.cpu=await inspectSculptureCPU(owner,path.join(directory,'cpu'),{constructionSeconds:report.constructionSeconds,viewSpecs:views,size:2048});
  }catch(error){report.failures.push(error.message);report.error={name:error.name,message:error.message,stack:error.stack};}
  finally{collisionGeometry?.dispose();owner?.dispose();owner?.dispose();report.resources={total:resources.size,geometries:[...resources].filter(r=>r.isBufferGeometry).length,materials:[...resources].filter(r=>r.isMaterial).length,textures:[...resources].filter(r=>r.isTexture).length,eachDisposedExactlyOnce:[...events.values()].every(n=>n===1),groupEmpty:owner?owner.group.children.length===0:null};check('all owned resources disposed once and scene cleared',report.resources.eachDisposedExactlyOnce&&report.resources.groupEmpty,report.resources);}
  report.seconds=(performance.now()-started)/1000;report.maxRSSBytes=process.resourceUsage().maxRSS*1024;await writeFile(path.join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [kind,destination]=process.argv.slice(2);if(!['fish','swallow','both'].includes(kind)||!destination)throw new Error('Usage: inspect-xieqiqu-fish-swallow.mjs fish|swallow|both NEW_OUTPUT_DIRECTORY');
  const directory=path.resolve(destination);await mkdir(directory,{recursive:false});const started=performance.now(),before=await sourceHashes(),results=[];
  for(const entry of kind==='both'?['fish','swallow']:[kind]){console.log('BEGIN '+entry);const report=await inspectOne(entry,path.join(directory,entry));results.push({kind:entry,triangles:report.diagnostics?.triangles,constructionSeconds:report.constructionSeconds,seconds:report.seconds,maxRSSBytes:report.maxRSSBytes,failures:report.failures,resources:report.resources});console.log('END '+JSON.stringify(results.at(-1)));global.gc?.();}
  const after=await sourceHashes(),sourceUnchanged=JSON.stringify(before)===JSON.stringify(after),summary={startedAt:new Date(Date.now()-(performance.now()-started)).toISOString(),seconds:(performance.now()-started)/1000,oneProcessSequentialOwners:true,results,sourceUnchanged,sourceFiles:before,sourceFilesAfter:after,maxRSSBytes:process.resourceUsage().maxRSS*1024,native:false};
  await writeFile(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');if(!sourceUnchanged||results.some(r=>r.failures.length))process.exitCode=1;console.log('RELEASE '+JSON.stringify({directory,seconds:summary.seconds,maxRSSBytes:summary.maxRSSBytes,sourceUnchanged,failures:results.map(r=>({kind:r.kind,failures:r.failures}))}));
}
