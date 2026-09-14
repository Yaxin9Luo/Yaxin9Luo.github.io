import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createXieqiquPoolWaterStudy,createPoolFlowGeometry,samplePoolSplash} from '../src/yuanmingyuan/xieqiqu-pool-water-study.js';
import {createFountainWater,fountainFlowGeometry,fountainRippleGeometry} from '../src/yuanmingyuan/yuanyingguan-geometry.js';

function fixture(){
  const group=new THREE.Group(),geometry=new THREE.PlaneGeometry(2,2),water=createFountainWater('pool-fixture'),{surface,flow}=water,normal=surface.normalMap,alpha=flow.alphaMap;
  const sheet=new THREE.Mesh(geometry,surface);sheet.renderOrder=1;group.add(sheet);const mounts=[],waterEndpoints=[],flowGeometries=[],ripples=[];
  // Reproduce AssetBuilder.add/flush: non-indexed, transformed parts are merged
  // per parent/material. Each flow owns one jet and one three-ring ripple mesh,
  // while the pool and all four ripple meshes borrow the same source material.
  const merged=(source,position,scale)=>{const part=source.toNonIndexed();source.dispose();part.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion(),new THREE.Vector3(...scale)));const result=mergeGeometries([part]);part.dispose();return result;};
  for(let i=0;i<4;i++){
    const mount=new THREE.Group();mount.name='fish-'+i;mount.position.set(i*2,.14,3);mount.rotation.y=i*.6;const size=i>1?.72:1;mount.scale.setScalar(size);
    const flowGroup=new THREE.Group();flowGroup.name=mount.name+'-water';mount.add(flowGroup);group.add(mount);
    const endpoint={id:mount.name+'-jet',start:[0,.96,1.25],end:[0,(.13-.14)/size,3.9]},flowGeometry=merged(fountainFlowGeometry([endpoint.start,[0,1.53,2.1],[0,1.02,3],endpoint.end],.027),[0,0,0],[1,1,1]);
    flowGeometries.push(flowGeometry);flowGroup.add(new THREE.Mesh(flowGeometry,flow));
    const ripple=new THREE.Mesh(merged(fountainRippleGeometry(),endpoint.end,[.027*12,1,.027*12]),surface);ripple.renderOrder=1;flowGroup.add(ripple);ripples.push(ripple);
    mounts.push({group:mount,flow:flowGroup,placement:{size}});waterEndpoints.push(endpoint);
  }
  group.updateMatrixWorld(true);const context={group,mounts,diagnostics:{waterEndpoints},disposed:false};
  return {context,sheet,geometry,flowGeometries,ripples,normal,alpha,surface,flow,textures:water.textures,dispose(){context.disposed=true;group.clear();for(const item of [geometry,...flowGeometries,...ripples.map(m=>m.geometry),...water.textures,surface,flow])item.dispose();}};
}

test('the real loft cap centres follow mouth and landing phases without altering source UV or shape',()=>{
  const start=[0,.96,1.25],end=[0,-.01,3.9],source=fountainFlowGeometry([start,[0,1.53,2.1],[0,1.02,3],end],.027),before=source.attributes.uv.array.slice(),view=createPoolFlowGeometry(source,{start,end});
  try{
    for(const name of ['position','normal','uv'])assert.deepEqual(view.attributes[name].array,source.attributes[name].array);assert.deepEqual(source.attributes.uv.array,before);assert.equal(source.attributes.poolStreamT,undefined);
    const point=new THREE.Vector3();let first=0,last=0;
    for(let i=0;i<view.attributes.position.count;i++){
      point.fromBufferAttribute(view.attributes.position,i);
      if(point.distanceToSquared(new THREE.Vector3(...start))<1e-12){assert.equal(source.attributes.uv.getY(i),.5);assert.equal(view.attributes.poolStreamT.getX(i),0);first++;}
      if(point.distanceToSquared(new THREE.Vector3(...end))<1e-12){assert.equal(source.attributes.uv.getY(i),.5);assert.equal(view.attributes.poolStreamT.getX(i),1);last++;}
    }
    assert(first>0&&last>0);
  }finally{view.dispose();source.dispose();}
});

