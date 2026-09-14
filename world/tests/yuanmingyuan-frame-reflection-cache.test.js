import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameReflectionCache} from '../src/yuanmingyuan/frame-reflection-cache.js';

const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function key(){return {epoch:1,renderer:{},scene:{},camera:{id:'A'},near:.1,far:1000,layers:1,width:2048,height:2048,cameraWorld:identity(),cameraProjection:identity(),surfaceWorld:identity()};}

test('duplicate requests reuse the current target, without consulting nested render counters',()=>{
  const cache=createFrameReflectionCache(),view=key();let captures=0;
  const capture=()=>{captures++;view.renderer.info={render:{frame:1000+captures}};};
  assert.equal(cache.run(view,capture),true);
  for(let i=0;i<6;i++)assert.equal(cache.run(view,capture),false);
  assert.equal(captures,1);
});

for(const field of ['cameraWorld','cameraProjection','surfaceWorld'])test(`an in-place ${field} change invalidates the copied capture key`,()=>{
  const cache=createFrameReflectionCache(),view=key();let captures=0;
  const capture=()=>captures++;
  cache.run(view,capture);view[field][12]+=1e-10;
  assert.equal(cache.run(view,capture),true);assert.equal(captures,2);
});

test('one target cannot retain A after B overwrites it, including identical camera matrices',()=>{
  const cache=createFrameReflectionCache(),a=key(),b={...a,camera:{id:'B'}};const captures=[];
  for(const view of [a,b,a])assert.equal(cache.run(view,()=>captures.push(view.camera.id)),true);
  assert.deepEqual(captures,['A','B','A']);
});

test('a new epoch is a new capture even when time and matrices are unchanged',()=>{
  const cache=createFrameReflectionCache(),view=key();let captures=0;
  cache.run(view,()=>captures++);view.epoch++;
  assert.equal(cache.run(view,()=>captures++),true);assert.equal(captures,2);
});

test('failure invalidates both the pending view and any previous pixels; the old camera must retry',()=>{
  const cache=createFrameReflectionCache(),a=key(),b={...a,camera:{id:'B'}};let captures=0;
  cache.run(a,()=>captures++);
  assert.throws(()=>cache.run(b,()=>{throw new Error('partial target overwrite');}),/partial target overwrite/);
  assert.equal(cache.hasValue,false);
  assert.equal(cache.run(a,()=>captures++),true);assert.equal(captures,2);
  assert.throws(()=>cache.run(b,()=>{throw new Error('second failure');}),/second failure/);
  assert.equal(cache.run(b,()=>captures++),true);assert.equal(captures,3);
});

test('renderer, scene, clipping range, camera layers and target size cannot share stale pixels',()=>{
  for(const [field,value] of [['renderer',{}],['scene',{}],['near',.2],['far',2000],['layers',3],['width',1024],['height',1024]]){
    const cache=createFrameReflectionCache(),view=key();cache.run(view,()=>{});
    assert.equal(cache.run({...view,[field]:value},()=>{}),true,field);
  }
});

test('clear drops a committed view and force requests still perform the capture',()=>{
  const cache=createFrameReflectionCache(),view=key();let captures=0;
  cache.run(view,()=>captures++);cache.run(view,()=>captures++,{force:true});
  assert.equal(captures,2);cache.clear();assert.equal(cache.hasValue,false);
  assert.equal(cache.run(view,()=>captures++),true);assert.equal(captures,3);
});
