import '../published-three-assets.js';
import {inspectFullWillowContext} from './shore-willow-context-diagnostic.js';
import {xianfaShorePreparedData,readPreparedShoreSource} from './xianfa-shore-community-prepared-data.js';
import {shoreSHA256} from './xianfa-shore-community-prepared-signature.js';
import diagnosticSource from './shore-willow-context-diagnostic.js?raw';
import pageSource from './shore-willow-context-check.js?raw';

const $=id=>document.getElementById(id),controller=new AbortController();let running=false,disposed=false,last=null,serial=0;
addEventListener('pagehide',()=>{disposed=true;controller.abort();},{once:true});
const get=async url=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('HTTP '+r.status+': '+url);return new Uint8Array(await r.arrayBuffer());};
$('run').addEventListener('click',async()=>{
  if(running||disposed)return;running=true;last=null;$('run').disabled=$('save').disabled=true;document.body.dataset.status='running';$('status').textContent='正在检查输入身份… / Checking inputs…';
  try{
    const bytes=await get(xianfaShorePreparedData.manifestURL),manifestSHA256=await shoreSHA256(bytes);controller.signal.throwIfAborted();
    if(bytes.length!==xianfaShorePreparedData.manifestBytes||manifestSHA256!==xianfaShorePreparedData.manifestSHA256)throw new Error('Original production manifest identity differs');
    const manifest=JSON.parse(new TextDecoder().decode(bytes)),reference=JSON.parse(new TextDecoder().decode(await get('/assets/yuanmingyuan/shore-willow-context-check-r1/reference.json'))),referenceBytes=await get(reference.binary.url);
    if(referenceBytes.length!==reference.binary.bytes||await shoreSHA256(referenceBytes)!==reference.binary.sha256)throw new Error('Canonical diagnostic bytes differ');
    controller.signal.throwIfAborted();
    const result=await inspectFullWillowContext({manifest,readSource:readPreparedShoreSource,signal:controller.signal,reference,referenceBytes,runtime:{userAgent:navigator.userAgent,platform:navigator.platform},onProgress:phase=>{if(!disposed)$('status').textContent=phase;}});
    result.sourceIdentity=(await shoreSHA256(diagnosticSource+'\n'+pageSource)).slice(0,16);result.diagnosticSources={diagnosticSHA256:await shoreSHA256(diagnosticSource),pageSHA256:await shoreSHA256(pageSource)};result.manifest={sha256:manifestSHA256,path:xianfaShorePreparedData.manifestURL};result.reference={binary:reference.binary,legacySHA256:reference.legacySHA256};result.capturedAt=new Date().toISOString();controller.signal.throwIfAborted();last=result;
    $('identity').textContent=JSON.stringify({sourceIdentity:result.sourceIdentity,manifest:result.manifest,runtime:result.runtime,sourceIdentities:result.sourceIdentities},null,2);
    $('summary').textContent=JSON.stringify({legacySHA256:result.legacySHA256,expected:manifest.willowSourceSignature,legacyMatches:result.legacyMatches,metadataMatches:result.metadataMatches,statistics:result.statistics,diagnostics:result.diagnostics,differences:result.streams.filter(s=>!s.matches).map(({difference,...s})=>({...s,difference:difference?Object.fromEntries(Object.entries(difference).filter(([k])=>k!=='changes')):null}))},null,2);
    $('attributes').textContent=JSON.stringify(result.streams.map(({difference,...s})=>({...s,difference:difference?{...difference,changes:'Complete changed values are included in saved JSON'}:null})),null,2);
    document.body.dataset.status=result.legacyMatches?'match':'mismatch';$('status').textContent='检查完成，源已释放 / Check complete; sources disposed';$('save').disabled=false;
  }catch(error){if(!disposed){document.body.dataset.status='failed';$('status').textContent=error.message;$('summary').textContent=error.stack??String(error);}}
  finally{running=false;if(!disposed)$('run').disabled=false;}
});
$('save').addEventListener('click',async()=>{
  if(!last||disposed||running)return;const name=`shore-willow-context-check-${last.sourceIdentity}-${Date.now()}-${++serial}.json`,body=JSON.stringify(last);running=true;$('run').disabled=$('save').disabled=true;
  try{const r=await fetch('/__review_capture/'+name,{method:'POST',body,headers:{'Content-Type':'application/json'},signal:controller.signal});if(!r.ok)throw new Error('Capture HTTP '+r.status);if(!disposed)$('status').textContent='已保存 / Saved '+name;}
  catch(error){if(!disposed)$('status').textContent=error.message;}
  finally{running=false;if(!disposed)$('run').disabled=$('save').disabled=false;}
});
