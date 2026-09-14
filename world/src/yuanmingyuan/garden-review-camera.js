import {Vector3} from 'three';
import {segmentSolid} from './architecture-surface.js';

function crossesSolid(a,b,planes,radius){
  let enter=0,exit=1;
  for(const[nx,ny,nz,d]of planes){
    const start=nx*a.x+ny*a.y+nz*a.z-d-radius,velocity=nx*(b.x-a.x)+ny*(b.y-a.y)+nz*(b.z-a.z);
    if(Math.abs(velocity)<1e-10){if(start>0)return false;continue;}
    const t=-start/velocity;if(velocity>0)exit=Math.min(exit,t);else enter=Math.max(enter,t);
    if(enter>exit)return false;
  }
  return exit>=0&&enter<=1;
}

// Preflight only for detail views intended to see a plant/stone anchor. A wide
// architecture view may intentionally target a facade and should not use this.
// Check existing garden-wall solids and original retained architectural
// triangles. This does not hide geometry or replace a native visual review.
export function gardenReviewCameraSightline({position,target,terrain,architecture,radius=.03}={}){
  if(![position,target].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||!Array.isArray(terrain?.colliders)||terrain.disposed||architecture?.disposed||typeof architecture?.intersectsGuideVolume!=='function'||!(radius>0))throw new Error('A detail sightline needs finite endpoints and live terrain/architecture.');
  const from=new Vector3().fromArray(position),to=new Vector3().fromArray(target),direction=to.clone().sub(from),length=direction.length();
  if(length<=radius*2)throw new Error('Detail sightline endpoints are too close.');direction.normalize();
  for(const segment of terrain.colliders){
    if(crossesSolid(from,to,segmentSolid(segment).planes,radius))return {clear:false,reason:'garden-wall-or-rail',obstacleId:segment.id,position:[...position],target:[...target]};
  }
  const side=new Vector3().crossVectors(direction,Math.abs(direction.y)>.95?new Vector3(1,0,0):new Vector3(0,1,0)).normalize(),up=new Vector3().crossVectors(side,direction).normalize(),centre=from.clone().add(to).multiplyScalar(.5);
  const corners=[];
  for(const endpoint of [from,to])for(const x of [-1,1])for(const y of [-1,1])corners.push(endpoint.clone().addScaledVector(side,x*radius).addScaledVector(up,y*radius));
  const bounds={minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y)),minZ:Math.min(...corners.map(p=>p.z)),maxZ:Math.max(...corners.map(p=>p.z))};
  const planes=[];
  for(const[axis,extent]of [[side,radius],[up,radius],[direction,length/2]])for(const sign of [-1,1])planes.push([axis.x*sign,axis.y*sign,axis.z*sign,axis.dot(centre)*sign+extent]);
  const blocked=architecture.intersectsGuideVolume({planes,bounds,interiorPoint:{x:centre.x,y:centre.y,z:centre.z}});
  return {clear:blocked===false,reason:blocked===false?null:'retained-architecture',position:[...position],target:[...target],radius,scope:'Conservative detail-anchor sightline only; surrounding scene retained.'};
}
