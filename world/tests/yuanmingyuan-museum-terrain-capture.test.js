import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {captureTerrainRegions} from '../src/yuanmingyuan/terrain-region-export.js';
import {createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

const source=readFileSync(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function snippet(){
  const start=source.indexOf("  const exportGround=document.createElement('button');"),end=source.indexOf("  const reflectionSelect=",start);
  assert.ok(start>=0&&end>start,'actual live terrain export handler exists');
  // Only the two asynchronous module loaders are injected. The real event,
  // fresh-frame gate, exporter, state and upload order execute unchanged.
  return source.slice(start,end).replace("import('./terrain-region-export.js')",'loadExporter()').replace("import('./xianfa-terrain-capture-request.json')",'loadRequest()');
}
function fixture({loadGate,drawResult=true}={}){
  const nodes=new Map(),posts=[],events=[],messages=[];let draws=0,exports=0;
  const node=()=>({children:[],listeners:{},disabled:false,textContent:'',setAttribute(){},insertBefore(n){this.children.push(n);},addEventListener(type,callback){this.listeners[type]=callback;}});
  const geometry=new THREE.BufferGeometry();geometry.name='same-live-two-triangles';geometry.setAttribute('position',new THREE.Float32BufferAttribute([-2,4,-2,-2,4,2,2,4,2,2,4,-2],3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(geometry,material),group=new THREE.Group();mesh.userData.body='land';group.add(mesh);group.updateMatrixWorld(true);
  const sampler=createTriangleSampler([geometry]),terrain={group,coastPolygon:[[-2,-2],[2,-2],[2,2],[-2,2]],paths:[],bridges:[],waterSurfaces:[],courtFootprints:[],replacementStates:[],colliders:[],diagnostics:{fixture:true},
    surfaceAt(x,z,{maxY=Infinity}={}){const hit=sampler.sample(x,z,maxY);return hit?{...hit,kind:'land',walkable:true,supportSource:'terrain-triangle'}:null;},heightAt(x,z,options){return this.surfaceAt(x,z,options)?.height;}};
  const part=new THREE.Group();part.name='live-pilot-part';part.userData={placementId:'same-owner',species:'fixture'};part.updateMatrixWorld(true);
  const request={regions:[{id:'small',minX:-1,maxX:1,minZ:-1,maxZ:1}],probes:[{id:'actual',x:.3,z:.2,maxY:null,includeBridges:true}],limits:{scope:'tiny-fixture'}};
  const ctx={ready:true,loading:false,capturing:false,disposed:false,contextLost:false,reviewPaused:true,reader:{isOpen:false},dialogs:[],query:new URLSearchParams('review=still'),
    document:{hidden:false,createElement:node},keys:new Set(),touch:{clear(){}},guides:{setPaused(){}},reviewFramesRemaining:0,reviewMotion:null,raf:0,last:0,
    controller:new AbortController(),terrain,sourceTag:'two-live-faces',currentSite:{id:'fixture'},plantingPilot:{diagnostics:{sameOwner:true},parts:[part]},residents:{snapshot:{retained:true}},preparedGroundSources:null,shoreBank:null,
    $:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},syncControls(){},message:m=>messages.push(m),tick(){},evidence:()=>({draws}),
    render(){draws++;events.push('draw');if(drawResult===false)return false;part.updateMatrixWorld(true);return true;},
    loadExporter:async()=>{if(loadGate)await loadGate.promise;return {captureTerrainRegions(...args){events.push('export');exports++;assert.equal(args[0],terrain);return captureTerrainRegions(...args);}};},
    loadRequest:async()=>({default:request}),fetch:async(url,{body})=>{events.push('post');posts.push({url,body});return {ok:true};},
  };
  vm.createContext(ctx);
  for(const prefix of ['const paused=','function start(','function setReviewPaused(']){
    const lines=source.split('\n').filter(line=>line.startsWith(prefix));assert.equal(lines.length,1);vm.runInContext(lines[0],ctx);
  }
  const drawing=installSceneRedraw(ctx,source);vm.runInContext(snippet(),ctx);
  const button=nodes.get('review-tools').children[0];
  return {ctx,part,posts,events,messages,drawing,button,geometry,get draws(){return draws;},get exports(){return exports;},click:()=>button.listeners.click(),
    dispose(){drawing.dispose();sampler.dispose();geometry.dispose();material.dispose();group.clear();ctx.controller.abort();}};
}

test('actual terrain export waits for imports, flushes the latest frame, then serializes the same live triangles and matrices',async t=>{
  const gate=deferred(),f=fixture({loadGate:gate});t.after(()=>f.dispose());f.ctx.redraw.request();const queued=f.drawing.frames.ids[0];
  const saving=f.click();assert.equal(f.draws,0);assert.equal(f.exports,0);assert.equal(f.ctx.capturing,true);
  f.part.position.set(3,5,7);assert.equal(f.part.matrixWorld.elements[12],0,'world matrix is deliberately stale until real frame callback');gate.resolve();await saving;
  assert.deepEqual(f.events,['draw','export','post']);assert.equal(f.draws,1);assert.equal(f.drawing.redraw.pending,false);f.drawing.frames.late(queued);assert.equal(f.draws,1);
  const data=JSON.parse(f.posts[0].body);assert.equal(data.sourceIdentity,'two-live-faces');assert.equal(data.probes[0].surface.height,4);assert.equal(data.probes[0].surface.geometryUUID,f.geometry.uuid);
  assert.deepEqual(data.geometries[0].sourceTriangleIndices,[0,1]);assert.deepEqual(data.livePilot.parts[0].worldMatrix,f.part.matrixWorld.toArray());assert.deepEqual(data.livePilot.parts[0].worldMatrix.slice(12,15),[3,5,7]);assert.equal(data.scene.site,'fixture');
  assert.equal(f.button.disabled,false);assert.equal(f.ctx.capturing,false);
});
test('actual terrain export refuses a stale frame after hiding or disposing while its module import is outstanding',async t=>{
  for(const boundary of ['hidden','disposed']){
    const gate=deferred(),f=fixture({loadGate:gate});t.after(()=>f.dispose());const saving=f.click(),queued=f.drawing.frames.ids[0];
    if(boundary==='hidden')f.ctx.document.hidden=true;else{f.ctx.disposed=true;f.drawing.redraw.dispose();f.ctx.controller.abort();}
    gate.resolve();await saving;f.drawing.frames.late(queued);assert.equal(f.draws,0);assert.equal(f.exports,0);assert.equal(f.posts.length,0);assert.equal(f.ctx.capturing,false);assert.equal(f.button.disabled,false);
    if(boundary==='hidden')assert.match(f.messages[0],/live rendered terrain is required/);
  }
});
test('actual terrain export cannot publish when its synchronous render returns no fresh frame',async t=>{
  const f=fixture({drawResult:false});t.after(()=>f.dispose());await f.click();assert.equal(f.draws,1);assert.equal(f.exports,0);assert.equal(f.posts.length,0);assert.equal(f.drawing.redraw.pending,false);assert.equal(f.ctx.capturing,false);assert.equal(f.button.disabled,false);assert.match(f.messages[0],/live rendered terrain is required/);
});
