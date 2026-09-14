import * as THREE from 'three';

const clamp = (x, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, x));
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); };

// Authored pixels, not a claim of recovered Haiyue paintwork. The original
// repeating frieze combines recessed fields, narrow meanders and paired leaves.
export function haiyuePaintworkPixels(width = 1024, height = 192) {
  const data = new Uint8Array(width * height * 4);
  const put = (x, y, rgb, alpha = 1) => { if (x < 0 || y < 0 || x >= width || y >= height) return; const p = (Math.floor(y) * width + Math.floor(x)) * 4; for (let c = 0; c < 3; c++) data[p + c] = Math.round(data[p + c] * (1 - alpha) + rgb[c] * alpha); };
  const line = (points, color, thickness = 1.2) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.ceil(length * 2);
      for (let k = 0; k <= count; k++) { const t = count ? k / count : 0, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        for (let dy = -Math.ceil(thickness); dy <= Math.ceil(thickness); dy++) for (let dx = -Math.ceil(thickness); dx <= Math.ceil(thickness); dx++) put(x + dx, y + dy, color, clamp(thickness - Math.hypot(dx, dy) + .5, 0, 1) * .65);
      }
    }
  };
  const gold = [194, 162, 94], pale = [161, 177, 148], dark = [26, 57, 65];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height, noise = (hash(x, y) - .5) * 8, edge = Math.min(v, 1 - v), field = edge < .09 ? [34, 69, 70] : [42, 90, 83], p = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) data[p + c] = clamp(field[c] + noise + 2.4 * Math.sin(u * 39 + v * 7)); data[p + 3] = 255;
  }
  for (const v of [.025, .072, .13, .87, .928, .975]) line([[0, v * height], [width - 1, v * height]], v === .13 || v === .87 ? pale : gold, Math.max(.7, height / 200));
  for (const center of [.14, .5, .86]) {
    const cx = width * center, cy = height / 2, rx = width * (center === .5 ? .093 : .047), ry = height * .30;
    const shape = Array.from({ length: 97 }, (_, i) => { const a = i * Math.PI / 48, r = 1 + .065 * Math.cos(4 * a); return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]; });
    line(shape, gold, Math.max(.8, height / 160));
    if (center === .5) {
      for (const side of [-1, 1]) for (let j = 0; j < 4; j++) {
        const angle = side * (.40 + j * .25), leaf = Array.from({ length: 33 }, (_, i) => { const t = i * Math.PI / 16, r = (1 - Math.cos(t)) * .5; return [cx + Math.sin(angle) * rx * r + Math.sin(t) * rx * .11, cy - Math.cos(angle) * ry * r * .95 + ry * .29]; }); line(leaf, pale, .9);
      }
    } else for (let j = 0; j < 8; j++) {
      const angle = j * Math.PI / 4, flower = Array.from({ length: 33 }, (_, i) => { const a = i * Math.PI / 16, r = .47 + .26 * Math.cos(a); return [cx + Math.cos(angle) * rx * r + Math.sin(angle) * rx * .20 * Math.sin(a), cy + Math.sin(angle) * ry * r - Math.cos(angle) * ry * .20 * Math.sin(a)]; }); line(flower, pale, .8);
    }
  }
  for (const start of [.23, .63]) {
    const points = Array.from({ length: 161 }, (_, i) => { const t = i / 160, y = .5 + .17 * Math.sin(t * Math.PI * 3); return [(start + t * .14) * width, y * height]; }); line(points, gold, .9);
    for (let i = 16; i < points.length - 10; i += 21) { const [x, y] = points[i], side = i % 2 ? 1 : -1; line([[x, y], [x + width * .012, y + side * height * .075], [x + width * .025, y + side * height * .05]], pale, .8); }
  }
  for (const start of [.025, .93]) for (let j = 0; j < 4; j++) { const x = (start + .011 * j) * width; line([[x, .19 * height], [x, .77 * height], [x + .008 * width, .77 * height], [x + .008 * width, .24 * height]], j % 2 ? gold : dark, .8); }
  return { width, height, data };
}

