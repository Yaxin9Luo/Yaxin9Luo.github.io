import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {studioAssets} from '../src/yuanmingyuan/studio-assets.js';
import * as hanjingViews from '../src/yuanmingyuan/hanjingtang-study-views.js';
import * as fuhaiViews from '../src/yuanmingyuan/fuhai-study-views.js';
import * as vegetationViews from '../src/yuanmingyuan/garden-vegetation-views.js';
import * as huanghuaViews from '../src/yuanmingyuan/huanghuazhen-views.js';
import * as yangqueViews from '../src/yuanmingyuan/yangquelong-views.js';
import {fitStudyShadow} from '../src/yuanmingyuan/shadow-framing.js';
import * as zhengjuesiViewsModule from '../src/yuanmingyuan/zhengjuesi-study-views.js';
import * as haiyueViewsModule from '../src/yuanmingyuan/haiyue-study-views.js';
import * as jiuzhouViewsModule from '../src/yuanmingyuan/jiuzhou-study-views.js';
import * as studyClipping from '../src/yuanmingyuan/study-clipping.js';
import * as xianfaViews from '../src/yuanmingyuan/xianfa-landscape-views.js';
import * as understoryViews from '../src/yuanmingyuan/garden-understory-study-views.js';
import * as stoneFishViews from '../src/yuanmingyuan/xieqiqu-stone-fish-views.js';
import * as shortneckBirdViews from '../src/yuanmingyuan/xieqiqu-swallow-shortneck-views.js';
import {copperSheepStudyViews} from '../src/yuanmingyuan/xieqiqu-copper-sheep.js';
import {readNativeFrame,encodeNativeFrame} from '../src/yuanmingyuan/native-frame-capture.js';
import * as pineViews from '../src/yuanmingyuan/spreading-pine-views.js';
import * as underwingViews from '../src/yuanmingyuan/xieqiqu-swallow-underwing-views.js';
import * as poolViews from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-views.js';
import * as poolR2Views from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r2-views.js';
import * as poolR3Views from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r3-views.js';
import * as poolR4Views from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-r4-views.js';
import {yangquelongGardenStudioEntry} from '../src/yuanmingyuan/yangquelong-garden-studio-entry.js';
import {yangquelongRefinedGardenStudioEntry} from '../src/yuanmingyuan/yangquelong-refined-garden-studio-entry.js';
import {gardenFramingPoints} from '../src/yuanmingyuan/yangquelong-garden-framing.js';

// Run the real studio module with only browser/GPU/network boundaries replaced.
// The asset fixture is a small, full-depth group; no production model is loaded.
class Element {
  constructor(id=''){this.id=id;this.dataset={};this.listeners=new Map();this.children=[];this.attributes={};this.disabled=false;this.checked=false;this.value='';this.textContent='';}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,event={}){return [...(this.listeners.get(type)||[])].map(fn=>fn({preventDefault(){},...event}));}
  setAttribute(name,value){this.attributes[name]=value;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  remove(){}
  click(){return this.emit('click');}
}

function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

