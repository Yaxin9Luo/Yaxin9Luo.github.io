import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {prepareHerbariumGeometry} from './helpers/herbarium-source.js';
import {createHerbariumDistrict} from '../src/herbarium-district.js';
import {renderedTerrainHeight} from '../src/world.js';
import {createSurfaceSupport} from '../src/surface-support.js';
import {herbariumPaths,waterGardenBasinDistance} from '../src/herbarium-layout.js';

const apronName='herbarium-site-apron/water-garden';
function topEdges(mesh,part,y){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index,edges=new Map(),key=v=>v.toArray().map(n=>n.toFixed(5)).join(',');
  for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3){
    const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)).applyMatrix4(mesh.matrixWorld));
    if(points.some(p=>Math.abs(p.y-y)>.001)||new THREE.Triangle(...points).getNormal(new THREE.Vector3()).y<.99)continue;
    for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3],id=[key(a),key(b)].sort().join('/'),edge=edges.get(id);if(edge)edge.count++;else edges.set(id,{a,b,count:1});}
  }
  return [...edges.values()].filter(e=>e.count===1);
}
function inTop(x,z,mesh,part,y){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  for(let i=part.firstIndex;i<part.firstIndex+part.indexCount;i+=3){
    const [a,b,c]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k)).applyMatrix4(mesh.matrixWorld));
    if(Math.max(Math.abs(a.y-y),Math.abs(b.y-y),Math.abs(c.y-y))>.001)continue;
    const bx=b.x-a.x,bz=b.z-a.z,cx=c.x-a.x,cz=c.z-a.z,det=bx*cz-cx*bz;if(Math.abs(det)<1e-9)continue;
    const u=((x-a.x)*cz-(z-a.z)*cx)/det,v=(bx*(z-a.z)-bz*(x-a.x))/det;
    if(u>1e-5&&v>1e-5&&u+v<1-1e-5)return true;
  }
  return false;
}

