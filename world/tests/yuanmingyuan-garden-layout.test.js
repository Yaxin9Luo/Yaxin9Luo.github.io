import test from 'node:test';
import assert from 'node:assert/strict';
import {gardenLayout,pointInPolygon,waterAt,surfaceAt,getGardenGroup,transformAssetPoint} from '../src/yuanmingyuan/garden-layout.js';

const xz=([x,,z])=>[x,z];
const area=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function properIntersection(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8;}
function checkRing(ring,label){
  assert.ok(ring.length>=3,label);assert.ok(ring.every(p=>p.length===2&&p.every(Number.isFinite)),label);assert.ok(area(ring)>0,label+' winding');
  for(let i=0;i<ring.length;i++)for(let j=i+2;j<ring.length;j++)if(!(i===0&&j===ring.length-1))assert.equal(properIntersection(ring[i],ring[(i+1)%ring.length],ring[j],ring[(j+1)%ring.length]),false,label+' self intersection');
}

test('the three gardens and exhibition coast remain distinct unregistered layers',()=>{
  assert.deepEqual(gardenLayout.gardens.map(g=>g.id),['yuanmingyuan','changchunyuan','qichunyuan']);
  assert.deepEqual(gardenLayout.timeLayer.years,[1859,1860]);assert.equal(gardenLayout.registration.status,'unregistered');assert.equal(gardenLayout.registration.rmsResidual,null);
  assert.equal(gardenLayout.coordinates.east,'+X');assert.equal(gardenLayout.coordinates.south,'+Z');assert.equal(gardenLayout.coordinates.metresCalibrated,false);
  assert.equal(gardenLayout.exhibition.coast.evidence,'exhibition-design');assert.notEqual(gardenLayout.exhibition.coast.id,'garden-wall');
  for(const garden of gardenLayout.gardens){assert.ok(garden.boundary.length>8);checkRing(garden.boundary,garden.id);for(const p of garden.boundary)assert.ok(pointInPolygon(p,gardenLayout.exhibition.coast.polygon));}
});

test('all terrain and water rings are usable, finite, simple polygons with evidence',()=>{
  for(const feature of [...gardenLayout.waterBodies,...gardenLayout.ornamentalWaters,...gardenLayout.islands,...gardenLayout.landforms,...gardenLayout.channels,gardenLayout.exhibition.coast]){
    checkRing(feature.polygon,feature.id);assert.ok(feature.sourceIds.length);for(const id of feature.sourceIds)assert.ok(gardenLayout.sources[id],id);
  }
  for(const water of [...gardenLayout.waterBodies,...gardenLayout.ornamentalWaters]){
    assert.ok(water.surfaceY>water.bedY);assert.ok(water.polygon.length>=8);
    const garden=gardenLayout.gardens.find(g=>g.id===water.regionId);for(const p of water.polygon)assert.ok(pointInPolygon(p,garden.boundary),water.id+' within its garden');
  }
  for(const island of gardenLayout.islands){
    const water=gardenLayout.waterBodies.find(w=>w.id===island.waterId);for(const p of island.polygon)assert.ok(pointInPolygon(p,water.polygon),island.id+' inside parent water');
    assert.ok(pointInPolygon(xz(island.anchor),island.polygon));
  }
});

test('Jiuzhou has nine land islands, Fuhai has three, and islands cut holes in water',()=>{
  const nine=gardenLayout.islands.filter(i=>i.waterId==='houhu'),three=gardenLayout.islands.filter(i=>i.waterId==='fuhai');assert.equal(nine.length,9);assert.equal(three.length,3);
  for(const island of [...nine,...three]){
    const water=gardenLayout.waterBodies.find(w=>w.id===island.waterId);assert.ok(water);
    for(const point of island.polygon)assert.ok(pointInPolygon(point,water.polygon),island.id+' sits within its parent water');
    assert.equal(waterAt(island.anchor[0],island.anchor[2]),null,island.id+' is dry land');assert.equal(surfaceAt(island.anchor[0],island.anchor[2]).kind,'land');
  }
  assert.equal(waterAt(145,-100)?.id,'fuhai');assert.equal(surfaceAt(145,-100).kind,'water');
});

test('the lake network connects all three gardens through geometrically joined channels',()=>{
  const byId=new Map(gardenLayout.waterBodies.map(w=>[w.id,w])),adjacent=new Map([...byId.keys()].map(id=>[id,new Set()]));
  for(const channel of gardenLayout.channels){
    const from=byId.get(channel.fromWaterId),to=byId.get(channel.toWaterId);assert.ok(from&&to,channel.id);
    assert.ok(pointInPolygon(channel.centerline[0],from.polygon),channel.id+' begins in its source');assert.ok(pointInPolygon(channel.centerline.at(-1),to.polygon),channel.id+' reaches its destination');
    assert.equal(channel.surfaceY,from.surfaceY);assert.equal(channel.surfaceY,to.surfaceY);assert.ok(channel.width>0);
    adjacent.get(from.id).add(to.id);adjacent.get(to.id).add(from.id);
  }
  const visited=new Set(),queue=['fuhai'];while(queue.length){const id=queue.pop();if(visited.has(id))continue;visited.add(id);queue.push(...adjacent.get(id));}
  assert.equal(visited.size,byId.size);assert.deepEqual(new Set([...byId.values()].map(w=>w.regionId)),new Set(['yuanmingyuan','changchunyuan','qichunyuan']));
});

