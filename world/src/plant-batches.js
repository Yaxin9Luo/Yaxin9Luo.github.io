import * as THREE from 'three';
import {environmentWind} from './environment-wind.js';

/** Partition only completed opaque plant batches: the authored Float32 records
 * remain the source of truth, including colors assigned after placement. */
export function partitionPlantBatch(source,{cellSize=32}={}){
  if(!(Number.isFinite(cellSize)&&cellSize>0))throw new RangeError('Plant cell size must be positive');
  if(!source.count||Array.isArray(source.material)||source.material.transparent||!source.material.depthWrite||source.morphTexture)return [source];
  const cells=new Map(),records=source.instanceMatrix.array;
  for(let i=0;i<source.count;i++){
    const x=Math.floor(records[i*16+12]/cellSize),z=Math.floor(records[i*16+14]/cellSize),key=`${x},${z}`;
    if(!cells.has(key))cells.set(key,{x,z,indices:[]});cells.get(key).indices.push(i);
  }
  source.updateWorldMatrix(true,false);
  // Match the shader's column projections, which are not an inverse when a
  // nonuniform parent and rotated instance make the combined columns oblique.
  const amplitude=Math.abs(Number((source.material.userData.environmentWind?.amplitude||0).toFixed(5)));
  const modelLinear=new THREE.Matrix3().setFromMatrix4(source.matrixWorld),instance=new THREE.Matrix4(),instanceLinear=new THREE.Matrix3(),combined=new THREE.Matrix3();
  const wind=new THREE.Vector3(environmentWind.direction.x,0,environmentWind.direction.y).multiplyScalar(amplitude),column=new THREE.Vector3(),bend=new THREE.Vector3();
  const chunks=[];
  try{
    for(const {x,z,indices}of cells.values()){
      const mesh=new THREE.InstancedMesh(source.geometry,source.material,indices.length);chunks.push(mesh);
      mesh.name=chunks.length===1?source.name:`${source.name} / cell ${x},${z}`;
      mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.matrix.copy(source.matrix);mesh.matrixWorld.copy(source.matrixWorld);
      mesh.matrixAutoUpdate=source.matrixAutoUpdate;mesh.matrixWorldAutoUpdate=source.matrixWorldAutoUpdate;mesh.layers.mask=source.layers.mask;
      for(const key of['visible','castShadow','receiveShadow','frustumCulled','renderOrder','onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','customDepthMaterial','customDistanceMaterial'])mesh[key]=source[key];
      mesh.instanceMatrix.setUsage(source.instanceMatrix.usage);mesh.instanceMatrix.gpuType=source.instanceMatrix.gpuType;
      let padding=0;
      for(let local=0;local<indices.length;local++){
        const offset=indices[local]*16;mesh.instanceMatrix.array.set(records.subarray(offset,offset+16),local*16);
        if(amplitude){
          instance.fromArray(records,offset);instanceLinear.setFromMatrix4(instance);combined.multiplyMatrices(modelLinear,instanceLinear);
          for(let axis=0;axis<3;axis++){column.setFromMatrix3Column(combined,axis);bend.setComponent(axis,wind.dot(column)/Math.max(column.lengthSq(),.0001));}
          // Shader bend is geometry-local; instanceLinear maps it into the
          // object-local bounds. Gust and smoothstep each have magnitude <= 1.
          padding=Math.max(padding,bend.applyMatrix3(instanceLinear).length());
        }
      }
      mesh.userData={...source.userData,plantBatch:{name:source.name,cell:[x,z],cellSize,sourceIndices:indices,windPadding:padding}};
      if(source.instanceColor){
        const color=source.instanceColor;
        mesh.instanceColor=new THREE.InstancedBufferAttribute(new color.array.constructor(indices.length*color.itemSize),color.itemSize,color.normalized,color.meshPerAttribute);
        mesh.instanceColor.setUsage(color.usage);mesh.instanceColor.gpuType=color.gpuType;
        for(let local=0;local<indices.length;local++)mesh.instanceColor.array.set(color.array.subarray(indices[local]*color.itemSize,(indices[local]+1)*color.itemSize),local*color.itemSize);
      }
      mesh.computeBoundingSphere();mesh.boundingSphere.radius+=padding;mesh.computeBoundingBox();mesh.boundingBox.expandByScalar(padding);
    }
  }catch(error){for(const chunk of chunks)chunk.dispose();throw error;}
  const parent=source.parent;
  if(parent){
    const at=parent.children.indexOf(source);parent.remove(source);for(const chunk of chunks)parent.add(chunk);
    parent.children.splice(parent.children.length-chunks.length,chunks.length);parent.children.splice(at,0,...chunks);
  }
  // The family owns its shadow pair; cells merely borrow it. Existing scene
  // teardown disposes each owned main material once, which releases this owner.
  const material=source.material,shadows=new Set([source.customDepthMaterial,source.customDistanceMaterial].filter(Boolean));
  const release=()=>{material.removeEventListener('dispose',release);for(const chunk of chunks)chunk.dispose();for(const shadow of shadows)shadow.dispose();};
  material.addEventListener('dispose',release);
  source.dispose();return chunks;
}
