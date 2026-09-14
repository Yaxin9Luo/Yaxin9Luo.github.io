import {Quaternion,Vector3} from 'three';
import {createCompanionActor} from './companion-assets.js';
import {isWalkableSurface} from './ground-motion.js';
import {companionRoutes} from './companion-route.js';
import {convexFootprint,horizontalProjection,cross} from './companion-footprint.js';

// Accepted GLBs, delivery-metrics.json: sampled unions rounded OUTWARD. The
// extra horizontal skin also covers unsampled clip extrema and planted feet.
const envelope=(minX,maxX,minZ,maxZ,top)=>Object.freeze({minX,maxX,minZ,maxZ,top});
export const COMPANION_CLEARANCE=Object.freeze({
  elizabeth:Object.freeze({body:envelope(-.99743,.98702,-1.36806,1.04603,3.02751),interaction:envelope(-1.01046,2.44790,-1.36806,1.04603,3.31505)}),
  sadaharu:Object.freeze({body:envelope(-.84468,.84339,-2.01099,1.31551,3.02752),interaction:envelope(-.93086,.92863,-2.20971,1.46762,3.12227)}),
});
const SKIN=.22,GROUND_SPACING=.22,SWEEP_SPACING=.10,MAX_SPREAD=.065,STEP=1/60;
const TAU=Math.PI*2,angleDelta=(a,b)=>((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;
const finitePose=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.heading??0);
const pointAt=(p,x,z)=>({x:p.x+Math.cos(p.heading)*x+Math.sin(p.heading)*z,z:p.z-Math.sin(p.heading)*x+Math.cos(p.heading)*z});

function supportAt(p,bounds,heightAt,waterLevel){
  const nx=Math.ceil((bounds.maxX-bounds.minX+2*SKIN)/GROUND_SPACING);
  const nz=Math.ceil((bounds.maxZ-bounds.minZ+2*SKIN)/GROUND_SPACING);
  let low=Infinity,high=-Infinity;const surfaces=new Set();
  // A full grid checks the interior as well as all four edges. This is bounded
  // terrain sampling, not a certificate for sub-grid holes in an arbitrary fn.
  for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
    const p0=pointAt(p,bounds.minX-SKIN+(bounds.maxX-bounds.minX+2*SKIN)*ix/nx,bounds.minZ-SKIN+(bounds.maxZ-bounds.minZ+2*SKIN)*iz/nz);
    const surface=heightAt.surfaceAt?.(p0.x,p0.z),y=surface?.height??heightAt(p0.x,p0.z);
    if(!Number.isFinite(y))return {valid:false,reason:'missing-support'};
    if(y<=waterLevel+.10)return {valid:false,reason:'shore'};
    low=Math.min(low,y);high=Math.max(high,y);
    if(surface?.surfaceId&&surface.normal?.y>.5)surfaces.add(surface.surfaceId);
    if(high-low>MAX_SPREAD)return {valid:false,reason:'grade'};
  }
  // Keep the complete unpitched body above the surface. The actor's existing
  // bounded sole correction absorbs <=65 mm variation without accumulating.
  return {valid:true,y:high,floor:low,spread:high-low,surfaces};
}

