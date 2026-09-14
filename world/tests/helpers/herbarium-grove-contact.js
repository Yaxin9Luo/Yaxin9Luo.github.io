import * as THREE from 'three';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {decodeGeometryGLB,prepareHerbariumGeometry} from './herbarium-source.js';
import {loadBotanicalAssets} from '../../src/botanical-cache.js';
import {assetManifest} from '../../src/asset-manifest.js';
import {renderedTerrainHeight,createRoadSampleIndex} from '../../src/world.js';
import {createHerbariumDistrict,herbariumPlantGroundSupport} from '../../src/herbarium-district.js';
import {createFoliageLOD} from '../../src/foliage-lod.js';
import {academyPathCurves} from '../../src/landform-layout.js';
import {locations} from '../../src/locations.js';

// Evaluate the actual seeded placement source, returning immediately before
// geometry assembly. Only this return and import URLs differ from production.
// Low-cover generation and the unrelated full existing world are not needed to
// reproduce one tree instance; the selected tree still uses original GLB data.
async function sampledTreeDefinitions(nearPath){
  const url=new URL('../../src/landscape.js',import.meta.url),source=await readFile(url,'utf8'),marker='  const lodController=lod&&trees?';
  assert.equal(source.split(marker).length,2,'tree sampling boundary changed');
  const sampled=source.replace(marker,'  return kinds.map((kind,k)=>({kind,seed:168+k*331,placements:groups[k].filter(placementClear)}));\n'+marker)
    .replace(/from\s+(['"])([^'"]+)\1/g,(_match,quote,specifier)=>'from '+quote+(specifier.startsWith('.')?new URL(specifier,url).href:import.meta.resolve(specifier))+quote);
  const module=await import('data:text/javascript;base64,'+Buffer.from(sampled).toString('base64'));
  return {sourceSHA256:createHash('sha256').update(source).digest('hex'),definitions:module.createVegetation(new THREE.Group(),renderedTerrainHeight,nearPath,{trees:false})};
}

export async function createGroveContactFixture(){
  const paths=locations.flatMap(l=>academyPathCurves(l).map(c=>c.getPoints(Math.ceil(c.getLength()/.18)))),nearPath=createRoadSampleIndex(paths);
  await prepareHerbariumGeometry();
  const root=new THREE.Group(),district=createHerbariumDistrict(root,{heightAt:renderedTerrainHeight,nearPath});
  const sampled=await sampledTreeDefinitions(nearPath),definition=sampled.definitions.find(d=>d.kind==='silver');
  await loadBotanicalAssets({families:[{kind:'silver',seed:definition.seed}],loadGLTFImpl:async asset=>decodeGeometryGLB(await readFile(new URL('../../public'+(assetManifest[asset.id]||asset).url,import.meta.url)))});
  const treeRoot=new THREE.Group(),groves=createFoliageLOD(treeRoot,[definition]);
  root.updateMatrixWorld(true);treeRoot.updateMatrixWorld(true);
  const plants=[...district.instances,...district.plantings],matches=district.plantings.filter(p=>p.userData.regionalCommunity==='conservatory-grove-woody'&&p.userData.patch==='grove-bridge'&&p.userData.botanicalSource.variantIndex===0&&Math.abs(p.scale.x-.995)<1e-10);
  assert.equal(matches.length,1,'identify the exact authored noncanonical bridge plant independently of other bed counts');
  const plant=matches[0],branches=treeRoot.getObjectByName('silver branches 1,0 near'),chunk=groves.chunks.find(c=>c.kind==='silver'&&c.cell==='1,0');
  assert.equal(plant.userData.regionalCommunity,'conservatory-grove-woody');
  assert.equal(plant.userData.patch,'grove-bridge');assert.equal(plant.userData.canonicalCommunityPlant,false);
  assert.equal(plant.userData.botanicalSource.variantIndex,0);assert.ok(Math.abs(plant.scale.x-.995)<1e-10);
  assert.ok(branches?.isInstancedMesh&&branches.count>3);
  assert.ok(Math.abs(chunk.entries[3].placement.x-64.01228616264599)<1e-8&&Math.abs(chunk.entries[3].placement.z-11.627030015247776)<1e-8,'the actual existing silver tree must be retained');
  const local=new THREE.Matrix4();branches.getMatrixAt(3,local);
  const matrix=new THREE.Matrix4().multiplyMatrices(branches.matrixWorld,local);
  return {district,plant,branches,matrix,reservationIndex:plants.indexOf(plant),treePlacement:chunk.entries[3].placement,landscapeSHA256:sampled.sourceSHA256,
    dispose(){for(const geometry of district.supportSurfaces)geometry.dispose();district.dispose();groves.group.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});groves.group.removeFromParent();}};
}

export function meshTriangles(mesh,matrix=mesh.matrixWorld,clip=null){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index,uv=mesh.geometry.attributes.uv,result=[];
  for(let i=0;i<(index?.count||p.count);i+=3){
    const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),points=ids.map(n=>new THREE.Vector3().fromBufferAttribute(p,n).applyMatrix4(matrix)),triangle=new THREE.Triangle(...points),box=new THREE.Box3().setFromPoints(points);
    if(clip&&!clip.intersectsTriangle(triangle))continue;
    result.push({index:i/3,triangle,box,uv:uv?ids.map(n=>new THREE.Vector2().fromBufferAttribute(uv,n)):null});
  }
  return result;
}

