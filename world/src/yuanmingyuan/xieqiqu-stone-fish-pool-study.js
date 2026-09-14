import * as THREE from 'three';
import {createXieqiquSouthPoolContextStudy} from './xieqiqu-study.js';
import {createXieqiquStoneFishStudy} from './xieqiqu-stone-fish.js';
import {stoneFishMouth} from './xieqiqu-fish-surface.js';
import {createStoneFishTextureOwnerFromPixels,createStoneFishSharedMapMaterialOwner,createStoneFishMaterialView} from './xieqiqu-stone-fish-material-study.js';
import {stoneFishPoolStudyId} from './xieqiqu-stone-fish-pool-views.js';

export {prepareXieqiquStoneFishMaterialPixels} from './xieqiqu-stone-fish-material-study.js';
export {stoneFishPoolStudyId,stoneFishPoolStudyViews} from './xieqiqu-stone-fish-pool-views.js';
const check=(ok,message)=>{if(!ok)throw new Error('Stone fish pool: '+message);};
const seatWindow=Object.freeze({minX:-.22,maxX:.22,minZ:-.22,maxZ:.60,maximumY:.68,bottomY:.28,embedY:.003});
const seatParameterWindow=Object.freeze({minT:.28,maxT:.435,minAngle:1.33*Math.PI,maxAngle:1.67*Math.PI});
const trianglesOf=g=>(g.index?.count??g.attributes.position.count)/3;

function bellyGrid(geometry){
  // Small authoring fixtures may describe an exact bounded part of this same
  // lattice. Production derives it from the unchanged complete skin metadata.
  if(geometry.userData.bellySamplingGrid)return geometry.userData.bellySamplingGrid;
  const {sides,steps,construction}=geometry.userData,rows=(geometry.attributes.position.count-2)/sides,intro=rows-steps;
  check(construction==='single-closed-indexed-skin-with-invaginated-mouth-and-integral-scale-relief'&&sides===512&&steps===1280&&intro===40&&geometry.index.count===rows*sides*6,'unexpected original fish sampling topology');
  return {firstVertex:1+intro*sides,stride:sides,rowCount:steps,columnCount:sides,quadColumns:sides,firstTriangle:sides+intro*sides*2,tStart:1/steps,tStep:1/steps,angleStart:0,angleStep:Math.PI*2/sides};
}

/** The saddle's top uses complete triangles of the supplied real belly skin.
 * It is raised 3 mm into that skin; a separate wall and bottom close the stone.
 * No fish vertex, normal, index or UV is edited and no ellipsoid proxy is used.
 * This support shape is an authored assembly adaptation, not historic evidence. */
