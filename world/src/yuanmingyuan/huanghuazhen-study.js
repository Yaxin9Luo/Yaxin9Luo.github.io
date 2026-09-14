import * as THREE from 'three';
import { TAU, V, namedGroup } from './study-geometry.js';
import { GardenGateBuilder, mazePlan, stripPolygon, domeGeometry, facadeGeometry, curvedFacadeContour, piercedWall, archMouldings, carvedBrickMotif, column, urn, baluster, reliefPanel, cartouche, foliateScroll, latticePanel, openGateLeaves, gardenBridge, chineseRoof } from './huanghuazhen-geometry.js';

const INFERRED = 'authored-proportional-reconstruction-hypothesis';
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const circle = (radius, sides = 96) => Array.from({ length: sides }, (_, i) => [Math.sin(i / sides * TAU) * radius, Math.cos(i / sides * TAU) * radius]);
const octagon = radius => Array.from({ length: 8 }, (_, i) => [Math.sin((i + .5) / 8 * TAU) * radius, Math.cos((i + .5) / 8 * TAU) * radius]);

function groundAndWater(b, root) {
  const g = namedGroup(root, 'huanghuazhen-ground-and-water', { body: 'paved-garden-island-with-open-water-channels', layoutEvidence: INFERRED });
  const outer = rect(-43, -71, 43, 63), moat = rect(-36, -63, 36, 42), island = rect(-33, -60, 33, 39), channel = rect(-41, 47, 41, 50.8);
  const paving = namedGroup(g, 'huanghuazhen-garden-paving', { body: 'solid-paving-cut-around-both-water-channels' });
  b.polygon(paving, outer, -.20, 0, b.m.paving, [moat, channel]);
  b.polygon(paving, island, -.20, 0, b.m.paving);
  const water = namedGroup(g, 'huanghuazhen-perimeter-moat', { body: 'continuous-water-around-maze-island', waterLevel: -.30 });
  b.polygon(water, moat, -.85, -.75, b.m.wetStone, [island]); b.polygon(water, moat, -.306, -.30, b.m.water, [island]);
  b.polygon(water, moat, -.82, .03, b.m.stone, [rect(-35.7, -62.7, 35.7, 41.7)]);
  b.polygon(water, rect(-33.25, -60.25, 33.25, 39.25), -.82, .03, b.m.stone, [island]);
  const inner = namedGroup(g, 'huanghuazhen-garden-gate-channel', { body: 'water-before-the-garden-side-of-the-north-elevation', waterLevel: -.30 });
  b.polygon(inner, channel, -.85, -.75, b.m.wetStone); b.polygon(inner, channel, -.306, -.30, b.m.water);
  for (const z of [46.94, 50.86]) b.box(inner, b.m.stone, [0, -.38, z], [82.1, .82, .15], .01);
  const joints = namedGroup(g, 'huanghuazhen-island-paving-joints', { body: 'narrow-stone-joints-under-the-maze-walls' });
  for (let x = -32; x < 33; x += 1.7) b.box(joints, b.m.joint, [x, .001, -10.5], [.007, .002, 98.6], 0);
  for (let z = -59; z < 39; z += 1.7) b.box(joints, b.m.joint, [0, .001, z], [65.6, .002, .007], 0);
  gardenBridge(b, g, 'huanghuazhen-south-maze-bridge', 0, 40.5, 3.5, 4.0);
  gardenBridge(b, g, 'huanghuazhen-north-maze-bridge', 0, -61.5, 3.5, 4.0);
  gardenBridge(b, g, 'huanghuazhen-west-maze-bridge', -34.5, .17, 3.5, 4.0, Math.PI / 2);
  gardenBridge(b, g, 'huanghuazhen-east-maze-bridge', 34.5, .17, 3.5, 4.0, Math.PI / 2);
  gardenBridge(b, g, 'huanghuazhen-garden-gate-bridge', 0, 48.9, 3.8, 4.5);
}

