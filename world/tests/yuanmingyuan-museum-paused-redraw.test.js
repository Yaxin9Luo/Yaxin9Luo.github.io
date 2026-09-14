import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMuseumPausedRedraw} from '../src/yuanmingyuan/museum-paused-redraw.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

// These exact scene functions/events are frozen so ROOT's later integration
// does not erase the independently executable before/after failure evidence.
const before=readFileSync(new URL('./fixtures/museum-paused-redraw-before.js',import.meta.url),'utf8');
const liveSource=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(before).digest('hex'),'fc2ac2aeab559008aa89f6269a0b2a3919e7030d9b8199eb05d52bcca8ce2356');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function frames(first=0){
  let serial=first;const pending=new Map(),all=new Map(),cancelled=[];
  return {request(callback){const id=serial++;pending.set(id,callback);all.set(id,callback);return id;},cancel(id){pending.delete(id);cancelled.push(id);},
    step(){const batch=[...pending.entries()];pending.clear();for(const [,callback] of batch)callback(16.67);},
    late(id){all.get(id)?.(33.34);},clear(){pending.clear();},get ids(){return [...pending.keys()];},get size(){return pending.size;},cancelled};
}
function currentUISnippets(){
  const parts=['const paused=','function changeCamera(','function frameVisitor(','function render(dt)','function start(','function setReviewPaused(','  controls=new OrbitControls(','document.addEventListener(\'visibilitychange\''].map(prefix=>{
    const found=liveSource.split('\n').filter(line=>line.startsWith(prefix));assert.equal(found.length,1,`actual current page ${prefix}`);return found[0];
  });
  for(const [start,end] of [["if(query.has('review')&&query.get('composition')!=='xianfaqiao')for(const [label,distance,height]","if(query.has('review')&&query.get('composition')!=='xianfaqiao')for(const [label,position,target]"],["$('capture').addEventListener('click',async()=>{",'\nfunction dispose()']]){
    const a=liveSource.indexOf(start),b=liveSource.indexOf(end,a);assert.ok(a>=0&&b>a);parts.push(liveSource.slice(a,b));
  }
  return parts.join('\n');
}
function harness({coalesced=false,encode,live=false}={}){
  // The page uses 0 for its inactive animation RAF. Keep the UI fixture's
  // scheduled handles distinct; the helper's ID-zero contract is tested below.
  const clock=frames(1),nodes=new Map(),submissions=[],uploads=[],messages=[];let reads=0,updates=0;
  const doc=new EventTarget(),canvas=new EventTarget();canvas.style={};canvas.ownerDocument=doc;canvas.getRootNode=()=>doc;
  const node=()=>({children:[],listeners:{},disabled:false,textContent:'',setAttribute(){},insertBefore(child){this.children.push(child);},addEventListener(type,callback){this.listeners[type]=callback;}});
  const camera=new THREE.PerspectiveCamera(45,1,.08,22000);camera.position.set(867,17,-636);camera.lookAt(879,13,-640);
  const environment={update:()=>({night:.5})},ctx={composition:null,westernPlanting:null,THREE,OrbitControls,camera,canvas,controls:null,query:new URLSearchParams('review=still'),
    disposed:false,ready:true,loading:false,capturing:false,contextLost:false,reviewPaused:true,reader:{isOpen:false},dialogs:[],
    document:{hidden:false,body:{dataset:{}},createElement:node,addEventListener:(...args)=>doc.addEventListener(...args)},keys:new Set(),touch:{clear(){}},guides:{setPaused(){}},audio:{update(){},setSuspended(){}},environment,clearKeys(){},
    state:{position:{x:879,y:4,z:-640},speed:0},currentSite:{id:'xianfashan',viewYaw:-Math.PI/2},cameraMode:0,plantingReview:{id:'old-view'},
    reviewFramesRemaining:0,reviewMotion:null,raf:0,last:0,time:0,serial:0,sourceTag:'small-actual-ui-fixture',controller:new AbortController(),Blob,Date,
    sites:{resource:null},residents:{get(){return null;},update(){updates++;},evaluate(){},snapshot:{full:[{id:'zhengjuesi',ready:true,bounds:{min:[434,4,695],max:[518,19,865]}}]}},
    renderer:{shadowMap:{needsUpdate:false},info:{reset(){}}},water:{update(){},reflectionViews:()=>[]},
    rendering:{render(dt){submissions.push({dt,camera:camera.position.toArray(),target:ctx.controls.target.toArray(),plantingReview:ctx.plantingReview});}},
    requestAnimationFrame:callback=>clock.request(callback),cancelAnimationFrame:id=>clock.cancel(id),tick(){},
    $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},syncControls(){},message:text=>messages.push(text),
    evidence:()=>({camera:camera.position.toArray(),target:ctx.controls.target?.toArray(),renderSubmissions:submissions.length}),
    readNativeFrame(){reads++;return {width:2,height:2,readback:'CPU submission witness, not GPU pixels',camera:[...submissions.at(-1).camera]};},
    encodeNativeFrame:encode??(async()=>new Blob(['CPU fixture'],{type:'image/png'})),fetch:async(url,{body})=>{uploads.push({url,body});return {ok:true};},
  };
  if(coalesced)ctx.redraw=createMuseumPausedRedraw({render:dt=>ctx.render(dt),isPaused:()=>ctx.paused(),canRender:()=>ctx.ready&&!ctx.disposed&&!ctx.contextLost&&!ctx.document.hidden,requestFrame:ctx.requestAnimationFrame,cancelFrame:ctx.cancelAnimationFrame});
  // Execute the exact old page, changing only the proposed repaint call sites.
  // The real scene function render(dt), control settings and camera math remain.
  let code=live?currentUISnippets():before;
  if(coalesced)code=code.replaceAll('render(0)','redraw.request()').replace('if(!redraw.request())throw new Error(\'The scene is not available','if(!redraw.flush())throw new Error(\'The scene is not available').replace('function start(){last=0;','function start(){redraw.sync();last=0;');
  vm.createContext(ctx);vm.runInContext(code+'\nthis.paused=paused;',ctx,{filename:coalesced?'candidate-scene-redraw-calls.js':'actual-before-scene-redraw-calls.js'});
  if(live)installSceneRedraw(ctx,liveSource,{frames:clock});
  return {ctx,clock,nodes,submissions,uploads,messages,documentEvents:doc,get reads(){return reads;},get updates(){return updates;},
    cameraButton:()=>ctx.changeCamera(),reviewButton:()=>nodes.get('review-tools').children[0].listeners.click(),capture:()=>nodes.get('capture').listeners.click(),
    dispose(){ctx.redraw?.dispose();ctx.controls.dispose();ctx.controller.abort();}};
}

