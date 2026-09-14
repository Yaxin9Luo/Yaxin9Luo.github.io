import * as THREE from 'three';
import {createGardenVegetationStudy} from './garden-vegetation.js';
import {shoreSHA256,stableShoreJSON} from './xianfa-shore-community-prepared-signature.js';

const bytesOf=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const expect=(ok,message)=>{if(!ok)throw new Error('Willow context diagnostic: '+message);};
const matrixValues=matrix=>({values:matrix.toArray(),negativeZeroIndices:matrix.elements.flatMap((v,i)=>Object.is(v,-0)?[i]:[])});
const plainBox=box=>({min:box.min.toArray(),max:box.max.toArray()});
const attributeShape=a=>({arrayType:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,byteLength:a.array.byteLength});

export function willowAttributeDifference(actual,expected,{itemSize=1,maximumSavedChanges=200000}={}){
  expect(actual.constructor===expected.constructor&&actual.length===expected.length,'comparison arrays must have the same shape');
  const float=actual instanceof Float32Array,words=a=>float?new Uint32Array(a.buffer,a.byteOffset,a.length):a;
  const aw=words(actual),ew=words(expected),changes=[],axisCounts=Array(itemSize).fill(0);
  let changed=0,maximumAbsoluteDifference=0,maximumRelativeDifference=0,signedZeroDifferences=0,signCrossings=0,maximumULPDistance=0,nonfinite=0;
  const ordered=word=>(word&0x80000000)?0x80000000-(word&0x7fffffff):0x80000000+word;
  for(let i=0;i<actual.length;i++)if(aw[i]!==ew[i]){
    changed++;axisCounts[i%itemSize]++;const a=actual[i],e=expected[i],difference=Math.abs(a-e);
    if(!Number.isFinite(a)||!Number.isFinite(e))nonfinite++;
    else{maximumAbsoluteDifference=Math.max(maximumAbsoluteDifference,difference);maximumRelativeDifference=Math.max(maximumRelativeDifference,difference/Math.max(Math.abs(a),Math.abs(e),Number.MIN_VALUE));}
    if(a===0&&e===0)signedZeroDifferences++;if(a*e<0)signCrossings++;
    if(float)maximumULPDistance=Math.max(maximumULPDistance,Math.abs(ordered(aw[i])-ordered(ew[i])));
    if(changes.length<maximumSavedChanges)changes.push({component:i,actual:aw[i],expected:ew[i],actualValue:a,expectedValue:e});
  }
  return {components:actual.length,changed,axisCounts,maximumAbsoluteDifference,maximumRelativeDifference,signedZeroDifferences,signCrossings,maximumULPDistance,nonfinite,changes,completeChanges:changes.length===changed};
}

function componentBounds(attribute){
  const min=Array(attribute.itemSize).fill(Infinity),max=Array(attribute.itemSize).fill(-Infinity);let nonfinite=0;
  for(let i=0;i<attribute.array.length;i++){const value=attribute.array[i],axis=i%attribute.itemSize;if(!Number.isFinite(value))nonfinite++;else{min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}}
  return {min,max,nonfinite};
}

function normalLengths(attribute){
  const array=attribute.array;let min=Infinity,max=-Infinity,zero=0;
  for(let i=0;i<array.length;i+=3){const length=Math.hypot(array[i],array[i+1],array[i+2]);min=Math.min(min,length);max=Math.max(max,length);if(length===0)zero++;}
  return {min,max,zero};
}

