import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {prepareMuseumGroundSources} from '../src/yuanmingyuan/museum-prepared-sources.js';

const descriptors=['a','b'].map(id=>({id,assetId:`asset-${id}`,source:{approvedManifestSHA256:id.repeat(64)}}));
function owner(){let disposed=false;return {group:new Group(),calls:0,get disposed(){return disposed;},dispose(){this.calls++;disposed=true;}};}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function causes(error){return [error,...(error?.errors||[]).flatMap(causes)];}

test('only successfully decoded owners allow ground, and transfer does not decode or dispose again',async()=>{
  const made=[],pool=await prepareMuseumGroundSources(descriptors,{load:async()=>{const value=owner();made.push(value);return value;}});
  assert.deepEqual(pool.readyAssetIds,['asset-a','asset-b']);assert.equal(pool.snapshot.pending[0].manifestSHA256,'a'.repeat(64));
  assert.equal(pool.take('a'),made[0]);assert.equal(pool.has('a'),false);assert.throws(()=>pool.take('a'));
  pool.dispose();pool.dispose();assert.equal(made[0].calls,0);assert.equal(made[1].calls,1);made[0].dispose();
});

test('a failed second decode releases the first without admitting a partial terrain plan',async()=>{
  const first=owner();let calls=0;
  await assert.rejects(prepareMuseumGroundSources(descriptors,{load:async()=>{if(calls++)throw new Error('corrupt archive');return first;}}),/corrupt archive/);
  assert.equal(first.calls,1);
});

test('an abort during a decoder that ignores cancellation releases its late complete result',async()=>{
  const controller=new AbortController(),value=owner();let resolve;
  const ready=prepareMuseumGroundSources(descriptors.slice(0,1),{signal:controller.signal,load:()=>new Promise(r=>{resolve=r;})});
  controller.abort(new Error('page closed'));resolve(value);await assert.rejects(ready,/page closed/);assert.equal(value.calls,1);
});

test('page exit disposes unclaimed owners, while a transferred resident retains ownership',async()=>{
  const controller=new AbortController(),values=[];
  const pool=await prepareMuseumGroundSources(descriptors,{signal:controller.signal,load:async()=>{const value=owner();values.push(value);return value;}});
  const resident=pool.take('a');controller.abort();assert.deepEqual(pool.readyAssetIds,[]);assert.equal(values[1].calls,1);assert.equal(resident.calls,0);
  assert.throws(()=>pool.take('b'));resident.dispose();pool.dispose();assert(values.every(value=>value.calls===1));
});

test('duplicate descriptors are rejected before any decoder runs',async()=>{
  let calls=0;await assert.rejects(prepareMuseumGroundSources([descriptors[0],descriptors[0]],{load:async()=>{calls++;return owner();}}),/unique/);assert.equal(calls,0);
});

test('a cached owner returned for two different sites is rejected and disposed only once',async()=>{
  const shared=owner();await assert.rejects(prepareMuseumGroundSources(descriptors,{load:async()=>shared}),/distinct/);assert.equal(shared.calls,1);
});

test('cleanup continues after a source disposer throws',async()=>{
  const values=[owner(),owner()];values[0].dispose=function(){this.calls++;throw new Error('release error');};let i=0;
  const pool=await prepareMuseumGroundSources(descriptors,{load:async()=>values[i++]});assert.throws(()=>pool.dispose(),AggregateError);assert(values.every(value=>value.calls===1));pool.dispose();
});

test('abort releases completed sources immediately while the next decoder is still pending, then disposes its late result once',async()=>{
  const controller=new AbortController(),first=owner(),late=owner(),entered=deferred(),gate=deferred(),reason=new Error('page hidden');let calls=0;
  const pending=prepareMuseumGroundSources([...descriptors,{id:'c',assetId:'asset-c'}],{signal:controller.signal,load:async()=>{if(calls++===0)return first;entered.resolve();await gate.promise;return late;}});
  await entered.promise;
  try{
    controller.abort(reason);assert.equal(first.calls,1,'The completed owner must release before the pending decoder settles');assert.equal(late.calls,0);
  }finally{gate.resolve();await assert.rejects(pending,error=>error===reason);}
  assert.equal(first.calls,1);assert.equal(late.calls,1);assert.equal(calls,2,'No next asset may start after abort');
});

test('an already released cached owner returned late is not disposed twice or accepted as a different descriptor',async()=>{
  const controller=new AbortController(),shared=owner(),entered=deferred(),gate=deferred();let calls=0;
  const pending=prepareMuseumGroundSources(descriptors,{signal:controller.signal,load:async()=>{if(calls++===0)return shared;entered.resolve();await gate.promise;return shared;}});
  await entered.promise;
  try{controller.abort();assert.equal(shared.calls,1);}finally{gate.resolve();await assert.rejects(pending,/distinct/);}
  assert.equal(shared.calls,1);
});

test('early-abort cleanup and late-owner cleanup failures remain observable with the original cancellation reason',async()=>{
  const controller=new AbortController(),first=owner(),late=owner(),entered=deferred(),gate=deferred(),reason=new Error('page hidden'),earlyFailure=new Error('completed owner release failed'),lateFailure=new Error('late owner release failed');let calls=0;
  for(const [value,failure] of [[first,earlyFailure],[late,lateFailure]]){const dispose=value.dispose;value.dispose=function(){dispose.call(this);throw failure;};}
  const pending=prepareMuseumGroundSources(descriptors,{signal:controller.signal,load:async()=>{if(calls++===0)return first;entered.resolve();await gate.promise;return late;}});
  await entered.promise;
  try{assert.doesNotThrow(()=>controller.abort(reason));assert.equal(first.calls,1);}
  finally{
    gate.resolve();await assert.rejects(pending,error=>{assert(error instanceof AggregateError);const errors=causes(error);assert(errors.includes(reason));assert(errors.includes(earlyFailure));assert(errors.includes(lateFailure));return true;});
  }
  assert.equal(first.calls,1);assert.equal(late.calls,1);
});

test('an ordinary decoder rejection still retains both the decode error and cleanup error',async()=>{
  const first=owner(),decodeFailure=new Error('invalid bytes'),cleanupFailure=new Error('owner cleanup failed');let calls=0;
  const dispose=first.dispose;first.dispose=function(){dispose.call(this);throw cleanupFailure;};
  await assert.rejects(prepareMuseumGroundSources(descriptors,{load:async()=>{if(calls++)throw decodeFailure;return first;}}),error=>{
    assert(error instanceof AggregateError);assert(causes(error).includes(decodeFailure));assert(causes(error).includes(cleanupFailure));return true;
  });assert.equal(first.calls,1);
});

test('abort after the pool is returned keeps cleanup failures in diagnostics and releases every untaken owner',async()=>{
  const controller=new AbortController(),values=[owner(),owner()];let calls=0;
  const dispose=values[0].dispose;values[0].dispose=function(){dispose.call(this);throw new Error('release failed');};
  const pool=await prepareMuseumGroundSources(descriptors,{signal:controller.signal,load:async()=>values[calls++]});
  assert.doesNotThrow(()=>controller.abort());assert(values.every(value=>value.calls===1));assert.equal(pool.snapshot.disposed,true);assert.equal(pool.snapshot.pending.length,0);assert.equal(pool.snapshot.cleanupErrors.length,1);
  pool.dispose();assert(values.every(value=>value.calls===1));
});
