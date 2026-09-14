import * as THREE from 'three';

function corners(box){
  const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));return points;
}

// A close-up of a doorway must not spend most of its shadow map on a 200-unit
// ornamental basin. Fit the receiver in light space; keep every caster in depth.
export function fitStudyShadow(light,receiverBounds,casterBounds=receiverBounds){
  if(receiverBounds.isEmpty()||casterBounds.isEmpty())return;
  const direction=light.position.clone().sub(light.target.position).normalize(),centre=receiverBounds.getCenter(new THREE.Vector3());
  const distance=Math.max(30,casterBounds.getSize(new THREE.Vector3()).length()*2);
  light.target.position.copy(centre);light.position.copy(centre).addScaledVector(direction,distance);
  light.target.updateMatrixWorld(true);light.updateMatrixWorld(true);light.shadow.updateMatrices(light);
  const camera=light.shadow.camera,receivers=corners(receiverBounds).map(point=>point.applyMatrix4(camera.matrixWorldInverse));
  const casters=corners(casterBounds).map(point=>point.applyMatrix4(camera.matrixWorldInverse));
  const xs=receivers.map(point=>point.x),ys=receivers.map(point=>point.y),depths=casters.map(point=>-point.z);
  const pad=Math.max(.15,Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*.06);
  camera.left=Math.min(...xs)-pad;camera.right=Math.max(...xs)+pad;camera.bottom=Math.min(...ys)-pad;camera.top=Math.max(...ys)+pad;
  camera.near=Math.max(.01,Math.min(...depths)-2);camera.far=Math.max(camera.near+1,Math.max(...depths)+2);camera.updateProjectionMatrix();
  const texel=Math.max((camera.right-camera.left)/light.shadow.mapSize.x,(camera.top-camera.bottom)/light.shadow.mapSize.y);
  light.shadow.normalBias=Math.min(.045,Math.max(.0015,texel*.65));
  light.shadow.bias=-Math.max(.00015,texel*.10)/(camera.far-camera.near);
  light.shadow.needsUpdate=true;
  return {mapSize:light.shadow.mapSize.toArray(),bounds:[camera.left,camera.right,camera.bottom,camera.top,camera.near,camera.far],worldUnitsPerTexel:texel,bias:light.shadow.bias,normalBias:light.shadow.normalBias};
}
