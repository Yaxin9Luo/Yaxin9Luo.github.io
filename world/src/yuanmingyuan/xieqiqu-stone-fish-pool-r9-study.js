import * as THREE from 'three';
import {createXieqiquStoneFishPoolStudy,prepareXieqiquStoneFishMaterialPixels} from './xieqiqu-stone-fish-pool-study.js';
import {createStoneFishTriplanarMaterial,updateStoneFishMaterialFrame} from './xieqiqu-stone-fish-material-study.js';
import {createStoneFishCarvedWaveR9} from './xieqiqu-stone-fish-pool-r9-geometry.js';
import {stoneFishPoolR9StudyId} from './xieqiqu-stone-fish-pool-r9-views.js';
import {createXieqiquPoolWaterStudy} from './xieqiqu-pool-water-study.js';

export {prepareXieqiquStoneFishMaterialPixels};
export {stoneFishPoolR9StudyId,stoneFishPoolR9StudyViews} from './xieqiqu-stone-fish-pool-r9-views.js';
const check=(ok,message)=>{if(!ok)throw new Error('Stone fish pool R9: '+message);};
// Identical to the reviewed R4 material response; this candidate changes form.
const settings=Object.freeze({
  carved:Object.freeze({color:0xf1efe6,tileMetres:1.5,normalStrength:.12,roughnessRange:[.68,.86]}),
  wetFoot:Object.freeze({color:0xe0e1d9,tileMetres:1.5,normalStrength:.10,roughnessRange:[.34,.52]}),
  coping:Object.freeze({color:0xf1efe6,tileMetres:2.2,normalStrength:.085,roughnessRange:[.58,.76]}),
  poolWall:Object.freeze({color:0xe7e6dd,tileMetres:2.2,normalStrength:.095,roughnessRange:[.68,.86]}),
});

/** Explicit experimental owner. Consumes one fresh R1 pool, including its
 * unchanged source fish and original three 4K maps. It is not registered in
 * the museum or admitted as historically verified / visually accepted art. */
