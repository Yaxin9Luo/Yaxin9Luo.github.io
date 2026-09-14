import * as THREE from 'three';
import {ZODIAC,seatedBody,copperHead} from './haiyantang-sculpture.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Editable proportional study, NOT surveyed dimensions or an accepted reconstruction.
// +Y is up. The west/front elevation faces +Z; north is -X, east is -Z.
const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function namedGroup(parent, name, data = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.userData = data;
  parent.add(group);
  return group;
}

function meshFromTriangles(triangles) {
  const positions = [], uv = [];
  for (const [a, b, c] of triangles) {
    if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).lengthSq() < 1e-14) continue;
    for (const point of [a, b, c]) { positions.push(point.x, point.y, point.z); uv.push(point.x * .3, point.y * .3 + point.z * .3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function surfaceGeometry(sample, columns, rows) {
  const triangles = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = sample(column / columns, row / rows), b = sample((column + 1) / columns, row / rows);
    const c = sample((column + 1) / columns, (row + 1) / rows), d = sample(column / columns, (row + 1) / rows);
    triangles.push([a, b, c], [a, c, d]);
  }
  return meshFromTriangles(triangles);
}

function extrudedPolygon(points, bottom, top, holes = []) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1, curveSegments: 20 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}

function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.48);
  shape.bezierCurveTo(-.12, -.23, -.32, -.12, -.16, .19);
  shape.bezierCurveTo(-.12, .33, -.035, .40, 0, .52);
  shape.bezierCurveTo(.035, .40, .12, .33, .16, .19);
  shape.bezierCurveTo(.32, -.12, .12, -.23, 0, -.48);
  return new THREE.ExtrudeGeometry(shape, { depth: .075, bevelEnabled: true, bevelThickness: .024, bevelSize: .025, bevelSegments: 2, steps: 1, curveSegments: 6 });
}

function barrelTileGeometry() {
  const shell = surfaceGeometry((u, v) => {
    const angle = u * Math.PI;
    return V(Math.cos(angle) * .112, Math.sin(angle) * .112, v - .5);
  }, 10, 1);
  // The rolled edge is geometry; overlap between rows remains visible from below.
  const lip = new THREE.TorusGeometry(.112, .014, 5, 12, Math.PI);
  lip.translate(0, 0, .43);
  const converted = lip.toNonIndexed();
  const geometry = mergeGeometries([shell, converted]);
  shell.dispose(); lip.dispose(); converted.dispose();
  return geometry;
}

function microTexture(kind, normal = false) {
  const side = 96, data = new Uint8Array(side * side * 4);
  let seed = 0x72591;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    seed = Math.imul(seed ^ seed >>> 15, 1 | seed);
    seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed);
    const grain = ((seed ^ seed >>> 14) >>> 0) / 4294967296 - .5;
    const waveX = Math.cos(TAU * x / 24 + Math.sin(TAU * y / 48));
    const waveY = Math.cos(TAU * y / 32 + Math.sin(TAU * x / 48));
    const index = (y * side + x) * 4;
    if (normal) {
      data[index] = 128 + (kind === 'water' ? waveX * 9 : grain * 8);
      data[index + 1] = 128 + (kind === 'water' ? waveY * 9 : grain * 7);
      data[index + 2] = 255;
    } else {
      const value = (kind === 'copper' ? 142 : kind === 'tile' ? 167 : 222) + grain * (kind === 'copper' ? 23 : 10);
      data[index] = data[index + 1] = data[index + 2] = value;
    }
    data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, side, side);
  texture.name = `haiyantang-${kind}-${normal ? 'micro-normal' : 'micro-roughness'}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(kind === 'water' ? 3 : 5, kind === 'water' ? 3 : 5);
  texture.needsUpdate = true;
  return texture;
}

// All prototypes, transformed staging geometries, textures and materials belong to one
// invocation. Material batches preserve named architectural groups, not the island cache.
class StudyBuilder {
  constructor() {
    this.prototypes = new Map();
    this.pending = new Map();
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.temporaryGeometryDisposals = 0;
    this.disposed = false;
    this.m = this.createMaterials();
  }

  texture(kind, normal) {
    const texture = microTexture(kind, normal);
    this.textures.add(texture);
    return texture;
  }

  createMaterials() {
    const stoneNormal = this.texture('stone', true), stoneRough = this.texture('stone', false);
    const copperNormal = this.texture('copper', true), copperRough = this.texture('copper', false);
    const tileNormal = this.texture('tile', true), tileRough = this.texture('tile', false);
    const material = (name, category, options, physical = false) => {
      const result = physical ? new THREE.MeshPhysicalMaterial(options) : new THREE.MeshStandardMaterial(options);
      result.name = `haiyantang-${name}`;
      result.userData = { category, parametersEvidence: 'art-direction-not-historic-material-measurement' };
      this.materials.add(result);
      return result;
    };
    const stone = { color: 0xe5dfd1, roughness: .84, normalMap: stoneNormal, normalScale: new THREE.Vector2(.18, .18), roughnessMap: stoneRough };
    return {
      stone: material('fine-white-stone', 'stone', stone),
      relief: material('carved-stone-highlights', 'stone', { ...stone, color: 0xede7db, roughness: .76 }),
      wetStone: material('wet-basin-stone', 'stone', { ...stone, color: 0xb8b8a8, roughness: .51 }),
      paving: material('limestone-paving', 'stone', { ...stone, color: 0xccc7b7, roughness: .92 }),
      plaster: material('warm-plaster', 'plaster', { color: 0xdacfb9, roughness: .98, normalMap: stoneNormal, normalScale: new THREE.Vector2(.12, .12) }),
      tile: material('muted-green-glaze', 'glazed-tile', { color: 0x496c5c, roughness: .33, roughnessMap: tileRough, normalMap: tileNormal, normalScale: new THREE.Vector2(.1, .1), clearcoat: .45, clearcoatRoughness: .2 }, true),
      tileEdge: material('glaze-ridge-and-eaves', 'glazed-tile', { color: 0x82917a, roughness: .39, normalMap: tileNormal, normalScale: new THREE.Vector2(.1, .1), clearcoat: .3 }, true),
      copper: material('copper-heads', 'copper', { color: 0x796047, metalness: .83, roughness: .41, roughnessMap: copperRough, normalMap: copperNormal, normalScale: new THREE.Vector2(.21, .21) }),
      copperDark: material('copper-recess-and-patina', 'copper', { color: 0x354437, metalness: .68, roughness: .56, roughnessMap: copperRough, normalMap: copperNormal, normalScale: new THREE.Vector2(.16, .16) }),
      window: material('dark-glazed-window', 'glass', { color: 0x273d38, metalness: .22, roughness: .2, clearcoat: .8, clearcoatRoughness: .15 }, true),
      lattice: material('aged-window-lattice', 'timber', { color: 0x514f3c, roughness: .6, metalness: .1 }),
      water: material('fountain-water', 'water', { color: 0xabbdb1, roughness: .12, metalness: 0, transmission: .35, thickness: .5, ior: 1.333, attenuationColor: 0x708e7f, attenuationDistance: 5, transparent: true, opacity: .84, depthWrite: false, normalMap: this.texture('water', true), normalScale: new THREE.Vector2(.14, .14), clearcoat: .6 }, true),
      tin: material('reservoir-lining-provisional', 'metal', { color: 0x7b8580, metalness: .68, roughness: .55 }),
    };
  }

  prototype(key, make) {
    if (!this.prototypes.has(key)) this.prototypes.set(key, make());
    return this.prototypes.get(key);
  }

  add(parent, source, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], ownedSource = false) {
    let geometry = source.clone();
    if (geometry.index) {
      const indexed = geometry;
      geometry = geometry.toNonIndexed();
      indexed.dispose(); this.temporaryGeometryDisposals++;
    }
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    geometry.applyMatrix4(new THREE.Matrix4().compose(V(...position), quaternion, V(...scale)));
    const key = `${parent.uuid}:${material.id}`;
    if (!this.pending.has(key)) this.pending.set(key, { parent, material, parts: [] });
    this.pending.get(key).parts.push(geometry);
    if (ownedSource) { source.dispose(); this.temporaryGeometryDisposals++; }
  }

  box(parent, material, x, y, z, w, h, d, bevel = 0, rotation = [0, 0, 0]) {
    if (bevel) {
      const key = `bevel:${w}:${h}:${d}:${bevel}`;
      this.add(parent, this.prototype(key, () => new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 4, h / 4, d / 4))), material, [x, y, z], [1, 1, 1], rotation);
    } else this.add(parent, this.prototype('box', () => new THREE.BoxGeometry(1, 1, 1)), material, [x, y, z], [w, h, d], rotation);
  }

  ellipsoid(parent, material, position, scale, rotation = [0, 0, 0]) {
    this.add(parent, this.prototype('sphere', () => new THREE.SphereGeometry(1, 18, 12)), material, position, scale, rotation);
  }

  leaf(parent, position, scale, rotation = [0, 0, 0], material = this.m.relief) {
    this.add(parent, this.prototype('acanthus-leaf', leafGeometry), material, position, scale, rotation);
  }

  tube(parent, points, radius, material = this.m.relief, segments = 20) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => point.isVector3 ? point : V(...point)));
    this.add(parent, new THREE.TubeGeometry(curve, segments, radius, 7, false), material, undefined, undefined, undefined, true);
  }

  lathe(parent, profile, position, material = this.m.stone, scale = [1, 1, 1], segments = 24) {
    const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(.003, r), y)), segments);
    this.add(parent, geometry, material, position, scale, undefined, true);
  }

  ring(parent, position, radius, tube, material = this.m.relief, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    this.add(parent, new THREE.TorusGeometry(radius, tube, 6, 24), material, position, scale, rotation, true);
  }

  polygon(parent, points, bottom, top, material = this.m.stone, holes = []) {
    this.add(parent, extrudedPolygon(points, bottom, top, holes), material, undefined, undefined, undefined, true);
  }

  flush() {
    for (const { parent, material, parts } of this.pending.values()) {
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error(`Unable to merge Haiyantang subassembly ${parent.name}`);
      geometry.name = `${parent.name}-${material.name}`;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${parent.name}/${material.name}`;
      mesh.castShadow = material.userData.category !== 'water' && material.userData.category !== 'glass';
      mesh.receiveShadow = true;
      if (material.userData.category === 'water') mesh.renderOrder = 1;
      parent.add(mesh);
      for (const part of parts) { part.dispose(); this.temporaryGeometryDisposals++; }
    }
    this.pending.clear();
    for (const geometry of this.prototypes.values()) { geometry.dispose(); this.temporaryGeometryDisposals++; }
    this.prototypes.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { parts } of this.pending.values()) for (const geometry of parts) geometry.dispose();
    for (const set of [this.geometries, this.materials, this.textures]) { for (const resource of set) resource.dispose(); set.clear(); }
    for (const geometry of this.prototypes.values()) geometry.dispose();
    this.prototypes.clear(); this.pending.clear();
  }
}

