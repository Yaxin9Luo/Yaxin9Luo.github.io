import {createWillowBarkMaterialLease,patchWillowBarkShader} from './willow-bark-material.js';

export const willowRootMaterialId='willow-root-metric-charts-r4';
const once=(source,before,after)=>{if(source.split(before).length!==2)throw new Error('Willow root shader anchor changed: '+before.slice(0,70));return source.replace(before,after);};
const rootSampler=`
centroid varying vec3 vWillowRootChart;
vec4 willowBarkSample(sampler2D sourceMap,vec3 chart,vec3 dx,vec3 dy,vec3 rootChart,vec3 rootDx,vec3 rootDy){
 vec4 base=willowBarkBaseSample(sourceMap,chart,dx,dy);
 if(rootChart.z<=0.0)return base;
 vec4 root=textureGrad(sourceMap,rootChart.xy,rootDx.xy,rootDy.xy);
 return mix(base,root,clamp(rootChart.z,0.0,1.0));
}
`;
/** Coordinate mapping only. Original R2 sampled RGB response, roughness, finite
 * bump safeguard, 4K source maps and identity transforms remain unchanged. */
export function patchWillowRootShader(shader){
 patchWillowBarkShader(shader);
 shader.vertexShader=once(shader.vertexShader,'centroid varying vec3 vWillowBarkChart;','centroid varying vec3 vWillowBarkChart;\nattribute vec3 willowRootChart;\ncentroid varying vec3 vWillowRootChart;');
 shader.vertexShader=once(shader.vertexShader,'vWillowBarkChart=vec3(uv,willowBarkCircumference);','vWillowBarkChart=vec3(uv,willowBarkCircumference);\nvWillowRootChart=willowRootChart;');
 shader.fragmentShader=once(shader.fragmentShader,'vec4 willowBarkSample(sampler2D sourceMap,vec3 chart,vec3 dx,vec3 dy){','vec4 willowBarkBaseSample(sampler2D sourceMap,vec3 chart,vec3 dx,vec3 dy){');
 shader.fragmentShader=once(shader.fragmentShader,'vec3 willowBarkLinearResponse(vec3 sourceAlbedo){',rootSampler+'\nvec3 willowBarkLinearResponse(vec3 sourceAlbedo){');
 for(const map of ['map','roughnessMap']){
  const call='willowBarkSample( '+map+', vWillowBarkChart, dFdx(vWillowBarkChart), dFdy(vWillowBarkChart) )';
  shader.fragmentShader=once(shader.fragmentShader,call,call.slice(0,-2)+', vWillowRootChart, dFdx(vWillowRootChart), dFdy(vWillowRootChart) )');
 }
 shader.fragmentShader=once(shader.fragmentShader,
  'vec3 dx=dFdx(vWillowBarkChart),dy=dFdy(vWillowBarkChart);',
  'vec3 dx=dFdx(vWillowBarkChart),dy=dFdy(vWillowBarkChart);\n  vec3 rx=dFdx(vWillowRootChart),ry=dFdy(vWillowRootChart);');
 for(const [suffix,root] of [['','vWillowRootChart'],['+dx','vWillowRootChart+rx'],['+dy','vWillowRootChart+ry']]){
  const call='willowBarkSample(bumpMap,vWillowBarkChart'+suffix+',dx,dy)';
  shader.fragmentShader=once(shader.fragmentShader,call,'willowBarkSample(bumpMap,vWillowBarkChart'+suffix+',dx,dy,'+root+',rx,ry)');
 }
 return shader;
}
export function createWillowRootMaterialLease(group,maps){
 const base=createWillowBarkMaterialLease(group,maps);
 const binding=base.bindings.find(x=>x.mesh.name==='willow-trunk-and-roots'),mesh=binding?.mesh;
 let material,disposed=false;
 try{
  if(!mesh?.geometry.attributes.willowRootChart||mesh.geometry.attributes.willowRootChart.count!==mesh.geometry.attributes.position.count)throw new Error('Complete root metric charts required.');
  material=base.material.clone();
  material.name=base.material.name;
  material.userData={...base.material.userData,rootChartRevision:willowRootMaterialId,rootOnlyPrivateMaterial:true,originalPBRResponseUnchanged:true};
  material.onBeforeCompile=patchWillowRootShader;
  material.customProgramCacheKey=()=>base.material.customProgramCacheKey()+'|'+willowRootMaterialId;
  material.onBeforeRender=(renderer,scene,camera,geometry,object)=>{
   base.material.onBeforeRender(renderer,scene,camera,geometry,object);
   if(!geometry.attributes.willowRootChart||geometry.attributes.willowRootChart.count!==geometry.attributes.position.count||object.geometry!==geometry||material.map!==maps.map||material.roughnessMap!==maps.roughnessMap||material.bumpMap!==maps.bumpMap)throw new Error('Root draw mapping or original maps changed.');
  };
  mesh.material=material;
 }catch(error){
  const errors=[error];
  if(mesh?.material===material)mesh.material=base.material;
  try{material?.dispose();}catch(e){errors.push(e);}
  try{base.dispose();}catch(e){errors.push(e);}
  if(errors.length>1)throw new AggregateError(errors,'Willow root material preparation failed.',{cause:error});throw error;
 }
 return {material:base.material,rootMaterial:material,bindings:base.bindings,get disposed(){return disposed;},dispose(){
  if(disposed)return;disposed=true;const errors=[];
  if(mesh.material===material)mesh.material=base.material;
  else errors.push(new Error('Root material borrower rebound before release.'));
  try{material.dispose();}catch(e){errors.push(e);}
  try{base.dispose();}catch(e){errors.push(e);}
  if(errors.length)throw new AggregateError(errors,'Willow root material release failed.');
 }};
}
export function willowRootProgramAudit(renderer){
 const gl=renderer.getContext();
 return (renderer.info.programs??[]).filter(p=>p.cacheKey.includes(willowRootMaterialId)).map(p=>{
  const fragment=gl.getShaderSource(p.fragmentShader),vertex=gl.getShaderSource(p.vertexShader);
  return {id:p.id,revision:willowRootMaterialId,linked:!!gl.getProgramParameter(p.program,gl.LINK_STATUS),
   actualShaderSource:true,rootMetricAttribute:vertex.includes('vWillowRootChart=willowRootChart;'),
   colorChart:fragment.includes('willowBarkSample( map, vWillowBarkChart, dFdx(vWillowBarkChart), dFdy(vWillowBarkChart), vWillowRootChart'),
   roughnessChart:fragment.includes('willowBarkSample( roughnessMap, vWillowBarkChart, dFdx(vWillowBarkChart), dFdy(vWillowBarkChart), vWillowRootChart'),
   forwardHeightChart:fragment.includes('willowBarkSample(bumpMap,vWillowBarkChart+dx,dx,dy,vWillowRootChart+rx,rx,ry)')&&fragment.includes('willowBarkSample(bumpMap,vWillowBarkChart+dy,dx,dy,vWillowRootChart+ry,rx,ry)'),
   metricGradients:fragment.includes('textureGrad(sourceMap,rootChart.xy,rootDx.xy,rootDy.xy)'),
   zeroWeightPreservesBase:fragment.includes('if(rootChart.z<=0.0)return base;'),
   sameChannelBlend:fragment.includes('mix(base,root,clamp(rootChart.z,0.0,1.0))')};
 });
}
