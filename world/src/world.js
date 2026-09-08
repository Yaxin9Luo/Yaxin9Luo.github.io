import * as THREE from 'three';
import {createSurfaceSupport} from './surface-support.js';
import {createPortal} from './effects.js';
import {createAtmosphere} from './atmosphere.js';
import {locations,ringPositions,crystalPositions,wispPositions,islands,bridges,court,exhibitSites} from './locations.js';
import {noise as coherentNoise,fbm,surface,planarUV,groundMaterial,createLake,createVegetation,createBackdrop} from './landscape.js';
import {createCastle,createObservatory,createLibrary,createWorkshop,createOwlery,createRuins} from './models.js';
import {createWisp} from './characters.js';
import {createViaduct,createGardenLamp,createResearchBook,createLampGroundGlow} from './site-details.js';
import {gradeGardenTerrain,insideAuthoredGarden} from './environment-layout.js';
import {createAuthoredGardens} from './gardens.js';
import {createEnvironmentComposition} from './environment-composition.js';
import {environmentWind} from './environment-wind.js';
import {createBlossomGroves} from './blossom-groves.js';

let seed=131;
function random(){seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;}
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.87,...extra});
const TERRAIN_STEP=.5;
function edgeShape(a){return .94+.10*Math.sin(a*3+.7)+.055*Math.cos(a*7)+.045*coherentNoise(Math.sin(a)*8,Math.cos(a)*8);}
const channels=Object.values(bridges).map(([a,b])=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return{x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length,width:length/2-4.8};});
function channelField(x,z){return Math.min(...channels.map(c=>{const cross=(x-c.x)*c.dz-(z-c.z)*c.dx,along=(x-c.x)*c.dx+(z-c.z)*c.dz-Math.sin(cross*.07)*3-Math.sin(cross*.19)*.7;return Math.max(Math.abs(along)/(c.width*(1+Math.sin(cross*.1)*.15))-1,Math.abs(cross)/100-1);}));}
function shoreField(x,z){return Math.min(channelField(x,z),Math.max(...islands.map(i=>{const u=(x-i.x)/i.rx,v=(z-i.z)/i.rz;return 1-Math.hypot(u,v)/edgeShape(Math.atan2(v,u));})));}
export function terrainHeight(x,z){
  if(channelField(x,z)<0)return -22;
  let h=-22;
  for(const i of islands){
    const u=(x-i.x)/i.rx,v=(z-i.z)/i.rz,a=Math.atan2(v,u),r=Math.hypot(u,v)/edgeShape(a);
    if(r<1) h=Math.max(h,i.y+(fbm(x*.065+5,z*.065)-.48)*7-Math.max(0,r-.83)*14);
  }
  for(const l of locations){const d=Math.hypot(x-l.x,z-l.z);if(d<l.radius+8)h=THREE.MathUtils.lerp(l.y,h,THREE.MathUtils.smoothstep(d,l.radius,l.radius+8));}
  h=gradeGardenTerrain(x,z,h);
  // Grade each gate's approach with a soft shoulder instead of suspending its
  // stone plinth over the unmodified hillside.
  for(const l of locations){const d=Math.max(Math.abs(x-l.x)/4.6,Math.abs(z-l.z-l.radius-3)/3);if(d<3)h=THREE.MathUtils.lerp(l.y,h,THREE.MathUtils.smoothstep(d,1,3));}
  for(const ends of Object.values(bridges))for(const [bx,bz] of ends){const d=Math.hypot(x-bx,z-bz);if(d<7)h=THREE.MathUtils.lerp(7,h,THREE.MathUtils.smoothstep(d,4.3,7));}
  const courtDistance=Math.hypot(x*.88,z-court.z);if(courtDistance<18)h=THREE.MathUtils.lerp(court.y,h,THREE.MathUtils.smoothstep(courtDistance,9,18));
  for(const e of exhibitSites){const d=Math.hypot(x-e.x,z-e.z);if(d<5)h=THREE.MathUtils.lerp(e.y,h,THREE.MathUtils.smoothstep(d,2.7,5));}
  return h;
}

