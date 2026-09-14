import {getGardenGroup} from './garden-layout.js';

const definitions=[
  {id:'yuanyingguan',assetId:'yuanyingguan',entryId:'yuanyingguan',arrival:[-14,8,14],focus:[0,8,-10],guide:[-16,0,22]},
  {id:'haiyantang',assetId:'haiyantang',entryId:'haiyantang',arrival:[0,15,40],focus:[0,10,-4],guide:[-20,0,23]},
  {id:'fangwaiguan',assetId:'fangwaiguan',entryId:'fangwaiguan',arrival:[0,9,11],focus:[0,5,0],guide:[9,0,10]},
  {id:'xieqiqu',assetId:'xieqiqu',entryId:'xieqiqu',arrival:[0,15,50],focus:[0,8,0],guide:[19,0,33]},
  {id:'yangquelong',assetId:'yangquelong',entryId:'yangquelong',arrival:[-17,8,0],focus:[0,4,0],guide:[-14,0,0],viewYaw:-Math.PI/2},
  {id:'fanghu-shengjing',assetId:'fanghu',entryId:'fanghu-shengjing',arrival:[0,18,61],focus:[0,10,0],guide:[2,0,8]},
  {id:'pengdao-yaotai',assetId:'pengdao',entryId:'pengdao-yaotai',arrival:[0,13,26],focus:[0,7,0],guide:[3,0,5]},
  {id:'xianfahua',assetId:'fanghe-xianfahua',entryId:'fanghe-xianfahua',arrival:[-164,8,0],focus:[12,5,0],guide:[-162,0,22],viewYaw:-Math.PI/2},
  {id:'xianfashan',assetId:'xianfashan',entryId:'xianfashan',arrival:[-46,8,0],focus:[0,8,0],guide:[-42,.04,0],viewYaw:-Math.PI/2},
  {id:'huanghuazhen',assetId:'huanghuazhen',entryId:'huanghuazhen',arrival:[0,11,36],focus:[0,3,0],guide:[9,0,32]},
  {id:'hanjingtang',assetId:'hanjingtang',entryId:'hanjingtang',arrival:[-8,12,128],focus:[0,8,68],guide:[-7,0,99]},
  {id:'haiyue-kaijin',assetId:'haiyue',entryId:'haiyue-kaijin',arrival:[15,10,14],focus:[0,9,0],guide:[13,2.2,13],placementOffset:[0,-1.35,0],alignment:'Align the authored -0.65 waterline with Changchunyuan lake at 2; not a historical water-level measurement.'},
  {id:'zhengjuesi',assetId:'zhengjuesi',entryId:'zhengjuesi',arrival:[0,8,94],focus:[0,4,63],guide:[-14,0,58],placementOffset:[-6,0,36.6],alignment:'Author placement: align the actual north enclosure with the Qichunyuan wall recess; not surveyed coordinates.'},
];

export const museumSites=definitions.map(definition=>{
  const record=getGardenGroup(definition.id);if(!record)throw new Error(`Missing garden site ${definition.id}`);
  return {...definition,position:record.position.map((value,axis)=>value+(definition.placementOffset?.[axis]||0)),rotationY:record.placement.rotationY,region:record.regionId,scale:record.placement.scale,evidence:record.placement.evidence};
});
const byId=new Map(museumSites.map(site=>[site.id,site]));
export function museumSite(id){return typeof id==='string'?byId.get(id)||null:null;}
export function sitePoint(site,point){
  const c=Math.cos(site.rotationY),s=Math.sin(site.rotationY),[x,y,z]=point;
  return {x:site.position[0]+(x*c+z*s)*site.scale,y:site.position[1]+y*site.scale,z:site.position[2]+(-x*s+z*c)*site.scale};
}

// The excavation is always in the landscape. The model contributes the actual
// court paving and three basins; a broad land pad must not bury them.
export function museumCourts(){
  const site=museumSite('yuanyingguan');
  return [{id:'yuanyingguan-fountain-court',polygon:[[-55,-30],[55,-30],[55,30],[-55,30]].map(([x,z])=>{const p=sitePoint(site,[x,0,z]);return [p.x,p.z];}),floorY:site.position[1]-1.5,rimY:site.position[1]+1.3}];
}
