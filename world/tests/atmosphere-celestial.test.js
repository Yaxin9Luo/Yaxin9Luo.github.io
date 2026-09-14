import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAtmosphere} from '../src/atmosphere.js';
import {sampleEnvironment} from '../src/environment-time.js';

test('each pass uses the active parented camera for celestial angular position and halo orientation without advancing activity',()=>{
  const scene=new THREE.Scene(),atmosphere=createAtmosphere(scene,{lanternCount:0,fireflyCount:0,birdCount:0});
  const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.position.set(20,4,-19);rig.rotation.set(.06,.8,0);rig.add(camera);scene.add(rig);
  atmosphere.root.position.set(6,12,-8);atmosphere.root.rotation.y=.17;
  const environment=sampleEnvironment(.735,{lightingVariant:'solar-120-stable'});atmosphere.setEnvironment(environment);atmosphere.update(500,.2,false,{started:true});
  const before=atmosphere.activityTime,sky=atmosphere.root.getObjectByName('Authored day and night cloud sky'),skyTime=sky.material.uniforms.skyTime.value;
  const rows=[['LROC detailed full moon',environment.moonDirection,760],['Soft lunar corona',environment.moonDirection,760*.994],['Moving sun',environment.sunDirection,780],['Soft sunlight',environment.sunDirection,780*.994]];
  try{
    // Alternate reflected/high/main positions; the last pass cannot seed the next.
    for(const point of [[140,-205,195],[-91,9,66],[140,175,195],[-91,9,66]]){
      camera.position.fromArray(point);camera.rotation.set(.2,.3,.04);scene.updateMatrixWorld(true);
      const eye=camera.getWorldPosition(new THREE.Vector3()),viewRotation=camera.getWorldQuaternion(new THREE.Quaternion());
      for(const [name,direction,distance]of rows){
        const object=atmosphere.root.getObjectByName(name);object.onBeforeRender(null,scene,camera);
        const offset=object.getWorldPosition(new THREE.Vector3()).sub(eye);
        assert.ok(Math.abs(offset.length()-distance)<1e-8);assert.ok(offset.normalize().distanceTo(direction)<1e-10);
        if(name.startsWith('Soft'))assert.ok(object.getWorldQuaternion(new THREE.Quaternion()).angleTo(viewRotation)<1e-7);
      }
      for(const name of ['Authored day and night cloud sky','Sparse silver stars']){
        const object=atmosphere.root.getObjectByName(name);object.onBeforeRender(null,scene,camera);assert.ok(object.getWorldPosition(new THREE.Vector3()).distanceTo(eye)<1e-8);
      }
      assert.equal(atmosphere.activityTime,before);assert.equal(sky.material.uniforms.skyTime.value,skyTime);
    }
  }finally{atmosphere.dispose();}
});
