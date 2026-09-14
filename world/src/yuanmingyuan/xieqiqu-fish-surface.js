import * as THREE from 'three';

// The holding institution identifies the surviving roll-tailed stone fish as
// Xieqiqu provenance, but records repairs to its mouth/tail. This is an authored
// continuous interpretation, constrained by the existing fountain outlet.
export const stoneFishMouth=Object.freeze([0,.96,1.25]);
const mouth=new THREE.Vector3(...stoneFishMouth),mouthNormal=new THREE.Vector3(0,.555,.832).normalize(),mouthUp=new THREE.Vector3(0,mouthNormal.z,-mouthNormal.y);
const sections=[
  [.96,1.25,.225,.145],[.88,1.13,.28,.205],[.83,.91,.365,.315],
  [.77,.61,.405,.355],[.66,.24,.37,.285],[.62,-.13,.285,.220],
  [.67,-.47,.190,.170],[.86,-.76,.145,.135],[1.17,-.85,.115,.112],
  [1.43,-.64,.096,.098],[1.45,-.31,.082,.086],[1.26,-.16,.060,.057],
  [1.105,-.095,.026,.015],
];
const centre=new THREE.CatmullRomCurve3(sections.map(([y,z])=>new THREE.Vector3(0,y,z))),radii=new THREE.CatmullRomCurve3(sections.map(([, ,x,y])=>new THREE.Vector3(x,y,0)));
const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const smooth=THREE.MathUtils.smoothstep;
const scaleRows=Array.from({length:43},(_,i)=>{
  const t=centre.getUtoTmapping(i/42),r=radii.getPoint(t),circumference=2*Math.PI*Math.sqrt((r.x*r.x+r.y*r.y)/2);
  return {t,columns:Math.max(5,Math.round(circumference/.105)),phase:(i%2)*.5,height:.0045+.002*Math.min(1,circumference/2.4)};
});
for(let i=0;i<scaleRows.length;i++)scaleRows[i].halfT=((scaleRows[Math.min(i+1,42)].t-scaleRows[Math.max(0,i-1)].t)/(i===0||i===42?1:2))*.68;

function scaleRelief(t,angle){
  const gate=smooth(t,.19,.25)*(1-smooth(t,.93,.99));if(gate===0)return 0;
  // Low integrated shingle relief. The crescent edge and interior share the
  // original skin; there are no conical scales or independently capped studs.
  let height=0;
  for(const row of scaleRows){
    const v=(t-row.t)/row.halfT;if(Math.abs(v)>=1)continue;
    const phase=angle/(Math.PI*2)*row.columns-row.phase,column=Math.round(phase),u=(phase-column)/.58,d=u*u+v*v;
    if(d>=1)continue;const radius=Math.sqrt(d),interior=row.height*(1-.22*u*u)*smooth(v,-1,.12)*(1-smooth(radius,.72,1)),edge=.0024*Math.exp(-(((radius-.83)/.085)**2))*smooth(v,-.40,.20);height=Math.max(height,interior+edge);
  }
  return gate*height;
}

export function sampleStoneFishSurface(t,angle,{relief=true}={}){
  const p=centre.getPoint(t),tangent=centre.getTangent(t),up=new THREE.Vector3(0,-tangent.z,tangent.y).normalize(),r=radii.getPoint(t),c=Math.cos(angle),s=Math.sin(angle);
  if(t<.03)up.lerp(mouthUp,1-smooth(t,0,.03)).normalize();
  let extra=relief?scaleRelief(t,angle):0;
  // Gill-cover relief and the eye socket are carved into the same head skin.
  const side=Math.min(Math.abs(wrap(angle)),Math.abs(wrap(angle-Math.PI))),cheek=Math.exp(-((side/.65)**4)),gill=Math.exp(-(((t-.195)/.014)**2))-.36*Math.exp(-(((t-.218)/.010)**2));
  if(relief)extra+=.010*gill*cheek;
  if(relief){const eyeT=(t-.112)/.022,eyeA=side/.14,d=Math.hypot(eyeT,eyeA);extra+=.009*Math.exp(-(((d-1.12)/.25)**2))-.009*Math.exp(-((d/.70)**2));}
  const outward=new THREE.Vector3(c/r.x,up.y*s/r.y,up.z*s/r.y).normalize();p.x+=r.x*c;p.addScaledVector(up,r.y*s).addScaledVector(outward,extra);
  return {position:p,normal:outward,up,centre:centre.getPoint(t),radii:r};
}

/** Invert the authored smooth flank at a fin's y/z. This samples the original
 * body profile, not a separate ellipsoid or an AABB pretending to be contact. */