function rosette(b, parent, x, y, z, radius = .25, petals = 8, material = b.m.relief) {
  for (let i = 0; i < petals; i++) {
    const angle = TAU * i / petals;
    b.leaf(parent, [x + Math.sin(angle) * radius * .47, y + Math.cos(angle) * radius * .47, z], [radius * .7, radius * 1.25, radius * .55], [0, 0, -angle], material);
  }
  b.ellipsoid(parent, material, [x, y, z + .04], [radius * .21, radius * .21, radius * .16]);
}

function volute(b, parent, x, y, z, width, height, mirror = 1, material = b.m.relief) {
  const points = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, angle = t * Math.PI * 1.9;
    const radius = 1 - .84 * t;
    points.push([x + mirror * width * Math.sin(angle) * radius, y + height * (Math.cos(angle) * radius - 1), z + .045 * Math.sin(t * Math.PI)]);
  }
  b.tube(parent, points, Math.min(width, height) * .115, material, 30);
  b.leaf(parent, [x + mirror * width * .35, y - height * .52, z + .045], [width * .65, height * 1.3, .75], [0, 0, -mirror * .5], material);
}

function cartouche(b, parent, x, y, z, w, h, ornate = true) {
  const path = [[-.38, -.5], [-.5, -.34], [-.43, -.12], [-.50, .22], [-.30, .38], [0, .5], [.30, .38], [.50, .22], [.43, -.12], [.5, -.34], [.38, -.5], [0, -.44], [-.38, -.5]];
  b.tube(parent, path.map(([px, py]) => [x + px * w, y + py * h, z]), Math.min(w, h) * .032, b.m.relief, 50);
  if (!ornate) return;
  for (const side of [-1, 1]) volute(b, parent, x + side * w * .32, y + h * .30, z + .03, w * .18, h * .23, side);
  rosette(b, parent, x, y + h * .16, z + .04, Math.min(w, h) * .15);
  b.leaf(parent, [x, y - h * .20, z + .03], [w * .3, h * .37, .7]);
}

function baluster(b, parent, x, y, z, height = .93) {
  b.box(parent, b.m.stone, x, y + .045, z, .25, .09, .25, .022);
  b.lathe(parent, [[.085, .08], [.085, .16], [.055, .24], [.10, .34], [.12, .43], [.12, .50], [.07, .65], [.055, .74], [.09, .82]], [x, y, z], b.m.relief, [1, height / .93, 1], 16);
  b.box(parent, b.m.relief, x, y + height - .055, z, .27, .11, .27, .02);
}

function finial(b, parent, x, y, z, size = 1) {
  b.lathe(parent, [[.22, 0], [.25, .08], [.15, .16], [.12, .25], [.22, .35], [.19, .54], [.09, .65], [.055, .79]], [x, y, z], b.m.relief, [size, size, size], 20);
  for (let i = 0; i < 6; i++) b.leaf(parent, [x + Math.sin(i * TAU / 6) * .11 * size, y + .63 * size, z + Math.cos(i * TAU / 6) * .11 * size], [.37 * size, .50 * size, .5 * size], [0, i * TAU / 6, 0]);
}

function column(b, parent, x, bottom, z, height, radius = .22, fullCapital = false) {
  b.box(parent, b.m.stone, x, bottom + .11, z, radius * 3, .22, radius * 3, .035);
  const shaft = surfaceGeometry((u, v) => {
    const angle = u * TAU;
    const r = radius * (1 - .14 * v) * (1 + .048 * Math.cos(angle * 16));
    return V(Math.sin(angle) * r, v * (height - .65) + .34, Math.cos(angle) * r);
  }, 64, 10);
  b.add(parent, shaft, b.m.stone, [x, bottom, z], undefined, undefined, true);
  for (const y of [.22, .33, height - .36, height - .23]) b.lathe(parent, [[radius * 1.32, 0], [radius * 1.36, .06], [radius * 1.2, .12]], [x, bottom + y, z]);
  if (!fullCapital) for (const part of [.26, .53, .78]) b.lathe(parent, [[radius * 1.06, 0], [radius * 1.27, .06], [radius * 1.27, .15], [radius * 1.08, .20]], [x, bottom + height * part, z]);
  for (let i = 0; i < (fullCapital ? 10 : 6); i++) {
    const angle = i * TAU / (fullCapital ? 10 : 6);
    b.leaf(parent, [x + Math.sin(angle) * radius, bottom + height - .31, z + Math.cos(angle) * radius], [radius * 1.65, .58, .75], [0, angle, 0]);
  }
  if (fullCapital) for (const side of [-1, 1]) volute(b, parent, x + side * radius * 1.2, bottom + height - .03, z + radius * .55, radius * .65, radius * .60, side);
  b.box(parent, b.m.relief, x, bottom + height + .025, z, radius * 3.05, .16, radius * 3.05, .035);
}

