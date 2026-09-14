import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewLoading} from '../src/review-loading.js';

function fixture(mode='staged'){
  let now=10,next=1;const frames=new Map(),timers=new Map(),listeners=new Map(),failures=[],abort=new AbortController();
  const game={_animation:0,_lastFrame:5,_tick(){},world:{complete:false},_enhancementController:new AbortController(),dispose(){this.disposed=true;}};
  frames.set(0,game._tick);
  const loading=createReviewLoading({mode,signal:abort.signal,canvas:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},now:()=>now,schedule:fn=>{const id=next++;frames.set(id,fn);return id;},cancel:id=>frames.delete(id),setTimer:fn=>{const id=next++;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id),onFailure:error=>failures.push(error)});
  return {loading,game,frames,timers,listeners,failures,abort,at:value=>{now=value;},core(){loading.progress({phase:'first-frame'});loading.attach(game);},begin(){loading.progress({phase:'enhancements-begin',deadline:900010});},ready(){game.world.complete=true;loading.progress({phase:'enhancements',enhancements:'ready'});}};
}
test('ordinary review does not cancel/schedule frames, install timers or add context listeners',()=>{
  const q=fixture('progressive');q.loading.attach(q.game);q.begin();q.ready();assert.equal(q.frames.size,1);assert.equal(q.timers.size,0);assert.equal(q.listeners.size,0);assert.equal(q.loading.completeFrame(true),true);q.loading.dispose();assert.equal(q.frames.size,1);
});
test('core is required and completion cannot be synthesized by enhancement progress or a late frame',()=>{
  const cold=fixture();cold.loading.attach(cold.game);assert.equal(cold.loading.failed,true);assert.equal(cold.frames.size,0);
  const q=fixture();q.core();q.begin();assert.equal(q.loading.completeFrame(true),false);q.ready();q.ready();assert.equal(q.frames.size,1);assert.equal(q.game._lastFrame,0);assert.equal(q.timers.size,1);
  q.at(900011);assert.equal(q.loading.completeFrame(true),false);assert.equal(q.frames.size,0);assert.equal(q.game._enhancementController.signal.aborted,true);
});
test('context loss, abort and late callbacks release timers/listeners and cannot resume rendering',()=>{
  const q=fixture();q.core();q.begin();q.listeners.get('webglcontextlost')();q.ready();assert.equal(q.frames.size,0);assert.equal(q.timers.size,0);assert.equal(q.failures.length,1);
  q.abort.abort();assert.equal(q.listeners.size,0);q.loading.progress({phase:'enhancements-begin',deadline:900010});q.ready();assert.equal(q.frames.size,0);
  const late=fixture();late.abort.abort();late.loading.attach(late.game);assert.equal(late.game.disposed,true);assert.equal(late.listeners.size,0);
});
test('successful full frame clears watchdog, duplicate completion never creates a second loop, and disposal cancels it',()=>{
  const q=fixture();q.core();q.begin();q.ready();assert.equal(q.loading.completeFrame(true),true);assert.equal(q.timers.size,0);q.ready();assert.equal(q.frames.size,1);q.loading.dispose();assert.equal(q.frames.size,0);assert.equal(q.listeners.size,0);
});
