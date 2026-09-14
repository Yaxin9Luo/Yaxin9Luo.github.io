import * as THREE from 'three';
import {seededGardenRandom,gardenValueNoise,VegetationGeometryBatch} from './vegetation-geometry.js';
import {samplePineBarkRelief} from './vegetation-textures.js';

export const V=(...a)=>new THREE.Vector3(...a), TAU=Math.PI*2;
const mix=THREE.MathUtils.lerp;
export const curveOf=points=>new THREE.CatmullRomCurve3(points.map(p=>Array.isArray(p)?V(...p):p.clone()),false,'centripetal');
export const tubePoint=(curve,t,segments)=>{const x=t*segments,i=Math.min(segments-1,Math.floor(x));return curve.getPointAt(i/segments).lerp(curve.getPointAt((i+1)/segments),x-i);};
export const aim=(d,roll=0)=>new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),roll));
export const pose=(p,q=new THREE.Quaternion())=>new THREE.Matrix4().compose(p,q,V(1,1,1));

function finish(name,p,n,c,u,indices){
 const g=new THREE.BufferGeometry();g.name=name;g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 if(n)g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(indices);
 if(!n)g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Photographic bark follows actual longitudinal metres and the circumference at
// each row, rather than stretching the first ring's scale over a tapered bough.
// Small branches still use the same original 1K PBR maps. A documented .45 m
// adaptation gives the younger wood finer plates; the trunk keeps the 2 m tile.
export function pineWoodGeometry({name,points,radii,segments=36,radialSegments=16,seed=1,surface=null,tileMetres=2,relief=.65,tint=.92}){
 if(points.length<2||points.length!==radii.length||radii.some(r=>!(r>0)))throw new Error('Pine wood needs positive radii and matching controls');
 const curve=curveOf(points),frames=curve.computeFrenetFrames(segments,false),length=curve.getLength(),rng=seededGardenRandom(seed),phase=[rng(),rng()],p=[],c=[],u=[],idx=[],rings=[];
 for(let row=0;row<=segments;row++){
  const t=row/segments,at=curve.getPointAt(t),s=curve.getUtoTmapping(t)*(radii.length-1),i=Math.min(radii.length-2,Math.floor(s)),r=mix(radii[i],radii[i+1],s-i),ring=[];
  for(let side=0;side<=radialSegments;side++){
   const f=side/radialSegments,a=f*TAU,normal=frames.normals[row].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[row],Math.sin(a));
   const uvx=phase[0]+f*TAU*r/tileMetres,uvy=phase[1]+t*length/tileMetres;
   const wav=gardenValueNoise(Math.cos(a)*3.5+seed*.019,t*length*2.7,Math.sin(a)*3.5,seed),flute=Math.sin(a*5+.35*Math.sin(t*5+seed))*.012+wav*.026;
   const edge=Math.max(0,(f-.94)/.06),h=surface?mix(samplePineBarkRelief(surface,uvx,uvy),samplePineBarkRelief(surface,phase[0],uvy),edge)*relief*Math.min(1,r/.10):0;
   const rr=Math.max(r*.75,r*(1+flute)+Math.max(-r*.10,Math.min(r*.10,h)));
   p.push(...at.clone().addScaledVector(normal,rr).toArray());const shade=tint*(.985+wav*.028);c.push(shade,shade,shade);u.push(uvx,uvy);ring.push(p.length/3-1);
  }rings.push(ring);
 }
 const stride=radialSegments+1;
 for(let row=0;row<segments;row++)for(let side=0;side<radialSegments;side++){const a=row*stride+side,b=a+stride;idx.push(a,a+1,b,a+1,b+1,b);}
 for(const end of [0,1]){const centre=p.length/3,at=curve.getPointAt(end);p.push(...at.toArray());c.push(tint,tint,tint);u.push(phase[0],phase[1]+end*length/tileMetres);for(let side=0;side<radialSegments;side++)idx.push(centre,end*segments*stride+side+(end?0:1),end*segments*stride+side+(end?1:0));}
 const g=finish(name,p,null,c,u,idx),norm=g.attributes.normal;
 // A single smooth normal across the duplicated UV seam; keep closed geometry.
 for(const row of rings){const a=row[0],b=row[radialSegments],n=V(norm.getX(a)+norm.getX(b),norm.getY(a)+norm.getY(b),norm.getZ(a)+norm.getZ(b)).normalize();norm.setXYZ(a,n.x,n.y,n.z);norm.setXYZ(b,n.x,n.y,n.z);}
 g.userData={kind:'pine-barked-wood-r3',points:points.map(p=>Array.isArray(p)?[...p]:p.toArray()),radii:[...radii],segments,radialSegments,phase,tileMetres,curveLength:length,sourceTileMetres:2,physicalUvAtEachRing:true};return g;
}

