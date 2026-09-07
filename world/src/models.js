import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledBlock, assignArchitecturalUVs, registerArchitectureMaterials } from './architecture.js';
export { loadArchitectureAssets } from './architecture.js';

// Original architecture with licensed CC0 PBR surfaces. Dimensions are metres.
const TAU = Math.PI * 2;
const materials = {};
function material(name, color, options = {}) {
  if (!materials[name]) {
    materials[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...options });
    materials[name].name = name;
  }
  return materials[name];
}

const M = {
  stone: material('limestone', '#a7c3d1'),
  stoneLight: material('carved-limestone', '#ccd8d9'),
  stoneDark: material('weathered-stone', '#728988'),
  mortar: material('deep-mortar', '#53574f'),
  slate: material('foundation', '#8a9388'),
  rock: material('broken-rock', '#a0a397'),
  roof: material('blue-grey-slate', '#7b8b8a', { metalness: 0.03, roughness: 0.78 }),
  roofLight: material('slate-edges', '#8d9b97', { metalness: 0.02, roughness: 0.8 }),
  roofDark: material('deep-roof', '#536269'),
  copper: material('oxidized-copper', '#c4d0ba', { metalness: 0.86, roughness: 0.6 }),
  brass: material('antique-brass', '#b98a48', { metalness: 0.68, roughness: 0.4 }),
  gold: material('polished-brass', '#e3b76f', { metalness: 0.55, roughness: 0.35 }),
  wood: material('walnut', '#a69787'),
  woodLight: material('oak', '#c7b097'),
  recess: material('window-recess', '#182728'),
  glass: material('amber-windows', '#d5a76b', { emissive: '#ffa34b', emissiveIntensity: 0.6, roughness: 0.9 }),
  glassDim: material('quiet-amber-windows', '#706447', { emissive: '#b17b3f', emissiveIntensity: 0.2, roughness: 0.92 }),
  glassBlue: material('blue-windows', '#719a9d', { emissive: '#508f98', emissiveIntensity: 0.26, roughness: 0.9 }),
  purple: material('magic-violet', '#bc96ff', { emissive: '#9258ed', emissiveIntensity: 0.85 }),
  ivy: material('ivy-dark', '#384b2d', { side: THREE.DoubleSide }),
  ivyLight: material('ivy-light', '#65764b', { side: THREE.DoubleSide }),
  burgundy: material('academy-burgundy', '#712f43'),
  cloth: material('academy-teal', '#215762'),
  paper: material('parchment', '#e9d7a8'),
  skin: material('skin', '#d9a780'),
  hair: material('hair', '#2a272a'),
  straw: material('broom-straw', '#a57c47'),
  spirit: material('spirit', '#61579c', { emissive: '#49347e', emissiveIntensity: 0.4, roughness: 0.4 }),
  eyes: material('spirit-eyes', '#e9dbff', { emissive: '#d8bdff', emissiveIntensity: 1.65 }),
};
registerArchitectureMaterials(M);

const geometryCache = new Map();
function cached(key, make) {
  if (!geometryCache.has(key)) geometryCache.set(key, make());
  return geometryCache.get(key);
}

const boxGeometry = cached('box', () => new THREE.BoxGeometry(1, 1, 1));
const sphereGeometry = cached('sphere', () => new THREE.SphereGeometry(1, 12, 8));
const icoGeometry = cached('ico', () => new THREE.IcosahedronGeometry(1, 0));
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const up = new THREE.Vector3(0, 1, 0);

// Bake transforms and merge by material: intricate silhouettes, few draw calls.
class Builder {
  constructor(name) {
    this.group = new THREE.Group();
    this.group.name = name;
    this.parts = new Map();
  }

  add(geometry, mat, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    transformed.deleteAttribute('uv1');
    quaternion.setFromEuler(euler.set(...rotation));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    transformed.applyMatrix4(matrix);
    assignArchitecturalUVs(transformed, mat.userData.metresPerRepeat || 2);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(transformed);
    return this;
  }

  box(x, y, z, w, h, d, mat = M.stone, ry = 0) {
    if ((mat === M.stoneLight || mat === M.stoneDark) && Math.min(w, h, d) > 0.21) {
      return this.add(beveledBlock(w, h, d), mat, [x, y, z], [1, 1, 1], [0, ry, 0]);
    }
    return this.add(boxGeometry, mat, [x, y, z], [w, h, d], [0, ry, 0]);
  }

  sphere(x, y, z, radius, mat = M.brass, scale = [1, 1, 1]) {
    return this.add(sphereGeometry, mat, [x, y, z], scale.map((v) => v * radius));
  }

  cylinder(x, y, z, top, bottom, height, mat = M.stone, segments = 12, ry = 0) {
    const key = `cylinder-${top}-${bottom}-${height}-${segments}`;
    return this.add(cached(key, () => new THREE.CylinderGeometry(top, bottom, height, segments)), mat, [x, y, z], [1, 1, 1], [0, ry, 0]);
  }

  ring(x, y, z, radius, tube, mat = M.brass, rotation = [Math.PI / 2, 0, 0], arc = TAU) {
    const key = `torus-${radius}-${tube}-${arc}`;
    return this.add(cached(key, () => new THREE.TorusGeometry(radius, tube, 5, 32, arc)), mat, [x, y, z], [1, 1, 1], rotation);
  }

  beam(a, b, radius, mat = M.wood, endRadius = radius, segments = 6) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(endRadius, radius, delta.length(), segments);
    const rotated = geometry.toNonIndexed();
    matrix.compose(start.add(end).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()), new THREE.Vector3(1, 1, 1));
    rotated.applyMatrix4(matrix);
    assignArchitecturalUVs(rotated, mat.userData.metresPerRepeat || 2);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(rotated);
    geometry.dispose();
    return this;
  }

  finish() {
    for (const [mat, fragments] of this.parts) {
      const geometry = mergeGeometries(fragments, false);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = `${this.group.name}-${Object.keys(M).find((key) => M[key] === mat) || mat.name || 'detail'}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      fragments.forEach((fragment) => fragment.dispose());
    }
    this.parts.clear();
    return this.group;
  }
}

function lancet(width, height) {
  return cached(`lancet-${width}-${height}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height * 0.6);
    shape.quadraticCurveTo(width * 0.44, height * 0.84, 0, height);
    shape.quadraticCurveTo(-width * 0.44, height * 0.84, -width / 2, height * 0.6);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 6);
  });
}

function holePath(width, height, x = 0, y = 0) {
  const path = new THREE.Path();
  path.moveTo(x - width / 2, y);
  path.lineTo(x - width / 2, y + height * 0.6);
  path.quadraticCurveTo(x - width * 0.44, y + height * 0.84, x, y + height);
  path.quadraticCurveTo(x + width * 0.44, y + height * 0.84, x + width / 2, y + height * 0.6);
  path.lineTo(x + width / 2, y);
  path.closePath();
  return path;
}

function archFrame(width, height, border = 0.17, depth = 0.16, bevel = true) {
  return cached(`arch-frame-${width}-${height}-${border}-${depth}-${bevel}`, () => {
    const shape = new THREE.Shape();
    const w = width + border * 2, h = height + border * 1.2;
    shape.moveTo(-w / 2, -border * 0.25);shape.lineTo(w / 2, -border * 0.25);
    shape.lineTo(w / 2, h * 0.6);shape.quadraticCurveTo(w * 0.44, h * 0.84, 0, h);
    shape.quadraticCurveTo(-w * 0.44, h * 0.84, -w / 2, h * 0.6);shape.closePath();
    shape.holes.push(holePath(width, height));
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel, bevelSize: 0.028, bevelThickness: 0.025, bevelSegments: 1, curveSegments: 4 });
  });
}

