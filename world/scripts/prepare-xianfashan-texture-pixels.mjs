// Node-only preparation for future full regression/archive jobs. No factory,
// GPU, network fetch or output archive is constructed by importing this module.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {xianfashanTextureSources,validateXianfashanTexturePixels} from '../src/yuanmingyuan/xianfashan-materials.js';

export async function readXianfashanTexturePixels({publicRoot=new URL('../public/',import.meta.url),signal}={}){
  const result={},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  for(const [name,source] of Object.entries(xianfashanTextureSources)){
    result[name]={};for(const [channel,file] of Object.entries(source.files)){
      signal?.throwIfAborted();const bytes=await readFile(new URL(file.path.slice(1),publicRoot));if(sha(bytes)!==file.sha256)throw new Error(`Xianfashan local texture SHA mismatch: ${file.path}`);
      const {data,info}=await sharp(bytes).flip().ensureAlpha().raw().toBuffer({resolveWithObject:true});signal?.throwIfAborted();
      if(info.width!==source.width||info.height!==source.height||info.channels!==4)throw new Error(`Xianfashan local texture dimensions mismatch: ${file.path}`);
      result[name][channel]=Object.freeze({data:new Uint8Array(data),width:info.width,height:info.height,channels:4,origin:'lower-left',encodedSha256:file.sha256,decodedSha256:sha(data)});
    }
    Object.freeze(result[name]);
  }
  validateXianfashanTexturePixels(result);return Object.freeze(result);
}
