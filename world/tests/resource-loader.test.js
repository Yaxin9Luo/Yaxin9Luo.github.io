import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceLoader,assertSelfContainedGLB} from '../src/resource-loader.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const response=(bytes=[1,2,3])=>new Response(new Uint8Array(bytes));
test('streams bytes without inventing a total and merges completed and in-flight work',async()=>{
  let calls=0;const gate=deferred(),events=[];
  const loader=createResourceLoader({fetchImpl:async()=>{calls++;await gate.promise;return response();},onEvent:e=>events.push(e)});
  const a=loader.load({id:'wizard',url:'/wizard.glb'}),b=loader.load({id:'wizard',url:'/wizard.glb'});gate.resolve();
  assert.equal((await a).byteLength,3);assert.equal(await b,await a);assert.equal(await loader.load({id:'wizard',url:'/wizard.glb'}),await a);assert.equal(calls,1);
  assert.ok(events.some(e=>e.receivedBytes===3));assert.ok(events.every(e=>e.totalBytes===undefined));
});
test('one early transient retry, no HTTP 404 or parse retries, failures can retry manually',async()=>{
  let calls=0;const loader=createResourceLoader({fetchImpl:async()=>{if(++calls===1)throw new TypeError('offline');return response();}});
  await loader.load('/ok');assert.equal(calls,2);
  for(const parseFailure of [false,true]){
    calls=0;const failed=createResourceLoader({fetchImpl:async()=>{calls++;return parseFailure?response():new Response('',{status:404});}});
    const options=parseFailure?{parse:()=>{throw new Error('broken');}}:{};
    await assert.rejects(failed.load('/bad',options),e=>e.type===(parseFailure?'parse':'http'));assert.equal(calls,1);
    await assert.rejects(failed.load('/bad',options));assert.equal(calls,2);
  }
});
test('cancellation aborts transport and disposes uncancellable late parse',async()=>{
  let transport;const gate=deferred();let disposed=0;
  const loader=createResourceLoader({fetchImpl:async(url,{signal})=>{transport=signal;return response();}});
  const controller=new AbortController();const pending=loader.load('/late',{signal:controller.signal,parse:()=>gate.promise,dispose:()=>disposed++});
  await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(pending,e=>e.type==='cancelled');assert.equal(transport.aborted,true);
  gate.resolve({scene:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,1);
  assert.equal((await loader.load('/late')).byteLength,3);
});
test('cancelling one merged consumer keeps the other transport alive',async()=>{
  const gate=deferred();let transport;const loader=createResourceLoader({fetchImpl:async(url,{signal})=>{transport=signal;await gate.promise;return response();}});
  const controller=new AbortController(),a=loader.load('/shared',{signal:controller.signal}),b=loader.load('/shared');controller.abort();await assert.rejects(a);assert.equal(transport.aborted,false);gate.resolve();assert.equal((await b).byteLength,3);
});
test('merged consumers keep independent deadlines regardless of subscription order',async()=>{
  for(const deadlines of [[20000,5000],[5000,20000]]){
    let time=0,transport;const alarms=new Map(),gate=deferred();let serial=0;
    const loader=createResourceLoader({now:()=>time,setTimeoutImpl:(fn,delay)=>{const id=++serial;alarms.set(id,{fn,due:time+delay});return id;},clearTimeoutImpl:id=>alarms.delete(id),fetchImpl:async(url,{signal})=>{transport=signal;await gate.promise;return response();}});
    const promises=deadlines.map(deadline=>loader.load('/shared',{deadline}));
    await Promise.resolve();time=5000;
    const expired=assert.rejects(promises[deadlines.indexOf(5000)],error=>error.type==='timeout');
    for(const alarm of [...alarms.values()])if(alarm.due<=time)alarm.fn();await expired;
    assert.equal(transport.aborted,false);time=6000;gate.resolve();
    assert.equal((await promises[deadlines.indexOf(20000)]).byteLength,3);
  }
});
test('a synchronous parser cannot outlive a shorter consumer deadline before its timer fires',async()=>{
  let time=0;
  const loader=createResourceLoader({now:()=>time,setTimeoutImpl:()=>1,clearTimeoutImpl(){},fetchImpl:async()=>response()});
  const parse=buffer=>{time=6000;return buffer;};
  const long=loader.load('/shared',{deadline:20000,parse}),short=loader.load('/shared',{deadline:5000,parse});
  await assert.rejects(short,error=>error.type==='timeout');assert.equal((await long).byteLength,3);
});
test('diagnostics strip URL credentials, query and fragment and record failure phase',async()=>{
  const loader=createResourceLoader({fetchImpl:async()=>new Response('',{status:404})});
  await assert.rejects(loader.load({id:'wizard',url:'https://user:password@example.com/w.glb?token=secret#private'}));
  const events=loader.diagnostics();assert.ok(events.some(e=>e.type==='http'&&e.phase==='failed'&&e.url==='https://example.com/w.glb'));assert.ok(!JSON.stringify(events).includes('secret'));
});
test('GLB external references are rejected before unmanaged subrequests',()=>{
  const make=json=>{const data=new TextEncoder().encode(JSON.stringify(json).padEnd(Math.ceil(JSON.stringify(json).length/4)*4,' ')),buffer=new ArrayBuffer(20+data.length),view=new DataView(buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,data.length,true);view.setUint32(16,0x4e4f534a,true);new Uint8Array(buffer,20).set(data);return buffer;};
  assert.doesNotThrow(()=>assertSelfContainedGLB(make({buffers:[{byteLength:0}],images:[{bufferView:0}]})));
  assert.throws(()=>assertSelfContainedGLB(make({images:[{uri:'texture.png'}]})),/external/i);
});

test('a deadline aborts a hanging fetch and does not permit a second timeout-length retry',async()=>{
  let time=0,alarm,transport,calls=0;
  const loader=createResourceLoader({now:()=>time,setTimeoutImpl:fn=>{alarm=fn;return 1;},clearTimeoutImpl(){},fetchImpl:(url,{signal})=>{calls++;transport=signal;return new Promise(()=>{});}});
  const pending=loader.load('/hanging',{deadline:20000});await Promise.resolve();time=20000;alarm();
  await assert.rejects(pending,e=>e.type==='timeout');assert.equal(transport.aborted,true);assert.equal(calls,1);
});

test('transient errors too late in the attempt do not automatically retry',async()=>{
  let time=0,calls=0;
  const loader=createResourceLoader({now:()=>time,fetchImpl:async()=>{calls++;time=19500;throw new TypeError('offline');}});
  await assert.rejects(loader.load('/late',{deadline:20000}));assert.equal(calls,1);
});

test('body-less responses retain byte progress and raw URL identifiers are redacted',async()=>{
  const loader=createResourceLoader({fetchImpl:async()=>({ok:true,headers:new Headers(),body:null,arrayBuffer:async()=>new Uint8Array([4,5]).buffer})});
  await loader.load('https://user:password@example.com/test?token=secret');const events=loader.diagnostics();
  assert.ok(events.some(e=>e.receivedBytes===2));assert.ok(!JSON.stringify(events).includes('secret'));assert.ok(!JSON.stringify(events).includes('password'));
});

test('manifest stable IDs resolve to the supplied content URL and retain resource stage',async()=>{
  let url;const loader=createResourceLoader({manifest:{wizard:{id:'wizard',url:'/models/wizard.abcdef.glb',phase:1}},fetchImpl:async value=>{url=value;return response();}});
  await loader.load('wizard');assert.equal(url,'/models/wizard.abcdef.glb');assert.ok(loader.diagnostics().every(e=>e.id==='wizard'&&e.stage===1));
});

test('diagnostics retain core milestones after many optional download chunks',async()=>{
  const loader=createResourceLoader({fetchImpl:async()=>new Response(new ReadableStream({start(controller){for(let i=0;i<900;i++)controller.enqueue(new Uint8Array(32));controller.close();}}))});
  await loader.load('wizard-core');await loader.load('botanical/cherry');
  const events=loader.diagnostics();
  for(const id of ['wizard-core','botanical/cherry']){
    assert.ok(events.some(event=>event.id===id&&event.phase==='queued'));
    assert.ok(events.some(event=>event.id===id&&event.phase==='parsing'));
    assert.ok(events.some(event=>event.id===id&&event.phase==='ready'&&event.receivedBytes===28800));
  }
  assert.ok(events.length<15,'stream samples must not evict initialization evidence');
});
