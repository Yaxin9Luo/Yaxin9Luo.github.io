import {communityShrubs,communityFerns,communityFlowers} from './herbarium-community-layout.js';

// The specimen remains an immutable source reference. Integrated beds add their
// own roots and curved low layers; they do not repeat the complete specimen.
export function canonicalCommunityPlants(){
  return [
    ...communityShrubs.map(([variant,x,z,scale,yaw])=>({species:'didelta_spinosa',variant,x,z,scale,yaw,layer:'woody middle',canonical:true})),
    ...communityFerns.map(([x,z,variant,scale,yaw])=>({species:'fern_02',variant,x,z,scale,yaw,layer:'low fern',canonical:true})),
    ...communityFlowers.map(([x,z],i)=>({species:'periwinkle_plant',variant:0,x,z,scale:2.10+(i%4)*.16,yaw:i*2.399,layer:'low flowers',canonical:true})),
  ];
}
function localPlant(region,plant){
  const c=Math.cos(region.rotation||0),s=Math.sin(region.rotation||0),dx=plant.x-region.x,dz=plant.z-region.z;
  return {...plant,x:dx*c-dz*s,z:dx*s+dz*c,yaw:plant.yaw-(region.rotation||0)};
}
const curve=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
function spineSamples(points,spacing){
  const fine=[];
  for(let segment=0;segment<points.length-1;segment++){
    const a=points[Math.max(0,segment-1)],b=points[segment],c=points[segment+1],d=points[Math.min(points.length-1,segment+2)],steps=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/.12);
    for(let i=0;i<steps;i++)fine.push([curve(a[0],b[0],c[0],d[0],i/steps),curve(a[1],b[1],c[1],d[1],i/steps),b[2]+(c[2]-b[2])*i/steps]);
  }
  fine.push(points.at(-1));const result=[];let distance=0,next=.16;
  for(let i=1;i<fine.length;i++){
    const a=fine[i-1],b=fine[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    while(next<=distance+length){const t=(next-distance)/length;result.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,width:a[2]+(b[2]-a[2])*t,nx:(b[1]-a[1])/length,nz:-(b[0]-a[0])/length});next+=spacing;}
    distance+=length;
  }
  return result;
}
// Width includes the original turned crown. Row count follows available width
// and real specimen spread, so a broad lobe does not become four distant rows.
function lowSweep(id,points,{flowers=false,seed=1,drift=id,rootOffsets={}}={}){
  const samples=spineSamples(points,flowers?.29:.96),plants=[];let n=seed;
  samples.forEach((point,i)=>{
    const taper=.5+.5*Math.sin(Math.PI*(i+.5)/samples.length)**.35,radius=flowers?.27:1.27,half=Math.max(0,point.width*taper/2-radius),lanes=Math.max(1,Math.ceil(half*2/(flowers?.29:1.04))+1);
    for(let lane=0;lane<lanes;lane++){
      const offset=lanes===1?0:(lane/(lanes-1)-.5)*half*2,jitter=Math.sin(n*1.73)*.065,variant=flowers?0:n%3===0?2:0,scale=flowers?2.10+(n%4)*.16:variant===0?2.10+(n%4)*.07:2.84+(n%4)*.13;
      plants.push({species:flowers?'periwinkle_plant':'fern_02',variant,x:point.x+point.nx*(offset+jitter),z:point.z+point.nz*(offset+jitter),scale,yaw:n*2.399,layer:flowers?'low flowers':'low fern',patch:id,drift,...(rootOffsets[n]?{rootOffset:rootOffsets[n]}:{})});n++;
    }
  });
  return plants;
}
function shrubsAt(patches,seed){
  return patches.flatMap(([patch,roots])=>roots.map(([variant,x,z],i)=>({species:'didelta_spinosa',variant,x,z,scale:variant===0?.96+(i%3)*.035:variant===1?.98+(i%3)*.035:1.0+(i%3)*.04,yaw:(seed+i)*2.399,layer:'woody middle',patch})));
}
const southwest={id:'southwest-woody',x:-17,z:67,rotation:.60};
const grove={id:'conservatory-grove-woody',x:61,z:17,rotation:-.50};
const southwestAddition=[
  ...shrubsAt([
    ['west-lobe',[[0,-15.8,60.8],[0,-14.3,59.5],[0,-12.8,60.6],[1,-16,62.4],[1,-14.6,61.5],[1,-13,62.1],[2,-17,63.2],[2,-15.4,63.5],[2,-12,63.1]]],
    ['middle-lobe',[[0,-11,58.5],[0,-9.3,57.5],[0,-7.7,58.5],[1,-11.3,60.2],[1,-9.6,59.3],[1,-7.6,60.2],[1,-6.5,59.1],[2,-10.1,61],[2,-7.7,61.3]]],
    ['lawn-lobe',[[0,-5.3,58.9],[0,-3.5,59.8],[0,-2.1,61],[1,-5.4,60.5],[1,-3.9,61.6],[1,-2.4,62.7],[2,-1.1,63.4],[2,.1,62.1],[2,-2.1,64.1]]],
  ],15113),
  // A 20 cm world-east refinement clears the existing small mossy stone under
  // the first fern. The community applies it after its original root admission.
  ...lowSweep('southwest-broad-body',[[-16,64,6.4],[-11,60,8.5],[-5,59.8,7.5],[1.8,61.8,4.0]],{seed:15601,drift:'arrival-west',rootOffsets:{15601:[.20,0]}}),
  // The cove descends sharply beyond z67 at the eastern end. This return turns
  // north across real land instead of forcing the proposed z74 tip over water.
  ...lowSweep('southwest-front',[[-20,69,3.1],[-18,67,4.1],[-14,64.5,4.6],[-9,63.5,4.3],[-4,64.8,3.6],[1.2,64.1,2.8]],{seed:15201,drift:'arrival-west'}),
  ...lowSweep('southwest-back',[[-12.7,57.4,2.7],[-9,55.8,3.1],[-4.8,56.7,3.0],[-1,59.4,2.6]],{seed:15301,drift:'arrival-west'}),
  ...lowSweep('southwest-flower-return',[[-21.1,70.4,1.2],[-18.2,68.8,1.6],[-15.2,66.2,1.7],[-12.4,65.1,1.5]],{flowers:true,seed:15401,drift:'arrival-west'}),
  ...lowSweep('southwest-flower-tip',[[-10.9,64.8,1.6],[-6.5,65.8,1.8],[-2.4,65.8,1.5],[1.7,65.0,1.2]],{flowers:true,seed:15501,drift:'arrival-west'}),
];
const groveAddition=[
  ...shrubsAt([
    ['grove-bridge',[[0,64.2,13.9],[0,65.9,12.7],[1,64.7,15.2],[1,66.1,14.4],[1,67.0,13.2],[2,63.8,15.8],[2,66.1,15.5],[2,67.6,14.4]]],
    ['grove-terminal',[[0,67.8,11.4],[0,69.3,10.5],[1,68.8,12.6],[1,70.3,11.8],[1,71.1,10.6],[2,70.2,13.0],[2,72.1,11.6]]],
  ],17013),
  ...lowSweep('grove-southwest-return',[[57.0,17.1,3.4],[60.7,17.7,6.8],[64.8,17.1,7.4],[68.6,14.8,5.8],[72.6,12.8,3.2]],{seed:17101,drift:'conservatory-east'}),
  ...lowSweep('grove-flower-edge',[[57.5,18.6,1.2],[61.7,19.5,1.7],[66.0,18.8,1.6],[69.2,16.8,1.2]],{flowers:true,seed:17201,drift:'conservatory-east'}),
];
export const authoredRegionalCommunities=[
  {...southwest,plants:[...canonicalCommunityPlants(),...southwestAddition.map(p=>localPlant(southwest,p))]},
  {...grove,plants:[...canonicalCommunityPlants(),...groveAddition.map(p=>localPlant(grove,p))]},
];
export const authoredLowGardenBeds=[
  {id:'arrival-east',x:0,z:0,rotation:0,plants:[
    ...lowSweep('arrival-east-body',[[29.2,56.8,5.0],[33.3,60.8,9.2],[35,63.7,6.0]],{seed:16013,drift:'arrival-east'}),
    // The proposed z70…80 ring reaches the real cove and the lilac walkway.
    // This broad inward turn ends on the continuous upper ground instead.
    ...lowSweep('arrival-east-return',[[34.5,63.9,5.0],[32.0,65.0,4.8],[30.7,66.5,3.0]],{seed:16313,drift:'arrival-east'}),
    ...lowSweep('arrival-east-flower-inner',[[27.8,56.5,1.1],[28.3,59.4,1.5],[29.1,63.5,1.8],[30.0,66.8,1.4]],{flowers:true,seed:16113,drift:'arrival-east'}),
    ...lowSweep('arrival-east-flower-outer',[[33.6,57.8,1.1],[37.0,60.7,1.9],[37.6,63.7,1.3]],{flowers:true,seed:16213,drift:'arrival-east'}),
  ]},
  {id:'pond-near',x:0,z:0,rotation:0,plants:[
    ...lowSweep('pond-shore-connection',[[-42.5,51.85,2.8],[-42.5,53.7,4.8],[-40.5,55.2,5.2]],{seed:18413,drift:'pond-near'}),
    ...lowSweep('pond-apron-body',[[-50,55.8,3.4],[-44.5,57.2,6.2],[-38.9,56.8,6.0],[-34.0,54.7,5.8],[-30.5,53.3,4.5],[-29.0,51.7,3.0]],{seed:18113,drift:'pond-near'}),
    ...lowSweep('pond-apron-flowers',[[-49.7,57.8,1.2],[-44.2,58.6,1.8],[-38.6,58.0,1.7],[-34.1,55.8,1.4]],{flowers:true,seed:18213,drift:'pond-near'}),
    ...lowSweep('pond-east-flower-return',[[-32.1,56.2,1.1],[-29.1,54.0,1.5],[-27.8,51.1,1.1]],{flowers:true,seed:18313,drift:'pond-near'}),
  ]},
];
