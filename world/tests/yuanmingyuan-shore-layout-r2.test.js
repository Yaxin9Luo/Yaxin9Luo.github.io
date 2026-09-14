import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createXianfaShoreCommunityLayoutR2,xianfaShoreCommunityR2Spec} from '../src/yuanmingyuan/xianfa-shore-community-layout-r2.js';
import {createXianfaShoreCommunityLayout} from '../src/yuanmingyuan/xianfa-shore-community-layout.js';
import {createProjectionModel,polygonGap,production,world} from '../../work/yuanmingyuan/xianfa-shore-community-r2/projection-model.mjs';

const layout=createXianfaShoreCommunityLayoutR2();
test('R2 retains every approved full-source instance request and unresolved Y with positive authored scales',()=>{
  assert.equal(layout.placements.length,182);assert.equal(new Set(layout.placements.map(p=>p.id)).size,182);assert.deepEqual(layout,createXianfaShoreCommunityLayoutR2());
  assert.deepEqual(Object.fromEntries(['sedge','fern','flower-shrub','lake-rock'].map(s=>[s,layout.placements.filter(p=>p.species===s).length])),xianfaShoreCommunityR2Spec.counts);
  for(const p of layout.placements){assert.equal(p.position[1],null);assert.ok(p.position[0]&&Number.isFinite(p.position[2]));assert.ok(p.scale>0&&Number.isFinite(p.yaw));if(p.species==='sedge')assert.ok(p.scale>=1.10&&p.scale<=1.45);if(p.species==='flower-shrub')assert.ok(p.scale>=1.35&&p.scale<=1.80);}
  assert.equal(layout.placements.filter(p=>p.drift==='west-three-flower-accent').length,3);assert.equal(layout.placements.filter(p=>p.drift==='east-single-flower-accent').length,1);
});

test('R1 frozen source bytes, two stone placement requests and two viewing corridors are preserved',()=>{
  const expected={'xianfa-shore-community.js':'2a9416b66b3ba27102fcb1d17452e43ef58442c4aa4e25f6d7aef35942fea2ce','xianfa-shore-community-layout.js':'3903c17d38be40f0499fd7043615fa1a22a4e7ab3a87e58ce403c99c79f32675'};
  for(const [file,sha] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/yuanmingyuan/'+file,import.meta.url))).digest('hex'),sha);
  const r1=createXianfaShoreCommunityLayout();assert.deepEqual(layout.clearings,r1.clearings);assert.deepEqual(layout.contextIds,r1.contextIds);assert.deepEqual(layout.footprint,r1.footprint);assert.deepEqual(layout.placements.filter(p=>p.species==='lake-rock'),r1.placements.filter(p=>p.species==='lake-rock'));
});

test('every new crown/root proxy respects actual original terrain, lip, water, path, willow and stone exclusions',()=>{
  const m=createProjectionModel();try{const rows=[];for(const record of layout.placements.filter(p=>p.species!=='lake-rock')){const p=m.project(record);assert.equal(p.valid,true,record.id+': '+p.reason);assert.ok(p.slopeDegrees<=18);assert.ok(Math.min(...p.sn.map(x=>x[1]))>=.8);rows.push(p);}
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j],distance=Math.hypot(a.rootCentre[0]-b.rootCentre[0],a.rootCentre[1]-b.rootCentre[1]);assert.ok(distance>=a.rootRadius+b.rootRadius+.035,`${a.record.id} vs ${b.record.id}`);}
    assert.equal(m.stats.fullSourceFactories,0);assert.equal(m.stats.queries,180);
  }finally{m.dispose();}
});

test('three unequal grass drifts have connected crown-bound projections, including the route around the steep east belt',()=>{
  const m=createProjectionModel();try{const rows=layout.placements.filter(p=>p.species==='sedge').map(p=>m.project(p));for(const id of ['west-crescent','middle-fan','east-open-crescent']){
    const ps=rows.filter(p=>p.record.drift===id),seen=new Set([0]),queue=[0];while(queue.length){const i=queue.shift();for(let j=0;j<ps.length;j++)if(!seen.has(j)&&polygonGap(ps[i].polygon,{polygon:ps[j].polygon})===0){seen.add(j);queue.push(j);}}
    assert.equal(seen.size,ps.length,id+' has a disconnected projected leaf mass');
  }
  const east=rows.filter(p=>p.record.drift==='east-open-crescent');assert.ok(east.some(p=>p.record.shoreCoordinates[0]<6&&p.record.shoreCoordinates[1]>5));assert.ok(east.some(p=>p.record.shoreCoordinates[0]>8&&p.record.shoreCoordinates[1]>11));
  // Bound overlap is a necessary layout proxy, not an actual leaf-coverage or
  // visual-acceptance assertion. The native complete scene still must pass.
  }finally{m.dispose();}
});

test('density changes are real centre distances and do not repeat the two-row R1 pattern',()=>{
  const near=rows=>rows.map(p=>Math.min(...rows.filter(q=>q!==p).map(q=>Math.hypot(p.position[0]-q.position[0],p.position[2]-q.position[2])))).sort((a,b)=>a-b);
  const ps=layout.placements.filter(p=>p.species==='sedge'),before=near(production.community.placements.filter(p=>p.species==='sedge')),after=near(ps);
  assert.ok(after[0]>=.38);assert.ok(after[Math.floor(after.length/2)]<before[Math.floor(before.length/2)]*.75);
  for(const drift of ['west-crescent','middle-fan','east-open-crescent']){const bins=new Set(ps.filter(p=>p.drift===drift).map(p=>Math.floor(p.shoreCoordinates[1]/.5)));assert.ok(bins.size>=7,drift+' must occupy a curved depth interval rather than two short rows');}
});

test('independent bad placements still reject the real >18-degree belt and an existing viewing corridor',()=>{
  const m=createProjectionModel();try{const sample={...layout.placements.find(p=>p.species==='sedge'),scale:1.2,yaw:.4};for(const [sn,reason] of [[[9.8,4.8],'slope-over-18'],[[-3.7,8],'reservation-shore-water-window-1']]){const [x,z]=world(sn),p=m.project({...sample,position:[x,null,z]});assert.equal(p.valid,false);assert.equal(p.reason,reason);}}finally{m.dispose();}
});