test('bridge approaches reach dry land and their decks cross water above its surface',()=>{
  assert.ok(gardenLayout.bridges.length>=8);
  for(const bridge of gardenLayout.bridges){
    assert.equal(waterAt(bridge.from[0],bridge.from[2]),null,bridge.id+' first bank');assert.equal(waterAt(bridge.to[0],bridge.to[2]),null,bridge.id+' second bank');
    let crossed=false;for(let n=1;n<40;n++){const t=n/40,w=waterAt(bridge.from[0]*(1-t)+bridge.to[0]*t,bridge.from[2]*(1-t)+bridge.to[2]*t);if(w){crossed=true;assert.ok(bridge.deckY>w.surfaceY);}}
    assert.ok(crossed,bridge.id+' crosses a mapped waterway');assert.equal(bridge.position[1],bridge.deckY);
  }
});

test('all main groups have explicit land placement, height, time and evidence status',()=>{
  assert.ok(gardenLayout.groups.length>=15&&gardenLayout.groups.length<=30);assert.equal(new Set(gardenLayout.groups.map(g=>g.id)).size,gardenLayout.groups.length);
  for(const group of gardenLayout.groups){
    assert.ok(group.position.every(Number.isFinite));assert.ok(group.heightHint>0);assert.equal(group.status,'layout-planned');assert.equal(group.placement.evidence,'author-proportional');assert.ok(group.members.length);
    const garden=gardenLayout.gardens.find(g=>g.id===group.regionId);assert.ok(garden,group.id);
    if(group.wallRelation==='inside')assert.ok(pointInPolygon(xz(group.position),garden.boundary),group.id+' in its garden');
    else{assert.equal(group.wallRelation,'attached-outside');assert.equal(pointInPolygon(xz(group.position),garden.boundary),false);}
    assert.equal(waterAt(group.position[0],group.position[2]),null,group.id+' placement is on land');
  }
  assert.equal(getGardenGroup('constructor'),null);assert.equal(getGardenGroup('missing'),null);assert.equal(getGardenGroup('zhengjuesi').wallRelation,'attached-outside');
});

test('Western Palace sequencing and opposing facades survive the common coordinates',()=>{
  const sequence=['xieqiqu','yangquelong','fangwaiguan','haiyantang','yuanyingguan','xianfashan','xianfahua'];
  for(let i=1;i<sequence.length;i++)assert.ok(getGardenGroup(sequence[i]).position[0]>getGardenGroup(sequence[i-1]).position[0]);
  assert.ok(getGardenGroup('huanghuazhen').position[2]<getGardenGroup('xieqiqu').position[2]);assert.ok(getGardenGroup('wuzhuting').position[2]>getGardenGroup('fangwaiguan').position[2]);
  const hai=getGardenGroup('haiyantang'),front=transformAssetPoint(hai,[0,0,1]),back=transformAssetPoint(hai,[0,0,-1]);assert.ok(front[0]<hai.position[0]);assert.ok(back[0]>hai.position[0]);assert.ok(Math.abs(front[2]-hai.position[2])<1e-8);
  const yu=getGardenGroup('yuanyingguan'),north=transformAssetPoint(yu,[0,0,-38.5]),south=transformAssetPoint(yu,[0,0,26]);assert.ok(north[2]<south[2]);assert.equal(yu.placement.rotationY,0);
});

test('reported local dimensions never promote the whole garden to a survey',()=>{
  const controls=new Map(gardenLayout.metricFrames.westernPalaces.controls.map(c=>[c.id,c]));
  assert.deepEqual(controls.get('dashuifa-court').dimensions,[110,60]);assert.deepEqual(controls.get('paired-pools').dimensions,[18,62]);assert.deepEqual(controls.get('court-depression').dimensions,[1.3]);
  for(const control of controls.values())assert.equal(control.evidence,'reported-measurement');
  assert.equal(gardenLayout.metricFrames.westernPalaces.registration.status,'author-placement');assert.equal(gardenLayout.metricFrames.westernPalaces.registration.rmsResidual,null);
  assert.equal(gardenLayout.sources['sample-2517'].usableAs1860AsBuilt,false);assert.equal(gardenLayout.sources['mit-three-gardens'].useForCoordinates,false);
});

test('point classification handles shore boundaries and the modern open sea',()=>{
  assert.equal(pointInPolygon([0,0],[[0,0],[2,0],[2,2],[0,2]]),true);assert.equal(pointInPolygon([3,1],[[0,0],[2,0],[2,2],[0,2]]),false);
  assert.equal(surfaceAt(10000,10000).kind,'sea');assert.equal(surfaceAt(10000,10000).height,gardenLayout.exhibition.seaY);
});

test('Fanghe is retained as a separate basin without inventing a surface supply channel',()=>{
  const basin=gardenLayout.ornamentalWaters.find(w=>w.id==='fanghe');assert.ok(basin);assert.equal(basin.hydraulicConnection,'unregistered');
  assert.equal(waterAt(1032,-675)?.id,'fanghe');assert.ok(getGardenGroup('xianfashan').position[0]<1032);assert.ok(getGardenGroup('xianfahua').position[0]>1032);
  assert.equal(gardenLayout.channels.some(c=>c.fromWaterId==='fanghe'||c.toWaterId==='fanghe'),false);
});

test('height sampling follows authored mound controls and leaves lake surfaces level',()=>{
  for(const hill of gardenLayout.landforms){assert.ok(pointInPolygon(xz(hill.center),hill.polygon),hill.id+' control centre');assert.equal(surfaceAt(hill.center[0],hill.center[2]).height,hill.peakY);}
  assert.equal(surfaceAt(145,-100).height,2);
});
