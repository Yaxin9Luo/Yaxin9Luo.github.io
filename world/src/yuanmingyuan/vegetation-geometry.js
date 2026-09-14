import * as THREE from 'three';
import { samplePineBarkRelief } from './vegetation-textures.js';

const TAU = Math.PI * 2, V = (...values) => new THREE.Vector3(...values);
const mix = THREE.MathUtils.lerp;
export function seededGardenRandom(seed = 27183) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

// Smooth, aperiodic noise for broad weathering. Unlike a product of sine waves,
// this has no repeating diamonds aligned with the surface sampling lattice.
export function gardenValueNoise(x, y, z, seed = 17) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const hash = (a, b, c) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647) + Math.imul(seed, 1274126177); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 2147483648 - 1; };
  return mix(mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy), mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}

function finishGeometry(name, positions, indices, colors, uv) {
  const geometry = new THREE.BufferGeometry(); geometry.name = name;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

export function curvedBranchGeometry({ points, radii, radialSegments = 12, segments = 24, bark = .06, barkProfile = null, barkSurface = null, seed = 0, color = '#71685b', name = 'authored-curved-branch' }) {
  if (points.length < 2 || radii.length !== points.length || radii.some(radius => !(radius > 0))) throw new Error('Branches need matching control points and positive radii');
  if (barkProfile && !barkSurface) throw new Error('A plated pine branch needs its PBR-derived relief field');
  const curve = new THREE.CatmullRomCurve3(points.map(point => V(...point)), false, 'centripetal'), frames = curve.computeFrenetFrames(segments, false), curveLength = curve.getLength();
  const positions = [], colors = [], uv = [], indices = [], base = new THREE.Color(color), shadow = new THREE.Color('#444b43'), warm = new THREE.Color('#9c8870');
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, point = curve.getPointAt(t), span = curve.getUtoTmapping(t) * (radii.length - 1), left = Math.min(radii.length - 2, Math.floor(span)), radius = mix(radii[left], radii[left + 1], span - left);
    for (let side = 0; side <= radialSegments; side++) {
      const angle = side / radialSegments * TAU, flute = Math.sin(angle * 9 + t * 3.2 + seed) * .58 + Math.sin(angle * 17 - t * 12) * .23 + Math.sin(t * 75 + angle * 3) * .18;
      const fraction = side / radialSegments, wraps = TAU * radii[0] / 2, u = barkSurface ? fraction * wraps : fraction * 2.8, v = t * curveLength * (barkSurface ? .5 : 1.3);
      // Keep both copies of the UV seam at exactly the same 3D position. The
      // last narrow strip blends relief to the first strip, without taper cracks.
      const edgeBlend = Math.max(0, (fraction - .94) / .06), relief = barkSurface ? mix(samplePineBarkRelief(barkSurface, u, v), samplePineBarkRelief(barkSurface, 0, v), edgeBlend) * Math.min(1, radius / .13) : 0;
      const r = radius * (1 + bark * flute) + relief, normal = frames.normals[row].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[row], Math.sin(angle));
      positions.push(...point.clone().addScaledVector(normal, r).toArray());
      const c = barkSurface ? new THREE.Color().setRGB(1, 1, 1).multiplyScalar(.97 + flute * .025) : base.clone().lerp(shadow, Math.max(0, -flute) * .23).lerp(warm, Math.max(0, flute) * .14); colors.push(...c.toArray()); uv.push(u, v);
    }
  }
  const stride = radialSegments + 1;
  for (let row = 0; row < segments; row++) for (let side = 0; side < radialSegments; side++) { const a = row * stride + side, b = a + stride; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  for (const end of [0, 1]) {
    const centre = positions.length / 3, point = curve.getPointAt(end); positions.push(...point.toArray()); colors.push(...base.toArray()); uv.push(.5, end);
    const offset = end * segments * stride;
    for (let side = 0; side < radialSegments; side++) indices.push(centre, offset + side + (end ? 0 : 1), offset + side + (end ? 1 : 0));
  }
  const geometry = finishGeometry(name, positions, indices, colors, uv); geometry.userData = { body: 'curved-tapered-wood', controlPoints: points, radii, rootContact: points[0], curveLength: curve.getLength(), ...(barkProfile ? { barkProfile, physicalTextureTile: [2, 2], reliefSource: barkSurface.source, measuredBarkDepth: false } : {}) }; return geometry;
}

// Leaf space: petiole at origin, length along +Y, lamina normal approximately +Z.
export function lanceolateLeafGeometry({ length = .135, width = .012, curl = .012, rows = 8, color = '#769b65', name = 'willow-lanceolate-leaf' } = {}) {
  const positions = [], indices = [], colors = [], uv = [], centreColor = new THREE.Color(color), edgeColor = new THREE.Color('#547a5c');
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, half = Math.max(.00003, Math.sin(Math.PI * t) ** .83 * width / 2);
    for (let side = -1; side <= 1; side++) {
      positions.push(side * half * (1 + .025 * Math.sin(t * Math.PI * 12)), t * length, curl * t * t + (1 - Math.abs(side)) * width * .095 * Math.sin(t * Math.PI));
      colors.push(...centreColor.clone().lerp(edgeColor, Math.abs(side) * .40 + t * .07).toArray()); uv.push((side + 1) / 2, t);
    }
  }
  for (let row = 0; row < rows; row++) for (let side = 0; side < 2; side++) { const a = row * 3 + side; indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
  const geometry = finishGeometry(name, positions, indices, colors, uv); geometry.userData = { body: 'curved-lamina', petiole: [0, 0, 0], length, width, tip: [0, length, curl], twoSided: true }; return geometry;
}

