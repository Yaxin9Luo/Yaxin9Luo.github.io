import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {Game} from '../src/game.js';
import {createWaterReflectionController} from '../src/water-reflection.js';

function recordingRenderer(){
  const main=new THREE.WebGLRenderTarget(2560,1440,{type:THREE.HalfFloatType}),calls=[];
  const domElement=new EventTarget(),listeners=new Map();
  domElement.addEventListener=(event,callback)=>{listeners.set(event,callback);EventTarget.prototype.addEventListener.call(domElement,event,callback);};
  domElement.removeEventListener=(event,callback)=>{if(listeners.get(event)===callback)listeners.delete(event);EventTarget.prototype.removeEventListener.call(domElement,event,callback);};
  let target=main;
  return {main,calls,domElement,listeners,xr:{enabled:true},shadowMap:{autoUpdate:true},autoClear:false,
    state:{buffers:{depth:{setMask(){}}}},info:{reset(){}},
    getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},clear(){},
    render(scene,camera){calls.push({target,camera:camera.clone(),waterVisible:scene.getObjectByName('test-water')?.visible});this.duringRender?.(scene,camera);},
  };
}

function fixture(t){
  const normals=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const water=new Water(new THREE.PlaneGeometry(2,2),{textureWidth:2048,textureHeight:2048,waterNormals:normals});
  water.name='test-water';water.rotation.x=-Math.PI/2;water.position.y=-15;
  const scene=new THREE.Scene();scene.add(water);
  const camera=new THREE.PerspectiveCamera(43,16/9,.1,1000);camera.position.set(130,162,180);camera.lookAt(-2,12,-4);
  scene.updateMatrixWorld();camera.updateMatrixWorld();
  const renderer=recordingRenderer(),stock=water.onBeforeRender,control=createWaterReflectionController(water);
  const environment={phase:.46,lightingVariant:'solar-120-cloud70'};
  const draw=(cam=camera,sc=scene,r=renderer)=>water.onBeforeRender(r,sc,cam,water.geometry,water.material,null);
  const begin=(options={})=>control.beginFrame(renderer,scene,camera,{...environment},options);
  const frame=(options={},count=2)=>{begin(options);for(let i=0;i<count;i++)draw();control.endFrame();};
  t.after(()=>{control.dispose();water.material.uniforms.mirrorSampler.value.renderTarget.dispose();water.material.dispose();water.geometry.dispose();normals.dispose();renderer.main.dispose();});
  return {water,scene,camera,renderer,control,environment,stock,draw,begin,frame};
}

test('one outer frame owns at most one stock reflection; AO and foreign draws cannot consume it',t=>{
  const f=fixture(t),foreign=f.camera.clone();
  f.begin();f.scene.overrideMaterial=new THREE.MeshNormalMaterial();f.draw();f.scene.overrideMaterial.dispose();f.scene.overrideMaterial=null;
  const otherRenderer=recordingRenderer();t.after(()=>otherRenderer.main.dispose());
  f.draw(foreign);f.draw(f.camera,new THREE.Scene());f.draw(f.camera,f.scene,otherRenderer);
  assert.equal(f.renderer.calls.length,0);
  f.renderer.duringRender=(scene,camera)=>{f.draw(camera);f.draw();};
  f.draw();f.draw();f.draw();f.control.endFrame();
  assert.equal(f.renderer.calls.length,1);
  assert.equal(f.renderer.calls[0].waterVisible,false);
  assert.equal(f.renderer.getRenderTarget(),f.renderer.main);
  assert.equal(f.renderer.xr.enabled,true);assert.equal(f.renderer.shadowMap.autoUpdate,true);
  f.draw();assert.equal(f.renderer.calls.length,1,'a draw outside an owned outer frame cannot refresh');
});

test('unchanged camera and light retain a five-outer-frame cadence regardless of callback count',t=>{
  const f=fixture(t);
  f.frame();assert.equal(f.renderer.calls.length,1);
  for(let i=0;i<4;i++)f.frame({},7);
  assert.equal(f.renderer.calls.length,1);
  f.frame({},9);assert.equal(f.renderer.calls.length,2);
  assert.equal(f.control.snapshot().outerFrames,6);
});