// Exact plane clipping for non-coplanar triangles. Retain coplanar candidates as
// unresolved evidence; do not turn a numerical ambiguity into a clearance pass.
function triangleContact(a,b){
  if(!a.box.intersectsBox(b.box))return null;
  const pa=a.triangle.getPlane(new THREE.Plane()),pb=b.triangle.getPlane(new THREE.Plane()),axis=new THREE.Vector3().crossVectors(pa.normal,pb.normal),epsilon=1e-7;
  const av=[a.triangle.a,a.triangle.b,a.triangle.c],bv=[b.triangle.a,b.triangle.b,b.triangle.c],ad=av.map(p=>pb.distanceToPoint(p)),bd=bv.map(p=>pa.distanceToPoint(p));
  if([ad,bd].some(d=>d.every(v=>v>epsilon)||d.every(v=>v< -epsilon)))return null;
  if(axis.lengthSq()<1e-18)return {coplanar:true};
  axis.normalize();
  const cut=(points,distances)=>{
    const result=[];
    for(let i=0;i<3;i++){
      const j=(i+1)%3;if(Math.abs(distances[i])<=epsilon)result.push(points[i].clone());
      if(distances[i]*distances[j]<0)result.push(points[i].clone().lerp(points[j],distances[i]/(distances[i]-distances[j])));
    }
    return result.sort((p,q)=>p.dot(axis)-q.dot(axis));
  };
  const ac=cut(av,ad),bc=cut(bv,bd);if(!ac.length||!bc.length)return null;
  const low=Math.max(ac[0].dot(axis),bc[0].dot(axis)),high=Math.min(ac.at(-1).dot(axis),bc.at(-1).dot(axis));
  if(high<low-epsilon)return null;
  return {points:[ac[0].clone().addScaledVector(axis,low-ac[0].dot(axis)),ac[0].clone().addScaledVector(axis,high-ac[0].dot(axis))]};
}

async function alphaSampler(){
  const root=new URL('../../public/models/herbarium/didelta-spinosa/',import.meta.url),manifest=JSON.parse(await readFile(new URL('scalar-source.json',root),'utf8')),record=manifest.files.find(f=>f.sourceChannel==='G');
  const encoded=await readFile(new URL(record.output,root)),pixels=inflateSync(encoded),hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(encoded),record.outputSha256);assert.equal(hash(pixels),record.decodedSha256);assert.equal(pixels.length,8192*8192);
  const at=(x,y)=>pixels[((y%8192+8192)%8192)*8192+(x%8192+8192)%8192]/255;
  return {record,sample(uv){const x=uv.x*8192-.5,y=uv.y*8192-.5,ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;}};
}

