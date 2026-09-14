import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {extrudedPolygon} from '../src/yuanmingyuan/study-geometry.js';
import {prepareYangquelongSurface,prepareYangquelongSurfaceFactory,yangquelongSurfaceSpec} from '../src/yuanmingyuan/yangquelong-surface.js';
import {prepareYangquelongBedGround,yangquelongBedGroundSpec} from '../src/yuanmingyuan/yangquelong-bed-ground.js';
import {attachSoilSampling,samplingSpec} from '../src/yuanmingyuan/yangquelong-soil-sampling.js';
import {courtSoilManifestR1} from '../src/yuanmingyuan/court-soil-manifest-r1.js';
import {studioAssets,getStudioAsset,studioAssetUrl} from '../src/yuanmingyuan/studio-assets.js';
import {loadMuseumModel,museumArchiveCatalog} from '../src/yuanmingyuan/asset-source.js';

// Bounded ownership fixtures: no complete architecture/plant factory, network,
// image decoding or renderer. Existing native evidence covers the copied modules.
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function tracked(){
  const controller=new AbortController(),signal=controller.signal,listeners=new Set(),add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
  signal.addEventListener=(name,fn,options)=>{if(name==='abort')listeners.add(fn);return add(name,fn,options);};
  signal.removeEventListener=(name,fn)=>{if(name==='abort')listeners.delete(fn);return remove(name,fn);};
  return {controller,signal,listeners};
}
function fixture({hooks={},throws={}}={}){
  const events=[],counts={},times=[],handles={};
  const tick=name=>{counts[name]=(counts[name]??0)+1;events.push(name);};
  function resource(name,properties={}){
    let disposed=false;
    const value={...properties,dispose(){
      if(disposed)return;disposed=true;tick('dispose:'+name);properties.onDispose?.();
      if(throws[name])throw throws[name];
    },whenIdle(){return Promise.resolve();},get disposed(){return disposed;}};
    handles[name]=value;return value;
  }
  const pixels=resource('pixels',{maps:{fixture:true}});
  const makeSource=()=>{
    tick('create:source');
    const group=new THREE.Group();group.userData.assetId='yangquelong';
    const geometry=new THREE.PlaneGeometry(1,1),stone=new THREE.MeshStandardMaterial(),water=new THREE.MeshStandardMaterial();
    water.userData.category='water';group.add(new THREE.Mesh(geometry,stone));
    for(let i=0;i<9;i++)group.add(new THREE.Mesh(geometry,water));
    const owner=resource('source',{group,diagnostics:{assetId:'yangquelong',timeLayer:'1859–1860',evidence:['original evidence'],uncertainty:['source uncertainty']},
      update(time){times.push(time);},onDispose(){group.clear();geometry.dispose();stone.dispose();water.dispose();}});
    return hooks.source?hooks.source(owner):owner;
  };
  const options={
    preparePixels:async ({signal})=>{tick('prepare:pixels');handles.prepareSignal=signal;return hooks.pixels?hooks.pixels(pixels):pixels;},
    createSource:makeSource,
    createMaterialView:({pixels:p,sourceOwner,signal})=>{
      tick('create:view');assert.equal(p,pixels);assert.equal(p.disposed,false);assert.equal(signal,handles.prepareSignal);
      const group=sourceOwner.group.clone(true);
      const view=resource('view',{group,diagnostics:{materialFixture:true},update:time=>sourceOwner.update(time),onDispose(){group.removeFromParent();group.clear();}});
      return hooks.view?hooks.view(view,sourceOwner):view;
    },
    loadSoil:()=>{throw new Error('The mocked ground must not load images');},
    prepareGround:async ({owner,signal,createSoilMaterial})=>{
      tick('prepare:ground');assert.equal(owner,handles.view);assert.notEqual(owner,handles.source);
      assert.equal(signal,handles.prepareSignal);assert.equal(createSoilMaterial,options.loadSoil);
      const group=new THREE.Group(),geometry=new THREE.PlaneGeometry(1,1),material=new THREE.MeshStandardMaterial();
      for(let i=0;i<4;i++)group.add(new THREE.Mesh(geometry,material));owner.group.add(group);
      const ground=resource('ground',{group,diagnostics:{groundFixture:true},
        assertCurrent(){if(this.disposed||hooks.invalidated?.())throw new Error('binding invalidated');return true;},
        onDispose(){group.removeFromParent();group.clear();geometry.dispose();material.dispose();}});
      return hooks.ground?hooks.ground(ground):ground;
    },
  };
  return {options,makeSource,pixels,events,counts,times,handles};
}
const releases=f=>f.events.filter(x=>x.startsWith('dispose:'));

