import * as THREE from 'three';
import {TAU, V, namedGroup} from './study-geometry.js';

export const ZODIAC = [
  ['rat', '鼠', true], ['ox', '牛', true], ['tiger', '虎', true],
  ['rabbit', '兔', true], ['dragon', '龙', false], ['snake', '蛇', false],
  ['horse', '马', true], ['goat', '羊', false], ['monkey', '猴', true],
  ['rooster', '鸡', false], ['dog', '狗', false], ['pig', '猪', true],
];

// Profiles are authored proportions from the cited photographs, not measured scans.
// Hermite interpolation preserves the continuous planes of cheek, brow and drapery.
function profileAt(rows, t) {
  let i = 0;
  while (i < rows.length - 2 && t > rows[i + 1][0]) i++;
  const a = rows[i], c = rows[i + 1], p = rows[Math.max(0, i - 1)], n = rows[Math.min(rows.length - 1, i + 2)];
  const span = c[0] - a[0], u = THREE.MathUtils.clamp((t - a[0]) / span, 0, 1);
  return a.slice(1).map((v, j) => {
    const k = j + 1, m0 = (c[k] - p[k]) / (c[0] - p[0]), m1 = (n[k] - a[k]) / (n[0] - a[0]);
    return (2*u**3 - 3*u*u + 1)*v + (u**3 - 2*u*u + u)*span*m0 + (-2*u**3 + 3*u*u)*c[k] + (u**3 - u*u)*span*m1;
  });
}

function ringSurface(rings, name) {
  const positions = [], uv = [], indices = [], offsets = [];
  for (let row = 0; row < rings.length; row++) {
    offsets.push(positions.length / 3);
    for (let i = 0; i < rings[row].length; i++) {
      positions.push(...rings[row][i]); uv.push(i / rings[row].length, row / (rings.length - 1));
    }
  }
  for (let row = 0; row < rings.length - 1; row++) {
    const a = offsets[row], c = offsets[row + 1], an = rings[row].length, cn = rings[row + 1].length;
    if (an === 1) for (let j = 0; j < cn; j++) indices.push(a, c + (j + 1) % cn, c + j);
    else if (cn === 1) for (let j = 0; j < an; j++) indices.push(a + j, a + (j + 1) % an, c);
    else for (let j = 0; j < an; j++) {
      const next = (j + 1) % an;
      indices.push(a+j, a+next, c+next, a+j, c+next, c+j);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

const gaussian = (distance, width) => Math.exp(-((distance / width) ** 2));
const gate = (t, low, high, fade = .08) => THREE.MathUtils.smoothstep(t, low, low + fade) * (1 - THREE.MathUtils.smoothstep(t, high - fade, high));

const ROBE_PROFILE = [
    [.145,.46,.32,.06], [.18,.64,.43,.08], [.28,.72,.47,.08],
    [.40,.71,.48,.085], [.51,.62,.40,.05], [.64,.47,.31,.005],
    [.76,.47,.275,-.025], [.88,.55,.26,-.045], [1.02,.53,.245,-.06],
    [1.16,.475,.22,-.075], [1.29,.38,.195,-.08], [1.41,.23,.14,-.08],
    [1.50,.14,.104,-.08], [1.555,.10,.08,-.08],
];

function robePoint(y, angle) {
  const [rx,rz,cz] = profileAt(ROBE_PROFILE,y), s=Math.sin(angle), c=Math.cos(angle);
  const x=rx*s, front=Math.max(0,c)**.7, rear=Math.max(0,-c)**2;
  let z=cz+rz*c;
  // The upper sleeve descends to a lateral elbow, then turns forward to the wrist.
  const forearmX=.30+.82*(y-.78);
  z += front*.278*gaussian(Math.abs(x)-forearmX,.135)*gaussian(y-.835,.145);
  z += front*.105*gaussian(Math.abs(x)-.445,.125)*gaussian(y-1.075,.19);
  z -= front*.076*gaussian(Math.abs(x)-(.265+.12*(1.18-y)),.038)*gate(y,.89,1.26,.07);
  // Folds fan down from the bent elbow rather than circling the body in stripes.
  for (const [offset,depth,slope] of [[-.14,.028,.37],[-.037,.068,.74],[.078,.045,1.1],[.20,.037,.55]]) {
    const path=.777+offset+slope*(Math.abs(x)-.27)+.46*(Math.abs(x)-.27)**2;
    z += front*gaussian(Math.abs(x)-.385,.18)*gate(y,.61,1.31)*(.041*gaussian(y-path,.037)-depth*gaussian(y-path-.031,.016));
  }
  for(const [offset,depth] of [[0,.032],[.083,.044],[-.065,.023]]) {
    const line=.37+offset+.23*(1.29-y);
    z -= front*gate(y,.97,1.38,.065)*depth*gaussian(Math.abs(x)-line,.017+.025*(1.38-y));
  }
  // Quiet, asymmetric leg volumes support the separate folded lap cloth.
  z += front*gate(y,.18,.61,.055)*(.037*gaussian(y-(.42+.11*x),.13)+.022*gaussian(y-(.26-.13*x),.10));
  z += rear*gate(y,.22,1.39)*(.015*Math.cos(angle*7+1.8*y)+.007*Math.cos(angle*11-2.1*y));
  return [x,y+.027*s*gaussian(y-.37,.17),z];
}

function carvedRobe() {
  const rings=[[[0,.140,.06]]], sides=224, levels=192;
  for(let i=0;i<=levels;i++) {
    const y=THREE.MathUtils.lerp(.145,1.555,i/levels);
    rings.push(Array.from({length:sides},(_,j)=>robePoint(y,j*TAU/sides)));
  }
  rings.push([[0,1.56,-.08]]);
  return ringSurface(rings,'continuous-shoulder-sleeve-crossed-lap-robe');
}

// Closed sweeps provide continuous palm, fingers, horns and locks without ball joints.
function sculptedSweep(points, sections, name, sides=40, steps=64) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))), rings=[];
  for(let i=0;i<=steps;i++) {
    const t=i/steps, center=curve.getPoint(t), tangent=curve.getTangent(t).normalize();
    const reference=Math.abs(tangent.z)>.94?V(0,1,0):V(0,0,1);
    const across=reference.cross(tangent).normalize(), depth=tangent.clone().cross(across).normalize();
    const [rx,ry]=profileAt(sections,t);
    if(i===0)rings.push([center.clone().addScaledVector(tangent,-.002).toArray()]);
    rings.push(Array.from({length:sides},(_,j)=>center.clone().addScaledVector(across,Math.cos(j*TAU/sides)*rx).addScaledVector(depth,Math.sin(j*TAU/sides)*ry).toArray()));
    if(i===steps)rings.push([center.clone().addScaledVector(tangent,.002).toArray()]);
  }
  return ringSurface(rings,name);
}

