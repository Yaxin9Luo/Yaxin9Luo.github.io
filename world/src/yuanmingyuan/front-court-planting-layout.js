import {createQianhuGroveLayout} from './front-court-qianhu-grove-layout.js';
import {frontCourtLayout as F,frontCourtMuseumViews} from './front-court-layout.js';
import {shoreUnderstoryVariants} from './jiuzhou-shore-grove-understory-variants.js';
import {shoreUnderstoryTriangles} from './jiuzhou-shore-grove-source-metrics.js';
import {westernGardenPlantingSpec} from './western-garden-planting.js';
import {courtBroadleafR3Profile} from './court-broadleaf-r3-profile.js';
import {pointInPolygon} from './garden-layout.js';
import {plantingDistanceToPolygon} from './garden-planting-layout.js';
import {frontCourtGroundCuts} from './front-court-ground-seams.js';
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const random=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
// Seven original complete sources, grouped 2 + 2 + 3. Unequal, overlapping
// crowns frame the courts. R5 changes private paired shoot transforms only;
// these original positions, tree scales, yaw, trunks and roots stay unchanged.
export const frontCourtPines=[
 {id:'front-court-pine-west-hall',position:[-568.8,null,341.6],yaw:.46,scale:2.30,group:'west-hall',shootScale:[1.28,1.12,1.28]},
 {id:'front-court-pine-east-court',position:[-491.2,null,369.0],yaw:1.20,scale:2.15,group:'east-court',shootScale:[1.24,1.13,1.28]},
 {id:'front-court-pine-west-gate',position:[-575.4,null,432.2],yaw:-.35,scale:2.45,group:'west-gate',shootScale:[1.27,1.12,1.25]},
 {id:'front-court-pine-east-approach',position:[-483.8,null,381.9],yaw:2.80,scale:1.80,group:'east-court',shootScale:[1.30,1.10,1.24]},
 {id:'front-court-pine-west-middle',position:[-565.8,null,440.8],yaw:1.95,scale:1.65,group:'west-gate',shootScale:[1.23,1.14,1.27]},
 {id:'front-court-pine-east-hall',position:[-485.4,null,355.0],yaw:-.60,scale:2.05,group:'east-court',shootScale:[1.26,1.11,1.30]},
 {id:'front-court-pine-rear-companion',position:[-576.0,null,329.2],yaw:-1.30,scale:1.50,group:'west-hall',shootScale:[1.24,1.14,1.25]},
];
// A lobe is [fraction along the curve, half-length, sampling weight]. The
// unequal lobes leave true empty intervals, rather than uniformly dotted rows.
// Retained R3 source identities stay exact. Selected fern slots make room
// for complete reviewed shrubs; this is authored exhibition planting.
export const frontCourtDrifts=[
 {id:'west-hall-edge',points:[[-590,319],[-585,335],[-577,350],[-565,366]],width:8.2,count:75,fernEvery:6,seed:94017,lobes:[[0.22,0.22,0.28],[0.53,0.28,0.42],[0.87,0.18,0.3]]},
 {id:'east-hall-edge',points:[[-496,336],[-483,345],[-479,358],[-486,373]],width:7.8,count:75,fernEvery:7,seed:94031,lobes:[[0.2,0.22,0.29],[0.54,0.24,0.37],[0.87,0.2,0.34]]},
 {id:'west-court-edge',points:[[-579,360],[-576,376],[-568,389],[-559,399]],width:7.6,count:70,fernEvery:6,seed:94047,lobes:[[0.19,0.22,0.24],[0.56,0.27,0.48],[0.91,0.14,0.28]]},
 {id:'east-court-edge',points:[[-491,351],[-477,366],[-477,384],[-488,399]],width:8.6,count:69,sourceGap:13,fernEvery:8,seed:94059,lobes:[[0.2,0.24,0.3],[0.55,0.22,0.37],[0.88,0.17,0.33]]},
 {id:'west-approach-edge',points:[[-589,421],[-581,434],[-569,446],[-551,455]],width:8.8,count:80,fernEvery:7,seed:94071,lobes:[[0.17,0.18,0.21],[0.49,0.25,0.39],[0.83,0.2,0.4]]},
 {id:'east-approach-edge',points:[[-483,430],[-493,439],[-508,449],[-515,467]],width:7.5,count:75,fernEvery:7,seed:94089,lobes:[[0.18,0.22,0.25],[0.57,0.28,0.46],[0.89,0.18,0.29]]},
 {id:'rear-west-link',points:[[-581,312],[-566,304],[-548,312]],width:6.5,count:30,fernEvery:6,seed:94103,lobes:[[0.23,0.23,0.34],[0.66,0.29,0.66]]},
 {id:'rear-east-link',points:[[-519,309],[-505,306],[-488,315]],width:6.4,count:30,fernEvery:8,seed:94113,lobes:[[0.33,0.3,0.47],[0.8,0.21,0.53]]},
 {id:'screen-west-edge',points:[[-560,592],[-558,599],[-550,604]],width:3.2,count:18,fernEvery:7,seed:94131,lobes:[[.29,.21,.4],[.81,.15,.6]]},
 {id:'screen-east-edge',points:[[-514,592],[-507,600],[-503,605]],width:3.5,count:18,fernEvery:8,seed:94149,lobes:[[.37,.28,1]]},
];
function along(points,t){
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1])),total=lengths.reduce((a,b)=>a+b,0);let d=t*total;
 for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],f=d/lengths[i];return {x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,nx:-(b[1]-a[1])/lengths[i],nz:(b[0]-a[0])/lengths[i]};}d-=lengths[i];}
}
function inLobe(drift,rng){
 let choice=rng();let lobe=drift.lobes[drift.lobes.length-1];
 for(const candidate of drift.lobes){choice-=candidate[2];if(choice<=0){lobe=candidate;break;}}
 return Math.max(0,Math.min(1,lobe[0]+(rng()+rng()-1)*lobe[1]));
}
// Three unequal broadleaf groups create the missing middle layer. The original
// real-leaf R3 source remains opaque full geometry with its original PBR maps.
// Three old flower shrubs are middle-distance accents, not a flower meadow.
// All placements are contemporary exhibition choices, not historical planting.
export const frontCourtShrubGroups=[
 {id:'west-hall-shrubs',points:[[-582.8,348.0],[-580.0,353.0],[-575.0,355.4],[-570.5,358.2],[-577.3,359.9],[-582.4,364.0],[-575.8,368.8]],scales:[2.8,3.2,3.0,2.65,3.35,2.4,2.7],flower:5},
 {id:'west-gate-shrubs',points:[[-585.0,430.0],[-582.5,436.0],[-578.2,441.8],[-575.1,446.0],[-569.0,450.4],[-562.8,450.8],[-558.0,446.8]],scales:[2.8,3.2,3.4,3.0,3.35,2.7,2.4],flower:6},
 {id:'east-grove-shrubs',points:[[-496.0,350.4],[-491.5,345.4],[-481.0,347.0],[-475.0,352.2],[-473.8,358.7],[-481.0,365.8],[-493.5,378.5],[-486.5,390.1],[-479.5,392.3]],scales:[2.7,3.1,3.4,2.9,3.35,2.75,3.0,3.3,2.4],flower:8},
];
export function createFrontCourtPlantingLayout(){
 const buildingReserves=[{id:'dag-gate-wings',polygon:rect(-561,402,-503.8,420.5),clearance:1},{id:'erg-platform',polygon:rect(-544,374.5,-520.8,387.5),clearance:1},{id:'hall-and-steps',polygon:rect(-555,326.5,-509.8,364.8),clearance:1}];
 const clearings=Object.entries(frontCourtMuseumViews).map(([id,v])=>({id:'view-'+id,polygon:rect(v.entry[0]-4,v.entry[2]-4,v.entry[0]+4,v.entry[2]+4),clearance:0}));
 clearings.push({id:'ritual-axis',polygon:rect(-535.4,326,-529.4,617),clearance:0});
 const pathReserves=[...frontCourtGroundCuts().map(c=>({...c,clearance:1})),...F.accessLanes.map(c=>({...c,clearance:1}))];
 const protectedPolygons=[...buildingReserves,...clearings,...pathReserves],all=[],retired=[];let fernOrdinal=0;
 const shrubPlacements=frontCourtShrubGroups.flatMap((group,gi)=>group.points.map(([x,z],i)=>{
  const flower=i===group.flower,species=flower?'flower-shrub':'low-broadleaf',scale=group.scales[i];
  const profile=courtBroadleafR3Profile,radius=(flower?.9:Math.hypot(Math.max(Math.abs(profile.min[0]),Math.abs(profile.max[0])),Math.max(Math.abs(profile.min[2]),Math.abs(profile.max[2]))))*scale;
  const p={id:'fc-r5-'+group.id+'-'+i,species,position:[x,null,z],yaw:(i*2.399963+gi*.77)%(Math.PI*2),scale,burial:.004,envelope:{radius,height:(flower?.65:profile.max[1])*scale},sourceId:flower?'garden-understory-study-r2':profile.id,sourceReview:flower?'work/yuanmingyuan/garden-understory-native-r2/review.json':'work/yuanmingyuan/court-low-broadleaf-r3-candidate/root-native-art-review-r1.json',historicalIndividual:false,evidence:'contemporary-mid-layer-exhibition-shrub',spatialGroup:group.id};
  if(protectedPolygons.some(r=>pointInPolygon([x,z],r.polygon)||plantingDistanceToPolygon([x,z],r.polygon)<=radius+(r.clearance??0)))throw new Error('Authored shrub meets a reserved space: '+p.id);
  if(frontCourtPines.some(tree=>Math.hypot(x-tree.position[0],z-tree.position[2])<.95*tree.scale+radius*.8+.35))throw new Error('Authored shrub needs a clear pine collar: '+p.id);
  all.push(p);return p;
 }));
 const shrubRegion={id:'front-court-middle-shrubs',placements:shrubPlacements,estimatedFullSourceTriangles:shrubPlacements.reduce((n,p)=>n+(p.species==='low-broadleaf'?courtBroadleafR3Profile.triangles:westernGardenPlantingSpec.sourceTriangles['flower-shrub']),0),design:{spatialGroups:3,middleLayer:true,originalSourceGeometry:true}};
 const regions=frontCourtDrifts.map((drift,di)=>{
  const sourceSlots=[];
  for(let i=0;i<drift.count;i++){
   const sourceIndex=drift.sourceGap!==undefined&&i>=drift.sourceGap?i+1:i,species=sourceIndex%drift.fernEvery===0?'fern':'sedge',variant=shoreUnderstoryVariants[species][(sourceIndex+di)%3],sourcePlacementId='fc-r3-'+drift.id+'-'+String(sourceIndex).padStart(3,'0');
   if(species==='fern'&&fernOrdinal++%7>=2){retired.push({sourcePlacementId,species,variant,triangles:shoreUnderstoryTriangles[variant],reason:'middle-layer-shrub-replacement'});continue;}
   sourceSlots.push({sourceIndex,species,variant,sourcePlacementId});
  }
  const rng=random(drift.seed),placements=[];let attempts=0;
  while(placements.length<sourceSlots.length&&attempts++<drift.count*220){
   const i=placements.length,slot=sourceSlots[i],{species,variant}=slot;
   const t=inLobe(drift,rng),p=along(drift.points,t),undulate=.64+.36*Math.pow(Math.sin(t*Math.PI*2.5+di*.81),2),offset=(rng()+rng()-1)*drift.width*undulate;
   const x=p.x+p.nx*offset,z=p.z+p.nz*offset,density=1-Math.abs(offset)/(drift.width*undulate);
   // Grass fans vary broadly in volume; ferns remain subordinate, not giant
   // copies pretending to be shrubs. The outer third tapers to lower plants.
   const scale=Number((species==='fern'?1.06+.58*density:.98+.82*density+(.12*Math.sin(slot.sourceIndex*1.71))).toFixed(3)),radius=(species==='fern'?1.30:.90)*scale;
   if(protectedPolygons.some(r=>pointInPolygon([x,z],r.polygon)||plantingDistanceToPolygon([x,z],r.polygon)<=radius+(r.clearance??0)))continue;
   if(frontCourtPines.some(tree=>Math.hypot(x-tree.position[0],z-tree.position[2])<.95*tree.scale+.45))continue;
   if(all.some(q=>Math.hypot(x-q.position[0],z-q.position[2])<(['low-broadleaf','flower-shrub'].includes(q.species)?.47*q.scale+.28:(species==='fern'&&q.species==='fern'?1.08:.64)*Math.min(scale,q.scale))))continue;
   const placement={id:'fc-r5-'+drift.id+'-'+String(slot.sourceIndex).padStart(3,'0'),sourcePlacementId:slot.sourcePlacementId,species,variant,position:[Number(x.toFixed(5)),null,Number(z.toFixed(5))],yaw:rng()*Math.PI*2,scale,burial:.004,envelope:{radius,height:(species==='fern'?.85:.70)*scale},sourceId:'jiuzhou-shore-understory-r4',historicalIndividual:false,evidence:'contemporary-front-court-connected-understory'};
   placements.push(placement);all.push(placement);
  }
  if(placements.length!==sourceSlots.length)throw new Error('Authored planting band cannot retain its clearances: '+drift.id+' '+placements.length+'/'+sourceSlots.length);
  return {id:drift.id,placements,estimatedFullSourceTriangles:placements.reduce((n,p)=>n+shoreUnderstoryTriangles[p.variant],0),design:{points:drift.points,width:drift.width,lobes:drift.lobes,irregularSpacing:true,sourceGeometryUnchanged:true}};
 });
 const grove=createQianhuGroveLayout(),qianhuPlacements=grove?.regions.flatMap(r=>r.placements);
 if(grove.coordinateLayoutId!==F.id)throw new Error('Qianhu grove requires the original Front composition layout.');
 const middle=grove.regions.filter(r=>r.placements.some(p=>p.species==='low-broadleaf'));
 if(middle.length!==1||middle[0].placements.some(p=>p.species!=='low-broadleaf'))throw new Error('One Qianhu broadleaf source region required.');
 // Keep one retained broadleaf source and the existing Shore variant cache.
 shrubRegion.placements.push(...middle[0].placements);
 shrubRegion.estimatedFullSourceTriangles+=middle[0].estimatedFullSourceTriangles;
 const groveRegions=grove.regions.filter(r=>r!==middle[0]);
 regions.push(...groveRegions);
 const known=new Map([...buildingReserves,...clearings].map(r=>[r.id,r]));
 for(const reserve of grove.buildingReserves){
  // This newly authored view strip constrains the additions; two retained low
  // grasses already border it. Physical/historic reserves still apply to all.
  if(reserve.id==='hall-rear-view-open-strip'){
   for(const p of qianhuPlacements)if(pointInPolygon([p.position[0],p.position[2]],reserve.polygon)||plantingDistanceToPolygon([p.position[0],p.position[2]],reserve.polygon)<=p.envelope.radius+(reserve.clearance??0))throw new Error('New Qianhu planting enters the Hall view strip: '+p.id);
   continue;
  }
  const old=known.get(reserve.id);
  if(old){if(JSON.stringify(old.polygon)!==JSON.stringify(reserve.polygon)||(old.clearance??0)!==(reserve.clearance??0))throw new Error('Qianhu retained reservation changed: '+reserve.id);}
  else{buildingReserves.push(reserve);known.set(reserve.id,reserve);}
 }
 const qianhuGrove={id:grove.id,counts:qianhuPlacements.reduce((o,p)=>(o[p.species]=(o[p.species]??0)+1,o),{}),placementCount:qianhuPlacements.length,sourceGeometryChanged:false,nativeArtAccepted:false,newPlacementReservations:['hall-rear-view-open-strip']};
 return {id:'front-court-outside-meadow-planting-r5-qianhu-r1',coordinateLayoutId:F.id,nativeCompositionReviewed:false,regions:[...regions,shrubRegion],qianhuGrove,buildingReserves,clearings,authoringOmissions:retired,inventoryFrom:'Original R5 Front inventory plus original R5 Willow, R4 sedge/fern and real-leaf R3 broadleaf for the Qianhu additions; original three flower accents and retired fern slots remain unchanged',evidence:'contemporary-exhibition-landscape',historicallySurveyed:false,fullSizePines:frontCourtPines};
}
