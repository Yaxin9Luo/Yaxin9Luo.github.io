import * as THREE from 'three';
import { addXianfaqiaoDeck, addXianfaqiaoAbutment } from './xianfaqiao-deck-joins.js';
import { V, namedGroup } from './study-geometry.js';
import { GardenGateBuilder, thickPatch, stripPolygon, facadeGeometry, archMouldings, foliateScroll, cartouche, reliefPanel, urn, column } from './huanghuazhen-geometry.js';
import { XIANFA_IDS, XIANFA_EVIDENCE, HILL, spiralPoint, spiralOffset, SCREEN_LAYOUT, scenicWallSpec } from './xianfa-landscape-layout.js';
import { rect, landscapeMaterials, moundGeometry, spiralDeckGeometry, spiralParapetGeometry, xianfaGate, summitPavilion, scenicWingContour, paintedWingGeometry, scenicPaintingTexture, waterLanding, BRIDGE, fiveSluiceWallGeometry, bridgeScreenGeometry, bridgeScreenTop } from './xianfa-landscape-geometry.js';
import { configureXianfashanMaterials, projectXianfashanStoneUVs, validateXianfashanTexturePixels } from './xianfashan-materials.js';
import { xianfaWallPanel, xianfaPilasterPanel } from './xianfashan-details.js';

function studyRoot(key) {
  const root = new THREE.Group(); root.name = `yuanmingyuan-${XIANFA_IDS[key].assetId.replace(/-study$/, '')}-study`;
  root.userData = { ...XIANFA_IDS[key], visualAcceptance: false, integrationAcceptance: false, floorConvention: '+Y up; +X east; +Z south; independent local study coordinates' };
  return root;
}

function windingHill(b, root) {
  const hill = namedGroup(root, 'xianfashan-complete-earth-mound', { body: 'complete-earth-mound-with-supported-winding-road-benches', replacesTerrainLandformIds: ['xianfa-hill'], elevationEvidence: HILL.heightEvidence });
  b.add(hill, moundGeometry(), b.m.earth);
  const route = namedGroup(root, 'xianfashan-continuous-winding-route', { body: 'supported-three-turn-provisional-route-with-clear-1.5-m-width', windingEvidence: HILL.turnCountEvidence });
  const deck = namedGroup(route, 'xianfashan-winding-stone-deck', { body: 'closed-stone-ramp-with-real-underside-and-1.5-m-clear-passage', clearWidth: HILL.clearPathWidth });
  b.add(deck, spiralDeckGeometry(), b.m.paving);
  for (const side of [-1, 1]) {
    const wall = namedGroup(route, `xianfashan-winding-glazed-parapet-${side}`, { body: 'continuous-low-green-glazed-parapet-with-yellow-coping', source: 'park-description-yellow-green-low-glazed-parapets' });
    b.add(wall, spiralParapetGeometry(side), b.m.glazeGreen); b.add(wall, spiralParapetGeometry(side, true), b.m.glazeYellow);
  }
  const joints = namedGroup(route, 'xianfashan-ramp-cut-stone-joints', { body: 'transverse-cut-stone-joints-following-ramp-grade' });
  for (let i = 1; i < 440; i++) {
    const t = i / 440;
    b.add(joints, thickPatch((u, v) => spiralOffset(t + (v - .5) * .00004, (u - .5) * 1.49, .002), 1, 1, .002), b.m.joint);
  }
  const paving = namedGroup(root, 'xianfashan-ground-approaches', { body: 'west-arrival-east-exit-and-ground-level-bypass-with-no-cut-through-the-hill' });
  b.polygon(paving, stripPolygon([[-44, 0], [-24, 0]], 1.74), -.17, .04, b.m.paving);
  const bypass = Array.from({ length: 97 }, (_, i) => { const a = Math.PI - i / 96 * Math.PI; return [26.8 * Math.cos(a), 26.8 * Math.sin(a)]; });
  b.polygon(paving, stripPolygon([[-29.0, 0], ...bypass, [36, 0]], 1.22), -.17, .04, b.m.paving);
  const foot = namedGroup(root, 'xianfashan-foot-gateposts', { body: 'separate-low-gateposts-at-foot-of-winding-ascent', evidence: 'engraving-plate-18' });
  for (const side of [-1, 1]) {
    const post = namedGroup(foot, `xianfashan-foot-gatepost-${side}`, { body: 'small-decorated-foot-gate-pier' }); post.position.set(-25.2, 0, side * 1.28);
    b.box(post, b.m.stone, [0, 1.08, 0], [.58, 2.16, .58], .016);
    for (const y of [.12, 1.94, 2.13]) b.box(post, b.m.carving, [0, y, 0], [.76, .16, .76], .013);
    urn(b, post, [0, 2.21, 0], .66);
    xianfaPilasterPanel(b,post,0,1.04,.307,.34,1.29);
  }
  const enclosure = namedGroup(root, 'xianfashan-west-enclosure-walls', { body: 'low-panelled-walls-adjoining-west-gateway', layoutEvidence: 'engraved-facade-span; authored-return-depth' });
  for (const side of [-1, 1]) {
    const wall = namedGroup(enclosure, `xianfashan-west-flank-${side}`, { body: 'continuous-low-west-wall-with-recessed-panels' }); wall.position.set(HILL.westGateX, 0, side * 17.4); wall.rotation.y = -Math.PI / 2;
    b.box(wall, b.m.plaster, [0, 1.22, 0], [21.6, 2.44, .54], .016);
    for (const y of [.18, 2.30, 2.47]) b.box(wall, b.m.stone, [0, y, .02], [21.74, .16, .66], .01);
    for (let i = -5; i <= 5; i++) xianfaWallPanel(b, wall, [i * 1.87, 1.30, .29], 1.47, 1.56);
  }
}

