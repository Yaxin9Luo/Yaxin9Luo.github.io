import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMuseumTerrainAssets} from '../src/yuanmingyuan/museum-terrain-assets.js';
import {createTerrainPatchOwner} from '../src/yuanmingyuan/terrain-patch-owner.js';
import {createArchitectureSurface} from '../src/yuanmingyuan/architecture-surface.js';
import {createTriangleSampler,triangulateSurface} from '../src/yuanmingyuan/terrain-geometry.js';
import {createMuseumResidentBuildings} from '../src/yuanmingyuan/museum-resident-buildings.js';
import {createMuseumSiteController} from '../src/yuanmingyuan/site-controller.js';

const site={id:'fixture-hill',assetId:'fixture-hill'},rect=r=>[[-r,-r],[r,-r],[r,r],[-r,r]];
const descriptor={id:'fixture-hill-ground',assetId:site.assetId,prepared:{courts:[{polygon:rect(2),floorY:0}],pads:[],paths:[]}};
function fixture(){
  const material=new THREE.MeshBasicMaterial(),coarse=triangulateSurface([{outer:rect(10),holes:[]}],{heightAt:()=>4,edgeLength:Infinity}),root=new THREE.Group(),assets=[];
  const patch=createTerrainPatchOwner({descriptor,coarseGeometry:coarse,material,buildFine(){const group=new THREE.Group(),land=triangulateSurface([{outer:rect(10),holes:[]}],{heightAt:()=>1,edgeLength:Infinity}),sampler=createTriangleSampler([land]);group.add(new THREE.Mesh(land,material));return {group,land,triangleCount:2,surfaceAt(x,z,{maxY}){const hit=sampler.sample(x,z,maxY);return hit?{...hit,walkable:false}:null;},dispose(){sampler.dispose();land.dispose();group.clear();}};}});root.add(patch.group);
  const calls=[],terrain={activateReplacement(id,binding){calls.push(['activate',id,binding.owner.group.name]);patch.activate(binding);if(binding.owner.failActivation)throw new Error('fixture failed after source activation');},revertReplacement(id){calls.push(['revert',id]);return patch.revert();},get disposed(){return patch.disposed;}};
  const manager=createMuseumTerrainAssets({terrain,replacements:[descriptor]});
  function asset(name,height){const group=new THREE.Group(),geometry=new THREE.BoxGeometry(6,1,6);group.name=name;group.position.y=height-.5;group.add(new THREE.Mesh(geometry,material));root.add(group);const support=createArchitectureSurface(group),release=support.dispose;let supportDisposals=0;support.dispose=()=>{supportDisposals++;release();};const owner={group,disposeCalls:0,dispose(){this.disposeCalls++;geometry.dispose();group.removeFromParent();group.clear();},get disposed(){return this.disposeCalls>0;}};const item={owner,support,get supportDisposals(){return supportDisposals;}};assets.push(item);return item;}
  return {root,patch,terrain,manager,calls,asset,get state(){return manager.snapshot.replacements[0];},height(){return patch.surfaceAt(0,0).height;},dispose(){manager.dispose();patch.dispose();for(const {owner,support} of assets){if(!support.disposed)support.dispose();if(!owner.disposed)owner.dispose();}material.dispose();}};
}

test('resident stays retained while primary wins, then primary release atomically restores resident before final revert',()=>{
  const f=fixture(),resident=f.asset('resident',6),primary=f.asset('primary',8);
  try{
    assert.equal(f.height(),4);const leaveResident=f.manager.attach({site,...resident,role:'resident'});assert.equal(f.height(),6);assert.equal(f.state.activeRole,'resident');
    const leavePrimary=f.manager.attach({site,...primary,role:'primary'});assert.equal(f.height(),8);assert.equal(primary.owner.group.visible,true);assert.equal(resident.owner.group.visible,false);assert.equal(f.patch.coarse.visible,false);
    const before=f.calls.length;leavePrimary();assert.deepEqual(f.calls.slice(before),[['activate',descriptor.id,'resident']]);assert.equal(f.height(),6);assert.equal(resident.owner.group.visible,true);assert.equal(primary.owner.group.visible,false);assert.equal(primary.support.disposed,false);assert.equal(f.state.bindingCount,1);
    primary.support.dispose();primary.owner.dispose();assert.equal(f.height(),6);leavePrimary();assert.equal(f.state.bindingCount,1);
    leaveResident();assert.equal(f.height(),4);assert.equal(f.patch.coarse.visible,true);assert.equal(f.state.bindingCount,0);assert.equal(resident.owner.disposeCalls,0);assert.equal(resident.supportDisposals,0);
  }finally{f.dispose();}
});

