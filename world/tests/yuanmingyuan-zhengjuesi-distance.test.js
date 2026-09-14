import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {roofTileRollGeometry} from '../src/yuanmingyuan/chinese-architecture-geometry.js';
import {createZhengjuesiDistanceTile,certifyZhengjuesiTileCorrespondence,zhengjuesiDistanceWorldError,zhengjuesiDistanceTileRecipes,createZhengjuesiDistanceStone,createZhengjuesiDistanceCylinder,zhengjuesiDistanceCandidateError,zhengjuesiDistanceCandidates} from '../src/yuanmingyuan/zhengjuesi-distance-geometry.js';

function source(name){
  const recipe=zhengjuesiDistanceTileRecipes[name],points=recipe.rows===3?[[0,0,-recipe.halfLength],[0,recipe.bow,0],[0,0,recipe.halfLength]]:[[0,0,-recipe.halfLength],[0,0,recipe.halfLength]],geometry=roofTileRollGeometry(points,recipe.radius,recipe.thickness,recipe.arcs);
  if(recipe.pan)geometry.rotateZ(Math.PI);geometry.name=name;return geometry;
}
function closed(geometry,tolerance=0){
  const edges=new Map(),p=geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0;
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>tolerance?Math.round(v/tolerance):v).join(',');
  for(let i=0;i<(geometry.index?.count??p.count);i+=3){const ids=[0,1,2].map(k=>geometry.index?geometry.index.getX(i+k):i+k);a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);volume+=a.dot(b.cross(c))/6;
    for(let j=0;j<3;j++){const aa=key(ids[j]),bb=key(ids[(j+1)%3]),edge=aa<bb?`${aa}|${bb}`:`${bb}|${aa}`,value=edges.get(edge)??{count:0,winding:0};value.count++;value.winding+=aa<bb?1:-1;edges.set(edge,value);}
  }
  assert(volume>0);for(const edge of edges.values()){assert.equal(edge.count,2);assert.equal(edge.winding,0);}
}
function sampledDistance(from,to){
  const bvh=new MeshBVH(to,{indirect:true,setBoundingBox:false}),p=from.attributes.position,v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],point=new THREE.Vector3(),result={point:new THREE.Vector3()};let maximum=0;
  for(let i=0;i<(from.index?.count??p.count);i+=3){for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,from.index?from.index.getX(i+k):i+k);
    for(const [u,w] of [[0,0],[1,0],[0,1],[.5,.5],[.5,0],[0,.5],[1/3,1/3]]){point.copy(v[0]).multiplyScalar(1-u-w).addScaledVector(v[1],u).addScaledVector(v[2],w);maximum=Math.max(maximum,bvh.closestPointToPoint(point,result).distance);}
  }
  return maximum;
}

for(const name of Object.keys(zhengjuesiDistanceTileRecipes))test(`${name}: coarser closed clay retains the original source and bounds both surfaces`,()=>{
  const full=source(name),before={position:full.attributes.position.array.slice(),normal:full.attributes.normal.array.slice(),uv:full.attributes.uv.array.slice(),index:full.index.array.slice()};
  for(const arcs of [2,4,7]){
    const result=createZhengjuesiDistanceTile(full,{arcs});assert(result.triangles<result.sourceTriangles);closed(result.geometry);
    assert.equal(result.proof.coverage.length,6);assert(result.proof.coverage.every(part=>Math.abs(part.sourceArea-1)<1e-12&&Math.abs(part.targetArea-1)<1e-12));
    const forward=sampledDistance(full,result.geometry),reverse=sampledDistance(result.geometry,full);assert(forward<=result.proof.maximumError);assert(reverse<=result.proof.maximumError);assert.equal(result.proof.visualLightingAcceptance,false);
    result.geometry.dispose();
  }
  assert.deepEqual(full.attributes.position.array,before.position);assert.deepEqual(full.attributes.normal.array,before.normal);assert.deepEqual(full.attributes.uv.array,before.uv);assert.deepEqual(full.index.array,before.index);full.dispose();
});

test('source normal and UV samples survive the low polygon outer and inner sheets',()=>{
  const full=source('zhengjuesi-prototype-convex-lap-cover-tile'),result=createZhengjuesiDistanceTile(full,{arcs:2}),small=result.geometry;
  for(let layer=0;layer<2;layer++)for(let row=0;row<2;row++)for(let column=0;column<3;column++){
    const a=layer*45+row*30+column*7,b=layer*6+row*3+column,n=new THREE.Vector3().fromBufferAttribute(full.attributes.normal,a).normalize(),m=new THREE.Vector3().fromBufferAttribute(small.attributes.normal,b);
    assert(n.distanceTo(m)<1e-7);assert.equal(small.attributes.uv.getX(b),full.attributes.uv.getX(a));assert.equal(small.attributes.uv.getY(b),full.attributes.uv.getY(a));
  }
  full.dispose();small.dispose();
});