// Six-sided semiorbicular section gives a real lit edge from either direction.
// The 1.2-1.5 mm width is botanical scale, not a screen-space enlargement.
export function pineNeedleGeometry({length=.108,width=.0014,bend=.012,seed=1}){
 const rows=9,sides=6,p=[],c=[],u=[],idx=[],green=new THREE.Color('#66824b'),tip=new THREE.Color('#91a05f');
 for(let row=0;row<=rows;row++){
  const t=row/rows,w=width*.5*(1-.965*t*t),cx=bend*.21*Math.sin(t*Math.PI),cz=bend*t*t;
  for(let side=0;side<=sides;side++){
   const a=side/sides*Math.PI,x=Math.cos(a)*w,z=(Math.sin(a)-.34)*w*.90;
   p.push(cx+x,t*length,cz+z);const color=green.clone().lerp(tip,Math.max(0,(t-.58)/.42)*.30).multiplyScalar(.92+.08*Math.sin(seed+side*.43));c.push(...color.toArray());u.push(side/sides,t);
  }
 }
 const stride=sides+1;
 for(let row=0;row<rows;row++)for(let side=0;side<sides;side++){const a=row*stride+side,b=a+stride;idx.push(a,b,a+1,a+1,b,b+1);}
 // Close the flat side of the half-round needle and the tiny tapered ends.
 for(let row=0;row<rows;row++){const a=row*stride,b=a+stride;idx.push(a,a+sides,b,a+sides,b+sides,b);}
 for(const end of [0,1]){const centre=p.length/3,t=end,w=width*.5*(1-.965*t*t);p.push(bend*.21*Math.sin(t*Math.PI),t*length,bend*t*t-.34*w*.9);c.push(...green.toArray());u.push(.5,t);for(let side=0;side<sides;side++)idx.push(centre,end*rows*stride+side+(end?1:0),end*rows*stride+side+(end?0:1));}
 const g=finish('pine-semi-round-needle-r3',p,null,c,u,idx);g.userData={kind:'pine-semi-round-needle-r3',length,width,bend,rows,sides,shape:'semiorbicular',paired:true};return g;
}

// A terminal spray has a readable woody neck, one leader and three young axes.
// Needle pairs follow the distal growth direction instead of radiating as fuzz.
export function pineTerminalSpray({seed=218,surface}){
 const rng=seededGardenRandom(seed),wood=new VegetationGeometryBatch('pine-terminal-wood-'+seed),foliage=new VegetationGeometryBatch('pine-terminal-needles-'+seed),axisRecords=[],needleRecords=[];
 const needles=[0,1,2].map(i=>pineNeedleGeometry({length:[.085,.108,.128][i],width:[.0012,.00135,.00148][i],bend:[.010,.014,.017][i],seed:seed+i}));
 const main={points:[[0,0,0],[.008,.116,-.003],[.013,.248,.005]],radii:[.0051,.0032,.00115],parent:null};const axes=[main],mainCurve=curveOf(main.points);
 for(let i=0;i<3;i++){
  const t=.36+i*.17,start=tubePoint(mainCurve,t,15),angle=i*2.399963+rng()*.33,out=V(Math.cos(angle)*.57,.82,Math.sin(angle)*.57).normalize(),end=start.clone().addScaledVector(out,.14+rng()*.025);
  axes.push({points:[start.toArray(),start.clone().lerp(end,.53).add(V(0,.004,0)).toArray(),end.toArray()],radii:[.00225,.00135,.00062],parent:{axis:0,t}});
 }
 let triangleOffset=0;
 for(let a=0;a<axes.length;a++){
  const axis=axes[a],curve=curveOf(axis.points),g=pineWoodGeometry({name:'pine-terminal-axis-'+a,points:axis.points,radii:axis.radii,segments:15,radialSegments:8,seed:seed+a*79,surface,tileMetres:.45,relief:.14,tint:.88});
  const triangleCount=g.index.count/3;axisRecords.push({...axis,firstTriangle:triangleOffset,triangleCount,segments:15});triangleOffset+=triangleCount;wood.add(g);g.dispose();
  const pairs=a?36:44,phase=rng()*TAU;
  for(let node=0;node<pairs;node++){
   const t=.33+node/pairs*.65,at=tubePoint(curve,t,15),tangent=curve.getTangentAt(t),across=V(1,.13,.21).cross(tangent).normalize(),normal=tangent.clone().cross(across).normalize(),angle=node*2.399963+phase,radial=across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(normal,Math.sin(angle));
   for(const pair of [-1,1]){
    const direction=tangent.clone().multiplyScalar(.85+rng()*.20).addScaledVector(radial,.50+rng()*.11).addScaledVector(across,pair*.055).normalize(),origin=at.clone().addScaledVector(radial,.00012).addScaledVector(across,pair*.00014),index=(node+a+(pair===1?1:0))%3,rotation=aim(direction,angle+pair*.2),matrix=pose(origin,rotation);
    foliage.add(needles[index],matrix,.94+rng()*.10);needleRecords.push({axis:a,node,pair,index,t,point:origin.toArray(),length:needles[index].userData.length,width:needles[index].userData.width});
   }
  }
 }
 needles.forEach(g=>g.dispose());const wg=wood.finish(),ng=foliage.finish();wg.userData={kind:'pine-terminal-wood-r3',axes:axisRecords};ng.userData={kind:'pine-terminal-needles-r3',needleRecords,fascicles:needleRecords.length/2,needles:needleRecords.length,minNeedleLength:.085,maxNeedleLength:.128,minNeedleWidth:.0012,maxNeedleWidth:.00148};
 return {wood:wg,needles:ng,axes:axisRecords,needleRecords};
}