test('resident arriving after a primary stays hidden and never replaces primary support while it waits',()=>{
  const f=fixture(),primary=f.asset('primary-first',8),resident=f.asset('resident-late',6);
  try{const leavePrimary=f.manager.attach({site,...primary,role:'primary'}),before=f.calls.length,leaveResident=f.manager.attach({site,...resident,role:'resident'});assert.equal(f.calls.length,before);assert.equal(f.height(),8);assert.equal(resident.owner.group.visible,false);assert.equal(primary.owner.group.visible,true);leaveResident();assert.equal(f.calls.length,before);assert.equal(f.height(),8);leavePrimary();assert.equal(f.height(),4);}finally{f.dispose();}
});

test('binding failure after terrain mutation restores the preceding valid source and does not retain the failed binding',()=>{
  const f=fixture(),resident=f.asset('resident',6),bad=f.asset('bad-primary',9);bad.owner.failActivation=true;
  try{const leave=f.manager.attach({site,...resident,role:'resident'});assert.throws(()=>f.manager.attach({site,...bad,role:'primary'}),/fixture failed/);assert.equal(f.height(),6);assert.equal(resident.owner.group.visible,true);assert.equal(bad.owner.group.visible,false);assert.equal(f.state.bindingCount,1);assert.equal(f.state.activeRole,'resident');assert.match(f.state.error,/failed after/);assert.equal(bad.owner.disposeCalls,0);assert.equal(bad.supportDisposals,0);leave();}finally{f.dispose();}
});

test('a failed first binding restores coarse geometry instead of leaving a partly activated full owner',()=>{
  const f=fixture(),bad=f.asset('bad-first',9);bad.owner.failActivation=true;
  try{assert.throws(()=>f.manager.attach({site,...bad,role:'primary'}),/fixture failed/);assert.equal(f.height(),4);assert.equal(f.state.activeRole,null);assert.equal(f.state.bindingCount,0);assert.equal(bad.owner.group.visible,false);assert.equal(f.patch.coarse.visible,true);}finally{f.dispose();}
});

test('an already released resident support cannot become a fallback or remain registered',()=>{
  const f=fixture(),resident=f.asset('resident',6),primary=f.asset('primary',8);
  try{const leaveResident=f.manager.attach({site,...resident,role:'resident'}),leavePrimary=f.manager.attach({site,...primary,role:'primary'});resident.support.dispose();resident.support.surfaceAt=()=>{throw new Error('disposed support was queried');};leavePrimary();assert.equal(f.height(),4);assert.equal(f.state.bindingCount,0);assert.equal(f.state.activeRole,null);leaveResident();assert.equal(f.state.bindingCount,0);assert.equal(primary.owner.disposeCalls,0);}finally{f.dispose();}
});

test('release never rolls back to the departing primary if the retained resident activation now fails',()=>{
  const f=fixture(),resident=f.asset('resident',6),primary=f.asset('primary',8);
  try{const leaveResident=f.manager.attach({site,...resident,role:'resident'}),leavePrimary=f.manager.attach({site,...primary,role:'primary'});resident.owner.failActivation=true;assert.throws(()=>leavePrimary(),/binding failed|fixture failed/);assert.equal(f.height(),4);assert.equal(f.state.activeRole,null);assert.equal(primary.owner.group.visible,false);assert.equal(primary.owner.disposeCalls,0);primary.support.dispose();primary.owner.dispose();assert.equal(f.height(),4);leaveResident();}finally{f.dispose();}
});

test('newer primary registration has priority and a stale older unbind cannot release it',()=>{
  const f=fixture(),old=f.asset('old-primary',7),current=f.asset('current-primary',8),resident=f.asset('resident',6);
  try{const leaveResident=f.manager.attach({site,...resident,role:'resident'}),leaveOld=f.manager.attach({site,...old,role:'primary'}),leaveCurrent=f.manager.attach({site,...current,role:'primary'});assert.equal(f.height(),8);const before=f.calls.length;leaveOld();assert.equal(f.calls.length,before);assert.equal(f.height(),8);assert.equal(current.owner.group.visible,true);leaveCurrent();assert.equal(f.height(),6);leaveResident();}finally{f.dispose();}
});

