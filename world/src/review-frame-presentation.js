/** Review still presentation: raw GPU identity plus a declared sRGB reference composite.
 * No renderer/context acquisition, WebGL canvas snapshot, scene change or added timer.
 */
const STYLE_KEYS=['backgroundColor','backgroundImage','opacity','filter','backdropFilter','mixBlendMode','transform','display','visibility','clipPath','maskImage'];

function cssByteRGBA(color){
  const value=String(color).replace(/\s+/g,'');
  if(value==='transparent')return [0,0,0,0];
  const match=/^(rgb|rgba)\(([^)]+)\)$/.exec(value),parts=match?.[2].split(',').map(Number);
  if(!parts||parts.length!==(match[1]==='rgb'?3:4)||parts.slice(0,3).some(v=>!Number.isInteger(v)||v<0||v>255)||parts.length===4&&parts[3]!==0&&parts[3]!==1)throw new Error('Unsupported CSS backdrop color; explicit byte sRGB and binary alpha required');
  return [...parts.slice(0,3),parts.length===3?255:parts[3]*255];
}

/** Called synchronously after the actual draw and before the PBO helper can yield.
 * The existing context is required; never call canvas.getContext here.
 */
export function snapshotReviewPresentation(canvas,gl){
  if(!gl||gl.canvas!==canvas||gl.isContextLost())throw new Error('Review presentation requires the existing matching live context');
  const attributes=gl.getContextAttributes(),drawingBufferColorSpace=gl.drawingBufferColorSpace;
  if(attributes?.alpha!==true||attributes.premultipliedAlpha!==true||drawingBufferColorSpace!=='srgb')throw new Error('Unsupported actual presentation context or color space');
  rgbaLength(canvas.width,canvas.height);
  if(gl.drawingBufferWidth!==canvas.width||gl.drawingBufferHeight!==canvas.height)throw new Error('Review presentation native extent differs from its context');
  const doc=canvas.ownerDocument,viewport=canvas.parentElement,main=viewport?.parentElement;
  if(canvas.tagName!=='CANVAS'||!viewport?.classList?.contains('viewport')||main?.tagName!=='MAIN'||main.parentElement!==doc?.body||doc.body.parentElement!==doc.documentElement||!doc.defaultView)throw new Error('Unexpected review presentation ancestry');
  const styles={};
  for(const [name,node]of Object.entries({canvas,viewport,main,body:doc.body,html:doc.documentElement})){
    const computed=doc.defaultView.getComputedStyle(node),style=Object.fromEntries(STYLE_KEYS.map(key=>[key,computed[key]]));
    if(style.backgroundImage!=='none'||Number(style.opacity)!==1||style.filter!=='none'||style.backdropFilter!=='none'||style.mixBlendMode!=='normal'||style.transform!=='none'||['none','contents'].includes(style.display)||style.visibility!=='visible'||style.clipPath!=='none'||style.maskImage!=='none')throw new Error(`Unsupported ${name} CSS presentation effects`);
    styles[name]=Object.freeze(style);
  }
  if(cssByteRGBA(styles.canvas.backgroundColor)[3]!==0)throw new Error('Review canvas CSS backdrop must be transparent');
  const backdropRGBA=cssByteRGBA(styles.viewport.backgroundColor);
  if(backdropRGBA[3]!==255)throw new Error('Actual review viewport backdrop must be opaque');
  return Object.freeze({schema:'review-frame-presentation-plan-v1',width:canvas.width,height:canvas.height,drawingBufferColorSpace,contextAttributes:Object.freeze({...attributes}),backdropSource:'.viewport',backdropRGBA:Object.freeze(backdropRGBA),styles:Object.freeze(styles)});
}

/** Consume owned raw bottom-up PBO bytes, using only the pinned presentation plan.
 * Caller guard/signal retain automatic deadlines and manual captured-frame semantics.
 */