export function createXianfashanStudy({texturePixels}={}) {
  validateXianfashanTexturePixels(texturePixels);
  const b = landscapeMaterials(new GardenGateBuilder('xianfashan')), root = studyRoot('hill');
  try {
    configureXianfashanMaterials(b,texturePixels);
    windingHill(b, root); xianfaGate(b, root); xianfaGate(b, root, true); summitPavilion(b, root);
    projectXianfashanStoneUVs(b);
    return b.finish(root, {
      ...XIANFA_IDS.hill, title: '线法山、东西山门与山顶亭', replacesTerrainLandformIds: ['xianfa-hill'],
      provisionalScale: { isProvisional: true, ...HILL },
      evidence: [{ type: 'historic-engraving', source: '/images/yuanmingyuan/xianfashan-gate-front.jpg', plate: 17 }, { type: 'historic-engraving', source: '/images/yuanmingyuan/xianfashan-front.jpg', plate: 18 }, { type: 'historic-engraving', source: '/images/yuanmingyuan/xianfashan-east-gate.jpg', plate: 19 }, { type: 'institutional-description', url: XIANFA_EVIDENCE.hill }],
      navigation: { clearPathWidth: HILL.clearPathWidth, climbStart: spiralPoint(0), climbEnd: spiralPoint(1), summitFloor: HILL.summitFloor, pavilionDoors: 4, separateGroundBypass: true, runtimeCollisionImplemented: false },
      materialRefinement: {ground:'verified-full-resolution-CC0-aerial-grass-rock-at-15m-repeat',stone:'verified-rock-01-normal-and-roughness-with-authored-white-albedo',vertexColourCheckerRemoved:true,doorState:'side-leaves-authored-fully-open-preserving-original-clear-width'},
      plantingAttachments: Array.from({ length: 32 }, (_, i) => { const t = .07 + i / 31 * .84; return { position: spiralOffset(t, -2.20, -.20), role: 'reviewed-garden-tree-or-shrub', species: null, placementEvidence: 'authored-spacing-to-be-adjusted-to-terrain-contact-and-source-view' }; }),
      uncertainty: ['The reported 8 m height and 1.5 m road width are approximate institutional descriptions, not an original survey.', HILL.turnCountEvidence, 'Mound footprint, gate spacing, roof assembly, rear decoration and glaze shades are proportional hypotheses.', 'The fully owned mound must replace xianfa-hill terrain; stacking both would bury paths.', 'Planting is an attachment contract pending reviewed vegetation; this bare study does not claim the historical planted scene is complete.', 'Native visual review and formal integration remain outstanding.'],
    });
  } catch (error) { b.dispose(); root.clear(); throw error; }
}

