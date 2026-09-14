import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import {captureTerrainRegions} from './terrain-region-export.js';
import {createGardenPlantingLayout} from './garden-planting-layout.js';
import {gardenLayout} from './garden-layout.js';
import {createXianfaShoreCommunityLayoutR2} from './xianfa-shore-community-layout-r2.js';
import {prepareLakeStoneTexturePixels,vegetationStoneSource} from './vegetation-textures.js';
import {shoreSHA256,shoreObjectSHA,shoreTerrainSignatureData,shoreMaterialSettings,stableShoreJSON} from './xianfa-shore-community-prepared-signature.js';
import {xianfaShorePreparedData,readPreparedShoreSource} from './xianfa-shore-community-prepared-data.js';
import {verifyKnownShoreNormalDifference} from './xianfa-shore-normal-compatibility.js';
import {verifyRetainedShoreWillows} from './shore-willow-context.js';

const admitted=new WeakSet(),decoder=new TextDecoder(),identity=new THREE.Matrix4().toArray();
const expect=(condition,message)=>{if(!condition)throw new Error('Prepared shore: '+message);};
const bytesOf=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const equal=(a,b)=>stableShoreJSON(a)===stableShoreJSON(b);
function freezeData(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeData(child);Object.freeze(value);}return value;}
function matrix(record){const values=record.values.slice();for(const i of record.negativeZeroIndices??[])values[i]=-0;expect(values.length===16&&values.every(Number.isFinite),'invalid stored matrix');return new THREE.Matrix4().fromArray(values);}
const probeFacts=rows=>rows.map(p=>({...p,surface:p.surface?Object.fromEntries(Object.entries(p.surface).filter(([k])=>k!=='geometryUUID')):null}));
export const preparedShoreReservationData=(garden,reservedPolygons=[])=>({reservations:createGardenPlantingLayout({layout:garden}).reservations,waterBodies:garden.waterBodies,channels:garden.channels??[],ornamentalWaters:garden.ornamentalWaters??[],reservedPolygons});

export async function parseXianfaShorePrepared({manifestBytes,binary,expectedManifestSHA256,signal}){
  signal?.throwIfAborted();expect(await shoreSHA256(manifestBytes)===expectedManifestSHA256,'manifest hash mismatch');
  const manifest=JSON.parse(decoder.decode(manifestBytes));
  expect(manifest.schema==='xianfa-shore-runtime-prepared-v1'&&manifest.production.status==='passed','unverified production manifest');
  const input=binary instanceof Uint8Array?binary:new Uint8Array(binary);
  expect(input.byteLength===manifest.binary.bytes&&await shoreSHA256(input)===manifest.binary.sha256,'binding byte/hash mismatch');
  expect(manifest.binary.arrayType==='Float32Array'&&manifest.binary.matrixItemSize===16&&manifest.binary.byteOrder==='LE'&&new Uint8Array(new Uint16Array([1]).buffer)[0]===1,'unsupported stored matrix format');
  // Own one small copy. Future callers cannot mutate an admitted input buffer.
  const packed=new Uint8Array(input);signal?.throwIfAborted();const prepared=Object.freeze({manifest:freezeData(manifest),binary:packed,manifestSHA256:expectedManifestSHA256});admitted.add(prepared);return prepared;
}

export async function prepareXianfaShoreCommunity({signal,fetchImpl=fetchPublicAsset}={}){
  const get=async url=>{const r=await fetchImpl(url,{signal});expect(r.ok,'cannot load '+url);return new Uint8Array(await r.arrayBuffer());};
  const [manifestBytes,binary]=await Promise.all([get(xianfaShorePreparedData.manifestURL),get(xianfaShorePreparedData.binaryURL)]);
  return parseXianfaShorePrepared({manifestBytes,binary,expectedManifestSHA256:xianfaShorePreparedData.manifestSHA256,signal});
}

/** Restores only matrices from the one passed R2 authoring run. Source owners
 * and current terrain must still match. Mount only .group; contexts and
 * .collisionSources.group stay where they were. No fallback or re-grounding. */
