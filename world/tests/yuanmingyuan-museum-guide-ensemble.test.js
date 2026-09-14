import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createMuseumGuideEnsemble} from '../src/yuanmingyuan/museum-guide-ensemble.js';
import {createMuseumGuides} from '../src/yuanmingyuan/museum-guides.js';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
const ids=['xieqiqu','xianfaqiao'];
function fixture({positions={xieqiqu:{x:0,y:4,z:0},xianfaqiao:{x:10,y:4,z:0}},throwPool=null,throwWorld=null,duplicate=false,tooMany=false}={}){
  const root=new Group(),events=[],created=[];
  function create(site){
    const point=positions[site.id],state={worldDisposed:false,poolDisposed:false,siteId:site.id,actorGroups:[]};
    const pool={create(){
      const group=new Group(),model=new Group();model.add(new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial()));group.add(model);state.actorGroups.push(group);
      return {group,model,asset:{sha256:'fixture-no-accepted-asset',durations:{sign_raise:1,sign_lower:1}},footStates:new Map(),
        setAction(action){this.action=action;},setSign(){},setLanguage(){},update(){},
        dispose(){events.push(site.id+':actor');group.removeFromParent();model.children[0].geometry.dispose();model.children[0].material.dispose();}};
    }};
    const world={heightAt:()=>{assert(!state.worldDisposed,'support remains live until all actor cleanup');return point.y;},waterLevel:2,colliders:[],
      placementReview:{accepted:1,placements:[{id:site.id+'-guide'}],rejected:[]},snapshot:()=>({disposed:state.worldDisposed}),
      dispose(){assert(!state.worldDisposed,'world is disposed once');state.worldDisposed=true;events.push(site.id+':world');if(throwWorld===site.id)throw new Error(site.id+' world cleanup failure');}};
    const system=createMuseumGuides({pool,root,heightAt:world.heightAt,waterLevel:2,colliders:[],placements:[{id:(duplicate?'duplicate':site.id)+'-guide',entryId:site.id,position:{x:point.x,z:point.z},heading:0,waypoints:[]}]});
    const dispose=system.dispose;system.dispose=()=>{assert(!state.poolDisposed,'pool is disposed once');state.poolDisposed=true;dispose();events.push(site.id+':pool');if(throwPool===site.id)throw new Error(site.id+' pool cleanup failure');};
    if(tooMany&&site.id===ids[1]){const snapshot=system.snapshot;system.snapshot=()=>{const s=snapshot();return {...s,actors:Array.from({length:4},(_,i)=>({...s.actors[0],id:site.id+'-guide-'+i}))};};}
    const record={guides:system,world,state};created.push(record);return record;
  }
  const ensemble=createMuseumGuideEnsemble({siteIds:ids,create});
  return {root,events,created,create,ensemble};
}
test('automatic focus retains generated NPC owner, transform, active interaction, and original exhibit while another site is current',()=>{
  const f=fixture();try{
    const first=f.ensemble.ensure({id:ids[0]}),group=first.state.actorGroups[0],owner=first.guides.snapshot().owner;
    const player={x:0,y:4,z:4.8};assert(f.ensemble.interact('xieqiqu-guide',{playerPosition:player}));
    const before=first.guides.snapshot().actors[0];f.ensemble.ensure({id:ids[1]});const retained=f.ensemble.ensure({id:ids[0]});
    assert.equal(retained,first);assert.equal(retained.state.actorGroups[0],group);assert(group.parent===f.root);assert.equal(retained.guides.snapshot().owner,owner);
    assert.deepEqual(retained.guides.snapshot().actors[0].position,before.position);assert.equal(retained.guides.snapshot().actors[0].interactionCount,1);assert.equal(retained.guides.snapshot().actors[0].busy,true);
    assert.equal(f.created.length,2);assert.equal(f.events.length,0);assert.deepEqual(f.ensemble.snapshot().retainedSites.map(s=>s.siteId),ids);
  }finally{f.ensemble.dispose();}
});
test('nearest and E traverse both real NPC controllers, keep the original entry, and select actual shortest horizontal distance',()=>{
  const f=fixture();try{
    f.ensemble.ensure({id:ids[0]});f.ensemble.ensure({id:ids[1]});
    const oldSiteVisitor={x:0,y:4,z:4.8};assert.equal(f.ensemble.nearest(oldSiteVisitor).entryId,'xieqiqu');
    const both={x:6,y:4,z:0},near=f.ensemble.nearest(both);assert.equal(near.id,'xianfaqiao-guide');assert.equal(near.entryId,'xianfaqiao');
    assert(f.ensemble.interact(near.id,{playerPosition:both}));assert.equal(f.created[1].guides.snapshot().actors[0].interactionCount,1);assert.equal(f.created[0].guides.snapshot().actors[0].interactionCount,0);
    assert.equal(f.ensemble.nearest(both).id,'xieqiqu-guide','busy nearest guide is rejected by its actual controller');
    assert.equal(f.ensemble.interact('not-created',{playerPosition:both}),false);
  }finally{f.ensemble.dispose();}
});
test('a horizontally closer NPC outside the actual vertical range cannot win selection',()=>{
  const f=fixture({positions:{xieqiqu:{x:0,y:4,z:0},xianfaqiao:{x:4,y:20,z:0}}});try{
    ids.forEach(id=>f.ensemble.ensure({id}));const near=f.ensemble.nearest({x:3,y:4,z:0});assert.equal(near.id,'xieqiqu-guide');
    assert.equal(f.ensemble.nearest({x:3,y:10,z:0}),null);
    assert.equal(f.ensemble.interact('xianfaqiao-guide',{playerPosition:{x:3,y:4,z:0}}),false);
  }finally{f.ensemble.dispose();}
});
test('updates, pause, language, picks and collisions cover all retained pools, including newly created pools',()=>{
  const f=fixture();try{
    f.ensemble.ensure({id:ids[0]});f.ensemble.setLanguage('zh');f.ensemble.setPaused(true);f.ensemble.ensure({id:ids[1]});
    f.ensemble.update(.05,{playerPosition:{x:50,y:4,z:50}});
    for(const record of f.created){const state=record.guides.snapshot();assert.equal(state.language,'zh');assert.equal(state.paused,true);assert.equal(state.activeTime,0);}
    assert.equal(f.ensemble.nearest({x:0,y:4,z:4.8}),null);
    f.ensemble.setPaused(false);f.ensemble.update(.05,{playerPosition:{x:50,y:4,z:50}});
    for(const record of f.created)assert(record.guides.snapshot().activeTime>0);
    assert.equal(f.ensemble.colliders.length,2);assert.equal(f.ensemble.pickMeshes.length,2);
    assert.deepEqual(f.ensemble.pickMeshes.map(mesh=>f.ensemble.idForObject(mesh)).sort(),['xianfaqiao-guide','xieqiqu-guide']);
    assert.equal(f.ensemble.idForObject(new Group()),null);assert.equal(f.ensemble.worlds.placementReview.accepted,2);assert.equal(f.ensemble.worlds.snapshot().sites.length,2);
  }finally{f.ensemble.dispose();}
});
test('explicit travel resets all old pools before support worlds and creates a fresh destination identity',()=>{
  const f=fixture();try{
    ids.forEach(id=>f.ensemble.ensure({id}));const old=f.created.slice();
    f.ensemble.reset({id:ids[1]});assert.equal(f.created.length,3);assert.equal(f.ensemble.snapshot().actors.length,1);assert.equal(f.ensemble.snapshot().actors[0].interactionCount,0);
    for(const record of old){assert.equal(record.state.poolDisposed,true);assert.equal(record.state.worldDisposed,true);assert.equal(record.state.actorGroups[0].parent,null);}
    const lastPool=Math.max(...f.events.map((s,i)=>s.endsWith(':pool')?i:-1)),firstWorld=f.events.findIndex(s=>s.endsWith(':world'));assert(lastPool<firstWorld);
    assert.notEqual(f.created[2].guides.snapshot().owner,old[1].guides.snapshot().owner);
  }finally{f.ensemble.dispose();f.ensemble.worlds.dispose();}
});
test('exit attempts every actor and world cleanup despite errors, then remains idempotent and inactive',()=>{
  const f=fixture({throwPool:ids[0],throwWorld:ids[1]});ids.forEach(id=>f.ensemble.ensure({id}));
  assert.throws(()=>f.ensemble.dispose(),error=>error instanceof AggregateError&&error.errors.length===2);
  assert(f.created.every(record=>record.state.poolDisposed&&record.state.worldDisposed));assert.equal(f.root.children.length,0);
  assert.equal(f.ensemble.nearest({x:0,y:4,z:4}),null);assert.equal(f.ensemble.colliders.length,0);assert.equal(f.ensemble.pickMeshes.length,0);
  const eventCount=f.events.length;f.ensemble.dispose();f.ensemble.worlds.dispose();assert.equal(f.events.length,eventCount);assert.equal(f.ensemble.snapshot().cleanupErrors.length,2);
  assert.throws(()=>f.ensemble.ensure({id:ids[0]}),/disposed/);
});
test('two-site and six-actor bounds reject unknown or oversized additions without retiring retained NPCs',()=>{
  const f=fixture({tooMany:true});try{
    const first=f.ensemble.ensure({id:ids[0]});assert.throws(()=>f.ensemble.ensure({id:'haiyantang'}),/Unknown/);assert.equal(f.created.length,1);
    assert.throws(()=>f.ensemble.ensure({id:ids[1]}),/at most three/);assert.equal(f.ensemble.ensure({id:ids[0]}),first);assert.equal(first.state.poolDisposed,false);
    assert.equal(f.created[1].state.poolDisposed,true);assert.equal(f.created[1].state.worldDisposed,true);assert.equal(f.ensemble.snapshot().actors.length,1);
  }finally{f.ensemble.dispose();}
});
test('duplicate guide ids across sites fail and release only the new region',()=>{
  const f=fixture({duplicate:true});try{
    const first=f.ensemble.ensure({id:ids[0]});assert.throws(()=>f.ensemble.ensure({id:ids[1]}),/identities must be unique/);
    assert.equal(f.ensemble.ensure({id:ids[0]}),first);assert.equal(first.state.poolDisposed,false);assert.equal(f.created[1].state.poolDisposed,true);
  }finally{f.ensemble.dispose();}
});
const source=await readFile(new URL('../src/yuanmingyuan/museum-scene.js',import.meta.url),'utf8');
// Include the real route predicate used by the extracted visit/guide functions.
const viewSource=source.slice(source.indexOf('function isJiuzhouComposition()'),source.indexOf('function renderMap()'));
assert(viewSource.startsWith('function isJiuzhouComposition()'));
const placeSource=source.slice(source.indexOf('function placeGuides('),source.indexOf('async function visit('));
const visitSource=source.slice(source.indexOf('async function visit('),source.indexOf('function advance('));
function sceneFixture(composed){
  const f=fixture(),sites=ids.map(id=>({id,entryId:id,arrival:[0,8,0],focus:[0,0,0],guide:[0,0,0]}));
  const context={query:new URLSearchParams(composed?'composition=xianfaqiao':''),composition:composed?{sites}:null,guides:null,guideSurface:null,pool:{},lang:'en',createMuseumGuideEnsemble,createGuideRegion:f.create,
    museumSite:id=>sites.find(site=>site.id===id),disposed:false,loading:false,contextLost:false,sites:{select:async()=>({})},currentSite:sites[0],ready:true,
    copy:{en:{building:'building',failed:'failed'}},locationCaption(){},syncControls(){},message(){},westernPlanting:null,reviewMotion:null,reviewMotionResult:null,
    state:{position:{x:0,y:8,z:0}},visitor:{group:new Group()},sitePoint:(_site,point)=>({x:point[0],y:point[1],z:point[2]}),museumTravelHeading:()=>0,
    resetCharacterMotion(){},frameVisitor(){},audio:{setEmitter(){}},advance(){},redraw:{request(){}},$:()=>({textContent:''}),evidence:()=>({}),start(){},
  };
  context.busy=value=>{context.loading=value;};vm.createContext(context);vm.runInContext(viewSource+'\n'+placeSource+'\n'+visitSource,context);
  return {...f,context};
}
test('actual live visit wiring retains pools for automatic focus and resets them for explicit map travel',async()=>{
  const f=sceneFixture(true);try{
    await f.context.visit(ids[0]);const first=f.created[0];await f.context.visit(ids[1],{teleport:false});
    assert.equal(first.state.poolDisposed,false);assert.equal(f.context.guides.snapshot().actors.length,2);assert.equal(f.context.currentSite.id,ids[1]);
    await f.context.visit(ids[0],{teleport:false});assert.equal(f.created.length,2);assert.equal(first.state.poolDisposed,false);
    await f.context.visit(ids[1]);assert.equal(f.context.guides.snapshot().actors.length,1);assert.equal(first.state.poolDisposed,true);
  }finally{f.context.guides?.dispose();f.context.guideSurface?.dispose();}
});
test('actual live visit preserves the original non-composition single-site rebuilding behavior',async()=>{
  const f=sceneFixture(false);try{
    await f.context.visit(ids[0]);const first=f.created[0];await f.context.visit(ids[1],{teleport:false});
    assert.equal(first.state.poolDisposed,true);assert.equal(first.state.worldDisposed,true);assert.equal(f.context.guides.snapshot().actors.length,1);
    assert.equal(f.context.guides.snapshot().actors[0].id,'xianfaqiao-guide');
  }finally{f.context.guides?.dispose();f.context.guideSurface?.dispose();}
});

