import * as THREE from 'three';
import {createKit,framed} from './kit.js';
import {locations,bridges,court,exhibitSites} from '../locations.js';

// Six low-poly landmarks on the original map, plus the court, bridges and the
// trial gates. Everything static merges into two geometries (lit stone and
// unlit glow); a few small animated parts stay separate.

export const PALETTE={
  stone:'#a9a4b8',stoneMid:'#8f8aa0',stoneDark:'#6f6b82',trim:'#d8b46a',
  roof:'#36487a',roofDark:'#2b3660',copper:'#5f9a92',brick:'#93604f',timber:'#5d4436',
  white:'#cdd2e0',ruin:'#9e9a88',moss:'#61825b',red:'#8c4949',
  glow:'#ffc874',glowWarm:'#ffae5c',glowCool:'#9fe8ff',rune:'#7ef0dc',
};

const L=Object.fromEntries(locations.map(l=>[l.id,l]));

function castle(k){
  const P=PALETTE,ao=[.66,4];
  // Curtain wall around the courtyard, open at the south gate.
  const wallH=11,t=2.4;
  k.box({x:-15.5,z:21,w:17,h:wallH,d:t,color:P.stone,solid:true,ao});
  k.box({x:15.5,z:21,w:17,h:wallH,d:t,color:P.stone,solid:true,ao});
  k.box({x:0,z:-22,w:54,h:wallH,d:t,color:P.stone,solid:true,ao});
  k.box({x:-26,z:0,w:t,h:wallH,d:42,color:P.stone,solid:true,ao});
  k.box({x:26,z:0,w:t,h:wallH,d:42,color:P.stone,solid:true,ao});
  // Crenellations.
  const merlons=(x0,z0,x1,z1)=>{const n=Math.round(Math.hypot(x1-x0,z1-z0)/2.6);for(let i=0;i<=n;i++){const u=i/n;k.box({x:x0+(x1-x0)*u,y:wallH,z:z0+(z1-z0)*u,w:1.3,h:1.4,d:t+.2,ry:Math.abs(x1-x0)>Math.abs(z1-z0)?0:Math.PI/2,color:P.stoneMid,ao:null});}};
  merlons(-24,21,-7,21);merlons(7,21,24,21);merlons(-24,-22,24,-22);merlons(-26,-19,-26,19);merlons(26,-19,26,19);
  // Corner towers.
  for(const [x,z] of [[-26,21],[26,21],[-26,-22],[26,-22]]){
    k.cyl({x,z,r:4.8,rTop:4.4,h:25,seg:10,color:P.stone,solid:true,ao});
    k.cyl({x,y:25,z,r:5.3,h:1.4,seg:10,color:P.stoneMid});
    k.cone({x,y:26.4,z,r:5.8,h:12,seg:10,color:P.roof,solid:true});
    for(let i=0;i<3;i++){const a=i*2.1+(x>0?.4:1.2);k.window({x:x+Math.sin(a)*4.55,y:12+i*3.5,z:z+Math.cos(a)*4.55,w:.9,h:1.8,ry:a});}
  }
  // Gatehouse.
  for(const s of [-1,1]){
    k.cyl({x:s*7.2,z:22,r:3.6,rTop:3.2,h:18,seg:8,color:P.stone,solid:true,ao});
    k.cone({x:s*7.2,y:18,z:22,r:4.2,h:8,seg:8,color:P.roofDark,solid:true});
    k.window({x:s*7.2,y:12,z:25.3,w:.8,h:1.6});
  }
  k.box({x:0,y:9,z:22,w:11,h:4.5,d:3.4,color:P.stoneMid,solid:true});
  k.box({x:0,y:0,z:21.2,w:5.6,h:8.6,d:1.6,color:'#3a2d2a'});
  k.window({x:0,y:.5,z:22.1,w:4.6,h:7.4,color:P.glowWarm});
  // Great hall with a gabled roof and tall lit windows.
  k.box({x:0,z:-4,w:30,h:15,d:15,color:P.stone,solid:true,ao});
  k.gable({x:0,y:15,z:-4,w:30,d:15,h:8,color:P.roof});
  for(let i=0;i<6;i++){const x=-12.5+i*5;k.window({x,y:4,z:3.55,w:1.5,h:5.2});k.window({x,y:4,z:-11.55,w:1.5,h:5.2});}
  k.window({x:0,y:9,z:3.6,w:3.4,h:4.6,color:P.glowWarm});
  // Hall end towers.
  for(const s of [-1,1]){k.cyl({x:s*15,z:-4,r:3.4,h:31,seg:8,color:P.stoneMid,solid:true,ao});k.cone({x:s*15,y:31,z:-4,r:4,h:11,seg:8,color:P.roof,solid:true});k.window({x:s*15,y:20,z:-.65,w:.9,h:2});}
  // The keep and its spire: the tallest point on the map.
  k.box({x:0,z:-15,w:14,h:28,d:12,color:P.stone,solid:true,ao});
  k.cyl({x:0,y:28,z:-15,r:6.4,rTop:5.8,h:22,seg:8,color:P.stone,solid:true});
  k.cyl({x:0,y:50,z:-15,r:7,h:1.6,seg:8,color:P.stoneMid});
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;k.window({x:Math.sin(a)*6,y:42,z:-15+Math.cos(a)*6,w:1.1,h:3.2,ry:a});k.window({x:Math.sin(a)*6.1,y:33,z:-15+Math.cos(a)*6.1,w:.9,h:2.2,ry:a});}
  k.cone({x:0,y:51.6,z:-15,r:7,h:26,seg:8,color:P.roofDark,solid:true});
  k.cyl({x:0,y:77,z:-15,r:.25,h:4,seg:4,color:P.trim});
  k.ico({x:0,y:81.4,z:-15,r:.75,color:P.trim});
  for(let i=0;i<4;i++)k.window({x:-9+i*6,y:16,z:-8.9,w:1.2,h:3});
}

