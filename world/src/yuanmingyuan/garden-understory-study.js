import * as THREE from 'three';
import { seededGardenRandom, VegetationGeometryBatch } from './vegetation-geometry.js';
import { archingUnderstoryBladeGeometry, understoryFernFrondGeometry, understoryFlowerGeometry, understoryLaminaGeometry, understoryPose, understoryCurveStemGeometry, understoryRacemeCurve, understoryPedicelCurve, understoryLeafPairParameters } from './garden-understory-geometry.js';
import { gardenUnderstoryStudyViews } from './garden-understory-study-views.js';

const V = (...p) => new THREE.Vector3(...p);
export const gardenUnderstorySpecs = Object.freeze([
  { id: 'sedge', label: '弧叶细草丛', form: 'Carex-inspired narrow arching leaves', sourceIds: ['ncstate-carex-morrowii'], season: 'authored living foliage' },
  { id: 'fern', label: '羽状蕨丛', form: 'Dryopteris-inspired bipinnate fronds', sourceIds: ['ncstate-dryopteris-erythrosora'], season: 'green mature fronds and a few copper young fronds' },
  { id: 'flower-shrub', label: '象牙白与淡粉低花灌木', form: 'Deutzia-inspired slender arching shoots and five-petal clusters', sourceIds: ['ncstate-deutzia-gracilis', 'morton-slender-deutzia'], season: 'authored spring flowering composition; not a historical cultivar identification' },
]);

function owner() {
  const geometries = new Set(), materials = new Set();
  const leaf = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .69, metalness: 0, side: THREE.DoubleSide }); leaf.name = 'understory-physical-leaf';
  const wood = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .88, metalness: 0 }); wood.name = 'understory-fine-stems';
  const flower = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .60, metalness: 0, side: THREE.DoubleSide }); flower.name = 'understory-ivory-petal';
  [leaf, wood, flower].forEach(m => { m.userData = { body: 'botanical-understory', authoredPBR: true, alphaCoverage: 'actual-geometry-no-alpha-mask' }; materials.add(m); });
  return { geometries, materials, leaf, wood, flower,
    group(parent, name, data = {}) { const g = new THREE.Group(); g.name = name; g.userData = data; parent.add(g); return g; },
    mesh(parent, geometry, material, name) { geometries.add(geometry); const m = new THREE.Mesh(geometry, material); m.name = name; m.castShadow = m.receiveShadow = true; parent.add(m); return m; },
    dispose() { for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); },
  };
}

function addWood(batch, points, radii, options = {}) {
  const curve = Array.isArray(points) ? new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V(...p)), false, 'centripetal') : points;
  const g = understoryCurveStemGeometry({ curve, radii, radialSegments: 9, segments: 24, color: '#7c7359', ...options }); batch.add(g); g.dispose();
}

function sedge(b, group, signal) {
  const rng = seededGardenRandom(7371), batch = new VegetationGeometryBatch('understory-sedge-curved-leaves'), roots = [], leaves = [];
  const colours = ['#657c42', '#788c4e', '#809352', '#698343', '#87955a'];
  for (let i = 0; i < 112; i++) {
    signal?.throwIfAborted();
    const whorl = i % 4, angle = i * 2.399963 + (rng() - .5) * .44, radius = Math.sqrt(rng()) * .075, base = [Math.cos(angle + 1) * radius, -.009 - rng() * .006, Math.sin(angle + 1) * radius * .84];
    const height = .31 + rng() * .19 + (whorl === 0 ? .07 : 0), reach = whorl === 0 ? .16 + rng() * .16 : .30 + rng() * .22, tipY = whorl === 0 ? height * (.58 + rng() * .2) : .018 + rng() * .12;
    const g = archingUnderstoryBladeGeometry({ height, reach, width: .0058 + rng() * .0045, angle, base, tipY, sway: (rng() - .5) * .085, twist: (rng() - .5) * .7, color: colours[i % colours.length], paleEdge: i % 9 === 0 ? .28 : .065 });
    roots.push([...base]); leaves.push({ root: [...base], tip: g.boundingBox.max.toArray(), geometryVertexOffset: batch.positions.length / 3, geometryVertexCount: g.attributes.position.count }); batch.add(g); g.dispose();
  }
  const g = batch.finish(); g.userData = { body: 'rooted-sedge-clump', leaves, leafCount: leaves.length, roots, rootDatum: 0, noGenericTuftClone: true }; b.mesh(group, g, b.leaf, 'understory-sedge-arched-laminae');
  group.userData.rootPoints = roots;
}

