import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {herbariumAt,herbariumLawnAt,herbariumSoilAt,herbariumCommunitySoilAt} from '../../src/herbarium-layout.js';
import { locations, court, bridges } from '../../src/locations.js';
import {loadPBRTexture,loadImageTexture} from '../../src/asset-cache.js';
import {loadAtmosphereAssets} from '../../src/atmosphere.js';
import {insideAuthoredGarden,landscapeGroves,insideBlossomPark,blossomParks,plantingCommunityAt} from '../../src/environment-layout.js';
import {createGroveTree,createGroveShrub,updateGroveWind} from '../../src/grove-foliage.js';
import {landformAt} from '../../src/landform-layout.js';
import {createFoliageLOD} from '../../src/foliage-lod.js';
import {applyEnvironmentWind,attachWindShadows} from '../../src/environment-wind.js';
import {loadScannedRockAssets,addScannedRocks} from '../../src/rock-scans.js';
import {loadEnvironmentSignage} from '../../src/environment-signage.js';
import {resourceLoader} from '../../src/resource-loader.js';
import {createMineralHighlands} from '../../src/mineral-highlands.js';
import {createLandscapeDepth,applyLandscapeDepthFog} from '../../src/landscape-depth.js';

const TAU=Math.PI*2;
const maps = {};
const materialBindings=new Map(),rockBindings=new Set(),terrainBindings=new Set();
const mountainMaps={},mountainBindings=new Set();
export async function loadMountainArt(options={}){
  const results=await Promise.allSettled(['main','right'].map(async key=>{
    const url=`/art/experience-v5/mineral-mountains${key==='right'?'-right':''}.webp`;
    const texture=await loadImageTexture({id:`mountain-art:${key}`,url,phase:2},options);
    if(options.signal?.aborted)return false;
    mountainMaps[key]=texture;
    for(const material of mountainBindings)if(material.userData.mountainArt===key){material.uniforms.mountainMap.value=texture;material.uniforms.ready.value=1;}
    return true;
  }));
  return results.every(result=>result.status==='fulfilled'&&result.value!==false);
}
const neutralRock=new THREE.DataTexture(new Uint8Array([176,183,173,255]),1,1);neutralRock.colorSpace=THREE.SRGBColorSpace;neutralRock.needsUpdate=true;neutralRock.userData.sharedAsset=true;
const neutralNormal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1),neutralRoughness=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
for(const texture of[neutralNormal,neutralRoughness]){texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;texture.userData.sharedAsset=true;}
const neutralTerrainChannel={color:neutralRock,normal:neutralNormal,roughness:neutralRoughness};
let environment = null;
const wind = { value: 0 };
export async function loadLandscapeSurfaces(options={}) {
  const jobs = ['meadow', 'mossy-rock', 'forest-ground', 'castle-masonry', 'courtyard-paving', 'aged-wood', 'oxidized-copper', 'wool-cloth'].flatMap(name =>
    ['color', 'normal', 'roughness'].map(async kind => {
      const texture = await loadPBRTexture(name,kind,options);
      (maps[name] ||= {})[kind] = texture;
      for(const material of materialBindings.get(name)||[]){material[{color:'map',normal:'normalMap',roughness:'roughnessMap'}[kind]]=texture;material.needsUpdate=true;}
      if(name==='mossy-rock'&&kind==='color')for(const uniform of rockBindings)uniform.value=texture;
      for(const binding of terrainBindings)if(binding.name===name&&binding.kind===kind)binding.uniform.value=texture;
    }));
  const results=await Promise.allSettled(jobs);
  return results.every(result=>result.status==='fulfilled');
}
export async function loadNightEnvironment(scene,options={}){
  const texture=await resourceLoader.load({id:'night-hdr',url:'/textures/environment/night.hdr',phase:3},{...options,parse:buffer=>{
    const data=new HDRLoader().parse(buffer),texture=new THREE.DataTexture(data.data,data.width,data.height,THREE.RGBAFormat,data.type);
    texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.flipY=true;texture.userData.sharedAsset=true;texture.needsUpdate=true;return texture;
  },dispose:texture=>texture.dispose()});
  if(options.signal?.aborted)return false;
  environment=texture;if(scene){scene.environment=texture;scene.environmentIntensity=.14;}
  return true;
}
export async function loadLandscapeAssets(options={}) {
  await Promise.allSettled([loadLandscapeSurfaces(options),loadMountainArt(options),loadAtmosphereAssets(options),loadScannedRockAssets(options),loadEnvironmentSignage(options),loadNightEnvironment(null,options)]);
}

