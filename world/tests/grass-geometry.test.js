import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGrassTuftVariants,grassTangentPlacement} from '../src/grass-geometry.js';
import {partitionPlantBatch} from '../src/plant-batches.js';
import {applyEnvironmentWind,attachWindShadows,environmentWind} from '../src/environment-wind.js';

const position=(geometry,index)=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,index);
const raw=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
function instance(placement){
  const object=new THREE.Object3D();object.position.set(placement.x,placement.y,placement.z);object.rotation.set(placement.rx||0,placement.r||0,placement.rz||0);object.scale.setScalar(placement.s);object.updateMatrix();return object.matrix;
}

test('three independent complete tufts have curved folded blades and single nondegenerate tips',()=>{
  const variants=createGrassTuftVariants(),repeated=createGrassTuftVariants(),signatures=new Set();
  assert.equal(variants.length,3);
  for(const [variant,geometry]of variants.entries()){
    const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,colors=geometry.attributes.color,indices=geometry.index;
    for(const attribute of[p,n,uv,colors])assert.ok(attribute.array.every(Number.isFinite));
    for(const key of Object.keys(geometry.attributes))assert.deepEqual(raw(geometry.attributes[key].array),raw(repeated[variant].attributes[key].array),'local seeds reproduce complete attributes');
    signatures.add(raw(p.array).toString('base64'));
    assert.equal(geometry.userData.grass.blades.length,32,'retain every complete blade');
    const owners=new Map();
    for(const [blade,{start,count}]of geometry.userData.grass.blades.entries()){
      const stations=new Map();
      for(let i=start;i<start+count;i++){owners.set(i,blade);const t=uv.getY(i);if(!stations.has(t))stations.set(t,[]);stations.get(t).push(i);}
      assert.equal(stations.size,9,'longitudinal detail is added, not removed');
      const rows=[...stations.values()];
      for(const row of rows.slice(0,-1))assert.equal(row.length,3,'both leaf halves meet an actual midrib');
      assert.equal(rows.at(-1).length,1,'one tip must close the blade without coincident vertices');
      const tip=position(geometry,rows.at(-1)[0]);assert.ok(tip.y>=.18&&tip.y<=.53,'source blade height range is retained');
      const widths=rows.slice(0,-1).map(row=>position(geometry,row[0]).distanceTo(position(geometry,row[2])));
      assert.ok(widths[0]<Math.max(...widths.slice(1)),'a basal neck replaces the full-width rectangle');
      assert.ok(Math.max(...widths)<.028,'each narrow blade is finer than the old minimum full width');
      assert.ok(widths.at(-1)<Math.max(...widths),'the shoulder tapers into the tip');
      let folded=0,curved=0;
      const base=position(geometry,rows[0][1]);
      for(const row of rows.slice(1,-1)){
        const a=position(geometry,row[0]),b=position(geometry,row[1]),c=position(geometry,row[2]),mid=a.clone().lerp(c,.5);
        folded=Math.max(folded,mid.distanceTo(b));curved=Math.max(curved,mid.distanceTo(base.clone().lerp(tip,uv.getY(row[1]))));
      }
      assert.ok(folded>1e-5,'the midrib has real shallow volume');assert.ok(curved>1e-3,'the centre line is curved');
    }
    for(let i=0;i<p.count;i++){
      const point=position(geometry,i);assert.ok(geometry.boundingBox.containsPoint(point));assert.ok(geometry.boundingSphere.containsPoint(point));
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5,'every vertex has a finite unit normal');
    }
    for(let i=0;i<indices.count;i+=3){
      const ids=[0,1,2].map(j=>indices.getX(i+j));assert.ok(ids.every(j=>j>=0&&j<p.count));assert.ok(ids.every(j=>owners.get(j)===owners.get(ids[0])),'separate blades must not be connected');
      const a=position(geometry,ids[0]),b=position(geometry,ids[1]),c=position(geometry,ids[2]);assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-16,'the terminal face and folded halves retain area');
    }
    for(const root of geometry.userData.grass.rootIndices)assert.equal(p.getY(root),0,'the root plane remains anchored');
    geometry.dispose();repeated[variant].dispose();
  }
  assert.equal(signatures.size,variants.length,'the field receives three distinct rooted fans');
});

