// Shared authoring masks keep graded ground, garden geometry and vegetation aligned.
// Existing landmark, portal and bridge coordinates remain the navigation contract.
export const gardenDistricts = [
  {id:'courtyard',x:0,z:31,y:6,width:36,depth:42,shoulder:5},
  {id:'reading',x:-66,z:27,y:7,width:29,depth:18,shoulder:4},
  {id:'atelier',x:64,z:55.5,y:6,width:40,depth:23,shoulder:4},
  {id:'journey',x:-45,z:84,y:5,width:24,depth:18,shoulder:3},
  {id:'post',x:83.5,z:-50,y:8,width:23,depth:17,shoulder:3},
  {id:'astral',x:-84,z:-59,y:7,width:22,depth:14,shoulder:3},
];

export function insideAuthoredGarden(x,z,margin=0) {
  return gardenDistricts.some(d=>Math.abs(x-d.x)<d.width/2+margin&&Math.abs(z-d.z)<d.depth/2+margin);
}

export function gradeGardenTerrain(x,z,height) {
  for(const d of gardenDistricts){
    const distance=Math.max(Math.abs(x-d.x)-d.width/2,Math.abs(z-d.z)-d.depth/2);
    if(distance>=d.shoulder)continue;
    const t=Math.max(0,distance/d.shoulder),blend=t*t*(3-2*t);
    height=d.y+(height-d.y)*blend;
  }
  return height;
}

// Planting groups occupy side/rear banks. Their crowns frame the main axes.
export const landscapeGroves = [
  {x:-33,z:-17,rx:9,rz:14,kind:'silver'},
  {x:35,z:-16,rx:8,rz:16,kind:'silver'},
  {x:-59,z:-13,rx:11,rz:8,kind:'pine'},
  {x:73,z:8,rx:14,rz:9,kind:'silver'},
  {x:47,z:72,rx:12,rz:8,kind:'cherry'},
  {x:-19,z:79,rx:10,rz:7,kind:'silver'},
  {x:-85,z:39,rx:8,rz:12,kind:'cherry'},
  {x:-96,z:-82,rx:12,rz:11,kind:'pine'},
  {x:95,z:-80,rx:11,rz:10,kind:'silver'},
  {x:-30,z:-79,rx:10,rz:8,kind:'pine'},
  {x:25,z:-78,rx:10,rz:9,kind:'silver'},
];

export function groveAt(x,z,margin=0) {
  return landscapeGroves.find(g=>((x-g.x)/(g.rx+margin))**2+((z-g.z)/(g.rz+margin))**2<1);
}

export const blossomParks=[
  {id:'cherry-walk',kind:'cherry',seed:881,centre:[-71,66],radius:20,
    path:[[-55,62],[-64,63],[-74,65],[-78,73]],
    trees:[[-60,57,1.08],[-70,57,1.14],[-81,59,.95],[-85,68,1.06],[-77,81,.97],[-68,74,1.05],[-59,72,.91]],
    lamps:[[-59,64],[-69,61],[-79,67],[-75,74]],overlook:[-78,73]},
  {id:'lilac-walk',kind:'lilac',seed:910,centre:[51,79],radius:21,
    path:[[33,70],[39,77],[48,80],[58,77],[69,72]],
    trees:[[32,80,.95],[41,69,1.02],[44,87,1.0],[53,71,1.09],[61,83,.93],[73,77,.96]],
    lamps:[[36,75],[44,78],[55,79],[65,73]],overlook:[48,80]},
];
export function insideBlossomPark(x,z){return blossomParks.some(p=>Math.hypot(x-p.centre[0],z-p.centre[1])<p.radius);}

