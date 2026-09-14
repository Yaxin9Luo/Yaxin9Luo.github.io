import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {partitionPlantBatch} from '../src/plant-batches.js';
import {applyEnvironmentWind,attachWindShadows,environmentWind} from '../src/environment-wind.js';

function specimen(positions,{wind=.18,colored=true}={}){
  const geometry=new THREE.BoxGeometry(.08,.12,.08),material=applyEnvironmentWind(new THREE.MeshStandardMaterial({alphaTest:.3,side:THREE.DoubleSide}),{amplitude:wind,minHeight:0,maxHeight:.1});
  const source=new THREE.InstancedMesh(geometry,material,positions.length);source.name='Fixture low plants';source.castShadow=source.receiveShadow=true;source.renderOrder=4;source.layers.set(2);
  const dummy=new THREE.Object3D();
  positions.forEach(([x,y,z],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(.03*i,.19*i,-.02*i);dummy.scale.set(.7+i*.1,1.2,.9);dummy.updateMatrix();source.setMatrixAt(i,dummy.matrix);if(colored)source.setColorAt(i,new THREE.Color(.2+i*.09,.8-i*.08,.4));});
  attachWindShadows(source);source.computeBoundingSphere();
  const root=new THREE.Group(),before=new THREE.Group(),after=new THREE.Group();root.add(before,source,after);return {source,root,before,after};
}
const frustum=camera=>{camera.updateMatrixWorld(true);return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));};
function camera(x,y,z,tx,ty,tz){const result=new THREE.PerspectiveCamera(35,1,.05,50);result.position.set(x,y,z);result.lookAt(tx,ty,tz);return result;}
// CPU evaluation of the unchanged vertex shader, including its column-wise
// projection (not an inverse transform), literal precision, gust and height.
function shaderPosition(mesh,instance,position,time){
  const transform=new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld,instance),e=transform.elements,world=position.clone().applyMatrix4(transform),settings=mesh.material.userData.environmentWind;
  const literal=value=>Number(value.toFixed(5)),phase=world.x*.12+world.z*.09+position.y*.53;
  const gust=Math.sin(time*.9+phase)*.78+Math.sin(time*.37+phase*.61)*.22;
  const height=THREE.MathUtils.clamp((position.y-literal(settings.minHeight))/(literal(settings.maxHeight)-literal(settings.minHeight)),0,1),bend=gust*literal(settings.amplitude)*height*height*(3-2*height);
  const local=position.clone();
  for(let axis=0;axis<3;axis++){
    const offset=axis*4,x=e[offset],y=e[offset+1],z=e[offset+2];
    local.setComponent(axis,local.getComponent(axis)+bend*(environmentWind.direction.x*x+environmentWind.direction.y*z)/Math.max(x*x+y*y+z*z,.0001));
  }
  return {local:local.clone().applyMatrix4(instance),world:local.applyMatrix4(transform)};
}
function alignWindParent(root){root.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(environmentWind.direction.x,0,environmentWind.direction.y));root.scale.set(2,1,1);root.updateMatrixWorld(true);}

test('cells preserve every final instance bit and its original color assignment at signed boundaries',()=>{
  const {source,root,before,after}=specimen([[-.01,0,0],[31.99,1,0],[32,2,0],[-32,3,0],[-32.01,4,0],[1,5,0]]);
  const matrix=source.instanceMatrix.array.slice(),colors=source.instanceColor.array.slice(),chunks=partitionPlantBatch(source);
  assert.equal(chunks.length,4,'four signed 32m cells must replace the island-wide batch');
  assert.equal(root.children[0],before);assert.equal(root.children.at(-1),after);assert.equal(source.parent,null);
  assert.deepEqual(chunks.map(c=>c.userData.plantBatch.sourceIndices),[[0,3],[1,5],[2],[4]]);
  const seen=[];
  for(const chunk of chunks){
    assert.equal(chunk.geometry,source.geometry);assert.equal(chunk.material,source.material);assert.equal(chunk.customDepthMaterial,source.customDepthMaterial);assert.equal(chunk.customDistanceMaterial,source.customDistanceMaterial);
    assert.equal(chunk.renderOrder,4);assert.equal(chunk.layers.mask,4);assert.equal(chunk.frustumCulled,true);assert.equal(chunk.castShadow,true);assert.equal(chunk.receiveShadow,true);
    chunk.userData.plantBatch.sourceIndices.forEach((index,local)=>{seen.push(index);assert.deepEqual(chunk.instanceMatrix.array.subarray(local*16,local*16+16),matrix.subarray(index*16,index*16+16));assert.deepEqual(chunk.instanceColor.array.subarray(local*3,local*3+3),colors.subarray(index*3,index*3+3));});
  }
  assert.deepEqual(seen.sort((a,b)=>a-b),[0,1,2,3,4,5]);
});