// Interpolate the actual grid triangles, rather than the continuous noise
// surface between them. Roads then meet the rendered terrain at every sample.
export function renderedTerrainHeight(x,z){
  const x0=Math.floor(x/TERRAIN_STEP)*TERRAIN_STEP,z0=Math.floor(z/TERRAIN_STEP)*TERRAIN_STEP;
  const u=(x-x0)/TERRAIN_STEP,v=(z-z0)/TERRAIN_STEP;
  const b=terrainHeight(x0,z0+TERRAIN_STEP),c=terrainHeight(x0+TERRAIN_STEP,z0);
  if(u+v<=1){const a=terrainHeight(x0,z0);return a+(c-a)*u+(b-a)*v;}
  const d=terrainHeight(x0+TERRAIN_STEP,z0+TERRAIN_STEP);return d+(b-d)*(1-u)+(c-d)*(1-v);
}

// Pick one projection for the whole face. Only UV-axis seams split vertices;
// copied smooth normals and triangle order retain the original cliff shell.
export function cliffPlanarUV(geometry,scale=.22){
  const p=geometry.attributes.position,index=geometry.index,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const cache=new Int32Array(p.count*3).fill(-1),indices=[],uv=[],attributes=Object.entries(geometry.attributes).filter(([name])=>name!=='uv'),values=Object.fromEntries(attributes.map(([name])=>[name,[]]));
  for(let i=0;i<index.count;i+=3){
    a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));const normal=b.sub(a).cross(c.sub(a));
    const x=Math.abs(normal.x),y=Math.abs(normal.y),z=Math.abs(normal.z),axis=y>=x&&y>=z?1:x>z?0:2;
    for(let corner=0;corner<3;corner++){
      const old=index.getX(i+corner),key=old*3+axis;let vertex=cache[key];
      if(vertex===-1){
        vertex=uv.length/2;cache[key]=vertex;
        for(const [name,attribute]of attributes)for(let component=0;component<attribute.itemSize;component++)values[name].push(attribute.array[old*attribute.itemSize+component]);
        uv.push((axis===0?p.getZ(old):p.getX(old))*scale,(axis===1?p.getZ(old):p.getY(old))*scale);
      }
      indices.push(vertex);
    }
  }
  const result=new THREE.BufferGeometry();
  for(const [name,attribute]of attributes)result.setAttribute(name,new THREE.BufferAttribute(new attribute.array.constructor(values[name]),attribute.itemSize,attribute.normalized));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.setIndex(indices);return result;
}

