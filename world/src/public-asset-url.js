import {publishedAssets} from './published-asset-map.js';
const exhibitionBase=()=>globalThis.location?.href??'https://yaxin9luo.github.io/';
export function publicAssetURL(input,baseURL=exhibitionBase()){
 if(import.meta.env?.DEV)return input;
 const value=input instanceof URL?input.href:input;
 if(typeof value!=='string')return input;
 let url,base;try{base=new URL(baseURL);url=new URL(value,base);}catch{return input;}
 if(url.origin!==base.origin||!['http:','https:'].includes(url.protocol))return input;
 const target=publishedAssets[url.pathname];return target?target+url.search+url.hash:input;
}
export function publicAssetResponseMatches(input,responseURL,baseURL=exhibitionBase()){
 if(!responseURL)return true;
 const base=new URL(baseURL),requested=new URL(input,base),actual=new URL(responseURL,base);
 if(actual.origin===base.origin&&['http:','https:'].includes(actual.protocol))return true;
 const expected=publicAssetURL(requested.href,base);
 return expected!==requested.href&&actual.href===expected;
}
export function fetchPublicAsset(input,options){
 if(typeof Request!=='undefined'&&input instanceof Request){
  const target=publicAssetURL(input.url);
  return globalThis.fetch(target===input.url?input:new Request(target,input),options);
 }
 return globalThis.fetch(publicAssetURL(input),options);
}
