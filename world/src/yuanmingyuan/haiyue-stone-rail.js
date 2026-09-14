import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { namedGroup } from './study-geometry.js';

const TAU = Math.PI * 2, V = (...a) => new THREE.Vector3(...a), clamp = THREE.MathUtils.clamp;
export const haiyueStoneRailEvidence = Object.freeze({
  status: 'authored-Qing-comparative-carving-not-recovered-Haiyue-ornament',
  source: 'https://www.dpm.org.cn/building/talk/223502.html',
  inspected: ['https://img.dpm.org.cn/Uploads/pdf/1760/T00016_00.pdf', 'https://img.dpm.org.cn/Uploads/pdf/1760/T00017_00.pdf'],
  scope: 'The Palace Museum text and photographs support profiled rails, solid lower panels, pierced upper panels, vase supports and lotus baluster-head vocabulary. The floral design, profiles and all dimensions here are new comparative work.',
  photographyBundled: false,
});

function finish(name, p, indices, uv) {
  const g = new THREE.BufferGeometry(); g.name = name;
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

// Indexed, smooth turning with one vertex at each axis pole. The seams meet
// geometrically; a conical fan is not substituted for the carved blossom.
export function haiyueRailTurning(profile, sides = 96, name = 'haiyue-rail-profiled-turning') {
  if (profile[0][0] !== 0 || profile.at(-1)[0] !== 0 || profile.slice(1, -1).some(p => p[0] <= 0)) throw new Error('Stone turning requires positive interior radii and two single axis poles');
  const positions = [0, profile[0][1], 0], uv = [.5, profile[0][1] / .35], indices = [];
  for (const [radius, y] of profile.slice(1, -1)) for (let side = 0; side <= sides; side++) {
    const a = side / sides * TAU; positions.push(Math.sin(a) * radius, y, Math.cos(a) * radius); uv.push(side / sides * TAU * radius / .35, y / .35);
  }
  const rings = profile.length - 2, stride = sides + 1, top = positions.length / 3; positions.push(0, profile.at(-1)[1], 0); uv.push(.5, profile.at(-1)[1] / .35);
  for (let side = 0; side < sides; side++) {
    indices.push(0, 1 + side + 1, 1 + side);
    for (let row = 0; row < rings - 1; row++) { const a = 1 + row * stride + side, b = a + stride; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    const last = 1 + (rings - 1) * stride; indices.push(top, last + side, last + side + 1);
  }
  const g = finish(name, positions, indices, uv), normal = g.attributes.normal;
  // Average the UV seam copies instead of leaving a visible lighting seam.
  for (let row = 0; row < rings; row++) {
    const a = 1 + row * stride, b = a + sides, n = V().fromBufferAttribute(normal, a).add(V().fromBufferAttribute(normal, b)).normalize(); normal.setXYZ(a, n.x, n.y, n.z); normal.setXYZ(b, n.x, n.y, n.z);
  }
  return g;
}

function closedPatch(name, rows, columns, point, { pointedEnds = false } = {}) {
  const positions = [], uv = [], indices = [], stride = columns + 1, sheet = pointedEnds ? (rows - 1) * stride + 2 : (rows + 1) * stride;
  const at = (row, column) => pointedEnds ? row === 0 ? 0 : row === rows ? sheet - 1 : 1 + (row - 1) * stride + column : row * stride + column;
  for (let face = 0; face < 2; face++) for (let row = 0; row <= rows; row++) for (let column = 0; column <= (pointedEnds && (row === 0 || row === rows) ? 0 : columns); column++) {
    const u = pointedEnds && (row === 0 || row === rows) ? 0 : column / columns * 2 - 1;
    const p = point(row / rows, u, face); positions.push(...p.toArray()); uv.push(p.x / .35, (p.y + p.z * .31) / .35);
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = at(row, column), next = at(row, column + 1), b = at(row + 1, column), nextB = at(row + 1, column + 1);
    if (!pointedEnds) { indices.push(a, next, b, next, nextB, b, sheet + a, sheet + b, sheet + next, sheet + next, sheet + b, sheet + nextB); continue; }
    // A pointed end has one vertex on each face. Its surviving fan triangle
    // joins the first full-width row; there is no artificial micron-wide strip.
    if (a !== next) indices.push(a, next, b, sheet + a, sheet + b, sheet + next);
    if (b !== nextB) indices.push(next, nextB, b, sheet + next, sheet + b, sheet + nextB);
  }
  const boundary = [], append = index => { if (boundary.at(-1) !== index) boundary.push(index); };
  for (let c = 0; c <= columns; c++) append(at(0, c));
  for (let row = 1; row <= rows; row++) append(at(row, columns));
  for (let c = columns - 1; c >= 0; c--) append(at(rows, c));
  for (let row = rows - 1; row > 0; row--) append(at(row, 0));
  for (let i = 0; i < boundary.length; i++) { const a = boundary[i], b = boundary[(i + 1) % boundary.length]; indices.push(a, sheet + a, b, b, sheet + a, sheet + b); }
  const g = finish(name, positions, indices, uv);
  // Parametric patches use different projection axes. Orient the entire closed
  // volume once; never hide an inward surface with DoubleSide.
  let volume = 0; const p = g.attributes.position, index = g.index, a = V(), b = V(), c = V();
  for (let i = 0; i < index.count; i += 3) volume += a.fromBufferAttribute(p, index.getX(i)).dot(b.fromBufferAttribute(p, index.getX(i + 1)).cross(c.fromBufferAttribute(p, index.getX(i + 2)))) / 6;
  if (volume < 0) { for (let i = 0; i < index.count; i += 3) { const a = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, a); } g.computeVertexNormals(); }
  return g;
}

const crownRadius = t => .124 * Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1))) ** .78 * (1 - .22 * t);
export function haiyueLotusCrownCore() {
  const profile = Array.from({ length: 65 }, (_, i) => { const t = i / 64; return [i === 0 || i === 64 ? 0 : crownRadius(t), t * .235]; });
  const g = haiyueRailTurning(profile, 112, 'haiyue-smooth-lotus-bud-core'); g.userData.body = 'continuous-curved-lotus-core-without-conical-faceting'; return g;
}

