import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'dist');
const traditional = path.join(root, 'work/traditional-site');
const siteUrl = (process.env.SITE_URL || 'https://yaxin9luo.github.io').replace(/\/+$/, '');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

async function files(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) result.push(...await files(path.join(directory, item.name), relative));
    else if (item.isFile()) result.push(relative);
  }
  return result;
}

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

run('node', ['scripts/sync-portfolio-data.mjs']);
run('npm', ['--prefix', 'world', 'run', 'build']);
run('bash', ['scripts/build-traditional.sh']);

// Only this known generated destination is removed; source content is untouched.
await rm(destination, { recursive: true, force: true });
await cp(path.join(root, 'world/dist'), destination, { recursive: true });
await cp(traditional, path.join(destination, 'traditional'), { recursive: true });

// Keep public image/PDF URLs and old stylesheet/font URLs functional. Vite uses
// hashed filenames directly inside assets/, so the legacy subfolders coexist.
for (const name of ['images', 'files', 'assets', 'Yaxin.JPG']) {
  await cp(path.join(traditional, name), path.join(destination, name), { recursive: true });
}

let redirects = 0;
for (const file of await files(traditional)) {
  if (!file.endsWith('.html') || file === 'index.html') continue;
  if (/^(assets|images|files)\//.test(file)) continue;
  if (file === '404.html') {
    await cp(path.join(traditional, file), path.join(destination, file));
    continue;
  }
  const target = `/traditional/${file.replace(/index\.html$/, '')}`;
  const output = path.join(destination, file);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yaxin Luo — Traditional website</title>
<link rel="canonical" href="${escapeHtml(siteUrl + target)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
</head><body><p><a href="${escapeHtml(target)}">Continue to the traditional website · 进入传统主页</a></p>
<p><a href="/">Enter the enchanted world · 进入魔法世界</a></p></body></html>\n`);
  redirects += 1;
}

// Existing feed consumers keep working; its entries point at the preserved site.
await cp(path.join(traditional, 'feed.xml'), path.join(destination, 'feed.xml'));
const sitemap = await readFile(path.join(traditional, 'sitemap.xml'), 'utf8');
await writeFile(path.join(destination, 'sitemap.xml'), sitemap.replace('</urlset>', `<url><loc>${escapeHtml(siteUrl)}/</loc></url></urlset>`));
await writeFile(path.join(destination, '.nojekyll'), '');

for (const file of ['index.html', 'traditional/index.html', 'traditional/zh/index.html', 'traditional/cv/index.html', 'files/CV_YaxinLuo.pdf']) {
  if (!(await stat(path.join(destination, file))).size) throw new Error(`Empty build output: ${file}`);
}
console.log(`Combined website built at dist/: game /, traditional /traditional/, ${redirects} legacy page redirects.`);
