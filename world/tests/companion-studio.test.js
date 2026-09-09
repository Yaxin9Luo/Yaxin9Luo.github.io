import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';

const source=await readFile(new URL('../src/companion-studio.js',import.meta.url),'utf8');

// Execute the complete production studio (including its real event handlers).
// Replace module imports with injected boundaries, retaining real Three scene,
// camera, geometry, materials and disposal events. No copied lifecycle logic.
async function studio(t){
  let now=1000,nextId=0,constructorFailure=false,startFailure=false;
  const timers=new Map(),frames=new Map(),windowEvents=new Map(),documentEvents=new Map();
  const streams=[],recorders=[],saves=[],revoked=[],actors=[],observers=[];
  const ids=['kind','action','pause','time','language','reduced','fur-visible','fur-receive-shadow','save-frame','record-clip','light','status','fur-diagnostics','time-value','readout'];
  const elements=new Map(ids.map(id=>[id,{id,disabled:true,value:'',checked:false,textContent:'',dataset:{},setAttribute(){},replaceChildren(){}}]));
  elements.get('record-clip').textContent='Record clip';elements.get('light').disabled=false;
  const viewButton={id:'front-view',dataset:{view:'front'},disabled:false,setAttribute(){}};
  const inputControls=ids.filter(id=>!['status','fur-diagnostics','time-value','readout'].includes(id)).map(id=>elements.get(id)).concat(viewButton);
  const canvas={clientWidth:734,clientHeight:576,width:1835,height:1440,captureStream(){
    const track={stops:0,stop(){this.stops++;}};
    const stream={getTracks:()=>[track],track};streams.push(stream);return stream;
  },toBlob(callback){callback(new Blob(['png'],{type:'image/png'}));}};
  const document={hidden:false,body:{dataset:{},append(){}},getElementById:id=>elements.get(id),
    querySelector:selector=>selector==='canvas'?canvas:{setAttribute(){}},
    querySelectorAll:selector=>selector==='[data-view]'?[viewButton]:inputControls,
    createElement:()=>({click(){},remove(){}}),addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  class Renderer{
    constructor(){this.shadowMap={};this.info={render:{triangles:1}};this.renders=0;this.disposals=0;this.pixelRatio=2.5;}
    render(){this.renders++;}setPixelRatio(value){this.pixelRatio=value;}getPixelRatio(){return this.pixelRatio;}
    setSize(){}dispose(){this.disposals++;}
  }
  class Controls{
    constructor(){this.target=new THREE.Vector3();this.enabled=true;this.disposals=0;}
    update(){}dispose(){this.disposals++;}
  }
  class Recorder{
    static isTypeSupported(){return true;}
    constructor(stream,options){
      if(constructorFailure)throw new Error('constructor rejected stream');
      this.state='inactive';this.mimeType=options.mimeType;this.videoBitsPerSecond=options.videoBitsPerSecond;
      this.starts=0;this.stops=0;recorders.push(this);
    }
    start(){this.starts++;if(startFailure)throw new Error('start rejected stream');this.state='recording';}
    stop(){this.stops++;this.state='inactive';this.pendingStop=this.onstop;}
    async deliverStop(){this.ondataavailable?.({data:new Blob(['video'])});await this.pendingStop?.();}
  }
  const window={addEventListener:(name,fn)=>windowEvents.set(name,fn)};
  const context={THREE:{...THREE,WebGLRenderer:Renderer},OrbitControls:Controls,window,document,location:{search:''},URLSearchParams,
    devicePixelRatio:2.5,matchMedia:()=>({matches:false}),performance:{now:()=>now},Blob,Date,MediaRecorder:Recorder,
    URL:{createObjectURL:()=>`blob:${++nextId}`,revokeObjectURL:url=>revoked.push(url)},
    fetch:async(path,options)=>{saves.push({path,blob:options.body});return {ok:context.captureService};},captureService:true,
    setTimeout:(callback,delay)=>{const id=++nextId;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),
    requestAnimationFrame:callback=>{const id=++nextId;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),
    ResizeObserver:class{constructor(callback){this.callback=callback;this.observing=false;observers.push(this);}observe(){this.observing=true;}disconnect(){this.observing=false;}},
    loadCompanionAssets:async()=>{},companionAssetDiagnostics:()=>({}),
    createCompanionActor:kind=>{
      const actor={kind,group:new THREE.Group(),model:new THREE.Group(),supportedActions:['idle','walk'],asset:{name:kind,phase:'ready',sha256:'test-asset',walk:{stride:.64,duration:1.2}},
        action:'idle',clip:'idle',time:0,duration:3,language:'zh',disposals:0,updates:[],
        setAction(name){this.action=name;this.clip=name;this.time=0;},seek(time){this.time=time;},setLanguage(lang){this.language=lang;},
        update(dt,options){this.updates.push({dt,...options});if(!options.paused)this.time+=dt;},dispose(){this.disposals++;this.group.removeFromParent();}};
      actors.push(actor);return actor;
    }};
  await runInNewContext(`(async()=>{${source.replace(/^import .*;\n/gm,'')}})()`,context,{filename:'companion-studio.js'});
  const api=window.__companionStudio,disposals=new Map();
  api.scene.traverse(object=>{
    const resources=[object.geometry,...(object.material?(Array.isArray(object.material)?object.material:[object.material]):[])].filter(Boolean);
    for(const resource of resources){disposals.set(resource,0);resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));}
  });
  t.after(()=>windowEvents.get('pagehide')?.({persisted:false}));
  return {api,document,elements,inputControls,streams,recorders,timers,frames,saves,revoked,actors,observers,disposals,context,
    setNow:value=>{now=value;},failConstructor:value=>{constructorFailure=value;},failStart:value=>{startFailure=value;},
    dispatch:(name,event)=>windowEvents.get(name)?.(event),
    visibility:hidden=>{document.hidden=hidden;documentEvents.get('visibilitychange')?.();},
    frame(time){now=time;const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now);}};
}

