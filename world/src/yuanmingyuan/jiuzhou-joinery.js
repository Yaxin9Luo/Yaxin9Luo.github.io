import * as THREE from 'three';
import { namedGroup } from './study-geometry.js';
import { jiuzhouPlan, QING_CHI_METRES } from './jiuzhou-layout.js';

function mouldedFrame(b, parent, width, height, centerY, depth = .085) {
  const rim = .063;
  for (const x of [-1, 1]) {
    b.woodBox(parent, [x * (width - rim) / 2, centerY, 0], [rim, height, depth]);
    b.woodBox(parent, [x * (width / 2 - rim - .008), centerY, .034], [.016, height - rim, .020], b.m.greenWood);
  }
  for (const y of [-1, 1]) {
    b.woodBox(parent, [0, centerY + y * (height - rim) / 2, 0], [width - rim * 2, rim, depth]);
    b.woodBox(parent, [0, centerY + y * (height / 2 - rim - .008), .034], [width - rim * 2, .016, .020], b.m.greenWood);
  }
}

// Orthogonal pierced wood, derived as a motif family from the inspected
// zhizhai-window comparison. It is not a photograph pasted onto a solid pane.
export function jiuzhouLattice(b, parent, name, { width, height, y = 0, lining = 'paper' }) {
  const group = namedGroup(parent, name, { body: 'pierced-stepped-square-wood-lattice', exactPatternRecovered: false, mergeIntoParent: true });
  mouldedFrame(b, group, width, height, y);
  const clearW = width - .17, clearH = height - .17, w = clearW / 2, h = clearH / 2, stick = .018;
  const bar = (a, c, z = .009) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], length = Math.hypot(dx, dy);
    if (length < .004) return;
    b.woodBox(group, [(a[0] + c[0]) / 2, y + (a[1] + c[1]) / 2, z], [length + stick * .25, stick, .035], b.m.windowWood, [0, 0, Math.atan2(dy, dx)]);
  };
  const path = points => { for (let i = 1; i < points.length; i++) bar(points[i - 1], points[i]); };
  for (const sideX of [-1, 1]) for (const sideY of [-1, 1]) {
    const p = (x, z) => [x * w * sideX, z * h * sideY];
    path([p(0, 1), p(.80, 1), p(.80, .42), p(.27, .42), p(.27, .80), p(.56, .80), p(.56, .62)]);
    path([p(1, 0), p(1, .80), p(.64, .80)]);
    path([p(0, .23), p(.23, .23), p(.23, 0)]);
  }
  const centerW = clearW * .28, centerH = clearH * .28;
  mouldedFrame(b, group, centerW, centerH, y, .037);
  if (lining) b.add(group, new THREE.PlaneGeometry(width - .10, height - .10), lining === 'glass' ? b.m.glass : b.m.paper, [0, y, -.030], undefined, undefined, true);
  return group;
}

function glassPane(b, parent, name, width, height, x, y, z = -.012) {
  const group = namedGroup(parent, name, { body: 'separate-glass-pane-with-wooden-frame', mergeIntoParent: true }); group.position.set(x, y, z);
  mouldedFrame(b, group, width + .055, height + .055, 0, .066);
  b.add(group, new THREE.PlaneGeometry(width, height), b.m.glass, [0, 0, -.024], undefined, undefined, true);
  return group;
}

