import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import * as THREE from 'three';
import {ReviewMetrics,evidenceFilename} from '../src/review-metrics.js';
import {LIGHTING_REVIEW_VARIANTS,sampleEnvironment,TIME_PHASES} from '../src/environment-time.js';
import {herbariumSites} from '../src/herbarium-layout.js';
import {createBuildingColliders,shortenCameraBoom} from '../src/collision.js';
import {createReviewLoading,REVIEW_ENHANCEMENT_BUDGET_MS} from '../src/review-loading.js';
import {createCompanionSystem} from '../src/companion-system.js';
import {loadAcceptedCompanions} from './helpers/companion-runtime.js';
import {Game as RuntimeGame} from '../src/game.js';
import {createGroundChromaStudy} from '../src/ground-chroma-review.js';
import {setRootedLoamStrength,getRootedLoamState} from '../src/rooted-loam.js';
import {groundMaterial} from '../src/landscape.js';
import {reviewCapturePlugin} from '../review-capture-plugin.js';
import {submitReviewFramebufferReadback,reviewFrameGuard} from '../src/review-frame-readback.js';
import {snapshotReviewPresentation,encodeReviewFramePixels} from '../src/review-frame-presentation.js';
import {createReviewFrameFixture} from './helpers/review-frame.js';
import {createHash} from 'node:crypto';

const source=(await readFile(new URL('../src/quality-review.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,'').replaceAll('import.meta.env.DEV','DEV');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

async function fixture({ground=false,compileGround=false,dev=true,musicPromise=null,audioState='running',audioTracks=true,companionsReady=true,lod=true,groves=lod,save=null,capture=null,startError=false,renderError=false,hideDuringCore=false,nativeDpr=1.25,width=16,height=9,query="",deferFull=false,degraded=false}={}){
  let now=0,nextFrame=1,nextTimer=1,unsubscribed=0,gameCreations=0;const frames=new Map(),timers=new Map(),elements=new Map(),recorders=[],streams=[],downloads=[],listeners={},lodChanges=[],groveLodChanges=[],errors=[],resets=[];
  const eventHandlers=new Map(),listen=(name,handler)=>{if(!eventHandlers.has(name))eventHandlers.set(name,new Set());eventHandlers.get(name).add(handler);listeners[name]=(...args)=>{for(const callback of [...eventHandlers.get(name)])callback(...args);};};
  const schedule=callback=>{const id=nextFrame++;frames.set(id,callback);return id;},cancel=id=>frames.delete(id);
  class Element {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.disabled=true;this.value='';this.dataset={};}
    set id(value){this._id=value;elements.set(value,this);}get id(){return this._id;}
    append(...children){this.children.push(...children);for(const child of children)if(typeof child==='object')child.parentElement=this;}
    insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);child.parentElement=this;}
    click(){if(this.tagName==='a')downloads.push(this);}
  }
  for(const id of ['view','light','quality','reset','measure','record','frame','sound','audition','json','status','metrics','media','loading','loading-policy','latest-load','load-times','capture-progress','capture-cancel']){const element=new Element();element.id=id;}
  elements.get('view').value='court';elements.get('light').value='night';elements.get('quality').value='high';
  const controls=new Element();controls.append(elements.get('reset'));
  const track=kind=>({kind,stopped:false,stop(){this.stopped=true;}});
  const canvas={width,height,clientWidth:width,clientHeight:height,addEventListener:listen,removeEventListener:(name,handler)=>eventHandlers.get(name)?.delete(handler),captureStream(){const tracks=[track('video')],stream={getTracks:()=>tracks,addTrack:next=>tracks.push(next)};streams.push(stream);return stream;},toBlob(){throw new Error('WebGL canvas snapshots are forbidden');}};
  const document={getElementById:id=>elements.get(id),querySelector:()=>canvas,createElement:tag=>new Element(tag),documentElement:{dataset:{build:'test-build'}},body:{dataset:{}},hidden:false,addEventListener:listen};
  const pixels=createReviewFrameFixture(canvas,document,{capture}),encodings=[];
  class Game {
    static async createAsync(canvas,callbacks,options,context){gameCreations++;const game=new Game();game.callbacks=callbacks;game.constructionContext=context;game._reviewRendering=context.reviewDemandRendering?{pending:true,staticComparison:false,continuous:false,lastView:null,idle:false}:null;game.progress=context.onProgress;context.onProgress({phase:"first-frame"});if(hideDuringCore)listeners.pagehide();return game;}
    constructor(){
      this.scene=new THREE.Scene();if(ground){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4,4),groundMaterial());mesh.name='qa-ground';this.scene.add(mesh);}
      this._enhancementController=new AbortController();this._lastFrame=123;this._frameCount=0;this.draws=0;this._tick=()=>{if(this._disposed)return;this._animation=schedule(this._tick);this._updateCamera(0);RuntimeGame.prototype._renderFrame.call(this,0);};this._animation=schedule(this._tick);
      this.options={sound:false,quality:'high'};this.environmentClock={setMode:(mode,immediate)=>{this.clockMode=mode;this.clockImmediate=immediate;},setLightingReviewVariant:id=>{this.clockVariant=id;}};this.world={complete:true,heightAt:()=>7,vegetation:{lod:{nearCount:3,midCount:4,farCount:5},...(lod?{lodController:{setEnabled:value=>lodChanges.push(value)}}:{})},updateVegetation(){}};
      if(groves)this.world.blossomGroves={foliage:{setEnabled:value=>groveLodChanges.push(value)}};
      let pixelRatio=nativeDpr;
      this.renderer={shadowMap:{},getPixelRatio:()=>pixelRatio,setPixelRatio:value=>{pixelRatio=value;},setSize(width,height){canvas.width=Math.floor(width*pixelRatio);canvas.height=Math.floor(height*pixelRatio);},getContext:()=>pixels.gl,info:{reset(){},render:{calls:50,triangles:1000},memory:{geometries:2,textures:2}}};
      this.camera=new THREE.PerspectiveCamera(43,16/9,.1,3600);this.camera.position.set(1,2,3);const lookAt=this.camera.lookAt.bind(this.camera);this.camera.lookAt=vector=>{this.camera.target=vector.toArray();lookAt(vector);};
      this.rendering={render:()=>{this.draws++;if(compileGround)this.scene.traverse(mesh=>{const material=mesh.material;if(material?.userData.plantingCommunity&&material.version!==material.qaVersion){material.qaShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(material.qaShader);material.qaVersion=material.version;}});this.duringRender?.();if(renderError)throw new Error('actual composer failed');},resize(width,height,dpr){this.lastSize={width,height,dpr};}};this.exhibitionStage={loadedSource:'image.webp',materialErrors:[]};
      this.companionState={installation:{status:companionsReady?'ready':'loading'},owner:'qa-controller',paused:false,reducedMotion:false,activeTime:0,actors:['elizabeth','sadaharu'].map((id,i)=>({id,kind:id,valid:true,position:{x:-13,y:6.171,z:44-i*6},heading:0,distance:0,interactionCount:0,state:'rest',busy:false,completedInteraction:null})),audio:{played:0,recentEvents:[]}};this.companionInteractions=[];this.audio={enabled:false,unlocked:false,suspended:false,_musicPromise:musicPromise,unlock(){this.unlocked=true;},play(){},setEnvironment(){},context:{state:audioState,createMediaStreamDestination(){const tracks=audioTracks?[track('audio')]:[];return {stream:{getAudioTracks:()=>tracks}};}},master:{connected:new Set(),connect(output){this.connected.add(output);},disconnect(output){assert.equal(this.connected.delete(output),true);}}};
    }
    _updateEnvironment(){this.environment=sampleEnvironment(this.clockMode==='auto'?this.environmentClock.phase:TIME_PHASES[this.clockMode],{lightingVariant:this.clockVariant});}setTouch(){}setControl(){}leaveExhibit(){}returnHome(){resets.push({view:elements.get('view').value,light:elements.get('light').value});}start(){}herbariumNormalSnapshot(){return {selection:null,source:{status:'unselected'},restoreFailure:null};}companionSnapshot(){return this.companionState;}setPaused(value){this.paused=value;this.companionState.paused=value;this.callbacks.onFrame?.({companions:this.companionSnapshot()});}_avoidBuildings(){}_updateInteractions(){}interact({companionId}){this.companionInteractions.push(companionId);const accepted=!this.paused&&this.allowCompanionInteraction!==false;if(accepted){const actor=this.companionState.actors.find(a=>a.id===companionId);actor.interactionCount++;actor.busy=true;actor.state='face';}this.callbacks.onFrame?.({companions:this.companionSnapshot()});return accepted;}setOption(key,value){this.options[key]=value;if(key==='sound')this.audio.enabled=value;if(key==='quality')this._resize();}_teleport(){}setCameraView(){}enterExhibit(){}_updateCamera(){}cast(){}travel(){}dispose(){this._disposed=true;cancel(this._animation);}
    _resize(){this._width=canvas.clientWidth;this._height=canvas.clientHeight;this._dpr=Math.min(nativeDpr,this.options.quality==='low'?1.25:2.5);this.renderer.setPixelRatio(this._dpr);this.renderer.setSize(this._width,this._height,false);this.rendering.resize(this._width,this._height,this._dpr);}
    setReviewRendering(...args){return RuntimeGame.prototype.setReviewRendering.call(this,...args);}
    requestRender(){return RuntimeGame.prototype.requestRender.call(this);}
    reviewRenderingSnapshot(){return RuntimeGame.prototype.reviewRenderingSnapshot.call(this);}
    _isPaused(){return Boolean(this.paused);}
  }
  class Recorder {
    static isTypeSupported(){return true;}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'video/webm';this.state='inactive';this.stopCount=0;recorders.push(this);}
    start(){if(startError)throw new Error('capture unavailable');this.state='recording';}stop(){this.state='inactive';this.stopCount++;}
    async finish(data='video'){if(data)this.ondataavailable({data:new Blob([data])});this.state='inactive';await this.onstop();}
  }
  const context={document,window:{MediaRecorder:Recorder,addEventListener:listen},devicePixelRatio:nativeDpr,MediaRecorder:Recorder,Game,THREE,createGroundChromaStudy,setRootedLoamStrength,getRootedLoamState,reviewFrameGuard,snapshotReviewPresentation,
    submitReviewFramebufferReadback:options=>submitReviewFramebufferReadback({...options,now:()=>now,schedule:pixels.schedule,cancelSchedule:pixels.cancelSchedule}),
    encodeReviewFramePixels:(frame,options)=>{const state={preparing:true};encodings.push(state);return encodeReviewFramePixels(frame,{...options,createCanvas:()=>{state.preparing=false;return pixels.createCanvas();}}).finally(()=>{state.preparing=false;});},ReviewMetrics,evidenceFilename,LIGHTING_REVIEW_VARIANTS,
    createReviewLoading:options=>createReviewLoading({...options,now:()=>now,schedule,cancel,setTimer:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,at:now+ms});return id;},clearTimer:id=>timers.delete(id)}),REVIEW_ENHANCEMENT_BUDGET_MS,
    location:{search:query},URLSearchParams,AbortController,DOMException,DEV:dev,crypto,resourceLoader:{subscribe:()=>()=>{unsubscribed++;},diagnostics:()=>[]},
    loadBotanicalAssets:async()=>{},loadLandscapeAssets:async()=>{},loadArchitectureAssets:async()=>{},loadCharacterAssets:async()=>{},performance:{now:()=>now},Blob,AbortSignal,setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),
    URL:{createObjectURL:()=>`blob:${downloads.length}`,revokeObjectURL(){}},fetch:save||(async()=>({ok:true})),console:{error:error=>errors.push(error)}};
  const api=await vm.runInNewContext(`(async()=>{${source}\nreturn {begin,record,stop,updateSequence,reset,requestReviewFrame,state:()=>({session,lastReport,metrics,game,saveFrame,groundStudy,captureSequence:typeof captureSequence==='undefined'?null:captureSequence})};})()`,context,{filename:'quality-review.js'});
  assert.equal(errors.length,0,errors[0]?.stack);if(!deferFull){api.state().game.progress({phase:'enhancements',enhancements:degraded?'degraded':'ready'});api.state().game.progress({phase:'full-frame',enhancements:degraded?'degraded':'ready'});}assert.equal(document.body.dataset.ready,deferFull?'core':degraded||!companionsReady?'degraded':'true');
  return {...api,pixels,elements,recorders,streams,downloads,listeners,document,canvas,lodChanges,groveLodChanges,frames,timers,resets,get gameCreations(){return gameCreations;},get unsubscribed(){return unsubscribed;},runFrame(){const [id,fn]=frames.entries().next().value;frames.delete(id);fn(now);},at(value){now=value;},flush:async()=>{const deadline=performance.now()+1000;for(let pass=0;pass<8||encodings.some(state=>state.preparing);pass++){assert.ok(performance.now()<deadline,'tiny asynchronous hashes did not reach the PNG boundary');pixels.poll();await new Promise(resolve=>setImmediate(resolve));}}};
}

