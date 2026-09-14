import * as THREE from 'three';
import { HanjingBuilder } from './hanjingtang-architecture.js';
import { V, namedGroup } from './study-geometry.js';
import { roofTileRollGeometry, quarriedMasonryBlockGeometry, clipPavingCell, chineseHipRoofGeometry, chineseHipPoint, chineseGableRoofGeometry, chineseGablePoint, gableInfillGeometry, ridgeBeastGeometry } from './chinese-architecture-geometry.js';
import { jiuzhouJoinedRoofSection, singleJuanpengSection, multipleJuanpengSection, cropJuanpengSection, jiuzhouRoofSectionPoint, juanpengSegmentPoint, joinedJuanpengStripGeometry, roofSurfacePatchGeometry, clayPanGeometry } from './jiuzhou-roof-geometry.js';
import { createJiuzhouHexiTexture, createJiuzhouBoguTexture, createJiuzhouBambooTexture, createJiuzhouWoodTexture } from './jiuzhou-paintwork.js';

// Reuse only the established resource-owning construction utility. Jiuzhou's
// dated plan, joined roofs, frame, doors and ornament are assembled here.
export class JiuzhouBuilder extends HanjingBuilder {
  // Preserve the source indices and every authored triangle. The older
  // builder expands indexed tiles into separate vertices before merging;
  // this study keeps their existing shared arc vertices and hard clay ends.
  add(parent, source, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], own = false) {
    if (scale.some(v => v <= 0)) throw new Error('Jiuzhou architecture requires positive scales.');
    const geometry = source.clone();
    if (!geometry.index) geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: geometry.attributes.position.count }, (_, i) => i), 1));
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    geometry.applyMatrix4(new THREE.Matrix4().compose(V(...position), quaternion, V(...scale)));
    let owner = parent; while (owner.userData.mergeIntoParent && owner.parent) owner = owner.parent;
    const key = `${owner.uuid}:${material.id}`; if (!this.pending.has(key)) this.pending.set(key, { parent: owner, material, parts: [] });
    this.pending.get(key).parts.push({ geometry, sourceParent: parent });
    if (own) { source.dispose(); this.temporaryDisposals++; }
  }
  instanceTile(parent, points, material, kind) {
    this.tileShapes ??= new Map(); this.tileInstances ??= new Map();
    // Translate the constant span coordinate (X or Z), preserving the
    // longitudinal curve samples and their hard clay-end planes.
    const xSpan = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), zSpan = Math.max(...points.map(p => p.z)) - Math.min(...points.map(p => p.z));
    const origin = V(xSpan < 1e-9 ? points[0].x : 0, points[0].y, zSpan < 1e-9 ? points[0].z : 0), local = points.map(p => p.clone().sub(origin));
    // Exact JS coordinates form the key: no rounding, quantization or mesh
    // simplification is used to make unlike curves share a tile.
    const shapeKey = JSON.stringify([kind, ...local.map(p => p.toArray())]);
    let geometry = this.tileShapes.get(shapeKey);
    if (!geometry) {
      geometry = kind === 'pan' ? clayPanGeometry(local) : roofTileRollGeometry(local, .081, .023, 24);
      // Translation subtraction can differ in the last Float64 bit while
      // producing identical Float32 mesh buffers. Compare the real buffers,
      // including UVs and hard-end normals, before sharing across roofs.
      this.tileGeometryBuckets ??= new Map();
      const arrays = g => [g.index.array, g.attributes.position.array, g.attributes.normal.array, g.attributes.uv.array];
      const data = arrays(geometry); let hash = 2166136261;
      for (const array of data) { for (const byte of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) hash = Math.imul(hash ^ byte, 16777619) >>> 0; }
      const signature = `${kind}:${data.map(a => `${a.constructor.name}:${a.length}`).join(':')}:${hash}`, bucket = this.tileGeometryBuckets.get(signature) ?? [];
      const same = bucket.find(candidate => arrays(candidate).every((array, i) => {
        const a = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), c = new Uint8Array(data[i].buffer, data[i].byteOffset, data[i].byteLength);
        return a.every((value, j) => value === c[j]);
      }));
      if (same) { geometry.dispose(); this.temporaryDisposals++; geometry = same; }
      else { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); bucket.push(geometry); this.tileGeometryBuckets.set(signature, bucket); }
      this.tileShapes.set(shapeKey, geometry);
    }
    const key = `${parent.uuid}:${material.id}:${geometry.id}`;
    if (!this.tileInstances.has(key)) this.tileInstances.set(key, { parent, material, geometry, positions: [] });
    this.tileInstances.get(key).positions.push(origin.clone());
  }
  flush() {
    for (const { parent, material, geometry, positions } of this.tileInstances?.values() ?? []) {
      // Unique hip-edge profiles still merge by material. Creating one draw
      // call per nonrepeating tile would trade buffer savings for thousands
      // of unnecessary submissions.
      if (positions.length < 3) { for (const position of positions) this.add(parent, geometry, material, position.toArray()); continue; }
      const mesh = new THREE.InstancedMesh(geometry, material, positions.length), matrix = new THREE.Matrix4();
      this.geometries.add(geometry);
      mesh.name = `${parent.name}/${material.name}/tile-profile-${geometry.id}`;
      for (let i = 0; i < positions.length; i++) mesh.setMatrixAt(i, matrix.makeTranslation(...positions[i].toArray()));
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { body: 'full-detail-shared-tile-profile', triangleReduction: false, arcSamples: geometry.userData.curvedSurfaceArcs ?? geometry.userData.columns };
      parent.add(mesh); this.instanceMeshes ??= new Set(); this.instanceMeshes.add(mesh);
    }
    this.tileInstances?.clear();
    super.flush();
  }
  releasePrototypes() {
    super.releasePrototypes();
    for (const geometry of new Set(this.tileShapes?.values() ?? [])) if (!this.geometries.has(geometry)) { geometry.dispose(); this.temporaryDisposals++; }
    this.tileShapes?.clear(); this.tileGeometryBuckets?.clear();
  }
  dispose() {
    if (this.disposed) return;
    super.dispose();
    for (const mesh of this.instanceMeshes ?? []) mesh.dispose();
    this.instanceMeshes?.clear(); this.tileShapes?.clear(); this.tileInstances?.clear();
  }
  makeMaterials() {
    const m = super.makeMaterials(), front = createJiuzhouHexiTexture(), rear = createJiuzhouBoguTexture(), bamboo = createJiuzhouBambooTexture(), wood = createJiuzhouWoodTexture();
    for (const map of [front, rear, bamboo, wood]) this.textures.add(map);
    const make = (name, options) => { const material = new THREE.MeshStandardMaterial(options); material.name = `jiuzhou-${name}`; this.materials.add(material); return material; };
    m.frontPaint = make('dragon-phoenix-hexi', { color: 0xffffff, map: front, roughness: .76, metalness: .045 });
    m.rearPaint = make('green-bogu-paintwork', { color: 0xffffff, map: rear, roughness: .80, metalness: .025 });
    m.windowWood = make('spotted-bamboo-joinery', { color: 0xffffff, map: bamboo, roughness: .74 });
    m.greenWood = make('green-oiled-posts', { color: 0x3f7053, roughness: .72, roughnessMap: m.red.roughnessMap });
    m.brick = make('fine-grey-gable-brick', { color: 0x85887e, roughness: .93, normalMap: m.paving.normalMap, normalScale: new THREE.Vector2(.045, .045) });
    m.earth = make('garden-earth', { color: 0x9b8d6c, roughness: .98, normalMap: m.paving.normalMap, normalScale: new THREE.Vector2(.10, .10) });
    m.greyTile.color.setHex(0x73786f); m.greyTile.roughness = .82; m.greyTile.normalScale.set(.05, .05);
    m.tileShade = m.greyTile.clone(); m.tileShade.name = 'jiuzhou-grey-fired-clay-variation'; m.tileShade.color.setHex(0x666f66); this.materials.add(m.tileShade);
    m.tileLight = m.greyTile.clone(); m.tileLight.name = 'jiuzhou-grey-fired-clay-edge'; m.tileLight.color.setHex(0x838b7e); this.materials.add(m.tileLight);
    // Shared small ridge/coping utilities refer to these keys. Here all are
    // unglazed grey clay, consistent with the documented central halls.
    m.greenTile = m.greyTile; m.darkTile = m.tileShade;
    m.red.color.setHex(0x9d3929); m.plaster.color.setHex(0xd8ceb7); m.paving.color.setHex(0xa3a596);
    m.glass.name = 'jiuzhou-documented-late-xianfeng-glass'; m.paper.color.setHex(0xdbd0b1);
    m.darkWood.map = wood; m.darkWood.color.setHex(0xffffff);
    return m;
  }
  woodBox(parent, position, size, material = this.m.windowWood, rotation = undefined) {
    const geometry = new THREE.BoxGeometry(...size), p = geometry.attributes.position, uv = geometry.attributes.uv;
    const along = size[0] > size[1] && size[0] > size[2] ? 0 : size[2] > size[1] ? 2 : 1;
    for (let i = 0; i < p.count; i++) { const xyz = [p.getX(i), p.getY(i), p.getZ(i)]; uv.setXY(i, xyz[(along + 1) % 3] * 2.5 + .5, xyz[along] / 1.1 + .5); }
    this.add(parent, geometry, material, position, undefined, rotation, true);
  }
}

