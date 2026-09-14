import * as THREE from 'three';

export const yangquelongPavingSpec=Object.freeze({
 id:'yangquelong-paving-refinement-r1',surface:'outer court only',
 evidence:'contemporary exhibition paving; not a historical stone survey',
 tileMetres:1.5,slabWidth:1.52,slabDepth:1.07,axisSlabWidth:.76,
 jointWidth:.014,jointBevel:.007,jointOpticalDepth:.0015,
 colour:0xcac6ba,cellLightVariation:.045,cellWarmthVariation:.012,
 photoGrain:.45,normalStrength:.35,roughness:.91,
 roughnessVariation:.02,roughnessGrain:.30,roughnessRange:Object.freeze([.80,.97]),
 originalAxisGeometry:true,geometryChanges:0,worldScale:'unit only; no shear; source baked court frame',visualAcceptance:false,
});
const spec=yangquelongPavingSpec;
const sourceMaps=Object.freeze({
 color:{encoded:'1f2d31717ab6d2825d5716f5ab0beba83b6f4ddc4c298980a62d180e29f7b88f',decoded:'3958cf0bc209d34abf3b450672a402d869fb04e167b4b0ab4cfddf5a93898fd8'},
 normal:{encoded:'8a5b84722bbe719c315d9ef77709c93c3d2eea49638e2b3cfea3660bb952adcb',decoded:'e1ff3cf0a4b9f851f29c86be46541609b20a6dab41753b9a7174efa6f9551870'},
 roughness:{encoded:'f73bbbfbc58ea9f0d21317025445351776c7522d557ff55080bd546ad489c4d6',decoded:'e4595a561ce62bd945facf0d3800c3bf33ca47d177c7d63cfb6b3337ed628278'},
});
const fail=(ok,message)=>{if(!ok)throw new Error('Yangquelong paving: '+message);};
const mod=(x,n)=>((x%n)+n)%n;
export function pavingCellValue(x,z,seed=0){
 let h=mod(x*73+z*151+seed*17,251);
 h=mod(h*h+13*h+101,251);
 return h/125-1;
}
export function pavingGridAt(x,z){
 fail(Number.isFinite(x)&&Number.isFinite(z),'finite metric position required');
 const axis=Math.abs(z)<=1.615&&[[-18.8,-5.22],[5.22,12.75],[18.35,21.8]].some(([a,b])=>x>=a&&x<=b);
 const origin=axis?(x<0?-18.8:x<18.35?5.22:18.35):-18.8,pitch=axis?.76:1.52;
 const u=(x-origin)/pitch,a=Math.abs(z),sign=z<0?-1:1;
 const row=a<=.54?0:Math.floor((a-.54)/1.07)+1;
 const dz=a<=.54?(a-.54)*sign:(mod((a-.54)/1.07+.5,1)-.5)*1.07*sign;
 return {cell:[Math.floor(u),row*sign],signedDistance:[(mod(u+.5,1)-.5)*pitch,dz],axis,pitch};
}
/** Physical groove coverage loses area when subpixel; it never expands to a
 * constant one-pixel dark line. pixelWidth is the continuous metric fwidth. */
