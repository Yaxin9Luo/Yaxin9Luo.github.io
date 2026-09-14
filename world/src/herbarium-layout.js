import {authoredRegionalCommunities,authoredLowGardenBeds} from './herbarium-regional-layout.js';

// Shared accepted plan geometry. Historical R9 studios pass expanded=false;
// water, basin lining and the live terrain excavation use this same outline.
export function waterGardenContourPoint(t,offset=0,expanded=true){
  const [rx,rz]=expanded?[6.9,3.45]:[5.40,2.48],a=t*Math.PI*2,r=1+.065*Math.sin(a*3)-.075*Math.sin(a),indent=.80*Math.exp(-(((a-1.12)/.63)**2));
  return [(rx+offset)*Math.cos(a)*r-.35,(rz+offset)*Math.sin(a)*(1+.14*Math.cos(a))-.10-indent];
}
const waterBasinContour=Array.from({length:144},(_,i)=>waterGardenContourPoint(i/144).map(v=>v*1.02));
export function waterGardenBasinDistance(x,z){return footprintDistance(x,z,waterBasinContour);}
import {gardenDistricts} from './environment-layout.js';
// Finished floors and approach reservations from garden-fit-audit.md. Geometry,
// terrain baking and late vegetation filtering consume the same authoring data.
export const herbariumSites=[
  {id:'west-arcade',kind:'arcade',x:-20,z:2,floor:7.2,width:12,depth:3.4,shoulder:2},
  {id:'east-arcade',kind:'arcade',x:20,z:2,floor:7.2,width:12,depth:3.4,shoulder:2},
  {id:'conservatory',kind:'conservatory',x:48,z:29,floor:6.7,width:16,depth:9,rotation:Math.PI/2,shoulder:1.5},
  {id:'water-garden',kind:'water',x:-44,z:47,floor:7.1,width:20,depth:11.5,shoulder:4.5},
];
export const herbariumPaths=[
  {id:'west-arcade',width:2.2,points:[[0,8.5,6.24],[-19.5,8.5,6.35],[-21.44,8.5,7.10],[-21.44,3.7,7.10]]},
  {id:'east-arcade',width:2.2,points:[[0,8.5,6.24],[19.5,8.5,6.35],[21.44,8.5,7.10],[21.44,3.7,7.10]]},
  {id:'conservatory',width:2.4,join:[.8,2.0],points:[[41,16,6.893137],[48,17.5,6.58],[53.6,20,6.58],[53.6,25.5,6.58],[54.2,27,6.58],[54.2,29,6.58],[52.4,29,6.58]]},
  {id:'water-garden',width:2.4,points:[[-40,34.2,7.08846],[-32.4,40.5,7.00],[-32.4,47,7.00],[-34.9,47,7.00]]},
];
export const herbariumBorders=[
  {id:'west-rear',x:-20,z:-1.1,length:12,rotation:0,floor:7.12},
  {id:'east-rear',x:20,z:-1.1,length:12,rotation:0,floor:7.12},
  ...[-1,1].flatMap(side=>[16,26].map(x=>({id:`forecourt-${side}-${x}`,x:side*x,z:6,length:5,rotation:0,floor:x===16?6.50:7.10}))),
];
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function herbariumSiteDistance(x,z,site){const dx=x-site.x,dz=z-site.z,c=Math.cos(site.rotation||0),s=Math.sin(site.rotation||0);return Math.max(Math.abs(dx*c-dz*s)-site.width/2,Math.abs(dx*s+dz*c)-site.depth/2);}
const rectangleDistance=herbariumSiteDistance;
export function nearestHerbariumPath(x,z){
  let nearest={distance:Infinity,height:0,path:null},totalWeight=0,totalHeight=0;
  for(const path of herbariumPaths)for(let i=1;i<path.points.length;i++){
    const [ax,az,ay]=path.points[i-1],[bx,bz,by]=path.points[i],dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)),distance=Math.hypot(x-ax-t*dx,z-az-t*dz);
    const join=i===1?smooth(...(path.join||[2.8,4.5]),t*Math.hypot(dx,dz)):1,weight=(1-smooth(path.width/2,path.width/2+1.1,distance))*join;
    totalWeight+=weight;totalHeight+=(ay+(by-ay)*t)*weight;
    if(distance<nearest.distance)nearest={distance,height:ay+(by-ay)*t,path};
  }
  return {...nearest,weight:Math.min(1,totalWeight),grade:totalWeight?totalHeight/totalWeight:0};
}
function borderDistance(x,z,border){const dx=x-border.x,dz=z-border.z,c=Math.cos(border.rotation),s=Math.sin(border.rotation);return Math.max(Math.abs(dx*c-dz*s)-border.length/2,Math.abs(dx*s+dz*c)-1.1);}
export function herbariumAt(x,z,margin=0){
  const site=herbariumSites.find(s=>rectangleDistance(x,z,s)<=margin);if(site)return site;
  const border=herbariumBorders.find(b=>borderDistance(x,z,b)<=margin);if(border)return border;
  const p=nearestHerbariumPath(x,z);return p.distance<=p.path.width/2+margin?p.path:null;
}
export function herbariumLawnAt(x,z){
  // Existing trees remain the frame. Only low cover is mown inside this arrival.
  return 1-smooth(.60,1,Math.hypot((x-15)/13,(z-65)/11));
}
export function herbariumSoilAt(x,z){
  let soil=herbariumCommunitySoilAt(x,z);for(const b of herbariumBorders)soil=Math.max(soil,1-smooth(-.2,1.2,borderDistance(x,z,b)));
  return soil;
}
export function gradeHerbariumTerrain(x,z,height){
  if(x < -59 || x > 67 || z < -5 || z > 58)return height;
  const original=height,oldGardenClearance=Math.min(...gardenDistricts.map(site=>rectangleDistance(x,z,site)));
  if(oldGardenClearance<=0)return original;
  // Narrow smooth shoulders preserve the audited roads/lamps outside the works.
  const path=nearestHerbariumPath(x,z);
  height+=(path.grade-height)*path.weight;
  for(const site of herbariumSites){
    const distance=rectangleDistance(x,z,site);if(distance>=site.shoulder)continue;
    // Extend the flat part by half a terrain cell so interpolation at the slab
    // perimeter cannot rise through the floor or expose its foundation bottom.
    let grade=site.floor-.08;
    if(site.kind==='water'){
      // Signed distance follows every actual basin-floor vertex, including the
      // indented shore. The outer allowance keeps .5 m terrain triangles below
      // the -0.30 m basin even along its oblique perimeter.
      grade-=.42*(1-smooth(.35,1.25,waterGardenBasinDistance(x-site.x,z-site.z)));
    }
    height+=(grade-height)*(1-smooth(.25,site.shoulder,distance));
  }
  // A soil-backed border must remain embedded even where a pavilion shoulder
  // meets it. Its narrow transition stops short of the actual arcade floors.
  for(const b of herbariumBorders){const distance=borderDistance(x,z,b);if(distance<1)height+=(b.floor-.014-height)*(1-smooth(0,1,distance));}
  return original+(height-original)*smooth(0,1,oldGardenClearance);
}

