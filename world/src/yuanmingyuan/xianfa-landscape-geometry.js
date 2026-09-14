import * as THREE from 'three';
import { V, namedGroup } from './study-geometry.js';
import { thickPatch, facadeGeometry, curvedFacadeContour, piercedWall, archOutline, archMouldings, urn, foliateScroll, cartouche, reliefPanel } from './huanghuazhen-geometry.js';
import { HILL, spiralPoint, spiralOffset, SCREEN_LAYOUT } from './xianfa-landscape-layout.js';
import { xianfaPilasterPanel, xianfaShellCrest, xianfaEntablatureDetail, xianfaArchDetail, xianfaWestCrown, xianfaOpenSideLeaves, xianfaPavilionPanel, xianfaScroll, xianfaRosette } from './xianfashan-details.js';

export const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export const octagon = radius => Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return [radius * Math.cos(a), radius * Math.sin(a)]; });
const smooth = t => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x); };

export function landscapeMaterials(b) {
  const add = (name, category, options) => { const m = new THREE.MeshStandardMaterial(options); m.name = `${b.prefix}-${name}`; m.userData = { category, evidence: 'authored-material-response' }; b.materials.add(m); return m; };
  b.m.earth = add('compact-earth-and-moss', 'terrain', { color: 0xffffff, vertexColors: true, roughness: 1 });
  b.m.glazeGreen = add('green-glazed-low-parapet', 'glazed-tile', { color: 0x3e6650, roughness: .35 });
  b.m.glazeYellow = add('ochre-yellow-glazed-coping', 'glazed-tile', { color: 0xb0984e, roughness: .37 });
  return b;
}

export function hillHeightSampler(segments = 480) {
  const path = Array.from({ length: segments + 1 }, (_, i) => spiralPoint(i / segments));
  return (x, z) => {
    const radius = Math.hypot(x, z), base = HILL.height * smooth((24.4 - radius) / 20.0);
    let distanceSq = Infinity, roadY = 0;
    for (let i = 0; i < segments; i++) {
      const a = path[i], c = path[i + 1], dx = c[0] - a[0], dz = c[2] - a[2];
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz), 0, 1);
      const d = (x - a[0] - dx * t) ** 2 + (z - a[2] - dz * t) ** 2;
      if (d < distanceSq) { distanceSq = d; roadY = a[1] + (c[1] - a[1]) * t - HILL.pathThickness; }
    }
    const distance = Math.sqrt(distanceSq), bench = 1.12;
    const earth = base + .045 * Math.sin(x * .67 + z * .19) * Math.sin(z * .49) * smooth((radius - 4.3) / 2) * smooth((24.4 - radius) / 2);
    return THREE.MathUtils.lerp(roadY, earth, smooth((distance - bench) / .82));
  };
}

export function moundGeometry(columns = 180, rows = columns) {
  const height = hillHeightSampler(), span = 51.6;
  const geometry = thickPatch((u, v) => { const x = (u - .5) * span, z = (v - .5) * span; return [x, height(x, z), z]; }, columns, rows, .20);
  const p = geometry.attributes.position, uv = geometry.attributes.uv, count = (columns + 1) * (rows + 1);
  for (let i = 0; i < p.count; i++) {
    if (i >= count) p.setY(i, -.30);
    uv.setXY(i,p.getX(i),-p.getZ(i));
  }
  geometry.userData.surface='continuous-local-metre-UV-for-15m-CC0-meadow; no-periodic-vertex-colour';geometry.computeVertexNormals(); return geometry;
}

export function spiralDeckGeometry(rows = 960) {
  const width = HILL.clearPathWidth + 2 * HILL.parapetThickness;
  return thickPatch((u, t) => spiralOffset(t, (u - .5) * width), 8, rows, HILL.pathThickness);
}

