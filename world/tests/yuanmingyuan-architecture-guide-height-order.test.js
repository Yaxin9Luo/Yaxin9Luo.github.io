import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createMuseumGuideWorld} from '../src/yuanmingyuan/museum-guide-world.js';

const productionURL=new URL('../src/yuanmingyuan/architecture-surface.js',import.meta.url);
const beforeURL=new URL('../../work/yuanmingyuan/guide-support-native-next-review/source-before/architecture-surface.js',import.meta.url);
const beforeSource=readFileSync(beforeURL,'utf8');
assert.equal(createHash('sha256').update(beforeSource).digest('hex'),'8656130418c00b590ce6709e7f9b9bdaa448bf27c7f7d8f8ef7e489cd63b1270');
const importable=beforeSource.replace(/from '([^']+)'/g,(_match,id)=>`from '${id.startsWith('.')?new URL(id,productionURL).href:import.meta.resolve(id)}'`);
const {createArchitectureSurface:beforeFactory}=await import(`data:text/javascript;base64,${Buffer.from(importable).toString('base64')}`);
const flat=(x0,x1,z0,z1,y)=>[[x0,y,z0],[x0,y,z1],[x1,y,z0],[x1,y,z0],[x0,y,z1],[x1,y,z1]];
function triangles(vertices){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices.flat(),3));g.computeVertexNormals();return g;}
function fixture(){
  const group=new Group(),material=new MeshBasicMaterial(),geometries=new Set();
  return {group,material,geometries,add(g){geometries.add(g);const mesh=new Mesh(g,material);group.add(mesh);return mesh;},dispose(){for(const g of geometries)g.dispose();material.dispose();group.clear();}};
}
function owners(f,bounds={minX:-10,maxX:10,minZ:-10,maxZ:10},maxY=8){
  const before=beforeFactory(f.group),after=createArchitectureSurface(f.group);
  const old=before.createGuideSupport(bounds,{maxY,cellSize:1}),next=after.createGuideSupport(bounds,{maxY,cellSize:.25});
  return {before,after,old,next,compare(x,z,options){assert.deepEqual(next.surfaceAt(x,z,options),old.surfaceAt(x,z,options),`${x},${z} ${JSON.stringify(options)}`);},dispose(){old.dispose();next.dispose();before.dispose();after.dispose();}};
}

test('sorted exact height bounds skip lower layers while matching the actual frozen 865 source',()=>{
  const f=fixture();for(const y of [4,4.04,4.08,4.12,4.16]){const g=new PlaneGeometry(16,16,12,12);g.rotateX(-Math.PI/2);g.translate(0,y,0);f.add(g);}
  const o=owners(f);let disposedSource=0;for(const g of f.geometries)g.addEventListener('dispose',()=>disposedSource++);
  try{
    for(let i=0;i<3000;i++)o.compare(Math.sin(i*1.23817)*6+.0000031,Math.cos(i*.91279)*6+.0000073);
    const a=o.next.snapshot(),b=o.old.snapshot();
    assert(a.heightPrunedCandidates>0,'lower actual triangles are rejected before their candidate loop');
    assert(a.heightEarlyStops>2000);assert(a.triangleCandidates<b.triangleCandidates/2);
    assert.equal(a.triangleCount,b.triangleCount,'the improvement removes no source triangles');
    assert.equal(o.after.diagnostics.geometryCount,5,'only the original geometry BVHs exist');
  }finally{o.dispose();assert.equal(disposedSource,0);assert.equal(o.next.snapshot().triangleCount,0);assert.equal(o.next.snapshot().triangleIndexReferences,0);f.dispose();assert.equal(disposedSource,5);}
});

test('higher steep first hits, real holes, same-height ties and lower-plane edges retain strict 865 results',()=>{
  const f=fixture();f.add(triangles([...flat(-8,8,-8,8,4),...flat(-5,-.2,-3,3,4.6),...flat(.2,5,-3,3,4.6),[-1,4.7,-1],[-1,4.7,1],[1,6.7,-1]]));
  f.add(triangles([...flat(-2,2,4,6,5),[-2,4.8,4],[-2,4.8,6],[2,5.2,4]]));f.add(triangles(flat(-2,2,4,6,5)));
  const o=owners(f);
  try{
    assert.equal(o.next.surfaceAt(0,.17).height,4,'no slab fills the opening');
    assert.equal(o.next.surfaceAt(-.3,-.3).walkable,false,'the slope remains the first hit');
    for(const edge of [-5,-2,-.2,0,.2,2,5])for(const delta of [-1e-7,-1e-10,0,1e-10,1e-7])for(const z of [-3,-1,.17,1,3,4,4.3,5,6])o.compare(edge+delta,z);
    for(let i=0;i<500;i++)o.compare(-1.3+i*.0051,4.31,{maxY:[4.59,4.6,4.60000001,5,8][i%5],minY:i%3===0?4.6:-1000});
    assert(o.next.snapshot().triangleFallbackQueries>0);assert(o.next.snapshot().raycasts>0);
  }finally{o.dispose();f.dispose();}
});