export function haiyueLotusCrownPetal(tier = 0) {
  const start = tier ? .27 : .075, span = tier ? .69 : .77;
  const g = closedPatch(`haiyue-lotus-crown-carved-petal-${tier}`, 24, 8, (t, u, face) => {
    const y = (start + t * span) * .235, w = Math.max(.0005, Math.sin(Math.PI * t) ** .66) * (tier ? .38 : .47), a = u * w;
    const bulge = -.003 + .022 * Math.sin(Math.PI * t) ** .78 * (1 - .22 * u * u) + .003 * Math.sin(Math.PI * t) * (1 - Math.abs(u));
    const r = crownRadius(y / .235) + bulge - (face ? .013 : 0);
    return V(Math.sin(a) * r, y, Math.cos(a) * r);
  }, { pointedEnds: true });
  g.userData = { body: 'closed-broad-lotus-petal-with-raised-central-ridge', tier, endTopology: 'single-front-and-back-pole-with-closed-side-fans', photographicCopy: false }; return g;
}

export function haiyueReliefLeaf({ length = .10, width = .047, lift = .021 } = {}) {
  const g = closedPatch('haiyue-carved-floral-leaf-relief', 20, 8, (t, u, face) => {
    const half = Math.max(.00006, Math.sin(Math.PI * t) ** .72 * width / 2), y = length * t, x = half * u + Math.sin(t * Math.PI) * length * .055;
    const z = face ? -.019 : -.009 + lift * Math.sin(Math.PI * t) ** .85 * (1 - .46 * Math.abs(u) ** .8);
    return V(x, y, z);
  });
  g.userData.body = 'solid-tapered-leaf-with-cambered-front-and-buried-back'; return g;
}