function bodyFront(x,y) {
  const [rx]=profileAt(ROBE_PROFILE,y);
  return robePoint(y,Math.asin(THREE.MathUtils.clamp(x/rx,-.998,.998)))[2];
}

// A cloth patch has an actual turned edge and thickness, not a line on the body.
function clothPatch(sample,name,thickness=.017,nu=112,nv=112) {
  const positions=[],uv=[],indices=[],normals=[];
  for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++) {
    const x=u/nu,y=v/nv,p=V(...sample(x,y));
    const du=V(...sample(Math.min(1,x+.0001),y)).sub(V(...sample(Math.max(0,x-.0001),y)));
    const dv=V(...sample(x,Math.min(1,y+.0001))).sub(V(...sample(x,Math.max(0,y-.0001))));
    const n=dv.cross(du).normalize(); if(n.z<0)n.negate();
    positions.push(...p.toArray());normals.push(n);uv.push(x,y);
  }
  const stride=nu+1,layer=(nv+1)*stride;
  for(let i=0;i<layer;i++) {
    positions.push(positions[i*3]-normals[i].x*thickness,positions[i*3+1]-normals[i].y*thickness,positions[i*3+2]-normals[i].z*thickness);
    uv.push(uv[i*2],uv[i*2+1]);
  }
  for(let v=0;v<nv;v++)for(let u=0;u<nu;u++) {
    const a=v*stride+u,c=a+stride;
    indices.push(a,c,a+1,a+1,c,c+1,a+layer,a+1+layer,c+layer,a+1+layer,c+1+layer,c+layer);
  }
  const edge=[];
  for(let u=0;u<=nu;u++)edge.push(u);
  for(let v=1;v<=nv;v++)edge.push(v*stride+nu);
  for(let u=nu-1;u>=0;u--)edge.push(nv*stride+u);
  for(let v=nv-1;v>0;v--)edge.push(v*stride);
  for(let i=0;i<edge.length;i++){const a=edge[i],c=edge[(i+1)%edge.length];indices.push(a,c,c+layer,a,c+layer,a+layer);}
  const geometry=new THREE.BufferGeometry();geometry.name=name;
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function lapel(side) {
  const points=side>0?[[.105,1.552,0],[.226,1.29,0],[.062,1.045,0],[-.218,.788,0]]:[[-.105,1.552,0],[-.214,1.30,0],[-.035,1.062,0],[.125,.941,0]];
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
  return clothPatch((u,t)=>{
    const center=curve.getPoint(t),d=curve.getTangent(t),width=.058+.043*Math.sin(t*Math.PI*.82);
    const across=V(-d.y,d.x,0).normalize();if(across.x<0)across.negate();
    center.addScaledVector(across,(u*2-1)*width);
    const y=THREE.MathUtils.clamp(center.y,.15,1.552),z=bodyFront(center.x,y)+.014+(side>0?.017:0)+.005*Math.sin(u*Math.PI);
    return [center.x,y,z];
  },side>0?'overlapping-outer-lapel-with-folded-edge':'inner-layer-lapel',.024,48,144);
}

