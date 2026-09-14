import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {namedGroup,V} from '../src/yuanmingyuan/study-geometry.js';
import {ringGeometry} from '../src/yuanmingyuan/yuanyingguan-geometry.js';
import {sampleStoneFishSurface} from '../src/yuanmingyuan/xieqiqu-fish-surface.js';
import {xieqiquStoneFishPlacements} from '../src/yuanmingyuan/xieqiqu-study.js';
import {createStoneFishBellySeat,createXieqiquStoneFishPoolFromSource,createXieqiquStoneFishPoolStudy} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-study.js';
import {stoneFishPoolStudyViews} from '../src/yuanmingyuan/xieqiqu-stone-fish-pool-views.js';

const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const proof=g=>Object.fromEntries([['index',g.index],...Object.entries(g.attributes)].map(([key,a])=>[key,hash(a.array)]));
// A bounded patch of the existing real parametric skin, not a full fish. The
// other five boxes exercise sharing/ownership only and are never visual assets.
function bellyPatch(){
  const rows=96,sides=64,positions=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=sides;j++){const p=sampleStoneFishSurface(.20+i/rows*.40,Math.PI+.36+j/sides*(Math.PI-.72)).position;positions.push(...p.toArray());uv.push(i/rows,j/sides);}
  for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+1,d=a+sides+1,c=d+1;indices.push(a,d,b,b,d,c);}
  const g=new THREE.BufferGeometry();g.name='bounded-real-fish-belly-fixture';g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.userData={partialAuthoringFixture:true,bellySamplingGrid:{firstVertex:0,stride:sides+1,rowCount:rows+1,columnCount:sides+1,quadColumns:sides,firstTriangle:0,tStart:.20,tStep:.40/rows,angleStart:Math.PI+.36,angleStep:(Math.PI-.72)/sides}};return g;
}
function sourceFixture(){
  const body=bellyPatch(),group=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometries=[body,...Array.from({length:5},(_,i)=>new THREE.BoxGeometry(.01,.01,.01).translate(0,.8+i*.01,0))],events=[];let disposed=false;
  geometries.forEach((g,i)=>{const node=new THREE.Mesh(g,material);node.userData.body=i===0?'continuous-body':i<4?'part-'+i:'eye-'+i;group.add(node);g.addEventListener('dispose',()=>events.push(g));});
  return {group,geometries,material,events,diagnostics:{partialFixture:true},get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());material.dispose();group.clear();}};
}
function textureFixture(){
  const maps=Object.fromEntries(['color','normal','roughness'].map(c=>[c,new THREE.DataTexture(new Uint8Array(16).fill(160),2,2,THREE.RGBAFormat)])),events=[];let disposed=false;
  Object.values(maps).forEach(t=>t.addEventListener('dispose',()=>events.push(t)));
  return {maps,events,fullResolutionVerified:false,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;Object.values(maps).forEach(t=>{t.dispose();t.image=null;});}};
}
function geometricTopology(g){
  const p=g.attributes.position,keys=new Map(),welded=[],edges=new Map();let volume=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',');if(!keys.has(key))keys.set(key,keys.size);welded.push(keys.get(key));}
  for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);volume+=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
    ids.forEach((id,j)=>{const x=welded[id],y=welded[ids[(j+1)%3]],key=x<y?`${x}:${y}`:`${y}:${x}`;if(!edges.has(key))edges.set(key,[]);edges.get(key).push([x,y]);});}
  return {volume,badEdges:[...edges.values()].filter(e=>e.length!==2||e[0][0]!==e[1][1]||e[0][1]!==e[1][0]).length};
}

test('actual belly triangles form a closed seat; independent rays measure millimetre contact without changing the fish',()=>{
  const source=bellyPatch(),before=proof(source),seat=createStoneFishBellySeat(source),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  try{
    const topology=geometricTopology(seat.geometry);assert.equal(topology.badEdges,0);assert(topology.volume>0);
    const body=new THREE.Mesh(source,material),stone=new THREE.Mesh(seat.geometry,material);body.updateMatrixWorld();stone.updateMatrixWorld();
    for(const z of [-.08,.08,.25,.44]){const ray=new THREE.Raycaster(new THREE.Vector3(0,2,z),new THREE.Vector3(0,-1,0)),a=ray.intersectObject(body)[0],b=ray.intersectObject(stone)[0];assert(a&&b);assert(Math.abs(b.point.y-a.point.y-.003)<2e-7);}
    assert.deepEqual(proof(source),before);assert(seat.validate().minimumEmbedding>.0029998);
    seat.geometry.attributes.position.setY(0,seat.geometry.attributes.position.getY(0)-.006);assert.throws(seat.validate,/skin contact/);assert.deepEqual(proof(source),before);
  }finally{seat.dispose();source.dispose();material.dispose();}
});

