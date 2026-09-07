import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { locations } from './locations.js';
import {loadPBRTexture} from './asset-cache.js';

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
  await Promise.all(jobs);
  ({ Tree } = await import('../node_modules/@dgreenheck/ez-tree/src/lib/index.js'));
  try { environment = await new HDRLoader().loadAsync('/textures/environment/sky.hdr');
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
  const m=surface('meadow',{vertexColors:true,color:'#b7c3a2',normalScale:new THREE.Vector2(.65,.65)});
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
  const water=new Water(new THREE.PlaneGeometry(2200,2200),{textureWidth:512,textureHeight:512,waterNormals:normals,sunDirection:new THREE.Vector3(-.7,.7,.5).normalize(),sunColor:'#e4ccaa',waterColor:'#253d43',distortionScale:2.1,fog:true});
  water.name='Reflective lake';water.rotation.x=-Math.PI/2;water.position.y=-15;
  water.material.uniforms.size.value=2.5;
  water.material.fragmentShader=water.material.fragmentShader.replace('vec3( 1.5, 1.0, 1.5 )','vec3( 0.55, 1.0, 0.55 )').replace('100.0, 2.0, 0.5','45.0, 0.45, 0.35');
  root.add(water);
  // Reflection is refreshed at a controlled cadence; the live surface still moves every frame.
  const reflect=water.onBeforeRender;let frame=0;
  water.onBeforeRender=function(...args){if(args[1].overrideMaterial)return;if(frame++%5===0)reflect.apply(this,args);};
  if(environment){scene.environment=environment;scene.environmentIntensity=.22;scene.background=environment;scene.backgroundIntensity=.75;scene.backgroundBlurriness=0;}
  return {update(time,reduced){water.material.uniforms.time.value=reduced?0:time*.24;wind.value=reduced?0:time;},water};
}

