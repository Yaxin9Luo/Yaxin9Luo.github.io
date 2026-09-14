import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import beforeBuilder from './helpers/garden-builder-before-index.js';
import {loadBotanicalAssets} from '../src/botanical-cache.js';
import {decodeGeometryGLB} from './helpers/herbarium-source.js';
import {applyEnvironmentWind} from '../src/environment-wind.js';
import {renderedTerrainHeight,createRoadSampleIndex} from '../src/world.js';
import {locations} from '../src/locations.js';
import {academyPathCurves} from '../src/landform-layout.js';

// Evaluate the same production module with either its current Builder or the
// exact archived class. All factories, materials and dependencies remain real.
const source=await readFile(new URL('../src/gardens.js',import.meta.url),'utf8');
async function moduleWithBuilder(previous){
  let code=previous?source.replace(/class Builder \{[\s\S]*?\n\}\n\nfunction clippedRectangle/,`${beforeBuilder}\n\nfunction clippedRectangle`):source;
  code=code.replace(/from '([^']+)'/g,(all,spec)=>`from '${spec.startsWith('.')?new URL(spec,new URL('../src/gardens.js',import.meta.url)).href:import.meta.resolve(spec)}'`);
  return import(`data:text/javascript;base64,${Buffer.from(code+'\nexport {Builder};').toString('base64')}`);
}
const current=await moduleWithBuilder(false),previous=await moduleWithBuilder(true);
const raw=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
const metadata=a=>({type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,gpuType:a.gpuType});
const bytesOf=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength||0)+Object.values(g.morphAttributes).flat().reduce((n,a)=>n+a.array.byteLength,0);
function drawArray(g,a){
  if(!g.index)return a.array;
  const out=new a.array.constructor(g.index.count*a.itemSize);
  for(let i=0;i<g.index.count;i++)for(let c=0;c<a.itemSize;c++)out[i*a.itemSize+c]=a.array[g.index.getX(i)*a.itemSize+c];
  return out;
}
function equalGeometry(actual,expected){
  assert.deepEqual(Object.keys(actual.attributes),Object.keys(expected.attributes));
  for(const key of Object.keys(expected.attributes)){
    assert.deepEqual(metadata(actual.attributes[key]),metadata(expected.attributes[key]),key);
    assert.deepEqual(raw(drawArray(actual,actual.attributes[key])),raw(drawArray(expected,expected.attributes[key])),key);
  }
  assert.deepEqual(Object.keys(actual.morphAttributes),Object.keys(expected.morphAttributes));
  for(const key of Object.keys(expected.morphAttributes))for(let i=0;i<expected.morphAttributes[key].length;i++){
    assert.deepEqual(metadata(actual.morphAttributes[key][i]),metadata(expected.morphAttributes[key][i]));
    assert.deepEqual(raw(drawArray(actual,actual.morphAttributes[key][i])),raw(drawArray(expected,expected.morphAttributes[key][i])));
  }
  assert.equal(actual.morphTargetsRelative,expected.morphTargetsRelative);assert.deepEqual(actual.groups,expected.groups);assert.deepEqual(actual.drawRange,expected.drawRange);
}
function geometry(indexType=Uint16Array){
  const g=new THREE.PlaneGeometry(2,3,2,2),count=g.attributes.position.count;
  g.setIndex(new THREE.BufferAttribute(new indexType(g.index.array),1));
  g.setAttribute('color',new THREE.Uint8BufferAttribute(Array.from({length:count*3},(_,i)=>(i*73)%256),3,true));
  g.setAttribute('windWeight',new THREE.Uint16BufferAttribute(Array.from({length:count},(_,i)=>i*13),1,true));
  g.setAttribute('tangent',new THREE.Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4===0||i%4===3?1:0),4));
  g.morphAttributes.position=[g.attributes.position.clone()];g.morphTargetsRelative=true;
  g.clearGroups();g.addGroup(0,6,1);g.addGroup(6,g.index.count-6,0);g.setDrawRange(3,g.index.count-3);return g;
}

