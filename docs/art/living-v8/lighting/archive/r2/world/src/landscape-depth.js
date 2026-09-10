import * as THREE from 'three';
import {createGroveTree} from './grove-foliage.js';
import {attachWindShadows} from './environment-wind.js';
import {addScannedRocks} from './rock-scans.js';

const TAU=Math.PI*2;
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);}

/** Local atmospheric attenuation keeps this 3D coast ahead of the separately
 * graded painting. It replaces Three's fog stage, retaining live scene colors,
 * per-pass view depth and the lake's eventual convergence to its sky horizon. */
export function applyLandscapeDepthFog(material,{horizon=false}={}){
  material.uniforms??={};material.uniforms.nightFactor??={value:0};
  const night=material.uniforms.nightFactor,compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    compile.call(material,shader);shader.uniforms.depthNightFactor=night;
    shader.fragmentShader='uniform float depthNightFactor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
      #ifdef USE_FOG
        float coastalFogScale=mix(.65,.50,depthNightFactor);
        ${horizon?'coastalFogScale=mix(coastalFogScale,1.,smoothstep(1800.,3000.,vFogDepth));':''}
        float coastalFogDepth=vFogDepth*coastalFogScale;
        #ifdef FOG_EXP2
          float fogFactor=1.-exp(-fogDensity*fogDensity*coastalFogDepth*coastalFogDepth);
        #else
          float fogFactor=smoothstep(fogNear,fogFar,coastalFogDepth);
        #endif
        gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
      #endif`);
  };
  material.userData.localDepthFog=true;material.customProgramCacheKey=()=>`${cacheKey}-coastal-fog-${horizon}`;return material;
}

// Three unequal coastal compositions leave the central water and flight routes
// open. Dimensions describe actual bedrock, not painted or camera-facing cards.
export const DEPTH_RIDGES=[
  {name:'West folded headland',x:-268,z:-162,length:131,width:76,height:23,angle:.48,seed:11,peaks:[[.22,.76],[.40,1],[.66,.48]]},
  {name:'West low shoulder',x:-235,z:-232,length:67,width:44,height:18,angle:1.05,seed:23,peaks:[[.29,.54],[.63,1]]},
  {name:'West detached skerry',x:-240,z:-98,length:42,width:29,height:13,angle:-.22,seed:31,peaks:[[.38,1],[.69,.46]]},
  {name:'East slanting ridge',x:64,z:-298,length:142,width:75,height:25,angle:-.24,seed:43,peaks:[[.23,.62],[.54,1],[.79,.47]]},
  {name:'East broken reef',x:127,z:-222,length:56,width:36,height:16,angle:-.15,seed:59,peaks:[[.31,1],[.61,.68]]},
  {name:'Receding western ridge',x:-435,z:-509,length:186,width:94,height:29,angle:.88,seed:71,peaks:[[.23,.68],[.47,1],[.74,.73]]},
  {name:'Receding eastern shelf',x:10,z:-710,length:202,width:106,height:31,angle:-.43,seed:97,peaks:[[.20,.71],[.43,1],[.68,.79],[.83,.45]]},
  {name:'Receding companion',x:-303,z:-471,length:87,width:54,height:20,angle:1.14,seed:83,peaks:[[.34,1],[.68,.53]]},
];

/** A closed, curved ridge with an eccentric crest, eroded saddles and folded
 * shoulders. Positions are authored in world coordinates for cliffMaterial's
 * regional/height treatment; mesh transforms deliberately remain identity. */
