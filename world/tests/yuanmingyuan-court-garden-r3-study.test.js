import test from 'node:test';
import assert from 'node:assert/strict';
import {createXieqiquCourtGardenR3Study} from '../src/yuanmingyuan/xieqiqu-court-garden-r3-study.js';

function fixture(){
 const events=[],maps={color:{data:new Uint8Array([1,2,3])}},floor={isMesh:true};
 let released=false;
 const pixels={get maps(){return released?null:maps;},dispose(){released=true;events.push('pixels');}};
 const group={getObjectByName(name){assert.equal(name,'xieqiqu-court-paving');return {traverse(fn){fn(floor);}};}};
 const owner={group,dispose(){events.push('owner');}};
 const options={layout:{id:'explicit-r3'},createSources(){},prepareGarden(){},
   async preparePixels(){events.push('prepare');return pixels;},
   async assemble(input){
     assert.equal(input.fishPixels,pixels);assert.equal(input.fishPixels.maps,maps);
     const lease=await input.decoratePaving({group,signal:input.signal});
     assert.equal(lease.borrowedArrays,maps);
     return owner;
   },
   bindPaving(input){assert.equal(input.floor,floor);assert.equal(input.courtRoot,group);
     assert.equal(input.pixels,maps);return {borrowedArrays:input.pixels};},
 };
 return{events,maps,pixels,group,owner,options};
}
test('one original decoded marble handle supplies both owners before releasing preparation references',async()=>{
 const f=fixture();const result=await createXieqiquCourtGardenR3Study(f.options);
 assert.equal(result,f.owner);assert.deepEqual(f.events,['prepare','pixels']);
 assert.equal(f.pixels.maps,null);assert.deepEqual([...f.maps.color.data],[1,2,3]);
});
test('abort after a late pixel preparation releases it without assembling geometry',async()=>{
 const f=fixture(),controller=new AbortController();
 await assert.rejects(createXieqiquCourtGardenR3Study({...f.options,signal:controller.signal,
   async preparePixels(){controller.abort();return f.pixels;},
   assemble(){throw new Error('must not assemble');}}),{name:'AbortError'});
 assert.deepEqual(f.events,['pixels']);
});
test('failed assembly still releases the shared pixel handle',async()=>{
 const f=fixture();
 await assert.rejects(createXieqiquCourtGardenR3Study({...f.options,assemble(){throw new Error('source mismatch');}}),/source mismatch/);
 assert.deepEqual(f.events,['prepare','pixels']);
});
test('abort as assembly finishes cannot publish a live owner',async()=>{
 const f=fixture(),controller=new AbortController();
 await assert.rejects(createXieqiquCourtGardenR3Study({...f.options,signal:controller.signal,
   assemble(){controller.abort();return f.owner;}}),{name:'AbortError'});
 assert.deepEqual(f.events,['prepare','owner','pixels']);
});
test('an ambiguous floor fails before material mutation and still releases preparation',async()=>{
 const f=fixture();
 f.group.getObjectByName=()=>({traverse(fn){fn({isMesh:true});fn({isMesh:true});}});
 let bound=false;
 await assert.rejects(createXieqiquCourtGardenR3Study({...f.options,bindPaving(){bound=true;}}),/single paving mesh/);
 assert.equal(bound,false);assert.deepEqual(f.events,['prepare','pixels']);
});


test('late abort waits for owner cleanup before dropping preparation references',async()=>{
 const f=fixture(),controller=new AbortController();let finish,entered;
 const waiting=new Promise(resolve=>{entered=resolve;});
 f.owner.whenIdle=async()=>{f.events.push('idle');entered();await new Promise(resolve=>{finish=resolve;});};
 const task=createXieqiquCourtGardenR3Study({...f.options,signal:controller.signal,assemble(){controller.abort();return f.owner;}});
 await waiting;assert.equal(f.pixels.maps,f.maps);assert(!f.events.includes('pixels'));
 finish();await assert.rejects(task,{name:'AbortError'});
 assert.deepEqual(f.events,['prepare','owner','idle','pixels']);
});
test('late abort reports synchronous and asynchronous cleanup without masking the abort cause',async()=>{
 const f=fixture(),controller=new AbortController(),sync=new Error('sync disposal'),asyncFailure=new Error('async cleanup');
 f.owner.dispose=()=>{f.events.push('owner');throw sync;};
 f.owner.whenIdle=async()=>{f.events.push('idle');throw asyncFailure;};
 await assert.rejects(createXieqiquCourtGardenR3Study({...f.options,signal:controller.signal,assemble(){controller.abort();return f.owner;}}),
  error=>error.cause?.name==='AbortError'&&error.errors.includes(sync)&&error.errors.includes(asyncFailure));
 assert.deepEqual(f.events,['prepare','owner','idle','pixels']);
});
