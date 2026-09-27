import {createFrontCourtComposition} from './front-court-composition.js';
import {frontCourtLayout,frontCourtMuseumViews as worldViews} from './front-court-layout.js';
import {sitePoint} from './museum-sites.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const definitions={
 dag:{entryId:'dagongmen-entrance',defaultView:'gate',guide:[-8,.029,12]},
 erg:{entryId:'ergongmen-gate',defaultView:'erg',guide:[-10,.029,13]},
 hall:{entryId:'zhengda-guangming-hall',defaultView:'hall',guide:[-10,.029,30]},
};
export const frontCourtMuseumSites=freeze(frontCourtLayout.assets.map(site=>({...site,...definitions[site.key],region:'yuanmingyuan',evidence:'contemporary-exhibition-layout'})));
const labels={gate:{zh:'大宫门与南院',en:'Dagongmen and the south court'},screen:{zh:'御路与大影壁',en:'The approach and screen wall'},erg:{zh:'二宫门前厅',en:'Ergongmen: the open front hall'},hall:{zh:'正大光明与月台',en:'Zhengda Guangming and its terrace'}};
const local=(site,p)=>p.map((v,i)=>v-site.position[i]);
export const frontCourtMuseumViews=freeze(Object.fromEntries(Object.entries(worldViews).map(([id,view])=>{
 const site=frontCourtMuseumSites.find(site=>site.id===view.siteId);
 return [id,{...view,title:labels[id],entry:local(site,view.entry),arrival:local(site,view.arrival),focus:id==='screen'?[0,2,205]:local(site,view.focus),viewYaw:id==='screen'?Math.PI:0,
  guide:id==='screen'?[-9,.029,199]:site.guide,entryId:id==='screen'?'dagongmen-screen':site.entryId}];
})));
export function isFrontCourtRoute(query){return ['front-court','dagongmen'].includes(query.get('composition'));}
export function frontCourtSiteId(id){return ({'dagongmen-entrance':'front-court-dag','ergongmen-gate':'front-court-erg','zhengda-guangming-hall':'front-court-hall'})[id]??id;}
export function frontCourtRequestedSite(query){
 const id=frontCourtSiteId(query.get('site')),site=frontCourtMuseumSites.find(s=>s.id===id);
 const requested=query.get('view'),view=Object.hasOwn(frontCourtMuseumViews,requested)?frontCourtMuseumViews[requested]:null;
 return site?{siteId:site.id,viewId:view?.siteId===site.id?view.id:site.defaultView}:{siteId:view?.siteId??frontCourtMuseumSites[0].id,viewId:view?.id??'gate'};
}
export function createFrontCourtMuseum(options={}){
 const owner=createFrontCourtComposition(options);
 // Core views use world coordinates; museum visit()/sitePoint() consume local
 // coordinates. This facade changes captions and coordinates, never ownership.
 return {
  group:owner.group,sites:frontCourtMuseumSites,views:frontCourtMuseumViews,
  prepare:owner.prepare,bindWater:owner.bindScene,bindScene:owner.bindScene,
  get:owner.get,borrow:owner.borrow,release:owner.release,update:owner.update,
  dispose:owner.dispose,whenIdle:owner.whenIdle,navigation:owner.navigation,
  getView(id){const view=frontCourtMuseumViews[id];if(!view)throw new Error('Unknown front-court museum view '+id);return view;},
  get plan(){return owner.plan;},get support(){return owner.support;},get paving(){return owner.paving;},
  get disposed(){return owner.disposed;},get cleanupError(){return owner.cleanupError;},
  get snapshot(){return {...owner.snapshot,museumViews:Object.keys(frontCourtMuseumViews),hallCenserRevision:'r2',documentedOriginalCoordinates:false};},
 };
}
export function frontCourtViewLanding(composition,navigation,viewId){
 const view=composition.getView(viewId),site=composition.sites.find(site=>site.id===view.siteId),entry=sitePoint(site,view.entry);
 // Always use the actual scene navigation with current NPC colliders.
 const support=navigation.landing({...entry,y:entry.y+2.4});
 return support.valid?{valid:true,viewId,siteId:view.siteId,position:{x:entry.x,y:support.y,z:entry.z},support}:{valid:false,viewId,reason:support.reason,support};
}
export function frontCourtMapGeometry(){
 return {buildings:frontCourtLayout.assets.map(a=>({id:a.id,polygon:[[a.worldBounds.min[0],a.worldBounds.min[2]],[a.worldBounds.max[0],a.worldBounds.min[2]],[a.worldBounds.max[0],a.worldBounds.max[2]],[a.worldBounds.min[0],a.worldBounds.max[2]]]})),
  courts:frontCourtLayout.visibleCourts.map(c=>c.pavingPolygon),lanes:frontCourtLayout.accessLanes.map(l=>l.polygon),
  visitorRoute:frontCourtLayout.visitorRoutes.throughGateAndCourts};
}
