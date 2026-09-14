import test from 'node:test';
import assert from 'node:assert/strict';
import {museumSites,museumSite,sitePoint,museumCourts} from '../src/yuanmingyuan/museum-sites.js';
import {museumEntry} from '../src/yuanmingyuan/museum-content.js';
import {studioAssets} from '../src/yuanmingyuan/studio-assets.js';
import {pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';

test('every travel destination has an actual deferred factory and a bilingual exhibit',()=>{
  const seen=new Set();for(const site of museumSites){assert(!seen.has(site.id));seen.add(site.id);assert(studioAssets[site.assetId]);assert(museumEntry(site.entryId));assert(site.arrival.every(Number.isFinite));assert.equal(site.position.length,3);}
  for(const id of ['__proto__','constructor','missing',null,{}])assert.equal(museumSite(id),null);
});
test('whole Haiyantang orientation sends its local front west, while Yuanyingguan faces south',()=>{
  const haiyan=museumSite('haiyantang'),yuan=museumSite('yuanyingguan'),west=sitePoint(haiyan,[0,0,10]),south=sitePoint(yuan,[0,0,10]);
  assert(Math.abs(west.x-haiyan.position[0]+10)<1e-10);assert(Math.abs(west.z-haiyan.position[2])<1e-10);
  assert.equal(south.x,yuan.position[0]);assert.equal(south.z,yuan.position[2]+10);
});
test('the actual 110 by 60 fountain court is excavated below its paving with the 1.3 rise retained',()=>{
  const site=museumSite('yuanyingguan'),court=museumCourts()[0],centre=sitePoint(site,[0,0,0]);
  assert(pointInPolygon([centre.x,centre.z],court.polygon));assert(court.floorY<centre.y);assert(Math.abs(court.rimY-centre.y-1.3)<1e-10);
  assert.equal(Math.max(...court.polygon.map(p=>p[0]))-Math.min(...court.polygon.map(p=>p[0])),110);
  assert.equal(Math.max(...court.polygon.map(p=>p[1]))-Math.min(...court.polygon.map(p=>p[1])),60);
});
