import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,PlaneGeometry,Vector3} from 'three';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';
import {evaluateCompanionSweep} from '../src/companion-system.js';

const region={minX:-16,maxX:16,minZ:-16,maxZ:16};
function fixture(){
  const group=new Group(),geometries=new Set(),material=new MeshBasicMaterial();
  return {group,material,geometries,add(geometry){geometries.add(geometry);const mesh=new Mesh(geometry,material);group.add(mesh);return mesh;},dispose(){for(const g of geometries)g.dispose();material.dispose();group.clear();}};
}
function triangles(vertices){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices.flat(),3));g.computeVertexNormals();return g;}
const flat=(x0,x1,z0,z1,y)=>[[x0,y,z0],[x0,y,z1],[x1,y,z0],[x1,y,z0],[x0,y,z1],[x1,y,z1]];
function compare(surface,local,x,z,options={maxY:6}){assert.deepEqual(local.surfaceAt(x,z,options),surface.surfaceAt(x,z,options),`query ${x}, ${z}, ${JSON.stringify(options)}`);}
const seeded=()=>{let n=19284;return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);};

test('local projected candidates preserve exact height, face normal and instance ID under affine placement',()=>{
  const f=fixture(),floor=f.add(new BoxGeometry(24,.2,24));floor.position.y=3.9;
  const g=new BoxGeometry(1,.18,2),instances=new InstancedMesh(g,f.material,4);f.geometries.add(g);f.group.add(instances);
  for(let i=0;i<4;i++)instances.setMatrixAt(i,new Matrix4().makeScale(1+i*.13,1+i*.31,1).setPosition(-6+i*4,4.15,0));
  const ramp=f.add(new BoxGeometry(4,.12,3));ramp.position.set(-5,4.15,5);ramp.rotation.set(.012,.33,.008);
  const tall=f.add(new BoxGeometry(6,.2,6));tall.position.y=8;
  f.group.position.set(563,0,-346);f.group.rotation.set(.004,.31,-.003);f.group.scale.set(1.05,1.01,.91);
  const before={matrix:instances.instanceMatrix.array.slice(),positions:g.attributes.position.array.slice(),index:g.index.array.slice()};
  const surface=createArchitectureSurface(f.group),bounds={minX:547,maxX:579,minZ:-362,maxZ:-330},local=surface.createGuideSupport(bounds,{maxY:6});
  try{
    const random=seeded();for(let i=0;i<4000;i++)compare(surface,local,548+random()*30,-361+random()*30,{maxY:[4.05,4.4,6,12,Infinity][i%5],minY:i%13===0?4.12:-1000});
    assert(local.snapshot().preciseTriangleTests>500);assert(local.snapshot().fallbackQueries>0);
    assert.equal(surface.diagnostics.geometryCount,4,'extraction reuses the owner BVHs');
    assert.deepEqual(instances.instanceMatrix.array,before.matrix);assert.deepEqual(g.attributes.position.array,before.positions);assert.deepEqual(g.index.array,before.index);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('FrontSide first-hit retains a nonwalkable slope over the lower floor in one record',()=>{
  const f=fixture();f.add(triangles([...flat(-8,8,-8,8,4),[-1,4.3,-1],[-1,4.3,1],[1,6.3,-1],
    [6,5,1],[6,5,-1],[4,5,-1], // downward-facing canopy
    [7,4,-1],[7,6,0],[7,4,1], // vertical wall
  ]));
  const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport(region,{maxY:7});
  try{
    const expected=surface.surfaceAt(-.3,-.3,{maxY:7});assert.equal(expected.walkable,false);assert(expected.height>4.3);
    assert.deepEqual(local.surfaceAt(-.3,-.3),expected);assert.equal(local.surfaceAt(-.3,-.3,{maxY:4.1}).height,4);
    for(const x of [-1.00000001,-1,-.3,0,1,4.5,5,6,7])for(const z of [-1,0,.25,1])compare(surface,local,x,z,{maxY:7});
    assert(local.snapshot().preciseTriangleTests>0);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('real holes and triangle/drawRange/group boundaries match the original without height-grid padding',()=>{
  const f=fixture();f.add(triangles(flat(-12,12,-12,12,3.5)));
  const g=triangles([...flat(-6,-.25,-2,2,4.4),...flat(.25,6,-2,2,4.4),...flat(-3,3,4,6,4.8),...flat(-3,3,8,10,5.2)]);
  g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));g.addGroup(0,12,0);g.addGroup(18,6,0);g.setDrawRange(0,21);f.add(g);
  const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport(region,{maxY:6});
  try{
    assert.equal(local.surfaceAt(0,.17).height,3.5,'the actual half-metre opening stays open');
    for(const edge of [-6,-.25,.25,6])for(const delta of [-1e-7,-1e-10,-1e-12,0,1e-12,1e-10,1e-7])for(const z of [-2,-1,.17,2])compare(surface,local,edge+delta,z);
    for(const x of [-3,-1.25,0,1.25,3])for(const z of [4,5,6,8,9,10])compare(surface,local,x,z);
    assert(local.snapshot().triangleFallbackQueries>0,'boundary uncertainty calls the original BVH');
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('coincident records and crossing planes retain BVH tie order and face normals',()=>{
  const f=fixture();f.add(triangles([...flat(-5,5,-5,5,4.5),[-2,4.1,-2],[-2,4.1,2],[2,4.9,-2]]));f.add(triangles(flat(-3,3,-3,3,4.5)));
  const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport(region,{maxY:6});
  try{
    for(let i=0;i<100;i++)for(const x of [-1,0,1])compare(surface,local,x,-1.7+i*.033);
    assert(local.snapshot().triangleFallbackQueries>=100);assert(local.snapshot().raycasts>0);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('negative and highly conditioned instance transforms retain original front-side semantics',()=>{
  const f=fixture(),g=new BoxGeometry(6,.2,6),m=new InstancedMesh(g,f.material,2);f.geometries.add(g);f.group.add(m);
  m.setMatrixAt(0,new Matrix4().makeScale(-1,1,1.4).setPosition(-5,3.9,0));
  m.setMatrixAt(1,new Matrix4().makeScale(2e-8,1,1).setPosition(5,3.9,0));
  const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport(region,{maxY:6});
  try{
    for(let i=0;i<500;i++)compare(surface,local,-7.5+(i%31)*.16,-3.5+Math.floor(i/31)*.4);
    for(const x of [5-1e-8,5,5+1e-8])for(const z of [-1,.17,1])compare(surface,local,x,z);
    assert(local.snapshot().unsafeTriangles>0);assert(local.snapshot().triangleFallbackQueries>0);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('near-vertical first-hit and near-origin-height results use the exact fallback',()=>{
  const f=fixture();f.add(triangles([...flat(-2,2,-2,2,4),[-5e-10,4.2,-1],[-5e-10,4.2,1],[5e-10,6.2,0]]));
  const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport(region,{maxY:7});
  try{
    compare(surface,local,0,0,{maxY:7});assert.equal(local.surfaceAt(0,0).walkable,false);
    for(const maxY of [4-1e-12,4,4+1e-12,Infinity])for(const minY of [-1000,4-1e-12,4,4+1e-12])compare(surface,local,1,.17,{maxY,minY});
    compare(surface,local,17,.17,{maxY:7});assert.equal(local.surfaceAt(NaN,0),null);
    assert(local.snapshot().unsafeTriangles>0);assert(local.snapshot().triangleFallbackQueries>0);assert(local.snapshot().fallbackQueries>0);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('three overlapping actual floor records need one exact final triangle and no extra BVHs',()=>{
  const f=fixture();for(const[y,size]of[[4,32],[4.3,28]]){const mesh=f.add(new BoxGeometry(size,.2,size));mesh.position.y=y;}
  const g=new PlaneGeometry(24,24,24,24);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,4.8+Math.sin(p.getX(i)*.12)*.003+Math.cos(p.getZ(i)*.16)*.004);g.computeVertexNormals();f.add(g);
  const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport(region,{maxY:6}),random=seeded();
  try{
    for(let i=0;i<6000;i++)compare(surface,local,-10+random()*20,-10+random()*20);
    const original=surface.diagnostics.support,fast=local.snapshot();
    assert.equal(original.raycasts,18000);assert(fast.preciseTriangleTests>=5990);assert(fast.preciseTriangleTests<=6000);assert(fast.raycasts<original.raycasts/100);
    assert.equal(surface.diagnostics.geometryCount,3);assert.equal(fast.primitiveCount,3);assert.equal(fast.sourcePrimitiveCount,3);assert.equal(fast.triangleCount,1156);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('local cancellation and disposal release triangle indexes without disposing rendering resources',()=>{
  const f=fixture(),mesh=f.add(new BoxGeometry(8,.2,8));mesh.position.y=3.9;let renderDisposals=0;mesh.geometry.addEventListener('dispose',()=>renderDisposals++);
  const signal=new AbortController(),surface=createArchitectureSurface(f.group,{signal:signal.signal}),local=surface.createGuideSupport(region,{maxY:6});
  assert(local.snapshot().triangleCount>0);local.dispose();local.dispose();
  assert.equal(local.surfaceAt(.13,.19),null);assert.equal(local.snapshot().triangleCount,0);assert.equal(local.snapshot().triangleIndexReferences,0);assert.equal(renderDisposals,0);assert(surface.surfaceAt(.13,.19));
  const other=surface.createGuideSupport(region,{maxY:6});signal.abort();assert.equal(other.snapshot().disposed,true);assert.equal(other.snapshot().triangleCount,0);assert.equal(surface.diagnostics.localGuideSupports,0);assert.equal(surface.diagnostics.geometryCount,0);assert.equal(renderDisposals,0);
  assert.throws(()=>surface.createGuideSupport(region),/disposed/);surface.dispose();f.dispose();assert.equal(renderDisposals,1);
});

test('museum world and full-body sweeps preserve water rejection and moving visitor obstacles',()=>{
  const f=fixture(),floor=f.add(new BoxGeometry(24,.2,24));floor.position.y=3.9;
  const surface=createArchitectureSurface(f.group),terrain={colliders:[],surfaceAt:x=>({height:3.5,normal:[0,1,0],walkable:true,...(x<-10?{waterY:4.2}:{})})};
  const direct={surfaceAt:surface.surfaceAt},a=createMuseumGuideWorld({site:{position:[0,4,0]},terrain,architecture:direct}),b=createMuseumGuideWorld({site:{position:[0,4,0]},terrain,architecture:surface});
  try{
    const wall={id:'visitor',bottom:4.002,top:7,planes:[[1,0,0,.5],[-1,0,0,.5],[0,0,1,.5],[0,0,-1,.5],[0,1,0,7],[0,-1,0,-4.002]]};
    const cases=[[{x:0,z:0,heading:0},{x:0,z:0,heading:0},[]],[{x:0,z:0,heading:0},{x:0,z:0,heading:0},[wall]],[{x:0,z:0,heading:.1},{x:0,z:.3,heading:.3},[]],[{x:-9,z:0,heading:0},{x:-10,z:0,heading:0},[]]];
    for(const[from,to,colliders]of cases){const input={kind:'elizabeth',from,to,colliders,waterLevel:2};assert.deepEqual(evaluateCompanionSweep({...input,heightAt:b.heightAt}),evaluateCompanionSweep({...input,heightAt:a.heightAt}));}
    assert.equal(b.heightAt(-11,0),undefined);assert.equal(b.snapshot().localArchitectureSupport.preciseTriangleTests>0,true);
  }finally{a.dispose();b.dispose();surface.dispose();f.dispose();}
});