export function jiuzhouPaintedBeam(b, parent, name, length, center, height = .384, rear = false, rotationY = 0) {
  const group = namedGroup(parent, name, { body: 'moulded-painted-fang', evidence: rear ? 'green-spotted-bamboo-bogu-keywords-supported-composition-inferred' : 'dragon-phoenix-hexi-inferred-from-dated-records-and-Yuanmingyuan-Hall-014-4', mergeIntoParent: true });
  group.position.set(...center); group.rotation.y = rotationY;
  b.box(group, rear ? b.m.greenWood : b.m.red, [0, 0, 0], [length, height, .32]);
  for (const face of [-1, 1]) {
    b.box(group, b.m.blue, [0, 0, face * .166], [length - .05, height * .88, .025]);
    b.add(group, new THREE.PlaneGeometry(length - .08, height * .79), rear ? b.m.rearPaint : b.m.frontPaint, [0, 0, face * .183], undefined, [0, face < 0 ? Math.PI : 0, 0], true);
    for (const dy of [-1, 1]) {
      b.box(group, b.m.gold, [0, dy * height * .443, face * .175], [length - .035, .015, .022]);
      b.box(group, b.m.pale, [0, dy * height * .38, face * .185], [length - .060, .007, .014]);
    }
  }
  return group;
}

