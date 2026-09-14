import * as THREE from 'three';

// Original paintwork drawings. The dated texts and reproduced Yangshi Lei
// comparisons constrain motif families and colours; these pixels are not
// copied from the museum PDF or presented as surviving Jiuzhou decoration.
function drawing(width, height, background) {
  const data = new Uint8Array(width * height * 4);
  const pixel = (x, y, colour, opacity = 1) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - opacity) + colour[c] * opacity);
    data[i + 3] = 255;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixel(x, y, background);
  const line = (a, b, colour, thickness = 2) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.2)), r = thickness / 2;
    for (let i = 0; i <= steps; i++) {
      const x = a[0] + (b[0] - a[0]) * i / steps, y = a[1] + (b[1] - a[1]) * i / steps;
      for (let py = Math.floor(y - r - 1); py <= Math.ceil(y + r + 1); py++) for (let px = Math.floor(x - r - 1); px <= Math.ceil(x + r + 1); px++) {
        const alpha = Math.max(0, Math.min(1, r + .65 - Math.hypot(px - x, py - y)));
        if (alpha) pixel(px, py, colour, alpha);
      }
    }
  };
  const path = (points, colour, thickness = 2, closed = false) => {
    for (let i = 1; i < points.length; i++) line(points[i - 1], points[i], colour, thickness);
    if (closed) line(points.at(-1), points[0], colour, thickness);
  };
  const curve = (a, b, c, d, colour, thickness = 2) => path(Array.from({ length: 33 }, (_, i) => {
    const t = i / 32, s = 1 - t;
    return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0], s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
  }), colour, thickness);
  const polygon = (points, colour) => {
    for (let y = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])))); y <= Math.min(height - 1, Math.ceil(Math.max(...points.map(p => p[1])))); y++) {
      const crossings = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) crossings.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) for (let x = Math.ceil(crossings[i]); x <= Math.floor(crossings[i + 1]); x++) pixel(x, y, colour);
    }
  };
  const ellipse = (x, y, rx, ry, colour, thickness = 2) => path(Array.from({ length: 73 }, (_, i) => [x + rx * Math.cos(i / 72 * 2 * Math.PI), y + ry * Math.sin(i / 72 * 2 * Math.PI)]), colour, thickness);
  return { width, height, data, pixel, line, path, curve, polygon, ellipse };
}

const blue = [28, 69, 88], green = [40, 98, 77], red = [124, 47, 35], gold = [210, 171, 84], pale = [224, 216, 162], ink = [35, 39, 31];

function cloud(d, cx, cy, size, handedness = 1) {
  const p = (x, y) => [cx + x * size * handedness, cy + y * size];
  d.curve(p(-1, .45), p(-.8, -.5), p(-.1, -.55), p(0, -.05), gold, 1.5);
  d.curve(p(0, -.05), p(.7, -.9), p(1.2, .05), p(.5, .25), gold, 1.5);
  d.curve(p(.5, .25), p(.8, .75), p(-.2, .85), p(-1, .45), pale, 1);
}