export function createStoneFishBellySeat(sourceGeometry){
  const p=sourceGeometry?.attributes?.position,index=sourceGeometry?.index;
  check(sourceGeometry?.isBufferGeometry&&p?.itemSize===3&&index&&index.count%3===0,'indexed fish belly geometry required');
  const grid=bellyGrid(sourceGeometry);
  check(Object.values(grid).every(Number.isFinite)&&grid.tStep>0&&grid.angleStep>0,'invalid source belly grid');
  const firstRow=Math.ceil((seatParameterWindow.minT-grid.tStart)/grid.tStep),lastRow=Math.floor((seatParameterWindow.maxT-grid.tStart)/grid.tStep),firstColumn=Math.ceil((seatParameterWindow.minAngle-grid.angleStart)/grid.angleStep),lastColumn=Math.floor((seatParameterWindow.maxAngle-grid.angleStart)/grid.angleStep);
  check(firstRow>=0&&lastRow<grid.rowCount&&lastRow>firstRow&&firstColumn>=0&&lastColumn<grid.columnCount&&lastColumn>firstColumn,'source does not contain the entire requested belly patch');
  const sourceVertices=[],sourceTriangles=[],sourceCorners=[],top=[],uv=[],roof=[],vertexMap=new Map(),edges=new Map();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  const inWindow=v=>v.x>=seatWindow.minX&&v.x<=seatWindow.maxX&&v.z>=seatWindow.minZ&&v.z<=seatWindow.maxZ&&v.y<=seatWindow.maximumY;
  const vertex=id=>{
    if(vertexMap.has(id))return vertexMap.get(id);
    const local=sourceVertices.length;sourceVertices.push(id);vertexMap.set(id,local);top.push(p.getX(id),p.getY(id)+seatWindow.embedY,p.getZ(id));uv.push(p.getX(id)*.8,(p.getY(id)+p.getZ(id))*.5);return local;
  };
  const edge=(from,to)=>{const key=from<to?`${from}:${to}`:`${to}:${from}`,old=edges.get(key);if(old){check(old.count===1&&old.from===to&&old.to===from,'belly patch has inconsistent or nonmanifold edges');old.count++;}else edges.set(key,{from,to,count:1});};
  // Use one continuous rectangular part of the actual source lattice. Filtering
  // fine relief one triangle at a time can make pinched corners and holes.
  // Every selected face must pass the same physical and normal checks; no face
  // is silently omitted to make a broken contact surface appear to pass.
  for(let row=firstRow;row<lastRow;row++)for(let column=firstColumn;column<lastColumn;column++)for(let half=0;half<2;half++){
    const triangle=grid.firstTriangle+(row*grid.quadColumns+column)*2+half,qa=grid.firstVertex+row*grid.stride+column,qb=qa+1,qd=qa+grid.stride,qc=qd+1,expected=half?[qb,qd,qc]:[qa,qd,qb];
    const ia=index.getX(triangle*3),ib=index.getX(triangle*3+1),ic=index.getX(triangle*3+2);a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
    check(ia===expected[0]&&ib===expected[1]&&ic===expected[2],'source belly cell topology changed');
    check(inWindow(a)&&inWindow(b)&&inWindow(c),'selected belly cell left the physical support window');
    normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));const length=normal.length();
    check(Number.isFinite(length)&&length>0&&normal.y/length<-.30,'selected belly cell is no longer a downward-facing contact');
    check(Math.min(a.y,b.y,c.y)>seatWindow.bottomY+.035,'belly is too low for the retained stone base');
    const v=[vertex(ia),vertex(ic),vertex(ib)];roof.push(...v);sourceTriangles.push(triangle);sourceCorners.push(ia,ib,ic);for(let j=0;j<3;j++)edge(v[j],v[(j+1)%3]);
  }
  check(sourceTriangles.length>=8,'no usable downward-facing belly patch');
  const boundary=[...edges.values()].filter(e=>e.count===1),next=new Map();
  for(const e of boundary){check(!next.has(e.from),'branch in belly boundary');next.set(e.from,e.to);}
  check(boundary.length>=4,'belly seat has no boundary');const loop=[],first=boundary[0].from;let at=first;
  do{check(next.has(at)&&!loop.includes(at),'open or self-repeating belly boundary');loop.push(at);at=next.get(at);}while(at!==first);
  check(loop.length===boundary.length,'belly patch has holes or disconnected components');
  const n=sourceVertices.length,positions=[...top],indices=[...roof];
  for(let i=0;i<n;i++){positions.push(top[i*3],seatWindow.bottomY,top[i*3+2]);uv.push(top[i*3]*.8,top[i*3+2]*.5);}
  for(let i=0;i<roof.length;i+=3)indices.push(n+roof[i],n+roof[i+2],n+roof[i+1]);
  // Separate wall vertices preserve the actual curved contact top's normals.
  const wallStart=positions.length/3;
  for(const v of loop){positions.push(...top.slice(v*3,v*3+3),top[v*3],seatWindow.bottomY,top[v*3+2]);uv.push(top[v*3]*.8,top[v*3+1],top[v*3]*.8,seatWindow.bottomY);}
  for(let i=0;i<loop.length;i++){const a=wallStart+i*2,b=wallStart+(i+1)%loop.length*2;indices.push(a,a+1,b,b,a+1,b+1);}
  const geometry=new THREE.BufferGeometry();geometry.name='stone-fish-r3-actual-belly-triangle-saddle';
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const size=geometry.boundingBox.getSize(new THREE.Vector3());
  if(size.x<.20||size.z<.40){geometry.dispose();throw new Error('Stone fish pool: contact patch is too small to support the belly');}
  const savedPositions=Float32Array.from(sourceVertices.flatMap(i=>[p.getX(i),p.getY(i),p.getZ(i)]));let disposed=false;
  const diagnostics={kind:'complete-source-belly-triangles-with-closed-stone-seat',sourceGeometry:sourceGeometry.name,sourceTriangles:sourceTriangles.length,sourceVertices:n,boundaryEdges:loop.length,triangles:trianglesOf(geometry),window:{...seatWindow},parameterWindow:{...seatParameterWindow},selectedSourceGrid:{firstRow,lastRow,firstColumn,lastColumn,firstTriangle:grid.firstTriangle},bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},historicalFormVerified:false};
  geometry.userData={body:'fitted-fish-belly-seat',sourceGeometry:sourceGeometry.name,embedY:seatWindow.embedY,bottomY:seatWindow.bottomY,sourceTriangleCount:sourceTriangles.length,historicalFormVerified:false};
  function validate(){
    check(!disposed,'disposed belly seat');const actual=geometry.attributes.position;let minimumEmbedding=Infinity,maximumEmbedding=-Infinity,maximumXZDrift=0;
    for(let i=0;i<n;i++){
      const sourceId=sourceVertices[i];for(let axis=0;axis<3;axis++)check(p.getComponent(sourceId,axis)===savedPositions[i*3+axis],'source belly vertex changed');
      const embedding=actual.getY(i)-p.getY(sourceId);minimumEmbedding=Math.min(minimumEmbedding,embedding);maximumEmbedding=Math.max(maximumEmbedding,embedding);
      maximumXZDrift=Math.max(maximumXZDrift,Math.abs(actual.getX(i)-p.getX(sourceId)),Math.abs(actual.getZ(i)-p.getZ(sourceId)));
      check(embedding>=.0029998&&embedding<=.0030002,'seat lost its real skin contact');
    }
    for(let i=0;i<sourceTriangles.length;i++)for(let j=0;j<3;j++)check(index.getX(sourceTriangles[i]*3+j)===sourceCorners[i*3+j],'source belly topology changed');
    check(maximumXZDrift===0,'seat drifts outside its source surface');
    return {minimumEmbedding,maximumEmbedding,maximumXZDrift,sourceTriangles:sourceTriangles.length,sourceVertices:n,sourceGeometryChanged:false};
  }
  try{diagnostics.contact=validate();return {geometry,diagnostics,validate,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;geometry.dispose();}};}
  catch(error){geometry.dispose();throw error;}
}