export function needleGeometry({ length = .115, bend = .018, width = .0013, color = '#536f56', name = 'pine-curved-needle' } = {}) {
  const positions = [], indices = [], colors = [], uv = [], c = new THREE.Color(color);
  for (let row = 0; row <= 4; row++) {
    const t = row / 4, half = width * (1 - t * .91) / 2;
    positions.push(-half, t * length, Math.sin(t * Math.PI * .65) * bend, half, t * length, Math.sin(t * Math.PI * .65) * bend);
    colors.push(...c.clone().multiplyScalar(.88 + .20 * t).toArray(), ...c.clone().multiplyScalar(.88 + .20 * t).toArray()); uv.push(0, t, 1, t);
  }
  for (let row = 0; row < 4; row++) { const a = row * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  return finishGeometry(name, positions, indices, colors, uv);
}

/** One live pine shoot: woody ramification, five young lateral shoots and paired
 * curved needles. The repeat unit is a small three-dimensional branch system,
 * not a long bottlebrush used to stand in for an entire bough. */
export function pineShootGeometry({ seed = 218, name = 'pine-live-terminal-shoot' } = {}) {
  const rng = seededGardenRandom(seed), batch = new VegetationGeometryBatch(name), needle = needleGeometry({ color: '#68865d' }), up = V(0, 1, 0);
  let fascicles = 0, minNeedleLength = Infinity, maxNeedleLength = 0;
  const branches = [{ points: [[0, 0, 0], [.015, .095, -.012], [.018, .205, .008]], radii: [.007, .0042, .0013], needles: 28 }];
  for (let fork = 0; fork < 5; fork++) {
    const angle = fork * 2.399963 + rng() * .6, start = V(.009, .06 + fork * .019, -.002), out = V(Math.cos(angle), .85 + rng() * .35, Math.sin(angle)).normalize(), end = start.clone().addScaledVector(out, .115 + rng() * .065);
    branches.push({ points: [start.toArray(), start.clone().lerp(end, .5).add(V(0, .008, 0)).toArray(), end.toArray()], radii: [.0031, .0020, .0007], needles: 38 + fork % 3 * 3 });
  }
  for (const branch of branches) {
    const wood = curvedBranchGeometry({ ...branch, radialSegments: 5, segments: 7, bark: .02, color: '#877b53' }); batch.add(wood); wood.dispose();
    const curve = new THREE.CatmullRomCurve3(branch.points.map(point => V(...point)), false, 'centripetal');
    for (let node = 0; node < branch.needles; node++) {
      const t = .20 + node / branch.needles * .78, origin = curve.getPointAt(t), tangent = curve.getTangentAt(t), across = V(1, .1, .3).cross(tangent).normalize(), normal = tangent.clone().cross(across).normalize(), angle = node * 2.399963 + rng() * .21;
      const radial = across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(normal, Math.sin(angle));
      for (const pair of [-1, 1]) {
        const direction = tangent.clone().multiplyScalar(.42 + rng() * .25).addScaledVector(radial, .73).addScaledVector(across, pair * .048).normalize();
        const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction).multiply(new THREE.Quaternion().setFromAxisAngle(up, angle + pair * .18));
        const scale = .73 + rng() * .45, matrix = new THREE.Matrix4().compose(origin.clone().addScaledVector(radial, .0013).addScaledVector(across, pair * .00065), rotation, V(1, scale, .88 + rng() * .25));
        batch.add(needle, matrix, .90 + rng() * .19); minNeedleLength = Math.min(minNeedleLength, scale * .115); maxNeedleLength = Math.max(maxNeedleLength, scale * .115);
      }
      fascicles++;
    }
  }
  needle.dispose(); const geometry = batch.finish(); geometry.userData = { body: 'ramified-pine-shoot-with-paired-needles', branchOrders: 2, woodyShoots: branches.length, fascicles, needles: fascicles * 2, minNeedleLength, maxNeedleLength, needleWidth: .0013 }; return geometry;
}

/** Original, editable botanical alpha texture. Every mark is a tapered scale
 * or awl leaf on a branching shoot; no photograph or generated tree image is
 * embedded. Coordinates are in metres, with the petiole at the lower centre. */
