#!/usr/bin/env node
// Explicit single-asset job. Preparation is light; --run requires the scheduled
// exclusive factory slot. A/B/C never coexist and never select another asset.
import { readFile, writeFile, mkdir, access, statfs, stat, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalmem } from 'node:os';

const script = fileURLToPath(import.meta.url), world = resolve(dirname(script), '..'), repo = resolve(world, '..');
const id = 'xieqiqu', MiB = 1024 ** 2, GiB = 1024 ** 3;
const entry = join(world, 'src/yuanmingyuan/xieqiqu-study.js');
const defaultWorkRoot = '/Volumes/WenshuSpace/Codex-yuanmingyuan/xieqiqu-staged-archive';
const defaultPublicRoot = join(world, 'public/assets/yuanmingyuan');
const expected = Object.freeze({ triangles: 6914244, meshes: 1265, geometries: 1265, materials: 16, textures: 9, instances: 0, waterEndpoints: 58, maximumBoundsSize: [105,22,105] });
const limits = Object.freeze({ maximumSourceBufferBytes: 800 * MiB, maximumGLBBytes: 1.5 * GiB, minimumWorkFreeBytes: 4 * GiB, minimumPublicFreeBytes: 384 * MiB, maximumRSSBytes: 4 * GiB, heapMiB: 1024, partBytes: 64 * MiB, maximumPhaseMilliseconds: 10 * 60 * 1000 });
const hash = value => createHash('sha256').update(value).digest('hex');
const encode = value => JSON.stringify(value, null, 2) + '\n';
const log = (phase, data = {}) => process.stdout.write(JSON.stringify({ time: new Date().toISOString(), processId: process.pid, phase, ...data }) + '\n');
async function exists(path) { try { await access(path); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; } }
async function available(path) { const info = await statfs(path); return { path, availableBytes: info.bavail * info.bsize, totalBytes: info.blocks * info.bsize }; }
async function requireSpace(path, bytes, phase) { const disk = await available(path); if (disk.availableBytes < bytes) throw new Error(`${phase}: ${path} needs ${bytes} free bytes; ${disk.availableBytes} available`); return disk; }

export function xieqiquArchiveBudget(sourceFreezeBytes = 0) {
  return { expected, limits, estimate: { sourceGeometryBytes: expected.triangles * 3 * 32, sourceGeometryBasis: 'Conditional nonindexed position/normal/UV Float32 estimate; production phase measures all actual arrays', texturePixelsBytesFromSource: 6 * 96 * 96 * 4 + 3 * 64 * 64 * 4, rawGLBCeilingBytes: limits.maximumGLBBytes, rawCopies: 1, metadataAndWitnessReserveBytes: 128 * MiB, sourceFreezeBytes, workPeakConservativeBytes: 2 * limits.maximumGLBBytes + 128 * MiB + sourceFreezeBytes, publicFinalBytes: null, publicPeakBasis: 'Only final gzip parts, runtime and manifest; whole gzip scratch stays on the work volume. Actual transfer bytes plus 384 MiB reserve are checked after gzip and before any parts.', sourceFactoryCount: 1, nativeReview: 'pending', memoryLimitNote: 'V8 heap does not limit ArrayBuffer/external RSS; parent polls actual process RSS every 250 ms, with a 4 GiB ceiling. This is a tripwire, not an OS allocation guarantee.' } };
}

