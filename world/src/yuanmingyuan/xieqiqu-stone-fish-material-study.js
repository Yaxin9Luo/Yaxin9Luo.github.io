import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import {decodeXianfashanTexturePixels} from './xianfashan-materials.js';
import {createXieqiquStoneFishStudy} from './xieqiqu-stone-fish.js';

export {stoneFishStudyViews} from './xieqiqu-stone-fish-views.js';
const manifestPath='/textures/yuanmingyuan/fangwaiguan-material-r4/manifest.json';
const manifestSHA256='7fd664b65dfb0894b605a0b114e40c27bcd4f3b7672a065e1f559cf30a8b247a';
const channels=['color','normal','roughness'],preparedPixels=new WeakSet(),materialStates=new WeakMap();
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const fail=(condition,message)=>{if(!condition)throw new Error('Stone fish material: '+message);};
export const stoneFishMaterialSpec=Object.freeze({
  id:'xieqiqu-stone-fish-marble-material-r1',source:'https://ambientcg.com/view?id=Marble021',license:'CC0-1.0',
  manifestPath,manifestSHA256,textureResolution:4096,tileMetres:1.5,normalStrength:.12,roughnessRange:Object.freeze([.66,.88]),roughnessFactor:.98,
  historicalColourVerified:false,scaleEvidence:'Authored 1.5 m repeat; provider physical size unavailable',
  representation:'continuous-triplanar-standard-PBR-review-shader',archiveCompatible:false,nativeReviewed:false,
});

/** Small decode seam for tests; the production prepare below fixes 4096² and
 * the pinned manifest. No resized image or bitmap survives this function. */
export async function decodeStoneFishMaterialMap(bytes,file,{signal,...decodeOptions}={}){
  fail(bytes.byteLength===file.bytes,'truncated '+file.path);
  return decodeXianfashanTexturePixels(bytes,file,{signal,...decodeOptions});
}

/** Loads only Marble021's three full 4K maps, sequentially. The pixels belong to
 * this preparation handle. Material owners retain their borrowed arrays even
 * if the handle subsequently releases its own references. No global cache. */
export async function prepareXieqiquStoneFishMaterialPixels({signal,fetchFile=fetchPublicAsset,decodeOptions={}}={}){
  signal?.throwIfAborted();
  const response=await fetchFile(manifestPath,{signal});fail(response.ok,'manifest HTTP '+response.status);
  const manifestBytes=await response.arrayBuffer();fail(await sha(manifestBytes)===manifestSHA256,'manifest SHA mismatch');signal?.throwIfAborted();
  const manifest=JSON.parse(new TextDecoder().decode(manifestBytes)),source=manifest.sources?.marble;
  fail(manifest.id==='fangwaiguan-material-r4-candidate'&&manifest.version===1&&source?.asset==='Marble021'&&source.width===4096&&source.height===4096&&source.tileMetres===1.5&&source.license==='CC0-1.0','unsupported marble source');
  let maps={},disposed=false;
  try{
    for(const channel of channels){
      signal?.throwIfAborted();const file=source.files[channel],r=await fetchFile(file.path,{signal});fail(r.ok,channel+' HTTP '+r.status);
      const entry=await decodeStoneFishMaterialMap(await r.arrayBuffer(),{...file,width:4096,height:4096},{...decodeOptions,signal});
      maps[channel]=entry;signal?.throwIfAborted();
    }
    Object.freeze(maps);const handle={source:Object.freeze(source),manifestSHA256,
      get maps(){return maps;},get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;maps=null;},
      diagnostics:{sourceRole:'marble-only',encodedBytes:channels.reduce((n,c)=>n+source.files[c].bytes,0),decodedBytes:3*4096*4096*4,resolution:[4096,4096],sourceImages:3,bitmapRetained:false,gpuCreated:false,historicalColourVerified:false},
    };preparedPixels.add(handle);return handle;
  }catch(error){maps=null;throw error;}
}

