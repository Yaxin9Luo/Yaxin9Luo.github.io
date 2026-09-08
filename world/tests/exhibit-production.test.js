import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createExhibitionStage} from '../src/exhibits.js';
import {createAtelierMaterials} from '../src/exhibit-materials.js';

const makeStage=options=>createExhibitionStage(new THREE.Scene(),()=>0,options);
const tick=(stage,count=120,dt=1/60)=>{for(let i=0;i<count;i++)stage.update(i*dt,dt);};

test('the method folio opens, reverses continuously and settles closed',()=>{
  const stage=makeStage();
  try{
    const cover=stage.group.getObjectByName('exhibition-folio-cover-hinge');
    stage.setOpen(true);tick(stage,12);const partial=cover.rotation.z;
    assert.ok(partial>.1&&partial<Math.PI*.94,'the cover physically articulates');
    stage.setOpen(false);assert.equal(cover.rotation.z,partial,'reversal starts at the current pose');
    stage.update(.3,1/60);assert.ok(cover.rotation.z<partial);
    tick(stage,180);assert.equal(cover.rotation.z,0);
  }finally{stage.dispose();}
});

test('focus and reduced motion settle without advancing on paused or background frames',()=>{
  const stage=makeStage();
  try{
    stage.setFocused(true);stage.setOpen(true);tick(stage,8);
    const before=stage.motionState;
    stage.update(900,0);assert.deepEqual(stage.motionState,before,'explicit paused dt does not animate');
    stage.update(9900);assert.deepEqual(stage.motionState,before,'a resumed legacy clock does not skip the transition');
    stage.update(9901,1/60,true);
    assert.equal(stage.motionState.open,1);assert.equal(stage.motionState.focus,1);
    stage.setOpen(false,{reducedMotion:true});stage.setFocused(false,{reducedMotion:true});
    assert.equal(stage.motionState.open,0);assert.equal(stage.motionState.focus,0);
  }finally{stage.dispose();}
});

test('physical folio, output and role surfaces own their semantic hits in both poses',()=>{
  const stage=makeStage();
  try{
    for(const open of [false,true]){
      stage.setOpen(open,{reducedMotion:true});stage.group.updateMatrixWorld(true);
      const targets=[
        ['exhibition-screen-backing','open',null],
        [open?'exhibition-folio-reading-page':'exhibition-folio-cover','detail','method'],
        ['exhibition-role-plaque','detail','role'],
      ];
      for(const [name,action,section]of targets){
        const mesh=stage.group.getObjectByName(name),center=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        const direction=name.includes('folio')?new THREE.Vector3(0,-1,0):new THREE.Vector3(0,0,-1);
        const ray=new THREE.Raycaster(center.clone().addScaledVector(direction,-4),direction);
        const hit=ray.intersectObjects(stage.interactiveTargets,false)[0];
        assert.ok(hit,`${name} receives an actual ray`);
        assert.equal(hit.object.userData.exhibition.action,action,name);
        if(section)assert.equal(hit.object.userData.exhibition.section,section,name);
        const blocker=ray.intersectObject(stage.group,true)[0];
        assert.ok(!blocker||blocker.distance>=hit.distance-.05,'decoration does not swallow the target');
      }
    }
  }finally{stage.dispose();}
});

test('camera bounds contain the fully open physical folio as well as its closed pose',()=>{
  const stage=makeStage();
  try{
    for(const open of [false,true]){
      stage.setOpen(open,{reducedMotion:true});stage.group.updateMatrixWorld(true);
      const folio=stage.group.getObjectByName('exhibition-method-folio');
      assert.ok(stage.camera.framingBounds[2].containsBox(new THREE.Box3().setFromObject(folio)));
    }
    const inside=stage.group.getObjectByName('exhibition-folio-inside-cover');
    const right=new THREE.Vector3(1,0,0).transformDirection(inside.matrixWorld),top=new THREE.Vector3(0,1,0).transformDirection(inside.matrixWorld);
    assert.ok(right.x>.9&&top.z<-.9,'the open inside-cover text faces the visitor without reading upside down');
  }finally{stage.dispose();}
});

test('newer project media wins; late disposal releases textures without mutating the detached scene',async()=>{
  const pending=[];
  const stage=makeStage({loadMedia:src=>new Promise(resolve=>pending.push({src,resolve}))});
  const texture=()=>{const t=new THREE.Texture({width:1200,height:800});t.released=0;t.addEventListener('dispose',()=>t.released++);return t;};
  stage.setMedia(1);const newest=texture();pending[1].resolve(newest);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stage.loadedSource,pending[1].src);
  const obsolete=texture();pending[0].resolve(obsolete);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stage.loadedSource,pending[1].src);
  stage.setMedia(2);stage.dispose();stage.dispose();
  const late=texture();pending[2].resolve(late);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(late.released,1);assert.equal(obsolete.released,1);assert.equal(newest.released,1);
  assert.equal(stage.group.parent,null);assert.equal(stage.setProject('dvin'),false);
  assert.equal(stage.setOpen(true),false);
});

