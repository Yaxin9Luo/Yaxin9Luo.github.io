// node .../gen/sheet.mjs <stillsDir> -> ../review/xiqi.webp: the study sheet of scene one (stills from gen/shoot.mjs)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Users/yaxinluo/Desktop/Yaxin9Luo.github.io/world/package.json'), sharp = require('sharp');
// node .../gen/sheet.mjs <stillsDir> <rows.json> <out name>: rows.json = {"title": "...", "rows": [["row title", [["still", "caption"], ...]], ...]}
const [DIR, ROWSF, NAME] = process.argv.slice(2), CFG = JSON.parse((await import('node:fs')).readFileSync(ROWSF, 'utf8')), ROWS = CFG.rows, OUT = fileURLToPath(new URL(`../review/${NAME}.webp`, import.meta.url));
const TW = 960, TH = 600, PAD = 14, HEAD = 40, CAP = 30, W = PAD + 3 * (TW + PAD), parts = []; let y = 64;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (t, size, w, h, weight = 400) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="2" y="${h - 9}" font-family="PingFang SC, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="#1B1512">${esc(t)}</text></svg>`);
parts.push({ input: text(CFG.title, 26, W, 56, 600), left: PAD, top: 6 });
for (const [title, cells] of ROWS) { parts.push({ input: text(title, 24, W, HEAD, 600), left: PAD, top: y }); y += HEAD;
  for (let i = 0; i < 3; i++) { const c = cells[i]; if (!c) continue; const x = PAD + i * (TW + PAD); if (!(await import('node:fs')).existsSync(`${DIR}/${c[0]}.png`)) { console.log('missing', c[0]); continue; }
    parts.push({ input: await sharp(`${DIR}/${c[0]}.png`).resize(TW, TH).toBuffer(), left: x, top: y }); parts.push({ input: text(c[1], 20, TW, CAP), left: x, top: y + TH }); }
  y += TH + CAP + 10; }
await sharp({ create: { width: W, height: y + PAD, channels: 3, background: '#E4DCC9' } }).composite(parts).webp({ quality: 84 }).toFile(OUT);
console.log(OUT, (await sharp(OUT).metadata()).width, 'x', (await sharp(OUT).metadata()).height);
