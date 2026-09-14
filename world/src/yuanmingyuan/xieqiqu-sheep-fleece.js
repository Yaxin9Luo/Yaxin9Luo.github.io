import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { sheepShoulderDetailWeight, sheepShoulderAxisZ, resolveSheepShoulderCreases } from './xieqiqu-sheep-detail.js';

// Sculpting helpers owned by this single sheep. They do not change or cache the
// shared building/animal mesher. The fleece displaces one existing closed skin;
// it is not a collection of intersecting tubes or detached wool patches.
export function redistributeSheepSkinSamples(geometry) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,ids=geometry.index.array,start=p.array.slice(),degree=new Uint32Array(p.count),sum=new Float64Array(p.count*3),delta=new THREE.Vector3(),normal=new THREE.Vector3();
  for(const id of ids)degree[id]+=2;
  // Marching cells create long, extremely thin triangles near a cell corner.
  // Subdivision alone reproduces that aspect ratio. Tangential redistribution
  // before carving makes sampling more even without shrinking the silhouette,
  // changing connectivity, or smoothing away already sculpted wool.
  for(let pass=0;pass<8;pass++){
    sum.fill(0);
    for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const at=ids[i+j]*3,a=ids[i+(j+1)%3]*3,b=ids[i+(j+2)%3]*3;for(let k=0;k<3;k++)sum[at+k]+=p.array[a+k]+p.array[b+k];}
    for(let i=0;i<p.count;i++){
      const weight=THREE.MathUtils.smoothstep(start[i*3+1],.62,.78)*(1-THREE.MathUtils.smoothstep(start[i*3+2],.72,.91));if(weight===0||degree[i]===0)continue;
      normal.fromBufferAttribute(n,i);delta.set(sum[i*3]/degree[i]-p.getX(i),sum[i*3+1]/degree[i]-p.getY(i),sum[i*3+2]/degree[i]-p.getZ(i));delta.addScaledVector(normal,-delta.dot(normal)).multiplyScalar(.32*weight);
      if(delta.length()>.002)delta.setLength(.002);p.setXYZ(i,p.getX(i)+delta.x,p.getY(i)+delta.y,p.getZ(i)+delta.z);
    }
  }
  let maximumTravel=0,maximumNormalTravel=0;for(let i=0;i<p.count;i++){delta.set(p.getX(i)-start[i*3],p.getY(i)-start[i*3+1],p.getZ(i)-start[i*3+2]);maximumTravel=Math.max(maximumTravel,delta.length());normal.fromBufferAttribute(n,i);maximumNormalTravel=Math.max(maximumNormalTravel,Math.abs(delta.dot(normal)));}
  return {passes:8,maximumTravel,maximumNormalTravel,trianglesBeforeAndAfter:ids.length/3,connectivityUnchanged:true};
}

export function subdivideSheepSkin(source) {
  const p=source.attributes.position,n=source.attributes.normal,old=source.index.array;
  const capacity=p.count+old.length,positions=new Float32Array(capacity*3),normals=new Float32Array(capacity*3),indices=new Uint32Array(old.length*4),edges=new Map();
  positions.set(p.array);normals.set(n.array);let count=p.count,at=0;
  const midpoint=(a,b)=>{
    const key=Math.min(a,b)*p.count+Math.max(a,b);if(edges.has(key))return edges.get(key);
    const id=count++;edges.set(key,id);let length=0;
    for(let axis=0;axis<3;axis++){positions[id*3+axis]=(p.array[a*3+axis]+p.array[b*3+axis])*.5;const v=n.array[a*3+axis]+n.array[b*3+axis];normals[id*3+axis]=v;length+=v*v;}
    length=Math.sqrt(length);if(length===0)throw new Error('Opposed sheep skin normals cannot be subdivided');
    for(let axis=0;axis<3;axis++)normals[id*3+axis]/=length;return id;
  };
  for(let i=0;i<old.length;i+=3){const a=old[i],b=old[i+1],c=old[i+2],ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);indices.set([a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca],at);at+=12;}
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(positions.slice(0,count*3),3));result.setAttribute('normal',new THREE.BufferAttribute(normals.slice(0,count*3),3));result.setIndex(new THREE.BufferAttribute(indices,1));return result;
}

const jitter=id=>Math.sin(id*127.1+311.7)*.5;
/** Project bounded, individually tapered S-curves onto the actual base surface.
 * The BVH is temporary and borrows the caller's geometry without modifying it. */