export function spiralParapetGeometry(side, coping = false, rows = 960) {
  const center = side * (HILL.clearPathWidth + HILL.parapetThickness) / 2;
  return thickPatch((u, t) => spiralOffset(t, center + (u - .5) * (HILL.parapetThickness + (coping ? .045 : 0)), HILL.parapetHeight + (coping ? .07 : 0)), 2, rows, coping ? .085 : HILL.parapetHeight + .02);
}

export function gateWallGeometry(east = false) {
  const top = east ? curvedFacadeContour([[-6.6, 5.7], [-5.5, 5.7], [-4.5, 6.1], [-3.1, 5.70], [-1.3, 6.65], [0, 7.0], [1.3, 6.65], [3.1, 5.70], [4.5, 6.1], [5.5, 5.7], [6.6, 5.7]], 84) : [[-6.6, 6.10], [6.6, 6.10]];
  // All three doorways notch the bottom contour; no invisible slab blocks them.
  const arch = (x, width, spring, rise) => {
    const out = [[x - width / 2, 0], [x - width / 2, spring]];
    for (let i = 1; i <= 48; i++) { const a = Math.PI - i / 48 * Math.PI; out.push([x + width / 2 * Math.cos(a), spring + rise * Math.sin(a)]); }
    out.push([x + width / 2, 0]); return out;
  };
  const lower = [[-6.6, 0], ...arch(-4.48, 1.75, 3.82, .04), ...arch(0, 3.15, 3.6, 1.36), ...arch(4.48, 1.75, 3.82, .04), [6.6, 0]];
  return facadeGeometry([...lower, ...top.slice().reverse()], -.39, .39);
}

export function xianfaGate(b, parent, east = false) {
  const id = `xianfashan-${east ? 'east' : 'west'}-gate`, g = namedGroup(parent, id, { body: east ? 'three-lobed-east-screen-gateway-with-tiered-finials' : 'four-pier-three-bay-west-screen-gateway', evidence: `historic-engraving-plate-${east ? 19 : 17}`, facing: east ? 'east' : 'west' });
  g.position.x = east ? HILL.eastGateX : HILL.westGateX; g.rotation.y = east ? Math.PI / 2 : -Math.PI / 2;
  const masonry = namedGroup(g, `${id}-pierced-masonry`, { body: 'three-actual-doorways-in-thick-masonry' });
  b.add(masonry, gateWallGeometry(east), b.m.plaster);
  for (const x of [-6.04, -2.53, 2.53, 6.04]) {
    b.box(masonry, b.m.stone, [x, 2.83, .18], [.77, 5.66, .94], .016);
    for (const y of [.12, .36, 5.36, 5.59, 5.76]) b.box(masonry, b.m.carving, [x, y, .31], [.93, y < 1 ? .19 : .13, 1.08], .01);
    xianfaPilasterPanel(b, g, x, 2.76, .675);
  }
  archMouldings(b, g, 0, .01, 3.17, 3.6, 1.38, .46);
  xianfaArchDetail(b,g);xianfaEntablatureDetail(b,g,east);
  for (const x of [-4.48, 4.48]) {
    for (const side of [-1, 1]) b.box(g, b.m.carving, [x + side * .94, 1.94, .46], [.115, 3.88, .14], .008);
    for (const y of [3.90, 4.07]) b.box(g, b.m.carving, [x, y, .47], [2.08, .115, .17], .008);
    xianfaShellCrest(b,g,x,4.73,.49,1.55,.95);
    xianfaOpenSideLeaves(b,g,x);
  }
  if (east) {
    const line = curvedFacadeContour([[-6.65, 5.76], [-5.5, 5.76], [-4.5, 6.16], [-3.1, 5.76], [-1.3, 6.71], [0, 7.06], [1.3, 6.71], [3.1, 5.76], [4.5, 6.16], [5.5, 5.76], [6.65, 5.76]], 100).map(([x, y]) => [x, y, .40]);
    for (const shift of [0, .19]) b.sweep(g, line.map(([x, y, z]) => [x, y + shift, z]), .11, .19, b.m.carving, V(0, 0, 1), 100);
    for (const side of [-1, 1]) {
      const crown = namedGroup(g, `${id}-tiered-finial-${side}`, { body: 'three-stage-vase-finial-seen-in-eastern-engraving' }); crown.position.set(side * 5.86, 5.86, .04);
      b.lathe(crown, [[.36, 0], [.39, .16], [.22, .25], [.26, .52], [.37, .77], [.30, .99], [.18, 1.11], [.31, 1.17], [.31, 1.30], [.12, 1.43], [.16, 1.73], [.10, 1.93], [0, 2.10]], [0, 0, 0], b.m.carving, 48);
      for (const s of [-1, 1]) xianfaScroll(b, crown, [[0, .12, .18], [s * .44, .38, .18], [s * .42, .66, .18], [s * .24, .73, .18]], .065, .08);
    }
    for(const x of [-3.1,0,3.1]){const yy=x===0?7.23:6.01;xianfaShellCrest(b,g,x,yy,.30,x===0?1.55:1.02,.61);xianfaRosette(b,g,x,yy+.35,.32,.09,7);}
    for(const side of [-1,1])xianfaScroll(b,g,[[side*.15,7.24,.20],[side*.52,7.35,.21],[side*.67,7.61,.21],[side*.42,7.82,.22],[side*.24,7.62,.23]],.075,.10);
  } else {
    for (const [y, width, h] of [[5.92, 13.6, .18], [6.11, 13.87, .16], [6.29, 13.62, .16]]) b.box(g, b.m.carving, [0, y, .04], [width, h, 1.02], .014);
    xianfaWestCrown(b,g);
  }
  // Rear dressings have independent depth, without pretending the unseen rear
  // ornament is documented by the front-facing engraving.
  const rear = namedGroup(g, `${id}-rear-dressings`, { body: 'plain-authored-rear-jambs-and-cornice', evidence: 'unseen-side-completion-hypothesis' }); rear.rotation.y = Math.PI;
  archMouldings(b, rear, 0, .01, 3.17, 3.6, 1.38, .40);
  for (const x of [-6.06, -2.52, 2.52, 6.06]) b.box(rear, b.m.stone, [x, 2.79, .43], [.73, 5.58, .16], .012);
  return g;
}