// Actual bed/apron edges drive the connected margins. Only independent meadow
// ribbons use centreline samples; their explicit seeds keep accepted areas fixed.
export const herbariumPlantingDrifts=[
  ...[-1,1].flatMap(side=>[
    {id:`arcade-inner-${side}`,placement:'border-edge',sourceBorder:`forecourt-${side}-16`},
    {id:`arcade-front-${side}`,placement:'border-edge',sourceBorder:`forecourt-${side}-26`},
    {id:`court-corner-${side}`,placement:'court-corner'},
  ]),
  {id:'pond-near',placement:'authored-bed'},
  {id:'pond-west',connectedGroup:'pond-northwest',placement:'ribbon',seed:319,depth:2.2,fullScale:true,points:[[-53.8,41.6],[-54.2,45.8],[-53.8,49.2]]},
  // Four complete crowns curve behind the existing bronze lamp foot at
  // (-43.084,37.736). Stable seeds preserve the rest of the accepted ribbon.
  {id:'pond-far',connectedGroup:'pond-northwest',placement:'ribbon',seed:359,depth:2.6,fullScale:true,points:[[-53.8,41.6],[-50.6,39.6],[-46.7,38.9],[-42.5,39.0],[-39.3,39.4]],rootOffsets:{448:[0,.12],454:[0,.48],456:[0,.30],458:[0,.48]}},
  {id:'conservatory-south',placement:'slab-edge'},
  {id:'conservatory-east',placement:'community-edge'},
  {id:'conservatory-rear',placement:'ribbon',seed:487,depth:2.2,points:[[41.4,23.4],[40.8,27.0],[40.9,31.5],[41.9,35.1]]},
];

