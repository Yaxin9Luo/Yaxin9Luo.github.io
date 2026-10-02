import {state,t,escape,postHref,formatDate,minutes,toast} from './blog.js';
import {pickVersion} from './posts.js';
import {createMarkdown,hasMath,slugify} from './markdown.js';
import {renderChart} from './chart.js';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import './article.css';

for(const [name,lang] of Object.entries({python,javascript,typescript,bash,json,yaml}))hljs.registerLanguage(name,lang);
hljs.registerAliases(['py'],{languageName:'python'});hljs.registerAliases(['js'],{languageName:'javascript'});hljs.registerAliases(['ts'],{languageName:'typescript'});hljs.registerAliases(['sh','shell','zsh'],{languageName:'bash'});

const CALLOUTS={NOTE:['Note','注'],TIP:['Tip','提示'],WARNING:['Warning','注意'],IMPORTANT:['Key idea','要点']};

export async function mount(main,slug){
  const index=state.posts.findIndex(p=>p.slug===slug),post=state.posts[index];
  if(!post){document.title='404 — Yaxin\'s Blog';main.innerHTML=`<div class="article-shell"><section class="missing"><h1>404</h1><p>${t('missing')}</p><a href="/blog/">← ${t('all')}</a></section></div>`;return;}
  const v=pickVersion(post,state.lang);
  document.title=`${v.title} — Yaxin's Blog`;
  const katex=hasMath(v.body)?(await Promise.all([import('katex'),import('katex/dist/katex.min.css')]))[0].default:null;
  const html=createMarkdown({katex}).parse(v.body);
  const newer=state.posts[index-1],older=state.posts[index+1];
  const neighbour=(p,label,cls)=>p?`<a class="neighbour ${cls}" href="${postHref(p.slug)}"><small>${label}</small><span>${escape(pickVersion(p,state.lang).title)}</span></a>`:'<span></span>';

  main.innerHTML=`<div class="progress" aria-hidden="true"><i></i></div>
  <div class="article-shell">
    <article class="post" lang="${v.lang==='zh'?'zh-CN':'en'}">
      <a class="post-back" href="/blog/">← ${t('all')}</a>
      <header class="post-header">
        <div class="post-eyebrow"><span></span><time datetime="${v.date}">${formatDate(v.date)}</time><b>·</b>${minutes(v.body)} ${t('read')}</div>
        <h1>${escape(v.title)}</h1>
        ${v.summary?`<p class="post-summary">${escape(v.summary)}</p>`:''}
        <div class="post-byline"><img src="/crest.svg" alt=""/><span>Yaxin Luo</span><div class="chips">${v.tags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div></div>
      </header>
      ${v.placeholder?`<p class="post-notice">${t('placeholderNote')}</p>`:''}
      ${v.lang!==state.lang?`<p class="post-notice">${t('onlyIn')} ${t(v.lang)}.</p>`:''}
      <div class="post-body">${html}</div>
      <nav class="neighbours">${neighbour(newer,`← ${t('newer')}`,'newer')}${neighbour(older,`${t('older')} →`,'older')}</nav>
    </article>
    <aside class="toc" aria-label="${t('contents')}"><div class="toc-inner"><p class="toc-title">${t('contents')}</p><ol></ol></div></aside>
  </div>
  <button class="toc-fab" type="button" aria-expanded="false">${t('contents')}</button>
  <button class="to-top" type="button" aria-label="${t('top')}">↑</button>
  <div class="lightbox" hidden><img alt=""/><p></p></div>`;

  const body=main.querySelector('.post-body'),cleanups=[];
  enhanceHeadings(body);
  enhanceCode(body);
  enhanceCallouts(body);
  enhanceFootnotes(body,cleanups);
  enhanceFigures(main,body,cleanups);
  body.querySelectorAll('a[href^="http"]').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});
  body.querySelectorAll('.chart-slot').forEach(slot=>renderChart(slot,{lang:state.lang,reducedMotion:state.reducedMotion}));
  buildToc(main,body,cleanups);

  // Reading progress and back-to-top.
  const bar=main.querySelector('.progress i'),top=main.querySelector('.to-top'),article=main.querySelector('.post');
  const onScroll=()=>{
    const box=article.getBoundingClientRect(),total=box.height-innerHeight*.6;
    bar.style.transform=`scaleX(${Math.min(1,Math.max(0,-box.top/Math.max(1,total)))})`;
    top.classList.toggle('visible',scrollY>innerHeight*1.2);
  };
  addEventListener('scroll',onScroll,{passive:true});onScroll();
  cleanups.push(()=>removeEventListener('scroll',onScroll));
  top.addEventListener('click',()=>scrollTo({top:0,behavior:state.reducedMotion?'auto':'smooth'}));

  if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));target?.scrollIntoView();}
  return ()=>cleanups.forEach(fn=>fn());
}