function fern(b, group, signal) {
  const rng = seededGardenRandom(8427), roots = [];
  for (let i = 0; i < 11; i++) {
    signal?.throwIfAborted(); const angle = i * 2.399963 + rng() * .20, young = i === 7 || i === 10, length = young ? .38 + rng() * .13 : .55 + rng() * .20;
    const direction = V(Math.cos(angle) * (young ? .28 : .82 + rng() * .12), young ? .96 : .66 + rng() * .18, Math.sin(angle) * (young ? .28 : .82 + rng() * .12));
    const root = V(Math.cos(angle) * .024, -.006, Math.sin(angle) * .024), frame = understoryPose(root, direction, V(0, 1, 0));
    const part = b.group(group, `understory-fern-frond-${String(i + 1).padStart(2, '0')}`, { body: 'individual-bipinnate-frond', age: young ? 'copper-young' : 'green-mature' }); part.applyMatrix4(frame);
    const shape = understoryFernFrondGeometry({ length, width: young ? .20 : .26 + rng() * .04, curl: young ? .055 : .12 + rng() * .055, seed: 321 + i * 97, leafColor: young ? '#9b8755' : i % 2 ? '#718b50' : '#698547', name: part.name });
    b.mesh(part, shape.wood, b.wood, `${part.name}-rachises`); b.mesh(part, shape.lamina, b.leaf, `${part.name}-pinnules`); part.userData.form = shape.data;
    roots.push(V(...shape.data.root).applyMatrix4(frame).toArray());
  }
  group.userData.rootPoints = roots;
}

