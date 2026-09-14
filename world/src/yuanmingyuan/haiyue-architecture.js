import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { namedGroup, V, extrudedPolygon } from './study-geometry.js';
import { createHaiyueMaterials } from './haiyue-materials.js';
import { haiyueLatheGeometry, haiyueLatticeSegments, haiyueCloudSpandrelGeometry, haiyueStairTreads } from './haiyue-geometry.js';
import { bracketArmGeometry } from './chinese-architecture-geometry.js';
import { haiyueCarvedStoneRailBay } from './haiyue-stone-rail.js';

// Reuses the established positive-instance batching convention, not a building
// factory. Every architectural arrangement below is authored for Haiyue.
export class HaiyueBuilder {
  constructor() {
    Object.assign(this, createHaiyueMaterials());
    this.geometries = new Set(); this.instances = new Set(); this.prototypes = new Map(); this.pending = new Map(); this.disposed = false;
    this.buildings = []; this.walkways = []; this.materialInterpretation = 'original-comparative-colour-study-not-recovered-haiyue-polychromy';
  }
  proto(key, build) { if (!this.prototypes.has(key)) { const g = build(); g.name = `haiyue-prototype-${key}`; this.prototypes.set(key, g); this.geometries.add(g); } return this.prototypes.get(key); }
  put(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], color = null) {
    if (scale.some(v => !Number.isFinite(v) || v <= 0) || position.some(v => !Number.isFinite(v))) throw new Error('Haiyue requires finite positive transforms.');
    const q = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(V(...position), q, V(...scale));
    this.geometries.add(geometry);
    const key = `${parent.uuid}:${geometry.uuid}:${material.uuid}`;
    if (!this.pending.has(key)) this.pending.set(key, { parent, geometry, material, matrices: [], colors: [] });
    const bucket = this.pending.get(key); bucket.matrices.push(matrix); bucket.colors.push(color);
  }
  box(parent, material, position, scale, rotation, color) { this.put(parent, this.proto('box', () => new THREE.BoxGeometry()), material, position, scale, rotation, color); }
  block(parent, material, position, scale, rotation, color) { this.put(parent, this.proto('dressed-stone', () => new RoundedBoxGeometry(1, 1, 1, 2, .022)), material, position, scale, rotation, color); }
  rod(parent, material, from, to, radius, sides = 12) {
    const a = V(...from), d = V(...to).sub(a), length = d.length(); if (length < .0001) return;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    this.put(parent, this.proto(`rod-${sides}`, () => new THREE.CylinderGeometry(1, 1, 1, sides)), material, a.addScaledVector(d, .5).toArray(), [radius, length, radius], q);
  }
  beam(parent, material, from, to, breadth, depth = breadth) {
    const a = V(...from), d = V(...to).sub(a), length = d.length(); if (length < .0001) return;
    this.box(parent, material, a.addScaledVector(d, .5).toArray(), [breadth, length, depth], new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  }
  tube(parent, material, points, radius, segments = 24, sides = 8) {
    const vertices = points.map(p => p.isVector3 ? p : V(...p)), closed = vertices[0].distanceTo(vertices.at(-1)) < 1e-8;
    if (closed) vertices.pop();
    const curve = new THREE.CatmullRomCurve3(vertices, closed), g = new THREE.TubeGeometry(curve, segments, radius, sides, closed);
    // Tube caps are explicit disks. Ornament is not an uncapped open cylinder.
    const caps = this.proto(`cap-${sides}`, () => new THREE.CircleGeometry(1, sides));
    this.put(parent, g, material);
    if (!closed) for (const end of [0, 1]) { const tangent = curve.getTangent(end).multiplyScalar(end ? 1 : -1); this.put(parent, caps, material, curve.getPoint(end).toArray(), [radius, radius, 1], new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tangent)); }
  }
  polygon(parent, points, bottom, top, material, holes = []) { this.put(parent, extrudedPolygon(points, bottom, top, holes), material); }
  lathe(parent, name, material, profile, position, scale = [1, 1, 1], sides = 24) {
    this.put(parent, this.proto(name, () => haiyueLatheGeometry(profile, sides)), material, position, scale);
  }
  flush() {
    for (const { parent, geometry, material, matrices, colors } of this.pending.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length); mesh.name = `${parent.name}/${material.name}/${geometry.name || 'unique-solid'}`;
      const hasColors = colors.some(Boolean);
      for (let i = 0; i < matrices.length; i++) { mesh.setMatrixAt(i, matrices[i]); if (hasColors) mesh.setColorAt(i, colors[i] ?? new THREE.Color(1, 1, 1)); }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.userData = { body: 'editable-positive-instance-transforms', sourceIds: parent.userData.sourceIds ?? [], template: geometry.name };
      parent.add(mesh); this.instances.add(mesh);
    }
    this.pending.clear();
  }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.pending.clear();
    for (const set of [this.instances, this.geometries, this.materials, this.textures]) { for (const resource of set) resource.dispose(); set.clear(); }
    this.prototypes.clear();
  }
}

