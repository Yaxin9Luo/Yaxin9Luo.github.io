import * as THREE from 'three';
import {copperSwallowComponentSpecs} from './xieqiqu-copper-swallow.js';
import {copperSwallowPoseComponentSpecs} from './xieqiqu-swallow-pose-study.js';
import {poseShortNeckBodyPoint,swallowShortNeckMouth,swallowShortNeckParameters,swallowShortNeckFountainContract} from './xieqiqu-swallow-neck-pose.js';
import {createBorrowedMaterialSculpture} from './xieqiqu-sculpture-skin.js';
import {createXieqiquSculptureMaterialOwner} from './xieqiqu-study.js';
import {copperSwallowShortNeckStudyId} from './xieqiqu-swallow-shortneck-views.js';
import {createSwallowUnderwingGeometry,swallowUnderwingParameters} from './xieqiqu-swallow-underwing.js';
import {copperSwallowUnderwingStudyId} from './xieqiqu-swallow-underwing-views.js';
export {copperSwallowShortNeckStudyId,copperSwallowShortNeckStudyViews} from './xieqiqu-swallow-shortneck-views.js';

export function applyShortNeckBodyGeometry(geometry){
  if(!geometry?.isBufferGeometry||geometry.userData.pose)throw new Error('A fresh unposed bird body is required');
  const point=new THREE.Vector3(),position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i);poseShortNeckBodyPoint(point,point);position.setXYZ(i,point.x,point.y,point.z);}
  position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...geometry.userData,pose:copperSwallowShortNeckStudyId,mouthAnchor:[...swallowShortNeckMouth],mouthNormal:[0,0,1]};return geometry;
}

export const copperSwallowShortNeckComponentSpecs=Object.freeze(copperSwallowPoseComponentSpecs.map(posed=>{
  if(posed.posePart!=='body'&&posed.posePart!=='eye')return posed;
  const source=copperSwallowComponentSpecs.find(part=>part.id===posed.id);
  return Object.freeze({...posed,create(){
    let geometry;try{
      geometry=source.create();
      if(posed.posePart==='body')return applyShortNeckBodyGeometry(geometry);
      // The entire eye lies in the rigid head region. Preserve its analytic
      // ellipsoid normals, including the sphere's unused pole vertices.
      geometry.translate(0,-swallowShortNeckParameters.headDrop,-swallowShortNeckParameters.headRetraction);
      geometry.userData={...geometry.userData,pose:copperSwallowShortNeckStudyId,rigidHeadTranslation:true};return geometry;
    }catch(error){geometry?.dispose();throw error;}
  }});
}));

export function createXieqiquCopperSwallowShortNeckStudy({materials,signal,underwingCoverts=false}={}){
  if(typeof underwingCoverts!=='boolean')throw new Error('Underwing coverts must be an explicit boolean');
  const id=underwingCoverts?copperSwallowUnderwingStudyId:copperSwallowShortNeckStudyId,parts=underwingCoverts?[...copperSwallowShortNeckComponentSpecs,...[-1,1].map(side=>({id:`underwing-coverts-${side}`,role:'copper',create:()=>createSwallowUnderwingGeometry(side,{signal})}))]:copperSwallowShortNeckComponentSpecs;
  const owner=createBorrowedMaterialSculpture({id,materials,roles:['copper','copperRecess'],mouthAnchor:swallowShortNeckMouth,parts,signal});
  owner.group.userData.fountain={mouthAnchor:[...swallowShortNeckMouth],mouthDirection:[0,0,1]};
  owner.diagnostics.fountain={...swallowShortNeckFountainContract,mouthAnchor:[...swallowShortNeckMouth],mouthDirection:[0,0,1],worldIntegrated:false};
  owner.diagnostics.pose={status:'complete-shortneck-authoring-candidate; native-pending',directionReviewed:true,candidateFactory:true,nativeApproved:false,worldIntegrated:false,parameters:{...swallowShortNeckParameters}};
  if(underwingCoverts)owner.diagnostics.underwing={...swallowUnderwingParameters,addedMeshes:2,baseComponents:79,nativeApproved:false};return owner;
}

export function createXieqiquCopperSwallowShortNeckReviewStudy({signal,underwingCoverts=false}={}){
  if(typeof underwingCoverts!=='boolean')throw new Error('Underwing coverts must be an explicit boolean');
  if(signal?.aborted)throw new DOMException('Sculpture preparation aborted','AbortError');
  const materialOwner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']);let geometryOwner,disposed=false;
  try{
    geometryOwner=createXieqiquCopperSwallowShortNeckStudy({materials:materialOwner.materials,signal,underwingCoverts});
    const diagnostics={...geometryOwner.diagnostics,resourceOwnership:{...geometryOwner.diagnostics.resourceOwnership,materials:materialOwner.diagnostics.materials,textures:materialOwner.diagnostics.textures,ownership:'review owns complete geometry and separate original-source material pixels',moduleGlobalCache:false,disposalIsIdempotent:true}};
    return {group:geometryOwner.group,diagnostics,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometryOwner.dispose();materialOwner.dispose();}};
  }catch(error){geometryOwner?.dispose();materialOwner.dispose();throw error;}
}

/** Separate review entry; the original short-neck default remains replayable. */
export const createXieqiquCopperSwallowUnderwingStudy=options=>createXieqiquCopperSwallowShortNeckStudy({...options,underwingCoverts:true});
export const createXieqiquCopperSwallowUnderwingReviewStudy=options=>createXieqiquCopperSwallowShortNeckReviewStudy({...options,underwingCoverts:true});
