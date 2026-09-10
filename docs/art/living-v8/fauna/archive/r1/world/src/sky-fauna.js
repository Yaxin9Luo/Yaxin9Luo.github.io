import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original, editable mesh recipes. Coordinates are metres; birds fly along -Z.
// No photograph, stock model, or source image is a runtime asset.
export const FAUNA_VERSION='living-v8-fauna-r1';
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
function feather(start,end,width,shade,{bend=.004,spot=false}={}){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),axis=b.clone().sub(a),side=new THREE.Vector3(axis.z,0,-axis.x).normalize();
  const positions=[],colors=[],indices=[],rows=14,sides=8;
  for(let row=0;row<=rows;row++){
    const t=row/rows,c=a.clone().lerp(b,t);c.y+=Math.sin(t*Math.PI)*bend;
    const w=width*Math.pow(Math.sin(Math.PI*(.045+.955*t)),.63)*(1-.38*t);
    for(let j=0;j<sides;j++){
      const angle=j/sides*TAU,p=c.clone().addScaledVector(side,Math.cos(angle)*w);p.y+=Math.sin(angle)*Math.max(.00018,w*.095);
      positions.push(...p.toArray());
      const pigment=shade.clone().multiplyScalar(.88+.12*Math.sin(angle)+.045*Math.cos(t*17+j*.7));
      if(spot&&t>.43&&t<.67)pigment.lerp(palette.tailSpot,smooth(.43,.49,t)*(1-smooth(.61,.67,t))*.90);
      colors.push(pigment.r,pigment.g,pigment.b);
      if(row<rows){const n=row*sides+j,k=row*sides+(j+1)%sides;indices.push(n,k,n+sides,k,k+sides,n+sides);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function wingGeometry(sign){
  const parts=[];
  // Shoulder contour joins the chest with a covered elbow and broad wrist.
  const sections=[[.042,-.079,.082,.013],[.085,-.088,.123,.013],[.14,-.096,.140,.010],[.205,-.107,.139,.008],[.26,-.103,.121,.006],[.34,-.065,.119,.004],[.425,.011,.128,.0025],[.49,.097,.135,.001],[.512,.142,.143,.0002]];
  const positions=[],colors=[],indices=[],around=24;
  for(let i=0;i<sections.length;i++){
    const [x,front,back,thickness]=sections[i];
    for(let j=0;j<around;j++){
      const angle=j/around*TAU,z=(front+back)/2+Math.cos(angle)*(back-front)/2,y=Math.sin(angle)*thickness+.01*Math.sin(x*5);
      positions.push(sign*x,y,z);
      const c=palette.back.clone().lerp(palette.covert,.22+.14*Math.sin(angle));
      if(Math.sin(angle)<0)c.lerp(palette.breast,.68*(1-smooth(.14,.34,x)));
      colors.push(c.r,c.g,c.b);
      if(i<sections.length-1){const n=i*around+j,k=i*around+(j+1)%around;indices.push(n,n+around,k,k,n+around,k+around);}
    }
  }
  const web=new THREE.BufferGeometry();web.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));web.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));web.setIndex(sign===1?indices:indices.reverse());web.computeVertexNormals();parts.push(web);
  // Overlapping secondaries lead into the swept, pointed primary fan.
  for(let i=0;i<10;i++){
    const t=i/9,x=.070+t*.190;
    parts.push(feather([sign*x,.003,-.023],[sign*(x+.022),.006,.145+.026*Math.sin(t*Math.PI)],.021,palette.flight.clone().lerp(palette.covert,(1-t)*.30)));
  }
  for(let i=0;i<9;i++){
    const t=i/8;
    parts.push(feather([sign*(.203+.025*t),.008,-.065+.035*t],[sign*(.285+.222*t),.010,.202-.054*t],.024-.010*t,palette.flight.clone().multiplyScalar(.98+.04*t),{bend:.006}));
  }
  // Small coverts soften the shoulder/flight-feather boundary without striping.
  for(let row=0;row<2;row++)for(let i=0;i<12;i++){
    const t=i/11,x=.057+t*.266;
    parts.push(feather([sign*x,.015+row*.003,-.060+row*.04],[sign*(x+.045),.016+row*.003,.051+row*.045],.017,palette.back.clone().lerp(palette.covert,.17+row*.15)));
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
      const t=i/5;parts.push(feather([sign*(.005+t*.019),.001,.119],[sign*(.016+t*.104),-.006-t*.012,.253+Math.pow(t,3)*.179],.0135-.003*t,palette.flight,{bend:-.009,spot:i>=2}));roles.push(0);
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

export function createPaperLantern(){
  const root=new THREE.Group();root.name='Hand-folded ivory sky lantern';
  const profile=[[.33,0],[.43,.15],[.58,.72],[.61,1.13],[.51,1.55],[.25,1.78],[0,1.86]],curve=new THREE.SplineCurve(profile.map(p=>new THREE.Vector2(...p)));
  const geometry=new THREE.LatheGeometry(curve.getPoints(56),48),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=p.getY(i),a=Math.atan2(z,x),fold=1+.018*Math.sin(a*8+.10*Math.sin(y*4))+.008*Math.sin(a*13+y*5);
    p.setXYZ(i,x*fold+.016*Math.sin(y*2.2),y,z*fold);
  }
  geometry.computeVertexNormals();const shellNormals=geometry.attributes.normal;for(let i=0;i<shellNormals.count;i++)if(Math.hypot(shellNormals.getX(i),shellNormals.getY(i),shellNormals.getZ(i))<.001)shellNormals.setXYZ(i,0,1,0);colored(geometry,(_x,y)=>color('#f3e6cb').lerp(color('#edbd77'),(1-smooth(.05,1.35,y))*.58));
  const paper=new THREE.MeshStandardMaterial({color:'#fff7e6',vertexColors:true,emissive:'#ffa94f',emissiveIntensity:.12,roughness:.91,side:THREE.DoubleSide,transparent:true,opacity:.94,depthWrite:false});paper.name='Thin warm ivory rice paper';
  paper.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 paperUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npaperUv=uv;');
    shader.fragmentShader='varying vec2 paperUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float seam=pow(abs(cos(paperUv.x*25.132741)),44.);float grade=mix(1.0,.29,smoothstep(.10,.92,paperUv.y));
      totalEmissiveRadiance*=grade*(1.-seam*.17);`);
    // Derivative-filtered fibres retain paper grain without high-frequency shimmer.
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 frequency=vec2(193.,279.);vec2 coverage=1.-smoothstep(vec2(.3),vec2(1.),fwidth(paperUv)*frequency);
      float fibres=1.+.014*(sin(paperUv.x*frequency.x)*coverage.x+sin(paperUv.y*frequency.y)*coverage.y);diffuseColor.rgb*=fibres;`);
  };paper.customProgramCacheKey=()=>FAUNA_VERSION+'-paper';
  root.add(mesh(geometry,paper,'Continuous folded translucent paper shell'));
  const parts=[],bamboo=new THREE.MeshStandardMaterial({color:'#806340',roughness:.88});bamboo.name='Fine split bamboo';
  for(const [r,y] of [[.337,.008],[.433,.156]]){const g=new THREE.TorusGeometry(r,.016,8,48);g.rotateX(Math.PI/2);g.translate(0,y,0);parts.push(g);}
  for(let i=0;i<8;i++){
    const a=i/8*TAU,points=profile.slice(0,-1).map(([r,y])=>new THREE.Vector3(Math.cos(a)*r*1.018,y,Math.sin(a)*r*1.018));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.0075,5,false));
  }
  for(let i=0;i<2;i++){const g=new THREE.CylinderGeometry(.008,.008,.668,8);g.rotateZ(Math.PI/2);g.rotateY(i*Math.PI/2);g.translate(0,.008,0);parts.push(g);}
  root.add(mesh(mergeGeometries(parts),bamboo,'Eight fine bamboo ribs, open double rim and crossed brace'));parts.forEach(g=>g.dispose());
  const burner=mesh(new THREE.CylinderGeometry(.068,.074,.030,24),new THREE.MeshStandardMaterial({color:'#342822',roughness:1}),'Cotton fuel pad');burner.position.y=.034;root.add(burner);
  const flameGeometry=new THREE.LatheGeometry([[0,0],[.039,.016],[.048,.055],[.036,.11],[.015,.17],[0,.24]].map(p=>new THREE.Vector2(...p)),24);
  flameGeometry.normalizeNormals();
  const flame=mesh(flameGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color(4.7,2.85,1.04),toneMapped:false}),'Small tapered sheltered flame');flame.position.y=.043;root.add(flame);
  const aura=createFaunaAura(2.8,'#ffc781',.16);aura.position.y=.61;root.add(aura);
  root.userData={assetVersion:FAUNA_VERSION,kind:'paper-lantern',paper,flame,aura};setLanternEnvironment(root,0);return root;
}

