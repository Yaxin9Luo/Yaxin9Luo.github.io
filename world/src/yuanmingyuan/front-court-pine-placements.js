import * as THREE from 'three';
const fail=(ok,message)=>{if(!ok)throw new Error(message);};
export const frontCourtPineEnvelopeRadius=4.8;
const pairName=/^pine-r3-(needle-sprays|barked-spray-axes)-([0-3])$/;

// R5 borrows every original geometry/material. Only this view's copied
// instance buffers change, and every woody spray and needle spray keep one
// exact common attachment matrix. No other site's source can be deformed.
export function createFrontCourtPinePlacements(sourceGroup,placements){
 fail(sourceGroup?.isGroup&&sourceGroup.children.length,'live pine group required');
 const group=new THREE.Group();group.name='front-court-mature-pine-borrowers-r5';
 const roots=[],instanceMeshes=[],adjustments=[],crownBounds=[];let disposed=false;
 function dispose(){
  if(disposed)return;disposed=true;const errors=[];
  for(const instance of instanceMeshes)try{instance.dispose();}catch(error){errors.push(error);}
  try{group.removeFromParent();group.clear();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Garden pine borrowers cleanup failed');
 }
 const originalPairs=new Map();
 sourceGroup.traverse(node=>{
  const match=pairName.exec(node.name);
  if(match){fail(node.isInstancedMesh,'Paired original pine spray must be instanced');const key=Number(match[2]);if(!originalPairs.has(key))originalPairs.set(key,{});const pair=originalPairs.get(key);fail(!pair[match[1]],'Duplicate original pine spray');pair[match[1]]=node;}
 });
 function verifyOriginalPairs(){
  sourceGroup.updateWorldMatrix(true,true);
  fail(originalPairs.size===4,'Four complete original pine spray pairs required');
  for(const [index,pair]of originalPairs){
   const needles=pair['needle-sprays'],wood=pair['barked-spray-axes'];
   fail(needles&&wood&&needles.count>0&&needles.count===wood.count,'Paired pine spray counts changed: '+index);
   fail(needles.matrixWorld.equals(wood.matrixWorld),'Paired pine source frames changed: '+index);
   fail(needles.instanceMatrix.array.length===wood.instanceMatrix.array.length&&needles.instanceMatrix.array.every((v,i)=>v===wood.instanceMatrix.array[i]),'Paired pine attachment matrices changed: '+index);
  }
 }
 function clone(source,parent,placement){
  const node=source.clone(false);
  if(node.isInstancedMesh)instanceMeshes.push(node);
  for(const name of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','customDepthMaterial','customDistanceMaterial'])if(source[name])node[name]=source[name];
  const match=pairName.exec(node.name);
  if(match&&placement.shootScale){
   const matrix=new THREE.Matrix4(),scale=new THREE.Matrix4().makeScale(...placement.shootScale);
   for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);matrix.multiply(scale);node.setMatrixAt(i,matrix);}
   node.instanceMatrix.needsUpdate=true;
   // Culling and shadow bounds must follow the changed private instances.
   node.computeBoundingBox();node.computeBoundingSphere();
   adjustments.push({placementId:placement.id,prototype:Number(match[2]),role:match[1],instances:node.count,scale:[...placement.shootScale],attachmentTranslationsPreserved:true});
  }
  parent.add(node);
  for(const child of source.children)clone(child,node,placement);
  return node;
 }
 function checkCrown(copy,root){
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),box=new THREE.Box3();
  let maximumRadius=0,minimumY=Infinity,maximumY=-Infinity;
  copy.traverse(node=>{
   if(!node.isMesh)return;
   const bounds=node.geometry.boundingBox??new THREE.Box3().setFromBufferAttribute(node.geometry.attributes.position);
   const frame=new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld);
   const count=node.isInstancedMesh?node.count:1;
   for(let i=0;i<count;i++){
    if(node.isInstancedMesh){node.getMatrixAt(i,instance);matrix.multiplyMatrices(frame,instance);}else matrix.copy(frame);
    box.copy(bounds).applyMatrix4(matrix);
    maximumRadius=Math.max(maximumRadius,Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.z),Math.abs(box.max.z))));
    minimumY=Math.min(minimumY,box.min.y);maximumY=Math.max(maximumY,box.max.y);
   }
  });
  fail(maximumRadius<=frontCourtPineEnvelopeRadius,'Adjusted pine crown exceeds its complete reserved land/building/path disk: '+root.name);
  return {placementId:root.name,maximumLocalRadius:maximumRadius,localHeight:[minimumY,maximumY],reservedLocalRadius:frontCourtPineEnvelopeRadius,completeMeshAndInstanceBounds:true};
 }
 try{
  if(placements.some(p=>p.shootScale))verifyOriginalPairs();
  const ids=new Set();
  for(const placement of placements){
   fail(!ids.has(placement.id)&&Number.isFinite(placement.scale)&&placement.scale>=1&&placement.scale<=3&&placement.position.length===3&&placement.position.every(Number.isFinite)&&Number.isFinite(placement.yaw),'unique finite mature pine placement with uniform scale 1..3 required');ids.add(placement.id);
   if(placement.shootScale)fail(placement.shootScale.length===3&&placement.shootScale.every(v=>Number.isFinite(v)&&v>=1&&v<=1.35),'Paired private shoot scales must stay within 1..1.35');
   const root=new THREE.Group();root.name=placement.id;root.userData={...placement,evidence:'contemporary-front-court-landscape-r5',historicalIndividual:false};
   root.position.fromArray(placement.position);root.rotation.y=placement.yaw;root.scale.setScalar(placement.scale);group.add(root);roots.push(root);
   const copy=clone(sourceGroup,root,placement);
   group.updateMatrixWorld(true);
   if(placement.shootScale)crownBounds.push(checkCrown(copy,root));
  }
  return {group,roots,instanceMeshes,diagnostics:{originalSourceBuffersChanged:false,sourceMatricesChanged:false,privatePairedShootTransforms:adjustments,completeCrownBounds:crownBounds,geometryOrInstanceCountAdded:0},dispose,get disposed(){return disposed;}};
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Garden pine clone and cleanup failed',{cause:error});}throw error;}
}
