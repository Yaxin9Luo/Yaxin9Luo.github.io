export const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function convexFootprint(points){
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.z-b.z);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return half(sorted).slice(0,-1).concat(half([...sorted].reverse()).slice(0,-1));
}

/** Vertical planes bound a conservative projection of the complete solid.
 * Sloped-only, malformed and horizontally unbounded shapes return null. */
export function horizontalProjection(source,epsilon=0){
  if(!Array.isArray(source)||!source.every(p=>Array.isArray(p)&&p.length===4&&p.every(Number.isFinite)))return null;
  const planes=source.filter(p=>p[1]===0).map(([a,b,c,d])=>[a,b,c,d+epsilon]),points=[];
  const angles=planes.filter(p=>Math.hypot(p[0],p[2])>1e-8).map(p=>Math.atan2(p[2],p[0])).sort((a,b)=>a-b);
  if(angles.length<3||angles.some((a,i)=>angles[(i+1)%angles.length]+(i===angles.length-1?Math.PI*2:0)-a>=Math.PI-1e-8))return null;
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
    const [a,,b,d]=planes[i],[c,,e,f]=planes[j],det=a*e-b*c;if(Math.abs(det)<1e-8)continue;
    const x=(d*e-b*f)/det,z=(a*f-d*c)/det;
    if(planes.every(([nx,,nz,k])=>nx*x+nz*z<=k+1e-8))points.push({x,z});
  }
  return points.length>=3?convexFootprint(points):null;
}
