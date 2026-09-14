import {repairWarpTriangulation} from './xieqiqu-stone-fish-pool-r4-triangulation.js';
import * as THREE from 'three';

const check=(ok,message)=>{if(!ok)throw new Error('Stone fish wave R5: '+message);};
const smooth=THREE.MathUtils.smoothstep,lerp=THREE.MathUtils.lerp,TAU=Math.PI*2;

const smoothMin=(a,b,k)=>{const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return lerp(b,a,h)-k*h*(1-h);};

// One continuous ocean-wave section. Its broad rising back carries the rolled
// lip; it is not a tube appended to an independent pedestal. The section and
// all placements below are authored carving, not measured historical details.
function waveProfile(bottomY,waterY,scale){
  const points=[[-.24*scale,bottomY-.04]],v=(x,y)=>new THREE.Vector3(x*scale,waterY+y*scale,0);
  const curve=(a,b,end)=>{const last=points.at(-1),c=new THREE.CubicBezierCurve3(new THREE.Vector3(last[0],last[1],0),a,b,end);for(let i=1;i<=24;i++){const p=c.getPoint(i/24);points.push([p.x,p.y]);}};
  curve(new THREE.Vector3(-.25*scale,bottomY*.55,0),v(-.405,-.075),v(-.38,-.002));
  curve(v(-.34,.04),v(-.22,.19),v(-.14,.25));
  curve(v(-.09,.33),v(.07,.35),v(.18,.30));
  curve(v(.30,.25),v(.33,.14),v(.24,.08));
  curve(v(.218,.067),v(.199,.079),v(.215,.101));
  curve(v(.253,.15),v(.234,.21),v(.176,.224));
  curve(v(.095,.241),v(.057,.151),v(.058,.076));
  curve(v(.06,-.03),v(.14,-.09),new THREE.Vector3(.25*scale,bottomY-.04,0));
  return points;
}

function profileDistanceGrid(polygon){
  const x0=-.47,x1=.39,y0=Math.min(...polygon.map(p=>p[1]))-.035,y1=Math.max(...polygon.map(p=>p[1]))+.045,step=.0025,nx=Math.ceil((x1-x0)/step),ny=Math.ceil((y1-y0)/step),sx=nx+1,values=new Float32Array((nx+1)*(ny+1));
  const exact=(x,y)=>{let d=Infinity,inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i],vx=b[0]-a[0],vy=b[1]-a[1],px=x-a[0],py=y-a[1],t=Math.max(0,Math.min(1,(px*vx+py*vy)/(vx*vx+vy*vy))),dx=px-vx*t,dy=py-vy*t;d=Math.min(d,dx*dx+dy*dy);
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return Math.sqrt(d)*(inside?-1:1);};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)values[i+sx*j]=exact(lerp(x0,x1,i/nx),lerp(y0,y1,j/ny));
  return {sample(x,y){const a=(x-x0)/(x1-x0)*nx,b=(y-y0)/(y1-y0)*ny;if(a<0||b<0||a>=nx||b>=ny)return .035+Math.hypot(Math.max(x0-x,0,x-x1),Math.max(y0-y,0,y-y1));const i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j,k=i+sx*j;return lerp(lerp(values[k],values[k+1],u),lerp(values[k+sx],values[k+sx+1],u),v);},bytes:values.byteLength};
}

function boundaryLoops(indices,positions,y){
  const next=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3];if(positions[a*3+1]===Math.fround(y)&&positions[b*3+1]===Math.fround(y)){check(!next.has(a),'branched horizontal boundary');next.set(a,b);}}
  const loops=[];while(next.size){const first=next.keys().next().value,loop=[];let at=first;do{check(next.has(at),'open horizontal boundary');loop.push(at);const n=next.get(at);next.delete(at);at=n;}while(at!==first);loops.push(loop);}return loops;
}

/** A bounded, single-seat geometry operation. Only the authored wave mass is
 * sampled; the original contact cap and every source fish attribute stay exact.
 * Three thick wave sections fuse continuously into their internal bearing.
 * R5 changes only authored material below the exact cap and 10 mm collar.
 * It remains a modern artistic inference, never a measured historical carving. */
