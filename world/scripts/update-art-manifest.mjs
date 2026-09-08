// Incremental publishing preserves all existing model derivatives and entries.
// Usage: node scripts/update-art-manifest.mjs [/art/...webp /textures/...webp ...]
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assetManifest} from '../src/asset-manifest.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=process.argv.slice(2);
if(!sources.length)sources.push('/art/experience-v5/mineral-mountains.webp','/art/experience-v5/mineral-mountains-right.webp',...['color','normal','roughness'].map(channel=>`/textures/courtyard-paving/${channel}.webp`));
const entries=[];
for(const source of sources){
  if(!/^\/(art|textures)\/[a-zA-Z0-9_./-]+\.(webp|png|jpg)$/.test(source)||source.includes('..'))throw new Error(`Invalid art source: ${source}`);
  const bytes=await fs.readFile(path.join(root,'public',source));
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const slug=source.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'');
  const url=`/runtime/${slug}.${sha256.slice(0,16)}${path.extname(source)}`;
  entries.push({bytes,entry:{id:source,url,bytes:bytes.byteLength,sha256,phase:2,region:'shared',variant:'full',dependencies:[],source}});
}
await fs.mkdir(path.join(root,'public/runtime'),{recursive:true});
for(const {bytes,entry} of entries){await fs.writeFile(path.join(root,'public',entry.url),bytes);assetManifest[entry.id]=entry;}
await fs.writeFile(path.join(root,'src/asset-manifest.js'),`// Generated from actual bytes by scripts/prepare-runtime-assets.mjs; art updated by scripts/update-art-manifest.mjs.\nexport const assetManifest = ${JSON.stringify(assetManifest,null,2)};\n`);
console.log(JSON.stringify(entries.map(({entry})=>entry),null,2));
