import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import * as THREE from 'three';
import {loadShoreBankStudyR1,shoreBankR1Source} from '../src/yuanmingyuan/shore-bank-integration.js';
import {shoreBankStudyViews} from '../src/yuanmingyuan/shore-bank-study-views.js';

const sourceFile=new URL('../src/yuanmingyuan/shore-bank-integration.js',import.meta.url),source=readFileSync(sourceFile,'utf8');
const artifact=readFileSync(new URL('../public'+shoreBankR1Source.path,import.meta.url)),original=readFileSync(new URL('../../work/production-v3/captures/terrain-regions-5deaa85c62d11679-1789195173683.json',import.meta.url));
const response=()=>new Response(artifact,{headers:{'Content-Type':'application/json'}});
function terrain(){let disposed=false,releases=0;const group=new THREE.Group(),earthMaterial=new THREE.MeshStandardMaterial();earthMaterial.addEventListener('dispose',()=>releases++);return {group,earthMaterial,get disposed(){return disposed;},markDisposed(){disposed=true;},get materialReleases(){return releases;},dispose(){disposed=true;earthMaterial.dispose();}};}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const causes=error=>[error,...(error.errors??[]).flatMap(causes)];

/** Execute the entire current production loader body. Only the two synchronous
 * geometry factories are replaced with tiny real Three owners. Crypto, source
 * bytes, decoding, async control flow and cleanup are the actual module code;
 * no full shore or garden factory is constructed by these lifecycle tests. */
