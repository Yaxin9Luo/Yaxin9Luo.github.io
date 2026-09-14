import * as THREE from 'three';
import { TAU, V, namedGroup } from './study-geometry.js';
import { GardenGateBuilder, piercedWall, archMouldings, column, urn, reliefPanel, cartouche, foliateScroll, latticePanel, openGateLeaves, gardenBridge, roundPool, chineseRoof } from './huanghuazhen-geometry.js';
import { AVIARY_DIMENSIONS, eastParapet, hangingBowl, westFountainOrnament, stoneCanopy, westRidgeCrest } from './yangquelong-geometry.js';

const INFERRED = 'authored-proportional-reconstruction-hypothesis';
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const circleAt = (x, z, radius) => Array.from({ length: 72 }, (_, i) => [x + Math.sin(i / 72 * TAU) * radius, z + Math.cos(i / 72 * TAU) * radius]);

function courtsAndBridge(b, root) {
  const g = namedGroup(root, 'yangquelong-courts-and-water-bridge', { body: 'two-paved-courts-and-eastern-water-crossing', dimensionsEvidence: INFERRED });
  const channel = rect(13, -23.5, 18, 23.5), poolHoles = [-1, 1].map(side => circleAt(-6.6, side * 4.85, 1.30));
  const paving = namedGroup(g, 'yangquelong-court-paving', { body: 'stone-court-with-cutouts-for-pools-and-eastern-channel' });
  b.polygon(paving, rect(-19, -24, 22, 24), -.20, 0, b.m.paving, [channel, ...poolHoles]);
  const river = namedGroup(g, 'yangquelong-east-water-channel', { body: 'open-water-channel-beneath-the-east-bridge', waterLevel: -.30 });
  b.polygon(river, channel, -.84, -.75, b.m.wetStone); b.polygon(river, channel, -.306, -.30, b.m.water);
  for (const x of [12.92, 18.08]) b.box(river, b.m.stone, [x, -.36, 0], [.16, .82, 47.3], .014);
  gardenBridge(b, g, 'yangquelong-east-arched-stone-bridge', 15.5, 0, 3.95, 5.6, Math.PI / 2);
  const joints = namedGroup(g, 'yangquelong-axis-paving-stones', { body: 'cut-stone-approach-pavers-with-narrow-mortar-joints' });
  for (const [x0, x1] of [[-18.8, -5.22], [5.22, 12.75], [18.35, 21.8]]) {
    for (let x = x0; x < x1; x += .76) b.box(joints, b.m.joint, [x, .003, 0], [.010, .004, 3.25], 0);
    for (const z of [-1.61, -.54, .54, 1.61]) b.box(joints, b.m.joint, [(x0 + x1) / 2, .003, z], [x1 - x0, .004, .010], 0);
  }
  const fountains = namedGroup(g, 'yangquelong-west-paired-fountains', { body: 'paired-small-fountains-in-front-of-the-west-grilles', sculptureIdentity: 'unresolved' });
  for (const side of [-1, 1]) { const pool = roundPool(b, fountains, `yangquelong-west-pool-${side < 0 ? 'north' : 'south'}`, -6.6, side * 4.85, 1.08, .34, .17); westFountainOrnament(b, pool, `${pool.name}-foliate-ornament`); }
  // Stone bed edging gives a truthful attachment footprint for later reviewed
  // planting assets; this factory makes no unsupported tree species or count.
  const beds = namedGroup(g, 'yangquelong-garden-bed-edgings', { body: 'low-shaped-stone-edgings-for-later-planting' });
  for (const [x, z, w, d] of [[-12.8, -10.5, 7.2, 13.8], [-12.8, 10.5, 7.2, 13.8], [8.55, -13.0, 6.3, 16.0], [8.55, 13.0, 6.3, 16.0]]) {
    const shape = [[x - w / 2 + .65, z - d / 2], [x + w / 2 - .65, z - d / 2], [x + w / 2, z - d / 2 + .65], [x + w / 2, z + d / 2 - .65], [x + w / 2 - .65, z + d / 2], [x - w / 2 + .65, z + d / 2], [x - w / 2, z + d / 2 - .65], [x - w / 2, z - d / 2 + .65]];
    const inner = shape.map(([xx, zz]) => [x + (xx - x) * .965, z + (zz - z) * .982]);
    b.polygon(beds, shape, -.01, .12, b.m.stone, [inner]);
  }
}

