import * as THREE from 'three';
import { createFountainWater } from '../../src/yuanmingyuan/yuanyingguan-geometry.js';

// Tiny real source: independently authored literals, shared topology, non-unit
// normals, full RGBA pixels, material groups and the actual fountain lifecycle.
export function createArchiveSpecimen() {
  const group = new THREE.Group(); group.name = 'staged exact source';
  group.position.set(1.25, 2.7, -3.1); group.rotation.set(.1, .2, -.3, 'ZYX'); group.scale.set(-1, 1.5, .75);
  group.userData = { category: 'architecture', museumEntryId: 'test-courtyard' };
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0, 1,1,0], 3));
  indexed.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,2, 0,0,2, 0,0,2, 0,0,2], 3));
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 0,1, 1,1], 2));
  indexed.setAttribute('color', new THREE.Uint8BufferAttribute([17,93,227, 255,133,57, 5,31,113, 1,203,44], 3, true));
  indexed.setIndex(new THREE.Uint16BufferAttribute([0,1,2, 2,1,3, 0,0,1], 1));
  indexed.addGroup(0, 6, 0); indexed.addGroup(6, 3, 1); indexed.computeBoundingBox(); indexed.computeBoundingSphere();
  indexed.attributes.position.setUsage(THREE.DynamicDrawUsage); indexed.attributes.position.addUpdateRange(3, 3);
  const water = createFountainWater('staged-fixture');
  const map = new THREE.DataTexture(new Uint8Array([11,72,203,0, 255,2,49,1, 13,124,5,201, 209,19,111,255]), 2, 2);
  map.name = 'literal original RGBA'; map.colorSpace = THREE.SRGBColorSpace; map.flipY = true;
  map.wrapS = THREE.MirroredRepeatWrapping; map.wrapT = THREE.RepeatWrapping; map.repeat.set(2.25, .75); map.offset.set(.12, -.07); map.needsUpdate = true;
  const roughness = map.clone(); roughness.colorSpace = THREE.NoColorSpace; roughness.flipY = false;
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(.3123456789, .087654321, .5123456), map, roughnessMap: roughness, roughness: .71, metalness: .43, transmission: .37, thickness: .123, ior: 1.41, attenuationDistance: Infinity, transparent: true, opacity: .83, depthWrite: false, side: THREE.DoubleSide, shadowSide: THREE.BackSide, vertexColors: true });
  material.name = 'literal physical material'; material.userData = { category: 'stone' };
  const mesh = new THREE.Mesh(indexed, [material, water.surface]); mesh.name = 'indexed surface'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.renderOrder = 4; mesh.layers.set(3);
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map, side: THREE.DoubleSide, alphaTest: .07 }); group.add(mesh);
  const nonindexed = indexed.toNonIndexed(); nonindexed.clearGroups();
  const jet = new THREE.Mesh(nonindexed, water.flow); jet.name = 'nonindexed water'; jet.userData = { category: 'water', waterContact: { surfaceY: 2.7 } }; group.add(jet);
  const hidden = new THREE.Mesh(nonindexed, material); hidden.visible = false; hidden.name = 'hidden exact geometry'; hidden.frustumCulled = false; group.add(hidden);
  const instances = new THREE.InstancedMesh(indexed, material, 3); instances.name = 'literal instances'; instances.castShadow = true;
  for (let i = 0; i < 3; i++) { instances.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(i * 1.1, i * .4, -i), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), i * .3), new THREE.Vector3(1 + i * .1, 1, .8))); instances.setColorAt(i, new THREE.Color(.1 + i * .2, .8 - i * .17, .3)); }
  instances.computeBoundingBox(); instances.computeBoundingSphere(); group.add(instances); group.updateMatrixWorld(true);
  let disposed = false;
  return { group, diagnostics: { assetId: 'staged-fixture', visualAcceptance: false, waterEndpoints: [{ id: 'real-flow', end: [0,2.7,0] }] }, update: water.update, dispose() {
    if (disposed) return; disposed = true;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(node => { if (node.geometry) geometries.add(node.geometry); for (const m of [node.material, node.customDepthMaterial, node.customDistanceMaterial].flat().filter(Boolean)) { materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } if (node.isInstancedMesh) node.dispose(); });
    for (const set of [geometries, materials, textures]) for (const resource of set) resource.dispose(); group.clear();
  } };
}
