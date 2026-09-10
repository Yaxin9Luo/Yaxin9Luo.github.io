import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ReviewMetrics,evidenceFilename} from '../src/review-metrics.js';
import {LIGHTING_REVIEW_VARIANTS,sampleEnvironment,TIME_PHASES} from '../src/environment-time.js';

const source=(await readFile(new URL('../src/quality-review.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,'').replaceAll('import.meta.env.DEV','true');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

async function fixture({musicPromise=null,lod=true,save=null,capture=null,startError=false,nativeDpr=1.25,query="",deferFull=false,degraded=false}={}){
  let now=0;const elements=new Map(),recorders=[],streams=[],downloads=[],listeners={},lodChanges=[],errors=[];
  class Element {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.disabled=true;this.value='';this.dataset={};}
    set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
    append(...children){this.children.push(...children);for(const child of children)if(typeof child==='object')child.parentElement=this;}
    insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);child.parentElement=this;}
    click(){if(this.tagName==='a')downloads.push(this);}
  }
  for(const id of ['view','light','quality','reset','measure','record','frame','sound','audition','json','status','metrics','media','loading','latest-load','load-times']){const element=new Element();element.id=id;}
  elements.get('view').value='court';elements.get('light').value='night';elements.get('quality').value='high';
  const controls=new Element();controls.append(elements.get('reset'));
  const track=kind=>({kind,stopped:false,stop(){this.stopped=true;}});
  const canvas={width:1024,height:576,clientWidth:1024,clientHeight:576,captureStream(){const tracks=[track('video')],stream={getTracks:()=>tracks,addTrack:next=>tracks.push(next)};streams.push(stream);return stream;},toBlob(callback){if(capture)capture(callback);else callback(new Blob(['png'],{type:'image/png'}));}};
  const document={getElementById:id=>elements.get(id),querySelector:()=>canvas,createElement:tag=>new Element(tag),documentElement:{dataset:{build:'test-build'}},body:{dataset:{}},hidden:false,addEventListener:(name,handler)=>{listeners[name]=handler;}};
  class Game {
    static async createAsync(canvas,callbacks,options,context){const game=new Game();game.progress=context.onProgress;context.onProgress({phase:"first-frame"});return game;}
    constructor(){
      this.options={sound:false,quality:'high'};this.environmentClock={setMode:(mode,immediate)=>{this.clockMode=mode;this.clockImmediate=immediate;},setLightingReviewVariant:id=>{this.clockVariant=id;}};this.world={complete:true,heightAt:()=>7,vegetation:{lod:{nearCount:3,midCount:4,farCount:5},...(lod?{lodController:{setEnabled:value=>lodChanges.push(value)}}:{})},updateVegetation(){}};
      let pixelRatio=nativeDpr;
      this.renderer={shadowMap:{},getPixelRatio:()=>pixelRatio,setPixelRatio:value=>{pixelRatio=value;},setSize(width,height){canvas.width=Math.floor(width*pixelRatio);canvas.height=Math.floor(height*pixelRatio);},getContext:()=>({getExtension:()=>null}),info:{render:{calls:50,triangles:1000},memory:{geometries:2,textures:2}}};
      this.camera={position:{values:[1,2,3],toArray(){return [...this.values];},fromArray(values){this.values=[...values];}},fov:43,lookAt:vector=>{this.camera.target=[...vector.values];},updateProjectionMatrix(){},updateMatrixWorld(){}};
      this.rendering={render(){},resize(width,height,dpr){this.lastSize={width,height,dpr};}};this.exhibitionStage={loadedSource:'image.webp',materialErrors:[]};
      this.audio={_musicPromise:musicPromise,unlock(){},play(){},setEnvironment(){},context:{createMediaStreamDestination(){const tracks=[track('audio')];return {stream:{getAudioTracks:()=>tracks}};}},master:{connected:new Set(),connect(output){this.connected.add(output);},disconnect(output){assert.equal(this.connected.delete(output),true);}}};
    }
    _updateEnvironment(){this.environment=sampleEnvironment(TIME_PHASES[this.clockMode],{lightingVariant:this.clockVariant});}setTouch(){}setControl(){}leaveExhibit(){}returnHome(){}start(){}setOption(key,value){this.options[key]=value;if(key==='quality')this._resize();}_teleport(){}setCameraView(){}enterExhibit(){}_updateCamera(){}cast(){}travel(){}dispose(){}
    _resize(){this._width=canvas.clientWidth;this._height=canvas.clientHeight;this._dpr=Math.min(nativeDpr,this.options.quality==='low'?1.25:2.5);this.renderer.setPixelRatio(this._dpr);this.renderer.setSize(this._width,this._height,false);this.rendering.resize(this._width,this._height,this._dpr);}
  }
  class Recorder {
    static isTypeSupported(){return true;}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'video/webm';this.state='inactive';this.stopCount=0;recorders.push(this);}
    start(){if(startError)throw new Error('capture unavailable');this.state='recording';}stop(){this.state='inactive';this.stopCount++;}
    async finish(data='video'){if(data)this.ondataavailable({data:new Blob([data])});this.state='inactive';await this.onstop();}
  }
  const context={document,window:{MediaRecorder:Recorder,addEventListener:(name,handler)=>{listeners[name]=handler;}},devicePixelRatio:nativeDpr,MediaRecorder:Recorder,Game,THREE:{Vector3:class{constructor(...values){this.values=values;}}},ReviewMetrics,evidenceFilename,LIGHTING_REVIEW_VARIANTS,
    location:{search:query},URLSearchParams,AbortController,resourceLoader:{subscribe:()=>()=>{},diagnostics:()=>[]},
    loadBotanicalAssets:async()=>{},loadLandscapeAssets:async()=>{},loadArchitectureAssets:async()=>{},loadCharacterAssets:async()=>{},performance:{now:()=>now},Blob,AbortSignal,setTimeout,
    URL:{createObjectURL:()=>`blob:${downloads.length}`,revokeObjectURL(){}},fetch:save||(async()=>({ok:true})),console:{error:error=>errors.push(error)}};
  const api=await vm.runInNewContext(`(async()=>{${source}\nreturn {begin,record,stop,updateSequence,reset,state:()=>({session,lastReport,metrics,game})};})()`,context,{filename:'quality-review.js'});
  assert.equal(errors.length,0,errors[0]?.stack);if(!deferFull){api.state().game.progress({phase:'enhancements',enhancements:degraded?'degraded':'ready'});api.state().game.progress({phase:'full-frame',enhancements:degraded?'degraded':'ready'});}assert.equal(document.body.dataset.ready,deferFull?'core':degraded?'degraded':'true');
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