export function setLanternEnvironment(object,night=0,fade=1){
  const {paper,flame,aura}=object.userData;
  paper.emissiveIntensity=(.10+2.0*night)*fade;paper.opacity=.94*fade;
  flame.material.opacity=fade;flame.material.transparent=fade<1;
  aura.material.uniforms.opacity.value=.16*night*fade;
}

export function createFirefly(){
  const root=new THREE.Group();root.name='Garden firefly — beetle, wings and luminous abdomen';
  const dark=new THREE.MeshStandardMaterial({color:'#283329',roughness:.72}),wing=new THREE.MeshStandardMaterial({color:'#969b78',roughness:.5,transparent:true,opacity:.52,side:THREE.DoubleSide,depthWrite:false});
  root.add(mesh(ellipsoid([.0053,.0048,.012],[0,0,0],()=>color('#ffffff')),dark,'Elongated thorax'));
  root.add(mesh(ellipsoid([.004,.0036,.004],[0,.001,-.012],()=>color('#ffffff')),dark,'Small beetle head'));
  const abdomen=mesh(ellipsoid([.0048,.0038,.007],[0,-.001,.013],()=>color('#ffffff')),new THREE.MeshStandardMaterial({color:'#d9cb71',emissive:'#d6eb95',emissiveIntensity:3.2,roughness:.65}),'Luminous abdomen');root.add(abdomen);
  for(const sign of[-1,1]){
    root.add(mesh(feather([sign*.002,.002,-.003],[sign*.014,.006,.009],.004,color('#ffffff'),{bend:.002}),wing,sign<0?'Left membranous wing':'Right membranous wing'));
    const feeler=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sign*.002,.003,-.014),new THREE.Vector3(sign*.003,.004,-.020),new THREE.Vector3(sign*.005,.004,-.021)]),8,.00036,4,false);root.add(mesh(feeler,dark,'Curved antenna'));
    for(let i=0;i<3;i++){const z=-.006+i*.005,g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sign*.003,-.002,z),new THREE.Vector3(sign*.008,-.006,z+.002),new THREE.Vector3(sign*.010,-.007,z+.006)]),6,.0004,4,false);root.add(mesh(g,dark,'Fine articulated leg'));}
  }
  const aura=createFaunaAura(.24,'#e8edaa',.3);aura.position.z=.013;root.add(aura);
  root.userData={assetVersion:FAUNA_VERSION,kind:'firefly',abdomen,aura};return root;
}

export function setFireflyGlow(object,amount){object.userData.abdomen.material.emissiveIntensity=.10+3.2*amount;object.userData.aura.material.uniforms.opacity.value=.36*amount;}

export function disposeFaunaSpecimen(root){
  if(!root||root.userData.disposed)return;root.userData.disposed=true;const geometries=new Set(),materials=new Set();
  root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(m);if(object.isInstancedMesh)object.dispose();});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
}