export function jiuzhouColumn(b, parent, name, x, z, floor, height, { radius = .192, rear = false, base = [.76, .78, .38] } = {}) {
  const group = namedGroup(parent, name, { body: 'tapered-wood-post-on-square-column-base', mergeIntoParent: true });
  b.box(group, b.m.stone, [x, floor + base[2] * .18, z], [base[0], base[2] * .36, base[1]]);
  b.lathe(group, b.m.carving, [[0, .02], [radius * 1.74, .02], [radius * 1.70, base[2] * .43], [radius * 1.38, base[2] * .63], [radius * 1.12, base[2]], [0, base[2]]], [x, floor, z], 32);
  b.lathe(group, rear ? b.m.greenWood : b.m.red, [[0, base[2] - .025], [radius, base[2] - .025], [radius * .99, height * .35], [radius * .95, height * .75], [radius * .91, height], [0, height]], [x, floor, z], 32);
  b.lathe(group, b.m.darkWood, [[0, base[2]], [radius * 1.018, base[2]], [radius * 1.018, base[2] + .025], [0, base[2] + .025]], [x, floor, z], 32);
  return group;
}

export function jiuzhouSteps(b, parent, name, { x = 0, frontZ, width, fromY = .035, toY, run = 1.4, reverse = false }) {
  const group = namedGroup(parent, name, { body: 'supported-stone-steps', clearWidth: width, fromY, toY }); group.position.x = x;
  if (reverse) group.rotation.y = Math.PI;
  const count = Math.max(1, Math.ceil((toY - fromY) / .176));
  for (let i = 0; i < count; i++) {
    const top = fromY + (toY - fromY) * (i + 1) / count, depth = run / count;
    b.box(group, b.m.stone, [0, (fromY - .035 + top) / 2, frontZ - depth * (i + .5)], [width, top - fromY + .035, depth + .013]);
    b.box(group, b.m.carving, [0, top - .022, frontZ - depth * i - .033], [width + .022, .045, .074]);
  }
  for (const side of [-1, 1]) for (let i = 0; i < count; i++) {
    const top = fromY + (toY - fromY) * (i + 1) / count + .14;
    b.box(group, b.m.carving, [side * (width / 2 + .14), (fromY + top) / 2, frontZ - run / count * (i + .5)], [.28, top - fromY + .05, run / count + .015]);
  }
  return group;
}

