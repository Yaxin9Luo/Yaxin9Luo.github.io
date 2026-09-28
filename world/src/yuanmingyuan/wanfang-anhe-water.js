import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {wanfangAnheLayout as L} from './wanfang-anhe-layout.js';

// Private, bounded study water. No global lake, coast, light or terrain is created.
const shader={name:'Wanfang study reflective lake',uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},time:{value:0},eye:{value:new THREE.Vector3()}},
vertexShader:`uniform mat4 textureMatrix;varying vec4 vMirror;varying vec3 vWorld;
void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;vMirror=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*p;}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 color,eye;uniform float time;
varying vec4 vMirror;varying vec3 vWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 ripple(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),d=6.*f*(1.-f);
float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),e=hash(i+1.);
return d*vec2(mix(b-a,e-c,u.y),mix(c-a,e-b,u.x));}
void main(){float footprint=max(length(dFdx(vWorld.xz)),length(dFdy(vWorld.xz)));
vec2 slope=.024*ripple(vWorld.xz*.38+vec2(time*.018,-time*.013))
+.010*ripple(vWorld.xz*1.43+vec2(-time*.031,time*.021)+17.3)*(1.-smoothstep(.15,.6,footprint));
vec3 n=normalize(vec3(-slope.x,1.,-slope.y)),v=normalize(eye-vWorld);
float fresnel=.055+.945*pow(1.-max(0.,dot(v,n)),5.);
vec2 uv=clamp(vMirror.xy/vMirror.w+slope*.014,.001,.999);
vec3 reflected=texture2D(tDiffuse,uv).rgb;
gl_FragColor=vec4(mix(color,reflected,.30+fresnel*.66),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`};
export function createWanfangStudyWater(){
  const geometry=new THREE.PlaneGeometry(L.lakeHalf*2,L.lakeHalf*2);
  let sheet;
  try{sheet=new Reflector(geometry,{textureWidth:2048,textureHeight:2048,multisample:4,clipBias:.0002,shader,color:0x315c5b});}
  catch(error){geometry.dispose();throw error;}
  sheet.name='wanfang-anhe-study-water';sheet.rotation.x=-Math.PI/2;sheet.position.y=L.waterY;
  sheet.isWater=true;sheet.userData={navigation:false,body:'bounded-private-reflective-study-water',historicalLakeOutline:false};
  let disposed=false,reflecting=false;const original=sheet.onBeforeRender;
  const diagnostics={resolution:[2048,2048],samples:4,planeY:L.waterY,navigation:false,attempts:0,captures:0,overrides:0,failures:0,disposed:false};
  sheet.onBeforeRender=function(renderer,scene,camera){
    if(disposed||reflecting)return;
    if(scene.overrideMaterial){diagnostics.overrides++;return;}
    diagnostics.attempts++;sheet.material.uniforms.eye.value.setFromMatrixPosition(camera.matrixWorld);
    const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.(),mip=renderer.getActiveMipmapLevel?.();
    const xr=renderer.xr.enabled,auto=renderer.shadowMap.autoUpdate,dirty=renderer.shadowMap.needsUpdate;
    const viewport=renderer.getViewport(new THREE.Vector4());
    try{reflecting=true;original.call(sheet,renderer,scene,camera);diagnostics.captures++;}
    catch(error){diagnostics.failures++;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=auto;renderer.shadowMap.needsUpdate=dirty;renderer.setRenderTarget(target,face,mip);renderer.setViewport(viewport);throw error;}
    finally{reflecting=false;}
  };
  return {group:sheet,diagnostics,update(time=0){if(!disposed)sheet.material.uniforms.time.value=Number.isFinite(time)?time:0;},
    dispose(){if(disposed)return;disposed=true;diagnostics.disposed=true;sheet.removeFromParent();sheet.onBeforeRender=()=>{};try{sheet.dispose();}finally{geometry.dispose();}}};
}
