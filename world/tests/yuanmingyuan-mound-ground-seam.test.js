import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {moundGeometry} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import {thickPatch} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createMoundGroundMaterialBinding} from '../src/yuanmingyuan/mound-ground-material-binding.js';

const bytes=attribute=>attribute?Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength):Buffer.alloc(0);
const digest=geometry=>createHash('sha256').update(Buffer.concat([geometry.index,...Object.values(geometry.attributes)].filter(Boolean).map(bytes))).digest('hex');
const close=(a,b,tolerance=2e-6)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function fixture(geometry){
  const root=new THREE.Group(),mound=new THREE.Group(),sourceMaterial=new THREE.MeshStandardMaterial(),earthMaterial=new THREE.MeshStandardMaterial({vertexColors:true});
  mound.name='xianfashan-complete-earth-mound';sourceMaterial.name='xianfashan-compact-earth-and-moss';sourceMaterial.userData.category='terrain';
  const mesh=new THREE.Mesh(geometry,sourceMaterial);mound.add(mesh);root.add(mound);root.position.set(925,4,-640);root.updateMatrixWorld(true);
  const resource={group:root},terrain={earthMaterial,colorAt:(x,y,z,target)=>target.setRGB(.2,.4,.1)};
  const bind=()=>createMoundGroundMaterialBinding({assetId:'xianfashan',resource,terrain});
  return {root,mesh,geometry,sourceMaterial,earthMaterial,resource,terrain,bind,dispose(){geometry.dispose();sourceMaterial.dispose();earthMaterial.dispose();}};
}
const rayAt=(mesh,x,z)=>new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];

test('the actual flat north rim loses the buried side-wall normal while all original source/BVH positions stay unchanged',()=>{
  // Preserve the production north-to-south grid spacing. Eight longitudinal
  // columns keep this a small original-component fixture; the tested rim is flat.
  const f=fixture(moundGeometry(8,180)),before=digest(f.geometry),support=createArchitectureSurface(f.root);
  const samples=[-.01,.0001,.001,.01,.1,.2867,.6].map(dz=>({x:910,z:-665.8+dz}));
  const expected=samples.map(p=>support.surfaceAt(p.x,p.z,{maxY:5})),old=rayAt(f.mesh,910,-665.7999);
  assert(old);close(old.face.normal.y,1);assert(old.normal.y<.70,'the reported 46 degree source shading defect is present');
  let owner;
  try{
    owner=f.bind();const current=rayAt(f.mesh,910,-665.7999);close(current.point.y,4);close(current.face.normal.y,1);close(current.normal.y,1);close(current.normal.z,0);
    for(let i=0;i<samples.length;i++){const p=samples[i];assert.deepEqual(support.surfaceAt(p.x,p.z,{maxY:5}),expected[i]);}
    assert.equal(digest(f.geometry),before);assert.deepEqual(bytes(f.mesh.geometry.attributes.position),bytes(f.geometry.attributes.position));assert.deepEqual(bytes(f.mesh.geometry.index),bytes(f.geometry.index));
    assert.equal(support.disposed,false);
  }finally{owner?.dispose();assert.equal(f.mesh.geometry,f.geometry);support.dispose();f.dispose();}
});

