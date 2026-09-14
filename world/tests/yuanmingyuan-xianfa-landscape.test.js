// Full factories: run only during the exclusive CPU slot assigned by ROOT.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createXianfashanStudy, createFangheXianfahuaStudy, createXianfaqiaoStudy } from '../src/yuanmingyuan/xianfa-landscape-study.js';
import { HILL, spiralOffset, SCREEN_LAYOUT } from '../src/yuanmingyuan/xianfa-landscape-layout.js';
import { BRIDGE } from '../src/yuanmingyuan/xianfa-landscape-geometry.js';
import { xianfashanStudyViews, fangheXianfahuaStudyViews, xianfaqiaoStudyViews } from '../src/yuanmingyuan/xianfa-landscape-views.js';
import { object, ray, localRay, category, near, resources, assertOwnedAsset, assertViewsResolve, assertInstanceReplacement } from './yuanmingyuan-garden-study-checks.js';

test('Xianfashan production: independent gateways, supported winding path and four pavilion portals', async t => {
  const {readXianfashanTexturePixels}=await import('../scripts/prepare-xianfashan-texture-pixels.mjs'),texturePixels=await readXianfashanTexturePixels();
  const create=()=>createXianfashanStudy({texturePixels}),a=create();
  try {
    assertOwnedAsset(a, t); assertViewsResolve(a, xianfashanStudyViews);
    const deck = object(a, 'xianfashan-winding-stone-deck'), hill = object(a, 'xianfashan-complete-earth-mound'), route = object(a, 'xianfashan-continuous-winding-route');
    for (let i = 1; i < 72; i++) for (const offset of [-.47, 0, .47]) {
      const p = spiralOffset(i / 72, offset), top = ray([p[0], p[1] + .5, p[2]], [0, -1, 0], deck)[0]; near(top?.point.y, p[1], 'actual ramp face', .022);
      const ground = ray([p[0], p[1] + .2, p[2]], [0, -1, 0], hill)[0]; assert.ok(ground); near(ground.point.y, p[1] - HILL.pathThickness, 'tessellated mound supports ramp', .065);
      assert.equal(ray([p[0], p[1] + 1.6, p[2]], [0, -1, 0], route, 1.25).length, 0, 'body clearance above central 0.94 m strip');
    }
    const pavilion = object(a, 'xianfashan-summit-pavilion');
    for (const sign of [-1, 1]) for (const offset of [-.43, 0, .43]) {
      assert.equal(ray([sign * 4.5, HILL.summitFloor + 1.65, offset], [-sign, 0, 0], pavilion, 9).length, 0, 'east-west doorway connection');
      assert.equal(ray([offset, HILL.summitFloor + 1.65, sign * 4.5], [0, 0, -sign], pavilion, 9).length, 0, 'north-south doorway connection');
    }
    for (const id of ['xianfashan-west-gate', 'xianfashan-east-gate']) for (const x of [-4.48, 0, 4.48]) for (const y of [.30, 1.65, 2.2]) assert.equal(localRay([x, y, 1.5], [0, 0, -1], object(a, id), 3).length, 0);
    assert.deepEqual(a.diagnostics.replacesTerrainLandformIds, ['xianfa-hill']); assert.equal(a.group.getObjectByName('xianfaqiao-five-opening-sluice'), undefined);
    assert.equal(a.diagnostics.visualAcceptance, false); assertInstanceReplacement(a, create);
  } finally { a.dispose(); }
});

test('Fanghe Xianfahua production: water contact and shallow scenic wings remain independently reviewable', t => {
  const a = createFangheXianfahuaStudy();
  try {
    assertOwnedAsset(a, t); assertViewsResolve(a, fangheXianfahuaStudyViews);
    assert.equal(a.diagnostics.scenery.volumetricCityBuildings, 0); assert.equal(a.diagnostics.scenery.pairedWings, 12); assert.equal(a.diagnostics.museumEntryId, 'fanghe-xianfahua');
    const water = object(a, 'xianfahua-fanghe-basin'), paving = object(a, 'xianfahua-bank-paving');
    for (const x of [-150, -70, -14]) for (const z of [-12, 0, 12]) {
      assert.equal(ray([x, 2, z], [0, -1, 0], paving).length, 0);
      const hits = ray([x, 2, z], [0, -1, 0], water); near(hits.find(h => category(h) === 'water')?.point.y, -.30, 'single basin surface'); near(hits.find(h => category(h) === 'stone')?.point.y, -1.10, 'submerged floor');
    }
    for (const [x, direction] of [[SCREEN_LAYOUT.water.x0, 1], [SCREEN_LAYOUT.water.x1, -1]]) {
      const hits = ray([x + direction * 4.18, 2, 0], [0, -1, 0], water);
      near(hits.find(h => category(h) === 'water')?.point.y, -.30, 'landing water'); near(hits.find(h => category(h) === 'stone')?.point.y, -.306, 'lowest wet tread', .001);
    }
    const scenery = object(a, 'xianfahua-shallow-perspective-scenery');
    assert.equal(ray([-3, 1.65, 0], [1, 0, 0], scenery, 49).length, 0, 'clear central backstage lane ends at backdrop, not a fake city');
    assert.ok(ray([45, 1.65, 0], [1, 0, 0], scenery, 10).length > 0, 'solid terminal backdrop');
    for (const side of ['north', 'south']) {
      const wing = object(a, `xianfahua-wing-${side}-1`); assert.equal(localRay([0, 1.6, 2], [0, 0, -1], wing, 4).length, 0);
      assert.ok(localRay([3.7, 1.6, -2], [0, 0, 1], wing, 4).some(h => category(h) === 'masonry'), 'unpainted physical wall back');
    }
    const surface = [...resources(a.group).materials].find(m => m.userData.role === 'surface'), previous = surface.normalMap.offset.clone(); a.update(3.25); assert.notDeepEqual(surface.normalMap.offset, previous); a.update(0);
    assertInstanceReplacement(a, createFangheXianfahuaStudy);
  } finally { a.dispose(); }
});

test('Xianfaqiao production: five sluice waterways, real gate clearance and no false garden registration', t => {
  const a = createXianfaqiaoStudy();
  try {
    assertOwnedAsset(a, t); assertViewsResolve(a, xianfaqiaoStudyViews);
    assert.equal(a.diagnostics.groupId, null); assert.equal(a.diagnostics.museumEntryId, null); assert.equal(a.diagnostics.navigation.sluiceOpenings, 5);
    const sluice = object(a, 'xianfaqiao-five-opening-sluice');
    for (const x of BRIDGE.pierX) assert.equal(ray([x, -.5, 5], [0, 0, -1], sluice, 10).length, 0, 'five unblocked sluice apertures');
    for (const x of [-.43, 0, .43]) for (const y of [1.65, 2.9, 3.5]) assert.equal(ray([x, y, 5], [0, 0, -1], a.group, 10).length, 0, 'central through-door');
    near(ray([0, 3, 1.45], [0, -1, 0], sluice)[0]?.point.y, BRIDGE.deckY, 'doorway deck');
    for (const x of BRIDGE.pierX) {
      const hits = ray([x, .10, 0], [0, -1, 0], object(a, 'xianfaqiao-study-water-channel'));
      near(hits.find(h => category(h) === 'water')?.point.y, BRIDGE.waterY, 'water through arch'); near(hits.find(h => category(h) === 'stone')?.point.y, -1.70, 'channel bed');
    }
    assert.equal(a.diagnostics.visualAcceptance, false); assert.equal(a.diagnostics.integrationAcceptance, false); assertInstanceReplacement(a, createXianfaqiaoStudy);
  } finally { a.dispose(); }
});