function flowerShrub(b, group, signal) {
  const rng = seededGardenRandom(22819), wood = new VegetationGeometryBatch('understory-shrub-curving-wood'), leaves = new VegetationGeometryBatch('understory-shrub-opposite-leaves'), roots = [], joins = [];
  const leaf = understoryLaminaGeometry({ length: .060, width: .019, curl: .0033, cup: .085, rows: 28, columns: 6, teeth: 11, serration: .055, veinHeight: .00024, color: '#64834d', seed: 391 });
  const blossoms = [understoryFlowerGeometry({ tint: '#eee9dc', seed: 923 }), understoryFlowerGeometry({ tint: '#eddfd7', seed: 752 }), understoryFlowerGeometry({ tint: '#e5cdd0', seed: 618 })];
  let leafCount = 0, flowerCount = 0, sprayCount = 0; const shootRecords = [], flowerRecords = [];
  function leafPairs(curve, phase, kind) {
    const spacing = .025 + rng() * .008, parameters = understoryLeafPairParameters(curve, spacing);
    shootRecords.push({ kind, curveLength: curve.getLength(), parameters, points: parameters.map(t => curve.getPointAt(t).toArray()), maximumRequestedNodePitch: spacing });
    for (let node = 0; node < parameters.length; node++) {
      const t = parameters[node], point = curve.getPointAt(t), tangent = curve.getTangentAt(t), angle = phase + node * .46, across = V(Math.cos(angle), .10, Math.sin(angle)); across.addScaledVector(tangent, -across.dot(tangent)).normalize();
      for (const side of [-1, 1]) {
        const direction = across.clone().multiplyScalar(side * .92).addScaledVector(tangent, .18).add(V(0, .26, 0)).normalize(), end = point.clone().addScaledVector(direction, .004 + rng() * .003), size = .83 + rng() * .32;
        addWood(wood, [point, end], [.00036, .00018], { segments: 3, radialSegments: 6, color: '#788153' });
        const normal = V((rng() - .5) * .56, 1, (rng() - .5) * .56), matrix = understoryPose(end, direction, normal, [size * (.91 + rng() * .18), size, size]); leaves.add(leaf, matrix, .87 + rng() * .23); leafCount++;
        joins.push({ kind: 'leaf-petiole', parentPoint: point.toArray(), end: end.toArray(), rootMatrix: [...matrix.elements] });
      }
    }
  }
  function spray(anchor, tangent, count, rootRadius) {
    const part = b.group(group, `understory-shrub-flowering-spray-${String(++sprayCount).padStart(2, '0')}`, { body: 'attached-terminal-flower-cluster' }), petals = new VegetationGeometryBatch(`${part.name}-petals`), centres = new VegetationGeometryBatch(`${part.name}-centres`);
    const axis = understoryRacemeCurve(anchor, tangent, .086 + rng() * .030), record = { name: part.name, count, curveLength: axis.getLength(), root: anchor.toArray(), motherTangent: tangent.toArray(), startTangent: axis.getTangentAt(0).toArray(), centres: [] }; flowerRecords.push(record);
    addWood(wood, axis, [rootRadius, rootRadius * .66, .00016], { segments: 20, radialSegments: 8, color: '#758851' });
    for (let n = 0; n < count; n++) {
      const t = .10 + n / (count - 1) * .86, parent = axis.getPointAt(t), axisDirection = axis.getTangentAt(t), angle = n * 2.399963 + rng() * .20;
      const across = V(0, 1, 0).cross(axisDirection).normalize(), up = axisDirection.clone().cross(across).normalize(), radial = across.multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle));
      const outward = radial.multiplyScalar(.54).add(V(0, .80 + rng() * .20, 0)).addScaledVector(axisDirection, .10).normalize(), tip = parent.clone().addScaledVector(outward, .009 + rng() * .009);
      const flower = blossoms[n % 9 === 0 ? 2 : n % 3 === 0 ? 1 : 0], size = .78 + rng() * .28, normal = V(0, 0, 1), matrix = understoryPose(tip, outward, normal, [size, size, size]);
      const root = V(...flower.data.root).applyMatrix4(matrix), pedicel = understoryPedicelCurve(parent, root, outward, axisDirection);
      addWood(wood, pedicel, [.00040, .00030, .00020], { segments: 9, radialSegments: 6, color: '#859358' }); record.centres.push(tip.toArray());
      petals.add(flower.lamina, matrix); centres.add(flower.centre, matrix); flowerCount++; joins.push({ kind: 'flower-pedicel', parentPoint: parent.toArray(), end: root.toArray(), rootMatrix: [...matrix.elements], localRoot: [...flower.data.root] });
    }
    b.mesh(part, petals.finish(), b.flower, `${part.name}-petals`); b.mesh(part, centres.finish(), b.flower, `${part.name}-stamens`);
  }
  try {
    for (let cane = 0; cane < 11; cane++) {
      signal?.throwIfAborted(); const angle = cane * 2.399963 + (rng() - .5) * .18, reach = .28 + rng() * .18, height = .34 + rng() * .18, root = V(Math.cos(angle) * .034, -.012, Math.sin(angle) * .034), out = V(Math.cos(angle), 0, Math.sin(angle)); roots.push(root.toArray());
      const points = [root, root.clone().addScaledVector(out, reach * .10).add(V(0, height * .72, 0)), root.clone().addScaledVector(out, reach * .63).add(V(0, height * 1.20, 0)), root.clone().addScaledVector(out, reach).add(V(0, height * .78, 0))], curve = new THREE.CubicBezierCurve3(...points), radius = .0032 + rng() * .0011;
      addWood(wood, curve, [radius, radius * .74, .00105, .00044], { segments: 38, radialSegments: 12 }); leafPairs(curve, angle + Math.PI / 2, 'main'); spray(curve.getPointAt(1), curve.getTangentAt(1), 14 + cane % 5, .00044);
      for (let fork = 0; fork < 4; fork++) {
        const t = .23 + fork * .175, anchor = curve.getPointAt(t), motherTangent = curve.getTangentAt(t), direction = V(Math.cos(angle + (fork % 2 ? -.9 : .9)), .05 + rng() * .10, Math.sin(angle + (fork % 2 ? -.9 : .9))).normalize(), length = .14 + rng() * .090;
        const endDirection = direction.multiplyScalar(.53).addScaledVector(motherTangent, .47).normalize(), tip = anchor.clone().addScaledVector(endDirection, length), branch = new THREE.CubicBezierCurve3(anchor, anchor.clone().addScaledVector(motherTangent, length * .32), tip.clone().addScaledVector(endDirection, -length * .30).add(V(0, .014, 0)), tip);
        const childRadius = (.00120 - fork * .00012) * (.88 + rng() * .14); addWood(wood, branch, [childRadius, childRadius * .66, .00031], { segments: 24, radialSegments: 10 }); leafPairs(branch, angle + fork * .8, 'lateral');
        joins.push({ kind: 'smooth-lateral-shoot', parentPoint: anchor.toArray(), motherTangent: motherTangent.toArray(), startTangent: branch.getTangentAt(0).toArray(), baseRadius: childRadius });
        if (fork === 1 || fork === 3) spray(branch.getPointAt(1), branch.getTangentAt(1), 12 + (cane + fork) % 5, .00031);
      }
    }
    const wg = wood.finish(), lg = leaves.finish(); wg.userData = { body: 'rooted-arching-shrub-wood', roots, joins }; lg.userData = { body: 'opposite-veined-leaf-pairs', leaves: leafCount };
    b.mesh(group, wg, b.wood, 'understory-shrub-connected-wood'); b.mesh(group, lg, b.leaf, 'understory-shrub-veined-leaves');
    group.userData = { ...group.userData, rootPoints: roots, leaves: leafCount, flowers: flowerCount, sprays: sprayCount, flowersOnAttachedPedicels: true, leafShoots: shootRecords, floweringShoots: flowerRecords, morphologyRevision: 'R2-continuous-slender-shoots-with-arc-spaced-leaves-and-racemes' };
  } finally { leaf.dispose(); for (const flower of blossoms) { flower.lamina.dispose(); flower.centre.dispose(); } }
}

