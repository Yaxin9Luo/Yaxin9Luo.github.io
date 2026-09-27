import * as THREE from 'three';
import {jiuzhouTileRun} from './jiuzhou-architecture.js';
import {singleJuanpengSection,jiuzhouRoofSectionPoint,roofSurfacePatchGeometry} from './jiuzhou-roof-geometry.js';
import {roofTileRollGeometry} from './chinese-architecture-geometry.js';
import {V,namedGroup} from './study-geometry.js';
import {wanfangAnheLayout as L,rectangleUnionOutline} from './wanfang-anhe-layout.js';

const B=L.bay,H=B/2+L.veranda+L.eaveProjection,CAP=H*.62,BREAK=H*.55;
export const wanfangRoofSegments=Object.freeze([
  {id:'central-east-west',axis:'x',fixed:0,min:-4*B,max:4*B},
  {id:'central-north-south',axis:'z',fixed:0,min:-4*B,max:4*B},
  {id:'north-west-fold',axis:'x',fixed:-4*B,min:-4*B,max:0,freeStart:true},
  {id:'east-north-fold',axis:'z',fixed:4*B,min:-4*B,max:0,freeStart:true},
  {id:'south-east-fold',axis:'x',fixed:4*B,min:0,max:4*B,freeEnd:true},
  {id:'west-south-fold',axis:'z',fixed:-4*B,min:0,max:4*B,freeEnd:true}
]);
const section=singleJuanpengSection({depth:H*2,eaveY:L.eaveY,crownY:L.eaveY+L.roofRise});
const lookup=Float64Array.from({length:4097},(_,i)=>jiuzhouRoofSectionPoint(section,H*i/4096).y);
export const wanfangRoofProfile=d=>{
  const t=THREE.MathUtils.clamp(Math.abs(d)/H,0,1)*4096,i=Math.min(4095,Math.floor(t));
  return lookup[i]+(lookup[i+1]-lookup[i])*(t-i);
};
const toXZ=(s,a,c)=>s.axis==='x'?[a,s.fixed+c]:[s.fixed+c,a];
function valueForSegment(s,index,x,z,hint){
  const a=s.axis==='x'?x:z,c=(s.axis==='x'?z:x)-s.fixed;
  const ca=hint?(s.axis==='x'?hint[0]:hint[1]):a;
  if(Math.abs(c)>H+1e-7||a<s.min-H-1e-7||a>s.max+H+1e-7)return null;
  const end=a<s.min?'start':a>s.max?'end':null;
  const beyond=end==='start'?s.min-a:end==='end'?a-s.max:0;
  const free=end==='start'?s.freeStart:end==='end'?s.freeEnd:false;
  const beyondHint=end==='start'?s.min-ca:end==='end'?ca-s.max:0;
  let capDistance=0;
  if(end){
    if(free)capDistance=beyondHint>CAP+1e-8?BREAK+(H-BREAK)*(beyond-CAP)/(H-CAP):0;
    else capDistance=beyond;
  }
  const distance=Math.max(Math.abs(c),capDistance),mode=capDistance>Math.abs(c)+1e-8?'cap-'+end:'slope';
  return {index,id:s.id,y:wanfangRoofProfile(distance),mode,along:a,cross:c,end,distance};
}
export function wanfangRoofAt(x,z,hint){
  let best=null;
  for(let i=0;i<wanfangRoofSegments.length;i++){const r=valueForSegment(wanfangRoofSegments[i],i,x,z,hint);
    if(r&&(!best||r.y>best.y+1e-8))best=r;}
  return best;
}
const rectangles=wanfangRoofSegments.map(s=>s.axis==='x'?[s.min-H,s.fixed-H,s.max+H,s.fixed+H]:[s.fixed-H,s.min-H,s.fixed+H,s.max+H]);
export const wanfangRoofOutline=rectangleUnionOutline(rectangles);
export const wanfangRoofJunctions=Object.freeze([
  ...[-1,1].flatMap(x=>[-1,1].map(z=>({id:'central-valley-'+x+'-'+z,from:[0,0],to:[x*H,z*H],kind:'valley'}))),
  {id:'north-fold-valley',from:[0,-4*B],to:[-H,-4*B+H],kind:'valley'},
  {id:'east-fold-valley',from:[4*B,0],to:[4*B-H,-H],kind:'valley'},
  {id:'south-fold-valley',from:[0,4*B],to:[H,4*B-H],kind:'valley'},
  {id:'west-fold-valley',from:[-4*B,0],to:[-4*B+H,H],kind:'valley'},
  {id:'north-outer-hip',from:[0,-4*B],to:[H,-4*B-H],kind:'hip'},
  {id:'east-outer-hip',from:[4*B,0],to:[4*B+H,H],kind:'hip'},
  {id:'south-outer-hip',from:[0,4*B],to:[-H,4*B+H],kind:'hip'},
  {id:'west-outer-hip',from:[-4*B,0],to:[-4*B-H,-H],kind:'hip'}
]);
function lineDistance(x,z,a,c){
  const dx=c[0]-a[0],dz=c[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
function clearOfJunctions(x,z){return wanfangRoofJunctions.every(j=>lineDistance(x,z,j.from,j.to)>(j.kind==='valley'?.14:.10));}
function roofSkinGeometry(){
  const subdivisions=values=>{
    const sorted=[...new Set(values.map(v=>Math.round(v*1e8)/1e8))].sort((a,b)=>a-b),out=[sorted[0]];
    for(let i=1;i<sorted.length;i++){const a=sorted[i-1],c=sorted[i],n=Math.ceil((c-a)/.20);for(let j=1;j<=n;j++)out.push(a+(c-a)*j/n);}return out;
  };
  const xlines=rectangles.flatMap(r=>[r[0],r[2]]),zlines=rectangles.flatMap(r=>[r[1],r[3]]);
  for(const s of wanfangRoofSegments){
    const target=s.axis==='x'?xlines:zlines;target.push(s.min,s.max);
    if(s.freeStart)target.push(s.min-CAP);if(s.freeEnd)target.push(s.max+CAP);
  }
  xlines.push(0);zlines.push(0);
  const xs=subdivisions(xlines),zs=subdivisions(zlines),nx=xs.length-1,nz=zs.length-1,positions=[],uvs=[],indices=[];
  const occupied=(i,j)=>i>=0&&j>=0&&i<nx&&j<nz&&wanfangRoofAt((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2);
  const put=(x,y,z)=>{const i=positions.length/3;positions.push(x,y,z);uvs.push(x/.48,z/.48);return i;};
  const quad=(pts,up)=>{const ids=pts.map(p=>put(...p));if(up)indices.push(ids[0],ids[2],ids[1],ids[0],ids[3],ids[2]);else indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);};
  let cells=0;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)if(occupied(i,j)){
    cells++;const hint=[(xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2];
    const top=[[xs[i],zs[j]],[xs[i+1],zs[j]],[xs[i+1],zs[j+1]],[xs[i],zs[j+1]]].map(([x,z])=>[x,wanfangRoofAt(x,z,hint).y,z]);
    quad(top,true);quad(top.map(([x,y,z])=>[x,y-L.roofSkin,z]),false);
    for(const [a,c,di,dj]of [[0,1,0,-1],[1,2,1,0],[2,3,0,1],[3,0,-1,0]])if(!occupied(i+di,j+dj)){
      const p=top[a],r=top[c];quad([p,r,[r[0],r[1]-L.roofSkin,r[2]],[p[0],p[1]-L.roofSkin,p[2]]],false);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  g.userData={body:'single-envelope-connected-juanpeng-skin',cells,thickness:L.roofSkin,capBreaks:'four intentional gable infill faces'};
  return g;
}
function clippedRuns(sample,accept,steps=72){
  const ranges=[];let start=null,last=accept(sample(0)),at=0;if(last)start=0;
  for(let i=1;i<=steps;i++){const t=i/steps,current=accept(sample(t));
    if(current!==last){let a=at,c=t;for(let k=0;k<22;k++){const mid=(a+c)/2;if(accept(sample(mid))===last)a=mid;else c=mid;}const edge=(a+c)/2;
      if(current)start=edge;else {if(edge-start>1e-5)ranges.push([start,edge]);start=null;}}
    last=current;at=t;
  }
  if(last)ranges.push([start,1]);return ranges;
}
function addRoofTiles(b,parent,diagnostics){
  const cover=namedGroup(parent,'wanfang-anhe-full-clay-tiles',{body:'solid-pan-cover-drip-tiles',pitch:.26,coverArcSamples:24,source:'Jiuzhou original tile geometry, no triangle reduction'});
  let rows=0,runs=0,clipped=0;
  const run=(index,mode,sample,row)=>{
    const accept=([x,z])=>{const r=wanfangRoofAt(x,z);return r&&r.index===index&&r.mode===mode&&clearOfJunctions(x,z);};
    const ranges=clippedRuns(sample,accept);if(ranges.length!==1||ranges[0]?.[0]>1e-6||ranges[0]?.[1]<1-1e-6)clipped++;
    for(const [a,c]of ranges){const p=sample(a),q=sample(c);if(Math.hypot(p[0]-q[0],p[1]-q[1])<.07)continue;
      jiuzhouTileRun(b,cover,t=>{const [x,z]=sample(a+(c-a)*t);return V(x,wanfangRoofAt(x,z).y,z);},row);runs++;}
  };
  wanfangRoofSegments.forEach((s,index)=>{
    const count=Math.ceil((s.max-s.min+2*H)/.26),step=(s.max-s.min+2*H)/count;
    for(let i=0;i<count;i++){
      const a=s.min-H+(i+.5)*step;
      for(const side of [-1,1]){run(index,'slope',t=>toXZ(s,a,side*H*(1-t)),rows++);}
      const [x,z]=toXZ(s,a,0),r=wanfangRoofAt(x,z);
      if(r&&r.index===index&&r.mode==='slope'&&clearOfJunctions(x,z)){
        const points=Array.from({length:13},(_,j)=>{const [px,pz]=toXZ(s,a,-.19+.38*j/12);return V(px,wanfangRoofAt(px,pz).y+.096,pz);});
        b.add(cover,roofTileRollGeometry(points,.083,.024,24),b.m.greyTile,undefined,undefined,undefined,true);
      }
    }
    for(const [end,sign,origin]of [['start',-1,s.min],['end',1,s.max]]){
      const n=Math.ceil(2*H/.26);
      for(let i=0;i<n;i++){const cross=-H+(i+.5)*2*H/n;run(index,'cap-'+end,t=>toXZ(s,origin+sign*H*(1-t),cross),rows++);}
    }
  });
  diagnostics.tileRows=rows;diagnostics.tileRuns=runs;diagnostics.rowsClippedAtActualRoofIntersections=clipped;
}
function endGables(b,parent,diagnostics){
  let count=0;
  for(const s of wanfangRoofSegments)for(const [free,sign,origin]of [[s.freeStart,-1,s.min],[s.freeEnd,1,s.max]])if(free){
    count++;const a=origin+sign*CAP,bottom=wanfangRoofProfile(BREAK)-L.roofSkin;
    const outline=[new THREE.Vector2(-BREAK,bottom)];
    for(let i=0;i<=64;i++){const c=-BREAK+2*BREAK*i/64;outline.push(new THREE.Vector2(c,wanfangRoofProfile(c)-L.roofSkin));}
    outline.push(new THREE.Vector2(BREAK,bottom));
    const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(outline),{depth:.18,bevelEnabled:false,steps:1});
    geometry.translate(0,0,-.09);
    const g=namedGroup(parent,'wanfang-anhe-terminal-gable-'+s.id,{body:'solid-hip-gable-infill-under-rounded-top',exactJoinery:'inferred from photographed macro-form'});
    // Shape X is the cross-roof direction; its thickness is longitudinal.
    if(s.axis==='x')geometry.rotateY(Math.PI/2);
    const [x,z]=toXZ(s,a,0);b.add(g,geometry,b.m.brick,[x,0,z],undefined,undefined,true);
    for(const face of [-1,1]){
      const path=Array.from({length:65},(_,i)=>{const c=-BREAK+2*BREAK*i/64,[px,pz]=toXZ(s,a+face*.105,c);return V(px,wanfangRoofProfile(c)-.048,pz);});
      b.tube(g,b.m.tileLight,path,.073,80,16);
      for(const c of [-BREAK*.62,0,BREAK*.62]){const [px,pz]=toXZ(s,a+face*.108,c),top=wanfangRoofProfile(c)-.21;
        b.rod(g,b.m.darkWood,[px,bottom+.03,pz],[px,top,pz],.043,12);}
    }
    // Two actual hip arrises meet the lower gable corners and the end eave.
    for(const side of [-1,1]){
      const path=Array.from({length:41},(_,i)=>{const t=i/40,c=side*(BREAK+(H-BREAK)*t),long=a+sign*(H-CAP)*t,[px,pz]=toXZ(s,long,c);return V(px,wanfangRoofProfile(Math.abs(c))+.082,pz);});
      b.tube(g,b.m.greyTile,path,.079,56,16);
    }
  }
  diagnostics.terminalHipGables=count;
}
function junctionsAndEaves(b,parent,diagnostics){
  const g=namedGroup(parent,'wanfang-anhe-drainage-and-edge-closures',{body:'clay-valley-gutters-hip-arrises-and-thick-drips'});
  for(const j of wanfangRoofJunctions){
    const dx=j.to[0]-j.from[0],dz=j.to[1]-j.from[1],length=Math.hypot(dx,dz),side=V(-dz/length,0,dx/length);
    const path=t=>{const x=j.from[0]+dx*t,z=j.from[1]+dz*t;return V(x,wanfangRoofAt(x,z).y,z);};
    if(j.kind==='valley'){
      b.add(g,roofSurfacePatchGeometry((u,t)=>path(t).addScaledVector(side,(u-.5)*.29).add(V(0,.035+.065*(2*u-1)**2,0)),{columns:16,rows:72,thickness:.035}),b.m.tileShade,undefined,undefined,undefined,true);
      b.tube(g,b.m.darkWood,Array.from({length:33},(_,i)=>path(i/32).add(V(0,-.21,0))),.10,40,16);
    }else b.tube(g,b.m.greyTile,Array.from({length:41},(_,i)=>path(i/40).add(V(0,.087,0))),.092,56,16);
  }
  let drips=0;
  const drip=b.prototype('wanfang-clay-drip',()=>{
    const shape=new THREE.Shape();shape.moveTo(-.105,.04);shape.lineTo(.105,.04);shape.lineTo(.098,-.065);shape.quadraticCurveTo(.056,-.13,0,-.165);shape.quadraticCurveTo(-.056,-.13,-.098,-.065);shape.closePath();
    return new THREE.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.005,bevelThickness:.004,curveSegments:12});
  });
  for(let k=0;k<wanfangRoofOutline.length;k++){
    const a=wanfangRoofOutline[k],c=wanfangRoofOutline[(k+1)%wanfangRoofOutline.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),n=Math.ceil(len/.26),angle=-Math.atan2(dz,dx);
    b.box(g,b.m.darkWood,[(a[0]+c[0])/2,L.eaveY-.20,(a[1]+c[1])/2],[len,.20,.14],[0,angle,0]);
    for(let i=0;i<n;i++){const x=a[0]+dx*(i+.5)/n,z=a[1]+dz*(i+.5)/n;
      b.add(g,drip,b.m.tileLight,[x,L.eaveY+.022,z],undefined,[0,angle,0]);drips++;}
  }
  diagnostics.valleyGutters=wanfangRoofJunctions.filter(j=>j.kind==='valley').length;
  diagnostics.outerFoldHips=4;diagnostics.dripTiles=drips;
}
export function buildWanfangAnheRoof(b,parent){
  const root=namedGroup(parent,'wanfang-anhe-connected-roof',{body:'one-connected-33-bay-folded-roof',independentPavilionRoofs:0});
  const diagnostics={halfDepth:H,capStart:CAP,hipBreakCross:BREAK,eaveY:L.eaveY,crownY:L.eaveY+L.roofRise,skinThickness:L.roofSkin,profile:'Jiuzhou full singleJuanpengSection',surface:'upper envelope of six connected ridges; inferred structural intersections'};
  const skin=roofSkinGeometry();diagnostics.skinCells=skin.userData.cells;
  b.add(root,skin,b.m.tileShade,undefined,undefined,undefined,true);
  addRoofTiles(b,root,diagnostics);endGables(b,root,diagnostics);junctionsAndEaves(b,root,diagnostics);
  return {group:root,diagnostics};
}
