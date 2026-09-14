import '../published-three-assets.js';
import {MuseumReader,mountMuseumDirectory,museumInterfaceCopy} from './museum-reader.js';
import {museumEntry} from './museum-content.js';
const url=new URL(location.href);let lang=url.searchParams.get('lang')==='en'?'en':'zh',disposed=false;
function applyLanguage(next){
  lang=next;const t=museumInterfaceCopy[lang];document.documentElement.lang=lang;document.title=lang==='zh'?'圆明园 · 历史展签预览':'Yuanmingyuan · Exhibit preview';
  document.getElementById('heading').textContent=t.museum;document.getElementById('intro').textContent=t.intro;document.getElementById('state').textContent=t.study;document.getElementById('back').textContent='← '+t.back;document.getElementById('back').href='/?lang='+lang;document.getElementById('language').textContent=lang==='zh'?'EN':'中文';document.getElementById('language').setAttribute('aria-label',t.language);document.getElementById('directory').setAttribute('aria-label',t.directory);directory.setLanguage(lang);url.searchParams.set('lang',lang);history.replaceState(null,'',url);
}
const reader=new MuseumReader({lang,onOpen:item=>{url.searchParams.set('entry',item.id);history.replaceState(null,'',url);},onClose:()=>{if(disposed)return;url.searchParams.delete('entry');history.replaceState(null,'',url);},onLanguage:applyLanguage});
const directory=mountMuseumDirectory(document.getElementById('directory'),{lang,onEntry:(id,trigger)=>reader.open(id,{trigger})});
const toggle=()=>{lang=lang==='zh'?'en':'zh';reader.setLanguage(lang);};
document.getElementById('language').addEventListener('click',toggle);applyLanguage(lang);
const initial=url.searchParams.get('entry');if(museumEntry(initial))reader.open(initial);else if(initial){url.searchParams.delete('entry');history.replaceState(null,'',url);}
function dispose(){if(disposed)return;disposed=true;reader.dispose();directory.dispose();document.getElementById('language').removeEventListener('click',toggle);}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
