import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {herbariumSites,herbariumPaths,herbariumPlantingDrifts,herbariumRegionalCommunities,herbariumLowGardenBeds,waterGardenContourPoint,waterGardenBasinDistance} from '../src/herbarium-layout.js';
import {renderedTerrainHeight,createRoadSampleIndex} from '../src/world.js';
import {academyPathCurves} from '../src/landform-layout.js';
import {locations} from '../src/locations.js';

function components(plants,margin=.035){
  const boxes=plants.map(p=>{const box=new THREE.Box3().setFromObject(p).expandByScalar(margin);box.min.y=-Infinity;box.max.y=Infinity;return box;}),unseen=new Set(boxes.map((_,i)=>i)),result=[];
  while(unseen.size){const first=unseen.values().next().value,stack=[first],ids=[];unseen.delete(first);while(stack.length){const i=stack.pop();ids.push(i);for(const j of unseen)if(boxes[i].intersectsBox(boxes[j])){unseen.delete(j);stack.push(j);}}result.push(ids);}
  return result.sort((a,b)=>b.length-a.length);
}
function inside(x,z,loop){let yes=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function bedReport(group){
  const plants=group.children,box=new THREE.Box3().setFromObject(group),parts=components(plants,.28),footprints=plants.map(p=>p.userData.groundFootprint).filter(Boolean);let area=0;
  for(let x=box.min.x;x<=box.max.x;x+=.35)for(let z=box.min.z;z<=box.max.z;z+=.35)if(footprints.some(p=>inside(x,z,p.loop)))area+=.35*.35;
  return {id:group.name,requested:group.userData.plantingAudit.requested,accepted:plants.length,counts:plants.reduce((counts,p)=>{const id=p.userData.botanicalSource.id;counts[id]=(counts[id]||0)+1;return counts;},{}),canonicalCount:plants.filter(p=>p.userData.canonicalCommunityPlant).length,bounds:{min:box.min.toArray(),max:box.max.toArray()},projectedCrownComponents:parts.map(p=>p.length),isolated:parts.slice(1).flatMap(ids=>ids.map(i=>({root:plants[i].position.toArray(),patch:plants[i].userData.patch,canonical:plants[i].userData.canonicalCommunityPlant}))),rootedMaskAreaSquareMetres:area,maxBasalPenetration:Math.max(...plants.map(p=>p.userData.terrainContact?.basalPenetration||0)),lowerEnvelopeContacts:plants.filter(p=>p.userData.terrainContact?.lowerEnvelopePenetration>.12).length,...group.userData.plantingAudit};
}
test('accepted R11 destinations and broadened connected beds retain real support and complete recipes',async()=>{
  const houseSite=herbariumSites.find(s=>s.kind==='conservatory'),waterSite=herbariumSites.find(s=>s.kind==='water');assert.equal(houseSite.rotation,Math.PI/2);assert.equal(waterSite.width,20);assert.equal(waterSite.depth,11.5);
  await prepareHerbariumGeometry();const paths=locations.flatMap(l=>academyPathCurves(l).map(c=>c.getPoints(Math.ceil(c.getLength()/.18)))),root=new THREE.Group(),district=createHerbariumDistrict(root,{heightAt:renderedTerrainHeight,nearPath:createRoadSampleIndex(paths)});
  try{
    const beds=district.communities.map(bedReport),drifts=herbariumPlantingDrifts.map(drift=>{const plants=district.plantings.filter(p=>p.userData.drift===drift.id),connection=drift.connectedGroup?district.plantings.filter(p=>herbariumPlantingDrifts.some(d=>d.id===p.userData.drift&&d.connectedGroup===drift.connectedGroup)):plants;return {id:drift.id,count:plants.length,bounds:plants.reduce((b,p)=>b.union(new THREE.Box3().setFromObject(p)),new THREE.Box3()),components:components(connection).map(p=>p.length)};});
    const house=district.instances.find(g=>g.userData.site==='conservatory'),water=district.instances.find(g=>g.userData.site==='water-garden'),report={beds,drifts,sites:district.instances.slice(0,4).map(g=>({id:g.userData.site,design:g.userData.reviewCandidate,bounds:new THREE.Box3().setFromObject(g),rootedPlants:g.userData.plantRoots.length})),paths:herbariumPaths,lights:district.lighting.lights.length};
    if(process.env.HERBARIUM_R11_INTEGRATION_REPORT)await writeFile(process.env.HERBARIUM_R11_INTEGRATION_REPORT,JSON.stringify(report,null,2)+'\n');
    assert.equal(house.userData.reviewCandidate,'r11-conservatory');assert.equal(water.userData.reviewCandidate,'r10-water');assert.equal(district.lighting.lights.length,4);
    for(const region of [...herbariumRegionalCommunities,...herbariumLowGardenBeds]){const bed=beds.find(b=>b.id.endsWith(region.id));assert.equal(bed.accepted,region.plants.length,`${region.id} rejected authored roots: ${JSON.stringify(bed.rejected.slice(0,6))}`);assert.deepEqual(bed.projectedCrownComponents,[bed.accepted],`${region.id} must form one connected body`);assert.ok(bed.maxBasalPenetration<=.10);}
    for(const bed of beds.filter(b=>b.id.endsWith('-woody')))assert.equal(bed.canonicalCount,48);
    const expanded=[['southwest-woody',183.505],['conservatory-grove-woody',103.6],['arrival-east',61.0],['pond-near',107.31]];
    for(const [id,previous]of expanded)assert.ok(beds.find(b=>b.id.endsWith(id)).rootedMaskAreaSquareMetres>previous,`${id} must broaden its actual rooted coverage`);
    for(const drift of drifts.filter(d=>!['arrival-west','conservatory-east'].includes(d.id)))assert.equal(drift.components.length,1,`${drift.id} must not be filtered into fragments`);
    // The actual expanded polygon, not an unrelated ellipse, drives the cut.
    for(let i=0;i<144;i++){const[x,z]=waterGardenContourPoint(i/144).map(v=>v*1.02);assert.ok(Math.abs(waterGardenBasinDistance(x,z))<1e-7);assert.ok(renderedTerrainHeight(x+waterSite.x,z+waterSite.z)<waterSite.floor-.315,'terrain must remain below every actual basin perimeter vertex');}
  }finally{for(const geometry of district.supportSurfaces)geometry.dispose();district.dispose();}
});
