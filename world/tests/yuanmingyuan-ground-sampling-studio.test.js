import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {EnvironmentClock} from '../src/environment-time.js';
import {applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {groundSamplingReference as ref,groundSamplingOrigin,createGroundSamplingPlane,setGroundSamplingUV,configureGroundSampling,groundSamplingCropCentre,groundSamplingLightState,saveGroundSamplingFrame} from '../src/yuanmingyuan/ground-sampling-studio.js';

function maps(){return Object.fromEntries(['map','normalMap','roughnessMap'].map(slot=>[slot,new THREE.Texture()]));}
function shader(material){const value={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader,vertexShader:THREE.ShaderLib.standard.vertexShader};material.onBeforeCompile(value);return value;}
function shaderFixture(run){const material=new THREE.MeshStandardMaterial({vertexColors:true}),textures=maps();try{run(material,textures);}finally{material.dispose();Object.values(textures).forEach(texture=>texture.dispose());}}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('review camera and phase are the real native R6 sequence 5 data, with one flat diagnostic plane',async()=>{
  const data=JSON.parse(await readFile(new URL('../../work/production-v3/captures/'+ref.capture+'.json',import.meta.url),'utf8'));
  assert.deepEqual([...ref.camera],data.camera);assert.deepEqual([...ref.target],data.target);assert.equal(ref.phase,data.timePhase);assert.deepEqual([...ref.canvas],[data.canvas.width,data.canvas.height]);
  assert.equal(ref.uvScale*ref.repeat,1/ref.tileMetres);assert.equal(ref.cellMetres,ref.tileMetres*4);
  const point=groundSamplingCropCentre();assert.equal(point.y,4);assert(point.x>ref.target[0]-32&&point.x<ref.target[0]+32);assert(point.z>ref.target[2]-32&&point.z<ref.target[2]+32);
});

test('the only plane has upward triangles, original world positions, and unchanged geometry when UV range changes',()=>{
  const geometry=createGroundSamplingPlane();try{
    assert.equal(geometry.index.count,6);assert.equal(geometry.attributes.position.count,4);const before=geometry.attributes.position.array.slice(),normal=geometry.attributes.normal.array.slice(),index=geometry.index.array.slice();
    const p=geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<6;i+=3){a.fromBufferAttribute(p,geometry.index.getX(i));b.fromBufferAttribute(p,geometry.index.getX(i+1));c.fromBufferAttribute(p,geometry.index.getX(i+2));assert(new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)).y>0);}
    for(const mode of ['local','world']){setGroundSamplingUV(geometry,mode);assert.deepEqual(geometry.attributes.position.array,before);assert.deepEqual(geometry.attributes.normal.array,normal);assert.deepEqual(geometry.index.array,index);}
  }finally{geometry.dispose();}
});

test('60m local rebasing preserves fractional texture phase and the original global triangular-cell hash inputs',()=>{
  const origin=groundSamplingOrigin(),fraction=x=>x-Math.floor(x);
  assert.deepEqual(origin,{world:[840,-660],cells:[14,-11]});
  // Include negative coordinates and either side of multiple cell boundaries.
  for(const [x,z] of [[873.0715731075196,-638.0238577025059],[840,-660],[839.999,-660.001],[899.999,-600.001],[900.001,-599.999],[925,-640]]){
    for(const [value,o,cell] of [[x,origin.world[0],origin.cells[0]],[z,origin.world[1],origin.cells[1]]]){
      const global=value/15,local=(value-o)/15;assert(Math.abs(fraction(global)-fraction(local))<1e-12);
      assert.equal(Math.floor(global/4),Math.floor(local/4)+cell);assert(Math.abs(fraction(global/4)-fraction(local/4))<1e-12);
    }
  }
  const geometry=createGroundSamplingPlane();try{
    const world=geometry.attributes.uv.array.slice();setGroundSamplingUV(geometry,'local');
    for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++){
      const global=world[i*2+axis]*ref.repeat,local=geometry.attributes.uv.array[i*2+axis]*ref.repeat+origin.cells[axis]*4;
      assert(Math.abs(global-local)*4096<.03,'Float32 storage difference remains below .03 of a 4k texel; no pattern substitution');
    }
  }finally{geometry.dispose();}
});

