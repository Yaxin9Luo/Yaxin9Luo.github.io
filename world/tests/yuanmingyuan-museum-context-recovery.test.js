import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);}
const setup=section('function showGraphicsRecovery()','\nfunction setReviewPaused(');
const compositionCheck=section('function isJiuzhouComposition()', '\nfunction renderMap(');
const busy=section('function busy(','\nfunction setLanguage(');

test('context loss and restore retain an honest unavailable state with a visible reload action, even when a pending load finishes',t=>{
  const canvas=new EventTarget(),elements=new Map(),suspended=[];let reloads=0,syncs=0,renders=0;
  const ctx={query:new URLSearchParams(),composition:null,canvas,document:{body:{dataset:{ready:'true'}}},contextLost:false,disposed:false,ready:true,loading:false,raf:87,last:23,keys:new Set(['KeyW']),touch:{clear(){ctx.touchCleared=true;}},audio:{setSuspended:value=>suspended.push(value)},lang:'en',copy:{en:{graphicsLost:'Reload the scene or read exhibits.'}},
    $:id=>{if(!elements.has(id)){const el=new EventTarget();Object.assign(el,{hidden:true,textContent:''});elements.set(id,el);}return elements.get(id);},
    syncControls(){syncs++;},render(){renders++;return true;},evidence:()=>({status:ctx.document.body.dataset.ready,graphicsContextLost:ctx.contextLost}),location:{reload(){reloads++;}},
  };
  vm.createContext(ctx);vm.runInContext(compositionCheck+'\n'+busy+'\n'+setup,ctx);
  const drawing=installSceneRedraw(ctx,source);t.after(()=>drawing.dispose());ctx.redraw.request();const queued=drawing.frames.ids[0];assert.equal(renders,0);
  const lost=new Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented,true);assert.equal(ctx.contextLost,true);assert.equal(ctx.document.body.dataset.ready,'context-lost');assert.equal(ctx.raf,0);assert.deepEqual(drawing.frames.cancelled,[queued,87]);assert.equal(ctx.keys.size,0);assert.equal(ctx.touchCleared,true);assert.deepEqual(suspended,[true]);
  drawing.frames.late(queued);assert.equal(renders,0);assert.equal(drawing.frames.pending.length,0);
  assert.equal(elements.get('loading').hidden,false);assert.equal(elements.get('reload-scene').hidden,false);assert.match(elements.get('loading-copy').textContent,/read exhibits/);
  ctx.busy(false,'Done');assert.equal(ctx.loading,false);assert.equal(ctx.document.body.dataset.ready,'context-lost');assert.equal(elements.get('loading').hidden,false);
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(ctx.contextLost,true,'GPU-only environment targets cannot be certified by context restoration alone');assert.equal(ctx.document.body.dataset.ready,'context-lost');assert.equal(syncs,2);assert.equal(reloads,0);
  const evidence=JSON.parse(elements.get('telemetry').textContent);assert.equal(evidence.graphicsContextLost,true);assert.equal(evidence.status,'context-lost');
  elements.get('reload-scene').dispatchEvent(new Event('click'));assert.equal(reloads,1);
});