export async function prepareXieqiquArchiveJob({ workRoot = defaultWorkRoot, publicRoot = defaultPublicRoot } = {}) {
  const { captureYuanmingyuanArchiveSources } = await import('./export-yuanmingyuan-assets.mjs');
  // Only create this task's new subtree; do not move or delete any prior data.
  await mkdir(workRoot, { recursive: true });
  const disks = { work: await requireSpace(workRoot, limits.minimumWorkFreeBytes, 'prepare'), public: await requireSpace(publicRoot, limits.minimumPublicFreeBytes, 'prepare') };
  const sourceSHA256 = await captureYuanmingyuanArchiveSources(entry, [script]);
  const sourceDigest = hash(JSON.stringify(sourceSHA256)), stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jobDirectory = join(resolve(workRoot), `${stamp}-${sourceDigest.slice(0,16)}-${randomUUID().slice(0,8)}`); await mkdir(jobDirectory);
  let sourceFreezeBytes = 0;
  for (const [path, sha256] of Object.entries(sourceSHA256)) { const bytes = await readFile(join(repo,path)); if (hash(bytes) !== sha256) throw new Error('Source changed during preparation: ' + path); const output = join(jobDirectory,'source',path); await mkdir(dirname(output),{recursive:true}); await writeFile(output,bytes,{flag:'wx'}); sourceFreezeBytes += bytes.length; }
  let workVolumeBacking = null;
  if (resolve(workRoot).startsWith('/Volumes/WenshuSpace/')) {
    const path = '/Users/yaxinluo/wenshu/禁止删除文枢空间专用_luoyaxin03.dmg', info = await stat(path);
    workVolumeBacking = { type:'preallocated-disk-image-on-main-volume-not-independent-physical-disk', path, logicalBytes:info.size, allocatedBytes:info.blocks * 512, note:'Volume free space and host free space must both be checked; preallocation is evidence, not a guarantee against APFS snapshots or concurrent writes.' };
  }
  const job = { schema:'xieqiqu-staged-export-job-v1', id, preparedAt:new Date().toISOString(), jobDirectory, publicRoot:resolve(publicRoot), sourceSHA256, sourceDigest, ...xieqiquArchiveBudget(sourceFreezeBytes), disks, workVolumeBacking, totalPhysicalMemoryBytes:totalmem(), productionExecuted:false };
  const path = join(jobDirectory,'job.json'); await writeFile(path,encode(job),{flag:'wx'}); log('prepared-no-factory',{job:path,sourceDigest,...job.estimate,disks}); return {path,job};
}

async function readJob(path) {
  const job = JSON.parse(await readFile(path));
  if (job.schema !== 'xieqiqu-staged-export-job-v1' || job.id !== id || resolve(path) !== join(job.jobDirectory,'job.json') || JSON.stringify(job.expected) !== JSON.stringify(expected) || JSON.stringify(job.limits) !== JSON.stringify(limits) || hash(JSON.stringify(job.sourceSHA256)) !== job.sourceDigest) throw new Error('Unknown or altered bounded Xieqiqu job');
  return job;
}
async function verifySourceFreeze(job) {
  for (const [path, digest] of Object.entries(job.sourceSHA256)) {
    if (!path.startsWith('world/') || path.includes('..')) throw new Error('Invalid frozen source path');
    if (hash(await readFile(join(repo,path))) !== digest || hash(await readFile(join(job.jobDirectory,'source',path))) !== digest) throw new Error('Prepared source changed: ' + path);
  }
}
const progress = event => { if (process.memoryUsage().rss > limits.maximumRSSBytes) throw new Error('Actual process RSS exceeded the bounded job ceiling'); if (event.phase !== 'write-glb' || event.bytes === event.totalBytes || event.bytes % (64 * MiB) < 8 * MiB) log(event.phase,{...event,memory:process.memoryUsage()}); };

