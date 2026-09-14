#!/usr/bin/env node
// Small CPU evidence only. No renderer, browser, GPU context, or tree factory.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createPineShootImpostorSource } from '../src/yuanmingyuan/impostor-prototype.js';
import { bakeImpostorCPUFixture } from '../src/yuanmingyuan/impostor-baker.js';
import { createImpostorStudyAsset, fingerprintImpostorSource, serializeImpostorStudy } from '../src/yuanmingyuan/impostor-runtime.js';

const world = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), repo = path.dirname(world);
const args = process.argv.slice(2); if (args.length && (args[0] !== '--output' || args.length !== 2)) throw new Error('Usage: node scripts/check-yuanmingyuan-impostor.mjs [--output directory]');
const output = path.resolve(args[1] || path.join(repo, 'work/yuanmingyuan/impostor-prototype-r1'));
await fs.mkdir(output, { recursive: false });
const started = performance.now(), source = createPineShootImpostorSource(); let asset, proxy; const releases = { sourceGeometry: 0, sourceMaterial: 0, proxyMaterial: 0, carrierGeometry: 0, textures: 0 };
source.geometry.addEventListener('dispose', () => releases.sourceGeometry++); source.material.addEventListener('dispose', () => releases.sourceMaterial++);
try {
  const fingerprint = await fingerprintImpostorSource(source); source.diagnostics.geometryMaterialSHA256 = fingerprint.sha256;
  const captureStart = performance.now(), data = bakeImpostorCPUFixture({ source, gridSize: 3, tileSize: 16 }), cpuCaptureMs = performance.now() - captureStart;
  const serialized = await serializeImpostorStudy(data); asset = createImpostorStudyAsset(data); proxy = asset.createProxy();
  proxy.material.addEventListener('dispose', () => releases.proxyMaterial++); proxy.mesh.geometry.addEventListener('dispose', () => releases.carrierGeometry++);
  for (const key of ['impBase', 'impNormalRoughness', 'impDepthMaterial', 'impEmission']) proxy.uniforms[key].value.addEventListener('dispose', () => releases.textures++);
  const ownershipBeforeRelease = asset.stats(); asset.disposeAll(); source.dispose();
  const sourceFiles = ['src/yuanmingyuan/impostor-format.js', 'src/yuanmingyuan/impostor-prototype.js', 'src/yuanmingyuan/impostor-baker.js', 'src/yuanmingyuan/impostor-material.js', 'src/yuanmingyuan/impostor-runtime.js', 'src/yuanmingyuan/impostor-studio-state.js', 'src/yuanmingyuan/impostor-studio.js', 'src/yuanmingyuan/impostor-studio.css', 'impostor-studio.html', 'tests/yuanmingyuan-impostor.test.js', 'scripts/check-yuanmingyuan-impostor.mjs', 'src/yuanmingyuan/vegetation-geometry.js', 'src/yuanmingyuan/garden-vegetation.js'];
  const hashes = {}; for (const file of sourceFiles) hashes[file] = createHash('sha256').update(await fs.readFile(path.join(world, file))).digest('hex');
  const report = { schema: 1, recordedAt: new Date().toISOString(), status: 'CPU_INTERFACE_PASS_NATIVE_PENDING', nativeReviewed: false, mainSceneAllowed: false, gpuUsed: false, browserUsed: false, wholeTreeConstructed: false, source: source.diagnostics, fingerprint, capture: { ...data.metrics, cpuCaptureMs, elapsedMs: performance.now() - started, fixtureOnly: true, manifestSHA256: serialized.manifestSHA256, mapBytes: Object.values(data.maps).reduce((s, m) => s + m.byteLength, 0) }, ownershipBeforeRelease, ownershipAfterRelease: asset.stats(), releases, sourceFilesSHA256: hashes, limits: ['No GLSL compile or rendered appearance verified', 'Single front depth per captured view: disocclusion approximate', 'No shadow pass or GTAO normal prepass', 'Nearest sampled RGBA8 prototype: no mipmaps or runtime approval'] };
  const fixtureDirectory = path.join(output, 'cpu-fixture'); await fs.mkdir(fixtureDirectory);
  for (const [name, bytes] of Object.entries(serialized.files)) await fs.writeFile(path.join(fixtureDirectory, name), bytes);
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, status: report.status, triangles: source.diagnostics.triangles, rays: data.metrics.rays, hits: data.metrics.hits, cpuCaptureMs, mapBytes: report.capture.mapBytes, geometryMaterialSHA256: fingerprint.sha256, releases, sourceFilesSHA256: hashes }, null, 2));
} finally { proxy?.dispose(); asset?.dispose(); source.dispose(); }
