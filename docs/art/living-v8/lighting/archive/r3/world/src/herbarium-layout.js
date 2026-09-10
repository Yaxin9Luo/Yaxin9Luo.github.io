import {gardenDistricts} from './environment-layout.js';
// Finished floors and approach reservations from garden-fit-audit.md. Geometry,
// terrain baking and late vegetation filtering consume the same authoring data.
export const herbariumSites=[
  {id:'west-arcade',kind:'arcade',x:-20,z:2,floor:7.2,width:12,depth:3.4,shoulder:2},
  {id:'east-arcade',kind:'arcade',x:20,z:2,floor:7.2,width:12,depth:3.4,shoulder:2},
  {id:'conservatory',kind:'conservatory',x:55,z:22,floor:6.7,width:16,depth:9,shoulder:1.5},
  {id:'water-garden',kind:'water',x:-44,z:47,floor:7.1,width:16,depth:9,shoulder:1.7},
];
export const herbariumPaths=[
  {id:'west-arcade',width:2.2,points:[[0,8.5,6.24],[-19.5,8.5,6.35],[-21.44,8.5,7.10],[-21.44,3.7,7.10]]},
  {id:'east-arcade',width:2.2,points:[[0,8.5,6.24],[19.5,8.5,6.35],[21.44,8.5,7.10],[21.44,3.7,7.10]]},
  {id:'conservatory',width:2.4,points:[[37.1,21.7,7.42756],[43,27.2,6.58],[50,27.5,6.58],[55,27.5,6.58]]},
  {id:'water-garden',width:2.4,points:[[-40,34.2,7.08846],[-34.5,41,7.00],[-34.5,47,7.00],[-36.5,47,7.00]]},
];
export const herbariumBorders=[
  {id:'west-rear',x:-20,z:-1.1,length:12,rotation:0,floor:7.12},
  {id:'east-rear',x:20,z:-1.1,length:12,rotation:0,floor:7.12},
  ...[-1,1].flatMap(side=>[16,26].map(x=>({id:`forecourt-${side}-${x}`,x:side*x,z:6,length:5,rotation:0,floor:x===16?6.50:7.10}))),
  {id:'conservatory-link',x:44,z:30,length:5,rotation:0,floor:6.56},
  {id:'water-link',x:-31.7,z:44,length:5,rotation:Math.PI/2,floor:7.00},
];
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
function rectangleDistance(x,z,site){return Math.max(Math.abs(x-site.x)-site.width/2,Math.abs(z-site.z)-site.depth/2);}
export function nearestHerbariumPath(x,z){
  let nearest={distance:Infinity,height:0,path:null},totalWeight=0,totalHeight=0;
  for(const path of herbariumPaths)for(let i=1;i<path.points.length;i++){
    const [ax,az,ay]=path.points[i-1],[bx,bz,by]=path.points[i],dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)),distance=Math.hypot(x-ax-t*dx,z-az-t*dz);
    const join=i===1?smooth(2.8,4.5,t*Math.hypot(dx,dz)):1,weight=(1-smooth(path.width/2,path.width/2+1.1,distance))*join;
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
  let soil=0;for(const b of herbariumBorders)soil=Math.max(soil,1-smooth(-.2,1.2,borderDistance(x,z,b)));
  return soil;
}
export function gradeHerbariumTerrain(x,z,height){
  if(x < -56 || x > 67 || z < -5 || z > 55)return height;
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
      // The actual asymmetric basin fits this excavation; broad low floor under
      // the inner water and a continuous rise beneath the planted outer shores.
      const radius=Math.hypot((x-site.x+.35)/6.3,(z-site.z+.35)/3.4);
      grade-=.42*(1-smooth(.88,1.12,radius));
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
  {id:'pond-near',placement:'pond-edge'},
  {id:'pond-west',placement:'ribbon',seed:319,depth:1.5,points:[[-51.6,44.7],[-52.1,46.8],[-51.9,49.1]]},
  {id:'pond-far',placement:'ribbon',seed:359,depth:1.6,points:[[-49.4,41.8],[-46.9,41.8],[-44.5,42.0]]},
  {id:'conservatory-west',placement:'slab-edge'},
  {id:'conservatory-east',placement:'ribbon',seed:443,depth:1.6,points:[[64.6,18.4],[64.7,20.9],[64.5,23.5]]},
  {id:'conservatory-rear',placement:'ribbon',seed:487,depth:1.8,points:[[49.7,15.6],[52.5,15.4],[55.4,15.8]]},
];

// Local source-bed centres select the existing clipped loam triangles; dimensions
// and root heights come from the actual assembled court, never a nominal pad.
export const herbariumCourtBeds=[
  {id:'court-near',x:13.3,z:13.5,phase:.4},
  {id:'court-east',x:12.7,z:-12.7,phase:2.1},
  {id:'court-west',x:-11.8,z:-13.2,phase:3.7},
];
