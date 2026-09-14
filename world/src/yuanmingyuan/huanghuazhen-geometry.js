import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, TAU, namedGroup, extrudedPolygon } from './study-geometry.js';
import { organicLoft, stoneSweep, carvedLeaf, shellGeometry, createFountainWater, fountainFlowGeometry } from './yuanyingguan-geometry.js';

// Manual centreline trace of MIT ymy4018 (400 × 595 px), attributed there to
// Tsinghua's collection via Guo Daiheng ed., 2007. The drawing has no readable
// metric scale. This 0.17 m/px study scale is an explicit authoring assumption.
export function mazePlan() {
  const scale = .17, origin = [202, 366], paths = [];
  const add = (id, points, inferred = false) => paths.push({ id, points: points.map(([x, z]) => [(x - origin[0]) * scale, (z - origin[1]) * scale]), evidence: inferred ? 'paper-damage-completion-hypothesis' : 'manual-trace-low-resolution-published-plan' });
  add('outer-northwest', [[190, 23], [21, 23], [21, 354]]);
  add('outer-northeast', [[216, 23], [386, 28], [386, 352]]);
  add('outer-southwest', [[21, 380], [21, 580], [187, 580]]);
  add('outer-southeast', [[386, 380], [386, 581], [217, 581]]);
  add('northwest-outer-return', [[166, 40], [39, 40], [39, 75], [129, 75]]);
  add('northwest-first-turn', [[54, 59], [134, 59], [142, 64], [142, 85], [134, 91], [40, 91], [40, 155], [159, 155], [159, 146], [173, 141]]);
  add('northwest-second-turn', [[56, 109], [135, 109], [143, 116], [143, 135], [136, 142], [56, 142]]);
  add('northwest-middle-straight', [[42, 125], [127, 125]]);
  add('northeast-outer-return', [[251, 42], [367, 43], [367, 76], [282, 76]], true);
  add('northeast-first-turn', [[283, 59], [353, 59], [353, 93], [257, 93]], true);
  add('northeast-second-turn', [[286, 111], [367, 111], [367, 155], [243, 155], [243, 146], [230, 139]], true);
  add('northeast-inner-turn', [[273, 126], [273, 141], [366, 141]], true);
  add('north-center-roundabout', [[40, 173], [167, 173], [175, 161], [188, 154], [202, 150], [217, 154], [231, 162], [239, 173], [366, 173]]);
  add('north-center-lower-roundabout', [[40, 189], [168, 189], [181, 180], [194, 178], [210, 178], [223, 183], [237, 190], [365, 190]]);
  add('northwest-lower-roundabout', [[96, 205], [165, 205], [172, 215], [187, 224]]);
  add('northeast-lower-roundabout', [[218, 224], [233, 216], [241, 206], [309, 206]]);
  add('northwest-squared-return', [[104, 222], [157, 222], [158, 236], [89, 237], [84, 225], [83, 213], [69, 203], [53, 203], [39, 217], [39, 241], [49, 254], [66, 254], [83, 261]]);
  add('northeast-squared-return', [[248, 222], [307, 222], [309, 237], [319, 237], [320, 219], [332, 206], [349, 206], [365, 221], [365, 243], [357, 256], [340, 256], [326, 264]]);
  add('upper-central-west', [[51, 271], [32, 249], [22, 237]]);
  add('upper-central-east', [[352, 271], [378, 243], [385, 235]]);
  add('upper-crossbar', [[190, 238], [87, 238], [73, 251], [83, 266], [99, 276], [116, 256], [276, 256], [286, 265], [276, 275], [128, 275], [104, 291], [104, 326], [112, 343], [119, 344], [133, 336], [136, 320], [151, 319], [164, 304]]);
  add('upper-inner-left', [[187, 287], [133, 287], [119, 304], [119, 338]]);
  add('upper-inner-right', [[218, 287], [270, 287], [288, 304], [289, 342], [296, 347], [303, 340], [304, 291], [286, 276]]);
  add('upper-quarter-left', [[39, 298], [39, 353], [58, 338], [58, 282]]);
  add('upper-quarter-right', [[367, 296], [367, 352], [349, 339], [348, 282]]);
  add('central-west-outer', [[74, 278], [73, 336], [61, 354], [54, 366], [63, 380], [74, 392], [74, 448], [56, 464], [37, 464], [24, 479]]);
  add('central-east-outer', [[331, 279], [331, 337], [344, 353], [351, 366], [344, 381], [331, 394], [331, 449], [348, 465], [366, 465], [384, 480]]);
  add('central-west-inner', [[190, 271], [127, 271], [89, 294], [88, 338], [91, 353], [101, 359], [112, 359], [126, 353], [140, 340], [156, 335], [171, 320], [179, 305]]);
  add('central-east-inner', [[220, 272], [278, 272], [317, 296], [317, 338], [315, 352], [306, 359], [294, 359], [281, 352], [266, 338], [250, 334], [236, 320], [228, 305]]);
  add('central-west-lower', [[181, 435], [173, 415], [158, 400], [140, 394], [128, 381], [116, 375], [103, 377], [91, 386], [87, 402], [88, 436], [115, 463], [188, 463]]);
  add('central-east-lower', [[225, 435], [234, 414], [249, 400], [268, 394], [280, 381], [293, 376], [305, 378], [316, 388], [320, 404], [318, 436], [289, 465], [218, 465]]);
  add('lower-inner-left', [[120, 391], [121, 429], [136, 448], [185, 448]]);
  add('lower-inner-right', [[288, 391], [287, 429], [270, 448], [220, 448]]);
  add('lower-corner-west', [[38, 438], [38, 396], [50, 389], [60, 398], [60, 447], [77, 466]]);
  add('lower-corner-east', [[368, 439], [368, 397], [355, 390], [346, 399], [346, 448], [330, 466]]);
  add('lower-crossbar', [[108, 467], [116, 482], [277, 482], [303, 455]]);
  add('lower-west-octagon', [[75, 494], [58, 481], [43, 485], [32, 498], [31, 517], [45, 533], [66, 533], [80, 519], [80, 503], [95, 487]]);
  add('lower-east-octagon', [[328, 494], [346, 482], [362, 486], [375, 500], [374, 519], [360, 534], [339, 534], [324, 520], [324, 504], [310, 489]]);
  add('south-upper-crossbar', [[100, 499], [281, 499]]);
  add('south-middle-west', [[99, 515], [161, 515], [159, 530], [77, 532], [41, 532]]);
  add('south-middle-east', [[235, 515], [293, 515], [294, 531], [333, 534], [366, 534]]);
  add('south-round-court', [[40, 546], [168, 546], [174, 534], [184, 528], [197, 525], [210, 527], [221, 534], [226, 546], [353, 546], [353, 556], [227, 559]]);
  add('southwest-bottom-return', [[51, 561], [169, 561], [178, 575], [185, 580]]);
  add('southeast-bottom-return', [[216, 580], [227, 564], [369, 563], [369, 531]]);
  return { scale, origin, paths, platform: [0, 0], entrances: [[202, 23], [21, 367], [386, 367], [202, 582]].map(([x, z]) => [(x - origin[0]) * scale, (z - origin[1]) * scale]), uncertainty: ['No readable scale or date on the published diagram.', 'Four northeast paths cross damaged paper and are completed by local symmetry.', 'Trace fidelity is limited by the 400 px source; the drawing is not claimed as a registered Qing survey.'] };
}

