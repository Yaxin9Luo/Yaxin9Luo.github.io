import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {QUALITY,renderPixelRatio} from '../src/render-quality.js';

// Execute the actual studio module and its HTML against asynchronous device,
// DOM and render boundaries. These are lifecycle/dispatch checks, not GPU proof.
const source=(await readFile(new URL('../src/studio.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,'').replaceAll('import.meta.env.DEV','true');
const html=await readFile(new URL('../asset-studio.html',import.meta.url),'utf8');
async function fixture({startError=false,saveOK=true}={}){
  let now=0,urlSequence=0;const listeners={},recorders=[],streams=[],encoded=[],urls=new Map(),revoked=[],requests=[],updates=[],casts=[],errors=[];
  const camel=value=>value.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  class Element{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.style={};this.disabled=false;this.value='';this.hidden=false;}
    append(...items){for(const item of items){if(typeof item==='object'){if(item.parentElement)item.parentElement.children=item.parentElement.children.filter(child=>child!==item);item.parentElement=this;}this.children.push(item);}}
    insertBefore(item,before){if(!before)return this.append(item);this.children.splice(this.children.indexOf(before),0,item);item.parentElement=this;}
    setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.className=value;if(key==='id')this.id=value;if(key==='value')this.value=value;if(key.startsWith('data-'))this.dataset[camel(key.slice(5))]=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    addEventListener(type,handler){this['on'+type]=handler;}
    click(){if(!this.disabled)this.onclick?.({currentTarget:this,target:this});}
    set textContent(value){this.children=[String(value)];}get textContent(){return this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
    set innerHTML(value){this.children=[];parse(value,this);}get innerHTML(){return this.textContent;}
    querySelectorAll(selector){const found=[],parts=selector.split(',');const matches=node=>parts.some(part=>{part=part.trim();if(part.startsWith('#'))return node.id===part.slice(1);if(part.startsWith('.'))return node.className?.split(' ').includes(part.slice(1));if(part.startsWith('[')){const [,name,value]=part.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/)||[];return name&&node.getAttribute(name)!==null&&(value===undefined||node.getAttribute(name)===value);}return node.tagName===part;});const visit=node=>{for(const child of node.children)if(typeof child==='object'){if(matches(child))found.push(child);visit(child);}};visit(this);return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  }
  function parse(markup,parent){const stack=[parent];for(const token of markup.match(/<[^>]+>|[^<]+/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(token.startsWith('<')){const match=token.match(/^<([a-z][\w-]*)\b([^>]*)>/i);if(!match)continue;const node=new Element(match[1]);for(const attr of match[2].matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(attr[1],attr[2]??attr[3]??attr[4]??'');stack.at(-1).append(node);if(!['br','input','meta','link','img'].includes(node.tagName))stack.push(node);}else stack.at(-1).append(token);}}
  const document=new Element('document');document.hidden=false;document.createElement=tag=>new Element(tag);document.addEventListener=(type,handler)=>{listeners[type]=handler;};parse(html.match(/<body>([\s\S]*)<\/body>/)[1],document);document.body=new Element('body');document.body.dataset={};
  const canvas=document.querySelector('canvas');Object.assign(canvas,{width:1000,height:700,clientWidth:800,clientHeight:560,getBoundingClientRect:()=>({width:800,height:560}),toBlob:callback=>encoded.push(callback),captureStream:()=>{const tracks=[{stops:0,stop(){this.stops++;}}],stream={getTracks:()=>tracks};streams.push(stream);return stream;}});
  class Renderer{constructor(){this.capabilities={maxSamples:4};this.shadowMap={};this.dpr=1.25;}setPixelRatio(value){this.dpr=value;}getPixelRatio(){return this.dpr;}setSize(w,h){canvas.width=Math.floor(w*this.dpr);canvas.height=Math.floor(h*this.dpr);}dispose(){}}
  class Orbit{constructor(){this.target=new THREE.Vector3();this.events={};this.enabled=true;}update(){}addEventListener(type,handler){this.events[type]=handler;}dispose(){}}
  class Composer{constructor(){this.passes=[];}addPass(pass){this.passes.push(pass);}render(){}setPixelRatio(){}setSize(){}dispose(){}}
  class Pass{dispose(){}}
  class Recorder{
    static isTypeSupported(){return true;}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'video/webm';this.state='inactive';this.stopCount=0;recorders.push(this);}
    start(){if(startError)throw new Error('capture unavailable');this.state='recording';}
    stop(){assert.equal(this.state,'recording');this.state='inactive';this.stopCount++;}
    async finish(data='video'){if(data)this.ondataavailable?.({data:new Blob([data],{type:this.mimeType})});this.state='inactive';await this.onstop?.();}
  }
  const specimen=()=>{const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(2,6,1),new THREE.MeshStandardMaterial()));return group;};
  const models=Object.fromEntries(['createCastle','createLibrary','createWorkshop','createObservatory','createRuins','createOwlery'].map(name=>[name,specimen]));models.loadArchitectureAssets=async()=>{};
  const location={search:'?asset=rider'},DateBoundary=class extends Date{constructor(...args){super(...(args.length?args:[1788860000000+now]));}static now(){return 1788860000000+now;}};
  const context={THREE:{...THREE,WebGLRenderer:Renderer},OrbitControls:Orbit,HDRLoader:class{async loadAsync(){return new THREE.Texture();}},EffectComposer:Composer,RenderPass:Pass,UnrealBloomPass:Pass,OutputPass:Pass,SMAAPass:Pass,QUALITY,renderPixelRatio,models,
    createGardenSpecimen:specimen,createWizard:specimen,createWisp:specimen,createTreeSpecimen:specimen,createSkyLantern:specimen,createPortal:specimen,createShield:specimen,createViaduct:specimen,createGardenLamp:specimen,createResearchBook:specimen,createTerrainSpecimen:specimen,createScannedRockSpecimen:specimen,createFootingSpecimen:specimen,
    loadCharacterAssets:async()=>{},loadLandscapeAssets:async()=>{},surface:()=>new THREE.MeshStandardMaterial(),planarUV(){},
    updateCharacter:(actor,args)=>{updates.push({actor,args});},requestCharacterCast:actor=>{casts.push(actor);return {accepted:true,sequence:casts.length};},cancelCharacterCast(){},
    document,window:{MediaRecorder:Recorder,addEventListener:(type,handler)=>{listeners[type]=handler;}},MediaRecorder:Recorder,ResizeObserver:class{constructor(callback){this.callback=callback;}observe(){this.callback();}disconnect(){}},
    innerWidth:1000,innerHeight:776,devicePixelRatio:1.25,matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>now},Date:DateBoundary,
    Blob,URLSearchParams,URL:{createObjectURL:blob=>{const id='blob:studio-'+ ++urlSequence;urls.set(id,blob);return id;},revokeObjectURL:id=>{revoked.push(id);urls.delete(id);}},location,history:{replaceState:(_state,_unused,path)=>{location.search=path;}},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:saveOK,status:saveOK?200:500};},AbortSignal,setTimeout,clearTimeout,console:{warn(){},error:error=>errors.push(error)}};
  const api=await vm.runInNewContext(`(async()=>{${source}\nreturn {frame,show,recordActor,updateRecording,state:()=>({current,actorAction,actorPlaying,recording,controls,renderer,key})};})()`,context,{filename:'studio.js'});
  assert.equal(errors.length,0);assert.equal(document.body.dataset.ready,'true');
  return {...api,document,listeners,recorders,streams,encoded,urls,revoked,requests,updates,casts,at(value){now=value;},tick(value){now=value;api.frame(now);},element:selector=>document.querySelector(selector),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('studio pause and boost controls dispatch actual action intent without advancing a paused actor',async()=>{
  const qa=await fixture(),select=qa.element('.actor-tools').querySelector('select');select.value='boost';select.onchange({target:select});qa.tick(100);
  assert.equal(qa.updates.at(-1).args.boost,true);assert.ok(qa.updates.at(-1).args.dt>0);
  qa.element('[data-actor-play]').click();qa.tick(200);assert.equal(qa.updates.at(-1).args.paused,true);assert.equal(qa.updates.at(-1).args.dt,0);
  qa.element('[data-actor-play]').click();qa.element('[data-actor-cast]').click();qa.tick(300);assert.equal(qa.casts.length,1);assert.equal(qa.casts[0],qa.state().current);
});

test('one 16-second sequence releases its stream and restores paused inspection state',async()=>{
  const qa=await fixture();qa.element('[data-actor-play]').click();qa.element('#wire').disabled=true;qa.recordActor();qa.recordActor();assert.equal(qa.recorders.length,1);assert.equal(qa.state().controls.enabled,false);
  for(const time of [0,2000,4000,8000,10000,12000,16000])qa.tick(time);
  assert.equal(qa.casts.length,1);assert.equal(qa.recorders[0].stopCount,1);assert.ok(qa.updates.some(update=>update.args.boost));
  await qa.recorders[0].finish();assert.equal(qa.state().recording,null);assert.equal(qa.state().actorPlaying,false);assert.equal(qa.element('[data-actor-record]').disabled,false);assert.equal(qa.streams[0].getTracks()[0].stops,1);
  assert.equal(qa.state().controls.enabled,true);assert.equal(qa.state().controls.autoRotate,true);assert.equal(qa.element('#wire').disabled,true);assert.equal(qa.recorders[0].onstop,null);
});

test('recorder start failure releases its stream, clears the lock and leaves retry available',async()=>{
  const qa=await fixture({startError:true});assert.doesNotThrow(()=>qa.recordActor());
  assert.equal(qa.state().recording,null);assert.equal(qa.streams[0].getTracks()[0].stops,1);assert.equal(qa.element('[data-actor-record]').disabled,false);
  assert.match(qa.document.textContent,/capture unavailable|failed|失败/i);
});

test('asynchronous PNG encoding retains the rendered asset, light, shadow, view and action conditions',async()=>{
  const qa=await fixture(),light=qa.element('#light'),view=qa.element('.actor-tools').querySelectorAll('[data-actor-view]').find(button=>button.dataset.actorView==='mask');
  light.value='day';light.onchange({target:light});qa.element('#shadows').click();view.click();const action=qa.element('.actor-tools').querySelector('select');action.value='boost';action.onchange({target:action});
  qa.element('#frame').click();qa.tick(100);assert.equal(qa.encoded.length,1);
  qa.show('wraith');light.value='night';light.onchange({target:light});qa.encoded[0](new Blob(['rider day pixels'],{type:'image/png'}));await qa.flush();
  const name=qa.requests[0].url;assert.match(name,/rider/);assert.match(name,/day/);assert.match(name,/shadow(?:s)?-?off/);assert.match(name,/mask/);assert.match(name,/boost/);assert.doesNotMatch(name,/wraith|night/);
});

test('hiding a recording stops and releases immediately, and the exported take is explicitly invalid',async()=>{
  const qa=await fixture();qa.recordActor();qa.tick(4000);qa.document.hidden=true;qa.listeners.visibilitychange?.();
  assert.equal(qa.recorders[0].stopCount,1);assert.equal(qa.streams[0].getTracks()[0].stops,1);
  await qa.recorders[0].finish();await qa.flush();assert.match(qa.requests[0].url,/invalid/);assert.match(qa.requests[0].url,/hidden|visibility/);assert.equal(qa.state().recording,null);
});

test('pagehide releases active capture and revokes result links including late finalization',async()=>{
  const qa=await fixture();qa.element('#frame').click();qa.tick(100);qa.encoded[0](new Blob(['png'],{type:'image/png'}));await qa.flush();assert.equal(qa.urls.size,1);
  qa.recordActor();qa.listeners.pagehide?.({persisted:false});assert.equal(qa.urls.size,0);assert.equal(qa.recorders[0].stopCount,1);assert.equal(qa.streams[0].getTracks()[0].stops,1);
  await qa.recorders[0].finish();await qa.flush();assert.equal(qa.urls.size,0,'late chunks must not allocate unreleasable download URLs');assert.equal(qa.state().recording,null);
});

test('local save failures remain visible beside a usable browser download',async()=>{
  const qa=await fixture({saveOK:false});qa.element('#frame').click();qa.tick(100);qa.encoded[0](new Blob(['png'],{type:'image/png'}));await qa.flush();
  assert.equal(qa.urls.size,1);assert.match(qa.document.textContent,/500|save failed|保存失败/i);
});

test('shadow toggle updates renderer, caster and material state in both directions',async()=>{
  const qa=await fixture(),{renderer,key,current}=qa.state(),material=current.children[0].material,version=material.version;
  qa.element('#shadows').click();assert.equal(renderer.shadowMap.enabled,false);assert.equal(key.castShadow,false);assert.equal(qa.element('#shadows').getAttribute('aria-pressed'),'false');assert.ok(material.version>version);
  qa.element('#shadows').click();assert.equal(renderer.shadowMap.enabled,true);assert.equal(key.castShadow,true);assert.equal(renderer.shadowMap.needsUpdate,true);
});

test('device errors and spontaneous stops cannot be exported as completed 16-second takes',async()=>{
  for(const deviceError of [true,false]){
    const qa=await fixture();qa.recordActor();qa.tick(3000);
    if(deviceError)qa.recorders[0].onerror({error:new Error('encoder failed')});
    await qa.recorders[0].finish();await qa.flush();assert.equal(qa.state().recording,null);assert.equal(qa.streams[0].getTracks()[0].stops,1);
    assert.match(qa.requests[0].url,deviceError?/invalid-recorder-error/:/invalid-recorder-stopped-early/);
    qa.recordActor();assert.equal(qa.recorders.length,2,'an interrupted recorder cannot hold the next take locked');
  }
});

test('a page exit between stop request and final chunks invalidates that take without double release',async()=>{
  const qa=await fixture();qa.recordActor();for(const time of [0,2000,4000,8000,10000,12000,16000])qa.tick(time);
  qa.listeners.pagehide({persisted:false});await qa.recorders[0].finish();await qa.flush();
  assert.match(qa.requests[0].url,/invalid-page-hidden/);assert.equal(qa.recorders[0].stopCount,1);assert.equal(qa.streams[0].getTracks()[0].stops,1);assert.equal(qa.urls.size,0);
});

test('the guardian sequence dispatches its channel action instead of a rider-only cast request',async()=>{
  const qa=await fixture();qa.show('wraith');qa.recordActor();for(const time of [0,2000,4000,8000,10000])qa.tick(time);
  assert.equal(qa.updates.at(-1).args.state,'channel');assert.equal(qa.casts.length,0);
  qa.tick(12000);qa.tick(16000);await qa.recorders[0].finish();assert.equal(qa.state().recording,null);
});
