import test from 'node:test';
import assert from 'node:assert/strict';
import { zhengjuesiViews } from '../src/yuanmingyuan/zhengjuesi-study-views.js';
import { allZhengjuesiBuildings } from '../src/yuanmingyuan/zhengjuesi-layout.js';

test('Zhengjuesi cropped and single-building views explicitly exclude unrelated foreground halls', () => {
  const names = new Set([...allZhengjuesiBuildings.map(b => b.id), 'zhengjuesi-south-wall', 'zhengjuesi-monks-court']);
  for (const [id, view] of Object.entries(zhengjuesiViews)) {
    if (!view.groups.length) continue;
    assert.ok(view.isolate?.length, `${id} has no foreground isolation`);
    assert.ok(view.groups.every(name => view.isolate.includes(name)), `${id} loses its subject`);
    assert.ok(view.isolate.every(name => names.has(name)), `${id} has an unknown group`);
  }
  for (const id of ['wenshu', 'wenshuJoinery', 'wenshuRoof']) {
    assert.deepEqual(zhengjuesiViews[id].isolate, ['zhengjuesi-wenshuting']);
    assert.equal(zhengjuesiViews[id].isolate.includes('zhengjuesi-sanshengdian'), false);
  }
});

test('Zhengjuesi whole-court views retain the ensemble and the gate retains its flanking wall', () => {
  for (const id of ['threequarter', 'aerial']) { assert.deepEqual(zhengjuesiViews[id].groups, []); assert.equal(zhengjuesiViews[id].isolate, undefined); }
  assert.deepEqual(zhengjuesiViews.gate.isolate, ['zhengjuesi-shanmen', 'zhengjuesi-south-wall']);
  assert.deepEqual(zhengjuesiViews.zuishang.isolate, ['zhengjuesi-zuishanglou', 'zhengjuesi-west-shunshan', 'zhengjuesi-east-shunshan']);
});
