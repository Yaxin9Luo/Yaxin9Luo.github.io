import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,InstancedMesh,Matrix3,Matrix4,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createGuideSweepVolume,intersectsGuideVolume} from '../src/yuanmingyuan/guide-architecture-sweep.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';

const volume=()=>createGuideSweepVolume({from:{y:4},to:{y:4},vertices:[-.8,.8].flatMap(x=>[-.8,.8].flatMap(z=>[3.972,7].map(y=>({x,y,z}))))});
function pavingFixture(){
  const root=new Group(),geometry=new BoxGeometry(.8,.064,.8),material=new MeshBasicMaterial(),mesh=new InstancedMesh(geometry,material,2);
  mesh.setMatrixAt(0,new Matrix4().makeTranslation(0,3.968,0));mesh.setMatrixAt(1,new Matrix4().makeTranslation(4,3.968,0));root.add(mesh);
  const architecture=createArchitectureSurface(root);
  return {root,geometry,material,mesh,architecture,supportAt:(x,z)=>architecture.surfaceAt(x,z,{maxY:4.01}),dispose(){architecture.dispose();mesh.dispose();geometry.dispose();material.dispose();}};
}

test('a missing endpoint instance ID is recovered only by its actual supporting face inside the swept volume',t=>{
  const f=pavingFixture(),counters={};
  try{
    assert.equal(f.architecture.intersectsGuideVolume(volume()),true);
    const points=[],supportAt=(x,z)=>{points.push([x,z]);return f.supportAt(x,z);};
    assert.equal(f.architecture.intersectsGuideVolume({...volume(),supportAt,counters}),false);
    assert(counters.supportWitnessHits>0);assert.equal(counters.hits??0,0);
    assert(points.every(([x,z])=>Math.abs(x)<.4&&Math.abs(z)<.4),'witnesses must lie inside actual clipped paver triangles');
    assert.equal(f.supportAt(...points[0]).surfaceId,`${f.mesh.uuid}:0`);
    t.diagnostic(JSON.stringify({counters,queries:points.length}));
  }finally{f.dispose();}
});

test('another instance, hidden surface, water, downward normal or inconsistent height cannot witness contact',()=>{
  const f=pavingFixture();
  try{
    const original=f.supportAt(0,0);
    for(const change of [
      {surfaceId:`${f.mesh.uuid}:1`}, {surfaceId:f.mesh.uuid}, {surfaceId:'terrain'},
      {height:original.height-.04}, {height:Infinity}, {normal:{x:0,y:-1,z:0}}, {walkable:false},
    ])assert.equal(f.architecture.intersectsGuideVolume({...volume(),supportAt:()=>({...original,...change})}),true,JSON.stringify(change));
    assert.equal(f.architecture.intersectsGuideVolume({...volume(),supportAt:()=>null}),true);
    assert.equal(f.architecture.intersectsGuideVolume({...volume(),supportAt:7}),true);
  }finally{f.dispose();}
});

test('a newly encountered raised object cannot use its own top to increase the old support allowance',()=>{
  const f=pavingFixture();
  try{
    const original=f.supportAt(0,0),input=volume();input.minimumSupportY=input.maximumSupportY=3.99;
    assert.equal(f.architecture.intersectsGuideVolume({...input,supportAt:()=>original}),true);
  }finally{f.dispose();}
});

test('support within one mesh never excuses its taller wall',()=>{
  const floor=new BoxGeometry(2,.064,2).translate(0,3.968,0),wall=new BoxGeometry(.03,3,1.4).translate(.6,5.5,0),geometry=mergeGeometries([floor,wall]),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material),root=new Group();root.add(mesh);
  const architecture=createArchitectureSurface(root);
  try{assert.equal(architecture.intersectsGuideVolume({...volume(),supportAt:(x,z)=>architecture.surfaceAt(x,z,{maxY:4.01})}),true);}
  finally{architecture.dispose();floor.dispose();wall.dispose();geometry.dispose();material.dispose();}
});

test('a nested support query replacing index scratch IDs cannot skip the next real obstacle',()=>{
  const floor=new BoxGeometry(.8,.064,.8).translate(0,3.968,0),wall=new BoxGeometry(.03,3,.5).translate(.6,5.5,0),material=new MeshBasicMaterial();
  const records=[floor,wall].map(geometry=>({mesh:new Mesh(geometry,material),instanceId:null,tree:new MeshBVH(geometry,{indirect:true}),matrix:new Matrix4(),inverse:new Matrix4(),normalMatrix:new Matrix3(),bounds:new Box3().setFromBufferAttribute(geometry.attributes.position)}));
  const candidateIds=[0,1],counters={};
  try{
    assert.equal(intersectsGuideVolume({...volume(),counters,supportAt:()=>{
      candidateIds.length=1;
      return {surfaceId:records[0].mesh.uuid,height:4,normal:new Vector3(0,1,0),walkable:true};
    }},{records,candidateIds}),true);
    assert(counters.supportWitnessHits>0);assert.equal(counters.candidateScans,2);
  }finally{floor.dispose();wall.dispose();material.dispose();}
});

test('world-owned exact sweep reuse retains the witness result and released owners invalidate it',()=>{
  const f=pavingFixture(),terrain={colliders:[],surfaceAt:()=>({height:3.96,normal:{x:0,y:1,z:0},surfaceId:'terrain',walkable:true})};
  const world=createMuseumGuideWorld({site:{position:[0,4,0],guide:[0,0,0]},terrain,architecture:f.architecture});
  const v=volume(),segment={from:{y:4},to:{y:4},vertices:[-.8,.8].flatMap(x=>[-.8,.8].flatMap(z=>[v.bounds.minY,v.bounds.maxY].map(y=>({x,y,z}))))};
  try{
    assert.equal(world.sweepBlocked(segment),false);const first=world.snapshot().architectureSweeps;assert(first.supportWitnessHits>0);
    assert.equal(world.sweepBlocked(segment),false);const second=world.snapshot().architectureSweeps;
    assert.equal(second.supportWitnessQueries,first.supportWitnessQueries);assert.equal(second.cacheHits,first.cacheHits+1);
    f.architecture.dispose();assert.equal(world.sweepBlocked(segment),true);assert.equal(world.snapshot().architectureSweeps.cacheEntries,0);
  }finally{world.dispose();f.dispose();}
});
