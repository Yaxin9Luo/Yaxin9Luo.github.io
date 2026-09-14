import * as THREE from 'three';
import { seededGardenRandom, gardenValueNoise, curvedBranchGeometry, lanceolateLeafGeometry, needleGeometry, pineShootGeometry, juniperSprayTexture, juniperSprayCardGeometry, lotusLeafGeometry, lotusLeafHeight, lotusPetalGeometry, lotusBudPetalGeometry, lotusReceptacleGeometry, lakeStoneGeometry, VegetationGeometryBatch, VegetationInstanceBatch } from './vegetation-geometry.js';
import { pineBarkTextures, pineBarkRelief, validateVegetationTexturePixels, lakeStoneTextures, validateLakeStonePixels } from './vegetation-textures.js';
import { gardenVegetationViews } from './garden-vegetation-views.js';
import { installVegetationWoodStability } from './vegetation-wood-stability.js';
export { gardenVegetationViews } from './garden-vegetation-views.js';

const V = (...values) => new THREE.Vector3(...values), TAU = Math.PI * 2, UP = V(0, 1, 0), ONE = V(1, 1, 1);
const pose = (position = [0, 0, 0], quaternion = new THREE.Quaternion(), scale = ONE) => new THREE.Matrix4().compose(Array.isArray(position) ? V(...position) : position, quaternion, scale);
const aim = (direction, roll = 0) => new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, roll));
const curveOf = points => new THREE.CatmullRomCurve3(points.map(point => Array.isArray(point) ? V(...point) : point.clone()), false, 'centripetal');

export const gardenVegetationSources = {
  'park-historical-planting': { title: '圆明园管理处：历史特点', url: 'https://www.yuanmingyuanpark.cn/ylxs/zwhh/201012/t20101206_227337.html', evidence: 'institutional-landscape-synthesis', scope: 'Pine and cypress background, informal waterside willow, lotus and open Fuhai water; no exact individual tree dimensions.' },
  'park-landscape-research': { title: '杨振铎：略论圆明园遗址公园风貌', url: 'https://www.yuanmingyuanpark.cn/ymyyj/yj013/201012/t20101223_229305.html', evidence: 'named-institutional-research', scope: 'Local pine/cypress types and shore willow; combines historical images, documents, site observations and oral accounts.' },
  'western-topiary-research': { title: '朱翊纶、曹新：图像学视角下圆明园西洋楼几何学设计方法探源，3.3.3、图7', url: 'https://www.yuanmingyuanpark.cn/xs/ktsb/202505/t20250506_4768240.html', evidence: 'named-pictorial-research', scope: 'Juniper clipped into three, five or nine levels; image examples inspected. Exact clipping profiles and plant scale remain authored.' },
  'palace-cross-cultural-garden': { title: '故宫：连延楼阁仿西洋讲座报道', url: 'https://www.dpm.org.cn/learing_detail/379500.html', evidence: 'institutional-lecture-report', scope: 'Natural pine/cypress, clipped trees and Taihu-style stone in the mixed garden vocabulary; not a plant or stone survey.' },
  'flora-willow': { title: 'Flora of China: Salix babylonica', url: 'https://www.efloras.org/florataxon.aspx?flora_id=3&taxon_id=200005760', evidence: 'botanical-description', scope: 'Pendulous branches, lanceolate leaves 9–16 by 0.5–1.5 cm. Supports botanical proportions, not identification of any historical individual.' },
  'flora-pine': { title: 'Flora of China: Pinus tabuliformis', url: 'https://www.efloras.org/florataxon.aspx?flora_id=2&taxon_id=210001654', evidence: 'botanical-description', scope: 'Typically paired needles, 6–15 cm by 1–1.5 mm; flat-topped mature crown.' },
  'flora-juniper': { title: 'Flora of China: Juniperus chinensis', url: 'https://efloras.org/florataxon.aspx?flora_id=2&taxon_id=210000896', evidence: 'botanical-description', scope: 'Appressed decussate scale leaves 1.5–3 mm and needlelike leaves 6–12 mm coexist; the study uses both.' },
  'photography-willow': { title: 'NC State Extension: Salix babylonica photographs', url: 'https://plants.ces.ncsu.edu/plants/salix-babylonica/', evidence: 'institutional-botanical-photography', scope: 'Ettore Balocchi crown and John Tann leafy shoot photographs inspected: ramified rounded crown, overlapping pendulous sprays and varied leaf faces. Reference only; images are not textures.' },
  'photography-pine': { title: 'International Dendrology Society: Pinus tabuliformis', url: 'https://www.treesandshrubsonline.org/articles/pinus/pinus-tabuliformis/', evidence: 'dendrological-photography', scope: 'Owen Johnson, Hergest Croft, September 2023: crown depth, ramification and terminal needle masses. Does not establish a historical Yuanmingyuan individual.' },
  'photography-juniper': { title: 'NC State Extension: Juniperus chinensis photographs', url: 'https://plants.ces.ncsu.edu/plants/juniperus-chinensis/', evidence: 'institutional-botanical-photography', scope: '5u5 shoot and David Midgley crown photographs inspected for scale/awl foliage and live crown density. Reference only; no photograph bundled.' },
  'photography-pruning': { title: 'RHS: Cloud pruning', url: 'https://www.rhs.org.uk/plants/types/trees/cloud-pruning', evidence: 'institutional-horticultural-photography', scope: 'Cushion depth and supporting branch volume only. The pictured tree is not identified here as Juniperus or used as evidence of Chinese historical planting.' },
  'material-pine-bark': { title: 'Poly Haven: Pine Bark, Dimitrios Savva', url: 'https://polyhaven.com/a/pine_bark', evidence: 'cc0-photographic-pbr-material', scope: 'Existing project 1024-pixel maps, original two-metre tile. Bark texture only; the tree remains authored. Geometric relief is reconstructed from the normal map, not measured displacement.' },
  'photography-limestone-princeton': { title: 'Princeton University Art Museum: Taihu Rock, 2008-65', url: 'https://artmuseum.princeton.edu/art/collections/objects/55543', evidence: 'museum-object-photography-four-angles', scope: 'Four actual photographs inspected: slender crooked waist, irregular windows connected through thin ridges, rough buff-grey mineral skin. Morphology only; no object copy or dimensional rescaling.' },
  'photography-limestone': { title: 'The Metropolitan Museum of Art: Scholar’s rock, 1984.495.2a,b', url: 'https://www.metmuseum.org/art/collection/search/61762', evidence: 'museum-object-photography', scope: '18th–19th-century Taihu limestone study object: continuous folds, uneven cavities and irregular openings. Morphological reference only; the garden-scale mesh does not copy or rescale this object.' },
  'material-lake-rock': { title: 'Poly Haven: Rock 01, Rob Tuytel', url: 'https://polyhaven.com/a/rock_01', evidence: 'cc0-photographic-pbr-material', scope: 'Full 2048-pixel albedo, OpenGL normal and roughness maps at the provider’s 1.5-metre tile width. The provider does not identify Taihu limestone: this supplies rock grain, not geological or historical identity.' },
};

