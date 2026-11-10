import * as THREE from 'three';
import {WATER_LEVEL} from './heightfield.js';
import {BAKED_PATHS} from './baked-layout.js';
import {createRandom} from './kit.js';
import {locations,court,exhibitSites,bridges} from '../locations.js';

// Moonlit night, designed to be cheap: one sky shader, fog, vertex colours,
// instancing and additive glow sprites. No post-processing pass.

export const MOON_DIRECTION=new THREE.Vector3(-.42,.5,-.76).normalize();
export const COLORS={
  zenith:new THREE.Color('#070b22'),sky:new THREE.Color('#14204a'),horizon:new THREE.Color('#355a86'),fog:new THREE.Color('#2a4670'),
  moon:new THREE.Color('#f3f1e4'),hemiSky:new THREE.Color('#8fb0e8'),hemiGround:new THREE.Color('#243046'),moonLight:new THREE.Color('#cfdcff'),
};

function hash2(x,z){const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);}
function valueNoise(x,z){
  const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi),b=hash2(xi+1,zi),c=hash2(xi,zi+1),d=hash2(xi+1,zi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
export const fbm=(x,z)=>valueNoise(x,z)*.6+valueNoise(x*2.1+5,z*2.1+3)*.3+valueNoise(x*4.3,z*4.3)*.1;

/** Shared fog for lit materials: exponential distance fog plus a low valley haze. */
export function patchFog(material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <fog_pars_vertex>','#include <fog_pars_vertex>\nvarying float vWorldY;').replace('#include <fog_vertex>','#include <fog_vertex>\nvWorldY=(modelMatrix*vec4(transformed,1.)).y;\n#ifdef USE_INSTANCING\nvWorldY=(modelMatrix*instanceMatrix*vec4(transformed,1.)).y;\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\nvarying float vWorldY;').replace('#include <fog_fragment>',`#ifdef USE_FOG
float fogDepth2=vFogDepth;float fogF=1.0-exp(-fogDensity*fogDensity*fogDepth2*fogDepth2);
float haze=clamp((4.0-vWorldY)/26.0,0.0,1.0)*clamp(fogDepth2/140.0,0.0,1.0)*.35;
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(fogF+haze,0.0,1.0));
#endif`);
  };
  return material;
}

export function createMaterials(){
  const solid=patchFog(new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));
  const terrain=patchFog(new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));
  const glow=patchFog(new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}));
  const path=patchFog(new THREE.MeshLambertMaterial({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  return {solid,terrain,glow,path};
}

// ---------------------------------------------------------------- terrain
const plazas=[...locations.map(l=>({x:l.x,z:l.z,r:Math.min(l.radius,l.id==='about'?30:l.radius)+1})),{x:court.x,z:court.z,r:13},...exhibitSites.map(e=>({x:e.x,z:e.z,r:4}))];
export function plazaWeight(x,z){let w=0;for(const p of plazas){const d=Math.hypot(x-p.x,z-p.z);w=Math.max(w,1-THREE.MathUtils.smoothstep(d,p.r-3,p.r+1.5));}return w;}

export function buildTerrain(hf,{step=2,extent=196,shade=null}={}){
  const n=Math.floor(extent*2/step)+1,positions=new Float32Array(n*n*3),colors=new Float32Array(n*n*3),heights=new Float32Array(n*n);
  const grass=new THREE.Color('#3b6450'),meadow=new THREE.Color('#5d8459'),dry=new THREE.Color('#71794f'),rock=new THREE.Color('#5c5a6e'),rockLight=new THREE.Color('#7a768b');
  const sand=new THREE.Color('#857c69'),paving=new THREE.Color('#8f8b8c'),deep=new THREE.Color('#243845'),c=new THREE.Color(),tmp=new THREE.Color();
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i,x=-extent+i*step,z=-extent+j*step;heights[k]=hf.heightAt(x,z);positions[k*3]=x;positions[k*3+1]=heights[k];positions[k*3+2]=z;}
  const H=(i,j)=>heights[Math.min(n-1,Math.max(0,j))*n+Math.min(n-1,Math.max(0,i))];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i,x=-extent+i*step,z=-extent+j*step,h=heights[k];
    if(h<WATER_LEVEL-6){c.copy(deep);colors[k*3]=c.r;colors[k*3+1]=c.g;colors[k*3+2]=c.b;continue;}
    // Slope from neighbouring grid samples (no extra height lookups).
    const gx=(H(i+1,j)-H(i-1,j))/(2*step),gz=(H(i,j+1)-H(i,j-1))/(2*step),slope=1-1/Math.sqrt(1+gx*gx+gz*gz);
    const noise=fbm(x*.035,z*.035),fine=fbm(x*.21+9,z*.21);
    c.copy(grass).lerp(meadow,THREE.MathUtils.clamp(noise*1.3-.2,0,1)).lerp(dry,THREE.MathUtils.clamp((fine-.62)*2.2,0,.55));
    c.lerp(tmp.copy(rock).lerp(rockLight,fine),THREE.MathUtils.smoothstep(slope,.16,.34));
    if(h<WATER_LEVEL+2.2)c.lerp(sand,THREE.MathUtils.smoothstep(WATER_LEVEL+2.2-h,0,1.6)*(1-THREE.MathUtils.smoothstep(slope,.3,.55)));
    if(h<WATER_LEVEL-1.5)c.lerp(deep,THREE.MathUtils.smoothstep(WATER_LEVEL-1.5-h,0,4));
    if(h>0){const pw=plazaWeight(x,z);if(pw>0)c.lerp(tmp.copy(paving).multiplyScalar(.92+fine*.16),pw*.9);}
    const sh=shade&&h>WATER_LEVEL?shade(x,z):1;
    colors[k*3]=c.r*sh;colors[k*3+1]=c.g*sh;colors[k*3+2]=c.b*sh;
  }
  const index=[],hidden=WATER_LEVEL-2.5;
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
    const a=j*n+i,b=a+1,d=a+n,e=d+1;
    if(heights[a]<hidden&&heights[b]<hidden&&heights[d]<hidden&&heights[e]<hidden)continue;
    index.push(a,d,b,b,d,e);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  // Flat shading derives normals per pixel; no normal attribute is needed.
  geometry.setIndex(index.length>65535?new THREE.Uint32BufferAttribute(index,1):new THREE.Uint16BufferAttribute(index,1));geometry.computeBoundingSphere();
  return geometry;
}