function harness({controller,abortAt,failAdapter=false,failActivate=false,failDispose=false,crypto=webcrypto}={}){
  const input=terrain(),order=[],counts={study:0,adapter:0,activate:0,studyDispose:0,adapterDispose:0,geometry:0,material:0},owners={};
  function makeStudy(args){
    counts.study++;owners.studyArgs=args;
    const geometry=new THREE.BoxGeometry(.1,.05,.1),material=new THREE.MeshStandardMaterial(),group=new THREE.Group();geometry.addEventListener('dispose',()=>counts.geometry++);material.addEventListener('dispose',()=>counts.material++);group.add(new THREE.Mesh(geometry,material));let disposed=false;
    const study={group,diagnostics:{sourceIdentity:args.snapshot.sourceIdentity,groundSampling:'stock-lookup'},get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;counts.studyDispose++;order.push('study');group.removeFromParent();geometry.dispose();material.dispose();if(failDispose)throw new Error('study cleanup failed');}};owners.study=study;
    if(abortAt==='study'){controller.abort(new Error('abort inside study'));assert.equal(disposed,false,'cleanup waits until the synchronous factory returns its owner');}
    return study;
  }
  function makeAdapter(args){
    counts.adapter++;owners.adapterArgs=args;if(failAdapter)throw new Error('source triangle mismatch');
    const group=new THREE.Group(),geometry=new THREE.BufferGeometry();geometry.addEventListener('dispose',()=>counts.geometry++);group.visible=false;input.group.add(group);let disposed=false,active=false;
    const adapter={group,activate(){counts.activate++;active=true;group.visible=true;if(abortAt==='activate'){controller.abort(new Error('abort inside activate'));assert.equal(args.study.disposed,false);}if(failActivate)throw new Error('activation failed');},revert(){active=false;group.visible=false;},get snapshot(){return {active,disposed};},dispose(){if(disposed)return;disposed=true;active=false;counts.adapterDispose++;order.push('adapter');group.removeFromParent();geometry.dispose();if(failDispose)throw new Error('adapter cleanup failed');}};owners.adapter=adapter;
    if(abortAt==='adapter'){controller.abort(new Error('abort inside adapter'));assert.equal(args.study.disposed,false,'never release study under an unreturned adapter');}
    return adapter;
  }
  const imports=source.match(/^import [^\n]+;$/gm);assert.equal(imports.length,3,'All module dependencies must be explicitly bound in this harness');
  const context=vm.createContext({createShoreBankStudy:makeStudy,createShoreBankTerrainAdapter:makeAdapter,shoreBankStudyViews,crypto,AbortController,TextDecoder,Uint8Array,Error,AggregateError,fetch:()=>{throw new Error('test must provide actual bytes');}});
  vm.runInContext(source.replace(/^import [^\n]+;\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.loader=loadShoreBankStudyR1;',context,{filename:sourceFile.pathname});
  return {load:options=>context.loader({terrain:input,signal:controller?.signal,fetcher:async()=>response(),...options}),terrain:input,counts,owners,order,dispose(){try{owners.adapter?.dispose();}catch{}try{owners.study?.dispose();}catch{}input.dispose();}};
}

test('public snapshot is the exact 726905-byte native capture, with the full SHA in its path',()=>{
  assert.deepEqual(artifact,original);assert.equal(artifact.byteLength,shoreBankR1Source.bytes);assert.equal(createHash('sha256').update(artifact).digest('hex'),shoreBankR1Source.sha256);assert(shoreBankR1Source.path.includes(shoreBankR1Source.sha256));const parsed=JSON.parse(artifact);assert.equal(parsed.sourceIdentity,shoreBankR1Source.sourceIdentity);assert.equal(parsed.regions.length,3);assert.equal(parsed.probes.length,743);
});

test('the actual imported loader rejects bad length/hash/HTTP and pre-abort before any geometry factory can run',async()=>{
  const value=terrain();try{
    for(const kind of ['length','hash','http']){
      const damaged=Buffer.from(artifact);damaged[17]^=1;let url,bodyReads=0;
      const fetcher=async path=>{url=path;return kind==='http'?{ok:false,status:503,arrayBuffer(){bodyReads++;throw new Error('unexpected body read');}}:new Response(kind==='length'?damaged.subarray(1):damaged);};
      await assert.rejects(loadShoreBankStudyR1({terrain:value,fetcher}),kind==='length'?/byte length mismatch/:kind==='hash'?/SHA-256 mismatch/:/HTTP 503/);
      assert.equal(url,shoreBankR1Source.path);assert.equal(bodyReads,0);assert.equal(value.group.children.length,0);assert.equal(value.materialReleases,0);
    }
    const controller=new AbortController(),reason=new Error('page already left');controller.abort(reason);let calls=0;
    await assert.rejects(loadShoreBankStudyR1({terrain:value,signal:controller.signal,fetcher:async()=>{calls++;return response();}}),error=>error===reason);assert.equal(calls,0);
  }finally{value.dispose();}
});

test('a fetcher ignoring abort cannot allocate a late study when its real bytes finally arrive',async()=>{
  const value=terrain(),controller=new AbortController(),gate=deferred(),reason=new Error('page left during fetch');let requestSignal;
  try{
    const pending=loadShoreBankStudyR1({terrain:value,signal:controller.signal,fetcher:async(path,options)=>{assert.equal(path,shoreBankR1Source.path);requestSignal=options.signal;return gate.promise;}});
    controller.abort(reason);assert.equal(requestSignal.aborted,true);gate.resolve(response());await assert.rejects(pending,error=>error===reason);assert.equal(value.group.children.length,0);assert.equal(value.materialReleases,0);
  }finally{value.dispose();}
});

test('successful real-byte loading passes the verified snapshot and borrowed material, activates once and reports live adapter state',async()=>{
  const f=harness();let resource;try{
    resource=await f.load();assert.equal(f.counts.study,1);assert.equal(f.counts.adapter,1);assert.equal(f.counts.activate,1);assert.equal(f.owners.studyArgs.earthMaterial,f.terrain.earthMaterial);assert.equal(f.owners.studyArgs.snapshot.sourceIdentity,shoreBankR1Source.sourceIdentity);assert.equal(f.owners.studyArgs.snapshot.probes.length,743);assert.equal(f.owners.adapterArgs.terrain,f.terrain);assert.equal(f.owners.adapterArgs.study,resource.study);assert.equal(resource.group,resource.adapter.group);assert.equal(resource.group.parent,f.terrain.group);assert.equal(resource.views,shoreBankStudyViews);
    let d=resource.diagnostics;assert.equal(d.sourceSHA,shoreBankR1Source.sha256);assert.equal(d.sourceBytes,artifact.length);assert.equal(d.sourceIdentity,'5deaa85c62d11679');assert.equal(d.sourceRegions.length,3);assert.equal(d.sourceProbeCount,743);assert.equal(d.adapter.active,true);assert.equal(d.nativeReviewed,false);assert.equal(d.productionApproved,false);resource.adapter.revert();assert.equal(resource.diagnostics.adapter.active,false);resource.adapter.activate();assert.equal(resource.diagnostics.adapter.active,true);
    resource.dispose();assert.deepEqual(f.order,['adapter','study']);assert.equal(f.counts.geometry,2);assert.equal(f.counts.material,1);assert.equal(f.terrain.materialReleases,0);assert.equal(f.terrain.disposed,false);assert.equal(f.terrain.group.children.length,0);assert.equal(resource.diagnostics.disposed,true);assert.equal(resource.diagnostics.adapter.disposed,true);resource.dispose();assert.equal(f.counts.studyDispose,1);assert.equal(f.counts.adapterDispose,1);
  }finally{resource?.dispose();f.dispose();}
});

test('submerged R2 and continuous R4 are explicit profiles while the default remains R1',async()=>{
  for(const [requested,expected,id]of [[undefined,'r1','shore-bank-r1'],['submerged-r2','submerged-r2','shore-bank-submerged-r2'],['curved-r4','curved-r4','shore-bank-curved-r4']]){
    const f=harness();let resource;try{
      resource=await f.load(requested?{bedProfile:requested}:{});
      assert.equal(f.owners.studyArgs.bedProfile,expected);assert.equal(resource.diagnostics.bedProfile,expected);assert.equal(resource.diagnostics.id,id);
      assert.equal(resource.diagnostics.sourceSHA,shoreBankR1Source.sha256);assert.equal(f.owners.studyArgs.earthMaterial,f.terrain.earthMaterial);
    }finally{resource?.dispose();f.dispose();}
  }
  const f=harness();try{
    let fetched=false;await assert.rejects(f.load({bedProfile:'unknown',fetcher:async()=>{fetched=true;return response();}}),/unknown bed profile/);
    assert.equal(fetched,false);assert.equal(f.counts.study,0);assert.equal(f.counts.adapter,0);
  }finally{f.dispose();}
});

test('stone-drift loading keeps the corrected support profile and borrows the supplied rock material',async()=>{
  const f=harness(),stone=new THREE.MeshStandardMaterial();let owner;
  try{
    owner=await f.load({bedProfile:'submerged-r2',pebbleLayout:'drifts-r3',stoneMaterial:stone});
    assert.equal(f.owners.studyArgs.stoneMaterial,stone);assert.equal(f.owners.studyArgs.pebbleLayout,'drifts-r3');assert.equal(f.owners.studyArgs.bedProfile,'submerged-r2');assert.equal(owner.diagnostics.id,'shore-bank-drifts-r3');
    owner.dispose();assert.equal(f.terrain.materialReleases,0);
    let fetched=false;await assert.rejects(f.load({pebbleLayout:'unknown',fetcher:async()=>{fetched=true;return response();}}),/unknown pebble layout/);assert.equal(fetched,false);
  }finally{owner?.dispose();stone.dispose();f.dispose();}
});

test('abort during verified-byte digest still allocates no geometry owner',async()=>{
  const controller=new AbortController(),entered=deferred(),gate=deferred(),reason=new Error('abort during digest');
  const f=harness({controller,crypto:{subtle:{async digest(...args){entered.resolve();await gate.promise;return webcrypto.subtle.digest(...args);}}}});
  try{
    const pending=f.load();await entered.promise;controller.abort(reason);gate.resolve();await assert.rejects(pending,error=>error===reason);assert.equal(f.counts.study,0);assert.equal(f.counts.adapter,0);assert.equal(f.terrain.materialReleases,0);
  }finally{gate.resolve();f.dispose();}
});

test('re-entrant abort inside each synchronous construction stage releases the returned owners in adapter-before-study order',async()=>{
  for(const stage of ['study','adapter','activate']){
    const controller=new AbortController(),f=harness({controller,abortAt:stage});try{await assert.rejects(f.load(),new RegExp('abort inside '+stage));assert.deepEqual(f.order,stage==='study'?['study']:['adapter','study']);assert.equal(f.counts.studyDispose,1);assert.equal(f.counts.adapterDispose,stage==='study'?0:1);assert.equal(f.counts.activate,stage==='activate'?1:0);assert.equal(f.terrain.group.children.length,0);assert.equal(f.terrain.disposed,false);assert.equal(f.terrain.materialReleases,0);}finally{f.dispose();}
  }
});

test('adapter validation failure releases study, while activation failure also removes the acquired adapter',async()=>{
  for(const at of ['adapter','activate']){
    const f=harness({failAdapter:at==='adapter',failActivate:at==='activate'});try{await assert.rejects(f.load(),at==='adapter'?/source triangle mismatch/:/activation failed/);assert.deepEqual(f.order,at==='adapter'?['study']:['adapter','study']);assert.equal(f.counts.studyDispose,1);assert.equal(f.terrain.group.children.length,0);assert.equal(f.terrain.materialReleases,0);}finally{f.dispose();}
  }
});

test('loading failure retains its original error and both cleanup failures without skipping either real owner',async()=>{
  const f=harness({failActivate:true,failDispose:true});try{await assert.rejects(f.load(),error=>{assert(error instanceof AggregateError);const text=causes(error).map(e=>e.message).join('\n');assert.match(text,/activation failed/);assert.match(text,/adapter cleanup failed/);assert.match(text,/study cleanup failed/);return true;});assert.deepEqual(f.order,['adapter','study']);assert.equal(f.counts.geometry,2);assert.equal(f.counts.material,1);assert.equal(f.terrain.materialReleases,0);assert.equal(f.terrain.group.children.length,0);}finally{f.dispose();}
});

test('explicit disposal and later page abort release both owners once; abort cleanup errors remain visible without throwing from the signal event',async()=>{
  for(const abort of [false,true]){
    const controller=new AbortController(),f=harness({controller,failDispose:true});let resource;
    try{resource=await f.load();if(abort)assert.doesNotThrow(()=>controller.abort(new Error('page hidden')));else assert.throws(()=>resource.dispose(),AggregateError);assert.deepEqual(f.order,['adapter','study']);assert.equal(resource.diagnostics.disposed,true);assert.equal(resource.diagnostics.cleanupErrors.length,2);assert.equal(f.counts.geometry,2);assert.equal(f.terrain.materialReleases,0);resource.dispose();controller.abort();assert.equal(f.counts.studyDispose,1);assert.equal(f.counts.adapterDispose,1);}finally{resource?.dispose();f.dispose();}
  }
});

test('disposing the borrowed terrain while fetch is pending prevents later geometry construction without disposing it again',async()=>{
  const value=terrain(),gate=deferred();try{const pending=loadShoreBankStudyR1({terrain:value,fetcher:()=>gate.promise});value.markDisposed();gate.resolve(response());await assert.rejects(pending,/terrain was disposed/);assert.equal(value.materialReleases,0);assert.equal(value.group.children.length,0);}finally{value.dispose();}
});