export const gardenVegetationSpecs = [
  { id: 'willow', name: 'garden-willow', label: '垂柳 · 临水树姿', position: [-12, 0, -2], sourceIds: ['park-historical-planting', 'park-landscape-research', 'flora-willow', 'photography-willow'], evidence: 'supported-plant-type-authored-individual', form: 'ramified leaders, layered drooping crown and alternate lanceolate leaves' },
  { id: 'pine', name: 'garden-pine', label: '古松 · 油松型', position: [1, 0, -3], sourceIds: ['park-historical-planting', 'park-landscape-research', 'flora-pine', 'photography-pine', 'material-pine-bark'], evidence: 'supported-plant-type-authored-individual', form: 'crooked trunk, deep irregular crown pads and many live terminal needle shoots' },
  { id: 'juniper', name: 'garden-juniper', label: '五层修剪圆柏', position: [10, 0, -2], sourceIds: ['western-topiary-research', 'flora-juniper', 'photography-juniper', 'photography-pruning'], evidence: 'research-supported-clipping-authored-profile', form: 'five deep, offset clipped crowns with fine ramification and original botanical alpha sprays' },
  { id: 'lotus', name: 'garden-lotus', label: '荷叶、荷花与花苞', position: [5, 0, 8], sourceIds: ['park-historical-planting'], evidence: 'supported-plant-type-authored-seasonal-study', form: 'peltate cupped leaves, centre-attached petioles, pink and ivory flowers' },
  { id: 'lake-rock', name: 'garden-lake-rock', label: '湖石 · 瘦皱漏透', position: [-7, 0, 8], sourceIds: ['palace-cross-cultural-garden', 'photography-limestone', 'photography-limestone-princeton', 'material-lake-rock'], evidence: 'authored-garden-stone-no-historical-object-copy', form: 'continuous folded limestone with irregular openings and shallow dissolved cavities' },
];

function authoredGrain(kind) {
  const size = 256, data = new Uint8Array(size * size * 4), rng = seededGardenRandom(kind === 'bark' ? 1092 : 7482);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const broad = gardenValueNoise(x / size * 19, y / size * (kind === 'bark' ? 3 : 19), .34, 39), fine = gardenValueNoise(x / size * 71 + 3, y / size * (kind === 'bark' ? 13 : 71), 1.79, 78);
    const grooves = kind === 'bark' ? Math.max(0, broad) ** 3 * 57 + Math.max(0, fine) * 16 : broad * 5 + fine * 7;
    const value = Math.round(237 - grooves + (rng() - .5) * (kind === 'bark' ? 9 : 13)), offset = (y * size + x) * 4; data.set([value, value, value, 255], offset);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.name = `yuanming-own-${kind}-grain`; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
}

