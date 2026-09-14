// Independent exact R1 decoder reference, isolated so its full image allocation
// exits before the worker candidate is decoded. Hashes cover every HALF bit.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {HalfFloatType,RGBAFormat,RedFormat} from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
const key=process.argv[2],components=key==='normalMap'?4:1,file=key==='normalMap'?'nor_gl':'rough';
const bytes=await readFile(new URL(`../../public/models/herbarium/didelta-spinosa/textures/didelta_spinosa_${file}_8k.exr`,import.meta.url));
const parsed=new EXRLoader().setDataType(HalfFloatType).setOutputFormat(components===4?RGBAFormat:RedFormat).parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const row=parsed.width*components,hash=createHash('sha256');
// Reverse the hash's traversal, independently of the candidate's in-place swap.
for(let y=parsed.height-1;y>=0;y--)hash.update(Buffer.from(parsed.data.buffer,parsed.data.byteOffset+y*row*2,row*2));
console.log(JSON.stringify({sha256:hash.digest('hex'),bytes:parsed.data.byteLength,width:parsed.width,height:parsed.height,type:parsed.type}));
