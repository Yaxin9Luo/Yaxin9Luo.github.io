import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial} from 'three';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createGuideSweepVolume} from '../src/yuanmingyuan/guide-architecture-sweep.js';
import {evaluateCompanionSweep} from '../src/companion-system.js';

function fixture(){
  const group=new Group(),material=new MeshBasicMaterial(),geometries=new Set(),instances=[];
  return {group,material,geometries,instances,add(g,x=0,y=0,z=0){geometries.add(g);const m=new Mesh(g,material);m.position.set(x,y,z);group.add(m);return m;},dispose(){for(const m of instances)m.dispose();for(const g of geometries)g.dispose();material.dispose();group.clear();}};
}
function boxVolume(bounds,counters){
  const {minX,maxX,minY,maxY,minZ,maxZ}=bounds;
  return {bounds,planes:[[-1,0,0,-minX],[1,0,0,maxX],[0,-1,0,-minY],[0,1,0,maxY],[0,0,-1,-minZ],[0,0,1,maxZ]],interiorPoint:{x:(minX+maxX)/2,y:(minY+maxY)/2,z:(minZ+maxZ)/2},counters};
}
const box=(x0,x1,z0,z1)=>boxVolume({minX:x0,maxX:x1,minY:4.012,maxY:7.2,minZ:z0,maxZ:z1});
const evaluate=(surface,from,to=from,interaction=false,counters={})=>evaluateCompanionSweep({kind:'elizabeth',from,to,interaction,heightAt:()=>4,waterLevel:2,sweepBlocked:segment=>surface.intersectsGuideVolume({...createGuideSweepVolume(segment),counters})});

test('public volume bridge reuses one source geometry BVH and prunes remote placed records',()=>{
  const f=fixture(),g=new BoxGeometry(1,1,1),m=new InstancedMesh(g,f.material,128);f.geometries.add(g);f.instances.push(m);f.group.add(m);
  for(let i=0;i<m.count;i++)m.setMatrixAt(i,new Matrix4().makeTranslation(i*8,6,i===0?0:100));
  const original={positions:g.attributes.position.array.slice(),index:g.index.array.slice(),instances:m.instanceMatrix.array.slice()};
  let disposals=0;g.addEventListener('dispose',()=>disposals++);const surface=createArchitectureSurface(f.group),counts={};
  try{
    assert.equal(surface.diagnostics.geometryCount,1);assert.equal(surface.diagnostics.primitiveCount,128);
    assert.equal(surface.intersectsGuideVolume({...box(-.2,.2,-.2,.2),counters:counts}),true);
    assert(counts.shapecasts>=1);assert(counts.candidateScans<=8,'the existing record hierarchy excludes remote instances');
    assert.equal(surface.intersectsGuideVolume(box(3,4,-.2,.2)),false);
    assert.equal(surface.diagnostics.geometryCount,1,'no separate collision BVH is created');
    assert.deepEqual(g.attributes.position.array,original.positions);assert.deepEqual(g.index.array,original.index);assert.deepEqual(m.instanceMatrix.array,original.instances);
  }finally{surface.dispose();assert.equal(disposals,0);assert.equal(surface.diagnostics.geometryCount,0);f.dispose();assert.equal(disposals,1);}
});

test('actual small pillar catches the intervening body turn while endpoint poses remain clear',()=>{
  const f=fixture();f.add(new BoxGeometry(.02,2,.02),-1.4,5.5,-1.4);const surface=createArchitectureSurface(f.group),a={x:0,z:0,heading:0},b={...a,heading:Math.PI/2};
  try{
    assert(evaluate(surface,a).valid);assert(evaluate(surface,b).valid);
    const counters={},result=evaluate(surface,a,b,false,counters);assert.equal(result.valid,false);assert.equal(result.reason,'architecture-obstacle');assert(counters.triangleTests>0);
  }finally{surface.dispose();f.dispose();}
});

test('real doorway stays open, but its thin jamb and raised-board contact remain blocking',()=>{
  const f=fixture();for(const x of [-2,2])f.add(new BoxGeometry(.1,4,.1),x,6,0);f.add(new BoxGeometry(4.1,.2,.1),0,8,0);
  const surface=createArchitectureSurface(f.group),from={x:0,z:-3,heading:0},to={x:0,z:3,heading:0};
  try{
    assert(evaluate(surface,from,to).valid,'empty doorway triangles never become a solid building AABB');
    assert.equal(evaluate(surface,{...from,x:1},{...to,x:1}).reason,'architecture-obstacle');
    const pose={x:0,z:0,heading:0};assert(evaluate(surface,pose).valid);assert.equal(evaluate(surface,pose,pose,true).reason,'architecture-obstacle');
  }finally{surface.dispose();f.dispose();}
});

