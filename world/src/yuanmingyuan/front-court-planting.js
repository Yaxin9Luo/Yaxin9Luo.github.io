import {Group,Vector3,Matrix4} from 'three';
import {prepareSpreadingPineFactory} from './spreading-pine-loader.js';
import {createFrontCourtPinePlacements,frontCourtPineEnvelopeRadius} from './front-court-pine-placements.js';
import {yangquelongGardenLayout} from './yangquelong-garden-layout.js';
import {createFrontCourtPlantingSources,createFrontCourtPlantingRegion} from './front-court-planting-sources.js';
import {createWesternGardenPlantingPlan} from './western-garden-planting.js';
import {createMuseumPlantingColliders} from './museum-planting-colliders.js';
import {pointInPolygon} from './garden-layout.js';
import {plantingDistanceToPolygon} from './garden-planting-layout.js';
import {frontCourtPines,createFrontCourtPlantingLayout} from './front-court-planting-layout.js';
const support=(terrain,x,z)=>{const h=terrain.surfaceAt(x,z,{includeBridges:false});const n=h?.normal?.y??h?.normal?.[1];if(!h||h.kind!=='land'||!h.walkable||h.supportSource!=='terrain-triangle'||!Number.isFinite(h.height)||!(n>.985))throw new Error('Pine needs current gentle dry land: '+x+','+z);return h;};
export async function prepareFrontCourtPlanting({root,terrain,architecture,signal,preparePine=prepareSpreadingPineFactory,createSources=createFrontCourtPlantingSources,createRegion=createFrontCourtPlantingRegion}={}){
 signal?.throwIfAborted();const layout=createFrontCourtPlantingLayout(),group=new Group();group.name='Front-court contemporary planting';
 const regions=[],lifetime=new AbortController();let sourceOwner=null,pine=null,pines=null,collision=null,disposed=false,preparing=true,released=false,cleanupError=null;const grounded=[];
 const act=f=>{try{f();}catch(e){cleanupError??=e;}};
 function releaseSources(){if(released)return;released=true;act(()=>pine?.dispose());act(()=>sourceOwner?.dispose());}
 function dispose(){
  if(disposed){if(cleanupError)throw cleanupError;return;}disposed=true;signal?.removeEventListener('abort',abort);
  act(()=>collision?.dispose());for(const r of [...regions].reverse())act(()=>r.dispose());act(()=>pines?.dispose());act(()=>group.removeFromParent());group.clear();
  act(()=>lifetime.abort(signal?.reason));if(!preparing)releaseSources();if(cleanupError)throw cleanupError;
 }
 const abort=()=>{try{dispose();}catch{}};signal?.addEventListener('abort',abort,{once:true});
 const whenIdle=async()=>{await sourceOwner?.whenIdle?.();await pine?.whenIdle?.();if(cleanupError)throw cleanupError;};
 try{
  for(const region of layout.regions){const p=createWesternGardenPlantingPlan({regionId:region.id,terrain,architecture,plantingLayout:layout});if(!p.valid){const error=new Error('Front court low planting rejected '+region.id);error.plan=p;throw error;}}
  const reserves=[...layout.buildingReserves,...layout.clearings,...terrain.courtFootprints.map(r=>({...r,clearance:1}))];
  // Reserve the whole adjusted private crown, then verify every actual cloned
  // mesh/instance bound against that same disk before publication.
  const sourceRadius=frontCourtPineEnvelopeRadius;
  for(const p of frontCourtPines){support(terrain,p.position[0],p.position[2]);for(const r of reserves)if(pointInPolygon([p.position[0],p.position[2]],r.polygon)||plantingDistanceToPolygon([p.position[0],p.position[2]],r.polygon)<=sourceRadius*p.scale+(r.clearance??0))throw new Error('Pine crown reserve conflicts: '+p.id+'/'+r.id);}
  const factory=await preparePine({signal:lifetime.signal});lifetime.signal.throwIfAborted();pine=factory();
  const expected=yangquelongGardenLayout.source,nodes=[];pine.group.traverse(n=>{if(n.isMesh)nodes.push(n);});
  const triangles=nodes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0);
  if(pine.diagnostics.id!==expected.pineId||nodes.length!==expected.pineMeshes||triangles!==expected.pineTriangles)throw new Error('One complete admitted R4 pine source required.');
  const body=pine.group.getObjectByName('pine-r3-trunk-and-roots'),position=body.geometry.attributes.position;
  const roots=[];for(let i=0;i<position.count;i++)if(position.getY(i)<=0)roots.push([position.getX(i),position.getY(i),position.getZ(i)]);
  if(!roots.length)throw new Error('Original pine buried root vertices missing.');
  const v=new Vector3();
  for(const item of frontCourtPines){
   lifetime.signal.throwIfAborted();const p={...item,position:[...item.position]},[x,,z]=p.position,centre=support(terrain,x,z),rotation=new Matrix4().makeRotationY(p.yaw);let y=centre.height-.004;
   const samples=roots.map(r=>{v.fromArray(r).multiplyScalar(p.scale).applyMatrix4(rotation);const h=support(terrain,x+v.x,z+v.z);y=Math.min(y,h.height-v.y-.004);return {localY:v.y,height:h.height};});
   if(centre.height-y>.035)throw new Error('Pine needs excessive new burial: '+p.id);
   p.position[1]=y;
   grounded.push({...p,contact:{actualRootVertices:samples.length,centreHeight:centre.height,burial:centre.height-y,maximumGap:samples.reduce((m,s)=>Math.max(m,y+s.localY-s.height),-Infinity),minimumGap:samples.reduce((m,s)=>Math.min(m,y+s.localY-s.height),Infinity)}});
  }
  pines=createFrontCourtPinePlacements(pine.group,grounded);pines.group.name='Front-court unequal mature spreading pines';
  for(const p of pines.roots)Object.assign(p.userData,{species:'pine',placementId:p.userData.id,evidence:'contemporary-front-court-placement',historicalIndividual:false});
  group.add(pines.group);group.updateMatrixWorld(true);
  sourceOwner=createSources({plantingLayout:layout});
  for(const region of layout.regions){
   const prepared=await sourceOwner.prepareRegion(region.id,{signal:lifetime.signal});lifetime.signal.throwIfAborted();
   const owner=await createRegion({regionId:region.id,terrain,architecture,sources:prepared.sources,plantingLayout:layout,signal:lifetime.signal});
   if(disposed||lifetime.signal.aborted){owner.dispose();lifetime.signal.throwIfAborted();}
   regions.push(owner);group.add(owner.group);
  }
  const regionalParts=regions.flatMap(r=>r.parts),regionalPlacements=regions.flatMap(r=>r.plan.placements);
  const willowParts=regionalParts.filter(p=>p.userData.species==='willow');
  if(willowParts.length!==layout.qianhuGrove.counts.willow)throw new Error('Qianhu full willow borrower count changed.');
  // One collision owner covers the original seven pines and all six actual
  // willow trunks. Leaves and low plants remain non-solid; no support is added.
  collision=createMuseumPlantingColliders({group,parts:[...pines.roots,...willowParts]},{terrain,reservedPolygons:reserves,signal:lifetime.signal});
  const partTriangles=part=>{let count=0;part.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});return count;};
  const willowTriangles=willowParts.reduce((n,p)=>n+partTriangles(p),0),willowPlacements=regionalPlacements.filter(p=>p.species==='willow');
  const willowRootsChecked=willowPlacements.reduce((n,p)=>n+p.grounding.actualRootVertices,0);
  const qianhuParts=regionalParts.filter(p=>p.userData.placementId.startsWith('qianhu-'));
  const qianhuGrove={...layout.qianhuGrove,actualRootVerticesChecked:true,fullSizeWillows:willowPlacements.map(p=>({id:p.id,position:[...p.position],yaw:p.yaw,scale:p.scale,contact:{actualRootVertices:p.grounding.actualRootVertices,centreHeight:p.grounding.samples[0].height,burial:p.grounding.samples[0].height-p.position[1],maximumGap:p.grounding.maximumRootGap,minimumGap:p.grounding.minimumRootGap}})),actualSourceTriangles:qianhuParts.reduce((n,p)=>n+partTriangles(p),0),willowCount:willowParts.length,willowTriangles,willowRootsChecked,willowMaximumRootGap:Math.max(...willowPlacements.map(p=>p.grounding.maximumRootGap)),collisionSourceCount:collision.diagnostics.sourceMeshCount};
  root.add(group);group.updateMatrixWorld(true);preparing=false;lifetime.signal.throwIfAborted();
  const worldMatrix=group.matrixWorld.clone(),identities=pines.roots.map(r=>r.matrix.clone());
  function assertCurrent(){
   if(disposed||terrain.disposed||architecture.disposed||pines.disposed||!pine.group.children.length||sourceOwner.disposed)throw new Error('Front court planting owner/support disposed.');
   group.updateWorldMatrix(true,true);if(!group.matrixWorld.equals(worldMatrix))throw new Error('Front court planting world frame changed.');
   pines.roots.forEach((r,i)=>{if(!r.matrix.equals(identities[i]))throw new Error('Planted pine moved; reprepare contact/collision.');});
   for(const r of regions)r.assertCurrent();
   return true;
  }
  return {group,pine,pines,regions,layout,collision,diagnostics:{id:'front-court-planting-r5-qianhu-r1',qianhuGrove,regionalPlantCount:regionalParts.length,regionalPlantTriangles:regions.reduce((n,r)=>n+r.diagnostics.trianglesPerPass,0),pineSourceScaleRange:[Math.min(...grounded.map(p=>p.scale)),Math.max(...grounded.map(p=>p.scale))],maturePineCount:grounded.length,sourceGeometryChanged:false,fullSizePines:grounded,lowPlantCount:regionalParts.length-willowParts.length,lowPlantTriangles:regions.reduce((n,r)=>n+r.diagnostics.trianglesPerPass,0)-willowTriangles,lowRootsChecked:regions.reduce((n,r)=>n+r.diagnostics.rootsChecked,0)-willowRootsChecked,maximumLowRootGap:Math.max(...regionalPlacements.filter(p=>p.species!=='willow').map(p=>p.grounding.maximumRootGap)),maximumRegionalRootGap:Math.max(...regions.map(r=>r.diagnostics.maximumRootGap)),sourcePineTriangles:triangles,pineInstancesOwnBuffers:true,privatePineCrown:pines.diagnostics,lowPlantBuffersBorrowed:true,compositionArtAccepted:false,collision:collision.diagnostics},get disposed(){return disposed;},assertCurrent,update(time){assertCurrent();pine.update?.(time);sourceOwner.update(time);},whenIdle,dispose};
 }catch(error){preparing=false;try{dispose();}catch{}releaseSources();try{await whenIdle();}catch(cleanup){throw new AggregateError([error,cleanup],'Planting preparation and cleanup failed');}throw error;}
}
