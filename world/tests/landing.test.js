import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderLanding, renderExplore, MUSEUM_URL, landingCopy, mapNodes, mapSVG, cardHTML, splitClaim} from '../src/landing/landing.js';
import {profile, publications} from '../src/content.js';
import {publicationRole} from '../src/exhibition-content.js';

const ACTIONS = new Set(['section', 'paper', 'project', 'map', 'mascot-toggle', 'start', 'travel', 'language', 'theme', 'home']);

test('landing copy is complete in both languages and the facts come from content.js', () => {
  assert.deepEqual(Object.keys(landingCopy.en).sort(), Object.keys(landingCopy.zh).sort());
  for (const lang of ['en', 'zh']) {
    const html = renderLanding(lang);
    assert.ok(html.startsWith('<section class="welcome landing'), 'Interface hides the landing via .welcome while 3D plays');
    assert.ok(html.includes('id="load-status"') && html.includes('class="intro-footer'));
    assert.ok(html.includes(splitClaim(profile.positioning[lang])[0].replace(/&/g, '&amp;')));
    assert.ok(!/undefined|\[object Object\]/.test(html));
    for (const [, action] of html.matchAll(/data-action="([^"]+)"/g)) assert.ok(ACTIONS.has(action), action);
    assert.ok(!/world-concept|castle|academy/i.test(html.replace(/data-l="[^"]*"/g, '')), 'no castle art or academy copy on the landing');
    const footer = html.slice(html.indexOf('<footer'));
    assert.ok(footer.includes('class="now"') && !/data-action|<a |elsewhere|其他入口/.test(footer), 'the status bar keeps only the Now line');
  }
});

test('the top bar explore capsule offers the 3D academy, its world map and Yuanmingyuan in both languages', () => {
  const labels = {en: ['3D Academy', 'World map', 'Yuanmingyuan'], zh: ['3D 学院', '世界地图', '圆明园']};
  for (const lang of ['en', 'zh']) {
    const html = renderExplore(lang);
    const caps = [...html.matchAll(/<(button|a) class="ec-cap[^"]*"([^>]*)>(<svg[\s\S]*?<\/svg>)<span data-i18n="(\w+)">([^<]+)<\/span>/g)];
    assert.deepEqual(caps.map(c => c[5]), labels[lang]);
    assert.deepEqual(caps.map(c => c[4]), ['academy', 'map', 'garden'], 'labels follow the Interface copy keys on language changes');
    assert.match(caps[0][2], /id="explore-button" data-action="start"/);
    assert.match(caps[1][2], /data-action="map"/);
    assert.equal(caps[2][1], 'a');
    assert.ok(caps[2][2].includes(`data-museum-entry href="${MUSEUM_URL(lang)}"`) && MUSEUM_URL(lang).endsWith(`lang=${lang}`));
    assert.ok(caps.every(c => /stroke="currentColor"/.test(c[3])), 'each capsule has its own line icon');
    for (const [, action] of html.matchAll(/data-action="([^"]+)"/g)) assert.ok(ACTIONS.has(action), action);
  }
});

test('positioning splits into a bold claim and a muted remainder', () => {
  assert.deepEqual(splitClaim('A — b c.'), ['A —', 'b c.']);
  assert.deepEqual(splitClaim('甲 —— 乙。'), ['甲 ——', '乙。']);
});

test('research map follows the profile map: three phases, AutoDesign on the curve, LongCat-2.5 as the loop', () => {
  assert.deepEqual(mapNodes.map(n => n.col), [0, 0, 0, 1, 1, 1, 2, 2]);
  const loop = mapNodes.find(n => n.lab === 'loop');
  assert.equal(loop.name, 'LongCat-2.5');
  assert.equal(mapNodes.find(n => n.id === 'ad').lab, 'br');
  for (const [W, H] of [[620, 640], [780, 700], [900, 860]]) for (const lang of ['en', 'zh']) {
    const {svg} = mapSVG(W, H, lang, {motion: false});
    assert.equal((svg.match(/class="node/g) || []).length, 8);
    const start = svg.match(/class="trk" d="M([\d.]+) ([\d.]+)/);
    assert.ok(+start[2] <= H && +start[1] >= 0, 'curve lead-in stays inside the first column');
    assert.ok(!svg.includes('animateMotion'));
  }
});

test('hover cards carry truthful credits and real links', () => {
  for (const n of mapNodes) for (const lang of ['en', 'zh']) {
    const html = cardHTML(n.id, lang);
    assert.ok(html.includes(n.name.replace(/&/g, '&amp;')) && !html.includes('undefined'));
    if (n.pub) {
      const paper = publications.find(p => p.id === n.pub);
      assert.ok(paper, n.pub);
      const role = publicationRole(paper).en.toLowerCase();
      assert.equal(n.role[0], role === 'co-author' ? 'co-author' : role, n.id);
      for (const link of paper.links.filter(l => ['Paper', 'Code'].includes(l.label.en))) assert.ok(html.includes(link.url));
    }
  }
});

test('the landing never pulls three.js: only the game entry registers published Three assets', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const landing = readFileSync(new URL('../src/landing/landing.js', import.meta.url), 'utf8');
  assert.ok(!main.includes('published-three-assets'));
  assert.ok(!/from ['"]three/.test(landing));
  assert.ok(readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').startsWith("import './published-three-assets.js';"));
});
