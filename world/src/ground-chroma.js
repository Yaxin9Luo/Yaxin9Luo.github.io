// Region-limited source colour, accepted in the matched R9 day/night review.
// Keep terrain luminance, normal detail, textures and blend weights unchanged.
export const GROUND_CHROMA_DEFAULT=.5;
const anchor='diffuseColor.rgb=mix(soilBase,mix(continuousSoil(rockMap,soilUv).rgb,vec3(dot(continuousSoil(rockMap,soilUv).rgb,meadowLuminanceWeights))*vec3(1.12,1.12,1.04),.60)*diffuse,mossWeight);';
export const GROUND_CHROMA_MASKS=Object.freeze([
  Object.freeze({id:'west-community',center:Object.freeze([-17,67]),radii:Object.freeze([15,11])}),
  Object.freeze({id:'east-community',center:Object.freeze([61,17]),radii:Object.freeze([14,12])}),
]);
const declarations=`uniform float groundStudyStrength;
  float groundStudyRegion(vec2 position){
    float west=1.-smoothstep(.70,1.,length((position-vec2(-17.,67.))/vec2(15.,11.)));
    float east=1.-smoothstep(.70,1.,length((position-vec2(61.,17.))/vec2(14.,12.)));
    return max(west,east);
  }
`;
const trial=`
  // This branch is uniform across fragments: continuousSoil keeps valid screen
  // derivatives. Do not move its sampling into the per-fragment region mask.
  if(groundStudyStrength>0.){
    vec3 sourceMeadow=diffuse;
    #ifdef USE_MAP
      sourceMeadow*=continuousSoil(map,soilUv).rgb;
    #endif
    vec3 sourceSoil=mix(sourceMeadow,continuousSoil(humusMap,soilUv).rgb*diffuse*.79,humusWeight);
    sourceSoil=mix(sourceSoil,continuousSoil(rockMap,soilUv).rgb*diffuse,mossWeight);
    float sourceLuminance=dot(sourceSoil,meadowLuminanceWeights);
    if(sourceLuminance>1e-6){
      vec3 matchedSource=sourceSoil*dot(diffuseColor.rgb,meadowLuminanceWeights)/sourceLuminance;
      diffuseColor.rgb=mix(diffuseColor.rgb,matchedSource,groundStudyStrength*groundStudyRegion(terrainPosition.xz));
    }
  }
`;
export function applyGroundChroma(shader,strength={value:GROUND_CHROMA_DEFAULT}){
  if(shader.fragmentShader.split(anchor).length!==2)throw new Error('Ground chroma does not match the current terrain shader');
  shader.uniforms.groundStudyStrength=strength;
  shader.fragmentShader=declarations+shader.fragmentShader.replace(anchor,anchor+trial);
}