test('actual paused page and real OrbitControls reproduce two camera submissions and three review submissions',t=>{
  const h=harness();t.after(()=>h.dispose());h.cameraButton();assert.equal(h.submissions.length,2);assert.equal(h.updates,2);assert.deepEqual(h.submissions[0],h.submissions[1]);
  h.submissions.length=0;const beforeUpdates=h.updates;h.reviewButton();assert.equal(h.submissions.length,3);assert.equal(h.updates-beforeUpdates,3);
  assert.notDeepEqual(h.submissions[0].camera,h.submissions[1].camera);assert.deepEqual(h.submissions[1],h.submissions[2]);assert.equal(h.clock.size,0);
});
test('the same actual camera math submits only its final view once after UI redraw calls are coalesced',t=>{
  const beforeHarness=harness(),h=harness({coalesced:true});t.after(()=>{h.dispose();beforeHarness.dispose();});
  beforeHarness.cameraButton();h.cameraButton();assert.equal(h.submissions.length,0);assert.equal(h.clock.size,1);h.clock.step();assert.equal(h.submissions.length,1);assert.deepEqual(h.submissions[0],beforeHarness.submissions.at(-1));
  beforeHarness.reviewButton();h.reviewButton();assert.equal(h.clock.size,1);assert.equal(h.submissions.length,1);h.clock.step();assert.equal(h.submissions.length,2);assert.deepEqual(h.submissions.at(-1),beforeHarness.submissions.at(-1));assert.equal(h.updates,2);
});
test('paused drag-like real OrbitControls updates redraw once each browser frame, without a trailing loop',t=>{
  const h=harness({coalesced:true});t.after(()=>h.dispose());
  for(let frame=0;frame<5;frame++){
    for(let event=0;event<9;event++){h.ctx.camera.position.x+=.1;h.ctx.controls.update();}
    assert.equal(h.clock.size,1);assert.equal(h.submissions.length,frame);h.clock.step();assert.equal(h.submissions.length,frame+1);assert.deepEqual(h.submissions.at(-1).camera,h.ctx.camera.position.toArray());assert.equal(h.clock.size,0);
  }
});
test('actual capture flushes the latest camera before readback and no cancelled callback redraws during async encoding',async t=>{
  const encode=deferred(),h=harness({coalesced:true,encode:()=>encode.promise});t.after(()=>h.dispose());h.reviewButton();const queued=h.clock.ids[0],expected=h.ctx.camera.position.toArray(),saving=h.capture();
  assert.equal(h.reads,1);assert.equal(h.submissions.length,1);assert.equal(h.clock.size,0);assert.deepEqual(h.submissions[0].camera,expected);
  h.clock.late(queued);assert.equal(h.submissions.length,1);encode.resolve(new Blob(['same-frame'],{type:'image/png'}));await saving;
  assert.equal(h.uploads.length,2);const data=JSON.parse(await h.uploads.find(p=>p.url.endsWith('.json')).body.text());assert.deepEqual(data.camera,expected);assert.equal(data.renderSubmissions,1);assert.equal(h.ctx.capturing,false);assert.equal(h.nodes.get('capture').disabled,false);
});
test('actual resume cancels a queued paused frame and leaves one existing animation RAF',t=>{
  const h=harness({coalesced:true});t.after(()=>h.dispose());h.reviewButton();const cancelled=h.clock.ids[0];h.ctx.setReviewPaused(false);
  assert.equal(h.ctx.redraw.pending,false);assert.equal(h.clock.size,1);assert.ok(!h.clock.ids.includes(cancelled));h.clock.late(cancelled);assert.equal(h.submissions.length,0);h.clock.step();assert.equal(h.submissions.length,0);
});
test('hidden, unready and context-lost owners cancel pending work; showing a paused owner can request its latest frame',()=>{
  for(const key of ['hidden','unready','contextLost']){
    const clock=frames(),state={hidden:false,unready:false,contextLost:false};let draws=0;
    const redraw=createMuseumPausedRedraw({render:()=>{draws++;return true;},isPaused:()=>true,canRender:()=>!Object.values(state).some(Boolean),requestFrame:clock.request,cancelFrame:clock.cancel});
    redraw.request();const old=clock.ids[0];state[key]=true;assert.equal(redraw.sync(),false);assert.equal(clock.size,0);assert.equal(redraw.flush(),false);clock.late(old);assert.equal(draws,0);
    state[key]=false;redraw.request();clock.step();assert.equal(draws,1);redraw.dispose();
  }
});
test('execution rechecks changing owner state even if the caller missed a lifecycle sync',()=>{
  for(const key of ['available','paused']){
    const clock=frames(),state={available:true,paused:true};let draws=0;const redraw=createMuseumPausedRedraw({render:()=>{draws++;return true;},isPaused:()=>state.paused,canRender:()=>state.available,requestFrame:clock.request,cancelFrame:clock.cancel});
    redraw.request();state[key]=false;clock.step();assert.equal(draws,0);assert.equal(redraw.pending,false);redraw.dispose();
  }
});
test('dispose rejects late callbacks, ID zero and subsequent requests without releasing borrowed resources',()=>{
  const clock=frames();let draws=0;const redraw=createMuseumPausedRedraw({render:()=>{draws++;return true;},isPaused:()=>true,canRender:()=>true,requestFrame:clock.request,cancelFrame:clock.cancel});
  redraw.request();assert.deepEqual(clock.ids,[0]);redraw.dispose();redraw.dispose();assert.deepEqual(clock.cancelled,[0]);clock.late(0);assert.equal(draws,0);assert.equal(redraw.request(),false);assert.equal(redraw.flush(),false);assert.equal(redraw.disposed,true);
});
test('flush forwards fresh-frame failure and invalidates old callback identities before a later successful request',()=>{
  const clock=frames();let available=true,succeeds=false,draws=0;const redraw=createMuseumPausedRedraw({render:()=>{draws++;return succeeds;},isPaused:()=>true,canRender:()=>available,requestFrame:clock.request,cancelFrame:clock.cancel});
  redraw.request();const old=clock.ids[0];assert.equal(redraw.flush(),false);assert.equal(draws,1);succeeds=true;redraw.request();clock.late(old);assert.equal(draws,1);assert.equal(clock.size,1);clock.step();assert.equal(draws,2);available=false;assert.equal(redraw.flush(),false);redraw.dispose();
});
test('actual native capture does not read or upload a stale frame after availability changes',async t=>{
  const h=harness({coalesced:true});t.after(()=>h.dispose());h.reviewButton();h.ctx.contextLost=true;await h.capture();
  assert.equal(h.submissions.length,0);assert.equal(h.reads,0);assert.equal(h.uploads.length,0);assert.equal(h.clock.size,0);assert.match(h.messages[0],/not available for a fresh native frame/);assert.equal(h.nodes.get('capture').disabled,false);
});
test('render or scheduler exceptions remain visible and do not permanently lock later redraws',()=>{
  const clock=frames();let failSchedule=true,failRender=true,draws=0;
  const redraw=createMuseumPausedRedraw({render:()=>{if(failRender)throw new Error('real render failure');draws++;return true;},isPaused:()=>true,canRender:()=>true,requestFrame:cb=>{if(failSchedule)throw new Error('RAF failure');return clock.request(cb);},cancelFrame:clock.cancel});
  assert.throws(()=>redraw.request(),/RAF failure/);assert.equal(redraw.pending,false);failSchedule=false;redraw.request();assert.throws(()=>clock.step(),/real render failure/);assert.equal(redraw.pending,false);
  failRender=false;assert.equal(redraw.flush(),true);assert.equal(draws,1);redraw.dispose();
});

