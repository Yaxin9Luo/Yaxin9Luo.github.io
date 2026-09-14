import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, TAU, namedGroup, extrudedPolygon, meshFromTriangles } from './study-geometry.js';
import { archShape, extrudeShape, stoneSweep, organicLoft, fountainFlowGeometry, fountainRippleGeometry, createFountainWater, houndAnatomy, deerAnatomy, houndSculptureGeometry, deerSculptureGeometry, craneSculptureGeometry, blendedEllipsoids, carvedLeaf, grapeRelief, shellGeometry, ringGeometry } from './yuanyingguan-geometry.js';

// Authored reconstruction study for the 1859–1860 layer; never an accepted
// historical model by implication. Coordinates are metres, +Y up, +Z south.
// The visitor on the south looks north: Yuanyingguan → Dashuifa → Guanshuifa.
const EVIDENCE = 'reported-measurement-Durand-1988-not-Qing-as-built';
const HYPOTHESIS = 'reconstruction-hypothesis';
const SOURCE_VIEWS = [
  { id: 'mit-14', label: '远瀛观南面铜版', type: 'historic-engraving', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy2014_Yuanyingguan_f.jpg', constraint: 'complete south facade and visible roof silhouettes; perspective is not a measured plan' },
  { id: 'mit-15', label: '大水法正面铜版', type: 'historic-engraving', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy2015_GrandFtn_front.jpg', constraint: 'niche, stepped cascade, animal basin, flanking pyramids' },
  { id: 'mit-16', label: '观水法正面铜版', type: 'historic-engraving', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy2016_GrandFtn_thron.jpg', constraint: 'five-panel screen, throne, cranes, side gates and curved stair' },
  { id: 'durand-1988', label: 'Durand 1988 pp. 127, 129, 131–133', type: 'survey-based-restitution', url: 'https://www.persee.fr/doc/arasi_0004-3958_1988_num_43_1_1240', constraint: 'reported metric controls; north plan and five-roof solution explicitly hypothetical' },
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
      const grey = (kind === 'copper' ? 220 : kind === 'tile' ? 181 : 226) + noise * (kind === 'copper' ? 20 : 14);
      data[at] = data[at + 1] = data[at + 2] = grey;
    }
    data[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, side, side); texture.name = `yuanyingguan-${kind}-${normal ? 'normal' : 'roughness'}`;
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
      material.name = `yuanyingguan-${name}`; material.userData = { category, evidence: 'material-response-and-colour-are-art-direction' };
      this.materials.add(material); return material;
    };
    this.water = createFountainWater('yuanyingguan');
    for (const material of [this.water.surface, this.water.flow]) this.materials.add(material);
    for (const texture of this.water.textures) this.textures.add(texture);
    const stone = { color: 0xe8e0cf, roughness: .83, normalMap: stoneNormal, normalScale: new THREE.Vector2(.16, .16), roughnessMap: stoneRough };
    return {
      stone: make('warm-white-marble', 'stone', stone),
      carving: make('marble-cut-faces', 'stone', { ...stone, color: 0xf0e9db, roughness: .75 }),
      oldStone: make('marble-recesses', 'stone', { ...stone, color: 0xc9c4b4, roughness: .90 }),
      wetStone: make('wet-marble', 'stone', { ...stone, color: 0xaaa99f, roughness: .49 }),
      paving: make('limestone-paving', 'stone', { ...stone, color: 0xd1c8b5, roughness: .92 }),
      mortar: make('masonry-joints', 'masonry', { color: 0x9c9a8b, roughness: 1 }),
      brick: make('grey-brick-body', 'masonry', { color: 0x9d9e93, roughness: .96, normalMap: stoneNormal, normalScale: new THREE.Vector2(.12, .12) }),
      plaster: make('warm-mineral-render', 'plaster', { color: 0xd7ceba, roughness: .96, normalMap: stoneNormal, normalScale: new THREE.Vector2(.10, .10) }),
      tile: make('muted-jade-glaze-provisional', 'glazed-tile', { color: 0x547868, roughness: .32, roughnessMap: tileRough, normalMap: tileNormal, normalScale: new THREE.Vector2(.1, .1), clearcoat: .42, clearcoatRoughness: .2 }, true),
      tileTrim: make('glazed-tile-edges-provisional', 'glazed-tile', { color: 0x829785, roughness: .34, clearcoat: .35 }, true),
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
  }
  sweep(parent, points, width, depth, material = this.m.carving, axis = V(0, 0, 1), segments = 28, taper) {
    this.add(parent, stoneSweep(points, width, depth, axis, segments, taper), material, undefined, undefined, undefined, true);
  }
  loft(parent, sections, material = this.m.copper, sides = 16, steps = 24, ridge = .015, minimumRadius = .008) {
    this.add(parent, organicLoft(sections, sides, steps, ridge, minimumRadius), material, undefined, undefined, undefined, true);
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
    if (id.endsWith('-jet') || id === 'niche-spout') {
      const size = Math.max(.10, Math.min(.45, radius * 12));
      this.add(parent, this.prototype('water-landing-ripples', fountainRippleGeometry), this.m.water, points.at(-1), [size, 1, size]);
    }
    this.waterEndpoints.push({ id, basinId, start: [...points[0]], end: [...points.at(-1)], coordinateSpace: parent.name, evidence: 'illustrative-hydraulic-state-not-original-flow-measurement' });
  }
  flush() {
    for (const { parent, material, parts } of this.pending.values()) {
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error(`Could not merge Yuanyingguan geometry for ${parent.name}`);
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

function archPoints(width, height, bottom = 0, center = 0, z = 0) {
  const r = width / 2, spring = bottom + height - r, points = [[center - r, bottom, z], [center - r, spring, z]];
  for (let i = 1; i <= 20; i++) { const a = Math.PI - i / 20 * Math.PI; points.push([center + Math.cos(a) * r, spring + Math.sin(a) * r, z]); }
  points.push([center + r, bottom, z]); return points;
}

function scroll(b, parent, x, y, z, size, side = 1, material = b.m.carving) {
  const points = [[x - side * size, y - .28 * size, z], [x - side * .65 * size, y + .12 * size, z], [x, y + .38 * size, z], [x + side * .38 * size, y + .10 * size, z], [x + side * .28 * size, y - .18 * size, z], [x, y - .19 * size, z + .02], [x - side * .04 * size, y + .025 * size, z + .06]];
  b.sweep(parent, points, .22 * size, .24 * size, material, V(0, 0, 1), 30, t => .5 + .5 * Math.sin(t * Math.PI * .85));
  b.leaf(parent, [x - side * .43 * size, y + .12 * size, z + .08], [.48 * size, .70 * size, .6 * size], [0, 0, -side * .9], 'acanthus', material);
}

function cornice(b, parent, center, width, depth, material = b.m.carving, dentils = true) {
  const [x, y, z] = center;
  for (const [dy, w, h, d] of [[-.20, width, .14, depth], [-.055, width + .12, .15, depth + .12], [.09, width + .27, .12, depth + .28], [.19, width + .34, .09, depth + .38]]) b.box(parent, material, [x, y + dy, z], [w, h, d], .024);
  if (dentils) for (let i = 0, n = Math.max(1, Math.floor(width / .34)); i < n; i++) b.box(parent, material, [x - width / 2 + (i + .5) * width / n, y - .34, z + depth / 2 - .03], [.12, .19, .20], .008);
}

function column(b, parent, name, position, height, radius = .30, grape = false) {
  const group = namedGroup(parent, name, { body: grape ? 'grape-pattern-marble-column' : 'carved-marble-column', evidence: grape ? 'surviving-grape-columns-and-south-engraving' : HYPOTHESIS }); group.position.set(...position);
  b.box(group, b.m.stone, [0, .16, 0], [radius * 3.3, .32, radius * 3.3], .035);
  b.lathe(group, [[0, .31], [radius * 1.5, .31], [radius * 1.5, .43], [radius * 1.15, .5], [radius * 1.13, .62], [radius * 1.34, .7], [radius, .77]], [0, 0, 0]);
  const sections = Array.from({ length: 15 }, (_, i) => { const t = i / 14; return [0, .76 + t * (height - 1.58), 0, radius * (1 - .10 * t + .04 * Math.sin(t * Math.PI)), radius * (1 - .10 * t + .04 * Math.sin(t * Math.PI))]; });
  b.loft(group, sections, b.m.carving, 28, 16, grape ? .015 : .035);
  const shaftTop = height - .79;
  b.lathe(group, [[radius * .9, shaftTop - .05], [radius * 1.2, shaftTop], [radius * 1.2, shaftTop + .11], [radius * .95, shaftTop + .18], [radius * 1.55, height - .25]], [0, 0, 0]);
  for (let row = 0; row < 2; row++) for (let j = 0; j < 8; j++) {
    const a = j / 8 * TAU + row * Math.PI / 8, r = radius * (row ? 1.15 : 1.04);
    b.leaf(group, [Math.sin(a) * r, height - .62 + row * .18, Math.cos(a) * r], [radius * 1.4, .75 - row * .1, radius * 1.4], [0, a, 0]);
  }
  b.box(group, b.m.carving, [0, height - .09, 0], [radius * 3.45, .19, radius * 3.45], .028);
  if (grape) {
    for (let turn = 0; turn < 5; turn++) {
      const y = 1.15 + turn * (height - 2) / 5;
      const winding = Array.from({ length: 17 }, (_, i) => { const a = i / 16 * TAU + turn * 1.1; return [Math.sin(a) * radius * 1.04, y + i / 16 * .9, Math.cos(a) * radius * 1.04]; });
      b.sweep(group, winding, .14, .13, b.m.carving, V(0, 1, 0), 30);
      for (let face = 0; face < 3; face++) {
        const a = face / 3 * TAU + turn * .9;
        b.add(group, b.prototype('sculpted-grape-cluster', grapeRelief), b.m.carving, [Math.sin(a) * radius * 1.06, y + .3, Math.cos(a) * radius * 1.06], [.59, .72, .8], [0, a, -.15]);
        b.leaf(group, [Math.sin(a + .65) * radius, y + .65, Math.cos(a + .65) * radius], [.65, .74, .65], [0, a + .65, .3], 'grape');
      }
    }
  }
  return group;
}

function windowFrame(b, parent, name, x, bottom, width, height, door = false, decorated = true) {
  const group = namedGroup(parent, name, { body: door ? 'recessed-door-and-carved-surround' : 'recessed-window-and-carved-surround', opening: { center: x, bottom, width, height }, evidence: 'south-elevation-motif-with-authored-carving' });
  const glazing = archShape(width - .12, height - .1, bottom + .045, x);
  b.shape(group, glazing, [0, 0, -.24], .045, door ? b.m.timber : b.m.glass, .006);
  const spring = bottom + height - width / 2;
  for (const [outset, w, d, z] of [[.06, .16, .19, .09], [.23, .14, .21, .16], [.41, .17, .15, .12]]) b.sweep(group, archPoints(width + outset * 2, height + outset, bottom, x, z), w, d);
  for (const sx of [-1, 1]) b.box(group, b.m.carving, [x + sx * (width / 2 + .29), bottom + .14, .08], [.46, .28, .38], .02);
  if (!door) {
    b.box(group, b.m.carving, [x, bottom - .11, .14], [width + 1.02, .23, .60], .035);
    b.box(group, b.m.oldStone, [x, bottom - .48, .015], [width + .28, .53, .13], .02);
    for (const sx of [-1, 1]) b.leaf(group, [x + sx * .35, bottom - .45, .16], [.45, .55, .5], [0, 0, sx * .58]);
  }
  for (const sx of [-1, 0, 1]) b.box(group, b.m.timber, [x + sx * width / 3, bottom + (spring - bottom) / 2, -.14], [.058, spring - bottom, .085], .006);
  for (let y = bottom + .65; y < spring; y += .63) b.box(group, b.m.timber, [x, y, -.14], [width - .14, .05, .09], .005);
  const r = (width - .16) / 2;
  for (const a of [.33, .66, 1, 1.33, 1.66, 2, 2.33, 2.66]) {
    const end = [x + Math.cos(a) * r, spring + Math.sin(a) * r, -.14];
    b.sweep(group, [[x, spring, -.14], end], .042, .066, b.m.timber, V(0, 0, 1), 1);
  }
  if (door) {
    for (const sx of [-1, 1]) for (let row = 0; row < 3; row++) {
      const panelY = bottom + .46 + row * .84;
      b.box(group, b.m.timber, [x + sx * width * .25, panelY, -.09], [width * .42, .68, .085], .035);
      b.box(group, b.m.copper, [x + sx * .10, bottom + 1.35, .025], [.065, .18, .07], .014);
    }
  }
  if (decorated) {
    b.shell(group, [x, bottom + height + .16, .22], .92, .72, .19);
    for (const side of [-1, 1]) {
      scroll(b, group, x + side * width * .65, bottom + height + .1, .17, .82, -side);
      b.leaf(group, [x + side * width * .36, bottom + height + .40, .28], [.68, .81, .65], [0, 0, side * .7]);
    }
  }
  return group;
}

function elevation(b, parent, name, width, height, position, rotation, bays, options = {}) {
  const group = namedGroup(parent, name, { body: 'perforated-masonry-elevation', evidence: options.evidence ?? HYPOTHESIS }); group.position.set(...position); group.rotation.y = rotation;
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(width / 2, height), new THREE.Vector2(-width / 2, height)]);
  for (const bay of bays) shape.holes.push(new THREE.Path(archShape(bay.w, bay.h, bay.b, bay.x).getPoints(32)));
  b.shape(group, shape, [0, 0, -.62], .62, options.material ?? b.m.brick, 0);
  for (let i = 0; i < bays.length; i++) windowFrame(b, group, `${name}-opening-${i + 1}`, bays[i].x, bays[i].b, bays[i].w, bays[i].h, bays[i].door, options.decorated !== false);
  b.box(group, b.m.stone, [0, height - .76, .04], [width + .04, .18, .19], .013);
  let plinthStart = -width / 2;
  for (const bay of [...bays.filter(bay => bay.door).sort((a, c) => a.x - c.x), { x: width / 2, w: 0 }]) {
    const end = bay.w ? bay.x - bay.w / 2 - .035 : width / 2;
    if (end > plinthStart) b.box(group, b.m.stone, [(plinthStart + end) / 2, .20, .04], [end - plinthStart, .18, .19], .013);
    plinthStart = bay.x + bay.w / 2 + .035;
  }
  cornice(b, group, [0, height - .21, 0], width + .24, .54);
  // Grey-brick coursing stops at the genuine voids, rather than crossing a door.
  for (let y = .6; y < height - .8; y += .42) {
    const blocked = bays.filter(bay => y > bay.b - .04 && y < bay.b + bay.h + .42).map(bay => [bay.x - bay.w / 2 - .50, bay.x + bay.w / 2 + .50]).sort((a, c) => a[0] - c[0]);
    let left = -width / 2;
    for (const [lo, hi] of [...blocked, [width / 2, width / 2]]) {
      if (lo > left) b.box(group, b.m.mortar, [(left + lo) / 2, y, .007], [lo - left, .016, .018], 0);
      left = Math.max(left, hi);
    }
  }
  return group;
}

function balustrade(b, parent, name, points, height = 1.12, spacing = .42) {
  const group = namedGroup(parent, name, { body: 'closed-stone-balustrade' }), curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)));
  const length = curve.getLength(), n = Math.max(2, Math.floor(length / spacing));
  b.sweep(group, points.map(p => [p[0], p[1] + .1, p[2]]), .30, .22, b.m.stone, V(0, 1, 0), Math.max(2, Math.ceil(length * 2)));
  b.sweep(group, points.map(p => [p[0], p[1] + height, p[2]]), .40, .22, b.m.carving, V(0, 1, 0), Math.max(2, Math.ceil(length * 2)));
  const profile = [[.115, .18], [.12, .25], [.07, .32], [.09, .43], [.125, .54], [.10, .64], [.061, .79], [.1, .87], [.1, .99]];
  for (let i = 0; i <= n; i++) {
    const point = curve.getPointAt(i / n);
    if (i % 8 === 0 || i === n) {
      b.box(group, b.m.stone, [point.x, point.y + height / 2, point.z], [.35, height + .08, .35], .028);
      b.lathe(group, [[.21, 0], [.24, .08], [.16, .16], [.10, .29], [.02, .38]], [point.x, point.y + height + .08, point.z]);
    } else b.lathe(group, profile, point.toArray(), b.m.carving, [1, height / 1.12, 1], 12);
  }
  return group;
}

