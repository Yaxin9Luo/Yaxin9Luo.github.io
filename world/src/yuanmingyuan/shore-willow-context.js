import * as THREE from 'three';
import {shoreSHA256,stableShoreJSON} from './xianfa-shore-community-prepared-signature.js';
import {retainedShoreWillowContext} from './shore-willow-context-data.js';

const expect=(ok,message)=>{if(!ok)throw new Error('Prepared shore willow context: '+message);};
const bytesOf=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const equal=(a,b)=>stableShoreJSON(a)===stableShoreJSON(b);
const columns=[0,1,2,4,5,6,8,9,10,12,13,14];
const shape=a=>({arrayType:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,byteLength:a.array.byteLength});
const shapeOfRecord=row=>Object.fromEntries(['arrayType','itemSize','count','normalized','byteLength'].map(key=>[key,row[key]]));
const range=g=>({start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'});
const boxRecord=box=>({min:box.min.toArray(),max:box.max.toArray()});
const finiteBounds=(actual,expected,tolerance)=>['min','max'].every(key=>actual[key].length===3&&actual[key].every((v,i)=>Number.isFinite(v)&&Math.abs(v-expected[key][i])<=tolerance));

/** Every original leaf, including those without a measured engine difference,
 * is checked. The reference is not written to the borrowed source. Translation
 * bits stay exact; only the dimensionless 3x3 basis has a numerical bound. */
export function compareWillowContextPoses(actual,reference,{count,componentOffset=0,tolerance}){
  expect(actual instanceof Float32Array&&reference instanceof Float32Array&&actual.length===count*16&&componentOffset+count*12<=reference.length,'pose array shape changed');
  expect(Number.isFinite(tolerance?.basisAbsolute)&&tolerance.basisAbsolute>0&&tolerance.basisAbsolute<=2**-23,'unsupported pose tolerance');
  const bits=new Uint32Array(actual.buffer,actual.byteOffset,actual.length),refBits=new Uint32Array(reference.buffer,reference.byteOffset,reference.length);
  let changedComponents=0,changedPoses=0,maximumBasisDifference=0,maximumLinearFrobeniusError=0,maximumColumnLengthDifference=0,maximumNormalizedColumnDot=0;
  for(let pose=0;pose<count;pose++){
    const at=pose*16,ref=componentOffset+pose*12;let changed=false,frobenius=0;
    if(!(actual[at+3]===0&&actual[at+7]===0&&actual[at+11]===0&&actual[at+15]===1))expect(false,'non-affine leaf pose '+pose);
    for(let c=0;c<12;c++){
      const a=actual[at+columns[c]],b=reference[ref+c];if(!Number.isFinite(a)||!Number.isFinite(b))expect(false,'nonfinite leaf pose '+pose);
      if(c>=9){if(bits[at+columns[c]]!==refBits[ref+c])expect(false,'leaf anchor changed: '+pose);}
      else{
        const difference=Math.abs(a-b);if(difference>tolerance.basisAbsolute)expect(false,'leaf basis outside numerical bound: '+pose+'/'+columns[c]);
        maximumBasisDifference=Math.max(maximumBasisDifference,difference);frobenius+=difference*difference;
        if(bits[at+columns[c]]!==refBits[ref+c]){changedComponents++;changed=true;}
      }
    }
    if(changed)changedPoses++;maximumLinearFrobeniusError=Math.max(maximumLinearFrobeniusError,Math.sqrt(frobenius));
    const a=actual,x=Math.hypot(a[at],a[at+1],a[at+2]),y=Math.hypot(a[at+4],a[at+5],a[at+6]),z=Math.hypot(a[at+8],a[at+9],a[at+10]);
    const determinant=a[at]*(a[at+5]*a[at+10]-a[at+6]*a[at+9])-a[at+4]*(a[at+1]*a[at+10]-a[at+2]*a[at+9])+a[at+8]*(a[at+1]*a[at+6]-a[at+2]*a[at+5]);
    if(!(determinant>0&&Number.isFinite(determinant)))expect(false,'non-positive leaf pose '+pose);
    const scaleDifference=Math.max(x,y,z)-Math.min(x,y,z),dot=Math.max(Math.abs(a[at]*a[at+4]+a[at+1]*a[at+5]+a[at+2]*a[at+6])/(x*y),Math.abs(a[at]*a[at+8]+a[at+1]*a[at+9]+a[at+2]*a[at+10])/(x*z),Math.abs(a[at+4]*a[at+8]+a[at+5]*a[at+9]+a[at+6]*a[at+10])/(y*z));
    if(!(scaleDifference<=tolerance.uniformScaleAbsolute&&dot<=tolerance.normalizedColumnDot))expect(false,'non-uniform or sheared leaf pose '+pose);
    maximumColumnLengthDifference=Math.max(maximumColumnLengthDifference,scaleDifference);maximumNormalizedColumnDot=Math.max(maximumNormalizedColumnDot,dot);
  }
  return {poses:count,changedPoses,changedComponents,maximumBasisDifference,maximumLinearFrobeniusError,maximumColumnLengthDifference,maximumNormalizedColumnDot,translationBitsExact:true,basisAbsoluteTolerance:tolerance.basisAbsolute,sourceWritten:false};
}

/** Borrowed same-source pair validation. contract is an explicit immutable
 * identity record; the production wrapper below fixes its actual revision.
 * referenceBytes is a verified-data injection for small CPU fixtures. */
export async function verifyWillowContextPair({first,second,contract,referenceBytes,fetchImpl=fetch,signal,onResource=()=>{}}){
  signal?.throwIfAborted();
  const started=performance.now(),listeners=[],captured=[],attributes=new Map(),geometryOwners=new Map(),materialOwners=new Map(),geometries=[],poseComparisons=[],attributeSHA256=[];
  let invalidated=false;const invalidate=()=>{invalidated=true;};
  const live=()=>{signal?.throwIfAborted();expect(!invalidated,'borrowed context source was disposed');};
  const get=(root,route)=>route.reduce((node,index)=>node?.children[index],root);
  function inspectStructure(){
    expect(first?.isGroup&&second?.isGroup&&first!==second,'two distinct original source groups are required');
    for(const root of [first,second]){let total=0;root.traverse(()=>total++);expect(total===contract.nodes.length,'source hierarchy count changed');}
    for(const record of contract.nodes){
      const a=get(first,record.route),b=get(second,record.route);
      for(const node of [a,b])expect(node?.name===record.name&&node.type===record.type&&!!node.isMesh===record.mesh&&node.visible===record.visible&&equal(node.matrix.toArray(),record.matrix.values),'source hierarchy/local transform changed: '+record.name);
      if(a.isMesh)expect(a.geometry===b.geometry&&a.material===b.material&&a.instanceMatrix===b.instanceMatrix&&a.instanceColor===b.instanceColor&&a.count===b.count,'retained willows no longer share the exact original prototype: '+a.name);
    }
    for(const record of contract.meshes)if(geometryOwners.has(record.geometry)){
      const node=get(first,record.route);expect(node.geometry===geometryOwners.get(record.geometry)&&(node.isInstancedMesh?node.count:0)===record.instanceCount&&node.castShadow===record.castShadow&&node.receiveShadow===record.receiveShadow,'source geometry/count/draw state changed during verification');
      const materials=Array.isArray(node.material)?node.material:[node.material];expect(materials.length===record.materials.length&&materials.every((m,i)=>m===materialOwners.get(record.materials[i].id)&&m.name===record.materials[i].name&&m.type===record.materials[i].type),'source material changed during verification');
    }
    for(const {geometry,record} of geometries)expect(geometry.name===record.name&&geometry.type===record.type&&equal(geometry.groups,record.groups)&&equal(range(geometry),record.drawRange),'source metadata changed during verification');
    for(const row of captured){const current=row.name==='index'?row.geometry.index:row.geometry?row.geometry.attributes[row.name]:row.mesh[row.name];expect(current===row.attribute&&current.array===row.array&&current.version===row.version&&equal(shape(current),row.shape),'borrowed attribute changed during context verification: '+row.id);}
  }
  function capture(id,a,{geometry,name,mesh}){
    const expected=contract.streams.find(row=>row.id===id);
    expect(expected&&a&&!a.isInterleavedBufferAttribute&&ArrayBuffer.isView(a.array)&&equal(shape(a),shapeOfRecord(expected)),'source attribute shape changed: '+id);
    const row={id,attribute:a,array:a.array,version:a.version,shape:shape(a),geometry,name,mesh,expected};captured.push(row);attributes.set(id,row);return row;
  }
  try{
    inspectStructure();const resources=new Set();
    for(let i=0;i<contract.meshes.length;i++){
      const record=contract.meshes[i],node=get(first,record.route),g=node.geometry;
      expect(!node.isSkinnedMesh&&!node.isBatchedMesh&&!node.morphTargetInfluences&&!node.morphTexture&&!!node.isInstancedMesh===(record.instanceCount>0),'source representation changed: '+node.name);
      expect((node.isInstancedMesh?node.count:0)===record.instanceCount&&node.castShadow===record.castShadow&&node.receiveShadow===record.receiveShadow,'source leaf count or draw state changed');
      if(geometryOwners.has(record.geometry))expect(geometryOwners.get(record.geometry)===g,'source geometry sharing split');else{
        expect(![...geometryOwners.values()].includes(g),'distinct source geometry merged');geometryOwners.set(record.geometry,g);const expected=contract.geometries[record.geometry];
        expect(g.name===expected.name&&g.type===expected.type&&equal(g.groups,expected.groups)&&equal(range(g),expected.drawRange),'source geometry metadata changed');
        const names=[['index',g.index],...Object.entries(g.attributes)].filter(([,a])=>a).map(([name])=>name);
        expect(equal(names,expected.attributeNames),'source attribute set/order changed');
        for(const name of names)capture('geometry/'+record.geometry+'/'+name,name==='index'?g.index:g.attributes[name],{geometry:g,name});
        geometries.push({geometry:g,record:expected});
      }
      const materials=Array.isArray(node.material)?node.material:[node.material];expect(materials.length===record.materials.length,'source material assignment changed');
      for(let m=0;m<materials.length;m++){
        const material=materials[m],expected=record.materials[m];expect(material.name===expected.name&&material.type===expected.type,'source material identity changed');
        if(materialOwners.has(expected.id))expect(materialOwners.get(expected.id)===material,'source material sharing split');else{expect(![...materialOwners.values()].includes(material),'distinct source materials merged');materialOwners.set(expected.id,material);}
        resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
      }
      resources.add(g);if(node.isInstancedMesh){resources.add(node);resources.add(get(second,record.route));for(const name of ['instanceMatrix','instanceColor'])capture('mesh/'+i+'/'+name,node[name],{mesh:node,name});}
    }
    expect(attributes.size===contract.streams.length,'source attribute coverage differs');
    for(const resource of resources){resource.addEventListener('dispose',invalidate);listeners.push(resource);onResource(resource);}
    live();
    let bytes=referenceBytes;
    if(!bytes){const response=await fetchImpl(contract.poseReference.url,{signal});expect(response.ok,'cannot load context pose reference');bytes=new Uint8Array(await response.arrayBuffer());}
    if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
    expect(bytes.byteLength===contract.poseReference.bytes&&bytes.byteOffset%4===0,'context pose reference size/alignment changed');
    expect(await shoreSHA256(bytes)===contract.poseReference.sha256,'context pose reference hash changed');live();inspectStructure();
    expect(contract.poseReference.arrayType==='Float32Array'&&contract.poseReference.byteOrder==='LE'&&new Uint8Array(new Uint16Array([1]).buffer)[0]===1&&equal(contract.poseReference.columns,columns),'unsupported context reference format');
    const reference=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    // Keep strict identities for the full geometry/normal/UV/color and leaf
    // tint streams. A leaf-pose rounding bound cannot admit another geometry.
    for(const row of captured){
      const actualSHA256=await shoreSHA256(bytesOf(row.array));live();inspectStructure();
      const isPose=row.id.endsWith('/instanceMatrix');if(!isPose)expect(actualSHA256===row.expected.sha256,'source attribute changed: '+row.id);
      attributeSHA256.push({id:row.id,actualSHA256,expectedSHA256:row.expected.sha256,byteExact:actualSHA256===row.expected.sha256,comparison:isPose?'all-leaf-physical-poses':'exact-source-bytes'});
    }
    expect(await shoreSHA256(bytes)===contract.poseReference.sha256,'context pose reference changed during verification');
    live();inspectStructure();
    const sourceBounds=new THREE.Box3(),point=new THREE.Vector3(),box=new THREE.Box3(),matrix=new THREE.Matrix4(),geometryBounds=new Map();
    for(const {geometry,record} of geometries){
      box.makeEmpty();const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);expect(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z),'nonfinite original source vertex');box.expandByPoint(point);}
      expect(finiteBounds(boxRecord(box),record.bounds,contract.tolerance.boundsMetres),'actual geometry bounds changed: '+record.name);geometryBounds.set(record.id,box.clone());
    }
    let consumed=0;
    for(let i=0;i<contract.meshes.length;i++){
      const record=contract.meshes[i],node=get(first,record.route),prototype=geometryBounds.get(record.geometry);
      // All original local routes were verified above. The complete source
      // tree has identity local transforms, as recorded by its real factory.
      expect(equal(node.matrix.toArray(),new THREE.Matrix4().toArray()),'context bound computation requires the recorded identity local mesh');
      if(node.isInstancedMesh){
        const expected=contract.poseReference.streams.find(row=>row.id==='mesh/'+i+'/instanceMatrix');expect(expected&&expected.count===node.count&&expected.componentOffset===consumed,'context reference pose order changed');
        const result=compareWillowContextPoses(node.instanceMatrix.array,reference,{...expected,tolerance:contract.tolerance});poseComparisons.push({mesh:node.name,...result});consumed+=node.count*12;
        for(let instance=0;instance<node.count;instance++){matrix.fromArray(node.instanceMatrix.array,instance*16);sourceBounds.union(box.copy(prototype).applyMatrix4(matrix));}
      }else sourceBounds.union(prototype);
    }
    expect(consumed===reference.length,'unused context pose bytes');
    expect(finiteBounds(boxRecord(sourceBounds),contract.bounds,contract.tolerance.boundsMetres),'complete original crown bounds changed');live();inspectStructure();
    return {verified:true,contractId:contract.id,sourcePrototypeReadOnly:true,sourceGeometryAndNormalsExact:true,perLeafAnchorsExact:true,localHierarchyMatricesExact:true,pairedPrototypeObjectsShared:true,statistics:{...contract.statistics},bounds:boxRecord(sourceBounds),attributeSHA256,poseComparisons,
      poseReference:{url:contract.poseReference.url,sha256:contract.poseReference.sha256,bytes:bytes.byteLength},legacyExpectedSHA256:contract.legacyExpectedSHA256,legacyAggregateCompared:false,referenceIsRenderGeometry:false,sourceArraysWritten:false,fullSourceFactories:0,cpuMilliseconds:performance.now()-started,nativeCompositionReviewed:false};
  }finally{for(const resource of listeners)resource.removeEventListener('dispose',invalidate);}
}