export function ridgeGeometry(ridge,{rows=112,columns=56}={}){
  const p=[],uv=[],colors=[],index=[],{x,z,length,width,height,angle,seed,peaks}=ridge,c=Math.cos(angle),s=Math.sin(angle),base=-28;
  function vertex(u,v,end=false){
    const t=u*2-1,envelope=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.56);
    const bend=Math.sin(u*Math.PI*1.35+seed)*width*.16+Math.sin(u*TAU)*width*.08;
    const bank=(1+Math.sin(u*17+seed)*.085+Math.sin(u*31-seed)*.035)*envelope;
    const lateral=end?0:v*width*.5*bank;
    const along=t*length*.5+Math.sin(v*3+u*9+seed)*envelope*1.6;
    const wx=x+along*c-(lateral+bend)*s,wz=z+along*s+(lateral+bend)*c;
    // A broad, emergent bedrock shelf carries several offset, blunt rock heads.
    // Every approach sees shoulders and saddles, including a view along the spine.
    const coast=smooth(0,.24,envelope*(1-Math.abs(v)));
    let crest=0;
    for(const [i,[at,weight]]of peaks.entries()){
      const side=(i%2?-.29:.31)+Math.sin(seed+i)*.08;
      const du=(u-at)/(.125+weight*.085),dv=(v-side)/(.36+weight*.18);
      crest=Math.max(crest,weight*Math.exp(-(du**4+dv**4)));
    }
    const secondary=.13*Math.exp(-(((v+.13)/.84)**2));
    const detail=(noise(wx*.11+seed,wz*.11)-.5)*3.0+(noise(wx*.36,wz*.36+seed)-.5)*.72;
    const fold=Math.sin(wx*.19+wz*.13+noise(wx*.047,wz*.047)*5)*.65;
    const y=end?base:base+coast*(10+height*(crest*.47+secondary*.56)+detail*.75+fold*.6);
    p.push(wx,y,wz);uv.push(wx*.19,wz*.19);
    const tone=.34+noise(wx*.06+seed,wz*.06)*.25+smooth(-15,18,y)*.06;
    colors.push(tone*.94,tone*1.04,tone);
    return p.length/3-1;
  }
  const start=vertex(0,0,true);
  for(let row=1;row<rows;row++)for(let col=0;col<=columns;col++)vertex(row/rows,col/columns*2-1);
  const end=vertex(1,0,true),stride=columns+1;
  for(let col=0;col<columns;col++){index.push(start,1+col+1,1+col);const last=1+(rows-2)*stride+col;index.push(last,last+1,end);}
  for(let row=0;row<rows-2;row++)for(let col=0;col<columns;col++){const a=1+row*stride+col,b=a+stride;index.push(a,a+1,b,a+1,b+1,b);}
  const perimeter=[start];
  for(let row=0;row<rows-1;row++)perimeter.push(1+row*stride);
  perimeter.push(end);for(let row=rows-2;row>=0;row--)perimeter.push(1+row*stride+columns);
  const bottom=p.length/3;p.push(x,base-5,z);uv.push(x*.19,z*.19);colors.push(.3,.33,.32);
  for(let i=0;i<perimeter.length;i++)index.push(bottom,perimeter[(i+1)%perimeter.length],perimeter[i]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(index);geometry.computeVertexNormals();
  // Project steep faces in metres so the photographic relief is not stretched
  // over an entire vertical ridge. RGB remains compatible with the shared rock.
  const n=geometry.attributes.normal,tex=geometry.attributes.uv;
  for(let i=0;i<n.count;i++)if(Math.abs(n.getY(i))<.62)tex.setXY(i,(Math.abs(n.getX(i))>Math.abs(n.getZ(i))?p[i*3+2]:p[i*3])*.19,p[i*3+1]*.19);
  const moss=[];for(let i=0;i<n.count;i++)moss.push(smooth(.30,.91,n.getY(i))*smooth(-14,-6,p[i*3+1])*(.58+noise(p[i*3]*.087+seed,p[i*3+2]*.087)*.42));
  geometry.setAttribute('ridgeMoss',new THREE.Float32BufferAttribute(moss,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export const DEPTH_MIST=[
  {name:'West headland water mist',centre:[-279,-8,-192],size:[119,6,41],angle:.5,opacity:.15},
  {name:'East reef water mist',centre:[58,-7,-292],size:[123,7,43],angle:-.6,opacity:.13},
  {name:'Receding valley mist',centre:[-363,-3,-481],size:[139,11,48],angle:.86,opacity:.19},
  {name:'Distant west valley air',centre:[-670,10,-836],size:[239,21,74],angle:.34,opacity:.14},
  {name:'Distant east valley air',centre:[624,7,-765],size:[196,18,68],angle:-.49,opacity:.12},
];

const mistFragment=`
  varying vec3 localPoint;
  uniform vec3 localEye,fogTint;
  uniform float windTime,nightFactor,baseOpacity;
  float mistHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float mistNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mistHash(i),mistHash(i+vec2(1,0)),f.x),mix(mistHash(i+vec2(0,1)),mistHash(i+vec2(1,1)),f.x),f.y);}
  void main(){
    // Analytic entry/exit through a soft ellipsoid. Each draw supplies its own
    // camera in this volume's local frame, including Water's reflected camera.
    vec3 ray=normalize(localPoint-localEye);
    float b=dot(localEye,ray),c=dot(localEye,localEye)-1.,discriminant=b*b-c;
    if(discriminant<=0.)discard;
    float nearT=max(0.,-b-sqrt(discriminant)),farT=-b+sqrt(discriminant);
    if(farT<=nearT)discard;
    float sum=0.;
    for(int i=0;i<14;i++){
      vec3 p=localEye+ray*mix(nearT,farT,(float(i)+.5)/14.);
      float feather=pow(max(0.,1.-dot(p,p)),1.7);
      float drift=mistNoise(p.xz*3.7+vec2(windTime*.012,windTime*.004));
      float lanes=smoothstep(.22,.76,drift*.72+mistNoise(p.xz*8.1-3.)*.28);
      sum+=feather*lanes;
    }
    float opacity=(1.-exp(-sum*(farT-nearT)/14.*2.1))*baseOpacity*mix(1.,.76,nightFactor);
    if(opacity<.001)discard;
    vec3 tint=fogTint*mix(vec3(.92,1.,1.02),vec3(.86,.98,1.10),nightFactor);
    gl_FragColor=vec4(tint,opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Existing full-detail pine and scan surfaces supply scale on sheltered upper
// ledges; all positions are fitted to the actual new triangles, never a proxy.
function ridgeSurface(mesh,u,v){
  const p=mesh.geometry.attributes.position,rows=112,columns=56,row=Math.max(1,Math.min(rows-1,Math.round(u*rows))),col=Math.max(0,Math.min(columns,Math.round((v+1)*.5*columns))),at=1+(row-1)*(columns+1)+col;
  return new THREE.Vector3(p.getX(at),p.getY(at),p.getZ(at));
}
const pineSites=[[.17,.16,1.04],[.21,.36,.91],[.25,.23,1.22],[.30,.46,.82],[.34,.22,1.04],[.39,-.16,.97],[.43,-.36,1.31],[.48,-.22,1.12],[.54,-.46,.88],[.59,-.20,1.08],[.65,.22,1.18],[.70,.42,.95],[.75,.18,1.09],[.81,.32,.86]];
function addDepthPlanting(group,ridges){
  const source=createGroveTree('pine',168,'near'),placements=[];
  for(const [i,ridge]of ridges.entries()){
    if(DEPTH_RIDGES[i].height<18)continue;
    for(const [j,[u,v,scale]]of pineSites.entries()){
      const point=ridgeSurface(ridge,u,v);if(point.y<-12.2)continue;
      const hero=(i===0||i===3)&&(j===2||j===6||j===10);
      placements.push({point,scale:scale*.68*(i>4?1.04:1),crownWidth:hero?1.38:1,crownHeight:hero?1.12:1,angle:j*2.399+i*.71});
    }
  }
  const planted=new THREE.Group();planted.name='Sheltered pine groups on coastal ridges';group.add(planted);const transform=new THREE.Object3D();
  for(const part of [source.branchesMesh,source.leavesMesh]){
    const material=part.material.clone(),key=part.material.customProgramCacheKey();material.userData.sharedAsset=false;material.onBeforeCompile=part.material.onBeforeCompile;material.customProgramCacheKey=()=>key;applyLandscapeDepthFog(material);
    const mesh=new THREE.InstancedMesh(part.geometry,material,placements.length);mesh.name=`Coastal ${part.name}`;
    for(const [i,placement]of placements.entries()){transform.position.copy(placement.point);transform.position.y-=.1;transform.scale.set(placement.scale*placement.crownWidth,placement.scale*(.89+(i%3)*.08)*placement.crownHeight,placement.scale*placement.crownWidth);transform.rotation.set(0,placement.angle,0);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);}
    mesh.castShadow=mesh.receiveShadow=true;attachWindShadows(mesh);mesh.computeBoundingBox();mesh.computeBoundingSphere();planted.add(mesh);
  }
  // Only this temporary template's shadow wrappers are unused; geometry and
  // materials now belong to the attached instances (or the shared asset cache).
  source.traverse(o=>{o.customDepthMaterial?.dispose();o.customDistanceMaterial?.dispose();if(o.material&&!o.material.userData.sharedAsset)o.material.dispose();});
  planted.userData.treeCount=placements.length;return planted;
}
function addDepthScans(group,ridges){
  const placements=[],sites=[[.10,.06],[.17,-.47],[.24,.47],[.32,-.12],[.38,.59],[.44,-.50],[.53,.09],[.61,.50],[.67,-.58],[.74,.19],[.84,-.37],[.91,.19]];
  for(const [i,ridge]of ridges.entries())for(const [j,[u,v]]of sites.entries()){
    const point=ridgeSurface(ridge,u,v);if(point.y<-24)continue;
    const span=Math.min(DEPTH_RIDGES[i].width*.42,13+(j%4)*2.2)*(i>4?1.16:1),height=span*(.53+(j%3)*.06);
    placements.push({x:point.x,y:Math.min(point.y-.35,Math.max(-23,point.y-height*.40)),z:point.z,scanSize:[span,height,span*(.69+(j%2)*.17)],r:i*.87+j*1.91,kind:'moss',piece:i+j});
  }
  return addScannedRocks(group,placements,'Embedded full-resolution coastal scan structure',{
    resolvePlacement(intent,source){
      const size=source.geometry.boundingBox.getSize(new THREE.Vector3());
      return {...intent,sx:intent.scanSize[0]/size.x,sy:intent.scanSize[1]/size.y,sz:intent.scanSize[2]/size.z};
    },
    // Every source revision receives its own mineral treatment and maps. Share
    // the registered ridge uniform so a late batch has today's night value
    // immediately, including when no scan existed at the last environment tick.
    materialFactory(source){
      const material=source.clone(),compile=source.onBeforeCompile;material.userData.sharedAsset=false;
      material.onBeforeCompile=shader=>{compile.call(material,shader);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float coastalScanLuminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        vec3 coastalScanMineral=vec3(.36,.40,.37)*(.39+coastalScanLuminance*1.42);
        diffuseColor.rgb=mix(diffuseColor.rgb,coastalScanMineral,.62);`);};
      material.customProgramCacheKey=()=> 'coastal-full-scan-mineral-v7';material.uniforms={nightFactor:ridges[0].material.uniforms.nightFactor};return applyLandscapeDepthFog(material);
    }
  });
}

