import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,PerspectiveCamera} from 'three';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';

const sha='a'.repeat(64),descriptor={id:'aviary',assetId:'aviary',representation:'full',approvedFullSHA256:sha,source:{manifestURL:'/source/manifest.json',approvedManifestSHA256:sha},site:{id:'aviary',position:[0,0,0],rotationY:0,scale:1}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function owner(){const group=new Group(),geometry=new BoxGeometry(4,5,6),material=new MeshStandardMaterial();group.add(new Mesh(geometry,material));let disposed=0;return {group,dispose(){disposed++;geometry.dispose();material.dispose();},get disposed(){return disposed;}};}
function inputs(root,loadFull,siteController){return {root,descriptors:[descriptor],loadFull,siteController,baseURL:'http://127.0.0.1:9999/',fetchImpl:()=>{throw new Error('Full-only residents must not request distance archives');}};}
function view(){const camera=new PerspectiveCamera(45,1,.1,5000);camera.position.set(0,10,40);camera.lookAt(0,0,0);camera.updateMatrixWorld();return {camera,renderer:{getDrawingBufferSize:out=>out.set(1000,1000)}};}

test('full-only resident keeps geometry visible across actual primary loading, takeover and departure',async()=>{
  const root=new Group(),full=owner(),primary=owner(),gate=deferred();let loads=0;
  const controller=createMuseumSiteController({sites:[descriptor.site],load:()=>gate.promise,mount:resource=>{root.add(resource.group);}});
  const director=createMuseumResidentBuildings(inputs(root,async()=>{loads++;return full;},controller));
  try{
    await director.load();assert.equal(director.snapshot.distance.sites.length,0);director.evaluate(view());assert.equal(full.group.visible,true);
    const selecting=controller.select('aviary');director.evaluate(view());assert.equal(full.group.visible,true,'the loading caption does not hide the resident');
    gate.resolve(primary);await selecting;director.evaluate(view());assert.equal(primary.group.parent,root);assert.equal(full.group.visible,false);assert.equal(director.snapshot.full[0].primaryVisible,true);
    controller.cancel();director.evaluate(view());assert.equal(primary.disposed,1);assert.equal(full.group.visible,true);assert.equal(director.snapshot.full[0].primaryVisible,false);assert.equal(loads,1);
    assert.equal(director.nearest({x:2.5,z:0},1)?.site.id,'aviary');assert.equal(director.nearest({x:30,z:0},1),null);
  }finally{gate.resolve(primary);controller.dispose();await director.dispose();}
  assert.equal(full.disposed,1);assert.equal(full.group.parent,null);
});

test('unapproved full-only source and duplicate IDs fail before resource loading',()=>{
  const root=new Group(),options=inputs(root,async()=>{throw new Error('must not load');});
  for(const bad of [undefined,'b'.repeat(64),'short'])assert.throws(()=>createMuseumResidentBuildings({...options,descriptors:[{...descriptor,approvedFullSHA256:bad}]}),/approved source/);
  assert.throws(()=>createMuseumResidentBuildings({...options,descriptors:[descriptor,descriptor]}),/unique/);
});

test('full-only descriptor identity, placement, representation and source URL fail before mounting or loading',()=>{
  const root=new Group(),unrelated=new Group();root.add(unrelated);let loads=0;
  const options=inputs(root,async()=>{loads++;throw new Error('must not load');});
  const cases=[
    [{...descriptor,site:{...descriptor.site,id:'another-site'}},/placement/],
    [null,/IDs/],
    [{...descriptor,id:7},/IDs/],
    [{...descriptor,id:' '},/IDs/],
    [{...descriptor,assetId:null},/placement/],
    [{...descriptor,assetId:''},/placement/],
    [{...descriptor,site:null},/placement/],
    [{...descriptor,site:{...descriptor.site,id:undefined}},/placement/],
    [{...descriptor,site:{...descriptor.site,assetId:'another-asset'}},/placement/],
    ...[[0,0],[0,NaN,0],[0,Infinity,0],new Array(3)].map(position=>[{...descriptor,site:{...descriptor.site,position}},/placement/]),
    ...[undefined,NaN,Infinity].map(rotationY=>[{...descriptor,site:{...descriptor.site,rotationY}},/placement/]),
    ...[undefined,0,-1,NaN,Infinity].map(scale=>[{...descriptor,site:{...descriptor.site,scale}},/placement/]),
    [{...descriptor,representation:'full-typo'},/representation/],
    [{...descriptor,representation:null},/representation/],
    ...[7,'','https://another.test/source.json','file:///source.json'].map(manifestURL=>[{...descriptor,source:{...descriptor.source,manifestURL}},/source|origin/]),
  ];
  for(const [bad,message] of cases){
    assert.throws(()=>createMuseumResidentBuildings({...options,descriptors:[bad]}),message);
    assert.deepEqual(root.children,[unrelated],'invalid inputs cannot attach even an empty distance layer');
  }
  assert.equal(loads,0);
});

test('the actual approved full-only catalog entry has a matching site and passes validation without loading an archive',async()=>{
  const {museumResidentCatalog}=await import('../src/yuanmingyuan/museum-resident-catalog.js');
  const {museumSite}=await import('../src/yuanmingyuan/museum-sites.js');
  const root=new Group(),entries=museumResidentCatalog.filter(entry=>entry.representation==='full').map(entry=>({...entry,site:museumSite(entry.id)}));
  assert.ok(entries.length>0);
  const director=createMuseumResidentBuildings({...inputs(root,()=>{throw new Error('must not load');}),descriptors:entries});
  await director.dispose();assert.deepEqual(root.children,[]);
});

test('disposing a full-only resident waits for a late decoder and releases it once',async()=>{
  const root=new Group(),gate=deferred(),started=deferred(),late=owner();const director=createMuseumResidentBuildings(inputs(root,async()=>{started.resolve();return gate.promise;}));
  const loading=director.load();await started.promise;const disposing=director.dispose();assert.equal(director.dispose(),disposing);gate.resolve(late);await Promise.all([loading,disposing]);
  assert.equal(late.disposed,1);assert.equal(late.group.parent,null);assert.equal(director.snapshot.full[0].ready,false);assert.equal(director.snapshot.disposed,true);
});
