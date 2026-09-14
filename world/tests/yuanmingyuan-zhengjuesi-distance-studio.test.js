import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createDistanceApproachTrace} from '../src/yuanmingyuan/zhengjuesi-distance-studio-state.js';
import {overviewAffineScaleBound,projectedOverviewError} from '../src/yuanmingyuan/asset-overview.js';
import {fitStudyShadow} from '../src/yuanmingyuan/shadow-framing.js';
import {impostorStudioLighting} from '../src/yuanmingyuan/impostor-studio-state.js';

// Metadata only: never decode the production GLB or construct its factory.
const manifest=JSON.parse(await readFile(new URL('../public/assets/yuanmingyuan-distance/zhengjuesi-distance/202a091fca7d4eac-gzip-bin-v1/manifest.json',import.meta.url))),report=manifest.distance.report;
const html=await readFile(new URL('../zhengjuesi-distance-studio.html',import.meta.url),'utf8'),source=await readFile(new URL('../src/yuanmingyuan/zhengjuesi-distance-studio.js',import.meta.url),'utf8');
const makeBounds=()=>new THREE.Box3(new THREE.Vector3(...report.boundsArchiveWorld.min),new THREE.Vector3(...report.boundsArchiveWorld.max));

function actualCamera({direction=[.55,0,.84],metres=500,height=40}={}){
  const bounds=makeBounds(),centre=bounds.getCenter(new THREE.Vector3()),camera=new THREE.PerspectiveCamera(40,2435/2200,5,2000),controls=new OrbitControls(camera,null);
  controls.enableDamping=false;controls.minDistance=20;controls.maxDistance=1400;controls.target.set(centre.x,bounds.min.y+5,centre.z);
  camera.position.copy(centre).addScaledVector(new THREE.Vector3(...direction).normalize(),metres);camera.position.y=bounds.min.y+height;camera.lookAt(controls.target);camera.updateMatrixWorld(true);controls.update();camera.updateMatrixWorld(true);
  return {camera,controls,bounds,centre};
}

test('actual native camera and OrbitControls reproduce inverse roundoff; projection canonicalizes it without weakening affine validation',()=>{
  const {camera}=actualCamera(),root=new THREE.Matrix4().fromArray(report.sourceRootWorldMatrix),placement=new THREE.Matrix4().multiplyMatrices(root,root.clone().invert()),rawView=new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,placement);
  assert.deepEqual([3,7,11].map(i=>rawView.elements[i]),[0,0,0]);assert.equal(rawView.elements[15],.9999999999999998);
  assert.throws(()=>overviewAffineScaleBound(rawView),/finite affine/,'the strict validator still rejects the noncanonical raw representation');
  const before=rawView.toArray(),result=projectedOverviewError({camera,physicalWidth:2435,physicalHeight:2200,bounds:report.boundsArchiveWorld,error:report.maximumErrorArchiveWorld,placementMatrix:placement});
  assert(Number.isFinite(result.projectedErrorPhysicalPixels));assert(Math.abs(result.projectedErrorPhysicalPixels-.641887038898967)<1e-12);assert.equal(result.eligible,false);
  assert.deepEqual(camera.matrixWorldInverse.toArray(),before,'evaluation must not modify the renderer camera');
});

test('positive and negative homogeneous scale preserve projection; projective, zero and nonfinite forms fail exactly',()=>{
  const camera=new THREE.PerspectiveCamera(40,1,5,2000);camera.position.z=600;camera.updateMatrixWorld(true);
  const common={camera,physicalWidth:2200,physicalHeight:2200,bounds:report.boundsArchiveWorld,error:report.maximumErrorArchiveWorld},base=projectedOverviewError(common),original=camera.matrixWorldInverse.clone();
  for(const scale of [3,-2,.9999999999999998]){
    camera.matrixWorldInverse.copy(original).multiplyScalar(scale);
    const result=projectedOverviewError(common);assert(Math.abs(result.projectedErrorPhysicalPixels-base.projectedErrorPhysicalPixels)<1e-12);assert.equal(result.eligible,base.eligible);
  }
  camera.matrixWorldInverse.copy(original);
  for(const component of [3,7,11])for(const value of [Number.MIN_VALUE,Number.EPSILON,-1]){
    const placementMatrix=new THREE.Matrix4();placementMatrix.elements[component]=value;
    assert.throws(()=>projectedOverviewError({...common,placementMatrix}),/finite affine/,'no epsilon accepts nonzero projective terms');
  }
  for(const value of [0,-0,NaN,Infinity,-Infinity]){
    const placementMatrix=new THREE.Matrix4();placementMatrix.elements[15]=value;
    assert.throws(()=>projectedOverviewError({...common,placementMatrix}),/finite affine/);
  }
  for(const component of [0,12])for(const value of [NaN,Infinity,-Infinity]){
    const placementMatrix=new THREE.Matrix4();placementMatrix.elements[component]=value;placementMatrix.elements[15]=-2;
    assert.throws(()=>projectedOverviewError({...common,placementMatrix}),/finite affine/);
  }
});

