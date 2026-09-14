import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanionInstallation} from '../src/companion-installation.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('one installation joins repeated entries and waits for assets and actual world readiness',async()=>{
  const assets=deferred(),world=deferred(),statuses=[];let loads=0,installs=0,disposals=0,options;
  const operation=createCompanionInstallation({loadAssets:o=>{loads++;options=o;return assets.promise;},install:()=>{installs++;return {dispose(){disposals++;}};},onStatus:s=>statuses.push(s.status)});
  const first=operation.request({worldReady:world.promise,attemptId:31,deadline:1234});assert.equal(first,operation.request());await Promise.resolve();assert.equal(loads,1);assert.equal(options.attemptId,31);assert.equal(options.deadline,1234);
  assets.resolve(true);await Promise.resolve();assert.equal(installs,0);world.resolve();await first;assert.equal(installs,1);assert.equal(first,operation.request());assert.deepEqual(statuses,['loading','ready']);
  operation.dispose();operation.dispose();assert.equal(disposals,1);assert.equal(operation.snapshot().status,'disposed');
});

test('page lifetime and Game disposal cancel a pending consumer and never install late',async()=>{
  for(const reason of ['lifetime','dispose']){
    const lifetime=new AbortController(),world=deferred();let installs=0,signal;
    const operation=createCompanionInstallation({signal:lifetime.signal,loadAssets:o=>{signal=o.signal;return Promise.resolve(true);},install:()=>{installs++;}});
    const request=operation.request({worldReady:world.promise});const rejected=assert.rejects(request,{name:'AbortError'});await Promise.resolve();
    if(reason==='lifetime')lifetime.abort();else operation.dispose();await rejected;assert.equal(signal.aborted,true);world.resolve();await Promise.resolve();assert.equal(installs,0);operation.dispose();
  }
});

test('failed assets cannot become ready or create repeated implicit consumers',async()=>{
  let calls=0,installs=0;const operation=createCompanionInstallation({loadAssets:async()=>{calls++;throw new Error('decode failed');},install:()=>{installs++;}});
  const first=operation.request();await assert.rejects(first,/decode failed/);assert.equal(operation.request(),first);assert.equal(operation.snapshot().status,'failed');assert.equal(operation.snapshot().error,'decode failed');assert.equal(calls,1);assert.equal(installs,0);operation.dispose();
});

test('disposing before the first request keeps terminal status and never starts an asset consumer',async()=>{
  let loads=0;const operation=createCompanionInstallation({install:()=>{throw new Error('late install');},loadAssets:async()=>{loads++;}});operation.dispose();
  await assert.rejects(operation.request(),{name:'AbortError'});assert.equal(operation.snapshot().status,'disposed');assert.equal(loads,0);
});