class VegetationBuilder {
  constructor(texturePixels) {
    this.texturePixels = texturePixels;
    this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.instances = new Set(); this.counts = { leaves: 0, needleFascicles: 0, foliageSprays: 0, curvedBranches: 0, livePineShoots: 0, alphaBranchletSprays: 0 };
    const bark = authoredGrain('bark'); this.textures.add(bark);
    const make = (name, options) => { const material = new THREE.MeshStandardMaterial({ name, color: 0xffffff, vertexColors: true, ...options }); this.materials.add(material); return material; };
    this.m = { bark: make('yuanming-living-grey-brown-bark', { roughness: .96, map: bark, bumpMap: bark, bumpScale: .018 }), leaves: make('yuanming-leaf-lamina', { roughness: .77, side: THREE.DoubleSide, emissive: '#263724', emissiveIntensity: .045 }), petals: make('yuanming-lotus-petal-silk', { roughness: .64, side: THREE.DoubleSide }), stem: make('yuanming-petioles-and-twigs', { roughness: .88 }) };
    installVegetationWoodStability(this.m);
  }
  sprayMaterial(seed) { const texture = juniperSprayTexture({ seed }); this.textures.add(texture); const material = new THREE.MeshStandardMaterial({ name: `yuanming-live-juniper-branchlets-${seed}`, color: 0xffffff, map: texture, vertexColors: true, roughness: .82, side: THREE.DoubleSide, alphaTest: .24, alphaToCoverage: true, emissive: '#233422', emissiveIntensity: .035 }); this.materials.add(material); return material; }
  pineBarkMaterial() { if (this.m.pineBark) return this.m.pineBark; const maps = pineBarkTextures(this.texturePixels); this.barkSurface = pineBarkRelief(this.texturePixels); for (const texture of Object.values(maps)) this.textures.add(texture); const material = new THREE.MeshStandardMaterial({ name: 'yuanming-pine-longitudinal-fissures-and-flaking-plates', color: 0xffffff, vertexColors: true, ...maps, normalScale: new THREE.Vector2(.82, .82), roughness: 1 }); this.materials.add(material); this.m.pineBark = material; return material; }
  stoneMaterial() { if (this.m.stone) return this.m.stone; const maps = lakeStoneTextures(this.texturePixels.stone); for (const texture of Object.values(maps)) this.textures.add(texture); const material = new THREE.MeshStandardMaterial({ name: 'yuanming-weathered-garden-limestone', color: 0xffffff, vertexColors: true, ...maps, roughness: 1, normalScale: new THREE.Vector2(1, 1) }); material.userData = { surface: 'photographic-rock-grain-with-authored-mineral-tints', historicalObjectScan: false }; this.materials.add(material); this.m.stone = material; return material; }
  group(parent, name, data = {}) { const group = new THREE.Group(); group.name = name; group.userData = data; parent.add(group); return group; }
  mesh(parent, geometry, material, name = geometry.name, data = {}) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = data; parent.add(mesh); return mesh; }
  flush(parent, batch, material, data = {}) { if (batch.positions.length) return this.mesh(parent, batch.finish(), material, batch.name, data); return null; }
  instanceFlush(parent, batch, geometry, material, data = {}) { if (!batch.matrices.length) return null; const mesh = batch.finish(geometry, material); this.geometries.add(geometry); this.instances.add(mesh); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { ...data, editableInstanceTransforms: true }; parent.add(mesh); return mesh; }
  branch(batch, points, radii, options = {}) { const geometry = curvedBranchGeometry({ points: points.map(point => Array.isArray(point) ? point : point.toArray()), radii, ...options }); batch.add(geometry); geometry.dispose(); this.counts.curvedBranches++; }
  dispose() { for (const mesh of this.instances) mesh.dispose(); for (const geometry of this.geometries) geometry.dispose(); for (const material of this.materials) material.dispose(); for (const texture of this.textures) texture.dispose(); }
}

function roots(b, batch, rng, radius = .48, barkProfile = null) {
  const scale = radius / .48;
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.399963 + rng() * .55, reach = (.76 + rng() * .49) * scale, bend = (rng() - .5) * .36;
    b.branch(batch, [[Math.cos(angle) * radius * .30, .34 * scale, Math.sin(angle) * radius * .30], [Math.cos(angle + bend * .3) * reach * .47, .105 * scale, Math.sin(angle + bend * .3) * reach * .47], [Math.cos(angle + bend) * reach * .83, -.095 * scale, Math.sin(angle + bend) * reach * .83], [Math.cos(angle + bend * 1.2) * reach, -.25 * scale - .06, Math.sin(angle + bend * 1.2) * reach]], [.24 * scale, .20 * scale, .10 * scale, .032 * scale], { radialSegments: barkProfile ? 48 : 13, segments: barkProfile ? 72 : 22, bark: .065, barkProfile, barkSurface: barkProfile ? b.barkSurface : null });
  }
}