function corners(p,bounds,extra=0){
  const result=[];
  for(const x of [bounds.minX-SKIN-extra,bounds.maxX+SKIN+extra])for(const z of [bounds.minZ-SKIN-extra,bounds.maxZ+SKIN+extra]){
    const q=pointAt(p,x,z);
    for(const y of [(p.floor??p.y)+.002,p.y+bounds.top+.08])result.push({...q,y});
  }
  return result;
}
function validSolid(s){return s&&Number.isFinite(s.bottom)&&Number.isFinite(s.top)&&s.bottom<=s.top&&s.planes?.length>=4&&s.planes.every(p=>p.length===4&&p.every(Number.isFinite)&&Math.hypot(...p.slice(0,3))>0);}
function intersects(vertices,solid){
  // A separating collider plane proves clearance. Retaining all other cases
  // is conservative for convex solids and preserves continuous thin-wall tests.
  if(solid.planes.some(([nx,ny,nz,d])=>vertices.every(p=>nx*p.x+ny*p.y+nz*p.z>d+1e-8)))return false;
  // Collider planes alone miss a separating axis on the rotated actor. Use a
  // proven bounded projection; unresolved sloped shapes remain conservative.
  const projection=horizontalProjection(solid.planes);if(!projection)return true;
  const footprint=convexFootprint(vertices);
  return !footprint.some((a,i)=>projection.every(p=>cross(a,footprint[(i+1)%footprint.length],p)<-1e-8));
}
function supportWitness(vertices,solid,heightAt){
  if(!heightAt.surfaceAt)return false;
  let polygon=convexFootprint(vertices);const slice=Math.min(solid.top,Math.max(solid.bottom,Math.min(...vertices.map(p=>p.y))));
  // Clip the swept footprint against this exact upper face. A grid can miss a
  // few millimetres of brick at a rotating corner; its actual supporting face
  // must still win the shared support query at a point inside that overlap.
  for(const [nx,ny,nz,d] of solid.planes){
    const out=[],value=p=>nx*p.x+nz*p.z+ny*slice-d;
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],da=value(a),db=value(b);
      if(da<=1e-8)out.push(a);
      if((da<0)!==(db<0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
    }
    polygon=out;if(!polygon.length)return false;
  }
  const point=polygon.reduce((p,q)=>({x:p.x+q.x/polygon.length,z:p.z+q.z/polygon.length}),{x:0,z:0}),surface=heightAt.surfaceAt(point.x,point.z);
  return surface?.surfaceId===solid.id&&surface.normal?.y>.5&&surface.height>=slice-1e-5&&surface.height<=solid.top+1e-5;
}

/** Live terrain + current convex collision proxies; from/to are WORLD metres. */
export function evaluateCompanionSweep({kind,from,to=from,interaction=false,heightAt,colliders=[],waterLevel=0,sweepBlocked}={}){
  const bounds=COMPANION_CLEARANCE[kind]?.[interaction?'interaction':'body'];
  if(!bounds||!finitePose(from)||!finitePose(to)||typeof heightAt!=='function'||!Number.isFinite(waterLevel)||!Array.isArray(colliders)||!colliders.every(validSolid)||(sweepBlocked!==undefined&&typeof sweepBlocked!=='function'))return {valid:false,reason:'invalid-world'};
  const start={...from,heading:from.heading??0},end={...to,heading:to.heading??0};
  const turn=angleDelta(start.heading,end.heading),distance=Math.hypot(end.x-start.x,end.z-start.z);
  const stationary=distance===0&&turn===0;
  // Bound work for caller mistakes; district waypoints are short local walks.
  if(distance>80)return {valid:false,reason:'route-too-long'};
  const segments=Math.max(1,Math.ceil(distance/SWEEP_SPACING),Math.ceil(Math.abs(turn)/.04));
  const radius=Math.hypot(Math.max(-bounds.minX,bounds.maxX)+SKIN,Math.max(-bounds.minZ,bounds.maxZ)+SKIN);
  const arcSlack=radius*(1-Math.cos(Math.abs(turn)/segments/2));
  let previous=null,previousSupport=null,maxSpread=0;
  for(let i=0;i<=segments;i++){
    const t=i/segments,p={x:start.x+(end.x-start.x)*t,z:start.z+(end.z-start.z)*t,heading:start.heading+turn*t};
    // Identical endpoints share support only; retain both obstacle/witness checks.
    const support=stationary&&previousSupport?previousSupport:supportAt(p,bounds,heightAt,waterLevel);
    if(!support.valid)return support;
    p.y=support.y;p.floor=support.floor;maxSpread=Math.max(maxSpread,support.spread);
    if(previous&&Math.abs(p.y-previous.y)>.04)return {valid:false,reason:'grade'};
    const vertices=[...(previous?corners(previous,bounds,arcSlack):[]),...corners(p,bounds,arcSlack)];
    for(const solid of colliders){
      // Only a queried, upward, reachable support face can be contact. A
      // walkable flag alone cannot excuse a wall, overhead deck or unseen curb.
      const reachable=isWalkableSurface(solid)&&solid.top<=Math.min(p.y,previous?.y??p.y)+.002&&solid.bottom<=Math.min(p.floor,previous?.floor??p.floor)+.006;
      if(reachable&&(support.surfaces.has(solid.id)||previousSupport?.surfaces.has(solid.id)))continue;
      if(intersects(vertices,solid)&&!(reachable&&supportWitness(vertices,solid,heightAt)))return {valid:false,reason:'obstacle',obstacle:solid.id??null};
    }
    // Optional exact architectural collision. It sees the SAME supported,
    // skin/sagitta-expanded continuous segment as the convex obstacle checks;
    // all route, movement, turning and raised-board paths use this function.
    if(sweepBlocked){
      const blocked=sweepBlocked({kind,interaction,from:previous??p,to:p,vertices,supportSurfaceIds:[...new Set([...support.surfaces,...(previousSupport?.surfaces??[])])]});
      if(typeof blocked!=='boolean')return {valid:false,reason:'invalid-world'};
      if(blocked)return {valid:false,reason:'architecture-obstacle'};
    }
    previous=p;previousSupport=support;
  }
  return {valid:true,reason:null,position:previous,supportSpread:maxSpread};
}