export function jiuzhouCloudSteps(b, parent, name, { frontZ, width, toY, fromY = .035, run = 1.40, reverse = false }) {
  const group = namedGroup(parent, name, { body: 'curved-outline-cloud-steps', source: 'late northern approach described as yunbu in He middle p38', exactOutlineAndStepCountRecovered: false }); if (reverse) group.rotation.y = Math.PI;
  const count = Math.ceil((toY - fromY) / .15);
  for (let i = 0; i < count; i++) {
    const top = fromY + (toY - fromY) * (i + 1) / count, w = width * (1 - .018 * Math.sin(i * 1.7)), front = frontZ - i * run / count, back = frontZ - run - .016;
    const outline = [];
    for (let j = 0; j <= 36; j++) { const x = (j / 36 - .5) * w, u = x / (w / 2); outline.push([x, front + .11 * u ** 2 + .025 * Math.sin(u * Math.PI * 2 + i)]); }
    outline.push([w / 2 - .055, back], [-w / 2 + .055, back]);
    b.polygon(group, outline, fromY - .08, top, i % 2 ? b.m.paving : b.m.stone);
  }
  return group;
}

export function jiuzhouPlatform(b, parent, name, width, depth, floor, { bottom = -.12, tilePitch = .64 } = {}) {
  const group = namedGroup(parent, name, { body: 'stone-edged-platform-with-individual-paving', topY: floor });
  b.box(group, b.m.foundation, [0, (bottom + floor - .11) / 2, 0], [width - .035, floor - .11 - bottom, depth - .035]);
  b.box(group, b.m.stone, [0, floor - .08, 0], [width, .10, depth]);
  const nx = Math.ceil(width / tilePitch), nz = Math.ceil(depth / tilePitch), sx = width / nx, sz = depth / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) b.box(group, (i * 7 + j * 3) % 19 ? b.m.paving : b.m.foundation, [(i + .5) * sx - width / 2, floor - .019, (j + .5) * sz - depth / 2], [sx - .007, .039, sz - .007]);
  return group;
}

export function jiuzhouTileRun(b, parent, sample, row, { count = null, pan = true } = {}) {
  const coarse = Array.from({ length: 17 }, (_, i) => sample(i / 16));
  let length = 0; for (let i = 1; i < coarse.length; i++) length += coarse[i].distanceTo(coarse[i - 1]);
  if (length < .06) return;
  const courses = count ?? Math.max(1, Math.ceil(length / .52));
  for (let i = 0; i < courses; i++) {
    const a = i / courses, c = Math.min(1, (i + 1.11) / courses);
    const points = Array.from({ length: 5 }, (_, j) => { const p = sample(THREE.MathUtils.lerp(a, c, j / 4)); p.y += .025 + .023 * (1 - j / 4); return p; });
    const material = (row * 13 + i * 7) % 23 === 0 ? b.m.tileShade : b.m.greyTile;
    b.instanceTile(parent, points, material, 'cover');
    if (pan) {
      const panPoints = points.map((point, j) => {
        const tangent = points[Math.min(j + 1, 4)].clone().sub(points[Math.max(0, j - 1)]), side = V(tangent.z, 0, -tangent.x).normalize();
        return point.clone().addScaledVector(side, .13).add(V(0, -.019, 0));
      });
      b.instanceTile(parent, panPoints, material, 'pan');
    }
  }
}
const tileRun = jiuzhouTileRun;