function enhanceHeadings(body){
  const used=new Set();
  body.querySelectorAll(':scope > h2, :scope > h3').forEach(h=>{
    let id=slugify(h.textContent),n=2;while(used.has(id))id=`${slugify(h.textContent)}-${n++}`;used.add(id);h.id=id;
    const a=document.createElement('a');a.className='anchor';a.href=`#${id}`;a.setAttribute('aria-label',`${t('section')}: ${h.textContent}`);a.textContent='#';
    a.addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'',`#${id}`);h.scrollIntoView({behavior:state.reducedMotion?'auto':'smooth'});
      navigator.clipboard?.writeText(location.href).then(()=>toast(t('copied')),()=>{});});
    h.prepend(a);
  });
}

function enhanceCode(body){
  body.querySelectorAll('pre > code').forEach(code=>{
    const lang=[...code.classList].find(c=>c.startsWith('language-'))?.slice(9);
    if(lang&&hljs.getLanguage(lang))hljs.highlightElement(code);
    const pre=code.parentElement,wrap=document.createElement('div');wrap.className='code-block';
    pre.replaceWith(wrap);
    wrap.innerHTML=`<div class="code-head"><span>${escape(lang||'text')}</span><button type="button">${t('copy')}</button></div>`;wrap.append(pre);
    const button=wrap.querySelector('button');
    button.addEventListener('click',()=>navigator.clipboard?.writeText(code.textContent).then(()=>{button.textContent=t('copiedCode');button.classList.add('done');setTimeout(()=>{button.textContent=t('copy');button.classList.remove('done');},1400);},()=>{}));
  });
}

// GitHub-style callouts: a blockquote starting with [!NOTE], [!TIP], [!WARNING] or [!IMPORTANT].
function enhanceCallouts(body){
  body.querySelectorAll(':scope > blockquote').forEach(q=>{
    const first=q.querySelector('p');const m=first?.innerHTML.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(<br>)?\s*/);if(!m)return;
    first.innerHTML=first.innerHTML.slice(m[0].length);
    const box=document.createElement('aside');box.className=`callout callout-${m[1].toLowerCase()}`;
    box.innerHTML=`<p class="callout-title">${CALLOUTS[m[1]][state.lang==='zh'?1:0]}</p>`;box.append(...q.childNodes);q.replaceWith(box);
  });
}