async function studio(t,{search='',hidden=false,width=1294,height=900,responses=[],factoryGate=null,archiveGate=null,encodeGate=null,hideDuringEnvironment=false,environmentFailure=false,renderFailure=false,gardenFrameFailure=null}={}){
  const pending=new Map(),downloads=[],requests=[],serverFiles=new Map(),renders=[],environments=[],resources=[],temporary=[],loadedModules=[],builtAssets=[],navigations=[];
  const nativeReads=[],stagingCanvases=[],gardenFrames=[],refinedFrames=[];let gardenPrepares=0,refinedPrepares=0;
  let nextFrame=0,epoch=0,factoryCalls=0,reloads=0,frameClock=0,oldCanvasEncodes=0,readMode='ok';
  const ids=Object.fromEntries(['views','view-buttons','studio-asset','asset-title','model-viewport','sculpture','lighting','wireframe','animate-water','save-frame','status','readout','view-caption','capture-files'].map(id=>[id,new Element(id)]));
  const viewButtons=()=>ids['view-buttons'].children;
  const body=new Element(),aside=new Element(),canvas=new Element(),document=new Element(),window=new Element();
  Object.assign(canvas,{clientWidth:width,clientHeight:height,width:300,height:150,toBlob(callback){oldCanvasEncodes++;if(encodeGate)encodeGate.promise.then(()=>callback(new Blob(['stale browser canvas'],{type:'image/png'})));else queueMicrotask(()=>callback(new Blob(['stale browser canvas'],{type:'image/png'})));}});
  Object.assign(document,{hidden,body,getElementById:id=>ids[id],querySelector:selector=>selector==='canvas'?canvas:aside,querySelectorAll:selector=>selector==='[data-view]'?viewButtons():[ids.views,ids['studio-asset'],ids.sculpture,ids.lighting,ids.wireframe,ids['save-frame'],...viewButtons()],createElement:tag=>{
    const el=new Element();if(tag==='a')el.click=()=>downloads.push({name:el.download,url:el.href});
    if(tag==='canvas'){
      // Only browser PNG encoding is replaced. The real helper creates/copies
      // the full ImageData; compact fake output exposes its boundary pixels.
      stagingCanvases.push(el);let pixels;
      el.getContext=type=>{
        assert.equal(type,'2d');return {
          createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
          putImageData(image){pixels={width:el.width,height:el.height,top:[...image.data.subarray(0,4)],bottom:[...image.data.subarray((el.height-1)*el.width*4,(el.height-1)*el.width*4+4)]};},
        };
      };
      el.toBlob=callback=>{const done=()=>callback(new Blob([JSON.stringify(pixels)],{type:'image/png'}));if(encodeGate)encodeGate.promise.then(done);else queueMicrotask(done);};
    }
    return el;
  }});
  class Renderer {
    constructor(){this.pixelRatio=1;this.info={render:{triangles:12,calls:4},memory:{geometries:4,textures:1}};this.shadowMap={};this.glLost=false;this.rendererLost=false;this.disposed=false;resources.push(this);canvas.addEventListener('webglcontextlost',()=>{this.glLost=true;this.rendererLost=true;});canvas.addEventListener('webglcontextrestored',()=>{this.glLost=false;this.rendererLost=false;epoch++;});}
    setPixelRatio(value){this.pixelRatio=value;}
    getPixelRatio(){return this.pixelRatio;}
    setSize(w,h){canvas.width=Math.floor(w*this.pixelRatio);canvas.height=Math.floor(h*this.pixelRatio);}
    getRenderTarget(){return readMode==='offscreen'?{}:null;}
    getContext(){
      if(!this.captureContext){const packing=new Map([['PACK_ALIGNMENT',4],['PACK_ROW_LENGTH',0],['PACK_SKIP_PIXELS',0],['PACK_SKIP_ROWS',0]]);this.captureContext={...Object.fromEntries([...packing.keys(),'READ_FRAMEBUFFER_BINDING','RGBA','UNSIGNED_BYTE'].map(key=>[key,key])),NO_ERROR:0,isContextLost:()=>this.glLost,getParameter:key=>key==='READ_FRAMEBUFFER_BINDING'?null:packing.get(key),pixelStorei:(key,value)=>packing.set(key,value),getError:()=>readMode==='gl-error'?1282:0,readPixels(x,y,w,h,format,type,bytes){if(readMode==='read-failure')throw new Error('Fixture readPixels failure');assert.deepEqual([x,y,w,h,format,type],[0,0,canvas.width,canvas.height,'RGBA','UNSIGNED_BYTE']);const serial=renders.length;bytes.set([serial&255,0,44,255],0);bytes.set([serial&255,1,33,255],(h-1)*w*4);nativeReads.push({serial,width:w,height:h});}};}
      return this.captureContext;
    }
    render(scene,camera){if(this.rendererLost)return;if(renderFailure)throw new Error('native renderer failed');camera.updateMatrixWorld();renders.push({camera:camera.clone(),floorY:scene.children.find(o=>o.geometry?.type==='PlaneGeometry')?.position.y,environmentEpoch:scene.environment?.userData.epoch,environmentPopulated:scene.environment?.userData.populated,hidden:document.hidden,disposed:this.disposed,shadowDirty:this.shadowMap.needsUpdate});this.shadowMap.needsUpdate=false;}
    dispose(){this.disposed=true;}
  }
  let controls;
  class Controls extends THREE.EventDispatcher {
    constructor(camera){super();this.camera=camera;this.target=new THREE.Vector3();this.changes=0;this.enabled=true;controls=this;}
    update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld();if(this.changes-->0)this.dispatchEvent({type:'change'});}
    dispose(){this.disposed=true;}
  }
  class Room extends THREE.Scene {constructor(){super();temporary.push(this);}dispose(){this.disposed=true;}}
  class PMREM {
    constructor(renderer){this.renderer=renderer;temporary.push(this);}
    fromScene(){if(environmentFailure)throw new Error('environment generation failed');const target={texture:new THREE.Texture(),disposed:false,dispose(){this.disposed=true;}};target.texture.userData.epoch=epoch;target.texture.userData.populated=!this.renderer.rendererLost;environments.push({target,hidden:document.hidden,epoch});if(hideDuringEnvironment&&environments.length===1)document.hidden=true;return target;}
    dispose(){this.disposed=true;}
  }
  let asset;
  const createStudy=id=>{
    factoryCalls++;builtAssets.push(id);
    const group=new THREE.Group();group.name=id+'-study';
    if(id==='haiyantang'){
    for(const [name,size,position] of [
      ['west-hall',[60,30,20],[0,15,20]],['waterworks',[40,15,60],[0,7.5,-30]],
      ['west-stairs',[60,5,5],[0,2.5,32.5]],['zodiac-fountain',[40,3,30],[0,1.5,50]],
    ]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.set(...position);group.add(mesh);}
    for(const [index,id] of ['rat','ox','tiger','rabbit','dragon','snake','horse','goat','monkey','rooster','dog','pig','clam'].entries()){
      const figure=new THREE.Mesh(new THREE.BoxGeometry(id==='clam'?4:.8,2.4,1),new THREE.MeshStandardMaterial());figure.name=id==='clam'?'giant-clam':`zodiac-${id}`;figure.position.set(index-6,2.4,46);figure.rotation.y=id==='clam'?0:Math.PI/2;group.add(figure);
    }
    }else if(id==='yuanyingguan'){
      const part=(parent,name,size,position=[0,0,0])=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.set(...position);parent.add(mesh);return mesh;};
      const branch=(parent,name,position=[0,0,0],rotation=0)=>{const value=new THREE.Group();value.name=name;value.position.set(...position);value.rotation.y=rotation;parent.add(value);return value;};
      part(group,'measured-fountain-court',[110,1,60],[0,-.15,0]);
      const hall=branch(group,'yuanyingguan');
      part(hall,'yuanyingguan-complete-hall',[28,15,21],[0,10.5,-38.5]);part(hall,'yuanyingguan-five-roof-hypothesis',[30,5,23],[0,19,-38.5]);
      for(const x of [-2.02,2.02])part(hall,'south-central-column-'+x,[.7,8,1],[x,7,-27.5]);
      const fountain=branch(group,'dashuifa'),animals=branch(fountain,'dashuifa-eleven-animal-fountain');
      part(fountain,'dashuifa-sculpted-stone-niche',[20,13,5],[0,6.5,-22]);part(animals,'dashuifa-deer',[2,4,4],[0,2.4,-10]);
      for(let n=1;n<=10;n++){
        const name='dashuifa-hound-'+String(n).padStart(2,'0'),dog=branch(animals,name,[(n-5.5)*2,.3,-7],.45);
        part(dog,name+'-body',[1,1.8,3.3],[0,.9,0]);part(dog,name+'-open-mouth-spout',[.2,.2,.2],[0,1.4,1.65]);part(dog,name+'-water',[.04,.04,20],[0,1.4,12]);
      }
      const viewing=branch(group,'guanshuifa',[0,0,26],Math.PI);part(viewing,'guanshuifa-five-screen-backdrop',[20,5,1],[0,3,0]);
      for(const [side,sign] of [['west',1],['east',-1]]){const crane=branch(viewing,'guanshuifa-'+side+'-copper-crane',[sign*4.75,2.31,4.18],-sign*.4);part(crane,'crane-body-'+side,[1,2.4,1.6],[0,1.2,.2]);}
    }else if(id==='yangquelong-garden-r1'||id==='yangquelong-refined-garden-r3'){
      // Deliberately miniature data under the browser boundary. No complete
      // surface/pine factory or source-quality claim is made by this fixture.
      const court=new THREE.Mesh(new THREE.BoxGeometry(41,.2,48),new THREE.MeshStandardMaterial());court.position.set(1.5,-.1,0);group.add(court);
      const tower=new THREE.Mesh(new THREE.BoxGeometry(8,9.5,18),new THREE.MeshStandardMaterial());tower.position.y=4.75;group.add(tower);
      for(const [index,position]of [[-12.55,.02,-13],[-13.05,.02,13.2],[8.8,.02,-15.25],[8.3,.02,14.8]].entries()){
        const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1.3,1.2,1.1),new THREE.MeshStandardMaterial(),3);
        mesh.name=id==='yangquelong-refined-garden-r3'?['pine-west-north','pine-west-south','pine-east-north','pine-east-south'][index]:'miniature-tree-'+index;mesh.position.fromArray(position);
        for(let i=0;i<3;i++)mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation((i-1)*.6,.7+i*1.15,(i-1)*.3));
        mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
      }
      if(id==='yangquelong-refined-garden-r3'){
        for(const [name,size,position]of [['understorey-bed-west-south',[6.6,.5,13],[-12.8,.27,10.5]],['yangquelong-west-pool-south',[2.6,2.2,2.6],[-6.6,1,4.85]]]){
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.set(...position);group.add(mesh);
        }
      }
    }else{
      const config=studioAssets[id],names=new Set(Object.values(config.views).flatMap(spec=>[...spec.groups,...(spec.isolate||[])]));
      for(const [i,name] of [...names].entries()){const mesh=new THREE.Mesh(new THREE.BoxGeometry(8,10,6),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.set(i*2,5,i);group.add(mesh);}
    }
    const hidden=new THREE.Object3D();hidden.name='authored-hidden-part';hidden.visible=false;group.add(hidden);
    asset={group,diagnostics:{provisionalScale:'fixture'},lastUpdateTime:0,update(time){this.lastUpdateTime=time;},disposed:false,dispose(){this.disposed=true;group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.clear();}};
    return asset;
  };
  class BrowserURL extends URL{static createObjectURL(){return `blob:studio-${downloads.length}-${Math.random()}`;}static revokeObjectURL(){}}
  const scope={THREE:{...THREE,WebGLRenderer:Renderer,PMREMGenerator:PMREM},OrbitControls:Controls,RoomEnvironment:Room,document,window,location:{search,href:'http://127.0.0.1:5173/yuanmingyuan-studio.html'+search,reload(){reloads++;},assign(url){navigations.push({url,disposed:asset?.disposed??true,pending:pending.size});}},devicePixelRatio:2,URLSearchParams,Blob,AbortController,DOMException,Error,console,setTimeout,clearTimeout,queueMicrotask,URL:BrowserURL,ResizeObserver:class{observe(){}disconnect(){this.disconnected=true;}},requestAnimationFrame:fn=>{pending.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>pending.delete(id),loadFactory:async spec=>{loadedModules.push(spec);if(factoryGate)await factoryGate.promise;return {createHaiyantangStudy:()=>createStudy('haiyantang'),createYuanyingguanStudy:()=>createStudy('yuanyingguan'),createXieqiquStudy:()=>createStudy('xieqiqu'),createFangwaiguanStudy:()=>createStudy('fangwaiguan')};},fetch:async(url,options)=>{requests.push({url,options});if(options.signal.aborted)throw options.signal.reason;const response=responses.length?responses.shift():200;if(response instanceof Error)throw response;if(response===200)serverFiles.set(url,options.body);return new Response(null,{status:response});}};
  const config=await readFile(new URL('../src/yuanmingyuan/studio-assets.js',import.meta.url),'utf8');
  Object.assign(scope,{fitStudyShadow,readNativeFrame,encodeNativeFrame:frame=>encodeNativeFrame(frame,document),copperSheepStudyViews},hanjingViews,fuhaiViews,vegetationViews,huanghuaViews,yangqueViews,xianfaViews,zhengjuesiViewsModule,haiyueViewsModule,jiuzhouViewsModule,studyClipping,understoryViews,stoneFishViews,shortneckBirdViews,pineViews,underwingViews,poolViews,poolR2Views,poolR3Views,poolR4Views);
  scope.yangquelongGardenStudioEntry={...yangquelongGardenStudioEntry,
    frameView(options){
      assert.equal(options.controls.enableDamping,false,'studio calls the hook while damping is disabled');
      if(gardenFrameFailure)throw gardenFrameFailure;
      const fit=yangquelongGardenStudioEntry.frameView(options);
      gardenFrames.push({fit,spec:options.spec,group:options.group});return fit;
    },
    async loadFactory({signal}={}){
      // The entry's real ESM loadFactory closes over real production imports,
      // so string replacement inside the VM cannot stub it. Replace only this
      // asynchronous preparation boundary and retain the real frameView/views.
      gardenPrepares++;signal?.throwIfAborted();if(factoryGate)await factoryGate.promise;signal?.throwIfAborted();
      let consumed=false;return()=>{assert.equal(consumed,false);consumed=true;return createStudy('yangquelong-garden-r1');};
    },
  };
  scope.yangquelongRefinedGardenStudioEntry={...yangquelongRefinedGardenStudioEntry,
    frameView(options){
      assert.equal(options.controls.enableDamping,false);
      const fit=yangquelongRefinedGardenStudioEntry.frameView(options);refinedFrames.push({fit,spec:options.spec});return fit;
    },
    async loadFactory({signal}={}){
      // Keep the real entry/views; replace only the async model preparation boundary.
      refinedPrepares++;signal?.throwIfAborted();if(factoryGate)await factoryGate.promise;signal?.throwIfAborted();
      let consumed=false;return()=>{assert.equal(consumed,false);consumed=true;return createStudy('yangquelong-refined-garden-r3');};
    },
  };
  const postpasses=[];scope.createRendering=(renderer,scene,camera,options)=>{const pass={options,sizes:[],quality:null,disposed:false,render(){renderer.render(scene,camera);},setQuality(value){this.quality=value;},resize(...size){this.sizes.push(size);},dispose(){this.disposed=true;}};renderer.info.reset=()=>{};postpasses.push(pass);return pass;};
  scope.museumArchiveCatalog={};
  scope.loadMuseumArchive=async(id,url,{signal})=>{const resource=createStudy(id);resource.archive={id,sourceDigest:'fixture-source'};if(archiveGate)await archiveGate.promise;return resource;};
  const source=(config.replace(/^export /gm,'')+'\n'+await readFile(new URL('../src/yuanmingyuan/studio.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/\bimport\((['"])(\.\/[^'"]+)\1\)/g,'loadFactory("$2")').replace(/await start\(\);\s*$/,'void start();');
  vm.runInNewContext(source,scope,{filename:'studio.js'});
  t.after(()=>window.emit('pagehide'));
  const api={ids,get views(){return viewButtons();},loadedModules,builtAssets,navigations,body,canvas,document,window,pending,downloads,requests,serverFiles,renders,environments,resources,temporary,get controls(){return controls;},get asset(){return asset;},get factoryCalls(){return factoryCalls;},get reloads(){return reloads;},async frame(elapsed=16){frameClock+=elapsed;for(const [id,fn] of [...pending]){pending.delete(id);fn(frameClock);}await flush();},async ready(){await flush();for(let i=0;i<5&&body.dataset.ready!=='true';i++)await this.frame();assert.equal(body.dataset.ready,'true');},async click(id){await Promise.all(ids[id].click());},async view(name){const button=viewButtons().find(el=>el.dataset.view===name);assert.ok(button,'view is exposed: '+name);button.click();await this.frame();},async visibility(value){document.hidden=value;document.emit('visibilitychange');await flush();},async nativeRestore(){
    // Native GL loss clears before dispatch; renderer-private loss clears in its listener.
    for(const resource of resources)resource.glLost=false;
    for(const listener of [...canvas.listeners.get('webglcontextrestored')]){listener({});await Promise.resolve();}
    await flush();
  }};
  Object.defineProperty(api,'gardenPrepares',{get:()=>gardenPrepares});
  Object.defineProperty(api,'refinedPrepares',{get:()=>refinedPrepares});api.refinedFrames=refinedFrames;
  Object.assign(api,{gardenFrames,postpasses,nativeReads,stagingCanvases,setReadMode:mode=>{readMode=mode;},getOldCanvasEncodes:()=>oldCanvasEncodes});await flush();return api;
}

