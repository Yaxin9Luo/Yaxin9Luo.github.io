// The Xianfashan thick heightfield shares its rim vertices with buried vertical
// walls. Rebuild only those display normals from the original top triangles.
// Positions, topology, interior normals and the source collision owner stay intact.
export function repairMoundBoundaryNormals(source,display,{signal}={}){
  signal?.throwIfAborted();
  const position=source?.attributes.position,normal=source?.attributes.normal,target=display?.attributes.normal,index=source?.index;
  if(source===display||!position||position.itemSize!==3||normal?.itemSize!==3||target?.itemSize!==3||normal.count!==position.count||target.count!==position.count||normal===target)throw new Error('Mound seam repair needs an independent display normal attribute');
  const normalArray=normal.array??normal.data?.array,targetArray=target.array??target.data?.array;
  if(normalArray.buffer===targetArray.buffer)throw new Error('Mound seam repair must not share source normal storage');
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<position.count;i++){
    if((i&4095)===0)signal?.throwIfAborted();
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new Error('Mound source positions must be finite');
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  const rim=new Map(),ids=[0,0,0],onRim=[false,false,false],count=index?.count??position.count;
  let contributingTopTriangles=0;
  for(let face=0;face<count;face+=3){
    if((face&4095)===0)signal?.throwIfAborted();
    for(let c=0;c<3;c++){
      const id=ids[c]=index?index.getX(face+c):face+c,x=position.getX(id),z=position.getZ(id);
      // Exact local coordinate identity, not a width band that flattens slopes.
      onRim[c]=x===minX||x===maxX||z===minZ||z===maxZ;
    }
    if(!onRim[0]&&!onRim[1]&&!onRim[2])continue;
    const ax=position.getX(ids[0]),ay=position.getY(ids[0]),az=position.getZ(ids[0]);
    const ux=position.getX(ids[1])-ax,uy=position.getY(ids[1])-ay,uz=position.getZ(ids[1])-az;
    const vx=position.getX(ids[2])-ax,vy=position.getY(ids[2])-ay,vz=position.getZ(ids[2])-az;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    // The original closed heightfield has positive-Y top faces, zero-Y vertical
    // sides and negative-Y bottom faces. Cross magnitude supplies face area.
    if(!(ny>0))continue;
    contributingTopTriangles++;
    for(let c=0;c<3;c++)if(onRim[c]){
      const id=ids[c],key=position.getX(id)+','+position.getY(id)+','+position.getZ(id);
      let entry=rim.get(key);
      if(!entry){entry={x:0,y:0,z:0,vertices:new Set()};rim.set(key,entry);}
      entry.x+=nx;entry.y+=ny;entry.z+=nz;entry.vertices.add(id);
    }
  }
  // Coordinate grouping also joins top-face copies in the non-indexed archive.
  // Side-only copies at the same coordinate are never added to the write set.
  signal?.throwIfAborted();let correctedVertices=0,topRimVertices=0,maxCorrectionDegrees=0;
  for(const entry of rim.values()){
    const length=Math.hypot(entry.x,entry.y,entry.z),x=entry.x/length,y=entry.y/length,z=entry.z/length;
    for(const id of entry.vertices){
      topRimVertices++;
      const ox=normal.getX(id),oy=normal.getY(id),oz=normal.getZ(id),oldLength=Math.hypot(ox,oy,oz);
      if(oldLength>0)maxCorrectionDegrees=Math.max(maxCorrectionDegrees,Math.acos(Math.max(-1,Math.min(1,(ox*x+oy*y+oz*z)/oldLength)))*180/Math.PI);
      if(ox===Math.fround(x)&&oy===Math.fround(y)&&oz===Math.fround(z))continue;
      target.setXYZ(id,x,y,z);correctedVertices++;
    }
  }
  if(correctedVertices)target.needsUpdate=true;
  return {method:'area-weighted-original-top-faces-at-local-rim',contributingTopTriangles,uniqueRimPositions:rim.size,topRimVertices,correctedVertices,maxCorrectionDegrees};
}
