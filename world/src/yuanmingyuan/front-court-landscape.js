import {frontCourtGroundCuts} from './front-court-ground-seams.js';
import {gardenLayout,getGardenGroup,pointInPolygon} from './garden-layout.js';
import {createMuseumLandscape} from './museum-landscape.js';
import {polygonBooleanRegions,ringBounds} from './terrain-geometry.js';
import {frontCourtLayout as F,frontCourtSites} from './front-court-layout.js';
const area=(a,b,outside=false)=>polygonBooleanRegions([a,b],p=>pointInPolygon(p,a)&&(outside?!pointInPolygon(p,b):pointInPolygon(p,b))).area;
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
export function createFrontCourtLandscapePlan({layout=gardenLayout,compositionLayout=F}={}){
 const F=compositionLayout;
 const anchor=getGardenGroup('imperial-court');
 if(!anchor||anchor.position.some((v,i)=>Math.abs(v-F.baseImperialAnchor[i])>1e-7)||layout.exhibition.groundY!==4)throw new Error('Front-court base layout changed.');
 if(layout.frontCourtComposition||layout.dagongmenComposition)throw new Error('Front-court terrain must be prepared once, without an old Dag placement.');
 const coast=layout.exhibition.coast.polygon,features=[...layout.waterBodies,...layout.ornamentalWaters,...layout.channels,...layout.landforms,...layout.bridges];
 const checks=frontCourtSites.map(a=>({id:a.id,polygon:rect(a.worldBounds.min[0],a.worldBounds.min[2],a.worldBounds.max[0],a.worldBounds.max[2])}));
 for(const pad of F.terrainPads){const b=ringBounds(pad.polygon);checks.push({id:pad.id,polygon:rect(b.minX-pad.blend,b.minZ-pad.blend,b.maxX+pad.blend,b.maxZ+pad.blend)});}
 for(const c of checks){
  if(area(c.polygon,coast,true)>1e-7)throw new Error(c.id+' is outside the original coast.');
  for(const f of features)if(area(c.polygon,f.polygon)>1e-7)throw new Error(c.id+' intersects '+f.id);
 }
 const dag=frontCourtSites[0],garden=layout.gardens.find(g=>g.id==='yuanmingyuan'),hits=[];
 garden.boundary.forEach((a,i)=>{const b=garden.boundary[(i+1)%garden.boundary.length],dx=b[0]-a[0],dz=b[1]-a[1];if(Math.abs(dx)<1e-8)return;const t=(dag.position[0]-a[0])/dx,z=a[1]+t*dz;if(t>=0&&t<1&&z>dag.position[2]+10&&z<dag.position[2]+200)hits.push({position:[dag.position[0],z],width:5.2*Math.hypot(dx,dz)/Math.abs(dx)});});
 if(hits.length!==1||Math.abs(hits[0].position[1]-F.wallOpening.worldPosition[1])>1e-7||Math.abs(hits[0].width-F.wallOpening.widthAlongWall)>1e-7)throw new Error('Front-court wall opening changed.');
 const opening={id:F.wallOpening.id,assetId:'dagongmen',gardenIds:['yuanmingyuan'],...hits[0],kind:'exhibition-visitor-opening',evidence:'exhibition-design',coordinatesSurveyed:false};
 const base=createMuseumLandscape({layout,sites:frontCourtSites});
 return {...base,courts:[...base.courts,...frontCourtGroundCuts(F)],pads:[...base.pads,...F.terrainPads],layout:{...base.layout,id:base.layout.id+':'+F.id,frontCourtComposition:F.id,assetWallReplacements:[...(base.layout.assetWallReplacements??[]).filter(o=>o.id!==opening.id),opening]},
  frontCourt:{sourceOwners:3,sourceWaterSheets:0,sourceGeometryUnchanged:false,sourceArchitecturalFormUnchanged:true,buriedRoadCapsReplacedByVisibleJoints:true,coordinatesSurveyed:false,wallOpening:opening,sites:frontCourtSites,contemporaryAccessLanes:F.accessLanes,worldOutline:rect(-561.4,327,-501,620)}};
}
