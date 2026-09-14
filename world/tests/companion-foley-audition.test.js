import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {writeCompanionAudition} from '../../docs/art/living-v8/companions/interaction/render-foley.mjs';
import {COMPANION_FOLEY_KINDS,createCompanionFoley} from '../src/companion-foley.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('authored WAVs roundtrip exact module samples and sequence event/hash provenance',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'companion-audition-'));
  try{
    const report=await writeCompanionAudition(directory);
    assert.ok(report,'deterministic audition authoring emits a provenance report');
    assert.equal(report.original_foley,true);assert.equal(report.gintama_original_audio,false);
    assert.equal(report.samples.length,COMPANION_FOLEY_KINDS.length);
    for(const sample of report.samples){
      const bytes=await readFile(join(directory,sample.file)),data=createCompanionFoley(sample.kind,48000,0);
      assert.equal(hash(bytes),sample.wavSha256);assert.equal(hash(Buffer.from(data.buffer)),sample.float32Sha256);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(24),48000);
      assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt16LE(34),16);
      for(let i=0;i<data.length;i++)assert.equal(bytes.readInt16LE(44+i*2),Math.round(data[i]*32767)||0);
    }
    const mix=new Float32Array(48000*12);
    for(const event of report.events){
      const data=createCompanionFoley(event.kind,48000,event.variant),start=Math.round(event.at*48000);
      assert.equal(hash(Buffer.from(data.buffer)),event.float32Sha256);
      for(let i=0;i<data.length;i++)mix[start+i]+=data[i];
    }
    const bytes=await readFile(join(directory,report.audition.file));
    assert.equal(hash(bytes),report.audition.wavSha256);assert.equal(bytes.length,44+mix.length*2);
    for(let i=0;i<mix.length;i++)assert.equal(bytes.readInt16LE(44+i*2),Math.round(mix[i]*32767)||0);
    const second=await writeCompanionAudition(directory);
    assert.deepEqual(second,report,'no wall clock or unseeded source affects audition bytes/provenance');
  }finally{await rm(directory,{recursive:true,force:true});}
});