export async function verifyRetainedShoreWillows({plantingPilot,contextGroups,manifestSHA256,legacyExpectedSHA256,verifiedSourceFiles,signal,fetchImpl=fetch,onResource}){
  const contract=retainedShoreWillowContext;signal?.throwIfAborted();
  expect(manifestSHA256===contract.manifestSHA256&&legacyExpectedSHA256===contract.legacyExpectedSHA256,'context belongs to another source revision');
  expect(THREE.REVISION===contract.threeRevision&&plantingPilot?.diagnostics?.sourceFactory===contract.sourceFactory&&plantingPilot.diagnostics.plan?.sourceFreeze===contract.sourceFreeze&&plantingPilot.group?.userData.sourceFreeze===contract.sourceFreeze,'missing original full-source pilot identity');
  const files=new Map(verifiedSourceFiles?.map(row=>[row.path,row.sha256]));expect(files.size===contract.sourceFiles.length&&verifiedSourceFiles.length===files.size&&contract.sourceFiles.every(row=>files.get(row.path)===row.sha256),'missing actual source-file proof');
  expect(contextGroups?.length===2&&new Set(contextGroups).size===2,'expected exactly two retained willow contexts');
  const checkPlacements=()=>{
    for(let i=0;i<contract.contexts.length;i++){
      const part=contextGroups[i],record=contract.contexts[i];expect(part?.parent===plantingPilot.group&&plantingPilot.parts.includes(part)&&part.userData.placementId===record.placementId&&part.userData.species==='willow'&&part.children.length===1,'retained willow context changed');
      part.updateWorldMatrix(true,true);expect(equal(part.matrixWorld.toArray(),record.matrix),'original willow placement changed');
    }
  };
  checkPlacements();const result=await verifyWillowContextPair({first:contextGroups[0].children[0],second:contextGroups[1].children[0],contract,signal,fetchImpl,onResource});checkPlacements();
  return {...result,manifestSHA256,sourceFilesVerified:files.size,placementMatricesExact:true,contexts:contract.contexts.map(row=>({placementId:row.placementId,matrix:[...row.matrix]}))};
}
