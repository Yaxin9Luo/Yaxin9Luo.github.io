import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { organicLoft } from './yuanyingguan-geometry.js';
import { redistributeSheepSkinSamples, subdivideSheepSkin, projectSheepFleeceLocks, sculptSheepFleece } from './xieqiqu-sheep-fleece.js';
import { createSheepAnatomicalEnvelope } from './xieqiqu-sheep-anatomy.js';
import { refineSheepShoulderSkin } from './xieqiqu-sheep-detail.js';

// The park identifies copper sheep, but their anatomy, horns and pose here are
// authored interpretation. +Z is the muzzle; the source fountain datum is fixed.
export const copperSheepMouth = Object.freeze([0, 1.30, 1.235]);
export const copperSheepFeet = Object.freeze([-1,1].flatMap(side=>[-.36,.57].map(z=>Object.freeze([side*.26,0,z]))));
export const copperSheepHoofSides = 32;
export const copperSheepEarSides = 48;

// Pure view specifications for the isolated review factory. Nothing is registered
// with the main scene or admitted to its archive catalogue by this module.
export const copperSheepStudyViews=Object.freeze({
  threequarter:{label:'铜羊全貌 · Copper sheep',groups:[],direction:[.8,.22,1]},
  front:{label:'面部与角 · Front',groups:[],direction:[0,.10,1]},
  side:{label:'头颈连续轮廓 · Side',groups:[],direction:[1,.10,.03]},
  rear:{label:'臀部与后肢 · Rear',groups:[],direction:[.70,.20,-1]},
  'head-join':{label:'颈肩与嘴腔 · Neck, shoulder and mouth',groups:[],direction:[.85,.15,1],crop:{min:[0,.56,.59],max:[1,1,1]},margin:1.15},
  'leg-joins':{label:'四肢关节与蹄 · Limb and hoof joins',groups:[],direction:[1,.08,.40],crop:{min:[0,0,0],max:[1,.72,.86]},margin:1.10},
});

const ellipsoid = (center,radii,rotation) => ({center,radii,...(rotation?{rotation}:{})});
function bodyForms(){
  const solids=[
    ellipsoid([0,1.025,-.13],[.32,.295,.69]),
    ellipsoid([0,1.02,-.54],[.29,.29,.29]),
    ellipsoid([0,1.055,.22],[.253,.278,.33]),
    ellipsoid([0,.995,.45],[.19,.205,.177]),
    ellipsoid([0,1.260,.59],[.175,.240,.195],[.28,0,0]),
    ellipsoid([0,1.355,.715],[.143,.135,.135]),
    ellipsoid([0,1.485,.795],[.143,.141,.156]),
    ellipsoid([0,1.400,1.003],[.108,.113,.226],[.44,0,0]),
    ellipsoid([0,1.325,1.169],[.085,.063,.084]),
    ellipsoid([0,1.290,1.063],[.098,.071,.148]),
    ellipsoid([0,1.268,1.187],[.078,.038,.066]),
  ],sweeps=[],cutouts=[ellipsoid([0,1.30,1.264],[.044,.025,.145])];
  for(const side of [-1,1]){
    solids.push(ellipsoid([side*.203,1.028,.40],[.091,.190,.14],[0,0,side*-.08]));
    solids.push(ellipsoid([side*.211,1.005,-.50],[.126,.215,.177]));
    solids.push(ellipsoid([side*.071,1.442,.895],[.098,.084,.12]));
    solids.push(ellipsoid([side*.116,1.490,.963],[.049,.027,.053]));
    solids.push(ellipsoid([side*.13,1.488,.838],[.086,.043,.073]));
    cutouts.push(ellipsoid([side*.160,1.470,.978],[.022,.016,.035]));
    cutouts.push(ellipsoid([side*.059,1.346,1.224],[.014,.010,.032],[.14,side*.25,0]));
    sweeps.push([
      [side*.203,1.035,.445,.108,.139],[side*.231,.80,.458,.080,.094],
      [side*.249,.65,.486,.049,.060],[side*.252,.52,.516,.061,.070],
      [side*.253,.40,.532,.034,.043],[side*.258,.29,.535,.031,.040],
      [side*.26,.195,.524,.049,.054],[side*.26,.132,.541,.044,.043],[side*.26,.09,.55,.044,.042],
    ]);
    sweeps.push([
      [side*.205,1.045,-.49,.132,.156],[side*.237,.80,-.475,.095,.113],
      [side*.26,.65,-.545,.070,.078],[side*.265,.51,-.604,.054,.061],
      [side*.26,.38,-.493,.033,.044],[side*.26,.26,-.393,.032,.041],
      [side*.26,.17,-.374,.049,.051],[side*.26,.13,-.36,.047,.047],[side*.26,.09,-.354,.043,.042],
    ]);
  }
  sweeps.push([[0,1.094,-.717,.066,.063],[0,1.057,-.817,.052,.055],[.006,.978,-.863,.041,.044],[.011,.934,-.865,.028,.027]]);
  return {solids,sweeps,cutouts};
}

