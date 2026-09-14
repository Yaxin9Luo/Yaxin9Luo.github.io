import * as THREE from 'three';
import {overviewAffineScaleBound} from './asset-overview.js';
import {zhengjuesiDistanceCandidates,zhengjuesiDistanceCandidateError} from './zhengjuesi-distance-geometry.js';

const triangleCount=g=>(g.index?.count??g.attributes.position.count)/3;
const checkpoint=signal=>{if(signal?.aborted)throw signal.reason??new DOMException('Distance build aborted','AbortError');};
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const callbackNames=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
const attrSizes={position:3,normal:3,tangent:4,uv:2,uv1:2,uv2:2,uv3:2,color:null};

function orthogonalPositive(matrix){
  overviewAffineScaleBound(matrix);const e=matrix.elements,columns=[0,4,8].map(i=>new THREE.Vector3(e[i],e[i+1],e[i+2]));
  if(matrix.determinant()<=0)throw new Error('Distance batching requires positive nonsingular instance transforms.');
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(Math.abs(columns[i].dot(columns[j]))>columns[i].length()*columns[j].length()*1e-6)throw new Error('Sheared instance normals need a separately verified adapter.');
}

function flags(node,root){
  let visible=node.visible,groupOrder=root.renderOrder,orderFound=false;
  for(let p=node.parent;p&&p!==root;p=p.parent){visible&&=p.visible;if(p.isGroup&&!orderFound){groupOrder=p.renderOrder;orderFound=true;}}
  return {visible,castShadow:node.castShadow,receiveShadow:node.receiveShadow,frustumCulled:node.frustumCulled,renderOrder:node.renderOrder,layers:node.layers.mask,groupOrder};
}

function applyFlags(node,f){
  for(const key of ['visible','castShadow','receiveShadow','frustumCulled','renderOrder'])node[key]=f[key];node.layers.mask=f.layers;
}

function matrixEncodingError(matrix,rounded,box,rootLinear){
  const a=new THREE.Vector3(),b=new THREE.Vector3();let maximum=0;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    a.set(x,y,z).applyMatrix4(matrix);b.set(x,y,z).applyMatrix4(rounded);a.sub(b).applyMatrix3(rootLinear);maximum=Math.max(maximum,a.length());
  }
  return maximum;
}

function mergeLayout(geometry,material){
  const attrs=geometry.attributes;
  if(!attrs.normal||Object.keys(attrs).some(name=>!(name in attrSizes)||attrs[name].isInterleavedBufferAttribute||!(attrs[name].array instanceof Float32Array)||attrs[name].normalized||(attrSizes[name]&&attrs[name].itemSize!==attrSizes[name])))return null;
  if(attrs.color&&![3,4].includes(attrs.color.itemSize))return null;
  const names=Object.keys(attrs).filter(name=>name!=='color').sort(),colorSize=material.vertexColors&&attrs.color?.itemSize===4?4:3;
  return {names,colorSize,key:names.join('/')+`/color${colorSize}`};
}

function bindingRuns(records){
  const runs=[];
  for(let i=0;i<records.length;i++){
    const r=records[i],last=runs.at(-1);
    if(last&&last.sourceNode===r.node.name&&last.sourceNodeOrdinal===r.ordinal&&last.sourceInstanceStart+last.count===r.instance){last.count++;continue;}
    runs.push({sourceNode:r.node.name,sourceNodeOrdinal:r.ordinal,sourceInstanceStart:r.instance,outputInstanceStart:i,count:1,sourceUserData:r.node.userData});
  }
  return runs;
}

/** Static building pipeline: candidate production is separate from batching.
 * This owns only new geometry/materials/InstancedMeshes. Source geometry,
 * material and real texture pixels are borrowed until export finishes.
 * Transparent/multiple-material meshes keep their existing individual draws.
 * Skinning, callback shaders and sheared instance matrices are refused.
 * spatialCellSizeWorld=0 keeps the original global buckets. A positive metre
 * size partitions whole instances by source-world AABB centres in XYZ; output
 * bounds include the entire primitive even when it extends across cells. */
