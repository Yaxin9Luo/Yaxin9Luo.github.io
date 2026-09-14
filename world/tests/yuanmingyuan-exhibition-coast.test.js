import test from 'node:test';
import assert from 'node:assert/strict';
import {gardenLayout,pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {createExhibitionCoast} from '../src/yuanmingyuan/exhibition-coast.js';
test('contemporary curved coast contains all historic garden boundaries and preserves source coordinates',()=>{
  const before=JSON.stringify(gardenLayout),coast=createExhibitionCoast(gardenLayout);
  assert.ok(coast.length>gardenLayout.exhibition.coast.polygon.length);
  for(const garden of gardenLayout.gardens)for(const point of garden.boundary)assert.ok(pointInPolygon(point,coast),garden.id);
  for(const island of gardenLayout.islands)for(const point of island.polygon)assert.ok(pointInPolygon(point,coast),island.id);
  assert.equal(JSON.stringify(gardenLayout),before);
  assert.deepEqual(createExhibitionCoast(gardenLayout),coast);
});
