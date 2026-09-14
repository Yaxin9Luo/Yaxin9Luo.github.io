import * as THREE from 'three';
import { curvedBranchGeometry, seededGardenRandom, VegetationGeometryBatch } from './vegetation-geometry.js';

const V = (...p) => new THREE.Vector3(...p), TAU = Math.PI * 2;

function finish(name, p, indices, colors, uv, data) {
  const g = new THREE.BufferGeometry(); g.name = name;
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); g.userData = data; return g;
}

// One endpoint per tip prevents the zero-area fans produced by a collapsed
// rectangular grid. All interior rows retain curved, continuous lamina normals.
function pointedSurface({ name, rows, columns, sample, colorAt, data }) {
  if (!Number.isInteger(rows) || rows < 4 || !Number.isInteger(columns) || columns < 2 || columns % 2) throw new Error('Understory surfaces need integer rows and an even number of transverse segments.');
  const p = [], colors = [], uv = [], indices = [], rowStarts = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows; rowStarts.push(p.length / 3);
    for (let column = 0; column < (row === 0 || row === rows ? 1 : columns + 1); column++) {
      const u = row === 0 || row === rows ? 0 : column / columns * 2 - 1, point = sample(t, u), c = colorAt(t, u);
      p.push(point.x, point.y, point.z); colors.push(c.r, c.g, c.b); uv.push((u + 1) / 2, t);
    }
  }
  for (let column = 0; column < columns; column++) indices.push(0, rowStarts[1] + column + 1, rowStarts[1] + column);
  for (let row = 1; row < rows - 1; row++) for (let column = 0; column < columns; column++) {
    const a = rowStarts[row] + column, b = rowStarts[row + 1] + column; indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (let column = 0; column < columns; column++) indices.push(rowStarts[rows - 1] + column, rowStarts[rows - 1] + column + 1, rowStarts[rows]);
  return finish(name, p, indices, colors, uv, { ...data, rowStarts, rows, columns, rootVertex: 0, tipVertex: rowStarts[rows], opaqueCurvedLamina: true });
}

/** A real cupped leaf, not an alpha rectangle. Local petiole at origin,
 * length +Y, front +Z. The curved midrib and oblique secondary veins are
 * modelled in the surface; the teeth alter the actual silhouette. */
export function understoryLaminaGeometry({ length = .045, width = .016, curl = .004, cup = .09, rows = 18, columns = 6, teeth = 9, serration = .065, veinHeight = .0002, profile = .80, color = '#628055', edgeColor = '#45633d', veinColor = '#a8b681', seed = 0, name = 'understory-veined-lamina' } = {}) {
  if (![length, width, profile].every(v => Number.isFinite(v) && v > 0) || ![curl, cup, serration, veinHeight].every(Number.isFinite)) throw new Error('Invalid understory lamina dimensions.');
  const base = new THREE.Color(color), vein = new THREE.Color(veinColor), edge = new THREE.Color(edgeColor);
  const ridge = (t, u) => Math.max(0, Math.cos((t * 7 + Math.abs(u) * .85 + seed * .17) * TAU)) ** 8;
  return pointedSurface({ name, rows, columns, data: { body: 'veined-curved-leaf', length, width, curl, serration, teeth, veinHeight, profile, root: [0, 0, 0] },
    sample(t, u) {
      const widthAt = width * .5 * Math.sin(Math.PI * t) ** profile * (.92 + .08 * t), tooth = 1 - serration * (.5 + .5 * Math.cos(t * teeth * TAU + (u < 0 ? .31 : 0)));
      const half = widthAt * tooth, midrib = veinHeight * Math.exp(-Math.abs(u) * 10), secondary = veinHeight * .35 * ridge(t, u);
      return V(u * half + width * .035 * Math.sin(Math.PI * t) * Math.sin(seed + t * 3), t * length,
        curl * t * t + Math.sin(Math.PI * t) * (cup * width * (1 - u * u) + midrib + secondary));
    },
    colorAt(t, u) { return base.clone().lerp(edge, Math.abs(u) * .22).lerp(vein, Math.exp(-Math.abs(u) * 11) * .16 + ridge(t, u) * .032).multiplyScalar(.94 + .08 * t); },
  });
}