test('the shared broad phase includes clipping epsilon contact and both triangle windings',()=>{
  for(const reverse of [false,true]){
    const f=fixture(),vertices=[[1,4,-1],[1,8,-1],[1,8,1]];if(reverse)vertices.reverse();
    f.add(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices.flat(),3)));
    const surface=createArchitectureSurface(f.group);
    try{
      assert.equal(surface.intersectsGuideVolume(box(0,1-5e-9,-.2,.2)),true,'bounds need the same 1e-8 contact margin as plane clipping');
      assert.equal(surface.intersectsGuideVolume(box(0,1-1e-4,-.2,.2)),false);
    }finally{surface.dispose();f.dispose();}
  }
});

test('drawRange and affine negative instances retain actual source triangle coverage',()=>{
  const f=fixture(),wall=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([
    0,4,-1,0,8,-1,0,8,1, 0,4,-1,0,8,1,0,4,1,
    10,4,-1,10,8,-1,10,8,1, 10,4,-1,10,8,1,10,4,1,
  ],3));wall.addGroup(0,6,0);wall.addGroup(6,6,0);wall.setDrawRange(6,6);f.add(wall);
  const g=new BoxGeometry(.03,4,.05),m=new InstancedMesh(g,f.material,1);m.setMatrixAt(0,new Matrix4().makeRotationY(.63).scale({x:-1.7,y:1,z:.6}).setPosition(500,6,-200));f.group.add(m);f.instances.push(m);f.geometries.add(g);
  const surface=createArchitectureSurface(f.group);
  try{
    assert.equal(surface.intersectsGuideVolume(box(-.1,.1,-.2,.2)),false,'the clipped-away triangle cannot block movement');
    assert.equal(surface.intersectsGuideVolume(box(9.9,10.1,-.2,.2)),true);
    const a={x:497,z:-200,heading:0},b={x:503,z:-200,heading:0};assert(evaluate(surface,a).valid);assert(evaluate(surface,b).valid);assert.equal(evaluate(surface,a,b).reason,'architecture-obstacle');
  }finally{surface.dispose();f.dispose();}
});

test('floor support and the frozen local height-order path remain unchanged after sweep queries',()=>{
  const f=fixture();f.add(new BoxGeometry(20,.1,20),0,3.95,0);const surface=createArchitectureSurface(f.group),local=surface.createGuideSupport({minX:-5,maxX:5,minZ:-5,maxZ:5},{maxY:5,cellSize:.25});
  try{
    const before=local.surfaceAt(.13,.19),recordCount=surface.diagnostics.primitiveCount;
    assert(evaluate(surface,{x:0,z:0,heading:0},{x:2,z:0,heading:.4}).valid);
    assert.deepEqual(local.surfaceAt(.13,.19),before);assert.equal(surface.diagnostics.primitiveCount,recordCount);assert.equal(surface.diagnostics.geometryCount,1);
  }finally{local.dispose();surface.dispose();f.dispose();}
});

test('invalid and expired bridge calls fail closed without disposing borrowed render geometry',()=>{
  const f=fixture();f.add(new BoxGeometry(.1,1,.1),50,6,50);const controller=new AbortController(),surface=createArchitectureSurface(f.group,{signal:controller.signal}),valid=box(-1,1,-1,1);
  let disposals=0;for(const g of f.geometries)g.addEventListener('dispose',()=>disposals++);
  try{
    for(const bad of [undefined,null,{}, {...valid,bounds:{...valid.bounds,minX:2}}, {...valid,bounds:{...valid.bounds,maxY:Infinity}}, {...valid,planes:[]}, {...valid,planes:[[0,0,0,1],...valid.planes]}, {...valid,planes:[[1e308,1e308,1e308,0],...valid.planes]}, {...valid,counters:4}])assert.equal(surface.intersectsGuideVolume(bad),true);
    assert.equal(surface.disposed,false);assert.equal(surface.intersectsGuideVolume(valid),false);controller.abort();assert.equal(surface.intersectsGuideVolume(valid),true);assert.equal(surface.disposed,true);assert.equal(surface.diagnostics.disposed,true);assert.equal(disposals,0);
  }finally{surface.dispose();f.dispose();assert.equal(disposals,1);}
});
