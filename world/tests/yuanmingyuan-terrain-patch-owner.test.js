import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {triangulateSurface,polygonArea,createTriangleSampler} from '../src/yuanmingyuan/terrain-geometry.js';
import {splitTerrainLand,createFineTerrainLand,createTerrainPatchOwner} from '../src/yuanmingyuan/terrain-patch-owner.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const court={id:'small-mound-substrate',polygon:rect(-5,-5,5,5),floorY:1,rimY:3};
const descriptor={id:'small-mound-replacement',assetId:'small-mound',ready:false,bounds:{minX:-22,maxX:22,minZ:-22,maxZ:22},prepared:{courts:[court],pads:[],paths:[]}};
const colorAt=()=>new THREE.Color('#809b77');
function source(){return triangulateSurface([{outer:rect(-60,-50,60,50),holes:[]}],{edgeLength:12,heightAt:(x,z)=>4+.3*Math.sin(x*.09)+Math.max(0,8-Math.hypot(x,z)),colorAt});}
function area(geometry){const p=geometry.attributes.position;let sum=0;for(let n=0;n<geometry.index.count;n+=3)sum+=Math.abs(polygonArea([0,1,2].map(j=>{const i=geometry.index.getX(n+j);return[p.getX(i),p.getZ(i)];})));return sum;}
function build(coarse){
  const group=new THREE.Group(),land=createFineTerrainLand(coarse,{courts:[court],heightAt:()=>3,colorAt}),floor=triangulateSurface([{outer:court.polygon,holes:[]}],{heightAt:()=>1,edgeLength:Infinity}),material=new THREE.MeshBasicMaterial();
  group.add(new THREE.Mesh(land,material),new THREE.Mesh(floor,material));const sampler=createTriangleSampler([land,floor]);let disposed=false;
  return {group,land,triangleCount:(land.index.count+floor.index.count)/3,surfaceAt(x,z,{maxY}={}){const h=sampler.sample(x,z,maxY);return h?{...h,walkable:h.geometry!==floor}:null;},dispose(){if(disposed)return;disposed=true;sampler.dispose();land.dispose();floor.dispose();material.dispose();group.clear();}};
}

test('partition retains every original triangle and attribute outside and on its coarse boundary',()=>{
  const original=source(),part=splitTerrainLand(original,[descriptor]);
  try{
    assert.equal(part.geometry.index.count+part.patches[0].coarseGeometry.index.count,original.index.count);
    assert(Math.abs(area(part.geometry)+area(part.patches[0].coarseGeometry)-area(original))<1e-8);
    const known=new Map();for(let i=0;i<original.attributes.position.count;i++){const p=original.attributes.position;known.set(`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`,i);}
    for(const geometry of [part.geometry,part.patches[0].coarseGeometry])for(let i=0;i<geometry.attributes.position.count;i++){
      const p=geometry.attributes.position,id=known.get(`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`);assert.notEqual(id,undefined);
      for(const name of ['position','normal','uv','color'])for(let c=0;c<geometry.attributes[name].itemSize;c++)assert.equal(geometry.attributes[name].getComponent(i,c),original.attributes[name].getComponent(id,c));
    }
  }finally{original.dispose();part.geometry.dispose();for(const p of part.patches)p.coarseGeometry.dispose();}
});

test('fine patch has a real excavation, exact boundary attributes, finite upward faces and conserved footprint',()=>{
  const original=source(),part=splitTerrainLand(original,[descriptor]),coarse=part.patches[0].coarseGeometry,fine=createFineTerrainLand(coarse,{courts:[court],heightAt:()=>3,colorAt}),sampler=createTriangleSampler([fine]);
  try{
    assert.equal(sampler.sample(0,0),null);assert.equal(sampler.sample(4.99,-2),null);assert(Math.abs(sampler.sample(5.01,-2).height-3)<1e-12);
    assert(Math.abs(area(fine)-(area(coarse)-100))<.001);
    for(const {fine:i,coarse:j} of fine.userData.boundaryCopies)for(const name of ['position','normal','uv','color'])for(let c=0;c<fine.attributes[name].itemSize;c++)assert.equal(fine.attributes[name].getComponent(i,c),coarse.attributes[name].getComponent(j,c));
    const edges=new Map();for(let n=0;n<fine.index.count;n+=3){const ids=[0,1,2].map(j=>fine.index.getX(n+j));for(let i=0;i<3;i++){const [a,b]=[ids[i],ids[(i+1)%3]].sort((a,b)=>a-b),key=`${a}:${b}`;edges.set(key,(edges.get(key)??0)+1);}}
    assert([...edges.values()].every(count=>count<=2),'local surface is manifold at every edge');
    for(const edge of fine.userData.boundaryEdges){const ids=edge.map(j=>fine.userData.boundaryCopies.find(pair=>pair.coarse===j).fine).sort((a,b)=>a-b);assert.equal(edges.get(ids.join(':')),1,'seam edge remains one original segment');}
    for(const attribute of Object.values(fine.attributes))assert([...attribute.array].every(Number.isFinite));
    assert.equal(sampler.triangleCount,fine.index.count/3,'no vertical or downward surface can masquerade as land');
  }finally{sampler.dispose();fine.dispose();coarse.dispose();part.geometry.dispose();original.dispose();}
});

