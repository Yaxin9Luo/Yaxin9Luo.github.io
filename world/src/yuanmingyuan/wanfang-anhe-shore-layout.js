import {sitePoint,museumSite} from './museum-sites.js';
import {wanfangAnheLayout,wanfangOutline,wanfangApproaches} from './wanfang-anhe-layout.js';
import {wanfangGardenRegions as authored,wanfangGardenPaths,wanfangGardenPathSamples} from './wanfang-anhe-garden-design.js';
import {shoreUnderstoryTriangles} from './jiuzhou-shore-grove-source-metrics.js';

export const wanfangShoreId='wanfang-anhe-garden-composition-r4';
export const wanfangShoreRegionIds=Object.freeze(['northwest','northeast','south','southeast'].map(id=>'wanfang-shore-'+id));
const forms={willow:{radius:6.5,height:8.4,triangles:8475606},sedge:{radius:.9,height:.7},fern:{radius:1.30,height:.85}};
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const corridor=(from,to,halfWidth)=>{
 const dx=to[0]-from[0],dz=to[1]-from[1],len=Math.hypot(dx,dz),nx=-dz/len*halfWidth,nz=dx/len*halfWidth;
 return [[from[0]+nx,from[1]+nz],[to[0]+nx,to[1]+nz],[to[0]-nx,to[1]-nz],[from[0]-nx,from[1]-nz]];
};
/** Positions are site-local; full sources use authored instance scales, and Y is supplied only
 * by the current terrain's real dry triangles in the shared planting owner. */
export function createWanfangAnheShoreLayout({site=museumSite('wanfang-anhe')}={}){
 if(site?.assetId!=='wanfang-anhe'||site.scale!==1||site.position?.length!==3||!site.position.every(Number.isFinite)||!Number.isFinite(site.rotationY))
  throw new Error('Wanfang planting requires its finite unit-scale museum site.');
 const point=([x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};
 const clearings=[
  {id:'wanfang-guide-patrol-open-space',kind:'visitor-and-raised-sign-space',polygon:rect(31,5,53,31).map(point),clearance:0},
  {id:'wanfang-south-boat-landing-view',kind:'open-water-and-dock-view',polygon:rect(5,20,13,43).map(point),clearance:0},
  ...wanfangGardenPaths.flatMap(path=>{const points=wanfangGardenPathSamples(path);return points.slice(1).map((to,i)=>({id:path.id+'-'+i,kind:'garden-walk',polygon:corridor(points[i],to,path.width/2+.65).map(point),clearance:0}));}),
  ...wanfangApproaches.map(bridge=>{
   const dx=bridge.to[0]-bridge.from[0],dz=bridge.to[1]-bridge.from[1],len=Math.hypot(dx,dz);
   const to=[bridge.to[0]+dx/len*10,bridge.to[1]+dz/len*10];
   return {id:bridge.id+'-full-visitor-opening',kind:'retained-bridge-and-bank-path',polygon:corridor(bridge.from,to,2.96).map(point),clearance:0};
  }),
 ];
 const buildingReserves=[{id:'wanfang-original-connected-plinth',kind:'retained-whole-architecture',polygon:wanfangOutline(wanfangAnheLayout.veranda+wanfangAnheLayout.platformLip).map(point),clearance:2}];
 const regions=authored.map(spec=>{
  const id='wanfang-shore-'+spec.id,placements=[];
  for(const source of spec.placements){
   const {id:placementId,species,point:localPoint,yaw,variant,drift}=source;
   const xz=point(localPoint),form=forms[species],scale=source.scale??1;
   if(!form)throw new Error('Unknown fixed Wanfang planting source '+species);
   if(!Number.isFinite(scale)||(species==='willow'?(scale<.92||scale>1.12):scale!==1))throw new Error('Invalid full-source Wanfang instance scale '+placementId);
   placements.push({id:placementId,species,...(variant?{variant}:{}),position:[xz[0],null,xz[1]],
    scale,yaw:yaw+site.rotationY,burial:.004,drift,envelope:{radius:form.radius*scale,height:form.height*scale},
    evidence:{status:'contemporary-exhibition-design',surveyed:false,fullSourceRetained:true,sourceRevision:species==='willow'?'willow-root-continuum-r5':'jiuzhou-shore-understory-r4',sourceGeometryChanged:false}});
  }
  const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const p of placements){const[x,,z]=p.position,r=p.envelope.radius;bounds.minX=Math.min(bounds.minX,x-r);bounds.maxX=Math.max(bounds.maxX,x+r);bounds.minZ=Math.min(bounds.minZ,z-r);bounds.maxZ=Math.max(bounds.maxZ,z+r);}
  return {id,label:spec.label,placements,bounds,estimatedFullSourceTriangles:placements.reduce((n,p)=>n+(p.species==='willow'?forms.willow.triangles:shoreUnderstoryTriangles[p.variant]),0)};
 });
 return {id:wanfangShoreId,siteId:site.id,regions,buildingReserves,clearings,historicallySurveyed:false,nativeCompositionReviewed:false};
}
