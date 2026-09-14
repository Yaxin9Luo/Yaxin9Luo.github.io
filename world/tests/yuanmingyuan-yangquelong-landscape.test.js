import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gardenLayout,pointInPolygon} from '../src/yuanmingyuan/garden-layout.js';
import {createMuseumLandscape,configureMuseumLandscapeAsset} from '../src/yuanmingyuan/museum-landscape.js';
import {createGardenTerrain} from '../src/yuanmingyuan/garden-terrain.js';
import {museumSupport} from '../src/yuanmingyuan/museum-support.js';
import {sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {bridgeDeckGeometry,roundPool} from '../src/yuanmingyuan/huanghuazhen-geometry.js';
import {createTriangleSampler,triangulateSurface,polygonArea} from '../src/yuanmingyuan/terrain-geometry.js';

const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const close=(a,b,tolerance=1e-5)=>assert(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const site={id:'yangquelong',assetId:'yangquelong',position:[438,4,-640],rotationY:0,scale:1};
const localPoint=(x,z,y=0)=>sitePoint(site,[x,y,z]);
const fixture={id:'yangquelong-court-water-fixture',exhibition:{seaY:0,groundY:4,coast:{polygon:rect(372,-706,504,-574)}},gardens:[],waterBodies:[],ornamentalWaters:[],channels:[],islands:[],landforms:[],bridges:[]};
const basinNames=['yangquelong-east-water-channel','yangquelong-west-pool-north','yangquelong-west-pool-south'];
function adapted(){return createMuseumLandscape({layout:fixture,sites:[site]});}

test('the admitted frame gives one substrate and three exact excavation/wet/surface footprints without ornamental banks',()=>{
  const before=JSON.stringify(gardenLayout),result=createMuseumLandscape({sites:[site]});
  assert.equal(result.pads.length,1);assert.equal(result.courts.length,3);
  assert.equal(result.layout.ornamentalWaters,gardenLayout.ornamentalWaters);
  assert.equal(result.layout.waterBodies,gardenLayout.waterBodies);assert.equal(result.layout.bridges,gardenLayout.bridges);
  const pad=result.pads[0];assert.deepEqual(pad.polygon,rect(419,-664,460,-616));close(pad.heightY,3.79);
  const [east,north,south]=result.courts;
  assert.deepEqual(east.polygon,rect(451,-663.5,456,-616.5));assert.deepEqual(east.water.polygon,east.polygon);assert.deepEqual(east.water.surfacePolygon,east.polygon);
  close(east.floorY,3.13);close(east.water.surfaceY,3.70);close(east.rimY,pad.heightY);
  for(const [court,z] of [[north,-644.85],[south,-635.15]]){
    assert.equal(court.polygon.length,72);assert.equal(court.water.polygon.length,64);assert.equal(court.water.surfacePolygon.length,64);
    close(court.floorY,3.57);close(court.water.surfaceY,4.17);close(court.rimY,3.79);
    for(const [polygon,radius] of [[court.polygon,1.30],[court.water.polygon,1.08],[court.water.surfacePolygon,1.065]])for(const p of polygon)close(Math.hypot(p[0]-431.4,p[1]-z),radius,1e-9);
    assert.equal(court.alignment.metresCalibrated,false);
  }
  assert.equal(JSON.stringify(gardenLayout),before);assert.deepEqual(createMuseumLandscape({sites:[]}).courts,[]);
});

test('all holes, wet bounds and water levels follow the same rotated/scaled site transform',()=>{
  const other={...site,position:[-18,7,32],rotationY:Math.PI*.37,scale:1.7};
  const a=adapted(),b=createMuseumLandscape({layout:fixture,sites:[other]});
  function transformed([x,z]){const p=sitePoint(other,[x-site.position[0],0,z-site.position[2]]);return[p.x,p.z];}
  for(let i=0;i<a.courts.length;i++){
    for(const key of ['polygon','surfacePolygon'])for(let j=0;j<a.courts[i].water[key].length;j++){
      const p=transformed(a.courts[i].water[key][j]);close(b.courts[i].water[key][j][0],p[0],1e-9);close(b.courts[i].water[key][j][1],p[1],1e-9);
    }
    for(let j=0;j<a.courts[i].polygon.length;j++){const p=transformed(a.courts[i].polygon[j]);close(b.courts[i].polygon[j][0],p[0],1e-9);close(b.courts[i].polygon[j][1],p[1],1e-9);}
    for(const key of ['floorY','rimY'])close(b.courts[i][key],7+(a.courts[i][key]-4)*1.7,1e-9);
    close(b.courts[i].water.surfaceY,7+(a.courts[i].water.surfaceY-4)*1.7,1e-9);
  }
  close(b.pads[0].heightY,7-.21*1.7);close(b.pads[0].blend,2*1.7);
});

test('pool water/bed dimensions agree with the real shared roundPool component, without constructing an asset',()=>{
  const calls=[],parent=new THREE.Group(),builder={m:{wetStone:'bed',stone:'wall',carving:'coping',water:'water'},polygon:(group,polygon,bottom,top,material,holes=[])=>calls.push({group,polygon,bottom,top,material,holes})};
  roundPool(builder,parent,basinNames[1],-6.6,-4.85,1.08,.34,.17);
  const court=adapted().courts[1],bed=calls.find(c=>c.material==='bed'),wall=calls.find(c=>c.material==='wall'),water=calls.find(c=>c.material==='water');
  const world=polygon=>polygon.map(([x,z])=>{const p=localPoint(x-6.6,z-4.85);return[p.x,p.z];});
  assert.deepEqual(court.water.polygon,world(wall.holes[0]));assert.deepEqual(court.water.surfacePolygon,world(water.polygon));
  close(court.water.surfaceY,water.top+4);close(court.floorY,bed.bottom+4-.03);
});

let terrain;
test.before(()=>{const {layout,pads,courts}=adapted();terrain=createGardenTerrain({layout,assetPads:pads,assetCourts:courts});terrain.group.updateMatrixWorld(true);});
test.after(()=>terrain?.dispose());

test('real land triangles are absent in all three cutouts and the retained stone substrates are below their beds',()=>{
  const land=terrain.group.getObjectByName('yuanming-continuous-land');
  for(const [x,z,floor] of [[15.5,0,3.13],[-6.6,-4.85,3.57],[-6.6,4.85,3.57]]){
    const p=localPoint(x,z),hits=new THREE.Raycaster(new THREE.Vector3(p.x,20,p.z),new THREE.Vector3(0,-1,0)).intersectObject(land);
    assert.equal(hits.length,0);const support=terrain.surfaceAt(p.x,p.z);close(support.height,floor);assert.equal(support.walkable,false);
  }
  for(const [x,z] of [[-17,0],[11,0],[19,0],[-6.6+1.34,-4.85]]){const p=localPoint(x,z),support=terrain.surfaceAt(p.x,p.z);close(support.height,3.79);assert.equal(support.walkable,true);assert.equal(support.waterY,undefined);}
});

test('rectangular and clockwise circular cut walls face the empty excavation',()=>{
  const wall=terrain.group.getObjectByName('yuanming-asset-court-excavation-walls');
  for(const [x,z,distance] of [[15.5,0,2.5],[-6.6,-4.85,1.30],[-6.6,4.85,1.30]]){
    const p=localPoint(x,z),ray=new THREE.Raycaster(new THREE.Vector3(p.x,3.70,p.z),new THREE.Vector3(1,0,0),0,3),hit=ray.intersectObject(wall)[0];
    assert(hit,'an interior FrontSide ray must see the excavation wall');close(hit.distance,distance,2e-5);assert(hit.face.normal.x<-.9);
  }
});

test('three independent level water meshes follow their real outlines and generate no shore walks, bridge or rail colliders',()=>{
  assert.equal(terrain.waterSurfaces.length,3);assert.equal(terrain.diagnostics.assetWaterCount,3);
  assert.equal(terrain.diagnostics.wetRegions,0);assert.equal(terrain.bridges.length,0);assert.equal(terrain.colliders.length,0);
  assert(!terrain.group.children.some(mesh=>/shore-walk|formal-basin|open-balustrade/.test(mesh.name)));
  const courts=adapted().courts;
  for(let i=0;i<3;i++){
    const sheet=terrain.waterSurfaces[i],court=courts[i];close(sheet.worldY,court.water.surfaceY);
    assert.equal(sheet.type,'ornamental-basin');assert.equal(sheet.assetId,'yangquelong');assert.deepEqual(sheet.polygon,court.water.surfacePolygon);
    const p=sheet.geometry.attributes.position,index=sheet.geometry.index;let area=0;
    for(let n=0;n<index.count;n+=3){const triangle=[0,1,2].map(j=>{const k=index.getX(n+j);close(p.getY(k),0);return[p.getX(k),p.getZ(k)];});area+=Math.abs(polygonArea(triangle));}
    close(area,Math.abs(polygonArea(court.water.surfacePolygon)),.0002);
    const sampler=createTriangleSampler([sheet.geometry]);try{if(i){const center=localPoint(-6.6,i===1?-4.85:4.85);assert(sampler.sample(center.x,center.z));assert.equal(sampler.sample(center.x+1.075,center.z),null);}}finally{sampler.dispose();}
  }
  // The 15 mm band between the visible sheet and the real inner wall is wet.
  const edge=localPoint(-6.6+1.075,-4.85);close(terrain.surfaceAt(edge.x,edge.z).waterY,4.17);
});

test('actual small bridge triangles remain dry above channel water while both exposed stone pool floors are rejected',()=>{
  const geometry=bridgeDeckGeometry(3.95,5.6),material=new THREE.MeshBasicMaterial(),bridge=new THREE.Mesh(geometry,material);
  bridge.rotation.y=Math.PI/2;bridge.position.set(453.5,4,-640);bridge.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(453.5,20,-640),new THREE.Vector3(0,-1,0));
  try{
    const hit=ray.intersectObject(bridge)[0];close(hit.point.y,4.28);
    const ground=terrain.surfaceAt(453.5,-640);close(ground.waterY,3.7);
    const support=museumSupport(ground,{height:hit.point.y,normal:[0,1,0],walkable:true});assert.equal(support.walkable,true);close(support.height,4.28);
    const floorCases=[[15.5,8,3.25,3.70],[-6.6,-4.85,3.71,4.17],[-6.6,4.85,3.71,4.17]];
    for(const [x,z,y,waterY] of floorCases){const p=localPoint(x,z),floor=triangulateSurface([{outer:rect(p.x-.1,p.z-.1,p.x+.1,p.z+.1),holes:[]}],{heightAt:()=>y,edgeLength:Infinity}),mesh=new THREE.Mesh(floor,material);mesh.updateMatrixWorld(true);
      try{const hit=new THREE.Raycaster(new THREE.Vector3(p.x,20,p.z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0],support=museumSupport(terrain.surfaceAt(p.x,p.z),{height:hit.point.y,normal:[0,1,0],walkable:true});assert.equal(support.walkable,false);close(support.waterY,waterY);close(support.height,y);}finally{floor.dispose();}
    }
    const under=new THREE.Raycaster(new THREE.Vector3(453.5,3.95,-644),new THREE.Vector3(0,0,1),0,8);assert.equal(under.intersectObject(bridge).length,0,'the arch underpass is not a filled navigation box');
  }finally{geometry.dispose();material.dispose();}
});

test('local guide support retains the same three water levels, geometry heights and maxY rejection',()=>{
  const local=terrain.createGuideSupport({minX:414,maxX:465,minZ:-670,maxZ:-610});
  try{for(const [x,z] of [[-17,0],[15.5,0],[15.5,12],[-6.6,-4.85],[-6.6,4.85],[-5.26,-4.85]])for(const maxY of [3.3,3.8,4.5,Infinity]){
    const p=localPoint(x,z),a=terrain.surfaceAt(p.x,p.z,{maxY}),b=local.surfaceAt(p.x,p.z,{maxY});assert.equal(b?.height,a?.height);assert.deepEqual(b?.normal,a?.normal);assert.equal(b?.waterY,a?.waterY);assert.equal(b?.walkable,a?.walkable);
  }}finally{local.dispose();}
});

test('optional court support callbacks keep the wet datum and cannot turn a submerged floor into walking ground',()=>{
  const {layout,pads,courts}=adapted();let height=3.25,asObject=false;
  const local=createGardenTerrain({layout,assetPads:pads,assetCourts:[{...courts[0],sampleHeight:()=>asObject?{height,normal:[0,1,0],walkable:true}:height}]});
  try{
    for(asObject of [false,true]){let hit=local.surfaceAt(453.5,-640);assert.equal(hit.supportSource,'asset-sampler');assert.equal(hit.walkable,false);close(hit.waterY,3.7);}
    height=4.28;const above=local.surfaceAt(453.5,-640);assert.equal(above.walkable,true);close(above.waterY,3.7);close(above.height,4.28);
    const below=local.surfaceAt(453.5,-640,{maxY:3.5});close(below.height,3.13);assert.equal(below.walkable,false);close(below.waterY,3.7);
  }finally{local.dispose();}
});

function waterResource(){
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),surface=new THREE.MeshStandardMaterial(),flow=new THREE.MeshStandardMaterial(),stone=new THREE.MeshStandardMaterial();
  surface.userData={category:'water',role:'surface'};flow.userData={category:'water',role:'flow'};
  const sheets=[],jets=[],bowls=[];
  for(const name of basinNames){const basin=new THREE.Group();basin.name=name;group.add(basin);const sheet=new THREE.Mesh(geometry,surface);basin.add(sheet,new THREE.Mesh(geometry,stone));sheets.push(sheet);for(let i=0;i<2;i++){const jet=new THREE.Mesh(geometry,flow);basin.add(jet);jets.push(jet);}}
  for(const name of ['yangquelong-east-bowl-north','yangquelong-east-bowl-south']){const bowl=new THREE.Group();bowl.name=name;const sheet=new THREE.Mesh(geometry,surface);bowl.add(sheet);group.add(bowl);bowls.push(sheet);}
  let disposed=0,updated=0;geometry.addEventListener('dispose',()=>disposed++);
  return{group,sheets,jets,bowls,update:time=>updated=time,get updated(){return updated;},get released(){return disposed;},dispose(){geometry.dispose();surface.dispose();flow.dispose();stone.dispose();}};
}

test('only the three named surface roles are hidden, leaving six flows, high bowls, animation and resource ownership intact',()=>{
  const resource=waterResource(),update=resource.update;
  try{
    configureMuseumLandscapeAsset(resource,site);configureMuseumLandscapeAsset(resource,site);
    assert(resource.sheets.every(mesh=>!mesh.visible&&mesh.userData.navigation===false));assert(resource.jets.every(mesh=>mesh.visible));assert.equal(resource.jets.length,6);assert(resource.bowls.every(mesh=>mesh.visible));
    assert.equal(resource.sheets[0].material,resource.bowls[0].material,'shared material is untouched');assert.equal(resource.released,0);assert.equal(resource.update,update);resource.update(7);assert.equal(resource.updated,7);
  }finally{resource.dispose();}assert.equal(resource.released,1);
});

test('missing or ambiguous named water surfaces fail before partially hiding other basins',()=>{
  for(const failure of ['missing','extra']){const resource=waterResource();try{
    const basin=resource.group.getObjectByName(basinNames[2]);if(failure==='missing')resource.group.remove(basin);else basin.add(resource.sheets[2].clone());
    assert.throws(()=>configureMuseumLandscapeAsset(resource,site),/Yangquelong.*(basin|sheet)/);assert(resource.sheets.every(mesh=>mesh.visible));assert.equal(resource.released,0);
  }finally{resource.dispose();}}
});

test('court water validation rejects non-finite levels and footprints outside their excavation',()=>{
  const {layout,courts}=adapted(),court=courts[0];
  for(const water of [{...court.water,surfaceY:NaN},{...court.water,surfaceY:court.floorY},{...court.water,polygon:rect(450,-650,456,-640)},{...court.water,surfacePolygon:rect(450,-650,456,-640)}])assert.throws(()=>createGardenTerrain({layout,assetCourts:[{...court,water}]}),/Asset court water/);
  const notch=[[440,-650],[445,-650],[445,-645],[443,-645],[443,-648],[442,-648],[442,-645],[440,-645]],acrossNotch=rect(440.5,-649.5,444.5,-645.5);
  assert(acrossNotch.every(point=>pointInPolygon(point,notch)),'negative control: testing only water vertices would accept an edge across the concavity');
  assert.throws(()=>createGardenTerrain({layout,assetCourts:[{...court,polygon:notch,water:{surfaceY:3.7,polygon:acrossNotch}}]}),/Asset court water/);
});

test('terrain owns the three replacement water geometries and releases each exactly once',()=>{
  const {layout,pads,courts}=adapted(),local=createGardenTerrain({layout,assetPads:pads,assetCourts:courts});let released=0;
  const descriptors=JSON.stringify(courts);for(const water of local.waterSurfaces)water.geometry.addEventListener('dispose',()=>released++);
  local.dispose();local.dispose();assert.equal(released,3);assert.equal(local.group.children.length,0);assert.equal(JSON.stringify(courts),descriptors);
});
