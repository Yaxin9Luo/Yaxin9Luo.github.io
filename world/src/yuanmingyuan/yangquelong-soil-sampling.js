import * as THREE from 'three';
import {loadCourtSoilMaterial} from './court-soil-material-r1.js';
import {courtSoilManifestR1} from './court-soil-manifest-r1.js';

const slots=['map','normalMap','roughnessMap','aoMap'];
export const samplingSpec=Object.freeze({
  id:'yangquelong-soil-jittered-rotated-triangle-r3',threeRevision:'185',
  sourceTileMetres:courtSoilManifestR1.tileMetres,gridSideInSourceTiles:1,
  grid:'shared deterministically jittered triangle vertices',jitterMaxPerAxis:.26,
  blend:'normalized cubed barycentric weights',translationOnly:false,
  textureFetchesPerChannel:3,sourcePixelsChanged:false,normalRotation:true,
  derivatives:'R * original continuous vMapUv derivatives for each patch',
  normalTransform:'transpose(R) * sampled tangent normal.xy before shared weighted blend',
  normalBlend:'directional normal mixture, then unchanged normalScale and original TBN',
  implicitMipDerivatives:false,geometryChanged:false,nativeReviewed:false,
});
const fail=(ok,message)=>{if(!ok)throw new Error('Soil sampling: '+message);};