function opening(b, parent, x, bottom, z, width, height, style = 'arch', lower = false) {
  // Actual wall opening: glass sits behind deep jambs, not in front of a solid wall.
  const reveal = .47, front = z + .13;
  b.box(parent, b.m.window, x, bottom + height / 2, z - reveal, width - .10, height - .10, .045);
  for (const side of [-1, 1]) {
    b.box(parent, b.m.stone, x + side * (width / 2 + .1), bottom + height / 2, z - .05, .20, height + .24, .72, .025);
    b.box(parent, b.m.relief, x + side * (width / 2 + .20), bottom + height / 2, front + .03, .09, height + .43, .16, .02);
  }
  for (const y of [bottom - .10, bottom + height + .10]) {
    b.box(parent, b.m.stone, x, y, z + .07, width + .43, .20, .70, .025);
    b.box(parent, b.m.relief, x, y - .04, front + .09, width + .64, .09, .19, .018);
  }
  const glassZ = z - reveal + .06;
  for (let i = 1; i < 6; i++) b.box(parent, b.m.lattice, x - width / 2 + width * i / 6, bottom + height / 2, glassZ, .038, height, .052);
  for (let i = 1; i < (lower ? 8 : 13); i++) b.box(parent, b.m.lattice, x, bottom + height * i / (lower ? 8 : 13), glassZ + .012, width, .035, .049);
  if (style === 'plain') return;
  if (style === 'triangle') {
    const crest = bottom + height + .25;
    b.tube(parent, [[x - width * .70, crest, front + .11], [x, crest + .47, front + .11], [x + width * .70, crest, front + .11]], .074, b.m.relief, 12);
    b.tube(parent, [[x - width * .60, crest, front + .1], [x, crest + .35, front + .1], [x + width * .60, crest, front + .1]], .027, b.m.relief, 12);
    rosette(b, parent, x, crest + .11, front + .17, .15, 6);
  } else {
    const crest = bottom + height + .14, points = [];
    for (let i = 0; i <= 28; i++) {
      const angle = Math.PI - Math.PI * i / 28;
      points.push([x + Math.cos(angle) * (width * .62), crest + Math.sin(angle) * .66, front + .1]);
    }
    b.tube(parent, points, .078, b.m.relief, 28);
    for (let i = 0; i < 7; i++) {
      const angle = (i - 3) * .22;
      b.leaf(parent, [x + Math.sin(angle) * .38, crest + .22 + Math.cos(angle) * .06, front + .08], [.25, .62, .6], [0, 0, -angle]);
    }
    rosette(b, parent, x, crest + .63, front + .15, .15, 6);
  }
}

function facade(b, parent, width, count, z, bottom, height, upper, reverse = false) {
  const group = namedGroup(parent, `${upper ? 'upper' : 'lower'}-${reverse ? 'east' : 'west'}-elevation`);
  group.rotation.y = reverse ? Math.PI : 0;
  const bay = width / count, wallDepth = .65, sill = upper ? .56 : .45;
  const winHeight = upper ? 4.0 : 2.62, winWidth = upper ? 1.67 : 1.36;
  const principalDoor = upper && !reverse;
  if (principalDoor) {
    for (const side of [-1, 1]) b.box(group, b.m.plaster, side * (width + 1.93) / 4, bottom + sill / 2, z, (width - 1.93) / 2, sill, wallDepth);
    b.box(group, b.m.plaster, 0, bottom + .035, z, 1.93, .07, wallDepth);
  } else b.box(group, b.m.plaster, 0, bottom + sill / 2, z, width, sill, wallDepth);
  const head = bottom + sill + winHeight;
  b.box(group, b.m.plaster, 0, (head + bottom + height) / 2, z, width, bottom + height - head, wallDepth);
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * bay;
    const doorBay = principalDoor && i === Math.floor(count / 2);
    const apertureWidth = doorBay ? 1.93 : winWidth, apertureSill = doorBay ? .07 : sill, apertureHeight = doorBay ? 4.49 : winHeight;
    for (const side of [-1, 1]) b.box(group, b.m.plaster, x + side * (apertureWidth + bay) / 4, bottom + apertureSill + apertureHeight / 2, z, (bay - apertureWidth) / 2, apertureHeight, wallDepth);
    if (doorBay) {
      opening(b, group, x, bottom + .07, z + wallDepth / 2, 1.93, 4.49, 'plain');
      b.box(group, b.m.lattice, x, bottom + 2.32, z + .015, 1.69, 4.35, .11, .025);
      for (const side of [-1, 1]) for (const offset of [1.24, 3.26]) cartouche(b, group, x + side * .42, bottom + offset, z + .092, .60, 1.48);
      b.box(group, b.m.relief, x, bottom + .07, z + .41, 2.30, .16, .98, .025);
    } else opening(b, group, x, bottom + sill, z + wallDepth / 2, winWidth, winHeight, upper ? (Math.abs(i - 5) >= 4 ? 'triangle' : 'arch') : 'triangle', !upper);
    if (upper && i !== Math.floor(count / 2)) cartouche(b, group, x, bottom + .23, z + .43, .62, .32, false);
  }
  for (let i = 0; i <= count; i++) {
    const x = -width / 2 + i * bay;
    if (upper) {
      column(b, group, x, bottom + .1, z + .46, height - .55, i === 5 || i === 6 ? .285 : .205, i === 5 || i === 6);
      if (i > 0 && i < count && i !== 5 && i !== 6) for (const offset of [1.25, 3.1]) rosette(b, group, x, bottom + offset, z + .73, .135, 6);
    } else {
      b.box(group, b.m.stone, x, bottom + height / 2, z + .26, .46, height, .27, .025);
      for (let j = 1; j < 7; j++) b.box(group, b.m.relief, x, bottom + height * j / 7, z + .42, .56, .07, .18, .012);
    }
  }
  for (const [dy, h, depth] of [[.02, .14, .85], [height - .17, .18, .97], [height + .02, .15, 1.15]]) b.box(group, b.m.stone, 0, bottom + dy, z + .13, width + .60, h, depth, .025);
  return group;
}

