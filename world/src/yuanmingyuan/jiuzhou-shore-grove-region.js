import {Group} from 'three';
import {createWesternGardenPlantingPlan,createWesternGardenPlantingRegion} from './western-garden-planting.js';
import {shoreUnderstoryVariants} from './jiuzhou-shore-grove-understory-variants.js';

/** Partition only by source identity, then use the unchanged original region
 * borrower for every view: roots, epochs, exact attributes and release order
 * are not reimplemented. All placements remain in one public region owner. */
export async function createJiuzhouShoreGroveRegion(options){
 const {regionId,plantingLayout,sources,signal}=options;
 signal?.throwIfAborted();
 const fullPlan=createWesternGardenPlantingPlan(options);
 if(!fullPlan.valid){const error=new Error('Shore R4 whole-region preflight rejected.');error.plan=fullPlan;throw error;}
 const layoutRegion=plantingLayout.regions.find(r=>r.id===regionId),buckets=new Map();
 for(const p of layoutRegion.placements){
  const key=p.species==='willow'?'willow':p.variant;
  if(p.species!=='willow'&&!shoreUnderstoryVariants[p.species]?.includes(key))throw new Error('Unknown shore R4 placement variant.');
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);
 }
 const group=new Group();group.name='western-planting-'+regionId;
 group.userData={body:'regional-exhibition-planting',sourceGeometryChanged:true,worldCoordinates:true,historicallySurveyed:false,nativeCompositionReviewed:false};
 const regions=[];let disposed=false;
 function dispose(){
  if(disposed)return;disposed=true;const errors=[];group.removeFromParent();
  for(const region of [...regions].reverse())try{region.dispose();}catch(e){errors.push(e);}group.clear();
  if(errors.length)throw new AggregateError(errors,'Shore R4 variant views cleanup failed.');
 }
 function assertCurrent(){
  if(disposed)throw new Error('Shore R4 region disposed.');
  try{for(const region of regions)region.assertCurrent();return true;}catch(error){group.visible=false;throw error;}
 }
 try{
  for(const [key,placements]of buckets){
   signal?.throwIfAborted();
   const species=placements[0].species,binding=species==='willow'?sources.willow:sources[species]?.variants?.[key];
   if(!binding)throw new Error('Missing exact shore R4 binding '+key);
   const subset={...plantingLayout,regions:[{...layoutRegion,placements}]};
   const region=await createWesternGardenPlantingRegion({...options,sources:{[species]:binding},plantingLayout:subset});
   regions.push(region);group.add(region.group);region.group.name+='-'+key;signal?.throwIfAborted();
  }
  const parts=regions.flatMap(r=>r.parts),byId=new Map(regions.flatMap(r=>r.plan.placements).map(p=>[p.id,p]));
  const plan={...fullPlan,placements:fullPlan.placements.map(p=>byId.get(p.id))};
  const diagnostics={id:group.name,plan,trianglesPerPass:regions.reduce((n,r)=>n+r.diagnostics.trianglesPerPass,0),
   rootsChecked:regions.reduce((n,r)=>n+r.diagnostics.rootsChecked,0),maximumRootGap:Math.max(...regions.map(r=>r.diagnostics.maximumRootGap)),
   drawnParts:parts.length,ownedGeometries:0,ownedMaterials:0,ownedTextures:0,instanceAttributesSharedByIdentity:true,
   nativeCompositionReviewed:false,historicallySurveyed:false,variants:[...buckets.keys()],
   get borrowedSourceInvalidated(){return regions.some(r=>r.diagnostics.borrowedSourceInvalidated);}};
  assertCurrent();group.updateMatrixWorld(true);
  return {group,parts,plan,diagnostics,collisionSources:{group,parts:regions.flatMap(r=>r.collisionSources.parts)},assertCurrent,get disposed(){return disposed;},dispose};
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Shore R4 variant preparation and cleanup failed.');}throw error;}
}
