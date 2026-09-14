import * as THREE from 'three';
import {TAU, V, namedGroup, surfaceGeometry} from './study-geometry.js';

export const ZODIAC = [
  ['rat', '鼠', true], ['ox', '牛', true], ['tiger', '虎', true],
  ['rabbit', '兔', true], ['dragon', '龙', false], ['snake', '蛇', false],
  ['horse', '马', true], ['goat', '羊', false], ['monkey', '猴', true],
  ['rooster', '鸡', false], ['dog', '狗', false], ['pig', '猪', true],
];

function robeGeometry() {
  return surfaceGeometry((u, v) => {
    const angle = u * TAU;
    const radius = .60 - .30 * Math.sin(v * Math.PI / 2) + .035 * Math.cos(angle * 11 + v * 1.7) * (1 - .45 * v);
    const lean = -.10 * v;
    return V(Math.sin(angle) * radius, .16 + v * 1.24, Math.cos(angle) * radius * .71 + lean);
  }, 88, 24);
}

function legacySeatedBody(b, figure, id) {
  const body = namedGroup(figure, `zodiac-${id}-body-stone`, { pose: 'seated robed human body', evidence: 'engraving-supported; individual folds and hand positions inferred' });
  b.box(body, b.m.stone, 0, .065, .08, 1.28, .13, 1.17, .045);
  b.add(body, b.prototype('folded-seated-robe', robeGeometry), b.m.stone);
  b.ellipsoid(body, b.m.stone, [.07, .44, .42], [.58, .21, .31], [0, 0, -.18]);
  b.ellipsoid(body, b.m.relief, [-.19, .25, .55], [.30, .115, .21], [0, .15, 0]);
  b.ellipsoid(body, b.m.relief, [.29, .22, .47], [.24, .12, .17], [0, -.2, 0]);
  b.ellipsoid(body, b.m.stone, [0, 1.2, -.08], [.36, .39, .245]);
  for (const side of [-1, 1]) {
    b.ellipsoid(body, b.m.stone, [side * .36, 1.12, -.035], [.185, .34, .20], [0, 0, side * .32]);
    b.ellipsoid(body, b.m.stone, [side * .34, .90, .18], [.16, .27, .20], [side * -.48, 0, side * -.55]);
    b.ellipsoid(body, b.m.relief, [side * .22, .83, .34], [.115, .065, .115], [0, 0, side * .2]);
    b.tube(body, [[side * .12, 1.55, .075], [side * .26, 1.25, .12], [side * .10, .98, .275]], .035, b.m.relief, 14);
    for (let i = 0; i < 4; i++) b.tube(body, [[side * (.26 + i * .045), .50 + i * .045, .69 - i * .018], [side * (.36 + i * .03), .43, .68], [side * (.41 + i * .028), .25, .56]], .014, b.m.relief, 10);
  }
  b.lathe(body, [[.16, 0], [.18, .06], [.13, .16]], [0, 1.40, -.06], b.m.relief, [1, 1, .85]);
}

function taperedHorn(b, parent, points, radius, material = b.m.copper) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)));
  const frames = curve.computeFrenetFrames(24, false);
  const geometry = surfaceGeometry((u, v) => {
    const index = Math.min(24, Math.round(v * 24)), angle = u * TAU, r = radius * (1 - .96 * v);
    return curve.getPointAt(v).addScaledVector(frames.normals[index], Math.cos(angle) * r).addScaledVector(frames.binormals[index], Math.sin(angle) * r);
  }, 12, 24);
  b.add(parent, geometry, material, undefined, undefined, undefined, true);
}