function controlSnapshot(f){return f.inputControls.map(node=>[node,node.disabled]);}
function assertRestored(f,before,enabled=true,label='Record clip'){
  for(const [node,disabled] of before)assert.equal(node.disabled,disabled,`${node.id} disabled state`);
  assert.equal(f.api.controls.enabled,enabled);assert.equal(f.elements.get('record-clip').textContent,label);
  assert.equal(f.timers.size,0,'recording timer released');
}

for(const failure of ['constructor','start'])test(`recording ${failure} failure releases the stream and permits a fresh attempt`,async t=>{
  const f=await studio(t);f.elements.get('light').disabled=true;f.api.controls.enabled=false;
  f.elements.get('record-clip').textContent='Capture clip';const before=controlSnapshot(f);
  const fail=failure==='constructor'?f.failConstructor:f.failStart;fail(true);
  await f.elements.get('record-clip').onclick();
  assert.match(f.elements.get('status').textContent,new RegExp(`${failure} rejected stream`));
  assert.equal(f.elements.get('status').dataset.error,'true');
  assert.equal(f.streams[0].track.stops,1,'failed capture track stopped');
  assertRestored(f,before,false,'Capture clip');
  fail(false);await f.api.recordClip();
  assert.equal(f.streams.length,2,'new recording obtained its own stream');assert.equal(f.recorders.at(-1).state,'recording');
  await f.api.recordClip();await f.recorders.at(-1).deliverStop();
  assertRestored(f,before,false,'Capture clip');assert.equal(f.streams[1].track.stops,1);
});

test('normal stop saves actual metadata and stale events cannot unlock a later recording',async t=>{
  const f=await studio(t),before=controlSnapshot(f);await f.api.recordClip();
  const recorder=f.recorders[0],staleStop=recorder.onstop,oldTimer=[...f.timers.values()][0].callback;
  assert.equal(f.api.controls.enabled,false);assert.equal(f.elements.get('action').disabled,true);
  f.setNow(2400);await f.api.recordClip();await recorder.deliverStop();assertRestored(f,before);
  assert.equal(f.streams[0].track.stops,1);assert.equal(f.saves.length,2);
  const metadata=JSON.parse(await f.saves[1].blob.text());assert.equal(metadata.actualDurationSeconds,1.4);
  assert.equal(metadata.requestedFrameRate,30);assert.equal(metadata.viewport.pixelWidth,1835);
  assert.equal(metadata.encoding.requestedVideoBitsPerSecond,15854400);
  await f.api.recordClip();oldTimer();await staleStop();
  assert.equal(f.recorders[1].state,'recording');assert.equal(f.api.controls.enabled,false);
  assert.equal(f.elements.get('action').disabled,true);assert.equal(f.saves.length,2,'old stop did not save twice');
});

