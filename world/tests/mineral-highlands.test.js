import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MATTE_SECTORS,curvedMountainSector,createMineralHighlands,mountainMatteFragment} from '../src/mineral-highlands.js';

test('mountain sectors cover all directions with overlap, world-space radius and submerged feet',()=>{
  for(let degree=0;degree<360;degree++){
    const covered=MATTE_SECTORS.filter(({angle,span})=>Math.abs(Math.atan2(Math.sin(degree*Math.PI/180-angle),Math.cos(degree*Math.PI/180-angle)))<span/2);
    assert.ok(covered.length>0,`Uncovered direction ${degree}`);
  }
  for(const sector of MATTE_SECTORS){
    assert.ok(Math.abs(sector.radius*sector.span/sector.height-2)<1e-8,'native painting aspect must not squash into a horizontal band');
    const geometry=curvedMountainSector(sector),p=geometry.attributes.position;
    const uv=geometry.attributes.uv,coast=[];
    for(let i=0;i<p.count;i++){
      const r=Math.hypot(p.getX(i),p.getZ(i)),v=uv.getY(i);
      assert.ok(r<=sector.radius+.001&&r>=sector.radius-150.001);
      assert.ok(Math.abs(p.getY(i)-(-105+v*sector.height))<.001);
      if(v>=.42)assert.ok(Math.abs(r-sector.radius)<.001,'skyline and upper painting must keep their native aspect');
      if(v===.125)coast.push(r);
    }
    assert.ok(Math.max(...coast)-Math.min(...coast)>25,'caped shoreline must have real depth variation');
    assert.ok(geometry.boundingSphere.radius<3600);geometry.dispose();
  }
});
test('optional art begins hidden, loaded art binds immediately; shared textures remain owned by loader',()=>{
  const root=new THREE.Group(),texture=new THREE.Texture();let textureDisposed=false;texture.addEventListener('dispose',()=>textureDisposed=true);
  const result=createMineralHighlands(root,{rockMap:texture,mountainMaps:{main:texture}});
  assert.equal(result.group.children.length,8);
  assert.equal(result.matteMaterials.length,8);
  for(const material of result.matteMaterials){
    assert.equal(material.uniforms.ready.value,material.userData.mountainArt==='main'?1:0);
    assert.equal(material.depthWrite,false);assert.ok(material.uniforms.hazeColor&&material.uniforms.lightDirection&&material.uniforms.nightFactor);
    material.dispose();
  }
  assert.equal(textureDisposed,false);
  result.group.traverse(object=>object.geometry?.dispose());result.materials.forEach(material=>material.dispose());texture.dispose();
});
test('black sky is rejected before grading and fog in both main and reflection draws',()=>{
  assert.ok(mountainMatteFragment.indexOf('if(key<.0008)discard')<mountainMatteFragment.indexOf('vec3 grade='));
  assert.ok(mountainMatteFragment.includes('silhouette*edge*baseFade'));
});
test('late optional delivery skips disposed backdrops and aborted consumers, and can retry',async()=>{
  const {resourceLoader}=await import('../src/resource-loader.js');
  const {createBackdrop,loadMountainArt}=await import('../src/landscape.js');
  const original=resourceLoader.load,deliveries=[],textures=[];
  resourceLoader.load=descriptor=>new Promise(resolve=>{const texture=new THREE.Texture();textures.push(texture);deliveries.push(()=>resolve(texture));assert.equal(descriptor.phase,2);});
  const dispose=result=>result.group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
  try{
    const first=createBackdrop(new THREE.Group());
    const request=loadMountainArt();dispose(first);deliveries.splice(0).forEach(deliver=>deliver());assert.equal(await request,true);
    assert.ok(first.matteMaterials.every(material=>material.uniforms.ready.value===0));
    const second=createBackdrop(new THREE.Group()),before=second.matteMaterials.map(material=>material.uniforms.mountainMap.value);
    const controller=new AbortController(),aborted=loadMountainArt({signal:controller.signal});controller.abort();deliveries.splice(0).forEach(deliver=>deliver());assert.equal(await aborted,false);
    assert.deepEqual(second.matteMaterials.map(material=>material.uniforms.mountainMap.value),before);
    const retry=loadMountainArt();deliveries.splice(0).forEach(deliver=>deliver());assert.equal(await retry,true);
    assert.ok(second.matteMaterials.every((material,i)=>material.uniforms.mountainMap.value!==before[i]));dispose(second);
  }finally{resourceLoader.load=original;textures.forEach(texture=>texture.dispose());}
});

 test('reflection grading uses world camera height and restores full direct-view detail each draw',()=>{
  const root=new THREE.Group(),result=createMineralHighlands(root),camera=new THREE.PerspectiveCamera(),rig=new THREE.Group();rig.add(camera);
  // Parent transforms matter; camera-local height alone can misclassify a pass.
  rig.position.y=-100;camera.position.y=84;rig.updateMatrixWorld(true);
  for(const mesh of result.group.children){mesh.onBeforeRender(null,null,camera);assert.equal(mesh.material.uniforms.reflectionMix.value,1);}
  camera.position.y=85;rig.updateMatrixWorld(true);
  for(const mesh of result.group.children){mesh.onBeforeRender(null,null,camera);assert.equal(mesh.material.uniforms.reflectionMix.value,0,'water boundary must not remain in reflection mode');}
  camera.position.y=225;rig.updateMatrixWorld(true);
  for(const mesh of result.group.children){mesh.onBeforeRender(null,null,camera);assert.equal(mesh.material.uniforms.reflectionMix.value,0);mesh.geometry.dispose();mesh.material.dispose();}
});