function wallPanel(b, x, y, z, width, height, openings = [], ry = 0, depth = 0.48) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);shape.lineTo(width / 2, 0);shape.lineTo(width / 2, height);shape.lineTo(-width / 2, height);shape.closePath();
  for (const o of openings) shape.holes.push(holePath(o.w, o.h, o.x || 0, o.y));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  b.add(geometry, M.stone, [x - Math.sin(ry) * depth, y, z - Math.cos(ry) * depth], [1, 1, 1], [0, ry, 0]);
  geometry.dispose();
}

function hallVolume(b, x, base, z, width, height, depth, frontOpenings = []) {
  wallPanel(b, x, base, z + depth / 2, width, height, frontOpenings);
  b.box(x, base + height / 2, z - depth / 2 + 0.3, width, height, 0.6, M.stone);
  b.box(x - width / 2 + 0.3, base + height / 2, z, 0.6, height, depth, M.stone);
  b.box(x + width / 2 - 0.3, base + height / 2, z, 0.6, height, depth, M.stone);
  b.box(x, base + 0.06, z, width, 0.12, depth, M.wood);
  b.box(x, base + height - 0.05, z, width, 0.1, depth, M.wood);
}

function quoinStrip(b, x, y, z, height, ry = 0, width = 0.62) {
  const rows = Math.floor(height / 0.48);
  for (let i = 0; i < rows; i++) {
    b.add(beveledBlock(i % 2 ? width : width * 1.32, 0.435, 0.29, 0.025), i % 5 ? M.stoneLight : M.stoneDark,
      [x, y + 0.24 + i * 0.48, z], [1, 1, 1], [0, ry, (i % 3 - 1) * 0.006]);
  }
}

function dentilCourse(b, x, y, z, width, ry = 0) {
  for (let d = -width / 2 + 0.28; d < width / 2; d += 0.52) {
    b.box(x + Math.cos(ry) * d, y, z - Math.sin(ry) * d, 0.24, 0.3, 0.28, M.stoneLight, ry);
  }
}

function windowAt(b, x, y, z, width = 1, height = 2.4, ry = 0, glow = M.glass, inset = 0.02) {
  const point = (u, v, depth) => [x + Math.cos(ry) * u + Math.sin(ry) * depth, y + v, z - Math.sin(ry) * u + Math.cos(ry) * depth];
  b.add(archFrame(width + 0.2, height + 0.13, 0.16, 0.13), M.stoneDark, point(0, 0, 0.025), [1, 1, 1], [0, ry, 0]);
  b.add(archFrame(width, height, 0.105, 0.12, false), M.stoneLight, point(0, 0.035, 0.14), [1, 1, 1], [0, ry, 0]);
  b.add(lancet(width - 0.045, height - 0.015), M.recess, point(0, 0.04, inset), [1, 1, 1], [0, ry, 0]);
  const pane = glow === M.glass && Math.sin(x * 13.1 + z * 8.9 + y * 3) > 0.25 ? M.glassDim : glow;
  b.add(lancet(width - 0.11, height - 0.1), pane, point(0, 0.085, inset + 0.017), [1, 1, 1], [0, ry, 0]);
  const metal = M.wood;
  const mullion = point(0, height * 0.39, inset + 0.045);
  b.box(mullion[0], mullion[1], mullion[2], width > 1.3 ? 0.11 : 0.065, height * 0.74, 0.07, M.stoneLight, ry);
  for (const v of [height * 0.29, height * 0.57]) {
    const p = point(0, v, inset + 0.05);b.box(p[0], p[1], p[2], width * 0.89, 0.042, 0.065, metal, ry);
  }
  // A trefoil crown and leaded diamond lattice are real geometry, not painted marks.
  const radius = width * 0.145;
  for (const [u, v] of [[-radius * 0.7, height * 0.73], [radius * 0.7, height * 0.73], [0, height * 0.73 + radius]]) {
    const p = point(u, v, inset + 0.055);
    b.add(cached(`tracery-${radius}`, () => new THREE.TorusGeometry(radius, 0.025, 3, 12)), M.stoneLight, p, [1,1,1], [0,ry,0]);
  }
  for (let row = 0; row < Math.floor(height / 0.6); row++) {
    const v = 0.25 + row * 0.5;
    if (v + 0.42 > height * 0.66) break;
    for (const side of [-1, 1]) {
      b.beam(point(side * width * 0.38, v, inset + 0.05), point(0, v + 0.38, inset + 0.05), 0.009, metal, 0.009, 4);
    }
  }
  for (const side of [-1, 1]) {
    const p = point(side * (width / 2 + 0.2), height * 0.27, 0.13);
    b.box(p[0], p[1], p[2], 0.16, height * 0.51, 0.23, M.stoneLight, ry);
  }
  const sill = point(0, -0.11, 0.19);
  b.box(sill[0], sill[1], sill[2], width + 0.65, 0.24, 0.62, M.stoneLight, ry);
}

function doorAt(b, x, z, width = 2.3, height = 4.4, y = 0.3) {
  b.add(archFrame(width + 0.4, height + 0.24, 0.22, 0.18), M.stoneDark, [x, y, z]);
  b.add(archFrame(width + 0.15, height + 0.1, 0.17, 0.22), M.stoneLight, [x, y, z + 0.13]);
  b.add(archFrame(width, height, 0.08, 0.24), M.stoneDark, [x, y, z + 0.23]);
  b.add(lancet(width + 0.1, height), M.recess, [x, y, z + 0.015]);
  b.add(lancet(width, height), M.wood, [x, y, z + 0.035]);
  for (let i = -2; i <= 2; i++) b.box(x + i * width / 5, y + height * 0.35, z + 0.09, 0.035, height * 0.69, 0.04, M.woodLight);
  for (const sy of [0.8, 2.4]) {
    b.box(x, y + sy, z + 0.12, width * 0.94, 0.12, 0.08, M.brass);
    b.sphere(x - width * 0.34, y + sy, z + 0.2, 0.055, M.gold);
    b.sphere(x + width * 0.34, y + sy, z + 0.2, 0.055, M.gold);
  }
  b.ring(x + width * 0.13, y + 1.8, z + 0.18, 0.12, 0.025, M.brass, [0, 0, 0]);
  b.ring(x - width * 0.13, y + 1.8, z + 0.18, 0.12, 0.025, M.brass, [0, 0, 0]);
  quoinStrip(b, x - width / 2 - 0.43, y, z + 0.14, height * 0.6, 0, 0.37);
  quoinStrip(b, x + width / 2 + 0.43, y, z + 0.14, height * 0.6, 0, 0.37);
}

function pitchedRoof(b, x, y, z, width, depth, rise, mat = M.roof) {
  const shape = new THREE.Shape();
  shape.moveTo(-depth / 2, 0);
  shape.lineTo(depth / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  // Extruded local Z becomes world X; local X becomes world -Z.
  b.add(geometry, mat, [x - width / 2, y, z], [1, 1, 1], [0, Math.PI / 2, 0]);
  geometry.dispose();
  b.beam([x - width / 2 - 0.1, y + rise, z], [x + width / 2 + 0.1, y + rise, z], 0.13, M.roofLight);
  for (const side of [-1, 1]) {
    b.box(x, y, z + side * depth / 2, width + 0.18, 0.22, 0.27, M.roofDark);
    const courses = Math.ceil(Math.hypot(rise, depth / 2) / 0.55);
    for (let i = 1; i < courses; i++) {
      b.box(x, y + rise * i / courses, z + side * depth * (1 - i / courses) / 2, width, 0.026, 0.035, M.roofLight);
    }
  }
  for (let xx = x - width / 2; xx <= x + width / 2 + 0.01; xx += width / 8) {
    for (const side of [-1, 1]) b.beam([xx, y + 0.04, z + side * depth / 2], [xx, y + rise + 0.04, z], 0.035, M.roofDark);
  }
}

function spire(b, x, baseY, z, radius, height, ornament = true) {
  b.cylinder(x, baseY + 0.1, z, radius, radius * 1.02, 0.26, M.roofDark, 12);
  b.cylinder(x, baseY + height / 2, z, 0.08, radius, height, M.roof, 12);
  for (let tier = 1; tier < Math.ceil(height / 0.7); tier++) {
    const t = tier / Math.ceil(height / 0.7);
    b.cylinder(x, baseY + height * t, z, radius * (1 - t) + 0.017, radius * (1 - t) + 0.052, 0.042, M.roofLight, 16);
  }
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * TAU;
    b.beam([x + Math.sin(angle) * radius, baseY + 0.12, z + Math.cos(angle) * radius], [x, baseY + height, z], 0.025, M.roofLight);
  }
  if (ornament) {
    b.cylinder(x, baseY + height + 0.38, z, 0.035, 0.065, 0.8, M.brass, 6);
    b.sphere(x, baseY + height + 0.46, z, 0.16, M.gold);
  }
}

