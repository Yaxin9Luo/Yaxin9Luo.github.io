import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, namedGroup, extrudedPolygon } from './study-geometry.js';
import { chineseHipPoint, chineseHipRafterPath, chineseHipRoofGeometry, chineseGablePoint, chineseGableRoofGeometry, ridgeBeastGeometry, pyramidalFinialGeometry, gableInfillGeometry, roofTileRollGeometry, bracketArmGeometry } from './chinese-architecture-geometry.js';
import { createFuhaiCaihuaTexture } from './fuhai-paintwork.js';
import { rolledGablePoint, rolledGableRoofGeometry, rolledGableInfillGeometry } from './hanjingtang-roof-geometry.js';

// Common construction details are based on the already reviewed Fuhai utilities.
// The court plan, double-xieshan and juanpeng assemblies below are Hanjingtang's.
const INFERRED = 'authored-proportions-not-surveyed';

function grainTexture(normal = false) {
  const size = 64, data = new Uint8Array(size * size * 4); let seed = 0x795523;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296 - .5, i = (y * size + x) * 4;
    if (normal) { data[i] = 128 + noise * 5; data[i + 1] = 128 + noise * 5; data[i + 2] = 255; }
    else data[i] = data[i + 1] = data[i + 2] = 239 + noise * 12;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size); texture.name = `hanjingtang-micrograin-${normal ? 'normal' : 'roughness'}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.needsUpdate = true; return texture;
}

export class HanjingBuilder {
  constructor(id) {
    this.id = id; this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.prototypes = new Map(); this.pending = new Map();
    this.temporaryDisposals = 0; this.disposed = false; this.m = this.makeMaterials(); this.buildings = []; this.walkways = [];
  }
  makeMaterials() {
    const roughnessMap = grainTexture(), normalMap = grainTexture(true); this.textures.add(roughnessMap); this.textures.add(normalMap);
    const caihuaMap = createFuhaiCaihuaTexture(); this.textures.add(caihuaMap);
    const make = (name, category, options, physical = false) => {
      const material = physical ? new THREE.MeshPhysicalMaterial(options) : new THREE.MeshStandardMaterial(options);
      material.name = `${this.id}-${name}`; material.userData = { category, evidence: 'authored-material-response' }; this.materials.add(material); return material;
    };
    const mineral = { roughnessMap, normalMap, normalScale: new THREE.Vector2(.10, .10) };
    const glaze = { roughnessMap, roughness: .40, clearcoat: .26, clearcoatRoughness: .28 };
    return {
      stone: make('warm-white-stone', 'stone', { ...mineral, color: 0xe3ded0, roughness: .85 }),
      carving: make('carved-stone', 'stone', { ...mineral, color: 0xf1eada, roughness: .81 }),
      foundation: make('weathered-foundation', 'masonry', { ...mineral, color: 0xa39d8b, roughness: .97 }),
      paving: make('grey-court-paving', 'masonry', { ...mineral, color: 0xaeb0a1, roughness: .95 }),
      plaster: make('warm-lime-panels', 'plaster', { ...mineral, color: 0xd9cfb4, roughness: .94 }),
      red: make('vermilion-timber', 'timber', { ...mineral, color: 0x983c2a, roughness: .69 }),
      darkWood: make('deep-red-recessed-wood', 'timber', { ...mineral, color: 0x542b24, roughness: .81 }),
      blue: make('caihua-mineral-blue', 'painted-wood', { color: 0x3c6476, roughness: .81 }),
      green: make('caihua-mineral-green', 'painted-wood', { color: 0x477b68, roughness: .79 }),
      caihua: make('caihua-scroll-fangxin-paintwork', 'painted-wood', { color: 0xffffff, map: caihuaMap, roughness: .78, metalness: .04 }),
      paper: make('warm-window-lining', 'paper', { color: 0xbaa989, roughness: .96, side: THREE.DoubleSide }),
      glass: make('sanyou-reported-glass', 'glazing', { color: 0xc0c6aa, transparent: true, opacity: .24, transmission: .22, roughness: .18, thickness: .018, ior: 1.5 }, true),
      pale: make('caihua-pale-outlines', 'painted-wood', { color: 0xc7cfb5, roughness: .80 }),
      gold: make('ochre-gold-details', 'gilt', { color: 0xc9a85c, metalness: .43, roughness: .57 }),
      yellowTile: make('yellow-glazed-tile', 'glazed-tile', { ...glaze, color: 0xc99934 }, true),
      yellowTileShade: make('yellow-glazed-tile-quiet-variation', 'glazed-tile', { ...glaze, color: 0xc09335 }, true),
      greenTile: make('green-glazed-tile', 'glazed-tile', { ...glaze, color: 0x537360 }, true),
      greenTileShade: make('green-glazed-tile-quiet-variation', 'glazed-tile', { ...glaze, color: 0x4e6e5d }, true),
      blueTile: make('deep-blue-glazed-tile', 'glazed-tile', { ...glaze, color: 0x334e69 }, true),
      darkTile: make('muted-glazed-tile', 'glazed-tile', { ...glaze, color: 0x576462, roughness: .50 }, true),
      greyTile: make('grey-clay-tile', 'clay-tile', { ...mineral, color: 0x77796f, roughness: .92 }),
    };
  }
  prototype(key, make) { if (!this.prototypes.has(key)) this.prototypes.set(key, make()); return this.prototypes.get(key); }
  add(parent, source, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], own = false) {
    if (scale.some(v => v <= 0)) throw new Error('Hanjingtang architecture requires positive scales.');
    let geometry = source.clone(); if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); this.temporaryDisposals++; }
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    geometry.applyMatrix4(new THREE.Matrix4().compose(V(...position), quaternion, V(...scale)));
    let owner = parent; while (owner.userData.mergeIntoParent && owner.parent) owner = owner.parent;
    const key = `${owner.uuid}:${material.id}`; if (!this.pending.has(key)) this.pending.set(key, { parent: owner, material, parts: [] });
    this.pending.get(key).parts.push({ geometry, sourceParent: parent });
    if (own) { source.dispose(); this.temporaryDisposals++; }
  }
  box(parent, material, position, size, rotation) { this.add(parent, this.prototype('box', () => new THREE.BoxGeometry()), material, position, size, rotation); }
  polygon(parent, outline, bottom, top, material, holes = []) { this.add(parent, extrudedPolygon(outline, bottom, top, holes), material, undefined, undefined, undefined, true); }
  rod(parent, material, from, to, radius, sides = 8) {
    const a = V(...from), d = V(...to).sub(a), length = d.length(); if (length < .0001) return;
    const rotation = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
    this.add(parent, this.prototype(`cylinder:${sides}`, () => new THREE.CylinderGeometry(1, 1, 1, sides)), material, a.addScaledVector(d, length / 2).toArray(), [radius, length, radius], rotation);
  }
  tube(parent, material, points, radius, segments = 20, sides = 6) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V(...p)));
    this.add(parent, new THREE.TubeGeometry(curve, segments, radius, sides, false), material, undefined, undefined, undefined, true);
    // Small rounded caps meet the tube ends, so ornament does not leave open bores.
    for (const point of [points[0], points.at(-1)]) this.add(parent, this.prototype('round-cap', () => new THREE.SphereGeometry(1, 8, 6)), material, point.isVector3 ? point.toArray() : point, [radius, radius, radius]);
  }
  lathe(parent, material, profile, position, sides = 16) { this.add(parent, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), sides), material, position, undefined, undefined, true); }
  flush() {
    for (const { parent, material, parts } of this.pending.values()) {
      for (const part of parts) {
        const transform = new THREE.Matrix4(); let node = part.sourceParent;
        while (node !== parent) { node.updateMatrix(); transform.premultiply(node.matrix); node = node.parent; }
        part.geometry.applyMatrix4(transform);
      }
      const geometry = mergeGeometries(parts.map(part => part.geometry)); if (!geometry) throw new Error(`Cannot merge ${parent.name}`);
      geometry.name = `${parent.name}/${material.name}`; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = geometry.name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
      for (const part of parts) { part.geometry.dispose(); this.temporaryDisposals++; }
    }
    this.pending.clear();
  }
  releasePrototypes() { for (const geometry of this.prototypes.values()) { geometry.dispose(); this.temporaryDisposals++; } this.prototypes.clear(); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const { parts } of this.pending.values()) for (const part of parts) part.geometry.dispose(); this.pending.clear(); this.releasePrototypes();
    for (const set of [this.geometries, this.materials, this.textures]) { for (const resource of set) resource.dispose(); set.clear(); }
  }
}


function dougong(b, parent, position, scale = 1, rotation = 0) {
  const group = namedGroup(parent, `${parent.name}-dougong-${parent.children.length}`, { body: 'tiered-solid-dougong', evidence: INFERRED, mergeIntoParent: true }); group.position.set(...position); group.rotation.y = rotation; group.scale.setScalar(scale);
  b.box(group, b.m.green, [0, .09, 0], [.40, .20, .40]);
  b.add(group, b.prototype('bracket-short', () => bracketArmGeometry(.88, .22, .24)), b.m.blue, [0, .25, 0]);
  for (const side of [-1, 1]) {
    b.box(group, b.m.pale, [side * .30, .39, 0], [.20, .15, .25]);
    b.add(group, b.prototype('bracket-long', () => bracketArmGeometry(1.20, .22, .23)), b.m.green, [side * .30, .53, .22], undefined, [0, Math.PI / 2, 0]);
    b.box(group, b.m.pale, [side * .30, .68, .60], [.21, .16, .24]);
  }
  b.add(group, b.prototype('bracket-wide', () => bracketArmGeometry(1.62, .22, .24)), b.m.blue, [0, .83, .59]);
  b.box(group, b.m.green, [0, .95, .59], [.34, .18, .31]);
  b.rod(group, b.m.red, [0, .33, -.04], [0, .91, .78], .064, 8);
  b.box(group, b.m.gold, [0, .872, .724], [1.43, .027, .023]);
  for (const [length, y, z] of [[.88, .25, 0], [1.62, .83, .59]]) for (const face of [-1, 1]) {
    const x = length / 2;
    b.tube(group, b.m.gold, [[-x * .94, y + .045, z + face * .127], [-x * .79, y - .014, z + face * .127], [-x * .54, y - .070, z + face * .127], [x * .54, y - .070, z + face * .127], [x * .79, y - .014, z + face * .127], [x * .94, y + .045, z + face * .127]], .0075, 12, 4);
  }
  return group;
}

function paintedBeam(b, parent, from, to, y, height = .46) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), group = namedGroup(parent, `${parent.name}-painted-beam-${parent.children.length}`, { body: 'caihua-beam-with-fangxin-and-scroll-paintwork', evidence: 'blue-green-palette-supported-original-pattern-proportions-inferred', mergeIntoParent: true });
  group.position.set((from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2); group.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  b.box(group, b.m.green, [0, 0, 0], [length, height, .30]);
  for (const side of [-1, 1]) {
    b.box(group, b.m.blue, [0, 0, side * .157], [length - .09, height * .69, .035]);
    for (const dy of [-1, 1]) b.box(group, b.m.pale, [0, dy * height * .41, side * .176], [length - .05, .028, .026]);
    const face = new THREE.PlaneGeometry(length - .10, height * .72), repeats = Math.max(1, Math.round(length / (height * 7)));
    for (let i = 0; i < face.attributes.uv.count; i++) face.attributes.uv.setX(i, face.attributes.uv.getX(i) * repeats);
    b.add(group, face, b.m.caihua, [0, 0, side * .180], undefined, [0, side < 0 ? Math.PI : 0, 0], true);
    for (const dy of [-1, 1]) b.box(group, b.m.gold, [0, dy * height * .36, side * .185], [length - .10, .010, .010]);
    for (const sx of [-1, 1]) b.box(group, b.m.gold, [sx * (length / 2 - .09), 0, side * .18], [.015, height * .77, .018]);
  }
}

function column(b, parent, x, z, floor, height, radius = .20) {
  b.lathe(parent, b.m.stone, [[0, 0], [radius * 1.58, 0], [radius * 1.58, .13], [radius * 1.37, .23], [radius * 1.12, .31], [0, .31]], [x, floor, z]);
  b.lathe(parent, b.m.red, [[0, .24], [radius, .24], [radius, height * .35], [radius * .94, height * .72], [radius * .87, height], [0, height]], [x, floor, z]);
  for (const y of [.29, height - .16]) b.lathe(parent, b.m.darkWood, [[0, y], [radius * 1.02, y], [radius * 1.02, y + .055], [0, y + .055]], [x, floor, z]);
}


function stoneRail(b, parent, name, from, to, floor, { gate = 0, spacing = 2.20 } = {}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(1, Math.ceil(length / spacing));
  const group = namedGroup(parent, name, { body: 'chinese-carved-stone-railing', evidence: 'white-stone-railings-visible-panel-pattern-inferred', mergeIntoParent: true });
  group.position.set((from[0] + to[0]) / 2, floor, (from[1] + to[1]) / 2); group.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  const step = length / count;
  for (let i = 0; i <= count; i++) {
    const x = -length / 2 + i * step; if (gate && Math.abs(x) < gate / 2) continue;
    b.box(group, b.m.stone, [x, .58, 0], [.25, 1.16, .25]); b.box(group, b.m.carving, [x, .11, 0], [.37, .22, .37]);
    b.lathe(group, b.m.carving, [[0, 0], [.19, 0], [.20, .08], [.13, .15], [.13, .21], [0, .29]], [x, 1.10, 0], 8);
    for (const side of [-1, 1]) b.box(group, b.m.foundation, [x, .71, side * .129], [.13, .39, .018]);
  }
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + (i + .5) * step; if (gate && Math.abs(x) < gate / 2 + step / 2) continue;
    for (const [y, h, d] of [[.14, .17, .20], [.51, .13, .16], [1.02, .16, .22]]) b.box(group, b.m.carving, [x, y, 0], [step, h, d]);
    b.box(group, b.m.stone, [x, .33, 0], [step - .17, .28, .10]);
    for (const dx of [-step * .36, step * .36]) b.box(group, b.m.carving, [x + dx, .78, 0], [.075, .44, .11]);
    const half = Math.min(.45, step * .27);
    for (const side of [-1, 1]) {
      b.rod(group, b.m.carving, [x - half, .77, 0], [x, .77 + side * .20, 0], .038, 6);
      b.rod(group, b.m.carving, [x, .77 + side * .20, 0], [x + half, .77, 0], .038, 6);
      b.tube(group, b.m.carving, [[x - half * .8, .30, side * .066], [x - half * .4, .38, side * .073], [x, .28, side * .073], [x + half * .4, .38, side * .073], [x + half * .8, .30, side * .066]], .021, 10, 5);
    }
  }
  return group;
}

function stairs(b, parent, name, x, frontZ, width, fromY, toY, run) {
  const group = namedGroup(parent, name, { body: 'solid-stone-stair', evidence: INFERRED, fromY, toY, frontZ, run, clearWidth: width });
  const count = Math.max(1, Math.ceil((toY - fromY) / .17));
  for (let i = 0; i < count; i++) {
    const height = (toY - fromY) * (i + 1) / count;
    b.box(group, b.m.stone, [x, fromY + height / 2 - .02, frontZ - (i + .5) * run / count], [width, height + .04, run / count + .018]);
  }
  for (const side of [-1, 1]) b.tube(group, b.m.carving, [[x + side * (width / 2 + .12), fromY + .16, frontZ], [x + side * (width / 2 + .12), (fromY + toY) / 2 + .16, frontZ - run / 2], [x + side * (width / 2 + .12), toY + .16, frontZ - run]], .13, 12, 6);
  return group;
}


function tiledRun(b, parent, sample, maxT, material, row) {
  if (maxT < .016) return;
  const lengthPoints = Array.from({ length: 9 }, (_, i) => sample(maxT * i / 8));
  let length = 0; for (let i = 1; i < lengthPoints.length; i++) length += lengthPoints[i].distanceTo(lengthPoints[i - 1]);
  const count = Math.max(1, Math.ceil(length / .62)), shaded = material === b.m.yellowTile ? b.m.yellowTileShade : material === b.m.greenTile ? b.m.greenTileShade : material;
  for (let course = 0; course < count; course++) {
    const low = maxT * course / count, high = Math.min(maxT, maxT * (course + 1.07) / count);
    const points = Array.from({ length: 4 }, (_, i) => {
      const p = sample(THREE.MathUtils.lerp(low, high, i / 3)); p.y += .016 + .026 * (1 - i / 3); return p;
    });
    b.add(parent, roofTileRollGeometry(points, .081, .023, 20), (row * 17 + course * 11) % 29 < 3 ? shaded : material, undefined, undefined, undefined, true);
  }
}

function roofRidge(b, parent, width, y, tile, scale = 1) {
  if (width < .08) {
    const finial = namedGroup(parent, `${parent.name}-pyramidal-finial`, { body: 'single-baoding-capping-the-pyramidal-apex', sourceIds: ['dpm-architectural-finial-comparison'], evidence: 'apex-finial-type-supported-profile-and-gilding-inferred' });
    b.add(finial, b.prototype('waisted-pearl-pyramidal-finial', pyramidalFinialGeometry), b.m.gold, [0, y, 0], [scale, scale, scale]);
    return;
  }
  b.tube(parent, tile, [[-width / 2, y + .10, 0], [0, y + .10, 0], [width / 2, y + .10, 0]], .13 * scale, 16, 8);
  for (const side of [-1, 1]) {
    const beast = namedGroup(parent, `${parent.name}-ridge-beast-${side}`, { body: 'rounded-glazed-ridge-end-beast', sourceId: 'dpm-rounded-ridge-dragon-comparison', evidence: 'ridge-silhouette-visible-three-dimensional-sculpture-inferred', mergeIntoParent: true });
    beast.position.set(side * width / 2, y + .01, 0); beast.rotation.y = side < 0 ? Math.PI : 0; beast.scale.setScalar(scale);
    b.add(beast, b.prototype('ridge-beast-rounded-body', ridgeBeastGeometry), tile);
    for (const face of [-1, 1]) {
      const sphere = b.prototype('ridge-sculpted-eye-and-scale', () => new THREE.SphereGeometry(1, 24, 16));
      b.add(beast, sphere, b.m.yellowTile, [-.33, .59, face * .236], [.078, .063, .062]);
      b.add(beast, sphere, b.m.darkTile, [-.351, .593, face * .291], [.031, .036, .020]);
      b.add(beast, sphere, b.m.darkTile, [-.648, .474, face * .095], [.025, .017, .027]);
      b.tube(beast, tile, [[-.45, .645, face * .175], [-.355, .692, face * .225], [-.22, .646, face * .219]], .033, 16, 10);
      b.tube(beast, b.m.yellowTile, [[-.21, .36, face * .285], [-.10, .45, face * .315], [.07, .41, face * .319], [.08, .285, face * .271], [-.04, .25, face * .260]], .025, 20, 10);
      for (let row = 0; row < 4; row++) {
        const y = .57 + row * .135, z = (.258 - row * .034) * face, x = .07 + row * .061;
        b.tube(beast, tile, [[x - .065, y, z], [x + .01, y + .044, z + face * .012], [x + .105, y + .015, z - face * .023]], .025, 12, 9);
      }
      b.tube(beast, tile, [[-.19, .69, face * .13], [-.15, .84, face * .16], [-.08, .91, face * .19]], .034, 16, 10);
    }
    b.tube(beast, b.m.yellowTile, [[-.62, .396, -.16], [-.714, .395, -.07], [-.73, .395, 0], [-.714, .395, .07], [-.62, .396, .16]], .018, 24, 10);
    b.tube(beast, tile, [[-.57, .235, -.17], [-.696, .238, -.08], [-.714, .238, 0], [-.696, .238, .08], [-.57, .235, .17]], .021, 24, 10);
  }
}

function hipRoof(b, parent, name, options, material = b.m.yellowTile, { ridge = true, rafters = true } = {}) {
  const group = namedGroup(parent, name, { body: options.topDepth ? 'curved-hip-roof-with-true-central-opening' : 'closed-curved-hip-roof', evidence: INFERRED, dimensions: { ...options } });
  const shell = namedGroup(group, `${name}-shell`, { body: 'solid-curved-roof-shell' });
  b.add(shell, chineseHipRoofGeometry(options), material, undefined, undefined, undefined, true);
  const tiles = namedGroup(group, `${name}-overlapping-tiles`, { body: 'individual-overlapping-glazed-barrel-tiles', pitch: .28, courseLength: .62, lap: .07, evidence: 'physical-tile-construction-profile-inferred' });
  const { width, depth, topWidth = Math.max(0, width - depth), topDepth = 0, eaveY, rise } = options;
  for (let face = 0; face < 4; face++) {
    const along = face % 2 ? depth : width, topAlong = face % 2 ? topDepth : topWidth, rows = Math.max(4, Math.floor(along / .28));
    for (let row = 0; row < rows; row++) {
      const offset = -along / 2 + (row + .5) * along / rows;
      const maxT = Math.min(1, (along / 2 - Math.abs(offset)) / Math.max(.001, (along - topAlong) / 2));
      const sample = t => chineseHipPoint(options, face, offset / Math.max(.00001, THREE.MathUtils.lerp(along / 2, topAlong / 2, t)), t);
      tiledRun(b, tiles, sample, maxT, material, row + face * 19);
      const end = sample(0), next = sample(Math.min(maxT, .03));
      b.rod(tiles, b.m.greenTile, end.clone().add(V(0, -.055, 0)).toArray(), end.clone().add(next.sub(end).normalize().multiplyScalar(.065)).add(V(0, -.055, 0)).toArray(), .10, 10);
    }
  }
  const edges = namedGroup(group, `${name}-glazed-ridges-and-eaves`, { body: 'closed-glazed-ridge-caps-and-upturned-eaves' });
  for (let face = 0; face < 4; face++) {
    const points = Array.from({ length: 25 }, (_, i) => { const p = chineseHipPoint(options, face, i / 12 - 1, 0); p.y += .04; return p; });
    b.tube(edges, b.m.greenTile, points, .095, 32, 7);
    const hip = Array.from({ length: 17 }, (_, i) => { const p = chineseHipPoint(options, face, 1, i / 16); p.y += .10; return p; });
    b.tube(edges, b.m.greenTile, hip, .12, 22, 7);
  }
  if (ridge && !topDepth) roofRidge(b, edges, topWidth, eaveY + rise, b.m.greenTile, Math.min(1.35, width / 10));
  if (rafters) {
    const framing = namedGroup(group, `${name}-curved-timber-rafters`, { body: 'rafters-bearing-on-the-roof-shell' });
    for (let face = 0; face < 4; face++) for (const u of [-.78, -.40, 0, .40, .78]) {
      b.tube(framing, b.m.red, chineseHipRafterPath(options, face, u), .13, 36, 10);
    }
  }
  return group;
}

function xieshanRoof(b, parent, name, { width, depth, eaveY, rise, cornerLift = .28 }, material) {
  const group = namedGroup(parent, name, { body: 'xieshan-hip-and-gable-roof', evidence: 'roof-type-supported-exact-profile-inferred' });
  const topWidth = width - depth * .43, topDepth = depth * .50, breakY = eaveY + rise * .33;
  hipRoof(b, group, `${name}-lower-hips`, { width, depth, topWidth, topDepth, eaveY, rise: rise * .33, cornerLift, thickness: .18 }, material, { ridge: false });
  const upper = namedGroup(group, `${name}-upper-gable`, { body: 'closed-gable-roof-shell' }), options = { width: topWidth, depth: topDepth, eaveY: breakY + .015, rise: rise * .67, thickness: .18 };
  b.add(upper, chineseGableRoofGeometry(options), material, undefined, undefined, undefined, true);
  const tiles = namedGroup(group, `${name}-upper-overlapping-tiles`, { body: 'individual-overlapping-glazed-barrel-tiles' });
  const rows = Math.max(4, Math.floor(topWidth / .28));
  for (const side of [-1, 1]) for (let row = 0; row < rows; row++) {
    const u = -1 + (row + .5) * 2 / rows;
    tiledRun(b, tiles, t => chineseGablePoint(options, side, u, t), 1, material, row);
  }
  const gables = namedGroup(group, `${name}-painted-gables`, { body: 'painted-solid-gable-infill-and-bargeboards' });
  for (const side of [-1, 1]) {
    b.add(gables, gableInfillGeometry(topDepth, rise * .67, .18), b.m.darkWood, [side * (topWidth / 2 - .025), breakY, 0], undefined, undefined, true);
    for (const slope of [-1, 1]) {
      const path = Array.from({ length: 15 }, (_, i) => { const p = chineseGablePoint(options, slope, side, i / 14); p.x += side * .07; p.y -= .07; return p; });
      b.tube(gables, b.m.green, path, .115, 20, 7);
      const outline = path.map(p => p.clone().add(V(side * .085, -.035, 0))); b.tube(gables, b.m.pale, outline, .028, 20, 5);
    }
    for (const z of [-topDepth * .22, 0, topDepth * .22]) {
      const h = rise * .67 * Math.pow(1 - Math.abs(z) / (topDepth / 2), 1.5);
      b.box(gables, b.m.red, [side * (topWidth / 2 + .07), breakY + h / 2, z], [.09, Math.max(.05, h), .075]);
    }
  }
  roofRidge(b, gables, topWidth, eaveY + rise, b.m.greenTile, Math.min(1.25, width / 10));
  return group;
}


export function rolledXieshanRoof(b, parent, name, { width, depth, eaveY, rise, cornerLift = .25 }, material) {
  const group = namedGroup(parent, name, { body: 'juanpeng-xieshan-with-continuous-rounded-crown', evidence: 'Chunhuaxuan-roof-type-from-Wang-2015-p360-profile-inferred' });
  const topWidth = width - depth * .40, topDepth = depth * .55, breakY = eaveY + rise * .28;
  hipRoof(b, group, `${name}-lower-hips`, { width, depth, topWidth, topDepth, eaveY, rise: rise * .28, cornerLift, thickness: .18 }, material, { ridge: false });
  const upper = namedGroup(group, `${name}-rounded-upper-shell`, { body: 'continuous-juanpeng-crown' });
  const options = { width: topWidth, depth: topDepth, eaveY: breakY + .012, rise: rise * .72, thickness: .18 };
  b.add(upper, rolledGableRoofGeometry(options), material, undefined, undefined, undefined, true);
  const tiles = namedGroup(group, `${name}-rounded-overlapping-tiles`, { body: 'separate-glazed-tiles-following-rounded-crown' });
  const rows = Math.max(4, Math.floor(topWidth / .28));
  for (let row = 0; row < rows; row++) {
    const u = -1 + (row + .5) * 2 / rows;
    for (const side of [-1, 1]) tiledRun(b, tiles, t => rolledGablePoint(options, side, u, t), .94, material, row);
    const crown = Array.from({ length: 9 }, (_, i) => {
      const p = rolledGablePoint(options, i < 4 ? 1 : -1, u, 1 - Math.abs(i - 4) * .025); p.y += .041; return p;
    });
    b.add(tiles, roofTileRollGeometry(crown, .081, .023, 20), material, undefined, undefined, undefined, true);
  }
  rolledGableBoards(b, group, `${name}-rounded-gable-boards`, options, rise, breakY);
  return group;
}

export function rolledGableBoards(b, parent, name, options, rise, breakY) {
  const { width: topWidth, depth: topDepth } = options;
  const gables = namedGroup(parent, name, { body: 'closed-rounded-gables-and-continuous-bargeboards' });
  for (const side of [-1, 1]) {
    b.add(gables, rolledGableInfillGeometry(topDepth, rise * .72, .18), b.m.darkWood, [side * (topWidth / 2 - .025), breakY + .012, 0], undefined, undefined, true);
    for (const slope of [-1, 1]) {
      const path = Array.from({ length: 37 }, (_, i) => { const p = rolledGablePoint(options, slope, side, i / 36); p.x += side * .045; p.y -= .015; return p; });
      b.tube(gables, b.m.greenTile, path, .11, 40, 14);
      b.tube(gables, b.m.pale, path.map(p => p.clone().add(V(side * .080, -.085, 0))), .027, 40, 8);
    }
    for (const z of [-topDepth * .30, -topDepth * .15, 0, topDepth * .15, topDepth * .30]) {
      // Fit the outer edge of each batten to the curved underside. A constant
      // height left the outer pair sticking through the rolled roof silhouette.
      const edgeZ = Math.abs(z) + .055 / 2;
      let low = 0, high = 1;
      for (let i = 0; i < 28; i++) {
        const t = (low + high) / 2;
        if (rolledGablePoint(options, 1, 0, t).z > edgeZ) low = t; else high = t;
      }
      const underside = rolledGablePoint(options, 1, 0, (low + high) / 2).y - options.thickness;
      const bottom = breakY + rise * .05, top = Math.min(breakY + rise * .29, underside - .026);
      if (top > bottom) b.box(gables, b.m.red, [side * (topWidth / 2 + .075), (bottom + top) / 2, z], [.065, top - bottom, .055]);
    }
  }
  return gables;
}

export function doubleXieshanRoof(b, parent, name, { width, depth, eaveY, rise }, material) {
  const group = namedGroup(parent, name, { body: 'double-eave-xieshan-on-continuous-bearing-drum', evidence: 'Hanjingtang-seven-bay-double-xieshan-Wang-2015-p360' });
  const topWidth = width - 5.2, topDepth = depth - 4.0, lowerRise = rise * .31;
  hipRoof(b, group, `${name}-lower-eaves`, { width, depth, topWidth, topDepth, eaveY, rise: lowerRise, cornerLift: .35, thickness: .18 }, material, { ridge: false });
  const drum = namedGroup(group, `${name}-bearing-drum`, { body: 'hollow-timber-bearing-between-roof-tiers' });
  const rectangle = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  b.polygon(drum, rectangle(topWidth + .34, topDepth + .34), eaveY + lowerRise - .24, eaveY + lowerRise + .68, b.m.green, [rectangle(topWidth - .34, topDepth - .34)]);
  const corners = rectangle(topWidth + .35, topDepth + .35);
  for (let i = 0; i < 4; i++) paintedBeam(b, drum, corners[i], corners[(i + 1) % 4], eaveY + lowerRise + .42, .38);
  xieshanRoof(b, group, `${name}-upper-xieshan`, { width: topWidth + 1.50, depth: topDepth + 1.50, eaveY: eaveY + lowerRise + .71, rise: rise * .77, cornerLift: .26 }, material);
  return group;
}

export { dougong, paintedBeam, column, stoneRail, stairs, hipRoof, xieshanRoof };