/** Arching sedge leaf with a folded cross-section and parallel vein ridges.
 * The end follows a cubic curve downwards; it is not a straight cone/ribbon. */
export function archingUnderstoryBladeGeometry({ height = .42, reach = .32, width = .009, tipY = .07, angle = 0, base = [0, -.006, 0], sway = .024, twist = .25, rows = 34, columns = 8, color = '#748a4b', paleEdge = .15, name = 'understory-sedge-arched-blade' } = {}) {
  if (![height, reach, width].every(v => Number.isFinite(v) && v > 0) || ![tipY, angle, sway, twist, paleEdge, ...base].every(Number.isFinite)) throw new Error('Invalid understory blade dimensions.');
  const start = V(...base), direction = V(Math.cos(angle), 0, Math.sin(angle)), side = V(-Math.sin(angle), 0, Math.cos(angle));
  const curve = new THREE.CubicBezierCurve3(start, start.clone().add(V(0, height * .88, 0)).addScaledVector(direction, reach * .045), start.clone().add(V(0, height * 1.12, 0)).addScaledVector(direction, reach * .56).addScaledVector(side, sway), start.clone().add(V(0, tipY, 0)).addScaledVector(direction, reach));
  const baseColor = new THREE.Color(color), cream = new THREE.Color('#b9be84'), dark = new THREE.Color('#475d35');
  return pointedSurface({ name, rows, columns, data: { body: 'arched-folded-sedge-leaf', base: [...base], height, reach, width, tipY, root: [...base], controlPoints: [curve.v0, curve.v1, curve.v2, curve.v3].map(v => v.toArray()), veinCrossSectionSegments: columns },
    sample(t, u) {
      const centre = curve.getPoint(t), tangent = curve.getTangent(t), across = side.clone().applyAxisAngle(tangent, twist * t); across.addScaledVector(tangent, -across.dot(tangent)).normalize();
      const normal = across.clone().cross(tangent).normalize(), profile = Math.sin(Math.PI * t) ** .30 * (1 - .72 * t ** 3), half = width * .5 * profile;
      const fold = width * (.15 * (1 - Math.abs(u)) + .021 * Math.cos(u * Math.PI * 4)) * profile * Math.sin(Math.PI * t);
      return centre.addScaledVector(across, u * half).addScaledVector(normal, fold);
    },
    colorAt(t, u) { return baseColor.clone().lerp(dark, (1 - t) * .12).lerp(cream, paleEdge * Math.abs(u) ** 8 + .055 * (1 - Math.abs(u))).multiplyScalar(.93 + .13 * t); },
  });
}

export function understoryPose(origin, direction, normal, scale = [1, 1, 1]) {
  const y = direction.clone().normalize(), x = y.clone().cross(normal).normalize();
  if (!x.lengthSq()) throw new Error('Understory leaf direction and normal must not be parallel.');
  const z = x.clone().cross(y).normalize(), matrix = new THREE.Matrix4().makeBasis(x, y, z); matrix.scale(V(...scale)); matrix.setPosition(origin); return matrix;
}

/** Small stems sample the exact caller curve. Leaf origins and the rendered
 * tube therefore use the same arc parameter; a Bezier tangent is not replaced
 * by a Catmull-Rom approximation at the mother-branch/flowering-shoot join. */
