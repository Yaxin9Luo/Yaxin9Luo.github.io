import test from 'node:test';
import assert from 'node:assert/strict';
import { haiyueEntries, haiyueMuseumSources } from '../src/yuanmingyuan/haiyue-museum-content.js';
import { haiyueMuseumImages } from '../src/yuanmingyuan/haiyue-museum-images.js';
test('Haiyue has a replaceable bilingual main entry and three linked period/building/water entries', () => {
  assert.equal(haiyueEntries.length, 4); const ids = new Set(haiyueEntries.map(e => e.id)); assert.equal(ids.size, 4);
  for (const entry of haiyueEntries) {
    for (const record of [entry.title, entry.lead, entry.sign, ...(entry.paragraphs ?? []), entry.note].filter(Boolean)) { assert.ok(record.zh?.length > 0); assert.ok(record.en?.length > 0); }
    for (const id of entry.related) assert.ok(ids.has(id)); for (const source of entry.sources) assert.ok(haiyueMuseumSources[source]);
    for (const id of entry.images) { const image=haiyueMuseumImages[id]; assert.ok(image); assert.equal(image.kind,'reconstruction-render'); assert.equal(image.notHistoricalEvidence,true); assert.ok(image.caption.zh&&image.caption.en); }
  }
  assert.ok(ids.has('haiyue-water-approach')); assert.ok(ids.has('haiyue-periods'));
});
test('Haiyue institutional sources have English titles and do not imply redistributed image rights', () => {
  for (const source of Object.values(haiyueMuseumSources)) { assert.ok(source.title.zh && source.title.en); assert.notEqual(source.title.zh, source.title.en); assert.equal(new URL(source.url).hostname, 'www.yuanmingyuanpark.cn'); assert.equal(source.publicImagesBundled, false); }
  const period = haiyueEntries.find(e => e.id === 'haiyue-periods'); assert.ok(period.note.en.includes('hypothesis'));
});