export function stripPolygon(points, halfWidth) {
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const a = V(...[points[Math.max(0, i - 1)][0], 0, points[Math.max(0, i - 1)][1]]), p = V(points[i][0], 0, points[i][1]), c = V(points[Math.min(points.length - 1, i + 1)][0], 0, points[Math.min(points.length - 1, i + 1)][1]);
    const incoming = i ? p.clone().sub(a).normalize() : c.clone().sub(p).normalize(), outgoing = i + 1 < points.length ? c.clone().sub(p).normalize() : incoming;
    const n0 = V(-incoming.z, 0, incoming.x), n1 = V(-outgoing.z, 0, outgoing.x), normal = n0.clone().add(n1).normalize();
    const miter = halfWidth / Math.max(.45, normal.dot(n1));
    left.push([p.x + normal.x * miter, p.z + normal.z * miter]); right.push([p.x - normal.x * miter, p.z - normal.z * miter]);
  }
  return [...left, ...right.reverse()];
}

export function domeGeometry(radius, bottom, rise, sides = 64, rows = 28) {
  // A closed masonry/copper shell with a flat soffit at the rim and a solid
  // crown. The underside follows the vault; it does not fill the occupied room.
  const profile = [[radius, bottom]];
  for (let row = 1; row < rows; row++) {
    const t = row / rows, r = radius * Math.cos(t * Math.PI / 2) * (1 + .035 * Math.sin(t * Math.PI));
    profile.push([r, bottom + rise * Math.sin(t * Math.PI / 2)]);
  }
  profile.push([0, bottom + rise], [0, bottom + rise - .12]);
  for (let row = rows - 1; row >= 0; row--) {
    const t = row / rows, r = (radius - .14) * Math.cos(t * Math.PI / 2) * (1 + .035 * Math.sin(t * Math.PI));
    profile.push([r, bottom + (rise - .12) * Math.sin(t * Math.PI / 2)]);
  }
  profile.push(profile[0]);
  const geometry = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), sides); geometry.normalizeNormals(); return geometry;
}

