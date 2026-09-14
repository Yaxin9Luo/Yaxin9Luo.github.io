import * as THREE from 'three';
import {createCamberedSculptureSkin,sampledShapeOutline,createBorrowedMaterialSculpture} from './xieqiqu-sculpture-skin.js';
import {createRolledStoneFishBody,sampleStoneFishSurface,stoneFishMouth,stoneFishFlankAt} from './xieqiqu-fish-surface.js';

export {stoneFishMouth};
export const stoneFishStudyViews=Object.freeze({
  threequarter:{label:'翻尾石鱼候选 · Upturned fish',groups:[],direction:[.8,.2,1]},
  side:{label:'上翻曲线 · Curved profile',groups:[],direction:[1,.10,.04]},
  tail:{label:'卷尾与薄鳍 · Rolled tail and curved fin',groups:[],direction:[1,.15,.25],crop:{min:[.12,.32,0],max:[.88,1,.62]}},
  mouth:{label:'嘴腔与头部 · Mouth and head',groups:[],direction:[.5,.15,1],crop:{min:[.08,.28,.66],max:[.92,.88,1]}},
});

export function createStoneFishTailGeometry(){
  const shape=new THREE.Shape();shape.moveTo(-.027,-.145);shape.bezierCurveTo(-.10,-.07,-.30,.05,-.31,.18);shape.quadraticCurveTo(-.20,.26,0,.14);shape.quadraticCurveTo(.20,.26,.31,.18);shape.bezierCurveTo(.30,.05,.10,-.07,.027,-.145);shape.closePath();
  const smooth=THREE.MathUtils.smoothstep,map=(x,z)=>[x,1.103-.58*(z+.095),z];
  return createCamberedSculptureSkin({name:'xieqiqu-fish-r3-folded-caudal-fin-at-rolled-tail-end',outline:sampledShapeOutline(shape,map,144),center:map(0,.09),normal:[0,1,.58],rings:22,halfThickness:p=>.006+.021*(1-smooth(p.z,-.08,.15)),bend:p=>.016*Math.sin(Math.PI*smooth(p.z,-.145,.25))+.0018*Math.cos(Math.atan2(p.x,p.z+.17)*26)*smooth(p.z,-.13,-.04)});
}

function roundPectoralRim(geometry){
  const sides=geometry.userData.outlineSamples,rings=geometry.userData.rings,layer=1+rings*sides,front=1+(rings-1)*sides,back=layer+front,p=geometry.attributes.position,positions=Array.from(p.array),uv=Array.from(geometry.attributes.uv.array),indices=Array.from(geometry.index.array.slice(0,-sides*6)),rows=[front],steps=12;
  for(let r=1;r<steps;r++){rows.push(positions.length/3);const a=r/steps*Math.PI;for(let j=0;j<sides;j++){const top=new THREE.Vector3().fromBufferAttribute(p,front+j),bottom=new THREE.Vector3().fromBufferAttribute(p,back+j),mid=top.clone().add(bottom).multiplyScalar(.5),half=top.clone().sub(bottom).multiplyScalar(.5),inner=new THREE.Vector3().fromBufferAttribute(p,front-sides+j).add(new THREE.Vector3().fromBufferAttribute(p,back-sides+j)).multiplyScalar(.5),radial=mid.clone().sub(inner).normalize(),point=mid.addScaledVector(half,Math.cos(a)).addScaledVector(radial,half.length()*.55*Math.sin(a));positions.push(...point.toArray());uv.push(point.x*.8,(point.y+point.z)*.5);}}
  rows.push(back);for(let r=0;r<rows.length-1;r++)for(let j=0;j<sides;j++){const a=rows[r]+j,b=rows[r]+(j+1)%sides,c=rows[r+1]+(j+1)%sides,d=rows[r+1]+j;indices.push(a,d,b,b,d,c);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.deleteAttribute('normal');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={...geometry.userData,construction:'body-conforming-fin-with-rounded-closed-rim',skinLayerVertexCount:layer,rimArcSteps:steps};return geometry;
}

export function createStoneFishPectoralGeometry(side){
  if(![-1,1].includes(side))throw new Error('Fish fin side must be -1 or 1');
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.15,.12,.36,.12,.58,-.10);shape.bezierCurveTo(.56,-.28,.41,-.47,.33,-.43);shape.bezierCurveTo(.22,-.33,.10,-.20,0,-.05);shape.closePath();
  const smooth=THREE.MathUtils.smoothstep,extension=u=>-.025*(1-smooth(u,.03,.18))+.31*smooth(u,.06,.58),map=(u,v)=>{const y=.86+v*.72,z=.58-u*.72;return [side*(stoneFishFlankAt(y,z).position.x+extension(u)),y,z];};
  return roundPectoralRim(createCamberedSculptureSkin({name:`xieqiqu-fish-r3-pectoral-${side}`,outline:sampledShapeOutline(shape,map,192),center:map(.24,-.13),normal:[side,0,0],rings:32,halfThickness:p=>.003+.013*(1-smooth((.58-p.z)/.72,0,.52)),bend:p=>{const u=(.58-p.z)/.72,v=(p.y-.86)/.72;return stoneFishFlankAt(p.y,p.z).position.x+extension(u)-side*p.x+.0015*Math.cos(Math.atan2(v+.04,u)*18)*smooth(u,.04,.15);}}));
}

export function createStoneFishBodyGeometry(){
  return createRolledStoneFishBody();
}

export const stoneFishComponentSpecs=Object.freeze([
  {id:'continuous-body',role:'carving',create:createStoneFishBodyGeometry},
  {id:'curved-tail',role:'carving',create:createStoneFishTailGeometry},
  ...[-1,1].flatMap(side=>[
    {id:`pectoral-${side}`,role:'carving',create:()=>createStoneFishPectoralGeometry(side)},
    {id:`eye-${side}`,role:'oldStone',create:()=>{const sample=sampleStoneFishSurface(.112,side>0?0:Math.PI),p=sample.position.addScaledVector(sample.normal,-.014),g=new THREE.SphereGeometry(1,32,20);g.scale(.027,.037,.041);g.translate(...p.toArray());return g;}},
  ]),
]);

/** Callable preparation entry. Materials must come from the frozen source owner;
 * no surrogate stone material is created. Whole candidate has not been reviewed. */
export function createXieqiquStoneFishStudy({materials,signal}={}){
  return createBorrowedMaterialSculpture({id:'xieqiqu-stone-fish-r3',materials,roles:['carving','oldStone'],mouthAnchor:stoneFishMouth,signal,parts:stoneFishComponentSpecs});
}
