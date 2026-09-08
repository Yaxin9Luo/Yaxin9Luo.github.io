import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {beveledBlock,assignArchitecturalUVs} from './architecture.js';
import {surface,fbm} from './landscape.js';
import {createGardenLamp} from './site-details.js';
import {gardenDistricts,insideAuthoredGarden} from './environment-layout.js';
import {bridges} from './locations.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import signageFontData from './signage-font.json' with {type:'json'};
import {createGroveTree,createGroveShrub,createGardenFlower} from './grove-foliage.js';

const TAU=Math.PI*2;
const signageFont=new FontLoader().parse(signageFontData);
const material=(name,color,extra={})=>{
  const m=new THREE.MeshStandardMaterial({color,roughness:.83,...extra});m.name=name;return m;
};
function palette(){
  const pbr=(name,set,color,{metres=2.085,normal=.72,...options}={})=>{
    const m=surface(set,{color,normalScale:new THREE.Vector2(normal,normal),...options});m.name=name;
    // Builder uses one consistent 2.8 m UV basis. Each surface retains its
    // measured repeat without changing geometry or shared texture transforms.
    const uvScale=2.8/metres,compile=m.onBeforeCompile,programKey=m.customProgramCacheKey();
    m.userData.metresPerRepeat=metres;m.userData.uvScale=uvScale;
    m.onBeforeCompile=shader=>{
      compile(shader);
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv*=${uvScale.toFixed(5)};
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv*=${uvScale.toFixed(5)};
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv*=${uvScale.toFixed(5)};
        #endif`);
    };
    m.customProgramCacheKey=()=>`${programKey}-garden-scale-${metres}`;return m;
  };
  const stone=(name,color,options={})=>pbr(name,'castle-masonry',color,{roughness:.98,...options});
  const result={
    stone:stone('Garden warm limestone','#c8ccbd',{albedoStrength:.78}),
    trim:stone('Carved garden coping','#cccdbc',{normal:.15,albedoStrength:.24,roughness:.95,roughnessFloor:.80}),
    base:pbr('Garden foundation stone','mossy-rock','#a5ac9b',{metres:3,normal:.82,albedoStrength:.83,roughness:.99,roughnessFloor:.78}),
    paving:stone('Garden honed paving','#c6c7b6',{normal:.36,albedoStrength:.56,roughness:.94,roughnessFloor:.74}),
    pavingLight:stone('Garden pale paving','#d2d0bf',{normal:.28,albedoStrength:.44,roughness:.98,roughnessFloor:.80}),
    pavingDark:stone('Garden slate inlay','#77909a',{normal:.26,albedoStrength:.46,roughness:.92,roughnessFloor:.74}),
    soil:pbr('Cultivated garden earth','forest-ground','#8b8063',{metres:2.14,normal:.95,albedoStrength:.94,roughness:1,roughnessFloor:.88}),
    wood:pbr('Garden oiled walnut','aged-wood','#b29a7a',{metres:2,normal:.60,albedoStrength:.90,roughness:.91,roughnessFloor:.61}),
    woodLight:pbr('Garden oak edges','aged-wood','#d0b58e',{metres:2,normal:.42,albedoStrength:.84,roughness:.94,roughnessFloor:.68}),
    brass:pbr('Garden aged brass','oxidized-copper','#d8b76f',{metres:1,normal:.20,albedoStrength:.44,metalness:.72,roughness:.72,roughnessFloor:.36}),
    roof:material('Garden blue grey canopy','#526f7c',{metalness:.06}),
    leafDark:material('Garden shaded silver green','#4d7567'),leaf:material('Garden silver green','#729783'),
    leafLight:material('Garden lit silver green','#a2bba1'),pink:material('Garden rose blossom','#c5a8bb'),
    pinkLight:material('Garden pale rose blossom','#e1c7ce'),lilac:material('Garden selective lilac','#aaa7c7'),
    trunk:material('Garden silver bark','#7c8174'),paper:material('Garden ivory paper','#e1dcc6'),
    ink:pbr('Garden book cloth','wool-cloth','#6f91a0',{metres:.273,normal:.45,albedoStrength:.76,roughness:1,roughnessFloor:.89}),
    redBook:pbr('Garden wine book cloth','wool-cloth','#a37483',{metres:.273,normal:.45,albedoStrength:.76,roughness:1,roughnessFloor:.89}),
    water:material('Fountain still blue water','#4e929d',{metalness:.28,roughness:.2}),
  };
  result.wind={value:0};
  for(const key of['leafDark','leaf','leafLight','pink','pinkLight','lilac']){
    const m=result[key];m.onBeforeCompile=shader=>{
      shader.uniforms.gardenWind=result.wind;
      shader.vertexShader='uniform float gardenWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float gardenPhase=position.y*.53+(position.x+modelMatrix[3].x)*.27;
        float gardenFlex=smoothstep(.8,5.,position.y);
        transformed.x+=sin(gardenWind*.9+gardenPhase)*.045*gardenFlex;
        transformed.z+=cos(gardenWind*.7+gardenPhase)*.028*gardenFlex;`);
    };m.customProgramCacheKey=()=> 'authored-garden-wind-v1';
  }
  return result;
}

// Each authored object becomes one mesh per material. Geometry remains ordinary,
// exportable meshes; no billboard silhouettes or downloaded scenery are required.
class Builder {
  constructor(name,mats){this.group=new THREE.Group();this.group.name=name;this.m=mats;this.parts=new Map();this.solids=[];}
  add(geometry,mat,p=[0,0,0],s=[1,1,1],r=[0,0,0],preserveUV=false){
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(...s)));
    if(!preserveUV)assignArchitecturalUVs(g,2.8);
    if(!this.parts.has(mat))this.parts.set(mat,[]);this.parts.get(mat).push(g);return this;
  }
  box(x,y,z,w,h,d,mat=this.m.stone,rotation=0){return this.add(beveledBlock(w,h,d,Math.min(.065,h*.2)),mat,[x,y,z],[1,1,1],[0,rotation,0]);}
  cylinder(x,y,z,r,h,mat=this.m.stone,top=r,segments=48){const g=new THREE.CylinderGeometry(top,r,h,segments);this.add(g,mat,[x,y,z]);g.dispose();return this;}
  ring(x,y,z,r,tube,mat=this.m.brass,rotation=[Math.PI/2,0,0]){const g=new THREE.TorusGeometry(r,tube,12,96);this.add(g,mat,[x,y,z],[1,1,1],rotation);g.dispose();return this;}
  beam(a,b,r,mat=this.m.wood,top=r){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),g=new THREE.CylinderGeometry(top,r,delta.length(),12);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));this.add(g,mat,av.add(bv).multiplyScalar(.5).toArray());g.dispose();return this;}
  boxSolid(name,x,z,w,d,bottom,top){this.solids.push({name,bottom,top,planes:[[1,0,0,x+w/2],[-1,0,0,-x+w/2],[0,0,1,z+d/2],[0,0,-1,-z+d/2],[0,-1,0,-bottom],[0,1,0,top]]});}
  roundSolid(name,x,z,r,bottom,top){const planes=[[0,-1,0,-bottom],[0,1,0,top]];for(let i=0;i<16;i++){const a=i*TAU/16,nx=Math.cos(a),nz=Math.sin(a);planes.push([nx,0,nz,r+nx*x+nz*z]);}this.solids.push({name,bottom,top,planes});}
  finish(){for(const [mat,parts]of this.parts){const mesh=new THREE.Mesh(mergeGeometries(parts),mat);mesh.name=`${this.group.name} — ${mat.name}`;mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);parts.forEach(g=>g.dispose());}this.group.userData.colliders=this.solids;this.parts.clear();return this.group;}
}

function clippedRectangle(w,d,cut=.65){
  const shape=new THREE.Shape(),points=[[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]];
  points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();return shape;
}
function slab(b,x,z,w,d,bottom,height,mat,cut=.6){
  const g=new THREE.ExtrudeGeometry(clippedRectangle(w,d,Math.min(cut,w*.2,d*.2)),{depth:height,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);b.add(g,mat,[x,bottom,z]);g.dispose();
}
function paving(b,width,depth){
  slab(b,0,0,width,depth,-.32,.38,b.m.base,1.15);
  slab(b,0,0,width-.16,depth-.16,.06,.06,b.m.trim,1.06);
  slab(b,0,0,width-1.08,depth-1.08,.121,.02,b.m.pavingDark,.86);
  const w=width-1.5,d=depth-1.5,nx=Math.ceil(w/2.8),nz=Math.ceil(d/3.2),tw=w/nx,td=d/nz;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)b.box(-w/2+(i+.5)*tw,.157,-d/2+(j+.5)*td,tw-.022,.028,td-.022,(i+j*3)%7===0?b.m.pavingLight:b.m.paving);
  // Broad bands read at flight height; mortar joints stay secondary.
  for(const sign of[-1,1])b.box(sign*(width/2-.77),.186,0,.095,.014,depth-2,b.m.brass);
}
function planter(b,x,z,w,d,height=.65){
  slab(b,x,z,w+.18,d+.18,.14,.2,b.m.base,.64);
  slab(b,x,z,w,d,.32,height-.1,b.m.stone,.57);
  slab(b,x,z,w+.16,d+.16,height+.22,.14,b.m.trim,.64);
  slab(b,x,z,w-.47,d-.47,height+.365,.012,b.m.soil,.39);
  b.boxSolid('raised flowerbed',x,z,w+.18,d+.18,.14,height+.36);
  return height+.39;
}

function botanicalAsset(b,type,kind){
  const assets=b.m.botanicalAssets||=(new Map()),key=`${type}:${kind}`;
  if(!assets.has(key))assets.set(key,type==='tree'?createGroveTree(kind,154):type==='shrub'?createGroveShrub(kind,24):createGardenFlower(kind,17));
  return assets.get(key);
}
function stampPlant(b,plant,position,scale,rotation=0){
  for(const mesh of plant.children)b.add(mesh.geometry,mesh.material,position,scale,[0,rotation,0],true);
}
function shrub(b,x,y,z,size=1,tint='green',seed=0){
  const kind=tint==='pink'?'cherry':tint==='lilac'?'lilac':'silver';
  stampPlant(b,botanicalAsset(b,'shrub',kind),[x,y,z],[size*1.42,size*.80,size*1.24],seed*.71);
}
function flowers(b,x,y,z,length,orientation=0,tint='pink'){
  const plant=botanicalAsset(b,'flower',tint==='lilac'?'lilac':'cherry');
  for(let i=0;i<Math.ceil(length/.39);i++){
    const v=-length/2+i*.39,px=x+Math.cos(orientation)*v,pz=z+Math.sin(orientation)*v,scale=.83+(i%3)*.17;
    stampPlant(b,plant,[px,y,pz],[scale,scale,scale],orientation+i*2.399);
  }
}
function tree(b,x,y,z,scale=1,blossom=false,rotation=0){
  stampPlant(b,botanicalAsset(b,'tree',blossom?'cherry':'silver'),[x,y,z],[scale*.78,scale*.67,scale*.78],rotation);
  b.roundSolid('ornamental tree trunk',x,z,.28*scale,y,y+2.9*scale);
}
function bench(b,x,z,width=3.3,rotation=0){
  const q=new THREE.Group(),small=new Builder('Garden bench',b.m);
  for(const side of[-1,1]){small.box(side*(width/2-.34),.48,0,.43,.72,.76,b.m.stone);small.box(side*(width/2-.34),.18,0,.65,.16,.92,b.m.base);}
  for(let i=0;i<4;i++)small.box(0,.92,-.3+i*.2,width,.16,.16,b.m.woodLight);
  for(const side of[-1,1])small.box(side*(width/2-.26),1.15,-.34,.11,1.12,.12,b.m.brass);
  for(let i=0;i<3;i++)small.box(0,1.25+i*.17,-.34,width,.13,.11,b.m.wood);
  const built=small.finish();q.add(built);q.position.set(x,0,z);q.rotation.y=rotation;q.updateMatrixWorld(true);
  built.children.forEach(o=>{const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);b.add(g,o.material);g.dispose();});
  // Seats sit below flight clearance. The visible tall back has a narrow proxy.
  const w=Math.abs(Math.cos(rotation))*width+Math.abs(Math.sin(rotation))*.9,d=Math.abs(Math.sin(rotation))*width+Math.abs(Math.cos(rotation))*.9;
  b.boxSolid('garden bench',x,z,w,d,.18,1.72);
}
function book(b,x,y,z,w=.6,d=.8,rotation=0,opened=false){
  b.box(x,y,z,w,.07,d,b.m.ink,rotation);
  if(opened){
    b.box(x,y+.068,z,w-.06,.062,d-.06,b.m.paper,rotation);
    const half=(w-.06)/2,depth=d-.06,profile=u=>.102+.041*Math.sin(Math.PI*u)+.004*u;
    for(const sign of[-1,1]){
      const p=[],uv=[],indices=[],n=16;
      for(let i=0;i<=n;i++)for(const edge of[-1,1]){const u=i/n;p.push(sign*u*half,profile(u),edge*depth/2);uv.push(u,(edge+1)/2);}
      for(let i=0;i<n;i++){const a=i*2;if(sign>0)indices.push(a,a+1,a+2,a+1,a+3,a+2);else indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      // Thin page-edge walls close the bowed top onto the underlying paper block.
      for(const edge of[-1,1])for(let i=0;i<n;i++){
        const u=i/n,v=(i+1)/n,at=p.length/3;p.push(sign*u*half,.099,edge*depth/2,sign*v*half,.099,edge*depth/2,sign*v*half,profile(v),edge*depth/2,sign*u*half,profile(u),edge*depth/2);uv.push(u,0,v,0,v,1,u,1);
        if(edge*sign>0)indices.push(at,at+1,at+2,at,at+2,at+3);else indices.push(at,at+2,at+1,at,at+3,at+2);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();b.add(g,b.m.paper,[x,y,z],[1,1,1],[0,rotation,0]);g.dispose();
      for(let row=0;row<7;row++){
        const vertices=[],faces=[],lineZ=(-.32+row*.10)*depth,end=.87-(row%3)*.075;
        for(let i=0;i<=8;i++){const u=.13+(end-.13)*i/8;for(const edge of[-1,1])vertices.push(sign*u*half,profile(u)+.0007,lineZ+edge*.0022);}
        for(let i=0;i<8;i++){const a=i*2;if(sign>0)faces.push(a,a+1,a+2,a+1,a+3,a+2);else faces.push(a,a+2,a+1,a+1,a+2,a+3);}
        const line=new THREE.BufferGeometry();line.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));line.setIndex(faces);line.computeVertexNormals();b.add(line,b.m.ink,[x,y,z],[1,1,1],[0,rotation,0]);line.dispose();
      }
    }
  }else{b.box(x,y+.075,z,w-.06,.1,d-.06,b.m.paper,rotation);b.box(x,y+.145,z,w,.025,d,b.m.redBook,rotation);}
}
function sign(b,title,size,position,rotation=[0,0,0],mat=b.m.paper){
  const geometry=new TextGeometry(title,{font:signageFont,size,depth:.008,curveSegments:4,bevelEnabled:false});geometry.computeBoundingBox();
  geometry.translate(-(geometry.boundingBox.max.x+geometry.boundingBox.min.x)/2,0,0);b.add(geometry,mat,position,[1,1,1],rotation);geometry.dispose();
}
function contentProp(group,action,label,anchor){
  group.userData.portfolioAnchor={action,label,position:anchor};
  group.traverse(o=>{if(o.isMesh){o.userData.portfolioAction=action;o.userData.portfolioLabel=label;}});return group;
}
function teaCup(b,x,y,z){
  const glaze=b.m.teaGlaze||=(material('Garden celadon tea glaze','#b9c5b4',{roughness:.28,metalness:.025}));
  const turn=(profile,mat)=>{const g=new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),48);b.add(g,mat,[x,y,z]);g.dispose();};
  turn([[0,0],[.16,0],[.19,.014],[.188,.025],[.15,.027],[.075,.018],[0,.018]],glaze);
  turn([[.072,.022],[.086,.026],[.11,.07],[.127,.245],[.127,.266],[.113,.271],[.108,.25],[.094,.078],[.066,.044],[0,.044],[0,.022]],glaze);
  b.ring(x,y+.267,z,.120,.007,b.m.brass);
  const handle=new THREE.TorusGeometry(.076,.017,12,40);b.add(handle,glaze,[x+.15,y+.158,z],[.86,1,1]);handle.dispose();
  b.cylinder(x,y+.210,z,.106,.005,b.m.wood,.106,48);
}
function readingDesk(b,x,z,rotation=0,books=true){
  for(const side of[-1,1]){b.box(x+side*1.3,1.05,z,.24,1.8,1.05,b.m.wood);b.box(x+side*1.3,.25,z,.52,.16,1.24,b.m.brass);}
  b.box(x,1.98,z,3.6,.18,1.48,b.m.woodLight,rotation);b.box(x,1.84,z,3.85,.08,1.62,b.m.brass,rotation);
  if(books){book(b,x-.65,2.09,z,.9,.9,-.18,true);book(b,x+.67,2.08,z-.17,.58,.82,.22);book(b,x+.72,2.28,z-.17,.55,.76,.32);}
  teaCup(b,x+1.27,2.073,z+.22);
  b.boxSolid('reading desk',x,z,3.85,1.62,.17,2.38);
}
function libraryShelf(b,x,z){
  b.box(x,1.62,z,3.6,2.9,.32,b.m.wood);for(const side of[-1,1])b.box(x+side*1.86,1.58,z+.2,.22,3.1,.88,b.m.stone);
  for(let row=0;row<3;row++){
    const y=.45+row*.9;b.box(x,y,z+.26,3.75,.13,.8,b.m.woodLight);
    for(let i=0;i<10;i++){const h=.51+(i%3)*.1;b.box(x-1.52+i*.33,y+h/2+.08,z+.3,.21,h,.46,i%3===0?b.m.redBook:i%3===1?b.m.ink:b.m.paper);b.box(x-1.52+i*.33,y+.26,z+.542,.22,.035,.025,b.m.brass);}
  }
  b.box(x,3.16,z+.22,4.05,.2,1.05,b.m.trim);b.boxSolid('weatherproof reading shelf',x,z+.2,4.1,1.05,.18,3.27);
}
function pergola(b,x,z,width=5.6,length=12){
  slab(b,x,z,width+1,length+1,.16,.22,b.m.trim,.6);
  for(const side of[-1,1])for(const along of[-1,0,1]){
    const px=x+side*width/2,pz=z+along*length/2;
    b.box(px,.65,pz,.74,.6,.74,b.m.base);b.box(px,2.7,pz,.36,3.65,.36,b.m.stone);b.box(px,4.65,pz,.66,.23,.66,b.m.trim);
    b.boxSolid('pergola pier',px,pz,.74,.74,.35,4.78);
  }
  for(const side of[-1,1]){
    b.box(x+side*width/2,4.87,z,.26,.28,length+.8,b.m.wood);b.boxSolid('pergola long beam',x+side*width/2,z,.28,length+.8,4.7,5.02);
    for(const bay of[-1,1]){
      const cz=z+bay*length/4,half=length/4;
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,3.65,-half),new THREE.Vector3(0,4.10,-half*.76),new THREE.Vector3(0,4.69,0),new THREE.Vector3(0,4.10,half*.76),new THREE.Vector3(0,3.65,half)]);
      const rib=new THREE.TubeGeometry(curve,40,.115,12,false);b.add(rib,b.m.trim,[x+side*width/2,0,cz]);rib.dispose();
      for(const along of[-1,1])b.boxSolid('pergola pointed arch shoulder',x+side*width/2,cz+along*half*.81,.25,half*.4,3.55,4.23);
    }
  }
  for(let i=0;i<=12;i++){const pz=z-length/2+i*length/12;b.box(x,5.08,pz,width+1.0,.22,.16,b.m.woodLight);b.boxSolid('pergola cross beam',x,pz,width+1,.16,4.96,5.2);}
  // Vines follow two corners and a single upper rail, leaving the bays open.
  for(const [dx,dz]of[[-width/2,-length/2],[width/2,length/2]]){
    for(let i=0;i<6;i++)shrub(b,x+dx,.75+i*.6,z+dz,.36,'green',i);
    for(let i=0;i<4;i++)shrub(b,x+dx*.72,5.08,z+dz*(1-i*.14),.76,'green',i);
  }
  bench(b,x-.8,z-2.9,3.5,Math.PI/2);bench(b,x-.8,z+2.1,3.5,Math.PI/2);
}
function fountain(mats){
  const b=new Builder('Courtyard astrolabe fountain',mats);
  for(const [r,h,y]of[[5.65,.16,.23],[5.2,.18,.39],[4.7,.22,.59]])b.cylinder(0,y,0,r,h,y<.4?mats.base:mats.trim,r,8);
  // A genuine hollow basin: rim and water remain separate, with visible depth.
  const basin=new THREE.Shape();basin.absarc(0,0,4.43,0,TAU,false);const hole=new THREE.Path();hole.absarc(0,0,3.91,0,TAU,true);basin.holes.push(hole);
  const rim=new THREE.ExtrudeGeometry(basin,{depth:.5,bevelEnabled:true,bevelSize:.055,bevelThickness:.05,bevelSegments:2,curveSegments:48});rim.rotateX(-Math.PI/2);b.add(rim,mats.stone,[0,.64,0]);rim.dispose();
  b.ring(0,1.145,0,4.18,.12,mats.trim);b.ring(0,.78,0,4.45,.047,mats.brass);
  b.cylinder(0,.93,0,3.92,.025,mats.water,3.92,64);
  for(const [r,h,y]of[[1.23,.18,1.03],[.87,.32,1.28],[.51,1.55,2.13],[.76,.18,2.93]])b.cylinder(0,y,0,r,h,mats.trim,r*.87,12);
  b.cylinder(0,3.25,0,.17,.5,mats.brass,.12,12);
  for(let i=0;i<8;i++){const a=i*TAU/8,x=Math.cos(a)*4.19,z=Math.sin(a)*4.19;b.box(x,.99,z,.22,.28,.12,mats.brass,-a+Math.PI/2);}
  b.roundSolid('fountain basin',0,0,4.61,.16,1.28);b.roundSolid('fountain pedestal',0,0,1.23,1.1,3.47);b.roundSolid('armillary sculpture',0,0,1.99,3.47,6.48);
  const group=b.finish(),instrument=new Builder('Turning armillary sphere',mats);
  instrument.ring(0,0,0,1.88,.064,mats.brass,[.63,.31,.42]);instrument.ring(0,0,0,1.86,.06,mats.brass,[1.66,.18,-.28]);instrument.ring(0,0,0,1.82,.055,mats.brass,[.22,1.13,.87]);
  instrument.add(new THREE.SphereGeometry(.32,16,12),mats.brass);
  for(let i=0;i<12;i++){const a=i*TAU/12;instrument.add(new THREE.OctahedronGeometry(.09),mats.brass,[Math.cos(a)*1.88,Math.sin(a)*1.88,0]);}
  for(let i=0;i<4;i++){const a=i*TAU/4+Math.PI/4;instrument.add(new THREE.OctahedronGeometry(.17),mats.trim,[Math.cos(a)*1.9,Math.sin(a)*1.9,0]);}
  const armillary=instrument.finish();armillary.position.y=4.46;armillary.userData.environmentAction='time';
  armillary.traverse(o=>{if(o.isMesh)o.userData.environmentAction='time';});group.add(armillary);group.userData.armillary=armillary;
  return group;
}

function centralGarden(m){
  const b=new Builder('Grand Academy fountain courtyard',m);paving(b,36,42);
  // Fountain sits at the established navigation court (world z=35).
  const disc=new THREE.RingGeometry(5.75,8.4,8);disc.rotateX(-Math.PI/2);b.add(disc,m.pavingDark,[0,.188,4]);disc.dispose();
  for(const r of[5.76,8.38])b.ring(0,.206,4,r,.027,m.brass);
  for(let i=0;i<8;i++){const a=i*TAU/8;b.box(Math.sin(a)*7.2,.212,4+Math.cos(a)*7.2,.12,.022,1.85,m.trim,a);}
  const beds=[[-11.8,-13.2,7.5,10.8,.58],[12.7,-12.7,6.6,11.5,.68],[13.3,13.5,6,8.8,.48]];
  beds.forEach(([x,z,w,d,h],i)=>{
    const y=planter(b,x,z,w,d,h);
    for(let j=0;j<4;j++)shrub(b,x+(j%2?1.3:-1.2),y,z-2.5+Math.floor(j/2)*4.4,1.3,'green',j);
    flowers(b,x,y,z+d/2-.85,w-1.1,0,i===2?'lilac':'pink');
    if(i<2)tree(b,x+(i?1:-.2),y,z-2.1,i?.98:1.10,i===0,i*.8);
  });
  pergola(b,-14.0,-1.4,5.3,8.5);
  bench(b,10.0,6.8,3.2,-Math.PI/2);bench(b,-5.6,17.6,3.6,0);
  // Main north/south flight axis and the west exit remain broad and unroofed.
  for(const x of[-4.1,4.1])b.box(x,.195,-12,.14,.028,16,m.trim);
  const group=b.finish(),pool=fountain(m);pool.position.z=4;group.add(pool);
  return {group,lamps:[[-16,-18],[16,-18],[-16,18],[16,18],[-9,11],[9,6],[-17,5.3],[17,-1]],fountain:pool};
}
function readingGarden(m){
  const b=new Builder('Library reading garden',m);paving(b,29,18);
  const y=planter(b,-10.6,1.8,4.4,10,.6);tree(b,-10.5,y,-.9,1.16,false,.4);
  for(const z of[-1,2.2,5.4])shrub(b,-10.7,y,z,1.3,'green');flowers(b,-10.6,y,5.7,3.1);
  const y2=planter(b,8.8,5.8,8.1,3.7,.42);for(const x of[6.3,9.1,11.5])shrub(b,x,y2,5.8,1.12,'green');flowers(b,9,y2,6.6,6.8,0,'lilac');
  readingDesk(b,1.5,2.4);bench(b,1.5,5.1,3.6);
  const shelf=new Builder('Publications reference shelf',m);libraryShelf(shelf,5,-5.9);
  shelf.box(5,2.91,-5.18,3.3,.32,.04,m.ink);sign(shelf,'PUBLICATIONS',.20,[5,2.835,-5.152]);
  bench(b,-6.4,1.4,3.8,-Math.PI/2);
  // A low arcade parapet encloses only the rear shelf, never the library gate.
  for(const x of[1.8,8.4]){b.box(x,.65,-6.5,.56,.9,.7,m.stone);b.cylinder(x,1.3,-6.5,.15,.5,m.brass,.06,10);}
  const group=b.finish();group.add(contentProp(shelf.finish(),{kind:'section',id:'publications'},{en:'Publications',zh:'论文'},[5,1.75,-5.2]));
  return {group,lamps:[[-12.6,-6.8],[12.5,6.8],[7.4,-6]]};
}
function workshopGarden(m){
  const b=new Builder('Atelier materials court',m);paving(b,40,23);
  const y=planter(b,-17.3,8.2,3.6,4.2,.48);shrub(b,-17.3,y,8.2,1.23,'green');flowers(b,-17.3,y,9.2,2.6);
  const y2=planter(b,16.8,-8.2,5,4.3,.5);for(const x of[15.5,18])shrub(b,x,y2,-8.2,1.1,'green');
  // Real tools and material samples occupy one compact working corner.
  const x=-15,z=-8.8;readingDesk(b,x,z);
  for(let i=0;i<3;i++){b.cylinder(x-.8+i*.57,2.5,z-.15,.17,.67,m.brass,.15,12);b.ring(x-.8+i*.57,2.6,z-.15,.175,.02,m.wood);}
  b.beam([x+.45,2.16,z+.44],[x+1.12,2.18,z-.16],.042,m.wood);b.box(x+1.12,2.18,z-.16,.38,.17,.25,m.brass,.6);
  // Exhibition owns x=[51,73], z=[51,65]; this factory provides only its floor.
  return {group:b.finish(),lamps:[[-18.5,-10],[18.5,-10],[-18.5,10.1],[18.5,10.1]]};
}
function journeyGarden(m){
  const b=new Builder('Wayfarer map landing',m);paving(b,24,18);
  const ring=new THREE.RingGeometry(2.1,3.5,48);ring.rotateX(-Math.PI/2);b.add(ring,m.pavingDark,[0,.19,2.1]);ring.dispose();
  for(let i=0;i<8;i++){const a=i*TAU/8;b.box(Math.sin(a)*2.8,.213,2.1+Math.cos(a)*2.8,.13,.025,i%2?.42:.82,m.brass,a);}
  const y=planter(b,8,0,4.2,12.7,.45);for(const z of[-4.8,-1.8,1.4,4.6])shrub(b,8,y,z,1.13,'green');tree(b,8,y,-4.6,.92,false);
  bench(b,-8.4,2.2,4.1,-Math.PI/2);
  b.cylinder(-7.7,.98,-4.7,.58,1.56,m.stone,.43,12);b.box(-7.7,1.87,-4.7,2.2,.2,1.5,m.brass);
  const chart=new Builder('Experience timeline board',m);chart.box(-7.7,2.035,-4.7,1.95,.1,1.24,m.ink);
  sign(chart,'EXPERIENCE',.17,[-7.7,2.094,-4.96],[-Math.PI/2,0,0]);
  chart.box(-7.7,2.094,-4.57,1.43,.015,.025,m.brass);
  for(const [i,year]of['2021','2025','2026'].entries()){
    const x=-8.34+i*.64;chart.cylinder(x,2.114,-4.57,.055,.016,m.brass,.055,10);sign(chart,year,.13,[x,2.11,-4.29],[-Math.PI/2,0,0]);
  }
  b.roundSolid('wayfarer chart stand',-7.7,-4.7,1.2,.18,2.25);
  const group=b.finish();group.add(contentProp(chart.finish(),{kind:'section',id:'journey'},{en:'Experience',zh:'经历'},[-7.7,2.16,-4.7]));
  return {group,lamps:[[-10.2,-6.8],[10.2,6.8]]};
}
function postGarden(m){
  const b=new Builder('Owl post correspondence landing',m);paving(b,23,17);
  const y=planter(b,8.7,0,3.4,11.4,.5);tree(b,8.6,y,-2.7,.94,false);for(const z of[0,2.9,4])shrub(b,8.7,y,z,1,'green');flowers(b,8.7,y,4.4,2.3);
  readingDesk(b,4.4,3.1,0,false);b.box(5.3,2.13,3.03,.73,.09,.56,m.paper,.2);b.box(5.3,2.19,3.03,.14,.028,.14,m.redBook,.2);
  const folder=new Builder('CV correspondence folder',m);folder.box(3.88,2.13,3.16,1.08,.085,1.1,m.ink);folder.box(3.88,2.185,3.16,.99,.04,1.03,m.paper);folder.box(3.88,2.225,3.16,1.08,.035,1.1,m.ink);
  folder.box(4.24,2.24,2.69,.31,.04,.18,m.brass);sign(folder,'CV',.39,[3.88,2.251,3.3],[-Math.PI/2,0,0]);
  for(const x of[-7.9,-5.5]){
    b.box(x,.99,5,.12,1.6,.12,m.brass);b.box(x,2.0,5,1.8,.25,.5,m.wood);b.boxSolid('owl roost',x,5,1.8,.5,.2,2.15);
  }
  bench(b,-7.2,1.6,3.6,Math.PI/2);
  const group=b.finish();group.add(contentProp(folder.finish(),{kind:'cv'},{en:'CV',zh:'简历'},[3.88,2.31,3.16]));
  return {group,lamps:[[-9.4,6.7],[9.5,-6.7],[3.1,6.7]]};
}
function astralGarden(m){
  const b=new Builder('Observatory instrument terrace',m);paving(b,22,14);
  for(const x of[-8.9,8.9]){const y=planter(b,x,1.3,2.1,8.3,.4);for(const z of[-1.7,1.5,4.3])shrub(b,x,y,z,.74,'green');}
  const instrument=new Builder('Research instrument',m);
  instrument.cylinder(-5,1.17,3.5,.58,1.88,m.stone,.42,12);instrument.cylinder(-5,2.22,3.5,1.15,.16,m.brass,1.1,32);
  instrument.beam([-5,2.33,3.1],[-5,3.08,3.76],.04,m.brass);instrument.ring(-5,2.32,3.5,.85,.024,m.pavingDark);
  instrument.box(-5,2.72,4.18,1.85,.45,.055,m.ink);sign(instrument,'RESEARCH',.22,[-5,2.642,4.215]);
  b.roundSolid('astral sundial',-5,3.5,1.17,.18,3.15);bench(b,5.8,3,3.3,-Math.PI/2);
  const group=b.finish();group.add(contentProp(instrument.finish(),{kind:'section',id:'research'},{en:'Research',zh:'研究方向'},[-5,2.73,3.95]));
  return {group,lamps:[[-9,-5.6],[9,5.6]]};
}

const factories={courtyard:centralGarden,reading:readingGarden,atelier:workshopGarden,journey:journeyGarden,post:postGarden,astral:astralGarden};
export function createGardenSpecimen(id='courtyard'){
  const factory=factories[id];if(!factory)throw new Error(`Unknown garden specimen: ${id}`);
  return factory(palette()).group;
}

function worldColliders(group){
  const list=[];group.updateMatrixWorld(true);
  group.traverse(object=>{
    const matrix=object.matrixWorld,normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
    for(const [index,solid]of(object.userData.colliders||[]).entries()){
      const planes=solid.planes.map(([x,y,z,d])=>{const normal=new THREE.Vector3(x,y,z),point=normal.clone().multiplyScalar(d).applyMatrix4(matrix);normal.applyMatrix3(normalMatrix).normalize();return [...normal.toArray(),normal.dot(point)];});
      const base=new THREE.Vector3(0,solid.bottom,0).applyMatrix4(matrix),top=new THREE.Vector3(0,solid.top,0).applyMatrix4(matrix);
      list.push({id:`garden/${object.name}/${index}`,buildingId:'garden',planes,bottom:base.y,top:top.y});
    }
  });return list;
}

function gardenEdges(m,heightAt,nearPath){
  const b=new Builder('Planted transitions around academy courts',m);
  const moss=surface('forest-ground',{color:'#89977c',vertexColors:true,roughness:1,roughnessFloor:.92,albedoStrength:.58,normalScale:new THREE.Vector2(.48,.48)});moss.name='Garden edge ground cover';
  const rock=surface('mossy-rock',{color:'#9ba99d',roughness:1,roughnessFloor:.80,albedoStrength:.90});rock.name='Garden eroded mossy fieldstone';
  const stones=Array.from({length:3},(_,seed)=>{
    const raw=new THREE.IcosahedronGeometry(1,12);raw.deleteAttribute('normal');raw.deleteAttribute('uv');const geometry=mergeVertices(raw,1e-5);raw.dispose();
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),grain=fbm(x*3.2+seed*4+7,z*3.2+y*.8),form=.78+grain*.40;
      const hollow=Math.exp(-((x+.32-seed*.13)**2*9+(z-.27)**2*7))*.14*Math.max(0,y);
      p.setXYZ(i,Math.min(.83,x*form+z*.07),Math.min(.64-x*.13,y*form*.84)-hollow,Math.max(-.82,z*form+x*.09));
    }
    geometry.computeVertexNormals();return geometry;
  });
  const free=(x,z)=>heightAt(x,z)>.2&&!insideAuthoredGarden(x,z,.12)&&!nearPath(x,z)&&!(x>51&&x<73&&z>50&&z<82);
  const placeable=(x,z,radius)=>free(x,z)&&Array.from({length:8},(_,i)=>i*TAU/8).every(a=>free(x+Math.cos(a)*radius,z+Math.sin(a)*radius));
  // Unequal ribbons touch three garden bases; their gaps retain the approaches.
  const groups=[
    {x:-20.0,z:18,rx:1.65,rz:6.5,count:8}, {x:20.0,z:20,rx:1.8,rz:9.2,count:11},
    {x:20.5,z:47,rx:2.1,rz:6.0,count:9}, {x:-20.6,z:48,rx:2.4,rz:4.6,count:7},
    {x:-66.5,z:38.1,rx:10.2,rz:1.7,count:12}, {x:79.4,z:69.2,rx:4.2,rz:1.6,count:7},
  ];
  const placements=[];let shrubCount=0,rockCount=0;
  for(const [index,g]of groups.entries()){
    const verts=[],colors=[],indices=[],segments=48,bands=6;
    for(let band=0;band<bands;band++)for(let i=0;i<=segments;i++){
      const a=i/segments*TAU,r=(.01+band/(bands-1)*.99)*(1+Math.sin(a*3+index)*.13+Math.cos(a*5-index)*.075),x=g.x+Math.cos(a)*g.rx*r,z=g.z+Math.sin(a)*g.rz*r;
      verts.push(x,heightAt(x,z)+.022,z);const c=new THREE.Color().setScalar(.87+band/(bands-1)*.13);colors.push(c.r,c.g,c.b);
      if(band<bands-1&&i<segments){const q=band*(segments+1)+i;indices.push(q,q+1,q+segments+1,q+1,q+segments+2,q+segments+1);}
    }
    const kept=[];
    for(let i=0;i<indices.length;i+=3){const face=indices.slice(i,i+3),samples=face.map(v=>[verts[v*3],verts[v*3+2]]);samples.push([samples.reduce((s,p)=>s+p[0],0)/3,samples.reduce((s,p)=>s+p[1],0)/3]);if(samples.every(([x,z])=>free(x,z)))kept.push(...face);}
    if(kept.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(kept);geometry.computeVertexNormals();b.add(geometry,moss);geometry.dispose();}
    const vertical=g.rz>g.rx;
    for(let i=0;i<g.count;i++){
      const along=-.84+i/(g.count-1)*1.68,across=Math.sin(i*2.39+index)*.23,x=g.x+(vertical?across:along)*g.rx,z=g.z+(vertical?along:across)*g.rz,size=.65+(i%4)*.13;
      if(!placeable(x,z,size*1.35))continue;
      const y=heightAt(x,z);shrub(b,x,y-.035,z,size,'green',i+index);shrubCount++;placements.push({kind:'shrub',x,y:y-.035,z,radius:size*1.35});
      if(i%4===1){const fx=x+(vertical?.35:0),fz=z+(vertical?0:.32);if(placeable(fx,fz,1.3)){flowers(b,fx,heightAt(fx,fz)+.01,fz,size*1.2,vertical?Math.PI/2:0,index%3?'pink':'lilac');placements.push({kind:'flowers',x:fx,y:heightAt(fx,fz)+.01,z:fz,radius:1.3});}}
    }
    for(const side of[-1,1]){
      const x=g.x+side*g.rx*.24,z=g.z-side*g.rz*.36;
      for(let small=0;small<2;small++){
        const px=x+small*.71,pz=z+small*.43,radius=small?.74:1.25;if(!placeable(px,pz,radius))continue;
        const y=heightAt(px,pz)+.035,scale=small?[.58,.54,.50]:[.95,.85,.82],rotation=[.06,index*.8+small*.5,.05];b.add(stones[(index+small)%3],rock,[px,y,pz],scale,rotation);rockCount++;placements.push({kind:'rock',x:px,y,z:pz,radius,scale,rotation});
      }
    }
  }
  stones.forEach(g=>g.dispose());const group=b.finish();Object.assign(group.userData,{transitionGroups:groups.length,shrubCount,rockCount,edgePlacements:placements});return group;
}

export function createAuthoredGardens(root,heightAt=null,nearPath=()=>false){
  const materials=palette(),group=new THREE.Group();group.name='Authored academy gardens';root.add(group);
  const lampSites=[],fountains=[],districts=[];
  for(const district of gardenDistricts){
    const built=factories[district.id](materials);built.group.position.set(district.x,district.y,district.z);group.add(built.group);districts.push(built.group);
    for(const[x,z]of built.lamps)lampSites.push([district.x+x,district.y+.18,district.z+z]);
    if(built.fountain)fountains.push(built.fountain);
  }
  if(heightAt)group.add(gardenEdges(materials,heightAt,nearPath));
  // Repeated threshold details tie the separate islands to the same stonework.
  for(const [name,ends]of Object.entries(bridges)){
    const rotation=Math.atan2(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]);
    for(const [i,[x,z]]of ends.entries()){
      const b=new Builder(`${name} bridge shore threshold ${i}`,materials);paving(b,8.8,7.3);
      b.boxSolid('bridge threshold deck',0,0,8.8,7.3,-.32,.19);
      for(const side of[-1,1]){
        b.box(side*3.94,.72,0,.55,1.08,6.8,materials.stone);b.box(side*3.94,1.33,0,.75,.18,6.9,materials.trim);
        b.boxSolid('bridge threshold parapet',side*3.94,0,.75,6.9,.16,1.45);
        for(const along of[-1,1])b.box(side*3.94,.9,along*3.0,.83,1.36,.83,materials.trim);
      }
      const threshold=b.finish();threshold.position.set(x,7,z);threshold.rotation.y=rotation;group.add(threshold);
      const offset=new THREE.Vector3(3.9,.2,i?2.8:-2.8).applyAxisAngle(new THREE.Vector3(0,1,0),rotation);lampSites.push([x+offset.x,7+offset.y,z+offset.z]);
    }
  }
  const lamp=createGardenLamp(),placement=new THREE.Matrix4();
  for(const part of lamp.children){
    const instances=new THREE.InstancedMesh(part.geometry,part.material,lampSites.length);instances.name='Authored garden lanterns';
    lampSites.forEach((p,i)=>{placement.makeTranslation(...p);instances.setMatrixAt(i,placement);});instances.castShadow=false;instances.receiveShadow=true;instances.computeBoundingSphere();group.add(instances);
  }
  const lights=[];
  for(const[x,y,z]of [[-9,6.2,42],[9,6.2,37],[-82,7.2,20],[-58,7.2,21],[87,8.2,-44.5]]){
    const light=new THREE.PointLight('#ffd59a',4.2,8,2);light.position.set(x,y+2.55,z);group.add(light);lights.push({light,baseIntensity:light.intensity});
  }
  const emissiveMaterials=[],nightMaterials=[],seen=new Set();
  group.traverse(o=>{
    for(const m of(o.material?Array.isArray(o.material)?o.material:[o.material]:[])){
      if(seen.has(m))continue;seen.add(m);
      if(m.emissiveIntensity>0&&m.emissive?.getHex()>0)emissiveMaterials.push({material:m,baseIntensity:m.emissiveIntensity});
      if(m.uniforms?.nightFactor)nightMaterials.push({material:m,uniform:'nightFactor',baseValue:1});
    }
  });
  const clockTargets=fountains.flatMap(f=>f.userData.armillary.children);
  const contentTargets=[],contentAnchors=[];group.updateMatrixWorld(true);
  group.traverse(o=>{
    if(o.isMesh&&o.userData.portfolioAction)contentTargets.push(o);
    const anchor=o.userData.portfolioAnchor;
    if(anchor)contentAnchors.push({position:new THREE.Vector3(...anchor.position).applyMatrix4(o.matrixWorld),action:anchor.action,label:anchor.label});
  });
  return {group,districts,lampSites,clockTargets,contentTargets,contentAnchors,clockPosition:new THREE.Vector3(0,10.46,35),colliders:worldColliders(group),lighting:{lights,emissiveMaterials,nightMaterials},
    update(time,reducedMotion){materials.wind.value=reducedMotion?0:time;for(const fountain of fountains)fountain.userData.armillary.rotation.y=reducedMotion?0:time*.075;},
  };
}
