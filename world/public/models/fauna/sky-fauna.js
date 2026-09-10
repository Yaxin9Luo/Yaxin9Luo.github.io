import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original, editable mesh recipes. Coordinates are metres; birds fly along -Z.
// No photograph, stock model, or source image is a runtime asset.
export const FAUNA_VERSION='living-v8-fauna-r4-flight';
const TAU=Math.PI*2;
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const color=value=>new THREE.Color(value);
const palette={back:color('#263b4a'),breast:color('#e5d5b5'),throat:color('#9b4d31'),flight:color('#41464b'),covert:color('#71818a'),tailSpot:color('#e2d9bd')};

function colored(geometry,fn){
  const p=geometry.attributes.position,values=[];
  for(let i=0;i<p.count;i++){const c=fn(p.getX(i),p.getY(i),p.getZ(i),i);values.push(c.r,c.g,c.b);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(values,3));return geometry;
}
function ellipsoid(scale,position,fn){
  const g=new THREE.SphereGeometry(1,32,20);g.scale(...scale);g.translate(...position);return colored(g,fn);
}
function mesh(geometry,material,name){const object=new THREE.Mesh(geometry,material);object.name=name;return object;}
function merge(parts){const copies=parts.map(part=>{const g=part.index?part.toNonIndexed():part;g.deleteAttribute('uv');return g;});const g=mergeGeometries(copies);new Set([...parts,...copies]).forEach(part=>part.dispose());return g;}

// A closed, softly cambered feather. Each cross section includes a real underside.
function feather(start,end,width,shade,{bend=.004,spot=false,rounded=true,underside=null,thickness=.045}={}){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),axis=b.clone().sub(a),side=new THREE.Vector3(axis.z,0,-axis.x).normalize();
  const positions=[],colors=[],indices=[],rows=26,sides=10;
  for(let row=0;row<=rows;row++){
    const t=row/rows,c=a.clone().lerp(b,t);c.y+=Math.sin(t*Math.PI)*bend;
    const w=width*Math.pow(Math.max(0,Math.sin(Math.PI*(.025+.975*t))),rounded?.24:.63)*(1-(rounded?.10:.38)*t);
    for(let j=0;j<sides;j++){
      const angle=j/sides*TAU,p=c.clone().addScaledVector(side,Math.cos(angle)*w);p.y+=Math.sin(angle)*Math.max(width*.00001,w*thickness);
      positions.push(...p.toArray());
      const pigment=shade.clone();if(underside)pigment.lerp(underside,1-smooth(-.15,.15,Math.sin(angle)));pigment.multiplyScalar(.96+.035*Math.sin(angle)+.015*Math.cos(t*31+j*.7));
      if(spot&&t>.43&&t<.67)pigment.lerp(palette.tailSpot,smooth(.43,.49,t)*(1-smooth(.61,.67,t))*.90);
      colors.push(pigment.r,pigment.g,pigment.b);
      if(row<rows){const n=row*sides+j,k=row*sides+(j+1)%sides;indices.push(n,k,n+sides,k,k+sides,n+sides);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function wingGeometry(sign){
  const parts=[];
  // Curved load-bearing wing: thick covered shoulder, short hand-web, pointed fan.
  const outline=new THREE.CatmullRomCurve3([
    [.040,-.074,.074],[.080,-.090,.096],[.13,-.100,.100],[.18,-.108,.089],
    [.225,-.110,.053],[.265,-.096,.030],[.33,-.059,.041],[.40,.008,.070],
    [.466,.078,.101],[.505,.130,.131],
  ].map(p=>new THREE.Vector3(...p)));
  const positions=[],colors=[],indices=[],around=28,rows=44;
  for(let i=0;i<=rows;i++){
    const point=outline.getPoint(i/rows),x=point.x,front=point.y,back=point.z;
    const depth=.011*(1-smooth(.065,.38,x))+.00045,cy=.004*Math.sin(x*7);
    for(let j=0;j<around;j++){
      const angle=j/around*TAU,z=(front+back)/2+Math.cos(angle)*(back-front)/2,y=Math.sin(angle)*depth+cy;
      positions.push(sign*x,y,z);
      const c=palette.back.clone().lerp(palette.covert,.14);
      if(Math.sin(angle)<0)c.lerp(palette.breast,.76*(1-smooth(.15,.28,x)));
      colors.push(c.r,c.g,c.b);
      if(i<rows){const n=i*around+j,k=i*around+(j+1)%around;indices.push(n,n+around,k,k,n+around,k+around);}
    }
  }
  const web=new THREE.BufferGeometry();web.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));web.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));web.setIndex(sign===1?indices:indices.reverse());web.computeVertexNormals();parts.push(web);
  // Short round-ended inner feathers overlap generously; no comb-like gaps.
  for(let i=0;i<11;i++){
    const t=i/10,x=.060+t*.178;
    parts.push(feather([sign*x,.0,.030],[sign*(x+.012),.0,.140-.023*t],.020,palette.flight.clone().lerp(palette.covert,.12),{bend:0,underside:palette.flight.clone().lerp(palette.breast,.20)}));
  }
  // Long primaries overlap as a swept continuous hand-wing with a small scallop.
  for(let i=0;i<10;i++){
    const t=i/9;
    parts.push(feather([sign*(.207+.025*t),.002,-.049+.028*t],[sign*(.260+.247*t),.002,.170-.031*t],.031-.014*t,palette.flight.clone().lerp(palette.back,.2),{bend:0,underside:palette.flight.clone().lerp(palette.breast,.13)}));
  }
  // Low-profile coverts remain attached to both sides of the fleshy shoulder.
  for(const face of[-1,1])for(let row=0;row<2;row++)for(let i=0;i<12;i++){
    const t=i/11,x=.051+t*.194,y=face*(.014-row*.001)*(1-t*.62)+.003;
    const shade=face<0?palette.breast.clone().lerp(palette.flight,t*.3):palette.back.clone().lerp(palette.covert,.13+row*.06);
    parts.push(feather([sign*x,y,-.040+row*.031],[sign*(x+.018),y,.045+row*.029],.013,shade,{bend:face*.0008,thickness:.025}));
  }
  return merge(parts);
}