export function createXieqiquStoneFishPoolR9FromBase({baseOwner,signal}={}){
  check(baseOwner?.group?.isGroup&&!baseOwner.group.parent&&!baseOwner.disposed&&baseOwner.context?.mounts?.length===4&&baseOwner.seat&&baseOwner.textureOwner?.maps,'fresh unparented four-fish owner required');
  const group=baseOwner.group,geometryOwners=new Map(),materials=new Set(),retired=[],supports=[],materialBindings=[],originalPoolBuffers=[],originalWater=[],maps=baseOwner.textureOwner.maps;let disposed=false,waterOwner;
  const dispose=()=>{if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);const errors=[],run=fn=>{try{fn();}catch(error){errors.push(error);}};run(()=>waterOwner?.dispose());for(const value of materials){run(()=>value.dispose());value.map=value.normalMap=value.roughnessMap=null;}materials.clear();for(const owner of geometryOwners.values())run(()=>owner.dispose());geometryOwners.clear();run(()=>baseOwner.dispose());group.clear();retired.length=0;supports.length=0;materialBindings.length=0;originalPoolBuffers.length=0;originalWater.length=0;if(errors.length)throw new AggregateError(errors,'Stone fish pool R9 cleanup failed');};
  const material=role=>{const value=createStoneFishTriplanarMaterial({maps,...settings[role]});value.name='xieqiqu-pool-r9-'+role;value.userData={...value.userData,role,sourcePixels:'borrowed original three full 4K Marble021 maps',materialScaleAndWetResponse:'unchanged R4 authored study'};materials.add(value);return value;};
  const bind=(mesh,value,root)=>{mesh.material=value;mesh.castShadow=mesh.receiveShadow=true;mesh.onBeforeRender=(renderer,scene,camera,geometry,activeMaterial)=>updateStoneFishMaterialFrame(activeMaterial,root,camera);materialBindings.push({mesh,root});};
  try{
    signal?.throwIfAborted();const body=baseOwner.sourceOwner.group.children.find(n=>n.userData.body==='continuous-body').geometry;body.computeBoundingBox();const bodyMinimumY=body.boundingBox.min.y,coreByBottom=new Map(),pool=group.getObjectByName('xieqiqu-south-haitang-pool');
    for(const node of pool.children){if(!node.isMesh)continue;originalPoolBuffers.push({node,geometry:node.geometry,position:node.geometry.attributes.position.array,index:node.geometry.index?.array??null});if(node.material.userData.category==='water')originalWater.push({node,geometry:node.geometry});}
    for(const mount of baseOwner.context.mounts){
      signal?.throwIfAborted();const bottomY=(-.45-mount.placement.position[1])/mount.placement.size,waterY=(.13-mount.placement.position[1])/mount.placement.size,key=bottomY.toPrecision(16);
      let core=coreByBottom.get(key);if(!core){core=createStoneFishCarvedWaveR9({sourceGeometry:body,contactGeometry:baseOwner.seat.geometry,contactInfo:baseOwner.seat.diagnostics,bottomY,waterY,bodyMinimumY,worldScale:mount.placement.size});coreByBottom.set(key,core);geometryOwners.set(core.geometry,core);}
      for(const node of [...mount.plinth.children]){retired.push(node);mount.plinth.remove(node);}
      const carved=material('carved'),wet=material('wetFoot'),coreMesh=new THREE.Mesh(core.geometry,[carved,wet]);coreMesh.name=mount.group.name+'-carved-wave-body';coreMesh.userData={body:'closed-carved-wave-support-with-buried-rounded-neck',historicalCarvingVerified:false};bind(coreMesh,[carved,wet],mount.group);mount.plinth.add(coreMesh);supports.push({mount,core,coreMesh,crestMeshes:[]});
    }
    const rimMaterials={carving:material('coping'),oldStone:material('poolWall')};
    for(const node of pool.children){if(!node.isMesh)continue;const role=node.material.name==='xieqiqu-marble-cut-faces'?'carving':node.material.name==='xieqiqu-marble-recesses'?'oldStone':null;if(role)bind(node,rimMaterials[role],pool);}
    check(pool.children.some(n=>n.isMesh&&n.material===rimMaterials.carving)&&pool.children.some(n=>n.isMesh&&n.material===rimMaterials.oldStone),'original rim and pool wall not identified');
    waterOwner=createXieqiquPoolWaterStudy({context:baseOwner.context,signal});
    group.name=stoneFishPoolR9StudyId+'-study';group.userData={...group.userData,assetId:stoneFishPoolR9StudyId,visualAcceptance:false,historicalCarvingVerified:false};group.updateMatrixWorld(true);signal?.throwIfAborted();
    function validate(){
      check(!disposed,'disposed candidate');baseOwner.seat.validate();const contact=supports.map(s=>({index:s.mount.placement.index,scale:s.mount.placement.size,...s.core.validate()}));
      for(const before of originalPoolBuffers)check(before.node.geometry===before.geometry&&before.geometry.attributes.position.array===before.position&&(before.geometry.index?.array??null)===before.index,'original pool outline geometry replaced');
      for(const before of originalWater)check(before.node.geometry===before.geometry&&before.node.material.userData.studyId===waterOwner.diagnostics.id,'water study lost the original water geometry or expected material binding');
      check(!waterOwner.disposed,'water study was disposed independently');
      for(const {mesh} of materialBindings)for(const value of [].concat(mesh.material))check(value.map===maps.color&&value.normalMap===maps.normal&&value.roughnessMap===maps.roughness,'a context material stopped borrowing the original maps');
      check(retired.every(n=>n.parent===null),'retired box/column is still drawn');return {contact,minimumCrestClearance:Math.min(...[...coreByBottom.values()].map(c=>c.validate().minimumWaveClearance)),originalPoolGeometryReferences:true,originalWaterGeometryReferences:true,waterMaterialStudy:waterOwner.diagnostics.id,retiredNodesDrawn:0};
    }
    let triangles=0,meshCount=0;group.traverse(node=>{if(node.isMesh){triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*(node.isInstancedMesh?node.count:1);meshCount++;}});
    const diagnostics={...baseOwner.diagnostics,assetId:stoneFishPoolR9StudyId,triangles,triangleCount:triangles,meshCount,bounds:(()=>{const b=new THREE.Box3().setFromObject(group);return {min:b.min.toArray(),max:b.max.toArray()};})(),sourceR1Assembly:baseOwner.diagnostics,materialStudy:'original fish marble-r1 plus unchanged R4 support/rim settings; R9 geometry only',contextMaterials:structuredClone(settings),supportStudy:{historicalCarvingVerified:false,construction:'R8 rounded neck and hidden contact retained exactly; independently sampled asymmetric shallow rear crest replaces the rejected R7 sleeve; original submerged roots and waterline retained',uniqueWaveCoreGeometries:coreByBottom.size,sharedCrestGeometries:0,newMaterials:materials.size,newTextures:0,retiredSourceNodes:retired.length},waterStudy:waterOwner.diagnostics,resourceOwnership:{base:'owned exclusively; includes original six fish geometries and three marble textures',additionalSupportGeometry:geometryOwners.size,additionalSupportMaterials:materials.size,additionalTextures:0,allNewMaterialMaps:'borrowed from base texture owner',water:'separate owner; restored and disposed before support and base',retiredOriginalSupportResources:'owned by base, undrawn, released on disposal'},seat:{kind:'R8 smooth hidden closure and continuous neck with R9 shallow breaking crest',historicalFormVerified:false,retiredSourceCap:'original cap remains owned by base but is not drawn',contacts:supports.map(s=>({index:s.mount.placement.index,...s.core.validate()}))},bindings:baseOwner.diagnostics.bindings.map(binding=>({...binding,seatEmbedding:supports.find(s=>s.mount.placement.index===binding.index).core.validate().worldEmbedding,seatEmbeddingMethod:'full original body BVH vertical containment of R9 hidden closure'})),supportVariant:'r9',r9Validation:validate(),visualAcceptance:false,integrationAcceptance:false,archiveCompatible:false};
    signal?.addEventListener('abort',dispose,{once:true});
    return {group,diagnostics,baseOwner,supports,materialBindings,waterOwner,validate,update(time){if(!disposed){baseOwner.update(time);waterOwner.update(time);}},get disposed(){return disposed;},get invalidated(){return baseOwner.invalidated||waterOwner.invalidated;},dispose};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish pool R9 construction and cleanup failed',{cause:error});}throw error;}
}

export function createXieqiquStoneFishPoolR9Study({pixels,signal}={}){
  signal?.throwIfAborted();const baseOwner=createXieqiquStoneFishPoolStudy({pixels,signal});return createXieqiquStoneFishPoolR9FromBase({baseOwner,signal});
}