const captureQuery='?loading=progressive&lighting=solar-120-cloud70&capture=ground-pairs-v1';
const captureSaves=()=>{const writes=[];return {writes,save:async(url,options)=>{writes.push({url,options});return {ok:true};}};};
const imageWrites=writes=>writes.filter(write=>write.url.endsWith('.png'));
const frameWrites=writes=>writes.filter(write=>write.url.endsWith('.json')&&!write.url.includes('-progress-'));
async function pumpCapture(qa,limit=30){for(let i=0;i<limit&&!qa.state().captureSequence?.finished;i++){qa.runFrame();await qa.flush();}return qa.state().captureSequence;}

test('integrated still copies the actual drawing revision into a PBO before yielding and saves its declared reference bytes',async()=>{
  const evidence=captureSaves(),qa=await fixture({width:2,height:2,nativeDpr:1,query:'?lighting=solar-120-cloud70',save:evidence.save}),game=qa.state().game;
  qa.runFrame();qa.elements.get('frame').onclick();const revision=qa.state().saveFrame.revision,before=game.reviewRenderingSnapshot().drawnRevision;
  let submitted;qa.pixels.gl.onRead=()=>submitted=game.reviewRenderingSnapshot();qa.runFrame();
  assert.equal(submitted.drawingRevision,revision);assert.equal(submitted.drawnRevision,before);assert.equal(game.reviewRenderingSnapshot().drawnRevision,revision);
  assert.equal(qa.pixels.calls.includes('getBufferSubData'),false);assert.equal(qa.pixels.encoders.length,0);assert.equal(evidence.writes.length,0);
  assert.equal(qa.pixels.gl.getParameter(qa.pixels.gl.PIXEL_PACK_BUFFER_BINDING),qa.pixels.borrowed);
  qa.pixels.gl.framebuffer=new Uint8Array(16).fill(99);game.requestRender();qa.runFrame();await qa.flush();
  const metadata=JSON.parse(await frameWrites(evidence.writes)[0].options.body.text()),pixel=metadata.pixelEvidence;
  const raw=new Uint8Array([7,8,9,0,40,50,60,255,220,50,30,128,1,2,3,255]);
  const reference=new Uint8Array([38,56,66,255,40,50,60,255,235,74,58,255,1,2,3,255]);
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(pixel.readback.rgbaTopLeftSHA256,sha(raw));assert.equal(pixel.presentation.rgbaTopLeftSHA256,sha(reference));assert.notEqual(pixel.readback.rgbaTopLeftSHA256,pixel.presentation.rgbaTopLeftSHA256);
  assert.deepEqual(new Uint8Array(qa.pixels.encoders[0].pixels),reference);assert.equal(pixel.readback.framebuffer,'default');assert.equal(pixel.readback.submittedBeforeYield,true);assert.equal(pixel.readback.rowOrder,'top-left');
  assert.equal(pixel.presentation.nativeDisplayPixelEqualityClaimed,false);assert.equal(pixel.presentation.interpretation,'defined-srgb-reference-composite');assert.deepEqual(pixel.presentation.backdropRGBA,[31,48,57,255]);
  assert.equal(metadata.renderRequest.drawnRevision,revision);assert.deepEqual(metadata.herbariumNormal,game.herbariumNormalSnapshot());
  assert.equal(qa.pixels.deletedBuffers.length,1);assert.equal(qa.pixels.deletedSyncs.length,1);assert.equal(qa.pixels.encoders[0].width,0);assert.equal(qa.pixels.encoders[0].height,0);
  assert.equal(imageWrites(evidence.writes).length,1);assert.equal(frameWrites(evidence.writes).length,1);assert.equal(qa.downloads.length,2);qa.listeners.pagehide();await qa.flush();
});

test('integrated manual PBO keeps a pinned presentation through same-size view and light resets at native and 2.5x sampling',async()=>{
  for(const sampling of ['native','2.5x']){
    const evidence=captureSaves(),qa=await fixture({query:'?lighting=solar-120-cloud70',save:evidence.save});
    qa.elements.get('sampling').value=sampling;qa.elements.get('sampling').onchange();qa.elements.get('frame').onclick();qa.runFrame();
    const captured=[qa.canvas.width,qa.canvas.height];qa.pixels.gl.wait=qa.pixels.gl.TIMEOUT_EXPIRED;
    qa.elements.get('view').value='shore';qa.elements.get('light').value='day';qa.reset();qa.runFrame();await qa.flush();assert.equal(evidence.writes.length,0);
    qa.pixels.styles.get(qa.pixels.viewport).backgroundColor='rgb(90, 80, 70)';qa.pixels.gl.wait=qa.pixels.gl.CONDITION_SATISFIED;await qa.flush();
    const metadata=JSON.parse(await frameWrites(evidence.writes)[0].options.body.text());
    assert.equal(metadata.view,'court');assert.equal(metadata.timeOfDay,'night');assert.equal(metadata.sampling,sampling);assert.deepEqual([metadata.canvas.width,metadata.canvas.height],captured);assert.deepEqual(metadata.pixelEvidence.presentation.backdropRGBA,[31,48,57,255]);
    qa.listeners.pagehide();await qa.flush();
  }
});

test('integrated automatic captures reject CSS or actual context presentation drift while encoding',async()=>{
  for(const kind of ['backdrop','effect','context']){
    const pending=[],evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,capture:callback=>pending.push(callback),save:evidence.save});
    qa.runFrame();await qa.flush();assert.equal(pending.length,1);
    if(kind==='backdrop')qa.pixels.styles.get(qa.pixels.viewport).backgroundColor='rgb(32, 48, 57)';
    else if(kind==='effect')qa.pixels.styles.get(qa.canvas).opacity='.5';
    else qa.pixels.gl.attributes.premultipliedAlpha=false;
    pending[0](new Blob(['png'],{type:'image/png'}));await qa.flush();
    assert.equal(qa.state().captureSequence.phase,'aborted',kind);assert.equal(qa.state().captureSequence.completed,0);assert.equal(imageWrites(evidence.writes).length,0);assert.equal(frameWrites(evidence.writes).length,0);qa.listeners.pagehide();await qa.flush();
  }
});

test('integrated automatic B requires the same presentation as its saved A even without a scene revision change',async()=>{
  const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,save:evidence.save});
  for(let i=0;i<8&&qa.state().captureSequence.completed<3;i++){qa.runFrame();await qa.flush();}
  assert.equal(qa.state().captureSequence.completed,3);assert.equal(qa.state().captureSequence.step.strength,.5);
  const revision=qa.state().saveFrame.revision;qa.pixels.styles.get(qa.pixels.viewport).backgroundColor='rgb(30, 48, 57)';qa.runFrame();await qa.flush();
  assert.equal(qa.state().game.reviewRenderingSnapshot().drawnRevision,revision);assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(imageWrites(evidence.writes).length,3);assert.equal(frameWrites(evidence.writes).length,3);qa.listeners.pagehide();await qa.flush();
});

test('integrated queued PBO cancels on lifecycle or true resize and late fence completion cannot encode or save',async()=>{
  for(const event of ['hidden','context','dispose','resize']){
    const evidence=captureSaves(),qa=await fixture({save:evidence.save}),game=qa.state().game;
    qa.pixels.gl.wait=qa.pixels.gl.TIMEOUT_EXPIRED;qa.elements.get('frame').onclick();qa.runFrame();assert.equal(qa.pixels.submissions.length,1);
    if(event==='hidden'){qa.document.hidden=true;qa.listeners.visibilitychange();qa.document.hidden=false;}
    else if(event==='context'){qa.listeners.webglcontextlost({preventDefault(){}});}
    else if(event==='dispose')qa.listeners.pagehide();
    else{qa.canvas.clientWidth++;game._resize();}
    qa.pixels.gl.wait=qa.pixels.gl.CONDITION_SATISFIED;await qa.flush();
    assert.equal(qa.pixels.encoders.length,0,event);assert.equal(evidence.writes.length,0);assert.equal(qa.pixels.deletedBuffers.length,1);assert.equal(qa.pixels.deletedSyncs.length,1);assert.equal(qa.pixels.polls.size,0);qa.listeners.pagehide();await qa.flush();
  }
});

test('integrated automatic PBO timeout stays within the existing 120-second step bound',async()=>{
  const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,save:evidence.save});
  qa.pixels.gl.wait=qa.pixels.gl.TIMEOUT_EXPIRED;qa.runFrame();await qa.flush();assert.equal(qa.pixels.submissions.length,1);assert.equal(qa.pixels.encoders.length,0);
  qa.at(120000);await qa.flush();assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(qa.state().captureSequence.completed,0);assert.equal(imageWrites(evidence.writes).length,0);assert.equal(qa.pixels.deletedBuffers.length,1);assert.equal(qa.pixels.deletedSyncs.length,1);qa.listeners.pagehide();await qa.flush();
});

test('capture sequence is an explicit DEV navigation opt-in and waits for the actual complete frame gate',async()=>{
  for(const [query,dev]of [['',true],['?capture=unknown',true],[captureQuery,false]]){
    const evidence=captureSaves(),qa=await fixture({query,dev,ground:true,compileGround:true,save:evidence.save});qa.runFrame();await qa.flush();assert.equal(qa.state().captureSequence,null);assert.equal(evidence.writes.length,0);qa.listeners.pagehide();await qa.flush();
  }
  const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,deferFull:true,save:evidence.save});
  assert.equal(qa.state().captureSequence?.phase,'waiting-full');qa.runFrame();await qa.flush();assert.equal(imageWrites(evidence.writes).length,0);assert.equal(qa.elements.get('capture-cancel').disabled,false);
  qa.state().game.progress({phase:'full-frame',enhancements:'degraded'});await qa.flush();assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(imageWrites(evidence.writes).length,0);qa.listeners.pagehide();await qa.flush();
});

test('capture sequence saves ten actual passes and four immutable A/B pairs using one Game without download clicks',async()=>{
  const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,save:evidence.save}),game=qa.state().game,sceneId=game.scene.uuid;
  assert.ok(qa.state().captureSequence);assert.equal(qa.state().session,null);assert.equal(qa.begin('measure'),null);assert.equal(qa.elements.get('ground-study').disabled,true);
  const result=await pumpCapture(qa);assert.equal(result.phase,'complete',result.reason);assert.equal(result.completed,10);assert.equal(imageWrites(evidence.writes).length,10);assert.equal(frameWrites(evidence.writes).length,10);assert.equal(qa.downloads.length,0);assert.equal(qa.gameCreations,1);
  const metadata=await Promise.all(frameWrites(evidence.writes).map(async write=>JSON.parse(await write.options.body.text())));
  assert.deepEqual(metadata.map(frame=>[frame.view,frame.timeOfDay,frame.groundStudy.strength]),[['overview','day',0],['overview','night',0],['west-community','day',0],['west-community','day',.5],['west-community','night',0],['west-community','night',.5],['east-community','day',0],['east-community','day',.5],['east-community','night',0],['east-community','night',.5]]);
  assert.equal(new Set(evidence.writes.map(write=>write.url)).size,evidence.writes.length);assert.equal(new Set(metadata.map(frame=>frame.captureSequence.runId)).size,1);
  for(const frame of metadata){assert.equal(frame.groundStudy.sceneId,sceneId);assert.equal(frame.quality,'high');assert.equal(frame.foliage,'full');assert.equal(frame.sampling,'native');assert.equal(frame.reducedMotion,true);assert.equal(frame.groundStudy.materials[0].boundStrength,frame.groundStudy.strength);assert.ok(frame.renderRequest.drawnRevision>=frame.renderRequest.requestedRevision);}
  for(let i=2;i<10;i+=2){const a=metadata[i],b=metadata[i+1];assert.equal(a.captureSequence.pairId,b.captureSequence.pairId);assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.lighting,b.lighting);assert.deepEqual(a.canvas,b.canvas);assert.deepEqual(a.pixelEvidence.presentation.conditions,b.pixelEvidence.presentation.conditions);assert.equal(qa.resets.filter(reset=>reset.view===a.view&&reset.light===a.timeOfDay).length,1);}
  assert.equal(new Set(metadata.slice(2).map(frame=>frame.captureSequence.pairId)).size,4);assert.equal(game.scene.uuid,sceneId);assert.equal(qa.elements.get('capture-cancel').disabled,true);assert.equal(qa.elements.get('frame').disabled,false);
  const drawCount=game.draws;qa.runFrame();qa.runFrame();assert.ok(game.draws<=drawCount+1);assert.equal(game.reviewRenderingSnapshot().idle,true);assert.ok(qa.lodChanges.every(value=>typeof value==='boolean'));assert.equal(qa.lodChanges.at(-1),false);assert.equal(qa.groveLodChanges.at(-1),false);
  const progress=evidence.writes.filter(write=>write.url.includes('-progress-'));assert.ok(progress.length>0&&progress.length<90);for(const write of progress){const record=JSON.parse(await write.options.body.text());assert.ok(Object.values(record).every(value=>value===null||['string','number','boolean'].includes(typeof value)));}
  qa.listeners.pagehide();await qa.flush();
});

