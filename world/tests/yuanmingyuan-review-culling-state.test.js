import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {attachMuseumMultiDrawCulling} from '../src/yuanmingyuan/museum-multidraw-culling.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

// Exercise the actual page event and owner preparation with tiny real batches.
// This isolates changing scenes without constructing the complete museum.
const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
function owner(applied=true){
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),batch=new THREE.BatchedMesh(1,24,36,material);
  batch.sortObjects=false;batch.addInstance(batch.addGeometry(geometry));group.add(batch);
  let releases=0;return {group,batch,diagnostics:{multiDrawBatch:{applied}},dispose(){if(releases)return;releases++;batch.dispose();geometry.dispose();material.dispose();},get releases(){return releases;}};
}
function harness(){
  const elements=new Map(),created=[],messages=[];
  const make=()=>({value:'',disabled:false,children:[],listeners:{},setAttribute(){},append(node){this.children.push(node);},insertBefore(node){this.children.push(node);},addEventListener(event,callback){this.listeners[event]=callback;}});
  let rejectAttach=false;
  const ctx={query:new URLSearchParams('review=still&batch=2&cull=1&viewcache=8'),controller:new AbortController(),disposed:false,loading:false,sites:{resource:null},renderer:{},document:{createElement:make},
    $:id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);},
    createMuseumMultiDrawBatch:async resource=>resource,
    attachMuseumMultiDrawCulling:async(group,options)=>{if(rejectAttach)throw new Error('Preparation rejected');return attachMuseumMultiDrawCulling(group,{...options,yieldControl:async()=>{}});},
    setReviewPaused(){},render(){},evidence:()=>({}),message:m=>messages.push(m)};
  vm.createContext(ctx);
  vm.runInContext(source.match(/^let cullingMode=.*;$/m)[0]+'\n'+section('async function prepareMuseumRendering(','\nfunction busy(')+'\n'+section("  if(query.get('batch')==='2'){\n    const cullingSelect",'\n  const select=document.createElement')+'\nthis.prepare=prepareMuseumRendering;this.mode=()=>cullingMode;',ctx);
  const drawing=installSceneRedraw(ctx,source);
  const select=elements.get('review-tools').children[0];
  return {ctx,select,messages,async prepare(applied=true){const resource=owner(applied);created.push(resource);await ctx.prepare(resource,'fixture',ctx.controller.signal);ctx.sites.resource=resource;return resource;},async change(value){select.value=value;await select.listeners.change();},reject(value){rejectAttach=value;},dispose(){drawing.dispose();for(const resource of created)resource.dispose();}};
}

test('stock selection remains stock after leaving and preparing another actual batch',async t=>{
  const h=harness();t.after(()=>h.dispose());const first=await h.prepare();assert.ok(first.culling);
  await h.change('stock');assert.equal(first.batch.onBeforeRender,THREE.BatchedMesh.prototype.onBeforeRender);
  const second=await h.prepare();assert.equal(h.select.value,'stock');assert.equal(second.culling,undefined);assert.equal(second.batch.onBeforeRender,THREE.BatchedMesh.prototype.onBeforeRender);
  await h.change('3');const third=await h.prepare();assert.equal(h.ctx.mode(),'3');assert.ok(third.culling);assert.equal(third.culling.snapshot().viewCacheSize,3);
});
test('a selection on an unbatched building applies to the next batched building',async t=>{
  const h=harness();t.after(()=>h.dispose());await h.prepare(false);await h.change('stock');const next=await h.prepare();assert.equal(next.culling,undefined);assert.equal(h.ctx.mode(),'stock');
});
test('changing the control during loading does not mislabel the next owner',async t=>{
  const h=harness();t.after(()=>h.dispose());h.ctx.loading=true;await h.change('stock');assert.equal(h.select.value,'8');assert.equal(h.ctx.mode(),'8');h.ctx.loading=false;const next=await h.prepare();assert.ok(next.culling);
});
test('failed reattachment displays stock and subsequent owners use stock',async t=>{
  const h=harness();t.after(()=>h.dispose());const first=await h.prepare();h.reject(true);await h.change('3');assert.equal(first.culling,null);assert.equal(h.select.value,'stock');assert.equal(h.ctx.mode(),'stock');assert.equal(first.batch.onBeforeRender,THREE.BatchedMesh.prototype.onBeforeRender);h.reject(false);const next=await h.prepare();assert.equal(next.culling,undefined);assert.deepEqual(h.messages,['Preparation rejected']);
});
test('owner cleanup releases a replacement helper and source exactly once',async t=>{
  const h=harness();t.after(()=>h.dispose());const first=await h.prepare();await h.change('stock');await h.change('3');const helper=first.culling;first.dispose();first.dispose();assert.equal(first.releases,1);assert.equal(helper.snapshot().disposed,true);assert.equal(first.batch.onBeforeRender,THREE.BatchedMesh.prototype.onBeforeRender);
});
