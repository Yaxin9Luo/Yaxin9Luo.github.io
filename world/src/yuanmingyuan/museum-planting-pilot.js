import * as THREE from 'three';
import { gardenLayout, pointInPolygon } from './garden-layout.js';
import { createGardenPlantingLayout, plantingDistanceToPolygon } from './garden-planting-layout.js';
import { createGardenVegetationStudy, gardenVegetationSpecs } from './garden-vegetation.js';
import { prepareLakeStoneTexturePixels, validateLakeStonePixels } from './vegetation-textures.js';

// Eight authored exhibition positions, not a recovered historical planting plan.
// Full R2 willow/juniper geometry was retained through the verified R4 freeze.
export const museumPlantingPilotSpec = Object.freeze({
  id: 'xianfa-north-lake-planting-pilot-r1',
  sourceFreeze: '0bf0b5c50cf2a8c380df4f5719ec3b88211f3974ef934b7f6f622a52f74bf933',
  placementIds: Object.freeze([
    'western-east-west-avenue-pair-031-left', 'western-east-west-avenue-pair-031-right',
    'western-east-west-avenue-pair-033-left', 'western-east-west-avenue-pair-033-right',
    'willow-shore-changchun-great-lake-2-2', 'willow-shore-changchun-great-lake-2-3',
  ]),
  fullSourceTriangles: Object.freeze({ willow: 7925316, juniper: 1251596, 'lake-rock': 241908 }),
  intendedCounts: Object.freeze({ juniper: 4, willow: 2, 'lake-rock': 2 }),
  allVisibleTrianglesPerPass: 21340832,
  nativeEvidence: Object.freeze({
    willow: 'work/yuanmingyuan/vegetation-native-review-r2.json: tree crown retained',
    juniper: 'work/yuanmingyuan/vegetation-native-review-r2.json: tree crown retained',
    lotus: 'work/yuanmingyuan/vegetation-native-review-r2.json: flower and leaf forms legible; not placed in this pilot',
    'lake-rock': 'work/yuanmingyuan/vegetation-native-review-r4.json: admit to composed-courtyard review',
  }),
});

export const museumPlantingPilotViews = Object.freeze([
  { id: 'planting-whole', label: '线法山两侧与西南北湖岸', groups: ['museum-planting-pilot'], direction: [-1, .6, 1], padding: 1.08 },
  { id: 'planting-willows', label: '两株完整垂柳', groups: ['museum-planting-willow-shore-changchun-great-lake-2-2', 'museum-planting-willow-shore-changchun-great-lake-2-3'], direction: [-1, .25, -1], padding: 1.15 },
  { id: 'planting-juniper-south', label: '南侧五层圆柏', groups: ['museum-planting-western-east-west-avenue-pair-031-right', 'museum-planting-western-east-west-avenue-pair-033-right'], direction: [-1, .24, 1], padding: 1.12 },
  { id: 'planting-rocks', label: '原型湖石与地面接触', groups: ['museum-planting-xianfa-pilot-lake-rock-1', 'museum-planting-xianfa-pilot-lake-rock-2'], direction: [-1, .28, 1], padding: 1.1 },
]);

const rootRadii = { willow: 1.45, juniper: .68, 'lake-rock': 1.45 };
const rootMeshes = { willow: 'willow-trunk-and-roots', juniper: 'juniper-visible-trunk', 'lake-rock': 'lake-rock-main' };
const specimenIds = ['willow', 'juniper', 'lake-rock'];
const plain = value => JSON.parse(JSON.stringify(value));
const finitePoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
const distance = (point, polygon) => (pointInPolygon(point, polygon) ? -1 : 1) * plantingDistanceToPolygon(point, polygon);
const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));