// Original-pixel randomized sampling and inverse normal rotation follow the
// chain rule described in Mikkelsen, Practical Real-Time Hex-Tiling (2022).
// Our bounded vertex jitter changes only the blend domain, never source scale.
// Every shared vertex owns one stable position, translation and proper rotation.
export const samplingGLSL=/* glsl */`
uint ymySoilMix( uint x ) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
uint ymySoilKey( vec2 vertex, uint salt ) {
  uvec2 key = uvec2( ivec2( vertex ) );
  return ymySoilMix( key.x ^ ymySoilMix( key.y ^ 0x9e3779b9u ) ^ salt );
}
vec2 ymySoilRandom2( vec2 vertex, uint salt ) {
  uint a = ymySoilKey( vertex, salt );
  uint b = ymySoilMix( a ^ 0x68bc21ebu );
  return vec2( a & 0x00ffffffu, b & 0x00ffffffu ) * ( 1.0 / 16777216.0 );
}
vec2 ymySoilCenter( vec2 vertex ) {
  return vec2( vertex.x + 0.5 * vertex.y, vertex.y * 0.8660254037844386 );
}
vec2 ymySoilSite( vec2 vertex ) {
  return ymySoilCenter( vertex ) + ( ymySoilRandom2( vertex, 0x51633e2du ) * 2.0 - 1.0 ) * 0.26;
}
float ymySoilCross( vec2 a, vec2 b ) { return a.x * b.y - a.y * b.x; }
bool ymySoilTriangle( vec2 uv, vec2 a, vec2 b, vec2 c, out vec3 weights ) {
  vec2 ba = b - a, ca = c - a, pa = uv - a;
  float det = ymySoilCross( ba, ca );
  float y = ymySoilCross( pa, ca ) / det;
  float z = ymySoilCross( ba, pa ) / det;
  weights = vec3( 1.0 - y - z, y, z );
  if ( min( min( weights.x, weights.y ), weights.z ) < -0.00002 ) return false;
  weights = max( weights, vec3( 0.0 ) );
  weights = weights * weights * weights;
  weights /= dot( weights, vec3( 1.0 ) );
  return true;
}
const vec2 ymySoilNeighbors[9] = vec2[9](
  vec2(0,0), vec2(-1,0), vec2(1,0), vec2(0,-1), vec2(0,1),
  vec2(-1,-1), vec2(1,-1), vec2(-1,1), vec2(1,1)
);
void ymySoilCell( vec2 uv, out vec3 weights, out vec2 a, out vec2 b, out vec2 c ) {
  vec2 base = floor( vec2( uv.x - uv.y * 0.5773502691896258, uv.y * 1.1547005383792517 ) );
  // Jitter radius < sqrt(2)*.26 < half the equilateral-triangle altitude:
  // triangles cannot invert. In skew coordinates displacement is < .425,
  // so a point's containing deformed triangle lies in this 3-by-3 stencil.
  for ( int k = 0; k < 9; k++ ) {
    vec2 cell = base + ymySoilNeighbors[k];
    vec2 v00 = cell, v10 = cell + vec2(1,0), v01 = cell + vec2(0,1), v11 = cell + vec2(1,1);
    vec2 p00 = ymySoilSite(v00), p10 = ymySoilSite(v10), p01 = ymySoilSite(v01), p11 = ymySoilSite(v11);
    if ( ymySoilTriangle(uv,p00,p10,p01,weights) ) { a=v00; b=v10; c=v01; return; }
    if ( ymySoilTriangle(uv,p11,p01,p10,weights) ) { a=v11; b=v01; c=v10; return; }
  }
  // Unreachable in the finite court UV domain by the bound above. Zero weights
  // expose a coverage regression rather than silently restoring regular tiling.
  weights=vec3(0.0); a=base; b=base+vec2(1,0); c=base+vec2(0,1);
}
struct YmySoilPatch { vec2 uv; vec2 dx; vec2 dy; mat2 rotation; };
YmySoilPatch ymySoilPatch( vec2 vertex, vec2 uv, vec2 uvDx, vec2 uvDy ) {
  float angle = float( ymySoilKey(vertex,0xa511e9b3u) & 0x00ffffffu ) * (6.283185307179586 / 16777216.0);
  float c = cos(angle), s = sin(angle);
  // GLSL mat2 constructor is column-major: R = [c -s; s c].
  mat2 rotation = mat2(c,s,-s,c);
  YmySoilPatch soilPatch;
  soilPatch.uv = rotation * (uv - ymySoilCenter(vertex)) + ymySoilRandom2(vertex,0u);
  // Derive before the random triangle search; then rotate both footprints.
  soilPatch.dx = rotation * uvDx; soilPatch.dy = rotation * uvDy; soilPatch.rotation = rotation;
  return soilPatch;
}
vec4 ymySoilSample( sampler2D sourceMap, vec3 weights, YmySoilPatch a, YmySoilPatch b, YmySoilPatch c ) {
  return textureGrad(sourceMap,a.uv,a.dx,a.dy) * weights.x
       + textureGrad(sourceMap,b.uv,b.dx,b.dy) * weights.y
       + textureGrad(sourceMap,c.uv,c.dx,c.dy) * weights.z;
}
vec3 ymySoilNormal( sampler2D sourceMap, vec3 weights, YmySoilPatch a, YmySoilPatch b, YmySoilPatch c ) {
  vec3 na = textureGrad(sourceMap,a.uv,a.dx,a.dy).xyz * 2.0 - 1.0;
  vec3 nb = textureGrad(sourceMap,b.uv,b.dx,b.dy).xyz * 2.0 - 1.0;
  vec3 nc = textureGrad(sourceMap,c.uv,c.dx,c.dy).xyz * 2.0 - 1.0;
  // q = R*u+t: directional components must return via R^T to the original
  // tangent basis BEFORE blending. Rotating only UVs would mislight the grains.
  na.xy = transpose(a.rotation) * na.xy;
  nb.xy = transpose(b.rotation) * nb.xy;
  nc.xy = transpose(c.rotation) * nc.xy;
  return na * weights.x + nb * weights.y + nc * weights.z;
}
`;
const samplingSetup=`
vec3 ymySoilWeights;
vec2 ymySoilVertexA, ymySoilVertexB, ymySoilVertexC;
vec2 ymySoilUvDx = dFdx( vMapUv );
vec2 ymySoilUvDy = dFdy( vMapUv );
ymySoilCell( vMapUv, ymySoilWeights, ymySoilVertexA, ymySoilVertexB, ymySoilVertexC );
YmySoilPatch ymySoilPatchA = ymySoilPatch( ymySoilVertexA, vMapUv, ymySoilUvDx, ymySoilUvDy );
YmySoilPatch ymySoilPatchB = ymySoilPatch( ymySoilVertexB, vMapUv, ymySoilUvDx, ymySoilUvDy );
YmySoilPatch ymySoilPatchC = ymySoilPatch( ymySoilVertexC, vMapUv, ymySoilUvDx, ymySoilUvDy );
`;

