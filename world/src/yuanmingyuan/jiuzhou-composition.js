import {Vector3} from 'three';
import {createPersistentEnsemble} from './persistent-ensemble.js';
import {placeMuseumStaticAsset} from './museum-static-batch.js';
import {sitePoint} from './museum-sites.js';
import {jiuzhouCompositionId,jiuzhouSiteId,jiuzhouIslandId,jiuzhouCompositionViews,jiuzhouEntryIds,createJiuzhouCompositionSite,createJiuzhouLandscapePlan} from './jiuzhou-composition-layout.js';

async function loadOriginal(id,{signal}){
  if(id!=='jiuzhou')throw new Error('Unknown Jiuzhou source.');
  signal.throwIfAborted();
  const {prepareJiuzhouSurfaceSource}=await import('./jiuzhou-surface-source.js');
  signal.throwIfAborted();
  return prepareJiuzhouSurfaceSource({signal});
}
function sameRing(a,b){
  if(!Array.isArray(a)||a.length!==b.length)return false;
  const equal=(p,q)=>Array.isArray(p)&&p.length===2&&p.every((v,i)=>Number.isFinite(v)&&Math.abs(v-q[i])<=1e-7);
  return a.some((_,offset)=>[1,-1].some(direction=>b.every((p,i)=>equal(a[(offset+direction*i+a.length)%a.length],p))));
}
function triangles(geometry,matrix,planeY,visit){
  const p=geometry?.attributes?.position,index=geometry?.index,total=index?.count??p?.count;
  const start=geometry?.drawRange?.start??0,count=geometry?.drawRange?.count??Infinity,end=Math.min(total,start+count);
  if(!geometry?.isBufferGeometry||!p||!Number.isInteger(start)||start<0||start%3||!(count===Infinity||Number.isInteger(count)&&count>=0)||!Number.isInteger(end)||end%3)throw new Error('Invalid drawn Jiuzhou lake geometry.');
  const vertices=[new Vector3(),new Vector3(),new Vector3()];
  for(let i=start;i<end;i+=3){
    for(let j=0;j<3;j++){
      const at=index?index.getX(i+j):i+j;
      if(!Number.isInteger(at)||at<0||at>=p.count)throw new Error('Invalid Jiuzhou lake triangle index.');
      const v=vertices[j].fromBufferAttribute(p,at);if(matrix)v.applyMatrix4(matrix);
      if(![v.x,v.y,v.z].every(Number.isFinite)||Math.abs(v.y-planeY)>1e-6)throw new Error('Jiuzhou lake differs from its declared horizontal plane.');
    }
    // A rotation of a triangle's first vertex does not change its winding.
    const keys=vertices.map(v=>Math.fround(v.x)+','+Math.fround(v.z)),first=keys.indexOf([...keys].sort()[0]);
    visit([keys[first],keys[(first+1)%3],keys[(first+2)%3]].join('|'));
  }
}
function requireWater(plan,terrain,water){
  if(!terrain||terrain.disposed||terrain.diagnostics?.layoutId!==plan.layout.id||!Array.isArray(terrain.waterSurfaces))throw new Error('Jiuzhou requires terrain made from its shared landscape plan.');
  const surfaces=terrain.waterSurfaces.filter(s=>s.worldY===2);
  if(surfaces.flatMap(s=>s.holes??[]).filter(r=>sameRing(r,plan.jiuzhou.worldOutline)).length!==1)throw new Error('Jiuzhou requires exactly one actual fine-island water hole.');
  const snapshot=water?.snapshot?.();
  if(!snapshot||snapshot.disposed||!water.group?.isObject3D||!water.group.visible||!Array.isArray(water.sheets)||water.sheets.length!==snapshot.sheets?.length)throw new Error('Jiuzhou connected water owner is unavailable.');
  const expected=new Map();let count=0;
  for(const surface of surfaces)triangles(surface.geometry,null,0,key=>{expected.set(key,(expected.get(key)??0)+1);count++;});
  if(!count)throw new Error('Jiuzhou terrain lake has no drawn triangles.');
  water.group.updateWorldMatrix(true,true);
  let drawn=0;
  for(let i=0;i<water.sheets.length;i++){
    const record=snapshot.sheets[i];if(record.height!==2)continue;
    const sheet=water.sheets[i];
    if(!sheet?.isMesh||sheet.isInstancedMesh||sheet.parent!==water.group||!sheet.visible||sheet.material?.visible===false||Math.abs(record.planeY-2.006)>1e-6)throw new Error('Jiuzhou connected lake sheet is not drawable at its datum.');
    triangles(sheet.geometry,sheet.matrixWorld,2.006,key=>{
      const remaining=expected.get(key)??0;if(!remaining)throw new Error('Jiuzhou rendered water differs from the shared terrain triangles.');
      if(remaining===1)expected.delete(key);else expected.set(key,remaining-1);drawn++;
    });
  }
  if(expected.size||drawn!==count)throw new Error('Jiuzhou rendered water is missing the shared terrain triangles.');
  return {terrainWaterTriangles:count,renderedWaterTriangles:drawn,islandHoles:1};
}