test('four placed fish share original geometry and maps, with independent material uniforms and real mouth/water anchors',()=>{
  const source=sourceFixture(),textures=textureFixture(),before=source.geometries.map(proof),owner=createXieqiquStoneFishPoolFromSource({sourceOwner:source,textureOwner:textures});
  try{
    assert.equal(owner.fishViews.length,4);assert.equal(owner.diagnostics.resourceOwnership.fishMaterials,8);assert.equal(owner.diagnostics.fullResolutionVerified,false);
    assert.deepEqual(owner.diagnostics.bindings.map(b=>b.position),xieqiquStoneFishPlacements.map(b=>[...b.position]));
    const camera=new THREE.PerspectiveCamera(40,1,.04,1200);camera.position.set(21,7,34);camera.lookAt(0,1,26);camera.updateMatrixWorld();
    const uniforms=[];
    for(const [i,view] of owner.fishViews.entries()){
      view.group.children.forEach((mesh,k)=>{assert.equal(mesh.geometry,source.geometries[k]);assert.equal(mesh.material.map,textures.maps.color);assert.equal(mesh.material.normalMap,textures.maps.normal);assert.equal(mesh.material.roughnessMap,textures.maps.roughness);});
      const mesh=view.group.children[0],shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};mesh.material.onBeforeCompile(shader);mesh.onBeforeRender(null,null,camera,mesh.geometry,mesh.material);uniforms.push(shader.uniforms);
      const frame=shader.uniforms.fishAssetToMetric.value,v=new THREE.Vector3(1,0,0).applyMatrix4(frame);assert(Math.abs(v.length()-xieqiquStoneFishPlacements[i].size)<1e-12);
      assert.deepEqual(owner.diagnostics.bindings[i].mouth,owner.diagnostics.bindings[i].jetStart);assert(Math.abs(owner.diagnostics.bindings[i].landing[1]-.13)<1e-12);assert(owner.diagnostics.bindings[i].minimumWaveClearance>=.024999);
    }
    assert.equal(new Set(uniforms.map(u=>u.fishAssetToMetric)).size,4);assert.notDeepEqual(uniforms[0].fishMetricNormalToView.value.elements,uniforms[1].fishMetricNormalToView.value.elements);
    const pool=owner.context.group.getObjectByName('xieqiqu-south-haitang-pool'),sheet=pool.children.find(n=>n.material.userData.role==='surface'),court=owner.context.group.getObjectByName('xieqiqu-south-pool-cropped-court');
    for(const binding of owner.diagnostics.bindings){const [x,y,z]=binding.landing,hit=new THREE.Raycaster(new THREE.Vector3(x,y+1,z),new THREE.Vector3(0,-1,0)).intersectObject(sheet)[0];assert(hit&&Math.abs(hit.point.y-y)<1e-7,'the landing reaches the actual water triangles');}
    assert.equal(new THREE.Raycaster(new THREE.Vector3(0,1,26),new THREE.Vector3(0,-1,0)).intersectObject(court,true).length,0,'paving does not fill the pool void');
    for(const spec of Object.values(stoneFishPoolStudyViews)){for(const name of spec.groups)assert(owner.group.getObjectByName(name));if(spec.orientationGroup)assert(owner.group.getObjectByName(spec.orientationGroup));assert(spec.direction.every(Number.isFinite));}
    const water=owner.context.group.getObjectByName('xieqiqu-south-upturned-stone-fish-1-water').children.find(n=>n.material.userData.role==='flow'),offset=water.material.alphaMap.offset.clone();owner.update(.37);assert.notDeepEqual(water.material.alphaMap.offset.toArray(),offset.toArray());
    assert.deepEqual(source.geometries.map(proof),before);assert.deepEqual(textures.events,[]);
  }finally{owner.dispose();owner.dispose();assert.equal(source.events.length,0);assert.equal(textures.events.length,0);source.dispose();textures.dispose();}
});