export function createStoneFishCarvedWaveR5({contactGeometry,contactInfo,bottomY,waterY,bodyMinimumY,worldScale=1,spacing=.008}={}){
  check([bottomY,waterY,bodyMinimumY,worldScale,spacing].every(Number.isFinite)&&worldScale>0&&spacing>=.003&&spacing<=.025&&bottomY<waterY&&waterY<bodyMinimumY-.03,'finite original pool levels, positive scale and bounded spacing required');
  const capLoop=contactBoundary(contactGeometry,contactInfo),source=contactGeometry.attributes.position,n=contactInfo.sourceVertices,roofCount=contactInfo.sourceTriangles*3,safeY=bodyMinimumY-.018;
  const centre=new THREE.Vector2();for(const id of capLoop)centre.add(new THREE.Vector2(source.getX(id),source.getZ(id)));centre.multiplyScalar(1/capLoop.length);
  const capHeightAt=contactHeightSampler(contactGeometry,roofCount/3),xs=capLoop.map(i=>source.getX(i)),zs=capLoop.map(i=>source.getZ(i)),headX=Math.min(centre.x-Math.min(...xs),Math.max(...xs)-centre.x)*.78,headZ=Math.min(centre.y-Math.min(...zs),Math.max(...zs)-centre.y)*.80;
  const specs=[
    {id:'forward-rising-wave',x:.025,z:-.030,angle:.14,scale:1.02,drop:0,width:.150},
    {id:'rear-crossing-wave',x:-.025,z:.415,angle:.22,scale:.73,drop:.012,width:.130},
    {id:'returning-side-wave',x:.005,z:-.390,angle:2.72,scale:.62,drop:.025,width:.118},
  ];
  const profiles=specs.map(s=>profileDistanceGrid(waveProfile(bottomY,waterY-s.drop,s.scale)));
  const waveDistance=(i,x,y,z)=>{
    const s=specs[i],anchor=1-.18*smooth(waterY-y,.03,waterY-bottomY),c=Math.cos(s.angle),a=Math.sin(s.angle),dx=x-centre.x-s.x*anchor,dz=z-centre.y-s.z*anchor,u=dz*c+dx*a,lateral=dx*c-dz*a,bulge=.037*Math.sin((y-waterY)*7+.6)+.020*Math.sin(u*6),width=s.width*(.77+.23*smooth(y,waterY-.12,waterY+.22))+.009*Math.sin(u*11+(y-waterY)*8);
    // A smooth domain warp bends the crest axis and varies its cross section
    // across its width. At and below water + 50 mm it is exactly R4's field.
    const q=THREE.MathUtils.clamp((lateral-bulge)/width,-1.1,1.1),edge=smooth(Math.abs(q+.10),.20,1.10),gate=smooth(y,waterY+.050,waterY+.150),taper=1-.10*edge,blend=1+gate*(taper-1),crown=(.022*(1-edge)-.008*edge+.004*q)*s.scale,bow=(.032*(1-q*q)+.029*q+.006*Math.sin(Math.PI*q))*s.scale,rise=.022*s.scale*smooth(y-waterY,.070,.290)*smooth(-u,0,.300*s.scale),profileY=(y-gate*((1-taper)*(waterY+.170)+crown))/blend,profileU=(u-gate*((1-taper)*(.135*s.scale)+bow+rise))/blend;
    const d=profiles[i].sample(profileU,profileY),flowRelief=.0055*Math.sin((d+.025)*TAU/.090)*(1-smooth(d,-.015,.010))*smooth(y,waterY-.07,waterY+.035),w=Math.abs(lateral-bulge)-width*(1-.07*gate)-flowRelief;return Math.hypot(Math.max(d,0),Math.max(w,0))+Math.min(Math.max(d,w),0)-.009;
  };
  const coreDistance=(x,y,z)=>{
    const t=smooth(safeY-y,0,safeY-waterY),below=smooth(waterY-y,0,waterY-bottomY),rx=lerp(headX,.078,t)+.020*Math.sin(Math.PI*t)+.012*below,rz=lerp(headZ,.230,t)+.035*Math.sin(Math.PI*t)+.028*below,cx=centre.x-.052*Math.sin(Math.PI*t),cz=centre.y+.090*Math.sin(Math.PI*t);
    return (Math.hypot((x-cx)/rx,(z-cz)/rz)-1)*Math.min(rx,rz);
  };
  const field=(x,y,z)=>{let d=coreDistance(x,y,z);for(let i=0;i<specs.length;i++)d=smoothMin(d,waveDistance(i,x,y,z),.030);return d;};
  const min=[centre.x-.43,bottomY,centre.y-.69],max=[centre.x+.43,safeY,centre.y+.76],nx=Math.ceil((max[0]-min[0])/spacing),ny=Math.ceil((max[1]-min[1])/spacing),nz=Math.ceil((max[2]-min[2])/spacing),sx=nx+1,sy=ny+1,total=(nx+1)*(ny+1)*(nz+1),values=new Float32Array(total),dx=(max[0]-min[0])/nx,dy=(max[1]-min[1])/ny,dz=(max[2]-min[2])/nz,gridId=(x,y,z)=>x+sx*(y+sy*z);
  const gridPoint=id=>{const x=id%sx,j=(id-x)/sx,y=j%sy,z=(j-y)/sy;return [min[0]+x*dx,min[1]+y*dy,min[2]+z*dz];};
  for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const v=field(min[0]+x*dx,min[1]+y*dy,min[2]+z*dz),floor=spacing*.0002;values[gridId(x,y,z)]=Math.abs(v)<floor?(v<=0?-floor:floor):v;}
  const positions=Array.from(source.array.subarray(0,n*3)),uv=Array.from(contactGeometry.attributes.uv.array.subarray(0,n*2)),bodyIndices=[],vertices=new Map();
  const add=(x,y,z)=>{const id=positions.length/3;positions.push(Math.fround(x),Math.fround(y),Math.fround(z));uv.push(x*.8,(y+z)*.5);return id;};
  const vertex=(a,b)=>{const key=Math.min(a,b)*total+Math.max(a,b);if(vertices.has(key))return vertices.get(key);const p=gridPoint(a),q=gridPoint(b);let lo=0,hi=1;for(let k=0;k<12;k++){const t=(lo+hi)/2,v=field(lerp(p[0],q[0],t),lerp(p[1],q[1],t),lerp(p[2],q[2],t));if((v<=0)===(values[a]<=0))lo=t;else hi=t;}const t=Math.max(.0002,Math.min(.9998,(lo+hi)/2)),id=add(lerp(p[0],q[0],t),lerp(p[1],q[1],t),lerp(p[2],q[2],t));vertices.set(key,id);return id;};
  const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
  const orientedFace=(a,b,c,direction)=>{
    const ax=positions[a*3],ay=positions[a*3+1],az=positions[a*3+2],ux=positions[b*3]-ax,uy=positions[b*3+1]-ay,uz=positions[b*3+2]-az,vx=positions[c*3]-ax,vy=positions[c*3+1]-ay,vz=positions[c*3+2]-az;
    if((uy*vz-uz*vy)*direction[0]+(uz*vx-ux*vz)*direction[1]+(ux*vy-uy*vx)*direction[2]>=0)bodyIndices.push(a,b,c);else bodyIndices.push(a,c,b);
  };
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=gridId(x,y,z),cube=[a,a+1,a+sx+1,a+sx,a+sx*sy,a+sx*sy+1,a+sx*sy+sx+1,a+sx*sy+sx];let negative=0;for(const id of cube)if(values[id]<=0)negative++;if(negative===0||negative===8)continue;
    for(const tet of tetrahedra){const inside=[],outside=[];for(const j of tet)(values[cube[j]]<=0?inside:outside).push(cube[j]);if(!inside.length||!outside.length)continue;
      const direction=[0,0,0];for(const id of outside){const p=gridPoint(id);for(let k=0;k<3;k++)direction[k]+=p[k]/outside.length;}for(const id of inside){const p=gridPoint(id);for(let k=0;k<3;k++)direction[k]-=p[k]/inside.length;}
      if(inside.length===1){const p=outside.map(id=>vertex(inside[0],id));orientedFace(...p,direction);}
      else if(outside.length===1){const p=inside.map(id=>vertex(id,outside[0]));orientedFace(...p,direction);}
      else{const a=vertex(inside[0],outside[0]),b=vertex(inside[0],outside[1]),c=vertex(inside[1],outside[1]),d=vertex(inside[1],outside[0]);orientedFace(a,b,c,direction);orientedFace(a,c,d,direction);}
    }
  }
  vertices.clear();const fieldEnd=positions.length/3;
  const topLoops=boundaryLoops(bodyIndices,positions,safeY),bottomLoops=boundaryLoops(bodyIndices,positions,bottomY);check(topLoops.length===1&&bottomLoops.length===1,'wave mass needs a single bearing boundary at cap and floor');
  const warpHeight=(x,y,z)=>{
    if(y<=.12)return y;const cap=capHeightAt(x,z);if(!Number.isFinite(cap))return y;
    let distance=Infinity;for(let j=0;j<capLoop.length;j++){const a=capLoop[j],b=capLoop[(j+1)%capLoop.length],px=source.getX(a),pz=source.getZ(a),vx=source.getX(b)-px,vz=source.getZ(b)-pz,t=Math.max(0,Math.min(1,((x-px)*vx+(z-pz)*vz)/(vx*vx+vz*vz)));distance=Math.min(distance,Math.hypot(x-px-t*vx,z-pz-t*vz));}
    return y+Math.max(0,cap-.014-safeY)*smooth(distance,0,.060)*smooth(y,.12,safeY);
  };
  for(let id=n;id<fieldEnd;id++)positions[id*3+1]=Math.fround(warpHeight(positions[id*3],positions[id*3+1],positions[id*3+2]));
  const diagonalRepairs=repairWarpTriangulation(bodyIndices,positions);
  const top=topLoops[0].toReversed(),point=id=>new THREE.Vector3().fromArray(positions,id*3);
  const polygonArea=loop=>loop.reduce((sum,id,j)=>sum+positions[id*3]*positions[loop[(j+1)%loop.length]*3+2]-positions[loop[(j+1)%loop.length]*3]*positions[id*3+2],0),orientation=Math.sign(polygonArea(capLoop));check(Math.sign(polygonArea(top))===orientation,'cap and bearing boundary orientation mismatch');
  const phase=id=>{const a=orientation*Math.atan2(positions[id*3+2]-centre.y,positions[id*3]-centre.x);return (a+TAU)%TAU;},ordered=loop=>[...loop].sort((a,b)=>phase(a)-phase(b)),lower=ordered(top),upper=ordered(capLoop),lowerAngles=lower.map(phase);
  const radialTarget=a=>{const dir=new THREE.Vector2(Math.cos(a),Math.sin(a));let best=Infinity,height;for(let j=0;j<top.length;j++){const p=point(top[j]),q=point(top[(j+1)%top.length]),ex=q.x-p.x,ez=q.z-p.z,px=p.x-centre.x,pz=p.z-centre.y,cross=dir.x*ez-dir.y*ex;if(Math.abs(cross)<1e-14)continue;const t=(px*ez-pz*ex)/cross,u=(px*dir.y-pz*dir.x)/cross;if(t>0&&u>=-1e-8&&u<=1+1e-8&&t<best){best=t;height=lerp(p.y,q.y,u);}}check(Number.isFinite(best),'cap ray missed actual bearing boundary');return [centre.x+dir.x*best,centre.y+dir.y*best,height];};
  let previous=upper.map(id=>{const p=point(id);return add(p.x,p.y,p.z);});
  // A short vertical drop follows every exact cap boundary segment before
  // moving inward. An inward first chord can cut across the cap's fine relief
  // even if its three endpoints individually lie below that cap.
  const collarStart=positions.length/3;
  const collar=upper.map(id=>{const p=point(id);return add(p.x,p.y-.010,p.z);});
  for(let j=0;j<collar.length;j++){const k=(j+1)%collar.length;bodyIndices.push(previous[j],collar[j],previous[k],previous[k],collar[j],collar[k]);}previous=collar;
  for(let row=1;row<=11;row++){
    const t=row/12,travel=t*t*(2-t),ring=upper.map(id=>{const p=point(id),end=radialTarget(Math.atan2(p.z-centre.y,p.x-centre.x)),x=lerp(p.x,end[0],travel),z=lerp(p.z,end[1],travel),capY=capHeightAt(x,z);check(Number.isFinite(capY),'cap transition left original footprint');return add(x,Math.min(capY-.010,lerp(p.y-.010,Math.min(capY-.010,end[2]),t)),z);});
    for(let j=0;j<ring.length;j++){const k=(j+1)%ring.length;bodyIndices.push(previous[j],ring[j],previous[k],previous[k],ring[j],ring[k]);}previous=ring;
  }
  // Zipper the two unequal actual boundary loops, keeping every original cap
  // vertex and the shared marching edge vertices. No projected proxy cap.
  const upperAngles=previous.map(phase);let i=0,j=0;
  while(i<previous.length||j<lower.length){const a=previous[i%previous.length],b=lower[j%lower.length],nextA=i<previous.length?(i+1===previous.length?upperAngles[0]+TAU:upperAngles[i+1]):Infinity,nextB=j<lower.length?(j+1===lower.length?lowerAngles[0]+TAU:lowerAngles[j+1]):Infinity;
    if(nextA<=nextB){bodyIndices.push(a,b,previous[(i+1)%previous.length]);i++;}else{bodyIndices.push(a,b,lower[(j+1)%lower.length]);j++;}
  }
  const bottom=bottomLoops[0],bottomCopy=bottom.map(id=>{const p=point(id);return add(p.x,bottomY,p.z);}),floorPoints=bottomCopy.map(id=>new THREE.Vector2(positions[id*3],positions[id*3+2]));
  for(const tri of THREE.ShapeUtils.triangulateShape(floorPoints,[])){const ids=tri.map(i=>bottomCopy[i]);orientedFace(...ids,[0,-1,0]);}
  const dry=Array.from(contactGeometry.index.array.subarray(0,roofCount)),wet=[],dryRoles=new Array(roofCount/3).fill(0),wetRoles=[];
  for(let i=0;i<bodyIndices.length;i+=3){const ids=bodyIndices.slice(i,i+3),c=[0,0,0];for(const id of ids)for(let k=0;k<3;k++)c[k]+=positions[id*3+k]/3;let role=0,d=coreDistance(...c);if(ids.every(id=>id>=n&&id<fieldEnd))for(let k=0;k<specs.length;k++){const v=waveDistance(k,...c);if(v<d){d=v;role=k+1;}}const isWet=c[1]<waterY;(isWet?wet:dry).push(...ids);(isWet?wetRoles:dryRoles).push(role);}
  const geometry=new THREE.BufferGeometry();geometry.name='stone-fish-r5-bowed-tapered-three-wave-mass';geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([...dry,...wet]);geometry.addGroup(0,dry.length,0);geometry.addGroup(dry.length,wet.length,1);geometry.computeVertexNormals();
  // Smooth normals follow the actual shared Float32 triangles. A wide finite
  // difference across a narrow concavity can point through its opposite wall.
  const normals=geometry.attributes.normal.array;
  normals.set(contactGeometry.attributes.normal.array.subarray(0,n*3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const roles=Uint8Array.from([...dryRoles,...wetRoles]),waves=specs.map((s,i)=>({id:s.id,role:i+1,scale:s.scale,viewNormal:[1,0,0],airProbe:[centre.x+s.x,waterY-s.drop+.16*s.scale,centre.y+s.z+(.17*s.scale)*Math.cos(s.angle)],crestProbe:[centre.x+s.x,waterY-s.drop+.30*s.scale,centre.y+s.z+(.07*s.scale)*Math.cos(s.angle)],form:'full-height solid wave profile continuously fused with adjacent masses'}));
  let maximumWaveY=-Infinity;for(let i=0;i<geometry.index.count;i++)if(roles[Math.floor(i/3)]>0)maximumWaveY=Math.max(maximumWaveY,geometry.attributes.position.getY(geometry.index.getX(i)));
  geometry.userData={body:'single-three-folded-wave-support',supportVariant:'r5',historicalCarvingVerified:false,originalContactCapRetained:true,roofVertices:n,roofTriangles:roofCount/3,bottomY,waterY,worldScale,waveCount:waves.length,maximumWaveY,broadenedSubmergedFoot:false,spacing,diagonalRepairs,fieldGrid:[nx,ny,nz],distanceGridBytes:profiles.reduce((sum,p)=>sum+p.bytes,0)+values.byteLength,authoredRevision:'bowed-crest-and-curved-bearing-r5-first',capCollar:{start:collarStart,count:collar.length,depth:.010,sourceBoundary:upper.slice()},normalSource:'area-weighted shared Float32 surface normals; unchanged cap normals'};
  let disposed=false;
  const validate=()=>{
    check(!disposed,'disposed geometry owner');const p=geometry.attributes.position;
    for(const key of ['position','normal','uv']){const a=geometry.attributes[key],b=contactGeometry.attributes[key];for(let i=0;i<n*a.itemSize;i++)check(a.array[i]===b.array[i],'original contact cap '+key+' changed');}
    for(let j=0;j<upper.length;j++){const id=collarStart+j,original=upper[j];check(p.getX(id)===source.getX(original)&&p.getY(id)===Math.fround(source.getY(original)-.010)&&p.getZ(id)===source.getZ(original),'original 10 mm collar moved');}
    for(let i=0;i<roofCount;i++)check(geometry.index.getX(i)===contactGeometry.index.getX(i),'original contact indices changed');
    let upperVertices=0,maxAbove=-Infinity;for(let i=n;i<p.count;i++)if(p.getY(i)>safeY+1e-7){const capY=capHeightAt(p.getX(i),p.getZ(i));check(Number.isFinite(capY),'wave crossed outside safe belly contact region');const delta=p.getY(i)-capY;check(delta<2e-7,'wave penetrates retained contact cap');upperVertices++;maxAbove=Math.max(maxAbove,delta);}
    let minimumWaveClearance=Infinity;for(let i=n;i<fieldEnd;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),cap=capHeightAt(x,z);minimumWaveClearance=Math.min(minimumWaveClearance,(Number.isFinite(cap)?cap-.003:bodyMinimumY)-y);}
    check(Math.abs(geometry.boundingBox.min.y-bottomY)<1e-7,'foot moved off original pool floor');check(minimumWaveClearance>.003,'wave lost clearance below actual unchanged belly');
    return {unchangedRoofVertices:n,unchangedRoofTriangles:roofCount/3,maximumContactDrift:0,unchangedCollarVertices:collar.length,maximumCollarDrift:0,checkedNeckVertices:upperVertices,maximumNeckAboveContact:maxAbove,minimumWaveClearance,originalFloorY:bottomY,actualFloorY:geometry.boundingBox.min.y,joinedWaveRoots:waves.length};
  };
  try{return {geometry,waves,surfaceRoleAt:faceIndex=>roles[faceIndex],diagnostics:{...geometry.userData,triangles:geometry.index.count/3,vertices:geometry.attributes.position.count,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},contact:validate()},validate,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometry.dispose();}};}
  catch(error){geometry.dispose();throw error;}
}