test('patch remains coarse without a real ready owner and support; retained source activation is synchronous and reversible',()=>{
  const original=source(),part=splitTerrainLand(original,[descriptor]),material=new THREE.MeshBasicMaterial();let builds=0,sourceDisposed=0,supportDisposed=0;
  const patch=createTerrainPatchOwner({descriptor,coarseGeometry:part.patches[0].coarseGeometry,material,buildFine(){builds++;return build(part.patches[0].coarseGeometry);}});
  const geometry=new THREE.BoxGeometry(8,1,8),group=new THREE.Group();group.add(new THREE.Mesh(geometry,material));group.position.y=6;group.visible=false;group.updateMatrixWorld(true);
  const owner={group,dispose(){sourceDisposed++;}},support={surfaceAt(x,z,{maxY=Infinity}={}){const hit=new THREE.Raycaster(new THREE.Vector3(x,maxY===Infinity?20:maxY,z),new THREE.Vector3(0,-1,0)).intersectObject(group,true)[0];return hit?{height:hit.point.y,normal:hit.face.normal,walkable:true}:null;},dispose(){supportDisposed++;}};
  try{
    const before=patch.surfaceAt(0,0);assert(before.height>11);assert.equal(builds,0);assert.equal(patch.coarse.visible,true);
    for(const binding of [null,{owner},{owner,support:{surfaceAt:()=>null}},{owner:{...owner,ready:false},support}])assert.throws(()=>patch.activate(binding),/requires|does not cover/);
    assert.equal(patch.surfaceAt(0,0).height,before.height);assert.equal(group.visible,false);assert.equal(builds,0);
    patch.prepare();assert.equal(patch.coarse.visible,true);assert.equal(patch.fine.group.visible,false);assert.equal(patch.surfaceAt(0,0).height,before.height);
    patch.activate({owner,support});assert.equal(patch.coarse.visible,false);assert.equal(patch.fine.group.visible,true);assert.equal(group.visible,true);assert.equal(patch.surfaceAt(0,0).height,6.5);assert.equal(patch.surfaceAt(0,0).supportSource,'asset-triangle');
    assert.equal(patch.surfaceAt(0,0,{maxY:2}).height,1);assert.equal(patch.surfaceAt(0,0,{maxY:2}).walkable,false);
    for(let i=0;i<40;i++)patch.surfaceAt(100+i,20);assert.equal(patch.snapshot.active,true,'leaving the footprint cannot unload a retained hill');assert.equal(group.visible,true);
    const revision=patch.snapshot.revision;patch.activate({owner,support});assert.equal(patch.snapshot.revision,revision);assert.equal(builds,1);
    patch.revert();assert.equal(patch.surfaceAt(0,0).height,before.height);assert.equal(group.visible,false);patch.activate({owner,support});assert.equal(builds,1);
    support.disposed=true;assert.equal(patch.surfaceAt(0,0).height,before.height);assert.equal(patch.coarse.visible,true);assert.equal(patch.snapshot.active,false);
  }finally{patch.dispose();patch.dispose();assert.equal(sourceDisposed,0);assert.equal(supportDisposed,0);material.dispose();geometry.dispose();part.geometry.dispose();original.dispose();}
});

test('a failed fine build never hides the coarse hill and can be retried without replacing external terrain',()=>{
  const original=source(),part=splitTerrainLand(original,[descriptor]),material=new THREE.MeshBasicMaterial();let attempts=0;
  const patch=createTerrainPatchOwner({descriptor,coarseGeometry:part.patches[0].coarseGeometry,material,buildFine(){if(!attempts++)throw new Error('fixture local triangulation failure');return build(part.patches[0].coarseGeometry);}});
  try{const before=patch.surfaceAt(0,0);assert.throws(()=>patch.prepare(),/fixture local/);assert.equal(patch.snapshot.state,'coarse');assert.equal(patch.coarse.visible,true);assert.deepEqual(patch.surfaceAt(0,0),before);patch.prepare();assert.equal(patch.snapshot.state,'prepared');assert.equal(patch.coarse.visible,true);assert.equal(attempts,2);}finally{patch.dispose();material.dispose();part.geometry.dispose();original.dispose();}
});

test('a throwing coarse disposal listener cannot leak the already prepared fine owner or dispose borrowed material',()=>{
  const original=source(),part=splitTerrainLand(original,[descriptor]),material=new THREE.MeshBasicMaterial();let fineDisposed=0,materialDisposed=0;
  material.addEventListener('dispose',()=>materialDisposed++);
  const patch=createTerrainPatchOwner({descriptor,coarseGeometry:part.patches[0].coarseGeometry,material,buildFine(){const fine=build(part.patches[0].coarseGeometry),dispose=fine.dispose;fine.dispose=()=>{fineDisposed++;dispose();};return fine;}});
  patch.prepare();part.patches[0].coarseGeometry.addEventListener('dispose',()=>{throw new Error('fixture coarse disposal listener');});
  assert.throws(()=>patch.dispose(),AggregateError);assert.equal(patch.disposed,true);assert.equal(fineDisposed,1);assert.equal(materialDisposed,0);assert.equal(patch.group.children.length,0);assert.equal(patch.surfaceAt(0,0),null);patch.dispose();assert.equal(fineDisposed,1);
  material.dispose();part.geometry.dispose();original.dispose();
});