export function juniperSprayTexture({ size = 512, seed = 371 } = {}) {
  const width = .215, height = .295, data = new Uint8Array(size * size * 4), rng = seededGardenRandom(seed), pixelsX = size / width, pixelsY = size / height;
  for (let i = 0; i < size * size; i++) data.set([71, 106, 71, 0], i * 4);
  let scaleLeaves = 0, awlLeaves = 0;
  function stroke(a, b, radius, endRadius, rgb) {
    const ax = (a[0] / width + .5) * size, ay = a[1] * pixelsY, bx = (b[0] / width + .5) * size, by = b[1] * pixelsY, dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
    const r0 = radius * pixelsX, r1 = endRadius * pixelsX, pad = Math.max(r0, r1) + 1;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by) - pad)); y <= Math.min(size - 1, Math.ceil(Math.max(ay, by) + pad)); y++) for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - pad)); x <= Math.min(size - 1, Math.ceil(Math.max(ax, bx) + pad)); x++) {
      const t = Math.max(0, Math.min(1, ((x + .5 - ax) * dx + (y + .5 - ay) * dy) / (lengthSq || 1))), distance = Math.hypot(x + .5 - ax - dx * t, y + .5 - ay - dy * t), opacity = Math.max(0, Math.min(1, mix(r0, r1, t) + .7 - distance));
      if (!opacity) continue;
      const offset = (y * size + x) * 4, previous = data[offset + 3] / 255, alpha = opacity + previous * (1 - opacity), light = 1 + .12 * Math.max(0, 1 - distance / (mix(r0, r1, t) + .2));
      for (let c = 0; c < 3; c++) data[offset + c] = Math.min(255, (rgb[c] * light * opacity + data[offset + c] * previous * (1 - opacity)) / alpha);
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  function leafyAxis(a, b, scale) {
    stroke(a, b, .0012 * scale, .00035, [82, 111, 68]);
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
    const nodes = Math.max(5, Math.floor(length / .0025));
    for (let node = 0; node < nodes; node++) for (const side of [-1, 1]) {
      const t = .07 + (node + rng() * .35) / nodes * .86, p = [mix(a[0], b[0], t), mix(a[1], b[1], t)], juvenile = node % 3 !== 0, len = juvenile ? .006 + rng() * .0048 : .0023 + rng() * .0006, spread = .53 + rng() * .43;
      const dxLeaf = ux * .66 - uy * side * spread, dyLeaf = uy * .66 + ux * side * spread, norm = Math.hypot(dxLeaf, dyLeaf), tip = [p[0] + dxLeaf / norm * len, p[1] + dyLeaf / norm * len];
      const variation = rng() * 20; stroke(p, tip, juvenile ? .00051 : .00055, .00008, [76 + variation, 112 + variation, 72 + variation * .65]);
      if (juvenile) awlLeaves++; else scaleLeaves++;
    }
  }
  const axisPoint = t => [-.012 + .029 * t + .011 * Math.sin(t * 3.5), .012 + t * .24];
  for (let i = 0; i < 12; i++) stroke(axisPoint(i / 12), axisPoint((i + 1) / 12), .0023 * (1 - i / 15), .0023 * (1 - (i + 1) / 15), [103 - i, 111, 69]);
  for (let tier = 0; tier < 19; tier++) {
    const t = .09 + (tier + rng() * .62) / 19 * .83, side = tier % 2 ? -1 : 1, start = axisPoint(t), reach = (.075 - t * .036) * (.70 + rng() * .34), end = [start[0] + side * reach, start[1] + .021 + rng() * .023];
    stroke(start, end, .00135, .00035, [86, 111, 72]);
    for (let fork = 0; fork < 5; fork++) for (const branchSide of [-1, 1]) {
      const t = .15 + (fork + rng() * .45) * .155, anchor = [mix(start[0], end[0], t), mix(start[1], end[1], t)], len = .016 + rng() * .013, direction = side * (.26 + fork * .10) + branchSide * (.30 + rng() * .29);
      const tip = [anchor[0] + direction * len, anchor[1] + len * (.76 + rng() * .24)]; leafyAxis(anchor, tip, .8);
    }
    leafyAxis([mix(start[0], end[0], .67), mix(start[1], end[1], .67)], [end[0] + side * .009, end[1] + .017], .72);
  }
  leafyAxis(axisPoint(.86), axisPoint(1), .72);
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.name = `yuanming-own-juniper-spray-${seed}`; texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  texture.userData = { body: 'authored-branching-scale-and-awl-alpha', physicalWidth: width, physicalHeight: height, scaleLeafLength: [.0023, .0029], awlLeafLength: [.006, .0108], scaleLeaves, awlLeaves, seed, referencePhotographyBundled: false };
  return texture;
}

// Three gently folded shoots meet at their base, forming a volume from all
// directions. Open alpha gaps remain at the level of individual branchlets.
export function juniperSprayCardGeometry({ width = .215, height = .295, seed = 2 } = {}) {
  const positions = [], colors = [], uv = [], indices = [], columns = 4, rows = 7;
  for (let blade = 0; blade < 3; blade++) {
    const yaw = blade * Math.PI / 3 + seed * .17, offset = positions.length / 3;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const t = row / rows, s = column / columns - .5, x = s * width, z = .022 * Math.sin(t * Math.PI) + s * s * .041 + Math.sin(t * 3 + blade) * s * .021;
      positions.push(x * Math.cos(yaw) - z * Math.sin(yaw), t * height, x * Math.sin(yaw) + z * Math.cos(yaw)); colors.push(1, 1, 1); uv.push(column / columns, t);
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) { const a = offset + row * (columns + 1) + column; indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1); }
  }
  const geometry = finishGeometry('juniper-three-dimensional-foliage-spray', positions, indices, colors, uv); geometry.userData = { body: 'three-curved-alpha-branchlets', planes: 3, physicalWidth: width, physicalHeight: height, transparentGaps: 'individual-branchlets-and-leaves' }; return geometry;
}

export function lotusLeafHeight(radiusFraction, angle, bowl = .11, seed = 0) {
  return bowl * radiusFraction ** 1.5 + Math.sin(angle * 7 + seed) * .034 * radiusFraction ** 5 + Math.sin(angle * 13 + seed * .7) * .009 * radiusFraction ** 2;
}