function roof(b, parent, name, cx, cz, width, depth, eave, rise, ridgeLength) {
  const group = namedGroup(parent, name, { construction: 'hipped glazed roof; layered individual barrel tiles; profile is provisional' });
  group.position.set(cx, 0, cz);
  const halfW = width / 2, halfD = depth / 2, halfR = ridgeLength / 2;
  const faces = [
    [[-halfW, halfD], [halfW, halfD], [-halfR, 0], [halfR, 0]],
    [[halfW, -halfD], [-halfW, -halfD], [halfR, 0], [-halfR, 0]],
    [[halfW, halfD], [halfW, -halfD], [halfR, 0], [halfR, 0]],
    [[-halfW, -halfD], [-halfW, halfD], [-halfR, 0], [-halfR, 0]],
  ];
  const tile = b.prototype('layered-barrel-tile', barrelTileGeometry);
  for (const [a, d, c, f] of faces) {
    const sample = (u, t) => {
      const lowerX = THREE.MathUtils.lerp(a[0], d[0], u), lowerZ = THREE.MathUtils.lerp(a[1], d[1], u);
      const upperX = THREE.MathUtils.lerp(c[0], f[0], u), upperZ = THREE.MathUtils.lerp(c[1], f[1], u);
      return V(THREE.MathUtils.lerp(lowerX, upperX, t), eave + rise * Math.pow(t, 1.28) + .18 * Math.pow(1 - t, 6) + .20 * Math.pow(Math.abs(u * 2 - 1), 6) * Math.pow(1 - t, 3), THREE.MathUtils.lerp(lowerZ, upperZ, t));
    };
    b.add(group, surfaceGeometry((u, t) => sample(u, t), 28, 18), b.m.tile, undefined, undefined, undefined, true);
    const rows = Math.ceil(sample(.5, 0).distanceTo(sample(.5, 1)) / .43);
    for (let row = 0; row < rows; row++) {
      const t = (row + .45) / rows;
      const rowWidth = sample(0, t).distanceTo(sample(1, t));
      const columns = Math.max(1, Math.floor(rowWidth / .223));
      for (let column = 0; column < columns; column++) {
        const u = (column + .5) / columns, middle = sample(u, t);
        const down = sample(u, Math.max(0, t - .45 / rows)), up = sample(u, Math.min(1, t + .45 / rows));
        const tangent = down.clone().sub(up).normalize();
        const lateral = sample(1, t).sub(sample(0, t)).normalize();
        const normal = tangent.clone().cross(lateral).normalize();
        if (normal.y < 0) { lateral.negate(); normal.negate(); }
        const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(lateral, normal, tangent));
        middle.addScaledVector(normal, .045);
        b.add(group, tile, b.m.tile, middle.toArray(), [Math.min(1.02, rowWidth / columns / .223), 1, down.distanceTo(up) * 1.25], orientation);
      }
    }
    b.tube(group, Array.from({ length: 35 }, (_, i) => sample(i / 34, 0).add(V(0, -.015, 0))), .12, b.m.tileEdge, 40);
  }
  for (const side of [-1, 1]) {
    b.box(group, b.m.stone, 0, eave - .10, side * (halfD - .19), width - .12, .21, .39, .03);
    for (let i = 0; i <= Math.floor(width / .63); i++) {
      const x = -halfW + .20 + i * (width - .40) / Math.floor(width / .63);
      b.box(group, b.m.relief, x, eave - .31, side * (halfD - .40), .16, .30, .44, .03);
      b.leaf(group, [x, eave - .25, side * (halfD - .14)], [.22, .36, .5], [0, side === 1 ? 0 : Math.PI, 0]);
    }
    b.box(group, b.m.stone, side * (halfW - .18), eave - .10, 0, .38, .21, depth - .12, .03);
  }
  for (const xSide of [-1, 1]) for (const zSide of [-1, 1]) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      points.push([xSide * THREE.MathUtils.lerp(halfW, halfR, t), eave + rise * Math.pow(t, 1.28) + .38 * Math.pow(1 - t, 3) + .1, zSide * halfD * (1 - t)]);
    }
    b.tube(group, points, .12, b.m.tileEdge, 28);
    volute(b, group, xSide * (halfW - .14), eave + .69, zSide * (halfD - .08), .30, .28, -xSide, b.m.tileEdge);
  }
  b.box(group, b.m.tileEdge, 0, eave + rise + .04, 0, Math.max(.18, ridgeLength), .23, .30, .055);
  for (const side of [-1, 1]) {
    const x = side * (halfR + .06);
    volute(b, group, x, eave + rise + .65, .02, .32, .45, side, b.m.tileEdge);
    b.leaf(group, [x, eave + rise + .47, .04], [.54, .82, .95], [0, 0, -side * .2], b.m.tileEdge);
  }
  return group;
}

function buildWestHall(b, root) {
  const outer = namedGroup(root, 'west-hall');
  const hall = namedGroup(outer, 'west-main-hall', { bayCount: 11, storeys: 2, workingDimensions: [37.4, 10.85, 12.2], metricEvidence: 'provisional-working-units' });
  const base = namedGroup(hall, 'hall-foundations-and-floors');
  for (const [y, h, w, d] of [[.20, .40, 39.1, 13.1], [.51, .22, 38.7, 12.9], [4.88, .29, 39.0, 13.1], [10.91, .28, 38.8, 12.8]]) b.box(base, b.m.stone, 0, y, 0, w, h, d, .035);
  facade(b, hall, 37.4, 11, 5.8, .62, 4.15, false);
  facade(b, hall, 37.4, 11, 5.8, 5.06, 5.70, true);
  facade(b, hall, 37.4, 11, 5.8, .62, 4.15, false, true);
  facade(b, hall, 37.4, 11, 5.8, 5.06, 5.70, true, true);
  for (const side of [-1, 1]) {
    const end = namedGroup(hall, side < 0 ? 'hall-north-return' : 'hall-south-return');
    end.position.x = side * 18.37;
    end.rotation.y = side * Math.PI / 2;
    facade(b, end, 11.6, 3, 0, .62, 4.15, false);
    facade(b, end, 11.6, 3, 0, 5.06, 5.70, true);
  }
  const terrace = namedGroup(hall, 'west-upper-terrace');
  for (const side of [-1, 1]) {
    b.box(terrace, b.m.stone, side * 11.55, 4.85, 7.04, 15.9, .33, 2.15, .04);
    for (let i = 0; i < 22; i++) {
      const x = side * (5.20 + i * .65);
      baluster(b, terrace, x, 5.02, 7.98);
    }
    b.box(terrace, b.m.relief, side * 11.92, 6.02, 7.98, 14.28, .18, .37, .04);
  }
  roof(b, hall, 'hall-continuous-central-roof', 0, 0, 26.9, 13.6, 11.07, 1.98, 24.0);
  roof(b, hall, 'hall-north-hipped-end-roof', -15.3, 0, 8.25, 13.7, 11.09, 2.58, 1.5);
  roof(b, hall, 'hall-south-hipped-end-roof', 15.3, 0, 8.25, 13.7, 11.09, 2.58, 1.5);
  const pediment = namedGroup(hall, 'central-ornamental-pediment');
  const z = 6.5;
  const outline = new THREE.Shape();
  outline.moveTo(-5.15, 10.94); outline.lineTo(-5.15, 12.54);
  outline.bezierCurveTo(-4.3, 12.5, -4.3, 13.38, -3.55, 13.39);
  outline.bezierCurveTo(-2.8, 13.40, -2.4, 12.9, -1.85, 13.39);
  outline.bezierCurveTo(-.92, 13.87, -.95, 14.8, 0, 14.95);
  outline.bezierCurveTo(.95, 14.8, .92, 13.87, 1.85, 13.39);
  outline.bezierCurveTo(2.4, 12.9, 2.8, 13.40, 3.55, 13.39);
  outline.bezierCurveTo(4.3, 13.38, 4.3, 12.5, 5.15, 12.54);
  outline.lineTo(5.15, 10.94); outline.closePath();
  b.add(pediment, new THREE.ExtrudeGeometry(outline, { depth: .48, bevelEnabled: true, bevelSize: .08, bevelThickness: .07, bevelSegments: 2, curveSegments: 18 }), b.m.stone, [0, 0, z - .28], undefined, undefined, true);
  b.tube(pediment, outline.getPoints(32).slice(1, -2).map(p => [p.x, p.y + .10, z + .30]), .1, b.m.relief, 100);
  b.box(pediment, b.m.stone, 0, 11.15, z, 11.10, .22, 1.05, .04);
  cartouche(b, pediment, 0, 12.83, z + .38, 2.55, 3.10);
  for (let i = -3; i <= 3; i++) b.leaf(pediment, [i * .19, 12.68 + Math.sqrt(Math.max(0, 1 - (i / 4) ** 2)) * .12, z + .43], [.46, 1.32, 1.30], [0, 0, -i * .17]);
  for (const side of [-1, 1]) {
    cartouche(b, pediment, side * 3.45, 12.12, z + .28, 1.49, 1.68, false);
    rosette(b, pediment, side * 2.03, 12.14, z + .33, .25, 6);
    volute(b, pediment, side * .80, 11.15, z + .61, .80, .66, side);
    finial(b, pediment, side * 5.08, 12.58, z + .02, .88);
    finial(b, pediment, side * 1.84, 13.45, z + .02, .62);
    column(b, pediment, side * 1.40, 5.0, z + .18, 5.58, .32, true);
  }
  finial(b, pediment, 0, 14.99, z, .68);
  return hall;
}