function library(k){
  const P=PALETTE;
  k.cyl({r:13,h:1.4,seg:16,color:P.stoneMid,solid:true});
  k.cyl({y:1.4,r:9,rTop:8.8,h:13,seg:8,color:'#bdb3a2',solid:true,ao:[.7,4]});
  for(let i=0;i<12;i++){const a=i*Math.PI/6;k.cyl({x:Math.sin(a)*11.2,y:1.4,z:Math.cos(a)*11.2,r:.6,h:10.5,seg:6,color:'#c9c0ae',solid:true});}
  k.cyl({y:11.9,r:12.2,h:1.5,seg:16,color:'#b0a796',open:true});
  k.cyl({y:13.4,r:12.4,rTop:9.4,h:1,seg:16,color:P.copper});
  k.dome({y:14.4,r:9.2,seg:12,rings:5,color:P.copper,solid:true});
  k.cyl({y:22.8,r:1.8,h:2.6,seg:8,color:'#c9c0ae'});
  k.dome({y:25.4,r:2,seg:8,rings:3,color:P.copper});
  k.cyl({y:27.2,r:.15,h:2.4,seg:4,color:P.trim});
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;k.window({x:Math.sin(a)*8.75,y:4,z:Math.cos(a)*8.75,w:1.8,h:6.5,ry:a});}
  for(let i=0;i<6;i++){const a=i*Math.PI/3;k.window({x:Math.sin(a)*1.85,y:23.2,z:Math.cos(a)*1.85,w:.7,h:1.6,ry:a,color:P.glowCool});}
}

function atelier(k){
  const P=PALETTE;
  k.box({x:-1,z:0,w:18,h:9,d:12,color:P.brick,solid:true,ao:[.7,3]});
  for(let i=0;i<3;i++){k.gable({x:-7+i*6,y:9,z:0,w:5.2,d:12,h:4.4,ry:Math.PI/2,color:P.roofDark,overhang:.3});}
  for(let i=0;i<4;i++){k.box({x:-9.8+i*5.9,y:0,z:6.05,w:.5,h:9,d:.3,color:P.timber});k.box({x:-9.8+i*5.9,y:0,z:-6.05,w:.5,h:9,d:.3,color:P.timber});}
  k.box({x:-1,y:4.4,z:6.08,w:18,h:.45,d:.3,color:P.timber});
  for(let i=0;i<3;i++){k.window({x:-7+i*6,y:1,z:6.1,w:3.2,h:3,color:i===1?P.glowWarm:P.glow});k.window({x:-7+i*6,y:5.4,z:6.1,w:2.2,h:2.3});}
  k.box({x:6,z:-3,w:2.8,h:20,d:2.8,color:P.brick,solid:true});
  k.box({x:6,y:20,z:-3,w:3.4,h:1,d:3.4,color:P.stoneDark});
  k.window({x:6,y:21,z:-3,w:2.2,h:.5,color:P.glowWarm});
  k.box({x:-14,z:2,w:8,h:6,d:8,color:P.stoneMid,solid:true});
  k.cone({x:-14,y:6,z:2,r:6.2,h:4,seg:4,ry:Math.PI/4,color:P.roof});
  k.window({x:-14,y:1.5,z:6.1,w:2,h:2.6});
}

