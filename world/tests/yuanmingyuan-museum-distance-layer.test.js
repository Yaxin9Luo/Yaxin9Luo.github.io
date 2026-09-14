import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createMuseumDistanceLayer} from '../src/yuanmingyuan/museum-distance-layer.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';
import {projectedOverviewError} from '../src/yuanmingyuan/asset-overview.js';
import {serializeYuanmingyuanArchive} from '../scripts/export-yuanmingyuan-assets.mjs';
import {exportZhengjuesiDistance} from '../scripts/zhengjuesi-distance-export.mjs';

const baseURL='https://museum.test/world/index.html',hash=bytes=>createHash('sha256').update(bytes).digest('hex'),encode=value=>Buffer.from(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};},flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(id='a',mutate=()=>{}){
  const source={id,sourceDigest:'c'.repeat(64),transport:{sourceManifestSHA256:'b'.repeat(64)},verification:{exactRoundtripPassed:true,simplified:false,quantized:false}};
  const report={schema:1,kind:'yuanmingyuan-building-distance',id,sourceArchiveDigest:source.sourceDigest,sourceRootWorldMatrix:new THREE.Matrix4().toArray(),fullArchiveRetained:true,texturePixelsUnchanged:true,originalInstances:1,representedInstances:1,requestedMaximumErrorWorld:.05,maximumErrorArchiveWorld:.04,boundsArchiveWorld:{min:[-1,-1,-1],max:[1,1,1]},provenance:{sourceManifestSHA256:source.transport.sourceManifestSHA256}};
  const manifest={kind:'yuanmingyuan-building-distance-pilot',id:id+'-distance',distance:{report},nativeArchiveVisualReview:true,glb:{url:'model.glb',sha256:'d'.repeat(64)},runtime:{url:'runtime.json',sha256:'e'.repeat(64)}};mutate({source,report,manifest});manifest.distance.sha256=hash(encode(report));
  const sourceBytes=encode(source),distanceBytes=encode(manifest),descriptor={id,assetId:id,site:{position:[0,0,0],scale:1,rotationY:0},source:{manifestURL:`/full/${id}/manifest.json`,approvedManifestSHA256:hash(sourceBytes)},manifestURL:`/distance/${id}/manifest.json`,expectedManifestSHA256:hash(distanceBytes),approvedDistanceSHA256:hash(distanceBytes)};
  const entries=new Map([[new URL(descriptor.source.manifestURL,baseURL).href,sourceBytes],[new URL(descriptor.manifestURL,baseURL).href,distanceBytes]]);
  return {id,source,report,manifest,descriptor,entries};
}
function fetcher(entries,calls=[]){return async(url,{signal}={})=>{signal?.throwIfAborted();calls.push(url);const bytes=entries.get(url);return bytes?new Response(bytes):new Response('',{status:404});};}
function owner(f){return {group:new THREE.Group(),disposed:0,pixels:.1,evaluations:[],distance:{report:f.report,reportSHA256:f.manifest.distance.sha256,manifestSHA256:f.descriptor.expectedManifestSHA256},evaluate(options){this.evaluations.push(options);const pixels=options.camera.userData.testPixels??this.pixels;return {eligible:pixels<=.5,nativeApproved:true,manifestSHA256:this.distance.manifestSHA256,projectedErrorPhysicalPixels:pixels,nearestSourceDepth:100,reason:'fixture-view'};},dispose(){this.disposed++;this.group.clear();}};}
function view({width=2435,height=2200,distance=1000,target=new THREE.Vector3(),position}={}){const camera=new THREE.PerspectiveCamera(40,width/height,5,3000);camera.position.copy(position??target.clone().add(new THREE.Vector3(0,40,distance)));camera.lookAt(target);return {camera,renderer:{getDrawingBufferSize:v=>v.set(width,height)}};}
function layerFor(f,asset=owner(f),options={}){return createMuseumDistanceLayer({root:new THREE.Group(),descriptors:[f.descriptor],baseURL,fetchImpl:fetcher(f.entries),loadDistance:async()=>asset,...options});}

