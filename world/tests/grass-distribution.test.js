import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGrassTuftVariants,grassTangentPlacement} from '../src/grass-geometry.js';
import {createGrassDistribution,grassRootSupport} from '../src/grass-distribution.js';
import {partitionPlantBatch} from '../src/plant-batches.js';
import {applyEnvironmentWind,attachWindShadows,environmentWind} from '../src/environment-wind.js';

function matrix(p,lawnAt=()=>0){
  const object=new THREE.Object3D();object.position.set(p.x,p.y,p.z);object.rotation.set(p.rx||0,p.r||0,p.rz||0);
  object.scale.set(p.sx||p.s||1,(p.sy||p.s||1)*(1-lawnAt(p.x,p.z)*.70),p.sz||p.s||1);object.updateMatrix();return object.matrix;
}
const bytes=geometry=>JSON.stringify([...Object.values(geometry.attributes),geometry.index].map(attribute=>Array.from(attribute.array)));
function fixture(t){
  const geometries=createGrassTuftVariants();t.after(()=>geometries.forEach(geometry=>geometry.dispose()));
  const heightAt=(x,z)=>6+.24*x-.17*z;
  heightAt.surfaceAt=(x,z)=>({height:heightAt(x,z),normal:new THREE.Vector3(-.24,1,.17).normalize()});
  const originals=[[-5,-.6],[-3,.6],[-1,-.6],[1,.6],[3,-.6],[5,.6],[7,-.6],[100,100]].map(([x,z],i)=>({x,y:heightAt(x,z)-.025,z,s:.75+i*.07,r:i*.61}));
  const drifts=[{id:'test-ribbon',seed:17,density:6,points:[[-6,0,1.8],[0,.2,2],[8,0,1.6]]}];
  return {geometries,heightAt,originals,drifts};
}

test('grass distribution keeps original prefixes, source bytes and reserved/outside matrices',t=>{
  const f=fixture(t),before=structuredClone(f.originals),source=f.geometries.map(bytes),reserved=(x,z)=>x>=0&&x<=2&&Math.abs(z)<=1;
  const options={drifts:f.drifts,reserved},result=createGrassDistribution(f.originals,f.geometries,f.heightAt,options);
  assert.deepEqual(f.originals,before,'caller placements are not rewritten');assert.deepEqual(f.geometries.map(bytes),source,'accepted blade attributes and indices are not edited');
  assert.equal(result.stats.original,f.originals.length);assert.equal(result.stats.added,result.groups.reduce((n,g)=>n+g.length,0)-f.originals.length);
  assert.equal(result.stats.total,result.stats.original+result.stats.added);assert.equal(result.stats.candidates,result.stats.added+Object.values(result.stats.rejected).reduce((a,b)=>a+b,0),'every attempted point has one recorded outcome');
  assert.ok(result.stats.added>0,'the authored drift receives its low cover');assert.ok(result.stats.loweredOriginal>0,'the original tall fans join the height mixture');
  for(const [i,p]of f.originals.entries()){
    const variant=i%3,index=Math.floor(i/3),next=result.groups[variant][index];
    assert.deepEqual([next.x,next.y,next.z,next.s],[p.x,p.y,p.z,p.s],'original centers, scale and variant order survive');
    assert.equal(result.originalCounts[variant],f.originals.filter((_,j)=>j%3===variant).length);
    if(reserved(p.x,p.z)||p.x===100)assert.deepEqual(matrix(next).elements,matrix(grassTangentPlacement(p,f.heightAt)).elements);
  }
  assert.deepEqual(createGrassDistribution(f.originals,f.geometries,f.heightAt,options),result,'the independent seeds reproduce the whole grass result');
});

test('every added point rechecks terrain, reservations and exclusions with its own rooted transform',t=>{
  const f=fixture(t),reserved=(x,z)=>x>2&&x<3,allowed=(x,z)=>x<0||x>.4;
  const heightAt=(x,z)=>x>6?-22:f.heightAt(x,z);heightAt.surfaceAt=(x,z)=>({height:heightAt(x,z),normal:new THREE.Vector3(-.24,1,.17).normalize()});
  const result=createGrassDistribution(f.originals,f.geometries,heightAt,{drifts:f.drifts,allowed,reserved});
  assert.ok(result.stats.added>0);assert.ok(result.stats.rejected.reserved>0);assert.ok(result.stats.rejected.excluded>0);assert.ok(result.stats.rejected.terrain>0);
  for(const [variant,group]of result.groups.entries())for(const p of group.slice(result.originalCounts[variant])){
    assert.equal(p.y,heightAt(p.x,p.z)-.025,'each offset samples its own surface height');assert.ok(p.sy<p.s,'new growth uses a lower height without dropping geometry');
    const transform=matrix(p),up=new THREE.Vector3(0,1,0).transformDirection(transform);
    assert.ok(up.distanceTo(new THREE.Vector3(-.24,1,.17).normalize())<1e-10);
    for(const index of f.geometries[variant].userData.grass.rootIndices){
      const root=new THREE.Vector3().fromBufferAttribute(f.geometries[variant].attributes.position,index).applyMatrix4(transform);
      assert.ok(allowed(root.x,root.z)&&!reserved(root.x,root.z));assert.ok(heightAt(root.x,root.z)>=.6);
      assert.ok(root.y<=heightAt(root.x,root.z)+1e-6&&root.y>=heightAt(root.x,root.z)-.06);
    }
  }
});

