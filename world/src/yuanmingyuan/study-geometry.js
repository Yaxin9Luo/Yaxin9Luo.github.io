import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function namedGroup(parent, name, data = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.userData = data;
  parent.add(group);
  return group;
}

export function meshFromTriangles(triangles) {
  const positions = [], uv = [];
  for (const [a, b, c] of triangles) {
    if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).lengthSq() < 1e-14) continue;
    for (const point of [a, b, c]) { positions.push(point.x, point.y, point.z); uv.push(point.x * .3, point.y * .3 + point.z * .3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function surfaceGeometry(sample, columns, rows) {
  const triangles = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = sample(column / columns, row / rows), b = sample((column + 1) / columns, row / rows);
    const c = sample((column + 1) / columns, (row + 1) / rows), d = sample(column / columns, (row + 1) / rows);
    triangles.push([a, b, c], [a, c, d]);
  }
  return meshFromTriangles(triangles);
}

export function extrudedPolygon(points, bottom, top, holes = []) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1, curveSegments: 20 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}

