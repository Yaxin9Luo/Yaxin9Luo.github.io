import * as THREE from 'three';

const check=(ok,message)=>{if(!ok)throw new Error('Stone fish wave support: '+message);};
const smooth=THREE.MathUtils.smoothstep;

function contactBoundary(geometry,info){
  const n=info.sourceVertices,count=info.sourceTriangles*3,p=geometry.attributes.position,index=geometry.index,edges=new Map();
  check(Number.isInteger(n)&&n>8&&count>24&&index?.count>=count&&p?.count>=n,'actual belly contact cap required');
  for(let i=0;i<count;i+=3){const face=[index.getX(i),index.getX(i+1),index.getX(i+2)];check(face.every(v=>v<n),'contact cap indexing changed');for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=a<b?a+':'+b:b+':'+a,e=edges.get(key);if(e){check(e.count===1&&e.a===b&&e.b===a,'nonmanifold contact cap');e.count++;}else edges.set(key,{a,b,count:1});}}
  const edgeList=[...edges.values()].filter(e=>e.count===1),next=new Map();for(const e of edgeList){check(!next.has(e.a),'branched contact cap');next.set(e.a,e.b);}
  const loop=[],seen=new Set(),first=edgeList[0]?.a;let at=first;check(first!==undefined,'missing contact boundary');
  do{check(!seen.has(at)&&next.has(at),'open contact boundary');seen.add(at);loop.push(at);at=next.get(at);}while(at!==first);
  check(loop.length===edgeList.length,'multiple contact boundaries');return loop;
}

// An exact triangle lookup over the retained contact cap. This is only used
// during authoring/validation, never per animation frame or as another body.
function contactHeightSampler(geometry,triangleCount){
  const p=geometry.attributes.position,index=geometry.index,buckets=new Map(),cell=.025;
  for(let i=0;i<triangleCount*3;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],xs=ids.map(id=>p.getX(id)),zs=ids.map(id=>p.getZ(id));for(let x=Math.floor((Math.min(...xs)-1e-8)/cell);x<=Math.floor((Math.max(...xs)+1e-8)/cell);x++)for(let z=Math.floor((Math.min(...zs)-1e-8)/cell);z<=Math.floor((Math.max(...zs)+1e-8)/cell);z++){const key=x+':'+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}}
  return (x,z)=>{
    let height=-Infinity;for(const i of buckets.get(Math.floor(x/cell)+':'+Math.floor(z/cell))??[]){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c),denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(denominator)<1e-16)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator,w=1-u-v;if(u< -1e-8||v< -1e-8||w< -1e-8)continue;height=Math.max(height,u*p.getY(a)+v*p.getY(b)+w*p.getY(c));}return height;
  };
}

/** A closed carved wave block grown down from the unchanged R1 contact cap.
 * Its curved neck, spreading folds and scalloped foot replace the box/column.
 * The top's Float32 coordinates and triangle order are retained exactly.
 * All dimensions and carved wave motifs are authored, not surveyed evidence. */
