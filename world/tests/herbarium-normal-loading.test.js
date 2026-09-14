import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import * as policy from '../src/herbarium-normal-policy.js';
import {createResourceLoader} from '../src/resource-loader.js';

// Execute the actual source aggregate/binding with real tiny Three objects and
// the actual resource coordinator. Only I/O and decoded pixels are substituted;
// no full-resolution allocation, decoder or renderer runs in this fixture.
const source=(await readFile(new URL('../src/herbarium-community.js',import.meta.url),'utf8')).replace(/^import .+;\n/gm,'').replace(/^export /gm,'');
const derivative={url:'/models/herbarium/didelta-spinosa/test-only.ktx2',bytes:8,sha256:'a'.repeat(64),sourceSHA256:'67d8f96aba14560667ff6ad7058fb75b8f452a0dfd4792dff2f0961d8c632261',recipeURL:'/models/herbarium/didelta-spinosa/test-only-recipe.json',recipeSHA256:'b'.repeat(64),acceptanceURL:'/models/herbarium/didelta-spinosa/test-only-art.json',acceptanceSHA256:'c'.repeat(64)};
function fixture(){
  const requests=[],decodes=[],pending=[],scene=new THREE.Group(),metadata={meshes:[]};let failNormal=false;
  for(let i=0;i<3;i++){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
    const mesh=new THREE.Mesh(geometry);mesh.name=`plant-${i}`;scene.add(mesh);metadata.meshes.push({name:mesh.name,triangles:1,rootGLTF:[0,0,0]});
  }
  const resourceLoader=createResourceLoader({fetchImpl:async url=>{requests.push(url);return new Response(url.endsWith('geometry-source.json')?JSON.stringify(metadata):new Uint8Array(8));}});
  function decodeShrubTexture(_buffer,{key,normalEncoding,signal}){
    decodes.push({key,normalEncoding});
    const result={width:8192,height:8192,format:key==='normalMap'?THREE.RGBAFormat:THREE.RedFormat,type:['normalMap','roughnessMap'].includes(key)?THREE.HalfFloatType:THREE.UnsignedByteType,data:key==='normalMap'||key==='roughnessMap'?new Uint16Array(4):new Uint8Array(4)};
    if(normalEncoding==='astc-hdr')Object.assign(result,{format:THREE.RGBA_ASTC_4x4_Format,mipmaps:[{width:8192,height:8192,data:new Uint8Array(16)}]});
    if(key!=='normalMap')return Promise.resolve(result);
    if(failNormal)return Promise.reject(new Error('deliberate malformed HDR input'));
    return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});pending.push(()=>{signal.removeEventListener('abort',abort);resolve(result);});});
  }
  const context={...policy,THREE,resourceLoader,decodeShrubTexture,TextDecoder,Blob,URL,console,
    shrubNormalDescriptor:encoding=>policy.shrubNormalDescriptor(encoding,derivative),
    loadGLTF:(asset,options)=>resourceLoader.load(asset,{...options,parse:()=>({scene})}),
    createImageBitmap:async()=>({width:8192,height:8192,close(){}}),
  };
  const api=vm.runInNewContext(`(()=>{${source}\nreturn{loadShrubAssets,getShrubNormalSourceState};})()`,context);
  return {...api,requests,decodes,pending,failNormal(value){failNormal=value;}};
}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw new Error('Tiny fixture did not reach pending parse');}

