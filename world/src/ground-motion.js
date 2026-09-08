// Pure ground support/movement. Positions here use the SOLE plane, not the flying
// rider's seat origin. heightAt must sample the actual rendered terrain triangles.
export const GROUND_MOTION = Object.freeze({ walkSpeed:1.6, runSpeed:3.8, radius:.32, height:3.24,
  maxSlope:35, stepUp:.30, stepDown:.40, waterLevel:-15, skin:.006 });
const EPS=1e-5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const walkable=solid=>solid.walkable===true || (solid.walkable!==false && /(?:\/foundation|\/upper-terrace|\/cloister-deck-[^/]+|^bridge\/[^/]+\/deck|^exhibition\/platform-(?:base|upper|deck|step-low|step-high))$/.test(solid.id||''));
function pointSurface(x,z,ceiling,world,groundFeetY){
  const heightAt=world.heightAt;
  const surface=heightAt.surfaceAt?.(x,z),y=surface?.height??heightAt(x,z);
  let normal=surface?.normal;
  if(!normal){
    const epsilon=.08,dx=(heightAt(x+epsilon,z)-heightAt(x-epsilon,z))/(2*epsilon),dz=(heightAt(x,z+epsilon)-heightAt(x,z-epsilon))/(2*epsilon),length=Math.hypot(dx,1,dz);
    normal={x:-dx/length,y:1/length,z:-dz/length};
  }
  let best=Number.isFinite(y)&&y<=ceiling+EPS?{y,normal,surfaceId:'terrain'}:null;
  for(const solid of world.colliders||[]){
    if(!walkable(solid)||solid.bottom>ceiling||Number.isFinite(groundFeetY)&&solid.bottom>groundFeetY+GROUND_MOTION.skin)continue;
    for(const [nx,ny,nz,d]of solid.planes){
      if(ny<=EPS)continue;
      const top=(d-nx*x-nz*z)/ny;
      if(top>ceiling+EPS||best&&top<best.y-EPS)continue;
      if(!solid.planes.every(([a,b,c,e])=>a*x+b*top+c*z<=e+EPS))continue;
      best={y:top,normal:{x:nx,y:ny,z:nz},surfaceId:solid.id,bottom:solid.bottom,top:solid.top};
    }
  }
  return best;
}
function footprintStep(x,z,feetY,radius,maxRise,hit,world){
  for(const solid of world.colliders||[]){
    if(!walkable(solid)||solid.bottom>feetY+GROUND_MOTION.skin||solid.top>feetY+maxRise+EPS||solid.top<(hit?.y??-Infinity)-EPS)continue;
    // A narrow riser may lie between the eight perimeter samples. Its upper
    // face can still support the footprint; airborne shelves cannot be steps.
    if(!solid.planes.every(([nx,ny,nz,d])=>nx*x+ny*solid.top+nz*z<=d+radius*Math.hypot(nx,nz)+EPS))continue;
    hit={y:solid.top,normal:{x:0,y:1,z:0},surfaceId:solid.id,bottom:solid.bottom,top:solid.top};
  }
  return hit;
}
function obstructed(x,y,z,radius,height,world){
  const centre=y+GROUND_MOTION.skin+height/2;
  return (world.colliders||[]).some(solid=>{
    if(solid.top<=y+GROUND_MOTION.skin||solid.bottom>=y+height)return false;
    return solid.planes.every(([nx,ny,nz,d])=>nx*x+ny*centre+nz*z<d+radius*Math.hypot(nx,nz)+height/2*Math.abs(ny)-EPS);
  });
}
/** Returns {valid,y,normal,surfaceId,reason}. No input or world mutation. */
export function queryGroundSupport({x,z,feetY=0,maxRise=GROUND_MOTION.stepUp,maxDrop=GROUND_MOTION.stepDown,
  radius=GROUND_MOTION.radius,height=GROUND_MOTION.height,allowSteps=false},world){
  if(!world||typeof world.heightAt!=='function'||![x,z,feetY,maxRise,maxDrop,radius,height].every(Number.isFinite))return {valid:false,reason:'no-support'};
  let hit=pointSurface(x,z,feetY+maxRise,world,allowSteps?feetY:undefined);
  if(allowSteps)hit=footprintStep(x,z,feetY,radius,maxRise,hit,world);
  if(!hit)return {valid:false,reason:'no-support'};
  if(hit.y<=(world.waterLevel??GROUND_MOTION.waterLevel)+.05)return {...hit,valid:false,reason:'water'};
  const minNormal=Math.cos((world.maxSlope??GROUND_MOTION.maxSlope)*Math.PI/180);
  if(hit.normal.y<minNormal)return {...hit,valid:false,reason:'slope'};
  if(hit.y<feetY-maxDrop-EPS)return {...hit,valid:false,reason:'edge'};
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,sample=pointSurface(x+Math.cos(angle)*radius,z+Math.sin(angle)*radius,allowSteps?feetY+maxRise:hit.y+radius*Math.tan(GROUND_MOTION.maxSlope*Math.PI/180)+.015,world,allowSteps?feetY:undefined);
    if(!sample||sample.y<=(world.waterLevel??GROUND_MOTION.waterLevel)+.05||Math.abs(sample.y-hit.y)>(allowSteps?Math.max(maxRise,maxDrop):Math.max(.035,radius*Math.tan(GROUND_MOTION.maxSlope*Math.PI/180)+.015)))return {...hit,valid:false,reason:'edge'};
    const smallBevel=allowSteps&&sample.top<=feetY+maxRise+EPS&&sample.bottom<=feetY+GROUND_MOTION.skin&&sample.top-sample.y<=GROUND_MOTION.skin;
    if(sample.normal.y<minNormal&&!smallBevel)return {...hit,valid:false,reason:'slope'};
    if(allowSteps&&sample.y>hit.y&&sample.y<=feetY+maxRise+EPS)hit=sample;
  }
  if(obstructed(x,hit.y,z,radius,height,world))return {...hit,valid:false,reason:'blocked'};
  return {...hit,valid:true,reason:null};
}
/** Finds support directly below; the caller owns the safe flight approach. */
export function findSafeLanding(position,world,options={}){
  return queryGroundSupport({x:position.x,z:position.z,feetY:position.y,maxRise:0,maxDrop:Math.max(0,position.y-(world.waterLevel??GROUND_MOTION.waterLevel)),...options},world);
}
/** Camera-relative direction should already be converted to world X/Z by caller. */
export function stepGroundMotion(state,input,dt,world){
  const position={...state.position},length=Math.hypot(input.x||0,input.z||0);
  const speed=input.run?GROUND_MOTION.runSpeed:GROUND_MOTION.walkSpeed;
  const seconds=clamp(Number.isFinite(dt)?dt:0,0,1),factor=speed/Math.max(1,length);
  const dx=(input.x||0)*factor*seconds,dz=(input.z||0)*factor*seconds;
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  let distance=0,blocked=false,reason=null,support=queryGroundSupport({x:position.x,z:position.z,feetY:position.y,allowSteps:true},world);
  for(let i=0;i<count;i++){
    const tryStep=(x,z)=>queryGroundSupport({x,z,feetY:position.y,allowSteps:true},world);
    let x=position.x+dx/count,z=position.z+dz/count,hit=tryStep(x,z);
    if(!hit.valid){
      blocked=true;reason=hit.reason;
      const alongX=tryStep(x,position.z),alongZ=tryStep(position.x,z);
      if(alongX.valid&&Math.abs(dx)>EPS){z=position.z;hit=alongX;}
      else if(alongZ.valid&&Math.abs(dz)>EPS){x=position.x;hit=alongZ;}
      else break;
    }
    distance+=Math.hypot(x-position.x,z-position.z);position.x=x;position.z=z;position.y=hit.y;support=hit;
  }
  const velocity=seconds>0?{x:(position.x-state.position.x)/seconds,y:(position.y-state.position.y)/seconds,z:(position.z-state.position.z)/seconds}:{x:0,y:0,z:0};
  const heading=distance>EPS?Math.atan2(-velocity.x,-velocity.z):(state.heading||0);
  return {position,velocity,heading,support,distance,blocked,reason};
}