export function pavilionRoofSampler(face, radius, innerRadius, eaves, rise) {
  const a0 = Math.PI / 8 + face * Math.PI / 4, a1 = a0 + Math.PI / 4;
  return (u, v) => {
    const r = innerRadius + (radius - innerRadius) * v, x = r * ((1 - u) * Math.cos(a0) + u * Math.cos(a1)), z = r * ((1 - u) * Math.sin(a0) + u * Math.sin(a1));
    return [x, eaves + rise * Math.pow(1 - v, 1.68) + .105 * Math.pow(v, 9), z];
  };
}

export function octagonalTiledRoof(b, parent, id, radius, innerRadius, eaves, rise) {
  const g = namedGroup(parent, id, { body: 'eight-closed-curving-roof-faces-with-laid-tile-pans', evidence: 'engraved-silhouette; authored-hidden-roof-structure-and-glaze' });
  for (let face = 0; face < 8; face++) {
    const sample = pavilionRoofSampler(face, radius, innerRadius, eaves, rise);
    b.add(g, thickPatch(sample, 18, 24, .15), b.m.timber);
    const columns = Math.ceil(radius * .765 / .19), rows = Math.ceil(Math.hypot(radius - innerRadius, rise) / .27);
    for (let row = 0; row < rows; row++) for (let c = 0; c < columns; c++) {
      const pan = (u, v) => { const p = sample((c + u) / columns, Math.min(1, (row + v * 1.10) / rows)); p[1] += .024 + .022 * Math.cos((u - .5) * Math.PI) ** 2; return p; };
      b.add(g, thickPatch(pan, 4, 4, .025), (row + c + face) % 9 ? b.m.tile : b.m.tileEdge);
    }
    b.sweep(g, Array.from({ length: 25 }, (_, i) => { const p = sample(0, i / 24); p[1] += .09; return p; }), .11, .14, b.m.tileEdge, V(0, 1, 0), 32);
    b.sweep(g, Array.from({ length: 13 }, (_, i) => { const p = sample(i / 12, 1); p[1] -= .035; return p; }), .14, .17, b.m.tileEdge, V(0, 1, 0), 18);
  }
  b.polygon(g, octagon(innerRadius * 1.02), eaves + rise - .14, eaves + rise + .065, b.m.tileEdge);
  return g;
}

