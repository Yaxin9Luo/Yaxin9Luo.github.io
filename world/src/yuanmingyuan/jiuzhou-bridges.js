import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { jiuzhouPlatform, jiuzhouSteps } from './jiuzhou-architecture.js';

export function jiuzhouCarvedLeafGeometry({ length = .27, width = .15 } = {}) {
  const outline = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32, w = Math.pow(Math.sin(Math.PI * t), .72) * width / 2 * (1 + .20 * Math.sin(t * Math.PI * 10));
    outline.push(new THREE.Vector2(-w + .13 * length * Math.sin(t * Math.PI), t * length));
  }
  for (let i = 31; i >= 1; i--) {
    const t = i / 32, w = Math.pow(Math.sin(Math.PI * t), .72) * width / 2 * (1 + .20 * Math.sin(t * Math.PI * 10));
    outline.push(new THREE.Vector2(w + .13 * length * Math.sin(t * Math.PI), t * length));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: .026, steps: 3, bevelEnabled: true, bevelSize: .0025, bevelThickness: .003, bevelSegments: 3, curveSegments: 24 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / length;
    p.setZ(i, p.getZ(i) + .045 * Math.sin(t * Math.PI * .92) - .013 + .025 * (p.getX(i) / width) ** 2);
  }
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData = { body: 'thick-curved-lobed-carved-wood-leaf', source: 'authored-foliage-form-for-the-documented-open-carved-rail', noHistoricScan: true }; return g;
}

function carvedFoliagePanel(b, parent, name, width, height) {
  const group = namedGroup(parent, name, { body: 'double-sided-pierced-wood-foliage-railing', source: 'He lower pp47–49, open-carved wooden foreign-foliage panels', exactMotifArrangementRecovered: false, mergeIntoParent: true });
  for (const side of [-1, 1]) {
    const face = namedGroup(group, `${name}-carving-face-${side}`, { mergeIntoParent: true }); face.position.z = side * .043; if (side < 0) face.rotation.y = Math.PI;
    const stem = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48; stem.push(V(-width * .46 + t * width * .92, height * .42 + Math.sin(t * Math.PI * 2) * height * .19, .013 * Math.sin(t * Math.PI * 2)));
    }
    b.tube(face, b.m.greenWood, stem, .023, 64, 14);
    for (let i = 0; i < 10; i++) {
      const t = (i + .5) / 10, x = -width * .46 + t * width * .92, y = height * .42 + Math.sin(t * Math.PI * 2) * height * .19, sign = i % 2 ? -1 : 1;
      const length = height * (.34 + .045 * Math.sin(i * 1.7)), leafWidth = Math.min(.17, width / 10 * .95), angle = sign > 0 ? -.53 : Math.PI + .53;
      const leaf = namedGroup(face, `${name}-leaf-${side}-${i}`, { mergeIntoParent: true }); leaf.position.set(x, y, .017); leaf.rotation.z = angle;
      b.add(leaf, b.prototype(`jiuzhou-ruyi-lobed-leaf-${i % 10}`, () => jiuzhouCarvedLeafGeometry({ length, width: leafWidth })), i % 3 ? b.m.greenWood : b.m.red);
      b.tube(leaf, b.m.gold, [[0, .016, .021], [.023, length * .45, .058], [.015, length * .82, .057]], .0045, 16, 6);
      const branch = [V(x, y, 0), V(x + sign * .055, y + sign * .072, .010), V(x + sign * .065, y + sign * .14, .018)]; b.tube(face, b.m.greenWood, branch, .014, 20, 10);
    }
    for (const sign of [-1, 1]) {
      const curl = [];
      for (let i = 0; i <= 48; i++) { const t = i / 48, a = t * Math.PI * 2.16, radius = height * .23 * (1 - t * .79); curl.push(V(sign * (width * .29 + Math.cos(a) * radius), height * .40 + Math.sin(a) * radius, .026)); }
      b.tube(face, b.m.greenWood, curl, .023, 62, 14);
    }
  }
  for (const [y, h] of [[.025, .075], [height - .020, .076]]) b.woodBox(group, [0, y, 0], [width + .02, h, .15], b.m.greenWood);
  return group;
}

function ruyiRail(b, parent, name, length, floor) {
  const group = namedGroup(parent, name, { body: 'post-framed-pierced-wood-bridge-railing', panelHeight: .624, memberProportionsInferred: true });
  const bays = 8, pitch = length / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -length / 2 + i * pitch;
    b.woodBox(group, [x, floor + .55, 0], [.145, 1.10, .16], b.m.greenWood);
    b.lathe(group, b.m.greenWood, [[0, 0], [.102, 0], [.11, .045], [.078, .095], [.053, .15], [0, .18]], [x, floor + 1.08, 0], 24);
    for (const y of [.08, .22]) b.woodBox(group, [x, floor + y, 0], [.22, .10, .23], b.m.greenWood);
  }
  for (let i = 0; i < bays; i++) {
    const x = -length / 2 + (i + .5) * pitch, panel = carvedFoliagePanel(b, group, `${name}-panel-${i + 1}`, pitch - .14, .624); panel.position.set(x, floor + .25, 0);
    b.woodBox(group, [x, floor + .975, 0], [pitch + .014, .11, .19], b.m.greenWood);
  }
  return group;
}