export function haiyueColumn(b, parent, x, z, floorY, height, radius = .23) {
  b.lathe(parent, 'white-stone-column-base', b.m.stone, [[0, 0], [1.6, 0], [1.6, .16], [1.38, .23], [1.25, .32], [1.13, .61], [1.10, .71], [0, .71]], [x, floorY, z], [radius, radius, radius]);
  const foot = radius * .71;
  b.put(parent, b.proto('slightly-tapered-vermilion-post', () => new THREE.CylinderGeometry(.94, 1, 1, 32, 4)), b.m.red, [x, floorY + foot + (height - foot) / 2, z], [radius, height - foot, radius]);
  for (const y of [floorY + foot + .025, floorY + height - .075]) b.lathe(parent, 'timber-end-collar', b.m.darkWood, [[0, -.021], [1.03, -.021], [1.04, .005], [1.015, .04], [0, .04]], [x, y, z], [radius, 1, radius]);
}

export function haiyuePaintedBeam(b, parent, from, to, y, height = .42, depth = .30) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), angle = -Math.atan2(to[1] - from[1], to[0] - from[0]), x = (from[0] + to[0]) / 2, z = (from[1] + to[1]) / 2;
  b.box(parent, b.m.green, [x, y, z], [length + .07, height, depth], [0, angle, 0]);
  for (const side of [-1, 1]) {
    const d = side * (depth / 2 + .009), xx = x + Math.sin(angle) * d, zz = z + Math.cos(angle) * d;
    b.box(parent, b.m.paintwork, [xx, y, zz], [length - .015, height * .86, .016], [0, angle, 0]);
    for (const dy of [-height * .45, height * .45]) b.box(parent, b.m.gold, [xx, y + dy, zz], [length, .012, .017], [0, angle, 0]);
  }
}

export function haiyueBracket(b, parent, x, y, z, rotationY = 0, scale = 1) {
  const group = namedGroup(parent, 'haiyue-recessed-dougong-set', { body: 'individual-dou-gong-and-oblique-supports', evidence: 'Dougong is documented; exact section and ornament are inferred.' }); group.position.set(x, y, z); group.rotation.y = rotationY;
  b.block(group, b.m.green, [0, .07 * scale, 0], [.38 * scale, .19 * scale, .40 * scale]);
  for (const [w, yy, dz, rotation] of [[.93, .22, .06, 0], [1.12, .39, .25, Math.PI / 2], [1.32, .57, .40, 0]]) {
    b.put(group, b.proto(`gong-${w}`, () => bracketArmGeometry(w, .17, .22)), yy === .39 ? b.m.green : b.m.blue, [0, yy * scale, dz * scale], [scale, scale, scale], [0, rotation, 0]);
    for (const sign of [-1, 1]) b.block(group, b.m.pale, [sign * w * .33 * scale, (yy + .12) * scale, dz * scale], [.17 * scale, .10 * scale, .22 * scale]);
  }
  b.beam(group, b.m.red, [0, .12 * scale, -.16 * scale], [0, .65 * scale, .81 * scale], .085 * scale, .12 * scale);
  return group;
}