/** Shared-source composition seam. Both inputs are borrowed unless ownership
 * is explicitly transferred by the production wrapper below. Each fish owns
 * independent materials/uniforms; six geometries and three maps stay shared. */
export function createXieqiquStoneFishPoolFromSource({sourceOwner,textureOwner,firstMaterialOwner,ownsSource=false,ownsTextures=false,signal}={}){
  check(sourceOwner?.group?.isGroup&&typeof sourceOwner.dispose==='function'&&!sourceOwner.disposed,'live fish source owner required');
  check(textureOwner?.maps&&typeof textureOwner.dispose==='function'&&!textureOwner.disposed,'live marble texture owner required');
  const group=new THREE.Group();group.name=stoneFishPoolStudyId+'-study';group.userData={assetId:stoneFishPoolStudyId,historicalDimensionsVerified:false,visualAcceptance:false,archiveCompatible:false};
  const fishViews=[],materialOwners=new Set(firstMaterialOwner?[firstMaterialOwner]:[]),listeners=[];let context,seat,disposed=false,invalidated=false;
  const diagnostics={assetId:stoneFishPoolStudyId,visualAcceptance:false,integrationAcceptance:false,archiveCompatible:false,units:'authored proportional metres',materialStudy:'marble-r1',groundY:-.68};
  const invalidate=()=>{invalidated=true;group.visible=false;diagnostics.borrowedResourceInvalidated=true;};
  const dispose=()=>{
    if(disposed)return;disposed=true;const errors=[],run=fn=>{try{fn();}catch(e){errors.push(e);}};
    run(()=>group.removeFromParent());for(const resource of listeners)resource.removeEventListener('dispose',invalidate);listeners.length=0;
    for(const view of [...fishViews].reverse())run(()=>view.dispose());fishViews.length=0;for(const owner of materialOwners)run(()=>owner.dispose());materialOwners.clear();
    run(()=>context?.dispose());run(()=>seat?.dispose());if(ownsSource)run(()=>sourceOwner.dispose());if(ownsTextures)run(()=>textureOwner.dispose());group.clear();
    if(errors.length)throw new AggregateError(errors,'Stone fish pool cleanup failed');
  };
  try{
    signal?.throwIfAborted();check(sourceOwner.group.children.length===6,'the six complete fish components are required');
    const sourceRoot=sourceOwner.group,identity=new THREE.Matrix4().elements,local=sourceRoot.matrixAutoUpdate?new THREE.Matrix4().compose(sourceRoot.position,sourceRoot.quaternion,sourceRoot.scale):sourceRoot.matrix;
    check(!sourceRoot.parent&&local.elements.every((v,i)=>v===identity[i]),'source prototype must remain unplaced in its common frame');
    const body=sourceOwner.group.children.find(node=>node.userData.body==='continuous-body');check(body?.geometry,'continuous fish body missing');
    const uniqueGeometry=new Set(sourceOwner.group.children.map(node=>node.geometry));check(uniqueGeometry.size===6,'fish source must retain six independent component geometries');
    body.geometry.computeBoundingBox();const waveCeiling=body.geometry.boundingBox.min.y-.025;
    seat=createStoneFishBellySeat(body.geometry);context=createXieqiquSouthPoolContextStudy({seatGeometry:seat.geometry,waveCeiling,signal});group.add(context.group);
    for(let i=0;i<context.mounts.length;i++){
      signal?.throwIfAborted();const owner=i===0&&firstMaterialOwner?firstMaterialOwner:createStoneFishSharedMapMaterialOwner(textureOwner);materialOwners.add(owner);
      check(['carving','oldStone'].every(role=>owner.materials?.[role]?.map===textureOwner.maps.color&&owner.materials[role].normalMap===textureOwner.maps.normal&&owner.materials[role].roughnessMap===textureOwner.maps.roughness),'fish materials must borrow the same three maps');
      const view=createStoneFishMaterialView({sourceOwner,materialOwner:owner,signal});fishViews.push(view);view.group.name=`xieqiqu-stone-fish-${i+1}-marble-view`;context.mounts[i].body.add(view.group);
    }
    for(const resource of [...uniqueGeometry,...Object.values(textureOwner.maps)]){resource.addEventListener('dispose',invalidate);listeners.push(resource);}
    group.updateMatrixWorld(true);signal?.throwIfAborted();const contacts=seat.validate(),bindings=[];
    for(let i=0;i<context.mounts.length;i++){
      const mount=context.mounts[i],jet=context.diagnostics.waterEndpoints.find(e=>e.id===`${mount.group.name}-jet`),mouth=new THREE.Vector3(...stoneFishMouth).applyMatrix4(fishViews[i].group.matrixWorld),start=new THREE.Vector3(...jet.start).applyMatrix4(mount.flow.matrixWorld),landing=new THREE.Vector3(...jet.end).applyMatrix4(mount.flow.matrixWorld);
      check(mouth.distanceTo(start)<1e-12,'fish mouth and original jet separated');check(Math.abs(landing.y-.13)<1e-12,'original jet no longer meets pool water');
      const waves=mount.group.getObjectByName(`${mount.group.name}-low-wave-carving`);let maximumWaveY=-Infinity;
      waves.traverse(node=>{if(!node.isMesh)return;const p=node.geometry.attributes.position;for(let k=0;k<p.count;k++)maximumWaveY=Math.max(maximumWaveY,p.getY(k)*waves.scale.y+waves.position.y);});
      check(maximumWaveY<=body.geometry.boundingBox.min.y-.024999,'wave carving crosses the body minimum');
      bindings.push({index:i+1,position:[...mount.placement.position],rotationY:mount.placement.rotationY,scale:mount.placement.size,mouth:mouth.toArray(),jetStart:start.toArray(),landing:landing.toArray(),minimumWaveClearance:body.geometry.boundingBox.min.y-maximumWaveY,seatEmbedding:[contacts.minimumEmbedding*mount.placement.size,contacts.maximumEmbedding*mount.placement.size],geometryShared:fishViews[i].group.children.every((node,k)=>node.geometry===sourceOwner.group.children[k].geometry)});
    }
    let triangles=0,meshes=0;group.traverse(node=>{if(node.isMesh){triangles+=trianglesOf(node.geometry);meshes++;}});
    const candidateMaterials=new Set(fishViews.flatMap(view=>view.group.children.map(node=>node.material))),bounds=new THREE.Box3().setFromObject(group);
    check(candidateMaterials.size===8&&bindings.every(b=>b.geometryShared),'fish material isolation or geometry sharing failed');
    Object.assign(diagnostics,{triangles,triangleCount:triangles,meshCount:meshes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},fishTrianglesPerPass:[...uniqueGeometry].reduce((n,g)=>n+trianglesOf(g),0)*4,bindings,seat:seat.diagnostics,context:context.diagnostics,resourceOwnership:{fishGeometries:6,fishMaterials:8,marbleTextures:3,sourceOwner:ownsSource?'owned':'borrowed',textureOwner:ownsTextures?'owned':'borrowed',seat:'one owned geometry shared by four mounts',noSourceBufferCopies:true,disposalIsIdempotent:true},fullResolutionVerified:textureOwner.fullResolutionVerified===true});
    return {group,diagnostics,fishViews,context,seat,sourceOwner,textureOwner,update(time){if(!disposed&&!invalidated)context.update(time);},get disposed(){return disposed;},get invalidated(){return invalidated;},dispose};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish pool construction and cleanup failed',{cause:error});}throw error;}
}

/** One complete fish construction, after the already verified lazy marble
 * prepare. No complete Xieqiqu building, second fish or texture decode here. */
export function createXieqiquStoneFishPoolStudy({pixels,signal}={}){
  signal?.throwIfAborted();let textures,materials,source;
  try{
    textures=createStoneFishTextureOwnerFromPixels(pixels);materials=createStoneFishSharedMapMaterialOwner(textures);
    source=createXieqiquStoneFishStudy({materials:materials.materials,signal});
    return createXieqiquStoneFishPoolFromSource({sourceOwner:source,textureOwner:textures,firstMaterialOwner:materials,ownsSource:true,ownsTextures:true,signal});
  }catch(error){const errors=[error];for(const owner of [materials,source,textures])try{owner?.dispose();}catch(e){errors.push(e);}if(errors.length>1)throw new AggregateError(errors,'Stone fish pool preparation cleanup failed',{cause:error});throw error;}
}
