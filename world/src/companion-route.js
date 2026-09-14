const TAU=Math.PI*2,positive=value=>(value%TAU+TAU)%TAU;

// Two forward-only circle/tangent candidates. Rotation is accompanied by real
// translation, so the authored walk can turn without an idle planted-paw pivot.
export function companionRoutes(from,goal,radius){
  const dx=goal.x-from.x,dz=goal.z-from.z,s=Math.sin(from.heading),c=Math.cos(from.heading);
  const forward=dx*s+dz*c,lateral=dx*c-dz*s;
  // Subtracting translated world positions and taking the tangent angle can
  // leave a mathematically zero turn just below zero; modulo then adds 2π.
  // Admit only forward collinearity within arithmetic roundoff, never a
  // geometric clearance tolerance. The normal sweep still checks every step.
  const roundoff=8*Number.EPSILON*Math.max(1,Math.abs(from.x),Math.abs(from.z),Math.abs(goal.x),Math.abs(goal.z))*(Math.abs(s)+Math.abs(c));
  if(forward>roundoff&&Math.abs(lateral)<=roundoff){
    const length=Math.hypot(dx,dz),steps=Math.ceil(length/.10),points=[{...from}];
    for(let i=1;i<=steps;i++)points.push({x:from.x+dx*i/steps,z:from.z+dz*i/steps,heading:from.heading});
    return [{points,length}];
  }
  const candidates=[];
  for(const turn of [-1,1]){
    const cx=from.x+turn*radius*Math.cos(from.heading),cz=from.z-turn*radius*Math.sin(from.heading);
    const dx=goal.x-cx,dz=goal.z-cz,distance=Math.hypot(dx,dz);
    if(distance<radius-1e-8)continue;
    const base=Math.atan2(dz,dx),offset=Math.acos(Math.min(1,radius/distance));
    for(const angle of offset<1e-8?[base]:[base-offset,base+offset]){
      const tx=cx+radius*Math.cos(angle),tz=cz+radius*Math.sin(angle),fx=turn*Math.sin(angle),fz=-turn*Math.cos(angle);
      if(Math.hypot(goal.x-tx,goal.z-tz)>1e-7&&(goal.x-tx)*fx+(goal.z-tz)*fz<=0)continue;
      const start=Math.atan2(from.z-cz,from.x-cx),arc=positive(turn*(start-angle)),endHeading=from.heading+turn*arc;
      const points=[{...from}],arcSteps=Math.ceil(arc*radius/.10),line=Math.hypot(goal.x-tx,goal.z-tz),lineSteps=Math.ceil(line/.10);
      for(let i=1;i<=arcSteps;i++){
        const heading=from.heading+turn*arc*i/arcSteps;
        points.push({x:cx-turn*radius*Math.cos(heading),z:cz+turn*radius*Math.sin(heading),heading});
      }
      for(let i=1;i<=lineSteps;i++)points.push({x:tx+(goal.x-tx)*i/lineSteps,z:tz+(goal.z-tz)*i/lineSteps,heading:endHeading});
      candidates.push({points,length:arc*radius+line});
    }
  }
  return candidates.sort((a,b)=>a.length-b.length);
}