/** One fused skin includes neck/chest and all four upper-leg roots. No exposed
 * planar caps exist at those joins. The mouth and nostrils are real cavities. */
export function createCopperSheepBodyGeometry({resolution=152,fleece=true,sampleWindow}={}){
  if(!Number.isInteger(resolution)||resolution<96||resolution>160)throw new Error('Copper sheep sampling must stay in the supported 96–160 authoring range');
  const raw=createSheepAnatomicalEnvelope(bodyForms(),resolution,{sampleWindow}),fieldNormals=raw.attributes.normal;
  let geometry;
  // Micrometre-scale tolerance collapsed distinct marching slivers and reversed
  // four faces at resolution 160. This tolerance only joins matching samples.
  try {raw.deleteAttribute('normal');raw.deleteAttribute('uv');geometry=mergeVertices(raw,1e-7);}finally{raw.dispose();}
  try {
    const p=geometry.attributes.position,old=geometry.index.array,indices=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    // Marching cells can create tiny but valid closing faces. Removing them by
    // area tolerance opens the skin; discard only exact zero-area degeneracy.
    for(let i=0;i<old.length;i+=3){const x=old[i],y=old[i+1],z=old[i+2];if(x===y||x===z||y===z)continue;a.fromBufferAttribute(p,x);b.fromBufferAttribute(p,y).sub(a);c.fromBufferAttribute(p,z).sub(a);if(b.cross(c).lengthSq()>0)indices.push(x,y,z);}
    // Interpolate the sampled distance-field gradient rather than weighting
    // very differently sized marching triangles. The latter creates grid bands
    // on smooth shoulders, although the positions themselves remain continuous.
    const normals=new Float32Array(p.count*3);
    for(let i=0;i<old.length;i++){const at=old[i]*3;normals[at]+=fieldNormals.getX(i);normals[at+1]+=fieldNormals.getY(i);normals[at+2]+=fieldNormals.getZ(i);}
    geometry.setIndex(indices);geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.normalizeNormals();
    const sampling=redistributeSheepSkinSamples(geometry);
    const locks=fleece?projectSheepFleeceLocks(geometry):[];
    const base=geometry;geometry=subdivideSheepSkin(base);base.dispose();
    const coarse=geometry;geometry=refineSheepShoulderSkin(coarse);coarse.dispose();const shoulderRefinement=geometry.userData.shoulderRefinement;
    const fleeceDiagnostics=sculptSheepFleece(geometry,locks),skinPosition=geometry.attributes.position;
    const uv=new Float32Array(skinPosition.count*2);for(let i=0;i<skinPosition.count;i++){uv[i*2]=skinPosition.getX(i)*.8;uv[i*2+1]=(skinPosition.getY(i)+skinPosition.getZ(i))*.5;}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name='xieqiqu-copper-sheep-continuous-anatomy';
    geometry.userData={construction:'one-welded-smooth-anatomical-union',resolution,sampling,shoulderRefinement,fleece:fleeceDiagnostics,continuousWoolReliefMaximumMeters:fleeceDiagnostics.maximumDisplacement,skinParts:['thorax','abdomen','neck','cranium','muzzle','four-articulated-limbs','tail'],mouthAnchor:[...copperSheepMouth],evidence:'copper-sheep-type-supported; anatomy-and-pose-inferred; new-imagegen-reference-is-authored-art-direction-only',...(sampleWindow?{sampleWindow:structuredClone(sampleWindow),partialAuthoringFixture:true}:{})};
    if(geometry.index.count/3>1400000)throw new Error('Copper sheep body exceeded its explicit local-detail triangle capacity');
    return geometry;
  }catch(error){geometry.dispose();throw error;}
}