export function lotusLeafGeometry({ radius = .64, bowl = .11, radialSegments = 96, rings = 14, seed = .3, name = 'lotus-peltate-leaf' } = {}) {
  const positions = [0, 0, 0], indices = [], uv = [.5, .5], green = new THREE.Color('#54846c'), vein = new THREE.Color('#90a475'), colors = vein.toArray();
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings;
    for (let i = 0; i < radialSegments; i++) {
      const angle = i / radialSegments * TAU, edge = 1 + .015 * Math.sin(angle * 9 + seed) + .011 * Math.sin(angle * 17 - seed), rr = r * radius * edge;
      positions.push(Math.cos(angle) * rr, lotusLeafHeight(r, angle, bowl, seed), Math.sin(angle) * rr); uv.push(.5 + Math.cos(angle) * r / 2, .5 + Math.sin(angle) * r / 2);
      const c = green.clone().lerp(vein, Math.max(0, Math.cos(angle * 13)) ** 18 * .18 + (1 - r) * .22); colors.push(...c.toArray());
    }
  }
  for (let i = 0; i < radialSegments; i++) indices.push(0, 1 + (i + 1) % radialSegments, 1 + i);
  for (let ring = 0; ring < rings - 1; ring++) for (let i = 0; i < radialSegments; i++) {
    const a = 1 + ring * radialSegments + i, b = 1 + ring * radialSegments + (i + 1) % radialSegments, c = a + radialSegments, d = b + radialSegments; indices.push(a, b, c, b, d, c);
  }
  const geometry = finishGeometry(name, positions, indices, colors, uv); geometry.userData = { body: 'entire-peltate-lotus-leaf', petioleAttachment: [0, 0, 0], radius, bowl, seed, hasWaterlilyNotch: false }; return geometry;
}

export function lotusPetalGeometry({ length = .40, width = .17, lift = .16, tip = .14, white = false, rows = 18, name = 'lotus-curled-petal' } = {}) {
  const positions = [], indices = [], colors = [], uv = [], base = new THREE.Color(white ? '#f3ead2' : '#f3e7dc'), pink = new THREE.Color(white ? '#e4dec5' : '#ce8094');
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, half = Math.max(.00002, width / 2 * Math.sin(Math.PI * t) ** .70);
    for (let column = 0; column <= 4; column++) {
      const side = column / 2 - 1;
      const cup = lift * (1 - Math.cos(t * Math.PI * .72)) + tip * t ** 3;
      positions.push(side * half, cup + side * side * width * .23 * Math.sin(t * Math.PI), length * Math.sin(t * Math.PI * .43));
      colors.push(...base.clone().lerp(pink, Math.min(1, t ** 3 * .68 + Math.abs(side) * .13 + Math.sin(column * 1.7 + t * 7) * .015)).toArray()); uv.push(column / 4, t);
    }
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < 4; column++) { const a = row * 5 + column; indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
  return finishGeometry(name, positions, indices, colors, uv);
}

// An overlapping section of the closed bud envelope, growing from the stalk
// and converging at the apex. Adjacent sections meet before the tip.
export function lotusBudPetalGeometry({ height = .29, radius = .087, rows = 18, name = 'lotus-closed-bud-petal' } = {}) {
  const positions = [], indices = [], colors = [], uv = [], green = new THREE.Color('#92a37a'), ivory = new THREE.Color('#e1c9ba'), pink = new THREE.Color('#c38293');
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, r = Math.max(.00003, radius * Math.sin(Math.PI * t) ** .78 * (1 - .22 * t));
    for (let column = 0; column <= 4; column++) {
      const side = column / 2 - 1, angle = side * .47;
      positions.push(Math.sin(angle) * r, height * t, Math.cos(angle) * r + Math.sin(Math.PI * t) * .002 * (1 - side * side));
      colors.push(...green.clone().lerp(ivory, Math.min(1, t * 2.4)).lerp(pink, Math.max(0, (t - .42) / .58) * .75).toArray()); uv.push(column / 4, t);
    }
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < 4; column++) { const a = row * 5 + column; indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5); }
  const geometry = finishGeometry(name, positions, indices, colors, uv); geometry.userData = { body: 'closed-bud-envelope-section', petiole: [0, 0, 0], height, radius }; return geometry;
}

// Single pole vertices avoid the zero-area triangles generated by revolving
// an entire radius-zero row. This is the physical centre of each open flower.
export function lotusReceptacleGeometry({ radialSegments = 48, name = 'lotus-seed-receptacle' } = {}) {
  const profile = [[.055, .045], [.089, .108], [.087, .128], [.068, .135]], positions = [0, .035, 0], uv = [.5, 0], indices = [], color = new THREE.Color('#c6ba64'), colors = color.toArray();
  for (let ring = 0; ring < profile.length; ring++) for (let side = 0; side < radialSegments; side++) {
    const angle = side / radialSegments * TAU, [radius, y] = profile[ring]; positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius); uv.push(side / radialSegments, (ring + 1) / (profile.length + 1)); colors.push(...color.clone().multiplyScalar(.93 + ring * .023).toArray());
  }
  const top = positions.length / 3; positions.push(0, .138, 0); uv.push(.5, 1); colors.push(...color.toArray());
  for (let side = 0; side < radialSegments; side++) {
    const next = (side + 1) % radialSegments; indices.push(0, 1 + side, 1 + next);
    for (let ring = 0; ring < profile.length - 1; ring++) { const a = 1 + ring * radialSegments + side, b = 1 + ring * radialSegments + next, c = a + radialSegments, d = b + radialSegments; indices.push(a, c, b, b, c, d); }
    const end = 1 + (profile.length - 1) * radialSegments; indices.push(top, end + next, end + side);
  }
  const geometry = finishGeometry(name, positions, indices, colors, uv); geometry.userData = { body: 'closed-lotus-receptacle', poleVertices: 'single-bottom-and-top' }; return geometry;
}

function smoothMinimum(a, b, amount = .16) { if (!Number.isFinite(a)) return b; const h = Math.max(0, Math.min(1, .5 + .5 * (b - a) / amount)); return mix(b, a, h) - amount * h * (1 - h); }
const smoothMaximum = (a, b, amount) => -smoothMinimum(-a, -b, amount);

