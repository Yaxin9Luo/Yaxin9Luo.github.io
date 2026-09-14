import * as THREE from 'three';
import {seededGardenRandom} from './vegetation-geometry.js';
import {yangquelongBedGroundSpec} from './yangquelong-bed-ground.js';
import {yangquelongGardenLayout} from './yangquelong-garden-layout.js';
import {yangquelongUnderstoreyRootReference} from './yangquelong-understorey-root-reference.js';

const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong understorey layout: '+message);};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export const polygonArea=p=>Math.abs(p.reduce((a,v,i)=>a+v[0]*p[(i+1)%p.length][1]-v[1]*p[(i+1)%p.length][0],0))/2;
export function convexHull(points){
 const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const unique=sorted.filter((p,i)=>!i||p[0]!==sorted[i-1][0]||p[1]!==sorted[i-1][1]);
 if(unique.length<3)return unique;
 const half=a=>{const out=[];for(const p of a){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
 return [...half(unique).slice(0,-1),...half(unique.toReversed()).slice(0,-1)];
}
export function pointInside(point,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function pointSegmentDistance(p,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;
 const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);
}
export const pointEdgeDistance=(p,poly)=>Math.min(...poly.map((a,i)=>pointSegmentDistance(p,a,poly[(i+1)%poly.length])));
function segmentsCross(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));}
export function polygonsDistance(a,b){
 if(pointInside(a[0],b)||pointInside(b[0],a))return 0;
 let d=Infinity;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
  if(segmentsCross(p,q,r,s))return 0;
  d=Math.min(d,pointSegmentDistance(p,r,s),pointSegmentDistance(q,r,s),pointSegmentDistance(r,p,q),pointSegmentDistance(s,p,q));
 }return d;
}
export function transformFootprint(points,{position,yaw,scale}){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return points.map(([x,z])=>[position[0]+scale*(c*x+s*z),position[2]+scale*(-s*x+c*z)]);
}
export function pineRootReservations(placement){
 const ref=yangquelongUnderstoreyRootReference;
 const polygons=ref.rootBounds.map(({min:a,max:b})=>transformFootprint([[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]]],placement));
 polygons.push(transformFootprint(Array.from({length:48},(_,i)=>[Math.cos(i/48*Math.PI*2)*ref.trunkClearRadius,Math.sin(i/48*Math.PI*2)*ref.trunkClearRadius]),placement));
 return {polygons,clearance:ref.canopyToRootClearance,source:ref.source,sourceSha256:ref.sourceSha256,method:'Conservative actual full-root vertex rectangles plus trunk collar, transformed by the unchanged full-size pine pose.'};
}
export function sourceFootprints(sourceOwner){
 const out=new Map(),v=new THREE.Vector3();
 sourceOwner.assertCurrent();sourceOwner.group.updateMatrixWorld(true);
 for(const [id,source] of sourceOwner.variants){
  const points=[];
  for(const mesh of source.meshes){const a=mesh.geometry.attributes.position;
   for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);points.push([v.x,v.z]);}
  }
  const hull=convexHull(points),radius=Math.max(...hull.map(p=>Math.hypot(...p)));
  out.set(id,{id,hull,radius,height:source.diagnostics.bounds.max[1],maximumHeight:source.diagnostics.maximumHeight??.73,bounds:source.diagnostics.bounds});
 }return out;
}

