// Pure exhibition planting data. No asset factory, Three.js, DOM or global RNG.
// Historical sources support planting relationships, never these individual positions.
import { gardenLayout, pointInPolygon } from './garden-layout.js';

export const plantingSources = Object.freeze({
  'park-historical-planting': Object.freeze({ title: '圆明园管理处：历史特点', url: 'https://www.yuanmingyuanpark.cn/ylxs/zwhh/201012/t20101206_227337.html', scope: 'Pine/cypress on hills, informal waterside willow, sparse aquatic planting and open Fuhai; no individual coordinates.' }),
  'western-topiary-research': Object.freeze({ title: '朱翊纶、曹新：图像学视角下圆明园西洋楼几何学设计方法探源，3.3.3、图7', url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html', scope: 'Clipped juniper in axial geometric arrangements, transitioning to natural planting away from architecture; no measured spacing.' }),
  'park-landscape-research': Object.freeze({ title: '杨振铎：略论圆明园遗址公园风貌', url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj013/201012/t20101223_229305.html', scope: 'Landscape research and protection discussion, including evergreen hill backgrounds and waterside planting; not an 1860 planting survey.' }),
  'public-three-garden-diagram': Object.freeze({ title: 'Public three-garden diagram used by garden-layout.js', url: 'https://commons.wikimedia.org/wiki/File:Yuanmingyuan_plan.jpg', scope: 'Unregistered, manually generalized water/land relationships. Its working-unit scale does not establish measured metres.' }),
  'exhibition-planting-design': Object.freeze({ title: 'Contemporary exhibition planting design', document: 'docs/art/yuanmingyuan/planting-layout-report.md', scope: 'All plant coordinates, specimen selection, spacing, heights, reserves and viewing corridors are authored.' }),
});

// Conservative circles enclose the frozen R3 specimens' local XZ bounding boxes
// at every yaw. These are specimen envelopes, not historical botanical measurements.
export const plantingSpecies = Object.freeze({
  willow: Object.freeze({ radius: 6.5, height: 8.4, habitat: 'land', sourceIds: Object.freeze(['park-historical-planting', 'park-landscape-research']) }),
  pine: Object.freeze({ radius: 6.0, height: 8.3, habitat: 'land', sourceIds: Object.freeze(['park-historical-planting', 'park-landscape-research']) }),
  juniper: Object.freeze({ radius: 2.4, height: 5.7, habitat: 'land', sourceIds: Object.freeze(['western-topiary-research']) }),
  lotus: Object.freeze({ radius: 3.2, height: 2.0, habitat: 'water', sourceIds: Object.freeze(['park-historical-planting']) }),
});

const TAU = Math.PI * 2, EPS = 1e-7, xz = ([x, , z]) => [x, z];
const clamp = value => Math.max(0, Math.min(1, value));
const copyRing = ring => ring.map(p => [...p]);
const signedArea = ring => ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const bounds = ring => ({ minX: Math.min(...ring.map(p => p[0])), maxX: Math.max(...ring.map(p => p[0])), minZ: Math.min(...ring.map(p => p[1])), maxZ: Math.max(...ring.map(p => p[1])) });
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS;

function randomFor(seed, id) {
  let state = 2166136261;
  for (const char of `${seed}:${id}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => { let t = state += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  const t = length2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function plantingDistanceToPolygon(point, polygon) {
  return polygon.reduce((best, a, i) => Math.min(best, segmentDistance(point, a, polygon[(i + 1) % polygon.length])), Infinity);
}
function diskInside(point, radius, ring) { return pointInPolygon(point, ring) && plantingDistanceToPolygon(point, ring) >= radius; }
function diskTouches(point, radius, ring) { return pointInPolygon(point, ring) || plantingDistanceToPolygon(point, ring) <= radius; }
function intersects(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0 ||
    Math.abs(abC) < EPS && segmentDistance(c, a, b) < EPS || Math.abs(abD) < EPS && segmentDistance(d, a, b) < EPS ||
    Math.abs(cdA) < EPS && segmentDistance(a, c, d) < EPS || Math.abs(cdB) < EPS && segmentDistance(b, c, d) < EPS;
}
function normalizeReservation(input, index) {
  const source = Array.isArray(input) ? { polygon: input } : input;
  if (!source || !Array.isArray(source.polygon) || source.holes?.length) throw new TypeError(`reservedPolygons[${index}] requires one simple XZ polygon`);
  const ring = copyRing(source.polygon);
  if (ring.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw new TypeError(`reservedPolygons[${index}] has a non-finite XZ point`);
  if (ring.length > 1 && samePoint(ring[0], ring.at(-1))) ring.pop();
  if (ring.length < 3 || Math.abs(signedArea(ring)) < EPS || ring.some((p, i) => samePoint(p, ring[(i + 1) % ring.length]))) throw new TypeError(`reservedPolygons[${index}] has a degenerate polygon`);
  for (let i = 0; i < ring.length; i++) for (let j = i + 2; j < ring.length; j++) {
    if (i === 0 && j === ring.length - 1) continue;
    if (intersects(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) throw new TypeError(`reservedPolygons[${index}] intersects itself`);
  }
  const clearance = source.clearance ?? 0;
  if (!Number.isFinite(clearance) || clearance < 0) throw new TypeError(`reservedPolygons[${index}] clearance must be finite and nonnegative`);
  return { id: source.id ?? `caller-reserved-${index + 1}`, kind: source.kind ?? 'caller-reserved', polygon: ring, clearance, evidence: 'caller-supplied-exclusion' };
}
function segmentPolygon(a, b, startWidth, endWidth = startWidth, extension = 0) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (length < EPS) throw new TypeError('A planting corridor must have distinct endpoints');
  const tx = dx / length, tz = dz / length, nx = -tz, nz = tx;
  const from = [a[0] - tx * extension, a[1] - tz * extension], to = [b[0] + tx * extension, b[1] + tz * extension];
  return [[from[0] + nx * startWidth / 2, from[1] + nz * startWidth / 2], [to[0] + nx * endWidth / 2, to[1] + nz * endWidth / 2], [to[0] - nx * endWidth / 2, to[1] - nz * endWidth / 2], [from[0] - nx * startWidth / 2, from[1] - nz * startWidth / 2]];
}
function localPoint(group, [x, z]) {
  const yaw = group.placement?.rotationY ?? 0, scale = group.placement?.scale ?? 1, c = Math.cos(yaw), s = Math.sin(yaw);
  return [group.position[0] + (x * c + z * s) * scale, group.position[2] + (-x * s + z * c) * scale];
}

// Broad authored no-plant envelopes, not the buildings' actual footprints.
// Callers must additionally supply current architecture/court/road polygons.
const westernEnvelopes = {
  xieqiqu: [-60, 60, -50, 70], huanghuazhen: [-50, 50, -55, 55], yangquelong: [-40, 40, -30, 30],
  fangwaiguan: [-22, 22, -20, 20], wuzhuting: [-25, 25, -15, 15], haiyantang: [-43, 43, -43, 58],
  yuanyingguan: [-62, 62, -72, 40], xianfashan: [-44, 44, -39, 39], xianfahua: [-164, 60, -28, 28],
};
function defaultReservations(layout) {
  const records = [], groups = new Map((layout.groups ?? []).map(g => [g.id, g]));
  const add = (id, kind, polygon, extra = {}) => records.push({ id, kind, polygon, clearance: 1.5, evidence: 'exhibition-design', ...extra });
  for (const group of groups.values()) {
    const radius = Math.max(36, Math.min(72, (group.heightHint ?? 14) * 3));
    const [x0, x1, z0, z1] = westernEnvelopes[group.id] ?? [-radius, radius, -radius, radius];
    add(`building-${group.id}`, 'building-envelope', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(p => localPoint(group, p)));
    // The complete facade remains visible through a trapezoid from its front.
    if (group.id === 'xianfahua' || group.facing === 'east-and-west') {
      const sides = group.id === 'xianfahua' ? [-1] : [-1, 1];
      for (const side of sides) {
        const length = Math.max(100, Math.abs(side < 0 ? x0 : x1) + 50);
        add(`view-${group.id}-${side < 0 ? 'west' : 'east'}`, 'building-view', [[0, z0 - 5], [0, z1 + 5], [side * length, 7], [side * length, -7]].map(p => localPoint(group, p)));
      }
    } else {
      const length = Math.max(100, z1 + 50), polygon = [[x0 - 5, 0], [x1 + 5, 0], [7, length], [-7, length]].map(p => localPoint(group, p));
      add(`view-${group.id}`, 'building-view', polygon);
    }
  }
  for (const bridge of layout.bridges ?? []) add(`approach-${bridge.id}`, 'bridge-approach', segmentPolygon(xz(bridge.from), xz(bridge.to), bridge.width + 10, bridge.width + 10, 20));
  const connect = (id, a, b, width) => { if (groups.has(a) && groups.has(b)) add(id, 'landmark-view', segmentPolygon(xz(groups.get(a).position), xz(groups.get(b).position), width)); };
  connect('view-fuhai-islands-to-fanghu', 'pengdao-yaotai', 'fanghu-shengjing', 52);
  connect('view-houhu-north-south', 'jiuzhou-qingyan', 'jiuzhou-north', 30);
  connect('view-changchun-islands', 'haiyue-kaijin', 'hanjingtang', 28);
  connect('view-western-long-axis', 'yangquelong', 'xianfahua', 20);
  connect('view-western-north-south-axis', 'huanghuazhen', 'xieqiqu', 14);
  return records;
}

function waterAt(point, context) {
  if (context.islands.some(island => pointInPolygon(point, island.polygon))) return null;
  return context.waters.find(water => pointInPolygon(point, water.polygon)) ?? null;
}
function dryDisk(point, radius, context) {
  const island = context.islands.find(record => pointInPolygon(point, record.polygon));
  if (island) return diskInside(point, radius, island.polygon);
  return !context.waters.some(water => diskTouches(point, radius, water.polygon));
}
function groundHeight(point, garden, context) {
  let height = garden.groundY ?? context.layout.exhibition.groundY;
  for (const hill of context.layout.landforms ?? []) if (pointInPolygon(point, hill.polygon)) {
    const t = clamp(plantingDistanceToPolygon(point, hill.polygon) / Math.max(.01, plantingDistanceToPolygon(xz(hill.center), hill.polygon)));
    height = Math.max(height, hill.baseY + (hill.peakY - hill.baseY) * t * t * (3 - 2 * t));
  }
  return height;
}
function allowed(candidate, context) {
  const { point, species, scale, waterId } = candidate, radius = plantingSpecies[species].radius * scale;
  const garden = context.layout.gardens.find(g => diskInside(point, radius + 2, g.boundary));
  if (!garden || !diskInside(point, radius + 3, context.layout.exhibition.coast.polygon)) return { reason: 'garden-or-coast-clearance' };
  const water = waterAt(point, context);
  if (species === 'lotus') {
    if (!water || water.id !== waterId || water.id === 'fuhai' || !context.lakes.has(water.id)) return { reason: 'lotus-water-habitat' };
    if (!diskInside(point, radius + .7, water.polygon) || context.islands.some(island => diskTouches(point, radius + .7, island.polygon))) return { reason: 'lotus-shore-clearance' };
    if ([...(context.layout.channels ?? []), ...(context.layout.ornamentalWaters ?? [])].some(route => diskTouches(point, radius + .7, route.polygon))) return { reason: 'aquatic-route-clearance' };
    const shoreDistance = Math.min(plantingDistanceToPolygon(point, water.polygon), ...context.islands.filter(island => island.waterId === water.id).map(island => plantingDistanceToPolygon(point, island.polygon)));
    if (shoreDistance > 18) return { reason: 'open-water-reserve' };
  } else if (water || !dryDisk(point, radius + 2, context)) return { reason: 'tree-dry-ground-clearance' };
  for (const reservation of context.reservations) if (diskTouches(point, radius + reservation.clearance, reservation.polygon)) return { reason: reservation.kind };
  return { garden, water, radius, height: water ? water.surfaceY : groundHeight(point, garden, context) };
}

function ringSampler(source) {
  const ring = signedArea(source) < 0 ? [...source].reverse() : source, lengths = ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); });
  const perimeter = lengths.reduce((sum, value) => sum + value, 0);
  return { perimeter, at(distance) {
    let offset = (distance % perimeter + perimeter) % perimeter;
    for (let i = 0; i < ring.length; i++) {
      if (offset > lengths[i] && i < ring.length - 1) { offset -= lengths[i]; continue; }
      const a = ring[i], b = ring[(i + 1) % ring.length], tx = (b[0] - a[0]) / lengths[i], tz = (b[1] - a[1]) / lengths[i];
      return { point: [a[0] + tx * offset, a[1] + tz * offset], outward: [tz, -tx] };
    }
  } };
}

/** Return only JSON-compatible data; no instances are constructed or placed.
 * reservedPolygons: XZ rings or {id, polygon, clearance?} in this layout's frame.
 * A closed final vertex and either winding are accepted; self-intersections fail.
 */
export function createGardenPlantingLayout({ layout = gardenLayout, seed = 'yuanming-planting-exhibition-v1', reservedPolygons = [] } = {}) {
  if (!Array.isArray(reservedPolygons)) throw new TypeError('reservedPolygons must be an array');
  if (typeof seed !== 'string' && !(typeof seed === 'number' && Number.isFinite(seed))) throw new TypeError('seed must be a string or finite number');
  const callerReservations = reservedPolygons.map(normalizeReservation), reservations = defaultReservations(layout), zones = [], batches = [];
  const context = { layout, reservations, waters: [...layout.waterBodies, ...(layout.ornamentalWaters ?? []), ...(layout.channels ?? [])], islands: layout.islands ?? [], lakes: new Map(layout.waterBodies.map(w => [w.id, w])) };
  const groupMap = new Map((layout.groups ?? []).map(g => [g.id, g]));
  const zone = (id, type, details) => { const value = { id, type, evidence: 'exhibition-design', ...details }; zones.push(value); return value; };
  const candidate = (id, species, point, scale, yaw, zoneId, extra = {}) => ({ id, species, point, scale, yaw, zoneId, ...extra });
  const addAvenue = (id, a, b, offset, spacing = 15) => {
    if (!a || !b) return;
    const rng = randomFor(seed, id), length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length;
    zone(id, 'paired-clipped-juniper', { axis: [[...a], [...b]], rowOffset: offset, spacing, sourceIds: ['western-topiary-research'] });
    const count = Math.floor(length / spacing + 1e-10), inset = (length - count * spacing) / 2;
    for (let i = 0; i <= count; i++) {
      const t = (inset + i * spacing) / length, scale = .83 + rng() * .17, pairId = `${id}-pair-${String(i).padStart(3, '0')}`;
      batches.push([-1, 1].map(side => candidate(`${pairId}-${side < 0 ? 'left' : 'right'}`, 'juniper', [a[0] + (b[0] - a[0]) * t + nx * offset * side, a[1] + (b[1] - a[1]) * t + nz * offset * side], scale, rng() * .12 - .06, id, { pairId })));
    }
  };
  const position = id => groupMap.has(id) ? xz(groupMap.get(id).position) : null;
  addAvenue('western-east-west-avenue', position('yangquelong'), position('xianfahua'), 44);
  addAvenue('western-maze-to-xieqiqu', position('huanghuazhen'), position('xieqiqu'), 20, 14);
  const yuanying = groupMap.get('yuanyingguan'), xieqiqu = groupMap.get('xieqiqu');
  if (yuanying) addAvenue('yuanyingguan-outer-court', localPoint(yuanying, [0, -64]), localPoint(yuanying, [0, 53]), 71, 15);
  if (xieqiqu) addAvenue('xieqiqu-south-approach', localPoint(xieqiqu, [0, 75]), localPoint(xieqiqu, [0, 133]), 25, 14);

  for (const lake of layout.waterBodies) {
    const rings = [{ id: lake.id, polygon: lake.polygon, drySide: 1 }, ...context.islands.filter(i => i.waterId === lake.id).map(i => ({ id: i.id, polygon: i.polygon, drySide: -1 }))];
    for (const shore of rings) {
      const sampler = ringSampler(shore.polygon), willowId = `willow-shore-${shore.id}`, rng = randomFor(seed, willowId);
      zone(willowId, 'informal-willow-shore', { waterId: lake.id, shoreId: shore.id, sourceIds: ['park-historical-planting'] });
      for (let distance = 25 + rng() * 90, patch = 0; distance < sampler.perimeter; distance += 150 + rng() * 85, patch++) {
        // A whole open interval between small, irregular groups keeps water visible.
        if (rng() < .17) continue;
        const count = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
          const scale = .76 + rng() * .33, offset = 10 + rng() * 7, sample = sampler.at(distance + (i - (count - 1) / 2) * (13 + rng() * 5));
          const point = sample.point.map((value, axis) => value + sample.outward[axis] * offset * shore.drySide);
          batches.push([candidate(`${willowId}-${patch}-${i}`, 'willow', point, scale, rng() * TAU, willowId)]);
        }
      }
      // Fuhai stays entirely open. Ornamental waters and transport channels are
      // never candidates because this loop only visits main lakes.
      if (lake.id === 'fuhai' || lake.id === 'north-garden-water') continue;
      const lotusId = `lotus-shore-${shore.id}`, lotusRandom = randomFor(seed, lotusId);
      zone(lotusId, 'sparse-nearshore-lotus', { waterId: lake.id, shoreId: shore.id, maximumShoreDistance: 18, maximumLakeCoverage: .01, sourceIds: ['park-historical-planting'] });
      for (let distance = 45 + lotusRandom() * 120, patch = 0; distance < sampler.perimeter; distance += 235 + lotusRandom() * 130, patch++) {
        if (lotusRandom() < .24) continue;
        const count = 2 + Math.floor(lotusRandom() * 4);
        for (let i = 0; i < count; i++) {
          const scale = .72 + lotusRandom() * .30, offset = 6 + lotusRandom() * 8, sample = sampler.at(distance + (i - (count - 1) / 2) * (5.5 + lotusRandom() * 2.5));
          const point = sample.point.map((value, axis) => value - sample.outward[axis] * offset * shore.drySide);
          batches.push([candidate(`${lotusId}-${patch}-${i}`, 'lotus', point, scale, lotusRandom() * TAU, lotusId, { waterId: lake.id })]);
        }
      }
    }
  }

  const grove = (id, polygon, centreSpacing, clusterRadius, attempts, kind) => {
    const rng = randomFor(seed, id), box = bounds(polygon);
    // A translated 66-unit ridge must not jump from one cell to two because its
    // subtraction becomes 66.00000000000001 in one coordinate frame.
    const cells = span => Math.max(1, Math.ceil(span / centreSpacing - 1e-10));
    const columns = cells(box.maxX - box.minX), rows = cells(box.maxZ - box.minZ), centres = [];
    if (kind === 'natural-pine-groves') {
      // Irregularly separated groups, rather than a repeated orchard lattice.
      const target = Math.max(1, Math.round(Math.abs(signedArea(polygon)) / centreSpacing ** 2 * .72));
      for (let trial = 0; trial < target * 30 && centres.length < target; trial++) {
        const point = [box.minX + rng() * (box.maxX - box.minX), box.minZ + rng() * (box.maxZ - box.minZ)];
        if (!pointInPolygon(point, polygon) || waterAt(point, context) || centres.some(c => Math.hypot(c[0] - point[0], c[1] - point[1]) < centreSpacing * .72)) continue;
        centres.push(point);
      }
    } else for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const point = [box.minX + (column + .5 + (rng() - .5) * .35) / columns * (box.maxX - box.minX), box.minZ + (row + .5 + (rng() - .5) * .35) / rows * (box.maxZ - box.minZ)];
      if (pointInPolygon(point, polygon)) centres.push(point);
    }
    zone(id, kind, { polygon: copyRing(polygon), centres: centres.map(p => [...p]), centreSpacing, clusterRadius, sourceIds: ['park-historical-planting', 'park-landscape-research'] });
    for (let patch = 0; patch < centres.length; patch++) {
      const centre = centres[patch], reach = clusterRadius * (.75 + rng() * .50), count = Math.round(attempts * (.70 + rng() * .60));
      for (let i = 0; i < count; i++) {
        const a = rng() * TAU, distance = Math.sqrt(rng()) * reach, point = [centre[0] + Math.cos(a) * distance, centre[1] + Math.sin(a) * distance];
        if (!pointInPolygon(point, polygon)) continue;
        // Keep informal groves out of the entire Western Palace parcel.
        const western = layout.metricFrames?.westernPalaces?.origin;
        if (western && point[0] > western[0] - 440 && point[1] < western[2] + 142) continue;
        batches.push([candidate(`${id}-${patch}-${i}`, 'pine', point, .78 + rng() * .35, rng() * TAU, id)]);
      }
    }
  };
  for (const hill of layout.landforms ?? []) if (hill.id !== 'xianfa-hill') grove(`pine-mound-${hill.id}`, hill.polygon, 66, 26, 15, 'mound-pine-groves');
  for (const garden of layout.gardens) grove(`pine-interior-${garden.id}`, garden.boundary, 195, 43, 17, 'natural-pine-groves');

  const accepted = [], rejected = {}, usedLakeArea = new Map(), candidateCount = batches.reduce((sum, batch) => sum + batch.length, 0);
  const countRejection = (reason, count) => { rejected[reason] = (rejected[reason] ?? 0) + count; };
  const lakeArea = lake => Math.abs(signedArea(lake.polygon)) - context.islands.filter(i => i.waterId === lake.id).reduce((sum, i) => sum + Math.abs(signedArea(i.polygon)), 0);
  for (const batch of batches) {
    const checks = batch.map(c => allowed(c, context)), failure = checks.find(check => check.reason);
    if (failure) { countRejection(failure.reason, batch.length); continue; }
    if (batch.some((c, i) => accepted.some(p => Math.hypot(p.position[0] - c.point[0], p.position[2] - c.point[1]) < (p.envelope.radius + checks[i].radius) * .86))) { countRejection('specimen-spacing', batch.length); continue; }
    if (batch[0].species === 'lotus') {
      const id = batch[0].waterId, area = Math.PI * checks[0].radius ** 2;
      if ((usedLakeArea.get(id) ?? 0) + area > lakeArea(context.lakes.get(id)) * .01) { countRejection('lotus-coverage-cap', batch.length); continue; }
      usedLakeArea.set(id, (usedLakeArea.get(id) ?? 0) + area);
    }
    for (let i = 0; i < batch.length; i++) {
      const c = batch[i], check = checks[i];
      accepted.push({
        id: c.id, species: c.species, position: [c.point[0], check.height, c.point[1]], rotation: [0, c.yaw, 0], scale: [c.scale, c.scale, c.scale], zone: c.zoneId, regionId: check.garden.id,
        ...(c.pairId ? { pairId: c.pairId } : {}),
        habitat: { kind: plantingSpecies[c.species].habitat, ...(check.water ? { waterId: check.water.id } : {}) },
        envelope: { radius: check.radius, height: plantingSpecies[c.species].height * c.scale, definition: 'conservative-rotated-specimen-XZ-circle' },
        heightReference: check.water ? 'layout-waterline-anchor' : 'layout-ground-estimate-requires-terrain-alignment',
        evidence: { status: 'exhibition-design', surveyed: false, sourceIds: [...plantingSpecies[c.species].sourceIds, 'public-three-garden-diagram', 'exhibition-planting-design'], coordinateLayoutId: layout.id },
      });
    }
  }
  // Reserve filtering happens AFTER stable candidate spacing and density checks.
  // Adding a building or road cannot reshuffle previously chosen plant positions.
  const removedPairs = new Set(), removedIds = new Set();
  for (const p of accepted) if (callerReservations.some(r => diskTouches(xz(p.position), p.envelope.radius + r.clearance, r.polygon))) {
    removedIds.add(p.id); if (p.pairId) removedPairs.add(p.pairId);
  }
  const placements = accepted.filter(p => !removedIds.has(p.id) && !removedPairs.has(p.pairId));
  const counts = key => Object.fromEntries([...new Set(placements.map(p => p[key]))].map(value => [value, placements.filter(p => p[key] === value).length]));
  const lotusCoverage = layout.waterBodies.map(lake => {
    const area = placements.filter(p => p.habitat.waterId === lake.id).reduce((sum, p) => sum + Math.PI * p.envelope.radius ** 2, 0), waterArea = lakeArea(lake);
    return { waterId: lake.id, projectedEnvelopeArea: area, waterArea, fraction: waterArea > 0 ? area / waterArea : 0, sourcePolicy: lake.id === 'fuhai' ? 'keep-fuhai-open' : 'sparse-nearshore-only' };
  });
  return {
    schemaVersion: 1, id: 'yuanming-exhibition-planting-layout-v1', layoutId: layout.id, seed, status: 'authored-layout-awaiting-integration-and-native-review', registration: { status: 'unregistered', surveyedPlantPositions: false },
    placements, zones, reservations: [...reservations, ...callerReservations], sources: Object.fromEntries(Object.entries(plantingSources).map(([id, source]) => [id, { ...source }])),
    diagnostics: { candidateCount, baselineCount: accepted.length, placementCount: placements.length, rejected, callerReservationRemoved: accepted.length - placements.length, speciesCounts: counts('species'), regionCounts: counts('regionId'), zoneCounts: counts('zone'), lotusCoverage, inputArchitectureReservations: callerReservations.length, geometryConstructed: false, nativeReviewPassed: false },
    limits: [
      'Every plant position, grove, row, reserve, season and specimen scale is exhibition design, not a recovered 1859–1860 individual or a registered archaeological plan.',
      'Default building envelopes and viewing corridors are conservative authoring aids, not complete actual architecture or road footprints; supply those through reservedPolygons before integration.',
      'Land Y is the coarse layout height estimate. Integration must sample actual terrain triangles and check root contact without exposing buried roots; lotus Y is a waterline anchor, not the lake bed.',
      'These four specimen types are a limited exhibition palette, not the full historical flora. Lake rocks and future broadleaf species require separate placement decisions.',
      'No vegetation asset is instantiated here. Density, visibility, materials and distance representations still require native review before main-scene placement.',
    ],
  };
}
