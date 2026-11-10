import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guessTier,startingTier,createGovernor,TIERS} from '../src/academy/quality.js';
import {createHeightfield,HEIGHTFIELD} from '../src/academy/heightfield.js';
import {terrainHeight} from '../src/world.js';

test('the starting tier follows the GPU, core count and memory',()=>{
  const cases=[
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)','low'],
    ['ANGLE (Intel Inc., Intel(R) HD Graphics 6000, OpenGL 4.1)','low'],
    ['Intel Iris OpenGL Engine','low'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)','medium'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)','medium'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)','medium'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)','high'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)','high'],
    ['Google SwiftShader','low'],
  ];
  for(const [renderer,tier] of cases)assert.equal(guessTier({renderer}),tier,renderer);
  assert.equal(guessTier({renderer:'NVIDIA GeForce RTX 3060',cores:4}),'medium');
  assert.equal(guessTier({renderer:'NVIDIA GeForce RTX 3060',memory:4}),'low');
  assert.equal(guessTier({renderer:'Apple M2 Pro',mobile:true}),'medium');
});

test('the settings preference caps the device guess',()=>{
  assert.equal(startingTier('high','low'),'low','legacy "high" never forces a weak GPU up');
  assert.equal(startingTier('auto','high'),'high');
  assert.equal(startingTier('balanced','high'),'medium');
  assert.equal(startingTier('low','high'),'low');
  for(const tier of Object.values(TIERS))assert.ok(tier.pixelRatio>=1&&tier.particles>0);
});

test('the governor lowers resolution under sustained load, then trims effects at the floor',()=>{
  const g=createGovernor({windowMs:1000,minScale:.6,step:.1});let now=0,changes=[];
  for(let i=0;i<600;i++){now+=16;const c=g.sample(24,now);if(c)changes.push(c);}
  assert.ok(changes.length>=4);assert.equal(g.scale,.6);assert.ok(g.effects>=1);
  for(let i=1;i<changes.length;i++)assert.ok(changes[i].scale<=changes[i-1].scale);
});

test('the governor recovers with headroom but backs off and locks after a failed probe',()=>{
  const g=createGovernor({windowMs:1000,step:.1,upWindows:3,lockMs:20000});let now=0;
  const feed=(cost,ms)=>{const out=[];for(let t=0;t<ms;t+=16){now+=16;const c=g.sample(cost,now);if(c)out.push(c);}return out;};
  feed(30,3000);feed(5,1100);// the window straddling the change may still step down
  const low=g.scale;assert.ok(low<1);
  // Feed headroom only until the first step up, then load it immediately.
  let up=null;for(let t=0;t<8000&&!up;t+=16){now+=16;up=g.sample(5,now);}
  assert.ok(up&&g.scale>low,'steps back up');
  const probe=g.scale;feed(30,1100);assert.ok(g.scale<probe,'a failing probe steps down');
  const locked=g.scale;feed(5,8000);assert.equal(g.scale,locked,'locked after the failed probe');
  feed(5,20000);assert.ok(g.scale>locked,'unlocks later');
});

test('the governor ignores stalls and uses a vsync-aware threshold without timer queries',()=>{
  const g=createGovernor({windowMs:1000,usesInterval:true});let now=0,changes=0;
  for(let i=0;i<500;i++){now+=16.7;if(g.sample(i%50===0?400:16.7,now))changes++;}
  assert.equal(changes,0,'60 Hz frames with occasional stalls keep full resolution');
});

test('the baked heightfield reproduces the original terrain function',()=>{
  const buf=readFileSync(new URL('../src/academy/terrain.bin',import.meta.url));
  const hf=createHeightfield(new Uint16Array(buf.buffer,buf.byteOffset,buf.byteLength/2));
  assert.equal(buf.byteLength,HEIGHTFIELD.size*HEIGHTFIELD.size*2);
  let worst=0;
  for(let x=-180;x<=180;x+=7)for(let z=-180;z<=180;z+=9){worst=Math.max(worst,Math.abs(hf.heightAt(x,z)-terrainHeight(x,z)));}
  // Exact at grid nodes; between nodes only steep cliffs differ.
  for(let i=0;i<40;i++){const x=Math.round(Math.sin(i)*150),z=Math.round(Math.cos(i*1.7)*150);assert.ok(Math.abs(hf.heightAt(x,z)-terrainHeight(x,z))<.002,`${x},${z}`);}
  assert.ok(worst<20,`worst ${worst}`);
});
