import * as THREE from 'three';
import { gardenLayout, pointInPolygon } from './garden-layout.js';
import { prepareTerrainPads, applyTerrainPads } from './terrain-pads.js';
import { clamp01, smoothstep, closestOnSegment, distanceToRing, ringBounds, createSpatialIndex, polygonArea, polygonBooleanRegions, triangulateSurface, createTriangleSampler, createArchBridgeGeometry } from './terrain-geometry.js';
import {splitTerrainLand,createFineTerrainLand,createTerrainPatchOwner,higherTerrainSurface} from './terrain-patch-owner.js';

const lerp = THREE.MathUtils.lerp;
const palette = Object.fromEntries(Object.entries({ meadow: '#809b77', jade: '#608b7c', sage: '#a5ae84', loam: '#96987b', shore: '#c7c7a8', submerged: '#89937a', coast: '#bbb9a0', stone: '#dfdfcd', mortar: '#a9b0a1', slate: '#677d78' }).map(([id, color]) => [id, new THREE.Color(color)]));
const wave = (x, z) => Math.sin(x * .029 + Math.sin(z * .018) * 1.9) * .46 + Math.cos(z * .024 - x * .011) * .30 + Math.sin(x * .091 + z * .072) * .12;
const insideAny = (point, index) => index.at(...point).some(feature => pointInPolygon(point, feature.polygon));
const indexPolygons = (features, padding = 0) => createSpatialIndex(features, feature => ringBounds(feature.polygon), 64, padding);

function courtWater(court) {
  if (!court.water) return null;
  const water = court.water, surfacePolygon = water.surfacePolygon ?? water.polygon;
  const valid = polygon => Array.isArray(polygon) && polygon.length >= 3 && polygon.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  const contains = (outer, inner) => inner.every(point => pointInPolygon(point, outer)) && polygonBooleanRegions([outer, inner], point => pointInPolygon(point, inner) && !pointInPolygon(point, outer)).area < 1e-8;
  if (!Number.isFinite(water.surfaceY) || water.surfaceY <= court.floorY || !valid(water.polygon) || !valid(surfacePolygon) || !contains(court.polygon, water.polygon) || !contains(water.polygon, surfacePolygon)) throw new Error('Asset court water needs a finite level above its floor and wet/surface polygons contained within its excavation');
  return { ...water, id: `${court.id}-water`, assetId: court.assetId, sourceGroup: court.sourceGroup, bedY: court.floorY, polygon: water.polygon.map(point => [...point]), surfacePolygon: surfacePolygon.map(point => [...point]) };
}

function groundPath(path) {
  if (!path.id || ![path.from, path.to].every(point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite)) || !Number.isFinite(path.width) || path.width <= 0 || !Number.isFinite(path.thickness) || path.thickness <= 0) throw new Error('Asset paths need id, finite world endpoints, positive width and thickness');
  const [from, to] = [path.from, path.to], dx = to[0] - from[0], dz = to[2] - from[2], length = Math.hypot(dx, dz);
  if (length < 1e-5) throw new Error('Asset paths need distinct XZ endpoints');
  const nx = -dz / length * path.width / 2, nz = dx / length * path.width / 2;
  return { ...path, length, polygon: [[from[0] - nx, from[2] - nz], [to[0] - nx, to[2] - nz], [to[0] + nx, to[2] + nz], [from[0] + nx, from[2] + nz]] };
}

function boundaryDistanceIndex(loops, range = 48) {
  const segments = loops.flatMap(ring => ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length] })));
  const index = createSpatialIndex(segments, segment => ringBounds([segment.a, segment.b]), 48, range);
  return { distance: (x, z) => { let best = Infinity; for (const segment of index.at(x, z)) best = Math.min(best, closestOnSegment([x, z], segment.a, segment.b).distance); return best; }, dispose: index.clear };
}

function grainTexture() {
  const size = 128, data = new Uint8Array(size * size * 4); let state = 173981;
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const value = Math.round(235 + (state / 4294967295 - .5) * 21 + Math.sin(x / size * Math.PI * 16 + Math.sin(z / size * Math.PI * 8)) * 5);
    const offset = (z * size + x) * 4; data.set([value, Math.min(255, value + 2), value, 255], offset);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.name = 'yuanming-authored-fine-earth-grain'; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

// Primitive detail is written directly into material batches, not thousands of meshes.
class MasonryBatch {
  constructor(name, color) { this.name = name; this.color = color; this.positions = []; this.colors = []; }
  quad(points, color = this.color) { for (const i of [0, 1, 2, 0, 2, 3]) { this.positions.push(...points[i]); this.colors.push(...color.toArray()); } }
  beam(a, b, width, bottomA, topA, bottomB = bottomA, topB = topA, color = this.color) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (length < 1e-5) return;
    const nx = -(b[1] - a[1]) / length * width / 2, nz = (b[0] - a[0]) / length * width / 2;
    const points = [[a[0] - nx, bottomA, a[1] - nz], [a[0] + nx, bottomA, a[1] + nz], [b[0] + nx, bottomB, b[1] + nz], [b[0] - nx, bottomB, b[1] - nz], [a[0] - nx, topA, a[1] - nz], [a[0] + nx, topA, a[1] + nz], [b[0] + nx, topB, b[1] + nz], [b[0] - nx, topB, b[1] - nz]];
    for (const face of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) this.quad(face.map(index => points[index]), color);
  }
  post([x, z], y, size = .32, height = .94) {
    this.beam([x - size * .68, z], [x + size * .68, z], size * 1.36, y, y + .12);
    this.beam([x - size * .4, z], [x + size * .4, z], size * .8, y + .11, y + height - .12);
    this.beam([x - size * .56, z], [x + size * .56, z], size * 1.12, y + height - .15, y + height);
  }
  geometry() {
    const geometry = new THREE.BufferGeometry(); geometry.name = this.name; geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.positions = []; this.colors = []; return geometry;
  }
}

