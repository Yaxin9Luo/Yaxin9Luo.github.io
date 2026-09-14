import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const a=source.indexOf("$('capture').addEventListener('click',async()=>{"),b=source.indexOf('\nfunction dispose()',a);assert(a>=0&&b>a);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture({fresh=true,encode}={}){
  const nodes=new Map(),uploads=[],messages=[],diagnostics={triangles:731,nested:{state:'captured'}};let handler,reads=0,renders=0;
  const ctx={ready:true,capturing:false,disposed:false,serial:0,sourceTag:'fixture-source',currentSite:{id:'first-site'},raf:1,renderer:{},canvas:{},controller:new AbortController(),Blob,Date,
    document:{body:{dataset:{}}},keys:new Set(),touch:{clear(){}},syncControls(){},cancelAnimationFrame(){},start(){},message:text=>messages.push(text),render:()=>{renders++;return fresh;},
    evidence:()=>({site:ctx.currentSite.id,diagnostics}),readNativeFrame(){reads++;return {width:2,height:2,readback:'fixture readPixels'};},encodeNativeFrame:encode,
    $:id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,addEventListener(type,callback){handler=callback;}});return nodes.get(id);},
    fetch:async(url,{body})=>{uploads.push({url,body});return {ok:true};},
  };
  vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);const drawing=installSceneRedraw(ctx,source);return {ctx,nodes,uploads,messages,diagnostics,drawing,save:()=>handler(),get reads(){return reads;},get renders(){return renders;},dispose:()=>drawing.dispose()};
}

test('the actual main-page capture freezes the site name and nested JSON before asynchronous PNG encoding',async t=>{
  const gate=deferred(),f=fixture({encode:()=>gate.promise});t.after(()=>f.dispose());f.ctx.redraw.request();const queued=f.drawing.frames.ids[0];assert.equal(f.renders,0);const pending=f.save();
  assert.equal(f.renders,1,'Actual capture must synchronously flush the queued UI state');assert.equal(f.drawing.frames.pending.length,0);f.drawing.frames.late(queued);assert.equal(f.renders,1);
  assert.equal(f.reads,1);assert.equal(f.ctx.capturing,true);f.ctx.currentSite={id:'later-site'};f.diagnostics.triangles=999;f.diagnostics.nested.state='later';
  gate.resolve(new Blob(['frozen pixels'],{type:'image/png'}));await pending;
  assert.equal(f.uploads.length,2);assert(f.uploads.every(item=>item.url.includes('-first-site-')));
  const json=JSON.parse(await f.uploads.find(item=>item.url.endsWith('.json')).body.text());assert.equal(json.site,'first-site');assert.equal(json.diagnostics.triangles,731);assert.equal(json.diagnostics.nested.state,'captured');assert.equal(json.capture.width,2);
  assert.equal(f.ctx.capturing,false);assert.equal(f.nodes.get('capture').disabled,false);
});

test('an unavailable context never uploads an old frame and the capture control recovers',async t=>{
  const f=fixture({fresh:false,encode:()=>{throw new Error('No encoder should run');}});t.after(()=>f.dispose());await f.save();
  assert.equal(f.reads,0);assert.equal(f.uploads.length,0);assert.match(f.messages[0],/not available for a fresh native frame/);assert.equal(f.ctx.capturing,false);assert.equal(f.nodes.get('capture').disabled,false);
});
