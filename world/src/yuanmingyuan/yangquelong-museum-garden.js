import {Group,Mesh,Matrix4,Quaternion,Vector3} from 'three';
import {bindYangquelongMuseumWater} from './yangquelong-museum-water.js';

const defaultGarden=async options=>(await import('./yangquelong-refined-garden.js')).prepareYangquelongRefinedGarden(options);
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong museum: '+message);};
const materials=mesh=>[].concat(mesh.material);
const sameMatrix=(a,b)=>a.elements.every((value,i)=>Number.isFinite(value)&&Math.abs(value-b.elements[i])<1e-7);
const identity=new Matrix4(),unit=new Vector3(1,1,1),quaternion=new Quaternion();

// Only static source architecture and the actual four trunk/root meshes enter
// the existing triangle support. These detached Object3D views borrow buffers;
// no foliage, new collision box, material or geometry is made.
function navigationView(source){
 const garden=source.gardenOwner,surface=garden?.surfaceOwner,roots=garden?.plantingOwner?.roots;
 fail(surface?.group?.isObject3D&&roots?.length===4,'complete surface and four original pine roots required');
 const group=new Group();group.name='yangquelong-museum-navigation';
 const records=[],inverse=new Matrix4(),relative=new Matrix4();
 source.group.updateWorldMatrix(true,true);inverse.copy(source.group.matrixWorld).invert();
 const include=mesh=>mesh.isMesh&&mesh.visible&&mesh.userData.navigation!==false&&materials(mesh).every(m=>m?.isMaterial&&!m.transparent&&m.userData?.category!=='water');
 function add(mesh){
  fail(!mesh.isInstancedMesh&&!mesh.isSkinnedMesh&&mesh.geometry?.attributes.position,'static architecture / trunk triangles required: '+mesh.name);
  const view=new Mesh(mesh.geometry,mesh.material);view.name=mesh.name;view.userData={...mesh.userData};
  view.matrixAutoUpdate=false;view.matrix.multiplyMatrices(inverse,mesh.matrixWorld);group.add(view);
  records.push({mesh,view,geometry:mesh.geometry,materials:materials(mesh),matrix:view.matrix.clone(),
   attributes:Object.values(mesh.geometry.attributes).concat(mesh.geometry.index??[]).map(attribute=>({attribute,array:attribute.array,version:attribute.version})),
   drawRange:{...mesh.geometry.drawRange}});
 }
 surface.group.traverse(mesh=>{if(include(mesh))add(mesh);});
 const architectureMeshes=records.length;fail(architectureMeshes>0,'actual architectural support required');
 for(const root of roots){
  const found=[];root.traverse(mesh=>{if(mesh.isMesh&&mesh.name==='pine-r3-trunk-and-roots')found.push(mesh);});
  fail(found.length===1&&include(found[0]),'one original trunk/root mesh per pine required');
  add(found[0]);
 }
 const check=()=>{
  fail(group.children.length===records.length,'navigation view hierarchy changed');
  source.group.updateWorldMatrix(true,true);inverse.copy(source.group.matrixWorld).invert();
  for(const r of records){
   const m=r.mesh;let ancestor=m;while(ancestor&&ancestor!==source.group)ancestor=ancestor.parent;
   fail(ancestor===source.group&&r.view.matrixAutoUpdate===false,'navigation source left its original garden');relative.multiplyMatrices(inverse,m.matrixWorld);
   fail(m.geometry===r.geometry&&m.visible&&m.userData.navigation!==false&&sameMatrix(relative,r.matrix)&&r.view.parent===group&&sameMatrix(r.view.matrix,r.matrix),'navigation source transform or binding changed: '+m.name);
   fail(materials(m).length===r.materials.length&&materials(m).every((v,i)=>v===r.materials[i]&&!v.transparent)&&r.view.geometry===r.geometry&&r.view.material===m.material,'navigation material changed: '+m.name);
   const attributes=Object.values(m.geometry.attributes).concat(m.geometry.index??[]);
   fail(attributes.length===r.attributes.length&&attributes.every((v,i)=>v===r.attributes[i].attribute&&v.array===r.attributes[i].array&&v.version===r.attributes[i].version)&&m.geometry.drawRange.start===r.drawRange.start&&m.geometry.drawRange.count===r.drawRange.count,'navigation geometry changed: '+m.name);
  }
  return true;
 };
 return {group,check,diagnostics:{architectureMeshes,pineTrunkMeshes:4,meshCount:records.length,geometryAndMaterials:'borrowed original static geometry and materials',foliageMeshes:0,sourceMeshNames:records.map(r=>r.mesh.name)},
  dispose(){group.removeFromParent();group.clear();records.length=0;}};
}

/** The museum owns one prepared full garden. Only this outer root is placed in
 * world coordinates; the original garden identity and research metadata stay
 * untouched. A visit borrows this owner from the existing persistent ensemble.
 * prepareGarden is the existing owner seam, including for bounded CPU tests.
 */
