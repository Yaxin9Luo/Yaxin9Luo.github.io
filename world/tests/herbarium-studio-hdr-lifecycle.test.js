import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as policy from '../src/herbarium-normal-policy.js';

// Actual studio load/state/restore functions against tiny deferred I/O and DOM.
// No scene initialization, renderer, geometry, map allocation or decode is run.
const source=await readFile(new URL('../src/herbarium-studio.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function syncStudyReadiness(){'),source.indexOf('function shrubOptions(){'));
const selection=source.slice(source.indexOf('async function setKind(next){'),source.indexOf('\nfunction evidence(){'));
const startup=source.slice(source.indexOf('async function start(){'),source.lastIndexOf('\nawait start();'));
const lost=source.match(/canvas\.addEventListener\('webglcontextlost',event=>\{([\s\S]+?)\}\);\ncanvas\.addEventListener\('webglcontextrestored'/)[1];
const restored=source.match(/canvas\.addEventListener\('webglcontextrestored',\(\)=>\{([\s\S]+?)\n\}\);\nwindow\.__herbariumStudio/)[1];
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const candidate=()=>({name:'tiny authored candidate',userData:{community:true,actualBounds:{min:[0,0,0]}},traverse(){}});

function fixture({existing=false}={}){
  const physical=deferred(),plants=deferred(),nodes=new Map(),messages=[],old=existing?candidate():null;
  const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,checked:false,dataset:{},setAttribute(){}});return nodes.get(id);};
  for(const id of ['kind','load-selected','save-frame','scale','vine','variant','wireframe'])el(id);
  el('vine').value='legacy';
  const context={...policy,group:old,kind:'community',view:'threequarter',disposed:false,suspended:false,graphicsPaused:false,graphicsEpoch:0,normalSelection:{encoding:'astc-hdr'},normalRestoreFailure:null,assetReadyState:existing?'true':'loading',selectionToken:0,loadController:new AbortController(),captureControllers:new Set(),raf:1,
    renderer:{extensions:{has:()=>true,get:()=>({getSupportedProfiles:()=>context.profiles})},capabilities:{maxTextureSize:16384},shadowMap:{}},profiles:['hdr'],frames:0,normalCalls:0,
    document:{body:{dataset:{ready:existing?'true':'loading'}},querySelector:()=>el('aside'),querySelectorAll:()=>[...nodes.values()]},el,status:(...args)=>messages.push(args),
    factories:{community:candidate},sourceKinds:[],floor:{position:{}},scene:{add(){}},mannequin:{position:{set(){}}},disposeStudy(){},setView(){},
    loadHerbariumAssets:()=>physical.promise,loadHerbariumCommunityAssets:()=>{context.normalCalls++;return plants.promise;},shrubOptions:()=>({}),
    performance:{now:()=>0},setTimeout:callback=>queueMicrotask(callback),cancelAnimationFrame(){},requestAnimationFrame(){context.frames++;return 2;},frame(){},resize(){},
  };
  vm.runInNewContext(`${helpers}\n${selection}\n${startup}\nthis.api={setKind,start,lose(event){${lost}},restore(){${restored}}};`,context);
  return {context,physical,plants,nodes,messages,old,api:context.api,lose(){context.api.lose({preventDefault(){}});},restore(){context.api.restore();}};
}
async function pending(q){for(let i=0;i<30;i++){if(q.context.normalCalls)return;await Promise.resolve();}throw new Error('Tiny fixture did not enter deferred source load');}
function state(q,ready,disabled){assert.equal(q.context.document.body.dataset.ready,ready);assert.equal(q.nodes.get('save-frame').disabled,disabled);}

test('startup source success while graphics are lost stays paused, then restore enables Save from the latest ready outcome',async()=>{
  const q=fixture(),start=q.api.start();q.physical.resolve();await pending(q);q.lose();state(q,'graphics-paused',true);
  q.plants.resolve();await start;assert.equal(q.context.assetReadyState,'true');state(q,'graphics-paused',true);
  q.restore();state(q,'true',false);assert.equal(q.context.frames,1);assert.equal(q.context.renderer.shadowMap.needsUpdate,true);
});

test('restore before pending selection completion keeps Save disabled until that actual selection settles',async()=>{
  const q=fixture({existing:true}),selection=q.api.setKind('community');await pending(q);q.lose();q.restore();state(q,'loading',true);
  q.plants.resolve();await selection;state(q,'true',false);assert.notEqual(q.context.group,q.old);
});

test('startup failure during context loss preserves paused visibility and restores a failed retryable state',async()=>{
  const q=fixture(),start=q.api.start();q.lose();q.physical.reject(new Error('source unavailable'));await start;
  assert.equal(q.context.assetReadyState,'failed');state(q,'graphics-paused',true);
  q.restore();state(q,'failed',true);assert.equal(q.nodes.get('load-selected').disabled,false);assert.equal(q.context.group,null);
});

test('replacement failure during loss retains the previous valid specimen without overwriting the paused marker',async()=>{
  const q=fixture({existing:true}),selection=q.api.setKind('community'),rejected=assert.rejects(selection,/source unavailable/);await pending(q);q.lose();q.plants.reject(new Error('source unavailable'));await rejected;
  assert.equal(q.context.group,q.old);assert.equal(q.context.assetReadyState,'true');state(q,'graphics-paused',true);
  q.restore();state(q,'true',false);
});

test('incompatible restore stays terminal even if an older startup continuation later completes',async()=>{
  const q=fixture(),start=q.api.start();q.physical.resolve();await pending(q);q.lose();q.context.profiles=['ldr'];q.restore();state(q,'failed',true);assert.equal(q.context.loadController.signal.aborted,true);
  q.plants.resolve();await start;assert.equal(q.context.assetReadyState,'failed');state(q,'failed',true);assert.equal(q.context.group,null);assert.equal(q.context.frames,0);
  assert.ok([...q.nodes.values()].every(node=>node.disabled),'old startup success cannot re-enable controls after terminal restore failure');
});