export function pavilionDoorPediment(b,parent,floor=HILL.summitFloor){
  const g=namedGroup(parent,`${parent.name}-door-pediment`,{body:'shallow-carved-pediment-below-the-unchanged-roof-soffit',evidence:'plate-18-pediment; depth-and-roof-junction-authored'});
  b.add(g,facadeGeometry([[-1.23,floor+2.65],[1.23,floor+2.65],[0,floor+3.02]],-.04,.29),b.m.plaster);
  b.sweep(g,[[-1.27,floor+2.66,.30],[0,floor+3.04,.30],[1.27,floor+2.66,.30]],.075,.095,b.m.carving,V(0,0,1),48);
  xianfaShellCrest(b,g,0,floor+2.84,.31,.79,.32);return g;
}

export function summitPavilion(b, parent) {
  const g = namedGroup(parent, 'xianfashan-summit-pavilion', { body: 'octagonal-double-roof-pavilion-with-four-open-arched-portals', evidence: 'plate-18-and-institutional-description' }), floor = HILL.summitFloor;
  const platform = namedGroup(g, 'xianfashan-summit-platform', { body: 'solid-octagonal-platform-flush-with-top-of-ramp', floor });
  b.polygon(platform, octagon(4.35), 7.73, floor, b.m.paving);
  b.polygon(platform, octagon(4.36), 7.74, 7.87, b.m.carving);
  const walls = namedGroup(g, 'xianfashan-pavilion-four-open-portals', { body: 'four-true-arched-openings-and-four-closed-diagonal-bays' });
  const radius = 3.48, apothem = radius * Math.cos(Math.PI / 8), width = radius * 2 * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, face = namedGroup(walls, `xianfashan-pavilion-face-${i}`, { body: i % 2 ? 'diagonal-carved-wall-bay' : 'cardinal-arched-doorway', cardinalOpening: i % 2 === 0 }); face.position.set(Math.sin(angle) * apothem, 0, Math.cos(angle) * apothem); face.rotation.y = angle;
    const openings = i % 2 ? [] : [{ x: 0, bottom: floor, width: 1.74, spring: floor + 1.82, rise: .75 }];
    b.add(face, piercedWall(width + .075, floor, floor + 2.95, .35, openings), b.m.plaster);
    for (const side of [-1, 1]) { b.box(face, b.m.stone, [side * (width / 2 - .18), floor + 1.40, .17], [.22, 2.8, .28], .010); b.box(face, b.m.carving, [side * (width / 2 - .18), floor + 2.80, .19], [.31, .18, .35], .010); }
    if (i % 2) xianfaPavilionPanel(b, face, [0, floor + 1.42, .20], 1.61, 2.05);
    else {
      archMouldings(b, face, 0, floor + .01, 1.74, floor + 1.82, .75, .23);
      xianfaArchDetail(b,face,0,floor+.01,1.74,floor+1.82,.75,.23);
      pavilionDoorPediment(b,face,floor);
    }
    if(i%2)for (const y of [floor + 2.78, floor + 2.96]) b.box(face, b.m.carving, [0, y, .06], [width + .14, .12, .48], .008);
    b.box(face,b.m.timber,[0,floor+3.08,-.11],[width+.06,.31,.38],.008);
  }
  const upper = namedGroup(g, 'xianfashan-pavilion-upper-lantern', { body: 'octagonal-intermediate-drum-below-upper-roof' });
  b.polygon(upper, octagon(1.26), 12.55, 13.67, b.m.plaster);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.box(upper, b.m.recess, [Math.sin(a) * 1.17, 13.10, Math.cos(a) * 1.17], [.50, .49, .035], .01, [0, a, 0]);
    b.box(upper, b.m.carving, [Math.sin(a) * 1.185, 12.83, Math.cos(a) * 1.185], [.61, .065, .065], .006, [0, a, 0]);
  }
  octagonalTiledRoof(b, g, 'xianfashan-pavilion-lower-tiled-roof', 4.16, 1.19, 11.25, 1.62);
  octagonalTiledRoof(b, g, 'xianfashan-pavilion-upper-tiled-roof', 1.92, .12, 13.58, 1.81);
  b.lathe(g, [[.19, 15.28], [.24, 15.42], [.15, 15.56], [.18, 15.70], [.07, 15.90], [0, 16.15]], [0, 0, 0], b.m.copper, 40);
  return g;
}

