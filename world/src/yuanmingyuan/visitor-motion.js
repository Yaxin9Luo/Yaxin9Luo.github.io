import {GROUND_MOTION,findSafeLanding,stepGroundMotion} from '../ground-motion.js';
import {segmentSolid} from './architecture-surface.js';
import {museumSupport} from './museum-support.js';

export const MUSEUM_FLIGHT={cruise:28,boost:64,vertical:18,minAltitude:6,maxAltitude:650};
const finite=point=>point&&[point.x,point.y,point.z].every(Number.isFinite);
export const museumTravelHeading=(x,z)=>Math.atan2(-x,-z);

export function museumVisitorCollider(state){
  const p=state?.position;if(!finite(p))return null;
  const grounded=state.mode==='grounded'||state.mode==='mounting',bottom=p.y+(grounded?0:-1.6),top=bottom+(grounded?GROUND_MOTION.height:3.2),radius=grounded?.65:1.1;
  const planes=[[0,1,0,top],[0,-1,0,-bottom]];
  for(let i=0;i<8;i++){const a=i*Math.PI/4,nx=Math.cos(a),nz=Math.sin(a);planes.push([nx,0,nz,nx*p.x+nz*p.z+radius]);}
  return {id:'museum-visitor',bottom,top,radius,height:top-bottom,planes,walkable:false};
}

export function createMuseumNavigation({terrain,architecture=()=>null,dynamicColliders=()=>[]}){
  let ceiling=Infinity;
  const solids=terrain.colliders.map(segmentSolid);
  const flightSurfaceAt=(x,z)=>{
    const ground=terrain.surfaceAt(x,z,{maxY:ceiling}),building=architecture()?.surfaceAt(x,z,{maxY:ceiling});
    return museumSupport(ground,building);
  };
  const surfaceAt=(x,z)=>{
    const hit=flightSurfaceAt(x,z);
    if(hit?.walkable===false)return null;
    return hit?{...hit,normal:hit.normal||{x:0,y:1,z:0},surfaceId:hit.surfaceId||hit.id||hit.kind}:null;
  };
  const heightAt=(x,z)=>surfaceAt(x,z)?.height;heightAt.surfaceAt=surfaceAt;
  const world={heightAt,colliders:solids,waterLevel:2};
  const syncColliders=()=>{world.colliders=solids.concat(dynamicColliders());};
  function landing(position){
    if(!finite(position))return {valid:false,reason:'invalid-position'};
    syncColliders();
    ceiling=position.y;
    const support=findSafeLanding(position,world);
    if(support.valid&&architecture()?.capsuleBlocked({x:position.x,y:support.y,z:position.z}))return {...support,valid:false,reason:'blocked'};
    return support;
  }
  function walk(state,input,dt){
    syncColliders();
    const initial={...state.position};let next={...state,position:{...initial}},distance=0,blocked=false,support=null;
    const time=Math.max(0,Math.min(.1,dt)),steps=Math.max(1,Math.ceil(time*GROUND_MOTION.runSpeed/.10));
    for(let i=0;i<steps;i++){
      ceiling=next.position.y+GROUND_MOTION.stepUp;
      const step=stepGroundMotion(next,input,time/steps,world);
      if(architecture()?.capsuleBlocked({...step.position,stepUp:0})){blocked=true;break;}
      next={position:step.position,heading:step.heading};support=step.support;distance+=step.distance;blocked||=step.blocked;
    }
    const velocity=time?{x:(next.position.x-initial.x)/time,y:(next.position.y-initial.y)/time,z:(next.position.z-initial.z)/time}:{x:0,y:0,z:0};
    return {...next,velocity,distance,blocked,support};
  }
  return {landing,walk,surfaceAt,flightSurfaceAt,heightAt,solids,world,setCeiling(value){ceiling=value;}};
}

export function stepMuseumFlight(position,input,dt,{surfaceAt,waterY=2}={}){
  if(!finite(position))throw new Error('Flight position must be finite.');
  const seconds=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0)),length=Math.hypot(input.x||0,input.z||0),speed=input.boost?MUSEUM_FLIGHT.boost:MUSEUM_FLIGHT.cruise;
  const next={x:position.x+(input.x||0)/Math.max(1,length)*speed*seconds,y:position.y+(input.vertical||0)*MUSEUM_FLIGHT.vertical*seconds,z:position.z+(input.z||0)/Math.max(1,length)*speed*seconds};
  const floor=surfaceAt?.(next.x,next.z),minimum=Math.max(waterY,floor?.waterY??waterY,floor?.height??waterY)+MUSEUM_FLIGHT.minAltitude;
  next.y=Math.max(minimum,Math.min(MUSEUM_FLIGHT.maxAltitude,next.y));
  return next;
}
