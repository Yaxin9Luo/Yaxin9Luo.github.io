import * as THREE from 'three';

// Authored Taihu-rock volume. This is a closed implicit surface with two true
// curved tunnels, not a thin silhouette, a faceted sphere, or a surveyed stone.
export function scholarRockGeometry(seed = 0) {
  const phase = seed * .37;
  const field = (x, y, z) => {
    const qx = x + .16 * Math.sin(y * 1.18 + z + phase), qz = z + .13 * Math.sin(y * .90 + phase);
    const bulb = (cx, cy, cz, sx, sy, sz) => 1 - ((qx - cx) / sx) ** 2 - ((y - cy) / sy) ** 2 - ((qz - cz) / sz) ** 2;
    const union = (a, c, k) => { const h = Math.max(k - Math.abs(a - c), 0) / k; return Math.max(a, c) + h * h * k * .25; };
    let body = union(bulb(-.10, .58, 0, 1.73, 1.05, 1.35), bulb(.34, 2.22, .10, 1.62, 1.82, 1.05), .42);
    body = union(body, bulb(-.32, 4.12, -.08, 1.46, 1.36, .96), .42);
    body += .090 * Math.sin(x * 4.6 + y * 2.7 + phase) * Math.sin(z * 3.7 - y * 1.9) + .031 * Math.cos(x * 10.4 - z * 7.1 + y * 8.2);
    const lowerTunnel = 1 - ((x + .37 - .09 * Math.sin(z * 2.1)) / .62) ** 2 - ((y - 1.37 - .12 * Math.sin(z * 1.8)) / .58) ** 2;
    const upperTunnel = 1 - ((x - .19 + .10 * Math.sin(z * 1.7)) / .50) ** 2 - ((y - 3.48 - .09 * Math.cos(z * 2.0)) / .58) ** 2;
    return Math.min(body, -lowerTunnel, -upperTunnel, y + .08);
  };
  const cells = [38, 54, 30], min = [-2.30, -.23, -1.70], max = [2.30, 5.68, 1.70];
  const strideZ = cells[2] + 1, strideY = (cells[1] + 1) * strideZ;
  const values = new Float64Array((cells[0] + 1) * strideY), coords = [];
  const idx = (x, y, z) => x * strideY + y * strideZ + z;
  for (let x = 0; x <= cells[0]; x++) for (let y = 0; y <= cells[1]; y++) for (let z = 0; z <= cells[2]; z++) {
    const p = [x, y, z].map((value, axis) => min[axis] + value / cells[axis] * (max[axis] - min[axis]));
    const id = idx(x, y, z); coords[id] = p; values[id] = field(...p);
  }
  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
  const position = [], normal = [], indices = [], edgeVertices = new Map();
  const vertex = (a, c) => {
    const key = a < c ? `${a}:${c}` : `${c}:${a}`; if (edgeVertices.has(key)) return edgeVertices.get(key);
    const t = values[a] / (values[a] - values[c]), p = coords[a].map((value, axis) => value + t * (coords[c][axis] - value));
    const [x, y, z] = p, e = .0002;
    const n = new THREE.Vector3(field(x - e, y, z) - field(x + e, y, z), field(x, y - e, z) - field(x, y + e, z), field(x, y, z - e) - field(x, y, z + e)).normalize();
    const id = position.length / 3; position.push(...p); normal.push(n.x, n.y, n.z); edgeVertices.set(key, id); return id;
  };
  const triangle = (a, c, d) => {
    const pa = new THREE.Vector3().fromArray(position, a * 3), pc = new THREE.Vector3().fromArray(position, c * 3), pd = new THREE.Vector3().fromArray(position, d * 3);
    const n = new THREE.Vector3().fromArray(normal, a * 3).add(new THREE.Vector3().fromArray(normal, c * 3)).add(new THREE.Vector3().fromArray(normal, d * 3));
    if (pc.sub(pa).cross(pd.sub(pa)).dot(n) >= 0) indices.push(a, c, d); else indices.push(a, d, c);
  };
  for (let x = 0; x < cells[0]; x++) for (let y = 0; y < cells[1]; y++) for (let z = 0; z < cells[2]; z++) {
    const ids = corners.map(([dx, dy, dz]) => idx(x + dx, y + dy, z + dz));
    if (ids.every(i => values[i] >= 0) || ids.every(i => values[i] < 0)) continue;
    for (const tetrahedron of tetrahedra) {
      const inside = tetrahedron.map(i => ids[i]).filter(i => values[i] >= 0), outside = tetrahedron.map(i => ids[i]).filter(i => values[i] < 0);
      if (!inside.length || !outside.length) continue;
      if (inside.length === 1 || outside.length === 1) {
        const one = inside.length === 1 ? inside : outside, three = inside.length === 1 ? outside : inside;
        triangle(...three.map(i => vertex(one[0], i)));
      } else {
        const a = vertex(inside[0], outside[0]), c = vertex(inside[0], outside[1]), d = vertex(inside[1], outside[1]), e = vertex(inside[1], outside[0]);
        triangle(a, c, d); triangle(a, d, e);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(position.flatMap((value, i) => i % 3 === 0 ? [value * .16, position[i + 1] * .16] : []), 2));
  geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: 'solid-taihu-rock-with-two-open-tunnels', evidence: 'rockery-presence-supported-specific-stone-authored', seed };
  return geometry;
}
