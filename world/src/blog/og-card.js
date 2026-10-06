// The share card for one post (1200×630, light), in the style of scripts/og/card.html: dot canvas, rulers,
// a property bar, the title in a static selection box with the Designer cursor, the summary, tags and the URL.
// Rendered to PNG by the blog build with Playwright; fonts are the site's own (EC) plus the page's CJK subsets.
import {esc, wordBreaks} from './text.js';

export function ogCardHtml({lang, title, summary, path, typeLabel, date, minutes, phase, tags, slug, fontFaces = ''}) {
  const zh = lang === 'zh';
  return `<!doctype html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><style>
@font-face{font-family:"EC Serif";font-weight:700;src:url(/fonts/ec/serif-700.woff2) format("woff2")}
@font-face{font-family:"EC Sans";font-weight:400;src:url(/fonts/ec/sans-400.woff2) format("woff2")}
@font-face{font-family:"EC Sans";font-weight:500;src:url(/fonts/ec/sans-500.woff2) format("woff2")}
@font-face{font-family:"EC Mono";font-weight:500;src:url(/fonts/ec/mono-500.woff2) format("woff2")}
${fontFaces}
:root{--bg:#F7F7FB;--dot:#D3D5E3;--card:#FFFFFF;--line:#E1E3EE;--line-2:#D9DCE8;--ink:#15162E;--muted:#565B73;--faint:#8A8FA8;--accent:#4F46E5;--accent-soft:#ECEBFE;--accent-ink:#FFF;--green:#0E9F6E;--green-soft:#E3F6EE;
  --shadow:0 1px 2px rgba(21,22,46,.06),0 10px 28px -10px rgba(21,22,46,.16);
  --serif:${zh ? '"Blog SC Serif","EC Serif"' : '"EC Serif","Blog SC Serif"'},Georgia,serif;--sans:${zh ? '"Blog SC Sans","EC Sans"' : '"EC Sans","Blog SC Sans"'},system-ui,sans-serif;--mono:"EC Mono",ui-monospace,monospace,"Blog SC Sans"}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:var(--bg)}
body{font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased;text-autospace:normal}
.card{position:relative;width:1200px;height:630px;background-image:radial-gradient(circle at 1.5px 1.5px,var(--dot) 1.15px,transparent 1.7px);background-size:22px 22px;background-position:13px 13px}
.corner,.rx,.ry{position:absolute;background-color:var(--bg);z-index:5}
.corner{left:0;top:0;width:26px;height:26px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);z-index:6}
.corner::after{content:"";position:absolute;inset:8px;border:1.5px solid var(--faint);border-radius:2px;opacity:.6}
.rx{left:26px;right:0;top:0;height:26px;border-bottom:1px solid var(--line);background-image:repeating-linear-gradient(90deg,var(--line-2) 0 1px,transparent 1px 10px),repeating-linear-gradient(90deg,var(--faint) 0 1px,transparent 1px 100px);background-size:100% 6px,100% 11px;background-position:-26px 100%;background-repeat:repeat-x}
.ry{top:26px;bottom:0;left:0;width:26px;border-right:1px solid var(--line);background-image:repeating-linear-gradient(0deg,var(--line-2) 0 1px,transparent 1px 10px),repeating-linear-gradient(0deg,var(--faint) 0 1px,transparent 1px 100px);background-size:6px 100%,11px 100%;background-repeat:repeat-y}
.rx span{position:absolute;top:4px;font:500 10px var(--mono);color:var(--faint);transform:translateX(4px)}
.rx .hl,.ry .hl{position:absolute;background:color-mix(in srgb,var(--accent) 14%,transparent)}
.rx .hl{top:0;bottom:0;border-left:1px solid var(--accent);border-right:1px solid var(--accent)}
.ry .hl{left:0;right:0;border-top:1px solid var(--accent);border-bottom:1px solid var(--accent)}
.crumb{position:absolute;left:62px;top:50px;display:flex;align-items:center;gap:14px;font:500 17px var(--mono);color:var(--faint);white-space:nowrap}
.crumb b{color:var(--ink);font-weight:500}.crumb i{font-style:normal;margin:0 4px}
.wd{display:inline-flex;gap:7px;padding:8px 10px;border:1px solid var(--line-2);border-radius:10px;background:var(--card)}.wd i{width:11px;height:11px;border-radius:50%;background:#E4572E}.wd i:nth-child(2){background:#E8B339}.wd i:nth-child(3){background:#0E9F6E}
.insp{position:absolute;left:84px;top:112px;display:flex;height:40px;border-radius:11px;background:var(--card);border:1px solid var(--line-2);box-shadow:var(--shadow);font:500 16px var(--mono);color:var(--muted);white-space:nowrap}
.insp span{display:flex;align-items:center;gap:8px;padding:0 14px}.insp span+span{border-left:1px solid var(--line)}
.insp span .v{color:var(--ink);padding:0}.insp .ph{color:var(--accent)}
.insp .zh{font-family:var(--sans)}
.ttl{position:absolute;left:100px;top:206px;width:1000px}
.sel{position:relative;display:inline-block}
.sel .frame{position:absolute;inset:-10px -16px -8px -16px;background:color-mix(in srgb,var(--accent-soft) 60%,transparent);border:2.5px dashed var(--accent);border-radius:1px}
.sel>i{position:absolute;width:13px;height:13px;border:2.2px solid var(--accent);background:var(--bg);border-radius:2.5px}
.sel .tl{left:-22.5px;top:-16.5px}.sel .tm{left:calc(50% - 6.5px);top:-16.5px}.sel .tr{right:-22.5px;top:-16.5px}
.sel .ml{left:-22.5px;top:calc(50% - 6.5px)}.sel .mr{right:-22.5px;top:calc(50% - 6.5px)}
.sel .bl{left:-22.5px;bottom:-14.5px}.sel .bm{left:calc(50% - 6.5px);bottom:-14.5px}.sel .br{right:-22.5px;bottom:-14.5px}
.sel .tag{position:absolute;right:-16px;top:-44px;height:24px;padding:0 8px;border-radius:6px;background:var(--accent);color:var(--accent-ink);font:500 14px/24px var(--mono)}
h1{position:relative;margin:0;font:700 var(--fs,68px)/1.1 var(--serif);letter-spacing:${zh ? '.02em' : '-.012em'};color:var(--ink);text-wrap:balance;word-break:keep-all}
.dek{position:absolute;left:84px;width:900px;margin:0;font:400 25px/1.45 var(--sans);color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;${zh ? 'letter-spacing:.02em;line-height:1.6;' : ''}}
.chips{position:absolute;left:84px;bottom:86px;display:flex;gap:10px}
.chip{display:inline-flex;align-items:center;gap:9px;height:36px;padding:0 16px 0 14px;border-radius:18px;font:500 17px var(--sans);background:var(--accent-soft);color:var(--accent)}
.chip::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
.chip.g{background:var(--green-soft);color:var(--green)}
.status{position:absolute;left:26px;right:0;bottom:0;height:54px;display:flex;align-items:center;gap:20px;padding:0 42px 0 58px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--bg) 92%,transparent);font:500 17px var(--mono);color:var(--muted);white-space:nowrap}
.status b{color:var(--ink);font-weight:500}.status .zh{font-family:var(--sans)}
.status .dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px var(--green-soft)}
.status .url{margin-left:auto;color:var(--ink)}
.cur{position:absolute;z-index:8}
.cur svg{display:block;width:27px;height:37px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.18))}
.cur path{fill:var(--accent);stroke:var(--bg);stroke-width:1.8;stroke-linejoin:round}
.cur .lbl{position:absolute;left:19px;top:27px;height:30px;padding:0 12px;border-radius:15px;font:700 16.5px/30px "EC Sans",sans-serif;background:var(--accent);color:var(--accent-ink);white-space:nowrap}
</style></head><body><div class="card">
<div class="corner"></div><div class="rx"><i class="hl"></i></div><div class="ry"><i class="hl"></i></div>
<div class="crumb"><span class="wd"><i></i><i></i><i></i></span><span>yaxin-luo<i>/</i>blog<i>/</i><b>${esc(slug)}</b></span></div>
<div class="insp"><span class="${zh ? 'zh' : ''}">${esc(typeLabel)}</span><span><span class="v">${date}</span></span><span><span class="v">${minutes}</span><span class="${zh ? 'zh' : ''}">${zh ? '分钟' : 'min read'}</span></span>${phase ? `<span class="ph ${zh ? 'zh' : ''}">${esc(phase)}</span>` : ''}</div>
<div class="ttl"><div class="sel"><div class="frame"></div><i class="tl"></i><i class="tm"></i><i class="tr"></i><i class="ml"></i><i class="mr"></i><i class="bl"></i><i class="bm"></i><i class="br"></i><span class="tag">H1</span><h1>${zh ? wordBreaks(title) : esc(title)}</h1></div></div>
<p class="dek">${esc(summary)}</p>
<div class="chips">${tags.map(t => `<span class="chip${t.green ? ' g' : ''}">${esc(t.label)}</span>`).join('')}</div>
<div class="status"><span class="dot"></span><span>${zh ? '<span class="zh">罗亚鑫</span> · <b class="zh">Yaxin 的博客</b>' : 'by <b>Yaxin Luo</b> · Yaxin’s Blog'}</span><span class="url">yaxin9luo.github.io${esc(path)}</span></div>
</div><script>
(async () => {
  await document.fonts.ready;
  const h1 = document.querySelector('h1'), sel = h1.parentElement;
  // Fit: at most two lines, then hug the longest line so the selection box frames the text.
  let fs = 74; h1.style.setProperty('--fs', fs + 'px');
  const lines = () => Math.round(h1.getBoundingClientRect().height / (fs * 1.1));
  while (lines() > 2 && fs > 44) { fs -= 2; h1.style.setProperty('--fs', fs + 'px'); }
  const r = document.createRange(); r.selectNodeContents(h1); const rects = [...r.getClientRects()];
  sel.style.width = Math.ceil(Math.max(...rects.map(x => x.right)) - Math.min(...rects.map(x => x.left)) + 4) + 'px';
  const s = sel.getBoundingClientRect();
  document.querySelector('.dek').style.top = (s.bottom + 34) + 'px';
  for (let x = 100; x < 1200; x += 100) document.querySelector('.rx').insertAdjacentHTML('beforeend', '<span style="left:' + (x - 26) + 'px">' + x + '</span>');
  document.querySelector('.rx .hl').style.cssText = 'left:' + (s.left - 42) + 'px;width:' + (s.width + 32) + 'px';
  document.querySelector('.ry .hl').style.cssText = 'top:' + (s.top - 36) + 'px;height:' + (s.height + 18) + 'px';
  const mr = sel.querySelector('.mr').getBoundingClientRect();
  document.querySelector('.card').insertAdjacentHTML('beforeend', '<div class="cur" style="left:' + (mr.right + 4) + 'px;top:' + (mr.top + 4) + 'px"><svg viewBox="0 0 22 30"><path d="M2 2 L2 25.3 L8.9 18.4 L14.1 29.3 L18.7 27 L13.5 16.4 L23.3 15.5 Z"/></svg><span class="lbl">Designer</span></div>');
  document.body.classList.add('ready');
})();
</script></body></html>`;
}
