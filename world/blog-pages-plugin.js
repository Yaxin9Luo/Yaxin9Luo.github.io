import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectPosts,pickVersion,isDraft} from './src/blog/posts.js';

const postsDir=fileURLToPath(new URL('./src/blog/posts/',import.meta.url));
const SITE='https://yaxin9luo.github.io';
// /blog/<slug>/ with an optional query; files such as /blog/figure.svg are left alone.
const POST_PATH=/^\/blog\/([a-z0-9][a-z0-9-]*)\/?(\?.*)?$/;
const escapeHtml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// The blog's share card (1200×630, rendered by scripts/og/render.mjs); every post page uses it.
export const BLOG_CARD={url:`${SITE}/og/blog.png`,width:1200,height:630,alt:'Yaxin\'s Blog by Yaxin Luo: notes on multimodal models, agent harnesses, and what I learn while doing research. Shown on a design canvas beside a moonlit cover.'};

export function readPosts(directory=postsDir){
  const files=Object.fromEntries(fs.readdirSync(directory).filter(f=>f.endsWith('.md')).map(f=>[`./posts/${f}`,fs.readFileSync(path.join(directory,f),'utf8')]));
  return collectPosts(files);
}

// Each published post gets its own copy of the blog shell, so shared links carry the post's title and summary.
export function postPageHtml(shell,post){
  const v=pickVersion(post,'en'),url=`${SITE}/blog/${post.slug}/`,title=`${v.title} — Yaxin's Blog`;
  const meta=[
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeHtml(v.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(v.summary)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="Yaxin's Blog" />`,
    `<meta property="og:image" content="${BLOG_CARD.url}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="${BLOG_CARD.width}" />`,
    `<meta property="og:image:height" content="${BLOG_CARD.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(BLOG_CARD.alt)}" />`,
    `<meta property="article:published_time" content="${v.date}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${BLOG_CARD.url}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(BLOG_CARD.alt)}" />`,
  ].join('\n    ');
  return shell
    .replace(/<html lang="[^"]*">/,`<html lang="${v.lang==='zh'?'zh-CN':'en'}">`)
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/,`<meta name="description" content="${escapeHtml(v.summary)}" />`)
    .replace(/<!-- blog-page-meta -->[\s\S]*?<!-- \/blog-page-meta -->/,meta);
}

export function blogPagesPlugin(){
  let outDir='';
  return {
    name:'blog-pages',
    configResolved(config){outDir=path.resolve(config.root,config.build.outDir);},
    configureServer(server){
      server.middlewares.use((req,res,next)=>{const m=(req.url||'').match(POST_PATH);if(m)req.url=`/blog/index.html${m[2]||''}`;next();});
    },
    closeBundle(){
      const shellPath=path.join(outDir,'blog/index.html');
      if(!fs.existsSync(shellPath))return;
      const shell=fs.readFileSync(shellPath,'utf8');
      for(const post of readPosts()){
        if(isDraft(post))continue;
        const target=path.join(outDir,'blog',post.slug,'index.html');
        fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.writeFileSync(target,postPageHtml(shell,post));
      }
    },
  };
}
