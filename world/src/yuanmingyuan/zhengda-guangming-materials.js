import * as THREE from 'three';
import {createFuhaiCaihuaTexture} from './fuhai-paintwork.js';
import {createZhengdaGuangmingPlaqueTexture} from './zhengda-guangming-plaque.js';

// Scalar PBR technique derives from the admitted Jiuzhou R3 clay finish.
// The palette, surface owners and building assembled here are ZhengdaGuangming's.
// No archive pixel, Jiuzhou material identity or original building is reused.
function createMicrostructure(clay = false) {
  const size = 512, data = new Uint8Array(size * size * 4);
  const hash = (x, y, seed) => {
    let h = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 3, 668265263);
    h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295;
  };
  const noise = (u, v, cells, seed) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    let a = x - ix, c = y - iy; a = a * a * (3 - 2 * a); c = c * c * (3 - 2 * c);
    const h = (dx, dy) => hash((ix + dx) % cells, (iy + dy) % cells, seed);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(0, 0), h(1, 0), a), THREE.MathUtils.lerp(h(0, 1), h(1, 1), a), c);
  };
  const encode = x => Math.round(255 * THREE.MathUtils.clamp(x, 0, 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size, i = 4 * (y * size + x);
    const fine = noise(u, v, 128, 31), mid = noise(u, v, clay ? 48 : 43, 89), broad = noise(u, v, clay ? 12 : 11, 173);
    data[i] = encode(.5 + .38 * (fine - .5) + .32 * (mid - .5) + .12 * (broad - .5));
    data[i + 1] = encode(.5 + .62 * (broad - .5) + .25 * (mid - .5));
    data[i + 2] = encode(.5 + .50 * (broad - .5) + .25 * (mid - .5)); data[i + 3] = 255;
    if (clay) {
      // Centimetre firing clouds carry albedo; fine relief remains a separate
      // channel. A periodic soft warp breaks the value-noise lattice without
      // adding grout, dirt marks, extra geometry or higher-frequency speckles.
      const warpU = .12 * (noise(u, v, 6, 431) - .5);
      const warpV = .12 * (noise(u, v, 6, 577) - .5);
      const smoke = noise(u + 2 + warpU, v + 2 + warpV, 6, 173);
      const firing = .55 * smoke + .30 * noise(u + 2 + warpV, v + 2 - warpU, 12, 227)
        + .15 * noise(u + 2 - warpU, v + 2 + warpV, 24, 359);
      data[i + 1] = encode(.5 + .60 * (smoke - .5) + .25 * (mid - .5) + .15 * (fine - .5));
      data[i + 2] = encode(.5 + 1.90 * (firing - .5));
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = clay ? 'zhengda-guangming-clay-grain-r3' : 'zhengda-guangming-authored-microfinish-r1'; texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  texture.userData = { provenance: 'original-authored-scalar-microstructure', historicalImage: false, channels: 'R height / G roughness / B slight mineral albedo', sourcePaintPixelsChanged: false };
  return texture;
}

const declaration = /* glsl */`
varying vec3 vDgFinishWorld;
uniform sampler2D dgFinishMap;
uniform vec4 dgFinish; // period in world metres, height in metres, roughness span, mineral albedo span
vec3 dgMicrofinish(vec3 worldPosition, vec3 viewNormal) {
  vec3 axisWeight = pow(abs(inverseTransformDirection(viewNormal, viewMatrix)), vec3(4.0));
  axisWeight /= max(dot(axisWeight, vec3(1.0)), 1e-8);
  vec3 uvw = worldPosition / dgFinish.x;
  vec3 dx = dFdx(uvw), dy = dFdy(uvw);
  return textureGrad(dgFinishMap, uvw.yz, dx.yz, dy.yz).rgb * axisWeight.x
       + textureGrad(dgFinishMap, uvw.zx, dx.zx, dy.zx).rgb * axisWeight.y
       + textureGrad(dgFinishMap, uvw.xy, dx.xy, dy.xy).rgb * axisWeight.z;
}
vec3 dgPhysicalRelief(vec3 viewPosition, vec3 baseNormal, float heightMetres, float faceSign) {
  // Surface-gradient construction. Keep metric derivatives unnormalized:
  // normalizing them makes apparent relief change with camera distance.
  vec3 sx = dFdx(viewPosition), sy = dFdy(viewPosition);
  vec3 r1 = cross(sy, baseNormal), r2 = cross(baseNormal, sx);
  float determinant = dot(sx, r1) * faceSign;
  if (abs(determinant) < 1e-16) return baseNormal;
  vec3 gradient = sign(determinant) * (dFdx(heightMetres) * r1 + dFdy(heightMetres) * r2);
  return normalize(abs(determinant) * baseNormal - gradient);
}
`;
const once = (source, anchor, replacement) => {
  if (source.split(anchor).length !== 2) throw new Error('ZhengdaGuangming surface shader anchor changed: ' + anchor);
  return source.replace(anchor, replacement);
};

const clayVertex = /* glsl */`
varying vec3 vDgClayFiring;
uniform vec3 dgClayOrigin;
uniform mat4 dgClayFrame;
uint dgClayHash(uint value) {
  value ^= value >> 13u;
  value *= 1274126177u;
  return value ^ (value >> 16u);
}
vec3 dgClayFiringAt(vec3 positionMetres) {
  // This 0.1 mm rounding affects only a deterministic colour seed, not geometry.
  ivec3 point = ivec3(floor(positionMetres * 10000.0 + 0.5));
  uint value = uint(point.x) * 374761393u ^ uint(point.y) * 668265263u ^ uint(point.z) * 2246822519u;
  return vec3(float(dgClayHash(value) & 16777215u),
    float(dgClayHash(value ^ 2654435769u) & 16777215u),
    float(dgClayHash(value ^ 2246822507u) & 16777215u)) / 16777215.0;
}
`;

function compileFinish(shader, material, texture, spec, diagnostics, clayFrame) {
  shader.uniforms.dgFinishMap = { value: texture };
  shader.uniforms.dgFinish = { value: new THREE.Vector4(spec.period, spec.relief, spec.roughnessRange, spec.albedoRange) };
  shader.vertexShader = once(shader.vertexShader, '#include <common>', '#include <common>\nvarying vec3 vDgFinishWorld;');
  shader.vertexShader = once(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
  vec4 dgFinishPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    dgFinishPosition = instanceMatrix * dgFinishPosition;
  #endif
  vDgFinishWorld = (modelMatrix * dgFinishPosition).xyz;`);
  if (clayFrame) {
    shader.uniforms.dgClayOrigin = { value: clayFrame.origin.clone() };
    shader.uniforms.dgClayFrame = { value: clayFrame.frame.clone() };
    shader.vertexShader = once(shader.vertexShader, '#include <common>', '#include <common>\n' + clayVertex);
    shader.vertexShader = once(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
    vec4 dgTileCentre = vec4(dgClayOrigin, 1.0);
    #ifdef USE_INSTANCING
      dgTileCentre = instanceMatrix * dgTileCentre;
    #endif
    vDgClayFiring = dgClayFiringAt((dgClayFrame * dgTileCentre).xyz);`);
  }
  shader.fragmentShader = once(shader.fragmentShader, '#include <common>', '#include <common>\n' + declaration + (clayFrame ? '\nvarying vec3 vDgClayFiring;\n' : ''));
  shader.fragmentShader = once(shader.fragmentShader, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec3 dgSurfaceSample = dgMicrofinish(vDgFinishWorld, normal);
  diffuseColor.rgb *= 1.0 + dgFinish.w * (dgSurfaceSample.b - 0.5);
  roughnessFactor = clamp(roughnessFactor + dgFinish.z * (dgSurfaceSample.g - 0.5), 0.04, 1.0);
  normal = dgPhysicalRelief(-vViewPosition, normal, dgFinish.y * (dgSurfaceSample.r - 0.5), faceDirection);`);
  if (clayFrame) {
    // The phase is constant within each true source instance; explicit metric
    // derivatives remain unchanged. Adjacent courses do not share one cloud.
    shader.fragmentShader = once(shader.fragmentShader,
      'dgMicrofinish(vDgFinishWorld, normal)',
      'dgMicrofinish(vDgFinishWorld + 0.48 * vDgClayFiring.yzx, normal)');
    shader.fragmentShader = once(shader.fragmentShader,
      'roughnessFactor = clamp(roughnessFactor + dgFinish.z * (dgSurfaceSample.g - 0.5), 0.04, 1.0);',
      `float dgFiringValue = 1.0 + 0.32 * (vDgClayFiring.x - 0.5);
      float dgFiringWarmth = 0.012 * (vDgClayFiring.y - 0.5);
      diffuseColor.rgb *= dgFiringValue * (vec3(1.0) + dgFiringWarmth * vec3(1.0, 0.12, -1.0));
      roughnessFactor = clamp(roughnessFactor + 0.040 * (vDgClayFiring.z - 0.5)
        + dgFinish.z * (dgSurfaceSample.g - 0.5), 0.86, 0.98);`);
  }
  diagnostics.shaderPreparations++;
  diagnostics.preparedMaterials = [...new Set([...diagnostics.preparedMaterials, material.name])];
}


export function makeZhengdaGuangmingMaterials(owner) {
  const add=(name,category,options)=>{const m=new THREE.MeshStandardMaterial(options);
    m.name='zhengda-guangming-'+name;m.userData={category,provenance:'authored-response-not-measured-historic-pigment'};
    owner.materials.add(m);return m;};
  const clay=createMicrostructure(true),mineral=createMicrostructure(false),paint=createFuhaiCaihuaTexture(),plaque=createZhengdaGuangmingPlaqueTexture();
  for(const t of [clay,mineral,paint,plaque])owner.textures.add(t);
  owner.finishTextures={clay,mineral};
  const m={
    stone:add('dressed-grey-white-stone','stone',{color:0xcfcabd,roughness:.79}),
    carving:add('fine-white-column-bases','stone',{color:0xe4dfd2,roughness:.77}),
    foundation:add('grey-foundation','masonry',{color:0x77766d,roughness:.94}),
    paving:add('grey-brick-paving','masonry',{color:0x85847c,roughness:.92}),
    pavingShade:add('grey-brick-paving-shade','masonry',{color:0x797d7b,roughness:.95}),
    plaster:add('lime-wall-body','plaster',{color:0xdbd1bd,roughness:.93}),
    wallRed:add('red-screen-plaster','plaster',{color:0x964b3b,roughness:.92}),
    red:add('vermilion-posts','timber',{color:0x923e2c,roughness:.57}),
    darkWood:add('recessed-red-wood','timber',{color:0x522f27,roughness:.65}),
    door:add('oil-finished-board-doors','timber',{color:0x873628,roughness:.56}),
    blue:add('mineral-blue','painted-wood',{color:0x365d70,roughness:.73}),
    green:add('mineral-green','painted-wood',{color:0x436557,roughness:.74}),
    pale:add('pale-paint-outlines','painted-wood',{color:0xc3c8b4,roughness:.75}),
    gold:add('muted-gilded-edge','metal',{color:0xb69a5a,metalness:.55,roughness:.52}),
    bronze:add('aged-bronze-censer','metal',{color:0x655d43,metalness:.76,roughness:.54}),
    patina:add('restrained-bronze-patina','metal',{color:0x4b6459,metalness:.60,roughness:.65}),
    iron:add('forged-door-iron','metal',{color:0x3d3630,metalness:.72,roughness:.56}),
    brick:add('fine-gable-grey-brick','masonry',{color:0x797c79,roughness:.94}),
    caihua:add('authored-fangxin-scroll','painted-wood',{color:0xffffff,map:paint,roughness:.71}),
    plaque:add('modern-plaque-transcription','painted-wood',{color:0xffffff,map:plaque,roughness:.69}),
    greyTile:add('neutral-grey-clay','clay-tile',{color:0x757577,roughness:.91}),
    tileShade:add('grey-clay-shade','clay-tile',{color:0x666668,roughness:.92}),
    tileLight:add('grey-clay-light','clay-tile',{color:0x808082,roughness:.90}),
  };
  return m;
}
export function prepareZhengdaGuangmingFinishes(builder,group,diagnostics) {
  group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert();
  const clay=new Set([builder.m.greyTile,builder.m.tileShade,builder.m.tileLight]);
  for(const m of builder.materials)if(!clay.has(m)&&m!==builder.m.plaque&&m!==builder.m.caihua){
    const timber=m.userData.category==='timber';
    const spec={period:timber?.14:.22,relief:timber?.000045:.00018,roughnessRange:timber?.04:.075,albedoRange:timber?0:.035};
    m.onBeforeCompile=shader=>compileFinish(shader,m,builder.finishTextures.mineral,spec,diagnostics);
    m.customProgramCacheKey=()=> 'zhengda-guangming-physical-mineral-r1-'+timber;
  }
  group.traverse(mesh=>{
    if(!mesh.isMesh||!clay.has(mesh.material))return;
    mesh.geometry.computeBoundingBox();
    const frame={origin:mesh.geometry.boundingBox.getCenter(new THREE.Vector3()),frame:inverse.clone().multiply(mesh.matrixWorld)};
    const copy=mesh.material.clone();copy.name=mesh.material.name+'-owned-finish-'+diagnostics.clayBindings++;
    builder.materials.add(copy);mesh.material=copy;
    const spec={period:.48,relief:.0008,roughnessRange:.12,albedoRange:.42};
    copy.onBeforeCompile=shader=>compileFinish(shader,copy,builder.finishTextures.clay,spec,diagnostics,frame);
    copy.customProgramCacheKey=()=> 'zhengda-guangming-neutral-clay-r1';
    copy.userData={...copy.userData,claySeed:'actual-instance-centre-or-real-merged-centre',profileGeometryUnchanged:true};
  });
}
