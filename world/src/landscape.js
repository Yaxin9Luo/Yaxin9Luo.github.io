import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { locations, islands, court } from './locations.js';
import {loadPBRTexture} from './asset-cache.js';
import {loadAtmosphereAssets,blossomTexture} from './atmosphere.js';

// The library's source entry keeps image files separate instead of shipping its
// 3.8 MB base64 UMD/ES distribution inside the JavaScript download.
let Tree;
const maps = {};
let environment = null;
const wind = { value: 0 };
export async function loadLandscapeAssets() {
  const jobs = ['meadow', 'mossy-rock', 'forest-ground', 'castle-masonry', 'pine-bark'].flatMap(name =>
    ['color', 'normal', 'roughness'].map(async kind => {
      const texture = await loadPBRTexture(name,kind);
      (maps[name] ||= {})[kind] = texture;
    }));
  await Promise.all([...jobs,loadAtmosphereAssets()]);
  ({ Tree } = await import('../node_modules/@dgreenheck/ez-tree/src/lib/index.js'));
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
  return new THREE.MeshStandardMaterial({color:'#d9d9cb',map:t.color??null,normalMap:t.normal??null,normalScale:new THREE.Vector2(.8,.8),roughnessMap:t.roughness??null,roughness:1,...extra});
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
  const m=surface('meadow',{vertexColors:true,color:'#8195a7',normalScale:new THREE.Vector2(.65,.65)});
  m.onBeforeCompile=shader=>{
    shader.uniforms.rockMap={value:maps['mossy-rock']?.color};
    shader.vertexShader='varying vec3 terrainNormal; varying vec3 terrainPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainNormal=normal; terrainPosition=position;');
    shader.fragmentShader='uniform sampler2D rockMap; varying vec3 terrainNormal; varying vec3 terrainPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float rockSlope=1.-smoothstep(.5,.93,normalize(terrainNormal).y);
      float rockPatch=smoothstep(.55,.88,sin(terrainPosition.x*.087)*cos(terrainPosition.z*.113)*.5+.5)*.35;
      vec3 cliffTexture=texture2D(rockMap,vMapUv*.57).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,cliffTexture*diffuse, max(rockSlope,rockPatch));`);
  };
  m.customProgramCacheKey=()=> 'terrain-pbr-v3'; return m;
}

export function createLake(root, scene) {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const sx=(noise(x*.15+.2,y*.25)-noise(x*.15-.2,y*.25))*1.2;
    const sy=(noise(x*.15,y*.25+.2)-noise(x*.15,y*.25-.2))*1.2;
    const n=new THREE.Vector3(sx,sy,1).normalize();
    data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;
  }
  const normals=new THREE.DataTexture(data,size,size);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.needsUpdate=true;
  const water=new Water(new THREE.PlaneGeometry(2200,2200),{textureWidth:512,textureHeight:512,waterNormals:normals,sunDirection:new THREE.Vector3(-.16,.18,-.84).normalize(),sunColor:'#a8d9ff',waterColor:'#123955',distortionScale:1.6,fog:true});
  water.name='Reflective lake';water.rotation.x=-Math.PI/2;water.position.y=-15;
  water.material.uniforms.size.value=2.5;
  water.material.fragmentShader=water.material.fragmentShader.replace('vec3( 1.5, 1.0, 1.5 )','vec3( 0.55, 1.0, 0.55 )').replace('100.0, 2.0, 0.5','45.0, 0.45, 0.35');
  root.add(water);
  // Reflection is refreshed at a controlled cadence; the live surface still moves every frame.
  const reflect=water.onBeforeRender;let frame=0;
  water.onBeforeRender=function(...args){if(args[1].overrideMaterial)return;if(frame++%5===0)reflect.apply(this,args);};
  if(environment){scene.environment=environment;scene.environmentIntensity=.14;}
  return {update(time,reduced){water.material.uniforms.time.value=reduced?0:time*.24;wind.value=reduced?0:time;},water};
}

function leafMaterial(map,color='#b4c8dd',silvering=0) {
  const m=new THREE.MeshStandardMaterial({map,alphaTest:.30,side:THREE.DoubleSide,color,roughness:.91,metalness:0});
  m.onBeforeCompile=shader=>{
    shader.uniforms.windTime=wind;
    shader.uniforms.leafSilvering={value:silvering};
    shader.fragmentShader='uniform float leafSilvering;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float leafLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(diffuseColor.rgb,(.055+leafLight*1.6)*vec3(1.08,1.34,1.63),leafSilvering);`);
    shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=position.y*.53+position.x*.27;
      transformed.x+=sin(windTime*.9+phase)*.18*uv.y;
      transformed.z+=cos(windTime*.7+phase)*.11*uv.y;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=diffuseColor.rgb*.095;
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=> 'leaves-wind-pbr-v2';return m;
}
function makeTree(preset,seed,detail=1,kind='pine') {
  if(!Tree)return null;
  const tree=new Tree();tree.loadPreset(preset);tree.options.seed=seed;
  const pine=kind==='pine',flower=kind==='lilac'||kind==='cherry';
  tree.options.branch.children[0]=pine?(detail===1?31:17):(detail===1?8:5);
  tree.options.branch.children[1]=pine?2:3;tree.options.branch.children[2]=2;
  tree.options.branch.sections[0]=10;tree.options.branch.sections[1]=6;tree.options.branch.sections[2]=4;
  tree.options.branch.segments[0]=8;tree.options.branch.segments[1]=5;tree.options.branch.segments[2]=3;
  tree.options.leaves.count=detail===1?(pine?18:12):8;
  tree.options.leaves.size*=pine?1.5:1.15;
  if(!pine){
    tree.options.branch.levels=3;tree.options.branch.start[1]=.32;tree.options.branch.start[2]=.28;
    tree.options.branch.angle[1]=58;tree.options.branch.angle[2]=57;
    tree.options.branch.length[0]=15;tree.options.branch.length[1]=12;tree.options.branch.length[2]=7;tree.options.branch.length[3]=4;
    tree.options.branch.gnarliness[0]=.14;tree.options.branch.gnarliness[1]=.17;
    tree.options.branch.force.strength=-.014;tree.options.branch.radius[0]=.62;
    tree.options.leaves.size=flower?2.3:1.65;tree.options.leaves.sizeVariance=.42;
    tree.options.bark.tint=0xbabac5;
  }
  tree.generate();
  const height=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3()).y;
  const scale=(pine?10.5:flower?7.6:9)/Math.max(height,.1);
  tree.branchesMesh.geometry.scale(scale,scale,scale);tree.leavesMesh.geometry.scale(scale,scale,scale);
  if(!pine){tree.branchesMesh.geometry.scale(1.16,.96,1.12);tree.leavesMesh.geometry.scale(1.16,.96,1.12);}
  const old=tree.leavesMesh.material;
  if(flower&&blossomTexture()){
    const uv=tree.leavesMesh.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.47+(kind==='lilac'?.515:.015),uv.getY(i)*.47+.515);
    uv.needsUpdate=true;
  }
  tree.leavesMesh.material=leafMaterial(flower?(blossomTexture()||old.map):old.map,
    {pine:'#93abbf',silver:'#b7d2e6',lilac:'#c6abf0',cherry:'#dabbe9'}[kind]||'#b7d2e6',kind==='silver'?.95:pine?.65:0);
  tree.leavesMesh.material.alphaTest=flower?.42:.32;old.dispose();
  tree.name=`${kind} ornamental tree`;
  return tree;
}

