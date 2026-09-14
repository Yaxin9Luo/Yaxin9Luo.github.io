import {gardenLayout,getGardenGroup} from './garden-layout.js';
import {createMuseumLandscape} from './museum-landscape.js';
import {jiuzhouStudyShoreline} from './jiuzhou-courtyards.js';

export const jiuzhouCompositionId='jiuzhou-continuous-assembly-r1';
export const jiuzhouSiteId='jiuzhou-qingyan';
export const jiuzhouIslandId='jiuzhou-qingyan-island';
export const jiuzhouEntryIds=Object.freeze(['jiuzhou-qingyan-core','jiuzhou-qingyan-hall','jiuzhou-shendetang','jiuzhou-tiandi-courts','jiuzhou-tongdao-theatre','jiuzhou-ruyi-bridge']);
const removedBridgeIds=['qingyan-east-bridge','qingyan-west-bridge'];
const padId='jiuzhou-source-island-substrate';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freezeView=view=>Object.freeze(Object.fromEntries(Object.entries(view).map(([key,value])=>[key,Array.isArray(value)?Object.freeze(value):value])));

// Published placement notes distinguish flight viewpoints from ground entries.
// All four views use one original root; they are not separate source owners.
export const jiuzhouCompositionViews=Object.freeze(Object.fromEntries([
  ['central','jiuzhou-qingyan-core',[15,14,48],[0,4,-11.2],[0,.0545,10.3],[4,0,10.3]],
  ['western','jiuzhou-shendetang',[-70,14,17],[-51,4,-15],[-51.5,.0545,-8.5],[-51.5,0,-8.5]],
  ['eastern','jiuzhou-tiandi-courts',[70,13,31],[57.6,4,-11],[57.6,.0545,7.3],[59.8,0,7.3]],
  ['waterfront','jiuzhou-ruyi-bridge',[35,26,75],[12,2,-4.8],[0,.0545,42],[6,0,42]],
].map(([id,entryId,arrival,focus,entry,guide])=>[id,freezeView({id,siteId:jiuzhouSiteId,entryId,arrival,focus,entry,guide})])));

export function createJiuzhouCompositionSite(){
  const record=getGardenGroup(jiuzhouSiteId);
  if(!record||!same(record.position,[-550,4,169.4])||record.placement.rotationY!==0||record.placement.scale!==1)throw new Error('Jiuzhou requires the original shared anchor and unit scale.');
  const view=jiuzhouCompositionViews.central;
  return Object.freeze({id:jiuzhouSiteId,assetId:'jiuzhou',entryId:view.entryId,position:Object.freeze([...record.position]),rotationY:0,scale:1,region:record.regionId,evidence:'author-proportional',
    arrival:view.arrival,focus:view.focus,guide:view.guide,coordinatesSurveyed:false});
}

export function createJiuzhouLandscapePlan({source,site=createJiuzhouCompositionSite(),layout=gardenLayout,landscapePlan}={}){
  const diagnostics=source?.diagnostics,sections=diagnostics?.selectedSections;
  if(diagnostics?.assetId!=='jiuzhou'||!Array.isArray(sections)||sections.length!==4||new Set(sections).size!==4||!Object.keys(jiuzhouCompositionViews).every(id=>sections.includes(id)))throw new Error('Jiuzhou requires the complete four-section source owner.');
  if(!same(diagnostics.shoreline?.localOutline,jiuzhouStudyShoreline)||!same(diagnostics.placement?.globalAnchor,site.position)||diagnostics.placement?.rootTranslationApplied!==false||diagnostics.placement?.scale!==1)throw new Error('Jiuzhou source shoreline or shared placement changed.');
  if(site.id!==jiuzhouSiteId||!same(site.position,[-550,4,169.4])||site.rotationY!==0||site.scale!==1)throw new Error('Jiuzhou views must retain one original world placement.');
  const base=landscapePlan??createMuseumLandscape({layout,sites:[site],readyAssetIds:['jiuzhou']});
  const input=base?.layout;
  if(!input||typeof input.id!=='string'||!Array.isArray(input.islands)||!Array.isArray(base.pads)||!Array.isArray(base.courts)||!Array.isArray(base.paths)||!Array.isArray(base.replacements))throw new Error('Jiuzhou requires one complete landscape plan.');
  if(input.jiuzhouComposition||base.pads.some(p=>p.id===padId)||input.islands.some(i=>i.id===jiuzhouIslandId&&i.alignment?.assetId==='jiuzhou'))throw new Error('Jiuzhou island replacement is already applied.');
  if(input.islands.filter(i=>i.id===jiuzhouIslandId).length!==1)throw new Error('Jiuzhou island must occur exactly once.');
  const lake=input.waterBodies?.filter(w=>w.id==='houhu');
  if(input.exhibition?.groundY!==4||lake?.length!==1||lake[0].surfaceY!==2)throw new Error('Jiuzhou requires the existing ground 4 / Houhu water 2 datums.');
  for(const id of removedBridgeIds)if((input.bridges??[]).filter(b=>b.id===id).length>1)throw new Error('Duplicate coarse Jiuzhou bridge.');
  const polygon=jiuzhouStudyShoreline.map(([x,z])=>[x+site.position[0],z+site.position[2]]);
  const limit='Existing source aligned for contemporary exhibition. Shoreline is proportional, not surveyed; Ruyi south landing does not reach external mainland.';
  const island={...input.islands.find(i=>i.id===jiuzhouIslandId),polygon,anchor:[...site.position],heightY:3.97,trace:undefined,sourceIds:[],
    evidence:'existing-source-proportional-shoreline',sourceEvidence:diagnostics.shoreline.evidence,
    alignment:{kind:'existing-source-jiuzhou-island',assetId:'jiuzhou',coordinatesSurveyed:false},limit};
  const removed=(input.bridges??[]).filter(b=>removedBridgeIds.includes(b.id)).map(b=>b.id);
  return {...base,layout:{...input,id:input.id+':'+jiuzhouCompositionId,islands:input.islands.map(i=>i.id===jiuzhouIslandId?island:i),
    bridges:(input.bridges??[]).filter(b=>!removedBridgeIds.includes(b.id)),jiuzhouComposition:jiuzhouCompositionId},
    pads:[...base.pads,{id:padId,polygon:polygon.map(p=>[...p]),heightY:3.97,blend:.25,alignment:island.alignment,limit}],
    jiuzhou:{islandId:jiuzhouIslandId,worldOutline:polygon.map(p=>[...p]),removedCoarseBridgeIds:removed,sourceOwners:1,sourceSections:[...sections],
      entryIds:[...jiuzhouEntryIds],externalMainlandConnected:false,externalGap:{localX:88.2,platformSouthZ:43.15,coarseHouhuSouthZ:55.61568627450981,metres:12.46568627450981,evidence:'current proportional plan calculation, not a survey'},limit}};
}
