import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,InstancedMesh,Matrix4,MeshBasicMaterial} from 'three';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createArchitectureSurface as legacy} from './fixtures/architecture-surface-legacy.js';
import {architectureIndexScene} from './fixtures/architecture-index-scene.js';

function compareSurface(a,b,x,z,limits){assert.deepEqual(a.surfaceAt(x,z,limits),b.surfaceAt(x,z,limits));}

test('exact per-point legacy results survive dense instances, transformed negative coordinates and broad objects',()=>{
  for(const placement of [
    {position:[0,3,0],rotationY:0,scale:1},
    {position:[-32,4,-64],rotationY:.63,scale:1.3},
    {position:[563,4.85,-350],rotationY:-.28,scale:.8},
  ]){
    const fixture=architectureIndexScene({side:8,...placement}),before={position:fixture.geometry.attributes.position.array.slice(),index:fixture.geometry.index.array.slice(),matrices:fixture.instances.instanceMatrix.array.slice()},a=legacy(fixture.group),b=createArchitectureSurface(fixture.group);
    try{
      for(const x of [-66,-65,-45,-3,-2.000001,-2,-1.999999,-.215,0,.215,1.999999,2,2.000001,3,45,65,66])for(const z of [-46,-45,-2,0,1.5,2,2.5,45,46]){
        const p=fixture.point(x,0,z);
        for(const dy of [-.01,0,.35,4,Infinity]){
          const limits={maxY:dy===Infinity?Infinity:p.y+dy,minY:p.y-.4};compareSurface(a,b,p.x,p.z,limits);
        }
        for(const radius of [.02,.32,1.4,3.7])assert.equal(b.capsuleBlocked({x:p.x,y:p.y,z:p.z,radius,height:3.28}),a.capsuleBlocked({x:p.x,y:p.y,z:p.z,radius,height:3.28}));
      }
      assert.deepEqual(fixture.geometry.attributes.position.array,before.position);assert.deepEqual(fixture.geometry.index.array,before.index);assert.deepEqual(fixture.instances.instanceMatrix.array,before.matrices);
      assert.equal(fixture.geometry.boundingBox,null,'the query indexes leave authored lazy bounds alone');
      assert.equal(a.diagnostics.support.raycasts,b.diagnostics.support.raycasts,'the exact ray calls remain, while rejected candidate work changes');
    }finally{a.dispose();b.dispose();fixture.dispose();}
  }
});

test('equal-height ties retain source traversal order even across different hierarchy branches',()=>{
  const fixture=architectureIndexScene({side:16,position:[-32,4,-32],rotationY:0}),a=legacy(fixture.group),b=createArchitectureSurface(fixture.group);
  try{
    for(const [x,z] of [[24,24],[-24,-24],[16,0],[0,-16]]){
      const p=fixture.point(x,0,z),old=a.surfaceAt(p.x,p.z,{maxY:4.1});
      assert.equal(old.surfaceId,fixture.floor.uuid);assert.deepEqual(b.surfaceAt(p.x,p.z,{maxY:4.1}),old);
    }
  }finally{a.dispose();b.dispose();fixture.dispose();}
});

test('local support footprint edges and wider vertical queries match the complete legacy query',()=>{
  const fixture=architectureIndexScene({side:12,position:[-16,4,-32],rotationY:.27,scale:1.2}),a=legacy(fixture.group),b=createArchitectureSurface(fixture.group);
  const bounds={minX:-19,maxX:-13,minZ:-35,maxZ:-29},oldLocal=a.createGuideSupport(bounds,{maxY:4.3,minY:3,cellSize:.5}),newLocal=b.createGuideSupport(bounds,{maxY:4.3,minY:3,cellSize:.5});
  try{
    for(const x of [-19.000001,-19,-18.999999,-16,-13.000001,-13,-12.999999])for(const z of [-35.000001,-35,-34.999999,-32,-29.000001,-29,-28.999999])for(const limits of [{maxY:4.3,minY:3},{maxY:8,minY:3},{maxY:4.3,minY:-1},{maxY:Infinity,minY:3}]){
      const actual=newLocal.surfaceAt(x,z,limits);
      assert.deepEqual(actual,oldLocal.surfaceAt(x,z,limits));
      assert.deepEqual(actual,a.surfaceAt(x,z,limits));
    }
    assert.equal(newLocal.snapshot().fallbackQueries,oldLocal.snapshot().fallbackQueries);
    assert.equal(newLocal.snapshot().raycasts,oldLocal.snapshot().raycasts);
  }finally{oldLocal.dispose();newLocal.dispose();a.dispose();b.dispose();fixture.dispose();}
});

test('large-radius capsules preserve the legacy padded-cell contract at both sides of negative grid boundaries',()=>{
  const group=new Group(),geometry=new BoxGeometry(),material=new MeshBasicMaterial(),instances=new InstancedMesh(geometry,material,7),matrix=new Matrix4();
  const centres=[-37,-34,-32,-30,-27,-19,-13];
  centres.forEach((x,i)=>instances.setMatrixAt(i,matrix.makeScale(.06,2,.12).setPosition(x,1,-16)));group.add(instances);
  const a=legacy(group),b=createArchitectureSurface(group);
  try{
    for(const x of [-48.000001,-48,-47.999999,-32.000001,-32,-31.999999,-16.000001,-16,-15.999999])for(const z of [-16.000001,-16,-15.999999])for(const radius of [.01,.32,1.4,2,2.01,4,12]){
      const probe={x,y:0,z,radius,height:3.28};assert.equal(b.capsuleBlocked(probe),a.capsuleBlocked(probe));
    }
  }finally{a.dispose();b.dispose();instances.dispose();geometry.dispose();material.dispose();}
});

test('dense broad-phase pruning reduces record work with identical full results and ray calls',()=>{
  const fixture=architectureIndexScene({side:32}),a=legacy(fixture.group),b=createArchitectureSurface(fixture.group);
  try{
    for(const p of fixture.queries(720))compareSurface(a,b,p.x,p.z,p);
    const before=a.diagnostics.support,after=b.diagnostics.support;
    assert.equal(after.queries,720);assert.equal(after.raycasts,before.raycasts);assert.equal(after.hits,before.hits);
    assert(after.candidateScans<before.candidateScans/50,`${after.candidateScans} versus legacy ${before.candidateScans}`);
    assert.equal(b.diagnostics.candidateIndex.recordCount,4100);assert(b.diagnostics.candidateIndex.nodesRejected>0);
  }finally{a.dispose();b.dispose();fixture.dispose();}
});

test('cancellation clears the new record tree and guide indexes while borrowed meshes remain owned by caller',()=>{
  const fixture=architectureIndexScene({side:8}),controller=new AbortController(),surface=createArchitectureSurface(fixture.group,{signal:controller.signal});let geometryDisposals=0;
  fixture.geometry.addEventListener('dispose',()=>geometryDisposals++);
  const local=surface.createGuideSupport({minX:560,maxX:566,minZ:-353,maxZ:-347},{maxY:5.2});
  assert(surface.surfaceAt(563,-350,{maxY:5.2}));controller.abort();surface.dispose();
  assert.equal(local.snapshot().disposed,true);assert.equal(surface.diagnostics.candidateIndex.nodeCount,0);assert.equal(surface.diagnostics.candidateIndex.recordCount,0);assert.equal(geometryDisposals,0);
  assert.equal(surface.surfaceAt(563,-350),null);assert.equal(surface.capsuleBlocked({x:563,y:4.85,z:-350}),false);
  fixture.dispose();assert.equal(geometryDisposals,1);
});