// Private contact readers leave the frozen R2/R3 geometry modules
// unchanged. They inspect the real supplied cap, not an analytic fish proxy.
function contactBoundary(geometry,info){
  const n=info.sourceVertices,count=info.sourceTriangles*3,p=geometry.attributes.position,index=geometry.index,edges=new Map();
  check(Number.isInteger(n)&&n>8&&count>24&&index?.count>=count&&p?.count>=n,'actual belly contact cap required');
  for(let i=0;i<count;i+=3){const face=[index.getX(i),index.getX(i+1),index.getX(i+2)];check(face.every(v=>v<n),'contact cap indexing changed');for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=a<b?a+':'+b:b+':'+a,e=edges.get(key);if(e){check(e.count===1&&e.a===b&&e.b===a,'nonmanifold contact cap');e.count++;}else edges.set(key,{a,b,count:1});}}
  const edgesAtBoundary=[...edges.values()].filter(e=>e.count===1),next=new Map();for(const e of edgesAtBoundary){check(!next.has(e.a),'branched contact cap');next.set(e.a,e.b);}
  const loop=[],seen=new Set(),first=edgesAtBoundary[0]?.a;let at=first;check(first!==undefined,'missing contact boundary');
  do{check(!seen.has(at)&&next.has(at),'open contact boundary');seen.add(at);loop.push(at);at=next.get(at);}while(at!==first);
  check(loop.length===edgesAtBoundary.length,'multiple contact boundaries');return loop;
}

function contactHeightSampler(geometry,triangleCount){
  const p=geometry.attributes.position,index=geometry.index,buckets=new Map(),cell=.025;
  for(let i=0;i<triangleCount*3;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],xs=ids.map(id=>p.getX(id)),zs=ids.map(id=>p.getZ(id));for(let x=Math.floor((Math.min(...xs)-1e-8)/cell);x<=Math.floor((Math.max(...xs)+1e-8)/cell);x++)for(let z=Math.floor((Math.min(...zs)-1e-8)/cell);z<=Math.floor((Math.max(...zs)+1e-8)/cell);z++){const key=x+':'+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}}
  return (x,z)=>{let height=-Infinity;for(const i of buckets.get(Math.floor(x/cell)+':'+Math.floor(z/cell))??[]){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c),d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-16)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,w=1-u-v;if(u< -1e-8||v< -1e-8||w< -1e-8)continue;height=Math.max(height,u*p.getY(a)+v*p.getY(b)+w*p.getY(c));}return height;};
}
