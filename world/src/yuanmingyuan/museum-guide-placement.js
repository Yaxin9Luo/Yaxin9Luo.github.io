import {COMPANION_CLEARANCE,evaluateCompanionSweep} from '../companion-system.js';
import {companionRoutes} from '../companion-route.js';


// This opt-in only ranks initial Jiuzhou positions. It does not replace the
// full body, raised-board, turning or route clearance checks below.
function guideCompositionView(view,visitor){
  const finite=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  if(!finite(view.position)||!finite(view.target)||!finite([visitor.x,visitor.y,visitor.z]))throw new Error('Guide placement needs a finite grounded camera view.');
  const direction=view.target.map((v,i)=>v-view.position[i]),length=Math.hypot(...direction),horizontal=Math.hypot(direction[0],direction[2]);
  if(length<.5||horizontal<1e-6)throw new Error('Guide placement camera needs a nonvertical follow direction.');
  const forward=direction.map(v=>v/length),right=[-direction[2]/horizontal,0,direction[0]/horizontal];
  const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
  const bounds=COMPANION_CLEARANCE.elizabeth.body;
  const groundForward=[direction[0]/horizontal,direction[2]/horizontal];
  function metrics(point){
    const dx=point.x-visitor.x,dz=point.z-visitor.z;
    const distance=Math.hypot(dx,dz),cx=view.position[0]-point.x,cz=view.position[2]-point.z,cameraDistance=Math.hypot(cx,cz);
    // Elizabeth turns authored +Z toward the visitor before raising her sign.
    // This is a facing preference, not a promise about native text visibility.
    const signFacingAlignment=distance>1e-6&&cameraDistance>1e-6?Math.max(-1,Math.min(1,-(dx*cx+dz*cz)/(distance*cameraDistance))):-1;
    return {lateral:dx*right[0]+dz*right[2],behind:dx*groundForward[0]+dz*groundForward[1],distance,signFacingAlignment};
  }
  function rectangle(point){
    const values=[];
    for(const x of [bounds.minX,bounds.maxX])for(const y of [0,bounds.top])for(const z of [bounds.minZ,bounds.maxZ]){
      const delta=[point.x+x-view.position[0],point.y+y-view.position[1],point.z+z-view.position[2]],depth=delta.reduce((sum,n,i)=>sum+n*forward[i],0);
      if(depth<=1e-6)return null;
      values.push([delta.reduce((sum,n,i)=>sum+n*right[i],0)/depth,delta.reduce((sum,n,i)=>sum+n*up[i],0)/depth]);
    }
    return {minX:Math.min(...values.map(p=>p[0])),maxX:Math.max(...values.map(p=>p[0])),minY:Math.min(...values.map(p=>p[1])),maxY:Math.max(...values.map(p=>p[1]))};
  }
  const overlap=(a,b)=>a&&b&&a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
  return {metrics,rectangle,overlap};
}