test('missing or mismatched external native approval never fetches or displays, regardless of manifest claims',async()=>{
  for(const approval of [undefined,'f'.repeat(64)]){
    const f=fixture();f.descriptor.approvedDistanceSHA256=approval;let calls=0;const layer=layerFor(f,undefined,{fetchImpl:async()=>{calls++;throw new Error('must not fetch');}});
    await layer.load();const state=layer.evaluate(view());assert.equal(calls,0);assert.equal(state.visible,0);assert.equal(state.sites[0].nativeDistanceApproved,false);assert.equal(state.sites[0].loadState,'approval-required');assert.deepEqual(state.pendingFull,['a']);await layer.dispose();
  }
});

test('descriptor identity, placement, digest and origin errors do not mount anything',()=>{
  const f=fixture(),root=new THREE.Group(),options={root,baseURL,fetchImpl:fetcher(f.entries)};
  for(const d of [{...f.descriptor,site:{position:[0,NaN,0]}},{...f.descriptor,site:{position:[0,0,0],scale:0}},{...f.descriptor,source:{manifestURL:'/full',approvedManifestSHA256:'bad'}},{...f.descriptor,manifestURL:'https://other.test/model.json'}])assert.throws(()=>createMuseumDistanceLayer({...options,descriptors:[d]}));
  assert.throws(()=>createMuseumDistanceLayer({...options,descriptors:[f.descriptor,f.descriptor]}),/unique/);assert.equal(root.children.length,0);
});

test('approved full bytes, source digest, raw manifest provenance and file origin are checked before any decoder',async()=>{
  const cases=[()=>{const f=fixture();f.descriptor.source.approvedManifestSHA256='a'.repeat(64);return f;},()=>fixture('a',({report})=>{report.sourceArchiveDigest='f'.repeat(64);}),()=>fixture('a',({report})=>{report.provenance.sourceManifestSHA256='f'.repeat(64);}),()=>fixture('a',({manifest})=>{manifest.runtime.url='https://other.test/runtime.json';})];
  for(const make of cases){const f=make();let decoded=0;const layer=layerFor(f,undefined,{loadDistance:async()=>{decoded++;throw new Error('must not decode');}});await layer.load();assert.equal(decoded,0);assert.equal(layer.snapshot.sites[0].loadState,'failed');assert.equal(layer.evaluate(view()).sites[0].coverage,'coverage-gap');await layer.dispose();}
});

test('whole archive requests coalesce and decode serially; completed residents remain hidden until evaluation',async t=>{
  const a=fixture('a'),b=fixture('b'),ao=owner(a),bo=owner(b),gate=deferred(),started=deferred(),calls=[],fetches=[],entries=new Map([...a.entries,...b.entries]);
  const layer=layerFor(a,ao,{descriptors:[a.descriptor,b.descriptor],fetchImpl:fetcher(entries,fetches),loadDistance:async(entry,{fetchImpl})=>{calls.push(entry);started.resolve();await fetchImpl(entry.manifestURL);return calls.length===1?gate.promise:bo;}});t.after(()=>layer.dispose());
  const first=layer.load();assert.equal(layer.load(),first);await started.promise;assert.equal(calls.length,1);assert.equal(layer.snapshot.loaded,0);gate.resolve(ao);await first;assert.equal(calls.length,2);assert.equal(layer.snapshot.loaded,2);assert.equal(layer.snapshot.visible,0);
  assert.equal(fetches.filter(url=>url.endsWith('/a/manifest.json')).length,2,'one full and one distance request; runtime manifest replay is local');
  assert.equal(layer.evaluate(view()).visible,2);assert.equal(ao.evaluations[0].physicalWidth,2435);assert.equal(ao.evaluations[0].approvedDistanceSHA256,a.descriptor.expectedManifestSHA256);await layer.load();assert.equal(calls.length,2);
});

