import * as THREE from 'three';
import {createXieqiquStudy,xieqiquStoneFishPlacements} from './xieqiqu-study.js';
import {stoneFishMouth} from './xieqiqu-fish-surface.js';
import {createXieqiquStoneFishPoolR9Study,prepareXieqiquStoneFishMaterialPixels} from './xieqiqu-stone-fish-pool-r9-study.js';

export {prepareXieqiquStoneFishMaterialPixels};
export const xieqiquR9FishIntegrationId='xieqiqu-r9-fish-integration-r1';
const check=(condition,message)=>{if(!condition)throw new Error('Xieqiqu R9 integration: '+message);};
const close=(a,b,tolerance=1e-11)=>a.length===b.length&&a.every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[i])<=tolerance);
const direct=(parent,name)=>{const matches=parent.children.filter(n=>n.name===name);check(matches.length===1,'expected one direct '+name);return matches[0];};
const allNamed=(group,name)=>{const found=[];group.traverse(n=>{if(n.name===name)found.push(n);});return found;};
const identity=new THREE.Matrix4();
const count=group=>{let triangles=0,meshCount=0;group.traverse(n=>{if(n.isMesh){meshCount++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3*(n.isInstancedMesh?n.count:1);}});const bounds=new THREE.Box3().setFromObject(group);return {triangles,triangleCount:triangles,meshCount,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};};

/** Both owners must be fresh and unparented. Ownership transfers only after
 * successful return. A failed transaction restores both scene graphs and
 * leaves the input owners alive for the caller to release or retry.
 * This review adapter is deliberately absent from shared registration. */