function mainPassage(b, root) {
  const g = namedGroup(root, 'yangquelong-main-through-passage', { body: 'real-east-west-passage-behind-different-facades', clearWidth: 2.90, floorHeight: .30 });
  const floor = namedGroup(g, 'yangquelong-main-floor-and-stairs', { body: 'solid-raised-floor-with-three-grounded-steps-at-each-end' });
  b.box(floor, b.m.paving, [0, .10, 0], [8.24, .40, 17.5], .014);
  for (const side of [-1, 1]) {
    const steps = namedGroup(floor, `yangquelong-${side < 0 ? 'west' : 'east'}-entrance-steps`, { body: 'three-solid-stone-treads', riser: .10, width: 3.3 }); steps.rotation.y = side * Math.PI / 2;
    for (let i = 0; i < 3; i++) b.box(steps, b.m.stone, [0, .05 * (i + 1) - .02, 4.08 + (2.5 - i) * .37], [3.3, .10 * (i + 1) + .04, .39], .008);
  }
  const walls = namedGroup(g, 'yangquelong-passage-sidewalls', { body: 'thick-parallel-masonry-walls-with-side-door-openings' });
  for (const side of [-1, 1]) {
    const wall = namedGroup(walls, `yangquelong-passage-wall-${side}`, { body: 'internal-wall-with-real-side-door-to-lateral-space' }); wall.position.z = side * 1.91;
    b.add(wall, piercedWall(7.20, .30, 4.96, .24, [{ x: 0, bottom: .30, width: 1.30, spring: 2.30, rise: .54 }]), b.m.plaster);
    for (const x of [-2.42, 2.42]) reliefPanel(b, wall, [x, 2.18, -side * .145], 1.52, 2.92);
  }
  const ceiling = namedGroup(g, 'yangquelong-passage-ceiling', { body: 'solid-high-ceiling-and-arched-transverse-ribs' });
  b.box(ceiling, b.m.plaster, [0, 5.05, 0], [7.0, .19, 17.15], .01);
  for (const x of [-2.0, 0, 2.0]) {
    const rib = namedGroup(ceiling, `yangquelong-passage-rib-${x}`, { body: 'stone-ceiling-rib-sprung-above-pedestrian-headroom' }); rib.position.x = x; rib.rotation.y = Math.PI / 2;
    archMouldings(b, rib, 0, 3.67, 3.56, 3.77, .90, 0, b.m.stone);
  }
  for (const side of [-1, 1]) b.add(g, piercedWall(7.35, .30, 4.96, .34, [{ x: 0, bottom: .30, width: 1.55, spring: 2.20, rise: .50 }]), b.m.plaster, [0, 0, side * 8.47]);
}

