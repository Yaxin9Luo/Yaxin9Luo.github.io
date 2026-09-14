import test from 'node:test';
import assert from 'node:assert/strict';
import {readNativeFrame,flipNativeRgbaRows,encodeNativeFrame} from '../src/yuanmingyuan/native-frame-capture.js';

function harness(){
  const keys=['PACK_ALIGNMENT','PACK_ROW_LENGTH','PACK_SKIP_PIXELS','PACK_SKIP_ROWS'],state=new Map([['PACK_ALIGNMENT',4],['PACK_ROW_LENGTH',9],['PACK_SKIP_PIXELS',2],['PACK_SKIP_ROWS',3]]);
  let pixels=new Uint8Array([1,2,3,4,5,6,7,8]),fail=false,error=0,target=null,lost=false;
  const gl={...Object.fromEntries(keys.map(k=>[k,k])),READ_FRAMEBUFFER_BINDING:'READ_FRAMEBUFFER_BINDING',RGBA:'RGBA',UNSIGNED_BYTE:'UNSIGNED_BYTE',NO_ERROR:0,
    isContextLost:()=>lost,getParameter:key=>key==='READ_FRAMEBUFFER_BINDING'?null:state.get(key),pixelStorei:(key,value)=>state.set(key,value),getError:()=>error,
    readPixels(x,y,w,h,format,type,bytes){assert.deepEqual([x,y,w,h,format,type],[0,0,1,2,'RGBA','UNSIGNED_BYTE']);assert.deepEqual([...state.values()],[1,0,0,0]);if(fail)throw new Error('GPU read failed');bytes.set(pixels);},
  };
  return {renderer:{getContext:()=>gl,getRenderTarget:()=>target},canvas:{width:1,height:2,toBlob(){throw new Error('Must not use the old WebGL canvas encoding cache');}},state,
    setPixels:value=>pixels=value,setFailure:()=>fail=true,setError:()=>error=1282,setTarget:()=>target={},setLost:()=>lost=true};
}
test('native read takes current GPU bytes, reverses rows once and retains packing state',()=>{
  const h=harness(),a=readNativeFrame(h.renderer,h.canvas);assert.deepEqual([...a.rgba],[5,6,7,8,1,2,3,4]);
  h.setPixels(new Uint8Array([21,22,23,24,25,26,27,28]));const b=readNativeFrame(h.renderer,h.canvas);
  assert.deepEqual([...b.rgba],[25,26,27,28,21,22,23,24]);assert.deepEqual([...a.rgba],[5,6,7,8,1,2,3,4]);assert.deepEqual([...h.state.values()],[4,9,2,3]);
});
test('failed reads restore packing and never return an offscreen or lost frame',()=>{
  for(const method of ['setFailure','setError','setTarget','setLost']){const h=harness();h[method]();assert.throws(()=>readNativeFrame(h.renderer,h.canvas));assert.deepEqual([...h.state.values()],[4,9,2,3]);}
  assert.throws(()=>flipNativeRgbaRows(new Uint8Array(7),1,2));
});
test('encoding owns a fixed pixel copy even if the next GPU frame changes during PNG encoding',async()=>{
  const h=harness(),a=readNativeFrame(h.renderer,h.canvas);let finish,retained;
  const output={width:0,height:0,getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(8)}),putImageData:p=>retained=p.data}),toBlob:callback=>finish=callback};
  const pending=encodeNativeFrame(a,{createElement:()=>output});h.setPixels(new Uint8Array(8).fill(90));readNativeFrame(h.renderer,h.canvas);
  assert.deepEqual([...retained],[5,6,7,8,1,2,3,4]);const blob=new Blob(['fixed']);finish(blob);assert.equal(await pending,blob);assert.equal(output.width,0);assert.equal(output.height,0);
});
