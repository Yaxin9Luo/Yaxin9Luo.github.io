import * as THREE from 'three';
import {V,namedGroup} from './study-geometry.js';
import {stoneSweep} from './yuanyingguan-geometry.js';

// Plate 17/19 constrain the floral chains, volutes and shell positions. Their
// individual leaf cuts/depths are contemporary modelling interpretations.
function petalGeometry(){
  const shape=new THREE.Shape();shape.moveTo(0,-.50);shape.bezierCurveTo(-.23,-.24,-.27,.20,0,.53);shape.bezierCurveTo(.27,.20,.23,-.24,0,-.50);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelSize:.016,bevelThickness:.016,bevelSegments:2,curveSegments:10,steps:1});
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+.095*Math.pow(Math.max(0,(p.getY(i)+.5)/1.03),3));
  geometry.computeVertexNormals();return geometry;
}
function petal(b,parent,position,width,height,angle=0,material=b.m.carving){
  b.add(parent,b.prototype('xianfa-small-curved-petal',petalGeometry),material,position,[width/.37,height/1.06,Math.max(.24,height*1.7)],[0,0,angle],false);
}
export function xianfaRosette(b,parent,x,y,z,radius=.11,petals=7){
  for(let i=0;i<petals;i++){const a=i*Math.PI*2/petals;petal(b,parent,[x+Math.sin(a)*radius*.36,y+Math.cos(a)*radius*.36,z],radius*.53,radius*1.12,-a);}
  b.add(parent,b.prototype('xianfa-rosette-boss',()=>new THREE.SphereGeometry(1,16,10)),b.m.carving,[x,y,z+.031],[radius*.23,radius*.23,radius*.16],undefined,false);
}
export function xianfaScroll(b,parent,points,width=.075,depth=.085,leaves=true){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),length=curve.getLength();
  b.add(parent,stoneSweep(points,width,depth,V(0,0,1),Math.max(24,Math.ceil(length*32)),t=>.50+.50*Math.sin(Math.PI*t)**.55),b.m.carving);
  // A second narrow ridge follows the same carved body, without detached wires.
  b.add(parent,stoneSweep(points.map(([x,y,z])=>[x,y,z+depth*.41]),width*.29,depth*.24,V(0,0,1),Math.max(24,Math.ceil(length*30))),b.m.carving);
  if(leaves)for(const t of [.19,.41,.65,.83]){
    const p=curve.getPoint(t),tangent=curve.getTangent(t),angle=Math.atan2(-tangent.x,tangent.y),size=width*3.0;
    b.leaf(parent,[p.x,p.y,p.z+depth*.30],[size*.80,size*1.22,.22],[0,0,angle+(t<.5?.40:-.32)]);
  }
}
function frame(b,parent,width,height,z,material=b.m.carving){
  for(const s of [-1,1]){b.box(parent,material,[s*(width/2-.025),0,z],[.05,height,.065],.009);b.box(parent,material,[0,s*(height/2-.025),z],[width,.05,.065],.009);}
}

export function xianfaPilasterPanel(b,parent,x,y,z,width=.53,height=3.88){
  const g=namedGroup(parent,`${parent.name}-pilaster-floral-chain-${x}`,{body:'slender-recessed-floral-chain-with-framed-border',evidence:'plate-17-vertical-floral-chain; leaf-cuts-and-relief-depth-authored',maximumLocalWidth:width});g.position.set(x,y,z);
  b.box(g,b.m.recess,[0,0,-.029],[width,height,.058],.013);frame(b,g,width,height,.013);
  b.sweep(g,[[0,-height*.43,.022],[.014,-height*.20,.025],[-.012,height*.17,.025],[0,height*.43,.022]],.016,.022,b.m.carving,V(0,0,1),40);
  const rows=Math.max(3,Math.round(height/ .55)),step=height*.74/(rows-1),beads=Math.ceil(height/.125);
  for(let row=0;row<rows;row++){
    const yy=-height*.37+row*step;xianfaRosette(b,g,0,yy,.037,Math.min(.072,width*.135),6);
    if(row<rows-1)for(const side of [-1,1])petal(b,g,[side*.068,yy+step*.46,.025],.058,.19,-side*.39);
  }
  for(const side of [-1,1])for(let row=0;row<=beads;row++){
    const yy=-height*.43+row*height*.86/beads;
    b.add(g,b.prototype('xianfa-border-pearl',()=>new THREE.SphereGeometry(1,10,6)),b.m.carving,[side*(width*.5-.075),yy,.037],[.018,.020,.014],undefined,false);
  }
  return g;
}