export function noise(x, z) {
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123; return v - Math.floor(v); };
  const a = Math.floor(x), b = Math.floor(z); let u = x - a, v = z - b;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);
}
export function fbm(x,z) { return noise(x,z)*.54 + noise(x*2.03+17,z*2.03+11)*.27 + noise(x*4.17-9,z*4.17)*.13 + noise(x*8.1,z*8.1+3)*.06; }
export function surface(name, extra = {}) {
  const t=maps[name]||{};
  const {albedoStrength,roughnessFloor=.76,...materialOptions}=extra;
  const normal=name==='mossy-rock'?.9:name==='castle-masonry'?.72:.65;
  const m=new THREE.MeshStandardMaterial({color:'#d9d9cb',map:t.color??null,normalMap:t.normal??null,normalScale:new THREE.Vector2(normal,normal),roughnessMap:t.roughness??null,roughness:1,...materialOptions});
  const influence=albedoStrength??(name==='mossy-rock'?.86:name==='castle-masonry'?.76:.82);
  m.userData.surface=name;m.userData.albedoStrength=influence;m.userData.roughnessFloor=roughnessFloor;
  if(!materialBindings.has(name))materialBindings.set(name,new Set());materialBindings.get(name).add(m);
  m.addEventListener('dispose',()=>materialBindings.get(name)?.delete(m));
  m.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 authoredBase=diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb=mix(authoredBase,diffuseColor.rgb,${influence.toFixed(3)});`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;
      #ifdef USE_ROUGHNESSMAP
        roughnessFactor=mix(${roughnessFloor.toFixed(3)},roughness,texture2D(roughnessMap,vRoughnessMapUv).g);
      #endif`);
  };
  m.customProgramCacheKey=()=>`landscape-pbr-${name}-${influence}-${roughnessFloor}`;return m;
}
export function planarUV(geometry, scale=.2) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[];
  for(let i=0;i<p.count;i++) {
    if(n && Math.abs(n.getY(i))<.5) uv.push((Math.abs(n.getX(i))>Math.abs(n.getZ(i))?p.getZ(i):p.getX(i))*scale,p.getY(i)*scale);
    else uv.push(p.getX(i)*scale,p.getZ(i)*scale);
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}
let communityTexture;
function plantingMaterialMap(){
  if(communityTexture)return communityTexture;
  const size=256,data=new Uint8Array(size*size*4);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const wx=(x+.5)/size*288-144,wz=(z+.5)/size*288-144,p=plantingCommunityAt(wx,wz,landformAt(wx,wz)),at=(z*size+x)*4;
    data[at]=Math.round(p.moisture*255);data[at+1]=Math.round(Math.max(p.humus,herbariumSoilAt(wx,wz)*.78)*255);data[at+2]=Math.round(p.rock*255);data[at+3]=Math.round(Math.max(p.opening,herbariumLawnAt(wx,wz))*255);
  }
  communityTexture=new THREE.DataTexture(data,size,size);communityTexture.minFilter=communityTexture.magFilter=THREE.LinearFilter;communityTexture.colorSpace=THREE.NoColorSpace;communityTexture.needsUpdate=true;communityTexture.userData.sharedAsset=true;return communityTexture;
}
export function groundMaterial({transition=false}={}) {
  // Geometry retains its baked colours for exports, but ground no longer uses
  // their broad periodic paint. Detail and transitions live at material scale.
  const m=surface('meadow',{vertexColors:false,color:'#dce2cf',albedoStrength:1,normalScale:new THREE.Vector2(.30,.30),roughness:1});
  m.userData.metresPerRepeat=2.5;
  m.userData.plantingCommunity=true;
  const bindings=[];
  m.addEventListener('dispose',()=>{for(const binding of bindings)terrainBindings.delete(binding);});
  m.onBeforeCompile=shader=>{
    shader.uniforms.plantingMap={value:plantingMaterialMap()};
    for(const [uniformName,name,kind]of[['rockMap','mossy-rock','color'],['humusMap','forest-ground','color'],['mossNormal','mossy-rock','normal'],['humusNormal','forest-ground','normal'],['mossRoughness','mossy-rock','roughness'],['humusRoughness','forest-ground','roughness']]){
      const uniform={value:maps[name]?.[kind]||maps.meadow?.[kind]||neutralTerrainChannel[kind]},binding={name,kind,uniform};
      shader.uniforms[uniformName]=uniform;terrainBindings.add(binding);bindings.push(binding);
    }
    shader.vertexShader=`${transition?'attribute float soilInterior; varying float rootInterior;\n':''}varying vec3 terrainNormal; varying vec3 terrainPosition;\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nterrainNormal=normal; terrainPosition=position;${transition?'rootInterior=soilInterior;':''}`);
    shader.fragmentShader=`${transition?'varying float rootInterior;':''}uniform sampler2D plantingMap,rockMap,humusMap,mossNormal,humusNormal,mossRoughness,humusRoughness;
      varying vec3 terrainNormal; varying vec3 terrainPosition;
      float soilHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float soilNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(soilHash(i),soilHash(i+vec2(1,0)),f.x),mix(soilHash(i+vec2(0,1)),soilHash(i+vec2(1,1)),f.x),f.y);}
      float soilFbm(vec2 p){return soilNoise(p)*.57+soilNoise(p*2.03+17.1)*.29+soilNoise(p*4.13-8.7)*.14;}
      // Three continuously weighted, translated source tiles. No UV rotation:
      // every PBR channel retains the same tangent frame and full texel detail.
      vec2 soilOffset(vec2 cell){return vec2(soilHash(cell),soilHash(cell+71.7))*23.17;}
      vec4 continuousSoil(sampler2D channel,vec2 uv){
        vec2 skew=vec2(uv.x-uv.y*.577350269,uv.y*1.154700538)*.32;
        vec2 cell=floor(skew),f=fract(skew),a,b,c;vec3 weight;
        if(f.x+f.y<1.){a=cell;b=cell+vec2(1,0);c=cell+vec2(0,1);weight=vec3(1.-f.x-f.y,f.x,f.y);}
        else{a=cell+vec2(1);b=cell+vec2(0,1);c=cell+vec2(1,0);weight=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);}
        weight=pow(max(weight,vec3(0.)),vec3(4.));weight/=dot(weight,vec3(1.));
        vec2 dx=dFdx(uv),dy=dFdy(uv);
        return textureGrad(channel,uv+soilOffset(a),dx,dy)*weight.x+textureGrad(channel,uv+soilOffset(b),dx,dy)*weight.y+textureGrad(channel,uv+soilOffset(c),dx,dy)*weight.z;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        diffuseColor*=continuousSoil(map,terrainPosition.xz/2.5);
      #endif
      // Region pigment retains measured texel luminance and physical relief.
      vec4 community=texture2D(plantingMap,(terrainPosition.xz+vec2(144.))/288.);
      vec3 meadowLuminanceWeights=vec3(.2126,.7152,.0722);
      float meadowLuminance=dot(diffuseColor.rgb,meadowLuminanceWeights);
      vec3 meadowPigment=mix(vec3(.69,1.17,.83),vec3(.59,1.19,.86),community.r);
      meadowPigment/=dot(meadowPigment,meadowLuminanceWeights);
      diffuseColor.rgb=mix(diffuseColor.rgb,meadowLuminance*meadowPigment,.78);
      float slope=1.-smoothstep(.55,.94,normalize(terrainNormal).y);
      float fineEdge=soilFbm(terrainPosition.xz*.43+vec2(18,-4));
      float humusWeight=clamp(community.g*(.84+fineEdge*.16)${transition?'+rootInterior*.66':''},0.,.86)*(1.-slope*.65);
      float mossWeight=clamp(slope*.76+community.b*(.32+fineEdge*.21),0.,.86);
      vec2 soilUv=terrainPosition.xz/2.5;
      vec3 humusColor=continuousSoil(humusMap,soilUv).rgb;
      humusColor=mix(humusColor,vec3(dot(humusColor,meadowLuminanceWeights))*vec3(.92,.96,.84),.62)*.79;
      vec3 soilBase=mix(diffuseColor.rgb,humusColor*diffuse,humusWeight);
      diffuseColor.rgb=mix(soilBase,mix(continuousSoil(rockMap,soilUv).rgb,vec3(dot(continuousSoil(rockMap,soilUv).rgb,meadowLuminanceWeights))*vec3(1.12,1.12,1.04),.60)*diffuse,mossWeight);`);
    const normalSample='mix(mix(continuousSoil(normalMap,soilUv).xyz,continuousSoil(humusNormal,soilUv).xyz,humusWeight),continuousSoil(mossNormal,soilUv).xyz,mossWeight) * 2.0 - 1.0';
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0',normalSample));
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;
      #ifdef USE_ROUGHNESSMAP
        float soilRoughness=mix(mix(continuousSoil(roughnessMap,soilUv).g,continuousSoil(humusRoughness,soilUv).g,humusWeight),continuousSoil(mossRoughness,soilUv).g,mossWeight);
        roughnessFactor=mix(.82,1.,soilRoughness);
      #endif`);
  };
  m.customProgramCacheKey=()=> `terrain-translated-community-pbr-v8-${transition}`; return m;
}

