import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createArchitectureSurface} from './architecture-surface.js';
import {extrudedPolygon} from './study-geometry.js';
import {pointInPolygon} from './garden-layout.js';
import {createXieqiquCourtGardenR1Layout} from './xieqiqu-court-garden-r1-layout.js';

const active=new WeakMap(),yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
const ringBox=ring=>new THREE.Box3().setFromPoints(ring.map(([x,z])=>V(x,0,z)));
function clipConvex(subject,clip){
  let result=subject.map(p=>[...p]);
  const orientation=Math.sign(clip.reduce((sum,p,i)=>{const q=clip[(i+1)%clip.length];return sum+p[0]*q[1]-q[0]*p[1];},0));
  for(let i=0;i<clip.length&&result.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length],input=result;result=[];
    const side=p=>orientation*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
    for(let j=0;j<input.length;j++){
      const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q);
      if(sp>=-1e-10)result.push(p);
      if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
  }
  return result;
}
function visibleWithin(node,root){
  for(let p=node;p;p=p.parent){if(p.visible===false)return false;if(p===root)return true;}
  return false;
}
function oneMesh(root,name){
  const group=root.getObjectByName(name),meshes=[];
  group?.traverse(node=>{if(node.isMesh)meshes.push(node);});
  if(!group||meshes.length!==1||meshes[0].isInstancedMesh||Array.isArray(meshes[0].material))throw new Error('Expected original single Xieqiqu mesh: '+name);
  return meshes[0];
}
function matrixIn(root,node){
  root.updateWorldMatrix(true,true);return root.matrixWorld.clone().invert().multiply(node.matrixWorld);
}
function matrixEqual(a,b){return a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-8);}
function worldVolume(box,matrix){
  const world=box.clone().applyMatrix4(matrix),planes=[];
  for(const [normal,c]of [[V(1,0,0),-box.max.x],[V(-1,0,0),box.min.x],[V(0,1,0),-box.max.y],[V(0,-1,0),box.min.y],[V(0,0,1),-box.max.z],[V(0,0,-1),box.min.z]]){
    const p=new THREE.Plane(normal,c).applyMatrix4(matrix);planes.push([p.normal.x,p.normal.y,p.normal.z,-p.constant]);
  }
  const centre=box.getCenter(V()).applyMatrix4(matrix);
  return {bounds:{minX:world.min.x,maxX:world.max.x,minY:world.min.y,maxY:world.max.y,minZ:world.min.z,maxZ:world.max.z},planes,interiorPoint:{x:centre.x,y:centre.y,z:centre.z}};
}
function reserved(box,reservations){
  const ring=[[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]];
  return reservations.filter(r=>{
    if(r.polygon)return area(clipConvex(ring,r.polygon))>1e-8;
    const [x,z,radius]=r.circle,dx=x-Math.max(box.min.x,Math.min(box.max.x,x)),dz=z-Math.max(box.min.z,Math.min(box.max.z,z));
    return dx*dx+dz*dz<radius*radius;
  }).map(r=>r.id);
}
function soilTexture(){
  const size=256,data=new Uint8Array(size*size*4);let seed=9471;
  for(let i=0;i<size*size;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=114+(seed>>>24)%45;data.set([value,value,value,255],i*4);}
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name='xieqiqu-court-garden-r1-fine-mineral-grain';texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(5,5);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
function borderGeometry(outer,inner,bottom,top){
  const shape=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));
  shape.holes.push(new THREE.Path(inner.map(([x,z])=>new THREE.Vector2(x,-z))));
  const g=new THREE.ExtrudeGeometry(shape,{depth:top-bottom-.02,steps:1,bevelEnabled:true,bevelSegments:3,bevelThickness:.01,bevelSize:.014,curveSegments:20});
  g.rotateX(-Math.PI/2);g.translate(0,bottom+.01,0);return g;
}
function floorReader(root,floor){
  const matrix=matrixIn(root,floor),inverse=matrix.clone().invert(),g=floor.geometry,p=g?.attributes.position,index=g?.index,count=index?.count??p?.count;
  if(!p||!g.attributes.normal||!Number.isInteger(count)||count%3||g.drawRange.start!==0||g.drawRange.count!==Infinity&&g.drawRange.count!==count)throw new Error('Court floor must be the complete drawn source geometry');
  const tree=new MeshBVH(g,{indirect:true,setBoundingBox:false}),triangles=[];
  for(let i=0;i<count;i+=3){
    const vertices=[0,1,2].map(j=>V().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(matrix));
    const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
    if(normal.y>1e-10&&vertices.every(v=>Math.abs(v.y)<1e-6))triangles.push(vertices.map(v=>[v.x,v.z]));
  }
  if(!triangles.length)throw new Error('No actual local-zero top triangles in court floor');
  const ray=new THREE.Ray(),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
  return {matrix,triangles,geometry:g,
    sample(x,z){
      ray.origin.copy(V(x,1,z).applyMatrix4(inverse));ray.direction.copy(V(0,-1,0).transformDirection(inverse));
      const hit=tree.raycastFirst(ray,THREE.FrontSide);if(!hit)return null;
      const point=hit.point.clone().applyMatrix4(matrix),normal=hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
      return {point,normal,triangle:hit.faceIndex};
    },
    coverage(ring){return triangles.reduce((sum,t)=>sum+area(clipConvex(t,ring)),0);},
  };
}
function readPlant(part,signal){
  part.updateWorldMatrix(true,true);const inverse=part.matrixWorld.clone().invert(),records=[],roots=[],bounds=new THREE.Box3(),seenRoots=new Set();
  let triangles=0;
  part.traverse(node=>{
    if(!node.isMesh)return;signal?.throwIfAborted();
    if(node.isInstancedMesh||node.isSkinnedMesh||node.isBatchedMesh||node.morphTargetInfluences||!visibleWithin(node,part)||node.material?.visible===false)throw new Error('Court garden requires complete visible static understory source meshes');
    const g=node.geometry,p=g?.attributes.position,index=g?.index,count=index?.count??p?.count;
    if(!p||!g.attributes.normal||!Number.isInteger(count)||count%3||g.drawRange.start!==0||g.drawRange.count!==Infinity&&g.drawRange.count!==count)throw new Error('Incomplete original understory source geometry');
    const matrix=inverse.clone().multiply(node.matrixWorld),box=(g.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(p)).applyMatrix4(matrix);
    bounds.union(box);triangles+=count/3;records.push({node,matrix});
    if(box.min.y>.005)return;
    for(let i=0;i<p.count;i++){
      if(i%8192===0)signal?.throwIfAborted();const q=V().fromBufferAttribute(p,i).applyMatrix4(matrix);
      if(q.y>.005)continue;const key=[q.x,q.y,q.z].map(v=>Math.round(v*1e6)).join(',');
      if(!seenRoots.has(key)){seenRoots.add(key);roots.push(q);}
    }
  });
  if(bounds.isEmpty()||!roots.length||!triangles)throw new Error('Missing actual rooted source geometry');
  return {records,roots,bounds,triangles};
}

