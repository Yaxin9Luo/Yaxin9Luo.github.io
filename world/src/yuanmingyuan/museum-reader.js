import {museumEntry,museumEntries,museumImages,museumSources,museumRegions,searchMuseumEntries} from './museum-content.js';

const copy={
  zh:{museum:'圆明园',label:'历史展签',directory:'展览目录',search:'搜索建筑、展品与水景',all:'全部',close:'关闭展签',sources:'资料来源',related:'继续阅读',note:'关于复原',image:'查看原图',previous:'上一幅',next:'下一幅',empty:'没有找到相关展签。',reset:'清空搜索',read:'阅读展签',count:n=>`${n} 条展签`,imageCount:(n,total)=>`图像 ${n} / ${total}`,regions:'园区',back:'返回个人主页',subtitle:'从一幅史图，走进一座园林。',intro:'圆明三园的建筑、水景与历史。',study:'展签制作预览 · 园区模型仍在制作中',language:'Read in English'},
  en:{museum:'Yuanmingyuan',label:'HISTORICAL EXHIBIT',directory:'Exhibition directory',search:'Search buildings, objects and water gardens',all:'All gardens',close:'Close exhibit',sources:'Sources',related:'Continue reading',note:'About the reconstruction',image:'View original image',previous:'Previous image',next:'Next image',empty:'No exhibits match this search.',reset:'Clear search',read:'Read exhibit',count:n=>`${n} ${n===1?'exhibit':'exhibits'}`,imageCount:(n,total)=>`Image ${n} / ${total}`,regions:'Gardens',back:'Back to portfolio',subtitle:'A garden, seen through its histories.',intro:'Architecture, water and life in the three gardens.',study:'Exhibit preview · Garden models are still in production',language:'阅读中文'},
};
function node(doc,tag,cls,text){const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function link(doc,label,url,cls){const el=node(doc,'a',cls,label);el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el;}

// Entry identity is shared by directory, scene E interactions, guides and URL links.
export class MuseumReader {
  constructor({parent=document.body,lang='zh',onOpen=()=>{},onClose=()=>{},onLanguage=()=>{}}={}){
    this.doc=parent.ownerDocument;this.lang=lang==='en'?'en':'zh';this.onOpen=onOpen;this.onClose=onClose;this.onLanguage=onLanguage;this.current=null;this.returnFocus=null;this.imageIndex=0;this.disposed=false;
    this.dialog=node(this.doc,'dialog','museum-dialog');this.dialog.setAttribute('aria-labelledby','museum-exhibit-title');parent.append(this.dialog);
    this.handleClick=event=>{const button=event.target.closest('[data-museum-action]');if(!button||!this.dialog.contains(button))return;const action=button.dataset.museumAction;if(action==='close')this.close();else if(action==='language')this.setLanguage(this.lang==='zh'?'en':'zh');else if(action==='related')this.open(button.dataset.entry);else if(action==='image'){const step=Number(button.dataset.step);this.imageIndex=(this.imageIndex+step+this.current.images.length)%this.current.images.length;this.render();this.dialog.querySelector('[data-museum-action="image"][data-step="'+step+'"]')?.focus();}};
    this.handleCancel=event=>{event.preventDefault();this.close();};
    this.handleClosed=()=>{if(this.dialog.open||!this.current)return;this.current=null;this.onClose();const target=this.returnFocus?.isConnected?this.returnFocus:this.returnFocusId?this.doc.getElementById(this.returnFocusId):null;this.returnFocus=null;this.returnFocusId=null;if(target?.isConnected&&!target.closest('[hidden],[inert]'))target.focus({preventScroll:true});};
    this.dialog.addEventListener('click',this.handleClick);this.dialog.addEventListener('cancel',this.handleCancel);this.dialog.addEventListener('close',this.handleClosed);
  }
  get isOpen(){return !!this.current&&this.dialog.open;}
  button(text,action){const el=node(this.doc,'button','museum-button',text);el.type='button';el.dataset.museumAction=action;return el;}
  open(id,{trigger}={}){
    const item=museumEntry(id);if(this.disposed||!item)return false;
    const first=!this.dialog.open;if(first){this.returnFocus=trigger||this.doc.activeElement;this.returnFocusId=this.returnFocus?.id||null;}
    this.current=item;this.imageIndex=0;this.render();
    if(first){this.dialog.showModal();this.onOpen(item);}else this.onOpen(item);
    this.dialog.querySelector('h2').focus({preventScroll:true});return true;
  }
  setLanguage(lang){
    if(this.disposed)return;this.lang=lang==='en'?'en':'zh';
    if(this.current){this.render();this.dialog.querySelector('[data-museum-action="language"]')?.focus();}
    this.onLanguage(this.lang);
  }
  render(){
    const {doc,lang,current:item}=this,t=copy[lang];this.dialog.lang=lang;
    const header=node(doc,'header','museum-dialog-header'),identity=node(doc,'div');
    identity.append(node(doc,'span','museum-eyebrow',t.museum),node(doc,'span','museum-dialog-label',t.label));
    const controls=node(doc,'div','museum-dialog-controls'),language=this.button(lang==='zh'?'EN':'中文','language');language.setAttribute('aria-label',t.language);
    const close=this.button('×','close');close.setAttribute('aria-label',t.close);controls.append(language,close);header.append(identity,controls);
    const body=node(doc,'div','museum-exhibit-body'),article=node(doc,'article','museum-exhibit-copy'),intro=node(doc,'div','museum-exhibit-intro'),region=museumRegions.find(value=>value.id===item.region);
    intro.append(node(doc,'p','museum-eyebrow',region.title[lang]));const title=node(doc,'h2','',item.title[lang]);title.id='museum-exhibit-title';title.tabIndex=-1;
    intro.append(title,node(doc,'p','museum-lead',item.lead[lang]));
    for(const paragraph of item.paragraphs)article.append(node(doc,'p','',paragraph[lang]));
    if(item.note){const note=node(doc,'aside','museum-evidence-note');note.append(node(doc,'strong','',t.note),node(doc,'p','',item.note[lang]));article.append(note);}
    const sources=node(doc,'details','museum-source-list');sources.append(node(doc,'summary','',t.sources));
    const list=node(doc,'ol');for(const id of item.sources){const source=museumSources[id],li=node(doc,'li');li.append(link(doc,source.title[lang],source.url),node(doc,'small','',source.kind[lang]));list.append(li);}sources.append(list);article.append(sources);
    if(item.related.length){const related=node(doc,'nav','museum-related');related.setAttribute('aria-label',t.related);related.append(node(doc,'span','museum-eyebrow',t.related));for(const id of item.related){const button=this.button(museumEntry(id).title[lang]+' ↗','related');button.dataset.entry=id;related.append(button);}article.append(related);}
    if(item.images.length){
      const media=node(doc,'section','museum-exhibit-media'),figure=node(doc,'figure'),asset=museumImages[item.images[this.imageIndex]],img=node(doc,'img');img.src=asset.src;img.alt=asset.title[lang];img.decoding='async';if(asset.width)img.width=asset.width;if(asset.height)img.height=asset.height;
      const caption=node(doc,'figcaption');caption.append(node(doc,'strong','',asset.title[lang]),node(doc,'p','',asset.caption[lang]),link(doc,asset.credit[lang],asset.source),node(doc,'small','',asset.license));
      if(asset.originalDate)caption.append(node(doc,'p','museum-image-date',asset.originalDate[lang]));
      figure.append(img,caption);media.append(figure);
      const mediaTools=node(doc,'div','museum-media-tools');mediaTools.append(link(doc,t.image+' ↗',asset.fullSrc||asset.src,'museum-button'));
      if(item.images.length>1){const prev=this.button('←','image'),next=this.button('→','image');prev.dataset.step='-1';next.dataset.step='1';prev.setAttribute('aria-label',t.previous);next.setAttribute('aria-label',t.next);const count=node(doc,'span','',t.imageCount(this.imageIndex+1,item.images.length));count.setAttribute('aria-live','polite');mediaTools.append(prev,count,next);}
      media.append(mediaTools);body.append(media);
    }
    body.append(article);this.dialog.classList.toggle('museum-dialog-text-only',!item.images.length);this.dialog.replaceChildren(header,intro,body);
  }
  close(){if(!this.disposed&&this.dialog.open)this.dialog.close();}
  dispose(){
    if(this.disposed)return;this.disposed=true;const wasOpen=!!this.current;this.dialog.removeEventListener('click',this.handleClick);this.dialog.removeEventListener('cancel',this.handleCancel);this.dialog.removeEventListener('close',this.handleClosed);if(this.dialog.open)this.dialog.close();this.dialog.remove();this.current=null;if(wasOpen)this.onClose();this.returnFocus=null;this.returnFocusId=null;
  }
}

export function mountMuseumDirectory(parent,{lang='zh',onEntry=()=>{},onLanguage=()=>{}}={}){
  const doc=parent.ownerDocument;let language=lang==='en'?'en':'zh',query='',region='all',disposed=false;
  const form=node(doc,'div','museum-directory-tools'),search=node(doc,'input','museum-search');search.type='search';
  const filters=node(doc,'nav','museum-region-filters'),results=node(doc,'div','museum-directory-grid'),count=node(doc,'p','museum-count');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
  const change=event=>{const button=event.target.closest('[data-entry]');if(button&&results.contains(button))onEntry(button.dataset.entry,button);};
  const filter=event=>{const button=event.target.closest('[data-region]');if(!button)return;region=button.dataset.region;render();};
  const input=()=>{query=search.value;renderResults();};
  function renderResults(){
    const entries=searchMuseumEntries(query,region),t=copy[language];count.textContent=t.count(entries.length);results.replaceChildren();
    for(const item of entries){const card=node(doc,'button','museum-directory-card');card.type='button';card.id='museum-entry-'+item.id;card.dataset.entry=item.id;card.append(node(doc,'span','museum-eyebrow',museumRegions.find(value=>value.id===item.region).title[language]),node(doc,'h3','',item.title[language]),node(doc,'p','',item.lead[language]),node(doc,'span','museum-card-arrow',t.read+' ↗'));results.append(card);}
    if(!entries.length){const empty=node(doc,'div','museum-empty');empty.append(node(doc,'p','',t.empty));const reset=node(doc,'button','museum-button',t.reset);reset.type='button';reset.addEventListener('click',()=>{query='';region='all';search.value='';render();search.focus();},{once:true});empty.append(reset);results.append(empty);}
  }
  function render(){
    const focusId=parent.contains(doc.activeElement)?doc.activeElement.id:null,t=copy[language];parent.lang=language;search.placeholder=t.search;search.setAttribute('aria-label',t.search);filters.setAttribute('aria-label',t.regions);filters.replaceChildren();
    for(const value of [{id:'all',title:{zh:copy.zh.all,en:copy.en.all}},...museumRegions]){const button=node(doc,'button','',value.title[language]);button.type='button';button.id='museum-region-'+value.id;button.dataset.region=value.id;button.setAttribute('aria-pressed',String(value.id===region));filters.append(button);}renderResults();if(focusId)doc.getElementById(focusId)?.focus({preventScroll:true});
  }
  search.addEventListener('input',input);filters.addEventListener('click',filter);results.addEventListener('click',change);form.append(search,filters);parent.append(form,count,results);render();
  return {setLanguage(next){if(disposed)return;language=next==='en'?'en':'zh';render();onLanguage(language);},dispose(){if(disposed)return;disposed=true;search.removeEventListener('input',input);filters.removeEventListener('click',filter);results.removeEventListener('click',change);form.remove();count.remove();results.remove();}};
}
export {copy as museumInterfaceCopy};
