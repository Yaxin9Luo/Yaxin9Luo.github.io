import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRendering } from '../src/rendering.js';

function harness(maxSamples=4){
  const ImageBefore=globalThis.Image;
  globalThis.Image=class {};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,16/9,.15,1250),calls=[],targets=new Set();
  const opaque=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  const membrane=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({transparent:true,opacity:.4}));
  const foliage=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({alphaTest:.3}));
  const hidden=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());hidden.visible=false;
  scene.add(opaque,membrane,foliage,hidden);
  let target=null;const clearColor=new THREE.Color('#123456');let clearAlpha=1;
  const renderer={
    capabilities:{maxSamples},autoClear:true,autoClearColor:true,autoClearDepth:true,autoClearStencil:false,
    outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.14,
    getPixelRatio:()=>2,getSize:value=>value.set(1280,720),getRenderTarget:()=>target,
    setRenderTarget(value){target=value;if(value)targets.add(value);},
    getClearColor:value=>value.copy(clearColor),getClearAlpha:()=>clearAlpha,
    setClearColor(value,alpha){clearColor.set(value);if(alpha!==undefined)clearAlpha=alpha;},
    setClearAlpha:value=>{clearAlpha=value;},clear(){},clearDepth(){},
    state:{buffers:{stencil:{setTest(){}}}},
    initRenderTarget(value){targets.add(value);},
    copyTextureToTexture(source,destination){
      assert.ok([...targets].some(value=>value.texture===destination),'copy destination must be initialized');
      calls.push({kind:'copy',source,destination});
    },
    render(object){
      calls.push({kind:object===scene?(scene.overrideMaterial?'normals':'beauty'):'screen',target,material:object.material,
        input:object.material?.uniforms?.tDiffuse?.value,visible:[opaque,membrane,foliage,hidden].map(o=>o.visible)});
    },
  };
  let rendering;
  try{rendering=createRendering(renderer,scene,camera);}finally{if(ImageBefore===undefined)delete globalThis.Image;else globalThis.Image=ImageBefore;}
  return {rendering,renderer,scene,camera,calls,targets};
}

test('each high-quality frame keeps scene MSAA and depth, then processes only resolved single-sample images',()=>{
  const {rendering,calls,targets}=harness();
  rendering.setQuality('high');rendering.resize(1280,720,2);
  for(let frame=0;frame<2;frame++){
    calls.length=0;rendering.render(1/60);
    const beauty=calls.filter(call=>call.kind==='beauty'),normal=calls.filter(call=>call.kind==='normals'),copies=calls.filter(call=>call.kind==='copy');
    assert.equal(beauty.length,1,'postprocessing must not redraw beauty geometry');
    assert.equal(normal.length,1,'GTAO keeps its existing normal/depth prepass');
    assert.equal(copies.length,1,'resolved HDR image crosses to the composer once');
    assert.equal(beauty[0].target.samples,4);assert.equal(beauty[0].target.depthBuffer,true);
    assert.equal(beauty[0].target.resolveDepthBuffer,false);
    assert.equal(beauty[0].target.resolveStencilBuffer,false);
    assert.deepEqual([beauty[0].target.width,beauty[0].target.height],[2560,1440]);
    assert.equal(copies[0].source,beauty[0].target.texture);
    assert.equal(copies[0].source.type,THREE.HalfFloatType);assert.equal(copies[0].destination.type,THREE.HalfFloatType);
    assert.deepEqual(copies[0].source.image,copies[0].destination.image);
    assert.deepEqual([normal[0].target.width,normal[0].target.height],[2048,1152]);
    assert.equal(normal[0].target.depthBuffer,true);assert.ok(normal[0].target.depthTexture);
    for(const call of calls.filter(call=>call.kind==='screen'&&call.target)){
      assert.equal(call.target.samples,0,'fullscreen image operation must not trigger another MSAA resolve');
      assert.equal(call.target.depthBuffer,false,'fullscreen image operation has no depth consumer');
    }
    assert.ok(calls.some(call=>call.kind==='screen'&&call.input===copies[0].destination),'GTAO must consume the copied beauty texture');
    const ao=calls.find(call=>call.material?.uniforms?.sceneBoxMin),denoise=calls.find(call=>call.material?.uniforms?.lumaPhi);
    assert.equal(ao.material.defines.SAMPLES,8);assert.equal(denoise.material.defines.SAMPLES,8);
    assert.deepEqual(beauty[0].visible,[true,true,true,false]);
    assert.deepEqual(normal[0].visible,[true,false,false,false]);
    assert.equal(calls.at(-1).target,null,'the final transform still reaches the canvas');
  }
  const disposed=new Set();for(const target of targets)target.addEventListener('dispose',()=>disposed.add(target));
  rendering.dispose();for(const target of targets)assert.ok(disposed.has(target),'render target leaked on disposal');
});

test('quality and viewport changes preserve scene depth and the selected sample count across buffer swaps',()=>{
  const {rendering,calls}=harness();
  for(const [quality,samples]of[['high',4],['low',0],['balanced',2],['high',4]]){
    rendering.setQuality(quality);rendering.resize(390,844,2.5);calls.length=0;
    rendering.render(1/60);rendering.render(1/60);
    assert.equal(rendering.samples,samples);
    for(const call of calls.filter(call=>call.kind==='beauty')){
      assert.equal(call.target.samples,samples);assert.equal(call.target.depthBuffer,true);
      assert.deepEqual([call.target.width,call.target.height],[975,2110]);
    }
    const normalCount=calls.filter(call=>call.kind==='normals').length;
    assert.equal(normalCount,quality==='low'?0:2);
    for(const call of calls.filter(call=>call.kind==='screen'&&call.target))assert.equal(call.target.samples,0);
    assert.equal(calls.filter(call=>call.kind==='copy').length,2);
  }
  rendering.dispose();
});

test('devices with limited MSAA retain the scene target and existing SMAA fallback',()=>{
  for(const available of[0,2]){
    const {rendering,calls}=harness(available);rendering.setQuality('high');rendering.resize(960,540,1);rendering.render(1/60);
    assert.equal(rendering.samples,available);
    const beauty=calls.find(call=>call.kind==='beauty');assert.equal(beauty.target.samples,available);assert.equal(beauty.target.depthBuffer,true);
    const smaa=calls.filter(call=>call.material?.uniforms?.tArea);
    assert.equal(smaa.length,available===0?1:0);
    assert.equal(calls.at(-1).target,null);rendering.dispose();
  }
});