// ---------------------------------------------------------------- paths
export function buildPaths(hf){
  const positions=[],colors=[],index=[],stone=new THREE.Color('#b9a888'),edge=new THREE.Color('#8d7f68'),c=new THREE.Color();
  for(const path of BAKED_PATHS){
    const pts=path.points,start=positions.length/3;
    for(let k=0;k<pts.length;k++){
      const [x,z]=pts[k],[px,pz]=pts[Math.max(0,k-1)],[nx,nz]=pts[Math.min(pts.length-1,k+1)];
      let dx=nx-px,dz=nz-pz;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
      for(const side of [-1,-.55,.55,1]){
        const w=path.width*side,vx=x+dz*w,vz=z-dx*w;
        positions.push(vx,hf.heightAt(vx,vz)+.14,vz);
        c.copy(Math.abs(side)>.9?edge:stone).multiplyScalar(.9+fbm(vx*.4,vz*.4)*.2);colors.push(c.r,c.g,c.b);
      }
      if(k<pts.length-1)for(let s=0;s<3;s++){const a=start+k*4+s,b=a+4;index.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(index);geometry.computeVertexNormals();return geometry;
}

/** Lamp sites every ~16 m along the paths, alternating sides. */
export function lampSites(hf){
  const sites=[];
  for(const path of BAKED_PATHS){
    let travelled=0,side=1;
    for(let k=1;k<path.points.length;k++){
      const [x,z]=path.points[k],[px,pz]=path.points[k-1],seg=Math.hypot(x-px,z-pz);travelled+=seg;
      if(travelled<16)continue;travelled=0;side=-side;
      const dx=(x-px)/seg,dz=(z-pz)/seg,w=path.width+1.3,lx=x+dz*w*side,lz=z-dx*w*side;
      if(plazaWeight(lx,lz)>.5||sites.some(s=>Math.hypot(s.x-lx,s.z-lz)<9))continue;
      sites.push({x:lx,y:hf.heightAt(lx,lz),z:lz});
    }
  }
  return sites;
}

// ---------------------------------------------------------------- trees
const TREE_KINDS=[
  {id:'pine',trunk:'#4a3a30',canopy:['#1f4a44','#26574c','#2e5f51']},
  {id:'round',trunk:'#4f3d31',canopy:['#2f6a58','#3c7a61','#4d8460']},
  {id:'blossom',trunk:'#4f3a35',canopy:['#c98ab4','#d9a3c7','#b48ad6']},
];
function treeGeometry(kind){
  const parts=[];const add=(g,color,y)=>{g.translate(0,y,0);const nonIndexed=g.index?g.toNonIndexed():g;const c=new THREE.Color(color),count=nonIndexed.attributes.position.count,arr=new Float32Array(count*3);for(let i=0;i<count;i++){arr[i*3]=c.r;arr[i*3+1]=c.g;arr[i*3+2]=c.b;}nonIndexed.setAttribute('color',new THREE.BufferAttribute(arr,3));nonIndexed.deleteAttribute('uv');nonIndexed.deleteAttribute('normal');parts.push(nonIndexed);};
  // Canopy vertices are white so per-instance colour tints only the canopy;
  // the trunk is pre-darkened and tinted too, which reads as moonlit bark.
  if(kind==='pine'){
    add(new THREE.CylinderGeometry(.22,.32,2.2,5),'#6b5446',1.1);
    add(new THREE.ConeGeometry(2.4,3.6,7),'#ffffff',3.4);
    add(new THREE.ConeGeometry(1.9,3.2,7),'#f2f6f4',5.2);
    add(new THREE.ConeGeometry(1.3,2.8,7),'#e6eeea',7);
  }else{
    add(new THREE.CylinderGeometry(.24,.36,3,5),'#6b5446',1.5);
    const crown=new THREE.IcosahedronGeometry(2.5,0);crown.scale(1,.86,1);add(crown,'#ffffff',4.6);
    const top=new THREE.IcosahedronGeometry(1.6,0);top.translate(.5,0,-.3);add(top,'#eef2ee',6.2);
  }
  const merged=mergeNonIndexed(parts);merged.computeVertexNormals();return merged;
}
function mergeNonIndexed(parts){
  let count=0;for(const p of parts)count+=p.attributes.position.count;
  const pos=new Float32Array(count*3),col=new Float32Array(count*3);let o=0;
  for(const p of parts){pos.set(p.attributes.position.array,o*3);col.set(p.attributes.color.array,o*3);o+=p.attributes.position.count;p.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));return g;
}

/** Spatial hash for "is anything within r of (x,z)" checks against many circles. */
export function createClearanceGrid(circles,cell=8){
  const grid=new Map(),key=(i,j)=>i*8192+j;
  for(const c of circles){const r=c.r;for(let i=Math.floor((c.x-r)/cell);i<=Math.floor((c.x+r)/cell);i++)for(let j=Math.floor((c.z-r)/cell);j<=Math.floor((c.z+r)/cell);j++){const k=key(i,j);let list=grid.get(k);if(!list)grid.set(k,list=[]);list.push(c);}}
  return (x,z,margin=0)=>{const list=grid.get(key(Math.floor(x/cell),Math.floor(z/cell)));if(!list)return false;for(const c of list){const dx=x-c.x,dz=z-c.z,r=c.r+margin;if(dx*dx+dz*dz<r*r)return true;}return false;};
}

/** Scatter trees on gentle island ground, away from paths, plazas, buildings and race lines. */
export function scatterTrees(hf,{density=1,keepClear=[],seed=11}={}){
  const random=createRandom(seed),out=[],normal={x:0,y:1,z:0};
  const pathClear=createClearanceGrid(BAKED_PATHS.flatMap(p=>p.points.map(([x,z])=>({x,z,r:p.width+2.4}))));
  const raceClear=createClearanceGrid(keepClear),taken=new Set(),cellKey=(x,z)=>Math.floor(x/2.6)*8192+Math.floor(z/2.6);
  const attempts=Math.round(16000*density);
  for(let n=0;n<attempts;n++){
    const x=(random()*2-1)*150,z=(random()*2-1)*150,h=hf.heightAt(x,z);
    if(h<WATER_LEVEL+8)continue;
    // Groves: noise decides where trees cluster.
    const grove=fbm(x*.03+3,z*.03-7);if(random()>.14+.86*THREE.MathUtils.smoothstep(grove,.32,.62))continue;
    const k=cellKey(x,z);if(taken.has(k))continue;
    hf.normalAt(x,z,normal,1.5);if(normal.y<.9)continue;
    if(plazaWeight(x,z)>0)continue;
    if(locations.some(l=>Math.hypot(x-l.x,z-l.z)<l.radius+(l.id==='about'?4:7)))continue;
    if(pathClear(x,z)||raceClear(x,z))continue;
    taken.add(k);
    const blossomZone=fbm(x*.018-11,z*.018+4)>.6;
    const kind=blossomZone&&random()<.7?2:(grove>.55&&random()<.65?0:1);
    out.push({x,y:h,z,kind,scale:.75+random()*.6,rot:random()*Math.PI*2,tint:random()});
  }
  return out;
}

export function createTrees(trees,material){
  const group=new THREE.Group();group.name='Trees';
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),pos=new THREE.Vector3(),scl=new THREE.Vector3(),color=new THREE.Color();
  TREE_KINDS.forEach((kind,index)=>{
    const list=trees.filter(t=>t.kind===index);if(!list.length)return;
    const mesh=new THREE.InstancedMesh(treeGeometry(kind.id),material,list.length);
    list.forEach((t,i)=>{
      q.setFromAxisAngle(up,t.rot);pos.set(t.x,t.y-.2,t.z);scl.setScalar(t.scale*(kind.id==='pine'?1.15:1));matrix.compose(pos,q,scl);mesh.setMatrixAt(i,matrix);
      const palette=kind.canopy;color.set(palette[Math.floor(t.tint*palette.length)%palette.length]);mesh.setColorAt(i,color);
    });
    mesh.computeBoundingSphere();mesh.name=kind.id;group.add(mesh);
  });
  return group;
}

/** Sway canopies with a cheap vertex offset (instanced materials only). */
export function addWindSway(material,uniforms){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);shader.uniforms.uTime=uniforms.uTime;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
float swayPhase=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
float swayAmount=max(0.0,position.y-2.0)*.035;
transformed.x+=sin(uTime*1.3+swayPhase)*swayAmount;transformed.z+=cos(uTime*1.1+swayPhase*1.3)*swayAmount*.7;
#endif`);
  };
  material.customProgramCacheKey=()=>'academy-sway';
}

