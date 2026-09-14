import * as THREE from 'three';
import {createYangquelongUnderstoreySources} from './yangquelong-understorey-source.js';
import {createYangquelongUnderstoreyLayout,sourceFootprints,inspectUnderstoreyPlacement,pineRootReservations} from './yangquelong-understorey-layout.js';
import {yangquelongBedGroundSpec} from './yangquelong-bed-ground.js';
import {yangquelongGardenLayout} from './yangquelong-garden-layout.js';
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong understorey: '+message);};

/** The immutable prototypes are borrowed, instance buffers are owned here.
 * A borrowed source is never released by this owner. Its before-dispose lease
 * detaches borrowers before geometry/material disposal even on forced exit. */
export function createYangquelongUnderstorey({
 sourceOwner,signal,bedIds,layout,createSources=createYangquelongUnderstoreySources,
 createInstance=(geometry,material,count)=>new THREE.InstancedMesh(geometry,material,count),
}={}){
 signal?.throwIfAborted();
 const ownedSource=!sourceOwner,source=sourceOwner??createSources({signal}),group=new THREE.Group(),instanceMeshes=[],errors=[];
 group.name='yangquelong-low-planting-r5';group.userData={evidence:'contemporary-museum-landscape-design',historicalPlanting:false,nativeReviewed:false};
 let disposed=false,unsubscribe=null,sourceReleased=false,plan;
 const remember=e=>{if(!errors.includes(e))errors.push(e);};
 const attempt=fn=>{try{fn();}catch(e){remember(e);}};
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);
  attempt(()=>unsubscribe?.());unsubscribe=null;
  attempt(()=>group.removeFromParent());
  for(const mesh of instanceMeshes)attempt(()=>mesh.dispose());
  attempt(()=>group.clear());
  if(ownedSource&&!sourceReleased){sourceReleased=true;attempt(()=>source.dispose());}
  if(errors.length)throw new AggregateError([...errors],'Understorey placement cleanup failed');
 }
 function cancel(){try{dispose();}catch{/* whenIdle retains failures; abort listeners never throw. */}}
 function assertCurrent(){
  signal?.throwIfAborted();fail(!disposed,'placement owner disposed');source.assertCurrent();
  fail(instanceMeshes.every(m=>m.parent?.parent===group),'instance attachment changed');return true;
 }
 try{
  signal?.throwIfAborted();source.assertCurrent();fail(source.variants instanceof Map&&typeof source.subscribeBeforeDispose==='function','a tracked source lease is required');
  unsubscribe=source.subscribeBeforeDispose(dispose);signal?.addEventListener('abort',cancel,{once:true});
  plan=layout??createYangquelongUnderstoreyLayout(source,{...(bedIds?{bedIds}:{})});
  fail(Array.isArray(plan.placements)&&plan.placements.length,'nonempty actual-bed planting plan required');
  const footprints=sourceFootprints(source),ids=new Set(),byBed=new Map(),bySource=new Map();
  for(const p of plan.placements){
   signal?.throwIfAborted();
   fail(!ids.has(p.id)&&p.position?.length===3&&p.position.every(Number.isFinite)&&Number.isFinite(p.yaw)&&Number.isFinite(p.scale)&&p.scale>0&&p.position[1]===yangquelongBedGroundSpec.soilTop,'unique finite rooted placement required');ids.add(p.id);
   const bed=yangquelongBedGroundSpec.beds.find(b=>b.id===p.bed),pine=yangquelongGardenLayout.placements.find(t=>t.bed===p.bed),fp=footprints.get(p.sourceId);
   fail(bed&&pine&&fp&&inspectUnderstoreyPlacement(p,fp,bed,pineRootReservations(pine)).valid,'plant canopy outside actual soil, edging/root reservation, or height: '+p.id);
   if(!byBed.has(p.bed)){const g=new THREE.Group();g.name='understorey-bed-'+p.bed;g.userData={bedId:p.bed};group.add(g);byBed.set(p.bed,g);}
   const key=p.bed+'/'+p.sourceId;if(!bySource.has(key))bySource.set(key,[]);bySource.get(key).push(p);
  }
  const rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),matrix=new THREE.Matrix4();
  source.group.updateMatrixWorld(true);
  for(const [key,placements] of bySource){
   const prototype=source.variants.get(placements[0].sourceId),parent=byBed.get(placements[0].bed);
   for(const original of prototype.meshes){
    signal?.throwIfAborted();const mesh=createInstance(original.geometry,original.material,placements.length);
    fail(mesh?.isInstancedMesh,'instance factory must return an actual InstancedMesh');instanceMeshes.push(mesh);
    if(disposed){attempt(()=>mesh.dispose());signal?.throwIfAborted();fail(false,'source disposed during instance handoff');}
    mesh.name='understorey-'+key.replace('/','-')+'-'+original.name;
    mesh.castShadow=original.castShadow;mesh.receiveShadow=original.receiveShadow;
    for(const hook of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'])if(original[hook])mesh[hook]=original[hook];
    mesh.userData={sourceId:prototype.id,bedId:placements[0].bed,placements:placements.map(p=>p.id),placementKinds:placements.map(p=>p.kind),sourceGeometryBorrowed:true,sourceMaterialBorrowed:true};
    for(let i=0;i<placements.length;i++){
     const p=placements[i];rotation.setFromAxisAngle(axis,p.yaw);
     matrix.compose(new THREE.Vector3(...p.position),rotation,new THREE.Vector3(p.scale,p.scale,p.scale)).multiply(original.matrixWorld);
     mesh.setMatrixAt(i,matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);
   }
  }
  group.updateMatrixWorld(true);assertCurrent();
  const bounds=new THREE.Box3().setFromObject(group),counts={};
  for(const p of plan.placements)counts[p.sourceId]=(counts[p.sourceId]??0)+1;
  const triangles=instanceMeshes.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*m.count,0);
  const diagnostics={id:'yangquelong-understorey-r5',evidence:group.userData.evidence,historicalIdentity:false,nativeReviewed:false,
   plants:plan.placements.length,counts,meshes:instanceMeshes.length,triangles,triangleCount:triangles,
   leaves:plan.placements.reduce((n,p)=>n+source.variants.get(p.sourceId).diagnostics.leaves,0),
   flowers:plan.placements.reduce((n,p)=>n+source.variants.get(p.sourceId).diagnostics.flowers,0),
   bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},beds:plan.beds,source:source.diagnostics,
   ownership:{sourceBorrowed:!ownedSource,instanceBuffersOwned:instanceMeshes.length,releaseOrder:['detach instance group','instance buffers','owned source only'],forcedSourceDisposal:'source beforeDispose callback releases instance buffers first'},
   plantedCoverage:plan.coverageMethod,limitations:['This is a contemporary planting candidate, not historical reconstruction.','No native image or complete-garden art pass is implied by CPU checks.'],
  };
  return {group,sourceOwner:source,layout:plan,instanceMeshes,diagnostics,assertCurrent,
   update(){try{return assertCurrent();}catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Understorey validation and cleanup failed',{cause:error});}throw error;}},
   dispose,async whenIdle(){try{await source.whenIdle?.();}catch(e){remember(e);}if(errors.length)throw new AggregateError([...errors],'Understorey placement cleanup failed');},
   get disposed(){return disposed;},
  };
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Understorey construction and cleanup failed',{cause:error});}throw error;}
}
