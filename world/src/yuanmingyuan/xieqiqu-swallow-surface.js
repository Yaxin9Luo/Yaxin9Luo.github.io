import * as THREE from 'three';

export const swallowSurfaceMouth=Object.freeze([0,.587,.579]);
const mouth=new THREE.Vector3(...swallowSurfaceMouth),smooth=THREE.MathUtils.smoothstep;
// Authored anatomy, constrained by the existing fountain outlet. Each section
// is [z, centreY, halfWidth, halfHeight], not a historical measurement.
const sections=[
  [.579,.587,.018,.019],[.54,.590,.025,.022],[.485,.597,.041,.029],
  [.431,.610,.068,.046],[.362,.622,.085,.076],[.277,.611,.088,.083],
  [.17,.566,.120,.117],[.015,.515,.133,.133],[-.17,.498,.105,.103],
  [-.295,.491,.055,.053],[-.357,.490,.012,.017],[-.366,.490,.002,.003],
].reverse();
const fields=[1,2,3].map(column=>{
  const v=sections.map(s=>s[column]),h=sections.slice(1).map((s,i)=>s[0]-sections[i][0]),d=h.map((x,i)=>(v[i+1]-v[i])/x),m=v.map((_,i)=>{
    if(i===0)return d[0];if(i===v.length-1)return d.at(-1);if(d[i-1]*d[i]<=0)return 0;
    const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];return (a+b)/(a/d[i-1]+b/d[i]);
  });return {v,h,m};
});

export function swallowBodyProfile(z){
  z=THREE.MathUtils.clamp(z,sections[0][0],sections.at(-1)[0]);let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;
  const h=sections[i+1][0]-sections[i][0],t=(z-sections[i][0])/h,values=[],derivatives=[];
  for(const {v,m}of fields){values.push((2*t**3-3*t*t+1)*v[i]+(t**3-2*t*t+t)*h*m[i]+(-2*t**3+3*t*t)*v[i+1]+(t**3-t*t)*h*m[i+1]);derivatives.push(((6*t*t-6*t)*v[i]+(3*t*t-4*t+1)*h*m[i]+(-6*t*t+6*t)*v[i+1]+(3*t*t-2*t)*h*m[i+1])/h);}
  return {z,centerY:values[0],width:values[1],height:values[2],derivatives};
}

const featherRows=Array.from({length:18},(_,i)=>{
  const z=-.30+i*.0345,profile=swallowBodyProfile(z),circ=2*Math.PI*Math.sqrt((profile.width**2+profile.height**2)/2);
  return {z,columns:Math.max(8,Math.round(circ/.034)),phase:i*.381,halfLength:.024};
});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function plumage(z,angle){
  let value=0;
  for(const row of featherRows){const v=(z-row.z)/row.halfLength;if(Math.abs(v)>=1)continue;const phase=(angle-row.phase)/(Math.PI*2)*row.columns,u=(phase-Math.round(phase))/.57,d=u*u+v*v;if(d>=1)continue;
    const fade=(1-d)**2,plate=.00115*fade,shaft=.00028*Math.exp(-((u/.15)**2))*fade,edge=.00045*Math.exp(-(((Math.sqrt(d)-.72)/.14)**2))*smooth(-v,-.2,.6);value=Math.max(value,plate+shaft+edge);
  }return value*smooth(z,-.355,-.29)*(1-smooth(z,.28,.34));
}

export function sampleSwallowSurface(z,angle,{detail=true}={}){
  const p=swallowBodyProfile(z),c=Math.cos(angle),s=Math.sin(angle),[cy,rx,ry]=p.derivatives,normal=new THREE.Vector3(c/p.width,s/p.height,-rx/p.width*c*c-cy/p.height*s-ry/p.height*s*s).normalize(),position=new THREE.Vector3(p.width*c,p.centerY+p.height*s,z);let relief=0;
  if(detail){relief=plumage(z,angle);const eyeAngle=Math.min(Math.abs(wrap(angle-.34)),Math.abs(wrap(angle-(Math.PI-.34)))),u=(z-.390)/.012,v=eyeAngle/.13,d=Math.hypot(u,v);relief+=.0018*Math.exp(-(((d-1.1)/.30)**2))-.0035*Math.exp(-((d/.7)**2));position.addScaledVector(normal,relief);}
  return {position,normal,profile:p,relief};
}

