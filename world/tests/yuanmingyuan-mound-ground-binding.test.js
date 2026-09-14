import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {moundGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {createMoundGroundMaterialBinding} from '../src/yuanmingyuan/mound-ground-material-binding.js';

const groupName='xianfashan-complete-earth-mound',materialName='xianfashan-compact-earth-and-moss';
const bytes=a=>a?Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength):null;
const digest=g=>createHash('sha256').update(Buffer.concat([g.index,...Object.values(g.attributes)].filter(Boolean).map(bytes))).digest('hex');
function fixture({indexed=false}={}){
  const root=new THREE.Group(),mound=new THREE.Group();mound.name=groupName;root.add(mound);
  let geometry=moundGeometry(8);if(!indexed){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});material.name=materialName;material.userData.category='terrain';
  const mesh=new THREE.Mesh(geometry,material);mesh.name=groupName+'/'+materialName;mesh.castShadow=mesh.receiveShadow=true;mesh.layers.set(3);mesh.renderOrder=7;mound.add(mesh);
  const texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),earthMaterial=new THREE.MeshStandardMaterial({vertexColors:true,map:texture,roughness:.98});texture.repeat.setScalar(5/6);
  let disposed=false,queries=0;const targets=new Set();
  const terrain={earthMaterial,colorAt(x,y,z,target=new THREE.Color()){queries++;targets.add(target);return target.setRGB(.3+x*.00001,.4+y*.00001,.2+z*.00001);},get disposed(){return disposed;}};
  const resource={group:root,get disposed(){return disposed;}};
  return {root,mound,mesh,geometry,material,texture,terrain,resource,targets,get queries(){return queries;},dispose(){disposed=true;geometry.dispose();material.dispose();earthMaterial.dispose();texture.dispose();root.clear();}};
}
const bind=f=>createMoundGroundMaterialBinding({assetId:'xianfashan',resource:f.resource,terrain:f.terrain});
function verifyMapping(f){
  const clone=f.mesh.geometry,p=f.geometry.attributes.position,uv=clone.attributes.uv,c=clone.attributes.color,point=new THREE.Vector3(),sample=new THREE.Color();f.mesh.updateWorldMatrix(true,false);
  for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(f.mesh.matrixWorld);f.terrain.colorAt(point.x,point.y,point.z,sample);
    assert.equal(uv.getX(i),Math.fround(point.x*.08));assert.equal(uv.getY(i),Math.fround(point.z*.08));
    assert.equal(c.getX(i),Math.fround(sample.r));assert.equal(c.getY(i),Math.fround(sample.g));assert.equal(c.getZ(i),Math.fround(sample.b));
  }
}

test('real mound display keeps every position/index and source byte while matching placed world UV and color',()=>{
  for(const indexed of [false,true]){
    const f=fixture({indexed}),before=digest(f.geometry),parent=new THREE.Group();parent.position.set(19,2,-27);parent.rotation.y=.17;parent.add(f.root);f.root.position.set(925,4,-640);f.root.rotation.y=.31;f.root.scale.set(1.2,.8,-.9);
    f.geometry.addGroup(0,12,0);f.geometry.setDrawRange(3,21);const flags={cast:f.mesh.castShadow,receive:f.mesh.receiveShadow,layers:f.mesh.layers.mask,order:f.mesh.renderOrder};let owner;
    try{
      owner=bind(f);const clone=f.mesh.geometry;assert.notEqual(clone,f.geometry);assert.equal(f.mesh.material,f.terrain.earthMaterial);assert.equal(f.targets.size,1,'stable Color target is reused for mapping');
      for(const key of ['position','normal'])assert.notEqual(clone.attributes[key].array,f.geometry.attributes[key].array);
      assert.deepEqual(bytes(clone.attributes.position),bytes(f.geometry.attributes.position));assert.notDeepEqual(bytes(clone.attributes.normal),bytes(f.geometry.attributes.normal));assert(owner.snapshot.boundaryNormalRepair.correctedVertices>0);
      assert.deepEqual(bytes(clone.index),bytes(f.geometry.index));assert.deepEqual(clone.groups,f.geometry.groups);assert.deepEqual(clone.drawRange,f.geometry.drawRange);assert.equal(clone.attributes.position.count,f.geometry.attributes.position.count);assert.equal(digest(f.geometry),before);
      verifyMapping(f);assert.deepEqual({cast:f.mesh.castShadow,receive:f.mesh.receiveShadow,layers:f.mesh.layers.mask,order:f.mesh.renderOrder},flags);
    }finally{owner?.dispose();assert.equal(f.mesh.geometry,f.geometry);assert.equal(f.mesh.material,f.material);f.dispose();parent.clear();}
  }
});

