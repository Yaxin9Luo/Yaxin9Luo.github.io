import * as THREE from 'three';

// Original, editable paintwork. The palette and composition are informed by
// surviving/repaired Zhengjuesi beams; these are not scans or exact reproductions
// of either a Qing painted panel or the present restoration.
export function zhengjuesiPaintworkPixels({ width = 1024, height = 192 } = {}) {
  const data = new Uint8Array(width * height * 4), c = { blue: [30, 73, 103], green: [44, 105, 92], gold: [204, 174, 92], pale: [172, 200, 183], red: [130, 48, 36], black: [26, 42, 41] };
  const dot = (x, y, radius, color) => {
    const r = Math.max(.7, radius);
    for (let j = Math.max(0, Math.floor(y - r - 1)); j <= Math.min(height - 1, Math.ceil(y + r + 1)); j++) for (let i = Math.max(0, Math.floor(x - r - 1)); i <= Math.min(width - 1, Math.ceil(x + r + 1)); i++) {
      const a = Math.max(0, Math.min(1, r + .5 - Math.hypot(i + .5 - x, j + .5 - y))), o = (j * width + i) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = Math.round(data[o + k] * (1 - a) + color[k] * a);
    }
  };
  const line = (points, thickness, color) => {
    for (let p = 1; p < points.length; p++) { const a = points[p - 1], b = points[p], count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5); for (let i = 0; i <= count; i++) { const t = i / count; dot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, thickness / 2, color); } }
  };
  const path = (fn, count = 80) => Array.from({ length: count + 1 }, (_, i) => fn(i / count));
  const sx = width / 1024, sy = height / 192, stroke = (points, w, color) => line(points.map(([x, y]) => [x * sx, y * sy]), w * sy, color);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const yy = y / sy, xx = x / sx, inset = yy > 12 && yy < 180, base = inset ? c.green : c.blue, o = (y * width + x) * 4;
    const grain = ((Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663)) >>> 0) % 9 - 4;
    for (let k = 0; k < 3; k++) data[o + k] = base[k] + grain * .35 + Math.sin(xx * .052 + yy * .019) * 1.4; data[o + 3] = 255;
  }
  for (const yy of [6, 16, 176, 186]) stroke([[6, yy], [1018, yy]], yy % 10 === 6 ? 2 : 1, c.gold);
  const frame = [[224, 33], [800, 33], [836, 96], [800, 159], [224, 159], [188, 96], [224, 33]];
  for (const factor of [1, .93]) stroke(frame.map(([x, y]) => [512 + (x - 512) * factor, 96 + (y - 96) * factor]), factor === 1 ? 4.3 : 1.6, factor === 1 ? c.blue : c.gold);
  // Xuanzi end compartments use concentric rotating leaf sprays, with an
  // asymmetric interior scroll. Gold is confined to linework and small dots.
  for (const cx of [104, 920]) {
    stroke(path(t => { const a = t * Math.PI * 2; return [cx + Math.cos(a) * 69, 96 + Math.sin(a) * 70]; }), 3, c.blue);
    for (let leaf = 0; leaf < 10; leaf++) {
      const a = leaf * Math.PI / 5;
      const points = path(t => { const r = 16 + 44 * Math.sin(Math.PI * t), b = a + t * .75; return [cx + Math.cos(b) * r, 96 + Math.sin(b) * r]; }, 28);
      stroke(points, 7, leaf % 2 ? c.blue : c.pale); stroke(points, 1.5, c.gold);
    }
    stroke(path(t => { const a = t * Math.PI * 2; return [cx + Math.cos(a) * 12, 96 + Math.sin(a) * 12]; }, 32), 3, c.gold);
    dot(cx * sx, 96 * sy, 5 * sy, c.red);
  }
  // Two coiling dragon/cloud silhouettes meet a central pearl. Their small
  // antlers, jaws, fins and scales remain authored motifs, not document tracing.
  for (const side of [-1, 1]) {
    const pp = (x, y) => [512 + side * x, y];
    const body = path(t => pp(50 + t * 215, 96 + Math.sin(t * Math.PI * 2.7) * (26 + 9 * t)), 100);
    stroke(body, 10, c.blue); stroke(body, 5.2, c.gold); stroke(body.map(([x, y]) => [x, y + 3]), 1.2, c.pale);
    for (let i = 5; i < 92; i += 5) { const p = body[i], q = body[Math.min(i + 2, 100)]; stroke([[p[0] - 2 * side, p[1] - 4], [q[0], q[1] + 2], [p[0] + 4 * side, p[1] + 6]], 1.1, c.green); }
    stroke([pp(57, 84), pp(43, 77), pp(30, 81), pp(22, 90), pp(33, 95), pp(48, 95), pp(59, 103)], 3.2, c.gold);
    stroke([pp(43, 78), pp(51, 61), pp(44, 52), pp(46, 44)], 2, c.gold);
    stroke([pp(51, 62), pp(65, 53), pp(63, 46)], 1.4, c.gold);
    stroke([pp(39, 84), pp(29, 85)], 3, c.pale); dot((512 + side * 35) * sx, 85 * sy, 1.7 * sy, c.black);
    for (const n of [0, 1, 2]) stroke(path(t => pp(104 + n * 57 + 22 * Math.cos(t * Math.PI * 1.8), 65 + (n % 2) * 63 + 8 * Math.sin(t * Math.PI * 1.8)), 35), 1.6, c.pale);
    for (const xx of [123, 218]) { stroke([pp(xx, 97), pp(xx - 12, 119), pp(xx - 1, 132), pp(xx + 8, 128)], 2, c.gold); for (let f = 0; f < 3; f++) stroke([pp(xx + 1, 130), pp(xx + 10 + f * 4, 130 - f * 4)], 1.5, c.gold); }
  }
  stroke(path(t => [512 + Math.cos(t * Math.PI * 2) * 11, 91 + Math.sin(t * Math.PI * 2) * 12], 40), 3, c.gold);
  for (let i = 0; i < 44; i++) { const xx = 16 + i * 23; stroke([[xx, 9], [xx + 6, 13], [xx + 12, 9]], 1, c.pale); }
  return { data, width, height };
}