function lowBrickWalls(b, root, plan) {
  const maze = namedGroup(root, 'huanghuazhen-traced-brick-maze', { body: '44-traced-low-carved-blue-brick-wall-lines', wallHeight: 1.2, wallWidth: .34, wallHeightEvidence: 'yuanmingyuan-park-institutional-description', planEvidence: 'manual-trace-of-low-resolution-published-plan' });
  const cores = namedGroup(maze, 'huanghuazhen-maze-wall-cores', { body: 'actual-continuous-mitered-thick-wall-footprints' });
  const ornament = namedGroup(maze, 'huanghuazhen-maze-brick-relief', { body: 'connected-wan-character-brick-reliefs-on-both-sides' });
  const caps = namedGroup(maze, 'huanghuazhen-maze-copings-and-finials', { body: 'continuous-weathered-copings-and-small-turned-finials' });
  const seen = new Set();
  for (const path of plan.paths) {
    const core = namedGroup(cores, `huanghuazhen-wall-${path.id}`, { body: 'thick-low-brick-wall', evidence: path.evidence, footprint: stripPolygon(path.points, .17) });
    b.polygon(core, core.userData.footprint, -.06, 1.16, b.m.brick);
    b.polygon(caps, stripPolygon(path.points, .205), .03, .14, b.m.brickRelief);
    b.polygon(caps, stripPolygon(path.points, .21), 1.12, 1.20, b.m.brickRelief);
    b.polygon(caps, stripPolygon(path.points, .23), 1.20, 1.24, b.m.brick);
    for (let i = 0; i + 1 < path.points.length; i++) {
      const [ax, az] = path.points[i], [cx, cz] = path.points[i + 1], dx = cx - ax, dz = cz - az, length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length, angle = Math.atan2(-uz, ux);
      const repeats = Math.max(1, Math.floor((length - .15) / .84));
      for (const face of [-1, 1]) {
        const normal = [-uz * face, ux * face];
        for (let j = 0; j < repeats; j++) {
          const t = (j + .5) / repeats, p = [ax + dx * t + normal[0] * .173, .65, az + dz * t + normal[1] * .173];
          b.add(ornament, b.prototype('wan-brick-relief', carvedBrickMotif), b.m.brickRelief, p, undefined, [0, angle + (face < 0 ? Math.PI : 0), 0], false);
        }
        for (const y of [.245, 1.052]) b.box(ornament, b.m.brickRelief, [(ax + cx) / 2 + normal[0] * .178, y, (az + cz) / 2 + normal[1] * .178], [length, .036, .023], 0, [0, angle, 0]);
      }
    }
    for (const [i, point] of path.points.entries()) {
      if (i !== 0 && i !== path.points.length - 1 && i % 3 !== 0) continue;
      const key = point.map(v => v.toFixed(2)).join(','); if (seen.has(key)) continue; seen.add(key);
      b.box(caps, b.m.brickRelief, [point[0], 1.285, point[1]], [.29, .09, .29], .008);
      urn(b, caps, [point[0], 1.325, point[1]], .35, b.m.brickRelief);
    }
  }
  return maze;
}

function mazePortal(b, root, name, x, z, angle, plan) {
  const g = namedGroup(root, `huanghuazhen-${name}-maze-gate`, { body: 'open-arched-brick-maze-entrance', apertureWidth: 2.85, apertureHeight: 2.66, evidence: INFERRED }); g.position.set(x, 0, z); g.rotation.y = angle;
  b.add(g, piercedWall(4.15, 0, 2.9, .46, [{ x: 0, bottom: 0, width: 2.85, spring: 1.93, rise: .73 }]), b.m.stone);
  archMouldings(b, g, 0, .05, 2.87, 1.93, .74, .25, b.m.carving);
  archMouldings(b, g, 0, .05, 2.87, 1.93, .74, -.38, b.m.carving);
  for (const side of [-1, 1]) {
    b.box(g, b.m.stone, [side * 1.78, .15, 0], [.80, .30, .83], .014);
    b.box(g, b.m.carving, [side * 1.78, 2.96, 0], [.85, .20, .80], .014);
    reliefPanel(b, g, [side * 1.78, 1.48, .27], .49, 1.82, b.m.carving);
    urn(b, g, [side * 1.78, 3.06, 0], .79);
  }
  openGateLeaves(b, g, `${g.name}-leaves`, 2.84, .025, 1.92);
  // The traced four entry widths differ slightly. Bury short low returns in
  // the actual adjacent wall ends, rather than leaving daylight at each jamb.
  for (const path of plan.paths.slice(0, 4)) for (const [px, pz] of [path.points[0], path.points.at(-1)]) {
    if (Math.hypot(px - x, pz - z) > 4) continue;
    const u = (px - x) * Math.cos(angle) - (pz - z) * Math.sin(angle), span = Math.abs(u) - 1.94;
    if (span > 0) {
      b.box(g, b.m.brick, [Math.sign(u) * (1.94 + span / 2), .60, 0], [span + .10, 1.20, .52], .006);
      b.box(g, b.m.brickRelief, [Math.sign(u) * (1.94 + span / 2), 1.20, 0], [span + .14, .10, .59], .006);
    }
  }
  return g;
}

