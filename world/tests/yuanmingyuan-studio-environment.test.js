import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

const page=await readFile(new URL('../src/yuanmingyuan/studio.js',import.meta.url),'utf8');
const before=await readFile(new URL('../../work/yuanmingyuan/captures/source-c8ab3310b049035a/world/src/yuanmingyuan/studio.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

// Execute the actual page's parameter/start/light/render/capture functions.
// Only its external loader, DOM, renderer and PNG/network boundaries are fake.
// No production factory, geometry, browser or GPU is created by this harness.
function harness(t,{search='',source=page,encoding=null}={}){
  const nodes=new Map(),uploads=[],reads=[],pending=new Map();let imported=0,prepared=0,nextFrame=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},value:'',textContent:'',disabled:false,checked:false,children:[],addEventListener(){},removeEventListener(){},setAttribute(){},replaceChildren(...children){this.children=children;}});return nodes.get(id);};
  const canvas=node('canvas');Object.assign(canvas,{width:8,height:6,clientWidth:8,clientHeight:6});
  const document={hidden:false,body:node('body'),getElementById:node,querySelector:selector=>selector==='canvas'?canvas:node('aside'),querySelectorAll:()=>[...nodes.values()],addEventListener(){}};
  const config={id:'fixture',studyId:'fixture-study',views:{profile:{label:'Fixture',groups:[],direction:[1,.04,.20]}},defaultView:'profile',sculptures:{},coordinates:{up:'+Y',front:'+Z'},loadFactory:async()=>{imported++;return ()=>{throw new Error('This test must never construct the model');};}};
  let fixture=null;
  const scope={THREE,document,window:{addEventListener(){}},location:{search},URLSearchParams,URL,Blob,AbortController,DOMException,Error,console,devicePixelRatio:1,getStudioAsset:()=>config,setTimeout,clearTimeout,
    requestAnimationFrame:fn=>{pending.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>pending.delete(id),
    readNativeFrame:()=>{const frame={width:8,height:6,readback:'fixture readback boundary',environmentAtRead:fixture.scene.environmentIntensity,frameAtRead:fixture.renderCount};reads.push(frame);return frame;},
    encodeNativeFrame:async frame=>{if(encoding)await encoding.promise;return new Blob([JSON.stringify(frame)],{type:'image/png'});},
    fetch:async(url,options)=>{uploads.push({url,body:options.body});return {ok:true};},
  };
  const executable=source.replace(/^import .*;\s*$/gm,'').replace(/configureInterface\(\);\s*await start\(\);\s*$/,'');
  assert.notEqual(executable,source);assert.doesNotMatch(executable,/await start\(\);\s*$/);
  vm.createContext(scope);vm.runInContext(executable+'\nprepare=()=>fixturePrepared();this.api={start,setLight,render,saveFrame,diagnostics,dispose};',Object.assign(scope,{fixturePrepared:()=>prepared++}),{filename:'actual-studio-environment-fixture.js'});
  t.after(()=>scope.api.dispose());
  return {api:scope.api,nodes,uploads,reads,get imported(){return imported;},get prepared(){return prepared;},get fixture(){return fixture;},
    install(){
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,8/6,.1,20),environment=new THREE.Texture(),floorMaterial=new THREE.MeshStandardMaterial();scene.environment=environment;
      fixture={scene,camera,controls:{target:new THREE.Vector3(),update(){},dispose(){}},asset:{group:new THREE.Group(),diagnostics:{fixture:true},dispose(){}},key:new THREE.DirectionalLight(),fill:new THREE.DirectionalLight(),hemi:new THREE.HemisphereLight(),floor:{material:floorMaterial,geometry:{dispose(){}}},renderCount:0};
      fixture.renderer={shadowMap:{},info:{render:{triangles:0,calls:0},memory:{geometries:0,textures:0}},toneMappingExposure:9,getPixelRatio:()=>1,getContext:()=>({isContextLost:()=>false}),render(){fixture.renderCount++;},dispose(){}};
      scope.fixture=fixture;vm.runInContext('({scene,camera,controls,asset,key,fill,hemi,floor,renderer}=fixture);environmentDirty=false;environmentGeneration=1;',scope);
      t.after(()=>environment.dispose());return fixture;
    },
  };
}

const lighting=fixture=>({key:fixture.key.intensity,fill:fixture.fill.intensity,hemi:fixture.hemi.intensity,exposure:fixture.renderer.toneMappingExposure,keyColor:fixture.key.color.toArray(),fillColor:fixture.fill.color.toArray(),sky:fixture.hemi.color.toArray(),ground:fixture.hemi.groundColor.toArray(),floor:fixture.floor.material.color.toArray(),background:fixture.scene.background.toArray()});