export function pavingJointCoverage(distance,pixelWidth=0){
 const a=Math.max(pixelWidth*.5,.00005),h=spec.jointWidth*.5;
 return Math.max(0,Math.min(distance+a,h)-Math.max(distance-a,-h))/(2*a);
}
export function pavingJointSlope(distance,pixelWidth=0){
 const d=Math.abs(distance),t=THREE.MathUtils.clamp((d-spec.jointWidth*.5)/spec.jointBevel,0,1);
 return Math.sign(distance)*spec.jointOpticalDepth*6*t*(1-t)/spec.jointBevel*Math.min(1,spec.jointBevel/Math.max(pixelWidth,.00005));
}
/** Audit all cap vertices. The unchanged ExtrudeGeometry has UV=(x,-z) in metres. */
export function auditYangquelongPavingGeometry(geometry){
 const p=geometry?.attributes.position,n=geometry?.attributes.normal,uv=geometry?.attributes.uv;
 fail(p&&n&&uv&&p.count===n.count&&p.count===uv.count,'position/normal/UV required');
 let topVertices=0,maxUvError=0,maxTopError=0;
 for(let i=0;i<p.count;i++){
  fail([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].every(Number.isFinite),'finite source attributes');
  if(n.getY(i)>.999){
   topVertices++;maxUvError=Math.max(maxUvError,Math.abs(uv.getX(i)-p.getX(i)),Math.abs(uv.getY(i)+p.getZ(i)));
   maxTopError=Math.max(maxTopError,Math.abs(p.getY(i)));
  }
 }
 fail(topVertices>0&&maxUvError<=1e-5&&maxTopError<=1e-5,'unchanged metric extruded court cap required');
 return {topVertices,maxUvError,maxTopError,uvToMetric:'u=x, v=-z',arrayChanges:0};
}
function replaceOnce(source,needle,replacement){
 fail(source.split(needle).length===2,'unexpected Three shader chunk '+needle);
 return source.replace(needle,replacement);
}
const vertexDeclarations=`
uniform mat4 ymyPavingWorldToMetric;
uniform mat3 ymyPavingNormalToMetric;
varying vec3 vYmyPavingMetric;
varying vec3 vYmyPavingMetricNormal;
`;
const fragmentDeclarations=`
uniform mat3 ymyPavingMetricNormalToView;
uniform vec3 ymyPavingBaseColour;
uniform vec3 ymyPavingOriginalColour;
uniform vec3 ymyPavingJointColour;
varying vec3 vYmyPavingMetric;
varying vec3 vYmyPavingMetricNormal;
float ymyPavingCell(vec2 c,float seed){
 float h=mod(c.x*73.0+c.y*151.0+seed*17.0,251.0);
 h=mod(h*h+13.0*h+101.0,251.0);
 return h/125.0-1.0;
}
bool ymyPavingAxis(vec2 p){
 return abs(p.y)<=1.615&&((p.x>=-18.8&&p.x<=-5.22)||(p.x>=5.22&&p.x<=12.75)||(p.x>=18.35&&p.x<=21.8));
}
vec4 ymyPavingGrid(vec2 p){
 float origin=ymyPavingAxis(p)?(p.x<0.0?-18.8:(p.x<18.35?5.22:18.35)):-18.8;
 float pitch=ymyPavingAxis(p)?0.76:1.52;
 float u=(p.x-origin)/pitch,a=abs(p.y),sgn=p.y<0.0?-1.0:1.0;
 float row=a<=0.54?0.0:floor((a-0.54)/1.07)+1.0;
 float dz=a<=0.54?(a-0.54)*sgn:(fract((a-0.54)/1.07+0.5)-0.5)*1.07*sgn;
 return vec4(floor(u),row*sgn,(fract(u+0.5)-0.5)*pitch,dz);
}
float ymyPavingCoverage(float d,float width){
 float a=max(width*0.5,0.00005),h=0.007;
 return max(0.0,min(d+a,h)-max(d-a,-h))/(2.0*a);
}
float ymyPavingSlope(float d,float width){
 float t=clamp((abs(d)-0.007)/0.007,0.0,1.0);
 return sign(d)*0.0015*6.0*t*(1.0-t)/0.007*min(1.0,0.007/max(width,0.00005));
}
`;
const mapFragment=`
vec3 ymyPavingBaseNormal=normalize(vYmyPavingMetricNormal);
float ymyPavingTop=step(0.999,ymyPavingBaseNormal.y);
vec4 ymyPavingCellInfo=ymyPavingGrid(vYmyPavingMetric.xz);
vec2 ymyPavingPixelWidth=fwidth(vYmyPavingMetric.xz);
float ymyPavingProceduralJoint=ymyPavingAxis(vYmyPavingMetric.xz)?0.0:1.0;
float ymyPavingJoint=ymyPavingProceduralJoint*(1.0-
 (1.0-ymyPavingCoverage(ymyPavingCellInfo.z,ymyPavingPixelWidth.x))*
 (1.0-ymyPavingCoverage(ymyPavingCellInfo.w,ymyPavingPixelWidth.y)));
vec2 ymyPavingContinuousUv=vec2(vYmyPavingMetric.x,-vYmyPavingMetric.z)/1.5;
// Three maps share each stone's translation. Derivatives come from continuous
// metric coordinates, never from the discontinuous integer cell hash.
vec2 ymyPavingUv=ymyPavingContinuousUv+0.5*vec2(
 ymyPavingCell(ymyPavingCellInfo.xy,31.0),ymyPavingCell(ymyPavingCellInfo.xy,93.0));
vec2 ymyPavingDx=dFdx(ymyPavingContinuousUv),ymyPavingDy=dFdy(ymyPavingContinuousUv);
vec3 ymyPavingPhoto=textureGrad(map,ymyPavingUv,ymyPavingDx,ymyPavingDy).rgb;
float ymyPavingTone=clamp(1.0+0.045*ymyPavingCell(ymyPavingCellInfo.xy,0.0)
 +0.45*(dot(ymyPavingPhoto,vec3(0.2126,0.7152,0.0722))-0.892670095),0.72,1.10);
float ymyPavingWarmth=0.012*ymyPavingCell(ymyPavingCellInfo.xy,7.0);
vec3 ymyPavingStone=ymyPavingBaseColour*ymyPavingTone*(vec3(1.0)+ymyPavingWarmth*vec3(1.0,0.08,-1.0));
diffuseColor.rgb=mix(ymyPavingOriginalColour,mix(ymyPavingStone,ymyPavingJointColour,ymyPavingJoint),ymyPavingTop);
`;
const roughnessFragment=`
float ymyPavingRough=textureGrad(roughnessMap,ymyPavingUv,ymyPavingDx,ymyPavingDy).g;
float roughnessFactor=mix(roughness,mix(clamp(0.91+
 0.02*ymyPavingCell(ymyPavingCellInfo.xy,17.0)+0.30*(ymyPavingRough-0.11569266),0.80,0.97),0.98,ymyPavingJoint),ymyPavingTop);
`;
const normalFragment=`
vec3 ymyPavingMapNormal=textureGrad(normalMap,ymyPavingUv,ymyPavingDx,ymyPavingDy).xyz*2.0-1.0;
vec2 ymyPavingSlopeUv=-ymyPavingMapNormal.xy/max(ymyPavingMapNormal.z,0.05);
vec3 ymyPavingGradient=0.35*vec3(ymyPavingSlopeUv.x,0.0,-ymyPavingSlopeUv.y);
ymyPavingGradient+=ymyPavingProceduralJoint*vec3(
 ymyPavingSlope(ymyPavingCellInfo.z,ymyPavingPixelWidth.x),0.0,
 ymyPavingSlope(ymyPavingCellInfo.w,ymyPavingPixelWidth.y));
ymyPavingGradient-=ymyPavingBaseNormal*dot(ymyPavingGradient,ymyPavingBaseNormal);
vec3 ymyPavingPerturbed=normalize(ymyPavingMetricNormalToView*normalize(ymyPavingBaseNormal-ymyPavingGradient));
normal=normalize(mix(normal,ymyPavingPerturbed,ymyPavingTop));
`;
function findFloor(owner){
 fail(owner?.group?.isGroup&&!owner.disposed&&typeof owner.dispose==='function','live private material view required');
 const matches=[];owner.group.traverse(n=>{if(n.name==='yangquelong-court-paving')matches.push(n);});
 fail(matches.length===1,'one original outer court paving group required');
 const group=matches[0],mesh=group.children[0];
 fail(group.children.length===1&&mesh?.isMesh&&!mesh.isInstancedMesh&&!Array.isArray(mesh.material)&&mesh.material.name==='yangquelong-light-limestone-paving','one unchanged outer paving mesh required');
 fail(mesh.onBeforeRender===THREE.Mesh.prototype.onBeforeRender&&mesh.material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile,'unreviewed paving hook');
 return mesh;
}
function assertMaps(textureOwner){
 fail(textureOwner?.fullResolutionVerified===true&&!textureOwner.disposed,'private verified stone texture owner required');
 for(const [channel,record] of Object.entries(sourceMaps)){
  const t=textureOwner.maps?.[channel];
  fail(t?.isDataTexture&&t.image?.width===4096&&t.image?.height===4096&&t.image.data instanceof Uint8Array&&t.image.data.length===4096*4096*4&&t.userData.encodedSha256===record.encoded&&t.userData.decodedSha256===record.decoded,'same full 4K '+channel+' pixels required');
  fail(t.colorSpace===(channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace)&&t.wrapS===THREE.RepeatWrapping&&t.wrapT===THREE.RepeatWrapping&&t.generateMipmaps&&t.minFilter===THREE.LinearMipmapLinearFilter&&t.magFilter===THREE.LinearFilter&&t.anisotropy===8,'unchanged full-quality '+channel+' sampler required');
 }
}
/** Bind BEFORE the ground owner captures its material identity. Only the cloned
 * outer floor changes. Texture objects are borrowed from its existing private
 * stone owner: zero extra fetch/decode/GPU image, no texture transform changes.
 * Ground exclusively guards/restores the geometry, including all soil cutouts.
 * Release this binding before releasing the private stone view. */