export const herbariumRegionalCommunities=authoredRegionalCommunities;
export const herbariumLowGardenBeds=authoredLowGardenBeds;
export const herbariumArrivalShoulders=[
  {id:'arrival-west',placement:'community-edge'},
  {id:'arrival-east',placement:'authored-bed'},
];
herbariumPlantingDrifts.push(...herbariumArrivalShoulders);
export function herbariumArrivalReserved(x,z,margin=0){return (x>=5-margin&&x<=26+margin&&z>=55-margin&&z<=76+margin)||(x>=-19-margin&&x<=-6+margin&&z>=35-margin&&z<=54+margin);}
// Only installed, supported full-plant footprints enter the ground mask. Each
// district owns its registration; disposing one cannot erase a second world.
// The existing landscape texture is shared, so listeners refresh that texture
// when progressive assembly installs a district after its first ground render.
const soilOwners=new Map(),soilListeners=new Set();let soilCells=new Map();
const soilCell=4,soilKey=(x,z)=>`${Math.floor(x/soilCell)},${Math.floor(z/soilCell)}`;
function rebuildCommunitySoil(){
  const cells=new Map();
  for(const footprints of soilOwners.values())for(const footprint of footprints){
    const xs=footprint.loop.map(p=>p[0]),zs=footprint.loop.map(p=>p[1]);
    for(let x=Math.floor((Math.min(...xs)-.28)/soilCell);x<=Math.floor((Math.max(...xs)+.28)/soilCell);x++)for(let z=Math.floor((Math.min(...zs)-.28)/soilCell);z<=Math.floor((Math.max(...zs)+.28)/soilCell);z++){
      const key=`${x},${z}`,bucket=cells.get(key)||[];bucket.push(footprint);cells.set(key,bucket);
    }
  }
  soilCells=cells;for(const listener of [...soilListeners])listener();
}
export function registerHerbariumCommunityFootprints(footprints){
  const owner={},copy=footprints.map(({loop,strength=1})=>{
    if(loop.length<3||loop.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))throw new TypeError('A planted soil footprint requires a finite source crown polygon.');
    return {loop:loop.map(p=>[...p]),strength};
  });
  soilOwners.set(owner,copy);rebuildCommunitySoil();let released=false;
  return ()=>{if(released)return;released=true;soilOwners.delete(owner);rebuildCommunitySoil();};
}
export function subscribeHerbariumCommunitySoil(listener){soilListeners.add(listener);return ()=>soilListeners.delete(listener);}
// Independent bounds expose the occupied index without lending owners or hulls.
export function herbariumCommunitySoilCellBounds(){
  return [...soilCells.keys()].map(key=>{const [x,z]=key.split(',').map(Number);return [x*soilCell,z*soilCell,(x+1)*soilCell,(z+1)*soilCell];});
}
function footprintDistance(x,z,loop){
  let inside=false,distance=Infinity;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[j],b=loop[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?-distance:distance;
}
export function herbariumCommunitySoilAt(x,z){
  if(herbariumArrivalReserved(x,z))return 0;
  let weight=0;
  for(const footprint of soilCells.get(soilKey(x,z))||[])weight=Math.max(weight,(1-smooth(-.18,.28,footprintDistance(x,z,footprint.loop)))*footprint.strength);
  if(weight){const path=nearestHerbariumPath(x,z);if(path.distance<path.path.width/2+.18)return 0;}
  return weight;
}

// Local source-bed centres select the existing clipped loam triangles; dimensions
// and root heights come from the actual assembled court, never a nominal pad.
export const herbariumCourtBeds=[
  {id:'court-near',x:13.3,z:13.5,phase:.4},
  {id:'court-east',x:12.7,z:-12.7,phase:2.1},
  {id:'court-west',x:-11.8,z:-13.2,phase:3.7},
];
