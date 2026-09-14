import * as THREE from 'three';
import {decodeXianfashanTexturePixels} from './xianfashan-materials.js';

export const courtPavingCandidateSpec=Object.freeze({id:'xieqiqu-court-paving-material-r2',pitch:1.47,jointWidth:.016,luminanceVariation:.075,photoGrain:.6,roughnessVariation:.035,roughnessGrain:.3,factorRange:Object.freeze([.65,1.16]),roughnessRange:Object.freeze([.70,.94]),normalScale:.45});
const active=new WeakMap(),channels=['color','normal','roughness'],V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const sourceFiles={color:['marble-color.1f2d31717ab6.webp','1f2d31717ab6d2825d5716f5ab0beba83b6f4ddc4c298980a62d180e29f7b88f',12268426],normal:['marble-normal.8a5b84722bbe.webp','8a5b84722bbe719c315d9ef77709c93c3d2eea49638e2b3cfea3660bb952adcb',4240454],roughness:['marble-roughness.f73bbbfbc58e.webp','f73bbbfbc58ea9f0d21317025445351776c7522d557ff55080bd546ad489c4d6',3756210]};
export const courtPavingSource=Object.freeze({asset:'Marble021',provider:'ambientCG',sourceURL:'https://ambientcg.com/view?id=Marble021',license:'CC0-1.0',licenseURL:'https://docs.ambientcg.com/license/',width:4096,height:4096,tileMetres:1.5,scaleEvidence:'Authored 1.5m repeat; provider physical size unavailable',sourceManifest:'/textures/yuanmingyuan/fangwaiguan-material-r4/manifest.json',files:Object.freeze(Object.fromEntries(channels.map(channel=>{const [name,sha256,bytes]=sourceFiles[channel];return[channel,Object.freeze({path:'/textures/yuanmingyuan/fangwaiguan-material-r4/'+name,sha256,bytes})];})))});

/** Loads only the three existing seam-free mineral maps, not the other Fangwai roles.
 * Uses the existing complete-resolution decoder and original encoded hashes.
 * No source pixels are rescaled, repainted or replaced by procedural grain. */
export async function prepareCourtPavingPixels({signal,fetchFile=globalThis.fetch,decoder=decodeXianfashanTexturePixels}={}){
  signal?.throwIfAborted();const result={};
  for(const channel of channels){const file=courtPavingSource.files[channel];signal?.throwIfAborted();const response=await fetchFile(file.path,{signal});if(!response.ok)throw new Error('Court paving texture HTTP '+response.status+': '+channel);const bytes=await response.arrayBuffer();if(bytes.byteLength!==file.bytes)throw new Error('Truncated court paving '+channel);result[channel]=await decoder(bytes,{...file,width:4096,height:4096},{signal});}
  signal?.throwIfAborted();return Object.freeze(result);
}
function validatePixels(pixels){
  for(const channel of channels){const p=pixels?.[channel];if(!p||p.width!==4096||p.height!==4096||p.channels!==4||p.origin!=='lower-left'||!(p.data instanceof Uint8Array)||p.data.byteLength!==4096*4096*4||p.encodedSha256!==courtPavingSource.files[channel].sha256||!/^([a-f0-9]{64})$/.test(p.decodedSha256))throw new Error('Unverified full-resolution court paving '+channel);}
}
function sameMatrix(a,b){return a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-8);}
function onlyMesh(group){const meshes=[];group?.traverse(n=>{if(n.isMesh)meshes.push(n);});if(meshes.length!==1||meshes[0].isInstancedMesh)throw new Error('Expected one complete original floor mesh');return meshes[0];}
function textureRecord(t){return t?{name:t.name,uuid:t.uuid,width:t.image?.width??null,height:t.image?.height??null,repeat:t.repeat.toArray(),offset:t.offset.toArray(),matrix:t.matrix.toArray(),matrixAutoUpdate:t.matrixAutoUpdate,flipY:t.flipY,colorSpace:t.colorSpace,source:t.userData?.source??null,encodedSha256:t.userData?.encodedSha256??null}:null;}
export function courtPavingMaterialRecord(material){return {name:material.name,uuid:material.uuid,color:material.color.toArray(),colorHex:material.color.getHexString(),roughness:material.roughness,normalScale:material.normalScale.toArray(),map:textureRecord(material.map),normalMap:textureRecord(material.normalMap),roughnessMap:textureRecord(material.roughnessMap)};}