function willow(b, root) {
  const rng = seededGardenRandom(4451), wood = new VegetationGeometryBatch('willow-trunk-and-roots'), boughs = new VegetationGeometryBatch('willow-primary-and-secondary-boughs'), twigs = new VegetationGeometryBatch('willow-hanging-twigs'), foliage = new VegetationInstanceBatch('willow-alternate-lanceolate-foliage');
  const detail = b.group(root, 'willow-detail-spray', { body: 'short-attached-willow-spray-with-visible-lamina-faces' }), detailTwig = new VegetationGeometryBatch('willow-detail-twig'), detailLeaves = new VegetationInstanceBatch('willow-detail-leaves');
  const trunk = [[0, -.16, 0], [.10, .62, -.04], [-.12, 1.73, .05], [.09, 2.91, .13], [.23, 4.23, .08], [.57, 5.36, -.05]], trunkCurve = curveOf(trunk);
  b.branch(wood, trunk, [.67, .51, .44, .37, .25, .075], { radialSegments: 25, segments: 86, bark: .07, color: '#807b6a' }); roots(b, wood, rng, .52);
  const leaf = lanceolateLeafGeometry({ rows: 6, color: '#829f62' });
  function leafyShoot(points, selected = false, spacing = .025) {
    const curve = curveOf(points), length = curve.getLength(), twigBatch = selected ? detailTwig : twigs, leafBatch = selected ? detailLeaves : foliage;
    b.branch(twigBatch, points, points.map((_, i) => .0027 * (1 - i / points.length) + .00045), { radialSegments: 4, segments: Math.max(6, Math.ceil(length * 8)), bark: 0, color: '#8c9766' });
    const nodes = Math.ceil(length / spacing), phase = rng() * TAU;
    for (let node = 0; node < nodes; node++) {
      const t = .035 + node / nodes * .94, position = curve.getPointAt(t), tangent = curve.getTangentAt(t), angle = node * 2.399963 + phase + (rng() - .5) * .45, radial = V(Math.cos(angle), .10, Math.sin(angle));
      const direction = tangent.clone().multiplyScalar(.62).addScaledVector(radial, .46 + rng() * .18).add(V(0, -.20, 0));
      const scale = .74 + rng() * .42, roll = angle + Math.PI * .5 + (rng() - .5) * 1.9;
      leafBatch.add(pose(position, aim(direction, roll), V(scale, scale, scale)), .86 + rng() * .27); b.counts.leaves++;
    }
    return curve;
  }
  const leaders = [
    [.32, .35, 1.8, 6.8], [.43, 2.2, 2.1, 7.1], [.50, 4.15, 1.6, 7.5], [.60, 5.45, 1.8, 7.0],
    [.68, 1.18, 1.2, 7.9], [.76, 3.13, 1.3, 8.0], [.84, 4.81, 1.0, 7.7],
  ];
  leaders.forEach(([trunkT, angle, reach, height], leaderIndex) => {
    const start = trunkCurve.getPointAt(trunkT), out = V(Math.cos(angle), 0, Math.sin(angle)), tip = out.clone().multiplyScalar(reach).add(V(.2, height, .1));
    const points = [start, start.clone().lerp(tip, .33).addScaledVector(out, -.20), start.clone().lerp(tip, .72).add(V(.16, .12, -.07)), tip], leader = curveOf(points);
    b.branch(boughs, points, [.235 - leaderIndex * .014, .15 - leaderIndex * .007, .07, .008], { radialSegments: 14, segments: 42, bark: .055, color: '#7c7966' });
    for (let arm = 0; arm < 5; arm++) {
      const t = .27 + arm * .14 + rng() * .06, anchor = leader.getPointAt(t), theta = angle + (arm % 2 ? -1 : 1) * (.35 + rng() * 1.14), direction = V(Math.cos(theta), 0, Math.sin(theta)), length = (1.7 + rng() * 1.1) * (1 - arm * .062);
      const end = anchor.clone().addScaledVector(direction, length).add(V(0, .30 + rng() * .50 - arm * .075, 0)), mainPoints = [anchor, anchor.clone().lerp(end, .51).add(V(0, .24 + rng() * .24, 0)), end], main = curveOf(mainPoints);
      b.branch(boughs, mainPoints, [.086 - arm * .010, .039, .0054], { radialSegments: 9, segments: 20, bark: .03, color: '#80846a' });
      for (let fork = 0; fork < 7; fork++) {
        const forkAnchor = main.getPointAt(.14 + (fork + rng() * .65) / 7 * .84), phi = theta + (fork % 2 ? -1 : 1) * (.45 + rng() * .75), lateral = V(Math.cos(phi), 0, Math.sin(phi)), distance = .60 + rng() * .78;
        const forkEnd = forkAnchor.clone().addScaledVector(lateral, distance).add(V(0, (rng() - .55) * .55, 0)), forkPoints = [forkAnchor, forkAnchor.clone().lerp(forkEnd, .52).add(V(0, .10 + rng() * .12, 0)), forkEnd], forkCurve = curveOf(forkPoints);
        b.branch(boughs, forkPoints, [.016, .008, .0021], { radialSegments: 5, segments: 11, bark: .015, color: '#87916d' });
        for (let terminal = 0; terminal < 7; terminal++) {
          const top = forkCurve.getPointAt(.12 + (terminal + rng() * .7) / 7 * .86), outer = Math.hypot(top.x, top.z) / 4.8, drop = Math.min(top.y - (.44 + rng() * .76), .75 + rng() ** .6 * (1.6 + outer * 1.65)), drift = lateral.clone().multiplyScalar(.21 + rng() * .43).add(V((rng() - .5) * .36, 0, (rng() - .5) * .36));
          const shootPoints = [top, top.clone().addScaledVector(drift, .50).add(V(0, -drop * .18 + .06, 0)), top.clone().add(drift).add(V(0, -drop * .59, 0)), top.clone().addScaledVector(drift, .84).add(V((rng() - .5) * .16, -drop, (rng() - .5) * .16))];
          const strand = leafyShoot(shootPoints);
          for (let twig = 0; twig < 3; twig++) {
            const attach = strand.getPointAt(.17 + twig * .235 + rng() * .07), thetaTwig = phi + (twig % 2 ? -.95 : 1.05) + (rng() - .5) * .5, reachTwig = .20 + rng() * .37, endTwig = attach.clone().add(V(Math.cos(thetaTwig) * reachTwig, -.20 - rng() * .36, Math.sin(thetaTwig) * reachTwig));
            const selected = leaderIndex === 1 && arm === 2 && fork === 3 && terminal === 4 && twig === 1;
            leafyShoot([attach, attach.clone().lerp(endTwig, .47).add(V(0, .035, 0)), endTwig], selected, .020);
          }
        }
      }
    }
  });
  b.flush(root, wood, b.m.bark); b.flush(root, boughs, b.m.bark); b.flush(root, twigs, b.m.stem); b.instanceFlush(root, foliage, leaf, b.m.leaves); b.flush(detail, detailTwig, b.m.stem); b.instanceFlush(detail, detailLeaves, leaf, b.m.leaves);
  root.userData.growth = { branchOrders: 6, leaders: leaders.length, terminalArchitecture: 'irregular-pendulous-shoots-with-leafy-laterals', leafScalePreserved: true };
}