// Clip one shared grid to the union of the islands. Boundary vertices are reused
// by the cliff shells, so neither overlapping ground nor open shoreline seams remain.
export function islandGeometry(){
  const step=TERRAIN_STEP,positions=[],colors=[],indices=[],shore=[],vertices=new Map(),cuts=new Map();
  const minX=Math.floor(Math.min(...islands.map(i=>i.x-i.rx*1.08))/step)*step;
  const maxX=Math.ceil(Math.max(...islands.map(i=>i.x+i.rx*1.08))/step)*step;
  const minZ=Math.floor(Math.min(...islands.map(i=>i.z-i.rz*1.08))/step)*step;
  const maxZ=Math.ceil(Math.max(...islands.map(i=>i.z+i.rz*1.08))/step)*step;
  const cols=Math.round((maxX-minX)/step),rows=Math.round((maxZ-minZ)/step),samples=[];
  const grassColor=new THREE.Color(),darkGrass=new THREE.Color('#a1b29b'),rimColor=new THREE.Color('#929b89');
  const noise=(x,z)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const x=minX+col*step,z=minZ+row*step;
    samples.push({x,z,key:row*(cols+1)+col,field:shoreField(x,z)});
  }
  function crossing(a,b){
    const key=a.key<b.key?`${a.key}:${b.key}`:`${b.key}:${a.key}`;
    if(cuts.has(key))return cuts.get(key);
    let inside=a.field>=0?a:b,outside=a.field>=0?b:a;
    for(let i=0;i<25;i++){
      const x=(inside.x+outside.x)/2,z=(inside.z+outside.z)/2,field=shoreField(x,z);
      if(field>=0)inside={x,z,field};else outside={x,z,field};
    }
    // Keep the land-side endpoint: terrainHeight has a deliberate ocean step.
    const point={...inside,key,shore:true};cuts.set(key,point);return point;
  }
  function vertex(point){
    if(vertices.has(point.key))return vertices.get(point.key);
    const index=positions.length/3,h=terrainHeight(point.x,point.z);
    positions.push(point.x,h,point.z);
    grassColor.set('#c6d0b6').lerp(darkGrass,.4+.24*Math.sin(point.x*.051)*Math.sin(point.z*.061)+noise(point.x,point.z)*.035);
    if(point.field<.04)grassColor.lerp(rimColor,.7*(1-point.field/.04));
    colors.push(grassColor.r,grassColor.g,grassColor.b);vertices.set(point.key,index);
    return index;
  }
  function triangle(points){
    const polygon=[];
    for(let i=0;i<3;i++){
      const current=points[i],previous=points[(i+2)%3];
      if((current.field>=0)!==(previous.field>=0))polygon.push(crossing(previous,current));
      if(current.field>=0)polygon.push(current);
    }
    if(polygon.length<3)return;
    const first=vertex(polygon[0]);
    for(let i=1;i<polygon.length-1;i++)indices.push(first,vertex(polygon[i]),vertex(polygon[i+1]));
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      if(a.shore&&b.shore)shore.push([a,b]);
    }
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const at=row*(cols+1)+col,a=samples[at],b=samples[at+cols+1],c=samples[at+1],d=samples[at+cols+2];
    triangle([a,b,c]);triangle([c,b,d]);
  }
  const ground=new THREE.BufferGeometry();
  ground.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  ground.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  ground.setIndex(indices);ground.computeVertexNormals();

  const cliffPositions=[],cliffColors=[],cliffIndices=[],cliffColor=new THREE.Color(),cliffVertices=new Map();
  function cliffVertex(point,band){
    const key=`${point.key}/${band}`;
    if(cliffVertices.has(key))return cliffVertices.get(key);
    const dx=shoreField(point.x+.1,point.z)-shoreField(point.x-.1,point.z);
    const dz=shoreField(point.x,point.z+.1)-shoreField(point.x,point.z-.1);
    const strata=[0,.065,.15,.29,.40,.56,.70,.84,1],ledges=[0,-.7,-1.5,-1.4,-.45,-.3,.65,1.35,2.6];
    const level=band/4,low=Math.min(7,Math.floor(level)),fraction=level-low;
    const length=Math.hypot(dx,dz)||1,t=THREE.MathUtils.lerp(strata[low],strata[low+1],fraction);
    const shelf=coherentNoise(point.x*.035+9,point.z*.035)*1.8,ledge=THREE.MathUtils.lerp(ledges[low],ledges[low+1],fraction);
    const fault=(coherentNoise(point.x*.19+level*.71,point.z*.19-level*.44)-.5)*Math.sin(t*Math.PI);
    const inset=ledge*(.7+shelf)+fault*2.8;
    const verticalFault=(coherentNoise(point.x*.11+level*1.3,point.z*.13+level*.83)-.5)*3.2*Math.sin(t*Math.PI);
    const p=[point.x+dx/length*inset,THREE.MathUtils.lerp(terrainHeight(point.x,point.z),-24,t)+verticalFault,point.z+dz/length*inset];
    const index=cliffPositions.length/3;cliffPositions.push(...p);
    cliffColor.setHSL(.54,.08,.43+coherentNoise(point.x*.12,point.z*.12+level*.8)*.055);
    cliffColors.push(cliffColor.r,cliffColor.g,cliffColor.b);
    cliffVertices.set(key,index);return index;
  }
  for(const [a,b] of shore)for(let band=0;band<32;band++){
    const topA=cliffVertex(a,band),topB=cliffVertex(b,band),lowA=cliffVertex(a,band+1),lowB=cliffVertex(b,band+1);
    cliffIndices.push(topA,lowA,topB,topB,lowA,lowB);
  }
  const cliffGeometry=new THREE.BufferGeometry();
  cliffGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cliffPositions,3));
  cliffGeometry.setAttribute('color',new THREE.Float32BufferAttribute(cliffColors,3));cliffGeometry.setIndex(cliffIndices);cliffGeometry.computeVertexNormals();
  const cliffs=cliffPlanarUV(cliffGeometry,.22);cliffGeometry.dispose();
  planarUV(ground,.067);return {ground,cliffs,shore};
}

