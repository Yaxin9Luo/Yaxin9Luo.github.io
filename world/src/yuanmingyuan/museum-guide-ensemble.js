// Explicit single-owner Jiuzhou and two/three-site Western routes only.
// Automatic caption focus must not retire an
// already generated guide. Explicit travel resets; leaving releases all owners.
let serial=0;
export function createMuseumGuideEnsemble({siteIds,create,language='en'}={}){
  const routes=['jiuzhou-qingyan','xianfaqiao,xieqiqu','xianfaqiao,xieqiqu,yangquelong'];
  if(!Array.isArray(siteIds)||!siteIds.length||siteIds.some(id=>typeof id!=='string'||!id)||new Set(siteIds).size!==siteIds.length||!routes.includes([...siteIds].sort().join(','))||typeof create!=='function')throw new TypeError('A guide ensemble requires an explicit Jiuzhou or Western composition site set.');
  const allowed=new Set(siteIds),records=new Map(),actors=new Map(),owner=`museum-guide-ensemble:${++serial}`;
  let disposed=false,paused=false,lang=language==='zh'?'zh':'en';
  const failures=[];
  function release(entries){
    const errors=[];
    // Actor callbacks may still refer to support. Release every actor pool
    // before closing any of the source-world query owners.
    for(const record of entries)try{record.guides?.dispose();}catch(error){errors.push(error);}
    for(const record of entries)try{record.world.dispose();}catch(error){errors.push(error);}
    if(errors.length){failures.push(...errors.map(error=>String(error.message||error)));throw new AggregateError(errors,'Guide ensemble release failed');}
  }
  function clear(){const entries=[...records.values()];records.clear();actors.clear();release(entries);}
  const systems=()=>[...records.values()].flatMap(record=>record.guides?[record.guides]:[]);
  const api={
    isMuseumGuideEnsemble:true,
    get disposed(){return disposed;},
    ensure(site){
      if(disposed)throw new Error('Guide ensemble is disposed.');
      if(!allowed.has(site?.id))throw new Error('Unknown guide composition site.');
      const retained=records.get(site.id);if(retained)return retained;
      const record=create(site);
      try{
        if(!record?.world||typeof record.world.dispose!=='function'||(record.guides&&typeof record.guides.snapshot!=='function'))throw new TypeError('A guide region must own its guides and support world.');
        const members=record.guides?.snapshot().actors??[];
        if(members.length>3)throw new Error('A retained composition site may create at most three guides.');
        const ids=new Set();
        for(const actor of members){if(typeof actor.id!=='string'||actors.has(actor.id)||ids.has(actor.id))throw new Error('Guide identities must be unique across retained sites.');ids.add(actor.id);}
        record.guides?.setLanguage(lang);record.guides?.setPaused(paused);
        records.set(site.id,record);for(const id of ids)actors.set(id,record.guides);
        return record;
      }catch(error){
        try{if(record?.world)release([record]);}catch(cleanup){throw new AggregateError([error,cleanup],'Guide region initialization and release failed',{cause:error});}
        throw error;
      }
    },
    reset(site){if(disposed)throw new Error('Guide ensemble is disposed.');if(!allowed.has(site?.id))throw new Error('Unknown guide composition site.');clear();return api.ensure(site);},
    get colliders(){return disposed?[]:systems().flatMap(system=>system.colliders);},
    get pickMeshes(){return disposed?[]:systems().flatMap(system=>system.pickMeshes);},
    idForObject(object){if(disposed)return null;for(const system of systems()){const id=system.idForObject(object);if(id)return id;}return null;},
    nearest(position){
      if(disposed)return null;let best=null,distance=Infinity;
      for(const system of systems()){
        // Each real controller enforces height, cooldown, validity, activity,
        // and busy-state constraints before its candidate enters this comparison.
        const candidate=system.nearest(position);if(!candidate)continue;
        const actor=system.snapshot().actors.find(actor=>actor.id===candidate.id);if(!actor)continue;
        const d=Math.hypot(position.x-actor.position.x,position.z-actor.position.z);
        if(d<distance){distance=d;best=candidate;}
      }
      return best;
    },
    interact(id,options){if(disposed)return false;return actors.get(id)?.interact(id,options)??false;},
    update(dt,context={}){if(disposed)return;if(context.language!==undefined)lang=context.language==='zh'?'zh':'en';if(context.paused!==undefined)paused=Boolean(context.paused);for(const system of systems())system.update(dt,context);},
    setPaused(value){if(disposed)return;paused=Boolean(value);for(const system of systems())system.setPaused(paused);},
    setLanguage(value){if(disposed)return;lang=value==='zh'?'zh':'en';for(const system of systems())system.setLanguage(lang);},
    snapshot(){
      const children=[...records].map(([siteId,record])=>({siteId,...(record.guides?.snapshot()??{actors:[],activeTime:0,soundEvents:0})}));
      return {owner,disposed,paused,language:lang,activeTime:Math.max(0,...children.map(child=>child.activeTime)),
        soundEvents:children.reduce((sum,child)=>sum+child.soundEvents,0),actors:children.flatMap(child=>child.actors),
        retainedSites:children.map(({siteId,owner,activeTime})=>({siteId,owner,activeTime})),cleanupErrors:[...failures]};
    },
    dispose(){if(disposed)return;disposed=true;clear();},
  };
  // The scene's existing disposal order calls guides before guideSurface. This
  // query facade delegates to the same idempotent owner, never double-releases.
  api.worlds={
    snapshot:()=>({owner,disposed,sites:[...records].map(([siteId,record])=>({siteId,...record.world.snapshot()}))}),
    get placementReview(){const sites=[...records].map(([siteId,record])=>({siteId,...record.world.placementReview}));return {sites,accepted:sites.reduce((sum,site)=>sum+(site.accepted??0),0)};},
    dispose:()=>api.dispose(),
  };
  return api;
}
