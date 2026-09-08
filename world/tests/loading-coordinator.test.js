import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingCoordinator} from '../src/loading-coordinator.js';
function clock(){let time=0,id=0;const timers=new Map();return {now:()=>time,setTimeoutImpl(fn,ms){timers.set(++id,{fn,at:time+ms});return id;},clearTimeoutImpl(id){timers.delete(id);},tick(ms){time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}}};}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('shell is inert until intent; repeated starts join one attempt and enhancements cannot revoke interaction',async()=>{
  const time=clock(),gate=deferred();let calls=0;
  const coordinator=createLoadingCoordinator({...time,createCore:()=>{calls++;return gate.promise;}});
  assert.equal(coordinator.snapshot.availability,'shell-ready');assert.equal(calls,0);
  const a=coordinator.start(),b=coordinator.start();assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);
  gate.resolve({dispose(){}});await a;assert.equal(coordinator.snapshot.availability,'interactive');
  coordinator.enhancement({phase:'failed',type:'http'});assert.equal(coordinator.snapshot.enhancements,'degraded');assert.equal(coordinator.snapshot.availability,'interactive');
});
test('one 20 second deadline aborts core, ignores late results, and retry owns its own generation',async()=>{
  const time=clock(),gates=[deferred(),deferred()];let calls=0,disposed=0,signal;
  const coordinator=createLoadingCoordinator({...time,createCore:context=>{signal=context.signal;return gates[calls++].promise;}});
  const first=coordinator.start();await Promise.resolve();time.tick(20000);assert.equal(await first,null);assert.equal(signal.aborted,true);assert.equal(coordinator.snapshot.availability,'static-only');
  const second=coordinator.start();await Promise.resolve();gates[0].resolve({dispose(){disposed++;}});await Promise.resolve();await Promise.resolve();assert.equal(disposed,1);assert.equal(coordinator.snapshot.attemptId,2);
  gates[1].resolve({dispose(){}});await second;assert.equal(coordinator.snapshot.availability,'interactive');
});
test('cancel leaves static content available and a rejected enhancement never changes that state',async()=>{
  const time=clock(),gate=deferred();const coordinator=createLoadingCoordinator({...time,createCore:()=>gate.promise});
  const pending=coordinator.start();coordinator.cancel();assert.equal(await pending,null);assert.equal(coordinator.snapshot.availability,'static-only');
});

test('explicit optional completion remains accepted after the core promise settles',async()=>{
  let progress;const coordinator=createLoadingCoordinator({createCore:async context=>{progress=context.onProgress;return {dispose(){}};}});
  await coordinator.start();progress({enhancements:'ready',phase:'enhancements'});
  assert.equal(coordinator.snapshot.enhancements,'ready');assert.equal(coordinator.snapshot.availability,'interactive');
  progress({enhancements:'degraded'});progress({enhancements:'ready'});assert.equal(coordinator.snapshot.enhancements,'degraded');
});

test('a late synchronous completion cannot beat a delayed browser deadline timer',async()=>{
  let now=0,disposed=0;const coordinator=createLoadingCoordinator({now:()=>now,createCore:async()=>{now=20001;return {dispose(){disposed++;}};}});
  assert.equal(await coordinator.start(),null);assert.equal(disposed,1);assert.equal(coordinator.snapshot.error.type,'timeout');
});

test('individual resources cannot declare the initial enhancement batch ready',async()=>{
  let progress;const coordinator=createLoadingCoordinator({createCore:async context=>{progress=context.onProgress;return {dispose(){}};}});
  await coordinator.start();
  coordinator.enhancement({id:'sky',phase:'queued',attemptId:1});
  coordinator.enhancement({id:'sky',phase:'ready',attemptId:1});
  assert.equal(coordinator.snapshot.enhancements,'loading-enhancements');
  coordinator.enhancement({id:'night-hdr',phase:'fetching',attemptId:1});
  progress({phase:'enhancements',enhancements:'ready'});
  assert.equal(coordinator.snapshot.enhancements,'loading-enhancements');
  coordinator.enhancement({id:'night-hdr',phase:'ready',attemptId:1});
  assert.equal(coordinator.snapshot.enhancements,'ready');
});

