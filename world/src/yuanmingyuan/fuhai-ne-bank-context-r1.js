import {westernGardenPlantingSpec} from './western-garden-planting.js';

export const fuhaiNortheastBankContextRegionId='fuhai-ne-bank-context-r1';

// Contemporary exhibit landscape on the current coarse Fuhai bank. These are
// world coordinates, not locations recovered from the historical copperplate.
// Append to the complete current plan; selection remains the caller's decision.
const polygon=[[257,-565],[277,-565],[295,-553],[296,-537],[284,-532],[262,-546]];
const trees=[
  {point:[269,-552],scale:1.35,yaw:-.4,rootReserve:2.08},
  {point:[283,-545],scale:1.05,yaw:.65,rootReserve:1.64},
];
const shoulders=[
  {id:'long-lakeward-shoulder',count:78,spacing:.57,
    // Connected unequal lobes; the neck is deliberately narrower than the two shoulders.
    polygon:[[261.3,-558.3],[262.3,-559.1],[264.1,-558.4],[265.5,-556.6],
      [266.05,-554.9],[266.65,-553.25],[267,-551.75],[267.6,-550.35],
      [269.45,-549.3],[271.4,-547.75],[271.15,-546.65],[269.55,-546.7],
      [267.9,-547.1],[266.55,-548.15],[265.45,-549.55],[264.05,-550.35],
      [263.25,-551.9],[262.9,-553.65],[262.15,-555.15],[261.6,-556.35]],
    flowers:[[263.05,-556.95,1.19],[263.68,-557.18,1.27],[264.02,-556.45,1.13],
      [267.0,-549.27,1.22],[267.7,-548.97,1.15],[267.45,-548.2,1.29],[268.18,-548.05,1.18]]},
  {id:'short-open-shoulder',count:44,spacing:.58,
    polygon:[[276.7,-548.0],[277.65,-548.35],[278.75,-547.6],[279.2,-546.55],
      [279.75,-545.35],[280.15,-544.4],[281.0,-543.55],[282.6,-542.8],
      [284.1,-541.65],[285.5,-540.65],[285.6,-539.9],[284.45,-539.35],
      [283.35,-539.9],[282.7,-540.75],[281.4,-541.35],[280.1,-541.5],
      [278.85,-542.55],[278.1,-544.0],[277.3,-545.5],[276.9,-546.6]],
    flowers:[[280.23,-542.53,1.25],[280.97,-542.36,1.17],[281.37,-541.71,1.11]]},
];
const clone=value=>JSON.parse(JSON.stringify(value));
function inside([x,z],ring){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function halton(index,base){
  let value=0,step=1;
  while(index){step/=base;value+=step*(index%base);index=Math.floor(index/base);}
  return value;
}
function withinRootReserve(point,extra){
  return trees.some(t=>Math.hypot(point[0]-t.point[0],point[1]-t.point[1])<t.rootReserve+extra);
}

export function extendFuhaiNortheastBankContext(plan){
  if(plan?.id!=='xianfaqiao-garden-planting-r2'||!Array.isArray(plan.regions)||
    !Array.isArray(plan.clearings)||!Array.isArray(plan.buildingReserves))
    throw new Error('Fuhai context requires the complete current Xianfaqiao garden plan.');
  if(plan.regions.some(r=>r.id===fuhaiNortheastBankContextRegionId))
    throw new Error('Fuhai context must be appended only once.');
  const templates=new Map(plan.regions.flatMap(r=>r.placements).map(p=>[p.species,p]));
  for(const id of ['willow','sedge','flower-shrub']){
    const p=templates.get(id);
    if(!p||!(p.scale>0)||!p.envelope||!p.evidence)
      throw new Error('Missing original reviewed source template '+id);
  }
  const region={id:fuhaiNortheastBankContextRegionId,label:'福海东北岸疏密柳组',
    composition:'Two unequal willows and interlocking low shoulders frame a small part of the visible Fuhai bank. The open lake and existing routes remain reserved.',
    historicallySurveyed:false,nativeCompositionReviewed:false,
    designPolygon:clone(polygon),shoulders:shoulders.map(s=>({id:s.id,polygon:clone(s.polygon)})),
    rootReservations:trees.map((t,i)=>({id:'willow-root-'+(i+1),position:[...t.point],radius:t.rootReserve})),
    placements:[]};
  function add(species,point,scale,yaw,drift){
    const t=templates.get(species),ratio=scale/t.scale;
    region.placements.push({id:region.id+'-'+species+'-'+String(region.placements.length+1).padStart(3,'0'),
      species,position:[point[0],null,point[1]],scale,yaw,drift,burial:t.burial,
      envelope:{radius:t.envelope.radius*ratio,height:t.envelope.height*ratio},evidence:clone(t.evidence)});
  }
  for(const t of trees)add('willow',t.point,t.scale,t.yaw,'unequal-bank-canopy');
  for(const [si,shoulder]of shoulders.entries()){
    shoulder.flowers.forEach(([x,z,scale],i)=>add('flower-shrub',[x,z],scale,.31+i*2.399963+si*.7,shoulder.id+'-flower-knot'));
    const xs=shoulder.polygon.map(p=>p[0]),zs=shoulder.polygon.map(p=>p[1]);
    const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),points=[];
    // Low-discrepancy dart placement in an authored outline, with irregular
    // spacing and explicit flower/root openings. No regular rows or tree rings.
    for(let i=1;i<=16000&&points.length<shoulder.count;i++){
      const k=i+si*997,point=[x0+halton(k,2)*(x1-x0),z0+halton(k,3)*(z1-z0)];
      const scale=.97+.17*halton(k,7),spacing=shoulder.spacing*(.94+.12*halton(k,11));
      if(!inside(point,shoulder.polygon)||withinRootReserve(point,.14)||
        shoulder.flowers.some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<.32)||
        points.some(p=>Math.hypot(p.point[0]-point[0],p.point[1]-point[1])<Math.max(spacing,p.spacing)))continue;
      points.push({point,spacing});
      add('sedge',point,scale,halton(k,5)*Math.PI*2,shoulder.id+'-interwoven-sedge');
    }
    if(points.length!==shoulder.count)throw new Error('The authored low shoulder cannot hold its selected density: '+shoulder.id);
  }
  region.bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const p of region.placements){
    const[x,,z]=p.position,r=p.envelope.radius;
    region.bounds.minX=Math.min(region.bounds.minX,x-r);region.bounds.maxX=Math.max(region.bounds.maxX,x+r);
    region.bounds.minZ=Math.min(region.bounds.minZ,z-r);region.bounds.maxZ=Math.max(region.bounds.maxZ,z+r);
  }
  region.estimatedFullSourceTriangles=region.placements.reduce((n,p)=>n+westernGardenPlantingSpec.sourceTriangles[p.species],0);
  return {...plan,id:'xianfaqiao-garden-with-fuhai-context-r1',sourcePlanId:plan.id,
    regions:[...plan.regions,region],historicallySurveyed:false,nativeCompositionReviewed:false};
}