function pine(b, root) {
  const rng = seededGardenRandom(91931), wood = new VegetationGeometryBatch('pine-trunk-and-roots'), mature = new VegetationGeometryBatch('pine-mature-plated-boughs'), branches = new VegetationGeometryBatch('pine-layered-curved-boughs'), detail = b.group(root, 'pine-detail-spray', { body: 'one-live-ramified-shoot-and-paired-needles' }), barkMaterial = b.pineBarkMaterial();
  const trunk = [[0, -.15, 0], [-.08, .59, .02], [-.38, 1.7, -.09], [-.31, 2.8, .07], [.27, 3.9, .13], [.10, 5.05, .02], [.46, 6.08, -.14], [.63, 6.86, -.07]], trunkCurve = curveOf(trunk);
  b.branch(wood, trunk, [.61, .47, .39, .33, .25, .16, .085, .022], { radialSegments: 128, segments: 460, bark: .10, barkProfile: 'pine-plates', barkSurface: b.barkSurface, color: '#807769' }); roots(b, wood, rng, .51, 'pine-plates');
  const shoots = [218, 591, 832].map(seed => pineShootGeometry({ seed })), foliage = shoots.map((_, i) => new VegetationInstanceBatch(i === 0 ? 'pine-paired-needle-canopy' : `pine-paired-needle-canopy-${i + 1}`));
  const primary = [[.25, .20, 3.15, .66], [.33, 2.15, 3.00, .83], [.40, 4.36, 3.20, .91], [.47, 5.63, 2.77, .97], [.54, 1.29, 2.90, .82], [.60, 3.38, 2.76, .76], [.67, .20, 2.59, .92], [.72, 4.83, 2.49, .92], [.79, 2.21, 2.05, .70], [.84, 5.89, 1.87, .82], [.89, 3.59, 1.48, .59], [.95, 1.20, 1.25, .53], [.97, 4.57, 1.02, .47]];
  primary.forEach(([trunkT, angle, length, rise], arm) => {
    const start = trunkCurve.getPointAt(trunkT), direction = V(Math.cos(angle), 0, Math.sin(angle)), across = V(-Math.sin(angle), 0, Math.cos(angle)), tip = start.clone().addScaledVector(direction, length).add(V(0, rise, 0));
    const points = [start, start.clone().addScaledVector(direction, length * .36).add(V(0, -.05, 0)), start.clone().lerp(tip, .74).addScaledVector(across, (rng() - .5) * .24), tip], main = curveOf(points);
    b.branch(mature, points, [.17 - arm * .007, .10 - arm * .0034, .045, .010], { radialSegments: 56, segments: 140, bark: .075, barkProfile: 'pine-plates', barkSurface: b.barkSurface, color: '#7b7162' });
    for (let fork = 0; fork < 9; fork++) {
      const anchor = main.getPointAt(.23 + (fork + rng() * .6) / 9 * .74), side = fork % 2 ? -1 : 1, theta = angle + side * (.48 + rng() * .67), out = V(Math.cos(theta), .16, Math.sin(theta)), lengthSecondary = .72 + rng() * .66;
      const end = anchor.clone().addScaledVector(out, lengthSecondary).add(V(0, .18 + rng() * .33, 0)), secondaryPoints = [anchor, anchor.clone().lerp(end, .51).add(V(0, -.018, 0)), end], secondary = curveOf(secondaryPoints);
      b.branch(branches, secondaryPoints, [.029, .017, .0043], { radialSegments: 7, segments: 13, bark: .035, color: '#81775f' });
      for (let terminal = 0; terminal < 7; terminal++) {
        const attach = secondary.getPointAt(.19 + (terminal + rng() * .6) / 7 * .79), thetaTerminal = theta + (terminal % 2 ? -.75 : .78) + (rng() - .5) * .48, tangent = V(Math.cos(thetaTerminal), .26 + rng() * .33, Math.sin(thetaTerminal)).normalize(), reach = .28 + rng() * .36;
        const endTerminal = attach.clone().addScaledVector(tangent, reach), twigPoints = [attach, attach.clone().lerp(endTerminal, .54).add(V(0, -.01, 0)), endTerminal], twig = curveOf(twigPoints);
        b.branch(branches, twigPoints, [.0075, .0047, .0017], { radialSegments: 5, segments: 8, bark: .01, color: '#8c7d58' });
        for (let cluster = 0; cluster < 4; cluster++) {
          const t = .25 + cluster * .23, point = twig.getPointAt(t), growth = twig.getTangentAt(t).multiplyScalar(.43).add(V((rng() - .5) * .30, .80, (rng() - .5) * .30)), index = (arm + fork + terminal + cluster) % shoots.length, scale = .92 + rng() * .12;
          const matrix = pose(point, aim(growth, rng() * TAU), V(scale, scale, scale)), selected = arm === 3 && fork === 6 && terminal === 4 && cluster === 3;
          if (selected) { const mesh = b.mesh(detail, shoots[index], b.m.leaves, 'pine-detail-live-terminal-shoot'); mesh.applyMatrix4(matrix); }
          else foliage[index].add(matrix, .86 + rng() * .24);
          b.counts.needleFascicles += shoots[index].userData.fascicles; b.counts.livePineShoots++;
        }
      }
    }
  });
  b.flush(root, wood, barkMaterial); b.flush(root, mature, barkMaterial); b.flush(root, branches, b.m.bark); shoots.forEach((geometry, index) => b.instanceFlush(root, foliage[index], geometry, b.m.leaves));
  root.userData.growth = { branchOrders: 5, primaryBoughs: primary.length, terminalArchitecture: 'many-short-ramified-needle-shoots', leafScalePreserved: true };
}

