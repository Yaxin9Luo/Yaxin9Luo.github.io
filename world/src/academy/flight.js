// Arcade broom flight. Pure data in, pure data out: no Three.js, so the feel can
// be tuned and tested in Node. The broom always moves forward; the player steers
// (turn), pitches (climb/dive), boosts and barrel-rolls to dodge.

export const FLIGHT={
  cruise:24,boost:42,minSpeed:13,maxSpeed:58,
  turnRate:1.8,turnResponse:6.5,boostTurn:.8,
  pitchMax:.62,pitchResponse:4.5,
  accel:1.5,decel:.7,gravity:16,
  boostDrain:.34,boostRegen:.12,
  rollTime:.42,rollCooldown:.85,rollDash:15,
  radius:1.1,floorClearance:1.4,ceiling:150,
  bounds:{x:178,z:168},
  stunTime:.38,wallSlope:1.15,
};

const TAU=Math.PI*2;
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
export const angleDelta=(from,to)=>((to-from+Math.PI)%TAU+TAU)%TAU-Math.PI;
const ease=t=>t<.5?2*t*t:1-2*(1-t)*(1-t);

/** heading 0 faces -z (Three.js forward); heading increases counter-clockwise from above. */
export function forwardOf(heading,pitch=0,out={x:0,y:0,z:0}){
  const cp=Math.cos(pitch);out.x=-Math.sin(heading)*cp;out.y=Math.sin(pitch);out.z=-Math.cos(heading)*cp;return out;
}
export const headingTowards=(dx,dz)=>Math.atan2(-dx,-dz);

export function createFlightState({x=0,y=20,z=0,heading=0}={}){
  return {x,y,z,heading,pitch:0,speed:FLIGHT.cruise,turnVel:0,bank:0,boost:1,boosting:false,
    roll:0,rollDir:0,rollAngle:0,rollCooldown:0,iframes:0,stun:0,lateral:0,
    vx:0,vy:0,vz:0,groundGap:Infinity,overWater:false,outside:false};
}

export function resetFlight(s,{x,y,z,heading}){
  Object.assign(s,createFlightState({x,y,z,heading}));return s;
}

/**
 * Advance one fixed step.
 * input: {turn:-1..1 (positive = right), climb:-1..1 (positive = up), boost:bool, roll:-1|0|1 (edge)}
 * world: {heightAt(x,z), waterLevel, colliders:[...]}
 * Returns events: roll, scrape, bump, boundary, boost-start, boost-empty.
 */
export function stepFlight(s,input,dt,world){
  const events=[];
  const control=s.stun>0?.3:1;
  s.stun=Math.max(0,s.stun-dt);s.iframes=Math.max(0,s.iframes-dt);s.rollCooldown=Math.max(0,s.rollCooldown-dt);

  // Turning has a little weight so taps feel smooth and holds feel committed.
  const turnTarget=clamp(input.turn||0,-1,1)*FLIGHT.turnRate*(s.boosting?FLIGHT.boostTurn:1)*control;
  s.turnVel=damp(s.turnVel,turnTarget,FLIGHT.turnResponse,dt);
  s.heading-=s.turnVel*dt;
  const pitchTarget=clamp(input.climb||0,-1,1)*FLIGHT.pitchMax*control;
  s.pitch=damp(s.pitch,pitchTarget,FLIGHT.pitchResponse,dt);

  const wantsBoost=Boolean(input.boost)&&s.boost>.02&&s.stun<=0;
  if(wantsBoost&&!s.boosting)events.push({type:'boost-start'});
  if(s.boosting&&!wantsBoost&&s.boost<=.02)events.push({type:'boost-empty'});
  s.boosting=wantsBoost;
  s.boost=clamp(s.boost+(wantsBoost?-FLIGHT.boostDrain:FLIGHT.boostRegen)*dt,0,1);

  // Diving trades height for speed; climbing bleeds it. Never stalls.
  const target=wantsBoost?FLIGHT.boost:FLIGHT.cruise;
  s.speed+=-Math.sin(s.pitch)*FLIGHT.gravity*dt;
  s.speed=damp(s.speed,target,s.speed<target?FLIGHT.accel:FLIGHT.decel,dt);
  s.speed=clamp(s.speed,FLIGHT.minSpeed,FLIGHT.maxSpeed);

  // Barrel roll: a sideways dash with brief invulnerability.
  if(input.roll&&s.roll<=0&&s.rollCooldown<=0&&s.stun<=0){
    s.roll=FLIGHT.rollTime;s.rollDir=Math.sign(input.roll);s.rollCooldown=FLIGHT.rollCooldown;s.iframes=FLIGHT.rollTime+.1;
    events.push({type:'roll',dir:s.rollDir});
  }
  if(s.roll>0){
    const t=1-s.roll/FLIGHT.rollTime;
    s.lateral=s.rollDir*FLIGHT.rollDash*Math.sin(Math.PI*t);s.rollAngle=-s.rollDir*TAU*ease(t);s.roll=Math.max(0,s.roll-dt);
  }else{s.lateral=0;s.rollAngle=0;}

  const sh=Math.sin(s.heading),ch=Math.cos(s.heading),cp=Math.cos(s.pitch),sp=Math.sin(s.pitch);
  s.vx=-sh*cp*s.speed+ch*s.lateral;s.vy=sp*s.speed;s.vz=-ch*cp*s.speed-sh*s.lateral;
  const px=s.x,pz=s.z;
  s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;

  // Soft map edge: past the bounds the broom is turned back toward the islands.
  const excess=Math.max(Math.abs(s.x)/FLIGHT.bounds.x,Math.abs(s.z)/FLIGHT.bounds.z)-1;
  if(excess>0){
    if(!s.outside)events.push({type:'boundary'});
    s.outside=true;
    s.heading+=angleDelta(s.heading,headingTowards(-s.x,-s.z))*Math.min(1,excess*5)*3*dt;
    const hard=1.12;s.x=clamp(s.x,-FLIGHT.bounds.x*hard,FLIGHT.bounds.x*hard);s.z=clamp(s.z,-FLIGHT.bounds.z*hard,FLIGHT.bounds.z*hard);
  }else s.outside=false;

  // Cliffs and steep banks block like walls; gentle slopes lift the broom.
  const wall=terrainWall(s,px,pz,world);
  const ground=world.heightAt(s.x,s.z),floor=Math.max(ground,world.waterLevel)+FLIGHT.floorClearance;
  s.overWater=ground<world.waterLevel;s.groundGap=s.y-floor;
  if(s.y<floor){
    const impact=-s.vy;s.y=floor;s.groundGap=0;
    if(s.pitch<0)s.pitch*=.25;
    if(impact>10&&s.iframes<=0){events.push({type:'scrape',impact});s.speed*=.82;}
  }
  if(s.y>FLIGHT.ceiling){s.y=FLIGHT.ceiling;if(s.pitch>0)s.pitch*=.5;}

  const hit=resolveColliders(s,world.colliders,FLIGHT.radius)||wall;
  if(hit){
    const into=-(s.vx*hit.nx+s.vz*hit.nz);
    if(into>6&&s.stun<=0){
      events.push({type:'bump',nx:hit.nx,nz:hit.nz,speed:into});
      s.speed=Math.max(FLIGHT.minSpeed,s.speed*.55);s.stun=FLIGHT.stunTime;
      // Slide along the wall instead of sticking to it.
      const fx=-sh,fz=-ch,dot=fx*hit.nx+fz*hit.nz,tx=fx-hit.nx*dot,tz=fz-hit.nz*dot;
      s.heading=Math.hypot(tx,tz)>.2?headingTowards(tx,tz):headingTowards(hit.nx,hit.nz);s.turnVel=0;
    }
  }
  s.bank=damp(s.bank,clamp(s.turnVel*.42,-.75,.75),7,dt);
  return events;
}

