import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {shrubNormalDescriptor} from '../src/herbarium-normal-policy.js';

// Small shipped JSON/review records only; no KTX/EXR/image decode or GPU.
const root=new URL('../public/',import.meta.url),sha=value=>createHash('sha256').update(value).digest('hex');
const path=url=>{assert.match(url,/^\/models\/herbarium\/didelta-spinosa\/[a-zA-Z0-9_./-]+$/);assert.ok(!url.includes('..'));return new URL(url.slice(1),root);};
async function verified(record){const bytes=await readFile(path(record.url));assert.equal(sha(bytes),record.sha256,record.url);if(record.bytes!==undefined)assert.equal(bytes.length,record.bytes);return bytes;}

test('accepted descriptor binds portable recipe, actual R4 evidence and unchanged source provenance',async()=>{
  const d=shrubNormalDescriptor('astc-hdr').derivative;
  assert.equal(d.bytes,27297259);assert.equal(d.sha256,'fb49f83f6955641d070ff7e352926dbb19568f5b961a0817e78f202203b12564');
  assert.ok(d.url.endsWith(`didelta_spinosa_nor_gl_8k.${d.sha256.slice(0,12)}.astc-hdr.ktx2`),'immutable URL includes accepted content identity');
  assert.equal((await stat(path(d.url))).size,d.bytes,'shipped artifact extent; its full hash is verified at packaging and full worker test');
  const recipe=JSON.parse(await verified({url:d.recipeURL,sha256:d.recipeSHA256})),acceptance=JSON.parse(await verified({url:d.acceptanceURL,sha256:d.acceptanceSHA256}));
  for(const record of [recipe.derivative,acceptance.derivative])assert.deepEqual(record,{url:d.url,bytes:d.bytes,sha256:d.sha256});
  assert.equal(recipe.source.sha256,d.sourceSHA256);assert.deepEqual(acceptance.source,recipe.source);
  const original=JSON.parse(await verified(recipe.sourceManifest));assert.equal(recipe.sourceManifest.sha256,'c914fc780c08909842055ae76c5e03b3cca094c4f4eb696b607570db08e51890');
  assert.equal(original.files.find(file=>file.relative.endsWith('nor_gl_8k.exr')).sha256,d.sourceSHA256);
  await verified(acceptance.recipe);assert.equal(acceptance.recipe.sha256,d.recipeSHA256);
  const evidence={};for(const [name,record]of Object.entries(acceptance.evidence)){const bytes=await verified(record);evidence[name]=record.url.endsWith('.json')?JSON.parse(bytes):bytes.toString();}
  assert.equal(acceptance.decision,'ACCEPT_FOR_RUNTIME_INTEGRATION');assert.equal(acceptance.runId,'plant-4cda36b7-f9bb-4e7a-b0c2-5bf365d37aa6');
  assert.equal(acceptance.nativeSourceIdentity,evidence.nativeSourceFreeze.identity);assert.equal(evidence.nativeSourceFreeze.files.length,70);
  assert.equal(evidence.nativeResult.status,'ready');assert.equal(evidence.nativeResult.runId,acceptance.runId);assert.equal(evidence.nativePixelCheck.result,'PASS');
  assert.equal(evidence.nativePixelCheck.inputSHA256,acceptance.evidence.nativeResult.sha256);
  assert.deepEqual(acceptance.captures,evidence.nativePixelCheck.records);assert.equal(acceptance.captures.length,12);
  assert.equal(new Set(acceptance.captures.map(c=>`${c.normal}/${c.preset}`)).size,12);
  for(const capture of acceptance.captures){assert.deepEqual(capture.dimensions,[1845,1440]);for(const field of ['commonConditionsSHA256','rawFramebufferRGBA_SHA256','decodedRGBA_SHA256','pngSHA256','sidecarSHA256'])assert.match(capture[field],/^[a-f0-9]{64}$/);}
  assert.match(evidence.rootArtReview,/ACCEPT the encoded derivative/);assert.equal(evidence.independentArtEvidence.originalsOpened,12);
  assert.equal(acceptance.presentation.nativeDisplayPixelEqualityClaimed,false);assert.equal(acceptance.wholeIslandApproval,false);assert.equal(acceptance.performanceApproval,false);
  assert.equal(acceptance.numericalAudit.lossless,false);assert.equal(acceptance.numericalAudit.maxCodecOnlyNormalErrorDegrees,34.45323126788265);
  assert.equal(acceptance.numericalAudit.includingMipRoundingMaxDegrees,34.46059331486464);
  assert.deepEqual(acceptance.numericalAudit.allPixels,evidence.audit.aggregate.allPixels);
});

test('portable recipe preserves HALF domain, supplied mip identity and the actual no-RDO HDR invocation',async()=>{
  const d=shrubNormalDescriptor('astc-hdr').derivative,recipe=JSON.parse(await verified({url:d.recipeURL,sha256:d.recipeSHA256}));
  const prep=JSON.parse(await verified(recipe.evidence.preparation)),encoded=JSON.parse(await verified(recipe.evidence.encoding));
  assert.equal(recipe.input.domain.find(c=>c.channel==='B').max,1.0419921875);assert.equal(recipe.input.domain.find(c=>c.channel==='B').aboveOne,3882293);
  assert.equal(recipe.input.normalRenormalization,false);assert.equal(recipe.input.clampRescaleOrGammaConversion,false);assert.equal(recipe.runtime.driverGeneratedMipEquivalenceClaimed,false);
  assert.equal(recipe.input.suppliedMips.length,14);for(let i=0;i<14;i++){const m=recipe.input.suppliedMips[i];assert.equal(m.width,8192/2**i);assert.equal(m.height,m.width);assert.deepEqual(m.half,prep.levels[i].half);assert.equal(m.half.bytes,m.width*m.height*8);}
  assert.equal(recipe.input.base.sha256,'1324d06839bf263fefe472edaf08b6fcb1113977af337b8a83bc910dde77c5c9');assert.equal(recipe.encode.rawControlExact,true);
  const argv=recipe.encode.argvTemplate,actual=encoded.encodeCommand.command;assert.deepEqual(argv.slice(1,-15),actual.slice(1,-15));
  assert.equal(argv[argv.indexOf('--encode')+1],'uastc-hdr-4x4');assert.equal(argv[argv.indexOf('--uastc-quality')+1],'4');assert.equal(argv[argv.indexOf('--threads')+1],'6');
  for(const flag of ['--uastc-hdr-uber-mode','--uastc-hdr-ultra-quant','--uastc-hdr-favor-astc','--fail-on-color-conversions','--fail-on-origin-changes'])assert.ok(argv.includes(flag));
  assert.ok(!argv.some(arg=>arg.startsWith('--')&&/rdo|normal-mode|generate-mipmap/.test(arg)));assert.equal(recipe.output.blockPlaneBytes,89478512);assert.equal(recipe.output.vkFormat,1000066000);
});
