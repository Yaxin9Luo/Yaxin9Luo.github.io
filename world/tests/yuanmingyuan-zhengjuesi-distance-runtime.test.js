import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {serializeYuanmingyuanArchive} from '../scripts/export-yuanmingyuan-assets.mjs';
import {exportZhengjuesiDistance} from '../scripts/zhengjuesi-distance-export.mjs';
import {loadBuildingDistanceArchive,createBuildingDistanceSelection,validateBuildingDistanceReport} from '../src/yuanmingyuan/zhengjuesi-distance-runtime.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('tiny real archive exports gzip-bin and loads over HTTP with both hashes and explicit native admission',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'zheng-distance-fixture-')),raw=join(temporary,'source'),out=join(temporary,'derived'),publicRoot=join(temporary,'public');await mkdir(raw);
  const geometry=new RoundedBoxGeometry(1,1,1,2,.022);geometry.name='zhengjuesi-prototype-dressed-stone';const map=new THREE.DataTexture(new Uint8Array([32,87,19,255, 210,180,34,255, 160,150,147,255, 90,70,60,255]),2,2);map.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshStandardMaterial({map,roughness:.91}),group=new THREE.Group(),mesh=new THREE.InstancedMesh(geometry,material,3);group.add(mesh);
  for(let i=0;i<3;i++)mesh.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(i,0,0),new THREE.Quaternion(),new THREE.Vector3(.4,.04,.35)));
  let server,loaded;
  try{
    const sourceId='small-source',archive=await serializeYuanmingyuanArchive({group},{id:sourceId});await writeFile(join(raw,sourceId+'.glb'),archive.glb);await writeFile(join(raw,sourceId+'.runtime.json'),archive.runtime);
    await writeFile(join(raw,'manifest.json'),JSON.stringify({schema:1,id:sourceId,sourceDigest:'b'.repeat(64),verification:archive.metadata.verification,glb:{url:sourceId+'.glb',sha256:hash(archive.glb),bytes:archive.glb.length},runtime:{url:sourceId+'.runtime.json',sha256:hash(archive.runtime),bytes:archive.runtime.length}}));
    const exported=await exportZhengjuesiDistance({archiveDirectory:raw,outputDirectory:out,publicRoot,maximumErrorWorld:.04,expectedSourceId:sourceId,sourceVisualReview:'fixture only; never native reviewed'});
    assert.equal(exported.report.originalTriangles,900);assert.equal(exported.report.distanceTriangles,36);assert.equal(exported.report.representedInstances,3);assert.equal(exported.manifest.verification.exactRoundtripPassed,true);assert.equal(exported.manifest.verification.simplified,true);assert.equal(exported.manifest.verification.fullSourceVisualEquivalence,false);assert.equal(exported.manifest.nativeArchiveVisualReview,false);assert.equal(exported.manifest.combinedResourceDisposal.disposedExactlyOnce,exported.manifest.combinedResourceDisposal.reachableUniqueResources);
    const directory=exported.transport.output,requests=[];server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://fixture').pathname).slice(1);if(name.includes('/')||!name){res.writeHead(404);res.end();return;}const bytes=await readFile(join(directory,name));requests.push(name);res.writeHead(200,{'Content-Type':name.endsWith('.json')?'application/json':'application/octet-stream','Content-Length':bytes.length});res.end(bytes);}catch{res.writeHead(404);res.end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}/`,manifestURL=base+'manifest.json';
    const manifest=JSON.parse(await readFile(join(directory,'manifest.json'))),head=await fetch(base+manifest.glb.url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-encoding'),null);assert(manifest.glb.url.endsWith('.glb.gzip.bin'));assert(manifest.runtime.url.endsWith('.runtime.json.gzip.bin'));
    loaded=await loadBuildingDistanceArchive({manifestURL,expectedManifestSHA256:exported.manifestSHA256},{yieldControl:async()=>{}});assert.equal(loaded.distance.reportSHA256,exported.distanceReportSHA256);assert.equal(loaded.distance.manifestSHA256,exported.manifestSHA256);
    const camera=new THREE.PerspectiveCamera(40,3200/2200,.5,2000);camera.position.set(1,0,200);camera.lookAt(1,0,0);camera.updateMatrixWorld(true);
    const frame={camera,physicalWidth:3200,physicalHeight:2200},pending=loaded.evaluate(frame);assert.equal(pending.geometricEligible,true);assert.equal(pending.eligible,false);assert.equal(pending.reason,'native-distance-review-required');
    assert.equal(loaded.evaluate({...frame,approvedDistanceSHA256:exported.distanceReportSHA256}).eligible,false,'a report-only token cannot authorize different encoded geometry');
    assert.equal(loaded.evaluate({...frame,approvedDistanceSHA256:exported.manifestSHA256}).eligible,true);
    assert.equal(loaded.evaluate({...frame,physicalWidth:16000,physicalHeight:11000,approvedDistanceSHA256:exported.manifestSHA256}).eligible,false,'actual physical dimensions determine admission');
    const before=requests.length;await assert.rejects(loadBuildingDistanceArchive({manifestURL,expectedManifestSHA256:'c'.repeat(64)}),/manifest SHA256/);assert.equal(requests.length,before+1,'reject unapproved bytes before fetching the model');
    const bad=structuredClone(exported.report);bad.representedInstances--;assert.throws(()=>validateBuildingDistanceReport(bad),/incomplete/);
    loaded.dispose();assert.equal(loaded.evaluate(frame).reason,'distance-disposed');loaded.dispose();loaded=null;
    await assert.rejects(exportZhengjuesiDistance({archiveDirectory:raw,outputDirectory:out,publicRoot,maximumErrorWorld:.04,expectedSourceId:sourceId}),/already exists/);
  }finally{loaded?.dispose();if(server)await new Promise(resolve=>server.close(resolve));mesh.dispose();geometry.dispose();material.dispose();map.dispose();await rm(temporary,{recursive:true,force:true});}
});

test('opaque transition hysteresis stays within the same physical budget and requests missing detail',()=>{
  const selection=createBuildingDistanceSelection(),frame=p=>({eligible:p<=.5,projectedErrorPhysicalPixels:p,pixelBudget:.5,reason:p<=.5?'within':'exceeded'});
  assert.equal(selection.update(frame(.41)).mode,'full');assert.equal(selection.update(frame(.39)).mode,'distance');assert.equal(selection.update(frame(.48)).mode,'distance');
  const crossing=selection.update(frame(.51),{fullReady:false});assert.equal(crossing.mode,'none');assert.equal(crossing.needsDetail,true);assert.equal(crossing.changed,true);
  assert.equal(selection.update({...frame(.1),eligible:false,reason:'native-distance-review-required'}).mode,'full');selection.reset();assert.equal(selection.update(frame(.41)).mode,'full');assert.throws(()=>createBuildingDistanceSelection({enterRatio:1}),/strictly/);
});
