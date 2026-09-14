import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three';
import { rolledGableRoofGeometry, rolledGableInfillGeometry } from '../src/yuanmingyuan/hanjingtang-roof-geometry.js';
import { moonScreenGeometry, carvedBranchGeometry, carvedLeafGeometry, sanyouMoonScreen, mezzanineTimberFloor } from '../src/yuanmingyuan/hanjingtang-joinery.js';
import { HanjingBuilder, rolledGableBoards } from '../src/yuanmingyuan/hanjingtang-architecture.js';
import { prepareHanjingtangAssets, hanjingtangStoneSource } from '../src/yuanmingyuan/hanjingtang-rockwork.js';
import { rubbingPageGeometry, hanjingtangRubbingSources } from '../src/yuanmingyuan/hanjingtang-rubbings.js';
import { createHanjingtangStudy } from '../src/yuanmingyuan/hanjingtang-study.js';
import { hanjingtangPlan } from '../src/yuanmingyuan/hanjingtang-layout.js';
import { hanjingtangStudyViews } from '../src/yuanmingyuan/hanjingtang-study-views.js';
import { getGardenGroup } from '../src/yuanmingyuan/garden-layout.js';

const vector = p => new THREE.Vector3(...p);
function ray(object, origin, direction, far = Infinity) { object.updateMatrixWorld(true); return new THREE.Raycaster(vector(origin), vector(direction), 0, far).intersectObject(object, true); }
function fixture(geometry, run) {
  const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material);
  try { run(mesh); } finally { geometry.dispose(); material.dispose(); }
}
function finite(geometry) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)));
    const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); assert.ok(length > .95 && length < 1.05, `normal ${i}: ${length}`);
  }
}
function closed(geometry) {
  const p = geometry.getAttribute('position'), index = geometry.index, edges = new Map();
  const key = i => { const id = index ? index.getX(i) : i; return [p.getX(id), p.getY(id), p.getZ(id)].map(v => Math.round(v * 1e5)).join(','); };
  for (let i = 0; i < (index?.count ?? p.count); i += 3) for (let j = 0; j < 3; j++) {
    const a = key(i + j), c = key(i + (j + 1) % 3), edge = a < c ? `${a}|${c}` : `${c}|${a}`;
    edges.set(edge, (edges.get(edge) ?? 0) + 1);
  }
  const bad = [...edges].filter(([, count]) => count !== 2); assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 3)));
}

test('fixture: rolled roofs have a smooth closed crown and solid rounded gables', () => {
  fixture(rolledGableRoofGeometry({ width: 12, depth: 6, eaveY: 5, rise: 2.6 }), roof => {
    finite(roof.geometry); closed(roof.geometry);
    const centre = ray(roof, [0, 12, 0], [0, -1, 0])[0]; assert.ok(centre && centre.point.y > 7.59);
    const near = [-.08, .08].map(z => ray(roof, [0, 12, z], [0, -1, 0])[0]);
    assert.ok(near.every(hit => hit && hit.face.normal.y > .97));
    assert.ok(Math.abs(near[0].point.y - near[1].point.y) < .0001);
    assert.ok(centre.point.y - near[0].point.y < .016, 'actual crown curves continuously instead of a sharp ridge');
    for (const z of [-2.8, -1.2, .4, 2.1]) {
      const top = ray(roof, [1.1, 12, z], [0, -1, 0])[0], under = ray(roof, [1.1, 1, z], [0, 1, 0])[0];
      assert.ok(top && under && Math.abs(top.point.y - under.point.y - .18) < .001);
    }
  });
  fixture(rolledGableInfillGeometry(6, 2.6), gable => {
    finite(gable.geometry); closed(gable.geometry);
    assert.ok(ray(gable, [2, 2.5, 0], [-1, 0, 0]).length);
    assert.equal(ray(gable, [2, 2.5, 2.6], [-1, 0, 0]).length, 0);
  });
});

test('fixture: the carved circular screen has a real opening and a closed wooden border', () => {
  fixture(moonScreenGeometry(), screen => {
    finite(screen.geometry); closed(screen.geometry);
    for (const x of [-.6, 0, .6]) assert.equal(ray(screen, [x, 1.56, 2], [0, 0, -1]).length, 0);
    for (const [x, y] of [[1.60, 1.56], [0, 3.55], [0, .11]]) assert.ok(ray(screen, [x, y, 2], [0, 0, -1]).length);
  });
});