const vertexDeclarations=`
uniform mat4 fishAssetToMetric;
uniform mat3 fishNormalToMetric;
varying vec3 vFishMetricPosition;
varying vec3 vFishMetricNormal;
`;
const fragmentDeclarations=`
uniform float fishTileMetres;
uniform float fishNormalStrength;
uniform vec2 fishCutRoughness;
uniform mat3 fishMetricNormalToView;
varying vec3 vFishMetricPosition;
varying vec3 vFishMetricNormal;
vec3 fishWeights( vec3 n ) {
  vec3 w = abs( n ); w *= w; w *= w;
  return w / max( w.x + w.y + w.z, 1e-12 );
}
vec4 fishSample( sampler2D image, vec3 p, vec3 w ) {
  // All three projections have fixed orientation. No per-triangle/hemisphere
  // sign or dominant-axis switch, including on the rounded eyes and mouth.
  return texture2D( image, p.yz ) * w.x
       + texture2D( image, p.zx ) * w.y
       + texture2D( image, p.xy ) * w.z;
}
vec2 fishHeightDerivative( vec3 encodedNormal ) {
  vec3 n = encodedNormal * 2.0 - 1.0;
  return -n.xy / max( n.z, 0.05 );
}
vec3 fishSurfaceNormal( sampler2D image, vec3 p, vec3 n, vec3 w ) {
  vec2 x = fishHeightDerivative( texture2D( image, p.yz ).xyz );
  vec2 y = fishHeightDerivative( texture2D( image, p.zx ).xyz );
  vec2 z = fishHeightDerivative( texture2D( image, p.xy ).xyz );
  vec3 gradient = w.x * vec3( 0.0, x.x, x.y )
                + w.y * vec3( y.y, 0.0, y.x )
                + w.z * vec3( z.x, z.y, 0.0 );
  vec3 surfaceGradient = gradient - n * dot( n, gradient );
  return normalize( n - fishNormalStrength * surfaceGradient );
}
`;
const normalFragment=`
vec3 fishBaseNormal = normalize( vFishMetricNormal );
#ifdef FLIP_SIDED
  fishBaseNormal = -fishBaseNormal;
#endif
#ifdef DOUBLE_SIDED
  fishBaseNormal *= faceDirection;
#endif
vec3 fishPerturbedNormal = fishSurfaceNormal( normalMap,
  vFishMetricPosition / fishTileMetres, fishBaseNormal, fishWeights( fishBaseNormal ) );
normal = normalize( fishMetricNormalToView * fishPerturbedNormal );
`;

function replaceOnce(shader,needle,value){fail(shader.split(needle).length===2,'unexpected Three shader chunk '+needle);return shader.replace(needle,value);}

/** Low-level review material: maps remain owned by its caller. Standard PBR,
 * opaque depth/shadow coverage and the original mesh geometry are retained.
 * This custom shader is deliberately ineligible for the stock GLB archive. */
