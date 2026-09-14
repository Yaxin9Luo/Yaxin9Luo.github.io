import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createPreparedFixture} from '../../work/yuanmingyuan/xianfa-shore-community-r2/prepared-fixture.mjs';
import {createXianfaShoreCommunityPrepared,parseXianfaShorePrepared} from '../src/yuanmingyuan/xianfa-shore-community-prepared.js';
import {shoreSHA256,shoreObjectSHA,shoreTerrainSignatureData} from '../src/yuanmingyuan/xianfa-shore-community-prepared-signature.js';
import {xianfaShorePreparedData} from '../src/yuanmingyuan/xianfa-shore-community-prepared-data.js';

const options=(f,prepared,extra={})=>({terrain:f.terrain,plantingPilot:f.pilot,understoryOwner:f.understoryOwner,layout:f.layout,garden:f.garden,readSource:f.readSource,prepared,...extra});
test('actual tiny source factory and prepared view have identical buffers, vertices, normals, collision poses and borrowed ownership',async()=>{
  const f=await createPreparedFixture();let result;try{
    const before=f.queryCount;result=await createXianfaShoreCommunityPrepared(options(f,await f.parse()));
    assert.equal(f.queryCount-before,10);assert.equal(result.diagnostics.preparedVerification.foliageQueries,0);assert.equal(result.diagnostics.trianglesPerPass,f.author.diagnostics.trianglesPerPass);assert.equal(result.bindings.length,6);
    for(const binding of result.bindings){const original=f.author.bindings.find(b=>b.placementId===binding.placementId&&b.sourceMesh===binding.sourceMesh);assert.ok(original);assert.equal(binding.drawMesh.geometry,original.drawMesh.geometry);assert.equal(binding.drawMesh.material,original.drawMesh.material);assert.deepEqual(binding.matrix.toArray(),original.matrix.toArray());
      const p=binding.sourceMesh.geometry.attributes.position,n=binding.sourceMesh.geometry.attributes.normal,a=new THREE.Matrix4().multiplyMatrices(binding.drawMesh.matrixWorld,binding.matrix),b=new THREE.Matrix4().multiplyMatrices(original.drawMesh.matrixWorld,original.matrix),an=new THREE.Matrix3().getNormalMatrix(a),bn=new THREE.Matrix3().getNormalMatrix(b);
      for(let i=0;i<p.count;i++){assert.deepEqual(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(a).toArray(),new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(b).toArray());assert.deepEqual(new THREE.Vector3().fromBufferAttribute(n,i).applyNormalMatrix(an).toArray(),new THREE.Vector3().fromBufferAttribute(n,i).applyNormalMatrix(bn).toArray());}
    }
    for(const part of result.collisionSources.parts){const original=f.author.collisionSources.parts.find(p=>p.userData.placementId===part.userData.placementId);assert.equal(part.children[0].geometry,original.children[0].geometry);assert.deepEqual(part.children[0].matrixWorld.toArray(),original.children[0].matrixWorld.toArray());}
    assert.equal(result.collisionSources.group.parent,null);assert.ok(result.contextGroups.every(p=>p.parent===f.pilot.group));let ownedDisposed=0,borrowedDisposed=0;for(const n of result.group.children)n.addEventListener('dispose',()=>ownedDisposed++);for(const r of [...f.geometries,...f.materials])r.addEventListener('dispose',()=>borrowedDisposed++);
    result.dispose();result.dispose();assert.equal(ownedDisposed,6);assert.equal(borrowedDisposed,0);assert.equal(f.understoryOwner.group.children.length,3);assert.equal(f.pilot.group.children.length,4);
  }finally{result?.dispose();f.dispose();}
});

test('manifest and binary admission pins bytes, freezes metadata and catches a later packed-byte mutation',async()=>{
  const f=await createPreparedFixture();try{const prepared=await f.parse();assert.ok(Object.isFrozen(prepared.manifest.draws));assert.throws(()=>{prepared.manifest.draws[0].count=0;},TypeError);
    const bad=f.binary.slice();bad[0]^=1;await assert.rejects(f.parse(f.manifest,bad),/binding byte\/hash mismatch/);
    prepared.binary[0]^=1;await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/binding bytes changed/);
  }finally{f.dispose();}
});

