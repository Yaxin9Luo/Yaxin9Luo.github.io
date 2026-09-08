import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cliffPlanarUV,createTerrainSpecimen} from '../src/world.js';

function checkFaceProjection(geometry,scale){
  const index=geometry.index,p=geometry.attributes.position,uv=geometry.attributes.uv,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    const sameAxis=[[0,1],[0,2],[2,1]].some(([u,v])=>ids.every(id=>Math.abs(uv.getX(id)-p.getComponent(id,u)*scale)<5e-6&&Math.abs(uv.getY(id)-p.getComponent(id,v)*scale)<5e-6));
    assert.ok(sameAxis,`triangle ${i/3} mixes projection axes`);
    for(let edge=0;edge<3;edge++){
      const from=ids[edge],to=ids[(edge+1)%3];a.fromBufferAttribute(p,from);b.fromBufferAttribute(p,to);
      const uvLength=Math.hypot(uv.getX(from)-uv.getX(to),uv.getY(from)-uv.getY(to));
      assert.ok(uvLength<=a.distanceTo(b)*scale+6e-6,`triangle ${i/3} stretches UV across unrelated world axes`);
    }
    a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
    const area=b.sub(a).cross(c.sub(a)).length(),uvArea=Math.abs((uv.getX(ids[1])-uv.getX(ids[0]))*(uv.getY(ids[2])-uv.getY(ids[0]))-(uv.getY(ids[1])-uv.getY(ids[0]))*(uv.getX(ids[2])-uv.getX(ids[0])));
    if(area>1e-4)assert.ok(uvArea>=area*scale*scale/Math.sqrt(3)-2e-5,'dominant-face projection retains physical texture scale');
  }
}

test('cliff UV seams retain every triangle in order and copy smooth normals without flattening them',()=>{
  const source=new THREE.BufferGeometry();
  source.setAttribute('position',new THREE.Float32BufferAttribute([30,0,30,30,2,30,31,0,30,30,0,31],3));
  source.setIndex([0,2,1,0,1,3]);source.computeVertexNormals();
  const result=cliffPlanarUV(source,.22);
  assert.equal(result.index.count,source.index.count);
  assert.ok(result.attributes.position.count>source.attributes.position.count,'shared vertices split where adjacent faces need different axes');
  for(let corner=0;corner<source.index.count;corner++)for(const name of['position','normal']){
    const a=source.attributes[name],b=result.attributes[name],before=source.index.getX(corner),after=result.index.getX(corner);
    for(let component=0;component<3;component++)assert.equal(a.getComponent(before,component),b.getComponent(after,component),`${name} changed at source triangle corner ${corner}`);
  }
  checkFaceProjection(result,.22);
});

test('every actual coast triangle has one bounded physical projection',()=>{
  const terrain=createTerrainSpecimen(),cliffs=terrain.children[1].geometry;
  assert.equal(cliffs.index.count%192,0,'the 32-band segment index layout remains intact');
  assert.ok(cliffs.index.count>100_000,'the complete coast is inspected');
  checkFaceProjection(cliffs,.22);
  for(const mesh of terrain.children){mesh.geometry.dispose();mesh.material.dispose();}
});
