import * as THREE from 'three';
import {repairMoundBoundaryNormals} from './mound-ground-seam.js';

const groupName='xianfashan-complete-earth-mound',materialName='xianfashan-compact-earth-and-moss';
const bindings=new WeakMap();

// Opt-in display binding after world placement. Archive/source owners retain
// their original geometry/material. Only the display rim normals are rebuilt
// from actual top faces so buried side walls do not shade the ground seam.
export function createMoundGroundMaterialBinding({resource,terrain,assetId,signal}={}){
  signal?.throwIfAborted();
  if(assetId!=='xianfashan'||!resource?.group?.isObject3D||resource.disposed||terrain?.disposed||typeof terrain?.colorAt!=='function'||!terrain.earthMaterial?.isMeshStandardMaterial||!terrain.earthMaterial.vertexColors)throw new Error('Mound ground binding needs a live placed Xianfashan owner and terrain color/material owner');
  const groups=[];resource.group.traverse(node=>{if(node.name===groupName)groups.push(node);});
  if(groups.length!==1||!groups[0].isGroup)throw new Error('Expected exactly one rendered Xianfashan earth mound group');
  const meshes=[];groups[0].traverse(node=>{if(node.isMesh&&!Array.isArray(node.material)&&node.material?.name===materialName&&node.material.userData.category==='terrain')meshes.push(node);});
  if(meshes.length!==1)throw new Error('Expected exactly one original soil mesh inside the Xianfashan mound');
  const mesh=meshes[0],originalGeometry=mesh.geometry,originalMaterial=mesh.material,earthMaterial=terrain.earthMaterial;
  if(bindings.has(mesh))throw new Error('The mound already has an active ground binding');
  if(mesh.isInstancedMesh||mesh.isBatchedMesh||mesh.isSkinnedMesh||Object.values(originalGeometry.morphAttributes??{}).some(a=>a.length)||!originalGeometry.attributes.position||originalGeometry.attributes.position.itemSize!==3||originalGeometry.attributes.normal?.itemSize!==3||originalGeometry.attributes.normal.count!==originalGeometry.attributes.position.count)throw new Error('Mound binding requires the original static soil geometry');
  const count=originalGeometry.attributes.position.count,clone=originalGeometry.clone(),point=new THREE.Vector3(),color=new THREE.Color();
  let disposed=false,committed=false,matrix=null,owner;
  function restore(){
    if(disposed)return;disposed=true;
    signal?.removeEventListener('abort',restore);originalGeometry.removeEventListener('dispose',restore);originalMaterial.removeEventListener('dispose',restore);earthMaterial.removeEventListener('dispose',restore);
    if(mesh.geometry===clone)mesh.geometry=originalGeometry;
    if(mesh.material===earthMaterial)mesh.material=originalMaterial;
    if(bindings.get(mesh)===owner)bindings.delete(mesh);
    clone.dispose();matrix=null;
  }
  function refresh(){
    if(disposed)throw new Error('Mound ground binding has been disposed');
    signal?.throwIfAborted();if(resource.disposed||terrain.disposed){restore();throw new Error('Mound ground binding owner has been disposed');}
    if(committed&&(mesh.geometry!==clone||mesh.material!==earthMaterial)){restore();throw new Error('Mound display binding was replaced by another owner');}
    mesh.updateWorldMatrix(true,false);const elements=mesh.matrixWorld.elements;
    if(!elements.every(Number.isFinite)||elements[3]!==0||elements[7]!==0||elements[11]!==0||elements[15]!==1)throw new Error('Mound mapping requires a finite affine world transform');
    if(matrix?.every((value,i)=>value===elements[i]))return false;
    // Stage both attributes before committing so a failed color/abort query
    // cannot leave a partially recolored mesh or modify the source buffers.
    const uv=new Float32Array(count*2),colors=new Float32Array(count*3),position=originalGeometry.attributes.position;
    for(let i=0;i<count;i++){
      if((i&4095)===0)signal?.throwIfAborted();
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))throw new Error('Mound source positions must be finite');
      const sampled=terrain.colorAt(point.x,point.y,point.z,color);
      if(!sampled?.isColor||![sampled.r,sampled.g,sampled.b].every(Number.isFinite))throw new Error('Terrain color sampler returned an invalid color');
      uv[i*2]=point.x*.08;uv[i*2+1]=point.z*.08;colors[i*3]=sampled.r;colors[i*3+1]=sampled.g;colors[i*3+2]=sampled.b;
    }
    signal?.throwIfAborted();if(disposed||resource.disposed||terrain.disposed)throw new Error('Mound ground binding owner expired during mapping');
    if(committed){clone.attributes.uv.array.set(uv);clone.attributes.color.array.set(colors);clone.attributes.uv.needsUpdate=true;clone.attributes.color.needsUpdate=true;}
    else{clone.setAttribute('uv',new THREE.BufferAttribute(uv,2));clone.setAttribute('color',new THREE.BufferAttribute(colors,3));}
    matrix=[...elements];return true;
  }
  try{
    const boundaryNormalRepair=repairMoundBoundaryNormals(originalGeometry,clone,{signal});
    refresh();owner={refresh,dispose:restore,get disposed(){return disposed;},get snapshot(){return {assetId,group:groupName,mesh:mesh.name,vertices:count,triangles:(clone.index?.count??count)/3,worldUVScale:.08,borrowedTerrainMaterial:true,geometryOnlyOwned:true,sourceGeometryPreserved:true,boundaryNormalRepair:{...boundaryNormalRepair},disposed};}};
    signal?.throwIfAborted();mesh.geometry=clone;mesh.material=earthMaterial;committed=true;bindings.set(mesh,owner);
    signal?.addEventListener('abort',restore,{once:true});originalGeometry.addEventListener('dispose',restore);originalMaterial.addEventListener('dispose',restore);earthMaterial.addEventListener('dispose',restore);
    return owner;
  }catch(error){restore();throw error;}
}
