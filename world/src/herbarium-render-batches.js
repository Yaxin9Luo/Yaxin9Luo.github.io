import * as THREE from 'three';

const installations=new WeakMap(),renderSources=new WeakSet(),cellSize=6;
const callbacks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
// These existing Didelta hooks modify only fragment shading/alpha. Unknown
// compile hooks may move vertices or depend on a particular Object3D.
const staticDideltaHooks=new Set(['didelta-original-thin-leaf-scalar-v2','didelta-scalar-alpha-shadow-v1']);
const abortError=()=>new DOMException('Herbarium render batching cancelled','AbortError');

// Visibility-aware occlusion keeps these original sources active. This marker
// exempts only the source leaf; an independently hidden ancestor still hides it.
export function isHerbariumRenderSource(object){return renderSources.has(object);}

function safeMaterial(material){
  if(!material||Array.isArray(material)||!material.visible||material.transparent||material.opacity<1||!material.depthWrite||!material.depthTest||material.transmission>0||material.stencilWrite||material.isShaderMaterial)return false;
  if(![THREE.NormalBlending,THREE.NoBlending].includes(material.blending)||material.userData.environmentWind||material.onBeforeRender!==THREE.Material.prototype.onBeforeRender)return false;
  return material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile||material.userData.sourceAsset==='didelta_spinosa'&&staticDideltaHooks.has(material.customProgramCacheKey());
}

function orthogonalPositive(matrix){
  const e=matrix.elements;if(!e.every(Number.isFinite)||matrix.determinant()<=0)return false;
  const columns=[0,4,8].map(i=>new THREE.Vector3(e[i],e[i+1],e[i+2]));
  return columns.every(v=>v.lengthSq()>1e-16)&&[[0,1],[0,2],[1,2]].every(([a,b])=>Math.abs(columns[a].dot(columns[b]))<=1e-7*columns[a].length()*columns[b].length());
}

function eligible(mesh,root){
  const geometry=mesh.geometry;
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.children.length||mesh.count!==1||!geometry?.attributes.position?.count||geometry.isInstancedBufferGeometry||Object.keys(geometry.morphAttributes).length||mesh.morphTargetInfluences||mesh.instanceColor)return false;
  if(!safeMaterial(mesh.material)||[mesh.customDepthMaterial,mesh.customDistanceMaterial].some(m=>m&&!safeMaterial(m)))return false;
  if([...Object.values(geometry.attributes),geometry.index].filter(Boolean).some(a=>(a.isInterleavedBufferAttribute?a.data.usage:a.usage)!==THREE.StaticDrawUsage))return false;
  for(let node=mesh;node;node=node.parent){
    if(!node.visible||node.animations.length||node.scale.toArray().some(n=>n<=0)||callbacks.some(key=>node[key]!==THREE.Object3D.prototype[key]))return false;
    if(node===root)break;
  }
  return true;
}

/** Install only after static authoring, supports and courtyard planting finish.
 * Original objects remain in place for inspection and physics. This optional
 * render owner borrows their resources and restores visibility on dispose.
 * Dispose/reinstall if placements or visibility change; no camera drives it. */