function lapCloth() {
  return clothPatch((u,v)=>{
    const across=u*2-1,x=across*(.64-.09*v),top=.60+.055*across-.073*across*across,bottom=.169+.16*Math.abs(across)**1.8;
    const y=THREE.MathUtils.lerp(top,bottom,v);
    let z=bodyFront(x,y)+.027;
    z += .042*gaussian(v-(.27+.30*across*across+.07*across),.065)-.019*gaussian(v-(.36+.26*across*across+.07*across),.043);
    z += .057*gaussian(v-(.69-.16*across+.07*across*across),.074)-.025*gaussian(v-(.80-.16*across),.040);
    z += .035*gaussian(across-.43,.20)*Math.sin(Math.PI*v)-.025*gaussian(across+.42,.09)*Math.sin(Math.PI*v);
    z += .011*gaussian(v-.985,.02);
    return [x,y,z];
  },'lap-drapery-with-cascading-folds-and-returned-hem',.019,160,136);
}

function sleeveCuff(side) {
  const curve=new THREE.CatmullRomCurve3([[side*.466,.948,.233],[side*.369,.844,.381],[side*.181,.747,.492]].map(p=>V(...p))),rings=[],n=112,levels=80;
  const ring=(t,inner)=>{
    const center=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),across=V(0,0,1).cross(tangent).normalize(),depth=tangent.clone().cross(across).normalize();
    return Array.from({length:n},(_,j)=>{
      const a=j*TAU/n,flare=.145+.035*t,fold=1+.065*Math.cos(3*a+1.1*t)+.031*Math.cos(7*a-.8*t);
      const rx=(flare-(inner?.017:0))*fold,ry=(.101+.034*t-(inner?.017:0))*fold;
      const p=center.clone().addScaledVector(across,Math.cos(a)*rx).addScaledVector(depth,Math.sin(a)*ry);
      p.y-=.078*Math.sin(Math.PI*.5*t)**2*Math.max(0,-Math.cos(a)*across.y-Math.sin(a)*depth.y)**1.25;
      p.z+=.012*t*t*Math.cos(2*a+.8);
      return p.toArray();
    });
  };
  for(let i=0;i<=levels;i++)rings.push(ring(i/levels,false));
  for(let i=levels;i>=0;i--)rings.push(ring(i/levels,true));
  rings.push(ring(0,false));
  return ringSurface(rings,'broad-draped-sleeve-with-hollow-turned-cuff');
}

function restingHand(b,body,side) {
  const lift=side>0?.024:0;
  b.add(body,sculptedSweep([[side*.324,.826,.369],[side*.210,.747,.481],[side*.108,.674+lift,.520],[side*.020,.655+lift,.518]],[[0,.037,.022],[.32,.041,.023],[.67,.061,.027],[1,.052,.023]],'resting-hand-palm',64,80),b.m.stone,undefined,undefined,undefined,true);
  for(let finger=0;finger<4;finger++) {
    const spread=(finger-1.5)*.025,y=.655+lift+spread,length=[.080,.107,.104,.083][finger],z=.518+.005*Math.cos(finger*1.1);
    const points=[[side*.035,y,z],[-side*.020,y-.011,z+.004],[-side*(length-.020),y-.016,z],[-side*length,y-.024,z-.013]];
    b.add(body,sculptedSweep(points,[[0,.015,.013],[.35,.014,.013],[.71,.012,.010],[1,.005,.005]],'overlapping-relaxed-finger',32,40),b.m.stone,undefined,undefined,undefined,true);
    b.add(body,lensPatch(.014,.008,.002,'carved-fingernail'),b.m.stone,[-side*(length-.009),y-.022,z-.006],undefined,undefined,true);
  }
  b.add(body,sculptedSweep([[side*.14,.708+lift,.521],[side*.085,.710+lift,.541],[side*.041,.690+lift,.550],[side*.015,.681+lift,.541]],[[0,.022,.018],[.45,.021,.018],[.8,.015,.014],[1,.006,.006]],'relaxed-opposed-thumb',36,44),b.m.stone,undefined,undefined,undefined,true);
}

export function seatedBody(b,figure,id) {
  const body=namedGroup(figure,`zodiac-${id}-body-stone`,{pose:'seated robed human body',evidence:'engraving-supported seated pose; continuous robe, folds, overlapping hands and unseen back are authored interpretations',construction:'continuous indexed carved robe, layered cloth, draped cuffs and embedded wrists'});
  b.box(body,b.m.stone,0,.072,.08,1.47,.144,1.22,.045);
  b.add(body,b.prototype('haiyantang-r3-carved-robe',carvedRobe),b.m.stone);
  for(const side of [-1,1]) {
    b.add(body,b.prototype(`haiyantang-r3-lapel-${side}`,()=>lapel(side)),b.m.stone);
    b.add(body,b.prototype(`haiyantang-r3-sleeve-cuff-${side}`,()=>sleeveCuff(side)),b.m.stone);
    restingHand(b,body,side);
  }
  b.add(body,b.prototype('haiyantang-r3-lap-cloth',lapCloth),b.m.stone);
}

const RAT = {
  id:'rat', mouth:[.036,.014,-.221,.372], eye:[.197,.65,.036,.038],
  profile:[[-.25,.014,.025,.035],[-.218,.177,.244,.035],[-.105,.266,.308,.02],[.045,.272,.294,.003],[.177,.248,.24,-.025],[.270,.178,.166,-.074],[.334,.119,.111,-.126],[.365,.097,.091,-.151]],
  ears:[{root:[.230,.187,-.082],tip:[.292,.413,-.035],width:.066,cup:.044}],
  nose:[.060,.027,-.146,.369],
};

