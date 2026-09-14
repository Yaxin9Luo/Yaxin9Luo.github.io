import * as THREE from 'three';
import {gardenLayout,pointInPolygon} from './garden-layout.js';
import {museumSites,sitePoint} from './museum-sites.js';
import {plantingDistanceToPolygon} from './garden-planting-layout.js';

// These positions, scales and openings are contemporary exhibition design.
// Source forms have local native reviews; this new composition has not.
export const westernGardenPlantingSpec=Object.freeze({
  id:'western-garden-planting-r1',
  historicallySurveyed:false,
  nativeCompositionReviewed:false,
  sourceReviews:Object.freeze({
    vegetation:'work/yuanmingyuan/vegetation-native-review-r4.json',
    understory:'work/yuanmingyuan/garden-understory-native-r2/review.json',
  }),
  // Recorded full-source costs, not a simplification target or a draw budget.
  sourceTriangles:Object.freeze({juniper:1251596,willow:7925316,'lake-rock':241908,sedge:59136,fern:1023726,'flower-shrub':1588648}),
});
export const westernGardenPlantingSourceReview=id=>id==='juniper'||id==='willow'?'work/yuanmingyuan/vegetation-native-review-r2.json':westernGardenPlantingSpec.sourceReviews[id==='lake-rock'?'vegetation':'understory'];

const species={
  juniper:{radius:2.4,height:5.7,rootRadius:.68,root:'juniper-visible-trunk'},
  willow:{radius:6.5,height:8.4,rootRadius:1.45,root:'willow-trunk-and-roots'},
  'lake-rock':{radius:1.6,height:4.35,rootRadius:1.45,root:'lake-rock-main'},
  sedge:{radius:.8,height:.6,rootRadius:.12},
  fern:{radius:1,height:.6,rootRadius:.22},
  'flower-shrub':{radius:.9,height:.65,rootRadius:.14},
};
const EPS=1e-7;
const rectangle=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const finiteXZ=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const plain=value=>JSON.parse(JSON.stringify(value));
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
const stamp=terrain=>JSON.stringify({disposed:terrain.disposed??false,revision:terrain.revision??null,
  replacements:(terrain.replacementStates??[]).map(({id,revision,active})=>({id,revision,active})),
  reservations:['paths','courtFootprints','waterSurfaces'].map(key=>(terrain[key]??[]).map(({id,polygon,holes,clearance})=>({id,polygon,holes,clearance})))});

function corridor(from,to,width){
  const dx=to[0]-from[0],dz=to[1]-from[1],length=Math.hypot(dx,dz);
  if(!length)throw new Error('A planting sightline needs two distinct anchors.');
  const nx=-dz/length*width/2,nz=dx/length*width/2;
  return [[from[0]+nx,from[1]+nz],[to[0]+nx,to[1]+nz],[to[0]-nx,to[1]-nz],[from[0]-nx,from[1]-nz]];
}

/** No Three objects, source factories or height estimates are constructed here.
 * The three building frames and the named lake's actual polygon are inputs.
 * Clearings reserve views/visitor space; they do not claim an existing road. */
