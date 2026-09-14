import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {gardenLayout,pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {createMuseumLandscape,configureMuseumLandscapeAsset} from '../src/yuanmingyuan/museum-landscape.js';
import {prepareTerrainPads,applyTerrainPads} from '../src/yuanmingyuan/terrain-pads.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {museumSite,sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {closestOnSegment} from '../src/yuanmingyuan/terrain-geometry.js';
import {haiyueLayout} from '../src/yuanmingyuan/haiyue-layout.js';

test('Fangwaiguan holes require a ready source, preserve surrounding lakes and leave the actual arrival dry',()=>{
  const site=museumSite('fangwaiguan'),before=JSON.stringify(gardenLayout);
  const pending=createMuseumLandscape({sites:[site]});assert.equal(pending.courts.length,0);assert.equal(pending.pads.length,0);
  const ready=createMuseumLandscape({sites:[site],readyAssetIds:['fangwaiguan']});
  assert.equal(ready.courts.length,2);assert.equal(ready.pads.length,1);
  assert.equal(ready.layout.waterBodies,gardenLayout.waterBodies);assert.equal(ready.layout.ornamentalWaters,gardenLayout.ornamentalWaters);
  const p=sitePoint(site,site.arrival);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,q=[p.x+Math.cos(a)*.4,p.z+Math.sin(a)*.4];
    assert(pointInPolygon(q,ready.pads[0].polygon));assert(ready.courts.every(c=>!pointInPolygon(q,c.polygon)));
  }
  assert.equal(JSON.stringify(gardenLayout),before);
});

test('Haiyue retains the actual circular stone footprint, lake datum and four low landings',()=>{
  const before=JSON.stringify(gardenLayout),site=museumSite('haiyue-kaijin'),{layout,pads}=createMuseumLandscape();
  const island=layout.islands.find(i=>i.id==='haiyue-island'),lake=layout.waterBodies.find(w=>w.id===island.waterId),pad=pads.find(p=>p.id==='haiyue-terrace-substrate');
  assert(Math.abs(sitePoint(site,[0,haiyueLayout.waterline,0]).y-lake.surfaceY)<1e-8);
  const paving=sitePoint(site,[0,haiyueLayout.terraces[0].topY,0]).y;
  assert(Math.abs(paving-3.05)<1e-8);assert(pad.heightY<paving);assert(Math.abs(paving-pad.heightY-.06)<1e-8);
  for(const point of island.polygon){assert(Math.abs(Math.hypot(point[0]-site.position[0],point[1]-site.position[2])-38.2)<1e-8);assert(pointInPolygon(point,lake.polygon));}
  assert(Math.abs(sitePoint(site,[0,haiyueLayout.dock.landingY,0]).y-lake.surfaceY-.17)<1e-8);
  assert.equal(layout.bridges,gardenLayout.bridges,'do not invent the later Guangxu bridge');
  assert.equal(layout.waterBodies,gardenLayout.waterBodies);assert.equal(JSON.stringify(gardenLayout),before);
  for(const old of gardenLayout.islands.filter(i=>i.id!=='haiyue-island'))assert.equal(layout.islands.find(i=>i.id===old.id),old);
});

test('actual terrain triangles stay under the circular terrace, with lake water outside the masonry',()=>{
  const site=museumSite('haiyue-kaijin'),{layout,pads}=createMuseumLandscape(),[x,,z]=site.position;
  const rect=(r)=>[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];
  const fixture={id:'haiyue-water-contact',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(100)}},gardens:[],waterBodies:[{id:'changchun-great-lake',polygon:rect(85),surfaceY:2,bedY:.2}],channels:[],islands:layout.islands.filter(i=>i.id==='haiyue-island'),landforms:[],bridges:[],ornamentalWaters:[]};
  const terrain=createGardenTerrain({layout:fixture,assetPads:pads.filter(p=>p.id==='haiyue-terrace-substrate')});
  try{
    for(const [dx,dz] of [[0,0],[16,0],[0,-24],[24,24]]){const support=terrain.surfaceAt(x+dx,z+dz);assert(support.height<=2.991);assert.equal(support.walkable,true);}
    for(const [dx,dz] of [[40,0],[-40,0],[0,40],[0,-40],[34,34]]){const support=terrain.surfaceAt(x+dx,z+dz);assert.equal(support.waterY,2);assert.equal(support.walkable,false);}
    assert.equal(terrain.waterSurfaces.length,1);assert.equal(terrain.waterSurfaces[0].worldY,2);
  }finally{terrain.dispose();}
});