test('droplets leave and return to the landing with finite ballistic positions at both fish sizes',()=>{
  for(let i=0;i<128;i++)for(const time of [-10,0,.04,.1,.3,1,1024]){
    const a=samplePoolSplash(i,time),b=samplePoolSplash(i,time,.72);
    assert(a.position.every(Number.isFinite));assert(a.position[1]>=.003-1e-12&&a.position[1]<.163);assert(Math.hypot(a.position[0],a.position[2])<.16);
    assert(a.radius>=0&&a.radius<=.012);assert(a.phase>=0&&a.phase<1);
    for(let axis=0;axis<3;axis++)assert(Math.abs(a.position[axis]-b.position[axis]*.72)<1e-12);assert(Math.abs(a.radius-b.radius*.72)<1e-12);
  }
  assert.throws(()=>samplePoolSplash(0,NaN));assert.throws(()=>samplePoolSplash(0,1,0));
});

test('water view preserves original geometry, transforms and maps and restores all bindings on release',()=>{
  const f=fixture(),before=f.geometry.attributes.position.array.slice(),matrices=f.context.mounts.map(m=>m.group.matrixWorld.toArray()),endpoints=JSON.stringify(f.context.diagnostics.waterEndpoints);
  const count=new Map();for(const resource of [f.geometry,...f.flowGeometries,...f.ripples.map(m=>m.geometry),...f.textures,f.surface,f.flow]){count.set(resource,0);resource.addEventListener('dispose',()=>count.set(resource,count.get(resource)+1));}
  const view=createXieqiquPoolWaterStudy({context:f.context});assert.notEqual(f.sheet.material,f.surface);assert.equal(f.sheet.material.normalMap,f.normal);
  const owned=new Set();f.context.group.traverse(mesh=>{if(!mesh.isMesh)return;if(mesh.isInstancedMesh)owned.add(mesh);if(!count.has(mesh.geometry))owned.add(mesh.geometry);if(![f.surface,f.flow].includes(mesh.material))owned.add(mesh.material);});
  const releases=new Map([...owned].map(resource=>[resource,0]));for(const resource of owned)resource.addEventListener('dispose',()=>releases.set(resource,releases.get(resource)+1));
  view.update(.07);const first=f.context.mounts[0].flow.children.find(m=>m.isInstancedMesh).instanceMatrix.array.slice();view.update(.12);
  assert.notDeepEqual(f.context.mounts[0].flow.children.find(m=>m.isInstancedMesh).instanceMatrix.array,first);
  for(let j=0;j<4;j++){
    const mount=f.context.mounts[j],mesh=mount.flow.children.find(m=>m.isInstancedMesh),end=new THREE.Vector3(...f.context.diagnostics.waterEndpoints[j].end).applyMatrix4(mount.flow.matrixWorld);
    assert(Math.abs(end.y-.13)<1e-12);for(let i=0;i<32;i++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);const point=new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(mount.flow.matrixWorld);assert(point.y>.13&&point.y<.30);assert(point.distanceTo(end)<.24);}
  }
  view.dispose();view.dispose();view.update(100);
  assert.equal(f.sheet.material,f.surface);for(let i=0;i<4;i++){const m=f.context.mounts[i];assert.equal(m.flow.children.length,2);assert.equal(m.flow.children[0].material,f.flow);assert.equal(m.flow.children[0].geometry,f.flowGeometries[i]);assert.equal(f.ripples[i].material,f.surface);}
  assert.deepEqual(f.geometry.attributes.position.array,before);assert.deepEqual(f.context.mounts.map(m=>m.group.matrixWorld.toArray()),matrices);assert.equal(JSON.stringify(f.context.diagnostics.waterEndpoints),endpoints);
  assert([...count.values()].every(n=>n===0));assert([...releases.values()].every(n=>n===1));f.dispose();
});