test('refresh follows a placed parent transform and reuses GPU attribute objects; material map updates are borrowed live',()=>{
  const f=fixture();let owner;try{
    owner=bind(f);const g=f.mesh.geometry,uv=g.attributes.uv,c=g.attributes.color,position=g.attributes.position,normal=g.attributes.normal,queries=f.queries;
    assert.equal(owner.refresh(),false);assert.equal(f.queries,queries);
    f.root.position.set(14,3,-11);f.root.rotation.y=.8;assert.equal(owner.refresh(),true);verifyMapping(f);
    assert.equal(f.mesh.geometry,g);assert.equal(g.attributes.uv,uv);assert.equal(g.attributes.color,c);assert.equal(g.attributes.position,position);assert.equal(g.attributes.normal,normal);assert.equal(uv.version,1);assert.equal(c.version,1);
    const next=new THREE.Texture();f.terrain.earthMaterial.map=next;assert.equal(f.mesh.material.map,next);next.dispose();
  }finally{owner?.dispose();f.dispose();}
});

test('dispose restores original fields before releasing only its clone, never borrowed terrain material/maps',()=>{
  const f=fixture(),counts={clone:0,source:0,material:0,earth:0,texture:0};let owner;
  try{
    f.geometry.addEventListener('dispose',()=>counts.source++);f.material.addEventListener('dispose',()=>counts.material++);f.terrain.earthMaterial.addEventListener('dispose',()=>counts.earth++);f.texture.addEventListener('dispose',()=>counts.texture++);
    owner=bind(f);f.mesh.geometry.addEventListener('dispose',()=>{counts.clone++;assert.equal(f.mesh.geometry,f.geometry);assert.equal(f.mesh.material,f.material);});
    owner.dispose();owner.dispose();assert.deepEqual(counts,{clone:1,source:0,material:0,earth:0,texture:0});assert.equal(owner.disposed,true);assert.throws(()=>owner.refresh(),/disposed/);
  }finally{owner?.dispose();f.dispose();}
});

test('abort before or during staged mapping leaves original source and disposes any staging clone',()=>{
  for(const during of [false,true]){
    const f=fixture(),controller=new AbortController();let clones=0,released=0;const clone=f.geometry.clone.bind(f.geometry);f.geometry.clone=()=>{clones++;const g=clone();g.addEventListener('dispose',()=>released++);return g;};
    if(during){const colorAt=f.terrain.colorAt;f.terrain.colorAt=(...args)=>{controller.abort();return colorAt(...args);};}else controller.abort();
    try{assert.throws(()=>createMoundGroundMaterialBinding({assetId:'xianfashan',resource:f.resource,terrain:f.terrain,signal:controller.signal}),{name:'AbortError'});assert.equal(f.mesh.geometry,f.geometry);assert.equal(f.mesh.material,f.material);assert.equal(clones,during?1:0);assert.equal(released,clones);}finally{f.dispose();}
  }
});

