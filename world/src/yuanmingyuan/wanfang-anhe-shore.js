import {museumSite} from './museum-sites.js';
import {prepareWanfangAnheGroundSurface} from './wanfang-anhe-ground-surface.js';
import {createWesternGardenScenePlanting} from './western-garden-scene.js';
import {createJiuzhouShoreGroveSources} from './jiuzhou-shore-grove-sources.js';
import {createJiuzhouShoreGroveRegion} from './jiuzhou-shore-grove-region.js';
import {createWanfangAnheShoreLayout,wanfangShoreId,wanfangShoreRegionIds} from './wanfang-anhe-shore-layout.js';

/** Borrow complete reviewed sources using the existing scene transaction.
 * This owner must retire before its current architecture or terrain owner. */
export async function createWanfangAnheShore({
 root,terrain,architecture,site=museumSite('wanfang-anhe'),signal,onProgress,regionIds=wanfangShoreRegionIds,
 createSources=createJiuzhouShoreGroveSources,createRegion=createJiuzhouShoreGroveRegion,createColliders,createGround=prepareWanfangAnheGroundSurface,
}={}){
 if(!Array.isArray(regionIds)||regionIds.length!==wanfangShoreRegionIds.length||new Set(regionIds).size!==regionIds.length||regionIds.some(id=>!wanfangShoreRegionIds.includes(id)))
  throw new Error('Wanfang shore is one complete four-region composition.');
 const plantingLayout=createWanfangAnheShoreLayout({site});
 const owner=await createWesternGardenScenePlanting({root,terrain,architecture,plantingLayout,regionIds:[...regionIds],signal,onProgress,
  createSources,createRegion,...(createColliders?{createColliders}:{})});
 let ground;
 try{
  ground=await createGround({terrain,site,plantingLayout,signal});
  signal?.throwIfAborted();owner.assertCurrent();ground.assertCurrent();
 }catch(error){
  const errors=[error];
  try{ground?.dispose();}catch(cleanup){errors.push(cleanup);}
  try{owner.dispose();}catch(cleanup){errors.push(cleanup);}
  try{await owner.whenIdle();}catch(cleanup){errors.push(cleanup);}
  if(errors.length>1)throw new AggregateError(errors,'Wanfang garden preparation and cleanup failed',{cause:error});
  throw error;
 }
 const release=owner.dispose,assertOriginal=owner.assertCurrent;let released=false;
 owner.dispose=()=>{
  if(released)return;released=true;const errors=[];
  try{ground.dispose();}catch(error){errors.push(error);}
  try{release();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Wanfang garden release failed');
 };
 owner.assertCurrent=()=>{assertOriginal();ground.assertCurrent();return true;};
 owner.group.name=wanfangShoreId;
 Object.assign(owner.group.userData,{body:'contemporary-wanfang-shore-grove',originalUnitScale:true,sourceGeometryChanged:false});
 const snapshot=owner.snapshot,update=owner.update;
 owner.snapshot=options=>({...snapshot(options),id:wanfangShoreId,siteId:plantingLayout.siteId,layoutId:plantingLayout.id,
  counts:owner.regions.flatMap(r=>r.plan.placements).reduce((out,p)=>(out[p.species]=(out[p.species]??0)+1,out),{}),
  wholeGardenArtReviewed:false,ground:ground.diagnostics,sourceFactoriesPolicy:'one shared full R5 willow and three full R4 prototypes per low-plant species; original buffers and materials'});
 owner.update=time=>{if(owner.disposed)return false;owner.assertCurrent();return update(time);};
 return owner;
}
