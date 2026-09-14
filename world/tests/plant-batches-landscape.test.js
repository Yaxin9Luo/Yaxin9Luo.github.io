import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createVegetation,createGrassSpecimen} from '../src/landscape.js';
import {createVegetation as createBefore} from './helpers/landscape-before-plant-chunks.js';
import {partitionPlantBatch} from '../src/plant-batches.js';
import {environmentWind} from '../src/environment-wind.js';
import {createGrassTuftVariants,grassTangentPlacement} from '../src/grass-geometry.js';
import {herbariumArrivalReserved,herbariumAt,herbariumCommunitySoilAt} from '../src/herbarium-layout.js';
import {insideAuthoredGarden} from '../src/environment-layout.js';

const raw=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const grassName='Grouped silver green ground cover';
function sameGeometry(a,b){
  assert.deepEqual(Object.keys(a.attributes),Object.keys(b.attributes));
  for(const key of Object.keys(b.attributes))for(const field of ['itemSize','normalized','gpuType','usage'])assert.equal(a.attributes[key][field],b.attributes[key][field],`${key}/${field}`);
  for(const key of Object.keys(b.attributes)){assert.equal(a.attributes[key].array.constructor,b.attributes[key].array.constructor);assert.deepEqual(raw(a.attributes[key].array),raw(b.attributes[key].array),key);}
  assert.equal(a.index?.array.constructor,b.index?.array.constructor);assert.deepEqual(a.index?.array,b.index?.array);assert.deepEqual(a.groups,b.groups);assert.deepEqual(a.drawRange,b.drawRange);assert.deepEqual(a.morphAttributes,b.morphAttributes);assert.equal(a.morphTargetsRelative,b.morphTargetsRelative);
}
function sameMaterial(a,b){
  assert.equal(a.constructor,b.constructor);
  for(const [key,value]of Object.entries(b)){
    if(['uuid','id','version','_listeners'].includes(key))continue;
    if(typeof value==='function')assert.equal(a[key].toString(),value.toString(),key);
    else if(value?.isTexture)assert.equal(a[key],value,key);
    else assert.deepEqual(a[key],value,key);
  }
  assert.equal(a.customProgramCacheKey(),b.customProgramCacheKey());
}
function view(eye,target,orthographic=false){
  const c=orthographic?new THREE.OrthographicCamera(-26,26,26,-26,.1,190):new THREE.PerspectiveCamera(50,16/9,.1,600);c.position.fromArray(eye);c.lookAt(...target);c.updateMatrixWorld(true);
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));
}
const cameraFixtures={close:view([48,9,39],[47,7,29]),overview:view([150,180,210],[0,6,12]),mirror:view([48,3,39],[47,5,29]),shadow:view([35,85,20],[35,5,20],true)};
const triangles=m=>(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count;
function counts(meshes){return Object.fromEntries(Object.entries(cameraFixtures).map(([key,frustum])=>{const submitted=meshes.filter(m=>m.visible&&frustum.intersectsObject(m)&&(key!=='shadow'||m.castShadow));return [key,{batches:submitted.length,triangles:submitted.reduce((n,m)=>n+triangles(m),0)}];}));}

function checkGrassCell(mesh,heightAt,nearPath){
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),settings=mesh.material.userData.environmentWind;
  assert.equal(mesh.userData.plantBatch.cellSize,32);assert.ok(mesh.userData.plantBatch.windPadding>0);
  for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);
    const added=mesh.userData.plantBatch.sourceIndices[i]>=mesh.userData.grassOriginalCount;
    for(const index of mesh.geometry.userData.grass.rootIndices){
      point.fromBufferAttribute(mesh.geometry.attributes.position,index).applyMatrix4(matrix);const height=heightAt(point.x,point.z);
      assert.ok(point.y<=height+1e-5,'actual grass root endpoints must meet their support');
      if(added){
        assert.ok(height>=.6&&point.y>=height-.06001,'new roots stay on the upper supported surface');
        assert.ok(!nearPath(point.x,point.z)&&!herbariumArrivalReserved(point.x,point.z)&&!herbariumAt(point.x,point.z,.7)&&!insideAuthoredGarden(point.x,point.z,.7)&&herbariumCommunitySoilAt(point.x,point.z)<=.30,'new root endpoints preserve route, arrival, actor and installed-bed exclusions');
      }
    }
    if(i!==0&&i!==mesh.count-1)continue;
    for(let j=0;j<mesh.geometry.attributes.position.count;j++)for(const time of[0,9]){
      point.fromBufferAttribute(mesh.geometry.attributes.position,j);const world=point.clone().applyMatrix4(matrix),phase=world.x*.12+world.z*.09+point.y*.53;
      const gust=Math.sin(time*.9+phase)*.78+Math.sin(time*.37+phase*.61)*.22,h=THREE.MathUtils.clamp((point.y-settings.minHeight)/(settings.maxHeight-settings.minHeight),0,1),bend=gust*settings.amplitude*h*h*(3-2*h);
      for(let axis=0;axis<3;axis++){const offset=axis*4,e=matrix.elements,x=e[offset],y=e[offset+1],z=e[offset+2];point.setComponent(axis,point.getComponent(axis)+bend*(environmentWind.direction.x*x+environmentWind.direction.y*z)/Math.max(x*x+y*y+z*z,.0001));}
      point.applyMatrix4(matrix);assert.ok(mesh.boundingBox.containsPoint(point),'production grass wind stays within its cell box');assert.ok(mesh.boundingSphere.containsPoint(point),'production grass wind stays within its cell sphere');
    }
  }
}

