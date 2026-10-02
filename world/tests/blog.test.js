import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePost,collectPosts,pickVersion,isDraft} from '../src/blog/posts.js';
import {postPageHtml} from '../blog-pages-plugin.js';
import katex from 'katex';
import {createMarkdown,hasMath,slugify} from '../src/blog/markdown.js';
import {validateSpec,niceTicks,formatValue} from '../src/blog/chart.js';
import {moonPhase,phaseName,projectStar,CONSTELLATIONS} from '../src/blog/sky.js';
const postsDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/blog/posts');

test('every blog post file parses with a title and date',()=>{
  const files=Object.fromEntries(fs.readdirSync(postsDir).filter(f=>f.endsWith('.md')).map(f=>[`./posts/${f}`,fs.readFileSync(path.join(postsDir,f),'utf8')]));
  assert.ok(Object.keys(files).length>0);
  const posts=collectPosts(files);
  for(const post of posts)for(const v of Object.values(post.versions)){assert.ok(v.title);assert.match(v.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(v.body.length>0);}
});

test('posts sort newest first and fall back to the other language',()=>{
  const md=(title,date)=>`---\ntitle: ${title}\ndate: ${date}\ntags: [A, B]\n---\nBody`;
  const posts=collectPosts({'./posts/old.en.md':md('Old','2026-01-01'),'./posts/new.zh.md':md('新','2026-05-01')});
  assert.deepEqual(posts.map(p=>p.slug),['new','old']);
  assert.equal(pickVersion(posts[0],'en').lang,'zh');
  assert.deepEqual(posts[1].versions.en.tags,['A','B']);
});

test('front matter keeps inner quotes and strips one surrounding pair',()=>{
  const md=title=>`---\ntitle: ${title}\ndate: 2026-01-01\n---\nBody`;
  assert.equal(parsePost('./posts/a.en.md',md('The "inner loop"')).title,'The "inner loop"');
  assert.equal(parsePost('./posts/a.en.md',md('"Quoted: with colon"')).title,'Quoted: with colon');
});

test('malformed post files are rejected',()=>{
  assert.throws(()=>parsePost('./posts/no-lang.md','---\ntitle: x\ndate: 2026-01-01\n---\nbody'),/<slug>\.<en\|zh>\.md/);
  assert.throws(()=>parsePost('./posts/a.en.md','no front matter'),/front matter/);
  assert.throws(()=>parsePost('./posts/a.en.md','---\ntitle: x\ndate: Oct 2\n---\nbody'),/YYYY-MM-DD/);
});

test('markdown renders math, titled figures, chart slots and footnotes',()=>{
  const html=createMarkdown({katex}).parse('Cost $O(n^2)$, not $5 or $6.\n\n$$\nx^2\n$$\n\n![A](/a.svg "Figure 1")\n\n```chart\n{}\n```\n\nNote[^1].\n\n[^1]: Foot.');
  assert.match(html,/class="katex-display"/);
  assert.ok(html.includes('not $5 or $6.'),'dollar amounts stay text');
  assert.match(html,/<figure class="post-figure"><img src="\/a.svg"[^>]*><figcaption>Figure 1<\/figcaption><\/figure>/);
  assert.match(html,/class="chart-slot" data-chart="\{\}"/);
  assert.match(html,/data-footnote-ref/);
  assert.equal(hasMath('`$x$` only code'),false);
  assert.equal(slugify('三类 Scaffolding!'),'三类-scaffolding');
});

test('every chart block in every post is a valid chart spec',()=>{
  for(const f of fs.readdirSync(postsDir).filter(f=>f.endsWith('.md'))){
    const body=fs.readFileSync(path.join(postsDir,f),'utf8');
    for(const [,json] of body.matchAll(/```chart\n([\s\S]*?)```/g))assert.doesNotThrow(()=>validateSpec(JSON.parse(json)),f);
  }
});

test('chart helpers produce clean ticks and reject malformed specs',()=>{
  assert.deepEqual(niceTicks(0,100,4),[0,25,50,75,100]);
  assert.deepEqual(niceTicks(0,64,4),[0,20,40,60,80]);
  assert.equal(formatValue(12900),'12.9K');assert.equal(formatValue(55,'%'),'55%');
  assert.throws(()=>validateSpec({type:'pie',x:[1],series:[{name:'a',values:[1]}]}),/line" or "bar/);
  assert.throws(()=>validateSpec({type:'bar',x:[1,2],series:[{name:'a',values:[1]}]}),/one value per x/);
  assert.throws(()=>validateSpec({type:'bar',x:[1],series:'abcde'.split('').map(n=>({name:n,values:[1]}))}),/at most 4/);
});

test('moon phase and names follow the real lunar cycle',()=>{
  const p=moonPhase(new Date('2026-10-02T20:00:00Z'));
  assert.ok(Math.abs(p.age-21.0)<.2);assert.equal(phaseName(p.age,'en'),'Waning gibbous');assert.equal(phaseName(p.age,'zh'),'亏凸月');
  assert.equal(phaseName(.2,'en'),'New moon');assert.equal(phaseName(14.8,'en'),'Full moon');assert.equal(phaseName(7.4,'en'),'First quarter');
});

test('constellations are projected without mirroring',()=>{
  // With the handle (Alkaid) rotated to the left of Dubhe, the pointer star Dubhe sits above Merak.
  const dipper=CONSTELLATIONS[0].stars.map(s=>projectStar(s[2],s[3]));
  const [dubhe,merak,alkaid]=[dipper[0],dipper[1],dipper[6]],a=-Math.atan2(dubhe[1]-alkaid[1],dubhe[0]-alkaid[0]);
  const rot=([x,y])=>x*Math.sin(a)+y*Math.cos(a);
  assert.ok(rot(dubhe)<rot(merak));
});

test('drafts stay drafts until one language version is published',()=>{
  const md=(extra)=>`---\ntitle: T\ndate: 2026-01-01\n${extra}---\nBody`;
  const [both]=collectPosts({'./posts/a.en.md':md('draft: true\n'),'./posts/a.zh.md':md('draft: true\n')});
  const [mixed]=collectPosts({'./posts/b.en.md':md(''),'./posts/b.zh.md':md('draft: true\n')});
  assert.equal(isDraft(both),true);assert.equal(isDraft(mixed),false);
});

test('each post page carries its own title, summary and canonical URL',()=>{
  const shell=fs.readFileSync(path.resolve(postsDir,'../../../blog/index.html'),'utf8');
  const [post]=collectPosts({'./posts/x.zh.md':'---\ntitle: 标题 "引号"\ndate: 2026-05-01\nsummary: 摘要 <b>\n---\nBody'});
  const html=postPageHtml(shell,post);
  assert.match(html,/<html lang="zh-CN">/);
  assert.match(html,/<title>标题 &quot;引号&quot; — Yaxin's Blog<\/title>/);
  assert.match(html,/<meta name="description" content="摘要 &lt;b&gt;" \/>/);
  assert.match(html,/<link rel="canonical" href="https:\/\/yaxin9luo.github.io\/blog\/x\/" \/>/);
  assert.match(html,/og:type" content="article"/);
  assert.doesNotMatch(html,/blog-page-meta/);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
});
