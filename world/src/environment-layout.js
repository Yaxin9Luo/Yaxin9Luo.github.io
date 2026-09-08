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
