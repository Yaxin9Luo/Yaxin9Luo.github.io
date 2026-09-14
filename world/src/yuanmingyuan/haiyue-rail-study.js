import * as THREE from 'three';
import { HaiyueBuilder } from './haiyue-architecture.js';
import { haiyueCarvedStoneRailBay, haiyueStoneRailEvidence } from './haiyue-stone-rail.js';

export const haiyueRailViews = {
  threequarter: { label: '白石雕栏 · 莲瓣望柱与浅浮雕', groups: [], direction: [.38, .24, 1], margin: 1.13 },
  front: { label: '华板、透空肩花与分层寻杖', groups: [], direction: [.04, .05, 1], margin: 1.12 },
  crown: { label: '莲瓣望柱头 · 双层瓣片', groups: ['haiyue-marble-lotus-wangzhu'], direction: [.65, .43, 1], crop: { min: [0, .69, 0], max: [1, 1, 1] }, margin: 1.16 },
  relief: { label: '实体花叶浅浮雕 · 双面刻工', groups: ['haiyue-huaban-solid-floral-relief'], direction: [.22, .18, 1], margin: 1.14 },
};

export function createHaiyueRailStudy({ width = 1.72, height = 1 } = {}) {
  const b = new HaiyueBuilder(), group = new THREE.Group(); group.name = 'haiyue-carved-marble-rail-study';
  try {
    haiyueCarvedStoneRailBay(b, group, width, 0, { height }); b.flush(); group.updateMatrixWorld(true);
    let triangles = 0, instances = 0; group.traverse(m => { if (m.isMesh) { instances += m.count ?? 0; triangles += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3 * (m.count ?? 1); } });
    const box = new THREE.Box3().setFromObject(group);
    return { group, groundY: 0, views: haiyueRailViews, resources: { geometries: b.geometries, materials: b.materials, textures: b.textures, instances: b.instances }, diagnostics: { evidence: haiyueStoneRailEvidence, width, height, bounds: { min: box.min.toArray(), max: box.max.toArray() }, triangles, instances, nativeReviewed: false }, dispose() { b.dispose(); group.clear(); } };
  } catch (error) { b.dispose(); group.clear(); throw error; }
}