export function haiyueReliefScroll() {
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(.095, .026, 0), V(.19, -.031, 0), V(.295, -.009, 0), V(.385, .045, 0), V(.439, .032, 0), V(.429, -.003, 0), V(.404, .006, 0)], false, 'centripetal');
  const g = closedPatch('haiyue-flat-tapered-scroll-relief', 96, 6, (t, u, face) => {
    const p = curve.getPointAt(t), tangent = curve.getTangentAt(t), half = .0065 * (1 - .75 * t) + .001, offset = V(-tangent.y, tangent.x, 0).normalize().multiplyScalar(half * u);
    return p.add(offset).add(V(0, 0, face ? -.016 : -.004 + .011 * Math.max(0, Math.cos(u * Math.PI / 2))));
  });
  g.userData.body = 'flat-swept-relief-ribbon-with-taper-and-curved-knife-section'; return g;
}

function profileExtrusion(width, points, name, bevel = .003) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y))), { depth: width - bevel * 2, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 24 });
  g.rotateY(Math.PI / 2); g.translate(-width / 2 + bevel, 0, 0); g.name = name;
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / .35; uv[i * 2 + 1] = (p.getY(i) + p.getZ(i) * .81) / .35; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

export function haiyueProfiledHandrail(width, kind = 'xunzhang') {
  const seek = [[-.079, -.047], [.079, -.047], [.083, -.037], [.065, -.026], [.064, -.008], [.086, .007], [.089, .020], [.084, .035], [.070, .048], [.047, .055], [0, .058], [-.047, .055], [-.070, .048], [-.084, .035], [-.089, .020], [-.086, .007], [-.064, -.008], [-.065, -.026], [-.083, -.037]];
  const lip = [[-.087, -.032], [.087, -.032], [.099, -.019], [.096, -.008], [.078, .001], [.075, .014], [.086, .024], [.084, .034], [-.084, .034], [-.086, .024], [-.075, .014], [-.078, .001], [-.096, -.008], [-.099, -.019]];
  const foot = [[-.108, -.043], [.108, -.043], [.114, -.032], [.110, -.015], [.092, -.006], [.088, .022], [.082, .034], [-.082, .034], [-.088, .022], [-.092, -.006], [-.110, -.015], [-.114, -.032]];
  const g = profileExtrusion(width, kind === 'xunzhang' ? seek : kind === 'penchun' ? lip : foot, `haiyue-${kind}-moulded-section`); g.userData = { body: 'solid-profiled-stone-moulding', kind, width }; return g;
}

export function haiyuePiercedArchHeader(width) {
  const w = width / 2, shape = new THREE.Shape();
  shape.moveTo(-w, .055); shape.lineTo(w, .055); shape.lineTo(w, -.103);
  shape.bezierCurveTo(w * .72, -.107, w * .73, -.046, w * .53, -.020);
  shape.bezierCurveTo(w * .35, .015, -w * .35, .015, -w * .53, -.020);
  shape.bezierCurveTo(-w * .73, -.046, -w * .72, -.107, -w, -.103); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: .083, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: .005, bevelThickness: .005, curveSegments: 32 }); g.translate(0, 0, -.0415); g.name = 'haiyue-pierced-upper-arch-shoulders';
  const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / .35; uv[i * 2 + 1] = p.getY(i) / .35; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

// An original fine-grained white stone material. No Palace Museum photograph or
// generated art-direction image is sampled, traced, or used as a texture.
export function haiyueCarvedMarblePixels(size = 512) {
  const color = new Uint8Array(size * size * 4), normal = color.slice(), roughness = color.slice(), height = new Float32Array(size * size), tile = .35;
  const hash = (x, y, seed) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295; };
  const noise = (x, y, n, seed) => {
    const ix = Math.floor(x * n), iy = Math.floor(y * n), xx = x * n - ix, yy = y * n - iy, u = xx * xx * (3 - 2 * xx), v = yy * yy * (3 - 2 * yy), h = (a, b) => hash((a + n) % n, (b + n) % n, seed);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix, iy), h(ix + 1, iy), u), THREE.MathUtils.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), u), v) - .5;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, u = x / size, v = y / size, broad = noise(u, v, 9, 31), fine = noise(u, v, 73, 92), crystal = hash(x, y, 733) - .5, fleck = Math.max(0, hash(x, y, 544) - .972) * 125;
    const value = broad * 6 + fine * 7 + crystal * 2 - fleck;
    color.set([234 + value, 234 + value, 225 + value * .83, 255].map(v => Math.round(v)), i * 4);
    const r = 204 + broad * 12 + fine * 15 + crystal * 5; roughness.set([r, r, r, 255], i * 4);
    height[i] = broad * .000043 + fine * .000071 + crystal * .000014;
  }
  const h = (x, y) => height[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = V(-(h(x + 1, y) - h(x - 1, y)) / (2 * tile / size), -(h(x, y + 1) - h(x, y - 1)) / (2 * tile / size), 1).normalize();
    normal.set([127.5 + n.x * 127.5, 127.5 + n.y * 127.5, 127.5 + n.z * 127.5, 255].map(Math.round), (y * size + x) * 4);
  }
  return { size, physicalTile: tile, color, normal, roughness, provenance: 'original-editable-white-stone-material-not-a-scan' };
}