test('the first draw after any exact camera, projection, water transform, or daylight change is current',t=>{
  const f=fixture(t),target=f.water.material.uniforms.mirrorSampler.value.renderTarget;
  let disposals=0;target.addEventListener('dispose',()=>disposals++);
  f.frame();
  const changes=[
    ()=>{f.camera.position.x+=1e-8;},
    ()=>{f.camera.rotation.y+=1e-8;},
    ()=>{f.camera.fov+=1e-8;f.camera.updateProjectionMatrix();},
    ()=>{f.camera.aspect=1.4;f.camera.updateProjectionMatrix();},
    ()=>{f.water.position.y+=.1;},
    ()=>{f.environment.phase+=1e-10;},
    ()=>{f.environment.lightingVariant='baseline';},
  ];
  for(const change of changes){
    const before=f.renderer.calls.length;change();f.frame();
    assert.equal(f.renderer.calls.length,before+1);
    assert.deepEqual(f.water.material.uniforms.eye.value.toArray(),new THREE.Vector3().setFromMatrixPosition(f.camera.matrixWorld).toArray());
    const projection=f.water.material.uniforms.textureMatrix.value.toArray();
    f.stock.call(f.water,f.renderer,f.scene,f.camera);
    assert.deepEqual(projection,f.water.material.uniforms.textureMatrix.value.toArray(),'scheduled texture projection matches a fresh stock Water callback');
  }
  assert.equal(f.water.material.uniforms.mirrorSampler.value.renderTarget,target);
  assert.deepEqual([target.width,target.height,target.texture.type],[2048,2048,THREE.HalfFloatType]);
  assert.equal(disposals,0);
});

test('parent camera transforms and environment texture changes invalidate by exact state',t=>{
  const f=fixture(t),parent=new THREE.Group();f.scene.add(parent);parent.add(f.camera);
  f.frame();parent.position.x=.125;f.frame();assert.equal(f.renderer.calls.length,2);
  f.scene.environment=new THREE.Texture();t.after(()=>f.scene.environment.dispose());
  f.frame();assert.equal(f.renderer.calls.length,3);
  f.scene.environment.needsUpdate=true;f.frame();assert.equal(f.renderer.calls.length,4);
  f.frame();assert.equal(f.renderer.calls.length,4,'new equivalent environment sample objects do not invalidate');
});

test('visual revisions and first/full-frame force requests refresh once then resume the normal guard',t=>{
  const f=fixture(t);
  f.frame({revision:1});f.frame({revision:1});assert.equal(f.renderer.calls.length,1);
  f.frame({revision:2});assert.equal(f.renderer.calls.length,2);
  f.frame({revision:2,force:true});assert.equal(f.renderer.calls.length,3);
  f.frame({revision:2});assert.equal(f.renderer.calls.length,3);
  f.control.invalidate();f.control.invalidate();f.frame({revision:2});assert.equal(f.renderer.calls.length,4);
});

test('an invalidation raised during reflection survives for the next outer frame, and failure is not committed',t=>{
  const f=fixture(t);let invalidate=true;
  f.renderer.duringRender=()=>{if(invalidate){invalidate=false;f.control.invalidate();}};
  f.frame();f.frame();assert.equal(f.renderer.calls.length,2);
  f.control.invalidate();f.renderer.duringRender=()=>{throw new Error('recording render failure');};
  f.begin();assert.throws(()=>f.draw(),/recording render failure/);f.control.endFrame();
  // Stock Water does not restore its renderer state on exceptions. Restore the
  // recording boundary here; the scheduler must still retry the uncommitted state.
  f.water.visible=true;f.renderer.setRenderTarget(f.renderer.main);f.renderer.duringRender=null;
  const before=f.renderer.calls.length;f.frame();assert.equal(f.renderer.calls.length,before+1);
});

test('context invalidation, per-lake ownership, and disposal leave no late refresh or listener',t=>{
  const a=fixture(t),b=fixture(t);a.frame();b.frame();
  assert.equal(a.renderer.listeners.size,2);assert.equal(b.renderer.listeners.size,2);
  a.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));
  a.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
  a.frame();b.frame();assert.equal(a.renderer.calls.length,2);assert.equal(b.renderer.calls.length,1);
  a.control.dispose();const state=a.control.snapshot();assert.equal(a.renderer.listeners.size,0);assert.equal(b.renderer.listeners.size,2);
  a.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
  a.control.invalidate();a.begin();a.draw();a.control.endFrame();a.control.dispose();
  assert.deepEqual(a.control.snapshot(),state);assert.equal(a.renderer.calls.length,2);
});

