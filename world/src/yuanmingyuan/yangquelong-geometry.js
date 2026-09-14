import * as THREE from 'three';
import { TAU, V, namedGroup } from './study-geometry.js';
import { facadeGeometry, curvedFacadeContour, cartouche, foliateScroll, urn, baluster } from './huanghuazhen-geometry.js';

export const AVIARY_DIMENSIONS = Object.freeze({ passageWidth: 2.90, floorHeight: .30, mainDepth: 7.5, westFacadeX: -3.75, eastFacadeX: 3.75, birdRoomEndZ: 21.1 });

export function parapetLowerHeight(x) {
  return 6.58 + .52 * Math.exp(-Math.pow(x / 2.05, 2)) + .33 * Math.pow(Math.abs(x) / 8.25, 8);
}

export function curvedParapetGeometry() {
  const points = Array.from({ length: 97 }, (_, i) => { const x = (i / 96 - .5) * 16.5; return [x, parapetLowerHeight(x) + .09]; });
  return facadeGeometry([...points, [8.25, 6.29], [-8.25, 6.29]], -.36, .36);
}

export function eastParapet(b, parent) {
  const g = namedGroup(parent, 'yangquelong-east-curving-balustrade', { body: 'undulating-stone-balustrade-with-open-baluster-spaces' });
  b.add(g, curvedParapetGeometry(), b.m.stone);
  for (const y of [.13, 1.10]) {
    const points = Array.from({ length: 81 }, (_, i) => { const x = (i / 80 - .5) * 16.5; return [x, parapetLowerHeight(x) + y, .05]; });
    b.sweep(g, points, y > 1 ? .19 : .13, .38, b.m.carving, V(0, 0, 1), 100);
  }
  for (let i = 0; i < 49; i++) { const x = (i / 48 - .5) * 16.15; baluster(b, g, [x, parapetLowerHeight(x) + .18, .05], .87, .080); }
  return g;
}

export function hangingBowl(b, parent, id, x, z, waterLevel = 1.31) {
  const g = namedGroup(parent, id, { body: 'thin-walled-carved-bowl-with-a-real-receiving-surface', waterLevel }); g.position.set(x, 0, z);
  b.lathe(g, [[.27, .30], [.30, .43], [.20, .56], [.32, .72], [.38, .89], [.58, .99], [.78, 1.14], [1.03, 1.37], [1.055, 1.44], [.96, 1.46], [.91, 1.34], [.72, 1.19], [.37, 1.10], [0, 1.10]], [0, 0, 0], b.m.carving, 64);
  const ring = r => Array.from({ length: 72 }, (_, i) => [r * Math.sin(i / 72 * TAU), r * Math.cos(i / 72 * TAU)]);
  b.polygon(g, ring(.853), waterLevel - .006, waterLevel, b.m.water);
  for (let flute = 0; flute < 20; flute++) {
    const a = flute / 20 * TAU;
    b.sweep(g, [[Math.sin(a) * .42, .96, Math.cos(a) * .42], [Math.sin(a) * .63, 1.05, Math.cos(a) * .63], [Math.sin(a) * .88, 1.24, Math.cos(a) * .88], [Math.sin(a) * 1.02, 1.38, Math.cos(a) * 1.02]], .022, .030, b.m.stone, V(Math.sin(a), 0, Math.cos(a)), 20);
  }
  return g;
}

export function westFountainOrnament(b, basin, id) {
  const g = namedGroup(basin, id, { body: 'unidentified-engraved-fountain-ornament-studied-as-foliate-scrollwork', iconography: 'unresolved-not-a-claimed-identification' });
  b.lathe(g, [[.29, -.29], [.34, -.19], [.27, .06], [.20, .17], [.24, .28], [.18, .39]], [0, 0, 0], b.m.stone, 40);
  b.loft(g, [[0, .31, 0, .17, .17], [-.14, .73, .05, .13, .10], [.10, 1.15, -.02, .11, .085], [0, 1.52, .05, .095, .08], [0, 1.96, .04, .06, .065]], b.m.carving, 20, 38);
  for (const side of [-1, 1]) {
    foliateScroll(b, g, [[side * .12, .40, .01], [side * .42, .60, .03], [side * .52, .95, .04], [side * .29, 1.12, .03], [side * .18, .94, .04]], .10, .13);
    foliateScroll(b, g, [[0, 1.16, .02], [side * .30, 1.34, .02], [side * .34, 1.66, .03], [side * .12, 1.77, .03]], .079, .10);
    b.leaf(g, [side * .10, 1.89, .02], [.40, .64, .56], [0, side * .40, -side * .53]);
    b.waterArc(g, [[side * .18, 1.91, .14], [side * .51, 2.12, .21], [side * .83, 1.32, .19], [side * .77, .17, .22]], .011, `${id}-${side}-jet`, basin.name);
  }
  return g;
}

export function stoneCanopy(b, parent, id, x, top, halfWidth, z) {
  const g = namedGroup(parent, id, { body: 'layered-cloud-form-stone-spandrel-with-physical-relief' });
  const outline = [[-halfWidth, top], [-halfWidth, top - .37], [-halfWidth * .80, top - .30], [-halfWidth * .69, top - .57], [-halfWidth * .52, top - .51], [-halfWidth * .39, top - .72], [0, top - .54], [halfWidth * .39, top - .72], [halfWidth * .52, top - .51], [halfWidth * .69, top - .57], [halfWidth * .80, top - .30], [halfWidth, top - .37], [halfWidth, top]];
  const curvedLower = curvedFacadeContour(outline.slice(1, -1), 80);
  b.add(g, facadeGeometry([outline[0], ...curvedLower, outline.at(-1)], z - .08, z + .08), b.m.carving, [x, 0, 0]);
  const points = curvedLower.map(([u, y]) => [x + u, y + .08, z + .10]);
  b.sweep(g, points, .065, .065, b.m.stone, V(0, 0, 1), 64);
  for (const side of [-1, 1]) cartouche(b, g, x + side * halfWidth * .60, top - .28, z + .13, halfWidth * .38, .38);
  return g;
}

export function westRidgeCrest(b, parent, x, bottom, width) {
  const g = namedGroup(parent, `${parent.name}-ridge-crest-${x}`, { body: 'symmetrical-engraved-scroll-ridge-ornament-with-finials' }); g.position.x = x;
  for (const side of [-1, 1]) {
    foliateScroll(b, g, [[side * .03, bottom, 0], [side * .28, bottom + .14, 0], [side * .33, bottom + .50, 0], [side * .59, bottom + .49, 0], [side * .56, bottom + .29, 0], [side * .39, bottom + .25, 0]], .09, .13);
    urn(b, g, [side * width / 2, bottom - .02, 0], .65);
  }
  return g;
}
