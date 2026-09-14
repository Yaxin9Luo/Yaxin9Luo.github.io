import {pointInPolygon} from './garden-layout.js';
import {distanceToRing,smoothstep} from './terrain-geometry.js';

export function prepareTerrainPads(pads=[]){
  return pads.map(pad=>{
    if(!pad.id||!Number.isFinite(pad.heightY)||!Number.isFinite(pad.blend)||pad.blend<=0||!Array.isArray(pad.polygon)||pad.polygon.length<3||pad.polygon.some(p=>p.length!==2||!p.every(Number.isFinite)))throw new Error('Terrain pads need an id, finite height, positive blend and XZ polygon.');
    return {...pad,polygon:pad.polygon.map(p=>[...p])};
  });
}

export function applyTerrainPads(x,z,height,pads){
  for(const pad of pads){
    const distance=pointInPolygon([x,z],pad.polygon)?0:distanceToRing([x,z],pad.polygon);
    if(distance<pad.blend){const influence=1-smoothstep(distance/pad.blend);height+=(pad.heightY-height)*influence;}
  }
  return height;
}