// Seven entries follow the original-object photographs recorded in research notes.
// The other five are deliberately labelled missing-inferred by the public factory.
const HEADS = {
  rat:RAT,
  ox:{id:'ox',mouth:[.094,.031,-.211,.437],mouthCornerDepth:.038,eye:[.208,.70,.044,.045],nose:[.117,.052,-.100,.427],
    profile:[[-.275,.015,.025,.035],[-.227,.185,.257,.035],[-.09,.273,.327,.016],[.07,.274,.303,-.009],[.216,.237,.224,-.065],[.338,.184,.150,-.098],[.426,.149,.128,-.102]],
    ears:[{root:[.257,.123,-.055],tip:[.540,.056,-.070],width:.077,cup:.050,rootWidth:.35}],
    horns:[[[.17,.259,-.084],[.284,.384,-.147],[.412,.350,-.130],[.532,.244,-.050],[.579,.278,.009]]],hornRadius:.071},
  tiger:{id:'tiger',mouth:[.149,.105,-.174,.414],mouthCornerDepth:.072,eye:[.237,.70,.043,.038],nose:[.080,.034,.011,.399],cheek:.030,angular:.89,
    profile:[[-.27,.014,.026,.035],[-.223,.215,.28,.027],[-.08,.293,.324,.015],[.08,.289,.291,.008],[.222,.251,.24,-.009],[.329,.216,.183,-.035],[.402,.181,.165,-.055]],
    ears:[{root:[.236,.228,-.076],tip:[.289,.420,-.086],width:.073,cup:.031}],fangs:true,ruff:true},
  rabbit:{id:'rabbit',mouth:[.077,.032,-.177,.372],mouthCornerDepth:.025,eye:[.205,.68,.040,.043],nose:[.047,.026,-.069,.356],cheek:.031,
    profile:[[-.25,.014,.025,.047],[-.205,.167,.253,.041],[-.073,.25,.325,.029],[.083,.253,.287,.008],[.217,.223,.218,-.055],[.313,.175,.141,-.090],[.361,.137,.115,-.105]],
    ears:[{root:[.141,.283,-.104],tip:[.249,.779,-.094],width:.082,cup:.058,rootWidth:.25,asymmetry:.036}]},
  horse:{id:'horse',mouth:[.080,.044,-.312,.471],mouthCornerDepth:.047,eye:[.130,.79,.037,.027],nose:[.112,.052,-.177,.459],angular:.91,
    profile:[[-.26,.014,.027,.068],[-.207,.170,.334,.069],[-.063,.217,.391,.033],[.093,.223,.343,-.03],[.254,.175,.252,-.141],[.383,.146,.174,-.203],[.461,.139,.141,-.224]],
    ears:[{root:[.145,.321,-.096],tip:[.192,.589,-.071],width:.060,cup:.033,rootWidth:.24}],mane:true},
  monkey:{id:'monkey',mouth:[.078,.027,-.154,.359],mouthCornerDepth:.034,eye:[.224,.74,.040,.045],nose:[.048,.026,-.056,.344],mask:true,
    profile:[[-.25,.014,.025,.041],[-.20,.177,.239,.052],[-.06,.256,.295,.034],[.09,.248,.262,.018],[.218,.195,.196,-.017],[.304,.143,.125,-.075],[.351,.119,.086,-.101]],
    ears:[{root:[.229,.147,-.108],tip:[.284,.286,-.12],width:.049,cup:.024,rootWidth:.3}]},
  pig:{id:'pig',mouth:[.100,.041,-.185,.459],mouthCornerDepth:.057,eye:[.156,.69,.034,.026],nose:[.133,.065,-.053,.447],bridgeFolds:true,
    profile:[[-.265,.014,.025,.041],[-.216,.195,.285,.037],[-.066,.293,.329,.025],[.101,.279,.281,-.014],[.263,.205,.180,-.073],[.381,.149,.126,-.097],[.45,.134,.111,-.099]],
    ears:[{root:[.222,.244,-.082],tip:[.328,-.281,.031],width:.114,cup:.052,rootWidth:.76,bend:.043}],tusks:true},
  dragon:{id:'dragon',mouth:[.123,.053,-.177,.484],mouthCornerDepth:.04,eye:[.217,.70,.041,.028],nose:[.108,.039,-.065,.471],cheek:.025,angular:.87,
    profile:[[-.27,.013,.025,.034],[-.22,.186,.253,.04],[-.075,.257,.297,.021],[.099,.266,.263,-.008],[.255,.211,.195,-.046],[.385,.180,.139,-.082],[.473,.162,.119,-.103]],
    ears:[{root:[.225,.137,-.12],tip:[.413,.184,-.20],width:.081,cup:.035}],
    horns:[[[.150,.239,-.115],[.206,.424,-.16],[.241,.57,-.08],[.321,.661,-.093]],[[.207,.421,-.154],[.348,.460,-.233],[.376,.568,-.249]]],hornRadius:.051,fangs:true,dragon:true},
  snake:{id:'snake',mouth:[.083,.017,-.068,.399],mouthCornerDepth:.025,eye:[.227,.47,.032,.022],nose:null,angular:.79,scutes:true,
    profile:[[-.253,.011,.019,.007],[-.205,.188,.130,.01],[-.061,.276,.173,.008],[.116,.279,.153,.004],[.274,.230,.117,-.016],[.386,.185,.087,-.020]],ears:[]},
  goat:{id:'goat',mouth:[.067,.025,-.197,.389],mouthCornerDepth:.027,eye:[.187,.69,.037,.031],nose:[.066,.034,-.109,.377],angular:.94,
    profile:[[-.242,.013,.025,.018],[-.199,.156,.241,.027],[-.071,.222,.286,.015],[.091,.218,.263,-.014],[.239,.162,.18,-.069],[.325,.125,.127,-.103],[.381,.10,.097,-.128]],
    ears:[{root:[.208,.116,-.064],tip:[.425,.068,-.111],width:.069,cup:.033,rootWidth:.3}],
    horns:[[[.128,.254,-.072],[.180,.45,-.113],[.207,.570,-.27],[.163,.540,-.374]]],hornRadius:.058,beard:true},
  rooster:{id:'rooster',mouth:[.026,.013,-.073,.397],eye:[.141,.64,.029,.026],nose:null,angular:.94,
    profile:[[-.238,.011,.02,.018],[-.19,.152,.222,.025],[-.066,.202,.267,.022],[.102,.186,.229,.001],[.248,.118,.118,-.025],[.334,.072,.07,-.036],[.389,.035,.039,-.056]],ears:[],comb:true},
  dog:{id:'dog',mouth:[.084,.034,-.190,.439],mouthCornerDepth:.031,eye:[.185,.69,.036,.028],nose:[.088,.043,-.093,.428],cheek:.017,
    profile:[[-.261,.013,.025,.02],[-.211,.180,.265,.025],[-.062,.25,.311,.022],[.101,.251,.274,-.003],[.256,.183,.18,-.066],[.362,.141,.131,-.100],[.431,.121,.099,-.123]],
    ears:[{root:[.206,.236,-.092],tip:[.282,.492,-.134],width:.076,cup:.036,rootWidth:.27}]},
};

