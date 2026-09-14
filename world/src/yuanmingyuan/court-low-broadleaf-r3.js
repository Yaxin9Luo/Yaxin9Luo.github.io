import {understoryCurveStemGeometry,understoryPose} from './garden-understory-geometry.js';
import {createSmoothBroadleafLamina} from './court-broadleaf-lamina-r3.js';
import {bilberryLeafContour} from './court-bilberry-contour-r3.js';
import {VegetationGeometryBatch,seededGardenRandom} from './vegetation-geometry.js';

export const courtLowBroadleafR3Id='court-low-broadleaf-r3';
export const courtLowBroadleafR3LeafSpecs=Object.freeze([
 Object.freeze({id:'broad-ovate',length:.076,width:.040,curl:.0042,cup:.085,color:'#537346',edgeColor:'#3f5d37',seed:41}),
 Object.freeze({id:'soft-ovate',length:.068,width:.035,curl:.0052,cup:.10,color:'#607c4c',edgeColor:'#45633b',seed:73}),
 Object.freeze({id:'spring-ovate',length:.057,width:.030,curl:.0031,cup:.075,color:'#85964f',edgeColor:'#5d763f',seed:109}),
]);

// Original contemporary exhibition geometry. No historical species or specimen claim.
export function createCourtLowBroadleafR3({THREE:T,signal,seed=831427,leafSurface=null}={}){
 if(!T?.Group||!Number.isInteger(seed))throw new TypeError('Canonical THREE and an integer seed are required');
 signal?.throwIfAborted();
 if(leafSurface){
  if(leafSurface.disposed||typeof leafSurface.dispose!=='function'||!['opengl','directx'].includes(leafSurface.normalConvention))throw new Error('A live exclusive leaf surface lease and explicit normal convention are required');
  for(const key of ['map','normalMap','roughnessMap'])if(!leafSurface[key]?.isTexture)throw new Error('The leaf surface lease requires all three original texture objects');
  if(leafSurface.map.colorSpace!==T.SRGBColorSpace||leafSurface.normalMap.colorSpace!==T.NoColorSpace||leafSurface.roughnessMap.colorSpace!==T.NoColorSpace)throw new Error('Leaf colour must be sRGB; normal and roughness must be linear data');
  if(leafSurface.diagnostics?.files?.map?.sha256!==bilberryLeafContour.sourceSha256||leafSurface.diagnostics?.effectiveImageTopV!==1)throw new Error('This contour requires the original BilberryLeaf01 front source and image top at v=1');
 }
 // A valid lease is adopted here. Rejected/pre-aborted calls leave it with the caller.
 let surfaceAdopted=!!leafSurface;
 const V=(...a)=>new T.Vector3(...a),rng=seededGardenRandom(seed),TAU=Math.PI*2;
 const geometries=new Set(),materials=new Set(),temporary=new Set(),group=new T.Group(),part=new T.Group();
 group.name=courtLowBroadleafR3Id;part.name='low-broadleaf';group.add(part);
 part.userData={id:'low-broadleaf',sourceAssetId:courtLowBroadleafR3Id,windAmplitude:0,historicalSpecies:false,authoredExhibitionPlant:true};
 const detail=new T.Group();detail.name='broadleaf-r3-detail-shoot';part.add(detail);
 const records={branches:[],leaves:[],joins:[],lobes:[]},counts={leafVariants:[0,0,0],basalCanes:0,secondaryShoots:0};
 let disposed=false,diagnostics;
 const cleanup=()=>{
  if(disposed)return;disposed=true;group.removeFromParent();group.clear();
  const errors=[];
  for(const set of [temporary,geometries,materials]){
   for(const value of set){try{value.dispose();}catch(error){errors.push(error);}}
   set.clear();
  }
  if(surfaceAdopted){surfaceAdopted=false;try{leafSurface.dispose();}catch(error){errors.push(error);}}
  if(errors.length)throw new AggregateError(errors,'Broadleaf R3 resource cleanup failed');
 };
 const own=g=>{geometries.add(g);return g;};
 const addMesh=(parent,batch,material,name,data={})=>{
  if(!batch.positions.length)return null;
  const geometry=own(batch.finish()),mesh=new T.Mesh(geometry,material);mesh.name=name;
  mesh.castShadow=mesh.receiveShadow=true;mesh.userData={sourceAssetId:courtLowBroadleafR3Id,navigation:false,...data};parent.add(mesh);return mesh;
 };
 try{
  const leafMaterial=new T.MeshStandardMaterial({name:'court-r3-opaque-curved-green-leaf',color:0xffffff,vertexColors:true,roughness:leafSurface?1:.72,metalness:0,side:T.DoubleSide,map:leafSurface?.map??null,normalMap:leafSurface?.normalMap??null,roughnessMap:leafSurface?.roughnessMap??null});
  if(leafSurface)leafMaterial.normalScale.set(1,leafSurface.normalConvention==='directx'?-1:1);
  const woodMaterial=new T.MeshStandardMaterial({name:'court-r3-fine-living-wood',color:0xffffff,vertexColors:true,roughness:.89,metalness:0});
  materials.add(leafMaterial);materials.add(woodMaterial);
  const leafShapes=courtLowBroadleafR3LeafSpecs.map(spec=>{
   const g=createSmoothBroadleafLamina(T,{...spec,rows:64,columns:12,neutralSurface:!!leafSurface,name:'court-r3-'+spec.id});temporary.add(g);return g;
  });
  const wood=new VegetationGeometryBatch('court-r3-connected-inner-wood'),petioles=new VegetationGeometryBatch('court-r3-connected-petioles'),rootBatch=new VegetationGeometryBatch('court-r3-short-ground-roots');
  const leafBatches=leafShapes.map((_,i)=>new VegetationGeometryBatch('court-r3-ovate-leaves-'+i));
  const detailWood=new VegetationGeometryBatch('court-r3-detail-connected-shoot'),detailLeaves=leafShapes.map((_,i)=>new VegetationGeometryBatch('court-r3-detail-leaves-'+i));
  function addStem(curve,radii,kind,parentId=null,batch=wood,segments=24,radialSegments=8){
   signal?.throwIfAborted();
   const geometry=understoryCurveStemGeometry({curve,radii,segments,radialSegments,color:kind==='root'?'#615b44':kind==='petiole'?'#617446':'#5b6646',name:'court-r3-'+kind});
   temporary.add(geometry);batch.add(geometry);geometry.dispose();temporary.delete(geometry);
   const id=records.branches.length,root=curve.getPointAt(0),tip=curve.getPointAt(1);
   records.branches.push({id,parentId,kind,root:root.toArray(),tip:tip.toArray(),radii:[...radii],curveLength:curve.getLength()});
   return id;
  }
  function addLeaves(curve,branchId,phase,{kind='shoot',detail=false,youngTip=true,pitch=.027}={}){
   const len=curve.getLength(),nodes=Math.max(3,Math.ceil(len*.86/pitch)),outBatches=detail?detailLeaves:leafBatches;
   for(let node=0;node<nodes;node++){
    signal?.throwIfAborted();
    const t=.08+(node/(nodes-1))*.90,origin=curve.getPointAt(t),tangent=curve.getTangentAt(t).normalize();
    const angle=phase+node*.63+(rng()-.5)*.22,across=V(Math.cos(angle),.12,Math.sin(angle));
    across.addScaledVector(tangent,-across.dot(tangent));if(across.lengthSq()<1e-8)across.copy(V(1,0,0).cross(tangent));across.normalize();
    for(const side of [-1,1]){
     const direction=across.clone().multiplyScalar(side*.86).addScaledVector(tangent,.24).add(V(0,.18+rng()*.27,0)).normalize();
     // Green shoots stay near their parent; leaves form the body, not exposed radiating sticks.
     const end=origin.clone().addScaledVector(direction,.0045+rng()*.0045);
     const petiole=new T.CubicBezierCurve3(origin,origin.clone().lerp(end,.33),origin.clone().lerp(end,.72),end);
     const petioleId=addStem(petiole,[.00040,.00025,.00016],'petiole',branchId,detail?detailWood:petioles,3,6);
     const spring=youngTip&&node>=nodes-2&&rng()<.38;
     const variant=spring?2:(rng()<.54?0:1),size=.87+rng()*.22;
     const normal=V((rng()-.5)*.60,.72+rng()*.28,(rng()-.5)*.60);
     const matrix=understoryPose(end,direction,normal,[size*(.94+rng()*.11),size,size]);
     outBatches[variant].add(leafShapes[variant],matrix,.94+rng()*.10);
     const leafId=records.leaves.length;
     records.leaves.push({id:leafId,branchId,petioleId,variant,origin:end.toArray(),matrix:matrix.elements.slice(),kind,detail,young:spring});
     records.joins.push({kind:'leaf-petiole',parentId:petioleId,childId:leafId,parentPoint:end.toArray(),childPoint:new T.Vector3().applyMatrix4(matrix).toArray()});
     counts.leafVariants[variant]++;
    }
   }
  }
  const lobes=[
   {centre:[-.205,.565,-.035],width:.28,phase:.21,canes:3},
   {centre:[.175,.515,-.19],width:.265,phase:2.32,canes:3},
   {centre:[.15,.45,.195],width:.29,phase:4.58,canes:3},
  ];
  function keepInside(point){
   const rr=Math.hypot(point.x,point.z);if(rr>.425){point.x*=.425/rr;point.z*=.425/rr;}
   point.y=Math.max(.065,Math.min(.595,point.y));return point;
  }
  for(const[li,lobe]of lobes.entries()){
   records.lobes.push({...lobe,index:li});
   for(let ci=0;ci<lobe.canes;ci++){
    signal?.throwIfAborted();counts.basalCanes++;
    const k=li*3+ci,angle=k*2.399963+(rng()-.5)*.3;
    const root=V(Math.cos(angle)*(.018+.006*ci),-.023,Math.sin(angle)*(.018+.006*ci));
    const shoulder=V(...lobe.centre).add(V(Math.cos(lobe.phase+ci*2.1)*.077,-ci*.019,Math.sin(lobe.phase+ci*2.1)*.075));
    const main=new T.CubicBezierCurve3(root,root.clone().add(V(0,.20,0)).addScaledVector(V(shoulder.x,0,shoulder.z),.20),shoulder.clone().multiply(V(.72,.86,.72)),shoulder);
    const mainId=addStem(main,[.0046-ci*.00025,.0030,.00145,.00063],'basal-cane',null,wood,34,10);
    addLeaves(main,mainId,angle,{kind:'basal',pitch:.031,youngTip:true});
    const rootEnd=V(Math.cos(angle)*(.072+rng()*.022),-.030,Math.sin(angle)*(.068+rng()*.018));
    const rootCurve=new T.CubicBezierCurve3(root.clone().add(V(0,.027,0)),root.clone().add(V(0,.009,0)),rootEnd.clone().add(V(0,.012,0)),rootEnd);
    addStem(rootCurve,[.0035,.0026,.0013,.00025],'root',mainId,rootBatch,16,8);
    for(let j=0;j<5;j++){
     const t=.18+j*.165,origin=main.getPointAt(t),mother=main.getTangentAt(t).normalize();
     const az=lobe.phase+ci*2.0+j*2.21+(rng()-.5)*.5;
     const reach=.12+rng()*.09+(j<2?.035:0),tip=keepInside(origin.clone().add(V(Math.cos(az)*reach,(j<2?.025:.050)+rng()*.026,Math.sin(az)*reach)));
     const terminal=new T.CubicBezierCurve3(origin,origin.clone().addScaledVector(mother,reach*.32),tip.clone().lerp(origin,.27).add(V(0,.025,0)),tip);
     const selected=k===7&&j===3;
     const branchId=addStem(terminal,[.00165-j*.00014,.00090,.00036],'leafy-lateral',mainId,selected?detailWood:wood,22,8);
     records.joins.push({kind:'lateral',parentId:mainId,childId:branchId,parentPoint:origin.toArray(),childPoint:terminal.getPointAt(0).toArray()});
     addLeaves(terminal,branchId,az+.6,{kind:'lateral',detail:selected,pitch:.026,youngTip:true});
     for(let fork=0;fork<2;fork++){
      const u=.31+fork*.38,base=terminal.getPointAt(u),tangent=terminal.getTangentAt(u),turn=az+(fork?-.96:.93),length=.074+rng()*.052;
      const end=keepInside(base.clone().add(V(Math.cos(turn)*length,.026+rng()*.038,Math.sin(turn)*length)));
      const twig=new T.CubicBezierCurve3(base,base.clone().addScaledVector(tangent,length*.32),end.clone().lerp(base,.29).add(V(0,.011,0)),end);
      const twigId=addStem(twig,[.00076,.00043,.00020],'secondary-shoot',branchId,selected?detailWood:wood,16,7);counts.secondaryShoots++;
      records.joins.push({kind:'secondary',parentId:branchId,childId:twigId,parentPoint:base.toArray(),childPoint:twig.getPointAt(0).toArray()});
      addLeaves(twig,twigId,turn+.9,{kind:'secondary',detail:selected,pitch:.023,youngTip:fork===1});
     }
    }
   }
  }
  addMesh(part,rootBatch,woodMaterial,'court-r3-ground-roots',{rootContactMesh:true,botanicalPart:'root'});
  addMesh(part,wood,woodMaterial,'court-r3-connected-inner-wood',{botanicalPart:'wood'});
  addMesh(part,petioles,woodMaterial,'court-r3-leaf-petioles',{botanicalPart:'petiole'});
  leafBatches.forEach((batch,i)=>addMesh(part,batch,leafMaterial,'court-r3-real-ovate-leaves-'+i,{botanicalPart:'leaf',leafVariant:i,alphaCoverage:'actual-geometric-silhouette'}));
  addMesh(detail,detailWood,woodMaterial,'court-r3-detail-connected-wood',{botanicalPart:'wood'});
  detailLeaves.forEach((batch,i)=>addMesh(detail,batch,leafMaterial,'court-r3-detail-real-leaves-'+i,{botanicalPart:'leaf',leafVariant:i,alphaCoverage:'actual-geometric-silhouette'}));
  for(const g of temporary)g.dispose();temporary.clear();
  group.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(part),rootBox=new T.Box3(),rootPoints=[],seenRoots=new Set(),meshes=[];
  let triangles=0,rootRadius=0;
  part.traverse(node=>{
   if(!node.isMesh)return;
   const g=node.geometry,p=g.attributes.position;const tris=g.index.count/3;triangles+=tris;
   meshes.push({name:node.name,vertices:p.count,triangles:tris,kind:node.userData.botanicalPart,leafVariant:node.userData.leafVariant??null});
   for(let i=0;i<p.count;i++){
    const point=V().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);
    if(point.y>.005)continue;
    const key=point.toArray().map(x=>Math.round(x*1e7)).join(',');
    if(seenRoots.has(key))continue;seenRoots.add(key);
    rootPoints.push(point.toArray());rootBox.expandByPoint(point);rootRadius=Math.max(rootRadius,Math.hypot(point.x,point.z));
   }
  });
  diagnostics={id:courtLowBroadleafR3Id,assetId:courtLowBroadleafR3Id,seed,triangles,meshCount:meshes.length,meshes,
   counts:{...counts,leaves:records.leaves.length,branches:records.branches.length,joins:records.joins.length},leafSpecs:courtLowBroadleafR3LeafSpecs,leafGeometrySampling:{rows:64,columns:12,contourId:bilberryLeafContour.id,baseColorSha256:bilberryLeafContour.sourceSha256,originalImageTopV:1,periodicVeinDisplacement:false,periodicVertexColour:false},
   bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(V()).toArray()},
   root:{min:rootBox.min.toArray(),max:rootBox.max.toArray(),bandMaximumY:.005,bandVertices:rootPoints.length,radius:rootRadius},
   material:{maps:leafSurface?3:0,alphaTest:0,transparent:false,leafRoughness:leafSurface?1:.72,woodRoughness:.89,vertexColors:true,authoredGeometry:true,normalConvention:leafSurface?.normalConvention??null,surfaceLease:leafSurface?.diagnostics??null,uvAlignmentVerified:true,uvProof:'work/yuanmingyuan/court-low-broadleaf-r3-candidate/uv-triangle-proof.json'},
   geometryCount:geometries.size,materialCount:materials.size,windAmplitude:0,historicallySurveyed:false,nativeReviewed:false,visualAcceptance:false,integrationAcceptance:false,
   basedOn:'R2 seed and all branch/leaf placement generation retained exactly; independent smooth R3 lamina and exclusive optional material lease.',
   provenance:'Original contemporary geometric plant. R2 root/branch/leaf placement is retained; high-frequency periodic lamina displacement and vertex colour are removed. UV follows the verified original BilberryLeaf01 front contour. Optional original maps supply micro detail. No historical taxon assertion.'};
  signal?.throwIfAborted();
  return {id:courtLowBroadleafR3Id,group,part,parts:{'low-broadleaf':part},diagnostics,records,rootPoints,get disposed(){return disposed;},update(){},dispose:cleanup};
 }catch(error){
  try{cleanup();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Broadleaf R3 creation failed and cleanup reported errors',{cause:error});}
  throw error;
 }
}
