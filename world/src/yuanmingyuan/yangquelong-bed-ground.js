import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {extrudedPolygon} from './study-geometry.js';
import {loadCourtSoilMaterial} from './court-soil-material-r1.js';
import {courtSoilManifestR1} from './court-soil-manifest-r1.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const TAU=Math.PI*2;
const circleAt=(x,z,r)=>Array.from({length:72},(_,i)=>[x+Math.sin(i/72*TAU)*r,z+Math.cos(i/72*TAU)*r]);
const beds=[[-12.8,-10.5,7.2,13.8],[-12.8,10.5,7.2,13.8],[8.55,-13,6.3,16],[8.55,13,6.3,16]].map(([x,z,w,d],i)=>{
  const outer=[[x-w/2+.65,z-d/2],[x+w/2-.65,z-d/2],[x+w/2,z-d/2+.65],[x+w/2,z+d/2-.65],[x+w/2-.65,z+d/2],[x-w/2+.65,z+d/2],[x-w/2,z+d/2-.65],[x-w/2,z-d/2+.65]];
  return {id:['west-north','west-south','east-north','east-south'][i],outer,inner:outer.map(([xx,zz])=>[x+(xx-x)*.965,z+(zz-z)*.982])};
});
export const yangquelongBedGroundSpec=freeze({
  id:'yangquelong-bed-ground-candidate-r1',outer:rect(-19,-24,22,24),
  originalHoles:[rect(13,-23.5,18,23.5),...[-1,1].map(s=>circleAt(-6.6,s*4.85,1.30))],beds,
  pavingBottom:-.20,pavingTop:0,edgingBottom:-.01,edgingTop:.12,soilBottom:-.20,soilTop:.02,
  evidence:'contemporary-exhibition-design-with-existing-authored-bed-footprints',
  historicallySurveyed:false,nativeReviewed:false,treesAdded:0,
});
const spec=yangquelongBedGroundSpec;
const fail=(condition,message)=>{if(!condition)throw new Error('Yangquelong bed ground: '+message);};
const area=ring=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-p[1]*q[0];},0))/2;
const triangleCount=g=>(g.index?.count??g.attributes.position.count)/3;
// Match the source builder's one identity bake; no new surface subdivision.
function polygon(points,bottom,top,holes=[]){
  const g=extrudedPolygon(points,bottom,top,holes);g.applyMatrix4(new THREE.Matrix4());g.clearGroups();return g;
}
function sameGeometry(a,b){
  if(Boolean(a.index)!==Boolean(b.index)||JSON.stringify(Object.keys(a.attributes).sort())!==JSON.stringify(Object.keys(b.attributes).sort()))return false;
  for(const name of [...Object.keys(b.attributes),...(b.index?['index']:[])]){
    const x=name==='index'?a.index:a.attributes[name],y=name==='index'?b.index:b.attributes[name];
    if(x.itemSize!==y.itemSize||x.array.constructor!==y.array.constructor||x.array.byteLength!==y.array.byteLength)return false;
    const p=new Uint8Array(x.array.buffer,x.array.byteOffset,x.array.byteLength),q=new Uint8Array(y.array.buffer,y.array.byteOffset,y.array.byteLength);
    for(let i=0;i<p.length;i++)if(p[i]!==q[i])return false;
  }
  return a.drawRange.start===b.drawRange.start&&a.drawRange.count===b.drawRange.count;
}
function identity(node){
  const m=node.matrixAutoUpdate?new THREE.Matrix4().compose(node.position,node.quaternion,node.scale):node.matrix;
  return m.equals(new THREE.Matrix4());
}
function sourceParts(owner){
  fail(owner?.group?.userData?.assetId==='yangquelong'&&owner.group.children.length&&typeof owner.dispose==='function'&&!owner.disposed,'live Yangquelong source owner required');
  const named=new Map();owner.group.traverse(n=>{if(!named.has(n.name))named.set(n.name,[]);named.get(n.name).push(n);});
  const one=name=>{const a=named.get(name);fail(a?.length===1,'unique original group '+name+' required');return a[0];};
  const court=one('yangquelong-courts-and-water-bridge'),paving=one('yangquelong-court-paving'),edging=one('yangquelong-garden-bed-edgings');
  fail(paving.parent===court&&edging.parent===court&&identity(paving)&&identity(edging),'original shared court coordinates required');
  fail(paving.children.length===1&&edging.children.length===1&&paving.children[0].isMesh&&edging.children[0].isMesh,'original paving and four-ring edging meshes required');
  const mesh=paving.children[0],edgeMesh=edging.children[0];
  fail(identity(mesh)&&identity(edgeMesh)&&mesh.material?.isMaterial&&!Array.isArray(mesh.material)&&edgeMesh.material?.isMaterial,'original baked paving frame/material required');
  const expectedPaving=polygon(spec.outer,spec.pavingBottom,spec.pavingTop,spec.originalHoles);
  const rings=spec.beds.map(b=>polygon(b.outer,spec.edgingBottom,spec.edgingTop,[b.inner]));
  let expectedEdges;
  try{
    expectedEdges=mergeGeometries(rings);
    fail(sameGeometry(mesh.geometry,expectedPaving)&&sameGeometry(edgeMesh.geometry,expectedEdges),'unreviewed paving or original four inner octagons');
  }finally{expectedPaving.dispose();for(const g of rings)g.dispose();expectedEdges?.dispose();}
  return {court,paving,edging,mesh,edgeMesh};
}
function assertSoilLease(lease){
  fail(lease&&lease.disposed===false&&typeof lease.dispose==='function'&&lease.material?.isMeshStandardMaterial,'live exclusive soil material lease required');
  fail(lease.diagnostics?.id===courtSoilManifestR1.id&&lease.diagnostics.tileMetres===courtSoilManifestR1.tileMetres,'original accepted soil source and scale required');
  for(const [slot,expected] of Object.entries(courtSoilManifestR1.files)){
    const file=lease.diagnostics.files?.[slot],texture=lease.material[slot];
    fail(file?.sha256===expected.sha256&&file.width===expected.width&&file.height===expected.height&&texture?.isTexture&&texture.image?.width===expected.width&&texture.image?.height===expected.height,'complete original soil '+slot+' required');
    fail(texture.colorSpace===(slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace)&&texture.wrapS===THREE.RepeatWrapping&&texture.wrapT===THREE.RepeatWrapping&&texture.repeat.x===1/courtSoilManifestR1.tileMetres&&texture.repeat.y===texture.repeat.x&&texture.generateMipmaps&&texture.minFilter===THREE.LinearMipmapLinearFilter&&texture.magFilter===THREE.LinearFilter,'original soil sampling '+slot+' required');
  }
}