/** Recover a metric mapping from the original top vertices and UVs. The
 * nominal pitch is checked against every real joint strip, not assumed from
 * an image or aligned against the full rectangular display-floor UV range. */
export function auditCourtPavingUV({floor,courtRoot}={}){
  if(!floor?.isMesh||!courtRoot?.isObject3D||onlyMesh(courtRoot.getObjectByName('xieqiqu-court-paving'))!==floor)throw new Error('Use the actual Xieqiqu court floor');
  courtRoot.updateWorldMatrix(true,true);const frame=courtRoot.matrixWorld.clone(),toCourt=frame.clone().invert().multiply(floor.matrixWorld),geometry=floor.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  if(!p||!n||!uv||p.count!==n.count||p.count!==uv.count||!Number.isFinite(frame.determinant())||frame.determinant()<=0)throw new Error('Court floor needs original positions, normals and UVs');
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(toCourt),rows=[];
  for(let i=0;i<p.count;i++){const normal=V().fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);if(normal.y<.999)continue;const point=V().fromBufferAttribute(p,i).applyMatrix4(toCourt);rows.push({uv:[uv.getX(i),uv.getY(i)],point:point.toArray()});}
  if(rows.length<3)throw new Error('No actual horizontal court top');
  const a=rows[0],b=rows.reduce((best,row)=>Math.hypot(row.uv[0]-a.uv[0],row.uv[1]-a.uv[1])>Math.hypot(best.uv[0]-a.uv[0],best.uv[1]-a.uv[1])?row:best,a),det=row=>(b.uv[0]-a.uv[0])*(row.uv[1]-a.uv[1])-(b.uv[1]-a.uv[1])*(row.uv[0]-a.uv[0]),c=rows.reduce((best,row)=>Math.abs(det(row))>Math.abs(det(best))?row:best,a);
  if(Math.abs(det(c))<1e-8)throw new Error('Degenerate court UV mapping');
  const inverse=new THREE.Matrix3().set(...a.uv,1,...b.uv,1,...c.uv,1).invert(),x=V(a.point[0],b.point[0],c.point[0]).applyMatrix3(inverse),z=V(a.point[2],b.point[2],c.point[2]).applyMatrix3(inverse),uvToXZ=new THREE.Matrix3().set(x.x,x.y,x.z,z.x,z.y,z.z,0,0,1);
  let maxUVError=0,maxTopHeightError=0;
  for(const row of rows){const mapped=V(...row.uv,1).applyMatrix3(uvToXZ);maxUVError=Math.max(maxUVError,Math.hypot(mapped.x-row.point[0],mapped.y-row.point[2]));maxTopHeightError=Math.max(maxTopHeightError,Math.abs(row.point[1]));}
  if(maxUVError>1e-5||maxTopHeightError>1e-6)throw new Error('Original metric top UVs or floor height changed');
  const joints=courtRoot.getObjectByName('xieqiqu-court-stone-joints');if(!joints)throw new Error('Missing actual original stone joints');
  const strips=new Map();
  joints.traverse(node=>{if(!node.isMesh)return;if(node.isInstancedMesh)throw new Error('Unexpected instanced original paving joints');const matrix=frame.clone().invert().multiply(node.matrixWorld),g=node.geometry,pos=g.attributes.position,norm=g.attributes.normal,index=g.index,nm=new THREE.Matrix3().getNormalMatrix(matrix),count=index?.count??pos.count;
    for(let i=0;i<count;i+=3){const points=[];let top=true;for(let j=0;j<3;j++){const at=index?index.getX(i+j):i+j;if(V().fromBufferAttribute(norm,at).applyNormalMatrix(nm).y<.999){top=false;break;}points.push(V().fromBufferAttribute(pos,at).applyMatrix4(matrix));}if(!top)continue;const box=new THREE.Box3().setFromPoints(points),dx=box.max.x-box.min.x,dz=box.max.z-box.min.z;if(box.max.y-box.min.y>1e-6||Math.abs(box.max.y-.008)>1e-5)throw new Error('Paving joint top changed');const axis=dx<dz?'x':'z',width=Math.min(dx,dz);if(Math.abs(width-.016)>5e-6)throw new Error('Original 16 mm joint width changed');const key=[box.min.x,box.max.x,box.min.z,box.max.z].map(v=>v.toFixed(6)).join(',');strips.set(key,{axis,centre:(box.min[axis]+box.max[axis])/2,width,bounds:[box.min.toArray(),box.max.toArray()]});}
  });
  const grid={};
  for(const axis of ['x','z']){const list=[...strips.values()].filter(s=>s.axis===axis);if(list.length<8)throw new Error('Insufficient original grid joints');const first=Math.min(...list.map(s=>s.centre)),origin=list.reduce((sum,s)=>sum+s.centre-Math.round((s.centre-first)/1.47)*1.47,0)/list.length,maxResidual=Math.max(...list.map(s=>Math.abs(s.centre-origin-Math.round((s.centre-origin)/1.47)*1.47)));if(maxResidual>5e-6)throw new Error('Original 1.47 m joint pitch changed');grid[axis]={origin,pitch:1.47,maxResidual,stripCount:list.length,lineCount:new Set(list.map(s=>Math.round((s.centre-origin)/1.47))).size};}
  const holes=[];
  for(const [x,z]of [[0,-27],[0,26]]){const origin=V(x,1,z).applyMatrix4(frame),direction=V(0,-1,0).transformDirection(frame),ray=new THREE.Raycaster(origin,direction,0,2*frame.getMaxScaleOnAxis());if(ray.intersectObject(floor,false).length)throw new Error('Original flower pool floor hole is closed');holes.push([x,z]);}
  return {frame:frame.toArray(),floorToCourt:toCourt.toArray(),uvToXZRows:[x.toArray(),z.toArray()],uvToXZ,topVertexCount:rows.length,maxUVError,maxTopHeightError,grid,holes,stripCount:strips.size,jointStrips:[...strips.values()],nominalJointWidth:.016};
}
function channelMean(data,linear=false){const lut=Array.from({length:256},(_,v)=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});let sum=0;for(let i=0;i<data.length;i+=4)sum+=linear ? .2126*lut[data[i]]+.7152*lut[data[i+1]]+.0722*lut[data[i+2]]:data[i+1]/255;return sum/(data.length/4);}
const mod=(x,n)=>x-Math.floor(x/n)*n;
export function courtPavingCellValue(ix,iz,seed=0){let h=mod(ix*73+iz*151+seed,251);h=mod(h*h*17+h*13+101,251);return h/125-1;}
export function sampleCourtPavingResponse({x,z,colorLuminance,roughnessSample,grid,sourceColorMean,sourceRoughnessMean,baseRoughness}){const s=courtPavingCandidateSpec,ix=Math.floor((x-grid.x.origin)/s.pitch),iz=Math.floor((z-grid.z.origin)/s.pitch);return {cell:[ix,iz],luminanceFactor:THREE.MathUtils.clamp(1+s.luminanceVariation*courtPavingCellValue(ix,iz)+s.photoGrain*(colorLuminance/sourceColorMean-1),...s.factorRange),roughness:THREE.MathUtils.clamp(baseRoughness+s.roughnessVariation*courtPavingCellValue(ix,iz,97)+s.roughnessGrain*(roughnessSample-sourceRoughnessMean),...s.roughnessRange)};}
function replaceOnce(source,token,replacement){if(source.split(token).length!==2)throw new Error('Unsupported Three shader chunk '+token);return source.replace(token,replacement);}