// ---------------------------------------------------------------- lamps
export function createLamps(sites,material){
  const post=mergeNonIndexed([
    colored(new THREE.CylinderGeometry(.09,.13,3.2,5).translate(0,1.6,0),'#2c2c38'),
    colored(new THREE.BoxGeometry(.5,.55,.5).translate(0,3.35,0),'#3a3a48'),
    colored(new THREE.ConeGeometry(.42,.4,4).rotateY(Math.PI/4).translate(0,3.82,0),'#2c2c38'),
  ]);post.computeVertexNormals();
  const mesh=new THREE.InstancedMesh(post,material,Math.max(1,sites.length));const m=new THREE.Matrix4();
  sites.forEach((s,i)=>{m.makeTranslation(s.x,s.y,s.z);mesh.setMatrixAt(i,m);});mesh.count=sites.length;mesh.computeBoundingSphere();
  return mesh;
}
function colored(g,color){const n=g.index?g.toNonIndexed():g;const c=new THREE.Color(color),arr=new Float32Array(n.attributes.position.count*3);for(let i=0;i<arr.length;i+=3){arr[i]=c.r;arr[i+1]=c.g;arr[i+2]=c.b;}n.setAttribute('color',new THREE.BufferAttribute(arr,3));n.deleteAttribute('uv');n.deleteAttribute('normal');return n;}