function fangheBasin(b, root) {
  const w = SCREEN_LAYOUT.water, g = namedGroup(root, 'xianfahua-fanghe-basin', { body: 'single-rectangular-water-basin-with-submerged-bed-and-real-stone-banks', waterLevel: w.level });
  const basin = rect(w.x0, -w.halfWidth, w.x1, w.halfWidth);
  b.polygon(g, basin, w.floor - .12, w.floor, b.m.wetStone); b.polygon(g, basin, w.level - .006, w.level, b.m.water);
  const paving = namedGroup(root, 'xianfahua-bank-paving', { body: 'continuous-stone-bank-with-open-water-cutout' });
  b.polygon(paving, rect(w.x0 - 5.7, -w.halfWidth - 3.6, 57, w.halfWidth + 3.6), -.24, 0, b.m.paving, [basin]);
  for (const side of [-1, 1]) {
    const bank = namedGroup(g, `xianfahua-bank-${side}`, { body: 'coursed-stone-retaining-bank' });
    for (let row = 0; row < 3; row++) for (let i = 0; i < 96; i++) {
      const length = (w.x1 - w.x0) / 96;
      b.box(bank, row === 0 ? b.m.wetStone : b.m.stone, [w.x0 + length * (i + .5), -.91 + row * .33, side * (w.halfWidth + .065)], [length - .014, .32, .32], .012);
    }
    b.box(bank, b.m.carving, [(w.x0 + w.x1) / 2, .05, side * (w.halfWidth + .07)], [w.x1 - w.x0 + .35, .18, .57], .012);
  }
  for (const [x, direction, name] of [[w.x0, 1, 'west'], [w.x1, -1, 'east']]) {
    for (const side of [-1, 1]) b.box(g, b.m.stone, [x, -.44, side * (w.halfWidth + 4.41) / 2], [.37, 1.24, w.halfWidth - 4.41], .012);
    waterLanding(b, g, `xianfahua-${name}-water-landing`, x, direction);
  }
}

function perspectiveScreens(b, root) {
  const g = namedGroup(root, 'xianfahua-shallow-perspective-scenery', { body: 'paired-tapering-masonry-stage-wings-and-a-painted-rear-screen', wallCountStatus: SCREEN_LAYOUT.countStatus });
  const paints = [];
  for (let i = 0; i < 7; i++) {
    const texture = scenicPaintingTexture(i, i === 6); b.textures.add(texture);
    const m = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: .87, side: THREE.FrontSide }); m.name = `xianfahua-authored-paint-layer-${i}`; m.userData = { category: 'scenic-painting', evidence: 'new-authored-illustrative-painted-facades-not-surviving-Qing-paintings' }; b.materials.add(m); paints.push(m);
  }
  for (let row = 0; row < SCREEN_LAYOUT.pairs.length; row++) for (const side of [-1, 1]) {
    const spec = scenicWallSpec(row, side), wing = namedGroup(g, spec.name, { body: row ? 'thin-shaped-masonry-wing-with-painted-scenery' : 'shallow-arched-front-stage-frame', wallDepth: spec.depth, row: row + 1, side, dimensionsEvidence: 'authored-proportional-stage-layout' }); wing.position.set(spec.x, 0, spec.z); wing.rotation.y = spec.yaw;
    b.add(wing, facadeGeometry(scenicWingContour(spec.width, spec.height, row), -spec.depth / 2, spec.depth / 2), b.m.brick);
    b.add(wing, paintedWingGeometry(spec.width, spec.height, row, spec.depth / 2 + .008), paints[row]);
    const rear = namedGroup(wing, `${spec.name}-unpainted-rear`, { body: 'plain-brick-reverse-and-shallow-support-footings', evidence: 'authored-structural-completion' });
    for (const x of [-spec.width * .43, spec.width * .43]) b.box(rear, b.m.brick, [x, .15, -.28], [.64, .30, 1.04], .015);
    if (row === 0) {
      archMouldings(b, wing, 0, 0, spec.width * .48, spec.height * .58, spec.height * .24, .42);
      for (const x of [-spec.width * .40, spec.width * .40]) {
        for (let i = 0; i < 17; i++) b.box(wing, b.m.stone, [x, .31 + i * .49, .47], [1.02, .46, .28], .014);
        b.box(wing, b.m.carving, [x, 8.78, .46], [1.29, .21, .37], .012);
      }
      for (const y of [9.67, 9.89]) b.box(wing, b.m.carving, [0, y, .31], [spec.width + .12, .17, .86], .015);
      cartouche(b, wing, 0, 9.25, .43, 1.32, .80);
    }
  }
  const s = SCREEN_LAYOUT.back, back = namedGroup(g, 'xianfahua-painted-backdrop-wall', { body: 'one-flat-painted-mountain-and-distant-town-backdrop', wallDepth: .44, paintingIdentity: 'authored-scene-not-historical-pigment-or-subject-identification' }); back.position.x = s.x; back.rotation.y = -Math.PI / 2;
  b.box(back, b.m.brick, [0, s.height / 2, 0], [s.width, s.height, .44], .01);
  const paint = new THREE.PlaneGeometry(s.width - .10, s.height - .08); b.add(back, paint, paints[6], [0, s.height / 2, .231]);
  for (const x of [-6.5, -3.2, 0, 3.2, 6.5]) b.box(back, b.m.brick, [x, .55, -.37], [.45, 1.1, .55], .012);
}