function birdBodyGeometry(){
  // One continuous body profile: fuller forward chest, no pinched cylinder neck.
  const sections=[[-.185,.001,.004,.012],[-.173,.020,.021,.017],[-.154,.034,.033,.023],[-.128,.039,.036,.023],[-.102,.047,.041,.010],[-.067,.059,.050,0],[-.024,.064,.054,-.006],[.025,.056,.050,-.008],[.070,.043,.038,-.006],[.114,.026,.027,0],[.152,.014,.013,.003],[.176,.003,.004,.004]];
  const positions=[],colors=[],indices=[],around=40;
  for(let i=0;i<sections.length;i++){
    const [z,width,height,cy]=sections[i];
    for(let j=0;j<around;j++){
      const a=j/around*TAU,x=Math.cos(a)*width,y=Math.sin(a)*height+cy;positions.push(x,y,z);
      const underside=1-smooth(-.18,.28,Math.sin(a));
      const c=palette.back.clone().lerp(palette.breast,underside*(1-smooth(-.116,-.092,-z)));
      if(z>-.116)c.copy(palette.back).lerp(palette.breast,underside);
      if(z<-.090&&z>-.172&&Math.sin(a)<-.15)c.lerp(palette.throat,.93*(1-smooth(-.10,-.085,z)));
      c.multiplyScalar(.98+.02*Math.cos(j*1.7+i*.8));colors.push(c.r,c.g,c.b);
      if(i<sections.length-1){const n=i*around+j,k=i*around+(j+1)%around;indices.push(n,k,n+around,k,k+around,n+around);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function articulatedWing(position,sign,up){
  const p=position.clone(),shoulder=new THREE.Vector3(sign*.043,.003,-.018),wrist=new THREE.Vector3(sign*.229,.008,-.055);
  const distal=smooth(.192,.292,Math.abs(p.x));
  // Upstroke narrows the hand-wing by folding at the wrist, then lifts it.
  p.sub(wrist).applyAxisAngle(new THREE.Vector3(0,1,0),sign*(up?.52:-.09)*distal).applyAxisAngle(new THREE.Vector3(0,0,1),sign*(up?.23:-.13)*distal).add(wrist);
  p.sub(shoulder).applyAxisAngle(new THREE.Vector3(0,0,1),sign*(up?1.03:-.64)).add(shoulder);
  return p;
}

/** Full-detail watertight surfaces, feather fan, bill and eyes; morph normals included. */
export function createSwallow(){
  const parts=[birdBodyGeometry()],roles=[0];
  for(const sign of[-1,1]){
    parts.push(wingGeometry(sign));roles.push(sign);
    for(let i=0;i<6;i++){
      const t=i/5;parts.push(feather([sign*(.005+t*.019),.001,.119],[sign*(.016+t*.104),-.006-t*.012,.253+Math.pow(t,3)*.179],.0135-.003*t,palette.flight,{bend:-.009,spot:i>=2,rounded:false}));roles.push(0);
    }
    parts.push(ellipsoid([.006,.007,.007],[sign*.032,.033,-.148],()=>color('#0e1315')));roles.push(0);
    parts.push(ellipsoid([.0018,.0018,.002],[sign*.036,.036,-.152],()=>color('#c7d7d9')));roles.push(0);
  }
  const beak=new THREE.ConeGeometry(.012,.041,20);beak.rotateX(-Math.PI/2);beak.scale(1,.55,1);beak.translate(0,.014,-.195);parts.push(colored(beak,()=>color('#313331')));roles.push(0);
  const vertices=[],poseUp=[],poseDown=[];
  for(let i=0;i<parts.length;i++){
    const g=parts[i],p=g.attributes.position,up=[],down=[];
    for(let k=0;k<p.count;k++){
      const v=new THREE.Vector3().fromBufferAttribute(p,k);up.push(...(roles[i]?articulatedWing(v,roles[i],true):v).toArray());down.push(...(roles[i]?articulatedWing(v,roles[i],false):v).toArray());
    }
    for(const [array,collection] of [[up,poseUp],[down,poseDown]]){const clone=g.clone();clone.setAttribute('position',new THREE.Float32BufferAttribute(array,3));clone.computeVertexNormals();collection.push(clone);}
    vertices.push(g);
  }
  const geometry=merge(vertices),up=merge(poseUp),down=merge(poseDown);
  geometry.morphAttributes.position=[up.attributes.position,down.attributes.position];geometry.morphAttributes.normal=[up.attributes.normal,down.attributes.normal];geometry.morphAttributes.position[0].name='upstroke';geometry.morphAttributes.position[1].name='downstroke';geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73,metalness:0});material.name='Slate, buff and rust feather pigments';
  const object=mesh(geometry,material,'Authored swallow — continuous body and articulated feather wings');
  object.userData={assetVersion:FAUNA_VERSION,kind:'swallow',forward:[0,0,-1],bodyLength:.36,pose:'glide'};return object;
}

export function setSwallowPose(object,pose='glide',time=0){
  let up=0,down=0,bank=0;
  if(pose==='upstroke')up=1;
  if(pose==='downstroke')down=1;
  if(pose==='bank')bank=.48;
  if(pose==='flight'){
    const cycle=(time%8+8)%8,flapping=cycle<2.3;
    const amplitude=flapping?Math.min(1,cycle/.3,(2.3-cycle)/.3):0,swing=Math.sin(time*TAU*3.2);
    up=Math.max(0,swing)*amplitude;down=Math.max(0,-swing)*amplitude;bank=Math.sin(time*.55)*.28;
  }
  object.morphTargetInfluences[0]=up;object.morphTargetInfluences[1]=down;object.rotation.z=bank;object.userData.pose=pose;
}

/** A view-space disk follows each actual camera, including the reflected camera. */
export function createFaunaAura(size,tint,opacity){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,
    uniforms:{tint:{value:color(tint)},opacity:{value:opacity}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 center=vec4(0.,0.,0.,1.);vec2 scale=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
      #ifdef USE_INSTANCING
      center=instanceMatrix*center;scale*=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
      #endif
      vec4 p=modelViewMatrix*center;p.xy+=position.xy*scale;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float opacity;void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),3.5)*opacity;gl_FragColor=vec4(tint,a);}`});
  const object=mesh(new THREE.PlaneGeometry(size,size),material,'Round depth-tested aura');object.userData.excludeFromGLB=true;return object;
}

const lanternProfile=new THREE.SplineCurve([[.33,0],[.405,.16],[.454,.50],[.474,1.08],[.449,1.47],[.321,1.73],[.125,1.825],[0,1.86]].map(p=>new THREE.Vector2(...p)));
export function lanternSurface(t,angle){
  const p=lanternProfile.getPoint(t),y=p.y,r=Math.max(0,p.x),fold=1+.026*Math.sin(angle*8+.08*Math.sin(y*4))+.006*Math.sin(angle*13+y*5);
  return new THREE.Vector3(Math.sin(angle)*r*fold+.012*Math.sin(y*2.2),y,Math.cos(angle)*r*fold);
}
function lanternSurfaceNormal(t,angle){
  const along=lanternSurface(Math.min(1,t+.0001),angle).sub(lanternSurface(Math.max(0,t-.0001),angle)),around=lanternSurface(t,angle+.0001).sub(lanternSurface(t,angle-.0001));return around.cross(along).normalize();
}
export function createPaperLantern(){
  const root=new THREE.Group();root.name='Hand-folded ivory sky lantern';
  const geometry=new THREE.LatheGeometry(lanternProfile.getPoints(80),64),p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){const point=lanternSurface(uv.getY(i),uv.getX(i)*TAU);p.setXYZ(i,...point.toArray());}
  geometry.computeVertexNormals();const shellNormals=geometry.attributes.normal;for(let i=0;i<shellNormals.count;i++)if(Math.hypot(shellNormals.getX(i),shellNormals.getY(i),shellNormals.getZ(i))<.001)shellNormals.setXYZ(i,0,1,0);
  colored(geometry,(_x,y)=>color('#eadbbd').lerp(color('#dfad60'),(1-smooth(.12,1.40,y))*.43));
  const paper=new THREE.MeshStandardMaterial({color:'#fff9ed',vertexColors:true,emissive:'#ffffff',emissiveIntensity:.06,roughness:.94,side:THREE.DoubleSide,transparent:true,opacity:.94,depthWrite:false});paper.name='Thin warm ivory rice paper';
  paper.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 paperUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npaperUv=uv;');
    shader.fragmentShader='varying vec2 paperUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float seam=pow(abs(cos(paperUv.x*25.132741)),44.);float grade=smoothstep(.07,.95,paperUv.y);
      vec3 paperGlow=mix(vec3(1.0,.39,.085),vec3(.24,.205,.143),grade);
      float crease=.91+.09*cos(paperUv.x*50.265482+.2*sin(paperUv.y*12.));
      totalEmissiveRadiance*=paperGlow*crease*(1.-seam*.23);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 frequency=vec2(367.,491.);vec2 coverage=1.-smoothstep(vec2(.3),vec2(1.),fwidth(paperUv)*frequency);
      float fibres=1.+.027*(sin(paperUv.x*frequency.x+sin(paperUv.y*43.))*coverage.x+sin(paperUv.y*frequency.y)*coverage.y);
      float softCrease=.97+.03*cos(paperUv.x*50.265482+.2*sin(paperUv.y*12.));diffuseColor.rgb*=fibres*softCrease;`);
  };paper.customProgramCacheKey=()=>FAUNA_VERSION+'-paper';
  root.add(mesh(geometry,paper,'Continuous folded translucent paper shell'));
  const parts=[],ribCenterlines=[],bamboo=new THREE.MeshStandardMaterial({color:'#9b7949',roughness:.88});bamboo.name='Fine split bamboo';
  for(const t of[0,1/7]){
    const points=Array.from({length:128},(_,i)=>{const angle=i/128*TAU;return lanternSurface(t,angle).addScaledVector(lanternSurfaceNormal(t,angle),.014);});
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),128,.010,10,true));
  }
  const hoopVertexCount=parts.reduce((count,g)=>count+g.attributes.position.count,0);
  for(let i=0;i<8;i++){
    const angle=i/8*TAU,points=[];
    for(let j=0;j<=100;j++){
      const t=j/100*.97,point=lanternSurface(t,angle);point.addScaledVector(lanternSurfaceNormal(t,angle),.008);points.push(point);
    }
    ribCenterlines.push(points.map(p=>p.toArray()));parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,.005,8,false));
  }
  for(let i=0;i<2;i++){const g=new THREE.CylinderGeometry(.006,.006,.668,10);g.rotateZ(Math.PI/2);g.rotateY(i*Math.PI/2);g.translate(0,.008,0);parts.push(g);}
  root.add(mesh(mergeGeometries(parts),bamboo,'Eight fine bamboo ribs, open double rim and crossed brace'));parts.forEach(g=>g.dispose());
  const burner=mesh(new THREE.CylinderGeometry(.056,.062,.026,32),new THREE.MeshStandardMaterial({color:'#342822',roughness:1}),'Cotton fuel pad');burner.position.y=.029;root.add(burner);
  const flameGeometry=new THREE.LatheGeometry([[0,0],[.032,.013],[.039,.046],[.029,.098],[.012,.155],[0,.211]].map(p=>new THREE.Vector2(...p)),32);flameGeometry.normalizeNormals();
  const flame=mesh(flameGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color(4.7,2.85,1.04),toneMapped:false}),'Small tapered sheltered flame');flame.position.y=.043;root.add(flame);
  const aura=createFaunaAura(2.8,'#ffc781',.16);aura.position.y=.61;root.add(aura);
  root.userData={assetVersion:FAUNA_VERSION,kind:'paper-lantern',paper,flame,aura,ribCenterlines,hoopVertexCount};setLanternEnvironment(root,0);return root;
}