test('trace brackets successful frames, bounds its history, copies input, and resets only on begin',()=>{
  const trace=createDistanceApproachTrace({maximumSwitches:2});assert.equal(trace.snapshot(),null);
  trace.begin({nowMilliseconds:100,fromMetres:600,toMetres:200,durationMilliseconds:8000});
  const frame={renderSerial:1,representation:'distance',horizontalDistanceMetres:600,cameraPosition:[0,40,600],projectedErrorPhysicalPixels:.3};
  trace.rendered({nowMilliseconds:120,...frame});frame.cameraPosition[2]=0;
  trace.rendered({nowMilliseconds:140,...frame,cameraPosition:[0,40,590],renderSerial:2,horizontalDistanceMetres:590});
  for(let i=0;i<5;i++)trace.rendered({nowMilliseconds:200+i*10,...frame,renderSerial:i+3,representation:i%2?'distance':'full',horizontalDistanceMetres:580-i});
  const snapshot=trace.snapshot();assert.equal(snapshot.initialFrame.cameraPosition[2],600);assert.equal(snapshot.renderedFrames,7);assert.equal(snapshot.totalSwitches,5);assert.equal(snapshot.droppedSwitches,3);assert.equal(snapshot.switches.length,2);assert.equal(snapshot.switches[1].previousFrame.renderSerial,6);assert.equal(snapshot.switches[1].renderSerial,7);
  snapshot.switches.length=0;assert.equal(trace.snapshot().switches.length,2);
  trace.stop('paused',250);const stopped=trace.snapshot();trace.rendered({nowMilliseconds:300,...frame});trace.stop('capture',350);assert.deepEqual(trace.snapshot(),stopped);
  trace.begin({nowMilliseconds:400,fromMetres:600,toMetres:200,durationMilliseconds:8000});assert.equal(trace.snapshot().runId,2);assert.equal(trace.snapshot().renderedFrames,0);assert.equal(trace.snapshot().switches.length,0);
  assert.throws(()=>createDistanceApproachTrace({maximumSwitches:Infinity}),/capacity/);
});

// Execute the actual page event/render code with tiny real Three cameras and
// lights. Only the DOM, RAF, screenshot endpoint and GPU render are adapters.
// This proves event wiring and telemetry order, not browser pixels/native QA.
function pageFixture(){
  class Element{
    constructor(value=''){this.value=value;this.textContent='';this.dataset={};this.attributes={};this.handlers=new Map();}
    setAttribute(name,value){this.attributes[name]=value;}
    addEventListener(name,handler){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(handler);}
    emit(name){for(const handler of this.handlers.get(name)||[])handler({target:this});}
  }
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  for(const [name,value] of Object.entries({mode:'full',view:'oblique',range:'500',height:'40',hour:'12'}))elements.get('distance-'+name).value=value;
  const buttons=[...html.matchAll(/data-distance-preset="([^"]+)" data-value="([^"]+)"/g)].map(m=>{const node=new Element();node.dataset={distancePreset:m[1],value:m[2]};return node;});
  const canvas=new Element();canvas.toBlob=callback=>callback(new Blob(['fixture only']));
  const {camera,controls,bounds,centre}=actualCamera(),scene=new THREE.Scene(),sun=new THREE.DirectionalLight(),moon=new THREE.DirectionalLight(),hemi=new THREE.HemisphereLight();
  const renderer={shadowMap:{needsUpdate:false},info:{render:{},memory:{},reset(){}},getDrawingBufferSize:v=>v.set(2435,2200),getPixelRatio:()=>2};
  let now=0,nextFrame=1,fail=false;const callbacks=new Map(),posts=[];
  const post={samples:4,render(){if(fail)throw new Error('fixture GPU render failed');now+=7;}};
  const full={group:new THREE.Group()},distance={group:new THREE.Group(),distance:{report,manifestSHA256:'test-manifest',reportSHA256:'test-report'},evaluate({camera,physicalWidth,physicalHeight}){const result=projectedOverviewError({camera,physicalWidth,physicalHeight,bounds:report.boundsArchiveWorld,error:report.maximumErrorArchiveWorld});return {...result,geometricEligible:result.eligible,eligible:false};}};
  const context={THREE,createDistanceApproachTrace,fitStudyShadow,impostorStudioLighting,URL,URLSearchParams,AbortController,Blob,structuredClone,performance:{now:()=>now},location:{search:'',href:'http://fixture/zhengjuesi-distance-studio.html'},window:{addEventListener(){},removeEventListener(){}},document:{hidden:false,body:{dataset:{}},getElementById:id=>elements.get(id),querySelector:()=>canvas,querySelectorAll:()=>buttons,addEventListener(){}},requestAnimationFrame:callback=>{const id=nextFrame++;callbacks.set(id,callback);return id;},cancelAnimationFrame:id=>callbacks.delete(id),fetch:async(url,options)=>{posts.push({url,body:options.body});return {ok:true};},fixtureState:{camera,controls,bounds,centre,scene,sun,moon,hemi,renderer,post,full,distance}};
  const executable=source.replace(/^import .*;\n/gm,'').replace(/void prepare\(\);\s*$/,'')+'\n({camera,controls,bounds,centre,scene,sun,moon,hemi,renderer,post,full,distance}=fixtureState);loading=false;setView();setLight();';
  vm.runInNewContext(executable,context,{filename:'actual-distance-studio-test-adapter.js'});
  // Null-DOM OrbitControls never connect listeners and cannot call disconnect.
  return {camera,controls,sun,moon,posts,node:id=>elements.get(id),api:context.window.__ZHENGJUESI_DISTANCE_STUDY__,preset(kind,value){const button=buttons.find(b=>b.dataset.distancePreset===kind&&Number(b.dataset.value)===value);assert(button,'visible HTML preset exists');button.emit('click');return button;},advance(time){now=time;const entry=callbacks.entries().next().value;assert(entry,'page scheduled an animation frame');callbacks.delete(entry[0]);entry[1](time);},failRender(value){fail=value;},close(){callbacks.clear();}};
}