function tower(b, x, z, radius, height, roofHeight, options = {}) {
  const { windows = true, balcony = false, roof = true, openTop = false, floorPitch = 5.25 } = options;
  const windowHeight = 2.85;
  const levels = Math.max(1, Math.floor((height - 2 - windowHeight) / floorPitch) + 1);
  const apothem = radius * Math.cos(Math.PI / 12);
  b.cylinder(x, 0.5, z, radius + 0.3, radius + 0.6, 1, M.slate, 12);
  for (let face = 0; face < 12; face++) {
    const a = face / 12 * TAU, openings = [];
    if (windows && face % 2 === 0) for (let level = 0; level < levels; level++) openings.push({ x: 0, y: 2 + level * floorPitch, w: radius * 0.36, h: windowHeight });
    wallPanel(b, x + Math.sin(a) * apothem, 0.7, z + Math.cos(a) * apothem, 2 * radius * Math.sin(Math.PI / 12), height - 0.7, openings.map(o => ({...o, y:o.y - 0.7})), a, 0.32);
  }
  for (const y of [1.15, height * 0.48, height - 0.5, height]) b.cylinder(x, y, z, radius + 0.09, radius + 0.16, 0.23, M.stoneLight, 12, Math.PI / 12);
  for (let side = 0; side < 6; side++) {
    const a = side / 6 * TAU;
    const px = x + Math.sin(a) * apothem;
    const pz = z + Math.cos(a) * apothem;
    if (windows) {
      for (let level = 0; level < levels; level++) {
        windowAt(b, px, 2 + level * floorPitch, pz, radius * 0.36, windowHeight, a, openTop && level === levels - 1 ? M.recess : side % 3 ? M.glass : M.glassBlue, -0.2);
      }
    }
    b.box(x + Math.sin(a) * (radius + 0.08), 2.4, z + Math.cos(a) * (radius + 0.08), 0.32, 4.6, 0.5, M.stoneDark, a);
  }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU;
    b.box(x + Math.sin(a) * (radius + 0.09), height - 0.75, z + Math.cos(a) * (radius + 0.09), 0.25, 0.48, 0.29, M.stoneLight, a);
  }
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2 + Math.PI / 6;
    quoinStrip(b, x + Math.sin(a) * (radius + 0.01), 0.85, z + Math.cos(a) * (radius + 0.01), Math.min(4.2, height), a, 0.4);
  }
  if (balcony) {
    b.cylinder(x, height - 1, z, radius + 0.7, radius + 0.3, 0.5, M.stoneLight, 12);
    b.ring(x, height, z, radius + 0.55, 0.06);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      b.cylinder(x + Math.sin(a) * (radius + 0.55), height - 0.48, z + Math.cos(a) * (radius + 0.55), 0.045, 0.045, 1, M.brass, 5);
    }
  }
  if (roof) spire(b, x, height + 0.25, z, radius * 1.28, roofHeight);
}

function lantern(b, x, y, z, direction = 1) {
  b.beam([x, y + 0.6, z], [x + direction * 0.6, y + 0.6, z], 0.06, M.brass);
  const lx = x + direction * 0.55;
  b.cylinder(lx, y + 0.38, z, 0.3, 0.23, 0.16, M.roofDark, 6);
  b.cylinder(lx, y, z, 0.21, 0.17, 0.58, M.glass, 6);
  b.cylinder(lx, y - 0.35, z, 0.23, 0.1, 0.16, M.brass, 6);
  for (const side of [-1, 1]) b.box(lx + side * 0.19, y, z, 0.035, 0.65, 0.04, M.brass);
}

function ivy(b, x, y, z, width = 1.5, height = 5, ry = 0) {
  const leaf = cached('lobed-ivy-leaf', () => {
    const outline = [[0,.25],[.065,.10],[.20,.13],[.12,-.02],[.17,-.12],[.02,-.09],[0,-.22],[-.03,-.09],[-.16,-.12],[-.12,-.02],[-.20,.13],[-.07,.10]];
    const positions = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], c = outline[(i + 1) % outline.length];
      positions.push(0,0,.027,a[0],a[1],0,c[0],c[1],0);
    }
    const g = new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
  });
  let previous = [x, y, z + 0.02];
  for (let i = 0; i < 27; i++) {
    const t = i / 27;
    const sideways = (Math.sin(i * .57) * .35 + Math.sin(i * 1.7) * .16) * width * (.35 + t * .65);
    const center = [x + Math.cos(ry) * sideways, y + height * t, z - Math.sin(ry) * sideways + .04];
    b.beam(previous, center, .014, M.ivy, .011, 4);previous = center;
    for (let j = -1; j <= 1; j++) {
      const spread = j * (.12 + (i % 3) * .055), scale = .58 + ((i + j + 3) % 4) * .13;
      const p = [center[0] + Math.cos(ry) * spread, center[1] + Math.sin(i * 1.6 + j) * .11, center[2] - Math.sin(ry) * spread + .025];
      b.add(leaf, (i + j) % 4 ? M.ivy : M.ivyLight, p, [scale,scale,scale], [.15 * Math.sin(i), ry, j * -.7 + Math.sin(i * 2.4) * .25]);
    }
  }
}

function stairs(b, x, z, width, count = 4, stepHeight = 0.2, depth = 0.8) {
  for (let i = 0; i < count; i++) b.box(x, (count - i) * stepHeight / 2, z + i * depth, width + i * 0.22, (count - i) * stepHeight, depth + 0.1, i % 2 ? M.stone : M.stoneLight);
}

function banner(b, x, y, z, width = 1.1, length = 3, color = M.burgundy) {
  b.beam([x - width * 0.65, y, z], [x + width * 0.65, y, z], 0.05, M.brass);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, -length + 0.3);
  shape.lineTo(0, -length);
  shape.lineTo(-width / 2, -length + 0.3);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  b.add(geometry, color, [x, y, z]);
  geometry.dispose();
  b.box(x - width * 0.4, y - length / 2 + 0.05, z + 0.06, 0.045, length - 0.35, 0.03, M.gold);
  b.box(x + width * 0.4, y - length / 2 + 0.05, z + 0.06, 0.045, length - 0.35, 0.03, M.gold);
  b.add(icoGeometry, M.gold, [x, y - length * 0.38, z + 0.09], [0.22, 0.35, 0.04]);
}

