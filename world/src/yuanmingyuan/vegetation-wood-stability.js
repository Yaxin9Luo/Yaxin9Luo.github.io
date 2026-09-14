import { ShaderChunk } from 'three';

const installed = new WeakMap();
const check = (condition, message) => { if (!condition) throw new Error('Vegetation wood stability: ' + message); };
const replaceOnce = (source, marker, replacement) => {
  check(source.split(marker).length === 2, 'expected one shader marker ' + marker);
  return source.replace(marker, replacement);
};

// Preserve r185 height sampling and its ordinary bump response. Only undefined
// derivative/normal cases use the unperturbed normal; valid tiny slopes remain.
const originalPerturb=`	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}`;

const guardedPerturb=`/* willow-bark-bump-guard-r1 */
\tbool willowBumpFinite3( vec3 value ) {
\t\treturn ! any( isnan( value ) ) && ! any( isinf( value ) );
\t}

\tbool willowBumpUnit( vec3 value, out vec3 unitValue ) {
\t\tif ( ! willowBumpFinite3( value ) ) return false;
\t\tfloat largest = max( max( abs( value.x ), abs( value.y ) ), abs( value.z ) );
\t\tif ( largest == 0.0 ) return false;
\t\t// One component now has absolute value 1; dot is in [1,3].
\t\t// No arbitrary epsilon discards valid small derivatives or shallow relief.
\t\tvec3 scaled = value / largest;
\t\tunitValue = scaled * inversesqrt( dot( scaled, scaled ) );
\t\treturn willowBumpFinite3( unitValue );
\t}

\tvec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
\t\t// Evaluate both original derivatives before any non-uniform guard branch.
\t\tvec3 rawSigmaX = dFdx( surf_pos.xyz );
\t\tvec3 rawSigmaY = dFdy( surf_pos.xyz );
\t\tvec3 vSigmaX, vSigmaY;
\t\tif ( ! willowBumpUnit( rawSigmaX, vSigmaX ) ) return surf_norm;
\t\tif ( ! willowBumpUnit( rawSigmaY, vSigmaY ) ) return surf_norm;
\t\tif ( any( isnan( dHdxy ) ) || any( isinf( dHdxy ) ) ) return surf_norm;

\t\tvec3 R1 = cross( vSigmaY, surf_norm );
\t\tvec3 R2 = cross( surf_norm, vSigmaX );
\t\tfloat fDet = dot( vSigmaX, R1 ) * faceDirection;
\t\tif ( isnan( fDet ) || isinf( fDet ) || fDet == 0.0 ) return surf_norm;
\t\tvec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
\t\tvec3 perturbed = abs( fDet ) * surf_norm - vGrad;
\t\tvec3 unitPerturbed;
\t\tif ( ! willowBumpUnit( perturbed, unitPerturbed ) ) return surf_norm;
\t\treturn unitPerturbed;
\t}`;


const bumpChunk = replaceOnce(ShaderChunk.bumpmap_pars_fragment, originalPerturb, guardedPerturb);
const colorChunk = `/* vegetation-wood-stability-r1:rgb01 */
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  diffuseColor.rgb *= clamp( vColor.rgb, vec3( 0.0 ), vec3( 1.0 ) );
  diffuseColor.a *= vColor.a;
#endif`;

/** Bound authored wood RGB before lighting; preserve alpha and the rest of PBR. */
export function patchVegetationWoodShader(shader, { bump = false } = {}) {
  check(typeof shader.vertexShader === 'string' && typeof shader.fragmentShader === 'string', 'shader source required');
  let fragment = replaceOnce(shader.fragmentShader, '#include <color_fragment>', colorChunk);
  if (bump) fragment = replaceOnce(fragment, '#include <bumpmap_pars_fragment>', bumpChunk);
  shader.fragmentShader = fragment;
  return shader;
}

/** Install once on the builder's two wood materials, for their existing lifetime. */
export function installVegetationWoodStability({ bark, stem }) {
  const wood = [[bark, true, 'yuanming-living-grey-brown-bark'], [stem, false, 'yuanming-petioles-and-twigs']];
  for (const [material, bump, name] of wood) {
    check(material?.isMeshStandardMaterial && !material.isMeshPhysicalMaterial && material.name === name && material.vertexColors === true, 'expected builder wood material ' + name);
    check(!material.normalMap && !material.transparent && Boolean(material.bumpMap) === bump, 'expected opaque wood and original bump-map scope');
    check(!installed.has(material) || installed.get(material) === bump, 'wood role changed');
  }
  for (const [material, bump] of wood) {
    if (installed.has(material)) continue;
    const beforeCompile = material.onBeforeCompile, beforeKey = material.customProgramCacheKey;
    material.onBeforeCompile = function(shader, renderer) {
      beforeCompile.call(this, shader, renderer);
      patchVegetationWoodShader(shader, { bump });
    };
    material.customProgramCacheKey = function() {
      return beforeKey.call(this) + '|vegetation-wood-stability-r1:' + (bump ? 'rgb01+bump' : 'rgb01');
    };
    material.needsUpdate = true;
    installed.set(material, bump);
  }
}
