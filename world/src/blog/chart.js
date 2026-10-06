// Small charts for posts, written as ```chart blocks holding JSON:
// {"type":"line"|"bar","title":"…","x":[…],"series":[{"name":"…","values":[…]}],"y":{"label":"…","unit":"%","min":0,"max":100},"caption":"…"}
// The build draws a static SVG plus the same numbers as a table; enhance.js adds the hover read-out.
// Colors are CSS variables (--rd-series-1…4), validated for both themes: light #4F46E5 #E4572E #0E9F6E #B7791F,
// dark #7B74F2 #E8663D #1FA97A #BB881A. Series keep their slot, so one entity keeps one color.
import {esc} from './text.js';

export const MAX_SERIES = 4;

export function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('Chart spec must be a JSON object');
  if (!['line', 'bar'].includes(spec.type)) throw new Error('Chart type must be "line" or "bar"');
  if (!Array.isArray(spec.x) || !spec.x.length) throw new Error('Chart needs a non-empty "x" array');
  if (!Array.isArray(spec.series) || !spec.series.length) throw new Error('Chart needs at least one series');
  if (spec.series.length > MAX_SERIES) throw new Error(`Charts show at most ${MAX_SERIES} series`);
  for (const s of spec.series) {
    if (!s.name) throw new Error('Every series needs a name');
    if (!Array.isArray(s.values) || s.values.length !== spec.x.length) throw new Error(`Series "${s.name}" needs one value per x label`);
    if (s.values.some(v => v !== null && !Number.isFinite(v))) throw new Error(`Series "${s.name}" has a non-numeric value`);
  }
  return spec;
}