function juniperSpray() {
  const rng = seededGardenRandom(827), batch = new VegetationGeometryBatch('juniper-real-scale-and-awl-spray'), scaleLeaf = lanceolateLeafGeometry({ length: .0026, width: .0011, curl: .00025, rows: 2, color: '#698965' }), awlLeaf = needleGeometry({ length: .009, width: .0011, bend: .0009, color: '#809875', name: 'juniper-juvenile-awl-leaf' });
  const axis = curvedBranchGeometry({ points: [[0, 0, 0], [.005, .11, -.005], [.012, .233, .008]], radii: [.0024, .0015, .00045], radialSegments: 6, segments: 12, bark: 0, color: '#7c8663' }); batch.add(axis); axis.dispose();
  let scaleLeaves = 0, awlLeaves = 0;
  for (let row = 0; row < 8; row++) for (const side of [-1, 1]) {
    const position = V(.010 * row / 8, .029 + row * .025, 0), direction = V(side * .83, .59, (row % 2 ? 1 : -1) * .18).normalize(), end = position.clone().addScaledVector(direction, .082 - row * .006);
    const branch = curvedBranchGeometry({ points: [position.toArray(), end.toArray()], radii: [.0012, .00045], radialSegments: 5, segments: 5, bark: 0, color: '#7d8c62' }); batch.add(branch); branch.dispose();
    for (let fork = 0; fork < 5; fork++) for (const forkSide of [-1, 1]) {
      const start = position.clone().lerp(end, .14 + fork * .166), theta = forkSide * .7 + side * .22 + rng() * .19, grow = direction.clone().multiplyScalar(.55).add(V(Math.sin(theta) * .65, .71, Math.cos(theta) * (row % 2 ? .24 : -.24))).normalize(), tip = start.clone().addScaledVector(grow, .018 + rng() * .014), across = grow.clone().cross(V(.1, 1, .1)).normalize(), outward = across.clone().cross(grow).normalize();
      const twig = curvedBranchGeometry({ points: [start.toArray(), tip.toArray()], radii: [.00064, .00024], radialSegments: 4, segments: 3, bark: 0, color: '#70865f' }); batch.add(twig); twig.dispose();
      for (let node = 0; node < 11; node++) for (const pair of [0, 1]) {
        const angle = node % 2 * Math.PI / 2 + pair * Math.PI, radial = across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(outward, Math.sin(angle)), point = start.clone().lerp(tip, .05 + node / 11 * .94).addScaledVector(radial, .00044);
        batch.add(scaleLeaf, pose(point, aim(grow.clone().addScaledVector(radial, .19), angle)), .92 + rng() * .15); scaleLeaves++;
      }
      for (let node = 0; node < 5; node++) for (let leaf = 0; leaf < 3; leaf++) {
        const angle = leaf / 3 * TAU + node * .41, radial = across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(outward, Math.sin(angle)), point = start.clone().lerp(tip, .25 + node * .16), scale = .75 + rng() * .42;
        batch.add(awlLeaf, pose(point, aim(grow.clone().multiplyScalar(.50).addScaledVector(radial, .78), angle), V(1, scale, 1)), .91 + rng() * .16); awlLeaves++;
      }
    }
  }
  scaleLeaf.dispose(); awlLeaf.dispose(); const geometry = batch.finish(); geometry.userData = { body: 'juniper-scale-and-awl-foliage', branchOrders: 3, scaleLeafLength: .0026, awlLeafLength: .009, scaleLeaves, awlLeaves, scaleArrangement: 'opposite-decussate', awlArrangement: 'three-leaf-whorls' }; return geometry;
}

function juniper(b, root) {
  const rng = seededGardenRandom(7181), wood = new VegetationGeometryBatch('juniper-visible-trunk'), materials = [371, 684, 926].map(seed => b.sprayMaterial(seed)), sprays = materials.map((_, i) => juniperSprayCardGeometry({ seed: i + 2 }));
  const trunkPoints = [[0, -.10, 0], [.015, .30, -.01], [.05, 1.65, -.02], [-.03, 3.53, .02], [.016, 5.30, .006]];
  b.branch(wood, trunkPoints, [.27, .205, .16, .098, .018], { radialSegments: 18, segments: 56, bark: .07, color: '#7c7566' }); roots(b, wood, rng, .22); b.flush(root, wood, b.m.bark);
  const tiers = [[1.20, 1.40, 1.29, .64, .07, -.04], [2.38, 1.14, 1.06, .61, -.08, .06], [3.47, .90, .82, .56, .06, .03], [4.39, .66, .62, .48, -.05, -.03], [5.15, .41, .38, .42, .015, .018]];
  tiers.forEach(([height, rx, rz, depth, cx, cz], tier) => {
    const group = b.group(root, `juniper-tier-${String(tier + 1).padStart(2, '0')}`, { body: 'deep-clipped-crown-of-ramified-living-sprays', tier: tier + 1 }), branches = new VegetationGeometryBatch(`juniper-tier-${tier + 1}-wood`), foliage = materials.map((_, i) => new VegetationInstanceBatch(`juniper-tier-${tier + 1}-scale-foliage-${i + 1}`)), supports = [];
    for (let branch = 0; branch < 8; branch++) {
      const theta = branch / 8 * TAU + tier * .38 + (rng() - .5) * .19, end = V(cx + Math.cos(theta) * rx * .80, height - .04 + rng() * .09, cz + Math.sin(theta) * rz * .80), start = V(0, height - .34, 0), mainPoints = [start, start.clone().lerp(end, .45).add(V(0, -.06, 0)), end], main = curveOf(mainPoints), secondary = [];
      b.branch(branches, mainPoints, [.035 - tier * .003, .018, .005], { radialSegments: 7, segments: 13, bark: .025, color: '#7a7d63' });
      for (let fork = 0; fork < 6; fork++) {
        const anchor = main.getPointAt(.23 + fork * .145), out = theta + (fork % 2 ? -.7 : .66), reach = rx * (.18 + rng() * .18), tip = anchor.clone().add(V(Math.cos(out) * reach, .06 + rng() * .14, Math.sin(out) * reach * rz / rx));
        const points = [anchor, anchor.clone().lerp(tip, .56).add(V(0, -.02, 0)), tip]; secondary.push(curveOf(points)); b.branch(branches, points, [.0073, .0042, .0016], { radialSegments: 5, segments: 7, bark: 0, color: '#798563' });
      }
      supports.push({ theta, secondary });
    }
    const count = Math.ceil(rx * rz * depth * 2100);
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963 + rng() * .26, r = Math.sqrt(rng()), scallop = 1 + .034 * Math.sin(angle * 5 + tier) + .015 * Math.sin(angle * 9 - tier), vertical = (rng() - .5) * depth * Math.sqrt(1 - r * r);
      const position = V(cx + Math.cos(angle) * rx * r * scallop, height + vertical - .06 * r * r, cz + Math.sin(angle) * rz * r * scallop), grow = V(Math.cos(angle) * (.16 + r * .53), .72 + rng() * .35, Math.sin(angle) * (.16 + r * .53)), scale = .88 + rng() * .20;
      let support = supports[0], difference = Infinity;
      for (const candidate of supports) { const d = Math.abs(Math.atan2(Math.sin(angle - candidate.theta), Math.cos(angle - candidate.theta))); if (d < difference) { difference = d; support = candidate; } }
      let anchor, distance = Infinity;
      for (const secondary of support.secondary) for (const t of [.30, .64, .97]) { const point = secondary.getPointAt(t), d = point.distanceToSquared(position); if (d < distance) { distance = d; anchor = point; } }
      b.branch(branches, [anchor, anchor.clone().lerp(position, .58).add(V(0, -.015, 0)), position], [.0027, .0015, .0006], { radialSegments: 4, segments: 5, bark: 0, color: '#7c8e69' });
      foliage[i % materials.length].add(pose(position, aim(grow, angle + rng() * 1.3), V(scale, scale, scale)), .83 + rng() * .25); b.counts.foliageSprays++; b.counts.alphaBranchletSprays += 3;
    }
    b.flush(group, branches, b.m.bark); foliage.forEach((batch, i) => b.instanceFlush(group, batch, sprays[i], materials[i]));
    if (tier === 1) {
      const detail = b.group(group, 'juniper-detail-spray', { body: 'actual-near-view-scale-and-awl-leaf-geometry' }), geometry = juniperSpray(), point = V(cx + .27, height + .13, cz + rz * .69);
      const mesh = b.mesh(detail, geometry, b.m.leaves, 'juniper-real-leaf-detail'); mesh.applyMatrix4(pose(point, aim(V(.27, .88, .40), .4)));
    }
  });
  root.userData.growth = { branchOrders: 5, clippedLevels: tiers.length, terminalArchitecture: 'curved-alpha-branchlet-volumes-and-near-geometric-leaves', leafScalePreserved: true };
}