export function createCopperSheepHornGeometry(side){
  if(side!==-1&&side!==1)throw new Error('Horn side must be -1 or 1');
  const sections=[
    [side*.090,1.550,.785,.058,.057],[side*.18,1.650,.735,.067,.075],
    [side*.28,1.655,.560,.058,.067],[side*.345,1.530,.385,.050,.055],
    [side*.370,1.345,.430,.040,.045],[side*.355,1.235,.615,.031,.036],
    [side*.315,1.235,.785,.023,.026],[side*.285,1.290,.860,.012,.016],[side*.270,1.350,.865,.0018,.0023],
  ];
  const curve=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(...s.slice(0,3)))),radii=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(s[3],s[4],0))),rings=[];
  for(let i=0;i<=160;i++){const t=i/160,p=curve.getPoint(t),r=radii.getPoint(t),growth=1+.055*Math.sin(t*Math.PI*2*38)*Math.sin(Math.PI*t)**.5;rings.push([...p.toArray(),r.x*growth,r.y*growth]);}
  const geometry=organicLoft(rings,28,192,.055,.001);geometry.name=`xieqiqu-copper-sheep-${side<0?'left':'right'}-tapered-side-curl`;
  geometry.userData={construction:'continuous-tapered-side-curl-with-subtle-growth-rings',root:sections[0].slice(0,3),rootRadius:.058,tipRadius:.0023};return geometry;
}

