import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSurfaceSupport} from '../src/surface-support.js';
import {createBlossomGroves} from '../src/blossom-groves.js';

test('surface normals follow the selected triangle without differentiating a raised path edge',()=>{
  const base=(x,z)=>2+x*.1,support=createSurfaceSupport(base),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,2.085,0,2,2.285,0,0,2.085,2],3));support.addGeometry(geometry);
  const layered=createSurfaceSupport(support.heightAt);
  for(const [x,z]of [[.001,.5],[-.001,.5],[1.49,.5]]){
    const sample=layered.heightAt.surfaceAt(x,z),slope=Math.acos(sample.normal.y)*180/Math.PI;
    assert.ok(Math.abs(slope-Math.atan(.1)*180/Math.PI)<.001);
    assert.equal(sample.height,layered.heightAt(x,z));
  }
  const steep=new THREE.BufferGeometry();steep.setAttribute('position',new THREE.Float32BufferAttribute([0,3,0,2,5,0,0,3,2],3));layered.addGeometry(steep);
  assert.ok(Math.abs(Math.acos(layered.heightAt.surfaceAt(.2,.2).normal.y)*180/Math.PI-45)<.001,'real steep triangles retain their slope');
});

test('triangle support agrees with the visible interior, boundary, and overlapping surface',()=>{
  const support=createSurfaceSupport(()=>-10),g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-5,1,-1,6,4,2,1,2,8],3));support.addGeometry(g);
  for(const [u,v]of[[0,0],[1,0],[0,1],[.2,.3],[.7,.2],[.5,.5]])assert.ok(Math.abs(support.heightAt(-5+11*u+6*v,-1+3*u+9*v)-(1+3*u+v))<1e-6);
  assert.equal(support.heightAt(6,8),-10);assert.equal(support.heightAt(-5.01,-1),-10);
  const high=g.clone().translate(0,4,0);support.addGeometry(high);assert.ok(Math.abs(support.heightAt(-5+11*.2+6*.3,-1+3*.2+9*.3)-(5+3*.2+.3))<1e-6);
});

test('both blossom walks and overlooks expose their actual terrain-conforming triangles',()=>{
  const base=(x,z)=>6+Math.sin(x*.12)*.3+Math.cos(z*.11)*.25,root=new THREE.Group();
  const groves=createBlossomGroves(root,base,{trees:false});
  root.updateMatrixWorld(true);const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let samples=0;
  for(const mesh of groves.group.children.filter(o=>/stone walk|circular overlook/.test(o.name))){
    let visibleHits=0;
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<(index?.count||p.count);i+=Math.max(3,Math.floor((index?.count||p.count)/90/3)*3)){
      const ids=[0,1,2].map(n=>index?index.getX(i+n):i+n),x=ids.reduce((v,j)=>v+p.getX(j),0)/3,z=ids.reduce((v,j)=>v+p.getZ(j),0)/3;
      ray.set(new THREE.Vector3(x,30,z),down);const hit=ray.intersectObjects(groves.group.children.filter(o=>/stone walk|circular overlook/.test(o.name)),false)[0];
      if(hit){assert.ok(Math.abs(groves.heightAt(x,z)-Math.max(base(x,z),hit.point.y))<1e-5,mesh.name);samples++;visibleHits++;}
    }
    assert.ok(visibleHits>40,`${mesh.name} must face upward and remain visible`);
  }
  assert.ok(samples>100);
});
