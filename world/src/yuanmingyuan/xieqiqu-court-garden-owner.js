import {createWesternGardenPlantingSourceLoader} from './western-garden-planting-sources.js';
import {prepareXieqiquCourtGardenR1} from './xieqiqu-court-garden-r1.js';
import {createXieqiquCourtGardenR1Layout} from './xieqiqu-court-garden-r1-layout.js';

// One complete source-building owner, decorated before placement/support build.
// Borrowed plant views leave first, then prototypes, then the original building.
// The public lifetime never directly disposes a borrowed prototype or base.
// One frozen layout drives source preparation and the shared binding, with R1 default.
export async function createXieqiquCourtGardenOwner({
  loadBase,layout=createXieqiquCourtGardenR1Layout(),signal,onProgress=()=>{},
  createSources=createWesternGardenPlantingSourceLoader,
  prepareGarden=prepareXieqiquCourtGardenR1,
}={}){
  signal?.throwIfAborted();
  if([loadBase,onProgress,createSources,prepareGarden].some(value=>typeof value!=='function'))throw new Error('Court garden requires a full source loader and callable dependencies.');
  const work=new AbortController(),baseLifetime=new AbortController(),plan=layout,cleanupErrors=[];
  let base=null,sources=null,garden=null,preparing=true,disposed=false,sourceReleased=false,baseReleased=false;
  const run=release=>{try{release();}catch(error){cleanupErrors.push(error);}};
  function releaseOwners(){
    if(sources&&!sourceReleased){sourceReleased=true;run(()=>sources.dispose());}
    if(base&&!baseReleased){baseReleased=true;run(()=>base.dispose());}
    baseLifetime.abort(signal?.reason??new DOMException('Court garden base released.','AbortError'));
  }
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);
    // The binding observes this abort and restores its material before the
    // original source owner is released. An in-flight binding cleans itself.
    work.abort(signal?.reason??new DOMException('Court garden owner disposed.','AbortError'));
    run(()=>garden?.dispose());
    if(!base)baseLifetime.abort(work.signal.reason);
    if(!preparing)releaseOwners();
    if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Court garden owner cleanup failed.');
  }
  const cancel=()=>{try{dispose();}catch{/* diagnostics/whenIdle retain cleanup failures */}};
  const check=()=>{work.signal.throwIfAborted();if(disposed)throw new DOMException('Court garden owner disposed.','AbortError');};
  function assertCurrent(){check();try{return garden.assertCurrent();}catch(error){cancel();throw error;}}
  async function whenIdle(){
    await sources?.whenIdle();
    if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Court garden asynchronous cleanup failed.');
  }
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  try{
    check();onProgress({stage:'original-building'});check();
    base=await loadBase({signal:baseLifetime.signal});check();
    if(!base?.group?.isObject3D||base.group.parent||!base.group.children.length||base.disposed||typeof base.dispose!=='function')throw new Error('Court garden needs one complete unattached original building.');
    sources=createSources({plantingLayout:plan.sourceLayout});
    const prepared=await sources.prepareRegion(plan.id,{signal:work.signal});check();
    garden=await prepareGarden({owner:base,sources:prepared.sources,layout:plan,buildSupport:false,signal:work.signal,onProgress});
    if(disposed||work.signal.aborted){run(()=>garden.dispose());check();}
    garden.assertCurrent();
    let triangleCount=0,meshCount=0;
    base.group.traverse(node=>{if(node.isMesh){meshCount++;triangleCount+=((node.geometry.index?.count??node.geometry.attributes.position.count)/3)*(node.isInstancedMesh?node.count:1);}});
    const diagnostics={...base.diagnostics,triangleCount,triangles:triangleCount,meshCount,
      originalBuildingTriangles:base.diagnostics?.triangles??base.diagnostics?.triangleCount??null,
      courtGarden:garden.diagnostics,courtGardenSources:sources.snapshot(),
      resourceOwnership:{...base.diagnostics?.resourceOwnership,scope:'Original building only; court surfaces, display material and plant prototypes are reported separately.'},
      compositeOwnership:{scope:'Complete original building with contemporary court garden',releaseOrder:['court binding and borrowed views','plant source owners','original building'],ownedCourtSurfaceTriangles:garden.diagnostics.ownedSurfaceTriangles??null},
    };
    onProgress({stage:'court-garden-ready'});check();preparing=false;
    return {
      group:base.group,collisionGroup:base.collisionGroup??base.group,diagnostics,
      get disposed(){return disposed;},
      assertCurrent,
      update(time){if(disposed)return;assertCurrent();base.update?.(time);sources.update(time);},
      whenIdle,dispose,
    };
  }catch(error){
    preparing=false;
    try{dispose();}catch{/* all owners were attempted */}
    releaseOwners();
    try{await sources?.whenIdle();}catch(cleanup){cleanupErrors.push(cleanup);}
    if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Court garden preparation and cleanup failed.',{cause:error});
    throw error;
  }
}
