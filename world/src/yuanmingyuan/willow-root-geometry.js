import {Float32BufferAttribute,CatmullRomCurve3,Vector3,MathUtils} from 'three';
import {WillowBarkGeometryBatch,assertWillowHeight,sampleWillowBarkHeight,sampleWillowHeight} from './willow-bark-geometry.js';

export const willowRootRefinementSpec=Object.freeze({
 id:'willow-root-continuum-r5',joinHeightMetres:1.46,bottomMetres:-.58,
 physicalTileMetres:1,maximumPhotographicReliefMetres:.008,
 form:'one closed trunk with rounded asymmetric root shoulders, descending swept root volumes and a fully buried footprint return',
 uv:'root-local metric arc charts blended consistently across color, roughness and height',
 historicalIndividual:false,measuredRootDimensions:false,nativeArtPassed:false,
});
const TAU=Math.PI*2;
const smooth=(a,b,x)=>MathUtils.smoothstep(x,a,b);
const ease=x=>{x=MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const v=new Vector3(),a=new Vector3(),b=new Vector3();

/** Replaces the lower trunk and six intersecting root tubes with one closed
 * loft. No leaf/growth RNG is touched. The original trunk above the join,
 * including its UV, normals and photographic relief, remains byte-identical. */
export function reshapeWillowRootContinuum(geometry,rootRecords,height){
 assertWillowHeight(height);
 const trunk=geometry.userData.branchRecords?.[0],{segments,radialSegments}=trunk??{};
 if(!trunk?.isTrunk||rootRecords.length!==6||geometry.userData.branchRecords.length!==1)throw new Error('The original single trunk and all six root records are required.');
 const stride=radialSegments+1,body=(segments+1)*stride,original={};
 for(const key of ['position','normal','uv','willowBarkCircumference'])original[key]=geometry.attributes[key].array.slice();
 if(geometry.attributes.position.count!==body+2*stride)throw new Error('Original closed trunk topology changed.');
 const curve=new CatmullRomCurve3(trunk.controlPoints.map(p=>new Vector3(...p)),false,'centripetal'),frames=curve.computeFrenetFrames(segments,false);
 const centres=Array.from({length:segments+1},(_,row)=>curve.getPointAt(row/segments));
 const join=centres.findIndex(p=>p.y>=willowRootRefinementSpec.joinHeightMetres);
 if(join<2)throw new Error('Willow root transition does not fit the original lower trunk.');
 const top=centres[join],topTangent=curve.getTangentAt(join/segments),joinY=top.y;
 // Unequal reach, shoulder height and physical width are authored here.
 // Directions/bends come from the six actual original root control polylines.
 const reaches=[1.04,1.47,.96,1.28,.87,1.34],heights=[.60,.82,.55,.74,.53,.70],widths=[.215,.315,.19,.275,.18,.265];
 const roots=rootRecords.map((r,i)=>{
  const first=r.controlPoints[0],last=r.controlPoints.at(-1);
  return {originalControlPoints:r.controlPoints.map(p=>[...p]),angle:Math.atan2(last[2],last[0]),startAngle:Math.atan2(first[2],first[0]),
   reach:reaches[i],shoulder:heights[i],halfWidth:widths[i],angularWidth:[.18,.24,.17,.215,.165,.21][i],
   bend:[-.07,.10,.05,-.085,.07,-.04][i],tipCrownY:[-.45,-.47,-.44,-.46,-.43,-.48][i],
   role:[1,3,5].includes(i)?'primary':'secondary'};
 });
 // A sequence of strongly overlapping elliptical domes describes each rounded
 // root. Each dome extends vertically down to the buried return, so a broad root
 // cannot turn back into an exposed, hollow-looking fin underneath its shoulder.
 // The original six directions seed the paths; no global growth RNG is consumed.
 const sweepSteps=96;
 const sweeps=roots.map(root=>Array.from({length:sweepSteps+1},(_,j)=>{
  const t=j/sweepSteps,d=.24+(root.reach-.24)*t;
  const angle=root.startAngle+angleDelta(root.angle,root.startAngle)*smooth(0,.88,t)+root.bend*Math.sin(Math.PI*t);
  const crown=root.shoulder*Math.pow(1-t,1.6)+root.tipCrownY*smooth(.52,1,t);
  const vertical=.085+root.halfWidth*.95*(1-t),width=root.halfWidth*(1-.48*t);
  return {x:Math.cos(angle)*d,z:Math.sin(angle)*d,y:crown-vertical,vertical,width};
 }));
 const roundUnion=(x,y,k)=>{const h=Math.max(k-Math.abs(x-y),0)/k;return Math.max(x,y)+h*h*k*.25;};
 const base=Float64Array.from(original.position),oldBase=new Float64Array((join+1)*stride*3),weights=new Float64Array(join+1),uv=original.uv.slice(),circumference=original.willowBarkCircumference.slice();
 const rootChart=new Float32Array(geometry.attributes.position.count*3),rowArcs=[],rowDirections=[],rowAngles=[];
 let maxUError=0,maxOffset=0,maxJoinDifference=0;
 for(let row=0;row<=join;row++){
  const t=row/segments,point=centres[row],span=curve.getUtoTmapping(t)*(trunk.radii.length-1),i=Math.min(trunk.radii.length-2,Math.floor(span));
  const radius=MathUtils.lerp(trunk.radii[i],trunk.radii[i+1],span-i);
  const blend=1-ease((point.y-.26)/(joinY-.26));weights[row]=blend;
  const y=point.y-(Math.abs(willowRootRefinementSpec.bottomMetres)-.16)*(1-smooth(-.16,.82,point.y));
  const s=MathUtils.clamp(y/joinY,0,1),h01=-2*s*s*s+3*s*s,h11=s*s*s-s*s;
  const cx=h01*top.x+h11*joinY*topTangent.x/topTangent.y,cz=h01*top.z+h11*joinY*topTangent.z/topTangent.y;
  const core=.432+.074*Math.exp(-Math.pow(Math.max(y,0)/.62,1.65));
  const directions=roots.map(root=>root.startAngle+angleDelta(root.angle,root.startAngle)*(1-smooth(-.16,.75,y)));
  rowDirections[row]=directions;rowAngles[row]=new Float64Array(stride);
  const sections=sweeps.map(sweep=>sweep.map(p=>{
   const above=Math.max(0,(y-p.y)/p.vertical);
   return above>=1?null:{x:p.x-cx,z:p.z-cz,r2:p.width*p.width*(1-above*above)};
  }).filter(Boolean));
  for(let side=0;side<=radialSegments;side++){
   const angle=side/radialSegments*TAU,offset=(row*stride+side)*3;
   a.copy(frames.normals[row]).multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[row],Math.sin(angle));
   const flute=Math.sin(angle*9+t*3.2)*.58+Math.sin(angle*17-t*12)*.23+Math.sin(t*75+angle*3)*.18;
   b.copy(point).addScaledVector(a,radius*(1+.07*flute));oldBase.set(b.toArray(),offset);
   const theta=Math.atan2(a.z,a.x);rowAngles[row][side]=theta;
   let r=core;
   const ux=Math.cos(theta),uz=Math.sin(theta);
   for(const section of sections){
    let extent=0;
    for(const disk of section){
     const along=disk.x*ux+disk.z*uz,across=disk.x*uz-disk.z*ux,inside=disk.r2-across*across;
     if(inside>0)extent=Math.max(extent,along+Math.sqrt(inside));
    }
    r=roundUnion(r,extent,.065);
   }
   r+=(.017*Math.sin(theta*9+y*.85)+.009*Math.sin(theta*17-y*1.2))*smooth(-.58,-.1,y);
   v.set(cx+Math.cos(theta)*r,y,cz+Math.sin(theta)*r);
   b.lerp(v,blend);base.set(b.toArray(),offset);
  }
  // Duplicate chart seam is identical in geometry, not merely close.
  base.set(base.slice(row*stride*3,row*stride*3+3),(row*stride+radialSegments)*3);
  let arc=0;rowArcs[row]=new Float64Array(stride);
  for(let side=0;side<=radialSegments;side++){
   const index=row*stride+side;
   if(side){const prev=index-1;arc+=Math.hypot(base[index*3]-base[prev*3],base[index*3+1]-base[prev*3+1],base[index*3+2]-base[prev*3+2]);}
   rowArcs[row][side]=arc;
   if(row<join)uv[index*2]=arc;
  }
  if(row<join)for(let side=0;side<=radialSegments;side++)circumference[row*stride+side]=arc;
 }
 // Longitudinal texture distance follows the flared surface, anchored without
 // a phase jump to each original join vertex. Provider width is one metre.
 for(let side=0;side<=radialSegments;side++){
  let distance=original.uv[(join*stride+side)*2+1];
  for(let row=join-1;row>=0;row--){
   const i=row*stride+side,j=i+stride;
   distance-=Math.hypot(base[i*3]-base[j*3],base[i*3+1]-base[j*3+1],base[i*3+2]-base[j*3+2]);
   uv[i*2+1]=distance;
  }
 }
 // Each root's transverse coordinate is measured from its own ridge axis,
 // not the accumulated perimeter of all preceding roots. Influences end before
 // chart boundaries, so no discontinuous UV is ever sampled at positive weight.
 function axisArc(row,direction){
  let best=0,error=Infinity;
  for(let side=0;side<radialSegments;side++){
   const d=Math.abs(angleDelta(rowAngles[row][side],direction));if(d<error){best=side;error=d;}
  }
  const left=(best+radialSegments-1)%radialSegments,right=(best+1)%radialSegments;
  let neighbour=Math.abs(angleDelta(rowAngles[row][left],direction))<Math.abs(angleDelta(rowAngles[row][right],direction))?left:right;
  const d0=angleDelta(rowAngles[row][best],direction),d1=angleDelta(rowAngles[row][neighbour],direction);
  if(d0*d1>0)return rowArcs[row][best];
  let u1=rowArcs[row][neighbour],u0=rowArcs[row][best],c=rowArcs[row][radialSegments];
  if(u1-u0>c/2)u1-=c;if(u0-u1>c/2)u1+=c;
  return u0+(u1-u0)*Math.abs(d0)/(Math.abs(d0)+Math.abs(d1));
 }
 const anchors=roots.map((root,k)=>axisArc(join,rowDirections[join][k]));
 const joinCircumference=original.willowBarkCircumference[join*stride];
 for(let row=0;row<join;row++){
  const total=rowArcs[row][radialSegments],axes=roots.map((root,k)=>axisArc(row,rowDirections[row][k]));
  for(let side=0;side<=radialSegments;side++){
   const index=row*stride+side,offset=index*3,y=base[offset+1],theta=rowAngles[row][side];
   let chosen=0,error=Infinity;
   for(let k=0;k<roots.length;k++){const d=Math.abs(angleDelta(theta,rowDirections[row][k]));if(d<error){error=d;chosen=k;}}
   const nearestGap=Math.min(...roots.map((root,k)=>k===chosen?Infinity:Math.abs(angleDelta(rowDirections[row][chosen],rowDirections[row][k]))));
   const outer=Math.min(nearestGap*.41,roots[chosen].angularWidth*3.4),inner=Math.min(outer*.55,roots[chosen].angularWidth*1.7);
   const chartWeight=(1-smooth(inner,outer,error))*(1-smooth(.34,.92,y))*smooth(-.58,-.42,y);
   let transverse=rowArcs[row][side]-axes[chosen];
   if(transverse>total/2)transverse-=total;if(transverse<-total/2)transverse+=total;
   rootChart.set([anchors[chosen]+transverse,uv[index*2+1],chartWeight],offset);
   // Between the roots use the compact core's inherited chart phase. The
   // root-local metric chart handles the additional surface width of each ridge.
   uv[index*2]=original.uv[index*2]*(1-weights[row])+original.uv[(join*stride+side)*2]*weights[row];
   circumference[index]=original.willowBarkCircumference[index]*(1-weights[row])+joinCircumference*weights[row];
  }
  rootChart.set(rootChart.slice(row*stride*3,row*stride*3+3),(row*stride+radialSegments)*3);
 }
 // The bottom cap is a buried closed return. There is no exposed cut plane.
 base.set([0,willowRootRefinementSpec.bottomMetres,0],body*3);
 for(let side=0;side<radialSegments;side++)base.set(base.slice(side*3,side*3+3),(body+1+side)*3);
 const temporary=geometry.clone();
 try{
  temporary.setAttribute('position',new Float32BufferAttribute(base,3));temporary.computeVertexNormals();
  const normals=temporary.attributes.normal,positions=original.position.slice();
  for(let row=0;row<join;row++)for(let side=0;side<=radialSegments;side++){
   const index=row*stride+side,offset=index*3,blend=weights[row];
   a.fromBufferAttribute(normals,index);
   if(side===0||side===radialSegments){
    a.fromBufferAttribute(normals,row*stride).add(b.fromBufferAttribute(normals,row*stride+radialSegments)).normalize();
   }
   const envelope=smooth(0,.075,base[offset+1]-willowRootRefinementSpec.bottomMetres);
   const baseHeight=sampleWillowBarkHeight(height,uv[index*2],uv[index*2+1],circumference[index]);
   const localHeight=sampleWillowHeight(height,rootChart[offset],rootChart[offset+1]);
   const relief=(MathUtils.lerp(baseHeight,localHeight,rootChart[offset+2])-.5)*.016*envelope;
   const dx=(original.position[offset]-oldBase[offset])*(1-blend)+a.x*relief*blend;
   const dy=(original.position[offset+1]-oldBase[offset+1])*(1-blend)+a.y*relief*blend;
   const dz=(original.position[offset+2]-oldBase[offset+2])*(1-blend)+a.z*relief*blend;
   positions.set([base[offset]+dx,base[offset+1]+dy,base[offset+2]+dz],offset);
   maxOffset=Math.max(maxOffset,Math.hypot(dx,dy,dz));
  }
  for(let row=0;row<join;row++){
   positions.set(positions.slice(row*stride*3,row*stride*3+3),(row*stride+radialSegments)*3);
   for(let side=1;side<=radialSegments;side++){
    const i=row*stride+side,j=i-1,d=Math.hypot(base[i*3]-base[j*3],base[i*3+1]-base[j*3+1],base[i*3+2]-base[j*3+2]);
    if(rootChart[i*3+2]>.999&&rootChart[j*3+2]>.999)maxUError=Math.max(maxUError,Math.abs((rootChart[i*3]-rootChart[j*3])-d));
   }
  }
  positions.set([0,willowRootRefinementSpec.bottomMetres,0],body*3);uv.set([0,0],body*2);
  for(let side=0;side<radialSegments;side++){
   positions.set(positions.slice(side*3,side*3+3),(body+1+side)*3);
   uv.set([positions[side*3],positions[side*3+2]],(body+1+side)*2);
  }
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  geometry.setAttribute('willowBarkCircumference',new Float32BufferAttribute(circumference,1));
  geometry.setAttribute('willowRootChart',new Float32BufferAttribute(rootChart,3));geometry.computeVertexNormals();
  const n=geometry.attributes.normal;
  for(let row=0;row<join;row++){
   a.fromBufferAttribute(n,row*stride).add(b.fromBufferAttribute(n,row*stride+radialSegments)).normalize();
   n.setXYZ(row*stride,a.x,a.y,a.z);n.setXYZ(row*stride+radialSegments,a.x,a.y,a.z);
  }
  // Preserve the original upper barrel and top-cap normals exactly.
  n.array.set(original.normal.subarray(join*stride*3,body*3),join*stride*3);
  n.array.set(original.normal.subarray((body+stride)*3),(body+stride)*3);
  for(let i=join*stride*3;i<body*3;i++)maxJoinDifference=Math.max(maxJoinDifference,Math.abs(positions[i]-original.position[i]));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...geometry.userData,barkRevision:willowRootRefinementSpec.id,
   branchRecords:[{...trunk,body:'continuous-willow-trunk-and-rounded-root-volumes',rootContinuum:willowRootRefinementSpec.id,originalRootCount:6}],
   rootContinuum:{...willowRootRefinementSpec,joinRow:join,actualJoinHeight:joinY,radialSegments,segments,sourceRootRecords:rootRecords,
    roots,sweepSteps,shapeConstruction:'overlapping rounded descending elliptical crowns with buried vertical return',buriedFootprintReturn:true,maximumPhysicalUError:maxUError,actualMaximumReliefOffsetMetres:maxOffset,upperBarrelPositionDifference:maxJoinDifference,
    rootMetricCharts:true,rootChartAttribute:'willowRootChart',chartBlendMatchesGeometricHeight:true,
    originalRootTubeTriangles:rootRecords.reduce((n,r)=>n+r.triangles,0),rootTubeCapsReplaced:true,closedSourceTopologyRetained:true}};
  return geometry;
 }finally{temporary.dispose();}
}

/** Owns no maps. The source's existing map owner outlives this synchronous
 * remeshing step and all borrowed regional views. Temporary input tubes are
 * still disposed once by VegetationBuilder.branch after add returns. */
export function createWillowRootGeometryBatch(height){
 assertWillowHeight(height);
 return class WillowRootGeometryBatch extends WillowBarkGeometryBatch{
  constructor(name){super(name);this.rootInputs=[];}
  add(geometry,matrix,tint){
   if(this.name==='willow-trunk-and-roots'&&geometry.userData.isRoot){
    this.rootInputs.push({...geometry.userData,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3});
    return;
   }
   return super.add(geometry,matrix,tint);
  }
  finish(){
   const geometry=super.finish();
   if(this.name!=='willow-trunk-and-roots')return geometry;
   try{return reshapeWillowRootContinuum(geometry,this.rootInputs,height);}
   catch(error){geometry.dispose();throw error;}
   finally{this.rootInputs=[];}
  }
 };
}
