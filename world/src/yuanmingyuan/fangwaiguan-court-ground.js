import {Matrix4,Vector3} from 'three';
import {sitePoint} from './museum-sites.js';
import {extrudedPolygon} from './study-geometry.js';

const bindings=new WeakMap();
const samePolygon=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const circle=radius=>Array.from({length:64},(_,i)=>[radius*Math.cos(i/64*Math.PI*2),25+radius*Math.sin(i/64*Math.PI*2)]);
const profiles=()=>[
  {group:'fangwaiguan-water-channel',outer:[[-17,14.5],[17,14.5],[17,19.2],[-17,19.2]],water:[[-16.82,14.69],[16.82,14.69],[16.82,19.01],[-16.82,19.01]],bottom:-.225,top:-.22,probe:[5,16.85]},
  {group:'wuzhuting-front-fountain-basin',outer:circle(2.28),water:circle(1.96),bottom:-.135,top:-.13,probe:[.8,25]},
];

// This fits the retained author's model, not a surveyed Qing courtyard. Enable
// it only when its complete placed owner will remain for the terrain lifetime.
export function createFangwaiguanCourtGround(site){
  if(site?.assetId!=='fangwaiguan'||!Array.isArray(site.position)||site.position.length!==3||!site.position.every(Number.isFinite)||!Number.isFinite(site.rotationY)||!Number.isFinite(site.scale)||site.scale<=0)throw new Error('A placed Fangwaiguan site is required');
  const point=([x,z])=>{const p=sitePoint(site,[x,0,z]);return[p.x,p.z];};
  const level=y=>sitePoint(site,[0,y,0]).y;
  const alignment={kind:'retained-model-court-and-water-voids',assetId:'fangwaiguan',metresCalibrated:false};
  const limit='Author-model seam fitting only; courtyard outlines, depths and water levels are not surveyed historical dimensions. The complete source paving, banks, bridge and basin must remain.';
  const courts=profiles().map(profile=>({
    id:`${profile.group}-excavation`,assetId:'fangwaiguan',sourceGroup:profile.group,
    polygon:profile.outer.map(point),floorY:level(-1.35),rimY:level(-1.28),rimBlend:0,alignment,limit,
    water:{polygon:profile.water.map(point),surfacePolygon:profile.water.map(point),surfaceY:level(profile.top),kind:'ornamental-basin',sourceIds:['fangwaiguan-authored-study']},
  }));
  // The source slab occupies -1.25..0. Soil walls stop below its underside;
  // rimBlend:0 prevents this buried rim from drawing the adjacent lawn down.
  const pads=[{id:'fangwaiguan-court-ground',polygon:[[-18.8,-6.2],[18.8,-6.2],[18.8,37.6],[-18.8,37.6]].map(point),heightY:level(-.03),blend:2*site.scale,alignment,limit}];
  if([...courts.flatMap(c=>[...c.polygon.flat(),...c.water.polygon.flat(),c.floorY,c.rimY,c.water.surfaceY]),...pads.flatMap(p=>[...p.polygon.flat(),p.heightY,p.blend])].some(value=>!Number.isFinite(value)))throw new Error('Fangwaiguan placement overflows finite ground coordinates');
  return {assetId:'fangwaiguan',site,alignment,limit,courts,pads};
}

function visitTriangles(geometry,matrix,visit){
  const p=geometry?.attributes?.position,index=geometry?.index,total=index?.count??p?.count;
  const start=geometry?.drawRange?.start??0,count=geometry?.drawRange?.count??Infinity,end=Math.min(total,start+count);
  if(!geometry?.isBufferGeometry||!p||!Number.isInteger(start)||start<0||start%3||!(count===Infinity||Number.isInteger(count)&&count>=0)||!Number.isInteger(end)||end%3)throw new Error('Invalid drawn Fangwaiguan water geometry');
  const vertices=[new Vector3(),new Vector3(),new Vector3()];let visited=0;
  for(let i=start;i<end;i+=3){
    for(let j=0;j<3;j++){
      const at=index?index.getX(i+j):i+j;
      if(!Number.isInteger(at)||at<0||at>=p.count)throw new Error('Invalid Fangwaiguan water triangle index');
      const v=vertices[j].fromBufferAttribute(p,at);if(matrix)v.applyMatrix4(matrix);
      if(![v.x,v.y,v.z].every(Number.isFinite))throw new Error('Non-finite Fangwaiguan water triangle');
    }
    visit(vertices);visited++;
  }
  return visited;
}
function triangleKey(keys){
  const first=keys.indexOf([...keys].sort()[0]);
  return [keys[first],keys[(first+1)%3],keys[(first+2)%3]].join('|');
}
function waterKey(vertices,planeY){
  if(vertices.some(v=>Math.abs(v.y-planeY)>1e-6))throw new Error('Fangwaiguan composed water is not at its declared plane');
  return triangleKey(vertices.map(v=>`${Math.fround(v.x)},${Math.fround(v.z)}`));
}