function assertFits(box,camera){
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const p=new THREE.Vector3(x,y,z).project(camera);
    assert.ok(Math.abs(p.x)<=1.00001&&Math.abs(p.y)<=1.00001&&Math.abs(p.z)<=1,`corner falls outside the frame: ${p.toArray()}`);
  }
}

test('world render review preserves native DPR, bounds and disposes the postprocessing owner',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan&render=world'});await h.ready();
  assert.equal(h.postpasses.length,1);const post=h.postpasses[0];assert.equal(post.quality,'high');
  assert.deepEqual(post.sizes.at(-1),[1294,900,2]);assert.ok(post.options.clipBox.containsBox(new THREE.Box3().setFromObject(h.asset.group)));
  await h.click('save-frame');const metadata=JSON.parse(await [...h.serverFiles.entries()].find(([path])=>path.endsWith('.json'))[1].text());assert.equal(metadata.renderPipeline,'museum-GTAO-HDR-MSAA');
  h.window.emit('pagehide');assert.equal(post.disposed,true);
});

test('orbit damping keeps exactly one pending frame, and visibility cancels it',async t=>{
  const h=await studio(t);await h.ready();h.controls.changes=8;h.controls.dispatchEvent({type:'change'});
  for(let i=0;i<5;i++){await h.frame();assert.equal(h.pending.size,1,'one RAF owner even when update emits change');}
  await h.visibility(true);assert.equal(h.pending.size,0);const count=h.renders.length;await h.frame();assert.equal(h.renders.length,count);
});

test('side preset names follow the geographic axes',async t=>{
  const h=await studio(t);await h.ready();await h.view('north');assert.ok(h.renders.at(-1).camera.position.x<0);await h.view('south');assert.ok(h.renders.at(-1).camera.position.x>0);
});

test('side and aerial presets fit full depth in a portrait viewport',async t=>{
  const h=await studio(t,{width:390,height:700});await h.ready();const bounds=new THREE.Box3().setFromObject(h.asset.group);
  for(const view of ['north','south','aerial','threequarter']){await h.view(view);assertFits(bounds,h.renders.at(-1).camera);}
});

test('resize refits a preset and preserves a deliberately orbited camera',async t=>{
  const h=await studio(t,{width:1400,height:700});await h.ready();await h.view('front');
  h.canvas.clientWidth=350;h.window.emit('resize');await h.frame();
  const front=new THREE.Box3();for(const name of ['west-hall','west-stairs','zodiac-fountain'])front.union(new THREE.Box3().setFromObject(h.asset.group.getObjectByName(name)));
  assert.equal(h.renders.at(-1).camera.aspect,.5);assertFits(front,h.renders.at(-1).camera);
  h.controls.dispatchEvent({type:'start'});h.controls.camera.position.set(10,20,80);h.controls.target.set(3,4,5);h.controls.dispatchEvent({type:'change'});await h.frame();
  h.canvas.clientWidth=700;h.window.emit('resize');await h.frame();assert.deepEqual(h.renders.at(-1).camera.position.toArray(),[10,20,80]);assert.deepEqual(h.controls.target.toArray(),[3,4,5]);
});