export async function encodeReviewFramePixels({pixels,width,height,readback},{signal,guard,presentation,createCanvas}){
  const check=()=>{signal.throwIfAborted();guard();};check();checkRGBA(pixels,width,height);
  if(presentation?.schema!=='review-frame-presentation-plan-v1'||presentation.width!==width||presentation.height!==height||presentation.drawingBufferColorSpace!=='srgb'||presentation.contextAttributes?.alpha!==true||presentation.contextAttributes.premultipliedAlpha!==true)throw new Error('Invalid pinned presentation frame extent or context');
  if(readback?.method!=='default-framebuffer-PBO-fence'||readback.submittedBeforeYield!==true||readback.framebuffer!=='default'||readback.readBuffer!=='BACK'||readback.format!=='RGBA'||readback.type!=='UNSIGNED_BYTE'||readback.rowOrder!=='bottom-up'||readback.bytes!==pixels.byteLength)throw new Error('Invalid complete native RGBA readback metadata');
  if(!readback.contextAttributes||Object.entries(presentation.contextAttributes).some(([key,value])=>readback.contextAttributes[key]!==value))throw new Error('Readback context differs from its pinned presentation');
  const sourceReadback={...readback,contextAttributes:{...readback.contextAttributes}},raw=framebufferRowsToTopLeft(pixels,width,height);
  const digest=async bytes=>{check();const result=await abortable(globalThis.crypto.subtle.digest('SHA-256',bytes),signal);check();return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');};
  const rgbaTopLeftSHA256=await digest(raw);check();
  const composed=composePremultipliedRGBA(raw,width,height,presentation.backdropRGBA),referenceSHA256=await digest(composed.pixels);check();
  const blob=await encodeRgbaPNG(composed.pixels,width,height,{signal,guard:check,createCanvas});check();
  return {blob,readback:{...sourceReadback,width,height,sourceRowOrder:sourceReadback.rowOrder,rowOrder:'top-left',rgbaTopLeftSHA256,statistics:composed.statistics},presentation:{rgbaTopLeftSHA256:referenceSHA256,mode:composed.mode,interpretation:'defined-srgb-reference-composite',nativeDisplayPixelEqualityClaimed:false,backdropRGBA:presentation.backdropRGBA,backdropSource:presentation.backdropSource,formula:composed.formula,conditions:presentation,width,height,rowOrder:'top-left',opaque:true,encoder:'separate-canvas-2d-putImageData-srgb-image/png'}};
}

// Exact validated primitive functions copied from the work-only native plant helper.
// Source SHA-256: bb242b04a8ffbc30657b3e68f9e7e4085840f676f1de906fcba1041bd316e20a.
export function abortable(promise,signal){
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason||new Error('Operation cancelled'));
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    // Always observe settlement, including a rejection after prior cancellation.
    promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}


function rgbaLength(width,height){
  const length=width*height*4;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!Number.isSafeInteger(length))throw new Error('Invalid native RGBA extent');
  return length;
}
function checkRGBA(pixels,width,height){
  if(!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==rgbaLength(width,height))throw new Error('Invalid complete RGBA byte buffer');
}


export function framebufferRowsToTopLeft(rgba,width,height){
  checkRGBA(rgba,width,height);const pixels=new Uint8ClampedArray(rgba.length),stride=width*4;
  for(let y=0;y<height;y++)pixels.set(rgba.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
  return pixels;
}


export function composePremultipliedRGBA(raw,width,height,backdropRGBA){
  checkRGBA(raw,width,height);
  if(!Array.isArray(backdropRGBA)||backdropRGBA.length!==4||backdropRGBA.some(v=>!Number.isInteger(v)||v<0||v>255)||backdropRGBA[3]!==255)throw new Error('Presentation requires an explicit opaque byte RGBA backdrop');
  const pixels=new Uint8ClampedArray(raw.length),statistics={pixels:width*height,alphaMin:255,alphaMax:0,nonOpaquePixels:0,zeroAlphaPixels:0,rgbAboveAlphaPixels:0,rgbAboveAlphaChannels:0,clippedPresentationChannels:0};
  for(let i=0;i<raw.length;i+=4){
    const alpha=raw[i+3];statistics.alphaMin=Math.min(statistics.alphaMin,alpha);statistics.alphaMax=Math.max(statistics.alphaMax,alpha);
    if(alpha!==255)statistics.nonOpaquePixels++;if(alpha===0)statistics.zeroAlphaPixels++;let above=false;
    for(let channel=0;channel<3;channel++){
      if(raw[i+channel]>alpha){above=true;statistics.rgbAboveAlphaChannels++;}
      const numerator=raw[i+channel]*255+backdropRGBA[channel]*(255-alpha);
      if(numerator>255*255)statistics.clippedPresentationChannels++;
      pixels[i+channel]=Math.min(255,Math.floor((numerator+127)/255));
    }
    if(above)statistics.rgbAboveAlphaPixels++;pixels[i+3]=255;
  }
  return {pixels,statistics,mode:'premultiplied-over-css-srgb',formula:'outRGB = min(255, floor((rawRGB*255 + backdropRGB*(255 - rawA) + 127)/255)); outA = 255'};
}


export async function encodeRgbaPNG(pixels,width,height,{signal,guard,createCanvas=()=>document.createElement('canvas')}){
  checkRGBA(pixels,width,height);
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)throw new Error('Expected opaque scene RGBA; refusing alpha conversion');
  return new Promise((resolve,reject)=>{
    let encoder=null,finished=false;
    const check=()=>{signal.throwIfAborted();guard();};
    const finish=(error,blob)=>{
      if(finished)return;finished=true;signal.removeEventListener('abort',abort);
      if(encoder){encoder.width=0;encoder.height=0;encoder=null;}
      if(error)reject(error);else resolve(blob);
    };
    const abort=()=>finish(signal.reason||new Error('PNG encoding cancelled'));
    signal.addEventListener('abort',abort,{once:true});
    try{
      check();encoder=createCanvas();encoder.width=width;encoder.height=height;
      const context=encoder.getContext('2d',{alpha:false,colorSpace:'srgb'});if(!context)throw new Error('Separate 2D PNG encoder unavailable');
      const image=context.createImageData(width,height);image.data.set(pixels);context.putImageData(image,0,0);check();
      encoder.toBlob(blob=>{
        if(finished)return;
        try{check();if(!blob||blob.type!=='image/png'||!blob.size)throw new Error('Separate RGBA PNG encoding failed');finish(null,blob);}
        catch(error){finish(error);}
      },'image/png');
    }catch(error){finish(error);}
  });
}
