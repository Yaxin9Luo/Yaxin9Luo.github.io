import {pointInPolygon} from './garden-layout.js';

// This coastline is explicitly contemporary exhibition design. Historic garden
// walls, lake rings, bridge approaches and building anchors are not moved.
export function createExhibitionCoast(layout,{radius=45,segments=6}={}){
  const source=layout.exhibition.coast.polygon,protectedPoints=layout.gardens.flatMap(garden=>garden.boundary.flatMap((p,i)=>{
    const q=garden.boundary[(i+1)%garden.boundary.length];return [p,[(p[0]+q[0])/2,(p[1]+q[1])/2]];
  }));
  const pointTowards=(from,to,distance)=>{const length=Math.hypot(to[0]-from[0],to[1]-from[1]);return [from[0]+(to[0]-from[0])*distance/length,from[1]+(to[1]-from[1])*distance/length];};
  for(let attempt=0;attempt<5;attempt++){
    const ring=[];
    for(let i=0;i<source.length;i++){
      const b=source[i],previous=source[(i+source.length-1)%source.length],next=source[(i+1)%source.length];
      const cut=Math.min(radius/2**attempt,Math.hypot(b[0]-previous[0],b[1]-previous[1])*.23,Math.hypot(b[0]-next[0],b[1]-next[1])*.23);
      const a=pointTowards(b,previous,cut),c=pointTowards(b,next,cut);
      for(let step=0;step<=segments;step++){const t=step/segments,s=1-t;ring.push([s*s*a[0]+2*s*t*b[0]+t*t*c[0],s*s*a[1]+2*s*t*b[1]+t*t*c[1]]);}
    }
    if(protectedPoints.every(point=>pointInPolygon(point,ring)))return ring;
  }
  throw new Error('Display coast would clip a historic garden boundary.');
}