function hipRoof(b, parent, name, cx, cz, width, depth, eave, rise, octagonal = false) {
  const group = namedGroup(parent, name, { body: 'tiled-hip-roof', evidence: HYPOTHESIS, roofColour: 'muted-green-is-provisional', independentTimberRoofSupport: true });
  const cut = octagonal ? .29 : .08;
  const outer = [[-width / 2 + width * cut, -depth / 2], [width / 2 - width * cut, -depth / 2], [width / 2, -depth / 2 + depth * cut], [width / 2, depth / 2 - depth * cut], [width / 2 - width * cut, depth / 2], [-width / 2 + width * cut, depth / 2], [-width / 2, depth / 2 - depth * cut], [-width / 2, -depth / 2 + depth * cut]];
  const sample = (edge, u, v, lift = 0) => {
    const a = outer[edge], c = outer[(edge + 1) % 8], x = a[0] + (c[0] - a[0]) * u, z = a[1] + (c[1] - a[1]) * u;
    const radial = .08 + .92 * v, corner = Math.abs(u - .5) * 2;
    return V(cx + x * radial, eave + rise * (1 - v) ** .86 + .24 * v ** 9 + .17 * corner ** 6 * v ** 6 + lift, cz + z * radial);
  };
  const triangles = [];
  for (let edge = 0; edge < 8; edge++) {
    const edgeLength = Math.hypot(outer[(edge + 1) % 8][0] - outer[edge][0], outer[(edge + 1) % 8][1] - outer[edge][1]);
    const columns = Math.max(2, Math.ceil(edgeLength / .24));
    for (let row = 0; row < 15; row++) for (let col = 0; col < columns; col++) {
      const a = sample(edge, col / columns, row / 15), c = sample(edge, (col + 1) / columns, row / 15), d = sample(edge, (col + 1) / columns, (row + 1) / 15), e = sample(edge, col / columns, (row + 1) / 15);
      if (c.clone().sub(a).cross(d.clone().sub(a)).y < 0) triangles.push([a, d, c], [a, e, d]); else triangles.push([a, c, d], [a, d, e]);
    }
    // Barrel tile ridges run down each slope with real convex cross-sections.
    for (let col = 0; col <= columns; col++) {
      const tileFaces = [], u = col / columns, du = Math.min(.44 / columns, .03);
      for (let row = 0; row < 15; row++) for (let k = 0; k < 6; k++) {
        const tilePoint = (v, t) => sample(edge, THREE.MathUtils.clamp(u + Math.cos(t * Math.PI) * du, 0, 1), v, .023 + Math.sin(t * Math.PI) * .073 * (.4 + .6 * v));
        const a = tilePoint(row / 15, k / 6), c = tilePoint(row / 15, (k + 1) / 6), d = tilePoint((row + 1) / 15, (k + 1) / 6), e = tilePoint((row + 1) / 15, k / 6);
        if (c.clone().sub(a).cross(d.clone().sub(a)).y < 0) tileFaces.push([a, d, c], [a, e, d]); else tileFaces.push([a, c, d], [a, d, e]);
      }
      b.add(group, meshFromTriangles(tileFaces), b.m.tileTrim, undefined, undefined, undefined, true);
    }
    const rim = Array.from({ length: 9 }, (_, i) => sample(edge, i / 8, 1).toArray());
    b.sweep(group, rim, .22, .21, b.m.tileTrim, V(0, 1, 0), 12);
    const hip = Array.from({ length: 14 }, (_, i) => sample(edge, 0, i / 13, .07).toArray());
    b.sweep(group, hip, .18, .23, b.m.tileTrim, V(0, 1, 0), 24);
  }
  b.add(group, meshFromTriangles(triangles), b.m.tile, undefined, undefined, undefined, true);
  b.polygon(group, outer.map(([x, z]) => [cx + x, cz + z]), eave - .19, eave - .035, b.m.timber);
  b.box(group, b.m.tileTrim, [cx, eave + rise + .10, cz], [Math.max(.3, width * .13), .25, Math.max(.3, depth * .13)], .08);
  return group;
}