function lotusFlower(b, root, name, position, white = false, yaw = 0) {
  const group = b.group(root, name, { body: 'lotus-flower-with-petals-stamens-receptacle', cultivarIdentity: 'unassigned-authored-pink-or-ivory-form' }); group.position.set(...position); group.rotation.y = yaw;
  const petals = new VegetationGeometryBatch(`${name}-curled-petals`), stamens = new VegetationGeometryBatch(`${name}-gold-stamens`);
  for (const [layer, count, length, width, lift, tip] of [[0, 11, .40, .19, .105, .085], [1, 10, .31, .18, .16, .12], [2, 8, .215, .14, .18, .13]]) {
    const petal = lotusPetalGeometry({ length: length * (1 - (yaw - .4) * .12), width, lift: lift + yaw * .025, tip, white });
    for (let i = 0; i < count; i++) { const angle = i / count * TAU + layer * .34 + Math.sin(i * 4.1) * .024, rotation = new THREE.Quaternion().setFromAxisAngle(UP, angle).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.sin(i * 2.9 + layer) * .035)); petals.add(petal, pose([Math.sin(angle) * .035, layer * .010, Math.cos(angle) * .035], rotation, V(1, .94 + .08 * Math.sin(i * 1.8 + .7) ** 2, 1)), .97 + Math.sin(i * 2.7) * .025); }
    petal.dispose();
  }
  const receptacle = lotusReceptacleGeometry();
  b.mesh(group, receptacle, b.m.stem, `${name}-central-receptacle`);
  for (let i = 0; i < 64; i++) {
    const angle = i * 2.399963, r = .10 + .03 * (i % 3) / 2, height = .14 + .045 * Math.sin(i * 3.1) ** 2, a = V(Math.cos(angle) * .067, .025, Math.sin(angle) * .067), end = V(Math.cos(angle) * r, height, Math.sin(angle) * r);
    b.branch(stamens, [a, a.clone().lerp(end, .7).add(V(0, .025, 0)), end], [.0027, .0021, .0016], { radialSegments: 4, segments: 6, bark: 0, color: '#d8bb66' });
    b.branch(stamens, [end.clone().add(V(0, -.009, 0)), end.clone().add(V(0, .003, 0)), end.clone().add(V(0, .011, 0))], [.003, .006, .002], { radialSegments: 6, segments: 4, bark: 0, color: '#e4c87b' });
  }
  b.flush(group, petals, b.m.petals); b.flush(group, stamens, b.m.stem); return group;
}