test('wind bounds enclose actual shader bending under nonuniform parents without altering source geometry',()=>{
  const {source,root}=specimen([[0,.07,0],[64,.07,0]]),bounds=source.geometry.boundingSphere.clone();root.scale.set(.25,2,.5);root.rotation.y=.43;root.position.set(7,3,-4);
  const chunks=partitionPlantBatch(source);root.updateMatrixWorld(true);const matrix=new THREE.Matrix4(),p=source.geometry.attributes.position;
  for(const chunk of chunks){const worldSphere=chunk.boundingSphere.clone().applyMatrix4(chunk.matrixWorld);for(let i=0;i<chunk.count;i++){chunk.getMatrixAt(i,matrix);for(let j=0;j<p.count;j++)for(const time of[0,.3,2,9,21]){
    const displaced=shaderPosition(chunk,matrix,new THREE.Vector3().fromBufferAttribute(p,j),time);
    assert.ok(worldSphere.containsPoint(displaced.world),'the actual shader vertex must remain in its per-cell sphere');
    assert.ok(chunk.boundingBox.containsPoint(displaced.local),'the object-local box must contain the same shader vertex');
  }}}
  assert.deepEqual(source.geometry.boundingSphere,bounds);
  const edge=specimen([[0,0,0]],{wind:.18,colored:false}),[chunk]=partitionPlantBatch(edge.source);
  assert.ok(chunk.boundingSphere.radius>=bounds.radius*.7+.18-1e-8,'static bounds alone cannot cull a bending leaf');
  assert.equal(chunk.instanceColor,null);
});

test('nonorthogonal shader columns cannot cull a visible wind-bent leaf at the camera plane',t=>{
  const {source,root}=specimen([[0,0,0]],{colored:false});source.geometry=new THREE.BoxGeometry(.001,.001,.001).translate(0,1,0);alignWindParent(root);
  const direction=new THREE.Vector3(environmentWind.direction.x,0,environmentWind.direction.y),translation=direction.clone().multiplyScalar((Math.PI/2-.53)/(direction.x*.12+direction.z*.09)).applyMatrix4(root.matrixWorld.clone().invert());
  source.setMatrixAt(0,new THREE.Matrix4().makeRotationY(Math.PI/4).setPosition(translation));source.computeBoundingSphere();
  const staticSphere=source.boundingSphere.clone(),[chunk]=partitionPlantBatch(source);root.updateMatrixWorld(true);
  const instance=new THREE.Matrix4();chunk.getMatrixAt(0,instance);
  const vertex=new THREE.Vector3().fromBufferAttribute(source.geometry.attributes.position,0),still=vertex.clone().applyMatrix4(instance).applyMatrix4(chunk.matrixWorld),bent=shaderPosition(chunk,instance,vertex,0).world;
  const worldSphere=chunk.boundingSphere.clone().applyMatrix4(chunk.matrixWorld),oldIdealPadding=.18/2,oldSphere=staticSphere.clone();oldSphere.radius+=oldIdealPadding;oldSphere.applyMatrix4(chunk.matrixWorld);
  t.diagnostic(JSON.stringify({actualWorldDisplacement:still.distanceTo(bent),oldWorldRadius:oldSphere.radius,newWorldRadius:worldSphere.radius,localWindPadding:chunk.userData.plantBatch.windPadding}));
  assert.ok(still.distanceTo(bent)>.27,'the cited shader projection amplifies this actual gust');
  assert.ok(!oldSphere.containsPoint(bent),'the old inverse-model bound misses the real shader vertex');
  assert.ok(worldSphere.containsPoint(bent),'corrected sphere must contain the shader-bent leaf');
  const camera=new THREE.OrthographicCamera(-.05,.05,.05,-.05,.1,.77);camera.position.copy(oldSphere.center).add(direction);camera.lookAt(oldSphere.center);const view=frustum(camera);
  assert.ok(view.containsPoint(bent),'the bent source vertex is inside the camera frustum');
  assert.ok(!view.intersectsSphere(oldSphere),'the old padding would reject its visible plant');
  assert.ok(view.intersectsObject(chunk),'the corrected chunk remains submitted');
});

test('cell padding uses its maximum instance projection, shader literal rounding and denominator floor',()=>{
  const {source,root}=specimen([[0,0,0],[1,0,0],[64,0,0]],{wind:-.1800049});alignWindParent(root);
  for(let i=0;i<3;i++)source.setMatrixAt(i,new THREE.Matrix4().makeRotationY(i===1?Math.PI/4:0).setPosition(i===2?64:i,0,0));
  const chunks=partitionPlantBatch(source);
  assert.deepEqual(chunks.map(c=>c.userData.plantBatch.sourceIndices),[[0,1],[2]]);
  assert.ok(Math.abs(chunks[0].userData.plantBatch.windPadding-.144)<1e-8,'the rotated second instance determines this cell envelope');
  assert.ok(Math.abs(chunks[1].userData.plantBatch.windPadding-.09)<1e-8,'another cell keeps its own smaller envelope');
  for(const [scale,expected]of[[.001,1.8],[0,0]]){
    const small=specimen([[0,0,0]],{wind:.1800049});small.source.setMatrixAt(0,new THREE.Matrix4());small.root.scale.setScalar(scale);
    const [chunk]=partitionPlantBatch(small.source);
    assert.ok(Number.isFinite(chunk.userData.plantBatch.windPadding));
    assert.ok(Math.abs(chunk.userData.plantBatch.windPadding-expected)<1e-8,'sub-floor/zero columns use the shader denominator floor');
  }
});

