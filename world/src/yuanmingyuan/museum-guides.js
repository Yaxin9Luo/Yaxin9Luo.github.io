import {createCompanionSystem} from '../companion-system.js';
import {guideSign,museumEntry} from './museum-content.js';

// The existing ground support, swept action clearance and gait controller also
// govern museum guides. A sign opens its exhibit only after the raising pose.
export function createMuseumGuides({pool,placements,onInspect=()=>{},...world}){
  if(!pool)throw new Error('The guide model must be ready before placing guides.');
  const sites=placements.map(site=>{
    const entry=museumEntry(site.entryId);if(!entry)throw new Error(`Unknown guide exhibit: ${site.entryId}`);
    return {...site,kind:'elizabeth',exhibitId:entry.id,sign:guideSign(entry.id),label:entry.title,actionLabel:{zh:'阅读展签',en:'Read exhibit'}};
  });
  const system=createCompanionSystem({...world,placements:sites,onInspect,createActor:(kind,{lang},site)=>pool.create({entryId:site.exhibitId,id:site.id,lang})});
  const nearest=system.nearest.bind(system),entries=new Map(sites.map(site=>[site.id,site.exhibitId]));
  system.nearest=position=>{const guide=nearest(position);return guide?{...guide,entryId:entries.get(guide.id)}:null;};
  return system;
}