export function cliffMaterial(){
  const m=surface('mossy-rock',{vertexColors:true,color:'#ffffff',albedoStrength:1,normalScale:new THREE.Vector2(.82,.82),roughness:1,roughnessFloor:.80});
  const compile=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{
    compile(shader);shader.uniforms.plantingMap={value:plantingMaterialMap()};
    shader.vertexShader='varying vec3 cliffPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncliffPosition=position;');
    shader.fragmentShader='uniform sampler2D plantingMap; varying vec3 cliffPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      float mineralLuminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 mineralFace=vec3(.62,.66,.64)*(.16+mineralLuminance*.78);
      vec3 sourceMineralChroma=clamp(diffuseColor.rgb/max(mineralLuminance,.02),vec3(.68),vec3(1.30));
      mineralFace*=mix(vec3(1.),sourceMineralChroma,.22);
      float moisture=texture2D(plantingMap,(cliffPosition.xz+vec2(144.))/288.).r;
      float wetToe=(1.-smoothstep(-13.,-3.5,cliffPosition.y))*(.42+moisture*.32);
      diffuseColor.rgb=mix(mineralFace,mineralFace*vec3(.62,.76,.79),wetToe);
      #ifdef USE_COLOR
        // Preserve baked regional variation without multiplying two dark albedos.
        float rockVertexLight=dot(vColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb*=clamp(.86+rockVertexLight*.52,.90,1.09);
      #endif`);
  };
  m.customProgramCacheKey=()=> 'cliff-mineral-wet-toe-v7';return m;
}

