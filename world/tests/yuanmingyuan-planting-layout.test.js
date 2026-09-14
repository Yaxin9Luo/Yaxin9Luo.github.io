import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gardenLayout, pointInPolygon, waterAt } from '../src/yuanmingyuan/garden-layout.js';
import { createGardenPlantingLayout, plantingDistanceToPolygon, plantingSpecies } from '../src/yuanmingyuan/garden-planting-layout.js';

const before = JSON.stringify(gardenLayout), plan = createGardenPlantingLayout(), xz = p => [p[0], p[2]];
const diskTouches = (p, radius, ring) => pointInPolygon(p, ring) || plantingDistanceToPolygon(p, ring) <= radius;
const square = (p, size) => [[p[0] - size, p[1] - size], [p[0] + size, p[1] - size], [p[0] + size, p[1] + size], [p[0] - size, p[1] + size]];
const rimPoints = (p, radius) => Array.from({ length: 24 }, (_, i) => [p[0] + Math.cos(i * Math.PI / 12) * radius, p[1] + Math.sin(i * Math.PI / 12) * radius]);

test('the module returns reproducible pure data for all three gardens without importing assets', () => {
  assert.deepEqual(createGardenPlantingLayout(), plan);
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
  assert.deepEqual(new Set(plan.placements.map(p => p.species)), new Set(['willow', 'pine', 'juniper', 'lotus']));
  assert.deepEqual(new Set(plan.placements.map(p => p.regionId)), new Set(gardenLayout.gardens.map(g => g.id)));
  assert.equal(plan.diagnostics.geometryConstructed, false);
  assert.equal(plan.diagnostics.nativeReviewPassed, false);
  const source = readFileSync(new URL('../src/yuanmingyuan/garden-planting-layout.js', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map(match => match[1]), ['./garden-layout.js']);
  assert.doesNotMatch(source, /Math\.random\(|new\s+(?:THREE\.|Image|Worker)|\bfetch\(/);
});

test('every placement carries a stable identity, transform, habitat, envelope and honest evidence', () => {
  assert.equal(new Set(plan.placements.map(p => p.id)).size, plan.placements.length);
  const zones = new Set(plan.zones.map(z => z.id));
  for (const p of plan.placements) {
    assert.ok(zones.has(p.zone));
    for (const field of ['position', 'rotation', 'scale']) assert.ok(p[field].length === 3 && p[field].every(Number.isFinite), `${p.id} ${field}`);
    assert.ok(p.scale.every(s => s > 0 && s < 1.2));
    assert.equal(p.habitat.kind, plantingSpecies[p.species].habitat);
    assert.ok(p.envelope.radius > 0 && p.envelope.height > 0);
    assert.equal(p.evidence.status, 'exhibition-design');
    assert.equal(p.evidence.surveyed, false);
    for (const id of p.evidence.sourceIds) assert.ok(plan.sources[id], id);
    assert.ok(p.heightReference.startsWith('layout-'));
  }
  assert.equal(plan.registration.status, 'unregistered');
  assert.equal(plan.registration.surveyedPlantPositions, false);
});

test('trees, including their conservative crowns, remain on garden land above lakes and sea', () => {
  for (const p of plan.placements.filter(p => p.species !== 'lotus')) {
    const centre = xz(p.position), garden = gardenLayout.gardens.find(g => g.id === p.regionId);
    assert.ok(pointInPolygon(centre, garden.boundary), p.id);
    assert.ok(plantingDistanceToPolygon(centre, garden.boundary) >= p.envelope.radius + 2, p.id);
    assert.equal(waterAt(...centre), null, p.id);
    for (const sample of rimPoints(centre, p.envelope.radius + 1.99)) {
      assert.equal(waterAt(...sample), null, `${p.id} wet crown`);
      assert.ok(pointInPolygon(sample, gardenLayout.exhibition.coast.polygon), `${p.id} sea`);
    }
    assert.ok(p.position[1] >= 4 && p.position[1] <= 12);
  }
  assert.ok(plan.placements.some(p => p.species === 'pine' && p.position[1] > 5), 'pine on authored mounds');
});

test('lotus clusters fit entirely in nearshore water, with no Fuhai, channel or ornamental-basin planting', () => {
  const allowedLakes = new Set(gardenLayout.waterBodies.filter(w => w.id !== 'fuhai' && w.id !== 'north-garden-water').map(w => w.id));
  for (const p of plan.placements.filter(p => p.species === 'lotus')) {
    const centre = xz(p.position), water = waterAt(...centre);
    assert.ok(allowedLakes.has(water?.id), p.id);
    assert.equal(p.habitat.waterId, water.id);
    assert.equal(p.position[1], water.surfaceY);
    for (const sample of rimPoints(centre, p.envelope.radius + .69)) assert.equal(waterAt(...sample)?.id, water.id, `${p.id} shore`);
    for (const route of [...gardenLayout.channels, ...gardenLayout.ornamentalWaters]) assert.equal(diskTouches(centre, p.envelope.radius + .7, route.polygon), false, `${p.id} aquatic route`);
    const shore = Math.min(plantingDistanceToPolygon(centre, water.polygon), ...gardenLayout.islands.filter(i => i.waterId === water.id).map(i => plantingDistanceToPolygon(centre, i.polygon)));
    assert.ok(shore <= 18, p.id);
  }
  for (const coverage of plan.diagnostics.lotusCoverage) assert.ok(coverage.fraction <= .01, coverage.waterId);
  assert.equal(plan.diagnostics.lotusCoverage.find(c => c.waterId === 'fuhai').fraction, 0);
});

test('a channel extending into a main lake still clears lotus at the overlapping lake entrance', () => {
  const plant = plan.placements.find(p => p.species === 'lotus'), layout = structuredClone(gardenLayout);
  layout.channels.push({ id: 'lake-access-fixture', polygon: square(xz(plant.position), .5), surfaceY: 2, bedY: 0 });
  const result = createGardenPlantingLayout({ layout });
  assert.equal(result.placements.some(p => p.id === plant.id), false);
  assert.ok(result.diagnostics.rejected['aquatic-route-clearance'] > 0);
});

test('bridge approaches, building envelopes and viewing corridors exclude the entire crown or lotus patch', () => {
  assert.equal(plan.reservations.filter(r => r.kind === 'bridge-approach').length, gardenLayout.bridges.length);
  assert.equal(plan.reservations.filter(r => r.kind === 'building-envelope').length, gardenLayout.groups.length);
  assert.ok(plan.reservations.some(r => r.id === 'view-fuhai-islands-to-fanghu'));
  assert.ok(plan.reservations.some(r => r.id === 'view-xianfahua-west'));
  for (const p of plan.placements) for (const r of plan.reservations) assert.equal(diskTouches(xz(p.position), p.envelope.radius + r.clearance, r.polygon), false, `${p.id} overlaps ${r.id}`);
});

test('retained formal rows are complete symmetric pairs with open space along their axes', () => {
  const pairs = Map.groupBy(plan.placements.filter(p => p.species === 'juniper'), p => p.pairId);
  assert.ok(pairs.size > 0);
  for (const [id, pair] of pairs) {
    assert.equal(pair.length, 2, id);
    const zone = plan.zones.find(z => z.id === pair[0].zone), [a, b] = zone.axis;
    const midpoint = [(pair[0].position[0] + pair[1].position[0]) / 2, (pair[0].position[2] + pair[1].position[2]) / 2];
    assert.ok(Math.abs((midpoint[0] - a[0]) * (b[1] - a[1]) - (midpoint[1] - a[1]) * (b[0] - a[0])) < 1e-7, id);
    assert.ok(Math.abs(Math.hypot(pair[0].position[0] - pair[1].position[0], pair[0].position[2] - pair[1].position[2]) - zone.rowOffset * 2) < 1e-7, id);
    assert.deepEqual(pair[0].scale, pair[1].scale);
  }
  assert.equal(plan.placements.some(p => p.species === 'pine' && p.position[0] > 330 && p.position[2] < -498), false, 'informal pine excluded from Western Palace parcel');
});

test('a thin reserved road clips a crown even when the trunk lies outside the road', () => {
  const plant = plan.placements.find(p => p.species === 'pine'), centre = xz(plant.position);
  const road = { id: 'actual-road', polygon: square([centre[0] + plant.envelope.radius * .8, centre[1]], .12), clearance: .5 };
  assert.equal(pointInPolygon(centre, road.polygon), false);
  const filtered = createGardenPlantingLayout({ reservedPolygons: [road] });
  assert.equal(filtered.placements.some(p => p.id === plant.id), false);
  assert.ok(filtered.diagnostics.callerReservationRemoved > 0);
  const baselineById = new Map(plan.placements.map(p => [p.id, p]));
  for (const p of filtered.placements) assert.deepEqual(p, baselineById.get(p.id), 'no new or moved plant after road reservation');
  for (const p of filtered.placements) assert.equal(diskTouches(xz(p.position), p.envelope.radius + road.clearance, road.polygon), false);
});

test('a reservation touching one formal plant removes its partner without changing other pairs', () => {
  const plant = plan.placements.find(p => p.species === 'juniper'), partner = plan.placements.find(p => p.pairId === plant.pairId && p.id !== plant.id);
  const polygon = square(xz(plant.position), .05);
  assert.equal(diskTouches(xz(partner.position), partner.envelope.radius, polygon), false);
  const filtered = createGardenPlantingLayout({ reservedPolygons: [polygon] });
  assert.equal(filtered.placements.some(p => p.pairId === plant.pairId), false);
  for (const pair of Map.groupBy(filtered.placements.filter(p => p.pairId), p => p.pairId).values()) assert.equal(pair.length, 2);
});

test('closed/reversed and concave caller polygons work; malformed exclusion polygons fail visibly', () => {
  const plant = plan.placements.find(p => p.species === 'willow'), [x, z] = xz(plant.position);
  const polygon = [[x - 8, z - 8], [x + 8, z - 8], [x + 8, z - 2], [x, z - 2], [x, z + 8], [x - 8, z + 8]];
  const original = createGardenPlantingLayout({ reservedPolygons: [{ id: 'concave', polygon }] });
  const closed = [...polygon, polygon[0]].reverse();
  assert.deepEqual(createGardenPlantingLayout({ reservedPolygons: [{ id: 'concave', polygon: closed }] }).placements, original.placements);
  assert.equal(original.placements.some(p => p.id === plant.id), false);
  for (const value of [[], [[0, 0], [1, 1]], [[0, 0], [2, 2], [0, 2], [2, 0]], [[0, 0], [1, NaN], [0, 1]]]) assert.throws(() => createGardenPlantingLayout({ reservedPolygons: [value] }), TypeError);
  assert.throws(() => createGardenPlantingLayout({ reservedPolygons: [{ polygon, clearance: -1 }] }), TypeError);
  assert.throws(() => createGardenPlantingLayout({ reservedPolygons: [{ polygon, holes: [square([x, z], 1)] }] }), TypeError);
  assert.throws(() => createGardenPlantingLayout({ seed: NaN }), TypeError);
});

test('input geometry remains untouched and returned polygons do not expose caller arrays', () => {
  assert.equal(JSON.stringify(gardenLayout), before);
  const polygon = square([0, 0], 2), snapshot = JSON.stringify(polygon), filtered = createGardenPlantingLayout({ reservedPolygons: [polygon] });
  filtered.reservations.at(-1).polygon[0][0] = 9999;
  filtered.zones.find(z => z.polygon).polygon[0][0] = 9999;
  assert.equal(JSON.stringify(polygon), snapshot);
  assert.equal(JSON.stringify(gardenLayout), before);
});

test('a supplied translated layout moves every plant and its height without consulting global water geometry', () => {
  const shifted = structuredClone(gardenLayout), offset = [3100, 6, -2800];
  const point = p => p.map((v, i) => v + offset[i]), ring = r => r.map(([x, z]) => [x + offset[0], z + offset[2]]);
  for (const g of shifted.gardens) { g.boundary = ring(g.boundary); g.groundY += offset[1]; }
  for (const w of [...shifted.waterBodies, ...shifted.ornamentalWaters, ...shifted.channels]) { w.polygon = ring(w.polygon); w.surfaceY += offset[1]; w.bedY += offset[1]; }
  for (const island of shifted.islands) { island.polygon = ring(island.polygon); island.anchor = point(island.anchor); }
  for (const bridge of shifted.bridges) { bridge.polygon = ring(bridge.polygon); bridge.from = point(bridge.from); bridge.to = point(bridge.to); }
  for (const hill of shifted.landforms) { hill.polygon = ring(hill.polygon); hill.center = point(hill.center); hill.baseY += offset[1]; hill.peakY += offset[1]; }
  for (const group of shifted.groups) group.position = point(group.position);
  shifted.exhibition.coast.polygon = ring(shifted.exhibition.coast.polygon); shifted.exhibition.groundY += offset[1]; shifted.exhibition.seaY += offset[1];
  shifted.metricFrames.westernPalaces.origin = point(shifted.metricFrames.westernPalaces.origin);
  const result = createGardenPlantingLayout({ layout: shifted });
  assert.deepEqual(result.placements.map(p => p.id), plan.placements.map(p => p.id));
  for (let i = 0; i < result.placements.length; i++) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(result.placements[i].position[axis] - plan.placements[i].position[axis] - offset[axis]) < 1e-6, `${result.placements[i].id} axis ${axis}`);
  assert.ok(result.placements.some(p => p.species === 'lotus' && p.position[1] === 8));
});

test('reported acceptance accounting and sparse lake coverage reconcile with actual records', () => {
  assert.equal(plan.diagnostics.candidateCount, plan.diagnostics.baselineCount + Object.values(plan.diagnostics.rejected).reduce((sum, n) => sum + n, 0));
  assert.equal(Object.values(plan.diagnostics.speciesCounts).reduce((sum, n) => sum + n, 0), plan.placements.length);
  for (const coverage of plan.diagnostics.lotusCoverage) {
    const area = plan.placements.filter(p => p.habitat.waterId === coverage.waterId).reduce((sum, p) => sum + Math.PI * p.envelope.radius ** 2, 0);
    assert.ok(Math.abs(area - coverage.projectedEnvelopeArea) < 1e-8);
  }
});
