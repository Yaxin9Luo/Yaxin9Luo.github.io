import * as THREE from 'three';
import { sampleEnvironment, TIME_PHASES } from './environment-time.js';
import {createPaperLantern} from './sky-fauna.js';
import {createFaunaPopulation} from './fauna-population.js';
import {loadImageTexture} from './asset-cache.js';

const assets = {};
let loading;
const skyBindings=new Set(),moonBindings=new Set();
export const moonDirection = new THREE.Vector3(-.16, .18, -.84).normalize();

/** Called by the landscape preload. Importing this module never touches the DOM. */
export function loadAtmosphereAssets(options={}) {
  if (typeof document === 'undefined') return Promise.resolve(assets);
  if (!loading) loading = Promise.allSettled([
    ['sky', '/art/academy/cloud-panorama.webp'],
    ['moon', '/art/night-garden/moon-lroc-2k.jpg'],
    ['blossoms', '/art/night-garden/blossom-atlas.webp'],
  ].map(async ([key, path]) => {
    const texture = await loadImageTexture({id:`atmosphere:${key}`,url:path,phase:2},options);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = key === 'blossoms' ? 8 : 2;
    texture.name = path;
    assets[key] = texture;
    for(const uniforms of key==='sky'?skyBindings:key==='moon'?moonBindings:[]){uniforms[key==='sky'?'skyMap':'moonMap'].value=texture;uniforms.hasMap.value=1;}
  })).then(results => {const ready=results.every(result=>result.status==='fulfilled');if(!ready)loading=null;return ready;});
  return loading;
}

export function blossomTexture() { return assets.blossoms || null; }

