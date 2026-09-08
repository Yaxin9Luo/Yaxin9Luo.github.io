import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { locations, court, bridges } from './locations.js';
import {loadPBRTexture} from './asset-cache.js';
import {loadAtmosphereAssets} from './atmosphere.js';
import {insideAuthoredGarden,landscapeGroves,groveAt} from './environment-layout.js';
import {createGroveTree,createGroveShrub,updateGroveWind} from './grove-foliage.js';
import {createFoliageLOD} from './foliage-lod.js';
import {applyEnvironmentWind,attachWindShadows} from './environment-wind.js';
import {loadScannedRockAssets,addScannedRocks} from './rock-scans.js';
import {loadEnvironmentSignage} from './environment-signage.js';

const TAU=Math.PI*2;
const maps = {};
let environment = null;
const wind = { value: 0 };
export async function loadLandscapeAssets() {
  const jobs = ['meadow', 'mossy-rock', 'forest-ground', 'castle-masonry', 'aged-wood', 'oxidized-copper', 'wool-cloth'].flatMap(name =>
    ['color', 'normal', 'roughness'].map(async kind => {
      const texture = await loadPBRTexture(name,kind);
      (maps[name] ||= {})[kind] = texture;
    }));
  await Promise.all([...jobs,loadAtmosphereAssets(),loadScannedRockAssets(),loadEnvironmentSignage()]);
  try { environment = await new HDRLoader().loadAsync('/textures/environment/night.hdr');
    environment.mapping = THREE.EquirectangularReflectionMapping;
  } catch { /* The authored sky and direct lighting remain available offline. */ }
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
export function groundMaterial() {
  const m=surface('meadow',{vertexColors:true,color:'#e4ebd8',normalScale:new THREE.Vector2(.70,.70),roughness:1});
  m.userData.albedoStrength=.82;
  const compileSurface=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{
    compileSurface(shader);
    shader.uniforms.rockMap={value:maps['mossy-rock']?.color};
    shader.vertexShader='varying vec3 terrainNormal; varying vec3 terrainPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainNormal=normal; terrainPosition=position;');
    shader.fragmentShader='uniform sampler2D rockMap; varying vec3 terrainNormal; varying vec3 terrainPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float rockSlope=1.-smoothstep(.5,.93,normalize(terrainNormal).y);
      float rockPatch=smoothstep(.59,.9,sin(terrainPosition.x*.051)*cos(terrainPosition.z*.067)*.5+.5)*.32;
      vec3 cliffTexture=texture2D(rockMap,terrainPosition.xz/3.).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,cliffTexture*authoredBase,max(rockSlope,rockPatch));`);
  };
  m.customProgramCacheKey=()=> 'terrain-pbr-v5'; return m;
}

export function createLake(root, scene) {
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,u=x*128/size,v=y*128/size;
    const sx=(noise(u*.15+.2,v*.25)-noise(u*.15-.2,v*.25))*.46;
    const sy=(noise(u*.15,v*.25+.2)-noise(u*.15,v*.25-.2))*.46;
    const n=new THREE.Vector3(sx,sy,1).normalize();
    data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;
  }
  const normals=new THREE.DataTexture(data,size,size);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.magFilter=THREE.LinearFilter;normals.minFilter=THREE.LinearMipmapLinearFilter;normals.generateMipmaps=true;normals.anisotropy=4;normals.needsUpdate=true;
  const water=new Water(new THREE.PlaneGeometry(2200,2200),{textureWidth:2048,textureHeight:2048,waterNormals:normals,sunDirection:new THREE.Vector3(-.16,.18,-.84).normalize(),sunColor:'#a8d9ff',waterColor:'#123955',distortionScale:1.15,fog:true});
  const reflection=water.material.uniforms.mirrorSampler.value;reflection.generateMipmaps=true;reflection.minFilter=THREE.LinearMipmapLinearFilter;
  water.name='Reflective lake';water.rotation.x=-Math.PI/2;water.position.y=-15;
  water.material.uniforms.size.value=2.5;
  water.material.fragmentShader=water.material.fragmentShader.replace('vec3( 1.5, 1.0, 1.5 )','vec3( 0.55, 1.0, 0.55 )').replace('100.0, 2.0, 0.5','45.0, 0.45, 0.35');
  root.add(water);
  // Reflection is refreshed at a controlled cadence; the live surface still moves every frame.
  const reflect=water.onBeforeRender;let frame=0;
  water.onBeforeRender=function(...args){if(args[1].overrideMaterial)return;if(frame++%5===0)reflect.apply(this,args);};
  if(environment){scene.environment=environment;scene.environmentIntensity=.14;}
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

export function createVegetation(root,heightAt,nearPath=()=>false,{lod=false}={}) {
  let state=48623;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
  const bridgeSpans=Object.values(bridges).map(([a,b])=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return {x:a[0],z:a[1],length,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length};});
  const bridgeClear=p=>!bridgeSpans.some(b=>{const along=(p.x-b.x)*b.dx+(p.z-b.z)*b.dz,across=(p.x-b.x)*b.dz-(p.z-b.z)*b.dx;return along>-3&&along<b.length+3&&Math.abs(across)<4.5;});
  const dummy=new THREE.Object3D();
  const batch=(geo,mat,placements,name,shadow=true)=>{
    // Filter at assembly, after all seeded sampling. A bridge exclusion must
    // not consume different random values or move plants elsewhere in the map.
    placements=placements.filter(bridgeClear);
    if(!placements.length)return;
    const mesh=new THREE.InstancedMesh(geo,mat,placements.length);mesh.name=name;
    placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.r||0,p.rz||0);dummy.scale.set(p.sx||p.s||1,p.sy||p.s||1,p.sz||p.s||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;attachWindShadows(mesh);mesh.computeBoundingSphere();root.add(mesh);return mesh;
  };
  const kinds=['pine','silver','cherry'],groups=kinds.map(()=>[]),placed=[];
  const clear=(x,z)=>insideAuthoredGarden(x,z,3)||locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius+4)||nearPath(x,z)||Math.hypot(x-court.x,z-court.z)<13;
  // A broad approach corridor frames the castle and stays clear of tall crowns.
  const treeClear=(x,z)=>clear(x,z)||Math.pow((x-court.x-6)/32,2)+Math.pow((z-court.z-14)/42,2)<1||nearPath(x+5,z)||nearPath(x-5,z)||nearPath(x,z+5)||nearPath(x,z-5);
  const sampleIsland=()=>{const grove=landscapeGroves[Math.floor(rand()*landscapeGroves.length)],a=rand()*TAU,r=Math.sqrt(rand())*.95;return{x:grove.x+Math.cos(a)*grove.rx*r,z:grove.z+Math.sin(a)*grove.rz*r,kind:grove.kind};};
  for(let j=0;j<1800&&placed.length<64;j++){
    const{x,z,kind}=sampleIsland(),h=heightAt(x,z);
    if(h<.5||treeClear(x,z)||noise(x*.044+9,z*.044)<.3)continue;
    if(placed.some(p=>Math.hypot(x-p.x,z-p.z)<6.8))continue;
    const k=kinds.indexOf(kind),foreground=x>25&&z>court.z-8;
    const p={x,y:h-.12,z,s:(.78+rand()*.33)*(foreground?.76:1),r:rand()*6.28};groups[k].push(p);placed.push(p);
  }
  const lodController=lod?createFoliageLOD(root,kinds.map((kind,k)=>({kind,seed:168+k*331,placements:groups[k].filter(bridgeClear)}))):null;
  if(!lod)for(let k=0;k<kinds.length;k++){
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
  const rocks=[],pebbles=[],grass=[],flowers=[];
  for(let j=0;j<540;j++){
    const{x,z}=sampleIsland(),h=heightAt(x,z);if(h<.4||clear(x,z))continue;
    if(j%12===0)rocks.push({x,y:h-.35,z,sx:1.1+rand()*1.7,sy:.55+rand()*1.1,sz:1+rand()*1.5,r:rand()*6.28});
    else if(j%8===0)pebbles.push({x,y:h,z,s:.17+rand()*.25,r:rand()*6.28});
    for(let g=0;g<3;g++){
      const gx=x+(rand()-.5)*3,gz=z+(rand()-.5)*3;if(heightAt(gx,gz)<.2||clear(gx,gz)||!groveAt(gx,gz,1))continue;grass.push({x:gx,y:heightAt(gx,gz)+.025,z:gz,s:.4+rand()*.55,r:rand()*6.28});
    }
    if(j%3===0&&noise(x*.12+5,z*.12)>.32)flowers.push({x,y:h,z,s:.64+rand()*.54,r:rand()*6.28});
  }
  for(let j=0;j<16000;j++){
    const x=(rand()-.5)*255,z=(rand()-.5)*250+12,h=heightAt(x,z);
    if(h<.6||clear(x,z))continue;
    const patch=noise(x*.055+18,z*.055-4),edge=nearPath(x+2,z)||nearPath(x-2,z)||nearPath(x,z+2)||nearPath(x,z-2);
    if(patch<.49&&!edge)continue;
    grass.push({x,y:h-.025,z,s:.55+rand()*.62,r:rand()*TAU});
    if(j%9===0&&patch>.55)flowers.push({x,y:h-.01,z,s:.8+rand()*.75,r:rand()*TAU});
    if(j%71===0)pebbles.push({x,y:h-.07,z,s:.16+rand()*.33,r:rand()*TAU});
  }
  addScannedRocks(root,[...rocks.map((p,i)=>({...p,kind:'moss',piece:i%7,sy:(p.sy||1)*.7})),...pebbles.map((p,i)=>({...p,kind:'moss',piece:i%7}))],'Scanned mossy grove stones');
  const vertices=[],colors=[],indices=[],uv=[],c=new THREE.Color();
  for(let b=0;b<18;b++){
    const a=rand()*6.28,bx=(rand()-.5)*.4,bz=(rand()-.5)*.4,h=.28+rand()*.45,w=.025+rand()*.032,at=vertices.length/3;
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
  const gm=leafMaterial(null,'#acc2ab');gm.vertexColors=true;gm.alphaTest=0;batch(gg,gm,grass,'Grouped silver green ground cover',false);
  // Curved petals and stems remain three-dimensional when seen from above.
  const petals=[],stems=[],centres=[];
  for(let n=0;n<5;n++){
    const x=(rand()-.5)*.7,z=(rand()-.5)*.7,h=.36+rand()*.35;
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
  const petalMaterial=flowerMaterial('#cbb5e3');
  const flowerMesh=batch(mergeGeometries(petals),petalMaterial,flowers,'Sculpted lavender meadow flowers',false);
  if(flowerMesh){const color=new THREE.Color();let instance=0;flowers.forEach((p,i)=>{if(!bridgeClear(p))return;color.set(['#f1dbf5','#bfc8ff','#fff0d2'][i%3]);flowerMesh.setColorAt(instance++,color);});flowerMesh.instanceColor.needsUpdate=true;}
  batch(mergeGeometries(stems),flowerMaterial('#608259'),flowers,'Meadow flower stems',false);
  batch(mergeGeometries(centres),flowerMaterial('#ddbf69'),flowers,'Golden meadow flower centres',false);
  [...petals,...stems,...centres].forEach(g=>g.dispose());
  return {treeCount:placed.filter(bridgeClear).length,treeLimit:64,flowerTreeCount:groups[2].filter(bridgeClear).length,understoryCount:understory.filter(bridgeClear).length,grassCount:grass.filter(bridgeClear).length,flowerCount:flowers.filter(bridgeClear).length,groveCount:landscapeGroves.length,lod:lodController?.stats??null,lodController,update:(camera,viewport)=>lodController?.update(camera,viewport)};
}

export function createBackdrop(root, scene) {
  if(!scene.background)scene.background=new THREE.Color('#102b50');
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // Separate, irregular ridgelines leave open water and sky between headlands.
  // Their materials have a bounded night palette so foreground lights cannot
  // turn the entire mountain ring into a brighter wall behind the castle.
  const summits=[[.35,84,.26],[1.35,64,.30],[2.32,90,.23],[2.85,62,.27],[3.98,76,.25],[4.62,105,.32],[5.57,72,.26]];
  for(let layer=0;layer<3;layer++){
    const positions=[],indices=[],segments=640,bands=40;
    for(let s=0;s<=segments;s++){
      const a=s/segments*Math.PI*2,shift=(layer-1)*.13;
      let peaks=0;
      for(const [angle,height,width] of summits){
        const signed=wrap(a-angle-shift),offset=Math.abs(signed);
        const shoulderWidth=width*(signed>0?1.24:.76);
        peaks+=height*Math.exp(-Math.pow(offset/shoulderWidth,1.8));
        peaks+=height*.26*Math.exp(-Math.pow(wrap(a-angle-shift-width*.91)/(width*.35),2.));
      }
      const moonValley=1-.68*Math.exp(-Math.pow(wrap(a+2.95)/.30,2));
      const ridge=340+layer*145+noise(Math.sin(a)*4+layer*2.3,Math.cos(a)*4)*85;
      const weathering=.86+.23*fbm(Math.sin(a)*35+layer*7,Math.cos(a)*35-layer*3);
      const crest=(14+layer*7+peaks*(.72+layer*.035))*moonValley*weathering;
      for(let b=0;b<=bands;b++){
        const t=b/bands;
        const channel=Math.sin(a*47+Math.sin(a*13)*2.4+t*2.8+fbm(a*8,t*5)*2)*.5+.5;
        const foothill=.54+.46*Math.pow(Math.sin(t*Math.PI),.4);
        const width=190+layer*35;
        const r=ridge+(t-.43)*width+Math.sin(a*21+t*5)*8*Math.sin(t*Math.PI);
        const silhouette=Math.pow(Math.max(0,Math.sin(t*Math.PI)),1.25);
        const ribs=.75+.17*channel+.12*fbm(Math.sin(a)*32+t*5,Math.cos(a)*32-layer*2);
        const h=-24+crest*silhouette*ribs*foothill;
        positions.push(Math.sin(a)*r,h,Math.cos(a)*r);
        if(s<segments&&b<bands){const q=s*(bands+1)+b;indices.push(q,q+1,q+bands+1,q+1,q+bands+2,q+bands+1);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,fog:false,toneMapped:false,
      uniforms:{rockMap:{value:maps['mossy-rock']?.color||null},hasRock:{value:maps['mossy-rock']?.color?1:0},baseColor:{value:new THREE.Color(['#304252','#40556a','#556d83'][layer])},hazeColor:{value:new THREE.Color('#46617c')},layerDepth:{value:layer},lightDirection:{value:new THREE.Vector3(-.28,.48,-.72).normalize()}},
      vertexShader:'varying vec3 mountainPosition;varying vec3 mountainNormal;void main(){mountainPosition=(modelMatrix*vec4(position,1.)).xyz;mountainNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 mountainPosition;varying vec3 mountainNormal;
        uniform sampler2D rockMap;uniform float hasRock;uniform vec3 baseColor;uniform vec3 hazeColor;uniform float layerDepth;uniform vec3 lightDirection;
        void main(){vec3 p=mountainPosition;vec3 n=normalize(mountainNormal);vec3 weights=pow(abs(n),vec3(3.));weights/=max(dot(weights,vec3(1.)),.001);
          vec3 tx=texture2D(rockMap,p.zy*.11).rgb;vec3 ty=texture2D(rockMap,p.xz*.11).rgb;vec3 tz=texture2D(rockMap,p.xy*.11).rgb;
          float grain=dot(tx*weights.x+ty*weights.y+tz*weights.z,vec3(.2126,.7152,.0722));
          float rockDetail=mix(1.,.72+grain*.46,hasRock);
          float moonFacing=max(0.,dot(n,lightDirection));
          float skyFacing=max(0.,dot(n,normalize(vec3(.18,.35,.84))));
          float faceLight=.48+moonFacing*.46+skyFacing*.28+max(0.,n.y)*.18;
          float slopeBands=.97+.03*sin(p.y*.21+sin(p.x*.027+p.z*.034)*2.);
          vec3 color=baseColor*faceLight*rockDetail*slopeBands;
          float distanceHaze=smoothstep(280.,1080.,distance(cameraPosition,p))*.42;
          float valleyHaze=(1.-smoothstep(-16.,65.,p.y))*(.08+layerDepth*.03);
          color=mix(color,hazeColor,distanceHaze+valleyHaze);
          gl_FragColor=vec4(color,1.);
          #include <colorspace_fragment>
        }`,
    });
    material.userData.backgroundLayer=layer;
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Layered navy highlands ${layer}`;mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);
  }
  // Valley mist remains dark and translucent; it does not brighten the skyline.
  const fogMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:wind},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float t;void main(){float a=pow(sin(v.x*3.14159)*sin(v.y*3.14159),2.);float wisps=.65+.35*sin(v.x*19.+sin(v.x*33.)+t*.05);gl_FragColor=vec4(.08,.15,.25,a*wisps*.045);}' });
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,m=new THREE.Mesh(new THREE.PlaneGeometry(150,16),fogMat);m.position.set(Math.sin(a)*280,2+i%3*4,Math.cos(a)*280);m.rotation.y=a;root.add(m);}
}