function mineralPixels(kind, size = 256) {
  const data = new Uint8Array(size * size * 4);
  const h = (x, y) => {
    const low = Math.sin(x * .017 + Math.sin(y * .039)) + Math.sin(y * .021 - Math.sin(x * .029));
    const fine = Math.sin(x * 1.47 + y * 2.39) * Math.sin(y * 1.89 - x * .82);
    return kind === 'wood' ? .18 * Math.sin(x * .44 + Math.sin(y * .032) * .7) + .14 * Math.sin(x * 1.7 + Math.sin(y * .009)) + .035 * fine : low * .13 + fine * .045;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = h(x, y), o = (y * size + x) * 4; const scalar = kind === 'wood' ? 226 : 237; data[o] = scalar + v * 16; data[o + 1] = scalar + v * 15; data[o + 2] = scalar + v * 13; data[o + 3] = 255; }
  const normal = new Uint8Array(data.length), roughness = new Uint8Array(data.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), n = new THREE.Vector3(-dx * .27, -dy * .27, 1).normalize(), o = (y * size + x) * 4;
    normal[o] = (n.x + 1) * 127.5; normal[o + 1] = (n.y + 1) * 127.5; normal[o + 2] = (n.z + 1) * 127.5; normal[o + 3] = 255;
    const rough = (kind === 'wood' ? 191 : 226) + h(x, y) * 12; roughness[o] = roughness[o + 1] = roughness[o + 2] = rough; roughness[o + 3] = 255;
  }
  return { color: { data, width: size, height: size }, normal: { data: normal, width: size, height: size }, roughness: { data: roughness, width: size, height: size } };
}

export function createZhengjuesiMaterials() {
  const materials = new Set(), textures = new Set();
  const texture = (name, pixels, srgb = false) => {
    const t = new THREE.DataTexture(pixels.data, pixels.width, pixels.height); t.name = `zhengjuesi-${name}`; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; textures.add(t); return t;
  };
  const mineral = mineralPixels('stone'), wood = mineralPixels('wood');
  const mineralMaps = { map: texture('mineral-grain', mineral.color, true), normalMap: texture('mineral-normal', mineral.normal), roughnessMap: texture('mineral-roughness', mineral.roughness), normalScale: new THREE.Vector2(.38, .38) };
  const timberMaps = { map: texture('timber-grain', wood.color, true), normalMap: texture('timber-normal', wood.normal), roughnessMap: texture('timber-roughness', wood.roughness), normalScale: new THREE.Vector2(.38, .38) };
  const make = (name, options, physical = false) => { const m = physical ? new THREE.MeshPhysicalMaterial(options) : new THREE.MeshStandardMaterial(options); m.name = `zhengjuesi-${name}`; m.userData = { evidence: 'original-material-interpretation', sourceIds: ['contractor-2012', 'park-wenshu-2016'] }; materials.add(m); return m; };
  const m = {
    stone: make('warm-white-dressed-stone', { ...mineralMaps, color: 0xdfdaca, roughness: .91 }),
    foundation: make('bluegrey-masonry', { ...mineralMaps, color: 0x92968c, roughness: .97 }),
    paving: make('worn-grey-paving', { ...mineralMaps, color: 0xafa99a, roughness: .94 }),
    redWall: make('red-ochre-plaster', { ...mineralMaps, color: 0xa7503e, roughness: .98, normalScale: new THREE.Vector2(.12, .12) }),
    plaster: make('limewashed-monk-wall', { ...mineralMaps, color: 0xd2caba, roughness: .97 }),
    red: make('red-lacquered-timber', { ...timberMaps, color: 0x8d3025, roughness: .76 }),
    darkWood: make('interior-dark-wood', { ...timberMaps, color: 0x492b22, roughness: .86 }),
    green: make('mineral-green-paint', { ...timberMaps, color: 0x417a66, roughness: .78 }),
    blue: make('mineral-blue-paint', { ...timberMaps, color: 0x365e77, roughness: .79 }),
    gold: make('aged-gold-lines', { color: 0xcbb06d, metalness: .64, roughness: .59 }),
    pale: make('pale-paint-outline', { color: 0xb9cbbb, roughness: .80 }),
    paintwork: make('original-hexixuanzi-beam-painting', { map: texture('paintwork', zhengjuesiPaintworkPixels(), true), color: 0xffffff, roughness: .79 }),
    greyTile: make('grey-roof-clay', { ...mineralMaps, color: 0x666e68, roughness: .84 }),
    greenTile: make('green-glazed-roof-edging', { color: 0x416f63, roughness: .42, clearcoat: .23, clearcoatRoughness: .27 }, true),
    brass: make('cast-bell-metal', { color: 0x89704c, metalness: .83, roughness: .66 }),
    drum: make('aged-drum-hide', { ...mineralMaps, color: 0xcfb882, roughness: .92 }),
  };
  return { m, materials, textures };
}