test('transferred owners release eight materials, six source geometries and three maps exactly once',()=>{
  const source=sourceFixture(),textures=textureFixture(),owner=createXieqiquStoneFishPoolFromSource({sourceOwner:source,textureOwner:textures,ownsSource:true,ownsTextures:true}),materials=new Set(owner.fishViews.flatMap(v=>v.group.children.map(m=>m.material))),events=[];
  for(const m of materials)m.addEventListener('dispose',()=>events.push(m));owner.dispose();owner.dispose();
  assert.equal(events.length,8);assert.equal(new Set(events).size,8);assert.equal(source.events.length,6);assert.equal(textures.events.length,3);assert.equal(owner.group.children.length,0);
});

test('borrowed resource invalidation and abort reject without taking foreign ownership',()=>{
  const source=sourceFixture(),textures=textureFixture(),controller=new AbortController();controller.abort();
  try{
    assert.throws(()=>createXieqiquStoneFishPoolFromSource({sourceOwner:source,textureOwner:textures,signal:controller.signal}),{name:'AbortError'});assert.equal(source.events.length,0);assert.equal(textures.events.length,0);
    const owner=createXieqiquStoneFishPoolFromSource({sourceOwner:source,textureOwner:textures});try{textures.maps.normal.dispose();assert.equal(owner.invalidated,true);assert.equal(owner.group.visible,false);}finally{owner.dispose();}
    assert.equal(source.events.length,0);assert.equal(textures.events.length,1);
    assert.throws(()=>createXieqiquStoneFishPoolStudy({pixels:{}}),/full 4K marble prepare/);
  }finally{source.dispose();textures.dispose();}
});

test('a material disposal exception still releases the remaining owned resources and keeps disposal idempotent',()=>{
  const source=sourceFixture(),textures=textureFixture(),owner=createXieqiquStoneFishPoolFromSource({sourceOwner:source,textureOwner:textures,ownsSource:true,ownsTextures:true}),materials=new Set(owner.fishViews.flatMap(v=>v.group.children.map(m=>m.material))),events=[];
  for(const m of materials)m.addEventListener('dispose',()=>events.push(m));[...materials][2].addEventListener('dispose',()=>{throw new Error('fixture disposal failure');});
  assert.throws(()=>owner.dispose(),AggregateError);assert.equal(events.length,8);assert.equal(source.events.length,6);assert.equal(textures.events.length,3);assert.equal(owner.group.children.length,0);owner.dispose();assert.equal(events.length,8);
});

test('extracting the mount preserves every legacy fish builder input and scene transform',async()=>{
  const old=await readFile(new URL('../../work/yuanmingyuan/xieqiqu-stone-fish-pool-r1/before/world/src/yuanmingyuan/xieqiqu-study.js',import.meta.url),'utf8'),current=await readFile(new URL('../src/yuanmingyuan/xieqiqu-study.js',import.meta.url),'utf8');
  const oldBody=old.slice(old.indexOf('function stoneFish('),old.indexOf('function copperSheep(')),newBody=current.slice(current.indexOf('function stoneFish('),current.indexOf('export const xieqiquStoneFishPlacements'));
  function trace(body,p){
    const calls=[],materials=Object.fromEntries(['carving','oldStone','wetStone'].map(k=>[k,k])),clean=x=>x?.isVector3?x.toArray():x instanceof THREE.Shape?x.getPoints().map(p=>p.toArray()):x?.isBufferGeometry?{position:hash(x.attributes.position.array),index:x.index?hash(x.index.array):null}:x;
    const b={m:materials};for(const method of ['loft','add','shape','leaf','box','sweep','waterArc'])b[method]=(parent,...args)=>{calls.push({method,parent:parent.name,args:args.map(clean)});if(method==='add'&&args[0]?.isBufferGeometry)args[0].dispose();};
    const fn=runInNewContext(body+'\nstoneFish',{THREE,namedGroup,V,ringGeometry,sculptureEyes:()=>{}}),root=new THREE.Group(),result=fn(b,root,p.index,p.position,p.rotationY,p.size);result.updateMatrix();return structuredClone({calls,matrix:result.matrix.toArray(),names:result.children.map(n=>n.name)});
  }
  for(const p of xieqiquStoneFishPlacements)assert.deepEqual(trace(newBody,p),trace(oldBody,p));
});