export function setLanternEnvironment(object,night=0,fade=1){
  const {paper,flame,aura}=object.userData;
  paper.emissiveIntensity=(.045+1.55*night)*fade;paper.opacity=.94*fade;
  flame.material.opacity=fade;flame.material.transparent=fade<1;
  aura.material.uniforms.opacity.value=.16*night*fade;
}

function taperedLimb(points,radius){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),geometry=new THREE.TubeGeometry(curve,28,radius,10,false),p=geometry.attributes.position;
  for(let row=0;row<=28;row++){
    const t=row/28,center=curve.getPointAt(t),factor=.97-.82*Math.pow(t,.8);
    for(let j=0;j<=10;j++){const index=row*11+j,v=new THREE.Vector3().fromBufferAttribute(p,index).sub(center).multiplyScalar(factor).add(center);p.setXYZ(index,...v.toArray());}
  }
  geometry.computeVertexNormals();const tip=new THREE.SphereGeometry(radius*.15,12,8);tip.translate(...points.at(-1));const joined=mergeGeometries([geometry,tip]);geometry.dispose();tip.dispose();return joined;
}
export function createFirefly(){
  const root=new THREE.Group();root.name='Garden firefly — beetle, wings and luminous abdomen';
  const dark=new THREE.MeshStandardMaterial({color:'#293429',roughness:.7}),shell=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58}),wing=new THREE.MeshPhysicalMaterial({color:'#bac4b2',roughness:.47,transparent:true,opacity:.33,side:THREE.DoubleSide,depthWrite:false,metalness:0});
  const thorax=mesh(ellipsoid([.0049,.0029,.0098],[0,-.0002,.001],()=>color('#ffffff')),dark,'Elongated thorax');root.add(thorax);
  root.add(mesh(ellipsoid([.0033,.0024,.0037],[0,.0001,-.0119],()=>color('#ffffff')),dark,'Small beetle head'));
  root.add(mesh(ellipsoid([.0048,.0015,.0049],[0,.0019,-.0075],(x,_y,z)=>color('#4d5033').lerp(color('#998058'),smooth(.55,1,Math.abs(x)/.0048)*.48)),shell,'Flattened protective head shield'));
  const abdomenParts=[];
  for(let i=0;i<4;i++){const g=new THREE.SphereGeometry(1,28,16);g.scale(.0045-i*.00048,.00175-i*.00017,.00255);g.translate(0,-.0014,.009+i*.0031);abdomenParts.push(g);}
  const abdomen=mesh(mergeGeometries(abdomenParts),new THREE.MeshStandardMaterial({color:'#cfca8b',emissive:'#d6eb95',emissiveIntensity:1.8,roughness:.65}),'Luminous abdomen');abdomenParts.forEach(g=>g.dispose());root.add(abdomen);
  for(const sign of[-1,1]){
    const cover=ellipsoid([.00325,.0015,.0095],[0,0,0],(x,y)=>color('#384533').lerp(color('#777652'),smooth(.60,1,Math.abs(x)/.00325)*.3).multiplyScalar(.94+.06*y/.0015));cover.rotateY(sign*.18);cover.translate(sign*.0029,.0024,.0038);root.add(mesh(cover,shell,sign<0?'Left protective wing cover':'Right protective wing cover'));
    const flightWing=feather([sign*.003,.0018,-.002],[sign*.016,.0042,.0115],.0046,color('#ffffff'),{bend:.0004,thickness:.011});root.add(mesh(flightWing,wing,sign<0?'Left membranous wing':'Right membranous wing'));
    const veinMaterial=new THREE.MeshStandardMaterial({color:'#899880',transparent:true,opacity:.35,roughness:.9,depthWrite:false});
    const vein=taperedLimb([[sign*.003,.0020,-.001],[sign*.008,.0032,.004],[sign*.014,.0041,.010]],.000085);root.add(mesh(vein,veinMaterial,'Fine wing vein'));
    const feeler=taperedLimb([[sign*.0019,.0018,-.0135],[sign*.0033,.0021,-.0165],[sign*.0044,.0031,-.0194],[sign*.0060,.0041,-.0210]],.00026);root.add(mesh(feeler,dark,'Curved antenna'));
    root.add(mesh(ellipsoid([.0008,.0008,.0011],[sign*.0028,.0006,-.013],()=>color('#17251f')),shell,'Small lateral beetle eye'));
    for(let i=0;i<3;i++){
      const z=-.005+i*.0046,forward=(i-1)*.0018;
      const g=taperedLimb([[sign*.0036,-.0009,z],[sign*.0062,-.0023,z+forward],[sign*.0067,-.0044,z+.001+forward],[sign*.0095,-.0052,z+.0035+forward],[sign*.0103,-.0058,z+.0042+forward]],.00037);root.add(mesh(g,dark,'Fine articulated leg'));
    }
  }
  const aura=createFaunaAura(.24,'#e8edaa',.3);aura.position.set(0,-.0014,.017);root.add(aura);
  root.userData={assetVersion:FAUNA_VERSION,kind:'firefly',abdomen,aura,bodyLength:.044};return root;
}