function headPoint(spec,z,angle) {
  const [rx,ry,cy]=profileAt(spec.profile,z), c=Math.cos(angle), s=Math.sin(angle);
  // A broad forehead, malar plane and recessed eye socket remain part of one skin.
  const [ez,ea]=spec.eye, sideAngle=c<0?Math.PI-angle:angle;
  const socket=gaussian(z-ez,.071)*gaussian(sideAngle-ea,.15);
  const brow=gaussian(z-(ez-.025),.075)*gaussian(sideAngle-(ea+.17),.13);
  const cheek=gaussian(z-(ez-.045),.13)*gaussian(sideAngle-(ea-.34),.26);
  let relief=-.009*socket+.010*brow+.019*cheek;
  relief+=(spec.cheek??0)*gaussian(z-(spec.profile.at(-1)[0]-.105),.095)*gaussian(sideAngle+.10,.42);
  if(spec.bridgeFolds)for(let i=0;i<4;i++)relief-=.0026*gaussian(z-(.273+i*.024),.007)*Math.max(0,s)**3;
  if(spec.mask)relief-=.004*gaussian(z-(.155+.065*Math.cos(sideAngle*2)),.010)*gate(sideAngle,-.5,1.6,.15);
  const forehead=spec.angular??(spec.id==='rat'?.89:1);
  const x=Math.sign(c)*Math.abs(c)**forehead*(rx+relief);
  const y=cy+Math.sign(s)*Math.abs(s)**forehead*(ry+relief);
  return V(x,y,z);
}

function continuousHead(spec) {
  const n=160, levels=144, first=spec.profile[0], last=spec.profile.at(-1), rings=[[[0,first[3],first[0]-.003]]];
  for(let i=0;i<=levels;i++) {
    const z=THREE.MathUtils.lerp(first[0],last[0],i/levels);
    rings.push(Array.from({length:n},(_,j)=>headPoint(spec,z,j*TAU/n).toArray()));
  }
  const [rx,ry,my,mz]=spec.mouth, outer=rings.at(-1), apertureZ=a=>mz-(spec.mouthCornerDepth??0)*Math.abs(Math.cos(a))**1.7;
  // The muzzle closes around an aperture; its inner wall reaches into the head.
  for(let i=1;i<=18;i++) {
    const t=i/18, s=THREE.MathUtils.smoothstep(t,0,1);
    rings.push(Array.from({length:n},(_,j)=>{
      const a=j*TAU/n, p=outer[j];
      return [THREE.MathUtils.lerp(p[0],Math.cos(a)*rx,s),THREE.MathUtils.lerp(p[1],my+Math.sin(a)*ry,s),THREE.MathUtils.lerp(p[2],apertureZ(a),t)+.002*Math.sin(t*Math.PI)];
    }));
  }
  for(let i=1;i<=16;i++) {
    const t=i/16;
    rings.push(Array.from({length:n},(_,j)=>[Math.cos(j*TAU/n)*rx*(1-.10*t),my+Math.sin(j*TAU/n)*ry*(1-.10*t),apertureZ(j*TAU/n)-.17*t]));
  }
  rings.push([[0,my,mz-.178]]);
  return ringSurface(rings,`${spec.id}-continuous-cranium-cheek-muzzle-with-waterway`);
}