test('cancelled late decoder is released before its replacement starts; cancellation preserves completed owners',async t=>{
  const f=fixture(),late=owner(f),fresh=owner(f),gate=deferred(),started=deferred(),signals=[];let count=0;
  const layer=layerFor(f,fresh,{loadDistance:async(_,{signal})=>{signals.push(signal);count++;started.resolve();return count===1?gate.promise:fresh;}});t.after(()=>layer.dispose());
  const first=layer.load();await started.promise;const stopped=layer.cancel(),second=layer.load();await flush();assert.equal(count,1);assert.equal(signals[0].aborted,true);gate.resolve(late);await first;await stopped;await second;assert.equal(late.disposed,1);assert.equal(late.group.parent,null);assert.equal(fresh.disposed,0);assert.equal(layer.evaluate(view()).visible,1);await layer.cancel();assert.equal(layer.snapshot.visible,1);
});

test('lifetime abort detaches immediately and waits for ignored cancellation, without touching unrelated or full owners',async()=>{
  const a=fixture('a'),b=fixture('b'),ao=owner(a),bo=owner(b),gate=deferred(),lifetime=new AbortController(),root=new THREE.Group(),unrelated=new THREE.Group(),full=new THREE.Group();root.add(unrelated,full);let started=false;
  const layer=layerFor(a,ao,{root,signal:lifetime.signal,descriptors:[a.descriptor,b.descriptor],fetchImpl:fetcher(new Map([...a.entries,...b.entries])),loadDistance:async entry=>{if(entry.manifestURL.includes('/a/'))return ao;started=true;return gate.promise;}});
  const pending=layer.load();while(!started)await flush();layer.setFullSites([{id:'a',group:full}]);lifetime.abort();const ending=layer.dispose();assert.equal(ao.disposed,1);assert.deepEqual(root.children,[unrelated,full]);let settled=false;ending.then(()=>{settled=true;});await flush();assert.equal(settled,false);gate.resolve(bo);await pending;await ending;assert.equal(bo.disposed,1);await layer.dispose();assert.equal(bo.disposed,1);assert.equal(layer.snapshot.visible,0);
});

test('physical .4/.5 hysteresis exposes the preparation interval and coverage gap, with deduplicated notifications',async t=>{
  const f=fixture(),asset=owner(f),prepared=[],needed=[],layer=layerFor(f,asset,{onPrepareNear:p=>prepared.push(p),onNeedsFull:p=>needed.push(p)});t.after(()=>layer.dispose());await layer.load();
  asset.pixels=.2;assert.equal(layer.evaluate(view()).visible,1);assert.equal(prepared.length,0);
  asset.pixels=.31;let state=layer.evaluate(view());assert.equal(state.visible,1);assert.deepEqual(state.prepareNear,['a']);assert.equal(prepared.length,1);assert.equal(prepared[0].source.approvedManifestSHA256,f.descriptor.source.approvedManifestSHA256);
  for(const pixels of [.41,.49,.5]){asset.pixels=pixels;assert.equal(layer.evaluate(view()).visible,1);}assert.equal(prepared.length,1);assert.equal(needed.length,0);
  asset.pixels=.50001;state=layer.evaluate(view());assert.equal(state.visible,0);assert.deepEqual(state.pendingFull,['a']);assert.equal(state.sites[0].coverage,'coverage-gap');assert.equal(needed.length,1);
  asset.pixels=.41;assert.equal(layer.evaluate(view()).visible,0);assert.equal(needed.length,1);asset.pixels=.4;assert.equal(layer.evaluate(view()).visible,1);
  assert.equal(layer.evaluate(view({width:4870,height:4400})).physicalViews[0].width,4870);assert.equal(asset.evaluations.at(-1).physicalHeight,4400);
  state=layer.evaluate(view({width:0,height:0}));assert.equal(state.visible,0);assert.deepEqual(state.pendingFull,['a']);assert.match(state.viewError,/physical/);
});