function westFacade(b, root) {
  const g = namedGroup(root, 'yangquelong-west-chinese-gate', { body: 'chinese-layered-eave-western-facing-gateway', facing: 'west', evidence: 'historic-engraving-plate-six' }); g.position.x = AVIARY_DIMENSIONS.westFacadeX; g.rotation.y = -Math.PI / 2;
  const wall = namedGroup(g, 'yangquelong-west-facade-masonry', { body: 'five-bay-gateway-with-true-arched-door-and-grilled-openings' });
  b.add(wall, piercedWall(4.4, .30, 6.96, .72, [{ x: 0, bottom: .30, width: 2.90, spring: 3.53, rise: 1.03 }]), b.m.stone);
  archMouldings(b, wall, 0, .33, 2.93, 3.53, 1.05, .40);
  openGateLeaves(b, g, 'yangquelong-west-open-central-leaves', 2.86, .32, 3.13);
  latticePanel(b, g, 'yangquelong-west-central-fanlight', 2.81, 3.60, 3.61, .89, .19, b.m.grille, 0, .17);
  for (const side of [-1, 1]) {
    b.add(wall, piercedWall(5.48, .30, 5.54, .60, [{ x: 0, bottom: .93, width: 3.19, spring: 3.44, rise: 1.13 }]), b.m.stone, [side * 4.94, 0, 0]);
    latticePanel(b, g, `yangquelong-west-large-grille-${side}`, 3.13, .95, 3.44, 1.10, .185, b.m.grille, side * 4.94, -.06);
    archMouldings(b, wall, side * 4.94, .95, 3.22, 3.44, 1.15, .34);
    b.add(wall, piercedWall(2.58, .30, 4.40, .46, [{ x: 0, bottom: .78, width: 1.44, spring: 2.77, rise: .53 }]), b.m.stone, [side * 8.95, 0, 0]);
    latticePanel(b, g, `yangquelong-west-outer-grille-${side}`, 1.41, .80, 2.77, .50, .165, b.m.grille, side * 8.95, -.04);
    column(b, g, `yangquelong-west-high-column-${side}`, side * 1.96, .55, .30, 6.64, .22, false);
    for (const offset of [-2.18, 2.18]) column(b, g, `yangquelong-west-middle-column-${side}-${offset}`, side * 4.94 + offset, .53, .30, 5.22, .20, false);
    column(b, g, `yangquelong-west-outer-column-${side}`, side * 10.12, .41, .30, 4.08, .18, false);
    const canopy = namedGroup(g, `yangquelong-west-side-canopy-${side}`, { body: 'cloud-carved-spandrel-below-the-side-eave' });
    stoneCanopy(b, canopy, `${canopy.name}-profile`, side * 4.94, 5.31, 2.03, .56);
    const sideRoof = namedGroup(g, `yangquelong-west-side-roof-${side}`, { body: 'lower-west-gateway-tiled-roof' }); sideRoof.position.set(side * 4.97, 0, -.40);
    chineseRoof(b, sideRoof, `${sideRoof.name}-tiles`, 6.00, 3.72, 5.61, 1.09, 3.7);
    westRidgeCrest(b, sideRoof, 0, 6.77, 3.5);
    const outerRoof = namedGroup(g, `yangquelong-west-outer-roof-${side}`, { body: 'lowest-roof-over-the-lateral-gateway-bay' }); outerRoof.position.set(side * 8.95, 0, -.25);
    chineseRoof(b, outerRoof, `${outerRoof.name}-tiles`, 3.50, 3.35, 4.47, .81, 1.82);
  }
  stoneCanopy(b, g, 'yangquelong-west-upper-cloud-carving', 0, 6.76, 1.77, .56);
  stoneCanopy(b, g, 'yangquelong-west-lower-cloud-carving', 0, 5.73, 1.77, .56);
  const roof = namedGroup(g, 'yangquelong-west-high-central-roof', { body: 'highest-central-hip-roof-over-the-west-door' }); roof.position.z = -.44;
  chineseRoof(b, roof, 'yangquelong-west-high-central-laid-tiles', 5.60, 4.10, 7.03, 1.15, 3.7);
  westRidgeCrest(b, roof, 0, 8.27, 3.74);
  return g;
}