export function createCopperSheepEarGeometry(side){
  if(side!==-1&&side!==1)throw new Error('Ear side must be -1 or 1');
  const sides=copperSheepEarSides,steps=64,positions=[],uv=[],indices=[],across=new THREE.Vector3(0,.92,-.392).normalize(),forward=new THREE.Vector3(0,.392,.92).normalize();
  const centerAt=t=>new THREE.Vector3(side*(.07+.255*t),1.482+.046*t-.025*t*t,.84+.075*t-.018*t*t);
  for(let i=0;i<=steps;i++){
    // Cosine spacing resolves the rounded tip; the visible pinna is a compact
    // oval bowl, rather than the long triangular flap of the preceding review.
    const t=(1-Math.cos(Math.PI*i/steps))*.5,center=centerAt(t),bell=Math.sin(Math.PI*t),pinna=THREE.MathUtils.smoothstep(t,.10,.48),width=.052*Math.sqrt(bell)*pinna+.021*(1-t)**4+.0015*t,thickness=.0065*bell+.016*(1-t)**4+.001*t,cup=.032*bell**1.3*pinna,rolledRim=.015*bell*pinna;
    for(let j=0;j<sides;j++){
      const angle=j/sides*Math.PI*2,v=Math.cos(angle),point=center.clone().addScaledVector(across,v*width).addScaledVector(forward,Math.sin(angle)*(thickness+rolledRim*v**10)+cup*(v*v-1));
      positions.push(...point.toArray());uv.push(t,j/sides);
    }
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(...(side>0?[a,b,c,a,c,d]:[a,c,b,a,d,c]));}
  for(const end of [0,steps]){
    const start=positions.length/3,center=centerAt(end/steps);positions.push(...center.toArray());uv.push(end/steps,.5);
    for(let j=0;j<sides;j++){positions.push(...positions.slice((end*sides+j)*3,(end*sides+j)*3+3));uv.push(end/steps,j/sides);}
    for(let j=0;j<sides;j++){const a=start+1+j,b=start+1+(j+1)%sides;indices.push(...((end===0)===(side>0)?[start,b,a]:[start,a,b]));}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.name=`xieqiqu-copper-sheep-${side<0?'left':'right'}-cupped-rim-ear`;geometry.userData={root:[side*.07,1.482,.84],construction:'closed-oval-ear-with-integral-rolled-rim-and-recessed-bowl',cupDepth:.032,centralThickness:.016,rolledRimDerivativeRadius:.023};return geometry;
}

export function createCopperSheepHoofGeometry(foot,toe){
  if(!Number.isInteger(foot)||foot<0||foot>=4||![0,1].includes(toe))throw new Error('One of four feet and two cloven toes is required');
  const [x,,z]=copperSheepFeet[foot],sign=toe?1:-1;
  const sections=[[0,.036,.030,z+.030,.085,.65],[.012,.036,.033,z+.024,.081,.65],[.050,.032,.032,z+.010,.069,.72],[.092,.022,.021,z-.008,.039,.87],[.123,.016,.014,z+(z<0?.001:-.022),.024,1]],sides=copperSheepHoofSides,positions=[],uv=[],indices=[];
  for(const[y,offset,width,centerZ,length,power]of sections)for(let j=0;j<sides;j++){
    const angle=j/sides*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);positions.push(x+sign*offset+width*Math.sign(c)*Math.abs(c)**power,y,centerZ+length*Math.sign(s)*Math.abs(s)**power);uv.push(j/sides,y/.123);
  }
  for(let ring=0;ring<sections.length-1;ring++)for(let j=0;j<sides;j++){const a=ring*sides+j,b=ring*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,d,b,b,d,c);}
  for(const ring of [0,sections.length-1]){
    const start=positions.length/3,[y,offset,,centerZ]=sections[ring];positions.push(x+sign*offset,y,centerZ);uv.push(.5,.5);
    for(let j=0;j<sides;j++){positions.push(...positions.slice((ring*sides+j)*3,(ring*sides+j)*3+3));uv.push(j/sides,ring?1:0);}
    for(let j=0;j<sides;j++){const a=start+1+j,b=start+1+(j+1)%sides;indices.push(...(ring?[start,b,a]:[start,a,b]));}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.name=`xieqiqu-copper-sheep-foot-${foot}-cloven-toe-${toe}`;geometry.userData={soleY:0,foot,toe,construction:'closed-tapered-cloven-hoof-with-flat-ground-contact'};return geometry;
}

export const copperSheepComponentSpecs=Object.freeze([
  {id:'continuous-anatomy',role:'copper',create:createCopperSheepBodyGeometry},
  ...[-1,1].flatMap(side=>[
    {id:`horn-${side}`,role:'copper',create:()=>createCopperSheepHornGeometry(side)},
    {id:`ear-${side}`,role:'copper',create:()=>createCopperSheepEarGeometry(side)},
    {id:`eye-${side}`,role:'copperRecess',create:()=>{const g=new THREE.SphereGeometry(1,24,16);g.scale(.012,.011,.021);g.translate(side*.145,1.470,.985);g.name=`xieqiqu-copper-sheep-recessed-eye-${side}`;return g;}},
    {id:`eyelid-${side}`,role:'copper',create:()=>{const g=new THREE.TorusGeometry(1,.15,10,64);g.scale(.033,.019,.021);g.rotateY(Math.PI/2);g.translate(side*.147,1.470,.978);g.name=`xieqiqu-copper-sheep-fine-eyelid-${side}`;return g;}},
  ]),
  ...copperSheepFeet.flatMap((_,foot)=>[0,1].map(toe=>({id:`hoof-${foot}-${toe}`,role:'copper',create:()=>createCopperSheepHoofGeometry(foot,toe)}))),
]);
