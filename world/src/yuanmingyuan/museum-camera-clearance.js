import {gardenReviewCameraSightline} from './garden-review-camera.js';
import {segmentSolid} from './architecture-surface.js';

const finite=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));

function cameraVolume(p,r){
  const [x,y,z]=p;
  return {bounds:{minX:x-r,maxX:x+r,minY:y-r,maxY:y+r,minZ:z-r,maxZ:z+r},
    planes:[[1,0,0,x+r],[-1,0,0,-x+r],[0,1,0,y+r],[0,-1,0,-y+r],[0,0,1,z+r],[0,0,-1,-z+r]],interiorPoint:{x,y,z}};
}

// Query only: the architecture owner retains all BVHs and original geometry.
export function resolveMuseumCameraPose({position,target,visitor,terrain,architecture,height=3.28,near=.08,fov=45,aspect=1.6}={}){
  if(![position,target,visitor].every(finite)||![height,near,fov,aspect].every(Number.isFinite)||height<=0||near<=0||fov<=0||fov>=120||aspect<=0||terrain?.disposed||!Array.isArray(terrain?.colliders)||architecture?.disposed||typeof architecture?.intersectsGuideVolume!=='function')throw new Error('Camera clearance needs finite poses and live original terrain/architecture.');
  const arm=distance(position,target);
  if(arm<.5)throw new Error('Camera follow arm is too short to test.');
  const tangent=Math.tan(fov*Math.PI/360),radius=Math.max(.3,near*Math.sqrt(1+tangent*tangent*(1+aspect*aspect)));
  const walls=terrain.colliders.map(segmentSolid);
  // Automatic correction must keep the full-height visitor below 60% of the
  // vertical frame. Clear user-chosen poses are returned exactly, even closer.
  const minimumDistance=Math.max(7,height/(2*tangent*.60));
  let checked=0;
  function test(p){
    checked++;
    const floor=terrain.surfaceAt?.(p[0],p[2]);
    if(Number.isFinite(floor?.height)&&p[1]-radius<=floor.height)return {clear:false,reason:'terrain'};
    for(const wall of walls){
      if(wall.planes.every(([x,y,z,d])=>x*p[0]+y*p[1]+z*p[2]-radius*(Math.abs(x)+Math.abs(y)+Math.abs(z))<=d))return {clear:false,reason:'garden-wall-or-rail',obstacleId:wall.id};
    }
    if(architecture.intersectsGuideVolume(cameraVolume(p,radius))!==false)return {clear:false,reason:'camera-volume'};
    const dx=p[0]-visitor[0],dz=p[2]-visitor[2],horizontal=Math.hypot(dx,dz),side=horizontal>1e-8?[dz/horizontal,0,-dx/horizontal]:[1,0,0];
    const anchors=[[0,.25],[0,height*.5],[0,height-.1],[-.55,height*.5],[.55,height*.5]];
    for(const [offset,y]of anchors){
      const anchor=[visitor[0]+side[0]*offset,visitor[1]+y,visitor[2]+side[2]*offset];
      const hit=gardenReviewCameraSightline({position:p,target:anchor,terrain,architecture,radius:.08});
      if(!hit.clear)return {clear:false,reason:'visitor-sightline',anchor,obstacle:hit.reason,obstacleId:hit.obstacleId??null};
    }
    return {clear:true};
  }
  const desired=test(position);
  const result=(p,clear,extra={})=>({clear,adjusted:distance(p,position)>1e-9,position:[...p],target:[...target],desiredPosition:[...position],desired,checked,radius,minimumDistance,distance:distance(p,target),...extra});
  if(desired.clear)return result(position,true);
  const yaw=Math.atan2(position[0]-target[0],position[2]-target[2]),pitch=Math.atan2(position[1]-target[1],Math.hypot(position[0]-target[0],position[2]-target[2]));
  const longest=Math.min(Math.max(arm,minimumDistance),18),distances=[longest,longest*.9,longest*.8,longest*.7,longest*.6,minimumDistance].filter(d=>d>=minimumDistance-1e-8&&d<=longest+1e-8);
  const candidates=[],seen=new Set();
  for(const d of distances)for(const degrees of [0,15,-15,30,-30,45,-45,60,-60,75,-75,90,-90])for(const lift of [0,10,-10,20,-20]){
    const elevation=clamp(pitch+lift*Math.PI/180,-10*Math.PI/180,35*Math.PI/180),angle=yaw+degrees*Math.PI/180;
    const p=[target[0]+d*Math.cos(elevation)*Math.sin(angle),target[1]+d*Math.sin(elevation),target[2]+d*Math.cos(elevation)*Math.cos(angle)];
    const key=p.map(n=>n.toFixed(8)).join();if(seen.has(key)||distance(p,position)<1e-8)continue;seen.add(key);
    // Prefer similar framing; shortening is available when nearby angles fail.
    candidates.push({position:p,score:distance(p,position)+.8*Math.abs(arm-d)+.5*Math.abs(p[1]-position[1]),yawDelta:degrees,elevationDegrees:elevation*180/Math.PI});
  }
  candidates.sort((a,b)=>a.score-b.score);
  for(const candidate of candidates)if(test(candidate.position).clear)return result(candidate.position,true,{yawDelta:candidate.yawDelta,elevationDegrees:candidate.elevationDegrees});
  return result(position,false,{reason:'no-clear-follow-pose'});
}