test('plant indices retain complete ordered attributes, mixed source indices, materials and wind shadows',()=>{
  const a=geometry(),b=geometry(Uint32Array),c=geometry().toNonIndexed(),sources=[a,b,c],original=sources.map(g=>g.clone());
  const material=applyEnvironmentWind(new THREE.MeshStandardMaterial({map:new THREE.Texture(),vertexColors:true})),other=material.clone();
  const builders=[new previous.Builder('proof',{}),new current.Builder('proof',{})];
  for(const builder of builders){
    for(const [i,g]of sources.entries())builder.add(g,material,[i*2.3,.47,-.8],[.8,1.4,1.2],[.12,i*.7,.08],true);
    builder.add(a,other,[1,2,3],[1,1,1],[0,0,0],true);builder.boxSolid('same solid',0,0,3,2,-1,4);
  }
  const [old,next]=builders.map(b=>b.finish());assert.ok(next.children.every(m=>m.geometry.index),'preserveUV plants must remain indexed');
  assert.equal(next.children.length,old.children.length);assert.deepEqual(next.userData,old.userData);
  for(let i=0;i<old.children.length;i++){
    const x=next.children[i],y=old.children[i];equalGeometry(x.geometry,y.geometry);assert.equal(x.material,y.material);assert.equal(x.material.map,y.material.map);
    assert.equal(x.name,y.name);assert.equal(x.castShadow,y.castShadow);assert.equal(x.receiveShadow,y.receiveShadow);assert.deepEqual(x.matrix.toArray(),y.matrix.toArray());
    for(const key of ['customDepthMaterial','customDistanceMaterial']){assert.equal(x[key].customProgramCacheKey(),y[key].customProgramCacheKey());assert.equal(x[key].onBeforeCompile.toString(),y[key].onBeforeCompile.toString());}
  }
  sources.forEach((g,i)=>{equalGeometry(g,original[i]);assert.deepEqual(g.index?.array,original[i].index?.array);});
  assert.ok(bytesOf(next.children[0].geometry)<bytesOf(old.children[0].geometry));
});

test('architecture keeps exact expanded buffers and face-projected UVs, including a mixed material bucket',()=>{
  const mat=new THREE.MeshStandardMaterial(),plant=geometry();plant.deleteAttribute('color');plant.deleteAttribute('windWeight');plant.deleteAttribute('tangent');plant.morphAttributes={};plant.morphTargetsRelative=false;
  for(const mixed of [false,true]){
    const outputs=[previous,current].map(module=>{const b=new module.Builder('architecture',{});b.add(new THREE.BoxGeometry(2,3,4),mat,[2,3,4],[1.3,.7,.9],[.2,.3,.4]);if(mixed)b.add(plant,mat,[0,1,0],[1,1,1],[0,.3,0],true);return b.finish().children[0].geometry;});
    equalGeometry(outputs[1],outputs[0]);if(!mixed){assert.equal(outputs[1].index,null);for(const key of Object.keys(outputs[0].attributes))assert.deepEqual(raw(outputs[1].attributes[key].array),raw(outputs[0].attributes[key].array));}
  }
});

test('a large expanded input in a mixed bucket cannot truncate sequential indices at 16 bits',()=>{
  const expanded=new THREE.PlaneGeometry(2,2,110,110).toNonIndexed(),indexed=new THREE.PlaneGeometry(),mat=new THREE.MeshStandardMaterial();
  const outputs=[previous,current].map(module=>{const b=new module.Builder('wide indices',{});b.add(expanded,mat,[0,0,0],[1,1,1],[0,0,0],true);b.add(indexed,mat,[2,0,0],[1,1,1],[0,0,0],true);return b.finish().children[0].geometry;});
  assert.ok(expanded.attributes.position.count>65535);assert.ok(outputs[1].index.array instanceof Uint32Array);equalGeometry(outputs[1],outputs[0]);
});

test('incompatible mixed material attributes fail clearly instead of constructing a null geometry',t=>{
  const b=new current.Builder('incompatible',{}),mat=new THREE.MeshStandardMaterial();mat.name='mismatched leaves';
  b.add(new THREE.PlaneGeometry(),mat,[0,0,0],[1,1,1],[0,0,0],true);const extra=new THREE.PlaneGeometry();extra.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(12),3));b.add(extra,mat,[0,0,0],[1,1,1],[0,0,0],true);
  t.mock.method(console,'error',()=>{});assert.throws(()=>b.finish(),/Cannot merge garden geometry.*mismatched leaves/);
});