/** In-place decoration of the already-private court display material. Keeping
 * this material's identity respects the existing garden binding guard.
 * The caller retains ownership of the material, original maps and all geometry;
 * this handle owns only its three full-resolution textures and shader hooks.
 * Dispose this handle before the court binding; material disposal also retires
 * it automatically. Never apply to the original shared building material. */
export function bindCourtPavingMaterialCandidate({floor,courtRoot,pixels,signal}={}){
  signal?.throwIfAborted();const material=floor?.material;
  if(!material?.isMeshStandardMaterial||Array.isArray(material)||!material.name.endsWith('-court-paving')||material.userData.body!=='contemporary-court-garden-material'||active.has(material))throw new Error('An unused private court display material is required');
  const users=[];courtRoot?.traverse(node=>{if(node.isMesh&&(Array.isArray(node.material)?node.material:[node.material]).includes(material))users.push(node);});if(users.length!==1||users[0]!==floor)throw new Error('Court display material must not be shared with roofing or other meshes');
  if(material.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||material.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey)throw new Error('Review existing custom court shaders before decorating');
  validatePixels(pixels);const audit=auditCourtPavingUV({floor,courtRoot}),original={map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,normalScale:material.normalScale.clone(),onBeforeCompile:material.onBeforeCompile,customProgramCacheKey:material.customProgramCacheKey},geometry=floor.geometry,uv=geometry.attributes.uv,position=geometry.attributes.position,textureMaps={};
  if(!original.roughnessMap?.isDataTexture||!(original.roughnessMap.image.data instanceof Uint8Array))throw new Error('The current actual roughness map is required to retain its mean response');
  const means={sourceColorMean:channelMean(pixels.color.data,true),sourceRoughnessMean:channelMean(pixels.roughness.data),baseRoughness:material.roughness*channelMean(original.roughnessMap.image.data)};
  if(!(means.sourceColorMean>0))throw new Error('The existing stone color source is empty');
  const diagnostics={id:courtPavingCandidateSpec.id,nativeReviewed:false,historicallySurveyed:false,geometryChanged:false,uvChanged:false,materialIdentityPreserved:true,original:courtPavingMaterialRecord(material),source:courtPavingSource,spec:courtPavingCandidateSpec,means,audit:{...audit,uvToXZ:undefined},ownedTextures:3,disposed:false};
  let disposed=false,installed=false;
  function dispose(){if(disposed)return;disposed=true;diagnostics.disposed=true;active.delete(material);signal?.removeEventListener('abort',dispose);material.removeEventListener('dispose',dispose);geometry.removeEventListener('dispose',dispose);if(installed){for(const channel of channels){const slot={color:'map',normal:'normalMap',roughness:'roughnessMap'}[channel];if(material[slot]===textureMaps[channel])material[slot]=original[slot];}if(material.normalScale.x===courtPavingCandidateSpec.normalScale&&material.normalScale.y===courtPavingCandidateSpec.normalScale)material.normalScale.copy(original.normalScale);if(material.onBeforeCompile===compile)material.onBeforeCompile=original.onBeforeCompile;if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=original.customProgramCacheKey;material.needsUpdate=true;}for(const texture of Object.values(textureMaps))texture.dispose();}
  function assertCurrent(){if(disposed)throw new Error('Court paving candidate is disposed');courtRoot.updateWorldMatrix(true,true);const relative=courtRoot.matrixWorld.clone().invert().multiply(floor.matrixWorld);if(floor.material!==material||floor.geometry!==geometry||geometry.attributes.uv!==uv||geometry.attributes.position!==position||!sameMatrix(relative,new THREE.Matrix4().fromArray(audit.floorToCourt))||channels.some(c=>material[{color:'map',normal:'normalMap',roughness:'roughnessMap'}[c]]!==textureMaps[c])||material.onBeforeCompile!==compile){dispose();throw new Error('Court paving source or private material changed');}return true;}
  const cacheKey=()=>courtPavingCandidateSpec.id+'-shared-geometry-uv-1';
  function compile(shader){
    assertCurrent();const s=courtPavingCandidateSpec;
    Object.assign(shader.uniforms,{courtUVToXZ:{value:audit.uvToXZ},courtGridOrigin:{value:new THREE.Vector2(audit.grid.x.origin,audit.grid.z.origin)},courtSourceColorMean:{value:means.sourceColorMean},courtSourceRoughnessMean:{value:means.sourceRoughnessMean},courtBaseRoughness:{value:means.baseRoughness}});
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <common>','#include <common>\nuniform mat3 courtUVToXZ;\nvarying vec2 vCourtPavingXZ;\nvarying float vCourtPavingTop;');
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <uv_vertex>','#include <uv_vertex>\nvCourtPavingXZ=(courtUVToXZ*vec3(uv,1.0)).xy;\nvCourtPavingTop=step(0.999,normal.y);');
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <common>',`#include <common>
      varying vec2 vCourtPavingXZ; varying float vCourtPavingTop;
      uniform vec2 courtGridOrigin; uniform float courtSourceColorMean; uniform float courtSourceRoughnessMean; uniform float courtBaseRoughness;
      float courtStone(vec2 cell,float seed){float h=mod(dot(cell,vec2(73.0,151.0))+seed,251.0);h=mod(h*h*17.0+h*13.0+101.0,251.0);return h/125.0-1.0;}`);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>',`vec3 courtAuthoredBase=diffuseColor.rgb;
      #include <map_fragment>
      vec2 courtCell=floor((vCourtPavingXZ-courtGridOrigin)/${s.pitch});
      vec3 courtPhoto=diffuseColor.rgb/max(courtAuthoredBase,vec3(0.000001));
      float courtPhotoLuminance=dot(courtPhoto,vec3(0.2126,0.7152,0.0722));
      float courtFactor=clamp(1.0+${s.luminanceVariation}*courtStone(courtCell,0.0)+${s.photoGrain}*(courtPhotoLuminance/courtSourceColorMean-1.0),${s.factorRange[0]},${s.factorRange[1]});
      diffuseColor.rgb=courtAuthoredBase*mix(1.0,courtFactor,vCourtPavingTop);`);
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>',`float courtPhotoRoughness=texture2D(roughnessMap,vRoughnessMapUv).g;
      float roughnessFactor=mix(courtBaseRoughness,clamp(courtBaseRoughness+${s.roughnessVariation}*courtStone(courtCell,97.0)+${s.roughnessGrain}*(courtPhotoRoughness-courtSourceRoughnessMean),${s.roughnessRange[0]},${s.roughnessRange[1]}),vCourtPavingTop);`);
  }
  try{
    for(const channel of channels){signal?.throwIfAborted();const entry=pixels[channel],texture=new THREE.DataTexture(entry.data,entry.width,entry.height,THREE.RGBAFormat);textureMaps[channel]=texture;texture.name=courtPavingCandidateSpec.id+'-'+channel;texture.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;texture.repeat.setScalar(1/courtPavingSource.tileMetres);const [u,v]=audit.uvToXZRows,k=1/courtPavingSource.tileMetres;texture.matrixAutoUpdate=false;texture.matrix.set(u[0]*k,u[1]*k,u[2]*k,-v[0]*k,-v[1]*k,-v[2]*k,0,0,1);texture.needsUpdate=true;texture.userData={source:courtPavingSource.sourceURL,license:courtPavingSource.license,encodedSha256:entry.encodedSha256,decodedSha256:entry.decodedSha256,sourceResolution:[4096,4096],originalPixels:true,sharedCPUPixels:true,sharedGPUTexture:false};}
    material.map=textureMaps.color;material.normalMap=textureMaps.normal;material.normalScale.setScalar(courtPavingCandidateSpec.normalScale);material.roughnessMap=textureMaps.roughness;material.onBeforeCompile=compile;material.customProgramCacheKey=cacheKey;material.needsUpdate=true;installed=true;active.set(material,true);signal?.addEventListener('abort',dispose,{once:true});material.addEventListener('dispose',dispose);geometry.addEventListener('dispose',dispose);signal?.throwIfAborted();diagnostics.candidate=courtPavingMaterialRecord(material);
    return {material,textures:textureMaps,diagnostics,assertCurrent,dispose,get disposed(){return disposed;}};
  }catch(error){dispose();throw error;}
}