export function understoryCurveStemGeometry({ curve, radii, segments = 28, radialSegments = 9, color = '#7c7359', name = 'understory-continuous-stem' } = {}) {
  if (typeof curve?.getPointAt !== 'function' || typeof curve?.computeFrenetFrames !== 'function' || !Array.isArray(radii) || radii.length < 2 || radii.some(r => !Number.isFinite(r) || r <= 0) || !Number.isInteger(segments) || segments < 3 || !Number.isInteger(radialSegments) || radialSegments < 5) throw new Error('Invalid understory stem curve.');
  const frames = curve.computeFrenetFrames(segments, false), p = [], indices = [], colors = [], uv = [], base = new THREE.Color(color), stride = radialSegments + 1, centreline = [];
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, centre = curve.getPointAt(t), span = t * (radii.length - 1), k = Math.min(radii.length - 2, Math.floor(span)), radius = THREE.MathUtils.lerp(radii[k], radii[k + 1], span - k); centreline.push(centre.toArray());
    for (let side = 0; side <= radialSegments; side++) {
      const angle = side / radialSegments * TAU, outward = frames.normals[row].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[row], Math.sin(angle));
      p.push(...centre.clone().addScaledVector(outward, radius).toArray());
      const c = base.clone().multiplyScalar(.98 + .02 * Math.cos(angle * 3 + t * 2)); colors.push(c.r, c.g, c.b); uv.push(side / radialSegments, t);
    }
  }
  for (let row = 0; row < segments; row++) for (let side = 0; side < radialSegments; side++) { const a = row * stride + side, b = a + stride; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  for (const end of [0, 1]) {
    const centre = p.length / 3, offset = end * segments * stride; p.push(...curve.getPointAt(end).toArray()); colors.push(base.r, base.g, base.b); uv.push(.5, end);
    for (let side = 0; side < radialSegments; side++) indices.push(centre, offset + side + (end ? 0 : 1), offset + side + (end ? 1 : 0));
  }
  return finish(name, p, indices, colors, uv, { body: 'continuous-tapered-understory-stem', radii, segments, radialSegments, centreline, curveLength: curve.getLength(), root: curve.getPointAt(0).toArray(), tip: curve.getPointAt(1).toArray(), startTangent: curve.getTangentAt(0).toArray(), endTangent: curve.getTangentAt(1).toArray() });
}

export function understoryRacemeCurve(anchor, motherTangent, length = .10) {
  if (!(length > 0) || !Number.isFinite(length) || motherTangent.lengthSq() < 1e-12) throw new Error('Invalid flowering shoot direction.');
  const start = motherTangent.clone().normalize(), end = start.clone().multiplyScalar(.84).add(V(0, .16, 0)).normalize(), tip = anchor.clone().addScaledVector(start, length * .40).addScaledVector(end, length * .60);
  return new THREE.CubicBezierCurve3(anchor.clone(), anchor.clone().addScaledVector(start, length / 3), tip.clone().addScaledVector(end, -length / 3), tip);
}

/** A pedicel branches towards its flower. Continuing a downward raceme tangent
 * first would turn this millimetre-scale offshoot back through its own tube. */
export function understoryPedicelCurve(parent, root, outward, axisDirection) {
  const length = parent.distanceTo(root);
  if (!(length > 0) || !Number.isFinite(length) || outward.lengthSq() < 1e-12 || axisDirection.lengthSq() < 1e-12) throw new Error('Invalid flower pedicel.');
  const end = outward.clone().normalize(), start = end.clone().multiplyScalar(.84).addScaledVector(axisDirection.clone().normalize(), .16).normalize();
  return new THREE.CubicBezierCurve3(parent.clone(), parent.clone().addScaledVector(start, length * .32), root.clone().addScaledVector(end, -length * .28), root.clone());
}

export function understoryLeafPairParameters(curve, spacing = .030) {
  if (!(spacing > 0) || !Number.isFinite(spacing)) throw new Error('Invalid leaf node spacing.');
  const length = curve.getLength(), end = 1 - Math.min(.06, spacing * .75 / length), count = Math.max(3, Math.ceil(length * (end - .10) / spacing) + 1);
  return Array.from({ length: count }, (_, i) => .10 + (end - .10) * i / (count - 1));
}

function branch(batch, points, radii, options = {}) {
  const geometry = curvedBranchGeometry({ points: points.map(p => p.isVector3 ? p.toArray() : p), radii, radialSegments: 6, segments: 12, bark: .015, color: '#6f7949', ...options });
  batch.add(geometry); geometry.dispose();
}

