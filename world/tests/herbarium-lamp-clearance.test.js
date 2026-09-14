import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {renderedTerrainHeight,createRoadSampleIndex} from '../src/world.js';
import {academyPathCurves} from '../src/landform-layout.js';
import {locations} from '../src/locations.js';
import {insideAuthoredGarden} from '../src/environment-layout.js';
import {createGardenLamp} from '../src/site-details.js';

// The existing world's unlabelled lamp batches come from this exact factory
// and path sampling. Keep this small regression independent of whole-world
// assembly, while checking actual original solid triangles and placed crowns.
test('pond margin crowns clear every original bronze path lamp without losing the connected ribbon',async()=>{
  await prepareHerbariumGeometry();
  const paths=locations.flatMap(l=>academyPathCurves(l).map(c=>c.getPoints(Math.ceil(c.getLength()/.18)))),root=new THREE.Group(),district=createHerbariumDistrict(root,{heightAt:renderedTerrainHeight,nearPath:createRoadSampleIndex(paths)}),lamp=createGardenLamp();root.updateMatrixWorld(true);
  try{
    const lampSites=[];
    for(const path of paths)for(let n=30;n<path.length-4;n+=132){const p=path[n],next=path[n+1],direction=new THREE.Vector3().subVectors(next,p).normalize();for(const side of[-1,1]){const x=p.x+direction.z*4.7*side,z=p.z-direction.x*4.7*side;if(!insideAuthoredGarden(x,z,3)&&!lampSites.some(s=>Math.hypot(s[0]-x,s[2]-z)<8))lampSites.push([x,renderedTerrainHeight(x,z),z]);}}
    assert.equal(lampSites.length,19);assert.ok(new THREE.Vector3(...lampSites[3]).distanceTo(new THREE.Vector3(-43.08358215113184,7.033199061691816,37.736001667097334))<1e-8,'the regression must target the actual fourth path lamp');
    const plants=district.plantings.filter(p=>p.userData.site==='margin-planting'),reservations=plants.map(group=>({group,box:new THREE.Box3().setFromObject(group)})),hits=[],matrix=new THREE.Matrix4(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(a,b,c);
    for(let instance=0;instance<lampSites.length;instance++)for(const [part,mesh]of lamp.children.entries()){
      if(mesh.material.blending===THREE.AdditiveBlending)continue;
      matrix.makeTranslation(...lampSites[instance]);mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrix),p=mesh.geometry.attributes.position,index=mesh.geometry.index;
      for(const r of reservations.filter(r=>r.box.intersectsBox(box))){
        let touchingTriangles=0,firstTriangle;
        for(let i=0;i<(index?.count||p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(matrix);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(matrix);if(r.box.intersectsTriangle(triangle)){touchingTriangles++;firstTriangle??=[a.toArray(),b.toArray(),c.toArray()];}}
        if(touchingTriangles)hits.push({drift:r.group.userData.drift,seed:Math.round(r.group.rotation.y/2.399),source:r.group.userData.botanicalSource.id,variant:r.group.userData.botanicalSource.variant,root:r.group.position.toArray(),scale:r.group.scale.toArray(),bounds:r.box,lamp:{instance,part,position:lampSites[instance],material:{type:mesh.material.type,color:mesh.material.color?.getHexString(),alphaTest:mesh.material.alphaTest,transparent:mesh.material.transparent},bounds:box},touchingTriangles,firstTriangle});
      }
    }
    const pond=district.plantings.filter(p=>['pond-far','pond-west'].includes(p.userData.drift)),crowns=pond.map(p=>{const box=new THREE.Box3().setFromObject(p).expandByScalar(.035);box.min.y=-Infinity;box.max.y=Infinity;return box;}),unseen=new Set(crowns.map((_,i)=>i)),stack=[0];unseen.delete(0);
    while(stack.length){const i=stack.pop();for(const j of unseen)if(crowns[i].intersectsBox(crowns[j])){unseen.delete(j);stack.push(j);}}
    const report={lampCount:lampSites.length,hits,pondFar:pond.filter(p=>p.userData.drift==='pond-far').length,pondWest:pond.filter(p=>p.userData.drift==='pond-west').length,disconnected:unseen.size,correctedRoots:pond.filter(p=>[448,454,456,458].includes(Math.round(p.rotation.y/2.399))).map(p=>({seed:Math.round(p.rotation.y/2.399),root:p.position.toArray(),scale:p.scale.toArray(),contact:p.userData.terrainContact}))};
    if(process.env.HERBARIUM_LAMP_CLEARANCE_REPORT)await writeFile(process.env.HERBARIUM_LAMP_CLEARANCE_REPORT,JSON.stringify(report,null,2)+'\n');
    assert.deepEqual(hits,[],JSON.stringify(report));assert.equal(report.pondFar,55,'retain the complete accepted far ribbon');assert.equal(report.pondWest,25);assert.equal(unseen.size,0,'the corrected roots must still join the whole northwest pond margin');
    assert.deepEqual(report.correctedRoots.map(p=>p.seed),[448,454,456,458],'retain every corrected specimen instead of replacing it through the packing filter');
    for(const [i,scale]of [2.8,2.73,2.05,2.51].entries())assert.ok(report.correctedRoots[i].scale.every(value=>Math.abs(value-scale)<1e-12),'keep the accepted natural plant scale');
    for(const plant of pond)assert.ok(plant.userData.terrainContact.basalPenetration<=.10,'actual basal root support remains valid');
  }finally{for(const geometry of district.supportSurfaces)geometry.dispose();district.dispose();for(const mesh of lamp.children){mesh.geometry.dispose();mesh.material.dispose();}}
});
