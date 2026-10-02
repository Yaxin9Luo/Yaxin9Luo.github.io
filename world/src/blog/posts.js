// Posts live in ./posts as `<slug>.<lang>.md`. A post may exist in one or both languages;
// the reader falls back to the other language when a translation is missing.
export function parsePost(file,raw){
  const name=file.split('/').pop().replace(/\.md$/,'');
  const [, slug, lang]=name.match(/^(.+)\.(en|zh)$/)||[];
  if(!slug)throw new Error(`Blog post file must be named <slug>.<en|zh>.md: ${file}`);
  const match=raw.replace(/\r\n/g,'\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if(!match)throw new Error(`Blog post is missing front matter: ${file}`);
  const meta={};
  for(const line of match[1].split('\n')){
    const pair=line.match(/^(\w+):\s*(.*)$/);if(!pair)continue;
    // Strip one pair of surrounding quotes only, so titles may end with a quoted phrase.
    let value=pair[2].trim().replace(/^(["'])(.*)\1$/,'$2');
    if(pair[1]==='tags')value=value.replace(/^\[|\]$/g,'').split(',').map(s=>s.trim()).filter(Boolean);
    if(value==='true'||value==='false')value=value==='true';
    meta[pair[1]]=value;
  }
  if(!meta.title||!/^\d{4}-\d{2}-\d{2}$/.test(meta.date||''))throw new Error(`Blog post needs a title and a YYYY-MM-DD date: ${file}`);
  return {slug,lang,title:meta.title,date:meta.date,summary:meta.summary||'',tags:meta.tags||[],placeholder:meta.placeholder===true,draft:meta.draft===true,body:match[2].trim()};
}

// One entry per slug, newest first, each holding its available language versions.
export function collectPosts(files){
  const bySlug=new Map();
  for(const [file,raw] of Object.entries(files)){
    const post=parsePost(file,raw);
    if(!bySlug.has(post.slug))bySlug.set(post.slug,{slug:post.slug,versions:{}});
    bySlug.get(post.slug).versions[post.lang]=post;
  }
  const date=p=>(p.versions.en||p.versions.zh).date;
  return [...bySlug.values()].sort((a,b)=>date(b).localeCompare(date(a))||a.slug.localeCompare(b.slug));
}

// A post is a draft until at least one language version drops `draft: true`.
export const isDraft=post=>Object.values(post.versions).every(v=>v.draft);

export const pickVersion=(post,lang)=>post.versions[lang]||post.versions[lang==='zh'?'en':'zh'];
