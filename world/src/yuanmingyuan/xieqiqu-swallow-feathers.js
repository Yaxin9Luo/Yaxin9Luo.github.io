import * as THREE from 'three';

export const swallowWingHeight=(x,z)=>.52+.16*Math.abs(x)+.07*Math.sin(Math.abs(x)*Math.PI)+.025*(-z)+.045*Math.exp(-(((Math.abs(x)-.10)/.20)**2))-.019*(1-THREE.MathUtils.smoothstep(Math.abs(x),.10,.25))*THREE.MathUtils.smoothstep(-z,.015,.09);
export const swallowWingHalfThickness=x=>.002+.0075*(1-THREE.MathUtils.smoothstep(Math.abs(x),.10,.40));

/** A tapered closed feather with camber, a lenticular section, integrated shaft
 * and shallow paired barb cuts. All detail is part of its actual surface. */
export function createSwallowFeather({name,root,tip,width=.035,halfThickness=.0024,camber=.013,steps=64,sides=20,surfaceHeight=null}){
  const start=new THREE.Vector3(...root),end=new THREE.Vector3(...tip),delta=end.clone().sub(start),across=new THREE.Vector3(delta.z,0,-delta.x).normalize(),up=new THREE.Vector3().crossVectors(delta,across).normalize();if(up.y<0)up.negate();
  if(delta.length()<.02||across.lengthSq()===0||width<=0||halfThickness<=0)throw new Error('Feather needs a finite root, tip and section');
  const positions=[],uv=[],ids=[],startOffset=surfaceHeight?start.y-surfaceHeight(start.x,start.z):0,endOffset=surfaceHeight?end.y-surfaceHeight(end.x,end.z):0;
  const centreAt=t=>{const p=start.clone().lerp(end,t);if(surfaceHeight){const layer=endOffset-swallowWingHalfThickness(end.x),surfaceOffset=swallowWingHalfThickness(p.x)+layer;p.y=surfaceHeight(p.x,p.z)+THREE.MathUtils.lerp(startOffset,surfaceOffset,THREE.MathUtils.smoothstep(t,0,.20));}return p.addScaledVector(up,camber*Math.sin(Math.PI*t));};
  for(let i=0;i<=steps;i++){
    const t=i/steps,centre=centreAt(t),w=.0012+width*Math.sin(Math.PI*t)**.65*(1-.24*t),thickness=.00065+halfThickness*Math.sin(Math.PI*t)**.7,rowAcross=across.clone(),rowUp=up.clone();
    if(surfaceHeight){const h=.0001;rowAcross.y=(surfaceHeight(centre.x+across.x*h,centre.z+across.z*h)-surfaceHeight(centre.x-across.x*h,centre.z-across.z*h))/(2*h);rowAcross.normalize();rowUp.crossVectors(centreAt(Math.min(1,t+.0001)).sub(centreAt(Math.max(0,t-.0001))),rowAcross).normalize();if(rowUp.y<0)rowUp.negate();}
    for(let j=0;j<sides;j++){
      const theta=j/sides*Math.PI*2,v=Math.cos(theta),side=Math.sin(theta),shaft=.0013*Math.exp(-((v/.17)**2))*(1-t)*Math.sin(Math.PI*t),barbs=.00023*Math.sin((t*17+Math.abs(v)*.8)*Math.PI*2)*Math.sin(Math.PI*t)*side*side;
      const p=centre.clone().addScaledVector(rowAcross,v*w).addScaledVector(rowUp,side*(thickness+shaft)+barbs);positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);
    }
  }
  // Section winding is derived from across/up and the root-to-tip axis.
  const sign=new THREE.Vector3().crossVectors(across,up).dot(delta)>0;
  const face=(a,b,c)=>ids.push(...(sign?[a,b,c]:[a,c,b]));
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;face(a,b,d);face(b,c,d);}
  for(const [ring,point]of [[0,start],[steps,end]]){const at=positions.length/3;positions.push(...point.toArray());uv.push(point.x*.8,(point.y+point.z)*.5);for(let j=0;j<sides;j++){const a=ring*sides+j,b=ring*sides+(j+1)%sides;if(ring===0)face(at,b,a);else face(at,a,b);}}
  const g=new THREE.BufferGeometry();g.name=name;g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={construction:'closed-lenticular-feather-with-integral-shaft-and-barbs',root:[...root],tip:[...tip],steps,sides,rootEmbedding:'requires-whole-wing-contact-check',minimumEdgeDiameter:.0013};return g;
}

export function swallowWingFeatherSpecs(side){
  if(![-1,1].includes(side))throw new Error('Swallow side must be -1 or 1');
  const parts=[],point=(x,z,offset=0)=>[side*x,swallowWingHeight(x,z)+offset,z],upper=(x,z,offset=0)=>point(x,z,swallowWingHalfThickness(x)+.003+offset);
  const primaryTips=[[1.10,-.66],[1.05,-.73],[.98,-.75],[.89,-.73],[.80,-.70],[.70,-.65],[.59,-.58]];
  for(let i=0;i<primaryTips.length;i++){
    const [x,z]=primaryTips[i],root=point(.47-i*.027,-.10-i*.023),tip=upper(x,z,i*.00035);
    parts.push({id:`primary-${side}-${i}`,role:'copper',create:()=>createSwallowFeather({name:`swallow-primary-${side}-${i}`,root,tip,width:.049-i*.0015,halfThickness:.0022,steps:112,sides:28,camber:.002,surfaceHeight:swallowWingHeight})});
  }
  for(let i=0;i<6;i++){
    const root=point(.12+i*.038,-.055-i*.025),tip=upper(.23+i*.061,-.43-i*.032,.001-i*.00012);
    parts.push({id:`secondary-${side}-${i}`,role:'copper',create:()=>createSwallowFeather({name:`swallow-secondary-${side}-${i}`,root,tip,width:.037,halfThickness:.0024,steps:80,sides:28,camber:.002,surfaceHeight:swallowWingHeight})});
  }
  for(let row=0;row<2;row++)for(let i=0;i<9;i++){
    const x=.10+i*.065,z=.055-.48*x-row*.044,root=point(x,z),tip=upper(x+.10+row*.018,z-.145,.0015+row*.0012);
    parts.push({id:`covert-${side}-${row}-${i}`,role:'copper',create:()=>createSwallowFeather({name:`swallow-covert-${side}-${row}-${i}`,root,tip,width:.024,halfThickness:.0018,steps:56,sides:24,camber:.0015,surfaceHeight:swallowWingHeight})});
  }
  return parts;
}
