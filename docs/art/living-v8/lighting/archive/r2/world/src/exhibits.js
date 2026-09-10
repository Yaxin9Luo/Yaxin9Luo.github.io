import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {assignArchitecturalUVs} from './architecture.js';
import {getProject, getProjectMedia, selectedProjects} from './exhibition-content.js';
import {clampMedia, MediaSelection} from './exhibition-state.js';
import {createAtelierMaterials} from './exhibit-materials.js';
import {ExhibitMotion} from './exhibit-motion.js';

const palette={wood:0x675147,edge:0x423c3b,brass:0xbca06b,stone:0x999c97,ink:0x233f4c,cream:0xf1e8d3,leather:0x486a77};
function lettering(lines,{width=1024,height=256,dark=false}={}){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.fillStyle=dark?'#243e49':'#eee5d0';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle=dark?'#b89d694d':'#9b825a75';ctx.lineWidth=2;ctx.strokeRect(14,14,width-28,height-28);
  const lineHeight=height/(lines.length+1);
  lines.forEach((line,i)=>{const text=typeof line==='string'?line:line.text;let size=(typeof line==='string'?null:line.size)||Math.min(72,lineHeight*.58);ctx.font=`${i===0?'500':'400'} ${size}px Georgia,"Songti SC","PingFang SC",serif`;while(ctx.measureText(text).width>width-70&&size>14){size-=2;ctx.font=`${size}px Georgia,"Songti SC","PingFang SC",serif`;}ctx.fillStyle=dark?(i===0?'#f2e7cf':'#c7b68e'):(i===0?'#29434a':'#766951');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,lineHeight*(i+1));});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function methodPage(project,lang){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1100;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e9dfc6';ctx.fillRect(0,0,900,1100);
  ctx.strokeStyle='#ae9670';ctx.lineWidth=2;ctx.strokeRect(48,48,804,1004);let y=102;
  const write=(text,size,color,gap=12)=>{
    ctx.font=`${size}px Georgia,"Songti SC","PingFang SC",serif`;ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='top';
    let line='';const tokens=lang==='zh'?[...text]:text.split(/(\s+)/);
    for(const token of tokens){if(line&&ctx.measureText(line+token).width>706){ctx.fillText(line,96,y);y+=size*1.43;line=token.trimStart();}else line+=token;}
    if(line){ctx.fillText(line,96,y);y+=size*1.43;}y+=gap;
  };
  write(project.shortTitle[lang],54,'#24414b',14);write(`${project.year}  /  ${project.category[lang]}`,25,'#847153',35);
  write(lang==='zh'?'研究问题':'RESEARCH QUESTION',23,'#9a7945',14);write(project.question[lang],lang==='zh'?36:32,'#374949',30);
  write(lang==='zh'?'方法摘要':'METHOD NOTES',23,'#9a7945',14);write(project.approach[lang],lang==='zh'?34:30,'#374949',14);
  ctx.fillStyle='#8c795c';ctx.font='22px Georgia,"PingFang SC",serif';ctx.fillText(lang==='zh'?'点击阅读项目 · 来源见详情':'Read the project · Sources in the reader',96,1000);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

function batchDecoration(parent,targets){
  for(const child of [...parent.children])if(child.isGroup)batchDecoration(child,targets);
  const batches=new Map();
  for(const mesh of [...parent.children])if(mesh.isMesh&&!mesh.name){const key=`${mesh.material.uuid}:${JSON.stringify(mesh.userData.exhibition||null)}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);}
  for(const meshes of batches.values()){
    if(meshes.length<2)continue;
    const material=meshes[0].material,semantic=meshes[0].userData.exhibition;
    const parts=meshes.map(mesh=>{mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);return geometry;});
    const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());if(!geometry)continue;
    const merged=new THREE.Mesh(geometry,material);merged.castShadow=true;merged.receiveShadow=true;parent.add(merged);
    if(semantic){merged.userData.exhibition={...semantic};targets.push(merged);}
    for(const mesh of meshes){parent.remove(mesh);mesh.geometry.dispose();const index=targets.indexOf(mesh);if(index>=0)targets.splice(index,1);}
  }
}

/** A physical portfolio scene. Long-form reading stays in accessible HTML. */
export function createExhibitionStage(scene,heightAt,{lang='en',loadMedia,loadSurface}={}){
  const group=new THREE.Group();group.name='research-atelier-exhibition';const ground=heightAt(62,57);group.position.set(62,ground+.13,57);scene.add(group);
  const interactiveTargets=[],colliders=[],disposables=new Set(),motion=new ExhibitMotion();let disposed=false,reducedMotion=false,shadowDirty=true;
  const surfaces=createAtelierMaterials(loadSurface?{loadTexture:loadSurface}:{}),materials=surfaces.materials;
  const add=(geometry,material,position,parent=group)=>{
    if(material.userData.metresPerRepeat){if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}assignArchitecturalUVs(geometry,material.userData.metresPerRepeat);}
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const box=(size,position,material=materials.wood,radius=.07,parent=group)=>add(new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(v=>v/2))),material,position,parent);
  const cylinder=(r,h,position,material=materials.brass,parent=group,bottom=r)=>add(new THREE.CylinderGeometry(r,bottom,h,32),material,position,parent);
  const ring=(r,tube,position,material=materials.brass,parent=group)=>add(new THREE.TorusGeometry(r,tube,10,80),material,position,parent);
  const beam=(a,b,r,material=materials.brass,parent=group)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),mesh=cylinder(r,delta.length(),from.add(to).multiplyScalar(.5).toArray(),material,parent);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};
  const collider=(name,[width,height,depth],[x,y,z])=>{
    x+=group.position.x;y+=group.position.y;z+=group.position.z;
    const bottom=y-height/2,top=y+height/2;
    colliders.push({id:`exhibition/${name}`,buildingId:'exhibition',bottom,top,planes:[[1,0,0,x+width/2],[-1,0,0,-x+width/2],[0,0,1,z+depth/2],[0,0,-1,-z+depth/2],[0,-1,0,-bottom],[0,1,0,top]]});
  };
  const solidBox=(name,size,position,material,radius)=>{collider(name,size,position);return box(size,position,material,radius);};
  const target=(mesh,action,section)=>{mesh.userData.exhibition={action,...section?{section}:{}};if(!interactiveTargets.includes(mesh))interactiveTargets.push(mesh);return mesh;};
  const targetObject=(object,action,section)=>object.traverse(mesh=>{if(mesh.isMesh)target(mesh,action,section);});
  const own=texture=>{if(texture){if(disposed)texture.dispose();else disposables.add(texture);}return texture;};
  const face=(size,position,lines,options={},parent=group)=>{
    const map=lettering(lines,options);if(map)disposables.add(map);
    const material=new THREE.MeshBasicMaterial({map,color:map?0xffffff:palette.cream,toneMapped:false,side:THREE.DoubleSide});
    const mesh=add(new THREE.PlaneGeometry(...size),material,position,parent);mesh.name='exhibition-lettered-surface';mesh.castShadow=false;return mesh;
  };
  const updateFace=(mesh,lines,options={})=>{const old=mesh.material.map;const map=lettering(lines,options);mesh.material.map=map;mesh.material.needsUpdate=true;if(map)disposables.add(map);if(old){old.dispose();disposables.delete(old);}};
  const replaceMap=(mesh,map)=>{const old=mesh.material.map;mesh.material.map=own(map);mesh.material.needsUpdate=true;if(old&&disposables.has(old)){old.dispose();disposables.delete(old);}};
  const screw=(position,parent=group,r=.052)=>{const head=cylinder(r,.025,position,materials.brightBrass,parent);head.rotation.x=Math.PI/2;box([r*1.2,.013,.006],[position[0],position[1],position[2]+.016],materials.edge,.002,parent);return head;};

  // The broad planes, dark frame and warm edges give the media a quiet backdrop.
  solidBox('platform-base',[21.5,.34,12.6],[0,.17,.4],materials.stone,.15);
  solidBox('platform-upper',[20.6,.34,11.8],[0,.47,.3],materials.edge,.12);
  for(let i=0;i<13;i++){
    const x=-9.2+i*1.535;box([1.50,.14,11.35],[x,.71,.3],i%4===0?materials.edge:materials.wood,.02);
    for(const z of [-5.06,5.66])cylinder(.034,.008,[x,.785,z],materials.brass);
  }
  collider('platform-deck',[19.95,.14,11.35],[.01,.71,.3]);
  solidBox('platform-step-low',[14.4,.2,1.05],[0,.18,7],materials.stone,.09);solidBox('platform-step-high',[12.8,.19,.7],[0,.48,6.55],materials.stone,.07);
  for(const x of [-7.48,7.48]){
    box([.48,12.7,.66],[x,7,-4.42],materials.edge,.09);
    box([.76,.28,.92],[x,1.15,-4.42],materials.brass,.07);
    box([.7,.26,.84],[x,13.44,-4.42],materials.brass,.06);
    box([.12,10.75,.09],[x,7.35,-4.03],materials.brass,.02);
    for(const y of [1.54,3.6,12.5])box([.58,.19,.75],[x,y,-4.42],materials.brass,.035);
    beam([x,1.0,-2.8],[x,5.8,-4.43],.08,materials.brass);
  }
  const displayStart=group.children.length;
  const screenFrame=box([15.6,9.7,.52],[0,8.1,-4.47],materials.edge,.2);screenFrame.name='exhibition-screen-frame';
  box([15.24,9.36,.13],[0,8.1,-4.16],materials.brass,.08);
  box([14.87,9.01,.15],[0,8.1,-4.04],materials.ink,.06);
  collider('screen',[15.6,9.7,.83],[0,8.1,-4.315]);
  const screenBacking=add(new THREE.PlaneGeometry(14.38,8.51),new THREE.MeshBasicMaterial({color:0xf4f0e6,toneMapped:false}),[0,8.1,-3.95]);screenBacking.castShadow=false;screenBacking.name='exhibition-screen-backing';
  const screen=target(add(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),[0,8.1,-3.925]),'open');screen.visible=false;screen.castShadow=false;screen.name='exhibition-current-media';
  const emptyScreen=face([12.8,6.6],[0,8.1,-3.9],['RESEARCH ATELIER','Yaxin Luo · Selected work'],{height:640});
  const titleFrame=box([13.4,1.14,.24],[0,13.59,-4.04],materials.ink,.06);titleFrame.name='exhibition-title-frame';
  const titlePlaque=face([12.95,1.01],[0,13.59,-3.9],[{text:'AutoDesign',size:88}],{width:1536,height:128,dark:true});
  const statusPlaque=face([8.8,.5],[0,3.76,-3.78],[{text:'01 / 06 · OUTPUT',size:64}],{width:1024,height:96,dark:true});
  for(const x of [-7.13,7.13])for(const y of [3.78,12.41]){
    screw([x,y,-3.81],group,.082);box([.32,.32,.035],[x,y,-3.83],materials.brass,.035);
  }
  group.children.slice(displayStart).forEach(object=>targetObject(object,'open'));

  // A useful desk: paper artifacts, a method folio, pencil cup and a brass reading lamp.
  const deskStart=group.children.length;
  box([14.4,.42,3.05],[0,3.35,3.66],materials.wood,.13);
  const deskEdge=box([14.5,.12,3.15],[0,3.58,3.66],materials.tabletop,.07);deskEdge.name='exhibition-desk-edge';
  // The scan's long grain follows V; run it along the table, without rotating shared maps.
  const tabletopUV=deskEdge.geometry.attributes.uv;
  for(let i=0;i<tabletopUV.count;i++)tabletopUV.setXY(i,tabletopUV.getY(i),-tabletopUV.getX(i));
  for(const z of [2.19,5.13])box([13.65,.042,.034],[0,3.648,z],materials.brightBrass,.012);
  for(const x of [-6.79,6.79])box([.25,.12,2.8],[x,3.605,3.66],materials.endgrain,.025);
  // The tabletop has a separate height slab so its underside and side aisles stay open.
  collider('desk',[14.5,.5,3.15],[0,3.39,3.66]);
  for(const x of [-5.72,5.72]){
    for(const z of [2.65,4.68]){
      const leg=box([.35,2.63,.35],[x,1.94,z],materials.edge,.055);leg.name='exhibition-desk-leg';box([.42,.17,.42],[x,.84,z],materials.brass,.035);
      box([.41,.16,.41],[x,3.05,z],materials.brass,.022);const pin=cylinder(.06,.38,[x,2.87,z]);pin.rotation.x=Math.PI/2;
    }
    box([.25,.34,2.47],[x,2.92,3.665],materials.wood,.04);
    beam([x,1.28,2.65],[x,2.83,4.68],.055);beam([x,1.28,4.68],[x,2.83,2.65],.055);
  }
  box([12,.18,.22],[0,1.66,4.65],materials.wood,.025);
  box([12.1,.42,.18],[0,2.98,4.92],materials.edge,.035);
  for(const x of [-5.45,-4.96,4.96,5.45]){box([.065,.11,.035],[x,2.98,5.03],materials.endgrain,.004);screw([x,2.98,5.057],group,.037);}
  for(let i=0;i<4;i++){const paper=box([3.15,.025,1.9],[-1.1+i*.025,3.681+i*.033,3.73+i*.024],materials.cream,.014);paper.rotation.y=.06-i*.025;}
  const deskPrint=target(add(new THREE.PlaneGeometry(2.95,1.78),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),[-1.04,3.827,3.8]),'open');deskPrint.rotation.x=-Math.PI/2;deskPrint.castShadow=false;deskPrint.name='exhibition-output-print';
  const folio=new THREE.Group();folio.name='exhibition-method-folio';folio.position.set(4.18,3.72,3.78);folio.rotation.y=-.13;group.add(folio);
  box([2.18,.09,2.55],[0,.005,0],materials.leather,.045,folio);box([1.99,.19,2.36],[.025,.143,0],materials.cream,.025,folio);
  for(let i=0;i<13;i++)box([2.015,.008,2.365],[.027,.054+i*.0145,0],i%3===0?materials.pageEdge:materials.cream,.003,folio);
  const spine=cylinder(.135,2.50,[-1.04,.12,0],materials.leather,folio);spine.rotation.x=Math.PI/2;
  for(const z of [-.96,-.52,.53,.97]){const band=cylinder(.149,.064,[-1.041,.12,z],materials.leather,folio);band.rotation.x=Math.PI/2;}
  const hinge=new THREE.Group();hinge.name='exhibition-folio-cover-hinge';hinge.position.set(-1.07,.315,0);folio.add(hinge);
  const cover=box([2.2,.072,2.58],[1.07,0,0],materials.leather,.035,hinge);cover.name='exhibition-folio-cover';
  for(const z of [-1.18,1.18])box([1.91,.014,.024],[1.07,.043,z],materials.brightBrass,.006,hinge);
  for(const x of [.14,2])box([.024,.014,2.34],[x,.043,0],materials.brightBrass,.006,hinge);
  for(const x of [.15,1.99])for(const z of [-1.16,1.16])box([.17,.021,.17],[x,.045,z],materials.brass,.018,hinge);
  for(let i=0;i<17;i++)for(const z of [-1.21,1.21]){const stitch=box([.040,.008,.01],[.24+i*.105,.041,z],materials.stitch,.002,hinge);stitch.rotation.y=.15;}
  const folioLabel=face([1.63,1.54],[1.07,.045,0],['METHOD','AutoDesign'],{width:640,height:720,dark:true},hinge);folioLabel.rotation.x=-Math.PI/2;folioLabel.name='exhibition-folio-cover-title';
  const insideCover=face([1.92,2.3],[1.07,-.039,0],['RESEARCH NOTES'],{width:900,height:1100},hinge);insideCover.rotation.set(Math.PI/2,0,Math.PI);insideCover.name='exhibition-folio-inside-cover';
  const pages=[];
  for(let i=0;i<5;i++){const pivot=new THREE.Group();pivot.position.set(-.965,.233+i*.009,0);folio.add(pivot);pages.push(pivot);box([1.985,.007,2.345],[.99,0,0],materials.cream,.003,pivot);}
  const readingPage=face([1.94,2.28],[.99,.006,0],['AutoDesign','METHOD NOTES'],{width:900,height:1100},pages[4]);readingPage.rotation.x=-Math.PI/2;readingPage.name='exhibition-folio-reading-page';
  box([.16,.012,.58],[.73,.057,1.39],materials.ink,.003,folio);targetObject(folio,'detail','method');
  add(new THREE.LatheGeometry([[0,0],[.20,0],[.25,.035],[.25,.55],[.21,.55],[.2,.05],[0,.05]].map(p=>new THREE.Vector2(...p)),40),materials.ink,[-5.35,3.65,4.03]);
  const cupRim=ring(.23,.015,[-5.35,4.21,4.03]);cupRim.rotation.x=Math.PI/2;
  for(let i=0;i<5;i++){const pencil=add(new THREE.CylinderGeometry(.025,.025,.85,6),i%2?materials.brass:materials.wood,[-5.5+i*.062,4.36,4.06+Math.sin(i)*.08]);pencil.rotation.z=(i-2)*.045;}
  const focusLights=[],lampBulbs=[];
  for(const x of [-6.3,6.3]){
    add(new THREE.CylinderGeometry(.42,.47,.12,24),materials.brass,[x,3.72,2.82]);
    add(new THREE.CylinderGeometry(.05,.065,1.35,12),materials.brass,[x,4.4,2.82]);
    for(const y of [3.84,4.88]){const collar=ring(.07,.022,[x,y,2.82],materials.brightBrass);collar.rotation.x=Math.PI/2;}
    const joint=cylinder(.105,.20,[x,4.98,2.82]);joint.rotation.z=Math.PI/2;
    add(new THREE.LatheGeometry([[.55,0],[.55,.035],[.47,.14],[.23,.42],[.13,.48]].map(p=>new THREE.Vector2(...p)),40),materials.ink,[x,4.94,2.82]);
    const shadeRim=ring(.55,.021,[x,4.965,2.82],materials.brightBrass);shadeRim.rotation.x=Math.PI/2;
    const bulbMaterial=new THREE.MeshBasicMaterial({color:0xffd69a,toneMapped:false});const bulb=add(new THREE.SphereGeometry(.13,16,10),bulbMaterial,[x,4.98,2.82]);bulb.name='exhibition-lamp-bulb';lampBulbs.push(bulb);
    const light=new THREE.PointLight(0xffd6a1,8,5.2,2);light.position.set(x,4.78,3.07);group.add(light);focusLights.push(light);
  }

  // A small armillary instrument gives the workbench a tactile, purposeful foreground.
  const instrument=new THREE.Group();instrument.name='exhibition-media-instrument';instrument.position.set(-3.83,3.77,3.53);group.add(instrument);
  cylinder(.52,.09,[0,0,0],materials.edge,instrument,.61);cylinder(.47,.06,[0,.066,0],materials.brass,instrument);
  for(const angle of [0,Math.PI*2/3,Math.PI*4/3])cylinder(.065,.045,[Math.cos(angle)*.38,.107,Math.sin(angle)*.38],materials.brightBrass,instrument);
  cylinder(.068,.42,[0,.3,0],materials.brass,instrument,.095);
  const cradle=ring(.61,.045,[0,1.02,0],materials.brass,instrument);cradle.rotation.z=-.25;
  const equator=ring(.70,.034,[0,1.02,0],materials.brass,instrument);equator.rotation.x=Math.PI/2;
  for(let i=0;i<72;i++){
    const a=i/72*Math.PI*2,r=.70,len=i%6===0?.108:.047;
    const tick=box([.014,.012,len],[Math.sin(a)*(r-len/2),1.06,Math.cos(a)*(r-len/2)],i%6===0?materials.brightBrass:materials.ink,.003,instrument);tick.rotation.y=a;
  }
  const gimbal=new THREE.Group();gimbal.name='exhibition-instrument-gimbal';gimbal.position.y=1.02;instrument.add(gimbal);
  const meridian=ring(.53,.026,[0,0,0],materials.brightBrass,gimbal);meridian.rotation.z=.36;
  const innerRing=ring(.44,.018,[0,0,0],materials.brass,gimbal);innerRing.rotation.set(.45,.65,0);
  add(new THREE.SphereGeometry(.19,28,20),materials.ink,[0,0,0],gimbal);
  for(const sign of [-1,1]){cylinder(.078,.11,[0,sign*.53,0],materials.brass,gimbal);const bearing=ring(.057,.012,[0,sign*.59,0],materials.brightBrass,gimbal);bearing.rotation.x=Math.PI/2;}
  beam([0,-.71,0],[0,.71,0],.024,materials.brightBrass,gimbal);
  const needle=new THREE.Group();needle.name='exhibition-instrument-media-pointer';needle.position.y=1.075;instrument.add(needle);
  const pointer=box([.027,.018,.70],[0,0,.22],materials.brightBrass,.007,needle);pointer.name='exhibition-instrument-pointer';cylinder(.065,.042,[0,0,0],materials.ink,needle);
  for(const x of [-.70,.70]){
    const knob=cylinder(.094,.11,[x,1.02,0],materials.brass,instrument);knob.rotation.z=Math.PI/2;
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;beam([x-.056,1.02+Math.cos(a)*.094,Math.sin(a)*.094],[x+.056,1.02+Math.cos(a)*.094,Math.sin(a)*.094],.006,materials.brightBrass,instrument);}
  }
  const dialLabel=face([1.32,.24],[0,.20,.54],['MEDIA INDEX'],{width:512,height:96,dark:true},instrument);dialLabel.rotation.x=-.25;

  // Separate controls for media and projects; adjacent boards are actual other works.
  for(const [x,action,label]of [[-1.2,'previousMedia','←'],[1.2,'nextMedia','→']]){
    const ring=add(new THREE.CylinderGeometry(.47,.48,.2,32),materials.brass,[x,2.53,5.43]);ring.rotation.x=Math.PI/2;
    target(ring,action);
    target(face([.66,.66],[x,2.53,5.545],[label],{width:128,height:128,dark:true}),action);
  }
  const role=new THREE.Group();role.name='exhibition-role-object';role.position.set(0,4.32,2.49);group.add(role);
  box([5.54,.095,.76],[0,-.62,.12],materials.edge,.045,role);
  for(const x of [-2.18,2.18]){beam([x,-.59,.18],[x,0,-.12],.04,materials.brass,role);beam([x,-.59,-.15],[x,0,-.12],.04,materials.brass,role);}
  const namePlateFrame=box([5.63,.92,.15],[0,0,0],materials.brass,.08,role);namePlateFrame.name='exhibition-role-plaque';
  box([5.43,.74,.06],[0,0,.082],materials.ink,.04,role);
  const namePlate=face([5.12,.64],[0,0,.119],['Yaxin Luo','Co-first author'],{width:1280,height:192,dark:true},role);
  for(const x of [-2.62,2.62])screw([x,0,.12],role,.048);targetObject(role,'detail','role');
  const deskObjects=group.children.slice(deskStart);
  const desk=new THREE.Group();desk.name='exhibition-workbench';group.add(desk);deskObjects.forEach(object=>desk.add(object));
  const boards=[];
  for(const [x,action,label]of [[-8.78,'previousProject','PREVIOUS PROJECT'],[8.78,'nextProject','NEXT PROJECT']]){
    box([.18,4.1,.25],[x,2.82,.98],materials.brass,.035);
    box([3.23,2.35,.21],[x,5.3,.96],materials.edge,.09);
    const panel=target(face([3,2.09],[x,5.3,1.08],[label,''],{width:512,height:420}),action);boards.push(panel);
    box([2,.14,1.28],[x,.92,.98],materials.edge,.08);
  }

  function applyMotion(values){
    const coverAngle=values.open*Math.PI*.94,gimbalX=.16+values.focus*.09,gimbalY=.24+values.media*.42,gimbalZ=-.23+values.open*.10,pointerAngle=-Math.PI*.72+values.media*Math.PI*1.44;
    // Only changed shadow casters invalidate cached shadows. Light intensity and
    // the non-casting status acknowledgement do not require another shadow pass.
    if(hinge.rotation.z!==coverAngle||gimbal.rotation.x!==gimbalX||gimbal.rotation.y!==gimbalY||gimbal.rotation.z!==gimbalZ||needle.rotation.y!==pointerAngle)shadowDirty=true;
    hinge.rotation.z=coverAngle;
    pages.forEach((page,i)=>{page.rotation.z=values.open*(.025+i*.017);});
    gimbal.rotation.set(gimbalX,gimbalY,gimbalZ);
    needle.rotation.y=pointerAngle;
    focusLights.forEach(light=>{light.intensity=8+values.focus*3.5+values.open*1.2;});
    lampBulbs.forEach(bulb=>bulb.material.color.setRGB(1,.66+values.focus*.05,.32));
    statusPlaque.scale.setScalar(1+values.pulse*.014);group.updateMatrixWorld(true);
  }
  batchDecoration(group,interactiveTargets);
  // Actual closed, rising and fully open meshes establish all three depth bands.
  const framingBounds=[new THREE.Box3(),new THREE.Box3(),new THREE.Box3()];
  for(const open of [0,.5,1]){
    applyMotion({focus:1,open,media:1,pulse:0});
    framingBounds[0].expandByObject(screenFrame).expandByObject(screenBacking);
    framingBounds[1].expandByObject(titleFrame).expandByObject(titlePlaque);
    framingBounds[2].expandByObject(desk);
  }
  const bounds=framingBounds.reduce((whole,part)=>whole.union(part),new THREE.Box3());applyMotion(motion.snapshot());
  const state={group,interactiveTargets,colliders,projectId:'autodesign',mediaIndex:0,lang:lang==='zh'?'zh':'en',materialsReady:surfaces.ready,materialErrors:surfaces.errors,
    camera:{fov:40,mobileFov:50,position:new THREE.Vector3(62,ground+12.9,82),target:new THREE.Vector3(62,ground+6.85,55.5),mobilePosition:new THREE.Vector3(62,ground+15.5,96),bounds,framingBounds},
    get motionState(){return motion.snapshot();},
    get shadowDirty(){return shadowDirty;},
    consumeShadowUpdate(){const changed=shadowDirty;shadowDirty=false;return !disposed&&changed;},
    setFocused(focused,{reducedMotion:reduced=reducedMotion}={}){if(disposed)return false;motion.set('focus',focused?1:0,reduced);if(reduced)applyMotion(motion.update(undefined,0,true));return true;},
    setOpen(open,{reducedMotion:reduced=reducedMotion}={}){if(disposed)return false;motion.set('open',open?1:0,reduced);if(reduced)applyMotion(motion.update(undefined,0,true));return true;},
    setProject(id){if(disposed||!getProject(id))return false;this.projectId=id;this.mediaIndex=0;refreshLabels();selectMedia();return true;},
    setMedia(index){if(disposed)return this.mediaIndex;this.mediaIndex=clampMedia(this.projectId,index);selectMedia();return this.mediaIndex;},
    setLanguage(language){if(disposed)return false;this.lang=language==='zh'?'zh':'en';refreshLabels();return true;},
    update(time,dt,reduced=false){if(disposed)return;reducedMotion=reduced;applyMotion(motion.update(time,dt,reduced));},
    dispose(){
      if(disposed)return;disposed=true;shadowDirty=false;selection.invalidate();scene.remove(group);surfaces.dispose();
      const geometries=new Set(),localMaterials=new Set();group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])if(!Object.values(materials).includes(material))localMaterials.add(material);});
      geometries.forEach(geometry=>geometry.dispose());localMaterials.forEach(material=>material.dispose());disposables.forEach(texture=>texture.dispose());disposables.clear();
    },
  };
  const selection=new MediaSelection(async src=>{const texture=await (loadMedia?loadMedia(src):new THREE.TextureLoader().loadAsync(src));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;own(texture);return texture;},texture=>{
    if(disposed)return;const ratio=texture.image.width/texture.image.height,w=Math.min(14.12,8.3*ratio),h=w/ratio;
    screen.scale.set(w,h,1);screen.material.map=texture;screen.material.needsUpdate=true;screen.visible=true;emptyScreen.visible=false;
    deskPrint.visible=true;deskPrint.scale.set(Math.min(1,1.78*ratio/2.95),Math.min(1,2.95/ratio/1.78),1);deskPrint.material.map=texture;deskPrint.material.needsUpdate=true;state.loadedSource=getProjectMedia(state.projectId,state.mediaIndex)?.src;
    motion.loaded(reducedMotion);setStatus();
  });
  function refreshLabels(){
    const p=getProject(state.projectId),index=selectedProjects.indexOf(p),l=state.lang;
    updateFace(titlePlaque,[{text:p.shortTitle[l],size:88}],{width:1536,height:128,dark:true});
    updateFace(namePlate,[{text:'Yaxin Luo',size:55},{text:p.role[l],size:48}],{width:1280,height:192,dark:true});
    updateFace(folioLabel,[{text:l==='zh'?'研究方法':'METHOD',size:84},{text:p.shortTitle[l],size:58},{text:String(p.year),size:40}],{width:640,height:720,dark:true});
    replaceMap(readingPage,methodPage(p,l));
    updateFace(insideCover,[{text:l==='zh'?'研究档案':'RESEARCH FILE',size:54},{text:p.shortTitle[l],size:72},{text:p.category[l],size:46},{text:l==='zh'?'点击阅读方法与来源':'Read method & sources',size:40}],{width:900,height:1100});
    updateFace(dialLabel,[{text:l==='zh'?'媒体索引':'MEDIA INDEX',size:48}],{width:512,height:96,dark:true});
    const neighbours=[selectedProjects[(index-1+selectedProjects.length)%selectedProjects.length],selectedProjects[(index+1)%selectedProjects.length]];
    boards.forEach((board,i)=>updateFace(board,[{text:l==='zh'?(i?'下一项 →':'← 上一项'):(i?'NEXT →':'← PREVIOUS'),size:30},{text:neighbours[i].shortTitle[l],size:78},{text:String(neighbours[i].year),size:36}],{width:640,height:340}));
    if(!p.media.length)updateFace(emptyScreen,[p.shortTitle[l],l==='zh'?'研究条目 · 查看论文与代码':'Research record · Paper & code'],{height:640});
    for(const mesh of interactiveTargets){mesh.userData.exhibition.projectId=state.projectId;mesh.userData.exhibition.mediaIndex=state.mediaIndex;}
    setStatus();
  }
  function setStatus(message){const p=getProject(state.projectId),media=getProjectMedia(p.id,state.mediaIndex),l=state.lang,kind=media?({output:{en:'OUTPUT',zh:'产物'},method:{en:'METHOD',zh:'方法'},process:{en:'PROCESS',zh:'过程'}})[media.kind][l]:{en:'PAPER & CODE',zh:'论文与代码'}[l];updateFace(statusPlaque,[{text:message||`${media?`${String(state.mediaIndex+1).padStart(2,'0')} / ${String(p.media.length).padStart(2,'0')} · `:''}${kind} · ${p.year}`,size:64}],{width:1024,height:96,dark:true});}
  async function selectMedia(){
    const p=getProject(state.projectId),media=getProjectMedia(state.projectId,state.mediaIndex);motion.media(state.mediaIndex,p.media.length,reducedMotion);
    for(const mesh of interactiveTargets)mesh.userData.exhibition.mediaIndex=state.mediaIndex;
    if(!media){selection.invalidate();screen.visible=false;deskPrint.visible=false;emptyScreen.visible=true;state.loadedSource=null;setStatus();return;}
    if(!loadMedia&&typeof document==='undefined')return;
    setStatus(state.lang==='zh'?'正在载入图像 · 下方可直接阅读':'Loading image · Read the project below');
    const complete=await selection.select(media.src);
    if(!disposed&&!complete&&selection.error)setStatus(state.lang==='zh'?'保留上一张图像 · 当前图像请查看来源':'Previous image retained · View current image at its source');
  }
  refreshLabels();selectMedia();return state;
}
