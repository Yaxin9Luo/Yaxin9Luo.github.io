import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as assets from '../src/herbarium-assets.js';
import * as community from '../src/herbarium-community.js';
import * as normalPolicy from '../src/herbarium-normal-policy.js';
import {createGrassSpecimen} from '../src/landscape.js';

// Execute the canonical source with actual arcade geometry; only DOM, loading
// and GPU boundaries are mocked. Native appearance remains the root art gate.
async function fixture(vine='outer-left',kind='arcade'){
  let pendingFrame;
  const source=(await readFile(new URL('../src/herbarium-studio.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,''),html=await readFile(new URL('../herbarium-studio.html',import.meta.url),'utf8'),nodes=new Map(),encoded=[],requests=[],listeners={};
  const element=()=>({value:'',hidden:false,disabled:false,checked:false,dataset:{},setAttribute(name,value){this[name]=value;},replaceChildren(){}});
  for(const [,id]of html.matchAll(/id="([^"]+)"/g))nodes.set(id,element());
  nodes.get('scale').checked=true;nodes.get('water-optics').value='surface';
  const views=[...html.matchAll(/data-view="([^"]+)"/g)].map(([,view])=>({...element(),dataset:{view}}));
  const canvas={addEventListener:(name,handler)=>listeners[name]=handler,clientWidth:1024,clientHeight:576,width:2560,height:1440,toBlob:callback=>encoded.push(callback)},aside=element(),document={body:element(),hidden:false,createElement:element,getElementById:id=>nodes.get(id),querySelector:selector=>selector==='canvas'?canvas:aside,querySelectorAll:selector=>selector==='[data-view]'?views:[...nodes.values()]};
  class Renderer{constructor(){this.extensions={has:()=>false,get:()=>{throw new Error('Unsupported extension get must not be called');}};this.capabilities={maxTextureSize:16384};this.shadowMap={};this.info={render:{calls:0,triangles:0}};}setPixelRatio(value){this.dpr=value;}getPixelRatio(){return this.dpr;}setSize(w,h){canvas.width=w*this.dpr;canvas.height=h*this.dpr;}render(){}dispose(){}}
  class Orbit{constructor(){this.target=new THREE.Vector3();}update(){}dispose(){}}
  class Room extends THREE.Group{dispose(){}}
  const window={addEventListener:(name,handler)=>listeners[name]=handler},context={...assets,...community,...normalPolicy,createGrassSpecimen,THREE:{...THREE,WebGLRenderer:Renderer,PMREMGenerator:class{fromScene(){return {texture:new THREE.Texture(),dispose(){}};}dispose(){}}},RoomEnvironment:Room,OrbitControls:Orbit,loadHerbariumAssets:async()=>{},loadHerbariumIvyAssets:async()=>assets.bindHerbariumIvyTextureSet(Object.fromEntries(['map','normalMap','alphaMap','roughnessMap'].map(key=>[key,new THREE.Texture({width:4096,height:4096})]))),loadHerbariumBotanicalAssets:async()=>{},loadShrubAssets:async()=>{},document,window,location:{search:`?kind=${kind}&candidate=task3b-vine-r1&vine=${vine}&view=close&light=day`},devicePixelRatio:2.5,performance,URLSearchParams,AbortController,Blob,structuredClone,Date,requestAnimationFrame:callback=>{pendingFrame=callback;return 1;},cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===60?0:ms),clearTimeout,fetch:async(url,args)=>{requests.push({url,...args});return {ok:true};}};
  await vm.runInNewContext(`(async()=>{${source}})()`,context,{filename:'herbarium-studio.js'});
  return {api:window.__herbariumStudio,nodes,document,encoded,requests,listeners,frame:()=>pendingFrame()};
}

test('studio selector constructs opt-in geometry while retaining native quality and baseline choice',async()=>{
  const qa=await fixture();assert.equal(qa.document.body.dataset.ready,'true');assert.equal(qa.api.asset.userData.vineComposition.kind,'outer-left');assert.equal(qa.api.evidence().nativeViewport.renderPixelRatio,2.5);assert.equal(qa.nodes.get('vine-controls').hidden,false);
  qa.nodes.get('vine').value='outer-right';await qa.nodes.get('vine').onchange();assert.equal(qa.api.asset.userData.vineComposition.kind,'outer-right');
  qa.api.setView('interior');assert.ok(qa.api.camera.position.x<0);assert.ok(qa.api.controls.target.x>5,'right interior faces the actual right outer vine');
  qa.nodes.get('vine').value='legacy';await qa.nodes.get('vine').onchange();assert.equal(qa.api.asset.userData.vineComposition,undefined);assert.equal(qa.api.evidence().vineComposition,'legacy');qa.listeners.pagehide({persisted:false});
});

test('asynchronous native capture preserves rendered vine selection and contact view after a control change',async()=>{
  const qa=await fixture();qa.api.setView('vine-crown');const capture=qa.api.saveFrame();assert.equal(qa.encoded.length,1);
  qa.nodes.get('vine').value='outer-right';await qa.nodes.get('vine').onchange();qa.api.setView('vine-root');qa.api.setLight('night');
  qa.encoded[0](new Blob(['rendered left/day/cornice pixels'],{type:'image/png'}));const name=await capture;
  assert.match(name,/task3b-vine-r1-outer-left-vine-crown-day/);const metadata=JSON.parse(await qa.requests[1].body.text());assert.equal(metadata.vineComposition,'outer-left');assert.equal(metadata.view,'vine-crown');assert.equal(metadata.light,'day');assert.equal(metadata.windEnvelope,0);assert.equal(metadata.nativeViewport.pixelWidth,2560);qa.listeners.pagehide({persisted:false});
});


test('standalone source and legacy arcade animation frames populate readout without community-only metadata',async()=>{
  const bytes=await readFile(new URL('../public/models/herbarium/didelta-spinosa/didelta-spinosa-lod0.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const metadata=JSON.parse(await readFile(new URL('../public/models/herbarium/didelta-spinosa/geometry-source.json',import.meta.url),'utf8'));
  community.bindShrubSource(gltf,metadata,Object.fromEntries(['map','normalMap','roughnessMap','alphaMap','translucencyMap'].map(key=>[key,new THREE.Texture({width:8192,height:8192})])));
  const qa=await fixture('legacy','didelta_spinosa');
  assert.equal(qa.document.body.dataset.ready,'true');assert.equal(qa.api.asset.userData.plantRoots,undefined);
  assert.doesNotThrow(()=>{qa.frame();qa.frame();},'execute actual scheduled frame after standalone source loading');
  assert.match(qa.nodes.get('readout').textContent,/m envelope/);assert.match(qa.nodes.get('readout').textContent,/Native 2560 × 1440/);assert.doesNotMatch(qa.nodes.get('readout').textContent,/rooted plants/);
  const mesh=qa.api.asset.children[0],material=mesh.material,geometry=mesh.geometry,shader={uniforms:{},fragmentShader:THREE.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader);
  for(const [mode,direct,indirect]of [['reflection',0,0],['direct',1,0],['source',1,1]]){qa.nodes.get('shrub-material').value=mode;qa.nodes.get('shrub-material').onchange();assert.equal(qa.api.evidence().shrubMaterial,mode);assert.equal(shader.uniforms.shrubDirectTranslucency.value,direct);assert.equal(shader.uniforms.shrubIndirectTranslucency.value,indirect);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.ok(material.map&&material.normalMap&&material.roughnessMap&&material.alphaMap&&shader.uniforms.shrubTranslucencyMap.value);}
  await qa.api.setKind('arcade');assert.doesNotThrow(()=>qa.frame());assert.match(qa.nodes.get('readout').textContent,/DPR 2.5/);qa.listeners.pagehide({persisted:false});
});


test('grass studio uses complete native tufts and releases their distinct resource owner',async()=>{
  const qa=await fixture('legacy','grass'),asset=qa.api.asset;
  assert.equal(qa.document.body.dataset.ready,'true');assert.equal(asset.userData.studyOwner,'grass');
  assert.equal(asset.children.length,3);assert.equal(qa.nodes.get('scale').checked,false);
  assert.equal(qa.api.evidence().nativeViewport.renderPixelRatio,2.5);
  qa.api.setView('roots');assert.deepEqual(qa.api.camera.position.toArray(),asset.userData.studyViews.roots.eye);
  qa.frame();assert.match(qa.nodes.get('readout').textContent,/m envelope/);
  const disposed=[];for(const mesh of asset.children)mesh.geometry.addEventListener('dispose',()=>disposed.push(mesh.geometry));
  await qa.api.setKind('grass');assert.equal(disposed.length,3);assert.equal(asset.parent,null);
  const second=qa.api.asset;qa.listeners.pagehide({persisted:false});assert.equal(second.userData.disposed,true);
});