test('grass drifts keep original prefixes and exact non-grass geometry, materials, matrices and colors',async t=>{
  const heightAt=(x,z)=>z<0?-22:6+Math.sin(x*.03),nearPath=x=>Math.abs(x)<5,old=new THREE.Group(),next=new THREE.Group();
  const beforeStats=createBefore(old,heightAt,nearPath,{trees:false}),afterStats=createVegetation(next,heightAt,nearPath,{trees:false});old.updateMatrixWorld(true);next.updateMatrixWorld(true);
  const {update:beforeUpdate,grassCount:beforeGrass,...beforeCounts}=beforeStats,{update:afterUpdate,grassCount:afterGrass,grassDistribution,...afterCounts}=afterStats;
  assert.deepEqual(afterCounts,beforeCounts);assert.equal(grassDistribution.original,beforeGrass);assert.equal(afterGrass,beforeGrass+grassDistribution.added);assert.ok(grassDistribution.added>0);
  assert.equal(afterUpdate(),beforeUpdate());assert.ok(next.children.some(m=>m.userData.plantBatch),'production must partition its finished low-plant batches');
  const originals=old.children.filter(m=>m.isInstancedMesh),byName=new Map(),digest=createHash('sha256');let instances=0,submitted=0;
  for(const mesh of next.children.filter(m=>m.isInstancedMesh)){const name=mesh.userData.grassVariant!==undefined?grassName:mesh.userData.plantBatch?.name||mesh.name;if(!byName.has(name))byName.set(name,[]);byName.get(name).push(mesh);}
  assert.deepEqual([...byName.keys()],originals.map(m=>m.name),'family order stays unchanged');
  const families=[],expectedGrass=createGrassTuftVariants();t.after(()=>expectedGrass.forEach(geometry=>geometry.dispose()));
  for(const source of originals){
    const chunks=byName.get(source.name),isGrass=source.name===grassName,matrix=new Float32Array(source.count*16),color=source.instanceColor?new source.instanceColor.array.constructor(source.count*3):null,seen=new Set(),addedSeen=new Set(),variants=new Map();
    for(const mesh of chunks){
      if(isGrass){
        if(!variants.has(mesh.userData.grassVariant))variants.set(mesh.userData.grassVariant,mesh);
        sameGeometry(mesh.geometry,expectedGrass[mesh.userData.grassVariant]);checkGrassCell(mesh,heightAt,nearPath);
        assert.equal(mesh.userData.grassOriginalCount,Math.floor((source.count+2-mesh.userData.grassVariant)/3),'every variant retains its original prefix length');
      }else sameGeometry(mesh.geometry,source.geometry);
      const familySource=isGrass?variants.get(mesh.userData.grassVariant):chunks[0];sameMaterial(mesh.material,source.material);
      assert.equal(mesh.geometry,familySource.geometry);assert.equal(mesh.material,chunks[0].material,'no per-cell material copies');
      assert.deepEqual(mesh.matrix.elements,source.matrix.elements);
      for(const key of ['castShadow','receiveShadow','visible','frustumCulled','renderOrder'])assert.equal(mesh[key],source[key],key);
      for(const key of ['customDepthMaterial','customDistanceMaterial']){if(source[key]){sameMaterial(mesh[key],source[key]);assert.equal(mesh[key],familySource[key]);}else assert.equal(mesh[key],undefined);}
      const cellIds=mesh.userData.plantBatch?.sourceIndices||Array.from({length:mesh.count},(_,i)=>i),ids=isGrass?cellIds.map(i=>i<mesh.userData.grassOriginalCount?i*mesh.userData.grassSourceStride+mesh.userData.grassVariant:null):cellIds;assert.equal(ids.length,mesh.count);
      ids.forEach((id,i)=>{
        if(id===null){const key=`${mesh.userData.grassVariant}/${cellIds[i]}`;assert.ok(!addedSeen.has(key),'appended source indices cannot be duplicated across cells');addedSeen.add(key);return;}
        assert.ok(!seen.has(id));seen.add(id);matrix.set(mesh.instanceMatrix.array.subarray(i*16,i*16+16),id*16);if(color)color.set(mesh.instanceColor.array.subarray(i*3,i*3+3),id*3);
      });
    }
    assert.equal(seen.size,source.count);
    if(isGrass){
      assert.equal(variants.size,3);assert.equal(addedSeen.size,grassDistribution.added);
      for(let i=0;i<source.count;i++){
        const offset=i*16,before=source.instanceMatrix.array;
        assert.deepEqual(matrix.subarray(offset+12,offset+15),before.subarray(offset+12,offset+15),'the ordered accepted grass centres stay bit-identical');
        for(const axis of[0,8])assert.ok(Math.abs(Math.hypot(...matrix.subarray(offset+axis,offset+axis+3))-Math.hypot(...before.subarray(offset+axis,offset+axis+3)))<1e-6,'original horizontal tuft scales survive slope orientation');
        const afterHeight=Math.hypot(...matrix.subarray(offset+4,offset+7)),beforeHeight=Math.hypot(...before.subarray(offset+4,offset+7));
        assert.ok(afterHeight>0&&afterHeight<=beforeHeight+1e-6,'authored height tiers only shorten original grass');
        const x=before[offset+12],z=before[offset+14];if(herbariumArrivalReserved(x,z))assert.ok(Math.abs(afterHeight-beforeHeight)<1e-6,'reserved mown grass retains its original height');
      }
    }else {
      assert.deepEqual(raw(matrix),raw(source.instanceMatrix.array));if(color)assert.deepEqual(raw(color),raw(source.instanceColor.array));
      digest.update(source.name);for(const attribute of Object.values(source.geometry.attributes))digest.update(raw(attribute.array));if(source.geometry.index)digest.update(raw(source.geometry.index.array));digest.update(raw(matrix));if(color)digest.update(raw(color));
    }
    const submittedTriangles=chunks.reduce((sum,mesh)=>sum+triangles(mesh),0);
    const familyInstances=chunks.reduce((sum,mesh)=>sum+mesh.count,0);instances+=familyInstances;submitted+=submittedTriangles;families.push({name:source.name,instances:familyInstances,originalInstances:source.count,addedInstances:familyInstances-source.count,triangles:submittedTriangles,legacyTriangles:triangles(source),cells:chunks.length});
  }
  const analysis={baseline:counts(originals)};
  for(const cellSize of [24,32,40]){
    const copies=originals.map(source=>source.clone()),parent=new THREE.Group();parent.add(...copies);
    const chunks=copies.flatMap(source=>partitionPlantBatch(source,{cellSize}));parent.updateMatrixWorld(true);analysis[cellSize]={totalBatches:chunks.length,...counts(chunks)};
    // The copied test owners share originals; dispose only instance containers.
    for(const chunk of chunks)chunk.dispose();parent.clear();
  }
  analysis.refinedGrass=counts(next.children.filter(m=>m.isInstancedMesh));
  const evidence={fixture:'Actual createVegetation; trees:false, z<0 sea, sinusoidal supported height, reserved x corridor. No full-world/asset load or GPU.',instances,grassDistribution,fullSubmittedTriangles:submitted,nonGrassOrderedStreamSHA256:digest.digest('hex'),families,cameraFixtures:'Fixed CPU perspective close/overview/reflected-view and orthographic shadow; not a native R4 count.',analysis};
  if(process.env.PLANT_CHUNK_PROOF)await writeFile(process.env.PLANT_CHUNK_PROOF,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
});

test('actual rendered terrain supports complete tuft roots across the R8 east, west and bank samples',async t=>{
  const {renderedTerrainHeight}=await import('../src/world.js'),variants=createGrassTuftVariants(),object=new THREE.Object3D(),vertex=new THREE.Vector3();
  let sites=0,tufts=0,roots=0,worstGap=-Infinity;
  for(const [cx,cz]of[[-14,67],[62,18],[-25,79]])for(let ix=-3;ix<=3;ix++)for(let iz=-3;iz<=3;iz++){
    const x=cx+ix*2.31+.137,z=cz+iz*1.77+.213,h=renderedTerrainHeight(x,z);if(h<.6)continue;sites++;
    for(const [variant,geometry]of variants.entries())for(const s of[.64,1.43]){
      const p=grassTangentPlacement({x,y:h-.025,z,s,r:.37+variant*.83},renderedTerrainHeight);object.position.set(p.x,p.y,p.z);object.rotation.set(p.rx,p.r,p.rz);object.scale.setScalar(s);object.updateMatrix();tufts++;
      for(const i of geometry.userData.grass.rootIndices){vertex.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(object.matrix);const gap=vertex.y-renderedTerrainHeight(vertex.x,vertex.z);roots++;worstGap=Math.max(worstGap,gap);assert.ok(gap<=1e-5,`root unsupported by rendered terrain at ${vertex.x},${vertex.z}: ${gap}m`);}
    }
  }
  assert.ok(sites>0&&tufts>sites&&roots>tufts);t.diagnostic(JSON.stringify({scope:'Actual renderedTerrainHeight sample; no world model construction, textures or GPU',sites,tufts,roots,worstGap}));variants.forEach(geometry=>geometry.dispose());
});

test('native grass specimen retains exact field geometry/materials and releases its owned resources once',()=>{
  const specimen=createGrassSpecimen(),variants=createGrassTuftVariants(),box=new THREE.Box3().setFromObject(specimen,true),sizes=box.getSize(new THREE.Vector3());
  assert.equal(specimen.children.length,variants.length);assert.deepEqual(specimen.userData.actualBounds,{min:box.min.toArray(),max:box.max.toArray()});assert.deepEqual(specimen.userData.dimensions,{width:sizes.x,height:sizes.y,depth:sizes.z});
  assert.equal(specimen.userData.studyFloorY,0);assert.equal(specimen.userData.studyOwner,'grass');
  for(const view of Object.values(specimen.userData.studyViews)){assert.ok([...view.eye,...view.target].every(Number.isFinite));assert.notDeepEqual(view.eye,view.target);}
  const resources=new Set();
  for(const [variant,mesh]of specimen.children.entries()){
    sameGeometry(mesh.geometry,variants[variant]);assert.deepEqual(mesh.scale.toArray(),[1,1,1]);assert.equal(mesh.material,specimen.children[0].material);assert.equal(mesh.material.side,THREE.DoubleSide);assert.equal(mesh.material.vertexColors,true);assert.equal(mesh.material.alphaTest,0);
    assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,true);assert.ok(mesh.boundingSphere.radius>mesh.geometry.boundingSphere.radius,'studio wind stays inside a conservative local bound');
    for(const resource of[mesh.geometry,mesh.material,mesh.customDepthMaterial,mesh.customDistanceMaterial])resources.add(resource);
  }
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <opaque_fragment>'};specimen.children[0].material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/outgoingLight\+=diffuseColor.rgb\*\.045/);assert.match(shader.vertexShader,/0\.18000/,'the actual field wind hook remains active');
  let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);const parent=new THREE.Group();parent.add(specimen);specimen.dispose();specimen.dispose();assert.equal(disposed,resources.size);assert.equal(specimen.parent,null);assert.equal(specimen.userData.disposed,true);variants.forEach(geometry=>geometry.dispose());
});
