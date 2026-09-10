import * as THREE from 'three';
import {fireflyFlightRig,fireflyWingMatrix} from './sky-fauna.js';

// Bounds of the currently posed mesh, not BufferGeometry's all-morph envelope.
export function specimenBounds(root){
  root.updateWorldMatrix(true,true);const box=new THREE.Box3(),v=new THREE.Vector3();
  root.traverse(o=>{if(!o.isMesh||o.userData.excludeFromGLB)return;for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v);box.expandByPoint(v.applyMatrix4(o.matrixWorld));}});return box;
}

export function specimenMetrics(root){
  const result={meshes:0,triangles:0,vertices:0,morphTargets:0,auraMeshes:0,auraTriangles:0};
  root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,triangles=(g.index?.count??g.attributes.position.count)/3;if(o.userData.excludeFromGLB){result.auraMeshes++;result.auraTriangles+=triangles;}else{result.meshes++;result.triangles+=triangles;result.vertices+=g.attributes.position.count;result.morphTargets+=g.morphAttributes.position?.length||0;}});return result;
}

export function placeLanternPair(pair){pair.children[0].position.set(-.36,0,-.13);pair.children[1].position.set(.36,.24,.13);}

// All convex morph blends plus the full bank interval; evaluated once, never per frame.
export function swallowMotionBounds(bird){
  const weights=[...bird.morphTargetInfluences],rotation=bird.rotation.clone(),box=new THREE.Box3();bird.rotation.set(0,0,0);
  for(const pose of[[0,0],[1,0],[0,1]]){bird.morphTargetInfluences.splice(0,2,...pose);const bounds=specimenBounds(bird);
    for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){
      const angles=[-.28,.28,0];for(const critical of[Math.atan2(-y,x),Math.atan2(x,y)])for(const offset of[-Math.PI,0,Math.PI])if(Math.abs(critical+offset)<=.28)angles.push(critical+offset);
      for(const a of angles)box.expandByPoint(new THREE.Vector3(x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z));
    }
  }bird.morphTargetInfluences.splice(0,2,...weights);bird.rotation.copy(rotation);bird.updateMatrixWorld(true);return box;
}

export function fireflyMotionBounds(insect){
  const rig=fireflyFlightRig(insect),saved=rig.map(({part})=>part.matrix.clone()),box=new THREE.Box3();
  for(let i=0;i<=24;i++){
    for(const descriptor of rig){const {part}=descriptor;fireflyWingMatrix(descriptor,-.62+i/24*1.24,part.matrix);part.matrix.decompose(part.position,part.quaternion,part.scale);}
    box.union(specimenBounds(insect));
  }
  rig.forEach(({part},i)=>{part.matrix.copy(saved[i]);part.matrix.decompose(part.position,part.quaternion,part.scale);});insect.updateMatrixWorld(true);
  // Submillimetre margin covers extrema between angular samples without
  // changing the camera during the actual wing cycle.
  return box.expandByScalar(.001);
}

export function fitSpecimenCamera(camera,box,view,kind='swallow'){
  const center=box.getCenter(new THREE.Vector3()),span=Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const d=new THREE.Vector3(...({threequarter:[1,.57,-1.35],front:[0,.08,-1.7],side:[1.75,.08,0],back:[0,.08,1.7],above:[.001,1.7,.10],below:[.04,-1.3,-.65],close:[.9,.3,-1.1],distance:[.2,.14,-1.5]}[view]||[1,.57,-1.35])).normalize();
  const right=new THREE.Vector3().crossVectors(camera.up,d).normalize(),up=new THREE.Vector3().crossVectors(d,right),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  let distance=0;const margin=view==='close'?1.12:1.24;
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,p.dot(d)+Math.max(Math.abs(p.dot(right))/(tan*camera.aspect),Math.abs(p.dot(up))/tan)*margin);}
  if(view==='distance')distance=kind==='firefly'?1.6:4.5;
  camera.position.copy(center).addScaledVector(d,distance);camera.lookAt(center);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();return{center,span,distance};
}