function legacyCopperHead(b, figure, id) {
  const head = namedGroup(figure, `zodiac-${id}-head-copper`, { originalStatus: ZODIAC.find(x => x[0] === id)[2] ? 'extant-original-reference-available' : 'missing-inferred', meshEvidence: 'authored-proportional-study' });
  head.position.set(0, 1.67, -.065);
  const copper = b.m.copper, dark = b.m.copperDark;
  b.lathe(head, [[.105, -.23], [.15, -.17], [.17, -.07], [.14, .05]], [0, 0, 0], copper, [1, 1, .9]);
  let eyeX = .155, eyeY = .10, eyeZ = .205, mouthZ = .40, mouthY = -.115;
  const skull = (scale = [.225, .27, .25]) => b.ellipsoid(head, copper, [0, .02, 0], scale);
  const ears = (position, scale, tilt = .3, inner = true) => {
    for (const side of [-1, 1]) {
      b.ellipsoid(head, copper, [side * position[0], position[1], position[2]], scale, [0, side * .1, side * -tilt]);
      if (inner) b.ellipsoid(head, dark, [side * position[0], position[1] + .01, position[2] + scale[2] * .84], [scale[0] * .64, scale[1] * .66, .012], [0, side * .1, side * -tilt]);
    }
  };
  if (id === 'rat') {
    skull([.20, .23, .245]); ears([.185, .18, -.035], [.115, .125, .045], .2);
    b.ellipsoid(head, copper, [0, -.07, .265], [.125, .113, .21]);
    b.ellipsoid(head, dark, [0, -.025, .453], [.043, .035, .022]); mouthZ = .46;
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) b.tube(head, [[side * .08, -.068, .38], [side * .20, -.025 + i * .031, .385], [side * .28, -.07 + i * .055, .35]], .006, copper, 8);
  } else if (id === 'ox') {
    skull([.25, .31, .26]); ears([.29, .11, -.01], [.17, .077, .065], -.18);
    b.ellipsoid(head, copper, [0, -.15, .238], [.215, .145, .175]); mouthZ = .412; mouthY = -.20;
    for (const side of [-1, 1]) taperedHorn(b, head, [[side * .17, .23, -.05], [side * .30, .29, -.09], [side * .41, .45, -.10], [side * .33, .58, -.05]], .084);
    eyeX = .18;
  } else if (id === 'tiger') {
    skull([.277, .275, .265]); ears([.21, .23, -.025], [.09, .10, .055], .15);
    for (const side of [-1, 1]) {
      b.ellipsoid(head, copper, [side * .12, -.09, .238], [.14, .14, .125]);
      for (let i = 0; i < 3; i++) b.tube(head, [[side * .19, .12 - i * .09, .19], [side * .26, .08 - i * .10, .17], [side * .25, -.015 - i * .075, .15]], .014, dark, 10);
    }
    b.ellipsoid(head, dark, [0, -.01, .349], [.075, .042, .033]); mouthZ = .358;
    b.tube(head, [[-.095, .23, .15], [0, .175, .223], [.095, .23, .15]], .016, dark, 14);
  } else if (id === 'rabbit') {
    skull([.205, .26, .245]); ears([.12, .41, -.035], [.067, .31, .07], .11);
    for (const side of [-1, 1]) b.ellipsoid(head, copper, [side * .07, -.09, .22], [.092, .105, .125]);
    mouthZ = .34; eyeX = .14;
  } else if (id === 'dragon') {
    skull([.24, .26, .275]); ears([.255, .10, -.10], [.13, .07, .09], -.2);
    b.ellipsoid(head, copper, [0, -.08, .265], [.17, .115, .26]); mouthZ = .50;
    for (const side of [-1, 1]) {
      taperedHorn(b, head, [[side * .15, .20, -.06], [side * .23, .41, -.13], [side * .25, .55, -.03], [side * .35, .65, -.07]], .065);
      taperedHorn(b, head, [[side * .23, .41, -.13], [side * .36, .42, -.22], [side * .40, .52, -.20]], .038);
      b.tube(head, [[side * .11, -.12, .41], [side * .33, -.19, .46], [side * .37, -.08, .50], [side * .31, -.025, .46]], .017, copper, 20);
      for (let i = 0; i < 4; i++) b.leaf(head, [side * .21, -.11 + i * .07, .1 - i * .04], [.14, .27, .35], [0, side * .6, side * -.65], copper);
    }
  } else if (id === 'snake') {
    skull([.205, .195, .29]);
    b.ellipsoid(head, copper, [0, -.03, .21], [.18, .13, .21]);
    for (let row = 0; row < 4; row++) for (let col = -2; col <= 2; col++) b.ellipsoid(head, copper, [col * .056, .14 - row * .041, .23 + row * .028], [.032, .018, .016]);
    mouthZ = .416; mouthY = -.06; eyeY = .06;
  } else if (id === 'horse') {
    skull([.21, .35, .29]); ears([.145, .36, -.11], [.060, .16, .065], .15);
    b.ellipsoid(head, copper, [0, -.17, .27], [.156, .173, .225], [.15, 0, 0]);
    for (let i = 0; i < 13; i++) b.tube(head, [[-.018, .28 - i * .038, -.22], [.008, .25 - i * .038, -.34], [.035, .18 - i * .038, -.29]], .022, copper, 8);
    mouthZ = .468; mouthY = -.265; eyeZ = .18; eyeY = .12;
  } else if (id === 'goat') {
    skull([.205, .29, .255]); ears([.25, .09, -.045], [.14, .065, .065], -.2);
    b.ellipsoid(head, copper, [0, -.12, .225], [.125, .135, .18]);
    for (const side of [-1, 1]) taperedHorn(b, head, [[side * .14, .24, -.02], [side * .21, .45, -.09], [side * .19, .47, -.28], [side * .12, .23, -.33]], .068);
    b.leaf(head, [0, -.33, .20], [.30, .44, .65], [0, 0, Math.PI], copper); mouthZ = .397;
  } else if (id === 'monkey') {
    skull([.237, .273, .233]); ears([.242, .03, -.015], [.086, .104, .05], .02);
    b.ellipsoid(head, copper, [0, -.092, .205], [.145, .135, .08]);
    b.ellipsoid(head, copper, [0, .018, .243], [.060, .07, .05]);
    for (const side of [-1, 1]) b.ring(head, [side * .095, .075, .218], .059, .015, dark, [1.12, .94, .70]);
    eyeX = .10; eyeY = .075; eyeZ = .242; mouthZ = .281; mouthY = -.14;
  } else if (id === 'rooster') {
    skull([.195, .25, .215]);
    for (let i = 0; i < 5; i++) b.ellipsoid(head, copper, [0, .28 + Math.sin(i * Math.PI / 5) * .073, -.16 + i * .067], [.04, .091, .058]);
    b.add(head, new THREE.ConeGeometry(.105, .26, 4), copper, [0, -.015, .283], [1, 1, .66], [Math.PI / 2, 0, Math.PI / 4], true);
    for (const side of [-1, 1]) b.ellipsoid(head, copper, [side * .056, -.23, .14], [.051, .13, .047]);
    eyeX = .14; eyeZ = .14; mouthZ = .40; mouthY = -.055;
  } else if (id === 'dog') {
    skull([.225, .275, .25]);
    ears([.215, .115, -.075], [.094, .235, .10], -.33);
    b.ellipsoid(head, copper, [0, -.105, .255], [.132, .133, .23]);
    b.ellipsoid(head, dark, [0, -.05, .454], [.075, .04, .026]); mouthZ = .46;
  } else if (id === 'pig') {
    skull([.264, .277, .272]); ears([.215, .235, -.04], [.115, .16, .07], .50);
    b.ellipsoid(head, copper, [0, -.105, .26], [.18, .14, .16]);
    for (const side of [-1, 1]) b.ellipsoid(head, dark, [side * .065, -.065, .412], [.035, .026, .012]);
    eyeX = .19; mouthZ = .405; mouthY = -.205;
  }
  for (const side of [-1, 1]) {
    b.ellipsoid(head, dark, [side * eyeX, eyeY, eyeZ], [.025, .016, .012]);
    b.tube(head, [[side * (eyeX - .04), eyeY + .026, eyeZ + .005], [side * eyeX, eyeY + .038, eyeZ + .012], [side * (eyeX + .04), eyeY + .018, eyeZ - .016]], .012, copper, 9);
  }
  // Each head has a visible dark mouth recess and copper lip around the outlet.
  b.ellipsoid(head, dark, [0, mouthY, mouthZ], [.054, .028, .016]);
  b.ring(head, [0, mouthY, mouthZ + .007], .037, .010, copper, [1.52, .78, .75]);
  return [0, 1.67 + mouthY, mouthZ - .065];
}

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