test('capture sequence waits for delayed PNG encoding and both POST acknowledgements before advancing',async()=>{
  const callbacks=[],evidence=captureSaves(),png=deferred(),json=deferred(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,capture:callback=>callbacks.push(callback),save:async(url,options)=>{evidence.writes.push({url,options});if(url.endsWith('.png'))await png.promise;else if(!url.includes('-progress-'))await json.promise;return {ok:true};}});
  assert.ok(qa.state().captureSequence);qa.runFrame();await qa.flush();assert.equal(callbacks.length,1);assert.equal(imageWrites(evidence.writes).length,0);const draws=qa.state().game.draws;
  qa.runFrame();qa.runFrame();assert.equal(qa.state().game.draws,draws);callbacks[0](new Blob(['png'],{type:'image/png'}));await qa.flush();assert.equal(imageWrites(evidence.writes).length,1);assert.equal(frameWrites(evidence.writes).length,0);assert.equal(qa.state().captureSequence.completed,0);
  png.resolve();await qa.flush();assert.equal(frameWrites(evidence.writes).length,1);assert.equal(qa.state().captureSequence.completed,0);assert.equal(callbacks.length,1);
  json.resolve();await qa.flush();assert.equal(qa.state().captureSequence.completed,1);qa.elements.get('capture-cancel').onclick();qa.listeners.pagehide();await qa.flush();assert.equal(qa.downloads.length,0);
});

test('capture sequence rejects a null PNG, rejected sidecar and unbound or wrong actual ground uniform',async()=>{
  for(const failure of ['null-png','sidecar','uncompiled','wrong-uniform']){
    const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:failure!=='uncompiled',capture:failure==='null-png'?callback=>callback(null):null,save:async(url,options)=>{evidence.writes.push({url,options});return {ok:!(failure==='sidecar'&&url.endsWith('.json')&&!url.includes('-progress-')),status:500};}});
    assert.ok(qa.state().captureSequence);if(failure==='wrong-uniform')qa.state().game.duringRender=()=>{qa.state().game.scene.getObjectByName('qa-ground').material.qaShader.uniforms.groundStudyStrength.value=.25;};
    await pumpCapture(qa,4);assert.equal(qa.state().captureSequence.phase,'aborted',failure);assert.equal(qa.state().captureSequence.completed,0);assert.equal(qa.downloads.length,0);qa.listeners.pagehide();await qa.flush();
  }
});

test('capture sequence invalidates hidden, context lost, dispose and cancellation during encoding without late files',async()=>{
  for(const interruption of ['hidden','context','dispose','cancel']){
    const callbacks=[],evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,capture:callback=>callbacks.push(callback),save:evidence.save});assert.ok(qa.state().captureSequence);qa.runFrame();await qa.flush();assert.equal(callbacks.length,1);
    if(interruption==='hidden'){qa.document.hidden=true;qa.listeners.visibilitychange();}else if(interruption==='context')qa.listeners.webglcontextlost({preventDefault(){}});else if(interruption==='dispose')qa.listeners.pagehide();else qa.elements.get('capture-cancel').onclick();
    callbacks[0](new Blob(['late'],{type:'image/png'}));await qa.flush();assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(qa.state().captureSequence.completed,0);assert.equal(imageWrites(evidence.writes).length,0);assert.equal(frameWrites(evidence.writes).length,0);qa.listeners.pagehide();await qa.flush();
  }
});

test('capture sequence uses a 120-second per-step wall watchdog and rejects real condition drift',async()=>{
  for(const failure of ['timeout','drift']){
    const callbacks=[],evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,capture:callback=>callbacks.push(callback),save:evidence.save});assert.ok(qa.state().captureSequence);qa.runFrame();await qa.flush();
    if(failure==='timeout'){const timer=[...qa.timers.values()].find(timer=>timer.at===120000);assert.ok(timer);qa.at(120001);timer.fn();}else qa.state().game.camera.position.x+=1;
    callbacks[0](new Blob(['late'],{type:'image/png'}));await qa.flush();assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(imageWrites(evidence.writes).length,0);qa.listeners.pagehide();await qa.flush();
  }
});

test('capture sequence starts during a pass only after full readiness and captures a later requested actual pass',async()=>{
  const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,deferFull:true,save:evidence.save}),game=qa.state().game;
  game.duringRender=()=>{game.duringRender=null;game.progress({phase:'enhancements',enhancements:'ready'});game.progress({phase:'full-frame',enhancements:'ready'});};
  qa.runFrame();await qa.flush();assert.equal(imageWrites(evidence.writes).length,0,'the current pass was already in flight before the sequence request');
  qa.runFrame();await qa.flush();assert.equal(imageWrites(evidence.writes).length,1);const metadata=JSON.parse(await frameWrites(evidence.writes)[0].options.body.text());assert.ok(metadata.renderRequest.drawnRevision>=metadata.renderRequest.requestedRevision);
  qa.elements.get('capture-cancel').onclick();qa.listeners.pagehide();await qa.flush();
});

test('capture sequence aborts B before writing it when real lighting changes after saved A',async()=>{
  const evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,save:evidence.save});
  for(let i=0;i<3;i++){qa.runFrame();await qa.flush();}assert.equal(qa.state().captureSequence.completed,3);assert.equal(qa.state().captureSequence.step.strength,.5);
  qa.state().game.renderer.toneMappingExposure=9;qa.runFrame();await qa.flush();assert.equal(qa.state().captureSequence.phase,'aborted');assert.match(qa.state().captureSequence.reason,/A\/B conditions/);assert.equal(imageWrites(evidence.writes).length,3);assert.equal(frameWrites(evidence.writes).length,3);qa.listeners.pagehide();await qa.flush();
});

test('capture sequence invalidates a newer visual change during encoding or before the paired B draw',async()=>{
  const callbacks=[],first=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,capture:callback=>callbacks.push(callback),save:first.save});
  qa.runFrame();await qa.flush();qa.state().game.exhibitionStage.loadedSource='late-image.webp';qa.state().game.requestRender();callbacks[0](new Blob(['png'],{type:'image/png'}));await qa.flush();
  assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(imageWrites(first.writes).length,0);qa.listeners.pagehide();await qa.flush();
  const second=captureSaves(),pair=await fixture({query:captureQuery,ground:true,compileGround:true,save:second.save});for(let i=0;i<3;i++){pair.runFrame();await pair.flush();}
  pair.state().game.exhibitionStage.loadedSource='late-image.webp';pair.state().game.requestRender();pair.runFrame();await pair.flush();
  assert.equal(pair.state().captureSequence.phase,'aborted');assert.equal(imageWrites(second.writes).length,3);pair.listeners.pagehide();await pair.flush();
});

test('capture sequence coalesces primitive loading progress through one POST and persists its final state',async()=>{
  const held=deferred(),evidence=captureSaves();let active=0,maximum=0;
  const qa=await fixture({query:captureQuery,ground:true,compileGround:true,deferFull:true,save:async(url,options)=>{evidence.writes.push({url,options});if(url.includes('-progress-')){active++;maximum=Math.max(maximum,active);await held.promise;active--;}return {ok:true};}});
  const first=JSON.parse(await evidence.writes[0].options.body.text());assert.equal(first.phase,'waiting-full');assert.equal(first.fullReady,false);assert.equal(first.sceneId,null);assert.equal(first.coldStartMeasurement,false);assert.match(first.runId,/^[a-f0-9-]+$/);
  for(let i=1;i<=20;i++){qa.at(i*2000);qa.state().game.progress({phase:'assembly',region:'bounded-fixture',assemblyMs:i});}assert.equal(evidence.writes.length,1);
  qa.state().game.progress({phase:'enhancements',enhancements:'ready'});qa.state().game.progress({phase:'full-frame',enhancements:'ready'});await pumpCapture(qa);assert.equal(qa.state().captureSequence.phase,'complete');held.resolve();await qa.flush();await qa.flush();
  const progress=evidence.writes.filter(write=>write.url.includes('-progress-'));assert.equal(maximum,1);assert.equal(progress.length,2);const last=JSON.parse(await progress.at(-1).options.body.text());assert.equal(last.phase,'complete');assert.equal(last.completed,10);assert.equal(last.fullReady,true);assert.equal(last.coreSeconds,0);assert.equal(last.fullSeconds,40);assert.ok(last.drawnRevision>0);assert.equal(last.runId,first.runId);assert.ok(progress.every(write=>write.options.body.size<4096));assert.equal(qa.downloads.length,0);qa.listeners.pagehide();await qa.flush();
});

test('capture sequence rejects PNG POST failure and aborts pending saving on visibility loss',async()=>{
  for(const failure of ['post','hidden']){
    const held=deferred(),evidence=captureSaves(),qa=await fixture({query:captureQuery,ground:true,compileGround:true,save:async(url,options)=>{evidence.writes.push({url,options});if(url.endsWith('.png')){if(failure==='post')return {ok:false,status:409};await held.promise;}return {ok:true};}});
    qa.runFrame();await qa.flush();const png=imageWrites(evidence.writes)[0];assert.ok(png);
    if(failure==='hidden'){qa.document.hidden=true;qa.listeners.visibilitychange();assert.equal(png.options.signal.aborted,true);held.resolve();await qa.flush();}
    assert.equal(qa.state().captureSequence.phase,'aborted');assert.equal(qa.state().captureSequence.completed,0);assert.equal(frameWrites(evidence.writes).length,0);assert.equal(qa.downloads.length,0);qa.listeners.pagehide();await qa.flush();
  }
});

test('capture sequence writes its actual encoded bytes and sidecars through the real local Vite evidence route',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'review-sequence-')),routes=[];let active=0;const writes=[];
  reviewCapturePlugin(directory).configureServer({middlewares:{use:(prefix,handler)=>routes.push({prefix,handler})}});
  const server=createServer((req,res)=>{const route=routes.find(route=>req.url.startsWith(route.prefix));if(!route){res.writeHead(404).end();return;}req.url=req.url.slice(route.prefix.length-1);void route.handler(req,res,()=>res.writeHead(404).end());});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  const qa=await fixture({query:captureQuery,ground:true,compileGround:true,save:async(url,options)=>{writes.push(url);active++;try{return await fetch(base+url,options);}finally{active--;}}});t.after(()=>qa.listeners.pagehide());
  const deadline=performance.now()+10000;
  while((!qa.state().captureSequence.finished||active)&&performance.now()<deadline){if(qa.frames.size)qa.runFrame();await qa.flush();await new Promise(resolve=>setTimeout(resolve,5));}
  assert.equal(qa.state().captureSequence.phase,'complete',qa.state().captureSequence.reason||qa.state().captureSequence.phase);assert.equal(qa.state().captureSequence.completed,10);assert.equal(active,0);
  const names=await readdir(directory),pngs=names.filter(name=>name.endsWith('.png')),sidecars=names.filter(name=>name.endsWith('.json')&&!name.includes('-progress-'));assert.equal(pngs.length,10);assert.equal(sidecars.length,10);
  for(const name of pngs){assert.equal(await readFile(join(directory,name),'utf8'),'png','the controlled encoder bytes reached disk without transformation');const metadata=JSON.parse(await readFile(join(directory,name.replace(/\.png$/,'.json')),'utf8'));assert.equal(metadata.evidenceType,'actual-frame');assert.equal(metadata.captureSequence.coldStartMeasurement,false);assert.equal(metadata.groundStudy.sceneId,qa.state().game.scene.uuid);}
  assert.equal(qa.downloads.length,0);assert.equal(writes.length,new Set(writes).size);qa.listeners.pagehide();await qa.flush();
});

