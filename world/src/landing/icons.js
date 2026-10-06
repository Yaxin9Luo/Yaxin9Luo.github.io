// Line icons for the Editable Canvas landing and top bar (24px grid, currentColor).
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
export const ec = {
  pointer: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3v16l4.5-4.5 3 6.5 2.8-1.3-3-6.3H18z"/></svg>',
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  frame: s('<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>'),
  text: s('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  pen: s('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  blog: s('<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/>'),
  cv: s('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  cube: s('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>'),
  /* folded paper map: the 3D academy's travel map */
  map: s('<path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z"/><path d="M9 4.5v12.7M15 6.8v12.7"/>'),
  /* garden pavilion with upturned eaves: the Yuanmingyuan museum */
  pavilion: s('<path d="M12 2.4v2M2.4 7.6c.9 1.5 2.6 2 4.4 1.3 1.9-.8 3.6-2.6 5.2-4.5 1.6 1.9 3.3 3.7 5.2 4.5 1.8.7 3.5.2 4.4-1.3"/><path d="M5.4 11h13.2M7.5 11v8.2M16.5 11v8.2M4.5 19.6h15"/>'),
  sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: s('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  mail: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  scholar: s('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>'),
  gh: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
};
export const cursorArrow = '<svg viewBox="0 0 22 30" aria-hidden="true"><path d="M2 2 L2 25.3 L8.9 18.4 L14.1 29.3 L18.7 27 L13.5 16.4 L23.3 15.5 Z"/></svg>';
