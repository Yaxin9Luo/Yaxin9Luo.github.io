import {createJiuzhouShoreGroveSources} from './jiuzhou-shore-grove-sources.js';
import {createJiuzhouShoreGroveRegion} from './jiuzhou-shore-grove-region.js';
import {createWesternGardenPlantingRegion} from './western-garden-planting.js';
import {createCourtBandsR3Sources} from './court-planting-sources-r3.js';
import {loadCourtLowBroadleafR3Source} from './court-low-broadleaf-r3-source.js';
import {courtBroadleafR3Contract} from './court-broadleaf-r3-profile.js';

// Keep the existing two queued source owners: shore variants and the already
// reviewed real-leaf R3 bridge. Three spatial shrub groups share one source
// region, one broadleaf texture lease and one full-geometry profile.
export function createFrontCourtPlantingSources({
 plantingLayout,createShore=createJiuzhouShoreGroveSources,createCourt=createCourtBandsR3Sources,
 loadBroadleaf=loadCourtLowBroadleafR3Source,broadleafContract=courtBroadleafR3Contract,
}={}){
 const middle=plantingLayout?.regions.filter(r=>r.placements.some(p=>p.species==='low-broadleaf'));
 if(middle?.length!==1||middle[0].placements.some(p=>!['low-broadleaf','flower-shrub'].includes(p.species)))throw new Error('One explicit real-leaf front-court source region required.');
 const shoreRegions=plantingLayout.regions.filter(r=>r!==middle[0]);
 const shore=createShore({plantingLayout:{...plantingLayout,regions:shoreRegions}});
 let court,disposed=false;const cleanupErrors=[];
 try{court=createCourt({plantingLayout:{regions:middle},loadBroadleaf,broadleafContract});}
 catch(error){try{shore.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Front source construction and cleanup failed');}throw error;}
 const shoreIds=new Set(shoreRegions.map(r=>r.id));
 const owner={
  get disposed(){return disposed;},
  prepareRegion(id,request){
   if(disposed)throw new DOMException('Front source owner disposed','AbortError');
   if(id===middle[0].id)return court.prepareRegion(id,request);
   if(shoreIds.has(id))return shore.prepareRegion(id,request);
   throw new Error('Unknown front-court source region: '+id);
  },
  update(time){if(disposed)return false;shore.update(time);court.update(time);return true;},
  snapshot(){return {id:'front-court-sources-r5',disposed,shore:shore.snapshot(),middle:court.snapshot(),cleanupErrors:cleanupErrors.map(e=>String(e.message??e))};},
  async whenIdle(){
   const results=await Promise.allSettled([Promise.resolve().then(()=>shore.whenIdle()),Promise.resolve().then(()=>court.whenIdle())]);
   const errors=[...cleanupErrors,...results.filter(r=>r.status==='rejected').map(r=>r.reason)];
   if(errors.length)throw new AggregateError(errors,'Front source asynchronous cleanup failed');
  },
  dispose(){
   if(disposed)return;disposed=true;
   for(const source of [court,shore])try{source.dispose();}catch(error){cleanupErrors.push(error);}
   if(cleanupErrors.length)throw new AggregateError([...cleanupErrors],'Front source cleanup failed');
  },
 };
 return owner;
}
export function createFrontCourtPlantingRegion(options){
 const region=options.plantingLayout.regions.find(r=>r.id===options.regionId);
 if(!region?.placements.length)throw new Error('Front-court planting region is missing.');
 return region.placements.some(p=>p.species==='low-broadleaf')?
  createWesternGardenPlantingRegion(options):createJiuzhouShoreGroveRegion(options);
}