test('cell meshes preserve an explicitly managed source world transform',()=>{
  const {source,root}=specimen([[0,0,0],[64,0,0]]);source.matrixAutoUpdate=false;source.matrix.makeTranslation(2,3,4);source.matrixWorldAutoUpdate=false;source.matrixWorld.makeTranslation(11,7,-5);
  const chunks=partitionPlantBatch(source);root.updateMatrixWorld(true);
  for(const chunk of chunks){assert.equal(chunk.matrixAutoUpdate,false);assert.equal(chunk.matrixWorldAutoUpdate,false);assert.deepEqual(chunk.matrix.elements,source.matrix.elements);assert.deepEqual(chunk.matrixWorld.elements,source.matrixWorld.elements);}
});

test('main, shadow and reflected camera frusta select their own cells without global visibility flags',()=>{
  const {source,root}=specimen([[0,0,0],[0,8,-18],[0,0,-96]],{wind:.027});const chunks=partitionPlantBatch(source);root.updateMatrixWorld(true);
  // The virtual camera and its look target are reflected across y=0. A high
  // offscreen plant can enter the lake reflection without entering the eye view.
  const main=frustum(camera(0,2,8,0,1,0)),mirror=frustum(camera(0,-2,8,0,-1,0)),shadowCamera=new THREE.OrthographicCamera(-4,4,4,-4,.1,30);shadowCamera.position.set(0,12,-96);shadowCamera.lookAt(0,0,-96);const shadow=frustum(shadowCamera);
  const selected=f=>chunks.filter(c=>f.intersectsObject(c)).flatMap(c=>c.userData.plantBatch.sourceIndices);
  assert.deepEqual(selected(main),[0]);assert.deepEqual(selected(mirror),[0,1]);assert.deepEqual(selected(shadow),[2]);
  assert.ok(main.intersectsObject(source),'the original broad sphere admits all three instances');
  assert.ok(chunks.every(c=>c.visible&&c.castShadow),'a main-camera exclusion must not hide a reflected or shadow-casting plant');
  const boundaryCamera=new THREE.OrthographicCamera(-.08,.08,.1,-.1,.1,2);boundaryCamera.position.set(.16,0,1);boundaryCamera.lookAt(.16,0,0);
  assert.ok(frustum(boundaryCamera).intersectsObject(chunks[0]),'wind crossing a frustum boundary must keep its chunk');
});

test('family ownership disposes cells and shared shadow pair once, never borrowed geometry or maps',()=>{
  const {source}=specimen([[0,0,0],[80,0,0]]);const disposed={source:0,cells:0,geometry:0,depth:0,distance:0,map:0};source.material.map=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);source.material.map.addEventListener('dispose',()=>disposed.map++);
  source.addEventListener('dispose',()=>disposed.source++);source.geometry.addEventListener('dispose',()=>disposed.geometry++);source.customDepthMaterial.addEventListener('dispose',()=>disposed.depth++);source.customDistanceMaterial.addEventListener('dispose',()=>disposed.distance++);
  const chunks=partitionPlantBatch(source);for(const chunk of chunks)chunk.addEventListener('dispose',()=>disposed.cells++);
  assert.equal(disposed.source,1,'retire only the replaced instance container');assert.equal(disposed.geometry,0);assert.equal(disposed.depth,0);
  chunks[0].dispose();assert.equal(disposed.depth,0,'one cell cannot retire shadows borrowed by another');
  source.material.dispose();source.material.dispose();
  assert.equal(disposed.cells,3);assert.equal(disposed.depth,1);assert.equal(disposed.distance,1);assert.equal(disposed.geometry,0);assert.equal(disposed.map,0);
});

test('blended materials and empty batches keep their original ordering and resources',()=>{
  const {source,root}=specimen([[0,0,0],[64,0,0]]);source.material.transparent=true;
  assert.deepEqual(partitionPlantBatch(source),[source]);assert.equal(source.parent,root);
  const empty=specimen([]);assert.deepEqual(partitionPlantBatch(empty.source),[empty.source]);assert.equal(empty.source.parent,empty.root);
  source.material.transparent=false;source.material.depthWrite=false;assert.deepEqual(partitionPlantBatch(source),[source],'depth-disabled ordering is outside opaque plant partitioning');
  assert.throws(()=>partitionPlantBatch(source,{cellSize:0}),/cell/i);
});