export function jiuzhouPolygonPlatform(b, parent, name, outline, floor, { bottom = -.15, pitch = .64 } = {}) {
  const group = namedGroup(parent, name, { body: 'continuous-polygon-platform-with-separate-stone-pavers', topY: floor, planShapeInferred: true });
  b.polygon(group, outline, bottom, floor - .11, b.m.foundation);
  b.polygon(group, outline, floor - .11, floor - .028, b.m.stone);
  const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
  for (let x = Math.floor(Math.min(...xs) / pitch) * pitch; x < Math.max(...xs); x += pitch) for (let z = Math.floor(Math.min(...zs) / pitch) * pitch; z < Math.max(...zs); z += pitch) {
    const p = clipPavingCell(outline, x + .0035, x + pitch - .0035, z + .0035, z + pitch - .0035);
    if (p.length >= 3) b.polygon(group, p, floor - .032, floor, (Math.round(x / pitch) * 7 + Math.round(z / pitch) * 13) % 23 ? b.m.paving : b.m.foundation);
  }
  return group;
}

export function buildJiuzhouHipBand(b, parent, name, options, { tiles = true } = {}) {
  const group = namedGroup(parent, name, { body: 'curved-grey-clay-hip-band-with-real-upper-opening' });
  b.add(group, chineseHipRoofGeometry({ ...options, thickness: .18 }), b.m.tileShade, undefined, undefined, undefined, true);
  if (tiles) {
    const cover = namedGroup(group, `${name}-individual-tiles`, { body: 'individual-24-sample-pan-and-cover-clay-tiles' });
    for (let face = 0; face < 4; face++) {
      const along = face % 2 ? options.depth : options.width, top = face % 2 ? options.topDepth : options.topWidth, count = Math.max(3, Math.floor(along / .26));
      for (let i = 0; i < count; i++) {
        const offset = -along / 2 + (i + .5) * along / count, maxT = Math.min(1, (along / 2 - Math.abs(offset) - .09) / Math.max(.001, (along - top) / 2));
        if (maxT <= .01) continue;
        tileRun(b, cover, t => chineseHipPoint(options, face, offset / THREE.MathUtils.lerp(along / 2, top / 2, t * maxT), t * maxT), face * 17 + i, { pan: i !== 0 && i !== count - 1 });
      }
      tileRun(b, cover, t => chineseHipPoint(options, face, 1, t).add(V(0, .10, 0)), face, { pan: false });
    }
  }
  return group;
}

export function buildJiuzhouPointedXieshan(b, parent, name, { width, depth, eaveY, rise, tiles = true }) {
  const group = namedGroup(parent, name, { body: 'grey-clay-xieshan-with-straight-main-ridge', roofType: 'pointed-xieshan', profileInferred: true });
  const topWidth = width - depth * .43, topDepth = depth * .50, breakY = eaveY + rise * .33;
  buildJiuzhouHipBand(b, group, `${name}-hips`, { width, depth, topWidth, topDepth, eaveY, rise: rise * .33, cornerLift: .20 }, { tiles });
  const options = { width: topWidth, depth: topDepth, eaveY: breakY + .012, rise: rise * .67, thickness: .18 };
  const upper = namedGroup(group, `${name}-upper-roof`, { body: 'closed-ridged-upper-gable' });
  b.add(upper, chineseGableRoofGeometry(options), b.m.greyTile, undefined, undefined, undefined, true);
  if (tiles) {
    const cover = namedGroup(group, `${name}-upper-tiles`, { body: 'individual-clay-pan-and-cover-tiles' });
    const count = Math.floor(topWidth / .26);
    for (const side of [-1, 1]) for (let i = 0; i < count; i++) {
      const u = -1 + 2 * (i + .5) / count;
      tileRun(b, cover, t => chineseGablePoint(options, side, u, t), i, { pan: i !== 0 && i !== count - 1 });
    }
  }
  const gables = namedGroup(group, `${name}-closed-gables`, { body: 'solid-masonry-end-gables-with-inset-bargeboards' });
  for (const side of [-1, 1]) b.add(gables, gableInfillGeometry(topDepth, rise * .67 - .18, .16), b.m.brick, [side * (topWidth / 2 - .10), breakY + .004, 0], undefined, undefined, true);
  const ridge = namedGroup(group, `${name}-ridge`, { body: 'closed-ceramic-ridge-and-volumetric-end-ornament', ornamentShapeInferred: true });
  const count = Math.ceil(topWidth / .45);
  for (let i = 0; i < count; i++) b.box(ridge, i % 11 ? b.m.greyTile : b.m.tileShade, [(i + .5) * topWidth / count - topWidth / 2, eaveY + rise + .15, 0], [topWidth / count - .008, .34, .34]);
  for (const side of [-1, 1]) b.add(ridge, b.prototype('jiuzhou-volumetric-ridge-end', ridgeBeastGeometry), b.m.greyTile, [side * (topWidth / 2 - .06), eaveY + rise + .31, 0], [.55, .55, .55], [0, side > 0 ? Math.PI : 0, 0]);
  return group;
}

