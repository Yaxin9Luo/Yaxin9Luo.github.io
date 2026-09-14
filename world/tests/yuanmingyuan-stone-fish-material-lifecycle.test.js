import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {getEventListeners} from 'node:events';
import * as THREE from 'three';

// Execute the unchanged registry method and preparation-handle implementation.
// Only the decoder and full sculpture boundary are replaced: three 2x2 arrays
// and one BoxGeometry prove lifetime, NOT 4K decode or native shader quality.
const materialURL=new URL('../src/yuanmingyuan/xieqiqu-stone-fish-material-study.js?small-lifecycle-decoder',import.meta.url).href;
const registryURL=new URL('../src/yuanmingyuan/studio-assets.js',import.meta.url).href;
const bridgeKey=Symbol.for('stone-fish-material-lifecycle-fixture');
let state;
globalThis[bridgeKey]={
  decode:async(bytes,file)=>{
    assert.equal(bytes.byteLength,file.bytes);
    assert.equal(createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),file.sha256);
    const data=Uint8Array.from({length:16},(_,i)=>31+i*7);
    return {data,width:2,height:2,channels:4,origin:'lower-left',encodedSha256:file.sha256};
  },
  prepare:options=>state.prepare(options),
  create:options=>state.create(options),
};
const hooks=registerHooks({
  resolve(specifier,context,next){
    if(context.parentURL===materialURL&&specifier==='./xianfashan-materials.js')return {url:'fish-lifecycle:decoder',shortCircuit:true};
    if(context.parentURL===registryURL&&specifier==='./xieqiqu-stone-fish-material-study.js')return {url:'fish-lifecycle:route',shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next){
    const ref="globalThis[Symbol.for('stone-fish-material-lifecycle-fixture')]";
    if(url==='fish-lifecycle:decoder')return {format:'module',source:`export const decodeXianfashanTexturePixels=(...args)=>${ref}.decode(...args);`,shortCircuit:true};
    if(url==='fish-lifecycle:route')return {format:'module',source:`export const prepareXieqiquStoneFishMaterialPixels=(...args)=>${ref}.prepare(...args);export const createXieqiquStoneFishMaterialStudy=(...args)=>${ref}.create(...args);`,shortCircuit:true};
    return next(url,context);
  },
});
const material=await import(materialURL),{studioAssets}=await import(registryURL);
const route=studioAssets['xieqiqu-stone-fish'];
const encoded=new Map(),manifestPath=material.stoneFishMaterialSpec.manifestPath;
const manifestBytes=await readFile(new URL('../public'+manifestPath,import.meta.url));
encoded.set(manifestPath,manifestBytes);
for(const file of Object.values(JSON.parse(manifestBytes).sources.marble.files))encoded.set(file.path,await readFile(new URL('../public'+file.path,import.meta.url)));
const fetchFile=async path=>{const bytes=encoded.get(path);assert(bytes,'only the manifest and three marble maps may be fetched');return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
after(()=>{hooks.deregister();delete globalThis[bridgeKey];encoded.clear();});

function setup(){
  const controller=new AbortController(),record={controller,prepareCalls:0,factoryCalls:0,handle:null,disposeCalls:0,releaseTransitions:0};
  record.prepare=async({signal})=>{
    assert.equal(signal,controller.signal);record.prepareCalls++;
    const handle=await material.prepareXieqiquStoneFishMaterialPixels({signal,fetchFile});
    const release=handle.dispose;handle.dispose=()=>{record.disposeCalls++;if(!handle.disposed)record.releaseTransitions++;release();};
    record.handle=handle;return handle;
  };
  record.create=({pixels,signal})=>{
    record.factoryCalls++;assert.equal(signal,controller.signal);assert.equal(pixels,record.handle);assert.equal(pixels.disposed,false);
    const maps=Object.fromEntries(Object.entries(pixels.maps).map(([key,entry])=>[key,new THREE.DataTexture(entry.data,2,2,THREE.RGBAFormat)]));
    const materials={carving:material.createStoneFishTriplanarMaterial({maps}),oldStone:material.createStoneFishTriplanarMaterial({maps})};
    const geometry=new THREE.BoxGeometry(.2,.1,.4),sourceMaterial=new THREE.MeshStandardMaterial(),group=new THREE.Group();group.add(new THREE.Mesh(geometry,sourceMaterial));
    const events=[];for(const [key,resource] of [...Object.entries(maps),...Object.entries(materials)])resource.addEventListener('dispose',()=>events.push(key));
    let disposed=false;
    const materialOwner={materials,dispose(){if(disposed)return;disposed=true;Object.values(materials).forEach(m=>m.dispose());Object.values(maps).forEach(t=>{t.dispose();t.image=null;});}};
    const sourceOwner={group,dispose(){geometry.dispose();sourceMaterial.dispose();}};
    record.owner=material.createStoneFishMaterialView({sourceOwner,materialOwner,ownsSource:true,signal});
    record.textures=Object.values(maps);record.arrays=Object.values(pixels.maps).map(entry=>entry.data);record.events=events;return record.owner;
  };
  state=record;return record;
}

test('the actual lazy route releases the actual handle while Three textures retain unchanged pixels',async()=>{
  const r=setup(),factory=await route.loadFactory({signal:r.controller.signal,materialVariant:'marble-r1'});
  assert.equal(getEventListeners(r.controller.signal,'abort').length,1);const owner=factory();
  try{
    assert.equal(r.factoryCalls,1);assert.equal(r.handle.disposed,true);assert.equal(r.handle.maps,null);assert.equal(r.releaseTransitions,1);
    assert.equal(getEventListeners(r.controller.signal,'abort').length,0);assert.equal(owner.disposed,false);assert.deepEqual(r.events,[]);
    r.textures.forEach((texture,i)=>{assert.equal(texture.image.data,r.arrays[i]);assert.deepEqual([...texture.image.data],Array.from({length:16},(_,j)=>31+j*7));});
    r.controller.abort();assert.equal(r.disposeCalls,1);assert.equal(owner.disposed,false);assert.deepEqual(r.events,[]);
    r.textures.forEach((texture,i)=>assert.equal(texture.image.data,r.arrays[i]));
  }finally{owner.dispose();owner.dispose();}
  assert.equal(r.events.length,5);assert.equal(new Set(r.events).size,5);r.textures.forEach(t=>assert.equal(t.image,null));
});

test('a signal cancelled before preparation prevents handle or source construction',async()=>{
  const r=setup();r.controller.abort();await assert.rejects(route.loadFactory({signal:r.controller.signal,materialVariant:'marble-r1'}),{name:'AbortError'});
  assert.equal(r.handle,null);assert.equal(r.factoryCalls,0);assert.equal(getEventListeners(r.controller.signal,'abort').length,0);
});

test('late abort after prepare resolves releases the handle before returning a factory',async()=>{
  const r=setup(),prepare=r.prepare;r.prepare=async options=>{const pixels=await prepare(options);r.controller.abort();return pixels;};
  await assert.rejects(route.loadFactory({signal:r.controller.signal,materialVariant:'marble-r1'}),{name:'AbortError'});
  assert.equal(r.handle.maps,null);assert.equal(r.handle.disposed,true);assert.equal(r.releaseTransitions,1);assert.equal(r.factoryCalls,0);assert.equal(getEventListeners(r.controller.signal,'abort').length,0);
});

test('abort between preparation and the scheduled factory invocation releases and rejects',async()=>{
  const r=setup(),factory=await route.loadFactory({signal:r.controller.signal,materialVariant:'marble-r1'});r.controller.abort();
  assert.equal(r.handle.maps,null);assert.equal(r.releaseTransitions,1);assert.equal(getEventListeners(r.controller.signal,'abort').length,0);
  assert.throws(factory,{name:'AbortError'});assert.equal(r.factoryCalls,0);assert.equal(r.releaseTransitions,1);
});

test('a factory exception preserves its error and releases the handle and abort listener',async()=>{
  const r=setup(),sentinel=new Error('small factory boundary failure');r.create=()=>{r.factoryCalls++;throw sentinel;};
  const factory=await route.loadFactory({signal:r.controller.signal,materialVariant:'marble-r1'});assert.throws(factory,e=>e===sentinel);
  assert.equal(r.factoryCalls,1);assert.equal(r.handle.disposed,true);assert.equal(r.handle.maps,null);assert.equal(r.releaseTransitions,1);assert.equal(getEventListeners(r.controller.signal,'abort').length,0);
});

test('unknown material variants fail without preparing any pixel handle',async()=>{
  const r=setup();await assert.rejects(route.loadFactory({signal:r.controller.signal,materialVariant:'marble-unknown'}),/Unknown stone fish material study/);assert.equal(r.prepareCalls,0);assert.equal(r.factoryCalls,0);
});