export function createCastle() {
  const b = new Builder('academy-castle');
  b.box(0, 0.3, 0, 34, 0.6, 22, M.slate);
  b.box(0, 0.67, 0, 32.7, 0.22, 20.8, M.stoneLight);
  hallVolume(b, 0, 0.7, -0.6, 18, 13.4, 10.8, [-6.6, -3.3, 0, 3.3, 6.6].map(x => ({ x, y:4.65, w:1.45, h:6.95 })));
  b.box(0, 2.2, 0, 24, 3, 14, M.stoneDark);
  b.box(0, 3.82, 0, 24.3, 0.24, 14.2, M.stoneLight);
  for (const side of [-1, 1]) {
    hallVolume(b, side * 10.5, 0.8, -1.1, 6, 10.4, 13.5, [-1.7, 0, 1.7].map(x => ({x, y:4.5, w:0.8, h:4.1})));
    pitchedRoof(b, side * 10.5, 11.4, -1.1, 6.8, 14.4, 5.8);
    for (let j = -1; j <= 1; j++) {
      windowAt(b, side * 10.5 + j * 1.7, 5.3, 5.65, 0.8, 4.1, 0, M.glass, -0.22);
      windowAt(b, side * 13.54, 3.8, -1 + j * 3.8, 1.1, 5.6, side * Math.PI / 2);
      windowAt(b, side * 9.04, 10.65, -1 + j * 3.4, 0.82, 2.6, side * Math.PI / 2);
    }
    for (const z of [-2.8, 3.3]) {
      b.box(side * 15.8, 2.8, z, 0.85, 4.4, 1.1, M.stoneDark);
      b.box(side * 15.8, 5.12, z, 1.05, 0.24, 1.25, M.stoneLight);
      b.beam([side * 15.8, 4.9, z], [side * 13.3, 9.7, z], 0.24, M.stoneLight, 0.19, 5);
      spire(b, side * 15.8, 5.25, z, 0.6, 2.2);
    }
    for (const x of [7.7, 13.3]) quoinStrip(b, side * x, 0.8, 5.83, 10.4, 0, 0.52);
    dentilCourse(b, side * 10.5, 10.96, 5.92, 5.9);
  }
  pitchedRoof(b, 0, 14.15, -0.6, 18.9, 11.8, 7.4);
  b.box(0, 13.7, 4.92, 18.1, 0.24, 0.28, M.stoneLight);
  for (const x of [-6.6, -3.3, 0, 3.3, 6.6]) {
    windowAt(b, x, 5.35, 4.8, 1.45, 6.95, 0, M.glass, -0.25);
    if (x !== 0) windowAt(b, x, 1.3, 7.02, 0.8, 1.9);
    b.box(x + 1.54, 7.4, 5.12, 0.38, 12.1, 0.68, M.stoneLight);
    b.box(x + 1.54, 2.2, 5.4, 0.7, 2.9, 1.2, M.stoneDark);
    spire(b, x + 1.54, 13.8, 5.12, 0.31, 1.9, false);
  }
  for (const x of [-8.78, 8.78]) quoinStrip(b, x, 0.85, 4.96, 12.7, 0, 0.5);
  dentilCourse(b, 0, 13.4, 5.08, 17.7);
  // Distinct tiers rise from the approach to a needle-thin astronomical keep.
  tower(b, -2, -6.8, 3.6, 34.5, 13.8, { balcony: true });
  tower(b, -11.25, -5.6, 2.35, 25.1, 10.1);
  tower(b, 10.8, -5.9, 2.6, 28.2, 11.3);
  tower(b, -11.25, 6.1, 2.1, 18.1, 8.4);
  tower(b, 11.25, 6.1, 2.1, 21.3, 9.3);
  tower(b, 5.5, -5.7, 1.45, 31.2, 11.4);
  tower(b, -6.3, -7.6, 1.02, 28.4, 10.7);
  // Projecting entrance, deeply layered pointed doorway and little turrets.
  b.box(0, 3.3, 7.1, 5.2, 5.2, 2.2, M.stone);
  b.box(0, 6.1, 7.1, 5.6, 0.35, 2.65, M.stoneLight);
  for (let i = -2; i <= 2; i++) b.box(i * 1.1, 6.7, 8.19, 0.65, 1.05, 0.6, M.stoneLight);
  doorAt(b, 0, 8.23, 2.25, 4.55, 0.8);
  stairs(b, 0, 8.6, 4.1, 4, 0.2);
  for (const side of [-1, 1]) {
    lantern(b, side * 2.1, 3.1, 8.55, side);
    banner(b, side * 6, 12.5, 5.45, 1.35, 4.7, side < 0 ? M.burgundy : M.cloth);
  }
  // Roof dormers add a second scale of detail above the stone nave.
  for (const x of [-6, 0, 6]) {
    b.box(x, 17.15, 2.45, 1.8, 2.9, 1.6, M.stone);
    windowAt(b, x, 15.85, 3.28, 0.8, 2.5);
    pitchedRoof(b, x, 18.7, 2.4, 2.35, 2.1, 2.05);
  }
  for (const x of [-7, 6.5]) {
    b.box(x, 21.1, -2.8, 0.85, 3.2, 0.85, M.stoneDark);
    b.box(x, 22.8, -2.8, 1.05, 0.24, 1.05, M.stoneLight);
  }
  ivy(b, -8.6, 0.9, 7.15, 1.6, 5.4);
  ivy(b, 12.3, 0.8, 5.85, 1, 4.2);
  ivy(b, -4.2, 0.8, 7.16, 0.7, 2.8);
  return b.finish();
}

function railing(b, x, y, z, radius, count = 24) {
  b.ring(x, y + 1, z, radius, 0.065, M.brass);
  b.ring(x, y + 0.15, z, radius, 0.055, M.brass);
  for (let i = 0; i < count; i++) {
    const a = i / count * TAU;
    b.cylinder(x + Math.sin(a) * radius, y + 0.53, z + Math.cos(a) * radius, 0.045, 0.045, 1.05, M.brass, 5);
  }
}

function armillary(b, x, y, z, radius) {
  b.sphere(x, y, z, radius * 0.29, M.glassBlue);
  b.ring(x, y, z, radius, 0.055, M.brass, [0.4, 0.2, 0.3]);
  b.ring(x, y, z, radius * 0.85, 0.055, M.gold, [Math.PI / 2, 0.5, 0]);
  b.ring(x, y, z, radius * 1.12, 0.07, M.brass, [0, Math.PI / 2, -0.45]);
  b.beam([x, y - radius * 1.3, z], [x, y + radius * 1.3, z], 0.04, M.brass);
  b.sphere(x, y + radius * 1.35, z, 0.11, M.gold);
}