function tileStrip(b, parent, name, section, width, x = 0, { tiles = true } = {}) {
  const group = namedGroup(parent, name, { body: 'closed-continuous-roof-strip-with-separate-overlapping-pan-and-cover-tiles' });
  b.add(group, joinedJuanpengStripGeometry({ width, section }), b.m.tileShade, [x, 0, 0], undefined, undefined, true);
  if (!tiles) return group;
  const cover = namedGroup(group, `${name}-individual-tiles`, { body: 'separate-grey-clay-cover-and-pan-tiles', pitch: .26, nominalCourseLength: .52, lapFraction: .11, curvedCoverSamples: 24 });
  const rows = Math.max(2, Math.floor(width / .26));
  for (let row = 0; row < rows; row++) {
    const px = x - width / 2 + .09 + (width - .18) * row / Math.max(1, rows - 1);
    for (const segment of section.segments) {
      const ascending = segment.points[3].y > segment.points[0].y;
      const start = juanpengSegmentPoint(segment, ascending ? 0 : 1), end = juanpengSegmentPoint(segment, ascending ? 1 : 0), panToRight = end.z > start.z;
      tileRun(b, cover, t => juanpengSegmentPoint(segment, ascending ? t : 1 - t, px), row, { pan: panToRight ? row < rows - 1 : row > 0 });
    }
    // Each rounded crown is capped by one curved clay piece that bridges the
    // two half-slope ends. A juanpeng roof has no straight animal-ended ridge.
    for (const crown of section.crowns) if (crown.z > section.segments[0].points[0].x + .12 && crown.z < section.segments.at(-1).points[3].x - .12) {
      const points = Array.from({ length: 13 }, (_, i) => { const p = jiuzhouRoofSectionPoint(section, crown.z - .19 + .38 * i / 12, px); p.y += .096; return p; });
      b.add(cover, roofTileRollGeometry(points, .083, .024, 24), b.m.greyTile, undefined, undefined, undefined, true);
    }
  }
  return group;
}

function gableInfill(b, parent, name, section, x, bottom, { material = b.m.brick, width = .18 } = {}) {
  const group = namedGroup(parent, name, { body: 'closed-masonry-gable-cut-to-the-actual-roof-underside' });
  const outline = [[section.segments[0].points[0].x, bottom]];
  for (const segment of section.segments) for (let j = 0; j <= 48; j++) { const p = juanpengSegmentPoint(segment, j / 48); outline.push([p.z, p.y - .18]); }
  outline.push([section.segments.at(-1).points[3].x, bottom]);
  const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(...p))), geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -width / 2); geometry.rotateY(-Math.PI / 2);
  b.add(group, geometry, material, [x, 0, 0], undefined, undefined, true);
  const border = namedGroup(group, `${name}-moulded-bargeboard`, { body: 'thin-bargeboard-following-the-curved-cover' });
  for (const segment of section.segments) {
    const path = Array.from({ length: 49 }, (_, i) => { const p = juanpengSegmentPoint(segment, i / 48, x); p.y -= .073; return p; });
    b.tube(border, b.m.greyTile, path, .095, 64, 16);
  }
  return group;
}

