import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { Game } from '../src/game.js';

// Run Game's actual event binding, resize and disposal without a GPU. The media
// query stub emits a change only when its resolution match changes, as a browser
// does when a window moves between displays with equal CSS canvas dimensions.
function resizeGame(t, { quality = 'high', ratio = 1 } = {}) {
  let nativeRatio = ratio;
  const queries = [], observers = [], renderSizes = [];
  const browser = new EventTarget();
  browser.matchMedia = (media) => {
    const resolution = Number(media.match(/resolution:\s*([\d.]+)dppx/)[1]);
    const query = new EventTarget();
    query.media = media;
    query.matches = resolution === nativeRatio;
    query.handlers = new Set();
    query.addEventListener = (type, handler) => {
      assert.equal(type, 'change');
      query.handlers.add(handler);
      EventTarget.prototype.addEventListener.call(query, type, handler);
    };
    query.removeEventListener = (type, handler) => {
      query.handlers.delete(handler);
      EventTarget.prototype.removeEventListener.call(query, type, handler);
    };
    query.refresh = () => {
      const matches = resolution === nativeRatio;
      if (matches === query.matches) return;
      query.matches = matches;
      query.dispatchEvent(new Event('change'));
    };
    queries.push(query);
    return query;
  };
  class CanvasResizeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const replacements = {
    window: { value: browser },
    document: { value: new EventTarget() },
    ResizeObserver: { value: CanvasResizeObserver },
    cancelAnimationFrame: { value() {} },
    devicePixelRatio: { get: () => nativeRatio },
  };
  const previous = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, descriptor] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  const canvas = Object.assign(new EventTarget(), {
    style: { touchAction: 'pan-y' }, width: 0, height: 0,
    hasAttribute: () => false, removeAttribute() {},
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  let rendererRatio = 1;
  const game = Object.assign(Object.create(Game.prototype), {
    canvas, options: { quality }, _listeners: [], _disposed: false,
    audio: { dispose() {} },
    camera: new PerspectiveCamera(),
    renderer: {
      setPixelRatio(value) { rendererRatio = value; },
      setSize(width, height) { canvas.width = Math.floor(width * rendererRatio); canvas.height = Math.floor(height * rendererRatio); },
      dispose() {},
    },
    rendering: { resize(...size) { renderSizes.push(size); }, dispose() {} },
  });
  t.after(() => {
    game.dispose();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  game._resize();
  game._bindEvents();
  return {
    game, canvas, queries, observers, renderSizes,
    setRatio(value) {
      nativeRatio = value;
      // A newly registered query already matches; only prior queries can change.
      for (const query of [...queries]) query.refresh();
    },
  };
}

test('a DPR change refreshes the framebuffer even when ResizeObserver sees no CSS size change', t => {
  const { game, canvas, observers, renderSizes, setRatio } = resizeGame(t);
  assert.equal(observers.length, 1);
  assert.equal(observers[0].target, canvas);
  assert.deepEqual([canvas.width, canvas.height], [800, 600]);
  setRatio(2);
  assert.deepEqual([canvas.width, canvas.height], [1600, 1200]);
  assert.deepEqual(renderSizes.at(-1), [800, 600, 2]);
  assert.equal(renderSizes.length, 2, 'one media change resizes once without a CSS resize notification');
  assert.equal(game.camera.aspect, 800 / 600);
  assert.equal(game.options.quality, 'high');
});

test('DPR watching re-arms for the native display ratio while preserving the selected quality cap', t => {
  const { game, queries, renderSizes, setRatio } = resizeGame(t, { quality: 'low' });
  for (const [nativeRatio, expectedRatio] of [[2, 1.25], [3, 1.25], [1, 1], [2, 1.25]]) {
    setRatio(nativeRatio);
    assert.equal(game._dpr, expectedRatio);
    assert.equal(game.options.quality, 'low');
    assert.equal(queries.at(-1).media, `(resolution: ${nativeRatio}dppx)`);
    assert.equal(queries.at(-1).handlers.size, 1);
    assert.ok(queries.slice(0, -1).every(query => query.handlers.size === 0), 'retired queries must be detached');
  }
  assert.equal(queries.length, 5);
  assert.equal(renderSizes.length, 5, 'changes after the first display move must keep reaching _resize');
});

test('disposing removes the current DPR listener and canvas observer and prevents re-arming', t => {
  const { game, canvas, queries, observers, renderSizes, setRatio } = resizeGame(t);
  setRatio(2);
  assert.equal(queries.length, 2);
  const queuedChange = [...queries.at(-1).handlers][0];
  const resizeCount = renderSizes.length;
  game.dispose();
  assert.equal(observers[0].disconnected, true);
  assert.equal(game._listeners.length, 0);
  assert.ok(queries.every(query => query.handlers.size === 0));
  assert.equal(canvas.style.touchAction, 'pan-y');
  setRatio(3);
  queuedChange(new Event('change'));
  observers[0].callback();
  assert.equal(queries.length, 2);
  assert.equal(renderSizes.length, resizeCount);
});
