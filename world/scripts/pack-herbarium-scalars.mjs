import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import sharp from 'sharp';

const root=new URL('../public/models/herbarium/didelta-spinosa/',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),check=process.argv.includes('--check');
const files=[];
// Separate sequential operations avoid retaining two expanded source images.
for(const [name,channel,index]of [['alpha','G',1],['translucency','R',0]]){
  const original=`textures/didelta_spinosa_${name}_8k.png`,output=`textures/didelta_spinosa_${name}_8k.r8.zlib`,input=await readFile(new URL(original,root));
  const {data,info}=await sharp(input).extractChannel(index).raw().toBuffer({resolveWithObject:true});
  if(info.width!==8192||info.height!==8192||info.channels!==1||data.length!==8192*8192)throw new Error('Original full 8K scalar channel required');
  const packed=deflateSync(data,{level:9});
  if(!inflateSync(packed).equals(data))throw new Error('Scalar packing changed source samples');
  if(check){if(!(await readFile(new URL(output,root))).equals(packed))throw new Error(`Stale scalar derivative: ${output}`);}
  else await writeFile(new URL(output,root),packed);
  files.push({original,originalSha256:hash(input),sourceChannel:channel,output,outputSha256:hash(packed),compressedBytes:packed.length,width:8192,height:8192,uploadFormat:'R8',sampleType:'unsigned normalized 8-bit',sampleCount:data.length,decodedBytes:data.length,decodedSha256:hash(data),ordering:'top row first, left to right; no color conversion, premultiplication, filtering or resampling'});
  console.log(`${name}: ${data.length} exact ${channel} samples; ${packed.length} losslessly compressed bytes`);
}
const manifest={version:1,source:'https://polyhaven.com/a/didelta_spinosa',license:'CC0-1.0',recipe:'world/scripts/pack-herbarium-scalars.mjs',encoding:'zlib DEFLATE of the complete single-channel byte plane; no header or pixel quantization',originalFiles:'Original downloaded PNGs remain unchanged alongside the derivatives.',runtime:'Scalar R is used in physical/depth/distance alpha shaders and the original translucency shader. Full dimensions, mip generation, anisotropy and sampler state are retained.',files};
const encoded=JSON.stringify(manifest,null,2)+'\n';
if(check){if(await readFile(new URL('scalar-source.json',root),'utf8')!==encoded)throw new Error('Stale scalar provenance');}
else await writeFile(new URL('scalar-source.json',root),encoded);