test('fixture: Sanyouxuan gable battens remain below the actual rounded bargeboards', () => {
  const b = new HanjingBuilder('gable-fixture'), root = new THREE.Group();
  const options = { width: 9.66, depth: 5.28, eaveY: 6.178, rise: 1.944, thickness: .18 };
  try {
    const gables = rolledGableBoards(b, root, 'sanyou-gable-fixture', options, 2.7, 6.166);
    b.flush(); root.updateMatrixWorld(true);
    const red = [], cover = [];
    gables.traverse(node => {
      if (!node.isMesh) return;
      if (node.material === b.m.red) red.push(node);
      if (node.material === b.m.greenTile) cover.push(node);
    });
    let checked = 0;
    for (const mesh of red) {
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        const hits = new THREE.Raycaster(new THREE.Vector3(vertex.x, 15, vertex.z), new THREE.Vector3(0, -1, 0)).intersectObjects(cover, false);
        assert.ok(hits[0], `missing actual bargeboard cover at ${vertex.toArray()}`);
        assert.ok(vertex.y < hits[0].point.y - .005, `Sanyou red batten protrudes: ${vertex.toArray()} > actual cover ${hits[0].point.y}`);
        checked++;
      }
    }
    assert.equal(checked, 360);
  } finally { b.dispose(); }
});

test('fixture: the round screen spandrels are pierced rather than a solid dark board', () => {
  fixture(moonScreenGeometry(4.45, 3.65, 1.21, 1.61), screen => {
    let open = 0, sampled = 0;
    for (let x = -1.98; x < 2; x += .13) for (let y = .29; y < 3.45; y += .13) {
      if (Math.hypot(x, y - 1.61) < 1.36) continue;
      sampled++; if (!ray(screen, [x, y, 1], [0, 0, -1]).length) open++;
    }
    assert.ok(open / sampled > .60, `only ${open}/${sampled} spandrel rays pass through`);
  });
});

test('fixture: carved branches and leaves have closed outward-facing curved volume', () => {
  const geometries = [carvedBranchGeometry([[0, 0, 0], [.08, .28, .02], [-.10, .61, .05], [0, .9, .025]], [.09, .06, .03, .012]), carvedLeafGeometry()];
  for (const geometry of geometries) fixture(geometry, mesh => {
    finite(geometry); closed(geometry);
    const p = geometry.attributes.position, ids = geometry.index; let volume = 0;
    for (let i = 0; i < ids.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, ids.getX(i)), c = new THREE.Vector3().fromBufferAttribute(p, ids.getX(i + 1)), d = new THREE.Vector3().fromBufferAttribute(p, ids.getX(i + 2));
      volume += a.dot(c.cross(d)) / 6;
    }
    assert.ok(volume > .000025, `positive enclosed volume required: ${volume}`);
    const z = ray(mesh, [0, .12, 1], [0, 0, -1])[0], back = ray(mesh, [0, .12, -1], [0, 0, 1])[0];
    assert.ok(z && back && z.point.z - back.point.z > .014);
  });
});

test('fixture: assembled Sanyou carving keeps its round opening and multiple spandrel holes', () => {
  const b = new HanjingBuilder('carving-fixture'), root = new THREE.Group();
  try {
    const screen = sanyouMoonScreen(b, root); b.flush(); root.updateMatrixWorld(true);
    let meshes = 0;
    screen.traverse(node => { if (node.isMesh) { finite(node.geometry); meshes++; } });
    assert.ok(meshes > 4);
    for (let y = .60; y < 2.70; y += .16) for (let x = -1.10; x <= 1.10; x += .16) {
      if (Math.hypot(x, y - 1.61) > 1.15) continue;
      assert.equal(ray(screen, [x, y, 2], [0, 0, -1]).length, 0, `blocked round opening at ${x},${y}`);
    }
    let holes = 0, occupied = 0;
    for (let x = -1.97; x < 1.99; x += .16) for (let y = .28; y < 3.45; y += .16) {
      if (Math.hypot(x, y - 1.61) < 1.40) continue;
      if (ray(screen, [x, y, 2], [0, 0, -1]).length) occupied++; else holes++;
    }
    assert.ok(holes > 40 && occupied > 40, `actual sparse and dense carving: ${holes} open, ${occupied} occupied`);
    for (const [x, y] of [[-1.72, 1.47], [1.73, 1.89]]) {
      const hits = ray(screen, [x, y, 2], [0, 0, -1]); assert.ok(hits.length, `carved trunk at ${x},${y}`);
    }
    const materials = new Set(), textures = new Set();
    screen.traverse(node => { if (node.isMesh) { materials.add(node.material); for (const value of Object.values(node.material)) if (value?.isTexture) textures.add(value); } });
    assert.ok([...materials].some(material => material.name.includes('zitan') && material.map && material.bumpMap)); assert.equal(textures.size, 2);
  } finally { b.dispose(); }
});

