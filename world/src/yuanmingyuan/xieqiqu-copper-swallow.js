import * as THREE from 'three';
import {organicLoft} from './yuanyingguan-geometry.js';
import {createCamberedSculptureSkin,sampledShapeOutline,createBorrowedMaterialSculpture} from './xieqiqu-sculpture-skin.js';
import {swallowWingHeight,swallowWingHalfThickness,swallowWingFeatherSpecs} from './xieqiqu-swallow-feathers.js';
import {createContinuousSwallowBody,swallowEyePosition,swallowSurfaceMouth} from './xieqiqu-swallow-surface.js';

export const copperSwallowMouth=swallowSurfaceMouth;
export const copperSwallowStudyViews=Object.freeze({
  threequarter:{label:'铜燕候选 · Copper swallow',groups:[],direction:[.65,.60,1]},
  profile:{label:'翼弧与厚度 · Wing camber',groups:[],direction:[1,.04,.20]},
  top:{label:'尖翼与叉尾 · Wing and tail plan',groups:[],direction:[.05,1,.1]},
  head:{label:'上下喙与嘴隙 · Open beak',groups:[],direction:[.4,.20,1],crop:{min:[.36,.52,.63],max:[.64,1,1]}},
});

export function createCopperSwallowWingGeometry(side){
  if(![-1,1].includes(side))throw new Error('Swallow wing side must be -1 or 1');
  const shape=new THREE.Shape();shape.moveTo(.07,.06);shape.bezierCurveTo(.30,.12,.62,-.05,1.10,-.66);shape.bezierCurveTo(.77,-.54,.45,-.45,.12,-.25);shape.quadraticCurveTo(.08,-.15,.07,.06);shape.closePath();
  const map=(x,z)=>[side*x,swallowWingHeight(x,z),z];
  return createCamberedSculptureSkin({name:`xieqiqu-swallow-r3-cambered-anatomical-wing-${side}`,outline:sampledShapeOutline(shape,map,144),center:map(.42,-.16),normal:[0,1,0],rings:24,halfThickness:p=>swallowWingHalfThickness(p.x),bend:p=>swallowWingHeight(p.x,p.z)-p.y});
}

export function createCopperSwallowTailGeometry(side){
  if(![-1,1].includes(side))throw new Error('Swallow tail side must be -1 or 1');
  const shape=new THREE.Shape();shape.moveTo(.012,-.30);shape.quadraticCurveTo(.13,-.50,.205,-.98);shape.quadraticCurveTo(.04,-.80,-.012,-.37);shape.closePath();const map=(x,z)=>[side*x,.455+.035*(-z-.30),z];
  return createCamberedSculptureSkin({name:`xieqiqu-swallow-r2-forked-tail-${side}`,outline:sampledShapeOutline(shape,map,64),center:map(.073,-.59),normal:[0,1,0],rings:12,halfThickness:p=>.0015+.007*(1-THREE.MathUtils.smoothstep(-p.z,.34,.68)),bend:(p,rho)=>.01*Math.sin(Math.PI*rho)});
}

export function createCopperSwallowBodyGeometry(){
  return createContinuousSwallowBody();
}

export function createCopperSwallowLegGeometry(side){
  return organicLoft([[side*.055,.44,.045,.022,.024],[side*.047,.265,.02,.013,.016],[side*.060,.10,.078,.009,.011],[side*.059,.050,.092,.015,.017],[side*.060,.031,.105,.018,.019],[side*.060,.013,.116,.010,.011]],24,48,0,.002);
}

export function createCopperSwallowToeGeometry(side,toe){
  if(![-1,1].includes(side)||![-1,0,1,2].includes(toe))throw new Error('A foot needs its mirrored side and three forward toes or the hallux');
  const sections=toe===2?[[side*.060,.030,.107,.0086,.008],[side*.049,.017,.063,.007,.006],[side*.041,.011,.037,.0045,.004],[side*.040,.003,.019,.0018,.002],[side*.040,.0006,.017,.0002,.00022]]:[[side*.060+toe*.0025,.030,.107,.0086,.008],[side*.060+toe*.013,.019,.140,.007,.006],[side*.060+toe*.024,.016,.184- Math.abs(toe)*.006,.0055,.0048],[side*.060+toe*.030,.010,.202-Math.abs(toe)*.011,.003,.003],[side*.060+toe*.029,.003,.208-Math.abs(toe)*.011,.0018,.002],[side*.060+toe*.028,.0006,.210-Math.abs(toe)*.011,.0002,.00022]];
  const sides=32,steps=96,geometry=organicLoft(sections,sides,steps,0,.00015),p=geometry.attributes.position,n=geometry.attributes.normal;
  // Shallow dorsal scutes stop before the claw and before the buried root;
  // each stays in the real toe skin instead of becoming a separate cuff.
  for(let i=0;i<=steps;i++){const t=i/steps,phase=t*9-Math.round(t*9),relief=.00045*Math.exp(-((phase/.12)**2))*THREE.MathUtils.smoothstep(t,.08,.18)*(1-THREE.MathUtils.smoothstep(t,.75,.86));for(let j=0;j<sides;j++){const at=i*sides+j,h=relief*THREE.MathUtils.smoothstep(n.getY(at),.05,.85);p.setXYZ(at,p.getX(at)+h*n.getX(at),p.getY(at)+h*n.getY(at),p.getZ(at)+h*n.getZ(at));}}
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox.min.y,0);geometry.userData={...geometry.userData,sides,steps,maximumDorsalScuteRelief:.00045};return geometry;
}

export const copperSwallowComponentSpecs=Object.freeze([
    {id:'continuous-body-and-beak',role:'copper',create:createCopperSwallowBodyGeometry},
    ...[-1,1].flatMap(side=>[
      {id:`wing-${side}`,role:'copper',create:()=>createCopperSwallowWingGeometry(side)},
      ...swallowWingFeatherSpecs(side),
      {id:`tail-${side}`,role:'copper',create:()=>createCopperSwallowTailGeometry(side)},
      {id:`leg-${side}`,role:'copper',create:()=>createCopperSwallowLegGeometry(side)},
      ...[-1,0,1,2].map(toe=>({id:`toe-${side}-${toe}`,role:'copper',create:()=>createCopperSwallowToeGeometry(side,toe)})),
      {id:`eye-${side}`,role:'copperRecess',create:()=>{const geometry=new THREE.SphereGeometry(1,28,20);geometry.scale(.007,.008,.011);geometry.translate(...swallowEyePosition(side));return geometry;}},
    ]),
]);

/** The factory borrows the caller's real source copper materials. It intentionally
 * provides no default colour-only substitute and does not dispose source maps. */
export function createXieqiquCopperSwallowStudy({materials,signal}={}){
  return createBorrowedMaterialSculpture({id:'xieqiqu-copper-swallow-r3',materials,roles:['copper','copperRecess'],mouthAnchor:copperSwallowMouth,signal,parts:copperSwallowComponentSpecs});
}
