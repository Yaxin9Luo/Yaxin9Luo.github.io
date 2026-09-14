// Capture the exact default framebuffer synchronously. Browser canvas encoders
// can retain an earlier composited image while a large WebGL frame is pending.
export function flipNativeRgbaRows(bytes,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||bytes.length!==width*height*4)throw new Error('Invalid native RGBA dimensions.');
  const output=new Uint8ClampedArray(bytes.length),stride=width*4;
  for(let y=0;y<height;y++)output.set(bytes.subarray(y*stride,(y+1)*stride),(height-y-1)*stride);
  return output;
}

export function readNativeFrame(renderer,canvas){
  const gl=renderer.getContext(),width=canvas.width,height=canvas.height;
  if(gl.isContextLost())throw new Error('The graphics context was lost before capture.');
  if(renderer.getRenderTarget()!==null||gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)!==null)throw new Error('The final frame has not returned to the canvas.');
  const bytes=new Uint8Array(width*height*4),packing=[gl.PACK_ALIGNMENT,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_PIXELS,gl.PACK_SKIP_ROWS].map(key=>[key,gl.getParameter(key)]);
  try{
    gl.pixelStorei(gl.PACK_ALIGNMENT,1);for(const [key]of packing.slice(1))gl.pixelStorei(key,0);
    // readPixels waits for prior draws; the byte copy and its evidence belong to
    // this frame even if a browser UI event arrives during asynchronous encoding.
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    if(gl.isContextLost())throw new Error('The graphics context was lost during capture.');
    const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error(`Native framebuffer read failed with WebGL error ${error}.`);
  }finally{for(const [key,value]of packing)gl.pixelStorei(key,value);}
  return {width,height,rgba:flipNativeRgbaRows(bytes,width,height),readback:'WebGL default framebuffer RGBA8; synchronous readPixels'};
}

export function encodeNativeFrame(frame,doc=document){
  const output=doc.createElement('canvas');output.width=frame.width;output.height=frame.height;
  const context=output.getContext('2d');if(!context)throw new Error('Native PNG staging canvas is unavailable.');
  const pixels=context.createImageData(frame.width,frame.height);pixels.data.set(frame.rgba);context.putImageData(pixels,0,0);
  return new Promise((resolve,reject)=>output.toBlob(blob=>{output.width=output.height=0;blob?resolve(blob):reject(new Error('Native PNG encoding failed.'));},'image/png'));
}