export function haiyueSpandrels(b, parent, width, y) {
  const w = Math.min(1.05, width * .29), geometry = b.proto(`cloud-spandrel-${w}`, () => haiyueCloudSpandrelGeometry(w, .49));
  for (const side of [-1, 1]) {
    b.put(parent, geometry, b.m.green, [side * width / 2, y, 0], [1, 1, 1], [0, side < 0 ? 0 : Math.PI, 0]);
    b.put(parent, geometry, b.m.gold, [side * width / 2, y - .013, .046], [.87, .85, .08], [0, side < 0 ? 0 : Math.PI, 0]);
  }
}

export function haiyueSash(b, parent, { width, height, bottom = 0, centerX = 0, z = 0, lower = .66, door = false }) {
  const frame = .060;
  for (const x of [centerX - width / 2, centerX + width / 2]) b.box(parent, b.m.red, [x, bottom + height / 2, z], [frame, height, .082]);
  for (const y of [bottom, bottom + lower, bottom + height]) b.box(parent, b.m.red, [centerX, y, z], [width + frame, frame, .082]);
  b.box(parent, b.m.darkWood, [centerX, bottom + lower / 2, z], [width - frame, lower - frame, .042]);
  const radius = Math.min(width * .17, lower * .23), shape = b.proto(`lower-panel-flower-${radius}`, () => new THREE.TorusGeometry(radius, .008, 6, 36));
  b.put(parent, shape, b.m.gold, [centerX, bottom + lower * .51, z + .025], [1, .82, 1]);
  for (const sign of [-1, 1]) for (const dx of [-width * .35, width * .35]) b.box(parent, b.m.gold, [centerX + dx, bottom + lower / 2, z + sign * .027], [.009, lower * .72, .009]);
  const apertureHeight = height - lower - frame, apertureWidth = width - frame;
  for (const line of haiyueLatticeSegments({ width: apertureWidth, height: apertureHeight, pitch: .245 })) b.beam(parent, b.m.red, [centerX + line.from[0], bottom + lower + frame / 2 + line.from[1], z + line.depth], [centerX + line.to[0], bottom + lower + frame / 2 + line.to[1], z + line.depth], .023, .031);
  if (door) {
    b.box(parent, b.m.gold, [centerX + width * .29, bottom + lower + .22, z + .057], [.035, .16, .025]);
    for (const y of [bottom + .29, bottom + height - .25]) b.box(parent, b.m.gold, [centerX - width * .46, y, z + .048], [.045, .11, .025]);
  }
}

export function haiyuePanelBay(b, parent, { width, height, floorY = 0, open = false, leaves = 4, lowWall = 0 }) {
  if (lowWall > 0) b.box(parent, b.m.red, [0, floorY + lowWall / 2, 0], [width, lowWall, .15]);
  const bottom = floorY + lowWall + .055, panelWidth = (width - .14) / leaves, panelHeight = height - lowWall - .25;
  b.box(parent, b.m.darkWood, [0, floorY + lowWall + .035, 0], [width + .06, .070, .18]);
  for (let leaf = 0; leaf < leaves; leaf++) {
    const x = -width / 2 + .07 + (leaf + .5) * panelWidth, moving = open && (leaf === leaves / 2 - 1 || leaf === leaves / 2);
    if (!moving) haiyueSash(b, parent, { width: panelWidth - .035, height: panelHeight, bottom, centerX: x, lower: Math.min(.70, panelHeight * .24) });
    else { const sign = leaf < leaves / 2 ? -1 : 1, hinge = x + sign * panelWidth / 2, g = namedGroup(parent, `haiyue-open-lattice-leaf-${leaf}`, { body: 'physically-hinged-open-leaf' }); g.position.x = hinge; g.rotation.y = sign * Math.PI * .43; haiyueSash(b, g, { width: panelWidth - .035, height: panelHeight, bottom, centerX: -sign * panelWidth / 2, lower: .70, door: true }); }
  }
  b.box(parent, b.m.red, [0, floorY + height - .095, 0], [width + .07, .13, .15]);
}