test('only a ready mounted controller resource suppresses distance; request targets and retired full groups do not',async t=>{
  const f=fixture(),root=new THREE.Group(),asset=owner(f),gate=deferred(),full=new THREE.Group();let fullDisposed=0;
  const controller=createMuseumSiteController({sites:[{id:'a'},{id:'b'}],load:async site=>site.id==='a'?gate.promise:{group:new THREE.Group(),dispose(){}},mount:resource=>{root.add(resource.group);return ()=>{};}});
  const layer=layerFor(f,asset,{root,siteController:controller});t.after(async()=>{controller.dispose();await layer.dispose();});await layer.load();assert.equal(layer.evaluate(view()).visible,1);
  const pending=controller.select('a');assert.equal(layer.evaluate(view()).visible,1);gate.resolve({group:full,dispose(){fullDisposed++;}});await pending;assert.equal(layer.evaluate(view()).visible,0);assert.equal(layer.snapshot.sites[0].fullReady,true);assert.equal(asset.group.visible,true);
  const away=controller.select('b');assert.equal(fullDisposed,1);assert.equal(layer.evaluate(view()).visible,1);await away;assert.equal(layer.snapshot.sites[0].fullReady,false);
});

test('fallbacks must be visibly mounted; duplicate full owners are reported and their ownership is never taken',async t=>{
  const f=fixture(),root=new THREE.Group(),asset=owner(f),full=new THREE.Group(),second=new THREE.Group(),layer=layerFor(f,asset,{root});t.after(()=>layer.dispose());await layer.load();layer.setFullSites([{id:'a',group:full}]);assert.equal(layer.evaluate(view()).visible,1);
  root.add(full);assert.equal(layer.evaluate(view()).visible,0);assert.equal(layer.snapshot.sites[0].canReleaseFull,true);asset.pixels=.45;assert.equal(layer.evaluate(view()).sites[0].canReleaseFull,false);assert.deepEqual(layer.snapshot.pendingFull,[]);asset.pixels=.1;full.visible=false;assert.equal(layer.evaluate(view()).visible,1);full.visible=true;root.add(second);layer.setFullSites([{id:'a',group:full},{id:'a',group:second}]);assert.equal(layer.snapshot.sites[0].duplicateFullOwners,true);assert.equal(layer.snapshot.visible,0);
  await layer.dispose();assert.deepEqual(root.children,[full,second]);assert.equal(full.visible,true);
});

test('frustum is conservative demand telemetry; all supplied camera budgets constrain visibility without mutating inputs',async t=>{
  const f=fixture();f.descriptor.site.position=[2000,0,0];const asset=owner(f),layer=layerFor(f,asset);t.after(()=>layer.dispose());await layer.load();let state=layer.evaluate(view());assert.equal(state.sites[0].views[0].inFrustum,false);assert.equal(state.visible,1,'do not globally delete an eligible offscreen shadow/reflection caster');
  const reflection=view({target:new THREE.Vector3(2000,0,0)}).camera;reflection.userData.testPixels=.6;const extra={id:'water-reflection',camera:reflection,physicalWidth:1024,physicalHeight:512};state=layer.evaluate({...view(),additionalViews:[extra]});assert.equal(state.visible,0);assert.deepEqual(state.pendingFull,['a']);assert.equal(asset.evaluations.at(-1).physicalHeight,512);assert.equal(Object.hasOwn(extra,'frustum'),false);
  reflection.userData.testPixels=.1;assert.equal(layer.evaluate({...view(),additionalViews:[extra]}).visible,1);
});

