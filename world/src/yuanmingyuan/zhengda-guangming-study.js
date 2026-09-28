import * as THREE from 'three';
import {paintedBeam} from './hanjingtang-architecture.js';
import {bracketArmGeometry} from './chinese-architecture-geometry.js';
import {jiuzhouRoofSectionPoint} from './jiuzhou-roof-geometry.js';
import {ZHENGDA_GUANGMING_ID,zhengdaGuangmingLayout as L,zhengdaColumnXs,zhengdaBayCenters} from './zhengda-guangming-layout.js';
import {ZhengdaBuilder,part,zhengdaSparrowBrace,createZhengdaRoof,zhengdaRoofProfile} from './zhengda-guangming-geometry.js';
import {prepareZhengdaGuangmingFinishes} from './zhengda-guangming-materials.js';
import {buildZhengdaCenserR2 as buildZhengdaCenser,prepareZhengdaCenserR2Finishes} from './zhengda-censer.js';

const F=L.platform.height,shaftBottom=F+L.columns.baseHeight;
function platformRectangle(b,parent,name,{width,depth,centerZ=0,height=F,rearFace=true}){
 const g=part(parent,name,{body:'dressed-stone-platform-and-separate-grey-pavers',width,depth,height,dimensionAuthority:name.includes('moon')?'undated-park-reference':'authored-axis-margin'});
 g.position.z=centerZ;
 b.box(g,b.m.foundation,[0,(height-.16)/2-.04,0],[width-.06,height+.08,depth-.06]);
 for(const[y,h,w,d]of [[.12,.24,width+.08,depth+.08],[height-.20,.12,width-.02,depth-.02],[height-.085,.11,width+.04,depth+.04]])
  b.box(g,b.m.stone,[0,y,0],[w,h,d]);
 // Continuous mortar bed supports the narrow 7 mm joints, 6 mm below paving.
 b.box(g,b.m.pavingShade,[0,height-.040,0],[width-.018,.068,depth-.018]);
 const nx=Math.ceil(width/.66),nz=Math.ceil(depth/.82),sx=width/nx,sz=depth/nz;
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)
  b.box(g,(i*13+j*11)%29===0?b.m.pavingShade:b.m.paving,[-width/2+(i+.5)*sx,height-.019,-depth/2+(j+.5)*sz],[sx-.007,.038,sz-.007]);
 for(const face of [0,1,2,3]){
  if(face===2&&!rearFace)continue;
  const angle=face*Math.PI/2,span=face%2?depth:width,half=(face%2?width:depth)/2,n=[Math.sin(angle),Math.cos(angle)],t=[Math.cos(angle),-Math.sin(angle)];
  for(let row=0;row<3;row++)for(let x=-span/2-(row%2)*.52;x<span/2;x+=1.04){
   const a=Math.max(-span/2,x+.004),c=Math.min(span/2,x+1.032);if(c-a<.015)continue;
   b.box(g,b.m.stone,[t[0]*(a+c)/2+n[0]*(half+.018),.33+row*.245,t[1]*(a+c)/2+n[1]*(half+.018)],[c-a,.234,.07],[0,angle,0]);
  }
 }
 return g;
}
function stairs(b,parent,name,{x=0,z,width,angle=0,run=2.68}){
 const g=part(parent,name,{body:'eight-solid-stone-treads',risers:8,stepRise:F/8,run,authoredStepCount:true});g.position.set(x,0,z);g.rotation.y=angle;
 for(let i=0;i<8;i++){
  const top=F*(i+1)/8,d=run/8;
  b.box(g,b.m.stone,[0,(top-.05)/2,run-(i+.5)*d],[width,top+.05,d+.009]);
  b.box(g,b.m.carving,[0,top-.023,run-i*d-.028],[width+.018,.046,.075]);
  for(const side of [-1,1])b.box(g,b.m.stone,[side*(width/2+.16),(top+.10)/2,run-(i+.5)*d],[.30,top+.10,d+.012]);
 }
 return g;
}
function column(b,parent,x,z,kind,i){
 const c=L.columns,h=kind==='eave'?c.eaveWoodHeight:c.innerWoodHeight,r=(kind==='eave'?c.eaveDiameter:c.innerDiameter)/2;
 const g=part(parent,'zhengda-'+kind+'-column-'+i,{body:'measurable-column-and-base',kind,x,z,woodHeight:h,woodBottomY:shaftBottom,woodTopY:shaftBottom+h,diameter:r*2,dimensionAuthority:kind==='eave'?'Fig5-16chi-woodheight-with-authored-base-endpoints':'authored-inner-column'});
 b.box(g,b.m.stone,[x,F+.04,z],[c.baseSquare,.08,c.baseSquare]);
 b.lathe(g,b.m.carving,[[0,.07],[.41,.07],[.405,.108],[.35,.138],[.32,.205],[r*1.12,c.baseHeight],[0,c.baseHeight]],[x,F,z],80);
 const wood=part(g,g.name+'-shaft',{body:'actual-wood-shaft',height:h});
 b.lathe(wood,b.m.red,[[0,0],[r,0],[r*.997,h*.18],[r*.979,h*.59],[r*.953,h],[0,h]],[x,shaftBottom,z],80);
 b.lathe(g,b.m.darkWood,[[0,0],[r*1.014,0],[r*1.014,.028],[0,.028]],[x,shaftBottom,z],64);
 return g;
}
function bracket(b,parent,x,z,y,angle=0,kind='column'){
 const g=part(parent,'zhengda-dougong-'+parent.children.length,{body:'interlocking-tiered-bracket',assembly:'authored one-qiao/two-ang comparison',dimensionAuthority:'cross-period-technique-not-pre1860-doukou',kind,x,z,baseY:y,mergeIntoParent:true});
 g.position.set(x,y,z);g.rotation.y=angle;
 const arm=(name,l,thick,depth,pos,rot=0,mat=b.m.green)=>b.add(g,b.prototype(name,()=>bracketArmGeometry(l,thick,depth)),mat,pos,undefined,[0,rot,0]);
 b.box(g,b.m.green,[0,.08,0],[.42,.16,.42]);
 arm('zhengda-lower-qiao',.98,.19,.22,[0,.23,0]);
 for(const sx of [-1,1]){
  b.box(g,b.m.pale,[sx*.33,.35,0],[.20,.13,.25]);
  arm('zhengda-cross-arm',1.12,.18,.20,[sx*.33,.48,.16],Math.PI/2,b.m.blue);
  b.box(g,b.m.green,[sx*.33,.595,.56],[.22,.13,.26]);
 }
 arm('zhengda-upper-bearing-arm',1.58,.19,.24,[0,.705,.56]);
 b.box(g,b.m.pale,[0,.845,.56],[.38,.15,.31]);
 // Two real diagonal ang meet the lower central seat and projected blocks.
 for(const offset of [-.115,.115])b.rod(g,b.m.red,[offset,.20,-.20],[offset,.805,.80],.066,24);
 for(const face of [-1,1])for(const[len,cy,cz]of [[.98,.23,0],[1.58,.705,.56]]){
  const pts=[[-len*.44,cy+.043,cz+face*.127],[-len*.34,cy-.031,cz+face*.127],[0,cy-.064,cz+face*.127],[len*.34,cy-.031,cz+face*.127],[len*.44,cy+.043,cz+face*.127]];
  b.tube(g,b.m.gold,pts,.0085,28,10);
 }
 return g;
}
function wall(b,parent,name,center,length,rotation=0,height=5.48){
 const g=part(parent,name,{body:'closed-masonry-wall-without-extra-openings'});g.position.set(center[0],F,center[1]);g.rotation.y=rotation;
 b.box(g,b.m.brick,[0,.53,0],[length,1.06,.34]);
 for(const face of [-1,1])for(let row=0;row<11;row++)for(let x=-length/2-(row%2)*.14;x<length/2;x+=.28){
  const a=Math.max(-length/2,x),c=Math.min(length/2,x+.273);if(c-a<.01)continue;
  b.box(g,b.m.brick,[(a+c)/2,.055+row*.088,face*.178],[c-a,.081,.03]);
 }
 b.box(g,b.m.wallRed,[0,(height+1.06)/2,0],[length,height-1.06,.35]);
 b.box(g,b.m.stone,[0,1.035,0],[length,.075,.39]);
 return g;
}
function latticeLeaf(b,parent,name,{hingeX,z,width,height,rotation=0,dir=1}){
 const g=part(parent,name,{body:'four-part-timber-lattice-leaf',displayOpeningDegrees:THREE.MathUtils.radToDeg(rotation),originalPatternRecovered:false});g.position.set(hingeX,F+L.doors.threshold,z);g.rotation.y=rotation;
 const cx=dir*width/2,frame=.075;
 for(const x of [0,dir*width])b.box(g,b.m.red,[x,height/2,0],[frame,height,.14]);
 for(const y of [.05,1.13,1.43,height-.05])b.box(g,b.m.red,[cx,y,0],[width,.095,.155]);
 b.box(g,b.m.door,[cx,.59,0],[width-.075,1.05,.070]);
 for(const face of [-1,1]){
  for(const y of [.18,.99])b.box(g,b.m.gold,[cx,y,face*.041],[width-.18,.012,.012]);
  for(const x of [dir*.11,dir*(width-.11)])b.box(g,b.m.gold,[x,.585,face*.041],[.012,.82,.012]);
  const hw=(width-.22)/2,hh=.29;
  b.tube(g,b.m.pale,[[cx-hw,.58,face*.048],[cx,.58-hh,face*.048],[cx+hw,.58,face*.048],[cx,.58+hh,face*.048],[cx-hw,.58,face*.048]],.010,32,8);
 }
 const low=1.49,high=height-.14,nx=3,ny=8,sx=(width-.16)/nx,sy=(high-low)/ny;
 // Each brocade motif is assembled from real narrow timber with open holes.
 for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
  const mx=dir*(.08+(col+.5)*sx),my=low+(row+.5)*sy,rx=sx*.38,ry=sy*.38;
  for(const xx of [-rx,rx])b.box(g,b.m.darkWood,[mx+xx,my,0],[.022,ry*2,.061]);
  for(const yy of [-ry,ry])b.box(g,b.m.darkWood,[mx,my+yy,0],[rx*2,.022,.061]);
  b.box(g,b.m.red,[mx,my,0],[.020,sy,.067]);
  b.box(g,b.m.red,[mx,my,0],[sx,.020,.067]);
 }
 b.rod(g,b.m.iron,[0,-.025,0],[0,height+.025,0],.026,24);
 for(const y of [.35,height-.32])b.add(g,b.prototype('zhengda-hinge',()=>new THREE.CylinderGeometry(.045,.045,.12,32)),b.m.iron,[0,y,0]);
 const ringX=dir*(width-.17),ringY=1.28;
 for(const face of [-1,1]){b.box(g,b.m.bronze,[ringX,ringY,face*.084],[.11,.17,.025]);b.add(g,b.prototype('zhengda-door-pull',()=>new THREE.TorusGeometry(.064,.010,12,32)),b.m.bronze,[ringX,ringY-.055,face*.11]);}
 return g;
}
function doors(b,parent,bay,rear=false){
 const xs=zhengdaColumnXs(),cx=(xs[bay]+xs[bay+1])/2,span=L.grid.bayWidths[bay]-.60,z=rear?L.grid.rearEaveZ:L.grid.frontGoldZ,h=L.doors.height,w=(span-.055)/4;
 const g=part(parent,'zhengda-'+(rear?'north':'south')+'-four-leaf-bay-'+bay,{body:'documented-four-leaf-bay',bay,leaves:4,z,line:rear?'rear-eave':'south-gold-column'});
 for(const side of [-1,1])b.box(g,b.m.red,[cx+side*(span/2+.035),F+h/2+.15,z],[.14,h+.30,.21]);
 b.box(g,b.m.darkWood,[cx,F+.045,z],[span+.2,.09,.34]);
 const top=rear?shaftBottom+L.columns.eaveWoodHeight-.29:shaftBottom+L.columns.innerWoodHeight-.29;
 b.box(g,b.m.red,[cx,F+h+.17,z],[span+.20,.19,.24]);
 const transomLow=F+h+.29,transomHigh=top-.17;
 if(transomHigh>transomLow){
  for(let i=0;i<Math.ceil(span/.24);i++)b.box(g,b.m.green,[cx-span/2+(i+.5)*span/Math.ceil(span/.24),(transomLow+transomHigh)/2,z],[.034,transomHigh-transomLow,.085]);
  for(const y of [transomLow,transomHigh])b.box(g,b.m.red,[cx,y,z],[span,.084,.17]);
 }
 for(let k=0;k<4;k++){
  const left=cx-span/2+k*(span/4),right=left+w,dir=k<2?1:-1;
  const open=bay===3&&(k===1||k===2),rotation=open?(k===1?-.94:.94)*(rear?-1:1):0;
  latticeLeaf(b,g,g.name+'-leaf-'+k,{hingeX:dir>0?left:right,z,width:w,height:h,rotation,dir});
 }
 return g;
}
function frontPlaque(b,parent){
 const g=part(parent,'zhengda-front-plaque',{body:'modern-right-to-left-name-transcription',text:'正大光明',historicalCalligraphy:false,mergeIntoParent:true});
 const y=6.13,z=L.grid.frontEaveZ+.29;
 b.box(g,b.m.darkWood,[0,y,z],[4.66,.96,.18]);
 b.box(g,b.m.gold,[0,y,z+.101],[4.54,.86,.031]);
 b.add(g,new THREE.PlaneGeometry(4.42,.79),b.m.plaque,[0,y,z+.122],undefined,undefined,true);
 for(const x of [-2.33,2.33])b.box(g,b.m.darkWood,[x,y,z+.13],[.075,1.00,.09]);
}
export function buildZhengdaTimber(b,parent,roof){
 const g=part(parent,'zhengda-complete-authored-roof-frame',{body:'structurally-fitted-timber-frame',historicalSurvey:false,purlinCount:10,crossPeriodReferenceOnly:true});
 const xs=zhengdaColumnXs(),tiesTop=shaftBottom+L.columns.innerWoodHeight+.07;
 for(const x of xs)b.box(g,b.m.red,[x,tiesTop,0],[.29,.30,16.0]);
 const high=roof.upperHalf-.19,purlins=[];
 for(const z of L.roof.purlinZ){
  const hipHalf=roof.fullHalf-(roof.fullHalf-roof.upperHalf)*(roof.halfDepth-Math.abs(z))/(roof.halfDepth-roof.breakZ);
  const half=Math.abs(z)<=roof.breakZ?high:Math.min(L.grid.eaveX+.08,hipHalf-.24),y=jiuzhouRoofSectionPoint(roof.section,z).y-.37;
  b.rod(g,b.m.red,[-half,y,z],[half,y,z],L.roof.purlinDiameter/2,48);purlins.push({z,y,halfLength:half});
  for(const x of xs){
   const end=Math.abs(x)<=half?y-L.roof.purlinDiameter/2:roof.skinY(x,z)-.55;
   if(end>tiesTop+.1)b.box(g,b.m.red,[x,(tiesTop+.12+end)/2,z],[.19,end-tiesTop-.12,.23]);
  }
 }
 // The raised gable ends bear on explicit trimmers between the final two structural axes.
 for(const side of [-1,1])for(const z of L.roof.purlinZ.filter(z=>Math.abs(z)<=roof.breakZ)){
  const x=side*(roof.upperHalf-.42),innerX=side*Math.abs(xs.at(-2)),outerX=side*Math.abs(xs.at(-1));
  b.box(g,b.m.red,[(innerX+outerX)/2,tiesTop,z],[Math.abs(outerX-innerX)+.16,.30,.28]);
  const top=jiuzhouRoofSectionPoint(roof.section,z).y-.51,bottom=tiesTop+.12;
  if(top>bottom)b.box(g,b.m.red,[x,(bottom+top)/2,z],[.20,top-bottom,.23]);
 }
 for(const side of [-1,1]){
  const x=side*L.grid.eaveX,points=Array.from({length:65},(_,i)=>{const z=-8.05+16.10*i/64;return[x,roof.skinY(x,z)-.39,z];});
  b.tube(g,b.m.red,points,.13,96,32);
  for(const z of [-6.08,-3.04,0,3.04,6.08]){
   const low=shaftBottom+L.columns.eaveWoodHeight+.68,highY=roof.skinY(x,z)-.54;
   if(highY>low)b.box(g,b.m.red,[x,(low+highY)/2,z],[.20,highY-low,.25]);
  }
 }
 const rafters=part(g,'zhengda-real-curved-rafters',{body:'roof-conforming-solid-rafters',roofOffset:.238});
 for(let station=-L.roof.width/2+.22;station<L.roof.width/2-.21;station+=.278){
  // A finite-radius rafter must not cross the vertical upper-gable/hip boundary.
  const x=Math.abs(Math.abs(station)-roof.upperHalf)<.10?Math.sign(station)*(roof.upperHalf-.10):station;
  const pts=Array.from({length:97},(_,i)=>{const z=-L.roof.depth/2+.13+(L.roof.depth-.26)*i/96;return[x,roof.skinY(x,z)-.238,z];});
  b.tube(rafters,b.m.red,pts,L.roof.rafterRadius,128,20);
 }
 const eaves=part(g,'zhengda-continuous-eave-fascia',{body:'four-sided-curved-eave-woodwork'});
 for(const side of [-1,1]){
  const z=side*(L.roof.depth/2-.10),points=Array.from({length:97},(_,i)=>{const x=-L.roof.width/2+.10+(L.roof.width-.20)*i/96;return[x,roof.skinY(x,z)-.28,z];});
  b.tube(eaves,b.m.darkWood,points,.092,128,24);
  const x=side*(L.roof.width/2-.10),p=Array.from({length:65},(_,i)=>{const z=-L.roof.depth/2+.10+(L.roof.depth-.20)*i/64;return[x,roof.skinY(x,z)-.28,z];});
  b.tube(eaves,b.m.darkWood,p,.092,96,24);
 }
 g.userData.purlins=purlins;return g;
}
function floralTileEnds(b,parent,roof){
 const g=part(parent,'zhengda-authored-clay-eave-ends',{body:'small-floral-clay-relief',historicalTilePatternRecovered:false}),n=Math.floor((L.roof.width-.24)/L.roof.tilePitch);
 const disk=b.prototype('zhengda-tile-end',()=>new THREE.CylinderGeometry(.083,.083,.025,48)),petal=b.prototype('zhengda-eave-petal',()=>new THREE.SphereGeometry(1,16,12));
 for(const side of [-1,1])for(let i=0;i<=n;i++){
  const x=-L.roof.width/2+.12+(L.roof.width-.24)*i/n,z=side*(L.roof.depth/2-.013),y=roof.skinY(x,z)+.03;
  b.add(g,disk,b.m.greyTile,[x,y,z],undefined,[Math.PI/2,0,0]);
  for(let k=0;k<8;k++){const a=k*Math.PI/4;b.add(g,petal,b.m.greyTile,[x+Math.cos(a)*.036,y+Math.sin(a)*.036,z+side*.016],[.023,.008,.005],[0,0,a]);}
  b.add(g,petal,b.m.tileLight,[x,y,z+side*.018],[.014,.014,.005]);
 }
}
export {buildZhengdaCenserR2 as buildZhengdaCenser} from './zhengda-censer.js';

