#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename,rm,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {captureYuanmingyuanState,serializeYuanmingyuanArchive,packYuanmingyuanArchive} from './export-yuanmingyuan-assets.mjs';
import {restoreYuanmingyuanArchive} from '../src/yuanmingyuan/asset-archive.js';
import {createBuildingDistanceAsset} from '../src/yuanmingyuan/zhengjuesi-distance-builder.js';
import {zhengjuesiDistanceCandidates,zhengjuesiDistanceCandidateError} from '../src/yuanmingyuan/zhengjuesi-distance-geometry.js';

const world=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(world,'..'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const checkpoint=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Distance export aborted','AbortError');};

async function producerSources(){
  const files=new Map();
  async function visit(file){
    if(files.has(file))return;const bytes=await readFile(file);files.set(file,hash(bytes));
    if(!/\.[cm]?js$/.test(file))return;
    for(const match of bytes.toString().matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))await visit(resolve(dirname(file),match[1]));
  }
  await visit(fileURLToPath(import.meta.url));
  for(const file of ['package-lock.json','node_modules/three/package.json','node_modules/three/src/geometries/BoxGeometry.js','node_modules/three/src/geometries/CylinderGeometry.js','node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js'])await visit(resolve(world,file));
  return Object.fromEntries([...files].map(([file,sha])=>[relative(repo,file),sha]).sort(([a],[b])=>a.localeCompare(b)));
}

function observeResources(...assets){
  const resources=new Set(),counts=new Map();
  for(const asset of assets){const {objects}=captureYuanmingyuanState(asset);for(const key of ['geometries','materials','textures'])for(const item of objects[key])resources.add(item);for(const item of objects.nodes)if(item.isInstancedMesh)resources.add(item);}
  for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  return ()=>{const all=[...counts.values()];if(all.some(n=>n!==1))throw new Error('Source/distance reachable resource was not disposed exactly once.');return {reachableUniqueResources:all.length,disposedExactlyOnce:all.length,sharedSourceResourcesCountedOnce:true};};
}

/** One explicit archive only. This never imports a production factory.
 * Lossless transport stores the derived distance result exactly; its geometry
 * is deliberately labelled as derived, with no claim of full-source equality. */
