import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGardenWater} from '../src/yuanmingyuan/garden-water.js';

test('actual lake and sea reflectors declare the AO exclusion and retain full reflection resolution',()=>{
  const surface=new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2),coast=[[-20,-20],[20,-20],[20,20],[-20,20]];
  const terrain={waterSurfaces:[{geometry:surface,worldY:2}],coastPolygon:coast},layout={exhibition:{seaY:0,coast:{polygon:coast}}};
  const water=createGardenWater({terrain,layout});
  try{assert.equal(water.sheets.length,2);for(const sheet of water.sheets){assert.equal(sheet.isWater,true);assert.equal(sheet.getRenderTarget().width,2048);assert.equal(sheet.getRenderTarget().samples,4);assert.equal(sheet.material.transparent,false);}}
  finally{water.dispose();surface.dispose();}
  assert.equal(water.group.children.length,0);
});

function fixture(t){
  const surfaces=[2,3.7].map(worldY=>({geometry:new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2),worldY}));
  const coast=[[-20,-20],[20,-20],[20,20],[-20,20]],water=createGardenWater({terrain:{waterSurfaces:surfaces,coastPolygon:coast},layout:{exhibition:{seaY:0,coast:{polygon:coast}}}});
  const scene=new THREE.Scene();scene.add(water.group);
  const camera=new THREE.PerspectiveCamera(45,1.5,.08,22000);camera.position.set(8,12,24);camera.lookAt(0,0,0);
  scene.updateMatrixWorld();camera.updateMatrixWorld();
  const main=new THREE.WebGLRenderTarget(3200,2200),currentViewport=new THREE.Vector4(0,0,3200,2200);let target=main,cubeFace=0,mipmap=0;
  const renderer={xr:{enabled:true},shadowMap:{autoUpdate:false,needsUpdate:false},autoClear:false,calls:[],info:{render:{frame:0}},
    state:{buffers:{depth:{setMask(){}}},viewport:value=>currentViewport.copy(value)},
    getRenderTarget:()=>target,getActiveCubeFace:()=>cubeFace,getActiveMipmapLevel:()=>mipmap,
    getCurrentViewport:value=>value.copy(currentViewport),setRenderTarget(value,face=0,level=0){target=value;cubeFace=face;mipmap=level;currentViewport.set(0,0,value?.width??3200,value?.height??2200);},clear(){},
    render(renderScene,renderCamera){this.info.render.frame++;this.calls.push({camera:renderCamera.clone(),target,visible:water.sheets.map(sheet=>sheet.visible),shadowDirty:this.shadowMap.needsUpdate});this.duringRender?.(renderScene,renderCamera);},
  };
  const sample={lightDirection:new THREE.Vector3(1,1,1).normalize(),key:new THREE.Color(0xffeedd),keyIntensity:3,night:0,water:new THREE.Color(0x548d84)};
  const update=(time=12)=>water.update(time,sample,camera),draw=(sheet=water.sheets[0],cam=camera)=>sheet.onBeforeRender(renderer,scene,cam,sheet.geometry,sheet.material,null);
  t.after(()=>{water.dispose();for(const surface of surfaces)surface.geometry.dispose();main.dispose();});
  return {water,scene,camera,renderer,main,update,draw};
}

test('three real Reflectors capture once each across transmission and beauty callbacks',t=>{
  const f=fixture(t);f.update();
  // The two opaque traversals in r185 call the same objects with the same main
  // camera. This recording backend executes stock Reflector math, not WebGL.
  for(let pass=0;pass<2;pass++)for(const sheet of f.water.sheets)f.draw(sheet);
  assert.equal(f.renderer.calls.length,3);
  assert.ok(f.renderer.calls.every(call=>call.visible.every(value=>value===false)));
  assert.ok(f.renderer.calls.every(call=>call.shadowDirty===false));
  const snapshot=f.water.snapshot();assert.equal(snapshot.epoch,1);
  assert.deepEqual(snapshot.sheets.map(sheet=>sheet.height),[2,3.7,0]);
  for(const sheet of snapshot.sheets)assert.deepEqual(sheet.frame,{attempt:2,capture:1,reuse:1,recursion:0,backFacing:0,override:0,failure:0});
  assert.equal(f.renderer.getRenderTarget(),f.main);assert.equal(f.renderer.xr.enabled,true);
});

