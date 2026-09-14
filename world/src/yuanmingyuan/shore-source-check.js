import {inspectShoreSourceTarget,shoreSourceCheckPaths,sourceCheckSHA256} from './shore-source-check-fixture.js';
import {inspectAllShoreSources} from './shore-source-check-batch.js';
import {xianfaShorePreparedData,readPreparedShoreSource} from './xianfa-shore-community-prepared-data.js';
import fixtureSource from './shore-source-check-fixture.js?raw';
import batchSource from './shore-source-check-batch.js?raw';
import poseTraceSource from './shore-source-pose-trace.js?raw';
import pageSource from './shore-source-check.js?raw';

const $=id=>document.getElementById(id),controller=new AbortController();let last=null,running=false,disposed=false,serial=0;
addEventListener('pagehide',()=>{disposed=true;controller.abort();},{once:true});
const buttonsDisabled=value=>{$('run').disabled=$('run-all').disabled=$('run-trace').disabled=value;};
async function run(all=false,traceNormalizations=false){
  if(running||disposed)return;running=true;last=null;buttonsDisabled(true);$('save').disabled=true;document.body.dataset.status='running';$('status').textContent=all?'正在顺序核对 92 个源网格… / Checking all 92 source meshes sequentially…':'正在执行两个花序的小检查… / Checking the first two sprays…';
  try{
    const response=await fetch(xianfaShorePreparedData.manifestURL,{signal:controller.signal});if(!response.ok)throw new Error('Manifest HTTP '+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer()),sha256=await sourceCheckSHA256(bytes);controller.signal.throwIfAborted();
    if(bytes.byteLength!==xianfaShorePreparedData.manifestBytes||sha256!==xianfaShorePreparedData.manifestSHA256)throw new Error('Production manifest byte/hash mismatch');
    const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),sourceTexts={};
    if(!all)for(const path of shoreSourceCheckPaths){sourceTexts[path]=await readPreparedShoreSource(path);controller.signal.throwIfAborted();}
    const diagnosticSources={fixtureSHA256:await sourceCheckSHA256(fixtureSource),batchSHA256:await sourceCheckSHA256(batchSource),pageSHA256:await sourceCheckSHA256(pageSource),poseTraceSHA256:await sourceCheckSHA256(poseTraceSource)};
    const runtime={userAgent:navigator.userAgent,platform:navigator.platform,userAgentData:navigator.userAgentData?.toJSON?.()??null};
    const result=all?await inspectAllShoreSources({manifest,readSource:readPreparedShoreSource,signal:controller.signal,runtime,onProgress:row=>{if(!disposed)$('status').textContent=`${row.completed}/92 ${row.phase}: ${row.name??''}`;}}):await inspectShoreSourceTarget({sourceTexts,manifest,runtime,traceNormalizations});controller.signal.throwIfAborted();
    result.manifest={path:xianfaShorePreparedData.manifestURL,bytes:bytes.byteLength,sha256};result.diagnosticSources=diagnosticSources;result.sourceIdentity=(await sourceCheckSHA256(fixtureSource+'\n'+batchSource+'\n'+pageSource+'\n'+poseTraceSource)).slice(0,16);result.capturedAt=new Date().toISOString();controller.signal.throwIfAborted();last=result;
    $('identity').textContent=JSON.stringify({sourceIdentity:result.sourceIdentity,diagnosticSources,manifest:result.manifest,runtime:result.runtime,sourceIdentities:result.sourceIdentities},null,2);
    if(all){
      $('attributes').textContent=JSON.stringify({allAttributesMatch:result.allAttributesMatch,allRoutesMatch:result.allRoutesMatch,geometries:result.geometries.map(g=>({...g,attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,{exactBits,...a}])=>[name,{...a,exactMismatchBits:exactBits?.values.length??0}]))}))},null,2);
      $('normal-bits').value=JSON.stringify(result.geometries.flatMap(g=>g.attributes.normal.exactBits?[{sourceIndex:g.sourceIndex,name:g.name,...g.attributes.normal.exactBits}]:[]));
      $('diagnostics').textContent=JSON.stringify({diagnostics:result.diagnostics,owners:result.owners,mismatchedRoutes:result.routes.filter(row=>!row.allMatricesMatch),completeMismatchBitsInSavedJSON:true},null,2);
    }else{
      $('attributes').textContent=JSON.stringify({target:result.target,geometryName:result.geometryName,sourceIndex:result.sourceIndex,geometryIndex:result.geometryIndex,allAttributesMatch:result.allAttributesMatch,attributes:result.attributes},null,2);
      $('normal-bits').value=JSON.stringify(result.normalUint32);
      $('diagnostics').textContent=JSON.stringify({diagnostics:result.diagnostics,normalizationTrace:result.normalizationTrace,batchInputs:result.batchInputs.map(({sourceNormalBits,...row})=>({...row,sourceNormalUint32Count:sourceNormalBits.length})),completeInputsInSavedJSON:true},null,2);
    }
    const match=result.allAttributesMatch&&result.allRoutesMatch!==false;
    document.body.dataset.status=match?'match':'mismatch';$('status').textContent=match?'全部属性逐字节一致，源已释放 / All attributes match; sources disposed':'存在原始属性/矩阵差异，源已释放，全部差异位值可保存 / Differences retained; sources disposed';$('save').disabled=false;
  }catch(error){if(!disposed){document.body.dataset.status='failed';$('status').textContent=error.message;$('diagnostics').textContent=error.stack||String(error);}}
  finally{running=false;if(!disposed)buttonsDisabled(false);}
}
$('run').addEventListener('click',()=>run(false));
$('run-all').addEventListener('click',()=>run(true));
$('run-trace').addEventListener('click',()=>run(false,true));
$('save').addEventListener('click',async()=>{
  if(!last||disposed||running)return;
  const name=`shore-source-check-${last.sourceIdentity}-${Date.now()}-${++serial}.json`,body=JSON.stringify(last);$('save').disabled=true;buttonsDisabled(true);running=true;
  try{const response=await fetch(`/__review_capture/${name}`,{method:'POST',body,headers:{'Content-Type':'application/json'},signal:controller.signal});if(!response.ok)throw new Error('Capture HTTP '+response.status);if(!disposed)$('status').textContent='已保存 / Saved '+name;}
  catch(error){if(!disposed)$('status').textContent=error.message;}
  finally{running=false;if(!disposed){$('save').disabled=false;buttonsDisabled(false);}}
});