test('pond entry earth meets the delivered soil edge and backs the basin without changing source plants or the clear landing',async()=>{
  await prepareHerbariumGeometry();
  const district=createHerbariumDistrict(new THREE.Group(),{heightAt:renderedTerrainHeight}),support=createSurfaceSupport(renderedTerrainHeight),before=createSurfaceSupport(renderedTerrainHeight);
  try{
    district.group.updateMatrixWorld(true);
    for(const g of district.supportSurfaces)support.addGeometry(g);
    district.group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.support&&mesh.name!==apronName){const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);before.addGeometry(g);g.dispose();}});
    const water=district.instances.find(g=>g.userData.site==='water-garden'),apron=district.group.getObjectByName(apronName),parts=[];
    for(const mesh of water.children)for(const part of mesh.userData.parts||[])parts.push({mesh,part});
    const loam=parts.find(({part})=>part.name==='Continuous irregular planted loam'),edge=topEdges(loam.mesh,loam.part,water.position.y).find(({a,b})=>Math.min(a.x,b.x)>-38&&Math.max(a.z,b.z)<49.3&&a.distanceTo(b)>.7);
    assert.ok(edge,'actual near-end loam edge from the R12 water-entry frame must be present');
    // Probe 1 mm outside the real edge: two independently float32-tessellated
    // surfaces can put an exact-boundary ray a few micrometres inside the hole.
    // The old visible 14 mm lip fails this same contact check.
    const out=new THREE.Vector3(-(edge.b.z-edge.a.z),0,edge.b.x-edge.a.x).normalize();
    const seam=Array.from({length:13},(_,i)=>{const source=edge.a.clone().lerp(edge.b,i/12),p=source.clone().addScaledVector(out,.001);return {source:source.toArray(),point:p.toArray(),beforeGap:source.y-before.heightAt(p.x,p.z),ground:support.heightAt(p.x,p.z),gap:source.y-support.heightAt(p.x,p.z)};});
    // These points are outside the delivered basin, beside the exposed east wall.
    const trench=[[-37.04,46.86],[-37.08,47.78],[-37.74,48.51]].map(([x,z])=>({point:[x,z],before:before.heightAt(x,z),after:support.heightAt(x,z)}));
    const state=[];district.group.traverse(o=>{if(o.name===apronName)return;if(o.isMesh)state.push({name:o.name,matrix:o.matrixWorld.toArray(),vertices:o.geometry.attributes.position.count,indices:o.geometry.index?.count||0});});
    const roots=district.instances.map(o=>({site:o.userData.site,roots:o.userData.plantRoots})).concat(district.plantings.map(o=>({site:o.userData.site,root:o.position.toArray(),record:o.userData.rootedAt})));
    const waterHash=createHash('sha256');for(const m of water.children){for(const a of Object.values(m.geometry.attributes))waterHash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(m.geometry.index){const a=m.geometry.index.array;waterHash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}}
    const report={originalMeshCount:state.length,originalStateSHA256:createHash('sha256').update(JSON.stringify({state,roots})).digest('hex'),waterGeometrySHA256:waterHash.digest('hex'),seamMaxGap:Math.max(...seam.map(s=>Math.abs(s.gap))),seam,trench,apron:apron?{vertices:apron.geometry.attributes.position.count,triangles:apron.geometry.index.count/3,bounds:new THREE.Box3().setFromObject(apron),...apron.userData.siteFinish}:null};
    if(process.env.HERBARIUM_POND_CONTACT_REPORT)await writeFile(process.env.HERBARIUM_POND_CONTACT_REPORT,JSON.stringify(report,null,2)+'\n');
    assert.ok(seam.every(p=>p.beforeGap>.010),'the original site surface must reproduce the visible lip without the new apron');
    assert.ok(report.seamMaxGap<.002,`visible loam seam remains ${report.seamMaxGap} m above installed earth`);
    for(const p of trench)assert.ok(p.after>=7.0&&p.after<=7.101,`exposed basin apron at ${p.point}: ${p.before} -> ${p.after}`);
    assert.ok(apron?.userData.support,'visible backfill must participate in actual walking support');
    const p=apron.geometry.attributes.position,index=apron.geometry.index,protectedTops=parts.filter(({part})=>['Continuous irregular planted loam','Supported rounded sitting shore'].includes(part.name));
    for(let i=0;i<index.count;i+=3){
      const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+k))),middle=points[0].clone().add(points[1]).add(points[2]).divideScalar(3);
      for(const q of [...points,middle]){
        assert.ok(waterGardenBasinDistance(q.x-water.position.x,q.z-water.position.z)>.08,'new earth crosses the actual open-water/basin boundary');
        assert.ok(q.y<=water.position.y+.001,'backfill rises through accepted source soil or paving');
      }
      const overlap=protectedTops.find(({mesh,part})=>inTop(middle.x,middle.z,mesh,part,water.position.y));
      assert.ok(!overlap,`new apron triangle ${i/3} overlaps ${overlap?.part.name}: ${JSON.stringify(points.map(p=>p.toArray()))}`);
    }
    const edges=new Map();for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=[a,b].sort((a,b)=>a-b).join('/'),e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});}
    const outer=[];
    for(const e of edges.values())if(e.count===1){
      const a=new THREE.Vector3().fromBufferAttribute(p,e.a),b=new THREE.Vector3().fromBufferAttribute(p,e.b);
      if(![a,b].every(q=>waterGardenBasinDistance(q.x-water.position.x,q.z-water.position.z)>1.995||q.x-water.position.x<2.001))continue;
      for(const t of[0,.5,1]){const q=a.clone().lerp(b,t);outer.push(q.y-before.heightAt(q.x,q.z));}
    }
    report.outerBoundary={samples:outer.length,minGap:Math.min(...outer),maxGap:Math.max(...outer)};
    if(process.env.HERBARIUM_POND_CONTACT_REPORT)await writeFile(process.env.HERBARIUM_POND_CONTACT_REPORT,JSON.stringify(report,null,2)+'\n');
    assert.ok(outer.length>40,'check the actual curved and lateral apron toes');
    assert.ok(report.outerBoundary.maxGap<.002&&report.outerBoundary.minGap>-.075,`apron toe must embed in existing ground without a visible upper gap: ${JSON.stringify(report.outerBoundary)}`);
    for(const name of['position','normal','uv','soilInterior'])assert.ok([...apron.geometry.attributes[name].array].every(Number.isFinite),`finite ${name} over the clipped site surface`);
    for(const plant of district.plantings){const {x,z}=plant.position;assert.ok(Math.abs(support.heightAt(x,z)-before.heightAt(x,z))<.002,`new earth changed existing plant root support at ${x},${z}`);}
    for(const {mesh,part}of protectedTops.filter(({part})=>part.name==='Supported rounded sitting shore'))for(const {a,b}of topEdges(mesh,part,water.position.y)){const q=a.clone().lerp(b,.5);assert.ok(Math.abs(support.heightAt(q.x,q.z)-before.heightAt(q.x,q.z))<.002,'sitting-shore walking support changed');}
    const path=herbariumPaths.find(p=>p.id==='water-garden');
    for(let i=1;i<path.points.length;i++){
      const [ax,az]=path.points[i-1],[bx,bz]=path.points[i],length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/.12);
      for(let j=0;j<=steps;j++)for(const offset of[-.88,0,.88]){const x=ax+(bx-ax)*j/steps+(bz-az)/length*offset,z=az+(bz-az)*j/steps-(bx-ax)/length*offset;assert.ok(Math.abs(support.heightAt(x,z)-before.heightAt(x,z))<.002,'accepted east approach support changed');}
    }
    assert.equal(support.heightAt(-44,47),before.heightAt(-44,47),'open basin must not acquire a new walking surface');
  }finally{for(const g of district.supportSurfaces)g.dispose();district.dispose();}
});