function hall(b,root){
 platformRectangle(b,root,'zhengda-main-platform',L.platform);
 platformRectangle(b,root,'zhengda-front-moon-platform',{...L.moonPlatform,centerZ:(L.moonPlatform.frontZ+L.moonPlatform.rearZ)/2,rearFace:false});
 for(const[x,width]of [[-9.31,4.25],[0,5.35],[9.31,4.25]])stairs(b,root,'zhengda-front-steps-'+x,{x,z:L.moonPlatform.frontZ,width});
 for(const side of [-1,1])stairs(b,root,'zhengda-side-steps-'+side,{x:side*L.platform.width/2,z:2.8,width:3.4,angle:side*Math.PI/2,run:2.4});
 stairs(b,root,'zhengda-rear-steps',{z:-L.platform.depth/2,width:5.35,angle:Math.PI});
 const structure=part(root,'zhengda-seven-bay-hall',{body:'seven-main-bays-three-open-corridors',southOpenGallery:true,eastOpenGallery:true,westOpenGallery:true,northGalleryEnclosed:true,mainBayCount:7});
 const xs=zhengdaColumnXs(),ex=[-L.grid.eaveX,...xs,L.grid.eaveX],eaveTop=shaftBottom+L.columns.eaveWoodHeight,innerTop=shaftBottom+L.columns.innerWoodHeight;
 let c=0;
 for(const z of [L.grid.frontEaveZ,L.grid.rearEaveZ])for(const x of ex)column(b,structure,x,z,'eave',c++);
 for(const side of [-1,1])for(const z of [-6.08,-3.04,0,3.04,6.08])column(b,structure,side*L.grid.eaveX,z,'eave',c++);
 let inner=0;for(const z of [L.grid.frontGoldZ,L.grid.rearGoldZ])for(const x of xs)column(b,structure,x,z,'inner',inner++);
 for(const z of [L.grid.frontEaveZ,L.grid.rearEaveZ]){
  const angle=z>0?0:Math.PI;
  for(let i=0;i<ex.length-1;i++){
   const beams=part(structure,'zhengda-eave-fang-'+z+'-'+i,{body:'painted-longitudinal-entablature',mergeIntoParent:true});
   paintedBeam(b,beams,[ex[i],z],[ex[i+1],z],eaveTop-.11,.46);
   for(const[x,direction]of [[ex[i],1],[ex[i+1],-1]])zhengdaSparrowBrace(b,structure,{x,z,y:eaveTop-.35,direction});
   bracket(b,structure,(ex[i]+ex[i+1])/2,z,eaveTop+.02,angle,'intercolumn');
  }
  for(const x of ex)bracket(b,structure,x,z,eaveTop+.02,angle);
  b.rod(structure,b.m.red,[-L.grid.eaveX-.15,eaveTop+.98,z+(z>0?.58:-.58)],[L.grid.eaveX+.15,eaveTop+.98,z+(z>0?.58:-.58)],.13,40);
 }
 for(const side of [-1,1]){
  const x=side*L.grid.eaveX,zs=[-7.88,-6.08,-3.04,0,3.04,6.08,7.88];
  for(let i=0;i<zs.length-1;i++){
   paintedBeam(b,structure,[x,zs[i]],[x,zs[i+1]],eaveTop-.11,.46);
   bracket(b,structure,x,(zs[i]+zs[i+1])/2,eaveTop+.02,side*Math.PI/2,'side-intercolumn');
  }
  for(const z of zs.slice(1,-1))bracket(b,structure,x,z,eaveTop+.02,side*Math.PI/2);
  wall(b,structure,'zhengda-solid-'+(side<0?'west':'east')+'-gable-wall',[side*L.grid.width/2,(L.grid.rearEaveZ+L.grid.frontGoldZ)/2],L.grid.frontGoldZ-L.grid.rearEaveZ,-Math.PI/2,5.56);
 }
 for(const z of [L.grid.frontGoldZ,L.grid.rearGoldZ])for(let i=0;i<7;i++)paintedBeam(b,structure,[xs[i],z],[xs[i+1],z],innerTop-.11,.47);
 for(const bay of L.doors.southBays)doors(b,structure,bay);
 for(const bay of L.doors.northBays)doors(b,structure,bay,true);
 for(const bay of [0,1,5,6])wall(b,structure,'zhengda-north-enclosed-bay-'+bay,[zhengdaBayCenters()[bay],L.grid.rearEaveZ],L.grid.bayWidths[bay]-.35,0,5.15);
 frontPlaque(b,structure);
 const roof=createZhengdaRoof(b,root);buildZhengdaTimber(b,root,{...zhengdaRoofProfile(),...roof});floralTileEnds(b,root,roof);
 for(let i=0;i<4;i++)buildZhengdaCenser(b,root,'zhengda-moon-platform-censer-'+i,{x:L.burner.xs[i],z:L.burner.z,floor:F});
 return {roof,eaveColumns:c,innerColumns:inner};
}
function summary(group){
 const geometries=new Set(),materials=new Set(),textures=new Set();let meshCount=0,triangleCount=0,instanceCount=0;
 group.traverse(o=>{if(!o.isMesh)return;meshCount++;geometries.add(o.geometry);const n=o.isInstancedMesh?o.count:1;triangleCount+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*n;if(o.isInstancedMesh)instanceCount+=n;for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
 return{meshCount,triangleCount,instanceCount,uniqueGeometries:geometries.size,uniqueMaterials:materials.size,visibleTextures:textures.size};
}
export function createZhengdaGuangmingStudy({signal,component='complete'}={}){
 signal?.throwIfAborted();if(!['complete','censer'].includes(component))throw new Error('Unknown Zhengda Guangming component');
 const group=new THREE.Group();group.name=ZHENGDA_GUANGMING_ID;group.userData={id:ZHENGDA_GUANGMING_ID,component,sourceAsset:true,researchReconstruction:true,historicalAccuracy:'not-established',targetPeriod:'Daoguang-Xianfeng / before1860',fig5Dating:'author-conjecture'};
 let builder=null,disposed=false,abortHandler=null;
 const resources={disposed:false},material={shaderPreparations:0,preparedMaterials:[],clayBindings:0};
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',abortHandler);const errors=[];
  for(const action of [()=>group.removeFromParent(),()=>builder?.dispose(),()=>group.clear()])try{action();}catch(e){errors.push(e);}
  resources.disposed=true;if(errors.length)throw new AggregateError(errors,'Zhengda Guangming resource cleanup failed');
 }
 try{
  builder=new ZhengdaBuilder();let fabric;
  if(component==='complete')fabric=hall(builder,group);else buildZhengdaCenser(builder,group,'zhengda-independent-censer');
  builder.flush();builder.releasePrototypes();group.updateWorldMatrix(true,true);signal?.throwIfAborted();
  prepareZhengdaGuangmingFinishes(builder,group,material);prepareZhengdaCenserR2Finishes(builder,material);signal?.throwIfAborted();
  const box=new THREE.Box3().setFromObject(group,true),counts=summary(group);
  const diagnostics={id:ZHENGDA_GUANGMING_ID,component,...counts,bounds:{min:box.min.toArray(),max:box.max.toArray()},sourceDimensions:L,mainBays:component==='complete'?7:0,eaveColumns:fabric?.eaveColumns??0,innerColumns:fabric?.innerColumns??0,southDoorLeaves:component==='complete'?28:0,northDoorLeaves:component==='complete'?12:0,censers:component==='complete'?4:1,ownedGeometryCount:builder.geometries.size,ownedMaterialCount:builder.materials.size,ownedTextureCount:builder.textures.size,resources,material,quality:'full-geometric-tile-timber-lattice-and-bronze-study',nativeArtAccepted:false};
  const owner={id:ZHENGDA_GUANGMING_ID,group,layout:L,diagnostics,dispose,get disposed(){return disposed;},update(){if(disposed)return;signal?.throwIfAborted();}};
  abortHandler=()=>{try{dispose();}catch(error){resources.abortCleanupError=String(error);}};
  signal?.addEventListener('abort',abortHandler,{once:true});signal?.throwIfAborted();return owner;
 }catch(error){try{dispose();}catch(cleanup){error.cleanupError=cleanup;}throw error;}
}
