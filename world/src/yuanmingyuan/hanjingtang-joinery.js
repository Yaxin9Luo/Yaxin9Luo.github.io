import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { namedGroup } from './study-geometry.js';
import { column, dougong, paintedBeam } from './hanjingtang-architecture.js';

export function moonScreenGeometry(width = 3.3, height = 3.6, radius = 1.20, centerY = 1.56) {
  // Two closed timber members. The spandrels are open; carved branches connect
  // the circular moulding and the outside frame in sanyouMoonScreen below.
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-width / 2 + .13, .18); hole.lineTo(-width / 2 + .13, height - .13); hole.lineTo(width / 2 - .13, height - .13); hole.lineTo(width / 2 - .13, .18); hole.closePath(); shape.holes.push(hole);
  const ring = new THREE.Shape(); ring.absarc(0, centerY, radius + .10, 0, Math.PI * 2);
  const opening = new THREE.Path(); opening.absarc(0, centerY, radius, 0, Math.PI * 2, true); ring.holes.push(opening);
  const parts = [shape, ring].map(outline => {
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: .16, bevelEnabled: true, bevelThickness: .009, bevelSize: .008, bevelSegments: 3, steps: 1, curveSegments: 96 });
    geometry.translate(0, 0, -.08); geometry.normalizeNormals(); return geometry;
  });
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

function woodMaterials(b) {
  if (b.hanjingWoodworkMaterials) return b.hanjingWoodworkMaterials;
  const size = 384, colour = new Uint8Array(size * size * 4), relief = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, bend = .028 * Math.sin(v * Math.PI * 2) + .009 * Math.sin(v * Math.PI * 6 + u * 13);
    const fibre = Math.sin((u + bend) * Math.PI * 156), pore = Math.pow(.5 + .5 * Math.sin((u + bend * .43) * Math.PI * 358), 18);
    const broad = Math.sin((u + bend) * Math.PI * 16), fleck = Math.sin(x * 31.413 + y * 7.731) * Math.sin(x * 2.714 - y * 1.527);
    const i = (y * size + x) * 4, value = Math.round(224 + 11 * broad + 6 * fibre - 20 * pore + 3 * fleck);
    colour[i] = value; colour[i + 1] = value - 5; colour[i + 2] = value - 10; colour[i + 3] = 255;
    relief[i] = relief[i + 1] = relief[i + 2] = Math.round(174 + 18 * fibre - 23 * pore + 5 * fleck); relief[i + 3] = 255;
  }
  const texture = (data, name, srgb = false) => {
    const map = new THREE.DataTexture(data, size, size); map.name = name;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
    if (srgb) map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true; b.textures.add(map); return map;
  };
  const map = texture(colour, 'hanjingtang-authored-longitudinal-wood-fibres', true), bumpMap = texture(relief, 'hanjingtang-wood-pores-and-tool-surface');
  const make = (name, color, roughness, withGrain = true) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, ...(withGrain ? { map, bumpMap, bumpScale: .0045, roughnessMap: bumpMap } : {}) });
    m.name = `hanjingtang-${name}`; m.userData = { category: withGrain ? 'carved-timber' : 'stone-inlay', evidence: 'authored-material; comparative-surviving-Qianlong-joinery; not-a-sampled-original-surface' }; b.materials.add(m); return m;
  };
  b.hanjingWoodworkMaterials = {
    wood: make('zitan-carved-wood-grain', 0x8b6048, .69), edge: make('zitan-carved-moulding', 0x9b7353, .66), recess: make('zitan-recessed-branches', 0x6d4b3b, .77),
    jade: make('quiet-celadon-bamboo-inlay', 0x7e9e7b, .44, false), jadeShade: make('olive-jade-inlay', 0x647e66, .49, false), ivory: make('pale-jade-plum-inlay', 0xd5ceb3, .48, false),
    boards: [0xa27c52, 0x9b754d, 0xaa8358, 0x92704b].map((tone, i) => make(`mezzanine-grained-board-${i}`, tone, .82)),
  };
  return b.hanjingWoodworkMaterials;
}