/** A bounded actual-geometry audit before composition builds its main BVHs.
 * Read real mesh/instance bounds, then retain triangles only where they could
 * intersect this low north-court candidate. The slab and tiny old joints are
 * below the query band. An out-of-band request fails closed.
 */
export function createXieqiquCourtGardenR1ArchitectureAudit(owner,{signal}={}){
  const root=owner?.group;if(!root?.isObject3D||owner.disposed)throw new Error('The original Xieqiqu owner is required for its court audit');
  root.updateWorldMatrix(true,true);
  const region=new THREE.Box3(V(-32,.023,-44),V(32,3,-16.1)).applyMatrix4(root.matrixWorld),instances=new THREE.Matrix4();
  const support=createArchitectureSurface(root,{signal,include:node=>{
    if(node.userData.navigation===false||node.material?.transparent||!node.geometry?.attributes.position)return false;
    const bounds=node.geometry.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(node.geometry.attributes.position);
    if(!node.isInstancedMesh)return bounds.applyMatrix4(node.matrixWorld).intersectsBox(region);
    for(let i=0;i<node.count;i++){node.getMatrixAt(i,instances);if(bounds.clone().applyMatrix4(node.matrixWorld.clone().multiply(instances)).intersectsBox(region))return true;}
    return false;
  }});
  return {get disposed(){return support.disposed;},dispose:()=>support.dispose(),get diagnostics(){return {...support.diagnostics,boundedNorthCourt:true};},
    intersectsGuideVolume(volume){
      const b=volume?.bounds;if(!b||b.minX<region.min.x-1e-6||b.maxX>region.max.x+1e-6||b.minY<region.min.y-1e-6||b.maxY>region.max.y+1e-6||b.minZ<region.min.z-1e-6||b.maxZ>region.max.z+1e-6)return true;
      return support.intersectsGuideVolume(volume);
    },
  };
}

