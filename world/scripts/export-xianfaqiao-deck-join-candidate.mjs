#!/usr/bin/env node
// One explicitly scheduled bridge factory. No catalogue or other asset export.
import {readFile,writeFile,mkdir,access,rename,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {serializeYuanmingyuanArchive,packYuanmingyuanArchive} from './export-yuanmingyuan-assets.mjs';

const world=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(world,'..');
const id='xianfaqiao',expectedTriangles=389632,partBytes=8*1024*1024;
const runRoot=join(repo,'work/yuanmingyuan/xianfaqiao-archive-r2-deck-join');
const entry=join(world,'src/yuanmingyuan/xianfa-landscape-study.js');
const oldRaw=join(repo,'work/yuanmingyuan/asset-archives/xianfaqiao-r1');
const oldPublic=join(world,'public/assets/yuanmingyuan/xianfaqiao/7ae1a19b3bdbb7fe-gzip-bin-v1');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const log=(phase,details={})=>console.log(JSON.stringify({time:new Date().toISOString(),phase,...details}));
async function hashFile(path){const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');}
async function preserveOldHashes(){
  const result={};for(const [root,names] of [[oldRaw,['manifest.json',id+'.glb',id+'.runtime.json']],[oldPublic,['manifest.json',id+'.glb.gzip.bin',id+'.runtime.json.gzip.bin']]])for(const name of names){const file=join(root,name);result[relative(repo,file)]=await hashFile(file);}return result;
}
async function sourceGraph(){
  const seen=new Map();
  async function visit(file){
    if(seen.has(file))return;const bytes=await readFile(file);seen.set(file,hash(bytes));if(!/\.[cm]?js$/.test(file))return;
    for(const match of bytes.toString().matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)){
      const specifier=match[1],target=specifier.startsWith('.')?resolve(dirname(file),specifier):specifier==='three'||specifier.startsWith('three/')?fileURLToPath(import.meta.resolve(specifier)):null;
      if(!target)continue;if(!target.startsWith(world+'/'))throw new Error('Source dependency escapes world: '+target);await visit(target);
    }
  }
  await visit(entry);await visit(fileURLToPath(import.meta.url));
  for(const path of ['src/yuanmingyuan/xianfa-landscape-views.js','package.json','package-lock.json','node_modules/three/package.json','node_modules/three/build/three.module.js','node_modules/three/examples/jsm/exporters/GLTFExporter.js'])await visit(join(world,path));
  return Object.fromEntries([...seen].map(([file,digest])=>[relative(repo,file),digest]).sort(([a],[b])=>a.localeCompare(b)));
}
function measureAndObserve(asset){
  const geometries=new Set(),materials=new Set(),textures=new Set(),instances=new Set(),records=[];let triangles=0,meshes=0,nodes=0;
  asset.group.updateMatrixWorld(true);
  asset.group.traverse(node=>{nodes++;if(!node.isMesh)return;meshes++;const n=node.isInstancedMesh?node.count:1;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*n;geometries.add(node.geometry);if(node.isInstancedMesh)instances.add(node);for(const material of [node.material,node.customDepthMaterial,node.customDistanceMaterial].flat().filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const set of [geometries,materials,textures,instances])for(const resource of set){const record={resource,count:0};record.listener=()=>record.count++;resource.addEventListener('dispose',record.listener);records.push(record);}
  const bounds=new THREE.Box3().setFromObject(asset.group),counts={triangles,meshes,nodes,geometries:geometries.size,materials:materials.size,textures:textures.size,instances:[...instances].reduce((sum,node)=>sum+node.count,0)};
  return {counts,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},verifyDisposal(){for(const record of records)record.resource.removeEventListener('dispose',record.listener);const failures=records.filter(record=>record.count!==1).map(record=>({name:record.resource.name,type:record.resource.type,count:record.count}));return {geometries:geometries.size,materials:materials.size,textures:textures.size,instancedMeshes:instances.size,resources:records.length,eachDisposedExactlyOnce:!failures.length,failures};}};
}

async function main(){
  if(process.argv.length!==2||!process.execArgv.includes('--max-old-space-size=768'))throw new Error('Run only this bridge job with node --max-old-space-size=768 and no asset arguments');
  await mkdir(runRoot);const started=performance.now(),oldHashes=await preserveOldHashes();
  const approved=JSON.parse(await readFile(join(repo,'work/yuanmingyuan/xianfaqiao-deck-join-r1/freeze.json')));
  for(const [path,expected] of Object.entries(approved.sourceHashes).filter(([path])=>path.startsWith('src/')))if(await hashFile(join(world,path))!==expected)throw new Error('Deck-join freeze changed: '+path);
  if(await hashFile(join(repo,approved.unchangedSharedGeometry.path))!==approved.unchangedSharedGeometry.sha256)throw new Error('Shared geometry differs from the deck-join freeze');
  const sourceSHA256=await sourceGraph(),sourceDigest=hash(Buffer.from(JSON.stringify(sourceSHA256)));
  if(sourceDigest.startsWith('7ae1a19b3bdbb7fe'))throw new Error('Candidate identity must differ from old before geometry');
  for(const path of Object.keys(sourceSHA256)){const target=join(runRoot,'source',path);await mkdir(dirname(target),{recursive:true});const bytes=await readFile(join(repo,path));if(hash(bytes)!==sourceSHA256[path])throw new Error('Source changed during freeze: '+path);await writeFile(target,bytes,{flag:'wx'});}
  await writeFile(join(runRoot,'source-freeze.json'),JSON.stringify({sourceDigest,sourceSHA256,oldArchiveHashes:oldHashes,heapLimitMiB:768,expectedTriangles,partBytes,nativeReview:'pending'},null,2)+'\n',{flag:'wx'});
  const output=join(repo,'work/yuanmingyuan/asset-archives/xianfaqiao',sourceDigest.slice(0,16)),temporary=output+'.pending-'+process.pid;
  try{await access(output);throw new Error('Candidate already exists: '+output);}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(dirname(output),{recursive:true});await mkdir(temporary);let asset,measurement,sourceDisposal,committed=false,sourceDisposed=false;
  const memoryBefore=process.memoryUsage();
  try{
    log('factory-start',{id,expectedTriangles,heapLimitMiB:768});const factoryStart=performance.now();const module=await import(pathToFileURL(entry));asset=module.createXianfaqiaoStudy();measurement=measureAndObserve(asset);
    const memoryAfterConstruction=process.memoryUsage(),constructionMilliseconds=performance.now()-factoryStart;
    log('factory-measured',{...measurement.counts,bounds:measurement.bounds,constructionMilliseconds,memory:memoryAfterConstruction});
    await writeFile(join(runRoot,'factory-measurement.json'),JSON.stringify({...measurement.counts,bounds:measurement.bounds,constructionMilliseconds,memory:memoryAfterConstruction},null,2)+'\n');
    if(measurement.counts.triangles!==expectedTriangles||measurement.counts.meshes!==34||measurement.counts.instances!==0||measurement.counts.materials>10||measurement.counts.textures>4||measurement.bounds.size.some((value,i)=>!Number.isFinite(value)||value>[40,12,24][i]))throw new Error('Bridge measurement exceeds or differs from the bounded expected source; no archive serialized');
    const archive=await serializeYuanmingyuanArchive(asset,{id,sourceSHA256});
    if(JSON.stringify(await sourceGraph())!==JSON.stringify(sourceSHA256))throw new Error('Source bytes changed during bridge export');
    const memoryAfterRoundtrip=process.memoryUsage();sourceDisposed=true;asset.dispose();sourceDisposal=measurement.verifyDisposal();if(!sourceDisposal.eachDisposedExactlyOnce)throw new Error('Source resource ownership verification failed');
    log('factory-and-roundtrip-disposed',{sourceDisposal,restoredDisposal:archive.metadata.verification.restoredResourceDisposal});
    const manifest={schema:1,id,exportedAt:new Date().toISOString(),sourceDigest,sourceSHA256,glb:{url:id+'.glb',sha256:hash(archive.glb),bytes:archive.glb.length},runtime:{url:id+'.runtime.json',sha256:hash(archive.runtime),bytes:archive.runtime.length},verification:archive.metadata.verification,nativeArchiveVisualReview:false,sourceDiagnosticsAcceptance:false,sourceResourceDisposal:sourceDisposal,memoryBytes:{before:memoryBefore,afterConstruction:memoryAfterConstruction,afterRoundtrip:memoryAfterRoundtrip,afterSourceDisposal:process.memoryUsage(),note:'dispose releases ownership; CPU arrays remain reachable until process exit/GC'},elapsedMilliseconds:performance.now()-started,candidateReview:{revision:'deck-join-r2',status:'exact-roundtrip-candidate-native-pending',bounds:measurement.bounds,preservedBeforeManifest:'/assets/yuanmingyuan/xianfaqiao/7ae1a19b3bdbb7fe-gzip-bin-v1/manifest.json'}};
    await writeFile(join(temporary,id+'.glb'),archive.glb,{flag:'wx'});await writeFile(join(temporary,id+'.runtime.json'),archive.runtime,{flag:'wx'});await writeFile(join(temporary,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});await rename(temporary,output);committed=true;
    const transport=await packYuanmingyuanArchive({id,archiveDirectory:output,partBytes});
    if(JSON.stringify(await preserveOldHashes())!==JSON.stringify(oldHashes))throw new Error('Old before archive bytes changed during this job');
    const result={id,output,manifestURL:transport.manifestURL,publicManifestSHA256:await hashFile(join(transport.output,'manifest.json')),sourceDigest,counts:archive.metadata.verification.counts,bounds:measurement.bounds,glb:transport.manifest.glb,runtime:transport.manifest.runtime,sourceDisposal,restoredDisposal:archive.metadata.verification.restoredResourceDisposal,oldArchiveHashesUnchanged:true,elapsedMilliseconds:performance.now()-started,maxRSSBytes:process.resourceUsage().maxRSS*1024,processId:process.pid,nativeReview:'pending',sourceFactoryCalls:1,GPU:false};
    await writeFile(join(runRoot,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});log('candidate-complete',result);
  }finally{
    if(!sourceDisposed&&asset){sourceDisposed=true;asset.dispose();sourceDisposal=measurement?.verifyDisposal();log('failure-source-disposal',{sourceDisposal});}
    if(!committed)await rm(temporary,{recursive:true,force:true});
  }
}
try{await main();}catch(error){log('failed',{error:error.stack});process.exitCode=1;}