function centralPavilion(b, root) {
  const g = namedGroup(root, 'huanghuazhen-central-octagonal-pavilion', { body: 'eight-sided-western-pavilion-on-high-round-platform', planEvidence: 'institutional-description-and-historic-engraving', dimensionsEvidence: INFERRED, floorHeight: 1.08, cardinalPassages: 4 });
  const platform = namedGroup(g, 'huanghuazhen-central-round-platform', { body: 'solid-round-high-platform-and-four-supported-stairs' });
  b.polygon(platform, circle(5.17), -.08, 1.08, b.m.stone);
  b.polygon(platform, circle(5.27), .07, .19, b.m.carving);
  b.polygon(platform, circle(5.28), .96, 1.08, b.m.paving);
  for (let axis = 0; axis < 4; axis++) {
    const stair = namedGroup(platform, `huanghuazhen-pavilion-stair-${axis}`, { body: 'six-solid-treads-grounded-below-paving', riser: .18, width: 2.28 }); stair.rotation.y = axis * Math.PI / 2;
    for (let i = 0; i < 6; i++) b.box(stair, b.m.stone, [0, (i + 1) * .09 - .02, 5.08 + (5.5 - i) * .33], [2.28, (i + 1) * .18 + .04, .35], .009);
    for (const side of [-1, 1]) b.box(stair, b.m.carving, [side * 1.18, .55, 5.35], [.14, 1.10, .40], .008);
  }
  const rail = namedGroup(g, 'huanghuazhen-pavilion-circular-balustrade', { body: 'curving-railed-promenade-with-four-open-stair-landings' });
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const a0 = quadrant * Math.PI / 2 + .29, a1 = (quadrant + 1) * Math.PI / 2 - .29;
    const points = Array.from({ length: 24 }, (_, i) => { const a = a0 + (a1 - a0) * i / 23; return [Math.sin(a) * 4.95, 2.11, Math.cos(a) * 4.95]; });
    b.sweep(rail, points, .16, .19, b.m.carving, V(0, 1, 0), 40);
    for (let i = 0; i < 11; i++) { const a = a0 + (a1 - a0) * i / 10; baluster(b, rail, [Math.sin(a) * 4.95, 1.08, Math.cos(a) * 4.95], 1.0, .085); }
  }
  const frame = namedGroup(g, 'huanghuazhen-pavilion-octagonal-frame', { body: 'eight-stone-columns-and-hollow-ring-entablature' });
  for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * TAU; column(b, frame, `huanghuazhen-pavilion-column-${i + 1}`, Math.sin(a) * 3.50, Math.cos(a) * 3.50, 1.08, 4.62, .20); }
  for (const [radius, low, high, material] of [[3.80, 5.66, 5.84, b.m.stone], [3.87, 5.84, 5.94, b.m.carving], [3.81, 5.94, 6.15, b.m.stone], [4.00, 6.15, 6.29, b.m.carving]]) b.polygon(frame, octagon(radius), low, high, material, [octagon(2.96)]);
  const screens = namedGroup(g, 'huanghuazhen-pavilion-screens-and-open-passages', { body: 'four-arched-passages-and-four-openwork-diagonal-screens' });
  for (let face = 0; face < 8; face++) {
    const a = face / 8 * TAU, panel = namedGroup(screens, `huanghuazhen-pavilion-face-${face + 1}`, { body: face % 2 ? 'carved-sill-and-arched-lattice-screen' : 'unobstructed-cardinal-arched-passage' }); panel.position.set(Math.sin(a) * 3.2336, 0, Math.cos(a) * 3.2336); panel.rotation.y = a;
    const bottom = face % 2 ? 2.09 : 1.08;
    b.add(panel, piercedWall(2.52, 1.08, 5.68, .20, [{ x: 0, bottom, width: face % 2 ? 1.76 : 2.23, spring: 4.40, rise: .77 }]), b.m.stone);
    archMouldings(b, panel, 0, bottom + .02, face % 2 ? 1.77 : 2.24, 4.4, .78, .14);
    if (face % 2) { reliefPanel(b, panel, [0, 1.61, .13], 2.26, .85); latticePanel(b, panel, `${panel.name}-grille`, 1.74, bottom, 4.4, .76, .20, b.m.copper, 0, -.025); }
    for (let i = 0; i < 9; i++) b.box(panel, b.m.carving, [(i - 4) * .273, 6.105, .17], [.10, .135, .16], .006);
    if (face % 2) cartouche(b, panel, 0, 5.43, .17, .45, .34);
  }
  const roof = namedGroup(g, 'huanghuazhen-pavilion-complete-dome', { body: 'thick-vaulted-dome-with-meridian-seams-and-crown', materialEvidence: 'muted-copper-finish-is-authored' });
  b.add(roof, domeGeometry(4.0, 6.28, 2.34, 96, 36), b.m.patina);
  for (let seam = 0; seam < 40; seam++) {
    const a = seam / 40 * TAU, points = Array.from({ length: 32 }, (_, i) => { const t = i / 33, r = 4.014 * Math.cos(t * Math.PI / 2) * (1 + .035 * Math.sin(t * Math.PI)); return [Math.sin(a) * r, 6.30 + 2.34 * Math.sin(t * Math.PI / 2), Math.cos(a) * r]; });
    b.sweep(roof, points, .028, .045, b.m.copper, V(Math.sin(a), 0, Math.cos(a)), 40);
  }
  b.lathe(roof, [[.44, 8.48], [.49, 8.54], [.49, 8.67], [.35, 8.71], [.33, 8.94], [.44, 9.0], [.44, 9.08], [.25, 9.22]], [0, 0, 0], b.m.carving, 48);
  urn(b, roof, [0, 9.19, 0], .77, b.m.copper);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; urn(b, roof, [Math.sin(a) * 3.77, 6.30, Math.cos(a) * 3.77], .42, b.m.carving); }
  return g;
}