function railing(b, parent, start, end, y, spacing = .60) {
  const a = V(...start), c = V(...end), count = Math.max(1, Math.floor(a.distanceTo(c) / spacing));
  for (let i = 0; i <= count; i++) {
    const p = a.clone().lerp(c, i / count);
    baluster(b, parent, p.x, y, p.z);
  }
  b.tube(parent, [[a.x, y + 1.03, a.z], [c.x, y + 1.03, c.z]], .11, b.m.relief, 1);
  b.tube(parent, [[a.x, y + .06, a.z], [c.x, y + .06, c.z]], .14, b.m.stone, 1);
}

function piercedWall(b, parent, width, centers, windowWidth, windowBottom, windowHeight, height, z = -.15) {
  const windowTop = windowBottom + windowHeight;
  b.box(parent, b.m.plaster, 0, windowBottom / 2, z, width, windowBottom, .58);
  b.box(parent, b.m.plaster, 0, (windowTop + height) / 2, z, width, height - windowTop, .58);
  let edge = -width / 2;
  for (const center of [...centers, width / 2 + windowWidth / 2]) {
    const next = center - windowWidth / 2;
    if (next > edge) b.box(parent, b.m.plaster, (edge + next) / 2, windowBottom + windowHeight / 2, z, next - edge, windowHeight, .58);
    edge = center + windowWidth / 2;
  }
}

function waterworksElevation(b, parent, name, length, width, height, openEnds = false) {
  const wall = namedGroup(parent, name);
  // The solid upper register encloses the raised tank; the tall lower openings
  // and oculi follow the north/south plates. No invented exposed water wheels.
  for (const side of [-1, 1]) {
    const face = namedGroup(wall, side < 0 ? 'north-face' : 'south-face');
    face.position.x = side * width / 2;
    face.rotation.y = side * Math.PI / 2;
    const count = Math.max(2, Math.round(length / 2.7)), bay = length / count;
    piercedWall(b, face, length, Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * bay), 1.05, .7, 3.8, height);
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * bay;
      opening(b, face, x, .7, .25, 1.05, 3.8, i === Math.floor(count / 2) ? 'arch' : 'triangle');
      b.box(face, b.m.stone, x, 6.25, .21, bay - .42, 2.05, .18, .03);
      cartouche(b, face, x, 6.55, .34, bay - .66, 1.38, false);
      b.ellipsoid(face, b.m.window, [x, 5.38, .40], [.27, .15, .018]);
      b.ring(face, [x, 5.38, .44], .24, .061, b.m.relief, [1.40, .80, 1]);
      rosette(b, face, x, 5.86, .43, .12, 6);
    }
    for (let i = 0; i <= count; i++) {
      const x = -length / 2 + i * bay;
      b.box(face, b.m.stone, x, height / 2, .28, .27, height, .36, .025);
      b.box(face, b.m.relief, x, height - .18, .43, .47, .36, .58, .03);
      for (const y of [1.0, 4.3, 7.35]) b.leaf(face, [x, y, .48], [.20, .45, .60]);
    }
    for (const [y, depth] of [[.35, .60], [4.91, .35], [height, .85]]) b.box(face, b.m.stone, 0, y, .15, length + .46, .18, depth, .025);
    b.box(face, b.m.plaster, 0, height + .62, .02, length, 1.10, .42);
    for (let i = 0; i < count; i++) cartouche(b, face, (i - (count - 1) / 2) * bay, height + .62, .32, bay - .35, .79);
    b.box(face, b.m.relief, 0, height + 1.22, .12, length + .56, .17, .82, .03);
    for (let i = 0; i <= count; i++) finial(b, face, -length / 2 + i * bay, height + 1.31, .02, .53);
  }
  if (!openEnds) for (const side of [-1, 1]) b.box(wall, b.m.plaster, 0, height / 2, side * length / 2, width, height, .6);
  return wall;
}

function buildWaterworks(b, root) {
  const outer = namedGroup(root, 'waterworks');
  const works = namedGroup(outer, 'east-waterworks', { planForm: 'I', metricEvidence: 'provisional-working-units', interiorMechanism: 'not reconstructed' });
  const west = namedGroup(works, 'waterworks-west-crossbar');
  west.position.z = -15.7;
  const east = namedGroup(works, 'waterworks-east-crossbar');
  east.position.z = -41.0;
  const stem = namedGroup(works, 'waterworks-reservoir-connector');
  stem.position.z = -28.35;
  for (const part of [west, east]) {
    b.box(part, b.m.stone, 0, .29, 0, 21.0, .58, 6.4, .035);
    waterworksElevation(b, part, 'tank-end-facades', 5.80, 19.6, 8.16, true);
    const crossFaces = namedGroup(part, 'waterworks-crossbar-ends');
    for (const side of [-1, 1]) {
      const face = namedGroup(crossFaces, side === 1 ? 'west-crossbar-elevation' : 'east-crossbar-elevation');
      face.rotation.y = side === 1 ? 0 : Math.PI;
      face.position.z = side * 2.91;
      piercedWall(b, face, 19.60, [-7.95, -5.30, -2.65, 0, 2.65, 5.30, 7.95], 1.15, .7, 3.85, 8.16);
      for (let i = -3; i <= 3; i++) {
        opening(b, face, i * 2.65, .7, .15, 1.15, 3.85, i === 0 ? 'arch' : 'triangle');
        cartouche(b, face, i * 2.65, 6.42, .30, 1.84, 1.87);
      }
      for (let i = -3.5; i <= 3.5; i++) {
        b.box(face, b.m.stone, i * 2.65, 4.2, .25, .29, 7.65, .32, .02);
        finial(b, face, i * 2.65, 9.49, .1, .5);
      }
      b.box(face, b.m.stone, 0, 8.20, .15, 20.10, .20, .80, .025);
      b.box(face, b.m.plaster, 0, 8.83, 0, 19.60, 1.05, .54);
      for (let i = -3; i <= 3; i++) cartouche(b, face, i * 2.65, 8.84, .35, 2.30, .76);
      b.box(face, b.m.relief, 0, 9.44, .06, 20.30, .18, .88, .03);
    }
    const house = namedGroup(part, 'raised-water-wheel-house', { roofEvidence: 'north and south engravings', machinery: 'interior deliberately unasserted' });
    b.box(house, b.m.plaster, 0, 10.03, 0, 14.0, 3.30, 3.53);
    for (const side of [-1, 1]) {
      const face = namedGroup(house, `upper-end-room-${side}`);
      face.rotation.y = side === 1 ? 0 : Math.PI;
      face.position.z = side * 1.80;
      for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) cartouche(b, face, x, 10.13, .17, 1.95, 2.08);
      for (const x of [-6.8, -3.9, -1.3, 1.3, 3.9, 6.8]) b.box(face, b.m.stone, x, 10.15, .17, .23, 3.0, .26, .02);
    }
    roof(b, house, 'water-wheel-house-hipped-roof', 0, 0, 15.03, 4.65, 11.69, 1.39, 11.2);
  }
  b.box(stem, b.m.stone, 0, .27, 0, 13.65, .54, 19.7, .03);
  waterworksElevation(b, stem, 'long-reservoir-walls', 19.7, 12.7, 8.16);
  b.box(stem, b.m.tin, 0, 8.13, 0, 11.95, .18, 19.3, .02);
  // Contained raised reservoir: water lies below an opaque parapet, not an infinity pool.
  b.box(stem, b.m.water, 0, 8.22, 0, 11.60, .05, 18.85);
  const service = namedGroup(works, 'rear-service-stair-and-balustrade', { evidence: 'side plates; individual tread dimensions inferred' });
  for (let i = 0; i < 3; i++) b.box(service, b.m.stone, 0, (.17 + (i + 1) * .16) / 2, -45.2 + i * .42, 4.4, .17 + (i + 1) * .16, .45, .025);
  b.box(service, b.m.stone, 0, .33, -43.90, 4.4, .66, .75, .025);
  railing(b, service, [-2.2, 0, -44.23], [-2.2, 0, -43.55], .67);
  railing(b, service, [2.2, 0, -44.23], [2.2, 0, -43.55], .67);
  return works;
}

