// Widget kit: theme sync with the blog, frame autosize, reveal-on-view, a play/scrub loop, tooltips, tiny SVG helpers.
(function () {
  const KEY = 'yaxin.grimoire.preferences', root = document.documentElement;
  const dark = () => {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* storage blocked: follow the system */ }
    return p.theme === 'dark' || (p.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const hooks = [];
  const applyTheme = () => { if (dark()) root.dataset.theme = 'dark'; else delete root.dataset.theme; hooks.forEach(f => f()); };
  applyTheme();
  addEventListener('storage', e => { if (e.key === KEY) applyTheme(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The post's frame follows this page's height.
  // Measure the content, not the document: a document is never shorter than its frame, so measuring it would only
  // ever let the frame grow.
  const report = () => { if (parent !== window) parent.postMessage({type: 'embed-height', height: Math.ceil(document.body.getBoundingClientRect().height)}, location.origin); };
  addEventListener('load', () => { new ResizeObserver(report).observe(document.body); report(); });

  const css = name => getComputedStyle(root).getPropertyValue(name).trim();
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const fmt = (v, d = 3, sign = false) => (sign && v >= 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const el = (tag, attrs = {}, html = '') => { const n = document.createElement(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); n.innerHTML = html; return n; };

  // Reveal elements with .reveal when they first scroll into view, and call `onView` callbacks once.
  const seen = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('on'); seen.unobserve(e.target);
    (e.target._onView || []).forEach(f => f());
  }), {threshold: 0.25});
  const onView = (node, f) => { (node._onView = node._onView || []).push(f); seen.observe(node); };
  addEventListener('load', () => document.querySelectorAll('.reveal').forEach(n => seen.observe(n)));

  // A time loop: t runs 0..1 over `seconds`; render(t) on every frame; reduced motion jumps to the end.
  function player({seconds = 2.4, render, onEnd}) {
    let t = 0, playing = false, last = 0, raf = 0;
    const frame = now => {
      if (!playing) return;
      t = Math.min(1, t + (now - last) / 1000 / seconds); last = now; render(t);
      if (t >= 1) { playing = false; onEnd && onEnd(); return; }
      raf = requestAnimationFrame(frame);
    };
    return {
      get t() { return t; }, get playing() { return playing; },
      set(v) { t = Math.max(0, Math.min(1, v)); render(t); },
      play() { if (reduced) { this.set(1); onEnd && onEnd(); return; } if (t >= 1) t = 0; playing = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      pause() { playing = false; cancelAnimationFrame(raf); },
    };
  }

  const ICON = {
    play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
    reset: '<svg viewBox="0 0 16 16"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.5h2.5"/></svg>',
  };

  // Tooltip shared by every widget.
  const tipNode = el('div', {class: 'tip', role: 'status'});
  addEventListener('DOMContentLoaded', () => document.body.appendChild(tipNode));
  const tip = {
    show(html, e) { tipNode.innerHTML = html; tipNode.style.opacity = 1; this.move(e); },
    move(e) { const x = Math.min(e.clientX + 14, innerWidth - tipNode.offsetWidth - 8); tipNode.style.left = x + 'px'; tipNode.style.top = (e.clientY + 14) + 'px'; },
    hide() { tipNode.style.opacity = 0; },
  };

  // An SVG drawn in its own pixels: the viewBox is as wide as the element (within lo..hi), so text keeps its size on a phone.
  const fit = (svg, h, lo = 300, hi = 640) => {
    const w = Math.round(Math.max(lo, Math.min(hi, svg.getBoundingClientRect().width || hi)));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); return w;
  };
  window.kit = {css, lerp, ease, fmt, el, onView, player, ICON, tip, reduced, fit, onTheme: f => hooks.push(f), report};
})();