export function createTerrainSpecimen(){
  const group=new THREE.Group(),terrain=islandGeometry();group.name='Cliff terrain';
  const ground=new THREE.Mesh(terrain.ground,groundMaterial());const cliffs=new THREE.Mesh(terrain.cliffs,surface('mossy-rock',{vertexColors:true,color:'#b8b6ab'}));
  ground.receiveShadow=true;cliffs.receiveShadow=true;group.add(ground,cliffs);return group;
}

function* assembleWorld(scene, navigation=null){
  seed=131;
  const root=navigation?.root||new THREE.Group();if(!navigation)scene.add(root);
  const stone=surface('castle-masonry',{color:'#bcc6bd'}),brass=mat('#b59455',{metalness:.65,roughness:.4});
  const animated=navigation?.animated||[],portals=navigation?.portals||[],ringMeshes=[],crystals=[],wisps=[];
  const mesh=(geo,material,parent=root)=>{const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(x,y,z,w,h,d,material,parent=root)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),material,parent);m.position.set(x,y,z);return m;};
  const glowMat=new THREE.MeshBasicMaterial({color:'#ffd997',toneMapped:false});
  const terrain=navigation?.terrain||islandGeometry();
  const ground=navigation?.ground||mesh(terrain.ground,groundMaterial());ground.name='island-ground';
  const cliffs=navigation?.cliffs||mesh(terrain.cliffs,surface('mossy-rock',{vertexColors:true,color:'#b8b6ab'}));cliffs.name='shoreline-cliffs';
  const occluders=navigation?.occluders||[ground,cliffs];
  for(let i=0;i<islands.length*(23*97+96*3*6);i++)random();
  const lake=navigation?.lake||createLake(root,scene);
  const makers=[createCastle,createLibrary,createWorkshop,createObservatory,createRuins,createOwlery];
  const order=[...locations].sort((a,b)=>(navigation?.priority(a.id)??0)-(navigation?.priority(b.id)??0));
  for(const l of order){const i=locations.indexOf(l),m=makers[i]();m.position.set(l.x,l.y,l.z);root.add(m);occluders.push(m);
    // Portals sit at the approach to each building and also serve as map destinations.
    const portal=navigation?.portals.find(item=>item.id===l.id)?.group||createPortal(l.color);portal.position.set(l.x,l.y+3.1,l.z+l.radius+3);root.add(portal);
    box(0,-3.05,0,7,.3,3,stone,portal);
    // Weathered gate piers frame the spell, so its light has a physical setting.
    for(const sign of [-1,1]){box(sign*3.65,-1.1,0,.65,4.2,.9,stone,portal);box(sign*3.65,1.15,0,.85,.3,1.1,stone,portal);}
    if(!navigation){animated.push({type:'portal',group:portal});portals.push({id:l.id,group:portal});}
    yield {region:l.id,group:m};
  }

  const paths=[],roadSupport=createSurfaceSupport(renderedTerrainHeight),groundHeight=roadSupport.heightAt;
  if(navigation)navigation.heightAt=groundHeight;
  for(const l of locations){
    const gate=new THREE.Vector3(l.x,0,l.z+l.radius+3),ends=bridges[l.id];
    const p=ends?new THREE.Vector3(ends[0][0],0,ends[0][1]):gate;
    const middle=l.id==='about'?new THREE.Vector3(0,0,17):l.id==='research'?new THREE.Vector3(-24,0,38):new THREE.Vector3(p.x*.45+10,0,court.z+p.z*.12);
    const curves=[new THREE.CatmullRomCurve3([new THREE.Vector3(1,0,court.z),middle,p])];
    if(ends)curves.push(new THREE.LineCurve3(new THREE.Vector3(ends[1][0],0,ends[1][1]),gate));
    for(const curve of curves){
    const points=curve.getPoints(Math.ceil(curve.getLength()/.18));paths.push(points);
    const pos=[],idx=[];
    const width=l.id==='about'?3.2:2,across=Math.ceil(width*2/.22),stride=across+1;
    points.forEach((v,k)=>{const next=points[Math.min(k+1,points.length-1)],prev=points[Math.max(k-1,0)];const dir=new THREE.Vector3().subVectors(next,prev).normalize();
      for(let side=0;side<=across;side++){const offset=(side/across*2-1)*width,x=v.x+dir.z*offset,z=v.z-dir.x*offset;pos.push(x,renderedTerrainHeight(x,z)+.075,z);}
      if(k<points.length-1)for(let side=0;side<across;side++){const j=k*stride+side;idx.push(j,j+stride,j+1,j+1,j+stride,j+stride+1);}
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();roadSupport.addGeometry(g);planarUV(g,.5);mesh(g,surface('courtyard-paving',{color:'#e3d5bd',albedoStrength:1,roughness:.91,roughnessFloor:.60,side:THREE.DoubleSide,normalScale:new THREE.Vector2(.45,.45)})).name=`road-${l.id}`;
    // A low, irregular soil shoulder joins paving to meadow. Every visible
    // triangle uses the rendered terrain sampler and joins the support index.
    for(const sign of[-1,1]){
      const shoulder=[],faces=[];
      points.forEach((v,k)=>{
        const prev=points[Math.max(0,k-1)],next=points[Math.min(points.length-1,k+1)],dir=new THREE.Vector3().subVectors(next,prev).normalize(),fray=.35+.07*Math.sin(k*.31+l.x)+.03*Math.cos(k*.79);
        for(let edge=0;edge<2;edge++){const offset=sign*(width+(edge?fray:0)),x=v.x+dir.z*offset,z=v.z-dir.x*offset;shoulder.push(x,renderedTerrainHeight(x,z)+(edge?.012:.074),z);}
        if(k<points.length-1){const q=k*2;if(sign>0)faces.push(q,q+2,q+1,q+1,q+2,q+3);else faces.push(q,q+1,q+2,q+1,q+3,q+2);}
      });
      const edge=new THREE.BufferGeometry();edge.setAttribute('position',new THREE.Float32BufferAttribute(shoulder,3));edge.setIndex(faces);edge.computeVertexNormals();roadSupport.addGeometry(edge);planarUV(edge,.5);
      mesh(edge,surface('forest-ground',{color:'#877b60',albedoStrength:1,roughness:1,normalScale:new THREE.Vector2(.45,.45)})).name=`road-${l.id}-planted-shoulder-${sign}`;
    }
    yield {region:`road-${l.id}`};
    }
  }
  const nearPath=(x,z)=>paths.some(p=>p.some((v,i)=>i%3===0&&Math.hypot(v.x-x,v.z-z)<3.7));
  function bridge(ax,az,bx,bz){
    const group=createViaduct(Math.hypot(bx-ax,bz-az));group.position.set((ax+bx)/2,6.82,(az+bz)/2);group.rotation.y=Math.atan2(bx-ax,bz-az);root.add(group);occluders.push(group);
  }
  for(const [[ax,az],[bx,bz]] of Object.values(bridges)){bridge(ax,az,bx,bz);yield {region:"bridge"};}
  const gardenTrees=yield {prepare:"gardens"};
  const gardens=createAuthoredGardens(root,renderedTerrainHeight,nearPath,{trees:gardenTrees!==false});occluders.push(gardens.group);
  if(navigation){navigation.gardens=gardens;navigation.clockTargets=gardens.clockTargets;navigation.environmentColliders.push(...gardens.colliders);mergeEnvironmentLighting(navigation.environmentLighting,gardens.lighting);}
  yield {region:"gardens"};
  const composition=createEnvironmentComposition(root,renderedTerrainHeight,nearPath,{shoreline:terrain.shore,shoreField});occluders.push(composition.group);
  yield {region:"shore-details"};

  // Hand-worked lamps along the paths. Instance each material across the grounds.
  const lamp=createGardenLamp(),lampSites=[];
  for(const path of paths)for(let n=30;n<path.length-4;n+=132){const p=path[n],next=path[n+1],direction=new THREE.Vector3().subVectors(next,p).normalize();for(const side of[-1,1]){const x=p.x+direction.z*4.7*side,z=p.z-direction.x*4.7*side;if(!insideAuthoredGarden(x,z,3)&&!lampSites.some(s=>Math.hypot(s[0]-x,s[2]-z)<8))lampSites.push([x,renderedTerrainHeight(x,z),z]);}}
  const matrix=new THREE.Matrix4();
  lamp.children.forEach(part=>{const instances=new THREE.InstancedMesh(part.geometry,part.material,lampSites.length);lampSites.forEach((p,i)=>{matrix.makeTranslation(...p);instances.setMatrixAt(i,matrix);});instances.castShadow=false;instances.receiveShadow=true;root.add(instances);});
  const groundGlow=createLampGroundGlow([...lampSites,...gardens.lampSites.map(p=>[...p,4.2])],renderedTerrainHeight);root.add(groundGlow);
  const exhibits=exhibitSites.map(({id,x,z,color})=>{const group=createResearchBook(id,color);group.position.set(x,terrainHeight(x,z),z);group.rotation.y=-.24;root.add(group);return {id,group};});

  yield {region:"wayfinding"};
  const landscapeTrees=yield {prepare:"vegetation"};
  const vegetation=createVegetation(root,renderedTerrainHeight,nearPath,{lod:true,trees:landscapeTrees!==false});
  yield {region:"vegetation"};
  const blossomTrees=yield {prepare:"blossom-walks"};
  const blossomGroves=createBlossomGroves(root,groundHeight,{nearPath,trees:blossomTrees!==false});occluders.push(blossomGroves.group);
  if(navigation){navigation.heightAt=blossomGroves.heightAt;navigation.environmentColliders.push(...blossomGroves.colliders);mergeEnvironmentLighting(navigation.environmentLighting,blossomGroves.lighting);}
  else gardens.colliders.push(...blossomGroves.colliders);
  yield {region:"blossom-walks"};
  root.userData.vegetation=vegetation;
  createBackdrop(root,scene);
  yield {region:"highlands"};
  const atmosphere=navigation?.atmosphere||createAtmosphere(scene,{heightAt:terrainHeight});

  ringPositions.forEach((p,i)=>{const group=new THREE.Group();group.position.fromArray(p);const next=ringPositions[(i+1)%ringPositions.length];group.lookAt(new THREE.Vector3(...next));root.add(group);
    const material=new THREE.MeshBasicMaterial({color:i===0?'#ffe3a6':'#d9b676',transparent:true,opacity:i===0?1:.4,toneMapped:false});
    group.visible=false;
    const m=mesh(new THREE.TorusGeometry(3,.052,6,72),material,group);const outer=mesh(new THREE.TorusGeometry(3.25,.025,4,72),material,group);
    ringMeshes.push({group,material,mesh:m,outer});
  });
  crystalPositions.forEach((p,i)=>{const group=new THREE.Group();group.position.fromArray(p);root.add(group);
    const m=mesh(new THREE.OctahedronGeometry(.65,0),new THREE.MeshStandardMaterial({color:'#b0edef',emissive:'#72cad4',emissiveIntensity:.38,metalness:.3,roughness:.2}),group);m.scale.y=1.65;
    const band=mesh(new THREE.TorusGeometry(1.2,.028,4,32),brass,group);band.rotation.x=Math.PI/2;crystals.push({id:i,group,baseY:p[1]});
  });
  if(!navigation)wispPositions.forEach((p,i)=>{const group=createWisp();group.position.fromArray(p);root.add(group);wisps.push({id:i,group,home:new THREE.Vector3(...p),hp:3,respawn:0,attack:2+i*.4});});
  const lanternGeo=new THREE.SphereGeometry(.08,6,4),lanterns=[];
  for(let i=0;i<16;i++){const p={x:(random()-.5)*125,y:10+random()*18,z:(random()-.5)*140,s:1};const m=mesh(lanternGeo,glowMat);m.castShadow=false;m.position.set(p.x,p.y,p.z);lanterns.push({mesh:m,base:p.y,x:p.x,z:p.z,phase:random()*6});}
  const motes=new Float32Array(140*3);
  for(let i=0;i<140;i++){motes[i*3]=(random()-.5)*160;motes[i*3+1]=3+random()*45;motes[i*3+2]=(random()-.5)*160;}
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(motes,3));
  const sparks=new THREE.Points(mg,new THREE.PointsMaterial({color:'#d9c59a',size:.12,transparent:true,opacity:.7,depthWrite:false}));root.add(sparks);
  sparks.name='Nocturnal academy motes';
  const birds=[];
  const bg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.8,0,.2),new THREE.Vector3(0,0,0),new THREE.Vector3(.8,0,.2)]);
  for(let i=0;i<12;i++){const bird=new THREE.Line(bg,new THREE.LineBasicMaterial({color:'#111f24'}));root.add(bird);birds.push(bird);}
  const environmentLighting=navigation?.environmentLighting||gardens.lighting;
  mergeEnvironmentLighting(environmentLighting,blossomGroves.lighting);
  const known=new Set(environmentLighting.emissiveMaterials.map(e=>e.material));
  root.traverse(o=>{for(const m of(o.material?Array.isArray(o.material)?o.material:[o.material]:[])){
    if(!known.has(m)&&m.emissiveIntensity>0&&m.emissive?.getHex()>0){known.add(m);environmentLighting.emissiveMaterials.push({material:m,baseIntensity:m.userData.authoredEmissiveIntensity??=m.emissiveIntensity});}
    if(m.uniforms?.nightFactor&&!environmentLighting.nightMaterials.some(e=>e.material===m))environmentLighting.nightMaterials.push({material:m,uniform:'nightFactor',baseValue:1});
  }});
  environmentLighting.nightObjects=[{object:sparks,baseOpacity:.7},...lanterns.map(l=>({object:l.mesh,baseOpacity:1}))];
  return {root,heightAt:blossomGroves.heightAt,blossomGroves,portals,ringMeshes,crystals,wisps:navigation?.wisps||wisps,exhibits,occluders,atmosphere,lake,gardens,composition,vegetation,updateVegetation:(camera,viewport)=>{vegetation.update(camera,viewport);blossomGroves.update(camera,viewport);},clockTargets:gardens.clockTargets,environmentLighting,environmentColliders:navigation?.environmentColliders||gardens.colliders,releaseLantern:position=>atmosphere.releaseLantern(position),
    update(time,dt,reducedMotion=false,camera=null,viewport=null){
      vegetation.update(camera,viewport);
      lake.update(time,reducedMotion);
      atmosphere.update(time,dt,reducedMotion);
      gardens.update(time,reducedMotion);
      if(reducedMotion)return;
      animated.forEach(a=>{if(a.type==='portal'){a.group.userData.update(time,reducedMotion);}else a.mesh.rotation.y=time*.15;});
      exhibits.forEach((e,i)=>{e.group.userData.book.position.y=4.25+Math.sin(time*1.4+i)*.25;e.group.userData.book.rotation.y=Math.sin(time*.3+i)*.12;});
      crystals.forEach(c=>{c.group.rotation.y=time*.6;c.group.position.y=c.baseY+Math.sin(time*1.6+c.id)*.25;});
      lanterns.forEach(l=>{const drift=Math.sin(time*.065+l.phase)*1.8;l.mesh.position.set(l.x+environmentWind.direction.x*drift,l.base+Math.sin(time*.5+l.phase)*.5,l.z+environmentWind.direction.y*drift);});
      sparks.rotation.y=time*.006;
      birds.forEach((b,i)=>{const a=time*.075+i*.52;b.position.set(Math.cos(a)*37,32+Math.sin(a*2+i)*3,-27+Math.sin(a)*26);b.rotation.y=-a;b.rotation.z=Math.sin(time*5+i)*.15;});
    },
    setRingState(index,active){ringMeshes.forEach((r,i)=>{r.group.visible=active;r.material.opacity=active?(i<index?.07:i===index?1:.22):(i===0?.8:.16);r.material.color.set(i===index?'#ffde8b':'#c9c5a0');});},
  };
}

