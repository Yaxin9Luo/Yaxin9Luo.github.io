import * as THREE from 'three';
import { gardenLayout, pointInPolygon } from './garden-layout.js';
import { createGardenPlantingLayout } from './garden-planting-layout.js';
import { createXianfaShoreCommunityLayout, xianfaShoreCommunitySpec } from './xianfa-shore-community-layout.js';

const V = (...p) => new THREE.Vector3(...p), UP = V(0,1,0), EPS = 1e-7;
const yieldFrame = () => new Promise(resolve => setTimeout(resolve,0));
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const finiteXZ = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const plain = value => JSON.parse(JSON.stringify(value));

function pointSegment(p,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
}
function hull(points) {
  const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const half=sequence=>{const result=[];for(const p of sequence){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p);}return result;};
  const a=half(sorted),b=half(sorted.slice().reverse());a.pop();b.pop();return a.concat(b);
}
function ringDistance(p,ring) {let d=Infinity;for(let i=0;i<ring.length;i++)d=Math.min(d,pointSegment(p,ring[i],ring[(i+1)%ring.length]));return d;}
function contains(p,region) {return pointInPolygon(p,region.polygon)&&!(region.holes??[]).some(h=>pointInPolygon(p,h));}
function polygonGap(shape,region) {
  if(shape.some(p=>contains(p,region))||region.polygon.some(p=>pointInPolygon(p,shape)))return 0;
  let gap=Infinity;
  for(const ring of [region.polygon,...(region.holes??[])])for(let i=0;i<shape.length;i++)for(let j=0;j<ring.length;j++){
    const a=shape[i],b=shape[(i+1)%shape.length],c=ring[j],d=ring[(j+1)%ring.length];
    if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
    gap=Math.min(gap,pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
  }
  return gap;
}
function validateRegion(r) {
  for(const ring of [r.polygon,...(r.holes??[])])if(!Array.isArray(ring)||ring.length<3||!ring.every(finiteXZ))throw new Error(`Invalid shoreline reservation: ${r.id??'unnamed'}`);
  if(!Number.isFinite(r.clearance??0)||(r.clearance??0)<0)throw new Error(`Invalid shoreline clearance: ${r.id}`);
  return r;
}
function reservationRecords(terrain,garden,supplied,clearings) {
  if(![terrain.paths,terrain.courtFootprints,terrain.waterSurfaces].every(Array.isArray))throw new Error('Shoreline needs the current terrain paths, courts and water surfaces.');
  return [
    ...createGardenPlantingLayout({layout:garden}).reservations,...supplied,...clearings,
    ...terrain.paths.map(p=>({...p,kind:'current-path',clearance:1})),
    ...terrain.courtFootprints.map(p=>({...p,kind:'current-court',clearance:1})),
    ...terrain.waterSurfaces.map(p=>({...p,kind:'current-water',clearance:.15})),
    ...garden.waterBodies.map(p=>({...p,kind:'layout-water',clearance:.15})),
    ...(garden.channels??[]).map(p=>({...p,kind:'water-channel',clearance:1})),
    ...(garden.ornamentalWaters??[]).map(p=>({...p,kind:'formal-water-and-walk',clearance:8})),
  ].map(validateRegion);
}
function terrainStamp(terrain) {return JSON.stringify({disposed:terrain.disposed??false,revision:terrain.revision??null,patches:(terrain.replacementStates??[]).map(({id,revision,active})=>({id,revision,active}))});}
function surfaceRecord(terrain,x,z,queryStats) {
  queryStats.queries++;
  const hit=terrain.surfaceAt(x,z,{includeBridges:true}),normal=hit?.normal?.isVector3?hit.normal.toArray():hit?.normal;
  if(!hit||!Number.isFinite(hit.height)||hit.supportSource!=='terrain-triangle'||hit.kind!=='land'||hit.walkable!==true||!Array.isArray(normal)||normal.length!==3||!normal.every(Number.isFinite)||Math.hypot(...normal)<.9||normal[1]<=0||Number.isFinite(hit.waterY)&&hit.height<=hit.waterY+.03)throw new Error(`No current dry terrain triangle at ${x}, ${z} (${hit?.kind??'missing'})`);
  return {x,z,height:hit.height,normal:[...normal],geometry:hit.geometry?.name??null,triangleIndex:hit.triangleIndex??null,kind:hit.kind,supportSource:hit.supportSource};
}
function affine(matrix) {
  const m=matrix.clone(),e=m.elements;
  if(e.some(v=>!Number.isFinite(v))||e[3]!==0||e[7]!==0||e[11]!==0||e[15]===0)throw new Error('Shoreline source transform must be finite and affine.');
  const w=e[15];if(w!==1)for(let i=0;i<16;i++)e[i]/=w;
  if(!(m.determinant()>0))throw new Error('Shoreline sources require positive, nonsingular transforms; no mirroring.');
  // Three's ordinary instance normal path supports orthogonal basis columns.
  // Reject shear instead of silently changing its surface response.
  const axes=[0,1,2].map(i=>new THREE.Vector3().setFromMatrixColumn(m,i).normalize());
  if(axes.some((a,i)=>axes.slice(i+1).some(b=>Math.abs(a.dot(b))>1e-10)))throw new Error('Sheared source transform cannot preserve ordinary instance normals.');
  return m;
}
function sourceProfile(part,id) {
  if(!part?.isObject3D)throw new Error(`Missing borrowed ${id} source part.`);
  part.updateWorldMatrix(true,true);const inverse=part.matrixWorld.clone().invert(),meshes=[],bounds=new THREE.Box3(),roots=[],v=V(),materials=new Set(),buffers=new Set();let triangles=0;
  part.traverse(node=>{
    if(!node.isMesh)return;
    if(node.isInstancedMesh||node.isBatchedMesh||node.isSkinnedMesh||node.morphTargetInfluences||node.morphTexture)throw new Error(`Shoreline source must be a static ordinary Mesh: ${node.name}`);
    const geometry=node.geometry,p=geometry?.attributes.position,local=affine(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
    if(!p||!geometry.attributes.normal)throw new Error(`Missing source surface: ${node.name}`);
    const mats=Array.isArray(node.material)?node.material:[node.material];
    if(mats.some(m=>!m?.isMeshStandardMaterial||m.transparent||m.opacity!==1))throw new Error(`Shoreline requires the reviewed opaque PBR material: ${node.name}`);
    mats.forEach(m=>materials.add(m));for(const a of [geometry.index,...Object.values(geometry.attributes)].filter(Boolean))buffers.add((a.isInterleavedBufferAttribute?a.data.array:a.array).buffer);
    const leaf=id!=='lake-rock'&&mats.some(m=>m.name==='understory-physical-leaf'||m.name==='understory-ivory-petal');
    const entry={node,local,leaf,index:meshes.length};meshes.push(entry);triangles+=(geometry.index?.count??p.count)/3;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(local);if(![v.x,v.y,v.z].every(Number.isFinite))throw new Error(`Nonfinite source vertex: ${node.name}`);bounds.expandByPoint(v);
      if(id!=='lake-rock'&&v.y<=0)roots.push({mesh:entry.index,vertex:i,point:v.toArray()});
    }
  });
  if(!meshes.length||id!=='lake-rock'&&!roots.length)throw new Error(`Empty or unrooted shoreline source: ${id}`);
  return {id,part,meshes,bounds,roots,triangles,materials,buffers};
}
function transformedBounds(profile,matrix) {
  const box=new THREE.Box3(),v=V();for(const x of [profile.bounds.min.x,profile.bounds.max.x])for(const y of [profile.bounds.min.y,profile.bounds.max.y])for(const z of [profile.bounds.min.z,profile.bounds.max.z])box.expandByPoint(v.set(x,y,z).applyMatrix4(matrix));return box;
}
function footprint(profile,matrix) {
  const points=[],v=V();for(const x of [profile.bounds.min.x,profile.bounds.max.x])for(const y of [profile.bounds.min.y,profile.bounds.max.y])for(const z of [profile.bounds.min.z,profile.bounds.max.z]){v.set(x,y,z).applyMatrix4(matrix);points.push([v.x,v.z]);}return hull(points);
}
function rootFootprint(profile,matrix) {return hull(profile.roots.map(root=>{const v=V(...root.point).applyMatrix4(matrix);return [v.x,v.z];}));}
function checkFootprint(polygon,layout,reserves,id) {
  if(polygon.some(p=>!pointInPolygon(p,layout.footprint)||ringDistance(p,layout.footprint)<.005))throw new Error(`${id} foliage leaves the 24 m authored bed.`);
  const clearances=reserves.map(r=>({id:r.id,kind:r.kind,margin:polygonGap(polygon,r)-(r.clearance??0)})).sort((a,b)=>a.margin-b.margin);
  const bad=clearances.find(r=>r.margin<=EPS);if(bad)throw new Error(`${id} enters ${bad.kind??'reservation'} ${bad.id} (${bad.margin} m)`);
  return clearances.slice(0,6);
}
function validatePlacement(p) {
  if(!p?.id||!Object.hasOwn(xianfaShoreCommunitySpec.triangleCounts,p.species)||!Array.isArray(p.position)||p.position.length!==3||!Number.isFinite(p.position[0])||!Number.isFinite(p.position[2])||p.position[1]!==null||![p.scale,p.yaw,p.burial].every(Number.isFinite)||p.scale<=0||p.burial<0||p.pitchX!==undefined&&!Number.isFinite(p.pitchX))throw new Error(`Invalid shoreline placement: ${p?.id}`);
}
function placementPose(p,centre) {
  const normal=V(...centre.normal).normalize();if(normal.y<Math.cos(18*Math.PI/180))throw new Error(`${p.id} root slope exceeds 18 degrees.`);
  const q=new THREE.Quaternion().setFromUnitVectors(UP,normal).multiply(new THREE.Quaternion().setFromAxisAngle(UP,p.yaw));
  if(p.pitchX)q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),p.pitchX));
  return new THREE.Matrix4().compose(V(p.position[0],0,p.position[2]),q,V(p.scale,p.scale,p.scale));
}
function contextWillows(pilot,layout,terrain,queryStats) {
  const result=[];
  for(const id of layout.contextIds){
    const part=pilot.parts.find(p=>p.userData.placementId===id&&p.userData.species==='willow'),mesh=part?.getObjectByName('willow-trunk-and-roots');
    if(!mesh?.isMesh||mesh.isInstancedMesh)throw new Error(`Missing retained willow root mesh: ${id}`);
    part.updateWorldMatrix(true,true);const local=new THREE.Matrix4().multiplyMatrices(part.matrixWorld.clone().invert(),mesh.matrixWorld),p=mesh.geometry.attributes.position,v=V(),world=V(),rootPoints=[];let checked=0,maxGap=-Infinity;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(local);if(v.y>.16)continue;world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);rootPoints.push([world.x,world.z]);
      if(v.y<=0){const hit=surfaceRecord(terrain,world.x,world.z,queryStats),gap=world.y-hit.height;checked++;maxGap=Math.max(maxGap,gap);if(gap>EPS)throw new Error(`Retained willow ${id} no longer meets current terrain.`);}
    }
    if(!checked||rootPoints.length<3)throw new Error(`No actual retained willow root witnesses: ${id}`);
    result.push({id,group:part,polygon:hull(rootPoints),checked,maxGap,worldMatrix:[...part.matrixWorld.elements]});
  }
  return result;
}
function groundedPlant(p,profile,terrain,centre,queryStats,signal) {
  const matrix=placementPose(p,centre),samples=[],v=V();let y=Infinity;
  for(const root of profile.roots){v.fromArray(root.point).applyMatrix4(matrix);const hit=surfaceRecord(terrain,v.x,v.z,queryStats);y=Math.min(y,hit.height-v.y-p.burial);samples.push({root,hit,posedY:v.y});}
  matrix.elements[13]=y;let minGap=Infinity,maxGap=-Infinity;
  for(const s of samples){const gap=y+s.posedY-s.hit.height;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);if(gap>EPS)throw new Error(`${p.id} has an exposed root vertex.`);}
  // Only actual foliage beyond the 25 mm basal collar must remain above soil.
  // Every tested height comes from current terrain.surfaceAt, not an analytic
  // plane or a centre-height shortcut. These are one-time placement checks.
  let foliageVertices=0,minimumFoliageGap=Infinity,minimumWitness=null;
  for(const m of profile.meshes)if(m.leaf){
    const pos=m.node.geometry.attributes.position,world=new THREE.Matrix4().multiplyMatrices(matrix,m.local),local=V();
    for(let i=0;i<pos.count;i++){
      if(i%8192===0)signal?.throwIfAborted();local.fromBufferAttribute(pos,i).applyMatrix4(m.local);if(local.y<=.025)continue;
      v.fromBufferAttribute(pos,i).applyMatrix4(world);const hit=surfaceRecord(terrain,v.x,v.z,queryStats),gap=v.y-hit.height;foliageVertices++;
      if(gap<minimumFoliageGap){minimumFoliageGap=gap;minimumWitness={mesh:m.node.name,vertex:i,world:v.toArray(),terrain:hit};}
      if(gap<-.003)throw new Error(`${p.id} foliage enters actual soil by ${-gap} m.`);
    }
  }
  return {matrix,grounding:{method:'every actual below-datum root vertex and every foliage vertex above the source basal collar; current terrain.surfaceAt',centre,rootVertices:samples.length,minimumRootGap:minGap,maximumRootGap:maxGap,foliageVertices,minimumFoliageGap,minimumFoliageWitness:minimumWitness,rootWitnesses:samples.slice(0,4).map(s=>({mesh:profile.meshes[s.root.mesh].node.name,vertex:s.root.vertex,terrain:s.hit,world:V(...s.root.point).applyMatrix4(matrix).toArray()})),burial:p.burial}};
}
function groundedStone(p,profile,terrain,centre,queryStats,signal) {
  const matrix=placementPose(p,centre),box=transformedBounds(profile,matrix),v=V();matrix.elements[12]+=p.position[0]-(box.min.x+box.max.x)/2;matrix.elements[14]+=p.position[2]-(box.min.z+box.max.z)/2;
  let minimumY=Infinity,maximumY=-Infinity;
  for(const m of profile.meshes){const transform=new THREE.Matrix4().multiplyMatrices(matrix,m.local),pos=m.node.geometry.attributes.position;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(transform);minimumY=Math.min(minimumY,v.y);maximumY=Math.max(maximumY,v.y);}}
  const band=(maximumY-minimumY)*.15,contacts=[];let translation=centre.height-minimumY-p.burial;
  for(const m of profile.meshes){const transform=new THREE.Matrix4().multiplyMatrices(matrix,m.local),pos=m.node.geometry.attributes.position;for(let i=0;i<pos.count;i++){
    if(i%8192===0)signal?.throwIfAborted();v.fromBufferAttribute(pos,i).applyMatrix4(transform);if(v.y>minimumY+band)continue;
    const hit=surfaceRecord(terrain,v.x,v.z,queryStats);translation=Math.min(translation,hit.height-v.y-.006);contacts.push({mesh:m.node.name,vertex:i,point:v.toArray(),terrain:hit});
  }}
  if(contacts.length<3)throw new Error(`${p.id} lacks real lower-surface contact vertices.`);
  matrix.elements[13]=translation;const witnesses=[];let minGap=Infinity,maxGap=-Infinity;
  for(const c of contacts){const gap=c.point[1]+translation-c.terrain.height;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);if(witnesses.length<4&&witnesses.every(w=>Math.hypot(w.world[0]-c.point[0],w.world[2]-c.point[2])>.15*p.scale))witnesses.push({mesh:c.mesh,vertex:c.vertex,world:[c.point[0],c.point[1]+translation,c.point[2]],terrain:c.terrain,gap});}
  if(witnesses.length<3||maxGap>EPS)throw new Error(`${p.id} has insufficient separated buried contact witnesses.`);
  if(maximumY+translation-centre.height<.10*p.scale)throw new Error(`${p.id} would be almost entirely buried.`);
  return {matrix,grounding:{method:'actual rotated lower 15 percent surface vertices; current terrain.surfaceAt; never upright-source root selection',centre,rootVertices:contacts.length,minimumRootGap:minGap,maximumRootGap:maxGap,rootWitnesses:witnesses,requestedBurial:p.burial,exposedHeightAboveCentre:maximumY+translation-centre.height}};
}

