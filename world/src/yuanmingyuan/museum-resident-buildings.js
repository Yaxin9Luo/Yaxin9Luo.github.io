import {Box3} from 'three';
import {createMuseumDistanceLayer} from './museum-distance-layer.js';

// Retain reviewed full owners, optionally paired with an approved distance
// archive. Small full-only ensembles stay visible between visits; a primary
// site's actual mounted owner takes over without drawing the ensemble twice.
export function createMuseumResidentBuildings({root,descriptors,siteController,loadFull,mountFull,createDistance=createMuseumDistanceLayer,signal,...options}){
  if(!root?.isObject3D||!Array.isArray(descriptors)||typeof loadFull!=='function')throw new Error('Resident buildings require a root, descriptors and a full-source loader.');
  if(mountFull!==undefined&&typeof mountFull!=='function')throw new Error('mountFull must be a lifecycle function');
  const ids=new Set();for(const descriptor of descriptors){
    if(typeof descriptor?.id!=='string'||!descriptor.id.trim()||ids.has(descriptor.id))throw new Error('Resident building IDs must be nonempty strings and unique.');ids.add(descriptor.id);
    if(descriptor.representation!==undefined&&descriptor.representation!=='full')throw new Error('Unknown resident building representation.');
    if(descriptor.representation==='full'){
      const {id,assetId,site,source,approvedFullSHA256}=descriptor;
      if(typeof assetId!=='string'||!assetId.trim()||site?.id!==id||site.assetId!==undefined&&site.assetId!==assetId||!Array.isArray(site.position)||site.position.length!==3||![...site.position].every(Number.isFinite)||!Number.isFinite(site.rotationY)||!Number.isFinite(site.scale)||site.scale<=0)throw new Error(`Invalid full resident placement: ${id}`);
      if(typeof approvedFullSHA256!=='string'||!/^[a-f0-9]{64}$/.test(approvedFullSHA256)||approvedFullSHA256!==source?.approvedManifestSHA256||typeof source?.manifestURL!=='string'||!source.manifestURL.trim())throw new Error('Full resident requires an externally approved source manifest.');
      const base=new URL(options.baseURL??globalThis.location?.href),url=new URL(source.manifestURL,base);
      if(!['http:','https:'].includes(base.protocol)||!['http:','https:'].includes(url.protocol)||url.origin!==base.origin)throw new Error('Full resident source must share the HTTP exhibition origin.');
    }
  }
  const lifetime=new AbortController(),records=descriptors.map(descriptor=>({descriptor,owner:null,bounds:null,error:null,ready:false,mounting:false,unmount:null,borrowers:0,view:null}));
  const byId=new Map(records.map(record=>[record.descriptor.id,record])),ownerRecords=new WeakMap();
  let disposed=false,loading=null,disposal=null;const disposalErrors=[];
  const layer=createDistance({...options,root,descriptors:descriptors.filter(descriptor=>descriptor.representation!=='full'),siteController,signal:lifetime.signal});
  const primary=(id,hiddenOwner=null)=>{
    const state=siteController?.snapshot,resource=siteController?.resource;
    if(state?.status!=='ready'||state.siteId!==id)return false;
    let node=resource?.group;while(node&&node!==root){if(!node.visible&&!(resource===hiddenOwner&&node===resource.group))return false;node=node.parent;}return node===root&&root.visible;
  };
  // A previously distant source may still have visible=false when borrowed.
  // Ignore only that same owner's own flag, never a hidden ancestor or a
  // genuinely independent primary, when restoring the selected full source.
  const sharedPrimary=record=>siteController?.resource===record.owner&&primary(record.descriptor.id,record.owner);
  const register=()=>layer.setFullSites(records.filter(r=>r.ready&&r.owner&&r.descriptor.representation!=='full').map(r=>({id:r.descriptor.id,group:r.owner.group})));
  function release(record){
    // A late async mount must first supply its unbind callback. Its still-hidden
    // source is kept alive until that callback can run before source disposal.
    if(record.mounting)return;
    const owner=record.owner,unmount=record.unmount;record.owner=null;record.bounds=null;record.ready=false;record.unmount=null;record.view=null;
    if(owner)for(const action of [()=>unmount?.(),()=>owner.group.removeFromParent(),()=>owner.dispose()])try{action();}catch(error){disposalErrors.push({id:record.descriptor.id,error:error.message??String(error)});}
  }
  function snapshot(){return {disposed,loading:!!loading,borrowers:records.reduce((sum,r)=>sum+r.borrowers,0),distance:layer.snapshot,disposalErrors:[...disposalErrors],full:records.map(r=>({id:r.descriptor.id,representation:r.descriptor.representation==='full'?'full-only':'full-with-distance',ready:r.ready,mounting:r.mounting,borrowers:r.borrowers,visible:r.owner?.group.visible===true,primaryVisible:primary(r.descriptor.id),error:r.error,bounds:r.bounds?{min:r.bounds.min.toArray(),max:r.bounds.max.toArray()}:null})),policy:'reviewed full owners retained warm and explicitly borrowed by visits; only approved distance archives can replace their geometry'};}
  function get(id){const record=byId.get(id);return !disposed&&record?.ready&&record.owner&&!record.owner.disposed?record.view:null;}
  // This is a ready-only borrow, with no implicit decoding or wait for load().
  // Once returned, cancellation is handled by the caller returning this borrow.
  async function borrow(id,{signal:visitSignal}={}){
    visitSignal?.throwIfAborted();if(disposed)throw new Error('Resident buildings have been disposed.');
    const record=byId.get(id);if(!record)throw new Error(`Unknown resident building: ${id}`);
    const view=get(id);if(!view)throw new Error(`Resident building is not ready: ${id}`);
    ownerRecords.get(view.owner).borrowers++;record.borrowers++;return view.owner;
  }
  function returnBorrow(owner){
    const entry=ownerRecords.get(owner);if(!entry||entry.borrowers<1)throw new Error('Return only an outstanding resident borrow.');
    // A page exit may have already released the actual owner; returning a
    // previously issued borrow still only updates accounting, never disposes.
    entry.borrowers--;entry.record.borrowers--;return entry.borrowers;
  }
  function load(){
    if(disposed)return Promise.resolve(snapshot());if(loading)return loading;
    const operation=(async()=>{
      await layer.load();
      for(const record of records){
        if(disposed)break;if(record.owner)continue;let acquired=null,mountStarted=false;
        try{
          acquired=await loadFull(record.descriptor,{signal:lifetime.signal});
          if(!acquired?.group?.isObject3D||typeof acquired.dispose!=='function')throw new Error('Full-source loader did not return a resource owner.');
          if(ownerRecords.has(acquired)){acquired=null;throw new Error('Each resident descriptor requires a distinct owner that was not already retained or released.');}
          if(disposed){const late={descriptor:record.descriptor,owner:acquired,bounds:null};acquired=null;release(late);break;}
          if(acquired.group.parent)throw new Error('Resident full source must be detached before mounting.');
          let visibleMesh=false;acquired.group.traverseVisible(node=>{if(node.isMesh&&node.geometry?.attributes.position?.count>0&&(Array.isArray(node.material)?node.material:[node.material]).some(material=>material?.visible))visibleMesh=true;});
          if(!visibleMesh)throw new Error('Resident full source has no visible mesh.');
          record.owner=acquired;ownerRecords.set(acquired,{record,borrowers:0});acquired=null;root.add(record.owner.group);record.owner.group.updateWorldMatrix(true,true);record.bounds=new Box3().setFromObject(record.owner.group);
          if(record.bounds.isEmpty()||![...record.bounds.min.toArray(),...record.bounds.max.toArray()].every(Number.isFinite))throw new Error('Resident full source has empty or non-finite bounds.');
          if(mountFull){
            record.owner.group.visible=false;record.mounting=true;mountStarted=true;
            try{const mounted=mountFull(record.owner,record.descriptor),cleanup=mounted&&typeof mounted.then==='function'?await mounted:mounted;if(typeof cleanup!=='function')throw new Error('mountFull must return a synchronous release callback');record.unmount=cleanup;}
            finally{record.mounting=false;}
            if(disposed){release(record);break;}
          }
          record.ready=true;record.view=Object.freeze({descriptor:record.descriptor,owner:record.owner});record.owner.group.visible=sharedPrimary(record)||!primary(record.descriptor.id);record.error=null;
        }catch(error){try{acquired?.dispose?.();}catch(cleanup){disposalErrors.push({id:record.descriptor.id,error:cleanup.message??String(cleanup)});}finally{release(record);}if(!disposed||mountStarted)record.error=error.message??String(error);}
      }
      if(!disposed)register();return snapshot();
    })();loading=operation.then(()=>{loading=null;return snapshot();},error=>{loading=null;throw error;});return loading;
  }
  function evaluate(views){
    if(disposed)return snapshot();
    for(const record of records)if(record.ready&&record.owner){if(sharedPrimary(record))record.owner.group.visible=true;else if(record.descriptor.representation==='full')record.owner.group.visible=!primary(record.descriptor.id);else if(primary(record.descriptor.id))record.owner.group.visible=false;}
    register();let state=layer.evaluate(views),changed=false;
    for(const record of records){
      if(!record.ready||!record.owner||primary(record.descriptor.id))continue;
      const entry=state.sites.find(r=>r.id===record.descriptor.id);if(!entry)continue;
      const visible=entry.canReleaseFull?false:entry.needsFull?true:record.owner.group.visible;
      if(record.owner.group.visible!==visible){record.owner.group.visible=visible;changed=true;}
    }
    if(changed){register();layer.evaluate(views);}return snapshot();
  }
  function nearest(position,maximumDistance=75){
    let best=null;
    for(const record of records)if(record.ready&&record.bounds){const b=record.bounds,distance=Math.hypot(Math.max(b.min.x-position.x,0,position.x-b.max.x),Math.max(b.min.z-position.z,0,position.z-b.max.z));if(distance<maximumDistance&&(!best||distance<best.distance))best={site:record.descriptor.site,distance};}
    return best;
  }
  function dispose(){
    if(disposal)return disposal;
    let finish;disposal=new Promise(resolve=>{finish=resolve;});
    disposed=true;lifetime.abort();signal?.removeEventListener('abort',dispose);for(const record of records)release(record);
    Promise.allSettled([loading,Promise.resolve().then(()=>layer.dispose())]).then(results=>{for(const result of results)if(result.status==='rejected')disposalErrors.push({id:null,error:result.reason?.message??String(result.reason)});finish(snapshot());});return disposal;
  }
  if(signal?.aborted)dispose();else signal?.addEventListener('abort',dispose,{once:true});
  return {load,get,borrow,release:returnBorrow,evaluate,nearest,update(time){if(disposed)return;layer.update(time);for(const record of records)if(record.ready)record.owner?.update?.(time);},dispose,get snapshot(){return snapshot();}};
}