export function createXieqiquR9FishIntegrationFromOwners({buildingOwner,poolOwner,signal}={}){
  signal?.throwIfAborted();
  const group=buildingOwner?.group;
  check(group?.isGroup&&group.name==='xieqiqu-complete-group-study'&&!group.parent&&group.children.length>0&&typeof buildingOwner.update==='function'&&typeof buildingOwner.dispose==='function','fresh complete original Xieqiqu owner required');
  check(!group.userData.r9FishReplacement,'building already has an R9 replacement');
  check(poolOwner?.group?.isGroup&&!poolOwner.group.parent&&!poolOwner.disposed&&poolOwner.diagnostics?.supportVariant==='r9'&&poolOwner.diagnostics.fullResolutionVerified===true&&poolOwner.baseOwner?.context?.mounts?.length===4&&poolOwner.supports?.length===4,'fresh complete R9 four-fish pool owner required');
  check(poolOwner.group!==group,'building owner is not a pool owner');
  const fountain=direct(group,'xieqiqu-south-fountain'),animals=direct(fountain,'south-fountain-animal-sculptures'),pool=direct(fountain,'xieqiqu-south-haitang-pool');
  group.updateMatrixWorld(true);poolOwner.group.updateMatrixWorld(true);
  for(const node of [fountain,animals]){node.updateMatrix();check(close(node.matrix.elements,identity.elements),'target anchor parent has a noncanonical local transform: '+node.name);}
  const poolSourceContext=poolOwner.baseOwner.context,records=[],snapshots=new Map([[animals,[...animals.children]]]),sourceMeshes=new Map(),preservedNodes=new Set();
  for(const placement of xieqiquStoneFishPlacements){
    const name='xieqiqu-south-upturned-stone-fish-'+placement.index,old=direct(animals,name),mounts=poolSourceContext.mounts.filter(m=>m.group.name===name);
    check(allNamed(group,name).length===1&&mounts.length===1,'ambiguous fish slot '+name);
    const mount=mounts[0],next=mount.group,support=poolOwner.supports.find(s=>s.mount===mount),fishView=poolOwner.baseOwner.fishViews[poolSourceContext.mounts.indexOf(mount)];
    check(support&&fishView&&next.parent,'complete mount, support and fish view required');
    const expected=new THREE.Matrix4().compose(new THREE.Vector3(...placement.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),placement.rotationY),new THREE.Vector3().setScalar(placement.size));
    old.updateMatrix();next.updateMatrix();
    check(close(old.matrix.elements,expected.elements),'original slot matrix drift: '+name);
    check(close(next.matrix.elements,expected.elements),'replacement local matrix drift: '+name);
    check(next.children.includes(mount.body)&&next.children.includes(mount.plinth)&&next.children.includes(mount.flow),'move the complete body / support / water mount');
    const supportBindings=poolOwner.materialBindings.filter(b=>b.mesh===support.coreMesh);check(supportBindings.length===1&&supportBindings.every(b=>b.root===next),'support material root must be its mounted fish group');
    if(!snapshots.has(next.parent))snapshots.set(next.parent,[...next.parent.children]);
    records.push({index:placement.index,placement,name,old,next,mount,support,fishView,sourceParent:next.parent,oldSiblingIndex:animals.children.indexOf(old),matrix:expected.elements.slice()});
  }
  const retiredSet=new Set();for(const r of records)r.old.traverse(n=>retiredSet.add(n));
  group.traverse(n=>{if(retiredSet.has(n))return;preservedNodes.add(n);if(n.isMesh)sourceMeshes.set(n,{geometry:n.geometry,material:n.material,parent:n.parent,matrix:n.matrix.elements.slice()});});
  const historicalUserData=group.userData.r9FishReplacement,previousCounts=count(group),replacementByOld=new Map(records.map(r=>[r.old,r.next]));let disposed=false,committed=false;
  const restore=()=>{
    for(const r of records)if(r.next.parent===animals)animals.remove(r.next);
    for(const [parent,children] of snapshots){for(const node of children)if(node.parent!==parent)parent.add(node);check(parent.children.length===children.length,'rollback parent membership changed');parent.children.splice(0,parent.children.length,...children);}
    if(historicalUserData===undefined)delete group.userData.r9FishReplacement;else group.userData.r9FishReplacement=historicalUserData;
    group.updateMatrixWorld(true);poolOwner.group.updateMatrixWorld(true);
  };
  const validate=()=>{
    check(!disposed,'disposed adapter');group.updateMatrixWorld(true);
    const actual=new Set(),named=new Map(['xieqiqu-south-haitang-pool','xieqiqu-south-pool-cropped-court',...records.map(r=>r.name)].map(name=>[name,[]]));
    group.traverse(n=>{actual.add(n);named.get(n.name)?.push(n);});
    for(const n of preservedNodes)check(actual.has(n),'original nonfish node left the full building: '+n.name);
    for(const [node,before] of sourceMeshes)check(node.geometry===before.geometry&&node.material===before.material&&node.parent===before.parent&&close(node.matrix.elements,before.matrix),'original nonfish geometry/material/parent/local matrix changed: '+node.name);
    check(named.get('xieqiqu-south-haitang-pool').length===1&&named.get('xieqiqu-south-pool-cropped-court').length===0,'duplicated review basin or cropped court');
    const frameInverse=group.matrixWorld.clone().invert(),bindings=[];
    for(const r of records){
      const matches=named.get(r.name);
      check(r.next.parent===animals&&r.old.parent===null&&matches.length===1&&matches[0]===r.next,'replacement slot count or ownership changed: '+r.name);
      check(close(r.next.matrix.elements,r.matrix),'replacement canonical local matrix changed: '+r.name);
      const endpoint=poolSourceContext.diagnostics.waterEndpoints.find(e=>e.id===r.name+'-jet');
      check(endpoint,'original source jet metadata missing');
      const mouth=new THREE.Vector3(...stoneFishMouth).applyMatrix4(r.fishView.group.matrixWorld),jetStart=new THREE.Vector3(...endpoint.start).applyMatrix4(r.mount.flow.matrixWorld),landing=new THREE.Vector3(...endpoint.end).applyMatrix4(r.mount.flow.matrixWorld),localLanding=landing.clone().applyMatrix4(frameInverse);
      check(mouth.distanceTo(jetStart)<1e-9,'fish mouth and actual source jet separated');
      check(Math.abs(localLanding.y-.13)<1e-9,'landing left the original pool-local waterline');
      const localFloor=new THREE.Vector3(0,r.support.core.geometry.boundingBox.min.y,0).applyMatrix4(r.next.matrixWorld).applyMatrix4(frameInverse);
      check(Math.abs(localFloor.y+.45)<2e-7,'support foot left original pool floor');
      const sourceGeometryRetained=r.fishView.group.children.every((mesh,k)=>mesh.geometry===poolOwner.baseOwner.sourceOwner.group.children[k].geometry);check(sourceGeometryRetained,'original fish geometry changed');
      bindings.push({index:r.index,slot:r.name,originalSiblingIndex:r.oldSiblingIndex,canonicalLocalMatrix:r.matrix,worldMouth:mouth.toArray(),worldJetStart:jetStart.toArray(),worldLanding:landing.toArray(),poolLocalLanding:localLanding.toArray(),poolLocalFloorY:localFloor.y,sourceGeometryRetained});
    }
    return {stage:'pending-native-art',installedFish:4,retiredFishDrawn:0,originalNonfishNodesPreserved:preservedNodes.size,originalNonfishMeshesPreserved:sourceMeshes.size,originalPoolGeometryAndMaterialReferences:true,noDuplicateReviewBasin:true,noCroppedReviewCourt:true,bindings};
  };
  const dispose=()=>{
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);const errors=[],run=fn=>{try{fn();}catch(error){errors.push(error);}};
    for(const r of records)run(()=>r.next.removeFromParent());
    run(()=>poolOwner.dispose());run(()=>buildingOwner.dispose());records.length=0;snapshots.clear();preservedNodes.clear();sourceMeshes.clear();
    if(errors.length)throw new AggregateError(errors,'Xieqiqu R9 integration cleanup failed');
  };
  try{
    for(const r of records){animals.remove(r.old);animals.add(r.next);}
    animals.children.splice(0,animals.children.length,...snapshots.get(animals).map(n=>replacementByOld.get(n)??n));
    group.userData.r9FishReplacement={id:xieqiquR9FishIntegrationId,stage:'pending-native-art',historicalCarvingVerified:false,visualAcceptance:false};
    signal?.throwIfAborted();group.updateMatrixWorld(true);const structural=validate(),currentCounts=count(group);
    const diagnostics={...buildingOwner.diagnostics,assetId:xieqiquR9FishIntegrationId,...currentCounts,originalBuildingDiagnostics:buildingOwner.diagnostics,fishReplacement:{...structural,previousCounts,sourceCandidate:'xieqiqu-stone-fish-pool-r9',newSupportTriangles:[records[0].support.core.geometry.index.count/3,records[2].support.core.geometry.index.count/3],originalPoolRetained:true,standaloneR9BasinDrawn:false,standaloneR9CourtDrawn:false,originalFishGeometryAndThree4KMapsRetained:true,resourceOwnership:'both input owners owned only after successful return; pool disposed before building'},stage:'pending-native-art',visualAcceptance:false,integrationAcceptance:false,archiveCompatible:false};
    signal?.addEventListener('abort',dispose,{once:true});committed=true;
    return {group,diagnostics,buildingOwner,poolOwner,records,validate,update(time){if(disposed)return;check(Number.isFinite(time),'finite animation time required');buildingOwner.update(time);poolOwner.update(time);},get disposed(){return disposed;},get invalidated(){return !!poolOwner.invalidated;},dispose};
  }catch(error){if(!committed){try{restore();}catch(rollback){throw new AggregateError([error,rollback],'Xieqiqu R9 integration failed and rollback failed',{cause:error});}}throw error;}
}

/** Independent review convenience entry; never modifies shared registration.
 * The adapter alone receives the live abort signal, so it first detaches mounts
 * and then disposes the pool and building in the required order. */
export function createXieqiquR9FishIntegrationStudy({pixels,signal}={}){
  signal?.throwIfAborted();let buildingOwner,poolOwner;
  try{buildingOwner=createXieqiquStudy();signal?.throwIfAborted();poolOwner=createXieqiquStoneFishPoolR9Study({pixels});return createXieqiquR9FishIntegrationFromOwners({buildingOwner,poolOwner,signal});}
  catch(error){const errors=[error];for(const owner of [poolOwner,buildingOwner])try{owner?.dispose();}catch(cleanup){errors.push(cleanup);}if(errors.length>1)throw new AggregateError(errors,'Xieqiqu R9 integration creation cleanup failed',{cause:error});throw error;}
}