test('the Fanghe basin follows the actual model frame and replaces the displaced planning pond once',()=>{
  const before=JSON.stringify(gardenLayout),{layout,pads}=createMuseumLandscape();
  const pond=layout.ornamentalWaters.filter(w=>w.id==='fanghe');assert.equal(pond.length,1);
  assert.deepEqual(pond[0].polygon,[[981,-659.8],[1135,-659.8],[1135,-620.2],[981,-620.2]]);
  assert.equal(pond[0].surfaceY,3.7);assert.equal(pond[0].bedY,2.75);
  assert(pointInPolygon([1058,-640],pond[0].polygon));assert.equal(pointInPolygon([1031.8,-675.4],pond[0].polygon),false);
  assert.equal(pads.filter(p=>p.id==='fanghe-bank-ground').length,1);assert.equal(JSON.stringify(gardenLayout),before);
  assert.equal(layout.registration.metresCalibrated,undefined);assert.equal(pond[0].alignment.metresCalibrated,false);
});

test('Hanjingtang terrain aligns below the real court and does not flatten the surrounding lake',()=>{
  const site={assetId:'hanjingtang',position:[10,6,20],rotationY:Math.PI/2,scale:2};
  const {layout,pads}=createMuseumLandscape({sites:[site]});
  assert.equal(pads.length,1);assert.equal(pads[0].id,'hanjingtang-court-ground');
  assert.equal(layout.waterBodies,gardenLayout.waterBodies);assert.equal(layout.islands,gardenLayout.islands);
  const prepared=prepareTerrainPads(pads);
  assert.equal(applyTerrainPads(10,20,7,prepared),5.94);
  assert.equal(applyTerrainPads(10,200,7,prepared),7);
  assert.deepEqual(pads[0].polygon.map(p=>p.map(n=>Math.round(n))),[[-124,115],[-124,-75],[244,-75],[244,115]]);
});

test('Zhengjuesi rear enclosure fits the Qichun recess without overwriting the historical planning layout',()=>{
  const before=JSON.stringify(gardenLayout),site=museumSite('zhengjuesi');
  const {layout,pads}=createMuseumLandscape();
  const rear=sitePoint(site,[0,0,-74]);assert(Math.abs(rear.z-695.2)<1e-8);
  const replacement=layout.assetWallReplacements.find(w=>w.assetId==='zhengjuesi');
  assert.equal(replacement.width,83);assert.equal(replacement.kind,'asset-owned-enclosure');
  assert(Math.abs(replacement.position[1]-rear.z)<1e-8);
  const pad=pads.find(p=>p.id==='zhengjuesi-court-ground');assert.equal(pad.heightY,3.97);
  assert(pad.polygon.every(point=>pointInPolygon(point,gardenLayout.exhibition.coast.polygon)));
  assert.equal(layout.gardens,gardenLayout.gardens);assert.equal(JSON.stringify(gardenLayout),before);
});

test('only the coarse wall span owned by the admitted enclosure is removed',()=>{
  const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
  const layout={id:'enclosure-alignment-fixture',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(-30,-30,30,30)}},gardens:[{id:'qichunyuan',boundary:rect(-10,-10,10,10),groundY:4,wallTopY:7.5}],waterBodies:[],channels:[],islands:[],landforms:[],bridges:[],ornamentalWaters:[],assetWallReplacements:[{id:'actual-rear-wall',gardenIds:['qichunyuan'],position:[0,10],width:6,kind:'asset-owned-enclosure'}]};
  const terrain=createGardenTerrain({layout});
  try{
    assert.equal(terrain.diagnostics.wallOpenings.length,1);assert.equal(terrain.diagnostics.wallOpenings[0].kind,'asset-owned-enclosure');
    const distance=point=>Math.min(...terrain.colliders.map(c=>closestOnSegment(point,c.from,c.to).distance));
    assert(distance([0,10])>=2.99);assert(distance([8,10])<1e-8);assert(distance([0,-10])<1e-8);
  }finally{terrain.dispose();}
});