export function projectSheepFleeceLocks(geometry) {
  const tree=new MeshBVH(geometry,{indirect:true}),ray=new THREE.Ray(),locks=[];
  const stroke=(id,pointAt,direction,height,width,maxZ=Infinity,steps=24)=>{
    let points=[],part=0;ray.direction.fromArray(direction);
    const finish=()=>{if(points.length>=Math.ceil(steps/3)+1)locks.push({id:`${id}-${part++}`,points,height,width,direction:direction.map(v=>-v)});points=[];};
    for(let i=0;i<=steps;i++){
      ray.origin.fromArray(pointAt(i/steps));const hit=tree.raycastFirst(ray,THREE.DoubleSide);
      if(!hit||hit.face.normal.dot(ray.direction)>-.15||hit.point.z>maxZ){finish();continue;}
      points.push(hit.point.toArray());
    }
    finish();
  };
  for(const side of [-1,1]){
    for(let row=0;row<6;row++)for(let col=0;col<16;col++){
      const id=1000+row*31+col,top=.855+row*.098+jitter(id)*.03,z=-.72+col*.080+jitter(id+1)*.027,length=.156+jitter(id+2)*.035;
      stroke(`flank-${side}-${row}-${col}`,t=>[side*.8,top-length*t,z+.020*Math.sin(t*Math.PI*2.15)+.010*t],[ -side,0,0],.011+jitter(id+3)*.004,.027+jitter(id+4)*.004,.77);
    }
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const id=2100+row*23+col,top=1.225+row*.10+jitter(id)*.018,z=.42+col*.086;
      stroke(`neck-${side}-${row}-${col}`,t=>[side*.7,top-.151*t,z+.023*Math.sin(t*Math.PI*2.05)+.014*t],[-side,0,0],.016+jitter(id+1)*.004,.023,.86,96);
    }
  }
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
    const id=3200+row*17+col,top=.90+row*.103+jitter(id)*.024,x=(col-2)*.077+jitter(id+1)*.021;
    stroke(`brisket-${row}-${col}`,t=>[x+.023*Math.sin(t*Math.PI*2.10),top-.15*t,1.7],[0,0,-1],.021+jitter(id+2)*.004,.030,.94,96);
  }
  for(let row=0;row<8;row++)for(let col=0;col<5;col++){
    const id=4400+row*13+col,z=-.58+row*.122+jitter(id)*.029,x=(col-2)*.074+jitter(id+1)*.025;
    stroke(`back-${row}-${col}`,t=>[x+.016*Math.sin(t*Math.PI*2),2,z-.14*t],[0,-1,0],.009+jitter(id+2)*.003,.023,.67);
  }
  return locks;
}

/** Compact support lets each vertex evaluate nearby real lock segments only.
 * Heights taper to zero at both ends and at each lock's lateral edge. */