export function facadeGeometry(points, back, front, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: front - back, bevelEnabled: false, curveSegments: 24, steps: 1 });
  g.translate(0, 0, back); return g;
}

export function curvedFacadeContour(points, steps = 96) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => V(x, y, 0)), false, 'catmullrom', .28);
  return curve.getPoints(steps).map(point => [point.x, point.y]);
}

export function archOutline(x, bottom, width, spring, rise, z = 0, steps = 36) {
  const points = [[x - width / 2, bottom, z], [x - width / 2, spring, z]];
  for (let i = 1; i <= steps; i++) {
    const angle = Math.PI - i / steps * Math.PI;
    points.push([x + width / 2 * Math.cos(angle), spring + rise * Math.sin(angle), z]);
  }
  points.push([x + width / 2, bottom, z]); return points;
}

export function piercedWall(width, bottom, top, depth, openings) {
  const lower = [[-width / 2, bottom]], holes = [];
  for (const opening of [...openings].sort((a, b) => a.x - b.x)) {
    const arch = archOutline(opening.x, opening.bottom, opening.width, opening.spring, opening.rise).map(([x, y]) => [x, y]);
    if (Math.abs(opening.bottom - bottom) < .00001) lower.push(...arch);
    else holes.push(arch);
  }
  return facadeGeometry([...lower, [width / 2, bottom], [width / 2, top], [-width / 2, top]], -depth / 2, depth / 2, holes);
}

// Parameterized thick patches give tile pans and bridge decks closed ends and
// real undersides. Winding is derived from the upward-facing sample normal.
export function thickPatch(sample, columns = 12, rows = 8, thickness = .08) {
  const positions = [], uv = [], indices = [], count = (columns + 1) * (rows + 1);
  for (const side of [0, 1]) for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const p = sample(column / columns, row / rows); positions.push(p[0], p[1] - side * thickness, p[2]); uv.push(column / columns, row / rows);
  }
  const a = V(...sample(.45, .45)), u = V(...sample(.46, .45)).sub(a), v = V(...sample(.45, .46)).sub(a), upward = u.cross(v).y > 0;
  const face = (a, b, c, d, flip = false) => { if (upward !== flip) indices.push(a, b, c, a, c, d); else indices.push(a, d, c, a, c, b); };
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column, b = a + 1, c = b + columns + 1, d = a + columns + 1;
    face(a, b, c, d); face(a + count, b + count, c + count, d + count, true);
  }
  const perimeter = [];
  for (let c = 0; c <= columns; c++) perimeter.push(c);
  for (let r = 1; r <= rows; r++) perimeter.push(r * (columns + 1) + columns);
  for (let c = columns - 1; c >= 0; c--) perimeter.push(rows * (columns + 1) + c);
  for (let r = rows - 1; r > 0; r--) perimeter.push(r * (columns + 1));
  for (let i = 0; i < perimeter.length; i++) { const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length]; face(a, a + count, b + count, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function bridgeDeckGeometry(width, length, floor = .04, rise = .24) {
  return thickPatch((u, v) => [(u - .5) * width, floor + rise * Math.sin(Math.PI * v), (v - .5) * length], 12, 36, .18);
}

export function hipRoofSampler(width, depth, eaves, rise, ridgeLength, face) {
  return (u, v) => {
    const t = u * 2 - 1, y = eaves + rise * Math.pow(1 - v, 1.65) + .16 * Math.pow(v, 8) + .18 * Math.pow(Math.abs(t), 8) * Math.pow(v, 3);
    if (face < 2) return [t * (ridgeLength + (width - ridgeLength) * v) / 2, y, (face ? -1 : 1) * depth * v / 2];
    return [(face === 2 ? 1 : -1) * (ridgeLength + (width - ridgeLength) * v) / 2, y, t * depth * v / 2];
  };
}

export function chineseRoof(b, parent, name, width, depth, eaves, rise, ridgeLength = width * .62) {
  const roof = namedGroup(parent, name, { body: 'complete-four-sided-upturned-hip-roof-with-laid-tiles', dimensionsEvidence: 'authored-proportional-hypothesis' });
  for (let face = 0; face < 4; face++) {
    const sample = hipRoofSampler(width, depth, eaves, rise, ridgeLength, face);
    // Triangular hip tips converge at the ridge, so the substrate starts .5%
    // below it and is buried into the closed ridge coping.
    const safe = (u, v) => sample(u, .005 + v * .995);
    b.add(roof, thickPatch(safe, face < 2 ? 24 : 14, 24, .13), b.m.timber);
    const columns = Math.max(4, Math.ceil((face < 2 ? width : depth) / .23)), rows = Math.max(5, Math.ceil(Math.hypot(depth / 2, rise) / .29));
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const v0 = .008 + row / rows * .992, v1 = Math.min(1, v0 + 1.12 / rows), u0 = column / columns, u1 = (column + 1) / columns;
      const pan = (u, v) => { const p = sample(u0 + (u1 - u0) * u, v0 + (v1 - v0) * v); p[1] += .026 + .031 * Math.pow(Math.cos((u - .5) * Math.PI), 2); return p; };
      b.add(roof, thickPatch(pan, 4, 4, .026), (column + row) % 7 === 0 ? b.m.tileEdge : b.m.tile);
    }
    const eave = Array.from({ length: 33 }, (_, i) => { const p = sample(i / 32, 1); p[1] -= .09; return p; });
    b.sweep(roof, eave, .16, .14, b.m.tileEdge, V(0, 1, 0), 40);
    for (let c = 0; c <= columns; c++) {
      const lower = sample(c / columns, 1), upper = sample(c / columns, .76); lower[1] -= .17; upper[1] -= .17;
      b.sweep(roof, [upper, lower], .085, .09, b.m.timber, V(0, 1, 0), 4);
    }
  }
  b.sweep(roof, [[-ridgeLength / 2 - .10, eaves + rise + .09, 0], [0, eaves + rise + .09, 0], [ridgeLength / 2 + .10, eaves + rise + .09, 0]], .21, .25, b.m.tileEdge, V(0, 1, 0), 26);
  for (const side of [-1, 1]) {
    const x = side * ridgeLength / 2;
    b.sweep(roof, [[x - side * .18, eaves + rise + .10, 0], [x, eaves + rise + .27, 0], [x + side * .13, eaves + rise + .58, 0], [x + side * .02, eaves + rise + .66, 0]], .13, .16, b.m.tileEdge, V(0, 0, 1), 22);
  }
  return roof;
}