function stoneRecords(layout) {
  const site = layout.groups.find(group => group.id === 'xianfashan');
  if (!site) throw new Error('The planting pilot needs the Xianfashan layout anchor.');
  const yaw = site.placement.rotationY, scale = site.placement.scale, c = Math.cos(yaw), s = Math.sin(yaw);
  return [[-41, 58, .83, -.57, .045], [-25, 60, .94, 1.81, .095]].map(([x, z, size, rotation, burial], index) => ({
    id: `xianfa-pilot-lake-rock-${index + 1}`, species: 'lake-rock',
    position: [site.position[0] + (x * c + z * s) * scale, null, site.position[2] + (-x * s + z * c) * scale],
    rotation: [0, yaw + rotation, 0], scale: [size * scale, size * scale, size * scale], burial: burial * scale,
    zone: 'xianfa-southwest-lawn', regionId: site.regionId,
    envelope: { radius: 1.6 * size * scale, definition: 'conservative-rotated-source-XZ-circle' },
    evidence: { status: 'exhibition-design', surveyed: false, sourceIds: ['palace-cross-cultural-garden', 'material-lake-rock'], coordinateLayoutId: layout.id, limit: 'New placement of one authored stone prototype in two orientations; not a historical rock pair.' },
  }));
}

function reservationRecords(terrain, planting, layout, supplied) {
  const reservations = [...planting.reservations, ...supplied,
    ...(terrain.paths ?? []).map(path => ({ ...path, clearance: 1, kind: 'current-path' })),
    ...(terrain.courtFootprints ?? []).map(court => ({ ...court, clearance: 1, kind: 'current-court' })),
    ...[...layout.waterBodies, ...(layout.ornamentalWaters ?? []), ...(layout.channels ?? [])].map(water => ({ ...water, clearance: 2, kind: 'layout-water' })),
    ...(terrain.waterSurfaces ?? []).map(water => ({ ...water, clearance: 2, kind: 'current-water' })),
  ];
  // The current asset paths/courts are required in world XZ coordinates. Never
  // silently accept malformed reserves and then build through a missing road.
  for (const record of reservations) {
    if (!Array.isArray(record.polygon) || record.polygon.length < 3 || !record.polygon.every(finitePoint) || !Number.isFinite(record.clearance ?? 0) || (record.clearance ?? 0) < 0) throw new Error(`Invalid planting reservation: ${record.id ?? 'unnamed'}`);
  }
  return reservations;
}

function surfaceRecord(terrain, x, z) {
  const hit = terrain.surfaceAt(x, z, { includeBridges: true });
  if (!hit || !Number.isFinite(hit.height) || hit.supportSource !== 'terrain-triangle' || hit.kind !== 'land' || hit.walkable !== true || Number.isFinite(hit.waterY) && hit.height <= hit.waterY + .03) return { x, z, accepted: false, kind: hit?.kind ?? null, supportSource: hit?.supportSource ?? null, height: hit?.height ?? null };
  return { x, z, accepted: true, height: hit.height, kind: hit.kind, supportSource: hit.supportSource, geometry: hit.geometry?.name ?? null, triangleIndex: hit.triangleIndex ?? null, normal: hit.normal ? [...hit.normal] : null };
}

/** A cheap plan, evaluated against the caller's current terrain triangles.
 * No specimen is built. Invalid/missing positions remain explicit; none move
 * to an arbitrary nearby point. Dynamic roads/courts must be active beforehand. */