export function createStoneFishTriplanarMaterial({maps,color=0xf1efe6,tileMetres=1.5,normalStrength=.12,roughnessRange=stoneFishMaterialSpec.roughnessRange}={}){
  fail(channels.every(c=>maps?.[c]?.isTexture)&&tileMetres>0&&Number.isFinite(tileMetres)&&normalStrength>=0&&Number.isFinite(normalStrength)&&roughnessRange.length===2&&roughnessRange[0]>=0&&roughnessRange[1]<=1&&roughnessRange[0]<=roughnessRange[1],'three maps and finite material parameters required');
  const material=new THREE.MeshStandardMaterial({color,map:maps.color,normalMap:maps.normal,roughnessMap:maps.roughness,roughness:stoneFishMaterialSpec.roughnessFactor,metalness:0});
  material.name='stone-fish-continuous-white-marble';material.normalScale.setScalar(normalStrength);
  const state={fishTileMetres:{value:tileMetres},fishNormalStrength:{value:normalStrength},fishCutRoughness:{value:new THREE.Vector2(...roughnessRange)},fishAssetToMetric:{value:new THREE.Matrix4()},fishNormalToMetric:{value:new THREE.Matrix3()},fishMetricNormalToView:{value:new THREE.Matrix3()}};
  materialStates.set(material,state);
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,state);
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <common>','#include <common>\n'+vertexDeclarations);
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvFishMetricPosition = ( fishAssetToMetric * vec4( transformed, 1.0 ) ).xyz;\nvFishMetricNormal = fishNormalToMetric * objectNormal;');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <common>','#include <common>\n'+fragmentDeclarations);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>','diffuseColor *= fishSample( map, vFishMetricPosition / fishTileMetres, fishWeights( normalize( vFishMetricNormal ) ) );');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>','float roughnessFactor = roughness * mix( fishCutRoughness.x, fishCutRoughness.y, fishSample( roughnessMap, vFishMetricPosition / fishTileMetres, fishWeights( normalize( vFishMetricNormal ) ) ).g );');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <normal_fragment_maps>',normalFragment);
  };
  material.customProgramCacheKey=()=> 'stone-fish-triplanar-surface-gradient-r1-three185';
  material.userData={materialStudy:stoneFishMaterialSpec.id,projection:'continuous object-attached metric triplanar; original UV untouched',normalMethod:'weighted volume derivatives projected into the original tangent plane',roughnessCalibration:{kind:'authored-cut-stone shader uniform; original RGBA unchanged',range:[...roughnessRange],factor:stoneFishMaterialSpec.roughnessFactor},historicalColourVerified:false,reviewShader:true,archiveCompatible:false};
  return material;
}

/** All frozen fish components are already baked into one common asset frame.
 * An orthonormal frame attached to the root removes translation/rotation while
 * retaining its actual world stretch. A 1.5 m repeat stays 1.5 m under positive
 * nonuniform scaling. Uniforms are shared within one owner, never globally. */
export function updateStoneFishMaterialFrame(material,root,camera){
  const state=materialStates.get(material);if(!state)return false;
  root.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
  const world=root.matrixWorld,ce=camera.matrixWorldInverse.elements;
  fail(world.elements.every(Number.isFinite)&&ce.every(Number.isFinite)&&world.elements[3]===0&&world.elements[7]===0&&world.elements[11]===0&&world.elements[15]===1&&world.determinant()>0,'nonfinite/projective/singular or reflected root');
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();world.decompose(position,rotation,scale);rotation.normalize();
  const rotationFrame=new THREE.Matrix4().makeRotationFromQuaternion(rotation),assetToMetric=rotationFrame.clone().transpose().multiply(world);assetToMetric.setPosition(0,0,0);
  state.fishAssetToMetric.value.copy(assetToMetric);state.fishNormalToMetric.value.getNormalMatrix(assetToMetric);
  state.fishMetricNormalToView.value.getNormalMatrix(new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,rotationFrame));return true;
}

/** One texture owner can serve several independent material/uniform owners.
 * Releasing a material owner never releases these shared maps. */
export function createStoneFishTextureOwnerFromPixels(pixels){
  fail(preparedPixels.has(pixels)&&!pixels.disposed,'await the full 4K marble prepare first');
  const maps={},textures=[];let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;const errors=[];for(const t of textures){try{t.dispose();}catch(e){errors.push(e);}t.image=null;}textures.length=0;for(const k of Object.keys(maps))delete maps[k];if(errors.length)throw new AggregateError(errors,'Stone fish texture disposal failed');};
  try{
    for(const c of channels){const entry=pixels.maps[c],file=pixels.source.files[c];fail(entry.width===4096&&entry.height===4096&&entry.channels===4&&entry.origin==='lower-left'&&entry.data instanceof Uint8Array&&entry.data.length===4096*4096*4&&entry.encodedSha256===file.sha256,'invalid prepared '+c);
      const t=new THREE.DataTexture(entry.data,4096,4096,THREE.RGBAFormat);textures.push(t);maps[c]=t;t.name='stone-fish-marble-'+c;t.colorSpace=c==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;
      t.userData={source:stoneFishMaterialSpec.source,license:stoneFishMaterialSpec.license,sourceRole:'marble',physicalTileMetres:1.5,scaleEvidence:stoneFishMaterialSpec.scaleEvidence,encodedSha256:entry.encodedSha256,decodedSha256:entry.decodedSha256,sourceDecodedSha256:entry.sourceDecodedSha256??null,resolution:[4096,4096],sharedCPUPixels:true,sharedGPUTexture:false,calibration:entry.calibration??null};
    }
    return {maps,textures,fullResolutionVerified:true,dispose,get disposed(){return disposed;}};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish material construction failed',{cause:error});}throw error;}
}

