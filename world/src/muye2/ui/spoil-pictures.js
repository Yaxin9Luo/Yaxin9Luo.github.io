// Paintings of the fourteen boss spoils (fx/render-spike session; contract in the shared notes, spoil-pictures.md), shown
// in the spoil's herald, the build panel, the codex and the end sheet. Each spoil (its row id in content/spoils.js) has
// art/fx/baked/spoils/<id>.webp (up to 512 px: the herald, the codex) and <id>-icon.webp (up to 96 px: the 34 px seals);
// other files in that folder (goldWhip1, stone) are field parts and are left alone. Vite
// bundles every file the glob finds as a hashed asset and hands back its URL, so the build needs no copy step and
// nothing is fetched until a picture is shown. A spoil with no painting keeps its lacquer seal with one character
// (SPOIL_SIGN in ui/campaign.js), and so does one whose painting has not loaded yet.
import {SPOIL_SIGN} from './campaign.js';

const found = import.meta.glob('../art/fx/baked/spoils/*.webp', {eager: true, query: '?url', import: 'default'});
const PICS = {}, ICONS = {};
for (const [file, url] of Object.entries(found)) {
  const name = file.slice(file.lastIndexOf('/') + 1, -5), icon = name.endsWith('-icon'), id = icon ? name.slice(0, -5) : name;
  if (SPOIL_SIGN[id]) (icon ? ICONS : PICS)[id] = url;
}

// ?spoilpics=placeholder: a stand-in painting for every spoil, to lay the page out before the paintings exist
let placeholder = false;
try { placeholder = new URLSearchParams(location.search).get('spoilpics') === 'placeholder'; } catch { placeholder = false; }
const standIn = id => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><radialGradient id="g" cx=".5" cy=".46" r=".5"><stop offset="0" stop-color="#E9D7A6"/><stop offset=".7" stop-color="#B08A3C"/><stop offset="1" stop-color="#B08A3C" stop-opacity="0"/></radialGradient></defs>` +
  `<ellipse cx="128" cy="124" rx="112" ry="104" fill="url(#g)"/><text x="128" y="160" text-anchor="middle" font-family="serif" font-size="120" font-weight="700" fill="#1B1512">${SPOIL_SIGN[id] || '?'}</text>` +
  `<text x="128" y="236" text-anchor="middle" font-family="monospace" font-size="15" fill="#1B1512" opacity=".55">placeholder</text></svg>`);

/** The painting of a spoil, or '' when there is none (then its seal is shown). */
export const spoilPic = id => PICS[id] || (placeholder ? standIn(id) : '');
/** Its small painting for a seal's place: the icon, else the large one scaled down. */
export const spoilIcon = id => ICONS[id] || spoilPic(id);
/** Ids with a painting in the build (for the report and the tests). */
export const spoilPicIds = () => Object.keys(PICS);

const warmed = new Set();
/** Fetch and decode one painting ahead of need (a boss's spoil while he fights), so his herald has it at once. */
export function warmSpoil(id) {
  const url = PICS[id]; if (!url || warmed.has(url)) return; warmed.add(url);
  const i = new Image(); i.decoding = 'async'; i.src = url; if (i.decode) i.decode().catch(() => {});
}

/** A spoil's mark: its painting over its seal. The seal shows until the painting has loaded, and stays if it fails. */
export function spoilMarkHTML(id, esc = s => s, small = true) {
  const url = small ? spoilIcon(id) : spoilPic(id), sign = esc(SPOIL_SIGN[id] || '');
  return url ? `<span class="spic-seal">${sign}</span><img class="spic" src="${esc(url)}" alt="" decoding="async" onload="this.parentNode.classList.add('has-pic')" onerror="this.remove()">` : sign;
}