export function createMuseumPlantingPilotPlan({ terrain, layout = gardenLayout, plantingLayout = createGardenPlantingLayout({ layout }), reservedPolygons = [] } = {}) {
  if (typeof terrain?.surfaceAt !== 'function') throw new Error('The planting pilot requires the live terrain.surfaceAt triangle query.');
  const byId = new Map(plantingLayout.placements.map(record => [record.id, record]));
  const missing = museumPlantingPilotSpec.placementIds.filter(id => !byId.has(id));
  const records = museumPlantingPilotSpec.placementIds.filter(id => byId.has(id)).map(id => plain(byId.get(id))).concat(stoneRecords(layout));
  const reservations = reservationRecords(terrain, plantingLayout, layout, reservedPolygons), placements = [], rejected = missing.map(id => ({ id, reasons: [{ kind: 'missing-layout-placement' }] }));
  for (const record of records) {
    const [x, , z] = record.position, scale = record.scale[0], point = [x, z];
    if (!specimenIds.includes(record.species) || !finitePoint(point) || record.scale.some(value => !Number.isFinite(value) || value !== scale || value <= 0) || record.rotation.some(value => !Number.isFinite(value)) || record.rotation[0] !== 0 || record.rotation[2] !== 0 || !Number.isFinite(record.envelope.radius) || record.envelope.radius <= 0) throw new Error(`Invalid planting transform: ${record.id}`);
    const clearance = reservations.map(reserve => ({ id: reserve.id, kind: reserve.kind, margin: distance(point, reserve.polygon) - record.envelope.radius - (reserve.clearance ?? 0) })).sort((a, b) => a.margin - b.margin);
    const reasons = clearance.filter(item => item.margin <= 0);
    const garden = layout.gardens.find(garden => pointInPolygon(point, garden.boundary));
    if (!garden || plantingDistanceToPolygon(point, garden.boundary) <= record.envelope.radius + 2 || !pointInPolygon(point, layout.exhibition.coast.polygon) || plantingDistanceToPolygon(point, layout.exhibition.coast.polygon) <= record.envelope.radius + 3) reasons.push({ kind: 'garden-or-coast-clearance' });
    const rootRadius = rootRadii[record.species] * scale;
    const samples = [surfaceRecord(terrain, x, z), ...Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return surfaceRecord(terrain, x + Math.cos(a) * rootRadius, z + Math.sin(a) * rootRadius); })];
    if (samples.some(sample => !sample.accepted)) reasons.push({ kind: 'root-footprint-not-current-dry-terrain' });
    const heights = samples.filter(sample => sample.accepted).map(sample => sample.height), minHeight = Math.min(...heights), maxHeight = Math.max(...heights);
    // This bounded pilot uses gentle lawns. Reject a steep site rather than
    // deform a frozen tree/rock, float roots, or bury a large part of its trunk.
    if (maxHeight - minHeight > .18 * scale) reasons.push({ kind: 'root-footprint-height-range', range: maxHeight - minHeight, maximum: .18 * scale });
    const resolved = { ...record, layoutPosition: [...record.position], position: [x, minHeight - (record.burial ?? 0), z], heightReference: 'minimum-of-current-triangle-root-footprint', grounding: { sourceRootDatumY: 0, radius: rootRadius, samples, minimumHeight: minHeight, maximumHeight: maxHeight, additionalBurial: record.burial ?? 0, limit: 'Centre plus 16 actual triangle queries; native review still checks the complete root/soil seam.' }, nearestReserves: clearance.slice(0, 6) };
    if (reasons.length) rejected.push({ id: record.id, reasons, grounding: resolved.grounding }); else placements.push(resolved);
  }
  return { id: museumPlantingPilotSpec.id, coordinateLayoutId: layout.id, valid: rejected.length === 0 && placements.length === 8, placements, rejected, intendedCounts: { ...museumPlantingPilotSpec.intendedCounts }, allVisibleTrianglesPerPass: placements.reduce((sum, p) => sum + museumPlantingPilotSpec.fullSourceTriangles[p.species], 0), sourceFreeze: museumPlantingPilotSpec.sourceFreeze, historicallySurveyed: false, nativeCompositionReviewed: false };
}

export async function prepareMuseumPlantingPilotAssets({ signal } = {}) {
  return prepareLakeStoneTexturePixels({ signal });
}

function cloneShared(node, instanceViews) {
  if (node.isSkinnedMesh || node.isBatchedMesh || node.morphTargetInfluences || node.morphTexture) throw new Error('This pilot only accepts the static R4 specimen representation.');
  let copy;
  if (node.isInstancedMesh) {
    // Object3D.copy deliberately bypasses InstancedMesh.copy, which clones the
    // 304k willow leaf matrices/colors. Attribute object identity also avoids
    // duplicate WebGL buffer uploads, not just duplicate TypedArray storage.
    copy = new THREE.InstancedMesh(node.geometry, node.material, 0);
    copy.instanceMatrix = node.instanceMatrix; copy.instanceColor = node.instanceColor; copy.count = node.count;
    copy.boundingBox = node.boundingBox?.clone() ?? null; copy.boundingSphere = node.boundingSphere?.clone() ?? null;
    instanceViews.add(copy);
  } else if (node.isMesh) copy = new THREE.Mesh(node.geometry, node.material);
  else if (node.isGroup) copy = new THREE.Group();
  else if (node.type === 'Object3D') copy = new THREE.Object3D();
  else throw new Error(`Unsupported planting node ${node.type}`);
  THREE.Object3D.prototype.copy.call(copy, node, false);
  for (const key of ['onBeforeRender', 'onAfterRender', 'onBeforeShadow', 'onAfterShadow', 'customDepthMaterial', 'customDistanceMaterial']) copy[key] = node[key];
  for (const child of node.children) copy.add(cloneShared(child, instanceViews));
  return copy;
}