function eastFacade(b, root) {
  const g = namedGroup(root, 'yangquelong-east-european-gate', { body: 'european-stone-gateway-with-curving-open-balustrade', facing: 'east', evidence: 'historic-engraving-plate-seven' }); g.position.x = AVIARY_DIMENSIONS.eastFacadeX; g.rotation.y = Math.PI / 2;
  const wall = namedGroup(g, 'yangquelong-east-facade-masonry', { body: 'deep-arched-door-and-two-real-niche-openings' });
  const openings = [{ x: 0, bottom: .30, width: 3.12, spring: 3.67, rise: 1.35 }, ...[-1, 1].map(side => ({ x: side * 4.98, bottom: 1.06, width: 2.10, spring: 4.38, rise: .82 }))];
  b.add(wall, piercedWall(17.30, .30, 6.34, .80, openings), b.m.stone);
  archMouldings(b, wall, 0, .33, 3.16, 3.67, 1.39, .46);
  for (const delta of [.50, .68]) b.sweep(wall, [[-2.30 - delta * .3, 5.11, .52], [-2.00 - delta * .2, 5.89, .52], [-1.25, 6.40 + delta * .10, .52], [0, 6.70 + delta * .10, .52], [1.25, 6.40 + delta * .10, .52], [2.00 + delta * .2, 5.89, .52], [2.30 + delta * .3, 5.11, .52]], .11, .12, b.m.carving, V(0, 0, 1), 82);
  openGateLeaves(b, g, 'yangquelong-east-open-central-leaves', 3.08, .32, 3.29);
  latticePanel(b, g, 'yangquelong-east-central-fanlight', 3.02, 3.67, 3.69, 1.24, .18, b.m.grille, 0, .15);
  const fountains = namedGroup(g, 'yangquelong-east-niche-fountains', { body: 'paired-white-stone-wall-fountains-with-raised-receiving-bowls' });
  for (const side of [-1, 1]) {
    for (const offset of [-.34, .34]) column(b, g, `yangquelong-east-outer-column-${side}-${offset}`, side * 7.56 + offset, .55, .30, 5.86, .23);
    column(b, g, `yangquelong-east-inner-column-${side}`, side * 2.60, .53, .30, 5.85, .18);
    const niche = namedGroup(fountains, `yangquelong-east-niche-${side > 0 ? 'north' : 'south'}`, { body: 'deep-backed-arched-niche-with-carved-shell-and-scroll-stem' }); niche.position.x = side * 4.98;
    b.add(niche, piercedWall(2.32, .87, 5.55, .17, []), b.m.recess, [0, 0, -.46]);
    archMouldings(b, niche, 0, 1.09, 2.12, 4.38, .84, .44);
    b.shell(niche, [0, 4.55, .16], 1.67, 1.17, .25);
    for (const branch of [-1, 1]) foliateScroll(b, niche, [[0, 1.60, .33], [branch * .35, 2.06, .36], [branch * .30, 2.69, .37], [branch * .19, 3.37, .37], [branch * .07, 3.96, .35]], .082, .14);
    cartouche(b, niche, 0, 3.13, .39, .67, 1.06);
    const bowlName = `yangquelong-east-bowl-${side > 0 ? 'north' : 'south'}`;
    hangingBowl(b, fountains, bowlName, side * 4.98, 1.04, 1.31);
    b.waterArc(niche, [[0, 4.08, .40], [.18, 3.84, .74], [.45, 2.70, 1.21], [.55, 1.31, 1.22]], .012, `${niche.name}-jet`, bowlName);
    const head = namedGroup(g, `yangquelong-east-corner-entablature-${side}`, { body: 'projecting-layered-cornice-and-raised-square-pier' }); head.position.x = side * 7.57;
    for (const [y, width, h] of [[6.13, 2.44, .18], [6.35, 2.67, .18], [6.50, 2.46, .16], [7.31, 2.51, .14], [7.51, 2.71, .17]]) b.box(head, b.m.carving, [0, y, .10], [width, h, 1.35], .014);
    b.box(head, b.m.stone, [0, 6.94, .09], [2.19, .73, 1.08], .012);
    reliefPanel(b, head, [0, 6.95, .66], 1.18, .60);
    for (const x of [-.83, .83]) urn(b, head, [x, 7.61, .04], .95);
  }
  eastParapet(b, g);
  const crest = namedGroup(g, 'yangquelong-east-central-scroll-crest', { body: 'foliate-crown-rising-above-central-balustrade-with-sunburst' });
  for (const side of [-1, 1]) {
    foliateScroll(b, crest, [[0, 6.50, .46], [side * .46, 6.80, .47], [side * .82, 6.61, .47], [side * 1.15, 6.11, .49], [side * 1.69, 6.29, .48], [side * 1.58, 6.65, .48], [side * 1.28, 6.70, .48]], .13, .17);
    foliateScroll(b, crest, [[0, 8.13, .13], [side * .59, 8.39, .14], [side * .81, 8.17, .14], [side * 1.23, 8.20, .15], [side * 1.48, 8.47, .14]], .10, .15);
    b.leaf(crest, [side * .74, 8.49, .16], [.66, .83, .42], [0, 0, -side * .64]);
  }
  cartouche(b, crest, 0, 7.03, .49, .88, 1.29);
  b.lathe(crest, [[.28, 8.16], [.32, 8.34], [.26, 8.56], [.13, 8.71], [0, 8.74]], [0, 0, .13], b.m.carving, 40);
  for (let i = 0; i < 11; i++) {
    const a = -1.16 + i / 10 * 2.32, r0 = .43, r1 = i % 2 ? .86 : 1.01;
    b.sweep(crest, [[Math.sin(a) * r0, 8.53 + Math.cos(a) * r0, .12], [Math.sin(a) * r1, 8.53 + Math.cos(a) * r1, .12]], .042, .070, b.m.carving, V(0, 0, 1), 4);
  }
  return g;
}