// A masonry wing has real thickness. Its scenic architecture is deliberately
// a paint layer; a lateral/back view must expose the shallow stage construction.
export function scenicWingContour(width, height, row = 0) {
  const w = width / 2;
  if (row === 0) return [[-w, 0], ...archOutline(0, 0, width * .48, height * .58, height * .24).map(([x, y]) => [x, y]), [w, 0], [w, height * .91], [w * .42, height * .91], [w * .42, height], [-w * .42, height], [-w * .42, height * .91], [-w, height * .91]];
  if (row % 3 === 1) return [[-w, 0], [w, 0], [w, height * .80], [w * .42, height * .80], [w * .42, height * .91], [-w * .10, height], [-w * .64, height * .91], [-w * .64, height * .74], [-w, height * .74]];
  if (row % 3 === 2) return [[-w, 0], [w, 0], [w, height * .77], [w * .38, height * .77], [0, height], [-w * .38, height * .77], [-w, height * .77]];
  return [[-w, 0], [w, 0], [w, height * .91], [w * .3, height * .91], [w * .3, height], [-w * .36, height], [-w * .36, height * .81], [-w, height * .81]];
}

export function paintedWingGeometry(width, height, row = 0, z = .221) {
  const geometry = facadeGeometry(scenicWingContour(width - .05, height - .05, row), z, z + .005), p = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / width + .5, p.getY(i) / height);
  return geometry;
}

export function scenicPaintingTexture(variant = 0, mountain = false, size = 384) {
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1), edge = Math.min(u, 1 - u), grain = 2 * Math.sin(x * 1.37 + y * .91) * Math.cos(y * 2.21 - x * .43);
    let color;
    if (mountain) {
      const ridge = .39 + .16 * Math.sin(u * 6.0) ** 2 + .17 * Math.sin(u * 12.3 + 1) ** 2;
      const far = .56 + .09 * Math.sin(u * 15.9) + .06 * Math.sin(u * 31.4);
      color = v > Math.max(ridge, far) ? [163, 180, 184] : v > ridge ? [130, 148, 150] : [93, 116, 118];
      if (v < .24) color = [164, 161, 142];
      if (v > .185 && v < .205 || v > .10 && v < .16 && Math.abs((u * 18) % 1 - .5) < .24) color = [105, 114, 110];
    } else {
      const facade = [variant % 2 ? 189 : 200, variant % 3 ? 179 : 170, variant % 2 ? 149 : 145];
      color = facade;
      const cornice = [.13, .39, .68, .91].some(level => Math.abs(v - level) < .012);
      if (cornice || edge < .045 || Math.abs(u - .20) < .016 || Math.abs(u - .80) < .016) color = [220, 211, 184];
      const col = Math.floor(u * 5), center = (col + .5) / 5, windowTop = .83 - (col % 2) * .027;
      for (const floor of [.24, .52, windowTop]) {
        const dx = (u - center) / .054, dy = (v - floor) / .12;
        if (Math.abs(dx) < 1.13 && dy > -.90 && dy < 1.13 && (dy < .58 || dx * dx + ((dy - .58) / .55) ** 2 < 1.23)) color = [218, 204, 171];
        if (Math.abs(dx) < .87 && dy > -.70 && dy < 1 && (dy < .45 || dx * dx + ((dy - .45) / .55) ** 2 < .87 ** 2)) color = [57 + variant * 3, 71 + variant * 2, 71];
        if (Math.abs(dx) < .04 && dy > -.66 && dy < .85 || Math.abs(dy - .10) < .025 && Math.abs(dx) < .87) color = [136, 131, 104];
      }
      const jointY = ((v * 34) % 1); if (jointY < .027 && !cornice) color = color.map(n => n - 12);
      if (v > .92) color = [120, 111, 91];
    }
    const at = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) bytes[at + c] = Math.max(0, Math.min(255, color[c] + grain)); bytes[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size); texture.name = `xianfa-authored-scenery-${mountain ? 'mountains' : variant}`; texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  texture.userData = { evidence: 'new-authored-illustrative-painting; not a surviving Qing painting or generated reconstruction photograph' }; return texture;
}