function defaultGates(layout) {
  const replacements=layout.assetWallReplacements||[];
  const transform = layout.registration?.authorImageTransform;
  if (!transform || !layout.gardens.some(garden => garden.id === 'yuanmingyuan')) return replacements;
  const point = ([u, v]) => [(u - transform.pixelOrigin[0]) * transform.workingUnitsPerPixel, (v - transform.pixelOrigin[1]) * transform.workingUnitsPerPixel];
  return [
    { id: 'yuanming-south-arrival', gardenIds: ['yuanmingyuan'], position: point([370, 665]), width: 13 },
    { id: 'main-changchun-visitor-link', gardenIds: ['yuanmingyuan', 'changchunyuan'], position: point([780, 337]), width: 10 },
    { id: 'changchun-south-arrival', gardenIds: ['changchunyuan'], position: point([1034, 537]), width: 12 },
    { id: 'qichun-south-arrival', gardenIds: ['qichunyuan'], position: point([848, 774]), width: 12 },
    { id: 'qichun-west-visitor-link', gardenIds: ['qichunyuan'], position: point([548, 673]), width: 9 },
  ].map(gate => ({ ...gate, evidence: 'exhibition-design', limit: 'Authored access opening in the proportional garden wall, not a registered historical gate footprint.' })).concat(replacements);
}

