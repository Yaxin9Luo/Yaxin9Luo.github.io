import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JiuzhouBuilder } from '../src/yuanmingyuan/jiuzhou-architecture.js';
import { buildJiuzhouFlatRoom, buildJiuzhouConnectingSuites } from '../src/yuanmingyuan/jiuzhou-buildings.js';
import { buildJiuzhouPlatformGalleryRoof } from '../src/yuanmingyuan/jiuzhou-gallery-roof.js';

test('fixture: platform provenance keeps textual categories separate from inferred roof construction', () => {
  const b = new JiuzhouBuilder('jiuzhou-provenance-fixture'), root = new THREE.Group();
  try {
    const room = buildJiuzhouFlatRoom(b, root, 'platform-room', { x: 0, z: 0, width: 2.4, depth: 2, floor: .64, roofY: 4.30 });
    const suites = buildJiuzhouConnectingSuites(b, root);
    const gallery = buildJiuzhouPlatformGalleryRoof(b, root, 'platform-gallery', [[0, 0], [3, 0]], { floorStart: .74, floorEnd: .64 });
    b.flush();
    for (const node of [room, suites, gallery]) {
      const data = JSON.parse(JSON.stringify(node.userData));
      assert.match(data.source, /archival research.*textual evidence/);
      assert.equal(data.exactRoofSectionRecovered, false);
      assert.equal(data.roofPitchConstructionDrainageAndCopingInferred, true);
      assert.doesNotMatch(data.body, /documented.*flat.roof/);
    }
    for (const node of [room, suites]) assert.match(node.userData.roofComparison, /modern reconstruction.*not/);
    for (const id of ['jiuzhou-tongdao-inner-three-bay-suite', 'jiuzhou-qinghui-inner-three-bay-suite']) {
      const data = root.getObjectByName(id).userData;
      assert.equal(data.bays, 3);
      assert.equal(data.exactRoofSectionRecovered, false);
      assert.equal(data.roofPitchConstructionDrainageAndCopingInferred, true);
      assert.equal(data.planAndRoofHeightInferred, true);
    }
  } finally { b.dispose(); root.clear(); }
});