test('actual ESM registration is independent and preabort cannot fetch or allocate a full owner',async t=>{
  const entry=getStudioAsset(yangquelongSurfaceSpec.id);
  assert.equal(entry.id,'yangquelong-surface-r1');assert.equal(entry.views,studioAssets.yangquelong.views);
  assert.notEqual(entry,studioAssets.yangquelong);assert.match(entry.label,/当代/);
  assert.equal(getStudioAsset('spreading-garden-pine-r4').id,'spreading-garden-pine-r4');
  assert.equal(Object.hasOwn(museumArchiveCatalog,entry.id),false);assert.ok(museumArchiveCatalog.yangquelong);
  const url=new URL(studioAssetUrl('https://museum.test/asset-studio.html?asset=yangquelong&archive=old&materials=old&view=roof',entry.id));
  assert.equal(url.searchParams.get('asset'),entry.id);for(const key of ['archive','materials','view'])assert.equal(url.searchParams.has(key),false);
  let requests=0;t.mock.method(globalThis,'fetch',()=>{requests++;throw new Error('No request permitted');});
  const controller=new AbortController(),reason=new Error('preabort');controller.abort(reason);
  await assert.rejects(loadMuseumModel(entry.id,{signal:controller.signal}),e=>e===reason);
  await assert.rejects(prepareYangquelongSurfaceFactory({signal:controller.signal}),e=>e===reason);
  assert.equal(requests,0);
});
test('registry prepares one owner, binds ground after materials and forwards all original waters once',async()=>{
  const f=fixture(),t=tracked(),factory=await getStudioAsset('yangquelong-surface-r1').loadFactory({...f.options,signal:t.signal}),owner=factory();
  assert.deepEqual(f.events.slice(0,5),['prepare:pixels','create:source','create:view','dispose:pixels','prepare:ground']);
  assert.equal(owner.group,f.handles.view.group);assert.notEqual(owner.group,owner.sourceOwner.group);
  assert.equal(owner.diagnostics.surface.waterMeshes,9);assert.equal(owner.diagnostics.meshCount,14);
  assert.equal(owner.diagnostics.triangleCount,28);
  assert.deepEqual(owner.diagnostics.evidence.slice(0,1),['original evidence']);
  assert.equal(owner.diagnostics.sourceTimeLayer,'1859–1860');
  assert.equal(owner.diagnostics.evidence[1].historicallySurveyed,false);
  assert.equal(owner.diagnostics.visualAcceptance,false);
  owner.update(7.5);assert.deepEqual(f.times,[7.5]);
  assert.throws(factory,/already consumed/);factory.dispose();assert.equal(owner.disposed,false);
  owner.dispose();owner.dispose();await owner.whenIdle();
  assert.deepEqual(releases(f),['dispose:pixels','dispose:ground','dispose:view','dispose:source']);
  assert.equal(t.listeners.size,0);
});
test('borrowed source stays owned and live after the surface is disposed',async()=>{
  const f=fixture(),source=f.makeSource(),owner=await prepareYangquelongSurface({...f.options,sourceOwner:source});
  assert.equal(f.counts['create:source'],1);assert.equal(owner.diagnostics.resourceOwnership.sourceOwnerBorrowed,true);
  owner.dispose();await owner.whenIdle();assert.equal(source.disposed,false);
  assert.deepEqual(releases(f),['dispose:pixels','dispose:ground','dispose:view']);source.dispose();
});
test('invalid borrowed source is rejected before pixel preparation',async()=>{
  const f=fixture(),source=f.makeSource();source.dispose();
  await assert.rejects(prepareYangquelongSurface({...f.options,sourceOwner:source}),/live complete source/);
  assert.equal(f.counts['prepare:pixels'],undefined);assert.equal(f.counts['dispose:source'],1);
});
test('preabort does no preparation and adds no listener',async()=>{
  const f=fixture(),t=tracked();t.controller.abort(new Error('already left'));
  await assert.rejects(prepareYangquelongSurface({...f.options,signal:t.signal}),e=>e===t.signal.reason);
  assert.deepEqual(f.events,[]);assert.equal(t.listeners.size,0);
});
test('a pixel handle returned after abort is released without constructing the building',async()=>{
  const pending=deferred(),entered=deferred(),f=fixture({hooks:{pixels:async p=>{entered.resolve();await pending.promise;return p;}}}),t=tracked();
  const result=prepareYangquelongSurface({...f.options,signal:t.signal});await entered.promise;t.controller.abort(new Error('left while decoding'));pending.resolve();
  await assert.rejects(result,e=>e===t.signal.reason);assert.deepEqual(releases(f),['dispose:pixels']);
  assert.equal(f.counts['create:source'],undefined);assert.equal(t.listeners.size,0);
});
test('pixel failure retains its error without allocating later owners',async()=>{
  const error=new Error('decode failed'),f=fixture({hooks:{pixels:()=>{throw error;}}}),t=tracked();
  await assert.rejects(prepareYangquelongSurface({...f.options,signal:t.signal}),e=>e===error);
  assert.equal(f.counts['create:source'],undefined);assert.equal(t.listeners.size,0);
  f.pixels.dispose(); // A handle never returned by its producer is still producer-owned.
});
test('source or material constructor failure releases every previously returned owner',async()=>{
  for(const stage of ['source','view']){
    const error=new Error(stage+' failed'),f=fixture();
    f.options[stage==='source'?'createSource':'createMaterialView']=()=>{throw error;};
    await assert.rejects(prepareYangquelongSurface(f.options),e=>e===error);
    assert.deepEqual(releases(f),stage==='source'?['dispose:pixels']:['dispose:source','dispose:pixels']);
  }
});
test('abort during synchronous source or view return cleans the late handle exactly once',async()=>{
  for(const stage of ['source','view']){
    const t=tracked(),f=fixture({hooks:{[stage]:owner=>{t.controller.abort(new Error('during '+stage));return owner;}}});
    await assert.rejects(prepareYangquelongSurface({...f.options,signal:t.signal}),e=>e===t.signal.reason);
    assert.equal(f.counts['dispose:pixels'],1);assert.equal(f.counts['dispose:source'],1);
    if(stage==='view')assert.equal(f.counts['dispose:view'],1);
    assert.equal(f.counts['prepare:ground'],undefined);assert.equal(t.listeners.size,0);
  }
});
test('abort while ground is pending consumes and disposes its late returned binding',async()=>{
  const pending=deferred(),entered=deferred(),t=tracked(),f=fixture({hooks:{ground:async ground=>{entered.resolve();await pending.promise;return ground;}}});
  const result=prepareYangquelongSurface({...f.options,signal:t.signal});await entered.promise;
  t.controller.abort(new Error('left during soil'));pending.resolve();
  await assert.rejects(result,e=>e===t.signal.reason);
  for(const name of ['pixels','view','source','ground'])assert.equal(f.counts['dispose:'+name],1);
  assert.equal(t.listeners.size,0);
});
test('ready but unconsumed factory is released by cancellation or explicit discard',async()=>{
  for(const mode of ['abort','discard']){
    const t=tracked(),f=fixture(),factory=await prepareYangquelongSurfaceFactory({...f.options,signal:t.signal});
    if(mode==='abort')t.controller.abort(new Error('never displayed'));else factory.dispose();
    factory.dispose();await factory.whenIdle();assert.throws(factory);
    assert.deepEqual(releases(f),['dispose:pixels','dispose:ground','dispose:view','dispose:source']);
    assert.equal(t.listeners.size,0);
  }
});
test('the owner continues to honor its load signal after synchronous handoff',async()=>{
  const t=tracked(),f=fixture(),factory=await prepareYangquelongSurfaceFactory({...f.options,signal:t.signal}),owner=factory();
  t.controller.abort(new Error('scene disposed'));assert.equal(owner.disposed,true);
  assert.throws(()=>owner.update(1),e=>e===t.signal.reason);owner.dispose();await owner.whenIdle();
  assert.equal(f.counts['dispose:source'],1);assert.equal(t.listeners.size,0);
});
test('cleanup failures cannot prevent later resources from being released and remain observable',async()=>{
  const groundError=new Error('ground release failed'),viewError=new Error('view release failed');
  for(const byAbort of [false,true]){
    const t=tracked(),f=fixture({throws:{ground:groundError,view:viewError}}),owner=await prepareYangquelongSurface({...f.options,signal:t.signal});
    if(byAbort)t.controller.abort();else assert.throws(()=>owner.dispose(),AggregateError);
    await assert.rejects(owner.whenIdle(),e=>e instanceof AggregateError&&e.errors.includes(groundError)&&e.errors.includes(viewError));
    assert.deepEqual(releases(f),['dispose:pixels','dispose:ground','dispose:view','dispose:source']);
    owner.dispose();assert.equal(t.listeners.size,0);
  }
});
test('source/binding invalidation is detected before water update and tears down the surface',async()=>{
  let invalid=false;const f=fixture({hooks:{invalidated:()=>invalid}}),owner=await prepareYangquelongSurface(f.options);
  invalid=true;assert.throws(()=>owner.update(4),/binding invalidated/);
  assert.equal(owner.disposed,true);assert.deepEqual(f.times,[]);await owner.whenIdle();
  assert.equal(f.counts['dispose:source'],1);
});

