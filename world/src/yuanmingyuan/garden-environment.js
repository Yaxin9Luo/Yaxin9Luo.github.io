import {fetchPublicAsset} from '../public-asset-url.js';
import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {EnvironmentClock} from '../environment-time.js';
import {rotateMuseumLightingSample} from './museum-lighting-sample.js';

const vertex=`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment=`
  varying vec3 vDirection;
  uniform vec3 zenith,horizon,cloudColor,sunDirection,moonDirection,keyColor;
  uniform float time,night;
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float value=0.,amp=.5;for(int i=0;i<5;i++){value+=amp*noise(p);p=p*2.03+11.7;amp*=.5;}return value;}
  void main(){
    vec3 d=normalize(vDirection);float h=max(0.,d.y);
    vec3 col=mix(horizon,zenith,pow(h,.45));
    vec3 p=d/(.22+h)*vec3(3.2,1.,3.2)+vec3(time*.0018,0.,time*.0006);
    float density=smoothstep(.47,.72,fbm(p));float wisps=smoothstep(.58,.77,fbm(p*2.7+17.))*0.15;
    float cloud=(density+wisps)*smoothstep(-.025,.14,d.y)*.77;
    col=mix(col,cloudColor,cloud);
    float sunDot=max(0.,dot(d,sunDirection));
    col+=keyColor*(pow(sunDot,90.)*.18+smoothstep(.99984,.99993,sunDot)*4.)*(1.-night)*(1.-cloud*.8);
    float moonDot=max(0.,dot(d,moonDirection)),moon=smoothstep(.99979,.99988,moonDot);
    float crater=.80+.20*fbm(d*490.);col+=vec3(.80,.88,1.)*(moon*crater*1.7+pow(moonDot,220.)*.10)*night*(1.-cloud);
    vec3 starCell=floor(d*880.);float star=step(.99905,hash(starCell))*pow(max(0.,1.-length(fract(d*880.)-.5)*1.8),4.);
    col+=vec3(.67,.77,1.)*star*night*(1.-cloud)*smoothstep(.02,.2,d.y)*2.2;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export async function createGardenEnvironment({renderer,scene,signal,timeMode='auto',phase=.40,lightYaw=0}={}){
  if(!Number.isFinite(lightYaw))throw new TypeError('Finite museum light yaw required.');
  const clock=new EnvironmentClock(timeMode,{phase,duration:720}),group=new THREE.Group();group.name='Museum daylight and sky';
  const uniforms={time:{value:0},night:{value:0}};
  for(const name of ['zenith','horizon','cloudColor','keyColor'])uniforms[name]={value:new THREE.Color()};
  for(const name of ['sunDirection','moonDirection'])uniforms[name]={value:new THREE.Vector3()};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(9000,64,32),new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.BackSide,depthWrite:false}));sky.name='Garden sky';sky.frustumCulled=false;sky.renderOrder=-100;
  const key=new THREE.DirectionalLight(0xfff3dc,3),fill=new THREE.HemisphereLight(0xcfe1ec,0xa1a887,.6),bounce=new THREE.DirectionalLight(0xd4e7e8,.3);
  key.castShadow=true;key.shadow.mapSize.set(4096,4096);key.shadow.camera.near=1;key.shadow.camera.far=900;key.shadow.bias=-.00004;key.shadow.normalBias=.035;
  group.add(sky,key,key.target,fill,bounce);scene.add(group);
  scene.fog=new THREE.Fog(0xc0d4d6,3800,10000);let pmrem=null,envTarget=null,sourceTexture=null,disposed=false,elapsed=0,sample=null;
  function update(dt,{paused=false,reducedMotion=false,focus=new THREE.Vector3(),shadowSpan=100}={}){
    if(disposed)return sample;elapsed+=paused?0:Math.max(0,dt);sample=clock.update(dt,{paused,reducedMotion});
    if(lightYaw!==0)sample=rotateMuseumLightingSample(sample,lightYaw);
    uniforms.time.value=elapsed;uniforms.night.value=sample.night;
    uniforms.zenith.value.copy(sample.zenith);uniforms.horizon.value.copy(sample.horizon);uniforms.cloudColor.value.copy(sample.cloud);uniforms.keyColor.value.copy(sample.key);
    uniforms.sunDirection.value.copy(sample.sunDirection);uniforms.moonDirection.value.copy(sample.moonDirection);
    key.color.copy(sample.key);key.intensity=sample.keyIntensity;
    key.position.copy(focus).addScaledVector(sample.lightDirection,400);key.target.position.copy(focus);
    key.shadow.intensity=sample.shadowIntensity;const span=Math.max(60,Math.min(1800,shadowSpan));
    Object.assign(key.shadow.camera,{left:-span,right:span,top:span,bottom:-span,far:Math.max(900,span*2+400)});key.shadow.camera.updateProjectionMatrix();
    fill.color.copy(sample.sky);fill.groundColor.copy(sample.ground);fill.intensity=sample.ambientIntensity*.56;
    bounce.color.copy(sample.fill);bounce.intensity=sample.fillIntensity*.5;bounce.position.copy(focus).add(new THREE.Vector3(-200,130,200));
    scene.environmentIntensity=.30-.12*sample.night;scene.fog.color.copy(sample.fog);renderer.toneMappingExposure=1.05;
    return sample;
  }
  function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);group.removeFromParent();sky.geometry.dispose();sky.material.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();if(scene.environment===envTarget?.texture)scene.environment=null;envTarget?.dispose();sourceTexture?.dispose();pmrem?.dispose();group.clear();}
  try{
    signal?.throwIfAborted();const response=await fetchPublicAsset('/textures/environment/sky.hdr',{signal});if(!response.ok)throw new Error(`Garden light environment HTTP ${response.status}`);
    const buffer=await response.arrayBuffer();signal?.throwIfAborted();
    // Preserve the loader's orientation, linear color/filter metadata and upload revision.
    sourceTexture=new HDRLoader().createDataTexture(buffer);sourceTexture.mapping=THREE.EquirectangularReflectionMapping;
    pmrem=new THREE.PMREMGenerator(renderer);envTarget=pmrem.fromEquirectangular(sourceTexture);scene.environment=envTarget.texture;sourceTexture.dispose();sourceTexture=null;pmrem.dispose();pmrem=null;
    signal?.addEventListener('abort',dispose,{once:true});update(0);
  }catch(error){dispose();throw error;}
  return {group,clock,update,dispose,get sample(){return sample;}};
}