function lowerHipWing(b, parent, name, { side, back = false, sideFace = false, width, upperWidth, halfDepth, breakZ, centralHalf, section, cornerLift }, { tiles = true } = {}) {
  const fullHalf = width / 2, upperHalf = upperWidth / 2;
  const sample = (u, t) => {
    const hx = THREE.MathUtils.lerp(fullHalf, upperHalf, t), hz = THREE.MathUtils.lerp(halfDepth, breakZ, t);
    const p = jiuzhouRoofSectionPoint(section, hz), lift = cornerLift * (1 - t) ** 2;
    if (sideFace) return V(side * hx, p.y + lift * (2 * u - 1) ** 6, (2 * u - 1) * hz);
    return V(side * THREE.MathUtils.lerp(centralHalf, hx, u), p.y + lift * u ** 6, (back ? -1 : 1) * hz);
  };
  const group = namedGroup(parent, name, { body: sideFace ? 'main-hall-side-hip' : 'clipped-front-or-rear-hip-shoulder' });
  b.add(group, roofSurfacePatchGeometry(sample), b.m.tileShade, undefined, undefined, undefined, true);
  if (tiles) {
    const cover = namedGroup(group, `${name}-tiles`, { body: 'individual-overlapping-grey-pan-and-cover-tiles' });
    const span = sideFace ? halfDepth * 2 : fullHalf - centralHalf, rows = Math.max(3, Math.floor(span / .26));
    for (let row = 0; row < rows; row++) {
      // Keep rows at their physical X/Z spacing. Constant parameter rows
      // would converge and force neighbouring cover tiles through each other.
      const offset = sideFace ? -halfDepth + (row + .5) * span / rows : centralHalf + (row + .5) * span / rows;
      const maxT = Math.min(1, sideFace ? (halfDepth - Math.abs(offset) - .086) / (halfDepth - breakZ) : (fullHalf - offset - .086) / (fullHalf - upperHalf));
      if (maxT <= .008) continue;
      const run = t => {
        const at = t * maxT, hx = THREE.MathUtils.lerp(fullHalf, upperHalf, at), hz = THREE.MathUtils.lerp(halfDepth, breakZ, at);
        return sample(sideFace ? (offset / hz + 1) / 2 : (offset - centralHalf) / (hx - centralHalf), at);
      };
      const tangent = run(.05).sub(run(0)), positiveRow = sideFace ? V(0, 0, 1) : V(side, 0, 0);
      const toNext = V(tangent.z, 0, -tangent.x).dot(positiveRow) > 0;
      tileRun(b, cover, run, row, { pan: toNext ? row < rows - 1 : row > 0 });
    }
    if (sideFace) for (const edge of [0, 1]) tileRun(b, cover, t => sample(edge, t).add(V(0, .105, 0)), edge + 37, { pan: false });
  }
  return { group, sample };
}