// There is no role:"surface" in this source. Prove that each named group's
// direct water mesh is the complete authored 5 mm slab, including winding and
// draw range. A jet or a same-height/area substitute must not be hidden.
function requireSourceSheet(sheet,profile,ownerMatrix){
  if(!sheet?.isMesh||sheet.isInstancedMesh||Array.isArray(sheet.material)||sheet.material?.userData?.category!=='water')throw new Error('A Fangwaiguan broad water mesh is required');
  const localMatrix=ownerMatrix.clone().invert().multiply(sheet.matrixWorld);
  const expected=extrudedPolygon(profile.water,profile.bottom,profile.top),required=new Map();
  const vertexKey=v=>{
    const level=Math.abs(v.y-profile.top)<=1e-5?1:Math.abs(v.y-profile.bottom)<=1e-5?0:-1;
    const at=profile.water.findIndex(([x,z])=>Math.abs(v.x-x)<=1e-5&&Math.abs(v.z-z)<=1e-5);
    if(level<0||at<0)throw new Error(`Unexpected source water extent in ${profile.group}`);
    return `${at}:${level}`;
  };
  try{
    visitTriangles(expected,null,vertices=>{const key=triangleKey(vertices.map(vertexKey));required.set(key,(required.get(key)??0)+1);});
    visitTriangles(sheet.geometry,localMatrix,vertices=>{
      const key=triangleKey(vertices.map(vertexKey)),count=required.get(key)??0;
      if(!count)throw new Error(`Unexpected source water triangle in ${profile.group}`);
      if(count===1)required.delete(key);else required.set(key,count-1);
    });
    if(required.size)throw new Error(`Incomplete source water slab in ${profile.group}`);
  }finally{expected.dispose();}
}

// Compare the terrain's actual Float32 triangles with the water owner's drawn,
// merged meshes. Each logical height has its own sheet; the renderer's existing
// +.006 m offset is checked separately from the navigation water datum.
function requireComposedWater(surfaces,water,snapshot){
  if(!water.group?.isObject3D||water.group.visible===false||!Array.isArray(water.sheets)||water.sheets.length!==snapshot.sheets?.length)throw new Error('The actual composed Fangwaiguan water meshes are unavailable');
  const required=new Map();
  for(const surface of surfaces){
    let keys=required.get(surface.worldY);if(!keys){keys=new Set();required.set(surface.worldY,keys);}
    if(!visitTriangles(surface.geometry,null,vertices=>keys.add(waterKey(vertices,0))))throw new Error('Empty Fangwaiguan terrain water geometry');
  }
  water.group.updateWorldMatrix(true,true);
  for(let i=0;i<water.sheets.length;i++){
    const record=snapshot.sheets[i],keys=required.get(record.height);if(!keys)continue;
    const sheet=water.sheets[i];
    if(!sheet?.isMesh||sheet.isInstancedMesh||sheet.parent!==water.group||sheet.visible===false||!sheet.material?.isMaterial||sheet.material.visible===false||!Number.isFinite(record.planeY)||Math.abs(record.planeY-record.height-.006)>1e-7)throw new Error('The composed Fangwaiguan sheet is not drawable at its water level');
    visitTriangles(sheet.geometry,sheet.matrixWorld,vertices=>keys.delete(waterKey(vertices,record.planeY)));
  }
  if([...required.values()].some(keys=>keys.size))throw new Error('The composed water does not contain both complete Fangwaiguan surfaces');
}

