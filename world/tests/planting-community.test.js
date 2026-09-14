import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {plantingCommunityAt,flowerDrifts,blossomParks} from '../src/environment-layout.js';
import {landformAt} from '../src/landform-layout.js';
import {groundMaterial,cliffMaterial} from '../src/landscape.js';
import {createGroveTreeSource} from '../src/grove-foliage.js';

const field=(x,z)=>plantingCommunityAt(x,z,landformAt(x,z));
test('authored drift spines remain connected while clearings and dry shoulders read as different communities',()=>{
  for(const drift of flowerDrifts)for(let i=1;i<drift.points.length;i++)for(let t=0;t<=1;t+=.1){
    const a=drift.points[i-1],b=drift.points[i],p=field(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);assert.ok(p.flowers>.45,`${drift.kind} drift has a disconnected centre`);
  }
  assert.ok(field(-29,37).grass<field(-74,58).grass*.4,'open lawn is quieter than the grove edge');
  assert.ok(field(-70,57).ferns>field(-29,37).ferns*4,'ferns gather in tree shade');
  for(let x=-130;x<130;x+=7)for(let z=-115;z<130;z+=7){const p=field(x,z);assert.deepEqual(p,field(x,z));for(const [key,value]of Object.entries(p))if(key!=='kind')assert.ok(Number.isFinite(value)&&value>=0&&value<=1,key);}
});

test('root soil is localized and planting fields remain continuous across a material texel',()=>{
  for(const park of blossomParks)for(const [x,z]of park.trees){assert.ok(field(x,z).humus>.95);assert.ok(field(x+.01,z).humus>.95);}
  for(let x=-100;x<100;x+=9)for(let z=-90;z<100;z+=9)for(const key of['flowers','grass','ferns','humus','moisture','rock'])assert.ok(Math.abs(field(x,z)[key]-field(x+.01,z+.01)[key])<.05,key);
});

test('terrain and cliff shader paths share measured region data without dark baked-color multiplication',()=>{
  const compile=material=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;};
  const ground=groundMaterial(),blend=groundMaterial({transition:true}),cliff=cliffMaterial(),g=compile(ground),b=compile(blend),c=compile(cliff);
  assert.equal(g.uniforms.plantingMap.value,c.uniforms.plantingMap.value);assert.equal(b.uniforms.plantingMap.value,g.uniforms.plantingMap.value);
  assert.equal(g.uniforms.plantingMap.value.magFilter,THREE.LinearFilter);assert.match(b.vertexShader,/rootInterior=soilInterior/);
  const soilWeight=shader=>{
    const expression=shader.fragmentShader.match(/float humusWeight=([^;]+);/)?.[1];
    assert.ok(expression,'the generated material exposes its actual soil blend weight');
    // This scalar GLSL expression is also valid JavaScript; evaluate the generated formula, not a copy.
    return new Function('community','fineEdge','rootInterior','slope','clamp',`return (${expression});`);
  };
  const terrainWeight=soilWeight(g),transitionWeight=soilWeight(b),clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  for(const humus of[0,.3,.7,1])for(const fineEdge of[0,.5,1])for(const slope of[0,.5,1]){
    const community={g:humus},edge=transitionWeight(community,fineEdge,0,slope,clamp);
    assert.equal(edge,terrainWeight(community,fineEdge,0,slope,clamp),'ribbon margins match the underlying terrain');
    const middle=transitionWeight(community,fineEdge,.5,slope,clamp),interior=transitionWeight(community,fineEdge,1,slope,clamp);
    for(const weight of[edge,middle,interior])assert.ok(Number.isFinite(weight)&&weight>=0&&weight<=1,'soil contribution remains a finite blend weight');
    assert.ok(edge<=middle&&middle<=interior,'soil contribution grows toward the ribbon interior');
    if(humus===0)assert.ok(interior>edge,'rootInterior adds soil where the underlying terrain has none');
  }
  assert.match(THREE.ShaderChunk.color_pars_fragment,/varying vec4 vColor/,'pinned Three exposes vertex color as RGBA');
  assert.match(c.fragmentShader,/dot\(vColor\.rgb,vec3\(/,'RGB luminance must not pass a vec4 into the GPU dot product');
  assert.match(c.fragmentShader,/texture2D\(roughnessMap/);assert.match(c.fragmentShader,/cliffPosition.y/);assert.match(c.fragmentShader,/rockVertexLight/);assert.doesNotMatch(c.fragmentShader,/#include <color_fragment>/);
  for(const material of[ground,blend,cliff])material.dispose();
});

test('new cherry and lilac blossoms retain finite smooth surfaces and identical pieces across LODs',()=>{
  for(const [kind,seed]of[['cherry',881],['lilac',910]]){
    const near=createGroveTreeSource(kind,seed,'near'),far=createGroveTreeSource(kind,seed,'far');
    assert.deepEqual(near.userData.botanicalDetail,far.userData.botanicalDetail);
    assert.ok(near.userData.botanicalDetail.flowers>4500,'openings preserve a full, detailed crown');
    for(const tree of[near,far])for(const mesh of tree.children){
      for(const name of['position','normal','uv','color'])for(const value of mesh.geometry.attributes[name].array){assert.ok(Number.isFinite(value),`${kind} ${name}`);if(name==='color')assert.ok(value>=0&&value<=1,'physical pigment fits normalized glTF COLOR_0 without clipping');}
      const normals=mesh.geometry.attributes.normal;for(let i=0;i<normals.count;i+=137)assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<.002);
    }
    assert.ok(near.leavesMesh.customDepthMaterial&&near.leavesMesh.customDistanceMaterial);
    const bounds=new THREE.Box3().setFromObject(near);assert.ok(bounds.max.y<10&&bounds.min.y>-.25);
  }
});