export function createObservatory() {
  const b = new Builder('celestial-observatory');
  b.cylinder(0, 0.4, 0, 7.7, 8.2, 0.8, M.slate, 12);
  b.cylinder(0, 1, 0, 6.7, 7.3, 0.5, M.stoneLight, 12);
  for (let face = 0; face < 16; face++) {
    const a = face / 16 * TAU, openings = face % 2 === 0 ? [{x:0,y:4,w:1.2,h:2.7}] : [];
    if (face === 0) openings.push({x:0,y:0.1,w:1.65,h:3.5});
    wallPanel(b, Math.sin(a) * 5.1, 1.1, Math.cos(a) * 5.1, 2 * 5.1 * Math.tan(Math.PI / 16), 8, openings, a, 0.4);
  }
  b.cylinder(0, 3.7, 0, 5.37, 5.37, 0.25, M.stoneLight, 12);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    windowAt(b, Math.sin(a) * 5.1, 5.1, Math.cos(a) * 5.1, 1.2, 2.7, a, M.glassBlue, -0.23);
    b.box(Math.sin(a) * 5.12, 2.4, Math.cos(a) * 5.12, 0.6, 2.8, 0.6, M.stoneDark, a);
  }
  b.cylinder(0, 9.25, 0, 6.45, 5.7, 0.55, M.stoneLight, 16);
  railing(b, 0, 9.5, 0, 6.2);
  b.cylinder(0, 10.6, 0, 4.85, 4.85, 2.3, M.stoneDark, 24);
  b.cylinder(0, 11.7, 0, 5.15, 5.15, 0.22, M.brass, 24);
  const dome = new THREE.SphereGeometry(5.12, 24, 12, 0, TAU, 0, Math.PI / 2);
  b.add(dome, M.copper, [0, 11.78, 0]);
  dome.dispose();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    const points = [];
    for (let step = 0; step <= 10; step++) {
      const phi = step / 10 * Math.PI / 2;
      points.push([Math.sin(a) * Math.sin(phi) * 5.14, 11.8 + Math.cos(phi) * 5.14, Math.cos(a) * Math.sin(phi) * 5.14]);
    }
    for (let p = 0; p < points.length - 1; p++) b.beam(points[p], points[p + 1], 0.045, M.brass);
  }
  b.ring(0, 13.9, 0, 4.65, 0.06, M.brass);
  // Oversized brass telescope reads clearly from the overhead camera.
  b.beam([0, 12, 3], [0, 16.2, 7.1], 0.63, M.brass, 0.88, 16);
  b.beam([0, 15.85, 6.77], [0, 16.37, 7.26], 0.96, M.roofDark, 0.96, 16);
  b.beam([0, 16.37, 7.27], [0, 16.4, 7.3], 0.81, M.glassBlue, 0.81, 16);
  armillary(b, 0, 19, 0, 1.65);
  b.cylinder(0, 17.05, 0, 0.35, 0.6, 1.05, M.brass, 12);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    b.box(Math.sin(a) * 5.3, 8.7, Math.cos(a) * 5.3, 0.26, 0.42, 0.4, M.stoneLight, a);
  }
  doorAt(b, 0, 5.2, 1.65, 3.5, 1.2);
  stairs(b, 0, 5.6, 3.6, 6, 0.2, 0.65);
  for (const side of [-1, 1]) {
    lantern(b, side * 2.7, 3.6, 5.1, side);
    b.box(side * 5.7, 0.9, 5.5, 1.4, 1.1, 1.4, M.stone);
    armillary(b, side * 5.7, 2.8, 5.5, 0.85);
  }
  ivy(b, -3.3, 1.3, 4.2, 0.85, 3.2, -0.7);
  return b.finish();
}