function observatory(k){
  const P=PALETTE;
  k.cyl({r:8,h:3.5,seg:12,color:P.stoneMid,solid:true});
  k.cyl({y:3.5,r:5.4,rTop:5,h:17,seg:12,color:P.stone,solid:true,ao:[.75,4]});
  k.cyl({y:20.5,r:6.2,h:1.2,seg:12,color:P.stoneMid});
  k.dome({y:21.7,r:6,seg:14,rings:6,color:P.white,solid:true});
  k.box({y:24,z:2.6,w:1.4,h:3.6,d:5,rx:-.6,color:'#24283a'});
  k.cyl({x:0,y:23,z:3.4,r:.8,rTop:.6,h:8,seg:8,color:P.trim});
  for(let i=0;i<6;i++){const a=i*Math.PI/3;k.window({x:Math.sin(a)*5.15,y:8+((i%2)*4),z:Math.cos(a)*5.15,w:.9,h:1.6,ry:a,color:P.glowCool});}
  k.window({x:0,y:4,z:5.4,w:2,h:3.6,color:P.glowWarm});
}

function ruins(k){
  const P=PALETTE,r=k.random;
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI*2,R=10.5,h=i%3===0?2+r()*2:5+r()*9,x=Math.sin(a)*R,z=Math.cos(a)*R;
    k.cyl({x,z,r:.85,h,seg:7,color:P.ruin,solid:true,ao:[.7,3]});
    k.box({x,y:h,z,w:1.9,h:.5,d:1.9,ry:a,color:P.moss});
  }
  for(const s of [-1,1])k.box({x:s*3.4,z:-2,w:1.8,h:12,d:1.8,color:P.ruin,solid:true});
  k.box({y:12,z:-2,w:9,h:1.6,d:2,color:P.ruin,solid:true});
  for(let i=0;i<5;i++){const a=r()*Math.PI*2,R=4+r()*8;k.cyl({x:Math.sin(a)*R,y:.6,z:Math.cos(a)*R,r:.8,h:4+r()*4,seg:7,color:P.ruin});}
  for(let i=0;i<6;i++){const a=r()*Math.PI*2,R=3+r()*9;k.box({x:Math.sin(a)*R,z:Math.cos(a)*R,w:1.4+r()*1.4,h:.8+r(),d:1.2+r(),ry:r()*3,color:P.stoneDark});}
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.3;k.window({x:Math.sin(a)*6,y:.2,z:Math.cos(a)*6,w:.9,h:1.4,ry:a,color:P.rune});}
}

function owlery(k){
  const P=PALETTE;
  k.cyl({r:6,h:2,seg:10,color:P.stoneMid,solid:true});
  k.cyl({y:2,r:4.6,rTop:3.8,h:17,seg:10,color:P.stone,solid:true,ao:[.75,4]});
  k.cyl({y:12,r:6,h:.6,seg:12,color:P.timber});
  for(let i=0;i<6;i++){const a=i*Math.PI/3;k.box({x:Math.sin(a)*5.4,y:11.2,z:Math.cos(a)*5.4,w:.3,h:.8,d:.3,color:P.timber});k.box({x:Math.sin(a+.5)*4.6,y:16,z:Math.cos(a+.5)*4.6,w:.35,h:.35,d:3,ry:a+.5,color:P.timber});}
  k.cone({y:19,r:5,h:9,seg:10,color:P.red,solid:true});
  k.cyl({y:28,r:.12,h:2.4,seg:4,color:P.trim});
  k.box({y:29.4,w:2,h:.25,d:.25,color:P.trim});
  for(let i=0;i<5;i++){const a=i*1.25+.4;k.window({x:Math.sin(a)*4.05,y:6+i*2.2,z:Math.cos(a)*4.05,w:.9,h:.9,ry:a});}
  k.box({x:-6,z:4,w:7,h:5,d:6,color:P.stoneMid,solid:true,ao:[.7,3]});
  k.gable({x:-6,y:5,z:4,w:7,d:6,h:3.2,color:P.red});
  k.window({x:-6,y:1.2,z:7.05,w:1.6,h:2});
}

