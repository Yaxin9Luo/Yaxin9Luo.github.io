import * as THREE from 'three';

// Authored ornament, not a cropped historic painting or an image-generation
// output. Colour hierarchy follows the inspected painting; the individual
// scrolls and floral outlines remain an explicit reconstruction hypothesis.
export function createFuhaiCaihuaTexture() {
  const width = 1024, height = 160, data = new Uint8Array(width * height * 4);
  const blue = [28, 66, 83], green = [39, 101, 83], gold = [214, 174, 87], pale = [219, 220, 178], red = [117, 48, 36];
  const set = (x, y, colour, opacity = 1) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - opacity) + colour[c] * opacity);
    data[i + 3] = 255;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, blue);
  const line = (a, b, colour = gold, thickness = 2) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5)), radius = thickness / 2;
    for (let j = 0; j <= steps; j++) {
      const x = a[0] + (b[0] - a[0]) * j / steps, y = a[1] + (b[1] - a[1]) * j / steps;
      for (let py = Math.floor(y - radius - 1); py <= Math.ceil(y + radius + 1); py++) for (let px = Math.floor(x - radius - 1); px <= Math.ceil(x + radius + 1); px++) {
        const cover = Math.max(0, Math.min(1, radius + .65 - Math.hypot(px - x, py - y))); if (cover) set(px, py, colour, cover);
      }
    }
  };
  const path = (points, colour = gold, thickness = 2, close = false) => {
    for (let i = 1; i < points.length; i++) line(points[i - 1], points[i], colour, thickness);
    if (close) line(points.at(-1), points[0], colour, thickness);
  };
  const curve = (a, b, c, d, colour = gold, thickness = 2) => {
    const points = Array.from({ length: 25 }, (_, i) => { const t = i / 24, s = 1 - t; return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0], s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]]; });
    path(points, colour, thickness);
  };
  const polygon = (points, colour) => {
    for (let y = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])))); y <= Math.min(height - 1, Math.ceil(Math.max(...points.map(p => p[1])))); y++) {
      const crossings = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) crossings.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2) for (let x = Math.ceil(crossings[i]); x <= Math.floor(crossings[i + 1]); x++) set(x, y, colour);
    }
  };
  for (const y of [4, 28, 132, 156]) line([0, y], [width - 1, y], gold, y === 4 || y === 156 ? 3 : 2);
  for (const y of [8, 32, 128, 152]) line([0, y], [width - 1, y], pale, 1);
  for (let x = 2; x < width; x += 28) for (const sy of [1, -1]) {
    const y = sy > 0 ? 13 : 147;
    path([[x, y], [x + 22, y], [x + 22, y + sy * 10], [x + 7, y + sy * 10], [x + 7, y + sy * 4], [x + 15, y + sy * 4]], gold, 1.5);
  }
  const field = [[258, 80], [289, 41], [735, 41], [766, 80], [735, 119], [289, 119]];
  polygon(field, green); path(field, gold, 3.1, true);
  path([[267, 80], [293, 47], [731, 47], [757, 80], [731, 113], [293, 113]], pale, 1.1, true);
  const scroll = (cx, cy, radius, handedness = 1) => {
    const points = Array.from({ length: 45 }, (_, i) => { const t = i / 44, angle = -Math.PI * .3 + t * Math.PI * 2.8, r = radius * (1 - t * .82); return [cx + handedness * Math.cos(angle) * r, cy + Math.sin(angle) * r]; });
    path(points, gold, 2.2);
    for (const sy of [-1, 1]) {
      curve([cx - handedness * radius * .5, cy], [cx - handedness * radius * 1.1, cy + sy * radius * .9], [cx + handedness * radius * .2, cy + sy * radius * 1.3], [cx + handedness * radius * .18, cy + sy * radius * .48], gold, 1.8);
      curve([cx - handedness * radius * .5, cy], [cx - handedness * radius * .16, cy + sy * radius * .35], [cx - handedness * radius * .28, cy + sy * radius * .7], [cx + handedness * radius * .18, cy + sy * radius * .48], pale, .9);
    }
  };
  for (const [cx, handedness] of [[61, 1], [136, -1], [211, 1], [813, -1], [888, 1], [963, -1]]) scroll(cx, 80, 27, handedness);
  for (const cx of [331, 421, 511, 601, 691]) {
    for (let petal = 0; petal < 8; petal++) {
      const angle = petal * Math.PI / 4, c = Math.cos(angle), s = Math.sin(angle), at = (x, y) => [cx + c * x - s * y, 80 + s * x + c * y];
      curve(at(2, 0), at(17, -11), at(29, -5), at(26, 0), gold, 1.4);
      curve(at(26, 0), at(29, 5), at(17, 11), at(2, 0), pale, 1);
    }
    path([[cx, 72], [cx + 8, 80], [cx, 88], [cx - 8, 80]], gold, 2, true);
    polygon([[cx, 77], [cx + 3, 80], [cx, 83], [cx - 3, 80]], red);
  }
  for (let x = 354; x < 716; x += 90) for (const sy of [-1, 1]) curve([x, 80], [x + 8, 80 + sy * 24], [x + 22, 80 + sy * 24], [x + 29, 80], gold, 1.5);
  const texture = new THREE.DataTexture(data, width, height); texture.name = 'fuhai-authored-caihua-scroll-and-fangxin';
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = 4;
  texture.userData = { provenance: 'original-procedural-ornament', historicImage: false, motifDimensions: 'inferred', generatedReferenceIsHistoricalEvidence: false };
  texture.needsUpdate = true; return texture;
}
