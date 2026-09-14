import {HalfFloatType,RGBA_ASTC_4x4_Format} from 'three';
import {read} from 'three/addons/libs/ktx-parse.module.js';

const identifier=[171,75,84,88,32,50,48,187,13,10,26,10];
const metadataKeys=new Set(['KTXorientation','KTXwriter','KTXwriterScParams']);
const equal=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
const invalid=message=>{throw new Error(`HDR KTX2: ${message}`);};

/** Unused until full-source codec/native art acceptance. Runs in a disposable
 * worker later; its owner cancels by terminating that worker. No texture, GPU,
 * Basis transcoder or HALF pixel expansion is created here. Caller owns mips. */
export async function decodeHerbariumHDRTextureData(buffer,expected){
  try{
    const {width,height,levels}=expected||{};
    if(![width,height,levels].every(Number.isInteger)||width<1||height<1||width>0xffffffff||height>0xffffffff||levels!==Math.floor(Math.log2(Math.max(width,height)))+1)invalid('expected complete extent/level contract is required');
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<80)invalid('truncated header or non-ArrayBuffer input');
    const bytes=new Uint8Array(buffer),view=new DataView(buffer),indexEnd=80+24*levels;
    if(!identifier.every((value,i)=>bytes[i]===value)||buffer.byteLength<indexEnd)invalid('identifier or level index is truncated');
    const header=[1000066000,1,width,height,0,0,1,levels,2];
    if(!header.every((value,i)=>view.getUint32(12+4*i,true)===value))invalid('format, extent, levels, faces or Zstd contract differs');
    const uint64=offset=>{const value=view.getBigUint64(offset,true);if(value>BigInt(Number.MAX_SAFE_INTEGER))invalid('unsafe 64-bit range');return Number(value);};
    if(uint64(64)!==0||uint64(72)!==0)invalid('supercompression global data is not allowed');
    const ranges=[[0,indexEnd]],range=(offset,length,name,alignment=1)=>{
      if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<indexEnd||length<1||offset%alignment||offset>bytes.length||length>bytes.length-offset)invalid(`${name} extent is invalid or truncated`);
      ranges.push([offset,offset+length]);
    };
    const dfdOffset=view.getUint32(48,true),dfdLength=view.getUint32(52,true),kvdOffset=view.getUint32(56,true),kvdLength=view.getUint32(60,true);
    range(dfdOffset,dfdLength,'DFD',4);range(kvdOffset,kvdLength,'metadata',4);
    const dimensions=[];
    for(let level=0;level<levels;level++){
      const w=Math.max(1,Math.floor(width/2**level)),h=Math.max(1,Math.floor(height/2**level)),length=Math.ceil(w/4)*Math.ceil(h/4)*16;
      if(!Number.isSafeInteger(length))invalid('unsafe decoded block size');
      const at=80+24*level,offset=uint64(at),compressedLength=uint64(at+8);
      range(offset,compressedLength,`mip ${level}`);
      if(uint64(at+16)!==length)invalid(`mip ${level} block byte length differs`);
      dimensions.push({width:w,height:h,length});
    }
    ranges.sort((a,b)=>a[0]-b[0]);
    for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])invalid('container ranges overlap');
    if(dfdLength!==44||view.getUint32(dfdOffset,true)!==44||view.getUint16(dfdOffset+10,true)!==40)invalid('expected exactly one complete HDR descriptor');
    // Validate raw key extents/duplicates before ktx-parse can collapse entries.
    const keys=new Set(),text=new TextDecoder('utf-8',{fatal:true}),kvdEnd=kvdOffset+kvdLength;
    for(let at=kvdOffset;at<kvdEnd;){
      if(kvdEnd-at<4)invalid('truncated metadata entry');
      const length=view.getUint32(at,true);at+=4;
      if(length<2||length>kvdEnd-at)invalid('metadata entry length is invalid');
      const entry=bytes.subarray(at,at+length),zero=entry.indexOf(0);
      if(zero<1||zero===length-1||entry[length-1]!==0)invalid('metadata string is unterminated');
      const key=text.decode(entry.subarray(0,zero));
      if(!metadataKeys.has(key)||keys.has(key))invalid('unexpected or duplicate metadata key');
      keys.add(key);const value=entry.subarray(zero+1,length-1);
      if(value.includes(0))invalid('embedded metadata terminator');
      if(key==='KTXorientation'&&text.decode(value)!=='rd')invalid('orientation must be rd');
      const padded=Math.ceil(length/4)*4;if(padded>kvdEnd-at)invalid('truncated metadata padding');at+=padded;
    }
    if(!keys.has('KTXorientation'))invalid('orientation is required');
    const container=read(bytes),dfd=container.dataFormatDescriptor[0],sample=dfd?.samples[0];
    if(container.dataFormatDescriptor.length!==1||dfd.vendorId!==0||dfd.descriptorType!==0||dfd.versionNumber!==2||dfd.colorModel!==167||dfd.colorPrimaries!==0||dfd.transferFunction!==1||dfd.flags!==0||!equal(dfd.texelBlockDimension,[3,3,0,0])||!equal(dfd.bytesPlane,[16,0,0,0,0,0,0,0])||dfd.samples.length!==1||sample.bitOffset!==0||sample.bitLength!==127||sample.channelType!==128||!equal(sample.samplePosition,[0,0,0,0])||sample.sampleLower!==0||sample.sampleUpper!==1065353216)invalid('HDR descriptor channel/linear/block contract differs');
    // Same direct SFLOAT path as KTX2Loader: only unwrap Zstd into ASTC blocks.
    const {ZSTDDecoder}=await import('three/addons/libs/zstddec.module.js');
    const decoder=new ZSTDDecoder();await decoder.init();
    const buffers=new Set(),mipmaps=[];
    for(const [i,mip] of container.levels.entries()){
      const size=dimensions[i],data=decoder.decode(mip.levelData,size.length);
      if(!(data instanceof Uint8Array)||data.byteLength!==size.length||data.byteOffset!==0||data.buffer.byteLength!==data.byteLength||data.buffer===buffer||buffers.has(data.buffer))invalid(`mip ${i} decompression or buffer ownership differs`);
      buffers.add(data.buffer);mipmaps.push({data,width:size.width,height:size.height});
    }
    return {width,height,format:RGBA_ASTC_4x4_Format,type:HalfFloatType,mipmaps};
  }catch(error){if(error?.message?.startsWith('HDR KTX2:'))throw error;throw new Error(`HDR KTX2: ${error?.message||'invalid compressed data'}`,{cause:error});}
}
