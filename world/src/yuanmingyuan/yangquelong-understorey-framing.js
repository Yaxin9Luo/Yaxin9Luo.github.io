import * as THREE from 'three';
import {fitGardenPoints,fitGardenCompositionView} from './yangquelong-garden-framing.js';
const fail=(ok,message)=>{if(!ok)throw new Error('Understorey study framing: '+message);};
const corners=box=>{const out=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])out.push(new THREE.Vector3(x,y,z));return out;};
/** A close view frames actual existing plant instances within the central
 * community. It neither hides instances nor substitutes a display specimen.
 * The complete bed view separately proves the whole outline and root clearing.
 */
export function frameYangquelongUnderstoreyStudy({group,camera,controls,spec}){
 if(!spec.focusWindow&&!spec.focusKinds)return fitGardenCompositionView({group,camera,controls,spec});
 fail(!spec.isolate?.length&&!spec.crop&&!spec.groups.length,'focus uses the unchanged full bed geometry');
 const {x,z}=spec.focusWindow??{x:[-Infinity,Infinity],z:[-Infinity,Infinity]},points=[],ids=new Set(),sources=new Set(),local=new THREE.Matrix4(),world=new THREE.Matrix4(),origin=new THREE.Vector3();
 group.updateWorldMatrix(true,true);
 group.traverseVisible(mesh=>{
  if(!mesh.isInstancedMesh||!mesh.userData.sourceId)return;
  if(spec.focusSources&&!spec.focusSources.includes(mesh.userData.sourceId))return;
  if(spec.focusBodies&&!spec.focusBodies.includes(mesh.geometry.userData.body))return;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  for(let i=0;i<mesh.count;i++){
   if(spec.focusKinds&&!spec.focusKinds.includes(mesh.userData.placementKinds?.[i]))continue;
   mesh.getMatrixAt(i,local);world.multiplyMatrices(mesh.matrixWorld,local);origin.setFromMatrixPosition(world);
   if(origin.x<x[0]||origin.x>x[1]||origin.z<z[0]||origin.z>z[1])continue;
   for(const p of corners(mesh.geometry.boundingBox))points.push(p.applyMatrix4(world));
   ids.add(mesh.userData.placements[i]);sources.add(mesh.userData.sourceId);
  }
 });
 const required=spec.requiredSources??['ivory','lilac','sedge'];
 fail(points.length&&required.every(id=>sources.has(id))&&(spec.requiredSources||([...sources].some(id=>id.startsWith('olive'))&&[...sources].some(id=>id.startsWith('sage')))),'same-field requested flower/leaf community required');
 const fit=fitGardenPoints(points,{direction:spec.direction,aspect:camera.aspect,fov:camera.getEffectiveFOV(),margin:spec.margin});
 camera.position.copy(fit.position);camera.near=Math.max(.02,fit.closestDepth*.45);camera.far=Math.max(1200,fit.farthestDepth*2);camera.updateProjectionMatrix();
 const damping=controls.enableDamping;controls.enableDamping=false;
 try{controls.target.copy(fit.target);controls.maxDistance=Math.max(400,camera.position.distanceTo(fit.target)*3);controls.update();camera.updateMatrixWorld(true);}
 finally{controls.enableDamping=damping;}
 return {...fit,position:fit.position.toArray(),target:fit.target.toArray(),plants:[...ids],sources:[...sources],method:spec.focusBodies?'actual-existing-flower-geometry-focus':'actual-existing-instance-bounds-community-focus',focusKinds:spec.focusKinds??null,focusBodies:spec.focusBodies??null,geometryHidden:0};
}