/** Optional, reversible binding for one complete existing Yangquelong owner.
 * The owner and all original resources are borrowed. The callback transfers
 * one exclusive material lease; no source factory or texture fetch runs at import.
 * Release this binding before the source owner. An abort event never throws;
 * whenIdle exposes any cleanup failure, including a late returned lease.
 */
export async function prepareYangquelongBedGround({owner,signal,soilBaseUrl='/textures/yuanmingyuan/court-soil-r1/',createSoilMaterial=loadCourtSoilMaterial}={}){
  signal?.throwIfAborted();
  const parts=sourceParts(owner),originalGeometry=parts.mesh.geometry,originalMaterial=parts.mesh.material,edgeGeometry=parts.edgeMesh.geometry;
  let disposed=false,lease=null,leaseReleased=false,replacement=null,group=null,cleanupError=null;
  const geometries=[],listeners=[],soilMeshes=[],cleanupErrors=[];
  const run=fn=>{try{fn();}catch(e){cleanupErrors.push(e);}};
  function releaseLease(){if(lease&&!leaseReleased){leaseReleased=true;run(()=>lease.dispose());}}
  function reportCleanup(){if(cleanupErrors.length)cleanupError=new AggregateError([...cleanupErrors],'Yangquelong bed ground cleanup failed');return cleanupError;}
  function dispose(){
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',cancel);
    for(const r of listeners)run(()=>r.removeEventListener('dispose',cancel));listeners.length=0;
    run(()=>group?.removeFromParent());run(()=>group?.clear());
    if(replacement&&parts.mesh.geometry===replacement)parts.mesh.geometry=originalGeometry;
    for(const g of geometries)run(()=>g.dispose());geometries.length=0;releaseLease();
    if(reportCleanup())throw cleanupError;
  }
  function cancel(){try{dispose();}catch(error){cleanupError=error;}}
  function guard(committed=false){
    signal?.throwIfAborted();
    fail(!disposed&&!owner.disposed&&owner.group.children.length&&!lease?.disposed,'source/binding invalidated');
    fail(parts.paving.parent===parts.court&&parts.edging.parent===parts.court&&parts.mesh.parent===parts.paving&&parts.edgeMesh.parent===parts.edging&&parts.edgeMesh.geometry===edgeGeometry&&parts.mesh.geometry===(committed?replacement:originalGeometry)&&parts.mesh.material===originalMaterial,'source attachment changed');
    fail([parts.paving,parts.edging,parts.mesh,parts.edgeMesh].every(identity),'source local frame changed');
    if(committed){
      fail(group.parent===parts.court&&soilMeshes.every((n,i)=>n.parent===group&&n.geometry===geometries[i+1]&&n.material===lease.material),'soil attachment changed');
      fail([group,...soilMeshes].every(identity),'soil local frame changed');
    }
  }
  function assertCurrent(){try{guard(true);return true;}catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Yangquelong bed ground invalidation and cleanup failed',{cause:error});}throw error;}}
  for(const r of new Set([originalGeometry,originalMaterial,edgeGeometry,parts.edgeMesh.material])){r.addEventListener('dispose',cancel);listeners.push(r);}
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    lease=await createSoilMaterial({signal,baseUrl:soilBaseUrl});
    if(disposed||signal?.aborted){releaseLease();reportCleanup();guard();}
    guard();assertSoilLease(lease);sourceParts(owner); // Recheck the small real source after asynchronous preparation.
    replacement=polygon(spec.outer,spec.pavingBottom,spec.pavingTop,[...spec.originalHoles,...spec.beds.map(b=>b.inner)]);geometries.push(replacement);
    group=new THREE.Group();group.name=spec.id+'-soil';group.userData={evidence:spec.evidence,historicallySurveyed:false,nativeReviewed:false};
    for(const bed of spec.beds){
      const geometry=polygon(bed.inner,spec.soilBottom,spec.soilTop);geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,lease.material);mesh.name=spec.id+'-'+bed.id;
      mesh.castShadow=mesh.receiveShadow=true;mesh.userData={bedId:bed.id,evidence:spec.evidence,soilTop:spec.soilTop,soilBottom:spec.soilBottom,nativeReviewed:false};
      soilMeshes.push(mesh);group.add(mesh);
    }
    guard();parts.mesh.geometry=replacement;parts.court.add(group);assertCurrent();
    const diagnostics={id:spec.id,nativeReviewed:false,historicallySurveyed:false,sourceOwnerBorrowed:true,treesAdded:0,
      originalPavingTriangles:triangleCount(originalGeometry),pavingTriangles:triangleCount(replacement),soilTriangles:soilMeshes.reduce((s,n)=>s+triangleCount(n.geometry),0),
      bedAreas:spec.beds.map(b=>({id:b.id,area:area(b.inner)})),soilTop:spec.soilTop,soilBottom:spec.soilBottom,
      rimFreeboard:spec.edgingTop-spec.soilTop,soilMaterialLease:lease.diagnostics,
      unchanged:'Original edging, water, axis joints, passage, materials and every non-paving source geometry remain borrowed and unchanged'};
    return {group,soilMeshes,sourceOwner:owner,pavingMesh:parts.mesh,diagnostics,assertCurrent,update:assertCurrent,dispose,
      whenIdle(){return cleanupError?Promise.reject(cleanupError):Promise.resolve();},get disposed(){return disposed;},get cleanupError(){return cleanupError;}};
  }catch(error){
    try{dispose();}catch(cleanup){if(cleanup!==error)throw new AggregateError([error,cleanup],'Yangquelong bed ground preparation and cleanup failed',{cause:error});}
    if(cleanupError&&cleanupError!==error)throw new AggregateError([error,cleanupError],'Yangquelong bed ground preparation and cleanup failed',{cause:error});
    throw error;
  }
}