function centralRoofEdicule(b, parent) {
  const group = namedGroup(parent, 'south-central-roof-edicule', { body: 'oculus-and-sculpted-roof-front', evidence: 'south-engraving-and-Durand-fig16' }); group.position.set(0, 11.65, -31.88);
  const shape = new THREE.Shape(); shape.moveTo(-2.4, 0); shape.lineTo(2.4, 0); shape.lineTo(2.1, 2.6); shape.bezierCurveTo(2.1, 5.4, -2.1, 5.4, -2.1, 2.6); shape.closePath();
  const hole = new THREE.Path(); hole.absellipse(0, 3.25, 1.01, 1.28, 0, TAU, true); shape.holes.push(hole);
  b.shape(group, shape, [0, 0, -.26], .56, b.m.carving, .06);
  const glass = new THREE.Shape(); glass.absellipse(0, 3.25, .98, 1.25, 0, TAU, false); b.shape(group, glass, [0, 0, -.30], .04, b.m.glass, 0);
  for (const r of [1.07, 1.23]) {
    const points = Array.from({ length: 65 }, (_, i) => [Math.sin(i / 64 * TAU) * r, 3.25 + Math.cos(i / 64 * TAU) * r * 1.26, .34]);
    b.sweep(group, points, .14, .15, b.m.carving, V(0, 0, 1), 64);
  }
  for (let j = 0; j < 12; j++) {
    const a = j / 12 * TAU;
    b.sweep(group, [[0, 3.25, -.18], [Math.sin(a) * .95, 3.25 + Math.cos(a) * 1.2, -.18]], .038, .047, b.m.timber, V(0, 0, 1), 1);
  }
  b.shell(group, [0, .35, .35], 1.55, 1.5, .27);
  for (const side of [-1, 1]) { scroll(b, group, side * 2.25, .74, .20, 1.35, -side); b.leaf(group, [side * 1.42, 1.75, .38], [.75, 1.18, .8], [0, 0, side * .28]); }
  return group;
}

function terraceStair(b, parent, side) {
  const name = side < 0 ? 'terrace-west-stair' : 'terrace-east-stair';
  const group = namedGroup(parent, name, { body: 'solid-curved-stair', evidence: 'engraving-constrained-proportional-stair', rise: 3.06, risers: 18 });
  const path = new THREE.CubicBezierCurve3(V(side * 23, 0, -12), V(side * 22, 0, -18), V(side * 18.9, 0, -23), V(side * 16.2, 0, -25.3));
  const edge = (t, sign) => { const p = path.getPoint(t), tangent = path.getTangent(t), across = V(-tangent.z, 0, tangent.x).normalize(); return [p.x + across.x * sign * 1.45, p.z + across.z * sign * 1.45]; };
  for (let i = 0; i < 18; i++) {
    const t0 = i / 18, t1 = (i + 1) / 18, rise = (i + 1) * .17;
    b.polygon(group, [edge(t0, -1), edge(t0, 1), edge(t1, 1), edge(t1, -1)], -.02, rise, b.m.stone);
  }
  for (const sign of [-1, 1]) {
    const points = Array.from({ length: 19 }, (_, i) => { const [x, z] = edge(i / 18, sign); return [x, Math.min(18, i + 1) * .17, z]; });
    balustrade(b, group, `${name}-${sign < 0 ? 'inner' : 'outer'}-rail`, points, .99, .41);
  }
  const entry = path.getPoint(.018); b.contacts.push({ id: name, ground: 'court-paving', point: [entry.x, 0, entry.z], underside: -.02, firstTread: .17, evidence: 'authored-contact' });
}

function yuanyingguan(b, root) {
  const group = namedGroup(root, 'yuanyingguan', { body: 'complete-building-and-terrace', facing: 'south', timeLayer: '1859–1860-before-destruction', evidence: HYPOTHESIS });
  const terrace = namedGroup(group, 'yuanyingguan-terrace', { body: 'raised-stone-terrace', measuredDimensions: { x: 35, z: 31 }, evidence: EVIDENCE });
  b.box(terrace, b.m.mortar, [0, 1.48, -38.5], [35, 2.96, 31], 0);
  // The terrace dimensions describe the retaining envelope, separately from the
  // 28 × 21 m building wall line. The south wall backs onto Dashuifa rockwork.
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let i = 0; i < 17; i++) b.box(terrace, b.m.oldStone, [side * 17.48, .38 + row * .70, -53.09 + i * 1.81], [.19, .64, 1.74], .04);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 20; i++) b.box(terrace, b.m.oldStone, [-16.59 + i * 1.746, .38 + row * .70, -53.98], [1.67, .64, .19], .04);
  b.box(terrace, b.m.carving, [0, 3.01, -38.5], [35.18, .1, 31.18], .02);
  const floor = namedGroup(group, 'yuanyingguan-building-footprint', { body: 'building-socle', measuredDimensions: { x: 28, z: 21 }, evidence: EVIDENCE, axisAssignment: '28 m east–west; 21 m north–south, read against fig16 south facade' });
  const footprint = [[-14, -51], [14, -51], [14, -30], [7, -30], [7, -32.5], [-7, -32.5], [-7, -30], [-14, -30]];
  b.polygon(floor, footprint, 3.06, 3.92, b.m.stone);
  const hall = namedGroup(group, 'yuanyingguan-complete-hall', { body: 'complete-masonry-hall', roomCountReported: 17, roomPartitionStatus: 'not-interior-reconstruction', northPlan: HYPOTHESIS });
  const y = 3.92, height = 7.35;
  const mainBays = [-4.45, 0, 4.45].map(x => ({ x, b: x === 0 ? 0 : .43, w: 1.76, h: x === 0 ? 4.65 : 4.22, door: x === 0 }));
  elevation(b, hall, 'south-central-facade', 14, height, [0, y, -32.5], 0, mainBays, { evidence: 'south-engraving-and-Durand-fig16' });
  for (const side of [-1, 1]) {
    elevation(b, hall, `south-${side < 0 ? 'west' : 'east'}-projecting-wing`, 7, height, [side * 10.5, y, -30], 0, [{ x: 0, b: .78, w: 1.86, h: 4.04 }], { evidence: 'south-engraving-and-Durand-fig16' });
    elevation(b, hall, `${side < 0 ? 'west' : 'east'}-long-facade`, 21, height, [side * 14, y, -40.5], side * Math.PI / 2, [-7.25, -3.6, 0, 3.6, 7.25].map(x => ({ x, b: .82, w: 1.63, h: 3.86 })), { decorated: false });
    elevation(b, hall, `${side < 0 ? 'west' : 'east'}-recess-return`, 2.5, height, [side * 7, y, -31.25], -side * Math.PI / 2, [], { decorated: false, material: b.m.plaster });
  }
  elevation(b, hall, 'north-facade-inferred', 28, height, [0, y, -51], Math.PI, [-10.5, -7, -3.5, 0, 3.5, 7, 10.5].map(x => ({ x, b: .85, w: 1.50, h: 3.75 })), { decorated: false });
  b.box(hall, b.m.timber, [0, y + height - .28, -41.8], [27.3, .22, 17.0], 0);
  b.box(hall, b.m.paving, [0, y + .03, -41], [27, .06, 19], 0);
  for (const x of [-13.6, -7.32, 7.32, 13.6]) column(b, hall, `south-pilaster-${x}`, [x, y, -29.85], height, .25);
  for (const x of [-6.68, -2.02, 2.02, 6.68]) column(b, hall, `south-central-column-${x}`, [x, y, -32.06], height, x === -2.02 || x === 2.02 ? .33 : .24, Math.abs(x) === 2.02);
  const roofs = namedGroup(group, 'yuanyingguan-five-roof-hypothesis', { body: 'five-autonomous-roof-systems', evidence: HYPOTHESIS, source: 'Durand 1988 p133; only print and ground support traces available to author' });
  const central = namedGroup(roofs, 'central-three-stage-roof', { body: 'three-stage-hip-roof', evidence: HYPOTHESIS });
  b.box(central, b.m.plaster, [0, 11.51, -41.75], [13.95, .52, 18.50], .025);
  hipRoof(b, central, 'central-roof-lower-eaves', 0, -41.75, 14.6, 20.2, 11.7, 2.55);
  b.box(central, b.m.plaster, [0, 14.24, -41.75], [8.8, .78, 13.6], .02);
  hipRoof(b, central, 'central-roof-middle-eaves', 0, -41.75, 10.8, 16.0, 14.25, 1.52);
  b.box(central, b.m.plaster, [0, 15.9, -41.75], [6.3, .72, 9.4], .02);
  hipRoof(b, central, 'central-roof-upper-eaves', 0, -41.75, 8.4, 11.4, 16.2, 2.54);
  b.lathe(central, [[.6, 0], [.6, .18], [.4, .31], [.47, .53], [.29, .7], [.20, .90], [.12, 1.15], [.025, 1.35]], [0, 18.98, -41.75], b.m.tileTrim);
  centralRoofEdicule(b, group);
  for (const side of [-1, 1]) {
    const wingName = side < 0 ? 'west' : 'east';
    const longRoof = namedGroup(roofs, `${wingName}-lateral-long-roof`, { body: 'long-tile-roof', evidence: HYPOTHESIS });
    b.box(longRoof, b.m.plaster, [side * 10.5, 11.39, -43.5], [6.98, .25, 15.0], .015);
    hipRoof(b, longRoof, `${wingName}-long-tiled-cover`, side * 10.5, -43.55, 7.45, 15.65, 11.55, 1.40);
    const pavilion = namedGroup(roofs, `${wingName}-octagonal-roof-and-lantern`, { body: 'octagonal-wing-roof-and-square-lantern', evidence: HYPOTHESIS });
    b.box(pavilion, b.m.plaster, [side * 10.5, 11.52, -34.3], [6.98, .54, 8.59], .018);
    hipRoof(b, pavilion, `${wingName}-octagonal-lower-roof`, side * 10.5, -34.3, 8.2, 8.2, 11.75, 1.36, true);
    const lantern = namedGroup(pavilion, `${wingName}-lantern`, { body: 'oculus-lantern' });
    for (let face = 0; face < 4; face++) {
      const wall = namedGroup(lantern, `${wingName}-lantern-face-${face}`); wall.position.set(side * 10.5, 13.0, -34.3); wall.rotation.y = face * Math.PI / 2;
      const shape = new THREE.Shape([new THREE.Vector2(-1.25, 0), new THREE.Vector2(1.25, 0), new THREE.Vector2(1.25, 2.4), new THREE.Vector2(-1.25, 2.4)]), hole = new THREE.Path(); hole.absarc(0, 1.3, .51, 0, TAU, true); shape.holes.push(hole);
      b.shape(wall, shape, [0, 0, 1.0], .22, b.m.plaster, .02);
      b.add(wall, b.prototype('lantern-oculus-glass', () => new THREE.CylinderGeometry(.49, .49, .045, 32)), b.m.glass, [0, 1.3, .99], undefined, [Math.PI / 2, 0, 0]);
      const ring = Array.from({ length: 49 }, (_, i) => [Math.sin(i / 48 * TAU) * .60, 1.3 + Math.cos(i / 48 * TAU) * .60, 1.28]); b.sweep(wall, ring, .15, .16, b.m.carving, V(0, 0, 1), 48);
      b.box(wall, b.m.timber, [0, 1.3, 1.03], [.045, .92, .045], .004); b.box(wall, b.m.timber, [0, 1.3, 1.03], [.92, .045, .045], .004);
    }
    hipRoof(b, pavilion, `${wingName}-lantern-tile-cap`, side * 10.5, -34.3, 3.4, 3.4, 15.5, 1.30, true);
    b.lathe(pavilion, [[.20, 0], [.27, .18], [.17, .36], [.12, .58], [.025, .8]], [side * 10.5, 16.99, -34.3], b.m.tileTrim);
    const railY = 12.17;
    balustrade(b, pavilion, `${wingName}-roof-balustrade-front`, [[side * 10.5 - 3.2, railY, -30.6], [side * 10.5 + 3.2, railY, -30.6]], .75, .38);
  }
  for (const side of [-1, 1]) {
    terraceStair(b, group, side);
    balustrade(b, terrace, `terrace-${side < 0 ? 'west' : 'east'}-edge`, [[side * 17.05, 3.06, -27.2], [side * 17.05, 3.06, -53.25]], 1.14, .43);
  }
  balustrade(b, terrace, 'terrace-north-edge', [[-17.05, 3.06, -53.25], [17.05, 3.06, -53.25]], 1.14, .43);
  balustrade(b, terrace, 'terrace-south-central-edge', [[-14.5, 3.06, -23.50], [14.5, 3.06, -23.50]], 1.07, .43);
  b.openings.push({ id: 'principal-door', group: 'yuanyingguan-complete-hall', origin: [.31, 5.20, -25], direction: [0, 0, -1], expectedCategory: 'timber' });
  b.openings.push({ id: 'west-south-window', group: 'yuanyingguan-complete-hall', origin: [-10.35, 6.22, -23], direction: [0, 0, -1], expectedCategory: 'glass' });
  b.openings.push({ id: 'east-side-window', group: 'yuanyingguan-complete-hall', origin: [22, 6.32, -40.65], direction: [-1, 0, 0], expectedCategory: 'glass' });
  b.flush();
}