function restoreSheets(previous){
  const errors=[];
  for(const value of previous)for(const restore of [
    ()=>{value.node.visible=value.visible;},
    ()=>{if(value.hadNavigation)value.node.userData.navigation=value.navigation;else delete value.node.userData.navigation;},
  ])try{restore();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Fangwaiguan source water restoration failed');
}

// All inputs are borrowed. The caller must restore before releasing a source,
// terrain or water owner. Overlapping primary/resident bindings are ref-counted.
export function bindFangwaiguanCourtWater(plan,{owner,terrain,water}={}){
  const snapshot=water?.snapshot?.();
  if(plan?.assetId!=='fangwaiguan'||!owner?.group?.isObject3D||owner.disposed||terrain?.disposed||!terrain?.group?.children.length||typeof terrain.surfaceAt!=='function'||snapshot?.disposed!==false)throw new Error('The retained Fangwaiguan owner, ground and water must be ready');
  const expected=createFangwaiguanCourtGround(plan.site),site=plan.site;
  if(plan.courts?.length!==2||plan.pads?.length!==1||plan.pads[0].heightY!==expected.pads[0].heightY||plan.pads[0].blend!==expected.pads[0].blend||!samePolygon(plan.pads[0].polygon,expected.pads[0].polygon))throw new Error('Both authored Fangwaiguan cuts and the paving pad are required');
  owner.group.updateWorldMatrix(true,true);
  const matrix=new Matrix4().makeRotationY(site.rotationY).scale(new Vector3(site.scale,site.scale,site.scale)).setPosition(...site.position);
  if(owner.group.matrixWorld.elements.some((value,i)=>!Number.isFinite(value)||Math.abs(value-matrix.elements[i])>1e-7))throw new Error('The retained Fangwaiguan owner does not match the ground placement');
  const sameCut=(a,b)=>a?.id===b.id&&a.floorY===b.floorY&&a.rimY===b.rimY&&a.rimBlend===b.rimBlend&&samePolygon(a.polygon,b.polygon)&&a.water?.surfaceY===b.water.surfaceY&&samePolygon(a.water.polygon,b.water.polygon)&&samePolygon(a.water.surfacePolygon,b.water.surfacePolygon);
  const surfaces=[],localProfiles=profiles(),sheets=plan.courts.map((court,i)=>{
    const original=expected.courts[i],cuts=terrain.courtFootprints?.filter(value=>value.id===court.id),matches=terrain.waterSurfaces?.filter(value=>value.id===`${court.id}-water`),surface=matches?.[0];
    if(!sameCut(court,original)||court.sourceGroup!==original.sourceGroup||cuts?.length!==1||!sameCut(cuts[0],original)||matches?.length!==1||!surface?.geometry?.isBufferGeometry||surface.worldY!==court.water.surfaceY||!samePolygon(surface.polygon,court.water.surfacePolygon))throw new Error('The matching Fangwaiguan excavation and water are unavailable');
    const probe=sitePoint(site,[localProfiles[i].probe[0],0,localProfiles[i].probe[1]]),hit=terrain.surfaceAt(probe.x,probe.z);
    if(!hit||Math.abs(hit.height-court.floorY)>1e-5||hit.waterY!==court.water.surfaceY||hit.walkable!==false)throw new Error('The Fangwaiguan wet excavation does not match actual terrain support');
    surfaces.push(surface);
    const groups=[];owner.group.traverse(node=>{if(node.name===court.sourceGroup)groups.push(node);});
    if(groups.length!==1)throw new Error(`Expected one source group ${court.sourceGroup}`);
    const found=groups[0].children.filter(node=>node.isMesh&&node.material?.userData?.category==='water');
    if(found.length!==1)throw new Error(`Expected one direct broad water mesh in ${court.sourceGroup}`);
    requireSourceSheet(found[0],localProfiles[i],matrix);return found[0];
  });
  // Probe inside the pad. At its edge, the existing terrain's finite triangles
  // interpolate the two-metre blend; the source's thick paving covers that join.
  for(const [x,z] of [[-10,0],[0,10],[10,35]]){
    const p=sitePoint(site,[x,0,z]),hit=terrain.surfaceAt(p.x,p.z);
    if(!hit||Math.abs(hit.height-expected.pads[0].heightY)>1e-5||hit.walkable!==true)throw new Error('The actual Fangwaiguan paving pad is unavailable');
  }
  requireComposedWater(surfaces,water,snapshot);
  let binding=bindings.get(owner.group);
  if(binding){
    if(binding.terrain!==terrain||binding.water!==water||binding.previous.some((value,i)=>value.node!==sheets[i]))throw new Error('Fangwaiguan source water is already bound to another owner');
    binding.users++;
  }else{
    const previous=sheets.map(node=>({node,visible:node.visible,hadNavigation:Object.hasOwn(node.userData,'navigation'),navigation:node.userData.navigation}));
    try{for(const {node} of previous){node.visible=false;node.userData.navigation=false;}}
    catch(error){try{restoreSheets(previous);}catch(cleanup){throw new AggregateError([error,cleanup],'Fangwaiguan water handoff and rollback failed');}throw error;}
    binding={terrain,water,previous,users:1};bindings.set(owner.group,binding);
  }
  let released=false;
  return ()=>{if(released)return;released=true;if(--binding.users)return;bindings.delete(owner.group);const previous=binding.previous.splice(0);binding.terrain=binding.water=null;restoreSheets(previous);};
}
