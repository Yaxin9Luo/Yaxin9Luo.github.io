import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { createHaiyueRailStudy } from '../src/yuanmingyuan/haiyue-rail-study.js';
import { haiyueLotusCrownCore, haiyueLotusCrownPetal, haiyueReliefLeaf, haiyueReliefScroll, haiyueProfiledHandrail, haiyuePiercedArchHeader, haiyueCarvedMarblePixels } from '../src/yuanmingyuan/haiyue-stone-rail.js';
import { HaiyueBuilder, haiyueRailBay } from '../src/yuanmingyuan/haiyue-architecture.js';

function solid(geometry) {
  const p = geometry.attributes.position, index = geometry.index, at = i => index ? index.getX(i) : i, a = new THREE.Vector3(), b = a.clone(), c = a.clone(), edges = new Map(); let volume = 0;
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e7)).join(',');
  for (const attribute of Object.values(geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    a.fromBufferAttribute(p, at(i)); b.fromBufferAttribute(p, at(i + 1)); c.fromBufferAttribute(p, at(i + 2));
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-15, `degenerate ${geometry.name}/${i / 3}`); volume += a.dot(b.clone().cross(c)) / 6;
    const ids = [key(at(i)), key(at(i + 1)), key(at(i + 2))];
    for (let j = 0; j < 3; j++) { const a = ids[j], b = ids[(j + 1) % 3], edge = [a, b].sort().join('|'); if (!edges.has(edge)) edges.set(edge, []); edges.get(edge).push(a < b ? 1 : -1); }
  }
  for (const [edge, faces] of edges) assert.deepEqual(faces.sort(), [-1, 1], `${geometry.name}: open/nonmanifold ${edge}`);
  assert.ok(volume > 0, `${geometry.name}: inward surface ${volume}`);
}

test('rail fixture: petal heads, floral relief and mouldings are real closed outward solids', () => {
  for (const geometry of [haiyueLotusCrownCore(), haiyueLotusCrownPetal(0), haiyueLotusCrownPetal(1), haiyueReliefLeaf(), haiyueReliefScroll(), haiyueProfiledHandrail(1.53), haiyuePiercedArchHeader(.70)]) {
    try { solid(geometry); } finally { geometry.dispose(); }
  }
});

test('rail fixture: lotus end fans remove microscopic slivers while retaining the accepted carved surface', () => {
  const oldSource = readFileSync(new URL('../../work/yuanmingyuan/haiyue/haiyue-stone-rail-before-petal-fans.js', import.meta.url), 'utf8');
  const code = oldSource.slice(oldSource.indexOf('const TAU ='), oldSource.indexOf('// An original fine-grained')).replaceAll('export ', '');
  const previous = new Function('THREE', code + '\nreturn { haiyueLotusCrownCore, haiyueLotusCrownPetal, haiyueReliefLeaf, haiyueReliefScroll, haiyueProfiledHandrail, haiyuePiercedArchHeader };')(THREE);
  const signature = g => { const hash = createHash('sha256'); for (const a of Object.values(g.attributes)) hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)); if (g.index) hash.update(new Uint8Array(g.index.array.buffer)); return hash.digest('hex'); };
  const unmodified = [[haiyueLotusCrownCore, []], [haiyueReliefLeaf, []], [haiyueReliefScroll, []], [haiyueProfiledHandrail, [1.53]], [haiyuePiercedArchHeader, [.70]]];
  for (const [make, args] of unmodified) {
    const before = previous[make.name](...args), after = make(...args);
    try { assert.equal(signature(after), signature(before), `${make.name}: unrelated geometry changed`); } finally { before.dispose(); after.dispose(); }
  }
  for (const tier of [0, 1]) {
    const before = previous.haiyueLotusCrownPetal(tier), after = haiyueLotusCrownPetal(tier);
    try {
      solid(after);
      // Removing the old angular-width floor changes a buried extremum by
      // 2.3e-10 m in tier 1; the accepted silhouette stays within 10 nanometres.
      assert.ok(after.boundingBox.min.distanceTo(before.boundingBox.min) < 1e-8); assert.ok(after.boundingBox.max.distanceTo(before.boundingBox.max) < 1e-8);
      for (const face of [0, 1]) for (let row = 1; row < 24; row++) for (let column = 0; column <= 8; column++) {
        const oldId = face * 225 + row * 9 + column, newId = face * 209 + 1 + (row - 1) * 9 + column;
        for (const name of ['position', 'uv']) for (let k = 0; k < before.attributes[name].itemSize; k++) assert.equal(after.attributes[name].array[newId * after.attributes[name].itemSize + k], before.attributes[name].array[oldId * before.attributes[name].itemSize + k], 'accepted interior carving/UV must stay exact');
      }
      // The smallest real dock railing height is .92 m. Verify the same area
      // rule after a representative actual positive instance transform too.
      const placed = after.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-.86, -.1, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(1, .92, 1)));
      try { solid(placed); } finally { placed.dispose(); }
    } finally { before.dispose(); after.dispose(); }
  }
});

