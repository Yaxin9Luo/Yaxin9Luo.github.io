import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {installSceneRedraw} from './helpers/museum-scene-redraw.js';

const source=await readFile(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
const start=source.indexOf("  const select=document.createElement('select');select.setAttribute('aria-label','草地材质对照 / Ground material');");
const ending="});$('review-tools').insertBefore(select,$('capture'));";
const end=source.indexOf(ending,start)+ending.length;
assert(start>=0&&end>start,'Execute the real review menu and handler, not a copied replacement');

function fixture(){
  const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.MeshStandardMaterial({vertexColors:true}),other=new THREE.MeshStandardMaterial();
  const groundTextures=Object.fromEntries(['map','normalMap','roughnessMap'].map(slot=>[slot,new THREE.Texture()]));
  for(const texture of Object.values(groundTextures))texture.repeat.setScalar(5/6);
  applyGardenGroundTextures(material,groundTextures);
  const group=new THREE.Group(),meshes=[new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,other)];
  for(const mesh of meshes){mesh.receiveShadow=true;group.add(mesh);}
  let select,renderCalls=0,disposals=0;
  for(const resource of [geometry,material,other,...Object.values(groundTextures)])resource.addEventListener('dispose',()=>disposals++);
  const nodes={capture:{},telemetry:{textContent:''},'review-tools':{insertBefore(node){select=node;}}};
  const context={groundReview:'dry-scale15',groundTextures,terrain:{earthMaterial:material,group},scene:group,query:new URLSearchParams('review=still'),
    document:{createElement(){return{options:[],handlers:{},setAttribute(){},append(node){this.options.push(node);},addEventListener(type,handler){this.handlers[type]=handler;}};}},
    $:id=>nodes[id],render:()=>{renderCalls++;return true;},evidence:()=>({variant:context.groundReview})};
  runInNewContext(source.slice(start,end),context);
  const drawing=installSceneRedraw(context,source);
  return {material,other,geometry,groundTextures,meshes,select,drawing,
    change(value){select.value=value;select.handlers.change();},get renderCalls(){return renderCalls;},get disposals(){return disposals;},
    dispose(){drawing.dispose();for(const resource of [geometry,material,other,...Object.values(groundTextures)])resource.dispose();group.clear();}};
}

test('actual color-off menu removes only albedo input and retains the real geometry/PBR owner',()=>{
  const f=fixture();try{
    assert(f.select.options.some(option=>option.value==='dry-scale15-color-off'));
    const positions=f.geometry.attributes.position.array,version=f.material.version,normal=f.material.normalMap,roughness=f.material.roughnessMap;
    f.change('dry-scale15-color-off');
    assert.equal(f.material.map,null);assert.equal(f.material.normalMap,normal);assert.equal(f.material.roughnessMap,roughness);
    assert.deepEqual(f.material.normalScale.toArray(),[.42,.42]);assert.equal(f.material.roughness,.98);assert.equal(f.material.userData.gardenDryRoughness,true);
    assert.equal(f.material.vertexColors,true);assert.equal(f.geometry.attributes.position.array,positions);assert(f.material.version>version);
    assert(f.meshes.every(mesh=>mesh.receiveShadow));assert.equal(f.renderCalls,0,'The changed material waits for its real queued frame');assert.equal(f.drawing.frames.pending.length,1);f.drawing.frames.step();assert.equal(f.renderCalls,1);assert.equal(f.disposals,0);
    for(const texture of Object.values(f.groundTextures))assert.deepEqual(texture.repeat.toArray(),[5/6,5/6]);
  }finally{f.dispose();}
});

test('returning from color-off to dry or normal-off restores the exact retained color texture',()=>{
  const f=fixture();try{
    for(const next of ['dry-scale15','dry-scale15-normal-off','baseline']){
      f.change('dry-scale15-color-off');assert.equal(f.material.map,null);
      f.change(next);assert.equal(f.material.map,f.groundTextures.map);
    }
    assert.equal(f.disposals,0);assert.equal(f.renderCalls,0);assert.equal(f.drawing.frames.pending.length,1,'Six synchronous diagnostic changes share the final frame');f.drawing.frames.step();assert.equal(f.renderCalls,1);
  }finally{f.dispose();}
});

test('color-only review restores prior shadow/normal variants without changing unrelated material meshes',()=>{
  const f=fixture();try{
    f.change('dry-scale15-no-shadows');assert.deepEqual(f.meshes.map(mesh=>mesh.receiveShadow),[false,false,true]);
    f.change('dry-scale15-color-off');assert.deepEqual(f.meshes.map(mesh=>mesh.receiveShadow),[true,true,true]);
    f.change('dry-scale15-normal-off');assert.deepEqual(f.material.normalScale.toArray(),[0,0]);
    f.change('dry-scale15-color-off');assert.deepEqual(f.material.normalScale.toArray(),[.42,.42]);assert.equal(f.material.map,null);
    assert.equal(f.other.map,null);assert.equal(f.other.normalMap,null);assert.equal(f.disposals,0);
  }finally{f.dispose();}
});