// Shared only by the new maze/gate and aviary studies. No existing asset source
// is imported as a factory or refactored, and every material/geometry is local.
export class GardenGateBuilder {
  constructor(prefix) {
    this.prefix = prefix; this.pending = new Map(); this.prototypes = new Map(); this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.disposed = false;
    this.contacts = []; this.openings = []; this.waterEndpoints = [];
    const data = new Uint8Array(64 * 64 * 4); let random = 91281;
    for (let i = 0; i < data.length; i += 4) { random = Math.imul(random ^ random >>> 13, 1597334677); const v = 220 + (random >>> 0) / 4294967296 * 20 - 10; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
    const rough = new THREE.DataTexture(data, 64, 64); rough.name = `${prefix}-restrained-mineral-roughness`; rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(4, 4); rough.needsUpdate = true; this.textures.add(rough);
    const material = (name, category, properties) => { const m = new THREE.MeshStandardMaterial(properties); m.name = `${prefix}-${name}`; m.userData = { category, evidence: 'authored-material-response' }; this.materials.add(m); return m; };
    this.water = createFountainWater(prefix); for (const m of [this.water.surface, this.water.flow]) this.materials.add(m); for (const t of this.water.textures) this.textures.add(t);
    this.m = {
      stone: material('warm-marble', 'stone', { color: 0xe0daca, roughness: .82, roughnessMap: rough }), carving: material('marble-carving', 'stone', { color: 0xeae4d7, roughness: .78, roughnessMap: rough }), recess: material('stone-recess', 'stone', { color: 0xb5b0a4, roughness: .94 }),
      brick: material('blue-grey-carved-brick', 'masonry', { color: 0x777b78, roughness: .95, roughnessMap: rough }), brickRelief: material('blue-grey-brick-cut-faces', 'masonry', { color: 0x969b96, roughness: .88, roughnessMap: rough }),
      paving: material('light-limestone-paving', 'stone', { color: 0xc9c2ae, roughness: .94 }), wetStone: material('wet-neutral-stone', 'stone', { color: 0xaaa99f, roughness: .49 }), plaster: material('mineral-render', 'plaster', { color: 0xd4caba, roughness: .94 }),
      timber: material('dark-timber', 'timber', { color: 0x514634, roughness: .67 }), tile: material('provisional-muted-glaze', 'glazed-tile', { color: 0x596f64, roughness: .38 }), tileEdge: material('provisional-glaze-edges', 'glazed-tile', { color: 0x7c8b78, roughness: .39 }),
      grille: material('dark-bronze-grille', 'metal-grille', { color: 0x4d5548, roughness: .69, metalness: .66 }), joint: material('masonry-joints', 'masonry', { color: 0xaaa89a, roughness: 1 }),
      copper: material('cast-copper', 'copper', { color: 0x806a4d, roughness: .70, metalness: .81, roughnessMap: rough }), patina: material('copper-patina', 'copper', { color: 0x34483c, roughness: .83, metalness: .66 }), water: this.water.surface, flow: this.water.flow,
    };
  }
  prototype(name, make) { if (!this.prototypes.has(name)) this.prototypes.set(name, make()); return this.prototypes.get(name); }
  add(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], owned = true) {
    if (scale.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Garden studies require positive finite part scales.');
    let part = geometry.clone(); if (part.index) { const old = part; part = part.toNonIndexed(); old.dispose(); }
    part.applyMatrix4(new THREE.Matrix4().compose(V(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), V(...scale)));
    const key = `${parent.uuid}:${material.id}`; if (!this.pending.has(key)) this.pending.set(key, { parent, material, parts: [] }); this.pending.get(key).parts.push(part); if (owned) geometry.dispose();
  }
  box(parent, material, position, size, bevel = .012, rotation = [0, 0, 0]) {
    if (bevel) this.add(parent, this.prototype(`rounded-box:${size}:${bevel}`, () => new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map(x => x / 5)))), material, position, undefined, rotation, false);
    else this.add(parent, this.prototype('unit-box', () => new THREE.BoxGeometry(1, 1, 1)), material, position, size, rotation, false);
  }
  lathe(parent, profile, position, material = this.m.stone, segments = 24) {
    const closed = [...profile]; if (closed[0][0] > 0) closed.unshift([0, closed[0][1]]); if (closed.at(-1)[0] > 0) closed.push([0, closed.at(-1)[1]]);
    const geometry = new THREE.LatheGeometry(closed.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments); geometry.normalizeNormals(); this.add(parent, geometry, material, position);
  }
  polygon(parent, points, bottom, top, material, holes = []) { this.add(parent, extrudedPolygon(points, bottom, top, holes), material); }
  sweep(parent, points, width, depth, material = this.m.carving, axis = V(0, 0, 1), segments = 24) { this.add(parent, stoneSweep(points, width, depth, axis, segments), material); }
  loft(parent, sections, material, sides = 14, steps = 24) { this.add(parent, organicLoft(sections, sides, steps), material); }
  leaf(parent, position, scale = [1, 1, 1], rotation = [0, 0, 0], material = this.m.carving) { this.add(parent, this.prototype('carved-leaf', () => carvedLeaf('acanthus')), material, position, scale, rotation, false); }
  shell(parent, position, width, height, depth, material = this.m.carving) { this.add(parent, shellGeometry(width, height, depth), material, position); }
  waterArc(parent, points, radius, id, basinId) { this.add(parent, fountainFlowGeometry(points, radius), this.m.flow); this.waterEndpoints.push({ id, basinId, start: points[0], end: points.at(-1), coordinateSpace: parent.name, evidence: 'illustrative-water-state-not-measured' }); }
  flush() {
    for (const { parent, material, parts } of this.pending.values()) {
      const geometry = mergeGeometries(parts); if (!geometry) throw new Error(`Cannot merge ${parent.name}`); this.geometries.add(geometry); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `${parent.name}/${material.name}`; mesh.castShadow = material.userData.category !== 'water'; mesh.receiveShadow = true; if (material.userData.category === 'water') mesh.renderOrder = material.userData.role === 'flow' ? 2 : 1; parent.add(mesh);
      for (const part of parts) part.dispose();
    }
    this.pending.clear();
  }
  finish(group, properties) {
    this.flush(); for (const g of this.prototypes.values()) g.dispose(); this.prototypes.clear(); group.updateMatrixWorld(true);
    const visibleMaterials = new Set(), visibleTextures = new Set();
    group.traverse(node => { if (node.isMesh) for (const material of [].concat(node.material)) { visibleMaterials.add(material); for (const value of Object.values(material)) if (value?.isTexture) visibleTextures.add(value); } });
    for (const material of this.materials) if (!visibleMaterials.has(material)) { material.dispose(); this.materials.delete(material); }
    for (const texture of this.textures) if (!visibleTextures.has(texture)) { texture.dispose(); this.textures.delete(texture); }
    const bounds = new THREE.Box3().setFromObject(group), subassemblies = []; let triangles = 0, meshes = 0;
    group.traverse(node => {
      if (node.isMesh) { triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; meshes++; }
      if (node.isGroup && node !== group) { let count = 0, meshCount = 0; node.traverse(child => { if (child.isMesh) { meshCount++; count += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3; } }); if (meshCount) { const box = new THREE.Box3().setFromObject(node); subassemblies.push({ name: node.name, body: node.userData.body ?? null, triangleCount: count, meshCount, bounds: { min: box.min.toArray(), max: box.max.toArray() } }); } }
    });
    const diagnostics = { ...properties, version: 1, units: 'metres', timeLayer: '1859–1860-before-destruction', visualAcceptance: false, integrationAcceptance: false, triangleCount: triangles, triangles, meshCount: meshes, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(V(0, 0, 0)).toArray() }, subassemblies, contacts: this.contacts, openingChecks: this.openings, waterEndpoints: this.waterEndpoints, materials: [...this.materials].map(m => ({ name: m.name, category: m.userData.category, role: m.userData.role ?? null })), resourceOwnership: { scope: 'one-factory-invocation', geometries: this.geometries.size, materials: this.materials.size, textures: this.textures.size, moduleGlobalCache: false, disposalIsIdempotent: true } };
    return { group, diagnostics, update: time => { if (!this.disposed) this.water.update(time); }, dispose: () => { if (this.disposed) return; this.dispose(); group.clear(); } };
  }
  dispose() { if (this.disposed) return; this.disposed = true; for (const { parts } of this.pending.values()) for (const p of parts) p.dispose(); this.pending.clear(); for (const g of this.prototypes.values()) g.dispose(); this.prototypes.clear(); for (const set of [this.geometries, this.materials, this.textures]) { for (const resource of set) resource.dispose(); set.clear(); } }
}