test('static review requests real frames for each visible control and otherwise idles the composer',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth&lighting=solar-120-cloud70'}),game=qa.state().game;
  assert.equal(game.constructionContext.reviewDemandRendering,true);qa.runFrame();const baseline=game.draws;qa.runFrame();qa.runFrame();assert.equal(game.draws,baseline);
  for(const [id,value] of [['view','shore'],['light','day'],['quality','low'],['foliage','lod'],['sampling','2x'],['lighting-variant','pearl-fill'],['phase-start','.2'],['activity-start','10'],['companion-language','en']]){
    const control=qa.elements.get(id);control.value=value;control.onchange();const before=game.draws;assert.equal(game.draws,before);qa.runFrame();qa.runFrame();assert.equal(game.draws,before+1,id);
  }
  qa.elements.get('companion-pause').onclick();const before=game.draws;qa.runFrame();qa.runFrame();assert.equal(game.draws,before+1);
  qa.canvas.clientWidth=800;game._resize();qa.runFrame();qa.runFrame();assert.equal(game.draws,before+2);
});

test('an untouched ground review reports the same local colour as its real production shader and manual frame',async()=>{
  const evidence=captureSaves(),qa=await fixture({ground:true,compileGround:true,save:evidence.save}),{game,groundStudy}=qa.state();
  qa.runFrame();const material=game.scene.getObjectByName('qa-ground').material;
  const actual=material.qaShader.uniforms.groundStudyStrength.value;
  assert.equal(actual,.5);assert.equal(groundStudy.snapshot().installed,false);
  assert.equal(groundStudy.snapshot().strength,actual);
  assert.equal(Number(qa.elements.get('ground-study').value),actual);
  qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();
  const metadata=JSON.parse(await frameWrites(evidence.writes)[0].options.body.text());
  assert.equal(metadata.groundStudy.strength,actual);assert.equal(metadata.groundStudy.installed,false);
  qa.listeners.pagehide();await qa.flush();material.dispose();
});

test('ground comparison changes one live uniform and requests a fresh frame without resetting camera or clocks',async()=>{
  const saves=[],qa=await fixture({ground:true,query:'?view=west-community&light=day&lighting=solar-120-cloud70',save:async(url,options)=>{saves.push({url,options});return {ok:true};}}),{game,groundStudy}=qa.state();
  qa.runFrame();qa.runFrame();const sceneId=game.scene.uuid,eye=game.camera.position.toArray(),target=[...game.camera.target],beforeDraw=game.draws;
  const material=game.scene.getObjectByName('qa-ground').material,key=material.customProgramCacheKey();let resets=0,shader=null;
  game.returnHome=()=>{resets++;};game.duringRender=()=>{if(!shader&&groundStudy.snapshot().installed){shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);}};
  assert.equal(groundStudy.snapshot().installed,false);assert.equal(qa.elements.get('ground-study').disabled,false);
  qa.elements.get('ground-study').value='0.5';qa.elements.get('ground-study').onchange();qa.runFrame();qa.runFrame();
  assert.equal(game.draws,beforeDraw+1);assert.equal(resets,0);assert.equal(shader.uniforms.groundStudyStrength.value,.5);
  assert.deepEqual(game.camera.position.toArray(),eye);assert.deepEqual(game.camera.target,target);assert.equal(game.scene.uuid,sceneId);
  const program=material.customProgramCacheKey(),version=material.version;assert.notEqual(program,key);
  qa.elements.get('frame').onclick();const requested=game.reviewRenderingSnapshot().requestedRevision;qa.runFrame();await qa.flush();
  const metadata=JSON.parse(await saves.find(save=>save.url.endsWith('.json')).options.body.text());
  assert.equal(metadata.groundStudy.sceneId,sceneId);assert.equal(metadata.groundStudy.strength,.5);assert.equal(metadata.groundStudy.materials[0].boundStrength,.5);assert.equal(metadata.renderRequest.drawnRevision,requested);
  qa.elements.get('ground-study').value='0';qa.elements.get('ground-study').onchange();qa.runFrame();
  assert.equal(shader.uniforms.groundStudyStrength.value,0);assert.equal(material.version,version);assert.equal(material.customProgramCacheKey(),program);assert.equal(resets,0);
  qa.listeners.pagehide();await qa.flush();assert.equal(groundStudy.snapshot().disposed,true);assert.equal(material.customProgramCacheKey(),key);material.dispose();
});

test('ground study cannot install before full-ready or change during a recording',async()=>{
  const qa=await fixture({ground:true,deferFull:true}),{game,groundStudy}=qa.state(),control=qa.elements.get('ground-study');
  assert.equal(control.disabled,true);control.value='0.5';control.onchange();assert.equal(groundStudy.snapshot().installed,false);
  game.progress({phase:'enhancements',enhancements:'ready'});game.progress({phase:'full-frame',enhancements:'ready'});control.onchange();assert.equal(groundStudy.snapshot().strength,.5);
  qa.begin('measure');assert.equal(control.disabled,true);control.value='0';control.onchange();assert.equal(groundStudy.snapshot().strength,.5);
  await qa.stop('test-end');qa.listeners.pagehide();await qa.flush();
});

test('actual assembly durations survive the milestone ring and asynchronous capture uses its own copied snapshot',async()=>{
  const pending=[],saves=[],qa=await fixture({query:'?lighting=solar-120-cloud70',capture:callback=>pending.push(callback),save:async(url,options)=>{saves.push({url,options});return {ok:true};}}),game=qa.state().game;
  const event={phase:'assembly',region:'gardens',assemblyMs:13,assemblySteps:[{region:'gardens-build',assemblyMs:0},{region:'courtyard-underplanting',assemblyMs:12},{region:'missing',assemblyMs:undefined}]};game.progress(event);
  for(let i=0;i<35;i++)game.progress({phase:'prepare',region:`later-${i}`});assert.ok(!qa.elements.get('loading').textContent.includes('gardens-build'));
  qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();event.assemblySteps[1].assemblyMs=999;game.progress({...event,assemblyMs:1000});
  pending[0](new Blob(['png'],{type:'image/png'}));await qa.flush();const metadata=JSON.parse(await saves.find(save=>save.url.endsWith('.json')).options.body.text());
  assert.deepEqual(metadata.assemblyTimings,[{region:'gardens',assemblyMs:13,steps:[{region:'gardens-build',assemblyMs:0},{region:'courtyard-underplanting',assemblyMs:12}]}]);
  qa.listeners.pagehide();await qa.flush();
});

test('static review defers a capture requested during a draw to the next actual draw and preserves coalesced invalidation',async()=>{
  const captures=[],qa=await fixture({query:'?lighting=solar-120-cloud70',capture:cb=>captures.push(cb)}),game=qa.state().game;
  qa.runFrame();qa.runFrame();assert.equal(captures.length,0);
  game.duringRender=()=>{game.duringRender=null;qa.elements.get('frame').onclick();};game.requestRender();qa.runFrame();
  assert.equal(captures.length,0,'the in-flight draw predates the capture request');qa.runFrame();await qa.flush();assert.equal(captures.length,1);qa.runFrame();assert.equal(captures.length,1);
  qa.elements.get('frame').onclick();qa.elements.get('frame').onclick();assert.equal(captures.length,1);qa.runFrame();await qa.flush();assert.equal(captures.length,2);
  qa.listeners.pagehide();for(const finish of captures)finish(new Blob(['png']));await qa.flush();assert.equal(qa.downloads.length,0);
});

test('static review keeps actual recording and measurement passes continuous then resumes idle',async()=>{
  const qa=await fixture({query:'?lighting=solar-120-cloud70'}),game=qa.state().game;qa.runFrame();qa.runFrame();
  await qa.record('record');let before=game.draws;for(let i=0;i<4;i++)qa.runFrame();assert.equal(game.draws,before+4);
  const stopping=qa.stop('test-end');await qa.recorders[0].finish();await stopping;qa.runFrame();before=game.draws;qa.runFrame();qa.runFrame();assert.equal(game.draws,before);
  qa.begin('measure');for(let i=0;i<4;i++)qa.runFrame();assert.equal(game.draws,before+4);await qa.stop('test-end');qa.runFrame();before=game.draws;qa.runFrame();assert.equal(game.draws,before);
  qa.elements.get('reduced-motion').checked=false;qa.elements.get('reduced-motion').onchange();for(let i=0;i<3;i++)qa.runFrame();assert.equal(game.draws,before+3);
});

test('review full and LOD selection reaches both existing tree controllers including late groves',async()=>{
  const qa=await fixture({query:'?lighting=solar-120-cloud70'}),game=qa.state().game;
  assert.equal(qa.lodChanges.at(-1),false);assert.equal(qa.groveLodChanges.at(-1),false);
  qa.elements.get('foliage').value='lod';qa.elements.get('foliage').onchange();assert.equal(qa.lodChanges.at(-1),true);assert.equal(qa.groveLodChanges.at(-1),true);
  const late=[];game.world.blossomGroves={foliage:{setEnabled:value=>late.push(value)}};game.progress({phase:'full-frame',enhancements:'ready'});assert.equal(late.at(-1),false,'full-frame reset also binds the current grove controller');
  const groveOnly=await fixture({lod:false,groves:true});assert.equal(groveOnly.elements.get('foliage').disabled,false);groveOnly.elements.get('foliage').value='full';groveOnly.elements.get('foliage').onchange();assert.equal(groveOnly.groveLodChanges.at(-1),false);
});

test('review-local invalidation exposes actual drawn revisions and capture waits without resetting the scene',async()=>{
  const saves=[],qa=await fixture({query:'?lighting=solar-120-cloud70',save:async(url,options)=>{saves.push({url,options});return {ok:true};}}),game=qa.state().game;
  const publish=()=>game.callbacks.onFrame({fps:60,renderedFrames:game._frameCount,reviewRendering:game.reviewRenderingSnapshot()});
  qa.runFrame();qa.runFrame();publish();const held=game.reviewRenderingSnapshot();assert.equal(held.idle,true);assert.equal(qa.document.body.dataset.ready,'true');assert.equal(qa.document.body.dataset.renderIdle,'true');assert.match(qa.elements.get('render-policy').textContent,/cached frame/);
  const lighting=game.environment,pose=game.camera.position.clone(),count=qa.lodChanges.length,time=game._lastFrame;
  const revision=qa.requestReviewFrame();qa.requestReviewFrame();assert.ok(revision>held.drawnRevision);assert.equal(qa.document.body.dataset.drawnRevision,String(held.drawnRevision));assert.match(qa.elements.get('render-policy').textContent,/frame requested/);
  qa.elements.get('frame').onclick();const requested=qa.state().saveFrame.revision;assert.equal(saves.length,0);qa.runFrame();publish();await qa.flush();await qa.flush();
  const drawn=game.reviewRenderingSnapshot();assert.equal(drawn.drawnRevision,requested);assert.equal(drawn.renderedFrames,held.renderedFrames+1);assert.equal(qa.document.body.dataset.drawnRevision,String(requested));
  const metadata=JSON.parse(await saves.find(save=>save.url.endsWith('.json')).options.body.text());assert.deepEqual(metadata.renderRequest,{requestedRevision:requested,drawnRevision:requested});
  assert.equal(game.environment,lighting);assert.deepEqual(game.camera.position,pose);assert.equal(qa.lodChanges.length,count);assert.equal(game._lastFrame,time,'presentation invalidation never resets simulation time');
});

test('an error in a requested static pass cannot export an old frame or bypass the full-ready gate',async()=>{
  const captures=[],qa=await fixture({query:'?lighting=solar-120-cloud70',capture:cb=>captures.push(cb)}),game=qa.state().game;
  qa.runFrame();qa.runFrame();qa.elements.get('frame').onclick();game.duringRender=()=>game.progress({phase:'render-error',activeResource:'bad requested program'});qa.runFrame();
  assert.equal(captures.length,0);assert.equal(qa.state().saveFrame,null);assert.equal(qa.document.body.dataset.ready,'degraded');assert.equal(qa.elements.get('frame').disabled,true);qa.listeners.pagehide();await qa.flush();
});

