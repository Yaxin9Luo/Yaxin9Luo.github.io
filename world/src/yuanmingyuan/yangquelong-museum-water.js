import {Matrix4,Vector3} from 'three';
import {createMuseumLandscape} from './museum-landscape.js';
import {sitePoint} from './museum-sites.js';
import {extrudedPolygon} from './study-geometry.js';

const bindings=new WeakMap(),samePolygon=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const profiles=()=>[
 {group:'yangquelong-east-water-channel',ring:[[13,-23.5],[18,-23.5],[18,23.5],[13,23.5]],offset:[0,0],bottom:-.306,top:-.30,probe:[15.5,8]},
 ...[-4.85,4.85].map((z,i)=>({group:'yangquelong-west-pool-'+(i?'south':'north'),
  ring:Array.from({length:64},(_,n)=>{const a=n/64*Math.PI*2;return [1.065*Math.sin(a),1.065*Math.cos(a)];}),
  offset:[-6.6,z],bottom:.17-.006,top:.17,probe:[-6.6,z]})),
];

function visitTriangles(geometry,matrix,visit){
  const p=geometry?.attributes?.position,index=geometry?.index,total=index?.count??p?.count;
  const start=geometry?.drawRange?.start??0,count=geometry?.drawRange?.count??Infinity,end=Math.min(total,start+count);
  if(!geometry?.isBufferGeometry||!p||!Number.isInteger(start)||start<0||start%3||!(count===Infinity||Number.isInteger(count)&&count>=0)||!Number.isInteger(end)||end%3)throw new Error('Invalid drawn Yangquelong water geometry');
  const vertices=[new Vector3(),new Vector3(),new Vector3()];let visited=0;
  for(let i=start;i<end;i+=3){
    for(let j=0;j<3;j++){
      const at=index?index.getX(i+j):i+j;
      if(!Number.isInteger(at)||at<0||at>=p.count)throw new Error('Invalid Yangquelong water triangle index');
      const v=vertices[j].fromBufferAttribute(p,at);if(matrix)v.applyMatrix4(matrix);
      if(![v.x,v.y,v.z].every(Number.isFinite))throw new Error('Non-finite Yangquelong water triangle');
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
  if(vertices.some(v=>Math.abs(v.y-planeY)>1e-6))throw new Error('Yangquelong composed water is not at its declared plane');
  return triangleKey(vertices.map(v=>`${Math.fround(v.x)},${Math.fround(v.z)}`));
}

// Compare every drawn triangle of the original 6 mm slab, including winding.
// Pool geometry is authored at its own origin; its original parent translation
// is part of this check, not an assumed mesh bound.
function requireSourceSheet(sheet,profile,ownerMatrix){
 if(!sheet?.isMesh||sheet.isInstancedMesh||Array.isArray(sheet.material)||sheet.material?.userData?.category!=='water'||sheet.material.userData.role!=='surface')throw new Error('An original Yangquelong broad water mesh is required');
 const localMatrix=ownerMatrix.clone().invert().multiply(sheet.matrixWorld),required=new Map();
 const ring=profile.ring.map(([x,z])=>[x+profile.offset[0],z+profile.offset[1]]);
 const expected=extrudedPolygon(profile.ring,profile.bottom,profile.top),translation=new Matrix4().makeTranslation(profile.offset[0],0,profile.offset[1]);
 const vertexKey=v=>{
  const level=Math.abs(v.y-profile.top)<=1e-5?1:Math.abs(v.y-profile.bottom)<=1e-5?0:-1;
  const at=ring.findIndex(([x,z])=>Math.abs(v.x-x)<=1e-5&&Math.abs(v.z-z)<=1e-5);
  if(level<0||at<0)throw new Error('Unexpected source water extent in '+profile.group);
  return at+':'+level;
 };
 try{
  visitTriangles(expected,translation,vertices=>{const key=triangleKey(vertices.map(vertexKey));required.set(key,(required.get(key)??0)+1);});
  visitTriangles(sheet.geometry,localMatrix,vertices=>{
   const key=triangleKey(vertices.map(vertexKey)),count=required.get(key)??0;
   if(!count)throw new Error('Unexpected source water triangle in '+profile.group);
   if(count===1)required.delete(key);else required.set(key,count-1);
  });
  if(required.size)throw new Error('Incomplete source water slab in '+profile.group);
 }finally{expected.dispose();}
}

function requireComposedWater(surfaces,water,snapshot){
  if(!water.group?.isObject3D||water.group.visible===false||!Array.isArray(water.sheets)||water.sheets.length!==snapshot.sheets?.length)throw new Error('The actual composed Yangquelong water meshes are unavailable');
  const required=new Map();
  for(const surface of surfaces){
    let keys=required.get(surface.worldY);if(!keys){keys=new Set();required.set(surface.worldY,keys);}
    if(!visitTriangles(surface.geometry,null,vertices=>keys.add(waterKey(vertices,0))))throw new Error('Empty Yangquelong terrain water geometry');
  }
  water.group.updateWorldMatrix(true,true);
  for(let i=0;i<water.sheets.length;i++){
    const record=snapshot.sheets[i],keys=required.get(record.height);if(!keys)continue;
    const sheet=water.sheets[i];
    if(typeof sheet?.getRenderTarget!=='function'||!sheet?.material?.uniforms?.tDiffuse||!sheet?.isMesh||sheet.isInstancedMesh||sheet.parent!==water.group||sheet.visible===false||!sheet.material?.isMaterial||sheet.material.visible===false||!Number.isFinite(record.planeY)||Math.abs(record.planeY-record.height-.006)>1e-7)throw new Error('The composed Yangquelong sheet is not drawable at its water level');
    visitTriangles(sheet.geometry,sheet.matrixWorld,vertices=>keys.delete(waterKey(vertices,record.planeY)));
  }
  if([...required.values()].some(keys=>keys.size))throw new Error('The composed water does not contain all three complete Yangquelong surfaces');
}

function restoreSheets(previous){
  const errors=[];
  for(const value of previous)for(const restore of [
    ()=>{value.node.visible=value.visible;},
    ()=>{if(value.hadNavigation)value.node.userData.navigation=value.navigation;else delete value.node.userData.navigation;},
  ])try{restore();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Yangquelong source water restoration failed');
}

// The complete garden retains all nine source waters. Only three original
// broad sheets are leased to matching live terrain/reflection surfaces; six
// bowls/flows and every source resource remain owned by the original garden.
// The caller restores before source, terrain or water release.
export function bindYangquelongMuseumWater(site,{owner,terrain,water}={}){
 const snapshot=water?.snapshot?.();
 if(site?.assetId!=='yangquelong'||site.scale!==1||!Array.isArray(site.position)||site.position.length!==3||!site.position.every(Number.isFinite)||!Number.isFinite(site.rotationY)||!owner?.group?.isObject3D||owner.disposed||terrain?.disposed||!terrain?.group?.children.length||typeof terrain.surfaceAt!=='function'||snapshot?.disposed!==false)throw new Error('The complete placed Yangquelong, actual terrain and reflection water must be ready at unit scale');
 const expected=createMuseumLandscape({sites:[site]}),courts=expected.courts.filter(c=>c.assetId==='yangquelong'),localProfiles=profiles();
 const matrix=new Matrix4().makeRotationY(site.rotationY).setPosition(...site.position);
 owner.group.updateWorldMatrix(true,true);
 if(owner.group.matrixWorld.elements.some((value,i)=>!Number.isFinite(value)||Math.abs(value-matrix.elements[i])>1e-7))throw new Error('The retained Yangquelong does not match its ground placement');
 let waterCount=0;owner.group.traverse(mesh=>{if(mesh.isMesh&&[].concat(mesh.material).some(m=>m?.userData?.category==='water'))waterCount++;});
 if(waterCount!==9||courts.length!==3)throw new Error('All nine original Yangquelong waters and three matching excavations are required');
 const sameCut=(a,b)=>a?.id===b.id&&a.floorY===b.floorY&&a.rimY===b.rimY&&samePolygon(a.polygon,b.polygon)&&a.water?.surfaceY===b.water.surfaceY&&samePolygon(a.water.polygon,b.water.polygon)&&samePolygon(a.water.surfacePolygon,b.water.surfacePolygon);
 const surfaces=[],sheets=courts.map((court,i)=>{
  const cuts=terrain.courtFootprints?.filter(c=>c.id===court.id),matches=terrain.waterSurfaces?.filter(s=>s.id===court.id+'-water'),surface=matches?.[0];
  if(cuts?.length!==1||!sameCut(cuts[0],court)||matches?.length!==1||!surface?.geometry?.isBufferGeometry||surface.worldY!==court.water.surfaceY||!samePolygon(surface.polygon,court.water.surfacePolygon))throw new Error('The matching Yangquelong excavation and terrain water are unavailable');
  const p=sitePoint(site,[localProfiles[i].probe[0],0,localProfiles[i].probe[1]]),hit=terrain.surfaceAt(p.x,p.z);
  if(!hit||Math.abs(hit.height-court.floorY)>1e-5||hit.waterY!==court.water.surfaceY||hit.walkable!==false)throw new Error('The actual Yangquelong wet terrain support is unavailable');
  const groups=[];owner.group.traverse(node=>{if(node.name===court.sourceGroup)groups.push(node);});
  if(groups.length!==1)throw new Error('Expected one source group '+court.sourceGroup);
  const found=[];groups[0].traverse(node=>{if(node.isMesh&&node.material?.userData?.category==='water'&&node.material.userData.role==='surface')found.push(node);});
  if(found.length!==1)throw new Error('Expected one broad source sheet in '+court.sourceGroup);
  requireSourceSheet(found[0],localProfiles[i],matrix);surfaces.push(surface);return found[0];
 });
 requireComposedWater(surfaces,water,snapshot);
 let binding=bindings.get(owner.group);
 if(binding){
  if(binding.terrain!==terrain||binding.water!==water||binding.previous.some((value,i)=>value.node!==sheets[i]))throw new Error('Yangquelong water is already bound to another terrain/water owner');
  binding.users++;
 }else{
  const previous=sheets.map(node=>({node,visible:node.visible,hadNavigation:Object.hasOwn(node.userData,'navigation'),navigation:node.userData.navigation}));
  try{for(const {node}of previous){node.visible=false;node.userData.navigation=false;}}
  catch(error){try{restoreSheets(previous);}catch(cleanup){throw new AggregateError([error,cleanup],'Yangquelong water handoff and rollback failed',{cause:error});}throw error;}
  binding={terrain,water,previous,users:1};bindings.set(owner.group,binding);
 }
 let released=false;
 return ()=>{if(released)return;released=true;if(--binding.users)return;bindings.delete(owner.group);const previous=binding.previous.splice(0);binding.terrain=binding.water=null;restoreSheets(previous);};
}