function cuppedEar(ear,side) {
  const widthSteps=36, lengthSteps=64, vertices=[],uv=[],indices=[];
  for(const back of [false,true]) for(let i=0;i<=lengthSteps;i++) for(let j=0;j<=widthSteps;j++) {
    const t=i/lengthSteps,u=j/widthSteps*2-1;
    const rootWidth=ear.rootWidth??.12,width=(rootWidth*(1-t)+(.98-rootWidth*.5)*Math.sin(Math.PI*t)**.75)*ear.width;
    const dx=ear.tip[0]-ear.root[0],dy=ear.tip[1]-ear.root[1],span=Math.hypot(dx,dy),acrossX=dy/span,acrossY=-dx/span;
    const x=side*(THREE.MathUtils.lerp(ear.root[0],ear.tip[0],t)+u*width*acrossX+(ear.bend??0)*Math.sin(Math.PI*t));
    const y=THREE.MathUtils.lerp(ear.root[1],ear.tip[1],t)+u*width*acrossY+(side<0?(ear.asymmetry??0)*t:0);
    const z=THREE.MathUtils.lerp(ear.root[2],ear.tip[2],t)+ear.cup*(u*u-.72)*Math.sin(Math.PI*t)+.006*gaussian(Math.abs(u)-.92,.10)*Math.sin(Math.PI*t)+(back?-.017:0)+(side<0?(ear.asymmetry??0)*t:0);
    vertices.push(x,y,z);uv.push(j/widthSteps,t);
  }
  const stride=widthSteps+1, layer=(lengthSteps+1)*stride;
  for(let i=0;i<lengthSteps;i++)for(let j=0;j<widthSteps;j++) {
    const a=i*stride+j,c=a+stride;
    const front=side>0?[a,a+1,c+1,a,c+1,c]:[a,c+1,a+1,a,c,c+1];
    indices.push(...front,...[front[0]+layer,front[2]+layer,front[1]+layer,front[3]+layer,front[5]+layer,front[4]+layer]);
  }
  const edge=[];
  for(let j=0;j<=widthSteps;j++)edge.push(j);
  for(let i=1;i<=lengthSteps;i++)edge.push(i*stride+widthSteps);
  for(let j=widthSteps-1;j>=0;j--)edge.push(lengthSteps*stride+j);
  for(let i=lengthSteps-1;i>0;i--)edge.push(i*stride);
  for(let i=0;i<edge.length;i++) {
    const a=edge[i],c=edge[(i+1)%edge.length];
    if(side>0)indices.push(a,c+layer,c,a,a+layer,c+layer);else indices.push(a,c,c+layer,a,c+layer,a+layer);
  }
  const g=new THREE.BufferGeometry();g.name='folded-cupped-ear';
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function lensPatch(rx,ry,depth,name='sculpted-anatomical-patch') {
  const rings=[[[0,0,depth]]],n=64;
  // Disk faces +Z, with a solid back recessed into the surrounding sculpture.
  for(let i=1;i<=18;i++) {
    const r=i/18;
    rings.push(Array.from({length:n},(_,j)=>[Math.cos(j*TAU/n)*rx*r,Math.sin(j*TAU/n)*ry*r,depth*Math.sqrt(Math.max(0,1-r*r))]));
  }
  rings.push([[0,0,-.006]]);
  const g=ringSurface(rings,name);
  // Radial order is the reverse of a longitudinal loft.
  const index=g.index;for(let i=0;i<index.count;i+=3){const v=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,v);}g.computeVertexNormals();return g;
}

function eyeDetail(b,head,spec,side) {
  const [z,angle,rx,ry]=spec.eye,theta=side>0?angle:Math.PI-angle;
  const p=headPoint(spec,z,theta),before=headPoint(spec,z-.001,theta),after=headPoint(spec,z+.001,theta);
  const around=headPoint(spec,z,theta+.001).sub(headPoint(spec,z,theta-.001));
  const normal=around.cross(after.sub(before)).normalize();p.addScaledVector(normal,.001);
  const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),normal);
  b.add(head,lensPatch(rx,ry,.019,`${spec.id}-inset-ocular-surface`),b.m.copper,p.toArray(),undefined,q,true);
  const rim=[];
  for(let i=0;i<=72;i++) {
    const a=i*TAU/72;
    rim.push(V(Math.cos(a)*(rx+.002),Math.sin(a)*(ry+.002),.004).applyQuaternion(q).add(p));
  }
  b.tube(head,rim,.0027,b.m.copper,72);
}

