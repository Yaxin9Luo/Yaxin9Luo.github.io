import {locations,crystalPositions} from './locations.js';

export const SAVE_KEY = 'yaxin.grimoire.v1';
export const RACE_COURSE = 'moonlit-2';
export const clamp = (v, min, max) => Math.min(max, Math.max(min,v));
export const damp = (a,b,speed,dt) => a + (b-a)*(1-Math.exp(-speed*dt));
export const distance2 = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function freshProgress(){return {version:1,raceCourse:RACE_COURSE,visited:[],crystals:[],banished:0,bestTime:null};}
export function parseProgress(raw){
  try {
    const p=JSON.parse(raw);
    if(!p || p.version!==1) return freshProgress();
    const visited=Array.isArray(p.visited)?[...new Set(p.visited.filter(id=>locations.some(l=>l.id===id)))]:[];
    const crystals=Array.isArray(p.crystals)?[...new Set(p.crystals.filter(id=>Number.isInteger(id)&&id>=0&&id<crystalPositions.length))]:[];
    return {version:1,raceCourse:RACE_COURSE,visited,crystals,banished:Number.isInteger(p.banished)?clamp(p.banished,0,100000):0,bestTime:p.raceCourse===RACE_COURSE&&Number.isFinite(p.bestTime)&&p.bestTime>0&&p.bestTime<=120?p.bestTime:null};
  } catch {return freshProgress();}
}
export function progressEvent(progress,event){
  const next={...progress,visited:[...progress.visited],crystals:[...progress.crystals]};
  if(event.type==='visit' && locations.some(l=>l.id===event.id) && !next.visited.includes(event.id)) next.visited.push(event.id);
  if(event.type==='collect' && Number.isInteger(event.id) && event.id>=0 && event.id<crystalPositions.length && !next.crystals.includes(event.id)) next.crystals.push(event.id);
  if(event.type==='banish') next.banished=Math.min(100000,next.banished+1);
  if(event.type==='race' && Number.isFinite(event.time)&&event.time>0&&event.time<=120) next.bestTime=Math.min(next.bestTime??Infinity,event.time);
  return next;
}
export function achievements(p){
  return [p.visited.length===locations.length,p.crystals.length===crystalPositions.length,p.banished>=5,p.bestTime!==null];
}
export function movementVector(x,z,yaw){
  const len=Math.hypot(x,z);
  if(len>1){x/=len;z/=len;}
  return {x:x*Math.cos(yaw)+z*Math.sin(yaw),z:-x*Math.sin(yaw)+z*Math.cos(yaw)};
}
// A swept segment test keeps rings and small targets reliable at boost speed.
export function segmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const len=dx*dx+dy*dy+dz*dz;
  const t=len?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy+(point.z-a.z)*dz)/len,0,1):0;
  return Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t,point.z-a.z-dz*t);
}
export function canCast(mana,cooldown,spell){return cooldown<=0&&mana>=spell.cost;}