export function jiuzhouZhizhaiWindow(b, parent, name, { kind = 'ordinary', width = 3.26, floor = 0, rear = false, falseWindow = false } = {}) {
  const group = namedGroup(parent, name, { body: falseWindow ? 'false-zhizhai-on-retained-wall' : 'framed-zhizhai-window', source: 'He Yan middle p40, dated 1855 and 1859 alterations', kind, exactSillLevelRecovered: false });
  group.position.y = floor;
  const sill = .75, upperY = 2.45, upperH = .928, transomH = .829;
  b.box(group, b.m.brick, [0, .34, -.05], [width + .12, .75, .27]);
  for (const y of [.74, 4.30]) b.woodBox(group, [0, y, 0], [width + .14, .115, .15]);
  for (const side of [-1, 1]) b.woodBox(group, [side * (width + .06) / 2, 2.51, 0], [.11, 3.58, .13]);
  if (falseWindow) b.box(group, b.m.brick, [0, 2.52, -.105], [width + .03, 3.49, .18]);
  const transom = !rear;
  if (kind === 'east-inner-single-square') {
    const source = jiuzhouPlan.measuredControls.jiuzhouHall.lateJoinery.frontWindowsWestToEast[2], outer = source.frameSizeChi[0] * QING_CHI_METRES, glass = source.paneSizeChi[0] * QING_CHI_METRES;
    glassPane(b, group, `${name}-documented-one-square-glass`, glass, glass, 0, sill + outer / 2, -.057);
    const leafW = (outer - .045) / 3, halfH = (outer - .045) / 2;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const leaf = jiuzhouLattice(b, group, `${name}-removable-${row}-${col}`, { width: leafW - .008, height: halfH - .014, y: sill + halfH * (row + .5), lining: null }); leaf.position.x = (col - 1) * leafW; leaf.position.z = .061;
    }
    for (const x of [-outer / 6, outer / 6]) b.woodBox(group, [x, sill + outer / 2, .086], [.030, outer, .039]);
    // The large removable square is surrounded by wood, not unexplained
    // full-height slots beside and above the reported glass frame.
    const sideWidth = (width - outer) / 2;
    for (const side of [-1, 1]) {
      b.woodBox(group, [side * (outer / 2 + sideWidth / 2), sill + outer / 2, -.012], [sideWidth + .012, outer, .075]);
      mouldedFrame(b, group, width, outer, sill + outer / 2);
    }
    b.woodBox(group, [0, (sill + outer + 3.42) / 2, -.012], [width, 3.42 - sill - outer + .018, .075]);
  } else {
    let panes = 3, paneW = .5952, paneH = .912, fieldHeight = 1.32, fieldBottom = sill;
    if (kind === 'west-end-two-panes') { panes = 2; paneW = 1.151; paneH = 1.345; fieldHeight = 1.5232; }
    if (kind === 'rear-west-two-panes') { panes = 2; paneW = paneH = 1.392; fieldHeight = 1.616; }
    if (kind === 'rear-east-two-panes') { panes = 2; paneW = 1.1552; paneH = 1.344; fieldHeight = 1.504; }
    const pitch = panes === 2 ? paneW + .089 : width / 3;
    const fieldWidth = kind === 'west-end-two-panes' ? 8.04 * QING_CHI_METRES : kind === 'rear-west-two-panes' ? 9.25 * QING_CHI_METRES : panes * pitch;
    if (kind !== 'ordinary' && fieldWidth < width) {
      for (const side of [-1, 1]) b.woodBox(group, [side * (width + fieldWidth) / 4, fieldBottom + fieldHeight / 2, -.02], [(width - fieldWidth) / 2 + .012, fieldHeight, .077]);
      mouldedFrame(b, group, fieldWidth, fieldHeight, fieldBottom + fieldHeight / 2);
    }
    const field = namedGroup(group, `${name}-lower-glass-field`, { body: 'documented-distinct-glass-subdivision', paneCount: kind === 'ordinary' ? 0 : panes, mergeIntoParent: true });
    for (let i = 0; i < panes; i++) {
      const x = (i - (panes - 1) / 2) * pitch;
      if (kind === 'ordinary') {
        const leaf = jiuzhouLattice(b, field, `${name}-lower-leaf-${i}`, { width: pitch - .02, height: fieldHeight, y: fieldBottom + fieldHeight / 2, lining: falseWindow ? null : 'paper' }); leaf.position.x = x;
      } else {
        const frame = namedGroup(field, `${name}-glass-leaf-${i}`, { body: 'glazed-lower-wood-leaf', mergeIntoParent: true }); frame.position.x = x;
        mouldedFrame(b, frame, panes === 2 ? paneW + .089 : pitch - .018, fieldHeight, fieldBottom + fieldHeight / 2);
        glassPane(b, frame, `${name}-historic-pane-${i}`, paneW, paneH, 0, fieldBottom + fieldHeight / 2);
      }
    }
    const upperStart = rear ? fieldBottom + fieldHeight + .10 : upperY, leafHeight = rear ? 4.20 - upperStart : upperH;
    const lowerTop = fieldBottom + fieldHeight;
    if (upperStart > lowerTop) b.woodBox(group, [0, (upperStart + lowerTop) / 2, 0], [width, upperStart - lowerTop + .014, .105]);
    for (let i = 0; i < 3; i++) {
      const leaf = jiuzhouLattice(b, group, `${name}-upper-${i}`, { width: width / 3 - .015, height: leafHeight, y: upperStart + leafHeight / 2, lining: falseWindow ? null : 'paper' }); leaf.position.x = (i - 1) * width / 3;
    }
    if (kind === 'rear-east-two-panes') for (const x of [-width / 6, width / 6]) b.woodBox(group, [x, fieldBottom + fieldHeight / 2, .075], [.030, fieldHeight, .032]);
  }
  if (transom) {
    b.woodBox(group, [0, 3.401, 0], [width, .074, .105]);
    for (let i = 0; i < 3; i++) {
    const leaf = jiuzhouLattice(b, group, `${name}-transom-${i}`, { width: width / 3 - .015, height: transomH, y: 3.42 + transomH / 2, lining: falseWindow ? null : 'paper' }); leaf.position.x = (i - 1) * width / 3;
    }
  }
  return group;
}

