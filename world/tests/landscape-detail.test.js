import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import crypto from 'node:crypto';
import {createLake,createVegetation} from '../src/landscape.js';
import {bridges} from '../src/locations.js';

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

test('all plant batches clear the bridge plane while preserving every outside instance and flower colour',()=>{
  const root=new THREE.Group();createVegetation(root,()=>6,()=>false);
  const blocked=(x,z)=>Object.values(bridges).some(([a,b])=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,along=(x-a[0])*dx+(z-a[1])*dz,across=(x-a[0])*dz-(z-a[1])*dx;return along>-3&&along<length+3&&Math.abs(across)<4.5;});
  const matrix=new THREE.Matrix4(),entries=[];
  for(const mesh of root.children.filter(o=>o.isInstancedMesh)){
    const matrices=[];
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);assert.equal(blocked(matrix.elements[12],matrix.elements[14]),false,`${mesh.name} occupies the bridge`);
      matrices.push([...matrix.elements,...(mesh.instanceColor?Array.from(mesh.instanceColor.array.slice(i*3,i*3+3)):[])]);
    }
    entries.push([mesh.name,matrices]);
  }
  // Captured from the pre-fix seeded layout after excluding only the bridge
  // rectangles. This catches early filtering that changes later RNG draws.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex'),'54b3bbcdcc440db87e967d793b9190e3317d62d1ea4f966e6b1cde7a8b7e0fef');
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