// Narrow folded ribs and thin connecting webs define the stone before any
// surface erosion. Apertures emerge between these differently oriented ribs;
// they are not circular punches through one broad slab.
const stoneRibs = [
  { points: [[0, -.07, 0], [-.18, .42, .04], [-.53, .98, .14], [-.38, 1.43, .11], [-.08, 1.96, -.04], [-.31, 2.60, -.10], [-.57, 3.25, -.08], [-.38, 4.05, -.01]], radii: [.40, .35, .26, .24, .27, .27, .31, .14], flat: .69, twist: .29 },
  { points: [[.07, -.03, -.05], [.30, .58, -.24], [.65, 1.12, -.12], [.44, 1.77, .12], [.59, 2.34, .26], [.20, 2.97, .20], [.46, 3.57, .13], [.24, 4.22, .12]], radii: [.35, .24, .23, .22, .28, .20, .26, .13], flat: .66, twist: -.31 },
  { points: [[-.05, .08, -.02], [-.29, .79, -.37], [-.08, 1.57, -.45], [.02, 2.18, -.37], [-.28, 2.83, -.34], [-.52, 3.31, -.15]], radii: [.31, .17, .20, .16, .20, .18], flat: .74, twist: .73 },
  { points: [[-.47, 1.02, .16], [-.28, 1.39, .26], [.01, 1.66, .28], [.43, 1.81, .15]], radii: [.17, .16, .19, .18], flat: .57, twist: -.36 },
  { points: [[-.13, 1.51, -.43], [-.33, 1.74, -.19], [-.07, 1.95, -.02]], radii: [.15, .13, .16], flat: .60, twist: .17 },
  { points: [[.52, 2.29, .24], [.04, 2.68, .28], [-.44, 2.75, -.03]], radii: [.19, .14, .24], flat: .52, twist: .82 },
  { points: [[.01, 2.17, -.34], [.48, 2.38, -.13], [.58, 2.34, .22]], radii: [.14, .18, .17], flat: .63, twist: .15 },
  { points: [[-.42, 2.83, -.10], [-.88, 3.05, .11], [-1.03, 3.44, .20], [-.88, 3.67, .16]], radii: [.24, .29, .24, .09], flat: .56, twist: -.46 },
  { points: [[-.89, 3.13, .12], [-.46, 3.40, .25], [-.02, 3.53, .20], [.40, 3.60, .12]], radii: [.18, .16, .17, .20], flat: .57, twist: .29 },
  { points: [[.39, 3.48, .13], [.77, 3.62, -.05], [.81, 3.93, -.10]], radii: [.19, .24, .10], flat: .52, twist: .57 },
  { points: [[-.53, 3.27, -.10], [-.31, 3.64, -.20], [.05, 3.84, -.13], [.29, 4.05, .10]], radii: [.18, .16, .16, .16], flat: .56, twist: -.59 },
  { points: [[-.25, .56, .06], [-.48, .62, .29], [-.62, .87, .32]], radii: [.20, .15, .10], flat: .68, twist: .13 },
];
const stoneGullies = [
  { points: [[-.12, .12, .30], [-.26, .49, .29], [-.48, .84, .30], [-.41, 1.14, .30], [-.23, 1.43, .33], [.09, 1.71, .35], [.25, 1.81, .31]], radii: [.072, .063, .097, .071, .077, .064, .082], flat: .72, twist: .1 },
  { points: [[.33, .57, -.39], [.46, .85, -.29], [.72, 1.09, -.18], [.55, 1.48, -.01], [.43, 1.75, .26], [.52, 2.05, .34], [.67, 2.38, .40]], radii: [.060, .068, .074, .055, .079, .059, .084], flat: .80, twist: .51 },
  { points: [[-.20, 2.34, .07], [-.37, 2.59, .08], [-.60, 2.85, .09], [-.79, 3.10, .29], [-.85, 3.40, .30], [-.91, 3.66, .22]], radii: [.060, .085, .055, .091, .061, .060], flat: .70, twist: -.46 },
  { points: [[-.80, 3.17, .29], [-.48, 3.42, .36], [-.12, 3.52, .30], [.15, 3.64, .25], [.34, 3.83, .26]], radii: [.057, .078, .054, .073, .052], flat: .82, twist: .63 },
  { points: [[.57, 3.42, .07], [.69, 3.66, .13], [.79, 3.92, -.06]], radii: [.060, .075, .047], flat: .83, twist: -.67 },
  { points: [[-.08, .30, -.31], [-.28, .79, -.51], [-.17, 1.31, -.59], [-.07, 1.57, -.60], [.18, 2.04, -.50]], radii: [.057, .064, .072, .059, .083], flat: .69, twist: .71 },
  { points: [[.21, 2.25, -.48], [-.01, 2.46, -.49], [-.28, 2.82, -.48], [-.51, 3.17, -.30], [-.30, 3.58, -.33], [.00, 3.84, -.24]], radii: [.067, .053, .079, .060, .071, .061], flat: .76, twist: -.81 },
  { points: [[-.40, 1.20, .17], [-.54, 1.30, .17], [-.51, 1.46, .04]], radii: [.047, .061, .041], flat: .70, twist: -.1 },
  { points: [[.53, 2.30, .20], [.38, 2.44, .33], [.23, 2.53, .29]], radii: [.051, .072, .051], flat: .62, twist: -.34 },
  { points: [[-.49, .84, .30], [-.64, .92, .23], [-.67, 1.04, .12]], radii: [.043, .057, .035], flat: .68, twist: .57 },
  { points: [[-.24, 1.40, .33], [-.31, 1.50, .21], [-.35, 1.59, .11]], radii: [.041, .060, .038], flat: .61, twist: -.21 },
  { points: [[.54, 1.45, .01], [.64, 1.55, -.08], [.71, 1.63, -.15]], radii: [.045, .069, .034], flat: .67, twist: .75 },
  { points: [[.50, 2.04, .34], [.39, 2.13, .36], [.33, 2.20, .26]], radii: [.036, .058, .039], flat: .58, twist: -.48 },
  { points: [[-.38, 2.58, .08], [-.25, 2.67, .06], [-.14, 2.65, -.02]], radii: [.047, .055, .029], flat: .72, twist: .81 },
  { points: [[-.79, 3.10, .29], [-.96, 3.18, .30], [-1.05, 3.30, .25]], radii: [.041, .072, .035], flat: .74, twist: -.59 },
  { points: [[-.85, 3.40, .30], [-.98, 3.50, .24], [-1.08, 3.56, .15]], radii: [.037, .066, .042], flat: .61, twist: .43 },
  { points: [[-.47, 3.42, .36], [-.33, 3.48, .31], [-.23, 3.61, .24]], radii: [.032, .050, .037], flat: .69, twist: -.82 },
  { points: [[.68, 3.65, .13], [.55, 3.77, .14], [.48, 3.89, .09]], radii: [.039, .063, .028], flat: .58, twist: .67 },
  { points: [[-.17, 1.30, -.59], [-.30, 1.42, -.51], [-.33, 1.55, -.42]], radii: [.043, .061, .038], flat: .77, twist: -.63 },
  { points: [[-.29, 2.82, -.48], [-.44, 2.91, -.42], [-.58, 2.98, -.28]], radii: [.034, .053, .046], flat: .69, twist: .23 },
  { points: [[-.31, 3.56, -.33], [-.40, 3.70, -.32], [-.43, 3.81, -.23]], radii: [.041, .068, .031], flat: .72, twist: -.58 },
];
function compileStonePaths(paths) {
  return paths.flatMap(path => path.points.slice(0, -1).map((start, i) => {
    const end = path.points[i + 1], direction = V(...end).sub(V(...start)), length = direction.length(); direction.divideScalar(length);
    const reference = Math.abs(direction.z) > .90 ? V(1, 0, 0) : V(0, 0, 1), normal = direction.clone().cross(reference).normalize(), binormal = direction.clone().cross(normal).normalize(), cosine = Math.cos(path.twist), sine = Math.sin(path.twist);
    return { a: start, d: direction.toArray(), n: normal.clone().multiplyScalar(cosine).addScaledVector(binormal, sine).toArray(), b: binormal.multiplyScalar(cosine).addScaledVector(normal, -sine).toArray(), length, r0: path.radii[i], r1: path.radii[i + 1], flat: path.flat };
  }));
}
const stoneRibSegments = compileStonePaths(stoneRibs), stoneGullySegments = compileStonePaths(stoneGullies);
function foldedSegmentDistance(x, y, z, segment, groove = false) {
  const dx = x - segment.a[0], dy = y - segment.a[1], dz = z - segment.a[2], along = dx * segment.d[0] + dy * segment.d[1] + dz * segment.d[2], t = Math.max(0, Math.min(1, along / segment.length)), radius = mix(segment.r0, segment.r1, t);
  const a = Math.abs((dx * segment.n[0] + dy * segment.n[1] + dz * segment.n[2]) / radius), b = Math.abs((dx * segment.b[0] + dy * segment.b[1] + dz * segment.b[2]) / (radius * segment.flat));
  const across = (groove ? Math.hypot(a, b) - 1 : smoothMaximum(a + .27 * b, .36 * a + b, .12) - 1) * radius * segment.flat, cap = Math.max(-along, along - segment.length);
  return groove ? Math.hypot(Math.max(0, across), Math.max(0, cap)) + Math.min(0, Math.max(across, cap)) : smoothMaximum(across, cap - .018, .025);
}

