// The sample bank: every sound rendered once, ahead of play.
//   - In the game, the list is rendered in a worker as soon as the page loads, long before the first gesture, so the
//     first stretch opens on ready buffers and no frame waits on a render.
//   - Where there is no worker (an older browser, a page opened from disk), it renders on the page in slices of a few
//     milliseconds between frames.
//   - An offline render (the listening page's measurements) renders on demand, at once: it has no frames to keep.
// A sound asked for before it is ready is dropped, not rendered on the spot, and counted in `late` (it should stay 0).
import {render, hall, hallBig, keyOf, RATE, rateOf} from './instruments.js';

export function createBank({sync = false} = {}) {
  const raw = new Map(), bufs = new Map(), asked = new Set(), stats = {rendered: 0, renderMs: 0, late: 0, samples: 0, worker: false, ready: false, extra: []};      // extra: keys a sync bank rendered on demand, never listed ahead
  let room = null, roomBig = null, pending = 0, worker = null, queue = [], slicing = false, readyHook = null;
  const take = (key, x) => { if (!raw.has(key) && !bufs.has(key)) { raw.set(key, x); stats.rendered++; stats.samples += x.length; } };
  function renderNow(key, name, arg) { const t0 = performance.now(), x = render(name, arg); stats.renderMs += performance.now() - t0; take(key, x); }
  function finish() { if (pending === 0 && !queue.length && room) { stats.ready = true; if (readyHook) readyHook(); } }
  function slice() {
    const t0 = performance.now();
    if (!room) { room = hall(RATE); roomBig = hallBig(RATE); }
    while (queue.length && performance.now() - t0 < 6) { const [key, name, arg] = queue.shift(); renderNow(key, name, arg); }
    if (queue.length) setTimeout(slice, 16); else { slicing = false; finish(); }
  }
  function startWorker() {
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
      worker.onmessage = ({data}) => {
        if (data.hall) { room = data.hall.slice(0, 2); roomBig = data.hall.slice(2); }
        else if (data.key && data.x) take(data.key, data.x);
        else if (data.done !== undefined) { pending--; finish(); }
      };
      worker.onerror = () => { worker = null; stats.worker = false; queue = [...asked].map(k => [k, ...unkey.get(k)]).filter(([k]) => !raw.has(k) && !bufs.has(k)); pending = 0; if (!slicing) { slicing = true; setTimeout(slice, 0); } };
      stats.worker = true; return true;
    } catch { worker = null; return false; }
  }
  const unkey = new Map();
  const api = {
    stats,
    get room() { return room; }, get roomBig() { return roomBig; },
    set onReady(f) { readyHook = f; if (stats.ready) f(); },
    has: key => raw.has(key) || bufs.has(key),
    /** Asks for a list of [name, arg]. Renders them ahead (worker or slices), or at once when sync. */
    want(list) {
      const fresh = [];
      for (const [name, arg] of list) { const key = keyOf(name, arg); if (asked.has(key)) continue; asked.add(key); unkey.set(key, [name, arg]); fresh.push([key, name, arg]); }
      if (sync) { if (!room) { room = hall(RATE); roomBig = hallBig(RATE); } for (const [key, name, arg] of fresh) renderNow(key, name, arg); stats.ready = true; return; }
      if (!fresh.length && room) return;
      stats.ready = false;
      if (worker || (typeof Worker === 'function' && startWorker())) {
        pending++; try { worker.postMessage({list: fresh, hall: !room, batch: pending}); return; } catch { pending--; worker = null; stats.worker = false; }
      }
      queue.push(...fresh); if (!slicing) { slicing = true; setTimeout(slice, 0); }
    },
    /** Drops sounds no longer needed (a duel's, after his fall): they can be asked for again. Sources still playing
        keep their own buffers until they end. */
    free(keys) {
      for (const key of keys) {
        const b = bufs.get(key), x = raw.get(key); if (b) stats.samples -= b.length; else if (x) stats.samples -= x.length;
        if (b || x) stats.rendered--; bufs.delete(key); raw.delete(key); asked.delete(key);
      }
    },
    /** The AudioBuffer for a sound in this context, or null if it is not rendered yet (then it is asked for, and counted late). */
    get(ctx, name, arg) {
      const key = keyOf(name, arg); let b = bufs.get(key); if (b) return b;
      let x = raw.get(key);
      if (!x) {
        if (sync) { renderNow(key, name, arg); x = raw.get(key); if (asked.size) stats.extra.push(key); }
        else { stats.late++; if (!asked.has(key)) api.want([[name, arg]]); return null; }
      }
      b = ctx.createBuffer(1, x.length, rateOf(name)); b.copyToChannel(x, 0); bufs.set(key, b); raw.delete(key);      // one copy kept: the AudioBuffer's
      return b;
    },
  };
  return api;
}