function doorLeaf(b, parent, name, width, height, x, angle, pivotSide = 1) {
  const group = namedGroup(parent, name, { body: 'solid-panel-and-open-lattice-door-leaf', mergeIntoParent: true }); group.position.x = x; group.rotation.y = angle;
  const center = pivotSide * width / 2;
  const assembly = namedGroup(group, `${name}-woodwork`, { mergeIntoParent: true }); assembly.position.x = center;
  mouldedFrame(b, assembly, width, height, height / 2, .11);
  for (const y of [.22, .64, 1.09]) {
    b.woodBox(assembly, [0, y, 0], [width - .14, .35, .065]);
    mouldedFrame(b, assembly, width - .21, .265, y, .093);
  }
  jiuzhouLattice(b, assembly, `${name}-upper-lattice`, { width: width - .085, height: height - 1.37, y: (height + 1.28) / 2, lining: 'paper' });
  for (const y of [.36, height - .4]) b.rod(group, b.m.darkWood, [0, y - .11, -.025], [0, y + .11, -.025], .032, 16);
  b.add(assembly, b.prototype('jiuzhou-door-handle-ring', () => new THREE.TorusGeometry(.052, .008, 8, 24)), b.m.gold, [-pivotSide * (width / 2 - .14), 1.22, .071]);
  return group;
}

export function jiuzhouDoorway(b, parent, name, { width = 3.67, height = 4.24, leaves = 4, open = true, floor = 0, transom = false } = {}) {
  const group = namedGroup(parent, name, { body: 'usable-multi-leaf-doorway', leaves, centralLeavesOpen: open }); group.position.y = floor;
  for (const side of [-1, 1]) b.woodBox(group, [side * (width + .06) / 2, height / 2, 0], [.12, height + .07, .19]);
  b.woodBox(group, [0, height + .035, 0], [width + .24, .16, .22]);
  b.woodBox(group, [0, .035, 0], [width + .12, .07, .19]);
  const leafW = (width - .07) / leaves;
  const doorHeight = height - (transom ? .89 : 0);
  if (transom) {
    b.woodBox(group, [0, doorHeight + .035, 0], [width, .10, .14]);
    for (let i = 0; i < 3; i++) {
      const light = jiuzhouLattice(b, group, `${name}-transom-${i + 1}`, { width: width / 3 - .014, height: .74, y: height - .42 }); light.position.x = (i - 1) * width / 3;
    }
  }
  for (let i = 0; i < leaves; i++) {
    const left = -width / 2 + .035 + i * leafW, innerLeft = i === Math.floor(leaves / 2) - 1, innerRight = i === Math.floor(leaves / 2);
    const hingeRight = innerRight, angle = open && (innerLeft || innerRight) ? (innerLeft ? 1 : -1) * Math.PI * .43 : 0;
    doorLeaf(b, group, `${name}-leaf-${i + 1}`, leafW - .01, doorHeight - .08, hingeRight ? left + leafW : left, angle, hingeRight ? -1 : 1);
  }
  return group;
}

export function jiuzhouNineHallFacade(b, parent, { floor = .704, rear = false } = {}) {
  const name = rear ? 'jiuzhou-qingyan-rear-zhizhai-facade' : 'jiuzhou-qingyan-front-zhizhai-facade';
  const group = namedGroup(parent, name, { body: 'dated-1859-60-joinery-arrangement', windowPlane: 'inner-column-line', publishedArchiveReadings: true, sillAndUnspecifiedFrameDetailsInferred: true });
  group.position.z = rear ? -9.60 : 3.84; if (rear) group.rotation.y = Math.PI;
  if (rear) {
    // The rear inner line is glazed, not an invented north doorway. Access to
    // the water-side porch is provided by the real external side circulation.
    for (const [x, kind] of [[-4.0, 'rear-east-two-panes'], [0, 'ordinary'], [4.0, 'rear-west-two-panes']]) {
      const window = jiuzhouZhizhaiWindow(b, group, `${name}-${kind}`, { width: x === 0 ? 3.61 : 3.26, floor, rear: true, kind }); window.position.x = x;
    }
  } else {
    jiuzhouDoorway(b, group, `${name}-four-leaf-door`, { width: 3.70, floor, transom: true });
    for (const [x, kind] of [[-7.84, 'west-end-two-panes'], [-4, 'three-small-panes'], [4, 'east-inner-single-square'], [7.84, 'three-small-panes']]) {
      const window = jiuzhouZhizhaiWindow(b, group, `${name}-${x}`, { width: 3.27, floor, kind }); window.position.x = x;
    }
  }
  return group;
}