export function buildJiuzhouJoinedRoof(b, parent, name, { floor = .704, tiles = true } = {}) {
  const group = namedGroup(parent, name, { body: 'five-bay-juanpeng-xieshan-with-three-bay-xuanshan-rear-addition', source: 'He Yan middle pp38–39; common rear-inner-purlin connection', profilesInferred: true });
  const section = jiuzhouJoinedRoofSection({ floorY: floor }), width = 22.08, upperWidth = 16.448, halfDepth = 7.04, breakZ = halfDepth * .55, centralHalf = 5.92;
  tileStrip(b, group, `${name}-common-purlin-central-roof`, section, centralHalf * 2, 0, { tiles });
  const main = singleJuanpengSection({ depth: halfDepth * 2, eaveY: section.eaveSkinY, crownY: section.crowns[0].y });
  const upper = cropJuanpengSection(main, -breakZ, breakZ), upperY = jiuzhouRoofSectionPoint(main, breakZ).y;
  for (const side of [-1, 1]) {
    const span = upperWidth / 2 - centralHalf, x = side * (centralHalf + span / 2);
    tileStrip(b, group, `${name}-main-${side < 0 ? 'west' : 'east'}-upper-roof`, upper, span, x, { tiles });
    for (const back of [false, true]) lowerHipWing(b, group, `${name}-${back ? 'north' : 'south'}-hip-${side}`, { side, back, width, upperWidth, halfDepth, breakZ, centralHalf, section: main, cornerLift: .24 }, { tiles });
    lowerHipWing(b, group, `${name}-side-hip-${side}`, { side, sideFace: true, width, upperWidth, halfDepth, breakZ, centralHalf, section: main, cornerLift: .24 }, { tiles });
    gableInfill(b, group, `${name}-main-rounded-gable-${side}`, upper, side * (upperWidth / 2 - .12), upperY - .23);
    const rear = cropJuanpengSection(section, section.segments[0].points[0].x, section.valley.z);
    gableInfill(b, group, `${name}-rear-xuanshan-gable-${side}`, rear, side * (centralHalf - .12), section.eaveSkinY - .24);
  }
  const valleys = namedGroup(group, `${name}-shared-valley-drainage`, { body: 'supported-transverse-grey-clay-valley-gutter', originalDrainageDetailRecovered: false });
  b.add(valleys, roofSurfacePatchGeometry((u, t) => V((u - .5) * centralHalf * 2, section.valley.y + .016 + .23 * (t - .5) ** 2, section.valley.z + (t - .5) * .31), { columns: 24, rows: 20, thickness: .028 }), b.m.greyTile, undefined, undefined, undefined, true);
  return { group, section, mainSection: main };
}

export function buildSingleJuanpengRoof(b, parent, name, { width, depth, eaveY, rise, xieshan = true, tiles = true, rolls = 1 }) {
  const group = namedGroup(parent, name, { body: rolls > 1 ? `${rolls}-joined-juanpeng-roof` : xieshan ? 'juanpeng-xieshan-roof' : 'juanpeng-xuanshan-roof', profileEvidence: 'authored-proportions-for-the-documented-type' });
  const section = rolls > 1 ? multipleJuanpengSection({ depth, crowns: Array.from({ length: rolls }, (_, i) => eaveY + rise * (i === Math.floor(rolls / 2) ? 1 : .94)), eaveY, valleyY: eaveY + rise * .37 }) : singleJuanpengSection({ depth, eaveY, crownY: eaveY + rise });
  if (!xieshan || rolls > 1) {
    tileStrip(b, group, `${name}-continuous-roof`, section, width, 0, { tiles });
    for (const side of [-1, 1]) gableInfill(b, group, `${name}-gable-${side}`, section, side * (width / 2 - .12), eaveY - .24);
  } else {
    const halfDepth = depth / 2, breakZ = halfDepth * .55, upperWidth = width - depth * .38, upper = cropJuanpengSection(section, -breakZ, breakZ);
    tileStrip(b, group, `${name}-continuous-roof`, upper, upperWidth, 0, { tiles });
    for (const side of [-1, 1]) {
      for (const back of [false, true]) lowerHipWing(b, group, `${name}-${back ? 'north' : 'south'}-hip-${side}`, { side, back, width, upperWidth, halfDepth, breakZ, centralHalf: 0, section, cornerLift: .20 }, { tiles });
      lowerHipWing(b, group, `${name}-side-hip-${side}`, { side, sideFace: true, width, upperWidth, halfDepth, breakZ, centralHalf: 0, section, cornerLift: .20 }, { tiles });
      gableInfill(b, group, `${name}-gable-${side}`, upper, side * (upperWidth / 2 - .12), jiuzhouRoofSectionPoint(section, breakZ).y - .23);
    }
  }
  return { group, section };
}

export function jiuzhouMasonry(b, parent, from, to, top, height = .45, material = b.m.foundation) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.ceil(length / .78), angle = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  for (let i = 0; i < count; i++) b.add(parent, b.prototype(`jiuzhou-dressed-block-${i % 7}`, () => quarriedMasonryBlockGeometry(i % 7)), material, [THREE.MathUtils.lerp(from[0], to[0], (i + .5) / count), top - height / 2, THREE.MathUtils.lerp(from[1], to[1], (i + .5) / count)], [length / count - .01, height, .48], [0, angle, 0]);
}
