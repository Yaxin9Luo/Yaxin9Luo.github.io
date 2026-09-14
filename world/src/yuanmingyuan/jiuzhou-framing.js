import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { jiuzhouRoofSectionPoint, juanpengSegmentPoint } from './jiuzhou-roof-geometry.js';
import { jiuzhouColumn, jiuzhouPaintedBeam } from './jiuzhou-architecture.js';

// The height of the actual authored roof patches, used to place the frame.
// Tests intersect the resulting triangle meshes independently of this helper.
export function jiuzhouRoofHeightAt({ section, width, depth, xieshan = false, cornerLift = .20, joined = false, centralHalf = 0, upperWidth = null }, x, z) {
  if (joined && Math.abs(x) <= 5.92 && z >= section.segments[0].points[0].x && z <= 7.04) return jiuzhouRoofSectionPoint(section, z).y;
  const first = section.segments[0].points[0].x, last = section.segments.at(-1).points[3].x;
  if (!xieshan) return Math.abs(x) <= width / 2 && z >= first && z <= last ? jiuzhouRoofSectionPoint(section, z).y : null;
  const halfD = depth / 2, halfW = width / 2, upper = upperWidth === null ? halfW - depth * .19 : upperWidth / 2, breakZ = halfD * .55, az = Math.abs(z), ax = Math.abs(x);
  if (az > halfD || ax > halfW) return null;
  if (ax <= upper && az <= breakZ) return jiuzhouRoofSectionPoint(section, z).y;
  const alongZ = THREE.MathUtils.clamp((halfD - az) / (halfD - breakZ), 0, 1), sideX = THREE.MathUtils.clamp((halfW - ax) / (halfW - upper), 0, 1);
  if (alongZ < sideX) {
    const hx = THREE.MathUtils.lerp(halfW, upper, alongZ), t = Math.max(0, (ax - centralHalf) / (hx - centralHalf));
    return jiuzhouRoofSectionPoint(section, z).y + cornerLift * (1 - alongZ) ** 2 * t ** 6;
  }
  const hz = THREE.MathUtils.lerp(halfD, breakZ, sideX);
  return jiuzhouRoofSectionPoint(section, hz).y + cornerLift * (1 - sideX) ** 2 * (z / hz) ** 6;
}

export function jiuzhouJoinedHeightAt(joinedSection, mainSection, x, z) {
  if (Math.abs(x) <= 5.92 && z >= -12.8 && z <= 7.04) return jiuzhouRoofSectionPoint(joinedSection, z).y;
  return jiuzhouRoofHeightAt({ section: mainSection, width: 22.08, depth: 14.08, upperWidth: 16.448, xieshan: true, cornerLift: .24, centralHalf: 5.92 }, x, z);
}

function gradient(heightAt, x, z) {
  const c = heightAt(x, z), dx = .018;
  const nx = heightAt(x - dx, z), px = heightAt(x + dx, z), nz = heightAt(x, z - dx), pz = heightAt(x, z + dx);
  const sx = nx !== null && px !== null ? (px - nx) / (dx * 2) : nx !== null ? (c - nx) / dx : px !== null ? (px - c) / dx : 0;
  const sz = nz !== null && pz !== null ? (pz - nz) / (dx * 2) : nz !== null ? (c - nz) / dx : pz !== null ? (pz - c) / dx : 0;
  return V(-sx, 1, -sz).normalize();
}

export function jiuzhouRafters(b, parent, name, { section, width, heightAt, pitch = .43, radius = .065, rear = false }) {
  const group = namedGroup(parent, name, { body: 'separate-curved-round-rafters-under-the-real-roof-skin', verticalSkinThickness: .18, radialClearance: .016, surveyedProfile: false });
  const count = Math.ceil((width - .38) / pitch), spacing = (width - .38) / count;
  for (let row = 0; row <= count; row++) {
    const x = -width / 2 + .19 + row * spacing;
    for (const segment of section.segments) {
      let points = [];
      const commit = () => {
        if (points.length > 2) b.tube(group, rear ? b.m.greenWood : b.m.red, points, radius, Math.max(12, points.length * 2), 12);
        points = [];
      };
      for (let i = 0; i <= 48; i++) {
        const roof = juanpengSegmentPoint(segment, i / 48, x), h = heightAt(x, roof.z);
        if (h === null || heightAt(x, roof.z - .09) === null || heightAt(x, roof.z + .09) === null) { commit(); continue; }
        // Round rafters need radius/normal.y clearance on steep surfaces.
        // Separate half-slopes do not spline across a valley or crown.
        const normal = gradient(heightAt, x, roof.z);
        points.push(V(x, h - .18 - radius / normal.y - .016, roof.z));
      }
      commit();
    }
  }
  return group;
}

