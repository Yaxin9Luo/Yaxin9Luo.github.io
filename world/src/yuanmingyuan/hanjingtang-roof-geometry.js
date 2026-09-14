import * as THREE from 'three';

// A continuous rounded crown, rather than a straight ridge hidden by a tube.
// The curve is authored; the juanpeng-xieshan type is documented for Chunhuaxuan.
export function rolledGablePoint({ width, depth, eaveY = 0, rise = 2 }, side, u, t) {
  const a = 1 - t;
  const z = depth / 2 * (a ** 3 + 1.50 * a * a * t + .78 * a * t * t);
  const y = eaveY + rise * (.09 * a * a * t + 3 * a * t * t + t ** 3);
  return new THREE.Vector3(u * width / 2, y, side * z);
}

export function rolledGableRoofGeometry(options) {
  const { width, depth, rise = 2, thickness = .18 } = options;
  if (!(width > 0 && depth > 0 && rise > 0 && thickness > 0)) throw new Error('Invalid rolled roof dimensions.');
  const across = 20, half = 72, along = half * 2;
  const positions = [], uvs = [], indices = [];
  const put = (p, u = 0, v = 0) => { const id = positions.length / 3; positions.push(...p.toArray()); uvs.push(u, v); return id; };
  const quad = (a, b, c, d, outward) => {
    const va = new THREE.Vector3().fromArray(positions, a * 3), vb = new THREE.Vector3().fromArray(positions, b * 3), vc = new THREE.Vector3().fromArray(positions, c * 3);
    if (vb.sub(va).cross(vc.sub(va)).dot(outward) >= 0) indices.push(a, b, c, a, c, d);
    else indices.push(a, c, b, a, d, c);
  };
  const sample = (i, j, under = false) => {
    const t = j <= half ? j / half : (along - j) / half;
    const p = rolledGablePoint(options, j <= half ? 1 : -1, -1 + 2 * i / across, t);
    if (under) p.y -= thickness;
    return p;
  };
  for (const under of [false, true]) {
    const start = positions.length / 3;
    for (let i = 0; i <= across; i++) for (let j = 0; j <= along; j++) put(sample(i, j, under), i / across, j / along);
    for (let i = 0; i < across; i++) for (let j = 0; j < along; j++) {
      const a = start + i * (along + 1) + j, b = a + along + 1;
      quad(a, b, b + 1, a + 1, new THREE.Vector3(0, under ? -1 : 1, 0));
    }
  }
  // Separate cap vertices retain a hard clay edge while each curved sheet is smooth.
  for (const i of [0, across]) for (let j = 0; j < along; j++) {
    const ids = [put(sample(i, j)), put(sample(i, j + 1)), put(sample(i, j + 1, true)), put(sample(i, j, true))];
    quad(...ids, new THREE.Vector3(i ? 1 : -1, 0, 0));
  }
  for (const j of [0, along]) for (let i = 0; i < across; i++) {
    const ids = [put(sample(i, j)), put(sample(i + 1, j)), put(sample(i + 1, j, true)), put(sample(i, j, true))];
    quad(...ids, new THREE.Vector3(0, 0, j ? -1 : 1));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { body: 'closed-continuous-juanpeng-roof', crownHasStraightRidge: false, profileInferred: true, longitudinalSamples: along };
  return geometry;
}

export function rolledGableInfillGeometry(depth, rise, thickness = .18) {
  const shape = new THREE.Shape(); shape.moveTo(-depth / 2, 0);
  for (let i = 0; i <= 72; i++) {
    const p = rolledGablePoint({ width: 1, depth, rise, eaveY: 0 }, -1, 0, i / 72);
    shape.lineTo(p.z, p.y);
  }
  for (let i = 71; i >= 0; i--) {
    const p = rolledGablePoint({ width: 1, depth, rise, eaveY: 0 }, 1, 0, i / 72);
    shape.lineTo(p.z, p.y);
  }
  shape.lineTo(-depth / 2, 0); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 36 });
  geometry.translate(0, 0, -thickness / 2); geometry.rotateY(Math.PI / 2); geometry.normalizeNormals();
  geometry.userData = { body: 'solid-rounded-gable-infill' }; return geometry;
}