export function baluster(b, parent, position, height = .9, radius = .105) { b.lathe(parent, [[radius * 1.3, 0], [radius * 1.3, .08 * height], [radius * .65, .15 * height], [radius, .27 * height], [radius * 1.13, .46 * height], [radius * .50, .67 * height], [radius * .63, .86 * height], [radius * 1.25, .92 * height], [radius * 1.25, height]], position, b.m.carving, 16); }

export function reliefPanel(b, parent, position, width, height, material = b.m.carving) {
  const g = namedGroup(parent, `${parent.name}-relief-${position.join('-')}`, { body: 'authored-floral-relief-no-unverified-iconography' }); g.position.set(...position);
  b.box(g, b.m.recess, [0, 0, -.035], [width, height, .08], .018);
  for (const s of [-1, 1]) { b.box(g, material, [s * (width / 2 - .06), 0, .008], [.12, height, .10], .012); b.box(g, material, [0, s * (height / 2 - .06), .008], [width, .12, .10], .012); }
  b.shell(g, [0, -.16 * height, .02], width * .30, height * .40, .05, material);
  for (const side of [-1, 1]) for (const row of [-1, 1]) b.leaf(g, [side * width * .22, row * height * .20, .035], [width * .31, height * .42, .48], [0, 0, -side * row * .7], material);
  return g;
}

