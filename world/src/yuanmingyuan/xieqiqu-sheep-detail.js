import * as THREE from 'three';

// Only the shoulder/neck seen in the failed R3 close-ups. The accepted flank,
// back, muzzle and legs have exactly zero weight and keep their old samples.
export function sheepShoulderDetailWeight(x,y,z) {
  return THREE.MathUtils.smoothstep(z,.29,.40)*(1-THREE.MathUtils.smoothstep(z,.82,.93))*THREE.MathUtils.smoothstep(y,.70,.81)*(1-THREE.MathUtils.smoothstep(y,1.36,1.47))*(1-THREE.MathUtils.smoothstep(Math.abs(x),.27,.34));
}

// An authored interior line following the existing chest into the neck. The
// carving field expands horizontal cross-sections without changing their Y.
export function sheepShoulderAxisZ(y) {
  return .31+.39*THREE.MathUtils.smoothstep(y,.80,1.40);
}

/** Conforming local edge subdivision before relief is sculpted. It never moves
 * an original vertex or disposes the borrowed source. Every shared marked edge
 * gets one midpoint, including its neighbouring transition triangle. */
export function refineSheepShoulderSkin(source,{maximumEdge=.0028,passes=3,maximumTriangles=1400000}={}) {
  if(!source.index||!source.attributes.position||!source.attributes.normal||Object.keys(source.attributes).some(k=>k!=='position'&&k!=='normal'))throw new Error('Shoulder refinement requires the indexed position/normal skin before UV authoring');
  if(!Number.isFinite(maximumEdge)||maximumEdge<=0||!Number.isInteger(passes)||passes<1||passes>4)throw new Error('Invalid shoulder refinement budget');
  let geometry=source.clone();const before=source.index.count/3,perPass=[];
  try{
    for(let pass=0;pass<passes;pass++){
      const p=geometry.attributes.position,n=geometry.attributes.normal,ids=geometry.index.array,weights=new Float32Array(p.count),edges=new Map();
      for(let i=0;i<p.count;i++)weights[i]=sheepShoulderDetailWeight(p.getX(i),p.getY(i),p.getZ(i));
      for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){
        const a=ids[i+j],b=ids[i+(j+1)%3],weight=(weights[a]+weights[b])*.5;if(weight===0)continue;
        const target=maximumEdge+.008*(1-weight),dx=p.getX(a)-p.getX(b),dy=p.getY(a)-p.getY(b),dz=p.getZ(a)-p.getZ(b);
        if(dx*dx+dy*dy+dz*dz>target*target)edges.set(Math.min(a,b)*p.count+Math.max(a,b),-1);
      }
      if(edges.size===0)break;
      if(ids.length/3+edges.size*2>maximumTriangles)throw new Error('Local shoulder refinement exceeded its explicit triangle ceiling');
      const positions=new Float32Array((p.count+edges.size)*3),normals=new Float32Array(positions.length),indices=new Uint32Array(ids.length+edges.size*6);positions.set(p.array);normals.set(n.array);let count=p.count,at=0;
      for(const key of edges.keys()){
        const a=Math.floor(key/p.count),b=key-a*p.count,id=count++;edges.set(key,id);let length=0;
        for(let k=0;k<3;k++){positions[id*3+k]=(p.array[a*3+k]+p.array[b*3+k])*.5;const v=n.array[a*3+k]+n.array[b*3+k];normals[id*3+k]=v;length+=v*v;}
        length=Math.sqrt(length);if(length===0)throw new Error('Opposed shoulder normals cannot be interpolated');for(let k=0;k<3;k++)normals[id*3+k]/=length;
      }
      const put=(a,b,c)=>{indices[at++]=a;indices[at++]=b;indices[at++]=c;},edge=(a,b)=>edges.get(Math.min(a,b)*p.count+Math.max(a,b));
      const lengthSq=(a,b)=>{let d=0;for(let k=0;k<3;k++)d+=(positions[a*3+k]-positions[b*3+k])**2;return d;};
      const quad=(a,b,c,d)=>{if(lengthSq(a,c)<lengthSq(b,d)){put(a,b,c);put(a,c,d);}else{put(a,b,d);put(b,c,d);}};
      for(let i=0;i<ids.length;i+=3){
        const a=ids[i],b=ids[i+1],c=ids[i+2],ab=edge(a,b),bc=edge(b,c),ca=edge(c,a),mask=(ab!==undefined?1:0)|(bc!==undefined?2:0)|(ca!==undefined?4:0);
        switch(mask){
          case 0:put(a,b,c);break;
          case 1:put(a,ab,c);put(ab,b,c);break;
          case 2:put(a,b,bc);put(a,bc,c);break;
          case 4:put(a,b,ca);put(b,c,ca);break;
          case 3:put(b,bc,ab);quad(a,ab,bc,c);break;
          case 6:put(c,ca,bc);quad(a,b,bc,ca);break;
          case 5:put(a,ab,ca);quad(ab,b,c,ca);break;
          case 7:put(a,ab,ca);put(ab,b,bc);put(ca,bc,c);put(ab,bc,ca);break;
        }
      }
      const next=new THREE.BufferGeometry();next.setAttribute('position',new THREE.BufferAttribute(positions,3));next.setAttribute('normal',new THREE.BufferAttribute(normals,3));next.setIndex(new THREE.BufferAttribute(indices.slice(0,at),1));
      perPass.push({pass:pass+1,addedVertices:edges.size,triangles:at/3});geometry.dispose();geometry=next;
    }
    geometry.userData.shoulderRefinement={maximumEdge,passes:perPass,trianglesBefore:before,trianglesAfter:geometry.index.count/3,originalVerticesUnchanged:true,sourceBorrowed:true};return geometry;
  }catch(error){geometry.dispose();throw error;}
}

