import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {museumEntries,museumEntry,museumRegions,museumSources,museumImages,searchMuseumEntries,guideSign} from '../src/yuanmingyuan/museum-content.js';

test('every exhibit is addressable and its regional, source and related links resolve',()=>{
  const ids=new Set();const regions=new Set(museumRegions.map(region=>region.id));
  for(const entry of museumEntries){
    assert(!ids.has(entry.id),entry.id);ids.add(entry.id);assert.equal(museumEntry(entry.id),entry);assert(regions.has(entry.region));
    assert(entry.sources.length>0,entry.id+' lacks sources');
    for(const key of entry.sources){assert(museumSources[key],key);assert.equal(new URL(museumSources[key].url).protocol,'https:');}
    for(const key of entry.related)assert(museumEntry(key),entry.id+' -> '+key);
    for(const key of entry.images)assert(museumImages[key],key);
  }
});
test('exhibits, source labels and simultaneous guide signs have complete Chinese and English text',()=>{
  const localized=[];
  for(const entry of museumEntries)localized.push(entry.title,entry.lead,...entry.paragraphs,...(entry.note?[entry.note]:[]),guideSign(entry.id));
  for(const source of Object.values(museumSources))localized.push(source.title,source.kind);
  for(const image of Object.values(museumImages))localized.push(image.title,image.caption,image.credit);
  for(const value of localized)for(const lang of ['zh','en'])assert(typeof value[lang]==='string'&&value[lang].trim().length>0,lang);
  const sign=guideSign('haiyantang');assert.match(sign.zh,/海晏堂/);assert.match(sign.en,/Haiyantang/);
  assert(sign.zh.includes(museumEntry('haiyantang').lead.zh));assert(sign.en.includes(museumEntry('haiyantang').lead.en));
  assert(guideSign('fanghu-shengjing').zh.includes(museumEntry('fanghu-shengjing').sign.zh));
});
test('unknown or malformed route IDs never produce an exhibit or a guide sign',()=>{
  for(const input of ['constructor','toString','__proto__','../../content','<script>',null,undefined,{},'']){assert.equal(museumEntry(input),null);assert.equal(guideSign(input),null);}
});
test('bilingual search combines terms and region filters without changing the catalogue',()=>{
  const before=museumEntries.map(entry=>entry.id);
  assert(searchMuseumEntries('HAIYANTANG west').some(entry=>entry.id==='haiyantang'));
  assert(searchMuseumEntries('海晏堂 铜').some(entry=>entry.id==='zodiac-fountain'));
  assert(searchMuseumEntries('','qichunyuan').every(entry=>entry.region==='qichunyuan'));
  assert.equal(searchMuseumEntries('impossible-record-67912').length,0);
  assert.equal(searchMuseumEntries('','missing-region').length,0);
  assert.equal(searchMuseumEntries('   ').length,museumEntries.length);
  assert.deepEqual(museumEntries.map(entry=>entry.id),before);
});
test('historic media retain their actual institution, media type, rights and local bytes',async()=>{
  const records=JSON.parse(await readFile(new URL('../public/images/yuanmingyuan/provenance.json',import.meta.url),'utf8'));
  for(const image of Object.values(museumImages)){
    if(image.kind==='reconstruction-render'){
      assert.equal(image.notHistoricalEvidence,true);assert.equal(image.generated,true);assert.equal(image.pixelTransform,'none');
      assert.match(image.caption.en,/not (?:a Qing|excavated)/);assert(image.source.startsWith('/yuanmingyuan-studio.html?'));
      const data=await readFile(new URL('../public'+image.src,import.meta.url));assert.equal(data.length,image.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'),image.sha256);
      const provenance=JSON.parse(await readFile(new URL('../public'+image.provenanceUrl,import.meta.url),'utf8'));
      assert(provenance.some(record=>record.sha256===image.sha256&&record.notHistoricalEvidence));
      continue;
    }
    if(image.kind==='historic-rubbing'){
      assert.equal(new URL(image.source).hostname,'digitalarchive.npm.gov.tw');
      assert(image.src.startsWith('/art/references/hanjingtang/'));
      assert.match(image.license,/CC0 1\.0/);assert.equal(image.licenseUrl,'https://creativecommons.org/publicdomain/zero/1.0/');
      assert.equal(image.pixelTransform,'none');assert.equal(image.generated,false);
      assert.equal(image.fullSrc,image.src);assert(image.originalDate.zh&&image.originalDate.en);
      const data=await readFile(new URL('../public'+image.src,import.meta.url));
      assert.equal(data.length,image.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),image.sha256);
      const provenance=JSON.parse(await readFile(new URL('../public'+image.provenanceUrl,import.meta.url),'utf8'));
      assert(JSON.stringify(provenance).includes(image.sha256));
      assert(image.width*image.height<1000000);
      continue;
    }
    assert(image.src.startsWith('/images/yuanmingyuan/'));assert.ok(['historic-engraving','historic-painting'].includes(image.kind));
    assert.match(image.license,/Public Domain Mark/);assert.equal(new URL(image.source).hostname,'commons.wikimedia.org');
    const data=await readFile(new URL('../public'+image.src,import.meta.url));assert(data.length>10000);
    assert(records.some(record=>record.destination.endsWith(image.src)));
  }
});

test('calligraphy exhibits can be found in both languages without implying a complete 144-stone transcription',()=>{
  for(const query of ['淳化轩','Chunhuaxuan'])assert(searchMuseumEntries(query,'changchunyuan').some(item=>item.id==='chunhuaxuan'));
  const exhibit=museumEntry('chunhuaxuan');assert.equal(exhibit.images.length,3);
  assert.match(exhibit.note.zh,/重复使用/);assert.match(exhibit.note.en,/repeated/);
  assert.match(museumEntry('hanjingtang').note.en,/not the complete ensemble/);
  assert(guideSign('chunhuaxuan').zh.includes(exhibit.sign.zh));
});

test('north-court contemporary exhibition note is clear in both Xieqiqu and garden exhibits',()=>{
  for(const id of ['xieqiqu','formal-gardens']){const note=museumEntry(id).note;assert.match(note.zh,/当代展陈设计/);assert.match(note.zh,/待考证/);assert.match(note.en,/contemporary exhibition design/);assert.match(note.en,/remain to be established/);assert.doesNotMatch(JSON.stringify(note),/nativeApproved|fullResolutionVerified|garden-r[1-9]/);}
});
