import {state,t,escape,postHref,formatDate,minutes,nameTitleForTransition} from './blog.js';
import {pickVersion} from './posts.js';
import {startSky} from './sky.js';
import './home.css';

const tags=v=>v.tags.map(tag=>`<span>${escape(tag)}</span>`).join('');
const pad=n=>String(n).padStart(2,'0');

export function mount(main){
  const lang=state.lang;
  const entries=state.posts.map((post,i)=>({post,v:pickVersion(post,lang),number:state.posts.length-i}));
  const topics=[...new Set(entries.flatMap(e=>e.v.tags))];
  const [latest]=entries;
  document.title=lang==='zh'?'Yaxin 的博客':'Yaxin\'s Blog';
  const title=lang==='zh'?'<span class="w">Yaxin</span> <span class="w">的</span><em class="w">博客</em>':'<span class="w">Yaxin\'s</span> <em class="w">Blog</em>';

  main.innerHTML=`<section class="hero">
    <canvas class="sky" aria-hidden="true"></canvas><div class="sky-tip" role="status" aria-live="polite" hidden></div>
    <div class="hero-inner">
      <div class="hero-eyebrow reveal"><span></span>${t('eyebrow')}</div>
      <h1 class="hero-title">${title}</h1>
      <p class="hero-intro reveal">${t('intro')}</p>
      <div class="hero-stats reveal"><span><b>${entries.length}</b> ${t('postsCount')}</span><i></i><span><b>${topics.length}</b> ${t('topicsCount')}</span><i></i><span class="hint">✦ ${t(matchMedia('(hover: none)').matches?'exploreTouch':'explore')}</span></div>
    </div>
    <a class="scroll-cue" href="#posts" aria-label="${t('scroll')}"><span>${t('scroll')}</span><i></i></a>
  </section>
  <section class="posts" id="posts">
    ${latest?`<a class="featured spotlight reveal" href="${postHref(latest.post.slug)}">
      <div class="featured-number" aria-hidden="true">${pad(latest.number)}</div>
      <div class="featured-body"><div class="featured-label">✦ ${t('latest')} · <time datetime="${latest.v.date}">${formatDate(latest.v.date)}</time> · ${minutes(latest.v.body)} ${t('read')}</div>
      <h2>${escape(latest.v.title)}</h2><p>${escape(latest.v.summary)}</p>
      <div class="chips">${tags(latest.v)}${latest.v.placeholder?`<span class="draft">${t('placeholder')}</span>`:''}${latest.v.draft?`<span class="draft">${t('draft')}</span>`:''}</div></div>
      <span class="featured-arrow" aria-hidden="true">→</span></a>`:''}
    <h2 class="list-heading reveal"><span></span>${t('all')}<small>${entries.length}</small></h2>
    <div class="controls reveal">
      <div class="topic-filter" role="group" aria-label="Topics"><button type="button" aria-pressed="true" data-topic="">${t('allTopics')}</button>${topics.map(tag=>`<button type="button" aria-pressed="false" data-topic="${escape(tag)}">${escape(tag)}<small>${entries.filter(e=>e.v.tags.includes(tag)).length}</small></button>`).join('')}</div>
      <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" placeholder="${t('search')}" aria-label="${t('search')}"/><kbd>/</kbd></label>
    </div>
    <ol class="post-list">${entries.map(({post,v,number})=>`<li class="reveal" data-tags="${escape(v.tags.join('|'))}" data-text="${escape(`${v.title} ${v.summary} ${v.tags.join(' ')}`.toLowerCase())}">
      <a class="post-row spotlight" href="${postHref(post.slug)}">
        <span class="row-number">${pad(number)}</span>
        <div class="row-main"><h3>${escape(v.title)}</h3><p>${escape(v.summary)}</p><div class="chips">${tags(v)}${v.placeholder?`<span class="draft">${t('placeholder')}</span>`:''}${v.draft?`<span class="draft">${t('draft')}</span>`:''}</div></div>
        <div class="row-meta"><time datetime="${v.date}">${formatDate(v.date)}</time><span>${minutes(v.body)} ${t('read')}</span></div>
        <span class="row-arrow" aria-hidden="true">→</span></a></li>`).join('')}</ol>
    <p class="empty" hidden>${t('empty')}</p>
  </section>
  <footer class="home-footer"><img src="/crest.svg" alt=""/><span>YAXIN LUO · MMXXVI</span><a href="/">← ${t('back')}</a></footer>`;

  const cleanups=[];
  cleanups.push(startSky(main.querySelector('.hero'),main.querySelector('.sky'),{lang,reducedMotion:state.reducedMotion,tip:main.querySelector('.sky-tip')}));

  // Staggered entrance for the title words and scroll reveals for everything else.
  main.querySelectorAll('.hero-title .w').forEach((w,i)=>w.style.setProperty('--d',`${120+i*110}ms`));
  requestAnimationFrame(()=>main.querySelector('.hero').classList.add('in'));
  const io=new IntersectionObserver(items=>items.forEach(item=>{if(item.isIntersecting){item.target.classList.add('in');io.unobserve(item.target);}}),{rootMargin:'0px 0px -8% 0px'});
  main.querySelectorAll('.reveal').forEach((el,i)=>{el.style.setProperty('--d',`${Math.min(i,8)*60}ms`);io.observe(el);});
  cleanups.push(()=>io.disconnect());

  // Cursor spotlight on cards.
  const spot=e=>{const card=e.target.closest('.spotlight');if(!card)return;const box=card.getBoundingClientRect();card.style.setProperty('--mx',`${e.clientX-box.left}px`);card.style.setProperty('--my',`${e.clientY-box.top}px`);};
  main.addEventListener('pointermove',spot);

  // Topic chips and search filter the list together.
  const input=main.querySelector('.search input'),rows=[...main.querySelectorAll('.post-list li')],empty=main.querySelector('.empty');
  let topic='';
  const apply=()=>{
    const q=input.value.trim().toLowerCase();let shown=0;
    for(const row of rows){const ok=(!topic||row.dataset.tags.split('|').includes(topic))&&(!q||row.dataset.text.includes(q));row.hidden=!ok;if(ok)shown++;}
    empty.hidden=shown>0;
  };
  main.querySelector('.topic-filter').addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;topic=button.dataset.topic;
    main.querySelectorAll('.topic-filter button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));apply();
  });
  input.addEventListener('input',apply);
  const slash=e=>{if(e.key==='/'&&document.activeElement!==input&&!e.metaKey&&!e.ctrlKey){e.preventDefault();input.focus();input.scrollIntoView({block:'center',behavior:state.reducedMotion?'auto':'smooth'});}
    if(e.key==='Escape'&&document.activeElement===input){input.value='';apply();input.blur();}};
  document.addEventListener('keydown',slash);
  cleanups.push(()=>document.removeEventListener('keydown',slash));

  main.addEventListener('click',e=>{const link=e.target.closest('.featured,.post-row');if(link&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey)nameTitleForTransition(link.querySelector('h2,h3'));});

  // The hero text drifts up and fades as the page scrolls; the sky handles its own depth.
  const hero=main.querySelector('.hero');let ticking=false;
  const onScroll=()=>{if(ticking||state.reducedMotion)return;ticking=true;requestAnimationFrame(()=>{ticking=false;const p=Math.min(1,Math.max(0,scrollY/hero.offsetHeight));hero.style.setProperty('--sp',p.toFixed(3));});};
  addEventListener('scroll',onScroll,{passive:true});cleanups.push(()=>removeEventListener('scroll',onScroll));

  main.querySelector('.scroll-cue').addEventListener('click',e=>{e.preventDefault();main.querySelector('#posts').scrollIntoView({behavior:state.reducedMotion?'auto':'smooth'});});
  return ()=>cleanups.forEach(fn=>fn());
}