export function flutedColumnGeometry(height, lowerRadius, upperRadius, flutes = 12) {
  const g = new THREE.CylinderGeometry(upperRadius, lowerRadius, height, 96, 18, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i)); if (r < .00001) continue;
    const t = THREE.MathUtils.clamp((p.getY(i) + height / 2) / height, 0, 1), a = Math.atan2(p.getX(i), p.getZ(i));
    const sine = Math.max(0, Math.sin(Math.PI * t)), flute = .015 * Math.pow(.5 + .5 * Math.cos(a * flutes), 2) * sine ** .35, entasis = .018 * sine;
    const scale = (r - flute + entasis) / r; p.setX(i, p.getX(i) * scale); p.setZ(i, p.getZ(i) * scale);
  }
  g.translate(0, height / 2, 0); g.computeVertexNormals(); return g;
}

export function urn(b, parent, position, height = 1, material = b.m.carving) {
  const profile = [[.22, 0], [.22, .08], [.15, .13], [.12, .22], [.24, .32], [.29, .48], [.26, .61], [.17, .69], [.16, .73], [.24, .77], [.24, .84], [.14, .91], [0, 1]].map(([r, y]) => [r * height, y * height]);
  b.lathe(parent, profile, position, material, 32);
  for (const side of [-1, 1]) b.sweep(parent, [[position[0] + side * .16 * height, position[1] + .68 * height, position[2]], [position[0] + side * .35 * height, position[1] + .65 * height, position[2]], [position[0] + side * .36 * height, position[1] + .43 * height, position[2]], [position[0] + side * .25 * height, position[1] + .38 * height, position[2]]], .042 * height, .062 * height, material, V(0, 0, 1), 24);
}