/** Standard crease-normal sectors on exact indexed adjacency. Unlike a
 * position-quantized normal weld, nearby folds cannot become neighbours.
 * Only render vertices are split; every triangle position stays identical. */
export function resolveSheepShoulderCreases(geometry,creaseAngle=Math.PI/3) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,ids=geometry.index.array,head=new Int32Array(p.count).fill(-1),next=new Int32Array(ids.length),faceNormals=new Float32Array(ids.length),angles=new Float32Array(ids.length),threshold=Math.cos(creaseAngle),a=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),bc=new THREE.Vector3(),face=new THREE.Vector3();
  for(let i=0;i<ids.length;i+=3){
    a.fromBufferAttribute(p,ids[i]);ab.fromBufferAttribute(p,ids[i+1]).sub(a);ac.fromBufferAttribute(p,ids[i+2]).sub(a);bc.copy(ac).sub(ab);face.copy(ab).cross(ac);const area=face.length();face.normalize();face.toArray(faceNormals,i);
    angles[i]=Math.atan2(area,ab.dot(ac));angles[i+1]=Math.atan2(area,-ab.dot(bc));angles[i+2]=Math.atan2(area,ac.dot(bc));
    for(let j=0;j<3;j++){const corner=i+j,id=ids[corner];next[corner]=head[id];head[id]=corner;}
  }
  const changes=[],normal=new THREE.Vector3(),other=new THREE.Vector3();
  for(let i=0;i<ids.length;i++){
    const id=ids[i];if(sheepShoulderDetailWeight(p.getX(id),p.getY(id),p.getZ(id))===0)continue;
    face.fromArray(faceNormals,Math.floor(i/3)*3);let split=false;normal.set(0,0,0);
    for(let corner=head[id];corner>=0;corner=next[corner]){other.fromArray(faceNormals,Math.floor(corner/3)*3);if(face.dot(other)>=threshold)normal.addScaledVector(other,angles[corner]);else split=true;}
    if(split){normal.normalize();changes.push({corner:i,id,normal:normal.toArray()});}
  }
  if(changes.length===0)return {splitCorners:0,creaseAngle,trianglePositionsUnchanged:true,originalVertex:null};
  const positions=new Float32Array((p.count+changes.length)*3),normals=new Float32Array(positions.length),index=p.count+changes.length>65535?new Uint32Array(ids):ids.slice(),originalVertex=new Uint32Array(p.count+changes.length);positions.set(p.array);normals.set(n.array);for(let i=0;i<p.count;i++)originalVertex[i]=i;
  for(let i=0;i<changes.length;i++){const change=changes[i],id=p.count+i;for(let k=0;k<3;k++)positions[id*3+k]=p.array[change.id*3+k];normals.set(change.normal,id*3);index[change.corner]=id;originalVertex[id]=change.id;}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(new THREE.BufferAttribute(index,1));return {splitCorners:changes.length,creaseAngle,trianglePositionsUnchanged:true,originalVertex};
}
