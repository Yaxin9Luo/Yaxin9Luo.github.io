import * as THREE from 'three';
import {archiveSHA256} from './asset-archive.js';
import {loadBuildingDistanceArchive,validateBuildingDistanceReport,createBuildingDistanceSelection} from './zhengjuesi-distance-runtime.js';

const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const message=error=>error?.message??String(error);
const aborted=signal=>signal?.reason??new DOMException('Resident distance load aborted','AbortError');

/** Owns resident distance archives only; no full factory, catalog or implicit
 * native approval. Descriptors are:
 * { id:siteId, assetId, site:{position:[x,y,z],rotationY,scale}, manifestURL,
 *   expectedManifestSHA256, approvedDistanceSHA256?: externallyReviewedSHA,
 *   source:{manifestURL,approvedManifestSHA256} }.
 * Missing/mismatched distance approval causes zero requests and no distance draw.
 * The approved full manifest binds the report's source digest AND raw manifest
 * hash; the approved distance manifest binds report, geometry and texture bytes.
 *
 * load() coalesces callers and serializes complete decoders, including cancelled
 * decoders that finish late. cancel() retains completed owners; dispose() also
 * waits for late owners to be released. All archive placement is in wrappers.
 *
 * evaluate({camera,renderer,additionalViews?,siteController?}) is required before
 * each render. The primary drawing buffer comes from the actual renderer;
 * additionalViews use {id,camera,physicalWidth,physicalHeight} from actual targets.
 * All supplied views must pass the unchanged .4/.5 pixel hysteresis. Unsupported
 * projections fail closed. Frustum tests use inflated full-source bounds only
 * for demand/telemetry; they never globally hide an otherwise eligible caster.
 * Omitted reflection/shadow views are NOT independently precision-certified.
 *
 * A site-controller counts as full only when ready AND its resource group is
 * visibly mounted below root. setFullSites([{id,group}]) admits externally owned
 * fallback groups by the same physical check. Neither full owner is disposed,
 * transformed or hidden here. The caller must retire/hide its fallback before
 * exposing another full owner for the same site; duplicates are reported.
 * canReleaseFull is computed even while full is mounted, and only becomes true
 * when an already loaded distance owner passes the .4px entry threshold.
 *
 * onPrepareNear/onNeedsFull are edge-triggered scheduling notifications, not
 * resource transfers. At >=.3px a visible site requests full-source preparation;
 * beyond admission, pendingFull/coverage-gap remain explicit until an actual
 * full owner is mounted. ROOT owns loading/awaiting those independent full assets.
 */