export function createLake(root, scene) {
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,u=x*128/size,v=y*128/size;
    // Unequal long wind folds retain broad reflections between finer ripples.
    const ripple=Math.sin((x*11+y*4)*TAU/size)*.034+Math.sin((x*29-y*7)*TAU/size)*.013;
    const sx=(noise(u*.15+.2,v*.25)-noise(u*.15-.2,v*.25))*.46+ripple;
    const sy=(noise(u*.15,v*.25+.2)-noise(u*.15,v*.25-.2))*.46+ripple*.32;
    const n=new THREE.Vector3(sx,sy,1).normalize();
    data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;
  }
  const normals=new THREE.DataTexture(data,size,size);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.magFilter=THREE.LinearFilter;normals.minFilter=THREE.LinearMipmapLinearFilter;normals.generateMipmaps=true;normals.anisotropy=4;normals.needsUpdate=true;
  const water=new Water(new THREE.PlaneGeometry(10000,10000),{textureWidth:2048,textureHeight:2048,waterNormals:normals,sunDirection:new THREE.Vector3(-.16,.18,-.84).normalize(),sunColor:'#a8d9ff',waterColor:'#123955',distortionScale:.85,fog:true});
  const reflection=water.material.uniforms.mirrorSampler.value;reflection.generateMipmaps=true;reflection.minFilter=THREE.LinearMipmapLinearFilter;
  water.name='Reflective lake';water.rotation.x=-Math.PI/2;water.position.y=-15;
  water.material.uniforms.size.value=1.85;
  // This field describes the two authored coves, not walkable support or a
  // synthetic island-wide foam ring. Land naturally occludes its inland parts.
  const shoreSize=256,shoreData=new Uint8Array(shoreSize*shoreSize*4);
  for(let z=0;z<shoreSize;z++)for(let x=0;x<shoreSize;x++){
    const wx=(x+.5)/shoreSize*440-220,wz=(z+.5)/shoreSize*440-220,region=landformAt(wx,wz),at=(z*shoreSize+x)*4;
    const breakup=.72+noise(wx*.09,wz*.09)*.28;
    shoreData[at]=Math.round(region.cove*breakup*255);shoreData[at+1]=Math.round(region.terrace*255);shoreData[at+2]=0;shoreData[at+3]=255;
  }
  const shoreMap=new THREE.DataTexture(shoreData,shoreSize,shoreSize);shoreMap.minFilter=shoreMap.magFilter=THREE.LinearFilter;shoreMap.needsUpdate=true;
  Object.assign(water.material.uniforms,{shoreMap:{value:shoreMap},nightFactor:{value:0},shoreDay:{value:new THREE.Color('#4b9c91')},shoreNight:{value:new THREE.Color('#285c68')}});
  water.material.fragmentShader=`uniform sampler2D shoreMap; uniform float nightFactor; uniform vec3 shoreDay,shoreNight;
    float coveHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float coveNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(coveHash(i),coveHash(i+vec2(1,0)),f.x),mix(coveHash(i+vec2(0,1)),coveHash(i+vec2(1,1)),f.x),f.y);}
  `+water.material.fragmentShader;
  water.material.fragmentShader=water.material.fragmentShader
    .replace('vec4 noise = getNoise( worldPosition.xz * size );',`vec2 shoreUv=(worldPosition.xz+vec2(220.))/440.;
      float inShore=step(0.,shoreUv.x)*step(shoreUv.x,1.)*step(0.,shoreUv.y)*step(shoreUv.y,1.);
      vec2 shore=texture2D(shoreMap,clamp(shoreUv,vec2(0.),vec2(1.))).rg*inShore;
      vec4 noise = getNoise( worldPosition.xz * size );
      noise.xy*=.90+shore.g*.24;`)
    .replace('vec3( 1.5, 1.0, 1.5 )','vec3( .9, 1.0, .9 )')
    .replace('100.0, 2.0, 0.5','65.0, 0.55, 0.26')
    .replace('float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );','float reflectance = (rf0 + (1.0-rf0)*pow(1.0-theta,5.0))*(1.-shore.r*.22);')
    .replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;',`vec3 localWater=mix(waterColor,mix(shoreDay,shoreNight,nightFactor),shore.r*.58);
      vec3 scatter=max(.18,dot(surfaceNormal,eyeDirection))*localWater;
      // Unequal, low-amplitude shallow-water patches have no fixed stripe axis.
      vec2 coveFlow=worldPosition.xz*.23+vec2(time*.011,time*.007);
      float coveDetail=coveNoise(coveFlow)*.62+coveNoise(coveFlow*2.17-9.)*.27+coveNoise(coveFlow*4.3+13.)*.11;
      scatter+=mix(vec3(.012,.032,.027),vec3(.007,.018,.021),nightFactor)*(coveDetail-.5)*shore.r;`);
  applyLandscapeDepthFog(water.material,{horizon:true});
  root.add(water);
  // Reflection is refreshed at a controlled cadence; the live surface still moves every frame.
  const reflect=water.onBeforeRender;let frame=0;
  water.onBeforeRender=function(...args){if(args[1].overrideMaterial)return;if(frame++%5===0)reflect.apply(this,args);};
  // Game disposes scene materials, but uniform-only textures/targets need an owner.
  let disposed=false;
  water.material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;normals.dispose();shoreMap.dispose();reflection.renderTarget.dispose();});
  if(environment&&scene){scene.environment=environment;scene.environmentIntensity=.14;}
  return {update(time,reduced){water.material.uniforms.time.value=reduced?0:time*.18;wind.value=reduced?0:time;updateGroveWind(time,reduced);},water};
}

function leafMaterial(map,color='#b4c8dd',silvering=0) {
  const m=new THREE.MeshStandardMaterial({map,alphaTest:.30,side:THREE.DoubleSide,color,roughness:.91,metalness:0});
  m.onBeforeCompile=shader=>{
    shader.uniforms.windTime=wind;
    shader.uniforms.leafSilvering={value:silvering};
    shader.fragmentShader='uniform float leafSilvering;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float leafLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(diffuseColor.rgb,(.075+leafLight*1.5)*vec3(.97,1.22,1.09),leafSilvering);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=diffuseColor.rgb*.045;
      #include <opaque_fragment>`);
  };
  applyEnvironmentWind(m,{amplitude:.18,minHeight:0,maxHeight:.7});return m;
}
export function createTreeSpecimen(kind='pine') {
  const variant=kind==='ash'?'silver':kind;
  return createGroveTree(variant,221);
}

