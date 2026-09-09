import * as THREE from 'three';
import {bridges} from '../../src/locations.js';
import {createViaduct} from '../../src/site-details.js';

// Clip actual terrain faces to the actual viaduct trim footprint. Testing the
// resulting polygon includes face interiors and cliff overhangs between vertices.
export function bridgeBankClearance(geometries){
  return Object.entries(bridges).map(([name,[a,b]])=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2;
    const bridge=createViaduct(length),deck=bridge.children[0].geometry,trim=bridge.children.at(-1).geometry;
    deck.computeBoundingBox();trim.computeBoundingBox();
    const box=trim.boundingBox,ceiling=6.82+deck.boundingBox.max.y-.1;let maximum=-Infinity,point=null,faces=0;
    for(const geometry of geometries){
      const p=geometry.attributes.position,index=geometry.index;
      for(let i=0;i<index.count;i+=3){
        let polygon=[0,1,2].map(j=>{const k=index.getX(i+j),x=p.getX(k)-cx,z=p.getZ(k)-cz;return{x:x*dz-z*dx,y:p.getY(k),z:x*dx+z*dz};});
        if(polygon.every(p=>p.x<box.min.x)||polygon.every(p=>p.x>box.max.x)||polygon.every(p=>p.z<box.min.z)||polygon.every(p=>p.z>box.max.z))continue;
        for(const [axis,edge,sign]of [['x',box.min.x,1],['x',box.max.x,-1],['z',box.min.z,1],['z',box.max.z,-1]]){
          const clipped=[];
          for(let j=0;j<polygon.length;j++){
            const a=polygon[j],b=polygon[(j+1)%polygon.length],da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign;
            if(da>=0)clipped.push(a);
            if((da<0)!==(db<0)){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}
          }
          polygon=clipped;
        }
        if(!polygon.length)continue;
        faces++;
        for(const p of polygon)if(p.y>maximum){maximum=p.y;point={x:cx+p.x*dz+p.z*dx,y:p.y,z:cz-p.x*dx+p.z*dz};}
      }
    }
    bridge.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    return {name,maximum,ceiling,point,faces};
  });
}