test('unknown sites are no-ops and malformed or duplicate target bindings leave the working owner intact',()=>{
  const f=fixture(),resident=f.asset('resident',6),other=f.asset('unrelated',7);
  try{const noop=f.manager.attach({site:{id:'other',assetId:'other'},...other,role:'primary'});noop();noop();assert.equal(other.owner.group.visible,true);assert.equal(f.calls.length,0);const leave=f.manager.attach({site,...resident,role:'resident'});assert.throws(()=>f.manager.attach({site,...resident,role:'primary'}),/already bound/);assert.equal(f.height(),6);assert.equal(resident.owner.group.visible,true);assert.throws(()=>f.manager.attach({site,owner:other.owner,support:null,role:'primary'}),/requires a ready/);assert.equal(f.height(),6);assert.equal(other.owner.group.visible,false);leave();}finally{f.dispose();}
});

test('manager disposal reverts once, clears borrowed bindings, and leaves all resource disposal to their owners',()=>{
  const f=fixture(),resident=f.asset('resident',6),primary=f.asset('primary',8);
  try{const leaveResident=f.manager.attach({site,...resident,role:'resident'}),leavePrimary=f.manager.attach({site,...primary,role:'primary'});const before=f.calls.length;f.manager.dispose();f.manager.dispose();leavePrimary();leaveResident();assert.deepEqual(f.calls.slice(before),[['revert',descriptor.id]]);assert.equal(f.height(),4);assert.equal(f.state.bindingCount,0);assert.equal(resident.supportDisposals,0);assert.equal(primary.owner.disposeCalls,0);assert.equal(f.terrain.disposed,false);assert.throws(()=>f.manager.attach({site,...primary,role:'primary'}),/disposed/);}finally{f.dispose();}
});

test('real primary controller and resident mount hook hand back support before disposing the departing primary, without another full load',async()=>{
  const f=fixture(),resident=f.asset('resident',6),primary=f.asset('primary',8),events=[];resident.owner.group.removeFromParent();primary.owner.group.removeFromParent();primary.owner.group.visible=false;
  const controller=createMuseumSiteController({sites:[site],load:async()=>primary.owner,mount(owner,mountedSite){f.root.add(owner.group);owner.group.updateWorldMatrix(true,true);const unbind=f.manager.attach({site:mountedSite,owner,support:primary.support,role:'primary'});return()=>{unbind();events.push(['primary-unbound',f.height(),primary.owner.disposeCalls,primary.support.disposed]);primary.support.dispose();};}});
  const sourceSHA='a'.repeat(64),full={id:site.id,assetId:site.assetId,representation:'full',site:{...site,position:[0,0,0],rotationY:0,scale:1},approvedFullSHA256:sourceSHA,source:{manifestURL:'/fixture/full.json',approvedManifestSHA256:sourceSHA}};
  let loads=0;const layer={snapshot:{sites:[]},async load(){},setFullSites(){},evaluate(){return this.snapshot;},update(){},dispose(){}};
  const director=createMuseumResidentBuildings({root:f.root,descriptors:[full],siteController:controller,baseURL:'https://binding.test/',createDistance:()=>layer,loadFull:async()=>{loads++;return resident.owner;},mountFull(owner,d){assert.equal(owner.group.parent,f.root);const unbind=f.manager.attach({site:d.site,owner,support:resident.support,role:'resident'});return()=>{try{unbind();events.push(['resident-unbound',f.height(),resident.owner.disposeCalls]);}finally{resident.support.dispose();}};}});
  try{
    await director.load();assert.equal(f.height(),6);await controller.select(site.id);director.evaluate({});assert.equal(f.height(),8);assert.equal(primary.owner.group.visible,true);assert.equal(resident.owner.group.visible,false);assert.equal(f.state.bindingCount,2);
    controller.cancel();assert.deepEqual(events[0],['primary-unbound',6,0,false]);assert.equal(primary.owner.disposeCalls,1);assert.equal(primary.support.disposed,true);assert.equal(resident.support.disposed,false);director.evaluate({});assert.equal(f.height(),6);assert.equal(resident.owner.group.visible,true);assert.equal(f.state.activeRole,'resident');await director.load();assert.equal(loads,1);
    await director.dispose();assert.deepEqual(events[1],['resident-unbound',4,0]);assert.equal(f.height(),4);assert.equal(resident.owner.disposeCalls,1);assert.equal(resident.support.disposed,true);assert.equal(f.state.bindingCount,0);
  }finally{controller.dispose();await director.dispose();f.dispose();}
});
