import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { captureYuanmingyuanState, serializeYuanmingyuanArchive, writeYuanmingyuanArchiveSource, verifyYuanmingyuanArchiveSource, packYuanmingyuanArchive } from '../scripts/export-yuanmingyuan-assets.mjs';
import { inspectArchiveGLB, restoreYuanmingyuanArchive, loadYuanmingyuanArchive } from '../src/yuanmingyuan/asset-archive.js';
import { createArchiveSpecimen } from './fixtures/xieqiqu-archive-specimen.mjs';
import { xieqiquArchiveBudget } from '../scripts/export-xieqiqu-low-peak.mjs';

const world=fileURLToPath(new URL('..',import.meta.url)),worker=fileURLToPath(new URL('./fixtures/xieqiqu-archive-stage-worker.mjs',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),json=value=>JSON.stringify(value,null,2)+'\n',quick=()=>Promise.resolve();
async function temporary(t){const path=await mkdtemp(join(tmpdir(),'xieqiqu-stages-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
function child(phase,path,marker){return spawnSync(process.execPath,['--max-old-space-size=256',worker,phase,path,marker],{cwd:world,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});}
function succeeded(result){assert.equal(result.status,0,result.stderr||result.stdout);}
async function source(t){const root=await temporary(t),directory=join(root,'raw'),marker=join(root,'source-calls.txt');const a=child('a',directory,marker);succeeded(a);return{root,directory,marker,a,candidate:JSON.parse(await readFile(join(directory,'candidate.json')))};}
async function absent(path){await assert.rejects(readFile(path),{code:'ENOENT'});}

test('real A exits before B restores, and only B admits the exact independent source witness',async t=>{
  const f=await source(t);await absent(join(f.directory,'manifest.json'));
  await assert.rejects(packYuanmingyuanArchive({id:'staged-fixture',archiveDirectory:f.directory,publicRoot:join(f.root,'public')}),{code:'ENOENT'});
  const before=await readFile(f.marker,'utf8'),sourceWitnessBytes=await readFile(join(f.directory,'source-witness.json'));
  const b=child('b',f.directory,f.marker);succeeded(b);assert.equal(await readFile(f.marker,'utf8'),before,'verification constructed no source');
  const manifest=JSON.parse(await readFile(join(f.directory,'manifest.json'))),metadata=JSON.parse(await readFile(join(f.directory,manifest.runtime.url))),witness=JSON.parse(sourceWitnessBytes);
  assert.notEqual(manifest.stagedExport.sourceProcessId,manifest.stagedExport.verifierProcessId);assert.notEqual(manifest.stagedExport.sourceProcessId,process.pid);assert.notEqual(manifest.stagedExport.verifierProcessId,process.pid);
  assert.equal(manifest.verification.exactRoundtripPassed,true);assert.equal(manifest.nativeArchiveVisualReview,false);assert.equal(manifest.verification.independentSourceWitness.sha256,hash(sourceWitnessBytes));
  assert.equal(manifest.sourceResourceDisposal.eachDisposedExactlyOnce,true);assert.equal(manifest.verification.restoredResourceDisposal.eachDisposedExactlyOnce,true);
  const glb=await readFile(join(f.directory,manifest.glb.url)),owner=await restoreYuanmingyuanArchive(glb,metadata,{yieldControl:quick});t.after(owner.dispose);
  assert.deepEqual(captureYuanmingyuanState(owner).state,witness.state);
  const mesh=owner.group.getObjectByName('indexed surface'),instances=owner.group.getObjectByName('literal instances'),material=mesh.material[0];
  assert.deepEqual([...mesh.geometry.index.array],[0,1,2,2,1,3,0,0,1]);assert.deepEqual([...mesh.geometry.attributes.normal.array],[0,0,2,0,0,2,0,0,2,0,0,2]);
  assert.deepEqual([...material.map.image.data],[11,72,203,0,255,2,49,1,13,124,5,201,209,19,111,255]);
  assert.equal(material.transmission,.37);assert.equal(material.side,THREE.DoubleSide);assert.equal(material.shadowSide,THREE.BackSide);assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(material.roughnessMap.colorSpace,THREE.NoColorSpace);assert.equal(material.roughnessMap.source,material.map.source);
  assert.equal(instances.geometry,mesh.geometry);assert.equal(instances.material,material);assert.equal(instances.count,3);assert.equal(instances.instanceColor.count,3);assert.equal(mesh.layers.mask,8);assert.equal(mesh.renderOrder,4);assert.equal(mesh.castShadow,true);assert.equal(owner.group.getObjectByName('hidden exact geometry').visible,false);
  assert.equal(owner.group.getObjectByName('nonindexed water').geometry.index,null);
  const document=await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(glb);assert.equal(document.getRoot().listMeshes().length,4);
  for(const sample of witness.samples){owner.update(sample.time);assert.equal(hash(JSON.stringify(captureYuanmingyuanState(owner).state)),sample.stateSHA256);}
  assert.deepEqual(await readFile(join(f.directory,'source-witness.json')),sourceWitnessBytes,'original witness remains intact');
  await assert.rejects(verifyYuanmingyuanArchiveSource({archiveDirectory:f.directory}),/already exists/);
  console.log('STAGED_REAL_PROCESSES '+JSON.stringify({sourceProcessId:manifest.stagedExport.sourceProcessId,verifierProcessId:manifest.stagedExport.verifierProcessId,counts:manifest.verification.counts,sourceDisposal:manifest.sourceResourceDisposal,restoredDisposal:manifest.verification.restoredResourceDisposal,sourceCalls:before.trim().split('\n').length,glbBytes:glb.length,sourceRSS:manifest.stagedExport.sourceMaxRSSBytes,restoreRSS:manifest.stagedExport.verifierMaxRSSBytes}));
});

// Re-sign the altered archive, so its own GLB/runtime hashes all agree. Only
// independently captured source evidence can reject these semantic changes.
async function resign(directory,kind){
  const c=JSON.parse(await readFile(join(directory,'candidate.json'))),m=JSON.parse(await readFile(join(directory,c.runtime.url))),glb=await readFile(join(directory,c.glb.url));
  if(['index','normal','uv','pixels'].includes(kind)){
    const recordId=kind==='pixels'?m.images[0].buffer:m.attributes[kind==='index'?m.geometries[0].index:m.geometries[0].attributes[kind]].buffer;
    const record=m.buffers[recordId],{json:definition,binary}=inspectArchiveGLB(glb),view=definition.bufferViews[record.bufferView],offset=(view.byteOffset??0)+(record.byteOffset??0),bytes=binary.subarray(offset,offset+record.byteLength);
    if(kind==='index')new DataView(bytes.buffer,bytes.byteOffset,bytes.length).setUint16(0,2,true);else if(kind==='pixels')bytes[0]^=1;else new DataView(bytes.buffer,bytes.byteOffset,bytes.length).setFloat32(0,.123,true);
    record.sha256=hash(bytes);c.glb.sha256=hash(glb);m.glb.sha256=c.glb.sha256;await writeFile(join(directory,c.glb.url),glb);
  }else if(kind==='material'){m.materials[0].properties.depthWrite=true;m.materials[0].properties.roughness=.2;}
  else if(kind==='sharing')m.nodes.find(n=>n.type==='InstancedMesh').geometry=1;
  else if(kind==='classification')m.nodes[0].properties.userData.museumEntryId='different-courtyard';
  else if(kind==='animation')m.animations.find(a=>a.role==='flow').role='surface';
  const runtime=Buffer.from(json(m));c.runtime.sha256=hash(runtime);c.runtime.bytes=runtime.length;await writeFile(join(directory,c.runtime.url),runtime);await writeFile(join(directory,'candidate.json'),json(c));
}
test('re-signed topology, normals, UV, pixels, materials, sharing, classification and water motion cannot self-certify',async t=>{
  const f=await source(t),results=[];
  for(const kind of ['index','normal','uv','pixels','material','sharing','classification','animation']){
    const directory=join(f.root,kind);await cp(f.directory,directory,{recursive:true});await resign(directory,kind);const result=child('b',directory,f.marker);
    assert.notEqual(result.status,0,kind);assert.match(result.stderr,/Independent source (?:witness|animation witness) mismatch/,kind);await absent(join(directory,'manifest.json'));await absent(join(directory,'staged-fixture.runtime.json'));
    const events=JSON.parse(result.stdout.trim().split('\n').at(-1)).events,disposal=events.find(e=>e.phase==='failure-restored-disposed');assert.equal(disposal?.restoredResourceDisposal.eachDisposedExactlyOnce,true,kind);
    assert.deepEqual((await readdir(directory)).filter(name=>name.includes('.pending-')),[]);results.push({kind,rejected:true,disposed:true});
  }
  assert.equal((await readFile(f.marker,'utf8')).trim().split('\n').length,1);console.log('STAGED_RESIGNED_CORRUPTION '+JSON.stringify(results));
});

test('candidate and witness hash corruption stops B without an admitted manifest',async t=>{
  const f=await source(t),path=join(f.directory,'source-witness.json'),bytes=await readFile(path);bytes[bytes.length-2]^=1;await writeFile(path,bytes);
  const result=child('b',f.directory,f.marker);assert.notEqual(result.status,0);assert.match(result.stderr,/Candidate SHA256 or byte length changed/);await absent(join(f.directory,'manifest.json'));
});

test('A consumes its source and cleans only its new pending directory on limit, guard, and in-write cancellation',async t=>{
  const root=await temporary(t);await writeFile(join(root,'old-evidence'),'retain');
  for(const cause of ['ceiling','source-guard','cancel']){
    const asset=createArchiveSpecimen(),captured=captureYuanmingyuanState(asset),events=new Map(),controller=new AbortController();
    for(const resource of [...captured.objects.geometries,...captured.objects.materials,...captured.objects.textures,...captured.objects.nodes.filter(n=>n.isInstancedMesh)]){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}
    const directory=join(root,cause);
    await assert.rejects(writeYuanmingyuanArchiveSource(asset,{id:'staged-fixture',outputDirectory:directory,maximumGLBBytes:cause==='ceiling'?32:1024*1024,validateSource:()=>{if(cause==='source-guard')throw new Error('count guard');},signal:controller.signal,onProgress:event=>{if(cause==='cancel'&&event.phase==='write-glb')controller.abort();}}),cause==='ceiling'?/byte ceiling/:cause==='source-guard'?/count guard/:{name:'AbortError'});
    assert.ok([...events.values()].every(n=>n===1));assert.equal(asset.group.children.length,0);await absent(directory);
  }
  assert.deepEqual(await readdir(root),['old-evidence']);assert.equal(await readFile(join(root,'old-evidence'),'utf8'),'retain');
});

test('same-process verification is explicitly rejected even after source disposal',async t=>{
  const root=await temporary(t),directory=join(root,'raw');await writeYuanmingyuanArchiveSource(createArchiveSpecimen(),{id:'staged-fixture',outputDirectory:directory});
  await assert.rejects(verifyYuanmingyuanArchiveSource({archiveDirectory:directory}),/different process/);await absent(join(directory,'manifest.json'));
});

test('a candidate permits one active verifier, and cancelled verification releases its lock and remains unapproved',async t=>{
  const f=await source(t),controller=new AbortController();
  await assert.rejects(verifyYuanmingyuanArchiveSource({archiveDirectory:f.directory,signal:controller.signal,onProgress:event=>{if(event.phase==='restore-materials')controller.abort();}}),{name:'AbortError'});
  await absent(join(f.directory,'manifest.json'));assert.ok(!(await readdir(f.directory)).includes('.verification.pending'));
  const attempts=await Promise.allSettled([verifyYuanmingyuanArchiveSource({archiveDirectory:f.directory}),verifyYuanmingyuanArchiveSource({archiveDirectory:f.directory})]);
  assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1);assert.equal(attempts.filter(result=>result.status==='rejected').length,1);
  assert.equal(attempts.find(result=>result.status==='rejected').reason.code,'EEXIST');
  assert.ok(!(await readdir(f.directory)).includes('.verification.pending'));
  assert.equal(JSON.parse(await readFile(join(f.directory,'manifest.json'))).verification.exactRoundtripPassed,true);
});

test('external gzip scratch publishes exact parts without leaving a whole gzip copy on the public volume',async t=>{
  const f=await source(t);succeeded(child('b',f.directory,f.marker));const publicRoot=join(f.root,'public'),scratchRoot=join(f.root,'external-scratch');
  await mkdir(scratchRoot);await writeFile(join(scratchRoot,'older-evidence'),'retain');
  const events=[],packed=await packYuanmingyuanArchive({id:'staged-fixture',archiveDirectory:f.directory,publicRoot,scratchRoot,partBytes:2048,onProgress:event=>events.push(event)});
  assert.ok(packed.manifest.glb.parts.length>1);assert.deepEqual(await readdir(scratchRoot),['older-evidence']);assert.ok(!(await readdir(packed.output)).includes('staged-fixture.glb.gzip.bin'));
  assert.ok(events.some(e=>e.phase==='gzip-scratch-pending'&&e.directory.startsWith(scratchRoot)));
  const actual=await loadYuanmingyuanArchive(packed.manifest,{fetchImpl:async url=>new Response(await readFile(join(packed.output,url))),yieldControl:quick});t.after(actual.dispose);
  const witness=JSON.parse(await readFile(join(f.directory,'source-witness.json')));assert.deepEqual(captureYuanmingyuanState(actual).state,witness.state);
  const before=await readFile(join(f.directory,'staged-fixture.glb'));assert.equal(hash(before),packed.manifest.glb.sha256);
  await assert.rejects(packYuanmingyuanArchive({id:'staged-fixture',archiveDirectory:f.directory,publicRoot,scratchRoot}),/already exists/);assert.deepEqual(await readdir(scratchRoot),['older-evidence']);
});

test('insufficient actual publication space and gzip cancellation leave raw and old public evidence intact',async t=>{
  const f=await source(t);succeeded(child('b',f.directory,f.marker));const publicRoot=join(f.root,'public'),scratchRoot=join(f.root,'external-scratch');await mkdir(publicRoot);await writeFile(join(publicRoot,'old'),'retain');
  for(const mode of ['space','cancel']){
    const controller=new AbortController(),events=[];
    await assert.rejects(packYuanmingyuanArchive({id:'staged-fixture',archiveDirectory:f.directory,publicRoot,scratchRoot,partBytes:2048,minimumPublicFreeBytes:mode==='space'?Number.MAX_SAFE_INTEGER:0,signal:controller.signal,onProgress:event=>{events.push(event);if(mode==='cancel'&&event.phase==='gzip-verified')controller.abort();}}),mode==='space'?/Publication needs/:{name:'AbortError'});
    assert.ok(events.some(e=>e.phase==='gzip-verified'));assert.deepEqual(await readdir(join(publicRoot,'staged-fixture')),[]);assert.deepEqual(await readdir(scratchRoot),[]);assert.equal(await readFile(join(publicRoot,'old'),'utf8'),'retain');
  }
  assert.equal(hash(await readFile(join(f.directory,'staged-fixture.glb'))),f.candidate.glb.sha256);
});

test('legacy API still restores the same independent literal source after factoring shared GLB chunks',async t=>{
  const asset=createArchiveSpecimen();t.after(asset.dispose);asset.update(0);const baseline=captureYuanmingyuanState(asset).state;
  const legacy=await serializeYuanmingyuanArchive(asset,{id:'staged-fixture'}),restored=await restoreYuanmingyuanArchive(legacy.glb,legacy.metadata,{yieldControl:quick});t.after(restored.dispose);
  assert.equal(legacy.metadata.verification.exactRoundtripPassed,true);assert.deepEqual(captureYuanmingyuanState(restored).state,baseline);assert.deepEqual(captureYuanmingyuanState(asset).state,baseline);
});

test('job CLI cannot implicitly select a factory or another asset, and budget distinguishes estimates from measurements',()=>{
  const script=resolve(world,'scripts/export-xieqiqu-low-peak.mjs');
  for(const args of [[],['--id','jiuzhou'],['--phase','all','--job','missing']]){const result=spawnSync(process.execPath,[script,...args],{cwd:world,encoding:'utf8'});assert.notEqual(result.status,0);assert.ok(!result.stdout.includes('factory-start'));}
  const help=spawnSync(process.execPath,[script,'--help'],{cwd:world,encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/Light preparation/);
  const budget=xieqiquArchiveBudget(100);assert.equal(budget.estimate.rawCopies,1);assert.equal(budget.estimate.publicFinalBytes,null);assert.equal(budget.estimate.sourceGeometryBytes,663767424);assert.ok(budget.estimate.workPeakConservativeBytes<budget.limits.minimumWorkFreeBytes);
});
