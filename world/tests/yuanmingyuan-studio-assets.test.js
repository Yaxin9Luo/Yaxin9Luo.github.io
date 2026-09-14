import test from 'node:test';
import assert from 'node:assert/strict';
import {studioAssets,getStudioAsset,studioAssetUrl} from '../src/yuanmingyuan/studio-assets.js';

// This module contains only configuration and deferred import functions.
// These tests never call a production factory or its loader.
test('unknown and inherited asset keys resolve to the established default',()=>{
  for(const id of [undefined,null,'','missing','constructor','__proto__',{},17])assert.equal(getStudioAsset(id),studioAssets.haiyantang);
  assert.equal(getStudioAsset('haiyantang'),studioAssets.haiyantang);assert.equal(getStudioAsset('yuanyingguan'),studioAssets.yuanyingguan);
});

test('asset navigation resets camera-specific URL state and preserves the evidence source',()=>{
  const current='https://example.test/review/yuanmingyuan-studio.html?source=frozen-123&view=roof&view=front&sculpture=clam&light=neutral&note=a%26b&archive=/assets/old/manifest.json&specimen=lake-rock&materials=stone-r4#evidence';
  const target=new URL(studioAssetUrl(current,'yuanyingguan'));
  assert.equal(target.origin,'https://example.test');assert.equal(target.pathname,'/review/yuanmingyuan-studio.html');assert.equal(target.hash,'#evidence');
  assert.equal(target.searchParams.get('asset'),'yuanyingguan');assert.equal(target.searchParams.get('source'),'frozen-123');assert.equal(target.searchParams.get('light'),'neutral');assert.equal(target.searchParams.get('note'),'a&b');
  assert.equal(target.searchParams.has('view'),false);assert.equal(target.searchParams.has('sculpture'),false);
  assert.equal(target.searchParams.has('archive'),false,'a different building cannot load the previous building archive');assert.equal(target.searchParams.has('specimen'),false);
  assert.equal(target.searchParams.has('materials'),false,'a different asset cannot inherit an asset-specific material candidate');
  assert.equal(new URL(studioAssetUrl(target.href,'__proto__')).searchParams.get('asset'),'haiyantang');
});

test('configured camera targets satisfy the shared framing contract',()=>{
  for(const [id,config] of Object.entries(studioAssets)){
    assert.equal(config.id,id);assert.match(id,/^[a-z0-9-]+$/);assert.equal(typeof config.loadFactory,'function');
    assert.ok(Object.hasOwn(config.views,config.defaultView));assert.ok(Object.hasOwn(config.views,config.sculptureDefaultView));
    for(const [view,spec] of [...Object.entries(config.views),...Object.entries(config.sculptures)]){
      assert.match(view,/^[a-z0-9-]+$/);assert.equal(typeof spec.label,'string');assert.ok(spec.label.length);
      assert.ok(Array.isArray(spec.groups));assert.ok(spec.groups.every(name=>typeof name==='string'&&name.length));assert.equal(new Set(spec.groups).size,spec.groups.length);
      assert.equal(spec.direction.length,3);assert.ok(spec.direction.every(Number.isFinite));assert.ok(Math.hypot(spec.direction[0],spec.direction[2])>0,'camera direction cannot be parallel to its up vector');
      if(spec.margin!==undefined)assert.ok(Number.isFinite(spec.margin)&&spec.margin>=1);
      if(spec.crop)for(let axis=0;axis<3;axis++)assert.ok(spec.crop.min[axis]>=0&&spec.crop.min[axis]<spec.crop.max[axis]&&spec.crop.max[axis]<=1);
    }
    for(const spec of Object.values(config.sculptures)){assert.ok(spec.groups.length);assert.equal(typeof spec.orientationGroup,'string');assert.ok(spec.orientationGroup.length);}
  }
});