function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function haloMaterial(color, opacity, falloff = 3) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: opacity }, falloff: { value: falloff } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float opacity; uniform float falloff;
      void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),falloff)*opacity;
      gl_FragColor=vec4(tint,a);
      #include <colorspace_fragment>
      }`,
  });
}

/** Retained public factory, using the accepted full paper-lantern recipe. */
export function createSkyLantern(){return createPaperLantern();}

export function createAtmosphere(scene, { heightAt=()=>6, lanternCount=26, fireflyCount=90, birdCount=12, direction=moonDirection } = {}) {
  const root=new THREE.Group();root.name='Moonlit garden atmosphere';scene.add(root);
  let disposed=false,ownedDisposed=false;
  const solarDirection=new THREE.Vector3();
  const rand=randomSource(918472),dir=new THREE.Vector3().copy(direction).normalize();
  scene.background = new THREE.Color('#0c2446');
  const initial = sampleEnvironment(TIME_PHASES.night);solarDirection.copy(initial.sunDirection);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(930,48,24),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,depthTest:false,toneMapped:false,
    uniforms:{skyMap:{value:assets.sky||null},hasMap:{value:assets.sky?1:0},
      fogTint:{value:initial.fog.clone()},zenith:{value:initial.zenith.clone()},horizon:{value:initial.horizon.clone()},cloudTint:{value:initial.cloud.clone()},
      sunDirection:{value:initial.sunDirection.clone()},night:{value:1},skyTime:{value:0},cloudBlend:{value:initial.cloudBlend}},
    vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 skyDirection;uniform sampler2D skyMap;uniform float hasMap;
      uniform vec3 fogTint,zenith,horizon,cloudTint,sunDirection;uniform float night,skyTime,cloudBlend;
      void main(){
        vec3 d=normalize(skyDirection);float h=max(0.,d.y);
        vec2 uv=vec2(fract(atan(d.z,d.x)/6.2831853+.5+skyTime*.00035),clamp(.06+asin(clamp(d.y,0.,1.))/1.5707963*.9,.01,.99));
        vec3 source=texture2D(skyMap,uv).rgb;
        // The starless texture contributes cloud structure only. All lighting
        // comes from the shared environment palette, including cloud shadows.
        float cloud=smoothstep(.16,.8,source.r)*hasMap;
        float seam=abs(fract(uv.x)-.5)*2.;cloud*=(1.-smoothstep(.97,1.,seam))*smoothstep(.015,.16,d.y);
        vec3 c=mix(horizon,zenith,pow(clamp(h,0.,1.),.46));
        float sunlight=pow(max(0.,dot(d,sunDirection)),8.)*(1.-night)*.18;
        c=mix(c,cloudTint*(.78+.28*source.r),cloud*cloudBlend);
        c+=vec3(.58,.28,.10)*sunlight;
        // The far-clipped lake is fully fogged. Give the sky below and just
        // above that horizon the identical linear fog colour, so the clip
        // boundary cannot become a ruler-straight pale-water/blue-sky seam.
        c=mix(fogTint,c,smoothstep(.01,.11,d.y));
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
  }));sky.name='Authored day and night cloud sky';sky.renderOrder=-1000;sky.frustumCulled=false;root.add(sky);
  // A sky is infinitely distant: keep its angular horizon centred on the active
  // view, including the water's reflected camera, instead of the island origin.
  bindCelestialPass(sky,null,0);
  skyBindings.add(sky.material.uniforms);sky.material.addEventListener('dispose',()=>skyBindings.delete(sky.material.uniforms));

  const moon=new THREE.Mesh(new THREE.SphereGeometry(20,48,32),new THREE.ShaderMaterial({
    uniforms:{moonMap:{value:assets.moon||null},hasMap:{value:assets.moon?1:0},opacity:{value:1}},toneMapped:false,transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;varying vec3 n;void main(){vUv=uv;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;varying vec3 n;uniform sampler2D moonMap;uniform float hasMap,opacity;
      void main(){vec3 a=texture2D(moonMap,vUv).rgb;float detail=mix(.75,dot(a,vec3(.2126,.7152,.0722)),hasMap);
      detail=clamp((detail-.18)*1.65+.12,0.,1.);
      float limb=.74+.26*pow(max(0.,n.z),.35);vec3 c=vec3(.70,.85,1.)*(.10+detail*.85)*limb;
      gl_FragColor=vec4(c,opacity);
      #include <colorspace_fragment>
      }`,
  }));moon.position.copy(dir).multiplyScalar(760);moon.rotation.y=-1.3;moon.name='LROC detailed full moon';moon.renderOrder=-100;root.add(moon);
  moonBindings.add(moon.material.uniforms);moon.material.addEventListener('dispose',()=>moonBindings.delete(moon.material.uniforms));
  const moonHalo=new THREE.Mesh(new THREE.PlaneGeometry(155,155),haloMaterial('#8bc9ff',.19,3));
  moonHalo.position.copy(moon.position).multiplyScalar(.994);moonHalo.name='Soft lunar corona';moonHalo.renderOrder=-110;root.add(moonHalo);

  const sun = new THREE.Mesh(new THREE.SphereGeometry(8,24,16),new THREE.MeshBasicMaterial({color:'#fff1d0',toneMapped:false,fog:false,transparent:true,depthWrite:false}));
  sun.name='Moving sun';sun.renderOrder=-100;root.add(sun);
  const sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(145,145),haloMaterial('#ffdab5',.25,2.8));
  sunHalo.name='Soft sunlight';sunHalo.renderOrder=-110;root.add(sunHalo);

  const starPositions=[],starColors=[];
  for(let i=0;i<1800;i++){
    const az=rand()*Math.PI*2,y=.04+rand()*.92,radial=Math.sqrt(1-y*y),r=870;
    starPositions.push(Math.cos(az)*radial*r,y*r,Math.sin(az)*radial*r);
    const c=new THREE.Color().setHSL(.56+rand()*.12,.15,.64+rand()*.3);starColors.push(c.r,c.g,c.b);
  }
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:1.1,vertexColors:true,transparent:true,opacity:.82,depthWrite:false,toneMapped:false,sizeAttenuation:false,fog:false}));stars.name='Sparse silver stars';stars.renderOrder=-120;root.add(stars);
  stars.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_particle_fragment>',`#include <map_particle_fragment>
    vec2 starDisc=gl_PointCoord*2.-1.;float starRadius=dot(starDisc,starDisc);
    if(starRadius>1.)discard;
    diffuseColor.a*=1.-smoothstep(.15,1.,starRadius);`);};
  stars.material.customProgramCacheKey=()=> 'soft-circular-stars-v1';

  const fauna=createFaunaPopulation({heightAt,lanternCount,fireflyCount,birdCount});root.add(fauna.root);
  bindCelestialPass(stars,null,0);
  bindCelestialPass(moon,dir,760);
  bindCelestialPass(moonHalo,dir,760*.994,{billboard:true});
  bindCelestialPass(sun,solarDirection,780);
  bindCelestialPass(sunHalo,solarDirection,780*.994,{billboard:true});

  function bindCelestialPass(object,direction,distance,{billboard=false}={}){
    const worldCenter=new THREE.Vector3(),parentRotation=new THREE.Quaternion(),cameraRotation=new THREE.Quaternion(),authoredRotation=object.quaternion.clone();
    // Culling happens before onBeforeRender. A previous camera-relative center
    // must never prevent the next actual pass from positioning an infinite body.
    object.frustumCulled=false;
    object.onBeforeRender=(_renderer,_scene,camera)=>{
      if(disposed)return;camera.getWorldPosition(worldCenter);if(direction)worldCenter.addScaledVector(direction,distance);
      root.worldToLocal(worldCenter);object.position.copy(worldCenter);root.getWorldQuaternion(parentRotation).invert();
      if(billboard){camera.getWorldQuaternion(cameraRotation);object.quaternion.copy(parentRotation).multiply(cameraRotation);}
      else object.quaternion.copy(parentRotation).multiply(authoredRotation);
      object.updateMatrixWorld(true);
    };
  }
  function resources(){
    const geometries=new Set(),materials=new Set(),directTextures=new Set(),uniformTextures=new Set(),visited=new Set();
    const uniformValue=value=>{
      if(!value||typeof value!=='object'||visited.has(value))return;visited.add(value);
      if(value.isTexture){uniformTextures.add(value);return;}for(const child of Object.values(value))uniformValue(child);
    };
    root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){
      materials.add(material);for(const value of Object.values(material))if(value?.isTexture)directTextures.add(value);uniformValue(material.uniforms);
    }});return{geometries,materials,directTextures,uniformTextures};
  }
  function releaseResources(){
    if(disposed)return;disposed=true;skyBindings.delete(sky.material.uniforms);moonBindings.delete(moon.material.uniforms);fauna.releaseResources();
    const {directTextures,uniformTextures}=resources();
    for(const texture of uniformTextures)if(!texture.userData.sharedAsset&&!directTextures.has(texture))texture.dispose();
  }

  return {
    root, moonDirection:dir, lanternCount:fauna.lanternCount, manualLanternCapacity:fauna.manualLanternCapacity,fauna,
    get activityTime(){return fauna.motion.time;},releaseResources,
    setEnvironment(environment){
      if(disposed)return;const u=sky.material.uniforms;
      for(const key of ['zenith','horizon'])u[key].value.copy(environment[key]);
      u.fogTint.value.copy(environment.fog);
      u.cloudTint.value.copy(environment.cloud);u.night.value=environment.night;u.sunDirection.value.copy(environment.sunDirection);u.cloudBlend.value=environment.cloudBlend??.83;
      dir.copy(environment.moonDirection);solarDirection.copy(environment.sunDirection);
      moon.position.copy(dir).multiplyScalar(760);moon.visible=environment.night>.02&&dir.y>-.05;moon.material.uniforms.opacity.value=environment.night;
      moonHalo.position.copy(moon.position).multiplyScalar(.994);moonHalo.visible=moon.visible;moonHalo.material.uniforms.opacity.value=.19*environment.night;
      sun.position.copy(environment.sunDirection).multiplyScalar(780);sun.visible=environment.night<.95&&environment.sunDirection.y>0;
      sunHalo.position.copy(sun.position).multiplyScalar(.994);sunHalo.visible=sun.visible;sunHalo.material.uniforms.opacity.value=.25*(1.-environment.night);
      stars.material.opacity=.86*environment.night;stars.visible=environment.night>.02;
      fauna.setEnvironment(environment);
    },
    resetActivityForReview(time=0,reduced=false){if(disposed)return;fauna.resetActivityForReview(time,reduced);sky.material.uniforms.skyTime.value=fauna.motion.time;},
    releaseLantern(position){return disposed?false:fauna.releaseLantern(position);},
    update(_time,dt=0,reduced=false,context={}){
      if(disposed)return;fauna.update(dt,reduced,context);sky.material.uniforms.skyTime.value=fauna.motion.time;
    },
    dispose(){
      if(ownedDisposed)return;ownedDisposed=true;releaseResources();const {geometries,materials,directTextures}=resources();
      for(const collection of [geometries,materials,directTextures])for(const resource of collection)if(!resource.userData.sharedAsset)resource.dispose();
      root.removeFromParent();
    },
  };
}