function basinOutline() {
  const shape = new THREE.Shape();
  shape.moveTo(-8.3, -21.1); shape.lineTo(8.3, -21.1);
  shape.bezierCurveTo(10.7, -20.7, 11.7, -18.3, 10.7, -16.0);
  shape.bezierCurveTo(9.2, -13.8, 10.4, -10.4, 11.6, -8.6);
  shape.bezierCurveTo(12.2, -6.0, 10.5, -3.3, 8.1, -3.5);
  shape.bezierCurveTo(5.0, -4.1, 4.0, -.85, 0, -.7);
  shape.bezierCurveTo(-4.0, -.85, -5.0, -4.1, -8.1, -3.5);
  shape.bezierCurveTo(-10.5, -3.3, -12.2, -6.0, -11.6, -8.6);
  shape.bezierCurveTo(-10.4, -10.4, -9.2, -13.8, -10.7, -16.0);
  shape.bezierCurveTo(-11.7, -18.3, -10.7, -20.7, -8.3, -21.1); shape.closePath();
  return shape.getPoints(12).map(p => [p.x, p.y]);
}

function basin(b, parent, name, outline, center = [0, 0], data = {}) {
  const group = namedGroup(parent, name, { body: 'water-filled-stone-basin', waterY: .12, rimY: .52, bottomY: -.42, ...data });
  const inner = outline.map(([x, z]) => [center[0] + (x - center[0]) * .957, center[1] + (z - center[1]) * .957]);
  b.polygon(group, outline, -.55, .40, b.m.oldStone, [inner]);
  b.polygon(group, inner, -.55, -.42, b.m.wetStone);
  b.polygon(group, inner, .108, .12, b.m.water);
  b.sweep(group, [...outline, outline[0]].map(([x, z]) => [x, .43, z]), .38, .19, b.m.carving, V(0, 1, 0), outline.length * 2);
  return group;
}

function carvedBowl(b, parent, name, position, radius, height) {
  const group = namedGroup(parent, name, { body: 'thick-communicating-stone-bowl', water: 'central-cascade' }); group.position.set(...position);
  // Closed profile includes a broad rim, curved outside, solid underside and
  // a separately wetted concave inside. The basin reads correctly from below.
  const profile = [[0, -.18], [.24, -.18], [radius * .4, -.08], [radius * .74, height * .35], [radius, height * .83], [radius * 1.025, height * .98], [radius * .97, height * 1.10], [radius * .87, height * 1.07], [radius * .76, height * .55], [radius * .38, .13], [.05, .04]];
  b.lathe(group, profile, [0, 0, 0], b.m.carving, [1, 1, .61], 48);
  for (let j = 0; j < 14; j++) {
    const a = -Math.PI * .5 + j / 13 * Math.PI;
    b.leaf(group, [Math.sin(a) * radius * .72, height * .31, Math.cos(a) * radius * .49], [.29, .75, .3], [.4, a, 0]);
  }
  b.add(group, new THREE.CylinderGeometry(radius * .96, radius * .96, .016, 56), b.m.water, [0, height * 1.10 - .008, 0], [1, 1, .61], undefined, true);
  return group;
}

function dashuifaNiche(b, parent) {
  const group = namedGroup(parent, 'dashuifa-sculpted-stone-niche', { body: 'complete-baroque-water-niche', evidence: 'MIT-view15-with-authored-depth-and-carving' }); group.position.z = -22.35;
  const main = new THREE.Shape();
  main.moveTo(-3.40, .2); main.lineTo(3.4, .2); main.lineTo(3.4, 8.85);
  main.bezierCurveTo(3.5, 9.75, 4.16, 9.05, 4.16, 10.0); main.bezierCurveTo(4.18, 10.6, 2.2, 10.6, 1.95, 11.65);
  main.bezierCurveTo(1.75, 12.45, 1.1, 13.30, 0, 13.38); main.bezierCurveTo(-1.1, 13.30, -1.75, 12.45, -1.95, 11.65);
  main.bezierCurveTo(-2.2, 10.6, -4.18, 10.6, -4.16, 10.0); main.bezierCurveTo(-4.16, 9.05, -3.5, 9.75, -3.4, 8.85); main.closePath();
  main.holes.push(new THREE.Path(archShape(3.12, 6.70, 3.00).getPoints(40)));
  b.shape(group, main, [0, 0, -.15], 1.17, b.m.stone, .055);
  b.shape(group, archShape(3.11, 6.68, 3.01), [0, 0, -.45], .12, b.m.wetStone, .015);
  for (const [offset, size, depth] of [[.10, .24, .26], [.43, .27, .36], [.78, .21, .29]]) b.sweep(group, archPoints(3.12 + offset * 2, 6.70 + offset, 3.0, 0, 1.05), size, depth, b.m.carving, V(0, 0, 1), 46);
  const crown = [[-4.04, 10.10, 1.14], [-2.8, 10.38, 1.14], [-1.65, 11.3, 1.14], [-1.2, 12.28, 1.14], [0, 12.75, 1.14], [1.2, 12.28, 1.14], [1.65, 11.3, 1.14], [2.8, 10.38, 1.14], [4.04, 10.10, 1.14]];
  b.sweep(group, crown, .34, .33, b.m.carving, V(0, 0, 1), 64);
  b.shell(group, [0, 10.15, 1.27], 2.20, 1.90, .31);
  for (const side of [-1, 1]) {
    scroll(b, group, side * 3.18, 10.02, 1.19, 1.08, -side);
    b.leaf(group, [side * .88, 12.35, 1.24], [.77, 1.18, .8], [0, 0, side * .48]);
    const wing = namedGroup(group, `${side < 0 ? 'west' : 'east'}-fountain-wing`, { body: 'sculpted-side-niche' });
    const shape = new THREE.Shape(); shape.moveTo(side * 3.5, .2); shape.lineTo(side * 8.8, .2); shape.lineTo(side * 8.8, 6.35); shape.bezierCurveTo(side * 7.8, 6.8, side * 7.3, 9.0, side * 6.5, 9.23); shape.lineTo(side * 4.0, 9.23); shape.lineTo(side * 3.5, .2); shape.closePath();
    const hole = archShape(1.68, 4.22, 2.18, side * 5.83); shape.holes.push(new THREE.Path(hole.getPoints(30)));
    b.shape(wing, shape, [0, 0, -.04], .88, b.m.stone, .045); b.shape(wing, hole, [0, 0, -.28], .1, b.m.wetStone, 0);
    b.sweep(wing, archPoints(1.95, 4.50, 2.06, side * 5.83, .97), .22, .26, b.m.carving, V(0, 0, 1), 36);
    column(b, wing, `${side < 0 ? 'west' : 'east'}-niche-inner-column`, [side * 4.13, .4, 1.03], 8.16, .24);
    column(b, wing, `${side < 0 ? 'west' : 'east'}-niche-outer-column`, [side * 7.51, .4, .80], 7.75, .24);
    b.shell(wing, [side * 5.83, 6.95, 1.0], 1.40, 1.35, .27);
    b.shell(wing, [side * 5.83, 2.20, 1.04], 1.20, .85, .21, b.m.wetStone);
    b.sweep(wing, [[side * 3.64, 8.94, 1.02], [side * 5.30, 9.46, 1.02], [side * 6.50, 9.51, 1.02], [side * 7.21, 8.8, 1.02], [side * 8.69, 6.55, 1.02]], .30, .33, b.m.carving, V(0, 0, 1), 40);
    b.lathe(wing, [[.24, 0], [.33, .15], [.25, .29], [.22, .54], [.29, .71], [.18, 1.10], [.025, 1.68]], [side * 6.28, 9.55, .49], b.m.carving);
    for (let j = 0; j < 3; j++) b.leaf(wing, [side * (8.15 + j * .15), 1.65 + j * 1.0, .96], [.72, 1.15, .8], [0, 0, side * -.24]);
    scroll(b, group, side * 3.27, 1.85, 1.35, 1.12, side);
  }
  // Carved framing continues behind the projecting bowls, giving the niche a
  // complete solid lower section instead of a familiar isolated ruin arch.
  b.box(group, b.m.stone, [0, 1.21, .51], [7.25, 2.06, 1.54], .10);
  cornice(b, group, [0, 2.18, .55], 7.85, 1.8, b.m.carving, false);
  b.shell(group, [0, 6.28, .82], 2.29, 2.20, -.34, b.m.carving);
  b.lathe(group, [[.15, 0], [.32, .14], [.22, .31], [.17, .58], [.30, .74], [.39, .87], [.37, 1.0], [.05, 1.1]], [0, 5.70, 1.0], b.m.wetStone, [1, 1, .75]);
  carvedBowl(b, group, 'niche-upper-communicating-bowl', [0, 4.25, 2.10], 1.98, .74);
  carvedBowl(b, group, 'niche-lower-communicating-bowl', [0, 1.73, 2.65], 3.18, .87);
  const flow = namedGroup(group, 'niche-cascade-water', { body: 'illustrative-cascade-flow' });
  b.waterArc(flow, [[0, 7.32, 1.20], [0, 6.45, 2.1], [0, 5.42, 2.60], [0, 5.064, 2.65]], .053, 'niche-spout', 'niche-upper-communicating-bowl');
  for (let i = -4; i <= 4; i++) {
    const x = i * .36;
    const lipZ = 2.10 + 1.98 * .96 * .61 * Math.sqrt(1 - (x / (1.98 * .96)) ** 2);
    b.waterArc(flow, [[x, 5.064, lipZ], [x * 1.10, 4.45, 3.54], [x * 1.15, 3.40, 3.90], [x * 1.15, 2.687, 3.90]], .021, `upper-bowl-overflow-${i + 4}`, 'niche-lower-communicating-bowl');
  }
  for (let i = -6; i <= 6; i++) {
    const x = i * .4;
    const lipZ = 2.65 + 3.18 * .96 * .61 * Math.sqrt(1 - (x / (3.18 * .96)) ** 2);
    b.waterArc(flow, [[x, 2.687, lipZ], [x * 1.02, 2.05, 4.5], [x * 1.05, 1.00, 4.9], [x * 1.05, .12, 5.15]], .025, `lower-bowl-overflow-${i + 6}`, 'dashuifa-central-animal-basin');
  }
  return group;
}