test('a successful late optional request restores ready after every transfer phase',async()=>{
  let progress;const coordinator=createLoadingCoordinator({createCore:async context=>{progress=context.onProgress;return {dispose(){}};}});
  await coordinator.start();progress({phase:'enhancements',enhancements:'ready'});
  // On-demand requests omit attemptId; repeated byte progress and a retry are one resource.
  for(const phase of ['queued','fetching','fetching','retrying','fetching','parsing']){
    coordinator.enhancement({id:'wraith',phase,stage:3});
    assert.equal(coordinator.snapshot.enhancements,'loading-enhancements');
  }
  coordinator.enhancement({id:'wraith',phase:'ready',stage:3});
  assert.equal(coordinator.snapshot.enhancements,'ready');
  assert.equal(coordinator.snapshot.availability,'interactive');
});

test('concurrent late optional requests must all settle before ready returns',async()=>{
  let progress;const coordinator=createLoadingCoordinator({createCore:async context=>{progress=context.onProgress;return {dispose(){}};}});
  await coordinator.start();progress({phase:'enhancements',enhancements:'ready'});
  coordinator.enhancement({id:'night-hdr',phase:'queued',stage:3});
  coordinator.enhancement({id:'wraith',phase:'queued',stage:3});
  coordinator.enhancement({id:'night-hdr',phase:'ready',stage:3});
  assert.equal(coordinator.snapshot.enhancements,'loading-enhancements');
  coordinator.enhancement({id:'wraith',phase:'ready',stage:3});
  assert.equal(coordinator.snapshot.enhancements,'ready');
});

test('failed or cancelled optional resources keep the current attempt degraded',async()=>{
  for(const terminalPhase of ['failed','cancelled']){
    let progress;const coordinator=createLoadingCoordinator({createCore:async context=>{progress=context.onProgress;return {dispose(){}};}});
    await coordinator.start();progress({phase:'enhancements',enhancements:'ready'});
    coordinator.enhancement({id:'night-hdr',phase:'queued'});
    coordinator.enhancement({id:'wraith',phase:'queued'});
    coordinator.enhancement({id:'night-hdr',phase:terminalPhase});
    coordinator.enhancement({id:'wraith',phase:'ready'});
    progress({phase:'enhancements',enhancements:'ready'});
    assert.equal(coordinator.snapshot.enhancements,'degraded');
    assert.equal(coordinator.snapshot.availability,'interactive');
  }
});

test('a new core attempt resets optional state and ignores prior-generation events',async()=>{
  const progress=[];const coordinator=createLoadingCoordinator({createCore:async context=>{progress.push(context.onProgress);return {dispose(){}};}});
  await coordinator.start();progress[0]({phase:'enhancements',enhancements:'ready'});
  coordinator.enhancement({id:'old-pending',phase:'queued',attemptId:1});
  coordinator.enhancement({id:'old-failed',phase:'failed',attemptId:1});
  assert.equal(coordinator.snapshot.enhancements,'degraded');
  coordinator.dispose();await coordinator.start();
  assert.equal(coordinator.snapshot.enhancements,'idle');
  progress[0]({phase:'enhancements',enhancements:'degraded'});
  coordinator.enhancement({id:'old-failed',phase:'failed',attemptId:1});
  coordinator.enhancement({id:'old-pending',phase:'fetching',attemptId:1});
  assert.equal(coordinator.snapshot.enhancements,'idle');
  coordinator.enhancement({id:'new-detail',phase:'ready',attemptId:2});
  assert.equal(coordinator.snapshot.enhancements,'loading-enhancements');
  progress[1]({phase:'enhancements',enhancements:'ready'});
  assert.equal(coordinator.snapshot.enhancements,'ready');
});