function courtClock(k){
  const P=PALETTE;
  k.cyl({x:court.x,y:court.y,z:court.z,r:5.4,h:.5,seg:16,color:P.stoneMid,ao:null});
  k.cyl({x:court.x,y:court.y+.5,z:court.z,r:1.5,rTop:1.1,h:7,seg:6,color:P.stone,solid:true});
  k.torus({x:court.x,y:court.y+8.6,z:court.z,r:2.2,tube:.12,rx:Math.PI/2,color:P.trim});
  k.torus({x:court.x,y:court.y+8.6,z:court.z,r:2.2,tube:.12,ry:Math.PI/2,color:P.trim});
  k.ico({x:court.x,y:court.y+8.6,z:court.z,r:.9,detail:1,color:'#fff1c4',group:'glow'});
}

function exhibitPlinths(k,heightAt){
  for(const e of exhibitSites){
    const y=heightAt(e.x,e.z);
    k.cyl({x:e.x,y,z:e.z,r:1.4,rTop:1.1,h:2.6,seg:8,color:PALETTE.stoneMid,solid:true});
    k.box({x:e.x,y:y+2.6,z:e.z,w:2.2,h:.35,d:1.6,ry:-.24,color:e.color});
    k.window({x:e.x,y:y+2.95,z:e.z,w:1.8,h:.08,ry:-.24,color:'#fff4d6',depth:1.2});
  }
}

export const BRIDGE_DECK=6.82;
function bridge(k,[[ax,az],[bx,bz]]){
  const P=PALETTE,length=Math.hypot(bx-ax,bz-az),ry=Math.atan2(bx-ax,bz-az),cx=(ax+bx)/2,cz=(az+bz)/2;
  const f=framed(k,{x:cx,y:0,z:cz,ry});
  // Local z runs along the span; local x across it.
  f.box({y:BRIDGE_DECK-1.2,w:5.4,h:1.2,d:length+6,color:P.stoneMid,solid:true});
  for(const s of [-1,1])f.box({x:s*2.5,y:BRIDGE_DECK,w:.5,h:1.1,d:length+6,color:P.stone,solid:true});
  const pier=length*.5-1.4;
  for(const s of [-1,1]){
    f.box({y:-17,z:s*pier,w:4.6,h:BRIDGE_DECK-1.2+17,d:2.8,color:P.stoneMid,solid:true,ao:null});
    // A shallow arch springing from each pier toward the middle.
    for(let i=0;i<4;i++){const u=(i+1)/5,z=s*pier*(1-u),y=BRIDGE_DECK-2.2-Math.sin(u*Math.PI*.5)*2.5;f.box({y:Math.min(y,BRIDGE_DECK-1.2-1.4),z,w:4.4,h:1.4+(BRIDGE_DECK-1.2-1.4-y),d:pier/5+.2,color:P.stone});}
    for(const side of [-1,1]){f.cyl({x:side*2.5,y:BRIDGE_DECK+1.1,z:s*(length*.5+2.2),r:.35,h:2.1,seg:6,color:P.stone});f.window({x:side*2.5,y:BRIDGE_DECK+3.2,z:s*(length*.5+2.2),w:.5,h:.6,ry:Math.PI/4,depth:.5});}
  }
}

/** Golden start gate for a trial, standing at its start pose. */
export function trialGate(k,start){
  const f=framed(k,{x:start.x,y:start.y,z:start.z,ry:start.heading});
  f.torus({y:0,r:6.5,tube:.3,seg:40,tubeSeg:6,color:'#e9c46f',group:'glow'});
  f.torus({y:0,r:7.05,tube:.09,seg:40,tubeSeg:4,color:'#fff0c2',group:'glow'});
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;f.box({x:Math.cos(a)*6.5,y:Math.sin(a)*6.5,w:.5,h:.5,d:.9,rz:a,color:'#fff6da',group:'glow'});}
}

