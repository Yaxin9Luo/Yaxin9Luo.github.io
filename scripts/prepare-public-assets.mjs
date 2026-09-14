import {readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'scripts/published-assets.json'),'utf8'));
let originalBytes=0;
for(const [relative,record] of Object.entries(manifest.files)){
 if(!relative.startsWith('/')||relative.split('/').includes('..'))throw new Error('Invalid public asset path');
 const source=path.join(root,'world/public',relative),output=path.join(root,'world/dist',relative);
 const bytes=await readFile(source);
 if(bytes.length!==record.bytes||createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error('Published original bytes changed: '+relative);
 originalBytes+=bytes.length;
 await rm(output,{force:true});
}
const release={version:'2026.09.14.2',commit:process.env.GITHUB_SHA??process.env.SITE_REVISION??null,assetRevision:manifest.revision,builtAt:new Date().toISOString(),externalAssets:Object.keys(manifest.files).length,originalAssetBytes:originalBytes,museumStatus:'Work in progress; Western Buildings route and Jiuzhou study available'};
await writeFile(path.join(root,'world/dist/release.json'),JSON.stringify(release,null,2)+'\n');
console.log('Pinned original asset delivery:',JSON.stringify(release));
