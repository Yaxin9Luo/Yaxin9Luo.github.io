import {HalfFloatType,UnsignedByteType,RGBAFormat,RedFormat} from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {unzlibSync} from 'three/addons/libs/fflate.module.js';

/** Worker-only decoding. Original EXR HALF bits and full scalar samples survive. */
export function decodeShrubTextureData(key,buffer){
  const width=8192,height=8192;
  if(key==='alphaMap'||key==='translucencyMap'){
    const data=unzlibSync(new Uint8Array(buffer));
    if(data.length!==width*height)throw new Error('Incomplete original 8K scalar map');
    return {data,width,height,format:RedFormat,type:UnsignedByteType};
  }
  if(key!=='normalMap'&&key!=='roughnessMap')throw new Error('Unknown shrub texture encoding');
  const format=key==='roughnessMap'?RedFormat:RGBAFormat;
  const parsed=new EXRLoader().setDataType(HalfFloatType).setOutputFormat(format).parse(buffer);
  const components=format===RedFormat?1:4;
  if(parsed.width!==width||parsed.height!==height||parsed.type!==HalfFloatType||!(parsed.data instanceof Uint16Array)||parsed.data.length!==width*height*components)throw new Error('Incomplete original 8K HALF map');
  // Identical R1 scanline reversal: glTF UVs are top-origin, EXRLoader bottom-up.
  const rowSize=width*components,row=new Uint16Array(rowSize);
  for(let y=0;y<height/2;y++){const a=y*rowSize,b=(height-1-y)*rowSize;row.set(parsed.data.subarray(a,a+rowSize));parsed.data.copyWithin(a,b,b+rowSize);parsed.data.set(row,b);}
  return {data:parsed.data,width,height,format,type:HalfFloatType};
}