// Hash every ordered draw byte in bounded chunks: do not retain a second full
// expanded district while proving equality. No sampled vertices or rounding.
function drawHash(g,a){
  const hash=createHash('sha256');if(!g.index)return hash.update(raw(a.array)).digest('hex');
  const chunk=new a.array.constructor(4096*a.itemSize);
  for(let first=0;first<g.index.count;first+=4096){const count=Math.min(4096,g.index.count-first);for(let i=0;i<count;i++)for(let c=0;c<a.itemSize;c++)chunk[i*a.itemSize+c]=a.array[g.index.getX(first+i)*a.itemSize+c];hash.update(raw(chunk.subarray(0,count*a.itemSize)));}
  return hash.digest('hex');
}
function materialRecord(material){
  if(!material)return null;const uuids=new Map(),stable=JSON.stringify(material.toJSON()).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,id=>{if(!uuids.has(id))uuids.set(id,`uuid-${uuids.size}`);return uuids.get(id);});
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
  const hash=value=>createHash('sha256').update(value).digest('hex');
  return {json:stable,program:material.customProgramCacheKey(),vertexSha256:hash(shader.vertexShader),fragmentSha256:hash(shader.fragmentShader),uniforms:JSON.stringify(shader.uniforms)};
}
function snapshot(gardens){
  gardens.update(2.7,false);gardens.group.updateMatrixWorld(true);const nodes=[],geometryRecords=[],buffers=new Set();let bytes=0,triangles=0;
  gardens.group.traverse(o=>{
    const node={name:o.name,type:o.type,matrix:o.matrix.toArray(),world:o.matrixWorld.toArray(),castShadow:o.castShadow,receiveShadow:o.receiveShadow,visible:o.visible};
    if(o.geometry){
      const g=o.geometry,attrs={},morph={};for(const [key,a]of Object.entries(g.attributes))attrs[key]={...metadata(a),drawCount:g.index?.count??a.count,sha256:drawHash(g,a)};
      g.computeBoundingBox();g.computeBoundingSphere();node.bounds={min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius};
      for(const [key,list]of Object.entries(g.morphAttributes))morph[key]=list.map(a=>({...metadata(a),sha256:drawHash(g,a)}));
      Object.assign(node,{attrs,morph,morphTargetsRelative:g.morphTargetsRelative,groups:g.groups,range:g.drawRange,materials:(Array.isArray(o.material)?o.material:[o.material]).map(materialRecord),depth:materialRecord(o.customDepthMaterial),distance:materialRecord(o.customDistanceMaterial)});
      if(o.isInstancedMesh){node.instances=Array.from(o.instanceMatrix.array);node.count=o.count;}
      triangles+=(g.index?.count??g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
      const countBytes=a=>{if(a&&!buffers.has(a.array.buffer)){buffers.add(a.array.buffer);bytes+=a.array.buffer.byteLength;}};Object.values(g.attributes).forEach(countBytes);Object.values(g.morphAttributes).flat().forEach(countBytes);countBytes(g.index);
      geometryRecords.push({name:o.name,indexed:!!g.index,storedBytes:bytesOf(g),attributes:Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,{...metadata(a),count:a.count,rawSha256:createHash('sha256').update(raw(a.array)).digest('hex')}]))});
    }
    if(o.isLight)Object.assign(node,{color:o.color.toArray(),intensity:o.intensity,distance:o.distance,decay:o.decay});nodes.push(node);
  });
  return {draw:{nodes,triangles,colliders:gardens.colliders,lampSites:gardens.lampSites,anchors:gardens.contentAnchors,clock:gardens.clockPosition.toArray()},storage:{bytes,geometryRecords}};
}

test('all authored districts and edges preserve every draw byte, architecture, materials, motion and collider',async()=>{
  await loadBotanicalAssets({families:[{kind:'silver',seed:154},{kind:'cherry',seed:154}],levels:['near'],loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)))});
  const paths=locations.flatMap(location=>academyPathCurves(location).map(curve=>curve.getPoints(Math.ceil(curve.getLength()/.18)))),nearPath=createRoadSampleIndex(paths);
  const run=module=>{const gardens=module.createAuthoredGardens(new THREE.Group(),renderedTerrainHeight,nearPath),result=snapshot(gardens);const owned=new Set();gardens.group.traverse(o=>{if(o.geometry&&!o.geometry.userData.sharedAsset)owned.add(o.geometry);});for(const g of owned)g.dispose();return result;};
  const old=run(previous),next=run(current);assert.deepEqual(next.draw,old.draw);
  assert.equal(next.storage.geometryRecords.length,old.storage.geometryRecords.length);
  const changed=[];for(let i=0;i<old.storage.geometryRecords.length;i++){
    const a=next.storage.geometryRecords[i],b=old.storage.geometryRecords[i];if(a.indexed!==b.indexed){assert.equal(a.indexed,true);changed.push({name:a.name,beforeBytes:b.storedBytes,afterBytes:a.storedBytes,savedBytes:b.storedBytes-a.storedBytes});}else assert.deepEqual(a,b,`unchanged architecture ${a.name}`);
  }
  assert.ok(changed.length>0);assert.ok(next.storage.bytes<old.storage.bytes);
  const proof={scope:'Real near silver/cherry GLB geometry; all six authored districts, planted edges, thresholds, lamps, actual rendered terrain sampler and production road samples. No full world construction, image decode or renderer.',orderedDrawSha256:createHash('sha256').update(JSON.stringify(next.draw)).digest('hex'),nodes:next.draw.nodes.length,triangles:next.draw.triangles,meshCount:next.storage.geometryRecords.length,beforeBytes:old.storage.bytes,afterBytes:next.storage.bytes,savedBytes:old.storage.bytes-next.storage.bytes,changed};
  console.log('GARDEN_INDEX_PROOF '+JSON.stringify(proof));if(process.env.GARDEN_INDEX_EVIDENCE)await writeFile(process.env.GARDEN_INDEX_EVIDENCE,JSON.stringify({...proof,draw:next.draw,before:old.storage,after:next.storage},null,2)+'\n');
});