test('staged review explicitly selects the bounded enhancement budget while ordinary review retains its defaults',async()=>{
  const ordinary=await fixture({deferFull:true});assert.equal(ordinary.state().game.constructionContext.deadline,180000);assert.equal(ordinary.state().game.constructionContext.reviewEnhancementBudgetMs,undefined);
  const staged=await fixture({query:'?loading=staged',deferFull:true});assert.equal(staged.state().game.constructionContext.reviewEnhancementBudgetMs,900000);assert.equal(staged.elements.get('frame').disabled,true);
});

test('full rendering cannot arm capture while companion installation is incomplete',async()=>{
  const qa=await fixture({companionsReady:false});assert.equal(qa.document.body.dataset.ready,'degraded');assert.equal(qa.elements.get('companion-record').disabled,true);assert.equal(await qa.record('companion'),null);
});

test('companion controls preserve actor poses, change language, pause, and use the guarded Game interaction',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game,position={...game.companionState.actors[0].position};
  qa.elements.get('companion-language').value='en';qa.elements.get('companion-language').onchange();assert.equal(game.options.lang,'en');
  qa.elements.get('companion-pause').onclick();assert.equal(game.paused,true);assert.equal(qa.elements.get('companion-action').onclick(),false);
  qa.elements.get('companion-pause').onclick();assert.equal(qa.elements.get('companion-action').onclick(),true);assert.deepEqual(game.companionState.actors[0].position,position);assert.deepEqual(game.companionInteractions,['elizabeth']);
});

test('companion recording can start from a static review and restores that choice after an incomplete real sequence',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game;
  qa.elements.get('reduced-motion').checked=true;qa.reset();qa.runFrame();
  assert.equal(game.options.reducedMotion,true);
  const current=await qa.record('companion');
  assert.ok(current,'the recording control enables real motion without a separate live-input step');
  assert.equal(current.metadata.reducedMotion,false);assert.equal(game.options.reducedMotion,false);
  assert.equal(qa.elements.get('reduced-motion').checked,false);assert.equal(qa.elements.get('reduced-motion').disabled,true);
  assert.equal(await qa.record('companion'),null,'a second click cannot change the running capture');
  qa.at(24000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0,'24 wall seconds must not end a slow real encounter');
  qa.at(48000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0,'48 wall seconds is a minimum, not evidence of completion');
  qa.at(180000);qa.updateSequence();await qa.recorders[0].finish();await qa.flush();
  assert.equal(qa.state().lastReport.invalid,true,'a real completed interaction is still mandatory');
  assert.equal(qa.state().lastReport.reducedMotion,false,'captured conditions precede UI restoration');
  assert.equal(game.options.reducedMotion,true);assert.equal(qa.elements.get('reduced-motion').checked,true);
  qa.runFrame();const draws=game.draws;qa.runFrame();assert.equal(game.draws,draws,'restored static review sleeps again');
  qa.listeners.pagehide();
});

test('failed companion recording preparation restores the original static review without changing normal recordings',async()=>{
  const qa=await fixture({query:'?view=companion-sadaharu',audioTracks:false}),game=qa.state().game;
  qa.elements.get('reduced-motion').checked=true;qa.reset();
  assert.equal(await qa.record('companion'),null);assert.equal(qa.state().lastReport.invalid,true);
  assert.match(qa.state().lastReport.reason,/No live audio track/);
  assert.equal(game.options.reducedMotion,true);assert.equal(qa.elements.get('reduced-motion').checked,true);
  qa.listeners.pagehide();
  const regular=await fixture();regular.elements.get('reduced-motion').checked=true;regular.reset();
  const current=await regular.record('record');assert.equal(current.metadata.reducedMotion,true);
  const ending=regular.stop('test-end');await regular.recorders[0].finish();await ending;regular.listeners.pagehide();
});

test('actual encounter recording requires running audio and a live audio track, and cleans failures',async()=>{
  for(const options of [{audioState:'suspended'},{audioTracks:false}]){
    const qa=await fixture({query:'?view=companion-sadaharu',...options});assert.equal(await qa.record('companion'),null);assert.equal(qa.recorders.length,0);assert.equal(qa.state().lastReport.invalid,true);assert.ok(qa.streams.every(stream=>stream.getTracks().every(track=>track.stopped)));assert.equal(qa.state().game.audio.master.connected.size,0);
  }
});

test('CPU companion completion waits for a copied successful render and stops only on the following tick',async()=>{
  for(const freshSnapshots of [false,true]){
    const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game;
    if(freshSnapshots)game.companionSnapshot=()=>JSON.parse(JSON.stringify(game.companionState));
    const current=await qa.record('companion'),actor=game.companionState.actors[0];game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();
    Object.assign(actor,{busy:false,state:'rest',distance:1.2,completedInteraction:{interactionCount:1,startedAt:4,completedAt:9,distance:1.2,resumedAt:null,resumedDistance:null}});game.companionState.activeTime=12;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:5}];
    qa.at(59900);qa.runFrame();assert.equal(current.motionSamples.at(-1).companions.actors[0].state,'rest');
    actor.state='walk';actor.distance=1.26;Object.assign(actor.completedInteraction,{resumedAt:12.1,resumedDistance:1.26});game.companionState.activeTime=12.1;qa.at(60000);qa.updateSequence();
    assert.equal(qa.recorders[0].stopCount,0,'CPU completion cannot stop before a resumed pose has rendered');assert.equal(current.completionFrame,null);
    game.duringRender=()=>{game.duringRender=null;assert.equal(qa.recorders[0].state,'recording');assert.equal(current.completionFrame,null);};qa.runFrame();
    assert.equal(qa.recorders[0].stopCount,0,'the first complete render must remain available for canvas capture before the following tick');
    const rendered=current.completionFrame;assert.equal(rendered.run,current.id);assert.equal(rendered.elapsedDurationMs,60000);assert.equal(rendered.companions.actors[0].distance,1.26);assert.equal(rendered.encounter.completion.resumedAt,12.1);
    assert.equal(current.motionSamples.at(-1).seconds,60,'the completed pose bypasses the usual 0.5-second sampling interval');assert.equal(current.motionSamples.at(-1).companions.actors[0].completedInteraction.resumedAt,12.1);
    const renderedX=actor.position.x;actor.position.x+=.5;actor.distance=1.3;actor.completedInteraction.resumedDistance=1.3;assert.equal(rendered.companions.actors[0].position.x,renderedX);assert.equal(rendered.companions.actors[0].distance,1.26);assert.equal(rendered.companions.actors[0].completedInteraction.resumedDistance,1.26);
    qa.at(60100);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,1);await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;
    assert.equal(report.invalid,false);assert.equal(report.elapsedDurationMs,60100);assert.equal(report.renderedCompanionCompletion.run,report.run);assert.equal(report.renderedCompanionCompletion.elapsedDurationMs,60000);assert.equal(report.motionSamples.at(-1).companions.actors[0].distance,1.26);
  }
});

test('skipped or failed renders cannot certify CPU-complete companion recordings',async()=>{
  for(const mode of ['skipped','thrown','shader-error']){
    const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game,current=await qa.record('companion');game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();
    Object.assign(game.companionState.actors[0],{busy:false,state:'walk',distance:1.26,completedInteraction:{interactionCount:1,startedAt:4,completedAt:9,distance:1.2,resumedAt:12,resumedDistance:1.26}});game.companionState.activeTime=12;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:5}];qa.at(60000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0,mode);
    if(mode==='skipped'){game._contextLost=true;qa.runFrame();}
    else if(mode==='thrown'){game.duringRender=()=>{throw new Error('completion render failed');};assert.throws(()=>qa.runFrame(),/completion render failed/);}
    else{game.duringRender=()=>game.progress({phase:'render-error',activeResource:'completion shader failed'});qa.runFrame();}
    assert.equal(current.completionFrame,null,mode);assert.equal(current.motionSamples.length,0,'failed or skipped output supplies no rendered motion proof');
    if(mode==='skipped'){const timeout=[...qa.timers.values()].find(timer=>timer.at===180000);qa.at(180000);timeout.fn();}else await qa.flush();
    await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;assert.equal(report.invalid,true,mode);assert.equal(report.renderedCompanionCompletion,null);assert.match(report.reason,mode==='skipped'?/companion-encounter-timeout-180s/:/render-error/);
  }
});

test('a prior run rendered receipt cannot certify a new run with matching CPU encounter values',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game,actor=game.companionState.actors[0],first=await qa.record('companion');
  const acceptAndComplete=(wallMs)=>{game.companionState.activeTime=4;qa.at(wallMs);qa.updateSequence();Object.assign(actor,{busy:false,state:'walk',distance:1.26,completedInteraction:{interactionCount:1,startedAt:4,completedAt:9,distance:1.2,resumedAt:12,resumedDistance:1.26}});game.companionState.activeTime=12;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:5}];};
  acceptAndComplete(4000);qa.at(12000);qa.runFrame();assert.ok(first.completionFrame);const ending=qa.stop('cancelled');await qa.recorders[0].finish();await ending;
  Object.assign(actor,{busy:false,state:'rest',distance:0,interactionCount:0,completedInteraction:null});game.companionState.activeTime=0;game.companionState.audio.played=0;game.companionState.audio.recentEvents=[];const second=await qa.record('companion');assert.notEqual(second.id,first.id);
  acceptAndComplete(16000);qa.at(60000);qa.updateSequence();assert.equal(second.completionFrame,null);assert.equal(qa.recorders[1].stopCount,0,'only this run may supply rendered proof');
  const stopped=qa.stop('completed',true);await qa.recorders[1].finish();await stopped;assert.equal(qa.state().lastReport.invalid,true);assert.equal(qa.state().lastReport.reason,'companion-completion-not-rendered');
});

test('companion capture dispatches against accepted time and carries actual audio-event and actor evidence',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game,current=await qa.record('companion');
  assert.equal(qa.streams[0].getTracks().filter(t=>t.kind==='audio').length,1);assert.equal(current.audioCapture.contextState,'running');
  qa.at(6000);qa.updateSequence();assert.equal(game.companionInteractions.length,0,'six wall seconds cannot substitute for accepted activity');
  game.companionState.activeTime=4;qa.updateSequence();assert.deepEqual(game.companionInteractions,['elizabeth']);
  game.companionState.activeTime=5;game.companionState.actors[0].distance=2;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:4.9}];qa.at(7000);qa.updateSequence();
  game.companionState.activeTime=12;Object.assign(game.companionState.actors[0],{busy:false,state:'walk',distance:2.2,completedInteraction:{interactionCount:1,startedAt:4,completedAt:9,distance:2,resumedAt:11,resumedDistance:2.1}});qa.at(12000);qa.runFrame();assert.equal(qa.recorders[0].stopCount,0,'a rendered complete encounter must still record the minimum wall duration');
  qa.at(47999);qa.runFrame();assert.equal(qa.recorders[0].stopCount,0);qa.at(48000);qa.updateSequence();await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;
  assert.equal(report.invalid,false);assert.equal(report.workload,'actual-companion-encounter');assert.equal(report.encounter.audioEvents[0].kind,'sign-tap');assert.equal(report.companions.actors[0].distance,2.2);assert.equal(game.audio.master.connected.size,0);assert.ok(qa.streams[0].getTracks().every(t=>t.stopped));
});