export function column(b, parent, id, x, z, bottom, height, radius = .23, carved = true) {
  const g = namedGroup(parent, id, { body: carved ? 'fluted-stone-column-with-carved-capital' : 'turned-stone-column' }); g.position.set(x, bottom, z);
  const foot = radius * 2.8;
  b.box(g, b.m.stone, [0, .10, 0], [foot, .20, foot], .012);
  b.lathe(g, [[radius * 1.32, .18], [radius * 1.32, .25], [radius * 1.12, .31], [radius * 1.16, .39], [radius, .47]], [0, 0, 0], b.m.carving, 40);
  b.add(g, b.prototype(`column-shaft:${height}:${radius}`, () => flutedColumnGeometry(height - 1.02, radius, radius * .86)), b.m.stone, [0, .43, 0], undefined, undefined, false);
  b.lathe(g, [[radius * .87, height - .63], [radius * .93, height - .57], [radius * 1.12, height - .51], [radius * 1.21, height - .29], [radius * 1.37, height - .22], [radius * 1.37, height - .15]], [0, 0, 0], b.m.carving, 40);
  b.box(g, b.m.carving, [0, height - .08, 0], [radius * 3.0, .18, radius * 3.0], .016);
  if (carved) for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    b.leaf(g, [Math.sin(a) * radius * 1.04, height - .43, Math.cos(a) * radius * 1.04], [radius * 1.0, .45, .23], [0, a, .08 * Math.sin(a)], b.m.carving);
  }
  return g;
}

export function foliateScroll(b, parent, points, width = .10, depth = .08, material = b.m.carving) {
  b.sweep(parent, points, width, depth, material, V(0, 0, 1), 40);
  for (let i = 1; i + 1 < points.length; i += 2) {
    const p = points[i], next = points[i + 1], angle = Math.atan2(next[1] - p[1], next[0] - p[0]) - Math.PI / 2;
    b.leaf(parent, [p[0], p[1], p[2] + depth * .28], [.26, .45, .26], [0, 0, angle + (i % 4 ? .35 : -.35)], material);
  }
}

export function cartouche(b, parent, x, y, z, width, height, material = b.m.carving) {
  const ring = Array.from({ length: 49 }, (_, i) => { const a = i / 48 * TAU; return [x + width / 2 * Math.sin(a) * (1 + .08 * Math.cos(4 * a)), y + height / 2 * Math.cos(a), z]; });
  b.sweep(parent, ring, .065, .09, material, V(0, 0, 1), 64);
  b.shell(parent, [x, y - height * .25, z + .035], width * .43, height * .44, .07, material);
  for (const side of [-1, 1]) for (const row of [-1, 1]) b.leaf(parent, [x + side * width * .27, y + row * height * .19, z + .025], [width * .40, height * .52, .32], [0, 0, -side * row * .65], material);
}

export function archMouldings(b, parent, x, bottom, width, spring, rise, z, material = b.m.carving) {
  for (const [delta, thickness, offset] of [[0, .13, .05], [.19, .065, .085], [.32, .085, .02]]) {
    b.sweep(parent, archOutline(x, bottom, width + delta * 2, spring, rise + delta, z + offset), thickness, .12, material, V(0, 0, 1), 72);
  }
  b.add(parent, facadeGeometry([[-.18, -.18], [.18, -.18], [.24, .20], [-.24, .20]], -.08, .12), material, [x, spring + rise + .08, z + .08]);
}

export function latticePanel(b, parent, name, width, bottom, spring, rise, spacing = .22, material = b.m.grille, x = 0, z = 0) {
  const g = namedGroup(parent, name, { body: 'open-physical-grille-with-arched-head', spacing, rodThickness: .026 }); g.position.set(x, 0, z);
  const half = width / 2, topAt = x => spring + rise * Math.sqrt(Math.max(0, 1 - (x / half) ** 2));
  const count = Math.ceil(width / spacing);
  for (let i = 0; i <= count; i++) {
    const xx = -half + i / count * width, top = topAt(xx); b.box(g, material, [xx, (bottom + top) / 2, 0], [.027, top - bottom, .035], .004);
  }
  for (let y = bottom + spacing; y < spring + rise - .03; y += spacing) {
    const halfWidth = y <= spring ? half : half * Math.sqrt(Math.max(0, 1 - ((y - spring) / rise) ** 2));
    b.box(g, material, [0, y, 0], [halfWidth * 2, .027, .035], .004);
  }
  b.sweep(g, archOutline(0, bottom, width, spring, rise), .060, .062, material, V(0, 0, 1), 56);
  b.box(g, material, [0, bottom, 0], [width, .065, .065], .006); return g;
}