function gardenGate(b, root) {
  const gate = namedGroup(root, 'huanghuazhen-garden-gate-north-elevation', { body: 'separate-garden-entrance-seen-from-the-garden-north-side', facing: 'north', placementEvidence: 'relative-axis-and-inside-facing-relationship-only', dimensionsEvidence: INFERRED }); gate.position.set(0, 0, 57.0); gate.rotation.y = Math.PI;
  const fabric = namedGroup(gate, 'huanghuazhen-garden-gate-masonry', { body: 'deep-arched-gate-with-continuous-carved-enclosure' });
  b.add(fabric, piercedWall(8.3, 0, 6.71, .85, [{ x: 0, bottom: 0, width: 3.5, spring: 3.53, rise: 1.70 }]), b.m.stone);
  archMouldings(b, fabric, 0, .04, 3.53, 3.53, 1.73, .47);
  archMouldings(b, fabric, 0, .04, 3.53, 3.53, 1.73, -.64);
  for (const side of [-1, 1]) {
    for (const offset of [-.22, .22]) column(b, gate, `huanghuazhen-garden-gate-column-${side}-${offset}`, side * 2.86 + offset, .53, .16, 5.88, .21);
    b.box(gate, b.m.carving, [side * 3.10, 6.25, .18], [1.93, .24, 1.62], .014);
    urn(b, gate, [side * 3.06, 6.39, .18], .79);
    const wing = namedGroup(gate, `huanghuazhen-garden-wall-${side > 0 ? 'west' : 'east'}`, { body: 'thick-enclosure-wall-with-recessed-foliate-panels' });
    b.box(wing, b.m.plaster, [side * 22.9, 1.71, 0], [37.5, 3.42, .65], .014);
    for (const y of [.22, 3.30, 3.48]) b.box(wing, b.m.stone, [side * 22.9, y, .03], [37.6, y === 3.48 ? .18 : .13, y === 3.48 ? .82 : .75], .01);
    for (let panel = 0; panel < 8; panel++) {
      const x = side * (6.7 + panel * 4.48);
      const face = namedGroup(wing, `huanghuazhen-garden-wall-${side}-panel-${panel + 1}`, { body: 'scalloped-relief-field-with-central-floral-stonework' }); face.position.set(x, 1.80, .345);
      b.box(face, b.m.recess, [0, 0, 0], [3.85, 2.14, .035], .025);
      const border = [[-1.73, -.86, .04], [-1.48, -1.01, .04], [1.48, -1.01, .04], [1.73, -.86, .04], [1.83, -.65, .04], [1.83, .65, .04], [1.73, .86, .04], [1.48, 1.01, .04], [-1.48, 1.01, .04], [-1.73, .86, .04], [-1.83, .65, .04], [-1.83, -.65, .04], [-1.73, -.86, .04]];
      b.sweep(face, border, .062, .07, b.m.carving, V(0, 0, 1), 66);
      cartouche(b, face, 0, 0, .04, 1.55, 1.64);
      for (const branch of [-1, 1]) foliateScroll(b, face, [[branch * .52, -.08, .06], [branch * .97, -.28, .06], [branch * 1.36, -.12, .06], [branch * 1.29, .20, .06], [branch * 1.00, .15, .06]], .055, .065);
    }
  }
  const crown = namedGroup(gate, 'huanghuazhen-garden-gate-curved-crown', { body: 'scrolled-multi-level-pediment-and-oval-cartouche' });
  const outline = [[-4.46, 6.35], [-4.00, 6.79], [-3.54, 7.0], [-3.02, 6.58], [-2.54, 6.65], [-2.19, 7.34], [-1.91, 8.08], [-1.45, 8.10], [-.90, 8.26], [-.49, 8.63], [0, 8.72], [.49, 8.63], [.90, 8.26], [1.45, 8.10], [1.91, 8.08], [2.19, 7.34], [2.54, 6.65], [3.02, 6.58], [3.54, 7.0], [4.00, 6.79], [4.46, 6.35]];
  const curvedOutline = curvedFacadeContour(outline, 180);
  b.add(crown, facadeGeometry([...curvedOutline, [4.46, 6.20], [-4.46, 6.20]], -.43, .43), b.m.stone);
  b.sweep(crown, curvedOutline.map(([x, y]) => [x, y, .47]), .16, .23, b.m.carving, V(0, 0, 1), 180);
  for (const side of [-1, 1]) foliateScroll(b, crown, [[side * 2.15, 6.74, .48], [side * 1.83, 7.14, .49], [side * 1.24, 7.28, .49], [side * 1.02, 6.96, .49], [side * 1.42, 6.84, .49]], .065, .095);
  cartouche(b, crown, 0, 7.63, .49, 1.24, 1.30);
  const crest = [[-.85, 8.64], [-.65, 8.95], [-.32, 8.88], [-.42, 9.20], [0, 9.48], [.42, 9.20], [.32, 8.88], [.65, 8.95], [.85, 8.64]];
  const curvedCrest = curvedFacadeContour(crest, 72);
  b.add(crown, facadeGeometry(curvedCrest, -.30, .34), b.m.carving);
  b.sweep(crown, curvedCrest.map(([x, y]) => [x, y, .38]), .10, .10, b.m.carving, V(0, 0, 1), 72);
  urn(b, crown, [0, 9.42, 0], .49, b.m.copper);
  latticePanel(b, gate, 'huanghuazhen-garden-gate-arched-fanlight', 3.35, 3.55, 3.56, 1.54, .22, b.m.grille, 0, .12);
  openGateLeaves(b, gate, 'huanghuazhen-garden-gate-open-leaves', 3.43, .015, 3.44);
  return gate;
}

