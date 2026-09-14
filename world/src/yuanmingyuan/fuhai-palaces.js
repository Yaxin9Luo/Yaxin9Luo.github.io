import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, TAU, namedGroup, extrudedPolygon } from './study-geometry.js';
import { chineseHipPoint, chineseHipRafterPath, chineseHipRoofGeometry, chineseGablePoint, chineseGableRoofGeometry, chineseCrossEavePoint, chineseCrossEaveGeometry, chineseCrossGablePoint, chineseCrossGableGeometry, crossPlanOutline, ridgeBeastGeometry, pyramidalFinialGeometry, stoneLotusPetalGeometry, gableInfillGeometry, roofTileRollGeometry, bracketArmGeometry, bridgeDeckGeometry, quarriedMasonryBlockGeometry, clipPavingCell } from './chinese-architecture-geometry.js';
import { createFuhaiCaihuaTexture } from './fuhai-paintwork.js';
import { gardenLayout, getGardenGroup } from './garden-layout.js';

const INFERRED = 'authored-proportions-not-surveyed';
const SOURCES = [
  { id: 'fanghu-bnf-1744', type: 'historic-painting-catalogue', url: 'https://catalogue.bnf.fr/ark:/12148/cb43818430f', label: '方壺勝境，1744，BnF RESERVE B-9-FT6 vue29', limit: 'Painting dimensions in the catalogue are not building measurements.' },
  { id: 'pengdao-bnf-1744', type: 'historic-painting-catalogue', url: 'https://catalogue.bnf.fr/ark:/12148/cb43818854j', label: '蓬島瑤臺，1744，BnF RESERVE B-9-FT6 vue32', limit: 'An earlier view, not a complete 1859–1860 construction survey.' },
  { id: 'fanghu-painting-viewed', type: 'historic-painting-reproduction', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness/image/ymy1029_66_Fanghu18421.jpg', label: 'MIT Visualizing Cultures reproduction of scene29', limit: 'Inspected: central axis, three projecting pavilions, white terraces, red timber, layered roofs. Perspective was not converted into metric dimensions.' },
  { id: 'pengdao-painting-viewed', type: 'historic-painting-reproduction', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness/image/ymy1032_72_Pengdao17135.jpg', label: 'MIT Visualizing Cultures reproduction of scene32', limit: 'Inspected: low front court, higher main roofs, small flanking islands, bridge and landing relationships.' },
  { id: 'fanghu-park', type: 'institutional-description', url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ymy/fhjq/201101/t20110105_231470.html', label: '圆明园管理处：方壶胜境', limit: 'Supports three front double-eave pavilions, 山-shaped white stone bases, yellow glazed tiles, three symmetric groups and nine rear halls; dimensions absent.' },
  { id: 'pengdao-park', type: 'institutional-description', url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ymy/fhjq/201101/t20110105_231469.html', label: '圆明园管理处：蓬岛瑶台', limit: 'Three rocky islands; the current restored west-island photograph is not an original Qing view.' },
  { id: 'guo-forty-scenes', type: 'attributed-research', url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj035/201611/t20161113_1317935.html', label: '郭黛姮：《圆明园四十景》图的价值', limit: 'Jingzhongge three-bay gate and one-bay xieshan loft, four dougong groups on each loft face, blue-green decoration and red cross-lattice windows. Details outside that description are inferred.' },
  { id: 'pengdao-theatre-research', type: 'attributed-research', url: 'https://www.yuanmingyuanpark.cn/xs/yjbg/202108/t20210831_4483509.html', label: '圆明园戏场研究，1.14 蓬岛瑶台戏台', limit: 'Two-juan seven-bay main hall with five-bay front baosha; the theatre plan is explicitly unknown, so no invented stage is included.' },
  { id: 'pengdao-old-record-via-park', type: 'institutional-quotation-of-historical-text', url: 'https://www.yuanmingyuanpark.cn/ts/tgs/202608/t20260803_4824124.html', label: '端午节龙舟竞渡，引《钦定日下旧闻考》卷八十二', limit: 'Three-bay south gate, seven-bay hall, east-island Yinghai Xianshan pavilion, northwest island hall. The current draft east-island placement has not been registered to the southeast bridge wording.' },
  { id: 'nlc-fanghu-bronzes', type: 'primary-design-drawing', url: 'https://www.nlc.cn/nmcb/gcjpdz/ysl/zxcs/', label: '国图样式雷：方壶胜境铜龙立样准底、铜凤立样糙底', limit: 'Both drawings inspected. Their rectangular ornamental pedestals do not establish roof placement; neither has been arbitrarily installed as a ridge ornament.' },
  { id: 'npm-fanghu-roof-types', type: 'attributed-institutional-research', url: 'https://theme.npm.edu.tw/Academic/ChineseArtDownload.ashx?bid=7190&eid=413', label: '林莉娜，貌寫圓明園，故宮文物月刊451，p58', limit: 'Full PDF and p58 inspected: Yingxun has a double-eave pyramidal roof; Jirui and Ningxiang have cross-ridged upper roofs. Local framing, dimensions and ornament remain inferred.' },
  { id: 'dpm-pyramidal-finial', type: 'comparable-historic-building', url: 'https://www.dpm.org.cn/explore/building/236464.html', label: '故宫中和殿：攒尖顶与铜胎鎏金宝顶', limit: 'Institutional photograph inspected to distinguish a single pyramidal finial from paired ridge-end ornaments. It is not a Fanghu detail or dimensional source.' },
  { id: 'dpm-glazed-ridge-dragon', type: 'comparable-historic-building-component', url: 'https://www.dpm.org.cn/collection/sculpture/233702.html', label: '故宫琉璃龙吻建筑构件，新00143729', limit: 'Ming object photograph inspected for rounded head, muzzle, curved body and upturned tail. Fanghu ornament remains authored, not a copy or a claim of the same Ming component.' },
];

function grainTexture(normal = false) {
  const size = 64, data = new Uint8Array(size * size * 4); let seed = 0x795523;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296 - .5, i = (y * size + x) * 4;
    if (normal) { data[i] = 128 + noise * 5; data[i + 1] = 128 + noise * 5; data[i + 2] = 255; }
    else data[i] = data[i + 1] = data[i + 2] = 239 + noise * 12;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size); texture.name = `fuhai-micrograin-${normal ? 'normal' : 'roughness'}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.needsUpdate = true; return texture;
}

class Builder {
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
      pavingLight: make('light-grey-paving-slabs', 'masonry', { ...mineral, color: 0xb8b6a9, roughness: .94 }),
      quayStone: make('quarried-grey-limestone', 'masonry', { ...mineral, color: 0xa7a594, roughness: .93 }),
      quayStoneShade: make('quarried-grey-limestone-shade', 'masonry', { ...mineral, color: 0x9d9d8f, roughness: .95 }),
      plaster: make('warm-lime-panels', 'plaster', { ...mineral, color: 0xd9cfb4, roughness: .94 }),
      red: make('vermilion-timber', 'timber', { ...mineral, color: 0x983c2a, roughness: .69 }),
      darkWood: make('deep-red-recessed-wood', 'timber', { ...mineral, color: 0x542b24, roughness: .81 }),
      blue: make('caihua-mineral-blue', 'painted-wood', { color: 0x3c6476, roughness: .81 }),
      green: make('caihua-mineral-green', 'painted-wood', { color: 0x477b68, roughness: .79 }),
      caihua: make('caihua-scroll-fangxin-paintwork', 'painted-wood', { color: 0xffffff, map: caihuaMap, roughness: .78, metalness: .04 }),
      paper: make('warm-window-lining', 'paper', { color: 0xbaa989, roughness: .96, side: THREE.DoubleSide }),
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
    if (scale.some(v => v <= 0)) throw new Error('Fuhai architecture requires positive scales.');
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

function circle(radius, sides = 16, x = 0, z = 0) { return Array.from({ length: sides }, (_, i) => [x + radius * Math.cos(i / sides * TAU), z + radius * Math.sin(i / sides * TAU)]); }

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

function latticePanel(b, parent, name, center, width, height, material, { lowerPanel = true, cross = false, lining = false } = {}) {
  const group = namedGroup(parent, name, { body: 'solid-wood-lattice-with-open-holes', evidence: INFERRED, mergeIntoParent: true }); group.position.set(...center);
  const rail = .075, lower = lowerPanel ? height * .28 : 0;
  for (const sx of [-1, 1]) b.box(group, material, [sx * (width - rail) / 2, height / 2, 0], [rail, height, .10]);
  for (const y of [.04, height - .04]) b.box(group, material, [0, y, 0], [width, rail, .10]);
  if (lowerPanel) {
    b.box(group, b.m.darkWood, [0, lower / 2, -.025], [width - .12, lower, .08]);
    b.box(group, material, [0, lower / 2, .028], [width - .23, Math.max(.08, lower - .16), .035]);
    b.box(group, b.m.gold, [0, lower + .02, .055], [width - .13, .028, .018]);
    for (const side of [-1, 1]) b.box(group, b.m.gold, [side * (width - .31) / 2, lower / 2, .052], [.010, Math.max(.06, lower - .25), .015]);
    for (const y of [.13, lower - .13]) b.box(group, b.m.gold, [0, y, .052], [Math.max(.08, width - .31), .010, .015]);
    const belt = Math.min(.26, height * .075);
    b.box(group, b.m.darkWood, [0, lower + belt / 2 + .035, -.012], [width - .14, belt, .07]);
    for (let x = -width / 2 + .17; x < width / 2 - .13; x += .14) {
      const a = .035 + belt / 2;
      b.rod(group, b.m.gold, [x - .050, lower + a, .044], [x, lower + a + .065, .044], .011, 5);
      b.rod(group, b.m.gold, [x, lower + a + .065, .044], [x + .050, lower + a, .044], .011, 5);
    }
  }
  const low = lower + (lowerPanel ? Math.min(.26, height * .075) + .10 : .10), high = height - .13;
  if (cross) {
    b.box(group, material, [0, (low + high) / 2, .017], [.060, high - low, .065]);
    b.box(group, material, [0, (low + high) / 2, .017], [width - .16, .06, .065]);
  } else {
    // Small framed cells and diamonds read as worked timber joinery, rather
    // than a few full-height bars. The interstices remain actual mesh holes.
    const nx = Math.max(2, Math.round((width - .20) / .18)), ny = Math.max(3, Math.round((high - low) / .26));
    const left = -width / 2 + .11, cellWidth = (width - .22) / nx, cellHeight = (high - low) / ny;
    for (let col = 0; col <= nx; col++) b.box(group, material, [left + col * cellWidth, (low + high) / 2, .012], [.022, high - low, .048]);
    for (let row = 0; row <= ny; row++) b.box(group, material, [0, low + row * cellHeight, .012], [width - .20, .024, .048]);
    for (let col = 0; col < nx; col++) for (let row = 0; row < ny; row++) if ((col + row) % 2 === 0) {
      const x = left + (col + .5) * cellWidth, y = low + (row + .5) * cellHeight, dx = cellWidth * .40, dy = cellHeight * .40;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.rod(group, material, [x + sx * dx, y, .018], [x, y + sy * dy, .018], .011, 5);
    }
    for (const x of [left - .020, -left + .020]) b.box(group, b.m.gold, [x, (low + high) / 2, .043], [.012, high - low, .015]);
  }
  if (lining) b.box(group, b.m.paper, [0, (low + high) / 2, -.045], [width - .17, high - low, .012]);
  return group;
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
    const finial = namedGroup(parent, `${parent.name}-pyramidal-finial`, { body: 'single-baoding-capping-the-pyramidal-apex', sourceIds: ['npm-fanghu-roof-types', 'dpm-pyramidal-finial'], evidence: 'apex-finial-type-supported-profile-and-gilding-inferred' });
    b.add(finial, b.prototype('waisted-pearl-pyramidal-finial', pyramidalFinialGeometry), b.m.gold, [0, y, 0], [scale, scale, scale]);
    return;
  }
  b.tube(parent, tile, [[-width / 2, y + .10, 0], [0, y + .10, 0], [width / 2, y + .10, 0]], .13 * scale, 16, 8);
  for (const side of [-1, 1]) {
    const beast = namedGroup(parent, `${parent.name}-ridge-beast-${side}`, { body: 'rounded-glazed-ridge-end-beast', sourceId: 'dpm-glazed-ridge-dragon', evidence: 'ridge-silhouette-visible-three-dimensional-sculpture-inferred', mergeIntoParent: true });
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

function crossEaveRoof(b, parent, name, options, material) {
  const group = namedGroup(parent, name, { body: 'cross-plan-curved-eave-ring', evidence: 'cross-plan-supported-by-NPM-p58-local-profile-inferred', dimensions: { ...options, depth: options.width, topDepth: options.topWidth } });
  const shell = namedGroup(group, `${name}-shell`, { body: 'closed-cross-plan-roof-shell-with-central-opening' });
  b.add(shell, chineseCrossEaveGeometry(options), material, undefined, undefined, undefined, true);
  const tiles = namedGroup(group, `${name}-overlapping-tiles`, { body: 'individual-overlapping-glazed-barrel-tiles' });
  const outline = crossPlanOutline(options.width, options.armWidth);
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge], c = outline[(edge + 1) % outline.length], count = Math.max(3, Math.floor(Math.hypot(c[0] - a[0], c[1] - a[1]) / .28));
    for (let i = 0; i < count; i++) tiledRun(b, tiles, t => chineseCrossEavePoint(options, edge, (i + .5) / count, t), 1, material, i + edge * 11);
  }
  const edgework = namedGroup(group, `${name}-ridges-and-eaves`, { body: 'glazed-hip-and-valley-junctions' });
  for (let edge = 0; edge < 12; edge++) {
    b.tube(edgework, b.m.yellowTile, Array.from({ length: 21 }, (_, i) => chineseCrossEavePoint(options, edge, i / 20, 0).add(V(0, .04, 0))), .073, 24, 7);
    b.tube(edgework, b.m.blueTile, Array.from({ length: 17 }, (_, i) => chineseCrossEavePoint(options, edge, 0, i / 16).add(V(0, .09, 0))), .092, 20, 7);
  }
  const rafters = namedGroup(group, `${name}-curved-timber-rafters`, { body: 'cross-pavilion-roof-rafters' });
  for (let edge = 0; edge < 12; edge++) for (const u of [.2, .5, .8]) b.tube(rafters, b.m.red, Array.from({ length: 9 }, (_, i) => chineseCrossEavePoint(options, edge, u, i / 8).add(V(0, -.20, 0))), .115, 14, 7);
  return group;
}

function crossUpperRoof(b, parent, name, { width, armWidth, eaveY }, material) {
  const group = namedGroup(parent, name, { body: 'cross-ridged-upper-xieshan-roof', sourceId: 'npm-fanghu-roof-types', evidence: 'cross-ridge-type-supported-exact-valleys-and-trusses-inferred' });
  const shell = namedGroup(group, `${name}-shell`, { body: 'continuous-cross-upper-roof-shell' });
  const a = width / 2 - .60, arm = armWidth - 1.40, breakY = eaveY + .75, rise = 2.05;
  crossEaveRoof(b, shell, `${name}-hip-skirt`, { width: width + 1.50, armWidth: armWidth + 2.30, topWidth: a * 2, topArmWidth: arm, eaveY, rise: .75, thickness: .17, cornerLift: .22 }, material);
  const options = { width: a * 2, armWidth: arm, eaveY: breakY, rise, thickness: .17 };
  b.add(shell, chineseCrossGableGeometry(options), material, undefined, undefined, undefined, true);
  const tiles = namedGroup(group, `${name}-cross-overlapping-tiles`, { body: 'individual-overlapping-glazed-barrel-tiles' });
  const halfArm = arm / 2, rows = Math.max(6, Math.floor(a * 2 / .28));
  for (const axis of [0, 1]) for (const side of [-1, 1]) for (let row = 0; row < rows; row++) {
    const fixed = -a + (row + .5) * a * 2 / rows, reach = Math.min(halfArm, Math.abs(fixed)); if (reach < .025) continue;
    tiledRun(b, tiles, t => chineseCrossGablePoint(options, axis ? side * reach * (1 - t) : fixed, axis ? fixed : side * reach * (1 - t)), 1, material, row + axis * 13);
  }
  const gables = namedGroup(group, `${name}-four-painted-gables`, { body: 'four-decorated-gable-frontons' });
  for (const axis of [0, 1]) for (const side of [-1, 1]) {
    const face = namedGroup(gables, `${name}-gable-${axis}-${side}`, { body: 'painted-timber-gable-infill', mergeIntoParent: true });
    face.position.set(axis ? 0 : side * (a - .015), breakY, axis ? side * (a - .015) : 0); face.rotation.y = axis ? Math.PI / 2 : 0;
    const infill = gableInfillGeometry(arm, rise, .18);
    for (let i = 0; i < infill.attributes.uv.count; i++) infill.attributes.uv.setXY(i, (infill.attributes.position.getZ(i) + halfArm) / arm, infill.attributes.position.getY(i) / rise);
    b.add(face, infill, b.m.caihua, undefined, undefined, undefined, true);
    for (const slope of [-1, 1]) {
      const points = Array.from({ length: 15 }, (_, i) => V(side * .11, rise * (i / 14) ** 1.5 - .02, slope * halfArm * (1 - i / 14)));
      b.tube(face, b.m.yellowTile, points, .085, 20, 7);
    }
    b.box(face, b.m.gold, [side * .12, -.05, 0], [.025, .033, arm]);
  }
  for (const axis of [0, 1]) {
    const ridge = namedGroup(group, `${name}-cross-ridge-${axis}`, { body: 'one-axis-of-continuous-cross-ridge' }); ridge.rotation.y = axis * Math.PI / 2;
    roofRidge(b, ridge, a * 2, breakY + rise, b.m.blueTile, .78);
  }
  return group;
}

function frameStorey(b, parent, name, { width, depth, bays = 3, floor, columnHeight, enclosed = true, lattice = b.m.red, loft = false, openEnds = false }) {
  const group = namedGroup(parent, name, { body: 'painted-timber-frame-with-real-openings', evidence: INFERRED, width, depth, floor, columnHeight, bays });
  const frame = namedGroup(group, `${name}-columns-and-beams`, { body: 'timber-columns-and-continuous-beams' });
  const xPositions = Array.from({ length: bays + 1 }, (_, i) => -width / 2 + i * width / bays), sideBays = Math.max(2, Math.round(depth / (width / bays)));
  for (const z of [-depth / 2, depth / 2]) for (const x of xPositions) {
    column(b, frame, x, z, floor, columnHeight, Math.max(.14, Math.min(.26, width / bays * .059)));
    if (!loft) dougong(b, frame, [x, floor + columnHeight, z], .84, z > 0 ? 0 : Math.PI);
  }
  for (const side of [-1, 1]) for (let i = 1; i < sideBays; i++) {
    const z = -depth / 2 + i * depth / sideBays;
    column(b, frame, side * width / 2, z, floor, columnHeight, .18);
    if (!loft) dougong(b, frame, [side * width / 2, floor + columnHeight, z], .84, side * Math.PI / 2);
  }
  if (loft) for (let face = 0; face < 4; face++) {
    const elevation = namedGroup(frame, `${name}-loft-dougong-face-${face + 1}`, { body: 'four-dougong-on-one-loft-face', sourceId: 'guo-forty-scenes' });
    for (const u of [-.375, -.125, .125, .375]) {
      const p = face === 0 ? [u * width, floor + columnHeight, depth / 2] : face === 1 ? [width / 2, floor + columnHeight, -u * depth] : face === 2 ? [-u * width, floor + columnHeight, -depth / 2] : [-width / 2, floor + columnHeight, u * depth];
      dougong(b, elevation, p, .60, face * Math.PI / 2);
    }
  }
  for (const z of [-depth / 2, depth / 2]) {
    for (let i = 0; i < bays; i++) paintedBeam(b, frame, [xPositions[i], z], [xPositions[i + 1], z], floor + columnHeight - .20, loft ? .42 : .48);
    b.box(frame, b.m.green, [0, floor + columnHeight + (loft ? .60 : .84), z + Math.sign(z) * (loft ? .35 : .50)], [width + .5, .29, .34]);
  }
  for (const x of [-width / 2, width / 2]) {
    for (let i = 0; i < sideBays; i++) paintedBeam(b, frame, [x, -depth / 2 + i * depth / sideBays], [x, -depth / 2 + (i + 1) * depth / sideBays], floor + columnHeight - .20, loft ? .42 : .48);
    b.box(frame, b.m.green, [x + Math.sign(x) * (loft ? .35 : .50), floor + columnHeight + (loft ? .60 : .84), 0], [.34, .29, depth + .7]);
  }
  if (enclosed) {
    const joinery = namedGroup(group, `${name}-doors-and-windows`, { body: 'open-central-doors-and-lattice-windows' });
    for (const z of [-depth / 2 + .12, depth / 2 - .12]) for (let bay = 0; bay < bays; bay++) {
      const center = -width / 2 + (bay + .5) * width / bays, bayWidth = width / bays - .37;
      if (bay === Math.floor(bays / 2) && !loft) {
        // Two door leaves fold against the jambs. No wall or glazing crosses the
        // central opening, including at the rear of a through-gate.
        for (const side of [-1, 1]) {
          const leaf = latticePanel(b, joinery, `${name}-open-door-${z}-${side}`, [center + side * bayWidth * .45, floor + .06, z], bayWidth * .42, columnHeight - .48, lattice);
          leaf.rotation.y = side * Math.PI * .43;
        }
      } else {
        const panels = loft ? 1 : Math.max(2, Math.round(bayWidth / .83));
        for (let panel = 0; panel < panels; panel++) latticePanel(b, joinery, `${name}-window-${z}-${bay}-${panel}`, [center - bayWidth / 2 + (panel + .5) * bayWidth / panels, floor + .06, z], bayWidth / panels - .022, columnHeight - .48, lattice, { lowerPanel: !loft, cross: loft, lining: !loft && panel % 3 !== 1 });
      }
    }
    for (const side of [-1, 1]) {
      const wall = namedGroup(joinery, `${name}-${side < 0 ? 'west' : 'east'}-screen`, { body: 'side-screen-with-open-lattice' }); wall.position.set(side * (width / 2 - .10), floor, 0); wall.rotation.y = Math.PI / 2;
      const count = Math.max(2, Math.round(depth / 1.1));
      for (let i = 0; i < count; i++) {
        if (openEnds && Math.abs(-depth / 2 + (i + .5) * depth / count) < 1.15) continue;
        latticePanel(b, wall, `${name}-side-${side}-${i}`, [-depth / 2 + (i + .5) * depth / count, .06, 0], depth / count - .035, columnHeight - .48, lattice, { lowerPanel: !loft, cross: loft, lining: !loft && i % 3 !== 1 });
      }
    }
  }
  return group;
}

function building(b, parent, spec) {
  const { name, x = 0, z = 0, floor = 0, width = 15, depth = 9, bays = 3, columnHeight = 4.6, roof = 'hip', double = false, storeys = 1, enclosed = true, rotation = 0, tile = b.m.yellowTile } = spec;
  const group = namedGroup(parent, name, { body: 'chinese-palace-building', role: spec.role ?? 'hall', evidence: INFERRED, dimensionsInferred: { width, depth, bays, columnHeight, storeys }, facing: 'south' });
  group.position.set(x, floor, z); group.rotation.y = rotation;
  const base = namedGroup(group, `${name}-plinth`, { body: 'solid-stone-building-plinth', floor: .46 });
  b.box(base, b.m.foundation, [0, .16, 0], [width + 1.4, .32, depth + 1.4]); b.box(base, b.m.stone, [0, .385, 0], [width + 1.52, .15, depth + 1.52]);
  stairs(b, group, `${name}-front-stair`, 0, depth / 2 + 1.85, Math.min(4.2, width / bays - .3), 0, .46, 1.13);
  if (enclosed) stairs(b, group, `${name}-rear-stair`, 0, depth / 2 + 1.85, Math.min(4.2, width / bays - .3), 0, .46, 1.13).rotation.y = Math.PI;
  frameStorey(b, group, `${name}-lower-frame`, { width, depth, bays, floor: .46, columnHeight, enclosed, openEnds: spec.openEnds });
  let roofWidth = width + 2.4, roofDepth = depth + 2.4, eaveY = .46 + columnHeight + .94;
  if (storeys === 2) {
    const upperWidth = width * .89, upperDepth = depth * .82, upperFloor = .46 + columnHeight + .06;
    const deck = namedGroup(group, `${name}-upper-floor`, { body: 'solid-upper-floor-supported-by-lower-frame' });
    b.box(deck, b.m.darkWood, [0, upperFloor - .12, 0], [width + .22, .25, depth + .22]);
    hipRoof(b, group, `${name}-lower-storey-eaves`, { width: roofWidth, depth: roofDepth, topWidth: upperWidth - .12, topDepth: upperDepth - .12, eaveY, rise: .85, thickness: .17, cornerLift: .33 }, tile, { ridge: false });
    frameStorey(b, group, `${name}-upper-frame`, { width: upperWidth, depth: upperDepth, bays, floor: upperFloor, columnHeight: columnHeight * .81, enclosed: true, lattice: b.m.red });
    roofWidth = upperWidth + 2.4; roofDepth = upperDepth + 2.4; eaveY = upperFloor + columnHeight * .81 + .94;
  }
  const roofGroup = namedGroup(group, `${name}-roof`, { body: double ? 'double-eave-roof-on-bearing-drum' : roof === 'xieshan' ? 'xieshan-roof' : 'hip-roof', evidence: INFERRED });
  const rise = Math.min(4.0, roofDepth * .31);
  if (double) {
    const pyramidal = roof === 'pyramidal', topWidth = roofWidth * .69, topDepth = roofDepth * (pyramidal ? .69 : .63), lowerRise = rise * .52;
    hipRoof(b, roofGroup, `${name}-lower-roof`, { width: roofWidth, depth: roofDepth, topWidth, topDepth, eaveY, rise: lowerRise, cornerLift: .36, thickness: .17 }, tile, { ridge: false });
    const drum = namedGroup(roofGroup, `${name}-roof-bearing-drum`, { body: 'continuous-hollow-timber-bearing-between-eaves', evidence: INFERRED });
    const outer = [[-(topWidth + .32) / 2, -(topDepth + .32) / 2], [(topWidth + .32) / 2, -(topDepth + .32) / 2], [(topWidth + .32) / 2, (topDepth + .32) / 2], [-(topWidth + .32) / 2, (topDepth + .32) / 2]];
    const inner = [[-(topWidth - .32) / 2, -(topDepth - .32) / 2], [(topWidth - .32) / 2, -(topDepth - .32) / 2], [(topWidth - .32) / 2, (topDepth - .32) / 2], [-(topWidth - .32) / 2, (topDepth - .32) / 2]];
    b.polygon(drum, outer, eaveY + lowerRise - .22, eaveY + lowerRise + .86, b.m.green, [inner]);
    for (const side of [-1, 1]) paintedBeam(b, drum, [-topWidth / 2, side * (topDepth / 2 + .17)], [topWidth / 2, side * (topDepth / 2 + .17)], eaveY + lowerRise + .46, .33);
    hipRoof(b, roofGroup, `${name}-upper-roof`, { width: topWidth + 1.5, depth: topDepth + 1.5, ...(pyramidal ? { topWidth: 0, topDepth: 0 } : {}), eaveY: eaveY + lowerRise + .73, rise: rise * .75, cornerLift: .24, thickness: .17 }, tile);
  } else if (roof === 'two-juan') {
    const halfDepth = roofDepth / 2 + .45;
    for (const side of [-1, 1]) {
      const juan = namedGroup(roofGroup, `${name}-${side < 0 ? 'rear' : 'front'}-juan`, { body: 'one-of-two-joined-roof-volumes', sourceId: 'pengdao-theatre-research' }); juan.position.z = side * (roofDepth / 4 - .18);
      xieshanRoof(b, juan, `${juan.name}-xieshan`, { width: roofWidth, depth: halfDepth, eaveY, rise: rise * .87, cornerLift: .22 }, tile);
    }
  } else if (roof === 'xieshan') xieshanRoof(b, roofGroup, `${name}-xieshan`, { width: roofWidth, depth: roofDepth, eaveY, rise }, tile);
  else hipRoof(b, roofGroup, `${name}-hipped`, { width: roofWidth, depth: roofDepth, eaveY, rise, cornerLift: .30, thickness: .17 }, tile);
  b.buildings.push({ name, role: group.userData.role, bays, storeys, inferred: true }); b.flush(); return group;
}

function crossWaterPavilion(b, parent, side) {
  const name = `fanghu-front-${side < 0 ? 'west' : 'east'}-pavilion`, width = 11.8, armWidth = 6.4, floor = .46, columnHeight = 4.6;
  const group = namedGroup(parent, name, { body: 'cross-plan-enclosed-water-pavilion', role: 'one-of-three-water-pavilions', historicalName: side < 0 ? '凝祥亭' : '集瑞亭', sourceId: 'npm-fanghu-roof-types', evidence: 'cross-ridged-pavilion-type-supported-dimensions-and-joinery-inferred', dimensionsInferred: { width, depth: width, armWidth, columnHeight, storeys: 1 } });
  group.position.set(side * 33, 1.8, 40);
  const plinth = namedGroup(group, `${name}-plinth`, { body: 'solid-cross-plan-stone-building-plinth', floor });
  b.polygon(plinth, crossPlanOutline(width + 1.10, armWidth + 1.10), 0, .30, b.m.foundation);
  b.polygon(plinth, crossPlanOutline(width + 1.34, armWidth + 1.34), .30, floor, b.m.stone);
  for (const end of [-1, 1]) {
    const stair = stairs(b, group, `${name}-${end > 0 ? 'front' : 'rear'}-stair`, 0, width / 2 + 1.50, 2.80, 0, floor, .82);
    if (end < 0) stair.rotation.y = Math.PI;
  }
  const lower = namedGroup(group, `${name}-lower-frame`, { body: 'cross-plan-painted-timber-frame', evidence: INFERRED });
  const frame = namedGroup(lower, `${name}-lower-frame-columns-and-beams`, { body: 'cross-plan-timber-columns-and-beams' });
  const outline = crossPlanOutline(width, armWidth), seen = new Set();
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge], c = outline[(edge + 1) % outline.length], length = Math.hypot(c[0] - a[0], c[1] - a[1]), bays = Math.max(1, Math.round(length / 2.2));
    const angle = -Math.atan2(c[1] - a[1], c[0] - a[0]);
    for (let i = 0; i < bays; i++) {
      const p = [THREE.MathUtils.lerp(a[0], c[0], i / bays), THREE.MathUtils.lerp(a[1], c[1], i / bays)], q = [THREE.MathUtils.lerp(a[0], c[0], (i + 1) / bays), THREE.MathUtils.lerp(a[1], c[1], (i + 1) / bays)];
      const id = p.map(v => v.toFixed(5)).join(',');
      if (!seen.has(id)) { column(b, frame, p[0], p[1], floor, columnHeight, .19); dougong(b, frame, [p[0], floor + columnHeight, p[1]], .84, angle); seen.add(id); }
      paintedBeam(b, frame, p, q, floor + columnHeight - .20, .52);
      const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
      b.box(frame, b.m.green, [(p[0] + q[0]) / 2, floor + columnHeight + .94, (p[1] + q[1]) / 2], [span + .18, .48, .40], [0, angle, 0]);
      const screen = namedGroup(lower, `${name}-screen-${edge}-${i}`, { body: 'cross-pavilion-recessed-red-lattice', mergeIntoParent: true });
      screen.position.set((p[0] + q[0]) / 2, floor, (p[1] + q[1]) / 2); screen.rotation.y = angle;
      const portal = Math.abs(a[1]) === width / 2 && a[1] === c[1] && i === Math.floor(bays / 2);
      if (portal) {
        for (const hinge of [-1, 1]) {
          const leaf = latticePanel(b, screen, `${screen.name}-open-leaf-${hinge}`, [hinge * span * .42, .04, 0], span * .37, columnHeight - .50, b.m.red);
          leaf.rotation.y = hinge * Math.PI * .44;
        }
      } else {
        const panels = Math.max(2, Math.round(span / .75));
        for (let panel = 0; panel < panels; panel++) latticePanel(b, screen, `${screen.name}-leaf-${panel}`, [-span / 2 + (panel + .5) * span / panels, .04, 0], span / panels - .036, columnHeight - .50, b.m.red, { lining: panel % 3 !== 1 });
      }
    }
  }
  const roof = namedGroup(group, `${name}-roof`, { body: 'double-eave-cross-ridged-roof', sourceId: 'npm-fanghu-roof-types' });
  const eaveY = floor + columnHeight + .94, lowerRise = 1.30, topWidth = 9.4, topArmWidth = 5.8;
  crossEaveRoof(b, roof, `${name}-lower-roof`, { width: 14.2, armWidth: 8.8, topWidth, topArmWidth, eaveY, rise: lowerRise, thickness: .17, cornerLift: .32 }, b.m.blueTile);
  const drum = namedGroup(roof, `${name}-roof-bearing-drum`, { body: 'continuous-cross-plan-timber-bearing', evidence: INFERRED });
  b.polygon(drum, crossPlanOutline(topWidth + .32, topArmWidth + .32), eaveY + lowerRise - .22, eaveY + lowerRise + .86, b.m.green, [crossPlanOutline(topWidth - .32, topArmWidth - .32)]);
  const bearing = crossPlanOutline(topWidth + .34, topArmWidth + .34);
  for (let i = 0; i < bearing.length; i++) paintedBeam(b, drum, bearing[i], bearing[(i + 1) % bearing.length], eaveY + lowerRise + .42, .40);
  crossUpperRoof(b, roof, `${name}-upper-roof`, { width: topWidth, armWidth: topArmWidth, eaveY: eaveY + lowerRise + .73 }, b.m.blueTile);
  b.buildings.push({ name, role: group.userData.role, bays: 3, storeys: 1, plan: 'cross', inferred: true }); b.flush(); return group;
}

function centralWaterPavilion(b, parent) {
  const name = 'fanghu-front-central-pavilion';
  const group = building(b, parent, { name, role: 'one-of-three-water-pavilions', x: 0, z: 56, width: 11.2, depth: 11.2, floor: 1.8, bays: 3, columnHeight: 4.6, double: true, roof: 'pyramidal', enclosed: false, tile: b.m.yellowTile });
  group.userData.historicalName = '迎薰亭'; group.userData.sourceId = 'npm-fanghu-roof-types'; group.userData.plan = 'square-pyramidal-roof-with-inner-enclosure-and-outer-colonnade';
  frameStorey(b, group, `${name}-inner-enclosure`, { width: 7.0, depth: 7.0, bays: 3, floor: .46, columnHeight: 4.6, enclosed: true, lattice: b.m.red });
  const ceiling = namedGroup(group, `${name}-painted-coffer-ceiling`, { body: 'supported-painted-timber-ceiling', evidence: 'authored-interior-ceiling-not-a-surviving-plan' });
  b.box(ceiling, b.m.darkWood, [0, 5.90, 0], [7.08, .16, 7.08]);
  for (const size of [6.25, 4.70, 3.18]) {
    const outer = [[-size / 2, -size / 2], [size / 2, -size / 2], [size / 2, size / 2], [-size / 2, size / 2]], inner = outer.map(([x, z]) => [x * .90, z * .90]);
    b.polygon(ceiling, outer, 5.70, 5.83, b.m.green, [inner]);
    for (let edge = 0; edge < 4; edge++) paintedBeam(b, ceiling, outer[edge], outer[(edge + 1) % 4], 5.70, .23);
  }
  b.flush(); return group;
}

function carvedPromontoryPanels(b, parent) {
  const group = namedGroup(parent, 'fanghu-promontory-carved-stonework', { body: 'recessed-lotus-stone-friezes', evidence: 'white-carved-terraces-visible-individual-floral-patterns-inferred' });
  const placements = [];
  for (const side of [-1, 1]) {
    for (const x of [25.5, 29.5, 33.5, 37.5, 41.5]) placements.push([side * x, .67, 48.015, 0]);
    for (const x of [4.2, 7.4]) placements.push([side * x, .67, 64.015, 0]);
    for (const z of [33, 39, 45]) placements.push([side * 44.015, .67, z, side * Math.PI / 2]);
  }
  for (const [i, [x, y, z, angle]] of placements.entries()) {
    const panel = namedGroup(group, `fanghu-stone-frieze-${i}`, { body: 'solid-carved-floral-stone-panel', mergeIntoParent: true }); panel.position.set(x, y, z); panel.rotation.y = angle;
    b.box(panel, b.m.stone, [0, 0, .014], [2.5, .98, .09]);
    b.box(panel, b.m.foundation, [0, 0, .063], [2.24, .74, .022]);
    b.box(panel, b.m.stone, [0, 0, .079], [2.14, .64, .020]);
    for (const dy of [-1, 1]) b.box(panel, b.m.carving, [0, dy * .41, .076], [2.43, .074, .080]);
    for (const sx of [-1, 1]) b.box(panel, b.m.carving, [sx * 1.175, 0, .076], [.074, .82, .080]);
    for (let petal = 0; petal < 8; petal++) b.add(panel, b.prototype('stone-lotus-petal', stoneLotusPetalGeometry), b.m.carving, [0, 0, .097], [.58, .58, .80], [0, 0, petal * Math.PI / 4]);
    b.add(panel, b.prototype('stone-lotus-heart', () => new THREE.SphereGeometry(1, 12, 8)), b.m.carving, [0, 0, .12], [.068, .068, .035]);
    for (const side of [-1, 1]) {
      b.tube(panel, b.m.carving, [[side * .24, 0, .12], [side * .47, .20, .13], [side * .74, .19, .13], [side * .89, -.02, .12], [side * .72, -.14, .13], [side * .62, -.01, .13]], .024, 20, 7);
      for (const [dx, dy, rot] of [[.46, -.12, -.9], [.82, .08, .8]]) b.add(panel, b.prototype('stone-lotus-petal', stoneLotusPetalGeometry), b.m.carving, [side * dx, dy, .102], [.27, .33, .68], [0, 0, side * rot]);
    }
  }
}

function perimeter(b, parent, outline, top, { rails = true, skipEdges = [] } = {}) {
  const joints = namedGroup(parent, `${parent.name}-ashlar-courses`, { body: 'restrained-ashlar-joints-and-stone-coping', evidence: INFERRED });
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], c = outline[(i + 1) % outline.length], length = Math.hypot(c[0] - a[0], c[1] - a[1]), n = [(c[1] - a[1]) / length, -(c[0] - a[0]) / length];
    for (const y of [top - .29, top - .80, top - 1.31, top - 1.82]) b.rod(joints, b.m.foundation, [a[0] + n[0] * .012, y, a[1] + n[1] * .012], [c[0] + n[0] * .012, y, c[1] + n[1] * .012], .009, 4);
    const count = Math.max(1, Math.ceil(length / 2.8));
    for (let j = 1; j < count; j++) for (let row = 0; row < 3; row++) {
      const t = Math.min(.995, (j + (row % 2 ? .35 : 0)) / count), x = THREE.MathUtils.lerp(a[0], c[0], t) + n[0] * .012, z = THREE.MathUtils.lerp(a[1], c[1], t) + n[1] * .012;
      b.rod(joints, b.m.foundation, [x, top - .80 - row * .51, z], [x, top - .30 - row * .51, z], .008, 4);
    }
    if (rails && !skipEdges.includes(i)) stoneRail(b, parent, `${parent.name}-rail-${i + 1}`, a, c, top);
  }
}

function fanghuCompound(b, root) {
  const terrace = namedGroup(root, 'fanghu-shan-shaped-white-stone-terraces', { body: 'three-projecting-stone-promontories', sourceId: 'fanghu-park', evidence: 'shan-topology-supported-exact-outline-inferred', localWaterDatum: -2 });
  const outline = [[-44, -53], [44, -53], [44, 48], [23, 48], [23, 29], [10, 29], [10, 64], [-10, 64], [-10, 29], [-23, 29], [-23, 48], [-44, 48]];
  b.polygon(terrace, outline, -2.45, 1.64, b.m.stone); b.polygon(terrace, outline, 1.64, 1.80, b.m.paving);
  perimeter(b, terrace, outline, 1.8, { skipEdges: [0, 6] });
  carvedPromontoryPanels(b, terrace);
  stoneRail(b, terrace, 'fanghu-front-left-dock-rail', [-10, 64], [-2.65, 64], 1.8);
  stoneRail(b, terrace, 'fanghu-front-right-dock-rail', [2.65, 64], [10, 64], 1.8);
  const dock = namedGroup(terrace, 'fanghu-central-boat-landing', { body: 'stone-landing-and-stair', evidence: 'landing-relationship-visible-profile-inferred', localWaterDatum: -2 });
  b.box(dock, b.m.foundation, [0, -1.77, 74.25], [7.4, 1.32, 4.6]); b.box(dock, b.m.stone, [0, -1.05, 74.25], [7.5, .16, 4.7]);
  stairs(b, dock, 'fanghu-long-central-landing-stair', 0, 73, 4.75, -.97, 1.8, 9.04);
  for (const side of [-1, 1]) b.lathe(dock, b.m.carving, [[0, 0], [.28, 0], [.28, .16], [.18, .20], [.18, .51], [.24, .57], [.20, .71], [0, .80]], [side * 2.75, -.97, 75.1], 12);
  const terraces = namedGroup(root, 'fanghu-three-courtyard-levels', { body: 'three-ascending-courtyard-groups', sourceId: 'fanghu-park', levelHeightsInferred: [1.8, 2.4, 3.0] });
  b.box(terraces, b.m.stone, [0, 2.015, -21.5], [85.6, .43, 63.0]); b.box(terraces, b.m.paving, [0, 2.33, -21.5], [85.6, .20, 63.0]);
  b.box(terraces, b.m.stone, [0, 2.62, -38], [85.6, .44, 30]); b.box(terraces, b.m.paving, [0, 2.92, -38], [85.6, .16, 30]);
  for (const x of [-15.6, 15.6, 0]) {
    stairs(b, terraces, `fanghu-front-to-middle-stair-${x}`, x, 11.9, 5.2, 1.8, 2.4, 1.95);
    stairs(b, terraces, `fanghu-middle-to-rear-stair-${x}`, x, -21.05, 5.2, 2.4, 3.0, 1.95);
  }
  // Quiet paving borders expose the court hierarchy; no photographic plan is
  // flattened onto a ground plane and no Fuhai lake bed is generated here.
  for (const [z, floor, depth] of [[29, 1.8, 4.5], [3.0, 2.4, 6.5], [-23.5, 3.0, 2.0]]) for (const side of [-1, 1]) {
    b.box(terraces, b.m.carving, [side * 15.6, floor + .012, z], [.13, .024, depth]);
  }
  b.flush();
  const halls = namedGroup(root, 'fanghu-nine-rear-halls', { body: 'nine-hall-three-row-composition', sourceId: 'fanghu-park', evidence: 'nine-count-and-symmetry-supported-local-grid-inferred' });
  const rows = [{ z: 16, floor: 1.8, middle: 22, side: 15.5, depth: 10.5, height: 4.5 }, { z: -10, floor: 2.4, middle: 24, side: 16, depth: 11.5, height: 4.9 }, { z: -38, floor: 3.0, middle: 25, side: 16.2, depth: 13, height: 5.35 }];
  for (const [row, spec] of rows.entries()) for (const side of [-1, 0, 1]) building(b, halls, {
    name: `fanghu-row-${row + 1}-${side === 0 ? 'central' : side < 0 ? 'west' : 'east'}-hall`, role: 'one-of-nine-halls', x: side * 26, z: spec.z, floor: spec.floor,
    width: side === 0 ? spec.middle : spec.side, depth: spec.depth + (side === 0 ? 1.5 : 0), bays: side === 0 ? 5 : 3, columnHeight: spec.height,
    storeys: 2, roof: row === 2 && side === 0 ? 'hip' : 'xieshan', tile: b.m.yellowTile,
  });
  const pavilions = namedGroup(root, 'fanghu-three-front-double-eave-pavilions', { body: 'three-double-eave-pavilions-projecting-over-water', sourceId: 'fanghu-park' });
  crossWaterPavilion(b, pavilions, -1); centralWaterPavilion(b, pavilions); crossWaterPavilion(b, pavilions, 1);
  const links = namedGroup(root, 'fanghu-side-covered-galleries', { body: 'covered-side-court-links', evidence: 'linked-composition-visible-gallery-dimensions-inferred' });
  for (const side of [-1, 1]) {
    for (const [i, z, floor] of [[1, 23, 1.8], [2, -4, 2.4], [3, -34, 3.0]]) building(b, links, { name: `fanghu-${side < 0 ? 'west' : 'east'}-side-gallery-${i}`, role: 'covered-gallery', x: side * 39, z, floor, width: i === 1 ? 12 : 19, depth: 2.9, bays: i === 1 ? 4 : 6, columnHeight: 3.1, rotation: Math.PI / 2, enclosed: false, tile: b.m.yellowTile });
    building(b, links, { name: `fanghu-${side < 0 ? 'west' : 'east'}-water-pavilion-link`, role: 'covered-gallery', x: side * 33, z: 29, floor: 1.8, width: 13, depth: 2.8, bays: 4, columnHeight: 3.25, rotation: Math.PI / 2, enclosed: false, tile: b.m.yellowTile });
  }
}

function pengdaoIsland(b, parent, id, anchor) {
  const record = gardenLayout.islands.find(island => island.id === id);
  const group = namedGroup(parent, id, { body: 'rock-faced-island-quay-foundation', sourceIds: ['pengdao-park', 'public-three-garden-diagram'], evidence: 'layout-compatible-provisional-outline', globalAnchor: [...record.anchor] });
  const outline = record.polygon.map(([x, z]) => [x - anchor[0], z - anchor[2]]);
  b.polygon(group, outline, -2.5, .17, b.m.foundation); b.polygon(group, outline, .17, .34, b.m.quayStoneShade);
  const coping = outline.map(([x, z]) => [x, z]); perimeter(b, group, coping, .34, { rails: false });
  const rocks = namedGroup(group, `${id}-rock-facing`, { body: 'staggered-courses-of-quarried-shoreline-blocks', evidence: 'stone-island-character-supported-coursing-and-block-sizes-inferred', horizontalMortarGap: .03 });
  const winding = Math.sign(outline.reduce((sum, a, i) => { const c = outline[(i + 1) % outline.length]; return sum + a[0] * c[1] - c[0] * a[1]; }, 0));
  const courses = [[-2.35, -1.65], [-1.62, -.96], [-.93, -.36], [-.33, .155]];
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge], c = outline[(edge + 1) % outline.length], length = Math.hypot(c[0] - a[0], c[1] - a[1]), count = Math.max(1, Math.ceil(length / 2.20));
    const normal = [(c[1] - a[1]) / length * winding, -(c[0] - a[0]) / length * winding], pitch = length / count;
    for (const [course, [bottom, top]] of courses.entries()) for (let i = -1; i < count; i++) {
      const offset = course % 2 ? .5 : 0, start = Math.max(0, (i + offset) * pitch), end = Math.min(length, (i + 1 + offset) * pitch);
      if (end - start < .15) continue;
      const t = (start + end) / (2 * length), seed = edge * 71 + i * 17 + course * 31, variant = ((seed % 9) + 9) % 9;
      const shape = b.prototype(`quarried-shore-block-${variant}`, () => quarriedMasonryBlockGeometry(variant));
      b.add(rocks, shape, variant % 3 ? b.m.quayStone : b.m.quayStoneShade,
        [THREE.MathUtils.lerp(a[0], c[0], t) + normal[0] * .08, (bottom + top) / 2, THREE.MathUtils.lerp(a[1], c[1], t) + normal[1] * .08],
        [end - start - .09, top - bottom - .018, .70], [0, -Math.atan2(c[1] - a[1], c[0] - a[0]), 0]);
    }
  }
  const paving = namedGroup(group, `${id}-jointed-stone-paving`, { body: 'individual-stone-pavers-clipped-to-island-outline', evidence: 'authored-paving-not-a-recovered-stone-by-stone-plan', jointWidth: .028, slabTop: .366 });
  const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  let row = 0;
  for (let z = minZ; z < maxZ; z += 1.20, row++) for (let x = minX - (row % 2 ? 1 : 0); x < maxX; x += 2) {
    const clipped = clipPavingCell(outline, x + .014, x + 1.986, z + .014, z + 1.186);
    if (clipped.length < 3) continue;
    const area = Math.abs(clipped.reduce((sum, a, i) => { const c = clipped[(i + 1) % clipped.length]; return sum + a[0] * c[1] - c[0] * a[1]; }, 0)) / 2;
    if (area < .025) continue;
    b.polygon(paving, clipped, .337, .366, (row + Math.round(x)) % 5 ? b.m.paving : b.m.pavingLight);
  }
  b.flush(); return group;
}

function jingzhongGate(b, parent) {
  const name = 'pengdao-jingzhongge', group = namedGroup(parent, name, { body: 'three-bay-south-gate-with-one-bay-loft', sourceId: 'guo-forty-scenes', evidence: 'recorded-form-and-palette-proportions-inferred', facing: 'south', bays: 3 });
  group.position.set(0, .34, 15.6);
  b.box(group, b.m.stone, [0, .22, 0], [14.1, .44, 6.4]);
  stairs(b, group, `${name}-south-stair`, 0, 4.35, 3.6, 0, .44, 1.2);
  const rearStair = stairs(b, group, `${name}-north-stair`, 0, 4.35, 3.6, 0, .44, 1.2); rearStair.rotation.y = Math.PI;
  frameStorey(b, group, `${name}-gate-frame`, { width: 12.6, depth: 5.0, floor: .44, columnHeight: 3.5, bays: 3, enclosed: true, lattice: b.m.green });
  // Back lattice is blue, as distinguished from the green front joinery in
  // Guo Daiheng's reading of the original silk painting.
  const gateJoinery = group.getObjectByName(`${name}-gate-frame-doors-and-windows`);
  for (const pending of b.pending.values()) if (pending.parent === gateJoinery && pending.material === b.m.green) {
    const back = pending.parts.filter(part => part.sourceParent.position.z < 0), front = pending.parts.filter(part => part.sourceParent.position.z >= 0);
    pending.parts = front;
    if (back.length) b.pending.set(`${gateJoinery.uuid}:${b.m.blue.id}`, { parent: gateJoinery, material: b.m.blue, parts: back });
  }
  hipRoof(b, group, `${name}-gate-eaves`, { width: 15.0, depth: 7.4, topWidth: 4.62, topDepth: 4.02, eaveY: 4.88, rise: 1.50, cornerLift: .22, thickness: .17 }, b.m.greenTile, { ridge: false });
  const transfer = namedGroup(group, `${name}-loft-transfer-frame`, { body: 'cross-beams-and-short-posts-bearing-the-loft', evidence: 'structural-interpretation-not-a-recovered-section' });
  for (const x of [-2.1, 2.1]) {
    b.box(transfer, b.m.darkWood, [x, 4.92, 0], [.28, .25, 6.15]);
    for (const z of [-1.75, 1.75]) b.box(transfer, b.m.red, [x, 5.25, z], [.26, .70, .26]);
  }
  const loftFloor = namedGroup(group, `${name}-loft-floor`, { body: 'solid-timber-loft-floor' });
  b.box(loftFloor, b.m.darkWood, [0, 5.35, 0], [4.85, .25, 4.25]);
  frameStorey(b, group, `${name}-loft`, { width: 4.8, depth: 4.2, floor: 5.4, columnHeight: 2.55, bays: 1, enclosed: true, lattice: b.m.red, loft: true });
  xieshanRoof(b, group, `${name}-loft-xieshan`, { width: 6.55, depth: 5.95, eaveY: 8.57, rise: 2.1, cornerLift: .21 }, b.m.greenTile);
  b.buildings.push({ name, role: 'south-gate-with-loft', bays: 3, loftBays: 1, inferred: true }); b.flush(); return group;
}

function timberBridge(b, parent, id, anchor) {
  const record = gardenLayout.bridges.find(bridge => bridge.id === id), from = [record.from[0] - anchor[0], record.from[2] - anchor[2]], to = [record.to[0] - anchor[0], record.to[2] - anchor[2]];
  const deckY = record.deckY - anchor[1], width = 2.8, crown = .34;
  const group = namedGroup(parent, id, { body: 'continuous-timber-footbridge', sourceId: 'pengdao-old-record-via-park', evidence: 'island-connectivity-supported-span-and-profile-inferred', from, to, deckY, crown, clearWidth: width - .38 });
  const deck = namedGroup(group, `${id}-solid-deck`, { body: 'solid-crowned-bridge-deck' });
  b.add(deck, bridgeDeckGeometry(from, to, width, deckY, crown), b.m.darkWood, undefined, undefined, undefined, true);
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), across = [-(to[1] - from[1]) / length, (to[0] - from[0]) / length], bays = Math.ceil(length / 2.3);
  const point = (t, side = 0, dy = 0) => [THREE.MathUtils.lerp(from[0], to[0], t) + across[0] * side, deckY + crown * Math.sin(Math.PI * t) + dy, THREE.MathUtils.lerp(from[1], to[1], t) + across[1] * side];
  const rails = namedGroup(group, `${id}-red-open-railings`, { body: 'open-wood-bridge-railings' });
  for (const side of [-1, 1]) {
    const offset = side * (width / 2 - .12);
    for (const y of [.20, .92]) b.tube(rails, b.m.red, Array.from({ length: 25 }, (_, i) => point(i / 24, offset, y)), .072, 32, 6);
    for (let i = 0; i <= bays; i++) {
      const t = i / bays, p = point(t, offset, 0); b.box(rails, b.m.red, [p[0], p[1] + .58, p[2]], [.16, 1.16, .16]);
      b.add(rails, b.prototype('bridge-cap', () => new THREE.SphereGeometry(1, 8, 6)), b.m.green, [p[0], p[1] + 1.17, p[2]], [.14, .13, .14]);
      if (i < bays) for (const pair of [[.20, .86], [.86, .20]]) b.rod(rails, b.m.green, point(t, offset, pair[0]), point((i + 1) / bays, offset, pair[1]), .037, 6);
    }
  }
  const boards = Math.ceil(length / .29);
  const seams = namedGroup(group, `${id}-plank-joints`, { body: 'shallow-board-end-seams' });
  for (let i = 1; i < boards; i++) b.rod(seams, b.m.red, point(i / boards, -width / 2, .008), point(i / boards, width / 2, .008), .009, 4);
  const bearings = namedGroup(group, `${id}-stone-abutments`, { body: 'end-abutments-meeting-island-coping' });
  for (const t of [0, 1]) {
    const p = point(t); b.box(bearings, b.m.stone, [p[0], .30, p[2]], [4.0, .40, 4.0]);
    b.box(bearings, b.m.foundation, [p[0], -1.05, p[2]], [3.7, 2.50, 3.7]);
  }
  b.walkways.push({ id, from, to, deckY, crown, clearWidth: width - .38 }); b.flush(); return group;
}

function pengdaoCompound(b, root) {
  const anchor = getGardenGroup('pengdao-yaotai').position;
  const islands = namedGroup(root, 'pengdao-three-island-foundations', { body: 'three-separate-island-foundations', evidence: 'three-island-topology-supported-layout-outlines-unregistered' });
  for (const id of ['pengdao-main', 'pengdao-west', 'pengdao-east']) pengdaoIsland(b, islands, id, anchor);
  const main = namedGroup(root, 'pengdao-main-island-courtyard', { body: 'south-gate-main-hall-and-enclosing-galleries', sourceIds: ['pengdao-painting-viewed', 'pengdao-old-record-via-park'] });
  building(b, main, { name: 'pengdao-seven-bay-two-juan-hall', role: 'seven-bay-main-hall', x: 0, z: -5.5, floor: .34, width: 26.6, depth: 13.2, bays: 7, columnHeight: 5.0, roof: 'two-juan', tile: b.m.greenTile });
  building(b, main, { name: 'pengdao-five-bay-front-baosha', role: 'five-bay-front-baosha', x: 0, z: 3.55, floor: .34, width: 19.0, depth: 5.8, bays: 5, columnHeight: 3.65, roof: 'hip', tile: b.m.greenTile, openEnds: true });
  jingzhongGate(b, main);
  for (const side of [-1, 1]) {
    building(b, main, { name: `pengdao-${side < 0 ? 'west' : 'east'}-south-wing`, role: 'courtyard-wing', x: side * 10.85, z: 15.6, floor: .34, width: 8.1, depth: 4.6, bays: 3, columnHeight: 3.3, roof: 'hip', tile: b.m.darkTile });
    building(b, main, { name: `pengdao-${side < 0 ? 'west' : 'east'}-side-gallery`, role: 'courtyard-gallery', x: side * 15.0, z: 7.7, floor: .34, width: 10.4, depth: 3.1, bays: 4, columnHeight: 3.2, rotation: Math.PI / 2, enclosed: false, roof: 'hip', tile: b.m.darkTile });
  }
  const court = namedGroup(main, 'pengdao-open-main-court', { body: 'stone-court-and-central-walkway', evidence: INFERRED });
  b.box(court, b.m.paving, [0, .367, 9.7], [24.0, .055, 4.0]);
  for (const x of [-2.05, 2.05]) b.box(court, b.m.stone, [x, .408, 10.0], [.13, .03, 3.4]);
  const dock = namedGroup(main, 'pengdao-south-boat-landing', { body: 'south-stone-boat-landing', evidence: 'landing-visible-in-painting-dimensions-inferred', localWaterDatum: -2 });
  b.box(dock, b.m.foundation, [0, -1.58, 27.3], [6.8, 1.84, 5.1]); b.box(dock, b.m.stone, [0, -.61, 27.3], [7.0, .12, 5.3]);
  stairs(b, dock, 'pengdao-south-landing-stairs', 0, 26.5, 4.0, -.55, .34, 5.5);
  for (const side of [-1, 1]) b.lathe(dock, b.m.carving, [[0, 0], [.25, 0], [.25, .12], [.15, .20], [.15, .55], [.22, .62], [0, .76]], [side * 2.6, -.55, 28.5], 12);
  b.flush();
  const west = namedGroup(root, 'pengdao-west-island-court', { body: 'northwest-island-three-bay-hall', sourceId: 'pengdao-old-record-via-park' });
  const westCenter = gardenLayout.islands.find(island => island.id === 'pengdao-west').anchor;
  const wx = westCenter[0] - anchor[0], wz = westCenter[2] - anchor[2];
  building(b, west, { name: 'pengdao-west-three-bay-hall', role: 'west-island-hall', x: wx, z: wz - 2.0, floor: .34, width: 11.4, depth: 6.2, bays: 3, columnHeight: 3.8, roof: 'xieshan', tile: b.m.greenTile });
  building(b, west, { name: 'pengdao-west-small-front-gate', role: 'west-island-gate', x: wx, z: wz + 6.5, floor: .34, width: 5.4, depth: 3.2, bays: 1, columnHeight: 2.75, enclosed: false, roof: 'hip', tile: b.m.greyTile });
  const east = namedGroup(root, 'pengdao-east-island-pavilion-court', { body: 'east-island-yinghai-xianshan-pavilion', sourceId: 'pengdao-old-record-via-park', registrationLimit: 'draft island lies slightly north of main centre; southeast historical wording not registered' });
  const eastCenter = gardenLayout.islands.find(island => island.id === 'pengdao-east').anchor;
  const ex = eastCenter[0] - anchor[0], ez = eastCenter[2] - anchor[2];
  building(b, east, { name: 'pengdao-yinghai-xianshan-pavilion', role: 'east-island-pavilion', x: ex + 1.5, z: ez + 2.0, floor: .34, width: 8.3, depth: 8.3, bays: 3, columnHeight: 3.8, double: true, roof: 'pyramidal', enclosed: false, tile: b.m.greenTile });
  const islandCourts = namedGroup(root, 'pengdao-small-island-courts', { body: 'small-island-stone-courts-and-open-railings', evidence: INFERRED });
  b.box(islandCourts, b.m.paving, [wx, .367, wz + 3.2], [14.8, .055, 3.8]);
  stoneRail(b, islandCourts, 'pengdao-west-front-west-rail', [wx - 8, wz + 8.0], [wx - 3.4, wz + 8.0], .34);
  stoneRail(b, islandCourts, 'pengdao-west-front-east-rail', [wx + 3.4, wz + 8.0], [wx + 8, wz + 8.0], .34);
  stoneRail(b, islandCourts, 'pengdao-east-south-rail', [ex - 5.5, ez + 10], [ex + 11, ez + 10], .34);
  b.flush();
  const bridges = namedGroup(root, 'pengdao-two-island-bridges', { body: 'two-footbridges-linking-three-islands', sourceId: 'pengdao-old-record-via-park' });
  timberBridge(b, bridges, 'pengdao-west-bridge', anchor); timberBridge(b, bridges, 'pengdao-east-bridge', anchor);
}

function finish(b, root, groupId) {
  b.flush(); b.releasePrototypes(); root.updateMatrixWorld(true);
  let triangleCount = 0, meshCount = 0; const subassemblies = [];
  const usedMaterials = new Set();
  root.traverse(object => { if (object.isMesh) { meshCount++; triangleCount += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; usedMaterials.add(object.material); } });
  for (const material of b.materials) if (!usedMaterials.has(material)) { material.dispose(); b.materials.delete(material); }
  for (const child of root.children) {
    let meshes = 0, triangles = 0; child.traverse(object => { if (object.isMesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
    if (meshes) { const box = new THREE.Box3().setFromObject(child); subassemblies.push({ name: child.name, body: child.userData.body, meshCount: meshes, triangleCount: triangles, bounds: { min: box.min.toArray(), max: box.max.toArray() } }); }
  }
  const box = new THREE.Box3().setFromObject(root), placement = getGardenGroup(groupId);
  const supported = groupId === 'fanghu-shengjing' ? [
    'Three symmetric groups, nine rear halls, three front double-eave pavilions and 山-shaped white stone promontories',
    'Yellow glazed roofs, red timber and blue-green decoration; the image differentiates towers, galleries and terraces',
    'NPM research identifies the central Yingxun pavilion as double-eave pyramidal, and Jirui/Ningxiang as cross-ridged side pavilions',
  ] : [
    'Three islands with two connecting bridges and a south boat landing; large main island and smaller flanking islands',
    'Three-bay south gate, one-bay xieshan loft, four dougong groups per loft face and red cross-lattice upper windows',
    'Seven-bay main hall with two joined roof volumes and five-bay front baosha',
  ];
  const inferred = [
    'All building spans, heights, roof curves, tile dimensions, stair counts, wall thicknesses and decorative patterns are authored proportions, not recovered Qing measurements',
    'The 1744 painting constrains appearance; survival of each detail into the 1859–1860 target remains unproven',
    'Rear elevations, internal circulation and the nine-hall local grid are interpretations; no complete original construction plan was available',
    'Local coordinates inherit the unregistered garden-layout design scale and are nominal working metres only',
    'Pengdao draft east-island placement has not been reconciled with the southeast bridge wording in the cited historical record',
    'No Fuhai lake bed, water surface, complete surrounding landscape or reconstructed theatre stage is included',
    'Scroll-and-fangxin paintwork, window lining, stone lotus relief and carved ridge-beast details are original visual interpretations, not recovered surface patterns',
  ];
  const diagnostics = {
    assetId: groupId, version: 1, timeLayer: '1859–1860-target-with-1744-image-evidence', units: 'working-metres-unregistered',
    coordinates: { east: '+X', south: '+Z', up: '+Y', principalView: 'from-south', localGroundY: 0, localWaterY: -2 },
    placement: { gardenGroupId: groupId, globalAnchor: [...placement.position], rotationY: placement.placement.rotationY, scale: placement.placement.scale, evidence: 'unregistered-garden-layout-placement' },
    supported, inferred, supportedFeatures: supported, inferredFeatures: inferred, sources: SOURCES.map(source => ({ ...source })),
    measurements: { status: INFERRED, noSurveyedBuildingDimensions: true }, visualAcceptance: false, integrationAcceptance: false,
    meshCount, triangleCount, bounds: { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() }, subassemblies,
    buildings: b.buildings.map(building => ({ ...building })), walkways: b.walkways.map(walkway => ({ ...walkway })),
    resourceOwnership: { geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, sharedAcrossFactories: false, temporaryGeometryDisposals: b.temporaryDisposals },
  };
  root.userData.assetId = groupId;
  return { group: root, diagnostics, dispose() { b.dispose(); root.clear(); } };
}

export function createFanghuStudy() {
  const b = new Builder('fanghu'), group = new THREE.Group(); group.name = 'fanghu-shengjing-study';
  try { fanghuCompound(b, group); return finish(b, group, 'fanghu-shengjing'); } catch (error) { b.dispose(); group.clear(); throw error; }
}

export function createPengdaoStudy() {
  const b = new Builder('pengdao'), group = new THREE.Group(); group.name = 'pengdao-yaotai-study';
  try { pengdaoCompound(b, group); return finish(b, group, 'pengdao-yaotai'); } catch (error) { b.dispose(); group.clear(); throw error; }
}

export { fuhaiStudyViews } from './fuhai-study-views.js';