export function createWesternGardenPlantingLayout({sites=museumSites,layout=gardenLayout}={}){
  const anchors={};
  for(const id of ['xieqiqu','yangquelong','fangwaiguan']){
    const s=sites.find(site=>site.id===id);
    if(!s||!Array.isArray(s.position)||s.position.length!==3||!s.position.every(Number.isFinite)||!Number.isFinite(s.rotationY)||!(s.scale>0)||!Number.isFinite(s.scale))throw new Error('Missing finite planting site '+id);
    anchors[id]=s;
  }
  const at=(id,p)=>{const q=sitePoint(anchors[id],[p[0],0,p[1]]);return[q.x,q.z];};
  const lake=layout.waterBodies?.find(w=>w.id==='changchun-great-lake');
  if(!lake?.polygon?.every(finiteXZ)||lake.polygon.length<3)throw new Error('The current Changchunyuan lake outline is required.');
  // Select the two shore edges nearest the actual Fangwaiguan south axis.
  // Never use historical image pixels as measured world coordinates.
  const focus=at('fangwaiguan',[0,110]);
  const edges=lake.polygon.map((a,i)=>{
    const b=lake.polygon[(i+1)%lake.polygon.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const t=length?Math.max(0,Math.min(1,((focus[0]-a[0])*dx+(focus[1]-a[1])*dz)/(length*length))):0;
    return {a,b,length,index:i,distance:Math.hypot(focus[0]-a[0]-dx*t,focus[1]-a[1]-dz*t)};
  }).filter(e=>e.length>32).sort((a,b)=>a.distance-b.distance);
  const east=edges[0],west=east&&edges.find(e=>e.index===(east.index+lake.polygon.length-1)%lake.polygon.length);
  if(!east||!west)throw new Error('The authored two-edge lake composition needs review for this outline.');
  function shore(edge,t,inland){
    const dx=(edge.b[0]-edge.a[0])/edge.length,dz=(edge.b[1]-edge.a[1])/edge.length;
    let nx=-dz,nz=dx;const centre=[edge.a[0]+dx*edge.length*t,edge.a[1]+dz*edge.length*t];
    if(pointInPolygon([centre[0]+nx*.05,centre[1]+nz*.05],lake.polygon)){nx=-nx;nz=-nz;}
    return[centre[0]+nx*inland,centre[1]+nz*inland];
  }
  const regions=[],clearings=[],buildingReserves=[];
  const addRegion=(id,label,composition)=>{const r={id,label,composition,placements:[]};regions.push(r);return r;};
  const add=(region,type,point,scale,yaw,drift)=>region.placements.push({
    id:region.id+'-'+type+'-'+String(region.placements.length+1).padStart(2,'0'),
    species:type,position:[point[0],null,point[1]],scale,yaw,drift,burial:type==='lake-rock'?.04:.004,
    envelope:{radius:species[type].radius*scale,height:species[type].height*scale},
    evidence:{status:'contemporary-exhibition-design',surveyed:false,sourceFormReview:westernGardenPlantingSourceReview(type)},
  });
  function cluster(region,centre,{stone=false,fern=false,flower=false}={}){
    const offset=(x,z)=>[centre[0]+x,centre[1]+z];
    if(stone)add(region,'lake-rock',offset(-1.0,0),.44,.43,'small-stone-anchor');
    if(fern)add(region,'fern',offset(.65,-.40),1.0,1.25,'shaded-low-layer');
    if(flower)add(region,'flower-shrub',offset(1.75,-1.05),1.1,-.25,'single-flower-accent');
    // An unequal crescent, not an evenly spaced ring or filled carpet.
    [[-2.3,.65,.95],[-1.35,1.2,1.02],[-.4,1.45,.91],[.5,1.75,1.07],[1.3,1.65,.94],[2.05,1.25,.88]]
      .forEach(([x,z,size],i)=>add(region,'sedge',offset(x,z),size,i*2.399963,'open-crescent'));
  }
  const x=addRegion('xieqiqu-north','谐奇趣北侧入口','A paired clipped-tree threshold; central north/south view remains empty.');
  for(const side of [-1,1])add(x,'juniper',at('xieqiqu',[side*20,-59]),1,side*.14,'paired-threshold');
  cluster(x,at('xieqiqu',[-31,-58]),{stone:true,fern:true,flower:true});
  const a=addRegion('yangquelong-west','养雀笼西门外','Paired junipers stand outside the west gate court; foliage does not occupy the east/west passage.');
  for(const side of [-1,1])add(a,'juniper',at('yangquelong',[-30,side*12]),.95,side*.11,'paired-west-gate');
  cluster(a,at('yangquelong',[1,-31]),{flower:true});
  const f=addRegion('fangwaiguan-front','方外观入口侧庭','Two clipped trees frame the approach; a low stone/fern crescent leaves the pavilion-to-lake axis clear.');
  for(const side of [-1,1])add(f,'juniper',at('fangwaiguan',[side*26,14]),1.04,side*.18,'paired-approach');
  cluster(f,at('fangwaiguan',[31,28]),{stone:true,fern:true});
  const w=addRegion('lake-west-pair','长春湖西北岸疏密柳组','Two unequal willows on the west shore; a broad gap to the eastern single tree keeps the lake view open.');
  add(w,'willow',shore(west,.65,14),.93,-.42,'two-tree-shore-group');
  add(w,'willow',shore(west,.96,12),1.02,.73,'two-tree-shore-group');
  cluster(w,shore(west,.77,8),{stone:true});
  const e=addRegion('lake-east-single','长春湖东侧单柳与低草','A single willow beyond the open Fangwaiguan lake view; low plants taper rather than wall off the shore.');
  add(e,'willow',shore(east,.89,13),.96,1.65,'single-shore-tree');
  cluster(e,shore(east,.83,7),{flower:true});
  clearings.push(
    {id:'western-north-south-view',kind:'axial-view',polygon:[[-8,-175],[8,-175],[8,64],[-8,64]].map(p=>at('xieqiqu',p)),clearance:0},
    {id:'aviary-fangwai-east-west-view',kind:'axial-view',polygon:corridor(at('yangquelong',[-48,0]),at('fangwaiguan',[46,0]),12),clearance:0},
    {id:'xieqi-aviary-visitor-connection',kind:'visitor-space',polygon:corridor(at('xieqiqu',[51,-47]),at('yangquelong',[-23,0]),5),clearance:0},
    {id:'fangwai-open-lake-view',kind:'water-view',polygon:[[-8,38],[8,38],[12,122],[-12,122]].map(p=>at('fangwaiguan',p)),clearance:0},
  );
  for(const [id,box]of [['xieqiqu',[-52,-51,52,40.75]],['yangquelong',[-19,-24,22,24]],['fangwaiguan',[-18.8,-6.2,18.8,37.6]]])
    buildingReserves.push({id:id+'-authored-court-envelope',kind:'model-court-envelope',polygon:rectangle(...box).map(p=>at(id,p)),clearance:1});
  for(const region of regions){
    region.bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const p of region.placements){const [x,,z]=p.position,r=p.envelope.radius;region.bounds.minX=Math.min(region.bounds.minX,x-r);region.bounds.maxX=Math.max(region.bounds.maxX,x+r);region.bounds.minZ=Math.min(region.bounds.minZ,z-r);region.bounds.maxZ=Math.max(region.bounds.maxZ,z+r);}
    region.estimatedFullSourceTriangles=region.placements.reduce((n,p)=>n+westernGardenPlantingSpec.sourceTriangles[p.species],0);
  }
  return {id:westernGardenPlantingSpec.id,coordinateLayoutId:layout.id,regions,clearings,buildingReserves,historicallySurveyed:false,nativeCompositionReviewed:false};
}