test('slow companion recording survives 48 wall seconds and stops only after the existing real-travel gate passes',async()=>{
  const saves=[],qa=await fixture({query:'?view=companion-elizabeth',save:async(url,options)=>{saves.push({url,options});return {ok:true};}}),game=qa.state().game,current=await qa.record('companion'),actor=game.companionState.actors[0];
  const timeout=[...qa.timers.values()].find(timer=>timer.at===180000);assert.ok(timeout,'a wall watchdog must not depend on the next rendered frame');
  assert.match(qa.elements.get('status').textContent,/最少 48 s.*最长 180 s/);
  game.companionState.activeTime=4.25;qa.at(16000);qa.updateSequence();assert.equal(current.encounter.accepted,true);
  game.companionState.activeTime=13;Object.assign(actor,{busy:false,state:'walk',distance:.728,completedInteraction:{interactionCount:1,startedAt:4.25,completedAt:10.45,distance:.64,resumedAt:12.93,resumedDistance:.696}});
  game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:6.75}];
  for(const wallMs of [48000,50359.5]){qa.at(wallMs);qa.runFrame();assert.equal(current.phase,'running');assert.equal(qa.recorders[0].stopCount,0);assert.equal(qa.state().lastReport,null);assert.equal(qa.elements.get('reset').disabled,true);}
  assert.match(qa.elements.get('status').textContent,/50\.4 s.*最少 48 s.*最长 180 s.*等待/);
  actor.distance=.999;game.companionState.activeTime=13.6;qa.at(60000);qa.runFrame();assert.equal(qa.recorders[0].stopCount,0,'resumed movement below one metre must remain incomplete');
  actor.distance=1;game.companionState.activeTime=13.7;qa.at(62000);qa.runFrame();assert.equal(qa.recorders[0].stopCount,0);qa.at(62100);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,1);assert.equal(qa.timers.size,0);await qa.recorders[0].finish();await qa.flush();
  const report=qa.state().lastReport;assert.equal(report.invalid,false);assert.equal(report.reason,'completed');assert.equal(report.expectedDurationMs,48000);assert.equal(report.elapsedDurationMs,62100);assert.equal(report.renderedCompanionCompletion.elapsedDurationMs,62000);
  assert.deepEqual({...report.durationPolicy},{clock:'wall',mode:'minimum-then-companion-complete',minimumMs:48000,maximumMs:180000});
  const saved=JSON.parse(await saves.find(write=>write.url.endsWith('.json')).options.body.text());assert.deepEqual(saved.durationPolicy,{clock:'wall',mode:'minimum-then-companion-complete',minimumMs:48000,maximumMs:180000});assert.equal(saved.elapsedDurationMs,62100);assert.equal(saved.renderedCompanionCompletion.elapsedDurationMs,62000);
  assert.match(qa.elements.get('status').textContent,/62\.1 s.*最少 48 s.*最长 180 s.*完成/);assert.equal(game.audio.master.connected.size,0);assert.ok(qa.streams[0].getTracks().every(track=>track.stopped));
  const next=qa.begin('measure');timeout.fn();assert.equal(qa.state().session,next,'a released watchdog cannot stop a later run');await qa.stop('test-end');
});

test('the 180-second wall watchdog invalidates an incomplete encounter without another rendered frame',async()=>{
  const qa=await fixture({query:'?view=companion-sadaharu'}),game=qa.state().game;await qa.record('companion');game.allowCompanionInteraction=false;game.companionState.activeTime=10;
  qa.at(48000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0);qa.at(179999);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0);
  const timeout=[...qa.timers.values()].find(timer=>timer.at===180000);assert.ok(timeout);qa.at(180000);timeout.fn();assert.equal(qa.recorders[0].stopCount,1);assert.equal(qa.timers.size,0);await qa.recorders[0].finish();await qa.flush();
  const report=qa.state().lastReport;assert.equal(report.invalid,true);assert.equal(report.reason,'companion-encounter-timeout-180s');assert.equal(report.elapsedDurationMs,180000);assert.equal(report.durationPolicy.minimumMs,48000);assert.equal(report.durationPolicy.maximumMs,180000);
  assert.match(qa.elements.get('status').textContent,/180\.0 s.*最少 48 s.*最长 180 s.*invalid/);assert.equal(game.audio.master.connected.size,0);assert.ok(qa.streams[0].getTracks().every(track=>track.stopped));
});

test('the wall watchdog only invalidates even when a complete rendered frame is waiting for the next tick',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game,current=await qa.record('companion');game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();
  Object.assign(game.companionState.actors[0],{busy:false,state:'walk',distance:1.26,completedInteraction:{interactionCount:1,startedAt:4,completedAt:9,distance:1.2,resumedAt:12,resumedDistance:1.26}});game.companionState.activeTime=12;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:5}];
  qa.at(179900);qa.runFrame();assert.ok(current.completionFrame);assert.equal(qa.recorders[0].stopCount,0);const timeout=[...qa.timers.values()].find(timer=>timer.at===180000);qa.at(180000);timeout.fn();await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;
  assert.equal(report.invalid,true);assert.equal(report.reason,'companion-encounter-timeout-180s');assert.equal(report.renderedCompanionCompletion.elapsedDurationMs,179900);assert.equal(report.elapsedDurationMs,180000);
});

test('completion first observed after the wall limit remains invalid and reports actual elapsed time',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game;await qa.record('companion');game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();
  game.companionState.activeTime=12;Object.assign(game.companionState.actors[0],{busy:false,state:'walk',distance:2.2,completedInteraction:{interactionCount:1,startedAt:4,completedAt:9,distance:2,resumedAt:11,resumedDistance:2.1}});game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'elizabeth',kind:'sign-tap',acceptedTime:5}];
  qa.at(180250);qa.updateSequence();await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;assert.equal(report.invalid,true);assert.equal(report.reason,'companion-encounter-timeout-180s');assert.equal(report.elapsedDurationMs,180250);assert.equal(report.durationPolicy.maximumMs,180000);
});

test('incomplete action recordings retain greeting, matching audio, receipt and resumed-travel gates through the wall limit',async()=>{
  for(const mode of ['sniff','aborted','no-resume','stale-receipt','old-audio','other-audio','wrong-sound','short-travel','invalid']){
    const qa=await fixture({query:'?view=companion-sadaharu'}),game=qa.state().game;await qa.record('companion');game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();assert.equal(qa.state().session.encounter.accepted,true);
    const actor=game.companionState.actors[1];Object.assign(actor,{distance:2.2,state:'walk',busy:false,completedInteraction:{interactionCount:1,startedAt:4,completedAt:10,distance:2,resumedAt:11,resumedDistance:2.1}});game.companionState.activeTime=12;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'sadaharu',kind:'dog-breath',acceptedTime:7}];
    if(mode==='sniff'){actor.state='sniff';actor.busy=true;actor.completedInteraction=null;game.companionState.activeTime=7;}
    if(mode==='aborted'){actor.state='rest';actor.completedInteraction=null;}
    if(mode==='no-resume'){actor.state='rest';actor.completedInteraction.resumedAt=null;actor.completedInteraction.resumedDistance=null;}
    if(mode==='stale-receipt')actor.completedInteraction.interactionCount=0;
    if(mode==='old-audio')game.companionState.audio.recentEvents[0].acceptedTime=3;
    if(mode==='other-audio')game.companionState.audio.recentEvents[0].actorId='elizabeth';
    if(mode==='wrong-sound')game.companionState.audio.recentEvents[0].kind='sign-tap';
    if(mode==='short-travel'){actor.distance=.99;Object.assign(actor.completedInteraction,{distance:.8,resumedDistance:.9});}
    if(mode==='invalid')actor.valid=false;
    qa.at(48000);qa.runFrame();assert.equal(qa.recorders[0].stopCount,mode==='invalid'?1:0,mode);assert.equal(qa.state().session.completionFrame,null,mode);
    if(mode!=='invalid'){qa.at(180000);qa.updateSequence();}await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;assert.equal(report.invalid,true,mode);assert.equal(report.completed,false,mode);assert.equal(report.expectedDurationMs,48000);assert.equal(report.elapsedDurationMs,mode==='invalid'?48000:180000);assert.equal(report.reason,mode==='invalid'?'companion-invalid':'companion-encounter-timeout-180s');assert.equal(game.audio.master.connected.size,0);
  }
});

test('extended companion recording preserves immediate interruption reasons and releases its watchdog',async()=>{
  for(const [mode,reason] of [['blur','window-blurred'],['pause','companion-paused'],['reduced','companion-reduced-motion'],['hidden','page-hidden'],['cancel','cancelled'],['recorder','recorder-stopped-early']]){
    const qa=await fixture({query:'?view=companion-sadaharu'});await qa.record('companion');const timeout=[...qa.timers.values()].find(timer=>timer.at===180000);
    qa.at(60000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0,mode);
    if(mode==='blur')qa.listeners.blur();
    else if(mode==='pause')qa.state().game.setPaused(true);
    else if(mode==='reduced'){qa.state().game.companionState.reducedMotion=true;qa.updateSequence();}
    else if(mode==='hidden'){qa.document.hidden=true;qa.listeners.visibilitychange();}
    else if(mode==='cancel')void qa.stop('cancelled');
    if(mode==='recorder')await qa.recorders[0].finish();else{assert.equal(qa.recorders[0].stopCount,1,mode);await qa.recorders[0].finish();}
    await qa.flush();const report=qa.state().lastReport;assert.equal(report.invalid,true,mode);assert.equal(report.reason,reason,mode);assert.equal(report.elapsedDurationMs,60000);assert.equal(qa.timers.size,0);assert.equal(qa.elements.get('reset').disabled,false);assert.equal(qa.state().game.audio.master.connected.size,0);assert.ok(qa.streams[0].getTracks().every(track=>track.stopped));
    qa.at(180000);timeout.fn();assert.equal(qa.state().lastReport.reason,reason,'a stale timeout must not replace the interruption reason');
  }
});

test('paused companion recordings invalidate on blur or current pause/reduced state without waiting for accepted time',async()=>{
  for(const mode of ['blur','pause','reduced']){
    const qa=await fixture({query:'?view=companion-sadaharu'}),game=qa.state().game;await qa.record('companion');game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();assert.equal(qa.state().session.encounter.accepted,true);
    Object.assign(game.companionState.actors[1],{distance:2,state:'sniff',busy:true});game.companionState.activeTime=7;game.companionState.audio.played=1;game.companionState.audio.recentEvents=[{sequence:1,actorId:'sadaharu',kind:'dog-breath',acceptedTime:7}];qa.at(7000);qa.updateSequence();
    if(mode==='blur'){assert.equal(typeof qa.listeners.blur,'function');qa.listeners.blur();}
    else{game.companionState[mode==='pause'?'paused':'reducedMotion']=true;qa.updateSequence();}
    assert.equal(qa.recorders[0].stopCount,1,mode);await qa.recorders[0].finish();await qa.flush();assert.equal(qa.state().lastReport.invalid,true);assert.equal(qa.state().lastReport.elapsedDurationMs,7000);qa.at(48000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,1);assert.equal(game.companionState.activeTime,7);
  }
});

test('a portfolio return value cannot impersonate a newly accepted selected-actor interaction',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game;await qa.record('companion');game.interact=()=>true;game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();assert.equal(qa.state().session.encounter.accepted,false);const ending=qa.stop('test-end');await qa.recorders[0].finish();await ending;
});

test('a synchronous Game pause during interaction invalidates the recording before further advancement',async()=>{
  const qa=await fixture({query:'?view=companion-elizabeth'}),game=qa.state().game;await qa.record('companion');const interact=game.interact.bind(game);game.interact=options=>{const accepted=interact(options);game.setPaused(true);return accepted;};
  game.companionState.activeTime=4;qa.at(4000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,1);await qa.recorders[0].finish();await qa.flush();assert.equal(qa.state().lastReport.reason,'companion-paused');assert.equal(qa.state().lastReport.completed,false);
});

test('real accepted actors supply complete receipts and resumed motion to the 48-second recorder',async t=>{
  await loadAcceptedCompanions();
  for(const id of ['elizabeth','sadaharu']){
    const qa=await fixture({query:'?view=companion-'+id}),game=qa.state().game,events=[];
    const system=createCompanionSystem({root:new THREE.Group(),heightAt:()=>1,waterLevel:0,placements:[{kind:id,position:{x:0,z:0},heading:0,waypoints:[{x:0,z:8}]}],onSound:event=>events.push({sequence:events.length+1,actorId:event.actorId,kind:event.kind,acceptedTime:event.time})});
    try{
      game.companionSnapshot=()=>({...system.snapshot(),installation:{status:'ready'},audio:{played:events.length,recentEvents:events.slice(-32)}});
      game.interact=({companionId})=>{const actor=system.snapshot().actors[0],accepted=system.interact(companionId,{playerPosition:{x:actor.position.x,y:actor.position.y+1.3,z:actor.position.z+4}});game.callbacks.onFrame({companions:game.companionSnapshot()});return accepted;};
      await qa.record('companion');
      for(let frame=1;frame<=2880;frame++){system.update(1/60);qa.at(frame/60*1000);qa.runFrame();}
      await qa.recorders[0].finish();await qa.flush();const report=qa.state().lastReport;
      assert.equal(report.invalid,false,id+': '+report.reason);assert.equal(report.elapsedDurationMs,48000);assert.equal(report.encounter.completion.interactionCount,report.encounter.interactionCount);assert.ok(report.encounter.completion.resumedAt>report.encounter.completion.completedAt);assert.ok(report.companions.actors[0].distance-report.encounter.initialDistance>=1);assert.ok(report.encounter.audioEvents.some(event=>event.kind===(id==='elizabeth'?'sign-tap':'dog-breath')));
      assert.equal(game.audio.master.connected.size,0);assert.ok(qa.streams[0].getTracks().every(track=>track.stopped));
      t.diagnostic(JSON.stringify({id,acceptedAt:report.encounter.acceptedAt,completion:report.encounter.completion,distance:report.companions.actors[0].distance,wallMilliseconds:report.elapsedDurationMs,nativeRecorder:false}));
    }finally{system.dispose();}
  }
});