test('a module resolving in an initially hidden document performs no GPU work until shown',async t=>{
  const h=await studio(t,{hidden:true});assert.equal(h.environments.length,0);assert.equal(h.renders.length,0);assert.equal(h.factoryCalls,0);
  await h.visibility(false);await h.ready();assert.ok(h.environments.every(x=>!x.hidden));
});

test('context recovery rebuilds the environment after renderer restoration and waits for a frame',async t=>{
  const h=await studio(t);await h.ready();const old=h.environments[0].target;
  h.canvas.emit('webglcontextlost');assert.notEqual(h.body.dataset.ready,'true');assert.equal(h.pending.size,0);
  h.canvas.emit('webglcontextrestored');assert.notEqual(h.body.dataset.ready,'true');await flush();assert.notEqual(h.body.dataset.ready,'true');
  await h.ready();assert.equal(h.environments.length,2);assert.ok(old.disposed);assert.equal(h.renders.at(-1).environmentEpoch,1);assert.equal(h.body.dataset.ready,'true');
});

test('restoring a context while hidden defers environment rendering until visible',async t=>{
  const h=await studio(t);await h.ready();await h.visibility(true);h.canvas.emit('webglcontextlost');h.canvas.emit('webglcontextrestored');await flush();
  assert.equal(h.environments.length,1);await h.visibility(false);await h.frame();assert.equal(h.environments.length,2);assert.ok(h.environments.every(x=>!x.hidden));
});

test('pagehide prevents late factory startup and BFCache return requests full reinitialization',async t=>{
  const gate=deferred(),h=await studio(t,{factoryGate:gate});h.window.emit('pagehide');gate.resolve();await flush();await h.frame();
  assert.equal(h.factoryCalls,0);assert.equal(h.resources.length,0);assert.equal(h.renders.length,0);h.window.emit('pageshow',{persisted:true});assert.equal(h.reloads,1);
});

test('capture fallback keeps PNG and JSON together when the endpoint recovers between files',async t=>{
  const h=await studio(t,{responses:[new TypeError('network unavailable'),200]});await h.ready();await h.click('save-frame');
  assert.equal(h.requests.length,1,'a fallback decision applies to the whole pair');assert.equal(h.downloads.length,2);assert.ok(h.downloads.some(x=>x.name.endsWith('.png')));assert.ok(h.downloads.some(x=>x.name.endsWith('.json')));
});

test('a metadata upload failure downloads a complete pair and discloses the partial server copy',async t=>{
  const h=await studio(t,{responses:[200,new TypeError('network unavailable')]});await h.ready();await h.click('save-frame');
  assert.equal(h.downloads.length,2);assert.equal(h.serverFiles.size,1);assert.match(h.ids.status.textContent,/服务器.*部分/);
});

test('a duplicate evidence name does not overwrite or silently fall back',async t=>{
  const h=await studio(t,{responses:[409]});await h.ready();await h.click('save-frame');assert.equal(h.downloads.length,0);assert.equal(h.serverFiles.size,0);assert.equal(h.ids.status.dataset.error,'true');
});

test('a capture interrupted during encoding cannot upload after hide and resume',async t=>{
  const gate=deferred(),h=await studio(t,{encodeGate:gate});await h.ready();const saving=h.click('save-frame');await h.visibility(true);await h.visibility(false);gate.resolve();await saving;
  assert.equal(h.requests.length,0);assert.equal(h.downloads.length,0);
});

test('successful UI capture stores a matching native frame and diagnostic sidecar',async t=>{
  const h=await studio(t);await h.ready();await h.view('north');await h.click('save-frame');assert.equal(h.serverFiles.size,2);const entries=[...h.serverFiles];
  const png=entries.find(([name])=>name.endsWith('.png')),json=entries.find(([name])=>name.endsWith('.json'));assert.equal(png[0].slice(0,-4),json[0].slice(0,-5));
  const metadata=JSON.parse(await json[1].text());assert.equal(metadata.view,'north');assert.equal(metadata.native.width,2588);assert.equal(metadata.native.height,1800);assert.equal(metadata.native.pixelRatio,2);assert.ok(metadata.camera[0]<0);
});

test('GPU readback binds current rendered pixels and immutable evidence before async encoding, for factory/archive and direct/post views',async t=>{
  for(const route of ['', '&archive=/assets/verified/manifest.json'])for(const pipeline of ['', '&render=world']){
    const gate=deferred(),h=await studio(t,{search:'?asset=haiyantang&source=readback-fixture'+route+pipeline,width:8,height:6,encodeGate:gate});await h.ready();await h.view('north');
    h.asset.diagnostics.live={value:'captured'};const savedCamera=h.controls.camera.position.toArray(),saving=h.click('save-frame');
    try{
      assert.equal(h.nativeReads.length,1,'the save render must synchronously read current GPU bytes');const read=h.nativeReads[0];assert.equal(h.getOldCanvasEncodes(),0);
      h.asset.diagnostics.live.value='later';if(h.asset.archive)h.asset.archive.sourceDigest='later-source';
      h.ids.lighting.value='night';h.ids.lighting.emit('change');await h.view('front');h.canvas.clientWidth=10;h.canvas.clientHeight=7;h.window.emit('resize');await h.frame();
      assert.ok(h.renders.length>read.serial);gate.resolve();await saving;
      const entries=[...h.serverFiles],png=entries.find(([path])=>path.endsWith('.png')),json=entries.find(([path])=>path.endsWith('.json'));
      const image=JSON.parse(await png[1].text()),metadata=JSON.parse(await json[1].text());assert.deepEqual(image,{width:16,height:12,top:[read.serial&255,1,33,255],bottom:[read.serial&255,0,44,255]});
      assert.equal(metadata.renderSerial,read.serial);assert.deepEqual(metadata.capture,{readback:'WebGL default framebuffer RGBA8; synchronous readPixels',width:16,height:12,renderSerial:read.serial});
      assert.equal(metadata.view,'north');assert.equal(metadata.lighting,'day');assert.deepEqual(metadata.camera,savedCamera);assert.equal(metadata.assetData.live.value,'captured');assert.equal(metadata.native.width,16);assert.equal(metadata.native.height,12);
      assert.equal(metadata.assetSource,route?'archive':'factory');if(route)assert.equal(metadata.archive.sourceDigest,'fixture-source');assert.equal(metadata.renderPipeline,pipeline?'museum-GTAO-HDR-MSAA':'direct-PBR');
      assert.match(png[0],/yuanmingyuan-haiyantang-readback-fixture-north-day-/);assert.equal(png[0].slice(0,-4),json[0].slice(0,-5));assert.ok(h.stagingCanvases.every(el=>el.width===0&&el.height===0),'encoder releases each owned staging canvas');
    }finally{gate.resolve();await saving;}
  }
});

test('GPU readback failures save no mismatched pair and permit a fresh retry',async t=>{
  for(const mode of ['read-failure','gl-error','offscreen']){
    const h=await studio(t,{width:8,height:6});await h.ready();h.setReadMode(mode);await h.click('save-frame');
    assert.equal(h.requests.length,0);assert.equal(h.downloads.length,0);assert.equal(h.stagingCanvases.length,0);assert.equal(h.ids.status.dataset.error,'true');assert.equal(h.ids['save-frame'].disabled,false);
    h.setReadMode('ok');await h.click('save-frame');assert.equal(h.serverFiles.size,2);assert.equal(h.getOldCanvasEncodes(),0);
  }
});