export function createSheepFleeceField(locks) {
  const cell=.06,grid=new Map();let segmentCount=0;
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(let lockIndex=0;lockIndex<locks.length;lockIndex++){const lock=locks[lockIndex];for(let i=0;i<lock.points.length-1;i++){
    const a=lock.points[i],b=lock.points[i+1],d=b.map((v,axis)=>v-a[axis]),lengthSq=d.reduce((s,v)=>s+v*v,0);if(lengthSq<1e-14)continue;
    const component=lock.direction?.findIndex(v=>Math.abs(v)>.5)??-1,axis=component<0?-1:component*2+(lock.direction[component]<0?1:0);
    const segment={a,d,lengthSq,t0:i/(lock.points.length-1),dt:1/(lock.points.length-1),width:lock.width,height:lock.height,axis};segmentCount++;
    const lo=a.map((v,axis)=>Math.floor((Math.min(v,b[axis])-lock.width)/cell)),hi=a.map((v,axis)=>Math.floor((Math.max(v,b[axis])+lock.width)/cell));
    for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){const id=key(x,y,z);if(!grid.has(id))grid.set(id,new Map());const cellGroups=grid.get(id);if(!cellGroups.has(lockIndex))cellGroups.set(lockIndex,[]);cellGroups.get(lockIndex).push(segment);}
  }}
  for(const [id,groups]of grid)grid.set(id,[...groups.values()]);
  function evaluate(x,y,z,surfaceNormal) {
    let height=0;const groups=grid.get(key(Math.floor(x/cell),Math.floor(y/cell),Math.floor(z/cell)));if(!groups)return height;
    const shoulderWeight=sheepShoulderDetailWeight(x,y,z),smoothing=.002*shoulderWeight;
    for(const segments of groups){let lockHeight=0;for(const s of segments){
      const x0=x-s.a[0],y0=y-s.a[1],z0=z-s.a[2],fraction=THREE.MathUtils.clamp((x0*s.d[0]+y0*s.d[1]+z0*s.d[2])/s.lengthSq,0,1),t=s.t0+s.dt*fraction;
      const taper=Math.sin(Math.PI*t)**.7,width=s.width*(.25+.75*taper),dx=x0-s.d[0]*fraction,dy=y0-s.d[1]*fraction,dz=z0-s.d[2]*fraction,q=Math.sqrt(dx*dx+dy*dy+dz*dz)/width;
      if(q>=1)continue;
      // A rounded crest with two low flutes reads as a carved lock. There is no
      // global sinusoidal phase that can stripe unrelated parts of the sculpture.
      const facing=s.axis<0||!surfaceNormal?1:THREE.MathUtils.smoothstep(surfaceNormal.getComponent(Math.floor(s.axis/2))*(s.axis%2?-1:1),.08,.35);
      // The accepted flank keeps its fine flutes. Shoulder locks retain their
      // full crest height but round the cross-section instead of carving tiny
      // parallel ledges that caught block-like highlights in the R3 close-up.
      const flutes=.80+.20*Math.cos(q*Math.PI*3),profile=(1-q*q)**2*(flutes+(1-flutes)*shoulderWeight),h=s.height*taper*profile*facing;
      lockHeight=Math.max(lockHeight,h);
    }
      // Round only the junction between distinct locks. Combining every short
      // segment would inflate a single curve as its sampling density increases.
      const k=smoothing*THREE.MathUtils.smoothstep(Math.min(height,lockHeight),0,.002),overlap=Math.max(k-Math.abs(height-lockHeight),0);
      height=Math.max(height,lockHeight)+(k>0?overlap*overlap/(4*k):0);
    }
    return height;
  }
  return {heightAt:(x,y,z)=>evaluate(x,y,z),sampleAt:evaluate,diagnostics:{locks:locks.length,segments:segmentCount,cells:grid.size,maximumHeight:Math.max(0,...locks.map(l=>l.height)),shoulderJunctionRadius:.002}};
}

export function sheepFleeceDirectionAt(x,y,z,surfaceNormal,target=new THREE.Vector3()) {
  // R3's normal.z gate rotated the carving axis abruptly across a few mm and
  // made visible cut faces. In this local chart, each horizontal section moves
  // radially away from the continuous interior line; azimuth and Y are fixed.
  const weight=sheepShoulderDetailWeight(x,y,z);target.set(x,0,z-sheepShoulderAxisZ(y)).normalize().multiplyScalar(weight).addScaledVector(surfaceNormal,1-weight);return target.normalize();
}

// A tiny triangle at a carved crest must not inherit almost all its normal
// from a much larger neighbour. Corner-angle weights follow the actual local
// fan while keeping the smooth normal continuous across matching vertices.
export function computeSheepCarvingNormals(geometry) {
  const p=geometry.attributes.position,ids=geometry.index.array,sum=new Float64Array(p.count*3),angles=new Float64Array(3),a=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),bc=new THREE.Vector3(),face=new THREE.Vector3();
  for(let i=0;i<ids.length;i+=3){
    const x=ids[i],y=ids[i+1],z=ids[i+2];a.fromBufferAttribute(p,x);ab.fromBufferAttribute(p,y).sub(a);ac.fromBufferAttribute(p,z).sub(a);bc.copy(ac).sub(ab);face.copy(ab).cross(ac);const area=face.length();if(area===0)continue;face.multiplyScalar(1/area);
    angles[0]=Math.atan2(area,ab.dot(ac));angles[1]=Math.atan2(area,-ab.dot(bc));angles[2]=Math.atan2(area,ac.dot(bc));
    for(let j=0;j<3;j++){const at=ids[i+j]*3,weight=angles[j];sum[at]+=face.x*weight;sum[at+1]+=face.y*weight;sum[at+2]+=face.z*weight;}
  }
  let n=geometry.attributes.normal;if(!n){n=new THREE.BufferAttribute(new Float32Array(p.count*3),3);geometry.setAttribute('normal',n);}
  for(let i=0;i<p.count;i++){face.fromArray(sum,i*3).normalize();n.setXYZ(i,face.x,face.y,face.z);}return geometry;
}