function validateReserve(r){
  if(!r||![r.polygon,...(r.holes??[])].every(ring=>Array.isArray(ring)&&ring.length>=3&&ring.every(finiteXZ))||!Number.isFinite(r.clearance??0)||(r.clearance??0)<0)throw new Error('Invalid planting reservation '+r?.id);
  for(const ring of [r.polygon,...(r.holes??[])])if(Math.abs(ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1];},0))<1e-9)throw new Error('Degenerate planting reservation '+r.id);
  // Native capture serializes this plan. Never retain a terrain geometry or
  // owner through diagnostics and accidentally serialize its full buffers.
  return {id:r.id??'unnamed',kind:r.kind??'caller-reserved',polygon:r.polygon.map(p=>[...p]),
    ...(r.holes?.length?{holes:r.holes.map(hole=>hole.map(p=>[...p]))}:{}),clearance:r.clearance??0};
}
function touchesDisk(point,radius,reserve){
  // A polygon hole remains a genuine opening, but its edges still need clearance.
  const inOuter=pointInPolygon(point,reserve.polygon),inHole=(reserve.holes??[]).some(hole=>pointInPolygon(point,hole));
  return inOuter&&!inHole||[reserve.polygon,...(reserve.holes??[])].some(ring=>plantingDistanceToPolygon(point,ring)<=radius+(reserve.clearance??0));
}
function surface(terrain,x,z){
  const hit=terrain.surfaceAt(x,z,{includeBridges:true}),normal=hit?.normal?.isVector3?hit.normal.toArray():hit?.normal;
  if(!hit||hit.supportSource!=='terrain-triangle'||hit.kind!=='land'||hit.walkable!==true||!Number.isFinite(hit.height)||!Array.isArray(normal)||normal.length!==3||!normal.every(Number.isFinite)||!(Math.hypot(...normal)>0)||normal[1]/Math.hypot(...normal)<Math.cos(18*Math.PI/180)||Number.isFinite(hit.waterY)&&hit.height<=hit.waterY+.03)throw new Error('No gentle current dry triangle at '+x+', '+z);
  return {x,z,height:hit.height,normal:[...normal],geometry:hit.geometry?.name??null,triangleIndex:hit.triangleIndex??null};
}
function volume(x,z,y,radius,height){
  const bounds={minX:x-radius,maxX:x+radius,minY:y-.2,maxY:y+height,minZ:z-radius,maxZ:z+radius};
  return {bounds,planes:[[1,0,0,bounds.maxX],[-1,0,0,-bounds.minX],[0,1,0,bounds.maxY],[0,-1,0,-bounds.minY],[0,0,1,bounds.maxZ],[0,0,-1,-bounds.minZ]],interiorPoint:{x,y:(bounds.minY+bounds.maxY)/2,z}};
}
function requireContext(terrain,architecture){
  if(terrain?.disposed||typeof terrain?.surfaceAt!=='function'||!['paths','courtFootprints','waterSurfaces'].every(k=>Array.isArray(terrain[k])))throw new Error('Planting needs live terrain.surfaceAt, paths, courts and water polygons.');
  if(architecture?.disposed||typeof architecture?.intersectsGuideVolume!=='function')throw new Error('Planting needs the current retained architecture triangle-volume query.');
}

