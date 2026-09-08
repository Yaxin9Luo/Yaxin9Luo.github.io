import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {profile,research,publications,experience,journey,news,links,cvForLanguage,openSource} from '../src/content.js';
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
  for(const url of [profile.portrait,links.cv,links.cvZh,...publications.map(p=>p.image).filter(Boolean)]){
    assert.ok(fs.statSync(path.join(root,url)).size>0,`Missing ${url}`);
  }
});

test('both resume HTML files and the website share the dated GitHub star snapshot',()=>{
  for(const name of ['罗亚鑫_简历.html','Yaxin_Luo_Resume.html']){
    const html=fs.readFileSync(path.join(root,'files',name),'utf8');
    for(const repo of Object.values(openSource.repositories)){
      assert.ok(html.includes(`${repo.stars} Stars · ${openSource.checked_on.replaceAll('-','.')}`));
      assert.ok(html.includes(repo.url));
    }
  }
  for(const lang of ['en','zh']){
    const html=renderJournal('projects',lang);
    for(const repo of Object.values(openSource.repositories))assert.ok(html.includes(`${repo.stars} Stars`));
    for(const section of ['about','journey','contact'])assert.ok(renderJournal(section,lang).includes(cvForLanguage(lang)));
  }
});

test('traditional pages receive the same current facts and all resume publications',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(root,'_data/portfolio.json'),'utf8'));
  assert.deepEqual(data.publications,publications);
  assert.deepEqual(data.profile,profile);
  assert.deepEqual(data.experience,experience);
  assert.deepEqual(data.journey,journey);
  for(const id of ['dartree','videococo','detail-targeting','dynamic-pyramid'])assert.ok(publications.some(p=>p.id===id));
});
test('every portfolio chapter is readable in either language with no progress',()=>{
  for(const lang of ['en','zh'])for(const {id} of locations){
    const html=renderJournal(id,lang,null);assert.ok(html.includes('journal-page'));assert.ok(!html.includes('undefined'));
    assert.ok(!html.includes('[object Object]'));assert.ok(!html.includes('unlock'));
    if(id==='publications')for(const paper of publications)assert.ok(html.includes(`paper-${paper.id}`));
    for(const match of html.matchAll(/target="_blank"[^>]*>/g))assert.ok(match[0].includes('noopener'));
  }
});