/** Opt-in addition to one complete Xieqiqu owner.
 * sources are borrowed bindings returned by the existing western source loader.
 * layout is the same frozen R1/R2 plan used to prepare those sources; R1 is default.
 * architecture may borrow the current retained support; omission builds a bounded
 * original-geometry audit. buildSupport:false is for a pre-composition wrapper:
 * the real composition then includes the new bodies and excludes all foliage.
 * The returned owner owns only its new surfaces/materials/instance attributes.
 * Keep the base owner and source loader alive until after dispose().
 * Compose returned support with retained architecture for actual bed/apron walking.
 */
export async function prepareXieqiquCourtGardenR1({owner,sources,layout=createXieqiquCourtGardenR1Layout(),architecture,buildSupport=true,signal,onProgress=()=>{},yieldControl=yieldTask}={}){
  signal?.throwIfAborted();
  const root=owner?.group;
  if(!root?.isObject3D||owner.disposed||!root.children.length||owner.collisionGroup&&owner.collisionGroup!==root||typeof buildSupport!=='boolean'||architecture&&(typeof architecture.intersectsGuideVolume!=='function'||architecture.disposed)||active.has(root))throw new Error('A complete unused placed Xieqiqu owner and current source support are required');
  for(const name of ['xieqiqu-main-hall','xieqiqu-northwest-reservoir','xieqiqu-south-haitang-pool','xieqiqu-north-chrysanthemum-pool','xieqiqu-west-octagonal-music-pavilion','xieqiqu-east-octagonal-music-pavilion','north-pool-concentric-paving','south-lake-balustrade-and-viewing-landing'])
    if(!root.getObjectByName(name))throw new Error('Incomplete original Xieqiqu owner: '+name);
  const floor=oneMesh(root,'xieqiqu-court-paving'),originalMaterial=floor.material,originalGeometry=floor.geometry;
  if(!visibleWithin(floor,root)||originalMaterial.visible===false||originalMaterial.transparent)throw new Error('The actual court floor must be visible and opaque');
  const plan=layout,group=new THREE.Group(),stage=new THREE.Group(),geometries=new Set(),materials=new Set(),textures=new Set(),instances=[],listeners=new Map(),sourceOwners=new Set();
  const diagnostics={id:plan.id,evidence:plan.evidence,nativeReviewed:false,historicallySurveyed:false,sourceGeometryChanged:false,
    bedCount:plan.beds.length,plantCount:plan.placements.length,plantCounts:{},floorCoverage:[],floorContactChecks:0,rootContactChecks:0,maximumRootGap:-Infinity,maximumRootBurial:0,
    architectureChecks:0,actualSourceTriangles:0,drawnPlantTriangles:0,ownedSurfaceTriangles:0,sourceInvalidated:false,materialRestored:false,errors:[]};
  group.name=plan.id;group.userData={...plan.evidence,body:'low-north-court-garden-candidate'};
  root.updateWorldMatrix(true,true);const frame=root.matrixWorld.clone();
  if(!frame.elements.every(Number.isFinite)||frame.determinant()<=0)throw new Error('Invalid Xieqiqu world frame');
  stage.matrixAutoUpdate=false;stage.matrix.copy(frame);stage.add(group);stage.updateMatrixWorld(true);
  let disposed=false,displayMaterial,support=null,supportFrame=null,reader,ownedAudit=null;
  const readIdentity=()=>matrixEqual(matrixIn(root,floor),reader.matrix)&&floor.geometry===originalGeometry;
  function dispose(){
    if(disposed)return;disposed=true;active.delete(root);signal?.removeEventListener('abort',cancel);
    const errors=[],run=f=>{try{f();}catch(e){errors.push(e);diagnostics.errors.push(String(e?.message??e));}};
    run(()=>support?.dispose());support=null;run(()=>ownedAudit?.dispose());ownedAudit=null;
    run(()=>group.removeFromParent());
    if(displayMaterial&&floor.material===displayMaterial)run(()=>{floor.material=originalMaterial;diagnostics.materialRestored=true;});
    for(const [resource,listener]of listeners)run(()=>resource.removeEventListener('dispose',listener));listeners.clear();
    for(const mesh of instances)run(()=>mesh.dispose());instances.length=0;
    run(()=>group.clear());run(()=>stage.clear());
    for(const resource of geometries)run(()=>resource.dispose());geometries.clear();
    for(const resource of materials)run(()=>resource.dispose());materials.clear();
    for(const resource of textures)run(()=>resource.dispose());textures.clear();
    if(errors.length)throw new AggregateError(errors,'Court garden cleanup failed');
  }
  function cancel(){try{dispose();}catch{/* diagnostics retain attempted cleanup failures */}}
  function watch(resource){
    if(!resource?.addEventListener||listeners.has(resource))return;
    const listener=()=>{diagnostics.sourceInvalidated=true;cancel();};listeners.set(resource,listener);resource.addEventListener('dispose',listener);
  }
  function guard(){
    signal?.throwIfAborted();
    if(disposed||owner.disposed||!root.children.length||[...sourceOwners].some(value=>value.disposed)||reader&&!readIdentity())throw new Error('Court garden source/floor was invalidated');
  }
  function material(base,name,colour){
    const m=base.clone();m.name=plan.id+'-'+name;m.color.setHex(colour);m.roughness=.94;
    m.userData={...base.userData,...plan.evidence,body:'contemporary-court-garden-material'};materials.add(m);return m;
  }
  function mesh(name,geometry,mat){
    geometries.add(geometry);geometry.name=plan.id+'-'+name;diagnostics.ownedSurfaceTriangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
    const object=new THREE.Mesh(geometry,mat);object.name=geometry.name;object.castShadow=object.receiveShadow=true;object.userData={courtGardenSurface:true,evidence:'contemporary-exhibition-design'};group.add(object);return object;
  }
  function checkArchitecture(box,label){
    diagnostics.architectureChecks++;
    if(architecture.disposed||architecture.intersectsGuideVolume(worldVolume(box,frame))!==false)throw new Error('Existing architecture conflicts with '+label);
  }
  signal?.addEventListener('abort',cancel,{once:true});active.set(root,{pending:true});
  try{
    guard();reader=floorReader(root,floor);watch(originalGeometry);watch(originalMaterial);
    if(!architecture){ownedAudit=createXieqiquCourtGardenR1ArchitectureAudit(owner,{signal});architecture=ownedAudit;}
    diagnostics.architectureAudit=architecture.diagnostics??{borrowedActualTriangleQuery:true};
    for(const value of Object.values(originalMaterial))if(value?.isTexture)watch(value);
    for(const [x,z]of [[0,-27],[0,26]])if(reader.sample(x,z))throw new Error('Both original flower-pool floor holes must remain open');
    displayMaterial=material(originalMaterial,'court-paving',0xb5b3a4);
    const apronMaterial=material(originalMaterial,'mineral-apron',0x9b9f92),borderMaterial=material(originalMaterial,'low-cut-stone-edge',0xc2c1b3);
    const grain=soilTexture();textures.add(grain);
    const soilMaterial=new THREE.MeshStandardMaterial({name:plan.id+'-fine-planted-earth',color:0x566345,roughness:.98,bumpMap:grain,bumpScale:.023});
    soilMaterial.userData={...plan.evidence,body:'fine-mineral-earth-surface'};materials.add(soilMaterial);
    const beds=new Map();
    for(const bed of plan.beds){
      guard();
      const box=ringBox(bed.apron),conflicts=reserved(box,plan.reservations);if(conflicts.length)throw new Error('Garden bed enters reserved '+conflicts.join(', '));
      const expected=area(bed.apron),covered=reader.coverage(bed.apron),missing=Math.max(0,expected-covered);
      diagnostics.floorCoverage.push({id:bed.id,expected,covered,missing});
      if(Math.abs(expected-covered)>2e-4)throw new Error('Actual visible court triangles do not cover '+bed.id);
      for(const [x,z]of [...bed.apron,[bed.cx,bed.cz]]){
        const hit=reader.sample(x,z);diagnostics.floorContactChecks++;
        if(!hit||Math.abs(hit.point.y)>1e-6||hit.normal.y<.99)throw new Error('Missing original floor contact at '+bed.id);
      }
      box.min.y=.027;box.max.y=plan.levels.borderTop+.01;checkArchitecture(box,bed.id);
      mesh(bed.id+'-apron',extrudedPolygon(bed.apron,-.002,plan.levels.apronTop),apronMaterial);
      mesh(bed.id+'-bevelled-border',borderGeometry(bed.outer,bed.inner,.014,plan.levels.borderTop),borderMaterial);
      const soil=mesh(bed.id+'-soil',extrudedPolygon(bed.inner,-.002,plan.levels.soilTop),soilMaterial);
      const tree=new MeshBVH(soil.geometry,{indirect:true,setBoundingBox:false});
      beds.set(bed.id,{bed,soil,tree});onProgress({stage:'bed-surfaces',id:bed.id});guard();await yieldControl();guard();
    }
    const profiles=new Map();
    for(const species of ['sedge','flower-shrub']){
      guard();const source=sources?.[species];
      if(!source?.part?.isObject3D||source.part.userData.id!==species||!source.owner||source.owner.disposed||typeof source.review!=='string'||!source.review.includes('garden-understory-native-r2'))throw new Error('The full reviewed understory source is required: '+species);
      sourceOwners.add(source.owner);const profile=readPlant(source.part,signal);profiles.set(species,profile);diagnostics.actualSourceTriangles+=profile.triangles;
      for(const {node}of profile.records){
        watch(node.geometry);
        for(const m of [...(Array.isArray(node.material)?node.material:[node.material]),node.customDepthMaterial,node.customDistanceMaterial].filter(Boolean)){
          watch(m);for(const t of Object.values(m))if(t?.isTexture)watch(t);
        }
      }
      onProgress({stage:'source-profile',id:species});guard();await yieldControl();guard();
    }
    for(const species of ['sedge','flower-shrub']){
      const profile=profiles.get(species),placements=plan.placements.filter(p=>p.species===species),matrices=new Map(plan.beds.map(bed=>[bed.id,[]]));
      diagnostics.plantCounts[species]=placements.length;
      for(const p of placements){
        guard();const {bed,tree}=beds.get(p.bedId),matrix=new THREE.Matrix4().compose(V(p.x,plan.levels.soilTop-plan.levels.rootBurial,p.z),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),p.yaw),V(p.scale,p.scale,p.scale));
        const box=profile.bounds.clone().applyMatrix4(matrix),conflicts=reserved(box,plan.reservations);
        if(conflicts.length)throw new Error('Plant crown enters reserved '+conflicts.join(', '));
        box.min.y=Math.max(.027,box.min.y);checkArchitecture(box,p.id);
        for(const rootPoint of profile.roots){
          const point=rootPoint.clone().applyMatrix4(matrix);
          const ray=new THREE.Ray(V(point.x,plan.levels.soilTop+.5,point.z),V(0,-1,0)),hit=tree.raycastFirst(ray,THREE.FrontSide);
          if(!pointInPolygon([point.x,point.z],bed.inner)||!hit)throw new Error('Original plant root leaves actual bed triangles: '+p.id);
          const gap=point.y-hit.point.y;diagnostics.rootContactChecks++;diagnostics.maximumRootGap=Math.max(diagnostics.maximumRootGap,gap);diagnostics.maximumRootBurial=Math.max(diagnostics.maximumRootBurial,-gap);
          if(gap>.004||gap<-.035)throw new Error('Original root does not meet actual soil surface: '+p.id);
        }
        matrices.get(p.bedId).push(matrix);
      }
      for(const bed of plan.beds){
        const batch=matrices.get(bed.id);if(!batch.length)continue;
        for(const {node,matrix:sourceMatrix}of profile.records){
          guard();const copy=new THREE.InstancedMesh(node.geometry,node.material,batch.length);instances.push(copy);
          copy.name=plan.id+'-'+bed.id+'-'+node.name;copy.castShadow=node.castShadow;copy.receiveShadow=node.receiveShadow;copy.renderOrder=node.renderOrder;
          copy.userData={...node.userData,navigation:false,borrowedOriginalGeometry:true,sourceSpecies:species,sourceBedId:bed.id};
          for(const key of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','customDepthMaterial','customDistanceMaterial'])copy[key]=node[key];
          for(let i=0;i<batch.length;i++)copy.setMatrixAt(i,batch[i].clone().multiply(sourceMatrix));
          copy.instanceMatrix.needsUpdate=true;copy.computeBoundingBox();copy.computeBoundingSphere();group.add(copy);
        }
      }
      diagnostics.drawnPlantTriangles+=profile.triangles*placements.length;
      onProgress({stage:'plant-instances',id:species});guard();await yieldControl();guard();
    }
    guard();
    if(!matrixEqual(root.matrixWorld,frame))throw new Error('Xieqiqu moved during court preparation');
    if(floor.material!==originalMaterial||!visibleWithin(floor,root))throw new Error('Court material changed during preparation');
    floor.material=displayMaterial;root.add(group);root.updateWorldMatrix(true,true);
    if(buildSupport){support=createArchitectureSurface(group,{include:node=>node.userData.courtGardenSurface===true});supportFrame=root.matrixWorld.clone();}
    ownedAudit?.dispose();ownedAudit=null;
    onProgress({stage:'ready',id:plan.id});guard();
    const binding={group,plan,diagnostics,dispose,get support(){return disposed?null:support;},get disposed(){return disposed;},
      createSupport(){
        guard();if(group.parent!==root)throw new Error('Attach the court garden before creating support');
        if(support){if(!matrixEqual(root.matrixWorld,supportFrame))throw new Error('Court support moved; reprepare');return support;}
        support=createArchitectureSurface(group,{include:node=>node.userData.courtGardenSurface===true});supportFrame=root.matrixWorld.clone();return support;
      },
      assertCurrent(){
        try{guard();if(group.parent!==root||floor.material!==displayMaterial||!visibleWithin(floor,root)||support&&!matrixEqual(root.matrixWorld,supportFrame))throw new Error('Court garden placement/material changed; reprepare');return true;}
        catch(error){cancel();throw error;}
      },
    };
    active.set(root,binding);return binding;
  }catch(error){
    try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Court garden preparation and rollback failed');}
    throw error;
  }
}