function roseWindow(b, x, y, z, radius) {
  b.ring(x, y, z, radius + 0.13, 0.18, M.stoneLight, [0, 0, 0]);
  b.add(cached(`disc-${radius}`, () => new THREE.CircleGeometry(radius, 32)), M.glass, [x, y, z + 0.025]);
  b.ring(x, y, z + 0.05, radius * 0.38, 0.055, M.brass, [0, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    b.beam([x + Math.sin(a) * radius * 0.38, y + Math.cos(a) * radius * 0.38, z + 0.06], [x + Math.sin(a) * radius, y + Math.cos(a) * radius, z + 0.06], 0.065, M.wood);
  }
}

function book(b, x, y, z, width, height, depth, ry = 0, color = M.burgundy) {
  b.box(x, y, z, width, height, depth, color, ry);
  b.box(x + Math.sin(ry) * depth * 0.02, y, z + Math.cos(ry) * depth * 0.02, width * 0.91, height * 0.81, depth * 0.96, M.paper, ry);
  for (const side of [-1, 1]) b.box(x, y + side * height * 0.47, z, width + 0.08, height * 0.09, depth + 0.07, color, ry);
}

export function createLibrary() {
  const b = new Builder('archive-library');
  b.box(0, 0.45, 0, 17, 0.9, 13.5, M.slate);
  hallVolume(b, 0, 0.75, -0.7, 14.3, 8.5, 10.6, [-5.2, -2.6, 2.6, 5.2].map(x => ({x, y:2.35, w:1.4, h:4.25})));
  b.box(0, 1.3, -0.7, 14.8, 0.35, 11.1, M.stoneLight);
  b.box(0, 9.45, -0.7, 14.8, 0.35, 11.1, M.stoneLight);
  pitchedRoof(b, 0, 9.6, -0.7, 15.3, 11.6, 5.2);
  for (const x of [-5.2, -2.6, 2.6, 5.2]) {
    windowAt(b, x, 3.1, 4.6, 1.4, 4.25, 0, M.glass, -0.22);
    b.box(x + 1.02, 4.3, 4.95, 0.35, 7, 0.75, M.stoneLight);
    b.box(x + 1.02, 1.9, 5.27, 0.68, 2.1, 1.4, M.stoneDark);
  }
  // Gabled frontispiece and a luminous wheel of knowledge.
  b.box(0, 5.35, 5.15, 4.7, 9.4, 1.9, M.stone);
  pitchedRoof(b, 0, 10.08, 5.2, 5.4, 2.7, 2.9);
  roseWindow(b, 0, 8.6, 6.14, 1.2);
  doorAt(b, 0, 6.15, 2, 4.25, 0.9);
  stairs(b, 0, 6.6, 3.6, 4, 0.225, 0.65);
  tower(b, -5.1, -3.9, 1.65, 13.2, 5.7);
  b.box(5.2, 14.3, -2.6, 0.8, 4, 0.8, M.stoneDark);
  b.box(5.2, 16.4, -2.6, 1.05, 0.26, 1.05, M.stoneLight);
  for (const side of [-1, 1]) {
    banner(b, side * 5, 8.9, 4.9, 1, 2.4, M.cloth);
    lantern(b, side * 2.17, 4.1, 6.3, side);
    windowAt(b, side * 7.17, 3.2, -1.5, 1.1, 4.1, side * Math.PI / 2);
    quoinStrip(b, side * 6.9, 0.85, 4.77, 8.4, 0, 0.5);
    quoinStrip(b, side * 2.15, 0.85, 6.3, 8.8, 0, 0.39);
  }
  dentilCourse(b, 0, 8.95, 4.85, 14);
  // A monumental open book on its own lectern anchors the approach.
  b.cylinder(5.3, 0.7, 7.4, 0.8, 1.15, 1.35, M.stoneDark, 8);
  b.box(5.3, 1.5, 7.4, 2.5, 0.25, 1.7, M.brass);
  for (const side of [-1, 1]) {
    b.add(boxGeometry, M.burgundy, [5.3 + side * 0.61, 1.86, 7.4], [1.24, 0.13, 1.65], [0, 0, side * 0.21]);
    b.add(boxGeometry, M.paper, [5.3 + side * 0.61, 1.98, 7.4], [1.15, 0.12, 1.51], [0, 0, side * 0.21]);
    for (let line = 0; line < 5; line++) b.box(5.3 + side * 0.65, 2.19, 7 + line * 0.19, 0.69, 0.02, 0.025, M.brass);
  }
  ivy(b, -6.7, 0.95, 4.8, 0.9, 5.7);
  ivy(b, 6.6, 0.95, 4.8, 0.6, 3.4);
  return b.finish();
}

function gear(b, x, y, z, radius, rotation = 0) {
  b.ring(x, y, z, radius * 0.72, radius * 0.16, M.brass, [0, 0, 0]);
  b.ring(x, y, z, radius * 0.21, radius * 0.1, M.gold, [0, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + rotation;
    b.add(boxGeometry, M.brass, [x + Math.sin(a) * radius * 0.92, y + Math.cos(a) * radius * 0.92, z], [radius * 0.25, radius * 0.3, radius * 0.22], [0, 0, -a]);
    if (i % 3 === 0) b.beam([x, y, z], [x + Math.sin(a) * radius * 0.75, y + Math.cos(a) * radius * 0.75, z], radius * 0.055, M.brass);
  }
}

export function createWorkshop() {
  const b = new Builder('alchemy-workshop');
  b.box(0, 0.4, 0, 17, 0.8, 13.4, M.slate);
  hallVolume(b, -1, 0.4, 0, 12, 5.2, 9.5, [{x:-4.1,y:1.8,w:1.25,h:2.45},{x:1.8,y:1.9,w:1.2,h:2.2},{x:-1,y:0.25,w:2.1,h:4.15}]);
  b.box(-1, 6.7, 0, 12, 2.2, 9.5, M.stone);
  pitchedRoof(b, -1, 7.9, 0, 13.1, 10.6, 4.2, M.roofDark);
  b.box(-1, 5.65, 4.85, 12.2, 0.25, 0.25, M.wood);
  for (let x = -6.6; x <= 4.7; x += 2.25) {
    b.box(x, 6.85, 4.86, 0.19, 2.3, 0.23, M.wood);
    b.beam([x, 5.75, 4.89], [x + 2, 7.8, 4.89], 0.06, M.wood);
  }
  // The forge's tall stack, crown, pressure vessels and copper plumbing.
  for (const side of [-1, 1]) {
    b.box(-5.2 + side * 0.9, 8.55, -1.8, 0.3, 16.5, 2.1, M.stoneDark);
    b.box(-5.2, 8.55, -1.8 + side * 0.9, 1.8, 16.5, 0.3, M.stoneDark);
  }
  for (const y of [6, 10.6, 15.5]) b.box(-5.2, y, -1.8, 2.25, 0.3, 2.25, M.stoneLight);
  for (const side of [-1, 1]) {
    b.box(-5.2 + side * 1.08, 17, -1.8, 0.49, 0.65, 2.65, M.stoneLight);
    b.box(-5.2, 17, -1.8 + side * 1.08, 1.7, 0.65, 0.49, M.stoneLight);
  }
  b.box(-5.2, 16.3, -1.8, 1.5, 0.03, 1.5, M.recess);
  b.cylinder(6.05, 4.1, 0.1, 1.65, 1.8, 7.4, M.copper, 24);
  b.sphere(6.05, 7.6, 0.1, 1.66, M.copper, [1, 0.48, 1]);
  for (const y of [1.3, 3.5, 6.9]) b.cylinder(6.05, y, 0.1, 1.83, 1.83, 0.16, M.brass, 12);
  b.beam([6.05, 7.8, 0.1], [6.05, 9.4, 0.1], 0.2, M.brass);
  b.beam([6.05, 9.4, 0.1], [3.5, 9.4, 0.1], 0.2, M.brass);
  b.beam([3.5, 9.4, 0.1], [3.5, 6.2, 0.1], 0.2, M.brass);
  gear(b, 3.2, 4.6, 4.95, 1.3);
  gear(b, 4.85, 3.8, 4.97, 0.75, 0.2);
  doorAt(b, -2, 4.8, 2.1, 4.15, 0.65);
  windowAt(b, -5.1, 2.2, 4.75, 1.25, 2.45, 0, M.glass, -0.22);
  windowAt(b, 0.8, 2.3, 4.75, 1.2, 2.2, 0, M.glassBlue, -0.22);
  stairs(b, -2, 5.15, 3.5, 3, 0.22, 0.65);
  lantern(b, -3.75, 3.5, 5.05, -1);
  banner(b, 0.15, 8, 4.95, 0.85, 2.15, M.burgundy);
  for (const x of [-6.8, 4.8]) quoinStrip(b, x, 0.8, 4.91, 4.6, 0, 0.48);
  for (const x of [-6.2, -4.2]) quoinStrip(b, x, 5.2, -0.69, 11.2, 0, 0.35);
  // Outdoor alchemist's desk and colored phials.
  b.box(4.2, 1.4, 6.7, 3.4, 0.22, 1.5, M.woodLight);
  for (const sx of [-1, 1]) b.box(4.2 + sx * 1.4, 0.85, 6.7, 0.15, 1.1, 1.25, M.wood);
  for (let i = 0; i < 5; i++) {
    const x = 3 + i * 0.56;
    const mat = i % 2 ? M.glassBlue : M.purple;
    b.sphere(x, 1.82, 6.7, 0.18 + i % 2 * 0.045, mat, [1, 1.25, 1]);
    b.cylinder(x, 2.11, 6.7, 0.055, 0.08, 0.25, mat, 7);
    b.cylinder(x, 2.27, 6.7, 0.067, 0.067, 0.1, M.woodLight, 7);
  }
  book(b, 5.35, 1.73, 6.6, 0.67, 0.27, 0.9, 0.25, M.cloth);
  ivy(b, -6.8, 0.9, 4.85, 0.7, 2.3);
  return b.finish();
}

function owl(b, x, y, z, size = 1, ry = 0) {
  b.sphere(x, y + size * 0.4, z, size * 0.38, M.paper, [0.85, 1.2, 0.8]);
  b.sphere(x, y + size * 0.78, z, size * 0.28, M.stoneLight, [1.1, 0.86, 0.9]);
  for (const side of [-1, 1]) {
    b.sphere(x + Math.cos(ry) * side * size * 0.27, y + size * 0.4, z - Math.sin(ry) * side * size * 0.27, size * 0.24, M.woodLight, [0.45, 1.5, 0.7]);
    const px = x + Math.cos(ry) * side * size * 0.12 + Math.sin(ry) * size * 0.2;
    const pz = z - Math.sin(ry) * side * size * 0.12 + Math.cos(ry) * size * 0.2;
    b.sphere(px, y + size * 0.8, pz, size * 0.088, M.recess, [1, 1, 0.4]);
    b.sphere(px, y + size * 0.8, pz + size * 0.025, size * 0.031, M.gold);
  }
  b.add(icoGeometry, M.brass, [x + Math.sin(ry) * size * 0.29, y + size * 0.68, z + Math.cos(ry) * size * 0.29], [size * 0.065, size * 0.11, size * 0.09]);
}

export function createOwlery() {
  const b = new Builder('owl-post-tower');
  b.cylinder(0, 0.4, 0, 5.85, 6.4, 0.8, M.slate, 12);
  tower(b, 0, 0, 3.35, 14.1, 5.8, { windows: true, openTop: true, floorPitch:4.1 });
  b.cylinder(0, 12.4, 0, 4.65, 3.8, 0.38, M.woodLight, 14);
  railing(b, 0, 12.6, 0, 4.43, 21);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    b.beam([Math.sin(a) * 3.1, 10.7, Math.cos(a) * 3.1], [Math.sin(a) * 4.5, 12.3, Math.cos(a) * 4.5], 0.1, M.wood);
  }
  // Exterior spiral steps make the owlery legible as a place to explore.
  let previousRail = null, previousStringer = null;
  for (let i = 0; i < 37; i++) {
    const a = i / 36 * Math.PI * 1.84 + 0.5;
    b.box(Math.sin(a) * 4.05, 0.8 + i * 0.32, Math.cos(a) * 4.05, 1.6, 0.19, 0.7, M.stoneLight, a);
    if (i % 2 === 0) b.cylinder(Math.sin(a) * 4.77, 1.38 + i * 0.32, Math.cos(a) * 4.77, 0.045, 0.045, 1, M.brass, 5);
    const rail = [Math.sin(a) * 4.77, 1.88 + i * 0.32, Math.cos(a) * 4.77];
    const stringer = [Math.sin(a) * 3.38, 0.63 + i * 0.32, Math.cos(a) * 3.38];
    if (previousRail) b.beam(previousRail, rail, 0.06, M.brass, 0.06, 7);
    if (previousStringer) b.beam(previousStringer, stringer, 0.16, M.stoneDark, 0.16, 6);
    previousRail = rail;previousStringer = stringer;
  }
  doorAt(b, 0, 3.42, 1.9, 3.2, 0.8);
  stairs(b, 0, 3.8, 3.2, 4, 0.2, 0.6);
  b.beam([-1.1, 10.7, 3.8], [2.1, 10.7, 3.8], 0.095, M.woodLight);
  b.beam([1.7, 9.7, 3.2], [1.7, 10.7, 3.8], 0.08, M.wood);
  owl(b, 1.25, 10.76, 3.85, 0.9);
  owl(b, -1.25, 13.05, 4.1, 0.78, -0.2);
  owl(b, 3.7, 13.05, 1.8, 0.72, 0.9);
  owl(b, -2.5, 0.86, 4.5, 0.9, -0.3);
  banner(b, 0, 9.8, 3.55, 1.05, 2.8, M.burgundy);
  lantern(b, 1.5, 3.2, 3.8, 1);
  // Postal desk with sealed parchment and a red-bronze mailbox.
  b.box(-3.4, 0.85, 4.2, 1.9, 0.18, 1.2, M.woodLight);
  b.box(-3.4, 0.44, 4.2, 0.6, 0.8, 0.65, M.wood);
  b.box(-3.4, 0.98, 4.2, 0.95, 0.06, 0.6, M.paper, -0.15);
  b.sphere(-3.4, 1.03, 4.2, 0.1, M.burgundy, [1, 0.12, 1]);
  ivy(b, -2.2, 0.9, 2.7, 0.8, 6.3, -0.5);
  return b.finish();
}

function crystal(b, x, y, z, radius, height, mat = M.purple, lean = 0) {
  const geometry = new THREE.CylinderGeometry(radius * 0.75, radius, height * 0.67, 5);
  b.add(geometry, mat, [x, y + height * 0.34, z], [1, 1, 1], [0, 0, lean]);
  geometry.dispose();
  const tip = new THREE.ConeGeometry(radius * 0.75, height * 0.4, 5);
  b.add(tip, mat, [x - Math.sin(lean) * height * 0.53, y + height * 0.78, z], [1, 1, 1], [0, 0, lean]);
  tip.dispose();
}

export function createRuins() {
  const b = new Builder('whispering-ruins');
  b.cylinder(0, 0.2, 0, 8.5, 8.9, 0.4, M.slate, 12);
  b.cylinder(0, 0.49, 0, 6.8, 7.4, 0.24, M.stoneDark, 12);
  b.ring(0, 0.65, 0, 5.8, 0.045, M.brass);
  b.ring(0, 0.65, 0, 4.7, 0.035, M.purple);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    b.add(icoGeometry, M.brass, [Math.sin(a) * 5.35, 0.7, Math.cos(a) * 5.35], [0.1, 0.025, 0.36], [0, a, 0]);
  }
  // Surviving cloister wall: real open arches, exposed masonry and missing coping.
  wallPanel(b, 0, 0.65, -4.35, 12.6, 5.5, [-4.1, 0, 4.1].map(x => ({x,y:0.3,w:2.7,h:4.4})), 0, 0.75);
  for (const x of [-4.1, 0, 4.1]) {
    b.add(archFrame(2.7, 4.4, 0.16, 0.24), M.stoneLight, [x, 0.95, -4.2]);
  }
  for (const x of [-6.14, -2.05, 2.05, 6.14]) quoinStrip(b, x, 0.8, -4.15, 5.1, 0, 0.36);
  for (let i = 0; i < 13; i++) {
    if (i === 3 || i === 8 || i === 9) continue;
    b.add(beveledBlock(0.79, 0.32 + (i % 3) * 0.13, 0.86, 0.04), i % 2 ? M.stoneDark : M.stoneLight,
      [-5.8 + i * 0.96, 6.2 + (i % 3) * 0.065, -4.7], [1,1,1], [0, i * 0.035, (i % 2 - 0.5) * 0.08]);
  }
  for (let i = 0; i < 20; i++) {
    const a = i * 2.399, r = 2.7 + (i % 5) * 0.61;
    b.add(beveledBlock(0.85 + i % 3 * 0.12, 0.08, 1.04, 0.025), M.stoneDark,
      [Math.sin(a) * r, 0.665 + (i % 3) * 0.022, Math.cos(a) * r], [1,1,1], [0, a, 0]);
  }
  // The arch is built from individual carved voussoirs, including real gaps.
  for (const side of [-1, 1]) {
    b.box(side * 3.3, 0.95, -1.2, 1.85, 0.7, 2.1, M.stoneLight);
    b.box(side * 3.3, 3.1, -1.2, 1.3, 3.9, 1.4, M.stone);
    for (const y of [1.8, 3.2, 4.5]) b.box(side * 3.3, y, -1.2, 1.38, 0.12, 1.48, M.stoneDark);
    b.box(side * 3.3, 5.16, -1.2, 1.75, 0.35, 1.8, M.stoneLight);
    for (let i = 0; i < 9; i++) {
      const edgePoint = (t, offset) => {
        const length = Math.hypot(4.9, 6.6 * t);
        return [side * 3.3 * (1 - t * t) + side * 4.9 / length * offset, 5.4 + 4.9 * t + 6.6 * t / length * offset];
      };
      const t0 = i / 9 * 0.94 + 0.002, t1 = (i + 1) / 9 * 0.94 - 0.002;
      const points = [edgePoint(t0,.56),edgePoint(t1,.56),edgePoint(t1,-.56),edgePoint(t0,-.56)];
      const shape = new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();
      const block = new THREE.ExtrudeGeometry(shape,{depth:1.3,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,curveSegments:1});
      b.add(block,i % 3 ? M.stone : M.stoneLight,[0,0,-1.85]);block.dispose();
    }
  }
  b.box(0, 10.03, -1.18, 0.94, 1.16, 1.42, M.stoneLight);
  // A suspended seed of knowledge inside the empty gothic doorway.
  b.ring(0, 4.95, -0.98, 2.47, 0.065, M.brass, [0, 0, 0]);
  b.ring(0, 4.95, -0.94, 2.13, 0.045, M.purple, [0, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    b.add(icoGeometry, M.purple, [Math.sin(a) * 2.48, 4.95 + Math.cos(a) * 2.48, -0.94], [0.13, 0.23, 0.08], [0, 0, -a]);
  }
  crystal(b, 0, 3.1, -1, 0.7, 3, M.glassBlue);
  for (const [x, z, h] of [[-6, -3.6, 6.3], [6, -3.8, 4.1], [-6.1, 3.5, 2.7], [6.5, 3.4, 1.8]]) {
    b.cylinder(x, 0.8, z, 1, 1.25, 0.5, M.stoneLight, 8);
    b.cylinder(x, h / 2 + 0.9, z, 0.69, 0.82, h, M.stone, 8);
    b.cylinder(x, h + 0.9, z, 0.92, 0.78, 0.32, M.stoneLight, 8);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39;
    const r = 6.1 + i % 3 * 0.4;
    b.add(boxGeometry, i % 2 ? M.stone : M.stoneDark, [Math.sin(a) * r, 0.9, Math.cos(a) * r], [0.6 + i % 3 * 0.23, 0.5, 1], [0.2, a, 0.15]);
  }
  crystal(b, -4.7, 0.65, 1.7, 0.34, 2.1, M.purple, -0.2);
  crystal(b, -5.35, 0.65, 1.9, 0.25, 1.3, M.glassBlue, 0.2);
  crystal(b, 4.8, 0.65, -0.4, 0.43, 2.6, M.purple, 0.13);
  ivy(b, -3.8, 1.2, -0.43, 0.65, 4.8);
  ivy(b, 6, 1.2, -3.1, 0.6, 3.2);
  return b.finish();
}

function bentConeGeometry() {
  const rings = [[0, 0, 0, 0.35], [0.01, 0.29, 0.01, 0.28], [0.06, 0.56, 0.01, 0.19], [0.17, 0.76, 0.02, 0.105], [0.4, 0.84, 0.05, 0.015]];
  const positions = [];
  const vertex = (ring, side) => [ring[0] + Math.sin(side / 10 * TAU) * ring[3], ring[1], ring[2] + Math.cos(side / 10 * TAU) * ring[3]];
  for (let r = 0; r < rings.length - 1; r++) {
    for (let side = 0; side < 10; side++) {
      const a = vertex(rings[r], side);
      const b = vertex(rings[r], side + 1);
      const c = vertex(rings[r + 1], side);
      const d = vertex(rings[r + 1], side + 1);
      positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createWizard() {
  const b = new Builder('broom-rider');
  // Broom and tail: the bristles splay in a swept, slightly irregular bundle.
  b.beam([0, -0.38, -1.43], [0, -0.46, 1.33], 0.055, M.woodLight, 0.07, 8);
  b.beam([0, -0.38, -1.43], [0, -0.24, -1.62], 0.055, M.woodLight, 0.04, 8);
  for (let i = 0; i < 19; i++) {
    const a = i / 19 * TAU;
    const r = 0.22 + (i % 3) * 0.065;
    b.beam([Math.sin(a) * 0.06, -0.45 + Math.cos(a) * 0.07, 0.8], [Math.sin(a) * r, -0.45 + Math.cos(a) * r * 0.65, 1.62 + i % 4 * 0.07], 0.035, i % 3 ? M.straw : M.woodLight, 0.012, 5);
  }
  b.beam([0, -0.45, 0.93], [0, -0.45, 1.05], 0.14, M.brass, 0.14, 8);
  // Robe, shoulders, bent knees and boots; the rider leans into flight.
  b.cylinder(0, 0.34, -0.02, 0.24, 0.42, 0.95, M.burgundy, 10);
  b.sphere(0, 0.7, -0.09, 0.3, M.burgundy, [1.25, 0.55, 1]);
  b.box(0, 0.09, -0.35, 0.48, 0.09, 0.1, M.brass);
  for (const side of [-1, 1]) {
    b.beam([side * 0.22, -0.06, 0.09], [side * 0.35, -0.44, -0.31], 0.15, M.burgundy, 0.12, 8);
    b.beam([side * 0.35, -0.44, -0.31], [side * 0.38, -0.89, -0.12], 0.105, M.hair, 0.09, 8);
    b.sphere(side * 0.38, -0.91, -0.24, 0.13, M.wood, [0.8, 0.8, 1.7]);
  }
  b.cylinder(0, 0.88, -0.12, 0.1, 0.11, 0.2, M.skin, 8);
  b.sphere(0, 1.12, -0.14, 0.275, M.skin, [0.94, 1.06, 0.96]);
  b.sphere(0, 1.19, -0.035, 0.28, M.hair, [1, 0.93, 0.72]);
  b.sphere(0, 1.1, -0.408, 0.062, M.skin, [0.65, 0.8, 1]);
  for (const side of [-1, 1]) {
    b.sphere(side * 0.093, 1.17, -0.388, 0.018, M.hair);
    b.ring(side * 0.106, 1.165, -0.397, 0.07, 0.012, M.brass, [0, 0, 0]);
  }
  b.box(0, 1.17, -0.405, 0.08, 0.015, 0.016, M.brass);
  b.cylinder(0, 1.37, -0.085, 0.51, 0.48, 0.075, M.cloth, 12);
  b.add(cached('bent-wizard-hat', bentConeGeometry), M.cloth, [0, 1.37, -0.085]);
  b.cylinder(0, 1.46, -0.08, 0.326, 0.35, 0.13, M.brass, 10);
  b.add(icoGeometry, M.gold, [0.17, 1.48, -0.38], [0.055, 0.09, 0.025]);
  // One hand holds the broom; the wand points in the direction of flight.
  b.beam([-0.25, 0.67, -0.13], [-0.36, 0.27, -0.41], 0.13, M.burgundy, 0.1, 8);
  b.beam([-0.36, 0.27, -0.41], [-0.11, -0.2, -0.77], 0.1, M.burgundy, 0.07, 8);
  b.sphere(-0.1, -0.22, -0.79, 0.09, M.skin);
  b.beam([0.25, 0.67, -0.13], [0.48, 0.44, -0.4], 0.13, M.burgundy, 0.1, 8);
  b.beam([0.48, 0.44, -0.4], [0.42, 0.48, -0.88], 0.095, M.burgundy, 0.066, 8);
  b.sphere(0.42, 0.48, -0.93, 0.087, M.skin);
  b.beam([0.42, 0.47, -0.91], [0.4, 0.51, -1.64], 0.028, M.woodLight, 0.014, 6);
  b.sphere(0.4, 0.51, -1.65, 0.035, M.glassBlue);
  const group = b.finish();

  // Separately animatable cloth. Rest rotations are stored on each piece.
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.27, 0);
  capeShape.lineTo(0.27, 0);
  capeShape.lineTo(0.52, -1.17);
  capeShape.lineTo(0.2, -1.07);
  capeShape.lineTo(-0.04, -1.26);
  capeShape.lineTo(-0.48, -1.13);
  capeShape.closePath();
  const capeMaterial = material('cape', '#1e4c56', { side: THREE.DoubleSide });
  const cape = new THREE.Mesh(new THREE.ShapeGeometry(capeShape), capeMaterial);
  cape.name = 'rider-cape';
  cape.position.set(0, 0.75, 0.14);
  cape.rotation.x = -0.8;
  cape.castShadow = true;
  cape.userData.restRotationX = cape.rotation.x;
  group.add(cape);

  const scarf = new THREE.Group();
  scarf.name = 'rider-scarf';
  scarf.position.set(0.15, 0.89, 0.03);
  const scarfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.93), M.gold);
  scarfMesh.position.z = 0.42;
  scarfMesh.rotation.x = -0.15;
  scarfMesh.castShadow = true;
  scarf.add(scarfMesh);
  group.add(scarf);

  const wandTip = new THREE.Object3D();
  wandTip.name = 'wand-tip';
  wandTip.position.set(0.4, 0.51, -1.65);
  group.add(wandTip);
  const broomTail = new THREE.Object3D();
  broomTail.position.set(0, -0.45, 1.82);
  group.add(broomTail);
  group.userData.cape = cape;
  group.userData.scarf = scarf;
  group.userData.wandTip = wandTip;
  group.userData.broomTail = broomTail;
  return group;
}

export function createWisp() {
  const b = new Builder('ink-wisp');
  b.add(icoGeometry, M.spirit, [0, 0, 0], [0.53, 0.61, 0.48], [0.1, 0.2, 0]);
  b.add(icoGeometry, M.spirit, [0, -0.53, 0.07], [0.24, 0.4, 0.22], [0, 0, -0.2]);
  b.add(icoGeometry, M.purple, [0.07, -0.85, 0.13], [0.075, 0.18, 0.07], [0, 0, -0.4]);
  for (const side of [-1, 1]) {
    b.add(icoGeometry, M.spirit, [side * 0.43, 0.44, 0], [0.13, 0.35, 0.15], [0, 0, side * -0.4]);
    b.add(sphereGeometry, M.eyes, [side * 0.17, 0.1, -0.434], [0.09, 0.125, 0.035], [0, 0, side * 0.25]);
    b.add(icoGeometry, M.spirit, [side * 0.55, -0.2, 0.04], [0.17, 0.33, 0.15], [0, 0, side * 0.48]);
  }
  b.add(icoGeometry, M.recess, [0, -0.17, -0.43], [0.065, 0.045, 0.018]);
  return b.finish();
}