function animalEyes(b, parent, x, y, z, spread = .11, size = 1) {
  for (const side of [-1, 1]) {
    b.add(parent, b.prototype('animal-eye', () => new THREE.SphereGeometry(1, 16, 10)), b.m.copperRecess, [x + side * spread, y, z], [.010 * size, .011 * size, .013 * size]);
    b.loft(parent, [[x + side * (spread - .006 * size), y - .004 * size, z - .012 * size, .003 * size, .003 * size], [x + side * (spread - .005 * size), y + .013 * size, z, .004 * size, .004 * size], [x + side * (spread - .006 * size), y + .001 * size, z + .015 * size, .002 * size, .002 * size]], b.m.copper, 10, 10, 0, .001);
  }
}

function hound(b, parent, index, position, rotation) {
  const group = namedGroup(parent, `dashuifa-hound-${String(index + 1).padStart(2, '0')}`, { body: 'cast-copper-hound', evidence: 'animal-count-and-type-supported; anatomy-pose-and-placement-inferred', role: 'one-of-ten-hounds' }); group.position.set(...position); group.rotation.y = rotation;
  const body = namedGroup(group, `${group.name}-body`, { body: 'continuous-anatomical-skin' });
  b.add(body, b.prototype('hound-continuous-sculpture', houndSculptureGeometry), b.m.copper);
  // Posed fore- and hind-limbs are tapered continuous sections, with defined
  // hocks and long paws. At least three feet meet the stone plinth.
  for (const side of [-1, 1]) {
    const foreZ = .40 + (side < 0 ? .12 : -.09), foreX = side * .21;
    b.loft(body, houndAnatomy(side).foreleg, b.m.copper, 13, 23);
    b.loft(body, [[side * .15, 1.06, -.71, .08, .10], [side * .27, .79, -.62, .13, .17], [side * .25, .44, -.91, .065, .083], [side * .26, .12, -.76 + side * .05, .042, .05], [side * .27, .065, -.54 + side * .05, .060, .045]], b.m.copper, 13, 25);
    for (const [z, x] of [[foreZ + .29, foreX * 1.10], [-.54 + side * .05, side * .27]]) {
      b.loft(body, [[x, .063, z - .10, .040, .034], [x, .065, z + .04, .072, .046], [x, .06, z + .135, .043, .028], [x, .054, z + .175, .008, .010]], b.m.copper, 16, 18);
      b.box(body, b.m.copper, [x, .034, z + .015], [.115, .068, .245], .019);
    }
  }
  b.loft(body, [[0, 1.03, -.87, .11, .1], [.06, 1.02, -1.17, .08, .074], [.10, 1.30, -1.48, .059, .056], [.08, 1.60, -1.58, .030, .028], [-.05, 1.72, -1.54, .01, .01]], b.m.copper, 13, 27);
  for (const side of [-1, 1]) {
    b.loft(body, [[side * .045, 1.65, 1.03, .025, .018], [side * .10, 1.70, 1.04, .075, .027], [side * .19, 1.59, .99, .105, .047], [side * .24, 1.37, .94, .075, .042], [side * .22, 1.20, .93, .015, .02]], b.m.copper, 16, 24, .02);
  }
  b.add(body, b.prototype('hound-sculpted-nose', () => blendedEllipsoids([{ center: [0, 1.48, 1.625], radii: [.076, .050, .060] }], { resolution: 40, blend: .008, cutouts: [-1, 1].map(side => ({ center: [side * .043, 1.483, 1.669], radii: [.020, .017, .040] })) })), b.m.copperRecess);
  animalEyes(b, body, 0, 1.625, 1.205, .124, .9);
  const mouth = namedGroup(group, `${group.name}-open-mouth-spout`, { body: 'open-copper-spout', localOutlet: [0, 1.40, 1.63] });
  b.add(mouth, ringGeometry(.031, .022, 0, .042, 32), b.m.copper, [0, 1.402, 1.560], undefined, [Math.PI / 2, 0, 0], true);
  const flow = namedGroup(group, `${group.name}-water`, { body: 'illustrative-mouth-jet' });
  const distance = Math.hypot(position[0], position[2] + 10.2);
  b.waterArc(flow, [[0, 1.40, 1.655], [0, 1.98, 2.4], [0, 1.35, Math.max(3.1, distance - 1.8)], [0, .12 - position[1], Math.max(3.6, distance - .55)]], .021, `${group.name}-jet`, 'dashuifa-central-animal-basin');
  return group;
}

function deer(b, parent) {
  const group = namedGroup(parent, 'dashuifa-deer', { body: 'cast-copper-deer', role: 'one-deer-with-ten-hounds', evidence: 'type-and-count-supported; sculptural-anatomy-and-antlers-inferred' }); group.position.set(0, .37, -10.2); group.rotation.y = -.22;
  const body = namedGroup(group, 'dashuifa-deer-body', { body: 'continuous-deer-skin' });
  b.add(body, b.prototype('deer-continuous-sculpture', deerSculptureGeometry), b.m.copper);
  for (const side of [-1, 1]) {
    b.loft(body, [[side * .20, 1.56, .44, .060, .075], [side * .26, 1.20, .51, .093, .12], [side * .26, .69, .49, .06, .07], [side * .27, .12, .63 + side * .13, .035, .043]], b.m.copper, 14, 27);
    b.loft(body, [[side * .21, 1.55, -.83, .075, .095], [side * .3, 1.15, -.63, .10, .15], [side * .31, .68, -1.07, .056, .071], [side * .30, .12, -.87 + side * .1, .035, .045]], b.m.copper, 14, 27);
    for (const z of [.63 + side * .13, -.87 + side * .1]) for (const split of [-1, 1]) {
      b.loft(body, [[side * .28 + split * .033, .11, z - .05, .031, .069], [side * .28 + split * .036, .075, z + .085, .036, .056], [side * .28 + split * .038, .05, z + .16, .022, .025]], b.m.copperRecess, 12, 10);
      b.box(body, b.m.copperRecess, [side * .28 + split * .035, .04, z + .055], [.061, .08, .19], .015);
    }
  }
  b.loft(body, [[0, 1.92, -1.08, .09, .13], [0, 1.9, -1.32, .12, .09], [0, 1.82, -1.49, .014, .025]], b.m.copper, 16, 18);
  for (const side of [-1, 1]) {
    b.loft(body, [[.05 + side * .07, 2.82, 1.07, .027, .024], [side * .27, 2.97, 1.01, .118, .037], [side * .43, 3.04, .96, .044, .016], [side * .49, 3.045, .94, .009, .009]], b.m.copper, 18, 24);
    const antler = namedGroup(group, `deer-${side < 0 ? 'left' : 'right'}-antler`, { body: 'branching-cast-antler' });
    const anatomy = deerAnatomy(side);
    b.loft(antler, anatomy.antler, b.m.copper, 12, 27);
    for (const branch of anatomy.branches) b.loft(antler, branch, b.m.copper, 10, 18);
  }
  b.add(body, b.prototype('deer-sculpted-nose', () => blendedEllipsoids([{ center: [.05, 2.66, 1.617], radii: [.068, .039, .051] }], { resolution: 40, blend: .007, cutouts: [-1, 1].map(side => ({ center: [.05 + side * .040, 2.665, 1.650], radii: [.018, .012, .026] })) })), b.m.copperRecess);
  animalEyes(b, body, .05, 2.827, 1.258, .119, .85);
  return group;
}