test('orbit-only frames reuse shadows while light and wireframe changes refresh them',async t=>{
  const h=await studio(t);await h.ready();assert.equal(h.resources[0].shadowMap.autoUpdate,false);assert.equal(h.renders.at(-1).shadowDirty,true);
  await h.view('north');assert.equal(h.renders.at(-1).shadowDirty,false);
  h.ids.lighting.value='night';h.ids.lighting.emit('change');await h.frame();assert.equal(h.renders.at(-1).shadowDirty,true);await h.frame();assert.equal(h.renders.at(-1).shadowDirty,false);
  h.ids.wireframe.checked=true;h.ids.wireframe.emit('change');await h.frame();assert.equal(h.renders.at(-1).shadowDirty,true);
});

test('visibility changing during environment work does not invent a lost context',async t=>{
  const h=await studio(t,{hideDuringEnvironment:true});await h.frame();assert.equal(h.renders.length,0);assert.ok(h.environments[0].target.disposed);
  await h.visibility(false);await h.ready();assert.equal(h.renders.at(-1).environmentEpoch,0);
});

test('environment startup failure releases temporary and owned resources without readiness',async t=>{
  const h=await studio(t,{environmentFailure:true});await h.frame();assert.equal(h.body.dataset.ready,'failed');assert.ok(h.temporary.every(resource=>resource.disposed));assert.ok(h.resources.every(resource=>resource.disposed));assert.ok(h.asset.disposed);assert.equal(h.pending.size,0);
});

test('a failed native frame never enables capture or retains an active render loop',async t=>{
  const h=await studio(t,{renderFailure:true});await h.frame();await h.frame();assert.equal(h.body.dataset.ready,'failed');assert.equal(h.ids['save-frame'].disabled,true);assert.equal(h.pending.size,0);assert.ok(h.environments.every(item=>item.target.disposed));
});

test('native listener checkpoints cannot rebuild PMREM before renderer-private restoration',async t=>{
  const h=await studio(t);await h.ready();h.canvas.emit('webglcontextlost');await h.nativeRestore();
  await h.ready();assert.ok(h.renders.at(-1).environmentPopulated,'a real restored environment must precede readiness');assert.equal(h.renders.at(-1).environmentEpoch,1);
});

test('leaving after a restoration event cancels its queued environment rebuild',async t=>{
  const h=await studio(t);await h.ready();h.canvas.emit('webglcontextlost');await h.nativeRestore();assert.equal(h.environments.length,1,'recovery belongs to a later cancellable frame');
  h.window.emit('pagehide');assert.equal(h.pending.size,0);await h.frame();assert.equal(h.environments.length,1);
});

test('visible sculpture selection frames each named figure from its facing side and the clam',async t=>{
  const h=await studio(t,{width:390,height:700});await h.ready();
  for(const id of ['rat','ox','tiger','rabbit','dragon','snake','horse','goat','monkey','rooster','dog','pig','clam']){
    h.ids.sculpture.value=id;h.ids.sculpture.emit('change');await h.frame();
    const object=h.asset.group.getObjectByName(id==='clam'?'giant-clam':`zodiac-${id}`),box=new THREE.Box3().setFromObject(object),center=box.getCenter(new THREE.Vector3());
    assert.ok(h.controls.target.distanceTo(center)<1e-8,'selected sculpture, not the whole fountain');assertFits(box,h.renders.at(-1).camera);
    const facing=new THREE.Vector3(0,0,1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));assert.ok(h.controls.camera.position.clone().sub(center).dot(facing)>0);
  }
  h.canvas.clientWidth=700;h.window.emit('resize');await h.frame();assertFits(new THREE.Box3().setFromObject(h.asset.group.getObjectByName('giant-clam')),h.renders.at(-1).camera);
  await h.view('front');assert.equal(h.ids.sculpture.value,'');assert.equal(h.views.length,10);
});

test('sculpture captures carry the selected group identity in filename and diagnostics',async t=>{
  const h=await studio(t);await h.ready();h.ids.sculpture.value='rat';h.ids.sculpture.emit('change');await h.frame();await h.click('save-frame');
  const [name,blob]=[...h.serverFiles].find(([path])=>path.endsWith('.json'));assert.match(name,/sculpture-rat/);const metadata=JSON.parse(await blob.text());assert.equal(metadata.sculpture,'rat');assert.equal(metadata.assetPart,'zodiac-rat');
});

test('the asset route imports only Yuanyingguan and captures its own identity at native resolution',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan&view=front&light=neutral&source=fixture-lock'});await h.ready();
  assert.deepEqual(h.loadedModules,['./yuanyingguan-study.js']);assert.deepEqual(h.builtAssets,['yuanyingguan']);
  assert.match(h.ids['view-caption'].textContent,/南正面/);assert.match(h.ids['asset-title'].textContent,/远瀛观/);
  await h.click('save-frame');const [name,blob]=[...h.serverFiles].find(([path])=>path.endsWith('.json')),metadata=JSON.parse(await blob.text());
  assert.match(name,/yuanmingyuan-yuanyingguan-fixture-lock-front-neutral-/);assert.equal(metadata.assetId,'yuanyingguan');assert.equal(metadata.asset,'yuanyingguan-dashuifa-guanshuifa-study');assert.equal(metadata.sourceTag,'fixture-lock');
  assert.equal(metadata.native.width,2588);assert.equal(metadata.native.height,1800);assert.equal(metadata.native.pixelRatio,2);
  assert.ok(Math.abs(h.renders.at(-1).floorY-(-.665))<1e-8,'floor stays below the depressed court and basin bounds');
});

test('Yuanyingguan exposes four geographic faces and fitted architectural and fountain details',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan',width:390,height:700});await h.ready();
  assert.deepEqual(h.builtAssets,['yuanyingguan']);
  const cases=[['front',['yuanyingguan'],[0,0,1]],['north',['yuanyingguan'],[0,0,-1]],['east',['yuanyingguan'],[1,0,0]],['west',['yuanyingguan'],[-1,0,0]],['threequarter',[],null],['aerial',[],null],['roof',['yuanyingguan-five-roof-hypothesis'],null],['stone',['south-central-column--2.02','south-central-column-2.02'],null],['fountain',['dashuifa'],null],['animals',['dashuifa-eleven-animal-fountain'],null],['guanshuifa',['guanshuifa'],[0,0,-1]],['cranes',['guanshuifa-west-copper-crane','guanshuifa-east-copper-crane'],[0,0,-1]]];
  for(const [view,groups,facing] of cases){
    await h.view(view);const box=new THREE.Box3();for(const name of groups)box.union(new THREE.Box3().setFromObject(h.asset.group.getObjectByName(name)));if(!groups.length)box.setFromObject(h.asset.group);
    assertFits(box,h.renders.at(-1).camera);assert.ok(h.controls.target.distanceTo(box.getCenter(new THREE.Vector3()))<1e-8,view+' targets its named groups');
    if(facing)assert.ok(h.controls.camera.position.clone().sub(h.controls.target).dot(new THREE.Vector3(...facing))>0,view+' follows the geographic axes');
  }
});

test('Yuanyingguan closeups follow nested sculpture facing and omit long hound jets from the fit',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan',width:390,height:700});await h.ready();
  for(const id of ['deer',...Array.from({length:10},(_,n)=>'hound-'+String(n+1).padStart(2,'0')),'crane-west','crane-east']){
    assert.ok(h.ids.sculpture.children.some(option=>option.value===id),'closeup is exposed: '+id);
    h.ids.sculpture.value=id;h.ids.sculpture.emit('change');await h.frame();
    const name=id.startsWith('crane-')?'guanshuifa-'+id.slice(6)+'-copper-crane':'dashuifa-'+id,object=h.asset.group.getObjectByName(name),box=new THREE.Box3();
    if(id.startsWith('hound-'))for(const suffix of ['-body','-open-mouth-spout'])box.union(new THREE.Box3().setFromObject(h.asset.group.getObjectByName(name+suffix)));else box.setFromObject(object);
    assertFits(box,h.renders.at(-1).camera);assert.ok(h.controls.target.distanceTo(box.getCenter(new THREE.Vector3()))<1e-8,id+' frames the sculpture itself');
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));assert.ok(h.controls.camera.position.clone().sub(h.controls.target).dot(forward)>0);
  }
  await h.click('save-frame');const [name,blob]=[...h.serverFiles].find(([path])=>path.endsWith('.json')),metadata=JSON.parse(await blob.text());
  assert.match(name,/sculpture-crane-east/);assert.equal(metadata.assetPart,'guanshuifa-east-copper-crane');assert.equal(metadata.assetId,'yuanyingguan');
  h.canvas.clientWidth=700;h.window.emit('resize');await h.frame();assertFits(new THREE.Box3().setFromObject(h.asset.group.getObjectByName('guanshuifa-east-copper-crane')),h.renders.at(-1).camera);
});