export function createStoneFishCarvedWaveGeometry({contactGeometry,contactInfo,bottomY,waterY,bodyMinimumY}={}){
  check([bottomY,waterY,bodyMinimumY].every(Number.isFinite)&&bottomY<waterY&&waterY<bodyMinimumY-.03,'finite original pool levels required');
  const loop=contactBoundary(contactGeometry,contactInfo),p=contactGeometry.attributes.position,uvSource=contactGeometry.attributes.uv,n=contactInfo.sourceVertices,roofCount=contactInfo.sourceTriangles*3,positions=Array.from(p.array.subarray(0,n*3)),uv=Array.from(uvSource.array.subarray(0,n*2)),dry=Array.from(contactGeometry.index.array.subarray(0,roofCount)),wet=[],rows=52,stride=loop.length,centre=new THREE.Vector2();
  for(const i of loop)centre.add(new THREE.Vector2(p.getX(i),p.getZ(i)));centre.multiplyScalar(1/stride);
  const safeY=bodyMinimumY-.018,wallTop=n,firstWallVertex=n+stride,capHeightAt=contactHeightSampler(contactGeometry,roofCount/3);
  // Contact and undercut have different tangent planes at the buried seam.
  // Exact duplicate edge positions keep closure while separating their normals.
  for(const id of loop){positions.push(p.getX(id),p.getY(id),p.getZ(id));uv.push(uvSource.getX(id),uvSource.getY(id));}
  const height=(v,topY)=>v<=.14?THREE.MathUtils.lerp(topY,safeY,smooth(v,0,.14)):v<=.56?THREE.MathUtils.lerp(safeY,.025,smooth(v,.14,.56)):THREE.MathUtils.lerp(.025,bottomY,smooth(v,.56,1));
  for(let row=1;row<=rows;row++){
    const v=row/rows,expand=smooth(v,.14,.64),footRetreat=1-.12*smooth(v,.76,1),neck=1-.035*Math.sin(Math.PI*Math.min(1,v/.14)),foldGate=Math.sin(Math.PI*smooth(v,.14,1))**2;
    for(const id of loop){
      const x=p.getX(id),z=p.getZ(id),angle=Math.atan2(z-centre.y,x-centre.x),scallop=1+.035*Math.sin(3*angle+.4)+.020*Math.cos(5*angle-.3),rx=.595*scallop*footRetreat,rz=1.04*(1+.023*Math.sin(4*angle+.6))*footRetreat;
      const fold=foldGate*(.024*Math.cos(6*angle+v*7.0)+.010*Math.cos(11*angle-v*8.0)),targetX=centre.x+(rx+fold)*Math.cos(angle),targetZ=centre.y+(rz+fold)*Math.sin(angle),px=THREE.MathUtils.lerp(centre.x+(x-centre.x)*neck,targetX,expand),pz=THREE.MathUtils.lerp(centre.y+(z-centre.y)*neck,targetZ,expand);
      // The belly gets lower as the neck contracts inward. Descend from the
      // actual cap triangle at this new XZ, rather than its old boundary Y.
      const contactY=v<=.14?capHeightAt(px,pz):p.getY(id);check(Number.isFinite(contactY),'curved neck left the actual contact cap');const y=height(v,contactY);
      positions.push(px,y,pz);uv.push(px*.8,(y+pz)*.5);
    }
  }
  const face=(a,b,c)=>{const y=(positions[a*3+1]+positions[b*3+1]+positions[c*3+1])/3;(y<waterY?wet:dry).push(a,b,c);};
  for(let row=0;row<rows;row++)for(let j=0;j<stride;j++){
    const k=(j+1)%stride,a=row===0?wallTop+j:firstWallVertex+(row-1)*stride+j,b=row===0?wallTop+k:firstWallVertex+(row-1)*stride+k,c=firstWallVertex+row*stride+j,d=firstWallVertex+row*stride+k;face(a,c,b);face(b,c,d);
  }
  // A separate bottom rim keeps its plane normal from rounding the side wall.
  const lower=positions.length/3,bottomStart=firstWallVertex+(rows-1)*stride;
  for(let j=0;j<stride;j++){const id=bottomStart+j;positions.push(positions[id*3],bottomY,positions[id*3+2]);uv.push(positions[id*3]*.8,positions[id*3+2]*.5);}
  const centreId=positions.length/3;positions.push(centre.x,bottomY,centre.y);uv.push(centre.x*.8,centre.y*.5);
  for(let j=0;j<stride;j++)wet.push(centreId,lower+(j+1)%stride,lower+j);
  const geometry=new THREE.BufferGeometry();geometry.name='stone-fish-r2-closed-scalloped-wave-core';geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([...dry,...wet]);geometry.addGroup(0,dry.length,0);geometry.addGroup(dry.length,wet.length,1);geometry.computeVertexNormals();
  // The unchanged contact cap remains fully hidden just inside the true skin.
  // Keep its existing normal field; new side/foot normals are smoothly shared.
  geometry.attributes.normal.array.set(contactGeometry.attributes.normal.array.subarray(0,n*3),0);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={body:'continuous-carved-stone-wave-support',historicalCarvingVerified:false,originalContactCapRetained:true,roofVertices:n,roofTriangles:roofCount/3,bottomY,waterY,neckRows:rows,sourceContactGeometry:contactGeometry.name};
  const validate=()=>{
    const actual=geometry.attributes.position;for(let i=0;i<n*3;i++)check(actual.array[i]===p.array[i],'actual contact cap moved');for(let i=0;i<roofCount;i++)check(geometry.index.getX(i)===contactGeometry.index.getX(i),'actual contact topology moved');
    check(Math.abs(geometry.boundingBox.min.y-bottomY)<1e-7,'wave foot left original pool floor');
    let checkedNeckVertices=0,maximumNeckAboveContact=-Infinity;for(let i=wallTop;i<lower;i++){if(actual.getY(i)<=safeY)continue;const capY=capHeightAt(actual.getX(i),actual.getZ(i));check(Number.isFinite(capY),'upper wave neck left the retained body contact footprint');const delta=actual.getY(i)-capY;check(delta<2e-7,`upper wave neck penetrates above the retained contact cap at vertex ${i}: ${delta} m (actualY ${actual.getY(i)}, capY ${capY})`);checkedNeckVertices++;maximumNeckAboveContact=Math.max(maximumNeckAboveContact,delta);}
    return {unchangedRoofVertices:n,unchangedRoofTriangles:roofCount/3,maximumContactDrift:0,checkedNeckVertices,maximumNeckAboveContact,originalFloorY:bottomY,actualFloorY:geometry.boundingBox.min.y};
  };
  try{return {geometry,diagnostics:{...geometry.userData,triangles:geometry.index.count/3,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},contact:validate()},validate};}catch(error){geometry.dispose();throw error;}
}

