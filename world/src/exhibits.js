import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {getProject, getProjectMedia, selectedProjects} from './exhibition-content.js';
import {clampMedia, MediaSelection} from './exhibition-state.js';

const palette={wood:0x675147,edge:0x423c3b,brass:0xbca06b,stone:0x999c97,ink:0x233f4c,cream:0xf1e8d3,leather:0x486a77};
function lettering(lines,{width=1024,height=256,dark=false}={}){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.fillStyle=dark?'#243e49':'#eee5d0';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle=dark?'#b89d694d':'#9b825a75';ctx.lineWidth=2;ctx.strokeRect(14,14,width-28,height-28);
  const lineHeight=height/(lines.length+1);
  lines.forEach((line,i)=>{const text=typeof line==='string'?line:line.text;let size=(typeof line==='string'?null:line.size)||Math.min(72,lineHeight*.58);ctx.font=`${i===0?'500':'400'} ${size}px Georgia,"Songti SC","PingFang SC",serif`;while(ctx.measureText(text).width>width-70&&size>20){size-=2;ctx.font=`${size}px Georgia,"Songti SC","PingFang SC",serif`;}ctx.fillStyle=dark?(i===0?'#f2e7cf':'#c7b68e'):(i===0?'#29434a':'#766951');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,lineHeight*(i+1));});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