function resourceStats(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), attributes = new Set(), buffers = new Set();
  let meshes = 0, instances = 0, triangles = 0;
  group.traverse(node => {
    if (!node.isMesh) return;
    meshes++; const count = node.isInstancedMesh ? node.count : 1;
    instances += node.isInstancedMesh ? node.count : 0;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * count;
    geometries.add(node.geometry);
    for (const attribute of [node.geometry.index, ...Object.values(node.geometry.attributes), node.instanceMatrix, node.instanceColor].filter(Boolean)) { attributes.add(attribute); buffers.add((attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array).buffer); }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { meshes, instances, trianglesPerPass: triangles, uniqueGeometries: geometries.size, uniqueMaterials: materials.size, uniqueTextures: textures.size, uniqueAttributes: attributes.size, uniqueArrayBuffers: buffers.size, geometryAndInstanceBytes: [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0) };
}

function rootContact(part, record, terrain) {
  const root = part.getObjectByName(rootMeshes[record.species]);
  if (!root?.isMesh || root.isInstancedMesh) throw new Error(`Missing original root geometry for ${record.id}`);
  const p = root.geometry.attributes.position, inverse = new THREE.Matrix4().copy(part.matrixWorld).invert(), local = new THREE.Matrix4().multiplyMatrices(inverse, root.matrixWorld), v = new THREE.Vector3();
  let selected = 0, submerged = 0, minimumGap = Infinity, maximumGap = -Infinity;
  const witness = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(local);
    if (v.y > 0) continue;
    v.fromBufferAttribute(p, i).applyMatrix4(root.matrixWorld);
    const hit = terrain.surfaceAt(v.x, v.z, { includeBridges: true });
    if (!hit || !Number.isFinite(hit.height) || hit.kind !== 'land' || hit.supportSource !== 'terrain-triangle') throw new Error(`Root geometry left valid terrain: ${record.id}`);
    const gap = v.y - hit.height; selected++; if (gap <= 0) submerged++;
    minimumGap = Math.min(minimumGap, gap); maximumGap = Math.max(maximumGap, gap);
    if (witness.length < 4) witness.push({ sourceVertex: i, world: v.toArray(), terrainY: hit.height, gap, geometry: hit.geometry?.name ?? null, triangleIndex: hit.triangleIndex ?? null });
  }
  if (!selected || submerged !== selected) throw new Error(`Exposed below-datum root vertices: ${record.id} (${submerged}/${selected})`);
  return { mesh: root.name, sourceVerticesAtOrBelowDatum: selected, belowCurrentTerrain: submerged, minimumGap, maximumGap, witness, criterion: 'Every original vertex at/below source root datum is at/below actual terrain; no root geometry changed.' };
}

/** The caller mounts only result.group, in the layout's world coordinates.
 * Fresh source owners belong exclusively to this pilot; all placements borrow
 * their exact geometry/material/instance attributes for the whole pilot lifetime.
 * Do not separately dispose a placement or move/scale the completed world group.
 * Activate current terrain replacements before calling this async factory.
 * createSpecimen/yieldControl support bounded CPU fixtures and scheduled loading. */
