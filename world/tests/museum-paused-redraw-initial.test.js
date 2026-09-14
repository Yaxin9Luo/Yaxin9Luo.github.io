import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumPausedRedraw} from '../src/yuanmingyuan/museum-paused-redraw.js';
import {createTestFrames} from './helpers/museum-scene-redraw.js';
function fixture(options={deferUntilFlush:true}){
  const frames=createTestFrames(),state={available:true,paused:true,value:'initial'},draws=[];
  const owner=createMuseumPausedRedraw({...options,isPaused:()=>state.paused,canRender:()=>state.available,requestFrame:f=>frames.request(f),cancelFrame:id=>frames.cancel(id),render:dt=>{draws.push({dt,value:state.value});return true;}});
  return {frames,state,draws,owner};
}
test('deferred UI changes keep the latest state without scheduling until one fresh flush',()=>{
  const h=fixture();
  for(let i=0;i<60;i++){h.state.value=i;assert.equal(h.owner.request(),false);h.owner.sync();}
  h.frames.step();assert.equal(h.frames.pending.length,0);assert.deepEqual(h.draws,[]);assert.equal(h.owner.deferred,true);
  assert.equal(h.owner.flush(),true);assert.deepEqual(h.draws,[{dt:0,value:59}]);assert.equal(h.owner.deferred,false);
  h.owner.dispose();
});
test('unavailable flush retains deferral; later requests and flushes use the original cancellation rules',()=>{
  const h=fixture();h.state.available=false;assert.equal(h.owner.flush(),false);assert.equal(h.owner.deferred,true);
  h.state.available=true;assert.equal(h.owner.request(),false);h.state.value='first';assert(h.owner.flush());
  for(let i=0;i<12;i++){h.state.value=i;h.owner.request();}
  assert.equal(h.frames.pending.length,1);h.frames.step();assert.equal(h.draws.length,2);assert.equal(h.draws.at(-1).value,11);
  h.state.value='flush';h.owner.request();const stale=h.frames.ids[0];h.owner.flush();h.frames.late(stale);
  assert.equal(h.draws.length,3);assert.equal(h.draws.at(-1).value,'flush');assert.equal(h.frames.pending.length,0);h.owner.dispose();
});
test('cancel and dispose during deferral never submit or release any borrowed resource',()=>{
  const h=fixture();h.owner.request();assert.equal(h.owner.cancel(),false);assert.equal(h.owner.deferred,true);
  h.owner.dispose();h.owner.dispose();assert.equal(h.owner.request(),false);assert.equal(h.owner.flush(),false);h.frames.step();
  assert.equal(h.draws.length,0);assert.equal(h.frames.pending.length,0);
});
test('resume exits initial deferral and leaves animation to its original owner',()=>{
  const h=fixture();h.owner.request();h.state.paused=false;assert.equal(h.owner.sync(),false);assert.equal(h.owner.deferred,false);
  assert.equal(h.draws.length,0);assert.equal(h.frames.pending.length,0);
  h.state.paused=true;h.owner.request();h.frames.step();assert.equal(h.draws.length,1);h.owner.dispose();
});
test('omitted and false opt-in preserve the established request, sync, cancel and flush trace',()=>{
  function trace(h){
    const results=[];for(let i=0;i<3;i++){h.state.value=i;results.push(h.owner.request());}
    h.frames.step();h.state.available=false;results.push(h.owner.flush());h.state.available=true;
    h.owner.request();const stale=h.frames.ids[0];h.state.value='fresh';results.push(h.owner.flush());h.frames.late(stale);
    h.state.paused=false;results.push(h.owner.sync());h.state.paused=true;h.owner.request();results.push(h.owner.cancel());
    h.owner.dispose();results.push(h.owner.request(),h.owner.flush());
    return {results,draws:h.draws,cancelled:h.frames.cancelled,pending:h.frames.pending.length};
  }
  const expected={results:[true,true,true,false,true,false,true,false,false],draws:[{dt:0,value:2},{dt:0,value:'fresh'}],cancelled:[2,3],pending:0};
  assert.deepEqual(trace(fixture({})),expected);
  assert.deepEqual(trace(fixture({deferUntilFlush:false})),expected);
});
test('a nested flush cannot submit twice; render exceptions still allow a later retry',()=>{
  const frames=createTestFrames();let owner,draws=0,fail=true;
  owner=createMuseumPausedRedraw({deferUntilFlush:true,isPaused:()=>true,canRender:()=>true,requestFrame:f=>frames.request(f),cancelFrame:id=>frames.cancel(id),render(){
    draws++;assert.equal(owner.flush(),false);if(fail)throw new Error('real submission failure');return true;
  }});
  assert.throws(()=>owner.flush(),/real submission failure/);assert.equal(draws,1);fail=false;
  assert.equal(owner.flush(),true);assert.equal(draws,2);owner.dispose();
});