/** Cheap preflight using the caller's real triangle support. Rejections are
 * reported in place; no coordinate is nudged or missing road silently ignored. */
export function createWesternGardenPlantingPlan({regionId,terrain,architecture,plantingLayout=createWesternGardenPlantingLayout(),reservedPolygons=[]}={}){
  requireContext(terrain,architecture);
  const region=plantingLayout.regions.find(r=>r.id===regionId);
  if(!region)throw new Error('Unknown western planting region '+regionId);
  if(new Set(region.placements.map(p=>p.id)).size!==region.placements.length||region.placements.some(p=>typeof p.id!=='string'||!p.id))throw new Error('Regional placement IDs must be unique.');
  const reserves=[...plantingLayout.buildingReserves,...plantingLayout.clearings,...reservedPolygons,
    ...terrain.paths.map(r=>({...r,kind:'current-path',clearance:Math.max(1,r.clearance??0)})),
    ...terrain.courtFootprints.map(r=>({...r,kind:'current-court',clearance:1})),
    ...terrain.waterSurfaces.map(r=>({...r,kind:'current-water',clearance:.15})),
  ].map(validateReserve);
  const placements=[],rejected=[];
  for(const source of region.placements){
    const p=plain(source),[x,,z]=p.position,spec=species[p.species],reasons=[];
    if(!spec||![x,z,p.scale,p.yaw,p.burial,p.envelope?.radius,p.envelope?.height].every(Number.isFinite)||p.scale<=0||p.burial<0||p.envelope.radius<=0||p.envelope.height<=0)throw new Error('Invalid planting record '+p.id);
    const conflicts=reserves.filter(r=>touchesDisk([x,z],p.envelope.radius,r)).map(r=>({id:r.id,kind:r.kind}));
    if(conflicts.length)reasons.push({kind:'reserved-footprint',conflicts});
    const rootRadius=spec.rootRadius*p.scale,samples=[];
    try{
      samples.push(surface(terrain,x,z));
      for(let i=0;i<16;i++){const a=i/16*Math.PI*2;samples.push(surface(terrain,x+Math.cos(a)*rootRadius,z+Math.sin(a)*rootRadius));}
      const low=Math.min(...samples.map(s=>s.height)),high=Math.max(...samples.map(s=>s.height));
      if(high-low>.18*p.scale)reasons.push({kind:'root-height-range',range:high-low,maximum:.18*p.scale});
      p.position[1]=low-p.burial;
      const blocked=architecture.intersectsGuideVolume(volume(x,z,p.position[1],p.envelope.radius,p.envelope.height));
      if(blocked!==false)reasons.push({kind:'actual-architecture-volume',blocked});
    }catch(error){reasons.push({kind:'support-query',message:error.message});}
    p.grounding={method:'centre plus sixteen actual dry-triangle root-footprint queries; full root vertices checked when this region is prepared',samples};
    if(reasons.length)rejected.push({id:p.id,reasons});else placements.push(p);
  }
  return {id:region.id,layoutId:plantingLayout.id,valid:rejected.length===0,placements,rejected,reservations:reserves,terrainStamp:stamp(terrain),estimatedFullSourceTriangles:region.estimatedFullSourceTriangles,historicallySurveyed:false,nativeCompositionReviewed:false};
}