export function bindYangquelongPaving({owner,signal}={}){
 signal?.throwIfAborted();
 const mesh=findFloor(owner),textureOwner=owner.textureOwner;
 assertMaps(textureOwner);
 const geometryAudit=auditYangquelongPavingGeometry(mesh.geometry);
 const original=mesh.material,originalCallback=mesh.onBeforeRender,parent=mesh.parent;
 const material=original.clone(),listeners=[],uniforms={
  ymyPavingWorldToMetric:{value:new THREE.Matrix4()},
  ymyPavingNormalToMetric:{value:new THREE.Matrix3()},
  ymyPavingMetricNormalToView:{value:new THREE.Matrix3()},
  ymyPavingBaseColour:{value:new THREE.Color(spec.colour)},
  ymyPavingOriginalColour:{value:original.color.clone()},
  ymyPavingJointColour:{value:new THREE.Color(0xaaa89a)},
 };
 let disposed=false,cleanupError=null;
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),rigid=new THREE.Matrix4(),metricFrame=new THREE.Matrix4(),viewFrame=new THREE.Matrix4();
 material.name=spec.id+'-outer-court';material.map=textureOwner.maps.color;material.normalMap=textureOwner.maps.normal;material.roughnessMap=textureOwner.maps.roughness;material.normalScale.setScalar(spec.normalStrength);
 material.userData={...original.userData,pavingRefinement:spec.id,evidence:spec.evidence,sourcePixels:'same private Marble021 maps as stone owner',visualAcceptance:false};
 const compile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=replaceOnce(shader.vertexShader,'#include <common>','#include <common>\n'+vertexDeclarations);
  shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvYmyPavingMetric=(ymyPavingWorldToMetric*modelMatrix*vec4(transformed,1.0)).xyz;\nvYmyPavingMetricNormal=ymyPavingNormalToMetric*objectNormal;');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <common>','#include <common>\n'+fragmentDeclarations);
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <map_fragment>',mapFragment);
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <roughnessmap_fragment>',roughnessFragment);
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'#include <normal_fragment_maps>',normalFragment);
 };
 material.onBeforeCompile=compile;material.customProgramCacheKey=()=>spec.id+'-metric-three-map-gradient-v1';
 function dispose(){
  if(disposed)return;disposed=true;const errors=[],run=fn=>{try{fn();}catch(e){errors.push(e);}};
  signal?.removeEventListener('abort',cancel);
  for(const resource of listeners)run(()=>resource.removeEventListener('dispose',cancel));listeners.length=0;
  if(mesh.material===material)mesh.material=original;
  if(mesh.onBeforeRender===beforeRender)mesh.onBeforeRender=originalCallback;
  run(()=>material.dispose());material.map=material.normalMap=material.roughnessMap=null;
  if(errors.length){cleanupError=new AggregateError(errors,'Yangquelong paving release failed');throw cleanupError;}
 }
 function cancel(){try{dispose();}catch(error){cleanupError=error;}}
 function sourceFrame(){
  owner.group.updateWorldMatrix(true,false);mesh.updateWorldMatrix(true,false);
  owner.group.matrixWorld.decompose(position,rotation,scale);
  fail([...position,...rotation,...scale].every(Number.isFinite)&&scale.toArray().every(x=>Math.abs(x-1)<=1e-6),'unit world scale required for original axis compatibility');
  rigid.makeRotationFromQuaternion(rotation.normalize()).setPosition(position);
  fail(owner.group.matrixWorld.elements.every((x,i)=>Math.abs(x-rigid.elements[i])<=1e-6),'rigid world frame without shear required');
  uniforms.ymyPavingWorldToMetric.value.copy(rigid).invert();
  metricFrame.multiplyMatrices(uniforms.ymyPavingWorldToMetric.value,mesh.matrixWorld);
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  fail(metricFrame.elements.every((x,i)=>Math.abs(x-identity[i])<=1e-6),'unchanged baked outer court asset frame required');
 }
 function assertCurrent(){
  try{
   signal?.throwIfAborted();fail(!disposed&&!owner.disposed&&mesh.parent===parent&&parent.parent&&mesh.material===material&&mesh.onBeforeRender===beforeRender,'paving view invalidated');
   fail(material.onBeforeCompile===compile&&material.map===textureOwner.maps.color&&material.normalMap===textureOwner.maps.normal&&material.roughnessMap===textureOwner.maps.roughness,'paving shader/texture binding changed');
   assertMaps(textureOwner);sourceFrame();return true;
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Paving invalidation and release failed',{cause:error});}throw error;}
 }
 function beforeRender(renderer,scene,camera,geometry,drawMaterial){
  if(drawMaterial!==material)return;
  assertCurrent();camera.updateWorldMatrix(true,false);
  uniforms.ymyPavingNormalToMetric.value.getNormalMatrix(metricFrame);
  rigid.setPosition(0,0,0);viewFrame.multiplyMatrices(camera.matrixWorldInverse,rigid);
  uniforms.ymyPavingMetricNormalToView.value.getNormalMatrix(viewFrame);
 }
 try{
  mesh.material=material;mesh.onBeforeRender=beforeRender;
  for(const resource of [original,material,...Object.values(textureOwner.maps)]){resource.addEventListener('dispose',cancel);listeners.push(resource);}
  signal?.addEventListener('abort',cancel,{once:true});assertCurrent();
  return {mesh,material,uniforms,diagnostics:{spec,geometryAudit,geometryGuard:'existing ground owner',textures:'borrowed same three private texture objects; zero extra texture allocation',sourceMaps,originalMaterial:original.name,changedMeshes:1,sourceArrayChanges:0,nativeReviewed:false},
   assertCurrent,dispose,whenIdle(){return cleanupError?Promise.reject(cleanupError):Promise.resolve();},get disposed(){return disposed;},get cleanupError(){return cleanupError;}};
 }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Paving construction and release failed',{cause:error});}throw error;}
}