async function executePhase(phase, jobPath) {
  const job = await readJob(jobPath); await verifySourceFreeze(job);
  if (!process.execArgv.includes(`--max-old-space-size=${limits.heapMiB}`)) throw new Error('A/B/C child must use the explicit bounded V8 heap');
  const archiveDirectory = join(job.jobDirectory,'raw'), scratchRoot = join(job.jobDirectory,'gzip-scratch');
  const api = await import('./export-yuanmingyuan-assets.mjs');
  let result;
  if (phase === 'a') {
    await requireSpace(job.jobDirectory,limits.minimumWorkFreeBytes,'before factory'); await requireSpace(job.publicRoot,limits.minimumPublicFreeBytes,'before factory');
    if (await exists(archiveDirectory)) throw new Error('Candidate already exists; never rebuild this job or duplicate its raw GLB');
    const THREE = await import('three'), module = await import('../src/yuanmingyuan/xieqiqu-study.js');
    let asset, handedOff = false;
    try {
      log('factory-start',{id,expected}); const started = performance.now(); asset = module.createXieqiquStudy();
      const counts = {triangles:0,meshes:0,instances:0}, geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set();
      asset.group.traverse(node=>{if(!node.isMesh)return;counts.meshes++;const n=node.isInstancedMesh?node.count:1;counts.instances+=node.isInstancedMesh?n:0;counts.triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*n;geometries.add(node.geometry);for(const m of [node.material,node.customDepthMaterial,node.customDistanceMaterial].flat().filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
      for(const geometry of geometries){for(const a of Object.values(geometry.attributes))buffers.add(a.array);if(geometry.index)buffers.add(geometry.index.array);}for(const texture of textures)buffers.add(texture.image.data);
      Object.assign(counts,{geometries:geometries.size,materials:materials.size,textures:textures.size,waterEndpoints:asset.diagnostics.waterEndpoints.length});
      const box=new THREE.Box3().setFromObject(asset.group),bounds={min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},bufferBytes=[...buffers].reduce((sum,array)=>sum+array.byteLength,0);
      const measurement={counts,bounds,bufferBytes,constructionMilliseconds:performance.now()-started,memory:process.memoryUsage(),maxRSSBytes:process.resourceUsage().maxRSS*1024};
      await writeFile(join(job.jobDirectory,'factory-measurement.json'),encode(measurement),{flag:'wx'});log('factory-measured',measurement);
      for(const [key,value] of Object.entries(expected))if(key!=='maximumBoundsSize'&&counts[key]!==value)throw new Error(`Bounded Xieqiqu ${key}: expected ${value}, actual ${counts[key]}; serialization stopped`);
      if(bufferBytes>limits.maximumSourceBufferBytes||bounds.size.some((v,i)=>!Number.isFinite(v)||v>expected.maximumBoundsSize[i]))throw new Error('Source array bytes or bounds exceed the bounded Xieqiqu job');
      // Drop the measurement's resource sets before serialization; they are
      // borrowed references, not additional source copies or disposal owners.
      geometries.clear();materials.clear();textures.clear();buffers.clear();
      handedOff=true;result=await api.writeYuanmingyuanArchiveSource(asset,{id,sourceSHA256:job.sourceSHA256,outputDirectory:archiveDirectory,maximumGLBBytes:limits.maximumGLBBytes,beforeCommit:()=>verifySourceFreeze(job),onProgress:progress});
    } finally {if(!handedOff&&asset){asset.dispose();log('factory-failure-disposed');}}
  } else if (phase === 'b') {
    if (!(await exists(join(job.jobDirectory,'phase-a-exit.json')))) throw new Error('Phase A must have exited before independent verification');
    result=await api.verifyYuanmingyuanArchiveSource({archiveDirectory,onProgress:progress});
  } else if (phase === 'c') {
    if (!(await exists(join(job.jobDirectory,'phase-b-exit.json')))) throw new Error('Phase B must have exited before compression');
    const manifest=JSON.parse(await readFile(join(archiveDirectory,'manifest.json')));
    await requireSpace(job.jobDirectory,Math.ceil(manifest.glb.bytes*1.02)+manifest.runtime.bytes+64*MiB,'before external gzip');
    result=await api.packYuanmingyuanArchive({id,archiveDirectory,publicRoot:job.publicRoot,partBytes:limits.partBytes,scratchRoot,minimumPublicFreeBytes:limits.minimumPublicFreeBytes,onProgress:progress});
  } else throw new Error('Only a, b or c is a production phase');
  await verifySourceFreeze(job);
  await writeFile(join(job.jobDirectory,`phase-${phase}-result.json`),encode(result),{flag:'wx'});
  log('phase-complete',{phaseName:phase,id,maxRSSBytes:process.resourceUsage().maxRSS*1024,memory:process.memoryUsage(),output:result.output,manifestURL:result.manifestURL??null});
}

/** Await child exit, not merely a completion message. Retry skips completed
 * phases and never constructs a second source for an existing candidate. */
export async function runPreparedXieqiquArchive(jobPath) {
  const job=await readJob(jobPath);await verifySourceFreeze(job);
  for(const phase of ['a','b','c']){
    const receipt=join(job.jobDirectory,`phase-${phase}-exit.json`);
    if(await exists(receipt)){const previous=JSON.parse(await readFile(receipt));if(previous.exitCode!==0)throw new Error('Invalid completed phase receipt');log('skip-completed-phase',{phaseName:phase,processId:previous.processId});continue;}
    const stamp=Date.now(),logPath=join(job.jobDirectory,`phase-${phase}-${stamp}.log`),stream=createWriteStream(logPath,{flags:'wx'}),started=performance.now(),pendingPaths=new Set();
    let peakRSSBytes=0,stopReason=null,polling=false,checkingDisk=false,buffer='',killTimer;
    const child=spawn(process.execPath,[`--max-old-space-size=${limits.heapMiB}`,script,'--phase',phase,'--job',resolve(jobPath)],{cwd:world,stdio:['ignore','pipe','pipe']});
    const stop=reason=>{if(stopReason)return;stopReason=reason;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),2000);};
    const interrupt=()=>stop('Interrupted by caller');process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    child.stdout.on('data',bytes=>{stream.write(bytes);buffer+=bytes.toString();let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const event=JSON.parse(line);if(['candidate-pending','verification-pending','public-pending','gzip-scratch-pending'].includes(event.phase))pendingPaths.add(event.directory);if(event.phase!=='write-glb')process.stdout.write(line+'\n');}catch{process.stdout.write(line+'\n');}}});
    child.stderr.on('data',bytes=>stream.write(bytes));
    const timer=setInterval(()=>{if(performance.now()-started>limits.maximumPhaseMilliseconds)stop('Phase wall time exceeded 10 minutes');if(!checkingDisk){checkingDisk=true;Promise.all([requireSpace(job.publicRoot,limits.minimumPublicFreeBytes,'live host reserve'),requireSpace(job.jobDirectory,128*MiB,'live work reserve')]).catch(error=>stop(error.message)).finally(()=>{checkingDisk=false;});}if(polling||!child.pid)return;polling=true;execFile('/bin/ps',['-o','rss=','-p',String(child.pid)],(error,stdout)=>{polling=false;if(!error){const rss=Number(stdout.trim())*1024;if(Number.isFinite(rss)){peakRSSBytes=Math.max(peakRSSBytes,rss);if(rss>limits.maximumRSSBytes)stop('Observed process RSS exceeded 4 GiB');}}});},250);
    let exitCode,signal,error;
    try {({exitCode,signal,error}=await new Promise(done=>{child.once('error',error=>done({exitCode:null,error:String(error)}));child.once('close',(exitCode,signal)=>done({exitCode,signal}));}));}
    finally {clearInterval(timer);clearTimeout(killTimer);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await new Promise(done=>stream.end(done));}
    const result={phase,processId:child.pid,exitCode,signal,error:error??null,stopReason,observedPeakRSSBytes:peakRSSBytes,elapsedMilliseconds:performance.now()-started,logPath};
    if(exitCode!==0||stopReason||error){
      // Only directories this child reported creating are eligible for cleanup.
      const allowed=new Set([join(job.jobDirectory,'raw')+`.pending-${child.pid}`,join(job.jobDirectory,'raw','.verification.pending'),join(job.jobDirectory,'gzip-scratch',`${id}-${job.sourceDigest.slice(0,16)}.pending-${child.pid}`),join(job.publicRoot,id,`${job.sourceDigest.slice(0,16)}-gzip-bin-v2.pending-${child.pid}`)]);
      for(const path of pendingPaths)if(allowed.has(path))await rm(path,{recursive:true,force:true});
      if(pendingPaths.has(join(job.jobDirectory,'raw','.verification.pending'))&&!await exists(join(job.jobDirectory,'raw','manifest.json'))){for(const name of [`${id}.runtime.json.pending-${child.pid}`,`manifest.json.pending-${child.pid}`,`${id}.runtime.json`])await rm(join(job.jobDirectory,'raw',name),{force:true});}
      await writeFile(join(job.jobDirectory,`phase-${phase}-failure-${stamp}.json`),encode(result),{flag:'wx'});throw new Error(`Phase ${phase} failed; source/old evidence retained. ${stopReason??error??'See '+logPath}`);
    }
    await writeFile(receipt,encode(result),{flag:'wx'});log('child-exited-resources-released',result);
  }
  const result=JSON.parse(await readFile(join(job.jobDirectory,'phase-c-result.json')));log('archive-job-complete',{manifestURL:result.manifestURL,sourceDigest:job.sourceDigest});return result;
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help'){console.log('Light preparation: node scripts/export-xieqiqu-low-peak.mjs --prepare [--work-root <new-task-root>] [--public-root <public-archive-root>]\nAfter ROOT grants the exclusive slot: node scripts/export-xieqiqu-low-peak.mjs --run <prepared-job.json>\nOne Xieqiqu source, then independent verification, then external-scratch gzip. No other factories or GPU.');return;}
  if(args[0]==='--prepare'){const options={};for(let i=1;i<args.length;i+=2){const key={'--work-root':'workRoot','--public-root':'publicRoot'}[args[i]];if(!key||!args[i+1]||options[key])throw new Error('Invalid preparation paths');options[key]=args[i+1];}await prepareXieqiquArchiveJob(options);return;}
  if(args.length===2&&args[0]==='--run'){await runPreparedXieqiquArchive(args[1]);return;}
  if(args.length===4&&args[0]==='--phase'&&args[2]==='--job'){await executePhase(args[1],args[3]);return;}
  throw new Error('Explicit --prepare or scheduled --run is required; no implicit factory execution');
}
if(process.argv[1]&&resolve(process.argv[1])===script){try{await main();}catch(error){log('failed',{error:error.stack});process.exitCode=1;}}
