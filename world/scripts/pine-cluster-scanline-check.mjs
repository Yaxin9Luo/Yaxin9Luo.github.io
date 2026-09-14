import { writeFile } from 'node:fs/promises';
import { createPineClusterSource } from '../src/yuanmingyuan/pine-cluster-source.js';
import { bakePineCluster } from '../src/yuanmingyuan/pine-cluster-baker.js';
if (!process.execArgv.includes('--max-old-space-size=512')) throw new Error('Run with the bounded 512 MiB heap');
const source = createPineClusterSource(); let baked;
try {
 baked = await bakePineCluster(source, { terminals: [5], tileSize: 128, subsamples: 4, grid: 4, progress: x => console.log(JSON.stringify(x)) });
 const result = { actualSelectedTerminal: 5, completeTreeConstructed: false, heapLimit: '512 MiB via Node flag', peakRSSKiB: process.resourceUsage().maxRSS, diagnostics: baked.diagnostics };
 await writeFile(new URL('../../work/yuanmingyuan/pine-cluster-r2/scanline-single-terminal.json', import.meta.url), JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({ milliseconds: baked.diagnostics.milliseconds, peakRSSKiB: result.peakRSSKiB, scratch: baked.diagnostics.scratch }));
} finally { baked?.dispose(); source.dispose(); }