function shapedBeam(b, parent, name, x, fromZ, toZ, top, { height = .32, width = .29, rear = false } = {}) {
  const group = namedGroup(parent, name, { body: 'mortised-transverse-roof-beam', mergeIntoParent: true });
  b.woodBox(group, [x, top - height / 2, (fromZ + toZ) / 2], [width, height, toZ - fromZ + .24], rear ? b.m.greenWood : b.m.red);
  for (const z of [fromZ, toZ]) b.woodBox(group, [x, top - height - .016, z], [width * 1.44, .055, .37], rear ? b.m.greenWood : b.m.red);
  return group;
}

// Actual staged beams, short posts and purlins, following the inspected
// section's construction sequence. Unspecified member sizes are authored.
export function jiuzhouTruss(b, parent, name, { xLines, pairs, roofAt, lowerBearingY, rear = false, purlinHalfWidth, omitPurlinZ = [] }) {
  const group = namedGroup(parent, name, { body: 'raised-beam-frame-with-bearing-short-posts-and-round-purlins', memberDimensionsInferred: true });
  let previousTop = lowerBearingY;
  for (let tier = 0; tier < pairs.length; tier++) {
    const zs = pairs[tier], ys = zs.map(z => roofAt(0, z) - .18 - .065 * 2 - .018 - .16), top = Math.min(...ys) - .16;
    for (const x of xLines) {
      const beamBottom = top - .32;
      if (beamBottom > previousTop) for (const z of zs) {
        b.woodBox(group, [x, (previousTop + beamBottom) / 2, z], [.23, beamBottom - previousTop + .006, .23], rear ? b.m.greenWood : b.m.red);
        b.woodBox(group, [x, previousTop + .025, z], [.43, .05, .38], rear ? b.m.greenWood : b.m.red);
      }
      shapedBeam(b, group, `${name}-beam-${tier}-${x}`, x, zs[0], zs[1], top, { rear });
      for (let j = 0; j < 2; j++) if (ys[j] - .16 > top + .003) b.woodBox(group, [x, (top + ys[j] - .16) / 2, zs[j]], [.23, ys[j] - .16 - top + .012, .23], rear ? b.m.greenWood : b.m.red);
    }
    for (let j = 0; j < 2; j++) {
      if (omitPurlinZ.some(z => Math.abs(z - zs[j]) < .00001)) continue;
      const purlin = namedGroup(group, `${name}-purlin-${tier}-${j}`, { body: 'round-longitudinal-roof-purlin', z: zs[j], radius: .16 });
      b.rod(purlin, rear ? b.m.greenWood : b.m.red, [-purlinHalfWidth, ys[j], zs[j]], [purlinHalfWidth, ys[j], zs[j]], .16, 24);
    }
    previousTop = top;
  }
  return group;
}

export function jiuzhouPostRow(b, parent, name, { xs, z, floor, height, rear = false, radius = .192, beam = true }) {
  const group = namedGroup(parent, name, { body: 'timber-column-row-with-continuous-painted-eave-fang', columnTop: floor + height });
  for (let i = 0; i < xs.length; i++) jiuzhouColumn(b, group, `${name}-post-${i + 1}`, xs[i], z, floor, height, { radius, rear });
  if (beam) for (let i = 0; i + 1 < xs.length; i++) jiuzhouPaintedBeam(b, group, `${name}-fang-${i + 1}`, xs[i + 1] - xs[i], [(xs[i] + xs[i + 1]) / 2, floor + height + .192, z], .384, rear);
  return group;
}

export function jiuzhouEaveBearing(b, parent, name, { xs, z, floor, postHeight, roofAt, rear = false }) {
  const group = namedGroup(parent, name, { body: 'gujing-blocks-and-bearings-on-eave-fang', exactHeightFitInferred: true });
  const y = roofAt(0, z) - .18 - .13 - .018 - .15, bottom = floor + postHeight + .384;
  if (y - .15 > bottom) for (const x of xs) {
    b.woodBox(group, [x, bottom + .04, z], [.48, .08, .37], rear ? b.m.greenWood : b.m.red);
    b.woodBox(group, [x, (bottom + .08 + y - .15) / 2, z], [.29, y - .15 - bottom - .08 + .012, .28], rear ? b.m.greenWood : b.m.red);
  }
  b.rod(group, rear ? b.m.greenWood : b.m.red, [xs[0] - .08, y, z], [xs.at(-1) + .08, y, z], .15, 24);
  return group;
}
