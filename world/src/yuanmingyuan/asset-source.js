import {loadYuanmingyuanArchive,archiveSHA256} from './asset-archive.js';
import {getStudioAsset} from './studio-assets.js';

// Entries are admitted only after a native comparison with their source model.
// The digest in each URL keeps a deployed manifest tied to its archived bytes.
export const museumArchiveCatalog=Object.freeze({
  'zhengjuesi':'/assets/yuanmingyuan/zhengjuesi/cfe62c4d8102267f-gzip-bin-v1/manifest.json',
  'fanghe-xianfahua':'/assets/yuanmingyuan/fanghe-xianfahua/199f9f5895a303c1-gzip-bin-v1/manifest.json',
  'yangquelong':'/assets/yuanmingyuan/yangquelong/13ee5051e3720e8d-gzip-bin-v1/manifest.json',
  'xianfashan':'/assets/yuanmingyuan/xianfashan/9091fc3b7c570b68-gzip-bin-v2/manifest.json',
  'fangwaiguan':'/assets/yuanmingyuan/fangwaiguan/929abe70e1e73b07-gzip-bin-v2/manifest.json',
});
// Three source/archive views were compared at native resolution before this
// transport was admitted; the complete garden composition remains under review.
const approvedManifestHashes={
  xianfashan:'38cc3beeefed3295c0823da0008d4562610418fc629974e2c2fb03e68d8c2e34',
  fangwaiguan:'3ad2069a8d321a29e2f9793dcc3c0ef8e67fa4824f8c50d9bbf5808ef9ec92a4',
};

export async function loadMuseumArchive(id,manifestURL,{signal,fetcher=fetch,load=loadYuanmingyuanArchive,baseURL=location.href,expectedManifestSHA256}={}){
  signal?.throwIfAborted();
  const url=new URL(manifestURL,baseURL);
  if(url.origin!==new URL(baseURL).origin)throw new Error('Museum archive must be hosted with this exhibition.');
  const response=await fetcher(url.href,{signal,redirect:'error'});
  if(!response.ok)throw new Error(`Museum archive manifest HTTP ${response.status}`);
  let manifest;
  if(expectedManifestSHA256!==undefined){
    if(!/^[a-f0-9]{64}$/.test(expectedManifestSHA256))throw new Error('A full SHA256 is required for the approved museum manifest.');
    const bytes=await response.arrayBuffer();if(await archiveSHA256(bytes)!==expectedManifestSHA256)throw new Error('Museum archive approved manifest SHA256 mismatch.');manifest=JSON.parse(new TextDecoder().decode(bytes));
  }else manifest=await response.json();
  signal?.throwIfAborted();
  if(manifest.id!==id)throw new Error(`Archive identity mismatch: expected ${id}`);
  const files={};
  for(const key of ['glb','runtime']){
    const file=manifest[key];
    if(!file||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error(`Invalid museum archive ${key}`);
    const resolveFile=entry=>{if(typeof entry?.url!=='string'||!entry.url)throw new Error(`Invalid museum archive ${key} URL`);const resolved=new URL(entry.url,url);if(resolved.origin!==url.origin)throw new Error('Museum archive files must share the exhibition origin.');return {...entry,url:resolved.href};};
    if(file.parts!==undefined){if(file.url!==undefined||!Array.isArray(file.parts)||!file.parts.length)throw new Error(`Invalid museum archive ${key} parts`);files[key]={...file,parts:file.parts.map(resolveFile)};}
    else files[key]=resolveFile(file);
  }
  return load({id,...files},{signal});
}

export async function loadMuseumModel(id,{signal}={}){
  if(museumArchiveCatalog[id])return loadMuseumArchive(id,museumArchiveCatalog[id],{signal,expectedManifestSHA256:approvedManifestHashes[id]});
  const config=getStudioAsset(id);
  if(config.id!==id)throw new Error(`Unknown museum model ${id}`);
  const factory=await config.loadFactory({signal});signal?.throwIfAborted();
  return factory();
}
