import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, TAU, namedGroup, extrudedPolygon, meshFromTriangles } from './study-geometry.js';
import { archShape, extrudeShape, stoneSweep, organicLoft, fountainFlowGeometry, fountainRippleGeometry, createFountainWater, carvedLeaf, shellGeometry, ringGeometry } from './yuanyingguan-geometry.js';
import { galleryCurve, galleryOffset, curvedStrip, bendBayGeometry, fishScaleRoofGeometry, flowerOutline } from './xieqiqu-geometry.js';
import { copperSheepComponentSpecs, copperSheepMouth } from './xieqiqu-copper-sheep.js';

// 1859–1860 complete-exterior study. All metric dimensions below are authored
// proportional assumptions: no readable metric survey was found for this group.
// +Y up; +Z south; +X east. Resource ownership is local to this factory call.
const HYPOTHESIS = 'authored-proportional-reconstruction-not-surveyed-dimensions';
const SOURCES = [
  { id: 'mit-01', type: 'historic-engraving', label: '谐奇趣南面', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy2001_Xieqiqu_south.jpg' },
  { id: 'mit-02', type: 'historic-engraving', label: '谐奇趣北面', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy2002_Xieqiqu_north.jpg' },
  { id: 'mit-03', type: 'historic-engraving', label: '蓄水楼东面', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy2003_Reservoir_east.jpg' },
  { id: 'park-xieqiqu', type: 'institutional-description', label: '管理处谐奇趣单体资料', url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231511.html' },
  { id: 'zhu-cao-2025-fig5', type: 'named-research-and-plan-elevation', label: '朱翊纶、曹新2025，图5及建筑造型章节', url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html' },
];

function grainTexture(kind, normal = false) {
  const side = 96, data = new Uint8Array(side * side * 4);
  let seed = 0x92754;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed);
    const noise = ((seed ^ seed >>> 14) >>> 0) / 4294967296 - .5, at = (y * side + x) * 4;
    if (normal) {
      data[at] = 128 + 8 * noise;
      data[at + 1] = 128 + 7 * noise;
      data[at + 2] = 255;
    } else {
      const grey = (kind === 'copper' ? 220 : kind === 'tile' ? 181 : 226) + noise * (kind === 'copper' ? 34 : 14);
      data[at] = data[at + 1] = data[at + 2] = grey;
    }
    data[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, side, side); texture.name = `xieqiqu-${kind}-${normal ? 'normal' : 'roughness'}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 4);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
}

class AssetBuilder {
  constructor() {
    this.prototypes = new Map(); this.pending = new Map(); this.geometries = new Set(); this.materials = new Set(); this.textures = new Set();
    this.disposed = false; this.temporaryGeometryDisposals = 0; this.m = this.createMaterials();
    this.contacts = []; this.openings = []; this.waterEndpoints = [];
  }
  texture(kind, normal) { const value = grainTexture(kind, normal); this.textures.add(value); return value; }
  createMaterials() {
    const stoneNormal = this.texture('stone', true), stoneRough = this.texture('stone', false);
    const copperNormal = this.texture('copper', true), copperRough = this.texture('copper', false);
    const tileNormal = this.texture('tile', true), tileRough = this.texture('tile', false);
    const make = (name, category, properties, physical = false) => {
      const material = physical ? new THREE.MeshPhysicalMaterial(properties) : new THREE.MeshStandardMaterial(properties);
      material.name = `xieqiqu-${name}`; material.userData = { category, evidence: 'material-response-and-colour-are-art-direction' };
      this.materials.add(material); return material;
    };
    this.water = createFountainWater('xieqiqu');
    for (const material of [this.water.surface, this.water.flow]) this.materials.add(material);
    for (const texture of this.water.textures) this.textures.add(texture);
    const stone = { color: 0xe8e0cf, roughness: .83, normalMap: stoneNormal, normalScale: new THREE.Vector2(.16, .16), roughnessMap: stoneRough };
    return {
      stone: make('warm-white-marble', 'stone', stone),
      carving: make('marble-cut-faces', 'stone', { ...stone, color: 0xf0e9db, roughness: .75 }),
      oldStone: make('marble-recesses', 'stone', { ...stone, color: 0xc9c4b4, roughness: .90 }),
      wetStone: make('wet-marble', 'stone', { ...stone, color: 0xaaa99f, roughness: .49 }),
      paving: make('limestone-paving', 'stone', { ...stone, color: 0xd1c8b5, roughness: .92 }),
      brick: make('grey-brick-body', 'masonry', { color: 0x9d9e93, roughness: .96, normalMap: stoneNormal, normalScale: new THREE.Vector2(.12, .12) }),
      plaster: make('warm-mineral-render', 'plaster', { color: 0xd9bdac, roughness: .96, normalMap: stoneNormal, normalScale: new THREE.Vector2(.10, .10) }),
      tile: make('muted-jade-glaze-provisional', 'glazed-tile', { color: 0x567075, roughness: .32, roughnessMap: tileRough, normalMap: tileNormal, normalScale: new THREE.Vector2(.1, .1), clearcoat: .42, clearcoatRoughness: .2 }, true),
      tileTrim: make('glazed-tile-edges-provisional', 'glazed-tile', { color: 0x869596, roughness: .34, clearcoat: .35 }, true),
      copper: make('cast-copper-sculpture', 'copper', { color: 0x806a4d, roughness: .70, metalness: .81, roughnessMap: copperRough, normalMap: copperNormal, normalScale: new THREE.Vector2(.10, .10) }),
      copperRecess: make('copper-recess-patina', 'copper', { color: 0x34483c, roughness: .83, metalness: .66, roughnessMap: copperRough }),
      timber: make('dark-timber-window-frames', 'timber', { color: 0x514c37, roughness: .63 }),
      glass: make('recessed-glazing', 'glass', { color: 0x263d37, roughness: .20, metalness: .22, clearcoat: .8 }, true),
      water: this.water.surface,
      waterFlow: this.water.flow,
      earth: make('garden-bed-soil', 'soil', { color: 0x5e6550, roughness: 1 }),
    };
  }
  prototype(key, create) { if (!this.prototypes.has(key)) this.prototypes.set(key, create()); return this.prototypes.get(key); }
  add(parent, source, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], takeOwnership = false) {
    let geometry = source.clone();
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); this.temporaryGeometryDisposals++; }
    geometry.applyMatrix4(new THREE.Matrix4().compose(V(...position), rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), V(...scale)));
    const key = `${parent.uuid}:${material.id}`;
    if (!this.pending.has(key)) this.pending.set(key, { parent, material, parts: [] });
    this.pending.get(key).parts.push(geometry);
    if (takeOwnership) { source.dispose(); this.temporaryGeometryDisposals++; }
  }
  box(parent, material, position, size, bevel = .015, rotation) {
    if (bevel > 0) this.add(parent, this.prototype(`box:${size}:${bevel}`, () => new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map(v => v / 5)))), material, position, undefined, rotation);
    else this.add(parent, this.prototype('unit-box', () => new THREE.BoxGeometry(1, 1, 1)), material, position, size, rotation);
  }
  lathe(parent, profile, position, material = this.m.stone, scale = [1, 1, 1], segments = 28) {
    this.add(parent, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(.004, r), y)), segments), material, position, scale, undefined, true);
    // LatheGeometry only makes the revolved strip. Cap the profile ends so
    // pedestals and urn feet are solids; a bowl profile ends at its inner floor.
    for (const [point, sign] of [[profile[0], -1], [profile.at(-1), 1]]) {
      const disk = new THREE.CircleGeometry(Math.max(.004, point[0]), segments); disk.rotateX(-sign * Math.PI / 2); disk.translate(0, point[1], 0);
      this.add(parent, disk, material, position, scale, undefined, true);
    }
  }
  sweep(parent, points, width, depth, material = this.m.carving, axis = V(0, 0, 1), segments = 28, taper) {
    this.add(parent, stoneSweep(points, width, depth, axis, segments, taper), material, undefined, undefined, undefined, true);
  }
  loft(parent, sections, material = this.m.copper, sides = 16, steps = 24, ridge = .015) {
    this.add(parent, organicLoft(sections, sides, steps, ridge), material, undefined, undefined, undefined, true);
  }
  leaf(parent, position, scale = [1, 1, 1], rotation = [0, 0, 0], kind = 'acanthus', material = this.m.carving) {
    this.add(parent, this.prototype(`leaf-${kind}`, () => carvedLeaf(kind)), material, position, scale, rotation);
  }
  shell(parent, position, width, height, depth, material = this.m.carving, rotation = [0, 0, 0]) {
    this.add(parent, shellGeometry(width, height, depth), material, position, undefined, rotation, true);
  }
  polygon(parent, points, bottom, top, material, holes = []) { this.add(parent, extrudedPolygon(points, bottom, top, holes), material, undefined, undefined, undefined, true); }
  shape(parent, shape, position, depth, material, bevel = .025, rotation) { this.add(parent, extrudeShape(shape, depth, bevel), material, position, undefined, rotation, true); }
  waterArc(parent, points, radius, id, basinId) {
    this.add(parent, fountainFlowGeometry(points, radius), this.m.waterFlow, undefined, undefined, undefined, true);
    if (id.endsWith('-jet') || id.endsWith('-central-rise')) {
      const size = Math.max(.10, Math.min(.45, radius * 12));
      this.add(parent, this.prototype('water-landing-ripples', fountainRippleGeometry), this.m.water, points.at(-1), [size, 1, size]);
    }
    this.waterEndpoints.push({ id, basinId, start: [...points[0]], end: [...points.at(-1)], coordinateSpace: parent.name, evidence: 'illustrative-hydraulic-state-not-original-flow-measurement' });
  }
  flush() {
    for (const { parent, material, parts } of this.pending.values()) {
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error(`Could not merge Xieqiqu geometry for ${parent.name}`);
      geometry.name = `${parent.name}/${material.name}`; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = geometry.name; mesh.castShadow = !['water', 'glass'].includes(material.userData.category); mesh.receiveShadow = true;
      if (material.userData.category === 'water') mesh.renderOrder = material.userData.role === 'flow' ? 2 : 1;
      parent.add(mesh); for (const part of parts) { part.dispose(); this.temporaryGeometryDisposals++; }
    }
    this.pending.clear();
  }
  releasePrototypes() { for (const geometry of this.prototypes.values()) { geometry.dispose(); this.temporaryGeometryDisposals++; } this.prototypes.clear(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; for (const { parts } of this.pending.values()) for (const part of parts) part.dispose(); this.pending.clear(); this.releasePrototypes();
    for (const set of [this.geometries, this.materials, this.textures]) { for (const resource of set) resource.dispose(); set.clear(); }
  }
}

// Independent sculpture reviews obtain these exact source PBR objects without
// constructing any architecture, animal, basin, terrain or water geometry.
export function createXieqiquSculptureMaterialOwner(roles) {
  if(!Array.isArray(roles)||!roles.length||new Set(roles).size!==roles.length||roles.some(role=>!['carving','oldStone','copper','copperRecess'].includes(role)))throw new Error('Independent sculpture requires declared source stone/copper material roles');
  const b=new AssetBuilder(),materials=Object.fromEntries(roles.map(role=>[role,b.m[role]])),used=new Set(Object.values(materials)),textures=new Set();
  for(const material of used)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const material of b.materials)if(!used.has(material)){material.dispose();b.materials.delete(material);}for(const texture of b.textures)if(!textures.has(texture)){texture.dispose();b.textures.delete(texture);}
  return {materials,diagnostics:{geometryConstructed:false,materials:used.size,textures:textures.size},get disposed(){return b.disposed;},dispose(){b.dispose();}};
}

function archPoints(width, height, bottom = 0, cx = 0, z = 0) {
  const r = width / 2, spring = bottom + height - r, points = [[cx - r, bottom, z], [cx - r, spring, z]];
  for (let i = 1; i <= 24; i++) { const a = Math.PI - i / 24 * Math.PI; points.push([cx + Math.cos(a) * r, spring + Math.sin(a) * r, z]); }
  points.push([cx + r, bottom, z]); return points;
}

function volute(b, parent, x, y, z, size = 1, side = 1) {
  const points = [[x - side * size, y - .27 * size, z], [x - side * .62 * size, y + .19 * size, z], [x, y + .36 * size, z], [x + side * .33 * size, y + .12 * size, z], [x + side * .24 * size, y - .17 * size, z], [x - side * .035 * size, y - .15 * size, z + .04], [x, y + .04 * size, z + .04]];
  b.sweep(parent, points, .21 * size, .24 * size, b.m.carving, V(0, 0, 1), 30, t => .56 + .44 * Math.sin(t * Math.PI * .85));
  b.leaf(parent, [x - side * .53 * size, y + .12 * size, z + .09], [.50 * size, .74 * size, .6 * size], [0, 0, -side * .78]);
}

function cornice(b, parent, x, y, z, width, depth = .54, dentils = true) {
  for (const [dy, add, h, d] of [[-.23, 0, .12, 0], [-.10, .10, .14, .10], [.055, .23, .13, .25], [.18, .34, .10, .36]]) b.box(parent, b.m.carving, [x, y + dy, z], [width + add, h, depth + d], .020);
  if (dentils) for (let i = 0, n = Math.max(1, Math.floor(width / .29)); i < n; i++) b.box(parent, b.m.carving, [x - width / 2 + (i + .5) * width / n, y - .37, z + depth / 2], [.10, .19, .13], .006);
}

function urn(b, parent, name, position, size = 1) {
  const group = namedGroup(parent, name, { body: 'carved-finial-urn', evidence: 'engraving-motif; profile-authored' }); group.position.set(...position); group.scale.setScalar(size);
  b.box(group, b.m.stone, [0, .10, 0], [.60, .20, .60], .025);
  b.lathe(group, [[.23, .20], [.28, .29], [.17, .42], [.21, .60], [.35, .79], [.33, 1.05], [.24, 1.17], [.29, 1.26], [.25, 1.34], [.11, 1.43], [.018, 1.58]], [0, 0, 0], b.m.carving);
  for (let face = 0; face < 6; face++) { const a = face / 6 * TAU; b.leaf(group, [Math.sin(a) * .27, .80, Math.cos(a) * .27], [.25, .46, .29], [0, a, 0]); }
  return group;
}

function column(b, parent, name, position, height, radius = .26, order = 'corinthian') {
  const group = namedGroup(parent, name, { body: `${order}-marble-column`, evidence: 'Zhu-Cao-2025-column-order; profile-and-carving-authored' }); group.position.set(...position);
  b.box(group, b.m.stone, [0, .13, 0], [radius * 3.0, .26, radius * 3.0], .025);
  b.lathe(group, [[radius * 1.30, .26], [radius * 1.45, .35], [radius * 1.02, .48], [radius * 1.23, .58], [radius, .68]], [0, 0, 0]);
  const sections = Array.from({ length: 12 }, (_, i) => { const t = i / 11, r = radius * (1 - .12 * t + .055 * Math.sin(t * Math.PI)); return [0, .67 + t * (height - 1.43), 0, r, r]; });
  b.loft(group, sections, b.m.carving, 28, 18, .038);
  b.lathe(group, [[radius * .90, height - .79], [radius * 1.19, height - .70], [radius * 1.08, height - .60], [radius * 1.52, height - .22]], [0, 0, 0]);
  if (order === 'ionic') {
    for (const front of [-1, 1]) for (const side of [-1, 1]) {
      const ornament = namedGroup(group, `${name}-volute-${front}-${side}`, { body: 'solid-carved-ionic-volute' }); ornament.rotation.y = front < 0 ? Math.PI : 0;
      volute(b, ornament, side * radius * 1.22, height - .34, radius * 1.11, radius * 1.30, -side);
    }
  } else for (let row = 0; row < 2; row++) for (let face = 0; face < 8; face++) {
    const a = face / 8 * TAU + row * Math.PI / 8;
    b.leaf(group, [Math.sin(a) * radius * 1.03, height - .57 + row * .15, Math.cos(a) * radius * 1.03], [radius * 1.50, .65 - .06 * row, radius * 1.6], [0, a, 0]);
  }
  b.box(group, b.m.carving, [0, height - .10, 0], [radius * 3.50, .20, radius * 3.50], .025);
  return group;
}

function openingFrame(b, parent, name, bay) {
  const { x = 0, b: bottom = .55, w = 1.65, h = 3.55, kind = 'glass', decorated = true } = bay;
  const group = namedGroup(parent, name, { body: kind === 'passage' ? 'walk-through-carved-portal' : `recessed-${kind}-opening`, evidence: 'engraving-constrained-proportional-opening', opening: { x, bottom, w, h, kind } });
  for (const [offset, width, depth, z] of [[.055, .145, .17, .09], [.22, .13, .22, .14], [.39, .14, .16, .10]]) b.sweep(group, archPoints(w + offset * 2, h + offset, bottom, x, z), width, depth, b.m.carving, V(0, 0, 1), 42);
  if (kind !== 'passage') {
    b.shape(group, archShape(w - .10, h - .10, bottom + .045, x), [0, 0, -.25], .04, kind === 'door' ? b.m.timber : b.m.glass, .004);
    const spring = bottom + h - w / 2;
    for (const side of [-1, 0, 1]) b.box(group, b.m.timber, [x + side * w / 3, bottom + (spring - bottom) / 2, -.15], [.053, spring - bottom, .083], .006);
    for (let y = bottom + .56; y < spring; y += .59) b.box(group, b.m.timber, [x, y, -.145], [w - .12, .043, .08], .004);
    for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI; b.sweep(group, [[x, spring, -.145], [x + Math.cos(a) * (w / 2 - .08), spring + Math.sin(a) * (w / 2 - .08), -.145]], .035, .046, b.m.timber, V(0, 0, 1), 1); }
    if (kind === 'door') for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) b.box(group, b.m.timber, [x + side * w * .25, bottom + .44 + row * .74, -.10], [w * .41, .58, .07], .033);
      b.box(group, b.m.copper, [x + side * .10, bottom + 1.35, .015], [.056, .16, .073], .012);
    }
  }
  if (kind === 'glass') {
    b.box(group, b.m.carving, [x, bottom - .13, .11], [w + .97, .25, .58], .029);
    b.box(group, b.m.oldStone, [x, bottom - .44, .01], [w + .26, .40, .12], .02);
    for (const side of [-1, 1]) b.leaf(group, [x + side * .30, bottom - .47, .13], [.43, .53, .42], [0, 0, side * .60]);
  }
  if (decorated) {
    b.shell(group, [x, bottom + h + .12, .20], .91, .66, .15);
    for (const side of [-1, 1]) volute(b, group, x + side * (w / 2 + .30), bottom + h + .035, .18, .64, -side);
  }
  return group;
}

function elevation(b, parent, name, position, rotation, width, height, bays, options = {}) {
  const group = namedGroup(parent, name, { body: 'perforated-masonry-elevation', evidence: options.evidence ?? HYPOTHESIS }); group.position.set(...position); group.rotation.y = rotation;
  const outline = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(width / 2, height), new THREE.Vector2(-width / 2, height)]);
  for (const bay of bays) outline.holes.push(new THREE.Path(archShape(bay.w, bay.h, bay.b, bay.x).getPoints(32)));
  b.shape(group, outline, [0, 0, -.60], .60, options.material ?? b.m.plaster, 0);
  bays.forEach((bay, index) => openingFrame(b, group, `${name}-opening-${index + 1}`, bay));
  cornice(b, group, 0, height - .20, 0, width + .12);
  if (options.rusticated) for (let y = .42; y < height - .75; y += .56) {
    const excluded = bays.filter(bay => y > bay.b - .07 && y < bay.b + bay.h + .40).map(bay => [bay.x - bay.w / 2 - .50, bay.x + bay.w / 2 + .50]).sort((a, c) => a[0] - c[0]);
    let left = -width / 2;
    for (const [lo, hi] of [...excluded, [width / 2, width / 2]]) {
      if (lo > left + .04) {
        const n = Math.max(1, Math.round((lo - left) / 1.05));
        for (let i = 0; i < n; i++) b.box(group, b.m.stone, [left + (i + .5) * (lo - left) / n, y, .07], [(lo - left) / n - .028, .49, .15], .029);
      }
      left = Math.max(left, hi);
    }
  }
  return group;
}

function balustrade(b, parent, name, points, height = 1.04, spacing = .39) {
  const group = namedGroup(parent, name, { body: 'solid-carved-stone-balustrade' }), path = new THREE.CatmullRomCurve3(points.map(point => V(...point)));
  const length = path.getLength(), count = Math.max(1, Math.floor(length / spacing));
  b.sweep(group, points.map(([x, y, z]) => [x, y + .10, z]), .29, .19, b.m.stone, V(0, 1, 0), Math.max(2, Math.ceil(length * 2)));
  b.sweep(group, points.map(([x, y, z]) => [x, y + height, z]), .36, .18, b.m.carving, V(0, 1, 0), Math.max(2, Math.ceil(length * 2)));
  const profile = [[.10, .17], [.12, .23], [.069, .32], [.085, .43], [.119, .53], [.10, .63], [.058, .76], [.09, .89], [.10, .98]];
  for (let i = 0; i <= count; i++) {
    const p = path.getPointAt(i / count);
    if (i % 9 === 0 || i === count) {
      b.box(group, b.m.stone, [p.x, p.y + height * .5, p.z], [.34, height + .06, .34], .025);
      b.lathe(group, [[.20, 0], [.23, .10], [.14, .19], [.11, .28], [.018, .38]], [p.x, p.y + height + .02, p.z]);
    } else b.lathe(group, profile, p.toArray(), b.m.carving, [1, height / 1.04, 1], 12);
  }
  return group;
}

function tiledRoof(b, parent, name, position, width, depth, eave, rise) {
  const group = namedGroup(parent, name, { body: 'complete-hip-roof-with-fish-scale-tiles', evidence: 'roof-silhouette-from-engraving; fish-scale-tile-reference-from-Zhu-Cao-2025; profile-and-colour-inferred' }); group.position.set(...position);
  const geometry = fishScaleRoofGeometry(width, depth, eave, rise);
  for (const [key, material] of [['roof', b.m.tile], ['edges', b.m.tileTrim], ['tiles', b.m.tileTrim], ['underside', b.m.timber]]) b.add(group, geometry[key], material, undefined, undefined, undefined, true);
  for (const ridge of geometry.ridges) b.sweep(group, ridge.points, ridge.type === 'eave' ? .18 : .15, .20, b.m.tileTrim, V(0, 1, 0), ridge.points.length);
  const ridgeZ = Math.max(0, (depth - width) / 2), ridgeX = Math.max(0, (width - depth) / 2);
  b.sweep(group, [[-ridgeX, eave + rise + .10, -ridgeZ], [ridgeX || .015, eave + rise + .10, ridgeZ || .015]], .23, .27, b.m.tileTrim, V(0, 1, 0), 4);
  for (const side of [-1, 1]) {
    const x = side * Math.max(ridgeX, .2), z = side * Math.max(ridgeZ, .2);
    b.loft(group, [[x, eave + rise + .16, z, .13, .13], [x * 1.1, eave + rise + .36, z * 1.15, .11, .1], [x * 1.2, eave + rise + .61, z * 1.25, .07, .08], [x * .9, eave + rise + .74, z * 1.10, .018, .018]], b.m.tileTrim, 14, 18, .04);
  }
  return group;
}

function curvedGallery(b, parent, side) {
  const id = side < 0 ? 'west' : 'east', group = namedGroup(parent, `xieqiqu-${id}-curved-gallery`, { body: 'open-curving-arcade-with-upper-terrace', evidence: 'south-engraving-and-2025-fig5-plan; bay-count-proportional', bayCount: 10 });
  const curve = galleryCurve(side), length = curve.getLength(), bays = 10, bayWidth = length / bays;
  b.add(group, curvedStrip(curve, 2.22, -.05, .34), b.m.stone, undefined, undefined, undefined, true);
  b.add(group, curvedStrip(curve, 2.23, 5.45, 5.78), b.m.stone, undefined, undefined, undefined, true);
  for (let i = 0; i < bays; i++) {
    const t0 = i / bays, t1 = (i + 1) / bays, archWidth = bayWidth - .82, bottom = .34, height = 4.64;
    const bay = namedGroup(group, `${id}-gallery-arch-bay-${i + 1}`, { body: 'open-arched-bay', openingHeight: height });
    const shape = new THREE.Shape([new THREE.Vector2(-bayWidth / 2, bottom), new THREE.Vector2(bayWidth / 2, bottom), new THREE.Vector2(bayWidth / 2, 5.50), new THREE.Vector2(-bayWidth / 2, 5.50)]);
    shape.holes.push(new THREE.Path(archShape(archWidth, height, bottom).getPoints(34)));
    const source = extrudeShape(shape, .36, 0);
    for (const offset of [-1.89, 1.53]) {
      const geometry = bendBayGeometry(source, curve, t0, t1, bayWidth, offset); b.add(bay, geometry, b.m.stone, undefined, undefined, undefined, true);
      const points = archPoints(archWidth + .13, height + .08, bottom, 0, offset < 0 ? offset - .035 : offset + .395).map(([x, y, z]) => galleryOffset(curve, t0 + (x / bayWidth + .5) * (t1 - t0), z, y).toArray());
      b.sweep(bay, points, .15, .17, b.m.carving, V(0, 1, 0), 42);
    }
    source.dispose(); b.temporaryGeometryDisposals++;
    const spring = bottom + height - archWidth / 2, vaultShape = new THREE.Shape();
    vaultShape.moveTo(-bayWidth / 2, 5.49); vaultShape.lineTo(bayWidth / 2, 5.49); vaultShape.lineTo(bayWidth / 2, spring);
    vaultShape.lineTo(archWidth / 2, spring);
    vaultShape.bezierCurveTo(archWidth / 2, spring + archWidth * .27615, archWidth * .27615, bottom + height, 0, bottom + height);
    vaultShape.bezierCurveTo(-archWidth * .27615, bottom + height, -archWidth / 2, spring + archWidth * .27615, -archWidth / 2, spring);
    vaultShape.lineTo(-bayWidth / 2, spring); vaultShape.closePath();
    const vaultSource = extrudeShape(vaultShape, 3.06, 0), vault = bendBayGeometry(vaultSource, curve, t0, t1, bayWidth, -1.53); b.add(bay, vault, b.m.plaster, undefined, undefined, undefined, true); vaultSource.dispose(); b.temporaryGeometryDisposals++;
    const midpoint = galleryOffset(curve, (t0 + t1) / 2, -5.0, 2.0), target = galleryOffset(curve, (t0 + t1) / 2, 5.0, 2.0);
    b.openings.push({ id: `${id}-arcade-${i + 1}`, group: group.name, origin: midpoint.toArray(), direction: target.sub(midpoint).normalize().toArray(), expectedCategory: 'unobstructed-passage', maxDistance: 10 });
  }
  for (let i = 0; i <= bays; i++) for (const offset of [-1.97, 1.98]) {
    const p = galleryOffset(curve, i / bays, offset, .34), tangent = curve.getTangentAt(i / bays);
    const pillar = column(b, group, `${id}-gallery-column-${i}-${offset < 0 ? 'inner' : 'outer'}`, p.toArray(), 5.15, .19, 'corinthian'); pillar.rotation.y = -Math.atan2(tangent.z, tangent.x);
  }
  for (const offset of [-2.0, 2.0]) {
    const points = Array.from({ length: 61 }, (_, i) => galleryOffset(curve, i / 60, offset, 5.78).toArray());
    balustrade(b, group, `${id}-gallery-${offset < 0 ? 'inner' : 'outer'}-upper-rail`, points, 1.05, .40);
  }
  b.flush(); return group;
}

function octagonalPavilion(b, parent, side) {
  const id = side < 0 ? 'west' : 'east', group = namedGroup(parent, `xieqiqu-${id}-octagonal-music-pavilion`, { body: 'complete-two-storey-octagonal-pavilion', evidence: 'south-engraving-and-2025-fig5; scale-inferred', storeys: 2 }); group.position.set(side * 38.1, 0, 30.4);
  const radius = 5.8, points = Array.from({ length: 8 }, (_, i) => [Math.sin(i / 8 * TAU + Math.PI / 8) * radius, Math.cos(i / 8 * TAU + Math.PI / 8) * radius]), faceWidth = 2 * radius * Math.sin(Math.PI / 8), apothem = radius * Math.cos(Math.PI / 8);
  b.polygon(group, points, -.05, .34, b.m.stone);
  b.polygon(group, points, 5.44, 5.78, b.m.stone);
  b.polygon(group, points, 10.62, 10.99, b.m.stone);
  for (let face = 0; face < 8; face++) {
    const a = face / 8 * TAU;
    elevation(b, group, `${id}-pavilion-lower-face-${face}`, [Math.sin(a) * apothem, .34, Math.cos(a) * apothem], a, faceWidth + .015, 5.10, [{ x: 0, b: .04, w: 1.79, h: 3.67, kind: 'passage' }], { material: b.m.stone, evidence: 'two-level-pavilion-in-south-engraving' });
    elevation(b, group, `${id}-pavilion-upper-face-${face}`, [Math.sin(a) * apothem, 5.78, Math.cos(a) * apothem], a, faceWidth + .015, 4.84, [{ x: 0, b: .73, w: 1.54, h: 2.72 }], { evidence: 'engraving-face-rhythm; rear-faces-symmetric-inference' });
    const edgeAngle = a + Math.PI / 8;
    column(b, group, `${id}-pavilion-lower-pier-${face}`, [Math.sin(edgeAngle) * radius, .34, Math.cos(edgeAngle) * radius], 5.10, .22, 'ionic');
    column(b, group, `${id}-pavilion-upper-pier-${face}`, [Math.sin(edgeAngle) * radius, 5.78, Math.cos(edgeAngle) * radius], 4.84, .20, 'ionic');
  }
  // An octagonal cover is authored as eight closed triangular slopes; its
  // tile finish shares the same restrained palette as the central hip roof.
  const roof = namedGroup(group, `${id}-pavilion-octagonal-tiled-roof`, { body: 'eight-sided-tiled-roof', evidence: HYPOTHESIS }), faces = [];
  for (let sideIndex = 0; sideIndex < 8; sideIndex++) {
    const next = (sideIndex + 1) % 8, a = points[sideIndex], c = points[next];
    const sample = (u, v) => V((a[0] + (c[0] - a[0]) * u) * v * 1.13, 11.12 + 2.80 * (1 - v) ** .89 + .22 * v ** 8, (a[1] + (c[1] - a[1]) * u) * v * 1.13);
    for (let i = 0; i < 18; i++) for (let j = 0; j < 20; j++) {
      const p = sample(j / 20, i / 18), q = sample((j + 1) / 20, i / 18), r = sample((j + 1) / 20, (i + 1) / 18), s = sample(j / 20, (i + 1) / 18);
      if (q.clone().sub(p).cross(r.clone().sub(p)).y < 0) faces.push([p, r, q], [p, s, r]); else faces.push([p, q, r], [p, r, s]);
    }
    const eave = Array.from({ length: 21 }, (_, i) => sample(i / 20, 1).toArray()); b.sweep(roof, eave, .22, .25, b.m.tileTrim, V(0, 1, 0), 22);
    for (let row = 1; row <= 17; row++) {
      const v = row / 18, m = Math.max(4, Math.floor(v * 21));
      for (let tile = 0; tile < m; tile++) {
        const points = Array.from({ length: 7 }, (_, j) => { const u = (tile + j / 6) / m, p = sample(u, v + Math.sin(j / 6 * Math.PI) * .017); p.y += .036; return p.toArray(); });
        b.sweep(roof, points, .050, .048, b.m.tileTrim, V(0, 1, 0), 6);
      }
    }
    const hip = Array.from({ length: 25 }, (_, i) => sample(0, i / 24).toArray()); b.sweep(roof, hip, .18, .23, b.m.tileTrim, V(0, 1, 0), 24);
  }
  b.add(roof, meshFromTriangles(faces), b.m.tile, undefined, undefined, undefined, true);
  b.polygon(roof, points.map(([x, z]) => [x * 1.13, z * 1.13]), 10.94, 11.12, b.m.timber);
  urn(b, roof, `${id}-pavilion-ridge-crown`, [0, 13.94, 0], .67);
  b.flush(); return group;
}

function frontCartouche(b, parent, name, position, size = 1) {
  const group = namedGroup(parent, name, { body: 'shell-and-foliage-cartouche', evidence: 'print-motif; relief-composition-authored' }); group.position.set(...position); group.scale.setScalar(size);
  const shape = new THREE.Shape(); shape.moveTo(-.77, 0); shape.bezierCurveTo(-1.08, .32, -.57, .54, -.53, .99); shape.bezierCurveTo(-.76, 1.23, -.47, 1.80, 0, 1.94); shape.bezierCurveTo(.47, 1.80, .76, 1.23, .53, .99); shape.bezierCurveTo(.57, .54, 1.08, .32, .77, 0); shape.closePath();
  b.shape(group, shape, [0, 0, 0], .24, b.m.carving, .052);
  b.shell(group, [0, .55, .24], 1.11, .94, .22);
  for (const side of [-1, 1]) { volute(b, group, side * .81, .31, .22, .70, -side); b.leaf(group, [side * .51, 1.34, .27], [.62, .95, .61], [0, 0, -side * .38]); }
  return group;
}

function southStair(b, parent, side) {
  const id = side < 0 ? 'west' : 'east', group = namedGroup(parent, `xieqiqu-south-${id}-curved-stair`, { body: 'solid-curved-grand-stair', evidence: 'curved-south-stair-supported; profile-proportional', riser: .17, steps: 34 });
  const path = new THREE.CubicBezierCurve3(V(side * 12.8, 0, 18.6), V(side * 13.5, 0, 13.5), V(side * 10.1, 0, 9.10), V(side * 4.35, 0, 9.65));
  const edge = (t, offset) => { const p = path.getPoint(t), tangent = path.getTangent(t), across = V(-tangent.z, 0, tangent.x).normalize(); return [p.x + across.x * offset, p.z + across.z * offset]; };
  for (let i = 0; i < 34; i++) b.polygon(group, [edge(i / 34, -1.48), edge(i / 34, 1.48), edge((i + 1) / 34, 1.48), edge((i + 1) / 34, -1.48)], -.02, (i + 1) * .17, b.m.stone);
  for (const offset of [-1.50, 1.50]) balustrade(b, group, `${id}-south-stair-${offset < 0 ? 'inner' : 'outer'}-rail`, Array.from({ length: 35 }, (_, i) => { const [x, z] = edge(i / 34, offset); return [x, Math.min(34, i + 1) * .17, z]; }), 1.03, .39);
  const point = path.getPoint(.010); b.contacts.push({ id: group.name, ground: 'xieqiqu-court-paving', point: [point.x, 0, point.z], firstTread: .17, underside: -.02 });
  return group;
}

function northStair(b, parent, side) {
  const id = side < 0 ? 'west' : 'east', group = namedGroup(parent, `xieqiqu-north-${id}-rectangular-stair`, { body: 'solid-straight-grand-stair', evidence: 'rectangular-north-stair-supported; profile-proportional', riser: .17, steps: 34 });
  for (let i = 0; i < 34; i++) b.box(group, b.m.stone, [side * (22.56 - (i + .5) * .34), (i + 1) * .17 / 2 - .01, -12.0], [.34, (i + 1) * .17 + .02, 3.40], 0);
  for (const z of [-13.70, -10.30]) balustrade(b, group, `${id}-north-stair-${z < -12 ? 'outer' : 'inner'}-rail`, [[side * 22.56, .17, z], [side * 11.0, 5.78, z]], 1.04, .38);
  b.contacts.push({ id: group.name, ground: 'xieqiqu-court-paving', point: [side * 22.40, 0, -12.0], firstTread: .17, underside: -.02 });
  return group;
}

function mainHall(b, root) {
  const group = namedGroup(root, 'xieqiqu-main-hall', { body: 'complete-three-storey-central-hall-and-side-wings', storeys: 3, timeLayer: '1859–1860-before-destruction', evidence: HYPOTHESIS, dimensions: { width: 30, depth: 16, measurementStatus: 'proportional-assumption' } });
  const fabric = namedGroup(group, 'xieqiqu-main-building-fabric', { body: 'complete-depth-masonry-building' });
  b.box(fabric, b.m.stone, [0, .145, 0], [30.5, .39, 16.4], .025);
  const lowerBays = [-11.1, -7.42, -3.71, 0, 3.71, 7.42, 11.1].map(x => ({ x, b: x === 0 ? .03 : .73, w: x === 0 ? 1.94 : 1.50, h: x === 0 ? 3.74 : 2.98, kind: x === 0 ? 'door' : 'glass', decorated: false }));
  elevation(b, fabric, 'main-south-ground-elevation', [0, .34, 8], 0, 30, 5.44, lowerBays, { rusticated: true, material: b.m.oldStone, evidence: 'south-engraving-ground-tier' });
  elevation(b, fabric, 'main-north-ground-elevation', [0, .34, -8], Math.PI, 30, 5.44, lowerBays, { rusticated: true, material: b.m.oldStone, evidence: 'north-engraving-ground-tier' });
  for (const side of [-1, 1]) {
    const galleryDoorX = -side * 3.8, sideBays = (side < 0 ? [-5.3, -1.77] : [1.77, 5.3]).map(x => ({ x, b: .73, w: 1.50, h: 2.98, decorated: false }));
    sideBays.push({ x: galleryDoorX, b: .02, w: 2.30, h: 4.14, kind: 'passage', decorated: false });
    elevation(b, fabric, `main-${side < 0 ? 'west' : 'east'}-ground-elevation`, [side * 15, .34, 0], side * Math.PI / 2, 16, 5.44, sideBays, { rusticated: true, material: b.m.oldStone });
  }
  b.box(fabric, b.m.paving, [0, 5.64, 0], [30, .28, 16], .015);
  const mainBays = [-11.1, -7.43, -3.85, 0, 3.85, 7.43, 11.1].map(x => ({ x, b: x === 0 ? .02 : .63, w: x === 0 ? 2.03 : 1.73, h: x === 0 ? 4.52 : 3.73, kind: x === 0 ? 'door' : 'glass' }));
  elevation(b, fabric, 'main-south-piano-nobile', [0, 5.78, 8], 0, 30, 5.57, mainBays, { evidence: 'south-engraving-principal-storey' });
  elevation(b, fabric, 'main-north-piano-nobile', [0, 5.78, -8], Math.PI, 30, 5.57, mainBays, { evidence: 'north-engraving-principal-storey' });
  for (const side of [-1, 1]) elevation(b, fabric, `main-${side < 0 ? 'west' : 'east'}-piano-nobile`, [side * 15, 5.78, 0], side * Math.PI / 2, 16, 5.57, [-5.4, -1.8, 1.8, 5.4].map(x => ({ x, b: .64, w: 1.75, h: 3.71 })), { evidence: 'side-symmetry-hypothesis' });
  b.box(fabric, b.m.timber, [0, 11.26, 0], [29.8, .18, 15.8], 0);
  const upper = namedGroup(group, 'xieqiqu-third-storey', { body: 'central-third-storey', evidence: 'south-and-north-engraving' });
  for (const [name, z, rotation] of [['south', 8, 0], ['north', -8, Math.PI]]) elevation(b, upper, `main-${name}-third-storey`, [0, 11.35, z], rotation, 14.5, 4.70, [-4.72, 0, 4.72].map(x => ({ x, b: .48, w: 1.79, h: 3.16 })), { evidence: `${name}-engraving-upper-storey` });
  for (const side of [-1, 1]) elevation(b, upper, `main-${side < 0 ? 'west' : 'east'}-third-storey`, [side * 7.25, 11.35, 0], side * Math.PI / 2, 16, 4.70, [-5.4, -1.8, 1.8, 5.4].map(x => ({ x, b: .52, w: 1.69, h: 3.08 })), { evidence: 'unseen-upper-side-symmetric-inference' });
  b.box(upper, b.m.timber, [0, 15.93, 0], [14.35, .23, 15.85], 0);
  for (const z of [-8.20, 8.20]) for (const x of [-14.57, -6.92, -2.04, 2.04, 6.92, 14.57]) column(b, group, `main-ionic-pier-${x}-${z}`, [x, 5.78, z], 5.57, Math.abs(x) < 3 ? .25 : .23, 'ionic');
  for (const z of [-8.15, 8.15]) for (const x of [-6.95, -2.22, 2.22, 6.95]) column(b, upper, `upper-ionic-pier-${x}-${z}`, [x, 11.35, z], 4.70, .21, 'ionic');
  const roof = namedGroup(group, 'xieqiqu-central-complete-roof', { body: 'complete-central-hip-roof', evidence: 'historical-hip-roof-silhouette; support-and-tile-colour-inferred' });
  b.box(roof, b.m.plaster, [0, 16.13, 0], [14.42, .32, 15.96], .020);
  tiledRoof(b, roof, 'main-fish-scale-hip-cover', [0, 0, 0], 16.15, 17.66, 16.35, 3.05);
  for (const [name, z, rotation] of [['south', 8.30, 0], ['north', -8.30, Math.PI]]) {
    const ornament = frontCartouche(b, group, `${name}-principal-door-tympanum`, [0, 10.32, z], .58); ornament.rotation.y = rotation;
    const crown = frontCartouche(b, group, `${name}-upper-central-cartouche`, [0, 14.84, z + (name === 'south' ? .02 : -.02)], .65); crown.rotation.y = rotation;
  }
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'west' : 'east', terrace = namedGroup(group, `${id}-wing-upper-terrace`, { body: 'balustraded-wing-roof-terrace', evidence: 'south-and-north-engravings' });
    b.box(terrace, b.m.paving, [side * 11.18, 11.41, 0], [7.88, .22, 16.21], .020);
    for (const z of [-8.00, 8.00]) balustrade(b, terrace, `${id}-wing-terrace-${z < 0 ? 'north' : 'south'}-rail`, [[side * 7.35, 11.52, z], [side * 15.02, 11.52, z]], 1.06);
    balustrade(b, terrace, `${id}-wing-terrace-outer-rail`, [[side * 15.02, 11.52, -8], [side * 15.02, 11.52, 8]], 1.06);
    for (const z of [-7.7, 0, 7.7]) urn(b, terrace, `${id}-wing-urn-${z}`, [side * 14.8, 12.55, z], .48);
  }
  const southTerrace = namedGroup(group, 'xieqiqu-south-overlook', { body: 'grand-stair-overlook-with-open-under-vaults' });
  const outline = [[-5.7, 7.5], [5.7, 7.5]];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; outline.push([Math.cos(a) * 5.7, 10.5 + Math.sin(a) * 2.05]); }
  b.polygon(southTerrace, outline, 5.39, 5.78, b.m.stone);
  elevation(b, southTerrace, 'south-overlook-vaulted-front', [0, .34, 11.73], 0, 8.88, 5.05, [-2.90, 0, 2.90].map(x => ({ x, b: .04, w: 1.76, h: 3.55, kind: 'passage', decorated: false })), { material: b.m.stone });
  for (const side of [-1, 1]) b.box(southTerrace, b.m.stone, [side * 5.21, 2.835, 9.55], [.65, 5.03, 3.1], .03);
  balustrade(b, southTerrace, 'south-overlook-curved-rail', outline.slice(2).map(([x, z]) => [x, 5.78, z]), 1.03);
  const northTerrace = namedGroup(group, 'xieqiqu-north-rectangular-terrace', { body: 'rectangular-north-terrace-and-vaults', evidence: 'north-engraving-and-2025-plan; undercroft-proportional' });
  b.box(northTerrace, b.m.stone, [0, 5.58, -12.0], [22, .4, 8], .025);
  elevation(b, northTerrace, 'north-terrace-vaulted-front', [0, .34, -16.0], Math.PI, 22, 5.04, [-7.35, 0, 7.35].map(x => ({ x, b: .02, w: 2.60, h: 3.68, kind: 'passage', decorated: false })), { material: b.m.stone });
  for (const side of [-1, 1]) elevation(b, northTerrace, `north-terrace-${side < 0 ? 'west' : 'east'}-side-wall`, [side * 11, .34, -12.0], side * Math.PI / 2, 8, 5.04, [{ x: 0, b: .02, w: 2.5, h: 3.68, kind: 'passage', decorated: false }], { material: b.m.stone });
  balustrade(b, northTerrace, 'north-terrace-front-balustrade', [[-11, 5.78, -16.0], [11, 5.78, -16.0]], 1.07);
  for (const side of [-1, 1]) { southStair(b, group, side); northStair(b, group, side); }
  b.openings.push({ id: 'south-principal-door', group: 'xieqiqu-main-building-fabric', origin: [.31, 7.09, 15], direction: [0, 0, -1], expectedCategory: 'timber' });
  b.openings.push({ id: 'north-upper-window', group: 'xieqiqu-third-storey', origin: [-4.54, 13.54, -18], direction: [0, 0, 1], expectedCategory: 'glass' });
  b.openings.push({ id: 'east-piano-nobile-window', group: 'xieqiqu-main-building-fabric', origin: [22, 8.2, -1.95], direction: [-1, 0, 0], expectedCategory: 'glass' });
  b.flush(); return group;
}

function rectangularElevation(b, parent, name, position, rotation, width, height, openings) {
  const group = namedGroup(parent, name, { body: 'rectangular-windowed-waterworks-elevation', evidence: 'reservoir-east-engraving; rear-and-side-layout-inferred' }); group.position.set(...position); group.rotation.y = rotation;
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(width / 2, height), new THREE.Vector2(-width / 2, height)]);
  for (const opening of openings) {
    const { x, b: y, w, h, door = false } = opening;
    shape.holes.push(new THREE.Path([new THREE.Vector2(x - w / 2, y), new THREE.Vector2(x + w / 2, y), new THREE.Vector2(x + w / 2, y + h), new THREE.Vector2(x - w / 2, y + h)]));
    const frame = namedGroup(group, `${name}-opening-${x}`, { body: door ? 'service-door' : 'service-window' });
    b.box(frame, door ? b.m.timber : b.m.glass, [x, y + h / 2, -.24], [w - .04, h - .04, .045], .008);
    for (const side of [-1, 1]) {
      b.box(frame, b.m.stone, [x + side * (w / 2 + .11), y + h / 2, .065], [.22, h + .40, .23], .026);
      b.box(frame, b.m.carving, [x + side * (w / 2 + .255), y + h / 2, .05], [.09, h + .64, .15], .018);
    }
    for (const borderY of [y - .10, y + h + .10]) b.box(frame, b.m.carving, [x, borderY, .09], [w + .55, .20, .30], .025);
    for (const offset of [-1, 0, 1]) b.box(frame, b.m.timber, [x + offset * w / 3.4, y + h / 2, -.13], [.045, h - .08, .07], .004);
    for (let row = 1; row <= 4; row++) b.box(frame, b.m.timber, [x, y + row * h / 5, -.13], [w - .08, .043, .07], .004);
    b.leaf(frame, [x, y + h + .35, .13], [.48, .43, .38], [0, 0, Math.PI]);
  }
  b.shape(group, shape, [0, 0, -.56], .56, b.m.brick, 0);
  cornice(b, group, 0, height - .18, 0, width + .08, .43, false);
  for (const side of [-1, 1]) b.box(group, b.m.stone, [side * (width / 2 - .20), height / 2, .04], [.28, height, .18], .020);
  return group;
}

function reservoir(b, root) {
  const group = namedGroup(root, 'xieqiqu-northwest-reservoir', { body: 'independent-xieqiqu-water-supply-building', facing: 'east', evidence: 'MIT-view03-and-park-location; dimensions-proportional', serves: 'xieqiqu-north-and-south-fountains', mechanism: 'not-reconstructed', notHaiyantangXihai: true }); group.position.set(-40.0, 0, -28.0); group.rotation.y = Math.PI / 2;
  const high = namedGroup(group, 'reservoir-two-storey-main-building', { body: 'complete-two-storey-service-building', storeys: 2 });
  b.box(high, b.m.stone, [0, .145, 0], [19.40, .39, 10.92], .024);
  const first = [-7.25, -3.65, 0, 3.65, 7.25].map(x => ({ x, b: x === 0 ? .04 : .85, w: x === 0 ? 1.89 : 1.50, h: x === 0 ? 3.55 : 2.71, door: x === 0 }));
  rectangularElevation(b, high, 'reservoir-east-ground-face', [0, .34, 5.3], 0, 19.0, 4.49, first);
  rectangularElevation(b, high, 'reservoir-west-ground-face-inferred', [0, .34, -5.3], Math.PI, 19.0, 4.49, first.map(opening => ({ ...opening, door: false })));
  b.box(high, b.m.timber, [0, 4.70, 0], [18.85, .26, 10.45], 0);
  const upper = [-7.35, -3.68, 0, 3.68, 7.35].map(x => ({ x, b: .75, w: 1.60, h: 2.75 }));
  rectangularElevation(b, high, 'reservoir-east-upper-face', [0, 4.83, 5.3], 0, 19.0, 4.55, upper);
  rectangularElevation(b, high, 'reservoir-west-upper-face-inferred', [0, 4.83, -5.3], Math.PI, 19.0, 4.55, upper);
  for (const side of [-1, 1]) for (const [y, height, label] of [[.34, 4.49, 'ground'], [4.83, 4.55, 'upper']]) rectangularElevation(b, high, `reservoir-${side < 0 ? 'south' : 'north'}-${label}-face`, [side * 9.5, y, 0], side * Math.PI / 2, 10.60, height, [-3.2, 0, 3.2].map(x => ({ x, b: .83, w: 1.35, h: 2.66 })));
  b.box(high, b.m.plaster, [0, 9.40, 0], [18.92, .42, 10.51], .020);
  tiledRoof(b, high, 'reservoir-main-tile-roof', [0, 0, 0], 20.20, 11.82, 9.65, 2.29);
  const annex = namedGroup(group, 'reservoir-north-low-service-annex', { body: 'low-service-annex-with-roof-balustrade', evidence: 'north-side-low-wing-visible-at-right-of-east-print; function-within-annex-unresolved' });
  b.box(annex, b.m.stone, [15.0, .145, 0], [11.1, .39, 10.8], .020);
  rectangularElevation(b, annex, 'reservoir-annex-east-face', [15, .34, 5.3], 0, 11.0, 4.49, [-3.7, 0, 3.7].map(x => ({ x, b: .83, w: 1.52, h: 2.77 })));
  rectangularElevation(b, annex, 'reservoir-annex-west-face', [15, .34, -5.3], Math.PI, 11.0, 4.49, [-3.7, 0, 3.7].map(x => ({ x, b: .83, w: 1.52, h: 2.77 })));
  rectangularElevation(b, annex, 'reservoir-annex-north-face', [20.5, .34, 0], Math.PI / 2, 10.6, 4.49, [-3.3, 0, 3.3].map(x => ({ x, b: .83, w: 1.40, h: 2.72 })));
  b.box(annex, b.m.paving, [15.0, 4.77, 0], [11.05, .28, 10.85], .024);
  for (const z of [-5.2, 5.2]) balustrade(b, annex, `reservoir-low-annex-${z < 0 ? 'west' : 'east'}-roof-rail`, [[9.8, 4.91, z], [20.3, 4.91, z]], .86, .39);
  balustrade(b, annex, 'reservoir-annex-north-roof-rail', [[20.3, 4.91, -5.2], [20.3, 4.91, 5.2]], .86, .39);
  for (const x of [11.0, 15.0, 19.0]) urn(b, annex, `reservoir-annex-roof-urn-${x}`, [x, 5.8, 4.90], .42);
  const entry = namedGroup(group, 'reservoir-east-entry-steps', { body: 'solid-service-entry-steps' });
  b.box(entry, b.m.stone, [0, .085, 6.02], [3.50, .17, .65], .020); b.box(entry, b.m.stone, [0, .17, 5.66], [3.20, .34, .44], .020);
  b.openings.push({ id: 'reservoir-east-upper-glazing', group: 'xieqiqu-northwest-reservoir', origin: [-28, 7.02, -28.16], direction: [-1, 0, 0], expectedCategory: 'glass' });
  b.flush(); return group;
}

function flowerBasin(b, parent, name, kind, x, z, rx, rz) {
  const group = namedGroup(parent, name, { body: `${kind}-shaped-stone-fountain-pool`, flower: kind, waterY: .13, bottomY: -.45, rimY: .56, dimensionsEvidence: HYPOTHESIS });
  const outer = flowerOutline(kind, x, z, rx, rz), inner = outer.map(([px, pz]) => [x + (px - x) * .957, z + (pz - z) * .957]);
  b.polygon(group, outer, -.60, .43, b.m.oldStone, [inner]); b.polygon(group, inner, -.61, -.45, b.m.wetStone); b.polygon(group, inner, .114, .13, b.m.water);
  b.sweep(group, [...outer, outer[0]].map(([px, pz]) => [px, .45, pz]), .36, .22, b.m.carving, V(0, 1, 0), outer.length * 2);
  return group;
}

function fountainBowl(b, parent, name, position, radius, height) {
  const group = namedGroup(parent, name, { body: 'closed-carved-overflow-bowl', waterLevelLocal: height * 1.06 }); group.position.set(...position);
  b.lathe(group, [[0, -.14], [.24, -.14], [radius * .35, -.03], [radius * .75, height * .48], [radius, height * .88], [radius * 1.04, height], [radius * .97, height * 1.06], [radius * .87, height * .94], [radius * .70, height * .46], [radius * .30, .05], [.03, .01]], [0, 0, 0], b.m.carving, [1, 1, 1], 48);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; b.leaf(group, [Math.sin(a) * radius * .71, height * .44, Math.cos(a) * radius * .71], [.32, .69, .39], [0, a, 0]); }
  b.add(group, new THREE.CylinderGeometry(radius * .96, radius * .96, .014, 64), b.m.water, [0, height * 1.06 - .007, 0], undefined, undefined, true);
  return group;
}

function sculptureEyes(b, parent, y, z, spread, material = b.m.copperRecess) {
  for (const side of [-1, 1]) {
    b.add(parent, b.prototype('sculpture-eye', () => new THREE.SphereGeometry(1, 12, 8)), material, [side * spread, y, z], [.024, .026, .034]);
    b.sweep(parent, [[side * (spread + .01), y - .02, z - .015], [side * (spread + .025), y + .026, z], [side * spread, y + .025, z + .038]], .028, .022, b.m.carving, V(side, 0, 0), 8);
  }
}

function stoneFish(b, parent, index, position, rotation, size = 1) {
  const group = namedGroup(parent, `xieqiqu-south-upturned-stone-fish-${index}`, { body: 'western-upturned-tail-stone-fish', evidence: 'park-identifies-surviving-upturned-stone-fish; exact-pose-and-size-authored' }); group.position.set(...position); group.rotation.y = rotation; group.scale.setScalar(size);
  const body = namedGroup(group, `${group.name}-body`, { body: 'continuous-carved-fish-body-and-fins' });
  b.loft(body, [[0, 1.00, 1.14, .15, .17], [0, 1.04, .78, .33, .31], [0, 1.16, .27, .42, .44], [0, 1.37, -.34, .31, .46], [0, 1.85, -.70, .21, .32], [0, 2.30, -.73, .15, .21], [0, 2.59, -.63, .071, .10]], b.m.carving, 26, 42, .025);
  // A curved, open mouth and thick flukes preserve the historical fish's
  // sculptural silhouette; the mesh is neither a generic cone nor a fish decal.
  b.add(body, ringGeometry(.185, .113, 0, .12, 40), b.m.carving, [0, .96, 1.13], [1.26, 1, .80], [Math.PI / 2, 0, 0], true);
  b.loft(body, [[0, .82, .66, .19, .09], [0, .79, .92, .17, .083], [0, .82, 1.18, .10, .049]], b.m.carving, 18, 18);
  for (const side of [-1, 1]) {
    const tail = new THREE.Shape(); tail.moveTo(0, -.12); tail.bezierCurveTo(side * .18, .30, side * .67, .55, side * .90, .26); tail.bezierCurveTo(side * .64, .08, side * .82, -.11, side * .51, -.22); tail.bezierCurveTo(side * .20, -.31, side * .17, -.18, 0, -.12); tail.closePath();
    b.shape(body, tail, [0, 2.63, -.69], .14, b.m.carving, .046, [0, side * -.24, 0]);
    b.leaf(body, [side * .31, 1.20, .05], [.80, .95, .64], [0, side * 1.17, side * -.72], 'acanthus', b.m.carving);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      const x = side * (.34 - row * .032), y = 1.08 + col * .15 + row * .055, z = .33 - row * .19;
      b.leaf(body, [x, y, z], [.19, .26, .21], [0, side * Math.PI / 2, .55], 'acanthus', b.m.carving);
    }
  }
  sculptureEyes(b, body, 1.22, .70, .278, b.m.oldStone);
  stoneFishMount(b, group, position, size);
  return group;
}

// The default path is the original full-study mount and jet, byte-identical
// construction inputs. Only the independent pool candidate supplies a seat.
function stoneFishMount(b, group, position, size, {seatGeometry, waveCeiling} = {}) {
  const plinth = namedGroup(group, `${group.name}-wave-plinth`, { body: 'wave-carved-stone-support' });
  const supportBottom = (-.45 - position[1]) / size;
  b.box(plinth, b.m.wetStone, [0, (supportBottom + .30) / 2, .05], [1.30, .30 - supportBottom, 2.30], .07);
  const waves = seatGeometry ? namedGroup(plinth, `${group.name}-low-wave-carving`, {body:'original-wave-decoration-lowered-below-actual-fish-belly',evidence:'candidate-assembly-adaptation-not-historical-survey'}) : plinth;
  b.loft(waves, [[0, .21, .06, .31, .24], [.1, .50, -.15, .30, .28], [0, .83, -.23, .22, .22], [0, 1.13, -.20, .14, .22]], b.m.carving, 18, 24, .06);
  for (const side of [-1, 1]) b.sweep(waves, [[side * .49, .15, .96], [side * .53, .49, .52], [side * .33, .65, -.17], [side * .38, .92, -.64]], .30, .32, b.m.carving, V(side, 0, 0), 26);
  if (seatGeometry) {
    if (!seatGeometry.isBufferGeometry || !Number.isFinite(waveCeiling) || waveCeiling <= .30) throw new Error('A real fish-belly seat and safe wave ceiling are required');
    b.flush();const bounds=new THREE.Box3();waves.traverse(node=>{if(node.isMesh){node.geometry.computeBoundingBox();bounds.union(node.geometry.boundingBox);}});
    if(bounds.isEmpty()||bounds.max.y<=.12)throw new Error('The original carved wave has invalid bounds');
    waves.scale.y=(waveCeiling-.12)/(bounds.max.y-.12);waves.position.y=.12*(1-waves.scale.y);
    waves.userData.fit={originalLocalMaximumY:bounds.max.y,localMaximumY:waveCeiling,scaleY:waves.scale.y};
    const seat=new THREE.Mesh(seatGeometry,b.m.carving);seat.name=`${group.name}-fitted-belly-seat`;seat.castShadow=seat.receiveShadow=true;seat.userData={body:'stone-saddle-from-actual-fish-belly-triangles',geometryOwnership:'borrowed-from-pool-owner',evidence:'authored-support-adaptation'};plinth.add(seat);
  }
  const flow = namedGroup(group, `${group.name}-water`, { body: 'illustrative-fish-mouth-jet' });
  b.waterArc(flow, [[0, .96, 1.25], [0, 1.53, 2.1], [0, 1.02, 3.0], [0, (.13 - position[1]) / size, 3.9]], .027, `${group.name}-jet`, 'xieqiqu-south-haitang-pool');
  return {plinth,flow};
}

export const xieqiquStoneFishPlacements=Object.freeze([
  {index:1,position:[-9,.14,28.15],rotationY:1.25,size:1},
  {index:2,position:[9,.14,28.15],rotationY:-1.25,size:1},
  {index:3,position:[-4.05,.14,32.45],rotationY:Math.PI+(-.35),size:.72},
  {index:4,position:[4.05,.14,32.45],rotationY:Math.PI+.35,size:.72},
].map(p=>Object.freeze({...p,position:Object.freeze(p.position)})));

/** Bounded source context: the original south basin and four supports/jets.
 * No architecture or animal geometry is constructed. The optional seat stays
 * borrowed; the caller releases it after this context. */
export function createXieqiquSouthPoolContextStudy({seatGeometry,waveCeiling,signal}={}) {
  signal?.throwIfAborted();const b=new AssetBuilder(),group=new THREE.Group(),mounts=[];group.name='xieqiqu-south-pool-study-context';
  group.userData={assetId:'xieqiqu-south-pool-context',allDimensionsProportional:true,visualAcceptance:false};
  const dispose=()=>{
    if(b.disposed)return;b.disposed=true;const errors=[],resources=new Set([...b.prototypes.values(),...b.geometries,...b.materials,...b.textures]);
    for(const pending of b.pending.values())for(const part of pending.parts)resources.add(part);b.pending.clear();b.prototypes.clear();b.geometries.clear();b.materials.clear();b.textures.clear();
    for(const resource of resources)try{resource.dispose();}catch(error){errors.push(error);}group.clear();mounts.length=0;
    if(errors.length)throw new AggregateError(errors,'South pool context cleanup failed');
  };
  try {
    const fountain=namedGroup(group,'xieqiqu-south-fountain',{body:'south-haitang-pool-context',evidence:HYPOTHESIS});
    flowerBasin(b,fountain,'xieqiqu-south-haitang-pool','haitang',0,26,13,8.5);
    const animals=namedGroup(fountain,'south-fountain-animal-sculptures',{body:'four-stone-fish-review-slots',countEvidence:HYPOTHESIS});
    for(const placement of xieqiquStoneFishPlacements){
      signal?.throwIfAborted();const mount=namedGroup(animals,`xieqiqu-south-upturned-stone-fish-${placement.index}`,{body:'western-upturned-tail-stone-fish',evidence:HYPOTHESIS});mount.position.set(...placement.position);mount.rotation.y=placement.rotationY;mount.scale.setScalar(placement.size);
      const body=namedGroup(mount,`${mount.name}-body`,{body:'continuous-carved-fish-replacement-slot'});
      const support=stoneFishMount(b,mount,placement.position,placement.size,{seatGeometry,waveCeiling});mounts.push({placement,group:mount,body,...support});
    }
    const floor=namedGroup(group,'xieqiqu-south-pool-cropped-court',{body:'local-paving-with-real-pool-void',top:0,evidence:'original-pool-profile-and-paving-pattern; authored-review-crop'}),hole=flowerOutline('haitang',0,26,13,8.5);
    b.polygon(floor,[[-18,14],[18,14],[18,39],[-18,39]],-.65,0,b.m.paving,[hole]);
    for(let z=-50.1;z<38.5;z+=1.47)if(z>14.5)for(const [a,c] of cutPaving([hole],z,true,-17.5,17.5))b.box(floor,b.m.oldStone,[(a+c)/2,.003,z],[c-a,.010,.016],0);
    for(let x=-51.2;x<17.5;x+=1.47)if(x>-17.5)for(const [a,c] of cutPaving([hole],x,false,14.5,38.5))b.box(floor,b.m.oldStone,[x,.003,(a+c)/2],[.016,.010,c-a],0);
    b.flush();b.releasePrototypes();signal?.throwIfAborted();group.updateMatrixWorld(true);
    const used=new Set(),textures=new Set();let triangles=0,meshes=0;group.traverse(node=>{if(!node.isMesh)return;meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;used.add(node.material);for(const value of Object.values(node.material))if(value?.isTexture)textures.add(value);});
    for(const material of b.materials)if(!used.has(material)){material.dispose();b.materials.delete(material);}for(const texture of b.textures)if(!textures.has(texture)){texture.dispose();b.textures.delete(texture);}
    const bounds=new THREE.Box3().setFromObject(group),diagnostics={assetId:'xieqiqu-south-pool-context',triangles,meshCount:meshes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},waterEndpoints:b.waterEndpoints.map(p=>({...p})),historicalDimensionsVerified:false,visualAcceptance:false,archiveCompatible:false,sourceScope:'original south basin, four mounts/jets and a cropped court; no architecture, central fountain or copper animals',groundY:-.68,resourceOwnership:{geometries:b.geometries.size,materials:b.materials.size,textures:b.textures.size,borrowedSeat:!!seatGeometry}};
    return {group,mounts,diagnostics,update(time){if(!b.disposed)b.water.update(time);},get disposed(){return b.disposed;},dispose};
  }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'South pool context construction failed',{cause:error});}throw error;}
}

function copperSheep(b, parent, index, position, rotation, includeWater = true) {
  const group = namedGroup(parent, `xieqiqu-south-copper-sheep-${index}`, { body: 'copper-sheep-fountain-sculpture', evidence: 'copper-sheep-type-supported; ram-horns-pose-count-and-anatomy-inferred' }); group.position.set(...position); group.rotation.y = rotation;
  const body = namedGroup(group, `${group.name}-body`, { body: 'standing-sheep-with-curled-horns' });
  body.userData.construction = 'continuous-head-neck-chest-and-limb-skin; separately-cast-detail-forms';
  body.userData.mouthAnchor = [...copperSheepMouth];
  for (const part of copperSheepComponentSpecs) {
    const detail = namedGroup(body, `${body.name}-${part.id}`, { body: part.id, evidence: 'copper-sheep-type-supported; anatomical-sculpting-inferred' });
    const geometry = b.prototype(`copper-sheep-r4-${part.id}`, part.create);
    detail.userData.geometryAuthoring = structuredClone(geometry.userData);
    b.add(detail, geometry, b.m[part.role]);
  }
  if (!includeWater) return group;
  const water = namedGroup(group, `${group.name}-water`, { body: 'illustrative-sheep-mouth-jet' });
  b.waterArc(water, [[0, 1.30, 1.235], [0, 1.90, 1.89], [0, 1.11, 2.53], [0, .13 - position[1], 3.00]], .020, `${group.name}-jet`, 'xieqiqu-south-haitang-pool');
  return group;
}

// Bounded review entry: actual source copper materials and the same sculptural
// path as the complete asset, with no building, pool, terrain or water geometry.
export function createXieqiquCopperSheepStudy() {
  const b = new AssetBuilder(), group = new THREE.Group(); group.name = 'xieqiqu-copper-sheep-r4-study';
  group.userData = { assetId: 'xieqiqu-copper-sheep-r4', evidence: 'type-supported; anatomy-pose-and-dimensions-inferred', visualAcceptance: false };
  try {
    copperSheep(b, group, 1, [0,0,0], 0, false); b.flush(); b.releasePrototypes(); group.updateMatrixWorld(true);
    const geometries=new Set(),materials=new Set(),textures=new Set();let triangleCount=0,meshCount=0;
    group.traverse(node=>{if(!node.isMesh)return;meshCount++;geometries.add(node.geometry);triangleCount+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;for(const material of [].concat(node.material)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    for(const material of b.materials)if(!materials.has(material)){material.dispose();b.materials.delete(material);}for(const texture of b.textures)if(!textures.has(texture)){texture.dispose();b.textures.delete(texture);}
    const box=new THREE.Box3().setFromObject(group),diagnostics={assetId:'xieqiqu-copper-sheep-r4',sculpting:structuredClone(group.getObjectByName('xieqiqu-south-copper-sheep-1-body-continuous-anatomy').userData.geometryAuthoring),triangles:triangleCount,triangleCount,meshCount,bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},mouthAnchor:[...copperSheepMouth],resourceOwnership:{geometries:geometries.size,materials:materials.size,textures:textures.size,moduleGlobalCache:false,disposalIsIdempotent:true},visualAcceptance:false,integrationAcceptance:false,sourceLimitations:['Copper sheep are identified by the park; horn anatomy, musculature, pose and exact dimensions remain authored interpretations.']};
    if(triangleCount>1450000)throw new Error('Independent copper sheep exceeds the explicit R4 1450000 triangle ceiling');
    return {group,diagnostics,dispose(){if(b.disposed)return;b.dispose();group.clear();}};
  } catch(error){b.dispose();group.clear();throw error;}
}

function copperSwallow(b, parent, name, position, rotation, basinId) {
  const group = namedGroup(parent, name, { body: 'copper-swallow-fountain-sculpture', evidence: 'park-identifies-copper-swallows; anatomy-pose-and-count-inferred' }); group.position.set(...position); group.rotation.y = rotation;
  const body = namedGroup(group, `${name}-body`, { body: 'swallow-with-swept-wings-and-forked-tail' });
  for (const side of [-1, 1]) {
    b.loft(body, [[side * .055, .05, 0, .015, .017], [side * .055, .24, .045, .013, .015], [side * .057, .41, .06, .021, .025]], b.m.copper, 9, 13);
    b.box(body, b.m.copper, [side * .055, .02, .06], [.048, .04, .20], .010);
    const wing = new THREE.Shape(); wing.moveTo(0, .10); wing.bezierCurveTo(side * .44, .24, side * .92, -.05, side * 1.10, -.64); wing.lineTo(side * .80, -.49); wing.lineTo(side * .57, -.48); wing.bezierCurveTo(side * .35, -.37, side * .12, -.23, 0, -.25); wing.closePath();
    b.shape(body, wing, [0, .53, 0], .065, b.m.copper, .020, [Math.PI / 2, 0, 0]);
    for (let feather = 0; feather < 4; feather++) b.loft(body, [[side * (.19 + feather * .055), .55, -.14 - feather * .025, .018, .030], [side * (.66 + feather * .075), .56, -.39 - feather * .055, .023, .039], [side * (.83 + feather * .065), .56, -.48 - feather * .045, .008, .01]], b.m.copper, 9, 15);
    b.loft(body, [[side * .043, .45, -.31, .047, .021], [side * .13, .44, -.68, .039, .018], [side * .19, .46, -.98, .008, .008]], b.m.copper, 11, 18);
  }
  b.loft(body, [[0, .45, -.38, .043, .061], [0, .49, -.17, .125, .145], [0, .52, .10, .126, .14], [0, .60, .30, .084, .089], [0, .60, .41, .046, .05]], b.m.copper, 20, 23);
  b.loft(body, [[0, .615, .40, .042, .025], [0, .604, .57, .013, .007]], b.m.copper, 11, 10);
  b.loft(body, [[0, .575, .405, .037, .012], [0, .571, .57, .012, .005]], b.m.copper, 11, 10);
  const mouth = namedGroup(body, `${name}-open-beak-spout`, { body: 'hollow-copper-mouth-between-upper-and-lower-bill' });
  b.add(mouth, ringGeometry(.015, .006, 0, .018, 20), b.m.copper, [0, .587, .561], undefined, [Math.PI / 2, 0, 0], true);
  for (const side of [-1, 1]) b.add(body, b.prototype('sculpture-eye', () => new THREE.SphereGeometry(1, 12, 8)), b.m.copperRecess, [side * .071, .633, .337], [.012, .014, .016]);
  const water = namedGroup(group, `${name}-water`, { body: 'illustrative-swallow-beak-jet' });
  b.waterArc(water, [[0, .587, .579], [0, 1.12, 1.00], [0, .72, 1.63], [0, .13 - position[1], 2.35]], .012, `${name}-jet`, basinId);
  return group;
}

function southFountain(b, root) {
  const group = namedGroup(root, 'xieqiqu-south-fountain', { body: 'large-haitang-fountain-with-copper-animals-and-stone-fish', evidence: 'south-engraving-and-park-description', sculpturalCountEvidence: HYPOTHESIS });
  flowerBasin(b, group, 'xieqiqu-south-haitang-pool', 'haitang', 0, 26.0, 13.0, 8.50);
  const centre = namedGroup(group, 'south-central-sculpted-fountain', { body: 'ornamental-central-water-standard', evidence: 'south-engraving-motif; sculptural-profile-inferred' }); centre.position.set(0, 0, 25.8);
  b.lathe(centre, [[2.20, -.60], [2.20, .25], [2.02, .44], [1.74, .63], [1.58, .81], [1.47, 1.01], [1.55, 1.13], [1.33, 1.29]], [0, 0, 0], b.m.wetStone, [1, 1, 1], 64);
  b.lathe(centre, [[.88, 1.15], [.98, 1.34], [.67, 1.59], [.46, 1.86], [.68, 2.13], [.94, 2.31], [.93, 2.43], [.69, 2.62], [.45, 2.87], [.33, 3.20], [.43, 3.43]], [0, 0, 0], b.m.carving, [1, 1, 1], 40);
  fountainBowl(b, centre, 'south-upper-sculpted-bowl', [0, 3.50, 0], 1.42, .57);
  b.lathe(centre, [[.17, 4.07], [.26, 4.31], [.13, 4.50], [.18, 4.75], [.05, 5.03]], [0, 0, 0], b.m.copper);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    b.leaf(centre, [Math.sin(a) * .68, 2.38, Math.cos(a) * .68], [.42, .93, .52], [0, a, 0]);
  }
  const flow = namedGroup(centre, 'south-central-fountain-water', { body: 'illustrative-plume-and-bowl-overflows' });
  b.waterArc(flow, [[0, 5.03, 0], [0, 7.04, .10], [0, 6.07, .34], [0, 4.1042, .58]], .040, 'south-central-rise', 'south-upper-sculpted-bowl');
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, r = 1.42 * .96;
    b.waterArc(flow, [[Math.sin(a) * r, 4.1042, Math.cos(a) * r], [Math.sin(a) * 1.59, 3.60, Math.cos(a) * 1.59], [Math.sin(a) * 2.26, 1.83, Math.cos(a) * 2.26], [Math.sin(a) * 3.01, .13, Math.cos(a) * 3.01]], .023, `south-bowl-overflow-${i}`, 'xieqiqu-south-haitang-pool');
  }
  const animals = namedGroup(group, 'south-fountain-animal-sculptures', { body: 'fish-sheep-and-swallows', typeEvidence: 'park-description', countEvidence: HYPOTHESIS });
  for (const side of [-1, 1]) {
    const stone = namedGroup(animals, `south-sheep-plinth-${side}`, { body: 'stone-plinth-for-copper-sheep' });
    b.box(stone, b.m.wetStone, [side * 4.90, -.145, 24.5], [1.55, 1.03, 2.78], .055);
    copperSheep(b, animals, side < 0 ? 1 : 2, [side * 4.90, .37, 24.5], side < 0 ? .95 : -.95);
    stoneFish(b, animals, side < 0 ? 1 : 2, [side * 9.0, .14, 28.15], side < 0 ? 1.25 : -1.25, 1.0);
    stoneFish(b, animals, side < 0 ? 3 : 4, [side * 4.05, .14, 32.45], Math.PI + (side < 0 ? -.35 : .35), .72);
    const plinth = namedGroup(animals, `south-swallow-stem-${side}`, { body: 'copper-bird-pedestal' });
    b.lathe(plinth, [[.31, -.60], [.38, .18], [.27, .40], [.18, .68], [.25, .89], [.18, 1.10]], [side * 6.4, 0, 19.65], b.m.carving);
    b.add(plinth, new THREE.CylinderGeometry(.18, .18, .045, 28), b.m.carving, [side * 6.4, 1.0775, 19.65], undefined, undefined, true);
    copperSwallow(b, animals, `xieqiqu-south-copper-swallow-${side < 0 ? 1 : 2}`, [side * 6.4, 1.10, 19.65], side < 0 ? .54 : -.54, 'xieqiqu-south-haitang-pool');
  }
  const perimeterJets = namedGroup(group, 'south-pool-small-perimeter-jets', { body: 'illustrative-rim-jets', countEvidence: HYPOTHESIS });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + (i === 3 ? -Math.PI / 24 : i === 13 ? Math.PI / 24 : 0), x = Math.sin(a) * 10.0, z = 26 + Math.cos(a) * 6.65;
    b.lathe(perimeterJets, [[.14, -.45], [.14, .20], [.065, .38]], [x, 0, z], b.m.copper, [1, 1, 1], 14);
    b.waterArc(perimeterJets, [[x, .39, z], [x * .97, 1.20, 26 + (z - 26) * .97], [x * .90, .91, 26 + (z - 26) * .90], [x * .85, .13, 26 + (z - 26) * .85]], .018, `south-perimeter-${i}`, 'xieqiqu-south-haitang-pool');
  }
  b.flush(); return group;
}

function northFountain(b, root) {
  const group = namedGroup(root, 'xieqiqu-north-fountain', { body: 'smaller-chrysanthemum-fountain', evidence: 'north-engraving-and-park-description', dimensionsEvidence: HYPOTHESIS });
  flowerBasin(b, group, 'xieqiqu-north-chrysanthemum-pool', 'chrysanthemum', 0, -27.0, 4.8, 4.8);
  const centre = namedGroup(group, 'north-sculpted-fountain-standard', { body: 'tiered-floral-fountain-standard', evidence: 'north-print-motif; detailed-profile-inferred' }); centre.position.z = -27.0;
  b.lathe(centre, [[1.70, -.60], [1.70, .21], [1.55, .38], [1.60, .53], [1.31, .73], [1.25, .91], [1.37, 1.02], [1.17, 1.20]], [0, 0, 0], b.m.stone, [1, 1, 1], 64);
  b.lathe(centre, [[.63, 1.16], [.72, 1.34], [.49, 1.65], [.40, 1.91], [.57, 2.17], [.48, 2.43]], [0, 0, 0], b.m.carving, [1, 1, 1], 36);
  fountainBowl(b, centre, 'north-lower-carved-bowl', [0, 2.40, 0], 1.30, .46);
  b.lathe(centre, [[.18, 2.8876], [.24, 3.09], [.12, 3.33], [.20, 3.56], [.16, 3.75]], [0, 0, 0], b.m.copper);
  fountainBowl(b, centre, 'north-upper-carved-bowl', [0, 3.76, 0], .72, .34);
  b.lathe(centre, [[.09, 4.1204], [.13, 4.36], [.07, 4.56], [.022, 4.71]], [0, 0, 0], b.m.copper, [1, 1, 1], 20);
  const flow = namedGroup(centre, 'north-central-cascade-water', { body: 'illustrative-tiered-plume-and-cascade' });
  b.waterArc(flow, [[0, 4.71, 0], [0, 6.10, .03], [0, 5.42, .24], [0, 4.1204, .40]], .031, 'north-central-rise', 'north-upper-carved-bowl');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    b.waterArc(flow, [[Math.sin(a) * .72 * .96, 4.1204, Math.cos(a) * .72 * .96], [Math.sin(a) * .76, 3.81, Math.cos(a) * .76], [Math.sin(a) * .81, 3.31, Math.cos(a) * .81], [Math.sin(a) * .85, 2.8876, Math.cos(a) * .85]], .015, `north-upper-overflow-${i}`, 'north-lower-carved-bowl');
    b.waterArc(flow, [[Math.sin(a) * 1.30 * .96, 2.8876, Math.cos(a) * 1.30 * .96], [Math.sin(a) * 1.50, 2.51, Math.cos(a) * 1.50], [Math.sin(a) * 1.92, 1.21, Math.cos(a) * 1.92], [Math.sin(a) * 2.26, .13, Math.cos(a) * 2.26]], .020, `north-lower-overflow-${i}`, 'xieqiqu-north-chrysanthemum-pool');
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU, x = Math.sin(a) * 3.1, z = -27 + Math.cos(a) * 3.1;
    const base = namedGroup(group, `north-small-spout-pedestal-${i}`, { body: 'floral-shell-spout-and-stone-pedestal' });
    b.lathe(base, [[.23, -.60], [.31, .18], [.21, .31], [.18, .55]], [x, 0, z], b.m.carving, [1, 1, 1], 20);
    // Floral spouts are kept distinct from the documented south-pool animals.
    b.shell(base, [x, .39, z], .56, .69, .10, b.m.carving, [0, a + Math.PI, 0]);
    const targetX = x * .68, targetZ = -27 + (z + 27) * .68;
    b.waterArc(base, [[x, .75, z], [(x + targetX) / 2, 1.32, (z + targetZ) / 2], [targetX, .13, targetZ]], .016, `north-floral-spout-${i}`, 'xieqiqu-north-chrysanthemum-pool');
  }
  b.flush(); return group;
}

function cutPaving(holes, ordinate, horizontal, lo, hi) {
  const blocked = [];
  for (const points of holes) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], c = points[(i + 1) % points.length], ai = horizontal ? a[1] : a[0], ci = horizontal ? c[1] : c[0];
      if ((ai <= ordinate && ci > ordinate) || (ci <= ordinate && ai > ordinate)) crossings.push((horizontal ? a[0] : a[1]) + (ordinate - ai) / (ci - ai) * ((horizontal ? c[0] : c[1]) - (horizontal ? a[0] : a[1])));
    }
    crossings.sort((a, c) => a - c); for (let i = 0; i + 1 < crossings.length; i += 2) blocked.push([crossings[i] - .20, crossings[i + 1] + .20]);
  }
  blocked.sort((a, c) => a[0] - c[0]); let start = lo; const result = [];
  for (const [a, c] of [...blocked, [hi, hi]]) { if (a > start + .02) result.push([start, Math.min(a, hi)]); start = Math.max(start, c); }
  return result.filter(([a, c]) => c > a + .02);
}

function setting(b, root) {
  const group = namedGroup(root, 'xieqiqu-study-setting', { body: 'garden-floor-and-cropped-south-lake-edge', evidence: 'source-view-topology; dimensions-and-crop-are-exhibition-design' });
  const holes = [flowerOutline('haitang', 0, 26, 13, 8.5), flowerOutline('chrysanthemum', 0, -27, 4.8, 4.8)];
  const paving = namedGroup(group, 'xieqiqu-court-paving', { body: 'paving-with-two-open-flower-pool-voids', top: 0 });
  b.polygon(paving, [[-52, -51], [52, -51], [52, 40.75], [-52, 40.75]], -.65, 0, b.m.paving, holes);
  const joints = namedGroup(group, 'xieqiqu-court-stone-joints', { body: 'paving-joints-clipped-away-from-both-pools' });
  for (let z = -50.1; z < 40.2; z += 1.47) for (const [a, c] of cutPaving(holes, z, true, -51.5, 51.5)) b.box(joints, b.m.oldStone, [(a + c) / 2, .003, z], [c - a, .010, .016], 0);
  for (let x = -51.2; x < 51.7; x += 1.47) for (const [a, c] of cutPaving(holes, x, false, -50.5, 40.25)) b.box(joints, b.m.oldStone, [x, .003, (a + c) / 2], [.016, .01, c - a], 0);
  const northPoolWalk = namedGroup(group, 'north-pool-concentric-paving', { body: 'chrysanthemum-pool-walking-ring', evidence: 'north-view-circular-foreground-paving; scale-proportional' });
  for (const radius of [6.35, 7.45, 8.00]) {
    const points = Array.from({ length: 97 }, (_, i) => [Math.sin(i / 96 * TAU) * radius, .021, -27 + Math.cos(i / 96 * TAU) * radius]);
    b.sweep(northPoolWalk, points, .15, .035, b.m.carving, V(0, 1, 0), 96);
  }
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU;
    b.sweep(northPoolWalk, [[Math.sin(a) * 6.38, .02, -27 + Math.cos(a) * 6.38], [Math.sin(a) * 7.95, .02, -27 + Math.cos(a) * 7.95]], .04, .025, b.m.oldStone, V(0, 1, 0), 1);
  }
  const lake = namedGroup(group, 'xieqiqu-south-lake-foreground', { body: 'cropped-lake-foreground', evidence: 'lake-visible-in-south-engraving; this-local-outline-and-depth-are-exhibition-design', waterY: -.20, floorY: -.85 });
  b.box(lake, b.m.wetStone, [0, -.90, 46.38], [104, .1, 11.25], 0);
  b.box(lake, b.m.water, [0, -.207, 46.38], [104, .014, 11.25], 0);
  b.box(lake, b.m.oldStone, [0, -.325, 40.89], [104, 1.10, .44], .025);
  const promenade = namedGroup(group, 'south-lake-balustrade-and-viewing-landing', { body: 'lakeside-viewing-edge-and-oval-landing', evidence: 'south-engraving-viewing-edge; dimensions-proportional' });
  for (const side of [-1, 1]) balustrade(b, promenade, `lake-${side < 0 ? 'west' : 'east'}-rail`, [[side * 3.9, 0, 40.56], [side * 50.0, 0, 40.56]], 1.05);
  const landing = [[-3.75, 39.95], [3.75, 39.95]];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; landing.push([Math.cos(a) * 3.75, 40.55 + Math.sin(a) * 2.43]); }
  b.polygon(promenade, landing, -.93, .14, b.m.stone);
  balustrade(b, promenade, 'oval-lake-landing-rail', landing.slice(2).map(([x, z]) => [x, .14, z]), .99);
  for (const side of [-1, 1]) {
    const planters = namedGroup(group, `${side < 0 ? 'west' : 'east'}-forecourt-stone-planters`, { body: 'empty-stone-planting-urns', evidence: 'engraving-furniture; planting-to-be-integrated-separately' });
    for (const [x, z] of [[side * 20.0, 28.0], [side * 23.4, -23.0], [side * 8.9, -38.0]]) {
      b.box(planters, b.m.stone, [x, .15, z], [1.4, .30, 1.4], .035);
      b.lathe(planters, [[.45, .3], [.60, .44], [.37, .62], [.56, .84], [.74, 1.08], [.76, 1.24], [.68, 1.29], [.61, 1.17], [.38, .72]], [x, 0, z], b.m.carving, [1, 1, 1], 30);
      b.add(planters, new THREE.CylinderGeometry(.58, .58, .03, 28), b.m.earth, [x, 1.095, z], undefined, undefined, true);
    }
  }
  b.flush(); return group;
}

function diagnosticsFor(root, b) {
  root.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(root), subassemblies = [];
  let triangleCount = 0, meshCount = 0;
  root.traverse(object => {
    if (object.isMesh) { meshCount++; triangleCount += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; }
    if (!object.isGroup || object === root) return;
    let count = 0, meshes = 0; object.traverse(child => { if (child.isMesh) { meshes++; count += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3; } });
    if (meshes) { const box = new THREE.Box3().setFromObject(object); subassemblies.push({ name: object.name, body: object.userData.body ?? null, meshCount: meshes, triangleCount: count, bounds: { min: box.min.toArray(), max: box.max.toArray() } }); }
  });
  const supported = [
    'Three-storey central hall and a U-shaped composition of two curved galleries ending in two octagonal pavilions',
    'Curved grand stairs on the south and rectangular grand stairs on the north are different compositions',
    'Ionic wall-column order and Corinthian gallery columns are identified in Zhu and Cao 2025; mixed column forms also occur',
    'A larger haitang-form pool stands south and a smaller chrysanthemum-form pool stands north',
    'The park description identifies copper swallows, copper sheep and western upturned-tail stone fish at the south fountain',
    'A separate reservoir stands northwest and the east engraving shows a two-storey tall volume with a lower north-side wing',
  ];
  const inferred = [
    'Every metre dimension is a proportional assumption; no readable metric survey is claimed for this asset',
    'Bay counts and depths of side faces, unseen pavilion faces, room partitions, stair tread counts and vault structures are authored interpretations',
    'Historic engravings predate 1859; this study does not prove every depicted detail survived unchanged into the selected 1859–1860 time layer',
    'Roof framing, fish-scale overlap pattern, ridge details and muted grey-green tile colours remain provisional',
    'Warm rose mineral render follows a literature lead, not a verified pigment measurement',
    'Copper animal and stone fish counts, poses, anatomy and exact placements are inferred; no Haiyantang zodiac figures are substituted',
    'Fountain flow rates, pipe paths, mushroom or perimeter jet counts and simultaneous operation are illustrative',
    'Waterworks interiors, wheels, pipes, valves and tank capacities are not reconstructed; the envelope is not a mechanical reconstruction',
    'The cropped foreground lake depth and outline, planting urn positions and paving layout are exhibition design',
  ];
  return {
    assetId: 'xieqiqu-complete-group', version: 1, units: 'metres', coordinates: { up: '+Y', south: '+Z', east: '+X' }, timeLayer: '1859–1860-before-destruction',
    visualAcceptance: false, integrationAcceptance: false, supported, inferred, supportedFeatures: supported, inferredFeatures: inferred, sourceViews: SOURCES.map(source => ({ ...source })),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(V(0, 0, 0)).toArray() }, triangleCount, triangles: triangleCount, meshCount, subassemblies,
    materials: [...b.materials].map(material => ({ name: material.name, category: material.userData.category, type: material.type, colour: `#${material.color.getHexString()}`, evidence: material.userData.evidence })),
    provisionalScale: { isProvisional: true, reason: 'The front and rear prints and low-resolution plan-elevation constrain proportions, not metric dimensions.' },
    dimensions: { mainHall: { x: 30, z: 16, status: HYPOTHESIS }, pavilionRadius: { value: 5.8, status: HYPOTHESIS }, galleryBaysPerSide: { value: 10, status: HYPOTHESIS }, southPoolEnvelope: { approximateWidth: 29.82, approximateDepth: 19.50, status: HYPOTHESIS }, northPoolEnvelope: { approximateDiameter: 10.61, status: HYPOTHESIS } },
    contacts: b.contacts.map(contact => ({ ...contact })), openingChecks: b.openings.map(opening => ({ ...opening })), waterEndpoints: b.waterEndpoints.map(endpoint => ({ ...endpoint })),
    resourceOwnership: { scope: 'one-factory-invocation', geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, temporaryGeometryDisposals: b.temporaryGeometryDisposals, moduleGlobalCache: false, disposalIsIdempotent: true },
    sourceLimitations: ['The 2025 figure 5 plan was visually read but its dimensions are not legible; it is not treated as a Qing as-built drawing.', 'The unit’s 1751 completion date follows the park description; different sources separate 1747 commencement and fountain completion from later building completion.', 'Historic source images are linked for provenance and are not embedded in the public model or used as texture atlases.'],
  };
}

export function createXieqiquStudy() {
  const b = new AssetBuilder(), group = new THREE.Group(); group.name = 'xieqiqu-complete-group-study';
  group.userData = { assetId: 'xieqiqu-complete-group', body: 'independent-source-constrained-study', historicalLayer: '1859–1860-before-destruction', visualAcceptance: false, allDimensionsProportional: true, publicSourceImagesEmbedded: false };
  try {
    setting(b, group); mainHall(b, group); for (const side of [-1, 1]) { curvedGallery(b, group, side); octagonalPavilion(b, group, side); }
    southFountain(b, group); northFountain(b, group); reservoir(b, group); b.releasePrototypes();
    const diagnostics = diagnosticsFor(group, b);
    return { group, diagnostics, update(time) { if (!b.disposed) b.water.update(time); }, dispose() { if (b.disposed) return; b.dispose(); group.clear(); } };
  } catch (error) { b.dispose(); group.clear(); throw error; }
}