/** Build every static landmark; returns geometries, colliders and anchors for animated parts. */
export function buildLandmarks({heightAt,trials=[]}){
  const kit=createKit({seed:91});
  const at=(id,fn)=>{const l=L[id];fn(framed(kit,{x:l.x,y:l.y,z:l.z,ry:0}));};
  at('about',castle);at('publications',library);at('projects',atelier);at('research',observatory);at('journey',ruins);at('contact',owlery);
  courtClock(kit);exhibitPlinths(kit,heightAt);
  for(const span of Object.values(bridges))bridge(kit,span);
  for(const trial of trials)trialGate(kit,trial.start);
  const built=kit.build();
  return {...built,anchors:{
    libraryBooks:{x:L.publications.x,y:L.publications.y+31,z:L.publications.z},
    armillary:{x:L.research.x,y:L.research.y+35,z:L.research.z},
    gear:{x:L.projects.x-1,y:L.projects.y+6,z:L.projects.z+6.6},
    chimney:{x:L.projects.x+6,y:L.projects.y+21.5,z:L.projects.z-3},
  }};
}

/** Small animated set pieces: library books, observatory armillary, atelier gear. */
export function createAnimatedParts(anchors,materials){
  const group=new THREE.Group();group.name='Animated landmarks';
  const books=new THREE.InstancedMesh(new THREE.BoxGeometry(1.2,.3,1.6),materials.solid,9);
  const colors=['#8a3d3d','#3d5a8a','#3d7a5a','#8a6d3d','#5d3d8a'];const tmp=new THREE.Color();
  for(let i=0;i<9;i++)books.setColorAt(i,tmp.set(colors[i%colors.length]));
  books.userData.anchor=anchors.libraryBooks;group.add(books);
  const kit=createKit({seed:5});
  kit.torus({r:4.2,tube:.14,seg:32,color:PALETTE.trim});kit.torus({r:3.6,tube:.12,seg:32,rx:Math.PI/2,color:PALETTE.trim});kit.torus({r:3,tube:.1,seg:28,ry:Math.PI/2,color:PALETTE.trim});
  kit.ico({r:.9,detail:1,color:'#d9f6ff',group:'glow'});
  const arm=kit.build();
  const armillary=new THREE.Group();armillary.position.set(anchors.armillary.x,anchors.armillary.y,anchors.armillary.z);
  armillary.add(new THREE.Mesh(arm.solid,materials.solid),new THREE.Mesh(arm.glow,materials.glow));group.add(armillary);
  const gk=createKit({seed:3});
  gk.cyl({r:2.6,h:.5,seg:12,color:PALETTE.trim});
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;gk.box({x:Math.sin(a)*2.8,y:0,z:Math.cos(a)*2.8,w:.7,h:.5,d:.7,ry:a,color:PALETTE.trim});}
  gk.cyl({r:.6,h:.7,y:-.1,seg:8,color:PALETTE.stoneDark});
  const gearGeo=gk.build();
  const gear=new THREE.Mesh(gearGeo.solid,materials.solid);gear.position.set(anchors.gear.x,anchors.gear.y,anchors.gear.z);gear.rotation.x=Math.PI/2;group.add(gear);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),pos=new THREE.Vector3(),one=new THREE.Vector3(1,1,1);
  return {group,update(time){
    const a=anchors.libraryBooks;
    for(let i=0;i<9;i++){const t=time*.35+i/9*Math.PI*2;pos.set(a.x+Math.sin(t)*6,a.y+Math.sin(time*1.3+i)*.8+(i%3)*1.2,a.z+Math.cos(t)*6);q.setFromEuler(e.set(Math.sin(time+i)*.3,-t,Math.cos(time*.8+i)*.25));matrix.compose(pos,q,one);books.setMatrixAt(i,matrix);}
    books.instanceMatrix.needsUpdate=true;
    armillary.children[0].rotation.set(time*.21,time*.33,time*.13);
    gear.rotation.y=time*.9;
  }};
}
