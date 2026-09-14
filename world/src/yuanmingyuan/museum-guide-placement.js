import {COMPANION_CLEARANCE,evaluateCompanionSweep} from '../companion-system.js';
import {companionRoutes} from '../companion-route.js';

// Candidate placement uses the same full-footprint support check as the live
// actor, including its raised board. A small circular character probe alone
// can admit a guide whose feet or board span a court/terrain height change.
export function selectMuseumGuidePlacements({site,centre,world,architecture,visitorPosition,entryIds,maximum=3}){
  const offsets=[];for(let row=-4;row<=4;row++)for(let column=-4;column<=4;column++)offsets.push({row,column});
  offsets.sort((a,b)=>a.row*a.row+a.column*a.column-b.row*b.row-b.column*b.column||a.row-b.row||a.column-b.column);
  const placements=[],rejected=[],turns=new Map();
  const check=(point,interaction=false,to=point)=>{
    const pose={...point,heading:point.heading??0},end={...to,heading:to.heading??0},colliders=world.collidersFor?.(pose,end,'elizabeth',interaction)??world.colliders??[];
    const support=evaluateCompanionSweep({kind:'elizabeth',from:pose,to:end,heightAt:world.heightAt,waterLevel:world.waterLevel??2,colliders,interaction,sweepBlocked:world.sweepBlocked});
    if(!support.valid)return support;
    const bounds=COMPANION_CLEARANCE.elizabeth[interaction?'interaction':'body'];
    const radius=Math.hypot(Math.max(-bounds.minX,bounds.maxX)+.22,Math.max(-bounds.minZ,bounds.maxZ)+.22);
    if(!world.sweepBlocked&&architecture?.capsuleBlocked({...point,y:support.position.y,radius,height:bounds.top+.08}))return {valid:false,reason:'architecture-clearance'};
    return support;
  };
  const turning=(point)=>{
    const key=JSON.stringify([point.x,point.z]);if(turns.has(key))return turns.get(key);
    let result;
    // Four continuous quarter turns reserve the full raised board. A 0→2π
    // request would normalize to zero in the live shortest-angle sweep.
    for(let i=0;i<4;i++){
      result=check({...point,heading:i*Math.PI/2},true,{...point,heading:(i+1)*Math.PI/2});
      if(!result.valid)break;
    }
    turns.set(key,result);return result;
  };
  const routeBetween=(from,goal)=>{
    // The legacy capsule is sufficient for the enclosing stationary turn,
    // but cannot certify an intervening architectural translation.
    if(architecture&&!world.sweepBlocked)return undefined;
    return companionRoutes(from,goal,.95).find(route=>route.points.slice(1).every((to,index)=>check(route.points[index],false,to).valid));
  };
  for(const {row,column}of offsets){
    if(placements.length===maximum)break;
    // Keep the old 14 m search extent and 7 m guide separation; half-grid
    // candidates let a guide move beside a narrow path instead of onto it.
    const point={x:centre.x+column*3.5,z:centre.z+row*3.5};
    if(Math.hypot(point.x-visitorPosition.x,point.z-visitorPosition.z)<4.8||placements.some(p=>Math.hypot(p.position.x-point.x,p.position.z-point.z)<7))continue;
    const body=check(point),sign=body.valid?turning(point):body;
    if(!sign.valid){rejected.push({...point,reason:sign.reason});continue;}
    const waypoints=[];
    for(const [x,z]of [[3,0],[3,3],[0,3],[-3,0],[-3,-3],[0,-3]]){
      const goal={x:point.x+x,z:point.z+z};if(!check(goal).valid||!turning(goal).valid)continue;
      const outward=routeBetween({...point,heading:0},goal);
      if(!outward||!routeBetween(outward.points.at(-1),point))continue;
      waypoints.push(goal);break;
    }
    // A safe standing guide still offers its exhibit if no short patrol fits.
    placements.push({id:`${site.id}-guide-${placements.length+1}`,entryId:entryIds[placements.length%entryIds.length],position:{...point,y:body.position.y},heading:0,waypoints});
  }
  return {placements,rejected};
}
