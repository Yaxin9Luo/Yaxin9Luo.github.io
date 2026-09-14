import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, TAU, namedGroup, extrudedPolygon } from './study-geometry.js';
import { openingShape, openingOutline, wallWithOpenings, mouldingSweep, squarePearBaluster, stairPoint, curvedStairTread, stairCurbGeometry, hipRoofGeometry, hipRoofTileGeometry, pavilionRoofGeometry, bambooPoleGeometry, reliefLeaf, reliefShell } from './fangwaiguan-geometry.js';
import {configureFangwaiguanMaterials,projectFangwaiguanSurfaceUVs} from './fangwaiguan-materials.js';

// Authored metric study, metres, +Y up, +Z south. No global mutable resources.
const MEASURED = 'Durand-1988-reported-survey-restitution-not-Qing-as-built';
const INFERRED = 'authored-proportional-reconstruction-hypothesis';
const UPPER_FLOOR = 4.84;
const SOURCES = [
  { id: 'durand-belvedere', type: 'survey-based-restitution', url: 'https://www.persee.fr/doc/arasi_0004-3958_1988_num_43_1_1240', label: 'Durand 1988 pp.129–130, Fangwaiguan / belvédère', constraint: '14×7×13m excludes lateral stairs; wall thickness, tympana and some balustrade detail are reconstructed' },
  { id: 'fangwaiguan-engraving', type: 'historic-engraving', url: 'https://commons.wikimedia.org/wiki/File:圆明园铜版画册-6.jpg', label: '方外觀正面，原图八', constraint: 'three bays, two levels, oval lower windows, curving stairs and double-eave roof; perspective is not metric survey' },
  { id: 'wuzhuting-engraving', type: 'historic-engraving', url: 'https://commons.wikimedia.org/wiki/File:圆明园铜版画册-7.jpg', label: '竹亭北面，原图九', constraint: 'five linked pavilions and their garden; exact footprint and spacing unresolved' },
  { id: 'chinese-elements', type: 'authored-research', url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj040/201612/t20161230_1330939.html', label: '孙晨露，西洋楼的中国元素', constraint: 'describes blue/green double-eave hipped roof, pavilion roofs and 1770 pavilion relocation; exact finishes remain inferred' },
];

function mineralNoise(x, y, cells) {
  const px = x * cells, py = y * cells, ix = Math.floor(px), iy = Math.floor(py);
  const sample = (a, b) => {
    let hash = (Math.imul(a % cells + 13, 374761393) + Math.imul(b % cells + 29, 668265263)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0; return (hash ^ (hash >>> 16)) >>> 0;
  };
  const sx = THREE.MathUtils.smoothstep(px - ix, 0, 1), sy = THREE.MathUtils.smoothstep(py - iy, 0, 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(ix, iy), sample(ix + 1, iy), sx), THREE.MathUtils.lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), sx), sy) / 4294967296;
}
function surfaceTexture(kind, normal = false) {
  const tint = kind === 'mineral-tint', size = tint ? 128 : 64, data = new Uint8Array(size * size * 4); let seed = 0x715caf;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296 - .5, i = (y * size + x) * 4;
    if (normal) {
      data[i] = 128 + (kind === 'water' ? 8 * Math.cos(TAU * x / 16 + Math.sin(TAU * y / 32)) : noise * 6);
      data[i + 1] = 128 + (kind === 'water' ? 8 * Math.cos(TAU * y / 16 + Math.sin(TAU * x / 32)) : noise * 6);
      data[i + 2] = 255;
    } else if (tint) {
      const mineral = .55 * mineralNoise(x / size, y / size, 4) + .30 * mineralNoise(x / size, y / size, 8) + .15 * mineralNoise(x / size, y / size, 16) - .5;
      data[i] = 247 + 15 * mineral + noise; data[i + 1] = 247 + 13 * mineral + noise; data[i + 2] = 247 + 11 * mineral + noise;
    } else data[i] = data[i + 1] = data[i + 2] = (kind === 'copper' ? 220 : 232) + noise * 10;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size); texture.name = `fangwaiguan-${kind}-${normal ? 'normal' : 'roughness'}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(tint ? .38 : 3, tint ? .38 : 3); texture.generateMipmaps = true;
  if (tint) texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true; return texture;
}
class Builder {
  constructor() {
    this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.prototypes = new Map(); this.pending = new Map();
    this.disposed = false; this.temporaryDisposals = 0; this.openings = []; this.contacts = []; this.walkPaths = []; this.m = this.makeMaterials();
  }
  texture(kind, normal) { const texture = surfaceTexture(kind, normal); this.textures.add(texture); return texture; }
  makeMaterials() {
    const normal = this.texture('stone', true), rough = this.texture('stone', false), copperRough = this.texture('copper', false);
    const material = (name, category, properties, physical = false) => {
      const result = physical ? new THREE.MeshPhysicalMaterial(properties) : new THREE.MeshStandardMaterial(properties);
      result.name = `fangwaiguan-${name}`; result.userData = { category, evidence: 'authored-material-response' }; this.materials.add(result); return result;
    };
    const stone = { color: 0xece7dc, roughness: .80, normalMap: normal, normalScale: new THREE.Vector2(.12, .12), roughnessMap: rough };
    return {
      stone: material('warm-white-stone', 'stone', stone), carving: material('fresh-cut-marble', 'stone', { ...stone, color: 0xf3eee4, roughness: .76 }),
      warmBlock: material('warm-cut-stone-blocks', 'stone', { ...stone, color: 0xeee8dc, roughness: .81 }), coolBlock: material('cool-cut-stone-blocks', 'stone', { ...stone, color: 0xefede5, roughness: .78 }),
      recess: material('stone-recesses', 'stone', { ...stone, color: 0xc7c5b7, roughness: .91 }), paving: material('warm-paving', 'stone', { ...stone, color: 0xd4cebe, roughness: .94 }),
      plaster: material('mineral-plaster', 'plaster', { ...stone, color: 0xe6e1d0, map: this.texture('mineral-tint', false), roughness: .93 }), brick: material('grey-brick', 'masonry', { ...stone, color: 0xa3a59a, roughness: .97 }),
      tile: material('blue-green-glazed-roof', 'glazed-tile', { color: 0x42776b, roughness: .38, roughnessMap: rough, clearcoat: .32, clearcoatRoughness: .25 }, true),
      blueTile: material('blue-glazed-roof-bands', 'glazed-tile', { color: 0x426979, roughness: .38, clearcoat: .30, clearcoatRoughness: .25 }, true),
      variedTile: material('green-glaze-firing-variation', 'glazed-tile', { color: 0x4a7d6e, roughness: .41, clearcoat: .30, clearcoatRoughness: .27 }, true),
      variedBlueTile: material('blue-glaze-firing-variation', 'glazed-tile', { color: 0x487080, roughness: .40, clearcoat: .30, clearcoatRoughness: .27 }, true),
      tileEdge: material('pale-glazed-edge', 'glazed-tile', { color: 0x90a08a, roughness: .43, clearcoat: .22 }, true),
      copper: material('restrained-copper', 'copper', { color: 0x847355, metalness: .80, roughness: .70, roughnessMap: copperRough }),
      bamboo: material('honey-bamboo', 'bamboo', { color: 0xa18b55, roughness: .76, normalMap: normal, normalScale: new THREE.Vector2(.09, .09) }),
      bambooLight: material('bamboo-cut-and-bound', 'bamboo', { color: 0xc0ac76, roughness: .80 }), timber: material('painted-wood-joinery', 'timber', { color: 0x525544, roughness: .73 }),
      glass: material('recessed-window-glass', 'glass', { color: 0x8eaaa1, roughness: .20, transparent: true, opacity: .62, transmission: .18, thickness: .06, depthWrite: false }, true),
      water: material('garden-water', 'water', { color: 0x8ab5ac, roughness: .17, transparent: true, opacity: .74, transmission: .24, thickness: .45, ior: 1.333, depthWrite: false, normalMap: this.texture('water', true), normalScale: new THREE.Vector2(.08, .08) }, true),
      soil: material('planting-earth', 'soil', { color: 0x5d6350, roughness: 1 }), foliage: material('garden-leaves', 'foliage', { color: 0x526d43, roughness: .9 }),
    };
  }
  prototype(key, make) { if (!this.prototypes.has(key)) this.prototypes.set(key, make()); return this.prototypes.get(key); }
  add(parent, source, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], own = false) {
    if (scale.some(v => v <= 0)) throw new Error('Fangwaiguan uses positive mesh scales; mirrored forms must be constructed geometrically.');
    let geometry = source.clone(); if (geometry.index) { const old = geometry; geometry = old.toNonIndexed(); old.dispose(); this.temporaryDisposals++; }
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    geometry.applyMatrix4(new THREE.Matrix4().compose(V(...position), quaternion, V(...scale)));
    const key = `${parent.uuid}:${material.id}`;
    if (!this.pending.has(key)) this.pending.set(key, { parent, material, parts: [] }); this.pending.get(key).parts.push(geometry);
    if (own) { source.dispose(); this.temporaryDisposals++; }
  }
  box(parent, material, position, size, bevel = .012, rotation) {
    if (bevel) this.add(parent, this.prototype(`box:${size}:${bevel}`, () => new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map(v => v / 6)))), material, position, undefined, rotation);
    else this.add(parent, this.prototype('box', () => new THREE.BoxGeometry()), material, position, size, rotation);
  }
  polygon(parent, points, bottom, top, material, holes = []) { this.add(parent, extrudedPolygon(points, bottom, top, holes), material, undefined, undefined, undefined, true); }
  sweep(parent, points, width, depth, material = this.m.carving, segments = 26, axis) { this.add(parent, mouldingSweep(points, width, depth, segments, axis), material, undefined, undefined, undefined, true); }
  leaf(parent, position, scale = [1, 1, 1], rotation = [0, 0, 0], material = this.m.carving) { this.add(parent, this.prototype('relief-leaf', reliefLeaf), material, position, scale, rotation); }
  shell(parent, position, width, height, depth = .17, rotation) { this.add(parent, reliefShell(width, height, depth), this.m.carving, position, undefined, rotation, true); }
  lathe(parent, profile, position, material = this.m.carving, sides = 24) { this.add(parent, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(.003, r), y)), sides), material, position, undefined, undefined, true); }
  bamboo(parent, from, to, radius = .065, light = false) {
    const start = V(...from), end = V(...to), length = start.distanceTo(end);
    if (length < .003) return;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), end.sub(start).normalize());
    this.add(parent, this.prototype(`bamboo:${length.toFixed(4)}:${radius}`, () => bambooPoleGeometry(length, radius)), light ? this.m.bambooLight : this.m.bamboo, from, undefined, q);
  }
  baluster(parent, point, height = 1.0, radius = .16, rotation = 0) { this.add(parent, this.prototype(`pear:${height.toFixed(4)}:${radius}`, () => squarePearBaluster(height, radius)), this.m.carving, point, undefined, [0, rotation, 0]); }
  flush() {
    for (const { parent, material, parts } of this.pending.values()) {
      if(this.metricMaterials?.has(material)){
        parent.updateWorldMatrix(true,false);
        for(const part of parts)projectFangwaiguanSurfaceUVs(part,parent.matrixWorld);
      }
      const geometry = mergeGeometries(parts); if (!geometry) throw new Error(`Geometry merge failed: ${parent.name}`);
      geometry.name = `${parent.name}/${material.name}`; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = geometry.name; mesh.castShadow = !['water', 'glass'].includes(material.userData.category); mesh.receiveShadow = true;
      if (material.transparent) mesh.renderOrder = material.userData.category === 'water' ? 2 : 1;
      parent.add(mesh); for (const part of parts) { part.dispose(); this.temporaryDisposals++; }
    }
    this.pending.clear();
  }
  releasePrototypes() { for (const p of this.prototypes.values()) { p.dispose(); this.temporaryDisposals++; } this.prototypes.clear(); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    for (const { parts } of this.pending.values()) for (const part of parts) part.dispose(); this.pending.clear(); this.releasePrototypes();
    for (const collection of [this.geometries, this.materials, this.textures]) { for (const resource of collection) resource.dispose(); collection.clear(); }
  }
}
function scroll(b, group, x, y, z, size, side = 1) {
  const points = [[x - side * size * .75, y - .23 * size, z], [x - side * .43 * size, y + .28 * size, z], [x + side * .20 * size, y + .36 * size, z], [x + side * .42 * size, y + .05 * size, z], [x + side * .21 * size, y - .15 * size, z], [x - side * .06 * size, y - .07 * size, z + .04], [x, y + .09 * size, z + .07]];
  b.sweep(group, points, size * .19, size * .19); b.leaf(group, [x - side * size * .35, y + size * .07, z + .08], [size * .75, size * .68, size * .7], [0, 0, side * .72]);
}
function cornice(b, parent, width, depth, y, dentils = true) {
  for (const [dy, w, h, d] of [[-.19, 0, .13, 0], [-.05, .12, .14, .12], [.10, .30, .13, .30], [.21, .43, .09, .44]]) b.box(parent, b.m.carving, [0, y + dy, 0], [width + w, h, depth + d], .02);
  if (dentils) for (let x = -width / 2 + .22; x < width / 2; x += .37) for (const z of [-1, 1]) b.box(parent, b.m.carving, [x, y - .33, z * depth / 2], [.13, .19, .24], .008);
}
function column(b, parent, x, z, bottom, height, name, lower = false) {
  const group = namedGroup(parent, name, { body: 'rusticated-square-stone-pilaster', evidence: 'historic-engraving-and-Durand-p130-fragments' });
  group.position.set(x, bottom, z);
  b.box(group, b.m.stone, [0, .16, 0], [1.04, .32, .78], .03);
  const rows = lower ? 8 : 10, shaft = height - .83;
  b.box(group, b.m.recess, [0, .39 + shaft / 2, 0], [.51, shaft, .44], .012);
  for (let row = 0; row < rows; row++) {
    const t = row / rows, h = shaft / rows - .07, w = lower ? .89 : .69 - .05 * t;
    const tone = Math.abs(Math.round(x * 100) * 13 + Math.round(z * 100) * 7 + row * row * 17 + row * 71) % 11;
    b.box(group, tone === 0 || tone === 3 || tone === 7 ? b.m.warmBlock : tone === 1 || tone === 5 ? b.m.coolBlock : b.m.carving, [0, .40 + (row + .5) * shaft / rows, .025], [w, h, lower ? .66 : .58], .021);
  }
  b.box(group, b.m.carving, [0, height - .23, 0], [.80, .18, .69], .018);
  b.box(group, b.m.carving, [0, height - .09, 0], [.96, .16, .78], .023);
  if (!lower) for (const side of [-1, 1]) b.leaf(group, [side * .21, height - .51, .32], [.35, .50, .36], [0, 0, -side * .45]);
  return group;
}
function windowSurround(b, parent, name, o, decorated = true) {
  const group = namedGroup(parent, name, { body: o.door ? 'open-door-in-true-masonry-portal' : 'recessed-glazed-opening', opening: { ...o }, evidence: o.evidence ?? INFERRED });
  for (const [padding, width, depth, z] of [[.07, .16, .19, .06], [.23, .15, .21, .12]]) b.sweep(group, openingOutline(o, padding, z), width, depth, b.m.carving, 64);
  if (!o.door) {
    const glazing = new THREE.ShapeGeometry(openingShape({ ...o, width: o.width - .10, height: o.height - .10, bottom: o.bottom + .05 }), 28);
    b.add(group, glazing, b.m.glass, [0, 0, -.29], undefined, undefined, true);
    const shape = openingShape({ ...o, width: o.width - .11, height: o.height - .1, bottom: o.bottom + .05 }), pts = shape.getPoints(80);
    // Clip each glazing bar to the opening, including oval windows.
    for (const horizontal of [true, false]) {
      const lo = horizontal ? o.bottom + .18 : o.x - o.width / 2 + .18, hi = horizontal ? o.bottom + o.height - .12 : o.x + o.width / 2 - .12;
      for (let v = lo; v < hi; v += horizontal ? .37 : .32) {
        const crosses = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], c = pts[i + 1], av = horizontal ? a.y : a.x, cv = horizontal ? c.y : c.x;
          if ((av <= v && cv > v) || (cv <= v && av > v)) crosses.push((horizontal ? a.x : a.y) + (v - av) / (cv - av) * ((horizontal ? c.x : c.y) - (horizontal ? a.x : a.y)));
        }
        crosses.sort((a, c) => a - c);
        if (crosses.length >= 2) {
          const low = crosses[0], high = crosses.at(-1), length = high - low;
          b.box(group, b.m.timber, horizontal ? [(low + high) / 2, v, -.20] : [v, (low + high) / 2, -.20], horizontal ? [length, .032, .075] : [.032, length, .075], .003);
        }
      }
    }
    const origin = [o.x + .075, o.bottom + o.height * .47, 2];
    b.openings.push({ id: name, elevation: parent.name, origin, direction: [0, 0, -1], expectedCategory: 'glass', evidence: 'authored-geometric-check' });
  } else {
    // Hinged leaves stand open into the room; centreline remains walkable.
    const leafWidth = o.width * .46;
    for (const side of [-1, 1]) {
      const hinge = namedGroup(group, `${name}-${side < 0 ? 'left' : 'right'}-open-leaf`, { body: 'open-timber-door-leaf' });
      hinge.position.set(o.x + side * o.width * .48, o.bottom, -.33); hinge.rotation.y = -side * Math.PI * .41;
      b.box(hinge, b.m.timber, [-side * leafWidth / 2, o.height * .44, 0], [leafWidth, o.height * .88, .10], .012);
      for (let row = 0; row < 3; row++) b.box(hinge, b.m.bambooLight, [-side * leafWidth / 2, .50 + row * (o.height - .75) / 3, .066], [leafWidth * .73, (o.height - .75) / 3 - .15, .035], .025);
      b.box(hinge, b.m.copper, [-side * leafWidth * .79, o.height * .40, .10], [.055, .17, .055], .012);
    }
  }
  if (o.kind === 'oval') {
    b.shell(group, [o.x, o.bottom + o.height + .17, .18], .60, .44, .11);
    b.leaf(group, [o.x, o.bottom - .19, .14], [.54, .51, .5], [0, 0, Math.PI]);
  } else if (decorated) {
    const top = o.bottom + o.height;
    if (o.door && o.bottom < 1) {
      // The surviving p130 door pediment is a broad hanging shell and scrolls,
      // set below the balcony band; it is not an oversized upper-window crest.
      b.shell(group, [o.x, top + .37, .20], 1.05, .48, .19, [0, 0, Math.PI]);
      for (const side of [-1, 1]) scroll(b, group, o.x + side * 1.0, top + .13, .12, .63, side);
      b.box(group, b.m.carving, [o.x, top + .45, .15], [3.40, .11, .37], .02);
      b.sweep(group, [[o.x - 1.65, top + .34, .12], [o.x - 1.44, top - .13, .13], [o.x - .70, top - .13, .14]], .12, .14);
      b.sweep(group, [[o.x + 1.65, top + .34, .12], [o.x + 1.44, top - .13, .13], [o.x + .70, top - .13, .14]], .12, .14);
    } else {
      b.shell(group, [o.x, top + .05, .15], o.width * .46, .52, .18);
      for (const side of [-1, 1]) scroll(b, group, o.x + side * (o.width * .42), top + .27, .11, .72, side);
      const crest = [[o.x - o.width * .71, top + .28, .12], [o.x - o.width * .41, top + .65, .12], [o.x, top + .87, .11], [o.x + o.width * .41, top + .65, .12], [o.x + o.width * .71, top + .28, .12]];
      b.sweep(group, crest, .17, .16);
    }
  }
  return group;
}
function elevation(b, parent, name, width, position, rotation, openings, front = false) {
  const group = namedGroup(parent, name, { body: 'full-thickness-wall-with-openings', evidence: front ? 'engraving-and-Durand-constrained-front' : INFERRED, wallThickness: .48 });
  group.position.set(...position); group.rotation.y = rotation;
  b.add(group, wallWithOpenings(width, .40, 10.18, .48, openings), b.m.plaster, undefined, undefined, undefined, true);
  for (let i = 0; i < openings.length; i++) windowSurround(b, group, `${name}-opening-${i + 1}`, openings[i], front || openings[i].kind !== 'oval');
  // Joint bands stop at openings; they are not opaque strips crossing the glass.
  for (let y = .92; y < 4.43; y += .46) {
    const gaps = openings.filter(o => y >= o.bottom - .34 && y <= o.bottom + o.height + .42).map(o => [o.x - o.width / 2 - .44, o.x + o.width / 2 + .44]).sort((a, c) => a[0] - c[0]);
    let x = -width / 2;
    for (const [a, c] of [...gaps, [width / 2, width / 2]]) { if (a > x + .02) b.box(group, b.m.recess, [(x + a) / 2, y, .006], [a - x, .018, .025], 0); x = Math.max(x, c); }
  }
  return group;
}
function stoneRail(b, parent, name, points, floorY, spacing = .56) {
  const group = namedGroup(parent, name, { body: 'square-pear-balustrade', evidence: 'Durand-pear-section-fragment-with-authored-spacing' });
  const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p))), length = curve.getLength(), count = Math.max(2, Math.round(length / spacing));
  const top = points.map(p => [p[0], p[1] + 1.16, p[2]]), sill = points.map(p => [p[0], p[1] + .07, p[2]]);
  b.sweep(group, top, .30, .22, b.m.carving, Math.max(4, count * 2), V(0, 1, 0)); b.sweep(group, sill, .30, .15, b.m.stone, Math.max(4, count * 2), V(0, 1, 0));
  for (let i = 0; i <= count; i++) {
    const t = i / count, p = curve.getPointAt(t), tangent = curve.getTangentAt(t), base = typeof floorY === 'function' ? floorY(t) : p.y;
    b.baluster(group, [p.x, base + .13, p.z], Math.max(.55, p.y + .94 - base), .13, Math.atan2(tangent.x, tangent.z));
  }
  return group;
}
function sideStair(b, parent, side) {
  const label = side < 0 ? 'west' : 'east', id = `fangwaiguan-${label}-curved-stair`, group = namedGroup(parent, id, { body: 'solid-curved-stair-with-walkable-treads', walkable: true, evidence: INFERRED, steps: 28, rise: UPPER_FLOOR / 28, clearWidth: 1.38 });
  const walk = namedGroup(group, `${id}-treads`, { body: 'solid-stone-treads', walkable: true });
  const width = 1.96, steps = 28;
  for (let i = 0; i < steps; i++) b.add(walk, curvedStairTread(side, i / steps, (i + 1) / steps, width, -.045, (i + 1) / steps * UPPER_FLOOR), b.m.stone, undefined, undefined, undefined, true);
  const samples = [];
  for (let i = 0; i < steps; i++) { const p = stairPoint(side, (i + .5) / steps).point; samples.push([p.x, (i + 1) / steps * UPPER_FLOOR, p.z]); }
  b.walkPaths.push({ id, treadGroup: walk.name, points: samples, startDatum: 0, endDatum: UPPER_FLOOR, upperConnection: 'fangwaiguan-upper-floor-and-balcony', evidence: 'authored-navigation-geometry-not-surveyed-riser-count' });
  b.contacts.push({ id, ground: 'fangwaiguan-court-paving', point: samples[0], underside: -.045, firstTread: UPPER_FLOOR / steps });
  for (const edge of [-1, 1]) {
    const points = Array.from({ length: 41 }, (_, i) => { const p = stairPoint(side, i / 40, edge * (width / 2 - .14)).point; return [p.x, UPPER_FLOOR * i / 40 + .25, p.z]; });
    b.add(group, stairCurbGeometry(side, edge * (width / 2 - .14), .28, UPPER_FLOOR), b.m.stone, undefined, undefined, undefined, true);
    stoneRail(b, group, `${id}-${edge < 0 ? 'inner' : 'outer'}-balustrade`, points, undefined, .48);
    const plinth = Array.from({ length: 41 }, (_, i) => { const p = stairPoint(side, i / 40, edge * width / 2).point; return [p.x, UPPER_FLOOR * i / 40 - .10, p.z]; });
    b.sweep(group, plinth, .22, .30, b.m.carving, 56, V(0, 1, 0));
  }
  // Stone panels are embedded in the solid outer retaining cheek.
  for (const t of [.27, .49, .70]) {
    const { point: p, outward } = stairPoint(side, t, width / 2 + .025), y = UPPER_FLOOR * t;
    const panel = namedGroup(group, `${id}-cheek-panel-${t}`, { body: 'carved-retaining-wall-panel', evidence: 'engraving-motif-proportions-inferred' }); panel.position.set(p.x, y * .40, p.z); panel.rotation.y = Math.atan2(outward.x, outward.z);
    b.box(panel, b.m.recess, [0, 0, 0], [.70, Math.max(.5, y * .48), .08], .055);
    b.sweep(panel, [[-.32, -.23, .07], [-.32, .23, .07], [0, .33, .07], [.32, .23, .07], [.32, -.23, .07]], .07, .07);
    b.leaf(panel, [0, -.13, .07], [.50, .63, .6]);
  }
  return group;
}
function hippedRoof(b, parent, name, options, blue = false) {
  const group = namedGroup(parent, name, { body: 'closed-four-sided-hipped-roof', evidence: 'double-eave-hipped-type-supported-profile-and-back-inferred' });
  b.add(group, hipRoofGeometry(options), blue ? b.m.blueTile : b.m.tile, undefined, undefined, undefined, true);
  const { width, depth, topWidth, topDepth, eaveY, topY } = options;
  const barrels = namedGroup(group, `${name}-barrel-tiles`, { body: 'individual-overlapping-glazed-barrel-tiles', evidence: INFERRED });
  const pans = namedGroup(group, `${name}-pan-tiles`, { body: 'individual-overlapping-concave-pan-tiles', evidence: INFERRED });
  const glaze = blue ? b.m.blueTile : b.m.tile, variedGlaze = blue ? b.m.variedBlueTile : b.m.variedTile;
  for (let side = 0; side < 4; side++) {
    const span = side % 2 ? depth : width, fall = Math.hypot((side % 2 ? width - topWidth : depth - topDepth) / 2, topY - eaveY);
    const count = Math.round(span / .215), courses = Math.max(3, Math.round(fall / .40));
    for (let row = 0; row < courses; row++) {
      const course = { side, t0: row / courses, t1: Math.min(1, (row + 1.15) / courses), overlap: row > 0 };
      for (let i = 0; i < count; i++) {
        const material = (i * 17 + row * 29 + side * 3) % 11 < 3 ? variedGlaze : glaze;
        b.add(pans, hipRoofTileGeometry(options, { ...course, u0: (i + .15) / count, u1: (i + .85) / count }), material, undefined, undefined, undefined, true);
        if (i > 0) b.add(barrels, hipRoofTileGeometry(options, { ...course, u0: (i - .25) / count, u1: (i + .25) / count, barrel: true }), material, undefined, undefined, undefined, true);
      }
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const points = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [sx * THREE.MathUtils.lerp(width, topWidth, t) / 2, THREE.MathUtils.lerp(eaveY, topY, t) - .12 * Math.sin(t * Math.PI) + .06, sz * THREE.MathUtils.lerp(depth, topDepth, t) / 2]; });
    b.sweep(group, points, .15, .13, b.m.tileEdge, 15, V(0, 1, 0));
  }
  return group;
}
function hall(b, root) {
  const group = namedGroup(root, 'fangwaiguan-complete-hall', { body: 'three-bay-two-storey-complete-building', facing: 'south', measuredDimensions: { width: 14, depth: 7, height: 13, excludes: 'lateral-stairs' }, evidence: MEASURED });
  const foundation = namedGroup(group, 'fangwaiguan-reported-footprint', { body: '14-by-7-metre-wall-line-control', evidence: MEASURED });
  b.box(foundation, b.m.stone, [0, .16, 0], [14, .32, 7], 0);
  const floor = namedGroup(group, 'fangwaiguan-ground-floor', { body: 'solid-floor', walkable: true }); b.box(floor, b.m.paving, [0, .355, 0], [13.96, .11, 6.96], 0);
  const frontOpenings = [
    { x: -3.98, bottom: 1.31, width: 1.69, height: 2.21, kind: 'oval' }, { x: 0, bottom: .41, width: 1.84, height: 3.56, door: true }, { x: 3.98, bottom: 1.31, width: 1.69, height: 2.21, kind: 'oval' },
    { x: -3.98, bottom: 6.02, width: 2.02, height: 3.10 }, { x: 0, bottom: UPPER_FLOOR, width: 2.02, height: 4.27, door: true }, { x: 3.98, bottom: 6.02, width: 2.02, height: 3.10 },
  ].map(o => ({ ...o, evidence: 'front-opening-types-visible-in-engraving-dimensions-inferred' }));
  elevation(b, group, 'fangwaiguan-south-front-elevation', 14, [0, 0, 3.5], 0, frontOpenings, true);
  const backOpenings = [
    { x: -4.10, bottom: 1.32, width: 1.64, height: 2.14, kind: 'oval' }, { x: 0, bottom: .41, width: 1.84, height: 3.56, door: true }, { x: 4.10, bottom: 1.32, width: 1.64, height: 2.14, kind: 'oval' },
    ...[-4.10, 0, 4.10].map(x => ({ x, bottom: 6.12, width: 1.85, height: 2.96 })),
  ];
  elevation(b, group, 'fangwaiguan-north-back-elevation-inferred', 14, [0, 0, -3.5], Math.PI, backOpenings);
  for (const side of [-1, 1]) elevation(b, group, `fangwaiguan-${side < 0 ? 'west' : 'east'}-side-elevation-inferred`, 7, [side * 7, 0, 0], side * Math.PI / 2, [
    { x: 0, bottom: 1.40, width: 1.55, height: 2.14, kind: 'oval' }, { x: 0, bottom: 6.02, width: 1.9, height: 3.10 },
  ]);
  const columns = namedGroup(group, 'fangwaiguan-rusticated-square-pilasters', { body: 'distinctive-square-stone-columns' });
  for (const z of [-3.51, 3.51]) for (const x of [-6.52, -1.65, 1.65, 6.52]) {
    const name = `${z > 0 ? 'south' : 'north'}-${x}`; column(b, columns, x, z, .40, 4.17, `fangwaiguan-${name}-lower-column`, true);
    column(b, columns, x, z, 5.17, 4.92, `fangwaiguan-${name}-upper-column`);
  }
  const floors = namedGroup(group, 'fangwaiguan-upper-floor-and-balcony', { body: 'continuous-upper-floor-and-stair-landing', walkable: true, top: UPPER_FLOOR });
  b.box(floors, b.m.stone, [0, UPPER_FLOOR - .14, .50], [16.26, .28, 8.90], .016);
  const band = namedGroup(group, 'fangwaiguan-storey-stringcourse', { body: 'projecting-stone-storey-band' }); cornice(b, band, 14.12, 7.06, 4.63, false);
  const balcony = namedGroup(group, 'fangwaiguan-south-balcony', { body: 'upper-balcony-opening-to-curved-stairs', walkable: true });
  stoneRail(b, balcony, 'fangwaiguan-balcony-front-balustrade', [[-7.98, UPPER_FLOOR, 4.86], [0, UPPER_FLOOR, 4.86], [7.98, UPPER_FLOOR, 4.86]], UPPER_FLOOR, .54);
  // Both stair heads meet the open west/east ends of the landing.
  for (const side of [-1, 1]) sideStair(b, group, side);
  const mainSteps = namedGroup(group, 'fangwaiguan-central-entrance-steps', { body: 'solid-central-three-step-entrance', walkable: true, evidence: 'central-stair-shape-geometrized-from-engraving' });
  for (let i = 0; i < 3; i++) {
    const radius = 1.25 + (3 - i) * .23, points = [[-radius, 3.39], [radius, 3.39]];
    for (let j = 0; j <= 24; j++) { const a = j / 24 * Math.PI; points.push([Math.cos(a) * radius, 3.39 + .94 * Math.sin(a) + (3 - i) * .19]); }
    b.polygon(mainSteps, points, -.03, (i + 1) * .137, b.m.stone);
  }
  const eaves = namedGroup(group, 'fangwaiguan-carved-eaves', { body: 'modillion-and-cornice-frieze' }); cornice(b, eaves, 14.03, 7.04, 10.21);
  for (const side of [-1, 1]) for (let z = -3.0; z <= 3; z += .54) b.box(eaves, b.m.carving, [side * 7.04, 9.91, z], [.23, .26, .16], .018);
  const roof = namedGroup(group, 'fangwaiguan-double-eave-blue-green-hipped-roof', { body: 'complete-double-eave-roof', evidence: 'roof-type-and-blue-green-colours-described-by-Sun-Chenlu-specific-layout-inferred' });
  hippedRoof(b, roof, 'fangwaiguan-lower-hipped-roof', { width: 14.78, depth: 7.87, topWidth: 11.35, topDepth: 4.15, eaveY: 10.53, topY: 11.48 });
  b.box(roof, b.m.timber, [0, 11.51, 0], [11.47, .16, 4.27], .02);
  hippedRoof(b, roof, 'fangwaiguan-upper-hipped-roof', { width: 11.86, depth: 4.65, topWidth: 8.10, topDepth: .10, eaveY: 11.63, topY: 12.76 }, true);
  b.box(roof, b.m.tileEdge, [0, 12.82, 0], [8.34, .16, .22], .05);
  for (const side of [-1, 1]) {
    const p = namedGroup(roof, `fangwaiguan-${side < 0 ? 'west' : 'east'}-ridge-scroll`, { body: 'small-glazed-ridge-scroll', evidence: INFERRED });
    b.sweep(p, [[side * 3.89, 12.80, 0], [side * 4.08, 12.99, 0], [side * 4.26, 12.96, 0], [side * 4.34, 12.81, 0], [side * 4.21, 12.75, 0]], .11, .13, b.m.tileEdge, 20);
  }
  b.flush(); return group;
}
function octagon(radius, x = 0, z = 0) { return Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * TAU / 8; return [x + radius * Math.cos(a), z + radius * Math.sin(a)]; }); }
function circle(radius, x = 0, z = 0, segments = 64) { return Array.from({ length: segments }, (_, i) => [x + radius * Math.cos(i / segments * TAU), z + radius * Math.sin(i / segments * TAU)]); }
function bambooPanel(b, parent, a, c, bottom, top, door = false) {
  const mid = V(...a).lerp(V(...c), .5), vector = V(...c).sub(V(...a)), width = vector.length(), group = namedGroup(parent, `${parent.name}-panel-${a[0].toFixed(2)}-${a[2].toFixed(2)}`, { body: 'open-bamboo-lattice-panel' });
  group.position.copy(mid); group.rotation.y = -Math.atan2(vector.z, vector.x);
  const half = width / 2;
  b.bamboo(group, [-half, top, 0], [half, top, 0], .072, true);
  if (!door) {
    b.bamboo(group, [-half, bottom + .27, 0], [half, bottom + .27, 0], .056);
    b.bamboo(group, [-half, bottom + 1.03, 0], [half, bottom + 1.03, 0], .055, true);
    for (let x = -half + .15; x < half; x += .29) b.bamboo(group, [x, bottom + .27, 0], [x, bottom + 1.03, 0], .023);
    for (let x = -half + .40; x < half - .1; x += .66) {
      const y = bottom + 1.64;
      for (let j = 0; j < 8; j++) { const a = j / 8 * TAU, c = (j + 1) / 8 * TAU; b.bamboo(group, [x + Math.cos(a) * .24, y + Math.sin(a) * .36, .015], [x + Math.cos(c) * .24, y + Math.sin(c) * .36, .015], .022, true); }
    }
  }
  // Open transom lattice leaves the full-height cardinal portals unblocked.
  const railY = Math.max(bottom + 2.32, top - .67);
  b.bamboo(group, [-half, railY, 0], [half, railY, 0], .048, true);
  for (let x = -half + .17; x < half; x += .35) {
    b.bamboo(group, [x - .10, railY, 0], [Math.min(half, x + .15), top, 0], .020);
    b.bamboo(group, [x + .10, railY, 0], [Math.max(-half, x - .15), top, 0], .020);
  }
}
function pavilion(b, parent, spec) {
  const { id, x, z, radius, columnHeight, portalDirections = [] } = spec;
  const group = namedGroup(parent, `wuzhuting-${id}-pavilion`, { role: 'one-of-five-linked-bamboo-pavilions', body: 'complete-octagonal-bamboo-pavilion', evidence: 'five-linked-pavilions-visible-individual-plan-and-dimensions-inferred', dimensionsInferred: { radius, columnHeight }, facing: 'north' });
  group.position.set(x, 0, z);
  const base = namedGroup(group, `${group.name}-floor`, { body: 'octagonal-stone-plinth-and-timber-floor', walkable: true });
  b.polygon(base, octagon(radius + .16), -.025, .25, b.m.stone); b.polygon(base, octagon(radius + .06), .25, .42, b.m.paving);
  const frame = namedGroup(group, `${group.name}-bamboo-frame`, { body: 'bamboo-posts-ties-and-lattice' });
  const ring = octagon(radius - .12), top = .42 + columnHeight;
  const acrossPortal = (d, px, pz) => -d.z * px + d.x * pz;
  const inPortal = (px, pz, padding = 0) => portalDirections.some(d => d.x * px + d.z * pz > 0 && Math.abs(acrossPortal(d, px, pz)) < .75 + padding);
  for (let i = 0; i < 8; i++) {
    const [px, pz] = ring[i], [qx, qz] = ring[(i + 1) % 8], a = [px, 0, pz], c = [qx, 0, qz];
    const tangent = V(qx - px, 0, qz - pz).normalize();
    if (!inPortal(px, pz, .11)) b.bamboo(frame, [px, .42, pz], [px, top + .12, pz], .090);
    // Paired narrow posts and tied nodes give a bamboo-built reading.
    const pairX = px + tangent.x * .17, pairZ = pz + tangent.z * .17;
    if (!inPortal(pairX, pairZ, .065)) b.bamboo(frame, [pairX, .42, pairZ], [pairX, top + .08, pairZ], .050, true);
    b.bamboo(frame, [px, top - .27, pz], [qx, top - .27, qz], .086);
    b.bamboo(frame, [px, top + .03, pz], [qx, top + .03, qz], .092, true);
    if (!inPortal(px, pz, .11)) for (const t of [.21, .75]) b.bamboo(frame, [px, top - .76, pz], [px + (qx - px) * t, top - .27, pz + (qz - pz) * t], .04);
    const crossedByGallery = portalDirections.some(d => {
      const first = acrossPortal(d, px, pz), last = acrossPortal(d, qx, qz);
      return d.x * (px + qx) + d.z * (pz + qz) > 0 && Math.min(first, last) < .86 && Math.max(first, last) > -.86;
    });
    bambooPanel(b, frame, a, c, .42, top - .31, i % 2 === 1 || crossedByGallery);
  }
  // A diagonal gallery can enter across an octagon corner. Keep its full width
  // clear and carry the continuous ring beams on jambs at the actual portal edges.
  for (const d of portalDirections) for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    const a = ring[i], c = ring[(i + 1) % 8], first = acrossPortal(d, ...a), last = acrossPortal(d, ...c);
    if (Math.abs(last - first) < .0001) continue;
    const t = (side * .75 - first) / (last - first);
    if (t < 0 || t > 1) continue;
    const px = THREE.MathUtils.lerp(a[0], c[0], t), pz = THREE.MathUtils.lerp(a[1], c[1], t);
    if (d.x * px + d.z * pz <= 0) continue;
    b.bamboo(frame, [px, .42, pz], [px, top + .12, pz], .078, true); break;
  }
  const roof = namedGroup(group, `${group.name}-double-eave-roof`, { body: 'complete-eight-sided-double-eave-pavilion-roof', evidence: 'pointed-double-eave-type-supported-profile-inferred' });
  const lowerTop = top + .99, upperEave = lowerTop + .18, upperTop = upperEave + radius * .46;
  const rafters = namedGroup(roof, `${group.name}-roof-rafters`, { body: 'bamboo-rafters-bearing-on-ring-beams', evidence: INFERRED });
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * TAU / 8, r = radius * .61 - .035;
    b.bamboo(rafters, [ring[i][0], top + .04, ring[i][1]], [Math.cos(a) * r, lowerTop - .105, Math.sin(a) * r], .07, true);
  }
  b.add(roof, pavilionRoofGeometry(radius + .48, radius * .61, top + .22, lowerTop), b.m.tile, undefined, undefined, undefined, true);
  const drum = namedGroup(roof, `${group.name}-roof-transition-drum`, { body: 'continuous-octagonal-double-eave-bearing', evidence: INFERRED });
  b.polygon(drum, octagon(radius * .61 + .045), lowerTop - .145, lowerTop + .215, b.m.bambooLight, [octagon(radius * .61 - .10)]);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * TAU / 8, c = a + TAU / 8, r = radius * .57;
    b.bamboo(roof, [Math.cos(a) * r, lowerTop - .05, Math.sin(a) * r], [Math.cos(c) * r, lowerTop - .05, Math.sin(c) * r], .045, true);
  }
  b.add(roof, pavilionRoofGeometry(radius * .72, .045, upperEave, upperTop), b.m.blueTile, undefined, undefined, undefined, true);
  for (let side = 0; side < 8; side++) {
    const a = Math.PI / 8 + side * TAU / 8;
    for (const [outer, inner, fromY, toY] of [[radius + .48, radius * .61, top + .30, lowerTop + .05], [radius * .72, .06, upperEave + .08, upperTop + .04]]) {
      const points = Array.from({ length: 9 }, (_, i) => { const t = i / 8, r = THREE.MathUtils.lerp(outer, inner, t); return [Math.cos(a) * r, THREE.MathUtils.lerp(fromY, toY, t) - .14 * Math.sin(t * Math.PI), Math.sin(a) * r]; });
      b.sweep(roof, points, .12, .12, b.m.tileEdge, 14, V(0, 1, 0));
    }
    // Narrow raised tile rolls; roof sheets remain continuous underneath.
    for (let strip = 1; strip < 7; strip++) {
      const u = strip / 7, c = a + TAU / 8, px = THREE.MathUtils.lerp(Math.cos(a), Math.cos(c), u), pz = THREE.MathUtils.lerp(Math.sin(a), Math.sin(c), u);
      const points = Array.from({ length: 7 }, (_, i) => { const t = i / 6, r = THREE.MathUtils.lerp(radius + .48, radius * .61, t); return [px * r, THREE.MathUtils.lerp(top + .24, lowerTop + .02, t) - .14 * Math.sin(t * Math.PI) + .08 * (2 * u - 1) ** 4 * (1 - t), pz * r]; });
      b.sweep(roof, points, .030, .035, b.m.tileEdge, 9, V(0, 1, 0));
    }
  }
  const finial = namedGroup(roof, `${group.name}-finial`, { body: 'small-provisional-copper-roof-finial' });
  b.lathe(finial, [[.10, 0], [.17, .07], [.13, .17], [.08, .22], [.10, .28], [.035, .46]], [0, upperTop - .01, 0], b.m.copper);
  b.add(finial, b.prototype('pavilion-finial-bead', () => new THREE.SphereGeometry(.045, 16, 10)), b.m.copper, [0, upperTop + .45, 0]);
  // North and south entry treads touch the shared court and pavilion floor.
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) b.box(base, b.m.stone, [0, (i + 1) * .105, side * (radius * .924 + .47 - i * .16)], [1.55, (i + 1) * .21, .45 + i * .30], .015);
  return group;
}
function gallery(b, parent, first, last, index) {
  const start = V(first.x, 0, first.z), end = V(last.x, 0, last.z), direction = end.clone().sub(start).normalize();
  start.addScaledVector(direction, first.radius * .79); end.addScaledVector(direction, -last.radius * .79);
  const length = start.distanceTo(end), mid = start.clone().lerp(end, .5);
  const group = namedGroup(parent, `wuzhuting-connecting-gallery-${index}`, { body: 'roofed-bamboo-connecting-gallery', connects: [`wuzhuting-${first.id}-pavilion`, `wuzhuting-${last.id}-pavilion`], evidence: 'linked-topology-supported-length-and-junction-inferred', walkable: true });
  group.position.copy(mid); group.rotation.y = -Math.atan2(direction.z, direction.x);
  const floor = namedGroup(group, `${group.name}-walkway`, { body: 'unbroken-gallery-walkway', walkable: true });
  b.box(floor, b.m.stone, [0, .12, 0], [length + .58, .24, 1.86], .025); b.box(floor, b.m.paving, [0, .33, 0], [length + .58, .18, 1.72], .018);
  const frame = namedGroup(group, `${group.name}-bamboo-frame`, { body: 'open-sided-bamboo-gallery' });
  const divisions = Math.max(2, Math.round(length / 1.02));
  for (const side of [-1, 1]) {
    for (let i = 0; i <= divisions; i++) {
      const x = -length / 2 + length * i / divisions;
      b.bamboo(frame, [x, .42, side * .73], [x, 3.44, side * .73], .065);
      if (i < divisions) bambooPanel(b, frame, [x, 0, side * .73], [x + length / divisions, 0, side * .73], .42, 3.34);
    }
    b.bamboo(frame, [-length / 2 - .2, 3.45, side * .74], [length / 2 + .2, 3.45, side * .74], .09, true);
  }
  const roof = namedGroup(group, `${group.name}-roof`, { body: 'closed-gallery-roof' });
  b.add(roof, hipRoofGeometry({ width: length + .8, depth: 2.18, topWidth: length + .5, topDepth: .07, eaveY: 3.52, topY: 4.12, thickness: .12, curve: .07 }), b.m.tile, undefined, undefined, undefined, true);
  b.box(roof, b.m.tileEdge, [0, 4.15, 0], [length + .53, .12, .17], .04);
  return group;
}
function linkedPavilions(b, root) {
  const group = namedGroup(root, 'wuzhuting-five-linked-pavilions', { body: 'five-bamboo-pavilions-and-four-roofed-galleries', relativePosition: 'south-of-fangwaiguan', evidence: 'topology-and-five-count-supported-footprints-and-spacing-inferred', historicalLayer: 'post-relocation-provisional-1859–1860' });
  const specs = [
    { id: 'west-outer', x: -12.25, z: 28.25, radius: 2.66, columnHeight: 4.43 },
    { id: 'west-inner', x: -6.1, z: 31.1, radius: 1.91, columnHeight: 3.35 },
    { id: 'central', x: 0, z: 33.0, radius: 2.24, columnHeight: 3.85 },
    { id: 'east-inner', x: 6.1, z: 31.1, radius: 1.91, columnHeight: 3.35 },
    { id: 'east-outer', x: 12.25, z: 28.25, radius: 2.66, columnHeight: 4.43 },
  ];
  for (const [i, spec] of specs.entries()) pavilion(b, group, { ...spec, portalDirections: [specs[i - 1], specs[i + 1]].filter(Boolean).map(neighbour => V(neighbour.x - spec.x, 0, neighbour.z - spec.z).normalize()) });
  const links = namedGroup(group, 'wuzhuting-four-linked-galleries', { body: 'four-continuous-covered-links' });
  for (let i = 0; i < specs.length - 1; i++) gallery(b, links, specs[i], specs[i + 1], i + 1);
  b.flush(); return group;
}
function court(b, root) {
  const group = namedGroup(root, 'fangwaiguan-wuzhuting-water-court', { body: 'bridge-water-and-pavilion-garden', evidence: 'engraving-constrained-topology-with-authored-local-plan' });
  const channelOutline = [[-17, 14.5], [17, 14.5], [17, 19.2], [-17, 19.2]], basinOutline = circle(2.28, 0, 25.0);
  const ground = namedGroup(group, 'fangwaiguan-court-paving', { body: 'solid-paving-with-real-water-cutouts', top: 0 });
  b.polygon(ground, [[-18.8, -6.2], [18.8, -6.2], [18.8, 37.6], [-18.8, 37.6]], -1.25, 0, b.m.paving, [channelOutline, basinOutline]);
  // Deliberately quiet paths leave room for the architecture and its relief.
  const paths = namedGroup(group, 'fangwaiguan-court-inlay', { body: 'low-contrast-paving-borders', evidence: INFERRED });
  for (const x of [-2.23, 2.23]) for (const [a, c] of [[5.0, 13.9], [20.0, 23.0], [27.1, 30.4]]) b.box(paths, b.m.stone, [x, .012, (a + c) / 2], [.12, .025, c - a], 0);
  const channel = namedGroup(group, 'fangwaiguan-water-channel', { body: 'sunken-channel-with-floor-and-banks', waterLevel: -.22, bottom: -.93, evidence: 'waterway-relationship-supported-dimensions-inferred' });
  b.box(channel, b.m.recess, [0, -1.015, 16.85], [34, .17, 4.70], 0);
  for (const z of [14.5, 19.2]) {
    b.box(channel, b.m.recess, [0, -.36, z], [34.15, 1.18, .36], .025);
    b.box(channel, b.m.stone, [0, .24, z], [34.24, .13, .49], .036);
  }
  for (const x of [-17, 17]) b.box(channel, b.m.recess, [x, -.36, 16.85], [.35, 1.18, 4.8], .025);
  b.polygon(channel, [[-16.82, 14.69], [16.82, 14.69], [16.82, 19.01], [-16.82, 19.01]], -.225, -.22, b.m.water);
  const bridge = namedGroup(group, 'fangwaiguan-central-stone-bridge', { body: 'supported-walkable-bridge', walkable: true, evidence: 'engraving-bridge-topology-profile-inferred' });
  b.box(bridge, b.m.stone, [0, .28, 16.85], [4.36, .28, 5.13], .025);
  for (const side of [-1, 1]) {
    const bankZ = side < 0 ? 14.29 : 19.41;
    b.box(bridge, b.m.recess, [0, -.16, bankZ], [4.40, .80, .55], .025);
    for (let i = 0; i < 3; i++) b.box(bridge, b.m.stone, [0, (i + 1) * .07, bankZ + side * (1.02 - i * .34)], [4.36, (i + 1) * .14, .39], .012);
  }
  for (const side of [-1, 1]) stoneRail(b, bridge, `fangwaiguan-bridge-${side < 0 ? 'west' : 'east'}-carved-rail`, [[side * 2.02, .42, 14.30], [side * 2.02, .42, 16.85], [side * 2.02, .42, 19.40]], .42, .50);
  const pool = namedGroup(group, 'wuzhuting-front-fountain-basin', { body: 'circular-basin-with-solid-bottom-and-wall', waterLevel: -.13, bottom: -.72, evidence: 'circular-water-feature-visible-dimensions-and-fountain-detail-inferred' });
  b.polygon(pool, circle(2.28, 0, 25), -.86, -.72, b.m.recess);
  b.polygon(pool, circle(2.28, 0, 25), -.72, .26, b.m.stone, [circle(1.97, 0, 25).reverse()]);
  b.polygon(pool, circle(1.96, 0, 25), -.135, -.13, b.m.water);
  const fountain = namedGroup(pool, 'wuzhuting-provisional-small-fountain', { body: 'small-stone-fountain-interpretation', evidence: INFERRED });
  b.lathe(fountain, [[.32, -.71], [.32, -.16], [.45, -.12], [.42, .12], [.23, .21], [.19, .69], [.28, .78], [.34, .85], [.24, 1.00], [.06, 1.10]], [0, 0, 25]);
  for (const side of [-1, 1]) {
    const bed = namedGroup(group, `wuzhuting-${side < 0 ? 'west' : 'east'}-low-parterre`, { body: 'low-planting-with-carved-edge', evidence: 'paired-parterre-topology-visible-pattern-inferred' });
    const outline = circle(1, side * 7.55, 24.0).map(([x, z]) => [side * 7.55 + (x - side * 7.55) * 3.7, 24 + (z - 24) * 1.78]);
    const inside = outline.map(([x, z]) => [side * 7.55 + (x - side * 7.55) * .95, 24 + (z - 24) * .89]);
    b.polygon(bed, outline, 0, .22, b.m.carving, [inside]); b.polygon(bed, inside, .01, .07, b.m.soil);
    for (let i = 0; i < 36; i++) {
      const a = i * 2.39996, r = Math.sqrt((i + .5) / 36), x = side * 7.55 + Math.cos(a) * r * 3.30, z = 24 + Math.sin(a) * r * 1.44;
      for (let petal = 0; petal < 4; petal++) b.leaf(bed, [x, .08, z], [.26, .47 + .08 * (i % 3), .30], [-.62, petal * Math.PI / 2 + a, .4], b.m.foliage);
    }
  }
  b.flush(); return group;
}
function diagnostics(group, b) {
  group.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(group), subassemblies = []; let triangleCount = 0, meshCount = 0;
  group.traverse(object => {
    if (object.isMesh) { triangleCount += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; meshCount++; }
    if (!object.isGroup || object === group) return;
    let meshes = 0, triangles = 0; object.traverse(child => { if (child.isMesh) { meshes++; triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3; } });
    if (meshes) { const box = new THREE.Box3().setFromObject(object); subassemblies.push({ name: object.name, body: object.userData.body ?? null, meshCount: meshes, triangleCount: triangles, bounds: { min: box.min.toArray(), max: box.max.toArray() } }); }
  });
  const supported = ['South-facing three-bay two-storey Fangwaiguan; Durand reports 14×7×13 metres excluding lateral stairs', 'Square rusticated pilasters, oval lower windows, tall upper bays, curved lateral stairs and stone balustrades', 'Double-eave hipped roof; blue-green tiles described in attributed research', 'Five linked bamboo-style pavilions south of Fangwaiguan, with four connecting galleries and a bridge-water garden'];
  const inferred = ['Back and side fenestration, room arrangement, wall thickness and all local court coordinates are authored interpretations', 'Stair radius, rise count, width, balcony dimensions, window dimensions and ornament profiles are not reported measurements', 'Pavilion footprints, heights, spacing, exact bamboo construction, joints and material ageing remain inferred', 'Roof back profiles, tile placement, colour values and small ridge finials are provisional', 'Court, channel and pool dimensions, flowerbed motifs and small fountain form are illustrative', 'The 1859–1860 study combines earlier engraving evidence with modern survey restitution; unchanged survival of every detail is not established'];
  return {
    assetId: 'fangwaiguan-wuzhuting', version: 1, units: 'metres', coordinates: { up: '+Y', south: '+Z', east: '+X', principalView: 'Fangwaiguan-from-south; Wuzhuting-from-north' }, timeLayer: '1859–1860-before-destruction',
    visualAcceptance: false, integrationAcceptance: false, supported, inferred, supportedFeatures: supported, inferredFeatures: inferred, sourceViews: SOURCES.map(x => ({ ...x })),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(V(0, 0, 0)).toArray() }, triangleCount, triangles: triangleCount, meshCount, subassemblies,
    measurements: { building: { width: 14, depth: 7, height: 13, excludesLateralStairs: true, evidence: MEASURED, representation: '14×7 footprint control; 13m roof envelope interpreted from reported height' } },
    materials: [...b.materials].map(m => ({ name: m.name, category: m.userData.category, type: m.type, colour: `#${m.color.getHexString()}`, roughness: m.roughness, roughnessMap: m.roughnessMap?.name ?? null, copperEffectiveRoughnessApprox: m.userData.category === 'copper' ? .70 * 220 / 255 : null })),
    openingChecks: b.openings.map(o => ({ ...o })), contacts: b.contacts.map(c => ({ ...c })), walkPaths: b.walkPaths.map(p => ({ ...p })),
    provisionalScale: { isProvisional: true, reason: 'One reported metric envelope, not a fully surveyed registration of the linked garden.' },
    resourceOwnership: { scope: 'one-factory-invocation', geometries: b.geometries.size, materials: b.materials.size, textures: b.textures.size, temporaryGeometryDisposals: b.temporaryDisposals, moduleGlobalCache: false, disposalIsIdempotent: true },
    sourceLimitations: ['Durand p130 depicts Fangwaiguan directly; the surviving stone door pediment is used as a motif reference, not traced texture.', 'The public Durand page is 710px wide; no centimetre-level reading or archaeological accuracy percentage is claimed.', 'MIT copper-stair wording conflicts with stone-stair accounts; this study follows the stone remains and Durand survey interpretation.', 'Bamboo pavilion relocation is attributed to later research; no original relocation file has been inspected.', 'No religious interior, historical resident or original water machine is reconstructed.'],
  };
}
export function createFangwaiguanStudy({texturePixels}={}) {
  const b = new Builder(), group = new THREE.Group(); group.name = 'fangwaiguan-wuzhuting-study';
  group.userData = { assetId: 'fangwaiguan-wuzhuting', body: 'independent-source-constrained-study', historicalLayer: '1859–1860-before-destruction', visualAcceptance: false, publicSourceImagesEmbedded: false };
  try {
    if(texturePixels)configureFangwaiguanMaterials(b,texturePixels);
    court(b, group); hall(b, group); linkedPavilions(b, group); b.releasePrototypes();
    return { group, diagnostics: {...diagnostics(group, b),...(b.materialStudy?{materialStudy:b.materialStudy}:{})}, dispose() { if (b.disposed) return; b.dispose(); group.clear(); } };
  } catch (error) { b.dispose(); group.clear(); throw error; }
}