test('changed layout and raw sampler/source identity reject without creating views',async()=>{
  const f=await createPreparedFixture();try{const prepared=await f.parse(),layout=structuredClone(f.layout);layout.placements[0].scale+=.001;
    await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared,{layout})),/layout differs/);
    await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared,{readSource:async()=> 'changed sampler'})),/source file changed/);
  }finally{f.dispose();}
});

test('changed source UV and material response reject, including a hidden extra nested source mesh',async()=>{
  const f=await createPreparedFixture();try{const prepared=await f.parse(),g=f.geometries[0],old=g.attributes.uv.array[0];g.attributes.uv.array[0]+=.125;
    await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/source attribute changed/);g.attributes.uv.array[0]=old;
    f.materials[0].roughness+=.01;await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/material state changed/);f.materials[0].roughness-=.01;
    const extra=new THREE.Mesh(g,f.materials[0]);extra.visible=false;f.understoryOwner.parts[1].children[0].add(extra);await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/extra or missing source meshes/);extra.removeFromParent();
  }finally{f.dispose();}
});

test('an omitted, duplicated or reassigned binding never silently produces a partial community',async()=>{
  const f=await createPreparedFixture();try{
    const omitted=structuredClone(f.manifest);omitted.bindings.pop();await assert.rejects(createXianfaShoreCommunityPrepared(options(f,await f.parse(omitted))),/missing complete placement/);
    const duplicate=structuredClone(f.manifest);duplicate.bindings.push(duplicate.bindings[0]);await assert.rejects(createXianfaShoreCommunityPrepared(options(f,await f.parse(duplicate))),/duplicate binding/);
    const assigned=structuredClone(f.manifest);assigned.bindings[0].placementId=f.layout.placements.find(p=>p.species==='fern').id;await assert.rejects(createXianfaShoreCommunityPrepared(options(f,await f.parse(assigned))),/wrong source\/placement/);
  }finally{f.dispose();}
});

test('entire terrain faces and ordering are checked; unchanged probes cannot hide a new unprobed support',async()=>{
  const f=await createPreparedFixture();let added;try{const prepared=await f.parse();
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([835,4.2,-588,835,4.2,-587,836,4.2,-588],3));g.computeVertexNormals();added=new THREE.Mesh(g,new THREE.MeshStandardMaterial());added.name='intruding-support';added.userData.body='land';f.terrain.group.add(added);f.terrain.group.updateMatrixWorld(true);
    await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/complete live terrain support\/facts changed/);
  }finally{added?.geometry.dispose();added?.material.dispose();f.dispose();}
});

test('terrain colour/UV and transient UUID changes are not mistaken for changed sampler facts',async()=>{
  const f=await createPreparedFixture();let result;try{const prepared=await f.parse();f.land.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(f.land.geometry.attributes.position.count*3).fill(.3),3));f.land.geometry.attributes.uv.array[0]=.72;f.land.geometry.uuid='another-runtime-uuid';f.land.uuid='another-node-uuid';f.terrain.group.uuid='another-owner-uuid';
    result=await createXianfaShoreCommunityPrepared(options(f,prepared));assert.equal(result.bindings.length,6);
  }finally{result?.dispose();f.dispose();}
});

test('active new support state rejects; original terrain is required before explicit shoreline activation',async()=>{
  const f=await createPreparedFixture();try{const prepared=await f.parse();f.terrain.replacementStates.push({id:'new-shore-bank',active:true,revision:1,bounds:{minX:831,maxX:850,minZ:-585,maxZ:-580}});await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/unsupported active replacement support/);}finally{f.dispose();}
});

