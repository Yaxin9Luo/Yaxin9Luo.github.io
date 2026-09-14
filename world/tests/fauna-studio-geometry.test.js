import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSwallow,setSwallowPose,createPaperLantern,createFirefly,setFireflyFlight,disposeFaunaSpecimen} from '../src/sky-fauna.js';
import {specimenBounds,specimenMetrics,fitSpecimenCamera,placeLanternPair,swallowMotionBounds,fireflyMotionBounds} from '../src/fauna-studio-geometry.js';

test('active-pose bounds exclude unused morph targets and view-space light disks',()=>{
  const bird=createSwallow();setSwallowPose(bird,'glide');const glide=specimenBounds(bird);
  setSwallowPose(bird,'upstroke');const up=specimenBounds(bird);
  assert.ok(up.max.y>glide.max.y+.25);assert.ok(up.getSize(new THREE.Vector3()).x<glide.getSize(new THREE.Vector3()).x*.8);
  const insect=createFirefly(),bounds=specimenBounds(insect);assert.ok(bounds.getSize(new THREE.Vector3()).x<.05);
  disposeFaunaSpecimen(bird);disposeFaunaSpecimen(insect);
});

test('fitted complete specimens stay within an explicit margin at actual and narrow aspect ratios',()=>{
  for(const aspect of[1835/1440,.55,2.1])for(const factory of[createSwallow,createPaperLantern,createFirefly]){
    const asset=factory();for(const pose of['glide','upstroke','downstroke','bank']){
      if(asset.morphTargetInfluences)setSwallowPose(asset,pose);
      for(const view of['threequarter','front','side','back','above','below','close']){
        const camera=new THREE.PerspectiveCamera(36,aspect,.00001,100),box=specimenBounds(asset);fitSpecimenCamera(camera,box,view);
        const v=new THREE.Vector3();asset.traverse(o=>{if(!o.isMesh||o.userData.excludeFromGLB)return;for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld).project(camera);assert.ok(Math.abs(v.x)<=.91&&Math.abs(v.y)<=.91,`${asset.name} ${pose} ${view} aspect ${aspect}: ${v.toArray()}`);assert.ok(v.z>=-1&&v.z<=1);}});
      }
    }disposeFaunaSpecimen(asset);
  }
});

test('pair layout exposes both centers laterally while retaining projected overlap',()=>{
  const pair=new THREE.Group();pair.add(createPaperLantern(),createPaperLantern());placeLanternPair(pair);const camera=new THREE.PerspectiveCamera(36,1835/1440,.0001,100);fitSpecimenCamera(camera,specimenBounds(pair),'threequarter');
  const projected=pair.children.map(child=>{const box=specimenBounds(child),min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).project(camera);min.min(v);max.max(v);}return{min,max,center:box.getCenter(new THREE.Vector3()).project(camera)};});
  assert.ok(Math.abs(projected[1].center.x-projected[0].center.x)>.20,'two visible centers, not one depth-aligned envelope');assert.ok(projected[0].max.x>projected[1].min.x,'partial overlap remains');disposeFaunaSpecimen(pair);
});

test('asset statistics count actual geometry separately from shader aura planes',()=>{
  const insect=createFirefly(),m=specimenMetrics(insect);assert.ok(m.meshes>=20);assert.ok(m.triangles>10000);assert.equal(m.auraMeshes,1);assert.equal(m.auraTriangles,2);
  const bird=createSwallow(),b=specimenMetrics(bird);assert.equal(b.meshes,1);assert.equal(b.triangles,bird.geometry.attributes.position.count/3);assert.equal(b.morphTargets,2);disposeFaunaSpecimen(insect);disposeFaunaSpecimen(bird);
});

test('a fixed whole-cycle frame contains flap, glide and bank without moving the camera',()=>{
  const bird=createSwallow(),envelope=swallowMotionBounds(bird),camera=new THREE.PerspectiveCamera(36,1835/1440,.0001,100);fitSpecimenCamera(camera,envelope,'threequarter');const initial=camera.matrixWorld.clone();
  for(let frame=0;frame<=100;frame++){setSwallowPose(bird,'flight',frame*.1);const bounds=specimenBounds(bird);assert.ok(envelope.clone().expandByScalar(1e-7).containsBox(bounds),`whole-cycle envelope at ${frame*.1}`);}
  assert.deepEqual(camera.matrixWorld.elements,initial.elements);disposeFaunaSpecimen(bird);
});

test('the insect flight envelope contains the complete membrane and legs without a moving camera',()=>{
  const insect=createFirefly(),envelope=fireflyMotionBounds(insect),camera=new THREE.PerspectiveCamera(36,1835/1440,.0001,100);fitSpecimenCamera(camera,envelope,'threequarter','firefly');const initial=camera.matrixWorld.clone();
  for(let frame=0;frame<61;frame++){setFireflyFlight(insect,frame/241);assert.ok(envelope.containsBox(specimenBounds(insect)));}
  assert.deepEqual(camera.matrixWorld.elements,initial.elements);disposeFaunaSpecimen(insect);
});
