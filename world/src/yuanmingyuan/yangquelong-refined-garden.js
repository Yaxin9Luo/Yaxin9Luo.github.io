import * as THREE from 'three';
import {prepareYangquelongGardenComposition,yangquelongGardenLayout} from './yangquelong-garden-composition.js';
import {prepareYangquelongPlantedGarden} from './yangquelong-planted-garden.js';
import {prepareYangquelongPavingSurface} from './yangquelong-paving-surface.js';
import {yangquelongRefinedGardenViews} from './yangquelong-refined-garden-views.js';
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong refined garden: '+message);};
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);

/** Pin only the rigid planting hierarchy, including its copied instance
 * buffers. Architecture and water keep their original independent guards and
 * animation. A containing scene may rigidly place the complete garden. */
function rigidPlantingGuard(owner){
 const garden=owner.gardenOwner,under=owner.understoreyOwner,roots=garden.plantingOwner.roots;
 fail(roots.length===4&&under.diagnostics.id==='yangquelong-understorey-r5'&&under.sourceOwner.diagnostics.id==='yangquelong-understorey-source-r5'&&under.layout.id==='yangquelong-understorey-layout-r5','complete four-pine / botanical R5 owners required');
 const bedIds=yangquelongGardenLayout.placements.map(p=>p.bed).sort();
 fail(equal(under.layout.beds.map(b=>b.id).sort(),bedIds),'all four existing bed layouts required');
 for(const p of yangquelongGardenLayout.placements){
  const root=roots.find(r=>r.name===p.id),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw);
  fail(root&&root.parent===garden.plantingOwner.group&&p.scale===1&&root.position.equals(new THREE.Vector3(...p.position))&&root.quaternion.equals(rotation)&&root.scale.equals(new THREE.Vector3(1,1,1)),'original full-size pine pose required: '+p.id);
 }
 const nodes=[];
 const capture=node=>{
  if(node.matrixAutoUpdate)node.updateMatrix();
  const buffers=node.isInstancedMesh?[node.instanceMatrix,node.instanceColor].filter(Boolean).map(attribute=>({attribute,array:attribute.array,values:attribute.array.slice(),version:attribute.version})):[];
  nodes.push({node,children:[...node.children],parent:node.parent,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone(),matrix:node.matrix.clone(),matrixAutoUpdate:node.matrixAutoUpdate,visible:node.visible,
   geometry:node.geometry,materials:node.isMesh?[].concat(node.material):null,count:node.isInstancedMesh?node.count:null,buffers});
 };
 garden.plantingOwner.group.traverse(capture);under.group.traverse(capture);
 return ()=>{
  const group=garden.group;
  fail(group.position.lengthSq()===0&&group.quaternion.equals(new THREE.Quaternion())&&group.scale.equals(new THREE.Vector3(1,1,1)),'original local garden coordinate frame required');
  fail(garden.plantingOwner.group.parent===group&&under.group.parent===group,'planting groups must remain attached to the original garden');
  for(const r of nodes){
   const n=r.node;
   fail(equal(n.children,r.children)&&n.parent===r.parent&&n.visible===r.visible&&n.position.equals(r.position)&&n.quaternion.equals(r.quaternion)&&n.scale.equals(r.scale)&&n.matrixAutoUpdate===r.matrixAutoUpdate&&n.matrix.equals(r.matrix),'rigid planting transform/visibility changed: '+n.name);
   if(n.isMesh)fail(n.geometry===r.geometry&&equal([].concat(n.material),r.materials),'shared planting geometry/material binding changed: '+n.name);
   if(n.isInstancedMesh){
    fail(n.count===r.count&&r.buffers.length===[n.instanceMatrix,n.instanceColor].filter(Boolean).length,'instance population changed: '+n.name);
    for(const [i,b]of r.buffers.entries()){
     const attribute=[n.instanceMatrix,n.instanceColor].filter(Boolean)[i];
     fail(attribute===b.attribute&&attribute.array===b.array&&attribute.version===b.version&&equal(attribute.array,b.values),'fixed planting instance buffer changed: '+n.name);
    }
   }
  }
  return true;
 };
}

/** One existing garden + one low-planting owner. Paving enters through the
 * original prepareSurface seam before ground locks its material identity.
 * No extra soil, rim, tree, source factory or scene hierarchy is created. */
export async function prepareYangquelongRefinedGarden({
 signal,prepareGarden=prepareYangquelongGardenComposition,
 prepareSurface=prepareYangquelongPavingSurface,createUnderstorey,
}={}){
 let owner;
 try{
  owner=await prepareYangquelongPlantedGarden({signal,createUnderstorey,
   prepareGarden:options=>prepareGarden({...options,prepareSurface})});
  signal?.throwIfAborted();
  const rigid=rigidPlantingGuard(owner);
  function assertCurrent(){
   try{owner.assertCurrent();rigid();return true;}
   catch(error){try{owner.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Refined garden invalidation and release failed',{cause:error});}throw error;}
  }
  assertCurrent();
  const diagnostics={...owner.diagnostics,id:'yangquelong-refined-garden-r3',assetId:'yangquelong-refined-garden-r3',
   evidence:'contemporary-museum-garden-composition',historicalPlantingVerified:false,nativeReviewed:false,visualAcceptance:false,
   integration:{surface:'complete original building + nine waters + four accepted soil beds + private paving',pines:'original four unscaled full-quality pine placements',understorey:'botanical-form-r5 in all four existing beds',
    originalGardenRetained:true,extraSoilOrRimMeshes:0,extraPineFactories:0,presentation:'original studio light; independent optional lease requires separate review'},
   reviewStatus:{paving:'scoped-native-detail-accepted',botanicalR5:'bed-and-community-native-reviewed-for-complete-garden-trial',fullComposition:'native-pending',presentation:'scoped-daytime-surface-accepted; full-composition/night-pending'},
   limitations:[...owner.diagnostics.limitations,'Rigid pine/plant placements and instance buffers are guarded; the containing complete garden may be rigidly placed only within the original surface unit-scale contract.','Inherited component counts are not a fresh complete-factory or combined-native proof.'],
  };
  return {...owner,diagnostics,views:yangquelongRefinedGardenViews,assertCurrent,
   update(time){assertCurrent();owner.update(time);},
   get disposed(){return owner.disposed;}};
 }catch(error){
  const errors=[];try{owner?.dispose();}catch(e){errors.push(e);}try{await owner?.whenIdle?.();}catch(e){errors.push(e);}
  if(errors.length)throw new AggregateError([error,...errors],'Refined garden preparation and release failed',{cause:error});throw error;
 }
}
export async function prepareYangquelongRefinedGardenFactory(options={}){
 const owner=await prepareYangquelongRefinedGarden(options);let consumed=false,discarded=false;
 const factory=()=>{options.signal?.throwIfAborted();fail(!consumed&&!discarded,'prepared factory consumed or disposed');owner.assertCurrent();consumed=true;return owner;};
 factory.dispose=()=>{if(consumed||discarded)return;discarded=true;owner.dispose();};factory.whenIdle=()=>owner.whenIdle();return factory;
}