function northSmallHall(b, root) {
  const g = namedGroup(root, 'huanghuazhen-north-small-hall', { body: 'low-roofed-building-visible-behind-maze-in-engraving', function: 'unresolved', dimensionsEvidence: INFERRED }); g.position.z = -67;
  b.box(g, b.m.paving, [0, -.05, 0], [10.3, .14, 4.3], .008);
  for (const side of [-1, 1]) {
    b.add(g, piercedWall(9.8, 0, 3.33, .30, [{ x: 0, bottom: 0, width: 2.9, spring: 1.96, rise: .64 }]), b.m.plaster, [0, 0, side * 1.89]);
    b.box(g, b.m.stone, [side * 4.77, 1.65, 0], [.26, 3.30, 3.64], .008);
    const facade = namedGroup(g, `huanghuazhen-north-hall-elevation-${side}`, { body: 'restrained-arched-front-and-back-wall-dressings' }); facade.position.z = side * 2.05; facade.rotation.y = side < 0 ? Math.PI : 0;
    archMouldings(b, facade, 0, .05, 2.94, 1.96, .65, 0);
    for (const x of [-3.25, 3.25]) reliefPanel(b, facade, [x, 1.72, .03], 1.88, 2.17);
  }
  chineseRoof(b, g, 'huanghuazhen-north-small-hall-roof', 11.15, 5.4, 3.40, 1.2, 7.7);
}

