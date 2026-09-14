import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {applyGardenGroundTextures} from '../src/yuanmingyuan/ground-textures.js';
import {configureGroundSampling,groundSamplingOrigin} from '../src/yuanmingyuan/ground-sampling-studio.js';

// Execute the actual preserved R1 hook in Node, with only import URLs rebased.
// This checks the full generated shader, not a reimplementation of the hook.
const baseline=await readFile(new URL('../../work/yuanmingyuan/ground-sampling-studio-r2/baseline/ground-textures.js',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(baseline).digest('hex'),'f84e04fc9c94f92a331c7c8999c658ee00f94bc3cc672da4d2c7df2168f12e74');
const originalURL=new URL('../src/yuanmingyuan/ground-textures.js',import.meta.url);
const imported=baseline.replace(/from '([^']+)'/g,(_,specifier)=>`from '${specifier==='three'?import.meta.resolve('three'):new URL(specifier,originalURL).href}'`);
const {applyGardenGroundTextures:applyBaseline}=await import('data:text/javascript,'+encodeURIComponent(imported));
const channels=[['map','vMapUv'],['normalMap','vNormalMapUv'],['roughnessMap','vRoughnessMapUv']];
const modes=['main','caller-gradients','implicit-blend','stock-lookup','stock-grad'];
function fixture(run){
  const maps=Object.fromEntries(channels.map(([slot])=>[slot,new THREE.Texture()])),material=new THREE.MeshStandardMaterial({vertexColors:true});
  try{return run(material,maps);}finally{material.dispose();Object.values(maps).forEach(texture=>texture.dispose());}
}
function compile(material){const shader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader,vertexShader:THREE.ShaderLib.standard.vertexShader};material.onBeforeCompile(shader);return shader;}

test('explicit main retains the entire frozen R1 shader and program key for review',()=>fixture((material,maps)=>{
  applyBaseline(material,maps);const shader=compile(material),key=material.customProgramCacheKey();
  applyGardenGroundTextures(material,maps,{sampling:'main'});assert.deepEqual(compile(material),shader);assert.equal(material.customProgramCacheKey(),key);
  assert.equal(material.userData.earthSampling,'main');
}));

test('production default is stock lookup with the same complete shader and cache identity as its explicit mode',()=>fixture((material,maps)=>{
  applyGardenGroundTextures(material,maps,{sampling:'stock-lookup'});const expected=compile(material),key=material.customProgramCacheKey();
  applyGardenGroundTextures(material,maps);assert.deepEqual(compile(material),expected);assert.equal(material.customProgramCacheKey(),key);
  assert.equal(material.userData.earthSampling,'stock-lookup');assert(!expected.fragmentShader.includes('gardenSample'));assert(!expected.fragmentShader.includes('gardenOffset'));
  assert(expected.fragmentShader.includes('diffuseColor.rgb=mix(gardenBase,diffuseColor.rgb*1.8,.52)'));assert(expected.fragmentShader.includes('roughnessFactor *= mix(.9,1.,texelRoughness.g);'));
}));

