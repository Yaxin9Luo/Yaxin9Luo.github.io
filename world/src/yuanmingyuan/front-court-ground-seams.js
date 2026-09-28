import {BufferGeometry,Float32BufferAttribute,Mesh} from 'three';
import {frontCourtLayout as F} from './front-court-layout.js';
import {dagongmenLayout as D} from './dagongmen-layout.js';
export const rectPolygon=r=>[[r.x0,r.z0],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]];
const rectangle=(id,x0,z0,x1,z1,extra={})=>({id,x0,z0,x1,z1,...extra});
export function originalRoadRectangles({world=true}={}){
 const [x,y,z]=world?F.assets[0].position:[0,0,0],w=D.road.width/2;
 return [
 rectangle('dag-white-axis',x-w,z+7.1,x+w,z+D.road.frontZ,{pitchX:1.6,pitchZ:1.6}),
 rectangle('dag-west-cross-arm',x-22,z+197.4,x-w,z+200.6,{pitchX:.42,pitchZ:.82}),
 rectangle('dag-east-cross-arm',x+w,z+197.4,x+22,z+200.6,{pitchX:.42,pitchZ:.82}),
 rectangle('dag-north-approach',x-6.5,z-8.5,x+6.5,z-4.3,{pitchX:.42,pitchZ:.82}),
 ].map(r=>({...r,heightY:y+.029,foundationTop:y+.012,floorY:y-.058}));
}
export function subtractRectangle(a,b){
 const x0=Math.max(a.x0,b.x0),x1=Math.min(a.x1,b.x1),z0=Math.max(a.z0,b.z0),z1=Math.min(a.z1,b.z1);
 if(x1-x0<1e-8||z1-z0<1e-8)return[a];
 return [
 {...a,z1:z0},{...a,z0:z1},
 {...a,z0,z1,x1:x0},{...a,z0,z1,x0:x1},
 ].filter(r=>r.x1-r.x0>1e-8&&r.z1-r.z0>1e-8);
}
export function nonOverlappingCourtPaving(layout=F){
 const old=originalRoadRectangles(),accepted=[],requested=layout.visibleCourts.map(c=>({id:c.id,polygon:c.pavingPolygon,heightY:c.pavingTopY})).concat(layout.accessLanes);
 for(const a of requested){
  const xs=a.polygon.map(p=>p[0]),zs=a.polygon.map(p=>p[1]);
  let parts=[rectangle(a.id,Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs),{heightY:a.heightY,pitchX:.92,pitchZ:.62,foundationTop:a.heightY-.01,floorY:a.heightY-.03})];
  for(const b of old.concat(accepted))parts=parts.flatMap(p=>subtractRectangle(p,b));
  parts.forEach((p,i)=>accepted.push({...p,id:a.id+'-partition-'+i}));
 }
 return accepted;
}
export function frontCourtGroundCuts(layout=F){
 return originalRoadRectangles().concat(nonOverlappingCourtPaving(layout)).map(r=>({id:r.id+'-foundation-seat',polygon:rectPolygon(r),floorY:r.floorY,rimY:4,rimBlend:0,evidence:'contemporary-source-foundation-seat',sourceTopPreserved:r.heightY,water:null}));
}
export function pavingJointGeometry(rectangles,{name='front-court-visible-mortar-joints'}={}){
 const position=[],normal=[],uv=[];
 const cap=(x0,z0,x1,z1,y)=>{
  if(x1-x0<1e-9||z1-z0<1e-9)return;
  for(const p of [[x0,z0],[x0,z1],[x1,z1],[x0,z0],[x1,z1],[x1,z0]]){position.push(p[0],y,p[1]);normal.push(0,1,0);uv.push(...p);}
 };
 for(const r of rectangles){
  const nx=Math.ceil((r.x1-r.x0)/r.pitchX),nz=Math.ceil((r.z1-r.z0)/r.pitchZ),dx=(r.x1-r.x0)/nx,dz=(r.z1-r.z0)/nz,h=.003,y=r.foundationTop;
  for(let i=0;i<=nx;i++)cap(Math.max(r.x0,r.x0+i*dx-h),r.z0,Math.min(r.x1,r.x0+i*dx+h),r.z1,y);
  for(let i=0;i<nx;i++)for(let j=0;j<=nz;j++)cap(r.x0+i*dx+h,Math.max(r.z0,r.z0+j*dz-h),r.x0+(i+1)*dx-h,Math.min(r.z1,r.z0+j*dz+h),y);
 }
 const g=new BufferGeometry();g.name=name;g.setAttribute('position',new Float32BufferAttribute(position,3));g.setAttribute('normal',new Float32BufferAttribute(normal,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
/** Source arrays remain intact. Only the four buried road-bed caps are
 * replaced by visible mortar joints; their walls/bottoms and every slab stay.
 * Apply before the source architecture query is constructed. */
export function leaseDagRoadFoundationCaps(source){
 const road=source.group.getObjectByName('dagongmen-front-imperial-road');
 const mesh=road?.children.find(n=>n.isMesh&&n.material.name==='dagongmen-grey-foundation');
 if(!mesh||mesh.isInstancedMesh||mesh.geometry.groups.length||mesh.children.length)throw new Error('Expected original merged Dag road foundation.');
 const original=mesh.geometry,p=original.attributes.position,n=original.attributes.normal,idx=original.index,kept=[];let removed=0;
 for(let i=0;i<(idx?.count??p.count);i+=3){
  const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
  if(ids.every(j=>Math.abs(p.getY(j)-.012)<2e-6&&n.getY(j)>.999)){removed++;continue;}
  kept.push(...ids);
 }
 if(removed!==8)throw new Error('Original four Dag road foundation caps changed.');
 const geometry=original.clone();geometry.name=original.name+'-visible-shell-r2';geometry.setIndex(kept);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const joints=pavingJointGeometry(originalRoadRectangles({world:false})),cap=new Mesh(joints,mesh.material);
 cap.name='dagongmen-original-road-visible-joints-r2';cap.castShadow=cap.receiveShadow=true;
 cap.userData={body:'original-road-visible-grout-only',historicallySurveyed:false};
 mesh.geometry=geometry;road.add(cap);let disposed=false;
 return {diagnostics:{id:'dag-road-internal-overlap-removal-r2',sourcePositionNormalUvArraysUnchanged:true,sourceRetained:true,removedBuriedTriangles:removed,visibleJointTriangles:joints.attributes.position.count/3,sourceSlabsChanged:false,sourceFoundationSidesAndBottomUnchanged:true},
  assertCurrent(){if(disposed||mesh.geometry!==geometry||cap.parent!==road)throw new Error('Dag road cap lease changed.');},
  dispose(){if(disposed)return;disposed=true;cap.removeFromParent();if(mesh.geometry===geometry)mesh.geometry=original;const errors=[];for(const g of [joints,geometry])try{g.dispose();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Road cap cleanup failed');}
 };
}