test('same-time outer updates reset only frame counts and perform fresh reflections',t=>{
  const f=fixture(t);f.update(9);f.draw();f.draw();f.update(9);f.draw();
  assert.equal(f.renderer.calls.length,2);
  const snapshot=f.water.snapshot();assert.equal(snapshot.epoch,2);
  assert.equal(snapshot.sheets[0].frame.capture,1);assert.equal(snapshot.sheets[0].frame.reuse,0);
  assert.equal(snapshot.sheets[0].total.capture,2);assert.equal(snapshot.sheets[0].total.reuse,1);
  assert.equal(snapshot.sheets[1].frame.attempt,0,'a sheet never submitted is distinguishable from a reused reflection');
});

test('camera A to B to A, projection edits and surface transforms regenerate stock reflection matrices',t=>{
  const f=fixture(t),b=f.camera.clone();b.updateMatrixWorld();f.update();
  for(const camera of [f.camera,b,f.camera])f.draw(undefined,camera);
  assert.equal(f.renderer.calls.length,3);
  f.camera.fov=52;f.camera.updateProjectionMatrix();f.draw();
  assert.equal(f.renderer.calls.length,4);
  f.water.sheets[0].position.y+=.2;f.scene.updateMatrixWorld();f.draw();
  assert.equal(f.renderer.calls.length,5);
  assert.notDeepEqual(f.renderer.calls[3].camera.projectionMatrix.elements,f.renderer.calls[4].camera.projectionMatrix.elements);
});

test('a failed real Reflector callback restores renderer and all peer visibility, then retries',t=>{
  const f=fixture(t);f.update();f.water.sheets[1].visible=false;
  const viewport=new THREE.Vector4(7,9,1200,800);f.renderer.state.viewport(viewport);
  f.renderer.duringRender=()=>{throw new Error('capture failed after target switch');};
  assert.throws(()=>f.draw(),/capture failed after target switch/);
  assert.equal(f.renderer.getRenderTarget(),f.main);assert.equal(f.renderer.xr.enabled,true);
  assert.equal(f.renderer.shadowMap.autoUpdate,false);assert.equal(f.renderer.shadowMap.needsUpdate,false);
  assert.deepEqual(f.renderer.getCurrentViewport(new THREE.Vector4()).toArray(),viewport.toArray());
  assert.deepEqual(f.water.sheets.map(sheet=>sheet.visible),[true,false,true]);
  assert.equal(f.water.snapshot().sheets[0].cached,false);
  f.renderer.duringRender=null;f.draw();f.draw();
  const counts=f.water.snapshot().sheets[0].frame;
  assert.equal(counts.failure,1);assert.equal(counts.capture,1);assert.equal(counts.reuse,1);
});

test('recursion, normal overrides and back-facing callbacks do not capture or poison the cache',t=>{
  const f=fixture(t);f.update();
  f.renderer.duringRender=()=>{f.draw();f.draw(f.water.sheets[1]);};f.draw();f.renderer.duringRender=null;
  assert.equal(f.renderer.calls.length,1);assert.equal(f.water.snapshot().sheets[0].frame.recursion,1);
  assert.equal(f.water.snapshot().sheets[1].frame.recursion,1);
  const normal=new THREE.MeshNormalMaterial();f.scene.overrideMaterial=normal;f.draw();f.scene.overrideMaterial=null;normal.dispose();
  const below=f.camera.clone();below.position.y=-10;below.updateMatrixWorld();f.draw(undefined,below);f.draw();
  assert.equal(f.renderer.calls.length,1);
  const counts=f.water.snapshot().sheets[0].frame;assert.equal(counts.override,1);assert.equal(counts.backFacing,1);assert.equal(counts.reuse,1);
});

test('forceUpdate bypasses reuse; disposal clears captured views and stops callbacks idempotently',t=>{
  const f=fixture(t),sheet=f.water.sheets[0];let disposed=0;sheet.getRenderTarget().addEventListener('dispose',()=>disposed++);
  f.update();f.draw();sheet.forceUpdate=true;f.draw();assert.equal(f.renderer.calls.length,2);
  const snapshot=f.water.snapshot();snapshot.sheets[0].frame.capture=99;
  assert.equal(f.water.snapshot().sheets[0].frame.capture,2,'telemetry is detached from internal counters');
  f.water.dispose();f.water.dispose();f.draw(sheet);f.update();
  assert.equal(disposed,1);assert.equal(f.renderer.calls.length,2);assert.equal(f.water.sheets.length,0);
  assert.ok(f.water.snapshot().sheets.every(record=>record.cached===false));assert.equal(f.water.snapshot().disposed,true);
});