// Closed, tapered branch with changing oval section and shallow bark ridges.
// UV v follows the actual branch length, so the timber grain follows each bend.
export function carvedBranchGeometry(points, radii, { sides = 16, spacing = .055 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const length = curve.getLength(), steps = Math.max(8, Math.ceil(length / spacing)), frames = curve.computeFrenetFrames(steps, false);
  const positions = [], uv = [], index = [], rings = [];
  const radiusAt = t => { const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)); return THREE.MathUtils.lerp(radii[i], radii[i + 1], f - i); };
  for (let row = 0; row <= steps; row++) {
    const t = row / steps, p = curve.getPointAt(t), radius = radiusAt(t), ring = [];
    for (let col = 0; col <= sides; col++) {
      const a = col / sides * Math.PI * 2, flute = 1 + .048 * Math.sin(5 * a + t * 19) + .030 * Math.cos(9 * a - t * 7);
      const v = p.clone().addScaledVector(frames.normals[row], Math.cos(a) * radius * flute).addScaledVector(frames.binormals[row], Math.sin(a) * radius * .79 * flute);
      ring.push(positions.length / 3); positions.push(...v.toArray()); uv.push(col / sides, length * t * .8);
    }
    rings.push(ring);
    if (row) for (let col = 0; col < sides; col++) {
      const a = rings[row - 1][col], c = ring[col]; index.push(a, c + 1, c, a, a + 1, c + 1);
    }
  }
  for (const row of [0, steps]) {
    const p = curve.getPointAt(row / steps), centre = positions.length / 3; positions.push(...p.toArray()); uv.push(.5, row ? 1 : 0);
    const cap = [];
    for (let col = 0; col <= sides; col++) { const source = rings[row][col] * 3; cap.push(positions.length / 3); positions.push(...positions.slice(source, source + 3)); uv.push(col / sides, 0); }
    for (let col = 0; col < sides; col++) row ? index.push(centre, cap[col], cap[col + 1]) : index.push(centre, cap[col + 1], cap[col]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  for (const ring of rings) {
    const a = ring[0], c = ring.at(-1), n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, c)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(c, n.x, n.y, n.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

export function carvedLeafGeometry(length = .26, width = .074, thickness = .019, bend = .037) {
  const rows = 16, sides = 20, positions = [0, 0, 0], uv = [.5, 0], index = [];
  for (let row = 1; row < rows; row++) {
    const t = row / rows, envelope = Math.sin(t * Math.PI), sway = bend * (t * t + .25 * Math.sin(t * Math.PI * 2));
    for (let col = 0; col < sides; col++) {
      const a = col / sides * Math.PI * 2;
      positions.push(sway + Math.cos(a) * width * .5 * Math.pow(envelope, .74), t * length, .025 * envelope + Math.sin(a) * thickness * .5 * envelope);
      uv.push(col / sides, t);
      if (row > 1) { const p = 1 + (row - 2) * sides + col, next = 1 + (row - 2) * sides + (col + 1) % sides; index.push(p, p + sides, next + sides, p, next + sides, next); }
    }
  }
  const tip = positions.length / 3; positions.push(bend, length, 0); uv.push(.5, 1);
  for (let col = 0; col < sides; col++) {
    index.push(0, 1 + col, 1 + (col + 1) % sides);
    const start = 1 + (rows - 2) * sides; index.push(tip, start + (col + 1) % sides, start + col);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

function branch(b, parent, points, radii, material) {
  b.add(parent, carvedBranchGeometry(points, radii), material ?? woodMaterials(b).wood, undefined, undefined, undefined, true);
}

function bambooSpray(b, parent, position, angle = 0, scale = 1, variation = 0) {
  const m = woodMaterials(b), spray = namedGroup(parent, `${parent.name}-bamboo-spray-${parent.children.length}`, { body: 'carved-bamboo-leaves-with-local-jade-inlays', mergeIntoParent: true });
  spray.position.set(...position); spray.rotation.set(.16 * Math.sin(variation), .12 * Math.cos(variation), angle); spray.scale.setScalar(scale);
  branch(b, spray, [[0, 0, 0], [.04, .15, .012], [.02, .33, .018], [-.01, .50, .014]], [.018, .012, .007, .0025], m.recess);
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1, y = .055 + i * .055, leaf = namedGroup(spray, `${spray.name}-leaf-${i}`, { body: 'convex-carved-leaf-not-a-flat-cutout', mergeIntoParent: true });
    leaf.position.set(.02 + side * .011, y, .012); leaf.rotation.z = side * (.70 + .10 * (i % 3)); leaf.rotation.y = side * (.14 + .06 * (i % 2));
    const length = .83 + .17 * Math.sin(i * 1.8 + variation), model = b.prototype('sanyou-convex-bamboo-leaf', () => carvedLeafGeometry());
    b.add(leaf, model, m.wood, undefined, [1, length, 1]);
    if ((i + variation) % 3 !== 0) b.add(leaf, model, i % 2 ? m.jade : m.jadeShade, [.002, .015, .012], [.73, length * .86, .54]);
    b.tube(leaf, m.edge, [[0, .006, .013], [.018, .10 * length, .036], [.023, .20 * length, .033]], .0028, 12, 6);
  }
  return spray;
}

function pineFanGeometry() {
  const shape = new THREE.Shape(); shape.moveTo(0, -.025);
  shape.bezierCurveTo(-.12, -.01, -.245, .025, -.20, .11);
  shape.bezierCurveTo(-.24, .16, -.14, .21, -.09, .17);
  shape.bezierCurveTo(-.08, .24, .03, .25, .07, .19);
  shape.bezierCurveTo(.16, .24, .23, .18, .19, .12);
  shape.bezierCurveTo(.25, .06, .11, -.008, 0, -.025); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelThickness: .009, bevelSize: .008, bevelSegments: 3, curveSegments: 14 }); g.translate(0, 0, -.0125); return g;
}

function pineCluster(b, parent, position, scale = 1, turn = 0) {
  const m = woodMaterials(b), group = namedGroup(parent, `${parent.name}-pine-foliage-${parent.children.length}`, { body: 'rounded-carved-pine-fans-with-radial-needle-ridges', mergeIntoParent: true });
  group.position.set(...position); group.rotation.z = turn; group.scale.setScalar(scale);
  for (const [i, [x, y, z, angle]] of [[-.15, 0, 0, .30], [.02, .12, -.009, -.14], [.18, .025, .023, -.42]].entries()) {
    const fan = namedGroup(group, `${group.name}-fan-${i}`, { mergeIntoParent: true }); fan.position.set(x, y, z); fan.rotation.set(.10 * i, -.14 * i, angle);
    b.add(fan, b.prototype('sanyou-carved-pine-fan', pineFanGeometry), i === 1 ? m.recess : m.wood);
    for (let n = 0; n < 13; n++) {
      const a = (n / 12 - .5) * 2.16, reach = .168 + .019 * Math.sin(n * 1.71);
      b.tube(fan, m.edge, [[0, -.012, .018], [Math.sin(a) * reach * .56, Math.cos(a) * reach * .55, .026], [Math.sin(a) * reach, Math.cos(a) * reach, .021]], .0036, 9, 6);
    }
    branch(b, group, [[0, -.12, -.014], [x * .6, y * .6, -.01], [x, y + .012, z]], [.022, .016, .008], m.recess);
  }
  return group;
}

function plumBlossom(b, parent, position, scale = 1, angle = 0, inlaid = true) {
  const m = woodMaterials(b), group = namedGroup(parent, `${parent.name}-plum-blossom-${parent.children.length}`, { body: 'cupped-five-petal-plum-with-carved-stamens', mergeIntoParent: true });
  group.position.set(...position); group.rotation.set(.17 * Math.sin(angle * 3), .23 * Math.cos(angle), angle); group.scale.setScalar(scale);
  for (let petal = 0; petal < 5; petal++) b.add(group, b.prototype('sanyou-cupped-plum-petal', () => carvedLeafGeometry(.063, .067, .015, .006)), inlaid ? m.ivory : m.edge, [0, 0, .006], [1, 1 + .09 * Math.sin(petal * 2), 1], [.28, 0, petal * Math.PI * 2 / 5]);
  const ball = b.prototype('sanyou-small-carved-bud', () => new THREE.SphereGeometry(1, 16, 12));
  b.add(group, ball, m.wood, [0, 0, .012], [.022, .022, .016]);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7, p = [.025 * Math.cos(a), .025 * Math.sin(a), .028];
    b.rod(group, m.edge, [0, 0, .015], p, .0035, 8); b.add(group, ball, m.ivory, p, [.0055, .0055, .0055]);
  }
  return group;
}

function rectFrame(b, group, material, x, y, width, height, thickness = .041, z = .012) {
  for (const sign of [-1, 1]) {
    b.box(group, material, [x + sign * (width - thickness) / 2, y, z], [thickness, height, .072]);
    b.box(group, material, [x, y + sign * (height - thickness) / 2, z], [width, thickness, .072]);
  }
}

export function carvedLatticeLeaf(b, parent, name, width, height, { pattern = 'step', lining = false, lowerPanel = true } = {}) {
  const group = namedGroup(parent, name, { body: 'profiled-wood-lattice-with-open-interstices', pattern, evidence: 'authored-Qing-joinery-vocabulary-not-recovered-panel', mergeIntoParent: true });
  rectFrame(b, group, b.m.red, 0, height / 2, width, height, .075, 0);
  rectFrame(b, group, b.m.gold, 0, height / 2, width - .10, height - .10, .012, .045);
  const lower = lowerPanel ? height * .30 : .08, top = height - .17, innerWidth = width - .22;
  if (lowerPanel) {
    b.box(group, b.m.darkWood, [0, lower / 2, -.015], [width - .12, lower - .035, .075]);
    rectFrame(b, group, b.m.red, 0, lower / 2, width - .19, lower - .14, .040, .050);
    rectFrame(b, group, b.m.gold, 0, lower / 2, width - .30, lower - .27, .012, .076);
    for (const y of [lower + .02, lower + .14]) b.box(group, b.m.red, [0, y, .02], [width - .09, .067, .098]);
  }
  const bottom = lower + .23, areaHeight = top - bottom;
  if (pattern === 'step') {
    const rows = Math.max(2, Math.floor(areaHeight / .44));
    for (let row = 0; row < rows; row++) {
      const y = bottom + (row + .5) * areaHeight / rows, h = areaHeight / rows + .018;
      rectFrame(b, group, b.m.red, 0, y, innerWidth, h, .033, .025);
      rectFrame(b, group, b.m.red, 0, y, innerWidth * .67, h * .67, .027, .029);
      for (const sign of [-1, 1]) b.rod(group, b.m.red, [sign * innerWidth * .5, y + sign * h * .5, .026], [sign * innerWidth * .335, y + sign * h * .335, .030], .017, 8);
    }
  } else {
    const rows = Math.max(2, Math.floor(areaHeight / .56));
    for (let row = 0; row < rows; row++) {
      const y = bottom + (row + .5) * areaHeight / rows, halfW = innerWidth / 2, halfH = areaHeight / rows / 2;
      const p = [[-.56 * halfW, -halfH], [.56 * halfW, -halfH], [halfW, -.56 * halfH], [halfW, .56 * halfH], [.56 * halfW, halfH], [-.56 * halfW, halfH], [-halfW, .56 * halfH], [-halfW, -.56 * halfH]];
      for (let i = 0; i < 8; i++) b.rod(group, b.m.red, [p[i][0], y + p[i][1], .028], [p[(i + 1) % 8][0], y + p[(i + 1) % 8][1], .028], .019, 8);
      b.box(group, b.m.red, [0, y + halfH, .028], [innerWidth, .030, .06]);
    }
  }
  if (lining) b.box(group, b.m.paper, [0, (top + bottom) / 2, -.065], [innerWidth, areaHeight, .015]);
  return group;
}

export function sanyouCarving(b, parent, { width = 1.7, height = 2.8 } = {}) {
  const group = namedGroup(parent, `${parent.name}-pine-bamboo-plum`, { body: 'carved-sanyou-plant-screen', evidence: 'motifs-supported-by-Hanjingtang-archives; branch-patterns-authored; DPM-2022-p27-comparison', mergeIntoParent: true });
  const m = woodMaterials(b), p = values => values.map(([x, y, z = .02]) => [x * width, y * height, z]);
  branch(b, group, p([[-.41, 0], [-.35, .14, .035], [-.23, .29, .02], [-.30, .49, .055], [-.13, .70, .03], [-.16, .98, .01]]), [.115, .099, .074, .059, .031, .019]);
  branch(b, group, p([[.39, 0, -.01], [.27, .20, -.015], [.31, .42, .01], [.19, .66, -.006], [.31, 1, .012]]), [.073, .058, .041, .027, .014], m.recess);
  for (const [i, [a, c, d, e]] of [
    [[-.35, .14], [-.12, .26], [.12, .27], [.23, .43]],
    [[-.29, .47], [-.42, .60], [-.36, .74], [-.40, .91]],
    [[-.17, .66], [.01, .71], [.13, .89], [.39, .98]],
    [[.28, .34], [.04, .46], [-.01, .59], [.07, .71]],
  ].entries()) {
    branch(b, group, p([a, c, d, e].map(([x, y], k) => [x, y, .030 + .020 * Math.sin(k * 1.9 + i)])), [.046, .031, .018, .006], i % 2 ? m.recess : m.wood);
    pineCluster(b, group, [d[0] * width, d[1] * height, .06], .68 + i * .075, (i - 1) * .29);
    for (let j = 0; j < 4; j++) {
      const t = .18 + j * .20, x = THREE.MathUtils.lerp(c[0], e[0], t) * width, y = THREE.MathUtils.lerp(c[1], e[1], t) * height;
      plumBlossom(b, group, [x, y, .07], .63 + .11 * (j % 3), j * 1.7 + i, (j + i) % 3 === 0);
    }
  }
  for (const [i, x] of [.04, .19, -.43].entries()) {
    const cane = [[x * width, 0, .075], [(x + .027) * width, .31 * height, .086], [(x - .021) * width, .68 * height, .060], [(x + .015) * width, height, .023]];
    branch(b, group, cane, [.026, .023, .018, .010], m.edge);
    for (let node = 1; node < 5; node++) {
      const t = node / 5, px = (x + .012 * Math.sin(t * 5)) * width;
      b.add(group, b.prototype('sanyou-bamboo-node', () => new THREE.TorusGeometry(.025, .005, 10, 24)), m.wood, [px, t * height, .075], [.94, .94, .94], [Math.PI / 2, 0, 0]);
      bambooSpray(b, group, [px, t * height, .079], (node % 2 ? -.8 : .68), .63 + .10 * ((i + node) % 3), i + node);
    }
  }
  return group;
}

export function sanyouMoonScreen(b, parent) {
  const m = woodMaterials(b), group = namedGroup(parent, 'hanjingtang-sanyou-circular-screen', { body: 'carved-round-light-screen-with-true-opening', evidence: 'Hanjingtang-round-screen-documented; authored-branch-composition-informed-by-DPM-2015-fig18-and-2022-p27', openingRadius: 1.21, originalCarvingRecovered: false });
  b.add(group, moonScreenGeometry(4.45, 3.65, 1.21, 1.61), m.wood, undefined, undefined, undefined, true);
  for (const z of [-.091, .091]) {
    b.add(group, b.prototype('sanyou-ring-small-bead', () => new THREE.TorusGeometry(1.234, .012, 12, 192)), m.edge, [0, 1.61, z]);
    b.add(group, b.prototype('sanyou-ring-outer-bead', () => new THREE.TorusGeometry(1.283, .012, 12, 192)), m.recess, [0, 1.61, z]);
    rectFrame(b, group, m.edge, 0, 1.84, 4.30, 3.48, .018, z);
  }
  const pine = namedGroup(group, 'hanjingtang-sanyou-screen-twisted-pine', { body: 'tapered-pierced-carving-connected-to-frame-and-ring' });
  branch(b, pine, [[-2.16, .12, 0], [-1.93, .48, -.025], [-1.61, .87, 0], [-1.67, 1.25, .025], [-1.84, 1.75, .04], [-1.65, 2.36, .03], [-1.91, 2.88, -.014], [-1.93, 3.57, 0]], [.135, .111, .102, .088, .071, .054, .037, .020]);
  for (const points of [
    [[-1.93, .48, 0], [-1.6, .58, .032], [-1.22, .85, .041], [-1.12, .95, .020]],
    [[-1.65, 2.36, .03], [-1.2, 2.53, .034], [-.89, 2.57, .006]],
    [[-1.84, 1.75, .04], [-2.10, 2.02, .055], [-2.16, 2.33, .02]],
    [[-1.65, 2.36, .03], [-1.42, 2.91, -.018], [-.76, 3.12, -.022], [-.22, 3.36, -.006], [-.09, 3.56, 0]],
  ]) branch(b, pine, points, [.052, .043, .025, .014].slice(0, points.length), m.recess);
  for (const [x, y, scale, turn] of [[-1.75, .44, .73, -.65], [-1.78, 1.65, .76, .18], [-1.74, 2.66, .71, -.32], [-.91, 3.10, .79, .18], [.03, 3.23, .66, -.11]]) pineCluster(b, pine, [x, y, .065], scale, turn);
  const plum = namedGroup(group, 'hanjingtang-sanyou-screen-plum-branches', { body: 'bent-plum-branches-and-cupped-inlay-blossoms' });
  branch(b, plum, [[2.13, .12, -.008], [1.86, .42, .018], [1.88, .94, -.025], [1.55, 1.38, -.015], [1.76, 1.91, .010], [1.60, 2.70, .028], [1.12, 3.08, .004], [.60, 3.07, .003], [.11, 3.31, .015], [-.17, 3.56, 0]], [.104, .092, .081, .067, .052, .041, .031, .023, .015, .009], m.recess);
  const twigs = [
    [[1.86, .42, .015], [1.50, .50, .04], [1.15, .70, .03], [.93, .70, .015]],
    [[1.55, 1.38, -.015], [1.39, 1.22, .025], [1.22, 1.22, .015]],
    [[1.76, 1.91, .010], [2.06, 2.13, .028], [2.15, 2.45, .007]],
    [[1.60, 2.70, .028], [1.89, 3.03, .036], [2.13, 3.36, .008]],
    [[.60, 3.07, .003], [.38, 2.95, .017], [.32, 2.87, .009]],
  ];
  for (const [i, points] of twigs.entries()) {
    branch(b, plum, points, [.037, .021, .012, .006].slice(0, points.length), m.wood);
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    for (let blossom = 0; blossom < 6; blossom++) {
      const t = .20 + blossom * .13, p = curve.getPoint(t), side = blossom % 2 ? 1 : -1;
      const q = p.clone().add(new THREE.Vector3(side * .055, .035, .053)); branch(b, plum, [p.toArray(), p.clone().lerp(q, .55).add(new THREE.Vector3(0, .008, .006)).toArray(), q.toArray()], [.012, .008, .004], m.wood);
      plumBlossom(b, plum, q.toArray(), .72 + .14 * (blossom % 3), i + blossom * 1.51, (i + blossom) % 3 !== 0);
    }
  }
  const bamboo = namedGroup(group, 'hanjingtang-sanyou-screen-bamboo', { body: 'segmented-carved-bamboo-with-restrained-jade-inlays' });
  for (const points of [
    [[-1.45, .16, -.045], [-1.48, 1.05, -.04], [-1.48, 1.80, -.035], [-1.4, 2.50, -.025], [-1.17, 3.53, -.01]],
    [[1.49, .16, -.041], [1.55, 1.10, -.021], [1.52, 1.92, -.039], [1.39, 2.70, -.026], [1.28, 3.53, -.005]],
    [[-.34, 2.87, -.016], [-.18, 3.15, -.009], [-.21, 3.53, -.003]],
  ]) {
    branch(b, bamboo, points, [.034, .025, .020, .016, .009].slice(0, points.length), m.edge);
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    for (let n = 1; n <= 7; n++) {
      const t = n / 8, p = curve.getPoint(t), tangent = curve.getTangent(t);
      b.add(bamboo, b.prototype('sanyou-bamboo-node', () => new THREE.TorusGeometry(.025, .005, 10, 24)), m.wood, p.toArray(), [1, 1, 1], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent));
    }
  }
  for (const [i, [x, y, angle, scale]] of [
    [-1.50, .28, .8, .66], [-1.57, .99, .72, .74], [-1.59, 1.93, .8, .76], [-1.41, 2.70, .7, .75],
    [1.62, .25, -.7, .66], [1.61, 1.06, -.6, .72], [1.59, 2.13, -.78, .65], [1.39, 2.85, -.7, .73],
    [-.69, 2.98, .63, .70], [.37, 2.98, -.83, .74], [-.08, 3.09, .2, .65],
  ].entries()) bambooSpray(b, bamboo, [x, y, .055], angle, scale, i);
  return group;
}