test('notification reentry and immediate full fallback mounting cannot repeat requests or claim a gap after coverage exists',async t=>{
  const f=fixture(),asset=owner(f),root=new THREE.Group(),full=new THREE.Group();let prepared=0,needed=0,layer;
  layer=layerFor(f,asset,{root,onPrepareNear:()=>{prepared++;layer.evaluate(view());root.add(full);layer.setFullSites([{id:'a',group:full}]);},onNeedsFull:()=>{needed++;}});t.after(()=>layer.dispose());await layer.load();asset.pixels=.6;const state=layer.evaluate(view());assert.equal(prepared,1);assert.equal(needed,0);assert.equal(state.sites[0].fullReady,true);assert.equal(state.sites[0].coverage,'full');
});

test('failed configuration/animation and pre-aborted lifetimes release exactly once and expose missing precision',async()=>{
  const f=fixture(),bad=owner(f),fresh=owner(f);let failed=true,calls=0;const layer=layerFor(f,fresh,{loadDistance:async()=>++calls===1?bad:fresh,configure:()=>{if(failed)throw new Error('fixture configure error');}});
  await layer.load();assert.equal(bad.disposed,1);assert.equal(layer.evaluate(view()).sites[0].coverage,'coverage-gap');failed=false;await layer.load();assert.equal(layer.evaluate(view()).visible,1);fresh.update=()=>{throw new Error('fixture animation error');};layer.update(3);assert.equal(fresh.disposed,1);assert.deepEqual(layer.snapshot.pendingFull,['a']);await layer.dispose();assert.equal(fresh.disposed,1);
  const controller=new AbortController();controller.abort();const root=new THREE.Group(),stopped=layerFor(f,undefined,{root,signal:controller.signal});assert.equal((await stopped.load()).status,'disposed');assert.equal(root.children.length,0);
});

test('actual cfe62/d6a100 manifests bind the approved source using metadata only, with no production decode',async t=>{
  const fullURL=new URL('../public/assets/yuanmingyuan/zhengjuesi/cfe62c4d8102267f-gzip-bin-v1/manifest.json',import.meta.url),distanceURL=new URL('../public/assets/yuanmingyuan-distance/zhengjuesi-distance/202a091fca7d4eac-gzip-bin-v1/manifest.json',import.meta.url),fullBytes=await readFile(fullURL),distanceBytes=await readFile(distanceURL),manifest=JSON.parse(distanceBytes),report=manifest.distance.report;
  const descriptor={id:'logical-temple',assetId:'zhengjuesi',site:{position:[0,0,0],rotationY:0,scale:1},source:{manifestURL:'/actual/full.json',approvedManifestSHA256:hash(fullBytes)},manifestURL:'/actual/distance.json',expectedManifestSHA256:hash(distanceBytes),approvedDistanceSHA256:hash(distanceBytes)};
  // Approval is supplied only by this unit-test authority; no runtime catalog entry is created.
  const asset=owner({report,manifest,descriptor});asset.evaluate=function({camera,physicalWidth,physicalHeight}){const r=projectedOverviewError({camera,physicalWidth,physicalHeight,bounds:report.boundsArchiveWorld,error:report.maximumErrorArchiveWorld});return {...r,nativeApproved:true,manifestSHA256:descriptor.expectedManifestSHA256};};
  const calls=[],entries=new Map([['https://museum.test/actual/full.json',fullBytes],['https://museum.test/actual/distance.json',distanceBytes]]),layer=createMuseumDistanceLayer({root:new THREE.Group(),descriptors:[descriptor],baseURL,fetchImpl:fetcher(entries,calls),loadDistance:async()=>asset});t.after(()=>layer.dispose());await layer.load();assert.equal(layer.snapshot.loaded,1);assert.equal(calls.length,2);const b=report.boundsArchiveWorld,target=new THREE.Vector3((b.min[0]+b.max[0])/2,b.min[1]+5,(b.min[2]+b.max[2])/2),state=layer.evaluate(view({target,distance:600}));assert.equal(state.visible,1);assert.equal(state.sites[0].sourceManifestSHA256,'7171cc45441405abee298654708ceb122163d0d0ca114913a2d500882eff2694');
});