export function createLandscapeDepth(root,{rockMaterial,wind={value:0},fogColor=new THREE.Color('#7398b8')}={}){
  const group=new THREE.Group();group.name='Authored middle-distance coast';root.add(group);
  const ridges=[],mist=[];
  for(const ridge of DEPTH_RIDGES){
    const material=rockMaterial(),compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
    material.onBeforeCompile=shader=>{
      compile(shader);
      shader.vertexShader='attribute float ridgeMoss; varying float coastalMoss;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncoastalMoss=ridgeMoss;');
      shader.fragmentShader='varying float coastalMoss;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','diffuseColor.rgb*=mix(vec3(1.),vec3(.48,.82,.58),coastalMoss*.74);\n#include <normal_fragment_begin>');
    };
    material.customProgramCacheKey=()=>`${cacheKey}-coastal-moss-v7`;applyLandscapeDepthFog(material);

    const mesh=new THREE.Mesh(ridgeGeometry(ridge),material);mesh.name=ridge.name;mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.landscapeDepth=true;group.add(mesh);ridges.push(mesh);
  }
  const vegetation=addDepthPlanting(group,ridges);
  const scanAccents=addDepthScans(group,ridges);
  for(const patch of DEPTH_MIST){
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.BackSide,
      uniforms:{localEye:{value:new THREE.Vector3()},fogTint:{value:fogColor},windTime:wind,nightFactor:{value:0},baseOpacity:{value:patch.opacity}},
      vertexShader:'varying vec3 localPoint;void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:mistFragment});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);mesh.name=patch.name;mesh.position.fromArray(patch.centre);mesh.scale.fromArray(patch.size);mesh.rotation.y=-patch.angle;mesh.renderOrder=2;mesh.userData.localMist=true;
    mesh.onBeforeRender=(_renderer,_scene,camera)=>{camera.getWorldPosition(material.uniforms.localEye.value);mesh.worldToLocal(material.uniforms.localEye.value);};
    group.add(mesh);mist.push(mesh);
  }
  // Scene disposal visits the owned ridge material, while shared botanical/
  // scan materials can be skipped. Release instance buffers and our separate
  // wind-shadow materials from this one anchor without touching cached sources.
  let disposed=false;
  ridges[0].material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;group.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.customDepthMaterial?.dispose();o.customDistanceMaterial?.dispose();});});
  return {group,ridges,mist,vegetation,scanAccents};
}