function railMaterial(b) {
  if (b.m.carvedMarble) return b.m.carvedMarble;
  const pixels = haiyueCarvedMarblePixels(), maps = {};
  for (const [key, source] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']]) {
    const t = new THREE.DataTexture(pixels[source], pixels.size, pixels.size, THREE.RGBAFormat); t.name = `haiyue-original-carved-marble-${source}`; t.colorSpace = source === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; t.userData.physicalTile = pixels.physicalTile;
    b.textures.add(t); maps[key] = t;
  }
  const material = new THREE.MeshStandardMaterial({ name: 'haiyue-finely-carved-white-marble', color: 0xffffff, ...maps, roughness: 1, normalScale: new THREE.Vector2(.55, .55) });
  material.userData = { ...haiyueStoneRailEvidence, material: pixels.provenance }; b.materials.add(material); b.m.carvedMarble = material; return material;
}

export function haiyueCarvedStoneRailBay(b, parent, width, floorY, { endPost = true, height = 1 } = {}) {
  if (!(width > .40 && height > .4)) throw new Error('Stone rail bay is too small for the independent carved members');
  const g = namedGroup(parent, 'haiyue-carved-stone-balustrade', { ...haiyueStoneRailEvidence, parts: ['wangzhu', 'lotus-crown', 'xunzhang', 'pierced-shoulders', 'jingping-support', 'penchun', 'huaban', 'difu'] }), m = railMaterial(b);
  const put = (name, make, position, scale = [1, 1, 1], rotation = [0, 0, 0], target = g) => b.put(target, b.proto(name, make), m, position, scale, rotation);
  const block = (target, position, size) => {
    const key = `haiyue-cut-marble-${size.join('-')}`;
    put(key, () => {
      const geometry = new RoundedBoxGeometry(...size, 3, Math.min(.004, ...size.map(v => v * .18))), p = geometry.attributes.position, n = geometry.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = Math.abs(n.getX(i)), y = Math.abs(n.getY(i)), z = Math.abs(n.getZ(i));
        uv[i * 2] = (x > z && x > y ? p.getZ(i) : p.getX(i)) / .35; uv[i * 2 + 1] = (y > x && y > z ? p.getZ(i) : p.getY(i)) / .35;
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.name = key; return geometry;
    }, position, [1, 1, 1], [0, 0, 0], target);
  };
  const span = width - .19;
  for (const x of endPost ? [-width / 2, width / 2] : [-width / 2]) {
    const post = namedGroup(g, 'haiyue-marble-lotus-wangzhu');
    block(post, [x, floorY + height * .0625, 0], [.225, height * .125, .225]);
    block(post, [x, floorY + height * .456, 0], [.166, height * .688, .166]);
    block(post, [x, floorY + height * .772, 0], [.204, height * .044, .204]);
    for (const side of [-1, 1]) {
      const field = namedGroup(post, 'haiyue-wangzhu-recessed-box-field'); field.position.set(x, floorY + height * .45, side * .082); if (side < 0) field.rotation.y = Math.PI;
      for (const xx of [-.052, .052]) block(field, [xx, 0, .004], [.012, height * .48, .012]);
      for (const yy of [-.239, .239]) block(field, [0, height * yy, .004], [.111, .011, .012]);
    }
    put('haiyue-lotus-neck-collar', () => haiyueRailTurning([[0, 0], [.086, 0], [.105, .010], [.107, .025], [.085, .036], [.074, .050], [.080, .060], [.091, .067], [0, .067]], 96, 'haiyue-lotus-neck-collar'), [x, floorY + height * .774, 0], [1, height, 1], [0, 0, 0], post);
    put('haiyue-lotus-bud-core', haiyueLotusCrownCore, [x, floorY + height * .800, 0], [1, height, 1], [0, 0, 0], post);
    for (let tier = 0; tier < 2; tier++) for (let leaf = 0; leaf < 8; leaf++) put(`haiyue-lotus-petal-${tier}`, () => haiyueLotusCrownPetal(tier), [x, floorY + height * .800, 0], [1, height, 1], [0, (leaf + tier * .5) * Math.PI / 4, 0], post);
  }
  for (const [kind, y] of [['difu', .091], ['penchun', .497], ['xunzhang', .823]]) put(`haiyue-${kind}-${span}`, () => haiyueProfiledHandrail(span, kind), [0, floorY + height * y, 0], [1, height, 1]);
  const panel = namedGroup(g, 'haiyue-huaban-solid-floral-relief'); panel.position.y = floorY;
  block(panel, [0, height * .294, 0], [span - .014, height * .335, .083]);
  for (const side of [-1, 1]) {
    const face = namedGroup(panel, 'haiyue-huaban-front-or-back-carving'); face.position.z = side * .041; if (side < 0) face.rotation.y = Math.PI;
    for (const y of [.154, .437]) block(face, [0, height * y, .003], [span - .068, .014, .014]);
    for (const x of [-(span - .082) / 2, (span - .082) / 2]) block(face, [x, height * .295, .003], [.014, height * .288, .014]);
    const flower = namedGroup(face, 'haiyue-huaban-lotus-and-leafy-scroll'); flower.position.y = height * .294;
    for (let leaf = 0; leaf < 8; leaf++) put('haiyue-relief-lotus-petal', () => haiyueReliefLeaf({ length: .095, width: .047, lift: .025 }), [0, 0, .004], [1, height, 1], [0, 0, leaf * Math.PI / 4], flower);
    const center = b.proto('haiyue-flower-seed-center', () => new THREE.SphereGeometry(.023, 40, 20)); b.put(flower, center, m, [0, 0, .009], [1, 1, .48]);
    for (const sign of [-1, 1]) {
      // Rotation, not reflection: normals and all instance determinants stay positive.
      const scroll = namedGroup(flower, 'haiyue-authored-leafy-scroll'); scroll.position.x = sign * .077; if (sign < 0) scroll.rotation.z = Math.PI;
      put('haiyue-relief-scroll', haiyueReliefScroll, [0, 0, 0], [Math.max(.34, (span / 2 - .15) / .44), height, 1], [0, 0, 0], scroll);
      for (const [x, y, angle, scale] of [[.11, .012, -.57, .82], [.23, -.019, 2.47, .76], [.32, .020, -.61, .66]]) put('haiyue-relief-vine-leaf', () => haiyueReliefLeaf(), [x * Math.max(.34, (span / 2 - .15) / .44), height * y, -.001], [scale, height * scale, 1], [0, 0, angle], scroll);
    }
  }
  put('haiyue-vase-support', () => haiyueRailTurning([[0, 0], [.062, 0], [.069, .013], [.063, .025], [.047, .035], [.031, .071], [.029, .110], [.042, .139], [.062, .160], [.060, .180], [.043, .198], [.040, .217], [.063, .225], [0, .225]], 96, 'haiyue-profiled-jingping-support'), [0, floorY + height * .533, 0], [1, height, 1]);
  for (const x of [-span / 4, span / 4]) put(`haiyue-pierced-arch-${span / 2}`, () => haiyuePiercedArchHeader(span / 2 - .050), [x, floorY + height * .744, 0], [1, height, 1]);
  return g;
}
