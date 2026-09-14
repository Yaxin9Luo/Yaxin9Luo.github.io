import {herbariumSites,herbariumPaths,herbariumSiteDistance} from '../../src/herbarium-layout.js';
import {gardenDistricts} from '../../src/environment-layout.js';
import {locations,bridges} from '../../src/locations.js';

// Dense interiors plus points 5 cm inside every garden edge catch blend overlap
// that centre/corner-only checks miss. Site rings cover the fixed landmark pads.
function newTerrace(x,z){
  if(herbariumSites.some(s=>herbariumSiteDistance(x,z,s)<s.shoulder))return true;
  return herbariumPaths.some(path=>path.points.slice(1).some(([bx,bz],i)=>{const [ax,az]=path.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*t,z-az-dz*t)<path.width/2+1.1;}));
}
export function* authoredGradeSamples(){
  for(const d of gardenDistricts){
    const xs=Array.from({length:Math.ceil(d.width)},(_,i)=>d.x-d.width/2+.05+i),zs=Array.from({length:Math.ceil(d.depth)},(_,i)=>d.z-d.depth/2+.05+i);
    xs.push(d.x+d.width/2-.05);zs.push(d.z+d.depth/2-.05);
    for(const x of xs)for(const z of zs)yield {id:`garden/${d.id}`,x,z,y:d.y};
  }
  for(const l of locations)for(const radius of [0,.5,.9,.97])for(let i=0;i<32;i++){
    const angle=i*Math.PI/16;
    const x=l.x+Math.cos(angle)*l.radius*radius,z=l.z+Math.sin(angle)*l.radius*radius;
    // Existing bridge-end approach grades deliberately take precedence here.
    if(Object.values(bridges).flat().some(([bx,bz])=>Math.hypot(x-bx,z-bz)<7))continue;
    // The old 14m workshop *lawn* pad overlaps the newly approved greenhouse
    // terrace/approach. New decoded-floor tests own those samples. The actual
    // old workshop footprint remains protected densely below, as do all gates.
    if(l.id==='projects'&&newTerrace(x,z))continue;
    yield {id:`site/${l.id}`,x,z,y:l.y};
  }
  for(let x=55.5;x<=72.5;x+=.5)for(let z=30.3;z<=44.45;z+=.5)yield {id:'site/projects-building',x,z,y:6};
}