export async function createBuildingDistanceAsset(source,{id,sourceArchiveDigest,maximumErrorWorld,candidateProvider,candidateError,sparseInstanceLimit=32,maximumMergedVertices=750000,spatialCellSizeWorld=0,signal,onProgress,yieldControl=yieldTask}={}){
  if(!source?.group?.isObject3D||source.group.parent||!Number.isFinite(maximumErrorWorld)||maximumErrorWorld<=0||!Number.isInteger(sparseInstanceLimit)||sparseInstanceLimit<0||!Number.isInteger(maximumMergedVertices)||maximumMergedVertices<3||!Number.isFinite(spatialCellSizeWorld)||spatialCellSizeWorld<0||typeof candidateProvider!=='function'||typeof candidateError!=='function')throw new Error('A standalone static source, explicit world error and candidate provider are required.');
  checkpoint(signal);source.group.updateWorldMatrix(true,true);
  const originalRoot=source.group.matrixWorld.clone(),inverseRoot=originalRoot.clone().invert(),rootLinear=new THREE.Matrix3().setFromMatrix4(originalRoot);overviewAffineScaleBound(originalRoot);
  if(originalRoot.determinant()<=0)throw new Error('Distance root must have a positive nonsingular transform.');
  const group=new THREE.Group().copy(source.group,false);group.name=source.group.name+'-distance';
  const owned=new Set(),candidates=new Map(),buckets=new Map(),sourceBounds=new THREE.Box3(),outputMaterials=new Map(),groupOrders=new Map(),geometryRecords=new Map(),geometryBoxes=new Map(),spatialCells=new Set();
  const boundsOf=g=>{if(!geometryBoxes.has(g))geometryBoxes.set(g,g.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(g.attributes.position));return geometryBoxes.get(g);};
  let disposed=false,disposal=null;
  const report={schema:1,kind:'yuanmingyuan-building-distance',id,sourceArchiveDigest,sourceRootWorldMatrix:originalRoot.toArray(),requestedMaximumErrorWorld:maximumErrorWorld,maximumErrorArchiveWorld:0,maximumMatrixEncodingErrorWorld:0,maximumVertexEncodingErrorWorld:0,fullArchiveRetained:true,texturePixelsUnchanged:true,materialResponse:'original PBR; sparse vertex-color material clones only',nativeDistanceVisualReview:false,originalTriangles:0,distanceTriangles:0,originalDraws:0,distanceDraws:0,originalInstances:0,representedInstances:0,instancedDraws:0,mergedDraws:0,retainedIndividualDraws:0,sourceVerticesMoved:false,candidateVerticesChanged:true,geometries:[],numericQualification:'geometric upper bounds plus measured Float32 encoding displacement; GPU arithmetic, light, shadows and transitions require native review'};
  if(spatialCellSizeWorld)report.spatialBatching={method:'source-instance-world-aabb-centre',cellSizeWorld:spatialCellSizeWorld,dimensions:3,partitionedInstances:0,occupiedCells:0,batchChunks:0};
  const dispose=()=>{if(disposed)return disposal;disposed=true;const counts={geometries:0,materials:0,instancedMeshes:0};for(const resource of owned){if(resource.isBufferGeometry)counts.geometries++;else if(resource.isMaterial)counts.materials++;else if(resource.isInstancedMesh)counts.instancedMeshes++;resource.dispose();}owned.clear();candidates.clear();buckets.clear();geometryRecords.clear();geometryBoxes.clear();outputMaterials.clear();groupOrders.clear();spatialCells.clear();group.clear();disposal={...counts,borrowedSourceResourcesDisposed:0,idempotent:true};return disposal;};
  const attach=(node,f)=>{applyFlags(node,f);if(!groupOrders.has(f.groupOrder)){const order=new THREE.Group();order.name='distance-order-'+f.groupOrder;order.renderOrder=f.groupOrder;group.add(order);groupOrders.set(f.groupOrder,order);}groupOrders.get(f.groupOrder).add(node);report.distanceDraws++;};
  try{
    const nodes=[];source.group.traverse(node=>{if(node.isMesh)nodes.push(node);});
    for(let ordinal=0;ordinal<nodes.length;ordinal++){
      checkpoint(signal);const node=nodes[ordinal],geometry=node.geometry,material=node.material,count=node.isInstancedMesh?node.count:1,f=flags(node,source.group),materials=Array.isArray(material)?material:[material];
      if(node.isSkinnedMesh||node.morphTargetInfluences?.length||Object.keys(geometry.morphAttributes).length||callbackNames.some(key=>node[key]!==THREE.Object3D.prototype[key])||materials.some(m=>m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey))throw new Error('Animated geometry or callback shaders need a separately verified distance adapter.');
      report.originalDraws++;report.originalInstances+=count;report.originalTriangles+=triangleCount(geometry)*count;
      const localNode=new THREE.Matrix4().multiplyMatrices(inverseRoot,node.matrixWorld),sourceBox=boundsOf(geometry);
      const separate=Array.isArray(material)||material.transparent||geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity;
      if(!candidates.has(geometry)){
        const variants=await candidateProvider(geometry);
        for(const variant of variants)if(variant.geometry?.isBufferGeometry&&variant.geometry!==geometry)owned.add(variant.geometry);
        checkpoint(signal);
        for(const variant of variants)if(!variant.proof?.certified||!variant.geometry?.isBufferGeometry||variant.geometry===geometry)throw new Error('Candidate provider must return independently owned certified geometry.');
        variants.sort((a,b)=>triangleCount(a.geometry)-triangleCount(b.geometry));candidates.set(geometry,variants);
        const record={name:geometry.name,sourceTriangles:triangleCount(geometry),instances:0,retainedInstances:0,variants:variants.map(v=>({name:v.geometry.name,triangles:triangleCount(v.geometry),proof:v.proof,instances:0,maximumWorldError:0}))};geometryRecords.set(geometry,record);report.geometries.push(record);
      }
      const variants=candidates.get(geometry),stats=geometryRecords.get(geometry);
      if(separate){
        const copy=node.clone(false);if(copy.isInstancedMesh)owned.add(copy);copy.matrixAutoUpdate=false;copy.matrix.copy(localNode);copy.matrixWorldAutoUpdate=true;copy.customDepthMaterial=node.customDepthMaterial;copy.customDistanceMaterial=node.customDistanceMaterial;attach(copy,f);report.retainedIndividualDraws++;report.distanceTriangles+=triangleCount(geometry)*count;report.representedInstances+=count;stats.retainedInstances+=count;stats.instances+=count;
        for(let i=0;i<count;i++){const m=new THREE.Matrix4();if(node.isInstancedMesh)node.getMatrixAt(i,m);m.premultiply(node.matrixWorld);sourceBounds.union(sourceBox.clone().applyMatrix4(m));}continue;
      }
      for(let instance=0;instance<count;instance++){
        const local=new THREE.Matrix4();if(node.isInstancedMesh)node.getMatrixAt(instance,local);local.premultiply(localNode);orthogonalPositive(local);
        const world=new THREE.Matrix4().multiplyMatrices(originalRoot,local),worldBounds=sourceBox.clone().applyMatrix4(world);sourceBounds.union(worldBounds);stats.instances++;
        // Optional whole-instance partitioning uses the original world AABB.
        // It never clips a primitive or changes its geometry/instance matrix.
        const spatialCell=spatialCellSizeWorld?['x','y','z'].map(axis=>Math.floor((worldBounds.min[axis]+worldBounds.max[axis])*.5/spatialCellSizeWorld)):null;
        if(spatialCell?.some(value=>!Number.isFinite(value)))throw new Error('Spatial batching requires finite instance bounds.');
        let variant=null,error=0;
        for(const item of variants){const candidateBound=candidateError(item,world);if(!Number.isFinite(candidateBound)||candidateBound<0)throw new Error('Invalid candidate world error.');if(candidateBound<=maximumErrorWorld*.999){variant=item;error=candidateBound;break;}}
        const chosen=variant?.geometry??geometry,rounded=new THREE.Matrix4().fromArray(new Float32Array(local.elements)),box=boundsOf(chosen),encoding=matrixEncodingError(local,rounded,box,rootLinear);
        if(error+encoding>maximumErrorWorld)throw new Error('Matrix encoding exceeds the explicit distance error budget.');
        if(variant){const s=stats.variants[variants.indexOf(variant)];s.instances++;s.maximumWorldError=Math.max(s.maximumWorldError,error);}else stats.retainedInstances++;
        let key=[chosen.uuid,material.uuid,node.customDepthMaterial?.uuid??'',node.customDistanceMaterial?.uuid??'',JSON.stringify(f)].join('|');
        if(spatialCell){const cell=spatialCell.join(',');key+='|cell:'+cell;spatialCells.add(cell);report.spatialBatching.partitionedInstances++;}
        if(!buckets.has(key))buckets.set(key,{geometry:chosen,material,flags:f,depth:node.customDepthMaterial,distance:node.customDistanceMaterial,spatialCell,records:[]});
        const color=new THREE.Color(1,1,1);if(node.instanceColor)node.getColorAt(instance,color);
        buckets.get(key).records.push({node,ordinal,instance,local,rounded,color,hasColor:!!node.instanceColor,error,encoding});
        report.maximumMatrixEncodingErrorWorld=Math.max(report.maximumMatrixEncodingErrorWorld,encoding);report.representedInstances++;report.distanceTriangles+=triangleCount(chosen);
      }
      onProgress?.({phase:'distance-instances',completed:ordinal+1,total:nodes.length});if(ordinal%16===15){await yieldControl();checkpoint(signal);}
    }

    const mergeBuckets=new Map();
    for(const bucket of buckets.values()){
      checkpoint(signal);const {geometry,material,flags:f,records}=bucket,layout=mergeLayout(geometry,material),merge=records.length<=sparseInstanceLimit&&layout&&!bucket.depth&&!bucket.distance&&geometry.attributes.position.count*records.length<=maximumMergedVertices;
      if(merge){
        let key=[material.uuid,JSON.stringify(f),layout.key].join('|');if(bucket.spatialCell)key+='|cell:'+bucket.spatialCell.join(',');if(!mergeBuckets.has(key))mergeBuckets.set(key,{material,flags:f,layout,spatialCell:bucket.spatialCell,items:[],vertices:0});
        let destination=mergeBuckets.get(key);
        if(destination.vertices+geometry.attributes.position.count*records.length>maximumMergedVertices){buildMerged(destination);destination={material,flags:f,layout,spatialCell:bucket.spatialCell,items:[],vertices:0};mergeBuckets.set(key,destination);}
        destination.items.push(bucket);destination.vertices+=geometry.attributes.position.count*records.length;
      }else{
        const mesh=new THREE.InstancedMesh(geometry,material,records.length),hasColors=records.some(item=>item.hasColor);owned.add(mesh);mesh.name='distance-instanced/'+geometry.name+'/'+material.name;mesh.customDepthMaterial=bucket.depth;mesh.customDistanceMaterial=bucket.distance;
        for(let i=0;i<records.length;i++){const r=records[i];mesh.setMatrixAt(i,r.rounded);if(hasColors)mesh.setColorAt(i,r.color);report.maximumErrorArchiveWorld=Math.max(report.maximumErrorArchiveWorld,r.error+r.encoding);}
        mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        // InstancedMesh.computeBounding* would mutate a borrowed prototype if
        // its lazy bounds are unset. Compute conservative owned bounds here.
        mesh.boundingBox=new THREE.Box3();for(const r of records)mesh.boundingBox.union(boundsOf(geometry).clone().applyMatrix4(r.rounded));mesh.boundingSphere=mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
        mesh.userData={representation:'distance',sourceBindings:bindingRuns(records)};if(bucket.spatialCell){mesh.userData.spatialCell=bucket.spatialCell;mesh.name+='/cell-'+bucket.spatialCell.join(',');}attach(mesh,f);report.instancedDraws++;
      }
    }
    for(const bucket of mergeBuckets.values()){checkpoint(signal);buildMerged(bucket);await yieldControl();}

    function buildMerged(bucket){
      if(!bucket.vertices)return;const geometry=new THREE.BufferGeometry(),attributes={},indices=[],bindings=[],position=new THREE.Vector3(),roundedPosition=new THREE.Vector3(),normal=new THREE.Vector3(),tangent=new THREE.Vector3();owned.add(geometry);
      for(const name of bucket.layout.names)attributes[name]=new Float32Array(bucket.vertices*attrSizes[name]);attributes.color=new Float32Array(bucket.vertices*bucket.layout.colorSize);
      let offset=0;
      for(const item of bucket.items)for(const r of item.records){
        checkpoint(signal);const input=item.geometry,normalMatrix=new THREE.Matrix3().getNormalMatrix(r.local),linear=new THREE.Matrix3().setFromMatrix4(r.local);let encoding=0;
        for(let i=0;i<input.attributes.position.count;i++){
          for(const name of bucket.layout.names){const attribute=input.attributes[name],size=attribute.itemSize,start=(offset+i)*size;
            if(name==='position'){position.fromBufferAttribute(attribute,i).applyMatrix4(r.local);attributes.position.set(position.toArray(),start);roundedPosition.fromArray(attributes.position,start).sub(position).applyMatrix3(rootLinear);encoding=Math.max(encoding,roundedPosition.length());}
            else if(name==='normal'){normal.fromBufferAttribute(attribute,i).applyMatrix3(normalMatrix).normalize();attributes.normal.set(normal.toArray(),start);}
            else if(name==='tangent'){tangent.fromBufferAttribute(attribute,i).applyMatrix3(linear).normalize();attributes.tangent.set([...tangent.toArray(),attribute.getW(i)],start);}
            else for(let c=0;c<size;c++)attributes[name][start+c]=attribute.array[i*size+c];
          }
          const originalColor=input.attributes.color,hasVertexColor=bucket.material.vertexColors&&originalColor,size=bucket.layout.colorSize,start=(offset+i)*size;
          for(let c=0;c<3;c++)attributes.color[start+c]=(hasVertexColor?originalColor.array[i*originalColor.itemSize+c]:1)*r.color.toArray()[c];if(size===4)attributes.color[start+3]=originalColor.getW(i);
        }
        for(let i=0;i<(input.index?.count??input.attributes.position.count);i++)indices.push(offset+(input.index?input.index.getX(i):i));
        if(r.error+encoding>maximumErrorWorld)throw new Error('Merged vertex encoding exceeds the explicit distance error budget.');
        report.maximumVertexEncodingErrorWorld=Math.max(report.maximumVertexEncodingErrorWorld,encoding);report.maximumErrorArchiveWorld=Math.max(report.maximumErrorArchiveWorld,r.error+encoding);
        bindings.push({sourceNode:r.node.name,sourceNodeOrdinal:r.ordinal,sourceInstance:r.instance,firstVertex:offset,vertexCount:input.attributes.position.count,sourceUserData:r.node.userData});offset+=input.attributes.position.count;
      }
      for(const [name,array] of Object.entries(attributes))geometry.setAttribute(name,new THREE.BufferAttribute(array,name==='color'?bucket.layout.colorSize:attrSizes[name]));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name='distance-merged/'+bucket.material.name;
      const key=bucket.material.uuid+'|'+bucket.layout.colorSize;
      if(!outputMaterials.has(key)){const material=bucket.material.clone();material.vertexColors=true;material.name=bucket.material.name+'-distance-vertex-colors';owned.add(material);outputMaterials.set(key,material);}
      const mesh=new THREE.Mesh(geometry,outputMaterials.get(key));mesh.name=geometry.name;mesh.userData={representation:'distance',sourceBindings:bindings};if(bucket.spatialCell){mesh.userData.spatialCell=bucket.spatialCell;mesh.name+='/cell-'+bucket.spatialCell.join(',');}attach(mesh,bucket.flags);report.mergedDraws++;
    }

    if(report.representedInstances!==report.originalInstances)throw new Error('Distance representation lost source instances.');
    checkpoint(signal);report.boundsArchiveWorld={min:sourceBounds.min.toArray(),max:sourceBounds.max.toArray()};group.updateWorldMatrix(true,true);report.triangleReduction=1-report.distanceTriangles/report.originalTriangles;report.drawReduction=1-report.distanceDraws/report.originalDraws;
    if(report.spatialBatching){report.spatialBatching.occupiedCells=spatialCells.size;report.spatialBatching.batchChunks=report.instancedDraws+report.mergedDraws;}
    return {group,report,diagnostics:{representation:'building-distance-pilot',visualAcceptance:false,id,sourceArchiveDigest},dispose};
  }catch(error){dispose();throw error;}
}

export function createZhengjuesiDistanceAsset(source,options){return createBuildingDistanceAsset(source,{...options,id:'zhengjuesi',candidateProvider:zhengjuesiDistanceCandidates,candidateError:zhengjuesiDistanceCandidateError});}
