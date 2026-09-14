import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile,writeFile} from 'node:fs/promises';
import {decodeGeometryGLB,prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {loadBotanicalAssets} from '../src/botanical-cache.js';
import {loadScannedRockAssets} from '../src/rock-scans.js';
import {assetManifest} from '../src/asset-manifest.js';
import {createWorld,renderedTerrainHeight,createRoadSampleIndex} from '../src/world.js';
import {createExhibitionStage} from '../src/exhibits.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {herbariumPaths,herbariumPlantingDrifts,herbariumRegionalCommunities} from '../src/herbarium-layout.js';
import {academyPathCurves} from '../src/landform-layout.js';
import {locations} from '../src/locations.js';

// Actual transformed triangles from the complete source scene. No placeholder
// envelopes replace existing buildings, lamps, garden meshes or mature trees.
test('new placed gardens retain full-world fixed scenery and mature crown clearance',async()=>{
  const loadGLTFImpl=async asset=>{const url=(assetManifest[asset.id]||asset).url;return decodeGeometryGLB(await readFile(new URL(`../public${url}`,import.meta.url)));};
  await loadBotanicalAssets({loadGLTFImpl});assert.equal(await loadScannedRockAssets({loadGLTFImpl}),true);await prepareHerbariumGeometry();
  const scene=new THREE.Scene(),existing=createWorld(scene,{herbarium:false});createExhibitionStage(scene,renderedTerrainHeight);
  const paths=locations.flatMap(l=>academyPathCurves(l).map(c=>c.getPoints(Math.ceil(c.getLength()/.18))));
  const newRoot=new THREE.Group(),district=createHerbariumDistrict(newRoot,{heightAt:renderedTerrainHeight,nearPath:createRoadSampleIndex(paths)});district.plantCourtyard(existing.gardens.group);scene.updateMatrixWorld(true);newRoot.updateMatrixWorld(true);
  // Check the runtime-filtered, turned full source crowns: each requested group
  // must still span a garden margin and form a connected projected canopy. This
  // catches a route filter silently reducing a ribbon to isolated endpoint tufts.
  for(const drift of herbariumPlantingDrifts){
    const boxes=district.plantings.filter(p=>p.userData.drift===drift.id).map(p=>new THREE.Box3().setFromObject(p)),bounds=boxes.reduce((a,b)=>a.union(b),new THREE.Box3()),size=bounds.getSize(new THREE.Vector3());
    assert.ok(Math.max(size.x,size.z)>=3.6&&Math.min(size.x,size.z)>=1.2,`${drift.id} lost its planted length/depth`);
    // A community edge connects through its woody/fern body. Its supported
    // soil feather is part of that connection, rather than a separate ribbon.
    const community=drift.placement==='community-edge'&&herbariumRegionalCommunities.find(r=>r.plants.some(p=>p.drift===drift.id));
    const connectedBoxes=community?district.plantings.filter(p=>p.userData.regionalCommunity===community.id).map(p=>new THREE.Box3().setFromObject(p)):drift.connectedGroup?district.plantings.filter(p=>herbariumPlantingDrifts.some(d=>d.id===p.userData.drift&&d.connectedGroup===drift.connectedGroup)).map(p=>new THREE.Box3().setFromObject(p)):boxes;
    const crowns=connectedBoxes.map(b=>{const flat=b.clone().expandByScalar(community?.28:.035);flat.min.y=-Infinity;flat.max.y=Infinity;return flat;}),unseen=new Set(crowns.map((_,i)=>i)),stack=[0];unseen.delete(0);
    while(stack.length){const i=stack.pop();for(const j of unseen)if(crowns[i].intersectsBox(crowns[j])){unseen.delete(j);stack.push(j);}}
    if(!drift.interruptedByRoad)assert.equal(unseen.size,0,`${drift.id} contains disconnected crown groups`);
  }
  for(const region of herbariumRegionalCommunities){const community=district.communities.find(g=>g.name.endsWith(region.id));assert.equal(community.userData.plantRoots.length,region.plants.length,`${region.id} cannot silently shrink to a filtered remnant`);assert.equal(community.children.filter(p=>p.userData.canonicalCommunityPlant).length,48,'the accepted source group remains intact');assert.equal(community.children.filter(p=>p.userData.botanicalSource.id==='didelta_spinosa').length,region.plants.filter(p=>p.species==='didelta_spinosa').length);assert.equal(community.getObjectByName('Continuous supported specimen loam'),undefined,'real island soil replaces the specimen staging slab');const size=new THREE.Box3().setFromObject(community).getSize(new THREE.Vector3());assert.ok(size.x>=8&&size.z>=5,`${region.id} retains its full middle/low mass`);}
  const reservations=[...district.instances,...district.plantings].map((group,i)=>({group,id:`${group.userData.site}/${i}`,box:new THREE.Box3().setFromObject(group)}));
  // The corrected bay approaches also reserve a full standing corridor against
  // the existing actual scenery. An oriented box avoids widening diagonal joins.
  for(const path of herbariumPaths)for(let segment=1;segment<path.points.length;segment++){
    const [ax,az]=path.points[segment-1],[bx,bz]=path.points[segment],length=Math.hypot(bx-ax,bz-az),samples=Array.from({length:21},(_,i)=>renderedTerrainHeight(ax+(bx-ax)*i/20,az+(bz-az)*i/20));
    const transform=new THREE.Matrix4().makeRotationY(-Math.atan2(bz-az,bx-ax));transform.setPosition((ax+bx)/2,0,(az+bz)/2);
    const localBox=new THREE.Box3(new THREE.Vector3(-length/2,Math.min(...samples)+.10,-path.width/2),new THREE.Vector3(length/2,Math.max(...samples)+3.6,path.width/2));
    reservations.push({id:`approach/${path.id}/${segment}`,box:localBox.clone().applyMatrix4(transform),localBox,inverse:transform.invert()});
  }
  // Actual plant triangles, including turned crowns, retain the complete
  // standing rectangle at every new approach, not just clear root points.
  for(const plant of district.plantings)for(const passage of reservations.filter(r=>r.localBox)){
    const bounds=new THREE.Box3().setFromObject(plant);if(!bounds.intersectsBox(passage.box))continue;
    plant.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
      for(let i=0;i<index.count;i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)).applyMatrix4(mesh.matrixWorld).applyMatrix4(passage.inverse));assert.equal(passage.localBox.intersectsTriangle(new THREE.Triangle(...points)),false,`low planting crosses ${passage.id}`);}
    });
  }
  // Floor/roots can contact terrain; road joins are checked by walking tests.
  const ignored=/Warm light on garden paths|irregular soil and moss ribbon|Garden edge ground cover|island-ground|shoreline-cliffs|road-|herbarium|ground cover|meadow flower|fern beds|blossom litter|Leafy grove understory|Fine understory|Reflective lake|Nocturnal|highland|distant|landscape depth|sky|cloud|star|mote|spark|Backdrop/i;
  // An irregular woody crown box contains large empty volumes. Reject a broad
  // scenery pair only when the actual source triangles also touch its bounds;
  // this keeps a small ground rock below open branches from becoming a false hit.
  const plantTouchesBounds=(group,bounds)=>{const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(a,b,c);let hit=false;group.traverse(mesh=>{if(hit||!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<(index?.count||p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);if(bounds.intersectsTriangle(triangle)){hit=true;break;}}});return hit;};
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(a,b,c),local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),hits=[];let records=0,candidateTriangles=0;
  scene.traverse(mesh=>{
    if(!mesh.isMesh||ignored.test(mesh.name)||mesh.material?.blending===THREE.AdditiveBlending||mesh.material?.transparent&&mesh.material?.opacity<.15)return;
    let ancestor=mesh.parent;while(ancestor){if(/Mineral highlands|Backdrop|Landscape depth/.test(ancestor.name))return;ancestor=ancestor.parent;}
    const geometry=mesh.geometry;if(!geometry.attributes.position)return;geometry.computeBoundingBox();
    for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
      if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,local);matrix.multiplyMatrices(mesh.matrixWorld,local);}else matrix.copy(mesh.matrixWorld);
      const box=geometry.boundingBox.clone().applyMatrix4(matrix);records++;
      const candidates=reservations.filter(r=>r.box.intersectsBox(box)&&(!r.group?.userData.regionalCommunity||plantTouchesBounds(r.group,box))),hitReservations=new Set();if(!candidates.length)continue;
      const p=geometry.attributes.position,index=geometry.index,count=index?.count||p.count;
      for(let i=0;i<count;i+=3){
        a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(matrix);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(matrix);candidateTriangles++;
        for(const r of candidates)if(!hitReservations.has(r.id)&&!(r.group?.userData.soilBed&&/foliage|petal|leaf|flower|bark|twig/i.test(mesh.name))&&(r.localBox?r.localBox.intersectsTriangle(new THREE.Triangle(a.clone().applyMatrix4(r.inverse),b.clone().applyMatrix4(r.inverse),c.clone().applyMatrix4(r.inverse))):r.box.intersectsTriangle(triangle))){
          hitReservations.add(r.id);const ancestry=[];for(let parent=mesh.parent;parent;parent=parent.parent)ancestry.push(parent.name||parent.type);
          hits.push({site:r.id,plant:r.group&&{drift:r.group.userData.drift,source:r.group.userData.botanicalSource?.id,variant:r.group.userData.botanicalSource?.variant,root:r.group.position.toArray(),scale:r.group.scale.toArray(),yaw:r.group.rotation.y,canonical:!!r.group.userData.canonicalCommunityPlant},mesh:mesh.name,parent:mesh.parent?.name,ancestry,instance,record:records,matrix:matrix.toArray(),geometry:{type:geometry.type,positions:p.count,indices:index?.count||0},materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>({name:m.name,type:m.type,color:m.color?.getHexString(),alphaTest:m.alphaTest,transparent:m.transparent})),triangleIndex:i/3,triangle:[a.toArray(),b.toArray(),c.toArray()]});
        }
        // One proof per reservation/mesh/instance is sufficient. Keep checking
        // every remaining pair, rather than stopping after 31 repeated faces.
        if(hitReservations.size===candidates.length)break;
      }
    }
  });
  for(const g of district.supportSurfaces)g.dispose();district.dispose();existing.dispose?.();
  if(process.env.HERBARIUM_PLACEMENT_REPORT)await writeFile(process.env.HERBARIUM_PLACEMENT_REPORT,JSON.stringify({records,candidateTriangles,hits},null,2)+'\n');
  assert.ok(records>700,`full scene checked ${records} placed records`);assert.deepEqual(hits,[],JSON.stringify({records,candidateTriangles,hits}));
});