test('changed retained context matrix and nested source pose reject rather than reuse an old Y',async()=>{
  const f=await createPreparedFixture();try{const prepared=await f.parse();f.pilot.parts[0].position.x+=.001;f.pilot.group.updateMatrixWorld(true);await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/context world matrix changed/);f.pilot.parts[0].position.x-=.001;f.pilot.group.updateMatrixWorld(true);
    f.understoryOwner.parts[1].children[0].rotation.y+=.01;f.understoryOwner.group.updateMatrixWorld(true);await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/source local transform changed/);
  }finally{f.dispose();}
});

test('abort and a late callback exception dispose all new instance views but leave source owners alive',async()=>{
  const f=await createPreparedFixture();try{const prepared=await f.parse(),controller=new AbortController();controller.abort(new Error('stop requested'));await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared,{signal:controller.signal})),/stop requested/);
    const original=THREE.InstancedMesh.prototype.dispose;let removed=0;THREE.InstancedMesh.prototype.dispose=function(){removed++;return original.call(this);};
    try{await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared,{onProgress:row=>{if(row.phase==='prepared-ready')throw new Error('late callback');}})),/late callback/);assert.equal(removed,6);}finally{THREE.InstancedMesh.prototype.dispose=original;}
    assert.equal(f.understoryOwner.group.children.length,3);assert.equal(f.pilot.group.children.length,4);
  }finally{f.dispose();}
});

test('source disposal invalidates an admitted owner and releases its listener hooks on idempotent disposal',async()=>{
  const f=await createPreparedFixture();let result;try{result=await createXianfaShoreCommunityPrepared(options(f,await f.parse()));f.materials[0].dispose();assert.equal(result.diagnostics.borrowedSourceInvalidated,true);assert.equal(result.group.visible,false);result.dispose();result.dispose();assert.equal(result.disposed,true);}finally{result?.dispose();f.dispose();}
});

test('equal-looking duplicate source buffers and a mid-verification matrix mutation are refused',async()=>{
  const f=await createPreparedFixture();let clone;try{const prepared=await f.parse(),node=f.understoryOwner.parts[1].children[0].children[0],original=node.geometry;clone=original.clone();node.geometry=clone;
    await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared)),/source geometry sharing split/);node.geometry=original;
    await assert.rejects(createXianfaShoreCommunityPrepared(options(f,prepared,{onProgress:row=>{if(row.phase==='verify-live-terrain')prepared.binary[0]^=1;}})),/binding bytes changed during verification/);
  }finally{clone?.dispose();f.dispose();}
});

test('actual 618-binding production bundle parses and independently matches all frozen raw sources and snapshot facts without source factories',async()=>{
  const root=new URL('../../',import.meta.url),manifestBytes=fs.readFileSync(new URL('world/public'+xianfaShorePreparedData.manifestURL,root)),binary=fs.readFileSync(new URL('world/public'+xianfaShorePreparedData.binaryURL,root));
  const prepared=await parseXianfaShorePrepared({manifestBytes,binary,expectedManifestSHA256:xianfaShorePreparedData.manifestSHA256}),m=prepared.manifest;
  assert.equal(m.bindings.length,618);assert.equal(m.draws.length,190);assert.equal(m.sources.length,92);assert.equal(binary.byteLength,39552);assert.equal(m.diagnostics.trianglesPerPass,24963064);
  for(const f of m.sourceFiles)assert.equal(await shoreSHA256(fs.readFileSync(new URL(f.path,root))),f.sha256,f.path);
  const snapshot=JSON.parse(fs.readFileSync(new URL(m.terrain.snapshot.path,root)));assert.equal(await shoreObjectSHA(shoreTerrainSignatureData(snapshot)),m.terrain.sha256);
  const occupied=new Set();for(const b of m.bindings){const key=b.draw+':'+b.instance;assert.ok(!occupied.has(key));occupied.add(key);const d=m.draws[b.draw],values=new DataView(binary.buffer,binary.byteOffset+d.byteOffset+b.instance*64,64),matrix=new THREE.Matrix4();for(let i=0;i<16;i++)matrix.elements[i]=values.getFloat32(i*4,true);assert.ok(matrix.elements.every(Number.isFinite)&&matrix.determinant()>0);}
  assert.equal(occupied.size,m.draws.reduce((n,d)=>n+d.count,0));
});