test('abort releases additions; malformed late mount rolls back previously rebound water',()=>{
  const f=fixture(),controller=new AbortController(),view=createXieqiquPoolWaterStudy({context:f.context,signal:controller.signal});controller.abort();assert(view.disposed);assert.equal(f.sheet.material,f.surface);assert(f.context.mounts.every(m=>m.flow.children.length===2));
  f.context.diagnostics.waterEndpoints.pop();assert.throws(()=>createXieqiquPoolWaterStudy({context:f.context}),/endpoint/);assert.equal(f.sheet.material,f.surface);assert(f.context.mounts.every(m=>m.flow.children.length===2));assert(f.ripples.every(m=>m.material===f.surface));for(let i=0;i<4;i++)assert.equal(f.context.mounts[i].flow.children[0].geometry,f.flowGeometries[i]);f.dispose();
});

test('disposed borrowed map invalidates visible water instead of sampling released resources',()=>{
  const f=fixture(),view=createXieqiquPoolWaterStudy({context:f.context});f.normal.dispose();assert(view.invalidated);assert.equal(f.sheet.visible,false);
  for(const mount of f.context.mounts)assert(mount.flow.children.every(mesh=>!mesh.visible));view.dispose();f.dispose();
});

test('merged landing ripples receive a thin fading view without changing the pool or any source buffers/maps',()=>{
  const f=fixture(),originals=f.ripples.map(mesh=>({mesh,geometry:mesh.geometry,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,a.array.slice()]))}));
  const pixels=f.textures.map(texture=>texture.image.data.slice()),surfaceValues={opacity:f.surface.opacity,thickness:f.surface.thickness,transmission:f.surface.transmission,color:f.surface.color.toArray(),normalScale:f.surface.normalScale.toArray()};
  const view=createXieqiquPoolWaterStudy({context:f.context});
  try{
    const material=f.ripples[0].material;assert.notEqual(material,f.sheet.material);assert(f.ripples.every(mesh=>mesh.material===material&&mesh.visible));
    assert.equal(material.userData.viewRole,'landing-ripple');assert.equal(f.sheet.material.userData.viewRole,'pool-surface');assert(material.transparent&&!material.depthWrite);
    assert(f.ripples.every(mesh=>mesh.renderOrder>f.sheet.renderOrder),'transparent landing crests must draw after their large basin plane at close viewpoints');
    assert(material.opacity>0&&material.opacity<1);assert(material.thickness>0&&material.thickness<.012);assert.equal(material.attenuationColor.getHex(),0xffffff);
    assert.equal(f.sheet.material.opacity,1);assert.equal(f.sheet.material.thickness,.52);assert.equal(f.sheet.material.transmission,.82);assert.equal(f.sheet.material.roughness,.115);
    for(const {mesh,geometry,attributes}of originals){assert.equal(mesh.geometry,geometry);for(const [name,bytes]of Object.entries(attributes))assert.deepEqual(geometry.attributes[name].array,bytes);}
    for(let i=0;i<f.textures.length;i++)assert.deepEqual(f.textures[i].image.data,pixels[i]);
    assert.deepEqual({opacity:f.surface.opacity,thickness:f.surface.thickness,transmission:f.surface.transmission,color:f.surface.color.toArray(),normalScale:f.surface.normalScale.toArray()},surfaceValues);
    assert.equal(view.diagnostics.landingRippleBindings,4);assert.equal(view.diagnostics.poolSurfaceBindings,1);assert.equal(view.diagnostics.dropCount,128);
  }finally{view.dispose();for(const {mesh,geometry}of originals){assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,f.surface);assert.equal(mesh.renderOrder,1);}f.dispose();}
});

