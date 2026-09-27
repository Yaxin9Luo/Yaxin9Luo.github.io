import {DataTexture,RGBAFormat,UnsignedByteType,LinearFilter,ClampToEdgeWrapping,NoColorSpace,Vector4,ShaderChunk,Matrix4,Color} from 'three';
import {loadJiuzhouGravelTextures,loadJiuzhouMeadowTextures} from './jiuzhou-landscape-material.js';
import {originalRoadRectangles,nonOverlappingCourtPaving} from './front-court-ground-seams.js';
import {frontCourtShrubGroups} from './front-court-planting-layout.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const fract=v=>v-Math.floor(v);
const hash=(x,z)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
const noise=(x,z)=>{const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,fract(x)),v=smooth(0,1,fract(z));return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;};
const once=(s,a,b)=>{if(s.split(a).length!==2)throw new Error('Front-court ground shader boundary changed: '+a);return s.replace(a,b);};
const distance=(x,z,r)=>Math.hypot(Math.max(r.x0-x,0,x-r.x1),Math.max(r.z0-z,0,z-r.z1));
export function createFrontCourtGroundField({composition}){
 const footprints=originalRoadRectangles().concat(nonOverlappingCourtPaving()).map(r=>({id:r.id,x0:r.x0,x1:r.x1,z0:r.z0,z1:r.z1}));
 composition.group.updateWorldMatrix(true,true);
 // Low original masonry only. No foliage bounds or generated reference pixels.
 composition.group.traverse(n=>{
  if(!n.isMesh||n.isInstancedMesh||n.name.includes('dagongmen-front-imperial-road'))return;
  // These disconnected mortar strips are already covered by the exact road
  // and court rectangles above. Their merged AABBs include open meadow.
  if(n.userData.body==='original-road-visible-grout-only'||n.name==='front-court-paving-visible-joints')return;
  const m=n.material;if(Array.isArray(m)||!m?.name||!/(foundation|stone|platform|paving|column-bases)/.test(m.name))return;
  if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();
  const b=n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
  if(b.min.y>4.06||b.max.y<3.8||b.max.x-b.min.x<.05||b.max.z-b.min.z<.05)return;
  footprints.push({id:n.name,x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z});
 });
 const min=[-640,252],max=[-437,667],pitch=.25,bins=new Map();
 const meadowLobes=[[-555,348,78,80],[-533,407,73,85],[-532,481,46,87],[-532,584,42,65]];
 const meadowBeds=frontCourtShrubGroups.map(group=>{const xs=group.points.map(p=>p[0]),zs=group.points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);return[(x0+x1)/2,(z0+z1)/2,(x1-x0)/2+9,(z1-z0)/2+11];});
 for(const r of footprints)for(let z=Math.floor((r.z0-4)/8);z<=Math.floor((r.z1+4)/8);z++)for(let x=Math.floor((r.x0-4)/8);x<=Math.floor((r.x1+4)/8);x++){const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(r);}
 function sample(x,z){
  let gap=4;for(const r of bins.get(Math.floor(x/8)+','+Math.floor(z/8))??[])gap=Math.min(gap,distance(x,z,r));
  // Independent 35-65 m ground character, 5-12 m interlocking grass/soil
  // patches and sub-metre photographic variation. No additional land mesh.
  const macro=.64*noise(x*.021+3.8,z*.021-6.2)+.36*noise(x*.034-9.1,z*.034+2.6);
  const middle=noise(x*.118-1.2,z*.118+5.1),fine=noise(x*.73+5.2,z*.73-2.8);
  let grove=0;
  for(const [cx,cz,rx,rz]of meadowBeds){const r=Math.hypot((x-cx)/rx,(z-cz)/rz);grove=Math.max(grove,1-smooth(.40,1.15+.18*middle,r));}
  const edgeGrass=smooth(.10,.50+.55*middle,gap);
  const patch=.62*macro+.38*middle;
  const dry=smooth(.43,.73,patch)*(1-.60*grove);
  const grass=edgeGrass*(1-.74*dry);
  const sun=clamp(.20+.63*macro+.27*middle-.40*grove);
  let blend=0;
  for(const [cx,cz,rx,rz]of meadowLobes){
   const radius=Math.hypot((x-cx)/rx,(z-cz)/rz);
   const contour=.14*(macro-.5)+.11*(middle-.5);
   blend=Math.max(blend,1-smooth(.57+contour,.97+contour,radius));
  }
  // Fragment the transition with the same medium-scale ground character;
  // a continuous elliptical blur must not read as an island painted on land.
  blend*=.42+.58*smooth(.21,.62,patch+.22*blend);
  blend*=smooth(0,10,Math.min(x-min[0],max[0]-x,z-min[1],max[1]-z));
  return {grass,blend,sun,variation:.92+.11*fine+.035*middle,gap,grove,macro,middle,dry};
 }
 const width=Math.ceil((max[0]-min[0])/pitch)+1,height=Math.ceil((max[1]-min[1])/pitch)+1,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=sample(min[0]+x*pitch,min[1]+y*pitch),i=4*(y*width+x);data[i]=Math.round(s.grass*255);data[i+1]=Math.round(s.blend*255);data[i+2]=Math.round(s.sun*255);data[i+3]=Math.round(clamp((s.variation-.85)/.25)*255);}
 const texture=new DataTexture(data,width,height,RGBAFormat,UnsignedByteType);texture.name='front-court-masonry-meadow-field-r5';texture.colorSpace=NoColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=ClampToEdgeWrapping;texture.magFilter=texture.minFilter=LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 return {texture,sample,diagnostics:{min,max,width,height,pitch,footprints,meadowLobes,soilEdgeMetres:[.10,1.05],groundScalesMetres:{macro:[35,65],middle:[5,12],detail:[.25,1.4]},meadowBeds,mergedJointAABBsExcluded:true,paletteSRGB:{cool:'#8fa671',warm:'#b8ad79',mineral:'#cabb9b'},providerPixelsChanged:false,physicalGravelTileMetres:2.5,physicalMeadowTileMetres:15}};
}
export function createFrontCourtGroundMaterial({original,gravel,meadow,field}){
 for(const owner of [gravel,meadow])for(const slot of ['map','normalMap','roughnessMap'])if(owner.disposed||!owner[slot]?.isTexture||owner[slot].image?.width!==4096||owner[slot].image?.height!==4096)throw new Error('Six complete original 4K maps are required.');
 // Canonical slots and their UV transforms stay with the original terrain.
 // Regional maps are borrowed uniforms; neither Studio grain nor Museum 4K loses a channel.
 const material=original.clone();material.name='front-court-private-meadow-and-mineral-r5';
 const originalCompile=original.onBeforeCompile,originalKey=original.customProgramCacheKey;
 const normalSource=ShaderChunk.normalmap_pars_fragment,frameStart=normalSource.indexOf('mat3 getTangentFrame('),frameEnd=normalSource.lastIndexOf('\n#endif');
 if(frameStart<0||frameEnd<=frameStart)throw new Error('Three tangent-frame shader boundary changed');
 const regionalFrame=normalSource.slice(frameStart,frameEnd).replace('getTangentFrame','fcTangentFrame');
 material.userData={body:'contemporary-front-court-landscape',historicallySurveyed:false,providerPixelsChanged:false,sourceUvScale:.08,gravelTileMetres:2.5,meadowTileMetres:15,regionalBoundaryMetres:field.diagnostics};
 material.onBeforeCompile=(shader,renderer)=>{
  // Keep markers outside the includes so the actual base hook may replace them.
  for(const chunk of ['map_fragment','roughnessmap_fragment'])shader.fragmentShader=once(shader.fragmentShader,'#include <'+chunk+'>','#include <'+chunk+'>\n/* fc-after-'+chunk+' */');
  shader.fragmentShader=once(shader.fragmentShader,'#include <normal_fragment_maps>','vec3 fcSurfaceNormal=normal;\n#include <normal_fragment_maps>\n/* fc-after-normal_fragment_maps */');
  originalCompile.call(original,shader,renderer);
  Object.assign(shader.uniforms,{fcMeadowCool:{value:new Color('#8fa671')},fcMeadowWarm:{value:new Color('#b8ad79')},fcPaleMineral:{value:new Color('#cabb9b')},fcGravelMap:{value:gravel.map},fcGravelNormal:{value:gravel.normalMap},fcGravelRough:{value:gravel.roughnessMap},fcMeadowMap:{value:meadow.map},fcMeadowNormal:{value:meadow.normalMap},fcMeadowRough:{value:meadow.roughnessMap},fcGroundField:{value:field.texture},fcGroundRect:{value:new Vector4(...field.diagnostics.min,field.diagnostics.max[0]-field.diagnostics.min[0],field.diagnostics.max[1]-field.diagnostics.min[1])}});
  shader.vertexShader='varying vec2 fcTerrainXZ,fcTerrainUv;\n'+shader.vertexShader;
  shader.vertexShader=once(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nfcTerrainXZ=position.xz;fcTerrainUv=uv;');
  shader.fragmentShader='varying vec2 fcTerrainXZ,fcTerrainUv;\nuniform sampler2D fcGravelMap,fcGravelNormal,fcGravelRough,fcMeadowMap,fcMeadowNormal,fcMeadowRough,fcGroundField;\nuniform vec4 fcGroundRect;\nuniform vec3 fcMeadowCool,fcMeadowWarm,fcPaleMineral;\n'+regionalFrame+'\n'+shader.fragmentShader;
  shader.fragmentShader=once(shader.fragmentShader,'/* fc-after-map_fragment */',`vec4 fcField=texture2D(fcGroundField,(fcTerrainXZ-fcGroundRect.xy)/fcGroundRect.zw);
vec2 fcGravelUV=fcTerrainUv/(.08*2.5);
vec2 fcMeadowUV=fcTerrainUv/(.08*15.);
vec3 fcOldDiffuse=diffuseColor.rgb;
vec3 fcStone=texture2D(fcGravelMap,fcGravelUV).rgb;
vec3 fcMeadow=texture2D(fcMeadowMap,fcMeadowUV).rgb;
float fcLuma=dot(fcMeadow,vec3(.2126,.7152,.0722));
// Authored albedo palette, not exposure or emissive. Source photographic
// detail, all original 4K normals and roughness remain independently sampled.
vec3 fcPhotoChroma=mix(vec3(fcLuma),fcMeadow,.26)/max(fcLuma,.025);
float fcPhotoDetail=clamp(fcLuma/.18,.68,1.26);
fcMeadow=mix(fcMeadowCool,fcMeadowWarm,smoothstep(.22,.78,fcField.b))*fcPhotoChroma*fcPhotoDetail;
float fcStoneLuma=dot(fcStone,vec3(.2126,.7152,.0722));
fcStone=mix(fcPaleMineral*(.72+.42*clamp(fcStoneLuma/.25,0.,1.)),fcStone,.32);
vec3 fcLocal=mix(fcStone,fcMeadow,fcField.r)*(.85+.25*fcField.a);
float fcOldLuma=dot(fcOldDiffuse,vec3(.2126,.7152,.0722));
float fcLocalLuma=dot(fcLocal,vec3(.2126,.7152,.0722));
// Retain local hue/detail while matching the original land's luminance at
// the outer transition. This avoids a broad light/dark halo around the field.
vec3 fcEdgeMatched=fcLocal*clamp(fcOldLuma/max(fcLocalLuma,.025),.55,1.80);
fcLocal=mix(fcEdgeMatched,fcLocal,smoothstep(.18,.82,fcField.g));
diffuseColor.rgb=mix(fcOldDiffuse,fcLocal,fcField.g);`);
  shader.fragmentShader=once(shader.fragmentShader,'/* fc-after-normal_fragment_maps */',`if(fcField.g>0.0){
 vec3 fcOriginalNormal=normal;
 #ifdef USE_TANGENT
 mat3 fcTbn=mat3(normalize(vTangent),normalize(vBitangent),fcSurfaceNormal);
 #else
 mat3 fcTbn=fcTangentFrame(-vViewPosition,fcSurfaceNormal,fcTerrainUv);
 #endif
 #ifdef DOUBLE_SIDED
 fcTbn[0]*=faceDirection;fcTbn[1]*=faceDirection;
 #endif
 vec3 fcMapN=mix(texture2D(fcGravelNormal,fcGravelUV).xyz,texture2D(fcMeadowNormal,fcMeadowUV).xyz,fcField.r)*2.0-1.0;
 fcMapN.xy*=.40;
 vec3 fcRegionalNormal=normalize(fcTbn*fcMapN);
 normal=normalize(mix(fcOriginalNormal,fcRegionalNormal,fcField.g));
}`);
  shader.fragmentShader=once(shader.fragmentShader,'/* fc-after-roughnessmap_fragment */','float fcDryRoughness=mix(.88,1.,mix(texture2D(fcGravelRough,fcGravelUV).g,texture2D(fcMeadowRough,fcMeadowUV).g,fcField.r));\nroughnessFactor=mix(roughnessFactor,fcDryRoughness,fcField.g);');
 };
 material.customProgramCacheKey=()=> originalKey.call(original)+':front-court-six-original-4k-ground-scales-r5:base-compatible-r1';
 return material;
}
export async function prepareFrontCourtGroundSurface({terrain,composition,signal,loadGravel=loadJiuzhouGravelTextures,loadMeadow=loadJiuzhouMeadowTextures}={}){
 signal?.throwIfAborted();const lifetime=new AbortController(),bindings=[];let gravel,meadow,field,material,disposed=false,error=null;
 const run=f=>{try{f();}catch(e){error??=e;}};
 function dispose(){
  if(disposed){if(error)throw error;return;}disposed=true;signal?.removeEventListener('abort',abort);
  for(const b of bindings)if(b.mesh.material===material)b.mesh.material=b.material;
  run(()=>material?.dispose());run(()=>field?.texture.dispose());run(()=>gravel?.dispose());run(()=>meadow?.dispose());run(()=>lifetime.abort(signal?.reason));if(error)throw error;
 }
 const abort=()=>{try{dispose();}catch{}};signal?.addEventListener('abort',abort,{once:true});
 try{
  if(!terrain?.group||terrain.disposed||!composition?.group)throw new Error('Actual current front-court terrain and source assembly required.');
  const readyGravel=await loadGravel({signal:lifetime.signal});if(disposed||lifetime.signal.aborted){readyGravel.dispose();lifetime.signal.throwIfAborted();}gravel=readyGravel;
  const readyMeadow=await loadMeadow({signal:lifetime.signal});if(disposed||lifetime.signal.aborted){readyMeadow.dispose();lifetime.signal.throwIfAborted();}meadow=readyMeadow;
  field=createFrontCourtGroundField({composition});material=createFrontCourtGroundMaterial({original:terrain.earthMaterial,gravel,meadow,field});
  terrain.group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.body==='land'&&mesh.material===terrain.earthMaterial){bindings.push({mesh,material:mesh.material,geometry:mesh.geometry});mesh.material=material;}});
  if(bindings.length!==1)throw new Error('Expected one original continuous land mesh; other terrain bodies stay original.');
  const baseline=terrain.group.matrixWorld.clone(),identity=new Matrix4();
  function assertCurrent(){terrain.group.updateWorldMatrix(true,false);if(disposed||terrain.disposed||gravel.disposed||meadow.disposed||!terrain.group.matrixWorld.equals(identity)||!baseline.equals(identity)||bindings.some(b=>b.mesh.geometry!==b.geometry||b.mesh.material!==material))throw new Error('Ground surface frame or binding changed.');}
  assertCurrent();
  return {material,field,gravel,meadow,diagnostics:{id:'front-court-ground-surface-r5',boundBodies:['land'],field:field.diagnostics,textureDimensions:[4096,4096],originalSourcePixels:true,originalTerrainUvs:true,normalScale:.4,originalOutsideRegion:true,acceptedArt:false},assertCurrent,get disposed(){return disposed;},dispose};
 }catch(cause){try{dispose();}catch(cleanup){throw new AggregateError([cause,cleanup],'Ground surface preparation failed');}throw cause;}
}