export function createWorld(scene){const iterator=assembleWorld(scene);let item;do{item=iterator.next();}while(!item.done);return item.value;}

export function mergeEnvironmentLighting(target,source){
  for(const key of ['lights','emissiveMaterials','nightMaterials','nightObjects'])for(const item of source[key]||[]){
    const identity=item.material||item.light||item.object;
    if(!target[key].some(entry=>(entry.material||entry.light||entry.object)===identity))target[key].push(item);
  }
}
export function registerWorldLighting(world,root=world.root){
  root.traverse(object=>{for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
    if(material.emissive?.getHex()>0){
      material.userData.authoredEmissiveIntensity??=material.emissiveIntensity;
      if(!world.environmentLighting.emissiveMaterials.some(entry=>entry.material===material))world.environmentLighting.emissiveMaterials.push({material,baseIntensity:material.userData.authoredEmissiveIntensity});
    }
    if(material.uniforms?.nightFactor&&!world.environmentLighting.nightMaterials.some(entry=>entry.material===material))world.environmentLighting.nightMaterials.push({material,uniform:'nightFactor',baseValue:1});
  }});
}

/** Small playable scene; all high-detail districts are installed after its first frame. */
export function createNavigationWorld(scene,terrain){
  const root=new THREE.Group();root.name='Academy world';scene.add(root);
  const ground=new THREE.Mesh(terrain.ground,groundMaterial()),cliffs=new THREE.Mesh(terrain.cliffs,surface('mossy-rock',{vertexColors:true,color:'#b8b6ab'}));
  ground.name='island-ground';cliffs.name='shoreline-cliffs';ground.receiveShadow=cliffs.receiveShadow=true;root.add(ground,cliffs);
  const lake=createLake(root,scene),atmosphere=createAtmosphere(scene,{heightAt:terrainHeight});
  const portals=[],animated=[];
  for(const location of locations){const portal=createPortal(location.color);portal.position.set(location.x,location.y+3.1,location.z+location.radius+3);root.add(portal);portals.push({id:location.id,group:portal});animated.push({type:'portal',group:portal});}
  const world={root,terrain,ground,cliffs,lake,atmosphere,portals,animated,ringMeshes:[],crystals:[],wisps:[],exhibits:[],occluders:[ground,cliffs],clockTargets:[],environmentColliders:[],
    environmentLighting:{lights:[],emissiveMaterials:[],nightMaterials:[],nightObjects:[]},
    heightAt:renderedTerrainHeight,priority:()=>0,complete:false,
    update(time,dt,reduced){lake.update(time,reduced);atmosphere.update(time,dt,reduced);for(const portal of portals)portal.group.userData.update(time,reduced);world.gardens?.update(time,reduced);},
    setRingState(){},releaseLantern:position=>atmosphere.releaseLantern(position),
    async enhance({signal,onRegion=()=>{},prepareRegion=async()=>true}={}){
      const iterator=assembleWorld(scene,world);let prepared;
      while(true){
        // Yield to input, rendering and cancellation between authored districts.
        await new Promise(resolve=>setTimeout(resolve,12));signal?.throwIfAborted();
        const begin=performance.now(),item=iterator.next(prepared);prepared=undefined;
        if(item.value?.prepare){prepared=await prepareRegion(item.value.prepare);continue;}
        registerWorldLighting(world);
        if(item.done){Object.assign(world,item.value,{complete:true});onRegion({region:'complete',assemblyMs:performance.now()-begin});return;}
        onRegion({...item.value,assemblyMs:performance.now()-begin});
      }
    },
  };
  registerWorldLighting(world);return world;
}