function noseDetail(b,head,spec) {
  const [rx,ry,y,z]=spec.nose,depth=spec.id==='pig'?.020:.011;
  b.add(head,lensPatch(rx,ry,depth,`${spec.id}-nasal-plane`),b.m.copper,[0,y,z-.008],undefined,undefined,true);
  for(const side of [-1,1]) {
    const nx=rx*(spec.id==='pig'?.49:.55),nr=rx*(spec.id==='pig'?.16:.18);
    b.add(head,lensPatch(nr,ry*.24,.002,`${spec.id}-nostril-recess`),b.m.copperDark,[side*nx,y,z+depth*.63-.008],undefined,undefined,true);
    if(['ox','horse','pig'].includes(spec.id)) {
      const rim=[];for(let i=0;i<=56;i++){const a=i*TAU/56;rim.push([side*nx+Math.cos(a)*nr*1.2,y+Math.sin(a)*ry*.31,z+depth*.59-.008]);}
      b.tube(head,rim,.0028,b.m.copper,56);
    }
  }
}

function surfaceTrace(b,head,spec,coordinates,radius=.0015) {
  const points=coordinates.map(([z,a])=>headPoint(spec,z,a).toArray());
  b.add(head,sculptedSweep(points,[[0,radius*.25,radius*.25],[.25,radius,radius],[.8,radius,radius],[1,radius*.25,radius*.25]],'restrained-surface-carving',12,Math.max(20,coordinates.length*4)),b.m.copper,undefined,undefined,undefined,true);
}

function combGeometry() {
  const s=new THREE.Shape();s.moveTo(-.195,.213);
  s.bezierCurveTo(-.212,.305,-.207,.388,-.17,.415);s.bezierCurveTo(-.146,.40,-.137,.352,-.121,.362);
  s.bezierCurveTo(-.095,.412,-.086,.493,-.048,.484);s.bezierCurveTo(-.021,.458,-.032,.408,-.003,.407);
  s.bezierCurveTo(.021,.446,.041,.499,.070,.481);s.bezierCurveTo(.095,.449,.079,.389,.100,.374);
  s.bezierCurveTo(.122,.410,.15,.446,.174,.425);s.bezierCurveTo(.199,.371,.190,.316,.173,.251);
  s.bezierCurveTo(.07,.276,-.06,.273,-.195,.213);
  const geometry=new THREE.ExtrudeGeometry(s,{depth:.025,bevelEnabled:true,bevelThickness:.009,bevelSize:.009,bevelSegments:5,curveSegments:20,steps:1});
  geometry.translate(0,0,-.0125);geometry.rotateY(Math.PI/2);geometry.name='continuous-scalloped-rooster-comb';return geometry;
}