function dragon(d, cx, cy, scale, mirror = 1) {
  const p = (x, y) => [cx + x * scale * mirror, cy + y * scale];
  const body = Array.from({ length: 69 }, (_, i) => { const t = i / 68; return p(-74 + 134 * t, 20 * Math.sin(t * Math.PI * 2.25) - 8 * Math.sin(t * Math.PI)); });
  d.path(body, ink, 17 * scale); d.path(body, gold, 14 * scale); d.path(body, [167, 126, 54], 9 * scale);
  for (let i = 3; i < body.length - 5; i += 2) {
    const [x, y] = body[i], tangent = [body[i + 1][0] - body[i - 1][0], body[i + 1][1] - body[i - 1][1]], length = Math.hypot(...tangent), ux = tangent[0] / length, uy = tangent[1] / length;
    for (const row of [-1, 0, 1]) {
      const at = (a, b) => [x + a * ux * scale - b * uy * scale, y + a * uy * scale + b * ux * scale];
      d.curve(at(-1.9, row * 3.3 - 1.9), at(1.3, row * 3.3 - 1.7), at(2.8, row * 3.3 + 1.3), at(-1.7, row * 3.3 + 1.9), pale, .85);
    }
  }
  const head = [p(50, 7), p(56, -11), p(70, -17), p(82, -10), p(88, -1), p(74, 1), p(78, 10), p(65, 15), p(53, 11)];
  d.polygon(head, gold); d.path(head, ink, 1.2, true);
  d.path([p(68, -2), p(82, -5), p(88, -1), p(79, 4), p(72, 3)], red, 2.2);
  d.path([p(75, 4), p(79, 9), p(82, 4)], pale, 1.5);
  d.ellipse(...p(71, -8), 2.8 * scale, 2.6 * scale, pale, 1.5); d.ellipse(...p(72, -8), 1.1 * scale, 1.3 * scale, ink, 1.5);
  d.path([p(62, -14), p(56, -29), p(64, -33), p(69, -23)], gold, 2);
  d.path([p(73, -16), p(77, -31), p(85, -36), p(80, -21)], gold, 2);
  for (const sign of [-1, 1]) d.curve(p(84, sign * 2), p(111, sign * 24), p(116, sign * 3), p(103, sign * 6), pale, 1.4);
  for (const [x, y, direction] of [[-31, -16, -1], [-12, 20, 1], [20, -17, -1], [40, 13, 1]]) {
    d.path([p(x, y), p(x + 12, y + 9 * direction), p(x + 8, y + 23 * direction), p(x + 18, y + 29 * direction)], ink, 6 * scale);
    d.path([p(x, y), p(x + 12, y + 9 * direction), p(x + 8, y + 23 * direction), p(x + 18, y + 29 * direction)], gold, 4 * scale);
    for (let finger = -1; finger <= 2; finger++) d.path([p(x + 14, y + 26 * direction), p(x + 19 + finger * 4, y + (34 - finger) * direction), p(x + 23 + finger * 4, y + (30 - finger) * direction)], pale, 1.2);
  }
  for (let i = 0; i < 7; i++) d.path([p(-72 + i * 15, -4 + 20 * Math.sin(i * .73)), p(-68 + i * 15, -14 + 20 * Math.sin(i * .73)), p(-62 + i * 15, -5 + 20 * Math.sin(i * .73))], gold, 1.4);
}

function foliageScroll(d, cx, cy, width, height, mirror = 1) {
  const p = (x, y) => [cx + x * width * mirror, cy + y * height];
  d.curve(p(-.48, .40), p(-.36, -.41), p(.34, -.45), p(.30, .10), gold, 1.5);
  d.curve(p(.30, .10), p(.28, .53), p(-.04, .31), p(.09, .10), pale, 1);
  for (const [x, y, sign] of [[-.30, -.11, -1], [-.10, -.27, 1], [.17, -.19, -1], [-.40, .18, 1]]) {
    const leaf = [p(x, y), p(x + .11, y - .24 * sign), p(x + .28, y - .15 * sign), p(x + .18, y + .05 * sign)];
    d.polygon(leaf, gold); d.path(leaf, pale, .85, true);
    d.curve(leaf[0], p(x + .14, y - .05 * sign), p(x + .22, y - .09 * sign), leaf[2], green, .9);
  }
}

function phoenix(d, cx, cy, scale, mirror = 1) {
  const p = (x, y) => [cx + x * scale * mirror, cy + y * scale];
  d.curve(p(8, 8), p(-9, -12), p(2, -27), p(20, -26), gold, 5);
  d.path([p(19, -27), p(28, -23), p(20, -20)], pale, 1.8);
  for (let plume = 0; plume < 4; plume++) d.curve(p(15, -28), p(9 + plume * 5, -45), p(19 + plume * 5, -50), p(25 + plume * 5, -43), gold, 1.4);
  for (const side of [-1, 1]) for (let feather = 0; feather < 10; feather++) {
    const tip = p(-12 - feather * 4, side * (12 + feather * 4));
    d.curve(p(4, 7), p(-32, side * 10), [tip[0] + mirror * 14 * scale, tip[1] + side * 8 * scale], tip, gold, 1.7);
    d.curve(tip, [tip[0] + mirror * 4 * scale, tip[1] - side * 8 * scale], p(-15, side * 5), p(4, 7), pale, .9);
  }
  for (let tail = 0; tail < 7; tail++) d.curve(p(-8, 9), p(-45, 20 + tail * 4), p(-63 - tail * 5, -15), p(-87 - tail * 3, 8 + tail * 6), gold, 1.7);
  for (const side of [-1, 1]) d.path([p(6, 10), p(12 + side * 4, 31), p(25 + side * 8, 30)], gold, 2);
}

function finish(d, name, kind) {
  // Drawing coordinates run down the image; DataTexture v=0 is its bottom.
  // Reverse rows once, so vases, bird heads and branches remain upright.
  const pixels = new Uint8Array(d.data.length), stride = d.width * 4;
  for (let y = 0; y < d.height; y++) pixels.set(d.data.subarray(y * stride, (y + 1) * stride), (d.height - y - 1) * stride);
  const texture = new THREE.DataTexture(pixels, d.width, d.height); texture.name = name; texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = 8; texture.needsUpdate = true;
  texture.userData = { provenance: 'original-authored-procedural-paintwork', historicImage: false, motif: kind, evidence: 'He Yan middle pp40–41; exact design and colours inferred' };
  return texture;
}