/** Borrow one full R2 understory owner and the already resident pilot. This
 * factory never creates source geometry, decodes textures or duplicates trees.
 * Mount only result.group. collisionSources is a detached, non-rendered source
 * for createMuseumPlantingColliders; contextGroups must never be reparented.
 * Dispose this group before either borrowed owner; all coordinates are world. */
export async function createXianfaShoreCommunity({terrain,plantingPilot,understoryOwner,layout=createXianfaShoreCommunityLayout(),garden=gardenLayout,reservedPolygons=[],signal,yieldControl=yieldFrame,onProgress=()=>{}}={}) {
  signal?.throwIfAborted();
  if(typeof terrain?.surfaceAt!=='function'||!plantingPilot?.group?.isObject3D||!Array.isArray(plantingPilot.parts)||!Array.isArray(understoryOwner?.parts)||typeof understoryOwner.dispose!=='function'||typeof plantingPilot.dispose!=='function')throw new Error('Shore community requires live terrain and borrowed understory/pilot owners.');
  if(!finiteXZ(layout.originXZ)||!Array.isArray(layout.placements)||!layout.placements.length||new Set(layout.placements.map(p=>p.id)).size!==layout.placements.length)throw new Error('Invalid shoreline layout.');
  validateRegion({id:'authored-bed',polygon:layout.footprint});layout.placements.forEach(validatePlacement);
  const stamp=terrainStamp(terrain),queryStats={queries:0},reserves=reservationRecords(terrain,garden,reservedPolygons,layout.clearings??[]),contexts=contextWillows(plantingPilot,layout,terrain,queryStats),profiles=new Map();
  for(const id of new Set(layout.placements.map(p=>p.species))){
    const part=id==='lake-rock'?plantingPilot.parts.find(p=>p.userData.species==='lake-rock'):understoryOwner.parts.find(p=>p.userData.id===id);profiles.set(id,sourceProfile(part,id));
  }
  const group=new THREE.Group(),collisionGroup=new THREE.Group(),collisionParts=[],contextGroups=contexts.map(c=>c.group),instanceViews=new Set(),listeners=[],borrowedOwners=[understoryOwner,plantingPilot],resolved=[],rejected=[],bindings=[];
  group.name='xianfa-shore-community';group.position.set(layout.originXZ[0],0,layout.originXZ[1]);group.updateMatrixWorld(true);collisionGroup.name='xianfa-shore-community-collision-sources';collisionGroup.position.copy(group.position);collisionGroup.updateMatrixWorld(true);
  group.userData={body:'contemporary-shore-planting-community',worldCoordinates:true,historicallySurveyed:false,sourceFreeze:xianfaShoreCommunitySpec.understoryFreeze,nativeCompositionReviewed:false};
  const diagnostics={id:layout.id,representation:'unchanged-source-geometry-and-PBR; positive-yaw-scale-instances-in-8m-cells',sourceSpec:{...xianfaShoreCommunitySpec},sourceOwnerId:understoryOwner.diagnostics?.id??null,nativeCompositionReviewed:false,fullGardenDistribution:false,borrowedSourceInvalidated:false,terrainStamp:stamp,queryStats,placements:[],rejected,context:contexts.map(({id,checked,maxGap,worldMatrix})=>({id,rootVerticesChecked:checked,maximumRootGap:maxGap,worldMatrix,newDrawNodes:0}))};
  let disposed=false;
  const dispose=()=>{
    if(disposed)return;disposed=true;const errors=[],run=f=>{try{f();}catch(e){errors.push(e);}};
    run(()=>group.removeFromParent());run(()=>group.clear());run(()=>collisionGroup.removeFromParent());run(()=>collisionGroup.clear());for(const p of collisionParts)run(()=>p.clear());
    for(const [resource,callback] of listeners)run(()=>resource.removeEventListener('dispose',callback));listeners.length=0;
    for(const view of instanceViews)run(()=>view.dispose());instanceViews.clear();bindings.length=0;contextGroups.length=0;borrowedOwners.length=0;
    if(errors.length)throw new AggregateError(errors,'Shoreline instance disposal failed.');
  };
  try {
    for(const p of layout.placements){
      signal?.throwIfAborted();
      try{
        const profile=profiles.get(p.species),centre=surfaceRecord(terrain,p.position[0],p.position[2],queryStats),placed=p.species==='lake-rock'?groundedStone(p,profile,terrain,centre,queryStats,signal):groundedPlant(p,profile,terrain,centre,queryStats,signal);
        const polygon=footprint(profile,placed.matrix),nearestReserves=checkFootprint(polygon,layout,reserves,p.id),rootPolygon=p.species==='lake-rock'?polygon:rootFootprint(profile,placed.matrix);
        for(const c of contexts)if(polygonGap(rootPolygon,{polygon:c.polygon})<.10+(p.rootClearance??0))throw new Error(`${p.id} root collar enters retained willow roots ${c.id}.`);
        resolved.push({record:p,profile,...placed,polygon,rootPolygon,nearestReserves});
      }catch(error){if(signal?.aborted)throw error;rejected.push({id:p.id,message:error.message});}
      onProgress({phase:'grounding',completed:resolved.length+rejected.length,total:layout.placements.length,id:p.id,queries:queryStats.queries});await yieldControl();
      if(terrainStamp(terrain)!==stamp)throw new Error('Terrain revision changed during shoreline grounding; retry against the current owner.');
    }
    const stones=resolved.filter(p=>p.record.species==='lake-rock');
    for(const p of resolved)if(p.record.species!=='lake-rock')for(const rock of stones)if(polygonGap(p.rootPolygon,{polygon:rock.polygon})<.05)rejected.push({id:p.record.id,message:`Root collar enters recumbent stone ${rock.record.id}.`});
    for(let i=0;i<resolved.length;i++)for(let j=i+1;j<resolved.length;j++)if(resolved[i].record.species!=='lake-rock'&&resolved[j].record.species!=='lake-rock'&&polygonGap(resolved[i].rootPolygon,{polygon:resolved[j].rootPolygon})<.035)rejected.push({id:resolved[j].record.id,message:`Root collar overlaps another new plant ${resolved[i].record.id}.`});
    if(rejected.length){const error=new Error(`Shoreline has ${rejected.length} rejected placements; no render instances were admitted.`);error.diagnostics=diagnostics;throw error;}
    const inverse=group.matrixWorld.clone().invert(),batches=new Map();let maxMatrixError=0;
    for(const placement of resolved)for(const mesh of placement.profile.meshes){
      const matrix=affine(new THREE.Matrix4().multiplyMatrices(inverse,placement.matrix).multiply(mesh.local)),cell=[Math.floor(matrix.elements[12]/8),Math.floor(matrix.elements[14]/8)],key=`${mesh.node.uuid}:${cell.join(',')}`;
      if(!batches.has(key))batches.set(key,{source:mesh.node,entries:[],cell});batches.get(key).entries.push({placement,mesh,matrix});
    }
    for(const batch of batches.values()){
      signal?.throwIfAborted();const source=batch.source,view=new THREE.InstancedMesh(source.geometry,source.material,batch.entries.length);instanceViews.add(view);
      view.name=`shore-batch-${source.name}-${batch.cell.join('-')}`;view.castShadow=source.castShadow;view.receiveShadow=source.receiveShadow;view.visible=source.visible;view.renderOrder=source.renderOrder;view.layers.mask=source.layers.mask;view.userData={...plain(source.userData),shoreSourceName:source.name,sourceGeometryUUID:source.geometry.uuid,sourcePreserved:true};
      for(const key of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','customDepthMaterial','customDistanceMaterial'])view[key]=source[key];
      for(const [index,entry] of batch.entries.entries()){
        view.setMatrixAt(index,entry.matrix);const actual=new THREE.Matrix4();view.getMatrixAt(index,actual);for(let i=0;i<16;i++)maxMatrixError=Math.max(maxMatrixError,Math.abs(actual.elements[i]-entry.matrix.elements[i]));
        bindings.push({placementId:entry.placement.record.id,sourceMesh:source,drawMesh:view,instance:index,matrix:actual});
        if(entry.placement.record.species==='lake-rock'){
          let part=collisionParts.find(p=>p.userData.placementId===entry.placement.record.id);
          if(!part){part=new THREE.Group();part.name=`shore-collision-${entry.placement.record.id}`;part.userData={placementId:entry.placement.record.id,species:'lake-rock'};collisionGroup.add(part);collisionParts.push(part);}
          const mesh=new THREE.Mesh(source.geometry,source.material);mesh.name=source.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(actual);part.add(mesh);
        }
      }
      view.instanceMatrix.needsUpdate=true;view.computeBoundingBox();view.computeBoundingSphere();group.add(view);
    }
    group.updateMatrixWorld(true);collisionGroup.updateMatrixWorld(true);
    const geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set();let triangles=0,instances=0,instanceBytes=0;
    for(const view of instanceViews){geometries.add(view.geometry);for(const a of [view.geometry.index,...Object.values(view.geometry.attributes)].filter(Boolean))buffers.add((a.isInterleavedBufferAttribute?a.data.array:a.array).buffer);triangles+=(view.geometry.index?.count??view.geometry.attributes.position.count)/3*view.count;instances+=view.count;instanceBytes+=view.instanceMatrix.array.byteLength;for(const m of Array.isArray(view.material)?view.material:[view.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}}
    const invalidate=()=>{diagnostics.borrowedSourceInvalidated=true;group.visible=false;};
    for(const resource of [...geometries,...materials,...textures]){resource.addEventListener('dispose',invalidate);listeners.push([resource,invalidate]);}
    diagnostics.placements=resolved.map(p=>({...p.record,position:[p.matrix.elements[12],p.matrix.elements[13],p.matrix.elements[14]],requestedAnchor:[...p.record.position],worldMatrix:[...p.matrix.elements],footprint:p.polygon,rootFootprint:p.rootPolygon,grounding:p.grounding,nearestReserves:p.nearestReserves}));
    Object.assign(diagnostics,{counts:Object.fromEntries([...profiles].map(([id])=>[id,resolved.filter(p=>p.record.species===id).length])),trianglesPerPass:triangles,drawMeshes:instanceViews.size,meshInstances:instances,uniqueGeometries:geometries.size,uniqueMaterials:materials.size,uniqueTextures:textures.size,borrowedGeometryBufferBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),ownedInstanceBufferBytes:instanceBytes,maximumMatrixElementQuantizationError:maxMatrixError,collisionStoneCount:collisionParts.length,sourceFactoriesConstructed:0,borrowedOwnersDisposed:false,limit:'Appearance of this complete shoreline, terrain contact, shadows, AO, reflections and movement still needs main-world native review.'});
    return {group,contextGroups,collisionSources:{group:collisionGroup,parts:collisionParts},diagnostics,bindings,dispose,get disposed(){return disposed;}};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Shoreline construction and cleanup failed.');}throw error;}
}

export { createXianfaShoreCommunityLayout, xianfaShoreCommunitySpec } from './xianfa-shore-community-layout.js';