test('all nine visible presets drive the actual camera/light setters and selected button state',()=>{
  const page=pageFixture();try{
    for(const metres of [200,350,500,600]){const button=page.preset('range',metres),centre=makeBounds().getCenter(new THREE.Vector3());assert(Math.abs(Math.hypot(page.camera.position.x-centre.x,page.camera.position.z-centre.z)-metres)<1e-9);assert.equal(button.attributes['aria-pressed'],'true');}
    for(const height of [1.7,40,90]){page.preset('height',height);assert(Math.abs(page.camera.position.y-(makeBounds().min.y+height))<1e-9);}
    page.preset('hour',0);assert.equal(page.sun.intensity,0);assert(page.moon.intensity>0);page.preset('hour',12);assert(page.sun.intensity>0);assert.equal(page.moon.intensity,0);
  }finally{page.close();}
});

test('actual page renders the 600 m start and 200 m endpoint, recording a real threshold crossing and retaining it for capture',async()=>{
  const page=pageFixture();try{
    page.node('distance-view').value='south';page.node('distance-view').emit('change');page.node('distance-approach').emit('click');
    page.advance(1500);page.advance(5500);page.advance(9500);
    const record=page.api.metadata(),run=record.approach;assert.equal(run.status,'completed');assert.equal(run.renderedFrames,3);assert(Math.abs(run.initialFrame.horizontalDistanceMetres-600)<1e-9);assert(Math.abs(run.lastFrame.horizontalDistanceMetres-200)<1e-9);assert.equal(run.totalSwitches,1);
    const crossing=run.switches[0];assert.equal(crossing.from,'distance');assert.equal(crossing.to,'full');assert(crossing.previousFrame.projectedErrorPhysicalPixels<=.5);assert(crossing.projectedErrorPhysicalPixels>.5);assert.equal(crossing.renderedAtMilliseconds,5507);assert.equal(crossing.renderSerial,2);assert.equal(crossing.physicalHeight,2200);
    await page.api.save();assert.deepEqual(page.api.metadata().approach,run);const capture=JSON.parse(await page.posts[1].body.text());assert.equal(capture.approach.lastFrame.renderSerial,3);assert.equal(capture.render.renderSerial,4);assert.equal(capture.approach.totalSwitches,1);
    page.preset('height',90);assert.deepEqual(page.api.metadata().approach,run);page.node('distance-approach').emit('click');assert.equal(page.api.metadata().approach.runId,2);assert.equal(page.api.metadata().approach.switches.length,0);
  }finally{page.close();}
});

test('failed rendering never commits a selected representation; paused runs preserve the last successful frame',()=>{
  const page=pageFixture();try{
    page.node('distance-view').value='south';page.node('distance-view').emit('change');page.node('distance-approach').emit('click');page.failRender(true);
    assert.throws(()=>page.advance(100),/fixture GPU render failed/);assert.equal(page.api.metadata().approach.renderedFrames,0);assert.equal(page.api.metadata().approach.initialFrame,null);assert.equal(page.api.metadata().render.renderSerial,0);
    page.failRender(false);page.advance(100);const rendered=page.api.metadata().approach.lastFrame;page.node('distance-approach').emit('click');page.advance(110);
    const stopped=page.api.metadata().approach;assert.equal(stopped.reason,'paused');assert.equal(stopped.renderedFrames,1);assert.deepEqual(stopped.lastFrame,rendered);assert.equal(stopped.switches.length,0);
  }finally{page.close();}
});