export function mezzanineTimberFloor(b, parent, { width, depth, level, openings }) {
  const m = woodMaterials(b), rectangle = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  b.polygon(parent, rectangle(width, depth), level - .20, level - .026, m.recess, openings);
  const holes = openings.map(points => ({ minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minZ: Math.min(...points.map(p => p[1])), maxZ: Math.max(...points.map(p => p[1])) }));
  const rows = Math.ceil(depth / .31), step = depth / rows;
  for (let row = 0; row < rows; row++) {
    const za = -depth / 2 + row * step, zc = za + step;
    const cuts = [-depth / 2, depth / 2, za, zc, ...holes.flatMap(hole => [hole.minZ, hole.maxZ])].filter(z => z >= za && z <= zc).sort((a, c) => a - c);
    for (let strip = 0; strip < cuts.length - 1; strip++) {
      const minZ = cuts[strip], maxZ = cuts[strip + 1]; if (maxZ - minZ < .005) continue;
      let spans = [[-width / 2, width / 2]];
      for (const hole of holes) if (minZ < hole.maxZ && maxZ > hole.minZ) spans = spans.flatMap(([a, c]) => c <= hole.minX || a >= hole.maxX ? [[a, c]] : [[a, Math.min(c, hole.minX)], [Math.max(a, hole.maxX), c]].filter(([x, z]) => z - x > .005));
      for (const [a, c] of spans) {
        const joints = [a, c]; for (let x = -width / 2 + (row % 3) * 1.05; x < width / 2; x += 3.15) if (x > a + .025 && x < c - .025) joints.push(x); joints.sort((x, z) => x - z);
        for (let joint = 0; joint < joints.length - 1; joint++) {
          const left = joints[joint] + .004, right = joints[joint + 1] - .004, lowZ = minZ + .004, highZ = maxZ - .004;
          if (right <= left || highZ <= lowZ) continue;
          const board = new THREE.BoxGeometry(right - left, .032, highZ - lowZ), p = board.attributes.position, uv = board.attributes.uv;
          for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) * 3.2 + row * .117, p.getX(i) * .36 + joint * .193);
          b.add(parent, board, m.boards[(row * 7 + joint * 11) % m.boards.length], [(left + right) / 2, level - .016, (lowZ + highZ) / 2], undefined, undefined, true);
        }
      }
    }
  }
  parent.userData.paving = 'individual-grained-timber-boards-with-open-staggered-joints';
}