export const lakeStoneOpenings = [
  { centre: [.18, 1.15, 0], direction: [0, 0, 1], form: 'lower-oblique-window-between-folded-ribs' },
  { centre: [.255, 2.085, 0], direction: [-.8, 0, 1], form: 'middle-narrow-cleft' },
  { centre: [-.045, 3.03, 0], direction: [-.8, 0, 1], form: 'upper-crossing-web-window' },
];

export function lakeStoneField(x, y, z) {
  const px = x + .034 * gardenValueNoise(x * 2.3 + 4, y * 1.7, z * 1.9, 39), py = y + .032 * gardenValueNoise(x * 1.6, y * 2.1 + 7, z * 1.7, 81), pz = z + .036 * gardenValueNoise(x * 2.1, y * 1.8, z * 2.2 + 3, 19);
  let solid = Infinity;
  for (const segment of stoneRibSegments) solid = smoothMinimum(solid, foldedSegmentDistance(px, py, pz, segment), .072);
  let channel = Infinity;
  for (const segment of stoneGullySegments) channel = smoothMinimum(channel, foldedSegmentDistance(px, py, pz, segment, true), .024);
  const u = x * .81 + y * .42 - z * .40, v = -x * .55 + y * .78 - z * .29, w = x * .19 + y * .46 + z * .87;
  solid += .035 * gardenValueNoise(u * 3.1 + 9, v * 3.1, w * 3.1, 96) + .009 * gardenValueNoise(u * 7.0, v * 7.0, w * 7.0, 312);
  // Carve after weathering: adding signed noise afterward could reseal a fine
  // channel and leave an invisible, disconnected interior cavity wall.
  solid = smoothMaximum(solid, -channel, .018);
  return Math.max(solid, -y - .022);
}

