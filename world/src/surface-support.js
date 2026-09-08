/** Height queries over the same static triangles used to render roads and walks. */
export function createSurfaceSupport(baseHeight,cellSize=4){
  const cells=new Map(),key=(x,z)=>`${x},${z}`;
  function addGeometry(geometry){
    const p=geometry.getAttribute('position'),index=geometry.index,count=index?.count||p.count;
    for(let i=0;i<count;i+=3){
      const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
      const ax=p.getX(a),az=p.getZ(a),bx=p.getX(b)-ax,bz=p.getZ(b)-az,cx=p.getX(c)-ax,cz=p.getZ(c)-az,det=bx*cz-cx*bz;
      if(Math.abs(det)<1e-10)continue;
      const triangle={ax,az,bx,bz,cx,cz,det,ay:p.getY(a),by:p.getY(b)-p.getY(a),cy:p.getY(c)-p.getY(a)};
      const dx=(triangle.by*cz-triangle.cy*bz)/det,dz=(bx*triangle.cy-cx*triangle.by)/det,length=Math.hypot(dx,1,dz);
      triangle.normal={x:-dx/length,y:1/length,z:-dz/length};
      const minX=Math.floor(Math.min(ax,ax+bx,ax+cx)/cellSize),maxX=Math.floor(Math.max(ax,ax+bx,ax+cx)/cellSize);
      const minZ=Math.floor(Math.min(az,az+bz,az+cz)/cellSize),maxZ=Math.floor(Math.max(az,az+bz,az+cz)/cellSize);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const id=key(x,z),bucket=cells.get(id)||[];bucket.push(triangle);cells.set(id,bucket);}
    }
  }
  function sample(x,z,withNormal=false){
    let height=baseHeight(x,z),selected=null;
    for(const t of cells.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)))||[]){
      const dx=x-t.ax,dz=z-t.az,u=(dx*t.cz-dz*t.cx)/t.det,v=(t.bx*dz-t.bz*dx)/t.det;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7){const y=t.ay+u*t.by+v*t.cy;if(y>=height){height=y;selected=t;}}
    }
    if(!withNormal)return height;
    let normal=selected?.normal||baseHeight.surfaceAt?.(x,z).normal;
    if(!normal){
      const epsilon=.08,dx=(baseHeight(x+epsilon,z)-baseHeight(x-epsilon,z))/(2*epsilon),dz=(baseHeight(x,z+epsilon)-baseHeight(x,z-epsilon))/(2*epsilon),length=Math.hypot(dx,1,dz);
      normal={x:-dx/length,y:1/length,z:-dz/length};
    }
    return {height,normal:{...normal}};
  }
  const heightAt=(x,z)=>sample(x,z);
  // Retain triangle normals through stacked road/grove height functions. A
  // finite difference across a raised edge describes the riser, not the floor.
  heightAt.surfaceAt=(x,z)=>sample(x,z,true);
  return {addGeometry,heightAt,surfaceAt:heightAt.surfaceAt};
}