test('actual Game dispatch prepares once after the idle gate, carries review/full-frame invalidation, and closes on errors',t=>{
  const f=fixture(t),events=[];
  const game=Object.create(Game.prototype);
  Object.assign(game,{_disposed:false,_contextLost:false,_frameCount:0,options:{reducedMotion:true},scene:f.scene,camera:f.camera,environment:f.environment,
    position:new THREE.Vector3(),heading:0,_keys:new Set(),_touch:{x:0,z:0},_controls:{},_isPaused:()=>true,
    _reviewRendering:{staticComparison:true,continuous:false,pending:true,requestedRevision:1,lastView:null},
    world:{lake:{reflection:f.control}},renderer:f.renderer,
    rendering:{render(){events.push('render');f.draw();f.draw();}},
  });
  const begin=f.control.beginFrame.bind(f.control),end=f.control.endFrame.bind(f.control);
  f.control.beginFrame=(...args)=>{events.push('begin');return begin(...args);};
  f.control.endFrame=()=>{events.push('end');return end();};
  assert.equal(game._renderFrame(0),true);assert.deepEqual(events,['begin','render','end']);assert.equal(f.renderer.calls.length,1);
  assert.equal(game._renderFrame(0),false);assert.equal(f.control.snapshot().outerFrames,1);
  game._reviewRendering.pending=true;game._reviewRendering.requestedRevision++;
  game._renderFrame(0);assert.equal(f.renderer.calls.length,2);
  game._fullFrame=()=>events.push('full');game._renderFrame(0);assert.equal(f.renderer.calls.length,3);assert.equal(events.at(-1),'full');
  game._reviewRendering.pending=true;game.rendering.render=()=>{throw new Error('outer render failure');};
  assert.throws(()=>game._renderFrame(0),/outer render failure/);assert.equal(events.at(-1),'end');assert.equal(f.control.snapshot().active,false);
  assert.equal(game._reviewRendering.pending,true);
});

test('actual Game reflection validates camera and replacement daylight state changed inside its render wrapper',t=>{
  const f=fixture(t),game=Object.create(Game.prototype);let beforeDraw=()=>{};
  Object.assign(game,{_disposed:false,_contextLost:false,_frameCount:0,options:{reducedMotion:false},scene:f.scene,camera:f.camera,environment:f.environment,
    position:new THREE.Vector3(),heading:0,_keys:new Set(),_touch:{x:0,z:0},_controls:{},_isPaused:()=>true,
    _reviewRendering:{staticComparison:false,continuous:true,pending:true,requestedRevision:1,lastView:null},
    world:{lake:{reflection:f.control}},renderer:f.renderer,
    rendering:{render(){beforeDraw();f.draw();f.draw();}},
  });
  game._renderFrame(0);assert.equal(f.renderer.calls.length,1);
  // Like the QA updateSequence wrapper, mutate the real camera after Game's
  // beginFrame and before the first transmission/main Water draw.
  beforeDraw=()=>{f.camera.position.x+=7;f.camera.fov+=3;f.camera.updateProjectionMatrix();};
  game._renderFrame(0);assert.equal(f.renderer.calls.length,2,'an apparent reuse frame must refresh its actual draw pose once');
  assert.deepEqual(f.water.material.uniforms.eye.value.toArray(),new THREE.Vector3().setFromMatrixPosition(f.camera.matrixWorld).toArray());
  const projection=f.water.material.uniforms.textureMatrix.value.toArray();
  f.stock.call(f.water,f.renderer,f.scene,f.camera);
  assert.deepEqual(projection,f.water.material.uniforms.textureMatrix.value.toArray(),'late camera changes retain the exact stock texture projection');
  beforeDraw=()=>{};let count=f.renderer.calls.length;
  game._renderFrame(0);assert.equal(f.renderer.calls.length,count,'the signature committed is the pose that was rendered');
  game._fullFrame=()=>{};
  beforeDraw=()=>{f.camera.position.z+=11;};
  game._renderFrame(0);assert.equal(f.renderer.calls.length,++count);
  beforeDraw=()=>{};game._renderFrame(0);assert.equal(f.renderer.calls.length,count,'a forced refresh also commits its late final pose');
  beforeDraw=()=>{game.environment={...game.environment,phase:.8};};
  game._renderFrame(0);assert.equal(f.renderer.calls.length,++count,'a replacement daylight sample is read at the actual draw');
  beforeDraw=()=>{};game._renderFrame(0);assert.equal(f.renderer.calls.length,count);
  beforeDraw=()=>{game.environment={...game.environment,lightingVariant:'baseline'};};
  game._renderFrame(0);assert.equal(f.renderer.calls.length,++count);
  beforeDraw=()=>{};game._renderFrame(0);assert.equal(f.renderer.calls.length,count);
});

test('eligible reuse draws keep the main eye current and observe invalidation after frame opening',t=>{
  const f=fixture(t);f.frame();f.begin();
  f.water.material.uniforms.eye.value.set(0,0,0);
  f.draw();assert.equal(f.renderer.calls.length,1);
  assert.deepEqual(f.water.material.uniforms.eye.value.toArray(),new THREE.Vector3().setFromMatrixPosition(f.camera.matrixWorld).toArray());
  f.control.invalidate();f.draw();f.draw();f.control.endFrame();
  assert.equal(f.renderer.calls.length,2,'invalidation after a reuse draw can refresh once without advancing outer cadence');
  f.frame();assert.equal(f.renderer.calls.length,2,'the invalidation actually consumed belongs to that draw');
});