const read=slot=>'ymySoilSample( '+slot+', ymySoilWeights, ymySoilPatchA, ymySoilPatchB, ymySoilPatchC )';
function replaceOnce(source,token,replacement){
  fail(source.split(token).length===2,'expected one unchanged shader token '+token);
  return source.replace(token,replacement);
}
export function patchSoilShader(fragmentShader){
  fail(THREE.REVISION===samplingSpec.threeRevision,'unreviewed Three shader revision');
  let result=replaceOnce(fragmentShader,'#include <common>','#include <common>\n'+samplingGLSL);
  const changed=[
    ['map_fragment','texture2D( map, vMapUv )',read('map')],
    ['normal_fragment_maps','texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;','ymySoilNormal( normalMap, ymySoilWeights, ymySoilPatchA, ymySoilPatchB, ymySoilPatchC );'],
    ['roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )',read('roughnessMap')],
    ['aomap_fragment','texture2D( aoMap, vAoMapUv )',read('aoMap')],
  ];
  for(const [name,token,replacement] of changed){
    let chunk=THREE.ShaderChunk[name];
    // Only tangent mapN changes; normalScale, TBN and final normalize stay.
    if(name==='normal_fragment_maps')chunk=replaceOnce(chunk,'vec3 mapN = '+token,'vec3 mapN = '+replacement);
    else chunk=replaceOnce(chunk,token,replacement);
    result=replaceOnce(result,'#include <'+name+'>',(name==='map_fragment'?samplingSetup:'')+chunk);
  }
  return result;
}
function assertMaps(material,tileMetres){
  fail(material?.isMeshStandardMaterial&&material.normalMapType===THREE.TangentSpaceNormalMap,'exclusive standard material with tangent-space normals required');
  fail(tileMetres===courtSoilManifestR1.tileMetres,'original physical soil tile size required');
  fail(material.normalScale.x===.5&&material.normalScale.y===.5&&material.roughness===1&&material.aoMapIntensity===.3,'original soil PBR settings required');
  for(const slot of slots){
    const t=material[slot],r=courtSoilManifestR1.files[slot];
    fail(t?.isTexture&&t.image?.width===r.width&&t.image?.height===r.height,'original 4096-square '+slot+' required');
    fail(t.channel===0&&t.repeat.x===1/tileMetres&&t.repeat.y===t.repeat.x&&t.offset.x===0&&t.offset.y===0&&t.rotation===0&&t.center.x===0&&t.center.y===0&&t.matrixAutoUpdate===true,'aligned original UV transform for '+slot+' required');
    fail(t.anisotropy===16&&t.wrapS===THREE.RepeatWrapping&&t.wrapT===THREE.RepeatWrapping&&t.flipY===false&&t.generateMipmaps&&t.minFilter===THREE.LinearMipmapLinearFilter&&t.magFilter===THREE.LinearFilter&&t.colorSpace===(slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace),'original pixel interpretation and filtering for '+slot+' required');
  }
}

/** Install on an exclusive original soil lease only. No texture, geometry,
 * bitmap, sampler, uniform or GPU allocation is created here. The source lease
 * retains ownership, including signal cancellation and late decode cleanup.
 */
export function attachSoilSampling(lease){
  fail(lease&&lease.disposed===false&&typeof lease.dispose==='function'&&lease.diagnostics?.id===courtSoilManifestR1.id,'original live soil lease required');
  for(const slot of slots)fail(lease.diagnostics.files?.[slot]?.sha256===courtSoilManifestR1.files[slot].sha256,'unreviewed source pixels for '+slot);
  const material=lease.material,tileMetres=lease.diagnostics.tileMetres;
  assertMaps(material,tileMetres);
  fail(!material.userData?.soilSampling,'sampling already installed');
  const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  let disposed=false,released=false;
  const compile=function(shader,renderer){
    fail(!disposed&&!lease.disposed,'sampling lease already released');
    assertMaps(this,tileMetres);
    previousCompile.call(this,shader,renderer);
    assertMaps(this,tileMetres);
    shader.fragmentShader=patchSoilShader(shader.fragmentShader);
  };
  const cacheKey=function(){return previousKey.call(this)+'|'+String(previousCompile)+'|'+samplingSpec.id;};
  function detach(){
    if(disposed)return;disposed=true;material.removeEventListener('dispose',detach);
    if(material.onBeforeCompile===compile)material.onBeforeCompile=previousCompile;
    if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=previousKey;
    if(material.userData.soilSampling===samplingSpec)delete material.userData.soilSampling;
    material.needsUpdate=true;
  }
  material.onBeforeCompile=compile;material.customProgramCacheKey=cacheKey;
  material.userData.soilSampling=samplingSpec;material.needsUpdate=true;
  material.addEventListener('dispose',detach);
  return {material,detach,get attached(){return !disposed&&!lease.disposed;},diagnostics:Object.freeze({...lease.diagnostics,sampling:samplingSpec}),
    dispose(){if(released)return;released=true;const errors=[];try{detach();}catch(error){errors.push(error);}try{lease.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Soil sampling release failed');},
    get disposed(){return lease.disposed;},get cleanupErrors(){return lease.cleanupErrors;}};
}

export async function loadSamplingSoilMaterial(options={}){
  const lease=await loadCourtSoilMaterial(options);
  try{return attachSoilSampling(lease);}catch(error){
    try{lease.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Soil sampling preparation and cleanup failed',{cause:error});}
    throw error;
  }
}