test('actual aggregate rejects incompatible pending encoding before requests and keeps independent shared consumers',async()=>{
  const q=fixture(),controller=new AbortController(),options={normalEncoding:'astc-hdr',deadline:performance.now()+5000};
  const first=q.loadShrubAssets({...options,signal:controller.signal}),rejected=assert.rejects(first,/cancelled/),second=q.loadShrubAssets(options);
  await until(()=>q.pending.length===1);const count=q.requests.length;
  await assert.rejects(q.loadShrubAssets({normalEncoding:'exr'}),/cannot bind or load/);assert.equal(q.requests.length,count);
  controller.abort();await rejected;assert.equal(q.getShrubNormalSourceState().pendingConsumers,1);
  q.pending.shift()();const bound=await second;assert.equal(bound.normalEncoding,'astc-hdr');assert.equal(q.getShrubNormalSourceState().status,'bound');
  assert.equal(await q.loadShrubAssets(options),bound);assert.equal(q.decodes.filter(r=>r.key==='normalMap').length,1);assert.equal(q.requests.filter(u=>u.endsWith('.ktx2')).length,1);assert.ok(!q.requests.some(u=>u.endsWith('nor_gl_8k.exr')));
  assert.equal(bound.material.normalMap.magFilter,THREE.NearestFilter);assert.equal(bound.material.normalMap.generateMipmaps,false);assert.deepEqual(bound.material.normalScale.toArray(),[1,-1]);
  assert.equal(bound.material.alphaMap,bound.depthMaterial.alphaMap);assert.equal(bound.material.alphaMap,bound.distanceMaterial.alphaMap);
  assert.equal(bound.material.normalMap.userData.source,'/models/herbarium/didelta-spinosa/textures/didelta_spinosa_nor_gl_8k.exr');assert.equal(bound.material.normalMap.userData.uploadSource,derivative.url);assert.equal(bound.material.normalMap.userData.lossless,false);
  await assert.rejects(q.loadShrubAssets({normalEncoding:'exr'}),/cannot bind or load/);
});

test('selected HDR parse failure stays visible without EXR fallback; retry shares successful channels',async()=>{
  const q=fixture(),options={normalEncoding:'astc-hdr',deadline:performance.now()+5000};q.failNormal(true);
  await assert.rejects(q.loadShrubAssets(options),/Shrub source preload failed: Resource parsing failed/);assert.equal(q.getShrubNormalSourceState().status,'unselected');
  q.failNormal(false);const retry=q.loadShrubAssets(options);await until(()=>q.pending.length===1);q.pending.shift()();await retry;
  assert.equal(q.requests.filter(u=>u.endsWith('.ktx2')).length,2);assert.ok(!q.requests.some(u=>u.endsWith('nor_gl_8k.exr')));assert.equal(q.requests.filter(u=>u.endsWith('rough_8k.exr')).length,1);
});

test('renderer-free API retains original EXR data texture, source name and generated mips',async()=>{
  const q=fixture(),load=q.loadShrubAssets({deadline:performance.now()+5000});await until(()=>q.pending.length===1);q.pending.shift()();const result=await load;
  assert.equal(result.normalEncoding,'exr');assert.equal(result.material.normalMap.isDataTexture,true);assert.equal(result.material.normalMap.type,THREE.HalfFloatType);assert.equal(result.material.normalMap.generateMipmaps,true);assert.equal(result.material.normalMap.name,'Didelta original 8K normalMap');assert.equal(q.requests.filter(u=>u.endsWith('nor_gl_8k.exr')).length,1);assert.ok(!q.requests.some(u=>u.endsWith('.ktx2')));
});

test('actual studio restore callback resumes only compatible encoding without resetting quality or loading new maps',async()=>{
  const studio=await readFile(new URL('../src/herbarium-studio.js',import.meta.url),'utf8');
  const helpers=studio.slice(studio.indexOf('function syncStudyReadiness(){'),studio.indexOf('function shrubOptions(){'));
  const body=studio.match(/canvas\.addEventListener\('webglcontextrestored',\(\)=>\{([\s\S]+?)\n\}\);\nwindow\.__herbariumStudio/)[1];
  for(const supported of [false,true]){
    const buttons=[],context={...policy,disposed:false,suspended:false,normalSelection:{encoding:'astc-hdr'},normalRestoreFailure:null,graphicsPaused:true,assetReadyState:'true',graphicsEpoch:1,selectionToken:1,loadController:new AbortController(),group:{},raf:1,frame(){},resize(){},cancelAnimationFrame(){},requestAnimationFrame(){context.frames++;return 2;},frames:0,status(){},el(){return buttons[0]??=( {} );},document:{body:{dataset:{ready:'graphics-paused'}},querySelectorAll(){return buttons;}},renderer:{extensions:{has:()=>true,get:()=>({getSupportedProfiles:()=>supported?['hdr']:['ldr']})},capabilities:{maxTextureSize:16384},shadowMap:{}}};
    vm.runInNewContext(`${helpers}\n(()=>{${body}})()`,context);
    assert.equal(context.graphicsPaused,!supported);assert.equal(context.loadController.signal.aborted,!supported);assert.equal(context.frames,supported?1:0);assert.equal(context.graphicsEpoch,2);
  }
});
