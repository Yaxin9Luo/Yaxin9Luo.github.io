import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ReviewMetrics,evidenceFilename} from '../src/review-metrics.js';

const source=(await readFile(new URL('../src/quality-review.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,'').replaceAll('import.meta.env.DEV','true');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

async function fixture({musicPromise=null,lod=true,save=null,capture=null,startError=false,nativeDpr=1.25}={}){
  let now=0;const elements=new Map(),recorders=[],streams=[],downloads=[],listeners={},lodChanges=[],errors=[];
  class Element {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.disabled=true;this.value='';this.dataset={};}
    set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
    append(...children){this.children.push(...children);for(const child of children)if(typeof child==='object')child.parentElement=this;}
    insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);child.parentElement=this;}
    click(){if(this.tagName==='a')downloads.push(this);}
  }
  for(const id of ['view','light','quality','reset','measure','record','frame','sound','audition','json','status','metrics','media']){const element=new Element();element.id=id;}
  elements.get('view').value='court';elements.get('light').value='night';elements.get('quality').value='high';
  const controls=new Element();controls.append(elements.get('reset'));
  const track=kind=>({kind,stopped:false,stop(){this.stopped=true;}});
  const canvas={width:1024,height:576,clientWidth:1024,clientHeight:576,captureStream(){const tracks=[track('video')],stream={getTracks:()=>tracks,addTrack:next=>tracks.push(next)};streams.push(stream);return stream;},toBlob(callback){if(capture)capture(callback);else callback(new Blob(['png'],{type:'image/png'}));}};
  const document={getElementById:id=>elements.get(id),querySelector:()=>canvas,createElement:tag=>new Element(tag),documentElement:{dataset:{build:'test-build'}},body:{dataset:{}},hidden:false,addEventListener:(name,handler)=>{listeners[name]=handler;}};
  class Game {
    constructor(){
      this.options={sound:false,quality:'high'};this.world={vegetation:{lod:{nearCount:3,midCount:4,farCount:5},...(lod?{lodController:{setEnabled:value=>lodChanges.push(value)}}:{})},updateVegetation(){}};
      let pixelRatio=nativeDpr;
      this.renderer={shadowMap:{},getPixelRatio:()=>pixelRatio,setPixelRatio:value=>{pixelRatio=value;},setSize(width,height){canvas.width=Math.floor(width*pixelRatio);canvas.height=Math.floor(height*pixelRatio);},getContext:()=>({getExtension:()=>null}),info:{render:{calls:50,triangles:1000},memory:{geometries:2,textures:2}}};
      this.camera={position:{values:[1,2,3],toArray(){return [...this.values];},fromArray(values){this.values=[...values];}},fov:43,lookAt:vector=>{this.camera.target=[...vector.values];},updateProjectionMatrix(){},updateMatrixWorld(){}};
      this.rendering={render(){},resize(width,height,dpr){this.lastSize={width,height,dpr};}};this.exhibitionStage={loadedSource:'image.webp',materialErrors:[]};
      this.audio={_musicPromise:musicPromise,unlock(){},play(){},setEnvironment(){},context:{createMediaStreamDestination(){const tracks=[track('audio')];return {stream:{getAudioTracks:()=>tracks}};}},master:{connected:new Set(),connect(output){this.connected.add(output);},disconnect(output){assert.equal(this.connected.delete(output),true);}}};
    }
    setTouch(){}setControl(){}leaveExhibit(){}returnHome(){}start(){}setOption(key,value){this.options[key]=value;if(key==='quality')this._resize();}_teleport(){}setCameraView(){}enterExhibit(){}_updateCamera(){}cast(){}travel(){}dispose(){}
    _resize(){this._width=canvas.clientWidth;this._height=canvas.clientHeight;this._dpr=Math.min(nativeDpr,this.options.quality==='low'?1.25:2.5);this.renderer.setPixelRatio(this._dpr);this.renderer.setSize(this._width,this._height,false);this.rendering.resize(this._width,this._height,this._dpr);}
  }
  class Recorder {
    static isTypeSupported(){return true;}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'video/webm';this.state='inactive';this.stopCount=0;recorders.push(this);}
    start(){if(startError)throw new Error('capture unavailable');this.state='recording';}stop(){this.state='inactive';this.stopCount++;}
    async finish(data='video'){if(data)this.ondataavailable({data:new Blob([data])});this.state='inactive';await this.onstop();}
  }
  const context={document,window:{MediaRecorder:Recorder,addEventListener:(name,handler)=>{listeners[name]=handler;}},devicePixelRatio:nativeDpr,MediaRecorder:Recorder,Game,THREE:{Vector3:class{constructor(...values){this.values=values;}}},ReviewMetrics,evidenceFilename,
    loadLandscapeAssets:async()=>{},loadArchitectureAssets:async()=>{},loadCharacterAssets:async()=>{},performance:{now:()=>now},Blob,AbortSignal,setTimeout,
    URL:{createObjectURL:()=>`blob:${downloads.length}`,revokeObjectURL(){}},fetch:save||(async()=>({ok:true})),console:{error:error=>errors.push(error)}};
  const api=await vm.runInNewContext(`(async()=>{${source}\nreturn {begin,record,stop,updateSequence,reset,state:()=>({session,lastReport,metrics,game})};})()`,context,{filename:'quality-review.js'});
  assert.equal(errors.length,0);assert.equal(document.body.dataset.ready,'true');
  return {...api,elements,recorders,streams,downloads,listeners,document,canvas,lodChanges,at(value){now=value;},flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('audition acquires a lifecycle lock before awaiting audio and creates one local recorder',async()=>{
  const music=deferred(),qa=await fixture({musicPromise:music.promise});
  const first=qa.record('audition'),second=qa.record('audition');
  assert.equal(qa.state().session.phase,'preparing');assert.equal(qa.elements.get('record').disabled,true);assert.equal(qa.elements.get('foliage').disabled,true);
  assert.equal(await second,null);assert.equal(qa.recorders.length,0);
  music.resolve();await first;assert.equal(qa.recorders.length,1);assert.equal(qa.recorders[0].state,'recording');
  const stop=qa.stop('page-hidden');assert.equal(qa.state().session.phase,'finalizing');assert.equal(qa.begin('measure'),null);
  await qa.recorders[0].finish();const report=await stop;
  assert.equal(report.invalid,true);assert.equal(report.reason,'page-hidden');assert.equal(qa.streams[0].getTracks().every(track=>track.stopped),true);assert.equal(qa.state().session,null);
});

test('interruption during audio preparation cannot create a recorder after a newer run starts',async()=>{
  const music=deferred(),qa=await fixture({musicPromise:music.promise}),pending=qa.record('audition');
  const interrupted=await qa.stop('page-hidden');assert.equal(interrupted.invalid,true);assert.equal(interrupted.elapsedDurationMs,0);
  const next=qa.begin('measure');assert.equal(next.phase,'warming');music.resolve();await pending;
  assert.equal(qa.recorders.length,0);assert.equal(qa.state().session,next);await qa.stop('test-end');
});

test('recording retains its own chunks, original conditions and lock through asynchronous local saving',async()=>{
  const saving=deferred(),qa=await fixture({save:async()=>{await saving.promise;return {ok:true};}});
  await qa.record('record');qa.at(24000);const stopping=qa.stop('completed',true);
  qa.elements.get('view').value='shore';qa.elements.get('quality').value='low';const finished=qa.recorders[0].finish('first-session');
  await qa.flush();assert.equal(qa.state().session.phase,'finalizing');assert.equal(await qa.record('record'),null);assert.equal(qa.elements.get('reset').disabled,true);
  assert.match(qa.downloads[0].download,/test-build-court-night-high-lod-native-record-/);
  saving.resolve();await finished;const report=await stopping;
  assert.equal(report.view,'court');assert.equal(report.quality,'high');assert.equal(report.completed,true);assert.equal(report.elapsedDurationMs,24000);
  await qa.record('record');assert.equal(qa.recorders.length,2);assert.notEqual(qa.recorders[0].stream,qa.recorders[1].stream);
  const final=qa.stop('test-end');await qa.recorders[1].finish('second-session');await final;
});

test('fixed-view metrics exclude 3.5 seconds of warmup and sample a full 20 seconds',async()=>{
  const qa=await fixture();qa.begin('measure');qa.at(3499);qa.updateSequence();assert.equal(qa.state().metrics.active,false);assert.equal(qa.state().session.startedAt,null);
  qa.at(3500);qa.updateSequence();assert.equal(qa.state().metrics.active,true);assert.equal(qa.state().session.startedAt,3500);
  qa.at(23499);qa.updateSequence();assert.equal(qa.state().session.phase,'running');
  qa.at(23500);qa.updateSequence();await qa.state().session.stopPromise;
  const report=qa.state().lastReport;assert.equal(report.completed,true);assert.equal(report.invalid,false);assert.equal(report.elapsedDurationMs,20000);assert.equal(report.warmup.elapsedMs,3500);assert.equal(report.warmup.completed,true);
});

test('visibility interruption exports invalid/reason and elapsed duration in unique JSON evidence',async()=>{
  const qa=await fixture();qa.begin('measure');qa.at(3500);qa.updateSequence();qa.at(5000);qa.document.hidden=true;qa.listeners.visibilitychange();await qa.state().session.stopPromise;
  const report=qa.state().lastReport;assert.equal(report.invalid,true);assert.equal(report.completed,false);assert.equal(report.reason,'page-hidden');assert.equal(report.elapsedDurationMs,1500);assert.equal(report.expectedDurationMs,20000);
  qa.elements.get('json').onclick();qa.elements.get('json').onclick();assert.equal(qa.downloads.length,2);assert.notEqual(qa.downloads[0].download,qa.downloads[1].download);
});

test('visible foliage comparison switches only when idle and historical builds stay full geometry',async()=>{
  const qa=await fixture(),select=qa.elements.get('foliage');assert.equal(select.parentElement.tagName,'label');assert.equal(select.children.length,2);assert.equal(select.disabled,false);
  select.value='full';select.onchange();assert.equal(qa.lodChanges.at(-1),false);qa.begin('measure');const changes=qa.lodChanges.length;
  select.value='lod';select.onchange();assert.equal(select.disabled,true);assert.equal(qa.lodChanges.length,changes);assert.equal(qa.state().session.metadata.foliage,'full');await qa.stop('test-end');
  const historical=await fixture({lod:false});assert.equal(historical.elements.get('foliage').value,'full');assert.equal(historical.elements.get('foliage').disabled,true);
});

test('spontaneous recorder stop holds the lock until final chunks have been saved',async()=>{
  const saving=deferred(),qa=await fixture({save:async()=>{await saving.promise;return {ok:true};}});await qa.record('record');
  const finished=qa.recorders[0].finish();await qa.flush();assert.equal(qa.state().session.phase,'finalizing');assert.equal(qa.begin('measure'),null);
  const stopping=qa.state().session.stopPromise;saving.resolve();await finished;const report=await stopping;assert.equal(report.invalid,true);assert.equal(report.reason,'recorder-stopped-early');
});

test('asynchronous still encoding retains the conditions from the rendered capture',async()=>{
  const pending=[],qa=await fixture({capture:callback=>pending.push(callback)});qa.elements.get('frame').onclick();qa.state().game.rendering.render(1/60);
  qa.elements.get('view').value='shore';qa.elements.get('quality').value='low';qa.reset();pending[0](new Blob(['frame'],{type:'image/png'}));
  assert.match(qa.downloads[0].download,/test-build-court-night-high-lod-native-frame-/);
});

test('recorder start failure releases the local stream and exports an invalid reason',async()=>{
  const qa=await fixture({startError:true});assert.equal(await qa.record('record'),null);
  assert.equal(qa.state().session,null);assert.equal(qa.state().lastReport.invalid,true);assert.match(qa.state().lastReport.reason,/recording-start-failed: capture unavailable/);
  assert.equal(qa.streams[0].getTracks().every(track=>track.stopped),true);assert.equal(qa.elements.get('record').disabled,false);
});

test('diagnostic views preserve original poses and apply requested close-up camera coordinates',async()=>{
  const qa=await fixture(),views=qa.elements.get('view');
  const expected={court:[[30,27,79],[0,10,28]],overview:[[130,162,180],[-2,12,-4]],bridge:[[-27,26,-23],[-65,5,-53]],shore:[[93,4,115],[45,2,73]],
    'castle-footing':[[39,16,-8],[27,9,-24]],'contact-bridge':[[59,15,-23],[52,3,-42]],'shore-detail':[[111,6,16],[99,-2,2]]};
  for(const [view,[eye,target]] of Object.entries(expected)){
    views.value=view;views.onchange();qa.state().game._updateCamera();
    assert.deepEqual(qa.state().game.camera.position.toArray(),eye,view);assert.deepEqual(qa.state().game.camera.target,target,view);assert.equal(qa.state().game.camera.fov,43);
  }
  for(const view of ['castle-footing','contact-bridge','shore-detail'])assert.ok(views.children.some(option=>option.value===view));
});

test('QA sampling explicitly synchronizes renderer and composer and Native restores the existing policy',async()=>{
  const qa=await fixture(),select=qa.elements.get('sampling'),game=qa.state().game;
  assert.equal(select.value,'native');assert.equal(select.disabled,false);assert.equal(game.renderer.getPixelRatio(),1.25);assert.equal(qa.canvas.width,1280);assert.equal(qa.canvas.height,720);
  select.value='2x';select.onchange();assert.equal(game.renderer.getPixelRatio(),2);assert.equal(game.rendering.lastSize.dpr,2);assert.equal(qa.canvas.width,2048);assert.equal(qa.canvas.height,1152);
  select.value='2.5x';select.onchange();assert.equal(game.renderer.getPixelRatio(),2.5);assert.equal(game.rendering.lastSize.dpr,2.5);assert.equal(qa.canvas.width,2560);assert.equal(qa.canvas.height,1440);
  qa.canvas.clientWidth=800;qa.canvas.clientHeight=450;game._resize();assert.equal(game.renderer.getPixelRatio(),2.5);assert.equal(game.rendering.lastSize.dpr,2.5);assert.equal(qa.canvas.width,2000);assert.equal(qa.canvas.height,1125);
  select.value='native';select.onchange();assert.equal(game.renderer.getPixelRatio(),1.25);assert.equal(game.rendering.lastSize.dpr,1.25);assert.equal(qa.canvas.width,1000);assert.equal(qa.canvas.height,562);
  assert.match(qa.elements.get('sampling-size').textContent,/800 × 450 CSS → 1000 × 562 px · DPR 1.25/);
});

test('sampling is locked throughout a run and exported with actual CSS, backing size, DPR and filenames',async()=>{
  const qa=await fixture(),select=qa.elements.get('sampling'),game=qa.state().game;select.value='2.5x';select.onchange();
  qa.begin('measure');assert.equal(select.disabled,true);select.value='native';select.onchange();game._resize();assert.equal(game.renderer.getPixelRatio(),2.5);
  qa.at(3500);qa.updateSequence();qa.at(23500);qa.updateSequence();await qa.state().session.stopPromise;
  const report=qa.state().lastReport;assert.equal(report.sampling,'2.5x');assert.equal(report.canvas.cssWidth,1024);assert.equal(report.canvas.cssHeight,576);assert.equal(report.canvas.backingWidth,2560);assert.equal(report.canvas.backingHeight,1440);assert.equal(report.canvas.dpr,2.5);assert.equal(report.canvas.nativeDpr,1.25);
  qa.elements.get('json').onclick();assert.match(qa.downloads[0].download,/high-lod-2-5x-metrics-/);
});

test('static comparison defaults off, applies reducedMotion explicitly and retains the run snapshot',async()=>{
  const qa=await fixture(),checkbox=qa.elements.get('reduced-motion'),game=qa.state().game;
  assert.equal(checkbox.type,'checkbox');assert.equal(checkbox.checked,false);assert.equal(checkbox.disabled,false);assert.equal(game.options.reducedMotion,false);
  qa.begin('measure');assert.equal(qa.state().session.metadata.reducedMotion,false);assert.equal(checkbox.disabled,true);await qa.stop('test-default');assert.equal(qa.state().lastReport.reducedMotion,false);
  checkbox.checked=true;checkbox.onchange();assert.equal(game.options.reducedMotion,true);qa.begin('measure');
  checkbox.checked=false;checkbox.onchange();assert.equal(game.options.reducedMotion,true);assert.equal(checkbox.disabled,true);
  const finishing=qa.stop('page-hidden');assert.equal(checkbox.disabled,true);const report=await finishing;assert.equal(report.reducedMotion,true);assert.equal(report.invalid,true);assert.equal(checkbox.disabled,false);
  checkbox.onchange();assert.equal(game.options.reducedMotion,false);
});