test('rail fixture: the complete independent bay has supported posts, open upper panels and relief depth', () => {
  const started = performance.now(), study = createHaiyueRailStudy(), owned = [...Object.values(study.resources).flatMap(set => [...set])], disposed = new Map(owned.map(o => [o, 0]));
  for (const object of owned) object.addEventListener('dispose', () => disposed.set(object, disposed.get(object) + 1));
  const report = { scope: 'one independent rail bay, no Haiyue building/terrace factory or GPU', diagnostics: study.diagnostics, milliseconds: 0, peakRssKiB: 0 };
  try {
    const a = new THREE.Vector3(), b = a.clone(), c = a.clone();
    for (const geometry of study.resources.geometries) {
      for (const attribute of Object.values(geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
      const p = geometry.attributes.position, index = geometry.index, at = i => index ? index.getX(i) : i;
      for (let i = 0; i < (index?.count ?? p.count); i += 3) { a.fromBufferAttribute(p, at(i)); b.fromBufferAttribute(p, at(i + 1)); c.fromBufferAttribute(p, at(i + 2)); assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-15, `production-sized triangle threshold: ${geometry.name}/${i / 3}`); }
    }
    for (const mesh of study.resources.instances) for (let i = 0; i < mesh.count; i++) { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); assert.ok(matrix.determinant() > 0); }
    const ray = (x, y) => new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(study.group, true);
    for (const x of [-.38, .38]) assert.equal(ray(x, .62).length, 0, 'upper apertures must be genuine empty space');
    assert.ok(ray(.16, .28).length > 0, 'lower huaban must have an actual solid backing');
    assert.ok(ray(0, .64).length > 0, 'central vase must support the header');
    for (const x of [-.86, .86]) { const hit = new THREE.Raycaster(new THREE.Vector3(x, -.1, 0), new THREE.Vector3(0, 1, 0), 0, .2).intersectObject(study.group, true)[0]; assert.ok(hit && Math.abs(hit.point.y) < .00001); }
    const petal = [...study.resources.geometries].find(g => g.userData.body === 'solid-tapered-leaf-with-cambered-front-and-buried-back'); assert.ok(petal); petal.computeBoundingBox(); assert.ok(petal.boundingBox.max.z - petal.boundingBox.min.z > .025);
    const material = [...study.resources.materials].find(m => m.name === 'haiyue-finely-carved-white-marble'); assert.equal(material.side, THREE.FrontSide); assert.equal(material.map.colorSpace, THREE.SRGBColorSpace); assert.equal(material.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(material.map.image.width, 512); assert.equal(material.normalMap.image.width, 512); assert.equal(material.roughnessMap.image.width, 512);
    assert.equal(study.diagnostics.evidence.photographyBundled, false);
  } finally {
    study.dispose(); study.dispose(); for (const object of owned) assert.equal(disposed.get(object), 1, 'resource ownership must release once');
    assert.equal(study.group.children.length, 0); report.milliseconds = performance.now() - started; report.peakRssKiB = process.resourceUsage().maxRSS; report.resourcesDisposed = owned.length;
    if (process.env.HAIYUE_RAIL_REPORT_PATH) writeFileSync(process.env.HAIYUE_RAIL_REPORT_PATH, JSON.stringify(report, null, 2));
  }
});

test('rail fixture: original white stone pixels remain fine, deterministic and non-photographic', () => {
  const a = haiyueCarvedMarblePixels(128), b = haiyueCarvedMarblePixels(128), hash = data => createHash('sha256').update(data).digest('hex');
  for (const map of ['color', 'normal', 'roughness']) assert.equal(hash(a[map]), hash(b[map]));
  let minimum = 255, maximum = 0; for (let i = 0; i < a.color.length; i += 4) { minimum = Math.min(minimum, a.color[i]); maximum = Math.max(maximum, a.color[i]); }
  assert.ok(minimum > 220 && maximum < 245 && maximum - minimum >= 8); assert.equal(a.physicalTile, .35);
});

test('rail fixture: the unrelated timber rail has byte-identical geometry and placements', () => {
  const path = new URL('../../work/yuanmingyuan/haiyue/terrace-native-r1-fix/haiyue-architecture.js.before', import.meta.url), source = readFileSync(path, 'utf8');
  const start = source.indexOf('export function haiyueRailBay('), end = source.indexOf('\nexport function haiyueStraightRail', start);
  const old = new Function('THREE', source.slice(start, end).replace('export function', 'function') + '\nreturn haiyueRailBay;')(THREE);
  const build = fn => { const b = new HaiyueBuilder(), g = new THREE.Group(); try { fn(b, g, 1.6, 4.2, { stone: false, endPost: true, height: .96 }); b.flush(); const hash = createHash('sha256'); g.traverse(m => { if (!m.isMesh) return; for (const a of Object.values(m.geometry.attributes)) hash.update(new Uint8Array(a.array.buffer)); if (m.geometry.index) hash.update(new Uint8Array(m.geometry.index.array.buffer)); hash.update(new Uint8Array(m.instanceMatrix.array.buffer)); hash.update(m.material.name); }); return hash.digest('hex'); } finally { b.dispose(); g.clear(); } };
  assert.equal(build(old), build(haiyueRailBay));
});
