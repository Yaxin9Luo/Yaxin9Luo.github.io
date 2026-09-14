import {shoreSHA256,stableShoreJSON} from './xianfa-shore-community-prepared-signature.js';
import {shoreNormalCompatibilityRecords} from './xianfa-shore-normal-compatibility-data.js';

const expect=(condition,message)=>{if(!condition)throw new Error('Prepared shore normal: '+message);};
const bytesOf=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
function verifySourceProof(proof,record){
  expect(Array.isArray(proof)&&proof.length===record.sourceFiles.length,'complete verified source-file proof is required');
  const files=new Map(proof.map(row=>[row.path,row.sha256]));expect(files.size===proof.length,'duplicate source-file proof');
  for(const expected of record.sourceFiles)expect(files.get(expected.path)===expected.sha256,'verified source identity changed: '+expected.path);
}
function shape(attribute){const array=attribute.array;return {arrayType:array.constructor.name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,byteLength:array.byteLength};}
function geometryMetadata(geometry){return {name:geometry.name,type:geometry.type,groups:geometry.groups,drawRange:{start:geometry.drawRange.start,count:Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:'Infinity'}};}

/** Compare one captured engine difference against exact canonical bytes.
 * verifiedSourceFiles MUST contain the hashes actually computed by the
 * caller's successful readSource loop, not a copy of expected manifest rows.
 * Every non-normal attribute is independently checked here. This function
 * only creates CPU byte copies and never writes or disposes the borrowed node.
 * Unknown hashes/components/geometries remain errors; there is no tolerance. */
export async function verifyKnownShoreNormalDifference({node,sourceIndex,geometryIndex,manifestSHA256,verifiedSourceFiles,signal}){
  signal?.throwIfAborted();
  expect(node?.isMesh&&!node.isInstancedMesh&&!node.isSkinnedMesh&&!node.isBatchedMesh,'a real original source mesh is required');
  const record=shoreNormalCompatibilityRecords.find(row=>row.sourceIndex===sourceIndex&&row.geometryIndex===geometryIndex&&row.meshName===node.name&&row.manifestSHA256===manifestSHA256);
  expect(record,'no registered normal comparison for this source/manifest');verifySourceProof(verifiedSourceFiles,record);
  const geometry=node.geometry,metadata={name:record.geometryName,type:record.geometryType,groups:record.groups,drawRange:record.drawRange};
  expect(stableShoreJSON(geometryMetadata(geometry))===stableShoreJSON(metadata),'source geometry metadata changed');
  const attrs=Object.fromEntries([['index',geometry.index],...Object.entries(geometry.attributes)].filter(([,a])=>a));
  expect(stableShoreJSON(Object.keys(attrs).sort())===stableShoreJSON(Object.keys(record.attributes).sort()),'source attribute set changed');
  const captured=[];
  for(const [name,attribute] of Object.entries(attrs)){
    expect(!attribute.isInterleavedBufferAttribute&&attribute.array&&ArrayBuffer.isView(attribute.array),'unregistered interleaved or missing attribute: '+name);
    const {sha256,...expectedShape}=record.attributes[name];
    expect(stableShoreJSON(shape(attribute))===stableShoreJSON(expectedShape),'source attribute shape changed: '+name);
    captured.push({name,attribute,array:attribute.array,shape:shape(attribute),bytes:new Uint8Array(bytesOf(attribute.array))});
  }
  const normal=captured.find(row=>row.name==='normal');expect(normal.array instanceof Float32Array&&normal.attribute.itemSize===3,'registered normals must be Float32 triples');
  const actualSHA256=await shoreSHA256(normal.bytes),alreadyCanonical=actualSHA256===record.canonicalSHA256;
  signal?.throwIfAborted();expect(alreadyCanonical||actualSHA256===record.actualSHA256,'unregistered complete normal byte stream: '+actualSHA256);
  const otherAttributeSHA256={};
  for(const row of captured)if(row.name!=='normal'){
    const sha256=await shoreSHA256(row.bytes);signal?.throwIfAborted();expect(sha256===record.attributes[row.name].sha256,'non-normal attribute changed: '+row.name);otherAttributeSHA256[row.name]=sha256;
  }
  const canonical=new Uint32Array(normal.bytes.buffer.slice(0));
  if(!alreadyCanonical)for(const patch of record.patches){
    expect(canonical[patch.component]===patch.actualUint32,'recorded normal component changed: '+patch.component);canonical[patch.component]=patch.canonicalUint32;
  }
  const canonicalSHA256=await shoreSHA256(bytesOf(canonical));signal?.throwIfAborted();expect(canonicalSHA256===record.canonicalSHA256,'canonical comparison failed the complete original SHA');
  // Hash awaits cannot turn a stale copied result into permission for a source
  // that changed concurrently. Read the original buffers once more, without
  // yielding, before returning the comparison evidence.
  verifySourceProof(verifiedSourceFiles,record);expect(node.name===record.meshName&&node.geometry===geometry&&stableShoreJSON(geometryMetadata(geometry))===stableShoreJSON(metadata),'source geometry changed during comparison');
  expect(stableShoreJSON(['index',...Object.keys(geometry.attributes)].sort())===stableShoreJSON(Object.keys(record.attributes).sort()),'source attribute set changed during comparison');
  for(const row of captured){
    const current=row.name==='index'?geometry.index:geometry.attributes[row.name];expect(current===row.attribute&&current.array===row.array&&stableShoreJSON(shape(current))===stableShoreJSON(row.shape),'borrowed attribute was replaced during comparison: '+row.name);
    const currentBytes=bytesOf(current.array);expect(currentBytes.length===row.bytes.length,'borrowed attribute size changed during comparison');
    for(let i=0;i<row.bytes.length;i++)if(currentBytes[i]!==row.bytes[i])throw new Error('Prepared shore normal: borrowed source changed during comparison: '+row.name);
  }
  return {verified:true,recordId:record.id,sourceIndex,geometryIndex,meshName:node.name,geometryName:geometry.name,manifestSHA256,
    actualSHA256,canonicalSHA256,applied:!alreadyCanonical,comparisonOnly:true,borrowedNormalWritten:false,normalComponents:normal.array.length,
    changedComponents:alreadyCanonical?0:record.patches.length,maximumAbsoluteDifference:alreadyCanonical?0:record.maximumAbsoluteDifference,maximumAngleDegrees:alreadyCanonical?0:record.maximumAngleDegrees,
    verifiedSourceFiles:verifiedSourceFiles.length,otherAttributeSHA256,nativeCompositionReviewed:false};
}