/** A physical portfolio scene. Long-form reading stays in accessible HTML. */
export function createExhibitionStage(scene,heightAt,{lang='en'}={}){
  const group=new THREE.Group();group.name='research-atelier-exhibition';const ground=heightAt(62,57);group.position.set(62,ground+.13,57);scene.add(group);
  const interactiveTargets=[],colliders=[],disposables=new Set(),materials={};let disposed=false;
  for(const [key,color]of Object.entries(palette))materials[key]=new THREE.MeshStandardMaterial({color,roughness:key==='brass'?.34:.72,metalness:key==='brass'?.62:0});
  const add=(geometry,material,position,parent=group)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const box=(size,position,material=materials.wood,radius=.07,parent=group)=>add(new RoundedBoxGeometry(...size,2,radius),material,position,parent);
  const collider=(name,[width,height,depth],[x,y,z])=>{
    x+=group.position.x;y+=group.position.y;z+=group.position.z;
    const bottom=y-height/2,top=y+height/2;
    colliders.push({id:`exhibition/${name}`,buildingId:'exhibition',bottom,top,planes:[[1,0,0,x+width/2],[-1,0,0,-x+width/2],[0,0,1,z+depth/2],[0,0,-1,-z+depth/2],[0,-1,0,-bottom],[0,1,0,top]]});
  };
  const solidBox=(name,size,position,material,radius)=>{collider(name,size,position);return box(size,position,material,radius);};
  const target=(mesh,action)=>{mesh.userData.exhibition={action};interactiveTargets.push(mesh);return mesh;};
  const face=(size,position,lines,options={})=>{
    const map=lettering(lines,options);if(map)disposables.add(map);
    const material=new THREE.MeshBasicMaterial({map,color:map?0xffffff:palette.cream,toneMapped:false});
    const mesh=add(new THREE.PlaneGeometry(...size),material,position);mesh.castShadow=false;return mesh;
  };
  const updateFace=(mesh,lines,options={})=>{const old=mesh.material.map;const map=lettering(lines,options);mesh.material.map=map;mesh.material.needsUpdate=true;if(map)disposables.add(map);if(old){old.dispose();disposables.delete(old);}};

  // The broad planes, dark frame and warm edges give the media a quiet backdrop.
  solidBox('platform-base',[21.5,.34,12.6],[0,.17,.4],materials.stone,.15);
  solidBox('platform-upper',[20.6,.34,11.8],[0,.47,.3],materials.edge,.12);
  for(let i=0;i<13;i++)box([1.53,.14,11.35],[-9.2+i*1.535,.71,.3],i%3===0?materials.edge:materials.wood,.02);
  collider('platform-deck',[19.95,.14,11.35],[.01,.71,.3]);
  solidBox('platform-step-low',[14.4,.2,1.05],[0,.18,7],materials.stone,.09);solidBox('platform-step-high',[12.8,.19,.7],[0,.48,6.55],materials.stone,.07);
  for(const x of [-7.48,7.48]){
    box([.48,12.7,.66],[x,7,-4.42],materials.edge,.09);
    box([.76,.28,.92],[x,1.15,-4.42],materials.brass,.07);
    box([.7,.26,.84],[x,13.44,-4.42],materials.brass,.06);
    box([.12,10.75,.09],[x,7.35,-4.03],materials.brass,.02);
  }
  const screenFrame=box([15.6,9.7,.52],[0,8.1,-4.47],materials.edge,.2);screenFrame.name='exhibition-screen-frame';
  box([15.24,9.36,.13],[0,8.1,-4.16],materials.brass,.08);
  box([14.87,9.01,.15],[0,8.1,-4.04],materials.ink,.06);
  collider('screen',[15.6,9.7,.83],[0,8.1,-4.315]);
  const screenBacking=add(new THREE.PlaneGeometry(14.38,8.51),new THREE.MeshBasicMaterial({color:0xf4f0e6,toneMapped:false}),[0,8.1,-3.95]);screenBacking.castShadow=false;
  const screen=target(add(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),[0,8.1,-3.925]),'open');screen.visible=false;screen.castShadow=false;screen.name='exhibition-current-media';
  const emptyScreen=face([12.8,6.6],[0,8.1,-3.9],['RESEARCH ATELIER','Yaxin Luo · Selected work'],{height:640});
  const titleFrame=box([13.4,1.14,.24],[0,13.59,-4.04],materials.ink,.06);titleFrame.name='exhibition-title-frame';
  const titlePlaque=face([12.95,1.01],[0,13.59,-3.9],[{text:'AutoDesign',size:88}],{width:1536,height:128,dark:true});
  const statusPlaque=face([8.8,.5],[0,3.76,-3.78],[{text:'01 / 06 · OUTPUT',size:64}],{width:1024,height:96,dark:true});
  for(const x of [-7.13,7.13])for(const y of [3.78,12.41]){
    const pin=add(new THREE.CylinderGeometry(.095,.095,.035,12),materials.brass,[x,y,-3.81]);pin.rotation.x=Math.PI/2;
  }

  // A useful desk: paper artifacts, a method folio, pencil cup and a brass reading lamp.
  const deskStart=group.children.length;
  box([14.4,.42,3.05],[0,3.35,3.66],materials.wood,.13);
  const deskEdge=box([14.5,.12,3.15],[0,3.58,3.66],materials.edge,.07);deskEdge.name='exhibition-desk-edge';
  // The tabletop has a separate height slab so its underside and side aisles stay open.
  collider('desk',[14.5,.5,3.15],[0,3.39,3.66]);
  for(const x of [-5.72,5.72])for(const z of [2.65,4.68]){const leg=box([.35,2.63,.35],[x,1.94,z],materials.edge,.055);leg.name='exhibition-desk-leg';box([.42,.17,.42],[x,.84,z],materials.brass,.035);}
  box([12,.18,.22],[0,1.66,4.65],materials.wood,.025);
  for(let i=0;i<4;i++){const paper=box([3.15,.025,1.9],[-1.1+i*.025,3.681+i*.033,3.73+i*.024],materials.cream,.014);paper.rotation.y=.06-i*.025;}
  const deskPrint=target(add(new THREE.PlaneGeometry(2.95,1.78),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),[-1.04,3.827,3.8]),'detail');deskPrint.rotation.x=-Math.PI/2;deskPrint.castShadow=false;
  const folio=new THREE.Group();folio.position.set(3.35,3.76,3.76);folio.rotation.y=-.15;group.add(folio);
  box([2.18,.22,2.55],[0,.03,0],materials.leather,.075,folio);box([1.99,.15,2.35],[.015,.155,0],materials.cream,.035,folio);box([2.2,.07,2.58],[0,.275,0],materials.leather,.025,folio);
  const folioTexture=lettering(['METHOD','Yaxin Luo'],{width:512,height:640,dark:true});if(folioTexture)disposables.add(folioTexture);
  const folioLabel=target(add(new THREE.PlaneGeometry(1.78,2.05),new THREE.MeshBasicMaterial({map:folioTexture,color:0xffffff,toneMapped:false}),[0,.317,0],folio),'detail');folioLabel.rotation.x=-Math.PI/2;folioLabel.castShadow=false;
  const cup=add(new THREE.CylinderGeometry(.25,.23,.56,16),materials.ink,[-5.36,3.93,4.06]);
  for(let i=0;i<5;i++){const pencil=add(new THREE.CylinderGeometry(.025,.025,.85,6),i%2?materials.brass:materials.wood,[-5.5+i*.062,4.36,4.06+Math.sin(i)*.08]);pencil.rotation.z=(i-2)*.045;}
  for(const x of [-6.3,6.3]){
    add(new THREE.CylinderGeometry(.42,.47,.12,24),materials.brass,[x,3.72,2.82]);
    add(new THREE.CylinderGeometry(.05,.065,1.35,12),materials.brass,[x,4.4,2.82]);
    const shade=add(new THREE.ConeGeometry(.55,.53,20,1,true),materials.ink,[x,5.15,2.82]);
    const bulbMaterial=new THREE.MeshBasicMaterial({color:0xffd69a,toneMapped:false});add(new THREE.SphereGeometry(.13,12,8),bulbMaterial,[x,4.91,2.82]);
    const light=new THREE.PointLight(0xffd6a1,11,5,2);light.position.set(x,4.78,3.05);group.add(light);
  }

  // A small armillary instrument gives the workbench a tactile, purposeful foreground.
  const instrument=new THREE.Group();instrument.name='Atelier brass armillary';instrument.position.set(-3.65,3.72,3.68);group.add(instrument);
  add(new THREE.CylinderGeometry(.46,.55,.12,24),materials.brass,[0,0,0],instrument);
  add(new THREE.CylinderGeometry(.055,.085,.5,12),materials.brass,[0,.3,0],instrument);
  for(const [rx,rz,r]of [[Math.PI/2,0,.62],[.35,.36,.59],[-.36,1.1,.55]]){const ring=add(new THREE.TorusGeometry(r,.026,8,48),materials.brass,[0,.99,0],instrument);ring.rotation.set(rx,0,rz);}
  add(new THREE.SphereGeometry(.19,18,12),materials.ink,[0,.99,0],instrument);
  const axis=add(new THREE.CylinderGeometry(.027,.027,1.52,8),materials.brass,[0,1,0],instrument);axis.rotation.z=-.3;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const tick=add(new THREE.BoxGeometry(.035,.035,.13),materials.brass,[Math.cos(a)*.62,.99,Math.sin(a)*.62],instrument);tick.rotation.y=-a;}

  // Separate controls for media and projects; adjacent boards are actual other works.
  for(const [x,action,label]of [[-1.2,'previousMedia','←'],[1.2,'nextMedia','→']]){
    const ring=add(new THREE.CylinderGeometry(.47,.48,.2,32),materials.brass,[x,2.53,5.43]);ring.rotation.x=Math.PI/2;
    target(face([.66,.66],[x,2.53,5.545],[label],{width:128,height:128,dark:true}),action);
  }
  const namePlate=face([6.2,.87],[0,4.52,2.58],[{text:'Yaxin Luo · Co-first author',size:76}],{width:1024,height:144});target(namePlate,'detail');
  const deskObjects=group.children.slice(deskStart);
  const boards=[];
  for(const [x,action,label]of [[-8.78,'previousProject','PREVIOUS PROJECT'],[8.78,'nextProject','NEXT PROJECT']]){
    box([.18,4.1,.25],[x,2.82,.98],materials.brass,.035);
    box([3.23,2.35,.21],[x,5.3,.96],materials.edge,.09);
    const panel=target(face([3,2.09],[x,5.3,1.08],[label,''],{width:512,height:420}),action);boards.push(panel);
    box([2,.14,1.28],[x,.92,.98],materials.edge,.08);
  }

  // World-space content bounds follow the actual geometry, including the desk
  // feet and nearer front edge. Separate parts avoid framing empty box corners
  // above the desk as though they belonged to the title at the back of the stage.
  group.updateWorldMatrix(true,true);
  const framingBounds=[[screenFrame,screenBacking],[titleFrame,titlePlaque],deskObjects].map(objects=>objects.reduce((bounds,object)=>bounds.expandByObject(object),new THREE.Box3()));
  const bounds=framingBounds.reduce((whole,part)=>whole.union(part),new THREE.Box3());
  const state={group,interactiveTargets,colliders,projectId:'autodesign',mediaIndex:0,lang,
    camera:{fov:40,mobileFov:50,position:new THREE.Vector3(62,ground+12.9,82),target:new THREE.Vector3(62,ground+6.85,55.5),mobilePosition:new THREE.Vector3(62,ground+15.5,96),bounds,framingBounds},
    setProject(id){const project=getProject(id);if(!project)return false;this.projectId=id;this.mediaIndex=0;refreshLabels();selectMedia();return true;},
    setMedia(index){this.mediaIndex=clampMedia(this.projectId,index);selectMedia();return this.mediaIndex;},
    setLanguage(language){this.lang=language==='zh'?'zh':'en';refreshLabels();},
    update(){},
    dispose(){if(disposed)return;disposed=true;selection.invalidate();scene.remove(group);group.traverse(object=>{object.geometry?.dispose();if(object.material){for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});for(const texture of disposables)texture.dispose();},
  };
  const selection=new MediaSelection(async src=>{const texture=await new THREE.TextureLoader().loadAsync(src);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;disposables.add(texture);if(disposed)texture.dispose();return texture;},texture=>{
    if(disposed)return;const ratio=texture.image.width/texture.image.height,w=Math.min(14.12,8.3*ratio),h=w/ratio;
    screen.scale.set(w,h,1);screen.material.map=texture;screen.material.needsUpdate=true;screen.visible=true;emptyScreen.visible=false;
    deskPrint.visible=true;deskPrint.scale.set(Math.min(1,1.78*ratio/2.95),Math.min(1,2.95/ratio/1.78),1);deskPrint.material.map=texture;deskPrint.material.needsUpdate=true;state.loadedSource=getProjectMedia(state.projectId,state.mediaIndex)?.src;
    setStatus();
  });
  function refreshLabels(){
    const p=getProject(state.projectId),index=selectedProjects.indexOf(p),l=state.lang;
    updateFace(titlePlaque,[{text:p.shortTitle[l],size:88}],{width:1536,height:128,dark:true});
    updateFace(namePlate,[{text:`Yaxin Luo · ${p.role[l]}`,size:76}],{width:1024,height:144});
    const neighbours=[selectedProjects[(index-1+selectedProjects.length)%selectedProjects.length],selectedProjects[(index+1)%selectedProjects.length]];
    boards.forEach((board,i)=>updateFace(board,[{text:l==='zh'?(i?'下一项 →':'← 上一项'):(i?'NEXT →':'← PREVIOUS'),size:30},{text:neighbours[i].shortTitle[l],size:78},{text:String(neighbours[i].year),size:36}],{width:640,height:340}));
    setStatus();
  }
  function setStatus(message){const p=getProject(state.projectId),media=getProjectMedia(p.id,state.mediaIndex),l=state.lang,kind=media?({output:{en:'OUTPUT',zh:'产物'},method:{en:'METHOD',zh:'方法'},process:{en:'PROCESS',zh:'过程'}})[media.kind][l]:{en:'PAPER & CODE',zh:'论文与代码'}[l];updateFace(statusPlaque,[{text:message||`${media?`${String(state.mediaIndex+1).padStart(2,'0')} / ${String(p.media.length).padStart(2,'0')} · `:''}${kind} · ${p.year}`,size:64}],{width:1024,height:96,dark:true});}
  async function selectMedia(){
    const media=getProjectMedia(state.projectId,state.mediaIndex);
    if(!media){selection.invalidate();screen.visible=false;deskPrint.visible=false;emptyScreen.visible=true;updateFace(emptyScreen,[getProject(state.projectId).shortTitle[state.lang],state.lang==='zh'?'研究条目 · 查看论文与代码':'Research record · Paper & code'],{height:640});setStatus();return;}
    if(typeof document==='undefined')return;
    setStatus(state.lang==='zh'?'正在载入图像 · 下方可直接阅读':'Loading image · Read the project below');
    const complete=await selection.select(media.src);
    if(!complete&&selection.error)setStatus(state.lang==='zh'?'保留上一张图像 · 当前图像请查看来源':'Previous image retained · View current image at its source');
  }
  refreshLabels();selectMedia();return state;
}
