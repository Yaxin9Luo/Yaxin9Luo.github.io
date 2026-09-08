import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLake,createVegetation} from '../src/landscape.js';

test('dense ground cover remains attached to land and keeps a walking corridor clear',()=>{
  const root=new THREE.Group(),heightAt=(x,z)=>z<0?-22:6+Math.sin(x*.03),nearPath=x=>Math.abs(x)<5;
  const detail=createVegetation(root,heightAt,nearPath);
  assert.ok(detail.grassCount>100,'the corridor check must exercise a populated meadow');
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3();
  for(const mesh of root.children.filter(o=>o.isInstancedMesh)){
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
      assert.ok(position.z>=0,`${mesh.name} must not appear over the lake`);
      assert.ok(!nearPath(position.x,position.z),`${mesh.name} blocks the reserved path`);
      assert.ok(Math.abs(position.y-heightAt(position.x,position.z))<.5,`${mesh.name} floats above its planting surface`);
    }
  }
});

test('lake normals are filtered continuously rather than producing square specular cells',()=>{
  const root=new THREE.Group(),scene=new THREE.Scene();
  const {water}=createLake(root,scene),texture=water.material.uniforms.normalSampler.value;
  assert.equal(texture.magFilter,THREE.LinearFilter);
  assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);
  assert.equal(texture.generateMipmaps,true);
  const reflection=water.material.uniforms.mirrorSampler.value;
  assert.equal(reflection.minFilter,THREE.LinearMipmapLinearFilter);
  assert.equal(reflection.generateMipmaps,true);
  assert.ok(reflection.image.width>=2048&&reflection.image.height>=2048,'reflected stars must not be enlarged from a small offscreen image');
  const {data,width,height}=texture.image;
  let largestStep=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const at=(y*width+x)*4;
    for(const channel of[0,1])largestStep=Math.max(largestStep,Math.abs(data[at+channel]-data[at+4+channel]));
    assert.ok(data[at+2]>240,'wave normals should remain shallow and finite');
  }
  assert.ok(largestStep<10,'adjacent texels should describe continuous waves');
});