export async function createMuseumPlantingPilot({ terrain, layout = gardenLayout, plantingLayout, reservedPolygons, stonePixels, signal, createSpecimen = createGardenVegetationStudy, yieldControl = yieldFrame, onProgress = () => {}, sourceProvenance = null } = {}) {
  signal?.throwIfAborted();
  const plan = createMuseumPlantingPilotPlan({ terrain, layout, ...(plantingLayout ? { plantingLayout } : {}), ...(reservedPolygons ? { reservedPolygons } : {}) });
  if (!plan.valid) { const error = new Error(`Planting pilot has ${plan.rejected.length} invalid anchors; no specimen constructed.`); error.plan = plan; throw error; }
  if (createSpecimen === createGardenVegetationStudy) validateLakeStonePixels(stonePixels);
  const group = new THREE.Group(); group.name = 'museum-planting-pilot';
  group.userData = { body: 'authored-small-planting-community', evidence: 'exhibition-design', fullGardenDistribution: false, sourceFreeze: plan.sourceFreeze };
  const owners = [], instanceViews = new Set(), parts = [], prototypes = {};
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    const errors = [], run = action => { try { action(); } catch (error) { errors.push(error); } };
    // All shared users leave the render graph before any attribute is released.
    run(() => group.removeFromParent()); run(() => group.clear());
    for (const part of parts) run(() => part.clear());
    for (const view of instanceViews) run(() => view.dispose());
    for (const owner of owners.reverse()) run(() => owner.dispose());
    instanceViews.clear(); owners.length = 0;
    if (errors.length) throw new AggregateError(errors, 'Planting pilot disposal failed');
  };
  try {
    for (const id of specimenIds) {
      signal?.throwIfAborted(); onProgress({ phase: 'source-start', species: id });
      const owner = await createSpecimen({ specimens: [id], arrange: false, ...(id === 'lake-rock' ? { texturePixels: { stone: stonePixels } } : {}) });
      if (!owner?.group?.isObject3D || typeof owner.dispose !== 'function') throw new Error(`Invalid ${id} source owner.`);
      owners.push(owner); signal?.throwIfAborted();
      const source = owner.specimens?.find(part => part.userData.id === id);
      if (!source || owner.group.parent) throw new Error(`The ${id} source must be a detached, individually constructed owner.`);
      const box = new THREE.Box3().setFromObject(source);
      prototypes[id] = { sourceIds: [...gardenVegetationSpecs.find(spec => spec.id === id).sourceIds], ...resourceStats(source), localBounds: { min: box.min.toArray(), max: box.max.toArray() } };
      for (const record of plan.placements.filter(record => record.species === id)) {
        const part = new THREE.Group(); part.name = `museum-planting-${record.id}`; part.userData = { placementId: record.id, species: id, sourceIds: prototypes[id].sourceIds, evidence: record.evidence, rootDatumY: record.position[1] };
        part.position.fromArray(record.position); part.rotation.fromArray([...record.rotation, 'XYZ']); part.scale.fromArray(record.scale);
        part.add(cloneShared(source, instanceViews)); group.add(part); parts.push(part);
      }
      onProgress({ phase: 'source-ready', species: id, ...prototypes[id] });
      await yieldControl(); signal?.throwIfAborted();
    }
    group.updateMatrixWorld(true);
    const contacts = parts.map(part => { const record = plan.placements.find(record => record.id === part.userData.placementId); return { id: record.id, ...rootContact(part, record, terrain) }; });
    const diagnostics = { id: plan.id, plan, sourceProvenance, sourceFactory: createSpecimen === createGardenVegetationStudy ? 'frozen-full-source' : 'caller-supplied-fixture', prototypes, ...resourceStats(group), rootContacts: contacts, instanceAttributesSharedByIdentity: true, representation: 'full-source-per-placement-frustum-culling', nativeCompositionReviewed: false, fullGardenDistribution: false, limitations: ['Per-pass triangles still multiply with visible specimens; sharing buffers is not a distant-tree solution.', 'This eight-object pilot has no distance fade or LOD and does not change the renderer, AO, lighting, water reflection or shadow quality.', 'Identical botanical and rock source forms repeat in different authored placements; composition requires native review.'] };
    return { group, parts, diagnostics, views: museumPlantingPilotViews, dispose };
  } catch (error) {
    try { dispose(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Planting pilot construction and cleanup failed'); }
    throw error;
  }
}