function animalGroup(b, parent) {
  const group = namedGroup(parent, 'dashuifa-eleven-animal-fountain', { body: 'one-deer-ten-hounds', houndCount: 10, deerCount: 1, evidence: 'MIT-view15-and-institution-description', pedestalCaveat: 'Durand located seven of thirteen archaeological pedestals; this does not identify an extra two animals or their exact positions' });
  const pedestals = namedGroup(group, 'animal-stone-plinths', { body: 'inferred-animal-plinth-placement', evidence: HYPOTHESIS });
  b.box(pedestals, b.m.wetStone, [0, -.025, -10.2], [1.45, .79, 3.45], .08);
  deer(b, group);
  const positions = [];
  for (let i = 0; i < 10; i++) {
    const angle = -.97 * Math.PI + i / 9 * 1.94 * Math.PI;
    const x = Math.sin(angle) * 7.25, z = -10.2 + Math.cos(angle) * 5.18;
    const facing = Math.atan2(-x, -10.2 - z); positions.push({ id: `hound-${String(i + 1).padStart(2, '0')}`, position: [x, .37, z], rotation: facing, evidence: HYPOTHESIS });
    b.box(pedestals, b.m.wetStone, [x, -.025, z], [.88, .79, 2.62], .07, [0, facing, 0]);
    hound(b, group, i, [x, .37, z], facing);
  }
  group.userData.animalPlacements = positions;
  return group;
}

function pyramidFountain(b, parent, side) {
  const id = side < 0 ? 'west' : 'east', cx = side * 31, cz = -5.0;
  const group = namedGroup(parent, `dashuifa-${id}-pyramid-fountain`, { body: 'stepped-pyramid-in-round-basin', evidence: 'MIT-view15-and-Durand-court-description', basinDiameter: 18, centre: [cx, cz] });
  const outline = Array.from({ length: 96 }, (_, i) => [cx + Math.cos(i / 96 * TAU) * 9, cz + Math.sin(i / 96 * TAU) * 9]);
  basin(b, group, `dashuifa-${id}-circular-basin`, outline, [cx, cz], { reportedDiameter: 18, evidence: EVIDENCE });
  const tower = namedGroup(group, `dashuifa-${id}-pyramid`, { body: 'complete-carved-fountain-pyramid', evidence: 'print-constrained-proportional-sculpture' }); tower.position.set(cx, 0, cz);
  b.box(tower, b.m.wetStone, [0, .38, 0], [3.80, 1.84, 3.80], .06);
  cornice(b, tower, [0, 1.43, 0], 4.12, 4.12, b.m.carving, false);
  for (let face = 0; face < 4; face++) {
    const panel = namedGroup(tower, `${id}-pyramid-base-carving-${face}`); panel.rotation.y = face * Math.PI / 2;
    b.box(panel, b.m.oldStone, [0, .79, 1.94], [2.75, 1.05, .15], .04);
    b.shell(panel, [0, .30, 2.05], 1.0, .9, .12);
    for (const s of [-1, 1]) scroll(b, panel, s * .85, .76, 2.06, .58, -s);
  }
  for (let level = 0; level < 8; level++) {
    const y = 1.77 + level * 1.46, width = 2.8 - level * .30;
    b.box(tower, b.m.stone, [0, y + .57, 0], [width, 1.14, width], .045);
    cornice(b, tower, [0, y + 1.13, 0], width + .20, width + .20, b.m.carving, false);
    for (let face = 0; face < 4; face++) {
      const panel = namedGroup(tower, `${id}-pyramid-tier-${level + 1}-face-${face}`); panel.rotation.y = face * Math.PI / 2;
      b.box(panel, b.m.oldStone, [0, y + .56, width / 2 + .018], [Math.max(.16, width - .35), .73, .046], .02);
      b.leaf(panel, [0, y + .56, width / 2 + .06], [Math.min(.73, width * .75), .73, .36], [0, 0, 0]);
      for (const s of [-1, 1]) b.box(panel, b.m.carving, [s * (width / 2 - .095), y + .58, width / 2 + .025], [.14, 1.0, .16], .02);
    }
  }
  b.lathe(tower, [[.24, 0], [.39, .24], [.27, .51], [.20, .82], [.075, 1.18], [.015, 1.42]], [0, 13.50, 0], b.m.carving);
  const flows = namedGroup(group, `${id}-pyramid-water-display`, { body: 'illustrative-pyramid-and-mushroom-jets', jetCountEvidence: HYPOTHESIS });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    b.waterArc(flows, [[cx, 14.98, cz], [cx + Math.cos(a) * .35, 16.09, cz + Math.sin(a) * .35], [cx + Math.cos(a) * .85, 15.56, cz + Math.sin(a) * .85], [cx + Math.cos(a) * 3.4, .12, cz + Math.sin(a) * 3.4]], .025, `${id}-pyramid-crown-${i}`, `dashuifa-${id}-circular-basin`);
  }
  // Two rows of mushroom jets follow Durand's description. Counts, diameter
  // and flow are presentation hypotheses rather than measurements.
  for (const [r, n] of [[4.3, 12], [7.6, 20]]) for (let i = 0; i < n; i++) {
    const a = i / n * TAU, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    b.lathe(group, [[.12, -.42], [.14, .1], [.12, .23], [.075, .34], [.045, .43]], [x, 0, z], b.m.copper, [1, 1, 1], 14);
    for (let petal = 0; petal < 5; petal++) {
      const theta = petal / 5 * TAU;
      b.waterArc(flows, [[x, .45, z], [x + Math.cos(theta) * .07, 1.06, z + Math.sin(theta) * .07], [x + Math.cos(theta) * .23, .91, z + Math.sin(theta) * .23], [x + Math.cos(theta) * .52, .12, z + Math.sin(theta) * .52]], .018, `${id}-mushroom-${r}-${i}-${petal}`, `dashuifa-${id}-circular-basin`);
    }
  }
  return group;
}

function dashuifa(b, root) {
  const group = namedGroup(root, 'dashuifa', { body: 'great-fountain-complete-waterworks', facing: 'south', evidence: 'historic-print-and-reported-court-survey' });
  basin(b, group, 'dashuifa-central-animal-basin', basinOutline(), [0, -10.2], { outlineEvidence: 'engraving-constrained-authoring-not-surveyed-outline' });
  dashuifaNiche(b, group); animalGroup(b, group);
  for (const side of [-1, 1]) pyramidFountain(b, group, side);
  b.flush();
}

function screenPanel(b, parent, index, x, z, angle, width, height) {
  const group = namedGroup(parent, `guanshuifa-screen-panel-${index + 1}`, { body: 'thick-carved-stone-screen', evidence: 'five-panel-composition-from-MIT-view16; floral-carving-authored' }); group.position.set(x, 1.19, z); group.rotation.y = angle;
  const face = new THREE.Shape(); face.moveTo(-width / 2, 0); face.lineTo(width / 2, 0); face.lineTo(width / 2, height - .30); face.quadraticCurveTo(0, height + .17, -width / 2, height - .30); face.closePath();
  b.shape(group, face, [0, 0, -.36], .66, b.m.stone, .045);
  b.box(group, b.m.oldStone, [0, height * .48, .32], [width - .80, height - 1.54, .1], .06);
  for (const side of [-1, 1]) {
    b.box(group, b.m.carving, [side * (width / 2 - .13), height * .48, .39], [.29, height - .35, .23], .035);
    b.box(group, b.m.carving, [side * (width / 2 - .34), height * .47, .43], [.09, height - 1.03, .12], .025);
    b.box(group, b.m.stone, [side * (width / 2 - .10), .20, .12], [.60, .40, 1.02], .035);
    b.lathe(group, [[.13, 0], [.24, .12], [.17, .29], [.20, .47], [.11, .62], [.015, .95]], [side * (width / 2 - .09), height + .10, .04], b.m.carving, [1, 1, 1], 22);
  }
  const crown = [[-width / 2 - .08, height - .28, .17], [-width * .25, height - .08, .17], [0, height + .055, .17], [width * .25, height - .08, .17], [width / 2 + .08, height - .28, .17]];
  for (const [dy, w, d] of [[0, .25, .47], [.23, .14, .54], [-.20, .17, .40]]) b.sweep(group, crown.map(([px, py, pz]) => [px, py + dy, pz]), w, d, b.m.carving, V(0, 0, 1), 30);
  b.sweep(group, [[-width / 2 + .36, .52, .44], [0, .52, .44], [width / 2 - .36, .52, .44]], .16, .18, b.m.carving, V(0, 0, 1), 2);
  b.sweep(group, [[-width / 2 + .36, height - .70, .44], [0, height - .50, .44], [width / 2 - .36, height - .70, .44]], .16, .18, b.m.carving, V(0, 0, 1), 24);
  if (index === 2) {
    // The large central cartouche is intentionally described as an authored
    // relief: the small available print cannot establish an exact iconography.
    for (const radius of [1.12, 1.36]) b.sweep(group, Array.from({ length: 65 }, (_, i) => [Math.sin(i / 64 * TAU) * radius, height * .52 + Math.cos(i / 64 * TAU) * radius * 1.54, .61]), .17, .21, b.m.carving, V(0, 0, 1), 64);
    b.shell(group, [0, height * .64, .65], 1.69, 1.38, .30);
    b.shell(group, [0, 1.28, .65], 1.38, 1.42, -.18, b.m.carving, [0, 0, Math.PI]);
    const urn = new THREE.Shape(); urn.moveTo(-.21, 2.30); urn.lineTo(.21, 2.30); urn.lineTo(.25, 2.56); urn.bezierCurveTo(.95, 2.75, .86, 3.66, .40, 3.79); urn.lineTo(.46, 4.01); urn.lineTo(-.46, 4.01); urn.lineTo(-.40, 3.79); urn.bezierCurveTo(-.86, 3.66, -.95, 2.75, -.25, 2.56); urn.closePath();
    b.shape(group, urn, [0, 0, .64], .22, b.m.carving, .06);
    for (const side of [-1, 1]) {
      scroll(b, group, side * 1.05, 3.13, .75, .78, -side);
      b.leaf(group, [side * 1.25, 4.83, .74], [.85, 1.26, .65], [0, 0, side * -.36]);
      b.leaf(group, [side * .72, 2.28, .73], [.92, 1.26, .72], [0, 0, side * .80]);
    }
  } else {
    const direction = index < 2 ? 1 : -1, centerY = height * .48;
    b.sweep(group, [[-.27 * direction, .91, .60], [.19 * direction, 1.8, .60], [-.13 * direction, 2.85, .60], [.15 * direction, 3.84, .60], [-.18 * direction, 4.79, .60], [.03, height - 1.10, .60]], .14, .17, b.m.carving, V(0, 0, 1), 48);
    for (let j = 0; j < 5; j++) {
      const side = j % 2 ? -direction : direction, y = 1.37 + j * .94;
      b.leaf(group, [side * .39, y, .63], [.89 - .035 * j, 1.22, .71], [0, 0, side * -.57]);
      if (j % 2 === 0) b.shell(group, [-side * .41, y + .02, .64], .62, .63, .15, b.m.carving, [0, 0, side * .30]);
    }
    for (const side of [-1, 1]) { scroll(b, group, side * .63, .94, .62, .55, -side); scroll(b, group, side * .59, height - 1.18, .64, .55, side); }
    b.shell(group, [0, centerY - .27, .72], .67, .87, .22);
  }
  // The back remains a fully modeled weather face with coursed stone and
  // continuous cornice; it does not reuse a transparent decoration sheet.
  for (let row = 1; row <= 6; row++) b.box(group, b.m.oldStone, [0, row * (height - .8) / 7, -.387], [width - .17, .021, .024], 0);
  return group;
}

