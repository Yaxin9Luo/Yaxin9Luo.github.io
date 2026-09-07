import * as THREE from 'three';
import {createPortal} from './effects.js';
import {locations,ringPositions,crystalPositions,wispPositions} from './locations.js';
import {noise as coherentNoise,fbm,surface,planarUV,groundMaterial,createLake,createVegetation,createBackdrop} from './landscape.js';
import {createCastle,createObservatory,createLibrary,createWorkshop,createOwlery,createRuins} from './models.js';
import {createWisp} from './characters.js';

let seed=131;
function random(){seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;}
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.87,...extra});
const islands=[{x:0,z:10,rx:72,rz:62,y:3.8},{x:-48,z:-49,rx:23,rz:23,y:4},{x:45,z:-45,rx:24,rz:23,y:4}];
const TERRAIN_STEP=1.1;
const bridges={research:[[-35,-25],[-45,-37]],contact:[[31,-24],[42,-33]]};
function edgeShape(a){return .94+.10*Math.sin(a*3+.7)+.055*Math.cos(a*7)+.045*coherentNoise(Math.sin(a)*8,Math.cos(a)*8);}
export function terrainHeight(x,z){
  let h=-22;
  for(const i of islands){
    const u=(x-i.x)/i.rx,v=(z-i.z)/i.rz,a=Math.atan2(v,u),r=Math.hypot(u,v)/edgeShape(a);
    if(r<1) h=Math.max(h,i.y+(fbm(x*.065+5,z*.065)-.48)*7-Math.max(0,r-.83)*14);
  }
  for(const l of locations){const d=Math.hypot(x-l.x,z-l.z);if(d<l.radius+3)h=THREE.MathUtils.lerp(l.y,h,THREE.MathUtils.smoothstep(d,l.radius,l.radius+3));}
  // Grade each gate's approach with a soft shoulder instead of suspending its
  // stone plinth over the unmodified hillside.
  for(const l of locations){const d=Math.max(Math.abs(x-l.x)/4.6,Math.abs(z-l.z-l.radius-3)/3);if(d<1.8)h=THREE.MathUtils.lerp(l.y,h,THREE.MathUtils.smoothstep(d,1,1.8));}
  for(const ends of Object.values(bridges))for(const [bx,bz] of ends){const d=Math.hypot(x-bx,z-bz);if(d<7)h=THREE.MathUtils.lerp(4,h,THREE.MathUtils.smoothstep(d,4.3,7));}
  const court=Math.hypot(x*.88,z-22);if(court<14)h=THREE.MathUtils.lerp(4,h,THREE.MathUtils.smoothstep(court,7,14));
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

// Clip one shared grid to the union of the islands. Boundary vertices are reused
// by the cliff shells, so neither overlapping ground nor open shoreline seams remain.
function islandGeometry(){
  const step=TERRAIN_STEP,positions=[],colors=[],indices=[],shore=[],vertices=new Map(),cuts=new Map();
  const shoreField=(x,z)=>Math.max(...islands.map(i=>{
    const u=(x-i.x)/i.rx,v=(z-i.z)/i.rz;
    return 1-Math.hypot(u,v)/edgeShape(Math.atan2(v,u));
  }));
  const minX=Math.floor(Math.min(...islands.map(i=>i.x-i.rx*1.08))/step)*step;
  const maxX=Math.ceil(Math.max(...islands.map(i=>i.x+i.rx*1.08))/step)*step;
  const minZ=Math.floor(Math.min(...islands.map(i=>i.z-i.rz*1.08))/step)*step;
  const maxZ=Math.ceil(Math.max(...islands.map(i=>i.z+i.rz*1.08))/step)*step;
  const cols=Math.round((maxX-minX)/step),rows=Math.round((maxZ-minZ)/step),samples=[];
  const grassColor=new THREE.Color(),darkGrass=new THREE.Color('#c3c4a3'),rimColor=new THREE.Color('#8b8974');
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
    grassColor.set('#e3dfbe').lerp(darkGrass,.5+.25*Math.sin(point.x*.23)*Math.sin(point.z*.21)+noise(point.x,point.z)*.13);
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

  const cliffPositions=[],cliffColors=[],cliffColor=new THREE.Color(),cliffVertices=new Map();
  function cliffVertex(point,band){
    const key=`${point.key}/${band}`;
    if(cliffVertices.has(key))return cliffVertices.get(key);
    const dx=shoreField(point.x+.1,point.z)-shoreField(point.x-.1,point.z);
    const dz=shoreField(point.x,point.z+.1)-shoreField(point.x,point.z-.1);
    const length=Math.hypot(dx,dz)||1,t=band/8,inset=-Math.sin(t*Math.PI)*(1.4+noise(point.x,point.z)*1.1)+t*1.8;
    const p=[point.x+dx/length*inset,THREE.MathUtils.lerp(terrainHeight(point.x,point.z),-24,t),point.z+dz/length*inset];
    cliffVertices.set(key,p);return p;
  }
  for(const [a,b] of shore)for(let band=0;band<8;band++){
    const topA=cliffVertex(a,band),topB=cliffVertex(b,band),lowA=cliffVertex(a,band+1),lowB=cliffVertex(b,band+1);
    cliffPositions.push(...topA,...lowA,...topB,...topB,...lowA,...lowB);
    cliffColor.setHSL(.13,.12,.63+noise(a.x+band,a.z)*.10-band*.008);
    for(let n=0;n<6;n++)cliffColors.push(cliffColor.r,cliffColor.g,cliffColor.b);
  }
  const cliffs=new THREE.BufferGeometry();
  cliffs.setAttribute('position',new THREE.Float32BufferAttribute(cliffPositions,3));
  cliffs.setAttribute('color',new THREE.Float32BufferAttribute(cliffColors,3));cliffs.computeVertexNormals();
  planarUV(ground,.067);planarUV(cliffs,.22);return {ground,cliffs};
}

export function createTerrainSpecimen(){
  const group=new THREE.Group(),terrain=islandGeometry();group.name='Cliff terrain';
  const ground=new THREE.Mesh(terrain.ground,groundMaterial());const cliffs=new THREE.Mesh(terrain.cliffs,surface('mossy-rock',{vertexColors:true,color:'#b8b6ab'}));
  ground.receiveShadow=true;cliffs.receiveShadow=true;group.add(ground,cliffs);return group;
}

export function createWorld(scene){
  seed=131;
  const root=new THREE.Group();scene.add(root);
  const stone=surface('castle-masonry',{color:'#aaa79a'}),edge=surface('mossy-rock',{color:'#848a7a'}),brass=mat('#b59455',{metalness:.65,roughness:.4});
  const animated=[],portals=[],ringMeshes=[],crystals=[],wisps=[];
  const mesh=(geo,material,parent=root)=>{const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(x,y,z,w,h,d,material,parent=root)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),material,parent);m.position.set(x,y,z);return m;};
  const glowMat=new THREE.MeshBasicMaterial({color:'#ffd997',toneMapped:false});
  const terrain=islandGeometry();
  const ground=mesh(terrain.ground,groundMaterial());ground.name='island-ground';
  const cliffs=mesh(terrain.cliffs,surface('mossy-rock',{vertexColors:true,color:'#b8b6ab'}));cliffs.name='shoreline-cliffs';
  // Retain the existing seeded tree/rock/lantern distribution after replacing
  // the old 23×97 polar samples and 96×3×6 cliff samples per island.
  for(let i=0;i<islands.length*(23*97+96*3*6);i++)random();
  const lake=createLake(root,scene);
  const makers=[createCastle,createLibrary,createWorkshop,createObservatory,createRuins,createOwlery];
  locations.forEach((l,i)=>{const m=makers[i]();m.position.set(l.x,l.y,l.z);root.add(m);
    // Portals sit at the approach to each building and also serve as map destinations.
    const portal=createPortal(l.color);portal.position.set(l.x,l.y+3.1,l.z+l.radius+3);root.add(portal);
    box(0,-3.05,0,7,.3,3,stone,portal);
    // Weathered gate piers frame the spell, so its light has a physical setting.
    for(const sign of [-1,1]){box(sign*3.65,-1.1,0,.65,4.2,.9,stone,portal);box(sign*3.65,1.15,0,.85,.3,1.1,stone,portal);}
    animated.push({type:'portal',group:portal});portals.push({id:l.id,group:portal});
  });

  const paths=[];
  for(const l of locations){
    const gate=new THREE.Vector3(l.x,0,l.z+l.radius+3),ends=bridges[l.id];
    const p=ends?new THREE.Vector3(ends[0][0],0,ends[0][1]):gate;
    const curves=[new THREE.CatmullRomCurve3([new THREE.Vector3(1,0,21),new THREE.Vector3(p.x*.45+7,0,23+p.z*.12),p])];
    if(ends)curves.push(new THREE.LineCurve3(new THREE.Vector3(ends[1][0],0,ends[1][1]),gate));
    for(const curve of curves){
    const points=curve.getPoints(Math.ceil(curve.getLength()/.3));paths.push(points);
    const pos=[],idx=[];
    const width=l.id==='about'?3.2:2,across=Math.ceil(width*2/.4),stride=across+1;
    points.forEach((v,k)=>{const next=points[Math.min(k+1,points.length-1)],prev=points[Math.max(k-1,0)];const dir=new THREE.Vector3().subVectors(next,prev).normalize();
      for(let side=0;side<=across;side++){const offset=(side/across*2-1)*width,x=v.x+dir.z*offset,z=v.z-dir.x*offset;pos.push(x,renderedTerrainHeight(x,z)+.075,z);}
      if(k<points.length-1)for(let side=0;side<across;side++){const j=k*stride+side;idx.push(j,j+1,j+stride,j+1,j+stride+1,j+stride);}
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();planarUV(g,.4);mesh(g,surface('castle-masonry',{color:'#aaa692',side:THREE.DoubleSide})).name=`road-${l.id}`;
    }
  }
  const nearPath=(x,z)=>paths.some(p=>p.some((v,i)=>i%3===0&&Math.hypot(v.x-x,v.z-z)<3.7));
  function bridge(ax,az,bx,bz){
    const length=Math.hypot(bx-ax,bz-az),group=new THREE.Group();group.position.set((ax+bx)/2,3.6,(az+bz)/2);group.rotation.y=Math.atan2(bx-ax,bz-az);root.add(group);
    box(0,0,0,6,.85,length,stone,group);box(-3,.6,0,.4,.75,length,edge,group);box(3,.6,0,.4,.75,length,edge,group);
    const count=Math.ceil(length/6);
    for(let i=0;i<count;i++){const z=-length/2+i*length/(count-1);box(-2.5,-3.2,z,.9,6,.95,stone,group);box(2.5,-3.2,z,.9,6,.95,stone,group);box(-3,1.25,z,.8,.65,.8,stone,group);box(3,1.25,z,.8,.65,.8,stone,group);}
  }
  for(const [[ax,az],[bx,bz]] of Object.values(bridges))bridge(ax,az,bx,bz);
  // Central astrolabe fountain.
  const fountain=new THREE.Group();fountain.position.set(0,terrainHeight(0,22),22);root.add(fountain);
  for(const [r,h,y] of [[5,.4,.1],[4.2,.7,.5],[1.2,2.8,1.4]]){const m=mesh(new THREE.CylinderGeometry(r,r,h,32),stone,fountain);m.position.y=y;}
  const pool=mesh(new THREE.CylinderGeometry(3.9,3.9,.1,48),mat('#294943',{metalness:0,roughness:.42}),fountain);pool.position.y=.9;
  const sphere=mesh(new THREE.IcosahedronGeometry(1.35,2),brass,fountain);sphere.position.y=4.6;
  for(let i=0;i<3;i++){const torus=mesh(new THREE.TorusGeometry(2,.055,6,64),brass,fountain);torus.position.y=4.6;torus.rotation.set(i*.8,i*.6,.8);animated.push({type:'orb',mesh:torus});}

  const vegetation=createVegetation(root,terrainHeight,nearPath);
  root.userData.vegetation=vegetation;
  createBackdrop(root,scene);

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
  wispPositions.forEach((p,i)=>{const group=createWisp();group.position.fromArray(p);root.add(group);wisps.push({id:i,group,home:new THREE.Vector3(...p),hp:3,respawn:0,attack:2+i*.4});});
  const lanternGeo=new THREE.SphereGeometry(.08,6,4),lanterns=[];
  for(let i=0;i<38;i++){const p={x:(random()-.5)*125,y:10+random()*18,z:(random()-.5)*140,s:1};const m=mesh(lanternGeo,glowMat);m.position.set(p.x,p.y,p.z);lanterns.push({mesh:m,base:p.y,phase:random()*6});}
  const motes=new Float32Array(400*3);
  for(let i=0;i<400;i++){motes[i*3]=(random()-.5)*160;motes[i*3+1]=3+random()*45;motes[i*3+2]=(random()-.5)*160;}
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(motes,3));
  const sparks=new THREE.Points(mg,new THREE.PointsMaterial({color:'#d9c59a',size:.12,transparent:true,opacity:.7,depthWrite:false}));root.add(sparks);
  const birds=[];
  const bg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.8,0,.2),new THREE.Vector3(0,0,0),new THREE.Vector3(.8,0,.2)]);
  for(let i=0;i<12;i++){const bird=new THREE.Line(bg,new THREE.LineBasicMaterial({color:'#111f24'}));root.add(bird);birds.push(bird);}
  return {root,portals,ringMeshes,crystals,wisps,
    update(time,dt,reducedMotion=false){
      lake.update(time,reducedMotion);
      if(reducedMotion)return;
      animated.forEach(a=>{if(a.type==='portal'){a.group.userData.update(time,reducedMotion);}else a.mesh.rotation.y=time*.15;});
      crystals.forEach(c=>{c.group.rotation.y=time*.6;c.group.position.y=c.baseY+Math.sin(time*1.6+c.id)*.25;});
      lanterns.forEach(l=>l.mesh.position.y=l.base+Math.sin(time*.5+l.phase)*.5);
      sparks.rotation.y=time*.006;
      birds.forEach((b,i)=>{const a=time*.075+i*.52;b.position.set(Math.cos(a)*37,32+Math.sin(a*2+i)*3,-27+Math.sin(a)*26);b.rotation.y=-a;b.rotation.z=Math.sin(time*5+i)*.15;});
    },
    setRingState(index,active){ringMeshes.forEach((r,i)=>{r.group.visible=active;r.material.opacity=active?(i<index?.07:i===index?1:.22):(i===0?.8:.16);r.material.color.set(i===index?'#ffde8b':'#c9c5a0');});},
  };
}