test('local surface maps are shared, physically scaled and survive a stage material disposal',async()=>{
  const cache=new Map();
  const surfaces=createAtelierMaterials({loadTexture:(set,channel)=>{
    const id=`${set}/${channel}`;if(!cache.has(id)){const texture=new THREE.Texture();texture.released=0;texture.addEventListener('dispose',()=>texture.released++);cache.set(id,texture);}return cache.get(id);
  }});
  await surfaces.ready;
  assert.equal(surfaces.errors.length,0);
  assert.equal(surfaces.materials.wood.map,surfaces.materials.edge.map,'different walnut finishes reuse the same decoded source');
  for(const material of Object.values(surfaces.materials).filter(m=>m.userData.surface)){
    assert.ok(material.map&&material.normalMap&&material.roughnessMap,'each surface has all three PBR channels');
    assert.ok(material.userData.metresPerRepeat>0);
  }
  const material=surfaces.materials.wood;let materialReleased=0;material.addEventListener('dispose',()=>materialReleased++);
  surfaces.dispose();surfaces.dispose();assert.equal(materialReleased,1);
  assert.ok([...cache.values()].every(texture=>texture.released===0),'another scene can continue to use shared PBR allocations');
  const stage=makeStage();
  try{
    const frame=stage.group.getObjectByName('exhibition-screen-frame'),{position,normal,uv}=frame.geometry.attributes,metres=frame.material.userData.metresPerRepeat;
    let checked=0;
    for(let i=0;i<position.count;i+=3){
      if([i,i+1,i+2].some(index=>normal.getZ(index)<.999))continue;
      const dx=position.getX(i+1)-position.getX(i),dy=position.getY(i+1)-position.getY(i);
      assert.ok(Math.abs((uv.getX(i+1)-uv.getX(i))*metres-dx)<.00001);
      assert.ok(Math.abs((uv.getY(i+1)-uv.getY(i))*metres-dy)<.00001);checked++;
    }
    assert.ok(checked>0,'physical front-face UVs use the measured material repeat');
  }finally{stage.dispose();}
});

test('late material completion cannot repopulate disposed materials; failures leave a usable fallback',async()=>{
  const pending=[];const surfaces=createAtelierMaterials({loadTexture:(set,channel)=>new Promise((resolve,reject)=>pending.push({set,channel,resolve,reject}))});
  await Promise.resolve();surfaces.dispose();
  pending.forEach((job,index)=>index===0?job.reject(new Error('offline')):job.resolve(new THREE.Texture()));
  await surfaces.ready;assert.equal(surfaces.errors.length,1);
  assert.ok(Object.values(surfaces.materials).every(material=>!material.map&&!material.normalMap&&!material.roughnessMap));
});

test('rapid media changes retarget the instrument continuously and a reduced update settles the latest index',()=>{
  const stage=makeStage();
  try{
    const pointer=stage.group.getObjectByName('exhibition-instrument-media-pointer');
    stage.setMedia(5);tick(stage,6);const partial=pointer.rotation.y;
    stage.setMedia(0);assert.equal(pointer.rotation.y,partial);
    stage.update(1,1/60);assert.ok(pointer.rotation.y<partial);
    stage.setMedia(3);stage.update(1.1,1/60,true);assert.equal(stage.motionState.media,3/5);
  }finally{stage.dispose();}
});

test('articulated geometry requests one shadow refresh per changed pose, including immediate reduced motion',()=>{
  const stage=makeStage();
  try{
    assert.equal(stage.consumeShadowUpdate(),true,'the newly created scene needs its initial shadow pass');
    assert.equal(stage.consumeShadowUpdate(),false);
    stage.update(0,0);assert.equal(stage.shadowDirty,false);
    stage.setOpen(true);assert.equal(stage.consumeShadowUpdate(),false,'a target change alone does not move a shadow caster');
    stage.update(.016,1/60);assert.equal(stage.shadowDirty,true);assert.equal(stage.consumeShadowUpdate(),true);assert.equal(stage.shadowDirty,false);
    tick(stage,180);assert.equal(stage.consumeShadowUpdate(),true);stage.update(4,1/60);assert.equal(stage.consumeShadowUpdate(),false,'settled update timers do not redraw shadows');
    stage.setOpen(false,{reducedMotion:true});assert.equal(stage.consumeShadowUpdate(),true);
    stage.setOpen(false,{reducedMotion:true});assert.equal(stage.consumeShadowUpdate(),false);
    stage.setFocused(true,{reducedMotion:true});assert.equal(stage.consumeShadowUpdate(),true,'focus tilts the actual gimbal');
    stage.setMedia(3);stage.update(5,1/60,true);assert.equal(stage.consumeShadowUpdate(),true,'the media pointer changes its shadow');
    stage.update(6,1/60,true);assert.equal(stage.consumeShadowUpdate(),false);
  }finally{stage.dispose();}
  assert.equal(stage.consumeShadowUpdate(),false);assert.equal(stage.shadowDirty,false);
});

test('media loading acknowledgement does not redraw shadows from unchanged geometry',async()=>{
  const stage=makeStage({loadMedia:async()=>new THREE.Texture({width:1200,height:800})});
  try{
    await new Promise(resolve=>setImmediate(resolve));stage.consumeShadowUpdate();
    stage.update(0,1/60);assert.ok(stage.motionState.pulse>0);assert.equal(stage.consumeShadowUpdate(),false);
  }finally{stage.dispose();}
});