test('fixture: real timber boards preserve the mezzanine voids and bear on the backing', () => {
  const b = new HanjingBuilder('floor-fixture'), floor = new THREE.Group();
  try {
    const spec = hanjingtangPlan.core.find(hall => hall.id === 'hanjingtang-chunhuaxuan');
    mezzanineTimberFloor(b, floor, { width: spec.width - .72, depth: spec.depth - .72, level: spec.floor + 4.82, openings: [[[-5.9, -5.5], [5.9, -5.5], [5.9, 6.45], [-5.9, 6.45]], [[10.75, 1.55], [14.85, 1.55], [14.85, 7.05], [10.75, 7.05]]] });
    b.flush(); floor.updateMatrixWorld(true);
    for (const [x, z] of [[0, 0], [-5.85, -5.45], [5.85, 6.40], [12, 4], [10.8, 1.6], [14.8, 7]]) assert.equal(ray(floor, [x, 10, z], [0, -1, 0]).length, 0, 'board tops must never bridge a structural opening');
    for (const [x, z] of [[-12.1, 2.035], [7.1, -3], [15.5, 3]]) {
      const top = ray(floor, [x, 10, z], [0, -1, 0])[0], bottom = ray(floor, [x, 0, z], [0, 1, 0])[0];
      assert.ok(top && bottom && Math.abs(top.point.y - 5.72) < .001 && Math.abs(bottom.point.y - 5.52) < .001);
    }
    const seam = ray(floor, [-12.1, 10, 2], [0, -1, 0])[0];
    assert.ok(seam && Math.abs(seam.point.y - 5.694) < .001, 'the earlier arbitrary sample lands exactly in an 8 mm board joint');
    const topHeights = [];
    for (let z = -7.9; z < -6.9; z += .002) topHeights.push(ray(floor, [-11.71, 10, z], [0, -1, 0])[0]?.point.y);
    assert.ok(topHeights.some(y => Math.abs(y - 5.694) < .001), 'actual open board seams expose backing below the walking surface');
    assert.ok(topHeights.filter(y => Math.abs(y - 5.72) < .001).length > 450);
  } finally { b.dispose(); }
});

test('fixture: a cancelled Hanjingtang preparation stops before requesting images', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(prepareHanjingtangAssets({ signal: controller.signal }), { name: 'AbortError' });
});

test('fixture: rubbing UVs retain two distinct historic page regions without calibration margins', () => {
  const left = rubbingPageGeometry(.735, 1.295, 0), right = rubbingPageGeometry(.735, 1.295, 1);
  try {
    const all = [left, right].map(g => [...g.getAttribute('uv').array]);
    assert.ok(all[0].every((v, i) => i % 2 || v < .50)); assert.ok(all[1].every((v, i) => i % 2 || v > .50));
    for (const uv of all) for (let i = 0; i < uv.length; i += 2) { assert.ok(uv[i] > .09 && uv[i] < .90); assert.ok(uv[i + 1] > .04 && uv[i + 1] < .96); }
    assert.equal(hanjingtangRubbingSources.length, 3);
    assert.ok(hanjingtangRubbingSources.every(source => source.license.includes('CC0') && source.objectNumber === '故帖000204N000000000'));
  } finally { left.dispose(); right.dispose(); }
});

