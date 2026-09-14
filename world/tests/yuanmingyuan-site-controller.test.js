import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';

const sites=[{id:'haiyantang'},{id:'yuanyingguan'}];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(id){const value={id,disposed:0,detached:0,dispose(){this.disposed++;}};value.group={removeFromParent(){value.detached++;}};return value;}

test('rapid travel serializes unfinished decoding and frees a stale result without mounting it',async()=>{
  const gate=deferred(),calls=[],mounted=[],states=[],a=fixture('a'),b=fixture('b');
  const controller=createMuseumSiteController({sites,onChange:state=>states.push(state),load:(site,{signal})=>{calls.push({id:site.id,signal});return site.id==='haiyantang'?gate.promise:b;},mount:value=>{mounted.push(value.id);return ()=>mounted.push('removed-'+value.id);}});
  const first=controller.select('haiyantang');await flush();const second=controller.select('yuanyingguan');await flush();
  assert.equal(calls.length,1);assert.equal(calls[0].signal.aborted,true);gate.resolve(a);await first;await second;
  assert.equal(a.disposed,1);assert.deepEqual(mounted,['b']);assert.equal(controller.resource,b);assert.deepEqual(states.map(s=>s.status),['loading','loading','ready']);
  controller.dispose();controller.dispose();assert.equal(b.disposed,1);assert.equal(b.detached,1);assert.deepEqual(mounted,['b','removed-b']);
});

test('a failed load is retryable, but selecting the ready site reuses its owner',async()=>{
  let attempts=0;const a=fixture('a');const controller=createMuseumSiteController({sites,load:async()=>{if(++attempts===1)throw new Error('asset unavailable');return a;},mount:()=>()=>{}});
  assert.equal(await controller.select('haiyantang'),null);assert.equal(controller.snapshot.status,'failed');assert.equal(controller.snapshot.error,'asset unavailable');
  assert.equal(await controller.select('haiyantang'),a);assert.equal(await controller.select('haiyantang'),a);assert.equal(attempts,2);
  await assert.rejects(controller.select('__proto__'),/Unknown museum site/);assert.equal(controller.resource,a);controller.dispose();
});

test('leaving while a decoder ignores cancellation releases the eventual geometry',async()=>{
  const gate=deferred(),signal=new AbortController(),a=fixture('a');let mounted=0;
  const controller=createMuseumSiteController({sites,signal:signal.signal,load:()=>gate.promise,mount:()=>{mounted++;}});
  const pending=controller.select('haiyantang');await flush();signal.abort();gate.resolve(a);assert.equal(await pending,null);
  assert.equal(a.disposed,1);assert.equal(mounted,0);assert.equal(controller.resource,null);assert.equal(controller.snapshot.status,'disposed');assert.equal(await controller.select('yuanyingguan'),null);
});

test('an interrupted mount cannot overwrite a newer travel request',async()=>{
  const a=fixture('a'),b=fixture('b'),events=[];let controller,second;
  controller=createMuseumSiteController({sites,load:async site=>site.id==='haiyantang'?a:b,mount:value=>{events.push(value.id);if(value===a)second=controller.select('yuanyingguan');return ()=>events.push('removed-'+value.id);}});
  assert.equal(await controller.select('haiyantang'),null);await second;assert.equal(a.disposed,1);assert.equal(controller.resource,b);assert.deepEqual(events,['a','removed-a','b']);controller.dispose();
});

test('cancelling a loaded site immediately releases it and a pre-aborted lifetime does no work',async()=>{
  const a=fixture('a');let loaded=0;
  const controller=createMuseumSiteController({sites,load:async()=>{loaded++;return a;},mount:()=>()=>{}});
  await controller.select('haiyantang');controller.cancel();assert.equal(a.disposed,1);assert.equal(controller.snapshot.status,'idle');controller.dispose();
  const signal=new AbortController();signal.abort();const stopped=createMuseumSiteController({sites,signal:signal.signal,load:async()=>{loaded++;return a;},mount:()=>{}});await stopped.select('haiyantang');assert.equal(loaded,1);assert.equal(stopped.snapshot.status,'disposed');
});

test('explicit release returns a borrowed owner even when unmount throws, without detaching or disposing it',async()=>{
  const a=fixture('a');let returned=0;const controller=createMuseumSiteController({sites,load:()=>a,mount:()=>()=>{throw new Error('unmount failed');},release:owner=>{assert.equal(owner,a);returned++;}});
  await controller.select('haiyantang');assert.throws(()=>controller.cancel(),AggregateError);assert.equal(returned,1);assert.equal(a.disposed,0);assert.equal(a.detached,0);assert.equal(controller.snapshot.status,'idle');assert.equal(controller.snapshot.cleanupErrors[0].message,'unmount failed');controller.dispose();assert.equal(returned,1);
});

test('a throwing late-result release cannot prevent a queued request or its later resource cleanup',async()=>{
  const gate=deferred(),a=fixture('a'),b=fixture('b'),returned=[];const controller=createMuseumSiteController({sites,load:site=>site.id==='haiyantang'?gate.promise:b,mount:()=>()=>{},release:owner=>{returned.push(owner.id);if(owner===a)throw new Error('late return failed');}});
  const first=controller.select('haiyantang');await flush();const next=controller.select('yuanyingguan');gate.resolve(a);assert.equal(await first,null);assert.equal(await next,b);assert.equal(controller.resource,b);assert(controller.snapshot.cleanupErrors.some(e=>e.message==='late return failed'));
  controller.dispose();assert.deepEqual(returned,['a','b']);assert.equal(controller.snapshot.status,'disposed');assert.equal(b.disposed,0);
});

test('retire callback failure remains visible and a following retry can still load and clean the next owner',async()=>{
  const a=fixture('a'),b=fixture('b'),returned=[];let calls=0;
  const controller=createMuseumSiteController({sites,load:site=>{calls++;return site.id==='haiyantang'?a:b;},mount:()=>()=>{},release:owner=>{returned.push(owner.id);if(owner===a)throw new Error('return failed');}});
  await controller.select('haiyantang');await assert.rejects(controller.select('yuanyingguan'),AggregateError);assert.equal(controller.snapshot.status,'failed');assert.equal(controller.resource,null);assert.equal(calls,1);
  assert.equal(await controller.select('yuanyingguan'),b);assert.equal(calls,2);controller.dispose();assert.deepEqual(returned,['a','b']);
});