test('root footprint rejects cliff edges and boundary crossings even when the center is permitted',t=>{
  const f=fixture(t),geometry=f.geometries[0],p={x:0,y:5.975,z:0,s:1.1,sy:.5,r:.8};
  const flat=()=>6,planted=grassTangentPlacement(p,flat);
  assert.equal(grassRootSupport(planted,geometry,flat).supported,true);
  assert.equal(grassRootSupport(planted,geometry,(x,z)=>x>.002?-22:6).supported,false,'a center above land cannot grant support to overhanging roots');
  assert.equal(grassRootSupport(planted,geometry,flat,{allowed:(x,z)=>x<.002}).supported,false,'roots do not cross an exclusion edge');
  assert.equal(grassRootSupport({...planted,y:5.6},geometry,flat).supported,false,'deeply buried geometry is not a support fix');
  assert.equal(grassRootSupport({...planted,rx:NaN},geometry,flat).supported,false,'invalid poses never qualify as supported');
});

test('root support uses the Float32 instance transform that will actually be drawn',t=>{
  const f=fixture(t),geometry=f.geometries[0],p={x:100.0000039,y:5.975,z:0,s:1.1,sy:.5,r:.8},transform=matrix(p),packed=new THREE.Matrix4().fromArray(new Float32Array(transform.elements));
  const furthest=m=>Math.max(...geometry.userData.grass.rootIndices.map(index=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,index).applyMatrix4(m).x));
  const before=furthest(transform),after=furthest(packed);assert.ok(after>before,'the instance buffer moves this root outward');
  const edge=(before+after)/2,shore=x=>x>edge?-22:6;
  assert.ok(p.x<edge);assert.equal(grassRootSupport(p,geometry,shore).supported,false,'a packed root over the edge is rejected before batching');
});

test('authored area density fills between existing sites and does not grow where all points are reserved',t=>{
  const f=fixture(t),result=createGrassDistribution(f.originals,f.geometries,f.heightAt,{drifts:f.drifts}),added=result.groups.flatMap((g,i)=>g.slice(result.originalCounts[i]));
  assert.ok(added.some(p=>Math.min(...f.originals.map(o=>Math.hypot(p.x-o.x,p.z-o.z)))>.8),'coverage spans the space between the original roots');
  assert.ok(added.every(p=>p.x>-8&&p.x<10&&Math.abs(p.z)<2.3),'the authored ribbon bounds contain all growth');
  assert.ok(new Set(added.map(p=>p.x.toFixed(6))).size===added.length,'the field does not stamp repeated rows');
  const reserved=createGrassDistribution(f.originals,f.geometries,f.heightAt,{drifts:f.drifts,reserved:()=>true});
  assert.equal(reserved.stats.added,0);assert.equal(reserved.stats.loweredOriginal,0);
  const empty=createGrassDistribution([],f.geometries,f.heightAt,{drifts:f.drifts});assert.equal(empty.stats.added,0,'new patches remain attached to existing meadow sites');
});

test('short grass instances share complete geometry and retain wind containment after cell partitioning',t=>{
  const f=fixture(t),result=createGrassDistribution(f.originals,f.geometries,f.heightAt,{drifts:[{...f.drifts[0],density:1.2}]}),lawnAt=()=>.35;
  assert.ok(result.groups.flat().some(p=>p.sy<p.s),'the wind fixture includes actual shortened instances');
  for(const [variant,placements]of result.groups.entries()){
    const material=applyEnvironmentWind(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide}),{amplitude:.18,minHeight:0,maxHeight:.7}),geometry=f.geometries[variant],source=new THREE.InstancedMesh(geometry,material,placements.length);
    source.name=`Grass drift ${variant}`;source.castShadow=false;source.receiveShadow=true;attachWindShadows(source);const parent=new THREE.Group();parent.add(source);parent.rotation.y=.4;parent.scale.set(.7,1.2,1.4);
    placements.forEach((p,i)=>source.setMatrixAt(i,matrix(p,lawnAt)));const chunks=partitionPlantBatch(source);parent.updateMatrixWorld(true);
    for(const chunk of chunks){
      assert.equal(chunk.geometry,geometry);assert.equal(chunk.material,material);assert.equal(chunk.castShadow,false);assert.equal(chunk.receiveShadow,true);
      const sphere=chunk.boundingSphere.clone().applyMatrix4(chunk.matrixWorld);
      const m=new THREE.Matrix4(),worldMatrix=new THREE.Matrix4();
      for(let i=0;i<chunk.count;i++){
        chunk.getMatrixAt(i,m);worldMatrix.multiplyMatrices(chunk.matrixWorld,m);
        for(let j=0;j<geometry.attributes.position.count;j++){
          const p=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,j),world=p.clone().applyMatrix4(worldMatrix),phase=world.x*.12+world.z*.09+p.y*.53;
          const gust=Math.sin(.4*.9+phase)*.78+Math.sin(.4*.37+phase*.61)*.22,h=THREE.MathUtils.clamp(p.y/.7,0,1),bend=gust*.18*h*h*(3-2*h);
          for(let axis=0;axis<3;axis++){const e=worldMatrix.elements,at=axis*4,x=e[at],y=e[at+1],z=e[at+2];p.setComponent(axis,p.getComponent(axis)+bend*(environmentWind.direction.x*x+environmentWind.direction.y*z)/Math.max(x*x+y*y+z*z,.0001));}
          assert.ok(chunk.boundingBox.containsPoint(p.applyMatrix4(m)),'low Y scales remain in the real padded cell bounds');
          assert.ok(sphere.containsPoint(p.applyMatrix4(chunk.matrixWorld)),'reflected and shadow frusta retain the same wind containment');
        }
      }
    }
    material.dispose();
  }
});