test('staged review holds rendering until enhancement success, then capture waits for the composer frame and records loading provenance',async()=>{
  const saves=[],qa=await fixture({query:'?loading=staged&lighting=solar-120-cloud70',deferFull:true,save:async(url,options)=>{saves.push({url,options});return{ok:true};}}),game=qa.state().game;
  assert.equal(qa.frames.size,0);assert.match(qa.elements.get('loading-policy').textContent,/15-minute/);
  game.progress({phase:'enhancements-begin',deadline:900000});game.progress({phase:'enhancements',enhancements:'ready'});
  assert.equal(qa.frames.size,1);assert.equal(game._lastFrame,0);assert.equal(qa.elements.get('frame').disabled,true);
  game._fullFrame=()=>game.progress({phase:'full-frame',enhancements:'ready'});qa.runFrame();assert.equal(qa.elements.get('frame').disabled,false);assert.equal(qa.timers.size,0);
  qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();await qa.flush();
  const metadata=JSON.parse(await saves.find(r=>r.url.endsWith('.json')).options.body.text());assert.deepEqual(metadata.loading,{mode:'staged',coreBudgetMs:180000,enhancementBudgetMs:900000,continuousRenderingDuringEnhancement:false});assert.equal(metadata.evidenceType,'actual-frame');
  qa.begin('measure');assert.deepEqual({...qa.state().session.metadata.loading},{mode:'staged',coreBudgetMs:180000,enhancementBudgetMs:900000,continuousRenderingDuringEnhancement:false});await qa.stop('test-end');qa.listeners.pagehide();await qa.flush();
});

test('staged timeout or failed enhancements never enable capture and late completion cannot revive a closed page',async()=>{
  for(const failure of ['timeout','source']){
    const qa=await fixture({query:'?loading=staged',deferFull:true}),game=qa.state().game;game.progress({phase:'enhancements-begin',deadline:900000});
    if(failure==='timeout'){qa.at(900001);[...qa.timers.values()][0].fn();}else game.progress({phase:'enhancements',enhancements:'degraded',errors:['missing source']});
    game.progress({phase:'enhancements',enhancements:'ready'});game.progress({phase:'full-frame',enhancements:'ready'});assert.equal(qa.document.body.dataset.ready,'degraded');assert.equal(qa.frames.size,0);assert.equal(qa.elements.get('frame').disabled,true);assert.equal(game._enhancementController.signal.aborted,true);
    qa.listeners.pagehide();qa.listeners.pagehide();await qa.flush();game.progress({phase:'enhancements',enhancements:'ready'});assert.equal(qa.frames.size,0);assert.equal(qa.timers.size,0);assert.equal(qa.unsubscribed,1);
  }
});

test('staged composer failure cancels its scheduled successor and a core-only frame cannot arm capture',async()=>{
  const qa=await fixture({query:'?loading=staged',deferFull:true,renderError:true}),game=qa.state().game;
  qa.elements.get('frame').onclick();assert.equal(qa.state().saveFrame,null);
  game.progress({phase:'enhancements-begin',deadline:900000});game.progress({phase:'enhancements',enhancements:'ready'});game._fullFrame=()=>game.progress({phase:'full-frame',enhancements:'ready'});
  assert.throws(()=>qa.runFrame(),/actual composer failed/);assert.equal(qa.frames.size,0);assert.equal(qa.document.body.dataset.ready,'degraded');assert.equal(qa.elements.get('frame').disabled,true);assert.equal(game._enhancementController.signal.aborted,true);
  qa.listeners.pagehide();await qa.flush();
});

test('pagehide during core readiness aborts construction and disposes a late returned Game without scheduling enhancements',async()=>{
  const qa=await fixture({query:'?loading=staged',deferFull:true,hideDuringCore:true});await qa.flush();
  assert.equal(qa.state().game.constructionContext.signal.aborted,true);assert.equal(qa.state().game._disposed,true);assert.equal(qa.frames.size,0);assert.equal(qa.unsubscribed,1);assert.equal(qa.state().metrics,undefined);
});

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

test('ordinary video and audition retain their 24-second wall duration without an encounter watchdog',async()=>{
  for(const kind of ['record','audition']){
    const qa=await fixture();qa.state().game.audio.update=()=>{};await qa.record(kind);assert.equal(qa.timers.size,0);qa.at(23999);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,0);qa.at(24000);qa.updateSequence();assert.equal(qa.recorders[0].stopCount,1);await qa.recorders[0].finish();await qa.flush();
    const report=qa.state().lastReport;assert.equal(report.completed,true);assert.equal(report.expectedDurationMs,24000);assert.equal(report.elapsedDurationMs,24000);assert.equal(report.durationPolicy,undefined);
  }
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
  const pending=[],qa=await fixture({capture:callback=>pending.push(callback)});qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();
  qa.elements.get('view').value='shore';qa.elements.get('quality').value='low';qa.reset();pending[0](new Blob(['frame'],{type:'image/png'}));await qa.flush();
  assert.match(qa.downloads[0].download,/test-build-court-night-high-lod-native-frame-/);
});

test('lighting study selects an explicit variant, starts with full native static controls and restores baseline',async()=>{
  const qa=await fixture({query:'?light=day&lighting=pearl-fill'}),select=qa.elements.get('lighting-variant');assert.ok(select);assert.equal(select.value,'pearl-fill');assert.equal(qa.state().game.environment.lightingVariant,'pearl-fill');assert.equal(qa.elements.get('reduced-motion').checked,true);assert.equal(qa.elements.get('foliage').value,'full');assert.equal(qa.elements.get('sampling').value,'native');
  select.value='baseline';select.onchange();assert.equal(qa.state().game.environment.lightingVariant,'baseline');assert.equal(qa.state().game.environment.fillIntensity,.6);qa.begin('measure');assert.equal(select.disabled,true);assert.equal(qa.state().session.metadata.lightingVariant,'baseline');await qa.stop('test-end');
});

test('R14 default review lighting and recorded metadata match sunlit while explicit cloud70 comparisons remain available',async()=>{
  const html=await readFile(new URL('../quality-review.html',import.meta.url),'utf8');assert.match(html,/data-build="living-v8-island-r14"/);assert.match(html,/最少 48 秒.*最长 180 秒/);
  for(const [query,variant] of [['?light=day','solar-120-sunlit'],['?light=day&lighting=solar-120-cloud70','solar-120-cloud70']]){
    const qa=await fixture({query}),game=qa.state().game;assert.equal(qa.elements.get('lighting-variant').value,variant);assert.equal(game.environment.lightingVariant,variant);assert.ok(Math.abs(game.environment.fillIntensity-(variant==='solar-120-sunlit'?.45:.60))<1e-12);
    qa.begin('measure');const report=await qa.stop('test-end');assert.equal(report.lightingVariant,variant);assert.equal(report.lighting.variant,variant);
  }
});

test('activity reset is explicit, locked during recording and saved with actual population first/last state',async()=>{
  const qa=await fixture({query:'?lighting=solar-120-cloud70&activity=12.5'}),game=qa.state().game,resets=[];
  let activity=12.5;game.world.atmosphere={root:{getObjectByName:()=>undefined},resetActivityForReview:(time,reduced)=>{resets.push({time,reduced});activity=time;},fauna:{snapshot:()=>({activityTime:activity,counts:{birds:12,fireflies:90,ambientLanterns:26}})}};
  qa.reset();assert.deepEqual(resets.at(-1),{time:12.5,reduced:true});assert.equal(qa.elements.get('activity-start').value,'12.5');
  qa.elements.get('reduced-motion').checked=false;await qa.record('record');assert.equal(qa.elements.get('activity-start').disabled,true);assert.equal(qa.elements.get('release-lantern').disabled,true);
  activity=12.6;game.rendering.render(.1);qa.at(2000);activity=14.5;game.rendering.render(.1);
  const ending=qa.stop('completed',true);await qa.recorders[0].finish();const report=await ending;
  assert.equal(report.activityStart,12.5);assert.equal(report.renderedFauna.first.activityTime,12.6);assert.equal(report.renderedFauna.last.activityTime,14.5);assert.equal(report.motionSamples.at(-1).fauna.counts.birds,12);assert.match(qa.downloads[0].download,/-a12p500-/);
});

test('lighting still name and paired JSON retain the rendered trial and exact light state',async()=>{
  const pending=[],saves=[],qa=await fixture({query:'?light=day&lighting=pearl-fill',capture:callback=>pending.push(callback),save:async(url,options)=>{saves.push({url,options});return{ok:true};}});
  // A diagnostic light mutation must appear in evidence instead of its old palette input.
  qa.state().game.fillLight={color:{toArray:()=>[.81,.72,.63]},intensity:.61,position:{toArray:()=>[60,80,100]}};
  qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();qa.elements.get('lighting-variant').value='baseline';qa.reset();pending[0](new Blob(['frame'],{type:'image/png'}));await qa.flush();await qa.flush();
  assert.match(saves[0].url,/lighting-pearl-fill-/);const metadata=JSON.parse(await saves.find(r=>r.url.endsWith('.json')).options.body.text());assert.equal(metadata.lightingVariant,'pearl-fill');assert.equal(metadata.lighting.variant,'pearl-fill');assert.ok(Math.abs(metadata.lighting.phase-TIME_PHASES.day)<1e-12);assert.equal(metadata.lighting.fill.intensity,.61);assert.deepEqual(metadata.lighting.fill.colorLinear,[.81,.72,.63]);assert.equal(metadata.reducedMotion,true);assert.equal(metadata.foliage,'full');
});

test('a lighting frame finishing PNG encoding after page exit publishes no stale files',async()=>{
  const pending=[],qa=await fixture({query:'?light=day&lighting=pearl-fill',capture:callback=>pending.push(callback)});qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();qa.listeners.pagehide();pending[0](new Blob(['frame'],{type:'image/png'}));await qa.flush();assert.equal(qa.downloads.length,0);
});

test('cloud comparison selects the stable solar base and saves the actual sky blend instead of a stale palette input',async()=>{
  const saves=[],qa=await fixture({query:'?view=overview&light=day&lighting=solar-120-cloud70',save:async(url,options)=>{saves.push({url,options});return{ok:true};}});
  const game=qa.state().game;assert.equal(game.environment.cloudBlend,.70);assert.equal(game.environment.keyHandoff,'western-azimuth-elevation');
  game.world.atmosphere={fauna:{motion:{},snapshot:()=>null},root:{getObjectByName:()=>({material:{uniforms:{skyTime:{value:0},cloudBlend:{value:.69}}}})}};
  qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();await qa.flush();
  assert.match(saves[0].url,/lighting-solar-120-cloud70-/);const metadata=JSON.parse(await saves.find(r=>r.url.endsWith('.json')).options.body.text());
  assert.equal(metadata.lighting.cloudBlend,.69);assert.equal(metadata.lighting.skyTime,0);assert.equal(metadata.lighting.keyHandoff,'western-azimuth-elevation');assert.equal(metadata.foliage,'full');assert.equal(metadata.sampling,'native');
  qa.elements.get('lighting-variant').value='solar-120-stable';qa.reset();assert.equal(game.environment.cloudBlend,.83);assert.equal(game.environment.solarAzimuthDegrees,120);
});

