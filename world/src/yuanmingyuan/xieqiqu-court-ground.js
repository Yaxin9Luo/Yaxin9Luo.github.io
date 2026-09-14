import {flowerOutline} from './xieqiqu-geometry.js';
import {sitePoint} from './museum-sites.js';
import {Matrix4,Vector3} from 'three';

const pools=[['xieqiqu-south-haitang-pool','haitang',0,26,13,8.5],['xieqiqu-north-chrysanthemum-pool','chrysanthemum',0,-27,4.8,4.8]];
const bindings=new WeakMap();
const samePolygon=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// These are the existing authored asset's paving and pool profiles, not newly
// surveyed dimensions. The full placed owner must remain with this ground.
export function createXieqiquCourtGround(site){
  if(site?.assetId!=='xieqiqu'||!Array.isArray(site.position)||site.position.length!==3||!site.position.every(Number.isFinite)||!Number.isFinite(site.rotationY)||!Number.isFinite(site.scale)||!(site.scale>0))throw new Error('A placed Xieqiqu site is required');
  const point=([x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};
  const level=y=>sitePoint(site,[0,y,0]).y;
  const alignment={kind:'retained-model-court-and-flower-pool',assetId:'xieqiqu',metresCalibrated:false};
  const limit='Fits beneath the authored paving and two flower-pool voids; not surveyed historic dimensions or water levels.';
  const courts=pools.map(([id,kind,x,z,rx,rz])=>{
    const outer=flowerOutline(kind,x,z,rx,rz),inner=outer.map(([px,pz])=>[x+(px-x)*.957,z+(pz-z)*.957]);
    // Stop soil walls at the authored paving underside, below the -.60 stone
    // outer wall. This is a model seam correction, not a historical pool depth.
    return {id:`${id}-excavation`,assetId:'xieqiqu',sourceGroup:id,polygon:outer.map(point),floorY:level(-.68),rimY:level(-.65),alignment,limit,
      water:{polygon:inner.map(point),surfacePolygon:inner.map(point),surfaceY:level(.13),kind:'ornamental-basin',sourceIds:['xieqiqu-authored-study']}};
  });
  const pads=[{id:'xieqiqu-court-ground',polygon:[[-52,-51],[52,-51],[52,40.75],[-52,40.75]].map(point),heightY:level(-.68),blend:2*site.scale,alignment,limit}];
  if([...courts.flatMap(c=>[...c.polygon.flat(),...c.water.surfacePolygon.flat(),c.floorY,c.rimY,c.water.surfaceY]),...pads.flatMap(p=>[...p.polygon.flat(),p.heightY,p.blend])].some(value=>!Number.isFinite(value)))throw new Error('Xieqiqu placement overflows finite ground coordinates');
  return {assetId:'xieqiqu',site,alignment,limit,courts,pads};
}

// The water owner merges terrain sheets, so a height-only snapshot cannot prove
// that both pools were included. Compare all required drawn triangles with the
// actual merged mesh. Float32 XZ keys undo only the merge's rotate/unrotate round
// trip; no metre grid, boundary resampling or new BVH is introduced. Retain winding.
function visitWaterTriangles(geometry,matrix,planeY,visit){
  const p=geometry?.attributes?.position,index=geometry?.index,total=index?.count??p?.count;
  const start=geometry?.drawRange?.start??0,count=geometry?.drawRange?.count??Infinity,end=Math.min(total,start+count);
  if(!geometry?.isBufferGeometry||!p||!Number.isInteger(start)||start<0||start%3||!(count===Infinity||Number.isInteger(count)&&count>=0)||!Number.isInteger(end)||end%3)throw new Error('Invalid drawn Xieqiqu water geometry');
  const vertices=[new Vector3(),new Vector3(),new Vector3()];let visited=0;
  for(let i=start;i<end;i+=3){
    for(let j=0;j<3;j++){
      const at=index?index.getX(i+j):i+j;if(!Number.isInteger(at)||at<0||at>=p.count)throw new Error('Invalid Xieqiqu water triangle index');
      const v=vertices[j].fromBufferAttribute(p,at);if(matrix)v.applyMatrix4(matrix);
      if(![v.x,v.y,v.z].every(Number.isFinite)||Math.abs(v.y-planeY)>1e-6)throw new Error('Xieqiqu composed water is not at its declared plane');
    }
    const keys=vertices.map(v=>`${Math.fround(v.x)},${Math.fround(v.z)}`);
    const first=keys.indexOf([...keys].sort()[0]);visit([keys[first],keys[(first+1)%3],keys[(first+2)%3]].join('|'));visited++;
  }
  return visited;
}

function requireComposedPools(surfaces,water,snapshot){
  if(!water.group?.isObject3D||water.group.visible===false||!Array.isArray(water.sheets)||water.sheets.length!==snapshot.sheets?.length)throw new Error('The actual composed Xieqiqu water meshes are unavailable');
  const required=new Map();
  for(const surface of surfaces){
    let keys=required.get(surface.worldY);if(!keys){keys=new Set();required.set(surface.worldY,keys);}
    if(!visitWaterTriangles(surface.geometry,null,0,key=>keys.add(key)))throw new Error('Empty Xieqiqu terrain water geometry');
  }
  water.group.updateWorldMatrix(true,true);
  for(let i=0;i<water.sheets.length;i++){
    const record=snapshot.sheets[i],keys=required.get(record.height);if(!keys)continue;
    const sheet=water.sheets[i];
    if(!sheet?.isMesh||sheet.isInstancedMesh||sheet.parent!==water.group||sheet.visible===false||sheet.material?.visible===false||!Number.isFinite(record.planeY))throw new Error('The composed Xieqiqu sheet is not drawable');
    visitWaterTriangles(sheet.geometry,sheet.matrixWorld,record.planeY,key=>keys.delete(key));
  }
  if([...required.values()].some(keys=>keys.size))throw new Error('The composed water does not contain both complete Xieqiqu pools');
}

function restoreSheets(previous){
  const errors=[];
  for(const value of previous)for(const restore of [()=>{value.node.visible=value.visible;},()=>{if(value.hadNavigation)value.node.userData.navigation=value.navigation;else delete value.node.userData.navigation;}])try{restore();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Xieqiqu source water restoration failed');
}

// Hide only the two broad pool sheets after matching terrain openings and the
// composed water exist. Retain stone beds, basins, bowl water and all jets.
export function bindXieqiquFountainWater(plan,{owner,terrain,water}={}){
  const snapshot=water?.snapshot?.();
  if(plan?.assetId!=='xieqiqu'||!owner?.group?.isObject3D||owner.disposed||terrain?.disposed||!terrain?.group?.children.length||snapshot?.disposed!==false)throw new Error('The retained Xieqiqu owner, ground and water must be ready');
  const expected=createXieqiquCourtGround(plan.site),site=plan.site;
  if(plan.courts?.length!==2)throw new Error('Both authored Xieqiqu court inputs are required');
  owner.group.updateWorldMatrix(true,true);
  const matrix=new Matrix4().makeRotationY(site.rotationY).scale(new Vector3(site.scale,site.scale,site.scale)).setPosition(...site.position);
  if(owner.group.matrixWorld.elements.some((value,i)=>!Number.isFinite(value)||Math.abs(value-matrix.elements[i])>1e-7))throw new Error('The retained Xieqiqu owner does not match the ground placement');
  const surfaces=[],sheets=plan.courts.map((court,i)=>{
    const original=expected.courts[i],cuts=terrain.courtFootprints?.filter(value=>value.id===court.id),matches=terrain.waterSurfaces?.filter(value=>value.id===`${court.id}-water`),surface=matches?.[0];
    if(court.id!==original.id||court.sourceGroup!==original.sourceGroup||court.floorY!==original.floorY||court.rimY!==original.rimY||court.water?.surfaceY!==original.water.surfaceY||!samePolygon(court.polygon,original.polygon)||!samePolygon(court.water?.surfacePolygon,original.water.surfacePolygon)||!samePolygon(court.water?.polygon,original.water.polygon)
      ||cuts?.length!==1||cuts[0].floorY!==court.floorY||cuts[0].rimY!==court.rimY||!samePolygon(cuts[0].polygon,court.polygon)||cuts[0].water?.surfaceY!==court.water.surfaceY||!samePolygon(cuts[0].water?.polygon,court.water.polygon)||!samePolygon(cuts[0].water?.surfacePolygon,court.water.surfacePolygon)
      ||matches?.length!==1||!surface?.geometry?.isBufferGeometry||surface.worldY!==court.water.surfaceY||!samePolygon(surface.polygon,court.water.surfacePolygon))throw new Error('The matching Xieqiqu pool opening and water are unavailable');
    surfaces.push(surface);
    const group=owner.group.getObjectByName(court.sourceGroup),found=[];
    group?.traverse(node=>{if(node.isMesh&&node.geometry?.attributes?.position?.count&&node.material?.userData?.category==='water'&&node.material.userData.role==='surface')found.push(node);});
    if(found.length!==1)throw new Error(`Expected one water sheet in ${court.sourceGroup}`);
    return found[0];
  });
  requireComposedPools(surfaces,water,snapshot);
  let binding=bindings.get(owner.group);
  if(binding){
    if(binding.terrain!==terrain||binding.water!==water||binding.previous.some((value,i)=>value.node!==sheets[i]))throw new Error('Xieqiqu source water is already bound to another owner');
    binding.users++;
  }else{
    const previous=sheets.map(node=>({node,visible:node.visible,hadNavigation:Object.hasOwn(node.userData,'navigation'),navigation:node.userData.navigation}));
    try{for(const {node} of previous){node.visible=false;node.userData.navigation=false;}}
    catch(error){try{restoreSheets(previous);}catch(cleanup){throw new AggregateError([error,cleanup],'Xieqiqu water handoff and rollback failed');}throw error;}
    binding={terrain,water,previous,users:1};bindings.set(owner.group,binding);
  }
  let released=false;
  return ()=>{if(released)return;released=true;if(--binding.users)return;bindings.delete(owner.group);const previous=binding.previous.splice(0);binding.terrain=binding.water=null;restoreSheets(previous);};
}