test('lighting study selects an explicit variant, starts with full native static controls and restores baseline',async()=>{
  const qa=await fixture({query:'?light=day&lighting=pearl-fill'}),select=qa.elements.get('lighting-variant');assert.ok(select);assert.equal(select.value,'pearl-fill');assert.equal(qa.state().game.environment.lightingVariant,'pearl-fill');assert.equal(qa.elements.get('reduced-motion').checked,true);assert.equal(qa.elements.get('foliage').value,'full');assert.equal(qa.elements.get('sampling').value,'native');
  select.value='baseline';select.onchange();assert.equal(qa.state().game.environment.lightingVariant,'baseline');assert.equal(qa.state().game.environment.fillIntensity,.6);qa.begin('measure');assert.equal(select.disabled,true);assert.equal(qa.state().session.metadata.lightingVariant,'baseline');await qa.stop('test-end');
});

test('lighting still name and paired JSON retain the rendered trial and exact light state',async()=>{
  const pending=[],saves=[],qa=await fixture({query:'?light=day&lighting=pearl-fill',capture:callback=>pending.push(callback),save:async(url,options)=>{saves.push({url,options});return{ok:true};}});
  // A diagnostic light mutation must appear in evidence instead of its old palette input.
  qa.state().game.fillLight={color:{toArray:()=>[.81,.72,.63]},intensity:.61,position:{toArray:()=>[60,80,100]}};
  qa.elements.get('frame').onclick();qa.state().game.rendering.render(1/60);qa.elements.get('lighting-variant').value='baseline';qa.reset();pending[0](new Blob(['frame'],{type:'image/png'}));await qa.flush();await qa.flush();
  assert.match(saves[0].url,/lighting-pearl-fill-/);const metadata=JSON.parse(await saves.find(r=>r.url.endsWith('.json')).options.body.text());assert.equal(metadata.lightingVariant,'pearl-fill');assert.equal(metadata.lighting.variant,'pearl-fill');assert.ok(Math.abs(metadata.lighting.phase-TIME_PHASES.day)<1e-12);assert.equal(metadata.lighting.fill.intensity,.61);assert.deepEqual(metadata.lighting.fill.colorLinear,[.81,.72,.63]);assert.equal(metadata.reducedMotion,true);assert.equal(metadata.foliage,'full');
});

