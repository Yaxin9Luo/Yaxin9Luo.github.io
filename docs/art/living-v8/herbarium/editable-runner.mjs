import {spawnSync} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';

/** Run the authored Blender import/save stage before publishing editable hashes. */
export async function runEditableBlender({scriptPath,logPath,expectedSaves=[]}){
  const run=spawnSync('/Applications/Blender.app/Contents/MacOS/Blender',['--factory-startup','--background','--python-exit-code','1','--python',scriptPath],{encoding:'utf8',maxBuffer:16*1024*1024});
  const output=(run.stdout||'')+(run.stderr||'');await writeFile(logPath,output);
  if(run.status!==0)throw new Error(`Editable Blender export failed (${run.status}); inspect ${logPath}`);
  const saved=new Set([...output.matchAll(/^EDITABLE_SAVED ([\w-]+) [1-9]\d*\s*$/gm)].map(match=>match[1]));
  for(const kind of expectedSaves)if(!saved.has(kind))throw new Error(`Editable Blender export missing completed save: ${kind}; inspect ${logPath}`);
  return output;
}

/** A failed Blender run cannot certify existing output files or remove its new import inputs. */
export async function completeEditableExport({scriptPath,logPath,out,manifest,manifestPaths}){
  const output=await runEditableBlender({scriptPath,logPath,expectedSaves:Object.keys(manifest.assets)});
  for(const[kind,asset]of Object.entries(manifest.assets)){const bytes=await readFile(new URL(`${kind}.blend`,out));asset.editableSha256=createHash('sha256').update(bytes).digest('hex');asset.editableBytes=bytes.length;}
  for(const kind of Object.keys(manifest.assets))await unlink(new URL(`${kind}.authoring-tmp.glb`,out));
  for(const path of manifestPaths)await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
  return output;
}