function surfacePixels(kind, size = 256) {
  const heights = new Float32Array(size * size), normal = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, grain = kind === 'wood' ? Math.sin(u * Math.PI * 2 * 31 + .9 * Math.sin(v * Math.PI * 2 * 3)) * .15 + Math.sin(u * Math.PI * 2 * 73 + .3 * Math.sin(v * Math.PI * 2 * 7)) * .06 : Math.sin(u * Math.PI * 2 * 9 + Math.sin(v * Math.PI * 2 * 5)) * .018;
    heights[y * size + x] = grain + (hash(x, y) - .5) * (kind === 'wood' ? .014 : .028);
  }
  const h = (x, y) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = (y * size + x) * 4, nx = -(h(x + 1, y) - h(x - 1, y)), ny = -(h(x, y + 1) - h(x, y - 1)), n = new THREE.Vector3(nx, ny, 1).normalize();
    normal.set([Math.round(127.5 + n.x * 127.5), Math.round(127.5 + n.y * 127.5), Math.round(127.5 + n.z * 127.5), 255], p);
    const r = kind === 'wood' ? 198 + 13 * h(x, y) + 5 * hash(y, x) : 222 + 15 * hash(x, y); rough.set([r, r, r, 255], p);
  }
  return { normal: { width: size, height: size, data: normal }, rough: { width: size, height: size, data: rough } };
}

export function createHaiyueMaterials() {
  const textures = new Set(), materials = new Set(), m = {};
  const texture = (pixels, name, color = false) => { const t = new THREE.DataTexture(pixels.data, pixels.width, pixels.height, THREE.RGBAFormat); t.name = `haiyue-original-${name}`; t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; textures.add(t); return t; };
  const wood = surfacePixels('wood'), stone = surfacePixels('stone'), maps = { woodNormal: texture(wood.normal, 'timber-fibres'), woodRough: texture(wood.rough, 'timber-roughness'), stoneNormal: texture(stone.normal, 'fine-stone-grain'), stoneRough: texture(stone.rough, 'fine-stone-roughness'), paint: texture(haiyuePaintworkPixels(), 'comparative-painted-frieze', true) };
  const add = (key, options) => { const material = new THREE.MeshStandardMaterial(options); material.name = `haiyue-${key}`; m[key] = material; materials.add(material); };
  const timber = { normalMap: maps.woodNormal, normalScale: new THREE.Vector2(.34, .34), roughnessMap: maps.woodRough, roughness: .85 };
  add('red', { ...timber, color: 0x753a30 }); add('darkWood', { ...timber, color: 0x322b22 });
  add('green', { ...timber, color: 0x2d645b }); add('blue', { ...timber, color: 0x304f63 });
  add('paintwork', { ...timber, color: 0xffffff, map: maps.paint });
  add('pale', { color: 0xa4b7a0, roughness: .74 }); add('gold', { color: 0xb79a51, metalness: .40, roughness: .50 });
  add('stone', { color: 0xcecbbd, roughness: 1, roughnessMap: maps.stoneRough, normalMap: maps.stoneNormal, normalScale: new THREE.Vector2(.55, .55) });
  add('foundation', { color: 0x8b8b79, roughness: 1, roughnessMap: maps.stoneRough, normalMap: maps.stoneNormal, normalScale: new THREE.Vector2(.9, .9) });
  add('paving', { color: 0xb1afa1, roughness: .98, roughnessMap: maps.stoneRough, normalMap: maps.stoneNormal, normalScale: new THREE.Vector2(.48, .48) });
  add('yellowTile', { color: 0xb79334, roughness: .37, metalness: .04 });
  add('greenTile', { color: 0x285e50, roughness: .33, metalness: .03 });
  add('redWall', { color: 0x77372f, roughness: .95, normalMap: maps.stoneNormal, normalScale: new THREE.Vector2(.28, .28) });
  add('plaster', { color: 0xb9b8a7, roughness: .97 });
  return { m, materials, textures };
}