function wallRing(garden, gates, groundHeightAt, waterAt, waterLoops, batches, colliders, openings, usedSegments) {
  const ring = garden.boundary, lengths = ring.map((point, i) => Math.hypot(ring[(i + 1) % ring.length][0] - point[0], ring[(i + 1) % ring.length][1] - point[1]));
  const starts = []; let total = 0; for (const length of lengths) { starts.push(total); total += length; }
  const gateIntervals = gates.filter(gate => gate.gardenIds.includes(garden.id)).map(gate => {
    let best = null;
    ring.forEach((a, i) => { const hit = closestOnSegment(gate.position, a, ring[(i + 1) % ring.length]); if (!best || hit.distance < best.distance) best = { ...hit, station: starts[i] + hit.t * lengths[i] }; });
    const record = { ...gate, gardenId: garden.id, position: best.position, station: best.station, from: best.station - gate.width / 2, to: best.station + gate.width / 2 }; openings.push(record); return record;
  });
  for (let edge = 0; edge < ring.length; edge++) {
    const a = ring[edge], b = ring[(edge + 1) % ring.length], length = lengths[edge], start = starts[edge];
    const cuts = [0, 1]; for (const gate of gateIntervals) for (const distance of [gate.from, gate.to]) for (const wrap of [-total, 0, total]) { const t = (distance + wrap - start) / length; if (t > 0 && t < 1) cuts.push(t); }
    for (const loop of waterLoops) loop.forEach((p, i) => {
      const q = loop[(i + 1) % loop.length], dx = b[0] - a[0], dz = b[1] - a[1], ex = q[0] - p[0], ez = q[1] - p[1], denominator = dx * ez - dz * ex;
      if (Math.abs(denominator) < 1e-8) return;
      const t = ((p[0] - a[0]) * ez - (p[1] - a[1]) * ex) / denominator, u = ((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / denominator;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    });
    for (let n = 1; n < Math.ceil(length / 5); n++) cuts.push(n / Math.ceil(length / 5));
    cuts.sort((x, y) => x - y);
    for (let n = 0; n < cuts.length - 1; n++) {
      const station = start + (cuts[n] + cuts[n + 1]) / 2 * length;
      if (gateIntervals.some(gate => [-total, 0, total].some(wrap => station >= gate.from + wrap && station <= gate.to + wrap))) continue;
      const from = [lerp(a[0], b[0], cuts[n]), lerp(a[1], b[1], cuts[n])], to = [lerp(a[0], b[0], cuts[n + 1]), lerp(a[1], b[1], cuts[n + 1])];
      const key = [from, to].map(point => point.map(value => value.toFixed(4)).join(',')).sort().join('|'); if (usedSegments.has(key)) continue; usedSegments.add(key);
      const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], water = waterAt(...middle);
      const baseA = groundHeightAt(...from) ?? garden.groundY ?? 4, baseB = groundHeightAt(...to) ?? garden.groundY ?? 4, height = (garden.wallTopY ?? 6.6) - (garden.groundY ?? 4);
      const topA = Math.max(garden.groundY ?? 4, baseA) + height, topB = Math.max(garden.groundY ?? 4, baseB) + height;
      if (!water) {
        batches.plaster.beam(from, to, .76, baseA - .25, topA - .19, baseB - .25, topB - .19);
        batches.base.beam(from, to, .86, baseA - .35, baseA + .28, baseB - .35, baseB + .28);
        colliders.push({ id: `${garden.id}-wall-${edge}-${n}`, type: 'segment', kind: 'garden-wall', from, to, radius: .43, minY: Math.min(baseA, baseB), maxY: Math.max(topA, topB) });
      }
      // Culvert passages retain a raised lintel and have no wall face below it.
      batches.cap.beam(from, to, 1.02, topA - (water ? .45 : .20), topA + .07, topB - (water ? .45 : .20), topB + .07);
      if (water) openings.push({ id: `${garden.id}-water-passage-${edge}-${n}`, gardenId: garden.id, kind: 'water-passage', from, to, minY: water.surfaceY, maxY: Math.min(topA, topB) - .45, evidence: 'exhibition-design' });
    }
  }
}

/** A landscape factory only. Sky, sea/water materials, buildings and vegetation
 * are owned by the scene. All input footprints and output vertices are world XZ. */
export function createGardenTerrain({ layout = gardenLayout, assetCourts = [], assetPads = [], assetPaths = [], replacements = [], gates = defaultGates(layout), detail = 1, coastline = layout.exhibition.coast.polygon } = {}) {
  if (!(detail > 0) || !Number.isFinite(detail)) throw new Error('Terrain detail must be positive');
  const group = new THREE.Group(); group.name = 'yuanming-three-gardens-terrain'; group.userData = { evidence: 'author-proportional-and-exhibition-design', layoutId: layout.id, metresCalibrated: false };
  const coast = coastline, seaY = layout.exhibition.seaY, groundY = layout.exhibition.groundY;
  const waters = [...layout.waterBodies, ...(layout.ornamentalWaters ?? []), ...layout.channels], islands = layout.islands;
  for (const court of assetCourts) if (!court.id || !Array.isArray(court.polygon) || court.polygon.length < 3 || court.polygon.some(point => point.length !== 2 || !point.every(Number.isFinite)) || !Number.isFinite(court.floorY) || court.floorY >= (court.rimY ?? groundY)) throw new Error('Asset courts need id, world polygon, floorY and a higher rimY');
  for (const court of assetCourts) if (court.rimBlend !== undefined && (!Number.isFinite(court.rimBlend) || court.rimBlend < 0 || court.rimBlend > 14)) throw new Error('Court rimBlend must be between zero and 14 metres');
  const courtDefs = assetCourts.map(court => ({ ...court, rimY: court.rimY ?? groundY }));
  // The asset supplies its own masonry banks and bridge. Its water is separate
  // from natural shore generation, while the land still has a real court hole.
  const assetWaters = courtDefs.map(courtWater).filter(Boolean), assetWaterIndex = indexPolygons(assetWaters);
  const padDefs=prepareTerrainPads(assetPads);
  const padNearIndex=indexPolygons(padDefs,Math.max(0,...padDefs.map(pad=>pad.blend)));
  const waterIndex = indexPolygons(waters), islandIndex = indexPolygons(islands), courtIndex = indexPolygons(courtDefs), courtNearIndex = indexPolygons(courtDefs, 18), hillIndex = indexPolygons(layout.landforms ?? []);
  const withinCoast = point => pointInPolygon(point, coast), isCourt = point => insideAny(point, courtIndex);
  const isWet = point => withinCoast(point) && !isCourt(point) && !insideAny(point, islandIndex) && insideAny(point, waterIndex);
  const pathDefs = assetPaths.map(groundPath);
  function validateGroundPaths(paths,extraCourts=[]){
    for(const path of paths){
      const bounds = ringBounds(path.polygon), nearby = [...waters, ...islands, ...courtDefs,...extraCourts].filter(feature => { const b = ringBounds(feature.polygon); return b.minX <= bounds.maxX && b.maxX >= bounds.minX && b.minZ <= bounds.maxZ && b.maxZ >= bounds.minZ; });
      const invalid = polygonBooleanRegions([path.polygon, coast, ...nearby.map(feature => feature.polygon)], point => pointInPolygon(point, path.polygon) && (!withinCoast(point) || isCourt(point) || isWet(point)||extraCourts.some(court=>pointInPolygon(point,court.polygon))));
      if (invalid.area > 1e-7) throw new Error(`Asset ground path ${path.id} crosses water, an excavation or the coast; it cannot substitute for a bridge`);
    }
  }
  validateGroundPaths(pathDefs);
  const inputRings = [coast, ...waters.map(water => water.polygon), ...islands.map(island => island.polygon), ...courtDefs.map(court => court.polygon), ...padDefs.map(pad=>pad.polygon)];
  const wet = polygonBooleanRegions(inputRings, isWet), dry = polygonBooleanRegions(inputRings, point => withinCoast(point) && !isCourt(point) && !isWet(point));
  const shore = boundaryDistanceIndex(wet.loops), oceanShore = boundaryDistanceIndex([coast]);
  const hillCentres = new Map((layout.landforms ?? []).map(hill => [hill.id, distanceToRing([hill.center[0], hill.center[2]], hill.polygon)]));
  const waterAt = (x, z) => {
    const owned = assetWaterIndex.at(x, z).find(water => pointInPolygon([x, z], water.polygon));
    if (owned && withinCoast([x, z])) return owned;
    const candidates=waterIndex.at(x,z).filter(water=>pointInPolygon([x,z],water.polygon));if(!candidates.length||!isWet([x,z]))return null;return candidates.sort((a,b)=>a.bedY-b.bedY)[0]??null;
  };
  function landHeight(x, z, changes) {
    const distance = shore.distance(x, z), coastalDistance = oceanShore.distance(x, z);
    let y = groundY + wave(x, z) * .24;
    for (const hill of hillIndex.at(x, z)) if (!changes?.removedHillIds.has(hill.id)&&pointInPolygon([x, z], hill.polygon)) {
      const t = distanceToRing([x, z], hill.polygon) / Math.max(.01, hillCentres.get(hill.id)); y = Math.max(y, hill.baseY + (hill.peakY - hill.baseY) * smoothstep(t));
    }
    if (coastalDistance < 28) y = lerp(seaY, y, smoothstep(coastalDistance / 24));
    for (const court of courtNearIndex.at(x, z)) { const d = distanceToRing([x, z], court.polygon), blend = court.rimBlend ?? 14; if (d < blend) y = lerp(y, court.rimY, 1 - smoothstep(d / blend)); }
    for(const court of changes?.courts??[]){const d=distanceToRing([x,z],court.polygon),blend=court.rimBlend??14;if(d<blend)y=lerp(y,court.rimY,1-smoothstep(d/blend));}
    y=applyTerrainPads(x,z,y,padNearIndex.at(x,z));
    if(changes)y=applyTerrainPads(x,z,y,changes.pads);
    // Lake shore constraints take precedence over the broad coastal slope.
    // A shared shoreline height makes adjacent land and bed meshes meet exactly.
    if (distance < 11) {
      const nearby = waterIndex.at(x, z), lakeY = nearby[0]?.surfaceY ?? waters[0]?.surfaceY ?? seaY;
      y = lerp(lakeY, y, smoothstep(distance / 9));
    }
    return y;
  }
  function bedHeight(x, z) {
    const water = waterAt(x, z) ?? waterIndex.at(x, z)[0]; if (!water) return seaY;
    const d = shore.distance(x, z), depth = water.surfaceY - water.bedY;
    return water.surfaceY - depth * smoothstep(d / Math.min(9, depth * 3.2 + 1));
  }
  function groundColor(x, y, z, target = new THREE.Color()) {
    const distance = shore.distance(x, z), coastalDistance = oceanShore.distance(x, z), chroma = clamp01(.5 + wave(x, z) * .45);
    const color = target.copy(palette.meadow).lerp(palette.jade, chroma * .43).lerp(palette.sage, clamp01(.30 + Math.sin(x * .008 - z * .015) * .25));
    if (y > groundY + .8) color.lerp(palette.loam, clamp01((y - groundY) / 18) * .35);
    if (distance < 12) color.lerp(palette.shore, (1 - smoothstep(distance / 12)) * .85);
    if (coastalDistance < 24) color.lerp(palette.coast, (1 - smoothstep(coastalDistance / 24)) * .9);
    return color;
  }
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() }, supportGeometries = [], supportKinds=new Map(), bridgeRecords = [], promenadeRecords = [], pathRecords = [], colliders = [], openings = [];
  const grain = grainTexture(); resources.textures.add(grain);
  const earthMaterial = new THREE.MeshStandardMaterial({ name: 'yuanming-soft-jade-earth', color: 0xffffff, vertexColors: true, roughness: .97, map: grain, bumpMap: grain, bumpScale: .11 });
  const stoneMaterial = new THREE.MeshStandardMaterial({ name: 'yuanming-warm-limestone', color: 0xffffff, vertexColors: true, roughness: .91 });
  resources.materials.add(earthMaterial); resources.materials.add(stoneMaterial);
  function addMesh(geometry, material, name, body, support = false) {
    resources.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = body !== 'lake-bed' && body !== 'asset-excavation'; mesh.userData = { body, evidence: 'authored-landscape' }; group.add(mesh); if (support){supportGeometries.push(geometry);supportKinds.set(geometry,body);} return mesh;
  }
  const edgeLength = ([x, z]) => (Math.min(shore.distance(x, z), oceanShore.distance(x, z)) < 20 || courtNearIndex.at(x, z).length || padNearIndex.at(x,z).length ? 4.5 : hillIndex.at(x, z).length ? 9 : 20) / detail;
  const patchOwners=new Map();
  let land = triangulateSurface(dry.regions, { name: 'yuanming-continuous-land', heightAt: landHeight, colorAt: groundColor, edgeLength });
  if(replacements.length){
    const partition=splitTerrainLand(land,replacements);land.dispose();land=partition.geometry;
    for(const {descriptor,coarseGeometry} of partition.patches){const owner=createTerrainPatchOwner({descriptor,coarseGeometry,material:earthMaterial,buildFine:()=>buildFinePatch(descriptor,coarseGeometry)});patchOwners.set(descriptor.id,owner);group.add(owner.group);}
  }
  addMesh(land, earthMaterial, land.name, 'land', true);
  function buildFinePatch(descriptor,coarseGeometry){
    const prepared=descriptor.prepared;
    if(!prepared||!Array.isArray(prepared.courts)||!Array.isArray(prepared.pads)||!Array.isArray(prepared.paths))throw new Error('Replacement needs prepared courts, pads and paths');
    const courts=prepared.courts.map(court=>({...court,rimY:court.rimY??groundY})),pads=prepareTerrainPads(prepared.pads),paths=prepared.paths.map(groundPath),removedHillIds=new Set(descriptor.removedLandformIds??[]);
    if(!removedHillIds.size||[...removedHillIds].some(id=>!(layout.landforms??[]).some(hill=>hill.id===id)))throw new Error('Replacement must identify landforms still present in the coarse terrain');
    for(const court of courts){
      if(!court.id||!Array.isArray(court.polygon)||court.polygon.length<3||court.polygon.some(point=>point.length!==2||!point.every(Number.isFinite))||!Number.isFinite(court.floorY)||!Number.isFinite(court.rimY)||court.floorY>=court.rimY)throw new Error('Invalid replacement court');
      if(court.rimBlend!==undefined&&(!Number.isFinite(court.rimBlend)||court.rimBlend<0||court.rimBlend>14))throw new Error('Court rimBlend must be between zero and 14 metres');
      if(court.water||court.sampleHeight)throw new Error('Live land patches use borrowed asset support and cannot replace water surfaces');
      const b=ringBounds(court.polygon),nearby=[...waters,...islands,...courtDefs].filter(feature=>{const q=ringBounds(feature.polygon);return b.minX<=q.maxX&&b.maxX>=q.minX&&b.minZ<=q.maxZ&&b.maxZ>=q.minZ;});
      const invalid=polygonBooleanRegions([court.polygon,coast,...nearby.map(feature=>feature.polygon)],point=>pointInPolygon(point,court.polygon)&&(!withinCoast(point)||isWet(point)||isCourt(point)));
      if(invalid.area>1e-7)throw new Error('Replacement excavation must stay on existing dry land');
    }
    for(const {polygon,margin} of [...(layout.landforms??[]).filter(hill=>removedHillIds.has(hill.id)).map(hill=>({polygon:hill.polygon,margin:0})),...courts.map(court=>({polygon:court.polygon,margin:court.rimBlend??14})),...pads.map(pad=>({polygon:pad.polygon,margin:pad.blend})),...paths.map(path=>({polygon:path.polygon,margin:0}))]){
      const b=ringBounds(polygon),r=descriptor.bounds;
      if(b.minX-margin<r.minX||b.maxX+margin>r.maxX||b.minZ-margin<r.minZ||b.maxZ+margin>r.maxZ)throw new Error('Replacement bounds do not contain every changed height blend');
    }
    validateGroundPaths(paths,courts);
    const localGroup=new THREE.Group();localGroup.name=`${descriptor.id}-fine`;const geometries=new Set(),kinds=new Map();let soil=null,detailSampler=null;
    function add(geometry,material,kind,id){geometries.add(geometry);kinds.set(geometry,{kind,id});const mesh=new THREE.Mesh(geometry,material);mesh.name=geometry.name;mesh.castShadow=kind!=='court-excavation';mesh.receiveShadow=true;mesh.userData={body:kind,evidence:kind==='exhibition-ground-path'?'exhibition-design':'authored-landscape'};localGroup.add(mesh);return geometry;}
    function dispose(){const errors=[];for(const action of [()=>soil?.dispose(),()=>detailSampler?.dispose(),...[...geometries].map(geometry=>()=>geometry.dispose()),()=>localGroup.removeFromParent(),()=>localGroup.clear()])try{action();}catch(error){errors.push(error);}geometries.clear();if(errors.length)throw new AggregateError(errors,'Fine terrain disposal failed');}
    try{
      const changes={removedHillIds,courts,pads},fineLand=createFineTerrainLand(coarseGeometry,{courts,name:`${descriptor.id}-fine-land`,heightAt:(x,z)=>landHeight(x,z,changes),colorAt:groundColor,edgeLength:2.25/detail});
      const soilGeometries=[add(fineLand,earthMaterial,'land',descriptor.id)],walls=new MasonryBatch(`${descriptor.id}-excavation-walls`,palette.loam);
      for(const court of courts){
        const floor=triangulateSurface([{outer:court.polygon,holes:[]}],{name:`${court.id}-excavation-floor`,heightAt:()=>court.floorY,colorAt:()=>palette.loam,edgeLength:12});soilGeometries.push(add(floor,earthMaterial,'court-excavation',court.id));
        const ring=polygonArea(court.polygon)<0?[...court.polygon].reverse():court.polygon;
        ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];walls.quad([[a[0],court.floorY,a[1]],[b[0],court.floorY,b[1]],[b[0],court.rimY,b[1]],[a[0],court.rimY,a[1]]]);});
      }
      if(walls.positions.length)add(walls.geometry(),earthMaterial,'asset-excavation-wall',descriptor.id);
      const detailed=[];
      for(const path of paths){const batch=new MasonryBatch(`${path.id}-stone-path`,palette.stone);batch.beam([path.from[0],path.from[2]],[path.to[0],path.to[2]],path.width,path.from[1]-path.thickness,path.from[1],path.to[1]-path.thickness,path.to[1]);path.geometry=add(batch.geometry(),stoneMaterial,'exhibition-ground-path',path.id);detailed.push(path.geometry);}
      // Both old and newly created guide views call this bounded owner. Index
      // the same triangles at 2 m; never resample their heights or normals.
      soil=createTriangleSampler(soilGeometries,2);detailSampler=createTriangleSampler(detailed,2);
      return {group:localGroup,land:fineLand,paths,courts,triangleCount:[...geometries].reduce((sum,geometry)=>sum+(geometry.index?.count??geometry.attributes.position.count)/3,0),surfaceAt(x,z,{includeBridges=true,maxY=Infinity}={}){
        const hit=higherTerrainSurface(soil.sample(x,z,maxY),includeBridges?detailSampler.sample(x,z,maxY):null);if(!hit)return null;
        const record=kinds.get(hit.geometry),water=waterAt(x,z);return {...hit,...record,walkable:record.kind!=='court-excavation'&&!(water&&hit.height<=water.surfaceY+.03),waterY:water?.surfaceY,supportSource:'terrain-triangle'};
      },dispose};
    }catch(error){try{dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Fine terrain preparation and cleanup failed');}throw error;}
  }
  function samplePatches(x,z,options){let best=null;for(const patch of patchOwners.values())best=higherTerrainSurface(best,patch.surfaceAt(x,z,options));return best;}
  const bed = triangulateSurface(wet.regions, { name: 'yuanming-connected-lake-beds', heightAt: bedHeight, colorAt: (x, y, z) => palette.submerged.clone().lerp(palette.shore, .38 + .22 * Math.cos(x * .019 + z * .013)), edgeLength: point => shore.distance(...point) < 18 ? 4.5 / detail : 18 / detail }); addMesh(bed, earthMaterial, bed.name, 'lake-bed', true);
  const cutWalls = new MasonryBatch('yuanming-asset-court-excavation-walls', palette.loam);
  for (const court of courtDefs) {
    const floor = triangulateSurface([{ outer: court.polygon, holes: [] }], { name: `${court.id}-excavation-floor`, heightAt: () => court.floorY, colorAt: () => palette.loam, edgeLength: 12 }); addMesh(floor, earthMaterial, floor.name, 'asset-excavation', true);
    const ring = polygonArea(court.polygon) < 0 ? [...court.polygon].reverse() : court.polygon;
    ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; cutWalls.quad([[a[0], court.floorY, a[1]], [b[0], court.floorY, b[1]], [b[0], court.rimY, b[1]], [a[0], court.rimY, a[1]]]); });
  }
  if (cutWalls.positions.length) addMesh(cutWalls.geometry(), earthMaterial, cutWalls.name, 'asset-excavation-wall');

  // The exposed coastal foundation follows the same simple ring. Below-water
  // strata are vertical, avoiding self-intersecting offsets in the narrow bays.
  const coastRock = new MasonryBatch('yuanming-coastal-rock-strata', palette.coast);
  coast.forEach((a, i) => {
    const b = coast[(i + 1) % coast.length], pieces = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9);
    for (let n = 0; n < pieces; n++) {
      const p = [lerp(a[0], b[0], n / pieces), lerp(a[1], b[1], n / pieces)], q = [lerp(a[0], b[0], (n + 1) / pieces), lerp(a[1], b[1], (n + 1) / pieces)];
      const seams = [seaY, seaY - .8, seaY - 2.2, seaY - 5.4, seaY - 12];
      for (let layer = 0; layer < seams.length - 1; layer++) {
        const color = palette.coast.clone().lerp(palette.slate, .12 + layer * .13 + (wave(...p) + 1) * .055);
        coastRock.quad([[p[0], seams[layer], p[1]], [q[0], seams[layer], q[1]], [q[0], seams[layer + 1], q[1]], [p[0], seams[layer + 1], p[1]]], color);
      }
    }
  }); addMesh(coastRock.geometry(), stoneMaterial, coastRock.name, 'coastal-rock-strata');
  const islandBase = triangulateSurface([{ outer: coast, holes: [] }], { name: 'yuanming-island-foundation-bottom', heightAt: () => seaY - 12, colorAt: () => palette.slate, edgeLength: Infinity });
  const bottomIndices = islandBase.index; for (let i = 0; i < bottomIndices.count; i += 3) { const b = bottomIndices.getX(i + 1); bottomIndices.setX(i + 1, bottomIndices.getX(i + 2)); bottomIndices.setX(i + 2, b); } islandBase.computeVertexNormals();
  addMesh(islandBase, stoneMaterial, islandBase.name, 'island-foundation');
  const soilGeometryCount = supportGeometries.length, soilSampler = createTriangleSampler(supportGeometries), stone = new MasonryBatch('yuanming-bridge-stone-balustrades', palette.stone);
  const sampleSoil=(x,z,maxY=Infinity)=>higherTerrainSurface(soilSampler.sample(x,z,maxY),samplePatches(x,z,{maxY,includeBridges:false}));
  for (const path of pathDefs) {
    const batch = new MasonryBatch(`${path.id}-stone-path`, palette.stone), from = [path.from[0], path.from[2]], to = [path.to[0], path.to[2]];
    batch.beam(from, to, path.width, path.from[1] - path.thickness, path.from[1], path.to[1] - path.thickness, path.to[1]);
    const geometry = batch.geometry(), mesh = addMesh(geometry, stoneMaterial, geometry.name, 'exhibition-ground-path', true);
    mesh.userData.evidence = 'exhibition-design';pathRecords.push({ ...path, geometry });
  }
  for (const bridge of layout.bridges ?? []) {
    const built = createArchBridgeGeometry(bridge, (x, z) => sampleSoil(x, z)?.height, waters[0]?.surfaceY ?? 2);
    // Independent white stone decks have real curved undersides, no blocking box.
    const positions = built.geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3); for (let i = 0; i < positions.count; i++) colors.set(palette.stone.toArray(), i * 3); built.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    addMesh(built.geometry, stoneMaterial, built.geometry.name, 'open-arch-bridge', true); bridgeRecords.push({ ...bridge, ...built });
    for (const side of [-1, 1]) {
      const count = Math.max(3, Math.ceil(built.length / 3.5)); let previous = null;
      for (let i = 0; i <= count; i++) {
        const t = i / count, point = [lerp(bridge.from[0], bridge.to[0], t) + built.across[0] * side * (bridge.width / 2 - .17), lerp(bridge.from[2], bridge.to[2], t) + built.across[1] * side * (bridge.width / 2 - .17)], y = bridge.deckY + built.crown * Math.sin(t * Math.PI);
        stone.post(point, y, .32, .94);
        if (previous) { for (const height of [.36, .79]) stone.beam(previous.point, point, .15, previous.y + height, previous.y + height + .12, y + height, y + height + .12); colliders.push({ id: `${bridge.id}-rail-${side}-${i}`, type: 'segment', kind: 'balustrade', from: previous.point, to: point, radius: .18, minY: Math.min(y, previous.y), maxY: Math.max(y, previous.y) + .96 }); }
        previous = { point, y };
      }
    }
  }
  if (stone.positions.length) addMesh(stone.geometry(), stoneMaterial, stone.name, 'bridge-balustrade');

  // White stone is concentrated on the formal basin; natural banks remain broad
  // and unbuilt around the large lakes. The exterior apron meets sampled soil.
  const bank = new MasonryBatch('yuanming-formal-basin-stone-shore', palette.stone), bankRails = new MasonryBatch('yuanming-formal-basin-open-balustrade', palette.stone);
  for (const water of layout.ornamentalWaters ?? []) {
    const walkBatch = new MasonryBatch(`${water.id}-shore-walk`, palette.stone);
    const outerRing = water.polygon.map((point, i, ring) => {
      const previous = ring[(i + ring.length - 1) % ring.length], next = ring[(i + 1) % ring.length];
      const before = new THREE.Vector2(point[1] - previous[1], previous[0] - point[0]).normalize(), after = new THREE.Vector2(next[1] - point[1], point[0] - next[0]).normalize(), normal = before.clone().add(after).normalize();
      const distance = Math.min(14, 7 / Math.max(.5, normal.dot(after))); return [point[0] + normal.x * distance, point[1] + normal.y * distance];
    });
    water.polygon.forEach((a, edge) => {
      const b = water.polygon[(edge + 1) % water.polygon.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.ceil(length / 3.8), outerA = outerRing[edge], outerB = outerRing[(edge + 1) % outerRing.length];
      for (let n = 0; n < count; n++) {
        const p = [lerp(a[0], b[0], n / count), lerp(a[1], b[1], n / count)], q = [lerp(a[0], b[0], (n + 1) / count), lerp(a[1], b[1], (n + 1) / count)];
        const po = [lerp(outerA[0], outerB[0], n / count), lerp(outerA[1], outerB[1], n / count)], qo = [lerp(outerA[0], outerB[0], (n + 1) / count), lerp(outerA[1], outerB[1], (n + 1) / count)];
        if ([p, q, po, qo].some(point => isCourt(point)) || !withinCoast(po) || !withinCoast(qo)) continue;
        const top = groundY, py = sampleSoil(...po)?.height ?? top, qy = sampleSoil(...qo)?.height ?? top;
        bank.quad([[p[0], water.bedY - .15, p[1]], [q[0], water.bedY - .15, q[1]], [q[0], top, q[1]], [p[0], top, p[1]]]);
        walkBatch.quad([[p[0], top, p[1]], [q[0], top, q[1]], [qo[0], qy, qo[1]], [po[0], py, po[1]]]);
        bankRails.post(p, top, .33, .94); for (const height of [.33, .78]) bankRails.beam(p, q, .15, top + height, top + height + .12);
        colliders.push({ id: `${water.id}-shore-rail-${edge}-${n}`, type: 'segment', kind: 'balustrade', from: p, to: q, radius: .2, minY: top, maxY: top + .97 });
      }
    });
    if (walkBatch.positions.length) { const geometry = walkBatch.geometry(); addMesh(geometry, stoneMaterial, geometry.name, 'stone-promenade', true); promenadeRecords.push({ id: `${water.id}-stone-shore`, geometry }); }
  }
  for (const batch of [bank, bankRails]) if (batch.positions.length) addMesh(batch.geometry(), stoneMaterial, batch.name, 'formal-shore-detail');

  const batches = { plaster: new MasonryBatch('yuanming-garden-plaster-walls', new THREE.Color('#d6d8c7')), base: new MasonryBatch('yuanming-garden-wall-stone-foot', palette.mortar), cap: new MasonryBatch('yuanming-garden-wall-slate-coping', palette.slate) };
  const usedSegments = new Set();
  for (const garden of layout.gardens) wallRing(garden, gates, (x, z) => sampleSoil(x, z)?.height, waterAt, wet.loops, batches, colliders, openings, usedSegments);
  for (const batch of Object.values(batches)) if (batch.positions.length) addMesh(batch.geometry(), stoneMaterial, batch.name, 'garden-wall');

  const waterSurfaces = wet.regions.map((region, index) => {
    const source = waters.find(water => pointInPolygon(region.outer[0], water.polygon)) ?? waters[0], worldY = source?.surfaceY ?? 2;
    const geometry = triangulateSurface([region], { name: `yuanming-lake-water-${index}`, heightAt: () => 0, edgeLength: Infinity }); resources.geometries.add(geometry);
    return { id: `garden-water-${index}`, geometry, worldY, type: source?.kind === 'ornamental-basin' ? 'ornamental-basin' : 'lake', sourceIds: [...new Set(waters.flatMap(water => water.sourceIds ?? []))], polygon: region.outer, holes: region.holes };
  });
  for (const water of assetWaters) {
    const geometry = triangulateSurface([{ outer: water.surfacePolygon, holes: [] }], { name: water.id, heightAt: () => 0, edgeLength: Infinity }); resources.geometries.add(geometry);
    waterSurfaces.push({ id: water.id, geometry, worldY: water.surfaceY, type: water.kind ?? 'ornamental-basin', assetId: water.assetId, sourceGroup: water.sourceGroup, sourceIds: water.sourceIds ?? [], polygon: water.surfacePolygon, holes: [] });
  }
  const sampler = createTriangleSampler(supportGeometries.slice(soilGeometryCount)), bridgeGeometries = new Map(bridgeRecords.map(bridge => [bridge.geometry, bridge])), promenadeGeometries = new Map(promenadeRecords.map(record => [record.geometry, record])), pathGeometries = new Map(pathRecords.map(record => [record.geometry, record]));
  function surfaceAt(x, z, { includeBridges = true, maxY = Infinity } = {}) {
    if (disposed||!Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (!withinCoast([x, z])) return { kind: 'sea', height: seaY, waterY: seaY, walkable: false };
    const court = courtIndex.at(x, z).find(candidate => pointInPolygon([x, z], candidate.polygon));
    if (court && court.sampleHeight) {
      const raw = court.sampleHeight(x, z, { maxY }), support = Number.isFinite(raw) ? { height: raw } : raw;
      if (support && Number.isFinite(support.height) && support.height <= maxY) {
        const waterY = Math.max(waterAt(x, z)?.surfaceY ?? -Infinity, support.waterY ?? -Infinity);
        return { ...support, kind: 'asset-court', id: court.id, ...(Number.isFinite(waterY) ? { waterY } : {}), walkable: (support.walkable ?? true) && !(support.height <= waterY + .03), supportSource: 'asset-sampler' };
      }
    }
    const groundSample = soilSampler.sample(x, z, maxY), detailSample = includeBridges ? sampler.sample(x, z, maxY) : null;
    const sampled = detailSample && (!groundSample || detailSample.height >= groundSample.height) ? detailSample : groundSample;
    const patchSample=samplePatches(x,z,{includeBridges,maxY});if(patchSample&&(!sampled||patchSample.height>=sampled.height))return patchSample;
    if (!sampled) return null;
    const bridge = bridgeGeometries.get(sampled.geometry), promenade = promenadeGeometries.get(sampled.geometry), path = pathGeometries.get(sampled.geometry), water = waterAt(x, z);
    const kind = bridge ? 'bridge' : promenade ? 'stone-promenade' : path ? 'exhibition-ground-path' : court ? 'court-excavation' : water ? 'lake-bed' : 'land';
    return { ...sampled, kind, id: bridge?.id ?? promenade?.id ?? path?.id ?? court?.id ?? water?.id ?? null, waterY: water?.surfaceY, walkable: kind !== 'lake-bed' && kind !== 'court-excavation', supportSource: 'terrain-triangle' };
  }
  const diagnostics = { layoutId: layout.id, evidence: group.userData.evidence, registration: layout.registration?.status ?? 'unregistered', metresCalibrated: false, dryRegions: dry.regions.length, wetRegions: wet.regions.length, islandCount: islands.length, bridgeCount: bridgeRecords.length, courtCount: courtDefs.length, assetWaterCount: assetWaters.length, assetWaterArea: assetWaters.reduce((area, water) => area + Math.abs(polygonArea(water.surfacePolygon)), 0), landArea: dry.area, waterArea: wet.area, wallOpenings: openings, triangleCount: [...resources.geometries].reduce((sum, geometry) => sum + (geometry.index?.count ?? geometry.getAttribute('position').count) / 3, 0), meshCount: group.children.length, heightSampling: 'barycentric on actual Float32 support triangles; asset court sampler may override', renderVerified: false };
  diagnostics.triangleCount+=[...patchOwners.values()].reduce((sum,patch)=>sum+patch.snapshot.coarseTriangles,0);
  Object.defineProperty(diagnostics,'replacements',{enumerable:true,get:()=>[...patchOwners.values()].map(patch=>patch.snapshot)});
  function createGuideSupport(bounds){
    // This smaller index references the same triangles; no vertices, heights,
    // shorelines or normals are resampled. A custom court retains its override.
    if(courtDefs.some(court=>court.sampleHeight)){let released=false;return {surfaceAt:(...args)=>released?null:surfaceAt(...args),dispose(){released=true;}};}
    const localSoil=soilSampler.local(bounds),localDetail=sampler.local(bounds);
    let released=false;
    return {surfaceAt(x,z,{maxY=Infinity,includeBridges=true}={}){
      if(disposed||released)return null;
      if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)return surfaceAt(x,z,{maxY,includeBridges});
      const ground=localSoil.sample(x,z,maxY),detail=includeBridges?localDetail.sample(x,z,maxY):null,hit=detail&&(!ground||detail.height>=ground.height)?detail:ground;
      const patch=samplePatches(x,z,{maxY,includeBridges});if(patch&&(!hit||patch.height>=hit.height))return patch;
      if(!hit)return null;
      const body=supportKinds.get(hit.geometry),wet=body==='lake-bed',excavation=body==='asset-excavation';
      const water=waterAt(x,z),raised=bridgeGeometries.has(hit.geometry)||promenadeGeometries.has(hit.geometry)||pathGeometries.has(hit.geometry);
      return {...hit,kind:body,waterY:water?.surfaceY,walkable:raised||!wet&&!excavation&&!water,supportSource:'terrain-triangle'};
    },triangleCount:localSoil.triangleCount+localDetail.triangleCount,dispose(){if(released)return;released=true;localSoil.dispose();localDetail.dispose();}};
  }
  let disposed = false;
  function dispose() {if(disposed)return;disposed=true;const errors=[];for(const action of [...[...patchOwners.values()].map(patch=>()=>patch.dispose()),()=>sampler.dispose(),()=>soilSampler.dispose(),()=>shore.dispose(),()=>oceanShore.dispose(),...[waterIndex,assetWaterIndex,islandIndex,courtIndex,courtNearIndex,hillIndex,padNearIndex].map(index=>()=>index.clear()),...[...resources.geometries].map(geometry=>()=>geometry.dispose()),...[...resources.materials].map(material=>()=>material.dispose()),...[...resources.textures].map(texture=>()=>texture.dispose()),()=>group.clear()])try{action();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Terrain disposal failed');}
  function replacement(id){const patch=patchOwners.get(id);if(!patch)throw new Error(`Unknown terrain replacement: ${id}`);return patch;}
  return { group, earthMaterial, heightAt: (x, z, options) => surfaceAt(x, z, options)?.height, surfaceAt, createGuideSupport, waterSurfaces, colliders, diagnostics, bridges: bridgeRecords,
    colorAt(x,y,z,target){if(disposed)throw new Error('Terrain color owner has been disposed');if(![x,y,z].every(Number.isFinite)||(target!==undefined&&!target?.isColor))throw new Error('Terrain color needs finite world XYZ and an optional Color target');return groundColor(x,y,z,target);},
    get paths(){return patchOwners.size?pathRecords.concat([...patchOwners.values()].flatMap(patch=>patch.snapshot.active?patch.fine.paths:[])):pathRecords;},
    get courtFootprints(){return patchOwners.size?courtDefs.concat([...patchOwners.values()].flatMap(patch=>patch.snapshot.active?patch.fine.courts:[])):courtDefs;},
    prepareReplacement:id=>replacement(id).prepare(),activateReplacement:(id,binding)=>replacement(id).activate(binding),revertReplacement:id=>replacement(id).revert(),
    get replacementStates(){return [...patchOwners.values()].map(patch=>patch.snapshot);},get disposed(){return disposed;},coastPolygon: coast, dispose };
}