test('the captured pre-change page ignores env while the actual new start/setLight applies it',async t=>{
  const baseline=harness(t,{search:'?env=.65',source:before});await baseline.api.start();baseline.install();baseline.api.setLight('day');assert.equal(baseline.fixture.scene.environmentIntensity,.18);
  const current=harness(t,{search:'?env=.65'});await current.api.start();current.install();current.api.setLight('day');assert.equal(current.fixture.scene.environmentIntensity,.65);
  assert.equal(current.imported,1);assert.equal(current.prepared,1);
});

test('omitted env preserves all original day, neutral and night lighting values',async t=>{
  const baseline=harness(t,{source:before}),current=harness(t);await baseline.api.start();await current.api.start();baseline.install();current.install();
  for(const [mode,environment]of [['day',.18],['neutral',.16],['night',.14]]){
    baseline.api.setLight(mode);current.api.setLight(mode);
    assert.deepEqual(lighting(current.fixture),lighting(baseline.fixture));
    assert.equal(current.fixture.scene.environmentIntensity,environment);
    assert.equal(current.api.diagnostics().environmentOverride,null);
  }
});

test('finite override boundaries and decimal notation survive lighting switches without altering other lights or the PMREM target',async t=>{
  const baseline=harness(t);await baseline.api.start();baseline.install();
  for(const [raw,value]of [['0',0],['2',2],['.65',.65],['6.5e-1',.65],['0.18',.18]]){
    const h=harness(t,{search:'?env='+encodeURIComponent(raw)});await h.api.start();h.install();const environment=h.fixture.scene.environment;
    for(const mode of ['day','night','neutral','day']){
      baseline.api.setLight(mode);h.api.setLight(mode);
      assert.equal(h.fixture.scene.environmentIntensity,value);assert.equal(h.fixture.scene.environment,environment);
      assert.deepEqual(lighting(h.fixture),lighting(baseline.fixture));
      assert.deepEqual(plain(h.api.diagnostics().environmentOverride),{requested:raw,value});
      assert.equal(h.api.diagnostics().environmentGeneration,1);
    }
  }
});

test('empty, nonfinite, out-of-range and repeated env fail visibly before any factory request or renderer preparation',async t=>{
  for(const search of ['?env','?env=','?env=%20%20','?env=NaN','?env=Infinity','?env=-Infinity','?env=1e309','?env=-.001','?env=2.000001','?env=oops','?env=.65&env=.65','?env=.65&env=0']){
    const h=harness(t,{search});await h.api.start();
    assert.equal(h.imported,0,search);assert.equal(h.prepared,0,search);assert.equal(h.fixture,null,search);
    assert.equal(h.nodes.get('body').dataset.ready,'failed',search);assert.equal(h.nodes.get('status').dataset.error,'true',search);assert.match(h.nodes.get('status').textContent,/env.*0–2/,search);
  }
});

test('readout distinguishes an explicit value equal to the default from an omitted request',async t=>{
  for(const [search,expected]of [['','Environment IBL 0.18 · default'],['?env=.18','Environment IBL 0.18 · URL env=.18'],['?env=0','Environment IBL 0 · URL env=0']]){
    const h=harness(t,{search});await h.api.start();h.install();h.api.setLight('day');assert.equal(h.api.render(),true);
    assert.ok(h.nodes.get('readout').textContent.includes(expected));
  }
});

test('capture freezes raw override, actual intensity and environment generation with the same rendered frame before encoding yields',async t=>{
  let release;const encoding={promise:new Promise(resolve=>release=resolve)},h=harness(t,{search:'?env=.65',encoding});
  await h.api.start();h.install();h.api.setLight('day');h.api.render();
  const saving=h.api.saveFrame();assert.equal(h.reads.length,1);const captured=h.reads[0];
  h.api.setLight('night');h.api.render();release();await saving;
  assert.equal(h.uploads.length,2);
  const metadata=JSON.parse(await h.uploads.find(x=>x.url.endsWith('.json')).body.text()),pixels=JSON.parse(await h.uploads.find(x=>x.url.endsWith('.png')).body.text());
  assert.equal(metadata.lighting,'day');assert.equal(metadata.lightingSetup.environment,.65);assert.deepEqual(metadata.environmentOverride,{requested:'.65',value:.65});assert.equal(metadata.environmentGeneration,1);
  assert.equal(metadata.capture.renderSerial,captured.frameAtRead);assert.equal(metadata.renderSerial,captured.frameAtRead);assert.equal(pixels.environmentAtRead,.65);assert.equal(pixels.frameAtRead,captured.frameAtRead);
  assert.equal(h.api.diagnostics().lighting,'night');
});
