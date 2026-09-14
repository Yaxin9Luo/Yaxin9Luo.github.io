import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumLandscape} from '../src/yuanmingyuan/museum-landscape.js';
import {sitePoint} from '../src/yuanmingyuan/museum-sites.js';
import {prepareTerrainPads,applyTerrainPads} from '../src/yuanmingyuan/terrain-pads.js';
import {hillHeightSampler} from '../src/yuanmingyuan/xianfa-landscape-geometry.js';

const site={id:'xianfashan',assetId:'xianfashan',position:[925,4,-640],rotationY:0,scale:1};
const contactId='xianfashan-mound-edge-ground';
const close=(a,b,epsilon=1e-9)=>assert(Math.abs(a-b)<epsilon,`${a} versus ${b}`);

test('all visible boundary samples of the original 180-column mound meet local zero; low samples are below the original entry paving',()=>{
  const height=hillHeightSampler();let low=0;
  for(let side=0;side<4;side++)for(let i=0;i<=180;i++){
    const coordinate=(i/180-.5)*51.6,x=side===0?-25.8:side===1?25.8:coordinate,z=side===2?-25.8:side===3?25.8:coordinate;
    const y=Math.fround(height(x,z));
    if(y!==0){low++;assert.equal(side,0);assert(Math.abs(z)<1.74);assert(y>=-.008&&y<0);}
    else close(y,0);
    assert(y<.04,'the retained stone approach stays above every boundary point');
  }
  assert(low>0,'the entry dip is a real source exception, not an assumed perfectly flat boundary');
});

test('the contact band is pending with the coarse hill and overrides only the outer four metres after full preparation',()=>{
  const plan=createMuseumLandscape({sites:[site]}),replacement=plan.replacements[0],pads=prepareTerrainPads(replacement.prepared.pads),old=pads.filter(p=>p.id!==contactId);
  assert.equal(replacement.ready,false);assert(plan.layout.landforms.some(h=>h.id==='xianfa-hill'));assert(!plan.pads.some(p=>p.id===contactId));
  assert.equal(pads.at(-1).id,contactId);assert.deepEqual(pads.at(-1).polygon,replacement.prepared.courts[0].polygon);
  const z=-653;
  close(applyTerrainPads(950.8,z,4.2,old),3.82);
  for(const d of [0,.001,.2,1,2,3,3.999,4,5]){
    const before=applyTerrainPads(950.8+d,z,4.2,old),after=applyTerrainPads(950.8+d,z,4.2,pads);
    if(d===0)close(after,4);if(d>=4)assert.equal(after,before);
    assert(after>=before&&after<=4);
  }
  close(applyTerrainPads(950.8,z,4.2,pads),applyTerrainPads(950.8+1e-6,z,4.2,pads),1e-10);
});

test('the narrow ground contact follows the already-authored site rotation, elevation and positive scale',()=>{
  const transformed={...site,position:[20,7,30],rotationY:.71,scale:1.4},replacement=createMuseumLandscape({sites:[transformed]}).replacements[0];
  const pad=prepareTerrainPads(replacement.prepared.pads).at(-1),point=sitePoint(transformed,[25.8,0,-10]);
  close(pad.heightY,7);close(pad.blend,5.6);close(applyTerrainPads(point.x,point.z,6.5,[pad]),7);
  const outer=sitePoint(transformed,[30.8,0,-10]);assert.equal(applyTerrainPads(outer.x,outer.z,6.5,[pad]),6.5);
});