export async function createXianfaShoreCommunityPrepared({terrain,plantingPilot,understoryOwner,prepared,layout=createXianfaShoreCommunityLayoutR2(),garden=gardenLayout,reservedPolygons=[],signal,onProgress=()=>{},readSource=readPreparedShoreSource,stonePixels}={}){
  const started=performance.now(),group=new THREE.Group(),collisionGroup=new THREE.Group(),instanceViews=[],listeners=[],bindings=[],contextGroups=[],collisionParts=[];
  let disposed=false,invalidated=false,stage='prepare';const diagnostics={id:layout.id,nativeCompositionReviewed:false,fullGardenDistribution:false,prepared:true,borrowedSourceInvalidated:false};
  const notify=phase=>{stage=phase;signal?.throwIfAborted();expect(!invalidated,'borrowed source was disposed during verification');expect(!terrain?.disposed&&!plantingPilot?.disposed,'borrowed terrain/pilot was disposed');onProgress({phase,completed:phase==='prepared-ready'?layout.placements.length:0,total:layout.placements.length});signal?.throwIfAborted();expect(!invalidated&&!terrain?.disposed&&!plantingPilot?.disposed,'borrowed owner invalidated by progress callback');};
  const invalidate=()=>{invalidated=true;diagnostics.borrowedSourceInvalidated=true;group.visible=false;};
  const dispose=()=>{if(disposed)return;disposed=true;const errors=[],run=fn=>{try{fn();}catch(e){errors.push(e);}};run(()=>group.removeFromParent());run(()=>group.clear());run(()=>collisionGroup.removeFromParent());run(()=>collisionGroup.clear());for(const p of collisionParts)run(()=>p.clear());for(const [r,fn] of listeners)run(()=>r.removeEventListener('dispose',fn));listeners.length=0;for(const view of instanceViews)run(()=>view.dispose());instanceViews.length=bindings.length=contextGroups.length=collisionParts.length=0;if(errors.length)throw new AggregateError(errors,'Prepared shoreline disposal failed');};
  try{
    notify('prepare');prepared??=await prepareXianfaShoreCommunity({signal});expect(admitted.has(prepared),'use the verified prepared parser/loader');
    const m=prepared.manifest;
    // Check again because a prepared object may have been retained by callers.
    expect(await shoreObjectSHA(m.layout)===await shoreObjectSHA(layout),'layout differs from verified placements');
    expect(await shoreSHA256(prepared.binary)===m.binary.sha256,'prepared binding bytes changed');
    expect(await shoreObjectSHA(preparedShoreReservationData(garden,reservedPolygons))===m.reservationsSHA256,'garden reservations changed');
    expect(THREE.REVISION===m.threeRevision,'Three revision changed');
    expect(understoryOwner?.group?.isObject3D&&typeof understoryOwner.dispose==='function'&&plantingPilot?.group?.isObject3D&&typeof plantingPilot.dispose==='function','missing borrowed source owners');
    notify('verify-source-files');
    const verifiedSourceFiles=[],normalComparisons=[];
    for(const source of m.sourceFiles){const sha256=await shoreSHA256(await readSource(source.path));expect(sha256===source.sha256,'source file changed: '+source.path);signal?.throwIfAborted();verifiedSourceFiles.push({path:source.path,sha256});}
    const roots=new Map(understoryOwner.parts.map(part=>[part.userData.id,part]));roots.set('lake-rock',plantingPilot.parts.find(p=>p.userData.species==='lake-rock'));
    for(const id of Object.keys(m.sourceMeshCounts)){const root=roots.get(id);expect(root?.isGroup,'missing source '+id);expect(root.parent===(id==='lake-rock'?plantingPilot.group:understoryOwner.group),'detached source owner '+id);root.updateWorldMatrix(true,true);}
    const sources=m.sources.map(record=>{let node=roots.get(record.rootId);for(const step of record.route){node=node?.children[step.childIndex];expect(node?.name===step.name&&node.type===step.type,'source node route changed');expect(equal(node.matrix.toArray(),matrix(step.matrix).toArray()),'source local transform changed: '+node.name);}
      expect(node?.isMesh&&!node.isInstancedMesh&&!node.isSkinnedMesh&&!node.isBatchedMesh&&!node.morphTargetInfluences&&!node.morphTexture,'unsupported source mesh');return node;});
    expect(new Set(sources).size===sources.length,'duplicate source route');
    for(const [id,count] of Object.entries(m.sourceMeshCounts)){const actual=[];roots.get(id).traverse(n=>{if(n.isMesh)actual.push(n);});const recorded=sources.filter((_,i)=>m.sources[i].rootId===id);expect(actual.length===count&&actual.length===recorded.length&&actual.every(n=>recorded.includes(n)),'extra or missing source meshes: '+id);}
    const resources=new Set(),geometryChecks=new Map(),materialChecks=new Map(),expectedGeometryOwners=new Map(),expectedMaterialOwners=new Map();let verifiedSourceBytes=0;
    for(const node of sources){for(const key of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'])expect(node[key]===THREE.Mesh.prototype[key],'unsupported source render/shadow callback');expect(!node.customDepthMaterial&&!node.customDistanceMaterial,'unverified custom shadow material');for(const r of [node.geometry,...(Array.isArray(node.material)?node.material:[node.material])])resources.add(r);for(const mat of Array.isArray(node.material)?node.material:[node.material])for(const v of Object.values(mat))if(v?.isTexture)resources.add(v);}
    for(const resource of resources){resource.addEventListener('dispose',invalidate);listeners.push([resource,invalidate]);}
    notify('verify-source-surfaces');
    for(let i=0;i<sources.length;i++){
      const node=sources[i],record=m.sources[i],g=node.geometry,expected=m.geometries[record.geometry];
      if(expectedGeometryOwners.has(record.geometry))expect(expectedGeometryOwners.get(record.geometry)===g,'source geometry sharing split');else expectedGeometryOwners.set(record.geometry,g);
      if(!geometryChecks.has(g)){
        expect(equal(g.groups,expected.groups)&&equal({start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'},expected.drawRange),'source geometry groups/range changed');
        const attributes=Object.fromEntries([['index',g.index],...Object.entries(g.attributes)].filter(([,a])=>a));expect(equal(Object.keys(attributes).sort(),Object.keys(expected.attributes).sort()),'source attribute set changed');
        for(const [name,a] of Object.entries(attributes)){const want=expected.attributes[name],array=a.isInterleavedBufferAttribute?a.data.array:a.array;expect(array.constructor.name===want.arrayType&&a.itemSize===want.itemSize&&a.count===want.count&&a.normalized===want.normalized&&array.byteLength===want.byteLength,'source attribute shape changed: '+name);expect((a.isInterleavedBufferAttribute?a.data.stride:undefined)===want.stride&&(a.isInterleavedBufferAttribute?a.offset:undefined)===want.offset,'source attribute layout changed');
          const actualSHA256=await shoreSHA256(bytesOf(array));signal?.throwIfAborted();
          if(actualSHA256!==want.sha256&&name==='normal'){
            // Only an exact captured engine byte stream may compare through a
            // canonical CPU copy. The borrowed source remains untouched.
            const comparison=await verifyKnownShoreNormalDifference({node,sourceIndex:i,geometryIndex:record.geometry,manifestSHA256:prepared.manifestSHA256,verifiedSourceFiles,signal});
            expect(comparison.canonicalSHA256===want.sha256,'normal comparison differs from the original manifest');normalComparisons.push(comparison);
          }else expect(actualSHA256===want.sha256,'source attribute changed: '+node.name+'/'+name);
          verifiedSourceBytes+=array.byteLength;signal?.throwIfAborted();}
        geometryChecks.set(g,record.geometry);
      }else expect(geometryChecks.get(g)===record.geometry,'source geometry sharing changed');
      const materials=Array.isArray(node.material)?node.material:[node.material];expect(equal(materials.map(x=>x.name),record.materialNames),'source material assignment changed');
      for(const mat of materials){if(expectedMaterialOwners.has(mat.name))expect(expectedMaterialOwners.get(mat.name)===mat,'source material sharing split');else expectedMaterialOwners.set(mat.name,mat);if(!materialChecks.has(mat)){expect(mat.isMeshStandardMaterial&&!mat.transparent&&mat.opacity===1&&mat.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&mat.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey,'unsupported source material/shader');expect(equal(shoreMaterialSettings(mat),m.materials[mat.name]),'source material state changed: '+mat.name);materialChecks.set(mat,true);}}
    }
    if([...resources].some(r=>r.isTexture)){
      stonePixels??=await prepareLakeStoneTexturePixels({signal});
      for(const texture of [...resources].filter(r=>r.isTexture)){const channel=Object.keys(vegetationStoneSource.files).find(key=>texture.userData?.encodedSha256===vegetationStoneSource.files[key].sha256),entry=stonePixels[channel];expect(entry&&entry.origin==='lower-left'&&entry.width===2048&&entry.height===2048&&entry.channels===4,'unverified physical stone pixels');expect(texture.image.data===entry.data&&entry.data.byteLength===2048*2048*4,'stone source pixels are not the verified borrowed array');expect(await shoreSHA256(entry.data)===entry.decodedSha256,'stone source pixels changed');signal?.throwIfAborted();}
    }
    notify('verify-context');
    for(const record of m.contextParts){const part=plantingPilot.parts.find(p=>p.userData.placementId===record.placementId);expect(part?.userData.species===record.species&&part.parent===plantingPilot.group,'missing actual context '+record.placementId);part.updateWorldMatrix(true,true);expect(equal(part.matrixWorld.toArray(),record.matrix),'context world matrix changed: '+record.placementId);if(layout.contextIds.includes(record.placementId))contextGroups.push(part);if(record.species==='lake-rock')for(let i=0;i<m.sources.length;i++)if(m.sources[i].rootId==='lake-rock'){let node=part;for(const step of m.sources[i].route){node=node?.children[step.childIndex];expect(node?.name===step.name&&equal(node.matrix.toArray(),matrix(step.matrix).toArray()),'old stone local source changed');}expect(node.geometry===sources[i].geometry&&node.material===sources[i].material,'old stones no longer share exact source');}}
    expect(contextGroups.length===layout.contextIds.length,'missing retained willow context');
    // Retained background trees are not the 92 newly bound community sources.
    // Preserve the old manifest's aggregate as evidence, while separately
    // verifying source geometry, sharing, original anchors and every leaf pose.
    let willowContextVerification=null;
    if(m.willowSourceSignature)willowContextVerification=await verifyRetainedShoreWillows({plantingPilot,contextGroups,manifestSHA256:prepared.manifestSHA256,legacyExpectedSHA256:m.willowSourceSignature,verifiedSourceFiles,signal,
      onResource:resource=>{if(!resources.has(resource)){resources.add(resource);resource.addEventListener('dispose',invalidate);listeners.push([resource,invalidate]);}},
    });
    notify('verify-live-terrain');
    const snapshot=captureTerrainRegions(terrain,{regions:m.terrain.regions,probes:m.terrain.probeRequests,sourceIdentity:null});
    const supportText=stableShoreJSON(shoreTerrainSignatureData(snapshot));expect(await shoreSHA256(supportText)===m.terrain.sha256,'complete live terrain support/facts changed');
    expect(await shoreObjectSHA(probeFacts(snapshot.probes))===m.terrain.probeSHA256,'live terrain probe answers changed');
    expect(await shoreSHA256(prepared.binary)===m.binary.sha256,'prepared binding bytes changed during verification');
    expect(!invalidated&&!terrain.disposed,'source disposed during prepared verification');signal?.throwIfAborted();
    // Recheck synchronously after asynchronous hashing. No yield permits a
    // pending terrain replacement to slip between this check and restoration.
    const finalSnapshot=captureTerrainRegions(terrain,{regions:m.terrain.regions,probes:[],sourceIdentity:null});
    expect(stableShoreJSON(shoreTerrainSignatureData(finalSnapshot))===supportText,'terrain changed during verification');
    const poses=new Map(m.diagnostics.placements.map(p=>[p.id,p])),requests=new Map(layout.placements.map(p=>[p.id,p]));expect(poses.size===requests.size&&poses.size===m.diagnostics.placements.length,'placement count changed');
    const slotKeys=new Set(),placementSourceKeys=new Set(),sourceCounts=new Map();
    for(const b of m.bindings){expect(Number.isInteger(b.source)&&sources[b.source]&&Number.isInteger(b.draw)&&m.draws[b.draw]&&Number.isInteger(b.instance)&&b.instance>=0&&b.instance<m.draws[b.draw].count,'invalid draw binding');expect(m.draws[b.draw].source===b.source&&requests.get(b.placementId)?.species===m.sources[b.source].rootId,'binding belongs to wrong source/placement');const key=b.draw+':'+b.instance,pk=b.placementId+':'+b.source;expect(!slotKeys.has(key)&&!placementSourceKeys.has(pk),'duplicate binding');slotKeys.add(key);placementSourceKeys.add(pk);sourceCounts.set(b.placementId,(sourceCounts.get(b.placementId)??0)+1);}
    for(const [id,p] of requests)expect(sourceCounts.get(id)===m.sourceMeshCounts[p.species]&&poses.has(id),'missing complete placement '+id);
    const origin=matrix(m.group.matrix);expect(origin.elements.every((n,i)=>i===12||i===13||i===14||n===identity[i]),'nontranslation group is not this verified shoreline');expect(origin.elements[12]===layout.originXZ[0]&&origin.elements[13]===0&&origin.elements[14]===layout.originXZ[1],'shore origin changed');group.name=m.group.name;group.position.set(...origin.elements.slice(12,15));collisionGroup.name='xianfa-shore-community-collision-sources';collisionGroup.position.copy(group.position);group.updateMatrixWorld(true);collisionGroup.updateMatrixWorld(true);
    let offset=0,instances=0,triangles=0;
    for(const d of m.draws){expect(Number.isInteger(d.count)&&d.count>0&&d.byteOffset===offset&&d.byteLength===d.count*64,'invalid or noncontiguous draw bytes');expect(equal(matrix(d.matrix).toArray(),identity),'unverified draw-local transform');const part=prepared.binary.subarray(offset,offset+d.byteLength);expect(part.length===d.byteLength,'truncated draw matrices');const source=sources[d.source];expect(source.visible===d.visible&&source.castShadow===d.castShadow&&source.receiveShadow===d.receiveShadow&&source.renderOrder===d.renderOrder&&source.layers.mask===d.layersMask,'source draw state changed');
      const view=new THREE.InstancedMesh(source.geometry,source.material,d.count);instanceViews.push(view);view.instanceMatrix.array.set(new Float32Array(part.buffer,part.byteOffset,d.count*16));view.instanceMatrix.needsUpdate=true;view.name=d.name;view.castShadow=d.castShadow;view.receiveShadow=d.receiveShadow;view.visible=d.visible;view.renderOrder=d.renderOrder;view.layers.mask=d.layersMask;view.userData={...JSON.parse(JSON.stringify(source.userData)),shoreSourceName:source.name,sourceGeometryUUID:source.geometry.uuid,sourcePreserved:true};for(const key of ['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','customDepthMaterial','customDistanceMaterial'])view[key]=source[key];view.computeBoundingBox();view.computeBoundingSphere();group.add(view);offset+=d.byteLength;instances+=d.count;triangles+=(source.geometry.index?.count??source.geometry.attributes.position.count)/3*d.count;
    }
    expect(offset===prepared.binary.byteLength&&slotKeys.size===instances&&instances===m.diagnostics.meshInstances&&triangles===m.diagnostics.trianglesPerPass,'draw/triangle totals differ');
    for(const b of m.bindings){const view=instanceViews[b.draw],actual=new THREE.Matrix4();view.getMatrixAt(b.instance,actual);expect(actual.elements.every(Number.isFinite)&&actual.elements[3]===0&&actual.elements[7]===0&&actual.elements[11]===0&&actual.elements[15]===1&&actual.determinant()>0,'invalid actual Float32 matrix');bindings.push({placementId:b.placementId,sourceMesh:sources[b.source],drawMesh:view,instance:b.instance,matrix:actual});if(requests.get(b.placementId).species==='lake-rock'){let part=collisionParts.find(p=>p.userData.placementId===b.placementId);if(!part){part=new THREE.Group();part.name='shore-collision-'+b.placementId;part.userData={placementId:b.placementId,species:'lake-rock'};collisionParts.push(part);collisionGroup.add(part);}const mesh=new THREE.Mesh(view.geometry,view.material);mesh.name=sources[b.source].name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(actual);part.add(mesh);}}
    group.updateMatrixWorld(true);collisionGroup.updateMatrixWorld(true);group.userData={body:'contemporary-shore-planting-community',worldCoordinates:true,historicallySurveyed:false,sourceFreeze:m.diagnostics.sourceSpec.understoryFreeze,nativeCompositionReviewed:false,prepared:true};
    Object.assign(diagnostics,structuredClone(m.diagnostics),{prepared:true,representation:'exact-authoring-Float32-bindings; borrowed-full-source-geometry-and-PBR',queryStats:{queries:snapshot.probes.length*2},authoringQueryStats:structuredClone(m.diagnostics.queryStats),preparedVerification:{manifestSHA256:prepared.manifestSHA256,sourceFiles:m.sourceFiles.length,sourceNodes:sources.length,verifiedSourceBytes,normalComparisons,normalComparisonCopiesOnly:true,willowContext:willowContextVerification,terrainSHA256:m.terrain.sha256,completeSupportTriangles:snapshot.geometries.filter(g=>['soil','detail','patch'].includes(g.phase)).reduce((n,g)=>n+g.sourceTriangleIndices.length,0),liveProbes:snapshot.probes.length,terrainFacesScanned:snapshot.diagnostics.scannedTriangles+finalSnapshot.diagnostics.scannedTriangles,cpuMilliseconds:performance.now()-started,fullSourceFactories:0,foliageQueries:0,renderInstances:instances},nativeCompositionReviewed:false,borrowedSourceInvalidated:false});notify('prepared-ready');
    return {group,contextGroups,collisionSources:{group:collisionGroup,parts:collisionParts},diagnostics,bindings,dispose,get disposed(){return disposed;}};
  }catch(error){const detail={id:layout.id,prepared:true,stage,message:error.message,nativeCompositionReviewed:false};try{error.diagnostics??=detail;}catch{}try{dispose();}catch(cleanup){const combined=new AggregateError([error,cleanup],'Prepared shoreline rejected and cleanup failed',{cause:error});combined.diagnostics=detail;throw combined;}throw error;}
}