const createSource=source.slice(source.indexOf('function createGuideRegion('),source.indexOf('function placeGuides('));
test('actual region construction closes its support world when placement or actor creation fails',()=>{
  for(const failure of ['placement','actor']){
    const original=new Error(failure+' failure');let released=0;
    const context={query:new URLSearchParams(),composition:null,createMuseumGuideWorld:()=>({dispose(){released++;}}),terrain:{},architecture:{},state:{position:{}},sitePoint:()=>({}),museumVisitorCollider(){},
      museumEntry:()=>({related:[]}),selectMuseumGuidePlacements(){if(failure==='placement')throw original;return {placements:[{id:'xieqiqu-guide',position:{},waypoints:[]}],rejected:[]};},
      createMuseumGuides(){throw original;},pool:{},scene:{},lang:'en',paused:()=>false,audio:{},reader:{},$:()=>({})};
    vm.createContext(context);vm.runInContext(viewSource+'\n'+createSource,context);
    assert.throws(()=>context.createGuideRegion({id:'xieqiqu',entryId:'xieqiqu',guide:[]}),error=>error===original);assert.equal(released,1);
  }
});
test('actor creation and support cleanup errors retain the original cause without hiding either error',()=>{
  const original=new Error('actor failure'),cleanup=new Error('support cleanup failure');
  const context={query:new URLSearchParams(),composition:null,createMuseumGuideWorld:()=>({dispose(){throw cleanup;}}),terrain:{},architecture:{},state:{position:{}},sitePoint:()=>({}),museumVisitorCollider(){},
    museumEntry:()=>({related:[]}),selectMuseumGuidePlacements:()=>({placements:[{id:'xieqiqu-guide',position:{},waypoints:[]}],rejected:[]}),
    createMuseumGuides(){throw original;},pool:{},scene:{},lang:'en',paused:()=>false,audio:{},reader:{},$:()=>({})};
  vm.createContext(context);vm.runInContext(viewSource+'\n'+createSource,context);
  assert.throws(()=>context.createGuideRegion({id:'xieqiqu',entryId:'xieqiqu',guide:[]}),error=>error.name==='AggregateError'&&error.cause===original&&error.errors[0]===original&&error.errors[1]===cleanup);
});