export function setFireflyGlow(object,amount){object.userData.abdomen.material.emissiveIntensity=.08+1.8*amount;object.userData.aura.material.uniforms.opacity.value=.36*amount;}

export function fireflyFlightRig(object){
  if(!object.userData.flightParts){
    object.userData.flightParts=[];
    object.traverse(part=>{
      if(!part.isMesh||!['Left membranous wing','Right membranous wing','Fine wing vein'].includes(part.name))return;
      part.updateMatrix();part.geometry.computeBoundingBox();const sign=Math.sign(part.geometry.boundingBox.getCenter(new THREE.Vector3()).x)||1;
      object.userData.flightParts.push({part,sign,rest:part.matrix.clone(),pivot:new THREE.Vector3(sign*.003,.0018,-.002)});
    });
  }
  return object.userData.flightParts;
}
const flightRotation=new THREE.Matrix4(),flightTranslation=new THREE.Matrix4();
export function fireflyWingMatrix({pivot,sign,rest},angle,target=new THREE.Matrix4()){
  return target.makeTranslation(pivot.x,pivot.y,pivot.z).multiply(flightRotation.makeRotationZ(sign*angle)).multiply(flightTranslation.makeTranslation(-pivot.x,-pivot.y,-pivot.z)).multiply(rest);
}
export function setFireflyFlight(object,time=0,{reduced=false,phase=0}={}){
  const angle=reduced?0:Math.sin(time*TAU*23+phase)*.62;
  for(const descriptor of fireflyFlightRig(object)){
    const part=descriptor.part;fireflyWingMatrix(descriptor,angle,part.matrix);part.matrix.decompose(part.position,part.quaternion,part.scale);part.matrixWorldNeedsUpdate=true;
  }
  object.userData.wingAngle=angle;
}

export function disposeFaunaSpecimen(root){
  if(!root||root.userData.disposed)return;root.userData.disposed=true;const geometries=new Set(),materials=new Set();
  root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(m);if(object.isInstancedMesh)object.dispose();});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
}