function object(asset, name) { const node = asset.group.getObjectByName(name); assert.ok(node, name); return node; }
function span(object, x, z) {
  const top = ray(object, [x, 40, z], [0, -1, 0])[0], bottom = ray(object, [x, -5, z], [0, 1, 0])[0];
  assert.ok(top && bottom); return [bottom.point.y, top.point.y];
}

test('full Hanjingtang factory: named plan, usable courts, roof bearings and resource disposal', async t => {
  let asset;
  try {
    const sha256 = bytes => createHash('sha256').update(bytes).digest('hex'), stonePixels = {};
    for (const [channel, source] of Object.entries(hanjingtangStoneSource.files)) {
      const encoded = fs.readFileSync(new URL(`../public${source.path}`, import.meta.url)); assert.equal(sha256(encoded), source.sha256);
      const { data, info } = await sharp(encoded).flip().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      stonePixels[channel] = { data: new Uint8Array(data), width: info.width, height: info.height, channels: 4, origin: 'lower-left', encodedSha256: sha256(encoded), decodedSha256: sha256(data) };
    }
    const start = performance.now(); asset = createHanjingtangStudy({ stonePixels }); const buildMs = performance.now() - start;
    await t.test('the historical core has different roof types, a measured Sanyouxuan and separately marked chronology', () => {
      assert.equal(object(asset, 'hanjingtang-main-hall').userData.roofType, 'double-xieshan');
      assert.equal(object(asset, 'hanjingtang-chunhuaxuan').userData.roofType, 'juanpeng-xieshan');
      assert.equal(object(asset, 'hanjingtang-main-hall').userData.dimensions.bays, 7);
      const sanyou = object(asset, 'hanjingtang-sanyouxuan'), plinth = object(asset, 'hanjingtang-sanyouxuan-plinth');
      assert.equal(sanyou.userData.dimensions.width, 11.1); assert.deepEqual(plinth.userData.measuredSpans, [11.9, 8.3]);
      assert.ok(sanyou.position.x < object(asset, 'hanjingtang-chunhuaxuan').position.x);
      assert.ok(object(asset, 'hanjingtang-main-hall').position.z > object(asset, 'hanjingtang-chunhuaxuan').position.z);
      assert.ok(hanjingtangPlan.deferredNorthSides.some(record => record.phase?.includes('1814')));
      assert.equal(asset.diagnostics.visualAcceptance, false); assert.equal(asset.diagnostics.integrationAcceptance, false);
      assert.deepEqual(asset.diagnostics.placement.globalAnchor, getGardenGroup('hanjingtang').position);
    });
    await t.test('main halls and inscription galleries have real usable passageways', () => {
      for (const id of ['hanjingtang-main-hall', 'hanjingtang-chunhuaxuan', 'hanjingtang-sanyouxuan']) {
        const hall = object(asset, id), { depth, floor } = hall.userData.dimensions, p = hall.position;
        for (const x of [-.40, 0, .40]) assert.equal(ray(hall, [p.x + x, floor + 1.7, p.z + depth / 2 + 1.0], [0, 0, -1], depth + 2.0).length, 0, id);
      }
      for (const [name, x] of [['west', -22.2], ['east', 22.2]]) {
        const gallery = object(asset, `hanjingtang-${name}-inscription-gallery`);
        for (const dx of [-.32, 0, .32]) assert.equal(ray(gallery, [x + dx, 2.6, 58], [0, 0, -1], 32).length, 0);
      }
      const screen = object(asset, 'hanjingtang-south-court-spirit-screen');
      assert.ok(ray(screen, [0, 1.7, 109], [0, 0, -1], 10).length);
      for (const x of [-5.9, 5.9]) assert.equal(ray(screen, [x, 1.7, 109], [0, 0, -1], 10).length, 0, 'the documented screen is bypassed on either side');
    });
    await t.test('raised stone paths have ground-bearing backing and the round gate platform retains its real measured spans', () => {
      for (const [name, x, z] of [['hanjingtang-chunhua-moon-terrace', 10.1, 22.8], ['hanjingtang-upper-flank-path--1', -19.1, -.8], ['hanjingtang-sanyou-path', -25.8, 11]]) {
        const [bottom, top] = span(object(asset, name), x, z); assert.ok(bottom < 0 && top > .50);
      }
      const platform = object(asset, 'hanjingtang-south-gate-platform'), box = new THREE.Box3().setFromObject(platform);
      assert.ok(Math.abs(box.max.x - box.min.x - 19.7) < .001); assert.ok(Math.abs(box.max.y - 1.6) < .001);
      assert.equal(ray(platform, [9.5, 3, 121.9], [0, -1, 0]).length, 0, 'the front platform corners are truly rounded');
    });
    await t.test('the interior mezzanine has a floor opening, supported beams and two continuous stair flights', () => {
      const floor = object(asset, 'hanjingtang-chunhua-interior-mezzanine-floor'), posts = object(asset, 'hanjingtang-chunhua-interior-mezzanine-bearing-posts'), stair = object(asset, 'hanjingtang-chunhua-interior-mezzanine-stair');
      assert.equal(ray(floor, [0, 10, 11], [0, -1, 0]).length, 0);
      assert.equal(ray(floor, [12.7, 10, 15], [0, -1, 0]).length, 0);
      for (const x of [-6.25, 6.25]) {
        const a = span(floor, x, 11), c = span(posts, x, 11); assert.ok(c[1] >= a[0] && c[0] < a[0]);
      }
      let previous = .90;
      for (const [x, from, direction] of [[11.76, 6.70, -1], [13.76, 2.25, 1]]) for (let i = 0; i < 15; i++) {
        const z = 11 + from + direction * (i + .5) * 4.45 / 15, hit = ray(stair, [x, 10, z], [0, -1, 0])[0];
        assert.ok(hit && hit.point.y >= previous - .03 && hit.point.y - previous < .19); previous = hit.point.y;
      }
      assert.ok(Math.abs(previous - 5.72) < .02);
    });
    await t.test('144 real inscription faces use six page regions, with explicit image and placement limits', () => {
      const galleries = object(asset, 'hanjingtang-chunhua-inscription-galleries'); let panels = 0, faceVertices = 0;
      galleries.traverse(node => {
        if (node.userData.body === 'marble-panel-with-historic-rubbing-derived-intaglio') panels++;
        if (node.isMesh && node.material.userData.category === 'stone-inscription') faceVertices += node.geometry.getAttribute('position').count;
      });
      assert.equal(panels, 144); assert.equal(faceVertices, 144 * 6);
      assert.equal(asset.diagnostics.distinctRubbingPageRegions, 6); assert.equal(asset.diagnostics.historicOriginalStoneOrderRecovered, false);
      assert.equal(asset.diagnostics.imagesDecoded, false, 'Node construction is not browser photo-decoding proof');
    });
    await t.test('eleven original-scale lake stones bear on foundations and leave the southern walking lane clear', () => {
      const gardens = object(asset, 'hanjingtang-scholar-rock-gardens'); let stones = 0;
      gardens.traverse(node => {
        if (node.userData.body !== 'closed-porous-scholar-rock') return; stones++;
        assert.deepEqual(node.scale.toArray(), [1, 1, 1]);
        const body = node.children.find(child => child.isMesh && child.material.userData.category === 'lake-stone'), base = node.children.find(child => child.isMesh && child.material.userData.category === 'masonry');
        assert.ok(body && base); assert.ok(body.geometry.attributes.color); assert.equal(body.material.vertexColors, true);
        assert.equal(body.material.color.getHex(), 0xffffff); assert.ok(body.material.map && body.material.normalMap && body.material.roughnessMap);
        const positions = body.geometry.attributes.position; let min = 0;
        for (let i = 1; i < positions.count; i++) if (positions.getY(i) < positions.getY(min)) min = i;
        const bottom = new THREE.Vector3().fromBufferAttribute(positions, min).applyMatrix4(body.matrixWorld), support = ray(base, [bottom.x, bottom.y + .4, bottom.z], [0, -1, 0])[0];
        assert.ok(support && support.point.y >= bottom.y && support.point.y - bottom.y < .03, `${node.name} has no physical bearing below its actual lowest vertex`);
      });
      assert.equal(stones, 11);
      for (const x of [-1.05, -.5, 0, .5, 1.05]) for (const y of [.40, 1.05, 1.70]) assert.equal(ray(gardens, [x, y, 56], [0, 0, -1], 13).length, 0, `stone intrudes into southern path at ${x},${y}`);
      for (const texture of Object.values(asset.diagnostics.stoneSurface.textures)) assert.deepEqual([texture.width, texture.height], [2048, 2048]);
      assert.equal(asset.diagnostics.stoneSurface.nativeAcceptance, false);
    });
    await t.test('double roof bearings touch both tiers and actual hip rafters stay beneath their shells', () => {
      const drum = object(asset, 'hanjingtang-main-hall-roof-bearing-drum');
      const lower = object(asset, 'hanjingtang-main-hall-roof-lower-eaves-shell'), upper = object(asset, 'hanjingtang-main-hall-roof-upper-xieshan-lower-hips-shell');
      for (const [x, z] of [[13.36, 68], [-13.36, 68], [0, 73.86], [0, 62.14]]) {
        const a = span(drum, x, z), lo = span(lower, x, z), hi = span(upper, x, z);
        assert.ok(a[0] <= lo[1] && a[1] >= lo[0]);
        assert.ok(a[1] >= hi[0] && a[1] < hi[1], 'bearing meets the underside without emerging above the upper roof');
      }
      for (const name of ['hanjingtang-main-hall-roof-lower-eaves', 'hanjingtang-main-hall-roof-upper-xieshan-lower-hips', 'hanjingtang-chunhuaxuan-roof-lower-hips']) {
        const shell = object(asset, `${name}-shell`), rafters = object(asset, `${name}-curved-timber-rafters`); let checked = 0;
        rafters.traverse(node => {
          if (!node.isMesh) return; const positions = node.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i += 37) {
            const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld), hit = ray(shell, [p.x, 40, p.z], [0, -1, 0])[0];
            if (!hit) continue; checked++; assert.ok(p.y < hit.point.y, `${name} contains an exposed rafter at ${p.toArray()}`);
          }
        });
        assert.ok(checked > 100);
      }
      const gables = object(asset, 'hanjingtang-sanyouxuan-roof-rounded-gable-boards'), cover = [], battens = [];
      gables.traverse(node => {
        if (!node.isMesh) return;
        if (node.material.name === 'hanjingtang-vermilion-timber') battens.push(node);
        if (node.material.name === 'hanjingtang-green-glazed-tile') cover.push(node);
      });
      let battenVertices = 0;
      for (const mesh of battens) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld);
        const hit = new THREE.Raycaster(new THREE.Vector3(p.x, 40, p.z), new THREE.Vector3(0, -1, 0)).intersectObjects(cover, false)[0];
        assert.ok(hit && p.y < hit.point.y - .005, `actual Sanyou batten protrudes at ${p.toArray()}`); battenVertices++;
      }
      assert.equal(battenVertices, 360);
    });
    await t.test('review nodes exist and every actual mesh has finite coordinates and useful normals', () => {
      const geometries = new Set(), materials = new Set(), textures = new Set(); let meshes = 0, triangles = 0;
      for (const view of Object.values(hanjingtangStudyViews)) for (const name of [...view.groups, ...(view.isolate ?? [])]) object(asset, name);
      asset.group.traverse(node => {
        if (!node.isMesh) return; meshes++; finite(node.geometry); assert.ok(node.matrixWorld.determinant() > 0); geometries.add(node.geometry);
        triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
        for (const material of [].concat(node.material)) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); }
      });
      assert.equal(meshes, asset.diagnostics.meshCount); assert.equal(triangles, asset.diagnostics.triangleCount);
      const owned = { geometries, materials, textures }, events = { geometries: 0, materials: 0, textures: 0 };
      for (const [kind, resources] of Object.entries(owned)) {
        assert.equal(resources.size, asset.diagnostics.resourceOwnership[kind]);
        for (const resource of resources) resource.addEventListener('dispose', () => events[kind]++);
      }
      asset.dispose(); assert.equal(asset.group.children.length, 0);
      for (const [kind, resources] of Object.entries(owned)) assert.equal(events[kind], resources.size);
      const first = { ...events }; asset.dispose(); assert.deepEqual(events, first);
    });
    t.diagnostic(JSON.stringify({ buildMs, ...asset.diagnostics })); asset = null;
  } finally { asset?.dispose(); }
});