export function createVegetation(root,heightAt,nearPath=()=>false,{lod=false,trees=true}={}) {
  let state=48623;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
  const bridgeSpans=Object.values(bridges).map(([a,b])=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return {x:a[0],z:a[1],length,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length};});
  const bridgeClear=p=>!bridgeSpans.some(b=>{const along=(p.x-b.x)*b.dx+(p.z-b.z)*b.dz,across=(p.x-b.x)*b.dz-(p.z-b.z)*b.dx;return along>-3&&along<b.length+3&&Math.abs(across)<4.5;});
  const placementClear=p=>bridgeClear(p)&&!herbariumAt(p.x,p.z,.7);
  const dummy=new THREE.Object3D();
  const batch=(geo,mat,placements,name,shadow=true)=>{
    // Filter at assembly, after all seeded sampling. A bridge exclusion must
    // not consume different random values or move plants elsewhere in the map.
    placements=placements.filter(placementClear);
    if(!placements.length)return;
    const mesh=new THREE.InstancedMesh(geo,mat,placements.length);mesh.name=name;
    placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.r||0,p.rz||0);dummy.scale.set(p.sx||p.s||1,(p.sy||p.s||1)*(name==='Grouped silver green ground cover'?1-herbariumLawnAt(p.x,p.z)*.70:1),p.sz||p.s||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;attachWindShadows(mesh);mesh.computeBoundingSphere();root.add(mesh);return mesh;
  };
  const kinds=['pine','silver','cherry'],groups=kinds.map(()=>[]),placed=[];
  const clear=(x,z)=>insideAuthoredGarden(x,z,3)||locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius+4)||nearPath(x,z)||Math.hypot(x-court.x,z-court.z)<13;
  const gardenWalks=blossomParks.map(park=>({park,points:new THREE.CatmullRomCurve3(park.path.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(180)}));
  // Low plants fill tree setbacks; their roots clear paving, with soft frond overhang at margins.
  const lowClear=(x,z)=>insideAuthoredGarden(x,z,.7)||locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius+1.4)||nearPath(x,z)||Math.hypot(x-court.x,z-court.z)<13||gardenWalks.some(({park,points})=>Math.hypot(x-park.overlook[0],z-park.overlook[1])<3.5||points.some(p=>Math.hypot(x-p.x,z-p.z)<2.2));
  // A broad approach corridor frames the castle and stays clear of tall crowns.
  const treeClear=(x,z)=>clear(x,z)||Math.pow((x-court.x-6)/32,2)+Math.pow((z-court.z-14)/42,2)<1||nearPath(x+5,z)||nearPath(x-5,z)||nearPath(x,z+5)||nearPath(x,z-5);
  const sampleIsland=()=>{const grove=landscapeGroves[Math.floor(rand()*landscapeGroves.length)],a=rand()*TAU,r=Math.sqrt(rand())*.95;return{x:grove.x+Math.cos(a)*grove.rx*r,z:grove.z+Math.sin(a)*grove.rz*r,kind:grove.kind};};
  for(let j=0;j<1800&&placed.length<64;j++){
    const{x,z,kind}=sampleIsland(),h=heightAt(x,z);
    if(h<.5||treeClear(x,z)||insideBlossomPark(x,z)||noise(x*.044+9,z*.044)<.3)continue;
    if(placed.some(p=>Math.hypot(x-p.x,z-p.z)<6.8))continue;
    const k=kinds.indexOf(kind),foreground=x>25&&z>court.z-8;
    const p={x,y:h-.12,z,s:(.78+rand()*.33)*(foreground?.76:1),r:rand()*6.28};groups[k].push(p);placed.push(p);
  }
  const lodController=lod&&trees?createFoliageLOD(root,kinds.map((kind,k)=>({kind,seed:168+k*331,placements:groups[k].filter(placementClear)}))):null;
  if(!lod&&trees)for(let k=0;k<kinds.length;k++){
    if(!groups[k].length)continue;
    const specimen=createGroveTree(kinds[k],168+k*331);
    batch(specimen.branchesMesh.geometry,specimen.branchesMesh.material,groups[k],`Garden trunks ${k}`);
    batch(specimen.leavesMesh.geometry,specimen.leavesMesh.material,groups[k],`Garden ${kinds[k]} crowns ${k}`);
  }
  const understory=[];
  for(const [i,p]of placed.entries())for(let n=0;n<3;n++){
    const a=i*.73+n*2.2,x=p.x+Math.cos(a)*2.5,z=p.z+Math.sin(a)*2.2;
    if(clear(x,z)||heightAt(x,z)<.5)continue;
    understory.push({x,y:heightAt(x,z)-.03,z,s:.82+(n%3)*.24,r:a});
  }
  const shrubSource=createGroveShrub('silver',24);
  batch(shrubSource.leavesMesh.geometry,shrubSource.leavesMesh.material,understory,'Leafy grove understory');
  batch(shrubSource.branchesMesh.geometry,shrubSource.branchesMesh.material,understory,'Fine understory stems');
  // Reusable eroded outcrops: actual surface deformation and scanned mossy rock.
  const rocks=[],pebbles=[],grass=[],flowers=[],litter=[];
  for(let j=0;j<540;j++){
    const{x,z}=sampleIsland(),h=heightAt(x,z);if(h<.4||clear(x,z))continue;
    if(j%12===0)rocks.push({x,y:h-.35,z,sx:1.1+rand()*1.7,sy:.55+rand()*1.1,sz:1+rand()*1.5,r:rand()*6.28});
    else if(j%8===0)pebbles.push({x,y:h,z,s:.17+rand()*.25,r:rand()*6.28});
  }
  const ferns=[];
  for(let j=0;j<74000;j++){
    const x=(rand()-.5)*255,z=(rand()-.5)*250+12,h=heightAt(x,z);
    if(h<.6||lowClear(x,z))continue;
    const region=plantingCommunityAt(x,z,landformAt(x,z));
    if(rand()<region.grass)grass.push({x,y:h-.025,z,s:(.64+rand()*.79)*(1-region.opening*.35),r:rand()*TAU});
    if(rand()<region.flowers*.42)flowers.push({x,y:h-.01,z,sx:(.54+rand()*.48)*(.72+region.flowers*.28),sy:.54+rand()*.61,sz:(.58+rand()*.43)*(.72+region.flowers*.28),r:rand()*TAU,kind:region.kind});
    if(rand()<region.ferns*.38)ferns.push({x,y:h-.02,z,s:.69+rand()*.64,r:rand()*TAU});
    if(rand()<region.rock*.018)pebbles.push({x,y:h-.07,z,s:.16+rand()*.33,r:rand()*TAU});
  }
  // Small, irregular ground-contact leaves link each root to its soil pocket.
  // Sample every individual leaf at the actual rendered height, never a flat mat.
  const rootSites=[...placed,...blossomParks.flatMap(park=>park.trees.map(([x,z,s])=>({x,z,s,kind:park.kind})))];
  for(const tree of rootSites)for(let n=0;n<72;n++){
    const a=rand()*TAU,r=(.35+Math.pow(rand(),.65)*2.0)*(tree.s||1),x=tree.x+Math.cos(a)*r,z=tree.z+Math.sin(a)*r,h=heightAt(x,z);
    if(h<.6||lowClear(x,z))continue;
    litter.push({x,y:h+.018,z,s:.34+rand()*.52,r:rand()*TAU,kind:tree.kind});
  }

  // Mown arrival keeps its grass blades; taller low plants are removed only
  // after all seeded sampling is complete.
  for(const placements of [flowers,ferns,litter])for(let i=placements.length-1;i>=0;i--)if(herbariumLawnAt(placements[i].x,placements[i].z)>.55)placements.splice(i,1);
  for(const placements of [grass,flowers,ferns,litter])for(let i=placements.length-1;i>=0;i--)if(herbariumCommunitySoilAt(placements[i].x,placements[i].z)>.30)placements.splice(i,1);
  addScannedRocks(root,[...rocks.map((p,i)=>({...p,kind:'moss',piece:i%7,sy:(p.sy||1)*.7})),...pebbles.map((p,i)=>({...p,kind:'moss',piece:i%7}))].filter(placementClear),'Scanned mossy grove stones');
  const vertices=[],colors=[],indices=[],uv=[],c=new THREE.Color();
  for(let b=0;b<32;b++){
    const a=rand()*6.28,bx=(rand()-.5)*.4,bz=(rand()-.5)*.4,h=.18+rand()*.35,w=.014+rand()*.022,at=vertices.length/3;
    for(let row=0;row<7;row++){
      const t=row/6,lean=t*t*.32;
      for(const side of [-1,1]){
        vertices.push(bx+Math.cos(a)*(side*w*(1-t)+lean),t*h,bz+Math.sin(a)*(side*w*(1-t)+lean));uv.push(side===-1?0:1,t);
        c.set('#53785b').lerp(new THREE.Color('#b1c795'),t*.82);colors.push(c.r,c.g,c.b);
      }
      if(row<6){const q=at+row*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
    }
  }
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));gg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));gg.setIndex(indices);gg.computeVertexNormals();
  const gm=leafMaterial(null,'#d3dac1');gm.vertexColors=true;gm.alphaTest=0;batch(gg,gm,grass,'Grouped silver green ground cover',false);
  // Seven arching fronds with paired curved leaflets: one instanced geometry,
  // continuous shaded understory without adding a draw call for each plant.
  const fp=[],fc=[],fi=[],fernDark=new THREE.Color('#315941'),fernLight=new THREE.Color('#829b59');
  for(let frond=0;frond<7;frond++){
    const angle=frond*2.399,length=.74+(frond%3)*.14;
    const point=(t,side,width)=>new THREE.Vector3(Math.cos(angle)*t*length-Math.sin(angle)*side*width,Math.sin(t*Math.PI*.84)*.52+.025,Math.sin(angle)*t*length+Math.cos(angle)*side*width);
    for(let row=1;row<10;row++)for(const side of[-1,1]){
      const t=row/11,w=Math.sin(t*Math.PI)*.19,base=point(t,0,0),tip=point(t+.11,side,w),mid=base.clone().lerp(tip,.5);mid.y+=.028;
      const left=point(t-.025,side,w*.48),right=point(t+.055,side,w*.52),at=fp.length/3;
      for(const [i,v]of[base,left,tip,right,mid].entries()){fp.push(v.x,v.y,v.z);const c=fernDark.clone().lerp(fernLight,t*.58+(i===4?.16:0));fc.push(c.r,c.g,c.b);}
      fi.push(at,at+1,at+4,at+1,at+2,at+4,at+2,at+3,at+4,at+3,at,at+4);
    }
  }
  const fernGeometry=new THREE.BufferGeometry();fernGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fernGeometry.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));fernGeometry.setIndex(fi);fernGeometry.computeVertexNormals();
  const fernMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,side:THREE.DoubleSide});applyEnvironmentWind(fernMaterial,{amplitude:.027,minHeight:0,maxHeight:.7});
  batch(fernGeometry,fernMaterial,ferns,'Layered arching fern beds');
  // Curved petals and stems remain three-dimensional when seen from above.
  const petals=[],stems=[],centres=[];
  for(let n=0;n<5;n++){
    const x=(rand()-.5)*.7,z=(rand()-.5)*.7,h=.22+rand()*.26;
    const stem=new THREE.CylinderGeometry(.009,.014,h,8,3);stem.translate(x,h/2,z);stems.push(stem);
    const centre=new THREE.SphereGeometry(.034,12,8);centre.scale(1,.5,1);centre.translate(x,h+.014,z);centres.push(centre);
    for(let k=0;k<6;k++){
      const angle=k*TAU/6+n*.71,p=[],uv=[],idx=[];
      for(let row=0;row<=8;row++)for(let col=0;col<=4;col++){
        const t=row/8,v=col/2-1,width=Math.pow(Math.sin(Math.PI*t),.65)*.066;
        const radial=.018+t*.165,lateral=v*width;
        p.push(x+Math.cos(angle)*radial-Math.sin(angle)*lateral,h+.01+Math.sin(t*Math.PI)*.045+t*t*.023+v*v*.009,z+Math.sin(angle)*radial+Math.cos(angle)*lateral);uv.push((v+1)/2,t);
        if(row<8&&col<4){const a=row*5+col;idx.push(a,a+5,a+1,a+1,a+5,a+6);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();petals.push(g);
    }
  }
  const flowerMaterial=color=>{
    const material=new THREE.MeshStandardMaterial({color,roughness:.88,side:THREE.DoubleSide});
    applyEnvironmentWind(material,{amplitude:.035,minHeight:0,maxHeight:.8});return material;
  };
  const petalMaterial=flowerMaterial('#ffffff');
  const flowerMesh=batch(mergeGeometries(petals),petalMaterial,flowers,'Sculpted lavender meadow flowers',false);
  if(flowerMesh){const color=new THREE.Color();let instance=0;flowers.forEach(p=>{if(!placementClear(p))return;color.set(p.kind==='cherry'?'#e5bbc9':p.kind==='lilac'?'#bdb8df':'#e5e0bf').multiplyScalar(.92+noise(p.x*.65,p.z*.65)*.12);flowerMesh.setColorAt(instance++,color);});flowerMesh.instanceColor.needsUpdate=true;}
  batch(mergeGeometries(stems),flowerMaterial('#608259'),flowers,'Meadow flower stems',false);
  batch(mergeGeometries(centres),flowerMaterial('#ddbf69'),flowers,'Golden meadow flower centres',false);
  [...petals,...stems,...centres].forEach(g=>g.dispose());
  const litterPositions=[],litterIndices=[];
  for(let row=0;row<=6;row++)for(let side=0;side<=2;side++){
    const t=row/6,w=Math.sin(t*Math.PI)*.055,lateral=(side-1)*w;litterPositions.push(lateral,.016*Math.sin(t*Math.PI)+(side===1?.009:0),t*.20);
    if(row<6&&side<2){const at=row*3+side;litterIndices.push(at,at+3,at+1,at+1,at+3,at+4);}
  }
  const litterGeometry=new THREE.BufferGeometry();litterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(litterPositions,3));litterGeometry.setIndex(litterIndices);litterGeometry.computeVertexNormals();
  const litterMesh=batch(litterGeometry,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,side:THREE.DoubleSide}),litter,'Grounded leaves and blossom litter',false);
  if(litterMesh){const color=new THREE.Color();let index=0;for(const p of litter){if(!placementClear(p))continue;color.set(p.kind==='cherry'?'#b69291':p.kind==='lilac'?'#aaa2b1':'#8e9371');litterMesh.setColorAt(index++,color);}litterMesh.instanceColor.needsUpdate=true;}
  return {treeCount:placed.filter(placementClear).length,treeLimit:64,flowerTreeCount:groups[2].filter(placementClear).length,understoryCount:understory.filter(placementClear).length,grassCount:grass.filter(placementClear).length,flowerCount:flowers.filter(placementClear).length,fernCount:ferns.filter(placementClear).length,litterCount:litter.filter(placementClear).length,groveCount:landscapeGroves.length,lod:lodController?.stats??null,lodController,update:(camera,viewport)=>lodController?.update(camera,viewport)};
}

export function createBackdrop(root,scene){
  const result=createMineralHighlands(root,{rockMap:maps['mossy-rock']?.color||neutralRock,wind,mountainMaps});
  for(const material of result.materials){rockBindings.add(material.uniforms.rockMap);material.addEventListener('dispose',()=>rockBindings.delete(material.uniforms.rockMap));}
  for(const material of result.matteMaterials){mountainBindings.add(material);material.addEventListener('dispose',()=>mountainBindings.delete(material));}
  result.depth=createLandscapeDepth(result.group,{rockMaterial:cliffMaterial,wind,fogColor:scene?.fog?.color});
  return result;
}
