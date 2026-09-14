import * as THREE from 'three';

/** A closed, cambered membrane with finite rim thickness. The outline must be
 * star-shaped about center in its plane; a failing outline is rejected rather
 * than triangulated across its concavity. Used only by the new fish/bird studies. */
export function createCamberedSculptureSkin({name,outline,center,normal,rings=14,halfThickness,bend=()=>0}){
  if(!Array.isArray(outline)||outline.length<12||!Number.isInteger(rings)||rings<2||rings>32||typeof halfThickness!=='function')throw new Error('A sampled sculpture outline, bounded rings and thickness field are required');
  const origin=new THREE.Vector3(...center),axis=new THREE.Vector3(...normal),boundary=outline.map(p=>new THREE.Vector3(...p));
  if(![...origin.toArray(),...axis.toArray(),...boundary.flatMap(p=>p.toArray())].every(Number.isFinite)||axis.lengthSq()===0)throw new Error('Sculpture skin coordinates must be finite');axis.normalize();
  const winding=boundary.reduce((sum,p,i)=>sum+p.clone().sub(origin).cross(boundary[(i+1)%boundary.length].clone().sub(origin)).dot(axis),0);if(winding<0)boundary.reverse();
  for(let i=0;i<boundary.length;i++)if(boundary[i].clone().sub(origin).cross(boundary[(i+1)%boundary.length].clone().sub(origin)).dot(axis)<=1e-12)throw new Error('Sculpture skin outline is not star-shaped about its chosen center');
  const positions=[],uv=[],indices=[],sides=boundary.length,layerCount=1+rings*sides;
  const vertex=(point,rho,theta,side)=>{const half=halfThickness(point,rho,theta),curve=bend(point,rho,theta);if(!Number.isFinite(half)||half<=0||!Number.isFinite(curve))throw new Error('Sculpture skin has invalid thickness or camber');const p=point.clone().addScaledVector(axis,curve+side*half);positions.push(...p.toArray());uv.push(p.x*.8,(p.y+p.z)*.5);};
  for(const side of [1,-1]){
    vertex(origin,0,0,side);
    for(let ring=1;ring<=rings;ring++)for(let j=0;j<sides;j++)vertex(origin.clone().lerp(boundary[j],ring/rings),ring/rings,j/sides*Math.PI*2,side);
  }
  const ringVertex=(layer,ring,j)=>layer*layerCount+1+(ring-1)*sides+(j+sides)%sides;
  for(let layer=0;layer<2;layer++){
    const face=(a,b,c)=>indices.push(...(layer?[a,c,b]:[a,b,c]));
    for(let j=0;j<sides;j++)face(layer*layerCount,ringVertex(layer,1,j),ringVertex(layer,1,j+1));
    for(let ring=1;ring<rings;ring++)for(let j=0;j<sides;j++){const a=ringVertex(layer,ring,j),b=ringVertex(layer,ring,j+1),c=ringVertex(layer,ring+1,j+1),d=ringVertex(layer,ring+1,j);face(a,d,b);face(b,d,c);}
  }
  for(let j=0;j<sides;j++){const a=ringVertex(0,rings,j),b=ringVertex(0,rings,j+1),c=ringVertex(1,rings,j+1),d=ringVertex(1,rings,j);indices.push(a,d,b,b,d,c);}
  const geometry=new THREE.BufferGeometry();geometry.name=name;geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={construction:'closed-cambered-sculpture-skin',rings,outlineSamples:sides,finiteRim:true};return geometry;
}

export function sampledShapeOutline(shape,map,samples=96){
  const points=shape.getSpacedPoints(samples);points.pop();return points.map(p=>map(p.x,p.y));
}

/** Caller lends the original source materials. This owner never edits/disposes
 * their maps or material objects. Only the newly built geometry is owned here. */
export function createBorrowedMaterialSculpture({id,materials,roles,parts,mouthAnchor,signal}){
  const abort=()=>{if(signal?.aborted)throw new DOMException('Sculpture preparation aborted','AbortError');};abort();
  if(!materials||roles.some(role=>!materials[role]?.isMaterial))throw new Error(`${id} requires original source materials: ${roles.join(', ')}`);
  if(!Array.isArray(parts)||!parts.length||parts.some(part=>typeof part.id!=='string'||typeof part.create!=='function'||!roles.includes(part.role)))throw new Error('Sculpture components must use the declared source material roles');
  const group=new THREE.Group(),geometries=new Set();let disposed=false;group.name=id+'-study';group.userData={assetId:id,evidence:'documented-sculpture-type; authored-anatomy-and-pose',visualAcceptance:false};
  const dispose=()=>{if(disposed)return;disposed=true;group.clear();for(const geometry of geometries)geometry.dispose();geometries.clear();};
  try{
    for(const part of parts){abort();const geometry=part.create();if(!geometry?.isBufferGeometry)throw new Error(`${id}/${part.id} did not return a geometry`);geometries.add(geometry);if(!geometry.attributes.position||!geometry.attributes.normal||!geometry.attributes.uv)throw new Error(`${id}/${part.id} did not return a complete geometry`);const mesh=new THREE.Mesh(geometry,materials[part.role]);mesh.name=id+'-'+part.id;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={body:part.id,evidence:'authored-sculptural-interpretation'};group.add(mesh);}
    abort();group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group),triangleCount=[...geometries].reduce((sum,g)=>sum+(g.index?.count??g.attributes.position.count)/3,0);
    if(!Number.isSafeInteger(triangleCount)||triangleCount<=0)throw new Error(`${id} has an invalid triangle count`);
    return {group,diagnostics:{assetId:id,triangleCount,triangles:triangleCount,meshCount:group.children.length,bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},mouthAnchor:[...mouthAnchor],resourceOwnership:{geometries:geometries.size,materials:'borrowed-original-source',textures:'borrowed-original-source',disposeBorrowed:false},visualAcceptance:false,integrationAcceptance:false},get disposed(){return disposed;},dispose};
  }catch(error){dispose();throw error;}
}