function robePoint(y, angle) {
  const rows = [
    [.145,.46,.32,.06], [.18,.64,.43,.08], [.28,.72,.47,.08],
    [.40,.71,.48,.085], [.51,.62,.40,.05], [.64,.47,.31,.005],
    [.76,.47,.275,-.025], [.88,.55,.26,-.045], [1.02,.53,.245,-.06],
    [1.16,.475,.22,-.075], [1.29,.38,.195,-.08], [1.41,.23,.14,-.08],
    [1.50,.14,.104,-.08], [1.555,.10,.08,-.08],
  ];
  const [rx,rz,cz] = profileAt(rows,y), s=Math.sin(angle), c=Math.cos(angle);
  const x=rx*s, front=Math.max(0,c)**.7, rear=Math.max(0,-c)**2;
  let z=cz+rz*c;
  // The upper sleeve descends to a lateral elbow, then turns forward to the wrist.
  const forearmX=.30+.82*(y-.78);
  z += front*.278*gaussian(Math.abs(x)-forearmX,.135)*gaussian(y-.835,.145);
  z += front*.105*gaussian(Math.abs(x)-.445,.125)*gaussian(y-1.075,.19);
  z -= front*.076*gaussian(Math.abs(x)-(.265+.12*(1.18-y)),.038)*gate(y,.89,1.26,.07);
  // Broad overlapping lapels: flat cloth bands with a recessed inner edge.
  const left=-.13-.17*THREE.MathUtils.smoothstep(1.52-y,0,.39)+.27*THREE.MathUtils.smoothstep(1.20-y,0,.40);
  const right=.13+.085*THREE.MathUtils.smoothstep(1.52-y,0,.28)-.40*THREE.MathUtils.smoothstep(1.26-y,0,.48);
  const collar=gate(y,.77,1.555,.045);
  const band=d=>.046*(Math.tanh((d+.045)/.012)-Math.tanh((d-.035)/.012))*.5-.022*gaussian(d-.048,.014);
  z += front*collar*(band(x-left)+band(x-right));
  // Folds fan down from the bent elbow rather than circling the body in stripes.
  for (const [offset,depth] of [[-.105,.032],[.018,.052],[.125,.027]]) {
    const path=.777+offset+.62*(Math.abs(x)-.27)+.46*(Math.abs(x)-.27)**2;
    z += front*gaussian(Math.abs(x)-.385,.18)*gate(y,.64,1.20)*(.031*gaussian(y-path,.032)-depth*gaussian(y-path-.033,.019));
  }
  // A higher diagonal leg crosses over the lower leg; the weight lands on the seat.
  const lap=gate(y,.17,.62,.035), upper=.405+.18*x-.10*x*x;
  z += front*lap*(.048*gaussian(y-upper,.075)-.067*gaussian(y-upper-.065,.025));
  const lower=.245-.12*x+.065*x*x;
  z += front*lap*(.028*gaussian(y-lower,.053)-.043*gaussian(y-lower-.042,.022));
  for (const [root,tilt,depth] of [[-.48,-.18,.027],[-.23,.25,.018],[.24,-.31,.020],[.50,.22,.027]]) {
    const line=root+tilt*(y-.18);
    z -= front*gate(y,.16,.39,.04)*depth*gaussian(x-line,.025+.045*(y-.17));
  }
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

function sleeveCuff(side) {
  const start=V(side*.34,.853,.355), end=V(side*.277,.752,.478), tangent=end.clone().sub(start).normalize();
  const across=V(0,0,1).cross(tangent).normalize(), depth=tangent.clone().cross(across).normalize(), rings=[];
  const sections=[[0,.108,.065],[.55,.112,.071],[1,.102,.063],[1.008,.078,.038],[.55,.078,.040],[0,.075,.036],[0,.108,.065]];
  for(const [t,rx,ry] of sections) {
    const center=start.clone().lerp(end,t);
    rings.push(Array.from({length:96},(_,j)=>{
      const a=j*TAU/96, irregular=1+.025*Math.cos(3*a+.7);
      return center.clone().addScaledVector(across,Math.cos(a)*rx*irregular).addScaledVector(depth,Math.sin(a)*ry*irregular).toArray();
    }));
  }
  return ringSurface(rings,'thick-turned-sleeve-cuff');
}

function restingHand(b,body,side) {
  const palm=sculptedSweep([[side*.324,.826,.369],[side*.28,.754,.472],[side*.236,.67,.492],[side*.204,.613,.49]],[[0,.037,.022],[.35,.053,.027],[.73,.067,.029],[1,.060,.024]],'resting-hand-palm',64,76);
  b.add(body,palm,b.m.stone,undefined,undefined,undefined,true);
  for(let finger=0;finger<4;finger++) {
    const offset=(finger-1.5)*.030, x=side*(.204+offset), length=[.079,.104,.097,.078][finger];
    const points=[[x,.628,.49],[x-side*.013,.587,.497],[x-side*.025,.623-length,.49],[x-side*.031,.611-length,.478]];
    b.add(body,sculptedSweep(points,[[0,.017,.014],[.38,.016,.015],[.70,.014,.012],[1,.006,.006]],'individual-resting-finger',32,36),b.m.stone,undefined,undefined,undefined,true);
    b.add(body,lensPatch(.010,.016,.0025,'carved-fingernail'),b.m.stone,[x-side*.029,.622-length,.489],undefined,undefined,true);
  }
  b.add(body,sculptedSweep([[side*.192,.692,.498],[side*.153,.658,.514],[side*.135,.614,.506],[side*.151,.595,.498]],[[0,.024,.019],[.45,.023,.020],[.80,.017,.016],[1,.007,.007]],'resting-thumb',36,40),b.m.stone,undefined,undefined,undefined,true);
}

export function seatedBody(b,figure,id) {
  const body=namedGroup(figure,`zodiac-${id}-body-stone`,{pose:'seated robed human body',evidence:'engraving-supported seated pose; continuous robe, folds, hands and unseen back are authored interpretations',construction:'continuous indexed carved robe surface with embedded wrists and turned cuffs'});
  b.box(body,b.m.stone,0,.072,.08,1.47,.144,1.22,.045);
  b.add(body,b.prototype('haiyantang-r3-carved-robe',carvedRobe),b.m.stone);
  for(const side of [-1,1]) {
    b.add(body,b.prototype(`haiyantang-r3-sleeve-cuff-${side}`,()=>sleeveCuff(side)),b.m.stone);
    restingHand(b,body,side);
  }
}

const RAT = {
  id:'rat', mouth:[.034,.013,-.289,.515], eye:[.233,.68,.037,.039],
  profile:[[-.25,.014,.025,.04],[-.22,.165,.23,.058],[-.115,.25,.29,.047],[.035,.255,.30,.022],[.18,.221,.24,-.025],[.305,.155,.166,-.103],[.42,.104,.103,-.191],[.498,.085,.071,-.236]],
  ears:[{root:[.218,.177,-.080],tip:[.287,.405,-.033],width:.066,cup:.044}],
  nose:[.055,.031,-.234,.522],
};

function headPoint(spec,z,angle) {
  const [rx,ry,cy]=profileAt(spec.profile,z), c=Math.cos(angle), s=Math.sin(angle);
  // A broad forehead, malar plane and recessed eye socket remain part of one skin.
  const [ez,ea]=spec.eye, sideAngle=c<0?Math.PI-angle:angle;
  const socket=gaussian(z-ez,.071)*gaussian(sideAngle-ea,.15);
  const brow=gaussian(z-(ez-.025),.075)*gaussian(sideAngle-(ea+.17),.13);
  const cheek=gaussian(z-(ez-.045),.13)*gaussian(sideAngle-(ea-.34),.26);
  const relief=-.017*socket+.018*brow+.014*cheek;
  const forehead=(spec.id==='rat'?.86:1);
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
  const [rx,ry,my,mz]=spec.mouth, outer=rings.at(-1);
  // The muzzle closes around an aperture; its inner wall reaches into the head.
  for(let i=1;i<=18;i++) {
    const t=i/18, s=THREE.MathUtils.smoothstep(t,0,1);
    rings.push(Array.from({length:n},(_,j)=>{
      const a=j*TAU/n, p=outer[j];
      return [THREE.MathUtils.lerp(p[0],Math.cos(a)*rx,s),THREE.MathUtils.lerp(p[1],my+Math.sin(a)*ry,s),THREE.MathUtils.lerp(p[2],mz,t)+.003*Math.sin(t*Math.PI)];
    }));
  }
  for(let i=1;i<=16;i++) {
    const t=i/16;
    rings.push(Array.from({length:n},(_,j)=>[Math.cos(j*TAU/n)*rx*(1-.10*t),my+Math.sin(j*TAU/n)*ry*(1-.10*t),mz-.17*t]));
  }
  rings.push([[0,my,mz-.178]]);
  return ringSurface(rings,`${spec.id}-continuous-cranium-cheek-muzzle-with-waterway`);
}

function cuppedEar(ear,side) {
  const widthSteps=36, lengthSteps=64, vertices=[],uv=[],indices=[];
  for(const back of [false,true]) for(let i=0;i<=lengthSteps;i++) for(let j=0;j<=widthSteps;j++) {
    const t=i/lengthSteps,u=j/widthSteps*2-1;
    const width=(.07+.93*Math.sin(Math.PI*t)**.75)*ear.width;
    const x=side*(THREE.MathUtils.lerp(ear.root[0],ear.tip[0],t)+u*width);
    const y=THREE.MathUtils.lerp(ear.root[1],ear.tip[1],t)+.018*Math.cos(u*Math.PI/2)*Math.sin(t*Math.PI);
    const z=THREE.MathUtils.lerp(ear.root[2],ear.tip[2],t)+ear.cup*(u*u-.72)*Math.sin(Math.PI*t)+.006*gaussian(Math.abs(u)-.92,.10)*Math.sin(Math.PI*t)+(back?-.017:0);
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
  const [nx,ny,y,z]=spec.nose;
  b.add(head,lensPatch(nx,ny,.015,`${spec.id}-nasal-plane`),b.m.copper,[0,y,z],undefined,undefined,true);
  for(const side of [-1,1]) b.add(head,lensPatch(nx*.19,ny*.16,.001,`${spec.id}-nostril-recess`),b.m.copperDark,[side*nx*.51,y-.002,z+.011],undefined,undefined,true);
  return [0,1.67+spec.mouth[2],spec.mouth[3]-.065];
}

export function copperHead(b,figure,id) {
  return id==='rat'?sculptedHead(b,figure,RAT):legacyCopperHead(b,figure,id);
}