function stairStripGeometry(a, c, width, bottom, topA, topC) {
  const tangent = V(c.x - a.x, 0, c.z - a.z).normalize(), across = V(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
  const vertices = [a.clone().add(across), a.clone().sub(across), c.clone().sub(across), c.clone().add(across)];
  const low = vertices.map(p => V(p.x, bottom, p.z));
  const high = vertices.map((p, i) => V(p.x, i < 2 ? topA : topC, p.z));
  const triangles = [[high[0], high[3], high[2]], [high[0], high[2], high[1]], [low[0], low[1], low[2]], [low[0], low[2], low[3]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; triangles.push([low[i], high[i], high[j]], [low[i], high[j], low[j]]); }
  return meshFromTriangles(triangles);
}

function buildStairs(b, root) {
  const all = namedGroup(root, 'west-stairs');
  // Match the modeled paving (.133 top, .05 continuous base). These are study
  // grades, not archaeological levels. Embed the solid footing into that base.
  const approachTop = .133, footingBottom = .045, treadCap = .085;
  const entryBodyHeight = approachTop - treadCap;
  const stages = [
    { a: [18.7, entryBodyHeight, 22.0], c: [16.7, (entryBodyHeight + 2.04) / 2, 18.0], d: [13.1, 2.04, 15.9], steps: 13 },
    { a: [13.1, 2.04, 15.9], c: [12.3, 2.04, 15.45], d: [11.45, 2.04, 15.0], steps: 1, landing: true },
    { a: [11.45, 2.04, 15.0], c: [9.8, 2.82, 13.7], d: [7.4, 3.60, 11.85], steps: 10 },
    { a: [7.4, 3.60, 11.85], c: [6.6, 3.60, 11.31], d: [5.8, 3.60, 10.78], steps: 1, landing: true },
    { a: [5.8, 3.60, 10.78], c: [4.8, 4.32, 9.78], d: [3.75, 5.02, 8.5], steps: 10 },
  ];
  const treadCount = stages.reduce((count, stage) => count + (stage.landing ? 0 : stage.steps), 0);
  for (const side of [-1, 1]) {
    const stair = namedGroup(all, side < 0 ? 'west-stair-north' : 'west-stair-south', { risingFlights: 3, intermediateLandings: 2, treadCount, geometryEvidence: 'engraving-supported arrangement; rise and run inferred' });
    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex];
      const part = namedGroup(stair, `${stage.landing ? 'landing' : 'flight'}-${stageIndex + 1}`);
      const mirror = array => V(array[0] * side, array[1], array[2]);
      const curve = new THREE.QuadraticBezierCurve3(mirror(stage.a), mirror(stage.c), mirror(stage.d));
      if (stageIndex === 0) {
        const entry = curve.getPoint(0), direction = curve.getTangent(0).setY(0).normalize();
        // A flush entrance stone spans paving joints across the whole stair width.
        b.add(part, stairStripGeometry(entry.clone().addScaledVector(direction, -.60), entry.clone().addScaledVector(direction, .12), 2.72, footingBottom, approachTop, approachTop), b.m.stone, undefined, undefined, undefined, true);
      }
      for (let i = 0; i < stage.steps; i++) {
        const a = curve.getPoint(i / stage.steps), c = curve.getPoint((i + 1) / stage.steps);
        b.add(part, stairStripGeometry(a, c, 2.32, footingBottom, c.y, c.y), b.m.stone, undefined, undefined, undefined, true);
        b.add(part, stairStripGeometry(a, c, 2.43, c.y, c.y + treadCap, c.y + treadCap), b.m.relief, undefined, undefined, undefined, true);
      }
      for (const edge of [-1, 1]) {
        const points = [];
        const count = Math.max(2, Math.ceil(curve.getLength() / .60));
        for (let i = 0; i <= count; i++) {
          const t = i / count, p = curve.getPoint(t), tangent = curve.getTangent(t);
          const across = V(-tangent.z, 0, tangent.x).normalize().multiplyScalar(edge * 1.22);
          p.add(across);
          const treadY = stage.landing ? p.y : THREE.MathUtils.lerp(stage.a[1], stage.d[1], Math.ceil(t * stage.steps) / stage.steps);
          baluster(b, part, p.x, treadY + .1, p.z, 1.0);
          points.push([p.x, p.y + 1.20, p.z]);
        }
        b.tube(part, points, .102, b.m.relief, count * 3);
        b.tube(part, points.map(([x, y, z]) => [x, y - .91, z]), .10, b.m.stone, count * 3);
      }
      if (stage.landing || stageIndex === 0) {
        const p = mirror(stage.a), tangent = curve.getTangent(0), across = V(-tangent.z, 0, tangent.x).normalize().multiplyScalar(1.27);
        for (const edge of [-1, 1]) {
          const n = p.clone().addScaledVector(across, edge);
          b.box(part, b.m.stone, n.x, p.y + .67, n.z, .43, 1.31, .43, .035);
          finial(b, part, n.x, p.y + 1.39, n.z, .58);
          rosette(b, part, n.x, p.y + .68, n.z + .25, .17, 6);
        }
      }
    }
  }
  return all;
}

function closedContour(points, count = 144) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => V(x, 0, z)), true, 'centripetal');
  return Array.from({ length: count }, (_, i) => {
    const p = curve.getPoint(i / count);
    // Very shallow lobes in the forward coping, organized about the central axis.
    if (p.z > 20.0) p.z += .18 * Math.cos(p.x * Math.PI / 2.45) * Math.min(1, (p.z - 20) / 3);
    return [p.x, p.z];
  });
}

function basin(b, parent, name, contour, waterLevel = .63) {
  const group = namedGroup(parent, name);
  const center = contour.reduce((sum, [x, z]) => sum.add(V(x, 0, z)), V(0, 0, 0)).multiplyScalar(1 / contour.length);
  const inset = factor => contour.map(([x, z]) => [center.x + (x - center.x) * factor, center.z + (z - center.z) * factor]);
  b.polygon(group, contour, .16, .31, b.m.wetStone);
  b.polygon(group, contour, .31, waterLevel + .20, b.m.stone, [inset(.970)]);
  b.polygon(group, inset(1.012), waterLevel + .12, waterLevel + .25, b.m.relief, [inset(.957)]);
  const shape = new THREE.Shape(inset(.964).map(([x, z]) => new THREE.Vector2(x, -z)));
  const water = new THREE.ShapeGeometry(shape, 12);
  water.rotateX(-Math.PI / 2);
  const position = water.getAttribute('position');
  for (let i = 0; i < position.count; i++) position.setY(i, waterLevel + .006 * Math.sin(position.getX(i) * 2.2 + position.getZ(i) * .8));
  water.computeVertexNormals();
  b.add(group, water, b.m.water, undefined, undefined, undefined, true);
  const front = contour.filter(([, z]) => z > center.z + 2.5);
  for (let i = 2; i < front.length - 2; i += 9) {
    const [x, z] = front[i];
    volute(b, group, x - .18, waterLevel + .73, z + .03, .46, .38, -1);
    volute(b, group, x + .18, waterLevel + .73, z + .03, .46, .38, 1);
    rosette(b, group, x, waterLevel + .29, z + .11, .20, 6);
  }
  return group;
}

