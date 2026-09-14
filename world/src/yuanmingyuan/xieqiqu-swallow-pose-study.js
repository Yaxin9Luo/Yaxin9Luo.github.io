import {copperSwallowComponentSpecs,copperSwallowMouth} from './xieqiqu-copper-swallow.js';
import {applySwallowPose,createBentSwallowLegGeometry,swallowPoseStatus} from './xieqiqu-swallow-pose.js';
import {createBorrowedMaterialSculpture} from './xieqiqu-sculpture-skin.js';
import {createXieqiquSculptureMaterialOwner} from './xieqiqu-study.js';

import {copperSwallowPoseStudyId} from './xieqiqu-swallow-pose-views.js';
export {copperSwallowPoseStudyId,copperSwallowPoseStudyViews} from './xieqiqu-swallow-pose-views.js';

function partRole(id){
  if(id==='continuous-body-and-beak')return 'body';
  if(id.startsWith('wing-'))return 'wing';
  if(/^(primary|secondary|covert)-/.test(id))return 'feather';
  if(id.startsWith('tail-'))return 'tail';
  if(id.startsWith('eye-'))return 'eye';
  if(id.startsWith('leg-'))return 'leg';
  if(id.startsWith('toe-'))return 'unchanged-foot';
  throw new Error('Unknown copper bird component: '+id);
}

export const copperSwallowPoseComponentSpecs=Object.freeze(copperSwallowComponentSpecs.map(source=>{
  const posePart=partRole(source.id),primaryIndex=source.id.startsWith('primary-')?Number(source.id.split('-').at(-1)):null;
  return Object.freeze({id:source.id,role:source.role,posePart,create(){
    if(posePart==='leg')return createBentSwallowLegGeometry(source.id==='leg--1'?-1:1);
    let geometry;
    try{geometry=source.create();return posePart==='unchanged-foot'?geometry:applySwallowPose(geometry,posePart,{primaryIndex});}
    catch(error){geometry?.dispose();throw error;}
  }});
}));

/** Geometry-only owner: the caller lends the original source copper materials. */
export function createXieqiquCopperSwallowPoseStudy({materials,signal}={}){
  const owner=createBorrowedMaterialSculpture({id:copperSwallowPoseStudyId,materials,roles:['copper','copperRecess'],mouthAnchor:copperSwallowMouth,signal,parts:copperSwallowPoseComponentSpecs});
  owner.diagnostics.pose={status:swallowPoseStatus,directionReviewed:true,candidateFactory:true,worldIntegrated:false,fullGeometryReviewed:false,nativeApproved:false,evidence:'institutional bird-type references; authored pose; historical species unresolved'};
  return owner;
}

/** Standalone Studio entry. Each call owns its own original-source PBR pixels
 * and newly-created complete sculpture. There is no reduced preview fallback. */
export function createXieqiquCopperSwallowPoseReviewStudy({signal}={}){
  if(signal?.aborted)throw new DOMException('Sculpture preparation aborted','AbortError');
  const materialOwner=createXieqiquSculptureMaterialOwner(['copper','copperRecess']);let geometryOwner,disposed=false;
  try{
    geometryOwner=createXieqiquCopperSwallowPoseStudy({materials:materialOwner.materials,signal});
    const diagnostics={...geometryOwner.diagnostics,resourceOwnership:{...geometryOwner.diagnostics.resourceOwnership,materials:materialOwner.diagnostics.materials,textures:materialOwner.diagnostics.textures,ownership:'review owns complete geometry and a separate original-source material owner',moduleGlobalCache:false,disposalIsIdempotent:true}};
    return {group:geometryOwner.group,diagnostics,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometryOwner.dispose();materialOwner.dispose();}};
  }catch(error){geometryOwner?.dispose();materialOwner.dispose();throw error;}
}