test('all four rim edges and corners use the actual sloping top, never forced world-up or buried wall normals',()=>{
  for(const indexed of [true,false]){
    let geometry=thickPatch((u,v)=>[6*u-3,.6*u+.8*v,4*v-2],4,5,.3);
    if(!indexed){const original=geometry;geometry=original.toNonIndexed();original.dispose();}
    const f=fixture(geometry),before=digest(geometry),sourceNormal=Buffer.from(bytes(geometry.attributes.normal)),up=new THREE.Vector3(-.1,1,-.2).normalize();let owner;
    try{
      owner=f.bind();const clone=f.mesh.geometry,p=clone.attributes.position,n=clone.attributes.normal,topVertices=new Set();
      for(let face=0;face<(clone.index?.count??p.count);face+=3){
        const ids=[0,1,2].map(i=>clone.index?clone.index.getX(face+i):face+i),points=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
        const cross=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
        if(cross.y>0)for(const id of ids)topVertices.add(id);
      }
      const corners=new Set(),sides=new Set();let checked=0,unchanged=0;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i),rim=Math.abs(x)===3||Math.abs(z)===2;
        if(rim&&topVertices.has(i)){
          const actual=new THREE.Vector3().fromBufferAttribute(n,i);close(actual.x,up.x);close(actual.y,up.y);close(actual.z,up.z);checked++;
          if(Math.abs(x)===3)sides.add('x'+Math.sign(x));if(Math.abs(z)===2)sides.add('z'+Math.sign(z));if(Math.abs(x)===3&&Math.abs(z)===2)corners.add(x+','+z);
        }else{for(let c=0;c<3;c++)assert.equal(n.getComponent(i,c),geometry.attributes.normal.getComponent(i,c));unchanged++;}
      }
      assert.equal(sides.size,4);assert.equal(corners.size,4);assert(checked>=18);assert(unchanged>checked/2);assert(up.y<.99,'this is a real slope, not an upward-normal fixture');
      assert.deepEqual(bytes(clone.attributes.position),bytes(geometry.attributes.position));assert.deepEqual(bytes(clone.index),bytes(geometry.index));assert.deepEqual(bytes(geometry.attributes.normal),sourceNormal);assert.equal(digest(geometry),before);
    }finally{owner?.dispose();f.dispose();}
  }
});

test('unequal neighboring top slopes contribute their actual triangle area at a shared rim point',()=>{
  for(const indexed of [true,false]){
    // The left cell is 1m wide with +.5 slope; the right is 3m wide with -1/6.
    // At the north middle vertex one left and two right triangles meet:
    // [-1,2,-.2] + 2*[1,6,-.6] = [1,14,-1.4], before normalization.
    let geometry=thickPatch((u,v)=>[u<=.5?-2+2*u:-1+6*(u-.5),(u<=.5?u:1-u)+.2*v,2*v-1],2,1,.3);
    if(!indexed){const original=geometry;geometry=original.toNonIndexed();original.dispose();}
    const f=fixture(geometry),expected=new THREE.Vector3(1,14,-1.4).normalize();let owner;
    try{
      owner=f.bind();const p=geometry.attributes.position,n=f.mesh.geometry.attributes.normal;let checked=0;
      for(let i=0;i<p.count;i++)if(p.getX(i)===-1&&p.getY(i)===.5&&p.getZ(i)===-1){
        if(!indexed){const start=Math.floor(i/3)*3,a=new THREE.Vector3().fromBufferAttribute(p,start),b=new THREE.Vector3().fromBufferAttribute(p,start+1),c=new THREE.Vector3().fromBufferAttribute(p,start+2);if(b.sub(a).cross(c.sub(a)).y<=0)continue;}
        close(n.getX(i),expected.x);close(n.getY(i),expected.y);close(n.getZ(i),expected.z);checked++;
      }
      assert.equal(checked,indexed?1:3);
    }finally{owner?.dispose();f.dispose();}
  }
});

test('seam repair is local to the display owner and restores before releasing the clone without touching original geometry or terrain material',()=>{
  const f=fixture(moundGeometry(8,12)),before=digest(f.geometry);let cloneDisposed=0,sourceDisposed=0,earthDisposed=0,owner;
  f.geometry.addEventListener('dispose',()=>sourceDisposed++);f.earthMaterial.addEventListener('dispose',()=>earthDisposed++);
  try{
    owner=f.bind();const clone=f.mesh.geometry;clone.addEventListener('dispose',()=>{cloneDisposed++;assert.equal(f.mesh.geometry,f.geometry);assert.equal(f.mesh.material,f.sourceMaterial);});
    assert.notDeepEqual(bytes(clone.attributes.normal),bytes(f.geometry.attributes.normal));owner.dispose();owner.dispose();
    assert.equal(cloneDisposed,1);assert.equal(sourceDisposed,0);assert.equal(earthDisposed,0);assert.equal(digest(f.geometry),before);
  }finally{owner?.dispose();f.dispose();}
});