test('a separately rotated/scaled model transforms all four basin vertices and its water datum consistently',()=>{
  const site={assetId:'fanghe-xianfahua',position:[10,6,20],rotationY:Math.PI/2,scale:2};
  const {layout}=createMuseumLandscape({sites:[site]});const water=layout.ornamentalWaters.find(w=>w.id==='fanghe');
  assert(Math.abs(water.polygon[0][0]-(10-39.6))<1e-10);assert(Math.abs(water.polygon[0][1]-338)<1e-10);assert.equal(water.surfaceY,5.4);
  const absent=createMuseumLandscape({sites:[]});assert.equal(absent.layout.ornamentalWaters,gardenLayout.ornamentalWaters);
  const hillSite={assetId:'xianfashan',position:[925,4,-640],rotationY:0,scale:1};
  const pending=createMuseumLandscape({sites:[hillSite]});assert.equal(pending.layout.landforms,gardenLayout.landforms);
  const hill=createMuseumLandscape({sites:[hillSite],readyAssetIds:['xianfashan']});assert(!hill.layout.landforms.some(h=>h.id==='xianfa-hill'));assert(gardenLayout.landforms.some(h=>h.id==='xianfa-hill'));
});

test('only the duplicate reflective sheet is hidden; stone geometry, flowing water and resource ownership survive',()=>{
  const group=new Group(),basin=new Group();basin.name='xianfahua-fanghe-basin';group.add(basin);
  const geometry=new BoxGeometry(),stoneMaterial=new MeshStandardMaterial(),waterMaterial=new MeshStandardMaterial(),flowMaterial=new MeshStandardMaterial();
  waterMaterial.userData={category:'water',role:'surface'};flowMaterial.userData={category:'water',role:'flow'};
  const stone=new Mesh(geometry,stoneMaterial),sheet=new Mesh(geometry,waterMaterial),flow=new Mesh(geometry,flowMaterial);basin.add(stone,sheet,flow);
  let releases=0;geometry.addEventListener('dispose',()=>releases++);
  try{
    configureMuseumLandscapeAsset({group},{assetId:'fanghe-xianfahua'});
    assert.equal(sheet.visible,false);assert.equal(sheet.userData.navigation,false);assert.equal(stone.visible,true);assert.equal(flow.visible,true);assert.equal(releases,0);assert.equal(basin.children.length,3);
    assert.throws(()=>configureMuseumLandscapeAsset({group:new Group()},{assetId:'fanghe-xianfahua'}),/named basin/);
  }finally{geometry.dispose();stoneMaterial.dispose();waterMaterial.dispose();flowMaterial.dispose();}
});

test('the bank pad stays below stone paving and joins the existing terrain continuously',()=>{
  const pads=prepareTerrainPads([{id:'bank',polygon:[[-10,-10],[10,-10],[10,10],[-10,10]],heightY:3.73,blend:3}]);
  assert.equal(applyTerrainPads(0,0,4.2,pads),3.73);
  assert.equal(applyTerrainPads(20,0,4.2,pads),4.2);
  assert(Math.abs(applyTerrainPads(10-1e-6,0,4.2,pads)-applyTerrainPads(10+1e-6,0,4.2,pads))<1e-9);
  assert.throws(()=>prepareTerrainPads([{...pads[0],heightY:NaN}]),/Terrain pads/);
});

test('the actual triangulated fixture retains a raised basin, water hole and walkable bank',()=>{
  const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
  const layout={id:'small-bank-contact-fixture',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(-70,-60,70,60)}},gardens:[],waterBodies:[],channels:[],islands:[],landforms:[],bridges:[],ornamentalWaters:[{id:'fanghe',kind:'ornamental-basin',polygon:rect(-20,-8,20,8),surfaceY:3.7,bedY:2.75}]};
  const terrain=createGardenTerrain({layout,assetPads:[{id:'bank',polygon:rect(-28,-14,28,14),heightY:3.73,blend:3}]});
  try{
    assert.equal(terrain.surfaceAt(0,0).walkable,false);assert.equal(terrain.surfaceAt(0,0).waterY,3.7);
    assert(terrain.heightAt(0,0)<3.7);assert.equal(terrain.waterSurfaces.length,1);assert.equal(terrain.waterSurfaces[0].worldY,3.7);
    // Sample actual triangles, rather than calling the analytic pad function.
    for(const x of [-15,0,15]){const support=terrain.surfaceAt(x,12,{includeBridges:false});assert(support.height<3.8);assert(support.height>=3.69);assert.equal(support.walkable,true);}
  }finally{terrain.dispose();}
});
