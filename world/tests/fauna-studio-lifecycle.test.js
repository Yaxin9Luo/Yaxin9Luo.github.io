import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import * as fauna from '../src/sky-fauna.js';
import * as geometry from '../src/fauna-studio-geometry.js';
import {sampleEnvironment,TIME_PHASES} from '../src/environment-time.js';

const source=(await readFile(new URL('../src/fauna-studio.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,'');
const html=await readFile(new URL('../fauna-studio.html',import.meta.url),'utf8');
function fixture(){
  let now=0;const elements=new Map(),listeners={},encoded=[],requests=[],recorders=[];
  for(const id of [...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]))elements.set(id,{value:({ground:'habitat',backdrop:'neutral',pose:'glide'})[id]||'',disabled:false,options:['glide','flight','upstroke','downstroke','bank'].map(value=>({value,disabled:false})),dataset:{},setAttribute(){},append(){}});
  const canvas={width:1835,height:1440,clientWidth:734,clientHeight:576,toBlob:fn=>encoded.push(fn),captureStream:()=>({getTracks:()=>[{stop(){}}]})};
  const document={hidden:false,body:{dataset:{}},getElementById:id=>elements.get(id),querySelector:()=>canvas,querySelectorAll:selector=>selector==='button,select,input'?[...elements.values()]:[],addEventListener:(type,fn)=>listeners[type]=fn,createElement:()=>({})};
  class Renderer{constructor(){this.capabilities={maxSamples:4};this.shadowMap={};this.info={render:{calls:0,triangles:0},reset:()=>{this.info.render={calls:0,triangles:0};}};}setPixelRatio(value){this.dpr=value;}getPixelRatio(){return this.dpr;}setSize(){}dispose(){}}
  class Composer{constructor(renderer){this.renderer=renderer;this.passes=[];}addPass(pass){this.passes.push(pass);}setPixelRatio(){}setSize(){}render(){for(const triangles of[100,20,1]){this.renderer.info.render.calls++;this.renderer.info.render.triangles+=triangles;}}dispose(){}}
  class Orbit{constructor(){this.target=new THREE.Vector3();}update(){}dispose(){}}
  class Recorder{static isTypeSupported(){return true;}constructor(_stream,options){this.mimeType=options.mimeType;this.state='inactive';recorders.push(this);}start(){this.state='recording';}stop(){this.state='inactive';}async finish(){this.ondataavailable({data:new Blob(['video'],{type:this.mimeType})});await this.onstop();}}
  const window={MediaRecorder:Recorder,addEventListener:(type,fn)=>listeners[type]=fn};
  const context={...fauna,...geometry,posedBounds:geometry.specimenBounds,THREE:{...THREE,WebGLRenderer:Renderer},sampleEnvironment,TIME_PHASES,EffectComposer:Composer,OrbitControls:Orbit,RenderPass:class{},UnrealBloomPass:class{},OutputPass:class{},document,window,MediaRecorder:Recorder,ResizeObserver:class{observe(){}disconnect(){}},location:{search:'?kind=swallow&pose=glide'},devicePixelRatio:2.5,performance:{now:()=>now},requestAnimationFrame:()=>1,cancelAnimationFrame(){},URLSearchParams,URL,Blob,AbortController,AbortSignal,Date,fetch:async(url,options)=>{requests.push({url,options});return{ok:true};}};
  const api=vm.runInNewContext(`(()=>{${source}\nreturn{...window.__faunaStudio,frame};})()`,context);return{api,elements,canvas,document,listeners,encoded,requests,recorders,tick(ms){now=ms;api.frame(ms);}};
}

test('studio starts with actual geometry and reports aggregate submission counts without final-pass leakage',()=>{
  const q=fixture();assert.equal(q.document.body.dataset.ready,'true');q.tick(100);let e=q.api.evidence();assert.ok(e.asset.triangles>1000);assert.equal(e.render.calls,3);assert.equal(e.render.triangles,121);q.tick(200);e=q.api.evidence();assert.equal(e.render.calls,3,'the next displayed frame starts a fresh aggregate');q.api.setKind('firefly');assert.equal(q.api.evidence().pose,'glide');
});

test('ground diagnostic moves the floor without changing depth testing or the model',()=>{
  const q=fixture();q.api.setKind('firefly');const asset=q.api.scene.children.find(o=>o.userData.kind==='firefly'),positions=asset.children[0].geometry.attributes.position.array.slice();
  q.elements.get('ground').value='near';q.api.setGround();const near=q.api.evidence();q.elements.get('ground').value='habitat';q.api.setGround();const habitat=q.api.evidence();assert.ok(Math.abs(near.ground.y-habitat.ground.y-.77)<1e-8);assert.equal(asset.userData.aura.material.depthTest,true);assert.deepEqual(asset.children[0].geometry.attributes.position.array,positions);q.elements.get('ground').value='off';q.api.setGround();assert.equal(q.api.evidence().ground.visible,false);
});

test('PNG metadata remains bound to the rendered pose during asynchronous encoding',async()=>{
  const q=fixture();q.api.setPose('upstroke',1.5);const saved=q.api.saveFrame();q.api.setKind('paper-lantern');q.encoded[0](new Blob(['png'],{type:'image/png'}));await saved;const meta=JSON.parse(await q.requests.find(r=>r.url.endsWith('.json')).options.body.text());assert.equal(meta.kind,'swallow');assert.equal(meta.pose,'upstroke');assert.equal(meta.activityTime,1.5);assert.equal(meta.render.calls,3);
});

test('ten second movie advances accepted time in a fixed camera and restores static inspection',async()=>{
  const q=fixture();q.api.record();const start=q.api.evidence(),camera=JSON.stringify(start.camera);for(let ms=100;ms<=10000;ms+=100){q.tick(ms);assert.equal(JSON.stringify(q.api.evidence().camera),camera);}await q.recorders[0].finish();const meta=JSON.parse(await q.requests.find(r=>r.url.endsWith('.json')).options.body.text());assert.equal(meta.valid,true);assert.ok(Math.abs(meta.end.activityTime-10)<1e-7);assert.equal(q.api.evidence().playing,false);assert.equal(q.api.evidence().pose,'glide');
});

test('a stalled or hidden movie cannot claim ten seconds of complete motion',async()=>{
  for(const interruption of['stall','hidden']){const q=fixture();q.api.record();q.tick(100);if(interruption==='stall')q.tick(1800);else{q.document.hidden=true;q.listeners.visibilitychange();}await q.recorders[0].finish();const meta=JSON.parse(await q.requests.find(r=>r.url.endsWith('.json')).options.body.text());assert.equal(meta.valid,false);assert.equal(meta.reason,interruption==='stall'?'frame-stall':'page-hidden');}
});
