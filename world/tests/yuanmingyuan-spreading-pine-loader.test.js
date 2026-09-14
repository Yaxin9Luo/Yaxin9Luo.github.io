import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/yuanmingyuan/spreading-pine-loader.js',import.meta.url),'utf8');
async function fixture({prepare,create}={}){
  let prepares=0,creates=0,options,disposals=0;
  const pixels=Object.freeze({kind:'shared-decoded-cpu-array-fixture'});
  const owner={dispose(){disposals++;}};
  // Run the exact loader function body with two explicit dependency fixtures.
  // The actual ESM imports/registration are exercised separately below.
  const body=source.replace(/^import .*;\n/gm,'').replace('export async function','async function');
  const load=new Function('createSpreadingPineStudy','prepareVegetationTexturePixels',body+'\nreturn prepareSpreadingPineFactory;')(
    o=>{creates++;options=o;return create?create(owner):owner;},
    async o=>{prepares++;assert.equal(o.includeStone,false);return prepare?prepare(pixels):pixels;}
  );
  return {load,pixels,owner,get prepares(){return prepares;},get creates(){return creates;},get options(){return options;},get disposals(){return disposals;}};
}
function tracked(){
  const controller=new AbortController(),signal=controller.signal,add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal),listeners=new Set();
  signal.addEventListener=(name,fn,options)=>{if(name==='abort')listeners.add(fn);return add(name,fn,options);};
  signal.removeEventListener=(name,fn)=>{if(name==='abort')listeners.delete(fn);return remove(name,fn);};
  return {controller,signal,listeners};
}
test('preabort never downloads or constructs a source',async()=>{
  const f=await fixture(),t=tracked();t.controller.abort(new Error('preabort'));
  await assert.rejects(f.load({signal:t.signal}),e=>e===t.signal.reason);
  assert.equal(f.prepares,0);assert.equal(f.creates,0);assert.equal(t.listeners.size,0);
});
test('late preparation abort exposes the original cause without constructing',async()=>{
  const t=tracked(),f=await fixture({prepare:p=>{t.controller.abort(new Error('late preparation'));return p;}});
  await assert.rejects(f.load({signal:t.signal}),e=>e===t.signal.reason);assert.equal(f.creates,0);assert.equal(f.disposals,0);assert.equal(t.listeners.size,0);
});
test('one full-quality source takes the shared arrays; no borrowed array disposal',async()=>{
  const t=tracked(),f=await fixture(),factory=await f.load({signal:t.signal}),owner=factory();
  assert.equal(owner,f.owner);assert.equal(f.options.texturePixels,f.pixels);assert.deepEqual(Object.keys(f.options),['texturePixels']);assert.equal(f.disposals,0);assert.equal(t.listeners.size,0);
  assert.throws(factory,/already consumed/);assert.equal(f.creates,1);owner.dispose();assert.equal(f.disposals,1);
});
test('abort after ready prevents source creation and removes preparation listener',async()=>{
  const t=tracked(),f=await fixture(),factory=await f.load({signal:t.signal});t.controller.abort(new Error('abort before consume'));
  assert.throws(factory,e=>e===t.signal.reason);assert.equal(f.creates,0);assert.equal(f.disposals,0);assert.equal(t.listeners.size,0);
});
test('abort during synchronous source handoff disposes the created source once',async()=>{
  const t=tracked(),f=await fixture({create:owner=>{t.controller.abort(new Error('handoff'));return owner;}}),factory=await f.load({signal:t.signal});
  assert.throws(factory,e=>e===t.signal.reason);assert.equal(f.creates,1);assert.equal(f.disposals,1);assert.equal(t.listeners.size,0);assert.throws(factory,/already consumed/);assert.equal(f.disposals,1);
});
test('source constructor failure keeps its error and removes listener',async()=>{
  const error=new Error('constructor failure'),t=tracked(),f=await fixture({create:()=>{throw error;}}),factory=await f.load({signal:t.signal});
  assert.throws(factory,e=>e===error);assert.equal(f.creates,1);assert.equal(f.disposals,0);assert.equal(t.listeners.size,0);
});

import {getStudioAsset,studioAssets,studioAssetUrl} from '../src/yuanmingyuan/studio-assets.js';
import {loadMuseumModel,museumArchiveCatalog} from '../src/yuanmingyuan/asset-source.js';
import {prepareSpreadingPineFactory} from '../src/yuanmingyuan/spreading-pine-loader.js';
import {pineR4Specification} from '../src/yuanmingyuan/spreading-pine-study.js';
import {spreadingPineReviewViews} from '../src/yuanmingyuan/spreading-pine-views.js';

test('registered contemporary pine resolves to its own full source without replacing existing plants',()=>{
  const config=getStudioAsset('spreading-garden-pine-r4');
  assert.equal(config.id,pineR4Specification.id);assert.equal(config.studyId,pineR4Specification.id);
  assert.notEqual(config,studioAssets.vegetation);assert.equal(config.views,spreadingPineReviewViews);
  assert.match(config.label,/当代/);assert.equal(config.groundY,0);assert.equal(config.defaultView,'whole');
  assert.equal(pineR4Specification.historicalIndividual,false);assert.equal(pineR4Specification.lod,false);
  assert.deepEqual(studioAssets.vegetation.views.juniper.groups,['garden-juniper']);
  assert.equal(Object.hasOwn(museumArchiveCatalog,config.id),false);
  assert.equal(typeof prepareSpreadingPineFactory,'function');
});
test('source-library navigation drops an unrelated archive and keeps the contemporary pine ID',()=>{
  const target=new URL(studioAssetUrl('https://museum.test/yuanmingyuan-studio.html?asset=vegetation&archive=old&specimen=lake-rock&materials=old&view=roof&source=proof','spreading-garden-pine-r4'));
  assert.equal(target.searchParams.get('asset'),'spreading-garden-pine-r4');
  assert.equal(target.searchParams.get('source'),'proof');
  for(const key of ['archive','specimen','materials','view'])assert.equal(target.searchParams.has(key),false);
});
test('actual source-library and ESM loader honor preabort before any image request or owner construction',async t=>{
  let requests=0;t.mock.method(globalThis,'fetch',()=>{requests++;throw new Error('No request permitted');});
  const controller=new AbortController(),reason=new Error('cancelled library selection');controller.abort(reason);
  await assert.rejects(loadMuseumModel('spreading-garden-pine-r4',{signal:controller.signal}),error=>error===reason);
  await assert.rejects(prepareSpreadingPineFactory({signal:controller.signal}),error=>error===reason);
  assert.equal(requests,0);
});
test('a transferred owner remains owned by the caller after preparation signal abort',async()=>{
  const t=tracked(),f=await fixture(),factory=await f.load({signal:t.signal}),owner=factory();
  t.controller.abort(new Error('caller now owns the source'));
  assert.equal(f.disposals,0);assert.equal(t.listeners.size,0);assert.equal(owner,f.owner);
  owner.dispose();assert.equal(f.disposals,1);assert.throws(factory,/already consumed/);
});
