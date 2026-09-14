// Reconnect an interior diagonal only when a sampled nonlinear height warp
// folds a sliver against its surrounding smooth surface. All vertices stay
// bit-identical; cap/floor boundaries are outside this field-only index set.
export function repairWarpTriangulation(indices,positions){
  const vertexCount=positions.length/3,repaired=[];
  const point=(id,k)=>positions[id*3+k],edgeKey=(a,b)=>Math.min(a,b)*vertexCount+Math.max(a,b);
  for(let pass=0;pass<8;pass++){
    const sums=new Float64Array(positions.length);
    const face=(a,b,c)=>{
      const ux=point(b,0)-point(a,0),uy=point(b,1)-point(a,1),uz=point(b,2)-point(a,2),vx=point(c,0)-point(a,0),vy=point(c,1)-point(a,1),vz=point(c,2)-point(a,2),x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,length=Math.hypot(x,y,z),edges=ux*ux+uy*uy+uz*uz+vx*vx+vy*vy+vz*vz+(vx-ux)**2+(vy-uy)**2+(vz-uz)**2;
      let ax=0,ay=0,az=0;for(const id of [a,b,c]){const k=id*3,n=Math.hypot(sums[k],sums[k+1],sums[k+2]);if(n){ax+=sums[k]/n;ay+=sums[k+1]/n;az+=sums[k+2]/n;}}
      return {x,y,z,length,quality:2*Math.sqrt(3)*length/edges,alignment:(x*ax+y*ay+z*az)/(length*Math.hypot(ax,ay,az))};
    };
    for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),f=face(...ids);for(const id of ids){sums[id*3]+=f.x;sums[id*3+1]+=f.y;sums[id*3+2]+=f.z;}}
    let failed=-1;for(let i=0;i<indices.length;i+=3){const f=face(indices[i],indices[i+1],indices[i+2]);if(!(f.length>0))throw new Error('Stone fish wave R4: degenerate warped field face');if(f.alignment<=0){failed=i;break;}}
    if(failed===-1)return repaired;
    const old=indices.slice(failed,failed+3),edgeMatches=new Map(old.map((a,j)=>[edgeKey(a,old[(j+1)%3]),[]]));
    for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const list=edgeMatches.get(edgeKey(indices[i+k],indices[i+(k+1)%3]));if(list)list.push({offset:i,edge:k});}
    let best=null;
    for(let k=0;k<3;k++){
      const a=old[k],b=old[(k+1)%3],c=old[(k+2)%3],matches=edgeMatches.get(edgeKey(a,b));if(matches.length!==2)continue;
      const other=matches.find(m=>m.offset!==failed);if(!other)continue;
      const original=indices.slice(other.offset,other.offset+3);if(original[other.edge]!==b||original[(other.edge+1)%3]!==a)continue;
      const d=original[(other.edge+2)%3];if(d===c)continue;
      const one=[c,a,d],two=[c,d,b],f1=face(...one),f2=face(...two),oldQuality=Math.min(face(...old).quality,face(...original).quality),quality=Math.min(f1.quality,f2.quality);
      if(f1.alignment<=.5||f2.alignment<=.5||quality<=oldQuality*1.2)continue;
      // Do not introduce an already existing edge or change a boundary.
      const key=edgeKey(c,d);let exists=false;for(let i=0;i<indices.length&&!exists;i+=3)for(let j=0;j<3;j++)if(edgeKey(indices[i+j],indices[i+(j+1)%3])===key){exists=true;break;}if(exists)continue;
      if(!best||quality>best.quality)best={first:failed,second:other.offset,old:[old,original],next:[one,two],quality,oldQuality,alignmentBefore:face(...old).alignment,alignmentAfter:[f1.alignment,f2.alignment]};
    }
    if(!best)throw new Error('Stone fish wave R4: warped sliver has no valid local diagonal');
    indices.splice(best.first,3,...best.next[0]);indices.splice(best.second,3,...best.next[1]);repaired.push(best);
  }
  throw new Error('Stone fish wave R4: local warped triangulation did not converge');
}
