import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY, renderPixelRatio} from '../src/render-quality.js';

test('high quality preserves native Retina detail at the reported narrow desktop size',()=>{
  assert.equal(renderPixelRatio('high',722,771,2.5),2.5);
  assert.equal(renderPixelRatio('high',1440,900,2),2);
  assert.equal(renderPixelRatio('balanced',1440,900,2),Math.sqrt(5_000_000/(1440*900)));
  assert.equal(renderPixelRatio('high',1440,900,1),1);
});

test('framebuffer limits depend only on dimensions and selected quality, with valid fallback inputs',()=>{
  for(const mode of Object.keys(QUALITY))for(const [w,h,dpr] of [[390,844,3],[3840,2160,2],[7680,4320,3]]){
    const first=renderPixelRatio(mode,w,h,dpr);
    assert.ok(first>0&&Number.isFinite(first));
    assert.ok(w*h*first*first<=QUALITY[mode].maxPixels+1);
    assert.ok(first<=dpr);
  }
  assert.equal(renderPixelRatio('invalid',0,NaN,NaN),1);
  assert.equal(renderPixelRatio('high',722,771,2.5),2.5,'returning to a smaller viewport restores native sampling');
});
