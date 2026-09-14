import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { namedGroup, V, extrudedPolygon } from './study-geometry.js';
import { createZhengjuesiMaterials } from './zhengjuesi-materials.js';
import { zhengjuesiLatticeSegments, zhengjuesiCloudCorbelGeometry, zhengjuesiLotusReliefPetalGeometry, zhengjuesiLatheGeometry } from './zhengjuesi-geometry.js';
import { bracketArmGeometry } from './chinese-architecture-geometry.js';

export class ZhengjuesiBuilder {
  constructor() {
    Object.assign(this, createZhengjuesiMaterials());
    this.geometries = new Set(); this.instances = new Set(); this.prototypes = new Map(); this.pending = new Map(); this.disposed = false;
    this.buildings = []; this.walkways = []; this.materialInterpretation = 'original-colour-and-paintwork-informed-by-surviving-and-repaired-fabric';
  }
  proto(key, build) { if (!this.prototypes.has(key)) { const g = build(); g.name = `zhengjuesi-prototype-${key}`; this.prototypes.set(key, g); this.geometries.add(g); } return this.prototypes.get(key); }
  put(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], color = null) {
    if (scale.some(v => !Number.isFinite(v) || v <= 0) || position.some(v => !Number.isFinite(v))) throw new Error('Zhengjuesi requires finite positive transforms.');
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
    this.put(parent, this.proto(name, () => zhengjuesiLatheGeometry(profile, sides)), material, position, scale);
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

export function zhengjuesiColumn(b, parent, x, z, floor, height, radius = .22) {
  b.lathe(parent, 'lotus-column-base', b.m.stone, [[0, 0], [1.54, 0], [1.54, .14], [1.38, .19], [1.25, .31], [1.18, .62], [1.06, .75], [0, .75]], [x, floor, z], [radius, radius, radius], 28);
  const plinthHeight = radius * .75;
  b.put(parent, b.proto('tapered-round-column', () => new THREE.CylinderGeometry(.97, 1, 1, 28, 3)), b.m.red, [x, floor + plinthHeight + (height - plinthHeight) / 2, z], [radius, height - plinthHeight, radius]);
  for (const y of [floor + plinthHeight + .045, floor + height - .04]) b.lathe(parent, 'column-collar', b.m.darkWood, [[0, -.03], [1.03, -.03], [1.05, 0], [1.03, .03], [0, .03]], [x, y, z], [radius, 1, radius]);
}

export function zhengjuesiPaintedBeam(b, parent, from, to, y, height = .48) {
  const direction = V(to[0] - from[0], 0, to[1] - from[1]), width = direction.length(), angle = -Math.atan2(direction.z, direction.x), center = [(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2];
  b.box(parent, b.m.green, center, [width + .055, height, .34], [0, angle, 0]);
  for (const side of [-1, 1]) {
    const offset = V(Math.sin(angle) * side * .177, 0, Math.cos(angle) * side * .177);
    b.box(parent, b.m.paintwork, [center[0] + offset.x, y, center[2] + offset.z], [width - .04, height * .83, .020], [0, angle, 0]);
    for (const dy of [-height * .475, height * .475]) b.box(parent, b.m.gold, [center[0] + offset.x, y + dy, center[2] + offset.z], [width - .025, .011, .013], [0, angle, 0]);
  }
}

export function zhengjuesiCorbels(b, parent, from, to, y, height = .56) {
  const angle = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  for (const [point, sign] of [[from, 1], [to, -1]]) {
    const g = b.proto(`cloud-corbel-${sign}`, () => zhengjuesiCloudCorbelGeometry({ side: sign }));
    b.put(parent, g, b.m.blue, [point[0], y - height, point[1]], [1, height / .54, 1], [0, angle, 0]);
    b.put(parent, g, b.m.gold, [point[0], y - height + .025, point[1]], [.84, height / .54 * .84, .19], [0, angle, 0]);
  }
}

export function zhengjuesiDougong(b, parent, x, y, z, angle = 0, scale = 1) {
  const transform = (xx, yy, zz) => [x + (xx * Math.cos(angle) + zz * Math.sin(angle)) * scale, y + yy * scale, z + (-xx * Math.sin(angle) + zz * Math.cos(angle)) * scale];
  b.block(parent, b.m.green, transform(0, .08, 0), [.36, .19, .37].map(v => v * scale), [0, angle, 0]);
  for (const [w, yy, zz, turn] of [[.91, .22, .02, 0], [1.16, .40, .20, Math.PI / 2], [1.38, .59, .43, 0]]) {
    const g = b.proto(`bracket-${w}`, () => bracketArmGeometry(w, .19, .22));
    b.put(parent, g, yy === .40 ? b.m.green : b.m.blue, transform(0, yy, zz), [scale, scale, scale], [0, angle + turn, 0]);
    for (const side of [-1, 1]) b.block(parent, b.m.pale, transform(side * w * .32, yy + .135, zz), [.17, .12, .22].map(v => v * scale), [0, angle, 0]);
  }
  b.beam(parent, b.m.red, transform(0, .16, -.15), transform(0, .60, .85), .085 * scale, .13 * scale);
}

export function zhengjuesiSash(b, parent, { centerX = 0, bottom = 0, width, height, z = 0, lowerPanel = .76, pitch = .24, door = false }) {
  const frame = .065, thickness = .085;
  for (const dx of [-width / 2, width / 2]) b.box(parent, b.m.red, [centerX + dx, bottom + height / 2, z], [frame, height, thickness]);
  for (const dy of [0, lowerPanel, height]) b.box(parent, b.m.red, [centerX, bottom + dy, z], [width + frame, frame, thickness]);
  b.box(parent, b.m.darkWood, [centerX, bottom + lowerPanel / 2, z], [width - frame, lowerPanel - frame, .043]);
  // Raised four-lobed panel outline, built as a closed narrow moulding path.
  const moulding = b.proto(`sash-relief-${width.toFixed(6)}-${lowerPanel.toFixed(6)}`, () => {
    const points = Array.from({ length: 64 }, (_, i) => { const a = i * Math.PI / 32, r = 1 + .13 * Math.cos(4 * a); return V(Math.cos(a) * (width * .34) * r, Math.sin(a) * lowerPanel * .28 * r, 0); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, .0085, 5, true);
  });
  b.put(parent, moulding, b.m.gold, [centerX, bottom + lowerPanel * .49, z + .026]);
  const apertureHeight = height - lowerPanel - frame, apertureWidth = width - frame;
  for (const segment of zhengjuesiLatticeSegments({ width: apertureWidth, height: apertureHeight, pitch, margin: .008 })) {
    const a = segment.from, c = segment.to;
    b.beam(parent, b.m.red, [centerX + a[0], bottom + lowerPanel + a[1] + frame * .5, z + segment.depthOffset], [centerX + c[0], bottom + lowerPanel + c[1] + frame * .5, z + segment.depthOffset], .025, .036);
  }
  if (door) {
    b.box(parent, b.m.brass, [centerX + width * .26, bottom + lowerPanel + .27, z + .06], [.038, .22, .025]);
    for (const yy of [.28, height - .27]) b.box(parent, b.m.brass, [centerX - width * .45, bottom + yy, z + .048], [.045, .12, .03]);
  }
}

export function zhengjuesiPanelBay(b, parent, { width, height, floor = 0, open = false, leaves = 4, pitch = .24, prefix = 'bay' }) {
  const gap = .031, panelWidth = (width - .14) / leaves, bottom = floor + .075;
  b.box(parent, b.m.darkWood, [0, floor + .055, 0], [width + .08, .11, .20]);
  const leafHeight = height - .34;
  for (let leaf = 0; leaf < leaves; leaf++) {
    const center = -width / 2 + .07 + panelWidth * (leaf + .5), moving = open && (leaf === leaves / 2 - 1 || leaf === leaves / 2);
    if (!moving) zhengjuesiSash(b, parent, { centerX: center, bottom, width: panelWidth - gap, height: leafHeight, lowerPanel: Math.min(.90, height * .23), pitch, door: false });
    else {
      const sign = leaf < leaves / 2 ? -1 : 1, hinge = center + sign * panelWidth / 2;
      const g = namedGroup(parent, `${prefix}-open-leaf-${leaf}`, { body: 'hinged-lattice-door-with-true-open-passage' }); g.position.x = hinge; g.rotation.y = sign * Math.PI * .42;
      zhengjuesiSash(b, g, { centerX: -sign * panelWidth / 2, bottom, width: panelWidth - gap, height: leafHeight, lowerPanel: Math.min(.90, height * .23), pitch, door: true });
    }
  }
  b.box(parent, b.m.red, [0, floor + height - .13, 0], [width + .11, .16, .16]);
}

export function zhengjuesiStairs(b, parent, name, { width, edgeZ, bottom = 0, top, count = Math.ceil((top - bottom) / .16), pitch = .34 }) {
  const group = namedGroup(parent, name, { body: 'solid-individual-stone-treads', stepCount: count, rise: (top - bottom) / count, pitch, bottom, top, support: true });
  for (let i = 1; i <= count; i++) {
    const level = bottom + (top - bottom) * i / count, centerZ = edgeZ + (count - i + .5) * pitch;
    b.block(group, b.m.stone, [0, (bottom + level) / 2 - .012, centerZ], [width, level - bottom + .024, pitch + .008]);
  }
  const profile = [[edgeZ, bottom], [edgeZ + count * pitch, bottom], [edgeZ + count * pitch, bottom + .12], [edgeZ, top + .12]];
  for (const side of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(profile.map(p => new THREE.Vector2(...p))), { depth: .22, steps: 1, bevelEnabled: false });
    // Shape X becomes +Z; its 0..depth extrusion becomes -X. Centre that slab
    // explicitly at the correct side of the treads, with positive transforms.
    g.rotateY(-Math.PI / 2); g.translate(side * (width / 2 + .11) + .11, 0, 0);
    b.put(group, g, b.m.stone);
  }
  return group;
}

export function zhengjuesiStoneRail(b, parent, from, to, y, { height = .84, spacing = 1.64 } = {}) {
  const a = V(from[0], y, from[1]), d = V(to[0] - from[0], 0, to[1] - from[1]), length = d.length(), count = Math.ceil(length / spacing), unit = d.clone().normalize();
  for (let i = 0; i <= count; i++) {
    const p = a.clone().addScaledVector(d, i / count);
    b.block(parent, b.m.stone, [p.x, y + height * .44, p.z], [.17, height * .88, .17]);
    b.lathe(parent, 'rail-lotus-bud', b.m.stone, [[0, 0], [.10, 0], [.115, .03], [.09, .10], [.065, .155], [0, .19]], [p.x, y + height * .86, p.z], [1, 1, 1], 20);
    if (i < count) {
      const q = a.clone().addScaledVector(d, (i + 1) / count), mid = p.clone().add(q).multiplyScalar(.5);
      for (const hh of [.18, .69]) b.beam(parent, b.m.stone, [p.x, y + hh, p.z], [q.x, y + hh, q.z], .12, .10);
      for (const t of [.25, .5, .75]) { const r = p.clone().lerp(q, t); b.beam(parent, b.m.stone, [r.x, y + .22, r.z], [r.x, y + .62, r.z], .063, .085); }
      const angle = -Math.atan2(unit.z, unit.x), petal = b.proto('rail-relief-petal', () => zhengjuesiLotusReliefPetalGeometry({ length: .12, width: .053, relief: .021, steps: 8 }));
      for (let f = 0; f < 6; f++) b.put(parent, petal, b.m.stone, [mid.x, y + .45, mid.z], [1, 1, 1], [0, angle, f * Math.PI / 3]);
    }
  }
}

export function zhengjuesiPlinth(b, parent, spec) {
  const width = spec.width + 1.5, depth = spec.depth + 1.5, group = namedGroup(parent, `${spec.id}-platform`, { body: 'continuous-raised-stone-platform', support: true, floor: spec.floor });
  // Embed the bed in the stone cap; coincident cap/core tops change appearance
  // when opaque materials are sorted differently after archive restoration.
  b.box(group, b.m.foundation, [0, (spec.floor - .25) / 2, 0], [width - .12, spec.floor + .05, depth - .12]);
  b.block(group, b.m.stone, [0, spec.floor - .095, 0], [width, .19, depth]);
  b.block(group, b.m.foundation, [0, .045, 0], [width + .13, .09, depth + .13]);
  const cols = Math.ceil(width / 1.55), rows = Math.ceil(depth / 1.10), w = width / cols, d = depth / rows;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) b.block(group, b.m.paving, [-width / 2 + (col + .5) * w, spec.floor - .014, -depth / 2 + (row + .5) * d], [w - .009, .034, d - .009], undefined, new THREE.Color().setScalar(.965 + ((row * 17 + col * 7) % 13) * .003));
  const stairWidth = spec.id.endsWith('sanshengdian') ? 5.0 : Math.min(4.3, spec.width / spec.bays - .15);
  const front = zhengjuesiStairs(b, group, `${spec.id}-front-stair`, { width: stairWidth, edgeZ: depth / 2, top: spec.floor });
  // A same-level rear annex continues the interior floor over this edge.
  // Exterior stairs here would be buried inside its platform and overlap it.
  if (!spec.rearAnnex) {
    const rear = zhengjuesiStairs(b, group, `${spec.id}-rear-stair`, { width: stairWidth, edgeZ: depth / 2, top: spec.floor }); rear.rotation.y = Math.PI;
  }
  if (spec.id.endsWith('sanshengdian')) {
    const rails = namedGroup(group, `${spec.id}-white-stone-rails`, { body: 'pierced-white-stone-balustrade', sourceIds: ['wu-zhengjuesi'] });
    for (const side of [-1, 1]) { zhengjuesiStoneRail(b, rails, [side * (stairWidth / 2 + .3), depth / 2], [side * width / 2, depth / 2], spec.floor); zhengjuesiStoneRail(b, rails, [side * width / 2, depth / 2], [side * width / 2, -depth / 2], spec.floor); }
  }
  return group;
}