// Preserve the sign/topology while moving a nearly zero grid value far enough
// from its corner to survive Float32 vertex storage. At production spacing the
// maximum field adjustment is under five micrometres, below the authored grain.
export function stableStoneGridValue(value, spacing) {
  const floor = spacing * .0002;
  return Math.abs(value) < floor ? (value <= 0 ? -floor : floor) : value;
}

// Broad, continuous mineral tints multiply the photographed grain. Colours
// remain in linear [0,1] so ordinary vertex-colour PBR and glTF agree.
export function lakeStonePigment(x, y, z, curvature = 0) {
  const warp = gardenValueNoise(x * 1.19 + 8, y * .93, z * 1.37, 713);
  const u = x * 1.53 + y * .41 - z * .36 + warp * .42, v = -x * .37 + y * 1.17 + z * .52, w = x * .21 - y * .31 + z * 1.64;
  const cloud = THREE.MathUtils.smoothstep(gardenValueNoise(u, v, w, 941), -.42, .46);
  const colour = new THREE.Color().setRGB(mix(.73, .99, cloud), mix(.79, .975, cloud), mix(.83, .91, cloud));
  const oxide = THREE.MathUtils.smoothstep(gardenValueNoise(u * 2.17 + 17, v * 2.03, w * 1.89, 487), .20, .70) * .65;
  colour.lerp(new THREE.Color().setRGB(.91, .70, .48), oxide);
  const seam = gardenValueNoise(u * 3.13 + .35 * warp, v * 2.71, w * 3.07, 229), calcite = Math.exp(-((seam - .08) ** 2) / .0064) * .19;
  colour.lerp(new THREE.Color().setRGB(.99, .99, .965), calcite);
  const sheltered = Math.min(.065, Math.max(0, -curvature) * .003);
  return colour.lerp(new THREE.Color().setRGB(.64, .70, .69), sheltered).toArray();
}

// Split only UV charts, preserving every original physical triangle and smooth
// field normal. Dominant-axis projection bounds area compression by sqrt(3),
// including hole walls where an XY-only projection collapsed into long stripes.
export function lakeStoneTextureCharts(geometry, tileMetres = 1.5) {
  const source = geometry.attributes, vertices = new Map(), indices = [], data = Object.fromEntries(Object.entries(source).map(([name]) => [name, []]));
  const a = V(), b = V(), c = V(), cross = V(), axes = [0, 0, 0];
  for (let offset = 0; offset < geometry.index.count; offset += 3) {
    const triangle = [0, 1, 2].map(corner => geometry.index.getX(offset + corner));
    a.fromBufferAttribute(source.position, triangle[0]); b.fromBufferAttribute(source.position, triangle[1]); c.fromBufferAttribute(source.position, triangle[2]);
    cross.crossVectors(b.sub(a), c.sub(a)); const magnitude = cross.toArray().map(Math.abs);
    const axis = magnitude[0] >= magnitude[1] && magnitude[0] >= magnitude[2] ? 0 : magnitude[1] >= magnitude[2] ? 1 : 2; axes[axis]++;
    for (const original of triangle) {
      const key = original * 3 + axis;
      if (!vertices.has(key)) {
        vertices.set(key, data.position.length / 3);
        for (const [name, attribute] of Object.entries(source)) {
          if (name === 'uv') { const p = source.position, u = axis === 0 ? p.getZ(original) : p.getX(original), v = axis === 1 ? p.getZ(original) : p.getY(original); data.uv.push(u / tileMetres, v / tileMetres); }
          else for (let component = 0; component < attribute.itemSize; component++) data[name].push(attribute.array[original * attribute.itemSize + component]);
        }
      }
      indices.push(vertices.get(key));
    }
  }
  const originalVertices = source.position.count;
  for (const [name, attribute] of Object.entries(source)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(data[name], attribute.itemSize));
  geometry.setIndex(indices); geometry.userData = { ...geometry.userData, uvProjection: 'dominant-face-axis-charts', physicalTile: [tileMetres, tileMetres], originalVertices, uvSeamVertices: geometry.attributes.position.count - originalVertices, chartTriangles: axes, physicalTrianglesPreserved: true };
  return geometry;
}

/** A closed authored limestone surface with real through-holes. Marching
 * tetrahedra shares edge vertices; no downloaded stone or hidden hole decal. */
