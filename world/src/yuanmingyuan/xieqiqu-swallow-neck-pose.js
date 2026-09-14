import * as THREE from 'three';
import {createContinuousSwallowBody} from './xieqiqu-swallow-surface.js';

// Local authoring proposal. No full factory, Studio or fountain uses this yet.
// The old outlet was an implementation coordinate, not a historical datum.
export const swallowShortNeckStatus='local-authoring-proposal; no-complete-model-or-native-review';
export const swallowShortNeckParameters=Object.freeze({torsoDrop:.185,headDrop:.170,headRetraction:.10,transitionMinZ:.10,transitionMaxZ:.36,shoulderWidthGain:.15});
export const swallowShortNeckMouth=Object.freeze([0,.417,.479]);
export const swallowShortNeckFountainContract=Object.freeze({
  previousAnchor:Object.freeze([0,.587,.579]),mouthAnchor:swallowShortNeckMouth,mouthDirection:Object.freeze([0,0,1]),
  change:'head and complete recessed beak translated down 0.170 m and back 0.100 m; exact local outlet must drive a future jet',
  landingPointChanged:false,worldIntegrated:false,
});

/** Neck compression has a strictly increasing Z map. The head/beak move as
 * one rigid region; the shoulder broadens across a compact smooth interval.
 * Hindbody, tail, wing roots and leg sockets retain the previous short pose. */
export function poseShortNeckBodyPoint(point,target=new THREE.Vector3()){
  const z=point.z,p=swallowShortNeckParameters,t=THREE.MathUtils.smoothstep(z,p.transitionMinZ,p.transitionMaxZ),shoulder=THREE.MathUtils.smoothstep(z,.06,.20)*(1-THREE.MathUtils.smoothstep(z,.30,.37));
  return target.set(point.x*(1+p.shoulderWidthGain*shoulder),point.y-p.torsoDrop-(p.headDrop-p.torsoDrop)*t,z-p.headRetraction*t);
}

/** A deliberately cut, closed local neck fixture, never the whole sculpture.
 * The back cap is artificial and may only be used for topology diagnosis. */
export function createSwallowShortNeckLocalGeometry({endZ=.10}={}){
  if(!Number.isFinite(endZ)||endZ<.08||endZ>.20)throw new Error('Short-neck fixtures must cut the local shoulder at .08.. .20');
  const geometry=createContinuousSwallowBody({endZ}),point=new THREE.Vector3(),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);poseShortNeckBodyPoint(point,point);p.setXYZ(i,point.x,point.y,point.z);}
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.name='xieqiqu-swallow-short-neck-local-cut';geometry.userData={...geometry.userData,pose:swallowShortNeckStatus,mouthAnchor:[...swallowShortNeckMouth],artificialRearCap:true,wholeBodyConstructed:false};return geometry;
}