function leafMaterial(map,color='#afbd89') {
  const m=new THREE.MeshStandardMaterial({map,alphaTest:.30,side:THREE.DoubleSide,color,roughness:.91,metalness:0});
  m.onBeforeCompile=shader=>{
    shader.uniforms.windTime=wind;
    shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=position.y*.53+position.x*.27;
      transformed.x+=sin(windTime*.9+phase)*.18*uv.y;
      transformed.z+=cos(windTime*.7+phase)*.11*uv.y;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=diffuseColor.rgb*.055;
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=> 'leaves-wind-pbr-v1';return m;
}
function makeTree(preset,seed,detail=1) {
  if(!Tree)return null;
  const tree=new Tree();tree.loadPreset(preset);tree.options.seed=seed;
  const pine=preset.includes('Pine');
  tree.options.branch.children[0]=pine?(detail===1?65:28):(detail===1?11:6);
  tree.options.branch.children[1]=pine?2:3;
  tree.options.branch.sections[0]=9;tree.options.branch.sections[1]=5;tree.options.branch.sections[2]=4;
  tree.options.branch.segments[0]=7;tree.options.branch.segments[1]=4;tree.options.branch.segments[2]=3;
  tree.options.leaves.count=detail===1?(pine?30:24):10;
  tree.options.leaves.size*=detail===1?2.05:2.3;tree.generate();
  const height=new THREE.Box3().setFromObject(tree).getSize(new THREE.Vector3()).y;
  const scale=(pine?14:12)/height;
  tree.branchesMesh.geometry.scale(scale,scale,scale);tree.leavesMesh.geometry.scale(scale,scale,scale);
  const old=tree.leavesMesh.material;tree.leavesMesh.material=leafMaterial(old.map,pine?'#c9d09e':'#d4d19c');old.dispose();
  return tree;
}

export function createTreeSpecimen(kind='pine') {
  const t=makeTree(kind==='pine'?'Pine Medium':'Ash Small',221,1);
  return t||new THREE.Group();
}

export function createVegetation(root,heightAt,nearPath) {
  let state=48623;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
  const dummy=new THREE.Object3D();
  const batch=(geo,mat,placements,name,shadow=true)=>{
    if(!placements.length)return;
    const mesh=new THREE.InstancedMesh(geo,mat,placements.length);mesh.name=name;
    placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.r||0,p.rz||0);dummy.scale.set(p.sx||p.s||1,p.sy||p.s||1,p.sz||p.s||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);return mesh;
  };
  const groups=Array.from({length:6},()=>[]);
  const clear=(x,z)=>locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius+4)||nearPath(x,z)||Math.hypot(x,z-22)<9;
  const treeClear=(x,z)=>clear(x,z)||Math.pow((x-5)/30,2)+Math.pow((z-39)/35,2)<1||nearPath(x+4,z)||nearPath(x-4,z)||nearPath(x,z+4)||nearPath(x,z-4);
  for(let j=0;j<1500;j++){
    const x=(rand()-.5)*163,z=(rand()-.5)*173,h=heightAt(x,z);
    if(h<.3||treeClear(x,z)||noise(x*.05+9,z*.05)<.29)continue;
    if(groups.flat().some(p=>Math.hypot(x-p.x,z-p.z)<4.3))continue;
    // Keep the entrance and workshop visible from the welcome camera; mature
    // forest remains at the flanks and in the distance.
    const foreground=x>27&&z>19&&z<66;
    const k=j%6;groups[k].push({x,y:h-.15,z,s:(.65+rand()*.6)*(foreground?.52:1),r:rand()*6.28});
  }
  for(let k=0;k<6;k++){
    const specimen=makeTree(k<4?'Pine Medium':'Ash Small',168+k*331,1);if(!specimen)continue;
    batch(specimen.branchesMesh.geometry,specimen.branchesMesh.material,groups[k],`Forest trunks ${k}`);
    batch(specimen.leavesMesh.geometry,specimen.leavesMesh.material,groups[k],`Forest foliage ${k}`);
  }
  // Reusable eroded outcrops: actual surface deformation and scanned mossy rock.
  const rocks=[],pebbles=[],grass=[];
  for(let j=0;j<3100;j++){
    const x=(rand()-.5)*165,z=(rand()-.5)*178,h=heightAt(x,z);if(h<-.5||clear(x,z))continue;
    if(j%6===0)rocks.push({x,y:h-.45,z,sx:.6+rand()*2.2,sy:.5+rand()*2,sz:.6+rand()*2,r:rand()*6.28});
    else if(j%3===0)pebbles.push({x,y:h,z,s:.12+rand()*.3,r:rand()*6.28});
    for(let g=0;g<5;g++){
      const gx=x+(rand()-.5)*3,gz=z+(rand()-.5)*3;grass.push({x:gx,y:heightAt(gx,gz)+.025,z:gz,s:.45+rand()*.8,r:rand()*6.28});
    }
  }
  const rockGeo=new THREE.IcosahedronGeometry(1,2),p=rockGeo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=.78+fbm(x*3+7,z*3+y)*.48;p.setXYZ(i,x*s,y*s*.84,z*s);}
  rockGeo.computeVertexNormals();planarUV(rockGeo,.8);const rockMat=surface('mossy-rock',{color:'#aaa99a'});
  batch(rockGeo,rockMat,rocks,'Scanned mossy outcrops');batch(rockGeo,rockMat,pebbles,'Ground stones',false);
  const vertices=[],colors=[],indices=[],uv=[],c=new THREE.Color();
  for(let b=0;b<7;b++){
    const a=rand()*6.28,bx=(rand()-.5)*.4,bz=(rand()-.5)*.4,h=.38+rand()*.48,w=.035+rand()*.035,at=vertices.length/3;
    for(let row=0;row<4;row++){
      const t=row/3,lean=t*t*.32;
      for(const side of [-1,1]){
        vertices.push(bx+Math.cos(a)*(side*w*(1-t)+lean),t*h,bz+Math.sin(a)*(side*w*(1-t)+lean));uv.push(side===-1?0:1,t);
        c.set('#718451').lerp(new THREE.Color('#c0b780'),t*.6);colors.push(c.r,c.g,c.b);
      }
      if(row<3){const q=at+row*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
    }
  }
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));gg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));gg.setIndex(indices);gg.computeVertexNormals();
  const gm=leafMaterial(null,'#a8af80');gm.vertexColors=true;gm.alphaTest=0;batch(gg,gm,grass,'Windblown meadow tufts',false);
  return {treeCount:groups.reduce((n,g)=>n+g.length,0),grassCount:grass.length};
}