export function installHerbariumRenderBatches(root,{signal}={}){
  if(signal?.aborted)throw abortError();
  if(!root?.isObject3D)throw new TypeError('A completed herbarium Object3D is required');
  if(installations.has(root))return installations.get(root);
  root.updateWorldMatrix(true,true);
  const groups=new Map(),inverse=root.matrixWorld.clone().invert(),validRoot=orthogonalPositive(root.matrixWorld);
  const metrics={active:true,cellSize,sourceMeshCount:0,eligibleMeshCount:0,batchedMeshCount:0,batchCount:0,savedDrawsPerPass:0,instanceMatrixBytes:0,trianglesPreserved:0};
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;metrics.sourceMeshCount++;
    if(!validRoot||!eligible(mesh,root))return;
    const matrix=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
    // Three's per-instance normal transform does not support shear.
    if(!orthogonalPositive(matrix))return;
    metrics.eligibleMeshCount++;
    let parent=mesh.parent;while(parent&&!parent.isGroup)parent=parent.parent;
    const groupOrder=parent?.renderOrder||0,x=Math.floor(mesh.matrixWorld.elements[12]/cellSize),z=Math.floor(mesh.matrixWorld.elements[14]/cellSize);
    const key=[mesh.geometry.id,mesh.material.id,mesh.customDepthMaterial?.id??-1,mesh.customDistanceMaterial?.id??-1,mesh.layers.mask,mesh.renderOrder,groupOrder,mesh.castShadow,mesh.receiveShadow,mesh.frustumCulled,x,z].join('/');
    if(!groups.has(key))groups.set(key,{sources:[],matrices:[],cell:[x,z],groupOrder});
    const group=groups.get(key);group.sources.push(mesh);group.matrices.push(matrix);
  });
  const container=new THREE.Group();container.name='Herbarium runtime render batches';container.userData.herbariumRenderOnly=true;
  const batches=[],originals=[],geometryBounds=new WeakMap(),orders=new Map();let disposed=false,ownerRoot=root;
  const handle={metrics,batches,dispose(){
    if(disposed)return;disposed=true;metrics.active=false;signal?.removeEventListener('abort',handle.dispose);
    if(installations.get(ownerRoot)===handle)installations.delete(ownerRoot);ownerRoot=null;
    for(const [source,visible]of originals){source.visible=visible;renderSources.delete(source);}
    // Release instance buffers/VAOs only; geometry, materials and maps belong
    // to the source asset owners and may still serve another living world.
    let failure;
    try{container.removeFromParent();}catch(error){failure=error;}
    for(const batch of batches)try{batch.dispose();}catch(error){failure??=error;}
    for(const child of [...container.children])try{container.remove(child);}catch(error){failure??=error;}
    batches.length=originals.length=0;orders.clear();groups.clear();
    if(failure)throw failure;
  }};
  try{
    for(const {sources,matrices,cell,groupOrder}of groups.values()){
      if(sources.length<2)continue;if(signal?.aborted)throw abortError();
      const source=sources[0],batch=new THREE.InstancedMesh(source.geometry,source.material,sources.length);batches.push(batch);
      batch.name=`${source.name} / herbarium cell ${cell.join(',')}`;batch.matrixAutoUpdate=false;batch.layers.mask=source.layers.mask;
      for(const key of ['castShadow','receiveShadow','frustumCulled','renderOrder','customDepthMaterial','customDistanceMaterial'])batch[key]=source[key];
      batch.userData.herbariumRenderBatch={cell,sourceUUIDs:sources.map(mesh=>mesh.uuid)};
      // Existing source objects retain the authoring/picking contract. The
      // extra render proxy must not introduce duplicate raycast hits.
      batch.raycast=()=>{};
      if(!geometryBounds.has(source.geometry)){
        const box=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position);
        if(![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw new Error('Non-finite herbarium source bounds');
        geometryBounds.set(source.geometry,box);
      }
      const sourceBox=geometryBounds.get(source.geometry),instance=new THREE.Matrix4();batch.boundingBox=new THREE.Box3();
      for(let i=0;i<sources.length;i++){
        batch.setMatrixAt(i,matrices[i]);batch.getMatrixAt(i,instance);
        batch.boundingBox.union(sourceBox.clone().applyMatrix4(instance));originals.push([sources[i],sources[i].visible]);
      }
      batch.boundingSphere=batch.boundingBox.getBoundingSphere(new THREE.Sphere());batch.instanceMatrix.needsUpdate=true;
      if(!orders.has(groupOrder)){const group=new THREE.Group();group.renderOrder=groupOrder;orders.set(groupOrder,group);container.add(group);}
      orders.get(groupOrder).add(batch);
      metrics.batchedMeshCount+=sources.length;metrics.instanceMatrixBytes+=batch.instanceMatrix.array.byteLength;
      const geometry=source.geometry,count=geometry.index?.count||geometry.attributes.position.count,start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count);
      metrics.trianglesPreserved+=Math.max(0,end-start)/3*sources.length;
    }
    metrics.batchCount=batches.length;metrics.savedDrawsPerPass=metrics.batchedMeshCount-metrics.batchCount;
    signal?.addEventListener('abort',handle.dispose,{once:true});installations.set(root,handle);
    for(const [source]of originals){renderSources.add(source);source.visible=false;}
    if(batches.length)root.add(container);
    if(signal?.aborted)throw abortError();
    groups.clear();
    return handle;
  }catch(error){try{handle.dispose();}catch{/* Preserve the original assembly failure. */}throw error;}
}