export function stoneFishFlankAt(y,z){
  if(![y,z].every(Number.isFinite))throw new Error('Fish flank query must be finite');let t=THREE.MathUtils.clamp((1.25-z)/2.6,.08,.52),a=0;
  for(let i=0;i<14;i++){const p=sampleStoneFishSurface(t,a,{relief:false}).position,dy=y-p.y,dz=z-p.z;if(Math.hypot(dy,dz)<1e-8)return {position:p,t,angle:a};const h=.00001,dt=sampleStoneFishSurface(t+h,a,{relief:false}).position.sub(sampleStoneFishSurface(t-h,a,{relief:false}).position).multiplyScalar(.5/h),da=sampleStoneFishSurface(t,a+h,{relief:false}).position.sub(sampleStoneFishSurface(t,a-h,{relief:false}).position).multiplyScalar(.5/h),det=dt.y*da.z-da.y*dt.z;if(Math.abs(det)<1e-9)break;t=THREE.MathUtils.clamp(t+THREE.MathUtils.clamp((dy*da.z-dz*da.y)/det,-.05,.05),.08,.52);a=THREE.MathUtils.clamp(a+THREE.MathUtils.clamp((dz*dt.y-dy*dt.z)/det,-.3,.3),-1.35,1.35);}
  throw new Error('Fin root lies outside the invertible authored fish flank');
}

/** One indexed closed skin travels from the deep mouth cup over the lip and
 * around the curled body. sampleEnd only makes an explicit bounded authoring
 * fixture; the actual study always uses the complete body. */
export function createRolledStoneFishBody({sampleEnd=1}={}){
  if(!Number.isFinite(sampleEnd)||sampleEnd<.20||sampleEnd>1)throw new Error('Fish sampling end must be in .20..1');
  // Sampling resolves the actual carved crescent, whose shoulder was blurred
  // across only 5-7 vertices in the rejected whole sculpture. No mesh reduction.
  const sides=512,steps=Math.ceil(1280*sampleEnd),positions=[],uv=[],ids=[],rings=[];
  const addRing=pointAt=>{const start=positions.length/3;rings.push(start);for(let j=0;j<sides;j++){const p=pointAt(j/sides*Math.PI*2);positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);}return start;};
  const back=mouth.clone().addScaledVector(mouthNormal,-.245);positions.push(...back.toArray());uv.push(0,0);
  for(let i=1;i<=28;i++){
    const t=i/28,r=Math.sin(t*Math.PI/2),at=mouth.clone().addScaledVector(mouthNormal,-.245*(1-t)**1.3);
    addRing(a=>at.clone().add(new THREE.Vector3(.132*r*Math.cos(a),0,0)).addScaledVector(mouthUp,.091*r*Math.sin(a)));
  }
  // A smoothly rolled, non-circular lip joins cavity to cheek without a washer.
  for(let i=1;i<=12;i++){const t=i/12,f=smooth(t,0,1);addRing(a=>{const c=Math.cos(a),s=Math.sin(a),p=mouth.clone().addScaledVector(mouthNormal,.018*Math.sin(Math.PI*t));p.x+=(.132+(.225-.132)*f)*c;p.addScaledVector(mouthUp,(.091+(.145-.091)*f)*s);return p;});}
  for(let i=1;i<=steps;i++)addRing(a=>sampleStoneFishSurface(i/steps*sampleEnd,a).position);
  for(let j=0;j<sides;j++)ids.push(0,rings[0]+j,rings[0]+(j+1)%sides);
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<sides;j++){const a=rings[r]+j,b=rings[r]+(j+1)%sides,c=rings[r+1]+(j+1)%sides,d=rings[r+1]+j;ids.push(a,d,b,b,d,c);}
  const cap=positions.length/3,end=centre.getPoint(sampleEnd);positions.push(...end.toArray());uv.push(end.x*.8,(end.y+end.z)*.5);for(let j=0;j<sides;j++)ids.push(cap,rings.at(-1)+(j+1)%sides,rings.at(-1)+j);
  const geometry=new THREE.BufferGeometry();geometry.name='xieqiqu-stone-fish-r3-continuous-mouth-cheek-scales-and-rolled-tail';geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(ids);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={construction:'single-closed-indexed-skin-with-invaginated-mouth-and-integral-scale-relief',mouthAnchor:[...stoneFishMouth],mouthNormal:mouthNormal.toArray(),mouthDepth:.245,scaleReliefMaximum:.0089,sides,steps,sourceEvidence:'PKU-held-relic-assigned-to-Xieqiqu; mouth-and-tail-repaired; current-shape-is-authored-interpretation',partialAuthoringFixture:sampleEnd<1,sampleEnd};return geometry;
}