test('current production camera handler and initializer defer one final frame and publish completed-frame telemetry',t=>{
  t.diagnostic('current museum-scene SHA256 '+createHash('sha256').update(liveSource).digest('hex'));
  const h=harness({live:true});t.after(()=>h.dispose());h.cameraButton();h.reviewButton();assert.equal(h.submissions.length,0);assert.equal(h.clock.size,1);
  const position=h.ctx.camera.position.toArray(),target=h.ctx.controls.target.toArray();h.clock.step();assert.equal(h.submissions.length,1);assert.deepEqual(h.submissions[0].camera,position);assert.deepEqual(h.submissions[0].target,target);
  const telemetry=JSON.parse(h.nodes.get('telemetry').textContent);assert.deepEqual(telemetry.camera,position);assert.deepEqual(telemetry.target,target);assert.equal(telemetry.renderSubmissions,1);assert.equal(h.clock.size,0);
});
test('current production canRender blocks loading and its real visibility listener cancels and restores one paused frame',t=>{
  const h=harness({live:true});t.after(()=>h.dispose());h.ctx.loading=true;h.reviewButton();assert.equal(h.submissions.length,0);assert.equal(h.clock.size,0);
  h.ctx.loading=false;h.ctx.redraw.request();const queued=h.clock.ids[0];h.ctx.document.hidden=true;h.documentEvents.dispatchEvent(new Event('visibilitychange'));assert.equal(h.clock.size,0);h.clock.late(queued);assert.equal(h.submissions.length,0);
  h.ctx.document.hidden=false;h.documentEvents.dispatchEvent(new Event('visibilitychange'));assert.equal(h.clock.size,1);h.clock.step();assert.equal(h.submissions.length,1);assert.equal(h.clock.size,0);
});
test('current production native capture flushes an actual pending control change before asynchronous encoding',async t=>{
  const encoding=deferred(),h=harness({live:true,encode:()=>encoding.promise});t.after(()=>h.dispose());h.reviewButton();const queued=h.clock.ids[0];assert.equal(h.submissions.length,0);
  const saving=h.capture();assert.equal(h.submissions.length,1);assert.equal(h.reads,1);assert.equal(h.clock.size,0);h.clock.late(queued);assert.equal(h.submissions.length,1);
  encoding.resolve(new Blob(['current-scene-fixture'],{type:'image/png'}));await saving;assert.equal(h.uploads.length,2);assert.equal(h.ctx.capturing,false);
});
