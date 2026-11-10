// Shared helpers for the lean Academy course tests: baked terrain, real
// landmark colliders and an autopilot that flies the real flight model.
import {readFileSync} from 'node:fs';
import {createHeightfield,WATER_LEVEL} from '../../src/academy/heightfield.js';
import {buildLandmarks} from '../../src/academy/landmarks.js';
import {TRIALS,courseRings,courseStardust,createRun,stepRun,crossRing,ringPassed,stardustCollected} from '../../src/academy/trials.js';
import {createFlightState,stepFlight,steerToward,FLIGHT,resolveColliders,angleDelta,headingTowards} from '../../src/academy/flight.js';

export function loadAcademyWorld(){
  const buf=readFileSync(new URL('../../src/academy/terrain.bin',import.meta.url));
  const hf=createHeightfield(new Uint16Array(buf.buffer,buf.byteOffset,buf.byteLength/2));
  const landmarks=buildLandmarks({heightAt:hf.heightAt,trials:TRIALS});
  landmarks.solid.dispose();landmarks.glow?.dispose();
  return {hf,colliders:landmarks.colliders,world:{heightAt:hf.heightAt,waterLevel:WATER_LEVEL,colliders:landmarks.colliders}};
}

export function insideCollider(p,colliders,margin=0){
  const probe={x:p.x,y:p.y,z:p.z};const hit=resolveColliders(probe,colliders,margin);
  return hit||Math.abs(probe.y-p.y)>1e-6?true:false;
}

/** Every problem with a course, as readable strings. */
export function courseProblems(trial,{hf,colliders}){
  const problems=[],floor=(x,z)=>Math.max(hf.heightAt(x,z),WATER_LEVEL)+FLIGHT.floorClearance;
  const rings=courseRings(trial),points=[trial.start,...rings];
  for(const r of rings){
    if(r.y-floor(r.x,r.z)<1.5)problems.push(`${trial.id} ring ${r.index} centre is ${(r.y-floor(r.x,r.z)).toFixed(1)} m above the floor`);
    // Points on the ring circle.
    const n=r.normal;let u={x:n.y,y:-n.x,z:0};if(Math.hypot(u.x,u.y)<.1)u={x:0,y:n.z,z:-n.y};const ul=Math.hypot(u.x,u.y,u.z);u={x:u.x/ul,y:u.y/ul,z:u.z/ul};
    const v={x:n.y*u.z-n.z*u.y,y:n.z*u.x-n.x*u.z,z:n.x*u.y-n.y*u.x};
    for(let k=0;k<16;k++){const a=k/16*Math.PI*2,p={x:r.x+(u.x*Math.cos(a)+v.x*Math.sin(a))*r.radius,y:r.y+(u.y*Math.cos(a)+v.y*Math.sin(a))*r.radius,z:r.z+(u.z*Math.cos(a)+v.z*Math.sin(a))*r.radius};
      if(insideCollider(p,colliders,.6)){problems.push(`${trial.id} ring ${r.index} rim intersects a building`);break;}}
  }
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),steps=Math.ceil(len/1.5);
    for(let k=0;k<=steps;k++){const u=k/steps,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};
      if(p.y<floor(p.x,p.z)+.5){problems.push(`${trial.id} segment ${i-1}->${i} dips into terrain at ${p.x.toFixed(0)},${p.z.toFixed(0)}`);break;}
      if(insideCollider(p,colliders,1.4)){problems.push(`${trial.id} segment ${i-1}->${i} passes through a building at ${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}`);break;}}
  }
  return problems;
}

/** Fly a trial with the steering helper. `boost`: boost on aligned straights like a decent player. */
export function autopilot(trial,world,{boost=false,collect=false,dt=1/120,maxTime=180}={}){
  const run=createRun(trial),s=createFlightState(trial.start),dust=collect?courseStardust(trial).map(p=>({...p,taken:false})):[];let t=0,bumps=0,scrapes=0;
  while(run.phase==='countdown')stepRun(run,dt);
  s.speed=FLIGHT.cruise*1.15;
  while(run.phase==='running'&&t<maxTime){
    const ring=run.rings[run.ring],prev={x:s.x,y:s.y,z:s.z};
    // Aim slightly past the ring along its normal so the bot crosses it squarely.
    const aim={x:ring.x+ring.normal.x*4,y:ring.y+ring.normal.y*4,z:ring.z+ring.normal.z*4};
    const dist=Math.hypot(ring.x-s.x,ring.y-s.y,ring.z-s.z),near=dist<14;
    const aligned=Math.abs(angleDelta(s.heading,headingTowards(ring.x-s.x,ring.z-s.z)))<.22;
    const input=steerToward(s,near?ring:aim,{boost:boost&&aligned&&dist>40&&s.boost>.1});
    for(const e of stepFlight(s,input,dt,world)){if(e.type==='bump')bumps++;if(e.type==='scrape')scrapes++;}
    stepRun(run,dt);t+=dt;
    for(const d of dust){if(!d.taken&&Math.hypot(d.x-s.x,d.y-s.y,d.z-s.z)<4.5){d.taken=true;stardustCollected(run);s.boost=Math.min(1,s.boost+.03);}}
    const hit=crossRing(ring,prev,s);if(hit){ringPassed(run,{perfect:hit.perfect});s.boost=Math.min(1,s.boost+.22);}
  }
  return {finished:run.phase==='finished',phase:run.phase,rings:run.ring,total:run.rings.length,elapsed:+run.elapsed.toFixed(2),timeLeft:+run.time.toFixed(2),score:run.score,stardust:run.stardust,bumps,scrapes,result:run.result};
}