export function createStoneFishSharedMapMaterialOwner(textureOwner){
  fail(textureOwner?.maps&&!textureOwner.disposed,'live texture owner required');
  const materials={};let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;const errors=[];for(const m of Object.values(materials)){try{m.dispose();}catch(e){errors.push(e);}m.map=m.normalMap=m.roughnessMap=null;materialStates.delete(m);}for(const k of Object.keys(materials))delete materials[k];if(errors.length)throw new AggregateError(errors,'Stone fish shared-map material disposal failed');};
  try{
    materials.carving=createStoneFishTriplanarMaterial({maps:textureOwner.maps});materials.oldStone=createStoneFishTriplanarMaterial({maps:textureOwner.maps,color:0xe3dfd3});materials.oldStone.name+='-eyes';
    return {materials,borrowedTextures:true,fullResolutionVerified:textureOwner.fullResolutionVerified===true,dispose,get disposed(){return disposed;}};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish shared material construction failed',{cause:error});}throw error;}
}

function materialOwnerFromPixels(pixels){
  const textures=createStoneFishTextureOwnerFromPixels(pixels);let materials,disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;const errors=[];for(const owner of [materials,textures])try{owner?.dispose();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Stone fish material disposal failed');};
  try{materials=createStoneFishSharedMapMaterialOwner(textures);return {materials:materials.materials,textures:textures.textures,fullResolutionVerified:true,dispose,get disposed(){return disposed;}};}
  catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish material construction failed',{cause:error});}throw error;}
}

/** The reusable ownership seam uses actual meshes even in small fixtures.
 * A borrowed source is represented by new Mesh views with identical geometry;
 * its materials, hierarchy and callbacks are not changed or disposed. */
export function createStoneFishMaterialView({sourceOwner,materialOwner,ownsSource=false,signal}={}){
  fail(sourceOwner?.group?.isGroup&&typeof sourceOwner.dispose==='function'&&typeof materialOwner?.dispose==='function','source and material owners required');
  let disposed=false,invalidated=false;const source=sourceOwner.group,group=ownsSource?source:source.clone(false),listeners=[],originalCallbacks=[],meshes=[];
  const textureList=[materialOwner.materials?.carving?.map,materialOwner.materials?.carving?.normalMap,materialOwner.materials?.carving?.roughnessMap];
  const diagnostics={...(sourceOwner.diagnostics??{}),resourceOwnership:{geometries:ownsSource?'owned by unchanged source factory':'borrowed same source objects',materials:'owned by material view',textures:materialOwner.borrowedTextures?'borrowed from outer texture owner':'owned by material view',cpuPixels:'borrowed decoded arrays',disposeSourceOwner:ownsSource},materialStudy:{...stoneFishMaterialSpec,textureResolution:textureList[0]?.image?.width??null,fullResolutionVerified:materialOwner.fullResolutionVerified===true,uvChanged:false,positionsNormalsIndicesChanged:false,sourceGeometries:'same objects',sourceOwnerBorrowed:!ownsSource,gtao:'unchanged geometric-normal override; micro-normal affects PBR only',shadows:'unchanged opaque source silhouette',textures:textureList.length,sourceMapPixels:textureList.reduce((n,t)=>n+(t?.image?.width??0)*(t?.image?.height??0),0)},visualAcceptance:false,integrationAcceptance:false};
  const invalidate=()=>{invalidated=true;group.visible=false;diagnostics.materialStudy.borrowedSourceInvalidated=true;};
  const dispose=()=>{if(disposed)return;disposed=true;const errors=[],run=fn=>{try{fn();}catch(e){errors.push(e);}};run(()=>group.removeFromParent());for(const [node,callback] of originalCallbacks)node.onBeforeRender=callback;for(const r of listeners)run(()=>r.removeEventListener('dispose',invalidate));listeners.length=0;
    if(ownsSource)run(()=>sourceOwner.dispose());else run(()=>group.clear());run(()=>materialOwner.dispose());meshes.length=originalCallbacks.length=0;if(errors.length)throw new AggregateError(errors,'Stone fish material view cleanup failed');};
  try{
    signal?.throwIfAborted();fail(!sourceOwner.disposed&&!materialOwner.disposed,'disposed source/material owner');
    fail(source.children.length>0,'empty source');
    const identity=new THREE.Matrix4().toArray(),resources=new Set();
    for(const original of source.children){fail(original.isMesh&&!original.isInstancedMesh&&!original.isSkinnedMesh&&!original.morphTargetInfluences&&!original.geometry.morphAttributes.position&&!original.children.length,'only frozen un-deformed fish Mesh components supported');
      const local=original.matrixAutoUpdate?new THREE.Matrix4().compose(original.position,original.quaternion,original.scale):original.matrix;
      fail(local.toArray().every((n,i)=>n===identity[i]),'source components must remain baked in the common fish frame');fail(['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'].every(key=>original[key]===THREE.Mesh.prototype[key])&&!original.customDepthMaterial&&!original.customDistanceMaterial,'unverified source rendering callback');
      const role=original.userData.body?.startsWith('eye-')?'oldStone':'carving',material=materialOwner.materials[role];fail(materialStates.has(material),'material was not made by the triplanar candidate');
      const node=ownsSource?original:original.clone(false);node.material=material;meshes.push(node);if(!ownsSource)group.add(node);originalCallbacks.push([node,node.onBeforeRender]);node.onBeforeRender=function(renderer,scene,camera,geometry,drawMaterial){if(drawMaterial===material)updateStoneFishMaterialFrame(material,group,camera);};
      resources.add(node.geometry);if(!ownsSource)for(const m of Array.isArray(original.material)?original.material:[original.material])resources.add(m);
    }
    if(!ownsSource)for(const r of resources){r.addEventListener('dispose',invalidate);listeners.push(r);}
    signal?.throwIfAborted();group.updateMatrixWorld(true);diagnostics.materialStudy.meshCount=meshes.length;diagnostics.materialStudy.triangles=meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);group.userData={...group.userData,materialStudy:stoneFishMaterialSpec.id,visualAcceptance:false};
    return {group,diagnostics,sourceOwner,dispose,get disposed(){return disposed;},get invalidated(){return invalidated;}};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish view construction failed',{cause:error});}throw error;}
}

/** Synchronous Studio factory after lazy prepare. With no borrowed source this
 * invokes the unchanged full frozen fish factory exactly once, at ROOT's GPU
 * review time. This module's light tests never invoke that full factory. */
export function createXieqiquStoneFishMaterialStudy({pixels,sourceOwner,signal}={}){
  signal?.throwIfAborted();if(sourceOwner)fail(sourceOwner.group?.isGroup&&typeof sourceOwner.dispose==='function','invalid borrowed source owner');
  const materialOwner=materialOwnerFromPixels(pixels);let source=sourceOwner,viewStarted=false;
  try{
    source??=createXieqiquStoneFishStudy({materials:materialOwner.materials,signal});viewStarted=true;
    return createStoneFishMaterialView({sourceOwner:source,materialOwner,ownsSource:!sourceOwner,signal});
  }catch(error){if(!viewStarted){try{materialOwner.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Stone fish factory failed',{cause:error});}}throw error;}
}