export function createMuseumDistanceLayer({root,descriptors=[],baseURL=globalThis.location?.href,fetchImpl=globalThis.fetch,loadDistance=loadBuildingDistanceArchive,configure,siteController=null,onChange=()=>{},onPrepareNear=()=>{},onNeedsFull=()=>{},signal}={}){
  if(!root?.isObject3D||!Array.isArray(descriptors)||typeof fetchImpl!=='function'||typeof loadDistance!=='function')throw new Error('Resident distance layer requires a scene root, descriptors and loader');
  const base=new URL(baseURL);
  if(!['http:','https:'].includes(base.protocol))throw new Error('Resident distance archives require an HTTP exhibition origin');
  const sameOrigin=(path,parent=base)=>{const url=new URL(path,parent);if(url.origin!==base.origin||!['http:','https:'].includes(url.protocol))throw new Error('Resident distance archive files must share the exhibition origin');return url.href;};
  const byId=new Map(),records=descriptors.map(input=>{
    const id=input?.id,assetId=input?.assetId??input?.site?.assetId??id,position=input?.site?.position,rotationY=input?.site?.rotationY??0,scale=input?.site?.scale??1;
    if(typeof id!=='string'||!id||byId.has(id))throw new Error('Resident distance site IDs must be nonempty and unique');
    if(typeof assetId!=='string'||!assetId||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Number.isFinite(rotationY)||!Number.isFinite(scale)||scale<=0||input.site.id&&input.site.id!==id)throw new Error(`Invalid resident distance placement: ${id}`);
    if(!digest(input.expectedManifestSHA256)||!digest(input.source?.approvedManifestSHA256)||typeof input.manifestURL!=='string'||!input.manifestURL||typeof input.source?.manifestURL!=='string'||!input.source.manifestURL||input.approvedDistanceSHA256!=null&&!digest(input.approvedDistanceSHA256))throw new Error(`Invalid resident distance manifest approval: ${id}`);
    const approved=input.approvedDistanceSHA256===input.expectedManifestSHA256;
    const record={id,assetId,site:{...input.site,id,assetId,position:[...position],rotationY,scale},manifestURL:sameOrigin(input.manifestURL),expectedManifestSHA256:input.expectedManifestSHA256,approvedDistanceSHA256:input.approvedDistanceSHA256??null,source:{manifestURL:sameOrigin(input.source.manifestURL),approvedManifestSHA256:input.source.approvedManifestSHA256},approved,owner:null,sourceManifest:null,report:null,ticket:null,loadState:approved?'idle':'approval-required',reason:approved?'distance-not-loaded':'native-distance-review-required',error:null,views:[],potentiallyVisible:true,fullReady:false,fullMountCount:0,canReleaseFull:false,needsFull:true,prepareNear:false,pendingFull:false,selection:createBuildingDistanceSelection(),notice:{prepare:false,needs:false}};
    byId.set(id,record);return record;
  });
  const group=new THREE.Group();group.name='yuanmingyuan-resident-distance-buildings';group.userData.representation='externally-approved-building-distance';
  let disposed=false,request=null,queue=Promise.resolve(),externalFullSites=[],viewError=null,physicalViews=[],activeController=siteController;
  const disposalErrors=[],callbackErrors=[];
  const append=(list,value)=>{list.push(value);if(list.length>32)list.shift();};
  const snapshot=()=>({status:disposed?'disposed':request?'loading':records.some(r=>r.loadState==='failed')?'partial':records.every(r=>r.loadState==='ready')?'ready':records.some(r=>r.owner)?'partial':'idle',sites:records.map(r=>({id:r.id,assetId:r.assetId,loadState:r.loadState,nativeDistanceApproved:r.approved,sourceManifestSHA256:r.source.approvedManifestSHA256,distanceManifestSHA256:r.expectedManifestSHA256,visible:!disposed&&!!r.owner?.wrapper.visible,fullReady:!disposed&&r.fullReady,fullMountCount:r.fullMountCount,duplicateFullOwners:r.fullMountCount>1,canReleaseFull:!disposed&&r.canReleaseFull,needsFull:!disposed&&r.needsFull,prepareNear:!disposed&&r.prepareNear,pendingFull:!disposed&&r.pendingFull,potentiallyVisible:r.potentiallyVisible,coverage:disposed?'disposed':r.fullReady?'full':r.owner?.wrapper.visible?'distance':r.pendingFull?'coverage-gap':r.potentiallyVisible?'unavailable':'out-of-frustum',reason:r.reason,error:r.error,views:structuredClone(r.views)})),loaded:records.filter(r=>r.owner).length,visible:disposed?0:records.filter(r=>r.owner?.wrapper.visible).length,needsFull:disposed?[]:records.filter(r=>r.needsFull).map(r=>r.id),prepareNear:disposed?[]:records.filter(r=>r.prepareNear).map(r=>r.id),pendingFull:disposed?[]:records.filter(r=>r.pendingFull).map(r=>r.id),physicalViews:structuredClone(physicalViews),precisionScope:'supplied cameras and physical targets only; no implicit reflection or shadow-view approval',viewError,disposalErrors:[...disposalErrors],callbackErrors:[...callbackErrors]});
  function call(callback,value){try{Promise.resolve(callback(value)).catch(error=>{if(!disposed)append(callbackErrors,message(error));});}catch(error){append(callbackErrors,message(error));}}
  const notify=()=>call(onChange,snapshot());
  const current=ticket=>!disposed&&request===ticket&&!ticket.controller.signal.aborted;
  function release(owner,id){
    if(!owner||owner.released)return;owner.released=true;
    for(const action of [()=>{if(owner.wrapper){owner.wrapper.visible=false;owner.wrapper.removeFromParent();}},()=>owner.asset?.group?.removeFromParent(),()=>owner.asset?.dispose?.()])try{action();}catch(error){append(disposalErrors,{id,error:message(error)});}
    owner.wrapper?.clear();
  }
  function mounted(node){if(!node?.isObject3D)return false;for(let p=node;p;p=p.parent){if(!p.visible)return false;if(p===root)return true;}return false;}
  function syncFull(){
    const mounts=[...externalFullSites],state=activeController?.snapshot,resource=activeController?.resource;
    if(state?.status==='ready'&&resource?.group)mounts.push({id:state.siteId,group:resource.group});
    for(const record of records){
      const unique=new Set(mounts.filter(m=>m.id===record.id&&mounted(m.group)).map(m=>m.group)),wasReady=record.fullReady;record.fullMountCount=unique.size;record.fullReady=unique.size>0;record.canReleaseFull=false;
      if(record.fullReady){if(record.owner)record.owner.wrapper.visible=false;record.selection.reset();record.reason='full-model-mounted';record.needsFull=false;record.prepareNear=false;record.pendingFull=false;record.notice={prepare:false,needs:false};}
      else if(wasReady){record.reason='full-owner-retired; view-evaluation-required';record.needsFull=true;record.pendingFull=record.potentiallyVisible;record.selection.reset();}
    }
  }
  async function exhibitionFetch(url,options){const response=await fetchImpl(sameOrigin(url),options);if(response.url)sameOrigin(response.url);return response;}
  async function approvedJSON(url,sha,loadingSignal){
    const response=await exhibitionFetch(url,{signal:loadingSignal});if(!response.ok)throw new Error(`Resident archive manifest HTTP ${response.status}`);const bytes=await response.arrayBuffer();if(loadingSignal.aborted)throw aborted(loadingSignal);if(await archiveSHA256(bytes)!==sha)throw new Error('Resident archive approved manifest SHA256 mismatch');return {bytes,manifest:JSON.parse(new TextDecoder().decode(bytes))};
  }
  async function readArchive(record,loadingSignal){
    const source=await approvedJSON(record.source.manifestURL,record.source.approvedManifestSHA256,loadingSignal),full=source.manifest;
    if(full.id!==record.assetId||!digest(full.sourceDigest)||full.verification?.exactRoundtripPassed!==true||full.verification?.simplified!==false||full.verification?.quantized!==false)throw new Error('Resident full-source archive identity or exactness mismatch');
    const input=await approvedJSON(record.manifestURL,record.expectedManifestSHA256,loadingSignal),manifest=input.manifest,report=validateBuildingDistanceReport(manifest.distance?.report);
    if(manifest.kind!=='yuanmingyuan-building-distance-pilot'||manifest.id!==record.assetId+'-distance'||report.id!==record.assetId||report.sourceArchiveDigest!==full.sourceDigest||report.provenance?.sourceManifestSHA256!==(full.transport?.sourceManifestSHA256??record.source.approvedManifestSHA256)||!digest(manifest.distance?.sha256)||await archiveSHA256(new TextEncoder().encode(JSON.stringify(report)))!==manifest.distance.sha256)throw new Error('Resident distance report and approved full-source archive differ');
    for(const key of ['glb','runtime']){const entry=manifest[key];if(typeof entry?.url!=='string'||!digest(entry.sha256))throw new Error(`Invalid resident distance ${key}`);sameOrigin(entry.url,record.manifestURL);}
    const cachedFetch=(url,options)=>sameOrigin(url)===record.manifestURL?Promise.resolve(new Response(input.bytes,{headers:{'Content-Type':'application/json'}})):exhibitionFetch(url,options);
    const asset=await loadDistance({manifestURL:record.manifestURL,expectedManifestSHA256:record.expectedManifestSHA256,expectedReportSHA256:manifest.distance.sha256,approvedDistanceSHA256:record.approvedDistanceSHA256},{signal:loadingSignal,fetchImpl:cachedFetch});
    return {asset,full,report,reportSHA256:manifest.distance.sha256};
  }
  function cancelTicket(ticket){
    if(!ticket)return;ticket.controller.abort();if(request!==ticket)return;request=null;
    for(const record of records)if(record.ticket===ticket&&['queued','loading'].includes(record.loadState)){record.loadState='cancelled';record.reason='distance-loading-cancelled';}
    notify();
  }
  function linkSignal(ticket,external){if(!external||ticket.signals.has(external))return;const abort=()=>cancelTicket(ticket);ticket.signals.set(external,abort);if(external.aborted)abort();else external.addEventListener('abort',abort,{once:true});}
  function load({signal:loadingSignal}={}){
    if(disposed)return Promise.resolve(snapshot());if(loadingSignal?.aborted)return Promise.reject(aborted(loadingSignal));
    if(request){linkSignal(request,loadingSignal);return request.promise;}
    const pending=records.filter(r=>r.approved&&!r.owner);if(!pending.length)return Promise.resolve(snapshot());
    const ticket={controller:new AbortController(),signals:new Map(),promise:null};request=ticket;
    for(const record of pending){record.ticket=ticket;record.loadState='queued';record.reason='distance-loading';record.error=null;}
    ticket.promise=queue.catch(()=>{}).then(async()=>{
      try{for(const record of pending){
        if(!current(ticket))break;record.loadState='loading';notify();if(!current(ticket))break;let owner=null;
        try{
          const loaded=await readArchive(record,ticket.controller.signal);owner={asset:loaded.asset,wrapper:null,released:false};const asset=owner.asset;
          if(!asset?.group?.isObject3D||typeof asset.dispose!=='function'||typeof asset.evaluate!=='function'||asset.distance?.manifestSHA256!==record.expectedManifestSHA256||asset.distance?.reportSHA256!==loaded.reportSHA256||asset.distance?.report?.sourceArchiveDigest!==loaded.report.sourceArchiveDigest)throw new Error('Resident distance decoder returned an unbound scene or resource owner');
          if(!current(ticket)){release(owner,record.id);continue;}await configure?.(asset,record.site);if(!current(ticket)){release(owner,record.id);continue;}
          const wrapper=new THREE.Group();owner.wrapper=wrapper;wrapper.name=`museum-distance-${record.id}`;wrapper.userData={siteId:record.id,assetId:record.assetId,representation:'reviewed-building-distance'};wrapper.position.fromArray(record.site.position);wrapper.rotation.y=record.site.rotationY;wrapper.scale.setScalar(record.site.scale);wrapper.visible=false;wrapper.add(asset.group);record.owner=owner;group.add(wrapper);
          if(!current(ticket)){if(record.owner===owner)record.owner=null;release(owner,record.id);continue;}
          record.sourceManifest=loaded.full;record.report=loaded.report;record.loadState='ready';record.reason='view-evaluation-required';record.selection.reset();syncFull();notify();
        }catch(error){if(record.owner===owner)record.owner=null;release(owner,record.id);if(current(ticket)){record.loadState='failed';record.reason='distance-load-failed';record.error=message(error);notify();}}
      }}finally{for(const [external,abort] of ticket.signals)external.removeEventListener('abort',abort);ticket.signals.clear();for(const record of pending)if(record.ticket===ticket)record.ticket=null;if(request===ticket){request=null;notify();}}
      return snapshot();
    });queue=ticket.promise;linkSignal(ticket,loadingSignal);notify();return ticket.promise;
  }
  function demand(record){
    const payload=()=>({id:record.id,assetId:record.assetId,site:structuredClone(record.site),source:{...record.source},distance:{manifestURL:record.manifestURL,expectedManifestSHA256:record.expectedManifestSHA256,approvedDistanceSHA256:record.approvedDistanceSHA256},reason:record.reason,views:structuredClone(record.views),fullReady:record.fullReady,pendingFull:record.pendingFull,ownership:'caller loads and owns full-source resources; no transfer to distance layer'});
    const prepare=record.prepareNear&&!record.fullReady,needs=record.pendingFull;
    const previous=record.notice;record.notice={prepare,needs};
    if(prepare&&!previous.prepare)call(onPrepareNear,payload());if(needs&&!previous.needs&&!record.fullReady)call(onNeedsFull,payload());
  }
  function evaluate({camera,renderer,additionalViews=[],siteController:controller=activeController}={}){
    if(disposed)return snapshot();activeController=controller;syncFull();let views;
    try{
      if(!Array.isArray(additionalViews)||typeof renderer?.getDrawingBufferSize!=='function')throw new Error('Resident distance evaluation requires the actual drawing buffer and views');
      const size=renderer.getDrawingBufferSize(new THREE.Vector2());views=[{id:'main',camera,physicalWidth:size.x,physicalHeight:size.y},...additionalViews.map(view=>({...view}))];const ids=new Set();
      for(const view of views){if(typeof view.id!=='string'||!view.id||ids.has(view.id)||(!view.camera?.isPerspectiveCamera&&!view.camera?.isOrthographicCamera)||![view.physicalWidth,view.physicalHeight].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid resident camera or physical target');ids.add(view.id);view.camera.updateWorldMatrix(true,false);view.frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(view.camera.projectionMatrix,view.camera.matrixWorldInverse),view.camera.coordinateSystem,view.camera.reversedDepth);}
      physicalViews=views.map(v=>({id:v.id,width:v.physicalWidth,height:v.physicalHeight}));viewError=null;
    }catch(error){
      viewError=message(error);physicalViews=[];
      for(const record of records)if(!record.fullReady){if(record.owner)record.owner.wrapper.visible=false;record.selection.reset();record.views=[];record.reason='physical-view-invalid';record.error=viewError;record.potentiallyVisible=true;record.needsFull=true;record.prepareNear=true;record.pendingFull=true;demand(record);}
      notify();return snapshot();
    }
    for(const record of records){
      record.views=[];record.potentiallyVisible=true;
      try{
        if(!record.owner){record.needsFull=!record.fullReady;record.prepareNear=!record.fullReady;record.pendingFull=!record.fullReady;demand(record);continue;}
        const asset=record.owner.asset;asset.group.updateWorldMatrix(true,true);
        const placement=new THREE.Matrix4().multiplyMatrices(asset.group.matrixWorld,new THREE.Matrix4().fromArray(record.report.sourceRootWorldMatrix).invert()),box=new THREE.Box3(new THREE.Vector3(...record.report.boundsArchiveWorld.min),new THREE.Vector3(...record.report.boundsArchiveWorld.max)).expandByScalar(record.report.maximumErrorArchiveWorld).applyMatrix4(placement);
        for(const view of views){
          const result=asset.evaluate({camera:view.camera,physicalWidth:view.physicalWidth,physicalHeight:view.physicalHeight,pixelBudget:.5,approvedDistanceSHA256:record.approvedDistanceSHA256});
          const valid=result?.eligible===true&&result.nativeApproved===true&&result.manifestSHA256===record.expectedManifestSHA256&&Number.isFinite(result.projectedErrorPhysicalPixels)&&result.projectedErrorPhysicalPixels>=0&&result.projectedErrorPhysicalPixels<=.5;
          record.views.push({id:view.id,inFrustum:view.frustum.intersectsBox(box),eligible:valid,projectedErrorPhysicalPixels:result?.projectedErrorPhysicalPixels,nearestSourceDepth:result?.nearestSourceDepth,reason:result?.reason??'distance-evaluation-invalid'});
        }
        const pixels=Math.max(...record.views.map(v=>Number.isFinite(v.projectedErrorPhysicalPixels)&&v.projectedErrorPhysicalPixels>=0?v.projectedErrorPhysicalPixels:Infinity)),eligible=record.views.every(v=>v.eligible)&&asset.group.visible!==false;
        record.potentiallyVisible=record.views.some(v=>v.inFrustum);record.error=null;
        if(record.fullReady){record.owner.wrapper.visible=false;record.selection.reset();record.canReleaseFull=eligible&&pixels<=.4;}
        else{
          const selection=record.selection.update({eligible,projectedErrorPhysicalPixels:pixels,pixelBudget:.5,reason:eligible?'supplied-views-within-pixel-budget':'full-precision-required'},{fullReady:false});
          record.owner.wrapper.visible=selection.mode==='distance';record.needsFull=!record.owner.wrapper.visible;record.prepareNear=record.potentiallyVisible&&(pixels>=.3||record.needsFull);record.pendingFull=record.potentiallyVisible&&record.needsFull;record.reason=record.pendingFull?'full-not-mounted; coverage-gap':record.owner.wrapper.visible?'approved-distance-resident':record.potentiallyVisible?'full-precision-required':'outside-supplied-frusta; full-precision-required';
        }
      }catch(error){record.owner.wrapper.visible=false;record.selection.reset();record.reason=record.fullReady?'full-model-mounted; distance-evaluation-failed':'distance-evaluation-failed';record.error=message(error);record.needsFull=!record.fullReady;record.prepareNear=!record.fullReady;record.pendingFull=!record.fullReady;}
      demand(record);
    }
    notify();return snapshot();
  }
  function setFullSites(mounts){
    if(!Array.isArray(mounts)||mounts.some(m=>!byId.has(m?.id)||!m.group?.isObject3D))throw new Error('Fallback full mounts require known site IDs and actual scene groups');
    if(!disposed){externalFullSites=mounts.map(m=>({id:m.id,group:m.group}));syncFull();notify();}return snapshot();
  }
  function update(time){if(disposed||!Number.isFinite(time))return;for(const record of records)if(record.owner)try{record.owner.asset.update?.(time);}catch(error){const owner=record.owner;record.owner=null;release(owner,record.id);record.loadState='failed';record.reason='distance-animation-failed';record.error=message(error);record.needsFull=!record.fullReady;record.pendingFull=!record.fullReady&&record.potentiallyVisible;record.prepareNear=record.pendingFull;demand(record);notify();}}
  function dispose(){
    if(!disposed){disposed=true;request?.controller.abort();request=null;signal?.removeEventListener('abort',dispose);for(const record of records){release(record.owner,record.id);record.owner=null;record.loadState='disposed';record.reason='distance-layer-disposed';record.selection.reset();record.sourceManifest=null;record.report=null;}externalFullSites=[];activeController=null;group.removeFromParent();group.clear();notify();}
    return queue.catch(()=>{}).then(snapshot);
  }
  if(signal?.aborted)dispose();else{root.add(group);signal?.addEventListener('abort',dispose,{once:true});}
  return {group,load,evaluate,update,setFullSites,cancel(){cancelTicket(request);return queue.catch(()=>{}).then(snapshot);},dispose,get snapshot(){return snapshot();}};
}