export function xianfaShellCrest(b,parent,x,y,z,width=1.38,height=.74){
  const g=namedGroup(parent,`${parent.name}-shell-crest-${x}-${y}`,{body:'scallop-with-curled-acanthus-supports',evidence:'plate-17/19 shell-and-floral-surround; authored-carving-depth'});g.position.set(x,y,z);
  b.shell(g,[0,-height*.22,.025],width*.48,height*.73,.095);
  for(const side of [-1,1]){
    xianfaScroll(b,g,[[side*.04,-height*.36,0],[side*width*.33,-height*.32,.008],[side*width*.45,-height*.04,.008],[side*width*.31,height*.06,.013],[side*width*.27,-height*.08,.019]],.052,.065);
    b.leaf(g,[side*width*.25,height*.025,.055],[width*.17,height*.54,.23],[0,0,-side*.50]);
  }
  xianfaRosette(b,g,0,-height*.33,.064,.064,7);return g;
}

export function xianfaEntablatureDetail(b,parent,east=false){
  const g=namedGroup(parent,`${parent.name}-fine-entablature`,{body:'recessed-frieze-panels-dentils-and-carved-capitals',evidence:'plate-17/19-visible-horizontal-bands'});
  for(const x of [-6.04,-2.53,2.53,6.04]){
    for(const s of [-1,0,1])petal(b,g,[x+s*.18,5.14,.705],.12,.28,-s*.24);
    for(let i=-3;i<=3;i++)b.box(g,b.m.carving,[x+i*.115,5.40,.741],[.048,.088,.073],.008);
    xianfaRosette(b,g,x,5.64,.872,.057,6);
  }
  if(!east)for(const [x,width] of [[-4.29,2.48],[0,3.75],[4.29,2.48]]){
    const panel=namedGroup(g,`${g.name}-frieze-${x}`,{body:'inset-horizontal-frieze-with-fine-bead-border'});panel.position.set(x,5.75,.432);
    b.box(panel,b.m.recess,[0,0,-.021],[width,.245,.043],.012);frame(b,panel,width,.245,.023);
    for(const side of [-1,1])xianfaRosette(b,panel,side*(width*.5-.13),0,.032,.047,6);
  }
  for(let i=-43;i<=43;i++){
    const x=i*.15;if(east)continue;
    b.box(g,b.m.carving,[x,5.99,.584],[.064,.10,.079],.010);
  }
  return g;
}

export function xianfaArchDetail(b,parent,x=0,bottom=.01,width=3.17,spring=3.6,rise=1.38,z=.46){
  const g=namedGroup(parent,`${parent.name}-arch-floral-band-${x}-${bottom}`,{body:'fine-radial-leaves-outside-the-clear-opening'});
  for(let i=0;i<=18;i++){
    const a=Math.PI*i/18,xx=x+(width/2+.235)*Math.cos(a),yy=spring+(rise+.235)*Math.sin(a);
    petal(b,g,[xx,yy,z+.119],.060,.124,a-Math.PI/2);
  }
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const yy=bottom+.28+i*(spring-bottom-.48)/8;
    petal(b,g,[x+side*(width/2+.23),yy,z+.119],.067,.14,side*.11);
  }
  return g;
}

export function xianfaWestCrown(b,parent){
  const g=namedGroup(parent,`${parent.name}-open-scroll-crown`,{body:'connected-double-ridged-volute-crown-with-shells-and-pier-finials',evidence:'plate-17-outline-and-density; leaf-cuts-authored'});
  for(const side of [-1,1]){
    xianfaScroll(b,g,[[0,6.40,.14],[side*.63,6.62,.16],[side*1.04,7.12,.15],[side*.90,7.76,.15],[side*.47,8.05,.15],[side*.14,7.83,.17],[side*.21,7.53,.17],[side*.40,7.55,.17]],.11,.16);
    xianfaScroll(b,g,[[side*.04,6.45,.16],[side*1.03,6.46,.14],[side*1.72,6.81,.15],[side*2.09,6.63,.15],[side*1.96,6.48,.16],[side*1.75,6.57,.17]],.078,.11);
    b.leaf(g,[side*.54,6.55,.23],[.43,.57,.29],[0,0,-side*.78]);
    for(const x of [-4.48,4.48])xianfaScroll(b,g,[[x,6.41,.13],[x+side*.64,6.56,.14],[x+side*.82,6.99,.15],[x+side*.58,7.34,.15],[x+side*.20,7.39,.16],[x+side*.08,7.08,.16],[x+side*.23,6.92,.17]],.08,.105);
  }
  b.shell(g,[0,6.53,.23],.95,.88,.17);xianfaRosette(b,g,0,8.06,.18,.135,7);
  for(const side of [-1,1])b.leaf(g,[side*.14,7.92,.18],[.20,.40,.22],[0,0,-side*.45]);
  for(const x of [-4.48,4.48])xianfaShellCrest(b,g,x,6.66,.16,1.21,.52);
  for(const x of [-6.04,-2.53,2.53,6.04]){
    b.box(g,b.m.carving,[x,6.40,.05],[.48,.10,.40],.015);
    for(const side of [-1,1])xianfaScroll(b,g,[[x,6.44,.12],[x+side*.23,6.60,.13],[x+side*.17,6.93,.14],[x,7.08,.14]],.05,.069,false);
    petal(b,g,[x,6.79,.15],.14,.37);xianfaRosette(b,g,x,6.54,.16,.075,6);
  }
  return g;
}