export function createJiuzhouHexiTexture() {
  const d = drawing(2048, 256, blue);
  for (const y of [9, 30, 226, 247]) d.line([0, y], [2047, y], gold, y < 20 || y > 236 ? 4 : 2);
  for (const y of [16, 38, 218, 240]) d.line([0, y], [2047, y], pale, 1.2);
  const field = [[544, 128], [598, 49], [1449, 49], [1503, 128], [1449, 207], [598, 207]];
  d.polygon(field, green); d.path(field, gold, 4, true);
  d.path([[559, 128], [607, 58], [1440, 58], [1488, 128], [1440, 198], [607, 198]], pale, 1.5, true);
  for (const center of [308, 1740]) {
    d.ellipse(center, 128, 92, 83, gold, 3); d.ellipse(center, 128, 83, 74, pale, 1.5);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cloud(d, center + Math.cos(a) * 68, 128 + Math.sin(a) * 61, 11, i % 2 ? 1 : -1); }
    dragon(d, center - 10, 130, .80, center < 1000 ? 1 : -1);
  }
  for (const side of [-1, 1]) {
    const px = x => side < 0 ? x : 2048 - x;
    for (const offset of [0, 12, 24]) d.path([[px(439 + offset), 43], [px(473 + offset), 43], [px(518 + offset), 128], [px(473 + offset), 213], [px(439 + offset), 213]], offset === 12 ? pale : gold, 2.3);
    for (const x of [35, 71, 107, 143, 179]) {
      d.line([px(x), 42], [px(x), 214], x === 35 || x === 179 ? gold : pale, 1.5);
      for (const y of [66, 111, 156, 201]) cloud(d, px(x + 7), y, 10, side);
    }
  }
  for (let x = 660; x < 1440; x += 63) for (const y of [78, 168]) foliageScroll(d, x, y, 51, 44, (x / 63 | 0) % 2 ? -1 : 1);
  dragon(d, 813, 125, 1.53, 1); dragon(d, 1234, 125, 1.53, -1);
  for (const x of [480, 1568]) phoenix(d, x, 129, .57, x < 1000 ? 1 : -1);
  d.ellipse(1023, 128, 20, 19, gold, 3); d.ellipse(1023, 128, 12, 12, red, 4);
  for (const y of [68, 185]) for (let x = 658; x < 1430; x += 46) cloud(d, x, y, 11, x % 92 ? 1 : -1);
  for (const center of [308, 1740]) for (const side of [-1, 1]) foliageScroll(d, center + side * 104, 128, 42, 116, side);
  for (const y of [21, 236]) for (let x = 4; x < 2048; x += 36) d.path([[x, y], [x + 29, y], [x + 29, y + (y < 100 ? 10 : -10)], [x + 8, y + (y < 100 ? 10 : -10)]], gold, 1.4);
  return finish(d, 'jiuzhou-authored-dragon-phoenix-hexi', 'dragon-and-phoenix-hexi-front-beams');
}