export function createTreeSpecimen(kind='pine') {
  const variant=kind==='ash'?'silver':kind;
  return makeTree(variant==='pine'?'Pine Small':'Ash Small',221,1,variant)||new THREE.Group();
}

export function createVegetation(root,heightAt,nearPath=()=>false) {
  let state=48623;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
  const dummy=new THREE.Object3D();
  const batch=(geo,mat,placements,name,shadow=true)=>{
    if(!placements.length)return;
    const mesh=new THREE.InstancedMesh(geo,mat,placements.length);mesh.name=name;
    placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.r||0,p.rz||0);dummy.scale.set(p.sx||p.s||1,p.sy||p.s||1,p.sz||p.s||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);return mesh;
  };
  const kinds=['pine','silver','lilac','cherry','lilac','silver'],groups=kinds.map(()=>[]),placed=[];
  const clear=(x,z)=>locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius+4)||nearPath(x,z)||Math.hypot(x-court.x,z-court.z)<13;
  // A broad approach corridor frames the castle and stays clear of tall crowns.
  const treeClear=(x,z)=>clear(x,z)||Math.pow((x-court.x-6)/32,2)+Math.pow((z-court.z-14)/42,2)<1||nearPath(x+5,z)||nearPath(x-5,z)||nearPath(x,z+5)||nearPath(x,z-5);
  const sampleIsland=()=>{const island=islands[Math.floor(rand()*islands.length)];const a=rand()*6.28,r=Math.sqrt(rand())*.95;return{x:island.x+Math.cos(a)*island.rx*r,z:island.z+Math.sin(a)*island.rz*r};};
  for(let j=0;j<3200&&placed.length<112;j++){
    const{x,z}=sampleIsland(),h=heightAt(x,z);
    if(h<.5||treeClear(x,z)||noise(x*.044+9,z*.044)<.3)continue;
    if(placed.some(p=>Math.hypot(x-p.x,z-p.z)<6.5))continue;
    const k=placed.length%6,foreground=x>25&&z>court.z-8;
    const p={x,y:h-.12,z,s:(.78+rand()*.33)*(foreground?.76:1),r:rand()*6.28};groups[k].push(p);placed.push(p);
  }
  for(let k=0;k<kinds.length;k++){
    const specimen=makeTree(kinds[k]==='pine'?'Pine Small':'Ash Small',168+k*331,1,kinds[k]);if(!specimen)continue;
    batch(specimen.branchesMesh.geometry,specimen.branchesMesh.material,groups[k],`Garden trunks ${k}`);
    batch(specimen.leavesMesh.geometry,specimen.leavesMesh.material,groups[k],`Garden ${kinds[k]} crowns ${k}`);
  }
  // Reusable eroded outcrops: actual surface deformation and scanned mossy rock.
  const rocks=[],pebbles=[],grass=[],flowers=[];
  for(let j=0;j<2400;j++){
    const{x,z}=sampleIsland(),h=heightAt(x,z);if(h<.4||clear(x,z))continue;
    if(j%6===0)rocks.push({x,y:h-.45,z,sx:.6+rand()*2.2,sy:.5+rand()*2,sz:.6+rand()*2,r:rand()*6.28});
    else if(j%3===0)pebbles.push({x,y:h,z,s:.12+rand()*.3,r:rand()*6.28});
    for(let g=0;g<3;g++){
      const gx=x+(rand()-.5)*3,gz=z+(rand()-.5)*3;if(heightAt(gx,gz)<.2)continue;grass.push({x:gx,y:heightAt(gx,gz)+.025,z:gz,s:.4+rand()*.65,r:rand()*6.28});
    }
    if(j%3===0&&noise(x*.12+5,z*.12)>.32)flowers.push({x,y:h,z,s:.64+rand()*.54,r:rand()*6.28});
  }
  const rockGeo=new THREE.IcosahedronGeometry(1,2),p=rockGeo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=.78+fbm(x*3+7,z*3+y)*.48;p.setXYZ(i,x*s,y*s*.84,z*s);}
  rockGeo.computeVertexNormals();planarUV(rockGeo,.8);const rockMat=surface('mossy-rock',{color:'#99aeb9'});
  batch(rockGeo,rockMat,rocks,'Scanned mossy outcrops');batch(rockGeo,rockMat,pebbles,'Ground stones',false);
  const vertices=[],colors=[],indices=[],uv=[],c=new THREE.Color();
  for(let b=0;b<7;b++){
    const a=rand()*6.28,bx=(rand()-.5)*.4,bz=(rand()-.5)*.4,h=.38+rand()*.48,w=.035+rand()*.035,at=vertices.length/3;
    for(let row=0;row<4;row++){
      const t=row/3,lean=t*t*.32;
      for(const side of [-1,1]){
        vertices.push(bx+Math.cos(a)*(side*w*(1-t)+lean),t*h,bz+Math.sin(a)*(side*w*(1-t)+lean));uv.push(side===-1?0:1,t);
        c.set('#617d89').lerp(new THREE.Color('#9eaed0'),t*.75);colors.push(c.r,c.g,c.b);
      }
      if(row<3){const q=at+row*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
    }
  }
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));gg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));gg.setIndex(indices);gg.computeVertexNormals();
  const gm=leafMaterial(null,'#a6bfd0');gm.vertexColors=true;gm.alphaTest=0;batch(gg,gm,grass,'Silver blue meadow tufts',false);
  if(blossomTexture()){
    const fgeo=new THREE.PlaneGeometry(.95,1.45,1,3);fgeo.translate(0,.725,0);
    const uv=fgeo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.47+.015,uv.getY(i)*.47+.015);
    const fm=leafMaterial(blossomTexture(),'#c9b6ed');fm.alphaTest=.48;
    batch(fgeo,fm,flowers,'Lavender bellflower meadow',false);
    batch(fgeo,fm,flowers.map(p=>({...p,r:p.r+Math.PI/2,s:p.s*.91})),'Crossed lavender flower sprays',false);
  }
  return {treeCount:placed.length,treeLimit:112,flowerTreeCount:groups[2].length+groups[3].length+groups[4].length,grassCount:grass.length,flowerCount:flowers.length};
}

