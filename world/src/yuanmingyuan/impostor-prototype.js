import * as THREE from 'three';
import { pineShootGeometry } from './vegetation-geometry.js';

/** The existing seed-218 repeat unit, with the frozen leaf material values.
 * This never constructs a tree or changes the shared geometry helper. */
export function createPineShootImpostorSource() {
  const geometry = pineShootGeometry({ seed: 218 }), material = new THREE.MeshStandardMaterial({ name: 'yuanming-leaf-lamina', color: 0xffffff, vertexColors: true, roughness: .77, side: THREE.DoubleSide, emissive: '#263724', emissiveIntensity: .045 });
  const mesh = new THREE.Mesh(geometry, material), group = new THREE.Group(); mesh.name = 'pine-live-terminal-shoot-218-full'; group.add(mesh); group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group); let disposed = false;
  return { group, geometry, material, diagnostics: { id: 'pine-shoot-218', geometrySource: 'vegetation-geometry.js::pineShootGeometry({seed:218})', materialSource: 'garden-vegetation.js::VegetationBuilder.m.leaves', triangles: (geometry.index?.count ?? geometry.attributes.position.count) / 3, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, wholeTreeConstructed: false, originalGeometryRetained: true }, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.clear(); geometry.dispose(); material.dispose(); } };
}