export function xianfaOpenSideLeaves(b,parent,x,width=1.75,height=3.77){
  const g=namedGroup(parent,`${parent.name}-open-panelled-leaves-${x}`,{body:'two-panelled-timber-leaves-held-open-against-the-rear-jamb',evidence:'plate-17/19 rectangular-door-panels; fully-open-state-authored-for-access',clearWidth:width});
  for(const side of [-1,1]){
    const leaf=namedGroup(g,`${g.name}-${side}`,{body:'thick-rebated-door-leaf-with-framed-panels'});leaf.position.set(x+side*(width/2+.11),0,-.405);leaf.rotation.y=-side*Math.PI/2;
    const centre=-side*(width/4-.026),leafWidth=width/2-.055;
    b.box(leaf,b.m.door??b.m.timber,[centre,height/2+.035,0],[leafWidth,height,.068],.010);
    for(const yy of [.72,1.89,3.05]){
      const panel=namedGroup(leaf,`${leaf.name}-field-${yy}`,{body:'recessed-panel-with-physical-moulding'});panel.position.set(centre,yy,.043);
      b.box(panel,b.m.timber,[0,0,-.006],[leafWidth-.13,.88,.018],.008);
      frame(b,panel,leafWidth-.09,.92,.012,b.m.door??b.m.timber);
    }
    for(const yy of [.43,1.94,3.40])b.box(leaf,b.m.grille,[-side*.032,yy,.049],[.07,.18,.032],.006);
  }
  return g;
}

export function xianfaWallPanel(b,parent,position,width,height){
  const g=namedGroup(parent,`${parent.name}-recessed-wall-panel-${position[0]}`,{body:'plain-recessed-wall-field-with-cornered-stone-frame',evidence:'plate-17-flanking-wall-panels; no-invented-floral-icons'});g.position.set(...position);
  b.box(g,b.m.recess,[0,0,-.024],[width,height,.048],.015);
  const x=width/2-.08,y=height/2-.08,c=.16,points=[[-x,-y,0],[x,-y,0],[x,y-c,0],[x-c,y,0],[-x+c,y,0],[-x,y-c,0],[-x,-y,0]];
  b.sweep(g,points,.065,.075,b.m.carving,V(0,0,1),76);
  for(const side of [-1,1])b.box(g,b.m.stone,[side*(width/2+.035),0,-.016],[.075,height+.03,.08],.008);
  return g;
}

export function xianfaPavilionPanel(b,parent,position,width=1.61,height=2.05){
  const g=namedGroup(parent,`${parent.name}-carved-vase-panel`,{body:'framed-shell-panel-with-slender-foliate-stems',evidence:'plate-18-framed-relief-bays; inner-carving-is-an-authored-interpretation'});g.position.set(...position);
  b.box(g,b.m.recess,[0,0,-.035],[width,height,.070],.017);frame(b,g,width,height,.012);
  xianfaShellCrest(b,g,0,-height*.18,.058,width*.70,height*.28);
  for(const side of [-1,1]){
    xianfaScroll(b,g,[[0,-height*.27,.035],[side*width*.27,-height*.12,.048],[side*width*.28,height*.21,.05],[side*width*.11,height*.34,.05],[side*width*.06,height*.20,.057]],.050,.070);
    b.leaf(g,[side*width*.15,height*.15,.073],[.22,.41,.24],[0,0,-side*.46]);
  }
  xianfaRosette(b,g,0,height*.28,.07,.12,7);return g;
}
