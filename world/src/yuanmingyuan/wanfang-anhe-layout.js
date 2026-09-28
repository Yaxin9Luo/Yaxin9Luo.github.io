// Working reconstruction coordinates: X east, Y up, Z south.
// 0.32 m/chi is an explicit modeling convention, not an 1860 measured scale.
export const WANFANG_ANHE_ID='wanfang-anhe-reconstruction-r1';
export const wanfangAnheLayout=Object.freeze({
  id:WANFANG_ANHE_ID,chi:0.32,bay:4.48,veranda:1.28,columnWidth:0.256,columnHeight:3.68,
  waterY:0,floorY:0.96,foundationBottom:-1.42,platformLip:0.20,eaveProjection:0.42,
  eaveY:5.12,roofRise:1.80,roofSkin:0.12,lakeHalf:43,lakeBed:-1.66,
  evidence:{plan:'DPM 2016 PDF09/printed24 figure12, root inspected',
    scale:'Tongzhi estimate quoted by 2016 author; 14/4/11.5/0.8 chi; 0.32m/chi chosen',
    roof:'DPM 2008 printed53 figure9 and HKPM 1873–74 reconstruction model/replica photographs',
    limits:'Roof intersection, timber joints, exact pigments and shore span dimensions are authored hypotheses; not surveyed pre-1860 fabric'}
});
const B=wanfangAnheLayout.bay;
const central=[];
for(let i=-3;i<=3;i++)central.push([i,0]);
for(let i=-3;i<=3;i++)if(i)central.push([0,i]);
const outer={north:Array.from({length:5},(_,i)=>[i-4,-4]),
  east:Array.from({length:5},(_,i)=>[4,i-4]),
  south:Array.from({length:5},(_,i)=>[i,4]),
  west:Array.from({length:5},(_,i)=>[-4,i])};
export const wanfangBays=Object.freeze([
  ...central.map(([x,z],i)=>({id:'central-'+(i+1),part:'central',grid:[x,z],center:[x*B,z*B]})),
  ...Object.entries(outer).flatMap(([part,points])=>points.map(([x,z],i)=>({id:part+'-'+(i+1),part,grid:[x,z],center:[x*B,z*B]})))
].map(Object.freeze));
export const wanfangBayKeys=new Set(wanfangBays.map(b=>b.grid.join(',')));
export function bayContains(x,z,expand=0){
  return wanfangBays.some(({center:[cx,cz]})=>Math.abs(x-cx)<=B/2+expand+1e-9&&Math.abs(z-cz)<=B/2+expand+1e-9);
}
export function rectangleUnionOutline(rectangles){
  const tidy=v=>Math.round(v*1e8)/1e8;
  const xs=[...new Set(rectangles.flatMap(r=>[tidy(r[0]),tidy(r[2])]))].sort((a,b)=>a-b);
  const zs=[...new Set(rectangles.flatMap(r=>[tidy(r[1]),tidy(r[3])]))].sort((a,b)=>a-b);
  const inside=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<zs.length-1&&rectangles.some(r=>{
    const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;return x>r[0]&&x<r[2]&&z>r[1]&&z<r[3];
  });
  const edges=new Map(),key=p=>p.join(',');
  const edge=(a,c)=>{if(edges.has(key(a)))throw new Error('Non-manifold Wanfang footprint');edges.set(key(a),c);};
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)if(inside(i,j)){
    const x=xs[i],X=xs[i+1],z=zs[j],Z=zs[j+1];
    if(!inside(i,j-1))edge([x,z],[X,z]);
    if(!inside(i+1,j))edge([X,z],[X,Z]);
    if(!inside(i,j+1))edge([X,Z],[x,Z]);
    if(!inside(i-1,j))edge([x,Z],[x,z]);
  }
  const first=[...edges.keys()][0];if(!first)throw new Error('Empty Wanfang footprint');
  const all=[];let at=first;
  do{all.push(at.split(',').map(Number));const next=edges.get(at);if(!next)throw new Error('Open footprint');edges.delete(at);at=key(next);}while(at!==first);
  if(edges.size)throw new Error('Disconnected or holed Wanfang building footprint');
  return all.filter((p,i)=>{const a=all[(i+all.length-1)%all.length],c=all[(i+1)%all.length];return Math.abs((p[0]-a[0])*(c[1]-p[1])-(p[1]-a[1])*(c[0]-p[0]))>1e-8;});
}
export function wanfangOutline(expand=0){
  const h=B/2+expand;
  return rectangleUnionOutline(wanfangBays.map(({center:[x,z]})=>[x-h,z-h,x+h,z+h]));
}
export const wanfangWaterCourts=Object.freeze([
  {id:'northwest-water-court',center:[-2*B,-2*B],outlet:[-26,-2*B]},
  {id:'northeast-water-court',center:[2*B,-2*B],outlet:[2*B,-26]},
  {id:'southeast-water-court',center:[2*B,2*B],outlet:[26,2*B]},
  {id:'southwest-water-court',center:[-2*B,2*B],outlet:[-2*B,26]}
]);
// Figure13 shows the three connections at NW/NE/SE, plus a south-facing dock.
// Local lengths/abutments are inferred study context, not a reconstructed lake shore.
const rim=4*B+B/2+wanfangAnheLayout.veranda+wanfangAnheLayout.platformLip;
export const wanfangApproaches=Object.freeze([
  {id:'northwest-one-span-bridge',from:[-4*B,-rim],to:[-4*B,-rim-6.4],width:1.92,spans:1},
  {id:'northeast-three-span-bridge',from:[rim,-4*B],to:[rim+8.96,-4*B],width:1.92,spans:3},
  {id:'southeast-one-span-bridge',from:[rim,4*B],to:[rim+6.4,4*B],width:1.92,spans:1}
]);
export const wanfangDock=Object.freeze({id:'south-water-stair',center:[2*B,rim],width:2.56,run:2.30,bottomTreadY:-.12});
export function roomBoundaryEdges(){
  const result=[];
  for(const bay of wanfangBays){const [gx,gz]=bay.grid,[x,z]=bay.center,h=B/2;
    for(const [dx,dz,a,c]of [[0,-1,[x-h,z-h],[x+h,z-h]],[1,0,[x+h,z-h],[x+h,z+h]],[0,1,[x+h,z+h],[x-h,z+h]],[-1,0,[x-h,z+h],[x-h,z-h]]])
      if(!wanfangBayKeys.has([gx+dx,gz+dz].join(',')))result.push({id:bay.id+'-edge-'+dx+'-'+dz,bayId:bay.id,part:bay.part,from:a,to:c,outward:[dx,dz]});
  }
  return result;
}
