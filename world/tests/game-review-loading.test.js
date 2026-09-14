import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Game} from '../src/game.js';
import {selectShrubNormalEncoding} from '../src/herbarium-normal-policy.js';

const source=await readFile(new URL('../src/game.js',import.meta.url),'utf8'),begin=source.indexOf('  async _beginEnhancements(context)'),end=source.indexOf('\n  herbariumNormalSnapshot()',begin);
// Execute the actual Game orchestration against controlled I/O. Source image
// decoding is unchanged and has separate all-pixel coverage; no GPU is mocked
// into declaring a real frame here.
async function fixture(context={}){
  let now=1000,reentered=false;const calls=[],events=[],record=(name,options)=>{calls.push({name,deadline:options.deadline,at:now,signal:options.signal});return Promise.resolve(true);};
  const globals={selectShrubNormalEncoding,AbortController,performance:{now:()=>now},locations:[],hydrateScannedRocks(){},upgradeWizardMaterials(){}};
  for(const name of ['loadHerbariumAssets','loadLandscapeSurfaces','loadMountainArt','loadArchitectureAssets','loadAtmosphereAssets','loadEnvironmentSignage','loadWizardAsset','loadScannedRockAssets','loadBotanicalAssets'])globals[name]=options=>record(name+(options.variant?'/'+options.variant:options.families?'/trees':''),options);
  const method=vm.runInNewContext(`({${source.slice(begin,end)}})._beginEnhancements`,globals);
  const game={renderer:{extensions:{has:()=>false},capabilities:{maxTextureSize:16384}},options:{gameplay:false},environment:{night:0},position:{},world:{root:{},async enhance({prepareRegion}){for(const region of ['herbarium','gardens','vegetation','blossom-walks']){now+=5000;await prepareRegion(region);}this.complete=true;}},_refreshWorldBindings(){},_loadNightEnvironment:options=>record('night',options),_loadCompanions:async(options,ready)=>{await record('companions',options);await ready;}};
  const launchContext={...context,preloadNightEnvironment:true,onProgress:event=>{events.push(event);if(context.reenter&&!reentered&&event.phase==='enhancements-begin'){reentered=true;method.call(game,launchContext);}context.onProgress?.(event,game);}};await method.call(game,launchContext);return {game,calls,events};
}
test('explicit review budget reaches all initial, original/regional herbarium, full-rock and tree boundaries',async()=>{
  const {game,calls,events}=await fixture({reviewEnhancementBudgetMs:900000});
  assert.ok(calls.length>=13);for(const call of calls)assert.equal(call.deadline,901000,`${call.name} must not retain a shorter hidden clock`);
  assert.equal(events.find(e=>e.phase==='enhancements-begin').deadline,901000);assert.equal(events.filter(e=>e.phase==='full-frame').length,0,'enhancement completion is not rendering');assert.equal(typeof game._fullFrame,'function');
});
test('default Game keeps initial 90s, herbarium 180s and fresh rock/tree 90s clocks',async()=>{
  const {calls,events}=await fixture();
  for(const call of calls){const expected=call.name==='loadHerbariumAssets'?181000:call.name==='loadBotanicalAssets/trees'||call.name==='loadScannedRockAssets'&&call.at>1000?call.at+90000:91000;assert.equal(call.deadline,expected,call.name);}
  assert.equal(events.find(e=>e.phase==='enhancements-begin').deadline,undefined);
});
test('abort from review progress cannot launch resources or install a late full-frame callback',async()=>{
  for(const phase of ['enhancements-begin','enhancements']){
    const {game,calls}=await fixture({reviewEnhancementBudgetMs:900000,onProgress:(event,game)=>{if(event.phase===phase)game._enhancementController.abort();}});
    assert.equal(game._enhancementController.signal.aborted,true);assert.equal(game._fullFrame,undefined);
    if(phase==='enhancements-begin')assert.equal(calls.length,0);
  }
});
test('Game rejects an unbounded or altered explicit review budget before creating a renderer',async()=>{
  for(const reviewEnhancementBudgetMs of [Infinity,NaN,900001,0,'900000'])await assert.rejects(Game.createAsync(null,{}, {},{reviewEnhancementBudgetMs}),/15 minutes/);
});

test('a synchronous progress callback cannot reenter and duplicate the enhancement consumers',async()=>{
  const normal=await fixture(),reentered=await fixture({reenter:true});assert.equal(reentered.calls.length,normal.calls.length);assert.equal(reentered.events.filter(event=>event.phase==='enhancements-begin').length,1);
});
