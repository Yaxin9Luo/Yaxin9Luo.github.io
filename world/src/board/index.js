// The board's entry: loads the engine, the hand lettering, the paint simulator and the scene, in that order (they
// share a few globals, as in lab/html-in-canvas/05-impasto, where this was built), and hands back a small controller.
// landing.js imports this lazily, and only where the browser can draw HTML into a canvas.

/**
 * Start the painter's board on the landing's sheets (#ground, #text, #mapl, #notes inside #stage).
 * site: landing.js's `site`; min: the smallest window the effect runs in; onMode(mode, why): 'live' | 'flat'.
 */
let sheetPaint = null;

export async function startBoard({site, min, lang = 'en', still = false, onMode} = {}) {
  window.SITE = site;
  window.__boardLang = lang;
  window.__boardStill = still;
  window.__boardMin = min;
  // The section, paper and project panels are the site's own (ui.js fills, routes and closes them). The board takes
  // the panel element as one more sheet: a sheet of paper laid over the board, drawn and lit like the others.
  const panel = document.querySelector('.grimoire');
  panel?.classList.add('sheet');
  window.SECTIONS = {
    ids: panel ? ['panel'] : [], external: true, html: () => '',
    el: () => panel, home: () => document.querySelector('.modal-backdrop'),
    onDismiss: () => document.querySelector('.grimoire .close-button')?.click(),
    paint: (P, scale) => sheetPaint ? sheetPaint(P, scale) : {},
  };
  await import('./hic.js');
  await import('./hand.js');
  if (window.HIC.supported()) {
    await import('./vendor/paintsim.js');
    await import('./vendor/paintsim.recipes.js');
    await import('./paintname.js');
    sheetPaint = (await import('./sheetpaint.js')).paint;
  }
  await import('./scene.js');
  const board = window.__board, app = board.app;
  if (app && app.options) {
    const sceneMode = app.options.onMode;
    app.options.onMode = (mode, why) => { sceneMode?.(mode, why); onMode?.(mode, why); };
  }
  return {app, lang: () => board.lang(), setLanguage: value => board.setLanguage(value), measure: () => board.measure(), sheet: (open, label, key) => board.sheet(open, label, key), markNav: () => board.markNav()};
}