test('asynchronous recorder error releases controls, stream and timer before retry',async t=>{
  const f=await studio(t),before=controlSnapshot(f);await f.api.recordClip();
  const recorder=f.recorders[0],lateStop=recorder.onstop;
  assert.equal(typeof recorder.onerror,'function');recorder.onerror({error:new Error('encoder failed')});
  assertRestored(f,before);assert.equal(f.streams[0].track.stops,1);
  assert.match(f.elements.get('status').textContent,/encoder failed/);assert.equal(f.saves.length,0);
  await f.api.recordClip();await lateStop();assert.equal(f.recorders[1].state,'recording');
  assert.equal(f.elements.get('action').disabled,true);assert.equal(f.streams[0].track.stops,1);
});

test('persisted pagehide suspends resources; pageshow resumes one frame loop without hidden elapsed time',async t=>{
  const f=await studio(t),actor=f.api.actor;f.frame(1100);assert.ok(Math.abs(actor.time-.1)<1e-8);
  f.api.setPaused(true);const actorTime=actor.time;f.dispatch('pagehide',{persisted:true});
  assert.equal(f.frames.size,0);assert.equal(f.observers[0].observing,false);
  assert.equal(actor.disposals,0);assert.equal(f.api.renderer.disposals,0);assert.equal(f.api.controls.disposals,0);
  assert.ok([...f.disposals.values()].every(count=>count===0));
  f.setNow(61000);f.dispatch('pageshow',{persisted:true});f.dispatch('pageshow',{persisted:true});
  assert.equal(f.api.actor,actor);assert.equal(f.frames.size,1);assert.equal(f.observers[0].observing,true);
  f.frame(61016);assert.equal(actor.time,actorTime);assert.equal(actor.updates.at(-1).paused,true);
  assert.ok(Math.abs(actor.updates.at(-1).dt-.016)<1e-8,'return frame excludes cached interval');
  f.api.setPaused(false);f.frame(61032);assert.ok(Math.abs(actor.time-actorTime-.016)<1e-8);
  f.dispatch('pagehide',{persisted:true});f.setNow(121000);f.dispatch('pageshow',{persisted:true});f.frame(121016);
  assert.equal(f.frames.size,1);assert.ok(Math.abs(actor.updates.at(-1).dt-.016)<1e-8);
});

test('persisted navigation cancels recording immediately and delayed callbacks leave a resumed capture alone',async t=>{
  const f=await studio(t),before=controlSnapshot(f);await f.api.recordClip();
  const recorder=f.recorders[0],lateStop=recorder.onstop;
  f.dispatch('pagehide',{persisted:true});assertRestored(f,before);assert.equal(f.streams[0].track.stops,1);
  assert.equal(recorder.state,'inactive');assert.equal(f.saves.length,0,'navigation cancellation does not download a partial clip');
  f.setNow(61000);f.dispatch('pageshow',{persisted:true});await f.api.recordClip();await lateStop();
  assert.equal(f.recorders[1].state,'recording');assert.equal(f.api.controls.enabled,false);assert.equal(f.saves.length,0);
});

test('permanent pagehide disposes once, releases downloads and never resumes',async t=>{
  const f=await studio(t);f.context.captureService=false;await f.api.saveFrame();
  assert.equal(f.timers.size,2);await f.api.recordClip();const lateStop=f.recorders[0].onstop;
  f.dispatch('pagehide',{persisted:false});f.dispatch('pagehide',{persisted:false});
  assert.equal(f.frames.size,0);assert.equal(f.observers[0].observing,false);assert.equal(f.timers.size,0);
  assert.equal(f.revoked.length,2);assert.equal(f.streams[0].track.stops,1);assert.equal(f.api.actor.disposals,1);
  assert.equal(f.api.renderer.disposals,1);assert.equal(f.api.controls.disposals,1);
  assert.ok([...f.disposals.values()].every(count=>count===1));
  f.dispatch('pageshow',{persisted:true});assert.equal(f.frames.size,0);await lateStop();
  assert.equal(f.saves.length,2,'teardown cannot save a late partial recording');
});
