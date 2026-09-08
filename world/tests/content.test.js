import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {profile,research,publications,experience,journey,news,links} from '../src/content.js';
import {renderJournal} from '../src/journal.js';
import {locations} from '../src/locations.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

test('professional content has both languages and no broken source data',()=>{
  function check(value){
    if(Array.isArray(value)){value.forEach(check);return;}
    if(value&&typeof value==='object'){
      if('en' in value||'zh' in value){assert.equal(typeof value.en,'string');assert.equal(typeof value.zh,'string');assert.ok(value.en.length>0&&value.zh.length>0);}
      Object.values(value).forEach(check);
    }
  }
  [profile,research,publications,experience,journey,news].forEach(check);
  const ids=publications.map(p=>p.id);assert.equal(new Set(ids).size,ids.length);
  for(const p of publications){assert.ok(p.links.length>0);assert.ok(p.authors.includes('Yaxin Luo'));for(const l of p.links)assert.equal(new URL(l.url).protocol,'https:');}
});
test('every advertised local portrait, research figure and CV exists',()=>{
  for(const url of [profile.portrait,links.cv,...publications.map(p=>p.image).filter(Boolean)]){
    assert.ok(fs.statSync(path.join(root,url)).size>0,`Missing ${url}`);
  }
});
test('every portfolio chapter is readable in either language with no progress',()=>{
  for(const lang of ['en','zh'])for(const {id} of locations){
    const html=renderJournal(id,lang,null);assert.ok(html.includes('journal-page'));assert.ok(!html.includes('undefined'));
    assert.ok(!html.includes('[object Object]'));assert.ok(!html.includes('unlock'));
    if(id==='publications')for(const paper of publications)assert.ok(html.includes(`paper-${paper.id}`));
    for(const match of html.matchAll(/target="_blank"[^>]*>/g))assert.ok(match[0].includes('noopener'));
  }
});