test('caller-gradients moves only each unshifted varying derivative across the function call',()=>fixture((material,maps)=>{
  applyBaseline(material,maps);let expected=compile(material).fragmentShader;
  expected=expected.replace('gardenSample(sampler2D map,vec2 uv)','gardenSample(sampler2D map,vec2 uv,vec2 dx,vec2 dy)').replace('  vec2 dx=dFdx(uv),dy=dFdy(uv);\n','');
  for(const [slot,uv] of channels)expected=expected.replaceAll(`gardenSample( ${slot}, ${uv} )`,`gardenSample( ${slot}, ${uv}, dFdx(${uv}), dFdy(${uv}) )`);
  applyGardenGroundTextures(material,maps,{sampling:'caller-gradients'});assert.equal(compile(material).fragmentShader,expected);
  assert.equal((expected.match(/textureGrad\(map/g)||[]).length,3);
  assert(!expected.slice(0,expected.indexOf('#define STANDARD')).includes('dFdx'));
}));

test('implicit-blend changes only its three texture query operations, keeping offsets and weights exact',()=>fixture((material,maps)=>{
  applyBaseline(material,maps);let expected=compile(material).fragmentShader;
  for(const corner of ['a','b','c'])expected=expected.replace(`textureGrad(map,uv+gardenOffset(${corner}),dx,dy)`,`texture2D(map,uv+gardenOffset(${corner}))`);
  applyGardenGroundTextures(material,maps,{sampling:'implicit-blend'});assert.equal(compile(material).fragmentShader,expected);
}));

test('single stock implicit and explicit queries differ only in their gradient arguments, with no unused blend function',()=>fixture((material,maps)=>{
  applyGardenGroundTextures(material,maps,{sampling:'stock-lookup'});let expected=compile(material).fragmentShader;
  assert(!expected.includes('gardenSample'));assert(!expected.includes('gardenOffset'));assert(expected.includes('diffuseColor.rgb=mix(gardenBase,diffuseColor.rgb*1.8,.52)'));
  for(const [slot,uv] of channels)expected=expected.replaceAll(`texture2D( ${slot}, ${uv} )`,`textureGrad( ${slot}, ${uv}, dFdx(${uv}), dFdy(${uv}) )`);
  applyGardenGroundTextures(material,maps,{sampling:'stock-grad'});assert.equal(compile(material).fragmentShader,expected);
}));

test('all candidates retain texture ownership, colour/PBR scale, distinct cache identities and reversible switches',()=>fixture((material,maps)=>{
  const keys=new Set(),versions=Object.values(maps).map(texture=>texture.version);
  for(const sampling of modes){applyGardenGroundTextures(material,maps,{sampling});keys.add(material.customProgramCacheKey());
    for(const [slot]of channels)assert.equal(material[slot],maps[slot]);
    assert.equal(material.roughness,.98);assert.equal(material.metalness,0);assert.equal(material.vertexColors,true);assert.deepEqual(material.normalScale.toArray(),[.42,.42]);
    assert(compile(material).fragmentShader.includes('roughnessFactor *= mix(.9,1.,texelRoughness.g);'));
  }
  assert.equal(keys.size,modes.length);assert.deepEqual(Object.values(maps).map(texture=>texture.version),versions);
  const before=material.onBeforeCompile;assert.throws(()=>applyGardenGroundTextures(material,maps,{sampling:'unverified-typo'}),/Unknown garden/);assert.equal(material.onBeforeCompile,before);
  applyGardenGroundTextures(material,maps);const reset=compile(material);applyGardenGroundTextures(material,maps,{sampling:'stock-lookup'});assert.deepEqual(reset,compile(material));
}));

test('studio candidates preserve global cell keys under local UV and report the implicit boundary limitation',()=>fixture((material,maps)=>{
  for(const sampling of ['caller-gradients','implicit-blend','stock-grad'])for(const uv of ['world','local']){
    configureGroundSampling(material,maps,{sampling,uv});const shader=compile(material),hasBlend=sampling!=='stock-grad';
    assert.deepEqual(material.map.repeat.toArray(),[5/6,5/6]);assert.equal(material.userData.groundSampling.offsetsAndWeightsPreserved,hasBlend);
    assert.equal(material.userData.groundSampling.implicitCellBoundaryRisk,sampling==='implicit-blend');
    if(uv==='local'&&hasBlend){assert.deepEqual(shader.uniforms.gardenCellOrigin.value.toArray(),groundSamplingOrigin().cells);for(const corner of ['a','b','c'])assert(shader.fragmentShader.includes(`gardenOffset(${corner}+gardenCellOrigin)`));}
    else assert(!shader.uniforms.gardenCellOrigin);
  }
}));

test('new modes have visible controls and capture identifies the current linked GL program',async()=>{
  const html=await readFile(new URL('../ground-sampling-studio.html',import.meta.url),'utf8'),js=await readFile(new URL('../src/yuanmingyuan/ground-sampling-studio.js',import.meta.url),'utf8');
  for(const mode of modes)assert(html.includes(`value="${mode}"`));
  assert(js.includes('gl.getParameter(gl.CURRENT_PROGRAM)'));assert(js.includes('currentProgramId:'));
  assert(js.includes('gl.getShaderSource(program.fragmentShader)'));assert(!js.includes('WEBGL_debug_shaders'));assert(!js.includes('getTranslatedShaderSource'));
  assert(!js.includes('gl.getError('),'the review page must not drain real GL errors to make later captures pass');
});