// Candidate placement uses the same full-footprint support check as the live
// actor, including its raised board. A small circular character probe alone
// can admit a guide whose feet or board span a court/terrain height change.
export function selectMuseumGuidePlacements({site,centre,world,architecture,visitorPosition,entryIds,maximum=3,view}){
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
  const add=(point,body)=>{
    const waypoints=[];
    for(const [x,z]of [[3,0],[3,3],[0,3],[-3,0],[-3,-3],[0,-3]]){
      const goal={x:point.x+x,z:point.z+z};if(!check(goal).valid||!turning(goal).valid)continue;
      const outward=routeBetween({...point,heading:0},goal);
      if(!outward||!routeBetween(outward.points.at(-1),point))continue;
      waypoints.push(goal);break;
    }
    // A safe standing guide still offers its exhibit if no short patrol fits.
    placements.push({id:site.id+'-guide-'+(placements.length+1),entryId:entryIds[placements.length%entryIds.length],position:{x:point.x,z:point.z,y:body.position.y},heading:0,waypoints});
  };
  if(view){
    const frame=guideCompositionView(view,visitorPosition),supported=new Map(),decisions=[];
    const candidates=offsets.map(({row,column},index)=>({x:centre.x+column*3.5,z:centre.z+row*3.5,index}));
    const support=point=>{
      if(!supported.has(point.index)){
        const body=check(point),sign=body.valid?turning(point):body;
        if(!sign.valid)rejected.push({x:point.x,z:point.z,reason:sign.reason});
        supported.set(point.index,sign.valid?body:null);
      }
      return supported.get(point.index);
    };
    for(let slot=0;slot<maximum;slot++){
      const primary=slot===0,previous=placements.map(p=>frame.rectangle(p.position));
      const preferred=point=>{
        const m=frame.metrics(point),r=frame.rectangle(point);
        if(m.behind<0||Math.abs(m.lateral)<(primary?2:3.5)||!r||r.minX<=0&&r.maxX>=0)return false;
        if(primary&&(m.distance>6.25||Math.abs(point.y-visitorPosition.y)>3.5||m.signFacingAlignment<.5))return false;
        if(!primary&&m.behind<frame.metrics(placements[0].position).behind)return false;
        return previous.every(p=>!frame.overlap(r,p));
      };
      const rank=points=>[...points].sort((a,b)=>{
        const score=p=>{const m=frame.metrics(p);return Math.abs(Math.abs(m.lateral)-(primary?4.8:9))+Math.abs(m.behind-(primary?1.5:5))*.5+(primary?(1-m.signFacingAlignment)*8:0);};
        return score(a)-score(b)||a.index-b.index;
      });
      let chosen=null,body=null,usedPreference=false,chosenGrid=3.5;
      // Keep a successful original coarse preference. Only the current exhibit
      // gets a finer second pass; it still lives inside the old 14 m extent.
      // The safe fallback remains the original coarse candidate order.
      for(const phase of primary?['coarse','fine','fallback']:['coarse','fallback']){
        const prefer=phase!=='fallback';let search=candidates;
        if(phase==='fine'){
          search=[];
          for(let row=-28;row<=28;row++)for(let column=-28;column<=28;column++){
            if(row%7===0&&column%7===0)continue;
            const point={x:centre.x+column*.5,z:centre.z+row*.5,index:81+(row+28)*57+column+28};
            const distance=frame.metrics(point).distance;
            if(distance>=4.8&&distance<=6.25&&preferred({...point,y:visitorPosition.y}))search.push(point);
          }
        }
        for(const point of prefer?rank(search):search){
          if(frame.metrics(point).distance<4.8||placements.some(p=>Math.hypot(p.position.x-point.x,p.position.z-point.z)<7))continue;
          if(prefer&&!preferred({...point,y:visitorPosition.y}))continue;
          const supportedBody=support(point);if(!supportedBody)continue;
          if(prefer&&!preferred({...point,y:supportedBody.position.y}))continue;
          chosen=point;body=supportedBody;usedPreference=prefer;chosenGrid=phase==='fine'?.5:3.5;break;
        }
        if(chosen)break;
      }
      if(!chosen)break;
      add(chosen,body);
      decisions.push({id:placements.at(-1).id,role:primary?'current-exhibit':'related-exhibit',selection:usedPreference?'preferred':'legacy-safe-fallback',searchGridMetres:chosenGrid,metrics:frame.metrics(placements.at(-1).position),projectedBody:frame.rectangle(placements.at(-1).position)});
    }
    return {placements,rejected,compositionReview:{position:[...view.position],target:[...view.target],maximum,decisions,scope:'Initial body-envelope ranking only; native sign-hold readability remains unverified.'}};
  }
  for(const {row,column}of offsets){
    if(placements.length===maximum)break;
    // Keep the old 14 m search extent and 7 m guide separation; half-grid
    // candidates let a guide move beside a narrow path instead of onto it.
    const point={x:centre.x+column*3.5,z:centre.z+row*3.5};
    if(Math.hypot(point.x-visitorPosition.x,point.z-visitorPosition.z)<4.8||placements.some(p=>Math.hypot(p.position.x-point.x,p.position.z-point.z)<7))continue;
    const body=check(point),sign=body.valid?turning(point):body;
    if(!sign.valid){rejected.push({...point,reason:sign.reason});continue;}
    add(point,body);
  }
  return {placements,rejected};
}