function birdRooms(b, root) {
  const rooms = namedGroup(root, 'yangquelong-north-south-bird-rooms', { body: 'paired-enclosed-bird-room-wings-with-real-openwork-windows', evidence: 'institutional-description-north-and-south-bird-housing', internalLayout: 'unresolved-single-open-interior-per-wing' });
  for (const side of [-1, 1]) {
    const g = namedGroup(rooms, `yangquelong-${side < 0 ? 'north' : 'south'}-bird-room`, { body: 'roofed-masonry-wing-with-window-depth-and-interior-floor' }); g.position.z = side * 14.71;
    b.box(g, b.m.paving, [0, .10, 0], [7.84, .40, 12.78], .012);
    for (const facing of [-1, 1]) {
      const wall = namedGroup(g, `${g.name}-${facing < 0 ? 'west' : 'east'}-wall`, { body: 'pierced-wing-wall-with-four-lattice-window-openings' }); wall.position.x = facing * 3.66; wall.rotation.y = facing * Math.PI / 2;
      const openings = [-4.65, -1.55, 1.55, 4.65].map(x => ({ x, bottom: 1.02, width: 1.55, spring: 2.65, rise: .23 }));
      b.add(wall, piercedWall(12.32, .30, 3.69, .36, openings), b.m.plaster);
      for (const { x } of openings) {
        latticePanel(b, wall, `${wall.name}-grille-${x}`, 1.51, 1.04, 2.65, .20, .175, b.m.grille, x, -.08);
        archMouldings(b, wall, x, 1.0, 1.59, 2.65, .24, .23);
        b.box(wall, b.m.stone, [x, .94, .26], [1.89, .16, .34], .012);
        cartouche(b, wall, x, 3.18, .23, .76, .39);
      }
      for (const y of [.50, 3.52, 3.70]) b.box(wall, b.m.stone, [0, y, .12], [12.48, .12, .49], .008);
    }
    for (const end of [-1, 1]) {
      const wall = namedGroup(g, `${g.name}-end-${end}`, { body: 'substantial-wing-end-wall-with-arched-access-door' }); wall.position.z = end * 6.14; wall.rotation.y = end < 0 ? Math.PI : 0;
      b.add(wall, piercedWall(7.32, .30, 3.69, .36, [{ x: 0, bottom: .30, width: 1.55, spring: 2.20, rise: .50 }]), b.m.plaster);
      archMouldings(b, wall, 0, .33, 1.60, 2.20, .52, .22);
      for (const x of [-2.55, 2.55]) reliefPanel(b, wall, [x, 1.97, .20], 1.37, 2.22);
    }
    const roof = namedGroup(g, `${g.name}-complete-hip-roof`, { body: 'full-upturned-tiled-roof-over-the-bird-room' }); roof.rotation.y = Math.PI / 2;
    chineseRoof(b, roof, `${roof.name}-tile-pans`, 13.75, 8.95, 3.76, 1.50, 9.65);
    for (const z of [-4.65, -1.55, 1.55, 4.65]) b.box(g, b.m.timber, [0, 3.65, z], [7.05, .20, .19], .014);
  }
  return rooms;
}

export function createYangquelongStudy() {
  const b = new GardenGateBuilder('yangquelong'), root = new THREE.Group(); root.name = 'yuanmingyuan-yangquelong-study';
  root.userData = { assetId: 'yangquelong', visualAcceptance: false, integrationAcceptance: false, allDimensionsProportional: true, floorConvention: '+Y up; -X west to Xieqiqu; +X east toward Fangwaiguan' };
  try {
    courtsAndBridge(b, root); mainPassage(b, root); westFacade(b, root); eastFacade(b, root); birdRooms(b, root);
    return b.finish(root, {
      assetId: 'yangquelong', title: '养雀笼东西门庭 / Aviary west and east gateways', provisionalScale: { isProvisional: true, ...AVIARY_DIMENSIONS, rule: 'All dimensions use the paired engravings as proportional constraints; no as-built metric survey is asserted.' },
      evidence: [
        { type: 'historic-engraving', source: '/images/yuanmingyuan/yangquelong-west.jpg', label: '養雀籠西面，图六', constraints: 'hierarchy of tiled Chinese gateway roofs; large grille bays; paired foreground basins; lower bird-room wings' },
        { type: 'historic-engraving', source: '/images/yuanmingyuan/yangquelong-east.jpg', label: '養雀籠東面，图七', constraints: 'curving stone balustrade; paired columns; arched doorway; two wall fountain niches; bridge over eastern water' },
        { type: 'institutional-description', url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231509.html', constraints: 'different Chinese and European façades; bird rooms north and south; transition east of Xieqiqu' },
        { type: 'scholarly-exhibition', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/ymy2_essay02.html', constraints: 'west gateway faces Xieqiqu backcourt; east gateway leads toward Fangwaiguan; white-stone water features' },
      ],
      navigation: { axis: 'west-east', passageWidth: 2.90, floorHeight: .30, stairRiser: .10, stairWidth: 3.3, gateState: 'open-authored-review-state', runtimeCollisionImplemented: false },
      uncertainty: ['No readable metric survey establishes overall width, depth, façade spacing, room partitions, or water levels.', 'The engraved closed door leaves are opened in this study for a real passage; their grille pattern is authored.', 'The small west fountain statues cannot be identified at the available image resolution; foliate ornaments preserve their height and basin relationship without asserting an identity.', 'Roof glaze, stone finish, the hidden connecting roofs and room interiors are provisional.', 'Planting remains an attachment scope for reviewed garden vegetation. Native review and formal scene integration remain outstanding.'],
    });
  } catch (error) { b.dispose(); root.clear(); throw error; }
}