export function sculptSheepFleece(geometry,locks) {
  const field=createSheepFleeceField(locks),fieldNormals=geometry.attributes.normal.array.slice(),beforePositions=geometry.attributes.position.array.slice(),heights=new Float32Array(geometry.attributes.position.count);let p=geometry.attributes.position;
  computeSheepCarvingNormals(geometry);const beforeNormals=geometry.attributes.normal.array.slice(),base=new THREE.Vector3(),after=new THREE.Vector3(),normal=new THREE.Vector3(),direction=new THREE.Vector3(),rotation=new THREE.Quaternion();
  let displacedVertices=0,maximumDisplacement=0;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);normal.fromArray(fieldNormals,i*3);const height=field.sampleAt(x,y,z,normal);
    if(height===0)continue;heights[i]=height;displacedVertices++;maximumDisplacement=Math.max(maximumDisplacement,height);
    sheepFleeceDirectionAt(x,y,z,normal,direction);p.setXYZ(i,x+direction.x*height,y+direction.y*height,z+direction.z*height);
  }
  // Retain the continuous base-field gradient, then rotate it by the actual
  // geometric change from the fleece. Plain area weighting on marching slivers
  // facets even an untouched smooth muzzle. This keeps the base limit surface
  // while deriving the sculpted turn of each normal from the real moved faces.
  computeSheepCarvingNormals(geometry);let n=geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
    base.fromArray(beforeNormals,i*3);after.fromBufferAttribute(n,i);normal.fromArray(fieldNormals,i*3);
    if(base.lengthSq()>0&&after.lengthSq()>0){rotation.setFromUnitVectors(base.normalize(),after.normalize());normal.applyQuaternion(rotation);}
    // Carved crests use the actual surface normal. Preserve the smooth base
    // limit only on untouched skin, with a 1 mm transition at a lock's root.
    normal.lerp(after,THREE.MathUtils.smoothstep(heights[i],.0001,.001)).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  const creases=resolveSheepShoulderCreases(geometry),sourceVertex=id=>creases.originalVertex?.[id]??id;p=geometry.attributes.position;n=geometry.attributes.normal;
  const ids=geometry.index.array,pa=new THREE.Vector3(),pb=new THREE.Vector3(),pc=new THREE.Vector3(),originalFace=new THREE.Vector3(),actualFace=new THREE.Vector3(),badFaces=[];let invalidFaces=0;
  for(let i=0;i<ids.length;i+=3){
    const a=ids[i],b=ids[i+1],c=ids[i+2];pa.fromBufferAttribute(p,a);pb.fromBufferAttribute(p,b).sub(pa);pc.fromBufferAttribute(p,c).sub(pa);actualFace.copy(pb).cross(pc);
    normal.set(n.getX(a)+n.getX(b)+n.getX(c),n.getY(a)+n.getY(b)+n.getY(c),n.getZ(a)+n.getZ(b)+n.getZ(c)).normalize();const faceLength=actualFace.length(),dot=faceLength>0?actualFace.dot(normal)/faceLength:0;if(dot>0)continue;invalidFaces++;
    if(badFaces.length<12){pa.fromArray(beforePositions,sourceVertex(a)*3);pb.fromArray(beforePositions,sourceVertex(b)*3).sub(pa);pc.fromArray(beforePositions,sourceVertex(c)*3).sub(pa);originalFace.copy(pb).cross(pc);badFaces.push({face:i/3,dot,beforeArea:originalFace.length()*.5,afterArea:actualFace.length()*.5,vertices:[a,b,c].map(j=>{const s=sourceVertex(j);return {before:Array.from(beforePositions.slice(s*3,s*3+3)),baseFieldNormal:Array.from(fieldNormals.slice(s*3,s*3+3)),height:heights[s],after:[p.getX(j),p.getY(j),p.getZ(j)]};})});}
  }
  return {...field.diagnostics,displacedVertices,maximumDisplacement,creases:{splitCorners:creases.splitCorners,angle:creases.creaseAngle,trianglePositionsUnchanged:true},invalidFaces,badFaces};
}
