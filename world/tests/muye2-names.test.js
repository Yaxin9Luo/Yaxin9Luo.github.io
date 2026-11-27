// The page's names (src/muye2/ui/names.js): every id a thing can be known by in a run, in every form, has a name in
// both languages: never empty, never an id, never the English one on the Chinese page (user's play, 2026-11-26: an
// evolved or joined treasure showed under an English name and then a raw id in the build panel).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/muye2/sim.js';
import {wordsOf, maxOf} from '../src/muye2/ui/names.js';

const C = sim.CONTENT, UNKNOWN = '\u0000unknown';
const IDS = new Set();
for (const rows of Object.values(C)) for (const r of rows) {
  IDS.add(r.id);
  for (const f of [r.evolved, r.blessed, r.trueForm, r.skill]) if (f && f.id) IDS.add(f.id);
}
const HAN = /[㐀-鿿]/;

/** Every (kind, id, level) the page asks a name for: each row at each level and one past (its last form), and each last form by its own id. */
function asks() {
  const out = [];
  const levels = (kind, id) => { for (let l = 1; l <= maxOf(sim, kind) + 1; l++) out.push([kind, id, l]); };
  for (const r of C.treasures) { levels('treasure', r.id); if (r.evolved) out.push(['treasure', r.evolved.id, 1]); }
  for (const r of C.weapons) { levels('weapon', r.id); if (r.evolved) out.push(['weapon', r.evolved.id, 1]); }
  for (const r of C.troops) { levels('troop', r.id); if (r.blessed && r.blessed.id) out.push(['troop', r.blessed.id, 1]); }
  for (const r of C.generals) { levels('general', r.id); if (r.trueForm && r.trueForm.id) out.push(['general', r.trueForm.id, 1]); }
  for (const r of C.arts) levels('art', r.id);
  for (const r of C.formations) levels('formation', r.id);
  // a 合璧 pair: on its slip (kind merge) and in the build, where it is one treasure entry under the merge's id
  for (const r of C.merges) out.push(['merge', r.id, 1], ['treasure', r.id, maxOf(sim, 'treasure') + 1]);
  for (const r of C.spoils) out.push(['spoil', r.id, 1]);
  return out;
}

test('names: every id in CONTENT, in every form, has its own name in zh and en, never an id and never empty', () => {
  const bad = [];
  for (const lang of ['zh', 'en']) {
    const c = {sim, lang, t: {peach: ['peach', 'mend'], unknownThing: UNKNOWN}};
    for (const [kind, id, level] of asks()) {
      const w = wordsOf(c, kind, id, level), where = `${lang} ${kind} ${id} level ${level}`;
      if (!w.name || w.name === UNKNOWN) bad.push(`${where}: no name`);
      else if (IDS.has(w.name)) bad.push(`${where}: named by an id "${w.name}"`);
      else if (lang === 'zh' && !HAN.test(w.name)) bad.push(`${where}: not Chinese "${w.name}"`);
    }
  }
  assert.deepEqual(bad, []);
});

test('names: a last form is called by its own name, by its base id one past the top level and by its own id alike', () => {
  const c = {sim, lang: 'zh', t: {peach: ['桃', ''], unknownThing: UNKNOWN}}, top = k => maxOf(sim, k) + 1;
  for (const r of C.treasures) if (r.evolved) {
    assert.equal(wordsOf(c, 'treasure', r.id, top('treasure')).name, r.evolved.name.zh, r.id);
    assert.equal(wordsOf(c, 'treasure', r.evolved.id, 1).name, r.evolved.name.zh, r.evolved.id);
  }
  for (const r of C.weapons) if (r.evolved) assert.equal(wordsOf(c, 'weapon', r.evolved.id, 1).name, r.evolved.name.zh, r.evolved.id);
  for (const r of C.merges) { const w = wordsOf(c, 'treasure', r.id, top('treasure')); assert.equal(w.name, r.name.zh, r.id); assert.ok(w.merged && w.element, `${r.id}: a pair, in its first part's element`); }
  for (const r of C.generals) if (r.trueForm && r.trueForm.title) assert.equal(wordsOf(c, 'general', r.id, top('general')).name, r.trueForm.title.zh, r.id);
  assert.equal(wordsOf(c, 'treasure', 'noSuchThing', 1).name, UNKNOWN, 'an id the tables lack is never shown as itself');
});

// Both pages carry every element main.js looks up each frame (a page without `#remain` once threw on every frame,
// 2026-11-26): the finale's chip and ward, and a duel's card, phase, poise strip and fall stamp (SPEC-CAMPAIGN 1.17).
test('both campaign pages carry the markup the page reads every frame', async () => {
  const {readFile} = await import('node:fs/promises');
  for (const page of ['muye.html', 'muye-next.html']) {
    const html = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    for (const sel of ['id="remain"', 'class="bward"', 'id="duelcard"', 'class="dfig"', 'class="dname"', 'class="dseal"', 'class="bphase"', 'class="poise"', 'class="pfill"', 'class="pnote"', 'class="bfallen"'])
      assert.ok(html.includes(sel), `${page} lacks ${sel}`);
    assert.ok(/<div class="who">[^]*?class="bphase"[^]*?<\/div><canvas/.test(html), `${page}: the phase stands in the bar's top row`);
  }
});

// A duel's title card plays whole however the field goes as he lands (the lead's second joint look, 2026-11-27: with a
// join's ceremony or an offer just before 闻仲 landed, the card ran out on the wall clock unseen, in two runs of three).
test('a duel card keeps its own clock: it waits for a still field, plays over an offer, tells each moment once', async () => {
  const {newCard, startCard, stepCard, cardShowing, cardQuiet, CARD_MS, CARD_QUIET, CARD_BEATS} = await import('../src/muye2/ui/duelcard.js');
  const c = startCard(newCard()), told = [];
  const frame = (o) => told.push(...stepCard(c, {dt: 1 / 60, moved: false, offer: false, playing: true, held: false, ...o}));
  frame({});      // the frame he lands: the first moment at once
  assert.deepEqual(told, ['sweep']);
  for (let i = 0; i < 600; i++) frame({});      // ten seconds of a still field (a ceremony's hold, slow frames): the card waits
  assert.ok(cardShowing(c) && c.t === 0, 'a still field does not run the card out');
  for (let i = 0; i < 600; i++) frame({playing: false, moved: true});      // paused
  for (let i = 0; i < 600; i++) frame({held: true, moved: true});          // held for stills
  assert.equal(c.t, 0);
  for (let i = 0; i < 60; i++) frame({offer: true});      // an offer opened as he landed: the card plays over it (the offer waits)
  assert.ok(cardShowing(c) && c.t > 900 && c.t < 1100);
  while (cardShowing(c)) frame({moved: true});
  assert.deepEqual(told, CARD_BEATS.map(b => b[0]), 'every moment once, in order');
  assert.ok(cardQuiet(c), 'banners still wait just after the card');
  for (let i = 0; i < Math.ceil(CARD_QUIET / (1000 / 60)) + 2; i++) frame({moved: true});
  assert.ok(!cardQuiet(c) && !cardShowing(c), 'and then the page speaks again');
  assert.equal(CARD_MS, 2500);
  const big = startCard(newCard()); stepCard(big, {dt: 5, moved: true, offer: false, playing: true, held: false});
  assert.ok(big.t <= 100, 'one long frame does not skip the card');
});