/** A bipinnate frond. Each pinna has its own rachis and attached pinnules;
 * their gaps, teeth and tipped outline are geometry in beauty/AO/shadows. */
export function understoryFernFrondGeometry({ length = .66, width = .27, curl = .15, pairs = 13, seed = 317, leafColor = '#708d51', name = 'understory-fern-frond' } = {}) {
  const rng = seededGardenRandom(seed), stem = new VegetationGeometryBatch(`${name}-rachises`), foliage = new VegetationGeometryBatch(`${name}-pinnules`), attachments = [];
  const points = [V(0, -.008, 0), V(.004, length * .22, -.008), V(-.008, length * .64, -curl * .27), V(.009, length, -curl)], main = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  branch(stem, points, [.0020, .0016, .00082, .00017], { segments: 34, radialSegments: 9, color: '#738554' });
  const leafLength = .032, leafWidth = .013;
  const leaf = understoryLaminaGeometry({ length: leafLength, width: leafWidth, curl: .0014, rows: 28, columns: 6, teeth: 6, serration: .10, profile: .56, veinHeight: .00015, cup: .065, color: leafColor, edgeColor: new THREE.Color(leafColor).multiplyScalar(.8), seed });
  let pinnules = 0, pinnae = 0;
  for (let row = 0; row < pairs; row++) for (const side of [-1, 1]) {
    const t = .20 + row / pairs * .74 + (side > 0 ? .010 : 0), anchor = main.getPointAt(t), envelope = Math.sin(Math.PI * (.13 + row / pairs * .84)) ** .74 * (1 - .44 * row / pairs);
    const reach = width * .5 * envelope * (.90 + rng() * .13), tip = anchor.clone().add(V(side * reach, reach * (.27 + rng() * .17), -.015 * (1 - t)));
    const controls = [anchor, anchor.clone().lerp(tip, .48).add(V(0, reach * .06, .004)), tip], pinna = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
    branch(stem, controls, [.00056 * (1 - .40 * t), .00029, .00008], { segments: 18, color: '#7b8f55' });
    const count = Math.max(3, Math.round(7 * envelope)), pinnaNormal = V((rng() - .5) * .14, .04, 1).normalize();
    const nodePitch = pinna.getLength() * .78 / count, rowPitch = main.getLength() * .74 / pairs;
    for (let node = 0; node < count; node++) for (const edge of [-1, 1]) {
      const s = .10 + node / count * .78 + (edge > 0 ? .012 : 0), origin = pinna.getPointAt(s), tangent = pinna.getTangentAt(s), lateral = V(-tangent.y, tangent.x, 0).normalize().multiplyScalar(edge), direction = lateral.multiplyScalar(.86).addScaledVector(tangent, .44).normalize();
      const taper = (.72 + .28 * Math.sin(Math.PI * s)) * (.69 + .31 * envelope), size = .94 + rng() * .12, tint = .87 + rng() * .23;
      const actualLength = Math.min(.037, rowPitch * .91) * taper * size, actualWidth = Math.min(.017, Math.max(.006, nodePitch * 1.14)) * (.92 + rng() * .14);
      const matrix = understoryPose(origin, direction, pinnaNormal, [actualWidth / leafWidth, actualLength / leafLength, actualLength / leafLength]); foliage.add(leaf, matrix, tint);
      attachments.push({ parent: 'pinna', row, side, parameter: s, root: origin.toArray(), matrix: [...matrix.elements], actualLength, actualWidth, nodePitch, rowPitch }); pinnules++;
    }
    const origin = pinna.getPointAt(.86), direction = pinna.getPointAt(1).sub(origin).normalize(), tipLength = origin.distanceTo(pinna.getPointAt(1)) + .004, matrix = understoryPose(origin, direction, pinnaNormal, [Math.min(.014, nodePitch) / leafWidth, tipLength / leafLength, .55]); foliage.add(leaf, matrix, .95); pinnules++; pinnae++;
    attachments.push({ parent: 'pinna-tip', row, side, parameter: .86, root: origin.toArray(), matrix: [...matrix.elements] });
  }
  // The final leaflet continues the main rachis instead of leaving a bare rod.
  const top = main.getPointAt(.90), terminalLength = top.distanceTo(main.getPointAt(1)) + .006, topMatrix = understoryPose(top, main.getPointAt(1).sub(top), V(0, 0, 1), [.84, terminalLength / leafLength, .45]); foliage.add(leaf, topMatrix); pinnules++;
  attachments.push({ parent: 'main-tip', root: top.toArray(), matrix: [...topMatrix.elements] }); leaf.dispose();
  const wood = stem.finish(), lamina = foliage.finish();
  wood.userData = { body: 'fern-main-and-pinna-rachises', root: points[0].toArray() };
  lamina.userData = { body: 'bipinnate-fern-curved-pinnules', seed, pinnae, pinnules, attachments, trueHolesBetweenPinnules: true, coverageRevision: 'R2-length-and-width-follow-pinna-and-rachis-spacing' };
  return { wood, lamina, data: { length, width, curl, pairs, pinnae, pinnules, root: points[0].toArray(), form: 'bipinnate-frond-reference-not-exact-taxonomic-reconstruction' } };
}

