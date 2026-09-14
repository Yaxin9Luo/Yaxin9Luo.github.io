import * as THREE from 'three';
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong garden framing: '+message);};
const corners=box=>{const out=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])out.push(new THREE.Vector3(x,y,z));return out;};

/** Eight transformed bounds corners per visible mesh, including the complete
 * precomputed InstancedMesh bounds. No vertex/instance reduction or isolation.
 * This avoids inventing high court corners at the height of the central finial.
 */
export function gardenFramingPoints(group){
 fail(group?.isObject3D,'visible complete group required');
 group.updateWorldMatrix(true,true);
 const points=[];let meshes=0,instances=0;
 group.traverseVisible(node=>{
  if(!node.isMesh)return;
  let box;
  if(node.isInstancedMesh){
   if(node.boundingBox===null)node.computeBoundingBox();
   box=node.boundingBox;instances+=node.count;
  }else{
   if(node.geometry.boundingBox===null)node.geometry.computeBoundingBox();
   box=node.geometry.boundingBox;
  }
  fail(box&&!box.isEmpty(),'nonempty bounds required for '+node.name);
  for(const point of corners(box))points.push(point.applyMatrix4(node.matrixWorld));
  meshes++;
 });
 fail(meshes>0&&points.every(p=>p.toArray().every(Number.isFinite)),'finite complete mesh bounds required');
 return {points,meshes,instances};
}

/** Fit the whole point set in a fixed perspective direction. At a proposed
 * camera depth, each point defines an allowed horizontal/vertical target
 * interval. Their intersection is monotone, so bisection finds the closest
 * legal camera without cropping. Interval midpoints centre the remaining
 * breathing space. The margin constrains both projected axes at actual depth.
 */
export function fitGardenPoints(points,{direction,aspect,fov=40,margin=1.06}){
 fail(points.length>0&&aspect>0&&Number.isFinite(aspect)&&fov>0&&fov<150&&margin>=1,'valid full-frame projection required');
 const back=new THREE.Vector3(...direction).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),back).normalize(),up=new THREE.Vector3().crossVectors(back,right);
 fail(back.lengthSq()>.99&&right.lengthSq()>.99,'direction must be finite and away from vertical');
 const tanY=Math.tan(THREE.MathUtils.degToRad(fov)/2),tanX=tanY*aspect;
 const projected=points.map(p=>[p.dot(right),p.dot(up),p.dot(back)]);
 fail(projected.every(p=>p.every(Number.isFinite)),'finite framing points required');
 const depthMin=Math.min(...projected.map(p=>p[2])),depthMax=Math.max(...projected.map(p=>p[2]));
 const intervals=depth=>{
  const lo=[-Infinity,-Infinity],hi=[Infinity,Infinity];
  for(const p of projected)for(let axis=0;axis<2;axis++){
   const extent=(depth-p[2])*(axis===0?tanX:tanY)/margin;
   lo[axis]=Math.max(lo[axis],p[axis]-extent);hi[axis]=Math.min(hi[axis],p[axis]+extent);
  }
  return {lo,hi,valid:lo.every((x,i)=>x<=hi[i])};
 };
 let low=depthMax+.1,high=low+Math.max(1,depthMax-depthMin);
 for(let i=0;!intervals(high).valid;i++){fail(i<64,'unable to frame finite points');high=low+(high-low)*2;}
 for(let i=0;i<64;i++){const mid=(low+high)/2;if(intervals(mid).valid)high=mid;else low=mid;}
 const range=intervals(high),centre=range.lo.map((value,axis)=>{
  let lo=value,hi=range.hi[axis];
  for(let i=0;i<48;i++){const mid=(lo+hi)/2,screen=projected.map(p=>(p[axis]-mid)/(high-p[2]));if(Math.min(...screen)+Math.max(...screen)>0)lo=mid;else hi=mid;}
  return(lo+hi)/2;
 }),targetDepth=(depthMin+depthMax)/2;
 const target=right.clone().multiplyScalar(centre[0]).addScaledVector(up,centre[1]).addScaledVector(back,targetDepth);
 const position=target.clone().addScaledVector(back,high-targetDepth);
 const ndc=projected.map(p=>[(p[0]-centre[0])/(high-p[2])/tanX,(p[1]-centre[1])/(high-p[2])/tanY]);
 const ndcBounds={min:[0,1].map(i=>Math.min(...ndc.map(p=>p[i]))),max:[0,1].map(i=>Math.max(...ndc.map(p=>p[i])))};
 fail([...ndcBounds.min,...ndcBounds.max].every(x=>Math.abs(x)<=1/margin+1e-9),'complete bounds exceed frame');
 return {position,target,ndcBounds,closestDepth:high-depthMax,farthestDepth:high-depthMin,pointCount:points.length,aspect,fov,margin};
}

/** New review entry calls this after selecting its whole view; ordinary
 * studio assets keep their existing framing. Caller continues to use normal
 * visible-bounds clipping and shadow fitting. No renderer setting changes.
 */
export function fitGardenCompositionView({group,camera,controls,spec}){
 fail(camera?.isPerspectiveCamera&&!spec.crop&&!(spec.isolate?.length)&&!spec.groups.length,'complete perspective view required');
 const cloud=gardenFramingPoints(group);
 const fit=fitGardenPoints(cloud.points,{direction:spec.direction,aspect:camera.aspect,fov:camera.getEffectiveFOV(),margin:spec.margin});
 camera.position.copy(fit.position);camera.far=Math.max(1200,fit.farthestDepth*2);camera.updateProjectionMatrix();
 const damping=controls.enableDamping;controls.enableDamping=false;
 try{controls.target.copy(fit.target);controls.maxDistance=Math.max(400,camera.position.distanceTo(fit.target)*3);controls.update();camera.updateMatrixWorld(true);}
 finally{controls.enableDamping=damping;}
 return {...fit,position:fit.position.toArray(),target:fit.target.toArray(),meshes:cloud.meshes,instances:cloud.instances,method:'all-visible-mesh-bounds-perspective-intervals'};
}