test('a lighting frame finishing PNG encoding after page exit publishes no stale files',async()=>{
  const pending=[],qa=await fixture({query:'?light=day&lighting=pearl-fill',capture:callback=>pending.push(callback)});qa.elements.get('frame').onclick();qa.state().game.rendering.render(1/60);qa.listeners.pagehide();pending[0](new Blob(['frame'],{type:'image/png'}));await qa.flush();assert.equal(qa.downloads.length,0);
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

 test('fixed review lighting settles immediately and boundary views expose real bounded cameras',async()=>{
  const qa=await fixture(),game=qa.state().game;
  qa.elements.get('light').value='dusk';qa.elements.get('light').onchange();
  assert.equal(game.clockMode,'dusk');assert.equal(game.clockImmediate,true);
  for(const view of ['west-edge','east-edge','high-flight']){
    qa.elements.get('view').value=view;qa.elements.get('view').onchange();game._updateCamera();
    const [x,y,z]=game.camera.position.toArray();assert.ok(Math.abs(x)<170&&Math.abs(z)<158&&y<=130);
    if(view==='high-flight')assert.equal(y,125);
  }
});

 test('query controls apply before captures and full-frame gate excludes core or failed enhancements',async()=>{
  const qa=await fixture({query:'?view=conservatory&light=day',deferFull:true});
  assert.equal(qa.elements.get('view').value,'conservatory');assert.equal(qa.elements.get('light').value,'day');
  assert.equal(qa.elements.get('measure').disabled,true);assert.equal(qa.begin('measure'),null);
  qa.state().game.progress({phase:'enhancements',enhancements:'ready'});assert.equal(qa.elements.get('measure').disabled,true);
  qa.state().game.progress({phase:'full-frame',enhancements:'ready'});assert.equal(qa.elements.get('measure').disabled,false);
  const failed=await fixture({degraded:true});assert.equal(failed.elements.get('measure').disabled,true);assert.match(failed.elements.get('status').textContent,/degraded/i);
  const invalid=await fixture({query:'?view=bad&light=bad'});assert.equal(invalid.elements.get('view').value,'court');assert.equal(invalid.elements.get('light').value,'night');
});

test('actual renderer error events keep a later full-frame from claiming successful readiness',async()=>{
  const qa=await fixture({deferFull:true});qa.state().game.progress({phase:'render-error',activeResource:'fragment shader compile failure'});qa.state().game.progress({phase:'full-frame',enhancements:'ready'});
  assert.equal(qa.document.body.dataset.ready,'degraded');assert.equal(qa.elements.get('measure').disabled,true);assert.equal(qa.begin('measure'),null);
});

test('herbarium review cameras clear the reset rider and workshop and expose an interior aisle',async()=>{
  const qa=await fixture(),views=qa.elements.get('view'),game=qa.state().game;
  views.value='arrival';views.onchange();game._updateCamera();const arrival=game.camera.position.toArray();
  assert.ok(Math.hypot(arrival[0]-18,arrival[1]-18,arrival[2]-74)>10,'arrival cannot sit inside the reset rider');
  views.value='conservatory';views.onchange();game._updateCamera();const entry=game.camera.position.toArray();
  assert.ok(entry[0]<55.5,'entry camera views from the open west side of the workshop footprint');
  assert.ok(views.children.some(option=>option.value==='conservatory-interior'));
  views.value='conservatory-interior';views.onchange();game._updateCamera();const interior=game.camera.position.toArray();
  assert.ok(interior[0]>53.9&&interior[0]<56.1&&interior[1]>8&&interior[1]<10.3&&interior[2]>17.5&&interior[2]<26.5,'interior eye is inside the clear central aisle');
  views.value='arcade-passage';views.onchange();game._updateCamera();assert.equal(game.camera.position.toArray()[1],8.7,'arcade eye follows actual support plus 1.7 m');
});

test('shader failure invalidates an active measurement and keeps capture controls locked',async()=>{
  const qa=await fixture();qa.begin('measure');qa.at(3500);qa.updateSequence();qa.at(5100);
  qa.state().game.progress({phase:'render-error',activeResource:'bad fragment program'});await qa.flush();
  const report=qa.state().lastReport;assert.ok(report,'failed active run must finalize');assert.equal(report.invalid,true);assert.equal(report.completed,false);assert.match(report.reason,/render-error.*bad fragment program/);
  assert.equal(qa.document.body.dataset.ready,'degraded');assert.equal(qa.elements.get('measure').disabled,true);assert.equal(qa.elements.get('frame').disabled,true);assert.equal(qa.begin('measure'),null);
  assert.equal(qa.elements.get('json').disabled,false,'invalid diagnostics remain exportable');
});

test('shader failure stops recording once and releases tracks, audio tap and recorder listeners',async()=>{
  const qa=await fixture();await qa.record('audition');const recorder=qa.recorders[0],game=qa.state().game;
  game.progress({phase:'render-error',activeResource:'bad glazing program'});await qa.flush();
  assert.equal(recorder.stopCount,1);assert.equal(qa.state().session.phase,'finalizing');
  const stopping=qa.state().session.stopPromise;await recorder.finish('partial-invalid-video');const report=await stopping;
  assert.equal(report.invalid,true);assert.equal(report.completed,false);assert.match(report.reason,/render-error/);assert.equal(qa.streams[0].getTracks().every(t=>t.stopped),true);assert.equal(game.audio.master.connected.size,0);
  assert.equal(recorder.ondataavailable,null);assert.equal(recorder.onerror,null);assert.equal(recorder.onstop,null);assert.equal(qa.elements.get('record').disabled,true);
  assert.match(qa.downloads[0].download,/-audition-inv-/);
});
