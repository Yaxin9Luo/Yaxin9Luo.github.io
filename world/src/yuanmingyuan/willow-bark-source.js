import {createWillowRootMaterialLease} from './willow-root-material.js';
import {createWillowRootGeometryBatch,willowRootRefinementSpec} from './willow-root-geometry.js';
import {createGardenVegetationStudy} from './garden-vegetation.js';
import {createWillowBarkGeometry,willowBarkReliefSpec} from './willow-bark-geometry.js';
import {loadWillowBarkMaps} from './willow-bark-textures.js';
import {willowBarkMaterialId,willowBarkResponseSpec} from './willow-bark-material.js';
import {setWillowSampling} from './willow-distance-sampling.js';

/** One complete original willow with only the two bark batches refined.
 * All regional borrowers release before this owner. The existing planting
 * loader can await this factory; it still receives one unplaced specimen. */
export async function prepareWillowBarkSource({signal,loadMaps=loadWillowBarkMaps,createSource=createGardenVegetationStudy}={}){
 signal?.throwIfAborted();const lifetime=new AbortController(),cleanupErrors=[];
 let maps,source,lease,disposed=false,preparing=true,released=false;
 const attempt=f=>{try{f();}catch(e){cleanupErrors.push(e);}};
 function release(){
  if(released)return;released=true;
  attempt(()=>lease?.dispose());attempt(()=>maps?.dispose());attempt(()=>source?.dispose());
 }
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);source?.group&&(source.group.visible=false);
  if(!preparing)release();lifetime.abort(signal?.reason??new DOMException('Willow bark source disposed.','AbortError'));
  if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Willow bark source cleanup failed.');
 }
 const cancel=()=>{try{dispose();}catch{/* whenIdle retains cleanup failures. */}};
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  maps=await loadMaps({signal:lifetime.signal});lifetime.signal.throwIfAborted();
  source=await createSource({specimens:['willow'],arrange:false,willowBark:{
   GeometryBatch:createWillowRootGeometryBatch(maps.height),createGeometry:options=>createWillowBarkGeometry(options,maps.height)}});
  lifetime.signal.throwIfAborted();
  if(!source?.group?.isGroup||source.specimens?.length!==1||source.specimens[0]?.userData.id!=='willow'||typeof source.dispose!=='function')throw new Error('Willow source factory contract changed.');
  lease=createWillowRootMaterialLease(source.group,maps);
  const materials=new Set();source.group.traverse(node=>{if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material?.isMeshStandardMaterial&&material.vertexColors)materials.add(material);});
  for(const material of materials)setWillowSampling(material,'centroid');
  lifetime.signal.throwIfAborted();preparing=false;
  const barkRecords=lease.bindings.map(({mesh})=>({name:mesh.name,branches:mesh.geometry.userData.branchRecords}));
  const diagnostics={...source.diagnostics,id:'garden-willow-root-source-r5',willowBark:{...willowBarkReliefSpec,colorResponse:willowBarkResponseSpec,geometryMatchesR1:false,rootRefinement:willowRootRefinementSpec,rootCharts:{id:'willow-root-metric-charts-r4',privateRootMaterial:true,allPBRChannels:true},maps:maps.diagnostics,records:barkRecords,
   preserved:['original upper trunk and all bough controls/geometry', 'all original six root directions; lower rounded volume is remeshed','all leaf and fine twig transforms','original willow layout and growth RNG','original wood RGB/finite bump and centroid safeguards'],nativeArtPassed:false}};
  Object.assign(source.specimens[0].userData,{barkRevision:willowBarkMaterialId,willowBarkGeometryChanged:true,willowRootRevision:willowRootRefinementSpec.id,leafGeometryChanged:false});
  return {group:source.group,specimens:source.specimens,views:source.views,diagnostics,
   get disposed(){return disposed;},dispose,async whenIdle(){if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Willow bark source cleanup failed.');}};
 }catch(error){
  preparing=false;try{dispose();}catch{/* aggregate below */}release();
  if(cleanupErrors.length)throw new AggregateError([error,...cleanupErrors],'Willow bark preparation and cleanup failed.',{cause:error});throw error;
 }
}