function crane(b, parent, side) {
  const id = side < 0 ? 'east' : 'west';
  const group = namedGroup(parent, `guanshuifa-${id}-copper-crane`, { body: 'standing-copper-crane', evidence: 'copper-cranes-and-relative-position-supported; pose-and-anatomy-inferred' }); group.position.set(side * 4.75, 2.31, 4.18); group.rotation.y = -side * .40;
  const body = namedGroup(group, `guanshuifa-${id}-crane-body`, { body: 'continuous-avian-sculpture' });
  for (const s of [-1, 1]) {
    b.loft(body, [[s * .13, 1.01, -.02, .014, .014], [s * .13, .91, -.02, .024, .026], [s * .14, .51, -.08, .021, .022], [s * .15, .23, .01, .017, .017], [s * .15, .024, .035, .02, .022]], b.m.copper, 12, 24);
    for (const toe of [-1, 0, 1]) b.loft(body, [[s * .15, .035, .02, .018, .018], [s * .15 + toe * .055, .024, .12, .013, .013], [s * .15 + toe * .11, .018, .23 - Math.abs(toe) * .035, .007, .007]], b.m.copper, 8, 10);
    b.loft(body, [[s * .15, .038, .02, .018, .018], [s * .16, .018, -.10, .01, .01], [s * .17, .02, -.16, .007, .007]], b.m.copper, 8, 10);
    b.box(body, b.m.copper, [s * .15, .009, .065], [.036, .018, .17], .006);
  }
  b.add(body, b.prototype('crane-continuous-sculpture', craneSculptureGeometry), b.m.copper);
  b.loft(body, [[.006, 2.30, .56, .023, .017], [.006, 2.285, .76, .024, .017], [.003, 2.27, .99, .007, .005], [0, 2.265, 1.10, .0018, .0015]], b.m.copper, 18, 28, 0, .0014);
  animalEyes(b, body, .006, 2.322, .546, .053, .55);
  for (const sideWing of [-1, 1]) {
    const wing = namedGroup(group, `${id}-crane-${sideWing < 0 ? 'left' : 'right'}-feathered-wing`, { body: 'layered-cast-flight-feathers' });
    for (let feather = 0; feather < 6; feather++) {
      const y = 1.35 - feather * .035, x = sideWing * (.245 - feather * .011), z = .04 - feather * .038;
      b.loft(wing, [[x * .86, y + .06, z + .08, .003, .004], [x, y, z - .09, .006, .008], [sideWing * (.17 - feather * .006), y - .11, z - .28, .005, .007], [sideWing * .08, y - .16, z - .41, .002, .003]], b.m.copper, 10, 20, 0, .001);
    }
  }
  return group;
}

function throne(b, parent) {
  const group = namedGroup(parent, 'guanshuifa-carved-throne', { body: 'carved-stone-throne-and-footrest', facing: 'north-after-parent-transform', evidence: 'engraving-composition; furniture-carving-proportional-study' }); group.position.set(0, 1.19, 2.61);
  b.box(group, b.m.stone, [0, .14, .0], [2.78, .28, 1.87], .065);
  for (const x of [-1.00, 1.00]) for (const z of [-.48, .57]) {
    b.sweep(group, [[x, .24, z], [x * .91, .48, z], [x * .93, .73, z + .02], [x * 1.08, .91, z]], .26, .27, b.m.carving, V(0, 0, 1), 19);
    b.leaf(group, [x, .54, z + .13], [.35, .55, .43], [0, 0, x * -.32]);
  }
  b.box(group, b.m.stone, [0, .95, .04], [2.63, .26, 1.68], .06);
  const back = new THREE.Shape(); back.moveTo(-1.25, 1.04); back.lineTo(1.25, 1.04); back.lineTo(1.17, 2.14); back.bezierCurveTo(.99, 2.18, .86, 2.66, .54, 2.53); back.bezierCurveTo(.33, 2.81, -.33, 2.81, -.54, 2.53); back.bezierCurveTo(-.86, 2.66, -.99, 2.18, -1.17, 2.14); back.closePath();
  b.shape(group, back, [0, 0, -.82], .34, b.m.carving, .06);
  b.shell(group, [0, 1.18, -.44], 1.25, 1.18, .21);
  for (const side of [-1, 1]) {
    b.sweep(group, [[side * 1.08, 1.78, -.60], [side * 1.17, 1.70, -.01], [side * 1.23, 1.48, .56], [side * 1.17, 1.32, .67], [side * 1.04, 1.35, .55]], .23, .26, b.m.carving, V(0, 1, 0), 26);
    b.leaf(group, [side * .80, 1.65, -.37], [.54, .96, .6], [0, 0, side * -.34]);
  }
  const footrest = namedGroup(group, 'throne-footrest', { body: 'stone-footrest' });
  b.box(footrest, b.m.stone, [0, .17, 1.38], [1.88, .34, .79], .045); b.box(footrest, b.m.carving, [0, .35, 1.38], [2.00, .10, .88], .035);
  for (const side of [-1, 1]) scroll(b, footrest, side * .49, .15, 1.79, .30, -side);
  return group;
}

function guanshuifaGate(b, parent, side) {
  const id = side < 0 ? 'east' : 'west', group = namedGroup(parent, `guanshuifa-${id}-side-gate`, { body: 'baroque-garden-gate', evidence: 'MIT-view16; depth-and-rear-treatment-inferred' }); group.position.set(side * 22.9, 0, .1);
  const shape = new THREE.Shape([new THREE.Vector2(-3.15, 0), new THREE.Vector2(3.15, 0), new THREE.Vector2(3.15, 4.10), new THREE.Vector2(-3.15, 4.10)]);
  shape.holes.push(new THREE.Path(archShape(1.98, 3.17, .02).getPoints(36)));
  for (const sideWindow of [-1, 1]) shape.holes.push(new THREE.Path(archShape(.51, 2.02, .82, sideWindow * 2.34).getPoints(24)));
  b.shape(group, shape, [0, 0, -.91], 1.05, b.m.plaster, .025);
  b.sweep(group, archPoints(2.16, 3.36, .03, 0, .23), .20, .25, b.m.carving, V(0, 0, 1), 42);
  b.sweep(group, archPoints(2.16, 3.36, .03, 0, -.98), .18, .19, b.m.carving, V(0, 0, 1), 42);
  for (const s of [-1, 1]) {
    column(b, group, `${id}-gate-column-${s}`, [s * 1.38, 0, .30], 3.88, .17);
    windowFrame(b, group, `${id}-gate-side-recess-${s}`, s * 2.34, .82, .51, 2.02, false, false);
  }
  cornice(b, group, [0, 4.01, -.33], 6.61, 1.89, b.m.carving, false);
  hipRoof(b, group, `${id}-gate-tiled-cap`, 0, -.34, 6.90, 2.6, 4.34, 1.24);
  const pediment = new THREE.Shape(); pediment.moveTo(-1.90, 4.10); pediment.lineTo(1.90, 4.10); pediment.bezierCurveTo(1.34, 4.36, .88, 4.77, 0, 5.15); pediment.bezierCurveTo(-.88, 4.77, -1.34, 4.36, -1.90, 4.10); pediment.closePath();
  b.shape(group, pediment, [0, 0, .62], .29, b.m.carving, .04); b.shell(group, [0, 4.10, .93], .95, .69, .18);
  for (const s of [-1, 1]) scroll(b, group, s * 1.29, 4.24, .90, .51, -s);
  return group;
}

function guanshuifa(b, root) {
  const group = namedGroup(root, 'guanshuifa', { body: 'north-facing-throne-and-five-stone-screens', facing: 'north', evidence: 'MIT-view16-and-north-south-axis' }); group.position.z = 26.0; group.rotation.y = Math.PI;
  const stage = namedGroup(group, 'guanshuifa-solid-curved-stage', { body: 'seven-riser-viewing-stage', evidence: 'engraving-constrained-proportions', riser: .17 });
  for (let step = 0; step < 7; step++) {
    const r = 11.28 - step * .31, bulge = 3.0 - step * .22, points = [[-r, -1.82], [r, -1.82]];
    for (let j = 0; j <= 48; j++) { const a = j / 48 * Math.PI; points.push([r * Math.cos(a), 3.00 + bulge * Math.sin(a)]); }
    const part = namedGroup(stage, `guanshuifa-stage-step-${step + 1}`, { body: 'solid-stair-tread', top: (step + 1) * .17 });
    b.polygon(part, points, -.02, (step + 1) * .17, b.m.stone);
    b.sweep(part, points.slice(2).map(([x, z]) => [x, (step + 1) * .17 - .018, z]), .12, .09, b.m.carving, V(0, 1, 0), 52);
  }
  const screens = namedGroup(group, 'guanshuifa-five-screen-backdrop', { body: 'five-connected-stone-screens', panelCount: 5, evidence: 'MIT-view16' });
  screenPanel(b, screens, 0, -7.48, 1.35, .20, 3.25, 7.10);
  screenPanel(b, screens, 1, -3.94, .52, .10, 3.61, 7.52);
  screenPanel(b, screens, 2, 0, .16, 0, 4.25, 7.77);
  screenPanel(b, screens, 3, 3.94, .52, -.10, 3.61, 7.52);
  screenPanel(b, screens, 4, 7.48, 1.35, -.20, 3.25, 7.10);
  throne(b, group);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'east' : 'west', pedestal = namedGroup(group, `guanshuifa-${id}-crane-pedestal`, { body: 'lotus-crane-pedestal' }); pedestal.position.set(side * 4.75, 1.19, 4.18);
    b.box(pedestal, b.m.stone, [0, .12, 0], [1.25, .24, 1.25], .035);
    b.lathe(pedestal, [[.48, .24], [.55, .35], [.41, .45], [.29, .65], [.44, .77], [.57, .90], [.52, 1.04], [.39, 1.12]], [0, 0, 0], b.m.carving, [1, 1, 1], 32);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU; b.leaf(pedestal, [Math.sin(a) * .39, .72, Math.cos(a) * .39], [.33, .48, .3], [0, a, 0]);
    }
    crane(b, group, side); guanshuifaGate(b, group, side);
    const wall = namedGroup(group, `guanshuifa-${id}-garden-wall`, { body: 'screen-flanking-garden-wall', evidence: 'engraving-constrained-proportion' });
    b.box(wall, b.m.plaster, [side * 15.87, 1.68, -.20], [7.52, 3.36, .67], .03);
    b.box(wall, b.m.stone, [side * 15.87, .23, -.16], [7.65, .46, .85], .025);
    cornice(b, wall, [side * 15.87, 3.33, -.20], 7.74, .82, b.m.carving, false);
  }
  b.contacts.push({ id: 'guanshuifa-stage', ground: 'court-paving', point: [0, 0, 20.10], underside: -.02, firstTread: .17, evidence: 'authored-contact' });
  b.flush(); return group;
}