// ---------------------------------------------------------------- glow sprites
const GLOW_VERTEX=`attribute float size;attribute vec3 tint;uniform float uScale;uniform float uFogDensity;varying vec3 vTint;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float d=-mv.z;
gl_PointSize=clamp(size*uScale/max(d,.5),0.,256.);float fog=exp(-uFogDensity*uFogDensity*d*d);vTint=tint*fog;}`;
const GLOW_FRAGMENT=`varying vec3 vTint;void main(){float d=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-d),2.4);if(a<.003)discard;gl_FragColor=vec4(vTint*a,1.);}`;

/** Additive glow sprites (lanterns, windows, stardust halos...). One draw call per set. */
export function createGlowPoints(capacity,{fogDensity,dynamic=true}={}){
  const geometry=new THREE.BufferGeometry();
  const position=new THREE.BufferAttribute(new Float32Array(capacity*3),3),tint=new THREE.BufferAttribute(new Float32Array(capacity*3),3),size=new THREE.BufferAttribute(new Float32Array(capacity),1);
  if(dynamic)for(const a of [position,tint,size])a.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',position);geometry.setAttribute('tint',tint);geometry.setAttribute('size',size);geometry.setDrawRange(0,0);
  const material=new THREE.ShaderMaterial({uniforms:{uScale:{value:600},uFogDensity:{value:fogDensity}},vertexShader:GLOW_VERTEX,fragmentShader:GLOW_FRAGMENT,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=10;
  let count=0;const c=new THREE.Color();
  return {points,material,capacity,
    clear(){count=0;},
    push(x,y,z,color,sizeValue,intensity=1){if(count>=capacity)return;position.setXYZ(count,x,y,z);c.set(color);tint.setXYZ(count,c.r*intensity,c.g*intensity,c.b*intensity);size.setX(count,sizeValue);count++;},
    commit(){geometry.setDrawRange(0,count);for(const a of [position,tint,size]){a.clearUpdateRanges();a.addUpdateRange(0,count*a.itemSize);a.needsUpdate=true;}},
    get count(){return count;},
  };
}

// ---------------------------------------------------------------- sky
export function createSky({stars=1}={}){
  const material=new THREE.ShaderMaterial({
    uniforms:{uZenith:{value:COLORS.zenith},uSky:{value:COLORS.sky},uHorizon:{value:COLORS.horizon},uMoonDir:{value:MOON_DIRECTION},uMoon:{value:COLORS.moon},uTime:{value:0},uStars:{value:stars}},
    vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader:`uniform vec3 uZenith,uSky,uHorizon,uMoonDir,uMoon;uniform float uTime,uStars;varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec3 d=normalize(vDir);float h=d.y;
vec3 col=mix(uHorizon,uSky,smoothstep(-.02,.28,h));col=mix(col,uZenith,smoothstep(.25,.9,h));
float m=max(dot(d,uMoonDir),0.);col+=uMoon*(pow(m,24.)*.18+pow(m,180.)*.35);
float disc=smoothstep(.99935,.99955,m);float mare=hash(floor(d.xz*900.))*.12+hash(floor(d.xz*260.))*.1;col=mix(col,uMoon*(1.05-mare),disc);
vec2 uv=vec2(atan(d.z,d.x)*80.,asin(clamp(h,-1.,1.))*80.);vec2 cell=floor(uv);float r=hash(cell);
if(r>1.-.012*uStars&&h>.04){vec2 f=fract(uv)-.5-(vec2(hash(cell+3.1),hash(cell+7.7))-.5)*.6;float s=smoothstep(.09,.0,length(f));
float tw=.6+.4*sin(uTime*(1.5+r*3.)+r*40.);col+=vec3(.85,.9,1.)*s*tw*smoothstep(.04,.3,h)*(1.-disc)*(.6+r*3.);}
col*=1.+.04*sin(atan(d.z,d.x)*3.+h*7.)*smoothstep(.0,.4,h);
gl_FragColor=vec4(col,1.);}`,
    side:THREE.BackSide,depthWrite:false,depthTest:true,fog:false,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),material);mesh.scale.setScalar(1800);mesh.renderOrder=-10;mesh.frustumCulled=false;
  return {mesh,material};
}

// ---------------------------------------------------------------- distant ridges
export function createRidges(material,seed=3){
  const random=createRandom(seed),positions=[],colors=[],c=new THREE.Color(),near=new THREE.Color('#1d2b46'),far=new THREE.Color('#2b4166'),snow=new THREE.Color('#6d7ea3');
  for(const [radius,height,tone] of [[560,120,near],[760,190,far]]){
    const n=96;let prevTop=null;
    for(let i=0;i<=n;i++){
      const a=i/n*Math.PI*2,r=radius+(random()-.5)*60,peak=height*(.35+fbm(Math.cos(a)*3+radius,Math.sin(a)*3)*.9)+(random()<.15?height*.35:0);
      const x=Math.cos(a)*r,z=Math.sin(a)*r,top=[x,peak-20,z],base=[x*1.04,-30,z*1.04];
      if(prevTop){
        const [pt,pb]=prevTop;
        positions.push(...pb,...base,...pt,...pt,...base,...top);
        for(const v of [pb,base,pt,pt,base,top]){c.copy(tone).lerp(snow,THREE.MathUtils.clamp((v[1]-height*.55)/(height*.8),0,.55));colors.push(c.r,c.g,c.b);}
      }
      prevTop=[top,base];
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name='Distant ridges';return mesh;
}

// ---------------------------------------------------------------- water
export function createWater(hf,{fogDensity}){
  // An 8-bit depth map (2 m texels) gives shoreline foam and shallow tint
  // without a depth pass.
  const size=201,data=new Uint8Array(size*size);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const h=hf.heightAt(-200+i*2,-200+j*2);data[j*size+i]=Math.round(THREE.MathUtils.clamp((h+24)/40,0,1)*255);}
  const depth=new THREE.DataTexture(data,size,size,THREE.RedFormat,THREE.UnsignedByteType);depth.magFilter=depth.minFilter=THREE.LinearFilter;depth.needsUpdate=true;
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uDepth:{value:depth},uMoonDir:{value:MOON_DIRECTION},uDeep:{value:new THREE.Color('#0d2040')},uShallow:{value:new THREE.Color('#22647a')},
      uSky:{value:COLORS.horizon},uFog:{value:COLORS.fog},uFogDensity:{value:fogDensity},uMoon:{value:COLORS.moon},uWater:{value:WATER_LEVEL}},
    vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime,uFogDensity,uWater;uniform sampler2D uDepth;uniform vec3 uMoonDir,uDeep,uShallow,uSky,uFog,uMoon;varying vec3 vWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
vec2 uv=(vWorld.xz+200.)/402.;float terrain=texture2D(uDepth,clamp(uv,0.,1.)).r*40.-24.;float depth=uWater-terrain;
vec2 p=vWorld.xz*.09;float t=uTime;
float n1=noise(p*1.3+vec2(t*.22,t*.11)),n2=noise(p*2.7-vec2(t*.17,-t*.21)),n3=noise(p*7.+vec2(t*.6,t*.3));
vec3 n=normalize(vec3((n1-.5)*.55+(n2-.5)*.3+(n3-.5)*.12,1.,(n2-.5)*.55+(n1-.5)*.25+(n3-.5)*.12));
vec3 v=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,v),0.),3.)*.9+.1;
vec3 base=mix(uShallow,uDeep,smoothstep(0.,9.,depth));
vec3 col=mix(base,uSky,fres);
vec3 r=reflect(-v,n);float spec=pow(max(dot(r,uMoonDir),0.),260.)*2.2;float glint=pow(max(dot(r,uMoonDir),0.),16.)*.16*smoothstep(.68,.8,n3)+pow(max(dot(r,uMoonDir),0.),5.)*.05;
col+=uMoon*(spec+glint);
float foam=smoothstep(1.4,.0,depth)*(.55+.45*sin(depth*5.-t*2.2+n2*6.));foam*=step(-1.,depth);
col=mix(col,vec3(.78,.86,.95),clamp(foam,0.,1.)*.55);
float d=length(cameraPosition-vWorld);float fog=1.-exp(-uFogDensity*uFogDensity*d*d);
gl_FragColor=vec4(mix(col,uFog,fog),1.);}`,
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000,1,1).rotateX(-Math.PI/2),material);mesh.position.y=WATER_LEVEL;mesh.name='Lake';
  return {mesh,material,depth};
}

/** Darkening around tree bases and building footprints, applied to terrain colours. */
export function createShade(trees,cell=3){
  const grid=new Map(),key=(i,j)=>i*4096+j;
  for(const t of trees){const i=Math.floor(t.x/cell),j=Math.floor(t.z/cell);grid.set(key(i,j),(grid.get(key(i,j))||0)+t.scale);}
  return(x,z)=>{
    let occ=0;const i=Math.floor(x/cell),j=Math.floor(z/cell);
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)occ+=(grid.get(key(i+a,j+b))||0)*(a===0&&b===0?1:.45);
    let s=1-Math.min(.32,occ*.09);
    for(const l of locations){const d=Math.hypot(x-l.x,z-l.z);if(d<l.radius+4)s*=.86+.14*THREE.MathUtils.smoothstep(d,l.radius*.4,l.radius+4);}
    for(const [[ax,az],[bx,bz]] of Object.values(bridges))for(const [px,pz] of [[ax,az],[bx,bz]]){const d=Math.hypot(x-px,z-pz);if(d<6)s*=.85+.15*d/6;}
    return s;
  };
}