export function waterLanding(b, parent, id, x, direction, waterLevel = SCREEN_LAYOUT.water.level) {
  const g = namedGroup(parent, id, { body: 'semicircular-stone-stair-landing-reaching-the-water', bottomTread: waterLevel, direction }); g.position.x = x; g.rotation.y = direction < 0 ? Math.PI : 0;
  // Local +X extends toward the water; each lower tread is a larger semicircle.
  for (let i = 0; i < 4; i++) {
    const radius = 3.15 + i * .39, top = -.10 * i - (i === 3 ? .006 : 0);
    const polygon = Array.from({ length: 65 }, (_, j) => { const a = -Math.PI / 2 + j / 64 * Math.PI; return [radius * Math.cos(a), radius * Math.sin(a)]; });
    b.polygon(g, polygon, -1.10, top, i === 3 ? b.m.wetStone : b.m.paving);
  }
  return g;
}

export const BRIDGE = Object.freeze({ sluiceWallWidth: 28, deckWidth: 32.3, screenWidth: 31.4, depth: 4.7, deckY: 1.25, waterY: -.72, pierX: [-10.5, -5.25, 0, 5.25, 10.5], clearDoor: 2.25, dimensionsEvidence: 'modern proportions from Bennett plate 5.40, not measured historic metres' });

export function fiveSluiceWallGeometry() {
  return piercedWall(28.0, -1.65, BRIDGE.deckY - .18, BRIDGE.depth, BRIDGE.pierX.map(x => ({ x, bottom: -1.65, width: 3.70, spring: -.74, rise: 1.24 })));
}

export function bridgeScreenTop() {
  return curvedFacadeContour([[-15.7, 4.95], [-11.7, 4.95], [-9.4, 5.21], [-7.5, 5.70], [-5.65, 5.36], [-3.85, 6.43], [-2.23, 6.64], [-1.37, 7.61], [0, 8.06], [1.37, 7.61], [2.23, 6.64], [3.85, 6.43], [5.65, 5.36], [7.5, 5.70], [9.4, 5.21], [11.7, 4.95], [15.7, 4.95]], 128);
}

export function bridgeScreenGeometry() {
  const top = bridgeScreenTop();
  const lower = [[-15.7, BRIDGE.deckY], [-BRIDGE.clearDoor / 2, BRIDGE.deckY], [-BRIDGE.clearDoor / 2, 3.91]];
  for (let i = 1; i <= 48; i++) { const a = Math.PI - i / 48 * Math.PI; lower.push([BRIDGE.clearDoor / 2 * Math.cos(a), 3.91 + 1.04 * Math.sin(a)]); }
  lower.push([BRIDGE.clearDoor / 2, BRIDGE.deckY], [15.7, BRIDGE.deckY]);
  return facadeGeometry([...lower, ...top.reverse()], -.37, .37);
}