// This fixture constructs only the original small paving/edging, nine tiny
// water markers and texture metadata. It does not decode or verify source pixels.
function smallCourtSource(){
  const spec=yangquelongBedGroundSpec,group=new THREE.Group(),court=new THREE.Group(),paving=new THREE.Group(),edging=new THREE.Group();
  group.userData.assetId='yangquelong';court.name='yangquelong-courts-and-water-bridge';paving.name='yangquelong-court-paving';edging.name='yangquelong-garden-bed-edgings';
  group.add(court);court.add(paving,edging);
  const polygon=(points,lo,hi,holes=[])=>{const g=extrudedPolygon(points,lo,hi,holes);g.applyMatrix4(new THREE.Matrix4());g.clearGroups();return g;};
  const original=polygon(spec.outer,spec.pavingBottom,spec.pavingTop,spec.originalHoles);
  const rings=spec.beds.map(b=>polygon(b.outer,spec.edgingBottom,spec.edgingTop,[b.inner])),edges=mergeGeometries(rings);
  rings.forEach(g=>g.dispose());const stone=new THREE.MeshStandardMaterial(),water=new THREE.MeshStandardMaterial(),waterGeometry=new THREE.PlaneGeometry(1,1);
  water.userData.category='water';paving.add(new THREE.Mesh(original,stone));edging.add(new THREE.Mesh(edges,stone));
  for(let i=0;i<9;i++)court.add(new THREE.Mesh(waterGeometry,water));
  let disposed=false,updates=0;return {group,paving,original,diagnostics:{},update(){updates++;},get updates(){return updates;},
    dispose(){if(disposed)return;disposed=true;group.clear();for(const g of [original,edges,waterGeometry])g.dispose();stone.dispose();water.dispose();},get disposed(){return disposed;}};
}
function metadataSoilLease(){
  const manifest=courtSoilManifestR1,material=new THREE.MeshStandardMaterial({roughness:1,normalScale:new THREE.Vector2(.5,.5),aoMapIntensity:.3}),textures=[],counts={material:0,textures:0};
  material.addEventListener('dispose',()=>counts.material++);
  for(const [slot,file] of Object.entries(manifest.files)){
    const texture=new THREE.Texture({width:4096,height:4096});
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.setScalar(1/manifest.tileMetres);texture.flipY=false;texture.anisotropy=16;
    texture.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.addEventListener('dispose',()=>counts.textures++);textures.push(texture);material[slot]=texture;
  }
  let disposed=false;
  const lease={material,diagnostics:{id:manifest.id,tileMetres:manifest.tileMetres,files:manifest.files},
    dispose(){if(disposed)return;disposed=true;material.dispose();for(const texture of textures){texture.dispose();texture.image=null;}},
    get disposed(){return disposed;}};
  return {lease,textures,counts};
}
test('real ground and sampler attach to the material view and restore borrowed geometry before source release',async()=>{
  const f=fixture(),source=smallCourtSource(),soil=metadataSoilLease();let actualBinding;
  f.options.createSource=()=>source;
  f.options.loadSoil=async()=>attachSoilSampling(soil.lease);
  f.options.prepareGround=async options=>{actualBinding=await prepareYangquelongBedGround(options);return actualBinding;};
  const owner=await prepareYangquelongSurface(f.options),viewPaving=owner.group.getObjectByName('yangquelong-court-paving').children[0];
  assert.equal(source.paving.children[0].geometry,source.original);
  assert.notEqual(viewPaving.geometry,source.original);assert.equal(actualBinding.soilMeshes.length,4);
  assert.equal(owner.diagnostics.surface.waterMeshes,9);assert.equal(soil.textures.length,4);
  const shader={fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  soil.lease.material.onBeforeCompile(shader,null);
  assert.match(shader.fragmentShader,/ymySoilNormal\( normalMap/);
  assert.match(shader.fragmentShader,/na\.xy = transpose\(a\.rotation\) \* na\.xy/);
  assert.equal(soil.lease.material.userData.soilSampling,samplingSpec);
  owner.update(2);assert.equal(source.updates,1);
  owner.dispose();await owner.whenIdle();
  assert.equal(viewPaving.geometry,source.original);assert.equal(source.disposed,true);
  assert.equal(soil.counts.material,1);assert.equal(soil.counts.textures,4);
  assert.ok(soil.textures.every(t=>t.image===null));assert.equal(soil.lease.material.userData.soilSampling,undefined);
});