const profiles=[
 {id:'west-north',seed:19841,shift:.02},
 {id:'west-south',seed:62591,shift:-.06},
 {id:'east-north',seed:90971,shift:.09},
 {id:'east-south',seed:41281,shift:-.04},
].map(p=>({...p,
 white:[[-.49,-.58],[.47,-.02],[-.48,.73]],
 lilac:[[-.13,-.53],[.51,.72]],
 sage:[[-.49,-.27],[.47,-.69],p.id==='east-north'?[.58,.49]:p.id==='west-north'?[.60,.17]:[.52,.29]],
 grass:[[.28,-.40],p.id==='east-south'?[-.56,-.10]:[-.54,.22],[.60,.60]],
}));
export const yangquelongUnderstoreyLayoutSpec=Object.freeze({
 id:'yangquelong-understorey-layout-r5',evidence:'contemporary-museum-landscape-design',historicalPlanting:false,
 maximumHeight:1.08,edgingCanopyClearance:.16,targetCanopyFootprintFraction:.72,coverageGridMetres:.12,
 note:'Unequal olive groups leave readable broad-leaf and grass shoulders around the unchanged root reserve; 72% canopy envelopes are a composition target, not measured visible greenery or art acceptance.',
});
function bedFrame(bed){
 const xs=bed.inner.map(p=>p[0]),zs=bed.inner.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
 const cx=(xmin+xmax)/2,cz=(zmin+zmax)/2,hx=(xmax-xmin)/2,hz=(zmax-zmin)/2,sign=cz<0?-1:1;
 return {xmin,xmax,zmin,zmax,cx,cz,hx,hz,sign,point:([u,v])=>[cx+u*hx,cz+sign*v*hz]};
}
function driftFields(frame,profile){
 const shift=profile.shift;
 const definitions=[
  {family:'olive',radius:1.40,points:[[.43,-.80],[.27+shift,-.44],[.51,-.04],[.54,.37],[.43,.78]]},
  {family:'olive',radius:1.33,points:[[-.53,-.78],[-.49,-.35],[-.51,.09],[-.50,.48],[-.43,.81]]},
  {family:'olive',radius:1.42,points:[[-.44,-.72],[-.04,-.50],[.38,-.27]]},
  {family:'olive',radius:1.20,points:[[-.10,-.14],[.17,.04],[.43,.17]]},
  {family:'olive',radius:1.20,points:[[-.44,.81],[.04,.80],[.49,.78]]},
 ];
 return definitions.map((def,index)=>{
  const points=def.points.map(p=>frame.point(p)),curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  const samples=Array.from({length:49},(_,i)=>{const p=curve.getPointAt(i/48);return [p.x,p.z];});
  return {...def,index,points,samples};
 });
}
function nearestDrift(point,fields){
 let best=null;for(const d of fields){
  const distance=Math.min(...d.samples.slice(1).map((p,i)=>pointSegmentDistance(point,d.samples[i],p)));
  const ratio=distance/d.radius;if(!best||ratio<best.ratio)best={...d,distance,ratio};
 }return best;
}
function coverageGrid(bed,frame,step){
 const width=Math.ceil((frame.xmax-frame.xmin)/step),height=Math.ceil((frame.zmax-frame.zmin)/step),inside=new Uint8Array(width*height),filled=new Uint8Array(width*height);let total=0,count=0;
 for(let iz=0;iz<height;iz++)for(let ix=0;ix<width;ix++){const p=[frame.xmin+(ix+.5)*step,frame.zmin+(iz+.5)*step];if(pointInside(p,bed.inner)){inside[iz*width+ix]=1;total++;}}
 return {add(poly){
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
  const a=Math.max(0,Math.floor((Math.min(...xs)-frame.xmin)/step)),b=Math.min(width-1,Math.ceil((Math.max(...xs)-frame.xmin)/step)),c=Math.max(0,Math.floor((Math.min(...zs)-frame.zmin)/step)),d=Math.min(height-1,Math.ceil((Math.max(...zs)-frame.zmin)/step));
  for(let iz=c;iz<=d;iz++)for(let ix=a;ix<=b;ix++){const k=iz*width+ix;if(inside[k]&&!filled[k]&&pointInside([frame.xmin+(ix+.5)*step,frame.zmin+(iz+.5)*step],poly)){filled[k]=1;count++;}}
 },get fraction(){return count/total;},get area(){return count*step*step;},get cells(){return {inside:total,covered:count,width,height,step};}};
}
export function inspectUnderstoreyPlacement(placement,footprint,bed,reservations){
 const hull=transformFootprint(footprint.hull,placement),inside=hull.every(p=>pointInside(p,bed.inner));
 const edge=inside?Math.min(...hull.map(p=>pointEdgeDistance(p,bed.inner))):-1;
 const root=Math.min(...reservations.polygons.map(p=>polygonsDistance(hull,p)));
 return {valid:inside&&edge>=yangquelongUnderstoreyLayoutSpec.edgingCanopyClearance-1e-9&&root>=reservations.clearance-1e-9&&placement.scale*footprint.height<=Math.min(footprint.maximumHeight??yangquelongUnderstoreyLayoutSpec.maximumHeight,yangquelongUnderstoreyLayoutSpec.maximumHeight)+1e-9,
  inside,edgeClearance:edge,rootClearance:root,maximumHeight:placement.scale*footprint.height,hull};
}

