import {collectPosts,isDraft} from './posts.js';
import './blog.css';

// Drafts show up while writing locally (`npm run dev`) and are left out of the published site.
const posts=collectPosts(import.meta.glob('./posts/*.md',{query:'?raw',import:'default',eager:true})).filter(p=>!import.meta.env.PROD||!isDraft(p));
// The blog keeps its own language choice and opens in English unless asked otherwise.
const LANG_KEY='yaxin.blog.lang';

const copy={
  back:['Portfolio','个人主页'],all:['All posts','全部文章'],
  eyebrow:['NOTEBOOK · MMXXVI','笔记 · MMXXVI'],
  intro:['Notes on multimodal models, agent harnesses, and what I learn while doing research.','关于多模态模型、Agent Harness，以及做研究时学到的东西。'],
  read:['min read','分钟阅读'],empty:['No posts match.','没有匹配的文章。'],latest:['Latest','最新'],
  search:['Search posts','搜索文章'],allTopics:['All','全部'],postsCount:['posts','篇文章'],topicsCount:['topics','个主题'],
  placeholder:['Placeholder','占位'],draft:['Draft','草稿'],draftNote:['Draft — visible only on your local preview, not on the published site.','草稿：只在本地预览中可见，不会出现在线上网站。'],placeholderNote:['Placeholder post — a layout preview, not a real article.','占位文章：用于预览版式，并非正式内容。'],
  missing:['This post does not exist.','没有找到这篇文章。'],onlyIn:['This post is only available in','这篇文章目前只有'],
  en:['English','英文版'],zh:['Chinese','中文版'],contents:['Contents','目录'],copied:['Link copied','链接已复制'],
  copy:['Copy','复制'],copiedCode:['Copied','已复制'],newer:['Newer','较新'],older:['Older','较早'],top:['Back to top','回到顶部'],
  scroll:['Scroll','向下'],section:['Link to section','本节链接'],quote:['Copy quote','复制引用'],quoteCopied:['Quote copied with a link to this section','已复制引用及本节链接'],explore:['Hover a constellation · click the moon','把鼠标移到星座上 · 点击月亮'],exploreTouch:['Tap a constellation · tap the moon','轻点星座 · 轻点月亮'],
};

function readLang(){
  const query=new URLSearchParams(location.search).get('lang');
  if(['en','zh'].includes(query))return query;
  try{const saved=localStorage.getItem(LANG_KEY);if(['en','zh'].includes(saved))return saved;}catch{/* Storage is optional. */}
  return 'en';
}

export const state={posts,lang:readLang(),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
export const t=key=>copy[key]?.[state.lang==='zh'?1:0]??key;
export const escape=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const postHref=slug=>`/blog/${encodeURIComponent(slug)}/`;
// Posts live at /blog/<slug>/; early ?post=<slug> links are moved there.
function currentSlug(){
  const legacy=new URLSearchParams(location.search).get('post');
  if(legacy){const url=new URL(location.href);url.searchParams.delete('post');url.pathname=postHref(legacy);history.replaceState(null,'',url);return legacy;}
  const m=location.pathname.match(/^\/blog\/([^/]+)\/?$/);
  return m&&m[1]!=='index.html'?decodeURIComponent(m[1]):null;
}
export function formatDate(date){
  const [y,m,d]=date.split('-').map(Number);
  return state.lang==='zh'?`${y} 年 ${m} 月 ${d} 日`:new Date(Date.UTC(y,m-1,d)).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
// Chinese reads at roughly 400 characters a minute, English at roughly 220 words.
export function minutes(body){
  const text=body.replace(/```[\s\S]*?```/g,'');
  const han=(text.match(/[一-鿿]/g)||[]).length,words=(text.replace(/[一-鿿]/g,' ').match(/\S+/g)||[]).length;
  return Math.max(1,Math.round(han/400+words/220));
}

function header(){
  return `<header class="blog-topbar"><a class="blog-brand" href="/blog/" aria-label="Yaxin's Blog"><img src="/crest.svg" alt=""/><span>YAXIN'S BLOG<small>BY YAXIN LUO</small></span></a>
  <nav class="blog-nav"><a href="/blog/" class="blog-nav-link nav-all">${t('all')}</a><a href="/" class="blog-nav-link">← ${t('back')}</a></nav>
  <button class="blog-lang" type="button" aria-label="Switch language / 切换语言"><span class="${state.lang==='en'?'active':''}">EN</span><i>/</i><span class="${state.lang==='zh'?'active':''}">中</span></button></header>`;
}

let dispose=()=>{};
async function render(){
  dispose();
  document.documentElement.lang=state.lang==='zh'?'zh-CN':'en';
  const slug=currentSlug();
  const root=document.getElementById('blog');
  document.body.className=slug?'blog-article-page':'blog-home-page';
  root.innerHTML=`${header()}<main id="blog-main"></main><div class="blog-toast" role="status" aria-live="polite"></div>`;
  root.querySelector('.blog-lang').addEventListener('click',switchLanguage);
  const main=root.querySelector('#blog-main');
  const view=slug?await import('./article.js'):await import('./home.js');
  dispose=await view.mount(main,slug)||(()=>{});
}

function switchLanguage(){
  state.lang=state.lang==='en'?'zh':'en';
  try{localStorage.setItem(LANG_KEY,state.lang);}catch{/* Storage is optional. */}
  const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',state.lang);history.replaceState(null,'',url);}
  const y=scrollY;render().then(()=>scrollTo(0,y));
}

// Name the clicked title so it can morph into the next page's heading; one name per page at a time.
export function nameTitleForTransition(el){
  document.querySelectorAll('.vt-title').forEach(n=>{n.classList.remove('vt-title');n.style.viewTransitionName='';});
  if(el){el.classList.add('vt-title');el.style.viewTransitionName='post-title';}
}
addEventListener('pageshow',e=>{if(e.persisted)nameTitleForTransition(null);});

export function toast(message){
  const el=document.querySelector('.blog-toast');if(!el)return;
  el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),1600);
}

render();
