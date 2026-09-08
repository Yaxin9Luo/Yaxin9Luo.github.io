import {publications} from './content.js';
import {getProject} from './exhibition-content.js';

const sections=['about','projects','publications','research','journey','contact','map','settings','quests','controls'];
export const clampMedia=(id,index)=>Math.max(0,Math.min((getProject(id)?.media.length||1)-1,Math.trunc(Number(index)||0)));
export function parseContentRoute(hash=''){
  const raw=hash.replace(/^#\/?/,'');if(!raw)return null;
  const [path,query='']=raw.split('?'),[kind,encodedId]=path.split('/');
  let id;try{id=decodeURIComponent(encodedId||'');}catch{return {kind:'section',id:kind==='paper'?'publications':'projects'};}
  if(kind==='paper')return publications.some(p=>p.id===id)?{kind,id}:{kind:'section',id:'publications'};
  if(kind==='project'){
    if(!getProject(id))return {kind:'section',id:'projects'};
    const params=new URLSearchParams(query);return {kind,id,mediaIndex:clampMedia(id,params.get('media')),spatial:params.get('view')==='stage'};
  }
  if(kind==='section'&&sections.includes(id))return {kind,id};
  return raw==='portfolio'?{kind:'section',id:'about'}:null;
}
export function contentHash(route){
  if(!route)return '';
  let hash=`#${route.kind}/${encodeURIComponent(route.id)}`;
  if(route.kind==='project'){
    const query=new URLSearchParams();if(route.mediaIndex)query.set('media',String(clampMedia(route.id,route.mediaIndex)));
    if(route.spatial)query.set('view','stage');if(query.size)hash+=`?${query}`;
  }
  return hash;
}
export class ReadingMemory{
  constructor(storage){this.entries=new Map();try{this.storage=storage??globalThis.sessionStorage;const saved=JSON.parse(this.storage?.getItem('yaxin.portfolio.reading')||'[]');if(Array.isArray(saved))this.entries=new Map(saved);}catch{/* Reading works without browser storage. */}}
  read(kind,id){const saved=this.entries.get(`${kind}/${id}`);return {mediaIndex:kind==='project'?clampMedia(id,saved?.mediaIndex):0,scrollTop:Math.max(0,Number(saved?.scrollTop)||0)};}
  save(kind,id,patch){const next={...this.read(kind,id),...patch};next.mediaIndex=kind==='project'?clampMedia(id,next.mediaIndex):0;next.scrollTop=Math.max(0,Number(next.scrollTop)||0);this.entries.set(`${kind}/${id}`,next);try{this.storage?.setItem('yaxin.portfolio.reading',JSON.stringify([...this.entries]));}catch{}return next;}
}

/** Keep a completed frame visible while a newer one loads. Late requests cannot win. */
export class MediaSelection{
  constructor(load,apply){this.load=load;this.apply=apply;this.revision=0;this.error=false;this.cache=new Map();}
  async select(src){
    const revision=++this.revision;this.error=false;
    try{
      if(!this.cache.has(src))this.cache.set(src,Promise.resolve(this.load(src)).catch(error=>{this.cache.delete(src);throw error;}));
      const media=await this.cache.get(src);if(revision!==this.revision)return false;
      this.apply(media);return true;
    }catch{if(revision===this.revision)this.error=true;return false;}
  }
  invalidate(){this.revision++;}
}
