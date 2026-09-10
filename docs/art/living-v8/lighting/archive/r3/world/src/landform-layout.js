import {CatmullRomCurve3,LineCurve3,Vector3} from 'three';
import {locations,bridges,court} from './locations.js';
import {blossomParks} from './environment-layout.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const radius=(x,z,c)=>Math.hypot((x-c.x)/c.rx,(z-c.z)/c.rz);
// Open seaward polygons leave unequal recesses and connected headlands. Their
// large bends are authored geology, rather than repeated radial scallops.
const coves=[
  [[145,-8],[103,-8],[99,-2],[101,6],[101,16],[105,20],[102,25],[96,27],[93,32],[94,38],[98,42],[99,49],[105,51],[108,58],[118,60],[133,66],[145,66]],
  [[-29,120],[-28,107],[-24,104],[-22,98],[-16,96],[-17,91],[-11,87],[-5,87],[-2,90],[3,91],[4,97],[9,95],[9,91],[15,88],[22,90],[26,96],[31,104],[37,120]],
].map(points=>({points,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))}));
const shoulders=[{x:-39,z:-39,rx:27,rz:36,lift:5.5},{x:39,z:-42,rx:26,rz:37,lift:6.2},{x:0,z:-75,rx:32,rz:23,lift:8.8}];
const buttresses=[{x:-99,z:32,rx:13,rz:19,lift:7},{x:-40,z:101,rx:15,rz:10,lift:7.5},{x:29,z:89,rx:14,rz:13,lift:8},{x:91,z:69,rx:13,rz:17,lift:8},{x:99,z:8,rx:14,rz:14,lift:6},{x:-100,z:-86,rx:13,rz:14,lift:7},{x:98,z:-83,rx:12,rz:15,lift:7.5}];
const rockRibs=[{x:-29,z:99,rx:6,rz:14,lift:13},{x:6,z:94,rx:5,rz:11,lift:13},{x:98,z:18,rx:7,rz:14,lift:15},{x:103,z:52,rx:7,rz:11,lift:12}];

function coveDistance(x,z,region){
  const outside=Math.max(region.minX-x,x-region.maxX,region.minZ-z,z-region.maxZ);
  if(outside>32)return outside;
  let inside=false,distance=Infinity;
  for(let i=0,j=region.points.length-1;i<region.points.length;j=i++){
    const [ax,az]=region.points[j],[bx,bz]=region.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-ax-dx*t,z-az-dz*t));
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside?-distance:distance;
}
const coveBankDistance=(x,z)=>Math.min(...coves.map(region=>coveDistance(x,z,region)));

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
  let shoulder=0;const distance=coveBankDistance(x,z),terrace=1-smooth(16,28,distance),cove=1-smooth(0,14,distance);
  for(const region of [...shoulders,...buttresses,...rockRibs])shoulder=Math.max(shoulder,1-smooth(.12,1.35,radius(x,z,region)));
  return {shoulder,terrace,cove,rock:Math.max(shoulder*.7,terrace*.85),moisture:terrace*(.6+cove*.4)};
}

/** Cut only the two open-edge coves; bridge channels keep their original field. */
export function landformShoreField(x,z,field){
  return Math.min(field,coveBankDistance(x,z));
}

/** Sculpt before landmark/garden/portal grades are applied in world.js. */
export function sculptLandformHeight(x,z,height){
  const distance=coveBankDistance(x,z),terrace=1-smooth(18,28,distance);let lift=0,buttress=0,rib=0;
  for(const region of shoulders)lift=Math.max(lift,region.lift*(1-smooth(.12,1.35,radius(x,z,region))));
  for(const region of buttresses){const weight=1-smooth(.12,1.35,radius(x,z,region));lift=Math.max(lift,region.lift*weight);buttress=Math.max(buttress,weight);}
  for(const region of rockRibs)rib=Math.max(rib,region.lift*(1-smooth(.12,1.15,radius(x,z,region))));
  if(!lift&&!terrace)return height;
  const stratum=distance+.75*Math.sin(x*.13+z*.047)+.4*Math.sin(x*.051-z*.15)+buttress*6;
  // Oblique, unequal shelf reaches meet projecting bedrock ribs; no single
  // contour carries the same three risers continuously around either bay.
  const along=x>50?z-35:x+10,middleShift=Math.max(-5,Math.min(6,along*.28)),upperShift=Math.max(-5,Math.min(5,-along*.22));
  let bench=-11.2+5.5*smooth(2,4.3,stratum)+5.4*smooth(10.5,13.2,stratum+middleShift)+4*smooth(17,20,stratum+upperShift)+rib+.2*Math.sin(x*.11+z*.08);
  // One oblique wash cuts through the south bay benches. Its low rim puts
  // the cliff ledges below the lake, interrupting the otherwise raised edge.
  // Both flanking headlands keep the existing connected shoreline footprint.
  if(x<30&&z>60){
    const across=Math.abs(x+12-(87-z)*.35),wash=1-smooth(3,12,across);
    const lowBank=-14.6+Math.max(0,distance)*.46+9*smooth(9,21,distance);
    bench+=(Math.min(bench,lowBank)-bench)*wash;
  }
  const target=(height+lift)*(1-terrace)+bench*terrace;
  return height+(target-height)*editableGrade(x,z);
}
