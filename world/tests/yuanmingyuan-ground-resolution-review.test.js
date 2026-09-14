import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const start=source.indexOf("  const select=document.createElement('select');select.setAttribute('aria-label','草地材质对照 / Ground material');");
const marker="});$('review-tools').insertBefore(resolutionSelect,$('capture'));",end=source.indexOf(marker,start)+marker.length;
assert(start>=0&&end>start,'Exercise both actual page controls and their async replacement handler');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function owner(resolution){
  const maps=Object.fromEntries(['map','normalMap','roughnessMap'].map(key=>[key,new THREE.Texture()]));
  let count=0;return {...maps,resolution,source:`/${resolution}/manifest.json`,dispose(){if(count)return;count++;for(const map of Object.values(maps))map.dispose();},get releases(){return count;}};
}
function fixture({load,draw=()=>{}}={}){
  const previous=owner('1k'),material=new THREE.MeshStandardMaterial({vertexColors:true}),geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);mesh.receiveShadow=true;
  applyGardenGroundTextures(material,previous);
  const nodes={capture:{disabled:false},telemetry:{},'review-tools':{insertBefore(){}}},selects=new Map(),messages=[],drawnOwners=[],controller=new AbortController();
  const ctx={groundTextures:previous,groundReview:'dry-scale15',terrain:{earthMaterial:material,group:scene},scene,ready:true,loading:false,capturing:false,disposed:false,lang:'en',controller,query:new URLSearchParams('review=still'),
    document:{createElement(){return {options:[],handlers:{},setAttribute(key,value){if(key==='aria-label')selects.set(value,this);},append(node){this.options.push(node);},addEventListener(type,handler){this.handlers[type]=handler;}};}},
    $:id=>nodes[id],render:()=>{draw(ctx);drawnOwners.push(ctx.groundTextures);return true;},evidence:()=>({resolution:ctx.groundTextures.resolution}),message:text=>messages.push(text),setReviewPaused(value){ctx.reviewPaused=value;},
    applyGardenGroundTextures,loadGardenGroundTextures:load,
  };
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  const drawing=installSceneRedraw(ctx,source);
  const variant=selects.get('草地材质对照 / Ground material'),resolution=selects.get('草地贴图分辨率 / Ground texture resolution');
  return {ctx,previous,material,mesh,geometry,nodes,variant,resolution,messages,drawing,drawnOwners,
    changeVariant(value){variant.value=value;return variant.handlers.change();},
    changeResolution(value){resolution.value=value;return resolution.handlers.change();},
    dispose(){drawing.dispose();controller.abort();previous.dispose();ctx.groundTextures.dispose();geometry.dispose();material.dispose();}};
}

test('same-camera replacement keeps the prior owner live until decode and first draw succeed, preserving the selected diagnostic',async t=>{
  const gate=deferred(),next=owner('4k'),requests=[],drawn=[];
  const f=fixture({load:args=>{requests.push(args);return gate.promise;},draw:ctx=>{assert.equal(f.previous.releases,0,'Old textures must remain live through replacement validation');drawn.push(ctx.groundTextures);}});t.after(()=>{next.dispose();f.dispose();});
  f.changeVariant('dry-scale15-normal-off');const geometry=f.mesh.geometry,normalScale=f.material.normalScale.toArray();
  const pending=f.changeResolution('4k');
  assert.equal(f.previous.releases,0);assert.equal(f.material.map,f.previous.map);assert(f.resolution.disabled&&f.variant.disabled&&f.nodes.capture.disabled);assert.equal(f.ctx.reviewPaused,true);
  gate.resolve(next);await pending;
  assert.deepEqual(drawn,[next],'The actual first replacement draw must occur before committing ownership');assert.equal(f.drawing.frames.pending.length,0,'The successful synchronous commit consumes its queued preview');
  assert.equal(requests[0].resolution,'4k');assert.equal(requests[0].signal,f.ctx.controller.signal);
  assert.equal(f.ctx.groundTextures,next);assert.equal(f.material.map,next.map);assert.equal(f.material.normalMap,next.normalMap);assert.equal(f.material.roughnessMap,next.roughnessMap);
  assert.deepEqual(f.material.normalScale.toArray(),normalScale);assert.equal(f.mesh.geometry,geometry);assert.equal(f.previous.releases,1);assert.equal(next.releases,0);
  assert.equal(f.resolution.value,'4k');assert(!f.resolution.disabled&&!f.variant.disabled&&!f.nodes.capture.disabled);
});

test('a failed transfer preserves the old textures and color-off diagnostic and resets the visible selection',async t=>{
  const f=fixture({load:async()=>{throw new Error('4K transfer failed');}});t.after(()=>f.dispose());
  f.changeVariant('dry-scale15-color-off');await f.changeResolution('4k');
  assert.equal(f.ctx.groundTextures,f.previous);assert.equal(f.previous.releases,0);assert.equal(f.material.map,null);assert.equal(f.material.normalMap,f.previous.normalMap);
  assert.equal(f.resolution.value,'1k');assert.equal(f.nodes.capture.disabled,false);assert.match(f.messages.at(-1),/transfer failed/);
});

test('failure while drawing the replacement rolls back to live old maps and releases only the rejected new owner',async t=>{
  const next=owner('4k');let fail=true;
  const f=fixture({load:async()=>next,draw:ctx=>{if(ctx.groundTextures===next&&fail){fail=false;throw new Error('new material compile failed');}}});t.after(()=>{next.dispose();f.dispose();});
  await f.changeResolution('4k');assert.equal(f.ctx.groundTextures,f.previous);assert.equal(f.material.map,f.previous.map);assert.equal(f.previous.releases,0);assert.equal(next.releases,1);
  assert.equal(f.resolution.value,'1k');assert.equal(f.nodes.capture.disabled,false);assert.match(f.messages.at(-1),/compile failed/);
  assert.equal(f.drawnOwners.length,0);assert.equal(f.drawing.frames.pending.length,1,'Rollback requests a fresh frame with the retained owner');f.drawing.frames.step();assert.deepEqual(f.drawnOwners,[f.previous]);assert.equal(f.previous.releases,0);
});

test('a material arriving while hidden cannot commit without a fresh frame and preserves the old owner for showing again',async t=>{
  const gate=deferred(),next=owner('4k'),f=fixture({load:()=>gate.promise});t.after(()=>{next.dispose();f.dispose();});
  const pending=f.changeResolution('4k');f.ctx.document.hidden=true;gate.resolve(next);await pending;
  assert.equal(f.ctx.groundTextures,f.previous);assert.equal(f.previous.releases,0);assert.equal(next.releases,1);assert.equal(f.drawnOwners.length,0);assert.equal(f.drawing.frames.pending.length,0);assert.match(f.messages.at(-1),/fresh frame/);assert.equal(f.resolution.disabled,false);
  f.ctx.document.hidden=false;f.ctx.redraw.request();f.drawing.frames.step();assert.deepEqual(f.drawnOwners,[f.previous]);
});

test('a decoded owner arriving after page disposal is released without touching disposed scene materials',async t=>{
  const gate=deferred(),next=owner('4k');let draws=0;
  const f=fixture({load:()=>gate.promise,draw:()=>draws++});t.after(()=>{next.dispose();f.dispose();});
  const pending=f.changeResolution('4k');f.ctx.disposed=true;f.ctx.controller.abort();f.previous.dispose();gate.resolve(next);await pending;
  assert.equal(next.releases,1);assert.equal(f.ctx.groundTextures,f.previous);assert.equal(f.material.map,f.previous.map);assert.equal(draws,0);
});