/** Three authored reusable source forms, local metres and root datum zero.
 * New exhibition planting, not recovered historical vegetation. No terrain,
 * global placement, textures, wind, animation, or whole-garden distribution. */
export function createGardenUnderstoryStudy({ specimens = gardenUnderstorySpecs.map(s => s.id), arrangement = 'community', signal } = {}) {
  const selected = new Set(specimens); if (!selected.size || [...selected].some(id => !gardenUnderstorySpecs.some(s => s.id === id)) || !['community', 'specimens'].includes(arrangement)) throw new Error('Invalid understory study selection/arrangement.');
  signal?.throwIfAborted(); const b = owner(), group = new THREE.Group(), parts = []; group.name = 'garden-understory-study'; group.userData = { evidence: 'contemporary-exhibition-planting', historicalSpecimens: false, mainSceneAllowed: false, metresSurveyed: false, sourcePhotosAsTextures: false };
  const factories = { sedge, fern, 'flower-shrub': flowerShrub }, positions = arrangement === 'community' ? [[-.64, 0, .37], [-.03, 0, -.21], [.54, 0, .25]] : [[-1.25, 0, 0], [0, 0, 0], [1.28, 0, 0]];
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); b.dispose(); };
  try {
    for (const [i, spec] of gardenUnderstorySpecs.entries()) if (selected.has(spec.id)) {
      const part = b.group(group, `understory-${spec.id}`, { ...spec, evidence: 'botanically-informed-authored-form' }); parts.push(part); part.position.fromArray(selected.size === 1 ? [0, 0, 0] : positions[i]); factories[spec.id](b, part, signal);
    }
    group.updateMatrixWorld(true); let meshes = 0, triangles = 0; const buffers = new Set();
    group.traverse(node => { if (!node.isMesh) return; meshes++; triangles += node.geometry.index.count / 3; for (const a of [node.geometry.index, ...Object.values(node.geometry.attributes)]) buffers.add(a.array.buffer); });
    const bounds = new THREE.Box3().setFromObject(group), diagnostics = { id: 'garden-understory-study-r2', arrangement, specimens: parts.map(part => ({ id: part.userData.id, name: part.name, roots: part.userData.rootPoints.length, bounds: (() => { const box = new THREE.Box3().setFromObject(part); return { min: box.min.toArray(), max: box.max.toArray() }; })() })), meshes, triangles, geometries: b.geometries.size, materials: b.materials.size, textures: 0, uniqueBufferBytes: [...buffers].reduce((n, a) => n + a.byteLength, 0), bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, materialCoverage: 'opaque-real-curved-surfaces; double-sided thin leaves/petals; ordinary PBR AO/shadow passes', mainSceneAllowed: false, nativeReviewed: false, historicalIdentity: false, rootDatumY: 0, ownership: 'this study owns its exact buffers/materials; external shared placements must be detached before owner disposal' };
    return { group, parts, diagnostics, views: gardenUnderstoryStudyViews, dispose };
  } catch (error) { dispose(); throw error; }
}

export { gardenUnderstoryStudyViews } from './garden-understory-study-views.js';
