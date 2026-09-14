import * as THREE from 'three';

const check=(ok,message)=>{if(!ok)throw new Error('Stone fish wave R3: '+message);};
const smooth=THREE.MathUtils.smoothstep,lerp=THREE.MathUtils.lerp,TAU=Math.PI*2;
const up=new THREE.Vector3(0,1,0);

// Private copies of the R2 contact readers leave that frozen geometry module
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

const waveLayout=Object.freeze([
  {id:'near-back-main',angle:-.76,scale:1,rootRow:42,turn:1},
  {id:'near-front-main',angle:.52,scale:.94,rootRow:39,turn:1},
  {id:'front-short-return',angle:1.57,scale:.59,rootRow:44,turn:-1},
  {id:'far-front-return',angle:2.57,scale:.73,rootRow:42,turn:1},
  {id:'far-back-return',angle:4.04,scale:.67,rootRow:44,turn:-1},
]);

/** One closed carved support, with five rolled waves stitched into real side
 * openings. The broad foot is below the original water line. All carving and
 * dimensions are an authored study; only the supplied contact cap is retained
 * evidence from the frozen fish geometry. No fish, water or texture is built. */
export function createStoneFishCarvedWaveR3({contactGeometry,contactInfo,bottomY,waterY,bodyMinimumY,worldScale=1}={}){
  check([bottomY,waterY,bodyMinimumY,worldScale].every(Number.isFinite)&&worldScale>0&&bottomY<waterY&&waterY<bodyMinimumY-.03,'finite original pool levels and positive scale required');
  const loop=contactBoundary(contactGeometry,contactInfo),source=contactGeometry.attributes.position,n=contactInfo.sourceVertices,roofCount=contactInfo.sourceTriangles*3,stride=loop.length,rows=80;
  const centre=new THREE.Vector2();for(const id of loop)centre.add(new THREE.Vector2(source.getX(id),source.getZ(id)));centre.multiplyScalar(1/stride);
  const capHeightAt=contactHeightSampler(contactGeometry,roofCount/3),safeY=bodyMinimumY-.018,submergedShoulderY=waterY-.035/worldScale;
  const positions=Array.from(source.array.subarray(0,n*3)),uv=Array.from(contactGeometry.attributes.uv.array.subarray(0,n*2)),dry=Array.from(contactGeometry.index.array.subarray(0,roofCount)),wet=[],dryRoles=new Array(roofCount/3).fill(0),wetRoles=[];
  const add=p=>{const id=positions.length/3;positions.push(p.x,p.y,p.z);uv.push(p.x*.8,(p.y+p.z)*.5);return id;};
  const point=id=>new THREE.Vector3().fromArray(positions,id*3);
  const face=(a,b,c,role=0)=>{const isWet=(positions[a*3+1]+positions[b*3+1]+positions[c*3+1])/3<waterY;(isWet?wet:dry).push(a,b,c);(isWet?wetRoles:dryRoles).push(role);};
  const wallStart=positions.length/3,angles=loop.map(id=>Math.atan2(source.getZ(id)-centre.y,source.getX(id)-centre.x));
  for(let row=0;row<=rows;row++)for(const [j,id]of loop.entries()){
    const original=point(id);if(row===0){add(original);continue;}
    const angle=angles[j];let x,z,y;
    if(row<=10){
      const t=row/10,contract=1-.028*Math.sin(Math.PI*t);x=centre.x+(original.x-centre.x)*contract;z=centre.y+(original.z-centre.y)*contract;
      const capY=capHeightAt(x,z);check(Number.isFinite(capY),'upper neck left original contact cap');y=lerp(capY,safeY,smooth(t,0,1));
    }else if(row<=52){
      const t=(row-10)/42,expansion=smooth(t,0,1),ridge=Math.sin(Math.PI*t)**2*(.039*Math.cos(angle*3-t*2.1)+.024*Math.sin(angle*5+t*1.4));
      y=lerp(safeY,submergedShoulderY,t);
      x=lerp(original.x,centre.x+.315*Math.cos(angle),expansion)+ridge*Math.cos(angle);
      z=lerp(original.z,centre.y+.595*Math.sin(angle),expansion)+ridge*.7*Math.sin(angle);
    }else{
      const t=(row-52)/(rows-52),spread=smooth(t,0,.64),retreat=1-.09*smooth(t,.72,1),lobe=1+.047*Math.sin(angle*3+.4)+.025*Math.cos(angle*5-.8);
      y=lerp(submergedShoulderY,bottomY,t);
      x=centre.x+lerp(.315,.52*lobe*retreat,spread)*Math.cos(angle);
      z=centre.y+lerp(.595,.82*(1+.027*Math.sin(angle*4+.1))*retreat,spread)*Math.sin(angle);
    }
    add(new THREE.Vector3(x,y,z));
  }
  const at=(row,column)=>wallStart+row*stride+(column+stride)%stride;
  const angleDistance=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const patches=waveLayout.map(spec=>{
    const columns=angles.map((a,i)=>({i,d:Math.abs(angleDistance(a,spec.angle))})).filter(v=>v.d<.22).map(v=>v.i);
    check(columns.length>=3,'source boundary is too sparse for the wave root');const j0=Math.min(...columns),j1=Math.max(...columns);check(j1-j0===columns.length-1,'wave root crosses contact seam');
    const r0=spec.rootRow-8,r1=spec.rootRow+8,boundary=[];
    for(let r=r0;r<r1;r++)boundary.push(at(r,j0));for(let j=j0;j<j1;j++)boundary.push(at(r1,j));for(let r=r1;r>r0;r--)boundary.push(at(r,j1));for(let j=j1;j>j0;j--)boundary.push(at(r0,j));
    return {...spec,j0,j1,r0,r1,boundary};
  });
  // Round each opening in the actual core grid, including a smooth one-patch
  // surrounding collar. A rectangular hole produced four pointed gussets even
  // when the loft itself was round. The cap and water-line rows stay fixed.
  const wallOriginal=positions.slice(wallStart*3);
  const wallPoint=(r,c)=>{const r0=Math.floor(r),j0=Math.floor(c),v=r-r0,u=c-j0,get=(rr,jj)=>new THREE.Vector3().fromArray(wallOriginal,(rr*stride+(jj+stride)%stride)*3);return get(r0,j0).lerp(get(r0,j0+1),u).lerp(get(r0+1,j0).lerp(get(r0+1,j0+1),u),v);};
  for(const patch of patches){const middle=(patch.j0+patch.j1)/2,half=(patch.j1-patch.j0)/2;
    for(let r=patch.r0-8;r<=Math.min(rows-1,patch.r1+8);r++)for(let j=Math.ceil(middle-2*half);j<=Math.floor(middle+2*half);j++){
      const u=(j-middle)/half,v=(r-patch.rootRow)/8,extent=Math.max(Math.abs(u),Math.abs(v));if(extent>2||extent===0)continue;
      const weight=1-smooth(extent,1,2),a=u/Math.max(1,extent),b=v/Math.max(1,extent),mappedU=a*Math.sqrt(1-b*b*.5)*Math.max(1,extent),mappedV=b*Math.sqrt(1-a*a*.5)*Math.max(1,extent),p=wallPoint(patch.rootRow+lerp(v,mappedV,weight)*8,middle+lerp(u,mappedU,weight)*half);
      p.toArray(positions,at(r,j)*3);
    }
  }
  for(let row=0;row<rows;row++)for(let j=0;j<stride;j++){
    if(patches.some(p=>row>=p.r0&&row<p.r1&&j>=p.j0&&j<p.j1))continue;
    const a=at(row,j),b=at(row,j+1),c=at(row+1,j),d=at(row+1,j+1);face(a,c,b);face(b,c,d);
  }
  const foot=positions.length/3;for(let j=0;j<stride;j++)add(point(at(rows,j)));const bottomCentre=add(new THREE.Vector3(centre.x,bottomY,centre.y));for(let j=0;j<stride;j++)face(bottomCentre,foot+(j+1)%stride,foot+j);
  const waves=[];
  for(const [waveIndex,patch]of patches.entries()){
    const root=new THREE.Vector3();for(const id of patch.boundary)root.add(point(id));root.multiplyScalar(1/patch.boundary.length);
    const midCol=Math.round((patch.j0+patch.j1)/2),dRow=point(at(patch.rootRow+1,midCol)).sub(point(at(patch.rootRow-1,midCol))),dCol=point(at(patch.rootRow,midCol+1)).sub(point(at(patch.rootRow,midCol-1))),normal=dRow.cross(dCol).normalize();
    const radial=new THREE.Vector3(normal.x,0,normal.z).normalize(),along=new THREE.Vector3().crossVectors(radial,up).multiplyScalar(patch.turn),startU=up.clone().addScaledVector(normal,-normal.dot(up)).normalize(),startV=new THREE.Vector3().crossVectors(normal,startU).normalize(),s=patch.scale,lead=.040*s;
    const start=root.clone().addScaledVector(normal,lead),location=(out,height,forward)=>root.clone().addScaledVector(radial,out*s).addScaledVector(up,height*s).addScaledVector(along,forward*s);
    const stemEnd=location(.140,.158,-.030),controls=[start,start.clone().addScaledVector(normal,.08*s),stemEnd.clone().addScaledVector(up,-.06*s),stemEnd],stem=new THREE.CubicBezierCurve3(...controls),stemFraction=.35;
    // A tangent-continuous stem enters a rolled spiral. The previous R3 draft
    // used short Catmull-Rom knots that pinched the cross-section at each bend.
    const curve=new THREE.Curve();curve.getPoint=(t,target=new THREE.Vector3())=>{
      if(t<=stemFraction)return stem.getPoint(t/stemFraction,target);
      const u=(t-stemFraction)/(1-stemFraction),angle=Math.PI-u*Math.PI*1.30,radius=.088*(1-.30*smooth(u,.42,1));
      return target.copy(location(.140+.010*smooth(u,0,1),.158+radius*Math.sin(angle),.058+radius*Math.cos(angle)));
    };
    const ringAngles=[];let previous=-Infinity;
    for(const id of patch.boundary){const relative=point(id).sub(root);let a=Math.atan2(relative.dot(startV),relative.dot(startU));while(a<previous)a+=TAU;ringAngles.push(a);previous=a;}
    check(ringAngles.at(-1)-ringAngles[0]<TAU,'root boundary does not wind once around its actual surface normal');
    let previousRing=patch.boundary,frameU=startU.clone(),oldTangent=curve.getTangent(0).normalize();
    const connect=(ring)=>{for(let j=0;j<ring.length;j++){const k=(j+1)%ring.length;face(previousRing[j],previousRing[k],ring[j],waveIndex+1);face(previousRing[k],ring[k],ring[j],waveIndex+1);}previousRing=ring;};
    // The root uses the existing body boundary vertices. The first derivative
    // stays in that body's tangent plane, then rounds outward to the loft.
    for(let step=1;step<=12;step++){
      const t=step/12,h00=2*t**3-3*t**2+1,h10=t**3-2*t**2+t,h01=-2*t**3+3*t**2,h11=t**3-t**2,ring=[];
      for(const [j,id]of patch.boundary.entries()){
        const p=point(id),r=Math.floor((id-wallStart)/stride),c=(id-wallStart)%stride,norm=point(at(r+1,c)).sub(point(at(r-1,c))).cross(point(at(r,c+1)).sub(point(at(r,c-1)))).normalize();
        const into=root.clone().sub(p);into.addScaledVector(norm,-into.dot(norm)).multiplyScalar(.23);
        const a=ringAngles[j],target=start.clone().addScaledVector(startU,.041*s*Math.cos(a)).addScaledVector(startV,.030*s*Math.sin(a));
        ring.push(add(p.multiplyScalar(h00).addScaledVector(into,h10).addScaledVector(target,h01).addScaledVector(oldTangent,h11*lead*.8)));
      }
      connect(ring);
    }
    const steps=144;
    for(let step=1;step<=steps;step++){
      const t=step/steps,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),rotation=new THREE.Quaternion().setFromUnitVectors(oldTangent,tangent);frameU.applyQuaternion(rotation).addScaledVector(tangent,-frameU.dot(tangent)).normalize();const frameV=new THREE.Vector3().crossVectors(tangent,frameU).normalize();oldTangent=tangent;
      const before=curve.getPoint(Math.max(0,t-1/steps)),after=curve.getPoint(Math.min(1,t+1/steps)),a=p.clone().sub(before),b=after.clone().sub(p),area=a.clone().cross(b).length(),radius=area>1e-14?a.length()*b.length()*a.clone().add(b).length()/(2*area):Infinity;
      const u=Math.max(0,(t-stemFraction)/(1-stemFraction)),fade=1-.945*smooth(u,.56,1),wide=(t<=stemFraction?lerp(.041,.026,smooth(t/stemFraction,0,1)):.026+.004*Math.sin(Math.PI*u)**2)*s*fade,thin=lerp(.030,.020,smooth(t,0,stemFraction))*s*fade,ring=[];
      check(radius>Math.max(wide,thin)*1.3,'a rolled-wave cross-section exceeds its actual curve clearance: '+JSON.stringify({id:patch.id,t,radius,wide,thin}));
      for(const angle of ringAngles)ring.push(add(p.clone().addScaledVector(frameU,wide*Math.cos(angle)).addScaledVector(frameV,thin*Math.sin(angle))));connect(ring);
    }
    const tip=add(curve.getPoint(1));for(let j=0;j<previousRing.length;j++)face(tip,previousRing[j],previousRing[(j+1)%previousRing.length],waveIndex+1);
    waves.push({id:patch.id,role:waveIndex+1,scale:s,root:root.toArray(),rootBoundary:patch.boundary,rootNormal:normal.toArray(),viewNormal:radial.toArray(),controls:controls.map(p=>p.toArray()),airProbe:location(.146,.163,.058).toArray(),crestProbe:curve.getPoint(stemFraction+(1-stemFraction)*(.5/1.30)).toArray(),rootConnectedBySharedVertices:true});
  }
  // Hole interiors are no longer vertices of the visible skin. Compact them
  // without renumbering any retained contact vertex or contact triangle.
  const indices=[...dry,...wet],used=new Uint8Array(positions.length/3);for(const id of indices)used[id]=1;const remap=new Int32Array(used.length).fill(-1),compact=[],compactUV=[];
  for(let id=0;id<used.length;id++)if(used[id]){remap[id]=compact.length/3;compact.push(...positions.slice(id*3,id*3+3));compactUV.push(...uv.slice(id*2,id*2+2));}
  const geometry=new THREE.BufferGeometry();geometry.name='stone-fish-r3-joined-returning-wave-support';geometry.setAttribute('position',new THREE.Float32BufferAttribute(compact,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(compactUV,2));geometry.setIndex(indices.map(id=>remap[id]));geometry.addGroup(0,dry.length,0);geometry.addGroup(dry.length,wet.length,1);geometry.computeVertexNormals();geometry.attributes.normal.array.set(contactGeometry.attributes.normal.array.subarray(0,n*3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const roles=Uint8Array.from([...dryRoles,...wetRoles]);for(const wave of waves)wave.rootBoundary=wave.rootBoundary.map(id=>remap[id]);
  let maximumWaveY=-Infinity;for(let i=0;i<geometry.index.count;i++)if(roles[Math.floor(i/3)]>0)maximumWaveY=Math.max(maximumWaveY,geometry.attributes.position.getY(geometry.index.getX(i)));
  geometry.userData={body:'single-joined-carved-wave-support',supportVariant:'r3',historicalCarvingVerified:false,originalContactCapRetained:true,roofVertices:n,roofTriangles:roofCount/3,bottomY,waterY,worldScale,waveCount:waves.length,maximumWaveY,submergedShoulderY,authoredSubmergedShoulderDepthMetres:.035};
  let disposed=false;
  const validate=()=>{
    check(!disposed,'disposed geometry owner');const p=geometry.attributes.position;
    for(let i=0;i<n*3;i++)check(p.array[i]===source.array[i],'original contact cap moved');for(let i=0;i<roofCount;i++)check(geometry.index.getX(i)===contactGeometry.index.getX(i),'original contact indices moved');
    let upperVertices=0,maxAbove=-Infinity;for(let i=n;i<p.count;i++)if(p.getY(i)>safeY){const capY=capHeightAt(p.getX(i),p.getZ(i));check(Number.isFinite(capY),'visible wave crossed outside the safe belly contact region');const delta=p.getY(i)-capY;check(delta<2e-7,'visible wave penetrates retained contact cap');upperVertices++;maxAbove=Math.max(maxAbove,delta);}
    check(Math.abs(geometry.boundingBox.min.y-bottomY)<1e-7,'foot moved off original pool floor');
    check(maximumWaveY<bodyMinimumY-.012,'rolled wave lost clearance below the unchanged fish');
    return {unchangedRoofVertices:n,unchangedRoofTriangles:roofCount/3,maximumContactDrift:0,checkedNeckVertices:upperVertices,maximumNeckAboveContact:maxAbove,originalFloorY:bottomY,actualFloorY:geometry.boundingBox.min.y,joinedWaveRoots:waves.length};
  };
  try{return {geometry,waves,surfaceRoleAt:faceIndex=>roles[faceIndex],diagnostics:{...geometry.userData,triangles:geometry.index.count/3,vertices:geometry.attributes.position.count,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},contact:validate()},validate,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometry.dispose();}};}
  catch(error){geometry.dispose();throw error;}
}