/** Five separate curved petals, ten raised filaments/anthers and a real calyx.
 * Local flower cup opens +Y. Ivory/pink is an authored blossom variant. */
export function understoryFlowerGeometry({ radius = .0115, tint = '#eee9dc', seed = 551, name = 'understory-five-petal-flower' } = {}) {
  const rng = seededGardenRandom(seed), petals = new VegetationGeometryBatch(name), details = new VegetationGeometryBatch(`${name}-calyx-and-stamens`);
  for (let petal = 0; petal < 5; petal++) {
    const angle = petal / 5 * TAU + (rng() - .5) * .055, radial = V(Math.cos(angle), .50 + rng() * .12, Math.sin(angle)).normalize(), normal = V(0, 1, 0);
    const g = understoryLaminaGeometry({ length: radius * (1.02 + rng() * .13), width: radius * .78, curl: radius * .10, cup: .07, rows: 13, columns: 6, teeth: 2, serration: .035, veinHeight: radius * .009, color: tint, edgeColor: '#d8d1c3', veinColor: '#fff4e2', name: `${name}-petal-${petal + 1}` });
    petals.add(g, understoryPose(V(0, radius * .10, 0), radial, normal)); g.dispose();
  }
  // A tapered green cup supports the petal bases; no disconnected floating disc.
  branch(details, [V(0, -radius * .36, 0), V(0, radius * .10, 0)], [radius * .11, radius * .19], { radialSegments: 10, segments: 4, color: '#739052' });
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * TAU, r = radius * .24, tip = V(Math.cos(angle) * r, radius * (.56 + (i % 2) * .12), Math.sin(angle) * r);
    branch(details, [V(0, radius * .09, 0), tip.clone().multiplyScalar(.64).add(V(0, radius * .08, 0)), tip], [radius * .026, radius * .022, radius * .018], { radialSegments: 5, segments: 5, color: '#d2c995' });
    const anther = new THREE.SphereGeometry(radius * .063, 8, 6); anther.scale(.75, 1, 1.25); anther.translate(...tip.toArray());
    const count = anther.attributes.position.count, c = new THREE.Color('#bbad5d'), colors = new Float32Array(count * 3); for (let j = 0; j < count; j++) colors.set(c.toArray(), j * 3); anther.setAttribute('color', new THREE.BufferAttribute(colors, 3)); details.add(anther); anther.dispose();
  }
  const lamina = petals.finish(), centre = details.finish(); lamina.userData = { body: 'five-curved-petals', petals: 5, radius, tint, root: [0, radius * .10, 0] }; centre.userData = { body: 'attached-calyx-filaments-anthers', stamens: 10 };
  return { lamina, centre, data: { radius, petals: 5, stamens: 10, tint, root: [0, -radius * .36, 0], fullyGeometric: true } };
}
