import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// The sheep's legs and short tail are monotone in Y. Evaluate one continuous
// anatomical cross-section at that Y, instead of taking the minimum of many
// individually capped capsules. That old construction made visible ring bands.
export function createSheepSectionProfile(sections) {
  const points=sections.map(s=>[...s]).sort((a,b)=>a[1]-b[1]);
  if(points.length<2||points.some((s,i)=>s.length!==5||!s.every(Number.isFinite)||s[3]<=0||s[4]<=0||(i&&s[1]<=points[i-1][1])))throw new Error('Sheep limb sections require distinct heights and positive radii');
  const channels=[0,2,3,4],slopes=channels.map(channel=>points.map((p,i)=>{
    const before=i?(p[channel]-points[i-1][channel])/(p[1]-points[i-1][1]):null,after=i<points.length-1?(points[i+1][channel]-p[channel])/(points[i+1][1]-p[1]):null;
    if(before===null)return after;if(after===null)return before;if(before*after<=0)return 0;
    return 2*before*after/(before+after);
  }));
  return y=>{
    const first=points[0],last=points.at(-1),clamped=THREE.MathUtils.clamp(y,first[1],last[1]);let i=0;
    while(i<points.length-2&&clamped>points[i+1][1])i++;
    const a=points[i],b=points[i+1],span=b[1]-a[1],t=(clamped-a[1])/span,t2=t*t,t3=t2*t;
    const v=channels.map((channel,j)=>(2*t3-3*t2+1)*a[channel]+(t3-2*t2+t)*span*slopes[j][i]+(-2*t3+3*t2)*b[channel]+(t3-t2)*span*slopes[j][i+1]);
    return {x:v[0],z:v[1],rx:v[2],rz:v[3],capY:y-clamped};
  };
}

function preparedEllipsoid(part) {
  const inverse=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(part.rotation??[0,0,0]))).invert().elements,r=part.radii;
  return {...part,inverse,extent:Math.max(...r),minimumRadius:Math.min(...r)};
}
function ellipsoidDistance(s,x,y,z) {
  const e=s.inverse,dx=x-s.center[0],dy=y-s.center[1],dz=z-s.center[2],qx=(e[0]*dx+e[4]*dy+e[8]*dz)/s.radii[0],qy=(e[1]*dx+e[5]*dy+e[9]*dz)/s.radii[1],qz=(e[2]*dx+e[6]*dy+e[10]*dz)/s.radii[2];
  const k0=Math.sqrt(qx*qx+qy*qy+qz*qz),k1=Math.hypot(qx/s.radii[0],qy/s.radii[1],qz/s.radii[2]);return k1>1e-9?k0*(k0-1)/k1:-s.minimumRadius;
}
function limbDistance(s,x,z) {
  const r=Math.min(s.rx,s.rz),qx=(x-s.x)/s.rx,qz=(z-s.z)/s.rz,qy=s.capY/r,k0=Math.sqrt(qx*qx+qy*qy+qz*qz),k1=Math.hypot(qx/s.rx,qy/r,qz/s.rz);
  return k1>1e-9?k0*(k0-1)/k1:-r;
}
const union=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};

/** Single bounded sheep skin, with real mouth/nostril subtraction. This is an
 * authored sculpture mesher, not a replacement for any frozen shared geometry. */
export function createSheepAnatomicalEnvelope({solids,sweeps,cutouts},resolution,{sampleWindow}={}) {
  let minimum=[-.52,-.08,-1.0],size=[1.04,1.84,2.40];const blend=.036,capacity=sampleWindow?50000:200000;
  // A bounded authoring fixture uses the production field and grid spacing.
  // Its cut boundary is not a complete sculpture and is never a study owner.
  if(sampleWindow){
    const {start,count}=sampleWindow;
    if(!Array.isArray(start)||start.length!==3||!start.every(v=>Number.isInteger(v)&&v>=0)||!Number.isInteger(count)||count<8||count>48||start.some(v=>v+count>resolution))throw new Error('Sheep sampling window must fit the full authored grid');
    minimum=minimum.map((v,i)=>v+start[i]*size[i]/resolution);size=size.map(v=>v*count/resolution);resolution=count;
  }
  const material=new THREE.MeshBasicMaterial(),marching=new MarchingCubes(resolution,material,false,false,capacity),shapes=solids.map(preparedEllipsoid),holes=cutouts.map(preparedEllipsoid),profiles=sweeps.map(createSheepSectionProfile);
  marching.isolation=0;marching.field.fill(-.25);
  try {
    for(let iy=1;iy<resolution-1;iy++){
      const y=minimum[1]+iy*size[1]/resolution,active=shapes.filter(s=>Math.abs(y-s.center[1])<s.extent+.08),activeHoles=holes.filter(s=>Math.abs(y-s.center[1])<s.extent+.02),limbs=profiles.map(p=>p(y)).filter(s=>Math.abs(s.capY)<Math.max(s.rx,s.rz)+.06);
      for(let iz=1;iz<resolution-1;iz++){
        const z=minimum[2]+iz*size[2]/resolution;
        for(let ix=1;ix<resolution-1;ix++){
          const x=minimum[0]+ix*size[0]/resolution;let d=.25;
          for(const s of active)if(Math.abs(x-s.center[0])<s.extent+.08&&Math.abs(z-s.center[2])<s.extent+.08)d=union(d,ellipsoidDistance(s,x,y,z),blend);
          for(const s of limbs)if(Math.abs(x-s.x)<s.rx+.08&&Math.abs(z-s.z)<s.rz+.08)d=union(d,limbDistance(s,x,z),blend);
          for(const s of activeHoles)if(d<.06)d=Math.max(d,-ellipsoidDistance(s,x,y,z));
          marching.field[ix+resolution*(iy+resolution*iz)]=-d;
        }
      }
    }
    marching.update();if(marching.count>=capacity*3)throw new Error('Sheep anatomical envelope exceeded its explicit capacity');
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(marching.geometry.attributes.position.array.slice(0,marching.count*3),3));geometry.setAttribute('normal',new THREE.BufferAttribute(marching.geometry.attributes.normal.array.slice(0,marching.count*3),3));
    geometry.scale(size[0]/2,size[1]/2,size[2]/2);geometry.translate(...minimum.map((v,i)=>v+size[i]/2));geometry.userData={construction:'one-field-with-continuous-monotone-limb-sections',resolution,...(sampleWindow?{sampleWindow:structuredClone(sampleWindow),partialAuthoringFixture:true}:{})};return geometry;
  } finally {marching.geometry.dispose();material.dispose();}
}
