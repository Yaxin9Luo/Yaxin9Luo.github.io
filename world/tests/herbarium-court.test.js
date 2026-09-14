import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {prepareHerbariumGeometry,decodeGeometryGLB} from './helpers/herbarium-source.js';
import {loadBotanicalAssets} from '../src/botanical-cache.js';
import {createGardenSpecimen} from '../src/gardens.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {renderedTerrainHeight} from '../src/world.js';

// Real original court geometry and complete decoded botanical sources. No
// artistic coverage/count target substitutes for source contact and clearance.
test('court underplanting follows actual loam and preserves original specimens, curbs and paving',async()=>{
  await prepareHerbariumGeometry();await loadBotanicalAssets({loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL(`../public${asset.url}`,import.meta.url)))});
  const court=createGardenSpecimen('courtyard');court.position.set(0,6,31);court.updateMatrixWorld(true);
  const root=new THREE.Group(),district=createHerbariumDistrict(root,{heightAt:renderedTerrainHeight});
  const original=court.children.map(m=>({mesh:m,geometry:m.geometry,matrix:m.matrixWorld.toArray()}));
  district.plantCourtyard(court);root.updateMatrixWorld(true);
  const plants=district.plantings.filter(p=>p.userData.soilBed);assert.deepEqual([...new Set(plants.map(p=>p.userData.soilBed))].sort(),['court-east','court-near','court-west']);
  for(const id of ['court-near','court-east','court-west'])assert.deepEqual([...new Set(plants.filter(p=>p.userData.soilBed===id).map(p=>p.userData.botanicalSource.id))].sort(),['fern_02','periwinkle_plant'],'actual clipping retains both underplanting layers');
  const soil=court.children.find(m=>m.material?.name==='Cultivated garden earth'),ray=new THREE.Raycaster(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(a,b,c);
  const crowns=plants.map(plant=>({plant,box:new THREE.Box3().setFromObject(plant)}));
  const soilTriangles=[];{const p=soil.geometry.attributes.position,index=soil.geometry.index;
    for(let i=0;i<(index?.count||p.count);i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(soil.matrixWorld));if(new THREE.Triangle(...v).getNormal(new THREE.Vector3()).y>.99)soilTriangles.push(v);}}
  const trunks=(court.userData.colliders||[]).filter(s=>s.name==='ornamental tree trunk');assert.ok(trunks.length>0);
  const trunkBoxes=trunks.map(s=>{const x=s.planes.find(p=>p[0]>.9999)[3],X=-s.planes.find(p=>p[0]<-.9999)[3],z=s.planes.find(p=>p[2]>.9999)[3],Z=-s.planes.find(p=>p[2]<-.9999)[3];return new THREE.Box3(new THREE.Vector3(X,s.bottom,Z),new THREE.Vector3(x,s.top,z)).applyMatrix4(court.matrixWorld).expandByScalar(.06);});
  let permittedEmptyCrownBox=false;
  for(const {plant,box}of crowns){
    assert.ok(['fern_02','periwinkle_plant'].includes(plant.userData.botanicalSource.id));
    ray.set(new THREE.Vector3(plant.position.x,20,plant.position.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(soil,false)[0];assert.ok(hit&&Math.abs(hit.point.y-plant.position.y)<.002,'root uses real soil top');
    for(const trunk of trunkBoxes){assert.ok(plant.position.x<trunk.min.x-.12||plant.position.x>trunk.max.x+.12||plant.position.z<trunk.min.z-.12||plant.position.z>trunk.max.z+.12,'actual root stays outside trunk pocket');if(box.intersectsBox(trunk))permittedEmptyCrownBox=true;}
    const top=soilTriangles.filter(t=>Math.abs(t[0].y-plant.position.y)<.002),v=new THREE.Vector3();
    plant.traverse(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
      for(let i=0;i<positions.count;i++){
        v.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
        assert.ok(top.some(([a,b,c])=>{const dx=b.x-a.x,dz=b.z-a.z,ex=c.x-a.x,ez=c.z-a.z,det=dx*ez-ex*dz,u=((v.x-a.x)*ez-(v.z-a.z)*ex)/det,w=(dx*(v.z-a.z)-dz*(v.x-a.x))/det;return u>=-1e-7&&w>=-1e-7&&u+w<=1+1e-7;}),'every actual source vertex stays over delivered soil');
      }
      for(const trunk of trunkBoxes){if(!box.intersectsBox(trunk))continue;for(let i=0;i<index.count;i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(positions,index.getX(i+k)).applyMatrix4(mesh.matrixWorld));assert.equal(trunk.intersectsTriangle(new THREE.Triangle(...points)),false,'actual frond triangles preserve protected trunk space');}}
    });
  }
  assert.ok(permittedEmptyCrownBox,'empty crown-box volume can overlap a trunk while actual fronds remain clear');
  let tested=0,foliageOverlap=false;
  court.traverse(mesh=>{
    if(!mesh.isMesh||mesh===soil)return;const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
    mesh.geometry.computeBoundingBox();const candidates=crowns.filter(p=>p.box.intersectsBox(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)));if(!candidates.length)return;
    for(let i=0;i<(index?.count||positions.count);i+=3){
      a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
      if(/foliage|petal|leaf|flower|bark|twig/i.test(mesh.name)){if(/foliage/i.test(mesh.name)&&candidates.some(p=>p.box.intersectsTriangle(triangle)))foliageOverlap=true;}
      else for(const {plant,box}of candidates){tested++;assert.equal(box.intersectsTriangle(triangle),false,`${plant.userData.soilBed} intersects structural ${mesh.name}`);}
    }
  });
  assert.ok(tested>100,'actual old stone/furniture triangles examined');assert.ok(foliageOverlap,'natural old/new foliage overlap is retained instead of being rejected as a structural collision');
  const count=district.plantings.length;district.plantCourtyard(court);assert.equal(district.plantings.length,count,'court placement is idempotent');
  for(const before of original){assert.equal(before.mesh.geometry,before.geometry);assert.deepEqual(before.mesh.matrixWorld.toArray(),before.matrix);}
  for(const g of district.supportSurfaces)g.dispose();district.dispose();district.dispose();assert.equal(root.children.length,0);assert.throws(()=>district.plantCourtyard(court),/disposed/);
});
