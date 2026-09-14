import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ZhengjuesiBuilder} from '../src/yuanmingyuan/zhengjuesi-architecture.js';
import {yuanmingyuanExportFactories,captureYuanmingyuanState,serializeYuanmingyuanArchive} from '../scripts/export-yuanmingyuan-assets.mjs';
import {restoreYuanmingyuanArchive} from '../src/yuanmingyuan/asset-archive.js';

test('single-ID export selects the full Zhengjuesi factory without instantiating it',async()=>{
  assert.deepEqual(yuanmingyuanExportFactories.zhengjuesi,['zhengjuesi-study.js','createZhengjuesiStudy']);
  const module=await import('../src/yuanmingyuan/zhengjuesi-study.js');assert.equal(typeof module.createZhengjuesiStudy,'function');
});

test('actual Zhengjuesi builder retains all seven authored textures, matrices, colours, indices and shared prototypes through archive restore',async t=>{
  const b=new ZhengjuesiBuilder(),group=new THREE.Group(),other=new THREE.Group();group.name='small Zhengjuesi archive contract';other.name='another parent sharing the prototype';group.add(other);
  t.after(()=>{b.dispose();group.clear();});
  for(const [i,material] of Object.values(b.m).entries())b.box(group,material,[i*.7,0,0],[.2,.4,.3],[.1,.2,.3],new THREE.Color(.61,.72,.83));
  b.box(group,b.m.red,[1,2,3],[.25,.41,.17],[.12,.23,.34],new THREE.Color(.38,.27,.19));
  b.box(other,b.m.red,[-3,1,2],[.31,.27,.52],[-.11,.31,.17],new THREE.Color(.28,.49,.67));b.flush();
  const asset={group,diagnostics:{scope:'small real builder fixture; no temple factory'},dispose:()=>{b.dispose();group.clear();}};
  group.updateMatrixWorld(true);const original=captureYuanmingyuanState(asset).state;
  assert.equal(original.textures.length,7);assert.equal(original.geometries.length,1);
  const archive=await serializeYuanmingyuanArchive(asset,{id:'zhengjuesi-fixture'}),restored=await restoreYuanmingyuanArchive(archive.glb,archive.metadata,{yieldControl:()=>Promise.resolve()});t.after(restored.dispose);
  assert.deepEqual(captureYuanmingyuanState(restored).state,original);
  const meshes=[];restored.group.traverse(node=>{if(node.isMesh)meshes.push(node);});
  assert.ok(meshes.every(mesh=>mesh.isInstancedMesh));assert.equal(meshes.reduce((sum,mesh)=>sum+mesh.count,0),18);
  assert.equal(new Set(meshes.map(mesh=>mesh.geometry)).size,1);assert.ok(meshes.every(mesh=>mesh.geometry.index?.array instanceof Uint16Array));
  const counts=archive.metadata.verification.counts;assert.equal(counts.instances,18);assert.equal(counts.geometries,1);assert.equal(counts.materials,16);assert.equal(counts.textures,7);
  assert.equal(archive.metadata.verification.quantized,false);assert.equal(archive.metadata.verification.simplified,false);assert.equal(archive.metadata.verification.restoredResourceDisposal.eachDisposedExactlyOnce,true);
  console.log('ZHENGJUESI_ARCHIVE_LIGHT '+JSON.stringify({glbBytes:archive.glb.length,runtimeBytes:archive.runtime.length,...counts,exactRoundtripPassed:true}));
});