test('affine error bound covers real nonuniform, rotated, sheared and reflected tiles',()=>{
  const full=source('zhengjuesi-prototype-convex-lap-cover-tile'),result=createZhengjuesiDistanceTile(full,{arcs:2});
  const matrices=[new THREE.Matrix4().makeRotationY(.72).multiply(new THREE.Matrix4().makeScale(2,.5,.4)),new THREE.Matrix4().set(1,.4,.1,3, 0,2,.3,-2, .1,0,-1,7, 0,0,0,1)];
  for(const matrix of matrices){const a=full.clone().applyMatrix4(matrix),b=result.geometry.clone().applyMatrix4(matrix),bound=zhengjuesiDistanceWorldError(result.proof.axisErrorBounds,matrix);assert(sampledDistance(a,b)<=bound);assert(sampledDistance(b,a)<=bound);a.dispose();b.dispose();}
  full.dispose();result.geometry.dispose();
});

test('a removed or duplicated clay cap cannot pass common-domain coverage',()=>{
  const full=source('zhengjuesi-prototype-convex-lap-cover-tile'),result=createZhengjuesiDistanceTile(full,{arcs:4}),broken=result.geometry.clone();
  const index=broken.index.array,last=index.length-6;index.copyWithin(last,last-6,last);assert.throws(()=>certifyZhengjuesiTileCorrespondence(full,broken,{sourceRows:3,targetRows:2}),/Incomplete/);
  full.dispose();result.geometry.dispose();broken.dispose();
});

test('altered source and unsupported projective transforms are rejected',()=>{
  const full=source('zhengjuesi-prototype-convex-lap-cover-tile');full.attributes.position.setX(0,.123);
  assert.throws(()=>createZhengjuesiDistanceTile(full),/differs/);assert.throws(()=>zhengjuesiDistanceWorldError([.1,.1,.1],new THREE.Matrix4().makePerspective(-1,1,1,-1,.1,100)),/affine/);full.dispose();
});

test('real rounded paving has a closed cube candidate with a bidirectional geometric bound',()=>{
  const full=new RoundedBoxGeometry(1,1,1,2,.022);full.name='zhengjuesi-prototype-dressed-stone';const before=full.attributes.position.array.slice(),result=createZhengjuesiDistanceStone(full);
  assert.equal(result.sourceTriangles,300);assert.equal(result.triangles,12);closed(full,1e-7);closed(result.geometry);assert(sampledDistance(full,result.geometry)<=result.proof.maximumError);assert(sampledDistance(result.geometry,full)<=result.proof.maximumError);
  const small=new THREE.Matrix4().makeScale(.4,.04,.35),large=new THREE.Matrix4().makeScale(30,.19,20);assert(zhengjuesiDistanceCandidateError(result,small)<.02);assert(zhengjuesiDistanceCandidateError(result,large)>.5);
  assert.deepEqual(full.attributes.position.array,before);assert.equal(result.proof.visualLightingAcceptance,false);full.dispose();result.geometry.dispose();
});

test('closed rods, columns and tile ends keep their full axial span while reducing angular detail',()=>{
  for(const [name,args] of [['rod-10',[1,1,1,10]],['tapered-round-column',[.97,1,1,28,3]],['solid-lotus-tile-end',[.103,.103,.03,20]]]){
    const full=new THREE.CylinderGeometry(...args);full.name='zhengjuesi-prototype-'+name;const result=createZhengjuesiDistanceCylinder(full,{arcs:4});closed(result.geometry,1e-8);
    assert(sampledDistance(full,result.geometry)<=result.proof.maximumError);assert(sampledDistance(result.geometry,full)<=result.proof.maximumError);
    const transform=new THREE.Matrix4().makeRotationZ(.57).multiply(new THREE.Matrix4().makeScale(.06,12,.09)),a=full.clone().applyMatrix4(transform),b=result.geometry.clone().applyMatrix4(transform),bound=zhengjuesiDistanceCandidateError(result,transform);
    assert(sampledDistance(a,b)<=bound);assert(sampledDistance(b,a)<=bound);assert(bound<.04);full.computeBoundingBox();result.geometry.computeBoundingBox();assert.equal(full.boundingBox.min.y,result.geometry.boundingBox.min.y);assert.equal(full.boundingBox.max.y,result.geometry.boundingBox.max.y);
    a.dispose();b.dispose();full.dispose();result.geometry.dispose();
  }
});

test('candidate provider keeps unknown source geometry and refuses changed known recipes',()=>{
  const unknown=new THREE.BoxGeometry();unknown.name='original-different-building';assert.deepEqual(zhengjuesiDistanceCandidates(unknown),[]);unknown.dispose();
  const altered=new THREE.CylinderGeometry(1,1,1,10);altered.name='zhengjuesi-prototype-rod-10';altered.attributes.position.setY(0,2);assert.throws(()=>zhengjuesiDistanceCandidates(altered),/differs/);altered.dispose();
});