function cutLineSegments(holes, ordinate, horizontal, lo, hi) {
  const blocked = [];
  for (const points of holes) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], c = points[(i + 1) % points.length], ai = horizontal ? a[1] : a[0], ci = horizontal ? c[1] : c[0];
      if ((ai <= ordinate && ci > ordinate) || (ci <= ordinate && ai > ordinate)) crossings.push((horizontal ? a[0] : a[1]) + (ordinate - ai) / (ci - ai) * ((horizontal ? c[0] : c[1]) - (horizontal ? a[0] : a[1])));
    }
    crossings.sort((a, c) => a - c); for (let i = 0; i + 1 < crossings.length; i += 2) blocked.push([crossings[i] - .22, crossings[i + 1] + .22]);
  }
  blocked.sort((a, c) => a[0] - c[0]); const result = []; let left = lo;
  for (const [a, c] of [...blocked, [hi, hi]]) { if (a > left + .03) result.push([left, Math.min(hi, a)]); left = Math.max(left, c); }
  return result.filter(([a, c]) => c > a + .03);
}

function court(b, root) {
  const group = namedGroup(root, 'measured-fountain-court', { body: '110-by-60-metre-depressed-court', measuredDimensions: { x: 110, z: 60 }, courtDatum: 0, surroundingGrade: 1.30, evidence: EVIDENCE });
  const holes = [basinOutline(), ...[-1, 1].map(side => Array.from({ length: 96 }, (_, i) => [side * 31 + Math.cos(i / 96 * TAU) * 9, -5 + Math.sin(i / 96 * TAU) * 9]))];
  const paving = namedGroup(group, 'court-paving', { body: 'paving-with-three-actual-basin-cutouts', top: 0, evidence: 'reported-court-envelope-and-authored-joints' });
  b.polygon(paving, [[-55, -30], [55, -30], [55, 30], [-55, 30]], -.65, 0, b.m.paving, holes);
  const joints = namedGroup(group, 'court-paving-joints', { body: 'paving-joints-that-stop-at-water' });
  for (let z = -28.7; z < 30; z += 1.44) for (const [a, c] of cutLineSegments(holes, z, true, -54.5, 54.5)) b.box(joints, b.m.oldStone, [(a + c) / 2, .004, z], [c - a, .012, .018], 0);
  for (let x = -54.2; x < 55; x += 1.44) for (const [a, c] of cutLineSegments(holes, x, false, -29.5, 29.5)) b.box(joints, b.m.oldStone, [x, .004, (a + c) / 2], [.018, .012, c - a], 0);
  const border = namedGroup(group, 'court-border-and-grade', { body: 'retained-court-edge', gradeDifference: 1.3, evidence: EVIDENCE });
  for (const side of [-1, 1]) {
    b.box(border, b.m.oldStone, [side * 55.34, .34, 0], [.68, 1.96, 60], .015);
    b.box(border, b.m.carving, [side * 55.35, 1.33, 0], [.84, .10, 60.1], .02);
    b.box(border, b.m.earth, [side * 56.65, .93, 0], [1.80, .80, 60], 0);
  }
  b.box(border, b.m.earth, [0, .93, 31.25], [115.1, .80, 2.5], 0);
  const paths = namedGroup(group, 'court-inlaid-axis-paths', { body: 'low-contrast-stone-path-borders', evidence: 'engraving-constrained-exhibition-paving' });
  for (const x of [-1.85, 1.85]) b.box(paths, b.m.carving, [x, .011, 10.20], [.13, .025, 19.2], 0);
  for (const side of [-1, 1]) {
    const cx = side * 31;
    for (const [w, d, z] of [[15.2, 8.9, 17.7]]) {
      b.box(paths, b.m.carving, [cx, .014, z - d / 2], [w, .03, .14], .012); b.box(paths, b.m.carving, [cx, .014, z + d / 2], [w, .03, .14], .012);
      b.box(paths, b.m.carving, [cx - w / 2, .014, z], [.14, .03, d], .012); b.box(paths, b.m.carving, [cx + w / 2, .014, z], [.14, .03, d], .012);
    }
  }
  b.flush(); return group;
}

function diagnosticsFor(root, b) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root), meshes = [], subassemblies = [];
  let triangleCount = 0;
  root.traverse(object => {
    if (object.isMesh) { const triangles = (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; triangleCount += triangles; meshes.push({ name: object.name, triangles }); }
    if (!object.isGroup || object === root) return;
    let meshCount = 0, count = 0; object.traverse(child => { if (child.isMesh) { meshCount++; count += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3; } });
    if (meshCount) { const box = new THREE.Box3().setFromObject(object); subassemblies.push({ name: object.name, body: object.userData.body ?? null, meshCount, triangleCount: count, bounds: { min: box.min.toArray(), max: box.max.toArray() } }); }
  });
  const supported = [
    'Yuanyingguan north, Dashuifa in the centre, Guanshuifa south facing north',
    'Durand reports court 110×60 m, depression 1.30 m, paired circular basins Ø18 m with centres 62 m apart',
    'Terrace 35×about31 m is separate from the 28×21 m building wall-line control; Durand reports about0.50 m accuracy',
    'South building composition, grape-pattern columns, central fountain niche and flanking pyramid fountains',
    'One deer and ten hounds are separate from the twelve zodiac figures at Haiyantang',
    'Five-screen north-facing viewing throne, curved stairs, side gates and copper cranes',
  ];
  const inferred = [
    '1859–1860 complete exterior assembled mainly from earlier engravings; no claim that every 1780s detail remained unchanged until1859',
    'Northern building plan, rooms, lateral fenestration and back elevations lack a resolved surveyed reconstruction',
    'Five autonomous roof systems follow Durand’s explicitly hypothetical reconstruction; roof tile colours are provisional',
    'Architectural heights, room depths, cornice projections and detailed ornamental patterns are authored proportional interpretations',
    'Court-relative north/south offsets are proportional placement; reported dimensions do not supply a complete coordinate survey',
    'Hound and deer anatomy, poses, exact pedestal locations and bronze coloration are inferred; thirteen archaeological pedestals do not prove thirteen animals',
    'Crane anatomy, screen-panel relief iconography, furniture detail and gate backs are inferred from small front-view prints',
    'Fountain jets depict an illustrative running state, with inferred pipe trajectories, flow rates and mushroom-jet counts',
  ];
  return {
    assetId: 'yuanyingguan-dashuifa-guanshuifa', version: 1, units: 'metres', coordinates: { up: '+Y', south: '+Z', east: '+X', principalView: 'from-south-looking-north' }, timeLayer: '1859–1860-before-destruction',
    visualAcceptance: false, integrationAcceptance: false, supported, inferred, supportedFeatures: supported, inferredFeatures: inferred, sourceViews: SOURCE_VIEWS.map(source => ({ ...source })),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(V(0, 0, 0)).toArray() }, triangleCount, triangles: triangleCount, meshCount: meshes.length,
    materials: [...b.materials].map(material => ({ name: material.name, category: material.userData.category, type: material.type, colour: `#${material.color.getHexString()}`, evidence: material.userData.evidence })),
    subassemblies, measurements: { court: { x: 110, z: 60, depression: 1.3, evidence: EVIDENCE }, terrace: { x: 35, z: 31, northSouthApproximate: true, evidence: EVIDENCE }, building: { x: 28, z: 21, reportedAccuracy: .5, evidence: EVIDENCE }, pairedPools: { diameter: 18, centreDistance: 62, evidence: EVIDENCE } },
    provisionalScale: { isProvisional: true, reason: 'Metric controls are reported measurements; the full scene is not registered to a Qing as-built plan.' },
    contacts: b.contacts.map(contact => ({ ...contact })), openingChecks: b.openings.map(opening => ({ ...opening })), waterEndpoints: b.waterEndpoints.map(endpoint => ({ ...endpoint })),
    resourceOwnership: { scope: 'one-factory-invocation', geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, temporaryGeometryDisposals: b.temporaryGeometryDisposals, moduleGlobalCache: false, disposalIsIdempotent: true },
    sourceLimitations: ['Durand p130 depicts Fangwaiguan, not Yuanyingguan: it was inspected but is not treated as a direct Yuanyingguan facade source.', 'The 710px survey page is a public rendering; no centimetre-level reading is claimed.', 'Current management-office1783 date and Durand’s preference for Jesuit1768 dating remain attributed disagreement; this asset does not resolve it.'],
  };
}

export function createYuanyingguanStudy() {
  const b = new AssetBuilder(), group = new THREE.Group(); group.name = 'yuanyingguan-dashuifa-guanshuifa-study';
  group.userData = { assetId: 'yuanyingguan-dashuifa-guanshuifa', body: 'independent-source-constrained-study', historicalLayer: '1859–1860-before-destruction', visualAcceptance: false, publicSourceImagesEmbedded: false };
  try {
    court(b, group); yuanyingguan(b, group); dashuifa(b, group); guanshuifa(b, group); b.releasePrototypes();
    const diagnostics = diagnosticsFor(group, b);
    return { group, diagnostics, update(time) { if (!b.disposed) b.water.update(time); }, dispose() { if (b.disposed) return; b.dispose(); group.clear(); } };
  } catch (error) { b.dispose(); group.clear(); throw error; }
}