export function createBackdrop(root, scene) {
  if(!scene.background)scene.background=new THREE.Color('#102b50');
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // Separate, irregular ridgelines leave open water and sky between headlands.
  // Their materials have a bounded night palette so foreground lights cannot
  // turn the entire mountain ring into a brighter wall behind the castle.
  const summits=[[.35,92,.19],[1.35,76,.23],[2.32,105,.16],[2.85,75,.18],[3.98,86,.18],[4.62,126,.24],[5.57,83,.17]];
  for(let layer=0;layer<3;layer++){
    const positions=[],indices=[],segments=420,bands=30;
    for(let s=0;s<=segments;s++){
      const a=s/segments*Math.PI*2,shift=(layer-1)*.13;
      let peaks=0;
      for(const [angle,height,width] of summits){
        const offset=Math.abs(wrap(a-angle-shift));
        peaks+=height*Math.exp(-Math.pow(offset/width,1.38));
      }
      const moonValley=1-.68*Math.exp(-Math.pow(wrap(a+2.95)/.30,2));
      const ridge=340+layer*145+noise(Math.sin(a)*4+layer*2.3,Math.cos(a)*4)*85;
      const crest=(15+layer*6+peaks*(.72+layer*.035))*moonValley;
      for(let b=0;b<=bands;b++){
        const t=b/bands;
        const channel=Math.sin(a*47+Math.sin(a*13)*2.4+t*2.8)*.5+.5;
        const foothill=.54+.46*Math.pow(Math.sin(t*Math.PI),.4);
        const width=190+layer*35;
        const r=ridge+(t-.43)*width+Math.sin(a*21+t*5)*8*Math.sin(t*Math.PI);
        const silhouette=Math.pow(Math.max(0,Math.sin(t*Math.PI)),1.25);
        const ribs=.79+.13*channel+.08*fbm(Math.sin(a)*24+t*3,Math.cos(a)*24-layer*2);
        const h=-24+crest*silhouette*ribs*foothill;
        positions.push(Math.sin(a)*r,h,Math.cos(a)*r);
        if(s<segments&&b<bands){const q=s*(bands+1)+b;indices.push(q,q+1,q+bands+1,q+1,q+bands+2,q+bands+1);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,fog:false,toneMapped:false,
      uniforms:{rockMap:{value:maps['mossy-rock']?.color||null},hasRock:{value:maps['mossy-rock']?.color?1:0},baseColor:{value:new THREE.Color(['#092039','#102a45','#17324d'][layer])},hazeColor:{value:new THREE.Color('#18334e')},layerDepth:{value:layer}},
      vertexShader:'varying vec3 mountainPosition;varying vec3 mountainNormal;void main(){mountainPosition=(modelMatrix*vec4(position,1.)).xyz;mountainNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 mountainPosition;varying vec3 mountainNormal;
        uniform sampler2D rockMap;uniform float hasRock;uniform vec3 baseColor;uniform vec3 hazeColor;uniform float layerDepth;
        void main(){vec3 p=mountainPosition;vec3 n=normalize(mountainNormal);vec3 weights=pow(abs(n),vec3(3.));weights/=max(dot(weights,vec3(1.)),.001);
          vec3 tx=texture2D(rockMap,p.zy*.11).rgb;vec3 ty=texture2D(rockMap,p.xz*.11).rgb;vec3 tz=texture2D(rockMap,p.xy*.11).rgb;
          float grain=dot(tx*weights.x+ty*weights.y+tz*weights.z,vec3(.2126,.7152,.0722));
          float rockDetail=mix(1.,.91+grain*.16,hasRock);
          float moonFacing=max(0.,dot(n,normalize(vec3(-.28,.48,-.72))));
          float skyFacing=max(0.,dot(n,normalize(vec3(.18,.35,.84))));
          float faceLight=.36+moonFacing*.40+skyFacing*.48+max(0.,n.y)*.15;
          float slopeBands=.97+.03*sin(p.y*.21+sin(p.x*.027+p.z*.034)*2.);
          vec3 color=baseColor*faceLight*rockDetail*slopeBands;
          float distanceHaze=smoothstep(380.,1080.,distance(cameraPosition,p))*.18;
          float valleyHaze=(1.-smoothstep(-16.,55.,p.y))*(.04+layerDepth*.012);
          color=mix(color,hazeColor,distanceHaze+valleyHaze);
          gl_FragColor=vec4(color,1.);
          #include <colorspace_fragment>
        }`,
    });
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Layered navy highlands ${layer}`;mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);
  }
  // Valley mist remains dark and translucent; it does not brighten the skyline.
  const fogMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:wind},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float t;void main(){float a=pow(sin(v.x*3.14159)*sin(v.y*3.14159),2.);float wisps=.65+.35*sin(v.x*19.+sin(v.x*33.)+t*.05);gl_FragColor=vec4(.08,.15,.25,a*wisps*.045);}' });
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,m=new THREE.Mesh(new THREE.PlaneGeometry(150,16),fogMat);m.position.set(Math.sin(a)*280,2+i%3*4,Math.cos(a)*280);m.rotation.y=a;root.add(m);}
}