function fountainUrn(b, parent, x, y, z, scale = 1) {
  const group = namedGroup(parent, `fountain-urn-${x}-${z}`);
  group.position.set(x, y, z); group.scale.setScalar(scale);
  b.lathe(group, [[.80, 0], [.86, .12], [.73, .23], [.56, .33], [.49, .65], [.66, .79], [.68, .96], [.46, 1.07], [.31, 1.30], [.41, 1.45]], [0, 0, 0], b.m.stone, [1, 1, 1], 40);
  b.lathe(group, [[.34, 1.42], [.64, 1.58], [.85, 1.80], [.91, 1.93], [.86, 2.02], [.77, 1.90], [.49, 1.66], [.33, 1.58]], [0, 0, 0], b.m.relief, [1, 1, 1], 40);
  for (let i = 0; i < 16; i++) {
    const angle = i * TAU / 16;
    b.leaf(group, [Math.sin(angle) * .65, 1.74, Math.cos(angle) * .65], [.24, .56, .85], [0, angle, 0]);
    b.ellipsoid(group, b.m.relief, [Math.sin(angle) * .62, .86, Math.cos(angle) * .62], [.09, .16, .095]);
  }
  b.lathe(group, [[.14, 1.77], [.20, 2.07], [.26, 2.23], [.36, 2.32], [.37, 2.40], [.24, 2.37]], [0, 0, 0], b.m.relief, [1, 1, 1], 28);
  b.tube(group, [[0, 2.41, 0], [0, 3.18, .02], [.12, 3.3, .03], [.31, 2.52, .1], [.40, 1.95, .12]], .021, b.m.water, 35);
  return group;
}

function giantClam(b, parent) {
  const clam = namedGroup(parent, 'giant-clam', { evidence: 'west engraving; fluting/rib count and dimensions inferred' });
  clam.position.set(0, 1.52, 10.15);
  const sample = (u, v) => {
    const angle = (u - .5) * Math.PI * 1.05, radius = .06 + v * (2.25 + .085 * Math.cos(angle * 15));
    return V(Math.sin(angle) * radius, Math.cos(angle) * radius * .88, .13 + .54 * v * v + .044 * Math.cos(angle * 15) * v);
  };
  b.add(clam, surfaceGeometry(sample, 90, 28), b.m.stone, undefined, undefined, undefined, true);
  for (let i = 0; i <= 16; i++) b.tube(clam, Array.from({ length: 17 }, (_, j) => sample(i / 16, .10 + .90 * j / 16).add(V(0, 0, .022))), .035, b.m.relief, 25);
  b.tube(clam, Array.from({ length: 81 }, (_, i) => sample(i / 80, 1)), .10, b.m.relief, 90);
  b.ellipsoid(clam, b.m.relief, [0, .04, .19], [.34, .22, .20]);
  b.lathe(clam, [[.38, 2.04], [.62, 2.18], [.64, 2.25], [.46, 2.28]], [0, 0, 0], b.m.relief, [1, 1, .75], 32);
  b.tube(clam, [[0, 2.35, .37], [0, 1.65, .79], [.035, .76, .96], [.04, -.35, 1.65], [.02, -.86, 2.1]], .050, b.m.water, 35);
  const frame = namedGroup(parent, 'shell-wall-and-central-cartouche');
  b.box(frame, b.m.plaster, 0, 2.90, 9.50, 5.3, 5.18, .74);
  for (const side of [-1, 1]) {
    b.box(frame, b.m.stone, side * 2.58, 2.88, 9.85, .36, 5.07, .55, .035);
    volute(b, frame, side * 1.7, 5.45, 10.13, .75, .67, side);
    b.leaf(frame, [side * 2.06, 4.68, 10.06], [.58, 1.01, 1.2], [0, 0, -side * .62]);
  }
  b.box(frame, b.m.stone, 0, 5.25, 9.83, 5.78, .22, .85, .03);
  cartouche(b, frame, 0, 5.66, 10.17, 2.0, 1.64);
  rosette(b, frame, 0, 5.68, 10.32, .32, 10);
  return clam;
}

function buildZodiacFountain(b, root) {
  const fountain = namedGroup(root, 'zodiac-fountain');
  const boundary = closedContour([[0, 9.50], [3.8, 10.0], [8.0, 12.55], [12.9, 15.45], [16.55, 18.60], [17.0, 20.35], [14.55, 23.2], [8.5, 25.0], [0, 25.40], [-8.5, 25.0], [-14.55, 23.2], [-17.0, 20.35], [-16.55, 18.60], [-12.9, 15.45], [-8.0, 12.55], [-3.8, 10.0]]);
  basin(b, fountain, 'zodiac-fountain-basin', boundary, .67);
  giantClam(b, fountain);
  fountainUrn(b, fountain, 0, .31, 21.05, 1.06);
  const slots = [];
  for (const side of [-1, 1]) {
    const platform = namedGroup(fountain, side < 0 ? 'north-continuous-figure-terrace' : 'south-continuous-figure-terrace');
    const a = V(side * 3.25, 0, 10.9), c = V(side * 15.0, 0, 18.07);
    const tangent = c.clone().sub(a).normalize(), normal = V(-tangent.z, 0, tangent.x).multiplyScalar(.90);
    const polygon = [a.clone().add(normal), a.clone().sub(normal), c.clone().sub(normal), c.clone().add(normal)].map(p => [p.x, p.z]);
    b.polygon(platform, polygon, .40, 1.27, b.m.stone);
    b.add(platform, stairStripGeometry(a, c, 2.02, 1.25, 1.42, 1.42), b.m.relief, undefined, undefined, undefined, true);
    for (let i = 0; i < 6; i++) {
      const index = side < 0 ? i : i + 6, [id, zh, original] = ZODIAC[index];
      const position = [side * (4.28 + i * 1.93), 1.43, 11.52 + i * 1.18];
      const figure = namedGroup(fountain, `zodiac-${id}`, { identity: id, bodyMaterial: 'stone', headMaterial: 'copper', orderEvidence: 'inferred; not resolved per archival slot' });
      figure.position.set(...position);
      figure.rotation.y = Math.atan2(-position[0], 20 - position[2]);
      seatedBody(b, figure, id);
      const mouth = copperHead(b, figure, id);
      const rotation = new THREE.Matrix4().makeRotationY(figure.rotation.y);
      const source = V(...mouth).applyMatrix4(rotation).add(V(...position));
      const target = V(position[0] * .54, .69, 19.3 + i * .28);
      const arc = [];
      for (let j = 0; j <= 28; j++) {
        const t = j / 28, p = source.clone().lerp(target, t);
        p.y += 1.18 * t * (1 - t);
        arc.push(p);
      }
      b.tube(fountain, arc, .017, b.m.water, 32);
      for (const radius of [.19, .33]) b.ring(fountain, [target.x, .681, target.z], radius, .009, b.m.water, [1, .75, 1], [Math.PI / 2, 0, 0]);
      // Relief panels belong to the continuous pool wall, not modern detached plinths.
      const panel = namedGroup(platform, `terrace-relief-${id}`);
      panel.position.set(position[0], .87, position[2] + .88);
      panel.rotation.y = figure.rotation.y * .40;
      cartouche(b, panel, 0, 0, 0, 1.33, .55);
      slots.push({ id, labelZh: zh, side: side < 0 ? 'north' : 'south', position, originalHeadStatus: original ? 'extant-original-reference-available' : 'missing-inferred', meshEvidence: 'authored-proportional-study', positionEvidence: 'inferred-order', bodyEvidence: 'engraving-supported-pose; folds-and-back-inferred', sourceIds: original ? (id === 'rat' || id === 'rabbit' ? ['W11', 'W12'] : id === 'horse' ? ['W13'] : ['W22']) : ['W10', 'W14'], geometryName: figure.name });
    }
  }
  const rockwork = namedGroup(fountain, 'shell-foot-rockwork', { evidence: 'west plate arrangement; individual rocks inferred' });
  for (let i = 0; i < 23; i++) {
    const x = (i % 9 - 4) * .54, row = Math.floor(i / 9), z = 10.8 + row * .64;
    b.add(rockwork, b.prototype('carved-rock', () => new THREE.DodecahedronGeometry(1, 1)), b.m.wetStone, [x, .69 + .14 * Math.sin(i * 1.9) + (2 - row) * .12, z], [.35 + (i % 3) * .10, .32 + (i % 4) * .10, .32], [i * .12, i * 1.7, i * .4]);
  }
  for (const side of [-1, 1]) {
    const pier = namedGroup(fountain, side < 0 ? 'north-front-carved-pier' : 'south-front-carved-pier');
    pier.position.set(side * 20.3, .28, 22.50);
    for (const [y, w, h, d] of [[.17, 1.90, .34, 1.90], [.40, 1.66, .16, 1.66], [1.31, 1.39, 1.62, 1.39], [2.17, 1.72, .20, 1.72], [2.40, 1.53, .23, 1.53]]) b.box(pier, b.m.stone, 0, y, 0, w, h, d, .045);
    cartouche(b, pier, 0, 1.32, .74, 1.0, 1.28);
    finial(b, pier, 0, 2.51, 0, 1.21);
    for (const s of [-1, 1]) volute(b, pier, s * .37, 3.4, .05, .37, .68, s);
  }
  return slots;
}