/** Seeded detail is confined to explicitly drawn connected drifts sampled
 * inside the actual convex bed polygons. Colour belongs to a drift or flower
 * pocket, never an independent random per-plant decoration. */
export function createYangquelongUnderstoreyLayout(sourceOwner,{bedIds=profiles.map(p=>p.id),groundSpec=yangquelongBedGroundSpec,gardenLayout=yangquelongGardenLayout}={}){
 fail(bedIds.length&&new Set(bedIds).size===bedIds.length&&bedIds.every(id=>profiles.some(p=>p.id===id)),'unique known beds required');
 const footprints=sourceFootprints(sourceOwner),placements=[],beds=[];
 for(const id of bedIds){
  const profile=profiles.find(p=>p.id===id),bed=groundSpec.beds.find(b=>b.id===id),pine=gardenLayout.placements.find(p=>p.bed===id);
  fail(bed?.inner.length===8&&pine?.scale===1&&pine.position[1]===groundSpec.soilTop,'actual inner octagon and unscaled pine root datum required');
  const frame=bedFrame(bed),reservations=pineRootReservations(pine),fields=driftFields(frame,profile),rng=seededGardenRandom(profile.seed),local=[],grid=coverageGrid(bed,frame,yangquelongUnderstoreyLayoutSpec.coverageGridMetres);
  function add(type,point,kind,scale,yaw){
   const fp=footprints.get(type);fail(fp,'missing source '+type);
   const p={id:id+'-understorey-'+String(local.length+1).padStart(3,'0'),bed:id,sourceId:type,kind,position:[point[0],groundSpec.soilTop,point[1]],yaw,scale};
   const check=inspectUnderstoreyPlacement(p,fp,bed,reservations);if(!check.valid)return false;
   const radius=fp.radius*scale;
   if(local.some(q=>{
    const accent=kind.startsWith('evergreen')&&(q.sourceId.startsWith('sage')||q.sourceId==='sedge');
    const spacing=accent?.76:q.kind===kind&&kind.includes('pocket')?.29:.41;
    return Math.hypot(q.position[0]-point[0],q.position[2]-point[1])<spacing*(radius+footprints.get(q.sourceId).radius*q.scale);
   }))return false;
   local.push(p);grid.add(check.hull);return true;
  }
  // Named accents are planted first as small uneven groups. The olive
  // matrix leaves their actual broad-leaf and grass centres legible.
  for(const [family,anchors,count] of [['ivory',profile.white,3],['lilac',profile.lilac,3],['sage',profile.sage,3],['sedge',profile.grass,1]]){
   for(let pocket=0;pocket<anchors.length;pocket++){
    const anchor=frame.point(anchors[pocket]),kind=family+'-pocket-'+pocket;
    for(let n=0;n<count;n++){
     const type=family==='sage'?'sage-'+(pocket%2?'b':'a'):family;
     const angle=n*2.399963+pocket*.7,reach=n?Math.sqrt(n)*(family==='sage'?.37:.41):0;
     const point=[anchor[0]+Math.cos(angle)*reach,anchor[1]+Math.sin(angle)*reach];
     // Search only within this authored pocket if an exact footprint conflicts.
     for(let trial=0;trial<15;trial++){
      const turn=trial*2.399963,offset=trial?.07*Math.sqrt(trial):0;
      if(add(type,[point[0]+Math.cos(turn)*offset,point[1]+Math.sin(turn)*offset],kind,.93+rng()*.07,rng()*Math.PI*2))break;
     }
    }
   }
  }
  // Triangulate the actual bed, not its rectangle, for deterministic
  // blue-noise candidates. Two drifting evergreen families connect pockets.
  const fan=bed.inner.slice(1,-1).map((p,i)=>[bed.inner[0],p,bed.inner[i+2]]);
  const weights=fan.map(t=>polygonArea(t)),sum=weights.reduce((a,b)=>a+b,0);
  for(let attempt=0;attempt<16000&&grid.fraction<yangquelongUnderstoreyLayoutSpec.targetCanopyFootprintFraction;attempt++){
   let selector=rng()*sum,k=0;while(k<weights.length-1&&selector>weights[k])selector-=weights[k++];
   const [a,b,c]=fan[k],s=Math.sqrt(rng()),t=rng(),point=[(1-s)*a[0]+s*(1-t)*b[0]+s*t*c[0],(1-s)*a[1]+s*(1-t)*b[1]+s*t*c[1]];
   const drift=nearestDrift(point,fields);if(drift.ratio>1+.07*Math.sin(point[1]*1.9+point[0]*2.3))continue;
   const taller=[[-.48,-.76],[.49,.39],[-.48,.79]].some(p=>{const q=frame.point(p);return Math.hypot(q[0]-point[0],q[1]-point[1])<.78;});
   // Two narrow waist openings interrupt the camera-facing olive edge.
   // Existing accents still occupy these zones; this only excludes filler.
   const u=(point[0]-frame.cx)/frame.hx,v=(point[1]-frame.cz)/(frame.sign*frame.hz);
   const waist=u<-.40&&((v>-.13&&v<-.045)||(v>.40&&v<.47));
   if(waist)continue;
   const type=taller?'olive-b':'olive-a';
   // Slight size differences are authored herbs; full accepted pines remain scale 1.
   const scale=.91+rng()*.09,yaw=Math.atan2(drift.samples.at(-1)[0]-drift.samples[0][0],drift.samples.at(-1)[1]-drift.samples[0][1])+(rng()-.5)*1.25;
   add(type,point,'evergreen-drift-'+drift.index,scale,yaw);
  }
  placements.push(...local);
  const checks=local.map(p=>inspectUnderstoreyPlacement(p,footprints.get(p.sourceId),bed,reservations));
  const counts={};for(const p of local)counts[p.sourceId]=(counts[p.sourceId]??0)+1;
  beds.push({id,soilTop:groundSpec.soilTop,inner:bed.inner,pinePlacement:pine,rootReservation:reservations,fields:fields.map(({family,radius,points})=>({family,radius,points})),
   plants:local.length,counts,soilArea:polygonArea(bed.inner),canopyHullCoverageFraction:grid.fraction,canopyHullCoveredArea:grid.area,coverageGrid:grid.cells,
   pockets:[...new Set(local.filter(p=>p.kind.includes('pocket')).map(p=>p.kind))].map(kind=>({kind,plants:local.filter(p=>p.kind===kind).map(p=>p.id)})),
   minimumEdgeClearance:Math.min(...checks.map(c=>c.edgeClearance)),minimumRootClearance:Math.min(...checks.map(c=>c.rootClearance)),maximumHeight:Math.max(...checks.map(c=>c.maximumHeight)),
  });
 }
 return {id:yangquelongUnderstoreyLayoutSpec.id,evidence:yangquelongUnderstoreyLayoutSpec.evidence,historicalPlanting:false,
  nativeReviewed:false,placements,beds,footprints,coverageMethod:'Union of transformed actual-geometry convex hulls on a 0.12 m bed grid. Empty holes between leaves are NOT counted by this canopy-envelope measure.'};
}