export async function prepareYangquelongMuseumGarden({signal,prepareGarden=defaultGarden,beforeDispose}={}){
 signal?.throwIfAborted();fail(typeof prepareGarden==='function'&&(beforeDispose===undefined||typeof beforeDispose==='function'),'prepared garden loader and optional synchronous dependent release required');
 const controller=new AbortController(),group=new Group(),leases=new Set(),errors=[],released=new Set();
 group.name='yangquelong-museum-garden';group.userData={assetId:'yangquelong',entryId:'yangquelong',evidence:'contemporary-museum-garden-design',historicallySurveyed:false};
 let source,navigation,disposed=false;
 const remember=error=>{if(!errors.includes(error))errors.push(error);};
 const attempt=fn=>{try{fn();}catch(error){remember(error);}};
 const releaseSource=()=>{if(source&&!released.has(source)){released.add(source);attempt(()=>source.dispose());}};
 function releaseAll(){
  for(const restore of [...leases])attempt(restore);
  if(navigation&&!released.has(navigation)){released.add(navigation);attempt(()=>navigation.dispose());}
  attempt(()=>group.removeFromParent());attempt(()=>group.clear());releaseSource();
 }
 const cleanupError=()=>errors.length?new AggregateError([...errors],'Yangquelong museum cleanup failed'):null;
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);
  // An outer composition closes its borrowed guide/support queries first,
  // including when this adapter detects its own navigation guard failure.
  attempt(()=>beforeDispose?.());releaseAll();controller.abort(signal?.reason);const error=cleanupError();if(error)throw error;
 }
 function cancel(){try{dispose();}catch{/* whenIdle/preparation expose every cleanup error. */}}
 async function whenIdle(){try{await source?.whenIdle?.();}catch(error){remember(error);}const error=cleanupError();if(error)throw error;}
 function guard(){
  signal?.throwIfAborted();controller.signal.throwIfAborted();fail(!disposed,'owner disposed');
  fail(source?.group?.parent===group&&source.group.position.lengthSq()===0&&source.group.quaternion.equals(quaternion)&&source.group.scale.equals(unit),'inner garden identity must remain unchanged');
  group.updateWorldMatrix(true,true);
  const e=group.matrixWorld.elements;
  fail(e.every(Number.isFinite)&&Math.abs(e[1])<1e-7&&Math.abs(e[4])<1e-7&&Math.abs(e[5]-1)<1e-7&&Math.abs(e[6])<1e-7&&Math.abs(e[9])<1e-7&&Math.abs(new Vector3().setFromMatrixScale(group.matrixWorld).distanceTo(unit))<1e-7&&Math.abs(group.matrixWorld.determinant()-1)<1e-7,'world placement must retain unit scale and upright Y rotation');
  navigation.group.updateWorldMatrix(true,true);
  fail(sameMatrix(group.matrixWorld,navigation.group.matrixWorld),'render/navigation roots must share the placed world transform');
  navigation.check();source.assertCurrent();return true;
 }
 function failed(error){try{dispose();}catch{/* accumulated below */}if(errors.length)throw new AggregateError([error,...errors],'Yangquelong museum operation and cleanup failed',{cause:error});throw error;}
 function assertCurrent(){try{return guard();}catch(error){return failed(error);}}
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  source=await prepareGarden({signal:controller.signal});signal?.throwIfAborted();controller.signal.throwIfAborted();
  fail(source?.group?.isGroup&&!source.group.parent&&!source.disposed&&typeof source.assertCurrent==='function'&&typeof source.update==='function'&&typeof source.dispose==='function','live unattached complete garden owner required');
  fail(source.diagnostics?.id==='yangquelong-refined-garden-r3','reviewed refined garden source identity required');
  source.group.updateMatrix();fail(sameMatrix(source.group.matrix,identity),'original local garden coordinate frame required');
  source.assertCurrent();navigation=navigationView(source);group.add(source.group);assertCurrent();
  const diagnostics={assetId:'yangquelong',id:'yangquelong-museum-garden-r1',source:source.diagnostics,
   meshCount:source.diagnostics.meshCount,triangleCount:source.diagnostics.triangleCount,triangles:source.diagnostics.triangleCount,
   waterCount:source.diagnostics.waterCount,navigation:navigation.diagnostics,
   timeLayer:'historical-architecture-with-contemporary-museum-garden',nativeMuseumAccepted:false,
   ownership:{source:'one owned complete refined garden',placement:'outer render root and detached navigation root; inner source identity retained',water:'borrowed replacement sheets; reversible source visibility/navigation lease',updates:'one complete source update per composition update',releaseOrder:['outer borrowed dependents','source water leases','borrowed navigation views','complete source','private abort']},
  };
  const owner={group,collisionGroup:navigation.group,namedGroupRoot:group,sourceOwner:source,diagnostics,assertCurrent,dispose,whenIdle,
   update(time){if(disposed)return;assertCurrent();try{source.update(time);}catch(error){failed(error);}},
   bindWater({site,terrain,water}){
    assertCurrent();const unbind=bindYangquelongMuseumWater(site,{owner,terrain,water});let closed=false;
    const restore=()=>{if(closed)return;closed=true;leases.delete(restore);unbind();};leases.add(restore);return restore;
   },
   get disposed(){return disposed;},get cleanupError(){return cleanupError();}};
  return owner;
 }catch(error){
  try{dispose();}catch{/* accumulated */}releaseAll();try{await whenIdle();}catch{/* accumulated */}
  if(errors.length)throw new AggregateError([error,...errors],'Yangquelong museum preparation and cleanup failed',{cause:error});throw error;
 }
}
