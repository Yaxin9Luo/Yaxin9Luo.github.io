import {sitePoint} from './museum-sites.js';
import {wanfangAnheLayout as L,wanfangOutline,wanfangApproaches,wanfangWaterCourts} from './wanfang-anhe-layout.js';

// Local bank composition follows the three corner connections in the published
// DPM 2016 Fig. 13. Curves, levels and connection lengths remain reconstruction
// hypotheses; the coarse whole-garden diagram is not a measured lake outline.
const shoreControls=[
 [-10,-76],[5,-76],[6,-57],[6,-43],[13,-35],[23,-32],[29,-27],
 [31.20,-21],[31.20,-14.8],[30.4,-8],[33,-1],[33,8],
 [28.74,14.8],[28.74,21],[31,28],[31,35],[19,41],[4,43],[-12,41],
 [-26.4,39],[-37,33],[-42,23],[-47,13],[-48,5],[-42,-1],[-33,-5],
 [-30,-16],[-27,-25],[-21,-28.74],[-14.8,-28.74],[-8.5,-31],[-5.2,-41],[-7,-58],
];
const straightEdges=new Set([7,12,28]);
const smoothShore=()=>shoreControls.flatMap((p,i,all)=>{
 const a=all[(i+all.length-1)%all.length],q=all[(i+1)%all.length],b=all[(i+2)%all.length];
 return Array.from({length:6},(_,k)=>{
  const t=k/6,t2=t*t,t3=t2*t;
  return p.map((v,axis)=>straightEdges.has(i)?v+(q[axis]-v)*t:
   .5*((2*v)+(-a[axis]+q[axis])*t+(2*a[axis]-5*v+4*q[axis]-b[axis])*t2+(-a[axis]+3*v-3*q[axis]+b[axis])*t3));
 });
});
const evidence={kind:'source-informed-local-shore-composition',source:'https://www.dpm.org.cn/Uploads/File/2018/06/01/u5b112236babf8.pdf',figure:13,metresCalibrated:false};
const rectAlong=(from,to,width)=>{
 const dx=to[0]-from[0],dz=to[1]-from[1],length=Math.hypot(dx,dz),nx=-dz/length*width/2,nz=dx/length*width/2;
 return [[from[0]-nx,from[1]-nz],[to[0]-nx,to[1]-nz],[to[0]+nx,to[1]+nz],[from[0]+nx,from[1]+nz]];
};
export function createWanfangAnheSiteGround(site,layout){
 if(site.assetId!=='wanfang-anhe')throw new Error('Wanfang site geometry needs its own site.');
 const original=layout.waterBodies.find(w=>w.id==='wanfang-lake'),oldIsland=layout.islands.find(i=>i.id==='wanfang-island');
 if(!original||!oldIsland)throw new Error('The original Wanfang lake and planning island are required.');
 const point=([x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};
 const height=y=>sitePoint(site,[0,y,0]).y,waterY=height(L.waterY),floorY=height(L.floorY);
 if(Math.abs(waterY-original.surfaceY)>1e-8)throw new Error('Wanfang model waterline must match the real garden lake.');
 const plinth=wanfangOutline(L.veranda+L.platformLip).map(point),shore=smoothShore().map(point);
 const lake={...original,polygon:shore,trace:undefined,alignment:evidence,
  limit:'A locally composed water court around the source-informed short bridges, connected to the existing three waterways; not a surveyed pre-1860 lake outline.'};
 const island={...oldIsland,polygon:plinth,anchor:[...site.position],heightY:floorY-.06*site.scale,trace:undefined,
  alignment:{kind:'actual-connected-stone-plinth-footprint',assetId:site.assetId,metresCalibrated:false},
  limit:'Only the actual nonrectangular stone base is dry. All four water inlets remain open.'};
 const pads=[{id:'wanfang-connected-plinth-substrate',polygon:plinth,heightY:floorY-.06*site.scale,blend:.3*site.scale,alignment:island.alignment}];
 const paths=wanfangApproaches.map(bridge=>{
  const dx=bridge.to[0]-bridge.from[0],dz=bridge.to[1]-bridge.from[1],len=Math.hypot(dx,dz),u=[dx/len,dz/len];
  const from=[bridge.to[0]+u[0]*1.37,bridge.to[1]+u[1]*1.37],to=[bridge.to[0]+u[0]*10,bridge.to[1]+u[1]*10];
  const xyz=(xz,y)=>{const p=sitePoint(site,[xz[0],y,xz[1]]);return[p.x,p.y,p.z];};
  return {id:bridge.id+'-bank-approach',from:xyz(from,L.floorY),to:xyz(to,2),width:bridge.width*site.scale,
   thickness:1.05*site.scale,conformToTerrain:true,polygon:rectAlong(from,to,bridge.width).map(point),kind:'exhibition-ground-path',evidence:'exhibition-design',
   coordinatesSurveyed:false,limit:'A landward stone approach joining the authored bridge abutment to the actual garden terrain; not a historical bridge extension.'};
 });
 return {lake,island,pads,paths,bridgeEnds:wanfangApproaches.map(b=>({id:b.id,from:point(b.from),to:point(b.to)})),
  waterCourts:wanfangWaterCourts.map(c=>({...c,center:point(c.center),outlet:point(c.outlet)})),waterY,floorY};
}
export function bindWanfangAnheMuseumWater(resource,site,{terrain,water}={}){
 if(!terrain?.surfaceAt||!water)throw new Error('Wanfang needs the installed garden terrain and lake water.');
 const sheets=[],beds=[];
 resource.group.traverse(object=>{
  if(object.name==='wanfang-anhe-study-water')sheets.push(object);
  if(object.name==='wanfang-anhe-study-lake-bed')beds.push(object);
 });
 if(sheets.length!==1||beds.length!==1||resource.resources?.water?.group!==sheets[0])
  throw new Error('The complete private Wanfang water and study bed must be identifiable.');
 const expected=sitePoint(site,[0,L.waterY,0]).y;
 for(const court of wanfangWaterCourts){
  const p=sitePoint(site,[court.center[0],L.waterY,court.center[1]]),surface=terrain.surfaceAt(p.x,p.z);
  if(!surface||surface.walkable||!Number.isFinite(surface.waterY)||Math.abs(surface.waterY-expected)>1e-8)
   throw new Error('The actual garden terrain blocks Wanfang water court '+court.id);
 }
 const objects=[...sheets,...beds],saved=objects.map(o=>({object:o,visible:o.visible}));
 for(const object of objects)object.visible=false;
 let restored=false;
 return ()=>{if(restored)return;restored=true;for(const {object,visible}of saved)object.visible=visible;};
}