test('an explicit auto start phase resets identical solar sweep conditions and is recorded in the actual-frame identity',async()=>{
  const saves=[],qa=await fixture({query:'?light=auto&lighting=solar-120&phase=0.2',save:async(url,options)=>{saves.push({url,options});return{ok:true};}});
  assert.equal(qa.elements.get('phase-start').value,'0.2');assert.ok(Math.abs(qa.state().game.environment.phase-.2)<1e-12);
  qa.state().game.environmentClock.phase=.31;qa.reset();assert.equal(qa.state().game.environmentClock.phase,.2);
  qa.elements.get('frame').onclick();qa.runFrame();await qa.flush();await qa.flush();await qa.flush();assert.match(saves[0].url,/lighting-solar-120-p0p2000-/);
  const metadata=JSON.parse(await saves.find(r=>r.url.endsWith('.json')).options.body.text());assert.equal(metadata.startPhase,.2);assert.equal(metadata.lighting.solarAzimuthDegrees,120);
  qa.begin('measure');assert.equal(qa.elements.get('phase-start').disabled,true);await qa.stop('test-end');
  qa.elements.get('light').value='day';qa.reset();assert.ok(Math.abs(qa.state().game.environment.phase-TIME_PHASES.day)<1e-12,'fixed time ignores the auto-only start field');
});

test('a solar movie saves its own paired metadata with first and last actually rendered light phases',async()=>{
  for(const variant of ['solar-120','solar-120-stable']){
  const saves=[],qa=await fixture({query:`?light=auto&lighting=${variant}&phase=0.2`,save:async(url,options)=>{saves.push({url,options});return{ok:true};}});
  qa.elements.get('reduced-motion').checked=false;await qa.record('record');const game=qa.state().game;
  game.rendering.render(1/60);qa.at(23900);game.environmentClock.phase=.299;game._updateEnvironment();game.rendering.render(1/60);
  qa.at(24000);const stopping=qa.stop('completed',true);await qa.recorders[0].finish();await stopping;
  const video=saves.find(r=>r.url.endsWith('.webm')),json=saves.find(r=>r.url.endsWith('.json'));assert.equal(json.url,video.url.replace('.webm','.json'));
  const metadata=JSON.parse(await json.options.body.text());assert.ok(metadata.completed);assert.equal(metadata.startPhase,.2);assert.ok(Math.abs(metadata.renderedLighting.first.phase-.2)<1e-12);assert.ok(Math.abs(metadata.renderedLighting.last.phase-.299)<1e-12);assert.equal(metadata.renderedLighting.last.solarAzimuthDegrees,120);
  assert.ok(video.url.includes(`lighting-${variant}-p0p2000-`));assert.equal(metadata.renderedLighting.first.variant,variant);assert.equal(metadata.renderedLighting.last.keyHandoff,variant==='solar-120-stable'?'western-azimuth-elevation':'normalized-vector');
  }
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
  views.value='conservatory-interior';views.onchange();qa.state().game._updateCamera();
  assert.equal(qa.state().game.camera.fov,70,'the inhabited hall uses its reviewed interior field of view');
  views.value='court';views.onchange();qa.state().game._updateCamera();
  assert.equal(qa.state().game.camera.fov,43,'the wide interior lens must not leak into ordinary review views');
});

test('paired lantern diagnostic contains the actual paper and its water-plane image with clear terrain sightlines',async()=>{
  const {createFaunaPopulation}=await import('../src/fauna-population.js'),{createLake}=await import('../src/landscape.js');
  const {decodeGeometryGLB}=await import('./helpers/herbarium-source.js'),{assetManifest}=await import('../src/asset-manifest.js');
  const {DEPTH_RIDGES,ridgeGeometry}=await import('../src/landscape-depth.js');
  const saves=[],qa=await fixture({query:'?view=fauna-reflection-pair&light=night&lighting=solar-120-cloud70&activity=0',nativeDpr:2.5,width:1024,height:576,save:async(url,options)=>{saves.push({url,options});return{ok:true};}}),game=qa.state().game;
  const scene=new THREE.Scene(),fauna=createFaunaPopulation({heightAt:()=>7}),lake=createLake(scene,scene);scene.add(fauna.root);
  game.world.lake=lake;game.world.atmosphere={root:new THREE.Group(),fauna,resetActivityForReview:(time,reduced)=>fauna.resetActivityForReview(time,reduced)};
  const terrain=(await decodeGeometryGLB(await readFile(new URL(`../public${assetManifest['navigation-terrain'].url}`,import.meta.url)))).scene;
  const coastMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),coast=DEPTH_RIDGES.map(ridge=>new THREE.Mesh(ridgeGeometry(ridge),coastMaterial));
  scene.add(terrain,...coast);scene.updateMatrixWorld(true);const before=fauna.motion.lanterns.map(item=>({base:item.base.toArray(),position:item.position.toArray(),scale:item.scale}));
  try{
    qa.elements.get('view').value='fauna-reflection-pair';qa.reset();game._updateCamera();
    const item=fauna.motion.lanterns[4],paper=fauna.root.children.filter(object=>object.name==='Continuous folded translucent paper shell')[4];
    const normal=new THREE.Vector3(0,0,1).transformDirection(lake.water.matrixWorld),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,lake.water.getWorldPosition(new THREE.Vector3()));
    const box=new THREE.Box3().setFromObject(paper),center=box.getCenter(new THREE.Vector3()),reflected=center.clone().addScaledVector(normal,-2*plane.distanceToPoint(center)),camera=game.camera;
    const vertex=new THREE.Vector3();for(let i=0;i<paper.geometry.attributes.position.count;i++){
      vertex.fromBufferAttribute(paper.geometry.attributes.position,i).applyMatrix4(paper.matrixWorld);
      for(const point of [vertex,vertex.clone().addScaledVector(normal,-2*plane.distanceToPoint(vertex))]){
        const ndc=point.clone().project(camera);assert.ok(Math.abs(ndc.x)<.8&&Math.abs(ndc.y)<.8&&ndc.z>0&&ndc.z<1,'both complete real paper silhouettes must remain inside a 10 percent native-frame margin');
      }
    }
    assert.ok(Math.abs(center.clone().project(camera).x-reflected.clone().project(camera).x)<1e-6,'the paired image must be vertically corresponding');
    const blockers=[terrain,...coast],eye=camera.position.clone(),mirrorEye=eye.clone().addScaledVector(normal,-2*plane.distanceToPoint(eye));
    for(const point of [center,box.min,box.max]){
      const virtual=point.clone().addScaledVector(normal,-2*plane.distanceToPoint(point));
      const bounce=plane.intersectLine(new THREE.Line3(eye,virtual),new THREE.Vector3());assert.ok(bounce,'reflection must land on the actual water in front of the eye');
      for(const [start,end]of [[eye,point],[eye,bounce],[bounce.clone().addScaledVector(normal,.001),point]]){
        const direction=end.clone().sub(start),ray=new THREE.Raycaster(start,direction.clone().normalize(),.001,direction.length()-.01);assert.equal(ray.intersectObjects(blockers,true).length,0,'actual decoded terrain and coastal meshes must not block the direct or reflected sightline');
      }
    }
    assert.ok(mirrorEye.y<-15);assert.equal(camera.fov,43);assert.equal(qa.canvas.width,2560);assert.equal(qa.canvas.height,1440);
    assert.deepEqual(fauna.motion.lanterns.map(item=>({base:item.base.toArray(),position:item.position.toArray(),scale:item.scale})),before,'review framing cannot move or scale the population');
    qa.elements.get('frame').onclick();qa.runFrame();
    const saveDeadline=performance.now()+5000;
    while(!saves.some(saved=>saved.url.endsWith('.json'))&&performance.now()<saveDeadline){await qa.flush();await new Promise(resolve=>setTimeout(resolve,5));}
    assert.ok(saves.some(saved=>saved.url.endsWith('.json')),qa.elements.get('status').textContent);
    const metadata=JSON.parse(await saves.find(saved=>saved.url.endsWith('.json')).options.body.text()),pair=metadata.camera.reflectionPair;
    assert.equal(pair.lanternIndex,4);assert.deepEqual(pair.lanternPosition,item.position.toArray());assert.ok(new THREE.Vector3(...pair.center).distanceTo(center)<1e-8);assert.ok(new THREE.Vector3(...pair.mirroredCenter).distanceTo(reflected)<1e-8);
    assert.ok(pair.lanternNdc[1]>.5&&pair.mirrorNdc[1]<-.5);assert.equal(metadata.lighting.cloudBlend,.7);assert.equal(metadata.foliage,'full');assert.equal(metadata.sampling,'native');
    assert.equal(qa.elements.get('view').value,'fauna-reflection-pair');assert.ok(qa.elements.get('view').children.some(option=>option.value==='fauna-reflection'));
    assert.ok(item.position.distanceTo(center)<2);
    lake.water.position.y=-12;game._updateCamera();assert.ok(Math.abs(game.camera.target[1]+12)<1e-8,'framing reads the real mirror plane rather than a duplicated water-height constant');
  }finally{fauna.dispose();const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[])materials.add(material);});geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());}
});

test('QA sampling explicitly synchronizes renderer and composer and Native restores the existing policy',async()=>{
  const qa=await fixture({width:1024,height:576}),select=qa.elements.get('sampling'),game=qa.state().game;
  assert.equal(select.value,'native');assert.equal(select.disabled,false);assert.equal(game.renderer.getPixelRatio(),1.25);assert.equal(qa.canvas.width,1280);assert.equal(qa.canvas.height,720);
  select.value='2x';select.onchange();assert.equal(game.renderer.getPixelRatio(),2);assert.equal(game.rendering.lastSize.dpr,2);assert.equal(qa.canvas.width,2048);assert.equal(qa.canvas.height,1152);
  select.value='2.5x';select.onchange();assert.equal(game.renderer.getPixelRatio(),2.5);assert.equal(game.rendering.lastSize.dpr,2.5);assert.equal(qa.canvas.width,2560);assert.equal(qa.canvas.height,1440);
  qa.canvas.clientWidth=800;qa.canvas.clientHeight=450;game._resize();assert.equal(game.renderer.getPixelRatio(),2.5);assert.equal(game.rendering.lastSize.dpr,2.5);assert.equal(qa.canvas.width,2000);assert.equal(qa.canvas.height,1125);
  select.value='native';select.onchange();assert.equal(game.renderer.getPixelRatio(),1.25);assert.equal(game.rendering.lastSize.dpr,1.25);assert.equal(qa.canvas.width,1000);assert.equal(qa.canvas.height,562);
  assert.match(qa.elements.get('sampling-size').textContent,/800 × 450 CSS → 1000 × 562 px · DPR 1.25/);
});

test('sampling is locked throughout a run and exported with actual CSS, backing size, DPR and filenames',async()=>{
  const qa=await fixture({width:1024,height:576}),select=qa.elements.get('sampling'),game=qa.state().game;select.value='2.5x';select.onchange();
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
  const sightline=shortenCameraBoom(new THREE.Vector3(...game.camera.target),new THREE.Vector3(...entry),createBuildingColliders().filter(c=>c.buildingId==='projects'));
  assert.equal(sightline.blocked,false,`workshop blocks conservatory sightline: ${sightline.colliderId}`);
  assert.ok(views.children.some(option=>option.value==='conservatory-interior'));
  views.value='conservatory-interior';views.onchange();game._updateCamera();const interior=game.camera.position.toArray();
  const house=herbariumSites.find(s=>s.id==='conservatory'),local=new THREE.Vector3(...interior).sub(new THREE.Vector3(house.x,house.floor,house.z)).applyAxisAngle(new THREE.Vector3(0,1,0),-house.rotation);
  assert.ok(Math.abs(local.x)<1.1&&local.y>1.3&&local.y<3.6&&local.z>-3.75&&local.z<4.5,'interior eye is inside the actual transformed source aisle');
  views.value='arcade-passage';views.onchange();game._updateCamera();assert.equal(game.camera.position.toArray()[1],8.7,'arcade eye follows actual support plus 1.7 m');
  for(const id of ['water-entry','west-community','east-community']){assert.ok(views.children.some(option=>option.value===id));views.value=id;views.onchange();game._updateCamera();assert.equal(game.camera.position.y,8.7,`${id} follows actual support at human eye height`);assert.ok(game.camera.position.distanceTo(new THREE.Vector3(...game.camera.target))>5,'review camera looks across a real community or destination');}
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


test('changing rooted soil invalidates measurements made under the previous material conditions',async()=>{
  const qa=await fixture();await qa.record('record');qa.at(24000);qa.updateSequence();await qa.recorders[0].finish();await qa.flush();
  assert.ok(qa.state().lastReport);assert.equal(qa.elements.get('json').disabled,false);
  const control=qa.elements.get('rooted-loam');control.value='0';control.onchange();
  assert.equal(qa.state().lastReport,null);assert.equal(qa.elements.get('json').disabled,true);
  qa.listeners.pagehide();
});