export function createFangheXianfahuaStudy() {
  const b = new GardenGateBuilder('xianfahua'), root = studyRoot('screens');
  try {
    fangheBasin(b, root); perspectiveScreens(b, root);
    return b.finish(root, {
      ...XIANFA_IDS.screens, title: '方河与湖东线法画', replacesOrnamentalWaterIds: ['fanghe'],
      provisionalScale: { isProvisional: true, ...SCREEN_LAYOUT },
      evidence: [{ type: 'historic-engraving', source: '/images/yuanmingyuan/xianfahua-east-of-lake.jpg', plate: 20 }, { type: 'institutional-description', url: XIANFA_EVIDENCE.screens }, { type: 'published-Yangshi-Lei-plan-and-research', url: XIANFA_EVIDENCE.planDiscussion, sourceImage: XIANFA_EVIDENCE.planImage, imagePixels: [554, 167], imageActuallyViewed: true }, { type: 'conflicting-research-count', url: XIANFA_EVIDENCE.competingCount }],
      scenery: { pairedWings: 12, rearScreens: 1, countStatus: SCREEN_LAYOUT.countStatus, volumetricCityBuildings: 0, paintingTechnique: 'authored-2D-data-textures-on-thin-masonry-wings', viewpoint: [-159, 1.65, 0] },
      navigation: { axis: 'west-east-across-water-view-only', waterIsWalkable: false, bankWalkwayWidth: 3.6, separateEasternBackstageWalkway: true, runtimeCollisionImplemented: false },
      uncertainty: ['The 2011 park account, 2025 article prose and table, and 2022 article disagree on wall counts. This six-pair-plus-backdrop study is provisional.', 'The low-resolution published Yangshi Lei plan is not a readable measured as-built survey; original table dimensions and ambiguous thickness remain unconverted.', SCREEN_LAYOUT.metricStatus, 'Paint palette and exact building imagery are newly authored. The conflicting Aksu attribution is retained in the report but is not asserted by this model.', 'The existing coarse map pond and scenic-wall group have an unresolved north-south displacement; no world registration is asserted.', 'The water basin replaces the coarse fanghe surface if adopted; native review and formal integration remain outstanding.'],
    });
  } catch (error) { b.dispose(); root.clear(); throw error; }
}

