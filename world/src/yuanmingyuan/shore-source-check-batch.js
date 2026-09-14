import * as THREE from 'three';
import {createGardenUnderstoryStudy} from './garden-understory-study.js';
import {lakeStoneGeometry} from './vegetation-geometry.js';
import {sourceCheckSHA256} from './shore-source-check-fixture.js';
import {stableShoreJSON} from './xianfa-shore-community-prepared-signature.js';

const bytesOf=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const equal=(a,b)=>stableShoreJSON(a)===stableShoreJSON(b);
const assert=(ok,message)=>{if(!ok)throw new Error('Shore source batch: '+message);};
const metadata=g=>({name:g.name,type:g.type,groups:g.groups,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'}});
const storedMatrix=row=>{const values=row.values.slice();for(const i of row.negativeZeroIndices??[])values[i]=-0;return values;};
const matrixRecord=values=>({values,negativeZeroIndices:values.flatMap((n,i)=>Object.is(n,-0)?[i]:[])});

/** Inspect the complete borrowed attribute byte streams. Never writes normals,
 * recomputes topology, or retains the geometry after the async call returns.
 * onAttribute may persist these exact bytes before the owner is released. */
export async function inspectShoreSourceGeometry({geometry,expected,sourceIndex,geometryIndex,name,signal,onAttribute}){
  signal?.throwIfAborted();
  const actualMetadata=metadata(geometry),expectedMetadata={name:expected.name,type:expected.type,groups:expected.groups,drawRange:expected.drawRange};
  const attributes={},normalMismatches=[],set=Object.fromEntries([['index',geometry.index],...Object.entries(geometry.attributes)].filter(([,a])=>a));
  for(const [attribute,a] of Object.entries(set)){
    assert(!a.isInterleavedBufferAttribute,'unexpected interleaved diagnostic source');
    const array=a.array,bytes=bytesOf(array),want=expected.attributes[attribute],sha256=await sourceCheckSHA256(bytes);signal?.throwIfAborted();
    const shape={arrayType:array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,byteLength:array.byteLength};
    const expectedShape=want&&Object.fromEntries(Object.entries(want).filter(([key])=>key!=='sha256'));
    const row={...shape,sha256,expectedSHA256:want?.sha256??null,shapeMatches:!!want&&equal(shape,expectedShape),match:!!want&&sha256===want.sha256};
    if(!row.match){
      // Uint32 preserves all Float32 bits, including signed zero and tiny
      // residuals. These are diagnostic JSON values, never source assets.
      row.exactBits={arrayType:array.constructor.name,wordType:array.BYTES_PER_ELEMENT===4?'Uint32Array':array.BYTES_PER_ELEMENT===2?'Uint16Array':'Uint8Array',values:Array.from(array.BYTES_PER_ELEMENT===4?new Uint32Array(array.buffer,array.byteOffset,array.length):array.BYTES_PER_ELEMENT===2?new Uint16Array(array.buffer,array.byteOffset,array.length):bytes)};
      if(attribute==='normal')normalMismatches.push({attribute,sha256,expectedSHA256:row.expectedSHA256,components:array.length});
    }
    if(onAttribute)row.retained=await onAttribute({sourceIndex,geometryIndex,name,attribute,...shape,sha256,bytes});
    signal?.throwIfAborted();attributes[attribute]=row;
  }
  return {sourceIndex,geometryIndex,name,geometry:actualMetadata,metadataMatches:equal(actualMetadata,expectedMetadata),attributeSetMatches:equal(Object.keys(set).sort(),Object.keys(expected.attributes).sort()),attributes,normalMismatches,
    allAttributesMatch:Object.values(attributes).every(a=>a.match&&a.shapeMatches)&&equal(Object.keys(set).sort(),Object.keys(expected.attributes).sort())};
}

/** One sequential, CPU-only check of the 91 actual understory source meshes
 * and the exact lakeStoneGeometry() used by garden-vegetation.js. Stone uses a
 * diagnostic material shell: PBR/pilot/world admission is deliberately absent.
 * The understory owner is fully disposed before stone construction begins. */
export async function inspectAllShoreSources({manifest,readSource,signal,runtime={},onProgress=()=>{},onAttribute}={}){
  const started=performance.now(),sourceIdentities=[],geometries=[],routes=[],owners=[];
  const notify=value=>{signal?.throwIfAborted();onProgress(value);};
  assert(THREE.REVISION===manifest.threeRevision,'Three revision differs from production');
  assert(manifest.sources.length===92&&manifest.geometries.length===92,'this diagnostic is for the frozen 92-source manifest');
  assert(new Uint8Array(new Uint16Array([1]).buffer)[0]===1,'the captured canonical pack uses little-endian words');
  for(const expected of manifest.sourceFiles){
    const text=await readSource(expected.path),sha256=await sourceCheckSHA256(text);signal?.throwIfAborted();
    sourceIdentities.push({path:expected.path,bytes:new TextEncoder().encode(text).byteLength,sha256,expectedSHA256:expected.sha256,match:sha256===expected.sha256});
  }
  assert(sourceIdentities.every(row=>row.match),'source closure differs from the immutable production manifest');
  async function inspectRoot(rootId,root){
    const nodes=[];root.traverse(n=>{if(n.isMesh)nodes.push(n);});
    assert(nodes.length===manifest.sourceMeshCounts[rootId],'source count changed: '+rootId);
    for(let sourceIndex=0;sourceIndex<manifest.sources.length;sourceIndex++){
      const record=manifest.sources[sourceIndex];if(record.rootId!==rootId)continue;
      let node=root;const route=[];
      for(const step of record.route){
        node=node?.children[step.childIndex];assert(node?.name===step.name&&node.type===step.type,'source route changed: '+record.name);
        const actual=node.matrix.toArray();route.push({name:node.name,actual:matrixRecord(actual),expected:step.matrix,match:equal(actual,storedMatrix(step.matrix))});
      }
      assert(node?.isMesh&&!node.isInstancedMesh&&!node.isSkinnedMesh&&!node.isBatchedMesh,'not an original source mesh');
      assert(nodes.includes(node),'source route left the selected root');
      routes.push({sourceIndex,rootId,name:node.name,allMatricesMatch:route.every(row=>row.match),route});
      geometries.push(await inspectShoreSourceGeometry({geometry:node.geometry,expected:manifest.geometries[record.geometry],sourceIndex,geometryIndex:record.geometry,name:node.name,signal,onAttribute}));
      notify({phase:'attributes',completed:geometries.length,total:92,name:node.name});
    }
  }
  function observeOwner(group,label){
    const resources=new Set();group.traverse(n=>{if(n.isMesh){resources.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])resources.add(m);}});
    const record={label,geometries:[...resources].filter(r=>r.isBufferGeometry).length,materials:[...resources].filter(r=>r.isMaterial).length,resourceCount:resources.size,disposeEvents:0,disposedExactlyOnce:false};
    const counts=new Map();for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>{counts.set(r,counts.get(r)+1);record.disposeEvents++;});}
    owners.push(record);return ()=>{record.disposedExactlyOnce=[...counts.values()].every(n=>n===1);assert(record.disposedExactlyOnce,'owner resource disposal mismatch: '+label);};
  }
  notify({phase:'construct-understory',completed:0,total:92});
  let owner=createGardenUnderstoryStudy({arrangement:'specimens',signal}),checked=observeOwner(owner.group,'actual-createGardenUnderstoryStudy');
  try{for(const rootId of ['fern','flower-shrub','sedge'])await inspectRoot(rootId,owner.parts.find(p=>p.userData.id===rootId));}
  finally{owner.dispose();checked();owner=null;}
  notify({phase:'construct-lake-stone',completed:91,total:92});
  let stone=lakeStoneGeometry(),material=new THREE.MeshBasicMaterial(),root=new THREE.Group(),part=new THREE.Group(),mesh=new THREE.Mesh(stone,material);
  part.name='garden-lake-rock';mesh.name='lake-rock-main';root.add(part);part.add(mesh);root.updateMatrixWorld(true);checked=observeOwner(root,'actual-lakeStoneGeometry-with-diagnostic-material');
  try{await inspectRoot('lake-rock',root);}finally{stone.dispose();material.dispose();checked();root.clear();part.clear();stone=material=root=part=mesh=null;}
  geometries.sort((a,b)=>a.sourceIndex-b.sourceIndex);routes.sort((a,b)=>a.sourceIndex-b.sourceIndex);
  const result={schema:'shore-all-source-check-v1',runtime:{...runtime,threeRevision:THREE.REVISION},sourceIdentities,geometries,routes,owners,
    allAttributesMatch:geometries.every(row=>row.allAttributesMatch&&row.metadataMatches),allRoutesMatch:routes.every(row=>row.allMatricesMatch),
    diagnostics:{sourceCount:geometries.length,sourceAttributeBytes:geometries.reduce((sum,g)=>sum+Object.values(g.attributes).reduce((n,a)=>n+a.byteLength,0),0),normalBytes:geometries.reduce((n,g)=>n+g.attributes.normal.byteLength,0),triangles:geometries.reduce((n,g)=>n+g.attributes.index.count/3,0),mismatchedAttributes:geometries.flatMap(g=>Object.entries(g.attributes).filter(([,a])=>!a.match||!a.shapeMatches).map(([attribute,a])=>({sourceIndex:g.sourceIndex,name:g.name,attribute,actualSHA256:a.sha256,expectedSHA256:a.expectedSHA256}))),cpuMilliseconds:performance.now()-started,rendererConstructed:false,GPUUsed:false,texturesDecoded:0,completeCommunityConstructed:false,willowConstructed:false,terrainConstructed:false},
    scope:'Full source geometry bytes and local route transforms only; no PBR, placement, prepared loader or main-scene admission',nativeSceneReviewed:false};
  notify({phase:'disposed',completed:92,total:92});return result;
}
