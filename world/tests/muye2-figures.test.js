// A general is never drawn as the code cartoon while the generated key figures are in use (tester 2026-11-26: 雷震子's true
// form showed the code puppet after its atlas failed to load). generalFigureKey picks his figure; KEY_FIGURES must hold a
// figure and a true form for every general the rules have, so "known" covers them all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generalFigureKey, KEY_FIGURES } from '../src/muye2/art/puppets/imagegen/figures.js';
import { CONTENT } from '../src/muye2/content.js';

const IDS = CONTENT.generals.map((g) => g.id);
const known = (k) => k in KEY_FIGURES;
const loaded = (...keys) => (k) => keys.includes(k);

test('every general has a generated figure and a generated true form', () => {
  assert.ok(IDS.length >= 10);
  for (const id of IDS) { assert.ok(KEY_FIGURES['zhou:' + id], id); assert.ok(KEY_FIGURES['zhou:' + id + '-true'], id + '-true'); }
});

test('the figure a general is drawn with, in every case of what has loaded', () => {
  for (const id of IDS) {
    const b = 'zhou:' + id, t = b + '-true', base = { kind: 'general', general: id }, tf = { ...base, trueForm: true };
    assert.equal(generalFigureKey(base, loaded(b, t), known), b);
    assert.equal(generalFigureKey(tf, loaded(b, t), known), t);
    assert.equal(generalFigureKey(tf, loaded(b), known), b, 'true form failed: his own generated figure');
    assert.equal(generalFigureKey(base, loaded(t), known), '-', 'base failed: nothing, not the cartoon');
    assert.equal(generalFigureKey(tf, loaded(), known), '-', 'nothing loaded: nothing, not the cartoon');
  }
});

test('no key figures at all (the fallback puppets): the code puppets stand in', () => {
  assert.equal(generalFigureKey({ kind: 'general', general: 'leizhenzi', trueForm: true }, null, null), '');
  assert.equal(generalFigureKey({ kind: 'general', general: 'leizhenzi' }, () => false, () => false), '');
  assert.equal(generalFigureKey({ kind: 'spears' }, () => true, known), '');
});
