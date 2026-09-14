import {createXieqiquCourtGardenR1Layout} from './xieqiqu-court-garden-r1-layout.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// Contemporary exhibit horticulture; this is not a recovered historical pattern.
// Preserve the four source beds, all passages, 116 complete sedges + 8 complete
// flowering shrubs. Three interlocking growth patches organize each parterre;
// the smaller perimeter and flower-understorey clumps preserve a low edge.
export function createXieqiquCourtGardenR2Layout(){
  const plan=JSON.parse(JSON.stringify(createXieqiquCourtGardenR1Layout()));
  plan.id='xieqiqu-court-garden-r2';plan.evidence={...plan.evidence,id:plan.id,nativeReviewed:false,
    description:'Contemporary low court garden candidate: unchanged four R1 beds and full-source plant count, organized in connected growth patches with grouped flowers; not surveyed historical planting.'};
  plan.levels.rootBurial=.006;
  for(const bed of plan.beds){
    const side=Math.sign(bed.cx),north=bed.id.includes('north-parterre'),grasses=plan.placements.filter(p=>p.bedId===bed.id&&p.species==='sedge');
    if(north){
      const flowerOffsets=side<0?[[-2.15,.18],[-.88,-.34],[-1.16,1.06],[2.72,-.66]]:[[-2.22,-.13],[-.91,.58],[-1.07,-1.00],[2.80,.61]];
      const flowerScales=[1.72,1.85,1.63,1.76],flowers=plan.placements.filter(p=>p.bedId===bed.id&&p.species==='flower-shrub');
      flowers.forEach((p,i)=>Object.assign(p,{x:bed.cx+side*flowerOffsets[i][0],z:bed.cz+flowerOffsets[i][1],scale:flowerScales[i],yaw:side*(.38+i*1.37),designRole:i<3?'three-shrub-flowering-group':'separate-flowering-accent'}));
      const patches=side<0?[[-3.16,.08,1.57,1.95,14],[-.10,-.36,1.72,1.70,13],[3.00,.43,1.63,1.83,13]]:[[-3.20,.32,1.56,1.86,13],[-.05,-.23,1.78,1.84,14],[3.10,.23,1.56,1.90,13]];
      let index=0;
      patches.forEach(([cx,cz,rx,rz,count],patch)=>{
        for(let i=0;i<count;i++){
          // A phyllotactic growth patch, not a jittered rectangular row. Different
          // patch phases interlock the leaf crowns at the meeting boundaries.
          const t=Math.sqrt((i+.35)/count),angle=i*2.399963229728653+patch*.91+side*.27;
          const x=cx+Math.cos(angle)*rx*t,z=cz+Math.sin(angle)*rz*t,edge=Math.min(5.79-Math.abs(x),3.04-Math.abs(z));
          const flowerDistance=Math.min(...flowerOffsets.map(([fx,fz])=>Math.hypot(x-fx,z-fz)));
          const core=1.70+.18*(1-t),edgeScale=1.32+.56*clamp((edge-.90)/.45,0,1),underFlowers=1.34+.54*clamp((flowerDistance-.45)/1.05,0,1);
          const scale=Math.min(core,edgeScale,underFlowers),p=grasses[index++];
          Object.assign(p,{x:bed.cx+side*x,z:bed.cz+z,scale,yaw:side*(angle+.63*patch),designRole:flowerDistance<1.2?'lower-flower-understorey':edge<1.2?'lower-bed-edge':'connected-grass-patch',patch:patch+1});
        }
      });
    }else{
      grasses.forEach((p,i)=>{
        const strand=i%2,j=Math.floor(i/2),t=j/8,along=-4.03+t*8.06+(strand?(.30-.28*t):0);
        const z=(strand?.19:-.19)+.14*Math.sin(t*Math.PI*2+strand*1.47+side*.17);
        const scale=1.16+.28*Math.sin(Math.PI*(.12+.76*t))+(strand?.035:0);
        Object.assign(p,{x:bed.cx+side*along,z:bed.cz+z,scale,yaw:side*(.61+j*1.39+strand*.74),designRole:'interlocking-low-ribbon'});
      });
    }
  }
  plan.sourceLayout={regions:[{id:plan.id,placements:plan.placements.map(p=>({species:p.species}))}]};
  return freeze(plan);
}
