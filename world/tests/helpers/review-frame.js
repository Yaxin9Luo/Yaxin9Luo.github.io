import assert from 'node:assert/strict';

// No renderer, assets or browser codec: the real PBO and presentation modules
// consume these small GL/DOM/2D boundaries in the QA integration fixture.
export function createReviewFrameFixture(canvas,document,{capture}={}){
  const calls=[],encoders=[],submissions=[],deletedBuffers=[],deletedSyncs=[],polls=new Map();let nextPoll=1;
  const plain={backgroundColor:'rgba(0, 0, 0, 0)',backgroundImage:'none',opacity:'1',filter:'none',backdropFilter:'none',mixBlendMode:'normal',transform:'none',display:'block',visibility:'visible',clipPath:'none',maskImage:'none'};
  const main={tagName:'MAIN',parentElement:document.body},viewport={classList:{contains:name=>name==='viewport'},parentElement:main};
  document.body.parentElement=document.documentElement;canvas.tagName='CANVAS';canvas.ownerDocument=document;canvas.parentElement=viewport;
  const styles=new Map([[canvas,{...plain}],[viewport,{...plain,backgroundColor:'rgb(31, 48, 57)'}],[main,{...plain}],[document.body,{...plain,backgroundColor:'rgb(17, 28, 35)'}],[document.documentElement,{...plain}]]);
  document.defaultView={getComputedStyle:node=>styles.get(node)};
  const gl={canvas,lost:false,error:0,wait:0x911c,drawingBufferColorSpace:'srgb',
    PIXEL_PACK_BUFFER:0x88eb,PIXEL_PACK_BUFFER_BINDING:0x88ed,PACK_ALIGNMENT:0x0d05,PACK_ROW_LENGTH:0x0d02,PACK_SKIP_PIXELS:0x0d04,PACK_SKIP_ROWS:0x0d03,
    READ_FRAMEBUFFER_BINDING:0x8caa,DRAW_FRAMEBUFFER_BINDING:0x8ca6,READ_BUFFER:0x0c02,BACK:0x0405,RGBA:0x1908,UNSIGNED_BYTE:0x1401,STREAM_READ:0x88e1,
    SYNC_GPU_COMMANDS_COMPLETE:0x9117,ALREADY_SIGNALED:0x911a,TIMEOUT_EXPIRED:0x911b,CONDITION_SATISFIED:0x911c,WAIT_FAILED:0x911d,NO_ERROR:0,
    attributes:{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:false,antialias:true},
    get drawingBufferWidth(){return canvas.width;},get drawingBufferHeight(){return canvas.height;},
    isContextLost(){return this.lost;},getExtension:()=>null,getContextAttributes(){return {...this.attributes};},getParameter(key){return this.state.get(key);},
    getError(){const error=this.error;this.error=0;return error;},
    createBuffer(){calls.push('createBuffer');return {};},
    bindBuffer(target,buffer){assert.equal(target,this.PIXEL_PACK_BUFFER);this.state.set(this.PIXEL_PACK_BUFFER_BINDING,buffer);},pixelStorei(key,value){this.state.set(key,value);},
    bufferData(target,size,usage){assert.equal(target,this.PIXEL_PACK_BUFFER);assert.equal(usage,this.STREAM_READ);this.state.get(this.PIXEL_PACK_BUFFER_BINDING).data=new Uint8Array(size);},
    readPixels(x,y,width,height,format,type,offset){
      calls.push('readPixels');assert.deepEqual([x,y,width,height,format,type,offset],[0,0,canvas.width,canvas.height,this.RGBA,this.UNSIGNED_BYTE,0]);
      assert.deepEqual([this.PACK_ALIGNMENT,this.PACK_ROW_LENGTH,this.PACK_SKIP_PIXELS,this.PACK_SKIP_ROWS].map(key=>this.getParameter(key)),[1,0,0,0]);
      const out=this.state.get(this.PIXEL_PACK_BUFFER_BINDING).data,pattern=this.framebuffer||new Uint8Array([220,50,30,128,1,2,3,255,7,8,9,0,40,50,60,255]);
      for(let i=0;i<out.length;i++)out[i]=pattern[i%pattern.length];
      submissions.push(out.slice());this.onRead?.();
    },
    fenceSync(){calls.push('fenceSync');return {};},flush(){calls.push('flush');},
    clientWaitSync(_sync,flags,timeout){calls.push('clientWaitSync');assert.deepEqual([flags,timeout],[0,0]);return this.wait;},
    getBufferSubData(target,offset,out){calls.push('getBufferSubData');assert.equal(target,this.PIXEL_PACK_BUFFER);assert.equal(offset,0);out.set(this.state.get(this.PIXEL_PACK_BUFFER_BINDING).data);},
    deleteBuffer(buffer){assert.ok(!deletedBuffers.includes(buffer));deletedBuffers.push(buffer);calls.push('deleteBuffer');},
    deleteSync(sync){assert.ok(!deletedSyncs.includes(sync));deletedSyncs.push(sync);calls.push('deleteSync');}
  };
  const borrowed={owner:'renderer'};gl.state=new Map([[gl.PIXEL_PACK_BUFFER_BINDING,borrowed],[gl.PACK_ALIGNMENT,8],[gl.PACK_ROW_LENGTH,19],[gl.PACK_SKIP_PIXELS,3],[gl.PACK_SKIP_ROWS,4],[gl.READ_FRAMEBUFFER_BINDING,null],[gl.DRAW_FRAMEBUFFER_BINDING,null],[gl.READ_BUFFER,gl.BACK]]);
  const createCanvas=()=>{
    const encoder={width:0,height:0,getContext(type,options){assert.equal(type,'2d');assert.deepEqual(options,{alpha:false,colorSpace:'srgb'});return {createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(image,x,y){assert.equal(x,0);assert.equal(y,0);encoder.pixels=image.data.slice();}};},toBlob(callback,type){calls.push('encode');assert.equal(type,'image/png');if(capture)capture(callback);else callback(new Blob(['png'],{type}));}};
    encoders.push(encoder);return encoder;
  };
  return {gl,calls,encoders,submissions,deletedBuffers,deletedSyncs,styles,viewport,borrowed,createCanvas,polls,
    schedule(fn){const id=nextPoll++;polls.set(id,fn);return id;},cancelSchedule:id=>polls.delete(id),poll(){const queued=[...polls.values()];polls.clear();for(const fn of queued)fn();}
  };
}
