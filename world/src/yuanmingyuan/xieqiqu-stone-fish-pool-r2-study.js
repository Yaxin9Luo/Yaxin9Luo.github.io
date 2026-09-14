import * as THREE from 'three';
import {createXieqiquStoneFishPoolStudy,prepareXieqiquStoneFishMaterialPixels} from './xieqiqu-stone-fish-pool-study.js';
import {createStoneFishTriplanarMaterial,updateStoneFishMaterialFrame} from './xieqiqu-stone-fish-material-study.js';
import {createStoneFishCarvedWaveGeometry,createStoneFishRolledWaveCrests} from './xieqiqu-stone-fish-pool-r2-geometry.js';
import {createStoneFishCarvedWaveR3} from './xieqiqu-stone-fish-pool-r3-geometry.js';
import {stoneFishPoolR3StudyId} from './xieqiqu-stone-fish-pool-r3-views.js';
import {createStoneFishCarvedWaveR4} from './xieqiqu-stone-fish-pool-r4-geometry.js';
import {stoneFishPoolR4StudyId} from './xieqiqu-stone-fish-pool-r4-views.js';
import {stoneFishPoolR2StudyId} from './xieqiqu-stone-fish-pool-r2-views.js';
import {createXieqiquPoolWaterStudy} from './xieqiqu-pool-water-study.js';

export {prepareXieqiquStoneFishMaterialPixels};
export {stoneFishPoolR4StudyId,stoneFishPoolR4StudyViews} from './xieqiqu-stone-fish-pool-r4-views.js';
export {stoneFishPoolR3StudyId,stoneFishPoolR3StudyViews} from './xieqiqu-stone-fish-pool-r3-views.js';
export {stoneFishPoolR2StudyId,stoneFishPoolR2StudyViews} from './xieqiqu-stone-fish-pool-r2-views.js';
const check=(ok,message)=>{if(!ok)throw new Error('Stone fish pool R2: '+message);};
const settings=Object.freeze({
  carved:Object.freeze({color:0xf1efe6,tileMetres:1.5,normalStrength:.12,roughnessRange:[.68,.86]}),
  wetFoot:Object.freeze({color:0xe0e1d9,tileMetres:1.5,normalStrength:.10,roughnessRange:[.34,.52]}),
  coping:Object.freeze({color:0xf1efe6,tileMetres:2.2,normalStrength:.085,roughnessRange:[.58,.76]}),
  poolWall:Object.freeze({color:0xe7e6dd,tileMetres:2.2,normalStrength:.095,roughnessRange:[.68,.86]}),
});

/** Consumes a fresh, unparented R1 owner exclusively. No foreign scene group
 * is mutated, and the underlying R1 factory/default whole study stays intact.
 * The old support meshes become undrawn owned resources until base disposal;
 * neither a hidden duplicate fish nor another texture set is constructed. */