export function openGateLeaves(b, parent, name, width, bottom, height) {
  const g = namedGroup(parent, name, { body: 'paired-ornamented-gate-leaves-held-open-for-study', state: 'open-authored-access-state-not-engraved-closed-state' });
  for (const side of [-1, 1]) {
    const leaf = namedGroup(g, `${name}-${side < 0 ? 'left' : 'right'}`, { body: 'hinged-grille-leaf-with-solid-lower-panel' }); leaf.position.set(side * width / 2, 0, 0); leaf.rotation.y = side * 1.46;
    const center = -side * width / 4;
    b.box(leaf, b.m.timber, [center, bottom + .45, 0], [width / 2 - .035, .84, .095], .012);
    latticePanel(b, leaf, `${leaf.name}-upper-grille`, width / 2 - .04, bottom + .91, bottom + height - .28, .16, .18, b.m.grille, center, 0);
    for (const edge of [-1, 1]) b.box(leaf, b.m.grille, [center + edge * (width / 4 - .025), bottom + height / 2, 0], [.055, height, .105], .008);
    cartouche(b, leaf, center, bottom + .45, .063, width * .29, .54, b.m.copper);
  }
  return g;
}

export function gardenBridge(b, parent, id, x, z, width, length, rotation = 0) {
  const g = namedGroup(parent, id, { body: 'arched-thick-deck-on-masonry-abutments', length, width }); g.position.set(x, 0, z); g.rotation.y = rotation;
  b.add(g, bridgeDeckGeometry(width, length), b.m.paving);
  for (const side of [-1, 1]) {
    b.box(g, b.m.stone, [0, -.39, side * (length / 2 - .20)], [width + .58, .86, .55], .025);
    const rail = Array.from({ length: 25 }, (_, i) => [side * (width / 2 - .06), 1.00 + .24 * Math.sin(Math.PI * i / 24), (i / 24 - .5) * length]);
    b.sweep(g, rail, .15, .16, b.m.carving, V(1, 0, 0), 42);
    const count = Math.ceil(length / .42);
    for (let i = 0; i <= count; i++) { const t = i / count; baluster(b, g, [side * (width / 2 - .06), .04 + .24 * Math.sin(Math.PI * t), (t - .5) * length], .91, .084); }
    for (const end of [-1, 1]) {
      b.box(g, b.m.stone, [side * (width / 2 - .06), .54, end * length / 2], [.30, 1.02, .30], .012);
      urn(b, g, [side * (width / 2 - .06), 1.05, end * length / 2], .47);
    }
  }
  for (let i = 1; i < 20; i++) { const t = i / 20; b.box(g, b.m.joint, [0, .042 + .24 * Math.sin(Math.PI * t), (t - .5) * length], [width - .04, .004, .009], 0); }
  return g;
}

export function roundPool(b, parent, id, x, z, radius = 1.1, rim = .34, water = .17) {
  const g = namedGroup(parent, id, { body: 'excavated-round-receiving-basin', waterLevel: water }); g.position.set(x, 0, z);
  const ring = (r, n = 64) => Array.from({ length: n }, (_, i) => [r * Math.sin(i / n * TAU), r * Math.cos(i / n * TAU)]);
  b.polygon(g, ring(radius), -.40, -.29, b.m.wetStone);
  b.polygon(g, ring(radius + .18), -.35, rim, b.m.stone, [ring(radius)]);
  b.polygon(g, ring(radius + .24), rim - .04, rim + .07, b.m.carving, [ring(radius - .045)]);
  b.polygon(g, ring(radius - .015), water - .006, water, b.m.water);
  return g;
}

export function carvedBrickMotif(size = .66) {
  // The traditional 卍 brickwork is one connected, shallow relief, with no
  // coplanar overlapping bars. Trace only the exposed cell edges of its union.
  const cells = new Set();
  for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (x === 3 || y === 3 || x === 0 && y > 3 || y === 6 && x > 3 || x === 6 && y < 3 || y === 0 && x < 3) cells.add(`${x},${y}`);
  const edges = new Map();
  for (const cell of cells) {
    const [x, y] = cell.split(',').map(Number);
    for (const [dx, dy, a, c] of [[0, -1, [x, y], [x + 1, y]], [1, 0, [x + 1, y], [x + 1, y + 1]], [0, 1, [x + 1, y + 1], [x, y + 1]], [-1, 0, [x, y + 1], [x, y]]]) if (!cells.has(`${x + dx},${y + dy}`)) edges.set(a.join(','), c);
  }
  const start = [...edges.keys()][0], points = []; let at = start;
  do { const [x, y] = at.split(',').map(Number); points.push([(x - 3.5) * size / 7, (y - 3.5) * size / 7]); at = edges.get(at).join(','); } while (at !== start);
  return facadeGeometry(points, -.004, .023);
}
