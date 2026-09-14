import {createWesternGardenPlantingSourceLoader} from './western-garden-planting-sources.js';
import {shoreUnderstoryVariants} from './jiuzhou-shore-grove-understory-variants.js';
const loadUnderstory=async()=>({createGardenUnderstoryStudy:(await import('./jiuzhou-shore-grove-understory.js')).createJiuzhouShoreUnderstoryStudy});
/** Delegate queue, rollback, late import cancellation, update and source release
 * to the existing owner. New low-plant review status stays explicitly pending. */
export function createJiuzhouShoreGroveSources(options={}){
 const base=createWesternGardenPlantingSourceLoader({loadUnderstory,...options});
 return {
  get disposed(){return base.disposed;},
  async prepareRegion(regionId,request){
   const prepared=await base.prepareRegion(regionId,request),sources={...prepared.sources};
   for(const species of ['sedge','fern'])if(sources[species]){
    const original=sources[species],variants={};
    for(const id of shoreUnderstoryVariants[species]){
     const matches=original.part.children.filter(p=>p.userData.variant===id),part=matches[0];
     if(original.part.children.length!==3||matches.length!==1||part?.userData.id!==species||part?.userData.sourceId!=='jiuzhou-shore-understory-r4'||!part?.isGroup||part.position.lengthSq()||part.quaternion.angleTo(original.part.quaternion)>0||part.scale.toArray().some(v=>v!==1))throw new Error('Missing unplaced shore R4 prototype '+id);
     variants[id]=Object.freeze({part,owner:original.owner,review:Object.freeze({id:'jiuzhou-shore-understory-r4',variant:id,nativeArtReviewed:false,historicallySurveyed:false,sourceGeometryChanged:true})});
    }
    sources[species]=Object.freeze({variants:Object.freeze(variants)});
   }
   return {...prepared,sources:Object.freeze(sources)};
  },
  update:time=>base.update(time),
  snapshot(){
   const s=base.snapshot();
   return {...s,id:'jiuzhou-shore-grove-sources-r4',sources:s.sources.map(source=>shoreUnderstoryVariants[source.species]?{...source,sourceReview:{id:'jiuzhou-shore-understory-r4',nativeArtReviewed:false,sourceGeometryChanged:true},variants:[...shoreUnderstoryVariants[source.species]]}:source)};
  },
  whenIdle:()=>base.whenIdle(),dispose:()=>base.dispose(),
 };
}