test('invalid asset routes keep the Haiyantang factory and identity',async t=>{
  for(const id of ['unlisted','constructor','__proto__']){
    const h=await studio(t,{search:'?asset='+id});await h.ready();assert.deepEqual(h.loadedModules,['./haiyantang-study.js']);assert.deepEqual(h.builtAssets,['haiyantang']);
    await h.click('save-frame');const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json'));assert.equal(JSON.parse(await blob.text()).assetId,'haiyantang');
  }
});

test('switching assets before import completion navigates without constructing either heavy fixture',async t=>{
  const gate=deferred(),h=await studio(t,{search:'?asset=haiyantang&source=locked&view=stone&light=night',factoryGate:gate});
  assert.equal(h.ids['studio-asset'].disabled,false);h.ids['studio-asset'].value='yuanyingguan';h.ids['studio-asset'].emit('change');
  assert.equal(h.navigations.length,1);const destination=new URL(h.navigations[0].url);assert.equal(destination.searchParams.get('asset'),'yuanyingguan');assert.equal(destination.searchParams.get('source'),'locked');assert.equal(destination.searchParams.get('light'),'night');assert.equal(destination.searchParams.has('view'),false);
  gate.resolve();await flush();await h.frame();assert.equal(h.factoryCalls,0);assert.equal(h.pending.size,0);
});

test('asset navigation disposes the current model and cancels capture before loading the next page',async t=>{
  const gate=deferred(),h=await studio(t,{encodeGate:gate});await h.ready();const saving=h.click('save-frame');
  h.ids['studio-asset'].value='yuanyingguan';h.ids['studio-asset'].emit('change');
  assert.equal(h.navigations.length,1);assert.equal(h.navigations[0].disposed,true);assert.equal(h.navigations[0].pending,0);assert.ok(h.resources.every(item=>item.disposed));
  gate.resolve();await saving;assert.equal(h.requests.length,0);assert.deepEqual(h.builtAssets,['haiyantang']);assert.deepEqual(h.loadedModules,['./haiyantang-study.js']);
});

test('Yuanyingguan recovery keeps the selected closeup and waits for the restored environment',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan'});await h.ready();h.ids.sculpture.value='crane-west';h.ids.sculpture.emit('change');await h.frame();const target=h.controls.target.clone();
  h.canvas.emit('webglcontextlost');await h.nativeRestore();assert.notEqual(h.body.dataset.ready,'true');await h.ready();assert.ok(h.renders.at(-1).environmentPopulated);assert.equal(h.ids.sculpture.value,'crane-west');assert.ok(h.controls.target.distanceTo(target)<1e-8);assert.deepEqual(h.loadedModules,['./yuanyingguan-study.js']);
});

test('a missing configured part keeps the last camera and capture identity',async t=>{
  const h=await studio(t);await h.ready();const camera=h.controls.camera.position.clone(),target=h.controls.target.clone();
  h.asset.group.remove(h.asset.group.getObjectByName('west-hall'));await h.view('roof');
  assert.equal(h.ids.status.dataset.error,'true');assert.match(h.ids.status.textContent,/west-hall/);
  assert.ok(h.controls.camera.position.distanceTo(camera)<1e-8);assert.ok(h.controls.target.distanceTo(target)<1e-8);
  await h.click('save-frame');const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json'));assert.equal(JSON.parse(await blob.text()).view,'threequarter');
});

test('the extracted Haiyantang detail crops preserve their original framing',async t=>{
  const h=await studio(t,{width:390,height:700});await h.ready();
  for(const [view,min,max] of [['stone',[-22.8,6.6,27.2],[-6,20.4,30]],['roof',[-30,20.4,10],[30,30,30]]]){
    await h.view(view);const box=new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max));
    assertFits(box,h.renders.at(-1).camera);assert.ok(h.controls.target.distanceTo(box.getCenter(new THREE.Vector3()))<1e-8);
  }
});

test('asset navigation retains the current lighting and selecting the active asset does nothing',async t=>{
  const h=await studio(t,{search:'?asset=haiyantang&light=day'});await h.ready();h.ids['studio-asset'].emit('change');
  assert.equal(h.navigations.length,0);assert.equal(h.asset.disposed,false);
  h.ids.lighting.value='neutral';h.ids.lighting.emit('change');await h.frame();h.ids['studio-asset'].value='yuanyingguan';h.ids['studio-asset'].emit('change');
  assert.equal(new URL(h.navigations[0].url).searchParams.get('light'),'neutral');
});

test('detail isolation excludes occluding neighbours and records the display scope',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan'});await h.ready();await h.view('stone');
  assert.equal(h.asset.group.getObjectByName('yuanyingguan').visible,true);
  assert.equal(h.asset.group.getObjectByName('dashuifa').visible,false,'the fountain wall cannot cover the carved column camera');
  assert.match(h.ids['view-caption'].textContent,/Isolated parts/);assert.equal(h.renders.at(-1).shadowDirty,true);
  h.ids.sculpture.value='hound-01';h.ids.sculpture.emit('change');await h.frame();
  for(const name of ['dashuifa','dashuifa-eleven-animal-fountain','dashuifa-hound-01','dashuifa-hound-01-body'])assert.equal(h.asset.group.getObjectByName(name).visible,true,'retained ancestor or target: '+name);
  for(const name of ['yuanyingguan','dashuifa-deer','dashuifa-hound-02','dashuifa-hound-01-water'])assert.equal(h.asset.group.getObjectByName(name).visible,false,'excluded obstruction: '+name);
  await h.click('save-frame');const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json'));
  assert.deepEqual(JSON.parse(await blob.text()).isolatedParts,['dashuifa-hound-01-body','dashuifa-hound-01-open-mouth-spout']);
  await h.view('threequarter');assert.doesNotMatch(h.ids['view-caption'].textContent,/Isolated parts/);
  h.asset.group.traverse(object=>assert.equal(object.visible,object.name!=='authored-hidden-part','authored visibility restored: '+object.name));
  assert.equal(h.renders.at(-1).shadowDirty,true);await h.view('aerial');assert.equal(h.renders.at(-1).shadowDirty,false,'full-scene camera changes reuse unchanged shadows');
});

test('failed detail selection preserves the preceding isolated geometry and identity',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan'});await h.ready();await h.view('guanshuifa');
  h.asset.group.getObjectByName('yuanyingguan').remove(h.asset.group.getObjectByName('south-central-column--2.02'));
  await h.view('stone');assert.equal(h.ids.status.dataset.error,'true');assert.equal(h.asset.group.getObjectByName('guanshuifa').visible,true);assert.equal(h.asset.group.getObjectByName('yuanyingguan').visible,false);
  await h.click('save-frame');const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json')),record=JSON.parse(await blob.text());
  assert.equal(record.view,'guanshuifa');assert.deepEqual(record.isolatedParts,['guanshuifa']);
});