export function createHuanghuazhenStudy() {
  const b = new GardenGateBuilder('huanghuazhen'), root = new THREE.Group(), plan = mazePlan(); root.name = 'yuanmingyuan-huanghuazhen-study';
  root.userData = { assetId: 'huanghuazhen', visualAcceptance: false, integrationAcceptance: false, allDimensionsProportional: true, floorConvention: '+Y up; +Z authored south; published plan has no readable north arrow' };
  try {
    groundAndWater(b, root); lowBrickWalls(b, root, plan);
    for (const [name, index, angle] of [['north', 0, Math.PI], ['west', 1, -Math.PI / 2], ['east', 2, Math.PI / 2], ['south', 3, 0]]) { const [x, z] = plan.entrances[index]; mazePortal(b, root, name, x, z, angle, plan); }
    centralPavilion(b, root); gardenGate(b, root); northSmallHall(b, root);
    return b.finish(root, {
      assetId: 'huanghuazhen', title: '黄花阵、中央亭与花园门 / Maze, central pavilion and garden gate',
      provisionalScale: { isProvisional: true, metresPerPlanPixel: plan.scale, wallWidth: .34, wallHeight: 1.2, rule: 'Plan scale is an authoring assumption, never derived by forcing the reported wall-length total.' },
      evidence: [
        { type: 'historic-engraving', source: '/images/yuanmingyuan/huanghuazhen-front.jpg', label: '花園正面，图五', constraints: 'low decorated masonry walls; raised octagonal pavilion; outer waterways and north small hall' },
        { type: 'historic-engraving', source: '/images/yuanmingyuan/huanghuazhen-garden-gate-north.jpg', label: '花園門北面，图四', constraints: 'gate north elevation is viewed from inside the garden; scrolled stone crown and carved enclosure' },
        { type: 'institutional-description', url: 'https://www.yuanmingyuanpark.cn/cgll/zyjd/ccy/201101/t20110105_231510.html', constraints: 'four entries; about 1.2 m high carved blue-brick walls; high round base and octagonal western pavilion' },
        { type: 'published-plan', url: 'https://visualizingcultures.mit.edu/garden_perfect_brightness_02/image/ymy4018_MazeCharchplan.jpg', constraints: '400 px drawing attributed to Tsinghua via Guo Daiheng ed. 2007; no readable metric scale or north arrow' },
      ],
      mazePlan: plan, navigation: { bodyRadius: .47, startPoints: plan.entrances, centralFloor: 1.08, stairRiser: .18, stairWidth: 2.28, gateState: 'open-authored-review-state', runtimeCollisionImplemented: false },
      uncertainty: [...plan.uncertainty, 'Garden entrance spacing, water-channel widths, pavilion dimensions, finishes, gate-leaf details, and the north small hall interior are proportional hypotheses.', 'The engraved gates are shown shut; leaves are held open for traversal review.', 'No planting or exact ornamental iconography is asserted. Native review and formal scene integration remain outstanding.'],
    });
  } catch (error) { b.dispose(); root.clear(); throw error; }
}
