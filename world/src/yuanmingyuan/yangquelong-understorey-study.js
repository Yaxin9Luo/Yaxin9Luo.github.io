import * as THREE from 'three';
import {extrudedPolygon} from './study-geometry.js';
import {loadSamplingSoilMaterial} from './yangquelong-soil-sampling.js';
import {yangquelongBedGroundSpec} from './yangquelong-bed-ground.js';
import {createYangquelongUnderstorey} from './yangquelong-understorey.js';

export const yangquelongUnderstoreyStudyViews=Object.freeze({
 bed:{label:'完整种植床 · Complete low planting bed',groups:[],direction:[-1,.62,.48],margin:1.06,framing:'complete-mesh-bounds'},
 community:{label:'同场体量、白花、淡紫花与细草 · Existing planted community',groups:[],direction:[-.35,.62,-1],margin:1.08,focusWindow:{x:[-15.8,-10.8],z:[5.3,9.4]}},
 flowers:{label:'同场白花冠与淡紫花序 · Existing ivory and lilac flowers',groups:[],direction:[-.12,.38,-1],margin:1.12,focusKinds:['ivory-pocket-0','lilac-pocket-0'],focusSources:['ivory','lilac'],focusBodies:['individual-five-curved-petals','actual-calyx-filaments-and-anthers'],requiredSources:['ivory','lilac']},
 bedtop:{label:'完整床形与松根留白 · Bed and root clearing',groups:[],direction:[-.06,1,.12],margin:1.06,framing:'complete-mesh-bounds'},
});
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong understorey bed study: '+message);};
/** A complete west-south bed component, using the same octagon and original
 * 4K soil lease with the accepted R3 sampling. The neutral rim is context, not a new architecture material
 * approval. This prepares no pine, building, water or complete garden factory.
 */
export async function prepareYangquelongUnderstoreyStudy({
 signal,bedId='west-south',createUnderstorey=createYangquelongUnderstorey,
 loadSoil=loadSamplingSoilMaterial,
}={}){
 signal?.throwIfAborted();const bed=yangquelongBedGroundSpec.beds.find(b=>b.id===bedId);fail(bed,'known bed required');
 const group=new THREE.Group();group.name='yangquelong-understorey-bed-study-r5';
 group.userData={assetId:'yangquelong-understorey-bed-r5',evidence:'contemporary-museum-garden-design',nativeReviewed:false};
 const controller=new AbortController(),geometries=[],errors=[],released=new Set();let soil,plants,rimMaterial,disposed=false;
 const remember=e=>{if(!errors.includes(e))errors.push(e);};
 const release=owner=>{if(!owner||released.has(owner))return;released.add(owner);try{owner.dispose();}catch(e){remember(e);}};
 function releaseAll(){
  release(plants);try{group.removeFromParent();group.clear();}catch(e){remember(e);}
  for(const g of geometries)release(g);release(rimMaterial);release(soil);
 }
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);releaseAll();controller.abort(signal?.reason);if(errors.length)throw new AggregateError([...errors],'Understorey bed cleanup failed');}
 function cancel(){try{dispose();}catch{/* whenIdle exposes all cleanup errors */}}
 function guard(){signal?.throwIfAborted();controller.signal.throwIfAborted();fail(!disposed,'study disposed');}
 async function whenIdle(){for(const owner of [plants,soil])try{await owner?.whenIdle?.();}catch(e){remember(e);}if(errors.length)throw new AggregateError([...errors],'Understorey bed cleanup failed');}
 function assertCurrent(){guard();plants.assertCurrent();fail(!soil.disposed&&plants.group.parent===group,'source/soil or plant attachment changed');return true;}
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  soil=await loadSoil({signal:controller.signal});guard();
  fail(soil?.material?.isMeshStandardMaterial&&typeof soil.dispose==='function'&&!soil.disposed,'exclusive original soil lease required');
  plants=createUnderstorey({signal:controller.signal,bedIds:[bedId]});guard();
  const s=yangquelongBedGroundSpec;
  const ground=extrudedPolygon(bed.inner,s.soilBottom,s.soilTop),rim=extrudedPolygon(bed.outer,s.edgingBottom,s.edgingTop,[bed.inner]);geometries.push(ground,rim);
  const soilMesh=new THREE.Mesh(ground,soil.material);soilMesh.name='understorey-study-original-soil';soilMesh.castShadow=soilMesh.receiveShadow=true;
  rimMaterial=new THREE.MeshStandardMaterial({name:'understorey-study-neutral-context-rim',color:'#cccac0',roughness:.82});
  rimMaterial.userData={contextOnly:true,originalArchitectureMaterial:false};
  const rimMesh=new THREE.Mesh(rim,rimMaterial);rimMesh.name='understorey-study-context-rim';rimMesh.castShadow=rimMesh.receiveShadow=true;
  group.add(soilMesh,rimMesh,plants.group);group.updateMatrixWorld(true);assertCurrent();
  const contextTriangles=[ground,rim].reduce((n,g)=>n+(g.index?.count??g.attributes.position.count)/3,0);
  const diagnostics={id:'yangquelong-understorey-bed-r5',assetId:'yangquelong-understorey-bed-r5',bedId,nativeReviewed:false,evidence:group.userData.evidence,
   plants:plants.diagnostics,meshCount:plants.diagnostics.meshes+2,triangleCount:plants.diagnostics.triangleCount+contextTriangles,
   sourceSoil:soil.diagnostics,rootClearanceOnly:true,pineFactoryCalls:0,architectureFactoryCalls:0,waterFactoryCalls:0,
   limitations:['Root empty space is checked against saved real pine roots; this component view contains no pine.','Neutral context rim does not replace the accepted stone in a complete garden.','A native component pass does not imply full garden art acceptance.'],
  };diagnostics.triangles=diagnostics.triangleCount;
  return {group,diagnostics,views:yangquelongUnderstoreyStudyViews,understoreyOwner:plants,soilOwner:soil,assertCurrent,
   update(){try{return assertCurrent();}catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Bed validation and cleanup failed',{cause:error});}throw error;}},
   dispose,whenIdle,get disposed(){return disposed;},
  };
 }catch(error){try{dispose();}catch{/* retained */}releaseAll();try{await whenIdle();}catch{/* retained */}
  if(errors.length)throw new AggregateError([error,...errors],'Understorey bed preparation and cleanup failed',{cause:error});throw error;
 }
}
export async function prepareYangquelongUnderstoreyStudyFactory(options={}){
 const owner=await prepareYangquelongUnderstoreyStudy(options);let consumed=false,discarded=false;
 const factory=()=>{options.signal?.throwIfAborted();fail(!consumed&&!discarded,'prepared factory consumed or discarded');owner.assertCurrent();consumed=true;return owner;};
 factory.dispose=()=>{if(consumed||discarded)return;discarded=true;owner.dispose();};factory.whenIdle=()=>owner.whenIdle();return factory;
}