// One full original owner. View changes borrow it; only this lifetime releases
// its source triangles. The scene retains ownership of terrain and water.
export function createJiuzhouComposition({root,signal,load=loadOriginal,layout,landscapePlan,beforeDispose}={}){
  if(typeof load!=='function'||beforeDispose!==undefined&&typeof beforeDispose!=='function')throw new Error('Jiuzhou needs a source loader and optional dependent cleanup callback.');
  const site=createJiuzhouCompositionSite(),sites=Object.freeze([site]),lifetime=new AbortController();
  const ensemble=createPersistentEnsemble({root,descriptors:sites,signal:lifetime.signal,load:(descriptor,options)=>load(descriptor.assetId,options),place:placeMuseumStaticAsset});
  let disposed=false,status='idle',operation=null,plan=null,waterBound=false,waterEvidence=null,lastError=null,cleanupError=null;
  function dispose(){
    if(disposed)return;disposed=true;waterBound=false;if(status!=='failed')status='disposed';signal?.removeEventListener('abort',onAbort);
    const errors=[];
    // External abort must not reach the source support before its borrowers.
    for(const release of [()=>beforeDispose?.(),()=>ensemble.dispose(),()=>lifetime.abort(signal?.reason)])try{release();}catch(error){errors.push(error);}
    if(errors.length){cleanupError=new AggregateError(errors,'Jiuzhou composition cleanup failed');lastError=cleanupError.message;throw cleanupError;}
  }
  function fail(error){
    status='failed';lastError=error.message;
    try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Jiuzhou composition operation and cleanup failed',{cause:error});}
    throw error;
  }
  const onAbort=()=>{try{dispose();}catch{/* Cleanup error is retained for the scene. */}};
  if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});
  function assertPlacement(){
    const record=ensemble.get(jiuzhouSiteId);
    if(!record||record.owner.disposed||record.support.disposed||record.owner.group.parent!==ensemble.group)throw new Error('Jiuzhou original owner or support is unavailable.');
    record.owner.group.updateWorldMatrix(true,true);
    const expected=[1,0,0,0,0,1,0,0,0,0,1,0,...site.position,1];
    for(const node of new Set([record.owner.group,record.owner.collisionGroup].filter(Boolean))){
      node.updateWorldMatrix(true,false);
      if(!node.matrixWorld.elements.every((value,i)=>Number.isFinite(value)&&Math.abs(value-expected[i])<=1e-7))throw new Error('Jiuzhou shared world placement changed after support preparation.');
    }
    return record;
  }
  function prepare(){
    if(disposed)return Promise.reject(signal?.reason??new DOMException('Jiuzhou composition disposed','AbortError'));
    if(operation)return operation;status='loading';
    operation=(async()=>{
      try{
        await ensemble.prepare();lifetime.signal.throwIfAborted();ensemble.group.visible=false;
        const record=assertPlacement();
        plan=createJiuzhouLandscapePlan({source:record.owner,site,layout,landscapePlan});
        status='prepared';return plan;
      }catch(error){return fail(error);}
    })();
    operation.catch(()=>{});return operation;
  }
  function bindWater({terrain,water}={}){
    if(disposed||status!=='prepared'||waterBound)throw new Error('Prepare Jiuzhou once before its terrain/water handoff.');
    try{
      assertPlacement();waterEvidence=requireWater(plan,terrain,water);lifetime.signal.throwIfAborted();
      waterBound=true;status='water-ready';ensemble.group.visible=true;
      return {...waterEvidence};
    }catch(error){return fail(error);}
  }
  function view(id){
    const result=jiuzhouCompositionViews[id];
    if(!Object.hasOwn(jiuzhouCompositionViews,id))throw new Error('Unknown Jiuzhou view: '+id);
    return result;
  }
  function borrow(id=jiuzhouSiteId,options){
    if(disposed||!waterBound)return Promise.reject(new Error('Jiuzhou has no live complete terrain/water handoff.'));
    return ensemble.borrow(id,options);
  }
  return {sites,views:jiuzhouCompositionViews,entryIds:jiuzhouEntryIds,prepare,bindWater,dispose,group:ensemble.group,borrow,release:owner=>ensemble.release(owner),
    get:id=>ensemble.get(id),getView:view,
    borrowView(id,options){view(id);return borrow(jiuzhouSiteId,options);},
    update(time){
      if(disposed||!waterBound)return;
      try{const record=assertPlacement();record.owner.update?.(time);}catch(error){return fail(error);}
    },
    get support(){return ensemble.support;},get plan(){return plan;},get disposed(){return disposed;},get cleanupError(){return cleanupError;},
    get snapshot(){const record=ensemble.get(jiuzhouSiteId);return {id:jiuzhouCompositionId,status,disposed,waterBound,waterEvidence:waterEvidence?{...waterEvidence}:null,sourceOwners:record&&!record.owner.disposed?1:0,expectedSourceOwners:1,viewIds:Object.keys(jiuzhouCompositionViews),islandId:jiuzhouIslandId,
      externalMainlandConnected:false,nativeApproved:false,composedWorldApproved:false,ensemble:ensemble.snapshot,lastError};},
  };
}

// XZ comes from the authored court entry; Y/normal/validity come from live nav.
export function jiuzhouViewLanding(composition,nav,viewId){
  if(!composition?.snapshot.waterBound)throw new Error('Jiuzhou view landing requires its live composition.');
  const view=composition.getView(viewId),site=composition.sites[0],approach=sitePoint(site,[view.entry[0],view.entry[1]+2.4,view.entry[2]]);
  const support=nav.landing(approach);
  return support.valid?{valid:true,viewId,siteId:site.id,entryId:view.entryId,approach,support,position:{x:approach.x,y:support.y,z:approach.z}}:{valid:false,viewId,approach,support,reason:support.reason};
}
