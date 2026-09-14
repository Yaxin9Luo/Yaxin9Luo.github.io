import {createYangquelongStudy} from './yangquelong-study.js';
import {prepareYangquelongMaterialPixels,createYangquelongMaterialCandidate} from './yangquelong-materials.js';
import {prepareYangquelongBedGround} from './yangquelong-bed-ground.js';
import {loadSamplingSoilMaterial} from './yangquelong-soil-sampling.js';
export {yangquelongStudyViews} from './yangquelong-views.js';

export const yangquelongSurfaceSpec=Object.freeze({
  id:'yangquelong-surface-r1',
  architectureEvidence:'original proportional reconstruction; source evidence and uncertainty retained',
  bedsEvidence:'contemporary-exhibition-design-with-existing-authored-bed-footprints',
  historicallySurveyed:false,historicalColourVerified:false,
  geometry:'original complete source; only the reviewed paving cutouts and four soil bodies differ',
  sourcePixels:'original three Marble021 4K maps and four brown_mud 4K maps',
  combinedNativeAccepted:false,productionAdmitted:false,
});

const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong surface: '+message);};

/** One complete source owns its original geometry, materials and nine waters.
 * The material view borrows that source. Ground is attached to the material
 * view only AFTER the view has checked the original unpatched source.
 * Dependencies are explicit seams for bounded ownership tests; defaults use
 * the original full factories and same-byte private texture loaders.
 */
export async function prepareYangquelongSurface({
  signal,sourceOwner,createSource=createYangquelongStudy,
  preparePixels=prepareYangquelongMaterialPixels,
  createMaterialView=createYangquelongMaterialCandidate,
  prepareGround=prepareYangquelongBedGround,loadSoil=loadSamplingSoilMaterial,
}={}){
  signal?.throwIfAborted();
  const ownsSource=!sourceOwner,controller=new AbortController(),released=new Set(),errors=[];
  let source=sourceOwner,pixels=null,view=null,ground=null,disposed=false;
  const remember=error=>{if(!errors.includes(error))errors.push(error);};
  function release(resource){
    if(!resource||released.has(resource))return;released.add(resource);
    try{resource.dispose();}catch(error){remember(error);}
  }
  function releaseAll(){
    release(ground);release(view);if(ownsSource)release(source);release(pixels);
  }
  function cleanupError(){return errors.length?new AggregateError([...errors],'Yangquelong surface cleanup failed'):null;}
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);
    releaseAll();
    controller.abort(signal?.reason);
    const error=cleanupError();if(error)throw error;
  }
  function cancel(){try{dispose();}catch{/* whenIdle and preparation rejection expose cleanup failures. */}}
  async function settle(){
    for(const resource of [ground,view,...(ownsSource?[source]:[])]){
      try{await resource?.whenIdle?.();}catch(error){remember(error);}
    }
  }
  async function whenIdle(){await settle();const error=cleanupError();if(error)throw error;}
  function guard(){
    signal?.throwIfAborted();controller.signal.throwIfAborted();
    fail(!disposed,'owner already disposed');
    if(source)fail(source.group?.isGroup&&source.group.children.length&&!source.disposed,'live complete source required');
    if(view)fail(!view.disposed&&view.group?.children.length,'material view was invalidated');
    if(ground)fail(!ground.disposed,'ground binding was invalidated');
  }
  function assertCurrent(){
    try{guard();ground.assertCurrent();return true;}
    catch(error){
      try{dispose();}catch{/* The combined error below contains each cleanup cause. */}
      const cleanup=cleanupError();
      if(cleanup)throw new AggregateError([error,...errors],'Yangquelong surface invalidation and cleanup failed',{cause:error});
      throw error;
    }
  }
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    guard();
    if(source)fail(source.group.userData.assetId==='yangquelong'&&typeof source.dispose==='function','original Yangquelong source owner required');
    pixels=await preparePixels({signal:controller.signal});guard();
    source??=createSource();guard();
    fail(source.group.userData.assetId==='yangquelong'&&typeof source.dispose==='function','original Yangquelong source owner required');
    view=createMaterialView({pixels,sourceOwner:source,signal:controller.signal});guard();
    // The material texture owner now retains the decoded arrays; preparation
    // can release its own references without closing the live texture images.
    release(pixels);if(errors.length)throw cleanupError();
    ground=await prepareGround({owner:view,signal:controller.signal,createSoilMaterial:loadSoil});guard();
    ground.assertCurrent();
    let meshCount=0,triangleCount=0,waterMeshes=0;
    view.group.traverse(node=>{
      if(!node.isMesh)return;
      meshCount++;triangleCount+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;
      if(node.material.userData?.category==='water')waterMeshes++;
    });
    const sourceDiagnostics=source.diagnostics??{};
    const diagnostics={...sourceDiagnostics,assetId:'yangquelong',surfaceId:yangquelongSurfaceSpec.id,
      triangles:triangleCount,triangleCount,meshCount,
      timeLayer:'historical-architecture-with-contemporary-exhibition-beds',
      sourceTimeLayer:sourceDiagnostics.timeLayer??null,
      evidence:[...(sourceDiagnostics.evidence??[]),{type:'contemporary-exhibition-design',scope:'four soil beds inside existing authored edging',historicallySurveyed:false}],
      uncertainty:[...(sourceDiagnostics.uncertainty??[]),'The soil beds are a contemporary exhibition design. Their shape, soil appearance and planting state are not a historical survey.'],
      surface:{spec:yangquelongSurfaceSpec,ground:ground.diagnostics,materials:view.diagnostics,waterMeshes},
      resourceOwnership:{sourceOwnerBorrowed:!ownsSource,geometry:'original source plus reversible ground binding',materials:'private material view and exclusive soil lease; other source materials borrowed',textures:'three private full 4K stone maps plus four exclusive full 4K soil maps; source water textures borrowed',releaseOrder:['ground binding','material view','owned original source'],moduleGlobalCache:false},
      visualAcceptance:false,integrationAcceptance:false};
    view.group.userData={...view.group.userData,surfaceId:yangquelongSurfaceSpec.id,bedsEvidence:yangquelongSurfaceSpec.bedsEvidence,sourceTimeLayer:sourceDiagnostics.timeLayer??null,visualAcceptance:false,integrationAcceptance:false};
    return {group:view.group,diagnostics,sourceOwner:source,materialOwner:view,groundBinding:ground,
      assertCurrent,update(time){assertCurrent();view.update?.(time);},dispose,whenIdle,
      get disposed(){return disposed;},get cleanupError(){return cleanupError();}};
  }catch(error){
    try{dispose();}catch{/* releaseAll recorded the underlying failures. */}
    // A signal may have released earlier handles while an uncancellable
    // decoder or async binding was still returning its last owned handle.
    releaseAll();await settle();
    if(errors.length)throw new AggregateError([error,...errors],'Yangquelong surface preparation and cleanup failed',{cause:error});
    throw error;
  }
}

/** Studio expects async preparation followed by one synchronous owner handoff.
 * A ready, unconsumed owner still belongs to this factory and the load signal.
 */
export async function prepareYangquelongSurfaceFactory(options={}){
  const owner=await prepareYangquelongSurface(options);let consumed=false,discarded=false;
  const factory=()=>{
    options.signal?.throwIfAborted();fail(!consumed&&!discarded,'prepared factory already consumed or disposed');
    owner.assertCurrent();consumed=true;return owner;
  };
  factory.dispose=()=>{if(consumed||discarded)return;discarded=true;owner.dispose();};
  factory.whenIdle=()=>owner.whenIdle();
  return factory;
}
