import {CatmullRomCurve3,LineCurve3,Vector3} from 'three';
import {locations,bridges,court} from './locations.js';
import {blossomParks} from './environment-layout.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const radius=(x,z,c)=>Math.hypot((x-c.x)/c.rx,(z-c.z)/c.rz);
const coves=[{x:111,z:36,rx:18,rz:15},{x:4,z:103,rx:17,rz:14}];
const shoulders=[{x:-39,z:-39,rx:27,rz:36,lift:5.5},{x:39,z:-42,rx:26,rz:37,lift:6.2},{x:0,z:-75,rx:32,rz:23,lift:8.8}];

/** The same curves author both the stone roads and their protected grades. */
export function academyPathCurves(location){
  const gate=new Vector3(location.x,0,location.z+location.radius+3),ends=bridges[location.id],p=ends?new Vector3(ends[0][0],0,ends[0][1]):gate;
  const middle=location.id==='about'?new Vector3(0,0,17):location.id==='research'?new Vector3(-24,0,38):new Vector3(p.x*.45+10,0,court.z+p.z*.12);
  const curves=[new CatmullRomCurve3([new Vector3(1,0,court.z),middle,p])];
  if(ends)curves.push(new LineCurve3(new Vector3(ends[1][0],0,ends[1][1]),gate));
  return curves;
}

// A small spatial index keeps the field independent of world assembly and
// avoids scanning every authored road for each half-metre terrain vertex.
const routeCells=new Map(),cellSize=12;
for(const location of locations)for(const curve of academyPathCurves(location)){
  const points=curve.getPoints(Math.ceil(curve.getLength()/1.5)),width=location.id==='about'?3.2:2;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],margin=width+5.5,segment={a,b,width};
    for(let x=Math.floor((Math.min(a.x,b.x)-margin)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+margin)/cellSize);x++)for(let z=Math.floor((Math.min(a.z,b.z)-margin)/cellSize);z<=Math.floor((Math.max(a.z,b.z)+margin)/cellSize);z++){
      const key=`${x}/${z}`,bucket=routeCells.get(key)||[];bucket.push(segment);routeCells.set(key,bucket);
    }
  }
}
function editableGrade(x,z){
  let weight=1;
  for(const {a,b,width}of routeCells.get(`${Math.floor(x/cellSize)}/${Math.floor(z/cellSize)}`)||[]){
    const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
    weight=Math.min(weight,smooth(width+1.25,width+5.5,Math.hypot(x-a.x-dx*t,z-a.z-dz*t)));
  }
  for(const park of blossomParks)weight=Math.min(weight,smooth(park.radius,park.radius+5,Math.hypot(x-park.centre[0],z-park.centre[1])));
  return weight;
}

/** Continuous, deterministic 0..1 regional weights for planting and materials.
 * They describe the authored landforms; they do not imply walkable support. */
export function landformAt(x,z){
  let shoulder=0,terrace=0,cove=0;
  for(const region of shoulders)shoulder=Math.max(shoulder,1-smooth(.12,1.35,radius(x,z,region)));
  for(const region of coves){
    cove=Math.max(cove,1-smooth(1,1.8,radius(x,z,region)));
    terrace=Math.max(terrace,1-smooth(.45,1.5,radius(x,z,{...region,rx:region.rx+14,rz:region.rz+14})));
  }
  return {shoulder,terrace,cove,rock:Math.max(shoulder*.7,terrace*.85),moisture:terrace*(.6+cove*.4)};
}

/** Cut only the two open-edge coves; bridge channels keep their original field. */
export function landformShoreField(x,z,field){
  for(const region of coves)field=Math.min(field,radius(x,z,region)-1);
  return field;
}

/** Sculpt before landmark/garden/portal grades are applied in world.js. */
export function sculptLandformHeight(x,z,height){
  const {terrace}=landformAt(x,z);let lift=0;
  for(const region of shoulders)lift=Math.max(lift,region.lift*(1-smooth(.12,1.35,radius(x,z,region))));
  if(!lift&&!terrace)return height;
  const target=(height+lift)*(1-terrace)+(-9.8+Math.sin(x*.085+z*.061)*.6)*terrace;
  return height+(target-height)*editableGrade(x,z);
}