function rolledCrest(side,z,variant){
  const points=[
    [side*.29,-.035,z-.13],[side*(.565+variant*.018),.035,z-.07],
    [side*.55,.22+variant*.015,z+.01],[side*.405,.279-variant*.011,z+.07],
    [side*.318,.216,z+.11],[side*.377,.175,z+.075],
  ].map(([x,y])=>new THREE.Vector3(x,y,z+.15*(side*x-.4)+.07*y));
  // The curl lies in one gently tilted plane. A wide section must not twist
  // through that tight bend; its thin dimension also respects local curvature.
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal'),steps=160,sides=40,positions=[],uv=[],indices=[],lateral=new THREE.Vector3(),radial=new THREE.Vector3(),reference=new THREE.Vector3(-.15*side,-.07,1).normalize();
  for(let i=0;i<=steps;i++){
    const t=i/steps,point=curve.getPoint(t),tangent=curve.getTangent(t).normalize();lateral.copy(reference).addScaledVector(tangent,-reference.dot(tangent)).normalize();radial.crossVectors(lateral,tangent).normalize();
    const before=curve.getPoint(Math.max(0,t-1/steps)),after=curve.getPoint(Math.min(1,t+1/steps)),u=point.clone().sub(before),v=after.clone().sub(point),bendArea=u.clone().cross(v).length(),curvatureRadius=bendArea>1e-12?u.length()*v.length()*u.clone().add(v).length()/(2*bendArea):Infinity;
    const fade=1-.94*smooth(t,.80,1),width=(.12+.040*Math.sin(Math.PI*t)-.075*smooth(t,.45,.9))*fade,thickness=Math.min((.024+.015*Math.sin(Math.PI*t))*fade,curvatureRadius*.40);
    for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,rib=1+.05*Math.cos(3*a+.25*Math.sin(Math.PI*t))*Math.sin(Math.PI*t),p=point.clone().addScaledVector(lateral,width*Math.cos(a)).addScaledVector(radial,thickness*rib*Math.sin(a));positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);}
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,d,b,b,d,c);}
  for(const [ring,reverse] of [[0,false],[steps,true]]){const centre=positions.length/3,p=curve.getPoint(ring/steps);positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);for(let j=0;j<sides;j++)indices.push(...(reverse?[centre,ring*sides+(j+1)%sides,ring*sides+j]:[centre,ring*sides+j,ring*sides+(j+1)%sides]));}
  const geometry=new THREE.BufferGeometry();geometry.name=`stone-fish-r2-rolled-wave-${side}-${z}`;geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={body:'thick-curled-wave-crest',historicalCarvingVerified:false,root:points[0].toArray(),curveSamples:steps,profileSamples:sides,curvatureLimitedThickness:true};return geometry;
}

/** Six closed, broad curled crests are embedded in the spreading wave core.
 * Their entire surfaces stay below the lowest source belly, so decorative
 * folds cannot be used to hide a renewed body/support intersection. */
export function createStoneFishRolledWaveCrests(bodyMinimumY){
  check(Number.isFinite(bodyMinimumY),'actual body minimum required');const geometries=[];
  try{for(const side of [-1,1])for(const [i,z] of [-.50,.08,.64].entries()){const geometry=rolledCrest(side,z,(i-1)*.55+side*.12);geometries.push(geometry);check(geometry.boundingBox.max.y<bodyMinimumY-.012,'rolled crest crosses the original fish clearance');}return geometries;}
  catch(error){for(const geometry of geometries)geometry.dispose();throw error;}
}