test('main/world uses the actual original shader unchanged; stock lookup replaces only the three sampling calls',()=>shaderFixture((material,textures)=>{
  applyGardenGroundTextures(material,textures,{sampling:'main'});const original=shader(material).fragmentShader;
  configureGroundSampling(material,textures,{sampling:'main',uv:'world'});assert.equal(shader(material).fragmentShader,original);
  configureGroundSampling(material,textures,{sampling:'stock-lookup',uv:'world'});const stock=shader(material).fragmentShader;
  let expected=original;for(const [slot,uv] of [['map','vMapUv'],['normalMap','vNormalMapUv'],['roughnessMap','vRoughnessMapUv']])expected=expected.replaceAll(`gardenSample( ${slot}, ${uv} )`,`texture2D( ${slot}, ${uv} )`);
  assert.equal(stock,expected);assert(stock.includes('diffuseColor.rgb=mix(gardenBase,diffuseColor.rgb*1.8,.52)'));assert(stock.includes('mix(.9,1.,texelRoughness.g)'));
}));

test('local main sampling offsets only global cell identities while keeping the real texture gradients',()=>shaderFixture((material,textures)=>{
  configureGroundSampling(material,textures,{sampling:'main',uv:'local'});const compiled=shader(material);
  assert.deepEqual(compiled.uniforms.gardenCellOrigin.value.toArray(),groundSamplingOrigin().cells);
  for(const corner of ['a','b','c'])assert(compiled.fragmentShader.includes(`gardenOffset(${corner}+gardenCellOrigin)`));
  assert(compiled.fragmentShader.includes('vec2 dx=dFdx(uv),dy=dFdy(uv)'));assert.equal((compiled.fragmentShader.match(/textureGrad\(map/g)||[]).length,3);
  assert(THREE.ShaderChunk.uv_vertex.includes('mapTransform * vec3( MAP_UV, 1 )'),'Three applies the real texture repeat before these gradients');
}));

test('normal and sampling changes reuse all texture identities and preserve physical PBR fields',()=>shaderFixture((material,textures)=>{
  for(const sampling of ['main','stock-lookup','stock-material'])for(const normal of [false,true]){
    configureGroundSampling(material,textures,{sampling,normal});assert.equal(material.roughness,.98);assert.equal(material.metalness,0);assert.equal(material.vertexColors,true);assert.deepEqual(material.normalScale.toArray(),normal?[.42,.42]:[0,0]);
    for(const slot of ['map','normalMap','roughnessMap']){assert.equal(material[slot],textures[slot]);assert.deepEqual(textures[slot].repeat.toArray(),[5/6,5/6]);}
    if(sampling==='stock-material'){assert.equal(material.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);assert.equal(shader(material).fragmentShader,THREE.ShaderLib.standard.fragmentShader);}
  }
}));

test('direct lights use the current museum EnvironmentClock values without advancing its phase',()=>{
  for(const mode of ['day','night']){const clock=new EnvironmentClock(mode),sample=clock.update(0,{paused:true}),state=groundSamplingLightState(mode);
    assert.equal(state.phase,clock.phase);assert.equal(state.lightingVariant,clock.lightingReviewVariant);assert.deepEqual(state.key.color,sample.key.toArray());assert.equal(state.key.intensity,sample.keyIntensity);
    assert.equal(state.hemisphere.intensity,sample.ambientIntensity*.56);assert.equal(state.bounce.intensity,sample.fillIntensity*.5);assert.deepEqual(state.bounce.target,[0,0,0]);assert.equal(state.exposure,1.05);
  }
});

function captureFixture({failJSON=false}={}){
  const entered=deferred(),resume=deferred(),controller=new AbortController(),uploaded=[],events=[];let current='main';
  return {controller,uploaded,events,entered,resume,setCurrent(value){current=value;},
    start(){return saveGroundSamplingFrame({renderer:{},canvas:{},signal:controller.signal,now:()=>123,
      draw(){events.push('draw');return true;},read(){events.push('read-native');return {width:2,height:1,rgba:new Uint8Array(8),readback:'injected-small-frame'};},
      metadata(){events.push('metadata');return {sourceIdentity:{digest:'a'.repeat(64)},sampling:current,resolution:'1k',uv:'world',view:'main',sequence:1};},
      encode:async()=>{entered.resolve();await resume.promise;return new Blob(['small-png-fixture']);},
      upload:async(name,body)=>{if(failJSON&&name.endsWith('.json'))throw new Error('fixture JSON save failed');uploaded.push({name,body});},
    });}};
}
test('capture reads real-frame bytes and metadata before asynchronous encoding and saves a matched pair',async()=>{
  const f=captureFixture(),pending=f.start();await f.entered.promise;f.setCurrent('stock-lookup');f.resume.resolve();const result=await pending;
  assert.deepEqual(f.events,['draw','read-native','metadata']);assert.equal(f.uploaded.length,2);const json=JSON.parse(await f.uploaded[1].body.text());assert.equal(json.sampling,'main');assert.equal(json.capture.width,2);assert(result.files.every(name=>name.includes('-main-1k-world-main-')));
});
test('capture serializes nested state before encoding and returns the same immutable JSON snapshot',async()=>{
  const entered=deferred(),resume=deferred(),uploaded=[],live={sourceIdentity:{digest:'b'.repeat(64)},sampling:'main',resolution:'4k',uv:'world',view:'main',sequence:1,
    geometry:{mapping:{cellOrigin:[14,-11]}},lighting:{key:{color:[1,.8,.6]}},errors:[]};
  const pending=saveGroundSamplingFrame({renderer:{},canvas:{},now:()=>321,draw:()=>true,
    read:()=>({width:2,height:1,rgba:new Uint8Array(8),readback:'injected-small-frame'}),metadata:()=>live,
    encode:async()=>{entered.resolve();await resume.promise;return new Blob(['small-png-fixture']);},upload:async(name,body)=>uploaded.push({name,body})});
  await entered.promise;live.geometry.mapping.cellOrigin[0]=99;live.lighting.key.color[1]=0;live.errors.push({message:'arrived while encoding'});live.sourceIdentity.digest='c'.repeat(64);
  resume.resolve();const result=await pending,record=JSON.parse(await uploaded[1].body.text());
  assert.deepEqual(record.geometry.mapping.cellOrigin,[14,-11]);assert.deepEqual(record.lighting.key.color,[1,.8,.6]);assert.deepEqual(record.errors,[]);assert.equal(record.sourceIdentity.digest,'b'.repeat(64));
  assert.deepEqual(result.metadata,record);assert(result.files.every(name=>name.includes('b'.repeat(16))));
});
test('capture cancellation during encoding uploads nothing, while a second-file failure preserves the first-file evidence',async()=>{
  const aborted=captureFixture(),pending=aborted.start();await aborted.entered.promise;aborted.controller.abort();aborted.resume.resolve();await assert.rejects(pending,{name:'AbortError'});assert.equal(aborted.uploaded.length,0);
  const failed=captureFixture({failJSON:true}),saving=failed.start();await failed.entered.promise;failed.resume.resolve();await assert.rejects(saving,error=>error.message==='fixture JSON save failed'&&error.retainedFiles.length===1&&error.retainedFiles[0].endsWith('.png'));assert.equal(failed.uploaded.length,1);
});

test('all visible study controls exist without importing terrain factories, archives or the main renderer',async()=>{
  const html=await readFile(new URL('../ground-sampling-studio.html',import.meta.url),'utf8'),js=await readFile(new URL('../src/yuanmingyuan/ground-sampling-studio.js',import.meta.url),'utf8');
  for(const id of ['ground-canvas','ground-resolution','ground-sampling','ground-uv','ground-normal','ground-view','ground-light','ground-retry','ground-save','ground-dispose','ground-status','ground-metrics','ground-results','ground-readout'])assert(html.includes(`id="${id}"`));
  assert(!/import .*from ['"].*(?:garden-terrain|museum-scene|asset-archive|rendering\.js)/.test(js));assert(js.includes('readNativeFrame'));assert(js.includes('encodeNativeFrame'));assert(js.includes("fetch('/__review_capture/'+name"));
});