export function buildJiuzhouRuyiBridge(b, parent) {
  const group = namedGroup(parent, 'jiuzhou-ruyi-bridge', { body: 'documented-stone-beam-and-removable-wood-plank-bridge', originalBridgePeriod: 'post-1744 form used in late study', exactWorldLocationRecovered: false, spanEvidence: 'He lower pp45–48; surviving-stone study and Yangshi Lei 004-1,006-2,006-3', clearSpan: 5.44, abutmentLength: 3.84, plankThickness: .096, inferredDeckWidth: 4.32 }); group.position.set(88.20, 0, 33.50);
  const span = 5.44, abut = 3.84, total = span + abut * 2, width = 4.32, top = .34;
  const piers = namedGroup(group, 'jiuzhou-ruyi-stone-abutments', { body: 'stone-abutments-with-clear-single-channel-between' });
  for (const side of [-1, 1]) {
    const z = side * (span / 2 + abut / 2);
    b.box(piers, b.m.foundation, [0, -1.28, z], [width + .90, 2.74, abut]);
    b.box(piers, b.m.stone, [0, .105, z], [width + .60, .23, abut]);
    jiuzhouPlatform(b, piers, `jiuzhou-ruyi-abutment-apron-${side}`, width + .24, abut, top, { bottom: -.15, tilePitch: .48 }).position.z = z;
    for (const face of [-1, 1]) {
      const carving = namedGroup(piers, `jiuzhou-ruyi-stone-cloud-${side}-${face}`, { body: 'raised-ruyi-cloud-outline-on-dressed-stone-side', exactCloudOutlineInferred: true }); carving.position.set(face * (width / 2 + .47), -.20, z); carving.rotation.y = face * Math.PI / 2;
      b.box(carving, b.m.stone, [0, 0, -.06], [abut - .10, .80, .14]);
      for (const hand of [-1, 1]) {
        const path = [];
        for (let i = 0; i <= 56; i++) { const t = i / 56, a = t * Math.PI * 2.10, radius = .27 * (1 - t * .73); path.push(V(hand * (.85 + Math.cos(a) * radius), Math.sin(a) * radius, .052)); }
        b.tube(carving, b.m.carving, path, .044, 76, 16);
      }
      b.tube(carving, b.m.carving, [[-1.10, -.20, .052], [-.45, -.22, .052], [0, -.07, .052], [.45, -.22, .052], [1.10, -.20, .052]], .043, 64, 16);
    }
  }
  const beams = namedGroup(group, 'jiuzhou-ruyi-long-stone-beams', { body: 'stone-beams-bearing-the-removable-bridge-planks', exactIntermediateBeamArrangementRecovered: false });
  for (const x of [-2.06, 2.06]) b.box(beams, b.m.stone, [x, top - .096 - .21, 0], [.45, .42, span + .30]);
  for (const z of [-2.66, -.88, .88, 2.66]) b.box(beams, b.m.stone, [0, top - .096 - .21, z], [width + .18, .42, .31]);
  const deck = namedGroup(group, 'jiuzhou-ruyi-removable-wood-deck', { body: 'separate-17-chi-planks-with-woodgrain-and-two-lifting-rings', plankThickness: .096 });
  const count = 15, plankW = width / count;
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + (i + .5) * plankW;
    b.woodBox(deck, [x, top - .048, 0], [plankW - .006, .096, span], b.m.darkWood);
    for (const z of [-span * .30, span * .30]) {
      b.add(deck, b.prototype('jiuzhou-deck-lifting-ring', () => new THREE.TorusGeometry(.039, .005, 8, 24)), b.m.darkWood, [x, top + .004, z], undefined, [-Math.PI / 2, 0, 0]);
      for (const dz of [-.038, .038]) b.box(deck, b.m.darkWood, [x, top + .003, z + dz], [.025, .009, .030]);
    }
  }
  for (const side of [-1, 1]) {
    const rail = ruyiRail(b, group, `jiuzhou-ruyi-carved-wood-rail-${side}`, total, top); rail.position.x = side * (width / 2 + .08); rail.rotation.y = Math.PI / 2;
    jiuzhouSteps(b, group, `jiuzhou-ruyi-end-steps-${side}`, { frontZ: total / 2 + .64, width: 3.85, toY: top, run: .64, reverse: side < 0 });
  }
  b.walkways.push({ id: 'jiuzhou-ruyi-bridge-deck', from: [88.20, 33.50 - total / 2], to: [88.20, 33.50 + total / 2], clearWidth: 4.10, floorStart: top, floorEnd: top, sourceMeasuredSpan: span });
  b.flush(); return group;
}

export function buildJiuzhouExternalLandings(b, parent) {
  const group = namedGroup(parent, 'jiuzhou-external-route-landings', { body: 'landings-at-documented-island-connections', unmodelledBridgeSuperstructures: true });
  for (const [id, x, z, w, d] of [['nanda', -69.40, 35.80, 4.40, 3.20], ['northwest-zongting', -94.0, -36.0, 3.8, 3.0], ['northeast', 85.40, -21.20, 3.4, 3.0], ['southwest-three-span', -94.2, 18.3, 3.6, 3.0], ['ruyi-south', 88.20, 41.9, 5.1, 2.50]]) {
    const node = jiuzhouPlatform(b, group, `jiuzhou-landing-${id}`, w, d, .054, { bottom: -2.65 }); node.position.set(x, 0, z);
    node.userData.evidenceLimit = id === 'ruyi-south' ? 'authored support at the study boundary; adjoining mainland terrain is external' : 'documented connection retained as a landing; bridge form and exact surveyed dimensions are not reconstructed in this asset';
  }
  b.flush(); return group;
}