export function createBackdrop(root, scene) {
  const distantTrees=[];
  const sky=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#263344')},horizon:{value:new THREE.Color('#99998e')}},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 direction;uniform vec3 top;uniform vec3 horizon;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);return mix(mix(hash(a),hash(a+vec2(1.,0.)),b.x),mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.)),b.x),b.y);}
    void main(){vec3 d=normalize(direction);float h=max(0.,d.y);vec3 c=mix(horizon,top,pow(h,.48));
    vec2 p=d.xz/(h+.24)*2.;float clouds=n(p*2.)*.6+n(p*5.)*.28+n(p*12.)*.12;float layer=smoothstep(.45,.72,clouds)*smoothstep(.04,.18,h)*(1.-smoothstep(.35,.75,h));
    c=mix(c,vec3(.43,.42,.40),layer*.7);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}));sky.name='Layered evening sky';if(!environment)root.add(sky);else{sky.geometry.dispose();sky.material.dispose();}
  for(let layer=0;layer<3;layer++){
    const positions=[],uv=[],indices=[],colors=[],segments=300,bands=22;
    for(let s=0;s<=segments;s++){
      const a=s/segments*Math.PI*2;
      const ridge=235+layer*130+noise(Math.sin(a)*4+layer,Math.cos(a)*4)*60;
      const crest=17+layer*12+fbm(Math.sin(a)*3+layer*17,Math.cos(a)*3)*65;
      for(let b=0;b<=bands;b++){
        const t=b/bands,r=ridge+(t-.45)*(140+layer*40);
        const erosion=Math.pow(Math.max(0,Math.sin(t*Math.PI)),1.8);
        const h=-22+crest*Math.max(0,erosion)*( .77+fbm(Math.sin(a)*10+b*.15,Math.cos(a)*10+layer)*.24);
        const x=Math.sin(a)*r,z=Math.cos(a)*r;positions.push(x,h,z);
        if(layer===0&&b>1&&b<15&&s%3===0&&noise(x*.1,z*.1)>.4&&h>-10)distantTrees.push({x,y:h-1,z,s:.55+noise(x*.6,z*.6)*.6,r:a});uv.push(x*.028,z*.028);
        const c=new THREE.Color(['#697263','#6e796f','#85908b'][layer]);c.multiplyScalar(.7+noise(x*.05,z*.05)*.4);colors.push(c.r,c.g,c.b);
        if(s<segments&&b<bands){const q=s*(bands+1)+b;indices.push(q,q+1,q+bands+1,q+1,q+bands+2,q+bands+1);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.Mesh(g,surface('mossy-rock',{vertexColors:true,side:THREE.DoubleSide,color:'#a3aba0'}));m.name=`Eroded distant highlands ${layer}`;m.receiveShadow=true;root.add(m);
  }
  if(Tree){const tree=makeTree('Pine Medium',5321,0),dummy=new THREE.Object3D();
    for(const source of [tree.branchesMesh,tree.leavesMesh]){const m=new THREE.InstancedMesh(source.geometry,source.material,distantTrees.length);m.name='Distant forest';distantTrees.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.setScalar(p.s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.receiveShadow=false;m.castShadow=false;m.computeBoundingSphere();root.add(m);}
  }
  // Narrow, low-opacity fog banks occupy valleys; no giant opaque fog cards.
  const fogMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:wind},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float t;void main(){float a=pow(sin(v.x*3.14159)*sin(v.y*3.14159),2.);float wisps=.65+.35*sin(v.x*19.+sin(v.x*33.)+t*.05);gl_FragColor=vec4(.53,.6,.6,a*wisps*.11);}' });
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2,m=new THREE.Mesh(new THREE.PlaneGeometry(150,16),fogMat);m.position.set(Math.sin(a)*185,2+i%3*4,Math.cos(a)*185);m.rotation.y=a;root.add(m);}
}
