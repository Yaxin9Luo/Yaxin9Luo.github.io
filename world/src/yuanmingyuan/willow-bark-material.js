import {MeshStandardMaterial,ShaderChunk,Vector3} from 'three';
import {patchVegetationWoodShader} from './vegetation-wood-stability.js';

export const willowBarkMaterialId='willow-bark-material-r2';
// An authored grey-brown response, not a calibrated measurement of species reflectance.
// Texture upload already decodes the original sRGB diffuse into working linear RGB.
export const willowBarkResponseSpec=Object.freeze({
 id:'willow-grey-brown-response-r2',workingSpace:'linear-sRGB',chromaRetention:.70,midGain:2.1,
 blackPreserved:true,whitePreserved:true,sourcePixelEdits:false,measuredReflectance:false,
 bumpScaleParameter:.018,roughnessSourceUnchanged:true,
});
export function willowBarkLinearResponse(rgb){
 if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(x=>!Number.isFinite(x)||x<0||x>1))throw new Error('Normalized linear RGB required.');
 const y=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return rgb.map(x=>{const c=y+(x-y)*willowBarkResponseSpec.chromaRetention;return willowBarkResponseSpec.midGain*c/(1+(willowBarkResponseSpec.midGain-1)*c);});
}
const responseGLSL=`
vec3 willowBarkLinearResponse(vec3 sourceAlbedo){
 float y=dot(sourceAlbedo,vec3(0.2126,0.7152,0.0722));
 vec3 greyBrown=mix(vec3(y),sourceAlbedo,${willowBarkResponseSpec.chromaRetention.toFixed(8)});
 return ${willowBarkResponseSpec.midGain.toFixed(8)}*greyBrown/(vec3(1.0)+${(willowBarkResponseSpec.midGain-1).toFixed(8)}*greyBrown);
}
`;
const once=(text,old,next)=>{if(text.split(old).length!==2)throw new Error('Willow bark shader marker changed: '+old.slice(0,72));return text.replace(old,next);};
export const willowBarkSamplingGLSL=`
centroid varying vec3 vWillowBarkChart;
// All channels and forward differences use identical charts. Gradients are
// supplied before branching. A chart's jumps occur only at zero chart weight.
vec4 willowBarkSample(sampler2D sourceMap,vec3 chart,vec3 dx,vec3 dy){
 if(chart.z<=0.0)return textureGrad(sourceMap,chart.xy,dx.xy,dy.xy);
 float winding=floor(chart.x/chart.z);
 float u=chart.x-winding*chart.z;
 float f=u/chart.z;
 float shift=(f<0.5?0.5:-0.5)-winding;
 vec2 a=vec2(u,chart.y),b=vec2(chart.x+shift*chart.z,chart.y);
 float weightA=smoothstep(0.08,0.22,min(f,1.0-f));
 vec4 first=textureGrad(sourceMap,a,dx.xy-vec2(winding*dx.z,0.0),dy.xy-vec2(winding*dy.z,0.0));
 vec4 second=textureGrad(sourceMap,b,dx.xy+vec2(shift*dx.z,0.0),dy.xy+vec2(shift*dy.z,0.0));
 return mix(second,first,weightA);
}
`;
const forwardHeight=`
 vec2 dHdxy_fwd(){
  vec3 dx=dFdx(vWillowBarkChart),dy=dFdy(vWillowBarkChart);
  float h=willowBarkSample(bumpMap,vWillowBarkChart,dx,dy).r;
  float hx=willowBarkSample(bumpMap,vWillowBarkChart+dx,dx,dy).r;
  float hy=willowBarkSample(bumpMap,vWillowBarkChart+dy,dx,dy).r;
  return bumpScale*vec2(hx-h,hy-h);
 }
`;
export function patchWillowBarkShader(shader){
 patchVegetationWoodShader(shader,{bump:true});
 shader.vertexShader=once(shader.vertexShader,'#include <common>','#include <common>\nattribute float willowBarkCircumference;\ncentroid varying vec3 vWillowBarkChart;');
 shader.vertexShader=once(shader.vertexShader,'#include <uv_vertex>','#include <uv_vertex>\nvWillowBarkChart=vec3(uv,willowBarkCircumference);');
 shader.fragmentShader=once(shader.fragmentShader,'#include <common>','#include <common>\n'+willowBarkSamplingGLSL+responseGLSL);
 const originalForward=ShaderChunk.bumpmap_pars_fragment.match(/\bvec2 dHdxy_fwd\(\)\s*\{[\s\S]*?\n\s*\}/)?.[0];
 if(!originalForward)throw new Error('Three height derivative body changed.');
 shader.fragmentShader=once(shader.fragmentShader,originalForward,forwardHeight);
 const mapChunk=once(ShaderChunk.map_fragment,'texture2D( map, vMapUv )',
  'willowBarkSample( map, vWillowBarkChart, dFdx(vWillowBarkChart), dFdy(vWillowBarkChart) )');
 // Keep black fissures and a bounded highlight shoulder. This acts on sampled
 // diffuse before material multiplication and before Three's lighting chunks.
 shader.fragmentShader=once(shader.fragmentShader,'#include <map_fragment>',once(mapChunk,
  'diffuseColor *= sampledDiffuseColor;',
  'sampledDiffuseColor.rgb = willowBarkLinearResponse(sampledDiffuseColor.rgb);\n\tdiffuseColor *= sampledDiffuseColor;'));
 shader.fragmentShader=once(shader.fragmentShader,'#include <roughnessmap_fragment>',ShaderChunk.roughnessmap_fragment.replace(
  'texture2D( roughnessMap, vRoughnessMapUv )','willowBarkSample( roughnessMap, vWillowBarkChart, dFdx(vWillowBarkChart), dFdy(vWillowBarkChart) )'));
 if(!shader.fragmentShader.includes('/* willow-bark-bump-guard-r1 */')||!shader.fragmentShader.includes('clamp( vColor.rgb'))throw new Error('Original wood safeguards were lost.');
 return shader;
}
export function createWillowBarkMaterialLease(group,maps){
 if(!group?.isObject3D||!maps?.map?.isTexture||!maps.roughnessMap?.isTexture||!maps.bumpMap?.isTexture||maps.disposed)throw new Error('Complete owned willow PBR maps required.');
 const names=new Set(['willow-trunk-and-roots','willow-primary-and-secondary-boughs']),bindings=[];
 group.traverse(mesh=>{if(mesh.isMesh&&names.has(mesh.name))bindings.push({mesh,original:mesh.material});});
 if(bindings.length!==2||new Set(bindings.map(x=>x.mesh.name)).size!==2||bindings.some(({mesh,original})=>!mesh.geometry.attributes.willowBarkCircumference||original?.name!=='yuanming-living-grey-brown-bark'))throw new Error('Expected exactly the two original willow wood batches and metric charts.');
 const material=new MeshStandardMaterial({name:'yuanming-living-grey-brown-bark',color:0xffffff,vertexColors:true,
  map:maps.map,roughnessMap:maps.roughnessMap,bumpMap:maps.bumpMap,bumpScale:.018,roughness:1,metalness:0});
 material.userData={willowBarkRevision:willowBarkMaterialId,source:'polyhaven:bark_willow',tileMetres:1,normalMapUsed:false,
  bumpScaleParameter:.018,colorResponse:willowBarkResponseSpec,geometryMaximumOffsetMetres:.008,measuredAbsoluteDepth:false,sourcePixelEdits:false,
   metricSpace:'source-object-metres',worldMetricScale:'positive uniform matrixWorld scale; texture tile and baked geometric relief scale together'};
 material.onBeforeCompile=shader=>patchWillowBarkShader(shader);
 material.customProgramCacheKey=()=>willowBarkMaterialId+'|metric-dual-chart-r1|vegetation-wood-stability-r1:rgb01+bump';
 const axes=[new Vector3(),new Vector3(),new Vector3()],cross=new Vector3();
 material.onBeforeRender=(_renderer,_scene,_camera,geometry,object)=>{
  if(!geometry.attributes.willowBarkCircumference)throw new Error('Willow draw lost the physical chart attribute.');
  if(!_renderer.extensions.has('OES_texture_float_linear'))throw new Error('Full precision willow height requires OES_texture_float_linear.');
  // The UVs and root charts also generated the baked relief vertices. Keep
  // their source coordinates together: world tile/relief lengths scale with
  // the whole tree. Retiling only the shader would detach color from grooves.
  // The unchanged normalMatrix and bump response retain the original PBR path.
  const e=object.matrixWorld.elements;
  if(e.some(value=>!Number.isFinite(value))||e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1||object.isInstancedMesh||object.isBatchedMesh)
   throw new Error('Willow physical bark requires a finite affine Mesh world frame.');
  const scales=axes.map((axis,c)=>{axis.setFromMatrixColumn(object.matrixWorld,c);const s=Math.hypot(axis.x,axis.y,axis.z);if(s>0&&Number.isFinite(s))axis.multiplyScalar(1/s);return s;});
  const scale=scales[0];
  if(!(scale>0)||!Number.isFinite(scale)||!(Math.fround(scale)>0)||!Number.isFinite(Math.fround(scale))||!Number.isFinite(Math.fround(1/scale))||
   scales.some(s=>!(s>0)||!Number.isFinite(s)||Math.abs(s/scale-1)>1e-8)||
   Math.abs(axes[0].dot(axes[1]))>1e-8||Math.abs(axes[0].dot(axes[2]))>1e-8||Math.abs(axes[1].dot(axes[2]))>1e-8||
   cross.crossVectors(axes[0],axes[1]).dot(axes[2])<=0)
   throw new Error('Willow physical bark requires positive uniform world scale without shear or reflection.');
  if(material.normalMap||maps.disposed)throw new Error('Willow bark source/render contract changed.');
  for(const texture of [maps.map,maps.roughnessMap,maps.bumpMap])if(texture.repeat.x!==1||texture.repeat.y!==1||texture.offset.lengthSq()||texture.rotation||texture.channel!==0)throw new Error('Willow source textures must retain identity transforms.');
 };
 try{for(const {mesh}of bindings)mesh.material=material;}
 catch(error){
  const cleanup=[];for(const {mesh,original}of bindings)if(mesh.material===material)try{mesh.material=original;}catch(e){cleanup.push(e);}
  try{material.dispose();}catch(e){cleanup.push(e);}
  if(cleanup.length)throw new AggregateError([error,...cleanup],'Willow material binding and rollback failed.',{cause:error});throw error;
 }
 let disposed=false;
 return {material,bindings,get disposed(){return disposed;},dispose(){
  if(disposed)return;disposed=true;const errors=[];
  for(const {mesh,original}of bindings){if(mesh.material===material)mesh.material=original;else errors.push(new Error('Willow material borrower rebound before release.'));}
  try{material.dispose();}catch(e){errors.push(e);}
  if(errors.length)throw new AggregateError(errors,'Willow bark material release failed.');
 }};
}
export function willowBarkProgramAudit(renderer){
 const gl=renderer.getContext();
 return (renderer.info.programs??[]).filter(p=>p.cacheKey.includes(willowBarkMaterialId)).map(p=>{
  const fragment=gl.getShaderSource(p.fragmentShader),vertex=gl.getShaderSource(p.vertexShader);
  const uniforms=[];for(let i=0;i<gl.getProgramParameter(p.program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(p.program,i);if(['map','roughnessMap','bumpMap'].includes(u.name))uniforms.push({name:u.name,unit:gl.getUniform(p.program,gl.getUniformLocation(p.program,u.name))});}
  return {id:p.id,linked:!!gl.getProgramParameter(p.program,gl.LINK_STATUS),activeChannels:uniforms,
   rawSource:'gl.getShaderSource',metricAttribute:vertex.includes('vWillowBarkChart=vec3(uv,willowBarkCircumference)'),
   colorPath:fragment.includes('willowBarkSample( map, vWillowBarkChart'),roughnessPath:fragment.includes('willowBarkSample( roughnessMap, vWillowBarkChart'),
   bumpForwardPath:fragment.includes('willowBarkSample(bumpMap,vWillowBarkChart+dx,dx,dy)'),gradients:fragment.includes('textureGrad(sourceMap,b,dx.xy+vec2(shift*dx.z,0.0)'),
   guardedNormal:fragment.includes('/* willow-bark-bump-guard-r1 */'),boundedColor:fragment.includes('clamp( vColor.rgb'),
   centroidColor:/centroid (?:varying|in) vec4 vColor/.test(fragment),centroidNormal:/centroid (?:varying|in) vec3 vNormal/.test(fragment),
   linearResponse:fragment.includes('sampledDiffuseColor.rgb = willowBarkLinearResponse(sampledDiffuseColor.rgb)'),
   responseBeforeDiffuse:fragment.indexOf('sampledDiffuseColor.rgb = willowBarkLinearResponse(sampledDiffuseColor.rgb)')>=0&&fragment.indexOf('sampledDiffuseColor.rgb = willowBarkLinearResponse(sampledDiffuseColor.rgb)')<fragment.indexOf('diffuseColor *= sampledDiffuseColor;'),
   responseBeforeLighting:fragment.indexOf('sampledDiffuseColor.rgb = willowBarkLinearResponse(sampledDiffuseColor.rgb)')>=0&&fragment.indexOf('sampledDiffuseColor.rgb = willowBarkLinearResponse(sampledDiffuseColor.rgb)')<fragment.indexOf('material.diffuseColor = diffuseColor.rgb'),
   normalMapAbsent:!fragment.includes('#define USE_NORMALMAP'),floatHeightLinear:renderer.extensions.has('OES_texture_float_linear')};
 });
}