function lotus(b, root) {
  const stems = new VegetationGeometryBatch('lotus-curved-petioles-and-peduncles'), veinPrototypeColor = '#92a579';
  const leaves = [[0, .88, 0, .78, .12, .06], [-1.00, .42, .33, .63, -.22, .12], [1.13, 1.00, .24, .69, .14, -.18], [-.39, 1.23, -1.04, .57, .19, -.13], [1.34, .34, 1.25, .58, -.14, .15], [-1.46, .83, -1.02, .52, -.21, -.06], [.02, .23, 1.48, .61, .08, .21]];
  leaves.forEach(([x, y, z, radius, tiltX, tiltZ], i) => {
    const group = b.group(root, `lotus-leaf-${String(i + 1).padStart(2, '0')}`, { body: 'peltate-leaf-and-visible-veins', stemAttachment: [x, y, z] }); group.position.set(x, y, z); group.rotation.set(tiltX, i * .8, tiltZ);
    const bowl = .09 + i % 3 * .025, seed = i * .83 + .3, leaf = lotusLeafGeometry({ radius, bowl, seed }); b.mesh(group, leaf, b.m.leaves, `${group.name}-lamina`);
    const veins = new VegetationGeometryBatch(`${group.name}-radial-veins`);
    for (let vein = 0; vein < 13; vein++) {
      const angle = vein / 13 * TAU, points = Array.from({ length: 9 }, (_, node) => { const r = .03 + node / 8 * .94; return [Math.cos(angle) * radius * r, lotusLeafHeight(r, angle, bowl, seed) + .0018, Math.sin(angle) * radius * r]; });
      b.branch(veins, points, points.map((_, node) => .0017 * (1 - node / 11)), { radialSegments: 4, segments: 14, bark: 0, color: veinPrototypeColor });
    }
    b.flush(group, veins, b.m.stem); b.branch(stems, [[x * .74, -.08, z * .74], [x * .84 + .045, y * .45, z * .82 - .03], [x, y, z]], [.016, .012, .008], { radialSegments: 9, segments: 24, bark: .015, color: '#708e62' });
  });
  for (const [i, x, y, z, white] of [[1, .28, 1.52, -.56, false], [2, -1.04, 1.10, 1.13, true], [3, 1.75, 1.43, -.81, false]]) { lotusFlower(b, root, `lotus-flower-${String(i).padStart(2, '0')}`, [x, y, z], white, i * .4); b.branch(stems, [[x * .72, -.08, z * .74], [x * .91, y * .5, z * .87], [x, y, z]], [.012, .011, .009], { radialSegments: 8, segments: 22, bark: 0, color: '#77926c' }); }
  const bud = b.group(root, 'lotus-bud', { body: 'closed-lotus-bud' }); bud.position.set(-1.73, 1.45, .10);
  const budBatch = new VegetationGeometryBatch('lotus-bud-overlapping-sepals');
  const budPetal = lotusBudPetalGeometry();
  for (let i = 0; i < 8; i++) { const angle = i / 8 * TAU, matrix = pose([0, 0, 0], new THREE.Quaternion().setFromAxisAngle(UP, angle)); budBatch.add(budPetal, matrix); }
  budPetal.dispose(); b.flush(bud, budBatch, b.m.petals); b.branch(stems, [[-1.32, -.08, .08], [-1.52, .71, .09], [-1.73, 1.45, .10]], [.012, .010, .007], { radialSegments: 8, segments: 22, bark: 0, color: '#77926c' }); b.flush(root, stems, b.m.stem);
}

export function createGardenVegetationStudy({ specimens = gardenVegetationSpecs.map(spec => spec.id), arrange = true, texturePixels } = {}) {
  const selected = new Set(specimens); for (const id of selected) if (!gardenVegetationSpecs.some(spec => spec.id === id)) throw new Error(`Unknown vegetation specimen: ${id}`);
  if (selected.has('pine')) validateVegetationTexturePixels(texturePixels);
  if (selected.has('lake-rock')) validateLakeStonePixels(texturePixels?.stone);
  const builder = new VegetationBuilder(texturePixels), group = new THREE.Group(); group.name = 'yuanming-garden-vegetation-study'; group.userData = { evidence: 'historically-informed-authored-botanical-studies', fullGardenDistribution: false, referencePhotographyBundled: false, sourceMaterialMaps: [...(selected.has('pine') ? ['polyhaven:pine_bark'] : []), ...(selected.has('lake-rock') ? ['polyhaven:rock_01'] : [])] };
  const factories = { willow, pine, juniper, lotus, 'lake-rock': (b, parent) => b.mesh(parent, lakeStoneGeometry(), b.stoneMaterial(), 'lake-rock-main', { body: 'perforated-garden-limestone' }) }, parts = [];
  try {
    for (const spec of gardenVegetationSpecs.filter(spec => selected.has(spec.id))) { const part = builder.group(group, spec.name, { id: spec.id, label: spec.label, body: spec.form, sourceIds: spec.sourceIds, evidence: spec.evidence }); if (arrange) part.position.set(...spec.position); factories[spec.id](builder, part); parts.push(part); }
    group.updateMatrixWorld(true);
    const subassemblies = parts.map(part => { let triangles = 0, meshes = 0, instances = 0; const geometries = new Set(); part.traverse(child => { if (child.isMesh) { meshes++; const count = child.isInstancedMesh ? child.count : 1; instances += child.isInstancedMesh ? child.count : 0; triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3 * count; geometries.add(child.geometry); } }); const box = new THREE.Box3().setFromObject(part), storedTriangles = [...geometries].reduce((sum, geometry) => sum + (geometry.index?.count ?? geometry.attributes.position.count) / 3, 0); return { id: part.userData.id, name: part.name, triangles, storedTriangles, meshes, instances, bounds: { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(V()).toArray() } }; });
    const bounds = new THREE.Box3().setFromObject(group), diagnostics = { id: 'yuanming-garden-vegetation-study-v4', evidence: group.userData.evidence, sourceIds: [...new Set(gardenVegetationSpecs.filter(spec => selected.has(spec.id)).flatMap(spec => spec.sourceIds))], subassemblies, triangleCount: subassemblies.reduce((sum, part) => sum + part.triangles, 0), meshCount: subassemblies.reduce((sum, part) => sum + part.meshes, 0), authoredElements: builder.counts, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(V()).toArray() }, metresSurveyed: false, fullGardenDistribution: false, renderVerified: false, limitations: ['Individual height, branch architecture, clipping outlines, leaf size, flowering season and stone shape are authored studies, not recovered 1859–1860 specimens.', 'Historical sources support plant categories and garden relationships; exact full-garden planting positions remain unregistered.', 'Taihu-style stone is a new authored surface with physical openings, not a scan or copy of a named historical object. Rock 01 supplies photographic micro-surface texture without a verified Taihu geological identity.', 'Juniper crowns combine original curved alpha branchlets with actual geometric scale and awl leaves in the close study; photographs are reference only.'] };
    let disposed = false; return { group, specimens: parts, diagnostics, views: gardenVegetationViews, dispose() { if (disposed) return; disposed = true; builder.dispose(); group.clear(); } };
  } catch (error) { builder.dispose(); group.clear(); throw error; }
}
