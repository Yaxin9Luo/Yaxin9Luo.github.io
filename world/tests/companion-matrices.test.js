import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import * as THREE from 'three';
import {resourceLoader} from '../src/resource-loader.js';
import {loadCompanionAssets,createCompanionActor} from '../src/companion-assets.js';
import {companionManifest} from '../src/companion-manifest.js';
import {createCompanionSystem} from '../src/companion-system.js';

// Small real Three skeletons exercise actor math without decoding the accepted
// GLBs. They do not certify authored animation/geometry or browser appearance.
function fixture(asset){
  const scene=new THREE.Group(),root=new THREE.Bone();root.name='Root';scene.add(root);
  const bones=asset.soles.map((foot,index)=>{
    const bone=new THREE.Bone();bone.name=foot.bone;bone.position.set(index%2? .3:-.3,foot.clearance,index<2?.4:-.4);
    const sole=new THREE.Object3D();sole.name=foot.name;bone.add(sole);root.add(bone);return bone;
  });
  scene.updateMatrixWorld(true);const skeleton=new THREE.Skeleton([root,...bones]);
  for(const [index,bone] of bones.entries()){
    const geometry=new THREE.BoxGeometry(.16,.08,.22).translate(bone.position.x,bone.position.y+.04,bone.position.z);
    const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){indices[i*4]=index+1;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());mesh.name=`FootMesh${index}`;scene.add(mesh);mesh.bind(skeleton);
  }
  if(asset.sign){const face=new THREE.Mesh(new THREE.PlaneGeometry(.2,.1),new THREE.MeshBasicMaterial());face.name=asset.sign.face;scene.add(face);}
  const animations=asset.actions.map(name=>new THREE.AnimationClip(name,asset.durations[name],bones.map((bone,index)=>
    new THREE.NumberKeyframeTrack(`${bone.name}.position[y]`,[0,asset.durations[name]/2,asset.durations[name]],
      [asset.soles[index].clearance,asset.soles[index].clearance+(name==='walk'?.05:0),asset.soles[index].clearance]))));
  return {scene,animations};
}

before(async()=>{
  const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('synthetic companion');
  try{
    for(const [kind,asset] of Object.entries(companionManifest))await resourceLoader.load(
      {id:`companion:${kind}:${asset.sha256.slice(0,12)}`,url:asset.url,phase:3},{parse:()=>fixture(asset)});
    await loadCompanionAssets();
  }finally{globalThis.fetch=nativeFetch;}
});

function withCanvas(create){
  const previous=globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas=class {
    constructor(width,height){this.width=width;this.height=height;}
    getContext(){return {fillRect(){},fillText(){},measureText:text=>({width:text.length*90})};}
  };
  try{return create();}finally{if(previous===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=previous;}
}
const create=kind=>withCanvas(()=>createCompanionActor(kind));
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-6,`${message}: ${actual} vs ${expected}`);