test('unsafe triangles are checked even when wholly below the winning top surface',()=>{
  const f=fixture();f.add(triangles([...flat(-5,5,-5,5,5),[-5e-10,4.2,-1],[-5e-10,4.2,1],[5e-10,4.8,0]]));
  const o=owners(f);
  try{
    o.compare(0,.17);assert.equal(o.next.surfaceAt(0,.17).height,5);
    assert(o.next.snapshot().unsafeTriangles>0);assert(o.next.snapshot().triangleFallbackQueries>=2,'early-stop must not hide an unsafe AABB boundary');
    for(const x of [-1e-8,-1e-10,0,1e-10,1e-8])o.compare(x,.13);
  }finally{o.dispose();f.dispose();}
});

test('world affine placement, negative instances, height boundaries and source buffers match frozen 865',()=>{
  const f=fixture(),floor=f.add(new BoxGeometry(24,.2,24));floor.position.y=3.9;
  const g=new BoxGeometry(4,.08,3),instances=new InstancedMesh(g,f.material,3);f.group.add(instances);f.geometries.add(g);
  instances.setMatrixAt(0,new Matrix4().makeScale(-1,1,1.4).setPosition(-5,4.1,0));
  instances.setMatrixAt(1,new Matrix4().makeScale(1.2,.7,.8).setPosition(0,4.100001,0));
  instances.setMatrixAt(2,new Matrix4().makeScale(2e-8,1,1).setPosition(5,4.2,0));
  f.group.position.set(563,.3,-346);f.group.rotation.set(.009,.31,-.007);f.group.scale.set(1.01,.94,1.12);
  const original={index:g.index.array.slice(),positions:g.attributes.position.array.slice(),instances:instances.instanceMatrix.array.slice()};
  const o=owners(f,{minX:546,maxX:580,minZ:-363,maxZ:-329},8);
  try{
    for(let i=0;i<4000;i++)o.compare(548+((i*83497)%100003)/100003*30,-361+((i*43183)%99991)/99991*30,{maxY:[4.05,4.3,4.4,5,8,9,Infinity][i%7],minY:i%11===0?4.2:-1000});
    assert.deepEqual(g.index.array,original.index);assert.deepEqual(g.attributes.position.array,original.positions);assert.deepEqual(instances.instanceMatrix.array,original.instances);
    assert(o.next.snapshot().fallbackQueries>0);assert(o.next.snapshot().unsafeTriangles>0);
  }finally{o.dispose();f.dispose();}
});

test('0.25 m museum guide binding retains exact support, dry/wet decisions and geometry lifetime',()=>{
  const f=fixture(),mesh=f.add(new BoxGeometry(20,.2,20));mesh.position.y=3.9;
  const old=beforeFactory(f.group),next=createArchitectureSurface(f.group),terrain={colliders:[],surfaceAt:x=>({height:3.6,normal:[0,1,0],walkable:true,...(x<0?{waterY:4.2}:{})})};
  const a=createMuseumGuideWorld({site:{position:[0,4,0]},terrain,architecture:{surfaceAt:old.surfaceAt}}),b=createMuseumGuideWorld({site:{position:[0,4,0]},terrain,architecture:next});
  try{
    for(let i=0;i<500;i++){const x=-8+i*.03137,z=Math.sin(i*.63)*8;assert.deepEqual(b.heightAt.surfaceAt(x,z),a.heightAt.surfaceAt(x,z));}
    assert.equal(b.snapshot().localArchitectureSupport.cellSize,.25);
    assert.equal(b.heightAt(-1,.17),undefined);assert.equal(b.heightAt(1,.17),a.heightAt(1,.17));
  }finally{a.dispose();b.dispose();old.dispose();next.dispose();f.dispose();}
});