// Clean axis ticks: steps of 1, 2, 2.5 or 5 × 10ⁿ covering [min, max].
export function niceTicks(min, max, count = 5) {
  if (min === max) max = min + 1;
  const raw = (max - min) / Math.max(1, count), power = 10 ** Math.floor(Math.log10(raw)), scaled = raw / power;
  const step = (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10) * power;
  const start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step, ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export function formatValue(v, unit = '') {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  const text = abs >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : abs >= 1e4 ? `${+(v / 1e3).toFixed(1)}K` : Number.isInteger(v) ? v.toLocaleString('en-US') : (+v.toFixed(2)).toLocaleString('en-US');
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text;
}

const f1 = n => +n.toFixed(1);
const color = i => `var(--rd-series-${i + 1})`;

/** Static SVG of a validated spec, in a 640-wide coordinate system that scales with the column. */
export function chartSVG(spec, {lang = 'en'} = {}) {
  const unit = spec.y?.unit || '', n = spec.x.length, line = spec.type === 'line';
  const values = spec.series.flatMap(s => s.values).filter(v => v !== null);
  const ticks = niceTicks(spec.y?.min ?? Math.min(0, ...values), spec.y?.max ?? Math.max(...values), 4), y0 = ticks[0], y1 = ticks.at(-1);
  const W = 640, H = line ? 270 : 250;
  const labW = line ? Math.min(170, 22 + Math.max(...spec.series.map(s => s.name.length)) * (lang === 'zh' ? 13 : 7.1)) : 0;
  const m = {t: 12, r: 12 + labW, b: 32, l: 14 + Math.max(...ticks.map(v => formatValue(v, unit).length)) * 7.2};
  const w = W - m.l - m.r, h = H - m.t - m.b, ys = v => m.t + h - (v - y0) / (y1 - y0) * h;
  const band = w / n, X = i => line ? m.l + (n === 1 ? w / 2 : i * w / (n - 1)) : m.l + band * i + band / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${esc(spec.title || 'Chart')}. ${lang === 'zh' ? '用方向键读取数值，数据按钮显示表格。' : 'Use the arrow keys to read values; the Data button shows the table.'}"><g class="grid">`;
  for (const v of ticks) s += `<line x1="${f1(m.l)}" x2="${f1(m.l + w)}" y1="${f1(ys(v))}" y2="${f1(ys(v))}"${v === y0 ? ' class="base"' : ''}/><text x="${f1(m.l - 8)}" y="${f1(ys(v) + 4)}" text-anchor="end">${esc(formatValue(v, unit))}</text>`;
  const every = Math.ceil(n / 9);
  spec.x.forEach((x, i) => { if (i % every && i !== n - 1) return; s += `<text class="xl" x="${f1(X(i))}" y="${H - 10}" text-anchor="middle">${esc(x)}</text>`; });
  s += '</g><g class="marks">';
  if (line) {
    spec.series.forEach((ser, si) => {
      let d = '', pen = false;
      ser.values.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${f1(X(i))},${f1(ys(v))}`; pen = true; });
      const last = ser.values.findLastIndex(v => v !== null);
      s += `<path class="s-line" d="${d}" style="stroke:${color(si)}"/><circle class="s-end" cx="${f1(X(last))}" cy="${f1(ys(ser.values[last]))}" r="4.5" style="fill:${color(si)}"/>`;
    });
    // Direct labels at the right end (name + last value), nudged apart when the lines end close together.
    const ends = spec.series.map((ser, si) => ({ser, si, y: ys(ser.values[ser.values.findLastIndex(v => v !== null)])})).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 34) ends[i].y = ends[i - 1].y + 34;
    for (const {ser, y} of ends) {
      const x = f1(X(n - 1) + 14), v = ser.values[ser.values.findLastIndex(q => q !== null)];
      s += `<text class="s-lbl" x="${x}" y="${f1(y - 2)}">${esc(ser.name)}<tspan class="v" x="${x}" dy="15">${esc(formatValue(v, unit))}</tspan></text>`;
    }
  } else {
    const k = spec.series.length, bw = Math.min(24, (band * .62 - 2 * (k - 1)) / k), gw = bw * k + 2 * (k - 1);
    spec.series.forEach((ser, si) => ser.values.forEach((v, i) => {
      if (v === null) return;
      const x = m.l + band * i + (band - gw) / 2 + si * (bw + 2), top = ys(Math.max(v, y0)), base = ys(Math.max(y0, 0)), r = Math.min(4, bw / 2, base - top);
      s += `<path class="bar-r" data-i="${i}" style="fill:${color(si)}" d="M${f1(x)},${f1(base)}V${f1(top + r)}Q${f1(x)},${f1(top)} ${f1(x + r)},${f1(top)}H${f1(x + bw - r)}Q${f1(x + bw)},${f1(top)} ${f1(x + bw)},${f1(top + r)}V${f1(base)}Z"/>`;
    }));
  }
  s += `</g><line class="xhair" y1="${m.t}" y2="${f1(m.t + h)}" visibility="hidden"/></svg>`;
  // What the hover layer needs, in SVG units: x of each category, y of each value, and formatted labels.
  const hover = {line, w: W, r: W - m.r, xs: spec.x.map((_, i) => f1(X(i))), ys: spec.series.map(ser => ser.values.map(v => v === null ? null : f1(ys(v)))),
    x: spec.x.map(String), names: spec.series.map(ser => ser.name), vals: spec.series.map(ser => ser.values.map(v => formatValue(v, unit)))};
  return {svg: s, hover};
}

/** The chart block: title, Data toggle, legend, the SVG and its data table (shown without JavaScript too). */
export function chartBlock(spec, {lang = 'en', label, id}) {
  const t = (en, zh) => lang === 'zh' ? zh : en, unit = spec.y?.unit || '';
  const {svg, hover} = chartSVG(spec, {lang});
  const legend = `<ul class="legend">${spec.series.map((s, i) => `<li><i class="${spec.type}" style="--c:${color(i)}"></i>${esc(s.name)}</li>`).join('')}</ul>`;
  const table = `<div class="chart-table"><table><thead><tr><th></th>${spec.series.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${spec.x.map((x, i) => `<tr><th>${esc(x)}</th>${spec.series.map(s => `<td>${esc(formatValue(s.values[i], unit))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<figure class="fig chart" id="${id}" data-label="${esc(label)}" data-hover="${esc(JSON.stringify(hover))}">`
    + `<div class="fig-head"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5v13M11 1.5v13M1.5 5h13M1.5 11h13"/></svg><b>${esc(label)}</b><span>· ${spec.type}.chart</span><span class="sz">${spec.type} · ${spec.series.length} ${t(spec.series.length === 1 ? 'series' : 'series', '组')}</span></div>`
    + `<div class="fig-frame"><div class="chart-in"><div class="chart-top"><div><h4>${esc(spec.title || '')}</h4>${spec.y?.label ? `<p>${esc(spec.y.label)}</p>` : ''}</div><button type="button" class="chart-data" aria-pressed="false" hidden>${t('Data', '数据')}</button></div>`
    + `${legend}<div class="plot">${svg}<div class="tip" hidden></div></div>${table}</div></div>`
    + `${spec.caption ? `<figcaption><b>${esc(label)}${lang === 'zh' ? '' : '.'}</b>${esc(spec.caption)}</figcaption>` : ''}</figure>`;
}