/** Borrow existing sources without constructing any tree or decoding texture.
 * Pilot placement transforms are excluded; the inner specimen is copied in its
 * own root coordinates. Owners must outlive every returned regional view. */
export function createWesternGardenPlantingSources({plantingPilot,understoryOwner}={}){
  const sources={};
  for(const id of Object.keys(species)){
    const tree=!!species[id].root,owner=tree?plantingPilot:understoryOwner;
    const part=tree?owner?.parts?.find(p=>p.userData.species===id)?.children.find(p=>p.userData.id===id):owner?.parts?.find(p=>p.userData.id===id);
    if(part)sources[id]={part,owner,review:westernGardenPlantingSpec.sourceReviews[tree?'vegetation':'understory']};
  }
  return sources;
}

function borrowedView(node,views,watch){
  if(node.isSkinnedMesh||node.isBatchedMesh||node.morphTargetInfluences||node.morphTexture)throw new Error('Only reviewed static full-source vegetation is supported.');
  let copy;
  if(node.isInstancedMesh){
    copy=new THREE.InstancedMesh(node.geometry,node.material,0);
    const emptyMatrix=copy.instanceMatrix;
    copy.instanceMatrix=node.instanceMatrix;copy.instanceColor=node.instanceColor;copy.count=node.count;
    copy.boundingBox=node.boundingBox?.clone()??null;copy.boundingSphere=node.boundingSphere?.clone()??null;
    views.push({copy,emptyMatrix});
  }else if(node.isMesh)copy=new THREE.Mesh(node.geometry,node.material);
  else if(node.isGroup)copy=new THREE.Group();
  else if(node.type==='Object3D')copy=new THREE.Object3D();
  else throw new Error('Unsupported planting node '+node.type);
  THREE.Object3D.prototype.copy.call(copy,node,false);
  for(const key of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','customDepthMaterial','customDistanceMaterial'])copy[key]=node[key];
  if(node.isMesh){
    watch(node.geometry);if(node.isInstancedMesh)watch(node);
    for(const material of [...(Array.isArray(node.material)?node.material:[node.material]),node.customDepthMaterial,node.customDistanceMaterial].filter(Boolean)){
      watch(material);for(const value of Object.values(material))if(value?.isTexture)watch(value);
    }
  }
  for(const child of node.children)copy.add(borrowedView(child,views,watch));
  return copy;
}
function sourceProfile(part,id,signal){
  part.updateWorldMatrix(true,true);
  const elements=part.matrixWorld.elements;
  if(elements.some(v=>!Number.isFinite(v))||elements[3]!==0||elements[7]!==0||elements[11]!==0||elements[15]!==1||!(part.matrixWorld.determinant()>0))throw new Error('A positive finite affine source frame is required.');
  const inverse=part.matrixWorld.clone().invert(),point=new THREE.Vector3(),matrix=new THREE.Matrix4(),roots=[],box=new THREE.Box3();let triangles=0;
  part.traverse(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry,p=geometry?.attributes.position;
    if(!p||!geometry.attributes.normal)throw new Error('Missing original planting position/normal.');
    const local=new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld),base=geometry.boundingBox??new THREE.Box3().setFromBufferAttribute(p);
    let bounds=base;
    if(node.isInstancedMesh){
      bounds=node.boundingBox?.clone()??new THREE.Box3();
      if(!node.boundingBox)for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);bounds.union(base.clone().applyMatrix4(matrix));}
    }
    box.union(bounds.clone().applyMatrix4(local));
    triangles+=(geometry.index?.count??p.count)/3*(node.isInstancedMesh?node.count:1);
    if(node.isInstancedMesh||species[id].root&&node.name!==species[id].root)return;
    for(let i=0;i<p.count;i++){if(i%8192===0)signal?.throwIfAborted();point.fromBufferAttribute(p,i).applyMatrix4(local);if(point.y<=0)roots.push(point.toArray());}
  });
  if(!triangles||!roots.length||box.isEmpty()||[...box.min.toArray(),...box.max.toArray()].some(v=>!Number.isFinite(v)))throw new Error('Missing finite original planting/root geometry '+id);
  return {roots,box,triangles};
}

