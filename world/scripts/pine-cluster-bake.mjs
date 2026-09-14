import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPineClusterSource } from '../src/yuanmingyuan/pine-cluster-source.js';
import { bakePineCluster } from '../src/yuanmingyuan/pine-cluster-baker.js';

if (!process.execArgv.includes('--max-old-space-size=512')) throw new Error('Run this bounded bake with node --max-old-space-size=512');
const source = createPineClusterSource(), folder = new URL('../public/assets/pine-cluster-r2/', import.meta.url), reportFolder = new URL('../../work/yuanmingyuan/pine-cluster-r2/', import.meta.url);
let baked;
const disposal = { source: 0, candidate: 0 };
for (const g of [...source.geometries.values(), ...source.terminalGeometries, source.branchGeometry]) g.addEventListener('dispose', () => disposal.source++);
try {
  const bakeDependencies = await Promise.all(['pine-cluster-source.js', 'pine-cluster-baker.js', 'pine-cluster-normal-distribution.js', 'pine-cluster-records.js', 'vegetation-geometry.js', 'pine-shoot-lod-materials.js', 'willow-distance-sampling.js'].map(async path => ({ path: 'src/yuanmingyuan/' + path, sha256: createHash('sha256').update(await readFile(new URL('../src/yuanmingyuan/' + path, import.meta.url))).digest('hex') })));
  console.log(JSON.stringify({ phase: 'source', ...source.diagnostics, bounds: { min: source.bounds.min.toArray(), max: source.bounds.max.toArray() } }));
  baked = await bakePineCluster(source, { tileSize: 128, subsamples: 4, grid: 4, progress: value => console.log(JSON.stringify({ phase: 'bake', ...value })) });
  baked.geometry.addEventListener('dispose', () => disposal.candidate++);
  await mkdir(folder, { recursive: true }); await mkdir(reportFolder, { recursive: true });
  const geometry = JSON.stringify({ attributes: Object.fromEntries(Object.entries(baked.geometry.attributes).map(([name, attribute]) => [name, [...attribute.array]])), index: [...baked.geometry.index.array] });
  const files = {};
  for (const [key, path, bytes] of [['geometry', 'volume-sheets.json', Buffer.from(geometry)], ['base', 'base-coverage-half.bin', Buffer.from(baked.base.buffer)], ['normal', 'normal-moment-half.bin', Buffer.from(baked.normal.buffer)], ['normalBins', 'normal-distribution-half.bin', Buffer.from(baked.normalBins.buffer)]]) {
    await writeFile(new URL(path, folder), bytes); files[key] = { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const manifest = { version: 2, width: baked.width, height: baked.height, layers: baked.layers, files, diagnostics: baked.diagnostics, sheets: baked.sheets, provenance: { kind: 'offline-derived-fields-from-authored-project-geometry', photoOrHistoricalSource: false, originalSource: source.records.source, sourceRecords: source.records.id, sourceShootIds: source.records.shoots.map(x => x.id), bakeDependencies, fullTreeConstructed: false, nativeReviewed: false } };
  await writeFile(new URL('manifest.json', folder), JSON.stringify(manifest, null, 2) + '\n');
  const report = { source: source.diagnostics, candidate: baked.diagnostics, allGeometryBounds: { min: source.bounds.min.toArray(), max: source.bounds.max.toArray() }, files, peakRSSKiB: process.resourceUsage().maxRSS };
  baked.dispose(); source.dispose(); report.disposal = disposal;
  await writeFile(new URL('bake-stats.json', reportFolder), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ phase: 'complete', candidateTriangles: baked.diagnostics.cardTriangles + source.diagnostics.woodTriangles, textureBytes: baked.diagnostics.baseTextureBytes, milliseconds: baked.diagnostics.milliseconds, peakRSSKiB: report.peakRSSKiB, disposal }));
} finally { baked?.dispose(); source.dispose(); }