test('grass tangent follows actual support while preserving accepted centres and scale',()=>{
  const geometries=createGrassTuftVariants(),p={x:1.3,z:-2.7,s:1.43,r:1.7};
  for(const [dx,dz]of[[0,0],[.4,-.3],[-1.2,.7],[3.5,-2]]){
    const heightAt=(x,z)=>6+dx*x+dz*z,before={...p,y:heightAt(p.x,p.z)-.025},after=grassTangentPlacement(before,heightAt),matrix=instance(after);
    for(const key of['x','y','z','s'])assert.equal(after[key],before[key]);assert.equal(before.r,p.r,'input placement is not mutated');
    const up=new THREE.Vector3(0,1,0).transformDirection(matrix),normal=new THREE.Vector3(-dx,1,-dz).normalize();assert.ok(up.distanceTo(normal)<1e-12);
    for(const geometry of geometries)for(const i of geometry.userData.grass.rootIndices){const root=position(geometry,i).applyMatrix4(matrix);assert.ok(root.y<=heightAt(root.x,root.z)+1e-9,'tilting the root plane must not expose floating endpoints');}
  }
  const shore=(x,z)=>z<0?-22:6;
  for(const z of[.005,.015,.024,.026,.04,.05]){
    const matrix=instance(grassTangentPlacement({...p,z,y:shore(p.x,z)-.025},shore));
    for(const geometry of geometries)for(const i of geometry.userData.grass.rootIndices){const root=position(geometry,i).applyMatrix4(matrix);assert.ok(root.y<=shore(root.x,root.z)+1e-9,'a narrow rooted cluster must stay attached beside a clipped shore');}
  }
  // A supplied triangle normal avoids differentiating a neighboring raised
  // surface boundary; the selected surface remains the authority.
  const heightAt=()=>{throw new Error('must use selected triangle normal');};heightAt.surfaceAt=()=>({height:5,normal:{x:0,y:1,z:0}});
  const p2={...p,y:4.975},result=grassTangentPlacement(p2,heightAt);assert.ok(new THREE.Vector3(0,1,0).transformDirection(instance(result)).distanceTo(new THREE.Vector3(0,1,0))<1e-12);
  assert.throws(()=>grassTangentPlacement(p,()=>NaN),/finite terrain normal/);
  geometries.forEach(geometry=>geometry.dispose());
});

test('every variant keeps conservative 32m cell bounds under the existing wind shader',()=>{
  for(const [variant,geometry]of createGrassTuftVariants().entries()){
    const material=applyEnvironmentWind(new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),{amplitude:.18,minHeight:0,maxHeight:.7}),source=new THREE.InstancedMesh(geometry,material,3),parent=new THREE.Group();
    source.name=`Grass fixture ${variant}`;source.castShadow=false;source.receiveShadow=true;attachWindShadows(source);parent.add(source);
    parent.rotation.y=.4;parent.scale.set(.7,1.2,1.4);
    const heightAt=(x,z)=>6+.7*x-.4*z;
    for(const [i,x]of[-.1,4,40].entries())source.setMatrixAt(i,instance(grassTangentPlacement({x,y:heightAt(x,2)-.025,z:2,s:.64+i*.38,r:.3+i},heightAt)));
    const chunks=partitionPlantBatch(source);parent.updateMatrixWorld(true);
    assert.equal(chunks.reduce((sum,mesh)=>sum+mesh.count,0),source.count);
    const matrix=new THREE.Matrix4(),transform=new THREE.Matrix4();
    for(const chunk of chunks){
      assert.equal(chunk.userData.plantBatch.cellSize,32);assert.equal(chunk.geometry,geometry);assert.equal(chunk.material,material);assert.equal(chunk.visible,true);assert.equal(chunk.frustumCulled,true);
      assert.equal(chunk.castShadow,false);assert.equal(chunk.customDepthMaterial,source.customDepthMaterial);assert.equal(chunk.customDistanceMaterial,source.customDistanceMaterial);
      assert.ok(Number.isFinite(chunk.userData.plantBatch.windPadding)&&chunk.userData.plantBatch.windPadding>0);
      const sphere=chunk.boundingSphere.clone().applyMatrix4(chunk.matrixWorld);
      for(let i=0;i<chunk.count;i++){
        chunk.getMatrixAt(i,matrix);transform.multiplyMatrices(chunk.matrixWorld,matrix);
        for(let vertex=0;vertex<geometry.attributes.position.count;vertex++)for(const time of[0,.4,9]){
          const p=position(geometry,vertex),world=p.clone().applyMatrix4(transform),phase=world.x*.12+world.z*.09+p.y*.53;
          const gust=Math.sin(time*.9+phase)*.78+Math.sin(time*.37+phase*.61)*.22,h=THREE.MathUtils.clamp(p.y/.7,0,1),bend=gust*.18*h*h*(3-2*h);
          for(let axis=0;axis<3;axis++){
            const offset=axis*4,e=transform.elements,x=e[offset],y=e[offset+1],z=e[offset+2];p.setComponent(axis,p.getComponent(axis)+bend*(environmentWind.direction.x*x+environmentWind.direction.y*z)/Math.max(x*x+y*y+z*z,.0001));
          }
          const local=p.clone().applyMatrix4(matrix);assert.ok(chunk.boundingBox.containsPoint(local),'the actual folded vertex stays in its expanded cell box');assert.ok(sphere.containsPoint(local.applyMatrix4(chunk.matrixWorld)),'main, reflected and shadow frusta receive conservative bounds');
        }
      }
    }
    material.dispose();geometry.dispose();
  }
});