// Broad connected drifts are authored beside the retained walks. Fine noise only
// softens their margins; it never chooses the ecological region by itself.
export const flowerDrifts=[
  {kind:'cherry',width:3.6,points:[[-89,57],[-81,55],[-73,58],[-65,59],[-56,57]]},
  {kind:'cherry',width:3.2,points:[[-86,73],[-81,79],[-73,79],[-65,75],[-58,77]]},
  {kind:'lilac',width:3.6,points:[[30,82],[38,85],[46,85],[56,84],[65,79],[73,78]]},
  {kind:'lilac',width:2.8,points:[[33,69],[41,71],[49,73],[56,70],[63,68]]},
  {kind:'ivory',width:3.1,points:[[-45,-20],[-43,-9],[-36,0],[-29,6]]},
  {kind:'ivory',width:3.0,points:[[37,-24],[40,-12],[47,-4],[57,0]]},
  {kind:'lilac',width:2.8,points:[[-88,30],[-86,40],[-79,46],[-71,46]]},
  {kind:'ivory',width:2.7,points:[[-31,70],[-25,76],[-16,80],[-8,77]]},
  {kind:'lilac',width:3.4,points:[[67,15],[75,17],[85,13],[92,7]]},
];
const unit=value=>Math.max(0,Math.min(1,value));
const transition=(a,b,x)=>{const t=unit((x-a)/(b-a));return t*t*(3-2*t);};
function lineDistance(x,z,points){
  let distance=Infinity;
  for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],dx=bx-ax,dz=bz-az,t=unit(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz));distance=Math.min(distance,Math.hypot(x-ax-dx*t,z-az-dz*t));}
  return distance;
}
/** DOM-free ecological authoring; landform weights are supplied by the caller
 * to keep the terrain/layout dependency one-way. All weights are continuous. */
export function plantingCommunityAt(x,z,landform={}){
  const ripple=Math.sin(x*.33+Math.sin(z*.21))*Math.cos(z*.29+x*.11),broad=.5+.5*Math.sin(x*.10+z*.066)*Math.cos(z*.081-x*.047);
  let flowers=0,kind='ivory',shade=0,humus=0,opening=0;
  for(const drift of flowerDrifts){const distance=lineDistance(x+ripple*.65,z+Math.sin(x*.24-z*.17)*.65,drift.points),weight=1-transition(drift.width*.25,drift.width,distance);if(weight>flowers){flowers=weight;kind=drift.kind;}}
  for(const grove of landscapeGroves){const radius=Math.hypot((x-grove.x)/grove.rx,(z-grove.z)/grove.rz);shade=Math.max(shade,(1-transition(.15,1.15,radius))*.82);}
  for(const park of blossomParks)for(const [tx,tz,scale]of park.trees){
    const dx=x-tx,dz=z-tz,angle=Math.atan2(dz,dx),r=Math.hypot(dx,dz),rootRadius=scale*(1.55+.28*Math.sin(angle*3+tx*.13)+.18*Math.cos(angle*5+tz*.09));
    shade=Math.max(shade,1-transition(1.5,5.6*scale,r));
    humus=Math.max(humus,1-transition(rootRadius*.45,rootRadius*1.6,r));
  }
  for(const [cx,cz,rx,rz]of[[-29,37,15,18],[29,49,12,16],[-54,67,4.5,5.0],[51,89,5.5,3.6],[12,77,10,9],[-1,-75,12,7]])opening=Math.max(opening,1-transition(.20,1,Math.hypot((x-cx)/rx,(z-cz)/rz)));
  const moisture=unit((landform.moisture||0)*.8+shade*.52),rock=unit((landform.rock||0)*(.48+.22*broad));
  humus=Math.max(humus,shade*.27*(.4+broad*.6));
  const ferns=unit((shade*.68+moisture*.57)*(0.58+broad*.42)*(1-opening*.91)*(1-rock*.40));
  flowers*=1-opening*.92;
  const grass=unit((.50+shade*.17+flowers*.16)*(1-opening*.72)*(1-rock*.64)*(1-humus*.48));
  return {flowers,kind,ferns,grass,humus,shade,opening,moisture,rock};
}