test('r185 ripple and stream shader contracts remain separate and use the actual merged UV domain',()=>{
  const f=fixture(),view=createXieqiquPoolWaterStudy({context:f.context});
  const shader=()=>({uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader});
  try{
    const ripple=shader(),flow=shader(),pool=shader();f.ripples[0].material.onBeforeCompile(ripple);f.context.mounts[0].flow.children[0].material.onBeforeCompile(flow);f.sheet.material.onBeforeCompile(pool);
    assert(ripple.vertexShader.includes('vPoolRippleUV=uv;'));assert(!ripple.vertexShader.includes('poolStreamT'));
    assert(flow.vertexShader.includes('attribute float poolStreamT;'));assert(flow.vertexShader.includes('vPoolStreamUV=vec2(uv.x,poolStreamT);'));
    assert.equal(pool.vertexShader,THREE.ShaderLib.physical.vertexShader);assert.equal(pool.fragmentShader,THREE.ShaderLib.physical.fragmentShader);
    assert.equal(ripple.uniforms.poolRippleTime,flow.uniforms.poolFlowTime);for(const time of [0,.17,1.2]){view.update(time);assert.equal(ripple.uniforms.poolRippleTime.value,time);}
    assert.notEqual(f.ripples[0].material.customProgramCacheKey(),f.context.mounts[0].flow.children[0].material.customProgramCacheKey());
    for(let i=0;i<4;i++){
      const {position,uv}=f.ripples[i].geometry.attributes,end=f.context.diagnostics.waterEndpoints[i].end;
      for(let j=0;j<position.count;j++){
        assert(Math.abs(position.getX(j)-((uv.getX(j)-.5)*.324+end[0]))<1e-6);
        assert(Math.abs(position.getZ(j)-((uv.getY(j)-.5)*.324+end[2]))<1e-6);
      }
    }
    assert.deepEqual(view.diagnostics.resourceOwnership,{materialViews:3,materials:4,geometries:5,instancedMeshes:4,textures:0});
  }finally{view.dispose();f.dispose();}
});

test('the emitted ripple envelope keeps lit arcs, fades annular edges/outward and changes continuously',()=>{
  const f=fixture(),view=createXieqiquPoolWaterStudy({context:f.context});
  try{
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};f.ripples[0].material.onBeforeCompile(shader);
    // Evaluate only the scalar arithmetic emitted by this owned shader. This
    // avoids a second copied fade formula; it is not a GPU compilation test.
    const body=shader.fragmentShader.match(/float ringDistance[\s\S]*?diffuseColor\.a\*=[^;]+;/)?.[0];assert(body);
    const scalar=new Function('rippleR','rippleAngle','poolRippleTime','opacity','min','abs','sin','cos','mix','smoothstep',body.replace(/\bfloat\b/g,'const').replace('diffuseColor.a*=','return opacity*'));
    const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
    const sample=(r,a,t)=>scalar(r,a,t,f.ripples[0].material.opacity,Math.min,Math.abs,Math.sin,Math.cos,THREE.MathUtils.lerp,smooth),means=[];
    for(const radius of [.30,.64,1]){
      let total=0,peak=0,faint=1;
      for(let time=0;time<12;time+=.2)for(let j=0;j<64;j++){
        const angle=j/64*Math.PI*2,value=sample(radius,angle,time);assert(Number.isFinite(value)&&value>=0&&value<=f.ripples[0].material.opacity);total+=value;peak=Math.max(peak,value);faint=Math.min(faint,value);
        assert(Math.abs(sample(radius-.09,angle,time))<1e-10);assert(Math.abs(sample(radius+.09,angle,time))<1e-10);
        assert(Math.abs(sample(radius,angle,time+1e-5)-value)<1e-4);
      }
      assert(peak>.05,'each original annulus must retain a visible crest');assert(faint<peak*.25,'the entire circumference must not stay at one strong opacity');means.push(total);
      assert(Math.abs(sample(radius,-Math.PI,.71)-sample(radius,Math.PI,.71))<1e-12);
    }
    assert(means[1]<means[0]);assert(means[2]<means[1]);assert.notEqual(sample(.64,.8,.3),sample(.64,.8,.9));
  }finally{view.dispose();f.dispose();}
});

test('releasing a borrowed landing geometry invalidates the view without releasing the source again',()=>{
  const f=fixture(),geometry=f.ripples[0].geometry;let releases=0;geometry.addEventListener('dispose',()=>releases++);
  const view=createXieqiquPoolWaterStudy({context:f.context});
  try{geometry.dispose();assert(view.invalidated);assert(f.ripples.every(mesh=>!mesh.visible));view.dispose();view.dispose();assert.equal(releases,1);assert(f.ripples.every(mesh=>mesh.material===f.surface));}
  finally{view.dispose();f.dispose();}
});