function buildSideFountains(b, root) {
  const sideCourt = namedGroup(root, 'north-and-south-small-fountains');
  for (const side of [-1, 1]) {
    const x = side * 16.4, z = -28.0;
    const contour = Array.from({ length: 64 }, (_, i) => {
      const angle = i * TAU / 64, radius = 2.67 + .11 * Math.cos(angle * 8);
      return [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
    });
    const small = basin(b, sideCourt, side < 0 ? 'north-small-fountain' : 'south-small-fountain', contour, .57);
    fountainUrn(b, small, x, .31, z, .72);
  }
}

function buildPaving(b, root) {
  const court = namedGroup(root, 'study-paved-setting', { evidence: 'exhibition support with engraving-inspired paving; extent not historic boundary' });
  // Compact continuous foundation retains the real model footprint without scenery
  // concealing the waterworks, return elevations or stair undercroft.
  b.box(court, b.m.paving, 0, .025, -9.9, 48, .05, 77.6, .015);
  for (let row = 0; row < 13; row++) for (let col = 0; col < 26; col++) {
    const x = (col - 12.5) * 1.76, z = 7.6 + row * 1.61;
    if (Math.abs(x) < 18 && z < 26.0) continue;
    b.box(court, (col + row) % 5 === 0 ? b.m.stone : b.m.paving, x, .083, z, 1.72, .10, 1.57, .014);
  }
  for (const side of [-1, 1]) for (let row = 0; row < 23; row++) for (let col = 0; col < 4; col++) {
    const x = side * (11.6 + col * 2.3), z = -8.5 - row * 1.62;
    b.box(court, row % 7 === 0 ? b.m.stone : b.m.paving, x, .083, z, 2.26, .10, 1.58, .014);
  }
}

function statistics(group) {
  let meshCount = 0, triangleCount = 0, vertexCount = 0;
  group.traverse(object => {
    if (!object.isMesh) return;
    meshCount++;
    const instances = object.isInstancedMesh ? object.count : 1;
    triangleCount += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * instances;
    vertexCount += object.geometry.attributes.position.count * instances;
  });
  const box = new THREE.Box3().setFromObject(group);
  return { name: group.name, meshCount, triangleCount, vertexCount, bounds: { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() } };
}

function createArchivedFullStudy() {
  const b = new StudyBuilder(), group = new THREE.Group();
  group.name = 'haiyantang-study';
  group.userData = { assetStatus: 'editable-proportional-study-awaiting-native-visual-review', timeAnchor: '1859–1860', westFaces: '+Z', up: '+Y', north: '-X' };
  try {
    buildPaving(b, group);
    buildWestHall(b, group);
    buildWaterworks(b, group);
    buildStairs(b, group);
    const zodiacSlots = buildZodiacFountain(b, group);
    buildSideFountains(b, group);
    b.flush();
    group.updateMatrixWorld(true);
    const total = statistics(group);
    const diagnostics = {
      assetId: 'yuanmingyuan-haiyantang-study', status: 'editable-proportional-study-awaiting-native-visual-review', timeAnchor: '1859–1860',
      coordinateSystem: { up: '+Y', westFront: '+Z', north: '-X', eastRear: '-Z' },
      provisionalScale: { isProvisional: true, units: 'working units; approximately visitor scale', archaeologicalMetricAccuracy: false, assumptions: 'West hall 37.4-unit eleven-bay wall, 12.2-unit depth, 5.02-unit principal landing; separate 19.6-unit-wide end blocks and 12.7-unit-wide reservoir connector. These are authored proportions, not survey measurements.' },
      sourceViews: [
        { view: 'west', path: 'work/yuanmingyuan/references/plate-commons-8.jpg', identification: '海晏堂西面; title and image visually checked', evidenceType: 'historic-engraving', sourceId: 'W10' },
        { view: 'north', path: 'work/yuanmingyuan/references/plate-commons-9.jpg', identification: '海晏堂北面; title and image visually checked', evidenceType: 'historic-engraving', sourceId: 'W10' },
        { view: 'south', path: 'work/yuanmingyuan/references/haiyantang-plate-commons-10.jpg', identification: '海晏堂南面; title and image visually checked', evidenceType: 'historic-engraving', sourceId: 'W10' },
      ],
      supportedFeatures: [
        'West-facing two-level eleven-bay hall and elevated principal landing',
        'Two Chinese hipped roof ends, continuous central tiled roof and central ornamental crest',
        'Paired segmented rising stairways with landings, balustrades and integrated pool-side terraces',
        'Central giant stone clam, scalloped western basin and six seated human-bodied zodiac figures on each side',
        'Stone bodies and separately cast copper animal heads',
        'Separate east I-form waterworks with two raised end houses and contained elevated reservoir',
        'North/south fountain courts and articulated return elevations',
      ],
      inferredFeatures: [
        'All metric dimensions, hidden interior structure and exact stair rise/run await survey calibration',
        'Rear details between available viewpoints and roof section/individual tile dimensions are authored interpretations',
        'Small foliate carving, capital leaf forms and repeated moulding profiles are editable proportional studies, not scanned originals',
        'Zodiac slot order, stone-body folds, hand positions and unobserved head backs are inferred',
        'Seven head identities have extant-original research leads, but these meshes are not artifact scans or accepted likeness studies',
        'Dragon, snake, goat, rooster and dog heads are explicitly inferred because original identities have no confirmed extant-original record in the dossier',
        'Glaze, plaster, copper patina, tin lining and PBR values are art direction; not measured eighteenth-century surfaces',
        'Visible simultaneous water jets are a static exhibition demonstration, not a claim of continuous historical operation',
        'Ground extent and paving outside the immediate composition are a neutral exhibition setting',
      ],
      colorStudy: { path: 'docs/art/yuanmingyuan/concepts/haiyantang-material-r3.png', role: 'contemporary generated color/light/material reference only; not architectural or zodiac identity evidence' },
      zodiacSlots,
      ...total,
      subassemblies: group.children.map(statistics),
      materials: [...b.materials].map(material => ({ name: material.name, category: material.userData.category })),
      resources: { geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, temporaryGeometryDisposals: b.temporaryGeometryDisposals },
      visualAcceptance: { accepted: false, reason: 'Native front, rear, side, aerial and visitor-scale renders are required.' },
    };
    return {
      group,
      diagnostics,
      dispose() {
        if (b.disposed) return;
        b.dispose();
        group.clear();
      },
    };
  } catch (error) {
    b.dispose(); group.clear();
    throw error;
  }
}

export function createHaiyantangStudy(){
 const b=new StudyBuilder(),group=new THREE.Group();group.name='isolated-rat-sculpture-study';
 const figure=namedGroup(group,'zodiac-rat');seatedBody(b,figure,'rat');const mouth=copperHead(b,figure,'rat');b.flush();
 const bounds=new THREE.Box3().setFromObject(group);return {group,diagnostics:{...statistics(group),provisionalScale:{isProvisional:true,units:'working units',scope:'isolated rat candidate; archived R2 materials and builder',mouth},bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},visualAcceptance:false},dispose(){b.dispose();group.clear();}};
}