/** Prepare only one explicitly requested region; no default whole-route load.
 * Sources, terrain and architecture are borrowed. All source geometry, PBR,
 * UV, colors and instance attributes stay shared by identity. Mount group in
 * world space without an extra transform. Dispose views before their owners.
 * After changing terrain/roads, call assertCurrent() before showing the region;
 * a stale region is hidden and must be prepared again, never silently nudged. */
export async function createWesternGardenPlantingRegion({regionId,terrain,architecture,sources,plantingLayout=createWesternGardenPlantingLayout(),reservedPolygons=[],signal,yieldControl=yieldFrame}={}){
  signal?.throwIfAborted();
  const plan=createWesternGardenPlantingPlan({regionId,terrain,architecture,plantingLayout,reservedPolygons});
  if(!plan.valid){const error=new Error('Western planting region has '+plan.rejected.length+' rejected positions; no views created.');error.plan=plan;throw error;}
  const group=new THREE.Group();group.name='western-planting-'+regionId;
  group.userData={body:'regional-exhibition-planting',worldCoordinates:true,historicallySurveyed:false,nativeCompositionReviewed:false,sourceGeometryChanged:false};
  const parts=[],views=[],listeners=new Map(),profiles=new Map(),owners=new Set(),diagnostics={id:group.name,plan,borrowedSourceInvalidated:false,trianglesPerPass:0,rootsChecked:0,maximumRootGap:-Infinity,ownedGeometries:0,ownedMaterials:0,ownedTextures:0,instanceAttributesSharedByIdentity:true,nativeCompositionReviewed:false,historicallySurveyed:false};
  let disposed=false;
  function dispose(){
    if(disposed)return;disposed=true;
    const errors=[],run=f=>{try{f();}catch(e){errors.push(e);}};
    run(()=>group.removeFromParent());run(()=>group.clear());for(const part of parts)run(()=>part.clear());
    for(const [resource,listener]of listeners)run(()=>resource.removeEventListener('dispose',listener));listeners.clear();
    for(const {copy,emptyMatrix}of views)run(()=>{
      // r185 WebGLObjects.dispose removes instance attributes as well as VAOs.
      // Detach borrowed attributes first: disposing one region must not delete
      // another region's or the retained pilot's still-live GPU buffers.
      copy.instanceMatrix=emptyMatrix;copy.instanceColor=null;copy.dispose();
    });
    views.length=0;profiles.clear();owners.clear();
    if(errors.length)throw new AggregateError(errors,'Western planting view disposal failed.');
  }
  function watch(resource){if(listeners.has(resource))return;const listener=()=>{diagnostics.borrowedSourceInvalidated=true;group.visible=false;dispose();};listeners.set(resource,listener);resource.addEventListener('dispose',listener);}
  function checkEpoch(){
    if(disposed||terrain.disposed||architecture.disposed||[...owners].some(owner=>owner.disposed)||stamp(terrain)!==plan.terrainStamp){group.visible=false;throw new Error('Western planting support/owner changed; reprepare the region.');}
  }
  function assertCurrent(){
    try{
      checkEpoch();
      for(const p of plan.placements)if(architecture.intersectsGuideVolume(volume(p.position[0],p.position[2],p.position[1],p.envelope.radius,p.envelope.height))!==false)throw new Error('Western planting current architecture changed; reprepare the region.');
      return true;
    }catch(error){group.visible=false;throw error;}
  }
  try{
    for(const p of plan.placements){
      signal?.throwIfAborted();checkEpoch();
      const source=sources?.[p.species];
      if(!source?.part?.isObject3D||source.owner?.disposed||typeof source.owner?.dispose!=='function'||!source.review)throw new Error('Missing live reviewed source binding '+p.species);
      owners.add(source.owner);
      let profile=profiles.get(p.species);if(!profile){profile=sourceProfile(source.part,p.species,signal);profiles.set(p.species,profile);}
      const radius=Math.hypot(Math.max(Math.abs(profile.box.min.x),Math.abs(profile.box.max.x)),Math.max(Math.abs(profile.box.min.z),Math.abs(profile.box.max.z)))*p.scale;
      if(radius>p.envelope.radius+EPS||profile.box.max.y*p.scale>p.envelope.height+EPS)throw new Error('The actual source outgrew its reserved envelope: '+p.id);
      const part=new THREE.Group();part.name='western-planting-'+p.id;part.userData={species:p.species,placementId:p.id,evidence:p.evidence,sourceReview:source.review};
      const copy=borrowedView(source.part,views,watch);
      copy.position.set(0,0,0);copy.quaternion.identity();copy.scale.set(1,1,1);copy.updateMatrix();
      part.add(copy);part.position.fromArray(p.position);part.rotation.y=p.yaw;part.scale.setScalar(p.scale);part.updateMatrix();
      let low=p.position[1];const samples=[],v=new THREE.Vector3(),local=new THREE.Matrix4().makeRotationY(p.yaw).scale(new THREE.Vector3(p.scale,p.scale,p.scale));
      for(let i=0;i<profile.roots.length;i++){if(i%8192===0)signal?.throwIfAborted();v.fromArray(profile.roots[i]).applyMatrix4(local);const hit=surface(terrain,p.position[0]+v.x,p.position[2]+v.z);low=Math.min(low,hit.height-v.y-p.burial);samples.push({height:hit.height,localY:v.y});}
      if(p.position[1]-low>.18*p.scale)throw new Error('Actual root contacts require excessive burial: '+p.id);
      part.position.y=low;part.updateMatrix();p.position[1]=low;
      if(architecture.intersectsGuideVolume(volume(p.position[0],p.position[2],low,p.envelope.radius,p.envelope.height))!==false)throw new Error('Grounded source enters current architecture: '+p.id);
      let maxGap=-Infinity,minGap=Infinity;
      for(const sample of samples){const gap=low+sample.localY-sample.height;maxGap=Math.max(maxGap,gap);minGap=Math.min(minGap,gap);}
      p.grounding.actualRootVertices=samples.length;p.grounding.maximumRootGap=maxGap;p.grounding.minimumRootGap=minGap;
      diagnostics.rootsChecked+=samples.length;diagnostics.maximumRootGap=Math.max(diagnostics.maximumRootGap,maxGap);diagnostics.trianglesPerPass+=profile.triangles;
      group.add(part);parts.push(part);
      await yieldControl();signal?.throwIfAborted();checkEpoch();
    }
    assertCurrent();group.updateMatrixWorld(true);diagnostics.drawnParts=parts.length;diagnostics.instanceViews=views.length;diagnostics.borrowedSpecies=[...profiles.keys()];
    return {group,parts,plan,diagnostics,collisionSources:{group,parts:parts.filter(p=>!!species[p.userData.species].root)},assertCurrent,get disposed(){return disposed;},dispose};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Western planting preparation and cleanup failed.');}throw error;}
}
