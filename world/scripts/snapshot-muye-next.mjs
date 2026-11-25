// A snapshot of the next Muye (muye-next.html) that can be played undisturbed: the live dev server reloads whenever any
// session saves a file. This builds the one page with Vite into world/.cache/muye-snapshot/ (git-ignored), without the
// site's vite.config.js or its build inputs, and serves it on a fixed port.
//
//   node scripts/snapshot-muye-next.mjs            build a fresh snapshot (from world/)
//   node scripts/snapshot-muye-next.mjs --serve    serve the last snapshot at http://127.0.0.1:5180/muye-next.html
//   node scripts/snapshot-muye-next.mjs --build-and-serve
import {build} from 'vite';
import {cp, readdir, writeFile, stat, rename, rm, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const WORLD = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(WORLD, '.cache', 'muye-snapshot'), NEXT = OUT + '.next', OLD = OUT + '.old';
const PORT = 5180;
const args = new Set(process.argv.slice(2));

// A snapshot is built beside the last one and swapped in only when the build and the copies all succeed, so a
// failed build (another session mid-edit) never leaves the playable snapshot broken.
async function snapshot() {
  const t0 = Date.now();
  const final = OUT;
  await rm(NEXT, {recursive: true, force: true});
  try { await buildInto(NEXT); } catch (e) { await rm(NEXT, {recursive: true, force: true}); console.error(`build failed; the last snapshot is untouched:\n${e.message.split('\n').slice(0, 6).join('\n')}`); process.exitCode = 1; return false; }
  await rm(OLD, {recursive: true, force: true});
  try { await rename(final, OLD); } catch { /* no snapshot yet */ }
  await rename(NEXT, final); await rm(OLD, {recursive: true, force: true});
  console.log(`snapshot built in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${final}`);
  return true;
}
async function buildInto(OUT) {
  await build({
    configFile: false, root: WORLD, base: '/', logLevel: 'warn',
    publicDir: false,      // world/public is 2.4 GB; the page needs only the few files copied below
    build: {outDir: OUT, emptyOutDir: true, rolldownOptions: {input: {muyeNext: path.join(WORLD, 'muye-next.html')}}, chunkSizeWarningLimit: 4096},
  });
  // what the page takes from world/public: its fonts and the site's crest
  await cp(path.join(WORLD, 'public', 'fonts', 'ec'), path.join(OUT, 'fonts', 'ec'), {recursive: true});
  await cp(path.join(WORLD, 'public', 'crest.svg'), path.join(OUT, 'crest.svg'));
  // files two figure modules fetch by names made at run time, from the folder their own code is served from
  // (art/puppets/imagegen/figures.js and art/puppets/imagegen-mass/genmass.js): beside the built chunks, in assets/
  for (const dir of ['src/muye2/art/puppets/imagegen', 'src/muye2/art/puppets/imagegen-mass']) {
    const from = path.join(WORLD, dir);
    for (const f of await readdir(from)) if (/\.(json|webp)$/.test(f)) await cp(path.join(from, f), path.join(OUT, 'assets', f));
  }
  let commit = ''; try { commit = execSync('git rev-parse --short HEAD', {cwd: WORLD}).toString().trim(); } catch { /* not a checkout */ }
  await writeFile(path.join(OUT, 'SNAPSHOT.txt'), `muye-next snapshot\nbuilt ${new Date().toISOString()} from commit ${commit} plus the working tree\n`);
}
// A plain static server that reads the snapshot folder on every request, so a new snapshot is served without a restart.
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm'};
async function serve() {
  try { await stat(path.join(OUT, 'muye-next.html')); } catch { console.error('no snapshot yet: run without --serve first'); process.exit(1); }
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'muye-next.html', file = path.join(OUT, rel);
    if (!file.startsWith(OUT + path.sep)) { res.writeHead(403).end(); return; }
    try { const body = await readFile(file); res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache'}); res.end(body); }
    catch { res.writeHead(404, {'content-type': 'text/plain'}).end('not found'); }
  });
  server.listen(PORT, '127.0.0.1', () => console.log(`serving the snapshot at http://127.0.0.1:${PORT}/muye-next.html (Ctrl-C to stop)`));
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `port ${PORT} is in use: a snapshot server may already be running (rebuilding is enough; it serves the new one)` : e.message); process.exit(1); });
}
if (!args.has('--serve') && !(await snapshot()) && !args.has('--build-and-serve')) process.exit(1);
if (args.has('--serve') || args.has('--build-and-serve')) await serve();
else console.log(`to play it: node scripts/snapshot-muye-next.mjs --serve   then open http://127.0.0.1:${PORT}/muye-next.html`);