export const COMPANION_SIGNS=Object.freeze({
  welcome:Object.freeze({en:'Just passing by? Welcome.',zh:'路过也欢迎。'}),
  rest:Object.freeze({en:"Take your time. I'll stand here.",zh:'你慢慢看，我慢慢站。'}),
  evening:Object.freeze({en:'Made a little something today.',zh:'今天也写了点东西。'}),
});
const labels={elizabeth:{en:'Elizabeth',zh:'伊丽莎白'},sadaharu:{en:'Sadaharu',zh:'定春'}};
const actionLabels={elizabeth:{en:'Say hello',zh:'打个招呼'},sadaharu:{en:'Greet Sadaharu',zh:'和定春打招呼'}};
let ownerSerial=0;
function seeded(seed){let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
function nameSeed(name){let value=0;for(const c of name)value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;return value;}

function actorSolid(record){
  const p=record.position,b=COMPANION_CLEARANCE[record.kind][record.busy?'interaction':'body'];
  const c=Math.cos(p.heading),s=Math.sin(p.heading),x=c*p.x-s*p.z,z=s*p.x+c*p.z;
  const bottom=(p.floor??p.y)+.002;
  return {id:`companion:${record.id}`,bottom,top:p.y+b.top+.08,planes:[
    [c,0,-s,x+b.maxX+SKIN],[-c,0,s,-x-b.minX+SKIN],
    [s,0,c,z+b.maxZ+SKIN],[-s,0,-c,-z-b.minZ+SKIN],
    [0,1,0,p.y+b.top+.08],[0,-1,0,-bottom],
  ]};
}

/**
 * Assets must already be decoded. Placements/waypoints are explicit, bounded
 * staging candidates, never a promise that the final island is clear.
 * getWorld() (or rebind) supplies replacement support/collider bindings.
 * onSound receives immediate original-foley events; onSilence cancels this
 * owner's tails in the existing WorldAudio. Neither callback creates a clock.
 */
export function createCompanionSystem({root,heightAt,colliders=[],waterLevel=0,sweepBlocked,getWorld,placements,seed=7219,language='en',isActive=()=>true,onMessage=()=>{},onSound=()=>{},onSilence=()=>{},createActor=createCompanionActor,onInspect=()=>{}}={}){
  if(!root?.isObject3D||!Array.isArray(placements)||!placements.length)throw new TypeError('Companions require a scene root and explicit placements.');
  const scale=root.getWorldScale(new Vector3());
  if([scale.x,scale.y,scale.z].some(v=>Math.abs(v-1)>1e-6))throw new Error('Companions require an unscaled world parent to preserve accepted dimensions.');
  const ids=new Set();
  for(const p of placements){
    const id=p.id??p.kind;
    if(!COMPANION_CLEARANCE[p.kind]||typeof id!=='string'||ids.has(id)||!finitePose({...p.position,heading:p.heading})||(p.waypoints??[]).some(w=>!finitePose(w)))throw new TypeError('Invalid or duplicate companion placement.');
    ids.add(id);
  }
  const owner=`companion-system:${++ownerSerial}`,records=[],pickMeshes=[];
  let bindings={heightAt,colliders,waterLevel,sweepBlocked},disposed=false,paused=false,reducedMotion=false,activeTime=0,accumulator=0,soundEvents=0;
  let lang=language==='zh'?'zh':'en',playerPosition=null,night=0,updating=false,inactive=false;
  const quaternion=new Quaternion(),inverseParent=new Quaternion(),axis=new Vector3(0,1,0),worldPosition=new Vector3();
  const liveWorld=()=>{const world={...bindings,...getWorld?.()};return {...world,colliders:typeof world.colliders==='function'?world.colliders():world.colliders};};
  const active=()=>!disposed&&!paused&&isActive();
  function silence(reason){onSilence({owner,reason});}
  function guard(){
    if(active()){inactive=false;return true;}
    accumulator=0;if(!inactive&&!disposed){inactive=true;silence('inactive');}return false;
  }
  function check(record,to=record.position,interaction=record.busy,includeVisitor=true){
    const world=liveWorld();
    if(world.collidersFor)world.colliders=world.collidersFor(record.position,to,record.kind,interaction);
    const obstacles=records.filter(r=>r!==record&&r.valid).map(actorSolid);
    if(includeVisitor&&world.visitorCollider)obstacles.push(world.visitorCollider);
    return evaluateCompanionSweep({kind:record.kind,from:record.position,to,interaction,...world,colliders:Array.isArray(world.colliders)?world.colliders.concat(obstacles):world.colliders});
  }
  function applyTransform(record){
    worldPosition.set(record.position.x,record.position.y,record.position.z);
    root.updateWorldMatrix(true,false);
    record.actor.group.position.copy(root.worldToLocal(worldPosition));
    inverseParent.copy(root.getWorldQuaternion(quaternion)).invert();
    record.actor.group.quaternion.setFromAxisAngle(axis,record.position.heading).premultiply(inverseParent);
    record.actor.group.updateWorldMatrix(true,true);
  }
  const support=({position})=>liveWorld().heightAt?.(position.x,position.z);
  function sound(record,kind,foot){
    if(!guard()||reducedMotion)return;
    soundEvents++;record.soundEvents++;
    onSound({owner,actorId:record.id,kind,variant:(nameSeed(record.id)+record.soundEvents)%4,time:activeTime,
      position:foot?{x:foot.position.x,y:foot.position.y+foot.correction,z:foot.position.z}:{x:record.position.x,y:record.position.y+1,z:record.position.z},...(foot?{foot:foot.name}:{})});
    guard();
  }
  function enter(record,state,remaining=0,action=state){
    record.state=state;record.remaining=remaining;record.speed=0;
    record.actor.setAction(action);record.contacts.clear();
  }
  function rest(record){record.completableInteraction=false;record.busy=false;record.goal=null;record.route=null;enter(record,'rest',1.5+record.random()*2,'idle');}
  function invalidate(record,reason){
    if(record.valid)silence('invalid-support');
    record.completableInteraction=false;record.valid=false;record.reason=reason;record.actor.group.visible=false;
    record.busy=false;record.goal=null;enter(record,'unsited',0,'idle');
  }
  function validateCurrent(record){
    const result=check(record,record.position,record.busy,false);
    if(!result.valid){invalidate(record,result.reason);return false;}
    record.position.y=result.position.y;record.position.floor=result.position.floor;record.supportSpread=result.supportSpread;record.reason=null;
    if(!record.valid){record.valid=true;record.actor.group.visible=true;rest(record);}
    applyTransform(record);return true;
  }
  function chooseRoute(record){
    record.routeReview={attempts:(record.routeReview?.attempts??0)+1,candidates:0,rejected:{},lastRejected:null};
    const offset=record.loop?record.waypointCursor:Math.floor(record.random()*record.waypoints.length);
    for(let i=0;i<record.waypoints.length;i++){
      const goal=record.waypoints[(offset+i)%record.waypoints.length];
      if(Math.hypot(goal.x-record.position.x,goal.z-record.position.z)<.35)continue;
      const world=liveWorld(),obstacles=records.filter(r=>r!==record&&r.valid).map(actorSolid);
      if(world.visitorCollider)obstacles.push(world.visitorCollider);
      for(const route of companionRoutes(record.position,goal,record.kind==='elizabeth'?.95:1.25)){
        record.routeReview.candidates++;
        const valid=route.points.slice(1).every((to,index)=>{
          const from=route.points[index],colliders=world.collidersFor?.(from,to,record.kind,false)??world.colliders;
          const result=evaluateCompanionSweep({kind:record.kind,from,to,...world,colliders:Array.isArray(colliders)?colliders.concat(obstacles):colliders});
          if(!result.valid){const review=record.routeReview;review.rejected[result.reason]=(review.rejected[result.reason]??0)+1;review.lastRejected={reason:result.reason,obstacle:result.obstacle??null,from:{...from},to:{...to},goal:{...goal}};}
          return result.valid;
        });
        if(!valid)continue;
        record.goal={x:goal.x,z:goal.z};record.goalIndex=(offset+i)%record.waypoints.length;record.route=route.points;record.routeIndex=1;enter(record,'walk',0,'walk');return;
      }
    }
    // Greeting-facing forward arcs can leave the supported court even when
    // its original heading is still reachable. Keep that recovery pending if
    // a live visitor/actor/obstacle blocks the complete swept rotation.
    if(record.recoveryHeading!==null&&Math.abs(angleDelta(record.position.heading,record.recoveryHeading))>1e-9&&check(record,{...record.position,heading:record.recoveryHeading},false).valid){
      record.targetHeading=record.recoveryHeading;enter(record,'turn',0,'idle');return;
    }
    rest(record);
  }
  function completePhase(record){
    const d=record.actor.asset.durations;
    switch(record.state){
      case 'attention':
        if(record.kind==='elizabeth'){enter(record,'raise',d.sign_raise,'sign_raise');sound(record,'sign-lift');}
        else{enter(record,'greet',d.greet);sound(record,'dog-collar');}
        break;
      case 'raise':enter(record,'hold',3.2,'sign_hold');sound(record,'sign-tap');if(guard()&&record.exhibitId)onInspect({id:record.id,entryId:record.exhibitId});break;
      case 'hold':enter(record,'lower',d.sign_lower,'sign_lower');break;
      case 'greet':enter(record,'sniff',d.sniff);sound(record,'dog-breath');break;
      case 'sniff':enter(record,'sit',d.sit);break;
      case 'sit':enter(record,'seated',1.6,'sit');break;
      case 'seated':enter(record,'stand',d.stand);break;
      case 'lower':case 'stand':
        if(record.busy&&record.completableInteraction)record.completedInteraction={interactionCount:record.interactionCount,startedAt:record.interactionStartedAt,completedAt:activeTime,distance:record.distance,resumedAt:null,resumedDistance:null};
        record.cooldownUntil=activeTime+1.1;rest(record);break;
      case 'rest':chooseRoute(record);break;
    }
  }
  function tick(record){
    if(!validateCurrent(record)||!guard())return;
    let travelled=0;
    if(record.state==='face'||record.state==='turn'){
      const delta=angleDelta(record.position.heading,record.targetHeading);
      const heading=record.position.heading+Math.max(-.9*STEP,Math.min(.9*STEP,delta));
      const result=check(record,{...record.position,heading});
      if(!result.valid){rest(record);}else{
        record.position={...result.position};applyTransform(record);
        if(Math.abs(delta)<=.9*STEP+1e-9){
          if(record.state==='face')enter(record,'attention',.2,'idle');
          // Finish the restored heading in idle. The next accepted step can
          // plan a walk, so no walk frame rotates without actual translation.
          else if(Math.abs(delta)<=1e-9)chooseRoute(record);
        }
      }
    }else if(record.state==='walk'){
      const goal=record.route[record.routeIndex],dx=goal.x-record.position.x,dz=goal.z-record.position.z,distance=Math.hypot(dx,dz);
      const stride=Math.min(distance,(record.kind==='elizabeth'?.48:.54)*STEP);
      const next={...record.position,x:record.position.x+(distance?dx/distance*stride:0),z:record.position.z+(distance?dz/distance*stride:0),heading:record.position.heading+angleDelta(record.position.heading,goal.heading)*(distance?stride/distance:1)};
      const result=check(record,next,false);
      if(!result.valid){rest(record);}else{
        travelled=Math.hypot(result.position.x-record.position.x,result.position.y-record.position.y,result.position.z-record.position.z);
        record.position={...result.position};record.distance+=travelled;record.speed=travelled/STEP;if(travelled>0)record.recoveryHeading=null;applyTransform(record);
        const completed=record.completedInteraction;
        if(completed?.interactionCount===record.interactionCount&&completed.resumedAt===null&&record.distance>completed.distance+.05){completed.resumedAt=activeTime;completed.resumedDistance=record.distance;}
        // Finish the travelled gait increment before changing to the idle pose.
        if(distance<=stride+1e-8){record.routeIndex++;if(record.routeIndex>=record.route.length)record.arrived=true;}
      }
    }else if(record.remaining>0){record.remaining-=STEP;}
    if(!guard())return;
    record.actor.update(STEP,{speed:travelled/STEP,getSupportHeight:support});
    if(travelled>0)for(const foot of record.actor.footStates.values()){
      if(foot.planted&&record.contacts.get(foot.name)===false)sound(record,record.kind==='elizabeth'?'elizabeth-step':'dog-step',foot);
      record.contacts.set(foot.name,foot.planted);
      if(!guard())return;
    }
    if(record.arrived){
      record.arrived=false;record.waypointCursor=(record.goalIndex+1)%record.waypoints.length;
      if(record.loop&&record.waypointCursor!==1)chooseRoute(record);
      else{rest(record);record.actor.update(0,{getSupportHeight:support});}
    }
    else if(record.remaining<=1e-8&&!['turn','face','walk','unsited'].includes(record.state))completePhase(record);
  }
  function applyReduced(record){
    record.completableInteraction=false;
    if(!validateCurrent(record))return;
    if(record.reducedApplied){record.actor.update(0,{reducedMotion:true,getSupportHeight:support});return;}
    record.reducedApplied=true;record.speed=0;record.contacts.clear();
    if(record.busy){
      const facing=check(record,{...record.position,heading:record.targetHeading},true);
      if(!facing.valid){rest(record);record.actor.update(0,{reducedMotion:true,getSupportHeight:support});return;}
      record.position={...facing.position};applyTransform(record);
      enter(record,record.kind==='elizabeth'?'reduced-sign':'reduced-sit',0,record.kind==='elizabeth'?'sign_hold':'sit');
    }
    record.actor.update(0,{reducedMotion:true,getSupportHeight:support});
  }
  function releaseReduced(record){
    if(!record.reducedApplied)return;record.reducedApplied=false;record.contacts.clear();
    if(record.state==='reduced-sign')enter(record,'hold',3.2,'sign_hold');
    if(record.state==='reduced-sit')enter(record,'stand',record.actor.asset.durations.stand,'stand');
  }
  try{
    for(const p of placements){
      const id=p.id??p.kind,actor=createActor(p.kind,{lang},p),random=seeded((seed>>>0)^nameSeed(id));
      const record={id,kind:p.kind,actor,random,position:{x:p.position.x,z:p.position.z,y:0,heading:p.heading??0},
        waypoints:[{x:p.position.x,z:p.position.z},...(p.waypoints??[]).map(w=>({x:w.x,z:w.z}))],
        loop:p.routeOrder==='loop',waypointCursor:1,sign:p.sign?{...p.sign}:null,exhibitId:p.exhibitId,label:p.label,actionLabel:p.actionLabel,
        valid:true,busy:false,state:'rest',remaining:1.5+random()*2,distance:0,speed:0,goal:null,reason:null,contacts:new Map(),
        cooldownUntil:0,interactionCount:0,interactionStartedAt:null,completableInteraction:false,completedInteraction:null,recoveryHeading:null,soundEvents:0,signKey:'welcome',supportSpread:0,reducedApplied:false};
      records.push(record);if(record.sign)actor.setSign(record.sign);root.add(actor.group);
      actor.model.traverse(mesh=>{if(mesh.isMesh){mesh.userData.companionId=id;pickMeshes.push(mesh);}});
    }
    for(const record of records){
      if(validateCurrent(record))record.actor.update(0,{getSupportHeight:support});
    }
  }catch(error){for(const record of records)record.actor.dispose();pickMeshes.length=0;throw error;}

  function inRange(record,position){return position&&[position.x,position.y,position.z].every(Number.isFinite)&&Math.hypot(position.x-record.position.x,position.z-record.position.z)<=6.25&&Math.abs(position.y-record.position.y)<=3.5;}
  const system={
    get colliders(){return disposed?[]:records.filter(r=>r.valid).map(actorSolid);},
    get pickMeshes(){return disposed?[]:pickMeshes.filter(mesh=>records.some(r=>r.id===mesh.userData.companionId&&r.valid&&r.actor.group.visible));},
    idForObject(object){if(disposed||!pickMeshes.includes(object))return null;const record=records.find(r=>r.id===object.userData.companionId);return record?.valid&&record.actor.group.visible?record.id:null;},
    nearest(position){
      if(!active())return null;
      let best=null,distance=Infinity;
      for(const record of records)if(record.valid&&!record.busy&&activeTime>=record.cooldownUntil&&inRange(record,position)){
        const d=Math.hypot(position.x-record.position.x,position.z-record.position.z);
        if(d<distance){distance=d;best={id:record.id,label:{...(record.label||labels[record.kind])},actionLabel:{...(record.actionLabel||actionLabels[record.kind])}};}
      }
      return best;
    },
    interact(id,{playerPosition:visitor=playerPosition}={}){
      if(!guard())return false;
      const record=records.find(r=>r.id===id);
      if(!record?.valid||record.busy||activeTime<record.cooldownUntil||!inRange(record,visitor))return false;
      const heading=Math.atan2(visitor.x-record.position.x,visitor.z-record.position.z);
      // Reserve the FULL action union before rotating or raising the board.
      if(!check(record,{...record.position,heading},true).valid)return false;
      record.recoveryHeading??=record.position.heading;
      record.busy=true;record.goal=null;record.targetHeading=heading;record.interactionCount++;record.interactionStartedAt=activeTime;record.completableInteraction=!reducedMotion;
      record.signKey=record.interactionCount===1?'welcome':night>.5?'evening':'rest';
      record.actor.setSign(record.sign||COMPANION_SIGNS[record.signKey]);
      enter(record,'face',0,'idle');
      if(reducedMotion){record.reducedApplied=false;applyReduced(record);}
      onMessage(record.kind==='elizabeth'?{...(record.sign||COMPANION_SIGNS[record.signKey])}:{en:'Sadaharu greets you with a wag.',zh:'定春摇着尾巴向你打招呼。'});
      if(guard()&&reducedMotion&&record.exhibitId)onInspect({id:record.id,entryId:record.exhibitId});
      guard();return true;
    },
    setLanguage(next){
      if(disposed)return;const value=next==='zh'?'zh':'en';if(value===lang)return;lang=value;
      for(const record of records)record.actor.setLanguage(lang);
    },
    setPaused(value){
      if(disposed||paused===Boolean(value))return;paused=Boolean(value);accumulator=0;
      if(paused){inactive=true;silence('paused');}else inactive=false;
    },
    rebind(next){if(disposed)return;bindings={...bindings,...next};accumulator=0;for(const record of records)if(validateCurrent(record))record.actor.update(0,{reducedMotion,getSupportHeight:support});},
    update(dt,context={}){
      if(disposed||updating)return;
      if('paused' in context)system.setPaused(context.paused);
      if(context.language!==undefined)system.setLanguage(context.language);
      if(context.playerPosition)playerPosition={x:context.playerPosition.x,y:context.playerPosition.y,z:context.playerPosition.z};
      if(context.night!==undefined)night=context.night;
      const reduced=context.reducedMotion===undefined?reducedMotion:Boolean(context.reducedMotion);
      if(reduced!==reducedMotion){reducedMotion=reduced;accumulator=0;if(reduced)silence('reduced-motion');}
      if(!guard())return;
      updating=true;
      try{
        if(reducedMotion){for(const record of records)applyReduced(record);accumulator=0;return;}
        for(const record of records)releaseReduced(record);
        accumulator+=Number.isFinite(dt)?Math.min(.25,Math.max(0,dt)):0;
        while(accumulator+1e-10>=STEP&&guard()){
          accumulator=Math.max(0,accumulator-STEP);activeTime+=STEP;
          for(const record of records){if(!guard())break;tick(record);}
        }
      }finally{updating=false;}
    },
    snapshot(){return {owner,disposed,paused,reducedMotion,language:lang,activeTime,soundEvents,actors:records.map(record=>({
      id:record.id,kind:record.kind,asset:record.actor.asset.sha256,valid:record.valid,reason:record.reason,state:record.state,busy:record.busy,
      action:record.actor.action,clip:record.actor.clip,clipTime:record.actor.time,clipDuration:record.actor.duration,
      position:{x:record.position.x,y:record.position.y,z:record.position.z},heading:record.position.heading,speed:record.speed,distance:record.distance,
      waypoint:record.goal?{...record.goal}:null,interactionCount:record.interactionCount,completedInteraction:record.completedInteraction?{...record.completedInteraction}:null,signKey:record.signKey,sign:{...(record.sign||COMPANION_SIGNS[record.signKey])},
      routeReview:record.routeReview?{...record.routeReview,rejected:{...record.routeReview.rejected},lastRejected:record.routeReview.lastRejected?structuredClone(record.routeReview.lastRejected):null}:null,
      clearance:record.busy?'interaction':'body',supportSpread:record.supportSpread,soundEvents:record.soundEvents,
      feet:[...record.actor.footStates.values()].map(f=>({name:f.name,planted:f.planted,phase:f.phase,position:{x:f.position.x,y:f.position.y,z:f.position.z},correction:f.correction})),
    }))};},
    dispose(){
      if(disposed)return;disposed=true;accumulator=0;
      let failure;
      try{silence('disposed');}catch(error){failure=error;}
      for(const record of records)try{record.actor.dispose();}catch(error){failure??=error;}
      pickMeshes.length=0;if(failure)throw failure;
    },
  };
  return system;
}