export function lakeStoneGeometry({ resolution = 148, name = 'authored-perforated-lake-stone' } = {}) {
  const min = [-1.49, -.18, -.84], max = [1.24, 4.48, .78], nx = Math.max(12, Math.round(resolution * .70)), ny = resolution, nz = Math.max(10, Math.round(resolution * .46)), sx = nx + 1, sy = ny + 1;
  const gridPosition = [], values = new Float32Array((nx + 1) * (ny + 1) * (nz + 1)), gridId = (x, y, z) => x + sx * (y + sy * z), minSpacing = Math.min((max[0] - min[0]) / nx, (max[1] - min[1]) / ny, (max[2] - min[2]) / nz);
  for (let z = 0; z <= nz; z++) for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
    const point = [mix(min[0], max[0], x / nx), mix(min[1], max[1], y / ny), mix(min[2], max[2], z / nz)], id = gridId(x, y, z); gridPosition[id] = point; values[id] = stableStoneGridValue(lakeStoneField(...point), minSpacing);
  }
  const positions = [], indices = [], colors = [], uv = [], vertices = new Map();
  function vertex(a, b) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`; if (vertices.has(key)) return vertices.get(key);
    const t = values[a] / (values[a] - values[b]), p = gridPosition[a].map((value, axis) => mix(value, gridPosition[b][axis], t)), id = positions.length / 3;
    positions.push(...p); uv.push(p[0] * .7, p[1] * .7);
    colors.push(1, 1, 1); vertices.set(key, id); return id;
  }
  const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]], edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const cube = [gridId(x, y, z), gridId(x + 1, y, z), gridId(x + 1, y + 1, z), gridId(x, y + 1, z), gridId(x, y, z + 1), gridId(x + 1, y, z + 1), gridId(x + 1, y + 1, z + 1), gridId(x, y + 1, z + 1)];
    for (const tet of tetrahedra) {
      const ids = tet.map(index => cube[index]), inside = ids.filter(id => values[id] <= 0), outside = ids.filter(id => values[id] > 0); if (!inside.length || !outside.length) continue;
      const cut = edges.filter(([a, b]) => (values[ids[a]] <= 0) !== (values[ids[b]] <= 0)).map(([a, b]) => vertex(ids[a], ids[b]));
      const centre = cut.reduce((sum, id) => sum.add(V(...positions.slice(id * 3, id * 3 + 3))), V(0, 0, 0)).divideScalar(cut.length);
      const direction = outside.reduce((sum, id) => sum.add(V(...gridPosition[id])), V(0, 0, 0)).divideScalar(outside.length).sub(inside.reduce((sum, id) => sum.add(V(...gridPosition[id])), V(0, 0, 0)).divideScalar(inside.length)).normalize();
      const axis = V(...positions.slice(cut[0] * 3, cut[0] * 3 + 3)).sub(centre).normalize(), across = direction.clone().cross(axis).normalize();
      cut.sort((a, b) => { const angle = id => { const p = V(...positions.slice(id * 3, id * 3 + 3)).sub(centre); return Math.atan2(p.dot(across), p.dot(axis)); }; return angle(a) - angle(b); });
      for (let i = 1; i < cut.length - 1; i++) indices.push(cut[0], cut[i], cut[i + 1]);
    }
  }
  const geometry = finishGeometry(name, positions, indices, colors, uv), normals = new Float32Array(positions.length), h = .012, surfaceColors = geometry.attributes.color;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2], xp = lakeStoneField(x + h, y, z), xm = lakeStoneField(x - h, y, z), yp = lakeStoneField(x, y + h, z), ym = lakeStoneField(x, y - h, z), zp = lakeStoneField(x, y, z + h), zm = lakeStoneField(x, y, z - h), dx = xp - xm, dy = yp - ym, dz = zp - zm, length = Math.hypot(dx, dy, dz) || 1;
    normals.set([dx / length, dy / length, dz / length], i);
    const curvature = (xp + xm + yp + ym + zp + zm - 6 * lakeStoneField(x, y, z)) / (h * h);
    surfaceColors.setXYZ(i / 3, ...lakeStonePigment(x, y, z, curvature));
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3)); geometry.userData = { body: 'authored-eroded-limestone', topology: 'folded-rib-network-with-connected-gullies-and-physical-windows', normalSource: 'continuous-implicit-field-gradient', surfacePigment: 'continuous-grey-calcite-and-sparse-oxide-tints-over-photographic-rock-grain', resolution, ribPaths: stoneRibs.length, gullyPaths: stoneGullies.length, holeCentres: lakeStoneOpenings.map(opening => opening.centre), copiedHistoricalObject: false }; return lakeStoneTextureCharts(geometry);
}

export class VegetationGeometryBatch {
  constructor(name) { this.name = name; this.positions = []; this.normals = []; this.colors = []; this.uv = []; this.indices = []; }
  add(geometry, matrix = new THREE.Matrix4(), tint = 1) {
    const p = geometry.attributes.position, normal = geometry.attributes.normal, color = geometry.attributes.color, uv = geometry.attributes.uv, offset = this.positions.length / 3, m = matrix.elements, n = new THREE.Matrix3().getNormalMatrix(matrix).elements;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); this.positions.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      const ax = normal.getX(i), ay = normal.getY(i), az = normal.getZ(i), nx = n[0] * ax + n[3] * ay + n[6] * az, ny = n[1] * ax + n[4] * ay + n[7] * az, nz = n[2] * ax + n[5] * ay + n[8] * az, length = Math.hypot(nx, ny, nz) || 1; this.normals.push(nx / length, ny / length, nz / length);
      this.colors.push((color?.getX(i) ?? 1) * tint, (color?.getY(i) ?? 1) * tint, (color?.getZ(i) ?? 1) * tint); this.uv.push(uv?.getX(i) ?? 0, uv?.getY(i) ?? 0);
    }
    const indices = geometry.index; for (let i = 0; i < (indices?.count ?? p.count); i++) this.indices.push(offset + (indices?.getX(i) ?? i));
  }
  finish() {
    const geometry = new THREE.BufferGeometry(); geometry.name = this.name; geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); geometry.setIndex(this.indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    this.positions = []; this.normals = []; this.colors = []; this.uv = []; this.indices = []; return geometry;
  }
}

/** Repeated leaves retain their authored geometry and editable transforms.
 * Instancing changes storage and draw calls, never the foliage silhouette. */
export class VegetationInstanceBatch {
  constructor(name) { this.name = name; this.matrices = []; this.colors = []; }
  add(matrix = new THREE.Matrix4(), tint = 1) { this.matrices.push(...matrix.elements); this.colors.push(tint, tint, tint); }
  finish(geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, this.matrices.length / 16); mesh.name = this.name;
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(this.matrices), 16);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.colors), 3);
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); this.matrices = []; this.colors = []; return mesh;
  }
}
