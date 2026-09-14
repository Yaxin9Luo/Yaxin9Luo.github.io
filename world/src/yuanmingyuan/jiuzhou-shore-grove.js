import {createJiuzhouShoreGroveSources} from './jiuzhou-shore-grove-sources.js';
import {createJiuzhouShoreGroveRegion} from './jiuzhou-shore-grove-region.js';
import {createWesternGardenScenePlanting} from './western-garden-scene.js';
import {createJiuzhouShoreGroveLayout,jiuzhouShoreGroveId,jiuzhouShoreGroveRegionIds} from './jiuzhou-shore-grove-layout.js';

/** The existing scene transaction owns one original willow and one R4 variant set per low-plant species.
 * Caller supplies the current rendered terrain and retained architecture.
 * Dispose this owner before either support owner; await whenIdle on shutdown. */
export async function createJiuzhouShoreGrove({
 root,terrain,architecture,layout,regionIds=jiuzhouShoreGroveRegionIds,signal,onProgress,
 createSources=createJiuzhouShoreGroveSources,createRegion=createJiuzhouShoreGroveRegion,createColliders,
}={}){
 if(!Array.isArray(regionIds)||!regionIds.length||new Set(regionIds).size!==regionIds.length||regionIds.some(id=>!jiuzhouShoreGroveRegionIds.includes(id)))throw new Error('Explicit Jiuzhou shore region IDs required.');
 const plantingLayout=createJiuzhouShoreGroveLayout({layout});
 const owner=await createWesternGardenScenePlanting({root,terrain,architecture,plantingLayout,regionIds:[...regionIds],signal,onProgress,
  ...(createSources?{createSources}:{}),...(createRegion?{createRegion}:{}),...(createColliders?{createColliders}:{})});
 owner.group.name=jiuzhouShoreGroveId;
 Object.assign(owner.group.userData,{body:'contemporary-jiuzhou-shore-grove',sourceGeometryChanged:true,originalWillowGeometryChanged:false,originalUnitScale:true});
 const snapshot=owner.snapshot,update=owner.update;
 owner.snapshot=options=>({...snapshot(options),id:jiuzhouShoreGroveId,layoutId:plantingLayout.id,wholeGardenArtReviewed:false,
  counts:owner.regions.flatMap(r=>r.plan.placements).reduce((out,p)=>(out[p.species]=(out[p.species]??0)+1,out),{}),
  requiredSources:['willow','sedge','fern'],sourceFactoriesPolicy:'one original willow plus three shared full R4 prototypes per low-plant species; exact borrowed buffers/materials'});
 owner.update=time=>{if(owner.disposed)return false;owner.assertCurrent();return update(time);};
 return owner;
}
