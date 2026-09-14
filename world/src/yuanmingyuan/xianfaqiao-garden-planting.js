import {createWesternGardenPlantingLayout,westernGardenPlantingSpec} from './western-garden-planting.js';
import {museumSites,sitePoint} from './museum-sites.js';
import {gardenLayout} from './garden-layout.js';

// Contemporary landscape composition around the retained Xieqiqu/bridge pair.
// The paved courts, pool rims, ramp routes and principal axis stay reserved.
// These positions are not a reconstruction of surveyed eighteenth-century trees.
export function createXianfaqiaoGardenPlantingLayout({sites=museumSites,layout=gardenLayout}={}){
  const plan=createWesternGardenPlantingLayout({sites,layout});
  const site=sites.find(site=>site.id==='xieqiqu');
  const templates=new Map(plan.regions.flatMap(region=>region.placements).map(p=>[p.species,p]));
  const at=([x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,null,p.z];};
  function add(region,species,point,scale,yaw,drift){
    const template=templates.get(species),ratio=scale/template.scale;
    region.placements.push({id:region.id+'-'+species+'-'+String(region.placements.length+1).padStart(2,'0'),
      species,position:at(point),scale,yaw,drift,burial:template.burial,
      envelope:{radius:template.envelope.radius*ratio,height:template.envelope.height*ratio},
      evidence:{...template.evidence},
    });
  }
  function pocket(region,centre,{stone=false,fern=false,flower=false}={}){
    const offset=(x,z)=>[centre[0]+x,centre[1]+z];
    if(stone)add(region,'lake-rock',offset(-1,0),.44,.43,'stone-anchor');
    if(fern)add(region,'fern',offset(.65,-.4),1,1.25,'stone-side-low-layer');
    if(flower)add(region,'flower-shrub',offset(1.75,-1.05),1.1,-.25,'flower-accent');
    [[-2.3,.65,.95],[-1.35,1.2,1.02],[-.4,1.45,.91],[.5,1.75,1.07],[1.3,1.65,.94],[2.05,1.25,.88]]
      .forEach(([x,z,size],i)=>add(region,'sedge',offset(x,z),size,i*2.399963,'open-crescent'));
  }
  function region(id,label,composition,build){
    const value={id,label,composition,placements:[]};build(value);
    value.bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const p of value.placements){const[x,,z]=p.position,r=p.envelope.radius;value.bounds.minX=Math.min(value.bounds.minX,x-r);value.bounds.maxX=Math.max(value.bounds.maxX,x+r);value.bounds.minZ=Math.min(value.bounds.minZ,z-r);value.bounds.maxZ=Math.max(value.bounds.maxZ,z+r);}
    value.estimatedFullSourceTriangles=value.placements.reduce((n,p)=>n+westernGardenPlantingSpec.sourceTriangles[p.species],0);
    plan.regions.push(value);
  }
  region('xieqiqu-forelake-garden','谐奇趣前湖外岸','Two unequal low planting pockets and a single outer-bank willow; the axial view stays open.',r=>{
    pocket(r,[-26,61],{stone:true,flower:true});
    pocket(r,[37,61],{stone:true,fern:true});
    add(r,'willow',[51,78],1.9,.6,'outer-bank-frame');
  });
  region('xianfaqiao-approach-garden','线法桥两端接道','Staggered trees and low planting mark the approaches without closing the ramps or gate.',r=>{
    add(r,'juniper',[-60,5],.95,-.28,'north-approach-frame');
    add(r,'juniper',[-52,85],.95,.34,'south-approach-frame');
    pocket(r,[-62.5,14],{stone:true,fern:true});
    pocket(r,[-49,88],{flower:true});
  });
  region('xieqiqu-north-garden','谐奇趣北侧园景','A connected low planting drift ties the scholar stone and flowering shrubs to a clipped-tree backdrop; the principal axis remains open.',r=>{
    const original=plan.regions.find(region=>region.id==='xieqiqu-north');
    for(const p of original.placements.filter(p=>p.species!=='sedge'))r.placements.push({
      ...p,id:r.id+'-'+p.id,position:[...p.position],envelope:{...p.envelope},evidence:{...p.evidence},
    });
    add(r,'juniper',[-36.4,-57.35],.84,.18,'stone-backdrop');
    add(r,'flower-shrub',[-28.7,-57.95],1.1,.38,'connected-flower-mass');
    add(r,'flower-shrub',[-27.75,-58.9],1.2,1.17,'connected-flower-mass');
    add(r,'fern',[-33.4,-58.1],1,.35,'stone-left-understory');
    add(r,'fern',[-33.55,-57.15],.94,1.45,'stone-left-understory');
    // Interlocking drifts, with a one-metre open pocket at the front of the
    // stone. Actual rooted prototypes and guide envelopes are checked later.
    for(const [cx,cz,cols,rows]of [[-35.15,-56.8,5,3],[-29.35,-56.7,6,3]]){
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const x=cx+(col-(cols-1)/2)*.57+(row%2)*.24,z=cz+(row-1)*.53;
        add(r,'sedge',[x,z],.88+((col+2*row)%4)*.065,(row*cols+col)*2.399963,'connected-low-drift');
      }
    }
  });
  plan.id='xianfaqiao-garden-planting-r2';
  return plan;
}
