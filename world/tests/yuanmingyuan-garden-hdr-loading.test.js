import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {EnvironmentClock} from '../src/environment-time.js';

const page=await readFile(new URL('../src/yuanmingyuan/garden-environment.js',import.meta.url),'utf8');
const header=new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 2\n');
const pixels=new Uint8Array([64,128,192,129,128,64,32,128,48,24,96,130,16,32,48,127]);
const fixture=new Uint8Array(header.length+pixels.length);fixture.set(header);fixture.set(pixels,header.length);

// Exercise the real environment function and installed HDR decoder. The GPU
// PMREM boundary is observed; no model, browser, or GPU factory runs here.
function harness({fetchBuffer=async()=>fixture.buffer,failPMREM=false}={}){
  const input=[],events=[],scene=new THREE.Scene(),renderer={toneMappingExposure:0};
  class PMREM {
    constructor(){events.push('pmrem-create');}
    fromEquirectangular(texture){
      input.push(texture);texture.addEventListener('dispose',()=>events.push('hdr-dispose'));
      if(failPMREM)throw new Error('fixture PMREM failure');
      const target={texture:new THREE.Texture(),dispose(){events.push('target-dispose');this.texture.dispose();}};
      return target;
    }
    dispose(){events.push('pmrem-dispose');}
  }
  const context=vm.createContext({THREE:{...THREE,PMREMGenerator:PMREM},HDRLoader,EnvironmentClock,fetch:async()=>({ok:true,arrayBuffer:fetchBuffer})});
  const executable=page.replace(/^import .*;\s*$/gm,'').replace('export async function createGardenEnvironment','async function createGardenEnvironment');
  vm.runInContext(executable+'\nthis.createEnvironment=createGardenEnvironment;',context);
  return {input,events,scene,renderer,create:options=>context.createEnvironment({scene,renderer,...options})};
}

test('garden PMREM receives the actual HDRLoader texture orientation, linear filtering and upload revision',async()=>{
  const h=harness(),expected=new HDRLoader().createDataTexture(fixture.buffer);
  const environment=await h.create({timeMode:'day'});
  try{
    assert.equal(h.input.length,1);const actual=h.input[0];
    assert.ok(actual.version>0,'The GPU upload must be scheduled; a version-zero DataTexture binds the empty fallback.');
    assert.equal(actual.source.version,expected.source.version);
    for(const key of ['type','format','colorSpace','flipY','minFilter','magFilter','generateMipmaps','unpackAlignment'])assert.equal(actual[key],expected[key],key);
    assert.equal(actual.mapping,THREE.EquirectangularReflectionMapping);
    assert.equal(actual.image.width,2);assert.equal(actual.image.height,2);
    assert.deepEqual(actual.image.data,expected.image.data,'Original HDR rows and linear radiance are preserved.');
    assert.equal(h.events.filter(e=>e==='hdr-dispose').length,1);
    assert.ok(h.scene.environment?.isTexture);
  }finally{environment.dispose();environment.dispose();expected.dispose();}
  assert.equal(h.scene.environment,null);assert.equal(h.scene.children.length,0);
  assert.equal(h.events.filter(e=>e==='target-dispose').length,1);
  assert.equal(h.events.filter(e=>e==='pmrem-dispose').length,1);
});

test('aborting before decoded HDR ownership never leaves an environment or scene group',async()=>{
  const controller=new AbortController(),h=harness({fetchBuffer:async()=>{controller.abort();return fixture.buffer;}});
  await assert.rejects(h.create({signal:controller.signal}),error=>error.name==='AbortError');
  assert.equal(h.input.length,0);assert.equal(h.scene.environment,null);assert.equal(h.scene.children.length,0);
});

test('PMREM failure releases the decoded HDR and generator while retaining the original error',async()=>{
  const h=harness({failPMREM:true});
  await assert.rejects(h.create(),/fixture PMREM failure/);
  assert.equal(h.events.filter(e=>e==='hdr-dispose').length,1);
  assert.equal(h.events.filter(e=>e==='pmrem-dispose').length,1);
  assert.equal(h.scene.environment,null);assert.equal(h.scene.children.length,0);
});
