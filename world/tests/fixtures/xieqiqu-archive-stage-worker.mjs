import { appendFile } from 'node:fs/promises';
import { writeYuanmingyuanArchiveSource, verifyYuanmingyuanArchiveSource } from '../../scripts/export-yuanmingyuan-assets.mjs';

const [phase, directory, marker] = process.argv.slice(2);
try {
  if (phase === 'a') {
    const { createArchiveSpecimen } = await import('./xieqiqu-archive-specimen.mjs');
    await appendFile(marker, process.pid + '\n');
    const result = await writeYuanmingyuanArchiveSource(createArchiveSpecimen(), { id:'staged-fixture',sourceSHA256:{fixture:'a'.repeat(64)},outputDirectory:directory,maximumGLBBytes:1024*1024 });
    console.log(JSON.stringify({phase,processId:process.pid,...result.candidate.verification.counts,disposal:result.candidate.sourceResourceDisposal}));
  } else if (phase === 'b') {
    const events=[];
    try { const result = await verifyYuanmingyuanArchiveSource({archiveDirectory:directory,onProgress:event=>events.push(event)});console.log(JSON.stringify({phase,processId:process.pid,verification:result.manifest.verification})); }
    finally { console.log(JSON.stringify({phase:'verification-events',events})); }
  } else throw new Error('Only tiny fixture source and restore phases are supported');
} catch(error) {console.error(error.stack);process.exitCode=1;}