export async function classifyGroveContact(fixture,{classifyAlpha=false}={}){
  const {plant,branches,matrix}=fixture,plantBounds=new THREE.Box3().setFromObject(plant),branchBounds=branches.geometry.boundingBox.clone().applyMatrix4(matrix);
  const branchTriangles=meshTriangles(branches,matrix,plantBounds),plantTriangles=[];
  if(branchTriangles.length)plant.traverse(mesh=>{if(mesh.isMesh)for(const triangle of meshTriangles(mesh,mesh.matrixWorld,branchBounds))plantTriangles.push({...triangle,mesh:mesh.name,material:mesh.material});});
  const contacts=[];let coplanar=0;
  for(const a of plantTriangles)for(const b of branchTriangles){
    const contact=triangleContact(a,b);if(!contact)continue;if(contact.coplanar){coplanar++;continue;}
    contacts.push({plant:a,branch:b,points:contact.points});
  }
  const report={plant:{reservationIndex:fixture.reservationIndex,name:plant.name,...plant.userData,scale:plant.scale.toArray(),position:plant.position.toArray(),bounds:{min:plantBounds.min.toArray(),max:plantBounds.max.toArray()}},
    tree:{name:branches.name,instance:3,placement:fixture.treePlacement,material:{name:branches.material.name,alphaTest:branches.material.alphaTest,alphaMap:!!branches.material.alphaMap,transparent:branches.material.transparent},bounds:{min:branchBounds.min.toArray(),max:branchBounds.max.toArray()}},
    landscapeSHA256:fixture.landscapeSHA256,plantTrianglesNearTree:plantTriangles.length,branchTrianglesInsidePlantBounds:branchTriangles.length,actualContactSegments:contacts.length,coplanarCandidates:coplanar,contacts:[]};
  if(classifyAlpha&&contacts.length){
    const alpha=await alphaSampler();report.alphaSource=alpha.record;report.alphaMethod='Complete original scalar G packed as R8; SHA verified; repeat/flipY=false bilinear LOD0 sampling along intersection at <=0.5 texel spacing. No HDR or diffuse decode.';
    for(const contact of contacts){
      const {plant:a,branch:b,points}=contact,bary=points.map(p=>a.triangle.getBarycoord(p,new THREE.Vector3())),uv=bary.map(p=>a.uv[0].clone().multiplyScalar(p.x).addScaledVector(a.uv[1],p.y).addScaledVector(a.uv[2],p.z));
      const count=Math.max(2,Math.ceil(Math.max(Math.abs(uv[1].x-uv[0].x),Math.abs(uv[1].y-uv[0].y))*8192*2)+1);let min=1,max=0,visible=0;
      for(let i=0;i<count;i++){const value=alpha.sample(uv[0].clone().lerp(uv[1],i/(count-1)));min=Math.min(min,value);max=Math.max(max,value);visible+=value>=a.material.alphaTest;}
      report.contacts.push({plantTriangle:a.index,branchTriangle:b.index,mesh:a.mesh,points:points.map(p=>p.toArray()),uv:uv.map(p=>p.toArray()),alphaMin:min,alphaMax:max,visibleSamples:visible,sampleCount:count,alphaTest:a.material.alphaTest});
    }
    report.visibleContactSegments=report.contacts.filter(c=>c.visibleSamples>0).length;
  }
  return report;
}

export function probeGroveOffsets(fixture,offsets){
  const {plant,branches,matrix}=fixture,original=plant.position.clone(),result=[];
  try{
    for(const [dx,dz]of offsets){
      const x=original.x+dx,z=original.z+dz;plant.position.set(x,renderedTerrainHeight(x,z),z);plant.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(plant),support=herbariumPlantGroundSupport(plant,renderedTerrainHeight);
      result.push({offset:[dx,dz],position:plant.position.toArray(),branchTriangles:meshTriangles(branches,matrix,bounds).length,basalPenetration:support.basalPenetration,supported:support.valid});
    }
  }finally{plant.position.copy(original);plant.updateMatrixWorld(true);}
  return result;
}