export async function exportZhengjuesiDistance({archiveDirectory,outputDirectory,publicRoot=resolve(world,'public/assets/yuanmingyuan-distance'),maximumErrorWorld,expectedSourceId='zhengjuesi',sourceVisualReview='changes-required; no native admission',signal,onProgress}={}){
  if(!archiveDirectory||!outputDirectory||!Number.isFinite(maximumErrorWorld)||maximumErrorWorld<=0)throw new Error('Explicit source archive, new output directory and positive world error are required.');
  const sourceDirectory=resolve(archiveDirectory),output=resolve(outputDirectory),temporary=output+`.pending-${process.pid}`,memory={before:process.memoryUsage()},started=performance.now();
  if(output===resolve(world,'public')||output.startsWith(resolve(world,'public')+'/'))throw new Error('Keep raw review results outside public; publish only gzip-bin transport.');
  try{await access(output);throw new Error('Distance output already exists; preserve it and choose a new path.');}catch(error){if(error.code!=='ENOENT')throw error;}
  checkpoint(signal);const sourceManifestBytes=await readFile(join(sourceDirectory,'manifest.json')),sourceManifest=JSON.parse(sourceManifestBytes);
  if(sourceManifest.id!==expectedSourceId||!/^[a-f0-9]{64}$/.test(sourceManifest.sourceDigest??'')||sourceManifest.verification?.exactRoundtripPassed!==true)throw new Error('Source archive identity/exact-roundtrip evidence is missing.');
  const sourceBytes={};
  for(const kind of ['runtime','glb']){
    const entry=sourceManifest[kind],expected=`${expectedSourceId}.${kind==='glb'?'glb':'runtime.json'}`;
    if(entry?.url!==expected||entry.compression)throw new Error('Read the retained raw archive, not a renamed or compressed substitute.');
    sourceBytes[kind]=await readFile(join(sourceDirectory,entry.url));if(sourceBytes[kind].length!==entry.bytes||hash(sourceBytes[kind])!==entry.sha256)throw new Error(`Full source ${kind} SHA256/length mismatch.`);checkpoint(signal);
  }
  const metadata=JSON.parse(sourceBytes.runtime);if(metadata.id!==expectedSourceId||metadata.animations.length)throw new Error('This first distance profile is for the static source; animated textures need an explicit retained-animation adapter.');
  const sources=await producerSources(),identity={sourceArchiveDigest:sourceManifest.sourceDigest,sourceManifestSHA256:hash(sourceManifestBytes),producerSHA256:sources,maximumErrorWorld,profile:'zhengjuesi-tiles-stone-closed-frusta-v1',batching:'per-instance-error-opaque-hybrid-v1'},digest=hash(JSON.stringify(identity)),id=expectedSourceId+'-distance';
  await mkdir(dirname(output),{recursive:true});await mkdir(temporary);let source,distance,success=false,disposed=false;
  try{
    source=await restoreYuanmingyuanArchive(sourceBytes.glb,metadata,{signal,onProgress});memory.afterRestore=process.memoryUsage();const originalStateSHA256=hash(JSON.stringify(captureYuanmingyuanState(source).state));
    distance=await createBuildingDistanceAsset(source,{id:expectedSourceId,sourceArchiveDigest:sourceManifest.sourceDigest,maximumErrorWorld,candidateProvider:zhengjuesiDistanceCandidates,candidateError:zhengjuesiDistanceCandidateError,signal,onProgress});memory.afterBuild=process.memoryUsage();
    if(hash(JSON.stringify(captureYuanmingyuanState(source).state))!==originalStateSHA256)throw new Error('Distance builder mutated the complete original archive state.');
    distance.report.provenance={...identity,sourceArchiveVisualReview:sourceVisualReview,sourceDiagnosticsAcceptance:sourceManifest.sourceDiagnosticsAcceptance??false};
    const reportBytes=Buffer.from(JSON.stringify(distance.report)),distanceReportSHA256=hash(reportBytes),observe=observeResources(source,distance);
    const archive=await serializeYuanmingyuanArchive(distance,{id,sourceSHA256:sources});checkpoint(signal);memory.afterExactRoundtrip=process.memoryUsage();
    archive.metadata.verification={...archive.metadata.verification,mode:'exact-derived-distance-buffers-and-Three-runtime-state',simplified:distance.report.distanceTriangles<distance.report.originalTriangles,geometryReordered:true,fullSourceVisualEquivalence:false,comparedExactlyAgainst:'derived distance result only'};
    archive.metadata.distance={report:distance.report,sha256:distanceReportSHA256};const runtime=Buffer.from(JSON.stringify(archive.metadata,null,2)+'\n');
    if(hash(JSON.stringify(captureYuanmingyuanState(source).state))!==originalStateSHA256)throw new Error('Distance serialization mutated borrowed full source resources.');
    if(JSON.stringify(await producerSources())!==JSON.stringify(sources)||hash(await readFile(join(sourceDirectory,'manifest.json')))!==identity.sourceManifestSHA256)throw new Error('Source or producer changed during this export.');
    const distanceResourceDisposal=distance.dispose();source.dispose();disposed=true;const combinedResourceDisposal=observe();memory.afterDisposal=process.memoryUsage();
    const manifest={schema:1,id,kind:'yuanmingyuan-building-distance-pilot',exportedAt:new Date().toISOString(),sourceDigest:digest,sourceSHA256:sources,distance:{report:distance.report,sha256:distanceReportSHA256},glb:{url:id+'.glb',sha256:hash(archive.glb),bytes:archive.glb.length},runtime:{url:id+'.runtime.json',sha256:hash(runtime),bytes:runtime.length},verification:archive.metadata.verification,sourceDiagnosticsAcceptance:false,nativeArchiveVisualReview:false,distanceResourceDisposal,combinedResourceDisposal,memoryBytes:memory,resourceUsage:process.resourceUsage(),elapsedMilliseconds:performance.now()-started};
    await writeFile(join(temporary,id+'.glb'),archive.glb);await writeFile(join(temporary,id+'.runtime.json'),runtime);await writeFile(join(temporary,'distance-report.json'),reportBytes);await writeFile(join(temporary,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await rename(temporary,output);success=true;
    checkpoint(signal);const transport=await packYuanmingyuanArchive({id,archiveDirectory:output,publicRoot});
    const publicRelative=relative(resolve(world,'public'),transport.output),manifestURL=publicRelative.startsWith('..')?null:'/'+publicRelative.split('\\').join('/')+'/manifest.json';
    return {output,manifestURL,sourceArchiveDigest:sourceManifest.sourceDigest,distanceReportSHA256,manifestSHA256:hash(await readFile(join(transport.output,'manifest.json'))),report:distance.report,manifest,transport:{output:transport.output,manifest:transport.manifest}};
  }finally{try{if(!disposed){distance?.dispose();source?.dispose();}}finally{if(!success)await rm(temporary,{recursive:true,force:true});}}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const argv=process.argv.slice(2),args={};for(let i=0;i<argv.length;i+=2){if(!['--archive','--output','--maximum-error','--public-root'].includes(argv[i])||!argv[i+1])throw new Error('Use --archive <raw-directory> --output <new-directory> --maximum-error <world-metres> [--public-root <directory>].');args[argv[i]]=argv[i+1];}
  try{console.log(JSON.stringify(await exportZhengjuesiDistance({archiveDirectory:args['--archive'],outputDirectory:args['--output'],maximumErrorWorld:Number(args['--maximum-error']),...(args['--public-root']?{publicRoot:args['--public-root']}:{})}),null,2));}
  catch(error){console.error(JSON.stringify({error:error.message,stack:error.stack,memoryBytes:process.memoryUsage(),resourceUsage:process.resourceUsage()}));process.exitCode=1;}
}