function instanceFacts(attribute){
  const a=attribute.array;let nonAffine=0,minimumDeterminant=Infinity,maximumDeterminant=-Infinity,maximumColumnLengthDifference=0,maximumNormalizedDot=0;
  for(let i=0;i<a.length;i+=16){
    if(a[i+3]!==0||a[i+7]!==0||a[i+11]!==0||a[i+15]!==1)nonAffine++;
    const x=[a[i],a[i+1],a[i+2]],y=[a[i+4],a[i+5],a[i+6]],z=[a[i+8],a[i+9],a[i+10]],lengths=[Math.hypot(...x),Math.hypot(...y),Math.hypot(...z)];
    const determinant=x[0]*(y[1]*z[2]-y[2]*z[1])-y[0]*(x[1]*z[2]-x[2]*z[1])+z[0]*(x[1]*y[2]-x[2]*y[1]);
    minimumDeterminant=Math.min(minimumDeterminant,determinant);maximumDeterminant=Math.max(maximumDeterminant,determinant);maximumColumnLengthDifference=Math.max(maximumColumnLengthDifference,Math.max(...lengths)-Math.min(...lengths));
    for(const [u,v,ui,vi] of [[x,y,0,1],[x,z,0,2],[y,z,1,2]])maximumNormalizedDot=Math.max(maximumNormalizedDot,Math.abs(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(lengths[ui]*lengths[vi]));
  }
  return {nonAffine,minimumDeterminant,maximumDeterminant,maximumColumnLengthDifference,maximumNormalizedDot};
}

/** Read one source prototype. The optional reference is diagnostic data only;
 * no source attribute, cached bound, local matrix or owner is changed. */
export async function inspectWillowContextPrototype(root,{signal,reference,referenceBytes,onAttribute}={}){
  signal?.throwIfAborted();expect(root?.isObject3D,'missing source root');
  const nodes=[],meshNodes=[],geometryIds=new Map(),materialIds=new Map(),geometries=[],streams=[],legacyChunks=[];
  const visit=(node,route)=>{nodes.push({route,name:node.name,type:node.type,matrix:matrixValues(node.matrix),mesh:!!node.isMesh,visible:node.visible});if(node.isMesh)meshNodes.push({node,route});node.children.forEach((child,i)=>visit(child,[...route,i]));};visit(root,[]);
  async function attribute(id,a){
    expect(a&&!a.isInterleavedBufferAttribute&&ArrayBuffer.isView(a.array),'only actual packed source attributes are supported');
    const bytes=bytesOf(a.array),sha256=await shoreSHA256(bytes);signal?.throwIfAborted();
    const row={id,...attributeShape(a),sha256,componentBounds:componentBounds(a),...(id.endsWith('/normal')?{normalLengths:normalLengths(a)}:{}),...(id.endsWith('/instanceMatrix')?{instanceFacts:instanceFacts(a)}:{})};
    if(onAttribute)row.retained=await onAttribute({id,...attributeShape(a),sha256,bytes});
    const expected=reference?.streams.find(item=>item.id===id);
    if(reference){
      row.expectedSHA256=expected?.sha256??null;row.shapeMatches=!!expected&&stableShoreJSON(attributeShape(a))===stableShoreJSON(Object.fromEntries(Object.keys(attributeShape(a)).map(key=>[key,expected[key]])));row.matches=!!expected&&row.sha256===expected.sha256&&row.shapeMatches;
      if(!row.matches&&row.shapeMatches&&referenceBytes){
        const offset=expected.retained.byteOffset,copy=referenceBytes.slice(offset,offset+expected.byteLength),array=new a.array.constructor(copy.buffer,copy.byteOffset,a.array.length);
        expect(await shoreSHA256(copy)===expected.sha256,'diagnostic canonical attribute bytes do not match: '+id);row.difference=willowAttributeDifference(a.array,array,{itemSize:a.itemSize});
      }
    }
    streams.push(row);signal?.throwIfAborted();return row;
  }
  const meshes=[];
  for(const {node,route} of meshNodes){
    expect(!node.isSkinnedMesh&&!node.isBatchedMesh&&!node.morphTargetInfluences&&!node.morphTexture,'unexpected nonstatic source');
    legacyChunks.push(node.name,JSON.stringify(node.matrix.elements));
    const g=node.geometry;
    if(!geometryIds.has(g)){
      const id=geometryIds.size;geometryIds.set(g,id);const names=[];
      for(const [name,a] of [['index',g.index],...Object.entries(g.attributes)])if(a){names.push(name);legacyChunks.push(name,bytesOf(a.array));await attribute('geometry/'+id+'/'+name,a);}
      const p=g.attributes.position,box=new THREE.Box3(),point=new THREE.Vector3();for(let i=0;i<p.count;i++)box.expandByPoint(point.fromBufferAttribute(p,i));
      geometries.push({id,name:g.name,type:g.type,groups:structuredClone(g.groups),drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'},attributeNames:names,bounds:plainBox(box)});
    }
    const materials=(Array.isArray(node.material)?node.material:[node.material]).map(m=>{if(!materialIds.has(m))materialIds.set(m,materialIds.size);return {id:materialIds.get(m),name:m.name,type:m.type};});
    const row={route,name:node.name,type:node.type,geometry:geometryIds.get(g),materials,matrix:matrixValues(node.matrix),instanceCount:node.isInstancedMesh?node.count:0,triangles:(g.index?.count??g.attributes.position.count)/3*(node.isInstancedMesh?node.count:1),castShadow:node.castShadow,receiveShadow:node.receiveShadow};
    for(const name of ['instanceMatrix','instanceColor'])if(node[name]){legacyChunks.push(bytesOf(node[name].array));await attribute('mesh/'+meshes.length+'/'+name,node[name]);}
    meshes.push(row);
  }
  const legacySHA256=await shoreSHA256(await new Blob(legacyChunks).arrayBuffer());signal?.throwIfAborted();
  return {schema:'shore-willow-context-prototype-diagnostic-v1',nodes,meshes,geometries,streams,legacySHA256,
    referenceLegacySHA256:reference?.legacySHA256??null,legacyMatches:reference?legacySHA256===reference.legacySHA256:null,
    statistics:{meshes:meshes.length,uniqueGeometries:geometries.length,uniqueMaterials:materialIds.size,instances:meshes.reduce((sum,m)=>sum+m.instanceCount,0),triangles:meshes.reduce((sum,m)=>sum+m.triangles,0),sourceBytes:streams.reduce((sum,a)=>sum+a.byteLength,0)},
    metadataMatches:reference?stableShoreJSON({nodes,meshes,geometries})===stableShoreJSON({nodes:reference.nodes,meshes:reference.meshes,geometries:reference.geometries}):null};
}

/** Exactly the public arrange:false willow used by the live planting pilot.
 * This is one scheduled CPU source build, not the whole vegetation study. */
export async function inspectFullWillowContext({manifest,readSource,signal,reference,referenceBytes,onAttribute,onProgress=()=>{},runtime={}}={}){
  signal?.throwIfAborted();expect(THREE.REVISION===manifest.threeRevision,'Three revision changed');
  const started=performance.now(),sourceIdentities=[];
  for(const expected of manifest.sourceFiles){const text=await readSource(expected.path),sha256=await shoreSHA256(text);signal?.throwIfAborted();sourceIdentities.push({path:expected.path,sha256,expectedSHA256:expected.sha256,match:sha256===expected.sha256});}
  expect(sourceIdentities.every(row=>row.match),'source closure changed before construction');
  signal?.throwIfAborted();onProgress('construct-single-willow');
  let owner=createGardenVegetationStudy({specimens:['willow'],arrange:false});
  const resources=new Set(),counts=new Map();owner.group.traverse(n=>{if(n.isMesh){resources.add(n.geometry);if(n.isInstancedMesh)resources.add(n);for(const m of Array.isArray(n.material)?n.material:[n.material]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}}});
  for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  let result;
  try{onProgress('read-original-streams');result=await inspectWillowContextPrototype(owner.specimens[0],{signal,reference,referenceBytes,onAttribute});result.sourceDiagnostics=structuredClone(owner.diagnostics);}
  finally{owner.dispose();owner=null;}
  expect([...counts.values()].every(count=>count===1),'retained source resource disposal mismatch');onProgress('disposed');
  return {...result,sourceIdentities,expectedManifestLegacySHA256:manifest.willowSourceSignature,legacyMatchesManifest:result.legacySHA256===manifest.willowSourceSignature,runtime:{...runtime,threeRevision:THREE.REVISION},
    diagnostics:{cpuMilliseconds:performance.now()-started,resourceDisposals:resources.size,allResourcesDisposedExactlyOnce:true,sourceFactory:'createGardenVegetationStudy({specimens:[willow],arrange:false})',fullWillowSources:1,otherSpecimens:0,rendererConstructed:false,GPUUsed:false,terrainConstructed:false,communityConstructed:false,textureDecodes:0},nativeCompositionReviewed:false};
}