export function haiyueRailBay(b, parent, width, floorY, { stone = true, endPost = true, height = 1.0 } = {}) {
  if (stone) return haiyueCarvedStoneRailBay(b, parent, width, floorY, { endPost, height });
  const material = b.m.red;
  for (const x of endPost ? [-width / 2, width / 2] : [-width / 2]) {
    b.block(parent, material, [x, floorY + height * .42, 0], [.18, height * .84, .18]);
    b.block(parent, b.m.green, [x, floorY + height * .84, 0], [.23, .075, .22]);
  }
  for (const y of [.14, .74]) b.block(parent, material, [0, floorY + height * y, 0], [width - .10, .105, .12]);
  for (const x of [-width * .31, 0, width * .31]) b.box(parent, material, [x, floorY + height * .44, 0], [.060, height * .52, .085]);
  for (const side of [-1, 1]) b.beam(parent, b.m.green, [side * width * .44, floorY + height * .22, .0], [-side * width * .44, floorY + height * .68, .0], .048, .060);
}

export function haiyueStraightRail(b, parent, from, to, y, options = {}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(1, Math.ceil(length / 1.75)), angle = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  for (let i = 0; i < count; i++) { const t = (i + .5) / count, g = namedGroup(parent, 'haiyue-straight-railing-bay'); g.position.set(THREE.MathUtils.lerp(from[0], to[0], t), 0, THREE.MathUtils.lerp(from[1], to[1], t)); g.rotation.y = angle; haiyueRailBay(b, g, length / count, y, { ...options, endPost: i === count - 1 }); }
}

export function haiyueTimberStair(b, parent, { bottom, top, well, count, id }) {
  const g = namedGroup(parent, id, { body: 'two-flight-timber-stair-with-solid-risers-and-connected-landings', support: true, bottom, top, count, evidence: well.evidence });
  const treads = haiyueStairTreads({ bottom, top, well, count });
  for (const tread of treads) {
    b.block(g, b.m.darkWood, [tread.x, tread.y - .050, tread.z], [tread.width, .100, tread.depth + .015]);
    const dz = (tread.flight ? -1 : 1) * (tread.depth / 2 - .025);
    b.box(g, b.m.darkWood, [tread.x, tread.y - tread.rise / 2, tread.z + dz], [tread.width, tread.rise, .049]);
  }
  const middle = (top + bottom) / 2, width = well.maxX - well.minX, x = (well.minX + well.maxX) / 2, turnZ = well.entryZ - well.run;
  b.box(g, b.m.darkWood, [x, middle - .10, turnZ - .54], [width - .10, .20, 1.08]);
  for (const xx of [well.minX + .16, well.maxX - .16]) b.box(g, b.m.darkWood, [xx, (middle + bottom) / 2, turnZ - .88], [.16, middle - bottom, .16]);
  for (const flight of [0, 1]) {
    const members = treads.filter(t => t.flight === flight), start = members[0], end = members.at(-1), direction = flight ? 1 : -1;
    for (const side of [-1, 1]) {
      const x = start.x + side * (well.flightWidth / 2 - .025), z0 = start.z - direction * start.depth / 2, z1 = end.z + direction * end.depth / 2, y0 = start.y - start.rise, y1 = end.y;
      b.beam(g, b.m.darkWood, [x, y0 - .14, z0], [x, y1 - .14, z1], .13, .22);
      b.rod(g, b.m.red, [x, y0 + .90, z0], [x, y1 + .90, z1], .041, 12);
      for (let step = 0; step < members.length; step += 3) { const t = members[step]; b.box(g, b.m.red, [x, t.y + .43, t.z], [.053, .86, .053]); }
    }
  }
  haiyueStraightRail(b, g, [well.minX + .06, turnZ - 1.02], [well.maxX - .06, turnZ - 1.02], middle, { stone: false, height: .98 });
  return g;
}

export function haiyueStoneSteps(b, parent, name, { width, edgeZ, bottom, top, count, pitch = .32 }) {
  const g = namedGroup(parent, name, { body: 'solid-stone-treads', bottom, top, count, pitch, support: true });
  for (let i = 0; i < count; i++) {
    const y = top - i * (top - bottom) / count, z = edgeZ + (i + .5) * pitch;
    b.block(g, b.m.stone, [0, (bottom + y) / 2 - .014, z], [width, y - bottom + .028, pitch + .009]);
  }
  for (const side of [-1, 1]) b.beam(g, b.m.stone, [side * (width / 2 + .11), top + .06, edgeZ], [side * (width / 2 + .11), bottom + .06, edgeZ + count * pitch], .20, .16);
  return g;
}