test('additional western palace routes import and frame only their selected fixture',async t=>{
  for(const id of ['xieqiqu','fangwaiguan']){
    const h=await studio(t,{search:'?asset='+id,width:390,height:700});await h.ready();
    assert.deepEqual(h.loadedModules,['./'+id+'-study.js']);assert.deepEqual(h.builtAssets,[id]);
    assert.equal(h.ids.sculpture.disabled,id==='fangwaiguan','Fangwaiguan has no sculpture actions; Xieqiqu has its fountain studies');
    for(const [view,spec] of Object.entries(studioAssets[id].views)){
      await h.view(view);assert.notEqual(h.ids.status.dataset.error,'true');
      const box=new THREE.Box3();for(const name of spec.groups)box.union(new THREE.Box3().setFromObject(h.asset.group.getObjectByName(name)));if(!spec.groups.length)box.setFromObject(h.asset.group);
      assertFits(box,h.renders.at(-1).camera);
    }
    await h.click('save-frame');const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json'));assert.equal(JSON.parse(await blob.text()).assetId,id);
  }
});

test('water playback has one clock, pauses offscreen, and records the displayed time',async t=>{
  const h=await studio(t,{search:'?asset=yuanyingguan'});await h.ready();assert.equal(h.asset.lastUpdateTime,0);
  await h.click('animate-water');await h.frame(16);await h.frame(50);assert.equal(h.asset.lastUpdateTime,.05);assert.equal(h.pending.size,1);
  await h.visibility(true);await h.frame(10000);assert.equal(h.asset.lastUpdateTime,.05);assert.equal(h.pending.size,0);
  await h.visibility(false);await h.frame(10000);assert.equal(h.asset.lastUpdateTime,.05,'hidden wall time is not simulated');await h.frame(40);assert.equal(h.asset.lastUpdateTime,.09);
  await h.click('animate-water');await h.frame(50);assert.equal(h.asset.lastUpdateTime,.09);
  await h.click('save-frame');const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json'));assert.deepEqual(JSON.parse(await blob.text()).animation,{playing:false,timeSeconds:.09});
});

test('water animation remains frozen while its native frame pair is being encoded',async t=>{
  const gate=deferred(),h=await studio(t,{search:'?asset=yuanyingguan',encodeGate:gate});await h.ready();await h.click('animate-water');await h.frame();await h.frame(50);
  const time=h.asset.lastUpdateTime,saving=h.click('save-frame');await h.frame(50);await h.frame(50);assert.equal(h.asset.lastUpdateTime,time);
  gate.resolve();await saving;await h.frame(50);assert.ok(h.asset.lastUpdateTime>time);const [,blob]=[...h.serverFiles].find(([name])=>name.endsWith('.json'));assert.equal(JSON.parse(await blob.text()).animation.timeSeconds,time);
});


test('archive route renders prepared geometry without importing its procedural factory',async t=>{
  const h=await studio(t,{search:'?asset=haiyantang&archive=/assets/verified/manifest.json'});await h.ready();
  assert.deepEqual(h.loadedModules,[]);assert.equal(h.asset.archive.id,'haiyantang');
  await h.click('save-frame');const metadata=JSON.parse(await [...h.serverFiles.values()][1].text());assert.equal(metadata.assetSource,'archive');assert.equal(metadata.archive.sourceDigest,'fixture-source');
});

test('archive and replacement material requests cannot silently show archived finishes',async t=>{
  const h=await studio(t,{search:'?asset=fangwaiguan&archive=1&materials=stone-r4'});await h.frame();
  assert.equal(h.body.dataset.ready,'failed');assert.equal(h.renders.length,0);
  assert.deepEqual(h.loadedModules,[]);assert.equal(h.factoryCalls,0);
  assert.match(h.ids.status.textContent,/离线归档使用已保存的材质/);
});

test('a late archive decode after pagehide disposes its unmounted resource',async t=>{
  const gate=deferred(),h=await studio(t,{search:'?asset=haiyantang&archive=/assets/verified/manifest.json',archiveGate:gate});
  h.window.emit('pagehide');gate.resolve();await flush();await h.frame();
  assert.equal(h.asset.disposed,true);assert.equal(h.renders.length,0);assert.equal(h.pending.size,0);
});

test('still review waits for prepared materials and displays one ready frame at unchanged native quality',async t=>{
  for(const pipeline of ['', '&render=world']){
    const gate=deferred(),h=await studio(t,{search:'?review=still'+pipeline,width:390,height:280,factoryGate:gate});
    await h.frame();assert.equal(h.factoryCalls,0);assert.equal(h.renders.length,0);assert.equal(h.resources.length,0);
    assert.notEqual(h.body.dataset.ready,'true');gate.resolve();await h.ready();
    assert.equal(h.factoryCalls,1);assert.equal(h.renders.length,1);assert.equal(h.pending.size,0);
    assert.equal(h.controls.enableDamping,false);assert.equal(h.resources[0].getPixelRatio(),2);
    assert.deepEqual([h.canvas.width,h.canvas.height],[780,560]);
    assert.equal(h.resources[0].shadowMap.enabled,true);assert.equal(h.resources[0].shadowMap.type,THREE.PCFShadowMap);
    assert.equal(h.renders[0].shadowDirty,true);assert.equal(h.renders[0].environmentPopulated,true);
    if(pipeline){assert.equal(h.postpasses.length,1);assert.equal(h.postpasses[0].quality,'high');assert.deepEqual(h.postpasses[0].sizes.at(-1),[390,280,2]);}
    await h.frame();await h.frame();assert.equal(h.renders.length,1,'no tail settling loop');
  }
});

test('still review redraws completed view, resize, light, wireframe and orbit changes without a tail loop',async t=>{
  const h=await studio(t,{search:'?review=still',width:390,height:280});await h.ready();let count=h.renders.length;
  const oneFrame=async()=>{assert.equal(h.pending.size,1);await h.frame();assert.equal(h.renders.length,++count);assert.equal(h.pending.size,0);assert.equal(h.body.dataset.ready,'true');};
  h.views.find(button=>button.dataset.view==='north').click();await oneFrame();
  assert.equal(h.controls.enableDamping,false);
  h.canvas.clientWidth=340;h.window.emit('resize');await oneFrame();assert.deepEqual([h.canvas.width,h.canvas.height],[680,560]);
  h.ids.lighting.value='night';h.ids.lighting.emit('change');await oneFrame();assert.equal(h.renders.at(-1).shadowDirty,true);
  h.ids.wireframe.checked=true;h.ids.wireframe.emit('change');await oneFrame();assert.equal(h.renders.at(-1).shadowDirty,true);
  h.controls.dispatchEvent({type:'start'});h.controls.camera.position.set(10,20,80);h.controls.target.set(3,4,5);
  h.controls.changes=1; // One final change event from Controls.update within render.
  h.controls.dispatchEvent({type:'change'});h.controls.dispatchEvent({type:'change'});await oneFrame();
  assert.deepEqual(h.renders.at(-1).camera.position.toArray(),[10,20,80]);assert.deepEqual(h.controls.target.toArray(),[3,4,5]);
  assert.equal(h.controls.enableDamping,false);assert.equal(h.renders.at(-1).shadowDirty,false);
  await h.click('save-frame');assert.equal(h.renders.length,++count,'explicit capture retains its fresh native render');
  assert.equal(h.pending.size,0);assert.equal(h.nativeReads.length,1);assert.equal(h.nativeReads[0].serial,count);
  const metadata=JSON.parse(await [...h.serverFiles.entries()].find(([name])=>name.endsWith('.json'))[1].text());
  assert.deepEqual(metadata.camera,[10,20,80]);assert.deepEqual(metadata.target,[3,4,5]);assert.equal(metadata.capture.renderSerial,count);
});