export function createXianfaqiaoStudy() {
  const b = new GardenGateBuilder('xianfaqiao'), root = studyRoot('bridge');
  try {
    const base = namedGroup(root, 'xianfaqiao-five-opening-sluice', { body: 'five-low-arched-sluice-openings-under-the-screen-bridge', evidence: 'historic-photograph-Bennett-figure-5.40-post-destruction' });
    b.add(base, fiveSluiceWallGeometry(), b.m.wetStone);
    addXianfaqiaoDeck(b, base);
    for (const side of [-1, 1]) {
      const face = namedGroup(base, `xianfaqiao-sluice-face-${side}`, { body: 'five-open-stone-arch-rings' }); face.position.z = side * BRIDGE.depth / 2; face.rotation.y = side > 0 ? 0 : Math.PI;
      for (const x of BRIDGE.pierX) archMouldings(b, face, x, -1.65, 3.70, -.74, 1.24, .01);
      for (const y of [.83, 1.00]) b.box(face, b.m.carving, [0, y, .04], [32.34, .14, .23], .012);
    }
    const screen = namedGroup(root, 'xianfaqiao-european-screen-and-central-gate', { body: 'long-carved-screen-wall-and-tall-curving-central-gateway', evidence: 'historic-photograph-figures-5.28-and-5.40', rearEvidence: 'unseen-rear-plain-completion-hypothesis' });
    b.add(screen, bridgeScreenGeometry(), b.m.plaster);
    for (const offset of [0, .18]) b.sweep(screen, bridgeScreenTop().map(([x, y]) => [x, y + offset, .34]), .13, .22, b.m.carving, V(0, 0, 1), 168);
    archMouldings(b, screen, 0, BRIDGE.deckY, BRIDGE.clearDoor, 3.91, 1.04, .42);
    for (const x of [-2.28, -1.55, 1.55, 2.28]) column(b, screen, `xianfaqiao-central-pilaster-${x}`, x, .52, BRIDGE.deckY, 5.22, .16);
    for (const side of [-1, 1]) {
      const x = side * 7.4;
      reliefPanel(b, screen, [x, 3.62, .41], 4.92, 2.11);
      cartouche(b, screen, x, 3.66, .50, 2.32, 1.13);
      for (const xx of [side * 10.65, side * 12.50, side * 14.36]) reliefPanel(b, screen, [xx, 3.37, .41], 1.44, 2.45);
      for (const yy of [1.48, 1.70, 2.0]) b.box(screen, b.m.carving, [side * 8.83, yy, .12], [13.78, .13, .85], .01);
      foliateScroll(b, screen, [[side * .13, 7.85, .46], [side * .60, 7.76, .47], [side * 1.11, 7.32, .48], [side * 1.46, 7.38, .48], [side * 1.77, 7.62, .48], [side * 2.12, 7.52, .48]], .14, .17);
      foliateScroll(b, screen, [[side * .11, 6.73, .47], [side * .57, 6.98, .48], [side * 1.17, 6.89, .47], [side * 1.54, 6.37, .47], [side * 2.46, 6.55, .47], [side * 3.19, 6.32, .46]], .13, .16);
      for (const x of [side * 5.44, side * 8.8]) foliateScroll(b, screen, [[x - side * .82, 5.11, .46], [x - side * .39, 5.48, .46], [x, 5.39, .46], [x + side * .33, 5.14, .46]], .10, .14);
    }
    cartouche(b, screen, 0, 5.65, .48, 1.22, .81); b.shell(screen, [0, 7.14, .44], .85, .56, .13);
    const rear = namedGroup(screen, 'xianfaqiao-plain-rear-door-mouldings', { body: 'plain-rear-door-completion-no-unverified-Chinese-roof' }); rear.rotation.y = Math.PI;
    archMouldings(b, rear, 0, BRIDGE.deckY, BRIDGE.clearDoor, 3.91, 1.04, .42);
    const channel = namedGroup(root, 'xianfaqiao-study-water-channel', { body: 'unregistered-local-water-fixture-through-five-openings', waterLevel: BRIDGE.waterY, evidence: 'modern-fixture-not-historic-channel-registration' });
    b.polygon(channel, rect(-16.2, -10, 16.2, 10), -1.81, -1.70, b.m.wetStone); b.polygon(channel, rect(-16.1, -10, 16.1, 10), BRIDGE.waterY - .006, BRIDGE.waterY, b.m.water);
    const land = namedGroup(root, 'xianfaqiao-study-grounded-abutments', { body: 'solid-bank-approaches-supporting-the-high-screen-and-deck', evidence: 'authored-review-fixture' });
    for (const side of [-1, 1]) addXianfaqiaoAbutment(b, land, base, side);
    return b.finish(root, {
      ...XIANFA_IDS.bridge, title: '线法桥五孔闸与西洋门（独立研究）', provisionalScale: { isProvisional: true, ...BRIDGE },
      evidence: [{ type: 'catalog-location', url: XIANFA_EVIDENCE.bridgeCatalog, catalogTitle: '长春园谐奇趣前湖西岸线法桥图', limit: 'Jin Xun drawing is a 1961 retrospective work, not an original Qing survey' }, { type: 'historic-photographs-reproduced-in-scholarly-publication', url: XIANFA_EVIDENCE.bridgePhotographs, printedPages: [298, 301], figures: ['5.28', '5.40'], dates: ['circa 1876', 'circa 1877–1879'], actuallyViewed: true }, { type: 'institutional-research-location', url: XIANFA_EVIDENCE.planDiscussion }],
      navigation: { deckHeight: BRIDGE.deckY, centralDoorClearWidth: BRIDGE.clearDoor, sluiceOpenings: 5, runtimeCollisionImplemented: false },
      uncertainty: ['This bridge belongs west of Xieqiqu, far from Xianfashan. It has no registered garden-layout or museum ID and must not be attached to the hill.', 'Both photographs are after destruction. Visible front stone profiles constrain this study but do not certify the complete pre-1860 state.', 'The rear roof or decoration, exact five arch spans, crest details, water level and deck approaches are unresolved.', 'All bridge metre dimensions and channel extent are authored proportions. Native review and formal integration remain outstanding.'],
    });
  } catch (error) { b.dispose(); root.clear(); throw error; }
}