test('active abort or source resource disposal cleans the display clone without taking ownership of earth',()=>{
  for(const reason of ['abort','geometry','material','earth']){
    const f=fixture(),controller=new AbortController();let owner,released=0;
    try{
      owner=createMoundGroundMaterialBinding({assetId:'xianfashan',resource:f.resource,terrain:f.terrain,signal:controller.signal});f.mesh.geometry.addEventListener('dispose',()=>released++);
      if(reason==='abort')controller.abort();else (reason==='earth'?f.terrain.earthMaterial:f[reason]).dispose();
      assert.equal(released,1);assert.equal(owner.disposed,true);assert.equal(f.mesh.geometry,f.geometry);assert.equal(f.mesh.material,f.material);
    }finally{owner?.dispose();f.dispose();}
  }
});

test('primary and resident owners bind independently and a duplicate or hidden collision-only root cannot be certified',()=>{
  const a=fixture(),b=fixture();let first,second;try{
    first=bind(a);second=createMoundGroundMaterialBinding({assetId:'xianfashan',resource:b.resource,terrain:a.terrain});assert.notEqual(a.mesh.geometry,b.mesh.geometry);assert.throws(()=>bind(a),/original soil|active ground/);
    const renderOnly=new THREE.Group();assert.throws(()=>createMoundGroundMaterialBinding({assetId:'xianfashan',resource:{group:renderOnly,collisionGroup:a.root,namedGroupRoot:a.root},terrain:a.terrain}),/rendered.*group/);
    first.dispose();a.geometry.dispose();a.material.dispose();assert.equal(second.disposed,false);assert.equal(b.mesh.material,a.terrain.earthMaterial);
  }finally{first?.dispose();second?.dispose();a.dispose();b.dispose();}
});

test('invalid source identity, ambiguous groups, unsafe transforms and bad colors fail without installing a binding',()=>{
  const f=fixture();try{
    assert.throws(()=>createMoundGroundMaterialBinding({assetId:'fanghe-xianfahua',resource:f.resource,terrain:f.terrain}),/Xianfashan/);
    const duplicate=new THREE.Group();duplicate.name=groupName;f.root.add(duplicate);assert.throws(()=>bind(f),/exactly one/);duplicate.removeFromParent();
    f.mesh.matrixAutoUpdate=false;f.mesh.matrix.elements[3]=.001;f.mesh.matrixWorldNeedsUpdate=true;assert.throws(()=>bind(f),/affine/);f.mesh.matrix.identity();f.mesh.matrixWorldNeedsUpdate=true;
    const sample=f.terrain.colorAt;f.terrain.colorAt=()=>({r:1,g:0,b:0});assert.throws(()=>bind(f),/invalid color/);f.terrain.colorAt=sample;
    assert.equal(f.mesh.geometry,f.geometry);assert.equal(f.mesh.material,f.material);const good=bind(f);good.dispose();
  }finally{f.dispose();}
});

test('read-only terrain colorAt exactly reproduces the built vertex field, supports a stable target and rejects expired owners',()=>{
  const layout={id:'small-color-field',exhibition:{groundY:4,seaY:0,coast:{polygon:[[0,0],[40,0],[40,40],[0,40]]}},gardens:[],waterBodies:[],ornamentalWaters:[],channels:[],islands:[],landforms:[],bridges:[]};
  const terrain=createGardenTerrain({layout}),g=terrain.group.getObjectByName('yuanming-continuous-land').geometry,before=digest(g),target=new THREE.Color();
  try{
    const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++){assert.equal(terrain.colorAt(p.getX(i),p.getY(i),p.getZ(i),target),target);assert.deepEqual(target.toArray().map(Math.fround),[c.getX(i),c.getY(i),c.getZ(i)]);}
    const a=terrain.colorAt(10,4,10),b=terrain.colorAt(10,4,10);assert.notEqual(a,b);a.set(0);assert.notDeepEqual(a.toArray(),b.toArray());assert.equal(digest(g),before);
    assert.throws(()=>terrain.colorAt(NaN,4,0),/finite/);assert.throws(()=>terrain.colorAt(0,4,0,{}),/Color/);
  }finally{terrain.dispose();}assert.throws(()=>terrain.colorAt(0,4,0),/disposed/);
});