test('still review explicit playback continues, pauses cleanly, and never simulates hidden wall time',async t=>{
  const h=await studio(t,{search:'?review=still',width:120,height:100});await h.ready();
  await h.click('animate-water');await h.frame(16);await h.frame(50);
  assert.equal(h.asset.lastUpdateTime,.05);assert.equal(h.pending.size,1);
  await h.visibility(true);const count=h.renders.length;await h.frame(10000);
  assert.equal(h.renders.length,count);assert.equal(h.pending.size,0);
  await h.visibility(false);await h.frame(10000);assert.equal(h.asset.lastUpdateTime,.05);
  await h.frame(40);assert.equal(h.asset.lastUpdateTime,.09);assert.equal(h.pending.size,1);
  await h.click('animate-water');await h.frame(50);assert.equal(h.asset.lastUpdateTime,.09);assert.equal(h.pending.size,0);
  const paused=h.renders.length;await h.frame(10000);assert.equal(h.renders.length,paused);
});

test('still review context restoration produces one new ready frame and leaving cancels pending work',async t=>{
  const h=await studio(t,{search:'?review=still',width:120,height:100});await h.ready();const before=h.renders.length;
  h.canvas.emit('webglcontextlost');assert.equal(h.pending.size,0);assert.notEqual(h.body.dataset.ready,'true');
  await h.nativeRestore();assert.notEqual(h.body.dataset.ready,'true');await h.ready();
  assert.equal(h.renders.length,before+1);assert.equal(h.pending.size,0);assert.equal(h.factoryCalls,1);
  assert.equal(h.renders.at(-1).environmentEpoch,1);assert.equal(h.renders.at(-1).environmentPopulated,true);
  h.ids.lighting.value='neutral';h.ids.lighting.emit('change');assert.equal(h.pending.size,1);
  h.window.emit('pagehide');assert.equal(h.pending.size,0);await h.frame();assert.equal(h.renders.length,before+1);assert.equal(h.asset.disposed,true);
  const gate=deferred(),late=await studio(t,{search:'?review=still',factoryGate:gate,width:120,height:100});
  late.window.emit('pagehide');gate.resolve();await flush();await late.frame();assert.equal(late.factoryCalls,0);assert.equal(late.renders.length,0);assert.equal(late.pending.size,0);
});

test('still review is opt-in: absent or other values retain damping and twenty settled frames',async t=>{
  for(const search of ['', '?review=motion', '?review=Still']){
    const h=await studio(t,{search,width:120,height:100});await h.ready();
    assert.equal(h.controls.enableDamping,true);assert.equal(h.renders.length,1);assert.equal(h.pending.size,1);
    for(let i=0;i<25&&h.pending.size;i++)await h.frame();
    assert.equal(h.renders.length,20);assert.equal(h.pending.size,0);
  }
});

test('garden entry consumes the real complete-mesh frame hook after async preparation, view changes and resize',async t=>{
  const gate=deferred(),h=await studio(t,{search:'?asset=yangquelong-garden-r1&review=still',width:1408,height:880,factoryGate:gate});
  assert.equal(h.gardenPrepares,1);assert.equal(h.factoryCalls,0);assert.equal(h.renders.length,0);assert.equal(h.gardenFrames.length,0);
  gate.resolve();await h.ready();assert.deepEqual(h.builtAssets,['yangquelong-garden-r1']);
  assert.equal(h.factoryCalls,1);assert.equal(h.gardenPrepares,1);assert.deepEqual(h.loadedModules,[]);
  const assertUsed=()=>{
    const record=h.gardenFrames.at(-1);assert.ok(record,'the optional hook was actually invoked');
    assert.equal(record.group,h.asset.group);assert.equal(record.fit.method,'all-visible-mesh-bounds-perspective-intervals');
    assert.equal(record.fit.meshes,6);assert.equal(record.fit.instances,12);assert.equal(record.fit.pointCount,48);
    assert.ok(h.controls.camera.position.distanceTo(new THREE.Vector3(...record.fit.position))<1e-8);
    assert.ok(h.controls.target.distanceTo(new THREE.Vector3(...record.fit.target))<1e-8);
    assert.ok(h.renders.at(-1).camera.position.distanceTo(new THREE.Vector3(...record.fit.position))<1e-8,'rendered camera consumed the fit');
    for(const point of gardenFramingPoints(h.asset.group).points){
      const q=point.clone().project(h.renders.at(-1).camera);assert.ok(Math.abs(q.x)<=1/record.fit.margin+1e-8&&Math.abs(q.y)<=1/record.fit.margin+1e-8&&q.z>=-1&&q.z<=1,'actual drawn camera clips no visible mesh envelope');
    }
    assert.equal(h.controls.enableDamping,false);assert.equal(h.pending.size,0);
  };
  assertUsed();const first=h.gardenFrames.length,oldCamera=h.controls.camera.position.clone();
  await h.view('gardenreverse');assert.equal(h.gardenFrames.length,first+1);assert.equal(h.gardenFrames.at(-1).spec,yangquelongGardenStudioEntry.views.gardenreverse);assertUsed();
  assert.ok(h.controls.camera.position.distanceTo(oldCamera)>1);
  const reverse=h.gardenFrames.length;h.canvas.clientWidth=974;h.window.emit('resize');await h.frame();
  assert.equal(h.gardenFrames.length,reverse+1);assert.equal(h.gardenFrames.at(-1).fit.aspect,974/880);assertUsed();
  assert.deepEqual([h.canvas.width,h.canvas.height],[1948,1760]);assert.equal(h.resources[0].getPixelRatio(),2);
  h.window.emit('pagehide');assert.equal(h.asset.disposed,true);assert.equal(h.pending.size,0);
});

test('garden hook registration leaves the normal studio camera path and source loader alone',async t=>{
  const h=await studio(t,{search:'?asset=haiyantang&review=still',width:390,height:280});await h.ready();
  const box=new THREE.Box3().setFromObject(h.asset.group),center=box.getCenter(new THREE.Vector3());
  assert.equal(h.gardenPrepares,0);assert.equal(h.gardenFrames.length,0);assert.deepEqual(h.loadedModules,['./haiyantang-study.js']);
  assert.ok(h.controls.target.distanceTo(center)<1e-8);assertFits(box,h.renders.at(-1).camera);
  await h.view('north');h.canvas.clientWidth=450;h.window.emit('resize');await h.frame();
  assert.equal(h.gardenFrames.length,0);assert.equal(h.gardenPrepares,0);assertFits(box,h.renders.at(-1).camera);
});

test('garden hook failure restores the previous damping value before normal startup cleanup',async t=>{
  const h=await studio(t,{search:'?asset=yangquelong-garden-r1',width:120,height:100,gardenFrameFailure:new Error('fixture hook failed')});
  await h.frame();assert.equal(h.body.dataset.ready,'failed');assert.equal(h.controls.enableDamping,true);
  assert.equal(h.renders.length,0);assert.equal(h.pending.size,0);assert.equal(h.asset.disposed,true);assert.equal(h.controls.disposed,true);
});

test('refined garden entry prepares once and its real whole/focus view hook survives resize in normal studio',async t=>{
  const h=await studio(t,{search:'?asset=yangquelong-refined-garden-r3&review=still',width:1408,height:880});await h.ready();
  assert.equal(h.refinedPrepares,1);assert.equal(h.factoryCalls,1);assert.equal(h.refinedFrames.at(-1).spec,yangquelongRefinedGardenStudioEntry.views.gardenhigh);
  const originalVisibility=[];h.asset.group.traverse(n=>originalVisibility.push([n,n.visible]));
  await h.view('courtyard');const close=h.refinedFrames.at(-1);assert.equal(close.fit.geometryHidden,0);assert.equal(close.fit.groups.length,3);
  const before=h.refinedFrames.length;h.canvas.clientWidth=700;h.window.emit('resize');await h.frame();assert(h.refinedFrames.length>before);assert.equal(h.refinedFrames.at(-1).fit.aspect,700/880);
  assert(originalVisibility.every(([n,v])=>n.visible===v));assert.equal(h.refinedPrepares,1);
  await h.view('gardeneast');assert(h.controls.camera.position.x>h.controls.target.x);assert.equal(h.refinedFrames.at(-1).spec,yangquelongRefinedGardenStudioEntry.views.gardeneast);
  h.window.emit('pagehide');assert(h.asset.disposed);assert.equal(h.pending.size,0);
});
