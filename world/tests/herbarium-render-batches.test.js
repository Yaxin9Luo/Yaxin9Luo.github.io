import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import * as THREE from 'three';
import {installHerbariumRenderBatches,isHerbariumRenderSource} from '../src/herbarium-render-batches.js';

function fixture(positions=[[.2,0,.2],[1.2,0,.3]]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.4,0,-.2,.5,.2,-.3,0,1,.4,.1,.3,-.5],3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute([.6,.8,0,.6,.8,0,.6,.8,0,.6,.8,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1,.8,.4],2));
  geometry.setAttribute('color',new THREE.Uint8BufferAttribute([210,255,190,255,190,220,160,255,240,250,180,200,160,210,140,255],4,true));
  geometry.setIndex([0,1,2,1,3,2]);
  const map=new THREE.DataTexture(new Uint8Array([140,200,100,255]),1,1);
  const material=new THREE.MeshStandardMaterial({map,normalMap:map,roughnessMap:map,alphaTest:.5,alphaToCoverage:true,side:THREE.DoubleSide,vertexColors:true,color:'#bddeac'});
  const root=new THREE.Group(),sources=positions.map((p,i)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Source specimen ${i}`;mesh.position.fromArray(p);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={canonical:i===0,root:p.slice(),source:'complete specimen'};root.add(mesh);return mesh;
  });
  return {root,sources,geometry,material,map};
}

const closeVector=(actual,expected,message)=>assert.ok(actual.distanceTo(expected)<2e-5,`${message}: ${actual.toArray()} / ${expected.toArray()}`);

test('runtime batches retain every source vertex, normal, color and resource under nested world transforms',()=>{
  const {root,sources,geometry,material,map}=fixture([[.2,0,.2],[1.2,0,.3],[12.2,0,.2],[13.2,0,.3]]);
  const scene=new THREE.Scene();scene.position.set(7,2,-11);scene.rotation.y=.31;scene.scale.set(1.2,.8,1.2);scene.add(root);
  const branch=new THREE.Group();branch.position.set(.2,.35,.1);branch.rotation.y=-.12;root.add(branch);for(const mesh of sources)branch.add(mesh);
  for(const [i,mesh]of sources.entries()){mesh.rotation.set(.09*i,.17*i,.04*i);mesh.scale.set(.8+i*.1,1.3,1.1);}
  scene.updateMatrixWorld(true);
  const before=sources.map(mesh=>({mesh,matrix:mesh.matrixWorld.clone(),parent:mesh.parent,data:structuredClone(mesh.userData)})),attributes={...geometry.attributes},index=geometry.index;
  const handle=installHerbariumRenderBatches(root);
  assert.equal(handle.batches.length,2);assert.equal(handle.metrics.batchedMeshCount,4);assert.equal(handle.metrics.savedDrawsPerPass,2);assert.equal(handle.metrics.trianglesPreserved,8);
  assert.equal(handle.metrics.instanceMatrixBytes,256);
  const seen=[];scene.updateMatrixWorld(true);
  for(const batch of handle.batches){
    assert.equal(batch.geometry,geometry);assert.equal(batch.material,material);assert.equal(batch.material.map,map);assert.equal(batch.instanceColor,null);
    assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);assert.equal(batch.material.alphaToCoverage,true);
    const modelNormal=new THREE.Matrix3().getNormalMatrix(batch.matrixWorld),instance=new THREE.Matrix4();
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,instance);const source=before.find(item=>item.mesh.uuid===batch.userData.herbariumRenderBatch.sourceUUIDs[i]);assert.ok(source);seen.push(source.mesh.uuid);
      const normalMatrix=new THREE.Matrix3().getNormalMatrix(source.matrix),im=new THREE.Matrix3().setFromMatrix4(instance),e=im.elements;
      for(let vertex=0;vertex<geometry.attributes.position.count;vertex++){
        const point=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,vertex),local=point.clone().applyMatrix4(instance),world=local.clone().applyMatrix4(batch.matrixWorld);
        closeVector(world,point.clone().applyMatrix4(source.matrix),'complete transformed source vertex');
        assert.ok(batch.boundingBox.containsPoint(local));assert.ok(batch.boundingSphere.containsPoint(local));
        const normal=new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal,vertex),expected=normal.clone().applyMatrix3(normalMatrix).normalize();
        // Installed Three's defaultnormal_vertex uses these column-length divisors.
        normal.divide(new THREE.Vector3(e[0]**2+e[1]**2+e[2]**2,e[3]**2+e[4]**2+e[5]**2,e[6]**2+e[7]**2+e[8]**2)).applyMatrix3(im).applyMatrix3(modelNormal).normalize();
        closeVector(normal,expected,'instanced shader normal');
      }
    }
  }
  assert.deepEqual(seen.sort(),sources.map(mesh=>mesh.uuid).sort());assert.equal(geometry.index,index);assert.deepEqual(geometry.attributes,attributes);
  assert.equal(geometry.boundingBox,null,'render bounds must not mutate borrowed geometry');assert.equal(geometry.boundingSphere,null);
  for(const item of before){assert.equal(item.mesh.parent,item.parent);assert.equal(item.mesh.visible,false);assert.deepEqual(item.mesh.userData,item.data);}
  handle.dispose();for(const item of before)assert.equal(item.mesh.visible,true);
});

test('strict resource and render semantics separate otherwise identical neighbouring meshes',()=>{
  const changes={
    geometry:m=>{m.geometry=m.geometry.clone();},material:m=>{m.material=m.material.clone();},
    layers:m=>m.layers.set(2),renderOrder:m=>{m.renderOrder=2;},castShadow:m=>{m.castShadow=false;},receiveShadow:m=>{m.receiveShadow=false;},frustumCulled:m=>{m.frustumCulled=false;},
    depth:m=>{m.customDepthMaterial=new THREE.MeshDepthMaterial();},distance:m=>{m.customDistanceMaterial=new THREE.MeshDistanceMaterial();},
  };
  for(const [name,change]of Object.entries(changes)){
    const {root,sources}=fixture();change(sources[1]);const handle=installHerbariumRenderBatches(root);
    assert.equal(handle.batches.length,0,name);assert.ok(sources.every(m=>m.visible),name);handle.dispose();
  }
  const {root,sources}=fixture([[.2,0,.2],[.7,0,.3],[1.2,0,.2],[1.7,0,.3]]);
  for(const [i,order]of [3,8].entries()){const parent=new THREE.Group();parent.renderOrder=order;root.add(parent);parent.add(...sources.slice(i*2,i*2+2));}
  const handle=installHerbariumRenderBatches(root);assert.equal(handle.batches.length,2);assert.deepEqual(handle.batches.map(m=>m.parent.renderOrder),[3,8]);handle.dispose();
});

test('single, hidden, blended, animated, callback-driven and unsupported transforms remain original',()=>{
  const changes={
    transparent:({material})=>{material.transparent=true;},blended:({material})=>{material.blending=THREE.AdditiveBlending;},depthDisabled:({material})=>{material.depthWrite=false;},
    transmission:({sources,material})=>{for(const m of sources)m.material=new THREE.MeshPhysicalMaterial({...material,transmission:.7});},
    wind:({material})=>{material.userData.environmentWind={amplitude:.1};},shader:({material})=>{material.onBeforeCompile=()=>{};},materialCallback:({material})=>{material.onBeforeRender=()=>{};},
    callback:({sources})=>{for(const m of sources)m.onBeforeRender=()=>{};},shadowCallback:({sources})=>{for(const m of sources)m.onBeforeShadow=()=>{};},
    animation:({root})=>{root.animations.push(new THREE.AnimationClip('Moving plants',1,[]));},morph:({geometry})=>{geometry.morphAttributes.position=[geometry.attributes.position.clone()];},
    dynamic:({geometry})=>{geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);},
    negative:({sources})=>{for(const m of sources)m.scale.x=-1;},zero:({sources})=>{for(const m of sources)m.scale.x=0;},
    shear:({sources})=>{for(const m of sources){m.matrixAutoUpdate=false;m.matrix.makeShear(.2,0,0,0,0,0);}},
    children:({sources})=>{for(const m of sources)m.add(new THREE.Group());},hidden:({root})=>{root.visible=false;},
  };
  for(const [name,change]of Object.entries(changes)){
    const f=fixture();change(f);const handle=installHerbariumRenderBatches(f.root);
    assert.equal(handle.batches.length,0,name);assert.ok(f.sources.every(m=>m.visible),name);handle.dispose();
  }
  const {root,sources}=fixture();sources[0].visible=false;const handle=installHerbariumRenderBatches(root);assert.equal(handle.batches.length,0);handle.dispose();assert.equal(sources[0].visible,false);assert.equal(sources[1].visible,true);
});

test('accepted static Didelta fragment and shadow hooks are borrowed intact',()=>{
  const {root,sources,material,map}=fixture();material.userData.sourceAsset='didelta_spinosa';material.onBeforeCompile=shader=>{shader.fragmentShader+='\n// static thin-leaf response';};material.customProgramCacheKey=()=> 'didelta-original-thin-leaf-scalar-v2';
  const depth=new THREE.MeshDepthMaterial({map,alphaMap:map,alphaTest:.5}),distance=new THREE.MeshDistanceMaterial({map,alphaMap:map,alphaTest:.5});
  for(const shadow of [depth,distance]){shadow.userData.sourceAsset='didelta_spinosa';shadow.onBeforeCompile=shader=>{shader.fragmentShader+='\n// scalar red-channel alpha';};shadow.customProgramCacheKey=()=> 'didelta-scalar-alpha-shadow-v1';}
  for(const mesh of sources){mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;mesh.layers.set(3);mesh.renderOrder=7;}
  const handle=installHerbariumRenderBatches(root),[batch]=handle.batches;assert.ok(batch);assert.equal(batch.material,material);assert.equal(batch.customDepthMaterial,depth);assert.equal(batch.customDistanceMaterial,distance);assert.equal(batch.layers.mask,8);assert.equal(batch.renderOrder,7);assert.equal(batch.material.onBeforeCompile,material.onBeforeCompile);assert.equal(batch.customDepthMaterial.alphaMap,map);handle.dispose();
});

test('independent camera frusta retain all geometry in their own static cells',()=>{
  const {root}=fixture([[.2,0,.2],[.4,0,.3],[.2,8,-17.8],[.4,8,-17.7],[.2,0,-95.8],[.4,0,-95.7]]),handle=installHerbariumRenderBatches(root);root.updateMatrixWorld(true);assert.equal(handle.batches.length,3);
  const frustum=(eye,target)=>{const camera=new THREE.PerspectiveCamera(35,1,.05,50);camera.position.fromArray(eye);camera.lookAt(...target);camera.updateMatrixWorld(true);return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));};
  const count=view=>handle.batches.filter(mesh=>view.intersectsObject(mesh)).reduce((sum,mesh)=>sum+mesh.count,0);
  assert.equal(count(frustum([0,2,8],[0,1,0])),2);assert.equal(count(frustum([0,-2,8],[0,-1,0])),4);assert.equal(count(frustum([0,8,-87],[0,0,-96])),2);
  assert.ok(handle.batches.every(mesh=>mesh.visible&&mesh.castShadow));handle.dispose();
});

test('enable, abort and restore are idempotent and keep other owners and shared resources alive',()=>{
  const a=fixture(),b=fixture(),controller=new AbortController();for(const m of b.sources){m.geometry=a.geometry;m.material=a.material;}
  let geometryDisposals=0,materialDisposals=0,mapDisposals=0,batchDisposals=0;
  a.geometry.addEventListener('dispose',()=>geometryDisposals++);a.material.addEventListener('dispose',()=>materialDisposals++);a.map.addEventListener('dispose',()=>mapDisposals++);
  const first=installHerbariumRenderBatches(a.root,{signal:controller.signal}),other=installHerbariumRenderBatches(b.root);
  assert.equal(installHerbariumRenderBatches(a.root),first);for(const mesh of first.batches)mesh.addEventListener('dispose',()=>batchDisposals++);
  assert.equal(getEventListeners(controller.signal,'abort').length,1);controller.abort();assert.ok(a.sources.every(m=>m.visible));assert.ok(b.sources.every(m=>!m.visible));assert.equal(first.metrics.active,false);assert.equal(other.metrics.active,true);assert.equal(getEventListeners(controller.signal,'abort').length,0);
  first.dispose();assert.equal(batchDisposals,1);other.dispose();assert.ok(b.sources.every(m=>m.visible));assert.equal(geometryDisposals+materialDisposals+mapDisposals,0);
  assert.throws(()=>installHerbariumRenderBatches(a.root,{signal:controller.signal}),{name:'AbortError'});
  for(let i=0;i<3;i++){const signal=new AbortController().signal,handle=installHerbariumRenderBatches(a.root,{signal});assert.notEqual(handle,first);handle.dispose();handle.dispose();assert.equal(getEventListeners(signal,'abort').length,0);assert.deepEqual(a.root.children,a.sources);}
});

test('installation failure and cancellation roll back source visibility and release every private batch',()=>{
  for(const abort of [false,true]){
    const {root,sources,geometry,material}=fixture(),controller=new AbortController();let batchDisposals=0,sharedDisposals=0;
    geometry.addEventListener('dispose',()=>sharedDisposals++);material.addEventListener('dispose',()=>sharedDisposals++);
    const fail=event=>{event.child.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.addEventListener('dispose',()=>batchDisposals++);});if(abort)controller.abort();else throw new Error('Fixture attachment failure');};
    root.addEventListener('childadded',fail);
    assert.throws(()=>installHerbariumRenderBatches(root,{signal:controller.signal}),abort?{name:'AbortError'}:/Fixture attachment failure/);
    assert.ok(sources.every(m=>m.visible));assert.deepEqual(root.children,sources);assert.equal(batchDisposals,1);assert.equal(sharedDisposals,0);assert.equal(getEventListeners(controller.signal,'abort').length,0);
    root.removeEventListener('childadded',fail);const retry=installHerbariumRenderBatches(root);assert.equal(retry.batches.length,1);retry.dispose();
  }
});

test('negative cell boundaries retain signed world coordinates',()=>{
  const {root}=fixture([[-.01,0,.2],[-1,0,.3],[.01,0,.2],[1,0,.3],[-6.01,0,.2],[-7,0,.3]]),handle=installHerbariumRenderBatches(root);
  assert.deepEqual(handle.batches.map(mesh=>mesh.userData.herbariumRenderBatch.cell),[[-1,0],[0,0],[-2,0]]);assert.deepEqual(handle.batches.map(mesh=>mesh.count),[2,2,2]);handle.dispose();
});

test('render proxies introduce no extra source picking hits',()=>{
  const {root,sources}=fixture();root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(.2,.4,3),new THREE.Vector3(0,0,-1)),before=ray.intersectObject(root,true);
  assert.ok(before.length>0);const handle=installHerbariumRenderBatches(root);root.updateMatrixWorld(true);
  const after=ray.intersectObject(root,true);assert.deepEqual(after.map(hit=>[hit.object.uuid,hit.faceIndex,hit.distance]),before.map(hit=>[hit.object.uuid,hit.faceIndex,hit.distance]));assert.ok(after.every(hit=>sources.includes(hit.object)));handle.dispose();
});

test('a cleanup listener failure cannot retain later batch resources or original objects',()=>{
  const {root,sources}=fixture([[.2,0,.2],[1.2,0,.3],[12.2,0,.2],[13.2,0,.3]]),controller=new AbortController(),handle=installHerbariumRenderBatches(root,{signal:controller.signal});
  let disposed=0;for(const mesh of handle.batches)mesh.addEventListener('dispose',()=>disposed++);handle.batches[0].addEventListener('dispose',()=>{throw new Error('Fixture cleanup listener');});
  assert.throws(()=>handle.dispose(),/Fixture cleanup listener/);assert.equal(disposed,2);assert.equal(handle.batches.length,0);assert.deepEqual(root.children,sources);assert.ok(sources.every(mesh=>mesh.visible));assert.equal(getEventListeners(controller.signal,'abort').length,0);
  handle.dispose();const retry=installHerbariumRenderBatches(root);assert.equal(retry.batches.length,2);retry.dispose();
});

test('only runtime-hidden authored sources carry the occlusion marker until restore or rollback',()=>{
  const {root,sources}=fixture([[.2,0,.2],[1.2,0,.3],[2.2,0,.2]]),controller=new AbortController();sources[2].visible=false;
  const metadata=sources.map(mesh=>structuredClone(mesh.userData));assert.ok(sources.every(mesh=>!isHerbariumRenderSource(mesh)));
  const handle=installHerbariumRenderBatches(root,{signal:controller.signal});
  assert.deepEqual(sources.map(isHerbariumRenderSource),[true,true,false]);assert.ok(handle.batches.every(mesh=>!isHerbariumRenderSource(mesh)));assert.deepEqual(sources.map(mesh=>mesh.userData),metadata);
  controller.abort();assert.ok(sources.every(mesh=>!isHerbariumRenderSource(mesh)));assert.deepEqual(sources.map(mesh=>mesh.visible),[true,true,false]);
  const retry=installHerbariumRenderBatches(root);assert.deepEqual(sources.map(isHerbariumRenderSource),[true,true,false]);retry.dispose();assert.ok(sources.every(mesh=>!isHerbariumRenderSource(mesh)));
  const fail=()=>{assert.deepEqual(sources.map(isHerbariumRenderSource),[true,true,false]);throw new Error('Marker rollback fixture');};root.addEventListener('childadded',fail);
  assert.throws(()=>installHerbariumRenderBatches(root),/Marker rollback fixture/);assert.ok(sources.every(mesh=>!isHerbariumRenderSource(mesh)));assert.deepEqual(sources.map(mesh=>mesh.visible),[true,true,false]);root.removeEventListener('childadded',fail);
});
