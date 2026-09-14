import {createXieqiquSculptureMaterialOwner} from './xieqiqu-study.js';
import {createXieqiquStoneFishStudy,stoneFishStudyViews} from './xieqiqu-stone-fish.js';
import {createXieqiquCopperSwallowStudy,copperSwallowStudyViews} from './xieqiqu-copper-swallow.js';

export {stoneFishStudyViews,copperSwallowStudyViews};

function createReview(create,roles,{signal}={}){
  if(signal?.aborted)throw new DOMException('Sculpture preparation aborted','AbortError');
  const materialOwner=createXieqiquSculptureMaterialOwner(roles);let geometryOwner,disposed=false;
  try{
    geometryOwner=create({materials:materialOwner.materials,signal});
    const diagnostics={...geometryOwner.diagnostics,resourceOwnership:{...geometryOwner.diagnostics.resourceOwnership,materials:materialOwner.diagnostics.materials,textures:materialOwner.diagnostics.textures,disposeBorrowed:false,ownership:'review owns geometry and its separate original-source material owner',moduleGlobalCache:false,disposalIsIdempotent:true}};
    return {group:geometryOwner.group,diagnostics,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometryOwner.dispose();materialOwner.dispose();}};
  }catch(error){geometryOwner?.dispose();materialOwner.dispose();throw error;}
}

export function createXieqiquStoneFishReviewStudy(options){return createReview(createXieqiquStoneFishStudy,['carving','oldStone'],options);}
export function createXieqiquCopperSwallowReviewStudy(options){return createReview(createXieqiquCopperSwallowStudy,['copper','copperRecess'],options);}