export function createXieqiquStoneFishPoolR2FromBase({baseOwner,signal,supportVariant='r2'}={}){
  check(baseOwner?.group?.isGroup&&!baseOwner.group.parent&&!baseOwner.disposed&&baseOwner.context?.mounts?.length===4&&baseOwner.seat&&baseOwner.textureOwner?.maps,'fresh unparented four-fish owner required');
  check(supportVariant==='r2'||supportVariant==='r3'||supportVariant==='r4','unknown support variant');
  const joined=supportVariant!=='r2',studyId=supportVariant==='r4'?stoneFishPoolR4StudyId:joined?stoneFishPoolR3StudyId:stoneFishPoolR2StudyId,geometryOwners=new Map();
  const group=baseOwner.group,geometries=new Set(),materials=new Set(),retired=[],supports=[],materialBindings=[],originalPoolBuffers=[],originalWater=[],maps=baseOwner.textureOwner.maps;let disposed=false,waterOwner;
  const dispose=()=>{if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);const errors=[],run=fn=>{try{fn();}catch(error){errors.push(error);}};run(()=>waterOwner?.dispose());for(const material of materials){run(()=>material.dispose());material.map=material.normalMap=material.roughnessMap=null;}materials.clear();for(const geometry of geometries)run(()=>{const owner=geometryOwners.get(geometry);if(owner)owner.dispose();else geometry.dispose();});geometries.clear();geometryOwners.clear();run(()=>baseOwner.dispose());group.clear();retired.length=0;supports.length=0;materialBindings.length=0;originalPoolBuffers.length=0;originalWater.length=0;if(errors.length)throw new AggregateError(errors,'Stone fish pool R2 cleanup failed');};
  const material=(role)=>{const value=createStoneFishTriplanarMaterial({maps,...settings[role]});value.name='xieqiqu-pool-'+supportVariant+'-'+role;value.userData={...value.userData,role,sourcePixels:'borrowed original three full 4K Marble021 maps',materialScaleAndWetResponse:'authored study'};materials.add(value);return value;};
  const bind=(mesh,value,root)=>{mesh.material=value;mesh.castShadow=mesh.receiveShadow=true;mesh.onBeforeRender=(renderer,scene,camera,geometry,activeMaterial)=>updateStoneFishMaterialFrame(activeMaterial,root,camera);materialBindings.push({mesh,root});};
  try{
    signal?.throwIfAborted();const body=baseOwner.sourceOwner.group.children.find(n=>n.userData.body==='continuous-body').geometry;body.computeBoundingBox();const bodyMinimumY=body.boundingBox.min.y,crests=joined?[]:createStoneFishRolledWaveCrests(bodyMinimumY);crests.forEach(g=>geometries.add(g));
    const coreByBottom=new Map(),pool=group.getObjectByName('xieqiqu-south-haitang-pool');
    for(const node of pool.children){if(!node.isMesh)continue;originalPoolBuffers.push({node,geometry:node.geometry,position:node.geometry.attributes.position.array,index:node.geometry.index?.array??null});if(node.material.userData.category==='water')originalWater.push({node,material:node.material,geometry:node.geometry});}
    for(const mount of baseOwner.context.mounts){
      signal?.throwIfAborted();const bottomY=(-.45-mount.placement.position[1])/mount.placement.size,waterY=(.13-mount.placement.position[1])/mount.placement.size,key=bottomY.toPrecision(16);
      let core=coreByBottom.get(key);if(!core){core=(supportVariant==='r4'?createStoneFishCarvedWaveR4:joined?createStoneFishCarvedWaveR3:createStoneFishCarvedWaveGeometry)({contactGeometry:baseOwner.seat.geometry,contactInfo:baseOwner.seat.diagnostics,bottomY,waterY,bodyMinimumY,...(joined?{worldScale:mount.placement.size}:{})});coreByBottom.set(key,core);geometries.add(core.geometry);if(joined)geometryOwners.set(core.geometry,core);}
      // Remove the R1 column, compressed waves and box as complete nodes. The
      // original context still owns and releases their resources exactly once.
      for(const node of [...mount.plinth.children]){retired.push(node);mount.plinth.remove(node);}
      const carved=material('carved'),wet=material('wetFoot'),coreMesh=new THREE.Mesh(core.geometry,[carved,wet]);coreMesh.name=mount.group.name+'-carved-wave-body';coreMesh.userData={body:'closed-carved-wave-support-with-original-belly-contact',historicalCarvingVerified:false};bind(coreMesh,[carved,wet],mount.group);mount.plinth.add(coreMesh);
      for(const [i,geometry] of crests.entries()){const mesh=new THREE.Mesh(geometry,carved);mesh.name=mount.group.name+'-rolled-wave-'+(i+1);mesh.userData={...geometry.userData,geometryOwnership:'shared within this R2 owner'};bind(mesh,carved,mount.group);mount.plinth.add(mesh);}
      supports.push({mount,core,coreMesh,crestMeshes:mount.plinth.children.slice(1)});
    }
    const rimMaterials={carving:material('coping'),oldStone:material('poolWall')};
    for(const node of pool.children){if(!node.isMesh)continue;const role=node.material.name==='xieqiqu-marble-cut-faces'?'carving':node.material.name==='xieqiqu-marble-recesses'?'oldStone':null;if(role)bind(node,rimMaterials[role],pool);}
    check(pool.children.some(n=>n.isMesh&&n.material===rimMaterials.carving)&&pool.children.some(n=>n.isMesh&&n.material===rimMaterials.oldStone),'original rim and pool wall not identified');
    waterOwner=createXieqiquPoolWaterStudy({context:baseOwner.context,signal});
    group.name=studyId+'-study';group.userData={...group.userData,assetId:studyId,visualAcceptance:false,historicalCarvingVerified:false};group.updateMatrixWorld(true);signal?.throwIfAborted();
    function validate(){
      check(!disposed,'disposed candidate');baseOwner.seat.validate();const contact=supports.map(s=>({index:s.mount.placement.index,scale:s.mount.placement.size,...s.core.validate()}));
      for(const before of originalPoolBuffers)check(before.node.geometry===before.geometry&&before.geometry.attributes.position.array===before.position&&(before.geometry.index?.array??null)===before.index,'original pool outline geometry replaced');
      for(const before of originalWater)check(before.node.geometry===before.geometry&&before.node.material.userData.studyId===waterOwner.diagnostics.id,'water study lost the original water geometry or expected material binding');
      check(!waterOwner.disposed,'water study was disposed independently');
      for(const crest of crests)check(crest.boundingBox.max.y<bodyMinimumY-.012,'rolled wave lost body clearance');
      for(const {mesh} of materialBindings)for(const m of [].concat(mesh.material))check(m.map===maps.color&&m.normalMap===maps.normal&&m.roughnessMap===maps.roughness,'a context material stopped borrowing the original maps');
      check(retired.every(n=>n.parent===null),'retired box/column is still drawn');return {contact,minimumCrestClearance:supportVariant==='r4'?Math.min(...[...coreByBottom.values()].map(c=>c.validate().minimumWaveClearance)):bodyMinimumY-Math.max(...(joined?[...coreByBottom.values()].map(c=>c.diagnostics.maximumWaveY):crests.map(g=>g.boundingBox.max.y))),originalPoolGeometryReferences:true,originalWaterGeometryReferences:true,waterMaterialStudy:waterOwner.diagnostics.id,retiredNodesDrawn:0};
    }
    let triangles=0,meshCount=0;group.traverse(node=>{if(node.isMesh){triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*(node.isInstancedMesh?node.count:1);meshCount++;}});
    const diagnostics={...baseOwner.diagnostics,assetId:studyId,triangles,triangleCount:triangles,meshCount,bounds:(()=>{const b=new THREE.Box3().setFromObject(group);return {min:b.min.toArray(),max:b.max.toArray()};})(),sourceR1Assembly:baseOwner.diagnostics,materialStudy:supportVariant==='r4'?'original fish marble-r1 plus unchanged R2 support/rim settings; R4 geometry only':joined?'original fish marble-r1 plus unchanged R2 support/rim settings; R3 geometry only':'original fish marble-r1 plus authored R2 support/rim settings',contextMaterials:structuredClone(settings),supportStudy:{historicalCarvingVerified:false,construction:supportVariant==='r4'?'unchanged real belly cap and floor; three unequal full-height wave sections fused into one closed support per fish':joined?'unchanged real belly cap; five rolled waves share actual root boundaries with one closed support per fish':'unchanged real belly cap, closed curved wave cores and six thick rolled crests per fish',uniqueWaveCoreGeometries:coreByBottom.size,sharedCrestGeometries:crests.length,newMaterials:materials.size,newTextures:0,retiredSourceNodes:retired.length},waterStudy:waterOwner.diagnostics,resourceOwnership:{base:'owned exclusively; includes original six fish geometries and three marble textures',additionalSupportGeometry:geometries.size,additionalSupportMaterials:materials.size,additionalTextures:0,allNewMaterialMaps:'borrowed from base texture owner',water:'separate owner; restored and disposed before support and base',retiredOriginalSupportResources:'owned by base, undrawn, released on disposal'},...(supportVariant==='r4'?{supportVariant:'r4',r4Validation:validate()}:joined?{supportVariant:'r3',r3Validation:validate()}:{r2Validation:validate()}),visualAcceptance:false,integrationAcceptance:false,archiveCompatible:false};
    signal?.addEventListener('abort',dispose,{once:true});
    return {group,diagnostics,baseOwner,supports,materialBindings,waterOwner,validate,update(time){if(!disposed){baseOwner.update(time);waterOwner.update(time);}},get disposed(){return disposed;},get invalidated(){return baseOwner.invalidated||waterOwner.invalidated;},dispose};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish pool R2 construction and cleanup failed',{cause:error});}throw error;}
}

export function createXieqiquStoneFishPoolR2Study({pixels,signal,supportVariant='r2'}={}){
  check(supportVariant==='r2'||supportVariant==='r3'||supportVariant==='r4','unknown support variant');
  signal?.throwIfAborted();const baseOwner=createXieqiquStoneFishPoolStudy({pixels,signal});return createXieqiquStoneFishPoolR2FromBase({baseOwner,signal,supportVariant});
}

/** Explicit opt-in only; the established R2 entry retains its default. */
export function createXieqiquStoneFishPoolR3Study(options={}){return createXieqiquStoneFishPoolR2Study({...options,supportVariant:'r3'});}

/** R4 is a separate geometry candidate. R2 and R3 retain their own entries. */
export function createXieqiquStoneFishPoolR4Study(options={}){return createXieqiquStoneFishPoolR2Study({...options,supportVariant:'r4'});}