const floorAt=(world,x,z)=>Math.max(world.heightAt(x,z),world.waterLevel)+FLIGHT.floorClearance;
/** If the step ran into steep ground, undo the horizontal move and return the wall normal. */
export function terrainWall(s,px,pz,world){
  if(floorAt(world,s.x,s.z)<=s.y)return null;
  const e=1,gx=world.heightAt(s.x+e,s.z)-world.heightAt(s.x-e,s.z),gz=world.heightAt(s.x,s.z+e)-world.heightAt(s.x,s.z-e),slope=Math.hypot(gx,gz)/(2*e);
  if(slope<FLIGHT.wallSlope||floorAt(world,px,pz)>s.y+.5)return null;
  s.x=px;s.z=pz;const l=Math.hypot(gx,gz)||1;
  return {nx:-gx/l,nz:-gz/l,terrain:true};
}

/**
 * Push a sphere out of vertical cylinders and oriented boxes.
 * collider: {type:'cyl',x,z,r,y0,y1} | {type:'box',x,z,hx,hz,y0,y1,rot}
 * Returns the last horizontal contact normal, or null. Mutates p.x/p.y/p.z.
 */
export function resolveColliders(p,colliders=[],radius=1){
  let contact=null;
  for(const c of colliders){
    if(p.y<c.y0-radius||p.y>c.y1+radius)continue;
    const dx=p.x-c.x,dz=p.z-c.z,reach=(c.reach??=c.type==='cyl'?c.r:Math.hypot(c.hx,c.hz))+radius;
    if(dx*dx+dz*dz>reach*reach)continue;
    let nx=0,nz=0,depth=0;
    if(c.type==='cyl'){
      const d=Math.hypot(dx,dz);if(d>=c.r+radius)continue;
      depth=c.r+radius-d;nx=d>1e-6?dx/d:1;nz=d>1e-6?dz/d:0;
    }else{
      const cos=Math.cos(c.rot||0),sin=Math.sin(c.rot||0),lx=dx*cos-dz*sin,lz=dx*sin+dz*cos;
      const ox=c.hx+radius-Math.abs(lx),oz=c.hz+radius-Math.abs(lz);if(ox<=0||oz<=0)continue;
      let ln=0,lm=0;if(ox<oz){depth=ox;ln=Math.sign(lx)||1;}else{depth=oz;lm=Math.sign(lz)||1;}
      nx=ln*cos+lm*sin;nz=-ln*sin+lm*cos;
    }
    // Coming down onto a roof or parapet: rest on top instead of being shoved sideways.
    const top=c.y1+radius-p.y;
    if(top>0&&top<Math.min(depth,2.2)){p.y=c.y1+radius;continue;}
    p.x+=nx*depth;p.z+=nz*depth;contact={nx,nz,collider:c};
  }
  return contact;
}

/** Steering helper for autopilot, demos and tests: input that flies toward a point. */
export function steerToward(s,target,{boost=false}={}){
  const dx=target.x-s.x,dz=target.z-s.z,dy=target.y-s.y,dist=Math.hypot(dx,dz);
  const err=angleDelta(s.heading,headingTowards(dx,dz));
  const desiredPitch=Math.atan2(dy,Math.max(4,dist));
  return {turn:clamp(-err*2.4,-1,1),climb:clamp((desiredPitch-s.pitch*.5)/FLIGHT.pitchMax*1.6,-1,1),boost,roll:0};
}