export function hanjingTimberFrame(b, parent, name, { width, depth, bays, floor, columnHeight, open = false, upper = false, sanyou = false }) {
  const group = namedGroup(parent, name, { body: 'painted-timber-bay-frame', bays, floor, columnHeight, clearDoorWidth: width / bays - .8 });
  const structure = namedGroup(group, `${name}-columns-brackets-beams`, { body: 'seated-columns-and-profiled-bracket-arms' });
  const span = width / bays;
  for (const side of [-1, 1]) {
    const z = side * depth / 2;
    for (let i = 0; i <= bays; i++) {
      const x = -width / 2 + i * span;
      column(b, structure, x, z, floor, columnHeight, upper ? .17 : .22);
      dougong(b, structure, [x, floor + columnHeight, z], 1, side > 0 ? 0 : Math.PI);
    }
    for (let i = 0; i < bays; i++) paintedBeam(b, structure, [-width / 2 + i * span, z], [-width / 2 + (i + 1) * span, z], floor + columnHeight - .24, .52);
    b.box(structure, b.m.green, [0, floor + columnHeight + .985, z + side * .51], [width + .55, .24, .30]);
  }
  for (const side of [-1, 1]) {
    const x = side * width / 2, count = Math.max(2, Math.round(depth / 3.4));
    for (let i = 1; i < count; i++) {
      const z = -depth / 2 + i * depth / count;
      column(b, structure, x, z, floor, columnHeight, upper ? .17 : .21);
      dougong(b, structure, [x, floor + columnHeight, z], 1, side * Math.PI / 2);
    }
    for (let i = 0; i < count; i++) paintedBeam(b, structure, [x, -depth / 2 + i * depth / count], [x, -depth / 2 + (i + 1) * depth / count], floor + columnHeight - .24, .48);
    b.box(structure, b.m.green, [x + side * .51, floor + columnHeight + .985, 0], [.30, .24, depth + .55]);
  }
  if (open) return group;
  const screens = namedGroup(group, `${name}-joinery`, { body: 'south-north-through-doors-and-profiled-lattice' });
  const leafHeight = Math.min(columnHeight - .62, 4.75), transomHeight = columnHeight - .82 - leafHeight;
  for (const side of [-1, 1]) for (let bay = 0; bay < bays; bay++) {
    const x = -width / 2 + (bay + .5) * span, z = side * (depth / 2 - .16), opening = span - .48;
    if (bay === Math.floor(bays / 2) && !upper) {
      for (const leafSide of [-1, 1]) {
        const leaf = carvedLatticeLeaf(b, screens, `${name}-door-${side}-${leafSide}`, opening * .43, leafHeight);
        leaf.position.set(x + leafSide * opening * .48, floor + .07, z); leaf.rotation.y = leafSide * Math.PI * .46;
      }
    } else if (sanyou) {
      const panel = namedGroup(screens, `${name}-sanyou-window-${side}-${bay}`, { body: 'glass-backed-sanyou-screen', mergeIntoParent: true }); panel.position.set(x, floor + .72, z);
      rectFrame(b, panel, b.m.darkWood, 0, (columnHeight - 1.10) / 2, opening, columnHeight - 1.10, .10);
      b.box(panel, b.m.glass, [0, (columnHeight - 1.10) / 2, -.065], [opening - .12, columnHeight - 1.24, .016]);
      sanyouCarving(b, panel, { width: opening - .18, height: columnHeight - 1.20 });
      b.box(panel, b.m.darkWood, [0, -.32, -.01], [opening, .65, .11]);
    } else {
      const leaves = Math.max(2, Math.round(opening / .88));
      for (let i = 0; i < leaves; i++) {
        const leaf = carvedLatticeLeaf(b, screens, `${name}-lattice-${side}-${bay}-${i}`, opening / leaves - .028, leafHeight, { pattern: upper || bay % 2 ? 'lantern' : 'step', lining: i % 3 !== 1 });
        leaf.position.set(x - opening / 2 + (i + .5) * opening / leaves, floor + .07, z);
      }
    }
    if (transomHeight > .35) {
      b.box(screens, b.m.green, [x, floor + leafHeight + .17, z], [opening + .20, .30, .19]);
      const count = Math.max(2, Math.round(opening / .82));
      for (let i = 0; i < count; i++) {
        const transom = carvedLatticeLeaf(b, screens, `${name}-upper-transom-${side}-${bay}-${i}`, opening / count - .032, transomHeight, { pattern: 'lantern', lining: i % 2 === 0, lowerPanel: false });
        transom.position.set(x - opening / 2 + (i + .5) * opening / count, floor + leafHeight + .27, z);
      }
    }
  }
  for (const side of [-1, 1]) {
    const wall = namedGroup(screens, `${name}-end-screen-${side}`, { body: 'pierced-side-lattice-screen', mergeIntoParent: true });
    wall.position.set(side * (width / 2 - .17), floor + .07, 0); wall.rotation.y = side * Math.PI / 2;
    const count = Math.max(3, Math.round(depth / 1.0));
    for (let i = 0; i < count; i++) {
      const leaf = carvedLatticeLeaf(b, wall, `${name}-side-leaf-${side}-${i}`, depth / count - .06, leafHeight, { pattern: 'lantern', lining: i % 3 !== 1 });
      leaf.position.x = -depth / 2 + (i + .5) * depth / count;
      if (transomHeight > .35) {
        b.box(wall, b.m.green, [leaf.position.x, leafHeight + .10, 0], [depth / count, .30, .19]);
        const transom = carvedLatticeLeaf(b, wall, `${name}-side-transom-${side}-${i}`, depth / count - .06, transomHeight, { pattern: 'lantern', lining: i % 2 === 0, lowerPanel: false });
        transom.position.set(leaf.position.x, leafHeight + .20, 0);
      }
    }
  }
  return group;
}