test('tiny actual archive traverses approved source, gzip transport and resident runtime, preserving pixels and owned disposal',async t=>{
  const temporary=await mkdtemp(join(tmpdir(),'resident-distance-fixture-')),raw=join(temporary,'full'),out=join(temporary,'distance'),publicRoot=join(temporary,'public');await mkdir(raw);
  const geometry=new RoundedBoxGeometry(1,1,1,2,.022);geometry.name='zhengjuesi-prototype-dressed-stone';const texture=new THREE.DataTexture(new Uint8Array([32,87,19,255,210,180,34,255,160,150,147,255,90,70,60,255]),2,2);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshStandardMaterial({map:texture,roughness:.91}),group=new THREE.Group(),mesh=new THREE.InstancedMesh(geometry,material,3);mesh.name='tiny-original-pixels';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);for(let i=0;i<3;i++)mesh.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(i,0,0),new THREE.Quaternion(),new THREE.Vector3(.4,.04,.35)));
  let layer;
  try{
    const id='tiny-source',archive=await serializeYuanmingyuanArchive({group},{id}),source={schema:1,id,sourceDigest:'b'.repeat(64),verification:{...archive.metadata.verification,exactRoundtripPassed:true,simplified:false,quantized:false},glb:{url:id+'.glb',sha256:hash(archive.glb),bytes:archive.glb.length},runtime:{url:id+'.runtime.json',sha256:hash(archive.runtime),bytes:archive.runtime.length}},sourceBytes=encode(source);await writeFile(join(raw,id+'.glb'),archive.glb);await writeFile(join(raw,id+'.runtime.json'),archive.runtime);await writeFile(join(raw,'manifest.json'),sourceBytes);
    const exported=await exportZhengjuesiDistance({archiveDirectory:raw,outputDirectory:out,publicRoot,maximumErrorWorld:.04,expectedSourceId:id,sourceVisualReview:'unit fixture authority only'}),published=exported.transport.output,manifestBytes=await readFile(join(published,'manifest.json')),manifest=JSON.parse(manifestBytes),entries=new Map([['https://museum.test/source.json',sourceBytes],['https://museum.test/distance/manifest.json',manifestBytes]]);
    for(const key of ['glb','runtime'])entries.set('https://museum.test/distance/'+manifest[key].url,await readFile(join(published,manifest[key].url)));
    layer=createMuseumDistanceLayer({root:new THREE.Group(),descriptors:[{id:'court',assetId:id,site:{position:[12,0,0],rotationY:Math.PI/2,scale:2},source:{manifestURL:'/source.json',approvedManifestSHA256:hash(sourceBytes)},manifestURL:'/distance/manifest.json',expectedManifestSHA256:hash(manifestBytes),approvedDistanceSHA256:hash(manifestBytes)}],baseURL,fetchImpl:fetcher(entries)});await layer.load();assert.equal(layer.snapshot.loaded,1);assert.equal(layer.evaluate(view({distance:1000,target:new THREE.Vector3(12,0,0)})).visible,1);
    let restored;layer.group.traverse(node=>{if(node.isMesh&&node.material?.map)restored=node;});assert(restored,'derived batch retains the original material pixels, not the pre-batch object name');assert.deepEqual(restored.material.map.image.data,texture.image.data);assert.equal(restored.material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(restored.castShadow,true);assert.equal(restored.receiveShadow,true);
    let disposedGeometry=0,disposedMaterial=0,disposedTexture=0;restored.geometry.addEventListener('dispose',()=>disposedGeometry++);restored.material.addEventListener('dispose',()=>disposedMaterial++);restored.material.map.addEventListener('dispose',()=>disposedTexture++);await layer.dispose();await layer.dispose();assert.deepEqual([disposedGeometry,disposedMaterial,disposedTexture],[1,1,1]);assert.equal(layer.snapshot.disposalErrors.length,0);
  }finally{await layer?.dispose();mesh.dispose();geometry.dispose();material.dispose();texture.dispose();await rm(temporary,{recursive:true,force:true});}
});