function animalDetails(b,head,spec) {
  for(const side of [-1,1]) {
    for(const points of spec.horns??[]) {
      const radius=(spec.hornRadius??.055)*(points.length===3?.6:1),path=points.map(([x,y,z])=>[side*x,y,z]);
      b.add(head,sculptedSweep(path,[[0,radius,radius],[.22,radius*.91,radius*.87],[.57,radius*.61,radius*.58],[.84,radius*.29,radius*.25],[1,.002,.002]],'tapered-curved-anatomical-horn',56,112),b.m.copper,undefined,undefined,undefined,true);
    }
    if(spec.fangs) {
      const [rx,ry,my,mz]=spec.mouth;
      const x=side*rx*.70,z=mz-(spec.mouthCornerDepth??0)*.55;
      b.add(head,sculptedSweep([[x,my+ry*.83,z-.013],[x*.97,my+ry*.48,z+.009],[x*.90,my+ry*.07,z+.006]],[[0,.019,.017],[.55,.012,.012],[1,.0018,.0018]],'curved-upper-canine',32,40),b.m.copper,undefined,undefined,undefined,true);
    }
    if(spec.tusks) b.add(head,sculptedSweep([[side*.098,-.183,.409],[side*.115,-.138,.43],[side*.110,-.106,.418]],[[0,.018,.017],[.55,.012,.010],[1,.002,.002]],'small-pig-canine',32,44),b.m.copper,undefined,undefined,undefined,true);
    if(spec.dragon) {
      b.add(head,sculptedSweep([[side*.136,-.125,.384],[side*.276,-.194,.410],[side*.33,-.16,.46],[side*.315,-.07,.436]],[[0,.014,.013],[.55,.011,.010],[1,.002,.002]],'inferred-dragon-muzzle-tendril',36,80),b.m.copper,undefined,undefined,undefined,true);
    }
    if(spec.mask) {
      const a=side>0?1:0;
      surfaceTrace(b,head,spec,[[.118,a?1.48:1.66],[.15,a?1.18:1.96],[.19,a?.95:2.19],[.165,a?.46:2.68],[.193,a?.13:3.01],[.27,a?-.11:3.25]],.0025);
    }
  }
  if(['ox','tiger','rabbit','monkey','pig','dog','dragon','horse'].includes(spec.id)) {
    const [rx,ry,my,mz]=spec.mouth;
    for(let tooth=0;tooth<8;tooth++) {
      const x=(tooth-3.5)*rx*.18,y=my-ry*.85,z=mz-(spec.mouthCornerDepth??0)*Math.abs(x/rx)**1.7-.009;
      b.add(head,sculptedSweep([[x,y-.009,z-.006],[x,y+.006,z]],[[0,rx*.059,.008],[.7,rx*.054,.008],[1,rx*.037,.005]],'small-lower-incisor',20,16),b.m.copper,undefined,undefined,undefined,true);
    }
  }
  if(spec.ruff) {
    for(let i=0;i<42;i++) {
      const a=.02+i*Math.PI/41,p=headPoint(spec,-.115,-a),normal=V(p.x,p.y-.01,0).normalize();
      const end=p.clone().addScaledVector(normal,.035).add(V(0,-.052,-.016));
      b.add(head,sculptedSweep([p.clone().add(V(0,.042,-.014)).toArray(),p.clone().addScaledVector(normal,.014).toArray(),end.toArray()],[[0,.016,.010],[.4,.017,.013],[1,.002,.002]],'carved-tiger-jaw-ruff-lock',20,32),b.m.copper,undefined,undefined,undefined,true);
    }
    for(const side of [-1,1])for(let i=0;i<3;i++) {
      const a=side>0?.88:Math.PI-.88;
      surfaceTrace(b,head,spec,[[.035+i*.041,a+.18],[.090+i*.036,a],[.132+i*.021,a-.18]],.0018);
    }
  }
  if(spec.mane) {
    for(let i=0;i<17;i++) {
      const y=.358-i*.035,x=.025*Math.sin(i*.8);
      b.add(head,sculptedSweep([[x,y,-.189],[x-.024,y-.045,-.29],[x+.025,y-.107,-.345],[x+.014,y-.162,-.293]],[[0,.024,.016],[.32,.028,.020],[.74,.015,.013],[1,.002,.002]],'flowing-horse-mane-lock',28,52),b.m.copper,undefined,undefined,undefined,true);
    }
    for(let i=-2;i<=2;i++)b.add(head,sculptedSweep([[i*.025,.357,-.036],[i*.032,.346,.053],[i*.022,.246,.16]],[[0,.017,.012],[.55,.021,.016],[1,.002,.002]],'horse-forelock',24,44),b.m.copper,undefined,undefined,undefined,true);
  }
  if(spec.beard)for(let i=-3;i<=3;i++) b.add(head,sculptedSweep([[i*.022,-.182,.228],[i*.021,-.286,.242],[i*.014,-.428+.014*Math.abs(i),.198]],[[0,.020,.013],[.5,.024,.017],[1,.002,.002]],'inferred-goat-beard-lock',24,52),b.m.copper,undefined,undefined,undefined,true);
  if(spec.comb) {
    b.add(head,combGeometry(),b.m.copper,undefined,undefined,undefined,true);
    for(const side of [-1,1])b.add(head,cuppedEar({root:[.045,-.079,.158],tip:[.060,-.336,.148],width:.06,cup:.026,rootWidth:.62},side),b.m.copper,undefined,undefined,undefined,true);
  }
  if(spec.scutes)for(let row=0;row<5;row++)for(let col=0;col<5;col++) {
    const z=-.01+row*.060,a=.46+col*.54,path=[];
    for(let j=0;j<=6;j++){const t=j*TAU/6;path.push([z+.029*Math.cos(t),a+.24*Math.sin(t)]);}
    surfaceTrace(b,head,spec,path,.0013);
  }
  // Local, sparse incisions follow cheek planes; no periodic whole-head noise field.
  if(['rat','rabbit','ox','monkey'].includes(spec.id))for(const side of [-1,1])for(let i=0;i<20;i++) {
    const z=-.07+(i%5)*.037,a=.02+Math.floor(i/5)*.115,theta=side>0?a:Math.PI-a;
    surfaceTrace(b,head,spec,[[z,theta],[z+.011,theta+(side>0?.015:-.015)],[z+.028,theta+(side>0?.021:-.021)]],.00045);
  }
}

function sculptedHead(b,figure,spec) {
  const original=ZODIAC.find(x=>x[0]===spec.id)[2];
  const head=namedGroup(figure,`zodiac-${spec.id}-head-copper`,{originalStatus:original?'extant-original-reference-available':'missing-inferred',meshEvidence:'authored-proportional-study',surfaceEvidence:original?'visible original photographs guide contour; back and attachment inferred':'authored animal anatomy; original appearance unverified',construction:'continuous cranium and muzzle with recessed water passage'});
  head.position.set(0,1.67,-.065);
  b.add(head,continuousHead(spec),b.m.copper,undefined,undefined,undefined,true);
  b.lathe(head,[[.12,-.30],[.145,-.26],[.16,-.13],[.145,-.035]],[0,0,-.04],b.m.copper,[1,1,1],64);
  for(const side of [-1,1]) {
    for(const ear of spec.ears??[])b.add(head,cuppedEar(ear,side),b.m.copper,undefined,undefined,undefined,true);
    eyeDetail(b,head,spec,side);
  }
  if(spec.nose) noseDetail(b,head,spec);
  animalDetails(b,head,spec);
  return [0,1.67+spec.mouth[2],spec.mouth[3]-.065];
}

export function copperHead(b,figure,id) {
  const spec=HEADS[id];
  if(!spec)throw new RangeError(`Unknown zodiac head: ${id}`);
  return sculptedHead(b,figure,spec);
}