test('supported updates refresh skeletons once before and once after corrections, with no repeated foot lookup',()=>{
  for(const [kind,planted] of [['elizabeth',['SoleL']],['sadaharu',['FrontSoleL','FrontSoleR','HindSoleL']]]){
    const actor=create(kind),parent=new THREE.Group();parent.position.set(7,1,-4);parent.rotation.y=.6;parent.add(actor.group);
    actor.group.position.set(.3,.2,-.7);actor.group.rotation.y=.4;actor.setAction('walk');actor.seek(.13);
    const skeletons=new Set();actor.model.traverse(mesh=>{if(mesh.skeleton)skeletons.add(mesh.skeleton);});
    let updates=0,lookups=0,groupUpdates=0;
    for(const skeleton of skeletons){const update=skeleton.update.bind(skeleton);skeleton.update=()=>{updates++;update();};}
    const updateGroup=actor.group.updateMatrixWorld.bind(actor.group),lookup=actor.model.getObjectByName.bind(actor.model);
    actor.group.updateMatrixWorld=(...args)=>{groupUpdates++;return updateGroup(...args);};
    actor.model.getObjectByName=(...args)=>{lookups++;return lookup(...args);};
    const contacted=[];
    try{
      actor.update(.025,{speed:actor.asset.walk.stride/actor.asset.walk.duration,getSupportHeight:state=>{
        contacted.push(state.name);return state.position.y+.023-actor.asset.soles.find(foot=>foot.name===state.name).clearance;
      }});
      assert.equal(updates,2*skeletons.size,'support needs one pre-correction and one post-correction skeleton refresh');
      assert.equal(groupUpdates,2,'the unchanged pre-support traversal must not run twice');
      assert.equal(lookups,0,'sole/bone identities are stable within the cloned actor');
      assert.deepEqual(contacted,planted);close(actor.time,.155,'clip clock');
      for(const foot of actor.footStates.values()){
        close(foot.correction,planted.includes(foot.name)?.023:0,'stance correction');
        const position=lookup(foot.name).getWorldPosition(new THREE.Vector3());close(position.y,foot.position.y+foot.correction,'corrected sole height');
      }
      const sole=lookup(actor.asset.soles[0].name).getWorldPosition(new THREE.Vector3()),mesh=lookup('FootMesh0');
      assert.equal(mesh.boundingSphere,null);assert.equal(mesh.boundingBox,null);
      const hits=new THREE.Raycaster(sole.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
      assert.ok(hits.length,'pre-render picking follows the moved, rotated, supported skeleton');close(hits[0].point.y,sole.y+.08,'picked foot top');
      updates=0;groupUpdates=0;actor.update(.2,{paused:true,getSupportHeight:()=>0});
      assert.equal(updates,0);assert.equal(groupUpdates,0);close(actor.time,.155,'paused clock');
      actor.update(0);assert.equal(updates,skeletons.size);assert.equal(groupUpdates,1);assert.equal(actor.footStates.size,0);
      assert.equal(mesh.boundingSphere,null,'removing support still invalidates exact pick bounds');
    }finally{actor.dispose();}
  }
});

test('support removal restores independent clones and keeps walk crossfade contact ownership',()=>{
  const actor=create('sadaharu'),other=create('sadaharu'),getSupportHeight=()=>.03;
  const positions=value=>value.asset.soles.map(foot=>value.model.getObjectByName(foot.name).getWorldPosition(new THREE.Vector3()).toArray());
  try{
    actor.update(0,{getSupportHeight});const first=positions(actor);
    actor.update(0,{getSupportHeight});assert.deepEqual(positions(actor),first,'support never accumulates');
    assert.notDeepEqual(first,positions(other),'cached feet belong to this actor clone');
    actor.update(0);assert.deepEqual(positions(actor),positions(other),'removing support restores the authored pose');
    actor.update(0,{getSupportHeight:()=>NaN});assert.deepEqual(positions(actor),positions(other));
    actor.setAction('walk');actor.seek(.83);actor.update(0,{getSupportHeight});
    assert.equal(actor.footStates.get('HindSoleL').planted,false);
    actor.setAction('idle');actor.update(0,{getSupportHeight});
    assert.equal(actor.footStates.get('HindSoleL').planted,false);assert.equal(actor.footStates.get('HindSoleL').correction,0);
    actor.update(.1,{getSupportHeight});assert.ok([...actor.footStates.values()].every(foot=>foot.planted));
    actor.setAction('walk');actor.update(.2,{reducedMotion:true,getSupportHeight});const reduced=positions(actor);
    actor.update(1,{reducedMotion:true,getSupportHeight});assert.deepEqual(positions(actor),reduced);assert.equal(actor.time,0);assert.equal(actor.clip,'idle');
  }finally{actor.dispose();other.dispose();}
});

test('the real controller preserves gait-contact foley timestamps across frame dispatch sizes',()=>{
  const results=[];
  for(const fps of [30,60]){
    const events=[],system=withCanvas(()=>createCompanionSystem({root:new THREE.Group(),heightAt:()=>1,seed:93,
      placements:[{kind:'sadaharu',position:{x:0,z:0},heading:0,routeOrder:'loop',waypoints:[{x:0,z:7}]}],
      onSound:({owner,...event})=>events.push(event)}));
    try{
      for(let i=0;i<6*fps;i++)system.update(1/fps);
      const {owner,...snapshot}=system.snapshot();results.push({snapshot,events});
      assert.ok(events.length>3,'walking produces real contact events');assert.ok(events.every(event=>event.kind==='dog-step'));
      assert.ok(events.every(event=>Math.abs(event.position.y-1.018)<1e-6),'foley originates on the corrected sole');
    }finally{system.dispose();}
  }
  assert.deepEqual(results[0],results[1]);
});
