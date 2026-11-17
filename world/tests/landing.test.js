import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderLanding, renderExplore, MUSEUM_URL, landingCopy, mapNodes, mapSVG, COMPACT_MAP, cardHTML, splitClaim, site, BOARD_MIN} from '../src/landing/landing.js';
import {parseContentRoute} from '../src/exhibition-state.js';
import {PHASES as phases} from '../src/blog/taxonomy.js';
import {profile, publications} from '../src/content.js';
import {publicationRole} from '../src/exhibition-content.js';
import {renderJournal, renderPaperDetail} from '../src/journal.js';
import {mapPhases, opensExploded, enterHintHTML} from '../src/landing/landing.js';
import {selectedPublications} from '../src/content.js';
import {WORKS} from '../src/blog/taxonomy.js';

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
    const body = html.replace(/<header class="top">[\s\S]*?<\/header>/, '');
    assert.ok(body.length < html.length && !/world-concept|castle|academy/i.test(body), 'no castle art or academy copy on the landing: the academy is only a link in its top bar');
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

test('a narrow map stacks the phases and runs the curve down a lane clear of every word', () => {
  for (const W of [308, 338, 450, COMPACT_MAP - 1]) for (const lang of ['en', 'zh']) {
    const {svg, h} = mapSVG(W, 0, lang, {motion: false});
    assert.ok(svg.includes('class="compact"') && h > 600 && svg.includes(`viewBox="0 0 ${W} ${h}"`), 'the compact map sets its own height');
    assert.equal((svg.match(/class="node/g) || []).length, 8);
    assert.equal((svg.match(/class="phase"/g) || []).length, 3);
    const words = [...svg.matchAll(/<text class="(?:num|yr|ph|phs|nm[^"]*|vn)" x="([\d.]+)"/g)].map(m => +m[1]);
    const lane = [...svg.matchAll(/<circle class="(?:o|orbit)" cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)"/g)].map(m => +m[1] + +m[2]);
    assert.ok(Math.min(...words) >= Math.max(...lane) + 8, 'names and headers start past the lane');
    const curve = svg.match(/class="crv" d="M([\d.]+) ([\d.]+)/);
    assert.ok(+curve[2] > 0 && +curve[1] < Math.min(...words), 'the curve starts inside the first band, in the lane');
    assert.ok(!svg.includes('animateMotion'));
  }
  assert.ok(!mapSVG(COMPACT_MAP, 600, 'en').svg.includes('class="compact"'), 'from COMPACT_MAP up, the three columns');
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

test('the board is one page in two renderings: four sheets of real HTML that the plain page shows as they are', () => {
  for (const lang of ['en', 'zh']) {
    const html = renderLanding(lang);
    assert.ok(html.startsWith('<section class="welcome landing board"'));
    assert.deepEqual([...html.matchAll(/<div class="layer[^"]*" id="(\w+)"/g)].map(m => m[1]), ['text', 'mapl', 'ground', 'notes'], 'text, study sheet, ground and annotations');
    assert.equal((html.match(/<h1 class="name"/g) || []).length, 1, 'one real heading for selection, search and screen readers');
    assert.ok(html.includes(lang === 'zh' ? '<h1 class="name" lang="zh-CN">罗亚鑫</h1>' : '<h1 class="name">Yaxin Luo</h1>'), 'the Chinese hero name is 罗亚鑫 alone');
    assert.equal((html.match(/class="btn/g) || []).length, 4, 'four calls to action');
    assert.ok(/<div class="layer" id="notes" aria-hidden="true">/.test(html) && html.includes('>Designer<') && html.includes('>Critic<'), 'the brush and the pencil are decoration');
    assert.ok(!/ec-rx|ec-insp|ec-cur|Text · H1/.test(html), 'the editable-canvas chrome is gone');
    assert.ok(html.includes(site.top(lang)) && html.includes(site.hero(lang)) && html.includes(site.mapWindow(lang)) && html.includes(site.status(lang)), 'the board draws the same pieces');
  }
  assert.ok(BOARD_MIN.width >= 1200 && BOARD_MIN.height >= 560);
});

test('the board\'s top bar opens the site\'s own sections, places and switches', () => {
  for (const lang of ['en', 'zh']) {
    const top = site.top(lang), t = landingCopy[lang];
    const sections = [...top.matchAll(/<a href="#section\/(\w+)" data-action="section" data-id="(\w+)">([^<]+)<\/a>/g)];
    assert.deepEqual(sections.map(m => m[1]), ['about', 'research', 'publications', 'projects']);
    for (const [, id, dataId, label] of sections) {
      assert.equal(id, dataId);
      assert.deepEqual(parseContentRoute('#section/' + id), {kind: 'section', id}, 'each link is a real route');
      assert.equal(label, t.nav[id]);
    }
    assert.ok(top.includes('href="/blog/') && /files\/CV_YaxinLuo(_zh)?\.pdf/.test(top));
    assert.equal((top.match(/data-action="language"/g) || []).length, 2);
    assert.ok(top.includes(`aria-pressed="${lang === 'zh'}" lang="zh-CN"`));
    assert.ok(top.includes('data-action="theme"') && top.includes('data-action="mascot-toggle"'));
    assert.ok(top.includes('data-action="start"') && top.includes('data-action="map"') && top.includes(`data-museum-entry href="${MUSEUM_URL(lang)}"`));
  }
});

test('phases that are still running say so, on the map and in the blog', () => {
  const years = lang => [...mapSVG(900, 700, lang, {motion: false}).svg.matchAll(/<text class="yr"[^>]*>([^<]+)</g)].map(m => m[1]);
  assert.deepEqual(years('en'), ['2024–25', '2025 → present', '2026 → present']);
  assert.deepEqual(years('zh'), ['2024–25', '2025 → 至今', '2026 → 至今']);
  assert.equal(phases.eval.years, '2025 → present');
  assert.equal(phases['post-training'].years, '2026 → present');
  assert.ok(!mapNodes.some(n => /llmsurgeon/i.test(n.id + (n.pub || '') + n.name)), 'LLMSurgeon stays off the research map');
});

test('the map hands the board its geometry: node centres in curve order and the loop', () => {
  for (const [W, H] of [[620, 640], [400, 0]]) {
    const map = mapSVG(W, H, 'en', {motion: false});
    assert.deepEqual(map.pts.map(p => p[2]), [...mapNodes.filter(n => n.lab !== 'loop').map(n => n.id), 'lc']);
    assert.ok(map.pts.every(p => p[0] >= 0 && p[0] <= W && p[1] > 0) && map.loop.R > 0 && map.curve.length >= 7);
  }
});

test('the sheets get their painted pieces as extra, class-scoped markup the 3D panels hide', () => {
  const css = readFileSync(new URL('../src/board/board.css', import.meta.url), 'utf8');
  assert.match(css, /\.sheet-dab,\.sheet-phases,\.sheet-mix\{display:none\}/);     // hidden unless the landing shows them
  for (const lang of ['en', 'zh']) {
    // Publications: one dab per paper, in the colour of its phase on the map (a ring when it is off the map)
    const pubs = renderJournal('publications', lang), code = {multimodal: 'mm', eval: 'ev', 'post-training': 'pt'};
    for (const paper of selectedPublications) {
      const phase = WORKS[paper.id]?.phase;
      assert.ok(pubs.includes(`id="paper-${paper.id}"><i class="sheet-dab sheet-dab-${phase ? code[phase] : 'off'}"`), `${paper.id} dab`);
    }
    assert.equal((pubs.match(/class="sheet-dab /g) || []).length, selectedPublications.length);
    assert.match(pubs, /<details class="paper-authors"><summary>/);                 // authors stay collapsed behind a toggle
    assert.match(renderPaperDetail('autodesign', lang), /<strong>Yaxin Luo<\/strong>/);
    // Research: three washes with the map's phases and works, then model and harness as two mixed dabs
    const research = renderJournal('research', lang);
    assert.equal((research.match(/class="sheet-phase sheet-phase-\d"/g) || []).length, 3);
    mapPhases[lang].forEach(phase => { assert.ok(research.includes(`<b>${phase[0]}</b>${phase[1]}`)); assert.ok(research.includes(`<h3>${phase[2]}</h3>`)); });
    for (const node of mapNodes) assert.ok(research.includes(`class="sheet-node-link"${node.pub ? ` data-action="paper" data-id="${node.pub}"` : node.project ? ` data-action="project" data-id="${node.project}"` : ''}>${node.name}<`), `${node.id} in its wash`);
    assert.match(research, /class="journal-research-opening"><div class="sheet-mix" role="img" aria-label="[^"]+">/);
    assert.ok(research.includes('class="sheet-mix-model"') && research.includes('class="sheet-mix-harness"'));
    // About / Experience: the entry that runs to the present is marked for the orange dab
    for (const section of ['about', 'journey']) assert.match(renderJournal(section, lang), /journal-timeline-item journal-timeline-now"/);
    // Projects: the prints use the real project images; the first one is the wide one
    const projects = renderJournal('projects', lang);
    assert.match(projects, /class="folio-project folio-project-featured"><button type="button" class="folio-image" data-action="project" data-id="autodesign"[^>]*><img src="[^"]+"/);
  }
});

test('the board opens as its stack of sheets only on a fresh, unrouted, moving page', () => {
  assert.equal(opensExploded(), true);
  assert.equal(opensExploded({navigation: 'reload', entered: true}), true);           // a fresh load replays it
  assert.equal(opensExploded({navigation: 'navigate', entered: true}), true);
  assert.equal(opensExploded({navigation: 'back_forward', entered: true}), false);    // history back to an entered page does not
  assert.equal(opensExploded({navigation: 'back_forward', entered: false}), true);
  assert.equal(opensExploded({effects: false}), false);                               // ?fx=off, or no HTML-in-Canvas
  assert.equal(opensExploded({reducedMotion: true}), false);
  assert.equal(opensExploded({reading: true}), false);
  for (const hash of ['#section/research', '#paper/autodesign', '#project/figmirror', '#map']) assert.equal(opensExploded({hash}), false, hash);
  for (const hash of ['', '#', '#stats', '#still']) assert.equal(opensExploded({hash}), true, hash || '(none)');
});

test('the opening hint, the layers label and the scrape control are in the page in both languages', () => {
  for (const lang of ['en', 'zh']) {
    const t = landingCopy[lang], html = renderLanding(lang);
    const hint = enterHintHTML(lang);
    assert.ok(html.includes(hint));
    assert.match(hint, /^<button class="enter-hint" type="button" tabindex="-1">/);
    for (const key of ['enterHold', 'enterKey', 'enterOr', 'enterDo', 'layersHint']) assert.ok(hint.includes(t[key]), key);
    assert.match(html, new RegExp(`<button class="xbtn" type="button" aria-pressed="false" data-tip="${t.layersTip}">`));
    assert.match(html, /<button class="xbtn scrape" type="button" title="[^"]+">/);
    assert.match(html, /<button class="xbtn save" type="button"/);
  }
  assert.equal(landingCopy.zh.enterHold + landingCopy.zh.enterKey, '按住空格');
});

test('the top bar carries the peony crest as its mark, linked home, and the nav stays real links', () => {
  for (const lang of ['en', 'zh']) {
    const html = renderLanding(lang);
    assert.match(html, /<a class="brand" href="#" data-action="home" aria-label="[^"]+"><svg class="crest" viewBox="0 0 100 100" aria-hidden="true">/);
    assert.equal((html.match(/class="crest"/g) || []).length, 1);
    assert.ok(!/class="seal"/.test(html));
    assert.match(html, /<nav class="nav" aria-label="[^"]+"><a href="#section\/about" data-action="section" data-id="about">/);
  }
});

test('the study sheet carries its pencil apparatus: baseline, year ticks, construction lines and a note', () => {
  for (const lang of ['en', 'zh']) {
    const svg = mapSVG(640, 640, lang, {motion: false}), html = typeof svg === 'string' ? svg : svg.html || svg.svg || JSON.stringify(svg);
    assert.match(html, /<g class="study" aria-hidden="true"><path class="rule"/);
    assert.equal((html.match(/class="cons"/g) || []).length, 2);
    for (const year of ['2024', '2025', '2026 →']) assert.ok(html.includes(`>${year}</text>`), year);
    assert.match(html, /<text class="note"[^>]*>[^<]{8,}<\/text>/);
    assert.ok(!/class="thumb"/.test(html), 'no pencil thumbnails on the sheet: the diagrams are in the hover cards');
    assert.match(html, /<path class="ext" d="M[^"]+"\/>/, 'the dotted continuation past the loop');
    assert.ok(html.includes(lang === 'zh' ? '>进行中</text>' : '>in progress</text>'), 'its note');
    assert.equal((html.match(/class="node"/g) || []).length, mapNodes.length - 1);      // every node is still there (the loop has its own class)
  }
});
