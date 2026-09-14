import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {loadGardenGroundTextures,applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

const source=await readFile(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const start=source.indexOf("  const select=document.createElement('select');select.setAttribute('aria-label','草地材质对照 / Ground material');");
const marker="});$('review-tools').insertBefore(resolutionSelect,$('capture'));",end=source.indexOf(marker,start)+marker.length;
assert(start>=0&&end>start,'Execute the actual resolution switch and its cleanup, not a copied handler');
const slots=['map','normalMap','roughnessMap'];
async function mapsOwner(resolution){
  // Real loader ownership and verified 1k bytes are sufficient for this error
  // branch. The 4k label models UI selection; no 4k pixels are decoded here.
  const images=[],released=[];
  const owner=await loadGardenGroundTextures({fetcher:async path=>new Response(await readFile(new URL('../public'+path,import.meta.url))),decode:async()=>{
    const image={width:1024,height:1024,closed:0,close(){this.closed++;}};images.push(image);return image;
  }});
  owner.resolution=resolution;
  for(const slot of slots)owner[slot].addEventListener('dispose',()=>released.push(slot));
  return {owner,images,released,breakCleanup(){
    owner.map.addEventListener('dispose',()=>{throw new Error('fixture texture cleanup failed');});
    images[0].close=function(){this.closed++;throw new Error('fixture bitmap cleanup failed');};
  },dispose(){try{owner.dispose();}catch{ /* Already asserted cleanup failures remain observable. */ }}};
}
async function fixture({rejectDraw=false}={}){
  const previous=await mapsOwner('1k'),next=await mapsOwner('4k'),material=new THREE.MeshStandardMaterial({vertexColors:true}),scene=new THREE.Group();
  applyGardenGroundTextures(material,previous.owner);
  const nodes={capture:{disabled:false},telemetry:{},'review-tools':{insertBefore(){}}},selects=new Map(),messages=[];let rejectNext=rejectDraw;
  const context={groundTextures:previous.owner,groundReview:'dry-scale15',terrain:{earthMaterial:material},scene,ready:true,loading:false,capturing:false,disposed:false,lang:'en',controller:new AbortController(),query:new URLSearchParams('review=still'),
    document:{createElement(){return {handlers:{},setAttribute(key,value){if(key==='aria-label')selects.set(value,this);},append(){},addEventListener(type,handler){this.handlers[type]=handler;}};}},
    $:id=>nodes[id],setReviewPaused(){},evidence:()=>({}),message:text=>messages.push(text),
    render(){if(context.groundTextures===next.owner&&rejectNext){rejectNext=false;throw new Error('fixture replacement render failed');}return true;},
    applyGardenGroundTextures,loadGardenGroundTextures:async()=>next.owner,
  };
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const drawing=installSceneRedraw(context,source);
  const resolution=selects.get('草地贴图分辨率 / Ground texture resolution'),variant=selects.get('草地材质对照 / Ground material');
  return {previous,next,material,context,messages,nodes,resolution,variant,drawing,
    async switch(){resolution.value='4k';let rejected=null;try{await resolution.handlers.change();}catch(error){rejected=error;}return rejected;},
    dispose(){drawing.dispose();previous.dispose();next.dispose();material.dispose();}};
}
function assertUnlocked(f){
  assert.equal(f.resolution.disabled,false,'Resolution control must recover even when texture cleanup reports an error');
  assert.equal(f.variant.disabled,false,'Material diagnostic control must recover');
  assert.equal(f.nodes.capture.disabled,false,'Native capture must remain available');
}

test('successful material commit still unlocks controls and reports errors when releasing the previous real texture owner throws',async t=>{
  const f=await fixture();t.after(()=>f.dispose());f.previous.breakCleanup();
  const rejected=await f.switch();
  assert.equal(f.context.groundTextures,f.next.owner);assert.equal(f.material.map,f.next.owner.map);
  assert.equal(f.previous.owner.disposed,true);assert.deepEqual(f.previous.released,slots);assert(f.previous.images.every(image=>image.closed===1));
  assert.equal(f.next.owner.disposed,false);assert.equal(f.next.released.length,0);
  assertUnlocked(f);assert.equal(rejected,null,'The DOM change handler must consume and display cleanup errors');
  assert.match(f.messages.join('\n'),/cleanup/i);assert.equal(f.resolution.value,'4k');
});

test('failed material draw restores the previous owner and unlocks controls even when the rejected owner cleanup throws',async t=>{
  const f=await fixture({rejectDraw:true});t.after(()=>f.dispose());f.next.breakCleanup();
  const rejected=await f.switch();
  assert.equal(f.context.groundTextures,f.previous.owner);assert.equal(f.material.map,f.previous.owner.map);
  assert.equal(f.previous.owner.disposed,false);assert.equal(f.previous.released.length,0);
  assert.equal(f.next.owner.disposed,true);assert.deepEqual(f.next.released,slots);assert(f.next.images.every(image=>image.closed===1));
  assertUnlocked(f);assert.equal(rejected,null,'The DOM change handler must consume and display cleanup errors');
  assert.match(f.messages.join('\n'),/replacement render failed/);assert.match(f.messages.join('\n'),/cleanup/i);assert.equal(f.resolution.value,'1k');
});