// Footnote references open a popover in place; the list at the end stays for print and screen readers.
function enhanceFootnotes(body,cleanups){
  const pop=document.createElement('div');pop.className='footnote-pop';pop.setAttribute('role','tooltip');pop.hidden=true;document.body.append(pop);
  cleanups.push(()=>pop.remove());
  let current=null,hideTimer=0;
  const show=ref=>{
    const note=body.querySelector(decodeURIComponent(ref.getAttribute('href')).replace(/^#(.*)$/,(_,id)=>`[id="${id}"]`));if(!note)return;
    clearTimeout(hideTimer);current=ref;
    const clone=note.cloneNode(true);clone.querySelectorAll('[data-footnote-backref]').forEach(a=>a.remove());
    pop.innerHTML=`<span class="fn-n">${escape(ref.textContent)}</span>${clone.innerHTML}`;pop.hidden=false;
    const r=ref.getBoundingClientRect(),pw=Math.min(340,innerWidth-24);pop.style.width=`${pw}px`;
    const left=Math.min(Math.max(12,r.left+r.width/2-pw/2),innerWidth-pw-12);
    const above=r.top>pop.offsetHeight+90;
    pop.style.left=`${left+scrollX}px`;pop.style.top=`${(above?r.top-pop.offsetHeight-10:r.bottom+10)+scrollY}px`;
    pop.classList.toggle('below',!above);requestAnimationFrame(()=>pop.classList.add('visible'));
  };
  const hide=()=>{hideTimer=setTimeout(()=>{pop.classList.remove('visible');pop.hidden=true;current=null;},120);};
  body.querySelectorAll('[data-footnote-ref]').forEach(ref=>{
    ref.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(ref);});
    ref.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hide();});
    ref.addEventListener('focus',()=>show(ref));ref.addEventListener('blur',hide);
    ref.addEventListener('click',e=>{e.preventDefault();if(current===ref&&!pop.hidden){hide();}else show(ref);});
  });
  pop.addEventListener('pointerenter',()=>clearTimeout(hideTimer));pop.addEventListener('pointerleave',hide);
  const outside=e=>{if(!pop.hidden&&!e.target.closest('[data-footnote-ref],.footnote-pop'))hide();};
  document.addEventListener('pointerdown',outside);cleanups.push(()=>document.removeEventListener('pointerdown',outside));
}

function enhanceFigures(main,body,cleanups){
  const box=main.querySelector('.lightbox'),img=box.querySelector('img'),caption=box.querySelector('p');
  let origin=null;
  const close=()=>{box.classList.remove('open');setTimeout(()=>{box.hidden=true;},state.reducedMotion?0:250);origin?.focus();};
  body.querySelectorAll('.post-figure img').forEach(source=>{
    source.tabIndex=0;source.setAttribute('role','button');
    const open=()=>{origin=source;img.src=source.currentSrc||source.src;img.alt=source.alt;caption.textContent=source.closest('figure').querySelector('figcaption')?.textContent||'';box.hidden=false;requestAnimationFrame(()=>box.classList.add('open'));};
    source.addEventListener('click',open);source.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
  box.addEventListener('click',close);
  const esc=e=>{if(e.key==='Escape'&&!box.hidden)close();};
  document.addEventListener('keydown',esc);cleanups.push(()=>document.removeEventListener('keydown',esc));
}

function buildToc(main,body,cleanups){
  const headings=[...body.querySelectorAll(':scope > h2, :scope > h3')];
  const toc=main.querySelector('.toc'),list=toc.querySelector('ol'),fab=main.querySelector('.toc-fab');
  if(headings.length<2){toc.remove();fab.remove();main.querySelector('.article-shell').classList.add('no-toc');return;}
  list.innerHTML=headings.map(h=>`<li class="level-${h.tagName.toLowerCase()}"><a href="#${h.id}">${escape(h.textContent.replace(/^#/,''))}</a></li>`).join('');
  const links=[...list.querySelectorAll('a')];
  links.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'',a.getAttribute('href'));headings[i].scrollIntoView({behavior:state.reducedMotion?'auto':'smooth'});toc.classList.remove('open');fab.setAttribute('aria-expanded','false');}));
  // Scrollspy: the active heading is the last one above a line 30% down the viewport.
  const spy=()=>{
    const line=innerHeight*.3;let active=0;
    headings.forEach((h,i)=>{if(h.getBoundingClientRect().top<line)active=i;});
    links.forEach((a,i)=>{a.classList.toggle('active',i===active);a.classList.toggle('read',i<active);});
  };
  addEventListener('scroll',spy,{passive:true});spy();
  cleanups.push(()=>removeEventListener('scroll',spy));
  fab.addEventListener('click',()=>{const open=!toc.classList.contains('open');toc.classList.toggle('open',open);fab.setAttribute('aria-expanded',String(open));});
}