export function swallowEyePosition(side){
  if(![-1,1].includes(side))throw new Error('Eye side must be -1 or 1');const sample=sampleSwallowSurface(.390,side>0?.34:Math.PI-.34);return sample.position.addScaledVector(sample.normal,-.0035).toArray();
}

/** One indexed skin: recessed mouth, rolled lip, tapered beak, head, torso and
 * tail root. Optional endZ constructs only an explicitly labelled local fixture. */
export function createContinuousSwallowBody({endZ=-.366}={}){
  if(!Number.isFinite(endZ)||endZ<-.366||endZ>.40)throw new Error('Swallow local skin end must be within -.366.. .40, behind the real mouth cavity');
  const sides=256,spacing=.0015,beakBase=.455,backZ=.410,steps=Math.ceil((beakBase-endZ)/spacing),positions=[],uv=[],ids=[],rings=[],addPoint=p=>{positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);},addRing=sample=>{rings.push(positions.length/3);for(let j=0;j<sides;j++)addPoint(sample(j/sides*Math.PI*2));};
  // The gape reaches back to the two mouth corners. Upper and lower tips sit
  // forward, so the opening is a beak cleft rather than a circular pipe end.
  const lip=(a,outer=false)=>{const s=Math.sin(a),c=Math.cos(a),ac=(Math.sqrt(c*c+.000025)-.005)/(Math.sqrt(1.000025)-.005),z=.470+(.109-(s<0?.011:0))*(1-ac)**1.4;return new THREE.Vector3((outer?.036:.034)*c,.587+(outer?.0105:.008)*s,z);};
  addPoint(new THREE.Vector3(0,.587,backZ));
  for(let i=1;i<=40;i++){const t=i/40,r=Math.sin(t*Math.PI/2);addRing(a=>{const p=lip(a);p.x*=r;p.y=.587+(p.y-.587)*r;p.z=backZ+(p.z-backZ)*t;return p;});}
  for(let i=1;i<=12;i++){const t=i/12,f=smooth(t,0,1);addRing(a=>lip(a).lerp(lip(a,true),f).add(new THREE.Vector3(0,0,.0007*Math.sin(Math.PI*t))));}
  for(let i=1;i<=112;i++){const t=i/112;addRing(a=>{const p=lip(a,true),end=sampleSwallowSurface(beakBase,a,{detail:false}).position,d0=end.clone().sub(p),h=.00001,d1=sampleSwallowSurface(beakBase+h,a,{detail:false}).position.sub(sampleSwallowSurface(beakBase-h,a,{detail:false}).position).multiplyScalar((beakBase-p.z)/(2*h));return p.multiplyScalar(2*t**3-3*t*t+1).addScaledVector(d0,t**3-2*t*t+t).addScaledVector(end,-2*t**3+3*t*t).addScaledVector(d1,t**3-t*t);});}
  for(let i=1;i<=steps;i++){const z=beakBase-(beakBase-endZ)*i/steps;addRing(a=>sampleSwallowSurface(z,a).position);}
  for(let j=0;j<sides;j++)ids.push(0,rings[0]+j,rings[0]+(j+1)%sides);
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<sides;j++){const a=rings[r]+j,b=rings[r]+(j+1)%sides,c=rings[r+1]+(j+1)%sides,d=rings[r+1]+j;ids.push(a,d,b,b,d,c);}
  // A local fixture's artificial cut has its own normal seam. It must not
  // average its large closure triangles into the retained skin at that cut.
  let capRing=rings.at(-1);if(endZ!==-.366){const sourceRing=capRing;capRing=positions.length/3;for(let j=0;j<sides;j++)addPoint(new THREE.Vector3().fromArray(positions,(sourceRing+j)*3));}
  const cap=positions.length/3;addPoint(new THREE.Vector3(0,swallowBodyProfile(endZ).centerY,endZ));for(let j=0;j<sides;j++)ids.push(cap,capRing+(j+1)%sides,capRing+j);
  const g=new THREE.BufferGeometry();g.name='xieqiqu-swallow-continuous-mouth-and-plumage-skin';g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={construction:'continuous-profile-skin-with-recessed-mouth-and-local-plumage',mouthAnchor:[...swallowSurfaceMouth],mouthDepth:mouth.z-backZ,mouthCornerZ:.470,beakBase,sides,steps,maximumAxialSpacing:spacing,plumageMaximum:.00188,partialAuthoringFixture:endZ!==-.366,endZ};return g;
}