export function createJiuzhouBoguTexture() {
  const d = drawing(1024, 256, green);
  for (const y of [11, 24, 232, 245]) d.line([0, y], [1023, y], y === 24 || y === 232 ? pale : gold, 2);
  for (const [index, center] of [150, 390, 634, 874].entries()) {
    const frame = [[center - 103, 128], [center - 84, 43], [center + 84, 43], [center + 103, 128], [center + 84, 213], [center - 84, 213]];
    d.polygon(frame, blue); d.path(frame, gold, 2.7, true);
    for (const side of [-1, 1]) foliageScroll(d, center + side * 70, 134, 45, 109, side);
    const shoulders = index % 2 ? 20 : 34, neck = index % 2 ? 19 : 11;
    const vase = [[center - 28, 181], [center - shoulders, 156], [center - shoulders + 3, 125], [center - neck - 1, 112], [center - neck, 89], [center + neck, 89], [center + neck + 1, 112], [center + shoulders - 3, 125], [center + shoulders, 156], [center + 28, 181]];
    d.polygon(vase, red); d.path(vase, gold, 2.5, true);
    for (const y of [93, 132, 143, 173, 178]) d.line([center - (y < 100 ? neck : shoulders - 4), y], [center + (y < 100 ? neck : shoulders - 4), y], pale, 1.2);
    if (index === 1 || index === 3) for (const side of [-1, 1]) d.ellipse(center + side * 23, 127, 8, 13, gold, 2);
    for (let i = 0; i < 7; i++) cloud(d, center - 20 + i * 6.5, 152, 5.5, i % 2 ? 1 : -1);
    for (const side of [-1, 1]) {
      d.curve([center, 94], [center + side * 9, 69], [center + side * 35, 71], [center + side * 45, 52], gold, 1.6);
      cloud(d, center + side * 49, 174, 16, side);
      for (const shift of [0, 16, 30]) d.path([[center + side * (20 + shift), 191], [center + side * (61 + shift), 186], [center + side * (63 + shift), 194], [center + side * (23 + shift), 199]], pale, 1.2, true);
    }
    for (const x of [-29, -10, 15, 39]) {
      const y = 63 + Math.abs(x) * .2;
      d.line([center, 97], [center + x, y], gold, 1.2);
      for (let petal = 0; petal < 5; petal++) d.ellipse(center + x + Math.cos(petal * 1.2566) * 4, y + Math.sin(petal * 1.2566) * 4, 4.4, 3.6, pale, 1.4);
      d.ellipse(center + x, y, 2, 2, red, 1.5);
    }
    // Distinct scholarly objects around the vessel: stacked books, a scroll,
    // and a handled bronze. Their exact placement is an authored composition.
    for (let book = 0; book < 3; book++) {
      const x = center - 60 + book * 7, y = 177 + book * 7;
      d.polygon([[x, y], [x + 41, y - 3], [x + 43, y + 5], [x + 2, y + 8]], book % 2 ? red : green);
      d.path([[x, y], [x + 41, y - 3], [x + 43, y + 5], [x + 2, y + 8]], pale, 1, true);
      d.line([x + 4, y + 3], [x + 39, y], gold, 1);
    }
    d.ellipse(center + 55, 190, 5, 8, pale, 1.4); d.line([center + 54, 182], [center + 85, 173], pale, 2); d.line([center + 56, 198], [center + 88, 189], gold, 2);
  }
  return finish(d, 'jiuzhou-authored-green-bogu-panels', 'green-bamboo-and-bogu-rear-beams');
}

export function createJiuzhouBambooTexture() {
  const d = drawing(256, 1024, green);
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
    const grain = Math.sin(x * .17 + .9 * Math.sin(y * .008)) + .35 * Math.sin(x * .51 + y * .0018);
    const streak = Math.max(0, Math.sin(x * .063 + y * .003)) ** 13;
    d.pixel(x, y, [48 + grain * 2 + streak * 13, 103 + grain * 3 + streak * 8, 74 + grain * 2 - streak * 3]);
  }
  for (const cy of [135, 477, 792]) {
    d.curve([0, cy], [71, cy - 5], [193, cy + 8], [255, cy + 1], [67, 74, 42], 4);
    d.curve([0, cy + 7], [71, cy + 2], [193, cy + 15], [255, cy + 8], [117, 139, 82], 1.2);
  }
  for (let i = 0; i < 39; i++) {
    const x = (i * 73.31) % 256, y = (i * 237.53 + 21) % 1024;
    const rx = 2 + i % 6, ry = 6 + i % 17;
    const outline = Array.from({ length: 23 }, (_, j) => { const a = j / 22 * Math.PI * 2, rr = 1 + .17 * Math.sin(a * 3 + i) + .08 * Math.cos(a * 7); return [x + Math.cos(a) * rx * rr, y + Math.sin(a) * ry * rr]; });
    d.polygon(outline, [67 + i % 7, 71 + i % 5, 43]); d.path(outline, [88, 91, 51], .7, true);
  }
  return finish(d, 'jiuzhou-authored-spotted-bamboo-joinery', 'painted-spotted-bamboo-on-wood-not-living-canes');
}

export function createJiuzhouWoodTexture() {
  const d = drawing(384, 768, [95, 62, 39]);
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
    const bend = 6 * Math.sin(y * .011) + 3 * Math.sin(y * .028 + x * .015), along = x + bend;
    const growth = Math.sin(along * .125) + .42 * Math.sin(along * .49) + .19 * Math.sin(along * 1.30);
    const vessel = Math.max(0, Math.sin(along * .74 + Math.sin(y * .006))) ** 19;
    const pores = Math.sin(x * 21.77 + y * 13.13) * Math.sin(x * 3.71 - y * 6.33);
    d.pixel(x, y, [106 + growth * 8 - vessel * 17 + pores * 2, 72 + growth * 6 - vessel * 12 + pores * 1.5, 46 + growth * 4 - vessel * 8 + pores]);
  }
  return finish(d, 'jiuzhou-authored-finished-wood-grain', 'finished-longitudinal-wood-not-weathered-ruin');
}
