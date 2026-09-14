import { ShaderChunk } from 'three';

export const WILLOW_SAMPLING_MODES = Object.freeze(['pixel', 'centroid-color', 'centroid']);
const states = new WeakMap(), shaderAudits = new WeakMap();
const check = mode => { if (!WILLOW_SAMPLING_MODES.includes(mode)) throw new Error('Unknown willow sampling diagnostic'); };

// GLSL ES 3.00 §§4.3.6/4.3.9: matching centroid out/in declarations constrain
// MSAA interpolation to the covered primitive. Three r185 emits #version 300 es
// and maps varying to out/in. This is a study-only switch; no source asset,
// light, albedo, roughness, sample count or gl_FragCoord fade mask is changed.
export function patchWillowSamplingShader(shader, mode) {
  check(mode); if (mode === 'pixel') return shader;
  const names = mode === 'centroid-color' ? 'vColor' : 'vColor|vNormal|vTangent|vBitangent';
  const qualify = code => code.replace(new RegExp(`\\bvarying\\s+(vec[234])\\s+(${names})\\s*;`, 'g'), 'centroid varying $1 $2;');
  for (const stage of ['vertexShader', 'fragmentShader']) {
    shader[stage] = shader[stage].replace(/#include <(color_pars_vertex|color_pars_fragment|normal_pars_vertex|normal_pars_fragment)>/g, (_token, name) => qualify(ShaderChunk[name]));
  }
  return shader;
}

export function setWillowSampling(material, mode) {
  check(mode); let state = states.get(material);
  if (!state) {
    state = { mode: null }; states.set(material, state);
    const before = material.onBeforeCompile, cacheKey = material.customProgramCacheKey;
    material.onBeforeCompile = function(shader, renderer) { before.call(this, shader, renderer); patchWillowSamplingShader(shader, state.mode); };
    material.customProgramCacheKey = function() { return `${cacheKey.call(this)}|willow-centroid-diagnostic-v1:${state.mode}`; };
  }
  if (state.mode !== mode) { state.mode = mode; material.needsUpdate = true; }
  return material;
}

// Capture actual linked-program declarations through the public WebGL API.
// This runs only in the native page; CPU shader-template tests cannot claim it.
export function willowSamplingProgramAudit(renderer) {
  const gl = renderer.getContext();
  return (renderer.info.programs ?? []).filter(program => program.cacheKey.includes('willow-centroid-diagnostic-v1:')).map(program => {
    if (shaderAudits.has(program)) return shaderAudits.get(program);
    if (!program.program || !gl.isShader(program.vertexShader) || !gl.isShader(program.fragmentShader)) return { id: program.id, available: false };
    const vertex = gl.getShaderSource(program.vertexShader), fragment = gl.getShaderSource(program.fragmentShader);
    const declarations = text => text.split('\n').filter(line => /\b(?:varying|in|out)\s+vec[234]\s+v(?:Color|Normal|Tangent|Bitangent)\b/.test(line)).map(line => line.trim());
    const audit = { id: program.id, name: program.name, mode: program.cacheKey.match(/willow-centroid-diagnostic-v1:([a-z-]+)/)?.[1], available: true, capturedFrom: 'WebGL getShaderSource / getProgramParameter', linked: Boolean(gl.getProgramParameter(program.program, gl.LINK_STATUS)), vertexVersion: vertex.split('\n')[0], fragmentVersion: fragment.split('\n')[0], vertexVaryingMapsToOut: vertex.includes('#define varying out'), fragmentVaryingMapsToIn: fragment.includes('#define varying in'), vertexDeclarations: declarations(vertex), fragmentDeclarations: declarations(fragment) };
    shaderAudits.set(program, audit); return audit;
  });
}
