import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as assets from '../src/herbarium-assets.js';
import {prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {createSurfaceSupport} from '../src/surface-support.js';
import {writeFile} from 'node:fs/promises';

function triangles(group,part,visit){
  const mesh=group.children.find(m=>m.name===part.batch),p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3){
    const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)));
    visit(new THREE.Triangle(...points),mesh);
  }
}
function clear(group,box){let hits=0;for(const part of group.userData.parts)triangles(group,part,t=>{if(box.intersectsTriangle(t))hits++;});assert.equal(hits,0,'actual candidate triangles cross the complete walking volume');}
function boundsOf(parts){return parts.reduce((box,part)=>box.union(new THREE.Box3(new THREE.Vector3(...part.bounds.min),new THREE.Vector3(...part.bounds.max))),new THREE.Box3());}
function partSizes(group,name){return group.userData.parts.filter(p=>p.name===name).map(p=>p.bounds.max.map((v,i)=>Math.round((v-p.bounds.min[i])*1e6)/1e6));}
function supportOf(group){const support=createSurfaceSupport(()=>-10);for(const g of assets.getHerbariumSupportGeometries(group)){support.addGeometry(g);g.dispose();}return support;}
function inside(x,z,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}

test('isolated R10 architecture retains human access, complete plants and supported water-garden furniture',async()=>{
  assert.equal(typeof assets.createConservatoryR10,'function','the independent central hall candidate is missing');
  assert.equal(typeof assets.createWaterGardenR10,'function','the enlarged water candidate is missing');
  await prepareHerbariumGeometry();
  const house=assets.createConservatoryR9(),water=assets.createWaterGardenR9(),candidateHouse=assets.createConservatoryR10(),candidateWater=assets.createWaterGardenR10();
  const groups=[house,water,candidateHouse,candidateWater],report={};
  try{
    for(const group of groups){
      const box=new THREE.Box3().setFromObject(group);report[group.userData.reviewCandidate||group.name]={bounds:{min:box.min.toArray(),max:box.max.toArray()},size:box.getSize(new THREE.Vector3()).toArray(),triangles:group.children.reduce((sum,m)=>sum+m.geometry.index.count/3,0),rootedPlants:group.userData.plantRoots.length};
      for(const mesh of group.children)for(const attribute of Object.values(mesh.geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value));
    }
    // A compact plan and independently taller central glazing preserve the
    // existing site fit. Human construction does not grow with the new vault.
    assert.equal(candidateHouse.scale.x,1);assert.deepEqual(candidateHouse.userData.doors,house.userData.doors);
    for(const name of ['Door structural jamb','Open door stile','Open door cross rail','Door lower raised panel','Workbench thick top','Workbench joined leg','Floor paving'])assert.deepEqual(partSizes(candidateHouse,name),partSizes(house,name),name+' was rescaled');
    const rooted=group=>group.userData.plantRoots.map(({species,root,support})=>({species,root,support}));
    assert.deepEqual(rooted(candidateHouse),rooted(house),'original potted collections remain intact');
    const hall=candidateHouse.userData.parts.filter(p=>p.name.startsWith('Central hall glazing')),wings=candidateHouse.userData.parts.filter(p=>p.name.startsWith('Wing roof glazing'));
    assert.ok(hall.length&&wings.length);assert.ok(boundsOf(hall).max.y>boundsOf(wings).max.y);
    assert.ok(boundsOf(candidateHouse.userData.parts).min.x>=-8&&boundsOf(candidateHouse.userData.parts).max.x<=8);
    assert.ok(boundsOf(candidateHouse.userData.parts).min.z>=-4.5&&boundsOf(candidateHouse.userData.parts).max.z<=4.5);
    clear(candidateHouse,new THREE.Box3(new THREE.Vector3(-1.1,.04,-3.75),new THREE.Vector3(1.1,3.6,4.51)));
    const structural=candidateHouse.userData.parts.filter(p=>p.role==='structure');
    for(const glass of candidateHouse.userData.parts.filter(p=>p.role==='glass')){
      const box=boundsOf([glass]).expandByScalar(.09);assert.ok(structural.some(p=>box.intersectsBox(boundsOf([p]))),glass.name+' is detached from every real frame member');
    }
    candidateHouse.position.set(48,6.7,29);candidateHouse.rotation.y=Math.PI/2;
    const houseSupport=supportOf(candidateHouse);
    for(const point of [[0,0,0],[0,0,3.9],[.8,0,2]]){const p=new THREE.Vector3(...point).applyMatrix4(candidateHouse.matrixWorld);assert.ok(Math.abs(houseSupport.heightAt(p.x,p.z)-6.7)<1e-5);}
    assert.deepEqual(partSizes(candidateWater,'Bench seat oak slat'),partSizes(water,'Bench seat oak slat'));
    assert.deepEqual(partSizes(candidateWater,'Bench back oak slat'),partSizes(water,'Bench back oak slat'));
    const wet=group=>group.userData.parts.find(p=>p.name==='Quiet inset water surface'),area=group=>{let result=0;triangles(group,wet(group),t=>{result+=Math.abs((t.b.x-t.a.x)*(t.c.z-t.a.z)-(t.b.z-t.a.z)*(t.c.x-t.a.x))/2;});return result;};
    assert.ok(area(candidateWater)>area(water));assert.equal(candidateWater.userData.water.height,water.userData.water.height);
    const outline=candidateWater.userData.water.contour;assert.ok(outline?.length>=144);
    let plantAreaUpperBound=0;
    for(const part of candidateWater.userData.parts.filter(p=>p.name==='Smooth notched floating waterlily lamina'||p.name==='Curved waterlily petal')){
      // Disjointness is not assumed: the sum of each real part's enclosing
      // rectangle is a conservative coverage upper bound, including overlaps.
      plantAreaUpperBound+=(part.bounds.max[0]-part.bounds.min[0])*(part.bounds.max[2]-part.bounds.min[2]);
      triangles(candidateWater,part,t=>{for(const p of[t.a,t.b,t.c])assert.ok(inside(p.x,p.z,outline),'floating plant extends outside the actual water outline');});
    }
    const openAreaLowerBound=area(candidateWater)-plantAreaUpperBound;assert.ok(openAreaLowerBound>=area(candidateWater)/2,'at least half of the water must remain open even under conservative cover bounds');
    const waterSupport=supportOf(candidateWater);
    for(const part of candidateWater.userData.parts.filter(p=>p.name==='Bench grounded foot')){const x=(part.bounds.min[0]+part.bounds.max[0])/2,z=(part.bounds.min[2]+part.bounds.max[2])/2;assert.ok(Math.abs(waterSupport.heightAt(x,z))<1e-5);}
    clear(candidateWater,new THREE.Box3(new THREE.Vector3(7.55,.04,-1.1),new THREE.Vector3(9.35,3.6,1.1)));
    assert.ok(Math.abs(waterSupport.heightAt(9.1,0))<1e-5);assert.equal(waterSupport.heightAt(0,0),-10);
    // Candidate assembly uses the same ownership contract as the live assets.
    const clone=assets.cloneHerbariumAsset(candidateHouse);let disposed=0;candidateHouse.children[0].geometry.addEventListener('dispose',()=>disposed++);
    assets.disposeHerbariumAsset(candidateHouse);assert.equal(disposed,0);assets.disposeHerbariumAsset(clone);assert.equal(disposed,1);
    report.water={currentArea:area(water),candidateArea:area(candidateWater),openAreaLowerBound,openFractionLowerBound:openAreaLowerBound/area(candidateWater),waterHeight:candidateWater.userData.water.height};
    if(process.env.HERBARIUM_R10_ASSET_REPORT)await writeFile(process.env.HERBARIUM_R10_ASSET_REPORT,JSON.stringify(report,null,2)+'\n');
  }finally{for(const group of groups)assets.disposeHerbariumAsset(group);}
});
